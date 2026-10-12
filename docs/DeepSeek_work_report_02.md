# GNN — Session report since last push

Commit this covers: everything after `Fix broadcast bugs, add per-line speaker attribution, add generated asset library`.

Two documents were produced this session and should be filed with the code:
`Gemini.md` (open bugs and change requests) and this report.

---

## Fixed

### `tools/key_robot.py` was never actually run
The 25 robot frame 404s at every boot were not a code fault — the tool was being invoked with `bash tools/key_robot.py`, which reads the Python docstring as shell and dies on line 1. Run with `python3 tools/key_robot.py`, it produces all 25 plates into `assets/generated/anchors/`. The 404s are gone; the robot is loadable again.

### Cutaway 404s — `_02` variants removed from `GENERATED`
Three names (`planet_invasion_02`, `space_vortex_02`, `starship_battle_02`) were still listed in `GENERATED` in `cutscene-manager.js` but had been deleted from disk. Every story routed to `survey`, `anomaly` or `tactical` had a one-in-three chance of trying one and falling back to the MOO1 compositor. Removed.

### CNBC feed 422s removed
`search.cnbc.com/rs/search/combinednewsletter/rss` returns 422 through rss2json on every poll. Removed from `FEEDS` in `feed-manager.js`.

### WATCH: prefix stripping
Some wire feeds file video and live-coverage headlines as `Watch: ...` or `Watch live: ...`. The label survived into the anchor's mouth and reads as a stutter. Added a single regex to `cleanFeedText()` in `feed-manager.js` that strips the leading label from title and description. Anchored to the start of the string so it does not touch a mid-headline `Watch:`.

### Main desk no longer reads markets
`markets` was on both `human` and `mrrshan_f`'s beats, so financial wire headlines like *Investors iShares Russell 2000 exchange* were read by the main desk. Removed `markets` from both entries. Market stories now hold in `heldByCategory.markets` until the show-block scheduler seats the trade desk, resource desk or industry desk.

### Text box appeared 1–2 seconds before the voice
`text-engine.js` applied the incoming caption immediately, but the audio element does not start until the clip has been fetched and decoded — a fraction of a second for a warm clip, one to two seconds for a cold one. During that gap the box showed with the new label and no text. Added a `pending` deferred swap: the previous caption stays up until `waitingForAudio()` clears, then the new one applies in the same frame the voice does. Also fixed the ident and any other `present()` call.

### Two-way follow-up repeated the intro
`hostAsk()` always prepended the naming line, so the extended two-way said *"We can go to Grolm now. What is the picture?"* then *"We can go to Grolm now. Is that consistent?"* Split the ask pools into `INTRO` (naming), `ASK` (question only) and `ASK_FOLLOWUP` (no name, no intro). `hostAsk` gained a `withIntro` flag; the follow-up uses `false`.

### Station open read backward
`showOpen()` appended the anchor's name to the end of the station line, producing *"This is G N N. Across the sector tonight, the following. I am Commander Hale."* `SHOW_OPEN` reordered to lead with "This is G N N"; `showOpen()` now prepends the anchor. Reads: *"I am Commander Hale. This is G N N. Let's get to the news from across the sector tonight."*

### Two-anchor beats are structured conversations
`banterBeat()` added to `script-writer.js` — opener, reaction, optional follow, close, drawn from each anchor's own banks. `exchange()` extended to use `follow` and `close` from the relationship table when they exist. `twoWay()` now rolls one of three shapes — brief (2), standard (3), extended (5) — up front, so a beat holds its form rather than drifting.

### Director uses the new script-writer material
`queueTaggedLines()` helper in `broadcast-director.js` queues a whole tagged beat in one call. `beginExchange` rewritten to take whatever `exchange()` returns — two lines or four. `beginTwoWay` queues whatever shape `twoWay()` returns and scales its drain ceiling to the beat length. `beginStructuredBeat` added for the bank-driven path.

### Per-line speaker attribution in the two-way
`beginTwoWay` now uses a `pitch` function and a `drivesDesk` function so the correspondent sits lower in pitch and does not animate the desk's mouth. This was the last piece of the "wrong mouth animates" cluster from the previous session.

### Verdict on STATUS plate idling
`icon-manager.js` no longer falls back to the STATUS plate. Unrelated to this session's changes but worth noting: it landed just before the push.

---

## Tooling

### `tools/scene_review.html`
Standalone page at `http://localhost:8080/tools/scene_review.html`. Loads `scene-compositor.js` and renders each of the nine recipes either as a short `.webm` clip or as a 4×2 contact sheet. Downloads land in the browser's Downloads folder. Two buttons, one per output mode.

### `docs/scene-review/README.md`
Review folder notes. Lists the three fault classes (composite fault, extractor fault, missing background), what each recipe is meant to be, and a verdict table to fill in as each recipe is watched. Salvage notes recorded for the `SPECIFICATION` card (phantom square layer) and the `Alkari research labs` scene (missing background). Owner has run a first review pass; verdicts are not yet filled in.

---

## Documentation

### `CLAUDE.md`
§1 gained eight rows (anchor variants, five studio sets, cutaways, backdrops, show logos, story icons, prompt library, speaker attribution). §3 gained entries for the banter repetition, the doubled break, the wrong sign-off, text ahead of voice, the two-way cluster, the two-way race, the ident-once race, the STATUS plate, the caption position, the commercial font, and the boot-on-paste. §4 gained two rows. §5 gained one row. §7 gained six bullets.

### `docs/ROADMAP.md`
Rewritten. Target section now says real news is primary and MOO lore is easter-egg only. Done-when items 5 and 6 flipped (real stock crawl, real stories read as real news). Landed table expanded. New "Asset pipeline — current state" section. Order of work reshuffled: item 6 is a new real stock crawl, item 7 is the lore separation, item 8 is ticker segmentation. The old translation table is gone.

### `README.md`
Updated to match. Generated asset library section added. Controls section replaced with "The channel as a channel" since the transport bar is gone. Quickstart leads with `./broadcast.sh` rather than `./start.sh`.

### `Gemini.md`
New session document. Currently holds Bug 1 (first-minute load-order issues) and a summary of what was fixed this session. Two bugs were closed in the same document as they landed (the robot, the cutaways). Change requests logged for the two-way script work and the beat filter, both now landed.

### GitHub About
Updated from "the Master of Orion 1 (1993) robot anchor" to "a live 24/7 newscast simulation and re-imagining of the news broadcast cutscenes from Master of Orion 1."

---

## Open at time of writing

### Bug — first minute after a fresh boot
Several related failures appear in the first ~60 seconds after a page load and then self-correct: the anchors step on each other on the first story; Varr's mouth does not move on her first line; sometimes neither, sometimes something else. Which symptom fires varies between runs. Music does not play at boot and often does not play at all. Suspected to be a load-order race; a boot screen using one of the title cards with a music bed is the owner's proposed direction, but the load-order cause has not been established.

### Music bed not playing
Diagnosed but not fixed. The files are provably fine (Ogg Vorbis, plays in mpv via `/usr/bin/mpv` — the shell `mpv` alias points at an uninstalled flatpak). Diagnostics added to `playMusic()`: a log at entry, warnings on the three failure paths (no manifest entry, fetch non-200, decode failure), and a log on success. Not yet run with those diagnostics on to see which path fires.

### MOO1 composite review
In progress. A first review pass has been generated; the verdict table in `docs/scene-review/README.md` is not yet filled in. Three known fault classes documented. Extractor fixes (delta frame stacking, chromatic scrambling) are out of scope for this pass and named as separate work.

### Show rundown open
Drafted as a change request only, not built. The cold open should name the stories on the queue before reading them. Needs headline extraction from the queue, a shortener, and a reordered cold-open sequence. Not started.

### Real stock crawl
Roadmap item 6. Not started. Replaces the MOO commodity ticker with live market data. Source not yet chosen; Yahoo Finance, Stooq, Alpha Vantage and Financial Modeling Prep all candidates.

### Ticker still shows MOO commodities
The README and roadmap describe the target state (real market data); the code still generates `NEUTRONIUM FOIL`, `SOLAR WIND: SEVERE` and the rest. This mismatch resolves when the stock crawl lands.

---

## Things that looked like bugs and weren't

- **The mpv failure was a shell alias.** `mpv` resolves to a flatpak wrapper for an uninstalled app. `/usr/bin/mpv` plays the files fine.
- **The titlecard `Untitled.png` in the last commit** is a stray file from the generation session; it is not referenced by code and can be deleted.
- **`bash tools/key_robot.py` failure was operator error**, not a fault in the tool.
