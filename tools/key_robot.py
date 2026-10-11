#!/usr/bin/env python3
"""Cut the MOO1 robot anchor out of his newscast scene.

The 25 anchor cels are 292x105 pictures, not sprites: the gold robot sits in
front of a starfield with studio wall panels down both edges and the whole
thing baked into one opaque image. Composited onto the generated set he
brought his old set with him, which is why the broadcast used to be a small
window inside a bigger window.

He comes out cleanly because the scene is only 43 colours. The backdrop is a
flat dark blue with black around it and two teal panels; everything else is
him. Keying those four colours and keeping the largest connected region
leaves the robot with hard edges and no starfield speckle — the stars are
isolated dots on the backdrop and fall away with the rest of it.

His frames differ only across rows 49-68, the mouth, so what comes out is a
genuine 25-cel lip matrix rather than the two mouth states a generated
anchor has.

    python3 tools/key_robot.py
"""
import os
import sys
from collections import deque

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets')
OUT = os.path.join(ROOT, 'assets', 'generated', 'anchors')
FRAMES = 25
# Matches tools/condition_plates.py, which takes it from the renderer.
CAST_H = 244

# The backdrop, read off the cels' own edges.
BACKDROP = [((28, 28, 60), 46), ((0, 0, 0), 60),
            ((52, 93, 121), 46), ((65, 113, 146), 46)]


def subject_mask(a):
    """Everything that is not backdrop, reduced to its largest blob."""
    h, w, _ = a.shape
    bg = np.zeros((h, w), bool)
    for colour, tol in BACKDROP:
        bg |= np.abs(a - np.array(colour)).sum(axis=2) < tol
    fg = ~bg
    seen = np.zeros_like(fg)
    best, best_n = None, 0
    for sy in range(0, h, 3):
        for sx in range(0, w, 3):
            if not fg[sy, sx] or seen[sy, sx]:
                continue
            q = deque([(sy, sx)])
            seen[sy, sx] = True
            comp = []
            while q:
                y, x = q.popleft()
                comp.append((y, x))
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and fg[ny, nx] \
                            and not seen[ny, nx]:
                        seen[ny, nx] = True
                        q.append((ny, nx))
            if len(comp) > best_n:
                best_n, best = len(comp), comp
    mask = np.zeros((h, w), bool)
    if best:
        for y, x in best:
            mask[y, x] = True
    return mask


def main():
    os.makedirs(OUT, exist_ok=True)
    # One box for every cel, taken from the first, so the frames stay
    # registered: cropping each to its own content would make the mouth
    # move the whole head.
    box = None
    made = 0
    for i in range(1, FRAMES + 1):
        src = os.path.join(SRC, 'anchor_frame_%03d.png' % i)
        if not os.path.exists(src):
            continue
        a = np.asarray(Image.open(src).convert('RGB')).astype(int)
        mask = subject_mask(a)
        rgba = np.dstack([a.astype(np.uint8), (mask * 255).astype(np.uint8)])
        im = Image.fromarray(rgba, 'RGBA')
        if box is None:
            box = im.split()[3].getbbox()
        im = im.crop(box)
        h = CAST_H
        im = im.resize((max(1, round(im.width * h / im.height)), h),
                       Image.LANCZOS)
        # Hard alpha and a 256-colour palette, same as every other plate:
        # the resize interpolates and leaves thousands of in-between
        # colours in art that started with forty-three.
        alpha = im.split()[3].point(lambda v: 255 if v >= 128 else 0)
        rgb = im.convert('RGB').quantize(colors=256, method=Image.MEDIANCUT)
        im = rgb.convert('RGBA')
        im.putalpha(alpha)
        flat = Image.new('RGBA', im.size, (0, 0, 0, 0))
        im = Image.composite(im, flat, alpha)
        im.save(os.path.join(OUT, 'robot_frame_%03d.png' % i))
        made += 1
    if not made:
        print('no anchor cels found in assets/', file=sys.stderr)
        return 1
    print('%d cels -> assets/generated/anchors/robot_frame_*.png (%dpx tall, '
          'cut from %s)' % (made, CAST_H, box))
    return 0


if __name__ == '__main__':
    sys.exit(main())
