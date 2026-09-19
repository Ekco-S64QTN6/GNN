# 🤖 GNN Agent Handoff

> **Written:** 2026-09-18 | **For:** the next coding session
> **Verified against:** the actual source in `js/` and `server.py`, plus two headless
> broadcast runs and seven `tools/audio_probe.py` captures.

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

## ✅ Everything from Sonnet5Report is fixed

All of AUD-01 … AUD-11 and GEN-01 … GEN-06 are implemented and code-verified.
**AUD-08 included** — the previous handoff listed it as the one outstanding item, but
the server-side sequence guard is in `server.py:53-66` (`_latest_seq`,
`note_sequence()`, `superseded()`), the lock is acquired in 0.2 s slices so a stale
request bails with a 409 instead of queueing, and the client sends the nonce at
`js/tts.js:295`. It shipped in commit `5013078`.

There is no outstanding work from that audit. Do not re-open it.

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

## Measured effect of the audio changes

Seven probe runs, 110 s each, three on the new graph and four on the pre-change code.

| Metric | Before (n=4) | After (n=3) |
|---|---|---|
| Clipped samples | 0 | 0 |
| Peak | 0.649, 0.659, 0.712, 0.609 → **0.657** | 0.485, 0.496, 0.530 → **0.504** |
| Worst jump | 36.2, 37.6, 37.7, 37.6 → **37.3×** | 37.7, 33.7, 28.1 → **33.2×** |
| Pops | 146, 97, 226, 354 → **206** | 109, 243, 373 → **242** |

Peak headroom improved consistently and non-overlappingly (~2.3 dB). Pops and worst
jump are statistically indistinguishable given the variance noted above.

**Perceptual quality is unverified.** The probe measures discontinuities and level, not
whether the anchor now sits forward of the effects. That needs a human listening.

### A tuning trap, recorded so it is not repeated

The first attempt raised the master threshold to −6 dB and added 1.6× voice makeup.
That made the mix *hotter*, not better balanced: peak 0.964, against a baseline range
of 0.609–0.712. Backing the master compressor off without trimming the sum just moves
the mix onto the limiter. If you loosen the master again, trim `STATION_TRIM` to match.

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

- **Perceptual audio check** — the whole point of the session's audio work, unverified
  by ear. Start here.
- **`RENDER_FPS` is 20, not 10** (`js/main.js:13`). `GNN_Report.md:40` and `:43` still
  say 10 FPS. Documentation error only.
- **rss2json HTTP 429s** — five feeds rate-limit during back-to-back harness runs.
  Pre-existing, external, present in baseline captures too. Not a code fault.
- **Decoded SFX buffers are never evicted.** Bounded by the 41-file library, so it is a
  known memory tradeoff rather than a leak. Music beds already have LRU eviction.
