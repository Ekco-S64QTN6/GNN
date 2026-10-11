#!/usr/bin/env python3
"""Turn generated art into plates the engine can composite.

An image model returns a big, smooth, full-colour picture. The engine wants
the opposite: art at the resolution of the lit area of the studio monitor,
with hard alpha and a DOS-era palette, because `renderer.js` disables image
smoothing everywhere and blits at an exact 3x integer scale. Handing it the
raw render would make the canvas resample 2089px down to 876px with
nearest-neighbour, which drops pixels unevenly and destroys the dithering.

Three things are fixed here, in this order, because each depends on the last:

  de-fringe   Cut-outs come back keyed off black, so the partly transparent
              pixels along every edge still hold near-black RGB — 64-76% of
              them in the first batch. Composited over the teal set that is a
              dark halo around the desk. The opaque colour is bled outward
              into those pixels before anything else touches them.

  downscale   Done on premultiplied alpha, so transparent black cannot bleed
              back into the edge on the way down.

  quantise    Hard alpha at 50% (the art direction says no anti-aliasing) and
              256 colours, so generated plates cut together with the assets
              decoded out of the LBX archives rather than sitting on top of
              them looking like a different decade.

    python3 tools/condition_plates.py            # convert everything known
    python3 tools/condition_plates.py --preview  # also write a composite

Anchors are additionally *checked*, not just converted. The three states of a
species are crossfaded by the engine, so they have to share pose, scale and
eye-line; three separate generations never do. The first Bulrathi set drifted
18% in scale across its three states and would have read as the anchor
lurching at the camera. Finding that on the first species costs one batch;
finding it after ten costs thirty generations.
"""
import json
import os
import re
import shutil
import sys

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Source art is dropped by hand, so look for it where hands drop things.
# Deliberately NOT recursive: a subdirectory is where art gets filed once it
# has been rejected or superseded, and walking into those picks work back up
# after it has been thrown away.
SRC_ROOTS = [
    os.path.join(ROOT, 'assets', 'generated', '_inbox'),
    os.path.join(ROOT, 'docs'),
    os.path.expanduser('~/Downloads'),
]


def find_source(name, out_dir=None):
    """Newest file called `name` in a source root, or dropped into `out_dir`.

    The output directory counts as a source. It is the path the document
    tells people to save to, so it is where files turn up; a tool that only
    looks in directories of its own choosing reports nothing and looks
    broken. A file already there is a source if it is plainly not output —
    too big, or too many colours to have been through the quantiser.
    """
    roots = list(SRC_ROOTS)
    hits = [os.path.join(r, name) for r in roots
            if os.path.isfile(os.path.join(r, name))]
    if out_dir:
        cand = os.path.join(out_dir, name)
        if os.path.isfile(cand) and not conditioned_already(Image.open(cand)):
            hits.append(cand)
    if not hits:
        return None
    return max(hits, key=os.path.getmtime)
OUT = os.path.join(ROOT, 'assets', 'generated', 'set')

def _frame():
    """The broadcast frame in canvas pixels, read from the renderer.

    Plates are conditioned at the size they are drawn, not at the 320x180
    design grid. Conditioned to the grid they were upscaled four times by
    the canvas, while the anchors — bigger plates drawn smaller — were
    upscaled about twice, so the room looked coarse beside the people
    standing in it. The pixel-art look belongs to the source art, which
    already has chunky hand-sized pixels in it; resampling it down and back
    up does not add that, it only blurs what is there.
    """
    w, h, scale = 320, 180, 4
    try:
        text = open(os.path.join(ROOT, 'js', 'renderer.js')).read()
        mw = re.search(r'BASE_W\s*=\s*(\d+)', text)
        mh = re.search(r'BASE_H\s*=\s*(\d+)', text)
        ms = re.search(r'SCALE\s*=\s*(\d+)', text)
        if mw and mh:
            w, h = int(mw.group(1)), int(mh.group(1))
        if ms:
            scale = int(ms.group(1))
    except OSError:
        pass
    return w * scale, h * scale


VIEW_W, VIEW_H = _frame()

# Where each plate sits in the view. The desk comes back from the image model
# filling its whole frame, and composited at full size it covers the viewport
# and leaves nowhere for anyone to sit; it is a prop in the room, not a second
# backdrop. Width is a fraction of the view, anchored bottom-centre.
#
# The room plate already has consoles built into both side walls, so the two
# standalone consoles are not set dressing — they are free-standing props at a
# different perspective, kept for cutaways. They are conditioned the same way
# but given no place in the set, which is why their role is 'prop'.
#
# Source and installed name are the same: the document tells you to save
# straight to the installed path, so that is where the raw drop appears.
#
# source file -> (installed name, width fraction or None for full bleed, role)
PLATES = [
    ('studio_wide_empty.png', 'studio_wide_empty.png', None, 'room'),
    ('desk_oval_front.png',   'desk_oval_front.png',   0.66, 'desk'),
    ('console_left.png',      'console_left.png',      0.22, 'prop'),
    ('console_right.png',     'console_right.png',     0.22, 'prop'),
]

# Anchors composite into this band, behind the desk: centred, with their heads
# clear of the viewport's lower frame and their waists hidden by the desk top.
ANCHOR_BAND = {'y': 0.06, 'h': 0.46}


def defringe(im, rounds=4):
    """Bleed opaque colour outward into partly transparent pixels.

    Those pixels keep their alpha; only their RGB is replaced, with the
    average of whatever opaque neighbours they have. Four rounds is enough for
    the two-to-three pixel soft edge a generated cut-out carries.
    """
    im = im.convert('RGBA')
    px = im.load()
    w, h = im.size
    for _ in range(rounds):
        fixed = []
        for y in range(h):
            for x in range(w):
                a = px[x, y][3]
                if a >= 250:
                    continue
                r = g = b = n = 0
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1),
                               (1, 1), (-1, -1), (1, -1), (-1, 1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] >= 250:
                        pr, pg, pb, _ = px[nx, ny]
                        r += pr; g += pg; b += pb; n += 1
                if n:
                    fixed.append((x, y, (r // n, g // n, b // n, a)))
        if not fixed:
            break
        for x, y, v in fixed:
            px[x, y] = v
    return im


def resize_premultiplied(im, size):
    """Downscale without letting transparent black bleed into the edge."""
    im = im.convert('RGBA')
    r, g, b, a = im.split()
    pr = Image.merge('RGB', (r, g, b))
    pr = Image.composite(pr, Image.new('RGB', im.size, (0, 0, 0)), a)
    pr = pr.resize(size, Image.LANCZOS)
    a2 = a.resize(size, Image.LANCZOS)
    out = Image.new('RGBA', size)
    op, ap = pr.load(), a2.load()
    o = out.load()
    for y in range(size[1]):
        for x in range(size[0]):
            av = ap[x, y]
            if av == 0:
                o[x, y] = (0, 0, 0, 0)
                continue
            cr, cg, cb = op[x, y]
            s = 255.0 / av
            o[x, y] = (min(255, int(cr * s)), min(255, int(cg * s)),
                       min(255, int(cb * s)), av)
    return out


def quantise(im, colours=256):
    """Hard alpha and a 256-colour palette.

    Fully transparent pixels are flattened to a single value. They keep
    whatever colour the de-fringe bled into them otherwise, which is
    invisible but counts against the palette and bloats the file.
    """
    im = im.convert('RGBA')
    a = im.split()[3].point(lambda v: 255 if v >= 128 else 0)
    rgb = im.convert('RGB').quantize(colors=colours, method=Image.MEDIANCUT)
    out = rgb.convert('RGBA')
    out.putalpha(a)
    flat = Image.new('RGBA', out.size, (0, 0, 0, 0))
    return Image.composite(out, flat, a)


def crop_to_content(im):
    """Drop fully transparent margin.

    An image model centres its subject in the canvas and pads the rest, so a
    cut-out arrives with dead space baked into its height — the desk came
    back with 48 of its 121 rows empty. The engine then places the plate by
    its edges and inherits the padding, which is how the desk ended up with
    its front panel below the bottom of the frame while its invisible top
    margin sat in shot.
    """
    box = im.convert('RGBA').split()[3].point(lambda v: 255 if v > 8 else 0) \
            .getbbox()
    return im.crop(box) if box else im


def condition(src, frac=None):
    im = Image.open(src).convert('RGBA')
    if im.split()[3].getextrema()[0] < 255:          # has real transparency
        im = crop_to_content(im)
        im = defringe(im)
    if frac is None:
        size = (VIEW_W, VIEW_H)
    else:
        w = max(1, round(VIEW_W * frac))
        size = (w, max(1, round(im.height * w / im.width)))
    return quantise(resize_premultiplied(im, size))


ANCHOR_OUT = os.path.join(ROOT, 'assets', 'generated', 'anchors')
RAW_KEEP = os.path.join(ROOT, 'assets', 'generated', '_inbox')
STATES = ('desk_hero', 'speaking', 'listening')

# The cast is drawn at CAST.h of the frame height in renderer.js. Matching
# it here means the plate is blitted close to 1:1 instead of being scaled
# twice — once down by this tool and once up by the canvas.
CAST_H = int(VIEW_H * 0.34)


def subject_metrics(im):
    """Where the head sits and how big it is, read off the alpha channel.

    These say whether three states are the same drawing. The measurement is
    taken across the head rather than the shoulders: the body is grafted from
    the hero anyway, so shoulder width is identical by construction and tells
    you nothing, while a head that has moved or changed size is exactly what
    a crossfade exposes.

    There is deliberately no automatic check for a desk baked into the plate.
    The brief asks for the chest cropped at the bottom edge, so a correct
    cut-out is opaque along its bottom row, and every cheap test for a desk
    flagged correct art. A detector that rejects good work is worse than no
    detector, so that one is left to the eye.
    """
    im = im.convert('RGBA')
    a = np.asarray(im)[:, :, 3] > 200
    rows = a.sum(axis=1)
    nz = np.nonzero(rows > 0)[0]
    if not len(nz):
        return {'top': 0, 'head': 0}
    top = int(nz[0])
    neck = neck_row(im)
    # Halfway down the head: past the ears, around the eyes.
    y = min(len(rows) - 1, (top + neck) // 2)
    cols = np.nonzero(a[y])[0]
    head = int(cols.max() - cols.min()) if len(cols) else 0
    return {'top': top, 'head': head}


def neck_row(im):
    """The narrowest row between head and shoulders.

    Opaque width per row widens through the head, pinches at the neck and
    widens again at the shoulders, so the minimum in the middle half of the
    figure is the neck. Measured across eight species it lands at 52-59% of
    the frame, including on the ones without much of a neck to speak of.
    """
    a = np.asarray(im.convert('RGBA'))[:, :, 3] > 128
    w = a.sum(axis=1)
    nz = np.nonzero(w > 0)[0]
    if not len(nz):
        return len(w) // 2
    top = nz[0]
    lo = top + int((len(w) - top) * 0.25)
    hi = top + int((len(w) - top) * 0.75)
    return lo + int(np.argmin(w[lo:hi]))


def graft_body(hero, variant, feather=14):
    """Face from the variant, everything below the neck from the hero.

    Asked for an edit that changes only the mouth, the image model returns a
    picture that is the same to the eye but redrawn throughout — the dithering
    moves, and on the first full batch the GNN badge came back as an empty
    plate, because the instruction not to add lettering was read as licence to
    remove the lettering already there.

    Rather than spend a regeneration on each one, the body is taken from the
    hero and only the head from the variant. That restores the badge and has
    a second benefit worth more than the first: the uniform becomes pixel
    identical across the three states, so a crossfade moves the face and
    nothing else.
    """
    n = neck_row(hero)
    h = np.asarray(hero.convert('RGBA'), dtype=float)
    v = np.asarray(variant.convert('RGBA'), dtype=float)
    if h.shape != v.shape:
        return variant
    rows = h.shape[0]
    m = np.zeros((rows, 1, 1))
    m[:max(0, n - feather)] = 1.0
    for i in range(max(0, n - feather), min(rows, n + feather)):
        m[i] = 1.0 - (i - (n - feather)) / float(2 * feather)
    return Image.fromarray((v * m + h * (1 - m)).astype(np.uint8), 'RGBA')


def conditioned_already(im):
    """Whether this is output rather than something freshly dropped in."""
    return (im.width <= VIEW_W * 2 and im.height <= VIEW_H * 2
            and len(im.convert('RGB').getcolors(1 << 16) or []) <= 256)


def anchor_sources(sid, state):
    return find_source('%s_%s.png' % (sid, state), out_dir=ANCHOR_OUT)


def do_anchors():
    """Condition every complete anchor set, and check the states line up."""
    names = set()
    roots = SRC_ROOTS + [ANCHOR_OUT]
    for root in roots:
        if not os.path.isdir(root):
            continue
        for f in os.listdir(root):
            if f.endswith('_desk_hero.png'):
                names.add(f[:-len('_desk_hero.png')])
    if not names:
        return
    os.makedirs(ANCHOR_OUT, exist_ok=True)
    os.makedirs(RAW_KEEP, exist_ok=True)
    print('\n--- anchors ---')
    for sid in sorted(names):
        found = {}
        for st in STATES:
            src = anchor_sources(sid, st)
            if src:
                found[st] = src
        if not found:
            print('%s: already conditioned' % sid)
            continue

        metrics = {st: subject_metrics(Image.open(p)) for st, p in found.items()}
        hero_src = found.get('desk_hero')
        hero_im = Image.open(hero_src).convert('RGBA') if hero_src else None
        grafted = 0
        for st, src in found.items():
            im = Image.open(src).convert('RGBA')
            if hero_im is not None and st != 'desk_hero':
                im = graft_body(hero_im, im)
                grafted += 1
            # Cropped after the graft, so all three states are cut from the
            # same geometry and stay registered with one another.
            im = defringe(crop_to_content(im))
            h = CAST_H
            w = max(1, round(im.width * h / im.height))
            im = quantise(resize_premultiplied(im, (w, h)))
            dest = os.path.join(ANCHOR_OUT, '%s_%s.png' % (sid, st))
            # Keep the raw drop; conditioning is lossy and not worth redoing
            # from a regeneration.
            if os.path.abspath(src) == os.path.abspath(dest):
                shutil.copy2(src, os.path.join(RAW_KEEP, os.path.basename(src)))
            im.save(dest)

        tops = [m['top'] for m in metrics.values()]
        heads = [m['head'] for m in metrics.values() if m['head']]
        drift = max(tops) - min(tops)
        scale = (max(heads) / float(min(heads)) - 1) * 100 if heads else 0
        print('%s: %d of 3 states conditioned to %dpx tall%s'
              % (sid, len(found), CAST_H,
                 ', %d grafted onto the hero body' % grafted if grafted else ''))
        for st in STATES:
            m = metrics.get(st)
            if m:
                print('   %-10s head top %4d   head width %4d'
                      % (st, m['top'], m['head']))
        if len(found) < 3:
            print('   INCOMPLETE: %d of 3 states' % len(found))
        elif drift > 20 or scale > 8:
            print('   REJECT: head top drifts %d px, head size varies %.0f%% '
                  '— the states are not the same drawing' % (drift, scale))
            print('   Make the two variants as edits of the hero, not as '
                  'fresh generations.')
        else:
            print('   OK: states align (head drift %d px, size %.1f%%)'
                  % (drift, scale))
        print('   Check by eye that no desk is drawn into the plate.')


def main():
    os.makedirs(OUT, exist_ok=True)
    made = {}
    layout = {'view': {'w': VIEW_W, 'h': VIEW_H}, 'anchors': ANCHOR_BAND,
              'plates': {}}
    for src_name, out_name, frac, role in PLATES:
        dest = os.path.join(OUT, out_name)
        src = find_source(src_name, out_dir=OUT)
        if src and os.path.abspath(src) == os.path.abspath(dest):
            # Dropped straight into the output directory; keep the raw before
            # the conditioned version lands on top of it.
            os.makedirs(RAW_KEEP, exist_ok=True)
            shutil.copy2(src, os.path.join(RAW_KEEP, src_name))
        if not src:
            # A missing source is not a reason to forget a plate that has
            # already been conditioned: re-read it so its entry survives, and
            # only say nothing is there when nothing is.
            if os.path.exists(dest):
                im = Image.open(dest).convert('RGBA')
                made[out_name] = im
                spot = {'w': im.width, 'h': im.height, 'role': role}
                if role == 'room':
                    spot.update(x=0, y=0)
                elif role == 'desk':
                    spot.update(x=(VIEW_W - im.width) // 2,
                                y=VIEW_H - im.height)
                layout['plates'][out_name] = spot
                print('%-24s -- source gone, keeping conditioned %dx%d'
                      % (src_name, im.width, im.height))
            else:
                print('not found anywhere, skipped: %s' % src_name)
            continue
        im = condition(src, frac)
        im.save(dest)
        made[out_name] = im
        spot = {'w': im.width, 'h': im.height, 'role': role}
        if role == 'room':
            spot.update(x=0, y=0)
        elif role == 'desk':
            spot.update(x=(VIEW_W - im.width) // 2, y=VIEW_H - im.height)
        layout['plates'][out_name] = spot
        where = ('at (%d,%d)' % (spot['x'], spot['y'])) if 'x' in spot else 'unplaced prop'
        print('%-24s -> set/%-22s %3dx%-3d %-14s %d colours'
              % (src_name, out_name, im.width, im.height, where,
                 len(im.convert('RGB').getcolors(1 << 16) or [])))

    with open(os.path.join(OUT, 'layout.json'), 'w') as fh:
        json.dump(layout, fh, indent=2)
    print('layout -> assets/generated/set/layout.json')

    if '--preview' in sys.argv and 'studio_wide_empty.png' in made:
        room = made['studio_wide_empty.png'].copy()
        band = ImageDraw.Draw(room, 'RGBA')
        by, bh = int(VIEW_H * ANCHOR_BAND['y']), int(VIEW_H * ANCHOR_BAND['h'])
        band.rectangle([VIEW_W // 2 - 46, by, VIEW_W // 2 + 46, by + bh],
                       outline=(255, 0, 128, 180))
        for name in ('desk_oval_front.png',):
            im2 = made.get(name)
            if im2 is None:
                continue
            spot = layout['plates'][name]
            room.alpha_composite(im2, (spot['x'], spot['y']))
        big = room.resize((room.width * 3, room.height * 3), Image.NEAREST)
        p = os.path.join(ROOT, 'docs', 'set-preview.png')
        big.save(p)
        print('preview (room + desk, at the 3x the engine uses) -> docs/set-preview.png')
    do_anchors()
    return 0


if __name__ == '__main__':
    sys.exit(main())
