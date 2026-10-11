# ROADMAP — what is still to build

State and constraints live in [`CLAUDE.md`](../CLAUDE.md). This file is only
the forward plan. It absorbs the unbuilt parts of the October brief; the
brief's §3 and §4 are closed (see CLAUDE.md §4 for why §3 was a false alarm).

**Nothing here is started.**

---

## The target

GNN today is a **single robot anchor** reading an RSS rundown. The target is a
**multi-anchor desk** — a rotating cast of Master of Orion species sharing a
news desk inside named, scheduled programme blocks.

The structural model is a 24/7 simulated channel: recurring named shows, each
with its own host, beat and visual identity. All content stays inside 1993
*Master of Orion* lore.

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
   council vote, hack → hacker code).
5. Read a **MOO resource ticker**, not a stock crawl.
6. Read RSS stories **translated into in-universe events** with no real-world
   leakage.
7. See **no corrupted or stretched sprites** — already enforced by the pool
   gates; keep querying pools.

---

## Order of work

Each step is independently testable. The first two are the critical path and
do not depend on the rest.

### 1. Generate the anchor art — blocks everything else

`assets/generated/prompts.md` already contains 60 ready-to-paste prompts
(regenerate with `python3 tools/prompt_bridge.py`). Nothing has been generated
from them yet, so **every anchor portrait path the registry will want is
currently absent.**

Needed first: the 30 anchor portraits (10 species × hero / speaking /
listening) and `desk/desk_three_up_empty.png`.

The three states per species must share pose, scale, eye-line and lighting —
the engine crossfades hero→speaking on the active anchor and holds listening on
the others, so any drift between them reads as a glitch.

Save to the exact paths the prompts name, then `python3 tools/verify_assets.py`.

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

### 5. RSS → MOO-lore translation

A formatting layer in front of `feed-manager.js`:

| real | in-universe |
|---|---|
| tech-stock news | galactic cybernetics index update |
| space-agency launch | Orion colony transport log |
| diplomatic summit | Mrrshan–Psilon trade accord |
| cybersecurity breach | Darlok infiltration of a Meklar relay |
| climate / environment | terraforming update, Sol colony |

- **Preserve the underlying factual claim.** Do not fabricate events.
- Never emit real brands, tickers, politicians or handles.
- Tag each story with `category`, `suggestedAnchorId`, `mooLocation`,
  `pipSceneId`.

### 6. PIP scene mapping

Route the twelve subjects in `assets/generated/prompts.md` (each prompt already
lists its keywords):

- Starship Battle → fleet / war / invasion
- Council Vote, Council Summit → diplomacy / treaty / politics
- Hacker Code, Spy Infiltration → cyber / espionage / leaks
- Space Vortex, Black Hole → physics / astronomy / anomalies
- Asteroid Mining, Station Trade → economy / industry
- Solar Flare, Virus Outbreak → disaster / emergency

### 7. Ticker overhaul

Replace the generic crawl with a MOO resource feed:

```
ENERGY CREDITS: +2.4%  |  MINERALS: 142.55 ▲  |  RESEARCH POINTS: +0.8%
ORION ARTIFACTS: 8,450 ▼  |  SOLAR WIND INDEX: SEVERE  |  COLONY SHIP: LAUNCH READY
```

Rates drift slowly — tenths of a percent per second at most, no per-frame
jitter. Stays inside the CRT bounds (constraint 3).

### 8. Exterior window backdrop

Rotate per show block so the set feels alive: Fleet Briefs → shipyard or colony
domes; Anomaly Log → black hole or nebula. Sixteen plates (four moods × four
times of day) are in the prompt file.

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
desks and guest experts all arrive that way.

What that needs: the PIP has to accept a cast portrait as well as footage,
the director needs a beat type for a two-way (anchor asks, correspondent
answers, anchor thanks), and the correspondent's voice has to duck the
anchors rather than overlap them.

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

---

# The newsroom as a simulation

The station reads real headlines competently. What it does not yet do is
feel inhabited, and that is a writing problem wearing an engineering
costume. A newsroom is watchable because of the people at the desk, not
because of the rundown.

## What exists now

`js/cast.js` is the cast registry: twelve characters, each with a name, a
billing, a voice, a register, a fixation and a verbal tic, plus a table of
what they think of one another. `js/script-writer.js` reads it and can
already produce:

| call | what it is |
|---|---|
| `showOpen()` | the station names itself, then the lead anchor names themselves |
| `intoBreak()` | the toss into a commercial |
| `outOfBreak()` | the return, sometimes carrying the lead's tic |
| `showClose()` | the sign-off, naming everyone who sat that block |
| `exchange()` | two anchors talking to each other, in character |

The relationship table is deliberately **asymmetrical**. Rell is quietly in
love with Varr; Varr has not noticed and treats him as the freight desk.
Hale does not trust Unit 7 because it has never been outside; Unit 7 keeps
correcting Hale from the record. One-way entries are funnier and truer than
mutual ones, and the table is the right place to say so.

## What to build next, in order

**1. Wire the show shape into the director.** The scripts exist and nothing
calls them yet. The director needs a block structure — open, stories with
exchanges between them, a break with a toss in and a return, a close — and
it should run `showOpen()` on the first block of an hour rather than on
every cold open.

**2. Give every line an owner.** `exchange()` already returns lines tagged
with the character who says them. The director must hand each to that
character's voice and make that character's mouth move, which means the
active seat is per-line rather than per-block. This is the single change
that makes the desk read as two people instead of one voice and a
decoration.

**3. Mood that moves.** Each character starts with a disposition and nothing
changes it. A run of bad news should sour the desk; a long quiet stretch
should bore it. Mood then selects between line variants, so the same story
lands differently at the top of the hour than at the end of a grim block.

**4. Reactions to the actual story.** Right now banter is generic and sits
*next to* the news. A character with a fixation should react to the story in
front of them: the trade desk wants the tonnage, the intelligence desk wants
what was left out of the statement. The cheap version is keyword matching
against each character's `fixation` and a bank of lines per fixation. The
good version is below.

**5. Correspondents through the monitor.** Covered earlier in this document:
the rest of the cast appear in the over-the-shoulder box as remote
two-ways rather than on sets of their own.

## A local model writing the reactions

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
- **Cap and cache.** One reaction per story, kept with the story. The budget
  is a sentence; anything longer gets cut at a sentence boundary by the same
  rule the teleprompter already uses.

**Audience questions on air** — the thing Pixel News Network does — needs an
input channel this project does not have, and would want the same
pre-written fallback. It sits behind all of the above.

---

# Rigging the anchors, after the Kaiagotchi system

Reviewed `Kaiagotchi/kaiagotchi/ui/web/static/js/kaia/` and
`tools/kaia_portrait/`. It solves exactly the problem that has cost the most
here — getting many expressions out of one picture without going back to the
image model — and it is worth adopting. Not unchanged.

## What it is

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

## Why it fits

It would retire a whole class of failure. Nine of eleven `listening` plates
came back with the eyes never leaving the camera, and the only fix available
was to ask the image model again and hope. A rig makes a glance a number.
`mood` already exists on every entry in `js/cast.js` and currently does
nothing; this is what it would drive. Head yaw also gives the two anchors
turning to face each other, which is otherwise a generation per species.

## What does not come across

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

## How to find out cheaply

Rig the Human Commander alone, where MediaPipe should work unassisted, and
put him on a WebGL layer with nearest sampling at source resolution. One
character answers both open questions: whether the warp survives pixel art,
and whether the two-canvas join is as clean as it looks. If it holds, hand
rig the rest and the expression problem is closed for good. If the warp
mushes the art, that is one afternoon spent rather than twelve rigs.

