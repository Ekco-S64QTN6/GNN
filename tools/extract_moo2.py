#!/usr/bin/env python3
"""Extract MoO2 LBX graphics, respecting external and embedded palettes.

Examples:
    python3 tools/extract_moo2.py
    python3 tools/extract_moo2.py --only SHIPS,MONSTER
    python3 tools/extract_moo2.py --palette-item 3 --only CMBTSHP

Palette indices are actual zero-based item indices in the selected palette
archive (FONTS.LBX by default). Item 0 is font data, not a palette; external
palette items start at item 1. Sparse internal palettes are merged over an
external palette. Tiny palette-holder graphics update the running palette
for later items and are not emitted as pixel art.

palette_map.json supports four layers of configuration, all applied per item
in this priority order:

  1. _item_split         An item range uses a different external palette
                         from the archive-level default. Used by GAME
                         (in-game menu vs. main menu) and TECHSEL (two
                         halves of the research screen).

  2. _item_palettes      A specific item picks its own external palette.
                         Used by SHIPS 42 (palette 12) and MONSTER 7
                         (palette 4).

  3. (archive level)     The archive-wide base palette from the top-level
                         key, or _default.

  4. _palette_overrides  A range of items draws its embedded palette from
                         a named sibling item in the same archive. Used by
                         COUNCIL (item 0 patches the rest of the archive),
                         MONSTER (per-image override chain), RACESEL, and
                         TECHSEL.

  5. _item_overrides     One item's embedded palette is merged over the
                         base for one other item.

  6. Embedded palette    If the item itself carries flag 0x1000 with a
                         valid internal palette, that patch is applied
                         last and takes precedence over everything else.

The community-documented values in palette_map.json come from Nick Bowler's
liblbx moo2-data.txt and Wolverine's 2007-2008 Orion Nebula research. See
tools/PROJECT.md for the full source attribution.
"""

import argparse
import json
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lbx import LbxArchive, GfxItem, get_moo2_palette, LbxError  # noqa: E402

MOO2_DIR = 'Master of Orion 1/mastori2'
OUT_ROOT = 'assets/cutscenes/moo2'
PALETTE_MAP = 'tools/palette_map.json'


def is_palette_holder(item):
    """True only for a tiny one-frame image with a valid internal palette."""
    return (
        item.w <= 2 and item.h <= 2 and item.nframes == 1
        and item.internal_palette() is not None
    )


def _parse_range_key(key):
    """'7' -> (7, 7); '0-6' -> (0, 6). Raises on anything else."""
    s = str(key).strip()
    if '-' in s:
        lo, hi = s.split('-', 1)
        lo, hi = int(lo.strip()), int(hi.strip())
        if lo > hi:
            lo, hi = hi, lo
        return lo, hi
    n = int(s)
    return n, n


def _load_item_map(raw, key):
    """Parse a nested archive -> item-index -> integer map from JSON.

    Used for _item_palettes and _item_overrides, both of which are simple
    item_index -> value maps. The only difference is the minimum value:
    palette selections reference external palette archive items (>=1, since
    item 0 is font data), while overrides reference sibling items in the
    graphic archive and can be 0.
    """
    result = {}
    nested = raw.get(key, {})
    if not isinstance(nested, dict):
        return result
    for archive_name, item_values in nested.items():
        if str(archive_name).startswith('_'):
            continue
        if not isinstance(item_values, dict):
            continue
        parsed = {}
        for item_id, value in item_values.items():
            if str(item_id).startswith('_'):
                continue
            try:
                item_no = int(item_id)
                value_no = int(value)
            except (TypeError, ValueError):
                continue
            minimum_value = 0 if key == '_item_overrides' else 1
            if item_no >= 0 and value_no >= minimum_value:
                parsed[item_no] = value_no
        result[archive_name.upper()] = parsed
    return result


def _load_range_map(raw, key):
    """Parse an archive -> [(lo, hi, value)] range map from JSON.

    Used for _item_split and _palette_overrides, both of which are
    item-range maps. The JSON stores keys as either '7' (single item) or
    '0-6' (inclusive range); this returns one list of tuples per archive,
    sorted by nothing in particular. _lookup_range walks the list and
    returns the first tuple whose range contains the item index.
    """
    result = {}
    nested = raw.get(key, {})
    if not isinstance(nested, dict):
        return result
    for archive_name, ranges in nested.items():
        if str(archive_name).startswith('_'):
            continue
        if not isinstance(ranges, dict):
            continue
        parsed = []
        for range_key, value in ranges.items():
            if str(range_key).startswith('_'):
                continue
            try:
                lo, hi = _parse_range_key(range_key)
                value_no = int(value)
            except (TypeError, ValueError):
                continue
            parsed.append((lo, hi, value_no))
        if parsed:
            result[archive_name.upper()] = parsed
    return result


def _lookup_range(ranges, item_no):
    """The value whose range contains item_no, or None."""
    for lo, hi, value in ranges:
        if lo <= item_no <= hi:
            return value
    return None


def apply_forced_palette(palette_item, palette_map, default_item,
                         item_palettes, item_overrides,
                         item_splits, palette_overrides):
    """Apply --palette-item semantics: ignore every map-based override."""
    if palette_item is None:
        return (palette_map, default_item, item_palettes, item_overrides,
                item_splits, palette_overrides)
    return {}, int(palette_item), {}, {}, {}, {}


def load_palette_map(path):
    """Return the full palette configuration from JSON.

    Returns a 6-tuple:
        (archive_map, default_item, item_palettes, item_overrides,
         item_splits, palette_overrides)
    """
    empty = ({}, 1, {}, {}, {}, {})
    if not os.path.isfile(path):
        return empty
    try:
        with open(path, encoding='utf-8') as fh:
            raw = json.load(fh)
    except (OSError, ValueError) as err:
        print('warning: could not read palette map %s (%s); using defaults'
              % (path, err), file=sys.stderr)
        return empty

    try:
        default = int(raw.get('_default', 1))
    except (TypeError, ValueError):
        default = 1
    if default < 1:
        print('warning: palette-map _default must be >= 1; using item 1',
              file=sys.stderr)
        default = 1

    mapping = {}
    for key, value in raw.items():
        if key.startswith('_'):
            continue
        try:
            index = int(value)
        except (TypeError, ValueError):
            continue
        if index >= 1:
            mapping[key.upper()] = index
        else:
            print('warning: ignoring invalid palette index for %s: %r'
                  % (key, value), file=sys.stderr)

    return (
        mapping,
        default,
        _load_item_map(raw, '_item_palettes'),
        _load_item_map(raw, '_item_overrides'),
        _load_range_map(raw, '_item_split'),
        _load_range_map(raw, '_palette_overrides'),
    )


def _guess_role(item):
    """Loose size-based first pass; roles can be edited in the manifest."""
    if item.w >= 320 and item.h >= 200:
        return 'fullscreen'
    if item.w >= 128 and item.h >= 96:
        return 'panel'
    if item.w <= 40 and item.h <= 40:
        return 'sprite'
    return 'panel'


def extract_archive(lbx_path, out_dir, base_palette, base_palette_index,
                    palette_for, item_palette_map=None, item_override_map=None,
                    item_split_ranges=None, palette_override_ranges=None,
                    palette_source='FONTS'):
    """Extract one archive with all six palette rules applied.

    See the module docstring for the priority order. The two per-archive
    maps (`item_palette_map`, `item_override_map`) are passed in
    pre-filtered for this archive; the two range maps are passed in as
    lists of tuples, also pre-filtered.
    """
    archive = LbxArchive(lbx_path)
    name = os.path.splitext(os.path.basename(lbx_path))[0].upper()
    os.makedirs(out_dir, exist_ok=True)

    item_palette_map = item_palette_map or {}
    item_override_map = item_override_map or {}
    item_split_ranges = item_split_ranges or []
    palette_override_ranges = palette_override_ranges or []

    active_palette = dict(base_palette)
    manifest_entries = []
    palette_holders = []
    decode_warnings = []
    extracted = skipped = unclean_frames = 0

    # Cache for embedded palettes of sibling items referenced by the
    # override chains. A long override sequence (MONSTER, TECHSEL) reads
    # the same few sibling items over and over; caching them keeps the
    # inner loop cheap.
    embedded_cache = {}

    def embedded_for(idx):
        if idx in embedded_cache:
            return embedded_cache[idx]
        try:
            sibling = GfxItem(archive.item(idx), format='moo2')
            embedded_cache[idx] = sibling.internal_palette()
        except Exception:
            embedded_cache[idx] = None
        return embedded_cache[idx]

    for i in range(len(archive)):
        try:
            item = GfxItem(archive.item(i), format='moo2')
        except Exception as err:
            print('  item %d: open failed (%s)' % (i, err))
            skipped += 1
            continue

        if not item.plausible():
            skipped += 1
            continue

        embedded = item.internal_palette()
        if is_palette_holder(item):
            # A tiny item with a valid internal palette is a sequential
            # palette holder. Merge its palette over the running archive
            # palette so later items see the new colours, and do not emit
            # the item as pixel art.
            active_palette = item.palette(active_palette)
            first_index, colors = embedded
            palette_holders.append({
                'item': i,
                'first_color': first_index,
                'color_count': len(colors),
            })
            skipped += 1
            continue

        # Rule 1 and 2: pick the base palette for this item. An item-range
        # split (GAME, TECHSEL) overrides a single-item override, which in
        # turn overrides the archive-level value.
        split_index = _lookup_range(item_split_ranges, i)
        if split_index is not None:
            chosen_index = split_index
        else:
            chosen_index = item_palette_map.get(i)

        if chosen_index is None:
            effective_base = dict(active_palette)
            palette_index_used = base_palette_index
        else:
            try:
                effective_base = dict(palette_for(chosen_index))
                palette_index_used = chosen_index
            except (LbxError, IndexError, OSError) as err:
                print('  item %d: palette item %d unavailable (%s); '
                      'using active palette' % (i, chosen_index, err),
                      file=sys.stderr)
                effective_base = dict(active_palette)
                palette_index_used = base_palette_index

        # Rule 4: whole-archive override chain. If this item's index falls
        # in a range from _palette_overrides, merge the named sibling
        # item's embedded palette on top of the base. COUNCIL, MONSTER,
        # RACESEL and TECHSEL all use this.
        chain_item = _lookup_range(palette_override_ranges, i)
        if chain_item is not None and chain_item != i:
            chain_pal = embedded_for(chain_item)
            if chain_pal is not None:
                effective_base.update(chain_pal[1])

        # Rule 5: single-item override. Same mechanism as rule 4 but keyed
        # by one item index rather than a range.
        override_item_index = item_override_map.get(i)
        if override_item_index is not None:
            if not (0 <= override_item_index < len(archive)):
                print('  item %d: override item %d is out of range; ignored'
                      % (i, override_item_index), file=sys.stderr)
                override_item_index = None
            else:
                try:
                    override_item = GfxItem(archive.item(override_item_index),
                                            format='moo2')
                    override_palette = override_item.internal_palette()
                    if override_palette is None:
                        print('  item %d: override item %d has no valid '
                              'internal palette; ignored'
                              % (i, override_item_index), file=sys.stderr)
                        override_item_index = None
                    else:
                        effective_base = override_item.palette(effective_base)
                except Exception as err:
                    print('  item %d: could not read override item %d (%s); '
                          'ignored' % (i, override_item_index, err),
                          file=sys.stderr)
                    override_item_index = None

        # Rule 6: the item's own embedded palette, applied last so it takes
        # precedence over every external choice above.
        effective_palette = item.palette(effective_base)
        frame_paths = []
        frame_clean = []
        for frame_index in range(item.nframes):
            rgba, clean = item.render_rgba(frame_index, effective_palette)
            if not clean:
                unclean_frames += 1
                if unclean_frames <= 5:
                    issue_kinds = ','.join(
                        issue.get('kind', 'unknown')
                        for issue in item.decode_warnings.get(frame_index, [])
                    ) or 'unspecified'
                    print('  unclean: item %d frame %d (%s)' %
                          (i, frame_index, issue_kinds), file=sys.stderr)
                frame_start = item.frame_offsets[frame_index]
                frame_end = item.frame_offsets[frame_index + 1]
                decode_warnings.append({
                    'item': i,
                    'frame': frame_index,
                    'width': item.w,
                    'height': item.h,
                    'item_offset': archive.offsets[i],
                    'frame_offset': archive.offsets[i] + frame_start,
                    'frame_end_offset': archive.offsets[i] + frame_end,
                    'frame_bytes': frame_end - frame_start,
                    'issues': item.decode_warnings.get(frame_index, []),
                })
            fname = 'item_%02d_frame_%03d.png' % (i, frame_index)
            fpath = os.path.join(out_dir, fname)
            Image.frombytes('RGBA', (item.w, item.h), rgba).save(fpath)
            frame_paths.append(fname)
            frame_clean.append(bool(clean))

        if not frame_paths:
            skipped += 1
            continue

        manifest_entries.append({
            'id': 'moo2/%s/item_%02d' % (name, i),
            'source': 'moo2',
            'dir': name,
            'item': i,
            'w': item.w,
            'h': item.h,
            'frames': item.nframes,
            'hero': 0,
            'role': _guess_role(item),
            'pools': [],
            'palette_index': palette_index_used,
            'palette_source': palette_source,
            'palette_override_item': override_item_index,
            'palette_chain_item': chain_item,
            'has_internal_palette': embedded is not None,
            'frame_files': frame_paths,
            'frame_clean': frame_clean,
        })
        extracted += 1

    manifest_path = os.path.join(out_dir, 'manifest.json')
    with open(manifest_path, 'w', encoding='utf-8') as fh:
        json.dump({
            'archive': name,
            'source': 'moo2',
            'palette_index': base_palette_index,
            'palette_source': palette_source,
            'palette_holders': palette_holders,
            'items': manifest_entries,
        }, fh, indent=2)
        fh.write('\n')

    warning_path = os.path.join(out_dir, 'decode_warnings.json')
    with open(warning_path, 'w', encoding='utf-8') as fh:
        json.dump({
            'archive': name,
            'warning_frame_count': unclean_frames,
            'frames': decode_warnings,
        }, fh, indent=2)
        fh.write('\n')

    if unclean_frames:
        print('  warning: %d frame(s) decoded with structural/format '
              'warnings; details: %s' % (unclean_frames, warning_path),
              file=sys.stderr)
    return extracted, skipped


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--moo2-dir', default=MOO2_DIR,
                    help='directory containing MoO2 LBX archives')
    ap.add_argument('--out', default=OUT_ROOT, help='output root directory')
    ap.add_argument('--palette-item', type=int, default=None,
                    help='force one palette item for all archives (>=1)')
    ap.add_argument('--palette-archive', choices=('FONTS', 'IFONTS'),
                    default='FONTS',
                    help='external palette archive to use (default: FONTS)')
    ap.add_argument('--palette-map', default=PALETTE_MAP,
                    help='JSON file with archive/item palette assignments')
    ap.add_argument('--only', default=None,
                    help='comma-separated archive basenames to extract')
    args = ap.parse_args()

    fonts_path = os.path.join(args.moo2_dir, args.palette_archive + '.LBX')
    if not os.path.isfile(fonts_path):
        print('%s.LBX not found at %s'
              % (args.palette_archive, fonts_path), file=sys.stderr)
        return 1
    if args.palette_item is not None and args.palette_item < 1:
        print('--palette-item must be >= 1; palette item 0 is font data',
              file=sys.stderr)
        return 2

    (palette_map, default_item, item_palettes, item_overrides,
     item_splits, palette_overrides) = load_palette_map(args.palette_map)

    (palette_map, default_item, item_palettes, item_overrides,
     item_splits, palette_overrides) = apply_forced_palette(
        args.palette_item, palette_map, default_item, item_palettes,
        item_overrides, item_splits, palette_overrides)

    palette_cache = {}

    def palette_for(index):
        index = int(index)
        if index < 1:
            raise LbxError('palette item index must be >= 1 '
                           '(item 0 is font data)')
        if index not in palette_cache:
            palette_cache[index] = get_moo2_palette(fonts_path, index)
        return palette_cache[index]

    try:
        # Eager validation so a bad entry in the map is caught before a
        # long run rather than silently falling back to the active palette
        # for one item and hiding the misconfiguration.
        palette_for(default_item)
        for index in palette_map.values():
            palette_for(index)
        for ranges in item_splits.values():
            for _lo, _hi, idx in ranges:
                palette_for(idx)
    except (LbxError, IndexError, OSError) as err:
        print('invalid palette configuration: %s' % err, file=sys.stderr)
        return 2

    print('palette source: %s.LBX' % args.palette_archive)
    print('palette map: %d explicit archive entries, default item %d; '
          '%d per-item palettes, %d per-item overrides, '
          '%d item splits, %d override chains'
          % (len(palette_map), default_item,
             sum(len(v) for v in item_palettes.values()),
             sum(len(v) for v in item_overrides.values()),
             sum(len(v) for v in item_splits.values()),
             sum(len(v) for v in palette_overrides.values())))

    only = {a.strip().upper() for a in args.only.split(',') if a.strip()} \
        if args.only else None
    total_extracted = total_skipped = 0
    for filename in sorted(os.listdir(args.moo2_dir)):
        if not filename.lower().endswith('.lbx'):
            continue
        key = os.path.splitext(filename)[0].upper()
        if only is not None and key not in only:
            continue
        palette_index = palette_map.get(key, default_item)
        try:
            palette = palette_for(palette_index)
            extracted, skipped = extract_archive(
                os.path.join(args.moo2_dir, filename),
                os.path.join(args.out, key),
                palette,
                palette_index,
                palette_for,
                item_palettes.get(key, {}),
                item_overrides.get(key, {}),
                item_splits.get(key, []),
                palette_overrides.get(key, []),
                args.palette_archive,
            )
        except (LbxError, IndexError, OSError) as err:
            print('%-20s skip (%s)' % (filename, err), file=sys.stderr)
            continue
        print('%-20s palette %2d  extracted %4d items, skipped %d'
              % (filename, palette_index, extracted, skipped))
        total_extracted += extracted
        total_skipped += skipped

    print('\n%d items extracted, %d skipped'
          % (total_extracted, total_skipped))
    return 0


if __name__ == '__main__':
    sys.exit(main())