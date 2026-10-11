<div align="center">

# GNN — Galactic News Network

**An unscripted live newscast simulation.**
Real-world RSS, read by a desk of *Master of Orion* aliens,
in a studio that keeps the game's archive as its footage library.

[![No dependencies](https://img.shields.io/badge/frontend-vanilla_JS-f7df1e?style=flat-square&logo=javascript&logoColor=black)](#)
[![Python](https://img.shields.io/badge/server-python_3.8%2B-3776ab?style=flat-square&logo=python&logoColor=white)](#)
[![Canvas](https://img.shields.io/badge/render-HTML5_canvas_full--window-6fc3df?style=flat-square)](#)
[![Assets](https://img.shields.io/badge/assets-873_items_·_4316_frames-9c6bff?style=flat-square)](#)
[![Audio](https://img.shields.io/badge/audio-41_SFX_·_40_tracks-54e08a?style=flat-square)](#)
[![Voice](https://img.shields.io/badge/voice-kokoro--82M_local-ff9de2?style=flat-square)](#)
[![Cast](https://img.shields.io/badge/cast-12_characters_·_11_generated-ffb454?style=flat-square)](#)

<img src="docs/hero.png" alt="The GNN newsroom: two alien anchors at a lit desk reading a live RSS headline, story monitor over one shoulder, commodity crawl along the bottom" width="820">

</div>

---

## Contents

- [What this is](#what-this-is)
- [Screenshots](#screenshots)
- [Quickstart](#quickstart)
- [How the broadcast is paced](#how-the-broadcast-is-paced)
- [Features](#features)
- [Controls](#controls)
- [Architecture](#architecture)
- [The asset pipeline](#the-asset-pipeline)
- [Verifying and rebuilding](#verifying-and-rebuilding)
- [Credits](#credits)
- [Legal](#legal)

> Working on this? **[`CLAUDE.md`](CLAUDE.md)** is the source of truth for
> current state, fixed bugs and load-bearing constraints.
> **[`docs/ROADMAP.md`](docs/ROADMAP.md)** is what is still to build.

---

## What this is

Most "retro news ticker" toys read a feed in a loop. This is a **channel**.

It has a rundown. It has dead air. The anchor finishes a story, lets it sit,
adds a line of his own, and throws to the next item. Every few stories the desk
goes away entirely for a commercial break that was storyboarded and voiced at
runtime. The transmitter fails on a schedule nobody published.

The channel is built on two sources, and it is worth being plain about which
is which.

**The archive.** Decoded out of the original `.LBX` files: **873 graphics
items, 4,316 frames, 41 sound effects, 40 music tracks and the 154 news
bulletins the original in-game anchor read**. It supplies the sound, the
music, the sector-wire copy, the commercial break footage and the robot who
still has a real 25-cel lip matrix. The freighter convoys and tactical plots
are *composited at runtime* out of parts the game shipped separately.

**The studio.** The set, the eleven generated anchors and correspondents, the
window backdrops and the story cutaways are generated art, conditioned by
`tools/condition_plates.py` to the resolution they are drawn at and quantised
to 256 colours so they cut together with the decoded material rather than
sitting on top of it looking like a different decade. Every prompt that made
them is in [`assets/generated/prompts.md`](assets/generated/prompts.md),
regenerated from `tools/prompt_bridge.py`.

The game data itself is **not** in this repository, and is not needed to run
it. See [Legal](#legal).

---

## Screenshots

| Story cutaway | Commercial break |
| :---: | :---: |
| <img src="docs/cutaway.png" width="400" alt="The newsroom with a picture-in-picture monitor over the anchor's shoulder showing an orbital survey plate"> | <img src="docs/commercial.png" width="400" alt="A full-frame in-universe commercial break opening on a GNN presentation card over a mining surface"> |
| The monitor over the shoulder carries a plate matched to the story's subject, falling back to a scene composited out of archive parts. | A storyboarded 4–6 shot sequence with generated copy, read by its own announcer rather than by the anchors. |

| Remote two-way | Transmission fault |
| :---: | :---: |
| <img src="docs/correspondent.png" width="400" alt="A Bulrathi correspondent appearing live in the studio monitor while the two anchors listen at the desk"> | <img src="docs/glitch.png" width="400" alt="The picture tearing and shearing during a scheduled transmission anomaly"> |
| Correspondents come in through the monitor, not a second set: the anchor asks, the reporter answers in their own voice, the anchor thanks them. | Eight fault types seize the lip matrix, the audio bus and the picture. |

<div align="center">
<img src="docs/banter.png" width="820" alt="The two anchors at the desk between headlines, one delivering a line of commentary with the station window behind them">
<br><em>Between headlines the desk talks — to each other, to a correspondent,
or over a re-pointed 1993 sector-wire bulletin.</em>
</div>

---

## Quickstart

```bash
git clone https://github.com/Ekco-S64QTN6/GNN.git
cd GNN

# Local voice engine. Arch and other PEP 668 distros refuse system-wide pip,
# and Kokoro's phonemiser has no wheels for Python 3.14, so use 3.12 here.
python3.12 -m venv .venv
.venv/bin/pip install kokoro soundfile edge-tts

./start.sh                    # http://localhost:8080   (Ctrl-C stops it)
```

`start.sh` uses `.venv/bin/python` when it exists. Without the venv the app
still runs — it falls back to `edge-tts` if installed, and to the browser's own
Web Speech API if not.

Open <http://localhost:8080> and **click once anywhere** — browsers require a
gesture before any page may make sound.

### Going off air

```bash
./start.sh --bg     # run detached, logging to gnn-server.log
./stop.sh           # stop the server and anything the test harness left running
```

`stop.sh` shuts down the server by PID file, catches any stray one still
holding the port, and closes headless browsers the test harness started. It
matches those on the harness's own debugging port **and** on the process really
being a browser, so your own Chromium is never a target. `Ctrl-C` on a
foreground `start.sh` does the same thing — the server traps `SIGINT`/`SIGTERM`,
closes the listener and removes its PID file.

### Checking the install

```bash
curl localhost:8080/api/status      # what the station has available
python3 tools/verify_assets.py      # prove every asset resolves locally
```

**Requirements:** Python 3.8+ and a modern browser. No build step, no bundler,
no `node_modules`, no external services at runtime. `edge-tts` is the only
optional dependency; the app falls back to the Web Speech API without it.

---

## How the broadcast is paced

This is the part that makes it feel like television rather than a feed reader.
The rundown is generated as it plays — it is not a loop.

```mermaid
stateDiagram-v2
    direction LR
    [*] --> COLD_OPEN
    COLD_OPEN --> READ
    READ --> HOLD : story lands
    HOLD --> BANTER : 55%
    HOLD --> TOSS : 42%
    HOLD --> READ
    BANTER --> HOLD
    WIRE --> HOLD
    BANTER --> WIRE : 35% of beats
    BANTER --> TWO_WAY : 22% of beats
    TWO_WAY --> HOLD
    TOSS --> READ
    READ --> BREAK : every 4–7 stories
    READ --> IDENT : every 9–14 stories
    BREAK --> READ
    IDENT --> READ
    READ --> SHOW_CLOSE : every 9–14 stories
    SHOW_CLOSE --> COLD_OPEN
    READ --> DRY : rundown empty
    DRY --> READ : feed returns
```

| Segment | What actually happens |
| :--- | :--- |
| **READ** | A live RSS story. The teleprompter types to the *audio element's own playback position*, so the words appear as they are said rather than to an estimate that drifts. A cutaway fires a third of the way in. |
| **HOLD** | **Real dead air.** Voice silent, prompter holding the last line, the anchor's mouth shut, room tone carrying it. 1.5–3.6 s. This is the single biggest difference between a page reading RSS and a channel that is on. |
| **BANTER** | Commentary on the story just read, or the two anchors talking to each other — a jab and a reply drawn from an asymmetric relationship table, each in its own voice. |
| **TWO_WAY** | A remote. A correspondent appears live in the studio monitor; the anchor asks, the reporter answers in their own voice, the anchor thanks them. One portrait rather than a second set. |
| **WIRE** | One of the **actual 154 `EVENTMSG.LBX` bulletins** the original GNN anchor read, with its placeholders re-pointed at proper nouns and figures mined out of the live story. |
| **TOSS** | The one-line handoff into the next item. |
| **BREAK** | A full commercial sequence — see below. |
| **IDENT** | Station identification. |
| **SHOW_CLOSE** | End of a block. The lead signs off and names whoever sat with them, and the channel opens a new show rather than reading on forever. |
| **DRY** | The feed went quiet. The anchor notices, and says so. |

Breaking-news keywords pre-empt the rundown, sound the klaxon and flash the
CRT border.

**Every spoken line goes through one queue.** Synthesis pre-empts itself —
asking for a new clip cuts off the one playing — so any line fired while
someone was talking used to kill it, and which line survived was a race. The
director queues instead: one line at a time, a 420 ms beat of air between
them, and the caption raised at the moment its own line starts.

---

## Features

<details open>
<summary><b>Pixel-perfect VGA studio</b></summary>

- The window is the broadcast, edge to edge. A 320×180 design grid rendered
  at 4× and fitted to the window, nearest-neighbour, with CRT scanlines.
- A generated studio with the desk built into it, and the back window
  **keyed out of the plate** so a backdrop can be composited behind the
  glass and changed per show block.
- Twelve characters with their own voices, faces and opinions of one
  another: eleven generated species plus the MOO1 robot, keyed out of his
  original scene with his 25-cel lip matrix intact. Anchors sit at the
  desk; everyone else arrives through the monitor as a remote.
- Everything inside the studio monitor is drawn to a **single viewport buffer**
  before being blitted, so faults roll, tear and desaturate the whole signal at
  once — the way a failing CRT would — rather than per element.

</details>

<details open>
<summary><b>Lip-sync gated on the voice</b></summary>

An `AnalyserNode` taps the voice bus. The robot has a real 25-cel matrix and
indexes it directly off the envelope, bucketed into five visemes by jaw
opening. The generated cast have two mouth states, so they flap on a syllable
clock — but the clock is **gated on the measured level**, which runs 0.002 to
1.000 with pauses between sentences showing as runs below 0.10. Measured in
the running app: the mouth is open **1–2% of samples during silence and 56%
during speech**, so it moves while a word is being said and not otherwise.

Each `_speaking` plate is built as its hero with **only the mouth swapped
in** — 1.4–3.1% of the plate differs, one blob on the mouth — so a flap
cannot move anything else. Two separate generations never agree everywhere,
and swapping whole plates five times a second showed every disagreement at
once. During dead air they blink.

</details>

<details open>
<summary><b>Zero-cloud neural voice</b></summary>

The voice runs **on this machine**. `/api/tts` drives
[Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (Apache-2.0) in
process — 17 English voices, 24 kHz, about 7x faster than real time on CPU
alone, no GPU required and nothing leaving the machine. The selector is built
from `/api/voices` at boot, so it always matches the engine that is actually
running.

Every clip is **level-matched and delivered lossless**. Voices arrive at very
different levels — through a compressor the hot ones get squashed and the quiet
ones do not, which is what made one voice sound clean and the next harsh. Each
clip is matched to -21 LUFS / -3 dBTP, with gentle compression ahead of the
gain so the limiter never has to do the levelling (it removes 1.8 dB, not
no pumping) and served as PCM rather than re-encoded.
`python3 tools/voice_audition.py` renders every voice the running engine offers
back to back, so the selector can be chosen by ear.

Clips are **fetched before they play**, not streamed from a live URL. That
removes the one-to-four second synthesis lag between a segment starting and its
voice arriving — which used to leave lines still playing when the next segment
cut them off — and lets the whole commercial break be synthesised the moment it
is assembled.

</details>

<details open>
<summary><b>Synthesized B-roll</b></summary>

*Master of Orion* never shipped a shot of a freighter convoy crossing a colony
skyline at dusk. It shipped the skyline (`LANDING`), the freighter (`SHIPS2`),
the nebula wash (`NEBULA`) and the tactical readout plates (`STARMAP`). This
builds the shot.

Nine recipes — `convoy · tactical · survey · council · interview · industry ·
anomaly · cyber · deepfield` — layer backdrops, sprites and HUD chrome on a
320×200 buffer with independent per-layer motion models (`cross`, `orbit`,
`approach`, `drift`, `pulse`, `scanline`) and depth-scaled parallax. Routing is
driven by the story's own keywords. Two runs of the same recipe never look
alike.

This is what puts the "tiny tactical icons" and "blank UI screens" that earlier
passes threw away back on air as the moving parts of original footage.

</details>

<details open>
<summary><b>Commercial breaks, not bumpers</b></summary>

A break is a storyboarded 4–6 shot sequence — station ident, hook, product
hero, spec plate, tag card, legal card — each shot with its own composited
scene, its own voice-over beat read by the same anchor, its own sound design,
and a hard cut or a dissolve between them. Sponsor names, product names,
taglines and legal disclaimers are generated from the game's own vocabulary of
118 hull classes, 39 star names and 10 races.

> *Draconis Cybernetics presents the Annihilator-Class programme.*
> *Rated for 26 standard years of continuous operation.*
> *Draconis Cybernetics. Built for the long dark.*
> <sub>Warranty ends at the terminator line.</sub>

</details>

<details open>
<summary><b>The full audio bank</b></summary>

All 41 `SOUNDFX.LBX` effects are profiled offline by duration, spectral
brightness, attack and sustain, then bucketed into 13 roles — `click blip tick
thud beep chirp zap servo sweep blast siren alarm drone rumble` — so the
director asks for *a kind of noise*, not an index. All 40 `MUSIC.LBX` tracks
(21m36s) are rendered to OGG and used as break beds, ducked under the voice.

The graph is a real console: separate SFX, music and voice buses into a
station bus, through a bit-crush glitch stage, into a master compressor.

</details>

<details open>
<summary><b>Anomalies and easter eggs</b></summary>

Eight scheduled fault types — `carrier_drop · lipsync_desync · signal_tear ·
palette_burn · tape_stop · ghost_signal · interference · vertical_hold ·
eye_flicker` — seize the anchors' lip matrices, tear the picture or stall
it on a single cel, bit-crush the audio bus, drag the music like a dying tape
transport, roll and tear the picture, and punch frames of otherwise-unusable
artwork into the composite.

The secrets are undocumented on purpose. The studio monitor rewards persistence, the
anchor's optics reward curiosity, the keyboard remembers 1986, and the top of
the hour always sounds different.

</details>

---

## Controls

| Control | Description |
| :---: | :--- |
| **▶ / ⏸** | Run or hold the broadcast |
| **🔊 / 🔇** | Station audio |
| **🗣 / 🤐** | The anchor's neural voice |
| **Voice ▾** | Nine neural voice models, switchable mid-sentence |
| **⏭** | Next item on the rundown |
| **📺** | Go to a commercial break now |
| **⚙** | Inject a breaking bulletin, manage RSS feeds, toggle the crawl |
| **Canvas** | The globe and the anchor's optics are clickable |
| **Keyboard** | Listening. |

A live telemetry line under the console reports the current segment, rundown
depth, stories read, stories until the next break and any active fault.

---

## Architecture

No framework, no build step. Fifteen plain-script modules, each with one job.

```
js/
├── asset-registry.js      manifest queries — nothing else hard-codes a path
├── audio-engine.js        sfx/music/voice buses, ducking, glitch DSP
├── tts.js                 neural voice client + lip-sync analyser
├── script-writer.js       banter, wire riffs, ad copy, ticker, chyrons
├── scene-compositor.js    layered B-roll synthesis (9 recipes, 7 motion models)
├── cutscene-manager.js    cutaways + the commercial break sequencer
├── broadcast-director.js  the rundown state machine — owns the clock
├── text-engine.js         teleprompter + lower-third chyron
├── glitch-engine.js       anomalies + easter eggs
├── animator.js            viseme lip-sync + globe cel control
├── ticker-manager.js      seamless commodity crawl
├── icon-manager.js        over-the-shoulder icon matcher
├── feed-manager.js        RSS ingestion, sanitising, importance scoring
├── cast.js                who the anchors are: voices, tics, what they
│                          think of one another
├── renderer.js            viewport buffer, layer stack, CRT post-processing
└── main.js                bootstrap, UI wiring, frame loop
```

**Layer stack.** Everything is composited into an offscreen buffer the size of
the window and post-processed as one signal, so a failing channel rolls and
tears whole rather than per element:

```
1  the set                              ─┐
2  the anchors, lip-synced               │  drawn to the
3  the desk, in front of them            │  viewport buffer,
4  over-the-shoulder monitor             │  then rolled / torn /
5  cutaway or commercial break           │  desaturated / ghosted
6  story caption, the lower third        │  as one picture
7  LIVE tag and clock                    │
8  commodity crawl                      ─┘
9  alert border + glitch artefacts
```

There is no studio frame around it and no picture inside one. The window is
the television.

**The one rule:** no module outside `asset-registry.js` may name an asset path.
Everything asks the registry for *a kind of thing* — "a clean bright backdrop
wider than 140px", "four readout plates bigger than a button", "an alarm longer
than a second". That is what makes the whole 873-item library reachable instead
of the handful of hard-coded items earlier passes could use.

---

## The asset pipeline

`tools/lbx.py` is an original implementation of the LBX container, the LBXGFX
item header, the per-column run encoding and the embedded VGA palette block.
**All 4,316 frames across 22 archives decode byte-exact** — every frame body is
consumed to its last byte, and all 872,024 runs land inside their column.

```
u8 kind (1 = keyframe, 0 = delta over the previous frame)
  per column:
    0xFF                        column unchanged
    u8 mode | u8 seglen         seglen bytes of run data follow

    inside those seglen bytes, repeated until they run out:
      u8 pixcount | u8 skip | pixcount bytes of payload
        skip = transparent rows before this run, measured from the END of the
               previous run in this column — a gap, not an absolute y
        mode 0x80 = RLE  (v ≥ 0xE0 → v−0xDF copies of the next byte, max 32)
        mode 0x00 = raw
```

Three things earlier extractions got wrong, and this fixes:

| | Was | Is |
| :--- | :--- | :--- |
| **Column structure** | one run per column | a column is a *sequence* of runs — 60% of the library has two or more, up to 12. Reading only the first smeared it down the rest of the column, which is where the vertical streaking came from. |
| **Run offset** | absolute `y` | a **gap from the end of the previous run**. Read as absolute, every multi-run column collapses toward the top of the image. |
| **6-bit → 8-bit colour** | inconsistent — most archives wrote the raw 6-bit value (**4× too dark**), a few used `c<<2` or `c×255/63` | `(c << 2) \| (c >> 4)`, the bit replication a VGA DAC performs, so 63 reaches a true 255 |

Both structural bugs are invisible on solid artwork: the 25-cel anchor and the
22 story icons are one run per column, so they decoded perfectly either way,
and a spot check against them passed while planets, consoles and cinematics
were quietly wrong. What settles it is the studio chassis — `NEWSCAST.LBX`
item 0 is `background_tv.png`, so it can be diffed directly. Absolute offsets
reproduce **60.1%** of its pixels; gap offsets reproduce **100%** of them —
every one of the 64,000 pixels resolves to a consistent palette index. The
anchor cels, globe cels and story icons all come back at 100% shape agreement
with the artwork the project already shipped, differing only by ≤3/255 per
channel where the old pipeline's colour ramp disagreed with itself.

Because the plates the page loads are decoded by this same pipeline
(`extract_all.py` writes `background_tv.png`, the 25 anchor cels, the 25 globe
cels and the 22 icons alongside the cutscene library), the whole project now
has one colour ramp instead of three.

Each item is measured and given a `role` (`fullscreen · panel · portrait ·
sprite · chrome · strip · blank`) plus `coverage`, `lum`, `colors`, a `hero`
frame index and a `noise` score. That metadata is the whole reason the engine
can use the library safely.

> **On the scrambled items.** A handful of items were authored against screen
> palettes that live in the game executable, not in any archive. They decode
> structurally correct but chromatically scrambled. They are not discarded —
> the manifest scores them, the compositor keeps them out of ordinary footage,
> and `glitch-engine.js` uses them deliberately as transmission interference.

Full format notes and the manifest schema: **[`assets/README.md`](assets/README.md)**.

---

## Verifying and rebuilding

The app ships with `assets/` populated and needs nothing else:

```bash
python3 tools/verify_assets.py
# graphics : 873 items, 1382 spot-checked frames, 418 gifs
# audio    : 41 effects, 5 stings, 40 music beds
# OK — every runtime asset resolves inside the project.
```

To regenerate `assets/` you need your own copy of the game at
`Master of Orion 1/data/` (see [Legal](#legal)):

```bash
python3 tools/extract_all.py     # 22 archives → RGBA frames, manifest, sidecars
python3 tools/build_audio.py     # SFX profiling + MIDI→OGG
python3 tools/extract_text.py    # EVENTMSG / NAMES / HELP → moo-strings
python3 tools/prompt_bridge.py   # prompts for art MOO1 cannot supply
```

There is also a headless harness that drives the newscast over the Chrome
DevTools Protocol, samples the director and screenshots each segment:

```bash
python3 tools/drive.py 120 .shot
# states seen: {'READ': 161, 'HOLD': 33, 'BANTER': 30, 'WIRE': 24, 'BREAK': 23}
# console errors: 0, exceptions: 0
```

Full tool list and testing discipline: [`CLAUDE.md`](CLAUDE.md).

---

## Credits

- ***Master of Orion*** (1993) — SimTex / MicroProse. All artwork, sound effects
  and music originate there.
- **Speech** — [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (Apache-2.0),
  run locally. Microsoft neural voices via [`edge-tts`](https://github.com/rany2/edge-tts)
  remain as a fallback.
- **Music rendering** — FluidSynth with the FluidR3 GM soundfont.
- **Type** — *Press Start 2P* and *Outfit* via Google Fonts.
- **RSS** — 25 feeds tagged by show block (world, tech, fleet, sport,
  markets, diplomacy, anomaly, science): Ars Technica, NASA, ESA,
  Spaceflight Now, BBC, Al Jazeera, UN News, MarketWatch, ESPN,
  ScienceDaily, Phys.org, Nature, Hacker News and others, fetched through
  rss2json.
- **Local fallback** — rss2json has a daily cap, and when it is reached
  every feed errors at once. `/api/localnews` parses the newest daily
  digest off disk so the channel still has a rundown.

---

## Legal

**This is a non-commercial portfolio project. No copyright infringement is
intended.**

*Master of Orion* is a trademark of its respective owners; the game, its
artwork, its music and its sound effects are © 1993 SimTex Software and
MicroProse Software, and all rights in them remain with their current holders.
This project is not affiliated with, authorised by, endorsed by or sponsored by
SimTex, MicroProse, Atari, Wargaming, or any successor rights holder.

**No game data is distributed here in original form, and the game's `.LBX`
archives are not included in this repository.** The tools in `tools/` are
clean-room format readers written to interoperate with a copy of the game you
already own; running them requires you to supply your own legally obtained copy
of *Master of Orion 1* (it is sold on GOG and Steam). The derived material under
`assets/` exists only to demonstrate the rendering, pacing and compositing
engine, and is used here in what the author believes to be a transformative,
non-commercial, educational manner.

If you represent a rights holder and would prefer any part of this repository
be taken down, please open an issue and it will be removed promptly.

Third-party names, marks and feed content referenced by the live RSS layer
belong to their respective owners and appear only as transient news data.

The **original code** in this repository — the engine, the extractors, the
broadcast director and the compositor — is released under the MIT License.
