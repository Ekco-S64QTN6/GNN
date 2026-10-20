# GNN Test & Diagnostic Suite

Standalone tools for testing, verifying and diagnosing the running GNN
station. Nothing in this folder is part of the shipped broadcast; every
script drives the station from outside, over CDP or HTTP, or manipulates
files under `assets/` without touching the runtime.

Every script that talks to a browser does so through
[`tools/drive.py`](../drive.py), which launches a headless Chromium,
attaches a CDP session, and reaps every process it started when it exits.

The station must already be running:

```
./start.sh --bg
```

Most scripts then run with `python3 tools/tests/<script>.py`.

---

## 1. Tests

| Script | Purpose | Usage |
|--------|---------|-------|
| `test_moo2_tools.py` | Unit tests for the MoO2 graphics pipeline. Palette patching, palette holders, override sequencing, NUL string splitting, text extractor output, forced-palette semantics, truncated-run diagnostics. Run this after touching `lbx.py` or `extract_moo2.py`. | `python3 tools/tests/test_moo2_tools.py` |
| `test_human_anchor.py` | Builds the anchor conditioning pipeline for one species from the raw source plates, writes the intermediates to `/tmp/`, and does not touch `assets/`. Use it when re-tuning the mouth-mask or head-region parameters in `condition_plates.py`. | `python3 tools/tests/test_human_anchor.py --species human --state listening` |

---

## 2. Anchor & plate diagnostics

| Script | Purpose | Usage |
|--------|---------|-------|
| `compare.py` | Side-by-side of a raw source plate against the tool's conditioned output, for a set of anchor species/states. Where the tool has introduced a visible artifact this is what shows it. | `python3 tools/tests/compare.py` |
| `try_landmarks.py` | Runs MediaPipe's face landmarker against every anchor's desk-hero plate and reports detection per species. Feasibility only; a Silicoid is a rock and a Klackon has mandibles. | `python3 tools/tests/try_landmarks.py face_landmarker.task /tmp/landmarks.png` |
| `prune.py` | Drops `gfx-manifest.json` entries whose frames no longer exist on disk, and corrects frame counts for entries that were partially deleted. Run after manually pruning `assets/cutscenes/`. | `python3 tools/tests/prune.py` |

---

## 3. Audio diagnostics

Every one of these taps `GNNAudio.getMasterBus()` or polls the animator
and prints measurements rather than deciding anything. Run one at a time;
they each install a `ScriptProcessor` and hold the CDP session.

| Script | Purpose | Usage |
|--------|---------|-------|
| `voicelevel.py` | Voice level per spoken line, tagged by the engine's own speaking flag. Reports the anchor-level spread across lines — the metric that made the loudness fix measurable. | `python3 tools/tests/voicelevel.py 170` |
| `envelope.py` | Voice envelope for the mouth gate — p5/p25/p50/p75 distributions and mouth-open percentages at each candidate gate threshold. Use when re-tuning the syllable clock. | `python3 tools/tests/envelope.py` |
| `sync.py` | Drift between audio playback progress, text reveal progress, and mouth-flap status. Reports `|text - audio|` median, p90, max, plus mouth-open percentage during quiet and speech. | `python3 tools/tests/sync.py` |
| `ceiling.py` | Stress test: stacks ten blasts, a siren, klaxons, glitch crush and a commercial break on top of a music bed, and reports peak output. If any segment shows `peak ≥ 0.999`, the bus is clipping past full scale. | `python3 tools/tests/ceiling.py` |
| `mouthcheck.py` | Does each anchor's mouth actually move while they read? Crops the head region for both seats and counts frame-to-frame changes. | `python3 tools/tests/mouthcheck.py` |
| `jaw4.py` | Mouth flap rate — samples the animator's mouth-open flag at 40 ms and reports the number of open/shut transitions per second of speech, plus the average hold time. | `python3 tools/tests/jaw4.py` |

---

## 4. Feed & ingestion

| Script | Purpose | Usage |
|--------|---------|-------|
| `feedsurvey.py` | Probes every candidate RSS feed through `rss2json` (the only path the app has), per category, and reports item count and HTTP health. | `python3 tools/tests/feedsurvey.py` |
| `feedcheck.py` | Is the rundown filling? Prints the currently-aired story and the queue. | `python3 tools/tests/feedcheck.py` |
| `errs.py` | Are the modules loaded? Prints the type of `GNNDirector`, `GNNScript`, `GNNFeedManager`, `GNNCast` and the current director state. | `python3 tools/tests/errs.py` |

---

## 4a. Programming, commercials & faults

Probes written while building the commercial pods, the lore separation,
the cinematic footage and the expanded glitch engine. Each one checks
behaviour on air, not the presence of code — several of them found bugs
that a parse check and a clean drive both missed.

| Script | Purpose | Usage |
|--------|---------|-------|
| `podcheck.py` | Forces three commercial breaks and prints each one's shot kinds and the voice reading each shot. A break should be 2–3 spots, each spot one announcer, the ident a voice of its own. | `python3 tools/tests/podcheck.py` |
| `breakcheck.py` | Forces commercial breaks and times every seam from the media elements and frame loop: toss → picture, picture → first line, line → line, frozen animation tails, last line → desk, cut lines, frame stalls. `-v` dumps the raw events. | `python3 tools/tests/breakcheck.py 3` · `… 3 night_desk commercials=archive` |
| `breakedges.py` | Interruptions: skip mid-break (no return line over the next story), a secret typed mid-break (announcer not cut off), and a show promo's card and anchors. | `python3 tools/tests/breakedges.py` |
| `content_check.py` | **Offline** — no browser, no server, safe while on air. Fails (exit 1) if a scheduled pair has no exchanges, a promo does not resolve to its show's card and anchors, a non-sports show draws the sports bucket, or a show has no title card; lists art the code names that is not on disk yet. `GNN_ROOT` points it at another tree (how it was validated: four planted faults, four caught). | `python3 tools/tests/content_check.py` |
| `productsheet.py` | **Offline.** Contact-sheets every product still on the stage it actually airs on, composited exactly as `compositeProduct()` does. Look at it after adding a still, a stage or a slot: a slot whose bottom edge is not the surface makes every product on that set float or sink. | `python3 tools/tests/productsheet.py [outdir]` |
| `offline.sh` | **Run this after any change.** Every check that needs no server: `node --check` on each JS file, `server.py` compiles, `content_check`, the MoO2 unit tests, `verify_assets`, and the product sheet. Exit code 1 on any failure. Safe while on air. | `tools/tests/offline.sh` |
| `logocheck.py` | Forces a spot of a given kind and saves a frame strip of the whole break to `<dir>/<label>_strip.png`. Edit the `run(...)` lines at the bottom to pick kinds (`promo`, `qvc`, `infomercial`, `sponsor`, `commercial`). This is how the sponsor crests and testimonial portraits were checked. | `python3 tools/tests/logocheck.py /tmp` |
| `lorecheck.py` | Runs one show block and lists every story read with its source, and every sector-wire line presented. A real-news block must show **0** archive stories and 0 sector-wire lines; the lore block must show only archive stories. | `python3 tools/tests/lorecheck.py archives 100` · `… evening_rim 100` |
| `cinecheck.py` | Forces footage as the cutaway source (`?cutaways=footage`), routes three test headlines, and saves a strip of the monitor to `<dir>/cine_live.png`. | `python3 tools/tests/cinecheck.py /tmp` |
| `faultsheet.py` | Fires every glitch-engine fault (or a comma list given as the second argument) and saves one mid-fault frame of each to `<dir>/faults.png`. **Look at the sheet.** Three faults were invisible on air while passing every other check. | `python3 tools/tests/faultsheet.py /tmp` · `… /tmp crosstalk_shop,test_card` |
| `speechgaps.py` | Boots a show and times the silence between consecutive voice lines from the audio elements themselves, counts how often the booth ident starts (must be 1), and reports any line cut off mid-speech. A third argument forces that many commercial breaks. The probe behind the hand-over timing fix: 2.2 s median before, 1.25 s after. | `python3 tools/tests/speechgaps.py night_desk 150` · `… evening_rim 180 3` |
| `spamcheck.py` | Types eight secret words in quick succession and reports which secret lines were actually spoken, and when. Expect exactly two, played back to back after the line in progress. Zero means the speech queue is dropping interjections — this is the probe that found the watchdog bug. | `python3 tools/tests/spamcheck.py` |

Note: `faultsheet.py` writes `faults2.png` when given a list and `faults.png`
otherwise — the strip it saves is named in its output.

---

## 5. Screenshot capture

Only two scripts here, on purpose — five different variations accumulated
during development and all but these two were superseded.

| Script | Purpose | Usage |
|--------|---------|-------|
| `docshots.py` | README screenshots. Injects stories rather than waiting on the live wire (which 429s under back-to-back harness runs) and captures `hero.png`, `cutaway.png`, `banter.png`, `glitch.png`, `commercial.png` into `docs/`. | `python3 tools/tests/docshots.py` |
| `two.py` | Two specialised shots: the glitch frame at its peak, and the product-card beat of a commercial break. Both need frame-level timing that `docshots.py` cannot hit. | `python3 tools/tests/two.py` |
| `tw.py` | Opens a remote two-way PIP monitor over CDP and screenshots the result to the path given. | `python3 tools/tests/tw.py /tmp/twoway.png` |

---

## 6. Housekeeping

| Script | Purpose | Usage |
|--------|---------|-------|
| `reap.py` | Terminates leftover `while pgrep …; do sleep N; done` polling shells. Works out its own ancestry first, so it cannot kill the shell that issued it. | `python3 tools/tests/reap.py` |
| `links.py` | Checks every internal Markdown link in `README.md`, `CLAUDE.md`, `docs/ROADMAP.md`. | `python3 tools/tests/links.py` |

---

## Notes

**Every script in this folder assumes the station is running** on
`http://localhost:8080/`. `drive.py` launches its own headless Chromium,
attaches to it over CDP on port 9333, and kills every process it started
when the script exits — including Chromium's helper processes and any
flatpak survivors.

**Scripts that install a `ScriptProcessor` on the master bus** — every
script in section 3 — should not be run two at a time. Each one connects a
new audio tap and the second one will report double the level of the first.

**Do not run `./stop.sh` while a diagnostic is attached.** The CDP session
will hang waiting for a target that has been killed, and `drive.py`'s
shutdown will not be able to close a browser that never had a page.

**Hardcoded paths.** Every script in this folder starts with
`sys.path.insert(0, '/home/ekco/github/GNN/tools')`. That is the owner's
machine. If the project ever moves, that line breaks every script. The
replacement is:

```python
import os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
```

Not done yet — it is a personal project, and it is only a problem when the
project moves.
```

Save it as `tools/tests/README.md`, delete the 19 superseded scripts, and the folder is clean.
