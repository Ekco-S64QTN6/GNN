# Master of Orion II (MoO2) LBX graphics, palettes and audio — extraction deep dive

**Audience:** anyone decoding the data files of *Master of Orion II: Battle at
Antares* (1996) who is getting wrong colours, broken animations, black
sprites, "corrupt" items or unreadable `.LBX` files.

**Keywords:** MoO2, MOO2, Master of Orion 2, LBX, FONTS.LBX, IFONTS.LBX,
palette, internal palette, palette holder, junction flag, functional colour,
fill background, Smacker, STREAM.LBX, OFFICER.LBX, COUNCIL.LBX, CMBTSFX.LBX,
DIPLOMAT.LBX, RACES.LBX, EVENTS.LBX, lbximg.

Everything here was checked against the GOG release's files in October 2026,
with a decoder that reproduces all of liblbx's published reference renders
byte for byte (§10). Each fact is tagged with its source:

- **[liblbx]** — Nick Bowler's `liblbx`: `doc/txt/moo2-data.txt`, the decoder
  (`src/image.c`, `src/lbximg.c`) and the test suite (`tests/moo2data.at`).
- **[Wolverine]** — Wolverine's graphics-format write-up, reposted on the
  Master of Orion II Online blog in 2008.
- **[new]** — found by working on the files themselves; we found no earlier
  published description. Measured, not folklore, but re-check before you
  build on it.

---

## 1. Quick answers

| Symptom | Cause | Section |
|---|---|---|
| Every image in an archive has the wrong colours | Wrong external palette (FONTS/IFONTS item) for the archive | §4, §7 |
| Most images right, a few wrong, in one archive | Per-item palettes, or a sibling item holds the palette | §5, §6 |
| Images go wrong from a certain item number on | A tiny palette-holder item changed the running palette | §5.2 |
| Only the first frame of an animation is right; later frames have holes | Frames are drawn over the previous frame, with or without flag `0x2000` | §3.4 |
| Animation frames smear or leave trails | Coverage restarts every `chunk` frames (header byte 9), and on every frame under `0x0400` | §3.4 |
| Explosions come out as one flat band of colour | Flag `0x0800`: the pixels are intensities, not colours | §3.2, §8 |
| A raw frame is 1–3 bytes longer than `w × h` | Raw (`0x0100`) frames are padded to 4 bytes | §3.3 |
| 6 unexplained bytes after every frame | A per-frame trailer after the `(0, 1000)` terminator | §3.3 |
| "Bad magic" on `INTRO.LBX` and the `*FIN.LBX` files | They are Smacker videos with an `.LBX` name | §2 |
| Two or three STREAM.LBX "tracks" are 22 bytes of text | "cats rule dogs drool" placeholders | §2 |
| OFFICER.LBX looks like 200 corrupt portraits | Three re-indexed copies of the 67 leader portraits | §8 |

---

## 2. What the `.LBX` files are

The game directory has 373 files ending `.LBX`. Not all of them are LBX
containers. [new: the counts and classification]

| Kind | Files | Notes |
|---|---|---|
| Graphics archives | 320 | LBX container of image items (§3). |
| Smacker video | `INTRO`, `AMEBAFIN`, `ANATKFIN`, `ANWINFIN`, `DIMTVFIN`, `GENWINFN`, `LOSERFIN`, `ORIONFIN`, `PLNTDFIN`, `WININFIN` | Magic `SMK2`, not `0xFEAD`. ffmpeg/libavcodec decodes them as they are [liblbx]. `INTRO` and four of the endings are stored at 480×160 and are meant to be line-doubled to 480×320 [new]. |
| Palettes | `FONTS.LBX` (14 items), `IFONTS.LBX` (5 items) | §4 |
| Music | `STREAM.LBX` (11 items), `STREAMHD.LBX` (21 items) | LBX containers whose items are plain RIFF WAVs, 8-bit stereo 22,050 Hz [new: format]. STREAM holds the main tracks, STREAMHD the short ones [liblbx]. |
| Sound effects | `SOUND.LBX` (69 items) | WAV data. |
| Text and data | `*TEXT*`, `*MSG*`, `*STRNG*`, `HELP`, `TECHNAME`, `SHIPNAME`, … | NUL-delimited strings and game tables. |

**The STREAM placeholder [new].** `STREAM.LBX` items 0, 7 and 9, and
`STREAMHD.LBX` item 0, are not audio. Each is the same 22 bytes of ASCII:

```
cats rule dogs drool\r\n
```

A WAV reader that does not check for `RIFF` chokes on them. They sit where
tracks would be, so presumably those tracks were cut and the slots kept.

### The LBX container (both games)

```
u16 item_count | u32 0x0000FEAD | u16 type | (item_count + 1) × u32 offsets
```

Offsets are absolute; item *i* runs from `offset[i]` to `offset[i+1]`. MoO2
pads the header to `0x800`. Some `TANM_###.LBX` files have data between the
header and the first item [liblbx], so always use the offsets.

---

## 3. Image items

### 3.1 Header (12 bytes, little-endian)

```
0x00 u16 width     0x02 u16 height    0x04 u16 (zero)
0x06 u8  frames    0x07 u8  (zero)
0x08 u8  leadin    0x09 u8  chunk     0x0A u16 flags
0x0C (frames + 1) × u32 frame offsets, relative to the item start
```

Bytes 8–9 are often described as a u16 "frame delay". liblbx reads them as
two bytes [liblbx]:

- `leadin` — frames played once before the loop. On a one-shot animation it
  is the last frame index: MAINMENU 0 has 50 frames and leadin 49.
- `chunk` — how many frames share one coverage plane (§3.4). MONSTER 7 has
  chunk 4.

Master of Orion 1 uses an 18-byte header for the same fields plus a palette
offset. Validating the frame-offset table distinguishes the two.

### 3.2 Flags

Wolverine's bit diagram is `..JI FB.N .... ....`.

| Bit | Wolverine | liblbx | In practice |
|---|---|---|---|
| `0x2000` | Junction. Commenter TAlchemist: "you add each frame to the frame before it" | *Looping* (unsure): zeroes `leadin` | **Does not decide compositing.** MAINMENU 0 and MONSTER 7 have no flags at all, and liblbx's hashes for their later frames only come out when frames build on each other (§3.4) [new: verified against the hashes]. Seen on DIPLOMAT, COUNCIL and EVENTS animations. |
| `0x1000` | Internal palette | Embedded palette | A palette patch follows the frame-offset table (§3.5). |
| `0x0800` | Functional colour: "effects like transparency or shading", e.g. the shadow in `BLDG0.LBX` item 0 | *Building*: "related to shadow?" | Pixels are intensities, not colour lookups (§8, CMBTSFX). |
| `0x0400` | Fill background: "clear the area on which the image is going to be drawn" | *Overwrite*: "draw each frame on a clean slate (unsure)", implemented as `chunk = 1` | Common on COUNCIL, RACES, CMBTSFX and OFFICER items. |
| `0x0100` | No compression | Raw | The frame is a `w × h` raster (§3.3). |

### 3.3 Frame bodies

**Compressed** (no `0x0100`) [liblbx `image-format.txt`; details new]:

```
u16 1                      frame marker
u16 initial_y
repeat:
  u16 length
  length > 0:  u16 x_advance (from the end of the previous run),
               length bytes of palette indices,
               1 pad byte if length is odd
  length == 0: u16 y_advance; x resets to 0.
               y_advance == 1000 ends the frame.
```

Two things that look like errors and are not [new]:

- **The 6-byte trailer.** Every frame has 6 bytes after its `(0, 1000)`
  terminator. Some are zero and some are not; none are pixels.
- **Empty sentinel frames.** SHIPS items 405, 406 and 425–448 are 1×1
  placeholders with a stray `initial_y` (636) and no runs.

Transparency means "not written", not "index 0". A run can write index 0 as
a visible colour, so track coverage separately from pixel values.

**Raw** (`0x0100`) [new: padding]: `w × h` bytes, row-major, **padded to a
4-byte boundary**. A 31×31 frame takes 964 bytes, not 961 (BUFFER0 143–147;
also STARBG 17, 29, 41, 45 and 49). Read `w × h` and ignore the rest.

### 3.4 How frames compose [liblbx, verified new]

This rule decides whether animations come out right, and the flag names
suggest something else:

1. Keep **one pixel buffer for the whole animation and never clear it.**
   Each frame's runs write into it, so a frame stores only what changed.
2. Keep a **coverage plane** (what is visible) beside it. Clear the
   coverage, not the pixels, at frame 0 and at every frame number divisible
   by `chunk`. With `chunk == 0` it is never cleared after frame 0. Flag
   `0x0400` means `chunk = 1`: each frame shows only what it draws itself.
3. A frame's image is the pixel buffer wherever the coverage is set.

Decoding each frame on a blank canvas, as most descriptions imply, gets
every first frame right and every later frame of a delta animation wrong.
The evidence is the hashes in §10: MAINMENU 0 frame 49 equals the
finished main-menu still (MAINMENU 21) only when frames accumulate.

```python
pixels = bytearray(w * h)                 # persists across frames
for i in range(frames):
    if i == 0 or (chunk and i % chunk == 0):
        coverage = bytearray(w * h)       # restart what is visible
    for x, y, run in runs(frame[i]):      # §3.3
        pixels[y*w + x : y*w + x + len(run)] = run
        coverage[y*w + x : y*w + x + len(run)] = b'\x01' * len(run)
    emit(pixels, coverage)
```

### 3.5 Internal palette (flag `0x1000`) [Wolverine]

Immediately after the frame-offset table, before the first frame:

```
u16 first_index | u16 count | count × (u8 alpha, u8 R, u8 G, u8 B)
```

Components are 6-bit VGA values (multiply by 4 for 8 bits). The first byte of
each entry is 0 or 1. The patch replaces only `first_index …
first_index + count − 1`; everything else comes from the layers in §5.

Reject a patch with `count == 0` or `first_index + count > 256`, or one that
runs past the first frame offset [new]. Then a stray flag cannot turn frame
bytes into colours.

---

## 4. External palettes: FONTS.LBX and IFONTS.LBX [Wolverine]

- Item 0 of `FONTS.LBX` and of `IFONTS.LBX` is a **font, not a palette**.
- `FONTS.LBX` items 1–13 and `IFONTS.LBX` items 1–4 are palettes, 17 in all.
  Each item is 12,544 bytes: 256 × (pad, R, G, B) in 6-bit values, then
  cursor data.

Every image's colours start from one of these 17. Which one belongs to the
archive, sometimes to a range of items, sometimes to a single item. Nothing
in the image says which.

---

## 5. Where an item's colours come from

An image's final palette is built in layers.

### 5.1 The base: an external palette

Usually one per archive (§7). Some archives switch by item range (GAME,
TECHSEL [liblbx]; OFFICER [new]). Some need a palette for one particular
item.

### 5.2 Running palette holders [Wolverine]

A **tiny item (≤ 2×2) with an internal palette** is not art. As the archive
is read in order, its patch is merged into a *running* palette that every
later item inherits, until the next holder. Do not draw it.

- **SHIPS:** a 2×1 holder at every 50th item (49, 99 … 399), patching indices
  192–239: the player colours ("every 50th image contains an override
  palette which will colour the ships for a particular player colour"
  [liblbx]). More holders sit at 413–419 [new].
- **CMBTSFX item 68 [new]:** a 2×1 holder with **8 frames**. A test that
  requires one frame misses it; test the size, not the frame count.
- **CMBTPLNT item 5 [new]:** a 1×2 holder for indices 224–255. Items 6+
  inherit it. Items 0–4 come *before* it and render as green blobs unless its
  patch is applied to them too.
- **MONSTER items 13–19:** 2×1 holders, each applied to particular monsters
  [liblbx, sizes new].

If one item needs both an explicit base palette and a holder's patch, apply
the holder's patch on top of the explicit base. Do not let the explicit base
discard it silently.

### 5.3 Sibling palettes

Here the palette is in another item of the same archive that is too big to be
a running holder. Merge that item's internal palette over the base, for a
named range of items.

liblbx notes this for SCIENCE: its 24×24 mouse-cursor image (item 0, indices
192–255) is the palette for the textbox and mist animations. **The same
shape recurs** — a 24×24 item, often at the head of the archive, carrying a
large palette and drawing nothing useful [new]:

| Archive | Palette item(s) | Applies to |
|---|---|---|
| SCIENCE | 0 (24×24, 192–255) | 1–2 [liblbx] |
| COUNCIL | 0 (24×24, all 256 colours) | all 197 items. Applied to 0–23 only, everything past 23 is noise. |
| EVENTS | 0 (24×24, 256) | item 1 (640×480, 31 frames). Items 2+ carry their own patch (184–247). |
| DIPLOMAT | 0–12 (thirteen 24×24, 256 each) | 13–38, two items per holder |
| RACES | 0 (a 640×480 screen with a 256-colour palette) | 32–63, the race portraits and icons |
| TECHSEL | 0 and 14 (the two screens) | 0–13 and 14–27 [liblbx] |
| MONSTER | 13–19 | per monster: 0–6 ← 13, 7 ← 14 … 12 ← 19, 20 ← 15, 25 ← 15? [liblbx] |
| SHIPS | 49 | item 42 [liblbx test case] |
| CMBTSFX | 68 | item 8, which comes before it (§8) |
| CMBTPLNT | 5 | items 0–4 |

**A run of 24×24 items at the head of an archive is a set of palette
holders.** Check for one before deciding an archive's colours are broken.

### 5.4 The item's own patch, last

If the item has flag `0x1000`, its patch goes on last and wins.

### Putting it together

```
base     = per-item or per-range external palette, else the running palette
           (archive palette + every holder read so far)
base    += sibling item's patch, where §5.3 applies
palette  = base + the item's own patch
```

---

## 6. Picking palettes where nobody documented them

Most archives have no published assignment. Two pieces of hard-won advice
[new]:

- **Automatic pickers failed.** Two principled metrics — colour-ramp
  smoothness, and the same normalised against shuffled palettes — were tested
  against six archives with known answers. **Both scored 0 of 6**: they
  reward whichever palette has the least contrast. Choose by eye.
- **When a correctly coloured copy of the same art exists, colour distance
  to it works.** OFFICER's re-indexed portraits (§8) were matched to their
  originals that way, and the method agreed with the eye on the run where
  the answer was already known.

Duplicate palettes can make two palette numbers look identical for one
sprite, so "this sprite looks plausible" does not prove "this is the
palette the game used".

---

## 7. Archive palettes

From **[liblbx]** (`moo2-data.txt` covers about 14 archives or families):

| Archive | Palette |
|---|---|
| `BLDG0–5`, `COLBLDG`, `PLANETS`, `RACEICON`, `TANM_###` | FONTS 2 (`BLDG5` is one empty file) |
| `BUFFER0` | FONTS 5 |
| `GAME` | 0–19, 27–28 FONTS 5 (in-game menu); 20–26 FONTS 6 (main menu) |
| `MAINMENU` | FONTS 6 |
| `MONSTER` | FONTS 4, plus holders 13–19 (§5.3) |
| `PLNTSUM` | FONTS 7 |
| `RACESEL` | FONTS 10, "override racesel.000" |
| `SHIPS` | FONTS 12, holders every 50th item |
| `STARBG` | works with FONTS 1, 5, 9 or 11 |
| `TECHSEL` | 0–13 FONTS 4 (← 0); 14–27 FONTS 5 (← 14); marked as possibly wrong |
| `SCIENCE` | the cursor item is the palette for the others |

liblbx lists COUNCIL, CMBTSFX, OFFICER, DIPLOMAT, RACES, CMBTPLNT and EVENTS
only as **uncatalogued**. Everything this document says about them is new.

**RACESEL [new]:** item 0 has no internal palette, so "override racesel.000"
cannot be applied literally. The portraits from item 35 on take item 18's
patch.

---

## 8. Archive notes [new]

### OFFICER.LBX: four copies of the leader portraits

344 items. 0–20 and 88–142 are interface pieces. The 73×88 leader portraits
come in **four runs of 67**:

| Items | What it is | Palette |
|---|---|---|
| 21–87 | the portraits | FONTS 1 |
| 143–209 | a darker shade of the same portraits | FONTS 1 |
| 210–276 | the same drawings, re-indexed | FONTS 2 |
| 277–343 | the same drawings, re-indexed again | **unknown** |

None of these items has an internal palette, and none is corrupt. Pair each
copy with its original and every pixel's index maps one to one: 100% for
143+, 96.6% for 210+, 97.9% for 277+. Colour distance to the originals puts
all 67 of 210–276 on FONTS 2. For 277–343 no FONTS or IFONTS palette fits:
per item the best guess splits between FONTS 4 and IFONTS 3, with a large
residual. The game probably builds that palette at run time, perhaps for a
highlight or "selected" state.

### CMBTSFX.LBX: functional colour, a beam, a multi-frame holder

79 items.

- **`0x0800` items** (51 of items 9–67; 14, 40, 42 and 47–51 are not flagged)
  are explosions and energy effects. A pixel's high nibble seems to select a
  mode: `F` on most pixels, also `5`, `9`, `D` and `0`. The low nibble is an
  intensity from 0 to 15. Wolverine says he never fully worked out how the
  game uses this. A ramp from dark red through orange and yellow to white,
  with alpha rising with intensity, approximates it well. It is an
  approximation, not a recovered palette, and it ignores the non-`F` modes.
- **Item 8** (308×39, 8 frames, `0x0400`) is a beam using indices 161–173.
  Under the archive's palette it is black. The 2×1 holder at **item 68**
  patches 160–175, but item 8 comes before it, so the patch has to be
  applied to it explicitly.
- **Items 69–78** (59×59, 80 frames each, no flags, `chunk` 0, `leadin` 79)
  look like smoke and dust, using indices below 80 under FONTS 4. Decoded
  frame by frame on a blank canvas they dissolve into a starburst and shrink
  to a dot. Decoded by the §3.4 rule, which liblbx's hashes support for other
  items, they build up into a solid black disc. Which one the game shows is
  **not known**: the hashes cover no item like these.

### CMBTPLNT.LBX

Items 0–4 (planet spheres, 56–150 px) come before the holder at item 5 and
need it applied backwards. Items 6+ inherit it.

### EVENTS.LBX: the in-game *Galactic News Network*

Item 1 is the game's GNN newsroom: an android anchor and a GNN-branded
monitor, 640×480, 31 frames. Items 2–37 are the event pictures shown on that
monitor, GNN logo in the corner. Item 0 is the newsroom's palette (§5.3);
the pictures carry their own.

### DIPLOMAT.LBX

Two items per race, in the game's alphabetical race order: a 640×480,
38-frame item, mostly empty (13, 15, …) and a 32-frame ambassador hologram (480 or 558 wide)
(14, 16, …, flag `0x2000`). Items 0–12 are their thirteen palettes, one per
pair.

### BUFFER0.LBX

Items 143–147 are 31×31 raw frames. Their extra 3 bytes are the §3.3
padding, not damage.

---

## 9. Still unknown

- The palette of **OFFICER 277–343**.
- The **functional-colour modes** other than `F`, and how the game blends them.
- How **CMBTSFX 69–78** compose (§8): does the accumulation rule hold for
  them, or does the game treat their index-0 writes as erasing?
- What **`0x2000`** does in the game, given that compositing does not depend
  on it, and how `leadin` drives playback.
- What **`0x0400`** clears to in the game.
- The role of **RACESEL item 0**, given that it carries no palette.
- Per-item palettes in most uncatalogued archives (BEAMS, COMBAT, SYSDISP,
  SCORE, NEWGAME, INSTALL, LOADSAVE, …) can be chosen by eye, but nothing
  checks them: there are no game captures or hashes for them.

---

## 10. Checking a decoder against liblbx

liblbx's `tests/moo2data.at` lists MD5s of 14 decoded frames. A decoder that
reproduces them handles the frame grammar, raw frames, accumulation,
external palettes, sibling overrides and embedded palettes correctly.

How the hashes are made: `lbximg -F pam -df <archive>.<item>`, with
`-p fonts.lbx.NNN` for the external palette and `-O <archive>.NNN` for the
override. The hash covers the **pixel bytes only, not the PAM header**. With a
palette, PAM keeps the raw **6-bit** components (`MAXVAL 63`), so do not scale
to 8 bits first. An image with any transparent pixel gets a fourth byte: 63
where drawn, and `0 0 0 0` where not.

| Item | Palette | Frames | MD5 |
|---|---|---|---|
| LOGO 0 | embedded | 0 | `e51c564aa638dc62dd1fd79e6f6cc375` |
| LOGO 1 | embedded | 0, 30, 63 | `13a60ede277eebe8fec69f03c5cb5843`, `c687fc35b940d0bfdaea5b6d51aa03c4`, `7c694409997fe15272abe71f3fea2759` |
| MAINMENU 21 | embedded | 0 | `848e33a0addc6e9acdc4fee6cbd56639` |
| MAINMENU 7 | FONTS 6 | 0 | `f301ffcc1a2faa3a0aa68514784012ec` |
| MAINMENU 0 | FONTS 6 | 0, 15, 49 | `7c3b347e03d42cd7bd1597f9dd58594e`, `2a66f4c30ca315cc061606b27cef4adf`, `848e33a0addc6e9acdc4fee6cbd56639` |
| MONSTER 7 | FONTS 4 + override 14 | 0, 5, 19 | `35d32459bfce6b19df14cafd2faf398b`, `924fafdc83e0414331e0c627c3f9b3c7`, `272ca2d13132a1b0497e47225ee680e2` |
| STARBG 9 | FONTS 5 (raw frame) | 0 | `3b6ccbe3fc46e13c1fa80edf611d7a62` |
| SHIPS 42 | FONTS 12 + override 49 | 0 | `4ababc13ae860494d4f512f8ebeca834` |

The later frames of LOGO 1, MAINMENU 0 and MONSTER 7 are the ones that fail
if frames are decoded on a blank canvas.

---

## 11. References

- **Nick Bowler, `liblbx`** — library and tools for MoO2 data files:
  `doc/txt/moo2-data.txt` (palette assignments, overrides, the uncatalogued
  list), `doc/txt/image-format.txt`, the decoder in `src/image.c` and
  `src/lbximg.c`, and the reference hashes in `tests/moo2data.at`.
  <https://git.draconx.ca/gitweb/liblbx.git>. This is not the GitHub project of
  the same name (`MarcoKull/liblbx`), which has neither the data notes nor the
  test suite.
- **Wolverine**, MoO2 graphics format: the header, flag bits, internal
  palette layout, FONTS/IFONTS, and the SHIPS palette holders. Reposted at
  <https://masteroforion2.blogspot.com/2008/04/moo2-graphics.html>, crediting
  Grig de Griz for help cracking the format; TAlchemist's comment there
  covers the junction flag.
- **Shikadi ModdingWiki**, the LBX container:
  <https://moddingwiki.shikadi.net/wiki/LBX_Format>.
- A Python implementation of everything above, including a test against the
  §10 hashes, is in the repository that hosts this document: `tools/lbx.py`,
  `tools/extract_moo2.py`, `tools/tests/moo2_reference.py`.
