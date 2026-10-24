<div align="center">

# GNN — Galactic News Network

**An unscripted, round-the-clock newscast simulation.**
Real-world news, read by a desk of *Master of Orion* aliens,
in a studio that keeps the games' archive as its footage library.
Twenty-four shows, ninety-six slots a day, never off the air.

[![Frontend](https://img.shields.io/badge/frontend-vanilla_JS-f7df1e?style=flat-square&logo=javascript&logoColor=black)](#)
[![Python](https://img.shields.io/badge/server-python_3.8%2B-3776ab?style=flat-square&logo=python&logoColor=white)](#)
[![Voice](https://img.shields.io/badge/voice-kokoro--82M_local-ff9de2?style=flat-square)](#)
[![Cast](https://img.shields.io/badge/cast-14_characters-ffb454?style=flat-square)](#)

<a href="https://www.youtube.com/watch?v=iAQWnEE2qmM">
  <img src="docs/trailer_thumbnail.png" alt="The GNN newsroom with the station logo and a play button — click to watch the trailer on YouTube" width="820">
</a>

[What it is](#what-it-is) · [Screenshots](#screenshots) · [Quick start](#quick-start) · [Documentation](#documentation) · [Legal](#legal)

</div>

---

## What it is

Most "retro news ticker" toys read a feed in a loop. This is a **channel**. It has a rundown and
dead air; the anchor finishes a story, adds a line of their own and throws to the next. Every few
stories the desk gives way to a commercial break storyboarded and voiced at runtime, and the
transmitter fails on a schedule nobody published.

**The news is real.** Real headlines and summaries, read straight: an election story names the
candidates, and the ticker shows the actual market. The 1993 aesthetic is the studio, the
cutaways, the sound and the anchors' faces, not a translation layer. The games' lore airs only in
its own overnight show, the commercials, and the faults and secrets a viewer finds by looking.

It is built from two sources:

- **The archive** — graphics, text, sound, music and cinematic footage decoded from your own copy
  of *Master of Orion 1* and *2* by the pipeline in [`tools/`](tools/). The game data is not in this
  repository and is required to run the station.
- **The studio** — the set, anchors, correspondents, backdrops and cutaways are generated art,
  conditioned to the resolution they are drawn at and quantised to 256 colours so they cut together
  with the decoded material. Every prompt is in [`assets/generated/Prompts/`](assets/generated/Prompts/).

Voices are local ([Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M)); no frontend build step,
no bundler, no `node_modules`.

## Screenshots

The running station, captured by [`tools/capture_gallery.py`](tools/capture_gallery.py).

<div align="center">
<img src="docs/gallery/hero.png" width="820" alt="Two anchors at the main desk reading a real headline, the story icon in the monitor over their shoulders">
<br><em>Real headlines, read straight by the desk. The monitor carries the story's icon; the crawl carries live market quotes.</em>
</div>

| Twenty-four shows on a 96-slot day | Weather every two hours |
| :---: | :---: |
| <img src="docs/gallery/shows.png" width="400" alt="Nine of the channel's show title cards in a grid"> | <img src="docs/gallery/weather.png" width="400" alt="The weather desk with two anchors reading a space story"> |
| Cutaway in the monitor | Full-screen archive footage |
| <img src="docs/gallery/cutaway.png" width="400" alt="A generated starship plate in the studio monitor"> | <img src="docs/gallery/footage.png" width="400" alt="Master of Orion II cinematic footage filling the frame under a caption"> |
| A correspondent live | Council Crossfire |
| <img src="docs/gallery/correspondent.png" width="400" alt="A Bulrathi correspondent live in the monitor"> | <img src="docs/gallery/debate.png" width="400" alt="Two guests in split monitors either side of the desk"> |
| Galaxy Shop | Infomercial |
| <img src="docs/gallery/commercial_shop.png" width="400" alt="A product on a lit pedestal with price and stock counters"> | <img src="docs/gallery/commercial_infomercial.png" width="400" alt="A satisfied customer testimonial in front of a seminar stage"> |
| Imperial Research Exchange | Colonial Marine Corps |
| <img src="docs/gallery/commercial_research.png" width="400" alt="The Master of Orion lab console with a blueprint on its monitor"> | <img src="docs/gallery/groundwar.png" width="400" alt="Two armies of Master of Orion II ground troops trading fire"> |
| Breaking news | Transmission faults |
| <img src="docs/gallery/breaking.png" width="400" alt="The breaking-news frame around the studio"> | <img src="docs/gallery/glitch.png" width="400" alt="An unidentified carrier overriding the broadcast"> |

What airs and how it is paced — shows, breaks, two-ways, faults, secrets: [The broadcast](docs/BROADCAST.md).

## Quick start

Python 3.8+ and a modern browser; the local voice engine needs Python 3.10–3.12.

```bash
git clone https://github.com/Ekco-S64QTN6/GNN.git && cd GNN
python3.12 -m venv .venv
.venv/bin/pip install kokoro soundfile edge-tts curl_cffi
```

**Supply your own game files** (both are sold on GOG and Steam):

```
Master of Orion 1/
├── data/          ← Master of Orion 1
└── mastori2/      ← Master of Orion 2
```

**Decode them once**, then check every asset resolves:

```bash
python3 tools/extract_all.py && python3 tools/extract_text.py          # MoO1
python3 tools/extract_moo2.py && python3 tools/merge_moo2_manifests.py  # MoO2 graphics
python3 tools/extract_moo2_text.py && python3 tools/merge_moo2_text.py  # MoO2 text
python3 tools/extract_moo2_video.py                                     # MoO2 cinematics
python3 tools/extract_sound_moo2.py && python3 tools/extract_music_moo2.py   # MoO2 sound and music
python3 tools/build_audio.py                                            # MoO1 audio, index everything
python3 tools/verify_assets.py
```

**Go on air:**

```bash
./broadcast.sh             # its own window; closing it takes the station off air
./broadcast.sh --tab       # or a tab in your browser
```

Click once in the window: browsers need a gesture before a page may make sound. `./start.sh --bg`
and `./stop.sh` run the server on its own.

## Documentation

| | |
|:--|:--|
| [The broadcast](docs/BROADCAST.md) | Pacing, shows, commercials, faults and secrets |
| [Architecture](docs/ARCHITECTURE.md) | The runtime, the generated art library, diagnostics |
| [Asset pipeline](tools/PROJECT.md) | The extractors, the palette map, the rebuild order |
| [MoO2 graphics deep dive](MOO2_GRAPHICS_DEEP_DIVE.md) | The MoO2 LBX and palette format, for anyone extracting these files |
| [Roadmap](docs/ROADMAP.md) | What is next |
| [Contributing](CONTRIBUTING.md) | How to work on the station without breaking it on air |
| [CLAUDE.md](CLAUDE.md) | Verified state, load-bearing constraints, and every fix with its evidence |

## Credits

- ***Master of Orion 1*** (1993) and ***Master of Orion 2*** (1996) — SimTex / MicroProse. All
  artwork, sound effects and music originate there.
- **LBX format and MoO2 palettes** — Nick Bowler's [`liblbx`](https://git.draconx.ca/gitweb/liblbx.git)
  and Wolverine's graphics-format write-up ([reposted 2008](https://masteroforion2.blogspot.com/2008/04/moo2-graphics.html)).
- **Speech** — [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (Apache-2.0), run locally;
  [`edge-tts`](https://github.com/rany2/edge-tts) as a fallback.
- **Music** — FluidSynth with the FluidR3 GM soundfont; Smacker decoding via `ffmpeg`.
- **Type** — *Press Start 2P* and *Outfit* via Google Fonts.
- **News** — 26 RSS feeds tagged by topic and [NOAA SWPC](https://www.swpc.noaa.gov/) space-weather alerts.

## Legal

**A non-commercial portfolio project. No copyright infringement is intended.**

*Master of Orion* is a trademark of its respective owners; the games, their artwork, music and
sound effects are © 1993–1996 SimTex Software and MicroProse Software, and all rights remain with
their current holders. This project is not affiliated with, authorised by, endorsed by or
sponsored by SimTex, MicroProse, Atari, Wargaming or any successor rights holder.

**No game data is distributed here in any form.** Neither the `.LBX` archives nor anything decoded
from them (PNGs, GIFs, WAVs, OGGs, manifests) is in this repository; both are git-ignored, and
anyone running the project supplies their own copy of the games. What is included under
`assets/generated/` is AI-generated art made from the prompts in `assets/generated/Prompts/`, not
derived from any SimTex or MicroProse asset. The tools in `tools/` are clean-room format readers
for interoperating with games you own.

If you represent a rights holder and would prefer any part of this repository be taken down,
please open an issue and it will be removed promptly. Third-party names and feed content from the
live RSS layer belong to their owners and appear only as transient news data.

The **original code** — the engine, the extractors, the broadcast director and the compositor — is
released under the MIT License.
