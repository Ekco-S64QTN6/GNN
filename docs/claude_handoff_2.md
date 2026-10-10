# GNN handoff 2

Written against commit `9d89c47`. Everything below was observed, not assumed —
commands are given so the next person can re-observe it. Where a previous
document or the brief in `docs/prompt.md` says something I could not reproduce,
I say so and show the test.

---

## 1. §3's P0 does not exist

`docs/prompt.md` §3 says every page load fires one `/api/tts` per voice in the
catalogue, all with `seq=0`, and sends you into `js/main.js` to find the loop.

There is no loop. Those 41 requests in `gnn-server.log` were
`tools/voice_audition.py`, which I ran by hand in the previous session against
the same server. The tells, all visible in the log:

- The texts are `Michael.`, `Fenrir.`, `Onyx.` — spoken *name labels*, which only
  the audition tool generates (`fetch('%s.' % label, ...)`).
- The body copy is `"...Six starships were seized at Antares this morning..."`,
  which is `COPY` in that tool verbatim. The browser reads RSS headlines; it has
  never spoken that string.
- Audition requests encode spaces as `+` (`urllib.parse.urlencode`). The one real
  browser request on line 12 uses `%20` (`encodeURIComponent`) and `seq=1`.

Measured directly — fresh log, one page load, no interaction, 25 s:

```bash
rm -f gnn-server.log && ./start.sh --bg && sleep 18
python3 tools/drive.py 25 /tmp/boot     # navigates, never clicks
grep -c api/tts gnn-server.log          # -> 3
```

Three requests: the cold-open ident, the "Holding. The feed is quiet." line
while RSS loads, and the first story. Three different texts, one voice,
sequential. That is the broadcast running normally.

**Do not spend time on §3.** If you want the invariant enforced anyway, the
honest version is "production boot synthesises at most one line *per segment*",
which it already does.

---

## 2. The real audio bug: the mix was clipping

The brief is right that audio is broken; it is wrong about why, and the
screen recording the owner supplied is the best evidence in the repo.

```bash
ffmpeg -i "docs/Current UI Look recording with text to speech popping sound.webm" \
       -ac 1 -ar 48000 -f f32le rec.raw
```

Peak **1.183**, **55 samples past full scale**. The worst burst at 20.7 s is a
150 ms *swell* into +1.5 dBFS, not a step — so it was never a discontinuity
problem, which is why every pop-detector pass before this one came back clean
and the crackle stayed.

Cause, stated in the code's own comment:

```js
const STATION_LEVEL = 1.2;   // "applied *after* the limiter"
comp.threshold.value = -3;
comp.connect(masterGain);
masterGain.connect(ctx.destination);
```

The comment reasoned that the limiter bounds what reaches the make-up stage. It
does not. With a finite attack a fast transient passes before gain reduction
catches up, so a peak leaving the limiter near 0.98 becomes 1.18 — the measured
value to three figures.

Fixed in `b2c48dd`: make-up (`MAKEUP_GAIN`) moved in front of the limiter,
master pinned at unity as a fader only, limiter attack 3 ms → 1 ms.

Verified by driving every bus at once:

| condition | peak | clipped |
|---|---:|---:|
| normal broadcast | 0.051 | 0 |
| + music at mix level 1.0 | 0.563 | 0 |
| + 30 stacked one-shots at gain 1.0 | 0.484 | 0 |
| + bitcrush glitch | 0.848 | 0 |
| + commercial break | 0.872 | 0 |

**Constraint for whoever touches the mixer next: nothing goes after the
limiter except the mute/volume fader, and that fader never exceeds 1.0.**

---

## 3. §4's asset diagnosis is wrong about the cause, right about the symptom

Tested, not assumed:

```bash
# 120 random assets, sampled for fuchsia pixels and alpha mode
# -> 0 with magenta, 40/40 stored RGBA with real alpha
```

No magenta transparency artifacts. No rainbow palettes. The September decoder
rebuild (`d4ff5c0`) holds — it decodes all 4,316 frames byte-exact and matches
the shipped artwork at 100 % shape agreement.

What *is* real: a contact sheet of 60 random assets shows 3×3 and 7×3 tactical
chips blown up into solid colour blocks — one of them magenta, which is almost
certainly where the "magenta artifacts" impression came from — and in-game
interface (a tech tree, a grid, a row of text labels) sitting in the same pools
as footage.

So the fix is **admission, not decoding**. Every item now carries `pools`:

| pool | gate | count |
|---|---|---:|
| `broll` | ≥120×80, coverage ≥0.15, noise ≤70, ≥24 colours, not an interface archive | 76 |
| `portrait` | ≥100×100, coverage ≥0.15 | 132 |
| `sprite` | 16–160 px, coverage ≥0.05 | 399 |
| `chrome` | ≥24×16, ≥12 colours, coverage ≥0.2 | 27 |

38 items rejected as interface, 317 admitted nowhere.

Interface is *detected*, not listed: `ui_score` in `tools/extract_all.py`
measures how much of an image is long flat horizontal runs, ignoring the
backdrop colour and transparency so a figure on black does not score like a
menu. Calibrated against knowns — chrome 0.38–0.43, art ≤0.22 — with the gate
at 0.30. Palette poverty catches the rest: an empty bordered frame has 3–10
colours where real footage dithers across dozens.

`asset-registry.js` takes `{ pool: 'broll' }`, and the compositor and cutscene
manager query by pool instead of re-deriving size filters at each call site.
**If you add a new asset consumer, query a pool.** Re-deriving filters locally
is how the junk got in last time.

Acceptance (§4.3) re-run: `broll` sheet is planets, colony domes, bridge
interiors, alien portraits. Min dimensions in pool 174×130.

Each asset also has a JSON sidecar (`item_NN.json`) with source archive,
palette origin, frame count, native size, animation and admission.

---

## 4. What I did not build

The brief's main deliverable — the multi-anchor show format — is **not
started**. Nothing in §7 exists:

- no show-block scheduler
- no `js/characters.js` registry
- no anchor switching in `animator.js` / `renderer.js`
- no RSS → MOO-lore translation layer
- MOO resource ticker not written (ticker still generic)
- no exterior window backdrop rotation

I spent the budget on the two gates ahead of it (§3 verification, §4 pipeline)
and on the clipping bug, because art work sourced from an ungated catalogue and
mixed through a clipping output stage would have had to be redone.

`assets/generated/prompts.md` (§5) is written and covers the art those features
need: 60 prompts — 30 anchor portraits (10 species × hero/speaking/listening),
2 desk plates, 12 PIP cutaway subjects with their keyword routes, 16 exterior
backdrops across four moods and four times of day. Regenerate with
`python3 tools/prompt_bridge.py`. Nothing has been generated from them yet, so
every anchor-portrait path the character registry will want is currently absent.

**Suggested order from here:** generate the anchor portraits and desk plate →
`js/characters.js` → atomic swap in the renderer → scheduler → RSS translation →
ticker. The first two are independent and testable without the rest.

---

## 5. Voice

Local **Kokoro-82M** in `.venv` (Python 3.12 — `spacy`/`thinc`/`blis` have no
3.14 wheels, and Arch refuses system-wide pip under PEP 668). About 7× realtime
on CPU; `start.sh` prefers `.venv/bin/python`. `edge-tts` remains a fallback.
`/api/voices` publishes the catalogue and the selector is built from it, so the
voice list cannot drift from the engine.

The owner's standing judgement, from `tools/voice_audition.py`: the edge-tts
"Multilingual" models read too slowly and sit in the uncanny valley; Ryan and
the older generation held pace better. Default prosody is flat — the old −5 %
rate was itself much of what read as the anchor dragging.

**Per the brief's §9, do not swap engines during feature work.** If voice
quality is revisited, isolate it and benchmark before/after.

---

## 6. Tools

| command | does |
|---|---|
| `./start.sh --bg` / `./stop.sh` | on/off air; `stop.sh` finds the server by listening port and only reaps browsers carrying the harness's own debug port |
| `python3 tools/verify_assets.py` | every runtime asset path resolves locally (2,057 paths) |
| `python3 tools/drive.py 90 /tmp/run` | drives the broadcast over CDP, samples the director, screenshots each segment |
| `python3 tools/audio_probe.py 110` | clip count and level-relative pop detection per scripted event |
| `python3 tools/extract_all.py` | re-decode all 22 archives, rebuild manifest + sidecars (~24 s) |
| `python3 tools/prompt_bridge.py` | regenerate `assets/generated/prompts.md` |
| `python3 tools/voice_audition.py` | audition every voice the running engine offers |

The harness launches Chromium **muted** (`--mute-audio`); set
`GNN_HARNESS_AUDIO=1` if you need to hear a run. Without it an unmuted headless
browser plays the newscast out of the speakers with no window to close — that
happened, it is unpleasant, leave the mute on.

---

## 7. Carried forward

- **Listen before declaring audio done.** Every metric in this repo has at some
  point said "clean" while the owner could plainly hear a problem. The clipping
  in §2 is the second time a measurement passed on the wrong axis.
- `BACKGRND/item_32` (an orange interface box) still passes the B-roll gate. One
  marginal item in 76; tighten if it shows up on screen.
- `RENDER_FPS` is 20, not 10. `GNN_Report.md` is wrong about this.
- rss2json returns 429 during back-to-back harness runs. External.
