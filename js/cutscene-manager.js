/* ============================================================
   GNN — Cutscene Manager
   ------------------------------------------------------------
   Two jobs:

   1. B-ROLL CUTAWAYS. While the anchor reads, cut to a
      synthesized scene in the over-the-shoulder window (or take
      it full-frame for a hard cut). Scene choice is driven by
      the story's own words.

   2. COMMERCIAL BREAKS. Not a 4-second bumper any more: a
      storyboarded sequence of 4-6 shots — station ident, hook,
      product hero, spec plate, tag card, legal card — each with
      its own composited scene, its own voice-over beat, its own
      sound design, and hard cuts or dissolves between them.
      Every break is assembled at runtime, so two breaks never
      look the same.

   ------------------------------------------------------------
   Scene source mixing.

   Every route has a generated plate in
   `assets/generated/cutaways/`. The compositor also has a
   recipe per route that builds footage from the LBX archive —
   MoO1 and MoO2 both, now that MoO2 items carry pools.

   Before this change the compositor was only reached when the
   generated plate was missing, which meant the archive
   compositor effectively never ran on air. The whole MoO2
   library was reachable from `GNNAssets.find()` and invisible
   from the viewer's seat.

   `SCENE_MIX` sets the share: 0.7 generated, 0.3 composited.
   The compositor is not a fallback any more — it is a second
   source for the same subject, and the station chooses between
   them per cutaway. This does three things at once:

     - the archive is actually on screen, which is the point of
       having decoded it;
     - the fallback path gets production coverage instead of
       review-tool coverage, so a broken recipe is found by the
       viewer rather than by the next person who opens
       `scene_review.html`;
     - two cutaways of the same subject stop being visually
       identical, because the archive and the plate do not
       compose the same shot.

   `?cutaways=plate` forces generated plates; `?cutaways=archive`
   forces the compositor. Neither flag is used by the runtime;
   both are for review and CDP harness runs.

   The rule when the chosen source is unavailable is unchanged:
   if the plate exists but is broken, fall to the compositor;
   if the compositor fails, fall to `null` and the cutaway is
   skipped. `pendingScene` still carries the fallback so
   `triggerCutaway()` never has to re-query when `prefetch()`
   already ran.

   ------------------------------------------------------------
   Recent fixes:

   The `cyber` route was renamed to `hack`. `cyber` used to
   name both a route and a compositor recipe; the recipe was
   deleted (it was a single SPIES portrait with no overlays,
   identical to `interview` minus the room), but the route was
   left in place and still pointed at it. When the generated
   plate for a hacking story was missing, `prefetch()` and
   `triggerCutaway()` fell through to `synthesize('cyber')`
   and — before the fix in scene-compositor.js — were handed a
   random recipe instead. With the fixed synthesize() that path
   now returns null and the cutaway is skipped, which is what
   the scene-review docs said a deleted recipe should do.

   The route is kept, renamed, and pointed only at the
   generated plates. There is no composite fallback for a hack
   story any more; either the plate loads or the story reads
   without a cutaway.

   Commercial assembly now logs three extra fields so a break
   that does not show the expected product is diagnosable in
   one read of `gnn-server.log`:

     [GNN Commercial:Script]    which script kind was resolved
                                (auto-roll or forced), the
                                brand, the product, and whether
                                it is a plate-bearing kind.
     [GNN Commercial:Plate]     per plate-bearing beat: which
                                plate URL was requested, whether
                                the image loaded, which product
                                image was requested, whether
                                the product loaded, whether a
                                composite was built, and whether
                                the scene came out. A missing
                                file names itself instead of
                                appearing as an unexplained
                                MOO1 composite mid-break — or,
                                as it did until this pass, a
                                stage plate with no product on
                                it.

   The ident, tag and legal beats are by design MOO1 backdrops
   with the brand card composited over them — the commercial
   opens and closes on station branding and only the middle
   beats carry the product. The Plate log only fires for
   `hook`, `body` and `claim` for that reason; a `[GNN
   Commercial:Plate]` line on a tag beat would be a bug, and
   the absence of one on a hook beat means the beat fell
   through.

   ------------------------------------------------------------
   Product compositing:

   The QVC and infomercial beats previously loaded the stage
   plate and handed it to `single()` unchanged, so the break
   showed an empty pedestal with the price and stock graphics
   floating over it. The product itself was never drawn.

   `buildShot()` now composites the product image onto the
   stage plate before the scene is built. Two lookup tables
   drive it: `PRODUCT_IMAGES` maps a script-writer product name
   to a file in `assets/generated/products/`, and `PRODUCT_SLOT`
   maps a stage plate path to the rect (as fractions of the
   plate) where the product sits.

   The two QVC stages are different rooms — one is a close-up
   of a single pedestal, the other a wide set with a display
   table — so the slot is per-plate rather than per-product.
   A product that has no entry in either table still shows the
   stage plate, unmodified; the composite is skipped and the
   log line names what was missing.

   `compositeProduct()` returns an HTMLCanvasElement. It is
   passed to the scene builder directly rather than through
   `GNNSceneCompositor.single()`, because `single()` routes
   through `makeLayer()`, which tests for `naturalWidth` on
   the entry's image — and a canvas element has no
   `naturalWidth` property. Building the scene object
   here is the same thing `single()` would produce for a
   preloaded image, just without the detour.

   ------------------------------------------------------------
   v14 — cutaway log names its source.

   Two things were made observable this pass, both of which
   were invisible before and cost a session to confirm:

   1. A version marker on the first line of the IIFE. Every
      other module has one (`[scene-compositor] v13`,
      `[GNN Assets]`, `[GNN Boot]`). Its absence on this file
      meant that "did the browser reload the new build?" had no
      one-line answer — the answer had to be inferred from the
      shape of a trace line. `grep cutscene-manager` in
      `gnn-server.log` now answers it.

   2. A generated plate names itself. `extractSceneAssets()`
      used to fall through to `layer_N` for any layer with no
      `entry`, which is what a generated plate is — so a
      cutaway trace read `Assets=[layer_1]` and gave no clue
      which plate had played. The compositor path names its
      assets (`LANDING/item_13`); the plate path now names
      its own (`cutaways/station_trade.png`), and a viewer
      report of "the convoy cutaway showed the wrong picture"
      is one grep away from the file that produced it.

   ------------------------------------------------------------
   v15 — commercial pools and shot duration.

   Four fixes in the commercial path:

   F5  SPIES and EMBASSY 12-17 removed from every background
       pool in `heroPoolFor()`. Both are keyed-out overlays —
       a spy figure or a player-representative on a transparent
       field — and composited as backgrounds they put a
       floating cut-out on black. Neither is a picture of a
       place and neither belongs in a background slot.

   F6  Shot duration now takes the scene's own animation length
       into account. The previous build held every shot for a
       fixed 4200 ms, so any animation longer than that reached
       its last frame and started over with the voice-over
       still running. See `sceneAnimationMs()`.

   F7  Every beat in `heroPoolFor()` draws from a wider list.
       Each list was two or three archives deep, so every
       commercial break reused the same handful of backgrounds.

   F8  Two causes of the "scene reloads mid-read" report:
       `drawGeneratedScene()` wrapped animation frames back to
       zero with a modulo, and `render()`'s dissolve path faded
       every shot down to 15% opacity at the end. Both gone.
       The wrap also lives in `scene-compositor.js` on the
       composited path and is handled separately there.
   ============================================================ */

const GNNCutsceneManager = (() => {
    'use strict';

    console.log('[cutscene-manager] v15 — commercial pools and shot duration');

    // Cutaway window over the anchor's right shoulder, in 320x200 space.
    // Fractions of the frame, not pixels of a 320x200 screen that no longer
    // exists: the old constants were divided by 200 against a frame 180 tall
    // and came to 40% of the width, which put the over-the-shoulder box
    // across the anchors beside it. Matched to the story icon plate in
    // renderer.js, since they occupy the same corner for the same reason.
    // The monitor, shared with the story icon (renderer.js reads this).
    // 16:9, matching the opening of the generated bezels (about 1.8:1 —
    // a 1.45:1 monitor stretched them 25% tall), and about a fifth larger
    // in area than it was (0.175 x 0.215), right edge where it was.
    const PIP = { x: 0.715, y: 0.062, w: 0.215, h: 0.211 };
    const PIP_MS = 7200;

    // --- scene source mixing ---------------------------------
    //
    // `plateShare` is the probability a cutaway draws a generated
    // plate rather than a composited scene. The remainder goes to
    // `GNNSceneCompositor.synthesize()`, which builds a shot out of
    // the LBX archive — MoO1 and MoO2 both, since the merge and the
    // pool assignment. See the module header for the reasoning.
    //
    // `?cutaways=plate` and `?cutaways=archive` force one source
    // for review and CDP runs. Any other value falls through to the
    // mixed behaviour, so a typo does not silently disable a source.
    //
    // `footageShare` is the third source: moving MoO2 cinematic footage
    // (`CINEMATICS` below), drawn first and only for a route that has
    // some. `?cutaways=footage` forces it, like the other two.
    const SCENE_SOURCES = ['plate', 'archive', 'footage'];
    const SCENE_MIX = (() => {
        const base = { plateShare: 0.7, footageShare: 0.38, forced: null };
        if (typeof window === 'undefined' || !window.location) return base;
        const q = String(window.location.search || '');
        const forced = (q.match(/[?&]cutaways=([a-z]+)/i) || [])[1] || null;
        return Object.assign(base, {
            forced: SCENE_SOURCES.indexOf(forced) >= 0 ? forced : null,
        });
    })();

    /** Which source to draw this cutaway from: plate, archive or footage. */
    function pickSceneSource(kind) {
        if (SCENE_MIX.forced) return SCENE_MIX.forced;
        if (kind && CINEMATICS[kind] && Math.random() < SCENE_MIX.footageShare) {
            return 'footage';
        }
        return Math.random() < SCENE_MIX.plateShare ? 'plate' : 'archive';
    }

    let cutaway = null;        // { scene, startedAt, mode, source }
    let breakState = null;     // { shots, index, startedAt, script }
    let lastCutawayEnd = 0;
    let onBeat = null;         // (text, shot) => Promise
    let onBreakEnd = null;
    // `pendingScene` is what `prefetch()` resolved. `triggerCutaway()`
    // reads it as the primary choice and only re-queries if it is null
    // — which happens when the source that was picked in prefetch
    // could not deliver. Both source choices are stored here so the
    // cutaway always has a fallback without a second await.
    let pendingScene = null;
    // The other source's promise for the same story, or null when it
    // was not attempted. Filled by `prefetch()`; consumed by
    // `triggerCutaway()` if the primary source came up empty.
    let pendingAlternate = null;
    // The story both were built for. A scene is only used by that story's
    // cutaway: an untagged one could resolve late, or outlive a skipped
    // story, and illustrate the next story with the wrong picture.
    let pendingFor = null;

    // ---------------------------------------------------------
    // Story -> scene routing
    // ---------------------------------------------------------

    // A route is a *subject*, not a recipe name. Most routes share a name
    // with a compositor recipe because the recipe was written for that
    // subject; `hack` does not, because the recipe was deleted. A route
    // with no recipe and no generated plate simply produces no cutaway.
    const ROUTES = [
        { kind: 'convoy', words: ['launch', 'rocket', 'spacex', 'nasa', 'artemis', 'starship', 'orbit', 'satellite', 'cargo', 'shipping', 'fleet', 'convoy', 'flight', 'aviation', 'boeing', 'airbus'] },
        { kind: 'anomaly', words: ['quantum', 'physics', 'anomaly', 'black hole', 'wormhole', 'gravity', 'particle', 'collider', 'antimatter', 'relativity', 'singularity', 'fusion'] },
        { kind: 'hack', words: ['hack', 'hacked', 'cyber', 'breach', 'ransomware', 'malware', 'leak', 'exploit', 'phishing', 'botnet', 'zero-day', 'encryption', 'password', 'spyware'] },
        { kind: 'council', words: ['senate', 'parliament', 'congress', 'election', 'vote', 'treaty', 'summit', 'council', 'minister', 'president', 'diplomat', 'sanctions', 'legislation'] },
        { kind: 'survey', words: ['telescope', 'exoplanet', 'astronomy', 'webb', 'hubble', 'asteroid', 'comet', 'mars', 'moon', 'jupiter', 'saturn', 'galaxy', 'nebula', 'star'] },
        { kind: 'outbreak', words: ['plague', 'disease', 'virus', 'outbreak', 'pandemic', 'epidemic', 'infection', 'quarantine', 'contagion', 'medical', 'health'] },
        { kind: 'industry', words: ['factory', 'manufacturing', 'mining', 'chip', 'semiconductor', 'steel', 'energy', 'reactor', 'battery', 'supply chain', 'plant', 'refinery'] },
        { kind: 'interview', words: ['interview', 'said', 'told', 'statement', 'ceo', 'spokesperson', 'testimony', 'address', 'speech'] },
        { kind: 'tactical', words: ['military', 'defense', 'defence', 'missile', 'strike', 'troops', 'war', 'conflict', 'invasion', 'drone', 'navy', 'army'] },
        { kind: 'deepfield', words: ['climate', 'ocean', 'ice', 'weather', 'environment', 'species', 'forest', 'earth'] },
    ];

    function hasWholeWord(text, word) {
        const esc = word.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        return new RegExp('\\b' + esc + '\\b', 'i').test(text);
    }

    // Ground fighting, for in-universe stories only. The ground-war scene
    // shows soldiers dying; real war news keeps the space-battle routes.
    const GROUND_WAR_WORDS = /\b(invasion|invaded|invade|troops|marines|garrison|occupation|occupied|siege|assault|ground forces|captured|seized|revolt|rebels|rebellion|blockade|border skirmish|war)\b/i;

    function routeFor(story) {
        const text = `${(story && story.title) || ''} ${(story && story.description) || ''}`;
        if (story && story.lore && GROUND_WAR_WORDS.test(text)) return 'groundwar';
        let best = null, bestScore = 0;
        for (const r of ROUTES) {
            let score = 0;
            for (const w of r.words) if (hasWholeWord(text, w)) score++;
            if (score > bestScore) { bestScore = score; best = r.kind; }
        }
        return best;
    }

    // The generated cutaway plates, by the route they illustrate.
    //
    // Fourteen of these were conditioned into assets/generated/cutaways/
    // and nothing referenced them, which is why every cut still landed on
    // a MOO1 screen. They are full-bleed pictures of the thing being
    // reported, which is what a cutaway is for.
    //
    // A route with an entry here draws the plate when it loads and is
    // skipped entirely when it does not — there is no compositor recipe
    // behind `hack` to fall back to, and the compositor no longer
    // substitutes a random scene for a name it does not recognise. That
    // is deliberate: a missing cutaway is a small loss, a wrong one is
    // worse than none.
    //
    // Every `_02`, `_03` variant on disk is listed. A route with only one
    // plate shows the same cutaway every time it fires; a route with four
    // picks a different one on each cut. The selection is a uniform
    // random draw over the array, so the ordering within a route does not
    // affect the mix.
    const GENERATED = {
        convoy: ['station_trade', 'station_trade_02',
            'starship_battle', 'starship_battle_02', 'starship_battle_03'],
        tactical: ['starship_battle', 'starship_battle_02', 'starship_battle_03',
            'planet_invasion', 'planet_invasion_02'],
        council: ['council_vote', 'council_vote_02', 'council_summit'],
        hack: ['hacker_code', 'hacker_code_02',
            'spy_infiltration', 'spy_infiltration_02'],
        anomaly: ['space_vortex', 'space_vortex_02', 'space_vortex_03',
            'black_hole', 'black_hole_02',
            'solar_flare', 'solar_flare_02'],
        survey: ['black_hole', 'black_hole_02',
            'solar_flare', 'solar_flare_02',
            'asteroid_mining', 'asteroid_mining_02'],
        outbreak: ['virus_outbreak', 'virus_outbreak_02'],
        industry: ['asteroid_mining', 'asteroid_mining_02',
            'station_trade', 'station_trade_02'],
        deepfield: ['black_hole', 'black_hole_02',
            'space_vortex', 'space_vortex_02', 'space_vortex_03'],
        interview: ['council_summit', 'station_trade', 'station_trade_02',
            'council_vote', 'council_vote_02'],
    };
    const GEN_DIR = 'assets/generated/cutaways/';
    const genCache = new Map();

    function loadGenerated(name) {
        if (genCache.has(name)) return genCache.get(name);
        const p = (typeof GNNAssets !== 'undefined' && GNNAssets.loadImage)
            ? GNNAssets.loadImage(GEN_DIR + name + '.png')
            : Promise.resolve(null);
        genCache.set(name, p);
        return p;
    }
    /**
     * A generated plate for this route, as a scene the renderer can show.
     *
     * Returns null when the route has no plate or the file is missing, and
     * the caller falls back to the composited MOO1 scene — so dropping a
     * better picture in later is the whole of the change needed.
     *
     * A route with no compositor recipe behind it (`hack`) returns null
     * here and the caller skips the cutaway. That is the correct outcome:
     * the alternative is a random recipe shown under a story it has
     * nothing to do with.
     *
     * The layer carries the plate's own filename as `name` so
     * `extractSceneAssets()` can report it in the trace. Without it the
     * log read `Assets=[layer_1]`, which is no use to anyone diagnosing
     * a wrong shot after the fact — the compositor path names its
     * assets (`LANDING/item_13`), the plate path now names its own
     * (`cutaways/station_trade.png`).
     */
    async function generatedScene(kind) {
        const names = GENERATED[kind];
        if (!names || !names.length) return null;
        const name = names[(Math.random() * names.length) | 0];
        const img = await loadGenerated(name);
        if (!img) return null;
        // Same shape `GNNSceneCompositor.makeLayer` produces, so the
        // renderer draws it with no special case: a layer is a list of
        // frames, not an image.
        const plateName = 'cutaways/' + name + '.png';
        return {
            kind,
            layers: [{
                entry: null, frames: [img], fps: 0, motion: 'still',
                params: {}, blend: 'source-over', alpha: 1,
                fit: 'cover', rect: null, offset: 0,
                name: plateName,
            }],
            duration: PIP_MS, label: null, generated: true,
        };
    }

    /**
     * The compositor's scene for this route, or null.
     *
     * `kind` is passed straight through, so a route with no recipe
     * returns null (the compositor refuses to substitute) and a route
     * with one returns a scene built from the LBX archive — MoO1 and
     * MoO2 both, since the merge and the pool assignment.
     */
    async function compositorScene(kind) {
        if (typeof GNNSceneCompositor === 'undefined') return null;
        return GNNSceneCompositor.synthesize(kind || undefined);
    }

    // Field correspondents, per docs/ROADMAP.md: they come in through the
    // monitor, not through a second set. One portrait each instead of a
    // room, framed by the PIP that already exists for cutaway footage.
    const CORR_DIR = 'assets/generated/correspondents/';
    const corrCache = new Map();

    function loadCorrespondent(sid, state) {
        const key = sid + '_' + state;
        if (corrCache.has(key)) return corrCache.get(key);
        const p = (typeof GNNAssets !== 'undefined' && GNNAssets.loadImage)
            ? GNNAssets.loadImage(CORR_DIR + key + '.png')
            : Promise.resolve(null);
        corrCache.set(key, p);
        return p;
    }

    // ---------------------------------------------------------
    // Correspondent mouth flap
    // ---------------------------------------------------------
    //
    // The desk's flap lives in GNNAnimator, which is now driven by the
    // director's "is the desk speaking" flag — a correspondent's line must
    // not move the anchor's mouth, so the animator is told to stay shut
    // during a two-way. That leaves the correspondent's own mouth with no
    // animator, because the animator is a singleton built for the desk.
    //
    // So the correspondent has its own small clock here, matched to the
    // animator's: roughly five flaps a second, shut half shorter than
    // open, and gated on the voice level so it goes silent between
    // sentences rather than flapping through a pause.
    //
    // The plate is two-state art — hero and speaking — the same way the
    // cast is, and the layer below swaps between them on this flag.
    let corrJawOpen = false;
    let corrJawUntil = 0;
    let corrJawOpenRight = false;
    let corrJawUntilRight = 0;
    let corrVoiceUntil = 0;
    let corrVoiceUntilRight = 0;
    const CORR_GATE = 0.15;

    function tickCorrespondentMouth(now) {
        const dir = (typeof GNNDirector !== 'undefined') ? GNNDirector : null;
        const speakerNow = dir && dir.speaker ? dir.speaker() : null;
        const speakerId = speakerNow ? speakerNow.id : null;

        // Left / Primary correspondent
        const targetLeft = (cutaway && cutaway.sidLeft) || (cutaway && cutaway.scene && cutaway.scene.correspondent);
        const theirTurnLeft = !!(targetLeft && speakerId === targetLeft);
        const voiceOnLeft = theirTurnLeft
            && typeof GNNTTS !== 'undefined'
            && GNNTTS.isSpeaking && GNNTTS.isSpeaking();
        const levelLeft = voiceOnLeft && GNNTTS.getLevel ? GNNTTS.getLevel() : 0;
        if (voiceOnLeft && levelLeft > CORR_GATE) corrVoiceUntil = now + 90;
        if (now < corrVoiceUntil) {
            if (now >= corrJawUntil) {
                corrJawOpen = !corrJawOpen;
                const hurry = 1 - Math.min(0.5, levelLeft);
                corrJawUntil = now + (corrJawOpen ? 70 + hurry * 70 : 50 + hurry * 50);
            }
        } else {
            corrJawOpen = false;
            corrJawUntil = 0;
        }

        // Right correspondent (for dual-pip debate)
        const targetRight = cutaway && cutaway.sidRight;
        const theirTurnRight = !!(targetRight && speakerId === targetRight);
        const voiceOnRight = theirTurnRight
            && typeof GNNTTS !== 'undefined'
            && GNNTTS.isSpeaking && GNNTTS.isSpeaking();
        const levelRight = voiceOnRight && GNNTTS.getLevel ? GNNTTS.getLevel() : 0;
        if (voiceOnRight && levelRight > CORR_GATE) corrVoiceUntilRight = now + 90;
        if (now < corrVoiceUntilRight) {
            if (now >= corrJawUntilRight) {
                corrJawOpenRight = !corrJawOpenRight;
                const hurry = 1 - Math.min(0.5, levelRight);
                corrJawUntilRight = now + (corrJawOpenRight ? 70 + hurry * 70 : 50 + hurry * 50);
            }
        } else {
            corrJawOpenRight = false;
            corrJawUntilRight = 0;
        }
        return corrJawOpen;
    }

    /**
     * A remote two-way: the correspondent in the monitor over a location
     * plate, the way a channel carries a reporter on the ground.
     *
     * Loads *both* mouth states. The plate is two-state art, exactly like
     * the cast — hero and speaking share a pose and differ only at the
     * mouth — and the layer below swaps between them on a flag `update()`
     * sets from `tickCorrespondentMouth()`. Loading only the `speaking`
     * plate, which is what this used to do, gave a correspondent whose
     * mouth was permanently open and could not be closed or opened.
     *
     * Returns a scene or null. Null means no plate for that character, and
     * the caller simply does not throw to them.
     */
    async function correspondentScene(sid, kind) {
        const [hero, speaking] = await Promise.all([
            loadCorrespondent(sid, 'hero'),
            loadCorrespondent(sid, 'speaking'),
        ]);
        // Fall back to whichever loaded if only one is present, so a
        // partially-conditioned set still puts a face on air rather than
        // silently dropping the two-way.
        const base = hero || speaking;
        if (!base) return null;
        const mouthClosed = hero || base;
        const mouthOpen = speaking || base;

        const layers = [];
        // Try the routed backdrop first; if null or missing, fall back to
        // ambient outpost/station plates so no correspondent is ever
        // rendered over a black void (#000 canvas clear).
        //
        // Both sources are tried, plate then compositor, because a
        // correspondent is on screen behind the interview either way
        // and the archive compositor is what makes a correspondent
        // scene look like it was shot somewhere rather than composited
        // onto a single plate. Preferring the plate means the current
        // generated backdrops keep working; falling to the compositor
        // means a route with no plate still gets a background.
        let back = (kind && await generatedScene(kind));
        if (!back || !back.layers[0]) {
            back = await compositorScene(kind);
        }
        if (!back || !back.layers[0]) {
            back = await generatedScene('interview');
        }
        if (back && back.layers[0]) {
            // Dimmed, so the reporter reads against it rather than
            // competing with it.
            layers.push(Object.assign({}, back.layers[0], { alpha: 0.55 }));
        }
        // Two frames, closed first. `fps: 0` makes the compositor read
        // `frameIndex`, which `update()` sets every tick. The `mouthSwap`
        // marker is how it finds this layer without guessing.
        layers.push({
            entry: null,
            frames: [mouthClosed, mouthOpen],
            fps: 0, motion: 'still',
            frameIndex: 0,
            params: {}, blend: 'source-over', alpha: 1,
            fit: 'contain', rect: null, offset: 0,
            mouthSwap: true,
        });
        return {
            kind: kind || 'interview', layers,
            duration: PIP_MS, label: null, correspondent: sid,
            // Built from generated plates, drawn at the destination's own
            // resolution — see drawGeneratedScene().
            generated: true,
        };
    }

    /** Put a correspondent in the monitor and leave them there. */
    async function openTwoWay(sid, kind, now, label) {
        if (breakState) return false;
        const scene = await correspondentScene(sid, kind);
        if (!scene) return false;
        cutaway = {
            scene, startedAt: now, duration: 1e9, mode: 'pip',
            label: label || null, twoWay: true
        };
        if (typeof GNNAudio !== 'undefined') {
            GNNAudio.playChord(SCENE_AUDIO.interview);
        }
        return true;
    }

    /**
     * Open a split-screen debate between two correspondents or species (e.g. Council Crossfire).
     * Renders dual PIP monitors: left guest and right guest with anchor in center.
     */
    async function openDebate(sidLeft, sidRight, kind, now, labelLeft, labelRight) {
        if (breakState) return false;
        const sceneLeft = await correspondentScene(sidLeft, kind || 'interview');
        const sceneRight = await correspondentScene(sidRight, kind || 'interview');
        if (!sceneLeft || !sceneRight) return false;
        cutaway = {
            scene: sceneLeft,
            sceneRight: sceneRight,
            startedAt: now,
            duration: 1e9,
            mode: 'dual-pip',
            label: labelLeft || (sidLeft.toUpperCase()),
            labelRight: labelRight || (sidRight.toUpperCase()),
            twoWay: true,
            isDebate: true,
            sidLeft,
            sidRight,
        };
        if (typeof GNNAudio !== 'undefined') {
            GNNAudio.playChord(SCENE_AUDIO.interview);
        }
        return true;
    }

    function isTwoWay() { return !!(cutaway && cutaway.twoWay); }

    // The MoO2 cinematics, as moving cutaway footage.
    //
    // Nine Smacker videos were decoded to PNG sequences in
    // assets/cutscenes/moo2_video/ and nothing read them. Every segment
    // below was picked off a dense contact sheet and a per-frame brightness
    // scan, not inferred from the clip's name:
    //
    //   - every clip opens on black frames, which are skipped;
    //   - the intro ends on the MASTER OF ORION II title logo after a white
    //     flash at frame ~656, so nothing past frame 648 is ever listed —
    //     the same reason the MicroProse logo was cut out of INTRO/item_00;
    //   - the dark interior that opens `plntdfin` is skipped for the beam
    //     and the planet coming apart.
    //
    // Frames are every second frame of 15 fps video, so 7.5 fps plays them
    // at real speed. A pick is a contiguous window that fits one cutaway;
    // the compositor holds the last frame rather than looping.
    const CINE_DIR = 'assets/cutscenes/moo2_video/';
    const CINE_FPS = 7.5;
    const CINEMATICS = {
        anomaly: [
            { clip: 'amebafin', from: 3, to: 87 },   // the space amoeba (85 frames)
            { clip: 'anatkfin', from: 10, to: 66 },  // Antarans through a rift (57 frames)
            { clip: 'dimtvfin', from: 8, to: 65 },   // dimensional portal (58 frames)
            { clip: 'intro', from: 346, to: 410 },   // vortex, ships emerging (65 frames)
            { clip: 'intro', from: 118, to: 232 },   // Antaran craft entering the bay (115 frames)
            { clip: 'loserfin', from: 1, to: 65 },   // ships around a glowing portal (65 frames)
            { clip: 'anwinfin', from: 70, to: 135 }, // the Antaran on its throne (66 frames)
        ],
        convoy: [
            { clip: 'intro', from: 52, to: 115 },    // station in transit (64 frames)
            { clip: 'intro', from: 404, to: 475 },   // fleet underway (72 frames)
            { clip: 'intro', from: 572, to: 645 },   // station and escorts (74 frames)
            { clip: 'dimtvfin', from: 120, to: 172 }, // fleet arriving (53 frames)
            { clip: 'intro', from: 240, to: 305 },   // bridge crew, orange watch (66 frames)
            { clip: 'intro', from: 450, to: 515 },   // cockpit, stars ahead (66 frames)
            { clip: 'intro', from: 535, to: 605 },   // the station turning (71 frames)
        ],
        tactical: [
            { clip: 'plntdfin', from: 50, to: 106 }, // planet destroyed (57 frames)
            { clip: 'anwinfin', from: 100, to: 159 }, // world burning (60 frames)
            { clip: 'loserfin', from: 30, to: 105 }, // city in ruins (76 frames)
            { clip: 'wininfin', from: 168, to: 245 }, // ships over a burning horizon (78 frames)
            { clip: 'plntdfin', from: 7, to: 65 },   // the planet-destroyer firing (59 frames)
            { clip: 'intro', from: 285, to: 345 },   // bridge going to red alert (61 frames)
            { clip: 'intro', from: 485, to: 545 },   // a battle, a ship explodes (61 frames)
        ],
        outbreak: [
            { clip: 'loserfin', from: 30, to: 105 },
        ],
        council: [
            { clip: 'wininfin', from: 3, to: 80 },  // the great chamber (78 frames)
        ],
        survey: [
            { clip: 'orionfin', from: 3, to: 75 },   // city on a mesa (73 frames)
            { clip: 'dimtvfin', from: 56, to: 122 }, // planets and a comet (67 frames)
            { clip: 'anwinfin', from: 25, to: 86 },  // alien towers under a red sky (62 frames)
        ],
        deepfield: [
            { clip: 'dimtvfin', from: 56, to: 122 },
            { clip: 'anwinfin', from: 1, to: 60 },   // red world from orbit (60 frames)
            { clip: 'anwinfin', from: 25, to: 86 },
        ],
        industry: [
            { clip: 'orionfin', from: 20, to: 85 },
        ],
    };
    // Footage plays full-screen now, for up to ten seconds.
    const CINE_FULL_MS = 10000;
    const CINE_MAX_FRAMES = Math.floor(CINE_FULL_MS / 1000 * CINE_FPS);

    /**
     * Four of the nine videos (intro and three endings) are Smacker's
     * line-doubled format: they decode at 480x160 and are meant to be
     * shown at 480x320. Drawn as decoded they aired squashed to half
     * height — round portholes as flat ovals — and, cover-fitted, cropped
     * to their middle third. Doubled here, per frame, for the life of the
     * cutaway only.
     */
    function unsquash(img) {
        if (!img || img.height * 2.5 > img.width) return img;
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height * 2;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = true;
        g.drawImage(img, 0, 0, c.width, c.height);
        return c;
    }

    /**
     * A moving cutaway for this route, or null.
     *
     * Null when the route has no footage or the frames are not on disk —
     * `assets/cutscenes/` is gitignored and regenerated by the extractors,
     * so a fresh clone without them simply keeps the still plates.
     */
    async function cinematicScene(kind, maxFrames = CINE_MAX_FRAMES) {
        const segs = CINEMATICS[kind];
        if (!segs || !segs.length) return null;
        const seg = segs[(Math.random() * segs.length) | 0];
        const span = seg.to - seg.from + 1;
        const n = Math.min(span, maxFrames);
        const start = seg.from + ((Math.random() * (span - n + 1)) | 0);
        const urls = [];
        for (let i = 0; i < n; i++) {
            urls.push(CINE_DIR + seg.clip + '/frame_'
                + String(start + i + 1).padStart(4, '0') + '.png');
        }
        // Uncached: footage is released when the cutaway ends.
        const imgs = await Promise.all(urls.map((u) => GNNAssets.loadImage(u, { cache: false })));
        const frames = imgs.filter(Boolean).map(unsquash);
        // A clip with most of its frames missing is not worth showing.
        if (frames.length < Math.max(8, n * 0.8)) return null;
        return {
            kind,
            layers: [{
                entry: null, frames, fps: CINE_FPS, motion: 'still',
                params: {}, blend: 'source-over', alpha: 1,
                fit: 'cover', rect: null, offset: 0,
            }],
            duration: Math.round(frames.length / CINE_FPS * 1000),
            label: null, cinematic: seg.clip,
            // Drawn at the destination's resolution, not through the
            // 320x180 compositor buffer — it is video, not pixel art.
            generated: true,
        };
    }

    // Sound design that matches the visual recipe. Keyed by the scene's
    // own `kind`, which for a generated plate is the route name and for
    // a composited scene is the recipe name. A route with no key here
    // (`hack` on a machine with no `hacker_code.png`) never reaches this
    // table, because no cutaway is created in the first place.
    const SCENE_AUDIO = {
        convoy: [{ role: 'rumble', gain: 0.5 }, { role: 'servo', gain: 0.35, delay: 0.6 }],
        anomaly: [{ role: 'drone', gain: 0.5 }, { role: 'sweep', gain: 0.4, delay: 1.1 }],
        hack: [{ role: 'beep', gain: 0.45 }, { role: 'chirp', gain: 0.4, delay: 0.35 }, { role: 'zap', gain: 0.3, delay: 0.9 }],
        council: [{ role: 'thud', gain: 0.5 }, { role: 'chirp', gain: 0.3, delay: 0.5 }],
        survey: [{ role: 'sweep', gain: 0.4 }, { role: 'blip', gain: 0.35, delay: 0.8 }],
        industry: [{ role: 'servo', gain: 0.5 }, { role: 'rumble', gain: 0.4, delay: 0.4 }],
        interview: [{ role: 'chirp', gain: 0.4 }],
        tactical: [{ role: 'alarm', gain: 0.4 }, { role: 'blast', gain: 0.45, delay: 1.2 }],
        deepfield: [{ role: 'drone', gain: 0.35 }],
        single: [{ role: 'servo', gain: 0.3 }],
        groundwar: [{ role: 'blast', gain: 0.45 }, { role: 'zap', gain: 0.35, delay: 0.7 },
            { role: 'rumble', gain: 0.35, delay: 1.6 }, { role: 'blast', gain: 0.3, delay: 2.8 }],
    };

    // A plain shot — a still, a plate, a product — used to fire the same
    // servo every time, so every commercial shot change sounded alike.
    // Now one of several light cues, plus the five intro stings, which
    // were in the audio manifest and called by nothing.
    const SHOT_CUES = [
        [{ role: 'servo', gain: 0.3 }],
        [{ role: 'sweep', gain: 0.3 }],
        [{ role: 'chirp', gain: 0.3 }],
        [{ role: 'blip', gain: 0.3 }, { role: 'tick', gain: 0.25, delay: 0.2 }],
        [{ role: 'beep', gain: 0.28 }, { role: 'click', gain: 0.25, delay: 0.15 }],
        [{ id: 'intro_sfx_03', gain: 0.35 }],
        [{ id: 'intro_sfx_04', gain: 0.3 }],
        [{ id: 'intro_sfx_05', gain: 0.3 }],
    ];
    function chordFor(kind) {
        if (kind && kind !== 'single' && SCENE_AUDIO[kind]) return SCENE_AUDIO[kind];
        return SHOT_CUES[(Math.random() * SHOT_CUES.length) | 0];
    }

    // ---------------------------------------------------------
    // Cutaways
    // ---------------------------------------------------------

    /**
     * Warm a scene for the current story so the cut is instant.
     *
     * Three sources. `pickSceneSource()` rolls between moving MoO2
     * footage (only for a route that has some), the generated plate and
     * the archive compositor; the chosen one resolves into
     * `pendingScene` and a fallback resolves into `pendingAlternate`.
     * `triggerCutaway()` uses the primary and, if it came up null,
     * takes the alternate rather than re-querying. That fallback is
     * what keeps a broken plate or a failed recipe from silently
     * dropping the cutaway.
     *
     * Both promises start in parallel, so the source that was not
     * chosen still has its image loads in flight by the time the
     * cutaway is triggered. A prefetch is on the critical path of a
     * story read, so it must not turn into two sequential waits.
     */
    async function prefetch(story) {
        // Claimed now, before any await: a later prefetch takes the slot,
        // and this one's results are then dropped rather than landing on
        // the next story.
        const claim = pendingFor = story;
        const set = (primary, alternate) => {
            if (pendingFor !== claim) return;
            pendingScene = primary;
            pendingAlternate = alternate;
        };
        set(null, null);
        const kind = routeFor(story);
        if (!kind) return null;
        const source = pickSceneSource(kind);
        if (source === 'footage') {
            const film = await cinematicScene(kind);
            // Frames missing on disk (a fresh clone that has not run the
            // extractors) fall back to the plate, then the archive.
            const alt = film ? null : (await generatedScene(kind)) || (await compositorScene(kind));
            set(film, alt);
            return film || alt;
        }
        const plateP = generatedScene(kind);
        const compositorP = compositorScene(kind);
        let primary, alt;
        if (source === 'archive') {
            primary = await compositorP;
            alt = primary ? null : await plateP;
        } else {
            primary = await plateP;
            alt = primary ? null : await compositorP;
        }
        set(primary, alt);
        return primary || alt;
    }


    function extractSceneAssets(scene) {
        const backdrops = [];
        const sprites = [];
        const overlays = [];
        const all = [];
        if (!scene || !scene.layers) return { backdrops, sprites, overlays, all };
        for (const l of scene.layers) {
            if (!l) continue;
            let id = '';
            if (l.entry) {
                id = l.entry.id || (l.entry.dir ? `${l.entry.dir}/item_${l.entry.item}` : 'asset');
                const role = String(l.entry.role || l.entry.dir || '').toLowerCase();
                if (role.includes('backgrnd') || role.includes('landing') || role.includes('starview') || role.includes('fullscreen') || role.includes('vortex')) {
                    backdrops.push(id);
                } else if (role.includes('starmap') || role.includes('techno') || role.includes('hud') || role.includes('chrome')) {
                    overlays.push(id);
                } else {
                    sprites.push(id);
                }
            } else if (l.name) {
                // Generated plate. The compositor path carries `entry`
                // and reports `LANDING/item_13`; this path used to fall
                // through to `layer_N` and report nothing useful. Now it
                // reports its own filename (`cutaways/station_trade.png`).
                id = l.name;
                backdrops.push(id);
            } else if (l.src) {
                id = l.src;
                overlays.push(id);
            } else if (l.fit === 'cover' || l.blend === 'source-over') {
                id = 'layer_' + (all.length + 1);
                backdrops.push(id);
            } else {
                id = 'layer_' + (all.length + 1);
                sprites.push(id);
            }
            all.push(id);
        }
        return { backdrops, sprites, overlays, all };
    }

    // MoO2's own newscast, rebuilt for the lore show. EVENTS item 1 is the
    // game's GNN newsroom — an android anchor under a blank GNN monitor — and
    // items 2-37 are the pictures that monitor showed. Each picture's logo
    // and red rule line up with the monitor's own at (320, 12) of the 640x480
    // room, so the event goes straight onto the screen in every frame.
    // In-universe: archive bulletins only, never a real story.
    const GNN_ROOM = 'assets/cutscenes/moo2/EVENTS/item_01_frame_';
    const GNN_ROOM_FRAMES = 31;
    const GNN_SCREEN = { x: 320, y: 12 };
    const GNN_ARCHIVE_SHARE = 0.6;

    async function gnnArchiveScene(story) {
        if (typeof GNNIconManager === 'undefined' || !GNNIconManager.gnnEventFor) return null;
        const n = GNNIconManager.gnnEventFor(`${story.title || ''} ${story.description || ''}`);
        if (!n) return null;
        const [pic, ...room] = await Promise.all([
            GNNAssets.loadImage(`assets/cutscenes/moo2/EVENTS/item_${String(n).padStart(2, '0')}_frame_000.png`),
            ...Array.from({ length: GNN_ROOM_FRAMES }, (_, i) =>
                // Uncached, like footage: released when the cutaway ends.
                GNNAssets.loadImage(GNN_ROOM + String(i).padStart(3, '0') + '.png', { cache: false })),
        ]);
        if (!pic || room.some((f) => !f)) return null;
        const frames = room.map((f) => {
            const c = document.createElement('canvas');
            c.width = f.width; c.height = f.height;
            const g = c.getContext('2d');
            g.drawImage(f, 0, 0);
            g.drawImage(pic, GNN_SCREEN.x, GNN_SCREEN.y);
            return c;
        });
        const fps = 4;   // the room's motion is ambient; 31 frames fill ~8 s
        return {
            kind: 'gnn_archive',
            layers: [{
                entry: null, frames, fps, motion: 'still', params: {},
                blend: 'source-over', alpha: 1, fit: 'cover', rect: null, offset: 0,
            }],
            duration: Math.round(frames.length / fps * 1000),
            label: 'GNN ARCHIVE', cinematic: 'gnn_archive', generated: true,
        };
    }

    async function triggerCutaway(story, now, opts = {}) {
        if (breakState) return false;
        const kind = routeFor(story);

        // An archive bulletin whose event MoO2's GNN pictured airs as that
        // newscast most of the time.
        if (story && story.lore && Math.random() < GNN_ARCHIVE_SHARE) {
            const archive = await gnnArchiveScene(story);
            if (archive && !breakState) {
                pendingFor = story;
                pendingScene = archive;
                pendingAlternate = null;
            }
        }

        // Consume whatever `prefetch()` resolved. If the primary source
        // came up empty — a missing plate, a failed recipe — the
        // alternate is used instead, and only if both are null does the
        // cutaway get skipped.
        const mine = pendingFor === story;
        let scene = mine ? (pendingScene || pendingAlternate) : null;
        let source = mine && pendingScene ? 'primary' : (scene ? 'fallback' : null);
        pendingScene = null;
        pendingAlternate = null;
        pendingFor = null;

        // No prefetch ran this story (a fresh boot, a story that landed
        // mid-beat). Query both sources now in parallel and take the
        // first that resolves to a scene.
        if (!scene && kind) {
            const [plate, composited] = await Promise.all([
                generatedScene(kind),
                compositorScene(kind),
            ]);
            scene = plate || composited;
            source = plate ? 'on-demand-plate' : (composited ? 'on-demand-archive' : null);
        }
        if (!scene) return false;

        // The alternate sometimes carries a different `kind` than the
        // primary — the compositor's recipe and the plate's route can
        // diverge when a route has a plate but no recipe, or vice versa.
        // The scene's own `kind` is authoritative for the audio cue.
        cutaway = {
            scene,
            startedAt: now,
            duration: opts.duration || (scene.cinematic
                ? Math.min(scene.duration || CINE_FULL_MS, CINE_FULL_MS)
                : Math.min(scene.duration || PIP_MS, PIP_MS)),
            // Story cutaways always play in the over-the-shoulder monitor.
            // The old form rolled `Math.random() < 0.18 ? 'full' : 'pip'`,
            // which put a full-frame MOO1 composite over the anchor roughly
            // one cutaway in five — the viewer heard the story being read
            // and saw a random starship or nebula plate instead of the desk.
            // The full-frame picture belongs to the commercial break, which
            // draws it unconditionally in the `breakState` branch at the top
            // of `render()`; a story cutaway is a PIP or nothing.
            //
            // `mode` is kept on the object because the two-way (`pip`) and
            // debate (`dual-pip`) paths still set it explicitly, and the
            // renderer reads it to pick a draw path. Only the implicit roll
            // is gone.
            // The exception: MoO2's cinematic footage plays full-screen.
            // It is moving, finished video rather than an archive still,
            // and the owner asked for it full-frame. Plates and archive
            // composites stay in the monitor, for the reason above.
            mode: opts.mode || (scene.cinematic ? 'full' : 'pip'),
            label: opts.label || scene.label,
            source,
        };
        const chord = chordFor(scene.kind);
        if (typeof GNNAudio !== 'undefined') GNNAudio.playChord(chord);

        const assetInfo = extractSceneAssets(scene);
        const cutawayMeta = {
            kind: kind || scene.kind || 'b-roll',
            recipe: scene.kind || kind || 'composite',
            mode: cutaway.mode,
            source,
            duration: cutaway.duration,
            assets: assetInfo.all.length ? assetInfo.all : [scene.label || kind || 'scene'],
        };
        if (typeof window !== 'undefined' && window.GNNTranscript && window.GNNTranscript.logCutaway) {
            window.GNNTranscript.logCutaway(cutawayMeta);
        }
        console.log(`[GNN Cutaway:RecipeTrace] Subject=${cutawayMeta.kind} Recipe=${cutawayMeta.recipe} Source=${cutawayMeta.source} Mode=${cutawayMeta.mode} Dur=${(cutawayMeta.duration / 1000).toFixed(1)}s Assets=[${cutawayMeta.assets.join(', ')}]`);

        return true;
    }

    function endCutaway() { cutaway = null; }
    function isCutawayActive() { return !!cutaway; }
    /** A cutaway filling the frame, as opposed to the corner box. */
    function isFullCutaway() { return !!(cutaway && cutaway.mode === 'full'); }

    // ---------------------------------------------------------
    // Commercial breaks
    // ---------------------------------------------------------

    /** Pick a visual for a beat, biased toward assets that fit its purpose. */
    function heroPoolFor(kind) {
        // Every one of these draws from an admitted pool, so a shot can never
        // land on an interface screen or a stretched tactical chip.
        //
        // MoO2 archives join each pool now that the extractor measures
        // them and the merge folds them in. The dirs here are the ones
        // whose contents look like the beat they belong to:
        // `INTRO`/`INTRO2` (MoO1) and `LOGO` (MoO2) for the station
        // ident; `LANDING`/`STARVIEW`/`VORTEX` (MoO1) plus (not STARBG — cut-out nebulae),
        // `GSTAR`, `COMBAT` (MoO2) for the hook; `SHIPS`/`SHIPS2`
        // (MoO1) plus `CMBTSHP`, `CMBTFGTR` (MoO2) for the body;
        // `TECHNO`/`BACKGRND` (MoO1) plus `BEAMS`, `BLDG0..4` (MoO2)
        // for the claim; `SPIES`/`EMBASSY`/`COUNCIL` (MoO1) plus
        // `DIPLOMAT`, `RACESEL` (MoO2) for the tag; `BACKGRND`/`INTRO`
        // (MoO1) plus `INSTALL`, `MAINMENU`, `NEWGAME` (MoO2) for
        // legal. A beat with no MoO2 equivalent simply keeps its MoO1
        // list; the query filters by pool and the pool filters by
        // size, so a menu banner never lands as a hook.
        //
        // SPIES and EMBASSY 12-17 are gone from every list. Both
        // are keyed-out overlays — a spy figure or a player-rep on a
        // transparent field — and composited as a background they put
        // a floating cut-out on black. Neither is a picture of a place.
        //
        // Every list is wider than it was. The first version drew each
        // beat from two or three archives, so every commercial break
        // reused the same handful of backgrounds.
        // Rebuilt from a contact sheet of the whole broll pool, measured per
        // beat after the deny list. The previous lists named a lot of
        // archives and drew from very few: `claim` could reach exactly 2
        // images (both the TECHNO lab console), `legal` 4, and every `tag`
        // was a nebula — while 30 MoO2 planet-surface landscapes and 10
        // planet spheres sat admitted to the pool with no beat naming them.
        //
        // UI archives are left out of these lists altogether: INSTALL,
        // MAINMENU, NEWGAME, CONFIRM, BUFFER0, DESIGN, DIPLOMAT, RACESEL,
        // COUNCIL. None of them contributed an item — the pool gate already
        // excluded them — but naming a menu archive in a footage list is an
        // invitation for the next classifier change to put a button on air.
        //
        // Every archive below was looked at, not inferred from its name.
        switch (kind) {
            case 'ident':
                // Establishing shots: the station coming on air.
                return GNNAssets.find({
                    pool: 'broll',
                    dirs: ['INTRO', 'STARVIEW']
                });
            case 'hook':
                // "Deep space is not forgiving." Drama and distance.
                return GNNAssets.find({
                    pool: 'broll',
                    dirs: ['LANDING', 'STARVIEW', 'PLANETS'],
                    minLum: 24
                });
            case 'body':
                return GNNAssets.find({
                    pool: 'sprite',
                    // Not FLEET: MoO2's FLEET archive is leader portraits
                    // and fleet-screen buttons, not ships (contact sheet).
                    dirs: ['SHIPS', 'SHIPS2', 'CMBTSHP', 'CMBTFGTR',
                        'CMBTMISL', 'FLTICONS'],
                    minW: 30
                });
            case 'claim':
                // Specifications, certification, "field-proven at Antares":
                // places where something is built or tested.
                return GNNAssets.find({
                    pool: 'broll',
                    // No CMBTPLNT: a lone planet sphere, blown up to fill
                    // the frame, is too low-res to carry a shot.
                    dirs: ['TECHNO', 'WINLOSE', 'PLANETS', 'LANDING']
                });
            case 'tag':
                // The brand's closing hero shot.
                return GNNAssets.find({
                    pool: 'broll',
                    dirs: ['STARVIEW', 'LANDING']
                });
            case 'legal':
                // Small print over something calm enough to read it on.
                return GNNAssets.find({
                    pool: 'broll',
                    dirs: ['INTRO', 'STARVIEW', 'PLANETS']
                });
            default:
                return GNNAssets.find({ pool: 'broll' });
        }
    }

    // A list means: the first plate that exists. New plates, prompted in
    // Prompts/Infomercial_Backdrop_prompts.md, come first; the plate the
    // spot used before stays behind them until the new art is generated.
    const P = 'assets/generated/infomercials/';
    const INFOMERCIAL_SCENES = {
        'Ocean World Timeshare': [P + 'ocean_villa_interior.png', P + 'real_estate_vista.png'],
        'Interspecies Companionship Registry': [P + 'companionship_lounge.png'],
        // `cybernetic_clinic.png` came back from generation as a finance
        // office with charts on the wall — right for the debt ad, wrong for
        // the joint replacement one.
        'Interstellar Debt Consolidation': [P + 'debt_relief_office.png', P + 'cybernetic_clinic.png'],
        'Cryosleep Injury Claims': [P + 'cryosleep_bay.png'],
        'Learn to Pilot From Home': [P + 'flight_simulator_cockpit.png'],
        'Final Expense Life Cover for Spacers': [P + 'orbital_memorial_chapel.png'],
        'Precious Metals Buy-Back Programme': [P + 'gold_exchange_counter.png'],
        'Cybernetic Joint Replacement': [P + 'supplement_lab.png'],
        // Shop products grouped onto three new sets by what they are.
        'Klackon Queen Amber Brooch': [P + 'galaxy_shop_jewellery.png', P + 'galaxy_shop_pedestal.png'],
        'Chronowatch Navigator Edition': [P + 'galaxy_shop_jewellery.png'],
        'Orion Executive Chrono-Timepiece': [P + 'galaxy_shop_jewellery.png'],
        'Mrrshan Ceremonial Claw Sheaths': [P + 'galaxy_shop_jewellery.png'],
        'Thermal Survival Envelope': [P + 'galaxy_shop_expedition.png'],
        'Darlok Shadow-Weave Cloak': [P + 'galaxy_shop_expedition.png'],
        'Tachyon Standard Energy Cell': [P + 'galaxy_shop_expedition.png'],
        'Sakkra Heated Basking Stone': [P + 'galaxy_shop_home.png'],
        'Alkari Sky-Glass Wind Chimes': [P + 'galaxy_shop_home.png'],
        'Silicoid Geode Desk Companion': [P + 'galaxy_shop_home.png'],
        'Bulrathi Heirloom Grooming Comb': [P + 'galaxy_shop_home.png'],
        'Klackon Hive-Built Storage Lattice': [P + 'galaxy_shop_home.png'],
        'Class-3 Tachyon Deflector Coil': 'assets/generated/infomercials/galaxy_shop_stage.png',
        'Silicoid Crystalline Exfoliating Balm': 'assets/generated/infomercials/galaxy_shop_pedestal.png',
        'Alkari Feather-Gloss & Preen Serum': 'assets/generated/infomercials/galaxy_shop_stage.png',
        'Mrrshan Velocity Hunting Optics': [P + 'galaxy_shop_expedition.png', P + 'galaxy_shop_stage.png'],
        'Zortrium Exposure Class Action': [P + 'zortrium_mine_shaft.png', P + 'legal_office.png'],
        'Antares IV Bio-Dome Crater Estates': P + 'real_estate_vista.png',
        'Psilon Synaptic Neuro-Elixir': P + 'supplement_lab.png',
        'Long-Haul Certification Programme': [P + 'freight_cargo_dock.png', P + 'shipyard_showroom.png'],
        'Executive Presence Masterclass': [P + 'executive_seminar_hall.png', P + 'legal_office.png'],
        'At-Home Hull Patch Kit': [P + 'hull_breach_corridor.png', P + 'shipyard_showroom.png'],
    };

    // Product stills, one per script-writer product name. Each maps the
    // spoken product to a file in `assets/generated/products/`. A product
    // with no entry shows the stage with no hero item — which is what the
    // Zortrium legal notice wants, and what the Mrrshan optics segment
    // does until its image exists.
    //
    // The filenames on disk do not always match the product name. The
    // most misleading is `zortrium_supplement.png`, which is a cognitive
    // supplement bottle — the Psilon product — not the Zortrium legal
    // segment. The prompt file says so: "Featured on: Overnight
    // Infomercials — Miracle Psilon Cognitive Supplements segment".
    // The pairing below is what the prompts actually produced.
    //
    // Unused files in `products/` (luxury_chronowatch.png,
    // luxury_chronowatch_02.png, space_yacht_model.png,
    // tachyon_energy_cell.png) are QVC products that do not yet have a
    // script entry in `galaxyShop()`. They will render the moment a
    // matching product name is added to that pool.
    const PRODUCT_IMAGES = {
        // QVC
        'Klackon Queen Amber Brooch':
            'assets/generated/products/klackon_amber_brooch.png',
        'Class-3 Tachyon Deflector Coil':
            'assets/generated/products/tachyon_deflector_coil.png',
        'Silicoid Crystalline Exfoliating Balm':
            'assets/generated/products/silicoid_exfoliating_balm.png',
        'Alkari Feather-Gloss & Preen Serum':
            'assets/generated/products/alkari_preen_serum.png',
        'Mrrshan Velocity Hunting Optics':
            'assets/generated/products/mrrshan_hunting_optics.png',
        'Orion Executive Chrono-Timepiece':
            'assets/generated/products/luxury_chronowatch.png',
        'Chronowatch Navigator Edition':
            'assets/generated/products/luxury_chronowatch_02.png',
        'Celeste-Class Personal Yacht':
            'assets/generated/products/space_yacht_model.png',
        'Tachyon Standard Energy Cell':
            'assets/generated/products/tachyon_energy_cell.png',
        // Added with the expanded shop rotation. Prompts for each are in
        // assets/generated/Prompts/Product_Stills_prompts.md under these
        // exact filenames; until a file exists, `buildShot` uses the
        // showroom only for the opening shot rather than showing an empty
        // pedestal while the announcer describes what is not on it.
        'Bulrathi Heirloom Grooming Comb':
            'assets/generated/products/bulrathi_grooming_comb.png',
        'Refurbished Meklar Servo-Arm':
            'assets/generated/products/meklar_servo_arm.png',
        'Sakkra Heated Basking Stone':
            'assets/generated/products/sakkra_basking_stone.png',
        'Psilon Pocket Probability Engine':
            'assets/generated/products/psilon_probability_engine.png',
        'Darlok Shadow-Weave Cloak':
            'assets/generated/products/darlok_shadow_cloak.png',
        'Alkari Sky-Glass Wind Chimes':
            'assets/generated/products/alkari_wind_chimes.png',
        'Thermal Survival Envelope':
            'assets/generated/products/thermal_survival_envelope.png',
        'Silicoid Geode Desk Companion':
            'assets/generated/products/silicoid_geode.png',
        'Klackon Hive-Built Storage Lattice':
            'assets/generated/products/klackon_storage_lattice.png',
        'Decommissioned Navigation Computer':
            'assets/generated/products/navigation_computer.png',
        'Mrrshan Ceremonial Claw Sheaths':
            'assets/generated/products/mrrshan_claw_sheaths.png',
        'GNN Anniversary Commemorative Beacon':
            'assets/generated/products/gnn_commemorative_beacon.png',
        // Infomercial product heroes. Zortrium is intentionally absent —
        // legal notice, no product shot. So is the Antares IV crater
        // estate: the vista plate *is* the product, and a scale-model
        // dome pasted over the middle of it read as clutter (owner, after
        // watching it). A place is sold by showing the place.
        'Psilon Synaptic Neuro-Elixir':
            'assets/generated/products/zortrium_supplement.png',
        // Matched by eye from the stills on hand, each checked composited
        // on its stage. Spots left out have nothing that reads as their
        // product (debt, companionship, pilot school, the class actions)
        // or, like the two resorts, are better as the place alone.
        'Cybernetic Joint Replacement':
            'assets/generated/products/meklar_servo_arm.png',
        'Final Expense Life Cover for Spacers':
            'assets/generated/products/gnn_commemorative_beacon.png',
        'Precious Metals Buy-Back Programme':
            'assets/generated/products/luxury_chronowatch.png',
        'At-Home Hull Patch Kit':
            'assets/generated/products/thermal_survival_envelope.png',
        // Sponsors. Betelgeuse's three medicines all take the pill bottle.
        'Jump-Sickness Relief Tablets':
            'assets/generated/products/zortrium_supplement.png',
        'Cryosleep Recovery Tonic':
            'assets/generated/products/zortrium_supplement.png',
        'Radiation Shield Supplement':
            'assets/generated/products/zortrium_supplement.png',
        'Starlance Jump Drive':
            'assets/generated/products/tachyon_energy_cell.png',
        'Mark Four Warp Coil':
            'assets/generated/products/tachyon_deflector_coil.png',
        'Quiet-Run Navigation Core':
            'assets/generated/products/navigation_computer.png',
    };

    // Where the product sits on the stage plate. The two QVC stages are
    // different rooms — one a close-up of a single pedestal, the other a
    // wide set with a display table — so the slot is per-plate rather
    // than per-product. As fractions of the 1280x720 plate.
    //
    // The rect is a bounding box: the product is fit inside it without
    // distortion, centred across it and standing on its bottom edge — so the
    // bottom of a slot is the surface the product sits on, and that is the
    // line to measure.
    //
    // Every value is read off its plate. To check one, composite every
    // product on the stage it airs on and look: a slot whose bottom edge is
    // not the surface makes every product on that set float or sink.
    // `legal_office` and `real_estate_vista` carry no product today.
    const PRODUCT_SLOT = {
        // QVC stages — measured from the plates.
        'assets/generated/infomercials/galaxy_shop_pedestal.png':
            { x: 0.40, y: 0.28, w: 0.20, h: 0.32 },
        // The three themed shop sets, measured off the plates (2026-10-18):
        // the bottom edge is the middle of each pedestal's top face — the
        // velvet drum, the rock, the wooden drum. They had been estimates
        // made before the art existed, and every product hovered.
        'assets/generated/infomercials/galaxy_shop_jewellery.png':
            { x: 0.39, y: 0.365, w: 0.22, h: 0.30 },
        'assets/generated/infomercials/galaxy_shop_expedition.png':
            { x: 0.38, y: 0.31, w: 0.24, h: 0.32 },
        'assets/generated/infomercials/galaxy_shop_home.png':
            { x: 0.39, y: 0.34, w: 0.22, h: 0.30 },
        'assets/generated/infomercials/galaxy_shop_stage.png':
            { x: 0.340, y: 0.255, w: 0.245, h: 0.290 },

        // Infomercial stages — estimates. Nudge after seeing one shot.
        'assets/generated/infomercials/legal_office.png':
            { x: 0.40, y: 0.34, w: 0.20, h: 0.24 },
        // Measured from mock composites: the product's base on the counter
        // or console top. The lab slot was too small for anything but a
        // squat bottle.
        'assets/generated/infomercials/supplement_lab.png':
            { x: 0.39, y: 0.25, w: 0.22, h: 0.33 },
        'assets/generated/infomercials/pharmacy_med_bay.png':
            { x: 0.385, y: 0.31, w: 0.19, h: 0.30 },
        'assets/generated/infomercials/hyperspace_bridge.png':
            { x: 0.41, y: 0.36, w: 0.18, h: 0.22 },
        'assets/generated/infomercials/orbital_memorial_chapel.png':
            { x: 0.455, y: 0.34, w: 0.09, h: 0.23 },
        'assets/generated/infomercials/gold_exchange_counter.png':
            { x: 0.555, y: 0.315, w: 0.09, h: 0.19 },
        'assets/generated/infomercials/hull_breach_corridor.png':
            { x: 0.40, y: 0.52, w: 0.12, h: 0.26 },
        'assets/generated/infomercials/real_estate_vista.png':
            { x: 0.38, y: 0.34, w: 0.24, h: 0.28 },
        // The shipyard showroom draws a ship sprite from the archive
        // rather than a product still — the two scripts that route here
        // (Long-Haul Certification, At-Home Hull Patch Kit) are not
        // ships. See SHIPYARD_STAGE and pickShipForStage below. The
        // slot is where the hull sits on the pad; tune it in
        // tools/commercial_review.html the same way as any other stage.
        'assets/generated/infomercials/shipyard_showroom.png':
            { x: 0.360, y: 0.280, w: 0.280, h: 0.320 },
    };

    /**
     * Composite a product onto its stage plate and return the result as a
     * canvas ready to hand to the scene builder.
     *
     * The product is fit inside the slot with its aspect ratio preserved
     * and is centered in it. It is *not* blended with the stage or tinted
     * — a product still is a finished render, and the current QVC brief
     * asks for a photographic product on a painted set. A subtle soft
     * shadow is drawn under the product's footprint so it reads as
     * sitting on the surface rather than floating in front of it; the
     * shadow is a radial gradient, not a solid ellipse, so it blends
     * into whatever the surface already had.
     *
     * The canvas is the same size as the stage plate. This is what lets
     * the renderer draw the composite at 1:1 with no resampling at the
     * usual frame size; a canvas built at the slot's size and drawn up
     * would alias the product edges.
     *
     * @returns {HTMLCanvasElement}
     */
    function compositeProduct(stageImg, productImg, slot) {
        const canvas = document.createElement('canvas');
        canvas.width = stageImg.naturalWidth || stageImg.width;
        canvas.height = stageImg.naturalHeight || stageImg.height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(stageImg, 0, 0);

        const sx = slot.x * canvas.width;
        const sy = slot.y * canvas.height;
        const sw = slot.w * canvas.width;
        const sh = slot.h * canvas.height;

        const pw_img = productImg.naturalWidth || productImg.width;
        const ph_img = productImg.naturalHeight || productImg.height;
        if (!pw_img || !ph_img) return canvas;

        // Fit the product inside the slot without distortion. `Math.min`
        // letterboxes; the alternatives are `Math.max`, which crops the
        // product, or no fit at all, which stretches it.
        const s = Math.min(sw / pw_img, sh / ph_img);
        const pw = pw_img * s;
        const ph = ph_img * s;
        const px = sx + (sw - pw) / 2;
        // Stood on the slot's bottom edge, not centred in it. Centred, a wide
        // or short product left a gap under itself and hovered over the
        // pedestal (owner: products "not lining up" with the sets).
        const py = sy + sh - ph;

        // A soft radial shadow under the product's base. Composited with
        // `multiply` so it darkens whatever is under it without
        // occluding it; a straight alpha fill would sit on top of the
        // surface as a grey disc.
        const shadowCx = px + pw / 2;
        const shadowCy = py + ph - ph * 0.03;
        const shadowRx = pw * 0.55;
        const shadowRy = ph * 0.07;
        const grad = ctx.createRadialGradient(
            shadowCx, shadowCy, 0, shadowCx, shadowCy, shadowRx);
        grad.addColorStop(0, 'rgba(0,0,0,0.45)');
        grad.addColorStop(0.7, 'rgba(0,0,0,0.18)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.translate(shadowCx, shadowCy);
        ctx.scale(1, shadowRy / shadowRx);
        ctx.translate(-shadowCx, -shadowCy);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(shadowCx, shadowCy, shadowRx, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.drawImage(productImg, px, py, pw, ph);
        return canvas;
    }

    // The shipyard showroom stage. When a commercial shot lands here,
    // instead of compositing a product still it composites a ship
    // sprite drawn from the archive — the two products routed to this
    // stage do not have product images and are not ships, so the
    // pedestal would be empty without this.
    const SHIPYARD_STAGE =
        'assets/generated/infomercials/shipyard_showroom.png';

    /**
     * A ship sprite to put on the shipyard pad.
     *
     * Draws from the same pool the commercial `body` beat draws from —
     * MoO1 and MoO2 combat hulls and fighters — but smaller. The body
     * beat wants something that reads as a fleet ship in a wide shot;
     * this wants something that reads as a specific hull on a display
     * pad. The size cap keeps the biggest capital-ship renders from
     * overwhelming the pedestal.
     *
     * The deny list is applied on top of the pool query. A ship that
     * has been flagged in `scene_review.html` will not appear here
     * either.
     *
     * Returns the entry, or null when the pool is empty.
     */
    function pickShipForStage() {
        const pool = GNNAssets.find({
            pool: 'sprite',
            dirs: ['SHIPS', 'SHIPS2', 'CMBTSHP', 'CMBTFGTR'],
            minW: 30, maxW: 200,
        }).filter((e) => !GNNSceneCompositor.isDenied(e.id));
        if (!pool.length) return null;
        return pool[(Math.random() * pool.length) | 0];
    }

    /**
     * Longest animation in a scene, in milliseconds, less any `offset`.
     *
     * A commercial shot should hold for at least as long as its own
     * animation takes to finish. The previous version held every shot
     * for a fixed 4200 ms, so any animation longer than that reached
     * its last frame and started over with the voice-over still
     * running. This is the fault the viewer reported as "the scene
     * reloads mid-read".
     */
    function sceneAnimationMs(scene) {
        if (!scene || !Array.isArray(scene.layers)) return 0;
        let longest = 0;
        for (const layer of scene.layers) {
            if (!layer || !layer.frames || !layer.fps) continue;
            if (layer.frames.length <= 1) continue;
            // A layer started part-way in (`offset`, seconds) has that much
            // less to play.
            const ms = (layer.frames.length / layer.fps - (layer.offset || 0)) * 1000;
            if (ms > longest) longest = ms;
        }
        return longest;
    }

    /**
     * Build one shot of a commercial break.
     *
     * Plate-bearing beats (`hook`, `body`, `claim` on a QVC or
     * infomercial script) load the stage plate, composite the product
     * onto it when one is available, and hand the composite to the
     * scene builder. Every piece of that is logged — which stage
     * loaded, which product loaded, whether a composite was built and
     * whether the scene came out — so a break that shows an empty
     * pedestal is one log line away from naming the file that failed
     * to resolve.
     *
     * The scene object is built here rather than through
     * `GNNSceneCompositor.single()`, because `single()` routes through
     * `makeLayer()`, which tests for `naturalWidth` on the entry's
     * image — and a canvas element has no `naturalWidth` property. The
     * object below is the same shape `single()` returns for a preloaded
     * image; nothing else in the pipeline needs to know it was assembled
     * differently.
     *
     * Beats that are not plate-bearing — the ident, the tag and the
     * legal card — deliberately do not query a plate. They open and close
     * the break on station branding, and a MOO1 backdrop is what the
     * brief asked for on those beats. A `[GNN Commercial:Plate]` line
     * on one of them would be a bug; the absence of one on a `hook`,
     * `body` or `claim` beat is the signal that the beat fell through.
     */
    // Show emblems from assets/generated/logos/. They were generated, sat on
    // disk, and were drawn nowhere: `titlecards/` (the full-frame cards the
    // boot sequence shows) is a different set, which is easy to miss
    // because the two share filenames.
    const LOGO_DIR = 'assets/generated/logos/';

    const SPONSOR_DIR = 'assets/generated/sponsors/';
    const TESTIMONIAL_DIR = 'assets/generated/testimonials/';

    /** The emblem this shot should carry, or null. */
    function logoFor(beat, script) {
        if (!script) return null;
        // A named sponsor, and the law firm, close on their own crest.
        if (script.logo && script.kind !== 'promo' && beat.kind === 'tag') {
            return SPONSOR_DIR + script.logo;
        }
        // A promo shows its own programme on the body and the sign-off.
        if (script.kind === 'promo' && script.logo
            && (beat.kind === 'body' || beat.kind === 'tag')) {
            return LOGO_DIR + script.logo;
        }
        // Every shop spot is sold on the Galaxy Shop segment whatever the
        // vendor, so the segment's emblem closes it.
        if (script.isQVC && beat.kind === 'tag') {
            return LOGO_DIR + 'galaxy_shop.png';
        }
        return null;
    }

    /**
     * The shot's footage, dimmed, with an emblem centred over it.
     *
     * Placed at the emblem's own aspect ratio — a layer `rect` stretches to
     * whatever it is given — and at a little over half the frame height,
     * which keeps it clear of the card text at the top and bottom.
     * Returns a new scene; the one passed in may be shared.
     */
    /**
     * A satisfied customer, standing beside the claim they are vouching
     * for. The infomercial's own plate stays full brightness behind them;
     * the portrait sits lower-left at most of the frame's height, the way
     * a testimonial is framed on a real paid-programming set.
     */
    function withTestimonial(scene, img) {
        const BW = GNNSceneCompositor.BASE_W || 320;
        const BH = GNNSceneCompositor.BASE_H || 180;
        const h = 0.66;
        const w = h * BH * (img.width / Math.max(1, img.height)) / BW;
        const face = {
            entry: null, frames: [img], fps: 0, motion: 'still',
            params: {}, blend: 'source-over', alpha: 1, fit: 'contain',
            rect: { x: 0.04, y: 1 - h - 0.13, w, h }, offset: 0,
        };
        return Object.assign({}, scene, { layers: (scene.layers || []).concat([face]) });
    }

    function withLogo(scene, img) {
        // A third of the frame high, centred. The logos are conditioned to
        // 256 px; at 56% of the frame they were drawn well past their own
        // resolution and looked soft and blocky. Drawn as a full-resolution
        // overlay (drawOverlays), not a compositor layer.
        const h = 0.34;
        const aspect = (img.width / Math.max(1, img.height)) * (9 / 16);
        const w = Math.min(0.6, h * aspect);
        const hh = w < h * aspect ? w / aspect : h;
        const logo = { img, rect: { x: (1 - w) / 2, y: (1 - hh) / 2 - 0.04, w, h: hh } };
        return Object.assign({}, scene, {
            layers: (scene.layers || []).map((l) =>
                Object.assign({}, l, { alpha: (l.alpha === undefined ? 1 : l.alpha) * 0.55 })),
            overlays: (scene.overlays || []).concat([logo]),
        });
    }

    /**
     * The stage plates a spot may use, best first. A spot's own `stage`
     * (the named sponsors set one) wins; then its INFOMERCIAL_SCENES entry,
     * which may be a list — a newly prompted plate first, the plate it
     * used before after it — so a prompt can be wired in before its art is
     * generated and the spot keeps its old picture until the file lands.
     */
    function stageCandidates(script) {
        if (!script) return [];
        const v = script.stage || INFOMERCIAL_SCENES[script.product];
        const list = Array.isArray(v) ? v.slice() : (v ? [v] : []);
        if (script.isQVC) list.push('assets/generated/infomercials/galaxy_shop_stage.png');
        else if (script.isInfomercial) list.push('assets/generated/infomercials/legal_office.png');
        return list;
    }

    async function loadStage(script) {
        for (const url of stageCandidates(script)) {
            const img = await GNNAssets.loadImage(url);
            if (img) return { url, img };
        }
        return null;
    }

    // The MoO1 research lab console (TECHNO item 01, monitor blank) and the
    // monitor's rectangle in it, measured as the largest black region: 116
    // by 76 pixels at (147, 55) — the size of the forty schematics, which
    // were drawn for exactly that screen.
    const LAB_CONSOLE = 'TECHNO/item_01';
    const LAB_CONSOLE_LIT = 'TECHNO/item_00';
    const LAB_SCREEN = { x: 147, y: 55, w: 116, h: 76 };

    /** The console with a blueprint on its monitor, as a canvas. */
    function consoleWithSchematic(consoleImg, schematicImg) {
        const c = document.createElement('canvas');
        c.width = consoleImg.naturalWidth || consoleImg.width;
        c.height = consoleImg.naturalHeight || consoleImg.height;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = false;
        g.drawImage(consoleImg, 0, 0);
        const sw = schematicImg.naturalWidth || schematicImg.width;
        const sh = schematicImg.naturalHeight || schematicImg.height;
        const k = Math.min(LAB_SCREEN.w / sw, LAB_SCREEN.h / sh, 1);
        const w = Math.round(sw * k), h = Math.round(sh * k);
        g.drawImage(schematicImg,
            LAB_SCREEN.x + Math.round((LAB_SCREEN.w - w) / 2),
            LAB_SCREEN.y + Math.round((LAB_SCREEN.h - h) / 2), w, h);
        return c;
    }

    async function researchScene(beat, script) {
        const pick = beat.kind === 'hook' ? LAB_CONSOLE_LIT : LAB_CONSOLE;
        const entry = GNNAssets.get(pick);
        const consoleImg = entry ? await GNNAssets.loadImage(GNNAssets.framePath(entry, 0)) : null;
        if (!consoleImg) return null;
        let frame = consoleImg;
        if (beat.kind !== 'hook') {
            const sEntry = GNNAssets.get(script.schematic);
            const sImg = sEntry ? await GNNAssets.loadImage(GNNAssets.framePath(sEntry, 0)) : null;
            if (sImg) frame = consoleWithSchematic(consoleImg, sImg);
        }
        // Through the compositor like any other archive picture: it is
        // 320x200 pixel art and wants nearest-neighbour, not a smooth blow-up.
        return {
            kind: 'single', label: script.brand,
            layers: [{
                entry: null, frames: [frame], fps: 0, motion: 'still', params: {},
                blend: 'source-over', alpha: 1, fit: 'cover', rect: null, offset: 0,
            }],
            duration: 4000,
        };
    }

    // ---------------------------------------------------------
    // Commercial looks
    // ---------------------------------------------------------
    //
    // Owner: the generated plates look best and should carry the breaks;
    // MoO footage after that; archive stills and backgrounds rarely, as a
    // throwback — they read better in the little monitor than full-frame.
    // Each spot rolls its look once, so a spot is consistent within itself.
    // Spots with their own stage (infomercials, sponsors, the shop) keep
    // it for their product shots whatever the look; the look decides the
    // rest of their shots and the whole of a procedural spot.
    // `?commercials=plate|footage|archive` forces one, for review.
    // Archive raised from 10% (owner: an hour without one MoO spot; wanted
    // 15–20%, "not too common").
    const LOOK_SHARES = { plate: 0.57, footage: 0.23, archive: 0.20 };
    const LOOK_FORCED = (() => {
        if (typeof window === 'undefined' || !window.location) return null;
        const m = String(window.location.search || '').match(/[?&]commercials=(plate|footage|archive)\b/);
        return m ? m[1] : null;
    })();
    function rollLook() {
        if (LOOK_FORCED) return LOOK_FORCED;
        const r = Math.random();
        if (r < LOOK_SHARES.plate) return 'plate';
        if (r < LOOK_SHARES.plate + LOOK_SHARES.footage) return 'footage';
        return 'archive';
    }

    // Stages for a spot with no set of its own — in practice the procedural
    // generator, which sells hardware: hulls, reactors, shields, drives.
    // Only showrooms and working spaces. This used to be every infomercial
    // plate, and the themed ones belong to one spot each: a deflector
    // shield was sold in the memorial chapel (owner), and the same roll
    // could put one in the debt office, the cryosleep bay or a beach villa.
    const IP = 'assets/generated/infomercials/';
    const GENERIC_STAGES = [
        'galaxy_shop_stage', 'galaxy_shop_pedestal', 'shipyard_showroom',
        'freight_cargo_dock', 'hull_breach_corridor', 'zortrium_mine_shaft',
        'foundry_floor', 'hyperspace_bridge',
    ].map((n) => IP + n + '.png');
    // Calm full-bleed art for the opening, logo and legal shots: the window
    // backdrops and the space cutaways (no people, nothing story-specific).
    const GB = 'assets/generated/backdrops/';
    const GC = 'assets/generated/cutaways/';
    const CALM_PLATES = [
        ...['asteroid_field', 'colony_domes', 'earth_globe', 'orion_shipyard']
            .flatMap((n) => ['dawn', 'day', 'dusk', 'night'].map((t) => GB + n + '_' + t + '.png')),
        ...['black_hole', 'black_hole_02', 'space_vortex', 'space_vortex_02', 'space_vortex_03',
            'solar_flare', 'solar_flare_02', 'station_trade', 'station_trade_02',
            'asteroid_mining', 'asteroid_mining_02'].map((n) => GC + n + '.png'),
    ];

    // The MoO1 intro scenes the archive look is remembered for, loaded
    // whole: `makeLayer` stops at 60 frames by default, and the battery's
    // shot leaves the barrel at frames 53–61 of 70. INTRO2/item_00 opens on
    // ten black frames (why the deny list keeps it out of random picks), so
    // it starts past them; `get()` reads by id and is not denied.
    // `fps` slows the two short scenes so they fill a typical line rather
    // than sitting on their last frame: thirty frames at the default 12 fps
    // ran 2.5 s under a 4 s line (breakcheck "frozen tails"). `offset` is in
    // seconds of the clip's own time.
    const ARCHIVE_ANIMATIONS = [
        { id: 'INTRO/item_02' },                          // missile battery turns and fires
        { id: 'INTRO2/item_00', fps: 8, offset: 1.2 },    // the fleet, and the green blast
        { id: 'INTRO/item_01', fps: 8 },                  // ships over a burning world
    ];
    const ARCHIVE_ANIM_BEATS = new Set(['ident', 'hook', 'body', 'tag']);

    async function archiveAnimation(label) {
        const a = ARCHIVE_ANIMATIONS[(Math.random() * ARCHIVE_ANIMATIONS.length) | 0];
        const entry = GNNAssets.get(a.id);
        if (!entry) return null;
        return GNNSceneCompositor.single(entry, {
            fit: 'cover', label, maxFrames: entry.frames, offset: a.offset || 0,
            ...(a.fps ? { fps: a.fps } : {}),
        });
    }

    async function firstLoaded(list, tries = 5) {
        for (let i = 0; i < tries; i++) {
            const url = list[(Math.random() * list.length) | 0];
            const img = await GNNAssets.loadImage(url);
            if (img) return { url, img };
        }
        return null;
    }

    function plateScene(img, label, dim) {
        return {
            kind: 'single', label,
            layers: [{
                entry: null, frames: [img], fps: 0, motion: 'still', params: {},
                blend: 'source-over', alpha: dim ? 0.6 : 1, fit: 'cover', rect: null, offset: 0,
            }],
            duration: 4000, generated: true,
        };
    }

    /** A generated plate for this shot: the spot's stage, or calm art. */
    async function generatedShot(beat, script) {
        const product = beat.kind === 'hook' || beat.kind === 'body' || beat.kind === 'claim';
        if (product) {
            // One stage for the whole spot, picked the first time it is needed.
            if (!script._stage) {
                const got = await firstLoaded(GENERIC_STAGES, 8);
                script._stage = got ? got.url : null;
            }
            const img = script._stage ? await GNNAssets.loadImage(script._stage) : null;
            return img ? plateScene(img, script.brand, false) : null;
        }
        const got = await firstLoaded(CALM_PLATES, 6);
        return got ? plateScene(got.img, script && script.brand, beat.kind === 'legal') : null;
    }

    /** Moving MoO2 footage for this shot, about eight seconds of continuous motion. */
    async function footageShot(beat) {
        const kinds = beat.kind === 'body' ? ['convoy', 'tactical']
            : ['convoy', 'survey', 'deepfield', 'anomaly'];
        const kind = kinds[(Math.random() * kinds.length) | 0];
        const scene = await cinematicScene(kind, 60);
        if (scene) scene.kind = 'single';
        return scene;
    }

    async function buildShot(beat, script) {
        let scene = null;
        // A show promo airs the show's own title card — the set, the two
        // anchors, the name — on every shot but the break's ident.
        if (script && script.titlecard && beat.kind !== 'ident') {
            const card = await GNNAssets.loadImage(script.titlecard);
            if (card) scene = plateScene(card, script.product, false);
        }
        // The recruitment spot's body shot is a six-second ground battle.
        if (script && script.groundWar && beat.kind === 'body'
            && GNNSceneCompositor.groundWar) {
            scene = await GNNSceneCompositor.groundWar(6);
        }
        if (!scene && script && script.isResearch
            && (beat.kind === 'hook' || beat.kind === 'body' || beat.kind === 'claim')) {
            scene = await researchScene(beat, script);
        }
        let plateBearing = !scene && !!(script && (script.isQVC || script.isInfomercial || script.stage)
            && (beat.kind === 'body' || beat.kind === 'claim' || beat.kind === 'hook'));
        // A shop product whose still has not been generated yet would put an
        // empty pedestal on screen for three shots running. Keep the
        // showroom as the opening shot — an empty set is a fine
        // establishing shot — and let the body and claim fall through to
        // ordinary footage until the art exists.
        if (plateBearing && script.isQVC && beat.kind !== 'hook'
            && stageCandidates(script)[0] !== SHIPYARD_STAGE) {
            const url = script.productImage || PRODUCT_IMAGES[script.product];
            const still = url ? await GNNAssets.loadImage(url) : null;
            if (!still) plateBearing = false;
        }
        if (plateBearing) {
            const stage = await loadStage(script);
            const plateUrl = stage ? stage.url : stageCandidates(script)[0];
            const stageImg = stage ? stage.img : null;
            if (stageImg) {
                // Two paths from here. The shipyard showroom composites
                // a ship sprite drawn from the archive; every other
                // plate composites a product still. The two share the
                // same composite helper, the same slot table, and the
                // same log shape — only the source of the hero image
                // differs.
                const slot = PRODUCT_SLOT[plateUrl];
                let finalImg = stageImg;
                let composited = false;
                let heroSource = '—';
                let heroLoaded = false;

                if (plateUrl === SHIPYARD_STAGE) {
                    const shipEntry = pickShipForStage();
                    const shipImg = shipEntry
                        ? await GNNAssets.loadImage(
                            GNNAssets.framePath(shipEntry,
                                shipEntry.hero || 0))
                        : null;
                    heroSource = shipEntry ? shipEntry.id : '—';
                    heroLoaded = !!shipImg;
                    if (shipImg && slot) {
                        try {
                            finalImg = compositeProduct(stageImg, shipImg, slot);
                            composited = true;
                        } catch (err) {
                            console.warn('[GNN Commercial:Plate] ship '
                                + 'composite failed:',
                                err && err.message ? err.message : err);
                            finalImg = stageImg;
                        }
                    }
                } else {
                    // A spot may carry its own picture (the salvage auction's
                    // APP_PICS lots); otherwise the product table.
                    const productUrl = script.productImage || PRODUCT_IMAGES[script.product];
                    const productImg = productUrl
                        ? await GNNAssets.loadImage(productUrl) : null;
                    heroSource = productUrl || '—';
                    heroLoaded = !!productImg;
                    if (productImg && slot) {
                        try {
                            finalImg = compositeProduct(stageImg, productImg, slot);
                            composited = true;
                        } catch (err) {
                            console.warn('[GNN Commercial:Plate] composite '
                                + 'failed:', err && err.message ? err.message : err);
                            finalImg = stageImg;
                        }
                    }
                }

                scene = {
                    kind: 'single', label: script.brand,
                    layers: [{
                        entry: null, frames: [finalImg], fps: 0,
                        motion: 'still', params: {},
                        blend: 'source-over', alpha: 1,
                        fit: 'cover', rect: null, offset: 0,
                    }],
                    duration: 4000,
                    // Marks this as a finished plate drawn at native
                    // resolution, the same as `single()` does for a
                    // preloaded image. Without it, `drawScene` would
                    // route the scene through the 320x200 MOO1 buffer
                    // and resample it back up.
                    generated: true,
                };
                console.log(`[GNN Commercial:Plate] beat=${beat.kind} `
                    + `plate=${plateUrl} loaded=true `
                    + `hero=${heroSource} `
                    + `heroLoaded=${heroLoaded} `
                    + `composited=${composited} `
                    + `scene=${scene ? 'ok' : 'null'}`);
            } else if (script.isQVC || script.isInfomercial) {
                // A sponsor's set that has not been generated yet is the
                // expected case, not a fault: it falls back quietly.
                console.warn(`[GNN Commercial:Plate] beat=${beat.kind} `
                    + `plate=${plateUrl} loaded=false — falling back to `
                    + `MOO1 composite`);
            }
        }

        // A shot that will carry an emblem gets calm footage under it — the
        // same planets and nebulae the brand sign-off uses — rather than the
        // beat's usual recipe. The promo body beat otherwise went through
        // the ship-convoy composite, and a blown-up hull sat behind the
        // show's logo fighting it for the frame.
        const emblem = logoFor(beat, script);
        if (!scene && emblem && script && script.look !== 'archive') {
            scene = await generatedShot({ kind: 'tag' }, script);
        }
        if (!scene && emblem) {
            // A planet-and-space view (STARVIEW) behind the emblem: a lone
            // planet sphere, blown up to fill the frame, was too low-res.
            const calm = GNNAssets.pick(GNNAssets.find({ pool: 'broll', dirs: ['STARVIEW'] }))
                || GNNAssets.pick(heroPoolFor('tag'));
            if (calm) {
                scene = await GNNSceneCompositor.single(calm, {
                    fit: 'cover', label: script.brand,
                });
            }
        }

        // "Operators are standing by": every infomercial closes on the
        // call centre, whatever its look.
        if (!scene && script && script.isInfomercial && beat.kind === 'tag') {
            const img = await GNNAssets.loadImage(IP + 'operators_call_centre.png');
            if (img) scene = plateScene(img, script.brand, false);
        }
        // One MoO1 intro animation per archive-look spot, on its first beat
        // that has no stage of its own.
        if (!scene && script && script.look === 'archive' && !script._archiveAnim
            && ARCHIVE_ANIM_BEATS.has(beat.kind)) {
            scene = await archiveAnimation(script.brand);
            if (scene) script._archiveAnim = true;
        }
        if (!scene && script && script.look === 'plate') {
            scene = await generatedShot(beat, script);
        }
        if (!scene && script && script.look === 'footage') {
            scene = await footageShot(beat);
        }
        if (!scene) {
            const entry = GNNAssets.pick(heroPoolFor(beat.kind));
            // The body beat gets a convoy composite so the hull is *in* a
            // place. The claim beat used the industry composite, whose
            // pulsing overlay read as blotches; it takes a clean picture
            // from its own curated pool now.
            if (beat.kind === 'body') {
                scene = await GNNSceneCompositor.synthesize('convoy');
            }
            if (!scene) {
                scene = await GNNSceneCompositor.single(entry, {
                    fit: entry && entry.w >= 240 ? 'cover' : 'contain',
                    label: script.brand,
                });
            }
        }
        if (!scene) return null;
        if (script && script.testimonial && beat.kind === 'claim') {
            const face = await GNNAssets.loadImage(TESTIMONIAL_DIR + script.testimonial);
            if (face) scene = withTestimonial(scene, face);
        }
        const logoUrl = emblem;
        if (logoUrl) {
            const logoImg = await GNNAssets.loadImage(logoUrl);
            if (logoImg) scene = withLogo(scene, logoImg);
        }
        const voiceEst = (beat.text && typeof GNNTTS !== 'undefined' && GNNTTS.estimateMs)
            ? GNNTTS.estimateMs(beat.text) : 3200;
        const baseDuration = beat.kind === 'legal' ? 2600 : Math.max(3800, Math.min(voiceEst + 400, 6000));
        // MoO2 cinematic footage is continuous motion with no payoff, so it
        // cuts while still moving rather than freezing on its last frame.
        // Everything else animated — the MoO1 intro scenes, the ground war —
        // has an ending and plays to it: a missile battery cut at the
        // voice's length was a turret turning, cut off before it fired
        // (owner). The cinematic rule had been applied to every animation
        // (CLAUDE.md §13.5, §14).
        // The small print is the exception: it closes a spot, has no payoff
        // to wait for, and held to a 5 s animation it left the picture up
        // two seconds after the last line (breakcheck, 2026-10-18).
        const animMs = sceneAnimationMs(scene);
        const duration = animMs <= 0 || beat.kind === 'legal' ? baseDuration
            : scene.cinematic ? Math.min(baseDuration, Math.max(2400, animMs - 400))
                : Math.max(baseDuration, animMs + 400);
        return {
            beat, scene, script,
            card: cardFor(beat, script),
            duration,
            maxHold: Math.max(duration * 3, 14000),
            transition: Math.random() < 0.45 ? 'dissolve' : 'cut',
        };
    }

    /** Prosody per beat kind, shared by the warm-up and the actual read. */
    // Commercials are not read by the anchors.
    //
    // They were, because `voiceOptsFor` never named a voice and synthesis
    // fell through to whoever had the chair — so the commander sold you a
    // hull cleaner between stories. A break now picks an announcer of its
    // own and keeps it for every beat, so one advert is one person, and
    // the small print is a different, faster voice the way it is on air.
    //
    // Deliberately excludes am_michael and af_bella, which are Hale and
    // Varr. If the desk cast changes, this list is the thing to update.
    const AD_VOICES = ['bm_george', 'bm_daniel', 'bm_lewis', 'af_heart',
        'bf_emma', 'bf_isabella'];
    const LEGAL_VOICE = 'bm_fable';
    let breakVoice = AD_VOICES[0];

    function pickBreakVoice() {
        const other = AD_VOICES.filter((v) => v !== breakVoice);
        breakVoice = other[(Math.random() * other.length) | 0];
        return breakVoice;
    }

    function voiceOptsFor(beat) {
        // Spots keep their stings closer to the voice than a news read does —
        // a commercial that ducks its own effects hard stops sounding like a
        // commercial.
        return beat.kind === 'legal'
            ? {
                voice: LEGAL_VOICE, rate: 38, pitch: -4,
                duck: 0.5, duckSfx: 0.55
            }
            : {
                // The spot's own announcer when it has one.
                voice: beat.voice || breakVoice, rate: 0,
                pitch: beat.kind === 'tag' ? -4 : -2,
                duck: 0.45, duckSfx: 0.55
            };
    }

    function cardFor(beat, script) {
        // Over a show's title card, only a strap: the card has its own name
        // bar along the bottom, which the caption would cover.
        if (script && script.titlecard && beat.kind !== 'ident') {
            return { top: beat.kind === 'hook' ? 'COMING UP ON GNN' : '', bottom: '' };
        }
        const brand = (script && script.brand) ? script.brand.toUpperCase() : 'GNN';
        const product = (script && script.product) ? String(script.product).toUpperCase() : '';
        switch (beat.kind) {
            case 'ident': return { top: 'A GNN PRESENTATION', bottom: '' };
            case 'hook': return { top: brand, bottom: beat.text.toUpperCase() };
            case 'body': return { top: brand, bottom: product };
            case 'claim': return {
                top: (script && script.testimonial) ? 'A SATISFIED CUSTOMER'
                    : (script && script.isQVC) ? 'EXCLUSIVE SPECIFICATION'
                        : ((script && script.isInfomercial) ? 'TERMS & SETTLEMENT' : 'SPECIFICATION'),
                bottom: beat.text.toUpperCase()
            };
            case 'tag': return { top: brand, bottom: beat.text.split('. ').pop().toUpperCase() };
            case 'legal': return { top: 'LEGAL NOTICE', bottom: beat.text.toUpperCase() };
            default: return { top: '', bottom: '' };
        }
    }

    /**
     * Assemble and start a full commercial break.
     *
     * `opts.kind` names the script to run. When it is not supplied the
     * break rolls between all four shapes, which is what gives a natural
     * break its variety. When it is supplied — as `forceBreak()` in the
     * director does for a manual break — the roll is skipped and the
     * named script is used directly.
     *
     * The chosen kind, brand and product are logged before the script's
     * beats are built, so a report of "the break looked wrong" can be
     * checked against which script was supposed to have played. The
     * per-beat plate and product loads that follow are logged separately
     * by `buildShot()`.
     *
     * @returns {Promise<number>} total break duration in ms
     */
    /** One spot's script: a named kind, or the usual weighted roll. */
    function scriptOfKind(kind) {
        if (kind === 'promo') return GNNScript.promo();
        if (kind === 'qvc' && GNNScript.galaxyShop) return GNNScript.galaxyShop();
        if (kind === 'infomercial' && GNNScript.infomercial) return GNNScript.infomercial();
        if (kind === 'commercial') return GNNScript.commercial();
        if (kind === 'sponsor' && GNNScript.sponsored) return GNNScript.sponsored();
        if (kind === 'research' && GNNScript.researchExchange) return GNNScript.researchExchange();
        if (kind === 'salvage' && GNNScript.orionSalvage) return GNNScript.orionSalvage();
        if (kind === 'ships' && GNNScript.shipDealer) return GNNScript.shipDealer();
        if (kind === 'marines' && GNNScript.marines) return GNNScript.marines();
        const roll = Math.random();
        if (roll < 0.12) return GNNScript.promo();
        if (roll < 0.26 && GNNScript.galaxyShop) return GNNScript.galaxyShop();
        // The Imperial Research Exchange: the TECHNO lab and its blueprints.
        if (roll < 0.34 && GNNScript.researchExchange) return GNNScript.researchExchange();
        // The Orion Salvage Auction: MoO2's 212 APP_PICS as auction lots.
        if (roll < 0.42 && GNNScript.orionSalvage) return GNNScript.orionSalvage();
        // Honest Gnolam's: a different archive hull on the pad every shot.
        // The two rarest spots were raised (7%→10%, 4%→8%), taken from the
        // procedural generator, which was the commonest at 22% (now 15%).
        if (roll < 0.52 && GNNScript.shipDealer) return GNNScript.shipDealer();
        // The Colonial Marine Corps recruits, over the COLGCBT ground war.
        if (roll < 0.60 && GNNScript.marines) return GNNScript.marines();
        if (roll < 0.70 && GNNScript.infomercial) return GNNScript.infomercial();
        // The station's regular sponsors, recognisable by their logos.
        if (roll < 0.85 && GNNScript.sponsored) return GNNScript.sponsored();
        return GNNScript.commercial();
    }

    // Music a break may not use. The MoO2 `*FIN` tracks and `intro` are the
    // cinematics' own soundtracks — narration and effects, cut mid-scene —
    // and the owner heard a voice in a break bed. Add a track id here when
    // `[GNN Commercial:Music]` names one that has words in it.
    const BREAK_BED_DENY = /^moo2_(?:[A-Z]+FIN|intro)$/;

    /**
     * Build a break without starting it: scripts, shots, scenes loaded.
     *
     * Split from `startCommercialBreak` so the director can assemble the
     * break while the anchor is still throwing to it. Assembled after the
     * throw, the studio sat silent for 0.3–3.3 s while a dozen plates (and,
     * on the footage look, sixty frames a shot) loaded.
     *
     * @returns {Promise<object|null>} the prepared break, or null if no shot built
     */
    async function prepareBreak(opts = {}) {
        // A break is a pod of spots, not one advert.
        //
        // It used to be exactly one: a station ident and five beats of a
        // single sponsor, then back to the desk. With 9 shop products, 6
        // infomercials and 4 promos in rotation the same handful came round
        // within the hour, and a "break" was over before it read as one.
        // Two or three spots back to back is what a break on a real channel
        // is.
        //
        // Each spot keeps its own script and its own announcer. `buildShot`
        // already stores the script on the shot, and the card and plate
        // code read `shot.script` before the break's — so a spot's beats
        // draw its own product and brand without anything downstream
        // needing to know there is more than one.
        //
        // A forced kind (the review tools ask for one) stays a single spot,
        // so a reviewer gets exactly what they asked to see.
        const spots = [];
        if (opts.kind) {
            spots.push(scriptOfKind(opts.kind));
        } else {
            const want = Math.random() < 0.35 ? 3 : 2;
            const brands = new Set();
            for (let tries = 0; spots.length < want && tries < want * 4; tries++) {
                const sc = scriptOfKind(null);
                const key = (sc.brand || '') + '|' + (sc.product || '');
                if (brands.has(key)) continue;
                // At most one network promo per pod: two in a row is the
                // station advertising itself to itself.
                if (sc.kind === 'promo' && spots.some((x) => x.kind === 'promo')) continue;
                brands.add(key);
                spots.push(sc);
            }
        }
        spots.forEach((sc) => { if (!sc.look) sc.look = rollLook(); });
        const script = spots[0];

        const scriptKind = script.isQVC ? 'qvc'
            : script.isInfomercial ? 'infomercial'
                : script.kind === 'promo' ? 'promo'
                    : 'commercial';
        const plateBearingScript = !!(script.isQVC || script.isInfomercial);
        console.log(`[GNN Commercial:Script] requested=${opts.kind || 'auto'} resolved=${scriptKind} spots=${spots.length} brand="${script.brand || 'GNN'}" product="${script.product || '—'}" plate-bearing=${plateBearingScript}`);

        // Every beat is tagged with the spot it belongs to and the voice
        // that reads it. A new spot gets a new announcer: one person
        // selling three products in a row is a shopping channel, not a
        // break.
        // The ident is the station speaking, so it gets a voice of its own
        // picked first; each spot then avoids the voice before it. Left
        // untagged, the ident read in whichever announcer was picked last,
        // which was often the first spot's too.
        const beats = [{ kind: 'ident', text: GNNScript.ident(),
                         voice: pickBreakVoice() }];
        for (const sc of spots) {
            const voice = pickBreakVoice();
            for (const b of sc.beats) {
                beats.push(Object.assign({}, b, { script: sc, voice }));
            }
        }

        // The words are known before any picture is, so synthesis starts
        // now, ident first — during the anchor's throw and the scene loading
        // below, not after them. The server serves these in order, so the
        // first line to air is the first one ready.
        if (typeof GNNTTS !== 'undefined' && GNNTTS.prefetch) {
            beats.forEach((b) => {
                if (b.text) GNNTTS.prefetch(b.text, voiceOptsFor(b));
            });
        }

        const shots = [];
        for (const beat of beats) {
            const shot = await buildShot(beat, beat.script || script);
            if (shot) shots.push(shot);
        }
        if (!shots.length) return null;

        // Aggregate all assets across all shots in this commercial break
        const allBackdrops = new Set();
        const allSprites = new Set();
        const allOverlays = new Set();
        const rundown = [];

        shots.forEach((shot, i) => {
            const shotVoice = voiceOptsFor(shot.beat).voice;
            const assetInfo = extractSceneAssets(shot.scene);
            assetInfo.backdrops.forEach((b) => allBackdrops.add(b));
            assetInfo.sprites.forEach((s) => allSprites.add(s));
            assetInfo.overlays.forEach((o) => allOverlays.add(o));

            rundown.push({
                index: i + 1,
                kind: shot.beat.kind,
                sceneKind: shot.scene.kind || 'single',
                duration: shot.duration,
                transition: shot.transition,
                voice: shotVoice,
                text: shot.beat.text || '(instrumental)',
            });
        });

        const commercialMeta = {
            recipe: shots.map((s) => s.scene.kind || s.beat.kind).filter((v, i, a) => a.indexOf(v) === i).join('+'),
            brand: script.brand || 'GNN Presentation',
            product: script.product || 'Network Broadcast',
            shotsCount: shots.length,
            durationMs: shots.reduce((n, s) => n + s.duration, 0),
            announcerVoice: breakVoice,
            legalVoice: LEGAL_VOICE,
            backdrops: Array.from(allBackdrops),
            sprites: Array.from(allSprites),
            overlays: Array.from(allOverlays),
            shots: rundown,
        };

        if (typeof window !== 'undefined' && window.GNNTranscript && window.GNNTranscript.logCommercial) {
            window.GNNTranscript.logCommercial(commercialMeta);
        }

        console.log(`[GNN Commercial:RecipeTrace] Recipe=${commercialMeta.recipe} Brand="${commercialMeta.brand}" Product="${commercialMeta.product}" Announcer=${breakVoice} Shots=${shots.length} Assets=[${commercialMeta.backdrops.concat(commercialMeta.sprites, commercialMeta.overlays).join(', ')}]`);
        return { script, shots };
    }

    /**
     * Start a commercial break: `opts.prepared` (a `prepareBreak()` promise
     * or result) if given, otherwise assembled here.
     *
     * The clock is read here, after assembly, not taken from `now`. The
     * director passes the moment it *decided* on a break — before the
     * anchor's throw and the assembly — and the first shot started that
     * many seconds old: an animated ident opened on its last frame and a
     * dissolve skipped its fade. `now` is kept for the callers' signature.
     *
     * @returns {Promise<number>} total break duration in ms
     */
    async function startCommercialBreak(now, opts = {}) {
        if (breakState) return 0;
        const prep = opts.prepared ? await opts.prepared : await prepareBreak(opts);
        if (!prep || breakState) return 0;
        const { script, shots } = prep;
        now = performance.now();

        breakState = {
            script, shots, index: -1, startedAt: now,
            shotStart: now, total: shots.reduce((n, s) => n + s.duration, 0),
        };
        if (typeof GNNAudio !== 'undefined') {
            const beds = GNNAssets.musicTracks((t) => !BREAK_BED_DENY.test(t.id));
            if (beds.length) {
                const bed = beds[(Math.random() * beds.length) | 0];
                // Named in the log so "that song has lyrics" can be traced
                // to a track id and added to BREAK_BED_DENY.
                console.log(`[GNN Commercial:Music] bed=${bed.id}`);
                GNNAudio.playMusic(bed.id, { gain: 0.5, fadeIn: 0.6 });
            }
            GNNAudio.playRole('servo', { gain: 0.5 });
        }
        advanceShot(now);
        return breakState.total;
    }

    function advanceShot(now) {
        if (!breakState) return;
        // How long the outgoing shot was really on screen — its line can
        // hold it past `duration` — so the next dissolve can hold it on
        // the frame the viewer last saw.
        const out = breakState.shots[breakState.index];
        if (out) out.heldMs = now - breakState.shotStart;
        breakState.index++;
        if (breakState.index >= breakState.shots.length) {
            const cb = onBreakEnd;
            breakState = null;
            if (typeof GNNAudio !== 'undefined') GNNAudio.stopMusic(0.8);
            if (cb) cb();
            return;
        }
        breakState.shotStart = now;
        const shot = breakState.shots[breakState.index];
        if (typeof GNNAudio !== 'undefined') {
            GNNAudio.playChord(chordFor(shot.scene.kind));
            if (shot.beat.kind === 'ident') GNNAudio.play('intro_sfx_02', { gain: 0.5 });
        }
        // A shot holds until its own voice-over has finished. The visual
        // used to advance on a fixed timer while the line was still being
        // synthesised, so most ad copy was cut off a second or two in.
        shot.voiceDone = !shot.beat.text;
        if (onBeat) {
            const spoken = onBeat(shot.beat.text, shot);
            if (spoken && typeof spoken.then === 'function') {
                spoken.then(() => { shot.voiceDone = true; })
                      .catch(() => { shot.voiceDone = true; });
            } else {
                shot.voiceDone = true;
            }
        } else {
            shot.voiceDone = true;
        }
    }

    function isBreakActive() { return !!breakState; }
    function abortBreak() {
        if (!breakState) return;
        breakState = null;
        if (typeof GNNAudio !== 'undefined') GNNAudio.stopMusic(0.4);
        if (onBreakEnd) onBreakEnd();
    }

    // ---------------------------------------------------------
    // Update / render
    // ---------------------------------------------------------

    function update(now) {
        if (breakState) {
            const shot = breakState.shots[breakState.index];
            if (shot) {
                const held = now - breakState.shotStart;
                // Minimum on screen, then wait for the line; the cap stops a
                // failed synthesis from stalling the whole break.
                // `duration` already ends a cinematic shot before its last
                // frame and holds any other animation to its end.
                const isSpeaking = typeof GNNTTS !== 'undefined' && GNNTTS.isSpeaking && GNNTTS.isSpeaking();
                const ready = held >= shot.duration && (shot.voiceDone || (held >= shot.maxHold && !isSpeaking) || held >= shot.maxHold + 12000);
                if (ready) {
                    advanceShot(now);
                }
            }
            return;
        }
        if (cutaway) {
            // Swap the correspondent's mouth while they are talking.
            //
            // The layer holds two plates — hero and speaking — and this is
            // what picks between them. `tickCorrespondentMouth()` runs its
            // own clock off the voice level, because the desk's animator is
            // deliberately shut during a two-way so the anchor watching does
            // not move their mouth on the correspondent's voice.
            //
            // Only two-way cutaways have a mouth-swap layer. Ordinary
            // b-roll and commercial shots are single-frame or time-driven
            // and do not need this tick.
            if (cutaway.twoWay) {
                tickCorrespondentMouth(now);
                if (cutaway.scene && cutaway.scene.layers) {
                    for (const layer of cutaway.scene.layers) {
                        if (layer && layer.mouthSwap) {
                            layer.frameIndex = corrJawOpen ? 1 : 0;
                        }
                    }
                }
                if (cutaway.sceneRight && cutaway.sceneRight.layers) {
                    for (const layer of cutaway.sceneRight.layers) {
                        if (layer && layer.mouthSwap) {
                            layer.frameIndex = corrJawOpenRight ? 1 : 0;
                        }
                    }
                }
            }
            if (now - cutaway.startedAt >= cutaway.duration) {
                lastCutawayEnd = now;
                cutaway = null;
            }
        }
    }

    function drawScene(ctx, scene, elapsed, dest, alpha) {
        // A generated plate is a finished 1280x720 picture. The compositor's
        // 320x200 buffer exists for assembling MOO1 sprite chips into a scene,
        // and routing a plate through it costs three quarters of its pixels
        // with nearest-neighbour sampling before it is stretched back up to
        // the monitor. Draw the plate straight to the destination instead.
        if (scene.generated) {
            drawGeneratedScene(ctx, scene, elapsed, dest, alpha);
            drawOverlays(ctx, scene, dest, alpha);
            return;
        }
        const buf = GNNSceneCompositor.draw(scene, elapsed);
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = alpha === undefined ? 1 : alpha;
        ctx.drawImage(buf, dest.x, dest.y, dest.w, dest.h);
        ctx.restore();
        drawOverlays(ctx, scene, dest, alpha);
    }

    /**
     * Finished art laid over an archive scene at the destination's own
     * resolution. A show logo put in the scene's layers went through the
     * 320x180 compositor buffer and was blown up four times with
     * nearest-neighbour — its lettering and fine detail broke up.
     */
    function drawOverlays(ctx, scene, dest, alpha) {
        if (!scene.overlays || !scene.overlays.length) return;
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.globalAlpha = alpha === undefined ? 1 : alpha;
        for (const o of scene.overlays) {
            ctx.drawImage(o.img, dest.x + o.rect.x * dest.w, dest.y + o.rect.y * dest.h,
                o.rect.w * dest.w, o.rect.h * dest.h);
        }
        ctx.restore();
    }

    /**
     * Draw a scene built from generated plates at the destination's own
     * resolution. Layers are still cover/contain-fitted and still stack in
     * order; they just skip the low-resolution compositor buffer that
     * composites of MOO1 art need and finished plates do not.
     *
     * Motion models are not applied. Generated scenes are `motion: 'still'`
     * by construction — the only thing that moves in a two-way is the
     * correspondent's mouth, which is a frame swap between two plates, and
     * that is handled by the caller setting `frameIndex`.
     */
    function drawGeneratedScene(ctx, scene, elapsed, dest, alpha) {
        ctx.save();
        // Bilinear on the downscale. The plates are photographic, not sprites;
        // nearest-neighbour at a 5-6x reduction aliases into noise.
        ctx.imageSmoothingEnabled = true;
        ctx.beginPath();
        ctx.rect(dest.x, dest.y, dest.w, dest.h);
        ctx.clip();
        const t = elapsed / 1000;
        for (const layer of scene.layers) {
            if (!layer || !layer.frames.length) continue;
            // Hold the last frame instead of wrapping. The modulo
            // form sent an over-length animation back to frame zero
            // mid-shot, which the viewer sees as the picture starting
            // over. The shot's own duration is now long enough for the
            // animation to finish, so there is nothing to be gained by
            // looping and a visible reload to lose.
            const idx = layer.fps
                ? Math.min(layer.frames.length - 1,
                    Math.floor((t + layer.offset) * layer.fps))
                : Math.min(layer.frames.length - 1, layer.frameIndex || 0);
            const img = layer.frames[idx];
            if (!img) continue;
            let x = dest.x, y = dest.y, w = dest.w, h = dest.h;
            if (layer.fit === 'cover') {
                const s = Math.max(dest.w / img.width, dest.h / img.height);
                w = img.width * s;
                h = img.height * s;
                x = dest.x + (dest.w - w) / 2;
                y = dest.y + (dest.h - h) / 2;
            } else if (layer.fit === 'contain') {
                const s = Math.min(dest.w / img.width, dest.h / img.height);
                w = img.width * s;
                h = img.height * s;
                x = dest.x + (dest.w - w) / 2;
                y = dest.y + (dest.h - h) / 2;
            }
            const a = (layer.alpha === undefined ? 1 : layer.alpha)
                * (alpha === undefined ? 1 : alpha);
            ctx.globalAlpha = Math.max(0, Math.min(1, a));
            ctx.drawImage(img, x, y, w, h);
        }
        ctx.restore();
    }

    /**
     * The lit bezel and label strip drawn over a cutaway in the monitor.
     * Top row is a "LIVE" tag and the cutaway's own label; optional second
     * line along the bottom carries the source strap ("GNN LIVE FOOTAGE").
     *
     * This was missing from the module at the time of the black-screen bug
     * — `render()` called it, it threw, the renderer's try/catch ate the
     * throw, and every frame after the throw was skipped. The screen went
     * black every time a cutaway fired because the draw path never reached
     * `blitViewport`. It lives here now, defined before `render()` uses it,
     * and it is measured rather than assumed so a long label does not run
     * over its own LIVE tag.
     */
    function drawChrome(ctx, dest, label, sub, tagText, noBorder) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        if (!noBorder) {
            ctx.strokeStyle = '#6fc3df';
            ctx.lineWidth = 3;
            ctx.strokeRect(dest.x + 1.5, dest.y + 1.5, dest.w - 3, dest.h - 3);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.72)';
        ctx.fillRect(dest.x + 2, dest.y + 2, dest.w - 4, 20);
        ctx.font = '9px "Press Start 2P", monospace';
        ctx.fillStyle = tagText ? '#ffcc66' : '#ff4d4d';
        ctx.textBaseline = 'middle';
        const tag = tagText || '● LIVE';
        ctx.fillText(tag, dest.x + 8, dest.y + 12);
        // Measured, not assumed: a fixed offset here printed the label on top
        // of the tag once the panel grew.
        const labelX = dest.x + 8 + ctx.measureText(tag).width + 10;
        ctx.fillStyle = '#9fe6ff';
        ctx.fillText(String(label || '').slice(0, 22), labelX, dest.y + 12,
            dest.x + dest.w - 8 - labelX);
        if (sub) {
            ctx.fillStyle = 'rgba(0,0,0,0.72)';
            ctx.fillRect(dest.x + 2, dest.y + dest.h - 20, dest.w - 4, 18);
            ctx.fillStyle = '#7dd6a0';
            ctx.fillText(String(sub).slice(0, 26), dest.x + 8, dest.y + dest.h - 11, dest.w - 14);
        }
        ctx.restore();
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} view  the CRT viewport rect in canvas pixels
     * @param {number} now
     */
    function render(ctx, view, now) {
        if (breakState) {
            const shot = breakState.shots[breakState.index];
            if (!shot) return;
            const elapsed = now - breakState.shotStart;
            let alpha = 1;
            if (shot.transition === 'dissolve') {
                // Fade in only. An earlier build faded the picture
                // down to 15% in the last 320 ms of every dissolve shot,
                // which the viewer sees as the scene blinking off right
                // before the next one starts. A shot now holds at full
                // opacity until it ends and the next shot fades in over it.
                alpha = Math.min(1, elapsed / 420);
            }
            ctx.save();
            ctx.fillStyle = '#000';
            ctx.fillRect(view.x, view.y, view.w, view.h);
            ctx.restore();
            // A dissolve fades in *over the outgoing shot*. The outgoing
            // shot was never drawn, so every dissolve was really a fade up
            // from black, and its first frames went out nearly black — the
            // "black frame between shots" seen in the infomercials. The
            // previous shot is held on its last frame underneath.
            if (alpha < 1 && breakState.index > 0) {
                const prev = breakState.shots[breakState.index - 1];
                if (prev && prev.scene) {
                    // At the moment it left, not at its planned length: a
                    // shot held by its line had played on past `duration`,
                    // and footage under the dissolve jumped back to it.
                    drawScene(ctx, prev.scene, prev.heldMs || prev.duration, view, 1);
                }
            }
            drawScene(ctx, shot.scene, elapsed, view, alpha);
            drawBreakCard(ctx, view, shot, elapsed);
            return;
        }

        if (!cutaway) return;
        const elapsed = now - cutaway.startedAt;
        if (cutaway.mode === 'full') {
            const t = Math.min(1, elapsed / 300);
            drawScene(ctx, cutaway.scene, elapsed, view, t);
            // Archive, not live: this is in-universe film, and over a real
            // story it must not claim to be pictures of the real event. No
            // bottom strip — full-frame, the bottom of the picture belongs
            // to bottomStack() (constraint 3), and the strip sat under the
            // ticker.
            const cine = cutaway.scene && cutaway.scene.cinematic;
            drawChrome(ctx, view, cutaway.label || (cine ? 'GNN FILE FOOTAGE' : ''),
                cine ? null : 'GNN LIVE FOOTAGE', cine ? '◆ ARCHIVE' : null);
        } else if (cutaway.mode === 'dual-pip') {
            const PIP_L = { x: 0.045, y: 0.08, w: 0.20, h: 0.24 };
            const PIP_R = { x: 0.755, y: 0.08, w: 0.20, h: 0.24 };
            const destL = {
                x: view.x + PIP_L.x * view.w,
                y: view.y + PIP_L.y * view.h,
                w: PIP_L.w * view.w,
                h: PIP_L.h * view.h,
            };
            const destR = {
                x: view.x + PIP_R.x * view.w,
                y: view.y + PIP_R.y * view.h,
                w: PIP_R.w * view.w,
                h: PIP_R.h * view.h,
            };
            const t = Math.min(1, elapsed / 220);
            ctx.save();
            ctx.fillStyle = '#000';
            ctx.fillRect(destL.x, destL.y, destL.w, destL.h);
            ctx.fillRect(destR.x, destR.y, destR.w, destR.h);
            ctx.restore();
            drawScene(ctx, cutaway.scene, elapsed, destL, t);
            drawChrome(ctx, destL, cutaway.label || 'DEBATER 1', 'SECTOR DEBATE');
            if (cutaway.sceneRight) {
                drawScene(ctx, cutaway.sceneRight, elapsed, destR, t);
            }
            drawChrome(ctx, destR, cutaway.labelRight || 'DEBATER 2', 'SECTOR DEBATE');
        } else {
            const dest = {
                x: view.x + PIP.x * view.w,
                y: view.y + PIP.y * view.h,
                w: PIP.w * view.w,
                h: PIP.h * view.h,
            };
            ctx.save();
            ctx.fillStyle = '#000';
            ctx.fillRect(dest.x, dest.y, dest.w, dest.h);
            ctx.restore();
            drawScene(ctx, cutaway.scene, elapsed, dest, Math.min(1, elapsed / 220));
            // The generated bezel when it exists, over the footage's own
            // drawn border, so the monitor looks the same whether it shows
            // a story icon or footage.
            const framed = typeof GNNRenderer !== 'undefined' && GNNRenderer.hasMonitorFrame
                && GNNRenderer.hasMonitorFrame();
            drawChrome(ctx, dest, cutaway.label, undefined, undefined, framed);
            if (framed) GNNRenderer.drawMonitorFrame(ctx, dest.x, dest.y, dest.w, dest.h);
        }
    }

    /**
     * The two captions on a commercial shot: a product name at the top and
     * a line of copy at the bottom.
     *
     * In addition, GNN Galaxy Shop (QVC) renders phone numbers, pricing, and
     * live inventory counters; late-night infomercials render legal hotline boxes.
     */
    function drawBreakCard(ctx, view, shot, elapsed) {
        const card = shot.card;
        if (!card || (!card.top && !card.bottom)) return;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.textBaseline = 'middle';
        const slide = Math.min(1, elapsed / 380);
        const inset = Math.round(view.w * 0.035);
        const pad = Math.round(view.w * 0.016);
        const script = shot.script || (breakState && breakState.script);

        if (card.top) {
            const text = card.top.slice(0, 34);
            ctx.font = '15px "Press Start 2P", monospace';
            const w = Math.round(ctx.measureText(text).width) + pad * 2;
            const h = Math.round(view.h * 0.085);
            const x = view.x + inset;
            const y = view.y + Math.round(view.h * 0.10);
            ctx.fillStyle = 'rgba(4,10,18,0.92)';
            ctx.fillRect(x, y, Math.round(w * slide), h);
            ctx.fillStyle = (script && script.isQVC) ? '#ffcc00' : '#ffd166';
            ctx.fillRect(x, y, Math.max(2, Math.round(w * 0.006)), h);
            ctx.fillText(text, x + pad, y + h / 2);
        }

        // QVC / Home Shopping Network on-screen graphic overlay
        if (script && script.isQVC && shot.beat.kind !== 'ident') {
            const infoW = Math.round(view.w * 0.40);
            const infoH = Math.round(view.h * 0.17);
            const infoX = view.x + view.w - inset - infoW;
            const infoY = view.y + Math.round(view.h * 0.10);

            ctx.fillStyle = 'rgba(6,12,24,0.92)';
            ctx.fillRect(infoX, infoY, infoW, infoH);
            ctx.strokeStyle = '#ffcc00';
            ctx.lineWidth = 2;
            ctx.strokeRect(infoX, infoY, infoW, infoH);

            ctx.font = '10px "Press Start 2P", monospace';
            ctx.fillStyle = '#00e676';
            ctx.fillText(script.price ? `PRICE: ${script.price}` : 'SPECIAL PRICE', infoX + pad, infoY + Math.round(infoH * 0.28));

            // Pulsing remaining stock banner
            const blink = Math.sin(elapsed / 220) > 0;
            ctx.fillStyle = blink ? '#ff4d4d' : '#ff9999';
            ctx.fillText(script.stock ? `● ${script.stock}` : '● LIMITED STOCK', infoX + pad, infoY + Math.round(infoH * 0.58));

            ctx.fillStyle = '#9fe6ff';
            ctx.font = '9px "Press Start 2P", monospace';
            ctx.fillText(script.phone ? `☎ CALL ${script.phone}` : '☎ 1-800-RIM-DEAL', infoX + pad, infoY + Math.round(infoH * 0.85));
        } else if (script && script.isInfomercial && shot.beat.kind !== 'ident') {
            // Shady Infomercial on-screen hotline badge
            const infoW = Math.round(view.w * 0.38);
            const infoH = Math.round(view.h * 0.12);
            const infoX = view.x + view.w - inset - infoW;
            const infoY = view.y + Math.round(view.h * 0.10);

            ctx.fillStyle = 'rgba(14,6,8,0.92)';
            ctx.fillRect(infoX, infoY, infoW, infoH);
            ctx.strokeStyle = '#ff4d4d';
            ctx.lineWidth = 2;
            ctx.strokeRect(infoX, infoY, infoW, infoH);

            ctx.font = '9px "Press Start 2P", monospace';
            ctx.fillStyle = '#ffd166';
            ctx.fillText('TOLL-FREE INQUIRY:', infoX + pad, infoY + Math.round(infoH * 0.38));
            ctx.fillStyle = '#ffffff';
            ctx.fillText(script.phone || '1-888-VEX-SAKKRA', infoX + pad, infoY + Math.round(infoH * 0.78));
        }

        if (card.bottom) {
            const legal = shot.beat.kind === 'legal';
            ctx.font = (legal ? '9px' : '12px') + ' "Press Start 2P", monospace';
            const lh = legal ? 14 : 18;
            const maxW = Math.round(view.w * 0.52);
            const lines = wrapLines(ctx, card.bottom, maxW - pad * 2, 3);
            let widest = 0;
            for (const ln of lines) widest = Math.max(widest, ctx.measureText(ln).width);
            const w = Math.round(widest) + pad * 2;
            const h = lines.length * lh + pad;
            const x = view.x + inset;
            const y = view.y + view.h - inset - h;
            ctx.fillStyle = 'rgba(4,10,18,0.9)';
            ctx.fillRect(x, y, Math.round(w * slide), h);
            ctx.fillStyle = legal ? '#8ea4b8' : '#9fe6ff';
            for (let i = 0; i < lines.length; i++) {
                ctx.fillText(lines[i], x + pad, y + pad / 2 + lh / 2 + i * lh);
            }
        }
        ctx.restore();
    }

    /** Wrap to a width, capped at `max` lines. */
    function wrapLines(ctx, text, width, max) {
        const words = String(text || '').split(/\s+/);
        const out = [];
        let line = '';
        for (const word of words) {
            const probe = line ? line + ' ' + word : word;
            if (ctx.measureText(probe).width > width && line) {
                if (out.length + 1 >= max) {
                    // Out of lines with copy left: say so. A card that just
                    // stopped mid-sentence read as a mistake on screen.
                    let cut = line;
                    while (cut.includes(' ') && ctx.measureText(cut + '…').width > width) {
                        cut = cut.slice(0, cut.lastIndexOf(' '));
                    }
                    out.push(cut.replace(/[,;:]$/, '') + '…');
                    return out;
                }
                out.push(line);
                line = word;
            } else {
                line = probe;
            }
        }
        if (line && out.length < max) out.push(line);
        return out;
    }


    return {
        PIP,
        prefetch, triggerCutaway, endCutaway, isCutawayActive,
        /** For review tools: the shot on screen, or -1 outside a break. */
        shotIndex: () => (breakState ? breakState.index : -1),
        /** For review tools: the shot on screen — its hold, animation length and line state. */
        shotInfo: () => {
            const shot = breakState && breakState.shots[breakState.index];
            if (!shot) return null;
            return {
                index: breakState.index, kind: shot.beat.kind,
                duration: shot.duration, animMs: sceneAnimationMs(shot.scene),
                voiceDone: !!shot.voiceDone, transition: shot.transition,
            };
        },
        isFullCutaway, voiceOptsFor, openTwoWay, openDebate, isTwoWay,
        prepareBreak, startCommercialBreak, abortBreak, isBreakActive,
        /** For review tools: the script of the spot now on screen. */
        breakScript: () => {
            if (!breakState) return null;
            const shot = breakState.shots[breakState.index];
            return (shot && shot.script) || breakState.script || null;
        },
        update, render,
        routeFor,
        lastCutawayEnd: () => lastCutawayEnd,
        currentLabel: () => (cutaway ? cutaway.label : null),
        currentSource: () => (cutaway ? cutaway.source : null),
        set onBeat(fn) { onBeat = fn; },
        set onBreakEnd(fn) { onBreakEnd = fn; },
    };
})();