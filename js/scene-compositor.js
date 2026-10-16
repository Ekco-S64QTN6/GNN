/* ============================================================
   GNN — Scene Compositor
   ------------------------------------------------------------
   Builds *new* footage out of old parts.

   A scene is a plain object: { layers[], duration, label }.
   Layers carry their own frames, motion model and blend mode.

   ------------------------------------------------------------
   Recent changes:

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
console.log('[scene-compositor] v12 — interview defaults tuned');
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

            const idx = layer.fps
                ? (Math.floor((t + layer.offset) * layer.fps) % layer.frames.length)
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

    const SPRITE_DIRS = ['SHIPS', 'SHIPS2', 'MISSILE', 'NEBULA', 'PLANETS', 'SPACE', 'VORTEX'];

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

    const RECIPES = {
        async convoy() {
            const bg = pick(backdrops({
                dirs: ['LANDING'], roles: ['fullscreen'], minLum: 26, minCoverage: 0.5,
            })) || pick(backdrops({ minLum: 20 })) || pick(backdrops());
            const wash = pick(find({ dirs: ['NEBULA'] }));
            const hulls = pickMany(
                find({
                    dirs: ['SHIPS', 'SHIPS2'], roles: ['sprite'],
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
            const bg = pick(find({
                dirs: ['STARVIEW', 'SPACE'], minW: 200, maxNoise: 140,
            })) || pick(backdrops());
            const target = pick(find({
                dirs: ['SHIPS'], roles: ['sprite'], minW: 24,
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
            const world = pick(find({
                dirs: ['STARVIEW'], roles: ['fullscreen'], minCoverage: 0.25, maxNoise: 140,
            }))
                || pick(find({ dirs: ['PLANETS'], minW: 30 }));
            const wash = pick(find({ dirs: ['NEBULA'] }));
            const probe = pick(find({
                dirs: ['SHIPS2'], roles: ['sprite'], minW: 18, maxNoise: 110,
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
            const hall = pick(backdrops({
                dirs: ['EMBASSY', 'INTRO', 'LANDING'], roles: ['fullscreen'],
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
         */
        async interview() {
            return composeInterview();
        },

        async industry() {
            const bg = pick(find({
                pool: 'broll',
                dirs: ['LANDING', 'BACKGRND'],
                roles: ['fullscreen'],
                maxNoise: CLEAN_BACKDROP, minLum: 18,
            })) || pick(backdrops({ minLum: 12 })) || pick(backdrops());
            const machines = pickMany(find({
                dirs: ['TECHNO'], roles: ['panel'], maxNoise: CLEAN_PLATE,
                minW: 40, maxCoverage: 0.7,
            }), 2);
            const layers = [await makeLayer(bg, { fit: 'cover', alpha: 0.85 })];
            for (let i = 0; i < machines.length; i++) {
                layers.push(await makeLayer(machines[i], {
                    rect: { x: 0.52 + i * 0.2, y: 0.12 + i * 0.3, w: 0.3, h: 0.34 },
                    alpha: 0.8, blend: 'lighter',
                    motion: 'pulse', params: { min: 0.4, max: 0.85, speed: 0.5 + i * 0.2 },
                }));
            }
            return { label: 'INDUSTRIAL FLOOR', layers: layers.filter(Boolean), duration: 8000 };
        },

        async anomaly() {
            const core = pick(find({
                dir: 'VORTEX', roles: ['fullscreen'], animated: true, maxNoise: CLEAN_BACKDROP,
            })) || pick(find({
                dirs: ['INTRO', 'INTRO2'], roles: ['fullscreen'], maxNoise: CLEAN_BACKDROP,
            }));
            const debris = pickMany(find({
                dirs: ['SHIPS', 'SHIPS2'], roles: ['sprite'], minW: 20, maxNoise: 110,
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

        async deepfield() {
            const washes = pickMany(find({
                pool: 'sprite',
                dirs: ['NEBULA', 'SPACE'],
                minW: 20, minH: 20, maxNoise: 110,
            }), 3);
            const star = pick(find({
                pool: 'broll',
                dirs: ['STARVIEW'], roles: ['fullscreen'],
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

    const RECIPE_NAMES = Object.keys(RECIPES);

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
        composeInterview,
        INTERVIEW_DEFAULTS,
        recipes: () => RECIPE_NAMES.slice(),
        backdrops, sprites,
        isDenied, setDenied, getDenyList,
        clearDynamicDeny, importDynamicDeny,
    };
})();