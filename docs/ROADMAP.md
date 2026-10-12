# ROADMAP — what is still to build

State and constraints live in [`CLAUDE.md`](../CLAUDE.md). This file is only
the forward plan. Some of it is started; the Landed table says what is.

---

## The target

GNN today is a **two-anchor desk** — the human commander and the Mrrshan
matriarch — reading an RSS rundown on a generated studio set, with the robot
keyed out of his own scene as a third seat. The target is a **multi-anchor
desk across a rotating cast**: a proper 24/7 simulated channel with recurring
named shows, each with its own host, beat and visual identity.

**Real news is the primary content.** The anchors read real headlines in real
language — no translation, no substitution, no in-universe reinterpretation.
The MOO1 lore layer is a deliberate homage, siloed off as easter eggs and
station idents, never mixed into the news a viewer joins for. What makes the
channel watchable is the anchors themselves — their voices, their reactions,
their relationships — not a translation of the world into 1993 vocabulary.

Reference imagery in `docs/`: `NEWS ROOM MOCK UP.jpg` (current layout),
`NEWS ROOM MOCK UP_02.jpg` (**target** three-up desk), `SPRITE_SHEET.jpg`
(twelve cutaway subjects), `EXTERIOR WINDOW ASSET MOCKUP.jpg` (backdrop moods).

> **These are mockups, not source assets.** They communicate composition and
> mood. Do not crop, slice or palette-match them into the build. Production art
> comes from the admitted MOO1 pools or from `assets/generated/`.

### Hard exclusions
No Web3 / crypto / NFT.

---

## Done when a reviewer can

1. Join at any hour and see a **named programme** with its anchor on screen.
2. See **at least three different species** across the rotation — not just the
   robot.
3. Watch a **clean handoff**: outgoing sign-off → station ident → incoming
   intro → first story. No jump cuts, no audio bleed.
4. See **PIP cutaways that match the story** (fleet → starship battle, treaty →
   council vote, hack → hacker code). *Caveat: the generated plate path
   matches correctly; the MOO1 composite fallback does not. Whether to
   comment out the fallback, fix the recipes, or keep it is an open decision.*
5. Read a **real stock crawl** with live market data, not a MOO commodities
   list.
6. Read **real RSS stories read as real news**. No in-universe translation,
   no substitution of real names for MOO names. MOO lore content is siloed
   off as easter eggs and does not appear in the news rundown.
7. See **no corrupted or stretched sprites** — already enforced by the pool
   gates; keep querying pools.

---

## Landed

Kept short, with what to run to see it. Full evidence is in `CLAUDE.md`.

| | Verified by |
| :--- | :--- |
| **Two-anchor desk** — human commander and Mrrshan matriarch, with distinct voices and a passing chair | `main.js` `lineup`; `GNNDirector.activeSeat()` |
| **Per-line speaker attribution.** Every queued line carries its own speaker; the director exposes `activeSeatForLine()` and `speakerIsSeated()`. The renderer, text engine and animator all read those, so a two-way or an exchange moves the right plate and shows the right name | watch a `TWO_WAY` beat: the anchor's mouth stays shut for the correspondent's answer, and the correspondent's plate animates on their own voice |
| **Lip-sync** gated on the measured envelope, teleprompter typed from the audio element's playback position | measured live: mouth open 1–2% during silence, 56% during speech; text/audio drift 0.008–0.051 across a read |
| **One speech queue.** Nothing speaks directly; lines play one at a time with a 420 ms gap and the caption is raised when its own line starts | the ident, the break throw and the two-way no longer cut each other off |
| **Show shape** — `showOpen`, `intoBreak`, `outOfBreak`, `showClose` and the two-anchor `exchange` are wired. A block ends and a new show opens | states now reach `SHOW_CLOSE` → `COLD_OPEN` |
| **Exterior window backdrop** — the eight panes are keyed out of the room plate by connected components and recorded in `layout.json`; backdrops are conditioned to the opening and drawn behind the glass | `condition_plates.py` prints `window keyed: ...` |
| **PIP scene mapping** — the generated cutaway plates are routed by subject; archive composites are the fallback | `GENERATED` in `cutscene-manager.js` |
| **Correspondents through the monitor** — a two-way beat asks, answers in the reporter's own voice, and thanks. 22 plates conditioned from the chest-cropped generation | `docs/correspondent.png` |
| **Commercial announcers** — breaks pick a voice that is not an anchor's, and keep it for the whole spot | `AD_VOICES` in `cutscene-manager.js` |
| **Feeds by show block** — 25 feeds tagged, subject-level dedupe, and a local digest fallback for when rss2json's daily cap is hit | 12 stories in the rundown in 22 s with the wire capped |
| **Anchor art** — all eleven species have `desk_hero` and `speaking`. `_speaking` is built as the hero with only the mouth swapped in | `condition_plates.py` prints per-state alignment |
| **Robot frames** — twenty-five cels in `assets/generated/anchors/robot_frame_*.png`, keyed by `tools/key_robot.py` | run `python3 tools/key_robot.py`, expect 25 files |
| **Studio sets** — five total. `studio_wide_empty.png` (the original), plus `market_`, `geopolitics_`, `tech_`, `celebrity_wide_empty.png` | four new sets generated |
| **Cutaways** — regenerated, all plates in `assets/generated/cutaways/` | — |
| **Backdrops** — the full set in `assets/generated/backdrops/` | — |
| **Show logos** — five, in `assets/generated/logos/` | not yet wired into the renderer |
| **Prompt library** — all prompt `.md` files consolidated into `assets/generated/Prompts/` | — |
| **Two-way shape** — `GNNScript.twoWay()` rolls brief / standard / extended shapes; the extended form uses a follow-up that drops the naming intro so the correspondent is introduced once, not twice | watch an extended two-way: ask, answer, follow-up, answer, close |
| **Structured anchor beats** — `banterBeat()` builds a two-to-four line conversation from each anchor's own banks; `exchange()` extends with follow and close from the relationship table when the entry carries them | watch a `BANTER` beat between the two anchors; it is a conversation, not a single line |
| **Character banks** — every cast entry has `openers` / `reactions` / `closers` / `asks`; `GNNCast.line()` reads them, `castLine()` filters through the recency buffer, `queueTaggedLines()` plays them | plumbing works; **the copy itself is placeholder** — see "The newsroom as a simulation" for the writing task |
| **Ticker** — resource crawl with slow drift. **Deprecated.** Being replaced by a real stock crawl; see "Order of work" item 6 | visible along the bottom of every screenshot |

---

## Asset pipeline — current state

Where the generated art stands, and what each directory needs before it
reaches the broadcast.

| Directory | State | Next step |
| :--- | :--- | :--- |
| `anchors/` | `desk_hero` and `speaking` for all eleven species; robot frames produced | Run the `listening_flip` derivation on the newest plates |
| `set/` | Five studio plates; the four new ones have black window panes | Add the four new filenames to `PLATES` in `condition_plates.py`, run the window-keying step |
| `cutaways/` | Regenerated | None — routed via `GENERATED` |
| `backdrops/` | Full set | None |
| `logos/` | Five, all exist | Add a path in `condition_plates.py`; wire a fade layer into the renderer |
| `icons/` | Partial | Finish generating; add a path in `condition_plates.py` |
| `titlecards/` | In testing | See below — prompts are not yet right |
| `Prompts/` | Consolidated | None |

### Title cards — in testing

`assets/generated/titlecards/` is a new asset class: full-bleed
`1792×1024` show bumpers with both anchors standing in frame and the show's
title mark. Two problems with the current generation:

- The image model lands on a commercial style prior — photorealistic, then
  anime — when asked to draw two figures in a described room. Full-body shots
  in the anchor style have not been reliably produced.
- The background it generates does not match the studio sets in
  `assets/generated/set/`. Palette, materials and lighting all drift.

Two routes forward, not yet decided:

1. Keep iterating the prompt.
2. Switch to **standing anchor plates** — one `_standing.png` per character
   in the anchor style, composited over a set plate by the engine. More work
   up front; reuses existing art; the two assets cannot disagree.

Title cards are needed for the loading gate (Order of work item 10). If the
one-shot approach keeps missing, the standing-plate route is the fallback —
and either way the decision should be made before the loading gate is built,
because the gate uses a card as its visual.

### The MOO1 composite fallback — decision pending

The generated-plate path in `cutscene-manager.js` matches the story
correctly. The fallback to `GNNSceneCompositor.synthesize()` in `prefetch()`
and `triggerCutaway()` does not — three known faults, all in the composite
path:

- Delta frames stack instead of replacing (extractor — `tools/lbx.py` /
  `extract_all.py`).
- Assets from different pools composite at incompatible scales
  (`MOTION.approach` scales across an 18× range).
- Some pool queries return empty so the layer is dropped, leaving black.

**Decide**: comment the fallback out, fix the recipes, or keep it as-is. The
code change has not been made either way. Note that the extractor bug affects
every animated MOO1 asset in the broadcast, not just cutaways — fixing it
would improve the whole library.

A review tool exists: `tools/scene_review.html`, opens at
`/tools/scene_review.html`, renders each of the nine recipes as a `.webm`
clip or a 4×2 contact sheet. `docs/scene-review/README.md` holds the verdict
table and the fault taxonomy. The first pass has been generated; verdicts are
not yet filled in.

---

## Order of work

Each step is independently testable.

### 1. Finish the cast — `listening_flip`

All eleven species have `desk_hero` and `speaking`. The remaining step is
running the `listening_flip` derivation on the newest plates — without it the
renderer falls back to the unflipped `listening` plate, which faces the wrong
way for a seat on the speaker's right.

`listening_flip` is **not** derived by mirroring the head any more. Three cut
rules were tried and each one cut a face. Derive it by whatever the current
`condition_plates.py` does for the older plates, or supply one by hand.
Never produce one by flipping the whole picture — that mirrors the GNN badge.

### 2. Character registry — `js/characters.js`

```js
{
  id: 'bulrathi_commander',
  displayName: 'Commander Grath',
  species: 'Bulrathi',
  beat: 'military_sports',
  portraits: { hero: '...', speaking: '...', listening: '...' },
  voiceId: 'am_adam',          // a Kokoro id; see /api/voices
  speechRate: '+5%',
  greeting: 'Strength to the fleet.',
  signoff: 'Grath, standing down.',
}
```

Minimum roster: Lead (robot / human commander), **Psilon** tech analyst,
**Bulrathi** military-sports, **Mrrshan** culture-diplomacy. Meklar, Sakkra,
Alkari and Darlok as field correspondents.

Voice ids must come from `/api/voices` — the catalogue is engine-owned and the
selector is built from it, so hardcoding edge-tts ids will break under Kokoro.

### 3. Atomic anchor switching — `animator.js`, `renderer.js`

A swap is atomic or it does not happen:

1. outgoing anchor's final line finishes speaking
2. station ident plays
3. incoming portrait **fully preloaded**
4. incoming anchor's first line begins

No half-swapped states, no audio bleed. For the three-up desk, place up to
three portraits side by side with the active speaker lit and the others dimmed.

Respect the audio contract: duck under the new anchor's first line and release
on `onended`; do not bypass the mixer graph; do not re-trigger an un-duck
between back-to-back lines (CLAUDE.md constraints 7–10).

### 4. Show-block scheduler — `broadcast-director.js`

```
Morning Index → Main News Desk → Sports / Fleet Briefs
              → Diplomatic Hour → Late Night Anomaly Log → (loop)
```

Each block declares `name`, `activeAnchor`, `correspondentPool`,
`targetCategories`, `segmentLength`, `bumperSet`, `handoffIntro`,
`handoffSignoff`.

**Time-aware**: a viewer at 08:00 local sees *Morning Index*, not a random
block. Local clock, UTC fallback.

### 5. Wire the show logos into the renderer

Once `logos/` is conditioned, the show logo needs a fade-in/fade-out layer in
`renderer.js` — a `globalAlpha` ramp on the viewport, `ramp()`-compliant per
constraint 8. Currently the renderer has no logo layer at all; the PNGs exist
on disk and nothing loads them.

### 6. Real stock crawl — **owner's request**

Replace the MOO resource ticker with live market data. The ticker is the one
place on screen that reports figures the viewer might actually care about,
and MOO commodities do not earn their space.

**Source decision needed.** Options, roughly in order of fit:

- **Yahoo Finance** — unofficial JSON endpoint, no key, stable for years.
  Closest match to what `feed-manager.js` already does with rss2json.
- **Stooq** — free CSV downloads, no key.
- **Alpha Vantage** — free tier with a key, 5 requests/minute.
- **Financial Modeling Prep** — free tier with a key.

The rss2json daily cap lesson applies: pick a source and confirm its rate
limit before building on it. Whatever the source, the endpoint pattern is the
same as `/api/localnews` — fetch and cache on the server, hand the ticker
manager a clean array of segments.

`GNNScript.tickerSegments()` currently builds the crawl from `COMMODITIES`
and `CONDITIONS` constants. Both go away.

**Real data.** Index level, change, percentage. Commodity prices if the source
carries them. Whatever is on the ticker is what the market is doing, and
nothing else.

### 7. Separate MOO lore from real news — **owner's standing request**

Real news is the primary content. MOO lore content is an easter egg — a nod
to the source material for viewers who know it, never a substitute for the
news itself.

Two things have to change:

- **`PACE.wireShare`** currently interleaves sector-wire bulletins with real
  stories during the normal rundown. Set to **0** for the normal rundown.
  Sector-wire beats become deliberate easter-egg moments: the top-of-hour
  chime, the glitch-engine's unlisted transmissions, the staff-channel
  secrets. Not random banter between stories.
- **Banter templates** have not been audited for in-universe terms applied to
  real headlines. Under the new goal, banter between real stories uses
  **real-world language only**. The MOO vocabulary stays in easter-egg
  moments.

What "siloed" looks like, concretely:

- A real story about a tariff ruling is read as a real story about a tariff
  ruling. The anchor does not call it a "sector trade accord." The words the
  wire sent are the words the anchor says.
- Between real stories, the anchors talk about the real world — the same
  register any news channel uses.
- When the easter egg fires — a specific keypress, the top of the hour, a
  glitch anomaly — the station goes in-universe for that beat, then comes
  back. The viewer knows it is a moment, not the broadcast.

Do not translate real stories. Do not substitute MOO vocabulary for real
nouns. The whole point of the channel is real anchors reading real news in
their own voices.

### 8. Ticker segmentation — after item 6

Once the stock crawl is live, decide what else the ticker carries. Real
weather alerts, exchange status, maybe a headline crawl. Whatever appears is
real. No MOO commodities, no "SOLAR WIND: SEVERE."

### 9. Show rundown open

The cold open should name the stories on the queue before reading them,
rather than the current "The desk is watching several stories tonight"
placeholder that names nothing. Shape:

> I am Commander Hale. This is G N N. Tonight: the prime minister's
> statement on foreign interference, orangutans returned to Borneo after
> the fires, and a ruling on the Warner Bros. Discovery sale. We begin
> with Downing Street.

Then the first story reads, then the second, then the third, and the desk
has delivered on the tease.

Needs a headline shortener (sentence → noun phrase, respecting meaning not
character count), a "what's coming up" pool in `script-writer.js`, and a
reordered cold-open sequence in `broadcast-director.js`. The director picks
three to five stories from the queue; the number is a pacing knob, same
block as the other `PACE` values.

Not in scope: the beat filter and category routing (landed), the
show-block scheduler (item 4). This rundown is per-block and will need
rewriting when blocks exist — the rewrite is small, since a block declares
its own `targetCategories` and the rundown reads from those.

### 10. Loading gate and boot screen

Several related faults appear in the first ~60 seconds after a fresh page
load and then self-correct: the anchors step on each other on the first
story, Varr's mouth does not move on her first line, music does not play at
boot. Which symptom fires varies between runs. Once the station has run for
about a minute, none recur. Suspected load-order race.

The proposal: a boot screen that waits for the station to be ready, using
one of the title cards in `assets/generated/titlecards/` with a music bed
underneath. The station does not go on air until the loading completes and
the title card has played through.

What this needs:

- The title cards to be usable — currently "in testing", prompts not
  reliable. See "Asset pipeline" for the two routes forward.
- The music bed to actually play — see the open item in `CLAUDE.md` §7
  about `playMusic()` diagnostics not yet run.
- A readiness signal from `main.js` — `loadAllAssets()` resolves when the
  assets are loaded, but the audio graph, the voice engine and the first
  feed poll all resolve separately and none of them block the broadcast
  starting.
- The director to hold `S.BOOT` until the gate clears, rather than the
  current nine-second deadline.

**Establish the load-order cause first.** A loading screen that hides the
symptom without fixing the race would just delay it, and the music issue in
particular may be permanent rather than a startup fault.

---

## The newsroom as a simulation

The station reads real headlines competently. What it does not yet do is
feel inhabited, and that is a writing problem wearing an engineering
costume. A newsroom is watchable because of the people at the desk, not
because of the rundown.

### What exists now

`js/cast.js` is the cast registry: twelve characters, each with a name, a
billing, a voice, a register, a fixation, a tic and a set of banks
(`openers` / `reactions` / `closers` / `asks`), plus a table of what they
think of one another. `js/script-writer.js` reads it and can produce:

| call | what it is |
|---|---|
| `showOpen()` | the lead anchor names themselves, then the station identifies |
| `intoBreak()` | the toss into a commercial |
| `outOfBreak()` | the return |
| `showClose()` | the sign-off, naming everyone who sat that block |
| `exchange()` | two anchors talking to each other, drawn from the relationship table |
| `banterBeat()` | a two-to-four line conversation from the anchors' own banks |
| `twoWay()` | a remote interview — brief, standard or extended shape |

The relationship table is deliberately **asymmetrical**. Rell is quietly in
love with Varr; Varr has not noticed and treats him as the freight desk.
Hale does not trust Unit 7 because it has never been outside; Unit 7 keeps
correcting Hale from the record. One-way entries are funnier and truer than
mutual ones, and the table is the right place to say so.

The show shape is wired: the director opens a block with `showOpen()`,
exchanges happen between stories, breaks have a toss in and a return, and a
close ends the block before the next show opens. Per-line speaker
attribution is in place, so an exchange's jab and reply each go out in their
own speaker's voice with the correct plate animating and the correct name
labelled.

### What to build next, in order

The section below describes the *structure* that should exist. It is not the
same as the *writing* that should fill it. The character banks and the
relationship table are currently three to seven lines per character per
register. That is enough to prove the plumbing works. It is not enough to
make a desk of twelve feel inhabited across a session, and it is the larger
of the two problems.

**0. Write the copy.** Before mood or story-reactions, the banks need to be
filled. Each character has a fixation, a register, a tic and a set of
opinions about the others. Those define the *person*; the banks are where
the person becomes audible. A first pass at a real content budget:

- **Registers per bank**: openers, reactions, closers, asks. Four.
- **Lines per register**: not three. Twelve to twenty is what a trained
  writer would produce for a character with a distinctive voice, if the
  character is going to say anything twice in a session without sounding
  canned.
- **Relationship entries**: currently twelve across the whole cast, most
  concentrated on the daytime pair. The other pairs (Bulrathi ↔ Psilon is
  the only non-daytime one with more than a single entry) need their own
  material, especially if the show-block scheduler is going to rotate them
  onto a desk.
- **Tics and fixations** are load-bearing — they are the shorthand that
  makes a line read as *this* character and not another — but they should
  not be the only thing the character says.
- **The robots are a special case.** Unit 7, Foundry-Nine and The Analyst
  share a voice (`vox_unit`) and a register (machine). Their banks need to
  be distinguishable from each other, or a listener will hear three of the
  same voice rather than three machines.

This is a writing task. The engineering scaffolding is in place:
`GNNCast.line(kind, id)` reads the banks, `castLine()` in
`script-writer.js` filters through the recency buffer,
`queueTaggedLines()` in the director plays them. A playwright or a sketch
writer could fill the banks without touching the code, and that is the
right division of labour.

**1. Mood that moves.** Each character starts with a disposition and nothing
changes it. A run of bad news should sour the desk; a long quiet stretch
should bore it. Mood then selects between line variants, so the same story
lands differently at the top of the hour than at the end of a grim block.
Mood does not produce the variants — the copy does. Write the copy first.

**2. Reactions to the actual story.** Right now banter is generic and sits
*next to* the news. A character with a fixation should react to the story in
front of them: the trade desk wants the exports figure, the intelligence
desk wants what was left out of the statement. The cheap version is keyword
matching against each character's `fixation` and a bank of lines per
fixation. The good version is below.

Reactions are in real-world language. The trade desk does not say "tonnage"
because it is a MOO word; it says "exports" or "shipping volume" because
that is what a trade desk says. Fixations steer *what* the character cares
about, not the vocabulary they use to talk about it.

**3. Two-way interviews that read as interviews.** `twoWay()` rolls three
shapes — brief (2 lines), standard (3), extended (5). The scaffolding is
right. The extended shape in particular needs more material per character so
the ask, the answer, the follow-up and the close each land in distinct
voices rather than sounding like the same writer. This is a copy pass, not
a code change.

**4. Show-block rotation.** When the scheduler lands, different blocks seat
different pairs. Every pairing that could plausibly sit together needs its
own relationship entry, and every character needs bank material that works
at multiple desks, not just the one they were written for.

### A local model writing the reactions

The pre-written approach gets a long way and should be built first, because
it is deterministic, costs nothing per line and is what makes the structure
testable. It has one ceiling: the lines cannot be *about* the story. A fixed
bank can say the trade desk cares about freight; it cannot say that this
particular tariff ruling is going to hurt this particular lane.

A local model closes that, and the machine is already set up for it — there
is an RTX 3060 with 12GB here and Ollama is installed, which is enough for a
quantised 7B to 12B model. The shape:

- **Prompt from the sheet, not from scratch.** The character's name, role,
  register, fixation and tic go in the system prompt; the story headline and
  summary go in the user turn. Ask for one sentence in that character's
  voice. The sheet is already the right shape for this, which is why it is
  written as prose attributes rather than as flags.
- **Ask off the critical path.** Generation takes a second or two, and the
  anchor cannot wait mid-read. Request the reaction when the story is
  queued, not when it is reached; the prefetch that already warms the next
  story's audio is the model for this.
- **Fall through to the bank.** A missing model, a timeout, a refusal or an
  empty reply all have to land on the pre-written line for that fixation.
  The station never stops talking because a model was slow.
- **Never let it read the news.** The headline and summary are the wire's
  words and go to the anchor verbatim; the model writes only the character's
  *reaction* to them. A model paraphrasing a real headline is a model
  inventing news, which is the one thing this project must not do.
- **Never let it invoke MOO lore.** The system prompt excludes the MOO
  vocabulary for reaction lines. The model's job is a person reacting to
  real news, not a person reacting in 1993 space-strategy language. Lore
  language is the easter-egg layer's problem and is scripted, not generated.
- **Cap and cache.** One reaction per story, kept with the story. The budget
  is a sentence; anything longer gets cut at a sentence boundary by the same
  rule the teleprompter already uses.

**Audience questions on air** — the thing Pixel News Network does — needs an
input channel this project does not have, and would want the same
pre-written fallback. It sits behind all of the above.

---

## Rigging the anchors, after the Kaiagotchi system

Reviewed `Kaiagotchi/kaiagotchi/ui/web/static/js/kaia/` and
`tools/kaia_portrait/`. It solves exactly the problem that has cost the most
here — getting many expressions out of one picture without going back to the
image model — and it is worth adopting. Not unchanged.

### What it is

One image plus thirty-one named landmarks (`kaia_rig.json`): eye corners,
lids, irises, brow inner/mid/outer, mouth corners, lips, nose, chin,
forehead, cheeks. A WebGL2 fragment shader walks every output pixel, sums a
displacement from Gaussian falloffs around the landmarks it should respond
to, and samples the source at `q - d`. Lids and lashes are drawn
procedurally rather than warped, so a blink is real rather than a squash.

Expressions are a continuous parameter space — `browRaise`, `lid`, `gazeX`,
`smile`, `smileAsym`, `mouthOpen`, `yaw`, `pitch`, `roll` and so on — with
twelve named points in it (`neutral, awake, happy, curious, bored, sad,
frustrated, sleepy, confident, broken, angry, debug`). Anything between two
moods is a blend, so it moves rather than cutting.

Everything scales off a measured face size, so the same numbers work at any
resolution.

### Why it fits

It would retire a whole class of failure. Nine of eleven `listening` plates
came back with the eyes never leaving the camera, and the only fix available
was to ask the image model again and hope. A rig makes a glance a number.
`mood` already exists on every entry in `js/cast.js` and currently does
nothing; this is what it would drive. Head yaw also gives the two anchors
turning to face each other, which is otherwise a generation per species.

### What does not come across

**The landmarks are found by MediaPipe FaceLandmarker**, which is trained on
human faces. It will almost certainly take the Human Commander, probably
struggle with Mrrshan and Psilon, and will not find a face on a bear, a
bird, a lizard, an insect, a crystal, a cyborg faceplate or a hood with two
points of light in it. Nine or so of the cast need their thirty-one points
placed by hand. That is perhaps twenty minutes each and there is no editor
for it — `build_portrait.py` writes a debug overlay to check a rig, not to
author one. A small point-placing page would pay for itself.

**It is WebGL2 and GNN draws to a 2D canvas.** The cleanest join is a second
canvas behind the existing one, rendering only the anchors, with the 2D
overlay — caption, ticker, monitor, clock — composited on top as now. The
alternative, porting the displacement to CPU, throws away the part that is
actually hard and well made.

**It samples with LINEAR filtering on smooth source art**, 610x560 and
916x840. Ours is deliberately quantised 256-colour pixel art. A displacement
field through a linear sampler will interpolate exactly the chunky pixels
that were just recovered by conditioning plates at their native size. Two
mitigations, both cheap: sample NEAREST, and warp at the source resolution
in `_inbox/` (1254px) rather than at the 244px draw size.

**Half the build pipeline is irrelevant.** Swin2SR super-resolution and a
BiRefNet alpha matte exist to clean photographic source; our plates arrive
cut out, hard-alpha and quantised already. Only the landmark step and the
rig JSON matter.

### How to find out cheaply

Rig the Human Commander alone, where MediaPipe should work unassisted, and
put him on a WebGL layer with nearest sampling at source resolution. One
character answers both open questions: whether the warp survives pixel art,
and whether the two-canvas join is as clean as it looks. If it holds, hand
rig the rest and the expression problem is closed for good. If the warp
mushes the art, that is one afternoon spent rather than twelve rigs.

---

## Testing discipline

Run `python3 tools/audio_probe.py` **three times** at each layer boundary — its
pop count is noisy between runs; `peak` and `worst jump` are the stable
numbers. Then listen by ear before calling a layer done.

Update `CLAUDE.md` as state changes. Do not add a third status document.

---

## Deliberately not doing

**Swapping the TTS engine during this work.** Kokoro is local, free and ~7×
realtime. It is flatter than a commercial engine; that is a known, accepted
tradeoff. If voice quality is revisited, isolate it as its own task with
benchmarked before/after recordings — not mixed into a feature refactor.

---

## Hands on the desk

The reference frames the owner produced get three things right that the
build did not have before this round, and all three are now in place: the
camera is pulled back, the desk is tall enough to sit at, and the anchors'
hands rest on the surface.

The anchor plates ask for forearms forward and hands loosely clasped at the
bottom edge, resting on nothing — no desk in the plate, because the desk is
composited under them. The desk's top surface is visible as a receding plane
with a bevelled front lip, tapered ends and a thin angled return, which is
what makes it furniture rather than a painted wall.

`DESK.overlap` is **0.015** in `renderer.js` — a small hide for a residual
chest crop, down from 0.049 when the plates had no hands. It can likely go
to zero on the next regeneration; it exists as a safety margin, not a
requirement.

---

## The rest of the cast

Decided while watching the two-anchor desk run, and recorded so it is not
re-litigated.

**Correspondents come in through the monitor, not through a second set.**
The obvious move — give each extra character its own studio and cut to it —
means a set, a desk and a camera angle per character, and every one of them
is another plate to generate and another layout to get wrong. The monitor
above the desk is already there, already framed, and already used for
cutaway footage. A correspondent appearing in it as a LIVE window is how a
real channel carries a remote, it needs one portrait rather than a room, and
it gives the anchors something to talk *to*. Field reports, specialist
desks and guest experts all arrive that way. **This is built** — see the
Landed table.

**Anchors facing each other needs new art, not a transform.** The plates are
drawn square to camera, looking down the lens, because that is what the
prompt asks for. Rotating or mirroring them in the engine tilts a head or
flips a badge; it does not turn a face. Two seats looking slightly inward
wants a three-quarter variant of the hero — a `_turn_left` and `_turn_right`
framing — and that is a generation per species, so it waits until the cast
is otherwise finished.

**The roster rotation is written and currently pinned off.** `main.js` holds
the full eleven-character roster with a voice each, and the code to pick a
line-up by show block. The desk is pinned to the human commander and the
Mrrshan matriarch because a channel has anchors rather than a rota. The
rotation belongs to the show-block work above: different blocks, different
desks, with these two as the main daytime pair.

## What changed

**Landed table** — added three rows: **Robot frames** (the 25 cels, produced by `python3 tools/key_robot.py`), **Two-way shape** (`twoWay()` rolling brief / standard / extended with the follow-up that drops the naming intro), **Structured anchor beats** (`banterBeat()` and the extended `exchange()`), **Character banks** — with a note that the plumbing works but the copy is placeholder.

**Order of work** — added item 9 (**Show rundown open**) and item 10 (**Loading gate and boot screen**). Both were discussed this session and drafted in `Gemini.md` but had not reached the roadmap.

**Asset pipeline / Title cards** — added a note that the title cards are needed for the loading gate, so the decision between prompt-iteration and standing-plate route should be made before the gate is built.

**Asset pipeline / MOO1 composite** — added a pointer to the review tool and the review folder, so the next agent does not have to be told separately that a first review pass exists.

**The newsroom as a simulation** — replaced "What to build next, in order" with a new ordering that leads with **0. Write the copy**. The prior items (mood, story-reactions, two-way interviews, show-block rotation) remain, but each is now framed as work that needs the copy first. Added a robots sub-bullet to the copy task (Unit 7, Foundry-Nine and The Analyst share a voice and need distinguishable banks).

**What exists now** — table of `script-writer.js` calls extended with `banterBeat()` and `twoWay()`, and `showOpen()` description corrected (the lead anchor names themselves first, then the station).

Nothing was removed. The old "wire the show shape" and "give every line an owner" items are already gone from the last rebuild; this pass adds the copy-first framing on top.
