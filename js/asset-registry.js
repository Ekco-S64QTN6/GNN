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

   ------------------------------------------------------------
   Recent fix:

   find()   A numeric ceiling an item cannot answer is no longer
            satisfied by default. `e.coverage > q.maxCoverage`
            tests false when `e.coverage` is `undefined`, so an
            item whose manifest entry is missing `coverage`,
            `noise`, `lum`, `w`, `h` or `frames` was passing every
            query that named a bound on that field. The COLONIES
            sky panels — fully opaque, coverage 1.00 where the
            manifest has it, and no entry at all on some of the
            older items — reached a query that asked for
            `maxCoverage 0.6, maxNoise 40` and drew as a hard
            magenta rectangle in the bottom-left of the `industry`
            cutaway. The check now requires the field to be a
            number, in both directions: a min filter needs a real
            value to pass, and a max filter needs one to fail on.
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
                // `aspect` and `area` are derived here from the real
                // dimensions so a caller cannot accidentally read a value
                // the manifest did not supply. Every other field — `role`,
                // `coverage`, `lum`, `noise`, `hero`, `pools` — is left
                // exactly as the manifest wrote it, because `find()` now
                // distinguishes "field has this value" from "field is not
                // present", and defaulting a missing field to zero would
                // collapse those two cases back together.
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
     * Test a numeric bound against an entry.
     *
     * Two things this function fixes over a bare `e.field > q.bound`:
     *
     *   1. A missing field on the entry fails the test in *both*
     *      directions. `undefined > 0.6` is false, so the naive version
     *      let an item with no `coverage` field pass a max-coverage
     *      query — the exact hole that put an opaque sky panel into the
     *      `industry` plate rect. `undefined < 0.6` is also false, so
     *      the naive version accidentally rejected missing fields on
     *      min queries — which was correct by luck, not by design. This
     *      makes the intent explicit: a bound an item cannot answer is
     *      a bound the item does not satisfy.
     *
     *   2. The comparison is named, so a caller reading `find()` sees
     *      what it is doing rather than a chain of inline inequalities.
     *
     * `q` carries the constraints; `key` names the field on `q` being
     * read (`'maxW'`, `'minCoverage'`); `field` is the entry field it
     * tests (`'w'`, `'coverage'`); `dir` is `'min'` or `'max'`.
     */
    function boundOk(entry, q, key, field, dir) {
        if (q[key] === undefined) return true;
        const v = entry[field];
        if (typeof v !== 'number' || !isFinite(v)) return false;
        return dir === 'min' ? v >= q[key] : v <= q[key];
    }

    /**
     * Filter the library.
     * @param {Object} q - { pool, dir, dirs, role, roles, minW, minH, maxW,
     *                       maxH, animated, minFrames, maxNoise, minCoverage,
     *                       maxCoverage, minLum, exclude }
     *
     * `pool` is the admission gate from the extraction pipeline: an item only
     * carries a pool if it passed that pool's size, palette-richness and
     * interface checks. Querying by pool is what keeps a 7x3 tactical chip or
     * an empty menu frame out of a cutaway window.
     *
     * Every numeric bound here rejects an entry whose manifest entry does
     * not carry that field. See `boundOk()` above and the note at the top
     * of this file — the previous version let a missing field satisfy any
     * max bound, which is how an opaque COLONIES sky panel reached a rect
     * that asked for a cut-out.
     */
    function find(q = {}) {
        const dirs = q.dirs || (q.dir ? [q.dir] : null);
        const roles = q.roles || (q.role ? [q.role] : null);
        const exclude = q.exclude ? new Set(q.exclude) : null;
        return flat.filter((e) => {
            if (q.pool && (e.pools || []).indexOf(q.pool) < 0) return false;
            if (dirs && dirs.indexOf(e.dir) < 0) return false;
            if (roles && roles.indexOf(e.role) < 0) return false;
            if (exclude && exclude.has(e.id)) return false;

            if (!boundOk(e, q, 'minW', 'w', 'min')) return false;
            if (!boundOk(e, q, 'maxW', 'w', 'max')) return false;
            if (!boundOk(e, q, 'minH', 'h', 'min')) return false;
            if (!boundOk(e, q, 'maxH', 'h', 'max')) return false;

            if (!boundOk(e, q, 'minFrames', 'frames', 'min')) return false;

            if (!boundOk(e, q, 'maxNoise', 'noise', 'max')) return false;
            if (!boundOk(e, q, 'minCoverage', 'coverage', 'min')) return false;
            if (!boundOk(e, q, 'maxCoverage', 'coverage', 'max')) return false;
            if (!boundOk(e, q, 'minLum', 'lum', 'min')) return false;

            // `animated` is a boolean, and the test is `!==`, so a missing
            // field already filters out (`undefined !== false` is true).
            // Left as-is; the fix above is for the numeric fields only.
            if (q.animated !== undefined && e.animated !== q.animated) return false;

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
        if (opts.minDur !== undefined) {
            pool = pool.filter((s) => typeof s.dur === 'number' && s.dur >= opts.minDur);
        }
        if (opts.maxDur !== undefined) {
            pool = pool.filter((s) => typeof s.dur === 'number' && s.dur <= opts.maxDur);
        }
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