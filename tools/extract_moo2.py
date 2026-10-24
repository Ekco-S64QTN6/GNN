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

Functional Color (0x0800). Items flagged with 0x0800 are not standard
color graphics. Their pixel indices represent an intensity mask (1-15)
rather than palette lookups. The standard extractor bypasses external
palettes for these items and applies a synthetic fire gradient to simulate
the game's additive blending.

Pool assignment. Every item is measured the same way MoO1 items are in
tools/extract_all.py: coverage, mean luminance, distinct colour count and
horizontal chroma noise are sampled on the item's hero frame, and a
long-flat-run score (`ui`) is computed to separate painted art from
interface chrome. The resulting metadata drives `classify()` (role) and
`pools_for()` (which admission pools this item may join). Before this,
`extract_moo2.py` wrote `'pools': []` for every MoO2 item, which is why
`scene-compositor.js` recipes (which query by pool) could never draw MoO2
graphics even after `merge_moo2_manifests.py` folded them into
`assets/gfx-manifest.json`.

The community-documented values in palette_map.json come from Nick Bowler's
liblbx moo2-data.txt and Wolverine's 2007-2008 Orion Nebula research. See
tools/PROJECT.md for the full source attribution.
"""

import argparse
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lbx import LbxArchive, GfxItem, get_moo2_palette, LbxError  # noqa: E402

MOO2_DIR = 'Master of Orion 1/mastori2'
OUT_ROOT = 'assets/cutscenes/moo2'
PALETTE_MAP = 'tools/palette_map.json'


def is_palette_holder(item):
    """True only for a tiny image with a valid internal palette."""
    return (
        item.w <= 2 and item.h <= 2
        and item.internal_palette() is not None
    )


# ----------------------------------------------------------------------
# Measurement and pool admission (ported from tools/extract_all.py)
# ----------------------------------------------------------------------
#
# Same metrics, same gates, same pool names as the MoO1 extractor. Keeping
# the two sides aligned is what makes a recipe that queries
# `{pool: 'broll'}` behave the same against either library — an MoO1
# landing backdrop and an MoO2 star background should be equally
# eligible for the same cutaway window.

def measure(img):
    """coverage, mean luminance, distinct colours, horizontal chroma noise."""
    px = img.load()
    w, h = img.size
    step = max(1, (w * h) // 4000)
    n = opaque = lum = 0
    seen = set()
    for p in range(0, w * h, step):
        r, g, b, a = px[p % w, p // w]
        n += 1
        if a:
            opaque += 1
            lum += (r * 299 + g * 587 + b * 114) // 1000
            if len(seen) < 64:
                seen.add((r, g, b))
    delta = pairs = 0
    for y in range(0, h, max(1, h // 40)):
        prev = None
        for x in range(0, w, max(1, w // 60)):
            r, g, b, a = px[x, y]
            if a and prev:
                delta += abs(r - prev[0]) + abs(g - prev[1]) + abs(b - prev[2])
                pairs += 1
            prev = (r, g, b) if a else None
    if not n:
        return 0.0, 0, 0, 0
    return (opaque / n, (lum // opaque if opaque else 0), len(seen),
            delta // max(pairs, 1))


def ui_score(img):
    """How much of the artwork is long flat horizontal runs.

    In-game UI holds a colour across a panel; painted art dithers. Runs of
    the backdrop colour and of transparency are ignored, otherwise a figure
    on a black field scores like a menu. Measured against knowns, chrome
    lands at 0.38-0.43 and art at or below 0.22, so 0.30 separates them.
    """
    a = np.asarray(img)
    h, w, _ = a.shape
    if w < 16 or h < 16:
        return 0.0
    rgb, alpha = a[..., :3], a[..., 3]
    visible = rgb.reshape(-1, 3)[alpha.reshape(-1) > 0]
    if not len(visible):
        return 0.0
    cols, counts = np.unique(visible, axis=0, return_counts=True)
    bg = cols[counts.argmax()]
    ok = (np.all(rgb[:, 1:] == rgb[:, :-1], axis=2)
          & (alpha[:, 1:] > 0) & (alpha[:, :-1] > 0)
          & ~np.all(rgb[:, 1:] == bg, axis=2))
    pad = np.zeros((ok.shape[0], 1), dtype=bool)
    v = np.concatenate([pad, ok, pad], axis=1).ravel().astype(np.int8)
    d = np.diff(v)
    lengths = np.flatnonzero(d == -1) - np.flatnonzero(d == 1)
    return round(float(lengths[lengths >= 20].sum())
                 / max(int((alpha > 0).sum()), 1), 3)


def classify(w, h, nframes, coverage, mean_lum, distinct, noise):
    """Role from the same thresholds extract_all.py uses for MoO1."""
    if coverage < 0.02 or distinct <= 2:
        return 'blank'
    # Authored against screen palettes the archives do not carry. Decodes
    # structurally, chromatically scrambled; deliberate interference
    # footage rather than discarded.
    if noise > 150 and coverage > 0.55 and distinct >= 48:
        return 'noise'
    if w >= 300 and h >= 180:
        return 'fullscreen'
    if w >= 120 and h >= 90:
        return 'panel'
    if h >= 120 and w < 120:
        return 'portrait'
    if w <= 16 or h <= 16:
        return 'chrome'
    if w / max(h, 1) > 6 or h / max(w, 1) > 6:
        return 'strip'
    if max(w, h) <= 64:
        return 'sprite'
    return 'panel'


UI_LIMIT = 0.30

# MoO2 archives that are interface rather than footage. Same shape as
# `UI_ARCHIVES` in extract_all.py: an item in one of these can still dress
# a diegetic screen, but nothing in it is a cutaway.
#
# `GAME` and `TECHSEL` sit here for the same reason `DESIGN` and `SCREENS`
# do on the MoO1 side: they contain menus, not pictures. `BUFFER0` is the
# galactic map chrome. `RACESEL`/`RACEOPT` are picker screens.
# `LOADSAVE`, `NEWGAME`, `MAINMENU`, `INSTALL`, `APP_PICS` and `CREDITS`
# are all the disk-menu family. `WARNING` is the modal dialog. `OFFICER`,
# `SYSDISP` and `FLTICONS` are dashboard widgets.
UI_ARCHIVES = {
    'LOADSAVE', 'NEWGAME', 'MAINMENU', 'INSTALL', 'APP_PICS', 'WARNING',
    'CREDITS', 'TECHSEL', 'GAME', 'BUFFER0', 'RACESEL', 'RACEOPT',
    'OFFICER', 'SYSDISP', 'FLTICONS', 'DESIGN', 'CONFIRM', 'NEXT_PLYR',
    # Colony-screen popups, refit and build menus. Their empty bordered
    # panels pass the broll gates (contact sheet, 2026-10-24).
    'COLPUPS', 'COLPUSP', 'COLREFIT', 'COLBLDG',
}

# The glitch pool wants a scrambled picture, not a small detailed object in
# an empty frame: a tech animation's gadget or a building on 640x480 of
# transparency scores the same chroma noise. Every such item on the contact
# sheet sat at coverage 0.02-0.054; the scrambled ones (RACESEL 27,
# DIPLOMAT 38) at 0.55 and up.
GLITCH_MIN_COVERAGE = 0.08

# An empty menu frame scores low on ui_score because almost all of it is the
# backdrop colour, which that measure deliberately ignores. What gives it
# away instead is palette poverty: real footage dithers across dozens of
# colours, an empty bordered panel uses a handful.
BROLL_MIN_COLORS = 24
CHROME_MIN_COLORS = 12

# Same pool names as extract_all.py, with the MoO2 sprite ceiling raised.
# MoO1 ship sprites top out around 160 px; MoO2 combat renders run a bit
# larger, and a 200 px ceiling keeps the biggest fighters in the sprite
# pool rather than pushing them into panels where the recipe queries miss
# them.
POOL_RULES = {
    # pool:      (min_w, min_h, max_w, max_h, min_cov, max_noise)
    'broll':     (120, 80, 9999, 9999, 0.15, 70),
    'portrait':  (100, 100, 9999, 9999, 0.15, 150),
    'sprite':    (16, 16, 200, 200, 0.05, 140),
}


def pools_for(w, h, coverage, noise, ui, role, colors=64, archive='', item=-1):
    """Which pools this item is allowed to join.

    Same structure as the MoO1 side: deliberate interference goes to
    `glitch` and nowhere else, UI-flagged items go to `chrome` only, and
    everything else is tested against the numeric pool rules. The one
    difference is that the MoO2 `DENY` list does not exist — MoO1's item
    indices do not correspond to MoO2's, and the MoO2 archives have been
    measured rather than eyeballed, so the admission gates are the whole
    of the filter.
    """
    def chrome_ok():
        return (w >= 24 and h >= 16 and role != 'blank'
                and colors >= CHROME_MIN_COLORS and coverage >= 0.2)

    out = []

    # Deliberate interference. Same admission as the MoO1 side, so
    # `GNNGlitch` can pick from either library without a branch.
    if (noise > 95 and w >= 200 and ui < UI_LIMIT and role != 'blank'
            and coverage >= GLITCH_MIN_COVERAGE):
        out.append('glitch')

    if ui >= UI_LIMIT or role == 'blank':
        if chrome_ok():
            out.append('chrome')
        return out

    for pool, (mw, mh, xw, xh, mc, mn) in POOL_RULES.items():
        if not (mw <= w <= xw and mh <= h <= xh
                and coverage >= mc and noise <= mn):
            continue
        if pool == 'broll' and (archive in UI_ARCHIVES
                                or colors < BROLL_MIN_COLORS):
            continue
        out.append(pool)

    if not out and chrome_ok():
        out.append('chrome')
    return out


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


PALETTE_SOURCES = ('FONTS', 'IFONTS')


def parse_palette_ref(value):
    """A palette reference: a plain index, or "IFONTS:3" / "FONTS:3".

    Plain integers keep their old meaning — an item of whichever palette
    archive `--palette-archive` names, FONTS by default — so every existing
    entry in `palette_map.json` resolves exactly as it did.

    The prefixed form exists because the owner reported items whose correct
    colours come from IFONTS while their siblings use FONTS. That could not
    be written down before: IFONTS was a single command-line switch for the
    whole run, so an archive that mixes the two could never come out right.

    Returns an int, a normalised "SOURCE:n" string, or None if unusable.
    """
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if value >= 1 else None
    text = str(value).strip().upper()
    if ':' in text:
        src, _, num = text.partition(':')
        if src not in PALETTE_SOURCES:
            return None
        try:
            n = int(num)
        except ValueError:
            return None
        return '%s:%d' % (src, n) if n >= 1 else None
    try:
        n = int(text)
    except ValueError:
        return None
    return n if n >= 1 else None


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
            except (TypeError, ValueError):
                continue
            if item_no < 0:
                continue
            if key == '_item_palettes':
                ref = parse_palette_ref(value)
                if ref is not None:
                    parsed[item_no] = ref
                continue
            try:
                value_no = int(value)
            except (TypeError, ValueError):
                continue
            if value_no >= 0:
                parsed[item_no] = value_no
        result[archive_name.upper()] = parsed
    return result


def _load_range_map(raw, key, palette_refs=False):
    """Parse an archive -> [(lo, hi, value)] range map from JSON.

    Used for _item_split and _palette_overrides, both of which are
    item-range maps. The JSON stores keys as either '7' (single item) or
    '0-6' (inclusive range); this returns one list of tuples per archive,
    sorted by nothing in particular. _lookup_range walks the list and
    returns the first tuple whose range contains the item index.

    `palette_refs` is set for _item_split, whose values are palettes and may
    be written "IFONTS:3" like anywhere else (parse_palette_ref). The values
    in _palette_overrides are sibling item numbers, so they stay integers.
    An entry that does not parse is reported: it used to be skipped
    silently, and eight IFONTS values once produced identical output.
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
                value_no = parse_palette_ref(value) if palette_refs else int(value)
                if value_no is None:
                    raise ValueError(value)
            except (TypeError, ValueError):
                print('  palette map: %s %s %r: unusable value %r, ignored'
                      % (key, archive_name, range_key, value), file=sys.stderr)
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
        index = parse_palette_ref(value)
        if index is not None:
            mapping[key.upper()] = index
        else:
            print('warning: ignoring invalid palette index for %s: %r'
                  % (key, value), file=sys.stderr)

    return (
        mapping,
        default,
        _load_item_map(raw, '_item_palettes'),
        _load_item_map(raw, '_item_overrides'),
        _load_range_map(raw, '_item_split', palette_refs=True),
        _load_range_map(raw, '_palette_overrides'),
    )


def render_functional_rgba(item, frame_index):
    """Render a MoO2 functional-color (0x800) frame as a synthetic fire effect.
    
    Items with the 0x800 flag use their pixel indices as an intensity mask
    rather than a palette lookup. The high nibble (F) indicates the functional
    mode. The low nibble (1-15) is the intensity level.
    """
    pixels, clean = item.decode_frame(frame_index)
    values = np.frombuffer(bytes(pixels), dtype=np.uint8).reshape(item.h, item.w)
    
    # Extract the low nibble (1-15 intensity)
    level = (values & 0x0F).astype(np.float32) / 15.0
    
    # Synthetic Heatmap: Dark red -> Orange -> Yellow -> White
    stops = np.array([0.00, 0.15, 0.35, 0.58, 0.78, 0.93, 1.00], dtype=np.float32)
    colors = np.array([
        [ 48,   0,   0],  # Dark red
        [150,   3,   0],  # Deep red
        [235,  28,   0],  # Red-orange
        [255, 105,   0],  # Orange
        [255, 190,  25],  # Yellow-orange
        [255, 240, 145],  # Hot yellow
        [255, 255, 245],  # White-hot core
    ], dtype=np.float32)
    
    flat = level.ravel()
    rgb = np.stack([
        np.interp(flat, stops, colors[:, channel])
        for channel in range(3)
    ], axis=-1).reshape(item.h, item.w, 3)
    
    # Alpha curve (fades out at the edges)
    alpha = np.rint(255.0 * np.power(level, 0.8)).astype(np.uint8)
    alpha[values == 0] = 0  # Fully transparent where intensity is 0
    
    # Respect missing pixels in sparse MoO2 animation frames.
    coverage = item._moo2_coverage_cache.get(frame_index)
    if coverage is not None:
        covered = np.frombuffer(coverage, dtype=np.uint8).reshape(item.h, item.w).astype(bool)
        alpha[~covered] = 0
        
    rgba = np.dstack((
        np.clip(rgb, 0, 255).astype(np.uint8),
        alpha
    ))
    return rgba.tobytes(), clean


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
        # OFFICER holds the 67 leader portraits (21-87) and three re-indexed
        # copies of them: 143-209 (a darker shade, FONTS 1 like the
        # originals), 210-276 (FONTS 2, via _item_split) and 277-343. The
        # copies are not corrupt — each pixel maps from the original's index
        # 97-100% deterministically — but no FONTS or IFONTS palette
        # reproduces the last set (per item it splits between FONTS 4 and
        # IFONTS 3 and fits neither well), so its colours are presumably
        # built at run time. Skipped until that is found, rather than
        # written out in the wrong colours.
        if name == 'OFFICER' and i >= 277:
            skipped += 1
            continue

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
        # Probe frames for measurement. Same rule as extract_all.py: no
        # more than three, and always including the first and last so an
        # animation whose hero is at either end is still seen.
        if item.nframes <= 3:
            probe_indexes = set(range(item.nframes))
        else:
            probe_indexes = {0, item.nframes // 2, item.nframes - 1}
        probe_stats = []

        for frame_index in range(item.nframes):
            # Use the custom renderer for functional color effects (explosions)
            if item.flags & 0x0800:
                rgba, clean = render_functional_rgba(item, frame_index)
            else:
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
            img = Image.frombytes('RGBA', (item.w, item.h), rgba)
            img.save(fpath)
            frame_paths.append(fname)
            frame_clean.append(bool(clean))
            if frame_index in probe_indexes:
                cov, lum, distinct, noise = measure(img)
                probe_stats.append((cov, lum, distinct, noise,
                                    frame_index, img))

        if not frame_paths:
            skipped += 1
            continue

        # Hero frame: the probe with the highest opaque coverage, same rule
        # extract_all.py uses. Then a single ui_score pass on that frame,
        # which is the expensive call and is only worth paying once.
        if probe_stats:
            cov, lum, distinct, noise, hero, hero_img = max(
                probe_stats, key=lambda s: s[0])
            ui = ui_score(hero_img)
        else:
            cov, lum, distinct, noise, hero, ui = 0.0, 0, 0, 0, 0, 0.0

        role = classify(item.w, item.h, item.nframes, cov, lum,
                        distinct, noise)
        pools = pools_for(item.w, item.h, cov, noise, ui, role,
                          distinct, name, i)

        manifest_entries.append({
            'id': 'moo2/%s/item_%02d' % (name, i),
            'source': 'moo2',
            'dir': name,
            'item': i,
            'w': item.w,
            'h': item.h,
            'frames': item.nframes,
            'hero': hero,
            'role': role,
            'pools': pools,
            'coverage': round(cov, 3),
            'lum': lum,
            'colors': distinct,
            'noise': noise,
            'ui': ui,
            'palette_index': palette_index_used,
            'palette_source': palette_source,
            'palette_override_item': override_item_index,
            'palette_chain_item': chain_item,
            'has_internal_palette': embedded is not None,
            'frame_files': frame_paths,
            'frame_clean': frame_clean,
        })
        extracted += 1

    if not manifest_entries:
        # Text, palette and audio archives are LBX containers too; they
        # hold no images and get no output directory.
        try:
            os.rmdir(out_dir)
        except OSError:
            pass
        return extracted, skipped

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
        ref = parse_palette_ref(index)
        if ref is None:
            raise LbxError('palette reference %r is not usable '
                           '(item 0 is font data)' % (index,))
        if isinstance(ref, str):
            src, _, num = ref.partition(':')
            path, n = os.path.join(args.moo2_dir, src + '.LBX'), int(num)
        else:
            path, n = fonts_path, ref
        key = (path, n)
        if key not in palette_cache:
            palette_cache[key] = get_moo2_palette(path, n)
        return palette_cache[key]

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
    total_pooled = 0
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
        # Report how many items actually joined a pool this run, so an
        # archive that measures entirely as chrome or blank is visible in
        # the console without opening the manifest.
        pooled = 0
        try:
            with open(os.path.join(args.out, key, 'manifest.json'),
                      encoding='utf-8') as fh:
                pooled = sum(1 for e in json.load(fh)['items'] if e['pools'])
        except (OSError, ValueError, KeyError):
            pass
        print('%-20s palette %-8s  extracted %4d items, skipped %d, '
              'pooled %d' % (filename, palette_index, extracted, skipped,
                             pooled))
        total_extracted += extracted
        total_skipped += skipped
        total_pooled += pooled

    print('\n%d items extracted, %d skipped, %d assigned to at least one pool'
          % (total_extracted, total_skipped, total_pooled))
    return 0


if __name__ == '__main__':
    sys.exit(main())