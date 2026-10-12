```markdown
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
| Cast placement | `CAST.h` 0.300 of frame height, seated at `DESK_LINE` 0.468 — the back of the desk surface |
| Plates | conditioned at canvas resolution, not the design grid |
| Cast | 11 generated species + the MOO1 robot, keyed out of his own scene |
| Characters | `js/cast.js` — 12 profiles, voices and an asymmetric relationship table |
| Voices | 9 shortlisted by ear, plus `vox_unit` (a DSP robot, not a model) |
| Anchor variants | all eleven species have `desk_hero` and `speaking`; `listening_flip` not re-derived from the newest plates |
| Robot frames | 25 cels in `assets/generated/anchors/robot_frame_*.png`, produced by `python3 tools/key_robot.py` |
| Studio sets | five — `studio_wide_empty.png` plus `market_`, `geopolitics_`, `tech_`, `celebrity_wide_empty.png`. The four new ones have black window panes not yet keyed |
| Cutaways | regenerated; plates in `assets/generated/cutaways/` |
| Backdrops | generated; full set in `assets/generated/backdrops/` |
| Show logos | five, in `assets/generated/logos/` — not wired into the renderer |
| Story icons | regenerating into `assets/generated/icons/`, partial |
| Prompt library | `assets/generated/Prompts/` — all prompt `.md` files, one per asset class |
| Speaker attribution | per-line; `activeSeatForLine()` and `speakerIsSeated()` in the director, read by renderer, text engine, animator |
| Main desk beat | `human` and `mrrshan_f` both cover world · diplomacy · science · tech · fleet · anomaly; markets held for the trade/resource/industry desks |
| Two-anchor beats | structured conversations — `GNNScript.banterBeat()` and `exchange()` return tagged arrays, `GNNDirector.queueTaggedLines()` queues them; `twoWay()` rolls brief / standard / extended shapes |
| Scene review | `tools/scene_review.html` — opens at `/tools/scene_review.html`, renders each MOO1 recipe as `.webm` or contact sheet |

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

### The rundown read the same storm four times
Owner: *"every time I fire it up it's doing the duplicate reading of
hurricane Isaias."* The BBC science feed served **four separate Hurricane
Isaias stories in one pull** — different headlines, different summaries,
and all dated that morning despite being from 2020, so no staleness filter
catches them. `feed-manager.js` deduplicated on the exact title string, so
all four went into the rundown and were read back to back.

Two headlines are now treated as one story when they share a word that
almost nothing else in the pool uses. One shared rare word is enough —
some of those four shared only "isaias" — but it has to be rare, measured
as document frequency across the live pool (`DISTINCTIVE_DF = 5`), or
every story mentioning "space" collapses into one. The losers stay in the
pool for a later block rather than being dropped, which is what a channel
does with a running story.

Replayed against the live feeds: 69 headlines, 4 Isaias, one admitted and
the rest held. Confirmed in the running app — 12 in the rundown, one storm.

→ **Deduplicate on subject, not on string.** A wire runs the same story all
day under four headlines, and that is normal behaviour, not a feed fault.

### The asset prompts still asked for pixel art
`prompt_bridge.py` generates all of `prompts.md` from one `STYLE` constant,
and that constant was still the 1993 VGA line the owner had rejected five
times — so every regeneration of the document reinstated it. It now carries
the settled style from `set-prompts.md`, and pixel art is in the exclusion
list as well as denied in the style line, because saying it once only sets
a tone.

The backdrop prompts asked for their subject *"seen through a studio
window"*, and the model drew the studio: `earth_globe_dusk` came back as a
shot from inside a space station with a man standing in it. The engine keys
these into the window opening, so the glass and the room are already there.
They now describe the exterior view alone and exclude figures, frames,
glass, interiors and foreground objects outright.

The day cycle also asked for a *"violet sky"* on three backdrops that are
in vacuum. Asked for a sky, the model supplies an atmosphere, and the
quickest way to justify one is to put the camera somewhere with a window.
`ORBIT_CYCLE` lights those three by the sun and the starfield instead.

→ **A generated document cannot be fixed by editing the document.**

### The mouth ran on a free clock and the prompter ran on an estimate
Owner: *"the TTS and the mouth animation aren't perfectly lined up"* and
*"text should be written out as the TTS is saying the words... the mouth
animation only happening while a word is being spoken."*

Both were true, and the note elsewhere in this file saying the envelope was
unusable had gone stale. Measured live through the analyser during a read:
level runs **0.002 to 1.000, median 0.628**, with pauses between sentences
showing as runs of 400 ms or more below 0.10. The compression change
earlier gave the envelope back; the lip-sync was still working around its
absence.

The syllable clock is kept — it sets the flap *rate* — but it is now gated
on the envelope, with a 90 ms hangover so a consonant does not chatter it
shut mid-word. Measured after: **mouth open 1–2% of samples during silence,
56–57% during speech.**

The teleprompter typed from `durationMs`, an estimate of how long the line
ought to take. Close, which is worse than wrong: the two drift apart over a
long read. `GNNTTS.playbackProgress()` exposes the audio element's real
position and `text-engine.js` types to it, a few percent ahead the way a
prompter runs. Measured drift across a read: **0.008 → 0.051**, landing
together at 1.000.

→ **A workaround outlives the fault it was written for.** Re-measure before
trusting a note that says a signal is not there.

### Six faults, one cause: nothing waited its turn
Owner's list after a watch: the station ident interrupted, the commander
cut off mid-line by the other anchor, a line written for one character
spoken in the other's voice, the throw to the break stepping on the story,
the break returning over the last advert, and every cutaway talking over
itself.

One cause. `GNNTTS.speak()` bumps its own request id and **cuts off whatever
is already playing**, and every `say()` in the director was fire-and-forget.
Any line fired while someone was talking killed the line in progress, and
which line won was a race — which is why the owner saw it behave differently
on two consecutive runs of the same build.

There is a single speech queue now. Nothing speaks directly; lines are
queued and a pump plays them one at a time with a 420 ms beat of air
between them, and **the caption is presented when its own line starts**
rather than when it was scheduled, which is why the text box used to appear
before the voice. `cancelSpeech()` clears the queue; the break awaits
`drainSpeech()` before the commercials roll and polls `isBreakActive()`
before coming back.

→ **A fire-and-forget call into something that pre-empts itself is a race,
not a sequence.**

### The same line four times in five minutes
`pickFrom()` was a bare random pick with no memory, so on a list of four the
same line came round constantly — "the Commander would like us to be precise
about this" four times in five minutes. Random with replacement feels
repetitive long before it is statistically odd. It now holds back the recent
half of each list, which still always returns something on a short list.

### The wire ran dry and the channel had nothing to say
rss2json's **daily** cap (see Known open items) leaves every feed erroring at
once. `server.py` serves `/api/localnews`, which parses the newest Gemini
digest out of `~/github/Kaiacord/knowledge_base/news/daily` — section
headings mapped onto the show blocks — and `feed-manager.js` falls back to it
when a poll returns nothing. Verified with the wire capped: **12 stories in
the rundown after 22 s, from the local digest.**

### The tool fed its own output back in and the mouth rotted
Owner: *"human_speaking.png's mouth is weird now... this is a critical
issue."* Correct, and it had been getting worse on every run.

`swap_region()` blends two 256-colour plates and invents colours, and the
result was saved **without quantising** — 1,044 colours on the human.
`conditioned_already()` tests exactly that: size, and palette ≤ 256. So the
tool's own output failed its own "is this finished?" test, `find_source()`
picked it up as **source art** on the next run, `register()` scaled a 216px
plate up by 5.5 to match the hero, and the whole pipeline ran again on a
picture that had already been through it. Every run cost another generation
of quality, and the mouth region was being computed from a blurred 5.5×
upscale.

Found by printing what was actually in the source directory:

```
_inbox/human_speaking.png      222x216   1044 colours
_inbox/klackon_speaking.png    218x216   1046 colours
_inbox/mrrshan_f_speaking.png  214x216   1421 colours
```

All three should have been 1254×1254. Fixed by quantising both rebuilt
states, refusing to archive a rebuilt state into `_inbox` at all, and
restoring the raws. Checked after: **no plate over 256 colours.**

This is the third time the same shape of bug has bitten — the Klackon's
flip shrank to a thumbnail the same way, and before that a damaged flip was
archived as if it were a hand-made source.

→ **Never write a tool's output where it looks for its input.** If that
cannot be avoided, the "already done" test must be something the output
passes by construction, not by luck.

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

### The conditioner was grafting one plate onto another
`graft_body()` pasted the hero's body onto every variant, cut at a row
measured off the *hero's* silhouette and blended as raw RGBA. Two kinds of
damage, both obvious the moment a raw drop and the output were put side by
side: on the Klackon the cut fell through the mandibles and took the jaw
off, and on the Mrrshan the blend mixed in the colour behind transparent
pixels, giving her ghosted shoulders and **two GNN badges on one chest**.

It is gone. Variants are whole coherent drawings when they arrive; they are
registered and conditioned, nothing is pasted. The badge problem it was
written to solve is a regeneration, not a repair.

Deriving `listening_flip` by mirroring the head went the same way — three
cut rules, three cut faces — and is also gone. A supplied flip is
conditioned like any other state.

→ **A plate that is only ever scaled and translated cannot come out
damaged.** Anything that cuts one picture and pastes another onto it can,
and eventually will.

### Separate generations do not come back at the same size
`mrrshan_f_speaking` arrived 8.5% smaller than her hero and shifted up and
left, so she changed size the moment she opened her mouth. The graft had
been hiding it by replacing her body with the hero's.

`register()` scales and shifts each variant onto the hero, lining up the
lower body — the torso and folded hands are the same in every state.

Two refinements on top of that were tried and both reverted. A best fit
over the whole silhouette halved the total mismatch and moved the face to
do it (head drift 10px → 17px while the metric improved). A best fit over
the head alone held the face still and moved the body, which is just as
visible: the viewer sees the plate jump, not which part of it jumped.

→ **Registering two whole plates cannot fix this**, because two
generations never agree everywhere. See the entry below: the answer was to
stop swapping whole plates.

### The whole body moved when only the mouth should have
Owner, watching a read: *"only the mouth should move, not their entire
body — it's like each image is pegged to a slightly different x y coord."*
Correct, and no registration fixes it: swapping two whole plates swaps
every disagreement between two generations at once, five times a second.

`condition_plates.py` now builds `_speaking` as the **finished hero with
its mouth swapped in**, so outside the mouth the two plates are byte-
identical and the flap physically cannot move anything else. 2.2% of the
human's plate differs, 1.4% of the Klackon's, 3.1% of the Mrrshan's, all
of it one blob on the mouth.

Where the mouth is comes from measuring, not guessing: the blurred
difference between hero and variant peaks on the thing that changed — 65
against a median of 6 on the human, 106 against 18 on the Mrrshan. The
*peak* is trusted and the *extent* is not; a first version took everything
above half the peak and covered two thirds of the Mrrshan, whose noise
floor is that high. The size is a fraction of the head instead.

It must be done on the **conditioned** plates. Quantised separately the two
get their own 256-colour palettes and 5% of every pixel flips by a palette
step, so the whole figure shimmers on each flap.

The same was attempted for the listening states with the head as the
region. It declines: those plates differ from the hero across the entire
body (row difference 10–30 everywhere, never collapsing), so there is no
row where a cut would be invisible. They stay whole and `renderer.js`
crossfades the turn over 180 ms instead. The mouth flap is explicitly
excluded from that fade — there is nothing to smooth, and fading at five
flaps a second would only smear the mouth.

→ **Change only what changed.** Registration makes two pictures agree
about where they are; it cannot make them agree about what they contain.

### The caption outran the voice and the mouth stopped mid-sentence
Owner: *"the female's mouth stops moving mid read."* `GNNTextEngine` was
handed the full story and timed the segment from it, while `tts.js` capped
synthesis at 900 characters inside `speak()`. On a long story the voice
finished, the animator's `speaking` flag went false, and the teleprompter
scrolled on with the anchor sitting there mouth shut.

`trimForSynthesis` is exported now and `broadcast-director.js` trims once,
before the text reaches either the caption, the clock or the voice.

→ **One text, trimmed once.** Two stages trimming independently is two
stages disagreeing.

### The anchors stood behind the desk instead of sitting at it
`DESK_LINE` was 0.455 — the desk's *back* edge. The anchors put their hands
down at the far side of the surface and their bodies floated clear of it,
which reads as two people standing behind a table. It was diagnosed from
the screen as the anchors being 25–30% too wide; the fault was vertical.

Placing them at the front lip (0.520) fixed the floating and introduced the
opposite fault: forearms on the near edge of the desk, right at the camera,
which made the pair look oversized for the room. The owner marked the plate
to settle it — the desk's top surface runs 0.435 to 0.497, and the anchors
belong in the **far third** of it. `DESK_LINE` is **0.468** and `CAST.h`
**0.300**, which puts the pair at 83% of the desk's seating width. `condition_plates.py` reads `CAST.h` out of
`renderer.js` rather than repeating it, which it had been doing wrong.

→ **Size a figure against the thing it has to meet, after placing it there.**
Placement first: a wrong seat line looks exactly like a wrong scale.

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

### The same banter line twenty times in one broadcast
`cast.js` held exactly one relationship between `human` and `mrrshan_f` — the
pair the desk is pinned to — so `GNNCast.exchange()` had one option. Every
exchange was that entry. Two other paths reached the same words:
`banter()` at 8% returned `who.tic` with no recent-line check, and
`outOfBreak()` at 40% appended `lead().tic`, whose value is *"Let us be
precise about this."*

Fixed by expanding the table to twelve entries across both directions, adding
a recency buffer to `GNNCast.exchange()`, gating the `banter()` tic branch on
a recent-line check, and dropping the tic from `outOfBreak()`.

→ **A short list is not a diverse one.** One option per direction is one
option, whatever the function that picks from it looks like.

### The break came back twice
`broadcast-director.js` had two return-from-break paths. `update()`'s
`S.BREAK` case played one line the moment `isBreakActive()` went false; the
continuation inside `beginBreak()` — suspended at an `await` while the break
played — played another when it resumed. Both ran.

Removed the `S.BREAK` case. `beginBreak` owns the return; it is the function
that put the break on air and knows when the last advert has finished.

→ **One segment, one owner.** If a state can be entered from two places,
only one of them should be able to leave it.

### The sign-off named the wrong anchor
`beginShowClose` asked `speaker()` for the voice, which read the chair.
`showClose()` names `seats[0]` in the text. When the chair happened to be
Varr, Varr introduced herself as Commander Hale.

Fixed by using `GNNScript.desk()[0]` for both the voice and the `speakerId`.

### The text ran ahead of the voice
`tts.js` sets `speaking = true` at the top of `speak()`, before the clip is
fetched and decoded. In that window `playbackProgress()` returns null, and
`text-engine.js` fell through to its own estimate timer, typing several words
before the voice arrived.

Added `waitingForAudio()` to `tts.js` — an `awaitingAudio` flag set at
`speak()` entry, cleared at `el.play()`. `text-engine.js` pauses while it is
true.

→ **A flag has to be set at the moment it becomes true.** An element-state
check (`paused`, `readyState`) says nothing during the window that matters,
when the previous line is still playing and the next one has not been handed
over.

### The two-way cluster — three causes behind six symptoms
Owner: *"Grolm's mouth is moving and Varr's mouth moving at the same time...
the alien dude mouth was moving while commander hale was introducing him...
sign off was supposed to be commander hale talking but it was varr with var's
voice."*

**Cause one — the wrong seat was being read.** `GNNDirector.speaker()` and
`activeSeat()` both answered with the *chair* — whoever's turn it is to read
the story — not the *line's speaker*. During an exchange or a two-way those
differ. The voice was correct per line; the caption label and the animating
plate were not. Fixed by tagging each queued line with a `speakerId`, tracking
`currentLineSpeaker` in the pump, and exposing `activeSeatForLine()`
(line-speaker's seat, or `-1` for a correspondent) and `speakerIsSeated()`
(whether the voice belongs to a desk anchor).

**Cause two — the animator read the level regardless of who was speaking.**
`GNNAnimator.update()` called `GNNTTS.getLevel()` whenever
`GNNTTS.isSpeaking()` was true, which it is during a correspondent's answer
too. Fixed by gating on the animator's own `speaking` flag, which `main.js`
now drives from `speakerIsSeated()`.

**Cause three — the correspondent's flap ran on the voice bus alone.**
`tickCorrespondentMouth()` gated on `GNNTTS.isSpeaking()`, true for the
anchor's question and thanks as well. Fixed by also requiring
`GNNDirector.speaker()` to match the scene's correspondent.

→ **A voice on the wire is not the same as a person at the desk.** The
animator is a singleton built for one mouth; anything sharing its bus needs
its own path and its own gate.

### The two-way played over the story it replaced
`beginTwoWay` awaited the cutaway open before queueing its three lines. In
that window the director's `HOLD` case saw `!speaking` and fell through to
`nextStory()`, so the two-way arrived on top of the story already queued.

Fixed by reserving `S.BANTER` and bumping `banterStreak` synchronously in
`beginBanter`, and queueing the three lines in `beginTwoWay` before the
cutaway opens. `beginTwoWay` is no longer `async`.

→ **`await` is a window for the frame loop to run in.** Any state a
subsequent frame reads has to be set before the await, not after it.

### The station ident was stepped on, exactly once
Owner: *"when i first booted up broadcast.sh Varr interrupted the end of
commander hale's station ident... i restarted broadcast.sh and it didn't step
on the station ident that time so its not repeatable."*

`GNNGlitch.onSecret` polled for silence, then called `GNNTTS.speak()`
directly, which pre-empts. The poll guard usually won; on the first boot it
lost.

Fixed by routing secrets through `GNNDirector.interject()`, which queues.
Nothing outside the director calls `speak()` directly any more.

→ **A non-repeatable bug is a race, not a mystery.** The guard that usually
wins is the shape of the fault: find what it is racing and remove the race.

### The STATUS plate idled
`icon-manager.js` returned the STATUS plate whenever a story matched no
keyword — which is most stories, because the twenty-two icon categories are
all science and MOO topics. Sports, entertainment and generic world news all
fell through.

Fixed by returning `null` on no match.

→ **A fallback becomes a default by accident.** "Show *something*" for the
unmatched case is how the unmatched case became the most common one.

### Every caption pointed at the speaker's mouth
The speech bubble sat above the speaker's head with a tail aimed at their
mouth — a different position for every speaker, colliding with the monitor in
the corner, and floating over the footage on a full-frame cutaway. Moved to
one slot (`STATION_BOX`, centred, bottom of the frame), tail removed. Accent
colour and label still follow the speaker.

### The commercial card measured with the wrong font
`drawBreakCard` called `ctx.measureText()` before setting `ctx.font`, so
every top card measured against whatever font was left over from the previous
draw. Every commercial with a top card was drawn at the wrong width.

### The boot died on a paste
`icon-manager.js` was pasted with two `matchIcon` functions — the second
overrode the first, and on reload the module failed to parse. `main.js` calls
`GNNIconManager.loadIcons()` early in `loadAllAssets()`, before
`GNNRenderer.init()` runs. That call threw, `loadAllAssets()` bailed,
`init()`'s catch fired, and the frame loop started with no canvas bound to
the renderer. Every frame early-returned.

→ **When a one-file change produces a black screen, open the browser console
first.** The error names the file and the line. A boot is a chain; one broken
link looks like the whole chain failed.

### The text box appeared one to two seconds before the voice
`text-engine.js` applied the incoming caption immediately. The audio element
does not start until its clip has been fetched and decoded — a fraction of a
second for a warm clip, one to two seconds for a cold one. In that window the
box showed with the *new* label over an empty body, because `visible` stays
at zero until the audio starts and the typewriter runs. The label changed
before the text did, and both changed before the voice arrived.

Fixed by deferring the whole swap. `present()` now stores the caption in a
`pending` slot and leaves the previous caption on screen; `update()` applies
it on the frame `waitingForAudio()` clears. The old caption holds for the
length of the fetch, then the new one arrives with its voice. `clear()` drops
the pending line if the rundown has moved on; `finishTyping()` applies it if
it never landed.

→ **The label is not the caption.** Swap them together or not at all.

### Two-way follow-up repeated the naming line
`hostAsk()` always prepended the intro line, so an extended two-way said
*"We can go to Grolm now. What is the picture on the ground?"* and then
*"We can go to Grolm now. Is that consistent with what you have?"* — naming
the correspondent twice in one beat.

Fixed by splitting the ask pool into `INTRO` (naming), `ASK` (question only)
and `ASK_FOLLOWUP` (follow-up question, no name). `hostAsk` gained a
`withIntro` flag; the follow-up uses `false`.

→ **A name is spoken once per interview.** Subsequent questions do not
reintroduce the person being asked.

### The station open read backward
`showOpen()` appended the anchor's name to a station-first line, producing
*"This is G N N. Across the sector tonight, the following. I am Commander
Hale."* Naming the station, teasing the programme, and only then naming the
anchor reads backward for a sign-on.

`SHOW_OPEN` reordered to lead with "This is G N N"; `showOpen()` now prepends
the anchor's name. Reads: *"I am Commander Hale. This is G N N. Let's get to
the news from across the sector tonight."* Same shape as `showClose()`,
which already opened with "I have been Commander Hale, with Varr."

→ **A sign-on runs person, station, programme.** The station does not
introduce the anchor; the anchor does.

### Wire headlines led with a broadcast label
Some feeds file video and live coverage as `Watch: ...` or `Watch live: ...`.
The label is a filing marker for the feed's own reader — it is telling *its*
viewer that the item is a video — and it is not part of the headline. It
survived `cleanFeedText()` and `unshout()`, so it appeared in the teleprompter
as `WATCH: UK PM Andy Burnham Says...` and in the audio as *"Watch. UK PM
Andy Burnham says..."*.

Fixed with a single regex in `cleanFeedText()`, anchored to the start of the
string, requiring the colon, matching `watch live`, `watch`, `video` or
`live`. Applied to both title and description because the function runs on
both.

→ **The wire's filing labels are not the headline.** Anything the feed does
not read aloud, the anchor does not read aloud either.

### The main desk read markets
`human` and `mrrshan_f` both carried `markets` on their beat, so financial
wire headlines like *Investors iShares Russell 2000 exchange* were read by
the main desk. The category was correctly assigned; the desk just claimed it.

Fixed by removing `markets` from both entries. Market stories now hold in
`heldByCategory.markets` until the show-block scheduler seats the trade desk,
the resource desk or the industry desk, all of which already carry it.

→ **A beat is a claim.** If a desk covers a category, it will read that
category, and it does not get to complain when it does.

---

## 4. Claims that did NOT reproduce

Do not re-chase these. Each cost real time.

| Claim | Test | Result |
|---|---|---|
| Boot fires one TTS request per voice, `seq=0` | fresh log, one page load, no interaction | **3 requests** — ident, dry line, first story |
| Extractor emits magenta transparency | 120 sampled assets scanned for fuchsia | **0** |
| Extractor emits rainbow palettes | same sample + contact sheet by eye | **0**; ~8 scrambled items remain, flagged `noise > 95` and routed to the glitch engine on purpose |
| Assets use a keyed transparency colour | check PNG mode | **40/40 RGBA**, real alpha |
| Anchor filename collision blocks all desk work | checked `assets/generated/anchors/` against `main.js` load paths | **Already fixed.** §3 records the fix; it had landed. |
| Voice IDs in `main.js` / `cast.js` are edge-tts IDs and break under Kokoro | checked ID format against `/api/voices` | **0** — `am_michael`, `bm_george` and the rest are Kokoro IDs. The format `af_*`/`am_*`/`bf_*`/`bm_*` is Kokoro's. |

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
| `python3 tools/key_robot.py` | key the MOO1 robot out of his newscast cels → `assets/generated/anchors/robot_frame_*.png`. Run with `python3`, not `bash` — the docstring is read as shell and dies at line 1 |
| `python3 tools/prompt_bridge.py` | regenerate `assets/generated/prompts.md` |
| `python3 tools/voice_audition.py` | audition every voice the running engine offers |
| `python3 tools/capture_docs.py` | re-shoot the README screenshots |
| `tools/scene_review.html` | dev-only page at `/tools/scene_review.html` — renders each MOO1 recipe as a `.webm` clip or 4×2 contact sheet |
| `assets/generated/Prompts/` | consolidated prompt library — all `.md` prompt files, one per asset class |

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

- **The first minute after a fresh boot is broken, then self-corrects.** Any
  of: the anchors step on each other on the first story (Varr gets a word
  or two out before the next story cuts her off); Varr's mouth does not
  move on her first line after the ident; sometimes neither of those,
  sometimes something else. Which symptom fires varies between runs. Once
  the station has been running for about a minute, none of them recur.
  Suspected load-order race — the anchor plates, story icons, audio graph,
  feed manifest or voice pipeline warm-up all resolve somewhere in that
  window. A boot screen using one of the title cards with a music bed is
  the owner's proposed direction: cover the loading window with a station
  presentation and let the subsystems settle before the first story
  starts. Cause not established; a loading screen that hides the symptom
  without fixing the race would just delay it.
- **Music bed does not play at boot and often does not play at all.** The
  files are provably fine — Ogg Vorbis, plays in `/usr/bin/mpv`. (Note:
  the shell `mpv` alias points at an uninstalled flatpak; use the absolute
  path.) Diagnostics were added to `playMusic()` in `audio-engine.js`: a
  `console.log` at entry, warnings on the three failure paths (no manifest
  entry, fetch non-200, decode failure), and a log on success. Not yet run
  with the diagnostics on to see which path fires. `audio-engine.js` in
  the tree has the diagnostics in place.
- **MOO1 composite review is in progress.** `tools/scene_review.html` and
  `docs/scene-review/README.md` exist; a first review pass has been
  generated; the verdict table is not yet filled in. Three fault classes
  documented (composite fault, extractor fault, missing background). The
  extractor faults — delta frame stacking in `tools/lbx.py` /
  `tools/extract_all.py`, and chromatic scrambling — are out of scope for
  this pass and named as separate work.
- **The show rundown open is not built.** A change request, not yet
  implemented: the cold open should name the stories on the queue before
  reading them — a real rundown tease rather than the current "The desk is
  watching several stories tonight" placeholder that names nothing. Needs
  a headline shortener (sentence → noun phrase), a "what's coming up"
  pool in `script-writer.js`, and a reordered cold-open sequence in
  `broadcast-director.js`.
- **The MOO1 cutaway fallback is still active and produces bad shots.** The
  generated-plate path in `cutscene-manager.js` matches the story correctly;
  the fallback to `GNNSceneCompositor.synthesize()` in `prefetch()` and
  `triggerCutaway()` does not. Three known faults, all in the composite path:
  delta frames stack instead of replacing (extractor — `tools/lbx.py` /
  `extract_all.py`), assets from different pools composite at incompatible
  scales (`MOTION.approach` in particular scales across an 18× range), and
  some pool queries return empty so the layer is dropped, leaving black (the
  `interview()` room query, and probably siblings). **Decide what to do with
  the fallback** — comment it out, fix the recipes, or keep it. The code
  change has not been made either way.
- **All eleven species have `desk_hero` and `speaking`.** `listening_flip` has
  not been re-derived from the newest plates. Without it the renderer falls
  back to the unflipped `listening` plate, which faces the wrong way for a
  seat on the speaker's right.
- **Four new studio sets have not been through `condition_plates.py`'s
  window-keying step.** Their window panes are black — what the keyer expects
  — but `PLATES` in `condition_plates.py` names one room. The four new
  filenames need adding. Without keying, the backdrop composite draws into a
  black rectangle rather than through the glass.
- **`condition_plates.py` has no path for `logos/`, `titlecards/` or
  `icons/`.** All three are new directories. The conditioner needs an entry
  for each before anything composites.
- **Title cards are in testing and the prompts are not right yet.**
  `assets/generated/titlecards/` was created for full-bleed show bumpers
  with both anchors standing in frame and the show's title mark. Two
  problems: the image model lands on a commercial style prior (photorealistic,
  then anime) when asked to draw two figures in a described room, and the
  background it generates does not match the studio sets in
  `assets/generated/set/`. The fallback route is one `_standing.png` per
  character in the anchor style, composited over a set plate by the engine —
  more work up front, reuses the existing art, and the two cannot disagree.
- **`assets/generated/icons/` is partially populated.** The twenty-two icon
  prompts are written; generation is in progress.
- **Two source plates were whole-image mirrors of their sibling**, which
  flips the GNN badge with the picture — `human_listening` and
  `klackon_listening_flip` both read ИИƆ. Both were rebuilt by mirroring
  only the head of the good sibling, with the cut row picked by eye (510
  and 580 of 1254) rather than detected. The originals are in
  `_inbox/rejected/`. **When a variant needs to face the other way, turn
  the head; do not flip the picture.**
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
- **MediaPipe will not rig this cast.** Tested against all eleven heroes
  with `face_landmarker.task`: **3 of 11 detect** (human, Bulrathi,
  mrrshan_f), and on two of those the points bunch in the middle of the
  face rather than landing on features. Only the human is usable. The
  Kaiagotchi rig (`tools/kaia_portrait/build_portrait.py`, one portrait
  plus a 29-point `kaia_rig.json` driven by a GLSL warp) is still the right
  architecture — one plate, nothing swaps, and brows/eyes/smile/head-turn
  become parameters the mood table in `js/cast.js` can drive — but the
  points have to be placed by hand, not detected.
- **rss2json has a DAILY cap, not just a per-burst one.** Hit it and every
  feed returns `{"status":"error","message":"Daily rate limit exceeded,
  please try again after 11 hours"}`, the pool stays empty and the channel
  sits in `DRY` with nothing to read. It looks exactly like a broken feed
  list. **Check this before debugging the feed code:**
  `curl -s 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Ffeeds.bbci.co.uk%2Fnews%2Fworld%2Frss.xml' | head -c 200`
  A survey of two dozen candidate feeds burned the day's allowance in one
  session. `POLL_BATCH = 8` in `feed-manager.js` now fetches a rotating
  slice per poll instead of all 25 at once, which helps with bursts but
  does nothing about the daily cap. An API key would lift it.
- **The window, the cutaways and the correspondents are wired.**
  `condition_plates.py` keys the eight window panes out of the room plate by
  connected components (the two wall monitors are near-black too and are
  rejected by position), records the opening in `layout.json`, and
  conditions backdrops to that opening. The 14 generated cutaway plates are
  routed by `GENERATED` in `cutscene-manager.js` and the MOO1 composites are
  now only the fallback. Field correspondents appear in the PIP as a LIVE
  window — 22 plates conditioned out of `_inbox/field/`, which is the
  chest-cropped generation and the right framing for a monitor.
- **Commercials are not read by the anchors.** `voiceOptsFor` never named a
  voice, so synthesis fell through to whoever had the chair. A break now
  picks an announcer from `AD_VOICES` and keeps it for every beat; the small
  print gets `bm_fable`. Update that list if the desk cast changes.
- **Still mixed: MOO lore and real news.** The owner wants them completely
  separate and this is NOT done. `PACE.wireShare` still interleaves sector
  bulletins with real stories, and the banter templates have not been
  audited for lore terms applied to real headlines.
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
```

## What changed in this version

**§1** — added rows: `Robot frames`, `Main desk beat`, `Two-anchor beats`, `Scene review`.

**§3** — six new entries appended after `The boot died on a paste`:
- The text box appeared one to two seconds before the voice
- Two-way follow-up repeated the naming line
- The station open read backward
- Wire headlines led with a broadcast label
- The main desk read markets
- (Existing entries unchanged)

**§5** — added `tools/key_robot.py` row and `tools/scene_review.html` row.

**§7** — four new bullets at the top of the section, before `The MOO1 cutaway fallback`:
- The first minute after a fresh boot is broken, then self-corrects
- Music bed does not play at boot
- MOO1 composite review is in progress
- The show rundown open is not built

**Left alone:** the `Last verified at commit 056c5a9` line at the top. Still stale. Update it after the next commit.
