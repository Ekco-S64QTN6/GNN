# Master of Orion 2 (MoO2) Graphics & Palette Format Deep Dive

**Audience:** Modders, reverse-engineers, and developers building asset extractors for *Master of Orion 2* (1996). 

This document serves as a definitive reference for the MoO2 `.LBX` graphics format, focusing specifically on the notoriously difficult palette and color-indexing system. It separates community-documented facts from proprietary reverse-engineering discoveries made during the development of the GNN broadcast engine.

---

## 1. The External Palettes: FONTS.LBX and IFONTS.LBX

MoO2 does not store a single universal 256-color palette. Instead, the game relies on external palette files:
*   **`FONTS.LBX`**: Contains the primary 256-color palettes (Indices 1 through ~13+).
*   **`IFONTS.LBX`**: Contains UI and interface-specific palettes (Indices 1 through ~4+).

*Note: Item 0 in both files is font data, not a palette. External palette scanning must start at index 1.*

By default, most images in the game use **FONTS:1**. However, many archives use different palettes for different screens. 

### The Community Source of Truth
The vast majority of the known archive-to-palette mappings are not our original research. They were documented by the community, most notably in **Nick Bowler's `liblbx`** project, specifically the file:
**`liblbx/doc/txt/moo2-data.txt`** (or `moo2-data.txt`)

Other community sources include Wolverine's 2007-2008 Orion Nebula research and the 1.50 Unofficial Patch Project.

---

## 2. The Three Types of Embedded Palettes

The primary source of extraction bugs is that MoO2 images can carry their *own* color information. There are three distinct mechanisms for this:

### A. Standard Internal Palettes (Flag `0x1000`)
If the image header has the `0x1000` flag set, the image contains a "patch" palette. 
*   **The Catch:** A standard parser assumes this palette is stored immediately *after* the frame offset table and *before* the pixel data. 
*   **The Bug:** In some archives (e.g., `OFFICER`), the game developers stored the palette *after* the pixel data. Strict parsers will fail to find it unless overridden to scan the whole item chunk.

### B. Sibling Palettes (The "S" Tiles)
In some archives, the correct palette is not stored in the image itself, but in **another item (a sibling)** within the same `.LBX` file. 
*   **DIPLOMAT:** The palette for items 13-38 is actually stored in items 0-12.
*   **RACES:** The palette for the portraits (items 32+) is stored in item 0.
*   **How to resolve:** The extractor must merge the sibling's embedded palette over the base FONTS/IFONTS palette. (e.g., `SIBLING:0`).

### C. Palette Holders (The "RUN" State)
Some archives use tiny 1x1 or 2x1 images as "palette holders" (often with 8 frames, though the color data is repeated). As the game engine loads the `.LBX` sequentially, it merges the palette of these holders into the *currently active* palette.
*   **The implication:** An item's color depends on its **position in the file**. If you extract item 70 in isolation using `FONTS:1`, it will be wrong if item 68 was a palette holder.
*   **CMBTSFX (Item 68):** Item 68 is exactly this. It is a 2x1 image with `Flags: 0x1000` and 8 frames. It acts as a palette holder for items 69 and above.
*   **CMBTPLNT (Backward Propagation):** Items 0-4 use the default palette (green blobs). Item 5 is a palette holder. Items 6+ inherit item 5's palette and look correct. To fix items 0-4, you must force the extractor to apply item 5's palette *backwards* (using `SIBLING:5` in your map).

---

## 3. The 6-Rule Priority Resolution

To extract an image correctly, your tool must resolve the palette using a **Base Selection + Additive Merge** model. It is *not* a simple "first match wins" list.

### Step 1: Base Selection (Pick One)
The engine first selects the base palette for the item:
1.  **`_item_split`**: Hardcoded archive ranges (e.g., `GAME` menus vs. main menu).
2.  **External Override**: Specific per-item FONTS or IFONTS assignments (e.g., `FONTS:4`).
3.  **Running Palette State**: The accumulated palette-holder state up to this item's index in the archive.
4.  **Archive Default**: The fallback from `moo2-data.txt` or `FONTS:1`.

### Step 2: Additive Merges (Apply in Order)
Once the base is selected, the engine merges the following on top of it:
1.  **Sibling Override Chain**: Merging a named sibling item's internal palette (e.g., `_palette_overrides`).
2.  **Item Override Chain**: Merging a specific sibling item's palette (e.g., `_item_overrides`).
3.  **Item's Own Embedded Palette**: The patch stored inside the image (Flag `0x1000`).

---

## 4. Notorious Archives & Discoveries

During the development of the GNN extractor, several specific archives required brute-force testing or specialized code.

### OFFICER.LBX (The Duplicate Bug)
*   **Items 0–276:** Use standard palettes (mostly `FONTS:2`).
*   **Items 277–342:** Use `FONTS:4` or `IFONTS:3`.
*   **CRITICAL DISCOVERY:** The file header declares **344 items** (indices 0 through 343). However, items 143–343 are **duplicate leader portraits** of items 21–87. 
*   **Binary Proof:** Items 51, 143, 307, and 343 are all exactly `7244` bytes and `73x88` pixels. However, their MD5 hashes differ, and items 143+ have their internal palette flags stripped (`0x0`). This indicates the developers appended a second, corrupted batch of portraits (likely during a patch) without correctly rebuilding the palette headers. 
*   **The Fix:** The higher-numbered items are impossible to extract cleanly because the pixel data points to corrupt indices. The correct solution is to **skip extracting items 143+ entirely**; the game engine uses the intact lower-numbered versions (21–87).

### CMBTSFX.LBX (Functional colors, fill-background images, and palette state)

#### 1. Explosions & Energy Effects (`0x0800`)
Items flagged with `0x0800` (e.g., 9-67) are **not** standard color images. Their pixel values (Hex `F1`-`FF`) represent an **intensity mask** (1-15). 
*   **The Fix:** These are extracted using a synthetic heat gradient (Dark Red -> Orange -> Yellow -> White) with an alpha curve. The low nibble (`v & 0x0F`) is normalized from `0.0` to `1.0`. This perfectly reconstructs the additive blending the game engine used.

#### 2. Shields/Beams (`0x0400` Fill Background)
Item 08 is a 308x39 energy beam/shield that uses palette indices `161`-`175`. It appears black under the default archive palette. Item 68 is a 2x1 palette holder that patches exactly this range.
*   **The Fix:** An `_item_overrides` entry (`"8": 68`) forces Item 08 to use Item 68's embedded palette, revealing the correct pink/magenta energy effect.

#### 3. Palette Holders (Multi-Frame)
Item 68 is a 2x1 image with 8 frames. Standard palette-holder detection requires `nframes == 1`, which caused the extractor to skip it.
*   **The Fix:** Update `is_palette_holder()` to accept tiny images regardless of frame count. Item 68 correctly patches the running palette for subsequent items.

#### 4. Smoke & Dust Trails (Standard Palettes)
Items 69-78 (flags `0x0000`) are the lingering smoke and dust clouds left behind after an explosion. Their pixel indices are low (0-50), which correctly map to greys and whites in `FONTS:4`. 
*   These are extracted normally. Their sparse, black/white appearance is correct; they are meant to be overlaid on top of a damaged `MONSTER` or `SHIPS` sprite.

### COUNCIL.LBX
*   **Item 0** acts as the master palette holder. Its embedded palette must be applied to items 0–196. The previous community range was 0–23, which left most of the archive rendering as chromatic noise.

### BEAMS.LBX, COMBAT.LBX, RACES.LBX
*   Previously unknown to the community, these archives were brute-forced item-by-item to find the correct external palette assignments. `RACES` requires `SIBLING:0` for most of the portraits.

---

## 5. Decoding MoO2 Frame Headers (Flags)

When inspecting the `u16 flags` at offset `0x0A` in the MoO2 item header:
*   **`0x0100` (RAW):** The frame is uncompressed `w * h` row-major data. It is padded to a 4-byte boundary.
*   **`0x0400` (FILL_BACKGROUND):** Indicates the image is meant to be drawn over a solid background rather than transparently. Found on `CMBTSFX` items 7 and 8.
*   **`0x0800` (FUNCTIONAL_COLOR):** Used for special effects (explosions, beams). The palette indices are an **intensity map**, not color lookups. High nibble is `F`, low nibble is `1`-`F` (intensity 1-15).
*   **`0x1000` (INTERNAL_PALETTE):** The item contains its own color patch. If the item is tiny (1x1, 2x1), it acts as a sequential palette holder for items that follow it (e.g., `CMBTSFX` item 68).
*   **`0x2000` (JUNCTION):** The item is a delta frame. It only contains the pixels that changed from the previous frame. It must be composited over the previous frame buffer.

---

## 6. References

If you are building a deep extractor, you must stand on the shoulders of these giants:

*   **`liblbx` (Nick Bowler):** [github.com/MarcoKull/liblbx](https://github.com/MarcoKull/liblbx) — Specifically `doc/txt/moo2-data.txt`, which contains the master list of palette assignments and item splits.
*   **Wolverine's Orion Nebula Research (2007-2008):** The original source for the COUNCIL override rule and SHIPS palette-holder mechanics.
*   **Master of Orion II Online Blog:** [masteroforion2.blogspot.com/2008/04/moo2-graphics.html](https://masteroforion2.blogspot.com/2008/04/moo2-graphics.html) — Reproduced the community graphics format write-up.
*   **Shikadi ModdingWiki:** [moddingwiki.shikadi.net/wiki/LBX_Format](https://moddingwiki.shikadi.net/wiki/LBX_Format) — LBX container specifications.
*   **The 1.50 Unofficial Patch Project:** `moo2mod.com` / CivFanatics MoO2 Modding threads.
