
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

**The CMBT* archives were changed from palette 3 to 1.** The previous value
was a first-pass guess from before the community data was available and
rendered as solid green blobs. Palette 1 was confirmed by visual inspection.

### 4.7 Per-item palettes, and IFONTS per item

Archive-level assignments are right or close (`scan_moo2_quality.py`: 0
archives above 40% collapse). The remaining faults are single items whose
colours come from a different palette than their siblings', which the owner
reports at around one in five in the affected folders.

`palette_map.json` takes a **palette reference** anywhere it takes a palette:
a plain integer keeps its old meaning (an item of the run's
`--palette-archive`, FONTS by default), and `"IFONTS:3"` / `"FONTS:3"` name
the source explicitly. Before this, IFONTS was one switch for a whole run, so
an archive mixing the two could never come out right. Parsed by
`extract_moo2.parse_palette_ref()`.

```json
"_item_palettes": { "CMBTPLNT": { "30": "IFONTS:4" }, "SHIPS": { "42": 12 } }
```

**These are settled by eye, not computed.** Two automatic pickers were built
and validated against the six archives whose palettes are known — 0 of 6
each (see `CLAUDE.md` §3). The workflow is:

```bash
python3 tools/palette_review.py            # page of pooled outliers
xdg-open tools/palette_review/index.html   # each row: ON AIR, then every palette
python3 tools/palette_review.py --apply ~/Downloads/palette-picks.json
python3 tools/extract_moo2.py --only <the archives it names>
python3 tools/merge_moo2_manifests.py
```

The ON AIR tile is the extracted frame from disk, not a render: archives that
build colours from **palette holders** (SHIPS is the main one) cannot be
previewed faithfully by rendering one item in isolation, and a pick on such
an item replaces the holder colours for it. Those rows are sorted last and
marked. §4.6's warning applies too: two palettes can render one sprite
identically, so a plausible tile is not proof.

---

## 5. The tools folder

| File | What it does |
|------|--------------|
| `lbx.py` | Container reader + frame decoder for both games. The delta-frame and palette-merge fixes are here. |
| `extract_all.py` | MoO1 extraction. `FORCE_TRANSPARENT_*` sets and `archive_palette()` live here. |
| `extract_moo2.py` | MoO2 graphics extraction. Palette map, per-item overrides, IFONTS. Includes real pool assignment. |
| `extract_moo2_text.py` | NUL-delimited string tables from MoO2 text archives and `.EXE` string sweeps. |
| `extract_sound_moo2.py` | Extracts the 68 native WAVs from `SOUND.LBX`. |
| `extract_moo2_video.py` | Decodes Smacker video (`INTRO.LBX`, `*FIN.LBX`) to PNG frames via `ffmpeg`. |
| `extract_text.py` | MoO1 text (EVENTMSG, NAMES, HELP, ORION.EXE). |
| `build_audio.py` | Profiles SFX and renders music for both games, emitting `audio-manifest.json`. |
| `merge_moo2_manifests.py` | Idempotently folds the MoO2 graphics into `gfx-manifest.json`. |
| `merge_moo2_text.py` | Merges MoO2 text archives and EXE strings into `moo2-strings.json`. |
| `dump_stream_lbx.py` | Extracts the raw audio streams from `STREAM.LBX`. |
| `palette_map.json` | MoO2 archive → FONTS/IFONTS palette index. Includes the verified reference cases. |
| `palette_compare.py` | Renders one MoO2 sprite across every external palette. |
| `scan_moo2_quality.py` | Scans manifests to flag graphics that collapsed to solid blobs (bad palette). |
| `moo2_probe.py` | Byte-level LBX inspection. The fastest way to see what an archive actually holds. |
| `scan_strays.py` / `scan_all.sh` | Gap scan. Reports unreferenced regions and any header-like reads inside them. |
| `condition_plates.py` | Generated-art pipeline. Defringe, downscale on premultiplied alpha, quantise. |
| `prompt_bridge.py` | Emits generation prompts for the gaps the MOO1 catalogue can't fill. |
| `key_robot.py` | Cuts the MOO1 robot cel out of his newscast scene. |
| `verify_assets.py` | Confirms every runtime asset path resolves. Run before shipping. |
| `drive.py`, `capture_gallery.py`, `audio_probe.py`, `voice_audition.py` | Diagnostic harnesses for the broadcast runtime. |
| `app_window.py` | Native GTK/WebKit window wrapper for the station. |
| `test_human_anchor.py` | Anchor conditioning diagnostic. Tuning aid, not part of the pipeline. |
| `show-editor.html` | Editor for `assets/generated/show-config.json`. |
| `scene_review.html` | Recipe preview + deny-flag UI. |
| `studio_review.html` | Desk-line tuner for the ten generated studio sets. |
| `interview_tuner.html` | Slider tuner for the EMBASSY composition. |
| `commercial_review.html` | Previewer and slot tuner for commercial breaks and infomercial product placement. |

---

## 6. What's left

### 6.1 MoO2 text runtime wiring — done

`asset-registry.js` fetches `assets/moo2-strings.json` on init and merges
its pools with MoO1's (verified 2026-10-16).

### 6.2 MoO2 video runtime wiring

`assets/cutscenes/moo2_video/` holds decoded PNG frames for the intro and
endings. Nothing reads them. Wiring them in means exposing them through the
asset registry as an animated `single()` scene, and adding routes to the
cutscene manager so `convoy` or `interview` can draw from the intro.

### 6.3 MoO1 in the runtime

The decoder is verified at the frame level, but the missile-in-GNN test
hasn't been re-run since the fixes landed. Load the station, trigger a
combat cutaway, and watch a missile animation end to end. If it moves
cleanly from A to B with no trail, MoO1 is done.

### 6.4 Optional

- **Validate MoO2 ship colours** against `liblbx` output. Reference cases
  are already in `palette_map.json`.
- **`IFONTS.LBX` on more archives.** Only `PLNTSUM` tested as an archive;
  per item, see §4.7 and `tools/palette_review.py`.

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
| 2026-10-16 (MoO1 fixes) | Delta-frame inheritance fixed. Palette merge fixed. Opaque-zero rule with SPIES/EMBASSY exclusions. VORTEX palette diagnosis. Deny list built. |
| 2026-10-16 (complete MoO2 pull) | CMBT* palettes fixed. MoO2 SFX extracted (68 WAVs). MoO2 Music extracted (17 OGGs). MoO2 video decoded (Smacker -> PNG). Full text extraction (all archives + EXEs). Palette section in this document rewritten. |
