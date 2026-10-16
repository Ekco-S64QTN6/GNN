# What's left from the original review

**Everything substantive.** Every code item, documentation item, and count discrepancy from the initial review is closed.

Here's the full ledger, checked against the review I gave at the start of the conversation:

| # | Item from review | Status |
|---|---|---|
| 1 | Documentation drift — CLAUDE.md §7 stale, README count discrepancies | ✅ |
| 2 | `beginTwoWay` ignored `openTwoWay`'s return | ✅ |
| 3 | CLAUDE.md/README/ROADMAP count reconciliation | ✅ |
| 4 | `openDebate()` implemented, never called | ✅ Wired into `beginBanter` on `DEBATE_BLOCKS` |
| 5a | `renderer.js` dead desk path (`deskTop`, `DESK`, `drawDesk`, `CAST.seat`) | ✅ |
| 5b | `cutscene-manager.js` `wrapInto()` | ✅ |
| 5c | `scene-compositor.js` `schematics()` | ✅ (with a regression you're fixing this turn) |
| 5d | `text-engine.js` `PANEL` | ✅ |
| 5e | `server.py` `LOG_LINE_MAX` | ✅ |
| 6 | `feed-manager.js` regex escape | ✅ |
| 7 | `ticker-manager.js` partial-fetch stale colour | ✅ |
| 8 | `main.js` catch-block hang + double frame loop | ✅ |
| 9 | `playMusic()` per-call diagnostics | ✅ |
| 10 | `DR Congo` → "Doctor Congo" pronunciation | ✅ |
| 11 | Robot cleanup (four-artifact half-retirement) | ✅ |
| 12 | `CORRESPONDENT_READY` duplicate-set substitution | ✅ |

That's the entire list. Nothing left over.

## Minor leftovers, all documented as harmless

Three items survive the sweep, each recorded where it sits:

1. **`renderer.js` — `deskPlate` variable.** Declared, assigned in `init()`, never read after the sweep. A null that nothing looks at.
2. **`main.js` — `desk: null` in the return shape.** The renderer no longer reads this field. The line documents "the desk lives in the set" for a reader, but it's an interface that has no client.
3. **`renderer.js` — `renderFrame(now, frames, icon)`'s `frames` parameter.** Unused since the robot's 25-cel path retired. The doc comment explains it's kept so `main.js` doesn't change and a revived use has somewhere to land.

None of these can cause a fault. They're the sort of residue that gets trimmed when the surrounding code is next touched, not in a dedicated pass.

## Stale comments, not code

One comment is now behind the code:

- **`tools/condition_plates.py`** — the `do_anchors()` docstring still says *"`main.js` must be changed to load him that way"* about the robot. `main.js` already loads him that way. The note predates the change.

Cosmetic. Fix when the tool is next opened.

## CLAUDE.md is once again behind

You corrected it two turns back, then four more changes landed:

- `openDebate()` wiring (Phase 3 → §1 landed, §7 item removed)
- `CORRESPONDENT_READY` substitution (a new §3 entry could note the single-source-of-truth pattern)
- Dead-code sweep (§7 items removed)
- Robot cleanup (§1 robot row and §5 `key_robot.py` retirement)

None of these are corrections — the doc was right when written — but the doc no longer reflects current state. Worth a short pass before the next session picks it up, following its own §0 rule about verifying what the code actually does.

## The items CLAUDE.md §7 listed as "external or architectural"

These were never code fixes to begin with, and they're still open by nature:

- **rss2json daily cap** — external constraint; an API key would lift it
- **Two scrambled COLONIES items** — needs the LBXGFX spec to decode correctly
- **Title-card prompt problem** — the image model lands on a commercial style prior; the fallback route is per-character `_standing.png` composited over a set plate
- **MediaPipe will not rig this cast** — 3 of 11 detect; hand-placed points required
- **MOO lore vs real news still mixed** — `PACE.wireShare` interleaves sector bulletins; the owner wants them fully separate and this is not done
- **`capture_docs.py` hangs on back-to-back runs** — tooling issue

None of those is a change I can produce from the source alone. They need either a decision from you, a pipeline run, or a spec that isn't in the repo.

## Bottom line

The original review is fully closed. The only thing between you and a clean tree right now is the `scene-compositor.js` regression in this turn's batch — once that lands, run the station once and it should be on air with every fix from the last five turns active.




Var said "DR Congo" as Doctor Congo, the DR before Congo stands for Democratic Republic

Yes — I read all nine `.md`/`.js`/`.py` files and the `.sh`/`.css`/`.html`. The DR fix was the easy one; here's what else is actually wrong.

## 1. Documentation has drifted from the code

CLAUDE.md §7 is the offender — it lists five items as *open* that are visibly fixed in the code you gave me.

| CLAUDE.md §7 "open item" | Reality in the provided code |
|---|---|
| **Grolm black backdrop.** "`'interview'` absent from `GENERATED`." | Present. `cutscene-manager.js:GENERATED.interview = ['council_summit', 'station_trade', 'station_trade_02', 'council_vote', 'council_vote_02']`. `correspondentScene()` has the fallback chain (`generatedScene(kind)` → `generatedScene('interview')`). Fixed. |
| **`convoy` mispronunciation.** | `tts.js:PRONOUNCE` contains `KAHN-voy` / `KAHN-voys` with the alien species and star systems right below. Fixed. |
| **Show rundown open not built.** | `GNNScript.rundownOpen()` exists in `script-writer.js`; `beginColdOpen()` calls it. ROADMAP §Phase 2 agrees. Fixed. |
| **First minute after boot broken.** "A dedicated boot holding screen ... is the proposed architectural defense." | `main.js:runBootSequence()` *is* that defense — boot track holds the director via `window.GNNBootReady`. The gnn-server.log confirms `boot track duration=22.41s fade in 19.41s ident at 17.00s`. Fixed. |
| **Music bed does not play at boot.** | `playBootTrack('track_09', { gain: 0.7 })` fires at 09:28:27 and the log shows `[GNN Audio] boot track started track_09 duration 22.41s`. Fixed. |

Net: §7 is a stale to-do list for items that landed. Worth pruning before the next session re-chases them.

The other contradiction: **CLAUDE.md §7 says `condition_plates.py` has no path for `logos/`, `titlecards/` or `icons/`**, but **ROADMAP.md §Phase 1 says "Ingestion pipeline expanded to condition `titlecards/`, `logos/`, and `icons/`."** One of those is wrong; I can't tell which without the tool, and `condition_plates.py` wasn't provided.

## 2. Count discrepancies

Three numbers, three sources, no agreement.

| What | README badge | CLAUDE.md §1 | Actual (from code / boot log) |
|---|---|---|---|
| Cast size | "12 characters · 11 generated" | "12 profiles" | **14 entries** in `cast.js:CAST`; 13 in `main.js:ROSTER` after excluding robot; boot log: `anchors=13` |
| Voice list | (n/a) | "9 shortlisted ... plus `vox_unit`" | **12 entries** in `server.py:LOCAL_VOICES` (11 + `vox_unit`) |
| Asset library | "873 items · 4316 frames" | "873 items / 4,316 frames" | boot log: `713 items, 3984 frames` |

The asset-count gap (160 items / 332 frames) is the big one. Either the docs are aspirational and the manifest is behind, or the docs count something (inbox, source archives) that the manifest does not. It needs resolving because `verify_assets.py` and CLAUDE.md §1 both quote the 873 figure.

## 3. Real bug: `beginTwoWay` does not check `openTwoWay`'s return

`broadcast-director.js`:

```javascript
function beginTwoWay(now, opts = {}) {
    const tw = GNNScript.twoWay(opts);
    if (!tw) return false;
    const total = queueTaggedLines(tw.lines, { ... });
    GNNCutsceneManager.openTwoWay(...);   // fire-and-forget
    ...
    return true;
}
```

`openTwoWay` is `async` and returns `false` when `correspondentScene()` comes back null — which happens when the plate file is missing on disk. The director queues the anchor's and correspondent's lines *before* the visual resolves, then returns `true` unconditionally, so `correspondentUsed = true` is set in `beginBanter`.

Result: a two-way plays its audio with no monitor visual, no correspondent's mouth animating, and no way for the show to try again — exactly the symptom `CORRESPONDENT_READY` was introduced to prevent. The set in `script-writer.js` matches the disk *now*, but nothing enforces it: re-run the conditioning pipeline and drop one species's plate, and the fault returns silently.

Fix: `beginTwoWay` needs to be async and either await `openTwoWay` before queueing, or check a synchronous readiness predicate (`correspondentScene()` cached) before deciding.

## 4. Built, documented as landed, never wired

- **`GNNCutsceneManager.openDebate()`** — ROADMAP §Phase 3 claims "Split-Screen Debate Mode — Implemented `openDebate()` and dual-PIP monitor layout". It's implemented. Nothing in `broadcast-director.js` calls it. The `panel` shape of `twoWay()` uses `openTwoWay` (single PIP), so *Council Crossfire* produces a normal single-monitor interview with extra back-and-forth, not a split-screen debate. Either wire it up or move it to the "landed subsystems" table as an unused primitive, not a shipped feature.

## 5. Dead code

- `renderer.js`: `deskTop()`, `DESK`, `drawDesk()`, and `CAST.seat` are all reachable only when `deskPlate` is truthy. `main.js` passes `desk: null` ("the desk is in the set now"), so none of it runs. `const seatY = deskPlate ? CAST.seat : currentDeskLine;` always resolves to `currentDeskLine`. Either delete or add the comment explaining what future change reactivates it.
- `cutscene-manager.js`: `wrapInto()` — defined, never called.
- `scene-compositor.js`: `schematics()` — exported, no internal caller; `industry()` and `tactical()` do their own inline `find({dirs:['TECHNO'], …})` queries.
- `text-engine.js`: `PANEL` is documented as "kept for reference only" — either remove or leave, but the comment is at least honest.

## 6. Minor issues worth noting

- **`audio-engine.js:playMusic()` has three `console.log`/`console.warn` diagnostics that the code's own comment says to remove once confirmed working.** The gnn-server.log confirms music plays — 09:28:27, 09:31:48, 09:32:31. They're noise now, and they're also capturing `opts` objects through the logger's `JSON.stringify`, which on a bad day could throw.
- **`main.js:init()` failure path leaves the station in `S.BOOT` forever.** The catch block starts the feed and the render loop but never sets `window.GNNBootReady`, so `broadcast-director.js`'s `case S.BOOT:` gates on it and never advances. This is the "black screen, one broken link" failure the doc already warns about — but it's not defended against. Setting `window.GNNBootReady = true` in the catch, or having the director time out on BOOT, would make a partial failure degrade to "silent newsroom" instead of "black canvas".
- **`feed-manager.js:calculateImportance()` regex literal.** The line as it reached me is `/[.*+?^${}()|[\\]\\\\]/g`, which parses unambiguously only if you assume a copy artifact — the standard escape regex is `/[.*+?^${}()|[\]\\]/g`. Worth confirming against the actual file; if the doubling is real, escaping is a no-op on some phrases and doubles backslashes on others. `importance` only drives sort order, so a bug here would be silent.
- **`server.py` `LOG_LINE_MAX = 250000`** — declared, never read.
- **`ticker-manager.js:refreshMarketData()` labels a partial fetch "PARTIAL N/M" but does not mark the remaining symbols stale.** A quote cached from an earlier successful call and absent from the current response stays on air at full green/red, not amber. Cosmetic, but the module's own comment ("labels them as delayed") overstates it.

## 7. What I cannot verify

`tools/condition_plates.py`, `tools/lbx.py`, `tools/extract_all.py`, `tools/verify_assets.py`, `tools/drive.py`, `tools/app_window.py`, and the manifests under `assets/` were not provided. Claims that depend on them — the badge-jitter fix, the 873-item count, the COLONIES-scrambled exclusion, the anchor-plate regeneration policy in CLAUDE.md §3 — are unverifiable from what I have. The doc's own first rule ("Verify behaviour, not presence") applies to me here: I can't confirm those fixes exist, and I'm not going to assert they do.

## 8. Things the docs get right and the code confirms

For balance — the load-bearing claims I *was* able to check all hold:

- Speech-queue serialisation is real (`pump()` with token guard, `LINE_GAP_MS`, `currentLineSpeaker` per job).
- The `activeSeatForLine()` / `speakerIsSeated()` / `drivesDesk` triad is wired through renderer, text-engine, animator, and director exactly as CLAUDE.md §3 describes.
- `interject()` on the director is the only path from `GNNGlitch.onSecret`, so the ident-interrupted-once race is structurally closed.
- The teleprompter gates on `waitingForAudio()` before typing, and `present()` defers the caption swap.
- `asset-registry.js:boundOk()` rejects missing fields in both directions, closing the COLONIES/magenta-rect hole.
- The desktop `S.BREAK` case in `update()` really is absent, so `beginBreak()` owns the return-from-break.
- `_log_rotate_lock`, `O_APPEND` fds, and 250MB/3-backup rotation are all present and threaded correctly in `server.py`.

---

If I had to prioritise: the **`beginTwoWay` unchecked return** is the only defect likely to reach air, and it only does so if a correspondent plate is missing. Second is the **873/713 count** because it's the number every other doc quotes. Third is the **§7 stale list**, which is the exact pattern CLAUDE.md §0 opens by warning about — documents confidently claiming a state the code contradicts.

broadcast-director.js — full file with the beginTwoWay fix

The bug was that GNNCutsceneManager.openTwoWay() returns false when correspondentScene() yields nothing (missing plate on disk), but beginTwoWay() fired it and forgot it, then returned true unconditionally. Result: the anchor's and correspondent's lines play over the story icon, no monitor opens, correspondentUsed latches, and the show has no way to try again.

The fix has three parts:

    beginTwoWay becomes async and awaits openTwoWay, only queueing the speech if the monitor actually opened.

    A twoWayArming flag closes the frame-loop window the await opens. The prior code made beginTwoWay synchronous specifically to avoid this window (see CLAUDE.md §3 "The two-way played over the story it replaced"), so making it async again requires an explicit reservation — the same shape the codebase already uses for breakArming in beginBreak.

    beginBanter becomes async and refetches now on the fall-through path, so a failed two-way degrades cleanly into the exchange/plain-banter path rather than stale-timing the beat.
