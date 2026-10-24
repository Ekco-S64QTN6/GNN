# Architecture

The runtime, the generated art library and the diagnostics. The asset pipeline is in [`tools/PROJECT.md`](../tools/PROJECT.md); the MoO2 format in [`MOO2_GRAPHICS_DEEP_DIVE.md`](../MOO2_GRAPHICS_DEEP_DIVE.md). Load-bearing constraints: [`CLAUDE.md`](../CLAUDE.md) §2.

## Architecture

No framework, no build step. Seventeen plain-script modules, each with one job,
plus one generated table.

```
js/
├── asset-registry.js      manifest queries — nothing else hard-codes a path
├── audio-engine.js        sfx/music/voice buses, ducking, glitch DSP
├── tts.js                 neural voice client + lip-sync analyser
├── pronounce-kokoro.js    generated: pronunciation checked against the voice itself
├── script-writer.js       banter, ad copy, ticker segments, chyrons
├── scene-compositor.js    layered B-roll synthesis (9 recipes, 10 motion models)
├── cutscene-manager.js    cutaways + the commercial break sequencer
├── broadcast-director.js  the rundown state machine — owns the clock
├── text-engine.js         teleprompter + lower-third chyron
├── glitch-engine.js       anomalies + easter eggs
├── animator.js            viseme lip-sync + globe cel control
├── ticker-manager.js      seamless market crawl
├── icon-manager.js        over-the-shoulder icon matcher
├── feed-manager.js        RSS ingestion, sanitising, importance scoring
├── cast.js                who the anchors are: voices, tics, what they
│                          think of one another
├── logger.js              browser-side console and transcript logger
├── renderer.js            viewport buffer, layer stack, CRT post-processing
└── main.js                bootstrap, UI wiring, frame loop
```

**Layer stack.** Everything is composited into an offscreen buffer the size of
the window and post-processed as one signal:

```
1  the set                              ─┐
2  the anchors, lip-synced               │  drawn to the
3  the desk, in front of them            │  viewport buffer,
4  over-the-shoulder monitor             │  then rolled / torn /
5  cutaway or commercial break           │  desaturated / ghosted
6  story caption, the lower third        │  as one picture
7  LIVE tag and clock                    │
8  market crawl                         ─┘
9  alert border + glitch artefacts
```

**The one rule:** no module outside `asset-registry.js` may name an asset path.
Everything asks the registry for *a kind of thing*. That is what makes the
whole library reachable instead of a handful of hard-coded items. The registry
handles both games — MoO2 entries carry `source: 'moo2'` and their paths
resolve under `assets/cutscenes/moo2/`, and MoO2 strings are merged in from
`assets/moo2-strings.json` alongside the MoO1 pool.

## The generated asset library

Everything else the studio is made of. Each directory is conditioned by
`tools/condition_plates.py`, which reads the frame size out of `renderer.js`
so a change of resolution cannot leave a plate behind.

| Directory | What lives there |
| :--- | :--- |
| `anchors/` | Fourteen characters. `desk_hero`, `speaking`, `listening`, `listening_flip` per species. |
| `set/` | Ten studio plates. Window panes are keyed out and recorded in `layout.json` so backdrops composite behind the glass. |
| `cutaways/` | Story plates routed by subject keyword. |
| `backdrops/` | Exterior views composited into the window opening, four moods across four times of day. |
| `correspondents/` | Monitor portraits for the two-way and debate beats. |
| `logos/` | Show and desk logos. |
| `icons/` | Over-the-shoulder story icons — 22 subjects; the original *Master of Orion* event icons appear now and then as a throwback. |
| `overlays/` | The breaking-news frame and the monitor bezels (gunmetal, and brass for the warmer sets). |
| `titlecards/` | Full-bleed show bumpers. |
| `infomercials/`, `products/`, `sponsors/`, `testimonials/` | Commercial break art. |
| `Prompts/` | The prompt files that made all of the above. `_OUTSTANDING.md` lists anything still to generate. |

## Diagnostics

Several tools exist for tuning specific pieces without touching the shipped
assets:

| Tool | Purpose |
| :--- | :--- |
| `tools/scene_review.html` | Preview every recipe and cutscene item; flag assets to exclude. |
| `tools/interview_tuner.html` | Slider tuning for the EMBASSY interview composition. |
| `tools/studio_review.html` | Desk-line tuning for the ten studio sets. |
| `tools/commercial_review.html` | Previewing and tuning product placement in commercial breaks. |
| `tools/palette_compare.py` | Render one MoO2 sprite against every FONTS palette. |
| `tools/moo2_probe.py` | Byte-level LBX inspection. |
| `tools/drive.py` | Headless broadcast harness — runs the station, samples the director, screenshots each segment. |
| `tools/capture_gallery.py` | Re-shoots every screenshot in this README from the running station. |
| `tools/tests/speechgaps.py` | Times the silence between spoken lines and catches any line cut off. |
| `tools/pronounce_kokoro.py` | Checks every pronunciation rule against the voice; `--say WORD` shows how a word will sound. |
| `trailer/` | Records takes off air and cuts the trailer. |

```bash
python3 tools/drive.py 120 .shot
# states seen: {'READ': 161, 'HOLD': 33, 'BANTER': 30, 'TWO_WAY': 24, 'BREAK': 23}
# console errors: 0, exceptions: 0
```

Full tool list, testing discipline and current work status:
[`tools/PROJECT.md`](../tools/PROJECT.md) and [`CLAUDE.md`](../CLAUDE.md).
