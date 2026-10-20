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
    // The over-the-shoulder monitor. One rectangle for the story icon and
    // the cutaway footage: they used to be two (the icon 0.152x0.187, the
    // footage 0.175x0.215), so the monitor changed size whenever a cutaway
    // started. The authority is GNNCutsceneManager.PIP; this is only the
    // fallback for a frame drawn before that module has loaded.
    const ICON = { x: 0.715, y: 0.062, w: 0.215, h: 0.211 };
    function monitorRect() {
        return (typeof GNNCutsceneManager !== 'undefined' && GNNCutsceneManager.PIP) || ICON;
    }

    let canvas = null;
    let ctx = null;
    let vcanvas = null;
    let vctx = null;

    // --- current show-block contents -------------------------------------
    // These are what drawViewport() and drawCast() read every frame. They
    // are set once at init() from the bundle, and re-set by setShowBlock()
    // when the director swaps the schedule to the next block.
    let setPlate = null;
    // What is seen through the window, and where the glass is.
    let backdrop = null;
    let setWindow = null;
    let seated = [];
    // The station's own machine. Loaded through the same anchor pipeline
    // as every other species — `robot_desk_hero.png`, `robot_speaking.png`,
    // `robot_listening.png`, `robot_listening_flip.png` — but not seated:
    // Unit 7 reads the booth ident and is a station voice, not an anchor.
    // The plate is loaded and held so a future easter egg, a station
    // ident shot or a "Unit 7 reports" beat has the art in hand without
    // a reload. Nothing reads it this frame; see `drawCast()`.
    let robot = null;

    // The row the anchors sit on, as a fraction of frame height, for the
    // set currently on air. Every set has its own value because every set
    // is a different room with its own desk at its own height — the studio
    // and its two near siblings share one, and the rest do not.
    //
    // Read from `layout.json` at boot, and swapped on every block change
    // inside `setShowBlock()`. The default below is only the value to use
    // when a set has not been measured — an older generated/ tree, a
    // missing layout.json, a hand-built plate. In any of those cases the
    // studio's own seat line is the least-wrong guess.
    let currentDeskLine = 0.468;

    // --- the full bundle --------------------------------------------------
    // Everything main.js loaded, kept so a block swap has somewhere to swap
    // *to*. main.js hands these over as `assets.sets`, `assets.backdrops`,
    // `assets.anchors` and `assets.anchorPairs`; see loadAllAssets().
    //
    //   sets         [{ name, plate, window, deskLine }]  ten entries, in order
    //   backdrops    [{ name, img }]                       whatever layout.json listed
    //   anchors      [anchor, ...]                         the whole roster, shuffled once
    //   anchorPairs  [[a, b], [a, b], ...]                 one pair per block
    //
    // The rotation is stable within a session: block 3 always has the same
    // set, pair and backdrop until the page reloads. That is deliberate —
    // a schedule should not drift while a show is on air — and the shuffle
    // in main.js is what makes the next boot a different line-up.
    let setsBundle = [];
    let backdropsBundle = [];
    let anchorsBundle = [];
    let anchorPairsBundle = [];
    let currentBlock = 0;

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

        // Current-block contents, from the singular top-level fields main.js
        // still sets (so a partially-migrated main.js keeps working).
        setPlate = assets.set || null;
        backdrop = assets.backdrop || null;
        setWindow = assets.window || null;
        // The desk line for the current set. Falls back to the studio's
        // own value when the layout did not carry one, which is what a
        // pre-desk-line generated/ tree looks like.
        currentDeskLine = assets.deskLine || DESK_LINE;
        seated = assets.seated || [];
        robot = assets.robot || null;

        // The full bundle, for block swaps.
        setsBundle = assets.sets || [];
        backdropsBundle = assets.backdrops || [];
        anchorsBundle = assets.anchors || [];
        anchorPairsBundle = assets.anchorPairs || [];

        // If a bundle was handed over but the top-level singulars were not,
        // fall back to the bundle's first entry. This keeps a main.js that
        // only knows about the bundle working with no extra glue.
        if (!setPlate && setsBundle.length) {
            setPlate = setsBundle[0].plate;
            setWindow = setsBundle[0].window;
            currentDeskLine = setsBundle[0].deskLine || DESK_LINE;
        }
        if (!backdrop && backdropsBundle.length) {
            backdrop = backdropsBundle[0].img;
        }
        if (!seated.length && anchorPairsBundle.length) {
            seated = anchorPairsBundle[0];
        }
    }

    // ---------------------------------------------------------
    // Show-block swap
    // ---------------------------------------------------------

    /**
     * Move the station to a different show block.
     *
     * Called by the director at the top of a show, before the anchor's
     * sign-on is queued. Swaps the set plate, the window rect, the
     * backdrop, the desk line and the seated pair in one call so the
     * renderer is never in a half-swapped state mid-frame.
     *
     * What it does NOT do:
     *
     *   - Change the voice. That is `GNNTTS.setVoice()` and belongs to the
     *     director, because the voice is a property of the *speaker* and
     *     the director is what decides who speaks next. The director reads
     *     the pair it just swapped to (`GNNScript.desk()[0].voice`) and
     *     calls setVoice() itself.
     *
     *   - Reset the fades. `crossfade()` keys off the `person` object and
     *     resets automatically when it sees a different one, so a swap
     *     mid-fade cannot smear one anchor's plate into another's.
     *
     *   - Trigger any transition. The set plate and the anchors swap in a
     *     single frame, which is a hard cut. If you want a dissolve between
     *     shows, that belongs between `beginShowClose` and `beginColdOpen`
     *     — a bumper or a fade — not here.
     *
     * `n` is taken modulo the number of blocks, so the director can just
     * increment a counter forever and never think about wrapping.
     */
    function setShowBlock(n) {
        if (!setsBundle.length) return;
        const count = setsBundle.length;
        currentBlock = ((n % count) + count) % count;

        const set = setsBundle[currentBlock];
        if (set) {
            currentSetName = set.name || null;
            setPlate = set.plate;
            setWindow = set.window || null;
            // The anchors' seat line for this room. Every set carries its
            // own — written by condition_plates.py into layout.json — and
            // this is what stops the cast floating above or sinking into
            // the desk of any set that is not the studio's.
            currentDeskLine = set.deskLine || DESK_LINE;
        }

        // Backdrop per block. Rotates through whatever layout.json listed;
        // if there are fewer backdrops than blocks, they repeat, which is
        // what a channel does with a limited stock of exterior plates.
        if (backdropsBundle.length) {
            const bd = backdropsBundle[currentBlock % backdropsBundle.length];
            if (bd && bd.img) backdrop = bd.img;
        }

        // Seated pair for the block. The pair entries are the same shape
        // `loadAnchorSet()` produces — { sid, voice, hero, speaking,
        // listening, listeningFlip } — so the draw path needs no special
        // case for the swap.
        if (anchorPairsBundle.length) {
            const pair = anchorPairsBundle[currentBlock] ||
                anchorPairsBundle[0];
            if (pair && pair.length) seated = pair;
        }
    }

    /** The current block index, for anyone who needs to know. */
    function getShowBlock() { return currentBlock; }

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

    /**
     * `frames` is the animator's `{ anchor, globe }` output. It is no
     * longer read here.
     *
     * `frames.anchor` used to index the MOO1 robot's 25-cel lip matrix.
     * The robot now goes through the same anchor pipeline as every other
     * species — his `_speaking` plate carries the open mouth — so there is
     * nothing for a cel index to drive, and the two-state flap reads
     * `GNNAnimator.mouthOpen()` directly.
     *
     * `frames.globe` was for a holographic globe that is not drawn any
     * more; `GNNGlitch.globeOverride()` still exists and the animator
     * still produces the value, but no code path consumes it.
     *
     * The parameter is kept so `main.js` does not need to change. When
     * something wants the animator's per-frame state again — a station
     * ident shot with Unit 7, a revived globe, a per-frame fault read —
     * it is already here.
     */
    function drawViewport(now, icon) {
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
            // Backdrop first, then the room over it. The room's window
            // panes are cut out by condition_plates.py, so this is the only
            // place it shows — and it has to be drawn in the window's own
            // rectangle, mapped through the same cover transform the room
            // gets, or it slides against the glass when the frame resizes.
            let wx = 0, wy = 0, ww = VIEW.w, wh = VIEW.h;
            if (setPlate && setWindow) {
                const sc = Math.max(VIEW.w / setPlate.width,
                    VIEW.h / setPlate.height);
                const dw = setPlate.width * sc;
                const dh = setPlate.height * sc;
                const ox = (VIEW.w - dw) / 2;
                const oy = (VIEW.h - dh) / 2;
                wx = ox + setWindow.x0 * dw;
                wy = oy + setWindow.y0 * dh;
                ww = (setWindow.x1 - setWindow.x0) * dw;
                wh = (setWindow.y1 - setWindow.y0) * dh;
                if (backdrop) {
                    c.drawImage(backdrop, wx, wy, ww, wh);
                }
            } else if (backdrop) {
                drawCover(c, backdrop, VIEW.w, VIEW.h);
            }

            // Draw ghost anomaly outside the studio windows, on the backdrop layer behind the hosts
            drawGhost(c, now, wx, wy, ww, wh);

            if (setPlate) drawCover(c, setPlate, VIEW.w, VIEW.h);
            drawCast(c);
            if (icon && !GNNCutsceneManager.isCutawayActive()) {
                drawIconPlate(c, icon);
            }
        }

        // Cutaway / commercial break render in viewport-local space.
        GNNCutsceneManager.render(c, { x: 0, y: 0, w: VIEW.w, h: VIEW.h }, now);

        if (cleanFrame) return;
        if (!breakActive) drawFurniture(c, now);
        GNNTickerManager.render(c, { x: 0, y: 0, w: VIEW.w, h: VIEW.h });
    }

    // A frame with no broadcast graphics — no caption, crawl or LIVE bug —
    // for tools that photograph the studio (tools/compose_titlecards.py).
    // Never set on air.
    let cleanFrame = false;
    function setCleanFrame(on) { cleanFrame = !!on; }

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

    // Where the cast sits, as fractions of the frame. Kept here rather than
    // in the plate files so a replacement plate does not have to reproduce
    // someone else's margins.
    //
    // Measured off a minute of Pixel News Network rather than guessed at
    // twice. There, the head and shoulders showing above the desk come to
    // about a sixth of the frame, the desk runs off the bottom edge instead
    // of sitting inside the picture, and three anchors share the width with
    // room between them. At 0.46 and a desk 0.75 of the frame tall, one
    // anchor filled the window and there was nowhere to put a second.
    //
    // CAST.h is the whole plate; most of its lower half is behind the desk
    // drawn into the set, which the anchors are drawn over. Measured off
    // the owner's reference frame by scanning a column through an anchor:
    // head top at 0.285 of the frame and the desk's top edge at 0.551,
    // which puts a quarter of the frame on the people and a quarter on
    // the desk. Ours had the heads starting at 0.38 behind a desk that
    // began at 0.665 — the camera too close and the desk too low, so they
    // read as standing behind a counter rather than sitting at one.
    const CAST = { h: 0.300 };
    const SEATS = {
        1: [0.50],
        2: [0.37, 0.63],
        3: [0.28, 0.50, 0.72],
    };

    // The row the anchors' hands rest on, as a fraction of frame height.
    // Every set carries its own in `layout.json` — the studio and its two
    // near siblings share the studio's value, the other seven do not — and
    // the live value is `currentDeskLine`. This constant is only the
    // fallback for a set that did not carry one, which is what a
    // pre-desk-line generated/ tree looks like.
    //
    // The seat line was tuned by eye against the studio plate. The desk's
    // top surface runs from its back edge at 0.435 to its front lip at
    // 0.497, and the anchors meet the *front* lip: seated at the back edge
    // they put their hands down at the far side of the desk and their
    // bodies floated clear of it — read as two people standing behind a
    // table rather than sitting at one, and no amount of resizing fixes
    // that, because the fault is where the bottom of the plate lands, not
    // how wide it is. Meeting the front lip, the torso covers the desk's
    // top surface, which is what a person sitting at a desk does to it
    // from a head-on camera.
    const DESK_LINE = 0.468;

    /**
     * The desk. The anchor whose turn it is takes the lip frame the animator
     * worked out; everyone else holds `listening`, which is what makes a
     * desk read as a desk rather than as three portraits in a row.
     *
     * Every cast member is drawn from the same two-state art: a `hero`
     * plate and a `speaking` plate that differ only inside the mouth.
     * `condition_plates.py` builds the speaking plate as the finished
     * hero with its mouth swapped in, so a flap physically cannot move
     * anything but the mouth — no body transplant, no registration slack,
     * no whole-plate shimmer from two generations that disagree.
     *
     * The MOO1 robot used to be the exception: his `speaking` plate was
     * one of twenty-five keyed cels indexed off the animator's frame
     * number. He is now a generated anchor like everyone else — his
     * speaking plate carries the open mouth — and the branch that read
     * `person.frames` was removed here in the same change.
     */
    function drawCast(c) {
        const list = seated.slice(0, 3);
        if (!list.length) return;
        const seats = SEATS[list.length] || SEATS[1];
        const h = CAST.h * VIEW.h;
        // The seat line for the room on air. Every set carries its own in
        // `layout.json` and this is the read that lets the cast sit at the
        // right height for whichever room is showing.
        const seatY = currentDeskLine;
        // Whoever is speaking *this line*, not whoever holds the chair on
        // the rundown.
        //
        // The chair is passed once per story, so for a story read by Hale
        // then a story read by Varr it moves Hale→Varr→Hale and each anchor
        // animates in turn. But an exchange between the two, or a two-way
        // with a correspondent, plays more than one voice inside a single
        // beat — and the voice belongs to the *line*, not to the story. Using
        // the chair here made Varr's plate animate on Hale's voice during an
        // exchange, which is what the desk was doing visibly.
        //
        // `activeSeatForLine()` returns the seat of the line's speaker, or
        // -1 when the line's speaker is not at the desk (a correspondent in
        // the monitor). -1 means no seat is active and every anchor holds
        // its listening plate.
        const chair = (typeof GNNDirector !== 'undefined'
            && GNNDirector.activeSeatForLine)
            ? GNNDirector.activeSeatForLine()
            : ((typeof GNNDirector !== 'undefined' && GNNDirector.activeSeat)
                ? GNNDirector.activeSeat() : 0);
        const noActiveSeat = chair < 0;
        const chairRef = noActiveSeat ? 0 : chair;
        list.forEach((person, i) => {
            const active = !noActiveSeat && i === chairRef;
            // Two mouth states, opened by the animator's jaw rather than by
            // a threshold guessed at here.
            const open = (typeof GNNAnimator !== 'undefined'
                && GNNAnimator.mouthOpen) ? GNNAnimator.mouthOpen() : false;
            // Listeners turn toward the speaker: the plate as drawn looks
            // one way, so a seat on the speaker's right wants it mirrored
            // or it is looking off the side of the set.
            //
            // When no seat is active, everyone is a listener and the
            // mirroring is decided against the middle of the row, since
            // there is no speaker to turn toward.
            const turnRef = noActiveSeat ? Math.floor(list.length / 2) : chairRef;
            const img = active
                ? (open ? person.speaking : person.hero)
                : (i > turnRef ? person.listeningFlip : person.listening);
            if (!img) return;
            const w = img.width * (h / img.height);
            const x = seats[i] * VIEW.w - w / 2;
            const y = seatY * VIEW.h - h;
            const prev = crossfade(i, person, img);
            if (prev) {
                const pw = prev.img.width * (h / prev.img.height);
                c.drawImage(prev.img, seats[i] * VIEW.w - pw / 2, y, pw, h);
                const a = c.globalAlpha;
                c.globalAlpha = a * prev.t;
                c.drawImage(img, x, y, w, h);
                c.globalAlpha = a;
                return;
            }
            c.drawImage(img, x, y, w, h);
        });
    }

    // Per seat: which plate was last drawn, and when it changed.
    const fades = [];
    const FADE_MS = 180;

    /**
     * A turn of the head is a change of plate, and swapping one picture
     * for another in a single frame reads as a jump however well the two
     * are registered — two generations never agree everywhere.
     *
     * So a change of plate fades. The mouth flap does not: `speaking`
     * differs from `hero` only inside the mouth (condition_plates.py
     * builds it that way), so there is nothing to smooth and fading at
     * five flaps a second would only smear the mouth.
     *
     * Returns the outgoing plate and how far the fade has run, or null
     * when there is nothing to fade.
     */
    function crossfade(seat, person, img) {
        const now = (typeof performance !== 'undefined')
            ? performance.now() : Date.now();
        let f = fades[seat];
        if (!f || f.person !== person) {
            fades[seat] = { person, img, prev: null, since: now };
            return null;
        }
        if (f.img !== img) {
            const mouth = (img === person.hero && f.img === person.speaking)
                || (img === person.speaking && f.img === person.hero);
            f.prev = mouth ? null : f.img;
            f.img = img;
            f.since = now;
        }
        if (!f.prev) return null;
        const t = (now - f.since) / FADE_MS;
        if (t >= 1) { f.prev = null; return null; }
        return { img: f.prev, t };
    }

    /** A studio monitor: the art, inset in a lit bezel. */

    // ---------------------------------------------------------
    // The monitor
    // ---------------------------------------------------------

    // A generated bezel for the monitor (Prompts/Monitor_Frame_prompts.md),
    // keyed by condition_plates.py into overlays/keyed/. Its screen opening
    // is measured from its own alpha when it loads — the transparent run
    // from the centre outwards — so whatever shape the art comes back in,
    // the opening lands exactly on the monitor rectangle. Until it exists
    // the drawn border is used.
    // Two bezels: gunmetal by default, brass on the warmer sets.
    const FRAME_DIR = 'assets/generated/overlays/keyed/';
    const BRASS_SETS = new Set(['archive_wide_empty.png', 'diplomatic_wide_empty.png',
        'celebrity_wide_empty.png']);
    const frames = {};   // url -> { img, hole } | null while loading
    let currentSetName = null;

    function measureHole(im) {
        const c2 = document.createElement('canvas');
        c2.width = im.width; c2.height = im.height;
        const g = c2.getContext('2d');
        g.drawImage(im, 0, 0);
        const a = g.getImageData(0, 0, im.width, im.height).data;
        const at = (x, y) => a[(y * im.width + x) * 4 + 3];
        const cx = im.width >> 1, cy = im.height >> 1;
        let l = cx, r = cx, t = cy, b = cy;
        while (l > 0 && at(l - 1, cy) < 40) l--;
        while (r < im.width - 1 && at(r + 1, cy) < 40) r++;
        while (t > 0 && at(cx, t - 1) < 40) t--;
        while (b < im.height - 1 && at(cx, b + 1) < 40) b++;
        // A frame with no opening at its centre is not a frame.
        if (r - l < im.width * 0.3 || b - t < im.height * 0.3) return null;
        return { l: l / im.width, r: (r + 1) / im.width, t: t / im.height, b: (b + 1) / im.height };
    }

    function frameFor(url) {
        if (!(url in frames) && typeof GNNAssets !== 'undefined') {
            frames[url] = null;
            GNNAssets.loadImage(url).then((im) => {
                if (!im) return;
                try {
                    const hole = measureHole(im);
                    if (hole) frames[url] = { img: im, hole };
                } catch (_) { /* unreadable: keep the drawn border */ }
            });
        }
        return frames[url] || null;
    }

    function monitorFrameImage() {
        const brass = currentSetName && BRASS_SETS.has(currentSetName);
        return (brass && frameFor(FRAME_DIR + 'monitor_frame_brass.png'))
            || frameFor(FRAME_DIR + 'monitor_frame.png');
    }

    /**
     * The monitor's bezel around a rectangle in viewport pixels. Returns
     * false when there is no generated frame, so the caller draws its own.
     * Exported: the cutaway footage in the monitor uses the same bezel.
     */
    function drawMonitorFrame(c, x, y, w, h) {
        const f = monitorFrameImage();
        if (!f) return false;
        const hole = f.hole;
        const sw = w / (hole.r - hole.l);
        const sh = h / (hole.b - hole.t);
        c.save();
        c.imageSmoothingEnabled = true;
        c.imageSmoothingQuality = 'high';
        c.drawImage(f.img, x - hole.l * sw, y - hole.t * sh, sw, sh);
        c.restore();
        return true;
    }

    /**
     * The story icon on the monitor.
     *
     * The generated icons are pictures without lettering. The MoO1 icons
     * they replace carried their name and a double green border, and the
     * monitor reads as a newsroom graphic because of that — so the name and
     * border are drawn here, inside the screen, in the MoO1 icon's own
     * colour for that name. The MoO1 icon itself still turns up now and
     * then (icon.retro) and is drawn as it is, pixels intact.
     */
    function drawIconPlate(c, icon) {
        const R = monitorRect();
        const x = R.x * VIEW.w, y = R.y * VIEW.h, w = R.w * VIEW.w, h = R.h * VIEW.h;
        const img = icon && (icon.img || icon);
        if (!img) return;
        c.save();
        const g = c.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, '#071420'); g.addColorStop(1, '#02060b');
        c.fillStyle = g;
        c.fillRect(x, y, w, h);
        if (icon.retro || !icon.label) {
            c.imageSmoothingEnabled = false;
            const s = Math.min(w / img.width, h / img.height) * 0.94;
            c.drawImage(img, x + (w - img.width * s) / 2, y + (h - img.height * s) / 2,
                img.width * s, img.height * s);
        } else {
            const pad = Math.round(w * 0.045);
            const line = Math.max(2, Math.round(w * 0.012));
            c.lineWidth = line;
            c.strokeStyle = '#19b37f';
            c.strokeRect(x + pad, y + pad, w - pad * 2, h - pad * 2);
            c.strokeStyle = '#0c5c43';
            c.strokeRect(x + pad + line * 2, y + pad + line * 2,
                w - (pad + line * 2) * 2, h - (pad + line * 2) * 2);
            // The name, sized to fit the inner width.
            const inner = w - (pad + line * 3) * 2;
            let size = Math.round(h * 0.11);
            c.font = size + 'px "Press Start 2P", monospace';
            while (size > 7 && c.measureText(icon.label).width > inner * 0.92) {
                size -= 1;
                c.font = size + 'px "Press Start 2P", monospace';
            }
            const labelY = y + h - pad - line * 3 - size * 0.9;
            c.fillStyle = icon.color || '#ff3b3b';
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.fillText(icon.label, x + w / 2, labelY);
            // The picture fills the space above the name.
            const top = y + pad + line * 4;
            const boxH = labelY - size * 0.9 - top;
            const boxW = inner * 0.9;
            const s = Math.min(boxW / img.width, boxH / img.height);
            c.imageSmoothingEnabled = true;
            c.imageSmoothingQuality = 'high';
            c.drawImage(img, x + (w - img.width * s) / 2, top + (boxH - img.height * s) / 2,
                img.width * s, img.height * s);
        }
        c.restore();
        if (!drawMonitorFrame(c, x, y, w, h)) {
            const pad = Math.max(3, Math.round(VIEW.w * 0.004));
            c.save();
            c.strokeStyle = '#2f7f9c';
            c.lineWidth = Math.max(2, Math.round(VIEW.w * 0.0025));
            c.strokeRect(x - pad, y - pad, w + pad * 2, h + pad * 2);
            c.restore();
        }
    }

    // ---------------------------------------------------------
    // Post-processing
    // ---------------------------------------------------------

    // Scratch surfaces for the fault pass, made once. Every effect below
    // only runs while a fault is active, so the clean path stays a single
    // drawImage.
    let fxSmall = null;        // macroblock downsample
    let fxSnow = null;         // static
    let fxTint = null;         // RGB split
    let fxFreeze = null;       // held frame
    let freezeHeld = false;

    function scratch(c, w, h) {
        if (!c) c = document.createElement('canvas');
        if (c.width !== w) c.width = w;
        if (c.height !== h) c.height = h;
        return c;
    }

    function blitViewport(now) {
        const fx = GNNGlitch.videoState(now);
        const clean = !fx.roll && !fx.tear && !fx.desat && !fx.invert && !fx.shift
            && !fx.jitter && !fx.snow && !fx.pixel && !fx.mirror && !fx.split
            && !fx.zoom && !fx.band && !fx.black && !fx.bleed && !fx.card
            && !fx.freeze && !fx.strap;

        // A freeze holds whatever was on screen when it began.
        if (fx.freeze && !freezeHeld) {
            fxFreeze = scratch(fxFreeze, vcanvas.width, vcanvas.height);
            fxFreeze.getContext('2d').drawImage(vcanvas, 0, 0);
            freezeHeld = true;
        } else if (!fx.freeze) {
            freezeHeld = false;
        }

        if (clean) {
            ctx.drawImage(vcanvas, VIEW.x, VIEW.y);
            return;
        }

        let src = fx.freeze && fxFreeze ? fxFreeze : vcanvas;

        // Macroblocking: the picture rebuilt from a fraction of its pixels,
        // the way a starved digital decoder falls apart.
        if (fx.pixel && fx.pixel > 1) {
            const sw = Math.max(8, Math.round(VIEW.w / fx.pixel));
            const sh = Math.max(6, Math.round(VIEW.h / fx.pixel));
            fxSmall = scratch(fxSmall, sw, sh);
            const sc = fxSmall.getContext('2d');
            sc.imageSmoothingEnabled = false;
            sc.drawImage(src, 0, 0, sw, sh);
            src = fxSmall;
        }

        ctx.save();
        ctx.beginPath();
        ctx.rect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
        ctx.clip();
        ctx.fillStyle = '#000';
        ctx.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
        ctx.imageSmoothingEnabled = false;

        const roll = fx.roll ? (fx.roll % VIEW.h) : 0;
        const jx = fx.jitter ? (Math.random() * 4 - 2) : 0;

        // Tube breathing and mirror image are transforms of the whole frame.
        const z = fx.zoom || 1;
        const drawFrame = (img, dx, dy) => {
            ctx.save();
            ctx.translate(VIEW.x + VIEW.w / 2 + dx, VIEW.y + VIEW.h / 2 + dy);
            ctx.scale(fx.mirror ? -z : z, z);
            ctx.drawImage(img, -VIEW.w / 2, -VIEW.h / 2, VIEW.w, VIEW.h);
            ctx.restore();
        };

        // Vertical hold: the picture wraps around the tube.
        drawFrame(src, jx, roll);
        if (roll) drawFrame(src, jx, roll - VIEW.h);

        // RGB split: the red and blue guns out of convergence.
        if (fx.split) {
            fxTint = scratch(fxTint, VIEW.w, VIEW.h);
            const tc = fxTint.getContext('2d');
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.5;
            for (const [col, off] of [['#ff0000', -fx.split], ['#0040ff', fx.split]]) {
                tc.globalCompositeOperation = 'source-over';
                tc.clearRect(0, 0, VIEW.w, VIEW.h);
                tc.imageSmoothingEnabled = false;
                tc.drawImage(src, 0, 0, VIEW.w, VIEW.h);
                tc.globalCompositeOperation = 'multiply';
                tc.fillStyle = col;
                tc.fillRect(0, 0, VIEW.w, VIEW.h);
                ctx.drawImage(fxTint, VIEW.x + off + jx, VIEW.y + roll);
            }
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
        }

        // Chroma ghost.
        if (fx.shift) {
            ctx.globalAlpha = 0.45;
            ctx.globalCompositeOperation = 'lighter';
            ctx.drawImage(src, VIEW.x + fx.shift + jx, VIEW.y + roll, VIEW.w, VIEW.h);
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

        // Cross-talk: another channel bleeding through the carrier.
        if (fx.bleed && fx.bleed.img) {
            const b = fx.bleed;
            ctx.globalAlpha = Math.max(0, Math.min(1, b.alpha || 0.3));
            ctx.globalCompositeOperation = b.blend || 'screen';
            // `scale` draws the image at that fraction of the picture's
            // height, centred (a product shot); without it the image fills
            // the frame (footage).
            const sc = b.scale ? (VIEW.h * b.scale) / b.img.height
                : Math.max(VIEW.w / b.img.width, VIEW.h / b.img.height);
            const bw = b.img.width * sc, bh = b.img.height * sc;
            ctx.drawImage(b.img, VIEW.x + (VIEW.w - bw) / 2 + (b.dx || 0),
                VIEW.y + (VIEW.h - bh) / 2 + roll, bw, bh);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
            if (b.tint) {
                ctx.globalCompositeOperation = 'color';
                ctx.globalAlpha = b.tintAlpha || 0.35;
                ctx.fillStyle = b.tint;
                ctx.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
                ctx.globalAlpha = 1;
                ctx.globalCompositeOperation = 'source-over';
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

        // Mains hum bar: a soft bright band crawling up the picture.
        if (fx.band) {
            const bh = VIEW.h * 0.22;
            const by = VIEW.y + VIEW.h - ((now * 0.09) % (VIEW.h + bh));
            const g = ctx.createLinearGradient(0, by, 0, by + bh);
            g.addColorStop(0, 'rgba(255,255,255,0)');
            g.addColorStop(0.5, `rgba(255,255,255,${0.22 * fx.band})`);
            g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g;
            ctx.fillRect(VIEW.x, by, VIEW.w, bh);
        }

        // Static. A small noise field, regenerated every frame and blown
        // up, so it costs a few thousand pixels rather than a million.
        if (fx.snow) {
            const nw = 160, nh = 90;
            fxSnow = scratch(fxSnow, nw, nh);
            const nc = fxSnow.getContext('2d');
            const id = nc.createImageData(nw, nh);
            for (let i = 0; i < id.data.length; i += 4) {
                const v = (Math.random() * 255) | 0;
                id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
                id.data[i + 3] = 255;
            }
            nc.putImageData(id, 0, 0);
            ctx.globalAlpha = Math.min(1, fx.snow);
            ctx.drawImage(fxSnow, VIEW.x, VIEW.y, VIEW.w, VIEW.h);
            ctx.globalAlpha = 1;
        }

        if (fx.black) {
            ctx.fillStyle = `rgba(0,0,0,${Math.min(1, fx.black)})`;
            ctx.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
        }

        if (fx.card) drawFaultCard(fx, now);
        // A caption strap over a live picture — an intrusion naming itself.
        else if (fx.strap) drawCardStrap(fx.strap, now, 'top');
        ctx.restore();
    }

    /** Full-frame cards a failing station falls back to. */
    function drawFaultCard(fx, now) {
        const x = VIEW.x, y = VIEW.y, w = VIEW.w, h = VIEW.h;
        if (fx.card === 'bars') {
            // 75% colour bars, the castellation row and a station block.
            const top = ['#bfbfbf', '#bfbf00', '#00bfbf', '#00bf00',
                '#bf00bf', '#bf0000', '#0000bf'];
            const mid = ['#0000bf', '#131313', '#bf00bf', '#131313',
                '#00bfbf', '#131313', '#bfbfbf'];
            const bw = w / 7;
            top.forEach((c, i) => {
                ctx.fillStyle = c;
                ctx.fillRect(x + i * bw, y, Math.ceil(bw), h * 0.67);
            });
            mid.forEach((c, i) => {
                ctx.fillStyle = c;
                ctx.fillRect(x + i * bw, y + h * 0.67, Math.ceil(bw), h * 0.08);
            });
            const low = ['#00214c', '#ffffff', '#32006a', '#131313', '#090909', '#131313', '#1d1d1d'];
            low.forEach((c, i) => {
                ctx.fillStyle = c;
                ctx.fillRect(x + i * bw, y + h * 0.75, Math.ceil(bw), h * 0.25);
            });
            ctx.fillStyle = 'rgba(0,0,0,0.78)';
            ctx.fillRect(x + w * 0.34, y + h * 0.40, w * 0.32, h * 0.14);
            ctx.font = `${Math.round(h * 0.045)}px "Press Start 2P", monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffffff';
            ctx.fillText('G N N', x + w / 2, y + h * 0.445);
            ctx.font = `${Math.round(h * 0.022)}px "Press Start 2P", monospace`;
            ctx.fillText(fx.cardText || 'LINE-UP  1 kHz  -18 dBFS', x + w / 2, y + h * 0.505);
            ctx.textAlign = 'start';
            return;
        }
        if (fx.card === 'image' && fx.cardImage) {
            const img = fx.cardImage;
            const sc = Math.max(w / img.width, h / img.height);
            ctx.drawImage(img, x + (w - img.width * sc) / 2,
                y + (h - img.height * sc) / 2, img.width * sc, img.height * sc);
            if (fx.cardText) drawCardStrap(fx.cardText, now);
            return;
        }
        if (fx.card === 'standby') {
            ctx.fillStyle = 'rgba(4,10,24,0.86)';
            ctx.fillRect(x, y, w, h);
            const blink = Math.floor(now / 600) % 2;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = `${Math.round(h * 0.05)}px "Press Start 2P", monospace`;
            ctx.fillStyle = '#ffd25a';
            ctx.fillText(fx.cardText || 'TECHNICAL DIFFICULTIES', x + w / 2, y + h * 0.44);
            ctx.font = `${Math.round(h * 0.028)}px "Press Start 2P", monospace`;
            ctx.fillStyle = blink ? '#e6eef8' : '#8fa3b8';
            ctx.fillText(fx.cardSub || 'PLEASE STAND BY', x + w / 2, y + h * 0.54);
            ctx.textAlign = 'start';
        }
    }

    // Bottom on a full card; top over a live picture, where the bottom of
    // the frame belongs to the anchor's caption.
    function drawCardStrap(text, now, where) {
        const sh = VIEW.h * 0.08;
        const sy = VIEW.y + VIEW.h * (where === 'top' ? 0.05 : 0.80);
        ctx.fillStyle = 'rgba(0,0,0,0.72)';
        ctx.fillRect(VIEW.x, sy, VIEW.w, sh);
        ctx.font = `${Math.round(sh * 0.36)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = Math.floor(now / 500) % 2 ? '#ffffff' : '#ffd25a';
        ctx.fillText(text, VIEW.x + VIEW.w / 2, sy + sh / 2);
        ctx.textAlign = 'start';
    }

    // ---------------------------------------------------------
    // Overlays
    // ---------------------------------------------------------

    // The generated breaking-news frame, keyed by condition_plates.py so
    // its interior is clear. Loaded once; until it arrives — or on a clone
    // without it — the drawn border below is used instead.
    const ALERT_FRAME_URL = 'assets/generated/overlays/keyed/breaking_news_frame.png';
    let alertFrame;
    function alertFrameImage() {
        if (alertFrame === undefined && typeof GNNAssets !== 'undefined') {
            alertFrame = null;
            GNNAssets.loadImage(ALERT_FRAME_URL).then((im) => { alertFrame = im; });
        }
        return alertFrame;
    }

    function drawAlertBorder(now) {
        const pulse = (Math.sin(now / 140) + 1) / 2;
        const frame = alertFrameImage();
        if (frame) {
            ctx.save();
            // Pulses between full and three-quarter strength rather than
            // flashing: it stays up for the whole breaking segment.
            ctx.globalAlpha = 0.75 + pulse * 0.25;
            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(frame, VIEW.x, VIEW.y, VIEW.w, VIEW.h);
            ctx.restore();
            return;
        }
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

    function drawGhost(c, now, wx, wy, ww, wh) {
        if (typeof GNNGlitch === 'undefined') return;
        const fault = GNNGlitch.activeName();
        if (fault !== 'ghost_signal' && fault !== 'interference') return;
        const img = GNNGlitch.ghostAsset();
        if (!img) return;
        const hard = fault === 'interference';
        c.save();
        c.beginPath();
        c.rect(wx, wy, ww, wh);
        c.clip();
        c.globalAlpha = hard ? 0.75 + Math.random() * 0.25
            : 0.45 + Math.random() * 0.35;
        c.globalCompositeOperation = hard ? 'source-over' : 'lighter';
        c.imageSmoothingEnabled = false;
        const sc = Math.max(ww / img.width, wh / img.height);
        const dw = img.width * sc;
        const dh = img.height * sc;
        const dx = wx + (ww - dw) / 2;
        const dy = wy + (wh - dh) / 2;
        c.drawImage(img, dx, dy, dw, dh);
        c.restore();
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

    /**
     * One frame.
     *
     * `frames` is the animator's per-frame output, currently
     * `{ anchor, globe }`, and is passed straight through from `main.js`.
     * It is not read here any more — see the long comment on
     * `drawViewport()` — but the parameter is kept so the caller does not
     * need to change and so a revived use has somewhere to land.
     */
    function renderFrame(now, frames, icon) {
        if (!ctx) return;
        try {
            fit();
            ctx.imageSmoothingEnabled = false;

            ctx.fillStyle = '#05080e';
            ctx.fillRect(0, 0, VIEW.w, VIEW.h);

            drawViewport(now, icon);
            blitViewport(now);

            if (GNNGlitch.isBreaking(now)) drawAlertBorder(now);
            if (GNNGlitch.isOrionMode()) drawOrionBadge(now);

            // A commercial is a self-contained segment that sets its own
            // type — a product name, a tagline, its own margins. Drawing the
            // teleprompter caption over it put a panel through the tagline.
            // The break owns the frame while it is running.
            //
            // Likewise a fault that has replaced the picture — colour bars,
            // the test card, black — takes the captions with it.
            if (!cleanFrame && !GNNCutsceneManager.isBreakActive()
                && !(GNNGlitch.hidesGraphics && GNNGlitch.hidesGraphics(now))) {
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
        // Same seat line the draw path uses, so a click lands on the face
        // the renderer actually drew rather than on where the studio's own
        // desk would have put it. A set whose desk sits higher or lower
        // than the studio's moves its anchors and its hit regions together.
        const seatY = currentDeskLine;
        return {
            monitor: {
                x: monitorRect().x * VIEW.w, y: monitorRect().y * VIEW.h,
                w: monitorRect().w * VIEW.w, h: monitorRect().h * VIEW.h,
            },
            // The upper third of each plate is the head.
            faces: list.map((person, i) => {
                // Every cast member carries `hero`. The `person.frames`
                // fallback that used to sit here was for the MOO1 robot's
                // cel array, which no longer exists — see `drawCast()`.
                const img = person.hero;
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
        /** Swap what is outside the window. */
        setBackdrop: (img) => { if (img) backdrop = img; },
        /**
         * Move to another show block. Swaps the set, the window rect, the
         * backdrop, the desk line and the seated pair in one call. Does
         * NOT change the voice — the director does that, because it is
         * what decides who speaks next. See the long comment on the
         * function.
         */
        setShowBlock,
        setCleanFrame,
        drawMonitorFrame,
        hasMonitorFrame: () => !!monitorFrameImage(),
        /** Current block index, for anyone who needs to know. */
        getShowBlock,
        /** The seat line currently in effect, for anyone who needs it. */
        getDeskLine: () => currentDeskLine,
        get CANVAS_W() { return CANVAS_W; },
        get CANVAS_H() { return CANVAS_H; },
    };
})();