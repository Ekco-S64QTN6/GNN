/* ============================================================
   GNN — Broadcast Director
   ------------------------------------------------------------
   Owns the clock. Everything the station does in time is decided
   here.

   The old build had one mode: read the next headline, forever,
   with a fixed two-second gap. A real newscast has rhythm — the
   anchor lands a story, lets it sit, adds a line of his own,
   throws to the next item, and every few stories the whole desk
   goes away for a break.

   The rundown is generated as it plays:

       READ -> HOLD -> [BANTER -> HOLD] -> [TOSS] -> READ ...
                                   \-> BREAK every 4-7 stories
                                   \-> IDENT every ~11 stories

   HOLD is real dead air: the voice is silent, the prompter keeps
   the last line up, the anchor's mouth is shut and the room tone
   carries it. That silence is the single biggest difference
   between "a page reading RSS" and "a channel that is on".
   ============================================================ */

const GNNDirector = (() => {
    'use strict';

    const S = {
        BOOT: 'BOOT', COLD_OPEN: 'COLD_OPEN', READ: 'READ', HOLD: 'HOLD',
        BANTER: 'BANTER', WIRE: 'WIRE', TOSS: 'TOSS', BREAK: 'BREAK',
        IDENT: 'IDENT', DRY: 'DRY', SIGNOFF: 'SIGNOFF',
    };

    // --- Pacing knobs (ms) -----------------------------------
    const PACE = {
        holdAfterRead: [1500, 3600],
        holdAfterBanter: [900, 2100],
        holdBeforeBreak: [700, 1400],
        breathAfterToss: [500, 1100],
        dryLoop: [6000, 11000],
        storiesPerBreak: [4, 7],
        storiesPerIdent: [9, 14],
        banterChance: 0.55,
        wireShare: 0.35,          // of banter beats, how many are sector-wire
        tossChance: 0.42,
        cutawayChance: 0.62,
        cutawayAt: 0.34,          // fraction through the read
        doubleBanterChance: 0.16,
    };

    let state = S.BOOT;
    let stateSince = 0;
    let holdUntil = 0;

    let queue = [];
    let current = null;
    let storiesRead = 0;
    let sinceBreak = 0;
    let sinceIdent = 0;
    let nextBreakAt = randInt(PACE.storiesPerBreak);
    let nextIdentAt = randInt(PACE.storiesPerIdent);

    let speaking = false;
    let speechToken = 0;
    let speechDeadline = 0;
    let cutawayFired = false;
    let readEstimate = 0;
    let running = true;
    let pendingBreaking = null;
    let banterStreak = 0;
    let bootDeadline = 0;
    let breakArming = false;

    let onStateChange = null;
    let onStory = null;

    function rand(range) {
        return range[0] + Math.random() * (range[1] - range[0]);
    }
    function randInt(range) {
        return Math.round(rand(range));
    }

    function setState(next, now) {
        if (state === next) return;
        state = next;
        stateSince = now;
        if (onStateChange) onStateChange(next);
    }

    // ---------------------------------------------------------
    // Speech
    // ---------------------------------------------------------

    function say(text, opts = {}) {
        const token = ++speechToken;
        speaking = true;
        const est = GNNTTS.estimateMs(text);
        speechDeadline = performance.now() + est * 2.4 + 8000;
        GNNTTS.speak(text, opts).then(() => {
            if (token === speechToken) speaking = false;
        });
        return est;
    }

    /** Second line of defence: the rundown outranks the voice. */
    function checkSpeechWatchdog(now) {
        if (speaking && speechDeadline && now > speechDeadline) {
            speechToken++;
            speaking = false;
            speechDeadline = 0;
        }
    }

    function cancelSpeech() {
        speechToken++;
        speaking = false;
        GNNTTS.stop();
    }

    // ---------------------------------------------------------
    // Queue
    // ---------------------------------------------------------

    function enqueueAll(items) {
        for (const it of items || []) {
            if (!it || !it.title) continue;
            if (queue.some((q) => q.title === it.title)) continue;
            if (current && current.title === it.title) continue;
            queue.push(it);
        }
        queue.sort((a, b) => (b.importance || 0) - (a.importance || 0));
        if (queue.length > 60) queue.length = 60;
    }

    function injectBreaking(title, description) {
        pendingBreaking = {
            title: String(title || '').toUpperCase(),
            description: description || '',
            breaking: true,
            importance: 9999,
            timestamp: Date.now(),
        };
    }

    function storyText(item) {
        const title = (item.title || '').trim();
        const desc = (item.description || '').trim();
        if (!desc) return title.replace(/[.!?]?$/, '.');
        const joiner = /[.!?]$/.test(title) ? ' ' : '. ';
        return (title + joiner + desc).replace(/\s+/g, ' ');
    }

    function isBreaking(item) {
        if (!item) return false;
        if (item.breaking) return true;
        return /\b(breaking|emergency|crisis|catastroph|evacuat|disaster|attack|killed|explosion)\b/i
            .test(`${item.title} ${item.description}`);
    }

    // ---------------------------------------------------------
    // Segments
    // ---------------------------------------------------------

    function beginColdOpen(now) {
        setState(S.COLD_OPEN, now);
        GNNTextEngine.present('GNN SECTOR RELAY — SIGNAL ACQUIRED', {
            kind: 'ident', cue: 'STATION IDENT', chyron: 'GALACTIC NEWS NETWORK',
            durationMs: 2200,
        });
        GNNAudio.play('intro_sfx_02', { gain: 0.6 });
        const beds = GNNAssets.musicTracks();
        if (beds.length) {
            GNNAudio.playMusic(beds[8 % beds.length].id, { gain: 0.55, loop: false, fadeIn: 0.4 });
        }
        const est = say(GNNScript.ident());
        holdUntil = now + Math.max(3200, est + 900);
    }

    function beginRead(now, item) {
        current = item;
        storiesRead++;
        sinceBreak++;
        sinceIdent++;
        cutawayFired = false;
        banterStreak = 0;

        const breaking = isBreaking(item);
        const text = storyText(item);
        readEstimate = GNNTTS.estimateMs(text);

        GNNTextEngine.present(text, {
            kind: breaking ? 'breaking' : 'headline',
            cue: breaking ? '⚡ BREAKING TRANSMISSION' : 'SECTOR DESK',
            chyron: breaking ? 'BREAKING — ' + GNNScript.chyron(item) : GNNScript.chyron(item),
            durationMs: readEstimate,
        });

        if (breaking) {
            GNNAudio.playKlaxon();
            GNNGlitch.flagBreaking(now);
        } else {
            GNNAudio.playRole('blip', { gain: 0.4 });
        }

        GNNCutsceneManager.prefetch(item);
        say(text);
        setState(S.READ, now);
        if (onStory) onStory(item);
    }

    function beginHold(now, range, nextState) {
        holdUntil = now + rand(range || PACE.holdAfterRead);
        setState(S.HOLD, now);
        holdNext = nextState;
    }
    let holdNext = null;

    function beginBanter(now) {
        const wire = Math.random() < PACE.wireShare;
        const line = wire ? GNNScript.sectorWire(current) : GNNScript.banter(current);
        if (!line) { beginHold(now, PACE.holdAfterBanter, S.READ); return; }
        banterStreak++;
        const est = say(line, { pitch: wire ? -14 : -10 });
        GNNTextEngine.present(line, {
            kind: wire ? 'wire' : 'banter',
            cue: wire ? 'SECTOR WIRE' : 'ANCHOR COMMENT',
            durationMs: est,
        });
        if (wire) GNNAudio.playRole('chirp', { gain: 0.3 });
        setState(wire ? S.WIRE : S.BANTER, now);
    }

    function beginToss(now) {
        const line = GNNScript.toss();
        const est = say(line);
        GNNTextEngine.present(line, { kind: 'banter', cue: '', durationMs: est });
        setState(S.TOSS, now);
    }

    function beginIdent(now) {
        sinceIdent = 0;
        nextIdentAt = randInt(PACE.storiesPerIdent);
        const line = GNNScript.ident();
        const est = say(line);
        GNNTextEngine.present(line, {
            kind: 'ident', cue: 'STATION IDENT',
            chyron: 'GALACTIC NEWS NETWORK', durationMs: est,
        });
        GNNAudio.play('intro_sfx_01', { gain: 0.45 });
        setState(S.IDENT, now);
    }

    async function beginBreak(now) {
        if (breakArming) return;
        sinceBreak = 0;
        nextBreakAt = randInt(PACE.storiesPerBreak);
        setState(S.BREAK, now);
        // Assembling a break means loading a dozen composited scenes. Hold the
        // state machine here for the whole assembly, or the desk comes back on
        // air underneath the commercial.
        breakArming = true;
        cancelSpeech();
        GNNTextEngine.present('WE WILL RETURN AFTER THESE MESSAGES.', {
            kind: 'ad', cue: 'COMMERCIAL BREAK', chyron: '', instant: true,
        });
        GNNCutsceneManager.endCutaway();
        let total = 0;
        try {
            total = await GNNCutsceneManager.startCommercialBreak(now);
        } finally {
            breakArming = false;
        }
        if (!total) beginHold(performance.now(), [200, 400], S.READ);
    }

    function beginDry(now) {
        const line = GNNScript.hold();
        const est = say(line);
        GNNTextEngine.present(line, { kind: 'hold', cue: 'STANDING BY', durationMs: est });
        holdUntil = now + rand(PACE.dryLoop);
        setState(S.DRY, now);
    }

    // ---------------------------------------------------------
    // Main tick
    // ---------------------------------------------------------

    function update(now) {
        if (!running) return;

        checkSpeechWatchdog(now);
        GNNCutsceneManager.update(now);

        // Breaking news pre-empts everything except an active break.
        if (pendingBreaking && state !== S.BREAK && !breakArming) {
            const item = pendingBreaking;
            pendingBreaking = null;
            cancelSpeech();
            GNNCutsceneManager.endCutaway();
            beginRead(now, item);
            return;
        }

        switch (state) {
            case S.BOOT:
                // Open on the first story, but never wait on the feed forever —
                // an empty rundown is still a broadcast, it is just a quiet one.
                if (queue.length) beginColdOpen(now);
                else if (!bootDeadline) bootDeadline = now + 9000;
                else if (now > bootDeadline) beginColdOpen(now);
                break;

            case S.COLD_OPEN:
                if (!speaking && now >= holdUntil) nextStory(now);
                break;

            case S.READ: {
                if (!cutawayFired && GNNTextEngine.progress() >= PACE.cutawayAt) {
                    cutawayFired = true;
                    if (Math.random() < PACE.cutawayChance) {
                        GNNCutsceneManager.triggerCutaway(current, now);
                    }
                }
                const overrun = now - stateSince > readEstimate + 9000;
                if ((!speaking && !GNNTextEngine.isTyping()) || overrun) {
                    if (overrun) GNNTextEngine.finishTyping();
                    decideAfterRead(now);
                }
                break;
            }

            case S.HOLD:
                if (now >= holdUntil) {
                    const next = holdNext;
                    holdNext = null;
                    if (next === S.BREAK) beginBreak(now);
                    else if (next === S.BANTER) beginBanter(now);
                    else if (next === S.TOSS) beginToss(now);
                    else if (next === S.IDENT) beginIdent(now);
                    else nextStory(now);
                }
                break;

            case S.BANTER:
            case S.WIRE:
                if (!speaking && !GNNTextEngine.isTyping()) {
                    if (banterStreak < 2 && Math.random() < PACE.doubleBanterChance) {
                        beginHold(now, [600, 1400], S.BANTER);
                    } else if (Math.random() < PACE.tossChance) {
                        beginHold(now, PACE.holdAfterBanter, S.TOSS);
                    } else {
                        beginHold(now, PACE.holdAfterBanter, S.READ);
                    }
                }
                break;

            case S.TOSS:
            case S.IDENT:
                if (!speaking && !GNNTextEngine.isTyping()) {
                    beginHold(now, PACE.breathAfterToss, S.READ);
                }
                break;

            case S.BREAK:
                if (!breakArming && !GNNCutsceneManager.isBreakActive()) {
                    // One line, spoken and displayed. These used to differ.
                    const backLive = GNNScript.signoff();
                    const est = say(backLive);
                    GNNTextEngine.present(backLive, {
                        kind: 'ident', cue: 'BACK LIVE', durationMs: est,
                    });
                    beginHold(now, [1600, 2400], S.READ);
                }
                break;

            case S.DRY:
                if (queue.length) { nextStory(now); break; }
                if (!speaking && now >= holdUntil) beginDry(now);
                break;

            default:
                break;
        }
    }

    function decideAfterRead(now) {
        if (sinceBreak >= nextBreakAt) {
            beginHold(now, PACE.holdBeforeBreak, S.BREAK);
        } else if (sinceIdent >= nextIdentAt) {
            beginHold(now, PACE.holdAfterRead, S.IDENT);
        } else if (Math.random() < PACE.banterChance) {
            beginHold(now, PACE.holdAfterRead, S.BANTER);
        } else if (Math.random() < PACE.tossChance) {
            beginHold(now, PACE.holdAfterRead, S.TOSS);
        } else {
            beginHold(now, PACE.holdAfterRead, S.READ);
        }
    }

    function nextStory(now) {
        if (typeof GNNFeedManager !== 'undefined' && queue.length < 3) {
            GNNFeedManager.replenishQueue();
        }
        const item = queue.shift();
        if (!item) { beginDry(now); return; }
        beginRead(now, item);
    }

    // ---------------------------------------------------------
    // Transport controls
    // ---------------------------------------------------------

    function skip() {
        const now = performance.now();
        if (breakArming) return;
        cancelSpeech();
        GNNCutsceneManager.endCutaway();
        if (state === S.BREAK) { GNNCutsceneManager.abortBreak(); }
        GNNTextEngine.finishTyping();
        nextStory(now);
    }

    function pause() {
        running = false;
        cancelSpeech();
        GNNTextEngine.pause();
    }

    function resume() {
        running = true;
        GNNTextEngine.resume();
        holdUntil = performance.now() + 300;
    }

    function forceBreak() {
        beginBreak(performance.now());
    }

    function report() {
        return {
            state, storiesRead, queued: queue.length, breakArming,
            sinceBreak, nextBreakAt, sinceIdent, nextIdentAt,
            speaking, current: current ? current.title : null,
        };
    }

    return {
        STATES: S, PACE,
        update, enqueueAll, injectBreaking, skip, pause, resume, forceBreak,
        isRunning: () => running,
        getState: () => state,
        getCurrent: () => current,
        getQueue: () => queue,
        isSpeaking: () => speaking,
        report,
        set onStateChange(fn) { onStateChange = fn; },
        set onStory(fn) { onStory = fn; },
    };
})();
