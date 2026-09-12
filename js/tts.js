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
    let voiceGain = null;
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

    /**
     * Tap the element into the station's voice bus.
     *
     * Routing into a *suspended* context stalls playback and the 'ended' event
     * never arrives, so this has to wait for a running context. But it must
     * actually wait: bailing out on a synchronous state check and never
     * retrying leaves the element wired straight to the browser's own output,
     * bypassing the compressor, the ducking and the glitch stage — so the
     * first line of a session plays at a different, unprocessed loudness from
     * every line after it.
     */
    function attachAnalyser() {
        if (mediaSource || typeof GNNAudio === 'undefined') return;
        GNNAudio.whenRunning(connectGraph);
    }

    function connectGraph() {
        if (mediaSource || typeof GNNAudio === 'undefined') return;
        const ctx = GNNAudio.getContext();
        if (!ctx || ctx.state !== 'running') return;
        try {
            mediaSource = ctx.createMediaElementSource(element());
            analyser = ctx.createAnalyser();
            analyser.fftSize = 512;
            analyser.smoothingTimeConstant = 0.55;
            levelData = new Uint8Array(analyser.frequencyBinCount);
            // Own gain stage so a line can be faded rather than guillotined.
            voiceGain = ctx.createGain();
            voiceGain.gain.value = 1;
            mediaSource.connect(analyser);
            analyser.connect(voiceGain);
            voiceGain.connect(GNNAudio.getVoiceBus());
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

    const FADE = 0.035;

    /**
     * Cut the voice without a click.
     *
     * Pausing a media element mid-word leaves the waveform wherever it was,
     * which is a step discontinuity straight into the output — a pop on every
     * skip and every segment change. Duck the voice stage first, then pause a
     * few milliseconds later once the level is already at zero.
     */
    /** Duck the voice stage to silence. Returns ms to wait before cutting. */
    function duckVoice() {
        if (!voiceGain || typeof GNNAudio === 'undefined') return 0;
        const ctx = GNNAudio.getContext();
        if (!ctx || !audioEl || audioEl.paused) return 0;
        const t = ctx.currentTime;
        voiceGain.gain.cancelScheduledValues(t);
        voiceGain.gain.setValueAtTime(voiceGain.gain.value, t);
        voiceGain.gain.linearRampToValueAtTime(0.0001, t + FADE);
        return FADE * 1000 + 8;
    }

    function cutElement() {
        if (!audioEl) return;
        try { audioEl.pause(); } catch (_) {}
        try { audioEl.removeAttribute('src'); audioEl.load(); } catch (_) {}
    }

    function stop() {
        const myId = ++requestId;
        const wait = duckVoice();
        if (wait) {
            // Only cut if nothing newer has taken the element in the meantime,
            // otherwise this timer guillotines the line that just started.
            setTimeout(() => { if (requestId === myId) cutElement(); }, wait);
        } else {
            cutElement();
        }
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            try { window.speechSynthesis.cancel(); } catch (_) {}
        }
        finish();
    }

    /** Bring the voice stage back up for a new line, from silence. */
    function openVoiceGate() {
        if (!voiceGain || typeof GNNAudio === 'undefined') return;
        const ctx = GNNAudio.getContext();
        if (!ctx) return;
        const t = ctx.currentTime;
        voiceGain.gain.cancelScheduledValues(t);
        voiceGain.gain.setValueAtTime(0.0001, t);
        voiceGain.gain.linearRampToValueAtTime(1, t + 0.03);
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

        // Fade whatever is on air, then take the element once it is silent.
        // Settle the outgoing line's promise first: superseding it without
        // resolving leaves a pending promise for every interrupted segment.
        const handoverMs = duckVoice();
        const id = ++requestId;
        if (!handoverMs) cutElement();
        resolveNow();

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
                + '&rate=' + encodeURIComponent((opts.rate !== undefined ? opts.rate : ratePct) + '%')
                // Lets the server drop this request if we have already asked
                // for a newer line by the time it reaches the front of the
                // synthesis queue.
                + '&seq=' + id;

            const el = element();
            // Hard watchdog: whatever happens to the element — stall, mute
            // policy, decode failure — the director gets its callback.
            const guard = setTimeout(() => {
                if (id !== requestId) return;
                // Give up on the line *and* silence it. Resolving alone leaves
                // a slow synthesis free to start playing later, on top of
                // whatever segment the director has moved on to.
                cutElement();
                finish();
            }, estimateMs(clean) * 2.2 + 6000);
            const clearGuard = () => clearTimeout(guard);

            el.onended = () => { clearGuard(); if (id === requestId) finish(); };
            el.onerror = () => {
                clearGuard();
                if (id !== requestId) return;
                if (available !== null) { finish(); return; }
                // The element cannot see the status code, and a superseded or
                // transiently failed request must not condemn the whole
                // endpoint to the browser-voice fallback. Ask the server
                // directly before deciding.
                fetch('api/status')
                    .then((r) => (r.ok ? r.json() : null))
                    .then((st) => {
                        if (st && st.tts) { available = true; finish(); return; }
                        available = false;
                        browserFallback(clean, id).then(() => {
                            if (id === requestId) finish();
                        });
                    })
                    .catch(() => {
                        available = false;
                        browserFallback(clean, id).then(() => {
                            if (id === requestId) finish();
                        });
                    });
            };
            el.oncanplay = () => { if (id === requestId) available = true; };
            el.onstalled = () => { clearGuard(); if (id === requestId) finish(); };
            // Replacing .src on a playing element halts it wherever the
            // waveform happened to be, so let the outgoing line reach silence
            // first. 40ms is inaudible against a newscast's pacing.
            const begin = () => {
                if (id !== requestId) return;
                el.src = url;
                el.playbackRate = opts.playbackRate || 1;
                openVoiceGate();
                const p = el.play();
                if (p && p.catch) {
                    p.catch(() => {
                        clearGuard();
                        if (id !== requestId) return;
                        // Autoplay still locked — keep the clock honest by
                        // running the segment on the estimated read length.
                        setTimeout(() => { if (id === requestId) finish(); },
                                   estimateMs(clean));
                    });
                }
            };
            if (handoverMs > 0) setTimeout(begin, handoverMs); else begin();
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
    /** Glitch hook. Stepping the rate mid-word clicks, so glide it. */
    let rateTimer = null;
    function nudgePlaybackRate(r) {
        if (!audioEl) return;
        if (rateTimer) { clearInterval(rateTimer); rateTimer = null; }
        const from = audioEl.playbackRate || 1;
        const steps = 8;
        let i = 0;
        rateTimer = setInterval(() => {
            i++;
            if (!audioEl) { clearInterval(rateTimer); rateTimer = null; return; }
            audioEl.playbackRate = from + (r - from) * (i / steps);
            if (i >= steps) { clearInterval(rateTimer); rateTimer = null; }
        }, 12);
    }

    return {
        VOICES, speak, stop, unlock, getLevel, estimateMs,
        setVoice, getVoice, setEnabled, isEnabled, isSpeaking,
        setPitch, setRate, nudgePlaybackRate,
        set onStart(fn) { onStart = fn; },
        set onEnd(fn) { onEnd = fn; },
    };
})();
