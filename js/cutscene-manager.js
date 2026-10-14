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
   Recent fix:

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
    let corrVoiceUntil = 0;
    const CORR_GATE = 0.15;

    function tickCorrespondentMouth(now) {
        // Only flap the correspondent's mouth while the correspondent is
        // the one speaking. `GNNTTS.isSpeaking()` is true for the anchor's
        // question and the anchor's thanks too, so a gate on the voice bus
        // alone ran the correspondent's mouth through the anchor's lines —
        // the "alien dude's mouth moving while Commander Hale introduced
        // him" bug.
        const dir = (typeof GNNDirector !== 'undefined') ? GNNDirector : null;
        const speakerNow = dir && dir.speaker ? dir.speaker() : null;
        const theirTurn = !!(cutaway && cutaway.scene
            && cutaway.scene.correspondent && speakerNow
            && speakerNow.id === cutaway.scene.correspondent);
        const voiceOn = theirTurn
            && typeof GNNTTS !== 'undefined'
            && GNNTTS.isSpeaking && GNNTTS.isSpeaking();
        const level = voiceOn && GNNTTS.getLevel ? GNNTTS.getLevel() : 0;
        if (voiceOn && level > CORR_GATE) corrVoiceUntil = now + 90;
        if (now < corrVoiceUntil) {
            if (now >= corrJawUntil) {
                corrJawOpen = !corrJawOpen;
                const hurry = 1 - Math.min(0.5, level);
                corrJawUntil = now
                    + (corrJawOpen ? 70 + hurry * 70 : 50 + hurry * 50);
            }
        } else {
            corrJawOpen = false;
            corrJawUntil = 0;
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
        const back = (kind && await generatedScene(kind));
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
            mode: opts.mode || (Math.random() < 0.18 ? 'full' : 'pip'),
            label: opts.label || scene.label,
        };
        const chord = SCENE_AUDIO[scene.kind] || SCENE_AUDIO.single;
        if (typeof GNNAudio !== 'undefined') GNNAudio.playChord(chord);
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

    async function buildShot(beat, script) {
        const entry = GNNAssets.pick(heroPoolFor(beat.kind));
        let scene = null;
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
        if (!scene) return null;
        return {
            beat, scene,
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
        switch (beat.kind) {
            case 'ident': return { top: 'A GNN PRESENTATION', bottom: '' };
            case 'hook': return { top: '', bottom: beat.text.toUpperCase() };
            case 'body': return { top: script.brand.toUpperCase(), bottom: String(script.product).toUpperCase() };
            case 'claim': return { top: 'SPECIFICATION', bottom: beat.text.toUpperCase() };
            case 'tag': return { top: script.brand.toUpperCase(), bottom: beat.text.split('. ').pop().toUpperCase() };
            case 'legal': return { top: '', bottom: beat.text.toUpperCase() };
            default: return { top: '', bottom: '' };
        }
    }

    /**
     * Assemble and start a full commercial break.
     * @returns {Promise<number>} total break duration in ms
     */
    async function startCommercialBreak(now, opts = {}) {
        if (breakState) return 0;
        pickBreakVoice();
        const script = (opts.kind === 'promo' || Math.random() < 0.3)
            ? GNNScript.promo() : GNNScript.commercial();
        const beats = [{ kind: 'ident', text: GNNScript.ident() }].concat(script.beats);

        const shots = [];
        for (const beat of beats) {
            const shot = await buildShot(beat, script);
            if (shot) shots.push(shot);
        }
        if (!shots.length) return 0;

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
                for (const layer of cutaway.scene.layers) {
                    if (layer && layer.mouthSwap) {
                        layer.frameIndex = corrJawOpen ? 1 : 0;
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
     * Both used to be slabs. The top one was forced to at least 45% of the
     * frame width whatever it said, and the bottom one spanned the frame
     * edge to edge — together about a third of the picture, in translucent
     * grey, for two short lines of text. They are boxes around words now,
     * inset from the edges so they read as broadcast furniture rather than
     * as something pressed against the window frame.
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

        if (card.top) {
            const text = card.top.slice(0, 34);
            // Font before measuring. Measured with whatever was left over
            // from the previous draw, every one of these came out the wrong
            // width.
            ctx.font = '15px "Press Start 2P", monospace';
            const w = Math.round(ctx.measureText(text).width) + pad * 2;
            const h = Math.round(view.h * 0.085);
            const x = view.x + inset;
            const y = view.y + Math.round(view.h * 0.10);
            ctx.fillStyle = 'rgba(4,10,18,0.9)';
            ctx.fillRect(x, y, Math.round(w * slide), h);
            ctx.fillStyle = '#ffd166';
            ctx.fillRect(x, y, Math.max(2, Math.round(w * 0.006)), h);
            ctx.fillText(text, x + pad, y + h / 2);
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

    function wrapInto(ctx, text, x, y, maxW, lh, maxLines) {
        const words = String(text).split(' ');
        let line = '', row = 0;
        for (const w of words) {
            const test = line ? line + ' ' + w : w;
            if (ctx.measureText(test).width > maxW && line) {
                ctx.fillText(line, x, y + row * lh);
                if (++row >= maxLines) return;
                line = w;
            } else line = test;
        }
        if (line && row < maxLines) ctx.fillText(line, x, y + row * lh);
    }

    return {
        PIP,
        prefetch, triggerCutaway, endCutaway, isCutawayActive,
        isFullCutaway, voiceOptsFor, openTwoWay, isTwoWay,
        startCommercialBreak, abortBreak, isBreakActive,
        update, render,
        routeFor,
        lastCutawayEnd: () => lastCutawayEnd,
        currentLabel: () => (cutaway ? cutaway.label : null),
        set onBeat(fn) { onBeat = fn; },
        set onBreakEnd(fn) { onBreakEnd = fn; },
    };
})();