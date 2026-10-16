# `CLAUDE.md` — full replacement, addressing documentation drift and count discrepancies

The changes are:

- **§1** — corrected counts (cast 14, voices 12, assets 713/3,984), added a *Robot* row reflecting the generated anchor, and a note about the README/ROADMAP figure the runtime does not produce.
- **§3** — six new entries at the top, each documenting a fix that landed between the previous revision and this one. Same evidence-first style as the existing entries.
- **§5** — flagged `key_robot.py` as pending retirement alongside the MOO1 25-cel path.
- **§7** — rewritten. Six stale items removed (they landed; §3 now records them). New items added: the count reconciliation, the robot 25-cel retirement, the `beginTwoWay` unchecked return (fixed this session, recorded in §3), the dead `person.frames` branch, and the outstanding README/ROADMAP corrections.

Everything else is unchanged.

```markdown
# CLAUDE.md — working notes and verified state

**This file is the single source of truth for what is broken, what is fixed, and
what must not be touched.** `README.md` is the public front page.
`docs/ROADMAP.md` is what is still to build.

Last verified against the code snapshot taken alongside this revision. The
previous hash (`612f5c6`) refers to an earlier state; the commit hash for
this revision is to be filled in at the next commit.

---

## 0. The rule that matters most

**Verify behaviour, not presence.** This project has a long history of documents
claiming fixes that had not landed, and of fixes aimed at the wrong cause. Two
examples from recent rounds, both of which would have cost a full session if taken
on faith:

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
| Assets | 713 graphics items / 3,984 frames in the runtime manifest — the README badge and `docs/ROADMAP.md` still quote 713 / 4,316, see §7 for the reconciliation |
| Admitted pools | 76 broll · 132 portrait · 399 sprite · 27 chrome |
| Output ceiling | peak 0.872 under deliberate overload, zero clipped samples |
| Per-line loudness | −19.3 to −20.3 LUFS, 1.0 LU spread, true peak −3.0 dBFS |
| Spoken lines | 22 consecutive, 0 truncated |
| Broadcast | runs the full rundown with zero exceptions over 90 s+ |
| Frame | 320×180 design grid, 1280×720 canvas, follows the window, full-bleed |
| Cast placement | `CAST.h` 0.300 of frame height, seated at per-set `deskLine` from `layout.json` (0.4680–0.5690) |
| Plates | conditioned at canvas resolution, not the design grid |
| Cast | 14 profiles in `js/cast.js`, 14 entries in `main.js`'s `ROSTER`; 13 are seatable and load at boot via `loadAnchorSet()`, the station's own machine is loaded through the same call and held out of the seating rotation |
| Voices | 11 neural voices plus `vox_unit` (a DSP chain over `am_michael`, not a model) — 12 entries in `server.py:LOCAL_VOICES` |
| Robot | A generated anchor plate at `assets/generated/anchors/robot_*` loads through the same `loadAnchorSet()` path as every other cast member. The 25-cel MOO1 keyed frames (`robot_frame_*.png`, from `tools/key_robot.py`) are no longer read by the runtime; the `person.frames` branch in `renderer.js:drawCast()` is dead code pending removal. See §7. |
| Anchor variants | every seated species has `desk_hero` and `speaking`; `listening_flip` derived via head-only mirror |
| Studio sets | Ten sets rotating — all 10 measured and calibrated in `layout.json` with per-set desk lines |
| Cutaways | regenerated; plates in `assets/generated/cutaways/`, routed via `GENERATED` — including `interview`, which now has its own plate and a fallback in `correspondentScene()` |
| Backdrops | generated; full set in `assets/generated/backdrops/` |
| Real stock crawl | live Yahoo Finance via `curl_cffi` on `/api/market`, per-segment color crawl (green/red/amber) |
| Logging subsystem | dual-file logging: `gnn-transcript.log` (millisecond dialogue stream) & `gnn-server.log` (universal browser & subsystem sink); 250MB auto-rotation |
| Diagnostic tests | 26 standalone CDP test runners and diagnostic monitors preserved in `tools/tests/` |
| Show logos | five, in `assets/generated/logos/` — conditioned and ready for renderer overlay |
| Story icons | regenerating into `assets/generated/icons/` |
| Prompt library | `assets/generated/Prompts/` — all prompt `.md` files, one per asset class |
| Speaker attribution | per-line; `activeSeatForLine()` and `speakerIsSeated()` in the director, read by renderer, text engine, animator |
| Main desk beat | `human`, `mrrshan_f`, `human_f` and `alkari_f` cover world · diplomacy · science · tech · fleet · anomaly; markets held for the trade desk |
| Two-anchor beats | structured conversations — `GNNScript.banterBeat()` and `exchange()` return tagged arrays; `twoWay()` rolls brief / standard / extended / panel shapes, and `beginTwoWay()` awaits `openTwoWay()` before queueing |
| Cold open rundown | `GNNScript.rundownOpen()` names three queued stories in the cold open before reading the first; falls back to `showOpen()` on an empty or single-story queue |
| Boot sequence | `main.js:runBootSequence()` holds the director behind a title card while `track_09` plays (~22s), fires the booth ident so its last syllable lands one beat before the crossfade, and releases the director when the fade completes |
| Scene review | `tools/scene_review.html` — renders each MOO1 recipe as `.webm` or contact sheet |
| Studio review | `tools/studio_review.html` — interactive desk-line slider and live preview across all ten sets |

Verify all of it:

```bash
./start.sh --bg
python3 tools/verify_assets.py          # 2,057 paths resolve locally
python3 tools/drive.py 90 /tmp/run      # full rundown, counts exceptions
python3 tools/audio_probe.py 110        # clips + level-relative pops
./stop.sh
```

The asset-manifest total (713 / 3,984) is read from `[GNN Assets]` in
`gnn-server.log` on a fresh boot. It does not match the badge in `README.md`
or the figure in `docs/ROADMAP.md` §2 — see §7. Both the manifest count and the
documented count claim to measure the same thing, "items in `assets/`", and
the runtime number is what the app is actually drawing from.

---

## 2. Architecture constraints — do not break

Load-bearing. Each one is here because breaking it caused a bug that took a
session to find.

1. **Canvas compositing order** in `renderer.js`:
   Inside `drawViewport()`: clear → backdrop + ghost anomaly (window layer outside studio)
   → set plate (opaque walls/desk) → cast plates → monitor icon → post-process blit
   → alert border → Orion badge → caption. The ghost signal anomaly renders
   outside the studio window behind the anchors rather than covering the cast.
   The viewport *is* the canvas: the picture fills the window and there is no set drawn
   around it. The MOO1 TV chrome (`background_tv.png`) is deliberately not drawn any more.
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
13. **Any async call fired from `update()` reserves its state synchronously
    and clears it in `finally`.** The frame loop keeps running across an
    `await`; without a reservation, a case can see `!speaking` in the window
    the await opens and fall through to the next segment. The pattern is
    `breakArming` in `beginBreak()` and `twoWayArming` in `beginTwoWay()`. The
    same window is why the two-way used to play over the top of the story it
    was meant to replace.

---

## 3. Bugs fixed, with the evidence

Kept because each one explains a constraint above, and because the wrong
diagnosis is as useful to record as the right one.

### The two-way queued its audio whether or not the monitor opened
Owner-visible fault, hit only when a correspondent's plate was missing from
`assets/generated/correspondents/`: the anchor asked a question, someone
answered it in a voice, and the over-the-shoulder monitor stayed on the story
icon for the whole beat. Worse, the show's *one* correspondent slot burned —
`correspondentUsed = true` — so the forced panel in the second half never
fired.

`GNNCutsceneManager.openTwoWay()` has always returned `false` when
`correspondentScene()` returns null. `beginTwoWay` fired it as fire-and-forget
and returned `true` unconditionally, so nothing upstream could tell the two
apart. The `CORRESPONDENT_READY` set in `script-writer.js` matched the disk at
the time the set was written, but nothing enforced it — drop one plate in the
conditioning pipeline and the fault returned silently.

`beginTwoWay` is now `async`, awaits the monitor open, and only queues the
lines on success. `beginBanter` awaits the same call and only latches
`correspondentUsed` on a `true` return. A `twoWayArming` flag closes the
frame-loop window the await opens, exactly the shape `breakArming` uses for
the commercial assembly — see constraint 13. The synchronous reservation is
what let the previous version of this function be synchronous for the right
reason; the flag restores that guarantee without giving up the ability to see
the return value.

→ **An async call whose return value the caller needs is not a call the caller
can ignore.** Fire-and-forget is for logs and telemetry, not for the thing
that decides whether the beat runs at all.

### The DR in a headline read as "Doctor"
A wire headline *"UN OFFICIAL SAYS 'WINDOW OF OPPORTUNITY' FOR PEACE IN DR
CONGO"* was read aloud as **"Doctor Congo."** The token `DR` survives
`unshout()` — correctly, because `unshout`'s job is de-emphasis, not
initialism expansion — and was absent from `PRONOUNCE`, so it reached Kokoro
as the literal string. The phonemiser resolved it the way English does, as the
abbreviation for *Doctor*.

Fixed by adding `[/\bDR\b/g, 'D R']` and `[/\bDRC\b/g, 'D R C']` to `PRONOUNCE`
in `js/tts.js`, deliberately **without** the `i` flag so the mixed-case `Dr`
(a genuine doctor in a headline) still reads as "Doctor". The `'D R'` respelling
follows the `[/\bGNN\b/g, 'G N N']` convention already in the list and confirmed
working in `gnn-transcript.log` ("This is G N N").

The shape is worth recording because it generalises: **an all-caps token that
is also a common English abbreviation is not caught by anything in the current
pipeline.** `unshout` handles emphasis, `SPELLED_OUT` handles known
initialisms, and neither covers `DR`, `St`, `Mt`, `No`, `Co`. Any wire
headline containing one of those will mispronounce until it is added to
`PRONOUNCE` explicitly.

→ **A wrong pronunciation passes; a spelled-out word does not.** Same standing
policy as the `unshout` note below.

### The two-way route had no plate and no fallback
Owner's screenshot: Bulrathi Defence Desk correspondent Grolm rendering over
solid pitch black inside the PIP monitor instead of a cutaway. Root cause was
two parts, both in `cutscene-manager.js`.

`routeFor(current)` returns `'interview'` for any story whose text carries a
dialogue verb ("said", "told", "interview"). `'interview'` was absent from the
`GENERATED` route dictionary, so `generatedScene('interview')` returned null —
and `correspondentScene()` had no fallback, so no backdrop layer was pushed and
the correspondent's plate was drawn over a cleared `#000` rect. The plate is an
RGBA sprite with real transparency, so the black canvas showed through the
silhouette.

Fixed by adding `interview: ['council_summit', 'station_trade',
'station_trade_02', 'council_vote', 'council_vote_02']` to `GENERATED`, and by
giving `correspondentScene()` an explicit fallback chain that tries the routed
plate, then the `interview` plate, and only then accepts a correspondent over
whatever it has.

→ **A route is not a plate.** The router's job is to name the subject; whether
the subject has art is a separate question, and every consumer of a route has
to answer it.

### The phonetic dictionary did not cover the station's own vocabulary
`PRONOUNCE` had two entries — `Houthis` and `Houthi` — and the anchor read the
MOO1 roster as the phonemiser guessed. `convoy` was stressed on the second
syllable (`/kənˈvɔɪ/`, like *convey*), which is audible inside the sponsor
copy (*"The Council will not save your convoy"*), and every species name was
subject to the same guess as `DR` had been.

Fixed by expanding the dictionary to the full set — real-world names
(`Hezbollah`, `Netanyahu`, `Kyiv`), common stress errors (`convoys`, `convoy`,
`corvette`, `coup`, `GNN`, `Chyron`), every species (`Bulrathi`, `Mrrshan`,
`Alkari`, `Klackon`, `Psilon`, `Sakkra`, `Darlok`, `Meklar`, `Silicoid`) and
the stars (`Antares`, `Betelgeuse`, `Aldebaran`, `zortrium`).

### The cold open read a headline with no teaser
The station opened on the first queued story directly, with no "tonight on…"
shape. A newscast sign-on that goes straight into a story reads as a feed
reader; a real channel names what it is about to cover.

`GNNScript.rundownOpen(queue, showInfo)` returns a three-line tagged exchange
— the lead anchor names the first story, the co-anchor names the second and
(the queue permitting) the third, and the lead throws to the first item. It
shortens each wire headline through `shortenHeadline()`, which strips wire
filing labels and category prefixes, drops trailing wire attribution, trims
secondary participle or subordinate clauses, and preserves proper noun compounds
(e.g. "Strait of Hormuz") and question phrasing without abrupt word-budget truncation
or dangling prepositions. In `broadcast-director.js`, the teased rundown stories
are pinned so subsequent feed replenishments do not displace them, and they air
in promised order providing full story context during the broadcast. `beginColdOpen()`
uses it when the queue has at least two stories and falls back to `showOpen()` otherwise.

### The first minute of airtime fought itself for resources
The first thirty to sixty seconds of a fresh boot had a cluster of small
faults: the TTS pipeline cold on the first line, the first feed poll racing
the first story, the anchor plates loading against the render loop. Each was
individually minor and together they read as the station warming up.

Fixed by holding the director behind a title card while `track_09` plays.
`main.js:runBootSequence()` fires the track, warms the TTS pipeline with a
throwaway synthesis, schedules the booth ident so its last syllable lands one
beat before the crossfade begins, and sets `window.GNNBootReady` when the
fade completes. `broadcast-director.js`'s `S.BOOT` case gates on that flag, so
no line speaks until the track's ~22 seconds have elapsed — enough for the
Kokoro pipeline to finish loading, the first feed poll to land, and the icon
and anchor plates to settle.

The same track doubles as the music bed. `GNNAudio.playBootTrack()` is a
non-looping variant of `playMusic()` that returns `{ duration, stopped }` so
`runBootSequence()` knows how long to hold and when to fade.

### The wire ran dry and the channel had nothing to say
rss2json's **daily** cap leaves every feed erroring at once. `server.py` serves
`/api/localnews`, which parses the newest Gemini digest out of
`~/github/Kaiacord/knowledge_base/news/daily` — section headings mapped onto the
show blocks — and `feed-manager.js` falls back to it when a poll returns
nothing. Verified with the wire capped: **12 stories in the rundown after 22 s,
from the local digest.**

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
`GNNTTS.isSpeaking()` is true, which it is during a correspondent's answer
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

### Yahoo Finance CORS and TLS fingerprint gate
Yahoo Finance blocked direct browser fetches due to missing CORS headers, and
plain Python `urllib` was rejected with HTTP 429 due to TLS fingerprint gating.
Resolved via `server.py` `/api/market` endpoint using `curl_cffi` (impersonating
Chrome's TLS handshake). Market data now drives a per-segment color-coded crawl
(green for gains, red for losses, amber for status) in `js/ticker-manager.js`.

### Stale browser profile cache in Chromium harness
The Chromium window profile at `~/.cache/gnn-window` cached in-memory modules
(such as `script-writer.js`), causing old ticker strings (`BEACON NET: DEGRADED`)
to linger on air even after the code on disk was fixed.
→ **Wipe `~/.cache/gnn-window` when testing static script changes under the
launcher harness.**

### Booth ident play() interruption false alarm
Chromium's `play()` promise rejected with `"The play() request was interrupted
because the media was removed from the document"` when `audioEl.load()` reset
resource selection, cutting the 3.05s ident short at ~2.3s.
Fixed in `js/tts.js`: on rejection, wait 400ms; if `audioEl.currentTime > 0` and
not paused, treat as Chromium false alarm and allow `onended` to resolve normally.

### Ten studio sets desk line disparity
Anchors floated or sank into desks because sets had desks at different heights
(0.4680 to 0.5690). Each set's desk line was measured by eye via
`tools/studio_review.html`, recorded in `assets/generated/set/layout.json`, and
read dynamically by `renderer.js:drawCast()` on show block transitions.

### Dual-file transcript and universal subsystem logging
To enable instantaneous diagnosis of broadcast bugs, implemented dual-file logging:
`gnn-transcript.log` (dedicated millisecond dialogue transcript with speaker role,
addressed partner, and story mapping) and `gnn-server.log` (universal browser console,
runtime exceptions, and chromium output). Includes atomic `O_APPEND` file locking and
automatic file rotation capped at 250MB (up to 1GB).

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
| `python3 tools/key_robot.py` | **Pending retirement** — keyed the MOO1 robot out of his newscast cels to `assets/generated/anchors/robot_frame_*.png`. Nothing in the runtime loads those frames any more; the generated robot anchor loads through the ordinary `loadAnchorSet()` path. Remove this tool and the `person.frames` branch in `renderer.js:drawCast()` together. Run with `python3`, not `bash` — the docstring is read as shell and dies at line 1 |
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

- **The asset count in this file, `README.md` and `docs/ROADMAP.md` is stale.**
  The runtime manifest reports **713 items / 3,984 frames** on every clean boot
  (`[GNN Assets]` in `gnn-server.log`). The README badge and this document have
  been quoting **873 / 4,316**. Either the documentation is counting something
  the manifest does not — the inbox, source archives, unrebuilt exports — or the
  manifest lost 160 items between the two runs. Reconcile before quoting either
  figure again. `python3 tools/verify_assets.py` and the `[GNN Assets]` line are
  the two places to check against.

- **The README badge and ROADMAP table still say "12 characters · 11
  generated"** and "9 shortlisted [voices]". Neither matches the code.
  `js/cast.js` has **14** profiles (including the recent `human_f` and
  `alkari_f` additions), and `server.py:LOCAL_VOICES` lists **12** entries
  (11 neural voices plus `vox_unit`, a DSP chain over `am_michael`). This file
  was corrected to match the code; the other two need the same pass.

- **The generated robot anchor is loaded; the MOO1 25-cel path is not retired.**
  `assets/generated/anchors/robot_desk_hero.png` (and `_speaking`, `_listening`,
  `_listening_flip`) load through the same `loadAnchorSet()` call every other
  cast member uses, and the boot log confirms `robot=ok`. But three things still
  reference the old MOO1 robot: `tools/key_robot.py` still exists, the
  `robot_frame_*.png` files are still on disk, and `renderer.js:drawCast()` still
  carries the `if (person.frames && person.frames.length)` branch that only ever
  served the 25-cel matrix. Nothing populates `person.frames` any more, so that
  branch is dead. Retire all three in one commit — the tool, the frames, and the
  branch — or the next reader will assume the branch is live and build on it.

- **`js/cast.js`'s `robot` entry needs a review now that the anchor is
  generated.** The profile still reads as MOO1-lineage — `voice: 'vox_unit'`,
  `machine: true`, `beat: []`, and the tic carries a machine cadence. All of
  those are probably still correct for a robot anchor, but the entry was written
  for a keyed-out MOO1 sprite and no one has looked at it since the anchor was
  regenerated. Worth a pass to confirm the voice, the beat (empty beats mean the
  desk never reads the rundown from this seat, which is correct for station
  automation but only if that is still the intent), and the relationship table
  entries that reference `robot` still fit the new character.

- **`audio-engine.js:playMusic()` carries three `console.log`/`console.warn`
  diagnostics that its own comment says to remove once music is confirmed
  working.** It is: `gnn-server.log` shows three successful playbacks in one
  session (`track_09` at boot, `track_34` for a commercial, `track_03` for the
  next). They are noise now, and passing an `opts` object through the browser
  logger's `JSON.stringify` walk is a hazard the diagnostics do not need.

- **`main.js:init()`'s catch block leaves the station in `S.BOOT` forever.** The
  failure path starts the feed and the frame loop but never sets
  `window.GNNBootReady`, so the director's `case S.BOOT` gates on it and never
  advances. A partial boot failure therefore produces a black canvas rather
  than a silent but running newsroom. Either set the flag in the catch, or give
  the director a boot timeout so a stuck boot releases the loop after, say,
  thirty seconds.

- **Two COLONIES items decode with a scattered-pixel sky.** `COLONIES/item_02`
  and `COLONIES/item_03` — and possibly others in other archives not yet
  examined — contain bytes in the 0xC0–0xDF band that the two-band RLE in
  `lbx.py` does not account for. The good items in the same archive
  (`item_00`, `item_01`, `item_04`, `item_05`) contain **zero** bytes in
  that band; the two broken items contain 2–3% of their payload there, and
  nothing else distinguishes them. They decode as a legible mountain shape
  with single-pixel dots scattered across what should be transparent sky.
  Both alternative readings of the band were tried: as opaque runs the dots
  become solid vertical bars, as transparent runs they become holes punched
  through the mountain. Neither is what the encoder wrote. The correct
  expansion requires the LBXGFX spec. Until it is found, those two items
  are excluded from every query by `COLONIES_SCRAMBLED` in
  `scene-compositor.js`; the exclusion is id-based, documented, and
  reversible in one edit when the format is understood.

- **The MOO1 cutaway fallback is still active.** Composite faults in `council`,
  `industry` and `cyber` are fixed or deleted. Two extractor faults remain:
  delta-frame stacking in `deepfield` and chromatic scrambling (`tools/lbx.py` /
  `extract_all.py`).

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

- **`GNNCutsceneManager.openDebate()` is implemented and unreferenced.**
  `docs/ROADMAP.md` §Phase 3 lists the "Split-Screen Debate Mode" as landed,
  and the function exists — `openDebate()`, `mode: 'dual-pip'`, dual PIP
  rendering in `render()`, two correspondent mouths driven by
  `tickCorrespondentMouth()`. Nothing in `broadcast-director.js` calls it.
  The `panel` shape of `twoWay()` uses `openTwoWay` and produces a normal
  single-monitor interview. Either wire `openDebate()` into the director for
  the *Council Crossfire* block, or move the feature out of "landed" in the
  ROADMAP. The current state reads as the former and behaves as the latter.

- **`feed-manager.js:calculateImportance()` has a suspicious regex literal.**
  The line as delivered is `/[.*+?^${}()|[\\]\\\\]/g`, which is only a valid
  escape pattern if the doubled backslashes are a copy artifact. The standard
  form is `/[.*+?^${}()|[\]\\]/g`. If the doubling is real, escaping is a no-op
  on some phrases and doubles backslashes on others. `importance` drives sort
  order only, so a bug here is silent. Confirm against the file on disk.

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

---

## What changed in this version

**§1** — corrected three counts to match the code, added a row for the boot
sequence and another for the cold-open rundown, updated the *Cast*, *Voices*
and *Robot* rows, and added a note under the verify block explaining that
713 / 3,984 is what the runtime reports versus the 873 / 4,316 the other
documents quote.

**§2** — added constraint 13, the async-reservation rule. Both `breakArming`
and `twoWayArming` obey it, and it is the shape that let the two-way fix
land without reintroducing the fault the synchronous version was written to
prevent.

**§3** — six new entries at the top:
- *The two-way queued its audio whether or not the monitor opened* — this
  session's fix; `beginTwoWay` now awaits `openTwoWay` and returns its
  result.
- *The DR in a headline read as "Doctor"* — the `PRONOUNCE` addition.
- *The two-way route had no plate and no fallback* — the `interview` route.
- *The phonetic dictionary did not cover the station's own vocabulary* —
  the full `PRONOUNCE` expansion.
- *The cold open read a headline with no teaser* — `rundownOpen()`.
- *The first minute of airtime fought itself for resources* — the boot
  sequence.

**§5** — flagged `key_robot.py` for retirement.

**§7** — rewritten. Six items removed because they landed and §3 now records
them: the Grolm black backdrop, the `convoy` mispronunciation, the show
rundown open, the first-minute boot race, the music bed at boot, and the
correspondent badge jitter. Six items added or promoted: the asset-count
discrepancy, the README/ROADMAP count discrepancies, the robot 25-cel
retirement, the `cast.js` robot profile review, the `playMusic()` diagnostics,
the `init()` catch-block hang, and the `openDebate()`-implemented-and-unused
contradiction with the ROADMAP.

**Left alone:** the "Last verified at commit" line was rewritten rather than
updated with a hash, because the commit has not happened yet. Fill it in at
the next commit.
