# Scene review — MOO1 full-screen composites

The nine recipes in `js/scene-compositor.js` assemble full-screen cutaway
scenes out of LBX-decoded sprites, backdrops and chrome plates. They were
written when the compositor was the primary source of B-roll. Now that the
generated cutaway plates exist, the composites are the fallback path and
are only seen on stories where no plate matches.

Three classes of fault have been seen on air. This folder holds rendered
reviews of each recipe so the faults can be seen, categorised, and the
decision made — keep, fix, or delete.

## The three faults

**Composite faults** — live in `js/scene-compositor.js`, in the recipes.

- **Phantom overlay.** A translucent square layer appears over the
  bottom-left third of some scenes. Most visible on the `SPECIFICATION`
  commercial card. It belongs to a different composition and should not
  be on this one. Removing that single layer likely salvages the recipe.
- **Mismatched assets at incompatible scales.** Layers drawn from
  different pools with no perspective or scale check. `MOTION.approach`
  in particular scales sprites across an 18× range, so the same sprite
  reads correctly at one moment and out of place the next.
- **Missing background.** Some pool queries return empty (typically
  `BACKGRND` / `EMBASSY` fullscreen with `noise <= 95`), the layer is
  dropped, and the next layer draws against the clear colour — near
  black. The `Alkari research labs` scene is the clearest example.

**Asset faults** — live in the extractor (`tools/lbx.py` /
`tools/extract_all.py`), not in the compositor.

- **Delta frames stack instead of replacing.** MOO1 animations are stored
  as delta frames. If the decoder writes each frame body standalone
  rather than compositing it against an accumulator, playing frames 1, 2,
  3 shows 1, then 1+2, then 1+2+3. Visible as ghosting or trails.
- **Chromatically scrambled items.** A handful of items were authored
  against screen palettes that live in the game executable, not in any
  archive. They decode structurally correct but chromatically wrong.
  These are supposed to be filtered out of ordinary footage by
  `maxNoise` and routed to the glitch engine. One has been seen in a live
  commercial scene (`Mrrshan Stealth Optics`), which means the filter is
  not catching everything.

Fixing the extractor faults improves every animated MOO1 asset in the
broadcast, not just cutaways. Fixing the composite faults only improves
the recipes in this folder.

## How to generate a review set

1. Ensure the server is running: `./broadcast.sh` or `./start.sh --bg`.
2. Open <http://localhost:8080/tools/scene_review.html>.
3. Click **Render all → contact sheet (.png)** for stills, or
   **Render all → video (.webm)** for playback.
4. Move the files from your Downloads folder into this directory.

The tool renders each recipe **twice** — recipes are randomised, so two
runs of the same recipe do not look alike.

If only some files appear in your Downloads folder, check whether the
browser blocked the repeated downloads. Chrome and Chromium show a
permission bar the first time a page tries to save more than a couple of
files, and silently drop the rest if it is dismissed or refused. Clear
the site's download permissions for `localhost:8080` and run again.

## Contact sheet vs video

The contact sheet is a 4×2 grid of eight stills across the recipe's
duration. Useful for a quick scan; **not sufficient for judging a
recipe**, because the faults that matter — frame stacking, motion at
incompatible scales — are faults of the animation and do not show in a
still. The video is the primary artifact.

## What each recipe is supposed to be

| Recipe | Intent |
| :--- | :--- |
| `convoy` | Freighter convoy crossing a skyline at depth |
| `tactical` | Starfield with a drifting hull and readout chrome |
| `survey` | Planet body with a scan-bar sweep |
| `council` | Council floor with delegate cut-ins |
| `interview` | Two-shot portrait against an interior |
| `industry` | Colony panels tiled behind machinery sprites |
| `anomaly` | Vortex core with debris pulled inward |
| `cyber` | Data-centre plates behind scrolling chrome |
| `deepfield` | Nebula stack, no hard subject |

## Verdicts

Fill this in as each recipe is reviewed. A recipe marked **fix** is one
where a specific layer is the fault, not the whole composition; a recipe
marked **delete** is one where the parts do not go together at all.

| Recipe | Verdict | Notes |
| :--- | :--- | :--- |
| `convoy` | keep | Both renders clean. Ships at depth over LANDING skylines via `cross` motion with bounded scales. Working as intended. |
| `tactical` | keep | Chrome plates already removed (`plates = []`). Starfield + drifting hull reads as surveillance feed. Clean. |
| `survey` | keep | Planet body with orbiting probe and scan bar. Both renders clean. |
| `council` | **fix** | `portrait` pool delegates produce ornamental framed race cards, not cut-in figures. Reads as posters nailed to a wall. **Delegate layers removed**; backdrop alone is an establishing shot. |
| `interview` | keep | SPIES fullscreen portraits fill contain-fit against EMBASSY/BACKGRND room backdrops. Reads as "live interview" / surveillance photo. |
| `industry` | keep | Plate query now `maxCoverage:0.6, maxNoise:40, animated:false`. The twenty cov-1.00 sky panels no longer reach the rect. Phantom rectangle gone. |
| `anomaly` | keep | Best-looking recipe. Vortex core + `approach` debris creates genuine depth. Both renders vivid. |
| `cyber` | **delete** | `rack = []` — loop never runs. Recipe is a single SPIES portrait with no overlays, identical to `interview` minus the room backdrop. **Deleted from RECIPES.** |
| `deepfield` | keep | Recipe logic sound (nebula stack + starfield). Grey square artefacts in r1 are **delta-frame stacking** — extractor fault, not compositor. Will clean up when extractor is fixed. |

## Salvage cases observed so far

**The SPECIFICATION card.** Underlying shot — dark clouds, green-lit
ridge, mottled terrain — reads correctly. The phantom square in the
bottom-left is the fault. Removing that layer likely closes this recipe.

**The Alkari research labs scene.** The Alkari figure reads correctly.
The background is missing because a pool query returned empty. Adding a
fallback query (the pattern `convoy()` already uses) likely closes this.

**The Mrrshan Stealth Optics scene.** The visible asset is chromatically
scrambled — the marbled red texture is a decoding fault, not a compositing
one. Either the noise filter needs tightening, or the item needs to be
removed from the pool that feeds commercial hero shots.

## Notes for whoever works this next

- The recipes are randomised. Two renders of the same recipe do not look
  alike, and a single capture is not the whole picture of a recipe.
- Until a decision is made, `cutscene-manager.js` uses the generated
  plates first and falls back to these composites. Deleting a recipe from
  `RECIPES` in `scene-compositor.js` removes it from the fallback pool
  entirely.
- The review page is a development tool. It is not linked from the
  broadcast and only exists at `/tools/scene_review.html`.
- **The delta-frame warning above predates the MoO1 decoder fix.** Re-extract
  the MoO1 assets and regenerate the review set before using an old capture as
  evidence of a current decoder fault. Composite recipe defects still live in
  `scene-compositor.js`; palette-scrambled assets remain a separate review
  category and should be judged from current renders.
