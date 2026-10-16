#!/usr/bin/env python3
"""Survey every MoO2 archive across both external palette sources.

Renders one representative frame of each archive with every palette item
from FONTS.LBX and IFONTS.LBX, and writes a single HTML contact sheet.
Loads each palette file once and reuses it, so the whole survey runs in
seconds rather than minutes of shelling out per archive.

    python3 tools/palette_survey.py
    xdg-open tools/palette_survey/index.html
"""
import argparse
import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lbx import LbxArchive, GfxItem, get_moo2_palette, LbxError  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOO2_DIR = os.path.join(ROOT, 'Master of Orion 1', 'mastori2')
OUT_DIR = os.path.join(ROOT, 'tools', 'palette_survey')

THUMB = 96
LABEL_H = 16


def find_plausible_item(archive):
    """First item in the archive that decodes as a MoO2 graphic."""
    for i in range(min(len(archive), 8)):
        try:
            item = GfxItem(archive.item(i), format='moo2')
        except Exception:
            continue
        if item.plausible() and item.w > 4 and item.h > 4:
            return i, item
    return None, None


def build_grid(item, palettes, initial):
    """Render frame 0 of the item with each palette into a strip."""
    n = len(palettes)
    w, h = THUMB, THUMB + LABEL_H
    strip = Image.new('RGBA', (w * n, h), (13, 13, 20, 255))
    draw = ImageDraw.Draw(strip)
    for i, (pidx, palette) in enumerate(palettes):
        rgba, _clean = item.render_rgba(0, palette)
        img = Image.frombytes('RGBA', (item.w, item.h), rgba)
        scale = min(THUMB / item.w, THUMB / item.h, 4)
        nw = max(1, int(item.w * scale))
        nh = max(1, int(item.h * scale))
        img = img.resize((nw, nh), Image.NEAREST)
        x = i * w + (w - nw) // 2
        y = LABEL_H + (THUMB - nh) // 2
        strip.paste(img, (x, y), img)
        draw.text((i * w + 4, 3), '%s%d' % (initial, pidx),
                  fill=(200, 200, 220, 255))
    return strip


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--moo2-dir', default=MOO2_DIR)
    ap.add_argument('--out', default=OUT_DIR)
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)

    palettes_by_source = {}
    for src, initial in (('FONTS', 'F'), ('IFONTS', 'I')):
        path = os.path.join(args.moo2_dir, src + '.LBX')
        if not os.path.isfile(path):
            print('%-8s %s not found' % (src, path), file=sys.stderr)
            continue
        pl = []
        for i in range(1, 14):
            try:
                pl.append((i, get_moo2_palette(path, i)))
            except (LbxError, IndexError, OSError):
                break
        palettes_by_source[src] = (initial, pl)
        print('%-8s %d palette items loaded' % (src, len(pl)))

    rows = []
    names = sorted(n for n in os.listdir(args.moo2_dir)
                   if n.lower().endswith('.lbx'))
    for name in names:
        stem = name[:-4].upper()
        try:
            archive = LbxArchive(os.path.join(args.moo2_dir, name))
        except LbxError:
            continue
        idx, item = find_plausible_item(archive)
        if item is None:
            print('%-18s no plausible item' % stem)
            continue

        shots = []
        for src, (initial, palettes) in palettes_by_source.items():
            strip = build_grid(item, palettes, initial)
            fname = '%s_%s.png' % (stem, src)
            strip.save(os.path.join(args.out, fname))
            shots.append((src, fname))
        rows.append((stem, idx, item.w, item.h, shots))
        print('%-18s item %d (%dx%d)' % (stem, idx, item.w, item.h))

    parts = [
        '<!DOCTYPE html><html><head><meta charset="utf-8">',
        '<title>MoO2 palette survey</title><style>',
        'body{background:#08080c;color:#e0e0ec;font-family:ui-monospace,monospace;padding:14px;}',
        'h1{font-size:1rem;letter-spacing:.15em;color:#6fc3df;}',
        '.row{margin-bottom:22px;border-bottom:1px solid #1f1f2e;padding-bottom:14px;}',
        '.head{font-size:.78rem;color:#cfeaff;margin-bottom:6px;}',
        '.head b{color:#ffd166;font-weight:normal;}',
        'img{display:block;max-width:100%;image-rendering:pixelated;border:1px solid #2a2a3e;}',
        '.pal{font-size:.62rem;color:#8a8aa0;margin:6px 0 2px;}',
        '</style></head><body>',
        '<h1>MoO2 PALETTE SURVEY</h1>',
        '<p style="font-size:.72rem;color:#9a9ab0">One row per archive. '
        'Top grid renders with FONTS.LBX, bottom with IFONTS.LBX. Labels '
        'read <b>F<i>n</i></b> for FONTS item <i>n</i>, <b>I<i>n</i></b> '
        'for IFONTS item <i>n</i>.</p>'
    ]
    for stem, idx, w, h, shots in rows:
        parts.append('<div class="row">')
        parts.append('<div class="head">%s <b>item %d (%d&times;%d)</b></div>'
                     % (stem, idx, w, h))
        for src, fname in shots:
            parts.append('<div class="pal">%s</div>' % src)
            parts.append('<img src="%s">' % fname)
        parts.append('</div>')
    parts.append('</body></html>')

    index_path = os.path.join(args.out, 'index.html')
    with open(index_path, 'w') as fh:
        fh.write('\n'.join(parts))
    print('\n%d archive rows -> %s' % (len(rows), index_path))


if __name__ == '__main__':
    main()