#!/usr/bin/env python3
"""Render one MoO2 graphic using valid FONTS palettes for visual comparison.

Examples:
    python3 tools/palette_compare.py SHIPS --item 42
    python3 tools/palette_compare.py SHIPS --item 42 --override-item 49
    python3 tools/palette_compare.py MONSTER --item 7 --override-item 14
    python3 tools/palette_compare.py CMBTSHP --item 100 --palette-items 3,4,5,12

FONTS.LBX item 0 is font data, not an external palette. By default this
compares up to 13 available palette items starting at item 1. `--override-item`
uses another item in the same archive as a palette patch for the selected
image; it does not change the archive's normal item order or state.
"""

import argparse
import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lbx import LbxArchive, GfxItem, get_moo2_palette, LbxError  # noqa: E402

MOO2_DIR = 'Master of Orion 1/mastori2'
OUT_DIR = 'tools/palette_compare'
CELL = 200
COLS = 4


def find_lbx(directory, archive_name):
    candidate = os.path.join(directory, archive_name.upper() + '.LBX')
    if os.path.isfile(candidate):
        return candidate
    candidate = os.path.join(directory, archive_name + '.lbx')
    return candidate if os.path.isfile(candidate) else None


def parse_palette_items(value, fonts_count, count, first):
    if value:
        indexes = []
        for part in value.split(','):
            try:
                index = int(part.strip())
            except ValueError as err:
                raise argparse.ArgumentTypeError('palette indices must be integers') from err
            if index < 1 or index >= fonts_count:
                raise argparse.ArgumentTypeError(
                    'palette item %d out of range; valid external palette items are 1..%d'
                    % (index, fonts_count - 1))
            indexes.append(index)
        return list(dict.fromkeys(indexes))
    return list(range(first, min(fonts_count, first + count)))


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('archive', help='graphics archive basename, e.g. SHIPS')
    ap.add_argument('--moo2-dir', default=MOO2_DIR,
                    help='directory containing the MoO2 LBX files')
    ap.add_argument('--item', type=int, default=0, help='graphic item index')
    ap.add_argument('--frame', type=int, default=0, help='frame index')
    ap.add_argument('--palettes', type=int, default=13,
                    help='number of external palettes to compare (default: 13)')
    ap.add_argument('--first-palette', type=int, default=1,
                    help='first external FONTS item (must be >=1; default: 1)')
    ap.add_argument('--palette-items', default=None,
                    help='explicit comma-separated FONTS item indices, e.g. 4,12')
    ap.add_argument('--override-item', type=int, default=None,
                    help='item in this archive whose internal palette patches the selected image')
    ap.add_argument('--override-archive', default=None,
                    help='archive containing --override-item (defaults to selected archive)')
    ap.add_argument('--out', default=OUT_DIR, help='output directory')
    args = ap.parse_args()

    if args.first_palette < 1:
        ap.error('--first-palette must be >= 1; item 0 is font data')
    if args.palettes < 1:
        ap.error('--palettes must be >= 1')

    lbx_path = find_lbx(args.moo2_dir, args.archive)
    if not lbx_path:
        print('archive not found: %s' % args.archive, file=sys.stderr)
        return 1
    fonts_path = find_lbx(args.moo2_dir, 'FONTS')
    if not fonts_path:
        print('FONTS.LBX not found in %s' % args.moo2_dir, file=sys.stderr)
        return 1

    try:
        archive = LbxArchive(lbx_path)
        fonts_archive = LbxArchive(fonts_path)
    except (OSError, LbxError) as err:
        print('could not open archive: %s' % err, file=sys.stderr)
        return 1
    if not (0 <= args.item < len(archive)):
        print('item %d out of range (0..%d)' % (args.item, len(archive) - 1),
              file=sys.stderr)
        return 1

    item = GfxItem(archive.item(args.item), format='moo2')
    if not item.plausible():
        print('item %d does not look like a supported graphic' % args.item,
              file=sys.stderr)
        return 1
    if not (0 <= args.frame < item.nframes):
        print('frame %d out of range (0..%d)' % (args.frame, item.nframes - 1),
              file=sys.stderr)
        return 1

    override_item = None
    override_index = args.override_item
    if override_index is not None:
        override_archive_name = args.override_archive or args.archive
        override_path = find_lbx(args.moo2_dir, override_archive_name)
        if not override_path:
            print('override archive not found: %s' % override_archive_name,
                  file=sys.stderr)
            return 1
        try:
            override_archive = LbxArchive(override_path)
        except (OSError, LbxError) as err:
            print('could not open override archive: %s' % err, file=sys.stderr)
            return 1
        if not (0 <= override_index < len(override_archive)):
            print('override item %d out of range (0..%d)' %
                  (override_index, len(override_archive) - 1), file=sys.stderr)
            return 1
        override_item = GfxItem(override_archive.item(override_index), format='moo2')
        if override_item.internal_palette() is None:
            print('warning: override item %d has no valid internal palette; '
                  'results will use the external palettes only' % override_index,
                  file=sys.stderr)
            override_item = None

    try:
        palette_indexes = parse_palette_items(
            args.palette_items, len(fonts_archive), args.palettes, args.first_palette)
    except argparse.ArgumentTypeError as err:
        ap.error(str(err))
    if not palette_indexes:
        print('no external palette items available to compare', file=sys.stderr)
        return 1

    palettes = []
    for palette_index in palette_indexes:
        try:
            palette = get_moo2_palette(fonts_path, palette_index)
            if override_item is not None:
                palette = override_item.palette(palette)
            palette = item.palette(palette)
            palettes.append((palette_index, palette))
        except (LbxError, IndexError, OSError) as err:
            print('palette %d unavailable (%s)' % (palette_index, err),
                  file=sys.stderr)

    if not palettes:
        print('none of the selected palettes could be loaded', file=sys.stderr)
        return 1

    rows = (len(palettes) + COLS - 1) // COLS
    label_h = 28
    grid = Image.new('RGBA', (COLS * CELL, rows * (CELL + label_h)),
                     (13, 13, 20, 255))
    draw = ImageDraw.Draw(grid)
    for idx, (palette_index, palette) in enumerate(palettes):
        rgba, clean = item.render_rgba(args.frame, palette)
        img = Image.frombytes('RGBA', (item.w, item.h), rgba)
        scale = min(CELL / item.w, CELL / item.h, 4)
        new_w = max(1, int(item.w * scale))
        new_h = max(1, int(item.h * scale))
        img = img.resize((new_w, new_h), getattr(getattr(Image, 'Resampling', Image), 'NEAREST'))

        col, row = idx % COLS, idx // COLS
        cell_x = col * CELL + (CELL - new_w) // 2
        cell_y = row * (CELL + label_h) + label_h + (CELL - new_h) // 2
        grid.paste(img, (cell_x, cell_y), img)
        label = 'FONTS item %d%s' % (
            palette_index, '' if clean else ' (decode warning)')
        draw.text((col * CELL + 8, row * (CELL + label_h) + 5),
                  label, fill=(220, 220, 235, 255))

    os.makedirs(args.out, exist_ok=True)
    override_suffix = '_override_%03d' % override_index if override_item is not None else ''
    out_path = os.path.join(
        args.out,
        '%s_item_%03d_frame_%03d%s.png' %
        (args.archive.upper(), args.item, args.frame, override_suffix))
    grid.save(out_path)
    print('wrote %s (%d palette variants)' % (out_path, len(palettes)))
    print('tested FONTS item indices: %s' % ', '.join(map(str, [p for p, _ in palettes])))
    return 0


if __name__ == '__main__':
    sys.exit(main())
