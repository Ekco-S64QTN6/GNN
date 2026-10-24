# GNN — repository audit, verified

**Checked:** 2026-10-24, against `main` at `17b28f0` and a local build with
the game files present. Every row below was run or read, not inferred.

This replaces `Gemini_Report.md` (2026-10-22), which was a source-only
snapshot ("did not run the offline suite, re-extract … or observe a live
broadcast"). Its items are kept here, each with a verdict. Current state lives
in [CLAUDE.md](../CLAUDE.md); the backlog is in [ROADMAP.md](ROADMAP.md); the
MoO2 format findings are in [MOO2_GRAPHICS_DEEP_DIVE.md](../MOO2_GRAPHICS_DEEP_DIVE.md).

---

## 1. The earlier report's "confirmed fixes"

| Claim | Verdict | Evidence |
|---|---|---|
| TTS prefetch promotion keeps the live request's sequence ID | **True** | `js/tts.js`: `fetchClip()` calls `start(seq)` with the live `seq` on a queued prefetch |
| TTS diagnostics opt-in via `gnnTtsDebug` | **True** | `js/tts.js` reads `localStorage.gnnTtsDebug === '1'` |
| `scan_strays.py` uses the exported 0x12 / 0x0C header constants | **True** | imports `MOO1_HEADER`, `MOO2_HEADER` from `lbx.py` |
| `renderer.js` probes a 5×5 alpha neighbourhood in `measureHole()` | **Present but broken — fixed** | The probe read `w`, `h` and `data`, none defined in that function. Every call threw a ReferenceError, `frameFor()`'s `catch` swallowed it, and the generated monitor bezel never drew from 20 Oct (`82f6949`) on; the drawn fallback border aired instead. Fixed to `im.width`, `im.height` and `a`; run on both real bezels: openings 0.077–0.923 × 0.133–0.836 and 0.10–0.90 × 0.148–0.817 |
| `server.py` expires old ledger entries on load | **True** | `_load_ledger()` calls `_expire_ledger()`; the block comment above it still said entries were never expired — rewritten |
| Feed token cache clears above 5,000 | **True** | `js/feed-manager.js` |
| OFFICER 277+ map entries removed; extractor skips 143+ as a "corrupt duplicate" range | **The skip was wrong — fixed** | 143–343 are three re-indexed copies of the 67 leader portraits (21–87), not corrupt: each copy's pixels map from the original's indices 97–100% deterministically. 143–209 decode under FONTS 1, 210–276 under FONTS 2. Only 277–343 fit no palette. The extractor now skips 277+ only |
| Functional-colour rendering, multi-frame palette holders | **True** | `render_functional_rgba()`; `is_palette_holder()` tests size, not frame count (CMBTSFX 68 has 8 frames) |
| Weather-map assets present, route wired | **True** | `weather_map.png`, `weather_map_02.png`; `GENERATED.weather` in `cutscene-manager.js`. On-air look still unchecked |

## 2. The earlier report's open items

| Item | Verdict now |
|---|---|
| Palette verification; "RACES 32–45 remain a known excluded/unpooled problem area" | **Palette review is still open; the RACES part is false.** RACES 32–44 render correctly (45 is the "?" random-race tile) and 32–44 are in the sprite pool |
| COLONIES 02–03 "excluded by `COLONIES_SCRAMBLED`" | **`COLONIES_SCRAMBLED` does not exist.** The two items stayed off air only because no query names COLONIES (the other 26 decode cleanly). Now in `STATIC_DENY` |
| No reference-output testing | **Closed.** liblbx's test suite (`tests/moo2data.at`) carries MD5s for 14 decoded frames. `tools/tests/moo2_reference.py` reproduces all 14 byte for byte, and it found a real decoder fault (§3) |
| Narrative text admission narrow | **Still open**, by design (ROADMAP §4.4) |
| No automated MoO2 music render | **Closed.** `tools/extract_music_moo2.py` writes the same 17 OGGs the station plays (file set and durations identical). It replaces `dump_stream_lbx.py`, which saved STREAM.LBX's WAVs with a `.smk` extension |
| Test scripts hard-code `/home/ekco/github/GNN` | **Closed.** 26 scripts now find the repo from their own path; the offline checks pass from a relocated copy |
| Generated art, unused footage segments | **Still open** (ROADMAP §5) |
| Weather cutaways need an on-air look | **Still open** |
| MoO1 composite scene review after the decoder fix | **Still open** |

## 3. Found in this audit

- **MoO2 animations decoded wrong.** `lbx.py` started every frame of an
  animation on a blank canvas unless flag `0x2000` was set. liblbx draws
  every frame over the previous frame's pixels and restarts only the
  coverage, every `chunk` frames (header byte 9) or every frame under
  `0x0400`. Our old decoder matched liblbx's hashes on first frames only.
  Fixed: 14/14 hashes match, with unit tests that fail on the old decoder.
- **Most of the local MoO2 build predates the current extractor.** 230 of the
  320 per-archive outputs were written on 16 Oct by an earlier extractor: no
  measurements, `pools: []`, and in some archives a different base palette
  from the map (GAME 1 vs 5, BLDG4 6 vs 2, TANM_* 1 vs 2). Nothing in them
  had been on air. **Regenerated** with the fixed decoder. Every item that
  would newly reach air was contact-sheeted first, which caught colony
  menus passing the broll gates (now `UI_ARCHIVES`) and 44 clean
  tech-animation objects scored as glitch noise (glitch gate now needs
  coverage ≥ 0.08). After that only whole CMBTSHP ships and six BEAMS
  sprites are new to air. Local build: 7,291 items, 34,549 frames, 0
  duplicate ids; verifier, manifest and boot line agree.
- **CMBTSFX 69–78** (smoke) build into a solid black disc under the new rule;
  the hashes cannot settle it. Denied pending an answer.
- **BUFFER0's 155 "bad" frames** were a stale warning kind
  (`raw_frame_size_mismatch`) from before the 4-byte raw padding fix;
  re-extracted, 0 warnings.
- **liblbx is not at `github.com/MarcoKull/liblbx`.** That is a different
  project with no `moo2-data.txt`. Nick Bowler's is at
  `git.draconx.ca/gitweb/liblbx.git`. Fixed in every document.
- **`moo2-data.txt` holds no hashes**; the hashes are in liblbx's test
  suite. It covers about 14 archives, not "17 plus 3 splits", and lists
  COUNCIL, CMBTSFX, OFFICER, DIPLOMAT, RACES, CMBTPLNT and EVENTS only as
  uncatalogued. The COUNCIL item-0 rule is ours, not Wolverine's: his
  write-up does not mention COUNCIL.
- **`palette_map.json`'s RACESEL chain `{"0": 0}` did nothing**: item 0 has
  no internal palette, and a chain from an item to itself is skipped.
  Replaced with a note.
- **STREAM.LBX items 0, 7 and 9** (and STREAMHD 0) are a 22-byte text,
  "cats rule dogs drool", not audio. We found no published mention of it.
- **CLAUDE.md §1's pool counts were stale** (MoO2 61 / 609 / 83 / 142).
  Recounted after the deny list.
- `tools/tests/links.py` read misaki phoneme markup as links and only
  checked three files; it now checks every tracked Markdown file, skips
  code, exits non-zero, and runs in `offline.sh` and CI.

## 4. Housekeeping

- `Gemini_Report.md` → `docs/Claude_Report.md`;
  `MOO2_GRAPHICS_DEEP_DIVE.md` stays at the repository root, where searches for MoO2 LBX extraction find it.
- Retired: `tools/dump_stream_lbx.py` (→ `extract_music_moo2.py`),
  `tools/probe_sound_moo2.py` (format probe, superseded by
  `extract_sound_moo2.py`), `tools/tests/docshots.py`, `two.py`,
  `shots2.py` (→ `capture_gallery.py`), `compose2.py` (one-off), and the six
  `docs/*.png` screenshots only those scripts wrote.
- `offline.sh` and CI run `links.py`; `offline.sh` runs `moo2_reference.py`
  (it skips without the game files, which CI does not have).

## 5. How this was checked

```bash
tools/tests/offline.sh                    # PASS
python3 tools/tests/moo2_reference.py     # 14/14 frames match liblbx
python3 tools/tests/links.py              # 0 broken links
python3 tools/verify_assets.py            # every runtime path resolves
```

On a test station (port 8091): the bezel draws (brass, THE SPOTLIGHT); a
90 s drive raised 0 exceptions. Not checked: the owner's own station, and a
commercial break showing the regenerated ships.
