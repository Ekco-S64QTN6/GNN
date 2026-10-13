#!/usr/bin/env python3
"""
test_human_anchor.py — iterate on the anchor conditioning for one species
without regenerating anything under assets/.

Loads the raw sources for one species out of assets/generated/_inbox/
(falling back to the same search roots condition_plates.py uses), runs the
same register -> mask -> swap pipeline, and writes the intermediates to
/tmp/ so the seam can be compared against the current output.

    python3 tools/test_human_anchor.py
    python3 tools/test_human_anchor.py --state listening_flip
    python3 tools/test_human_anchor.py --feather 16
    python3 tools/test_human_anchor.py --mode diff --diff-floor 2
    python3 tools/test_human_anchor.py --cut-offset 20

Writes to /tmp/<species>_<state>_*.png by default; override with --out.

The script does not write to assets/ and does not touch any species other
than the one named. Run it as many times as you like.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageFilter

import condition_plates as cp


def find_source(species, state):
    """The newest raw file for this state across the search roots."""
    name = '%s_%s.png' % (species, state)
    hits = []
    for root in cp.SRC_ROOTS:
        path = os.path.join(root, name)
        if os.path.isfile(path):
            hits.append(path)
    if not hits:
        return None
    return max(hits, key=os.path.getmtime)


def condition(im, crop, h):
    im = im.crop(crop)
    im = cp.defringe(im)
    w = max(1, round(im.width * h / im.height))
    return cp.quantise(cp.resize_premultiplied(im, (w, h)))


def row_mask(rows, cols, cut, feather):
    """The current behaviour: hard row cut with an N-row feather."""
    m = np.zeros((rows, 1, 1))
    m[:max(0, cut - feather)] = 1.0
    for i in range(max(0, cut - feather), min(rows, cut + feather)):
        m[i] = 1.0 - (i - (cut - feather)) / float(2 * feather)
    return np.broadcast_to(m, (rows, cols, 1)).copy()


def diff_mask(hero, variant, floor, blur_scale=1.0):
    """Per-pixel: 1 where the plates differ, 0 where they don't.

    Where the two plates agree — the collar, the shoulders, the base of
    the neck — the mask is zero, and the swap writes the hero back over
    itself. There is no row at which the swap 'ends', so there is no seam
    to see: the boundary is wherever the pictures differ, feathered by
    the blur. This is the alternative to a hard row cut.
    """
    a = np.asarray(hero.convert('RGB'), dtype=float)
    b = np.asarray(variant.convert('RGB'), dtype=float)
    d = np.abs(a - b).mean(axis=2)
    radius = max(2.0, d.shape[0] / 70.0 * blur_scale)
    d = np.asarray(
        Image.fromarray(d.astype(np.uint8)).filter(
            ImageFilter.GaussianBlur(radius)), dtype=float)
    # Below `floor` -> 0; above `floor + 3*floor` -> 1; smooth between.
    m = np.clip((d - floor) / max(1.0, 3.0 * floor), 0.0, 1.0)
    return m[:, :, None]


def tint_mask(im, mask):
    """Hero, dimmed, with the mask overlaid in red."""
    a = np.asarray(im.convert('RGBA'), dtype=float) / 255.0
    rgb = a[:, :, :3] * 0.5
    m = mask[:, :, 0]
    rgb[:, :, 0] = np.clip(rgb[:, :, 0] + m * 0.6, 0, 1)
    out = np.concatenate([rgb, a[:, :, 3:4]], axis=2)
    return Image.fromarray((out * 255).astype(np.uint8), 'RGBA')


def zoom_on(im, y_center, radius=50, scale=4):
    h, w = im.height, im.width
    y0 = max(0, y_center - radius)
    y1 = min(h, y_center + radius)
    crop = im.crop((0, y0, w, y1))
    return crop.resize((crop.width * scale, crop.height * scale),
                       Image.NEAREST)


def side_by_side(imgs, gap=12, bg=(24, 24, 30)):
    h = max(i.height for i in imgs)
    w = sum(i.width for i in imgs) + gap * (len(imgs) - 1)
    out = Image.new('RGBA', (w, h), bg + (255,))
    x = 0
    for im in imgs:
        out.paste(im, (x, (h - im.height) // 2), im)
        x += im.width + gap
    return out


def build(species, state, hero_state='desk_hero', feather=4, cut_offset=0,
          mode='row', diff_floor=3):
    hero_src = find_source(species, hero_state)
    var_src = find_source(species, state)
    if not hero_src or not var_src:
        missing = []
        if not hero_src:
            missing.append('%s_%s.png' % (species, hero_state))
        if not var_src:
            missing.append('%s_%s.png' % (species, state))
        raise SystemExit(
            'missing raw source(s): %s\n'
            'looked in:\n  %s'
            % (', '.join(missing), '\n  '.join(cp.SRC_ROOTS)))

    hero_im = Image.open(hero_src).convert('RGBA')
    var_im = Image.open(var_src).convert('RGBA')

    var_reg, scale = cp.register(var_im, hero_im)

    boxes = [b for b in (cp.content_box(hero_im),
                         cp.content_box(var_reg)) if b]
    crop = (min(b[0] for b in boxes), min(b[1] for b in boxes),
            max(b[2] for b in boxes), max(b[3] for b in boxes))

    h = cp.CAST_H
    hero_c = condition(hero_im, crop, h)
    var_c = condition(var_reg, crop, h)

    if hero_c.size != var_c.size:
        raise SystemExit(
            'conditioned sizes differ: hero %s variant %s'
            % (hero_c.size, var_c.size))

    if mode == 'row':
        region = cp.head_region(hero_c, var_c)
        if region is None:
            raise SystemExit('head_region returned None — no head/body '
                             'boundary found; try --mode diff')
        _, cut_auto = region
        cut = cut_auto + cut_offset
        mask = row_mask(hero_c.height, hero_c.width, cut, feather)
    elif mode == 'diff':
        mask = diff_mask(hero_c, var_c, diff_floor)
        cut = None
    else:
        raise SystemExit('unknown --mode: %s' % mode)

    out = cp.swap_region(hero_c, var_c, mask)
    out = Image.composite(
        out, hero_c,
        Image.fromarray(((mask[:, :, 0] > 0.02) * 255).astype(np.uint8)))
    out = cp.quantise_like(out, hero_c)
    out = Image.composite(
        out, hero_c,
        Image.fromarray(((mask[:, :, 0] > 0.02) * 255).astype(np.uint8)))

    return {
        'hero': hero_c, 'variant': var_c, 'swap': out,
        'mask': mask, 'cut': cut, 'scale': scale,
        'hero_src': hero_src, 'var_src': var_src,
    }


def main():
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--species', default='human',
                    help='species id (default: human)')
    ap.add_argument('--state', default='listening',
                    help='variant state to build (default: listening)')
    ap.add_argument('--hero-state', default='desk_hero',
                    help='the hero state (default: desk_hero)')
    ap.add_argument('--feather', type=int, default=4,
                    help='feather width in rows for --mode row (default: 4)')
    ap.add_argument('--cut-offset', type=int, default=0,
                    help='shift the auto cut by N rows (default: 0)')
    ap.add_argument('--mode', choices=('row', 'diff'), default='row',
                    help='mask style (default: row, the current behaviour)')
    ap.add_argument('--diff-floor', type=float, default=3.0,
                    help='--mode diff: below this, mask is 0 (default: 3)')
    ap.add_argument('--out', default='/tmp',
                    help='output directory (default: /tmp)')
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    pre = os.path.join(args.out, '%s_%s' % (args.species, args.state))

    print('species=%s state=%s hero=%s' % (
        args.species, args.state, args.hero_state))
    print('mode=%s feather=%d cut_offset=%d diff_floor=%s'
          % (args.mode, args.feather, args.cut_offset, args.diff_floor))

    r = build(args.species, args.state, args.hero_state,
              args.feather, args.cut_offset, args.mode, args.diff_floor)

    print('hero src:    %s' % r['hero_src'])
    print('variant src: %s' % r['var_src'])
    print('register:    scale %+.1f%%' % ((r['scale'] - 1.0) * 100))
    print('conditioned: %dx%d' % r['hero'].size)
    if r['cut'] is not None:
        print('cut:         row %d of %d (%.0f%%)'
              % (r['cut'], r['hero'].height,
                 100.0 * r['cut'] / r['hero'].height))
    else:
        print('cut:         (per-pixel mask, no single row)')

    r['hero'].save(pre + '_01_hero.png')
    r['variant'].save(pre + '_02_variant.png')
    r['swap'].save(pre + '_03_swap.png')
    tint_mask(r['hero'], r['mask']).save(pre + '_04_mask.png')
    if r['cut'] is not None:
        zoom_on(r['hero'], r['cut']).save(pre + '_05_hero_zoom.png')
        zoom_on(r['swap'], r['cut']).save(pre + '_05_swap_zoom.png')
    side_by_side([r['hero'], r['swap'], r['variant']]).save(
        pre + '_06_side.png')

    print()
    print('wrote:')
    for suffix in ('_01_hero', '_02_variant', '_03_swap', '_04_mask',
                   '_05_hero_zoom', '_05_swap_zoom', '_06_side'):
        p = pre + suffix + '.png'
        if os.path.isfile(p):
            print('  %s' % p)
    print()
    print('_04_mask is the hero, dimmed, with the swap region tinted red — '
          'anything red is being replaced by the variant.')
    print('If the seam is a row cut in the wrong place, try '
          '--cut-offset +/- 20, a bigger --feather, or --mode diff.')
    return 0


if __name__ == '__main__':
    sys.exit(main())