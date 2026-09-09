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
   ============================================================ */

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
    const CHROME_DIRS = ['STARMAP', 'SCREENS', 'DESIGN', 'BACKGRND', 'SPACE'];

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
        return GNNAssets.find(Object.assign({
            dirs: BACKDROP_DIRS, roles: ['fullscreen', 'panel'],
            minW: 140, minH: 90, minCoverage: 0.2, minLum: 12,
            maxNoise: CLEAN_BACKDROP,
        }, extra || {}));
    }

    function sprites(extra) {
        return GNNAssets.find(Object.assign({
            dirs: SPRITE_DIRS, roles: ['sprite', 'panel'],
            minW: 16, maxW: 160, minCoverage: 0.05, maxNoise: 140,
        }, extra || {}));
    }

    function chrome(extra) {
        return GNNAssets.find(Object.assign({
            dirs: CHROME_DIRS, roles: ['chrome', 'panel', 'strip'],
            minW: PLATE_MIN_W, minH: PLATE_MIN_H, maxNoise: CLEAN_PLATE,
        }, extra || {}));
    }

    const RECIPES = {
        /** Convoy crossing a planetary skyline. */
        async convoy() {
            const bg = GNNAssets.pick(backdrops({
                dirs: ['LANDING'], roles: ['fullscreen'], minLum: 26, minCoverage: 0.5,
            })) || GNNAssets.pick(backdrops({ minLum: 20 })) || GNNAssets.pick(backdrops());
            const wash = GNNAssets.pick(GNNAssets.find({ dirs: ['NEBULA'] }));
            const hulls = GNNAssets.pickMany(
                GNNAssets.find({ dirs: ['SHIPS', 'SHIPS2'], roles: ['sprite'], minW: 24 }), 4);
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

        /** Tactical readout: chrome plates over a starfield with a moving target. */
        async tactical() {
            const bg = GNNAssets.pick(GNNAssets.find({
                dirs: ['STARVIEW', 'SPACE'], minW: 200, maxNoise: 140,
            })) || GNNAssets.pick(backdrops());
            const plates = GNNAssets.pickMany(chrome({ dirs: ['STARMAP', 'DESIGN'] }), 5);
            const target = GNNAssets.pick(GNNAssets.find({ dirs: ['SHIPS'], roles: ['sprite'], minW: 24 }));
            const layers = [await makeLayer(bg, { fit: 'cover', alpha: 0.9 })];
            layers.push(await makeLayer(target, {
                fit: 'native', scale: 2.6, motion: 'drift',
                params: { sx: 0.6, sy: 0.9, ax: 46, ay: 18 }, fps: 12,
            }));
            // Plates are pinned to the corners and scaled up so a 40x30
            // tactical readout reads as a HUD element rather than a speck.
            const spots = [
                { x: 0.02, y: 0.04 }, { x: 0.66, y: 0.04 }, { x: 0.02, y: 0.70 },
                { x: 0.66, y: 0.70 }, { x: 0.34, y: 0.86 },
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
            const world = GNNAssets.pick(GNNAssets.find({
                dirs: ['STARVIEW'], roles: ['fullscreen'], minCoverage: 0.25, maxNoise: 140,
            }))
                || GNNAssets.pick(GNNAssets.find({ dirs: ['PLANETS'], minW: 30 }));
            const wash = GNNAssets.pick(GNNAssets.find({ dirs: ['NEBULA'] }));
            const probe = GNNAssets.pick(GNNAssets.find({ dirs: ['SHIPS2'], roles: ['sprite'], minW: 18 }));
            // The sweep bar must be a genuinely wide strip; stretching a
            // narrow plate across the frame reads as vertical banding, not a
            // scan line.
            const bar = GNNAssets.pick(GNNAssets.find({
                dirs: ['SPACE', 'DESIGN'], roles: ['strip', 'chrome'],
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

        /** Council floor with delegate cut-ins. */
        async council() {
            const hall = GNNAssets.pick(GNNAssets.find({
                dir: 'COUNCIL', roles: ['fullscreen'], minCoverage: 0.3, maxNoise: CLEAN_BACKDROP,
            })) || GNNAssets.pick(GNNAssets.find({ dirs: ['INTRO', 'BACKGRND'], roles: ['fullscreen'], maxNoise: CLEAN_BACKDROP }));
            const delegates = GNNAssets.pickMany(GNNAssets.find({
                dir: 'COUNCIL', roles: ['portrait'], maxCoverage: 0.5, maxNoise: 150,
            }), 2);
            const layers = [await makeLayer(hall, { fit: 'cover', fps: 8 })];
            const at = [{ x: 0.02, y: 0.18 }, { x: 0.62, y: 0.18 }];
            for (let i = 0; i < delegates.length; i++) {
                layers.push(await makeLayer(delegates[i], {
                    rect: { x: at[i].x, y: at[i].y, w: 0.36, h: 0.72 },
                    fps: 8, alpha: 0.96, motion: 'drift',
                    params: { sx: 0.4 + i, sy: 0.3, ax: 2, ay: 2 },
                }));
            }
            return { label: 'COUNCIL FLOOR', layers: layers.filter(Boolean), duration: 8500 };
        },

        /** Interview two-shot: an agent portrait against an interior. */
        async interview() {
            const subject = GNNAssets.pick(GNNAssets.find({
                dir: 'SPIES', roles: ['fullscreen'], maxNoise: 150,
            }));
            const room = GNNAssets.pick(GNNAssets.find({
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

        /** Industrial floor: colony panels tiled behind machinery sprites. */
        async industry() {
            const plate = GNNAssets.pick(GNNAssets.find({ dirs: ['COLONIES'], minW: 40 }));
            const bg = GNNAssets.pick(GNNAssets.find({
                dirs: ['LANDING', 'BACKGRND'], roles: ['fullscreen'],
                maxNoise: CLEAN_BACKDROP, minLum: 18,
            }));
            const machines = GNNAssets.pickMany(GNNAssets.find({
                dirs: ['TECHNO'], roles: ['panel'], maxNoise: CLEAN_PLATE, minW: 40,
            }), 2);
            const layers = [await makeLayer(bg, { fit: 'cover', alpha: 0.85 })];
            layers.push(await makeLayer(plate, {
                rect: { x: 0.06, y: 0.42, w: 0.42, h: 0.5 }, alpha: 0.95,
                motion: 'drift', params: { sx: 0.2, sy: 0.25, ax: 4, ay: 2 },
            }));
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
            const core = GNNAssets.pick(GNNAssets.find({
                dir: 'VORTEX', roles: ['fullscreen'], animated: true, maxNoise: CLEAN_BACKDROP,
            })) || GNNAssets.pick(GNNAssets.find({
                dirs: ['INTRO', 'INTRO2'], roles: ['fullscreen'], maxNoise: CLEAN_BACKDROP,
            }));
            const debris = GNNAssets.pickMany(GNNAssets.find({
                dirs: ['SHIPS', 'SHIPS2'], roles: ['sprite'], minW: 20, maxNoise: 140,
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

        /** Data-centre / cyber: espionage plates behind scrolling chrome. */
        async cyber() {
            const room = GNNAssets.pick(GNNAssets.find({ dir: 'SPIES', roles: ['fullscreen'] }));
            const rack = GNNAssets.pickMany(GNNAssets.find({
                dirs: ['SCREENS', 'STARMAP', 'TECHNO'], roles: ['panel'],
                minW: 40, minH: 30, maxNoise: CLEAN_PLATE,
            }), 4);
            const layers = [await makeLayer(room, { fit: 'cover', fps: 10, alpha: 0.9 })];
            for (let i = 0; i < rack.length; i++) {
                layers.push(await makeLayer(rack[i], {
                    rect: { x: 0.05 + (i % 2) * 0.62, y: 0.1 + Math.floor(i / 2) * 0.5, w: 0.3, h: 0.34 },
                    alpha: 0.7, blend: 'lighter',
                    motion: 'pulse', params: { min: 0.25, max: 0.9, speed: 0.9 + i * 0.4 },
                }));
            }
            return { label: 'NETWORK INTRUSION', layers: layers.filter(Boolean), duration: 8000 };
        },

        /** Deep field: nebula stack, no hard subject — pure atmosphere. */
        async deepfield() {
            const washes = GNNAssets.pickMany(GNNAssets.find({ dirs: ['NEBULA', 'SPACE'], minW: 20 }), 3);
            const star = GNNAssets.pick(GNNAssets.find({
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

    /** Build a scene by recipe name, or a random one. */
    async function synthesize(kind) {
        const name = RECIPES[kind] ? kind : RECIPE_NAMES[(Math.random() * RECIPE_NAMES.length) | 0];
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
        backdrops, sprites, chrome,
    };
})();
