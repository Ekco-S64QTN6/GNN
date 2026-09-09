/* ============================================================
   GNN — Teleprompter / Text Engine
   ------------------------------------------------------------
   This used to own the story queue and drive itself forward
   forever. It no longer does. It is now a dumb, precise
   teleprompter: the Broadcast Director hands it a line and a
   target duration, and it types that line out so the last
   character lands as the anchor stops speaking.

   It also renders the lower-third chyron and the "on air"
   readout under the console, and it can hold a line on screen
   during a pause instead of instantly clearing.
   ============================================================ */

const GNNTextEngine = (() => {
    'use strict';

    // Console readout box (canvas pixels, 3x of the 320x200 original).
    const BOX = { x: 114, y: 435, w: 735, h: 135 };
    const PADDING = 14;
    const LINE_HEIGHT = 26;
    const FONT_SIZE = 15;
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
        const due = Math.max(1, Math.floor((now - lastTick) / charDelay));
        for (let i = 0; i < due && visible < fullText.length; i++) {
            visible++;
            const ch = fullText[visible - 1];
            if (ch !== ' ' && typeof GNNAudio !== 'undefined') GNNAudio.playTypingBlip();
        }
        lastTick = now;
        if (visible >= fullText.length) holding = true;
    }

    // ---------------------------------------------------------
    // Rendering
    // ---------------------------------------------------------

    function render(ctx, now) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;

        ctx.fillStyle = '#000000';
        ctx.fillRect(BOX.x, BOX.y, BOX.w, BOX.h);

        if (cue) {
            ctx.font = '9px "Press Start 2P", monospace';
            ctx.textBaseline = 'top';
            ctx.fillStyle = '#4d7f96';
            ctx.fillText(cue, BOX.x + PADDING, BOX.y + 6);
        }

        if (fullText && visible > 0) {
            ctx.font = `${FONT_SIZE}px "Press Start 2P", monospace`;
            ctx.fillStyle = PALETTE[kind] || PALETTE.headline;
            ctx.textBaseline = 'top';

            const shown = fullText.substring(0, visible);
            const wrapped = wrap(ctx, shown, BOX.w - PADDING * 2);
            const top = BOX.y + (cue ? 24 : PADDING);
            const maxLines = Math.floor((BOX.h - (cue ? 30 : PADDING * 2)) / LINE_HEIGHT);
            const start = Math.max(0, wrapped.length - maxLines);
            for (let i = start; i < wrapped.length; i++) {
                ctx.fillText(wrapped[i], BOX.x + PADDING, top + (i - start) * LINE_HEIGHT);
            }
            // Prompter caret while text is still arriving.
            if (visible < fullText.length && Math.floor(now / 260) % 2 === 0) {
                const last = wrapped[wrapped.length - 1] || '';
                const cx = BOX.x + PADDING + ctx.measureText(last).width + 3;
                const cy = top + (wrapped.length - 1 - start) * LINE_HEIGHT;
                ctx.fillRect(cx, cy, 10, FONT_SIZE);
            }
        } else if (holding || !fullText) {
            blinkAnchor = blinkAnchor || now;
            if (Math.floor(now / 520) % 2 === 0) {
                ctx.font = '11px "Press Start 2P", monospace';
                ctx.fillStyle = '#264a5c';
                ctx.textBaseline = 'top';
                ctx.fillText('▌', BOX.x + PADDING, BOX.y + PADDING);
            }
        }
        ctx.restore();
    }

    /** Lower third, drawn inside the CRT viewport by the renderer. */
    function renderChyron(ctx, view) {
        if (!chyron) return;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        const h = 26;
        const tickerH = (typeof GNNTickerManager !== 'undefined'
            && GNNTickerManager.isEnabled()) ? GNNTickerManager.BAR_H + 4 : 0;
        const y = view.y + view.h - h - 6 - tickerH;
        ctx.fillStyle = 'rgba(6,14,24,0.86)';
        ctx.fillRect(view.x + 8, y, Math.min(view.w - 16, 560), h);
        ctx.fillStyle = kind === 'breaking' ? '#ff3b3b' : '#124a63';
        ctx.fillRect(view.x + 8, y, 8, h);
        ctx.font = '11px "Press Start 2P", monospace';
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
