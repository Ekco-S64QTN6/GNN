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
import sys

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


def find_source(name):
    """Newest file called `name` directly in a source root, or None."""
    hits = [os.path.join(r, name) for r in SRC_ROOTS
            if os.path.isfile(os.path.join(r, name))]
    if not hits:
        return None
    return max(hits, key=os.path.getmtime)
OUT = os.path.join(ROOT, 'assets', 'generated', 'set')

def _frame():
    """The broadcast frame in source pixels, read from the renderer.

    Hardcoding it here is how the plates came to be conditioned to 292x105
    for a frame that had already become 320x180.
    """
    try:
        text = open(os.path.join(ROOT, 'js', 'renderer.js')).read()
        w = re.search(r'BASE_W\s*=\s*(\d+)', text)
        h = re.search(r'BASE_H\s*=\s*(\d+)', text)
        if w and h:
            return int(w.group(1)), int(h.group(1))
    except OSError:
        pass
    return 320, 180


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
# source file -> (installed name, width fraction or None for full bleed, role)
PLATES = [
    ('studio_wide_empty.png', 'studio_wide_empty.png', None, 'room'),
    ('desk_oval_front.png',   'desk_oval_front.png',   0.66, 'desk'),
    ('console_left.png',      'console_left.png',      0.22, 'prop'),
    ('console_right_02.png',  'console_right.png',     0.22, 'prop'),
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
    """Hard alpha and a 256-colour palette."""
    im = im.convert('RGBA')
    a = im.split()[3].point(lambda v: 255 if v >= 128 else 0)
    rgb = im.convert('RGB').quantize(colors=colours, method=Image.MEDIANCUT)
    out = rgb.convert('RGBA')
    out.putalpha(a)
    return out


def condition(src, frac=None):
    im = Image.open(src).convert('RGBA')
    if im.split()[3].getextrema()[0] < 255:          # has real transparency
        im = defringe(im)
    if frac is None:
        size = (VIEW_W, VIEW_H)
    else:
        w = max(1, round(VIEW_W * frac))
        size = (w, max(1, round(im.height * w / im.width)))
    return quantise(resize_premultiplied(im, size))


ANCHOR_OUT = os.path.join(ROOT, 'assets', 'generated', 'anchors')
STATES = ('desk_hero', 'speaking', 'listening')

# The cast is drawn at 70% of frame height (renderer.js CAST.h), so a plate
# wider than this is only carrying transparency.
CAST_H = 126          # 0.70 of the 180-line base grid


def subject_metrics(im):
    """Head top, shoulder span and whether a desk got baked in.

    All three are read off the alpha channel, which is the only thing that
    says where the figure actually is.
    """
    im = im.convert('RGBA')
    a = im.split()[3]
    w, h = im.size
    top = None
    for y in range(h):
        if any(a.getpixel((x, y)) > 200 for x in range(0, w, 6)):
            top = y
            break
    y40 = int(h * 0.40)
    run = [x for x in range(0, w, 4) if a.getpixel((x, y40)) > 200]
    span = (max(run) - min(run)) if run else 0
    # A cut-out tapers at the bottom. A baked-in desk is opaque right across.
    last = h - 3
    across = sum(1 for x in range(0, w, 8) if a.getpixel((x, last)) > 200)
    desk = across / float(len(range(0, w, 8))) > 0.9
    return {'top': top if top is not None else 0, 'span': span, 'desk': desk}


def do_anchors():
    """Condition and check every complete anchor set found in docs/."""
    species = set()
    for root in SRC_ROOTS:
        if not os.path.isdir(root):
            continue
        for f in os.listdir(root):
            if f.endswith('_desk_hero.png'):
                species.add(f[:-len('_desk_hero.png')])
    species = sorted(species)
    if not species:
        return
    os.makedirs(ANCHOR_OUT, exist_ok=True)
    print('\n--- anchors ---')
    for sid in species:
        found = {}
        for st in STATES:
            cand = find_source('%s_%s.png' % (sid, st))
            if cand:
                found[st] = cand
        if not found:
            continue
        metrics = {st: subject_metrics(Image.open(p)) for st, p in found.items()}
        for st, pth in found.items():
            im = condition(pth, CAST_H / 180.0 * (16 / 9.0))
            dest = os.path.join(ANCHOR_OUT, '%s_%s.png' % (sid, st))
            im.save(dest)

        tops = [m['top'] for m in metrics.values()]
        spans = [m['span'] for m in metrics.values() if m['span']]
        drift = max(tops) - min(tops)
        scale = (max(spans) / float(min(spans)) - 1) * 100 if spans else 0
        print('%s: %d of 3 states' % (sid, len(found)))
        for st in STATES:
            m = metrics.get(st)
            if m:
                print('   %-10s head top %4d  shoulder span %4d%s'
                      % (st, m['top'], m['span'], '   DESK BAKED IN' if m['desk'] else ''))
        bad = []
        if len(found) == 3 and drift > 12:
            bad.append('head top drifts %d px' % drift)
        if len(found) == 3 and scale > 4:
            bad.append('scale varies %.0f%%' % scale)
        if any(m['desk'] for m in metrics.values()):
            bad.append('a desk is baked into the plate')
        if len(found) < 3:
            bad.append('only %d of 3 states present' % len(found))
        if bad:
            print('   REJECT: %s' % '; '.join(bad))
            print('   The two variants must be *edits* of the hero, and the '
                  'figure must be cut out with nothing beneath it.')
        else:
            print('   OK: states align, clean cut-out')


def main():
    os.makedirs(OUT, exist_ok=True)
    made = {}
    layout = {'view': {'w': VIEW_W, 'h': VIEW_H}, 'anchors': ANCHOR_BAND,
              'plates': {}}
    for src_name, out_name, frac, role in PLATES:
        src = find_source(src_name)
        dest = os.path.join(OUT, out_name)
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
