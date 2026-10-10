/* ============================================================
   GNN — Renderer
   ------------------------------------------------------------
   Composites the broadcast. Everything that lives *inside* the
   studio monitor is drawn to an offscreen viewport buffer first,
   so the glitch engine can roll it, tear it, desaturate it and
   ghost it as one signal — the way a failing CRT would — rather
   than as a per-element effect.

   The window is the television. There is no set around the picture
   and no picture inside a set: the broadcast fills the whole frame
   the way a channel does, and everything else is chrome composited
   over it.

   Layer stack, all of it inside the one viewport:
     1  set plate (the newsroom) or the MOO1 scene as a fallback
     2  anchor
     3  holographic globe
     4  over-the-shoulder icon plate
     5  cutaway / commercial break
     6  prompter / chyron lower third
     7  name card, LIVE clock, ON AIR
     8  commodity ticker
     9  alert border + glitch artefacts

   The viewport is the canvas, so the post-process still treats the
   signal as one image — a failing channel rolls and tears whole,
   not per element.
   ============================================================ */

const GNNRenderer = (() => {
    'use strict';

    // 320x180 is 16:9 at the horizontal pixel density of the source
    // material, which was 320x200. Scaling by an integer keeps every
    // source pixel square and whole; the canvas is then letterboxed to
    // the window by CSS rather than resampled here.
    const SCALE = 4;
    const BASE_W = 320;
    const BASE_H = 180;
    const CANVAS_W = BASE_W * SCALE;
    const CANVAS_H = BASE_H * SCALE;

    // The picture is the whole canvas now.
    const VIEW = { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H };

    // Everything below is in viewport-local space, as a fraction of the
    // frame, so the layout survives a change of resolution.
    const ANCHOR = { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H };
    const GLOBE = { x: 0.07, y: 0.12, w: 0.17, h: 0.26 };
    const ICON = { x: 0.68, y: 0.11, w: 0.24, h: 0.30 };

    let canvas = null;
    let ctx = null;
    let vcanvas = null;
    let vctx = null;

    let bgImage = null;
    let setPlate = null;
    let deskPlate = null;
    let castFrames = [];
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

        // The newsroom set, when it has been generated. Without it the
        // MOO1 newscast scene stands in: it is a complete picture rather
        // than a set, so it is cover-fitted and the anchors ride on it.
        setPlate = assets.set || null;
        deskPlate = assets.desk || null;
        castFrames = assets.cast || [];
        bgImage = assets.bg;
        anchorFrames = assets.anchors || [];
        globeFrames = assets.globes || [];
    }

    // ---------------------------------------------------------
    // Viewport contents
    // ---------------------------------------------------------

    /**
     * Draw `img` so it covers the frame completely, cropping the overflow
     * rather than stretching. Source art is 2.77:1 while the frame is 16:9,
     * and stretching a 1993 pixel grid to fit is immediately visible.
     */
    function drawCover(c, img, w, h) {
        const scale = Math.max(w / img.width, h / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        c.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    }

    function drawViewport(now, frames, icon) {
        const c = vctx;
        c.imageSmoothingEnabled = false;
        c.clearRect(0, 0, VIEW.w, VIEW.h);

        const breakActive = GNNCutsceneManager.isBreakActive();

        if (!breakActive) {
            // Two ways to put an anchor on screen, and only one of them at a
            // time. With cut-out cast art the room is built up in layers —
            // set, anchor, desk in front. Without it the MOO1 newscast frame
            // is a finished picture of its own, so drawing a set behind it
            // would only be painting something nothing can see.
            const cast = castFrames[frames.anchor];
            if (cast && setPlate) {
                drawCover(c, setPlate, VIEW.w, VIEW.h);
                drawCast(c, cast);
                if (deskPlate) drawDesk(c, deskPlate);
            } else if (anchorFrames[frames.anchor]) {
                drawCover(c, anchorFrames[frames.anchor], ANCHOR.w, ANCHOR.h);
            }
            if (globeFrames[frames.globe]) {
                c.drawImage(globeFrames[frames.globe],
                    GLOBE.x * VIEW.w, GLOBE.y * VIEW.h,
                    GLOBE.w * VIEW.w, GLOBE.h * VIEW.h);
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
        if (!breakActive) drawFurniture(c, now);
        GNNTickerManager.render(c, { x: 0, y: 0, w: VIEW.w, h: VIEW.h });
    }

    /**
     * The bottom of the frame is a stack — ticker, then the name/live row,
     * then the chyron above it — and two modules draw into it. Working the
     * offsets out separately in each is how the name card and the chyron
     * ended up printed over one another, so they are worked out once here
     * and everything else asks.
     */
    function bottomStack() {
        const tickerH = (typeof GNNTickerManager !== 'undefined'
            && GNNTickerManager.isEnabled()) ? GNNTickerManager.BAR_H + 2 : 0;
        const rowH = Math.round(VIEW.h * 0.047);
        const rowY = VIEW.h - tickerH - rowH - 4;
        return { tickerH, rowH, rowY, chyronH: rowH, chyronY: rowY - rowH - 4 };
    }

    /**
     * The bits of a channel that are always on screen: who is talking, and
     * the fact that this is live and what time it is.
     */
    function drawFurniture(c, now) {
        const st = bottomStack();
        const h = st.rowH;
        const y = st.rowY;
        const pad = Math.round(VIEW.w * 0.012);
        const font = Math.max(8, Math.round(h * 0.42));

        c.save();
        c.imageSmoothingEnabled = false;
        c.font = font + 'px "Press Start 2P", monospace';
        c.textBaseline = 'middle';

        // Who is at the desk, bottom left.
        const who = (typeof GNNTTS !== 'undefined' && GNNTTS.getVoiceName)
            ? GNNTTS.getVoiceName() : '';
        if (who) {
            const label = String(who).toUpperCase().slice(0, 22);
            const wTag = c.measureText(label).width + pad * 2;
            c.fillStyle = '#0d2b3a';
            c.fillRect(pad, y, wTag, h);
            c.fillStyle = '#1f7fa8';
            c.fillRect(pad, y, Math.max(3, Math.round(VIEW.w * 0.004)), h);
            c.fillStyle = '#dff1ff';
            c.fillText(label, pad * 2, y + h / 2);
        }

        // LIVE and the clock, bottom right, the way every channel ends a bar.
        const d = new Date();
        const clock = String(d.getHours()).padStart(2, '0') + ':'
            + String(d.getMinutes()).padStart(2, '0');
        const wClock = c.measureText(clock).width + pad * 2;
        const wLive = c.measureText('LIVE').width + pad * 2;
        const x0 = VIEW.w - pad - wClock - wLive;
        // The dot breathes so a still frame still reads as a live feed.
        const pulse = 0.55 + 0.45 * ((Math.sin(now / 420) + 1) / 2);
        c.fillStyle = 'rgba(176,24,32,' + pulse.toFixed(2) + ')';
        c.fillRect(x0, y, wLive, h);
        c.fillStyle = '#ffe8e8';
        c.fillText('LIVE', x0 + pad, y + h / 2);
        c.fillStyle = '#12202c';
        c.fillRect(x0 + wLive, y, wClock, h);
        c.fillStyle = '#9fd6ef';
        c.fillText(clock, x0 + wLive + pad, y + h / 2);
        c.restore();
    }

    // Where the cast and the desk sit, as fractions of the frame. Kept here
    // rather than in the plate files so a replacement plate does not have to
    // reproduce someone else's margins.
    const CAST = { cy: 0.055, h: 0.70 };
    const DESK = { w: 0.66, bottom: 1.0 };

    function drawCast(c, img) {
        const h = CAST.h * VIEW.h;
        const w = img.width * (h / img.height);
        c.drawImage(img, (VIEW.w - w) / 2, CAST.cy * VIEW.h, w, h);
    }

    function drawDesk(c, img) {
        const w = DESK.w * VIEW.w;
        const h = img.height * (w / img.width);
        c.drawImage(img, (VIEW.w - w) / 2, DESK.bottom * VIEW.h - h, w, h);
    }

    function drawIconPlate(c, icon) {
        const x = ICON.x * VIEW.w;
        const y = ICON.y * VIEW.h;
        const iw = ICON.w * VIEW.w;
        const ih = ICON.h * VIEW.h;
        c.save();
        c.fillStyle = 'rgba(2,8,14,0.55)';
        c.fillRect(x - 5, y - 5, iw + 10, ih + 10);
        c.strokeStyle = '#2f7f9c';
        c.lineWidth = 2;
        c.strokeRect(x - 5, y - 5, iw + 10, ih + 10);
        c.drawImage(icon, x, y, iw, ih);
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

            ctx.fillStyle = '#05080e';
            ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

            drawViewport(now, frames, icon);
            blitViewport(now);

            if (GNNGlitch.isBreaking(now)) drawAlertBorder(now);
            const fault = GNNGlitch.activeName();
            if (fault === 'ghost_signal' || fault === 'interference') drawGhost(now);
            if (GNNGlitch.isOrionMode()) drawOrionBadge(now);

            // A commercial is a self-contained segment that sets its own
            // type — a product name, a tagline, its own margins. Drawing the
            // teleprompter caption over it put a panel through the tagline.
            // The break owns the frame while it is running.
            if (!GNNCutsceneManager.isBreakActive()) {
                GNNTextEngine.render(ctx, now);
            }
        } catch (err) {
            console.error('[GNN Renderer]', err);
        }
    }

    function getContext() { return ctx; }

    return {
        init, renderFrame, getContext,
        VIEW, CANVAS_W, CANVAS_H, SCALE, BASE_W, BASE_H, bottomStack,
    };
})();
