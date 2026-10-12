# GNN — Session report for the next agent

Covers the nine-item bug report (`Prompt.md`), the root-cause analysis (`Code Fixes.md`), and the fixes as they landed. Read alongside `CLAUDE.md` and `README.md`; this document is the changelog for that session, not a replacement.

**Verified working as of this handoff:** the owner confirmed the boot and the two-way behaviour after the last fix.

---

## State of the nine reported items

| # | Symptom | Status | Where the fix lives |
|---|---|---|---|
| 1 | "Let us be precise" repeated ~20× | Fixed | `cast.js`, `script-writer.js` |
| 2 | Back-from-break redundant | Fixed | `broadcast-director.js` |
| 3 | Wrong mouth animates in a two-way | Fixed | `broadcast-director.js`, `main.js`, `renderer.js`, `cutscene-manager.js`, `animator.js` |
| 4 | MOO1 animation frames stack | **Open** | `tools/lbx.py` / `extract_all.py` — not touched |
| 5 | MOO1 asset mismatches in composites | **Open** | `scene-compositor.js` — cutaway path commented out |
| 6 | Missing background (Alkari labs) | **Open** | `scene-compositor.js` — same path commented out |
| 7 | STATUS thumbnail idles | Fixed | `icon-manager.js` |
| 8 | Speech bubble position and tail | Fixed | `text-engine.js` |
| 9 | (pointer to extractor files) | — | — |

---

## Fixed — first cluster: voice and speaker attribution

### The core mechanism

Everything in this cluster comes down to one distinction the codebase used to conflate:

- **The chair** — whoever's turn it is to read the story on the rundown. Passed once per story in `passChair()`.
- **The line's speaker** — who is actually saying the current sentence.

For a plain story read, they're the same person. For an exchange between the two anchors, or a remote two-way with a correspondent, they are not. Every symptom in this cluster came from some part of the pipeline reading the chair when it should have been reading the line.

### What changed

**`broadcast-director.js`** now tags each queued line:

```js
speechQueue.push({
    text, opts, est, token: speechToken,
    drivesDesk: opts.drivesDesk !== false,
    speakerId: opts.speakerId || null,
});
```

`drivesDesk` says whether this line's voice belongs to a seated anchor. `speakerId` names the cast entry saying it. Both are set at the top of each job in `pump()`, **before** the voice fallback runs — the fallback asks `speaker()` and would otherwise hear the previous line's speaker.

The director exposes two new functions:

- **`speakerIsSeated()`** — true when the current line's voice is an anchor's, false for a correspondent. `main.js` reads it in `GNNTTS.onStart` to gate the animator.
- **`activeSeatForLine()`** — the index of the line-speaker in the seated list, or `-1` when the speaker is not at the desk. `renderer.js` and `text-engine.js` read it. `-1` tells both: no anchor is active, hold every plate on listening, use the station-style caption box.

**`renderer.js`** `drawCast` uses `activeSeatForLine()` instead of `activeSeat()`. When the return is `-1`, no seat animates. The mirrored-listening-plate choice falls back to a midpoint reference, since there's no speaker to turn toward.

**`text-engine.js`** `speakerAnchor` uses `activeSeatForLine()`; the label and accent colour follow the line-speaker. The bubble position no longer depends on this because every caption now sits in one slot.

**`animator.js`** now gates its level read:

```js
const level = (speaking && typeof GNNTTS !== 'undefined' && GNNTTS.isSpeaking())
    ? GNNTTS.getLevel() : 0;
```

Without the `speaking &&` at the front, the animator read the correspondent's level and moved the anchor's mouth on their voice. With it, during a correspondent's line the director says `speakerIsSeated() === false`, `main.js` calls `setSpeaking(false)`, and the animator goes quiet.

**`cutscene-manager.js`** animates the correspondent's own mouth. Its `tickCorrespondentMouth()` runs a local clock gated on two things: the voice bus is live **and** the director's `speaker()` matches the scene's correspondent. The second gate is what stops the correspondent's mouth moving during the anchor's question and thanks.

### Two-way race

`beginTwoWay` used to await the cutaway open before queueing lines. In that window the director's `HOLD` case saw `!speaking` and fell through to `nextStory()`, so the two-way played over the top of the story it was meant to replace. Fixed by reserving `S.BANTER` synchronously in `beginBanter` and queueing the three lines in `beginTwoWay` **before** opening the cutaway. `beginTwoWay` is no longer `async`.

### Sign-off in the wrong voice

`beginShowClose` used `speaker()` for the voice, which reads the chair. `showClose()` names `seats[0]` in the text. When the chair happened to be Varr, Varr introduced herself as Commander Hale. Now uses `GNNScript.desk()[0]` for both the voice and the `speakerId`.

### Repeated lines

`cast.js` had exactly one relationship between the two people who sit at the desk for most of the day. `exchange()` returned the same two lines every time. Expanded to twelve entries across both directions; added a recency buffer so no entry returns twice in a six-exchange window.

`script-writer.js`:
- The `banter()` tic branch now checks the recent-line buffer before firing. The tic can only land once per forty lines of banter.
- `outOfBreak()` no longer appends the lead's tic. A tic is a character tell, not a sign-off.

### Back-from-break doubled

Two paths both played a return line when a break ended: the `S.BREAK` case in `update()` and the continuation inside `beginBreak()`. Removed the case; `beginBreak` now owns the return. It plays `signoff()` once as the BACK LIVE bumper, then holds into `S.READ`.

### Ident interrupted at first boot

`GNNGlitch.onSecret` polled for silence then called `GNNTTS.speak()` directly, which pre-empts. Its poll has a race — occasionally it fired in the same tick as the pump starting a line, cutting the anchor off mid-word. That's what stepped on the station ident on the owner's first boot, and why it didn't happen on reload. Fixed by routing through the director's new `interject()`, which queues like everything else.

---

## Fixed — second cluster: presentation

### Text ahead of the voice

`tts.js` sets `speaking = true` at the top of `speak()`, but audio doesn't start until the clip is fetched and decoded. In that window `playbackProgress()` returns `null` and `text-engine.js` fell through to its own estimate timer, typing several words before the voice arrived.

Added `waitingForAudio()` to `tts.js` — an `awaitingAudio` flag set at `speak()` entry and cleared at `el.play()`. `text-engine.js` `update()` pauses while it's true, resetting `lastTick` each frame so the timer starts from zero when the voice begins.

### STATUS thumbnail idled

`icon-manager.js` `matchIcon` returned the STATUS plate whenever a story matched no keyword — which is most stories, because the twenty-two icon categories are all science and MOO topics. Sports, entertainment and generic world news all fell through to STATUS.

Now returns `null` on no match. The monitor is blank unless the story actually fits a category.

### Speech bubble position and tail

Every caption now draws in the same bottom slot (`STATION_BOX`). The bubble above the speaker's head, and the tail pointing at their mouth, are gone. Accent colour and label still follow the speaker — the box just no longer moves per speaker.

Also fixed in this pass:
- `cutscene-manager.js`'s break card called `ctx.measureText()` before setting `ctx.font`, so every commercial top card measured against whatever font was left over from the previous draw. Font now set first.
- The correspondent scene loads **both** `hero` and `speaking` plates now, in a two-frame layer with a `mouthSwap` marker. It used to load one plate in a single-frame layer, so the correspondent's mouth was a static picture.

---

## Fixed but with a rough landing

`icon-manager.js` was pasted with two `matchIcon` functions — the second overrode the first, so the STATUS fix didn't take. On the next reload the module failed to parse and took the whole boot down to a black canvas.

`main.js` calls `GNNIconManager.loadIcons()` early in `loadAllAssets()`, before `GNNRenderer.init()` runs. If the icon module fails, that call throws, `loadAllAssets()` bails, `init()`'s catch fires, and the frame loop starts without a canvas bound to the renderer — so `renderFrame` early-returns every frame. Black screen.

Fixed by replacing the file. **Worth remembering:** if a single-file change produces a black screen, open F12 first — the console names the file and the line, and the cascade makes a small syntax error look like a total failure.

---

## Still open — the MOO1 asset issues

These are item 4, 5, 6 from the bug report. All three trace to the extractor and the compositor, not the JS that runs the station. Not touched this session; the owner has commented out the affected path so the broadcast doesn't show them.

### Item 4 — animation frames stack instead of replacing

The ghosting/phantom effect during MOO1 animations. `scene-compositor.js` clears its buffer each frame — the stacking is not at render time. It's the frames themselves.

MOO1 LBX animations are stored as **delta frames** — each frame carries only what changed from the previous one. `assets/README.md` documents the structure as `u8 kind (1 = keyframe, 0 = delta over the previous frame)`. If the decoder writes the delta payload standalone rather than compositing it against an accumulated buffer, playing frames 1, 2, 3 in sequence shows: frame 1, then frame 1 + delta of 2, then that accumulation + delta of 3. Which is what you see.

**The fix belongs in `tools/lbx.py`** (or wherever the frame body is decoded in `extract_all.py`). The check: does the decoder maintain an accumulator between frames when `kind == 0`, or does it decode each frame standalone? Those two files weren't reviewed this session.

### Item 5 — asset mismatches in composites

`scene-compositor.js` builds layers from different pools with no perspective or scale check. `MOTION.approach` in particular scales sprites across an 18× range (`from: 1.8, to: 0.1`), which puts small source sprites far past their intended perspective and large ones below it.

The owner has commented out the `GNNSceneCompositor.synthesize()` fallback in `prefetch()` and `triggerCutaway()`. Cutaways are now generated-plate-or-nothing. Commercial `body` and `claim` beats still call `synthesize('convoy')` and `synthesize('industry')` directly — deliberately left alone, pending review on air.

If any of those recipes is wanted back: bound the scale range to something plausible (`1.4 → 0.35`), add a `maxW` band to the sprite queries, and audit each recipe individually before re-enabling it. The real fix is admitting each composite as a whole rather than mixing pools.

### Item 6 — missing background

Same path, different failure. Some recipes' pool queries return empty (typically `BACKGRND` and `EMBASSY` fullscreen items with `noise <= CLEAN_BACKDROP`), `pick()` returns `null`, `makeLayer(null, ...)` returns `null`, and `.filter(Boolean)` drops the layer. The next layer then draws against the cleared buffer, which is near-black.

The Alkari research labs scene is one of these. Two fixes if this path is revived: add a per-query fallback (the `|| GNNAssets.pick(backdrops())` pattern that `convoy()` already uses), and log when a recipe's query comes back empty so the failure is visible.

---

## Written but not generated

Asset prompts, ready to paste. None of these have been generated yet.

- **Four studio sets** — Markets, Geopolitics/War, Tech, Celebrity. Each uses the shared style line from `set-prompts.md` verbatim and the same **black window panes** line the existing `studio_wide_empty.png` uses. Black is what `condition_plates.py` keys out for the backdrop; an earlier version of these prompts asked for transparency by mistake, which would have broken the keying step.
- **Five show logos** and **five cast title cards** — one per show. The title-card approach was iterated several times before landing. Two failures worth knowing about: the model lands hard on a realistic or anime prior when asked to draw two figures in a described room, so the final prompts deny both explicitly. If the one-shot cards keep missing, the fallback is one standing plate per character, composited in the engine.
- **Twenty-two icon prompts** — one per MOO1 asset icon, sized `1024×1024` with transparency, in the pre-rendered style of the other prompts.

Also noted: `condition_plates.py` has no path for `logos/`, `titlecards/`, or `icons/` yet. Those directories need entries in the file before the assets will condition.

---

## Things that looked like bugs and weren't

Recording these so they aren't re-chased.

- **The anchor filename collision** that `notes.md` flagged as "blocks all desk work" was not active. `CLAUDE.md` §3 records the collision as already fixed, and the fix had landed correctly. What looked like two generations in the same directory was one generation plus its archive.
- **The voice-ID bug** `notes.md` diagnosed ("hardcoded edge-tts IDs break under Kokoro") was wrong on the diagnosis. `am_michael` and the others *are* Kokoro IDs — the format `af_*` / `am_*` / `bf_*` / `bm_*` is Kokoro's, not edge-tts's. The underlying concern about slot-vs-ID coupling may still be real; the specific claim was not.

---

## Documentation gaps

The docs still describe the pre-fix state in a few places. Worth updating before the next session.

- **`CLAUDE.md` §1** still describes the desk as a single anchor. The code runs two.
- **`CLAUDE.md` §3** does not yet have the two-way mouth bug, the text-ahead-of-voice bug, or the back-from-break doubling. Each has a wrong diagnosis worth recording — the two-way bug especially, since the first instinct (gate the animator on the voice bus) doesn't work and the actual mechanism (per-line speaker attribution through the director) is easy to miss.
- **`CLAUDE.md` does not mention** `activeSeatForLine()` / `speakerIsSeated()` as the mechanism by which speaker attribution flows from the director to the renderer to the text engine. That's load-bearing now; a future change to it is easy to get wrong.
- **`script-writer.js`** has a comment about two back-from-break paths that is now stale — the second path was removed.
- **`text-engine.js`** still defines `PANEL` and `STATION_KINDS` but doesn't read them, and `renderChyron()` returns unconditionally. Harmless; cleanup only.

---

## Verification commands

For a fresh agent picking this up:

```bash
# Every file should parse. Any output marked BROKEN is a syntax error.
cd /home/ekco/github/GNN
for f in js/*.js; do node --check "$f" || echo "BROKEN: $f"; done

# Full broadcast run; counts exceptions and screenshots each segment.
python3 tools/drive.py 90 /tmp/run

# Clip count and level-relative pop detection.
python3 tools/audio_probe.py 110
```

**To verify the two-way fix specifically:** run the broadcast until a `TWO_WAY` beat fires (roughly one in five banter beats — `PACE.twoWayShare` is 0.22). Watch that the anchor's mouth stays shut for the correspondent's answer, and that the correspondent's plate animates on their own voice. Both failures were originally subtle enough to survive several watchings before the owner caught them.

**To verify the speaker-attribution fix:** watch a `BANTER` beat that resolves to an `exchange()` (`PACE.exchangeShare` is 0.33 of banter beats). The label above the caption box should change with each line, and the plate that animates should be the one whose voice is on the wire.

---

## Open questions worth deciding before the next session

- **The MOO1 cutaway path.** Keep it commented out, or spend a session fixing the compositor? If keeping it out, the `synthesize()` calls in `buildShot()` for commercial `body`/`claim` beats should probably go too, for consistency.
- **The extractor delta-frame bug.** Needs `tools/lbx.py` and `tools/extract_all.py` reviewed — those weren't in this session's paste. Fixing it also affects every other MOO1 animation in the broadcast, not just cutaways.
- **The standing-plate route for title cards** if the one-shot approach keeps missing. Worth deciding before generating the five cards, since the generation cost is the same either way and the standing-plate route is more reusable.


## Animation and asset issues in MOO1 scenes

These are the same class of problem — the decoded LBX assets not compositing the way they should — and appear across many cutaways, not just the ones in the screenshots.

### 4. Animation frames stack instead of replacing

During MOO1 animations, the next frame is drawn on top of the previous frame without the previous one being cleared. The result is a ghosting or phantom effect where every prior frame stays visible under the current one.

Seen in the SPECIFICATION card and in "A GNN PRESENTATION." Present in numerous MOO1 animations, not just those two.

This looks like an asset-corruption issue in the original rip and will need fixing at some point.

Reference: `~/Downloads/animation phantoms.png`

### 5. Mismatched assets composited together

Two assets that don't belong together are being drawn over one another — ships, HUD, and scene elements from different sources at different scales and perspectives ending up in the same frame.

Seen in the ship-firing cutaway, the SPECIFICATION card with a rectangle of a different image overlaid, and the comet scene. Also present across numerous MOO1 scenes.

Reference: `~/Downloads/asset_mismatch.png`

### 6. Missing background

The Alkari research labs cutaway has no background — the figure is drawn against flat black.

Reference: `~/Downloads/missing_background.png`

---

