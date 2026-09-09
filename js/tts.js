/* ============================================================
   GNN — Neural Voice Client
   ------------------------------------------------------------
   Talks to the local /api/tts endpoint (edge-tts, zero cloud
   account required) and plays the result through the station's
   voice bus so the music bed ducks under it and the glitch
   stage can chew on it.

   The element is also tapped by an AnalyserNode: `getLevel()`
   returns the current mouth-opening amplitude, which is what
   drives the anchor's 25-frame lip-sync matrix. Before this the
   mouth flapped on a random timer; now it tracks the actual
   waveform.
   ============================================================ */

const GNNTTS = (() => {
    'use strict';

    const ENDPOINT = 'api/tts';

    const VOICES = [
        { id: 'en-US-GuyNeural', label: 'GUY — Anchor Prime' },
        { id: 'en-US-BrianNeural', label: 'BRIAN — Deep Baritone' },
        { id: 'en-US-EricNeural', label: 'ERIC — Resonant Sci-Fi' },
        { id: 'en-US-SteffanNeural', label: 'STEFFAN — Broadcast Desk' },
        { id: 'en-GB-RyanNeural', label: 'RYAN — Interstellar BBC' },
        { id: 'en-US-AriaNeural', label: 'ARIA — Anchor (F)' },
        { id: 'en-US-AvaNeural', label: 'AVA — Smooth Sci-Fi (F)' },
        { id: 'en-AU-WilliamNeural', label: 'WILLIAM — Outer Rim' },
        { id: 'en-IE-ConnorNeural', label: 'CONNOR — Field Correspondent' },
    ];

    let voice = VOICES[0].id;
    let enabled = true;
    let unlocked = false;
    let available = null;          // null = untested, false = fall back

    let audioEl = null;
    let mediaSource = null;
    let analyser = null;
    let levelData = null;

    let requestId = 0;
    let speaking = false;
    let currentResolve = null;
    let pitchHz = -10;
    let ratePct = -5;

    let onStart = null;
    let onEnd = null;

    // ---------------------------------------------------------
    // Element + analyser plumbing
    // ---------------------------------------------------------

    function element() {
        if (!audioEl) {
            audioEl = new Audio();
            audioEl.preload = 'auto';
            audioEl.crossOrigin = 'anonymous';
        }
        return audioEl;
    }

    function attachAnalyser() {
        if (mediaSource || typeof GNNAudio === 'undefined') return;
        const ctx = GNNAudio.getContext();
        // Routing the element into a *suspended* context stalls playback and
        // the 'ended' event never arrives. Stay on the direct output until the
        // context has actually been started by a gesture.
        if (!ctx || ctx.state !== 'running') return;
        try {
            mediaSource = ctx.createMediaElementSource(element());
            analyser = ctx.createAnalyser();
            analyser.fftSize = 512;
            analyser.smoothingTimeConstant = 0.55;
            levelData = new Uint8Array(analyser.frequencyBinCount);
            mediaSource.connect(analyser);
            analyser.connect(GNNAudio.getVoiceBus());
        } catch (err) {
            // Some browsers refuse a second MediaElementSource; playback still works.
            mediaSource = null; analyser = null;
        }
    }

    /** 0..1 mouth-opening amplitude for the current instant. */
    function getLevel() {
        if (!speaking) return 0;
        if (!analyser) return 0.55 + Math.sin(performance.now() / 90) * 0.25;
        analyser.getByteFrequencyData(levelData);
        // Vowel energy lives low; weight the bottom third of the spectrum.
        let sum = 0;
        const n = Math.max(1, levelData.length / 3) | 0;
        for (let i = 0; i < n; i++) sum += levelData[i];
        return Math.min(1, (sum / n) / 128);
    }

    function unlock() {
        if (unlocked) return;
        unlocked = true;
        const el = element();
        el.muted = true;
        const p = el.play();
        if (p && p.catch) p.catch(() => {});
        el.pause();
        el.muted = false;
        el.currentTime = 0;
        attachAnalyser();
    }

    // ---------------------------------------------------------
    // Speaking
    // ---------------------------------------------------------

    function sanitize(text) {
        return String(text || '')
            .replace(/\s*—\s*/g, ', ')
            .replace(/[«»"“”]/g, '')
            .replace(/&[a-z]+;/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /** Rough spoken-duration estimate (ms) used when audio is unavailable. */
    function estimateMs(text) {
        const words = sanitize(text).split(/\s+/).filter(Boolean).length;
        return Math.max(1200, (words / 2.6) * 1000);
    }

    function stop() {
        requestId++;
        const el = element();
        try { el.pause(); } catch (_) {}
        try { el.removeAttribute('src'); el.load(); } catch (_) {}
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            try { window.speechSynthesis.cancel(); } catch (_) {}
        }
        finish();
    }

    function finish() {
        if (!speaking) { resolveNow(); return; }
        speaking = false;
        if (typeof GNNAudio !== 'undefined') GNNAudio.duckMusic(1, 0.9);
        if (onEnd) onEnd();
        resolveNow();
    }

    function resolveNow() {
        const r = currentResolve;
        currentResolve = null;
        if (r) r();
    }

    function browserFallback(text, id) {
        return new Promise((resolve) => {
            if (!window.speechSynthesis) {
                setTimeout(resolve, estimateMs(text));
                return;
            }
            const u = new SpeechSynthesisUtterance(sanitize(text));
            u.rate = 0.98; u.pitch = 0.72;
            u.onend = () => { if (id === requestId) resolve(); };
            u.onerror = () => { if (id === requestId) resolve(); };
            window.speechSynthesis.speak(u);
        });
    }

    /**
     * Speak a line. Always resolves — the broadcast clock never blocks on it.
     * @returns {Promise<void>}
     */
    function speak(text, opts = {}) {
        const clean = sanitize(text);
        if (!enabled || !clean) {
            return new Promise((r) => setTimeout(r, opts.silentMs || 300));
        }

        stop();
        const id = ++requestId;

        speaking = true;
        if (typeof GNNAudio !== 'undefined') {
            GNNAudio.ensureContext();
            GNNAudio.duckMusic(opts.duck !== undefined ? opts.duck : 0.28, 0.25);
        }
        attachAnalyser();
        if (onStart) onStart();

        return new Promise((resolve) => {
            currentResolve = resolve;

            if (available === false) {
                browserFallback(clean, id).then(() => { if (id === requestId) finish(); });
                return;
            }

            const url = ENDPOINT
                + '?text=' + encodeURIComponent(clean.slice(0, 900))
                + '&voice=' + encodeURIComponent(opts.voice || voice)
                + '&pitch=' + encodeURIComponent((opts.pitch !== undefined ? opts.pitch : pitchHz) + 'Hz')
                + '&rate=' + encodeURIComponent((opts.rate !== undefined ? opts.rate : ratePct) + '%');

            const el = element();
            // Hard watchdog: whatever happens to the element — stall, mute
            // policy, decode failure — the director gets its callback.
            const guard = setTimeout(() => {
                if (id === requestId) finish();
            }, estimateMs(clean) * 2.2 + 6000);
            const clearGuard = () => clearTimeout(guard);

            el.onended = () => { clearGuard(); if (id === requestId) finish(); };
            el.onerror = () => {
                clearGuard();
                if (id !== requestId) return;
                if (available === null) {
                    available = false;
                    browserFallback(clean, id).then(() => { if (id === requestId) finish(); });
                } else {
                    finish();
                }
            };
            el.oncanplay = () => { if (id === requestId) available = true; };
            el.onstalled = () => { clearGuard(); if (id === requestId) finish(); };
            el.src = url;
            el.playbackRate = opts.playbackRate || 1;
            const p = el.play();
            if (p && p.catch) {
                p.catch(() => {
                    clearGuard();
                    if (id !== requestId) return;
                    // Autoplay still locked — keep the clock honest by running
                    // the segment on the estimated read length instead.
                    setTimeout(() => { if (id === requestId) finish(); }, estimateMs(clean));
                });
            }
        });
    }

    // ---------------------------------------------------------
    // Voice controls (used by the glitch engine as well as the UI)
    // ---------------------------------------------------------

    function setVoice(v) { voice = v; }
    function getVoice() { return voice; }
    function setEnabled(v) { enabled = !!v; if (!enabled) stop(); }
    function isEnabled() { return enabled; }
    function isSpeaking() { return speaking; }
    function setPitch(hz) { pitchHz = hz; }
    function setRate(pct) { ratePct = pct; }
    function nudgePlaybackRate(r) { if (audioEl) audioEl.playbackRate = r; }

    return {
        VOICES, speak, stop, unlock, getLevel, estimateMs,
        setVoice, getVoice, setEnabled, isEnabled, isSpeaking,
        setPitch, setRate, nudgePlaybackRate,
        set onStart(fn) { onStart = fn; },
        set onEnd(fn) { onEnd = fn; },
    };
})();
