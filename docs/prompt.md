```markdown
# Engineering Task: GNN Multi-Anchor Desk — PNN-Style Show Blocks in the Master of Orion Universe

**Repo:** `/home/ekco/github/GNN/`
**Reference imagery:** `/home/ekco/github/GNN/docs/` — **mockups only, see §0.1**
**Complete source game:** Master of Orion 1 assets are in the project folder (originally extracted into `assets/cutscenes/`, but the extraction pipeline is broken — see §4)
**Primary deliverable:** a continuous, self-scheduling GNN "channel" with a rotating cast of Master of Orion characters on a shared news desk, plus a **rebuilt asset pipeline** that fixes the current corruption and can emit text-to-image prompts for regenerating assets at MOO1 visual quality.

---

## 0. The Vision

### 0.1 Mockup Disclaimer — Read Carefully

**The four PNGs in `/home/ekco/github/GNN/docs/` are visual mockups, not source assets.**

They communicate *composition and mood* — they are the designer's sketch of the target look. Do **not** crop, slice, palette-match, or otherwise ingest them into the build. If a specific element happens to be salvageable as a placeholder (e.g. a chyron shape, a UI frame, a backdrop silhouette), reuse is a *bonus* — not a requirement. The real production assets must come from one of two sources:

1. **Cleanly re-extracted Master of Orion 1 game assets** (see §4 for why the current extraction is broken).
2. **Newly generated assets** produced from the text-to-image prompt bridge you will build in §5.

### 0.2 The Target Look

GNN today is a **single robot anchor** reading a flat RSS loop, with a human commander framed beside him as set dressing. `docs/` image #1 shows this current state (PSYCHEDELICS story, robot + commander, "LIVE // 2142 UTC").

**The target is `docs/` image #2**: a **three-alien anchor desk** — Bulrathi (military/sports), Psilon (tech/science), and Mrrshan (culture/diplomacy) — sharing the desk during a named program block ("SECTOR 4 UPDATE"), with a PIP cutaway to a relevant in-universe scene ("GALACTIC COUNCIL TREATY DEBATE"), MOO-flavored chyrons, and a resource-crawl ticker across the bottom.

The structural model we are copying is **pnn.watch**: a 24/7 simulated broadcast scheduled into recurring named shows, each with its own host, beat, and visual identity. The *content* stays entirely inside 1993 *Master of Orion* lore — no real-world brands, no crypto, no modern social media.

**Reference images in `docs/` (composition guidance only, not ingest):**
- **Image #1** — *Current GNN layout.* The "before." Robot anchor + single human co-host, plain text chyron, generic ticker.
- **Image #2** — *Target multi-anchor desk.* The "after." Three species at one desk, sector-tagged chyron, PIP cutaway, resource ticker. **Match this composition.**
- **Image #3** — *Scene catalog concept.* Twelve B-roll subjects (Starship Battle, Space Vortex, Planet Invasion, Hacker Code, Council Vote, Asteroid Mining, Virus Outbreak, Station Trade, Solar Flare, Black Hole, Spy Infiltration, Council Summit). Use as a **mapping guide** for which cutaway plays under which story category — but the actual imagery must come from clean MOO1 assets or newly generated assets, not from these mockup thumbnails.
- **Image #4** — *Exterior window / backdrop concept.* Four backdrop moods (GNN Earth globe, asteroid mining field, colony domes, Orion shipyard). Same rule: guidance only. Backdrops must come from clean re-extraction or regeneration.

---

## 1. Success Criteria (What "Done" Looks Like)

A reviewer opening the app should be able to:

1. **Join at any time of day and see a named program** — e.g. *Morning Index*, *Prime Time News Desk*, *Interstellar Sports Briefs*, *Diplomatic Hour*, *Late Night Anomaly Log*. Program name and its anchor(s) are visible on-screen.
2. **See at least three different MOO anchors across the rotation**, not just the robot. Minimum: the Lead (robot/human commander), a **Psilon** tech analyst, a **Bulrathi** military/sports brute, and a **Mrrshan** culture/diplomacy host. Each has its own portrait, voice, and beat.
3. **Watch a clean handoff between two programs** — outgoing anchor signs off, station ident plays, incoming anchor introduces themselves, first story begins. No jump cuts, no audio bleed between the two.
4. **See PIP cutaways that match the story** — a fleet story cuts to a starship battle scene, a treaty story to a council vote, a hack story to hacker code, etc. Mapping follows `docs/` image #3, artwork comes from the rebuilt pipeline (§4).
5. **See a resource ticker that reads like MOO**, not CNBC — `ENERGY CREDITS`, `MINERALS`, `RESEARCH POINTS`, `ORION ARTIFACTS`, `SOLAR WIND INDEX`, `COLONY SHIP: LAUNCH READY`.
6. **Read RSS-derived stories that have been translated into in-universe events** — with no leakage of real-world brand names, tickers, politicians, or handles.
7. **See no corrupted sprites.** Every rendered portrait, cutaway, and backdrop is clean — no magenta transparency artifacts, no rainbow palettes, no garbled pixel blocks (see §4 for the current failure mode).

And critically:

8. **Audio is clean at boot and during anchor switches.** No pops, no crackles, no compressor pumping. See §3 (P0 blocker) — this must be fixed first.

---

## 2. What to Adopt From PNN vs. What to Reject

### ✅ Adopt
- **Timed show blocks** on a schedule (not a flat loop).
- **Specialized anchor/correspondent beats** assigned per story category.
- **Desk handoffs, mini-segments, market indices, commercial bumpers** as recurring interstitial structure.

### ❌ Reject (hard exclusions)
- No Web3 / crypto / NFT / Bitcoin segments.
- No real-world music streaming or digital-art shows.
- No modern corporate branding, real-world social handles, or named politicians.

All copy must stay inside MOO 4X lore.

---

## 3. ⚠️ P0 Blocker — Fix Before Anything Else

The server log `gnn-server_2.log` shows that on **every page load**, the client fires a live `/api/tts` synthesis request for the welcome headline **once per voice in the catalog**, all with `seq=0`:

```
GET /api/tts?text=Michael.&voice=am_michael&seq=0                         200
GET /api/tts?text=Good+evening.+This+is+the+Galactic...&voice=am_michael&seq=0  200
GET /api/tts?text=Fenrir.&voice=am_michael&seq=0                          200
GET /api/tts?text=Good+evening.+This+is+the+Galactic...&voice=am_fenrir&seq=0   200
GET /api/tts?text=Onyx.&voice=am_michael&seq=0                            200
... (repeats for every voice)
```

### Why this matters
- **It contradicts the previous handoff.** `claude_handoff.md` claims audio is fixed. The log proves a *different* bug is live: something in the client boot path iterates the voice list and synthesizes each one back-to-back.
- **It's the actual cause of boot-time pops/crackles.** Dozens of concurrent neural renders starve the CPU; their audio blobs return near-simultaneously and race the client `<audio>` element. Every downstream audio measurement is contaminated until this is fixed.
- **`seq=0` on all requests** means these calls bypass the per-session sequence guard added to fix AUD-08. They are not participating in the normal TTS pipeline.

### Your job
1. Trace the boot sequence in `js/main.js` for anything that calls `speak()` or fetches `/api/tts` in a loop over `VOICES` / the voice catalog.
2. Identify the caller — likely a leftover voice-audition routine or preload/warm-up pass wired into the live path instead of a dev-only harness.
3. Move any audition/preload behavior behind an explicit dev flag.
4. **Invariant: production boot synthesizes at most one TTS line.** Reload the page and read the server log — exactly one `/api/tts` request before user interaction.

---

## 4. ⚠️ Asset Pipeline Rebuild (Critical)

### 4.1 What's Wrong Today

The current GNN grabs assets from the extracted `assets/cutscenes/` tree, which was produced by an earlier LBX extraction pass. That pass is producing visibly broken output. Common failure modes (visible in the screenshot the project owner provided):

- **Magenta / purple transparency artifacts** — the transparent index (palette index 0) is not being mapped to a proper alpha or to the intended backdrop color, so "empty" pixels render as fuchsia.
- **Rainbow / corrupted palettes** — different LBX archives use different VGA palette tables (INTRO uses palette 1, WINLOSE uses palette 8, COUNCIL/EMBASSY use palette 7, etc.). Applying the wrong table produces posterized noise.
- **Garbled pixel blocks / half-converted sprites** — partial frames, mismatched dimensions, sprite sheets treated as single images.
- **UI overlays baked into cutscenes** — mission tables ("Identify this class of ship"), diplomatic status matrices, and other in-game UI screens appearing inside what should be pure B-roll.
- **Inconsistent dimensions** — a mix of 32×24 tactical icons and 320×200 cinematic frames in the same category, causing either stretching or letterboxing when rendered into a fixed PIP window.

### 4.2 Your Job

**Rebuild the extraction pipeline from the raw Master of Orion 1 assets in the project folder.** The complete game is present — you are not limited to what's already been extracted.

Requirements:
1. **Per-archive palette selection.** Each LBX archive must be decoded with its correct VGA palette table. Document the mapping in the pipeline source.
2. **Proper transparency handling.** Transparent pixels must render as either (a) fully transparent, or (b) the intended dark newsroom backdrop — never as magenta.
3. **Frame integrity.** Every animated sequence must be extracted as a coherent frame set with matched dimensions. No partial frames, no sprite-sheet-as-image mistakes.
4. **No UI screens in B-roll pools.** In-game UI overlays (mission tables, tech trees, diplomatic matrices, "HIDE" mission status displays) must be *excluded* from the B-roll catalog. They may be reused later as diegetic "computer screen" dressing if desired, but not as cutaways.
5. **Size validation.** Every asset admitted to a B-roll or portrait pool must pass a minimum-dimension check (≥120×80 for cutaways, ≥100×100 for portraits) so tiny tactical icons are never stretched into a PIP window.
6. **Metadata sidecar.** Each extracted asset gets a small JSON sidecar recording: source archive, source palette index, frame count, native dimensions, whether it's an animated loop, and an appropriate category tag.

### 4.3 Verification

Before declaring the pipeline rebuilt, produce a **contact sheet** (a single PNG grid) of at least 50 random assets across all categories and inspect it by eye. Zero magenta, zero rainbow palettes, zero stretched tactical icons. This is the acceptance test.

---

## 5. Text-to-Image Prompt Bridge (New Deliverable)

Even with a clean extraction pipeline, MOO1's original art does not cover every scene the new show format needs (three-up desk composition, per-species anchor portraits in broadcast framing, modern PIP cutaway subjects, exterior window backdrops across a full day/night cycle). For those gaps, build a **prompt bridge**:

### 5.1 What to Build

A tool — script, CLI command, or dev-only route in the app — that writes a Markdown file (e.g. `assets/generated/prompts.md`) containing **ready-to-paste text-to-image prompts** for every missing asset in the current catalog. The user will feed these prompts into an image-capable LLM (Gemini, GPT-4o image, Flux, etc.) and drop the resulting PNGs back into `assets/generated/`.

### 5.2 Prompt Requirements

Each prompt must:
- **Lock the style** to "1993 VGA pixel art, 320×200, 256-color DOS-era palette, Master of Orion 1 aesthetic, slight CRT scanline character, painterly pixel dithering."
- **Specify the subject precisely** — e.g. "a three-quarter view of a Bulrathi (large brown-furred bear-like alien) seated at a news desk, wearing a GNN-badged military uniform, mid-speech gesture, facing the viewer slightly off-axis."
- **Specify the framing** — portrait, PIP cutaway, wide backdrop, chyron plate, etc.
- **Specify the palette family** consistent with the show block (military = cold steel blues; diplomatic = warm ambers; science = cyan/magenta; anomaly = deep violet).
- **Specify the background treatment** — transparent, newsroom matte, starfield, etc.
- **Include a negative prompt** — "no modern logos, no real-world brand names, no realistic human faces, no anti-aliasing, no gradients beyond 1993 VGA dithering, no text (text will be added by the engine)."

### 5.3 Prompt File Structure

Group prompts by category so the user can batch-process them:

```markdown
## Anchor Portraits — Bulrathi
### bulrathi_commander_desk_hero.png
[prompt here]

### bulrathi_commander_speaking.png
[prompt here]

## PIP Cutaways — Starship Battle
### starship_battle_wide_01.png
[prompt here]

## Exterior Backdrops — Day Cycle
### backdrop_earth_globe_dawn.png
[prompt here]
```

### 5.4 Acceptance

Running the bridge tool once must produce a complete, self-contained `prompts.md` that:
- Covers every asset the current scene catalog references but cannot source from MOO1.
- Is organized so a user can work through it top-to-bottom without needing to edit a single prompt by hand.
- Specifies the exact output filename next to each prompt so the user knows where to save the result.

---

## 6. What Already Exists (Don't Rebuild)

**Verify by running before assuming anything is missing.** The codebase is further along than the earlier planning docs suggest.

| System | Status | Where |
|---|---|---|
| 7-layer canvas compositor | Working | `js/renderer.js` `renderFrame()` |
| Audio bus topology (`sfxBus`/`musicBus`/`voiceBus` → `stationBus` → compressor → limiter) | Working | `js/audio-engine.js` |
| Per-session TTS nonce + server-side sequence guard | Working (post-`claude_handoff`) | `js/tts.js`, `server.py` |
| RSS ingestion, entity tagging, half-life decay scoring, topic interleaving | Working | `js/feed-manager.js`, `js/broadcast-director.js` |
| PIP cutaways, ambassador portraits, station bumpers, klaxon, red-alert border | Working (art quality is the problem, not wiring) | `js/cutscene-manager.js`, `js/renderer.js` |
| Sentence-boundary truncation for read copy | Working | `feed-manager.js` `truncateSentenceCleanly()`, `tts.js` `trimForSynthesis()` |
| Seamless ticker | Working | `js/ticker-manager.js` |
| Alien ambassador portrait hooks (10 species) | Wired, but current extracted art is corrupted | `assets/cutscenes/EMBASSY/` |

**What does not yet exist** (this is your build):
- Time-aware show-block scheduler.
- Multi-anchor roster with per-character voice/portrait/beat profiles.
- Atomic anchor switching in `animator.js` / `renderer.js`.
- RSS → MOO-lore translation layer.
- MOO-themed resource ticker (currently generic).
- **Clean asset extraction pipeline (§4).**
- **Text-to-image prompt bridge (§5).**

The five `.md` files in the repo root are useful historical context — but treat them as **reference, not truth**. Multiple past reports claim fixes that hadn't landed. **Verify behaviour, not presence.**

---

## 7. Implementation Notes

### 7.1 Schedule & Show-Block State Machine
Extend `js/broadcast-director.js` with a timeline manager. Day's rotation:

```
Morning Index  →  Main News Desk  →  Sports / Fleet Briefs
             →  Diplomatic Hour  →  Late Night Anomaly Log  →  (loop)
```

Each block declares: `name`, `activeAnchor`, `correspondentPool`, `targetCategories`, `segmentLength`, `bumperSet`, `handoffIntro`, `handoffSignoff`. The scheduler must be **time-aware** — a viewer at 08:00 local sees *Morning Index*, not a random block. Use local clock, fall back to UTC.

### 7.2 Character Registry
Introduce a `CharacterProfile` registry (`js/characters.js`):

```js
{
  id: 'bulrathi_commander',
  displayName: 'Commander Grath',
  species: 'Bulrathi',
  beat: 'military_sports',
  portraitAsset: 'assets/generated/anchors/bulrathi_commander_desk_hero.png',
  voiceId: 'am_adam',
  speechRate: '+5%',
  pitch: '-2Hz',
  greeting: 'Strength to the fleet.',
  signoff: 'Grath, standing down.',
}
```

Roster: Lead (robot/human commander) + Psilon + Bulrathi + Mrrshan at minimum; Meklar, Sakkra, Alkari, Darlok as dynamic field correspondents.

### 7.3 Anchor Switching
Extend `js/animator.js` and `js/renderer.js` so a swap is **atomic**:
1. Outgoing anchor's final line finishes speaking.
2. Station ident plays.
3. Incoming anchor's portrait preloads fully.
4. Incoming anchor's first line begins.

No half-swapped states, no audio bleed. For the three-up desk composition, place up to three portraits side-by-side at the desk with the active speaker subtly highlighted (dimmed vs. lit, or soft glow).

### 7.4 RSS → MOO-Lore Translation
Add a formatting layer in front of `feed-manager.js`. Examples:
- Earth tech-stock news → *Galactic cybernetics index update*
- Space-agency launches → *Orion colony transport log*
- Diplomatic summit → *Mrrshan–Psilon trade accord*
- Cybersecurity breach → *Darlok infiltration of Meklar relay*
- Climate / environment → *Terraforming update, Sol colony*

Constraints:
- **Preserve the underlying factual claim.** Do not fabricate events.
- **Never emit** real-world brand names, tickers, politicians, or social handles.
- **Tag** each story with `category`, `suggestedAnchorId`, `mooLocation`, `pipSceneId`.

### 7.5 PIP Scene Mapping
Follow the twelve-subject catalog in `docs/` image #3 as the mapping guide:
- Starship Battle → fleet / war / invasion
- Council Vote / Council Summit → diplomacy / treaty / politics
- Hacker Code / Spy Infiltration → cyber / espionage / leaks
- Space Vortex / Black Hole → physics / astronomy / anomalies
- Asteroid Mining / Station Trade → economy / industry
- Solar Flare / Virus Outbreak → disaster / emergency

The **artwork** for these comes from the rebuilt pipeline (§4) or the prompt bridge (§5) — not from the mockup thumbnails.

### 7.6 Ticker Overhaul
Keep the ticker inside the CRT bounds (`barY` inside `view.y + view.h`). Replace generic content with a MOO resource crawl:

```
ENERGY CREDITS: +2.4%  |  MINERALS: 142.55 ▲  |  RESEARCH POINTS: +0.8%
ORION ARTIFACTS: 8,450 ▼  |  SOLAR WIND INDEX: SEVERE  |  COLONY SHIP: LAUNCH READY
```

Rates drift slowly — a few tenths of a percent per second at most. No per-frame jitter.

### 7.7 Exterior Window Backdrop
Rotate backdrops across show blocks so the set feels alive. Each block picks a mood fitting its beat (Fleet Briefs → shipyard / colony domes; Anomaly Log → black hole / nebula). Source from §4 or §5.

### 7.8 Audio Continuity Across Switches
Any character swap must respect the existing audio contract:
- Duck music and SFX under the new anchor's first line; release on its `onended`.
- Do **not** bypass the mixer graph (see `Sonnet5Report.md` AUD-05).
- Do **not** re-trigger `duckMusic(1, ...)` between back-to-back lines — use the silent-stop path flagged in AUD-10.

---

## 8. Architecture Constraints — Do Not Break

These are load-bearing. Violating any regresses systems that currently work.

1. **Canvas compositing order** in `js/renderer.js` `renderFrame()` must be preserved: `background → viewport → post-process blit → alert border → ghost → Orion badge → text`.
2. **All production assets stay in `assets/`.** New generated assets go in `assets/generated/` with the same discipline.
3. **Ticker bar stays inside CRT screen bounds** (`barY` inside `view.y + view.h`).
4. **Server runs via `python3 server.py` on port 8080.**
5. **Never `substring(0, N)` / `slice(0, N)`** on read copy without sentence-boundary detection. Two existing violations were fixed (`feed-manager.js` `truncateSentenceCleanly()`, `tts.js` `trimForSynthesis()`); do not add a third.
6. **Google Fonts loading** in `js/main.js` stays in a non-blocking `try/catch`.
7. **`musicBaseGain` must be set inside `playMusic()`** before any `duckMusic()` call. Ducking is a *multiplier* on the mixed level, never an absolute gain.
8. **Every gain change on a live signal path goes through the `ramp()` helper** (`audio-engine.js:110`). An instantaneous `setValueAtTime` on an audible node is a step discontinuity — which is exactly what a pop is.
9. **Voice is the 0 dB anchor.** Effects and music are mixed and ducked *under* it. Do not restore master-level compression as the mix's primary level control.
10. **No asset in any pool without a size-validation pass and a palette-correctness pass.** (§4 acceptance test.)

---

## 9. Voice Quality — Note, Don't Chase

Current TTS is **Kokoro-82M** (in-process) with **edge-tts** as fallback. PNN uses ElevenLabs and sounds more expressive because of multi-modal training on breath pauses and cadence. Kokoro/edge-tts are flatter but free and local.

**Recommendation: do not swap TTS engines during this refactor.** First fix the P0 boot bug and confirm a clean audio baseline. Then, if voice work is desired, treat it as a separate isolated task with benchmarked before/after recordings per candidate voice.

Free upgrade paths to evaluate later:
- **F5-TTS / ChatTTS** — open-source zero-shot, better conversational rhythm.
- **Coqui XTTS** — local, supports voice cloning. Good candidate for giving each MOO species a distinct timbre.
- **Fine-tune Kokoro** — audit existing voice packs first with `python3 tools/voice_audition.py`. The cleanest profile may already be in the box.

---

## 10. Process

1. **Verify the current state.** Run `./start.sh --bg`, then `python3 tools/drive.py 70 /tmp/gnn-run`. Read the server log. Confirm what actually works before trusting any doc.
2. **Fix the P0 boot bug (§3).** Reload the page. Confirm exactly one `/api/tts` request. Nothing downstream is measurable until this is clean.
3. **Rebuild the asset pipeline (§4).** Produce a contact sheet. Inspect it. No magenta, no rainbow palettes, no stretched icons. This gates every downstream art task.
4. **Build the prompt bridge (§5).** Emit `assets/generated/prompts.md` covering every gap the extraction pipeline can't fill.
5. **Build the feature layers**, in this order — each independently testable:
   - Schedule state machine → character registry → animator/renderer swap → RSS translation → PIP mapping → ticker → exterior backdrop → audio continuity polish.
6. **Test at layer boundaries.** After each layer, run `tools/audio_probe.py` (3 runs minimum — its pop count swings 97→354 on unmodified code) and read `peak` / `worst jump`, which are more stable than pop count.
7. **Write `claude_handoff_2.md`.** Record: what was built, what was verified (with commands), what was deferred, any new constraints. Follow the "verify behaviour, not presence" discipline.

---

## 11. Open Items Carried Forward (Do Not Re-Derive)

- **Perceptual check by ear.** Metrics may say the mix is clean; listen before declaring audio done.
- **Voice choice is subjective.** `python3 tools/voice_audition.py` renders all voices reading identical copy; peaks vary by ~3.6 dB. Reorder `VOICES` in `js/tts.js` if the default isn't the best fit.
- **`RENDER_FPS` is 20, not 10** (`js/main.js:13`). `GNN_Report.md:40,43` says 10 — documentation error only.
- **rss2json HTTP 429s** during back-to-back harness runs. External, pre-existing.
- **Decoded SFX buffers are never evicted.** Bounded by the 41-file library — a known tradeoff, not a leak.

---

## 12. Appendix — Historical Docs in Repo Root

For deep background only. **Treat all claims as unverified until you've observed the behavior.**

| File | Covers |
|---|---|
| `GNN_Code_Audit_Review.md` | PIP cutaway timing fix, ambassador alignment, klaxon, substring keyword false-positives, 9 B-roll scene categories, expanded bumper pool. |
| `GNN_Report.md` | LBX asset extraction with per-item VGA palettes, TTS integration, canvas occlusion fixes, RSS sanitization, ticker, commercial pacing, 7-layer render stack. |
| `GNN_Project_Plan.md` | Original spec: B-roll cutaways, broadcast pacing, commodity ticker, glitch easter eggs, breaking-news injection. |
| `Sonnet5Report.md` | 19-bug audio + code health audit. Key items: `duckMusic()` un-ducking to unity; `glitchCrush()` missing anchor; no envelopes on one-shot SFX; stacked typing blips; first-line TTS bypassing mixer. |
| `claude_handoff.md` | Most recent status. Confirms AUD-08 needed a second pass (per-session, not global, guard). Documents gain-staging root cause of steady-state pumping. Lists the 9 architecture constraints reproduced in §8. |
```

### Summary of what changed in this rewrite

| Change | Where |
|---|---|
| **Mockup disclaimer** — `docs/` PNGs are composition references only, salvage is a bonus not a requirement | §0.1 |
| **Renamed reference image descriptions** to match the new "guidance only" framing | §0.2 |
| **New P0-tier section: Asset Pipeline Rebuild (§4)** — describes the magenta/rainbow/garbled-pixel failure modes, requires per-archive palette mapping, transparency handling, UI exclusion, size validation, JSON sidecars, and a contact-sheet acceptance test | §4 |
| **New section: Text-to-Image Prompt Bridge (§5)** — a deliverable tool that emits `assets/generated/prompts.md` covering every gap the extraction pipeline can't fill, with strict style-locking and negative prompts | §5 |
| **Added asset pipeline + prompt bridge to "What does not yet exist"** | §6 |
| **Added constraint #10** (size + palette validation on every asset) | §8 |
| **Restructured process order** so P0 audio → asset pipeline rebuild → prompt bridge → feature layers, with the contact sheet as a hard gate | §10 |
