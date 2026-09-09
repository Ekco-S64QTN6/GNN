/* ============================================================
   GNN — Renderer
   ------------------------------------------------------------
   Composites the broadcast. Everything that lives *inside* the
   studio monitor is drawn to an offscreen viewport buffer first,
   so the glitch engine can roll it, tear it, desaturate it and
   ghost it as one signal — the way a failing CRT would — rather
   than as a per-element effect.

   Layer stack:
     1  studio frame (background_tv.png)
     2  anchor                       ] drawn into the
     3  holographic globe            ] viewport buffer,
     4  over-the-shoulder icon plate ] then post-processed
     5  cutaway / commercial break   ] and blitted as one
     6  chyron lower third           ]
     7  commodity ticker             ]
     8  alert border + glitch artefacts
     9  console readout (outside the monitor)
   ============================================================ */

const GNNRenderer = (() => {
    'use strict';

    const SCALE = 3;
    const CANVAS_W = 320 * SCALE;
    const CANVAS_H = 200 * SCALE;

    // The lit area of the studio monitor, measured off background_tv.png.
    const VIEW = { x: 42, y: 42, w: 876, h: 316 };

    const ANCHOR = { x: 42, y: 42, w: 876, h: 315 };
    const GLOBE = { x: 228, y: 108, w: 147, h: 126 };
    const ICON = { x: 624, y: 114, w: 123, h: 111 };

    let canvas = null;
    let ctx = null;
    let vcanvas = null;
    let vctx = null;

    let bgImage = null;
    let anchorFrames = [];
    let globeFrames = [];

    function init(canvasEl, assets) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        vcanvas = document.createElement('canvas');
        vcanvas.width = VIEW.w;
        vcanvas.height = VIEW.h;
        vctx = vcanvas.getContext('2d');
        vctx.imageSmoothingEnabled = false;

        bgImage = assets.bg;
        anchorFrames = assets.anchors || [];
        globeFrames = assets.globes || [];
    }

    // ---------------------------------------------------------
    // Viewport contents
    // ---------------------------------------------------------

    function drawViewport(now, frames, icon) {
        const c = vctx;
        c.imageSmoothingEnabled = false;
        c.clearRect(0, 0, VIEW.w, VIEW.h);

        const breakActive = GNNCutsceneManager.isBreakActive();

        if (!breakActive) {
            if (anchorFrames[frames.anchor]) {
                c.drawImage(anchorFrames[frames.anchor], 0, 0, ANCHOR.w, ANCHOR.h);
            }
            if (globeFrames[frames.globe]) {
                c.drawImage(globeFrames[frames.globe],
                    GLOBE.x - VIEW.x, GLOBE.y - VIEW.y, GLOBE.w, GLOBE.h);
            }
            if (icon && !GNNCutsceneManager.isCutawayActive()) {
                drawIconPlate(c, icon);
            }
        }

        // Cutaway / commercial break render in viewport-local space.
        GNNCutsceneManager.render(c, { x: 0, y: 0, w: VIEW.w, h: VIEW.h }, now);

        if (!breakActive) {
            GNNTextEngine.renderChyron(c, { x: 0, y: 0, w: VIEW.w, h: VIEW.h });
        }
        GNNTickerManager.render(c, { x: 0, y: 0, w: VIEW.w, h: VIEW.h });
    }

    function drawIconPlate(c, icon) {
        const x = ICON.x - VIEW.x;
        const y = ICON.y - VIEW.y;
        c.save();
        c.fillStyle = 'rgba(2,8,14,0.55)';
        c.fillRect(x - 5, y - 5, ICON.w + 10, ICON.h + 10);
        c.strokeStyle = '#2f7f9c';
        c.lineWidth = 2;
        c.strokeRect(x - 5, y - 5, ICON.w + 10, ICON.h + 10);
        c.drawImage(icon, x, y, ICON.w, ICON.h);
        c.restore();
    }

    // ---------------------------------------------------------
    // Post-processing
    // ---------------------------------------------------------

    function blitViewport(now) {
        const fx = GNNGlitch.videoState(now);
        const clean = !fx.roll && !fx.tear && !fx.desat && !fx.invert && !fx.shift && !fx.jitter;

        if (clean) {
            ctx.drawImage(vcanvas, VIEW.x, VIEW.y);
            return;
        }

        ctx.save();
        ctx.beginPath();
        ctx.rect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
        ctx.clip();
        ctx.fillStyle = '#000';
        ctx.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);

        const roll = fx.roll ? (fx.roll % VIEW.h) : 0;
        const jx = fx.jitter ? (Math.random() * 4 - 2) : 0;

        // Vertical hold: the picture wraps around the tube.
        ctx.drawImage(vcanvas, VIEW.x + jx, VIEW.y + roll);
        if (roll) ctx.drawImage(vcanvas, VIEW.x + jx, VIEW.y + roll - VIEW.h);

        // Chroma ghost.
        if (fx.shift) {
            ctx.globalAlpha = 0.45;
            ctx.globalCompositeOperation = 'lighter';
            ctx.drawImage(vcanvas, VIEW.x + fx.shift + jx, VIEW.y + roll);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
        }

        // Head-switching tear: a few slices slide sideways.
        if (fx.tear) {
            const slices = 3 + ((Math.random() * 4) | 0);
            for (let i = 0; i < slices; i++) {
                const sy = (Math.random() * VIEW.h) | 0;
                const sh = 6 + ((Math.random() * 26) | 0);
                const dx = (Math.random() * 46 - 23) * fx.tear;
                ctx.drawImage(vcanvas, 0, sy, VIEW.w, sh,
                    VIEW.x + dx, VIEW.y + sy + roll, VIEW.w, sh);
            }
        }

        if (fx.desat) {
            ctx.globalCompositeOperation = 'saturation';
            ctx.fillStyle = `rgba(128,128,128,${fx.desat})`;
            ctx.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
            ctx.globalCompositeOperation = 'source-over';
        }
        if (fx.invert) {
            ctx.globalCompositeOperation = 'difference';
            ctx.globalAlpha = fx.invert;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
        }
        ctx.restore();
    }

    // ---------------------------------------------------------
    // Overlays
    // ---------------------------------------------------------

    function drawAlertBorder(now) {
        const pulse = (Math.sin(now / 140) + 1) / 2;
        ctx.save();
        ctx.strokeStyle = `rgba(255,${40 + pulse * 60},${40 + pulse * 40},${0.55 + pulse * 0.45})`;
        ctx.lineWidth = 8;
        ctx.strokeRect(VIEW.x + 4, VIEW.y + 4, VIEW.w - 8, VIEW.h - 8);
        ctx.fillStyle = `rgba(140,0,0,${0.55 + pulse * 0.3})`;
        ctx.fillRect(VIEW.x + 4, VIEW.y + 4, VIEW.w - 8, 30);
        ctx.font = '14px "Press Start 2P", monospace';
        ctx.fillStyle = '#ffe0e0';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚡ BREAKING EMERGENCY TRANSMISSION ⚡',
            VIEW.x + 22, VIEW.y + 19);
        ctx.restore();
    }

    function drawGhost(now) {
        const img = GNNGlitch.ghostAsset();
        if (!img) return;
        const hard = GNNGlitch.activeName() === 'interference';
        ctx.save();
        ctx.beginPath();
        ctx.rect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
        ctx.clip();
        ctx.globalAlpha = hard ? 0.75 + Math.random() * 0.25
            : 0.45 + Math.random() * 0.35;
        ctx.globalCompositeOperation = hard ? 'source-over' : 'lighter';
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, VIEW.x, VIEW.y, VIEW.w, VIEW.h);
        ctx.restore();
    }

    function drawOrionBadge(now) {
        ctx.save();
        ctx.font = '11px "Press Start 2P", monospace';
        ctx.fillStyle = Math.floor(now / 320) % 2 ? '#ff4df0' : '#7a2fff';
        ctx.textBaseline = 'top';
        ctx.fillText('◆ ORION PROTOCOL ◆', VIEW.x + 16, VIEW.y + VIEW.h - 62);
        ctx.restore();
    }

    // ---------------------------------------------------------
    // Frame
    // ---------------------------------------------------------

    function renderFrame(now, frames, icon) {
        if (!ctx) return;
        try {
            ctx.imageSmoothingEnabled = false;

            if (bgImage) ctx.drawImage(bgImage, 0, 0, CANVAS_W, CANVAS_H);
            else { ctx.fillStyle = '#080c14'; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H); }

            drawViewport(now, frames, icon);
            blitViewport(now);

            if (GNNGlitch.isBreaking(now)) drawAlertBorder(now);
            const fault = GNNGlitch.activeName();
            if (fault === 'ghost_signal' || fault === 'interference') drawGhost(now);
            if (GNNGlitch.isOrionMode()) drawOrionBadge(now);

            GNNTextEngine.render(ctx, now);
        } catch (err) {
            console.error('[GNN Renderer]', err);
        }
    }

    function getContext() { return ctx; }

    return {
        init, renderFrame, getContext,
        VIEW, CANVAS_W, CANVAS_H, SCALE,
    };
})();
