# GNN Asset Catalog 🎬📦

Everything here was decoded out of `Master of Orion 1/data/*.LBX` by
`tools/lbx.py`. Re-run the extractors to rebuild any of it.

---

## 📐 The decoder

`tools/lbx.py` implements the container and the graphics format directly:

**Container** — `u16 count | u32 0x0000FEAD | u16 type | (count+1) × u32 offsets`
(`type` 0 = graphics, 1 = sound, 2 = font, 3/5 = string tables).

**LBXGFX item header (0x12 bytes)**
```
0x00 u16 width      0x02 u16 height     0x04 u16 —
0x06 u16 nframes    0x08 u16 loopstart  0x0a u16 flags
0x0c u16 —          0x0e u32 palette-block offset (0 = archive default)
0x12 (nframes+1) × u32 frame offsets
```

**Embedded palette block** — `u16 rgb_offset | u16 firstcol | u16 numcols | u16 —`
then `numcols × 3` bytes of 6-bit VGA, expanded to 8 bits by bit replication —
`(v << 2) | (v >> 4)` — the way a VGA DAC does, so 63 reaches a true 255.
The previous extraction was inconsistent here: most archives were written with
the raw 6-bit value (**four times too dark**), while `background_tv.png` used
`v × 255 / 63` and the anchor cels used `v << 2`. One ramp now covers
everything, including the newsroom plates.

**Frame body** — `u8 kind` (1 = keyframe, 0 = delta over the previous frame),
then one entry per column:
```
0xFF                    column unchanged, move to the next
u8 mode | u8 seglen     seglen bytes of run data follow

  inside those seglen bytes, repeated until they run out:
    u8 pixcount | u8 skip | pixcount bytes of payload
```
A column is a **sequence of vertical runs**, not a single one — 60% of the
library has two or more, up to twelve. `skip` is the number of transparent rows
before the run, counted from the **end of the previous run in that column**; it
is a gap, not an absolute `y`.

`mode` 0x80 = RLE, 0x00 = raw. In an RLE payload a byte `v >= 0xE0` emits
`v - 0xDF` copies of the byte that follows (max run 32); anything else is a
literal palette index. Index 0 is transparent.

All **4,316 frames across 22 archives decode byte-exact** — every frame body is
consumed to its last byte, with exactly `width` columns, and all **872,024
runs** land inside their column with no clamping.

> Both structural properties are invisible on solid artwork. The 25-cel anchor
> and the 22 story icons are one run per column, so they decode identically
> whether or not you handle multiple runs and whether you read `skip` as a gap
> or as an absolute `y`. Verifying against them alone passes while every
> planet, console and cinematic in the library is quietly wrong — vertical
> smears where the first run of a column was stretched over everything below
> it. The asset that settles it is `NEWSCAST.LBX` item 0, which *is*
> `background_tv.png`: absolute offsets reproduce 60.1% of its pixels, gap
> offsets reproduce 100%.

The default palette is the 256-colour table embedded in `WINLOSE.LBX` item 0.
Against the artwork the project shipped before this pass, it reproduces the
studio chassis, the anchor cels, the globe cels and the story icons at
**100% shape agreement** — every pixel resolves to a consistent palette
index — which is what confirms both the decoder and the palette.

---

## 🗂️ Manifests

Nothing in `js/` hard-codes an asset path. Everything queries these.

### `gfx-manifest.json`
Keyed by archive; one record per item:

| field | meaning |
| :--- | :--- |
| `id` `dir` `item` | `SHIPS/item_04`, archive, index |
| `w` `h` `frames` | native size, decoded frame count |
| `gif` | animated GIF filename, if any |
| `hero` | index of the frame with the most content (delta animations build up) |
| `coverage` | fraction of non-transparent pixels |
| `lum` | mean luminance of opaque pixels |
| `colors` | distinct colours, capped at 64 |
| `noise` | mean horizontal chroma delta — high means palette-scrambled |
| `role` | `fullscreen · panel · portrait · sprite · chrome · strip · blank · noise` |

`role` and `noise` are what let the engine reach the whole library safely: the
compositor asks for "a clean bright backdrop over 140px" or "four readout
plates bigger than a button", and the glitch engine asks for the opposite.

### `audio-manifest.json`
All 41 `SOUNDFX.LBX` effects with `dur · rate · peak · rms · bright · attack ·
sustain`, bucketed into a `role`:

```
click  sfx_06 sfx_36        tick   sfx_05         thud   sfx_00 sfx_26
beep   sfx_10 27 30 31 34 40  chirp sfx_28 sfx_29  zap    sfx_07
servo  sfx_11 sfx_16 sfx_33  sweep  sfx_09 13 19 22 23   blast sfx_01 12 21 35 38
siren  sfx_03 sfx_24        alarm  sfx_14         drone  sfx_20 sfx_25 sfx_32
rumble sfx_02 04 08 15 17 18 37 39
```

Plus the 5 `INTROSND` stings and all 40 `MUSIC.LBX` tracks (21m36s total)
rendered to OGG with FluidR3 GM.

### `moo-strings.json`
- **`bulletins`** — 75 usable news templates out of the 154 in `EVENTMSG.LBX`,
  with the cp437 substitution bytes named: `{PLACE} {NUM} {FACTION} {LEADER}
  {TITLE} {TRAIT} {RANK} {S}`. These are the lines the original GNN anchor read.
- **`leaders`** — the 60 emperor names from `NAMES.LBX`.
- **`topics`** — 40 manual topics from `HELP.LBX`.
- **`vocab`** — 118 hull classes, 39 star names, 10 races and assorted UI
  vocabulary mined out of `ORION.EXE`. This is where sponsor names, product
  names and ticker commodities come from.

---

## 🖼️ Newsroom plates

`extract_all.py` writes these from `NEWSCAST.LBX` through the same decoder as
the cutscene library, so the whole project shares one colour ramp.

| asset | size | drawn at (3×) |
| :--- | :--- | :--- |
| `background_tv.png` | 320×200 | 0,0 — 960×600 |
| `anchor_frame_001..025.png` | 292×105 | 42,42 — 876×315 |
| `globe_frame_001..025.png` | 49×42 | 228,108 — 147×126 |
| `icons/chunk_004..025_frame_000.png` | 41×37 | 624,114 — 123×111 |

The lit area of the studio monitor is `x 42 · y 42 · w 876 · h 316`. Cutaways,
commercial breaks, the chyron and the crawl all live inside that rect; the
console readout at `114,435 · 735×135` is outside it.

---

## 🎬 `cutscenes/` — 873 items, 4,316 frames, 418 GIFs

Frames are `item_NN_frame_NNN.png`, **RGBA with real transparency** (index 0 is
alpha 0, not a filled backdrop colour) so they can be layered.

| archive | items | notes |
| :--- | ---: | :--- |
| `LANDING` | 50 | 25 full-screen planetary skylines — the best backdrops in the set |
| `SPIES` | 30 | 30 full-body agent portraits, 25 frames each (not "HIDE" tables) |
| `WINLOSE` | 36 | cinematics; item 0 carries the master 256-colour palette |
| `INTRO` `INTRO2` | 7 | 534 frames of flight cinematics (115/70/69/180-frame takes) |
| `COUNCIL` | 24 | council chamber + 10 delegate portraits |
| `EMBASSY` | 18 | ambassador scenes |
| `SHIPS` `SHIPS2` | 145 | every hull sprite in the game — the convoy stock |
| `STARVIEW` | 46 | planet bodies in starfields |
| `STARMAP` | 122 | **new** — HUD plates, dials and readouts |
| `TECHNO` | 48 | **new** — technology blueprint panels |
| `MISSILE` | 40 | **new** — ordnance sprites |
| `DESIGN` | 13 | **new** — ship design panels |
| `NEWSCAST` | 26 | **new** — the studio source itself, including an unused 20-frame anchor take (item 1) |
| `BACKGRND` `COLONIES` `NEBULA` `PLANETS` `SCREENS` `SPACE` `VORTEX` | 288 | interiors, city plates, washes, terrain, UI, anomalies |

### A note on the scrambled items
Around thirty items were authored against screen palettes that live in the
game executable rather than in any archive. They decode structurally correct
but chromatically scrambled. They are not discarded — the manifest scores them
with a high `noise` value, the compositor filters them out of ordinary footage,
and `glitch-engine.js` uses them deliberately as transmission interference.

---

## 🔁 Rebuilding

```bash
python3 tools/extract_all.py     # graphics + gfx-manifest.json
python3 tools/build_audio.py     # audio-manifest.json + music/*.ogg
python3 tools/extract_text.py    # moo-strings.json
```
