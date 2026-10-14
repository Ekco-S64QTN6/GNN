Here's the consolidated handoff. I've folded everything useful from the five session documents into one file, told you which files to delete, and put the concrete still-open items up front where they can be seen.

## The file — save as `HANDOFF.md` at the repo root

```markdown
# GNN — Handoff

**Consolidated session handoff. Supersedes `Gemini.md`, `Deepseek.md`,
`DeepSeek_work_report_01.md`, `DeepSeek_work_report_02.md` and
`dsdfsdf.md`, all of which are now redundant and should be deleted.**

Read alongside:

- **`CLAUDE.md`** — canonical current state, fixed bugs with evidence,
  and the load-bearing constraints. §2 is the section not to break.
- **`docs/ROADMAP.md`** — forward plan. Some of it is now stale.
- **`README.md`** — public front page.
- **`docs/scene-review/README.md`** — MOO1 composite verdict table.

Last consolidated: after the per-set desk-line work.

---

## 1. Current state

The station runs. The last verified end-to-end run in `CLAUDE.md` §1
still describes the shape; the additions since are:

| | |
|---|---|
| Studio sets | Ten, all rotating. Every set's desk line is measured and written to `layout.json`, and the anchors seat correctly in all ten. |
| Anchor pairs | Ten pairs rotating by show block, drawn from twelve species. |
| Show length | Fifteen minutes wall clock, floor of four stories. |
| Correspondent | One per show, forced into the second half as a two-minute panel. |
| Real market crawl | Live Yahoo quotes, no fictional commodities in the price stream. |
| Voice | Kokoro-82M, local. Lip-sync gated on the voice envelope. |
| Per-line speaker attribution | Landed. `activeSeatForLine()` and `speakerIsSeated()` in the director; consumed by renderer, text engine, animator. |

Tools added since the last `CLAUDE.md` update:

- `tools/studio_review.html` — grid and single view of all ten sets with
  a per-set desk-line slider. **Copy Python line** puts the corrected
  value on the clipboard for pasting into `condition_plates.py`.
- `tools/scene_review.html` — MOO1 composite review (see §3).

---

## 2. What landed in the most recent cycle — desk lines

Each studio plate puts its desk at a different height in the frame. Until
this cycle, every set drew the anchors at the studio's own `0.468`, so
nine of the ten had the anchors floating above the desk or sunk into it.

**The chain:**

- `condition_plates.py` — `DESK_LINES` dict names the eye-confirmed value
  per set. `desk_line_for()` returns the named value, or falls back to
  window bottom + `DESK_LINE_OFFSET`. Written to `layout.json` as
  `deskLines` (a map) and `deskLine` (the primary set's value).
- `layout.json` — carries both. Edited directly when re-running the tool
  is not wanted; the tool overwrites it on next run.
- `main.js` — `loadAllAssets()` reads `layoutDeskLines` and
  `primaryDeskLine` from the layout, and attaches a `deskLine` field to
  every set entry in the `sets` bundle.
- `renderer.js` — `currentDeskLine` module state, set in `init()` from
  `assets.deskLine`, swapped in `setShowBlock()` from the set's own value,
  read in `drawCast()` and `hitRegions()` in place of the constant.
- `tools/studio_review.html` — slider per set, live preview, copy line.

**Confirmed values:**

```
studio_wide_empty      0.4680
market_wide_empty      0.4680
geopolitics_wide_empty 0.4910
tech_wide_empty        0.5100
celebrity_wide_empty   0.5150
sports_wide_empty      0.5110
diplomatic_wide_empty  0.5499
anomaly_wide_empty     0.5380
weather_wide_empty     0.5270
archive_wide_empty     0.5690
```

If a plate is regenerated, tune it in the tool and paste the result into
`DESK_LINES`, then re-run the tool.

---

## 3. Still open — bugs

### 3.1 The first minute after a fresh boot is broken, then self-corrects

Several related failures in the first ~60 seconds after a page load, then
they stop. Which symptom fires varies between runs.

Observed symptoms, any one or several:

- The anchors step on each other on the first story.
- Varr's mouth does not move on her first line after the ident.
- No music bed at boot.

Once the station has been running for about a minute, none of them recur.

Suspected load-order race. Candidates: anchor plates, story icons, audio
graph, RSS feeds, asset manifests, voice pipeline warm-up.

Proposed direction: a boot screen using one of the title cards with a
music bed underneath, holding until every subsystem resolves.

**Establish the cause before building the screen.** A loading screen that
hides the symptom without fixing the race only delays it.

### 3.2 Music bed does not play

Diagnostics are in `playMusic()` in `audio-engine.js`: a log at entry,
warnings on the three failure paths, a log on success. **Not yet run with
them on** — check the browser console during a boot and report which path
fires.

The files are provably fine — Ogg Vorbis, plays in `/usr/bin/mpv`. Note:
the shell `mpv` alias points at an uninstalled flatpak, use the absolute
path.

The boot bed uses `playBootTrack()`, not `playMusic()`. Those are two
different code paths; the diagnostic only covers the second.

### 3.3 Correspondent `_speaking` plate missing the GNN badge

Some plates in `assets/generated/correspondents/` have the badge on
`_hero` but not on `_speaking`. Check by opening both plates for each
correspondent. There is a badge fix in `condition_plates.py` for the
anchor plates — the mechanism to reuse.

May not be current if the correspondent plates were regenerated. Check
first before re-fixing.

### 3.4 MOO lore still on the ticker

`script-writer.js` `tickerSegments()` still emits `SOLAR WIND: SEVERE`,
`BEACON NET: NOMINAL` and a `SECTOR: …` block from a `CONDITIONS` array.
This violates the standing owner request in `ROADMAP.md` §7 that MOO
lore be siloed to easter eggs.

**Fix:** remove `CONDITIONS` and the `SECTOR: …` loop from
`tickerSegments()`. The market quotes and wire headlines are the only
things that should be on the crawl.

### 3.5 `passChair()` has dead code with a typo

In `broadcast-director.js`:

```javascript
function passChair() {
    if (typeof GNNRenderer === 'undefined' || !GNNRenderer.seededIds) {
        // Defensive: ...
    }
    if (typeof GNNRenderer === 'undefined' || !GNNRenderer.seatedIds) return;
    ...
}
```

`seededIds` is a typo for `seatedIds`. The first `if` block is empty.
Harmless — the second check does the real work — but a `grep seatedIds`
trap. Delete the first block.

### 3.6 `blockIndex = (blockIndex + 1) % 10` hardcode

In `broadcast-director.js` `beginShowClose()`:

```javascript
blockIndex = (blockIndex + 1) % 10;
```

`GNNRenderer.setShowBlock()` does the modulo itself. Hardcoding `10`
means adding an eleventh set to `SET_FILES` will silently land the
rotation one block out of step. Should be a plain `blockIndex++`.

---

## 4. Still open — change requests

### 4.1 Show rundown open

The cold open should name the stories on the queue before reading them,
rather than the current placeholder that names nothing. Shape:

> I am Commander Hale. This is G N N. Tonight: the prime minister's
> statement on foreign interference, orangutans returned to Borneo after
> the fires, and a ruling on the Warner Bros. Discovery sale. We begin
> with Downing Street.

Needs:

- A **headline shortener** — sentence → noun phrase, respecting meaning
  not character count. Same class of problem as
  `truncateSentenceCleanly()` in `feed-manager.js`.
- A **"what's coming up" pool** in `script-writer.js`.
- A **queue-depth guard** — fewer than three stories queued means the
  rundown either names what is there or is skipped.
- A **reordered cold-open sequence** — two beats, open then rundown,
  then the handoff to the first story.

`js/script-writer.js` (`showOpen()`, new `showRundown()`) and
`js/broadcast-director.js` (`beginColdOpen()`).

**Not in scope:** beat filter, category routing, scheduler. Those are
landed or separate.

**Open question:** how many stories does the rundown name? Three is the
floor, five is the ceiling. Pick a `PACE.rundownStories`.

### 4.2 MOO1 composite review

Nine recipes in `js/scene-compositor.js`. Generated plates are now the
primary path; the composites are fallback. The fallback has been
producing bad shots.

A review tool at `tools/scene_review.html` renders each recipe as a
`.webm` clip or a 4×2 contact sheet. A first review pass has been
generated; the verdict table in `docs/scene-review/README.md` is **not
yet filled in**.

Already fixed in `scene-compositor.js`:

- `cyber` recipe deleted.
- `industry()` COLONIES query removed (the tiles decode wrong).
- `council()` delegate cut-ins removed.

Three fault classes:

- **Composite fault** — fixable in `scene-compositor.js`.
- **Extractor fault** — belongs in `tools/lbx.py` /
  `tools/extract_all.py`. Not fixable in this pass. Note and move on.
- **Missing background** — add a per-query fallback; the `convoy()`
  pattern.

Two examples already documented:

- The `SPECIFICATION` card has a phantom translucent square overlaying
  the bottom-left. Remove the square layer and the scene is salvageable.
- The `Alkari research labs` scene has no background because a query
  returned empty. Add the fallback query.

**Do not delete a recipe without watching it and recording the reason.**
The verdict table is the record.

**Do not fix the extractor faults in this pass.** Delta frame stacking
and chromatic scrambling affect every animated MOO1 asset, not just the
recipes.

### 4.3 `condition_plates.py` has no path for `logos/`, `titlecards/`, `icons/`

Three new asset directories, none conditioned. The tool needs an entry
for each before anything composites them.

### 4.4 Title cards in testing

Two problems with the one-shot prompts:

- The image model lands on a commercial style prior (photorealistic,
  then anime) when asked to draw two figures in a described room.
- The background it generates does not match the studio sets.

Fallback route: one `_standing.png` per character in the anchor style,
composited over a set plate by the engine. More work up front, reuses
existing art, the two cannot disagree.

Decide before generating the five cards.

### 4.5 `listening_flip` for the newest plates

Not re-derived for the newest plates. Without it the renderer falls back
to the unflipped `listening`, which looks the wrong way for a seat on
the speaker's right.

Derive by supplying a hand-mirrored plate in `_inbox/`, or by whatever
`condition_plates.py` does for the older plates. **Never by flipping the
whole picture** — that mirrors the GNN badge.

### 4.6 Extractor faults

Two known, both in `tools/lbx.py` / `tools/extract_all.py`:

- **Delta frame stacking** — each frame carries only what changed from
  the previous one. If the decoder writes the delta payload standalone
  rather than compositing it against an accumulator, animations show
  every prior frame under the current one.
- **Chromatic scrambling** — a handful of items were authored against
  screen palettes the archives never shipped. They decode structurally
  correct but with scrambled colour. Flagged `noise > 95` and routed to
  the glitch engine on purpose; the compositor keeps them out of footage.

Fixing delta stacking affects every animated MOO1 asset in the broadcast,
not just cutaways.

---

## 5. Documentation that is stale

- **`CLAUDE.md` §7** lists several items as open that have landed: real
  stock crawl, anchor rotation, ten-set rotation. Update or delete those
  bullets.
- **`docs/ROADMAP.md`** still lists the ten-set rotation and the
  show-block scheduler as future work in "Order of work". Some of that is
  done.
- **`Gemini.md`, `Deepseek.md`, `DeepSeek_work_report_01.md`,
  `DeepSeek_work_report_02.md`, `dsdfsdf.md`** — all superseded by this
  document.

---

## 6. Verification

```bash
# Every JS module should parse. Any BROKEN line is a syntax error.
for f in js/*.js; do node --check "$f" || echo "BROKEN: $f"; done

# Full broadcast run; counts exceptions and screenshots each segment.
./start.sh --bg
python3 tools/drive.py 90 /tmp/run

# Clip count and level-relative pop detection.
python3 tools/audio_probe.py 110

./stop.sh
```

Tools URLs, once the server is running:

```
http://localhost:8080/tools/studio_review.html
http://localhost:8080/tools/scene_review.html
```

---

## 7. Rules for the next session

- **Verify behaviour, not presence.** Claims in documents — including
  this one — should be checked against the running code before acting.
  A metric that passes can still be the wrong metric.
- **Do not fix a bug you have not reproduced.**
- **Update `CLAUDE.md` as state changes.** New fixed bugs get a new §3
  entry with the evidence. New open items go in §7.
- **Keep bugs and change requests separate.** The bugs in §3 are small
  and self-contained. The requests in §4 are larger scopes.
```

## Files to delete

Once `HANDOFF.md` is saved, these five can go — every useful fact in them is now in `HANDOFF.md` or already in `CLAUDE.md`:

| File | Why delete |
|---|---|
| `Gemini.md` | Bugs and change requests folded into `HANDOFF.md` §3 and §4. |
| `Deepseek.md` | Code review folded into §3.4–3.6. |
| `DeepSeek_work_report_01.md` | Session report; superseded by §3.6 and by `CLAUDE.md` §3. |
| `DeepSeek_work_report_02.md` | Session report; superseded by §3.2 and by `CLAUDE.md` §3. |
| `dsdfsdf.md` | Analysis; the fixes it describes are already in `CLAUDE.md` §3. |

```bash
rm Gemini.md Deepseek.md DeepSeek_work_report_01.md DeepSeek_work_report_02.md dsdfsdf.md
```

## Files to keep

| File | Why keep |
|---|---|
| `CLAUDE.md` | Canonical. Referenced by every other document. Should be updated with a note pointing at `HANDOFF.md` for the newest state. |
| `README.md` | Public front page. |
| `docs/ROADMAP.md` | Forward plan. Needs updating — some items done. |
| `docs/scene-review/README.md` | The MOO1 verdict table lives here. |

## One thing worth doing to `CLAUDE.md`

Add a single line near the top, after the "Last verified at" line:

```
> **Current state:** see `HANDOFF.md` for the most recent cycle. This
> file records fixed bugs and load-bearing constraints; the handoff
> records what is being worked on right now.
```

That way the next agent opens `HANDOFF.md` first, sees §3 and §4 (the concrete open work), and drops into `CLAUDE.md` only when they need to know whether something was fixed before or to check a constraint.
