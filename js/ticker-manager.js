/* ============================================================
   GNN — Commodity Ticker
   ------------------------------------------------------------
   A seamless crawl along the bottom of the CRT viewport. The
   crawl string is rebuilt from live headlines plus the MOO1
   vocabulary (star names, hull classes, ore grades), and it is
   measured and duplicated so the wrap has no seam at any width.
   ============================================================ */

const GNNTickerManager = (() => {
    'use strict';

    const BAR_H = 30;
    const FONT = '12px "Press Start 2P", monospace';
    const SEP = '   ///   ';

    let enabled = true;
    let block = '';
    let blockWidth = 0;
    let offset = 0;
    let speed = 0.62;              // px per ms at 3x
    let lastNow = 0;
    let flash = 0;

    function rebuild(ctx, stories) {
        const segs = (typeof GNNScript !== 'undefined')
            ? GNNScript.tickerSegments(stories) : [];
        if (!segs.length) return;
        block = segs.join(SEP) + SEP;
        ctx.save();
        ctx.font = FONT;
        blockWidth = ctx.measureText(block).width;
        ctx.restore();
        if (!blockWidth) block = '';
    }

    function update(now) {
        if (!lastNow) lastNow = now;
        const dt = Math.min(120, now - lastNow);
        lastNow = now;
        // The alert countdown runs regardless: gating it on `enabled` lets a
        // stale flash resurface when the crawl is switched back on.
        if (flash > 0) flash -= dt;
        if (!enabled || !blockWidth) return;
        offset += speed * dt * 0.06;
        if (offset >= blockWidth) offset -= blockWidth;
    }

    function render(ctx, view) {
        if (!enabled || !block) return;
        const y = view.y + view.h - BAR_H - 2;
        ctx.save();
        ctx.beginPath();
        ctx.rect(view.x + 2, y, view.w - 4, BAR_H);
        ctx.clip();

        ctx.fillStyle = flash > 0 ? 'rgba(60,8,8,0.92)' : 'rgba(2,10,8,0.88)';
        ctx.fillRect(view.x + 2, y, view.w - 4, BAR_H);
        ctx.fillStyle = flash > 0 ? '#ff8080' : '#54e08a';
        ctx.fillRect(view.x + 2, y, view.w - 4, 2);

        ctx.font = FONT;
        ctx.textBaseline = 'middle';
        ctx.fillStyle = flash > 0 ? '#ffd0d0' : '#7dfcb0';
        ctx.imageSmoothingEnabled = false;

        let x = view.x + 4 - offset;
        // Two blocks guarantee coverage no matter how wide the viewport is.
        while (x < view.x + view.w) {
            ctx.fillText(block, x, y + BAR_H / 2);
            x += blockWidth;
        }
        ctx.restore();
    }

    function setEnabled(v) { enabled = !!v; }
    function isEnabled() { return enabled; }
    function alert() { flash = 3000; }
    function setSpeed(v) { speed = v; }

    return { rebuild, update, render, setEnabled, isEnabled, alert, setSpeed, BAR_H };
})();
