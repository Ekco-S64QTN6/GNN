/* ============================================================
   GNN — Audio Engine
   ------------------------------------------------------------
   One Web Audio graph for the whole station:

       sfxBus ─┐
       musicBus┼─> stationBus -> glitchStage -> masterComp -> out
       voiceBus┘        (bitcrush / tape-stop / detune)

   Every one of the 41 SOUNDFX.LBX effects and all 40 MUSIC.LBX
   tracks are addressable. Effects are requested by *role*
   ("alarm", "servo", "sweep", ...) so the director can ask for a
   plausible noise without memorising indices.
   ============================================================ */

const GNNAudio = (() => {
    'use strict';

    let ctx = null;
    let initialized = false;
    let muted = false;

    let masterGain = null;
    let comp = null;
    const runningWaiters = [];

    /** Call fn once the context is actually running (fires immediately if so). */
    function whenRunning(fn) {
        if (ctx && ctx.state === 'running') { fn(); return; }
        if (runningWaiters.indexOf(fn) < 0) runningWaiters.push(fn);
    }

    function notifyRunning() {
        if (!ctx || ctx.state !== 'running') return;
        while (runningWaiters.length) {
            try { runningWaiters.shift()(); } catch (_) { /* keep draining */ }
        }
    }
    let sfxBus = null;
    let musicBus = null;
    let voiceBus = null;
    let stationBus = null;
    let crusher = null;          // WaveShaper used for the glitch bitcrush
    let crusherWet = null;
    let crusherDry = null;

    const buffers = new Map();   // id -> AudioBuffer
    const loading = new Map();
    // Decoded music is ~10MB a track. Effects are tiny and stay forever; beds
    // are evicted least-recently-used so a long run cannot accumulate the whole
    // 40-track library in memory.
    const musicLru = [];
    const MUSIC_CACHE = 4;

    function rememberMusic(id) {
        const at = musicLru.indexOf(id);
        if (at >= 0) musicLru.splice(at, 1);
        musicLru.push(id);
        while (musicLru.length > MUSIC_CACHE) {
            const drop = musicLru.shift();
            if (drop !== currentTrack) buffers.delete(drop);
        }
    }

    let musicFilter = null;
    let musicSource = null;
    let musicGain = null;
    let currentTrack = null;
    let musicDuck = 1;
    // The level the current bed was actually mixed at. Ducking scales this;
    // it does not replace it.
    let musicBaseGain = 1;

    const VOLUME = { sfx: 0.55, music: 0.28, voice: 1.0, teletype: 0.14, ui: 0.3 };

    // ---------------------------------------------------------
    // Graph
    // ---------------------------------------------------------

    const crusherCurves = new Map();

    function makeCrusherCurve(bits) {
        if (crusherCurves.has(bits)) return crusherCurves.get(bits);
        const n = 1024;
        const curve = new Float32Array(n);
        const levels = Math.pow(2, bits);
        for (let i = 0; i < n; i++) {
            const x = (i / (n - 1)) * 2 - 1;
            curve[i] = Math.round(x * levels) / levels;
        }
        crusherCurves.set(bits, curve);
        return curve;
    }

    /**
     * Short crossfades. Every gain change on a live signal path goes through
     * one of these: an instantaneous setValueAtTime on an audible node is a
     * step discontinuity, which is exactly what a pop is.
     */
    function ramp(param, to, seconds, at) {
        const t = at === undefined ? ctx.currentTime : at;
        param.cancelScheduledValues(t);
        param.setValueAtTime(param.value, t);
        param.linearRampToValueAtTime(Math.max(0.0001, to), t + Math.max(0.004, seconds));
    }

    function ensureContext() {
        if (!ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            ctx = new AC();

            comp = ctx.createDynamicsCompressor();
            comp.threshold.value = -14;
            comp.knee.value = 20;
            comp.ratio.value = 6;
            comp.attack.value = 0.004;
            comp.release.value = 0.22;

            masterGain = ctx.createGain();
            masterGain.gain.value = 1;

            crusher = ctx.createWaveShaper();
            crusher.curve = makeCrusherCurve(12);
            crusher.oversample = '4x';
            crusherWet = ctx.createGain();
            crusherWet.gain.value = 0;
            crusherDry = ctx.createGain();
            crusherDry.gain.value = 1;

            stationBus = ctx.createGain();
            sfxBus = ctx.createGain();
            musicBus = ctx.createGain();
            voiceBus = ctx.createGain();

            sfxBus.gain.value = VOLUME.sfx;
            musicBus.gain.value = VOLUME.music;
            voiceBus.gain.value = VOLUME.voice;

            // A tape transport loses treble as it slows; the filter is what
            // sells the effect, so the playback rate never has to go low
            // enough for the resampler to stair-step.
            musicFilter = ctx.createBiquadFilter();
            musicFilter.type = 'lowpass';
            musicFilter.frequency.value = 20000;
            musicFilter.Q.value = 0.7;

            sfxBus.connect(stationBus);
            musicBus.connect(musicFilter);
            musicFilter.connect(stationBus);
            voiceBus.connect(stationBus);

            stationBus.connect(crusherDry);
            stationBus.connect(crusher);
            crusher.connect(crusherWet);
            crusherDry.connect(comp);
            crusherWet.connect(comp);
            comp.connect(masterGain);
            masterGain.connect(ctx.destination);
        }
        if (ctx.state === 'suspended') {
            // resume() is async. Anything that must wait for a *running*
            // context has to chain off it rather than re-check state on this
            // same tick, or it will silently take the not-ready path.
            ctx.resume().then(notifyRunning, () => {});
        } else {
            notifyRunning();
        }
        if (!initialized) {
            initialized = true;
            preloadCore();
        }
        return ctx;
    }

    // Single source of truth for what gets warmed up before air.
    const CORE_SFX = ['sfx_06', 'sfx_36', 'sfx_03', 'sfx_14', 'sfx_05',
                      'intro_sfx_01', 'intro_sfx_02'];
    const CORE_ROLES = ['servo', 'sweep', 'blast', 'drone', 'beep', 'chirp', 'zap'];

    /**
     * The handful of effects the broadcast leans on constantly.
     *
     * The role-based half needs the asset manifest, and the first user gesture
     * routinely beats the manifest fetch. Retry rather than checking once and
     * giving up for the life of the session — otherwise those roles load late,
     * on demand, and arrive after the visual they belong to.
     */
    function preloadCore(attempt = 0) {
        CORE_SFX.forEach(load);
        if (typeof GNNAssets !== 'undefined' && GNNAssets.isReady()) {
            CORE_ROLES.forEach((r) => {
                const meta = GNNAssets.pickSfx(r);
                if (meta) load(meta.id);
            });
        } else if (attempt < 40) {
            setTimeout(() => preloadCore(attempt + 1), 250);
        }
    }

    // ---------------------------------------------------------
    // Buffer loading
    // ---------------------------------------------------------

    function urlFor(id) {
        if (typeof GNNAssets !== 'undefined') {
            const meta = GNNAssets.sfxById(id);
            if (meta) return meta.file;
        }
        if (/^sfx_\d+$/.test(id)) return `assets/audio/${id}.wav`;
        if (/^intro_sfx_\d+$/.test(id)) return `assets/audio/${id}.wav`;
        return id;
    }

    function load(id) {
        if (buffers.has(id)) return Promise.resolve(buffers.get(id));
        if (loading.has(id)) return loading.get(id);
        if (!ctx) return Promise.resolve(null);
        const p = fetch(urlFor(id))
            .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('HTTP ' + r.status))))
            .then((ab) => ctx.decodeAudioData(ab))
            .then((buf) => { buffers.set(id, buf); loading.delete(id); return buf; })
            .catch(() => { buffers.set(id, null); loading.delete(id); return null; });
        loading.set(id, p);
        return p;
    }

    function preload(ids) {
        ensureContext();
        return Promise.all((ids || []).map(load));
    }

    // ---------------------------------------------------------
    // Playback
    // ---------------------------------------------------------

    /**
     * @param {string} id      sfx_NN / intro_sfx_NN
     * @param {Object} opts    { gain, rate, detune, delay, pan, reverse, loop }
     */
    function play(id, opts = {}) {
        if (muted || !ctx) return null;
        const buf = buffers.get(id);
        if (!buf) { load(id).then((b) => { if (b && !opts.noRetry) play(id, Object.assign({ noRetry: true }, opts)); }); return null; }
        try {
            const src = ctx.createBufferSource();
            src.buffer = buf;
            if (opts.rate) src.playbackRate.value = opts.rate;
            if (opts.detune && src.detune) src.detune.value = opts.detune;
            if (opts.loop) { src.loop = true; }

            let node = src;
            if (opts.pan !== undefined && ctx.createStereoPanner) {
                const pan = ctx.createStereoPanner();
                pan.pan.value = Math.max(-1, Math.min(1, opts.pan));
                node.connect(pan);
                node = pan;
            }
            const level = opts.gain !== undefined ? opts.gain : 1;
            const g = ctx.createGain();
            // Start silent. A GainNode defaults to unity, and if the scheduled
            // ramp below lands in the past the node never leaves that default —
            // playing the one-shot at full scale instead of its mix level.
            g.gain.value = 0.0001;
            node.connect(g);
            g.connect(opts.bus === 'music' ? musicBus : sfxBus);

            // Always schedule a hair into the future so the envelope is never
            // set for a time the graph has already rendered past.
            const when = ctx.currentTime + Math.max(opts.delay || 0, 0.002);
            // A few milliseconds of attack and release. The MOO1 effects do not
            // all begin or end on a zero crossing, and a truncated one-shot is
            // a step discontinuity — an audible click on every trigger.
            const ATT = 0.004;
            g.gain.setValueAtTime(0.0001, when);
            g.gain.linearRampToValueAtTime(level, when + ATT);
            const dur = opts.stopAfter
                || (opts.loop ? 0 : buf.duration / (opts.rate || 1));
            if (dur) {
                const REL = Math.min(0.02, dur / 4);
                g.gain.setValueAtTime(level, when + Math.max(ATT, dur - REL));
                g.gain.linearRampToValueAtTime(0.0001, when + dur);
            }
            src.start(when);
            if (opts.stopAfter) src.stop(when + opts.stopAfter + 0.01);
            return { source: src, gain: g };
        } catch (err) {
            return null;
        }
    }

    /** Play something matching a role, loading it first if need be. */
    function playRole(role, opts = {}) {
        if (typeof GNNAssets === 'undefined') return;
        const meta = GNNAssets.pickSfx(role, opts);
        if (!meta) return;
        if (buffers.has(meta.id)) play(meta.id, opts);
        else load(meta.id).then(() => play(meta.id, opts));
    }

    /** Layered one-shot: several effects fired with offsets, as one gesture. */
    function playChord(specs) {
        (specs || []).forEach((s) => {
            if (s.role) playRole(s.role, s);
            else if (s.id) play(s.id, s);
        });
    }

    let lastBlip = 0;

    /**
     * Teletype click. Throttled: the prompter can reveal several characters in
     * one frame when the loop catches up after a stall, and firing a blip for
     * each of them schedules them all at the *same* audio time, where they sum
     * into one spike instead of sounding like typing.
     */
    function playTypingBlip() {
        if (muted || !ctx) return;
        const now = ctx.currentTime;
        if (now - lastBlip < 0.022) return;
        lastBlip = now;
        if (buffers.get('sfx_06')) {
            play('sfx_06', {
                gain: VOLUME.teletype * (0.85 + Math.random() * 0.3),
                rate: 0.94 + Math.random() * 0.12,
                // Tiny stagger so two blips never land on the same sample.
                delay: Math.random() * 0.003,
            });
        } else {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.value = 900 + Math.random() * 240;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.0001, now);
            g.gain.linearRampToValueAtTime(0.02, now + 0.002);
            g.gain.exponentialRampToValueAtTime(0.0005, now + 0.025);
            osc.connect(g); g.connect(sfxBus);
            osc.start(now); osc.stop(now + 0.03);
        }
    }

    function playUiClick() { play('sfx_36', { gain: VOLUME.ui }); }
    function playKlaxon() { play('sfx_03', { gain: 0.7 }); }

    // ---------------------------------------------------------
    // Music bed (rendered from the 40 MUSIC.LBX MIDI tracks)
    // ---------------------------------------------------------

    function stopMusic(fade = 1.2) {
        if (!musicSource) return;
        const src = musicSource, g = musicGain;
        musicSource = null; musicGain = null; currentTrack = null;
        musicBaseGain = 1;
        try {
            g.gain.cancelScheduledValues(ctx.currentTime);
            g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
            g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + fade);
            src.stop(ctx.currentTime + fade + 0.05);
        } catch (_) { /* already stopped */ }
    }

    async function playMusic(trackId, opts = {}) {
        ensureContext();
        if (!ctx || muted) return;
        if (currentTrack === trackId && musicSource) return;
        const meta = (typeof GNNAssets !== 'undefined')
            ? GNNAssets.musicTracks().find((m) => m.id === trackId)
            : null;
        if (!meta) return;
        let buf = buffers.get(trackId);
        if (!buf) {
            try {
                const r = await fetch(meta.file);
                buf = await ctx.decodeAudioData(await r.arrayBuffer());
                buffers.set(trackId, buf);
            } catch (err) { return; }
        }
        rememberMusic(trackId);
        stopMusic(opts.crossfade === false ? 0.05 : 1.0);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = opts.loop !== false;
        if (opts.rate) src.playbackRate.value = opts.rate;
        const g = ctx.createGain();
        g.gain.value = 0.0001;
        src.connect(g); g.connect(musicBus);
        src.start(0, opts.offset || 0);
        musicBaseGain = opts.gain !== undefined ? opts.gain : 1;
        g.gain.linearRampToValueAtTime(
            Math.max(0.0001, musicBaseGain * musicDuck),
            ctx.currentTime + (opts.fadeIn || 1.4));
        musicSource = src; musicGain = g; currentTrack = trackId;
    }

    /**
     * Pull the music bed down while the anchor talks.
     *
     * `amount` is a *multiplier* on whatever level the bed was mixed at, not an
     * absolute gain. Treating it as absolute means every un-duck (amount = 1)
     * drives a bed that was mixed at 0.5 up to full scale — which is heard as
     * the music swelling at the end of every single spoken line.
     */
    function duckMusic(amount, seconds = 0.35) {
        musicDuck = amount;
        if (!musicGain || !ctx) return;
        ramp(musicGain.gain, musicBaseGain * amount, seconds);
    }

    function getCurrentTrack() { return currentTrack; }

    // ---------------------------------------------------------
    // Glitch stage
    // ---------------------------------------------------------

    let crushUntil = 0;

    /**
     * Crush the whole station bus for `ms` (used by broadcast anomalies).
     *
     * Three things here have to be gentle even though the effect is not:
     * the WaveShaper curve is only swapped while the wet path is silent (a
     * live transfer-function change is a step on every sample at once); wet
     * and dry crossfade rather than switch; and they always sum to one, so
     * the crush changes the timbre without jolting the level.
     */
    function glitchCrush(bits = 4, ms = 700) {
        if (!ctx) return;
        const t = ctx.currentTime;
        const depth = Math.max(4, bits);
        if (t >= crushUntil) {
            // Wet path is silent right now, so re-quantising is inaudible.
            crusher.curve = makeCrusherCurve(depth);
        }
        crushUntil = t + ms / 1000 + 0.14;

        const IN = 0.016, OUT = 0.14;
        crusherWet.gain.cancelScheduledValues(t);
        crusherDry.gain.cancelScheduledValues(t);
        crusherWet.gain.setValueAtTime(crusherWet.gain.value, t);
        crusherDry.gain.setValueAtTime(crusherDry.gain.value, t);
        crusherWet.gain.linearRampToValueAtTime(1, t + IN);
        crusherDry.gain.linearRampToValueAtTime(0.0001, t + IN);
        const back = t + ms / 1000;
        crusherWet.gain.setValueAtTime(1, back);
        crusherDry.gain.setValueAtTime(0.0001, back);
        crusherWet.gain.linearRampToValueAtTime(0.0001, back + OUT);
        crusherDry.gain.linearRampToValueAtTime(1, back + OUT);
    }

    /**
     * Drag the music bed down like a dying tape transport.
     *
     * Done with playback rate alone this needs a near-standstill to read as a
     * tape stop, and an AudioBufferSourceNode's resampler stair-steps badly
     * down there — it measures as dozens of discontinuities. A moderate rate
     * drop plus a treble roll-off and a level dip sounds more like the real
     * thing and stays clean.
     */
    function tapeStop(ms = 900) {
        if (!musicSource || !ctx) return;
        const t = ctx.currentTime;
        const dur = ms / 1000;
        const back = t + dur;

        const r = musicSource.playbackRate;
        r.cancelScheduledValues(t);
        r.setValueAtTime(r.value, t);
        r.linearRampToValueAtTime(0.62, back);
        r.linearRampToValueAtTime(1, back + 0.7);

        if (musicFilter) {
            const f = musicFilter.frequency;
            f.cancelScheduledValues(t);
            f.setValueAtTime(f.value, t);
            f.exponentialRampToValueAtTime(420, back);
            f.exponentialRampToValueAtTime(20000, back + 0.8);
        }
        if (musicGain) {
            const g = musicGain.gain;
            const level = Math.max(0.0001, g.value);
            g.cancelScheduledValues(t);
            g.setValueAtTime(level, t);
            g.linearRampToValueAtTime(level * 0.45, back);
            g.linearRampToValueAtTime(level, back + 0.7);
        }
    }

    function setStationGain(v, seconds = 0.2) {
        if (!ctx) return;
        ramp(masterGain.gain, v, seconds);
    }

    // ---------------------------------------------------------
    // Mute / plumbing
    // ---------------------------------------------------------

    function toggleMute() {
        muted = !muted;
        if (ctx) setStationGain(muted ? 0.0001 : 1, 0.15);
        return muted;
    }

    function isMuted() { return muted; }
    function getContext() { return ctx; }
    function getVoiceBus() { ensureContext(); return voiceBus; }
    /** Post-compressor bus, for output analysis (tools/audio_probe.py). */
    function getMasterBus() { ensureContext(); return masterGain; }

    /** Current music bed level and the pieces it is derived from. */
    function getMusicLevel() {
        return {
            gain: musicGain ? musicGain.gain.value : 0,
            base: musicBaseGain,
            duck: musicDuck,
        };
    }

    return {
        ensureContext, getContext, getVoiceBus, getMasterBus, whenRunning,
        getMusicLevel,
        preload, load, play, playRole, playChord, CORE_SFX,
        playTypingBlip, playUiClick, playKlaxon,
        playMusic, stopMusic, duckMusic, getCurrentTrack,
        glitchCrush, tapeStop, setStationGain,
        toggleMute, isMuted,
        VOLUME,
    };
})();
