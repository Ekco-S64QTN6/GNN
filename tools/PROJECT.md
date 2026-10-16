# GNN Newsroom — Asset Pipeline Source of Truth

**Last updated:** 2026-10-16
**Status:** MoO1 graphics pipeline complete and verified. MoO2 graphics + text done.
MoO2 audio not started. Runtime wiring for MoO2 pending.

This document is the current state of the asset extraction work for the GNN
Newsroom. It replaces every previous version. It is written to be self-
contained — a reader who has not seen the code before should be able to
understand what is here, what works, and what is left.

---

## 0. What this project is

The GNN Newsroom is a browser-based newsroom simulation. It draws its
graphics, text and audio from Master of Orion 1 and Master of Orion 2 (both
GoG releases). Both games store their assets inside a container format called
**LBX**. To use those assets in the browser, they must be decoded into PNGs
(and audio into a playable format) and described in a manifest the runtime
reads.

The project started as a bug fix and grew into a full extraction pipeline.

### 0.1 Where it started

The original bug was in MoO1 animations: **missiles and other moving sprites
were painting across the screen** instead of moving cleanly from A to B. Each
frame stacked on the previous one rather than replacing it. The result was a
smear of missile sprites trailing back to the launch point.

The cause: the MoO1 delta-frame decoder was applying each delta's pixels on
top of the previous frame's pixels without clearing the columns that the delta
re-encoded. MoO1's delta columns describe the *complete new state* of a
column, not an addition to it — so any pixel the current frame did not touch
was left lit from the previous frame.

### 0.2 Why MoO2 was added

While investigating MoO1, it became clear MoO2 uses the same LBX container
but a completely different frame encoding — row-major command stream rather
than column-major delta. Adding MoO2 assets was a natural extension: same
tools, same runtime, richer library. The project now covers both games, and
the goal is **100% working** — no half-decoded sprites, no leftover warnings
on real archives, no palette guesses that aren't verified.

---

## 1. Current state, by game

### 1.1 MoO1 — complete, verified against real archives

Graphics decode correctly. All the following were confirmed by rendering the
extracted PNGs side by side with the in-game originals or by pixel-level
diagnosis:

- Delta-frame inheritance fixed. Missile/beam/explosion trails gone.
- Palette merge: each archive's own palette block (when it has one) is
  layered over the game-wide `WINLOSE[0]` table before per-item palettes are
  merged. This is what made VORTEX item 0 render correctly while every other
  item in the archive was wrong until the deny list went in.
- Fullscreen index-0 opaque rule: 320×200+ items in
  `OPAQUE_ZERO_ARCHIVES` get their palette index 0 written as opaque black.
  This is what makes INTRO/LANDING/COUNCIL/SPIES/etc. self-contained pictures
  rather than transparent overlays. **SPIES and EMBASSY items 12–17 are
  exempt** — they are overlays, not fullscreens, and want index 0 transparent.
- Every item that decodes wrong or is not footage has been flagged in one of
  two deny lists (see §3).

**Verify by:** extracting to `assets/cutscenes/` and inspecting the frames
in `tools/scene_review.html` cutscenes mode.

### 1.2 MoO2 — graphics and text complete, audio not started

- Command-stream frame decoder verified. `SHIPS.LBX` went from 293 warnings
  to 26 to 0. All combat-family archives extract with 0 warnings.
- Empty-frame and 6-byte trailer handling: SHIPS items 405/406/425–448 are
  valid empty sentinel frames; every MoO2 frame body has a 6-byte trailer
  after its `(0, 1000)` terminator. Neither is a warning.
- Container validation rejects the ten non-LBX files in `mastori2/`.
- `IFONTS.LBX` palette path works. `PLNTSUM.LBX` extracts 84 items, 0
  warnings.
- Text extraction: RACENAME (1333), SHIPNAME (4742), STARNAME (7553),
  TECHDESC (7134) — 20,762 records, verified readable.
- Audio: not started. `.MDI`, `.DIG`, `.BNK` files exist under
  `Master of Orion 1/mastori2/`; none have been touched.
- Runtime wiring: not done. `asset-registry.js` doesn't know about
  `source: 'moo2'`, and per-archive MoO2 manifests haven't been merged into
  `assets/gfx-manifest.json`.

---

## 2. Format reference (the parts you actually need)

### 2.1 LBX container (both games)

```
u16 count | u32 0x0000FEAD | u16 type | (count+1) × u32 item offsets
```

Offsets are absolute file positions. MoO2 pads the header to `0x800`; MoO1
does not.

### 2.2 Item headers

| Game | Size | Layout |
|------|------|--------|
| MoO1 | `0x12` | `w, h, unused, nframes, loopstart, flags, unused, pal_offset(u32), (nframes+1) × u32 frame offsets` |
| MoO2 | `0x0C` | `w, h, padding, nframes, delay, flags, (nframes+1) × u32 frame offsets` |

Frame offsets are relative to the start of the item header.

### 2.3 MoO1 frame encoding — column-major, delta

Each frame is a keyframe (`kind=1`) or a delta (`kind=0`).

A delta's column entry is either `0xFF` (unchanged, keep prev) or
`mode | seglen | seglen bytes of run data`. Runs are `pixcount | skip |
pixcount bytes`. `skip` reserves rows the encoder did not touch — the
previous frame's pixels survive them.

**The critical rule:** a delta column describes only the pixels that
changed. Any pixel inside a re-encoded column that the encoder did not
touch stays as it was on the previous frame. A pixel whose value is 0 has
been *erased* by the encoder — it writes through as transparent. Both
matter:

- do not clear the column before applying runs (that is what caused the
  trail bug in reverse — every re-encoded column became transparent where
  the encoder had not written);
- do write payload value 0 through as a pixel (a skip, not a write, is what
  "leave this pixel as it was" means — writing 0 is what "erase this pixel"
  means, and only the encoder can decide which one).

### 2.4 MoO2 frame encoding — row-major, command stream

Frame body starts with `01 00` (marker) and a `u16` initial Y. Then:

- `length > 0` — read `x_advance`, advance X, draw `length` pixels,
  advance X by `length`. Odd length → 1 pad byte.
- `length = 0` — read `y_advance`. `1000` ends the frame. Otherwise
  advance Y, reset X to 0.

Raw frames (flag `0x0100`) are `w × h` palette indices, row-major, no
command stream. Junction frames (flag `0x2000`) composite over the previous
frame; frame 0 is blank.

The 6 bytes after the `(0, 1000)` terminator are a per-frame trailer, not
pixel data.

### 2.5 MoO2 palettes

Three tiers:

1. Base external — `FONTS.LBX` / `IFONTS.LBX` items 1..n (item 0 is font
   data). 1024 bytes: 256 × `[pad, R, G, B]`, RGB in `0..63` scaled ×4.
2. Sequential palette holders — tiny 1×1 or 2×2 items with flag `0x1000`,
   mutate the running archive palette.
3. Sparse image-local — ordinary graphics with flag `0x1000`, patch only
   the range they declare, do not mutate archive state.

Transparency in MoO2 comes from the coverage plane, not from a palette
value. A pixel explicitly drawn as index 0 is opaque.

---

## 3. The deny list

Two places, both consulted on every scene query:

**`extract_all.py`'s `DENY` dict** — first line of defence. Stops an item
joining a pool at all. Format: `(archive, item) -> pools it may not join`,
or `'*'` for all.

**`js/scene-compositor.js`'s `STATIC_DENY`** — second line. Excludes an
item the manifest still admits. Also `dynamicDeny`, populated by the review
tool's ⊘ button and persisted to `localStorage['gnn.denyIds']`.

Items currently denied, with the reason:

| Archive / item range | Reason |
|----------------------|--------|
| `COUNCIL/item_00..23` | Decode against a palette the archive does not carry; frames invert, portraits turn to chromatic confetti. |
| `LANDING/item_00..06` | Item 00 is an animated UI sprite with wrong colours; 01–06 are 10×17 tactical chips, not footage. |
| `LANDING/item_20..36` | More tactical chrome and unit chips. |
| `BACKGRND/item_16` | Animated panel with wrong palette. |
| `STARVIEW/item_00` | UI ring, not a planet. |
| `STARVIEW/item_42..45` | Small tactical icon sprites. |
| `EMBASSY/item_00` | Red/black decorative panel that doesn't belong in the embassy scene. |
| `SPIES/item_01, 06, 10, 16, 22, 28` | Delta columns baked a rectangle of the original interior around the interacting figure. |
| `TECHNO/item_03..07` | Empty screen slot, not the schematic that goes into it. |
| `VORTEX/item_01..34` | Authored against a palette not stored in the archive; item 00 stays (it carries its own palette). |

To add: click ⊘ in `scene_review.html`, then export the JSON and fold the
`dynamic` array into `STATIC_DENY` so it persists without browser storage.

---

## 4. The interview composition

`EMBASSY.LBX` is the one archive whose items are drawn as a specific
composition rather than as independent footage. The recipe composes:

- `EMBASSY/item_01` — the room, 320×130 native
- `EMBASSY/item_02..11` — the ambassador, 175×130 native, animated
- `EMBASSY/item_12..17` — the player representative, 320×200 native

The room and ambassador plates are drawn by the same artist at the same
scale; the ambassador's plate carries a strip of the room's own background
around her figure. They only line up when both are drawn at the same scale.
The rep plate is frame-sized already with the figure drawn at its intended
position; drawn full-frame at scale ~1.5 it lands in the right place.

The exact numbers are in `INTERVIEW_DEFAULTS` at the top of
`js/scene-compositor.js`. Tune them in `tools/interview_tuner.html` — the
tuner and the recipe share `composeInterview()`, so the two never drift.

Current tuned values:

```
roomScale: 1.5384615384615385
ambScale:  1.5384615384615385
ambDx:     31
ambDy:     0
repScale:  2
repDx:     4
repDy:     51
```

---

## 5. The tools folder

| File | What it does |
|------|--------------|
| `lbx.py` | Container reader + frame decoder for both games. The delta-frame and palette-merge fixes are here. |
| `extract_all.py` | MoO1 extraction. `FORCE_TRANSPARENT_*` sets and `archive_palette()` live here. |
| `extract_moo2.py` | MoO2 graphics extraction. Palette map, per-item overrides, IFONTS. |
| `extract_moo2_text.py` | NUL-delimited string tables from MoO2 text archives. |
| `extract_text.py` | MoO1 text (EVENTMSG, NAMES, HELP, ORION.EXE). |
| `build_audio.py` | MoO1 audio: SOUNDFX.LBX → WAVs, MUSIC.LBX → OGG, manifest. |
| `palette_map.json` | MoO2 archive → FONTS/IFONTS palette index. Includes the verified reference cases. |
| `palette_compare.py` | Renders one MoO2 sprite across every external palette. |
| `moo2_probe.py` | Byte-level LBX inspection. The fastest way to see what an archive actually holds. |
| `scan_strays.py` / `scan_all.sh` | Gap scan. Reports unreferenced regions and any header-like reads inside them. |
| `condition_plates.py` | Generated-art pipeline. Defringe, downscale on premultiplied alpha, quantise. Anchors, room plates, backdrops, cutaways, products, logos, icons. |
| `prompt_bridge.py` | Emits generation prompts for the gaps the MOO1 catalogue can't fill. |
| `key_robot.py` | Cuts the MOO1 robot cel out of his newscast scene. |
| `verify_assets.py` | Confirms every runtime asset path resolves. Run before shipping. |
| `drive.py`, `capture_docs.py`, `audio_probe.py`, `voice_audition.py` | Diagnostic harnesses for the broadcast runtime. |
| `app_window.py` | Native GTK/WebKit window wrapper for the station. |
| `test_human_anchor.py` | Anchor conditioning diagnostic. Tuning aid, not part of the pipeline. |
| `show-editor.html` | Editor for `assets/generated/show-config.json`. |
| `scene_review.html` | Recipe preview + deny-flag UI. |
| `studio_review.html` | Desk-line tuner for the ten generated studio sets. |
| `interview_tuner.html` | Slider tuner for the EMBASSY composition. |

---

## 6. What's left

### 6.1 MoO2 audio

Not started. `.MDI`, `.DIG`, `.BNK` files under `Master of Orion 1/mastori2/`.
Same Miles Sound System family as MoO1, so `build_audio.py` is the shape to
adapt — but examine one file of each type before writing the decoder. The
`.MDI` files are almost certainly MIDI (same as MoO1's `music_track_*.mid`),
`.DIG` is a digital sample format, `.BNK` is likely a bank of samples.

**Reconnaissance first:** hex-dump the first 64 bytes of each and compare
against the MoO1 versions, which are already understood.

### 6.2 MoO2 runtime wiring

- Update `asset-registry.js` to route `source: 'moo2'` paths. The frame
  path builder already supports it (checks `entry.source`); the runtime
  needs to load the per-archive manifests.
- Merge `assets/cutscenes/moo2/*/manifest.json` into a MoO2 fragment of
  `assets/gfx-manifest.json`.

### 6.3 MoO1 in the runtime

The decoder is verified at the frame level, but the missile-in-GNN test
hasn't been re-run since the fixes landed. Load the station, trigger a
combat cutaway, and watch a missile animation end to end. If it moves
cleanly from A to B with no trail, MoO1 is done.

### 6.4 MoO2 text — remaining archives

Four archives done. The extractor's default prefix list includes HELP, INFO,
EVENTMSG, STRNGS, MAINTEXT, and others. Run the full set and spot-check:

```
python3 tools/extract_moo2_text.py --only HELP,INFO,EVENTMSG,STRNGS,MAINTEXT
```

If they read cleanly, run without `--only` and you're done with text.

### 6.5 Optional

- **Validate MoO2 ship colours** against `liblbx` output or the game
  itself. The reference cases are already in `palette_map.json`; nothing
  has been hash-compared yet.
- **`IFONTS.LBX` on more archives.** Only `PLNTSUM` tested. Interface
  archives (`LOADSAVE`, `NEWGAME`, `MAINMENU`) are the obvious next
  candidates.

---

## 7. The two rules that keep coming up

**Verify behaviour, not claims.** Repeatedly confirmed this project:
missiles looked fine in a thumbnail but were wrong in motion; palette 3
looked right until compared against every other palette; a Y-coordinate
"fix" that looked plausible collapsed every sprite to a horizontal line.
Every time, the metric or the guess disagreed with what the image actually
showed.

**A skipped pixel and a pixel written as index 0 are different things.**
The trail bug, the transparent-sky bug, and every subsequent delta-frame
question come back to this. `skip` means "leave the previous value";
`payload value 0` means "erase this pixel". Do not conflate them.

---

## 8. References

- **Wolverine / community MoO2 graphics format description**, reproduced
  by the Master of Orion II Online blog:
  https://masteroforion2.blogspot.com/2008/04/moo2-graphics.html
- **`liblbx` community library and format notes:**
  https://github.com/MarcoKull/liblbx
- **Shikadi ModdingWiki LBX container format:**
  https://moddingwiki.shikadi.net/wiki/LBX_Format
- **Sikander's MoO2 Format Documentation** / StrategyWiki / forum
  repositories.
- **The 1.50 Unofficial Patch Project** (`moo2mod.com` / CivFanatics MoO2
  Modding threads).

---

## 9. Revision history

| Date | Change |
|------|--------|
| 2026-10-16 (initial) | Source-of-truth created. MoO2 decoder rewrite pending. |
| 2026-10-16 (post-fix, synthetic) | Command-stream decoder, raw frames, junction compositing, coverage plane, 640×480 validation. |
| 2026-10-16 (post-fix, real archives) | `SHIPS.LBX` 293 → 26 → 0 warnings. Full archive scan complete. Text extraction: 20,762 records. |
| 2026-10-16 (MoO1 fixes) | Delta-frame inheritance fixed. Palette merge fixed. Opaque-zero rule with SPIES/EMBASSY exclusions. VORTEX palette diagnosis. Deny list built. Interview composition tuned. |
| 2026-10-16 (cleanup) | This version. Tools folder review. `README_MOO2_LBX_FIX.md` deleted. PROJECT.md rewritten as a practical reference rather than a cold-reader introduction. |


## `tools/extract_moo2.py`

```python
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
```

Save as `tools/extract_moo2.py`. Re-run the TANM/GAME/TECHSEL/COUNCIL/MONSTER archives:

```bash
python3 tools/extract_moo2.py --only TANM_001,GAME,TECHSEL,COUNCIL,MONSTER,RACESEL,SHIPS
```

Watch for anything unusual in the output.

## Update to `tools/PROJECT.md`

Replace the entire `## 4. The interview composition` section and everything palette-related below it with this. If there's an existing palette section, this supersedes it.

```markdown
## 4. Palette assignments and their sources

MoO2 archives do not all use the same palette. Each archive is assigned a
base external palette from `FONTS.LBX` (or, for a small number, `IFONTS.LBX`),
which may then be patched by an embedded palette chain from a sibling item in
the same archive, or by the item's own embedded palette.

`tools/palette_map.json` encodes these assignments. It has four sections:

- Top-level `"ARCHIVE": n` — the archive-wide base palette.
- `_item_palettes` — a specific item uses a different base palette.
- `_item_overrides` — a specific item draws its embedded palette from a
  named sibling item.
- `_item_split` — an item range uses a different base palette from the
  archive-level default.
- `_palette_overrides` — an item range draws its embedded palette from a
  named sibling item.

`tools/extract_moo2.py` applies these in the priority order given in its
module docstring.

### 4.1 Where the values come from

Two community sources, in order of authority:

**liblbx `moo2-data.txt`** — Nick Bowler's project
(`github.com/MarcoKull/liblbx`, `doc/txt/moo2-data.txt`). Last meaningfully
updated 2014. Contains explicit assignments for 17 archives, item-range
splits for 3 more, and reference-output hashes for specific test cases.

**Wolverine's 2007–2008 research** — the original graphics-format write-up,
republished on the Master of Orion II Online blog
(masteroforion2.blogspot.com). Adds the COUNCIL internal-palette override
rule and describes the SHIPS palette-holder mechanism.

Neither source covers the whole library. The `moo2-data.txt` file ends
with an explicit list of uncatalogued archives. Wolverine's conclusion was
that many of them use **custom internal palettes** not reachable from any
external palette, which is why they have no assignment.

### 4.2 Community-documented assignments

| Archive | Palette | Notes |
|---------|---------|-------|
| `bldg0`–`bldg5` | `FONTS` 2 | `bldg5` is an empty archive |
| `buffer0` | `FONTS` 5 | Galactic map UI |
| `colbldg` | `FONTS` 2 | Colony building menu |
| `game` | split 5 / 6 | Images 0–19, 27, 28 → 5; images 20–26 → 6 |
| `mainmenu` | `FONTS` 6 | |
| `monster` | `FONTS` 4 | Override chain (below) |
| `planets` | `FONTS` 2 | Colony backgrounds |
| `plntsum` | `FONTS` 7 | |
| `raceicon` | `FONTS` 2 | Colony screen people icons |
| `racesel` | `FONTS` 10 | Override: `racesel.item_000` |
| `ships` | `FONTS` 12 | Every 50th image is a player-colour palette holder |
| `science` | item 0 as override | Mouse cursor palette; patches the other animations |
| `starbg` | `FONTS` 1 (also 5, 9, 11 work) | Community judged any of the four |
| `tanm_001`–`tanm_213` | `FONTS` 2 | 213 archives, spinning tech animations |
| `techsel` | split 4 / 5 | Images 0–13 → 4; images 14–27 → 5 |

### 4.3 Override chains

The community documented four whole-archive override chains. Each says:
items in this range should have the embedded palette of a named sibling
item merged over their base palette.

**COUNCIL** — item 0 (mouse cursor) carries the shared palette. Wolverine's
2007 finding: the remaining graphics in the archive do not decode well
against `FONTS` or `IFONTS`; item 0's embedded palette makes them look
correct. Applied as `{"0-23": 0}`.

**MONSTER** — a per-image chain that gives each monster its own colours:

| Images | Override item |
|--------|---------------|
| 0–6 | 13 |
| 7 | 14 |
| 8 | 15 |
| 9 | 16 |
| 10 | 17 |
| 11 | 18 |
| 12 | 19 |
| 20 | 15 |
| 25 (Avenger) | 15, unconfirmed |

**RACESEL** — item 0's embedded palette gives the race-colour variants.
Applied as `{"0": 0}`.

**TECHSEL** — the two item ranges each carry their own palette patch.
Applied as `{"0-13": 0, "14-27": 14}`.

### 4.4 Reference hashes from liblbx

The `liblbx` regression tests carry hash-verified render fixtures for these
specific cases. Matching a fixture proves the decoder pipeline is correct
end to end.

| Archive | Item | Frame | Palette | Override |
|---------|------|-------|---------|----------|
| `SHIPS` | 42 | 0 | `FONTS` 12 | `SHIPS` item 49 |
| `MONSTER` | 7 | 0, 5, 19 | `FONTS` 4 | `MONSTER` item 14 |
| `STARBG` | 9 | 0 | `FONTS` 5 | — |
| `LOGO` | 0, 1 | 0 | embedded | — |
| `MAINMENU` | — | 0 | `FONTS` 6 | — |

No hash comparison has been run against our extraction yet. When the
opportunity presents itself, comparing a rendered PNG byte-for-byte
against a `liblbx` fixture for these five cases is the strongest possible
verification.

### 4.5 Archives with no community assignment

The `liblbx` `moo2-data.txt` file lists these archives as **uncatalogued**.
They have no community palette assignment and their colours have been
determined by our own visual inspection or accepted as defaults:

```
antarmsg, antaroom, app_pics, beams, billtext, cmbtfgtr, cmbtmisl,
cmbtplnt, cmbtsfx, cmbtshp, colgcbt, colony, colony2, colpups,
colpusp, colroads, colsum, colsysdi, colveggi, combat, confirm,
council (handled via override), councmsg, credits, custmstr, design,
diplomat, diplomse, diplomsf, diplomsg, diplomss, dipstars, engmsg,
eventmse, eventmsf, eventmsg, eventmss, events, filedata, firepts,
fleet, flticons, fonts, gstar, help, herodata, ifonts, inbox, info,
install, jimtext, kentext, loadsave, mainpups, maintext, msgeng,
multigm, ndata, newgame, nextplyr, ocpol, officer, playspec, racename,
raceopt, racerprt, races, racestuf, refitpup, score, shipname,
skildesc, sound, sphersfx, starname, sysdisp, techdesc, techname,
textbox, turnsum, warning
```

Some of these are **text archives** and not graphics at all — `racename`,
`shipname`, `starname`, `techname`, `techdesc` — and their palette values
have no effect on anything. Others are graphics the community never needed
a palette for, because those screens are always rendered against their own
backgrounds in-game and no external extraction was done.

For the ones that matter to the GNN runtime (CMBTSHP, CMBTSFX, INSTALL,
APP_PICS, BEAMS, FLEET, FLTICONS, RACES, RACEOPT), palette choices are
**candidates, not authoritative**. If a runtime cutaway shows a wrong
palette, `tools/palette_compare.py` is the tool to settle it.

### 4.6 The two things that are known to be wrong

**MoO2 Workshop's palette descriptions are unreliable.** A 2018 discussion
between the fmoo2-tool developer and the community concluded that some of
MoO2 Workshop's palette values were wrong. The reason: duplicate palettes
can make two different palette indices look identical for one sprite, so
"this sprite renders plausibly" is not proof of "this is the palette the
game used". Any value carried over from MoO2 Workshop into our map is
marked as a candidate, not a source.

**SHIPS/SHIPS2 changed from palette 3 to 12 in this revision.** The
previous value was a first-pass guess from before the community data was
available. The community says 12. If a SHIPS sprite looks wrong after
re-extraction, `palette_compare` output on item 0 will settle it.
```

## What else needs updating in the docs

**`tools/PROJECT.md`** — replace the palette section (as above), and add
these two lines to the references section:

```
- **liblbx moo2-data.txt** (palette assignments, item splits, override
  chains): github.com/MarcoKull/liblbx, doc/txt/moo2-data.txt
- **Wolverine's original graphics-format research** (COUNCIL override,
  SHIPS palette-holder mechanism): masteroforion2.blogspot.com
```

**`tools/tests/README.md`** — no changes needed.

**Root `README.md`** and **`CLAUDE.md`** — no palette content in either; no
changes needed for this finding. If you want to note the community source
somewhere in the root README, a single line under the MoO2 asset paragraph
suffices: "*Palette assignments confirmed against Nick Bowler's liblbx
moo2-data.txt (github.com/MarcoKull/liblbx).*"

## On the SHIPS verification

You ran `palette_compare.py SHIPS --item 0` but didn't report the result.
Before committing SHIPS/SHIPS2 to 12, look at that grid — palettes 3 and 12
should look visibly different. If 12 doesn't look right, leave the map at 3
and note it as a case where our GOG copy differs from what the community
tested. Nothing else in the pipeline depends on the choice; it's a one-line
change either way.