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
                                image was requested, whether the
                                product loaded, whether a
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
   ============================================================ */

const GNNCutsceneManager = (() => {
    'use strict';

    // Cutaway window over the anchor's right shoulder, in 320x200 space.
    // Fractions of the frame, not pixels of a 320x200 screen that no longer
    // exists: the old constants were divided by 200 against a frame 180 tall
    // and came to 40% of the width, which put the over-the-shoulder box
    // across the anchors beside it. Matched to the story icon plate in
    // renderer.js, since they occupy the same corner for the same reason.
    const PIP = { x: 0.755, y: 0.075, w: 0.175, h: 0.215 };
    const PIP_MS = 7200;

    let cutaway = null;        // { scene, startedAt, mode }
    let breakState = null;     // { shots, index, startedAt, script }
    let lastCutawayEnd = 0;
    let onBeat = null;         // (text, shot) => Promise
    let onBreakEnd = null;
    let pendingScene = null;

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

    function routeFor(story) {
        const text = `${(story && story.title) || ''} ${(story && story.description) || ''}`;
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
            'planet_invasion', 'planet_invasion_02', 'planet_invasion_03'],
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
        return {
            kind,
            layers: [{
                entry: null, frames: [img], fps: 0, motion: 'still',
                params: {}, blend: 'source-over', alpha: 1,
                fit: 'cover', rect: null, offset: 0,
            }],
            duration: PIP_MS, label: null, generated: true,
        };
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
        let back = (kind && await generatedScene(kind));
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
    };

    // ---------------------------------------------------------
    // Cutaways
    // ---------------------------------------------------------

    /**
     * Warm a scene for the current story so the cut is instant.
     *
     * Tries the generated plate first; falls back to the compositor only
     * for routes the compositor still knows how to build. A route with
     * neither (a hack story on a machine whose `hacker_code.png` did not
     * condition) yields null and `triggerCutaway()` skips the cut. That
     * is the correct behaviour — a hack story on a station with no hacking
     * plate reads without one, rather than being shown a picture of a
     * convoy because the router asked the compositor for a recipe that
     * does not exist.
     */
    async function prefetch(story) {
        const kind = routeFor(story);
        pendingScene = (kind && await generatedScene(kind))
            || await GNNSceneCompositor.synthesize(kind || undefined);
        return pendingScene;
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

    async function triggerCutaway(story, now, opts = {}) {
        if (breakState) return false;
        const kind = routeFor(story);
        const scene = pendingScene || (kind && await generatedScene(kind))
            || await GNNSceneCompositor.synthesize(kind || undefined);
        pendingScene = null;
        if (!scene) return false;
        cutaway = {
            scene,
            startedAt: now,
            duration: opts.duration || Math.min(scene.duration || PIP_MS, PIP_MS),
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
            mode: opts.mode || 'pip',
            label: opts.label || scene.label,
        };
        const chord = SCENE_AUDIO[scene.kind] || SCENE_AUDIO.single;
        if (typeof GNNAudio !== 'undefined') GNNAudio.playChord(chord);

        const assetInfo = extractSceneAssets(scene);
        const cutawayMeta = {
            kind: kind || scene.kind || 'b-roll',
            recipe: scene.kind || kind || 'composite',
            mode: cutaway.mode,
            duration: cutaway.duration,
            assets: assetInfo.all.length ? assetInfo.all : [scene.label || kind || 'scene'],
        };
        if (typeof window !== 'undefined' && window.GNNTranscript && window.GNNTranscript.logCutaway) {
            window.GNNTranscript.logCutaway(cutawayMeta);
        }
        console.log(`[GNN Cutaway:RecipeTrace] Subject=${cutawayMeta.kind} Recipe=${cutawayMeta.recipe} Mode=${cutawayMeta.mode} Dur=${(cutawayMeta.duration / 1000).toFixed(1)}s Assets=[${cutawayMeta.assets.join(', ')}]`);

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
        switch (kind) {
            case 'ident':
                return GNNAssets.find({ pool: 'broll', dirs: ['INTRO', 'INTRO2'] });
            case 'hook':
                return GNNAssets.find({
                    pool: 'broll',
                    dirs: ['LANDING', 'STARVIEW', 'VORTEX'], minLum: 24
                });
            case 'body':
                return GNNAssets.find({
                    pool: 'sprite',
                    dirs: ['SHIPS', 'SHIPS2'], minW: 30
                });
            case 'claim':
                return GNNAssets.find({ pool: 'broll', dirs: ['TECHNO', 'BACKGRND'] });
            case 'tag':
                return GNNAssets.find({
                    pool: 'broll',
                    dirs: ['SPIES', 'EMBASSY', 'COUNCIL']
                });
            case 'legal':
                return GNNAssets.find({ pool: 'broll', dirs: ['BACKGRND', 'INTRO'] });
            default:
                return GNNAssets.find({ pool: 'broll' });
        }
    }

    const INFOMERCIAL_SCENES = {
        'Klackon Queen Amber Brooch': 'assets/generated/infomercials/galaxy_shop_pedestal.png',
        'Class-3 Tachyon Deflector Coil': 'assets/generated/infomercials/galaxy_shop_stage.png',
        'Silicoid Crystalline Exfoliating Balm': 'assets/generated/infomercials/galaxy_shop_pedestal.png',
        'Alkari Feather-Gloss & Preen Serum': 'assets/generated/infomercials/galaxy_shop_stage.png',
        'Mrrshan Velocity Hunting Optics': 'assets/generated/infomercials/galaxy_shop_stage.png',
        'Zortrium Exposure Class Action': 'assets/generated/infomercials/legal_office.png',
        'Antares IV Bio-Dome Crater Estates': 'assets/generated/infomercials/real_estate_vista.png',
        'Psilon Synaptic Neuro-Elixir': 'assets/generated/infomercials/supplement_lab.png',
        'Long-Haul Certification Programme': 'assets/generated/infomercials/shipyard_showroom.png',
        'Executive Presence Masterclass': 'assets/generated/infomercials/legal_office.png',
        'At-Home Hull Patch Kit': 'assets/generated/infomercials/shipyard_showroom.png',
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
        // Infomercial product heroes. Zortrium is intentionally -- absent why is he absent questionmark -
        // legal notice, no product shot.
        'Psilon Synaptic Neuro-Elixir':
            'assets/generated/products/zortrium_supplement.png',
        'Antares IV Bio-Dome Crater Estates':
            'assets/generated/products/bio_dome_model.png',
    };

    // Where the product sits on the stage plate. The two QVC stages are
    // different rooms — one a close-up of a single pedestal, the other a
    // wide set with a display table — so the slot is per-plate rather
    // than per-product. As fractions of the 1280x720 plate.
    //
    // The rect is a bounding box: the product is fit inside it without
    // distortion and centered, so a portrait product in a landscape slot
    // letterboxes rather than stretches.
    //
    // Values below for the two QVC stages are read off the plates you
    // showed. The three infomercial values are estimates — the stages
    // are new and have not been measured against a product yet. Tune
    // each one by screenshotting the shot and nudging.
    const PRODUCT_SLOT = {
        // QVC stages — measured from the plates.
        'assets/generated/infomercials/galaxy_shop_pedestal.png':
            { x: 0.40, y: 0.28, w: 0.20, h: 0.32 },
        'assets/generated/infomercials/galaxy_shop_stage.png':
            { x: 0.40, y: 0.30, w: 0.20, h: 0.28 },

        // Infomercial stages — estimates. Nudge after seeing one shot.
        'assets/generated/infomercials/legal_office.png':
            { x: 0.40, y: 0.34, w: 0.20, h: 0.24 },
        'assets/generated/infomercials/supplement_lab.png':
            { x: 0.40, y: 0.32, w: 0.20, h: 0.26 },
        'assets/generated/infomercials/real_estate_vista.png':
            { x: 0.38, y: 0.34, w: 0.24, h: 0.28 },
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
        const py = sy + (sh - ph) / 2;

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
    async function buildShot(beat, script) {
        let scene = null;
        const plateBearing = !!(script && (script.isQVC || script.isInfomercial)
            && (beat.kind === 'body' || beat.kind === 'claim' || beat.kind === 'hook'));
        if (plateBearing) {
            const plateUrl = INFOMERCIAL_SCENES[script.product]
                || (script.isQVC
                    ? 'assets/generated/infomercials/galaxy_shop_stage.png'
                    : 'assets/generated/infomercials/legal_office.png');
            const stageImg = await GNNAssets.loadImage(plateUrl);
            if (stageImg) {
                const productUrl = PRODUCT_IMAGES[script.product];
                const productImg = productUrl
                    ? await GNNAssets.loadImage(productUrl) : null;
                const slot = PRODUCT_SLOT[plateUrl];
                let finalImg = stageImg;
                let composited = false;
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
                    + `product=${productUrl || '—'} `
                    + `productLoaded=${!!productImg} `
                    + `composited=${composited} `
                    + `scene=${scene ? 'ok' : 'null'}`);
            } else {
                console.warn(`[GNN Commercial:Plate] beat=${beat.kind} `
                    + `plate=${plateUrl} loaded=false — falling back to `
                    + `MOO1 composite`);
            }
        }

        if (!scene) {
            const entry = GNNAssets.pick(heroPoolFor(beat.kind));
            if (beat.kind === 'body' || beat.kind === 'claim') {
                // Product beats get a full composite so the hull is *in* a place.
                scene = await GNNSceneCompositor.synthesize(
                    beat.kind === 'body' ? 'convoy' : 'industry');
            }
            if (!scene) {
                scene = await GNNSceneCompositor.single(entry, {
                    fit: entry && entry.w >= 240 ? 'cover' : 'contain',
                    label: script.brand,
                });
            }
        }
        if (!scene) return null;
        return {
            beat, scene, script,
            card: cardFor(beat, script),
            duration: beat.kind === 'legal' ? 2600 : 4200,
            maxHold: beat.kind === 'legal' ? 9000 : 14000,
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
                voice: breakVoice, rate: 0,
                pitch: beat.kind === 'tag' ? -4 : -2,
                duck: 0.45, duckSfx: 0.55
            };
    }

    function cardFor(beat, script) {
        const brand = (script && script.brand) ? script.brand.toUpperCase() : 'GNN';
        const product = (script && script.product) ? String(script.product).toUpperCase() : '';
        switch (beat.kind) {
            case 'ident': return { top: 'A GNN PRESENTATION', bottom: '' };
            case 'hook': return { top: brand, bottom: beat.text.toUpperCase() };
            case 'body': return { top: brand, bottom: product };
            case 'claim': return {
                top: (script && script.isQVC) ? 'EXCLUSIVE SPECIFICATION' : ((script && script.isInfomercial) ? 'TERMS & SETTLEMENT' : 'SPECIFICATION'),
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
    async function startCommercialBreak(now, opts = {}) {
        if (breakState) return 0;
        pickBreakVoice();
        let script;
        if (opts.kind === 'promo') {
            script = GNNScript.promo();
        } else if (opts.kind === 'qvc') {
            script = GNNScript.galaxyShop ? GNNScript.galaxyShop() : GNNScript.commercial();
        } else if (opts.kind === 'infomercial') {
            script = GNNScript.infomercial ? GNNScript.infomercial() : GNNScript.commercial();
        } else if (opts.kind === 'commercial') {
            script = GNNScript.commercial();
        } else {
            const roll = Math.random();
            if (roll < 0.20) {
                script = GNNScript.promo();
            } else if (roll < 0.45 && GNNScript.galaxyShop) {
                script = GNNScript.galaxyShop();
            } else if (roll < 0.70 && GNNScript.infomercial) {
                script = GNNScript.infomercial();
            } else {
                script = GNNScript.commercial();
            }
        }

        // Diagnostic: what kind of script was resolved, and whether it
        // is a plate-bearing kind. A "no product image" report can be
        // checked against this line before any shot loads. The middle
        // beats of a QVC or infomercial should each produce a
        // `[GNN Commercial:Plate]` line further down; a sponsor spot
        // (network promo or generic brand spot) never will, because it
        // has no plates to show.
        const scriptKind = script.isQVC ? 'qvc'
            : script.isInfomercial ? 'infomercial'
                : script.kind === 'promo' ? 'promo'
                    : 'commercial';
        const plateBearingScript = !!(script.isQVC || script.isInfomercial);
        console.log(`[GNN Commercial:Script] requested=${opts.kind || 'auto'} resolved=${scriptKind} brand="${script.brand || 'GNN'}" product="${script.product || '—'}" plate-bearing=${plateBearingScript}`);

        const beats = [{ kind: 'ident', text: GNNScript.ident() }].concat(script.beats);

        const shots = [];
        for (const beat of beats) {
            const shot = await buildShot(beat, script);
            if (shot) shots.push(shot);
        }
        if (!shots.length) return 0;

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

        // The whole break is known up front, so synthesise it now: by the
        // time each shot lands its line is already in hand.
        if (typeof GNNTTS !== 'undefined' && GNNTTS.prefetch) {
            shots.forEach((s, i) => {
                if (s.beat.text) {
                    setTimeout(() => GNNTTS.prefetch(s.beat.text, voiceOptsFor(s.beat)), i * 120);
                }
            });
        }

        breakState = {
            script, shots, index: -1, startedAt: now,
            shotStart: now, total: shots.reduce((n, s) => n + s.duration, 0),
        };
        if (typeof GNNAudio !== 'undefined') {
            const beds = GNNAssets.musicTracks();
            if (beds.length) {
                GNNAudio.playMusic(beds[(Math.random() * beds.length) | 0].id,
                    { gain: 0.5, fadeIn: 0.6 });
            }
            GNNAudio.playRole('servo', { gain: 0.5 });
        }
        advanceShot(now);
        return breakState.total;
    }

    function advanceShot(now) {
        if (!breakState) return;
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
            GNNAudio.playChord(SCENE_AUDIO[shot.scene.kind] || SCENE_AUDIO.single);
            if (shot.beat.kind === 'ident') GNNAudio.play('intro_sfx_02', { gain: 0.5 });
        }
        // A shot holds until its own voice-over has finished. The visual
        // used to advance on a fixed timer while the line was still being
        // synthesised, so most ad copy was cut off a second or two in.
        shot.voiceDone = !shot.beat.text;
        if (onBeat) {
            const spoken = onBeat(shot.beat.text, shot);
            if (spoken && typeof spoken.then === 'function') {
                spoken.then(() => { shot.voiceDone = true; });
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
                if (held >= shot.duration && (shot.voiceDone || held >= shot.maxHold)) {
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
            return;
        }
        const buf = GNNSceneCompositor.draw(scene, elapsed);
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = alpha === undefined ? 1 : alpha;
        ctx.drawImage(buf, dest.x, dest.y, dest.w, dest.h);
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
            const idx = layer.fps
                ? (Math.floor((t + layer.offset) * layer.fps) % layer.frames.length)
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
    function drawChrome(ctx, dest, label, sub) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.strokeStyle = '#6fc3df';
        ctx.lineWidth = 3;
        ctx.strokeRect(dest.x + 1.5, dest.y + 1.5, dest.w - 3, dest.h - 3);
        ctx.fillStyle = 'rgba(0,0,0,0.72)';
        ctx.fillRect(dest.x + 2, dest.y + 2, dest.w - 4, 20);
        ctx.font = '9px "Press Start 2P", monospace';
        ctx.fillStyle = '#ff4d4d';
        ctx.textBaseline = 'middle';
        const tag = '● LIVE';
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
                alpha = Math.min(1, elapsed / 420);
                // Only start fading once the line is actually done, or the
                // picture dips while the voice is still talking over it.
                if (shot.voiceDone && elapsed > shot.duration - 320) {
                    alpha = Math.max(0.15, Math.min(1, (shot.duration - elapsed) / 320));
                }
            }
            ctx.save();
            ctx.fillStyle = '#000';
            ctx.fillRect(view.x, view.y, view.w, view.h);
            ctx.restore();
            drawScene(ctx, shot.scene, elapsed, view, alpha);
            drawBreakCard(ctx, view, shot, elapsed);
            return;
        }

        if (!cutaway) return;
        const elapsed = now - cutaway.startedAt;
        if (cutaway.mode === 'full') {
            const t = Math.min(1, elapsed / 300);
            drawScene(ctx, cutaway.scene, elapsed, view, t);
            drawChrome(ctx, view, cutaway.label, 'GNN LIVE FOOTAGE');
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
            drawChrome(ctx, dest, cutaway.label);
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
                out.push(line);
                if (out.length >= max) return out;
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
        isFullCutaway, voiceOptsFor, openTwoWay, openDebate, isTwoWay,
        startCommercialBreak, abortBreak, isBreakActive,
        update, render,
        routeFor,
        lastCutawayEnd: () => lastCutawayEnd,
        currentLabel: () => (cutaway ? cutaway.label : null),
        set onBeat(fn) { onBeat = fn; },
        set onBreakEnd(fn) { onBreakEnd = fn; },
    };
})();