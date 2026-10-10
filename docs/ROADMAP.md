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
