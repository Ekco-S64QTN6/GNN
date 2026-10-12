```markdown
# GNN — Session bug report and change requests

Context: this is the GNN newscast project. Read `CLAUDE.md` first — it is the
source of truth for current state and load-bearing constraints. `docs/ROADMAP.md`
is the forward plan. This report is a set of live bugs and change requests
observed during a watch session, with what we know about each. Do not assume a
cause; investigate before acting.

---

##  — The first minute after a fresh boot is broken, then self-corrects

**Symptom.**
Several related failures happen in the first minute or so after a fresh page
load, and then everything sorts itself out for the rest of the broadcast.
Which specific symptoms fire varies between runs — sometimes it is the mouth,
sometimes the interruptions, sometimes neither but a different glitch.

**The observed symptoms.** Any of the following, sometimes in combination,
sometimes individually, always inside the first ~60 seconds after boot:

- **The anchors step on each other on the first story.** Varr starts
  reading a wire headline and only gets "UK PM" out before the next story
  cuts her off and its anchor reads over the top of hers. After the first
  minute this stops happening.

- **Varr's mouth does not move on the first line after the station
  ident.** Her voice plays, the transcript types, but the plate drawn is
  the listening pose. By her second story the mouth animates correctly.

- **No music bed at boot.** The cold open's `playMusic()` call fires but
  no track is heard. During commercial breaks later, effects play, but a
  music track does not. Diagnostics were added to `playMusic` in a
  previous session (`console.log('[GNN Audio] playMusic called', ...)`
  and three warnings on the failure paths) — check the browser console
  during a boot to see which path fires.

**What we know.**
- Everything sorts itself out after about a minute. Once the station has
  run that long, none of these repeat.
- A clean reload reproduces the window; which symptom fires varies.
- The mouth issue and the interruption issue are both only in this
  window and disappear together.
- The music issue appears to be permanent — it does not resolve after the
  first minute. May be a separate cause from the load-order symptoms.

**What we don't know.**
- Which subsystem is loading late. Candidates: the anchor plates (25 robot
  frames, 11 species × 4 states), the story icons (22), the audio graph,
  the RSS feeds, the asset manifests, the voice engine's first pipeline
  warm-up. Any of these being slow to resolve could push the first beat
  of the broadcast out of sync with the second.
- Whether the symptoms share one cause or several that happen to fall in
  the same window.
- Whether a loading gate would fix all of them, some of them, or none.

**Proposed direction — owner's idea.**
A boot screen that waits for the station to be ready, using one of the
title cards in `assets/generated/titlecards/` with a music bed underneath.
The station does not go on air until the loading completes and the title
card has played through. This would:

- Give every subsystem load time to resolve before the first story starts.
- Cover the blank loading window with a station presentation, which is what
  a real channel does between programmes.
- Use the title cards, which currently exist on disk and are not wired to
  anything. The ROADMAP marks them "in testing" — the prompts are not
  reliable yet and the delivery shape is still being decided.
- Give the music bed a place to play, which is where a channel's ident
  music would go.

This is offered as a direction, not a prescription. The load-order cause
needs establishing first — a loading screen that hides the symptom without
fixing the underlying race would just delay it.

**Reproduce by** reloading the page with the browser console open and
watching the first ~90 seconds. Note which symptoms appear — they vary
between runs. Let the station run past the one-minute mark and confirm the
symptoms stop. For the music issue, watch the console for the
`[GNN Audio] playMusic ...` lines and report which path fires.

## Bug 2 — Correspondent plates: `_hero` has the GNN badge, `_speaking` does not

**Symptom.**
Some correspondents in `assets/generated/correspondents/` have a GNN badge on
their `_hero` plate that is missing from their `_speaking` plate. The badge is
part of the character art and should be on both.

**What we know.**
- This is a known issue. It has been fixed before, likely in a script that
  copies the badge region from the hero onto the speaking plate (or a
  variant of the same fix applied to the anchor plates).
- Check `tools/` for a script that handles this, and check `CLAUDE.md` §3 for
  the entry about the badge and the anchor plate fix — the mechanism
  described there is the one to reuse.

**Fix.** Run whatever script exists for the correspondents, or extend the
existing script to cover the correspondents directory if it only handles
anchors. Verify by opening both plates for each affected correspondent.

---



---

## Task — review the MOO1 composites and fix or delete each recipe

**Context.**
The nine recipes in `js/scene-compositor.js` assemble full-screen cutaway
scenes out of LBX-decoded sprites, backdrops and chrome plates. They were
written when the compositor was the primary source of B-roll. Now the
generated cutaway plates are the primary path and the composites are the
fallback, and the composites have been producing bad shots.

A review tool exists at `tools/scene_review.html` — opens at
<http://localhost:8080/tools/scene_review.html>, renders each recipe with
either a video or a contact sheet, and downloads them. A first review set
is in `docs/scene-review/`. Read `docs/scene-review/README.md` before
starting; it holds the observed salvage notes and the verdict table.

**What to do.**
Work through the recipes one at a time. For each:

1. Watch the video review of the recipe in `docs/scene-review/`. If a
   recipe has no video, run the tool and generate one.
2. Identify which of the three fault classes is present:
   - **Composite fault** — a layer that does not belong, or is drawn at
     the wrong scale for the shot. Fixable in `js/scene-compositor.js`.
   - **Extractor fault** — delta frames stacking, or a chromatically
     scrambled asset admitted to a pool it should not be in. Not fixable
     in the compositor; note it and move on.
   - **Missing background** — a pool query returns empty and a layer is
     dropped. Usually fixable with a fallback query, the pattern
     `convoy()` already uses.
3. Fill in the verdict table in `docs/scene-review/README.md`: keep, fix
   (with the specific layer named), or delete.
4. Where the fault is a composite fault and the fix is bounded, make it.

**Do not fix the extractor faults in this pass.** Delta frame stacking
and chromatic scrambling both belong in `tools/lbx.py` /
`tools/extract_all.py`, and fixing them affects every animated MOO1 asset
in the broadcast, not just these recipes. Note which recipes are blocked
by them and move on.

**Do not delete a recipe until you have watched it and recorded the
reason.** The verdict table is the record.

**What a fix looks like.**
Some recipes are one layer away from working. Two examples already
documented in `docs/scene-review/README.md`:

- The `SPECIFICATION` card has a phantom translucent square overlaying
  the bottom-left third of the shot. The underlying scene — dark clouds,
  a green-lit ridge, mottled terrain — reads correctly. Remove the square
  layer and the recipe is likely salvageable.
- The `Alkari research labs` scene reads correctly but has no background,
  because a pool query returned empty. Add the fallback query and the
  scene comes back.

**What a delete looks like.**
A recipe where the parts do not go together at all. Remove it from
`RECIPES` in `js/scene-compositor.js`. `cutscene-manager.js` picks up the
change automatically — a route with no generated plate and no composited
fallback simply has no cutaway.

**Where the recipes live.** `js/scene-compositor.js` — the `RECIPES`
object, which currently has `convoy`, `tactical`, `survey`, `council`,
`interview`, `industry`, `anomaly`, `cyber` and `deepfield`.

**What "done" looks like.**
Every recipe in the verdict table with a keep, a fix, or a delete. Every
composite fault that was bounded has been fixed and re-rendered. Every
extractor fault has been named in the notes, so the next pass knows which
recipes are waiting on the extractor rather than on the compositor.

---
## Change request — the show should open on a rundown, then work through it

**Current behaviour.**
The cold open finishes and the station goes straight into the first story.
The opener's tease — "The desk is watching several stories tonight" — is a
placeholder that names nothing. What plays after it depends entirely on
timing: if a hold or a toss is queued before a story is ready, one of the
toss lines fires ("That story continues to develop. Meanwhile.") with no
story in between, so the anchor announces a handoff to nothing.

There is no rundown beat. A real channel opens with the stories the
programme is going to cover, then works through them one at a time. GNN
reads the first story with no announcement of what else is coming.

**What we want.**
A rundown line at the top of the block, built from the actual stories on
the desk's queue for the next fifteen minutes or so. The anchor names
them, teases each one briefly, and then the show goes into them in order.

Shape:

> I am Commander Hale. This is G N N. Tonight: the prime minister's
> statement on foreign interference, orangutans returned to Borneo after
> the fires, and a ruling on the Warner Bros. Discovery sale. We begin
> with Downing Street.

Then the first story reads, then the second, then the third, and the desk
has actually delivered on the tease.

**What this needs.**

- **Headline extraction from the queue.** The stories are already in
  `queue` at cold-open time. The rundown line is built by naming three to
  five of them in order. This is a generation pass on the existing queue,
  not a new feed.
- **A "what's coming up" pool in `script-writer.js`** with slots for the
  named stories, similar to how the commercial copy uses the ship and star
  vocabularies. The structure is a lead-in ("Tonight:"), a list of
  headlines compressed to noun phrases, and a handoff to the first story.
- **A headline shortener.** The wire headlines are sentences; a rundown
  line is a noun phrase. "UK PM Andy Burnham Says It Is 'Clear' Russia
  Interfered In 2016 Brexit Vote" becomes "the prime minister's statement
  on foreign interference". This is the same class of problem as
  `truncateSentenceCleanly` in `feed-manager.js` — the shortening has to
  respect meaning, not chop at a character count.
- **A queue-depth guard.** If fewer than three stories are queued at
  cold-open, the rundown line either names what is there or is skipped
  and the anchor goes straight into the first story. Same fallback as the
  existing `showOpen()`, which handles the no-seated-cast case.
- **Reorder the cold-open sequence.** Today: `beginColdOpen()` plays the
  show open, then `nextStory()` fires. The open needs to be two beats —
  a station line, a rundown line naming the stories, then the handoff
  into the first one. That means `showOpen()` returns a longer structure
  than a single string, or a separate `showRundown()` is called by the
  director between the open and the first story.

**What this doesn't need.**

- No new feed. The stories are already on the queue.
- No new asset. The line is copy, drawn from the wire's own text.
- No scheduler changes. This is a director and script-writer change only,
  inside the existing cold-open path.

**Why this matters.**
It closes the gap between what the anchor says the programme is doing
("the desk is watching several stories tonight") and what the programme
actually does. Right now the tease is empty. A real rundown makes the
show feel edited rather than read, and it gives the viewer a reason to
stay through the first break — they know what is coming.

**Where the code lives.**
`js/script-writer.js` — `showOpen()` for the current opener, and a new
`showRundown()` or an extension of `showOpen()` to return a multi-line
beat.
`js/broadcast-director.js` — `beginColdOpen()`, which sequences the open
and the first story, and where the rundown beat would be inserted.

**Not in scope.**
The beat filter and category routing (already landed). The two-anchor
format work (separate change request). The show-block scheduler (ROADMAP
item 4) — this rundown is per-block, not per-channel, and will need to be
rewritten when blocks exist. The rewrite is small: a block names its own
`targetCategories` and the rundown reads from those.

**Open question worth deciding before building.**
How many stories does the rundown name? Three is the floor for a real
news tease; five is the most a viewer will hold. Six is too many. The
director picks the number by how many are queued, or by a fixed
`PACE.rundownStories` in the same block as the other pacing knobs.

## Rules for this session

- **Verify behaviour, not presence.** Every claim in this report is what was
  seen on air, not what the code should be doing.
- **Do not fix a bug you have not reproduced.** Bugs 1 and 2 are concrete;
  Bug 3 has an identified fix that needs applying.
- **Update `CLAUDE.md` as state changes.** New bugs fixed get a new §3 entry
  with the evidence. New open items go in §7.
- **Do not mix the change requests with the bugs.** Bugs 1–3 are small and
  self-contained. The script work is a larger change and deserves its own
  scope.

