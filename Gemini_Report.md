# GNN — Repository Audit Status

**Snapshot date:** 2026-10-22  
**Code snapshot:** main through commit 82f6949 (2026-10-20)

This replaces the earlier checklist, which continued to list several fixes as
open after they had landed. It is a source-review snapshot, not a claim that
the station was launched or every generated asset was visually inspected
during this documentation pass.

Authoritative status lives in [CLAUDE.md](CLAUDE.md), the
[roadmap](docs/ROADMAP.md), and the
[asset-pipeline reference](tools/PROJECT.md). This file is only a concise
audit cross-check.

## Confirmed fixes in the current code

- The TTS prefetch promotion preserves the live request's sequence ID.
- TTS console diagnostics are opt-in through the `gnnTtsDebug` local-storage
  flag; normal broadcasts do not emit the boot-race diagnostics.
- `tools/scan_strays.py` imports the exported MoO1/MoO2 header constants and
  uses the 0x12-byte and 0x0C-byte graphics headers.
- `js/renderer.js` probes a 5×5 alpha neighborhood in `measureHole()`, rather
  than trusting one center pixel.
- `server.py` expires old ledger entries when loading the ledger, including a
  read-only startup.
- `js/feed-manager.js` clears its token cache above 5,000 entries, not 60,000.
- Unreachable OFFICER palette-map entries for items 277+ were removed; the
  extractor skips the known corrupt duplicate range from item 143 onward.
- MoO2 functional-colour rendering and multi-frame palette-holder detection
  are implemented in the graphics extractor.
- The weather-map assets are present and the weather cutaway route is wired.
  Visual quality and conditioning still need an actual render/on-air check.

## Still open or requiring evidence

- **Palette verification:** remaining first-pass MoO2 palette assignments
  still need visual review. The current review queue is not proof that every
  palette is correct; RACES items 32–45 remain a known excluded/unpooled
  problem area. MoO1 COLONIES items 02–03 still have scattered-pixel skies and
  remain excluded by `COLONIES_SCRAMBLED` in `scene-compositor.js`.
- **Reference-output testing:** the MoO2 unit tests build synthetic LBX data.
  They do not yet compare a broad set of extracted pixels against
  community-reference hashes or game captures.
- **Narrative text:** extraction and merge tools exist, but runtime text
  admission remains deliberately narrow. Classifying narrative records before
  widening the runtime allowlist is still open.
- **MoO2 music sources:** SOUND.LBX SFX extraction is implemented. A complete
  automated decoder/render path for the remaining MoO2 music source formats
  is not; `build_audio.py` indexes OGGs already present under
  `assets/audio/music/moo2/`.
- **Workstation-specific diagnostics:** several `tools/tests/*.py` scripts
  still hard-code `/home/ekco/github/GNN/tools` or absolute asset/doc roots
  (for example `breakcheck.py`, `breakedges.py`, `ceiling.py`, `cinecheck.py`,
  `compare.py`, `compose2.py`, and `docshots.py`). Refactor paths from each
  script's location and verify on a relocated checkout before claiming these
  diagnostics are portable.
- **Generated art / archive footage:** title-card polish, unused standing art
  and logos, and unused MoO2 cinematic segments remain content-selection or
  on-air verification work. See ROADMAP §5.
- **Weather cutaways:** assets and routing have landed; inspect their actual
  on-air size and appearance before closing the validation item.
- **MoO1 composite scene review:** regenerate the review output after the
  decoder fix before attributing old delta-frame artifacts to the current
  extractor.

## Verification boundary

This report was prepared from GitHub source and commit history only. It did
not run the offline suite, re-extract the user's local game archives, compare
pixels against reference output, or observe a live broadcast. Treat local
asset counts and on-air behaviour as unverified until those checks are run.
