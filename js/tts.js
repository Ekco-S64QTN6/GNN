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

    // Identifies this page load to the server's supersede check. requestId
    // restarts at zero on every reload, so without a session to scope it to,
    // a fresh page's first requests all look older than the previous page's
    // last one and the server refuses every one of them.
    const SESSION = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);

    /**
     * The *Multilingual* voices are a later generation than the plain
     * Neural ones and are audibly less synthetic; they lead the list and
     * supply the default. The older voices are kept below them for variety,
     * not for quality. `tools/voice_audition.py` renders the whole list to
     * disk if you want to compare them back to back.
     */
    // Fallback only: replaced at boot by whatever /api/voices reports, so the
    // selector always matches the engine that is actually running. These are
    // the edge-tts picks, chosen by ear from tools/voice_audition.py — the
    // newer "Multilingual" models read too slowly for a news anchor.
    const VOICES = [
        { id: 'en-GB-RyanNeural', label: 'RYAN — Interstellar BBC' },
        { id: 'en-AU-WilliamNeural', label: 'WILLIAM — Outer Rim' },
        { id: 'en-GB-ThomasNeural', label: 'THOMAS — Sector Desk' },
        { id: 'en-IE-ConnorNeural', label: 'CONNOR — Field Correspondent' },
        { id: 'en-US-EricNeural', label: 'ERIC — Resonant Sci-Fi' },
        { id: 'en-US-SteffanNeural', label: 'STEFFAN — Broadcast Desk' },
        { id: 'en-US-BrianNeural', label: 'BRIAN — Deep Baritone' },
        { id: 'en-US-GuyNeural', label: 'GUY — Anchor Prime' },
        { id: 'en-US-AriaNeural', label: 'ARIA — Anchor (F)' },
        { id: 'en-US-AvaNeural', label: 'AVA — Smooth Sci-Fi (F)' },
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
    let lastLine = null;           // {text, opts} of the line currently on air
    let currentResolve = null;
    // Flat by default. The -5% rate was a large part of what read as the
    // anchor dragging: every line, including the ones that already had a
    // slow delivery, was being slowed further.
    let pitchHz = 0;
    let ratePct = 0;
    let engine = null;
    let cloud = false;

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
            // With preservesPitch left at its default, any playbackRate other
            // than 1 puts Chromium's WSOLA time-stretcher in the path, which
            // is mushy on short buffers. The glitch engine only ever drags the
            // rate to simulate a failing transport, and a real transport drops
            // pitch as it slows -- so resampling is both cleaner and more
            // faithful than stretching.
            audioEl.preservesPitch = false;
            audioEl.mozPreservesPitch = false;
            audioEl.webkitPreservesPitch = false;
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

    /**
     * The endpoint takes a bounded string, but cutting at a fixed index lands
     * mid-word and the anchor dutifully reads the fragment as written —
     * "...the agency confirmed the la". Back up to the last sentence inside
     * the budget, or failing that the last whole word.
     */
    function trimForSynthesis(text, maxChars = 900) {
        if (text.length <= maxChars) return text;
        const head = text.slice(0, maxChars);
        const stop = Math.max(head.lastIndexOf('. '),
                              head.lastIndexOf('! '),
                              head.lastIndexOf('? '));
        if (stop > maxChars * 0.4) return head.slice(0, stop + 1).trim();
        const space = head.lastIndexOf(' ');
        return (space > 0 ? head.slice(0, space) : head).trim() + '.';
    }

    /** Rough spoken-duration estimate (ms) used when audio is unavailable. */
    function estimateMs(text) {
        const words = sanitize(text).split(/\s+/).filter(Boolean).length;
        return Math.max(1200, (words / 2.6) * 1000);
    }

    const FADE = 0.035;
    // Release margin between the end of a line and the next segment.
    const TAIL_MS = 280;

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

    /**
     * Stop any in-flight playback-rate glide.
     *
     * The glide is an interval that writes playbackRate eight times over ~96ms.
     * Nothing used to cancel it when a new line started, so `el.playbackRate =
     * 1` in begin() was immediately overwritten by the tail of an anomaly's
     * glide and the next story played back stretched from its first word.
     */
    function cancelRateGlide() {
        if (rateTimer) { clearInterval(rateTimer); rateTimer = null; }
    }

    function cutElement() {
        if (!audioEl) return;
        try { audioEl.pause(); } catch (_) {}
        try { audioEl.removeAttribute('src'); audioEl.load(); } catch (_) {}
        if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
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
        if (typeof GNNAudio !== 'undefined') GNNAudio.duckUnderVoice(false);
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
    // ---------------------------------------------------------
    // Clip fetching
    // ---------------------------------------------------------
    //
    // The element used to be pointed straight at /api/tts, which meant the
    // voice did not start until synthesis finished — one to four seconds
    // after the segment it belongs to. The director's timers ran anyway, so
    // lines were still playing when the next segment cut them off. Fetching
    // the clip first makes playback start immediately, lets a line be warmed
    // up before it is needed, and lets a failure be read from a status code
    // instead of guessed at from an element error.

    const clipCache = new Map();      // key -> Promise<Blob|null>
    const CLIP_CACHE = 16;
    let objectUrl = null;

    function clipKey(clean, opts) {
        return [trimForSynthesis(clean), opts.voice || voice,
                (opts.pitch !== undefined ? opts.pitch : pitchHz),
                (opts.rate !== undefined ? opts.rate : ratePct)].join('|');
    }

    function buildUrl(clean, opts, seq) {
        return ENDPOINT
            + '?text=' + encodeURIComponent(trimForSynthesis(clean))
            + '&voice=' + encodeURIComponent(opts.voice || voice)
            + '&pitch=' + encodeURIComponent((opts.pitch !== undefined ? opts.pitch : pitchHz) + 'Hz')
            + '&rate=' + encodeURIComponent((opts.rate !== undefined ? opts.rate : ratePct) + '%')
            // Lets the server drop this request if we have already asked for a
            // newer line by the time it reaches the synthesis queue. A warm-up
            // sends 0, which neither supersedes nor can be superseded.
            + '&seq=' + seq
            + '&sid=' + SESSION;
    }

    function fetchClip(clean, opts, seq) {
        const key = clipKey(clean, opts);
        const hit = clipCache.get(key);
        if (hit) return hit;
        const pending = fetch(buildUrl(clean, opts, seq))
            .then((r) => {
                if (r.status === 503) { available = false; return null; }
                if (!r.ok) { clipCache.delete(key); return null; }
                available = true;
                return r.blob();
            })
            .catch(() => {
                clipCache.delete(key);
                if (available === null) available = false;
                return null;
            });
        clipCache.set(key, pending);
        while (clipCache.size > CLIP_CACHE) {
            clipCache.delete(clipCache.keys().next().value);
        }
        return pending;
    }

    /**
     * Replace the built-in list with whatever the server is actually running.
     *
     * The engine owns its own voice ids — Kokoro's look nothing like
     * edge-tts's — so the selector is built from the server rather than
     * hardcoded, and cannot drift out of sync with the backend.
     */
    async function loadCatalogue() {
        try {
            const r = await fetch('api/voices');
            if (!r.ok) return null;
            const cat = await r.json();
            if (cat && cat.voices && cat.voices.length) {
                VOICES.length = 0;
                cat.voices.forEach((v) => VOICES.push(v));
                voice = VOICES[0].id;
            }
            engine = cat && cat.engine;
            cloud = !!(cat && cat.cloud);
            return cat;
        } catch (err) {
            return null;
        }
    }

    /** Warm a line so it plays the instant it is called for. */
    function prefetch(text, opts = {}) {
        const clean = sanitize(text);
        if (!enabled || !clean || available === false) return;
        fetchClip(clean, opts, 0);
    }

    function setSource(url) {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = url;
        element().src = url;
    }

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
        lastLine = { text: clean, opts: opts };
        if (typeof GNNAudio !== 'undefined') {
            GNNAudio.ensureContext();
            // Music dips to -14dB, effects to -10dB, both for as long as the
            // anchor is on air. Depths live in the audio engine; a caller that
            // wants a segment closer to the bed passes its own.
            GNNAudio.duckUnderVoice(true, { music: opts.duck, effects: opts.duckSfx });
        }
        attachAnalyser();
        if (onStart) onStart();

        return new Promise((resolve) => {
            currentResolve = resolve;

            if (available === false) {
                browserFallback(clean, id).then(() => { if (id === requestId) finish(); });
                return;
            }

            const el = element();
            // Hard watchdog: whatever happens to the clip — a stalled fetch,
            // a decode failure, an autoplay refusal — the director gets its
            // callback.
            const guard = setTimeout(() => {
                if (id !== requestId) return;
                cutElement();
                finish();
            }, estimateMs(clean) * 2.2 + 6000);
            const clearGuard = () => clearTimeout(guard);

            // Hand over a beat after the element reports the end rather than
            // on the event itself. The decoder signals 'ended' as the last
            // frame is handed to the device, not as it is heard, and the
            // director tearing down the segment on that edge clips the final
            // syllable of the line.
            el.onended = () => {
                clearGuard();
                if (id !== requestId) return;
                setTimeout(() => { if (id === requestId) finish(); }, TAIL_MS);
            };
            el.onerror = () => {
                clearGuard();
                if (id === requestId) finish();
            };

            fetchClip(clean, opts, id).then((blob) => {
                if (id !== requestId) { clearGuard(); return; }
                if (!blob) {
                    clearGuard();
                    if (available === false) {
                        browserFallback(clean, id).then(() => {
                            if (id === requestId) finish();
                        });
                    } else {
                        finish();
                    }
                    return;
                }
                const begin = () => {
                    if (id !== requestId) { clearGuard(); return; }
                    setSource(URL.createObjectURL(blob));
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
        });
    }

    // ---------------------------------------------------------
    // Voice controls (used by the glitch engine as well as the UI)
    // ---------------------------------------------------------

    /**
     * Switch the anchor's voice, including under the line already on air.
     *
     * The voice is a per-request parameter, so this used to take effect only
     * on the *next* line: the current one kept reading in the old voice, which
     * made the selector feel broken and is why muting and unmuting appeared to
     * fix it -- that forced a new line. Re-issue the line in flight instead,
     * handing the director's promise over to the replacement so the rundown
     * clock never sees the swap.
     */
    function setVoice(v) {
        if (!v || v === voice) return;
        voice = v;
        if (!speaking || !lastLine) return;
        const pending = currentResolve;   // the director is still awaiting this
        currentResolve = null;            // so speak()'s resolveNow() is a no-op
        speak(lastLine.text, lastLine.opts);
        currentResolve = pending;         // the new line now owns the promise
    }
    function getVoice() { return voice; }
    function setEnabled(v) { enabled = !!v; if (!enabled) { cancelRateGlide(); stop(); } }
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
        VOICES, speak, prefetch, stop, unlock, getLevel, estimateMs,
        loadCatalogue, getEngine: () => engine, isCloud: () => cloud,
        setVoice, getVoice, setEnabled, isEnabled, isSpeaking,
        setPitch, setRate, nudgePlaybackRate,
        set onStart(fn) { onStart = fn; },
        set onEnd(fn) { onEnd = fn; },
    };
})();
