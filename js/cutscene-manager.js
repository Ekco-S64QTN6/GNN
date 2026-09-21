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
   ============================================================ */

const GNNCutsceneManager = (() => {
    'use strict';

    // Cutaway window over the anchor's right shoulder, in 320x200 space.
    const PIP = { x: 176, y: 20, w: 128, h: 92 };
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

    const ROUTES = [
        { kind: 'convoy', words: ['launch', 'rocket', 'spacex', 'nasa', 'artemis', 'starship', 'orbit', 'satellite', 'cargo', 'shipping', 'fleet', 'convoy', 'flight', 'aviation', 'boeing', 'airbus'] },
        { kind: 'anomaly', words: ['quantum', 'physics', 'anomaly', 'black hole', 'wormhole', 'gravity', 'particle', 'collider', 'antimatter', 'relativity', 'singularity', 'fusion'] },
        { kind: 'cyber', words: ['hack', 'hacked', 'cyber', 'breach', 'ransomware', 'malware', 'leak', 'exploit', 'phishing', 'botnet', 'zero-day', 'encryption', 'password', 'spyware'] },
        { kind: 'council', words: ['senate', 'parliament', 'congress', 'election', 'vote', 'treaty', 'summit', 'council', 'minister', 'president', 'diplomat', 'sanctions', 'legislation'] },
        { kind: 'survey', words: ['telescope', 'exoplanet', 'astronomy', 'webb', 'hubble', 'asteroid', 'comet', 'mars', 'moon', 'jupiter', 'saturn', 'galaxy', 'nebula', 'star'] },
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

    /** Sound design that matches the visual recipe. */
    const SCENE_AUDIO = {
        convoy: [{ role: 'rumble', gain: 0.5 }, { role: 'servo', gain: 0.35, delay: 0.6 }],
        anomaly: [{ role: 'drone', gain: 0.5 }, { role: 'sweep', gain: 0.4, delay: 1.1 }],
        cyber: [{ role: 'beep', gain: 0.45 }, { role: 'chirp', gain: 0.4, delay: 0.35 }, { role: 'zap', gain: 0.3, delay: 0.9 }],
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

    /** Warm a scene for the current story so the cut is instant. */
    async function prefetch(story) {
        const kind = routeFor(story);
        pendingScene = await GNNSceneCompositor.synthesize(kind || undefined);
        return pendingScene;
    }

    async function triggerCutaway(story, now, opts = {}) {
        if (breakState) return false;
        const scene = pendingScene || await GNNSceneCompositor.synthesize(routeFor(story) || undefined);
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

    // ---------------------------------------------------------
    // Commercial breaks
    // ---------------------------------------------------------

    /** Pick a visual for a beat, biased toward assets that fit its purpose. */
    function heroPoolFor(kind) {
        switch (kind) {
            case 'ident':
                return GNNAssets.find({ dirs: ['INTRO', 'INTRO2'], roles: ['fullscreen'], maxNoise: 95 });
            case 'hook':
                return GNNAssets.find({
                    dirs: ['LANDING', 'STARVIEW', 'VORTEX'], roles: ['fullscreen'],
                    minCoverage: 0.45, minLum: 24, maxNoise: 95,
                });
            case 'body':
                return GNNAssets.find({ dirs: ['SHIPS', 'SHIPS2'], roles: ['sprite'], minW: 30, maxNoise: 140 });
            case 'claim':
                return GNNAssets.find({
                    dirs: ['TECHNO', 'SCREENS', 'DESIGN'], roles: ['panel', 'fullscreen'],
                    minW: 60, maxNoise: 95,
                });
            case 'tag':
                return GNNAssets.find({
                    dirs: ['SPIES', 'EMBASSY', 'COUNCIL'], roles: ['fullscreen'],
                    minCoverage: 0.15, maxNoise: 150,
                });
            case 'legal':
                return GNNAssets.find({
                    dirs: ['BACKGRND', 'STARMAP'], roles: ['panel', 'fullscreen'],
                    minW: 60, maxNoise: 95,
                });
            default:
                return GNNAssets.find({ roles: ['fullscreen'], maxNoise: 95 });
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
    function voiceOptsFor(beat) {
        // Spots keep their stings closer to the voice than a news read does —
        // a commercial that ducks its own effects hard stops sounding like a
        // commercial.
        return beat.kind === 'legal'
            ? { rate: 38, pitch: -4, duck: 0.5, duckSfx: 0.55 }
            : { rate: beat.kind === 'tag' ? -12 : 0, pitch: -6,
                duck: 0.45, duckSfx: 0.55 };
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
        if (cutaway && now - cutaway.startedAt >= cutaway.duration) {
            lastCutawayEnd = now;
            cutaway = null;
        }
    }

    function drawScene(ctx, scene, elapsed, dest, alpha) {
        const buf = GNNSceneCompositor.draw(scene, elapsed);
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = alpha === undefined ? 1 : alpha;
        ctx.drawImage(buf, dest.x, dest.y, dest.w, dest.h);
        ctx.restore();
    }

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
        ctx.fillText('● LIVE', dest.x + 8, dest.y + 12);
        ctx.fillStyle = '#9fe6ff';
        ctx.fillText(String(label || '').slice(0, 22), dest.x + 58, dest.y + 12, dest.w - 66);
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
                x: view.x + (PIP.x / 320) * view.w,
                y: view.y + (PIP.y / 200) * view.h,
                w: (PIP.w / 320) * view.w,
                h: (PIP.h / 200) * view.h,
            };
            ctx.save();
            ctx.fillStyle = '#000';
            ctx.fillRect(dest.x, dest.y, dest.w, dest.h);
            ctx.restore();
            drawScene(ctx, cutaway.scene, elapsed, dest, Math.min(1, elapsed / 220));
            drawChrome(ctx, dest, cutaway.label);
        }
    }

    function drawBreakCard(ctx, view, shot, elapsed) {
        const card = shot.card;
        if (!card || (!card.top && !card.bottom)) return;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.textBaseline = 'middle';
        const slide = Math.min(1, elapsed / 380);
        if (card.top) {
            const h = Math.round(view.h * 0.11);
            const w = Math.min(view.w, 40 + ctx.measureText(card.top.slice(0, 34)).width + 40);
            ctx.font = '15px "Press Start 2P", monospace';
            ctx.fillStyle = 'rgba(4,10,18,0.88)';
            ctx.fillRect(view.x, view.y + view.h * 0.1,
                Math.max(w, view.w * 0.45) * slide, h);
            ctx.fillStyle = '#ffd166';
            ctx.font = '15px "Press Start 2P", monospace';
            ctx.fillText(card.top.slice(0, 34), view.x + 18,
                view.y + view.h * 0.1 + h / 2, view.w - 36);
        }
        if (card.bottom) {
            const h = Math.round(view.h * 0.16);
            const y = view.y + view.h * 0.7;
            ctx.fillStyle = 'rgba(4,10,18,0.88)';
            ctx.fillRect(view.x, y, view.w * slide, h);
            ctx.fillStyle = shot.beat.kind === 'legal' ? '#8ea4b8' : '#9fe6ff';
            ctx.font = (shot.beat.kind === 'legal' ? '9px' : '12px') + ' "Press Start 2P", monospace';
            wrapInto(ctx, card.bottom, view.x + 18, y + 16, view.w - 36,
                shot.beat.kind === 'legal' ? 14 : 18, 3);
        }
        ctx.restore();
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
        prefetch, triggerCutaway, endCutaway, isCutawayActive, voiceOptsFor,
        startCommercialBreak, abortBreak, isBreakActive,
        update, render,
        routeFor,
        lastCutawayEnd: () => lastCutawayEnd,
        currentLabel: () => (cutaway ? cutaway.label : null),
        set onBeat(fn) { onBeat = fn; },
        set onBreakEnd(fn) { onBreakEnd = fn; },
    };
})();
