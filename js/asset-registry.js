/* ============================================================
   GNN — Asset Registry
   ------------------------------------------------------------
   Single source of truth for everything that came out of the
   Master of Orion 1 carcass. Loads the generated manifests
   (gfx / audio / strings) and answers questions like "give me a
   320x200 backdrop", "give me eleven hull sprites", "give me an
   alarm that lasts longer than a second".

   Nothing else in the codebase is allowed to hard-code an asset
   path; everything queries this module, which is what makes the
   full 873-item library reachable instead of the 9 items the
   old bumper rotation used.
   ============================================================ */

const GNNAssets = (() => {
    'use strict';

    const GFX_ROOT = 'assets/cutscenes';

    let gfx = {};            // dir -> [entry]
    let flat = [];           // every gfx entry
    let byId = new Map();
    let audio = { sfx: [], music: [], stings: [] };
    let strings = { bulletins: [], leaders: [], topics: [], vocab: {} };
    let ready = false;

    const imageCache = new Map();
    const pending = new Map();

    // ---------------------------------------------------------
    // Loading
    // ---------------------------------------------------------

    async function loadJson(url, fallback) {
        try {
            const r = await fetch(url);
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return await r.json();
        } catch (err) {
            console.warn('[GNN Assets] could not load', url, err.message);
            return fallback;
        }
    }

    async function init() {
        const [g, a, s] = await Promise.all([
            loadJson('assets/gfx-manifest.json', {}),
            loadJson('assets/audio-manifest.json', audio),
            loadJson('assets/moo-strings.json', strings),
        ]);
        gfx = g || {};
        audio = a || audio;
        strings = s || strings;

        flat = [];
        byId = new Map();
        for (const dir of Object.keys(gfx)) {
            for (const e of gfx[dir]) {
                e.aspect = e.w / Math.max(e.h, 1);
                e.area = e.w * e.h;
                e.animated = e.frames > 1;
                flat.push(e);
                byId.set(e.id, e);
            }
        }
        ready = true;
        console.log('[GNN Assets] %d graphics items, %d frames, %d sfx, %d music beds',
            flat.length, flat.reduce((n, e) => n + e.frames, 0),
            audio.sfx.length, audio.music.length);
        return true;
    }

    // ---------------------------------------------------------
    // Paths
    // ---------------------------------------------------------

    function framePath(entry, frameIndex) {
        const n = String(frameIndex % Math.max(entry.frames, 1)).padStart(3, '0');
        return `${GFX_ROOT}/${entry.dir}/item_${String(entry.item).padStart(2, '0')}_frame_${n}.png`;
    }

    function heroPath(entry) {
        return framePath(entry, entry.hero || 0);
    }

    // ---------------------------------------------------------
    // Image loading (deduplicated, cached, never rejects)
    // ---------------------------------------------------------

    function loadImage(src) {
        if (imageCache.has(src)) return Promise.resolve(imageCache.get(src));
        if (pending.has(src)) return pending.get(src);
        const p = new Promise((resolve) => {
            const img = new Image();
            img.onload = () => { imageCache.set(src, img); pending.delete(src); resolve(img); };
            img.onerror = () => { imageCache.set(src, null); pending.delete(src); resolve(null); };
            img.src = src;
        });
        pending.set(src, p);
        return p;
    }

    function cached(src) {
        return imageCache.get(src) || null;
    }

    /** Load up to `max` frames of an item; returns an array of images. */
    async function loadClip(entry, max = 48) {
        if (!entry) return [];
        const count = Math.min(entry.frames, max);
        const step = entry.frames > max ? entry.frames / max : 1;
        const out = [];
        for (let i = 0; i < count; i++) {
            const img = await loadImage(framePath(entry, Math.floor(i * step)));
            if (img) out.push(img);
        }
        return out;
    }

    // ---------------------------------------------------------
    // Queries
    // ---------------------------------------------------------

    /**
     * Filter the library.
     * @param {Object} q - { dir, dirs, role, roles, minW, minH, maxW, maxH,
     *                       animated, minFrames, maxNoise, minCoverage, exclude }
     */
    function find(q = {}) {
        const dirs = q.dirs || (q.dir ? [q.dir] : null);
        const roles = q.roles || (q.role ? [q.role] : null);
        const exclude = q.exclude ? new Set(q.exclude) : null;
        return flat.filter((e) => {
            if (dirs && dirs.indexOf(e.dir) < 0) return false;
            if (roles && roles.indexOf(e.role) < 0) return false;
            if (exclude && exclude.has(e.id)) return false;
            if (q.minW !== undefined && e.w < q.minW) return false;
            if (q.minH !== undefined && e.h < q.minH) return false;
            if (q.maxW !== undefined && e.w > q.maxW) return false;
            if (q.maxH !== undefined && e.h > q.maxH) return false;
            if (q.animated !== undefined && e.animated !== q.animated) return false;
            if (q.minFrames !== undefined && e.frames < q.minFrames) return false;
            if (q.maxNoise !== undefined && e.noise > q.maxNoise) return false;
            if (q.minCoverage !== undefined && e.coverage < q.minCoverage) return false;
            if (q.maxCoverage !== undefined && e.coverage > q.maxCoverage) return false;
            if (q.minLum !== undefined && e.lum < q.minLum) return false;
            return true;
        });
    }

    function get(id) { return byId.get(id) || null; }

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
    // Audio queries
    // ---------------------------------------------------------

    function sfxByRole(role) {
        return audio.sfx.filter((s) => s.role === role);
    }

    function pickSfx(roles, opts = {}) {
        const list = (Array.isArray(roles) ? roles : [roles]);
        let pool = audio.sfx.filter((s) => list.indexOf(s.role) >= 0);
        if (opts.minDur) pool = pool.filter((s) => s.dur >= opts.minDur);
        if (opts.maxDur) pool = pool.filter((s) => s.dur <= opts.maxDur);
        if (!pool.length) pool = audio.sfx;
        return pool.length ? pool[(Math.random() * pool.length) | 0] : null;
    }

    function sfxById(id) {
        return audio.sfx.find((s) => s.id === id)
            || audio.stings.find((s) => s.id === id) || null;
    }

    function musicTracks(filter) {
        const list = audio.music.filter((m) => m.file);
        return filter ? list.filter(filter) : list;
    }

    // ---------------------------------------------------------
    // Text corpus
    // ---------------------------------------------------------

    function bulletins() { return strings.bulletins || []; }
    function leaders() { return strings.leaders || []; }
    function topics() { return strings.topics || []; }
    function vocab(key) { return (strings.vocab && strings.vocab[key]) || []; }

    function randomOf(list) {
        return list && list.length ? list[(Math.random() * list.length) | 0] : '';
    }

    function stats() {
        const roles = {};
        for (const e of flat) roles[e.role] = (roles[e.role] || 0) + 1;
        return {
            items: flat.length,
            frames: flat.reduce((n, e) => n + e.frames, 0),
            dirs: Object.keys(gfx).length,
            roles,
            sfx: audio.sfx.length,
            music: audio.music.filter((m) => m.file).length,
            bulletins: bulletins().length,
        };
    }

    return {
        init,
        isReady: () => ready,
        framePath, heroPath, loadImage, loadClip, cached,
        find, get, pick, pickMany,
        sfxByRole, pickSfx, sfxById, musicTracks,
        bulletins, leaders, topics, vocab, randomOf,
        stats,
        get all() { return flat; },
    };
})();
