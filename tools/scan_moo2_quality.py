#!/usr/bin/env python3
"""scan_moo2_quality.py — find MoO2 archives rendering with the wrong palette.

Reads assets/gfx-manifest.json (the merged manifest). For every MoO2 archive
it counts the items whose current extraction is a solid fill — few distinct
colours over substantial opaque coverage. That is what a wrong-palette MoO2
graphic looks like after extraction: palette indices collapse to two or three
colours and the sprite becomes a green or black blob.

By default every non-blank item is scanned. Pass --pooled-only to restrict to
items already admitted to a pool.

Add --suggest to render flagged items at every external FONTS palette and
report which one collapses fewest items. That mode reads the LBX files.

Usage:
    python3 tools/merge_moo2_manifests.py   # refresh the merged manifest first
    python3 tools/scan_moo2_quality.py
    python3 tools/scan_moo2_quality.py --threshold 20
    python3 tools/scan_moo2_quality.py --suggest
    python3 tools/scan_moo2_quality.py --archive CMBTSFX,CMBTMISL --all
"""
import argparse
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, 'assets', 'gfx-manifest.json')
PALETTE_MAP = os.path.join(ROOT, 'tools', 'palette_map.json')
MOO2_DIR = os.path.join(ROOT, 'Master of Orion 1', 'mastori2')

SOLID_COLORS = 5
SOLID_COVERAGE = 0.30
SOLID_NOISE = 250


def load_palette_map():
    try:
        with open(PALETTE_MAP, encoding='utf-8') as fh:
            raw = json.load(fh)
    except (OSError, ValueError):
        return {}
    out = {}
    for key, val in raw.items():
        if key.startswith('_'):
            continue
        # Accept the "IFONTS:3" form as well as plain integers, and keep it
        # as written — dropping it silently would make an IFONTS archive
        # look unmapped in this report.
        if isinstance(val, int) and not isinstance(val, bool):
            out[key.upper()] = val
        elif isinstance(val, str) and val.strip():
            text = val.strip().upper()
            out[key.upper()] = int(text) if text.isdigit() else text
    return out


def load_manifest():
    with open(MANIFEST, encoding='utf-8') as fh:
        return json.load(fh)


def classify_broken(entry):
    if entry.get('role') == 'blank':
        return None
    colors = entry.get('colors') or 0
    coverage = entry.get('coverage') or 0
    noise = entry.get('noise') or 0
    if coverage >= SOLID_COVERAGE and colors <= SOLID_COLORS:
        return 'solid'
    if coverage >= SOLID_COVERAGE and noise > SOLID_NOISE:
        return 'scramble'
    return None

def scan(manifest, palettes, only_pooled=False, archive_filter=None):
    """Yield one row per MoO2 archive, deduping suffixed/non-suffixed keys."""
    seen = {}  # archive_name -> (items, source_key)
    for key in sorted(manifest.keys()):
        if key.startswith('_'):
            continue
        items = manifest[key]
        if not items or not isinstance(items, list):
            continue
        if items[0].get('source') != 'moo2':
            continue
        archive = key[:-len('_moo2')] if key.endswith('_moo2') else key
        # Prefer the suffixed key if both exist — it's the current one.
        if archive in seen and key.endswith('_moo2'):
            seen[archive] = (items, key)
        elif archive not in seen:
            seen[archive] = (items, key)

    for archive, (items, source_key) in sorted(seen.items()):
        if archive_filter and archive.upper() not in archive_filter:
            continue
        total = 0
        broken = []
        for e in items:
            if e.get('role') == 'blank':
                continue
            if only_pooled and not e.get('pools'):
                continue
            total += 1
            reason = classify_broken(e)
            if reason:
                broken.append((e, reason))
        yield {
            'archive': archive,
            'palette': palettes.get(archive),
            'total': total,
            'broken': len(broken),
            'pct': (100.0 * len(broken) / total) if total else 0.0,
            'items': broken,
            'key': source_key,
        }

def load_unique_palettes(fonts_path):
    sys.path.insert(0, os.path.join(ROOT, 'tools'))
    from lbx import get_moo2_palette, LbxError
    unique = {}
    i = 1
    while i <= 20:
        try:
            pal = get_moo2_palette(fonts_path, i)
        except (LbxError, IndexError, OSError):
            break
        key = tuple(sorted(pal.items()))
        if key not in unique:
            unique[key] = (i, pal)
        i += 1
    return list(unique.values())


def score_items(archive, flagged_items, palette, max_items=8):
    sys.path.insert(0, os.path.join(ROOT, 'tools'))
    from lbx import LbxArchive, GfxItem, LbxError
    from PIL import Image

    lbx_path = os.path.join(MOO2_DIR, archive.upper() + '.LBX')
    if not os.path.isfile(lbx_path):
        return 0, 0
    try:
        arc = LbxArchive(lbx_path)
    except LbxError:
        return 0, 0

    test_indices = [e['item'] for e, _ in flagged_items[:max_items]]
    good = tested = 0
    for item_index in test_indices:
        if not 0 <= item_index < len(arc):
            continue
        try:
            item = GfxItem(arc.item(item_index), format='moo2')
        except Exception:
            continue
        if not item.plausible():
            continue
        if item.internal_palette() is not None:
            continue
        tested += 1
        try:
            rgba, _ = item.render_rgba(0, item.palette(palette))
        except Exception:
            tested -= 1
            continue
        img = Image.frombytes('RGBA', (item.w, item.h), rgba)
        seen = set()
        opaque = 0
        px = img.load()
        for y in range(item.h):
            for x in range(item.w):
                r, g, b, a = px[x, y]
                if a:
                    opaque += 1
                    if len(seen) < 32:
                        seen.add((r, g, b))
        if not opaque:
            tested -= 1
            continue
        cov = opaque / (item.w * item.h)
        if not (len(seen) <= SOLID_COLORS and cov >= SOLID_COVERAGE):
            good += 1
    return good, tested


def main():
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--threshold', type=float, default=40.0,
                    help='flag archives where >= this %% of items are '
                         'solid-filled (default: 40)')
    ap.add_argument('--all', action='store_true',
                    help='include items not admitted to any pool (default off)')
    ap.add_argument('--pooled-only', action='store_true',
                    help='only scan pool-admitted items (the old narrow mode)')
    ap.add_argument('--archive', default=None,
                    help='comma-separated archive basenames to limit to')
    ap.add_argument('--suggest', action='store_true',
                    help='render flagged archives at every external palette '
                         'and report which produces the fewest solid fills')
    ap.add_argument('--quiet', action='store_true',
                    help='only print the flagged-archive summary')
    args = ap.parse_args()

    palettes = load_palette_map()
    manifest = load_manifest()
    archive_filter = ({a.strip().upper() for a in args.archive.split(',')}
                      if args.archive else None)

    only_pooled = args.pooled_only
    results = list(scan(manifest, palettes, only_pooled=only_pooled,
                        archive_filter=archive_filter))
    results.sort(key=lambda r: (-r['pct'], r['archive']))

    if not results:
        print('No MoO2 archives found in the merged manifest.')
        print('Run: python3 tools/merge_moo2_manifests.py')
        return 1

    if not args.quiet:
        print(f'{"archive":<16} {"pal":<5} {"broken":<8} {"total":<6} {"pct":<6}')
        print('-' * 48)
        for r in results:
            pal = (r['palette'] if isinstance(r['palette'], str) else f'F{r["palette"]}') if r['palette'] else '—'
            flag = '  <<<' if r['pct'] >= args.threshold and r['total'] else ''
            print(f'{r["archive"]:<16} {pal:<5} {r["broken"]:<8} '
                  f'{r["total"]:<6} {r["pct"]:>4.0f}%{flag}')

    flagged = [r for r in results
               if r['total'] > 0 and r['pct'] >= args.threshold]

    print(f'\n{len(results)} MoO2 archives scanned. '
          f'{len(flagged)} above {args.threshold:.0f}%.')

    for r in flagged:
        pal = (r['palette'] if isinstance(r['palette'], str) else f'F{r["palette"]}') if r['palette'] else '—'
        print(f'\n  {r["archive"]}  (currently {pal}): '
              f'{r["broken"]}/{r["total"]} items solid-filled')
        for entry, reason in sorted(r['items'],
                                    key=lambda e: (e[0].get('colors') or 0))[:5]:
            print(f'    item {entry["item"]:>3}  {reason:<8}  '
                  f'colors={entry["colors"]}  '
                  f'coverage={entry["coverage"]}  '
                  f'noise={entry["noise"]}')

    if args.suggest and flagged:
        fonts_path = os.path.join(MOO2_DIR, 'FONTS.LBX')
        if not os.path.isfile(fonts_path):
            print(f'\nFONTS.LBX not found at {fonts_path}', file=sys.stderr)
            return 1
        unique_palettes = load_unique_palettes(fonts_path)
        print(f'\nRendering flagged items at each of {len(unique_palettes)} '
              'unique external palette(s)...')
        for r in flagged:
            print(f'\n{r["archive"]}:')
            scores = []
            for index, palette in unique_palettes:
                good, tested = score_items(r['archive'], r['items'], palette)
                if tested:
                    scores.append((index, good, tested))
            if not scores:
                print('  no testable items (all have embedded palettes?)')
                continue
            scores.sort(key=lambda s: (-s[1], s[0]))
            best_good = scores[0][1]
            for index, good, tested in scores:
                tags = []
                if index == r['palette']:
                    tags.append('current')
                if good == best_good and index != scores[0][0]:
                    tags.append('tied with best')
                tag = ('  (' + ', '.join(tags) + ')') if tags else ''
                print(f'  F{index:<3} -> {good}/{tested} not solid{tag}')

    return 0


if __name__ == '__main__':
    sys.exit(main())
