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
   full 13,144-item library reachable instead of the 9 items the
   old bumper rotation used.

   ------------------------------------------------------------
   Recent fixes:

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

   mergeMoo2Strings()
            MoO2 text archives and the ORION2.EXE string dump
            are extracted into assets/moo2-strings.json by
            tools/extract_moo2_text.py + tools/merge_moo2_text.py.
            That file shares the same shape as moo-strings.json —
            bulletins, leaders, topics, vocab — so it can be
            merged into the same pools the sector-wire generator
            reads from. script-writer.js then draws from both
            without needing a branch. Called from init() right
            after the MoO1 strings load; no-op if the file is
            missing.
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

    // Images are cached least-recently-used, capped by decoded size. The
    // generated art alone is about 2 GB decoded, and a channel meant to run
    // for days picks across all of it; uncapped, the cache would end up
    // holding every plate. Eviction only drops the cache's reference — a
    // scene or bundle holding the image keeps it — and a reload is a 304.
    const imageCache = new Map();
    const IMAGE_CACHE_BYTES = 512 * 1024 * 1024;
    let imageCacheBytes = 0;
    const pending = new Map();

    function imageBytes(img) {
        return img ? (img.naturalWidth || img.width || 0) * (img.naturalHeight || img.height || 0) * 4 : 0;
    }

    function cacheImage(src, img) {
        imageCacheBytes += imageBytes(img);
        imageCache.set(src, img);
        while (imageCacheBytes > IMAGE_CACHE_BYTES && imageCache.size > 1) {
            const [oldest, old] = imageCache.entries().next().value;
            imageCache.delete(oldest);
            imageCacheBytes -= imageBytes(old);
        }
    }

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

    // ---------------------------------------------------------
    // MoO2 strings merge
    // ---------------------------------------------------------
    //
    // The MoO2 text archives and the ORION2.EXE string dump are
    // extracted into assets/moo2-strings.json by extract_moo2_text.py
    // and merge_moo2_text.py. That file shares the same shape as
    // moo-strings.json — bulletins, leaders, topics, vocab — so it
    // can be merged into the same pools the sector-wire generator
    // reads from. script-writer.js then draws from both without
    // needing a branch; a sector-wire bulletin can be a MoO1
    // EVENTMSG entry or a MoO2 event message interchangeably.
    //
    // The merge is a no-op if the file is missing, so a runtime
    // that hasn't run the MoO2 text pipeline still works.
    // MoO1's `shipclasses` vocabulary is the game's ship-name table with
    // the neighbouring strings caught in it: leader personality traits
    // (Ecologist, Militarist, Xenophobic), interface words (Controls,
    // Research, Population, Techniques), and file or debug strings
    // (Emmxxxx0, Vgafileh, Psqrvw, Scrdmp, Yomama). Commercials name
    // sponsored hulls from this list, so a word that is not a ship's name
    // would be read out as one. Removed by name, once, at load.
    const NOT_A_SHIP_CLASS = new Set([
        'Agressive', 'Controls', 'Coraona', 'Diplomat', 'Diplomats', 'Drachma',
        'Ecologist', 'Emmxxxx0', 'Enhanced', 'Environments', 'Erratic',
        'Expansionist', 'Factory', 'Growth', 'Honorable', 'Increased',
        'Industrialist', 'Militarist', 'Pacifistic', 'Population',
        'Production', 'Psqrvw', 'Psqrvwu', 'Research', 'Ruthless', 'Scrdmp',
        'Superior', 'Techniques', 'Technologist', 'Vgafileh', 'Worker',
        'Xenophobic', 'Yomama', 'Fighters',
    ]);

    // Not stars, though both games' star lists contain them: Zortrium is a
    // metal, and a race's own name used as a place gives bulletins like
    // "the Alkari colony Mrrshan".
    const NOT_A_STAR = new Set(['Zortrium']);

    /**
     * Tidy the vocabulary once, after every source has been merged. Runs
     * whether or not the MoO2 strings exist, so a fresh clone without them
     * gets the same clean lists.
     */
    function cleanVocab() {
        const v = strings.vocab || {};
        if (Array.isArray(v.shipclasses)) {
            v.shipclasses = v.shipclasses.filter((w) =>
                /^[A-Z][a-z]+$/.test(w) && !NOT_A_SHIP_CLASS.has(w));
        }
        if (Array.isArray(v.stars)) {
            const races = new Set(v.races || []);
            v.stars = v.stars.filter((w) => !races.has(w) && !NOT_A_STAR.has(w));
        }
    }

    async function mergeMoo2Strings() {
        try {
            const resp = await fetch('assets/moo2-strings.json');
            if (!resp.ok) return;
            const moo2 = await resp.json();
            if (!moo2) return;

            const mergeArr = (a, b) => {
                const set = new Set(a || []);
                (b || []).forEach((x) => set.add(x));
                return Array.from(set);
            };

            // An allowlist, because most of what the MoO2 text pipeline
            // files under these names is not what the name says. Sampled
            // 2026-10-16:
            //
            //   bulletins (701)  game help text ("Click here to change the
            //                    name of your ship"), French, Italian,
            //                    Spanish and German localisation strings, a
            //                    DOS extender banner, "Grazie per aver
            //                    giocato a Master of Orion II!" — read aloud
            //                    by the anchors as sector news, and about
            //                    nine picks in ten, since MoO1 has only 75.
            //   leaders (5,084)  French tech names, "End of Turn Summary",
            //                    "HandleKeepAlive" — these filled {LEADER}.
            //   topics (9,194)   code identifiers ("Far_Reload_Next").
            //   shipclasses/misc (400 each)  arbitrary capitalised words in
            //                    four languages; commercials name products
            //                    from shipclasses ("ACCORDO-Class").
            //   tech             German entries mixed in.
            //
            // Race and star names are clean and are kept; two stars that are
            // not stars (Zortrium is a metal, Mrrshan a race) are dropped.
            // MoO1's 75 bulletins are the real GNN copy the original in-game
            // anchor read, and stay the whole bulletin pool. If the MoO2
            // extraction learns to separate narrative text from interface
            // text, widen this list — do not remove it.
            const MOO2_VOCAB_KEYS = ['races', 'stars'];
            const mergedVocab = Object.assign({}, strings.vocab || {});
            for (const key of MOO2_VOCAB_KEYS) {
                const list = ((moo2.vocab || {})[key] || [])
                    .filter((w) => /^[A-Z][a-z]+$/.test(w));
                mergedVocab[key] = mergeArr(mergedVocab[key], list);
            }

            strings = Object.assign({}, strings, { vocab: mergedVocab });
            console.log('[GNN Assets] merged MoO2 race and star names — '
                + (strings.vocab.races || []).length + ' races, '
                + (strings.vocab.stars || []).length + ' stars; '
                + (strings.bulletins || []).length + ' bulletins (MoO1 only)');
        } catch (err) {
            console.warn('[GNN Assets] MoO2 strings unavailable:',
                err && err.message ? err.message : err);
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

        // Merge MoO2 text pools into the same tables before flat/byId
        // are populated. script-writer.js reads through the exported
        // bulletins()/leaders()/topics()/vocab() helpers, which all
        // reference `strings`, so the merge is transparent to every
        // caller.
        await mergeMoo2Strings();
        cleanVocab();
        // Hand-picked MoO2 diplomacy and Antaran text (lore only). Optional:
        // a runtime without the file simply has no transmissions.
        transmissionsData = await loadJson('assets/moo2-transmissions.json', null);

        flat = [];
        byId = new Map();
        for (const dir of Object.keys(gfx)) {
            // Manifest-level metadata (`_moo2_keys`, and any future
            // underscore-prefixed field) is not a directory of items.
            // Iterating it pushed raw strings into `flat`, which inflated
            // `stats().items` and made the boot log's asset count wrong.
            // Same convention the merge tool uses when it writes.
            if (dir.startsWith('_')) continue;
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
        // `entry.source` names the game the archive came from ('moo1',
        // 'moo2'). MoO1 entries written before the field existed have no
        // source, and default to the historical layout — no prefix — so
        // the existing manifest keeps resolving unchanged. MoO2 entries
        // declare `source: 'moo2'` and their files live under
        // `assets/cutscenes/moo2/<dir>/...`.
        const src = entry.source ? `${entry.source}/` : '';
        return `${GFX_ROOT}/${src}${entry.dir}/item_${String(entry.item).padStart(2, '0')}_frame_${n}.png`;
    }

    function heroPath(entry) {
        return framePath(entry, entry.hero || 0);
    }

    // ---------------------------------------------------------
    // Image loading (deduplicated, cached, never rejects)
    // ---------------------------------------------------------

    /**
     * Load an image, once, without ever rejecting.
     *
     * `{ cache: false }` is for footage: the MoO2 cinematics are 1,835
     * frames, about 528 MB decoded, and every cutaway or fault that plays
     * one loads up to 54 of them. Kept here for the life of the page, a
     * station meant to run around the clock would eventually hold all of
     * them. Uncached images are still deduplicated while in flight, and
     * are released as soon as the scene that used them lets go.
     */
    function loadImage(src, opts) {
        const keep = !(opts && opts.cache === false);
        if (imageCache.has(src)) {
            // Most recently used moves to the back of the eviction order.
            const hit = imageCache.get(src);
            imageCache.delete(src);
            imageCache.set(src, hit);
            return Promise.resolve(hit);
        }
        if (pending.has(src)) return pending.get(src);
        const p = new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                if (keep) cacheImage(src, img);
                pending.delete(src); resolve(img);
            };
            img.onerror = () => {
                if (keep) cacheImage(src, null);
                pending.delete(src); resolve(null);
            };
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
            // The deny list, enforced here and not by each consumer.
            //
            // It lived in the scene compositor and only the compositor's
            // own recipes consulted it. Commercial breaks pick their
            // footage straight from this query, so every beat could land
            // on the interface panels, keyed-out figures and inverted
            // council frames the list was written to keep off air — the
            // VORTEX hook list is the clearest case, where every item but
            // the one scrambled one was denied and that one was still
            // eligible. A pool query that returns denied items is a pool
            // query every caller has to remember to filter, and one forgot.
            //
            // Looked up at call time because the compositor loads after
            // this file; by the time anything queries a pool it exists.
            if (e.id && typeof GNNSceneCompositor !== 'undefined'
                && GNNSceneCompositor.isDenied
                && GNNSceneCompositor.isDenied(e.id)) return false;
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

    let transmissionsData = null;
    /** Curated MoO2 transmissions by kind: diplomatic, court, antaran. */
    function transmissions(kind) {
        const list = transmissionsData && transmissionsData[kind];
        return Array.isArray(list) ? list : [];
    }
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
        bulletins, leaders, topics, vocab, randomOf, transmissions,
        stats,
        get all() { return flat; },
    };
})();