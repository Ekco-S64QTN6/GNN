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
*   **How to resolve:** The extractor must merge the sibling's embedded palette over the base FONTS/IFONTS palette.

### C. Palette Holders (The "RUN" State)
Some archives use tiny 1x1 or 2x2 images as "palette holders." As the game engine loads the `.LBX` sequentially, it merges the palette of these holders into the *currently active* palette.
*   **The implication:** An item's color depends on its **position in the file**. If you extract item 10 in isolation using `FONTS:1`, it will be wrong if item 5 was a palette holder.
*   **CMBTPLNT:** This is the prime example. Items 0-4 use the default palette (green blobs). Item 5 is a palette holder. Items 6+ inherit item 5's palette and look correct. To fix items 0-4, you must force the extractor to apply item 5's palette backwards.

---

## 3. The 6-Rule Priority Resolution

To extract an image correctly, your tool must resolve the palette in this exact priority order:

1.  **`_item_split`**: Hardcoded archive ranges (e.g., `GAME` menus vs. main menu).
2.  **External Override**: Specific per-item FONTS or IFONTS assignments (e.g., `FONTS:4`).
3.  **Sibling Override Chain**: Merging a named sibling item's internal palette (e.g., `DIPLOMAT`).
4.  **Running Palette State**: The accumulated palette-holder state up to this item's index in the archive.
5.  **Item's Own Embedded Palette**: The patch stored inside the image (Flag `0x1000`).
6.  **Archive Default**: The fallback from `moo2-data.txt` or `FONTS:1`.

---

## 4. Notorious Archives & Discoveries

During the development of the GNN extractor, several specific archives required brute-force testing or specialized code.

### OFFICER.LBX (The Duplicate Bug)
*   **Items 0–276:** Use standard palettes (mostly `FONTS:2`).
*   **Items 277–342:** Use `FONTS:4` or `IFONTS:3`.
*   **CRITICAL DISCOVERY:** The file header declares **344 items** (indices 0 through 343). However, items 143–343 are **duplicate leader portraits** of items 21–87. 
*   **Binary Proof:** Items 51, 143, 307, and 343 are all exactly `7244` bytes and `73x88` pixels. However, their MD5 hashes differ, and items 143+ have their internal palette flags stripped (`0x0`). This indicates the developers appended a second, corrupted batch of portraits (likely during a patch) without correctly rebuilding the palette headers. 
*   **The Fix:** The higher-numbered items are impossible to extract cleanly because the pixel data points to corrupt indices. The correct solution is to **skip extracting items 143+ entirely**; the game engine uses the intact lower-numbered versions (21–87).

### CMBTSFX.LBX (The Functional Color Trap)
*   **Flag `0x800` (Functional Color):** This is the most misunderstood archive in the game. Items with this flag (e.g., 9-13, 16-39, 52-67) are **not standard color images**. Their pixel values represent an **intensity mask** (how bright/hot the explosion is at that pixel), not a color index.
*   **The Trap:** If you extract these with a standard FONTS/IFONTS palette, you are mapping random intensity numbers (0-255) to actual colors. You will get green static, purple boxes, or solid black frames. 
*   **The Fix:** To view these correctly, you must either:
    1.  Map the indices to **Grayscale** (`{i: (i, i, i)}`), which reveals the true shape of the smoke/fire.
    2.  Map them to a **Synthetic Fire Gradient** (Dark Red -> Orange -> Yellow -> White) to simulate what the game engine draws at runtime with additive blending.

### COUNCIL.LBX
*   **Item 0** acts as the master palette holder. Its embedded palette must be applied to items 0–196. The previous community range was 0–23, which left most of the archive rendering as chromatic noise.

### BEAMS.LBX, COMBAT.LBX, RACES.LBX
*   Previously unknown to the community, these archives were brute-forced item-by-item to find the correct external palette assignments. `RACES` requires `SIBLING:0` for most of the portraits.

---

## 5. Decoding MoO2 Frame Headers (Flags)

When inspecting the `u16 flags` at offset `0x0A` in the MoO2 item header:
*   **`0x0100` (RAW):** The frame is uncompressed `w * h` row-major data. It is padded to a 4-byte boundary.
*   **`0x0800` (FUNCTIONAL_COLOR):** Used for special effects (explosions, beams). The palette indices are an **intensity map**, not color lookups. Must be rendered with a custom gradient or grayscale.
*   **`0x1000` (INTERNAL_PALETTE):** The item contains its own color patch.
*   **`0x2000` (JUNCTION):** The item is a delta frame. It only contains the pixels that changed from the previous frame. It must be composited over the previous frame buffer.

---

## 6. References

If you are building a deep extractor, you must stand on the shoulders of these giants:

*   **`liblbx` (Nick Bowler):** [github.com/MarcoKull/liblbx](https://github.com/MarcoKull/liblbx) — Specifically `doc/txt/moo2-data.txt`, which contains the master list of palette assignments and item splits.
*   **Wolverine's Orion Nebula Research (2007-2008):** The original source for the COUNCIL override rule and SHIPS palette-holder mechanics.
*   **Master of Orion II Online Blog:** [masteroforion2.blogspot.com/2008/04/moo2-graphics.html](https://masteroforion2.blogspot.com/2008/04/moo2-graphics.html) — Reproduced the community graphics format write-up.
*   **Shikadi ModdingWiki:** [moddingwiki.shikadi.net/wiki/LBX_Format](https://moddingwiki.shikadi.net/wiki/LBX_Format) — LBX container specifications.
*   **The 1.50 Unofficial Patch Project:** `moo2mod.com` / CivFanatics MoO2 Modding threads.
