/* ============================================================
   GNN — Teleprompter / Text Engine
   ------------------------------------------------------------
   This used to own the story queue and drive itself forward
   forever. It no longer does. It is now a dumb, precise
   teleprompter: the Broadcast Director hands it a line and a
   target duration, and it types that line out so the last
   character lands as the anchor stops speaking.

   It also renders the lower-third chyron and the story panel,
   and it can hold a line on screen during a pause instead of
   instantly clearing.

   The story panel used to be a black box bolted under the
   console, outside the picture. It is now a caption over the
   broadcast, where a channel puts it.
   ============================================================ */

const GNNTextEngine = (() => {
    'use strict';

    // The story caption, as a fraction of the frame so it survives a change
    // of resolution.
    //
    // Every caption is drawn in the same slot now — a slab along the bottom
    // of the frame. The bubble that used to sit above the speaker's head,
    // with a tail pointing at their mouth, is gone: it read as a comic-book
    // speech balloon, and it kept colliding with the monitor in the corner.
    //
    // `PANEL.w` and `PANEL.minW` are kept for reference only; they are no
    // longer read. Every box is `STATION_BOX` width.
    const PANEL = { w: 0.46, minW: 0.20 };

    // The box is born at the width it will always be and two lines tall, and
    // grows a whole line at a time. Sizing it to the characters typed so far
    // redrew it on every frame — it crept wider and taller as the line
    // arrived, which reads as broken rather than as typing.
    //
    // Two lines, then three, then four, each in one step at the moment the
    // line below fills. After the last line it stops growing and scrolls:
    // the oldest words leave at the top and new ones keep arriving at the
    // bottom.
    const LINES_MIN = 2;
    const LINES_MAX = 4;

    // The bottom slot, shared by every caption: anchor dialogue, station
    // idents, commercial tosses, unlisted transmissions, correspondents in
    // the monitor. `y` is the fraction of frame height the box's bottom
    // edge sits at.
    const STATION_BOX = { y: 0.845, w: 0.56 };

    let BOX = { x: 0, y: 0, w: 0, h: 0 };

    // Type sizes scale with the frame too; at 1280x720 these land close to
    // where they were tuned.
    let PADDING = 14;
    let LINE_HEIGHT = 26;
    let FONT_SIZE = 15;
    const MIN_CHAR_MS = 14;
    const MAX_CHAR_MS = 110;

    let fullText = '';
    let visible = 0;
    let lines = [];
    let lastTick = 0;
    let charDelay = 42;
    let paused = false;
    let holding = false;         // fully typed, waiting for the director
    let kind = 'headline';       // headline | banter | wire | ident | ad | hold
    let chyron = '';
    let cue = '';                // small status line, e.g. "SECTOR WIRE"
    let blinkAnchor = 0;

    // A caption presented while the previous line's audio is still being
    // fetched — or, more commonly, while the *new* line's audio is being
    // fetched, since the director calls present() before speak(). Held
    // here until the swap can be done in one frame with the voice.
    //
    // The old behaviour applied the incoming caption immediately: the box
    // and its label switched to the new speaker, but no text was typed
    // until the audio element was handed its source — a fraction of a
    // second on a warm clip, one to two seconds on a cold one. The viewer
    // saw the empty box before the voice arrived. Deferring the whole
    // swap means the previous caption stays up until the new one is ready
    // to arrive with its voice, and the box is never empty on screen.
    let pending = null;
    let pendingSince = 0;
    // Ceiling on the deferred swap. Generous — a cold clip is one to two
    // seconds, so four covers it. A line whose fetch or decode failed
    // releases the element, `waitingForAudio()` returns false, and the
    // pending line applies without ever hitting this. The ceiling is a
    // last resort for the case where neither happens.
    const PENDING_CEILING_MS = 4000;

    const PALETTE = {
        headline: '#6fc3df',
        banter: '#9ad7a0',
        wire: '#e8c46a',
        ident: '#ff9de2',
        ad: '#ffd166',
        hold: '#7a8fa6',
        breaking: '#ff6b6b',
    };

    function wrap(ctx, text, maxWidth) {
        const words = String(text).split(' ');
        const out = [];
        let line = '';
        for (const w of words) {
            const test = line ? line + ' ' + w : w;
            if (ctx.measureText(test).width > maxWidth && line) { out.push(line); line = w; }
            else line = test;
        }
        if (line) out.push(line);
        return out;
    }

    /**
     * Apply a caption to the prompter. The internal state machine; the
     * public entry point is `present()`, which defers to this until the
     * voice is ready to arrive with the text.
     */
    function applyPresent(text, opts = {}) {
        fullText = String(text || '').replace(/\s+/g, ' ').trim();
        visible = opts.instant ? fullText.length : 0;
        holding = false;
        kind = opts.kind || 'headline';
        chyron = opts.chyron !== undefined ? opts.chyron : chyron;
        cue = opts.cue || '';
        lines = [];
        lastTick = 0;
        if (opts.durationMs && fullText.length) {
            // Land the final character just before the voice stops.
            charDelay = Math.max(MIN_CHAR_MS,
                Math.min(MAX_CHAR_MS, (opts.durationMs * 0.86) / fullText.length));
        } else {
            charDelay = 42;
        }
    }

    /**
     * Put a line on the prompter.
     *
     * The director calls this immediately before asking for the voice,
     * and the audio element does not actually start until the clip has
     * been fetched and decoded — a fraction of a second for a warm clip,
     * one to two seconds for a cold one. Applying the caption immediately
     * showed the new box, empty, for exactly that gap: the label changed
     * but no text, and then the voice arrived with the typewriter a beat
     * behind. Deferring the swap to `update()` closes the gap — the
     * previous caption stays up, and the new one arrives in the same
     * frame the voice does.
     *
     * @param {string} text
     * @param {Object} opts { kind, durationMs, chyron, cue, instant }
     */
    function present(text, opts = {}) {
        pending = { text, opts };
        pendingSince = performance.now();
    }

    function clear() {
        pending = null;
        fullText = ''; visible = 0; lines = []; holding = false; cue = '';
    }

    function finishTyping() {
        // If a pending caption never applied — the audio fetch failed and
        // its watchdog released the element, but the loop ran finishTyping
        // before update() caught the release — apply it now so the caller
        // gets the behaviour it asked for.
        if (pending) {
            const p = pending;
            pending = null;
            applyPresent(p.text, p.opts);
        }
        visible = fullText.length;
        holding = true;
    }

    function update(now) {
        // Apply a deferred caption the instant the voice begins. The
        // previous line stays on screen until then, which is what makes
        // the swap land with the audio instead of one to two seconds
        // ahead of it. A stuck fetch or a decode failure releases the
        // element via the tts.js watchdog, which also clears
        // `waitingForAudio()` and lets this apply.
        if (pending) {
            const stillWaiting = typeof GNNTTS !== 'undefined'
                && GNNTTS.waitingForAudio && GNNTTS.waitingForAudio();
            const expired = now - pendingSince > PENDING_CEILING_MS;
            if (!stillWaiting || expired) {
                const p = pending;
                pending = null;
                applyPresent(p.text, p.opts);
            }
        }

        if (paused || !fullText) return;
        if (visible >= fullText.length) { holding = true; return; }

        // Wait for the audio to actually start before typing anything.
        //
        // The director calls `present()` *before* `GNNTTS.speak()`, and
        // `speak()` does not begin playback until the clip has been fetched
        // and decoded — locally that is tens of milliseconds, on a cold
        // line it is a second or more. In that window `playbackProgress()`
        // returns null (no audio is playing yet) and this function fell
        // through to its own timer below, typing several words ahead of the
        // voice. That is what made Varr's box fill up before Varr started
        // talking.
        //
        // Resetting `lastTick` each frame while waiting is deliberate: when
        // the voice does begin, the timer starts from zero rather than
        // firing a burst of characters at once to catch up.
        //
        // This branch is a second line of defence — by the time we are
        // here, `pending` has already been applied and the audio element
        // has been handed its source. It still matters for a line with no
        // audio at all: the browser fallback path, or a line whose fetch
        // failed silently and the director is going to time out.
        if (typeof GNNTTS !== 'undefined' && GNNTTS.waitingForAudio
            && GNNTTS.waitingForAudio()) {
            lastTick = now;
            return;
        }

        // Follow the voice when there is one.
        //
        // The clock below paces the type-out from an *estimate* of how long
        // the line will take. The estimate is close, which is worse than
        // being wrong: the two drift apart over a long read and the words
        // land a beat off the mouth saying them. The audio element knows
        // exactly where it is, so the teleprompter is driven from that and
        // the clock is only the fallback for a line with no audio.
        const heard = (typeof GNNTTS !== 'undefined' && GNNTTS.playbackProgress)
            ? GNNTTS.playbackProgress() : null;
        if (heard !== null) {
            // A little ahead of the voice, the way a prompter runs: the word
            // is on screen as it is spoken, not after it.
            const target = Math.min(fullText.length,
                Math.ceil(heard * 1.06 * fullText.length));
            if (target <= visible) return;
            let spoke = false;
            while (visible < target) {
                visible++;
                if (fullText[visible - 1] !== ' ') spoke = true;
            }
            if (spoke && typeof GNNAudio !== 'undefined') GNNAudio.playTypingBlip();
            lastTick = now;
            if (visible >= fullText.length) holding = true;
            return;
        }

        if (!lastTick) lastTick = now;
        if (now - lastTick < charDelay) return;

        // Catch up if the loop stalled, so long lines never fall behind speech.
        // One click per tick, not one per character: a catch-up burst would
        // otherwise fire a dozen at the same instant and sum into a spike.
        const due = Math.max(1, Math.floor((now - lastTick) / charDelay));
        let audible = false;
        for (let i = 0; i < due && visible < fullText.length; i++) {
            visible++;
            if (fullText[visible - 1] !== ' ') audible = true;
        }
        if (audible && typeof GNNAudio !== 'undefined') GNNAudio.playTypingBlip();
        lastTick = now;
        if (visible >= fullText.length) holding = true;
    }

    // ---------------------------------------------------------
    // Rendering
    // ---------------------------------------------------------

    /**
     * Where the speaker's face is, and in whose colour.
     *
     * Still used for the accent stripe and the label colour, so you can
     * still tell who is talking at a glance even though the box no longer
     * sits over their head. The tail that pointed at them is gone.
     *
     * `seat: -1` means the line's speaker is not at the desk — a
     * correspondent in the monitor. The colour falls back to the station
     * accent and the label reads the cue rather than the (unknown) face.
     */
    function speakerAnchor(ctx) {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        const mid = {
            x: Math.round(w * 0.5), y: Math.round(h * 0.42),
            colour: null, seat: -1
        };
        if (typeof GNNRenderer === 'undefined' || !GNNRenderer.hitRegions) return mid;
        let faces;
        try { faces = GNNRenderer.hitRegions().faces; } catch (err) { return mid; }
        if (!faces || !faces.length) return mid;
        const chair = (typeof GNNDirector !== 'undefined'
            && GNNDirector.activeSeatForLine)
            ? GNNDirector.activeSeatForLine() : 0;
        if (chair < 0) return mid;
        const f = faces[chair] || faces[0];
        const who = (typeof GNNDirector !== 'undefined' && GNNDirector.speaker)
            ? GNNDirector.speaker() : null;
        return {
            x: Math.round(f.x + f.w / 2),
            y: Math.round(f.y),
            colour: who && who.colour ? who.colour : null,
            seat: chair,
        };
    }

    /** Resolve the caption's pixel rect against the canvas it is drawn on. */
    function layout(ctx) {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        BOX = {
            x: 0, y: 0, w: Math.round(STATION_BOX.w * w), h: 0,
        };   // x, y and h are set per frame by render()
        const k = h / 720;
        PADDING = Math.max(8, Math.round(14 * k));
        LINE_HEIGHT = Math.max(14, Math.round(26 * k));
        FONT_SIZE = Math.max(9, Math.round(15 * k));
    }

    function render(ctx, now) {
        layout(ctx);
        ctx.save();
        ctx.imageSmoothingEnabled = false;

        // A caption over the picture, not a hole cut in it: translucent so
        // the set reads through, with a station-coloured spine down the left
        // so it still reads as broadcast furniture.
        if (!fullText && !cue) { ctx.restore(); return; }

        // Size the panel to what is actually in it. A fixed box is a large
        // empty slab over the set for most of every line, because the text
        // arrives a character at a time and only fills it at the very end.
        const lead = Math.round(LINE_HEIGHT * 0.92);
        let shownLines = [];
        if (fullText && visible > 0) {
            ctx.font = `${FONT_SIZE}px "Press Start 2P", monospace`;
            shownLines = wrap(ctx, fullText.substring(0, visible),
                BOX.w - PADDING * 2);
        }
        // The box is as many lines tall as have been written, never fewer
        // than two and never more than four; past that it scrolls.
        const rows = Math.min(LINES_MAX,
            Math.max(LINES_MIN, shownLines.length));
        if (shownLines.length > rows) {
            shownLines = shownLines.slice(shownLines.length - rows);
        }
        const bodyH = rows * LINE_HEIGHT;
        BOX.h = (cue ? lead : PADDING) + bodyH + PADDING;

        // ============================================================
        // EVERY CAPTION DRAWS IN THE SAME SLOT.
        //
        // This block used to branch: a bubble over the speaker's head with
        // a tail pointing at their mouth, or a station slab along the
        // bottom. The bubble is gone — it read as a comic-book speech
        // balloon, collided with the monitor in the corner, and gave a
        // different box position for every speaker.
        //
        // Now every caption uses `STATION_BOX`: centred horizontally, its
        // bottom edge at `STATION_BOX.y` of the frame height. That is the
        // same slot the station ident and the third-anchor box already
        // used, so nothing about the layout is new — only which kinds of
        // line get it, and now that is all of them.
        // ============================================================
        BOX.w = Math.round(STATION_BOX.w * ctx.canvas.width);
        BOX.x = Math.round((ctx.canvas.width - BOX.w) / 2);
        BOX.y = Math.round(STATION_BOX.y * ctx.canvas.height - BOX.h);

        // Colour still follows the speaker when there is one, so you can
        // tell who is talking at a glance. The station keeps its own.
        const spk = speakerAnchor(ctx);
        const accent = (spk.colour && spk.seat >= 0) ? spk.colour : '#6fc3df';

        ctx.fillStyle = 'rgba(4,12,20,0.88)';
        ctx.fillRect(BOX.x, BOX.y, BOX.w, BOX.h);
        ctx.fillStyle = accent;
        ctx.fillRect(BOX.x, BOX.y, Math.max(3, Math.round(BOX.w * 0.012)), BOX.h);
        ctx.fillRect(BOX.x, BOX.y, BOX.w, 2);
        // No tail. The triangle that used to point at the speaker's mouth
        // is gone; the accent stripe is what carries the speaker now.

        // The label is who is talking. "SECTOR DESK" told the viewer
        // nothing; the anchor's name tells them everything, and it is the
        // only label the cast has ever needed.
        const who = (spk.seat >= 0 && typeof GNNDirector !== 'undefined'
            && GNNDirector.speaker) ? GNNDirector.speaker() : null;
        const label = who && who.name ? who.name.toUpperCase() : cue;
        if (label) {
            ctx.font = `${Math.max(7, Math.round(FONT_SIZE * 0.6))}px "Press Start 2P", monospace`;
            ctx.textBaseline = 'top';
            ctx.fillStyle = accent;
            ctx.fillText(label, BOX.x + PADDING, BOX.y + Math.round(PADDING * 0.45));
        }

        if (fullText && visible > 0) {
            ctx.font = `${FONT_SIZE}px "Press Start 2P", monospace`;
            ctx.fillStyle = PALETTE[kind] || PALETTE.headline;
            ctx.textBaseline = 'top';

            const top = BOX.y + (cue ? lead : PADDING);
            for (let i = 0; i < shownLines.length; i++) {
                ctx.fillText(shownLines[i], BOX.x + PADDING, top + i * LINE_HEIGHT);
            }
            // Prompter caret while text is still arriving.
            if (visible < fullText.length && Math.floor(now / 260) % 2 === 0) {
                const last = shownLines[shownLines.length - 1] || '';
                const cx = BOX.x + PADDING + ctx.measureText(last).width + 3;
                const cy = top + Math.max(0, shownLines.length - 1) * LINE_HEIGHT;
                ctx.fillRect(cx, cy, 10, FONT_SIZE);
            }
        } else if (holding || !fullText) {
            blinkAnchor = blinkAnchor || now;
            if (Math.floor(now / 520) % 2 === 0) {
                ctx.font = `${Math.max(8, Math.round(FONT_SIZE * 0.75))}px "Press Start 2P", monospace`;
                ctx.fillStyle = '#264a5c';
                ctx.textBaseline = 'top';
                ctx.fillText('▌', BOX.x + PADDING, BOX.y + PADDING);
            }
        }
        ctx.restore();
    }

    /**
     * Was a second bar of its own, stacked under the caption and over the
     * name card. The caption is the lower third now and carries the same
     * headline, so this draws nothing; it stays as a hook for the multi
     * anchor work, which wants a station strap that is not the read copy.
     */
    function renderChyron(ctx, view) {
        return;
        // eslint-disable-next-line no-unreachable
        if (!chyron) return;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        // The renderer owns the bottom stack; asking it is what keeps this
        // off the name card.
        const st = (typeof GNNRenderer !== 'undefined' && GNNRenderer.bottomStack)
            ? GNNRenderer.bottomStack() : null;
        const h = st ? st.chyronH : 26;
        const y = st ? view.y + st.chyronY
            : view.y + view.h - h - 6
            - ((typeof GNNTickerManager !== 'undefined'
                && GNNTickerManager.isEnabled())
                ? GNNTickerManager.BAR_H + 4 : 0);
        ctx.fillStyle = 'rgba(6,14,24,0.86)';
        ctx.fillRect(view.x + 8, y, Math.min(view.w - 16, 560), h);
        ctx.fillStyle = kind === 'breaking' ? '#ff3b3b' : '#124a63';
        ctx.fillRect(view.x + 8, y, 8, h);
        ctx.font = Math.max(8, Math.round(h * 0.38)) + 'px "Press Start 2P", monospace';
        ctx.fillStyle = '#cfeaff';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(chyron).slice(0, 48), view.x + 26, y + h / 2, 520);
        ctx.restore();
    }

    function pause() { paused = true; }
    function resume() { paused = false; lastTick = 0; }

    return {
        BOX,
        present, clear, update, render, renderChyron, finishTyping,
        pause, resume,
        isPaused: () => paused,
        isTyping: () => !!fullText && visible < fullText.length,
        isHolding: () => holding,
        getText: () => fullText,
        getKind: () => kind,
        setChyron: (v) => { chyron = v; },
        setKind: (k) => { kind = k; },
        progress: () => (fullText ? visible / fullText.length : 1),
    };
})();