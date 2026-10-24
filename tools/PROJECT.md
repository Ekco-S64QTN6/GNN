# GNN — asset pipeline

**Last updated:** 2026-10-24

How the station turns the two games' files into the PNGs, audio and
manifests under `assets/`. The MoO2 *format* — container, frames, palettes,
the archive-by-archive findings — is written up for anyone working with those
files, separately from this project, in
[`MOO2_GRAPHICS_DEEP_DIVE.md`](../MOO2_GRAPHICS_DEEP_DIVE.md). This file covers
how *we* apply it: the tools, the palette map, and the choices we made.

Extracted output is git-ignored and rebuilt from owned game files (§6).

---

## 1. State

| | |
|---|---|
| MoO1 graphics | Decoded byte-exact; delta frames, palette merge, opaque-zero rule (§2) |
| MoO2 graphics | Decoder reproduces all 14 of liblbx's reference hashes (`tests/moo2_reference.py`); palettes from `palette_map.json` (§3) |
| MoO2 text | Extracted and merged; runtime admits only reviewed race and star names (§5.2) |
| MoO2 sound effects | `extract_sound_moo2.py`, merged by `build_audio.py` |
| MoO2 music | `extract_music_moo2.py`: STREAM.LBX WAVs and nine video soundtracks → 17 OGGs |
| MoO2 video | `extract_moo2_video.py`: nine Smacker files → PNG frames; 33 segments vetted for air |

Counts for the local build are in `CLAUDE.md` §1; `tools/verify_assets.py`
prints them.

---

## 2. MoO1

### 2.1 Frame encoding — column-major, delta

Each frame is a keyframe (`kind = 1`) or a delta (`kind = 0`). A column entry
is `0xFF` (unchanged) or `mode | seglen | seglen bytes of runs`; a run is
`pixcount | skip | pixcount bytes`.

**A delta column describes only the pixels that changed.** A pixel the
encoder skipped keeps its value from the previous frame; a pixel written as
`0` was erased and becomes transparent. The original missile-trail bug was
the decoder clearing each re-encoded column before applying its runs, which
turned every skipped pixel transparent. Do not clear the column, and do write
`0` through (CLAUDE.md constraint 14).

### 2.2 Palettes and transparency

Each archive's own palette block, when it has one, is layered over the
game-wide `WINLOSE[0]` table before per-item palettes. Index 0 is transparent
in a sprite but black in a fullscreen: any item at `w >= 300 and h >= 180`
writes it opaque. SPIES (`FORCE_TRANSPARENT_ARCHIVES`) and EMBASSY items
12–17 (`FORCE_TRANSPARENT_ITEMS`) are 320×200 overlays and are exempt.

---

## 3. MoO2 in this project

### 3.1 `palette_map.json`

| Section | Meaning |
|---|---|
| `"ARCHIVE": n` | Archive base palette: FONTS item `n`, or `"IFONTS:n"` |
| `_default` | Base for archives not listed (FONTS 1) |
| `_item_split` | `{"lo-hi": palette}`: an item range uses another base (GAME, TECHSEL, OFFICER 210–276) |
| `_item_palettes` | `{"item": palette}`: one item uses another base. Values accept `"IFONTS:3"` / `"FONTS:3"`; a plain integer is a FONTS item |
| `_palette_overrides` | `{"lo-hi": item}`: merge item's internal palette over the base for a range (COUNCIL, MONSTER, TECHSEL) |
| `_item_overrides` | `{"item": item}`: the same for one item (SHIPS 42 ← 49, CMBTSFX 8 ← 68, CMBTPLNT 0–4 ← 5, DIPLOMAT, RACES, EVENTS, …) |

`extract_moo2.py` applies them in this order (module docstring):
`_item_split`, then `_item_palettes`, then the running palette (archive base
plus every ≤2×2 holder read so far). Then `_palette_overrides`, then
`_item_overrides`, then the item's own patch.

**An explicit base replaces the running palette.** An item that gets
`_item_split` or `_item_palettes` does not see earlier holders. If it needs
one, add the holder as an `_item_overrides` entry too.

`palette_review.py` shows a sibling-palette choice as `SIBLING:N`. That is
its label for an `_item_overrides` entry; `--apply` writes it as one, and
the map itself does not accept `SIBLING:`.

Values come from liblbx's `moo2-data.txt` where it has them; everything else
was picked by eye. See the deep dive §6–§8 for which is which. **Do not pick
palettes automatically**: two metrics were tried and scored 0 of 6 on known
answers (CLAUDE.md §3).

### 3.2 Extractor choices

- **Palette holders** (≤2×2 with an internal palette) update the running
  palette and are not written out. The 24×24 holders at the head of COUNCIL,
  EVENTS, DIPLOMAT and SCIENCE are not ≤2×2, so they are reached through
  `_palette_overrides` / `_item_overrides`.
- **OFFICER 277–343 are skipped**: no known palette fits them. 143–276 are
  extracted (FONTS 1 and FONTS 2); before 2026-10-24 everything from 143 on
  was skipped as "corrupt", which it is not.
- **Functional-colour (`0x0800`) items** go through `render_functional_rgba()`,
  a synthetic heat ramp on the low nibble.
- **Frames accumulate** over the previous frame; coverage restarts every
  `chunk` frames and every frame under `0x0400` (`lbx.py`). Until 2026-10-24
  frames were decoded on a blank canvas unless `0x2000` was set, which was
  right for first frames only.
- **Pools**: every item is measured like MoO1 items (coverage, luminance,
  colour count, chroma noise, `ui_score`), classified, and admitted to
  `broll` / `portrait` / `sprite` / `chrome` / `glitch` by the same gates as
  `extract_all.py`. `UI_ARCHIVES` never reach `broll`.

### 3.3 After changing the decoder or the map

Re-extract the affected archives, then re-merge:

```bash
python3 tools/extract_moo2.py --only CMBTSFX,OFFICER
python3 tools/merge_moo2_manifests.py
python3 tools/tests/moo2_reference.py
python3 tools/verify_assets.py
```

**A re-extract can change what airs.** Items gain or lose pools; contact-sheet
the affected pools at on-air size before calling it done (CLAUDE.md §3,
"Size is not role").

---

## 4. The deny list

Two layers:

- **`extract_all.py`'s `DENY`** keeps a MoO1 item out of a pool entirely.
- **`js/scene-compositor.js`'s `STATIC_DENY`** is enforced inside
  `GNNAssets.find()`, so every pool query honours it. `dynamicDeny` holds
  what the ⊘ button in `scene_review.html` adds (stored in
  `localStorage['gnn.denyIds']`); fold its export into `STATIC_DENY` to keep it.

What `STATIC_DENY` holds, and why:

| Items | Reason |
|---|---|
| MoO1 `COUNCIL` 00–23 | Decode against a palette the archive does not carry |
| `LANDING` 00–06, 20–36 | Animated UI sprite; tactical chips, not footage |
| `BACKGRND` 16 | Animated panel, wrong palette |
| `STARVIEW` 00, 42–45 | UI ring; small tactical icons |
| `EMBASSY` 00 | Decorative panel that does not belong in the scene |
| `SPIES` 00, 01, 06, 10, 16, 22, 27, 28 | Keyed-out figures on black, or delta-baked rectangles |
| `TECHNO` 03–07 | Empty screen slot, not the schematic |
| `VORTEX` 00–34 | 01–34 authored against a palette not in the archive; 00 scrambled |
| `INTRO2` 00, 02 | Black edge to edge; the game's credits |
| `COLONIES` 02, 03 | Scattered-pixel sky (the other 26 are clean) |
| MoO2 `EVENTS`, `DIPLOMAT`, `COUNCIL`, `OFFICER` (all) | In-universe and GNN-branded, or in-universe faces; loaded by path where they belong (lore show, archive look) |

---

## 5. Still open

### 5.1 Palettes

- **Per-item picks need the owner's eye.** `palette_review.py` builds the
  page; `--apply palette-picks.json`, re-extract, re-merge.
  `docs/palette-outliers.txt` over-flags (SHIPS and BLDG variety is real).
- **OFFICER 277–343** have no palette (deep dive §8).
- **Uncatalogued archives** still on first-pass picks: BEAMS, FLEET,
  FLTICONS, RACES, RACEOPT, DIPLOMAT, APP_PICS. Review one with
  `palette_review.py --archive NAME`.
- MoO1 palettes are out of the review tool's scope; their known faults are the
  COLONIES pair and the MoO1 COUNCIL archive, both denied.

### 5.2 MoO2 text

Extraction and merge exist; the runtime admits only reviewed race and star
names (`asset-registry.js` allowlist). Classify English narrative records,
reject UI labels, code identifiers and non-English text, then widen the
allowlist for reviewed records only (ROADMAP §4.4):

```bash
python3 tools/extract_moo2_text.py --all-lbx
python3 tools/merge_moo2_text.py --dry-run
```

### 5.3 Media not yet used

`STREAMHD.LBX` (21 short cues) and the GENWINFN video's soundtrack are not
rendered. Show themes are picked by position in the music list
(`showIdx * 7 + 3`), so adding a bed re-themes every show: add beds on
purpose, not as a side effect. More cinematic segments could be vetted
(ROADMAP §5).

---

## 6. Rebuilding everything from a fresh clone

Needs the GOG releases of both games in `Master of Orion 1/` (MoO2 in
`Master of Orion 1/mastori2/`), Python 3 with Pillow and NumPy, and ffmpeg.

```bash
python3 tools/extract_all.py              # MoO1 graphics (~24 s)
python3 tools/extract_text.py             # MoO1 text → assets/moo-strings.json
python3 tools/extract_moo2.py             # MoO2 graphics
python3 tools/merge_moo2_manifests.py     # fold MoO2 into assets/gfx-manifest.json
python3 tools/extract_moo2_text.py        # MoO2 strings
python3 tools/merge_moo2_text.py          # → assets/moo2-strings.json
python3 tools/extract_moo2_video.py       # MoO2 cinematics → PNG frames
python3 tools/extract_sound_moo2.py       # MoO2 SFX
python3 tools/extract_music_moo2.py       # MoO2 music → OGG
python3 tools/build_audio.py              # MoO1 audio + index everything
python3 tools/verify_assets.py            # every runtime path resolves
```

---

## 7. The tools folder

| File | What it does |
|---|---|
| **Decoding and extraction** | |
| `lbx.py` | LBX container and image decoder for both games |
| `extract_all.py` | MoO1 graphics, measurement and pools |
| `extract_text.py` | MoO1 text (EVENTMSG, NAMES, HELP, ORION.EXE) |
| `extract_moo2.py` | MoO2 graphics with `palette_map.json` applied; measurement and pools |
| `palette_map.json` | MoO2 palette assignments (§3.1) |
| `merge_moo2_manifests.py` | Per-archive MoO2 manifests → `assets/gfx-manifest.json`; identifies MoO2 lists by content |
| `extract_moo2_text.py` / `merge_moo2_text.py` | MoO2 NUL-delimited strings; filtered into `assets/moo2-strings.json` |
| `extract_moo2_video.py` | MoO2 Smacker cinematics → PNG frames |
| `extract_sound_moo2.py` | `SOUND.LBX` → WAVs |
| `extract_music_moo2.py` | `STREAM.LBX` WAVs and video soundtracks → OGG |
| `build_audio.py` | MoO1 SFX profiling, MIDI → OGG; indexes all audio into `assets/audio-manifest.json` |
| **MoO2 inspection** | |
| `moo2_probe.py` | Container table and raw bytes of any item |
| `probe_cmbtsfx.py` | CMBTSFX flags, embedded palettes and coverage, per item |
| `palette_compare.py` | One MoO2 item under every FONTS palette |
| `palette_survey.py` | Every MoO2 archive across FONTS and IFONTS, one HTML page |
| `palette_review.py` | Review page for per-item palettes; `--apply` writes the picks |
| `palette_fit.py` | Items whose palette-index range is unlike their siblings'. A review queue, not a picker |
| `scan_moo2_quality.py` | Per-archive palette-collapse scan |
| `scan_strays.py` / `scan_all.sh` | Unreferenced data in LBX gaps |
| **Generated art** | |
| `condition_plates.py` | Generated art → 256-colour plates at draw size |
| `fix_listening.py` | Hero body under the listening plates' turned heads |
| `compose_titlecards.py` | Show title cards |
| `prompt_bridge.py` | Generation prompts for the gaps |
| `test_human_anchor.py` | Anchor-conditioning tuning aid; writes to `/tmp` only |
| **Runtime** | |
| `verify_assets.py` | Every runtime asset path resolves |
| `drive.py` | Drives the broadcast over CDP |
| `audio_probe.py` | Clip count and level-relative pops |
| `capture_gallery.py` | Re-shoots the README gallery |
| `voice_audition.py` | Auditions every voice the engine offers |
| `pronounce_kokoro.py` | Audits `PRONOUNCE` against Kokoro, writes `js/pronounce-kokoro.js` |
| `app_window.py` | Native GTK/WebKit window for the station |
| `scene_review.html`, `studio_review.html`, `interview_tuner.html`, `commercial_review.html`, `show-editor.html` | Review and tuning pages, served by the station |
| `tests/` | Offline checks and CDP diagnostics — `tests/README.md` |

---

## 8. The EMBASSY interview composition

`EMBASSY.LBX` is drawn as one composition: the room (`item_01`, 320×130),
the ambassador (`item_02..11`, 175×130, animated) and the player's
representative (`item_12..17`, 320×200). Room and ambassador share an
artist and a scale and only line up at the same scale; the rep plate is
frame-sized with the figure already placed. The numbers live in
`INTERVIEW_DEFAULTS` in `js/scene-compositor.js`, tuned in
`interview_tuner.html` (which shares `composeInterview()` with the recipe):

```
roomScale 1.5384615384615385   ambScale 1.5384615384615385   ambDx 31  ambDy 0
repScale  2                    repDx 4                       repDy 51
```

---

## 9. History

| Date | Change |
|---|---|
| 2026-10-16 | MoO2 command-stream decoder; SHIPS warnings 293 → 0. MoO1 delta-frame and palette-merge fixes; opaque-zero rule; deny list; interview tuning |
| 2026-10-18 | COUNCIL palette rule widened to all items; EVENTS and DIPLOMAT palettes; `IFONTS:n` in `_item_split` |
| 2026-10-20 | Functional-colour rendering; multi-frame holders; OFFICER 143+ skipped (reversed 10-24) |
| 2026-10-24 | Frames accumulate as in liblbx, verified against its 14 hashes; OFFICER 143–276 restored; `extract_music_moo2.py`; liblbx's real location (`git.draconx.ca`); this file rewritten, the format moved to `MOO2_GRAPHICS_DEEP_DIVE.md` |
