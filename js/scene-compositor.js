/* ============================================================
   GNN — Scene Compositor
   ------------------------------------------------------------
   Builds *new* footage out of old parts.

   A scene is a plain object: { layers[], duration, label }.
   Layers carry their own frames, motion model and blend mode.

   ------------------------------------------------------------
   Recent changes:

     MoO2 archives in recipes
                    Every recipe's `dirs` array now names the
                    MoO2 archives that hold footage for that
                    subject: CMBTSHP and CMBTSFX for convoy,
                    STARBG and GSTAR for survey, COUNCIL and
                    DIPLOMAT for council, BLDG0..4 for industry,
                    and so on. MoO2 items were already admitted
                    to pools by extract_moo2.py and folded into
                    the manifest by merge_moo2_manifests.py;
                    what was missing was a recipe that named
                    their directory.

                    Archives whose names collide with an MoO1
                    archive (SHIPS, PLANETS, MONSTER, SHIPS2)
                    need no change here — MoO2 entries carry
                    `dir: 'SHIPS'` just like the MoO1 ones, so
                    `{dirs: ['SHIPS']}` already reaches both
                    libraries and the runtime tells them apart
                    by the `source` field when it builds a path.

     INTERVIEW_DEFAULTS
                    Tuned in tools/interview_tuner.html and locked
                    in here. The constants were moved to the top of
                    the module so a fresh tuning pass starts from
                    known-good values rather than guesses.

     composeInterview()
                    The EMBASSY three-plate composition pulled out of
                    the recipe and into its own function. The recipe
                    calls it with no arguments; the tuner calls it
                    with slider values as overrides. One function,
                    one behaviour, no drift between preview and air.

     DENY_IDS       A runtime deny set for assets that decode wrong
                    or are not footage.

     deepfield      Pool filter prevents chrome button fills and
                    blank sentinels from being picked as washes.

     industry       Pool filter prevents BACKGRND UI panels and
                    DESIGN screens from being the establishing shot.

     synthesize     A named recipe that does not exist returns null.
   ============================================================ */
console.log('[scene-compositor] v13 — MoO2 archives in recipe dirs');
const GNNSceneCompositor = (() => {
    'use strict';

    const BASE_W = 320;
    const BASE_H = 200;

    // ---------------------------------------------------------
    // Interview composition constants
    // ---------------------------------------------------------
    //
    // Defaults for the EMBASSY interview composition. See
    // composeInterview() below. The tuner at tools/interview_tuner.html
    // starts from these values and lets you find new ones; paste its
    // export back into this block to lock them in.
    //
    // The three plates are:
    //   EMBASSY item_01   room, 320x130 native
    //   EMBASSY 02-11     ambassador, 175x130 native, animated
    //   EMBASSY 12-17     player representative, 320x200 native
    //
    // The room and the ambassador share a native height of 130, and the
    // ambassador's plate carries a strip of the room's own background
    // around the figure. For that strip to line up with the room they
    // must be scaled by the same factor — hence the `lock scale to room`
    // checkbox in the tuner, which mirrors roomScale into ambScale.
    //
    // Values below were tuned against the game's own embassy scene.
    // 200/130 = 1.5384615384615385 — the exact scale that makes the
    // room's 130-pixel native height fill the frame's 200. The
    // ambassador carries the same scale so her strip stays aligned.
    // The rep's 1.483 scale and 51-pixel downward shift put the
    // representative figure at the position the game draws it in.
    const INTERVIEW_DEFAULTS = {
        roomScale: 1.5384615384615385,
        roomDx: 0,
        roomDy: 0,

        ambScale: 1.5384615384615385,
        ambDx: 31,
        ambDy: 0,

        repScale: 2,
        repDx: 4,
        repDy: 51,
    };

    let buffer = null;
    let bctx = null;

    function ensureBuffer() {
        if (!buffer) {
            buffer = document.createElement('canvas');
            buffer.width = BASE_W;
            buffer.height = BASE_H;
            bctx = buffer.getContext('2d');
            bctx.imageSmoothingEnabled = false;
        }
        return bctx;
    }

    // ---------------------------------------------------------
    // Deny list
    // ---------------------------------------------------------
    const STATIC_DENY = new Set([
        ...Array.from({ length: 24 }, (_, i) =>
            'COUNCIL/item_' + String(i).padStart(2, '0')),

        'LANDING/item_00', 'LANDING/item_01', 'LANDING/item_02',
        'LANDING/item_03', 'LANDING/item_04', 'LANDING/item_05',
        'LANDING/item_06',

        ...Array.from({ length: 17 }, (_, i) =>
            'LANDING/item_' + String(i + 20).padStart(2, '0')),

        'BACKGRND/item_16',

        'STARVIEW/item_00',
        'STARVIEW/item_42', 'STARVIEW/item_43',
        'STARVIEW/item_44', 'STARVIEW/item_45',

        'EMBASSY/item_00',

        'SPIES/item_01', 'SPIES/item_06', 'SPIES/item_10',
        'SPIES/item_16', 'SPIES/item_22', 'SPIES/item_28',

        'TECHNO/item_03', 'TECHNO/item_04', 'TECHNO/item_05',
        'TECHNO/item_06', 'TECHNO/item_07',

        ...Array.from({ length: 34 }, (_, i) =>
            'VORTEX/item_' + String(i + 1).padStart(2, '0')),

        // Found by contact-sheeting the whole broll pool, which is what
        // commercials draw from. VORTEX/item_00 is the only VORTEX item the
        // range above left eligible, and it is the scrambled one — a magenta
        // field with the landscape smeared through it. INTRO2/item_00 is
        // black from edge to edge. SPIES 00 and 27 are keyed-out figures on
        // black, the same reason the other SPIES items are already here.
        'VORTEX/item_00',
        'INTRO2/item_00',
        // INTRO2/item_02 is the game's scrolling credits. It aired behind a
        // correspondent in the monitor; the owner deleted its frames, and
        // this keeps a re-extraction from putting it back on air.
        'INTRO2/item_02',
        'SPIES/item_00', 'SPIES/item_27',
        // COLONIES 02 and 03 decode with a scattered-pixel purple sky; the
        // other 26 are clean landscapes. Nothing queries COLONIES today,
        // which kept these off air only by accident — denied so a future
        // `dirs` list cannot bring them back.
        'COLONIES/item_02', 'COLONIES/item_03',
        // MoO2 COLONY2/item_51 is an empty colony-screen panel that passes
        // the broll gates. CMBTSFX 69-78 are smoke clouds whose frames,
        // built on each other as the decoder now does, end as a solid black
        // disc; whether the game composes them that way is not known.
        'moo2/COLONY2/item_51',
        ...Array.from({ length: 10 }, (_, i) => 'moo2/CMBTSFX/item_' + (69 + i)),
        // MoO2's EVENTS archive is the game's own GNN newsroom and the event
        // pictures it showed — in-universe, GNN-branded. They air only on the
        // lore show, loaded by path in icon-manager.js. Denied here so a
        // re-merge that pools them by size cannot put them behind real news.
        ...Array.from({ length: 38 }, (_, i) =>
            'moo2/EVENTS/item_' + String(i).padStart(2, '0')),
        // DIPLOMAT: MoO2's holographic ambassadors, one pair of animations
        // per race, in-universe faces. Same reason as EVENTS.
        ...Array.from({ length: 39 }, (_, i) =>
            'moo2/DIPLOMAT/item_' + String(i).padStart(2, '0')),
        // MoO2 COUNCIL: the Galactic Council's members and chamber. Decoded
        // correctly since 2026-10-18 (palette rule widened); in-universe.
        ...Array.from({ length: 197 }, (_, i) =>
            'moo2/COUNCIL/item_' + String(i).padStart(i < 100 ? 2 : 3, '0')),
        // MoO2 OFFICER: leader portraits, in-universe faces.
        ...Array.from({ length: 344 }, (_, i) =>
            'moo2/OFFICER/item_' + String(i).padStart(i < 100 ? 2 : 3, '0')),
    ]);

    function loadDynamicDeny() {
        try {
            const raw = localStorage.getItem('gnn.denyIds');
            if (!raw) return new Set();
            const arr = JSON.parse(raw);
            return Array.isArray(arr) ? new Set(arr) : new Set();
        } catch (_) { return new Set(); }
    }

    let dynamicDeny = loadDynamicDeny();

    function isDenied(id) {
        return !!id && (STATIC_DENY.has(id) || dynamicDeny.has(id));
    }

    function setDenied(id, denied) {
        if (!id) return;
        if (denied) dynamicDeny.add(id);
        else dynamicDeny.delete(id);
        try {
            localStorage.setItem('gnn.denyIds',
                JSON.stringify([...dynamicDeny]));
        } catch (_) { }
    }

    function getDenyList() {
        return {
            static: [...STATIC_DENY].sort(),
            dynamic: [...dynamicDeny].sort(),
        };
    }

    function clearDynamicDeny() {
        dynamicDeny.clear();
        try { localStorage.removeItem('gnn.denyIds'); } catch (_) { }
    }

    function importDynamicDeny(ids) {
        dynamicDeny = new Set(Array.isArray(ids) ? ids : []);
        try {
            localStorage.setItem('gnn.denyIds',
                JSON.stringify([...dynamicDeny]));
        } catch (_) { }
    }

    // ---------------------------------------------------------
    // Strict queries
    // ---------------------------------------------------------
    const FIELD_FOR = {
        minW: 'w', maxW: 'w',
        minH: 'h', maxH: 'h',
        minCoverage: 'coverage', maxCoverage: 'coverage',
        minLum: 'lum',
        maxNoise: 'noise',
        minFrames: 'frames',
    };

    function find(q = {}) {
        const results = GNNAssets.find(q);
        const needed = [];
        for (const key in FIELD_FOR) {
            if (q[key] === undefined) continue;
            const field = FIELD_FOR[key];
            if (needed.indexOf(field) < 0) needed.push(field);
        }
        return results.filter((e) => {
            if (isDenied(e.id)) return false;
            for (let i = 0; i < needed.length; i++) {
                if (typeof e[needed[i]] !== 'number') return false;
            }
            return true;
        });
    }

    function pick(q) {
        const pool = Array.isArray(q) ? q : find(q);
        return pool.length ? pool[(Math.random() * pool.length) | 0] : null;
    }

    function pickMany(q, n) {
        const pool = (Array.isArray(q) ? q.slice() : find(q));
        const out = [];
        while (out.length < n && pool.length) {
            out.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]);
        }
        return out;
    }

    // ---------------------------------------------------------
    // Motion models
    // ---------------------------------------------------------

    const MOTION = {
        still() { return { x: 0, y: 0, s: 1, r: 0, a: 1 }; },
        drift(t, p) {
            return { x: Math.sin(t * p.sx) * p.ax, y: Math.cos(t * p.sy) * p.ay, s: 1, r: 0, a: 1 };
        },
        pan(t, p) {
            const u = (t * p.speed) % 1;
            return { x: p.from + (p.to - p.from) * u, y: p.dy || 0, s: 1, r: 0, a: 1 };
        },
        cross(t, p) {
            const u = ((t * p.speed) % 1);
            return { x: -p.span / 2 + p.span * u, y: p.dy + Math.sin(u * Math.PI * 2) * (p.wobble || 0), s: 1, r: 0, a: 1 };
        },
        approach(t, p) {
            const u = ((t * p.speed) % 1);
            return { x: p.dx * (1 - u), y: p.dy * (1 - u), s: p.from + (p.to - p.from) * u, r: 0, a: 1 };
        },
        orbit(t, p) {
            const a = t * p.speed * Math.PI * 2;
            return { x: Math.cos(a) * p.rx, y: Math.sin(a) * p.ry * 0.5, s: 1, r: 0, a: 1 };
        },
        pulse(t, p) {
            return { x: 0, y: 0, s: 1, r: 0, a: p.min + (p.max - p.min) * (0.5 + 0.5 * Math.sin(t * p.speed * 6.283)) };
        },
        // One-shot moves, for things that travel once and stop: a tracer
        // bolt across the field, a trooper running in to his position.
        // Measured from the layer's own start time `t0`, unlike the
        // looping models above.
        shot(t, p) {
            const u = Math.max(0, Math.min(1, (t - p.t0) / p.dur));
            return { x: p.dx * u, y: p.dy * u, s: 1, r: 0, a: 1 };
        },
        advance(t, p) {
            const u = Math.max(0, Math.min(1, (t - p.t0) / p.dur));
            return { x: p.from * (1 - u), y: 0, s: 1, r: 0, a: 1 };
        },
        scanline(t, p) {
            return { x: 0, y: ((t * p.speed * BASE_H) % (BASE_H + p.h)) - p.h, s: 1, r: 0, a: p.a || 0.5 };
        },
    };

    function motionAt(layer, t) {
        const fn = MOTION[layer.motion] || MOTION.still;
        return fn(t, layer.params || {});
    }

    // ---------------------------------------------------------
    // Layer construction
    // ---------------------------------------------------------

    async function makeLayer(entry, spec) {
        if (!entry) return null;
        const preloaded = (entry.img && entry.img.naturalWidth > 0)
            ? entry.img : null;
        if (preloaded) {
            const out = Object.assign({
                entry: null,
                frames: [preloaded],
                fps: 0,
                motion: 'still',
                params: {},
                blend: 'source-over',
                alpha: 1,
                fit: 'cover',
                rect: null,
                offset: 0,
            }, spec);
            out.frames = [preloaded];
            return out;
        }
        const maxFrames = spec.maxFrames || (entry.frames > 60 ? 60 : entry.frames);
        const frames = await GNNAssets.loadClip(entry, maxFrames);
        if (!frames.length) return null;
        return Object.assign({
            entry,
            frames,
            fps: spec.fps || (entry.frames > 1 ? 12 : 0),
            motion: 'still',
            params: {},
            blend: 'source-over',
            alpha: 1,
            fit: 'contain',
            rect: null,
            offset: 0,
        }, spec, { frames });
    }

    function fitRect(layer, img) {
        if (layer.rect) {
            const r = layer.rect;
            return {
                x: r.x * BASE_W, y: r.y * BASE_H,
                w: (r.w !== undefined ? r.w : img.width / BASE_W) * BASE_W,
                h: (r.h !== undefined ? r.h : img.height / BASE_H) * BASE_H,
            };
        }
        if (layer.fit === 'cover') {
            const s = Math.max(BASE_W / img.width, BASE_H / img.height);
            const w = img.width * s, h = img.height * s;
            return { x: (BASE_W - w) / 2, y: (BASE_H - h) / 2, w, h };
        }
        if (layer.fit === 'stretch') return { x: 0, y: 0, w: BASE_W, h: BASE_H };
        if (layer.fit === 'native') {
            return { x: (BASE_W - img.width) / 2, y: (BASE_H - img.height) / 2, w: img.width, h: img.height };
        }
        const s = Math.min(BASE_W / img.width, BASE_H / img.height);
        const w = img.width * s, h = img.height * s;
        return { x: (BASE_W - w) / 2, y: (BASE_H - h) / 2, w, h };
    }

    // ---------------------------------------------------------
    // Drawing
    // ---------------------------------------------------------

    function draw(scene, elapsed) {
        const ctx = ensureBuffer();
        const t = elapsed / 1000;
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = scene.bg || '#05070c';
        ctx.fillRect(0, 0, BASE_W, BASE_H);

        for (const layer of scene.layers) {
            if (!layer || !layer.frames.length) continue;
            if (layer.in !== undefined && t < layer.in) continue;
            if (layer.out !== undefined && t > layer.out) continue;

            // Hold the last frame instead of wrapping. Same fix as
            // cutscene-manager.js: the modulo sent an over-length
            // animation back to frame zero mid-shot, which reads to the
            // viewer as the picture starting over.
            const idx = layer.fps
                ? Math.min(layer.frames.length - 1,
                    Math.floor((t + layer.offset) * layer.fps))
                : Math.min(layer.frames.length - 1, layer.frameIndex || 0);
            const img = layer.frames[idx];
            if (!img) continue;

            const m = motionAt(layer, t);
            const r = fitRect(layer, img);
            const w = r.w * m.s * (layer.scale || 1);
            const h = r.h * m.s * (layer.scale || 1);
            const x = r.x + m.x + (layer.dx || 0) - (w - r.w) / 2;
            const y = r.y + m.y + (layer.dy || 0) - (h - r.h) / 2;

            let alpha = layer.alpha * m.a;
            if (layer.fadeIn && t < layer.fadeIn) alpha *= t / layer.fadeIn;
            if (layer.fadeOut && scene.duration
                && t > scene.duration / 1000 - layer.fadeOut) {
                alpha *= Math.max(0, (scene.duration / 1000 - t) / layer.fadeOut);
            }
            ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
            ctx.globalCompositeOperation = layer.blend;

            if (layer.flip) {
                ctx.save();
                ctx.translate(x + w, y);
                ctx.scale(-1, 1);
                ctx.drawImage(img, 0, 0, w, h);
                ctx.restore();
            } else if (layer.tile) {
                for (let tx = -w; tx < BASE_W + w; tx += w) {
                    ctx.drawImage(img, x % w + tx, y, w, h);
                }
            } else {
                ctx.drawImage(img, x, y, w, h);
            }
        }

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        return buffer;
    }

    // ---------------------------------------------------------
    // Scene synthesis
    // ---------------------------------------------------------

    // Every directory a sprite query may draw from, across both games.
    //
    // MoO1: the ship, missile and nebula archives the original recipes
    //       were written against.
    //
    // MoO2: the combat and fleet archives the extractor now admits to
    //       the `sprite` pool. `CMBTSHP` is the MoO2 ship catalogue
    //       (the analogue of MoO1's `SHIPS`), `CMBTMISL` its missiles,
    //       `CMBTFGTR` the fighter cels, `CMBTSFX` beam and explosion
    //       effects, `COMBAT` the combat-screen overlays. `FLEET` and
    //       `FLTICONS` are the strategic-map ship markers, useful for
    //       a convoy beat. `BEAMS` is standalone beam art. `GSTAR` and
    //       `STARBG` are star fields that read as sprite-sized washes.
    //
    // Note that `SHIPS`, `SHIPS2`, `PLANETS` and `MONSTER` name both
    // games at once: MoO2 entries carry `dir: 'SHIPS'` just like MoO1
    // entries do, so a query for `{dirs: ['SHIPS']}` returns both.
    // The runtime distinguishes them by `entry.source` when it builds
    // a frame path. Colliding archives need no second entry here.
    const SPRITE_DIRS = [
        // MoO1
        'SHIPS', 'SHIPS2', 'MISSILE', 'NEBULA', 'PLANETS', 'SPACE', 'VORTEX',
        // MoO2 (non-colliding only)
        'CMBTSHP', 'CMBTMISL', 'CMBTFGTR', 'CMBTSFX', 'COMBAT',
        // Not FLEET (leader portraits and buttons) and not STARBG
        // (cut-out nebula blobs) — both looked wrong on air.
        'FLTICONS', 'BEAMS', 'GSTAR',
    ];

    const CLEAN_BACKDROP = 95;
    const CLEAN_PLATE = 95;

    function backdrops(extra) {
        return find(Object.assign({
            pool: 'broll', minLum: 12,
        }, extra || {}));
    }

    function sprites(extra) {
        return find(Object.assign({
            pool: 'sprite', dirs: SPRITE_DIRS,
        }, extra || {}));
    }

    function embassyRange(archive, first, last) {
        const out = [];
        for (let i = first; i <= last; i++) {
            const id = archive + '/item_' + String(i).padStart(2, '0');
            if (isDenied(id)) continue;
            const entry = GNNAssets.get(id);
            if (entry) out.push(entry);
        }
        return out;
    }

    /**
     * Compose the EMBASSY interview as a scene object.
     *
     * Every parameter is optional. Defaults come from INTERVIEW_DEFAULTS
     * at the top of the module; overrides are read from `opts`. This is
     * the entry point the tuner at tools/interview_tuner.html calls —
     * it passes each slider's current value as an override, so the
     * tuner and the live recipe are the same code path.
     *
     * What the composition looks like:
     *
     *   layer 1   room (EMBASSY item_01), scaled up to fill the frame
     *   layer 2   ambassador (EMBASSY 02-11), same scale as the room so
     *             her plate's background strip lines up with the room's
     *   layer 3   player representative (EMBASSY 12-17), native size,
     *             drawn full-frame; its transparent middle reveals the
     *             room and ambassador underneath
     *
     * The rep plate is natively 320x200 — the same size as the frame —
     * with the representative figure already drawn at the position the
     * artist placed it in. Drawing it full-frame at scale 1 puts the
     * figure back where the game puts it.
     */
    async function composeInterview(opts = {}) {
        const d = INTERVIEW_DEFAULTS;
        const v = (k) => (opts[k] !== undefined ? opts[k] : d[k]);

        const roomEntry = (opts.roomId && GNNAssets.get(opts.roomId))
            || GNNAssets.get('EMBASSY/item_01');
        const figureEntry = (opts.figureId && GNNAssets.get(opts.figureId))
            || pick(embassyRange('EMBASSY', 2, 11));
        const repEntry = (opts.repId && GNNAssets.get(opts.repId))
            || pick(embassyRange('EMBASSY', 12, 17));

        const layers = [];
        if (roomEntry && !isDenied(roomEntry.id)) {
            layers.push(await makeLayer(roomEntry, {
                fit: 'native',
                scale: v('roomScale'),
                dx: v('roomDx'),
                dy: v('roomDy'),
            }));
        }
        if (figureEntry && !isDenied(figureEntry.id)) {
            layers.push(await makeLayer(figureEntry, {
                fit: 'native',
                scale: v('ambScale'),
                dx: v('ambDx'),
                dy: v('ambDy'),
                fps: 10,
            }));
        }
        if (repEntry && !isDenied(repEntry.id)) {
            layers.push(await makeLayer(repEntry, {
                fit: 'native',
                scale: v('repScale'),
                dx: v('repDx'),
                dy: v('repDy'),
            }));
        }
        if (!layers.length) {
            const fallbackRoom = pick(backdrops({ dirs: ['LANDING'] }));
            const fallbackSubject = pick(find({
                pool: 'portrait', dirs: ['SPIES'], minW: 100, minH: 100,
            }));
            if (fallbackRoom) {
                layers.push(await makeLayer(fallbackRoom, { fit: 'cover', alpha: 0.7 }));
            }
            if (fallbackSubject) {
                layers.push(await makeLayer(fallbackSubject, { fit: 'contain', fps: 10 }));
            }
        }
        return {
            kind: 'interview',
            label: 'DIPLOMATIC INTERVIEW',
            layers: layers.filter(Boolean),
            duration: 8000,
        };
    }

    // ---------------------------------------------------------
    // Ground war: MoO2's COLGCBT troop animations on a planet surface
    // ---------------------------------------------------------
    //
    // COLGCBT holds four unit types with five animations each — move, die,
    // shoot, hit, idle. Infantry come in both facings (00–04 face right,
    // 05–09 face left); the tank (10–14) and the power-armour trooper
    // (15–19) face left only, so the left army flips them. Item 20 is a
    // 9x8 impact spark. The shadow under every unit decodes as a flat
    // purple (108,48,108): it is redrawn as a translucent dark. The two
    // armies are told apart by tint — the right army hue-rotated from the
    // archive's green to red.
    const GW_TYPES = {
        infantryR: { move: 0, die: 1, shoot: 2, idle: 4, flash: 1, size: 'inf' },
        infantryL: { move: 5, die: 6, shoot: 7, idle: 9, flash: 1, size: 'inf' },
        tank: { move: 10, die: 11, shoot: 12, idle: 14, flash: 2, size: 'tank' },
        armour: { move: 15, die: 16, shoot: 17, idle: 19, flash: 4, size: 'inf' },
    };
    const GW_FPS = 10;
    const GW_SECONDS = 10;
    const gwCache = new Map();

    function gwEntry(n) {
        const id = 'moo2/COLGCBT/item_' + String(n).padStart(2, '0');
        return GNNAssets.get(id) || GNNAssets.get('COLGCBT/item_' + String(n).padStart(2, '0'));
    }

    /** One animation's frames, shadow fixed and tinted for its army. */
    async function gwFrames(n, tint) {
        const key = n + ':' + tint;
        if (gwCache.has(key)) return gwCache.get(key);
        const entry = gwEntry(n);
        const raw = entry ? await GNNAssets.loadClip(entry, entry.frames) : [];
        const out = raw.map((img) => {
            const c = document.createElement('canvas');
            c.width = img.width; c.height = img.height;
            const g = c.getContext('2d');
            g.drawImage(img, 0, 0);
            const src = document.createElement('canvas');
            src.width = img.width; src.height = img.height;
            const sg = src.getContext('2d');
            sg.drawImage(img, 0, 0);
            const a = sg.getImageData(0, 0, c.width, c.height).data;
            const d = g.getImageData(0, 0, c.width, c.height);
            for (let i = 0; i < a.length; i += 4) {
                if (a[i + 3] && a[i] === 108 && a[i + 1] === 48 && a[i + 2] === 108) {
                    d.data[i] = 0; d.data[i + 1] = 0; d.data[i + 2] = 0; d.data[i + 3] = 96;
                } else if (tint && a[i + 1] > a[i] && a[i + 1] > a[i + 2]) {
                    // Recolour the uniform only — green-dominant pixels —
                    // by swapping red and green. A hue rotation of the
                    // whole sprite also turned its muzzle flashes and
                    // explosions blue.
                    d.data[i] = a[i + 1]; d.data[i + 1] = a[i];
                }
            }
            g.putImageData(d, 0, 0);
            return c;
        });
        gwCache.set(key, out);
        return out;
    }

    function gwBolt(colour) {
        const c = document.createElement('canvas');
        c.width = 7; c.height = 2;
        const g = c.getContext('2d');
        g.fillStyle = colour; g.fillRect(0, 0, 7, 1);
        g.globalAlpha = 0.5; g.fillRect(1, 1, 5, 1);
        return c;
    }

    async function groundWarScene(seconds = GW_SECONDS) {
        const ground = pick(find({ pool: 'broll', dirs: ['PLANETS'] })
            .filter((e) => e.source === 'moo2' && e.w >= 600));
        const sky = pick(find({ pool: 'broll', dirs: ['STARVIEW'] }));
        const layers = [];
        if (sky) layers.push(await makeLayer(sky, { fit: 'cover', fps: 0 }));
        if (ground) layers.push(await makeLayer(ground, { fit: 'cover', fps: 0 }));

        const total = GW_FPS * seconds;
        const sides = [
            { dir: 1, tint: 0, xs: [0.04, 0.38], bolt: gwBolt('#ffe27a'),
              kinds: ['infantryR', 'infantryR', 'infantryR', 'tank', 'armour'] },
            { dir: -1, tint: 240, xs: [0.62, 0.96], bolt: gwBolt('#ff5a7a'),
              kinds: ['infantryL', 'infantryL', 'infantryL', 'tank', 'armour'] },
        ];
        // Item 20 was meant as the hit spark, but at 9x8 it decodes as a
        // red heart. A small drawn burst reads as a hit at any size.
        const spark = [(() => {
            const c = document.createElement('canvas');
            c.width = 9; c.height = 9;
            const g = c.getContext('2d');
            const r = g.createRadialGradient(4.5, 4.5, 0, 4.5, 4.5, 4.5);
            r.addColorStop(0, 'rgba(255,255,230,1)');
            r.addColorStop(0.45, 'rgba(255,190,80,0.9)');
            r.addColorStop(1, 'rgba(255,90,20,0)');
            g.fillStyle = r; g.fillRect(0, 0, 9, 9);
            return c;
        })()];
        const units = [];

        for (const side of sides) {
            const n = 5 + ((Math.random() * 3) | 0);
            for (let i = 0; i < n; i++) {
                const kind = side.kinds[(Math.random() * side.kinds.length) | 0];
                const T = GW_TYPES[kind];
                const flip = side.dir === 1 && kind !== 'infantryR';
                const [move, die, shoot, idle] = await Promise.all(
                    [T.move, T.die, T.shoot, T.idle].map((k) => gwFrames(k, side.tint)));
                if (!shoot.length || !idle.length) continue;
                // Evenly spaced slots across the army's ground, with a
                // little jitter, alternating near and far so they do not
                // stand on each other.
                const depth = ((i % 2) ? 0.55 : 0) + Math.random() * 0.45;
                const footY = 0.70 + depth * 0.22;
                const scale = (T.size === 'tank' ? 1.5 : 1.55) + depth * 0.7;
                const nw = shoot[0].width, nh = shoot[0].height;
                const w = nw * scale, h = nh * scale;
                const slot = (i + 0.5) / n + (Math.random() - 0.5) * (0.5 / n);
                const cx = (side.xs[0] + slot * (side.xs[1] - side.xs[0])) * BASE_W;
                const rect = { x: (cx - w / 2) / BASE_W, y: (footY * BASE_H - h) / BASE_H,
                    w: w / BASE_W, h: h / BASE_H };
                // Run in from the army's own edge, then hold and fire.
                const t0 = Math.random() * 1.6;
                const runFor = (T.size === 'tank' ? 2.4 : 1.6) + Math.random() * 0.6;
                const from = side.dir === 1 ? -(cx + w) : (BASE_W - cx + w);
                const dies = Math.random() < 0.4;
                const deathAt = dies ? seconds * (0.4 + Math.random() * 0.45) : Infinity;
                const frames = [];
                const shots = [];
                const moveSeq = move.length ? move : idle;
                while (frames.length < (t0 + runFor) * GW_FPS) {
                    frames.push(moveSeq[frames.length % moveSeq.length]);
                }
                while (frames.length < total && frames.length / GW_FPS < deathAt) {
                    const wait = 2 + ((Math.random() * 9) | 0);
                    for (let k = 0; k < wait; k++) frames.push(idle[0]);
                    shots.push((frames.length + T.flash) / GW_FPS);
                    frames.push(...shoot);
                }
                if (dies && die.length) {
                    frames.length = Math.min(frames.length, Math.round(deathAt * GW_FPS));
                    frames.push(...die);
                }
                const unit = {
                    side, rect, flip, deathAt: dies ? deathAt + die.length / GW_FPS * 0.5 : Infinity,
                    shots: shots.filter((t) => t < deathAt),
                    layer: {
                        entry: null, frames, fps: GW_FPS, motion: 'advance',
                        params: { t0, dur: runFor, from }, blend: 'source-over', alpha: 1,
                        fit: 'native', rect, offset: 0, flip, depth,
                    },
                };
                units.push(unit);
            }
        }
        // Nearer units are drawn over further ones.
        units.sort((a, b) => a.layer.depth - b.layer.depth);
        units.forEach((u) => layers.push(u.layer));

        // Tracer fire. Each shot leaves the shooter's muzzle and lands on an
        // enemy that is still standing when it arrives; a spark marks the hit.
        for (const u of units) {
            const foes = units.filter((v) => v.side !== u.side);
            for (const ts of u.shots) {
                const flight = 0.35 + Math.random() * 0.25;
                const alive = foes.filter((v) => v.deathAt > ts + flight);
                if (!alive.length) continue;
                const v = alive[(Math.random() * alive.length) | 0];
                const mx = (u.side.dir === 1 ? u.rect.x + u.rect.w * 0.95 : u.rect.x + u.rect.w * 0.05) * BASE_W;
                const my = (u.rect.y + u.rect.h * 0.4) * BASE_H;
                const tx = (v.rect.x + v.rect.w * 0.5) * BASE_W;
                const ty = (v.rect.y + v.rect.h * 0.45) * BASE_H;
                layers.push({
                    entry: null, frames: [u.side.bolt], fps: 0, motion: 'shot',
                    params: { t0: ts, dur: flight, dx: tx - mx, dy: ty - my },
                    blend: 'lighter', alpha: 1, fit: 'native',
                    rect: { x: mx / BASE_W, y: my / BASE_H, w: 7 / BASE_W, h: 2 / BASE_H },
                    offset: 0, in: ts, out: ts + flight,
                });
                if (spark.length) {
                    layers.push({
                        entry: null, frames: spark, fps: 0, motion: 'still', params: {},
                        blend: 'lighter', alpha: 1, fit: 'native',
                        rect: { x: (tx - 4) / BASE_W, y: (ty - 4) / BASE_H, w: 9 / BASE_W, h: 8 / BASE_H },
                        offset: 0, in: ts + flight, out: ts + flight + 0.18,
                    });
                }
            }
        }
        return { label: 'GROUND ASSAULT', layers: layers.filter(Boolean), duration: seconds * 1000 };
    }

    const RECIPES = {
        async convoy() {
            // MoO1's SHIPS/SHIPS2 supply the freighter hulls the recipe
            // was written against; MoO2's CMBTSHP supplies combat hulls
            // and CMBTMISL supplies missile-shaped contrails for the
            // same beat. All four live behind one query because MoO2
            // entries carry the plain `dir` name.
            const bg = pick(backdrops({
                dirs: ['LANDING'], roles: ['fullscreen'], minLum: 26, minCoverage: 0.5,
            })) || pick(backdrops({ minLum: 20 })) || pick(backdrops());
            const wash = pick(find({ dirs: ['NEBULA'] }));
            const hulls = pickMany(
                find({
                    dirs: ['SHIPS', 'SHIPS2', 'CMBTSHP'],
                    roles: ['sprite'],
                    minW: 24, maxNoise: 110,
                }), 4);
            const layers = [await makeLayer(bg, { fit: 'cover', fps: bg && bg.frames > 1 ? 10 : 0 })];
            layers.push(await makeLayer(wash, {
                fit: 'cover', blend: 'lighter', alpha: 0.22,
                motion: 'drift', params: { sx: 0.12, sy: 0.09, ax: 26, ay: 10 },
            }));
            for (let i = 0; i < hulls.length; i++) {
                const depth = i / Math.max(1, hulls.length - 1);
                layers.push(await makeLayer(hulls[i], {
                    fit: 'native', scale: 1.4 + depth * 2.6,
                    motion: 'cross',
                    params: {
                        speed: 0.04 + depth * 0.055, span: 520,
                        dy: -58 + i * 30, wobble: 2 + depth * 3,
                    },
                    fps: 12, offset: i * 0.55, flip: i % 2 === 1,
                    alpha: 0.7 + depth * 0.3,
                }));
            }
            return { label: 'CONVOY TRANSIT', layers: layers.filter(Boolean), duration: 9000 };
        },

        async tactical() {
            // MoO2 STARBG and GSTAR are star-field plates that read as a
            // combat backdrop the way MoO1's STARVIEW does. The target
            // comes from either game's ship archives, plus CMBTFGTR for
            // the fighter cels MoO1 does not have a clean source for.
            // No STARBG: every STARBG item is a cut-out nebula about 190 px
            // wide (coverage ~0.5), which blown up to fill the frame is a
            // soft blob. Owner saw it constantly and it looked bad.
            const bg = pick(find({
                dirs: ['STARVIEW', 'SPACE', 'GSTAR'],
                minW: 200, maxNoise: 140,
            })) || pick(backdrops());
            const target = pick(find({
                dirs: ['SHIPS', 'CMBTSHP', 'CMBTFGTR'],
                roles: ['sprite'], minW: 24,
                maxCoverage: 0.85, maxNoise: 110,
            }));
            const layers = [await makeLayer(bg, { fit: 'cover', alpha: 0.9 })];
            layers.push(await makeLayer(target, {
                fit: 'native', scale: 2.6, motion: 'drift',
                params: { sx: 0.6, sy: 0.9, ax: 46, ay: 18 }, fps: 12,
            }));
            return { label: 'TACTICAL PLOT', layers: layers.filter(Boolean), duration: 8000 };
        },

        async survey() {
            // STARBG is MoO2's own equivalent of STARVIEW; GSTAR is the
            // strategic star field. Both are picked as the establishing
            // world shot when an MoO1 star field is not available.
            const world = pick(find({
                dirs: ['STARVIEW', 'GSTAR'],
                roles: ['fullscreen'], minCoverage: 0.25, maxNoise: 140,
            }))
                || pick(find({ dirs: ['PLANETS'], minW: 30 }));
            const wash = pick(find({ dirs: ['NEBULA'] }));
            // CMBTMISL for the probe: MoO2 draws its survey probes with
            // the same sprite grammar as its missiles and they read as
            // small moving objects the same way.
            const probe = pick(find({
                dirs: ['SHIPS2', 'CMBTMISL'],
                roles: ['sprite'], minW: 18, maxNoise: 110,
            }));
            const bar = pick(find({
                pool: 'sprite', dirs: ['SPACE'], roles: ['strip'],
            }).filter((e) => e.w >= e.h * 4 && e.w >= 28));
            return {
                label: 'ORBITAL SURVEY',
                duration: 9000,
                layers: [
                    await makeLayer(world, { fit: 'cover', alpha: 1 }),
                    await makeLayer(wash, { fit: 'cover', blend: 'lighter', alpha: 0.45, motion: 'drift', params: { sx: 0.22, sy: 0.17, ax: 22, ay: 12 } }),
                    await makeLayer(probe, {
                        fit: 'native', scale: 2.4, motion: 'orbit',
                        params: { speed: 0.11, rx: 96, ry: 58 }, fps: 10,
                    }),
                    await makeLayer(bar, { fit: 'stretch', alpha: 0.35, blend: 'lighter', motion: 'scanline', params: { speed: 0.28, h: 20, a: 0.35 } }),
                ].filter(Boolean),
            };
        },

        async council() {
            // MoO2's COUNCIL archive holds the actual council-chamber
            // plates; DIPLOMAT and DIPSTARS are the diplomacy screen
            // and star map from the same game. All three read as the
            // hall and the starfield behind a vote. Note that MoO1's
            // COUNCIL archive is entirely denied — its items decode
            // against a palette the archive does not carry — so on the
            // MoO2 side, COUNCIL items are the only council footage
            // available and the query finds them because MoO2 entries
            // carry `dir: 'COUNCIL'` under a `_moo2`-suffixed key.
            const hall = pick(backdrops({
                dirs: ['EMBASSY', 'INTRO', 'LANDING',
                    'COUNCIL', 'DIPLOMAT', 'DIPSTARS'],
                roles: ['fullscreen'],
                minCoverage: 0.3,
            })) || pick(backdrops());
            const layers = [await makeLayer(hall, { fit: 'cover', fps: 8 })];
            return { label: 'COUNCIL FLOOR', layers: layers.filter(Boolean), duration: 8500 };
        },

        /**
         * Diplomatic interview. Delegates to composeInterview() — the
         * function the tuner also calls — with no overrides, so the
         * recipe and the tuner share one code path. Tune constants in
         * INTERVIEW_DEFAULTS at the top of the module.
         *
         * EMBASSY is MoO1 only; MoO2's diplomacy screen is a menu, not
         * a composited three-plate scene, and there is no equivalent to
         * draw from on that side.
         */
        async interview() {
            return composeInterview();
        },

        async industry() {
            // MoO2's BLDG0..4 archives are the colony building cels —
            // one per building tier — and COLROADS is the road/path
            // overlay that sits under them. BEAMS is standalone beam
            // art that reads as industrial lighting in a factory shot.
            // These join MoO1's LANDING and BACKGRND as the establishing
            // shot, and MoO1's TECHNO as the panel.
            const bg = pick(find({
                pool: 'broll',
                dirs: ['LANDING', 'BACKGRND',
                    'BLDG0', 'BLDG1', 'BLDG2', 'BLDG3', 'BLDG4',
                    'COLROADS'],
                roles: ['fullscreen'],
                maxNoise: CLEAN_BACKDROP, minLum: 18,
            })) || pick(backdrops({ minLum: 12 })) || pick(backdrops());
            // The "machines" — BEAMS and BLDG cels added with `lighter`
            // blending and pulsing — are gone. Over a landscape they read
            // as yellow and blue blotches, not machinery (owner, from a
            // screenshot). The establishing shot stands on its own.
            const layers = [await makeLayer(bg, { fit: 'cover', alpha: 0.95 })];
            return { label: 'INDUSTRIAL FLOOR', layers: layers.filter(Boolean), duration: 8000 };
        },

        async anomaly() {
            // GSTAR and EVENTS are MoO2's star-field and event-cel
            // archives; they read as a black-hole or wormhole wash the
            // same way MoO1's VORTEX and INTRO plates do. CMBTSHP and
            // CMBTSFX join the debris field alongside MoO1 ships.
            const core = pick(find({
                dir: 'VORTEX', roles: ['fullscreen'], animated: true, maxNoise: CLEAN_BACKDROP,
            })) || pick(find({
                dirs: ['INTRO', 'INTRO2', 'GSTAR', 'EVENTS'],
                roles: ['fullscreen'], maxNoise: CLEAN_BACKDROP,
            }));
            const debris = pickMany(find({
                dirs: ['SHIPS', 'SHIPS2', 'CMBTSHP', 'CMBTSFX'],
                roles: ['sprite'], minW: 20, maxNoise: 110,
            }), 3);
            const layers = [await makeLayer(core, { fit: 'cover', fps: 14 })];
            for (let i = 0; i < debris.length; i++) {
                layers.push(await makeLayer(debris[i], {
                    fit: 'native', motion: 'approach',
                    params: { speed: 0.14 + i * 0.05, dx: (i - 1) * 120, dy: (i - 1) * 60, from: 1.8, to: 0.1 },
                    fps: 12, offset: i * 0.9, alpha: 0.9,
                }));
            }
            return { label: 'GRAVITIC ANOMALY', layers: layers.filter(Boolean), duration: 9000 };
        },

        // Lore stories and the recruitment spot only — see cutscene-manager
        // routeFor(). Excluded from random recipe picks (LORE_ONLY).
        async groundwar() { return groundWarScene(); },

        async deepfield() {
            // STARBG and GSTAR join the nebula washes; BEAMS provides
            // the faint high-contrast streaks that read as distant
            // emission lines in the same layer.
            const washes = pickMany(find({
                pool: 'sprite',
                dirs: ['NEBULA', 'SPACE', 'GSTAR'],
                minW: 20, minH: 20, maxNoise: 110,
            }), 3);
            const star = pick(find({
                pool: 'broll',
                dirs: ['STARVIEW', 'GSTAR'],
                roles: ['fullscreen'],
                maxNoise: 140, minCoverage: 0.2,
            }));
            const layers = [await makeLayer(star, { fit: 'cover', alpha: 0.8 })];
            for (let i = 0; i < washes.length; i++) {
                layers.push(await makeLayer(washes[i], {
                    fit: 'cover', blend: 'lighter', alpha: 0.3 + i * 0.1,
                    motion: 'drift', params: { sx: 0.1 + i * 0.05, sy: 0.08 + i * 0.04, ax: 30, ay: 18 },
                }));
            }
            return { label: 'DEEP FIELD', layers: layers.filter(Boolean), duration: 10000 };
        },
    };

    // Recipes a random pick must never land on. The ground war shows
    // soldiers dying; it illustrates in-universe stories, never real ones.
    const LORE_ONLY = new Set(['groundwar']);
    const RECIPE_NAMES = Object.keys(RECIPES).filter((k) => !LORE_ONLY.has(k));

    async function synthesize(kind) {
        if (kind && !RECIPES[kind]) {
            console.warn('[scene-compositor] no recipe named',
                JSON.stringify(kind), '— refusing to substitute');
            return null;
        }
        const name = kind || RECIPE_NAMES[(Math.random() * RECIPE_NAMES.length) | 0];
        try {
            const scene = await RECIPES[name]();
            scene.kind = name;
            if (!scene.layers.length) return null;
            return scene;
        } catch (err) {
            console.warn('[GNN Scene] recipe failed:', name, err);
            return null;
        }
    }

    async function single(entry, opts = {}) {
        const layer = await makeLayer(entry, Object.assign({
            fit: 'cover', fps: entry && entry.frames > 1 ? 12 : 0,
        }, opts));
        if (!layer) return null;
        return {
            kind: 'single', label: opts.label || '',
            layers: [layer], duration: opts.duration || 4000,
            generated: !!(entry && entry.img),
        };
    }

    return {
        BASE_W, BASE_H,
        synthesize, single, makeLayer, draw,
        groundWar: (seconds) => groundWarScene(seconds),
        composeInterview,
        INTERVIEW_DEFAULTS,
        recipes: () => RECIPE_NAMES.slice(),
        backdrops, sprites,
        isDenied, setDenied, getDenyList,
        clearDynamicDeny, importDynamicDeny,
    };
})();