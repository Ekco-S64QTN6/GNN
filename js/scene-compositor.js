/* ============================================================
   GNN — Scene Compositor
   ------------------------------------------------------------
   Builds *new* footage out of old parts.

   Master of Orion never shipped a shot of a freighter convoy
   crossing a colony skyline at dusk, but it shipped the skyline
   (LANDING), the freighter (SHIPS2), the nebula wash (NEBULA)
   and the tactical readout chrome (STARMAP). This module layers
   them on a 320x200 offscreen buffer with per-layer motion, so
   the 145 sprite sheets and 71 chrome plates that were written
   off as "tiny tactical icons" become the moving parts of
   original B-roll.

   A scene is a plain object: { layers[], duration, label }.
   Layers carry their own frames, motion model and blend mode.

   ------------------------------------------------------------
   Recent fixes:

     synthesize()   A named recipe that does not exist now returns
                    null instead of falling through to a random
                    recipe. Deleting `cyber` from RECIPES while
                    `cutscene-manager.js` still routed a hack story
                    to it meant every hack cutaway was actually some
                    other recipe, chosen at random. A missing recipe
                    is "no cutaway", not "any cutaway".

     find/pick      Every query in this file goes through a local
                    wrapper that refuses items whose manifest
                    metadata is missing. `GNNAssets.find()` tests
                    `e.coverage > q.maxCoverage`; when `e.coverage`
                    is `undefined`, that comparison is `false` and
                    the item passes every ceiling it was meant to
                    be filtered by.

     industry       The foreground plate is gone entirely. It was
                    a COLONIES cut-out, and every item in COLONIES
                    decodes against a palette the art was not
                    authored against — a purple landmass over a
                    speckled field with a banded bottom edge. The
                    manifest scores the two cleanest items at
                    coverage 0.52 / noise 19-20, which is exactly
                    what a clean cut-out is supposed to score, so
                    no threshold separates them from real art. The
                    exclusion list that used to block all 28 items
                    is also gone: with nothing querying the archive
                    it was dead code, and a recipe that never draws
                    a broken asset cannot regress into drawing one.
                    See the note above `industry()`.

   Extractor faults — delta-frame stacking, chromatic scrambling
   on items below the noise thresholds — are not fixed here. See
   docs/scene-review/README.md.
   ============================================================ */
console.log('[scene-compositor] v5 — industry plate removed');
const GNNSceneCompositor = (() => {
    'use strict';

    const BASE_W = 320;
    const BASE_H = 200;

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
    // Strict queries
    // ---------------------------------------------------------
    //
    // `GNNAssets.find()` runs a chain of `e.field > q.maxField` tests.
    // An item whose manifest has no `coverage` or no `noise` reads as
    // `undefined > 0.6`, which is false, so the item passes a ceiling
    // that was meant to exclude it.
    //
    // The fix belongs in `asset-registry.js` — a max filter that an
    // item cannot answer should not be satisfied by default. Rather
    // than depend on that landing, every query in this file goes
    // through a wrapper that requires a real number for every numeric
    // field the query constrained. It is cheap and it makes the
    // compositor correct on its own.
    //
    // Booleans (`animated`) do not need this. The registry compares
    // them with `!==`, so `undefined !== false` is `true` and the
    // item is filtered out, which is what we want.
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
        if (!needed.length) return results;
        return results.filter((e) => {
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

    /**
     * Render a scene into the shared 320x200 buffer.
     * @param {Object} scene  produced by build()/synthesize()
     * @param {number} elapsed  ms since the scene started
     * @returns {HTMLCanvasElement}
     */
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

    const BACKDROP_DIRS = ['LANDING', 'INTRO', 'INTRO2', 'STARVIEW', 'SPIES', 'COUNCIL', 'EMBASSY'];
    const SPRITE_DIRS = ['SHIPS', 'SHIPS2', 'MISSILE', 'NEBULA', 'PLANETS', 'SPACE', 'VORTEX'];

    // A few dozen items in the library were authored against screen palettes
    // the archives never shipped; they decode structurally correct but
    // chromatically scrambled, and the manifest scores that as horizontal
    // chroma noise. Keep them out of ordinary footage — the glitch engine is
    // where they earn their keep.
    const CLEAN_BACKDROP = 95;
    const CLEAN_PLATE = 95;
    // Anything smaller than this is a button, not a readout.
    const PLATE_MIN_W = 24;
    const PLATE_MIN_H = 16;

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

    /**
     * Blueprint schematics, in place of the old chrome plates.
     *
     * The chrome pool is the game's own interface: window frames, button
     * panels, the population and tactical readouts. Pinned over footage as
     * "screen dressing" they are unmistakably gameplay HUD — a shot of a
     * convoy with POP and Moving and a tactical plot bar stuck to it reads
     * as a strategy game, not as a news feed.
     *
     * TECHNO carries wireframe schematics on a grid instead: hulls, drives,
     * sensors, drawn as line art. Those are what a newsroom would put on a
     * screen behind a reporter, and they come from the sprite pool, which
     * is admitted art rather than interface.
     */
    function schematics(extra) {
        return find(Object.assign({
            pool: 'sprite', dirs: ['TECHNO'],
            minW: PLATE_MIN_W, minH: PLATE_MIN_H,
        }, extra || {}));
    }

    const RECIPES = {
        /** Convoy crossing a planetary skyline. */
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
            // Near hulls are big and fast, far hulls small and slow: the depth
            // cue is what turns four 32x24 tactical icons into a convoy.
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

        /** Tactical readout: a starfield with a drifting hull. */
        async tactical() {
            const bg = pick(find({
                dirs: ['STARVIEW', 'SPACE'], minW: 200, maxNoise: 140,
            })) || pick(backdrops());
            // No overlay plates. The chrome ones were the game's own
            // interface; the TECHNO schematics that replaced them are only
            // 21% transparent with a mean luminance of 38, so pasted over a
            // scene they are muddy dark slabs with visible edges. A
            // starfield and a drifting hull carry the shot on their own.
            const plates = [];
            const target = pick(find({
                dirs: ['SHIPS'], roles: ['sprite'], minW: 24,
                // A near-solid item would fill the sprite slot and read as a
                // slab rather than as a hull. Sprites in this pool are well
                // under 0.6 by construction; the guard is a safety net.
                maxCoverage: 0.85, maxNoise: 110,
            }));
            const layers = [await makeLayer(bg, { fit: 'cover', alpha: 0.9 })];
            layers.push(await makeLayer(target, {
                fit: 'native', scale: 2.6, motion: 'drift',
                params: { sx: 0.6, sy: 0.9, ax: 46, ay: 18 }, fps: 12,
            }));
            // Three, in the corners the captions do not use. Five of them
            // pinned to every edge was the thing that read as a game HUD
            // however good the individual plate was.
            const spots = [
                { x: 0.04, y: 0.08 }, { x: 0.70, y: 0.08 }, { x: 0.70, y: 0.66 },
            ];
            const PLATE_W = 0.31, PLATE_H = 0.24;
            for (let i = 0; i < Math.min(plates.length, spots.length); i++) {
                layers.push(await makeLayer(plates[i], {
                    rect: {
                        x: spots[i].x, y: spots[i].y,
                        w: Math.min(PLATE_W, (plates[i].w * 2.2) / BASE_W),
                        h: Math.min(PLATE_H, (plates[i].h * 2.2) / BASE_H),
                    },
                    alpha: 0.85, motion: 'pulse',
                    params: { min: 0.55, max: 1, speed: 0.4 + i * 0.13 },
                }));
            }
            return { label: 'TACTICAL PLOT', layers: layers.filter(Boolean), duration: 8000 };
        },

        /** Orbital survey: planet body + drifting nebula wash + scan bar. */
        async survey() {
            const world = pick(find({
                dirs: ['STARVIEW'], roles: ['fullscreen'], minCoverage: 0.25, maxNoise: 140,
            }))
                || pick(find({ dirs: ['PLANETS'], minW: 30 }));
            const wash = pick(find({ dirs: ['NEBULA'] }));
            const probe = pick(find({
                dirs: ['SHIPS2'], roles: ['sprite'], minW: 18, maxNoise: 110,
            }));
            // The sweep bar must be a genuinely wide strip; stretching a
            // narrow plate across the frame reads as vertical banding, not a
            // scan line.
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

        /** Council floor — establishing shot of an interior. */
        async council() {
            // The portrait pool for EMBASSY produces framed ornamental
            // race cards, not cut-in figures — they read as propaganda
            // posters nailed to the wall, not delegates on camera.
            // Delegate cut-ins removed; the backdrop alone reads as an
            // establishing shot of a council chamber.
            const hall = pick(backdrops({
                dirs: ['EMBASSY', 'INTRO', 'LANDING'], roles: ['fullscreen'],
                minCoverage: 0.3,
            })) || pick(backdrops());
            const layers = [await makeLayer(hall, { fit: 'cover', fps: 8 })];
            return { label: 'COUNCIL FLOOR', layers: layers.filter(Boolean), duration: 8500 };
        },

        /** Interview two-shot: an agent portrait against an interior. */
        async interview() {
            // maxNoise tightened 150 → 120. The Mrrshan Stealth Optics plate
            // is scored above 120, and at 150 it was being admitted as a
            // live interview subject with a scrambled red texture where a
            // face should be.
            const subject = pick(find({
                dir: 'SPIES', roles: ['fullscreen'], maxNoise: 120,
            }));
            const room = pick(find({
                dirs: ['BACKGRND', 'EMBASSY'], roles: ['fullscreen', 'panel'],
                minCoverage: 0.4, maxNoise: CLEAN_BACKDROP,
            }));
            return {
                label: 'LIVE INTERVIEW',
                duration: 8000,
                layers: [
                    await makeLayer(room, { fit: 'cover', alpha: 0.7 }),
                    await makeLayer(subject, { fit: 'contain', fps: 10, motion: 'drift', params: { sx: 0.3, sy: 0.4, ax: 2, ay: 1 } }),
                ].filter(Boolean),
            };
        },

        /**
         * Industrial floor: a background skyline and, if they can be
         * found, two machinery panels.
         *
         * There is no foreground plate. There used to be one — a COLONIES
         * cut-out in the lower-left, meant to be a colony building or a
         * refinery stack in the near field. It cannot be drawn from the
         * current archive.
         *
         * Every item in COLONIES decodes against `WINLOSE[0] base`, which
         * is not the palette this art was authored against. The result is
         * a purple landmass silhouette over a speckled field with a banded
         * bottom edge — a legible shape, but on the wrong palette, and it
         * reads as noise rather than as architecture.
         *
         * The manifest does not catch it. The two cleanest items score at
         * coverage 0.52 / noise 19-20, which is exactly what a clean
         * cut-out is supposed to score. Those numbers are not wrong — the
         * alpha channel really is 0.52 covered, the horizontal chroma
         * noise really is 19 — they are just measuring a plate whose
         * colours are scrambled, which is a fault neither field is
         * designed to detect. No threshold separates the scrambled items
         * from real art.
         *
         * So the recipe does not query the archive. An earlier version
         * excluded all 28 items by id; the query then returned nothing,
         * the layer was dropped, and the exclusion list was dead weight
         * that could be forgotten or bypassed. Removing the query and the
         * layer entirely means there is no code path that can put a
         * COLONIES item on air, whatever state the manifest is in.
         *
         * When the extractor is fixed and the archive re-scored, this
         * recipe can grow a foreground back — from a regenerated plate in
         * `assets/generated/cutaways/`, not from COLONIES. See
         * `docs/scene-review/README.md` for the underlying fault.
         */
        async industry() {
            const bg = pick(find({
                dirs: ['LANDING', 'BACKGRND'], roles: ['fullscreen'],
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

        /** Anomaly: vortex core with sprite debris pulled inward. */
        async anomaly() {
            const core = pick(find({
                dir: 'VORTEX', roles: ['fullscreen'], animated: true, maxNoise: CLEAN_BACKDROP,
            })) || pick(find({
                dirs: ['INTRO', 'INTRO2'], roles: ['fullscreen'], maxNoise: CLEAN_BACKDROP,
            }));
            // maxNoise tightened 140 → 110. The debris is meant to read as
            // fragments of a hull being pulled in, and anything above 110 is
            // chroma noise masquerading as a silhouette.
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

        // `cyber` recipe deleted — rack was always [] so the recipe produced
        // a single SPIES fullscreen portrait with no overlays, which is
        // identical to `interview` but without the room backdrop.
        //
        // `synthesize()` below refuses a name that is not in this object, so
        // a caller still routing to `cyber` gets "no cutaway" rather than a
        // random recipe. That is what the docs promised when the recipe was
        // removed; the previous fallback silently substituted, which is how
        // a hack story came back as some other recipe's picture.

        /** Deep field: nebula stack, no hard subject — pure atmosphere. */
        async deepfield() {
            const washes = pickMany(find({
                dirs: ['NEBULA', 'SPACE'], minW: 20, maxNoise: 110,
            }), 3);
            const star = pick(find({
                dirs: ['STARVIEW'], roles: ['fullscreen'], maxNoise: 140, minCoverage: 0.2,
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

    /**
     * Build a scene by recipe name, or a random one.
     *
     * A *named* recipe that is not in `RECIPES` returns null rather than
     * silently substituting a random one. The old behaviour was the
     * fallback below, applied unconditionally:
     *
     *     const name = RECIPES[kind] ? kind : RECIPE_NAMES[random];
     *
     * When `cyber` was deleted from `RECIPES` and `cutscene-manager.js`
     * still routed hack keywords to it, `synthesize('cyber')` returned a
     * random recipe every time. Callers get "no cutaway" now, which is
     * what the docs promised for a deleted recipe.
     *
     * `undefined` / `''` still means "I don't have a route, give me
     * anything", which is the intended behaviour for a story that matched
     * no keyword in `cutscene-manager.js`'s ROUTES.
     */
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

    /** A single asset shown full-bleed — used for commercial hero shots. */
    async function single(entry, opts = {}) {
        const layer = await makeLayer(entry, Object.assign({
            fit: 'cover', fps: entry && entry.frames > 1 ? 12 : 0,
        }, opts));
        if (!layer) return null;
        return {
            kind: 'single', label: opts.label || '',
            layers: [layer], duration: opts.duration || 4000,
        };
    }

    return {
        BASE_W, BASE_H,
        synthesize, single, makeLayer, draw,
        recipes: () => RECIPE_NAMES.slice(),
        backdrops, sprites, schematics,
    };
})();