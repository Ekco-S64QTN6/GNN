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
    let sfxBus = null;
    let musicBus = null;
    let voiceBus = null;
    let stationBus = null;
    let crusher = null;          // WaveShaper used for the glitch bitcrush
    let crusherWet = null;
    let crusherDry = null;

    const buffers = new Map();   // id -> AudioBuffer
    const loading = new Map();

    let musicSource = null;
    let musicGain = null;
    let currentTrack = null;
    let musicDuck = 1;

    const VOLUME = { sfx: 0.55, music: 0.28, voice: 1.0, teletype: 0.14, ui: 0.3 };

    // ---------------------------------------------------------
    // Graph
    // ---------------------------------------------------------

    function makeCrusherCurve(bits) {
        const n = 1024;
        const curve = new Float32Array(n);
        const levels = Math.pow(2, bits);
        for (let i = 0; i < n; i++) {
            const x = (i / (n - 1)) * 2 - 1;
            curve[i] = Math.round(x * levels) / levels;
        }
        return curve;
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

            sfxBus.connect(stationBus);
            musicBus.connect(stationBus);
            voiceBus.connect(stationBus);

            stationBus.connect(crusherDry);
            stationBus.connect(crusher);
            crusher.connect(crusherWet);
            crusherDry.connect(comp);
            crusherWet.connect(comp);
            comp.connect(masterGain);
            masterGain.connect(ctx.destination);
        }
        if (ctx.state === 'suspended') ctx.resume();
        if (!initialized) {
            initialized = true;
            preloadCore();
        }
        return ctx;
    }

    /** The handful of effects the broadcast leans on constantly. */
    function preloadCore() {
        ['sfx_06', 'sfx_36', 'sfx_03', 'sfx_14', 'sfx_05'].forEach(load);
        if (typeof GNNAssets !== 'undefined' && GNNAssets.isReady()) {
            // Warm a spread of roles so the first cutaway is not silent.
            ['servo', 'sweep', 'blast', 'drone', 'beep', 'chirp', 'zap']
                .forEach((r) => {
                    const s = GNNAssets.pickSfx(r);
                    if (s) load(s.id);
                });
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
            const g = ctx.createGain();
            g.gain.value = opts.gain !== undefined ? opts.gain : 1;
            node.connect(g);
            g.connect(opts.bus === 'music' ? musicBus : sfxBus);

            const when = ctx.currentTime + (opts.delay || 0);
            src.start(when);
            if (opts.stopAfter) src.stop(when + opts.stopAfter);
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

    function playTypingBlip() {
        if (muted || !ctx) return;
        if (buffers.get('sfx_06')) {
            play('sfx_06', { gain: VOLUME.teletype, rate: 0.94 + Math.random() * 0.12 });
        } else {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.value = 900 + Math.random() * 240;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.02, now);
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
        stopMusic(opts.crossfade === false ? 0.05 : 1.0);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = opts.loop !== false;
        if (opts.rate) src.playbackRate.value = opts.rate;
        const g = ctx.createGain();
        g.gain.value = 0.0001;
        src.connect(g); g.connect(musicBus);
        src.start(0, opts.offset || 0);
        g.gain.linearRampToValueAtTime(
            (opts.gain !== undefined ? opts.gain : 1) * musicDuck,
            ctx.currentTime + (opts.fadeIn || 1.4));
        musicSource = src; musicGain = g; currentTrack = trackId;
    }

    /** Pull the music bed down while the anchor talks. */
    function duckMusic(amount, seconds = 0.35) {
        musicDuck = amount;
        if (!musicGain || !ctx) return;
        const target = Math.max(0.0001, amount);
        musicGain.gain.cancelScheduledValues(ctx.currentTime);
        musicGain.gain.setValueAtTime(musicGain.gain.value, ctx.currentTime);
        musicGain.gain.linearRampToValueAtTime(target, ctx.currentTime + seconds);
    }

    function getCurrentTrack() { return currentTrack; }

    // ---------------------------------------------------------
    // Glitch stage
    // ---------------------------------------------------------

    /** Crush the whole station bus for `ms` (used by broadcast anomalies). */
    function glitchCrush(bits = 3, ms = 700) {
        if (!ctx) return;
        crusher.curve = makeCrusherCurve(bits);
        const t = ctx.currentTime;
        crusherWet.gain.cancelScheduledValues(t);
        crusherDry.gain.cancelScheduledValues(t);
        crusherWet.gain.setValueAtTime(1, t);
        crusherDry.gain.setValueAtTime(0.15, t);
        crusherWet.gain.setValueAtTime(1, t + ms / 1000);
        crusherWet.gain.linearRampToValueAtTime(0, t + ms / 1000 + 0.12);
        crusherDry.gain.linearRampToValueAtTime(1, t + ms / 1000 + 0.12);
    }

    /** Drag the music bed down like a dying tape transport. */
    function tapeStop(ms = 900) {
        if (!musicSource || !ctx) return;
        const t = ctx.currentTime;
        const r = musicSource.playbackRate;
        r.cancelScheduledValues(t);
        r.setValueAtTime(r.value, t);
        r.linearRampToValueAtTime(0.08, t + ms / 1000);
        r.linearRampToValueAtTime(1, t + ms / 1000 + 0.5);
    }

    function setStationGain(v, seconds = 0.2) {
        if (!ctx) return;
        masterGain.gain.cancelScheduledValues(ctx.currentTime);
        masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
        masterGain.gain.linearRampToValueAtTime(Math.max(0.0001, v), ctx.currentTime + seconds);
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

    return {
        ensureContext, getContext, getVoiceBus,
        preload, load, play, playRole, playChord,
        playTypingBlip, playUiClick, playKlaxon,
        playMusic, stopMusic, duckMusic, getCurrentTrack,
        glitchCrush, tapeStop, setStationGain,
        toggleMute, isMuted,
        VOLUME,
    };
})();
