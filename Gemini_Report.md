Here is the exact, up-to-date list of what remains open. You can save this as `OPEN_ITEMS.md` or paste it into your project management tool.

I have excluded everything you just fixed (TTS sequence, `scan_strays.py` imports, MoO2 functional colors, palette holders, trailer gitignore, and the `PROJECT.md` truncation).

***

```markdown
# GNN — Open Items & Remaining Work

**Status as of October 2026 (Post-Merge)**

This document tracks the remaining bugs, technical debt, and unimplemented features from the various system audits.

---

## 🚨 P1: High Priority (Next Session)

### 1. `js/renderer.js` — Fragile `measureHole()` Probe
- **The Issue:** The function to find the transparent window in the studio bezel probes the exact center pixel `(cx, cy)`. If a reticle, watermark, or compression artifact makes that single pixel opaque, the entire rendering falls back to a solid rectangle, breaking the window.
- **The Fix:** Modify the `at(x, y)` function inside `measureHole()` to probe a 5x5 grid around the center and return the minimum alpha value.

### 2. Add Reference-Pixel Tests for MoO1 & MoO2
- **The Issue:** The extraction code is structurally brilliant, but it is **evidentially unverified**. There are no unit tests that compare our RGBA output against a known-good community reference.
- **The Fix:** Pick 5–10 items from `liblbx/moo2-data.txt` that have reference hashes. Add a test to `tools/tests/test_moo2_tools.py` that checks our extracted pixels against those known-good hashes.

### 3. `tools/tests/` — Hardcoded Paths
- **The Issue:** Over 25 test scripts hardcode `sys.path.insert(0, '/home/ekco/github/GNN/tools')`. This will fail on any other machine or CI environment.
- **The Fix:** Replace the hardcoded strings with `os.path.dirname(os.path.abspath(__file__))` to dynamically resolve the root.

---

## ⚠️ P2: Medium Priority (Asset & Polish)

### 4. Unconditioned Weather Cutaways
- **The Issue:** `weather_map.png` and `weather_map_02.png` exist in `assets/generated/cutaways/` as raw 2+ MB files. They have not been conditioned to 256-color plates.
- **The Fix:** Run `python3 tools/condition_plates.py` and wire the resulting assets into the `GENERATED` dictionary in `js/cutscene-manager.js`.

### 5. Dead Code in `palette_map.json`
- **The Issue:** `palette_map.json` contains `_item_palettes` overrides for `OFFICER` items 277–343. However, `extract_moo2.py` now skips extracting `OFFICER` items 143+ entirely because they are corrupted duplicates. These map entries are dead code.
- **The Fix:** Remove the `OFFICER` entries from `_item_palettes` in `palette_map.json`, or add a comment noting they are unreachable.

### 6. MoO2 Cinematics Are Decoded But Unread
- **The Issue:** `extract_moo2_video.py` successfully decoded nine Smacker videos (intro, endings, planet destruction) into `assets/cutscenes/moo2_video/`. However, nothing in `js/` references them yet.
- **The Fix:** Expose them via the asset registry as animated `single()` scenes, and route them through `js/cutscene-manager.js` for the `anomaly` or `fleet` blocks.

### 7. Title-Card Prompts Are Incorrect
- **The Issue:** The fallback for title cards is currently just a `_standing.png` per character over a set plate.
- **The Fix:** Update the prompts in `assets/generated/Prompts/` for `titlecards/` to generate proper show bumpers.

### 8. `assets/generated/icons/` Partially Populated
- **The Issue:** The story icons are regenerating, but the folder is not fully populated yet.
- **The Fix:** Run the generation and conditioning pipeline for the remaining icons.

---

## 🔧 P3: Low Priority (Hygiene & Edge Cases)

### 9. `server.py` — Ledger Pruning on Boot
- **The Issue:** `_expire_ledger()` is only called during a PUT request. A read-only server session will hold stale ledger records in memory indefinitely.
- **The Fix:** Call `_expire_ledger()` inside `_load_ledger()` during server initialization.

### 10. `js/feed-manager.js` — High Token Cache Ceiling
- **The Issue:** `tokenCache` holds up to 60,000 entries before clearing. A 24/7 kiosk does not need this much GC pressure.
- **The Fix:** Lower the ceiling to 3,000–5,000 entries.

### 11. `feed-manager.js:calculateImportance()` Suspect Regex
- **The Issue:** A reported issue suggests the regex used to calculate story importance might have a bug (reported, not yet confirmed against the file).
- **The Fix:** Verify the regex against known headlines.

### 12. `js/cast.js` — Robot Entry Review
- **The Issue:** The `robot` entry in `cast.js` still reads as MoO1-lineage. It needs a review to decide if he stays seatable (`SHOW_PAIRS` block 4 seats `sakkra` + `robot`).

---

## 🌐 Content & Lore Separation (Owner Request)

### 13. MoO1 Lore and Real News Still Mix
- **The Issue:** `PACE.wireShare` interleaves sector bulletins with real stories, and the banter templates have not been audited for in-universe terms applied to real headlines.
- **The Fix:** Separate the two completely. Commercials are in-universe by design and should remain untouched.

### 14. Twelve Show Logos and Nothing Loads Them
- **The Issue:** `assets/generated/logos/` holds one logo per show plus `galaxy_shop` and `main_desk`, but no code actually draws them.
- **The Fix:** The network promos now name each show; add the logo to the promo card.

### 15. Two COLONIES Items Decode Scrambled
- **The Issue:** `COLONIES` `item_02` and `item_03` decode with a scattered-pixel sky.
- **The Fix:** Keep them excluded via `COLONIES_SCRAMBLED` in `scene-compositor.js`, or attempt a new palette extraction.

### 16. `capture_docs.py` Hangs on 429
- **The Issue:** The script hangs when RSS feeds return a 429 (Too Many Requests), waiting for live states.
- **The Fix:** Drive the director instead (enqueue, then force states).
```