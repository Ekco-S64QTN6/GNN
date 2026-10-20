#!/usr/bin/env python3
"""fix_listening.py — give every listening plate the hero's body.

A listening plate is a separate generation from the hero: its head is turned
the way it should be, but its shoulders, collar and hands sit a few pixels
off. On air the anchor who stops talking switches to `listening`, and the
whole body jumps. (The speaking plates had the same fault; the owner fixed
them by hand — cut the talking head out, paste it onto the hero. This is the
same move for the listening states.)

For each species and each of `listening`, `listening_flip`:
  1. find the neck on the hero's silhouette (condition_plates.neck_row);
  2. align the variant to the hero over the head only — translation within
     ±14 px, scale 0.92–1.08 — by minimising silhouette mismatch above the
     neck, so the turned head lands where the hero's head is;
  3. hero everywhere below the neck, aligned variant above it, with a short
     feathered seam at the neck;
  4. quantise, as every plate is, so the conditioner treats it as finished.

    python3 tools/fix_listening.py --preview     # sheet only, writes nothing
    python3 tools/fix_listening.py               # back up originals, write
    python3 tools/fix_listening.py --only klackon,psilon

Originals are copied to assets/generated/_inbox/listening_before_fix/ first.
"""
import argparse
import os
import shutil
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import condition_plates as cp                                     # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ANCH = os.path.join(ROOT, 'assets', 'generated', 'anchors')
BACKUP = os.path.join(ROOT, 'assets', 'generated', '_inbox', 'listening_before_fix')
STATES = ('listening', 'listening_flip')


def affine(img, scale, dx, dy, cx, cy):
    """Scale about (cx, cy), then shift by (dx, dy), on a same-size canvas."""
    w, h = img.size
    a = 1.0 / scale
    # PIL's affine maps output -> input.
    coeffs = (a, 0, cx - a * (cx + dx), 0, a, cy - a * (cy + dy))
    return img.transform((w, h), Image.AFFINE, coeffs, resample=Image.BICUBIC)


def align_head(hero, var, neck):
    """Best (scale, dx, dy) putting var's head on hero's head."""
    ha = np.asarray(hero)[:neck, :, 3] > 128
    ys, xs = np.nonzero(ha)
    cx, cy = float(xs.mean()), float(ys.mean())
    best = (1e9, 1.0, 0, 0)
    for scale in (0.92, 0.94, 0.96, 0.98, 1.0, 1.02, 1.04, 1.06, 1.08):
        for dy in range(-14, 15, 2):
            for dx in range(-14, 15, 2):
                t = affine(var, scale, dx, dy, cx, cy)
                ta = np.asarray(t)[:neck, :, 3] > 128
                cost = np.count_nonzero(ta ^ ha)
                if cost < best[0]:
                    best = (cost, scale, dx, dy)
    # Refine to single pixels around the coarse optimum.
    _, s0, x0, y0 = best
    for scale in (s0 - 0.01, s0, s0 + 0.01):
        for dy in range(y0 - 2, y0 + 3):
            for dx in range(x0 - 2, x0 + 3):
                t = affine(var, scale, dx, dy, cx, cy)
                ta = np.asarray(t)[:neck, :, 3] > 128
                cost = np.count_nonzero(ta ^ ha)
                if cost < best[0]:
                    best = (cost, scale, dx, dy)
    return best[1], best[2], best[3], cx, cy, best[0] / max(1, ha.sum())


def graft(hero, var, neck, feather=5):
    s, dx, dy, cx, cy, err = align_head(hero, var, neck)
    moved = affine(var, s, dx, dy, cx, cy)
    h = np.asarray(hero, dtype=float)
    v = np.asarray(moved, dtype=float)
    rows = h.shape[0]
    m = np.zeros((rows, 1, 1))
    m[:max(0, neck - feather)] = 1.0
    for k in range(2 * feather):
        r = neck - feather + k
        if 0 <= r < rows:
            m[r] = 1.0 - (k + 1) / (2 * feather + 1)
    out = (v * m + h * (1 - m)).astype(np.uint8)
    return Image.fromarray(out, 'RGBA'), (s, dx, dy, err)


def cut_row(sid, hero):
    """Where the head ends: the neck, but never above the chin.

    `neck_row` finds the pinch in the silhouette, and a mane or long hair
    hides it: on the Bulrathi it came out at row 30 and on the Mrrshan_f at
    43 — above the eyes — so the graft kept the hero's face. The speaking
    plate (head-only, hand-fixed by the owner) says exactly where the mouth
    is; the cut goes a few rows below the bottom of the mouth if that is
    lower than the neck.
    """
    neck = cp.neck_row(hero)
    sp = os.path.join(ANCH, sid + '_speaking.png')
    if os.path.exists(sp):
        a = np.asarray(hero).astype(int)
        b = np.asarray(Image.open(sp).convert('RGBA')).astype(int)
        if a.shape == b.shape:
            ys = np.nonzero(np.abs(a - b).sum(2) > 30)[0]
            if len(ys):
                neck = max(neck, int(ys.max()) + 10)
    return neck


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--preview', action='store_true')
    ap.add_argument('--only')
    args = ap.parse_args()
    sids = sorted(f[:-len('_desk_hero.png')] for f in os.listdir(ANCH) if f.endswith('_desk_hero.png'))
    if args.only:
        sids = [s for s in sids if s in set(args.only.split(','))]
    rows = []
    for sid in sids:
        hero = Image.open(os.path.join(ANCH, sid + '_desk_hero.png')).convert('RGBA')
        neck = cut_row(sid, hero)
        for st in STATES:
            p = os.path.join(ANCH, '%s_%s.png' % (sid, st))
            # Always graft from the original, never from a previous fix.
            bk = os.path.join(BACKUP, os.path.basename(p))
            src = bk if os.path.exists(bk) else p
            if not os.path.exists(p):
                continue
            var = Image.open(src).convert('RGBA')
            if var.size != hero.size:
                print('%-10s %-15s size differs, skipped' % (sid, st))
                continue
            fixed, (s, dx, dy, err) = graft(hero, var, neck)
            fixed = cp.quantise(fixed)
            print('%-10s %-15s neck %3d  scale %.2f  shift %+3d,%+3d  head mismatch %.1f%%'
                  % (sid, st, neck, s, dx, dy, err * 100))
            rows.append((sid, st, hero, var, fixed))
            if not args.preview:
                os.makedirs(BACKUP, exist_ok=True)
                bk = os.path.join(BACKUP, os.path.basename(p))
                if not os.path.exists(bk):
                    shutil.copy2(p, bk)
                fixed.save(p)
    T = 200
    sheet = Image.new('RGB', (3 * (T + 4) + 4, len(rows) * (T + 16) + 4), (20, 20, 24))
    d = ImageDraw.Draw(sheet)
    for i, (sid, st, hero, var, fixed) in enumerate(rows):
        for j, im in enumerate((hero, var, fixed)):
            b = Image.alpha_composite(Image.new('RGBA', im.size, (60, 60, 70, 255)), im).convert('RGB')
            sheet.paste(b.resize((T, T), Image.NEAREST), (4 + j * (T + 4), 4 + i * (T + 16) + 14))
        d.text((4, 4 + i * (T + 16)), '%s %s   hero / before / after' % (sid, st), fill=(255, 220, 120))
    out = os.path.join(ROOT, 'docs', 'listening_fix.png') if not args.preview else '/tmp/listening_fix_preview.png'
    if args.preview:
        out = os.environ.get('PREVIEW_OUT', out)
    sheet.save(out)
    print('sheet ->', out)


if __name__ == '__main__':
    main()
