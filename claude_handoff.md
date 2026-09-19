# 🤖 GNN Agent Handoff

> **Written:** 2026-09-19 | **For:** the next coding session
> **Verified against:** the source in `js/` and `server.py`, plus headless broadcast
> runs, master/voice-bus pop captures, and before/after compressor gain-reduction
> measurements with a verified control.

---

## How to verify anything in this document

Do not trust a claim in here that you have not re-checked. The previous handoff was
accurate when written and wrong by the time it was read, because a fix landed in the
same commit as the report that called it outstanding.

```bash
./start.sh --bg                          # http://localhost:8080
python3 tools/drive.py 70 /tmp/gnn-run   # headless newscast; reports exceptions
python3 tools/audio_probe.py 110         # clips / pops / peak on the master bus
./stop.sh
```

**`audio_probe.py`'s pop count has enormous run-to-run variance.** Measured on
*unmodified* code it ranged 97 → 354 across four runs. A single before/after pair
tells you nothing; take three runs per side before you believe a difference. `peak`
and `worst jump` are far more stable and are the metrics worth reading.

---

## ⚠️ AUD-08 was NOT fixed — read this before trusting any audit

The previous handoff (and my own first pass over it) reported AUD-08 as done
because the sequence guard was *present* in `server.py`. Present is not
correct. `_latest_seq` was a single global high-water mark, while the client's
`requestId` restarts at zero on every page load — so once one session reached
sequence N, **every request from the next page load looked stale and was
refused with a 409, permanently, until the server was restarted.**

The anchor went mute on reload, or dropped to the browser's built-in
`speechSynthesis` (espeak on Linux), which is why the voices were reported as
sounding like TTS from five years ago and why the voice selector appeared
dead: `browserFallback()` ignores the selected voice entirely.

Fixed by scoping the guard per session (`server.py` `_latest_seq` dict,
`clean_session()`, `note_sequence(sid, seq)`, `superseded(sid, seq)`), with the
client sending a per-page-load `SESSION` nonce (`js/tts.js`). Verified:

```
A seq=5 -> 200   A seq=9 -> 200        # session A advances
B seq=1 -> 200   B seq=2 -> 200        # fresh page load, was 409 before
A seq=3 -> 409                         # genuinely stale, still dropped
```

The rest of Sonnet5Report (AUD-01…AUD-07, AUD-09…AUD-11, GEN-01…GEN-06) is
implemented and code-verified. **The lesson: verify behaviour, not presence.**

---

## What changed in this session

A spec report claimed nine architectural failures. **Four of them did not exist in
this codebase.** They are listed below with the evidence, because the next agent will
otherwise be handed the same report and re-derive the same conclusion.

### Fixed — the claims that were real

**Effects never ducked under the anchor.** `duckMusic()` was the only ducking in the
station, so a transition sweep or klaxon landing on a speech onset sat on top of the
voice at full mix level.
→ `sfxDuck` gain node between `sfxBus` and `stationBus` (`audio-engine.js:160`),
driven by `duckEffects()` (`:460`) and `duckUnderVoice()` (`:473`). Effects −10 dB,
music −14 dB while the anchor is on air. `tts.js:274` ducks, `tts.js:225` releases.

**Voice and SFX shared one master compressor.** At −14 dB / 6:1 with a 220 ms release,
an effect's transient drove gain reduction across the voice too — the effect ducked
the anchor, and the release held that attenuation over the following syllables. This
is the "muffled/underwater" symptom; it was the compressor, not a latched filter.
→ Voice bus has its own compressor (`:168-175`, −18 dB / 3:1, 5 ms attack, 180 ms
release) plus 1.25× makeup. Master is now a safety limiter (`:130`), with
`STATION_TRIM = 0.8` on `stationBus` (`:82`, applied `:148`) to hold headroom.

**Headline endings were cut mid-word.** `clean.slice(0, 900)` — a blind index cut,
violating architecture constraint #5 below. The anchor read the fragment as written.
→ `trimForSynthesis()` (`tts.js:148`) backs up to the last sentence in budget, or the
last whole word.

**Segment teardown clipped the final syllable.** The director tore down on the
`onended` edge, which fires as the last frame reaches the device, not as it is heard.
→ 280 ms release margin (`tts.js:167`, `:315-319`).

**Rundown ignored publication time.** `timestamp` was parsed and stored
(`feed-manager.js`) but **never used in ordering** — `enqueueAll` sorted on keyword
score alone, so a three-keyword story from yesterday outranked a plain one filed ten
minutes ago and kept outranking it for as long as it sat in the queue.
→ `storyScore()` (`broadcast-director.js:132`) applies `e^(−λ·age)` at a 6 h half-life,
re-scored on every top-up so queued items decay against new arrivals.

**Rundown clustered by subject.** Dedup was exact-title only, so a dozen feeds
covering one launch produced near-identical headlines that scored near-identically and
sorted into a block.
→ Entity tagging in `feed-manager.js:120-159` (24 entity groups, icon-subject
fallback) and `interleaveByTopic()` (`broadcast-director.js:154`) with a 3-slot
spacing window. Degrades gracefully: if the whole remainder is one subject it takes
the best item anyway rather than stalling the rundown.
Required `matchLabel()` (`icon-manager.js:73`) — `matchIcon()` returns an
`HTMLImageElement`, which carries no label to key a topic off.

**Commercial spots were over-ducking their own stings.** `main.js:310-312` passes
`duckSfx: 0.55` so spots keep effects closer to the voice than a news read does.

### Not fixed — the claims that were false

Check these before acting on any report that repeats them.

| Claim | Reality |
|---|---|
| No bus topology; everything routed into master | `sfxBus`/`musicBus`/`voiceBus` → `stationBus` has always existed. See the header diagram in `audio-engine.js`. |
| Glitch low-pass latches open, muffling later audio | `tapeStop()` always schedules the return to 20 kHz at `back + 0.8`, and `musicFilter` sits only on the music bus — it never touches the voice path. No latch path exists. |
| Buffers start/stop instantaneously, causing pops | `play()` already ramps 4 ms in and up to 20 ms out, and nothing calls `disconnect()` on a live node. Implemented in `5013078`. |
| Queue advancement races `AudioBuffer.duration` | Voice is an `<audio>` MP3 element advanced by `onended`. There is no buffer node and no duration read. Appending silent PCM would fix nothing. |

---

## The mix: what was actually wrong, and how it was measured

The station had a real, measurable fault that survived several rounds of
"tune the compressor": **gain staging**. edge-tts returns audio peaking at
0.52–0.79 depending on voice, and it entered the graph at unity — roughly 9dB
over the master compressor's threshold. Both compressors therefore worked
continuously *and only while the anchor spoke*:

| voiced frames | before | after |
|---|---|---|
| master gain reduction, mean | **−2.35 dB** (worst −5.53) | **0.00 dB** |
| voice gain reduction, mean | **−3.29 dB** (worst −7.68) | **0.00 dB** |
| master peak, p99 | 0.713 | 0.652 |
| master peak, max | 0.741 | 0.794 |
| master rms, mean | 0.1812 | 0.0984 |
| frames at/over full scale | 0 | 0 |

And on `tools/audio_probe.py`, the same instrument that swings 97→354 on the
pre-change build (four runs, mean 206):

| | before (n=4) | after |
|---|---|---|
| pops | 97 / 146 / 226 / 354 | **3** |
| worst jump | ~37× | **15.5×** |
| clipped samples | 0 | 0 |
| peak | 0.657 mean | 0.921 under forced stress |

A 206→3 drop is well outside that metric's noise, which is what confirms the
diagnosis: the pops were compressor gain-stepping, not buffer discontinuities.
The 0.921 peak is measured under the probe's deliberate stress segments
(oversized one-shots, klaxon, forced break) with zero clipped samples — that is
the limiter doing its job. Ordinary programme peaks at 0.794.

Silence measured 0.00 dB of reduction in both builds. The mix was being
modulated by the anchor's own syllables: that is the volume drifting up and
down, and a fast-attack gain step on every plosive is itself a click, which is
the per-word popping.

The fix is levels, not compressor settings. The voice enters at a sane
operating level, the master limiter sits *above* programme and reads 0dB
through an ordinary read, and the voice compressor is gentle with a 20ms
attack that sits past the transient rather than on it.

**Loudness is recovered after the limiter, never before it.** The old mix was
loud only because it was squashed; removing the pumping cost ~8dB, and level
came back via `STATION_LEVEL` on `masterGain`, which is post-compressor and so
cannot modulate the programme. Peaks now match the old build within 0.8dB
while RMS sits 5.3dB lower — that is restored dynamic range, not lost level.
Raising `STATION_LEVEL` past ~1.27 will clip; raise pre-limiter gain instead
and the pumping comes straight back.

### Measuring this yourself

`GNNAudio.getCompression()` returns live gain reduction in dB for both
compressors. **A compressor that reads non-zero through a normal read is
modulating the mix, not protecting it.** Sample it per animation frame on
voiced frames only (`isSpeaking()` stays true through the silent gaps inside a
read, which otherwise drags every average around).

Any such probe needs a control that must read non-zero, or it cannot tell
"nothing is wrong" from "the instrument is broken". Two measurements in this
session were invalid before that was added: one fed the control into
`getMasterBus()`, which is *post*-compressor and could never register; another
ran concurrent synthesis requests that starved the broadcast's own TTS through
`_tts_lock`.

`tools/audio_probe.py`'s pop count swings 97→354 on unmodified code — three
runs per side minimum, and prefer `peak` and `worst jump`.

---

## 🏗️ Architecture constraints — DO NOT BREAK

1. Canvas compositing order in `js/renderer.js` `renderFrame()` must be preserved:
   background → viewport → post-process blit → alert border → ghost → Orion badge → text.
2. All production assets stay in `assets/`.
3. Ticker bar stays inside the CRT screen bounds (`barY` inside `view.y + view.h`).
4. Server runs via `python3 server.py` on port **8080**.
5. Never use `substring(0, N)` / `slice(0, N)` on read copy without sentence-boundary
   detection. Both known violations are fixed (`feed-manager.js`
   `truncateSentenceCleanly()`, `tts.js` `trimForSynthesis()`); do not add a third.
6. Google Fonts loading in `js/main.js` stays in a non-blocking `try/catch`.
7. `musicBaseGain` must be set inside `playMusic()` before any `duckMusic()` call —
   ducking is a *multiplier* on the mixed level, never an absolute gain.
8. Every gain change on a live signal path goes through the `ramp()` helper
   (`audio-engine.js:110`). An instantaneous `setValueAtTime` on an audible node is a
   step discontinuity, which is exactly what a pop is.
9. Voice is the 0 dB anchor. Effects and music are mixed and ducked *under* it; do not
   restore master-level compression as the mix's primary level control.

---

## Known open items

- **Perceptual check by ear.** Every number above says the mix is clean and
  the anchor is forward; none of them say it *sounds* right. Start here.
- **Voice choice is subjective.** `python3 tools/voice_audition.py` renders all
  nine selector voices reading identical copy and reports their levels (they
  vary by 3.6dB peak between voices, which is its own source of perceived
  volume change). Reorder `VOICES` in `js/tts.js`; the first entry is default.
- **`RENDER_FPS` is 20, not 10** (`js/main.js:13`); `GNN_Report.md:40,43` still
  says 10. Documentation error only.
- **rss2json HTTP 429s** during back-to-back harness runs. External, pre-existing.
- **Decoded SFX buffers are never evicted** — bounded by the 41-file library,
  a known tradeoff rather than a leak.
