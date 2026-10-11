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
     7  LIVE clock
     8  commodity ticker
     9  alert border + glitch artefacts

   The viewport is the canvas, so the post-process still treats the
   signal as one image — a failing channel rolls and tears whole,
   not per element.
   ============================================================ */

const GNNRenderer = (() => {
    'use strict';

    // The window is the broadcast, edge to edge, so the frame takes the
    // window's shape rather than a fixed one. A fixed 16:9 canvas letterboxed
    // itself into black bars above and below on any window that was not
    // 16:9 — the picture was correct and the television it sat in was not.
    //
    // Height is pinned to the source material's pixel density (180 lines at
    // 4x) and width follows the window, so a wider window shows more room
    // rather than the same room stretched.
    const SCALE = 4;
    const BASE_W = 320;
    const BASE_H = 180;
    let CANVAS_W = BASE_W * SCALE;
    let CANVAS_H = BASE_H * SCALE;

    // The picture is the whole canvas.
    const VIEW = { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H };

    // Everything below is in viewport-local space, as a fraction of the
    // frame, so the layout survives a change of resolution.
    // Small and high, clear of the heads: the anchors' faces start around
    // 0.33 of the frame and this used to run to 0.41 across the third seat.
    const ICON = { x: 0.775, y: 0.072, w: 0.152, h: 0.187 };

    let canvas = null;
    let ctx = null;
    let vcanvas = null;
    let vctx = null;

    let setPlate = null;
    let deskPlate = null;
    let seated = [];
    let robot = null;

    /** Resize the frame to the window, keeping the vertical pixel density. */
    function fit() {
        if (!canvas) return;
        const aspect = (window.innerWidth || BASE_W) / (window.innerHeight || BASE_H);
        const w = Math.max(BASE_W, Math.round(BASE_H * aspect)) * SCALE;
        const h = BASE_H * SCALE;
        if (w === CANVAS_W && h === CANVAS_H && canvas.width === w) return;
        CANVAS_W = w;
        CANVAS_H = h;
        VIEW.w = w;
        VIEW.h = h;
        canvas.width = w;
        canvas.height = h;
        ctx.imageSmoothingEnabled = false;
        if (vcanvas) {
            vcanvas.width = w;
            vcanvas.height = h;
            vctx.imageSmoothingEnabled = false;
        }
    }

    function init(canvasEl, assets) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        vcanvas = document.createElement('canvas');
        vcanvas.width = VIEW.w;
        vcanvas.height = VIEW.h;
        vctx = vcanvas.getContext('2d');
        vctx.imageSmoothingEnabled = false;
        fit();
        window.addEventListener('resize', fit);
        // A window manager can hand the page one size and settle on another
        // a frame later, and no resize event need follow. The first fit saw
        // 1280x720 for a window that became 1200x757, and the canvas was
        // then stretched to fit by CSS — the picture filled the window and
        // every proportion in it was wrong. Checking per frame is a few
        // comparisons and cannot get this wrong.

        setPlate = assets.set || null;
        deskPlate = assets.desk || null;
        seated = assets.seated || [];
        robot = assets.robot || null;
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
            if (setPlate) drawCover(c, setPlate, VIEW.w, VIEW.h);
            drawCast(c, frames.anchor);
            // Only when the desk is its own plate. With the desk drawn into
            // the set, the anchors are already sitting at it.
            if (deskPlate) drawDesk(c, deskPlate);
            if (icon && !GNNCutsceneManager.isCutawayActive()) {
                drawIconPlate(c, icon);
            }
        }

        // Cutaway / commercial break render in viewport-local space.
        GNNCutsceneManager.render(c, { x: 0, y: 0, w: VIEW.w, h: VIEW.h }, now);

        if (!breakActive) {
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

        // No name card. It printed the id of the speech model, which is not
        // the anchor's name and not something a viewer should ever see. It
        // comes back when the characters have names of their own.

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
    // Measured off a minute of Pixel News Network rather than guessed at
    // twice. There, the head and shoulders showing above the desk come to
    // about a sixth of the frame, the desk runs off the bottom edge instead
    // of sitting inside the picture, and three anchors share the width with
    // room between them. At 0.46 and a desk 0.75 of the frame tall, one
    // anchor filled the window and there was nowhere to put a second.
    //
    // CAST.h is the whole plate; most of its lower half is behind the desk.
    // `seat` is where the plate's bottom edge lands, and the desk is drawn
    // over it: they have to overlap, or the anchors float above the desk
    // with a band of floor showing between.
    // Measured off the owner's reference frame by scanning a column through
    // an anchor: head top at 0.285 of the frame and the desk's top edge at
    // 0.551, which puts a quarter of the frame on the people and a quarter
    // on the desk. Ours had the heads starting at 0.38 behind a desk that
    // began at 0.665 — the camera too close and the desk too low, so they
    // read as standing behind a counter rather than sitting at one.
    const CAST = { h: 0.315, seat: 0.60 };
    const SEATS = {
        1: [0.50],
        2: [0.37, 0.63],
        3: [0.28, 0.50, 0.72],
    };
    // The desk is sized by height, between the seat line and just past the
    // bottom of the frame, and its width follows from that.
    //
    // Sized by width it was 1280 across and so 425 tall in a 720 frame: the
    // oval top filled the shot and the front panel — the lit strip, the
    // hazard stripes, the emblem, the part that makes it a news desk — was
    // below the bottom edge. What was left read as a boardroom table a few
    // metres in front of the anchors.
    // Bottom at 0.79, matching the reference, which leaves floor visible
    // below the desk. At 0.90 the desk ran to 35% of the frame against the
    // reference's 24% and swallowed the people sitting at it.
    // `overlap` is how far the desk is drawn up over the anchors. 0.049
    // hides a chest cropped at the bottom of its plate, which is what the
    // current cast art is.
    //
    // When the cast is regenerated with hands, this wants to go to roughly
    // zero. The hands are the lowest thing on the plate and have to land
    // just above the desk's top edge to read as resting on it — drawn any
    // further up and the desk covers them, which is the whole point of
    // redrawing them.
    // 0.015 now the cast has hands. The old 0.049 existed to hide a chest
    // cropped at the bottom of its plate; with hands there, the hands are
    // the lowest thing and the desk has to start just under them so they
    // read as resting on it rather than behind it.
    const DESK = { overlap: 0.015, bottom: 0.79 };

    // Where the desk's top edge sits when the desk is drawn into the set
    // plate rather than supplied separately.
    //
    // Two plates have to agree on perspective, lighting, palette and style,
    // and separately generated ones never quite do — which is most of why
    // the desk never looked like it belonged in the room. One scene with
    // the desk already in it cannot disagree with itself.
    //
    // This works because the cast plates end at the hands with nothing
    // below them, so there is no body for a desk to need to hide. The
    // anchors are simply drawn on top, with their hands landing on the
    // surface.
    const DESK_LINE = 0.60;
    const deskTop = () => CAST.seat - DESK.overlap;

    /**
     * The desk. The anchor whose turn it is takes the lip frame the animator
     * worked out; everyone else holds `listening`, which is what makes a
     * desk read as a desk rather than as three portraits in a row.
     */
    function drawCast(c, lipFrame) {
        const list = seated.slice(0, 3);
        if (!list.length) return;
        const seats = SEATS[list.length] || SEATS[1];
        const h = CAST.h * VIEW.h;
        // Hands land on the desk's top edge: just under it when the desk is
        // a separate plate drawn over them, just on it when the desk is part
        // of the set and they are drawn over it.
        const seatY = deskPlate ? CAST.seat : DESK_LINE;
        // Whoever has the chair, not whoever is sitting on the left.
        const chair = (typeof GNNDirector !== 'undefined' && GNNDirector.activeSeat)
            ? GNNDirector.activeSeat() % list.length : 0;
        list.forEach((person, i) => {
            const active = i === chair;
            let img;
            if (person.frames && person.frames.length) {
                // A cast member with a real lip matrix — the MOO1 robot has
                // 25 cels — drives it directly off the animator's frame
                // instead of being reduced to two mouth states.
                img = active
                    ? (person.frames[lipFrame] || person.frames[0])
                    : person.frames[0];
            } else {
                // Two mouth states, opened by the animator's jaw rather
                // than by a threshold guessed at here.
                const open = (typeof GNNAnimator !== 'undefined'
                    && GNNAnimator.mouthOpen) ? GNNAnimator.mouthOpen() : false;
                // Listeners turn toward the speaker: the plate as drawn
                // looks one way, so a seat on the speaker's right wants it
                // mirrored or it is looking off the side of the set.
                img = active
                    ? (open ? person.speaking : person.hero)
                    : (i > chair ? person.listeningFlip : person.listening);
            }
            if (!img) return;
            const w = img.width * (h / img.height);
            c.drawImage(img, seats[i] * VIEW.w - w / 2,
                        seatY * VIEW.h - h, w, h);
        });
    }

    function drawDesk(c, img) {
        const top = deskTop() * VIEW.h;
        const h = DESK.bottom * VIEW.h - top;
        const w = img.width * (h / img.height);
        c.drawImage(img, (VIEW.w - w) / 2, top, w, h);
    }

    /** A studio monitor: the art, inset in a lit bezel. */
    function drawPlate(c, img, rect) {
        const x = rect.x * VIEW.w;
        const y = rect.y * VIEW.h;
        const w = rect.w * VIEW.w;
        const h = rect.h * VIEW.h;
        const pad = Math.max(3, Math.round(VIEW.w * 0.004));
        c.save();
        c.fillStyle = 'rgba(2,8,14,0.72)';
        c.fillRect(x - pad, y - pad, w + pad * 2, h + pad * 2);
        c.strokeStyle = '#2f7f9c';
        c.lineWidth = Math.max(2, Math.round(VIEW.w * 0.0025));
        c.strokeRect(x - pad, y - pad, w + pad * 2, h + pad * 2);
        c.drawImage(img, x, y, w, h);
        c.restore();
    }

    function drawIconPlate(c, icon) { drawPlate(c, icon, ICON); }

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
            fit();
            ctx.imageSmoothingEnabled = false;

            ctx.fillStyle = '#05080e';
            ctx.fillRect(0, 0, VIEW.w, VIEW.h);

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

    /**
     * Where the clickable things actually are, in canvas pixels.
     *
     * The glitch engine used to carry its own copy of these as literals
     * measured off a 960x600 layout: a globe that is no longer drawn, and
     * an "anchor optics" box that now points at empty sky above the desk.
     * Hit regions belong to whoever does the drawing.
     */
    function hitRegions() {
        const list = seated.slice(0, 3);
        const seats = SEATS[list.length] || SEATS[1];
        const h = CAST.h * VIEW.h;
        const seatY = deskPlate ? CAST.seat : DESK_LINE;
        return {
            monitor: {
                x: ICON.x * VIEW.w, y: ICON.y * VIEW.h,
                w: ICON.w * VIEW.w, h: ICON.h * VIEW.h,
            },
            // The upper third of each plate is the head.
            faces: list.map((person, i) => {
                const img = person.frames ? person.frames[0] : person.hero;
                const w = img ? img.width * (h / img.height) : h;
                return {
                    x: seats[i] * VIEW.w - w / 2,
                    y: seatY * VIEW.h - h,
                    w, h: h * 0.45,
                };
            }),
        };
    }

    function getContext() { return ctx; }

    return {
        init, renderFrame, getContext,
        VIEW, SCALE, BASE_W, BASE_H, bottomStack, fit, hitRegions,
        /** Who is at the desk, left to right, for the script writer. */
        seatedIds: () => seated.map((p) => p.sid),
        get CANVAS_W() { return CANVAS_W; },
        get CANVAS_H() { return CANVAS_H; },
    };
})();
