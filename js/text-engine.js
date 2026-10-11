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
    // of resolution. Sits over the lower left of the set, clear of the name
    // card, chyron and ticker stacked beneath it.
    // The lower third. It sits on the bottom of the frame with the ticker
    // and the live clock, rather than floating in the middle of the set:
    // three separate boxes stacked up the left-hand side is not a lower
    // third, it is clutter. `y` is resolved against the bottom stack.
    // A speech bubble over whoever is talking, not a bar bolted to the
    // bottom left. It follows the speaker, carries their colour and points
    // at them, so you can tell who is talking without reading a name. Width
    // is a fraction of the frame; x comes from the seat.
    const PANEL = { w: 0.46, maxH: 0.20, minW: 0.20 };
    const TAIL = 11;
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
     * Put a line on the prompter.
     * @param {string} text
     * @param {Object} opts { kind, durationMs, chyron, cue, instant }
     */
    function present(text, opts = {}) {
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

    function clear() {
        fullText = ''; visible = 0; lines = []; holding = false; cue = '';
    }

    function finishTyping() {
        visible = fullText.length;
        holding = true;
    }

    function update(now) {
        if (paused || !fullText) return;
        if (visible >= fullText.length) { holding = true; return; }
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
     * Where the bubble should point, and in whose colour.
     *
     * The renderer knows where the cast are drawn and the director knows
     * which of them has the chair; asking both beats keeping a third copy
     * of the seating here. Falls back to the middle of the frame, which is
     * where a station ident or a commercial toss belongs anyway.
     */
    function speakerAnchor(ctx) {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        const mid = { x: Math.round(w * 0.5), y: Math.round(h * 0.42), colour: null };
        if (typeof GNNRenderer === 'undefined' || !GNNRenderer.hitRegions) return mid;
        let faces;
        try { faces = GNNRenderer.hitRegions().faces; } catch (err) { return mid; }
        if (!faces || !faces.length) return mid;
        const chair = (typeof GNNDirector !== 'undefined' && GNNDirector.activeSeat)
            ? GNNDirector.activeSeat() % faces.length : 0;
        const f = faces[chair] || faces[0];
        const who = (typeof GNNDirector !== 'undefined' && GNNDirector.speaker)
            ? GNNDirector.speaker() : null;
        return {
            x: Math.round(f.x + f.w / 2),
            y: Math.round(f.y),               // just above the head
            colour: who && who.colour ? who.colour : null,
        };
    }

    /** The over-the-shoulder monitor, so the bubble can keep out of it. */
    function monitorRect() {
        if (typeof GNNRenderer === 'undefined' || !GNNRenderer.hitRegions) return null;
        try { return GNNRenderer.hitRegions().monitor; } catch (err) { return null; }
    }

    /** Resolve the caption's pixel rect against the canvas it is drawn on. */
    function layout(ctx) {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        BOX = {
            x: 0, y: 0, w: Math.round(PANEL.w * w), h: 0,
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
        const maxLines = Math.max(1, Math.floor(
            (PANEL.maxH * ctx.canvas.height
             - (cue ? lead + PADDING : PADDING * 2)) / LINE_HEIGHT));
        let shownLines = [];
        if (fullText && visible > 0) {
            ctx.font = `${FONT_SIZE}px "Press Start 2P", monospace`;
            shownLines = wrap(ctx, fullText.substring(0, visible),
                              BOX.w - PADDING * 2);
            if (shownLines.length > maxLines) {
                shownLines = shownLines.slice(shownLines.length - maxLines);
            }
        }
        const bodyH = Math.max(1, shownLines.length) * LINE_HEIGHT;
        BOX.h = (cue ? lead : PADDING) + bodyH + PADDING;

        // Shrink to the longest line actually shown, so a short remark is a
        // short bubble rather than a half-empty slab.
        let widest = 0;
        for (const ln of shownLines) widest = Math.max(widest, ctx.measureText(ln).width);
        if (cue) {
            ctx.font = `${Math.max(7, Math.round(FONT_SIZE * 0.6))}px "Press Start 2P", monospace`;
            widest = Math.max(widest, ctx.measureText(cue).width);
            ctx.font = `${FONT_SIZE}px "Press Start 2P", monospace`;
        }
        BOX.w = Math.max(Math.round(PANEL.minW * ctx.canvas.width),
                         Math.min(BOX.w, Math.round(widest + PADDING * 2)));

        // Place it over the speaker, point it at them, and keep it clear of
        // both the edges and the story monitor — the bubble ran under the
        // monitor and both became unreadable.
        const spk = speakerAnchor(ctx);
        const margin = Math.round(ctx.canvas.width * 0.016);
        let right = ctx.canvas.width - margin;
        const mon = monitorRect();
        BOX.y = Math.round(Math.max(margin, spk.y - BOX.h - TAIL));
        if (mon && BOX.y < mon.y + mon.h) right = Math.min(right, mon.x - 10);
        BOX.x = Math.round(Math.max(margin,
            Math.min(right - BOX.w, spk.x - BOX.w / 2)));

        const accent = (kind === 'breaking') ? '#ff3b3b' : (spk.colour || '#1f7fa8');
        ctx.fillStyle = 'rgba(4,12,20,0.88)';
        ctx.fillRect(BOX.x, BOX.y, BOX.w, BOX.h);
        // The tail, aimed at the speaker and clamped inside the bubble so it
        // never floats off a corner when the bubble has been pushed over.
        const tx = Math.max(BOX.x + 12, Math.min(BOX.x + BOX.w - 12, spk.x));
        ctx.beginPath();
        ctx.moveTo(tx - 9, BOX.y + BOX.h);
        ctx.lineTo(tx + 9, BOX.y + BOX.h);
        ctx.lineTo(tx, BOX.y + BOX.h + TAIL);
        ctx.closePath();
        ctx.fillStyle = 'rgba(4,12,20,0.88)';
        ctx.fill();
        ctx.fillStyle = accent;
        ctx.fillRect(BOX.x, BOX.y, Math.max(3, Math.round(BOX.w * 0.012)), BOX.h);
        ctx.fillRect(BOX.x, BOX.y, BOX.w, 2);

        if (cue) {
            ctx.font = `${Math.max(7, Math.round(FONT_SIZE * 0.6))}px "Press Start 2P", monospace`;
            ctx.textBaseline = 'top';
            ctx.fillStyle = accent;
            ctx.fillText(cue, BOX.x + PADDING, BOX.y + Math.round(PADDING * 0.45));
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
