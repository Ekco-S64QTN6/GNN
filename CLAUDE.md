# CLAUDE.md — working notes and verified state

**This file is the single source of truth for what is broken, what is fixed, and
what must not be touched.** `README.md` is the public front page.
`docs/ROADMAP.md` is what is still to build.

Last verified at commit `056c5a9`.

---

## 0. The rule that matters most

**Verify behaviour, not presence.** This project has a long history of documents
claiming fixes that had not landed, and of fixes aimed at the wrong cause. Two
examples from the most recent round, both of which would have cost a full
session if taken on faith:

- A brief asserted that every page load fired one TTS request per voice in the
  catalogue. It does not. Those log lines were `tools/voice_audition.py` run by
  hand against the same server. A clean boot makes three requests.
- The same brief asserted the asset extractor emitted magenta transparency and
  rainbow palettes. It does not. 120 sampled assets: zero fuchsia pixels, all
  RGBA with real alpha.

Both were plausible, both were written confidently, both were wrong. Before
acting on any claim in any document — including this one — run the command next
to it.

The corollary bit twice on audio: **a measurement that passes can still be the
wrong measurement.** Pop detection said the mix was clean for three sessions
while the owner could plainly hear crackle, because the fault was clipping, not
discontinuity. When someone says they hear a problem and your metric disagrees,
the metric is the thing to doubt.

---

## 1. Current verified state

| | |
|---|---|
| Voice engine | Kokoro-82M, local, in-process, ~7× realtime on CPU |
| Fallback | `edge-tts` (cloud) when `.venv` is absent |
| Assets | 873 items / 4,316 frames, decoded byte-exact from 22 LBX archives |
| Admitted pools | 76 broll · 132 portrait · 399 sprite · 27 chrome |
| Output ceiling | peak 0.872 under deliberate overload, zero clipped samples |
| Per-line loudness | −19.3 to −20.3 LUFS, 1.0 LU spread, true peak −3.0 dBFS |
| Spoken lines | 22 consecutive, 0 truncated |
| Broadcast | runs the full rundown with zero exceptions over 90 s+ |
| Frame | 320×180 design grid, 1280×720 canvas, follows the window, full-bleed |
| Plates | conditioned at canvas resolution, not the design grid |
| Cast | 11 generated species + the MOO1 robot, keyed out of his own scene |
| Characters | `js/cast.js` — 12 profiles, voices and an asymmetric relationship table |
| Voices | 9 shortlisted by ear, plus `vox_unit` (a DSP robot, not a model) |

Verify all of it:

```bash
./start.sh --bg
python3 tools/verify_assets.py          # 2,057 paths resolve locally
python3 tools/drive.py 90 /tmp/run      # full rundown, counts exceptions
python3 tools/audio_probe.py 110        # clips + level-relative pops
./stop.sh
```

---

## 2. Architecture constraints — do not break

Load-bearing. Each one is here because breaking it caused a bug that took a
session to find.

1. **Canvas compositing order** in `renderer.js` `renderFrame()`:
   clear → viewport → post-process blit → alert border → ghost → Orion
   badge → caption. The viewport *is* the canvas: the picture fills the
   window and there is no set drawn around it. The MOO1 TV chrome
   (`background_tv.png`) is deliberately not drawn any more.
2. **All production assets stay in `assets/`.** Generated art goes in
   `assets/generated/` under the same discipline.
3. **The bottom of the frame is a stack and `GNNRenderer.bottomStack()` owns
   it** — ticker, then the name/LIVE row, then the chyron. Two modules draw
   into that region; working the offsets out separately in each is how the
   name card and the chyron came to be printed over one another. Ask, do not
   re-derive. Same rule for any label placed after another: measure it
   (`ctx.measureText`), never assume a fixed offset, which is what printed the
   PIP label over its own LIVE tag.
4. **Server runs via `python3 server.py` on port 8080**, started through
   `./start.sh` so the `.venv` interpreter is used.
5. **Never `substring(0, N)` / `slice(0, N)` on read copy** without
   sentence-boundary detection. Two violations were fixed
   (`feed-manager.js truncateSentenceCleanly()`, `tts.js trimForSynthesis()`);
   do not add a third.
6. **Google Fonts loading stays in a non-blocking `try/catch`** in `main.js`.
7. **`musicBaseGain` is set inside `playMusic()`** before any `duckMusic()`.
   Ducking is a *multiplier* on the mixed level, never an absolute gain.
8. **Every gain change on a live signal path goes through `ramp()`**
   (`audio-engine.js`). An instantaneous `setValueAtTime` on an audible node is
   a step discontinuity, which is what a pop is.
9. **Voice is the 0 dB anchor.** Effects and music are mixed and ducked under
   it. Do not restore master-level compression as the mix's primary level
   control.
10. **Nothing goes after the limiter except the mute/volume fader, and that
    fader never exceeds 1.0.** Make-up gain belongs in front of the limiter. A
    limiter does not bound its output — transients pass before gain reduction
    engages — so post-limiter make-up multiplies the overshoot straight past
    full scale.
11. **Asset consumers query a pool**, never re-derive size filters locally.
    `GNNAssets.find({ pool: 'broll' })`. Local filtering is how tactical chips
    and interface screens got into the footage pools last time.
12. **The test harness launches Chromium muted.** `GNN_HARNESS_AUDIO=1` to hear
    a run. An unmuted headless browser plays the newscast out of the speakers
    with no window to close.

---

## 3. Bugs fixed, with the evidence

Kept because each one explains a constraint above, and because the wrong
diagnosis is as useful to record as the right one.

### LBX decoder — vertical streaking on most artwork
Two independent bugs, both invisible on the artwork the decoder had been
verified against. A column is a *sequence* of runs, not one (60 % of the library
has two or more); and the byte after each run's pixel count is a **gap from the
end of the previous run**, not an absolute `y`. The anchor and story icons are
one run per column, so they decoded identically either way and a spot check
passed while every planet, console and cinematic was quietly wrong. Settled
against `NEWSCAST.LBX` item 0, which *is* `background_tv.png`: absolute offsets
reproduce 60.1 % of its pixels, gap offsets reproduce 100 %.

Colour was also unified to `(v << 2) | (v >> 4)`; the old pipeline disagreed
with itself across archives (raw 6-bit, `v<<2`, and `v×255/63` all appeared).

### Mix clipping — the actual cause of the crackle
`STATION_LEVEL = 1.2` applied *after* the limiter. Measured from a screen
capture of the running app (local, not committed): peak **1.183**, 55 samples
past full scale, worst event a 150 ms swell into +1.5 dBFS. 0.98 × 1.2 = 1.18,
matching to three figures.
→ constraint 10.

### Voice level dipped between lines — normalising peak, not loudness
The anchor dropping in volume for a line and coming back. The normaliser used
peak as a hard ceiling:

```python
gain = TARGET_LUFS - lufs
gain = min(gain, TARGET_PEAK_DB - peak)    # ceiling always won
```

Measured at the endpoint, every line came back at exactly −3.0 dBFS peak and
anywhere from −19.7 to −27.8 LUFS. The ceiling bound on *every* clip, so what
was actually normalised was the peak — crest factor translated straight into
perceived loudness, and one sharp plosive in a long read dragged that whole
read 8 dB below the short line before it. In the owner's capture this showed as
a **16–23 dB spread between utterances**.

Loudness is now normalised; peaks are *limited* rather than setting the gain.
The limiter works on sample peaks while the target is a true peak, so it sits
1.8 dB below to leave inter-sample headroom. Across seven lines of 1.8–15.3 s:
**8.1 LU spread → 1.0 LU**, max true peak −3.0 dBFS.

→ **Normalise loudness and limit peaks. Never let a peak ceiling set the gain
of a whole clip.**

### `duckMusic()` un-ducked to unity
Treated its argument as an absolute gain rather than a multiplier on the mixed
level, so the bed swelled to full scale at the end of every spoken line.
→ constraint 7.

### Lines cut off mid-sentence
`beginHold()` ran a bare timer with no `!speaking` check, and synthesis latency
was nowhere in the clock — audio started 1–4 s after its segment while timers
ran anyway. Clips are now fetched before they play, breaks are pre-synthesised,
and each ad shot holds until its voice-over resolves. 6 of 24 truncated → 0 of 22.

### `glitchCrush()` step discontinuity
Hard-set wet/dry gains with `setValueAtTime` and swapped a live WaveShaper curve
mid-signal. 178–234 pops → 0. → constraint 8.

### One-shots at unity
The per-call `GainNode` was left at its 1.0 default while relying on a scheduled
ramp that can land in the past, so effects intermittently fired at full scale.

### The limiter was crushing every word
The fix above traded one fault for another. The local engine outputs at -26 to
-28 LUFS with peaks only 4-10dB below full scale — quiet body, tall plosives —
so lifting it to a -19 LUFS target with gain alone drove peaks over and left
the limiter removing **up to 10.1 dB** (toss 3.6, ident 7.4, banter 6.1, long
10.1). That is heard as every word being stepped on, and because the amount
varies per clip it is also why one story sounded fine and the next was mangled.

Gentle compression now runs in front of the gain, so the clip can reach the
target without the limiter doing the levelling. Settings came from a sweep of
threshold/ratio/target against measured limiter reduction *and* retained
loudness range — the engine's raw LRA is only 2.9 LU, so compression costs
almost no dynamics here because the crest is isolated plosives, not expression.

| | limiter removes | spread | peak | LRA |
|---|---|---|---|---|
| target -19, no compression | **10.1 dB** | 8.1 LU | -3.0 | 1.6 |
| 4:1 above -24dB, target -21 | **1.8 dB** | 0.5 LU | -4.6 | 1.3 |

→ **A limiter is a safety net, not a leveller. If it is removing more than a
decibel or two, the stage in front of it is wrong.**

### The anchor spelled words out
Wire headlines arrive in capitals, and every engine reads an all-capital word
as an initialism, so PUTIN came out "P, U, T, I, N" on roughly one read in ten.
From the text alone PUTIN and NATO are indistinguishable; the surrounding text
is what tells them apart. `unshout()` in `tts.js` treats capitals as formatting
when the line is mostly capitals (a wire headline, where they carry no meaning)
and as deliberate otherwise. A short allowlist — US, EU, BBC, FBI and the like
— keeps the initialisms that really are spelled.

It mispronounces the occasional genuine one: IAEA becomes "Iaea". That is the
owner's explicit preference — **a wrong pronunciation passes, a spelled-out
word does not.**

### The caption drew over the commercials
A break sets its own type: product name, tagline, its own margins. The
teleprompter caption was still being drawn on top of it and put a panel
through the tagline. The break owns the frame while it runs.

### Plates were conditioned to the design grid and upscaled back
Everything was fitted to 320×180 and then blown up four times by the canvas,
while the anchors — larger plates drawn smaller — were blown up about twice.
The set carried four times the blur of the people standing in it. The chunky
pixel look belongs to the source art, which already has hand-sized pixels in
it; resampling down and back up does not add it, it destroys it.

→ **Condition a plate at the size it is drawn.** `condition_plates.py` reads
`BASE_W`/`BASE_H`/`SCALE` out of `renderer.js` so this cannot drift again.

### The desk was sized by width and fell out of frame
At full frame width it was 425 px tall in a 720 px frame drawn from the seat
line, so the oval top filled the shot and the front panel — the lit strip,
the hazard stripes, the emblem — was below the bottom edge. It read as a
boardroom table a few metres away. It is sized by **height** now, between the
seat line and just past the bottom of the frame, and the width follows.

→ **Size a prop by the dimension that is constrained.** For anything meeting
the bottom of frame that is the height.

### Two-state mouths never closed
Cast art with `hero`/`speaking` read the animator's frame index, which is
non-zero for every moment of an utterance, so the mouth opened on the first
syllable and shut on the last. It follows `GNNAnimator.mouthLevel()` now — the
smoothed envelope, which moves at the speed of speech. The MOO1 robot is
unaffected: he has a real 25-cel matrix and indexes it directly.

### The mouth never shut, and the cause was the audio fix
Two-state cast art opened on the first syllable and shut on the last. Measured
in the running app: **248 consecutive samples of speech, zero open/shut
transitions.**

Three attempts missed because each assumed the envelope was there to read. It
is not, and the reason is upstream: the voice is compressed to about a
decibel of variation on the way out of the server, which is what makes the
station sit at an even level. The level fix removed the signal the lip-sync
was reading.

Two-state art now flaps on a syllable clock — roughly five a second, shut
half shorter than open, loudness only nudging the timing. **0 → 71
transitions in ten seconds of speech.** The MOO1 robot still indexes his real
25-cel matrix off the envelope, because with 25 frames there is something to
index.

→ **A fix in one stage can remove the input another stage depends on.**

### The mirrored plate came out as a thumbnail, and flipped the badge
Two faults in one feature.

A whole-image horizontal flip turns the glance the right way and turns the
station badge into backwards lettering with it. Mirroring **above the neck
only** and leaving the body alone moves the face and keeps the uniform — the
same trick that put the badges back after the edit prompts blanked them.

Deriving it part-way through conditioning then put a miniature in the corner
of its own canvas: the mirrored raw plate went back through the body graft,
the hero crop and the resize, and came out framed as if it were a different
picture. It is made from the **finished** plate instead, which is already
framed, and the only thing left to do to it is the mirror.

→ **Derive a variant from the finished asset, not from the middle of the
pipeline that made it.**

### `neck_row` assumed every head has a neck
A Bulrathi's mane and a Mrrshan's hair run straight into the shoulders, so the
silhouette only ever widens and `argmin` returned wherever the search started
— 392 on a plate where every other species gave about 700. `graft_body` then
cut above the mouth and the speaking plate came out with the hero's mouth shut
on it. The pinch now has to be a real one, narrower than the band around it
and not against either end of the search, or a fixed fraction is used.

### Cropping each state to its own content un-registered them
`crop_to_content` per plate gives a turned head a different bounding box, so
the three states came out different sizes and could not be compared, let alone
crossfaded. One box, taken from the hero, for the whole species.

### Two generations of anchor plate, one set of filenames
The chest-cropped plates and the full-torso ones both used
`<sid>_desk_hero.png`, in different directories, and nothing said which was
which. The full-torso set is canonical and lives in `_inbox/`; the
chest-cropped set is archived in `_inbox/field/`, where it is the right art
for a correspondent in the over-the-shoulder monitor.

**Grafting one generation's head onto the other's body does not work.** It
was worth trying — the old plates carry the expressions and the new ones
carry the body — and the silhouettes can be aligned to within two pixels,
which is what the measurement reported. The face still lands at the wrong
size, because the two generations draw the head with different internal
proportions: matching the outline does not match the features inside it. No
rigid scale and offset fixes that. The variants have to be generated from
the new heroes.

→ **A measurement that says two things match is not the same as them
matching.** The owner looked at the result and was right; the metric agreed
with itself and was wrong.

### The glitch engine queried the catalogue with no pool
`ghost_signal` and `interference` called `GNNAssets.pick()` and `find()`
without naming a pool, which reaches past admission entirely — so the ghost
flashed up the galaxy setup screen, Size and Difficulty and Opponents and two
buttons, over a failing broadcast.

The scrambled items it actually wanted were admitted to **nothing**
(`pools: []`), which is why it was querying raw in the first place. They have
a pool of their own now — `glitch`, 30 items, noise above 95 and UI score
under 0.11 — and both faults draw from it, falling back to `broll`.

→ **Constraint 11 is not advice.** An asset consumer that names no pool is
reading the unadmitted set.

### Easter eggs pointed at a layout that no longer existed
Two of the six secrets were hit-tested against literal pixel rects measured
off the old 960×600 canvas: a globe that is no longer drawn, and an "anchor
optics" box that now covers empty sky above the desk. Both were dead. Hit
regions come from `GNNRenderer.hitRegions()` now, derived from where the
cast and the monitor are actually drawn this frame.

The glitch engine's `anchorOverride` had gone half-dead the same way. It
returns a cel index, which the MOO1 robot still indexes directly, but
two-state cast art reads the envelope — so `desync` and `flicker` bent the
robot's mouth and left the generated anchors unaffected. The override now
writes through to the envelope as well.

→ **A hit region belongs to whoever does the drawing.** A second copy of
the geometry is a second thing to forget.

### `getcolors()` returns None, and `or []` made that zero
`conditioned_already()` counted colours with `len(im.getcolors(1 << 16) or [])`.
Above 65536 colours that call returns `None`, so the richest possible image
counted as having **no** colours and read as already conditioned — which is
why fourteen raw cutaways sat untouched through several runs of the tool
that exists to condition them.

→ **A sentinel is not an empty collection.** `palette_size()` now returns a
large number when the count overflows.

### Static files had no `Cache-Control`
Served with only `Last-Modified`, so browsers cached the JS heuristically and
could skip revalidation entirely — a fixed `audio-engine.js` kept serving stale
for hours, and any recording made afterwards measured the *old* build. Static
responses now send `no-cache, must-revalidate`; unchanged files still answer
304. **If a fix appears not to have taken effect, suspect this before
re-debugging the fix** — and hard-reload (Ctrl+Shift+R).

### `stop.sh` killed its own shell
Matched strays with `pgrep -f "python3? .*server\.py"`, which also matches any
shell whose argv mentions the file. Now finds the listener by port.

### The README lied
It claimed "zero-cloud" while `edge-tts` called Microsoft on every line. Fixed
by making it true (Kokoro, local) rather than by editing the sentence.

---

## 4. Claims that did NOT reproduce

Do not re-chase these. Each cost real time.

| Claim | Test | Result |
|---|---|---|
| Boot fires one TTS request per voice, `seq=0` | fresh log, one page load, no interaction | **3 requests** — ident, dry line, first story |
| Extractor emits magenta transparency | 120 sampled assets scanned for fuchsia | **0** |
| Extractor emits rainbow palettes | same sample + contact sheet by eye | **0**; ~8 scrambled items remain, flagged `noise > 95` and routed to the glitch engine on purpose |
| Assets use a keyed transparency colour | check PNG mode | **40/40 RGBA**, real alpha |

The `seq=0` burst in old logs is `tools/voice_audition.py`. Its tells: spoken
name labels (`Michael.`, `Fenrir.`), the tool's own `COPY` string verbatim, and
`+`-encoded spaces from `urlencode` where the browser uses `%20`.

---

## 5. Tools

| command | does |
|---|---|
| `./start.sh [--bg]` / `./stop.sh` | on/off air; `stop.sh` finds the server by listening port and only reaps browsers carrying the harness's debug port |
| `python3 tools/verify_assets.py` | every runtime asset path resolves locally |
| `python3 tools/drive.py 90 /tmp/run` | drives the broadcast over CDP, samples the director, screenshots each segment |
| `python3 tools/audio_probe.py 110` | clip count and level-relative pop detection per scripted event |
| `python3 tools/extract_all.py` | re-decode 22 archives, rebuild manifest + sidecars (~24 s) |
| `python3 tools/prompt_bridge.py` | regenerate `assets/generated/prompts.md` |
| `python3 tools/voice_audition.py` | audition every voice the running engine offers |
| `python3 tools/capture_docs.py` | re-shoot the README screenshots |

`tools/lbx.py` is the LBX container + LBXGFX decoder. Format notes live in
`assets/README.md`.

---

## 6. Environment

- `.venv` is **Python 3.12**, not the system 3.14: Kokoro's phonemiser
  (`spacy` → `thinc` → `blis`) has no 3.14 wheels, and Arch refuses system-wide
  pip under PEP 668. `start.sh` prefers `.venv/bin/python`.
- Torch in the venv is **CPU-only** and deliberately so — Kokoro is 82M params
  and runs ~7× realtime without the GPU. No CUDA wheel needed.
- `Master of Orion 1/` is gitignored and only needed by the extractors. The app
  runs without it; `verify_assets.py` proves that.

---

## 7. Known open items

- **The set plate and the cast are not generated yet.** `renderer.js` takes
  `assets.set`, `assets.desk` and `assets.cast` and builds the room in layers;
  with none of them it falls back to the MOO1 newscast frame, which is a
  finished picture rather than a set. The existing `set/studio_wide_empty.png`
  is 2.77:1 from before the frame went 16:9, so it is cover-fitted and loses
  its top and bottom — it wants regenerating at the new shape.
- `capture_docs.py` **waits for live wire states and hangs** when the feeds
  return 429 to back-to-back harness runs, because the director never reaches
  the state it is waiting on. The screenshots in `docs/` were re-shot by
  driving it instead — enqueue stories, then force the states rather than
  wait for them. Worth folding back into the tool.
- **A pupil-centroid metric said nine of eleven `listening` plates had no eye
  turn. It was wrong too** — the regenerated plates visibly turn. Two metrics
  in a row claimed to see something the owner's eye contradicted, and the eye
  was right both times. Show a picture before claiming a plate is broken.
- **A diff percentage cannot tell you whether an edit happened.** The image
  model redraws the whole plate, so 5–27% of every band differs as noise. A
  `listening` band reporting 8.7% changed looked healthy and was the hero
  untouched; measuring whether the *pupils moved* found nine of eleven had no
  eye turn at all. Measure the feature, not the pixels.
- **Listen by ear before declaring audio done.** Every metric here has at some
  point said "clean" while the owner could hear a problem.
- **Voice choice is subjective.** Owner's standing judgement: the edge-tts
  "Multilingual" models read too slowly and sit in the uncanny valley; Ryan and
  the older generation held pace. Default prosody is flat — the old −5 % rate
  was much of what read as the anchor dragging.
- `BACKGRND/item_32` (an orange interface box) still passes the B-roll gate.
  One marginal item in 76.
- `RENDER_FPS` is **20**, not 10.
- rss2json returns HTTP 429 during back-to-back harness runs. External.
- **Never put a process pattern in the same command as the text it matches.**
  `pkill -f` has killed the shell issuing it four times in this project,
  twice through a heredoc that merely *mentioned* the target filename. Select
  the pids first with `ps -eo pid,comm,args` filtered on `comm`, then kill
  those pids.
- **`pgrep -f <pattern>` matches the shell that is running the check**, so a
  check for leftover processes reports its own command line as a survivor.
  This produced a false "window left behind" and a false "launcher still
  running" in one session, and once killed the shell doing the killing. Filter
  on `ps -o comm=` as `stop.sh` does, never on the command line alone.
- **Do not run `./stop.sh` while a CDP probe is running** — it reaps the
  harness browser and the probe dies mid-measurement. This has cost three
  measurement runs.
- Decoded SFX buffers are never evicted — bounded by the 41-file library, a
  tradeoff rather than a leak. Music beds are LRU-capped at 4.
