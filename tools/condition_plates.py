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
"""
import json
import os
import sys

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'docs')
OUT = os.path.join(ROOT, 'assets', 'generated', 'set')

# The lit area of the studio monitor in *source* pixels, which is what these
# are authored at; renderer.js scales by exactly 3 on the way to the canvas.
VIEW_W, VIEW_H = 292, 105

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
    ('studio_wide_empty.png.png', 'studio_wide_empty.png', None, 'room'),
    ('desk_oval_front.png.png',   'desk_oval_front.png',   0.66, 'desk'),
    ('console_left.png',          'console_left.png',      0.22, 'prop'),
    ('console_right_02.png',      'console_right.png',     0.22, 'prop'),
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


def main():
    os.makedirs(OUT, exist_ok=True)
    made = {}
    layout = {'view': {'w': VIEW_W, 'h': VIEW_H}, 'anchors': ANCHOR_BAND,
              'plates': {}}
    for src_name, out_name, frac, role in PLATES:
        src = os.path.join(SRC, src_name)
        if not os.path.exists(src):
            print('missing, skipped: docs/%s' % src_name)
            continue
        im = condition(src, frac)
        dest = os.path.join(OUT, out_name)
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
    return 0


if __name__ == '__main__':
    sys.exit(main())
