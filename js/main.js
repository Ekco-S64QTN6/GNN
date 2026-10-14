/* ============================================================
   GNN — Bootstrap & Control Room
   ------------------------------------------------------------
   Loads the asset manifests, preloads the newsroom plates,
   wires the modules to each other and runs the frame loop.
   ============================================================ */

(function () {
    'use strict';

    const ASSET_DIR = 'assets';
    const RENDER_FPS = 20;
    const FRAME_MS = 1000 / RENDER_FPS;
    // Boot sequence. The station opens on a title card with a music bed
    // and does not go on air until the track ends. During that window
    // every async load settles — the TTS pipeline warms on the server,
    // the first feed poll lands, the anchor and icon plates finish — so
    // the first line of the broadcast is not fighting the startup for
    // resources, which is what caused the first-minute weirdness that
    // has been on the open-items list since the project began.
    const BOOT_CARD = 'assets/generated/titlecards/main_desk_05.png';
    const BOOT_TRACK = 'track_09';
    const BOOT_FADE_S = 3;         // seconds of crossfade before the track ends
    const BOOT_FALLBACK_MS = 12000; // hold this long if the track will not load

    // The ten studio sets the conditioner produces, in the order it lists
    // them. Every one is a full newsroom in a single plate — the desk is
    // drawn into the room, not composited on from a separate image — and
    // every one has its window pane cut out by condition_plates.py, whose
    // rect is read back from layout.json's `windows` map.
    //
    // A set whose PNG is missing is simply skipped; the rotation falls
    // back to whatever loaded. The first entry is the station's default
    // and is what the renderer shows until the first block swap.
    const SET_FILES = [
        'studio_wide_empty.png',
        'market_wide_empty.png',
        'geopolitics_wide_empty.png',
        'tech_wide_empty.png',
        'celebrity_wide_empty.png',
        'sports_wide_empty.png',
        'diplomatic_wide_empty.png',
        'anomaly_wide_empty.png',
        'weather_wide_empty.png',
        'archive_wide_empty.png',
    ];

    // Boot diagnostics. Every line is sent to the browser console (live,
    // for a watch) and to the server's gnn-server.log via /api/log (for
    // reading after the fact, next to the Python side's own `[GNN]`
    // lines). The POST is fire-and-forget — a failed log call is not
    // worth breaking a page load over, and the console copy always works
    // regardless of whether the endpoint is reachable.
    //
    // The boot race this is here to diagnose: the first line of the
    // broadcast sometimes has its mouth not move, and the first story
    // sometimes has the anchors stepping on each other. Both resolve
    // after about a minute. Watch the `[GNN Boot] audio state=` lines
    // and the `[TTS]` lines from tts.js in the same file to see whether
    // the context is running when the first clip plays.
    function log(...args) {
        const line = args.map((a) => {
            if (a === null) return 'null';
            if (a === undefined) return 'undefined';
            if (typeof a === 'object') {
                try { return JSON.stringify(a); } catch (e) { return String(a); }
            }
            return String(a);
        }).join(' ');
        // eslint-disable-next-line no-console
        console.log('[GNN Boot]', line);
        try {
            fetch('api/log', {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: '[GNN Boot] ' + line,
                keepalive: true,
            }).catch(() => { /* console copy already worked */ });
        } catch (err) {
            // fetch can throw synchronously on a bad URL or in odd
            // sandboxed contexts. Still not worth breaking the page.
        }
    }

    /**
     * Watch the AudioContext state during boot.
     *
     * The trace suspects the context may be suspended when the first
     * clip plays, which would leave the analyser unattached (so the
     * mouth does not track the voice) and the music bed silent (the
     * music bus is inside the same context). Every 500ms during the
     * first 30 seconds is logged so the boot window is fully captured;
     * after that only state *changes* are logged, so a long session
     * does not accumulate thousands of identical lines but a late
     * transition still shows up.
     */
    function watchAudioContext() {
        let lastState = null;
        const start = performance.now();
        setInterval(() => {
            const ctx = GNNAudio.getContext();
            const state = ctx ? ctx.state : 'none';
            const elapsed = Math.round(performance.now() - start);
            const duringBoot = elapsed < 30000;
            if (duringBoot || state !== lastState) {
                log('audio',
                    'state=' + state,
                    'elapsed=' + elapsed + 'ms',
                    ctx ? 't=' + ctx.currentTime.toFixed(2) : 'no-ctx');
            }
            lastState = state;
        }, 500);
    }

    const $ = (id) => document.getElementById(id);

    const canvas = $('gnnCanvas');
    const btnPlayPause = $('btn-play-pause');
    const iconPlay = $('icon-play');
    const iconPause = $('icon-pause');
    const btnMute = $('btn-mute');
    const iconUnmuted = $('icon-unmuted');
    const iconMuted = $('icon-muted');
    const btnVoice = $('btn-voice');
    const iconVoiceOn = $('icon-voice-on');
    const iconVoiceOff = $('icon-voice-off');
    const voiceSelect = $('voice-select');
    const btnSkip = $('btn-skip');
    const btnBreak = $('btn-break');
    const btnSettings = $('btn-settings');
    const settingsPanel = $('settings-panel');
    const btnCloseSettings = $('btn-close-settings');
    const feedUrlInput = $('feed-url-input');
    const btnAddFeed = $('btn-add-feed');
    const feedList = $('feed-list');
    const statusDot = $('status-dot');
    const statusText = $('status-text');
    const segmentBadge = $('segment-badge');
    const tickerToggle = $('ticker-toggle');
    const telemetryToggle = $('telemetry-toggle');
    const assetReadout = $('asset-readout');
    const secretLog = $('secret-log');
    const telemetry = $('telemetry');

    let lastRender = 0;
    let tickerRebuiltAt = 0;
    let frameCount = 0;
    let bootError = false;

    // =========================================================
    // Preload
    // =========================================================

    async function loadAllAssets() {
        statusText.textContent = 'Reading asset manifests…';
        await GNNAssets.init();

        statusText.textContent = 'Loading studio plates…';

        // The generated newsroom, if it has been made. All optional: the
        // station still goes to air on the MOO1 scene alone, so a missing
        // plate is a look rather than a failure.
        const GEN = `${ASSET_DIR}/generated`;

        // The layout file first — it tells us where every set's window is,
        // which backdrops exist, and where the anchors sit in each set.
        // Missing it is not fatal: with no layout the sets just load without
        // a window rect or a desk line, and the renderer draws the room with
        // its panes black and seats the cast at its own default.
        let layout = null;
        try {
            layout = await fetch(`${GEN}/set/layout.json`).then((r) => r.json());
        } catch (err) {
            log('assets', 'no layout.json — window rects, desk lines and '
                + 'backdrop list unavailable');
        }
        const layoutWindows = (layout && layout.windows) || {};
        const primaryWindow = (layout && layout.window) || null;
        // Per-set desk lines: the row the anchors sit on in each room.
        // Written by condition_plates.py alongside the window rects; read
        // here and passed through to each set entry below, then on to the
        // renderer. The whole map being missing is fine — the renderer
        // falls back to its own default — and a missing entry for one set
        // is fine too, same reason.
        const layoutDeskLines = (layout && layout.deskLines) || {};
        const primaryDeskLine = (layout && layout.deskLine) || null;

        // Every set. Each entry carries its own window rect, keyed by the
        // set's filename stem — `market_wide_empty` for
        // `market_wide_empty.png`, which is what condition_plates.py writes
        // into `layout.json.windows` — and its own desk line, keyed the same
        // way into `layout.json.deskLines`.
        //
        // This replaced a single hardcoded pair of `studio_wide_empty.png`
        // and `desk_oval_front.png`. The desk plate is gone — the desk is
        // drawn into each room now, so there is no separate plate for the
        // renderer to draw and no perspective mismatch between the two.
        const sets = [];
        for (const name of SET_FILES) {
            const plate = await GNNAssets.loadImage(`${GEN}/set/${name}`);
            if (!plate) continue;
            const key = name.replace(/\.png$/, '');
            sets.push({
                name,
                plate,
                window: layoutWindows[key] || primaryWindow || null,
                // The row the anchors sit on in this set — the desk's
                // front lip. Written by condition_plates.py alongside the
                // window rects, read here and passed through to the
                // renderer. Falls back to the primary set's value, and
                // then to null, in which case the renderer uses its own
                // default.
                deskLine: layoutDeskLines[key] || primaryDeskLine || null,
            });
        }
        if (!sets.length) {
            log('assets', 'no studio sets found — station will show a blank room');
        }

        // Backdrops, from whatever the conditioner recorded. The previous
        // version picked from a two-item hardcoded array
        // (`['earth_globe_dawn', 'orion_shipyard_night']`), so four of the
        // six backs on disk were never seen. Reading the list means adding
        // a new backdrop is a data-only change: drop the PNG in the inbox,
        // re-run the conditioner, reload.
        const backdropNames = (layout && layout.backdrops) || [];
        const backdrops = [];
        for (const name of backdropNames) {
            const img = await GNNAssets.loadImage(`${GEN}/backdrops/${name}`);
            if (img) backdrops.push({ name, img });
        }
        // Fallback if layout.json did not name any — same two-item list the
        // old code used, so an older generated/ tree still works.
        if (!backdrops.length) {
            for (const name of ['earth_globe_dawn.png', 'orion_shipyard_night.png']) {
                const img = await GNNAssets.loadImage(`${GEN}/backdrops/${name}`);
                if (img) backdrops.push({ name, img });
            }
        }

        // ---------------------------------------------------------
        // The cast
        // ---------------------------------------------------------
        //
        // Every species is loaded, not just the two currently at the
        // desk. Each seat carries its own voice, because the anchor is a
        // character rather than a sprite: one speech model reading for a
        // bear, a cat and a grey alien is the same person wearing masks.
        //
        // The line-up turns over per show block, so a given block always
        // shows the same team for the length of a session. The schedule
        // is defined below as `SHOW_PAIRS` — a fixed list, not a shuffle,
        // because the station has a standing line-up rather than a random
        // draw every boot.
        //
        // The robot is on the roster with everyone else — he goes through
        // the same anchor pipeline as every other species
        // (`robot_desk_hero.png`, `robot_speaking.png`, `robot_listening.png`,
        // optionally `robot_listening_flip.png`) — but he is not seatable:
        // he is Station Automation, not a correspondent or an anchor. The
        // pairing list excludes him.
        const ROSTER = [
            { sid: 'human', voice: 'am_michael' },
            { sid: 'mrrshan_f', voice: 'af_bella' },
            { sid: 'bulrathi', voice: 'bm_lewis' },
            { sid: 'psilon', voice: 'bm_fable' },
            { sid: 'sakkra', voice: 'bm_daniel' },
            { sid: 'mrrshan', voice: 'bm_george' },
            { sid: 'alkari', voice: 'bf_emma' },
            { sid: 'darlok', voice: 'vox_unit' },
            { sid: 'meklar', voice: 'vox_unit' },
            { sid: 'silicoid', voice: 'bf_isabella' },
            { sid: 'klackon', voice: 'am_fenrir' },
            { sid: 'robot', voice: 'vox_unit' },
            { sid: 'human_f', voice: 'af_heart' },
            { sid: 'alkari_f', voice: 'bf_lily' },
        ];

        // One loader for every species, robot included. Four plates each —
        // hero, speaking, listening, listening-flip — and the missing ones
        // fall back to the hero so a partially-conditioned species still
        // puts a figure on screen rather than dropping out of the desk.
        async function loadAnchorSet(who) {
            const [hero, speaking, listening, flip] = await Promise.all([
                GNNAssets.loadImage(`${GEN}/anchors/${who.sid}_desk_hero.png`),
                GNNAssets.loadImage(`${GEN}/anchors/${who.sid}_speaking.png`),
                GNNAssets.loadImage(`${GEN}/anchors/${who.sid}_listening.png`),
                GNNAssets.loadImage(`${GEN}/anchors/${who.sid}_listening_flip.png`),
            ]);
            if (!hero) return null;
            return {
                sid: who.sid, voice: who.voice, hero,
                speaking: speaking || hero,
                listening: listening || hero,
                // Mirrored, for a seat to the right of whoever is talking.
                // Falls back to the unmirrored plate, which is better than
                // facing away.
                listeningFlip: flip || listening || hero,
            };
        }

        // Load every seatable species. The robot is loaded separately,
        // since he is not seated.
        const seatable = ROSTER.filter((r) => r.sid !== 'robot');
        const anchorList = (await Promise.all(
            seatable.map(loadAnchorSet))).filter(Boolean);

        const robotCfg = ROSTER.find((r) => r.sid === 'robot');
        const robot = robotCfg ? await loadAnchorSet(robotCfg) : null;

        /**
         * The show schedule: which two anchors sit at the desk for each of
         * the ten shows.
         *
         * A fixed list, not a shuffle. The station has a standing line-up
         * — the same show at the same time of day shows the same team —
         * and a rerun of the station should look like a rerun, not a
         * different channel. Edit `SHOW_PAIRS` to change the schedule.
         *
         * Order matters within a pair: the first entry is the lead, who
         * reads the sign-on and the sign-off, and whose voice is set when
         * the block swaps. The second is the co-anchor.
         *
         * A pair whose second entry is missing — a species whose plates
         * failed to load — becomes a one-anchor desk, and the renderer
         * falls back to centre-seating it. A pair where *both* are
         * missing is dropped from the rotation rather than taking a slot
         * with nobody at the desk.
         *
         * Counts below. Fourteen seatable species, ten shows, twenty
         * seatings, so most anchors appear twice and a few appear once.
         * Keeping the "main desk" pair (Hale + Varr) first is deliberate:
         * the station opens on the same team a viewer who has seen the
         * channel before will recognise.
         */
        const SHOW_PAIRS = [
            ['human', 'mrrshan_f'],     // 1 — Hale + Varr, the main desk
            ['human_f', 'mrrshan'],     // 2 — Vance + Rell
            ['bulrathi', 'alkari_f'],   // 3 — Grolm + Kira
            ['psilon', 'sakkra'],       // 4 — Oth + Ssyth
            ['darlok', 'meklar'],       // 5 — the two machines
            ['silicoid', 'klackon'],    // 6 — Quarry + Hive-Liaison
            ['alkari', 'mrrshan_f'],    // 7 — Kesh + Varr
            ['human', 'human_f'],       // 8 — the two commanders
            ['bulrathi', 'psilon'],     // 9 — Grolm + Oth
            ['sakkra', 'silicoid'],     // 10 — Ssyth + Quarry
        ];

        // Resolve species ids to the loaded anchor entries. Missing plates
        // drop out, so a species whose assets did not load does not take a
        // seat and the show runs with however many anchors are available.
        const anchorById = new Map(anchorList.map((a) => [a.sid, a]));
        const anchorPairs = SHOW_PAIRS
            .map((pair) => pair.map((sid) => anchorById.get(sid)).filter(Boolean))
            .filter((pair) => pair.length > 0);

        // If the disk does not have any of the pairs — an empty assets
        // tree, a broken load — fall back to whatever anchors did load so
        // the station still goes to air rather than crashing at boot.
        if (!anchorPairs.length && anchorList.length) {
            anchorPairs.push(anchorList.slice(0, 2));
        }

        await GNNIconManager.loadIcons(`${ASSET_DIR}/icons`);

        const s = GNNAssets.stats();
        if (assetReadout) {
            assetReadout.textContent =
                `${s.items} graphics items · ${s.frames} frames · ${s.dirs} archives · ` +
                `${s.sfx} effects · ${s.music} music beds · ${s.bulletins} archive bulletins`;
        }
        statusText.textContent = 'Studio ready';

        log('assets',
            'sets=' + sets.length + '/' + SET_FILES.length,
            'anchors=' + anchorList.length,
            'pairs=' + anchorPairs.length,
            'backdrops=' + backdrops.length,
            'robot=' + (robot ? 'ok' : 'missing'),
            'windows=' + Object.keys(layoutWindows).length,
            'deskLines=' + Object.keys(layoutDeskLines).length);

        // Two shapes in one return.
        //
        // The renderer's `init()` reads the top-level singular fields —
        // `set`, `desk`, `window`, `deskLine`, `backdrop`, `seated`,
        // `deskVoice` — for the first block, which is what draws before
        // the director calls `setShowBlock(0)`.
        //
        // The plural fields — `sets`, `backdrops`, `anchors`, `anchorPairs`
        // — are the full bundle, which `GNNRenderer.setShowBlock()` uses
        // to swap to a different block when the show changes. Each set in
        // that bundle carries its own `deskLine`, so the renderer seats the
        // cast at the right height for whichever room is on air.
        return {
            // --- first block, for the initial draw ---
            set: sets[0] ? sets[0].plate : null,
            desk: null,                        // the desk is in the set now
            window: sets[0] ? sets[0].window : null,
            // The row the anchors sit on in the first block's set. Read
            // from layout.json via the sets bundle above; the renderer
            // uses it in place of its own default. Null is fine — the
            // renderer falls back.
            deskLine: sets[0] ? sets[0].deskLine : null,
            backdrop: backdrops[0] ? backdrops[0].img : null,
            seated: anchorPairs[0] || [],
            deskVoice: (anchorPairs[0] && anchorPairs[0][0])
                ? anchorPairs[0][0].voice : null,
            robot,

            // --- full bundle, for the block rotation ---
            sets,                              // [{ name, plate, window, deskLine }]
            backdrops,                         // [{ name, img }]
            anchors: anchorList,               // [anchor, ...] in ROSTER order
            anchorPairs,                       // per-block [lead, co-anchor]
        };
    }

    // =========================================================
    // Frame loop
    // =========================================================

    function gameLoop(timestamp) {
        requestAnimationFrame(gameLoop);
        const now = performance.now();

        // One update pass per rendered frame. Running these off raw rAF ties
        // their behaviour to the monitor's refresh rate and burns main-thread
        // time that the audio scheduler needs.
        if (timestamp - lastRender < FRAME_MS) return;
        lastRender = timestamp;
        frameCount++;

        // First frame is a boot milestone: the render loop is actually
        // running and the canvas is being drawn to. Logged once.
        if (frameCount === 1) log('boot', 'game loop first frame at ' + Math.round(now) + 'ms');

        try {
            GNNGlitch.update(now);
            GNNDirector.update(now);
            GNNTextEngine.update(now);
            GNNTickerManager.update(now);
        } catch (err) {
            console.error('[GNN Loop]', err);
        }

        const frames = GNNAnimator.tick(now);

        const story = GNNDirector.getCurrent();
        // No story, no monitor. The fallback used to park a STATUS plate on
        // the wall and leave it there for the whole of dead air, a studio
        // screen showing the same word for minutes at a time. The monitor is
        // off unless there is something on it.
        const icon = story
            ? (story.icon || GNNIconManager.matchIcon(story.title, story.description))
            : null;

        GNNRenderer.renderFrame(now, frames, icon);

        if (telemetry && document.body.classList.contains('show-telemetry')) {
            const r = GNNDirector.report();
            // BLOCK is 1-based for a reader; the internal index is 0-based.
            // LEFT is the wall-clock remainder of the current show, in
            // minutes. CORR shows whether the show's one correspondent slot
            // has been used. HELD is the count of stories sitting in the
            // beat-filter buckets, which is what tells you at a glance why
            // the rundown looks empty.
            const heldTotal = r.held
                ? Object.values(r.held).reduce((n, x) => n + x, 0)
                : 0;
            telemetry.textContent =
                `SEG ${r.state} · BLOCK ${r.block + 1} · ` +
                `READ ${r.storiesRead} · LEFT ${Math.floor(r.showLeftMs / 60000)}m · ` +
                `CORR ${r.correspondentUsed ? 'USED' : 'PENDING'} · ` +
                `RUNDOWN ${r.queued} · HELD ${heldTotal} · ` +
                `BREAK IN ${Math.max(0, r.nextBreakAt - r.sinceBreak)} · ` +
                `VOICE ${r.speaking ? 'ON' : 'OFF'} · ` +
                `PROMPT ${Math.round(GNNTextEngine.progress() * 100)}%/${GNNTextEngine.getText().length}c · ` +
                `FX ${GNNGlitch.activeName() || '—'} · F${frameCount}@${(now / 1000).toFixed(0)}s`;
        }

        if (segmentBadge) {
            const st = GNNDirector.getState();
            segmentBadge.textContent = st;
            segmentBadge.className = 'seg-' + st.toLowerCase();
        }

        // Refresh the crawl every couple of minutes with current headlines.
        if (now - tickerRebuiltAt > 120000) {
            tickerRebuiltAt = now;
            const ctx = GNNRenderer.getContext();
            if (ctx) {
                GNNTickerManager.rebuild(ctx,
                    [story].concat(GNNDirector.getQueue().slice(0, 10)).filter(Boolean));
            }
        }
    }

    // =========================================================
    // UI
    // =========================================================

    function bindClickSfx() {
        document.querySelectorAll('button, select, input[type=checkbox]').forEach((el) => {
            el.addEventListener('click', () => {
                // These fire in the target phase, ahead of the document-level
                // unlock listener, so the very first click would otherwise be
                // silently dropped for want of an AudioContext.
                GNNAudio.ensureContext();
                GNNAudio.playUiClick();
            });
        });
    }

    function wireUI() {
        btnPlayPause.addEventListener('click', () => {
            GNNAudio.ensureContext();
            const running = !GNNDirector.isRunning();
            if (running) GNNDirector.resume(); else GNNDirector.pause();
            iconPlay.classList.toggle('hidden', running);
            iconPause.classList.toggle('hidden', !running);
        });

        btnMute.addEventListener('click', () => {
            GNNAudio.ensureContext();
            const muted = GNNAudio.toggleMute();
            iconUnmuted.classList.toggle('hidden', muted);
            iconMuted.classList.toggle('hidden', !muted);
        });

        if (btnVoice) {
            btnVoice.addEventListener('click', () => {
                GNNAudio.ensureContext();
                const on = !GNNTTS.isEnabled();
                GNNTTS.setEnabled(on);
                iconVoiceOn.classList.toggle('hidden', !on);
                iconVoiceOff.classList.toggle('hidden', on);
            });
        }

        if (voiceSelect) {
            GNNTTS.VOICES.forEach((v) => {
                const o = document.createElement('option');
                o.value = v.id; o.textContent = v.label;
                voiceSelect.appendChild(o);
            });
            voiceSelect.value = GNNTTS.getVoice();
            voiceSelect.addEventListener('change', () => {
                GNNTTS.setVoice(voiceSelect.value);
            });
        }

        btnSkip.addEventListener('click', () => {
            GNNAudio.ensureContext();
            GNNDirector.skip();
        });

        if (btnBreak) {
            btnBreak.addEventListener('click', () => {
                GNNAudio.ensureContext();
                GNNDirector.forceBreak();
            });
        }

        btnSettings.addEventListener('click', () => {
            settingsPanel.classList.remove('hidden');
            renderFeedList();
        });
        btnCloseSettings.addEventListener('click', () => settingsPanel.classList.add('hidden'));
        settingsPanel.addEventListener('click', (e) => {
            if (e.target === settingsPanel) settingsPanel.classList.add('hidden');
        });

        btnAddFeed.addEventListener('click', () => {
            const url = feedUrlInput.value.trim();
            if (url) { GNNFeedManager.addFeed(url); feedUrlInput.value = ''; renderFeedList(); }
        });
        feedUrlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') btnAddFeed.click();
        });

        const btnInject = $('btn-inject-news');
        const injectInput = $('breaking-news-input');
        if (btnInject && injectInput) {
            btnInject.addEventListener('click', () => {
                const text = injectInput.value.trim();
                if (!text) return;
                GNNAudio.ensureContext();
                GNNDirector.injectBreaking(text, '');
                GNNTickerManager.alert();
                injectInput.value = '';
                settingsPanel.classList.add('hidden');
            });
            injectInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') btnInject.click();
            });
        }

        // The engineering readout is a development instrument, not part of
        // the broadcast, so it is off unless asked for. The preference
        // survives a reload; everything else here does not, but a diagnostic
        // you have to re-enable every time is one you stop using.
        if (telemetryToggle) {
            let on = false;
            try { on = localStorage.getItem('gnn.telemetry') === '1'; }
            catch (err) { on = false; }   // private window, blocked storage
            telemetryToggle.checked = on;
            document.body.classList.toggle('show-telemetry', on);
            telemetryToggle.addEventListener('change', () => {
                const v = telemetryToggle.checked;
                document.body.classList.toggle('show-telemetry', v);
                try { localStorage.setItem('gnn.telemetry', v ? '1' : '0'); }
                catch (err) { /* not worth failing a toggle over */ }
            });
        }

        if (tickerToggle) {
            tickerToggle.checked = GNNTickerManager.isEnabled();
            tickerToggle.addEventListener('change', () => {
                GNNTickerManager.setEnabled(tickerToggle.checked);
            });
        }

        // Canvas is interactive: the globe and the anchor's optics respond.
        canvas.addEventListener('click', (e) => {
            const r = canvas.getBoundingClientRect();
            const px = (e.clientX - r.left) * (canvas.width / r.width);
            const py = (e.clientY - r.top) * (canvas.height / r.height);
            GNNGlitch.handleCanvasClick(px, py, GNNRenderer.VIEW);
        });

        document.addEventListener('keydown', (e) => {
            if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
            GNNGlitch.handleKey(e);
        });

        // First gesture: unlock audio and speech, then get the anchor talking.
        const unlock = () => {
            GNNAudio.ensureContext();
            GNNTTS.unlock();
            GNNAudio.preload(GNNAudio.CORE_SFX);
            log('boot', 'user gesture: audio unlocked');
        };
        document.addEventListener('click', unlock, { once: true });
        document.addEventListener('keydown', unlock, { once: true });
        bindClickSfx();
    }

    function renderFeedList() {
        feedList.innerHTML = '';
        for (const url of GNNFeedManager.getFeeds()) {
            const li = document.createElement('li');
            const span = document.createElement('span');
            span.textContent = url;
            const btn = document.createElement('button');
            btn.textContent = '✕';
            btn.title = 'Remove feed';
            btn.addEventListener('click', () => { GNNFeedManager.removeFeed(url); renderFeedList(); });
            li.appendChild(span); li.appendChild(btn);
            feedList.appendChild(li);
        }
    }

    // =========================================================
    // Module wiring
    // =========================================================

    function wireModules() {
        // Single source of truth for the mouth: the voice's own start/end
        // events, not a per-frame poll of the same flag.
        //
        // `onStart` asks the director *who* is about to speak, because not
        // every voice on the wire belongs to somebody at the desk. A remote
        // two-way plays the correspondent's answering line through the same
        // voice bus, and until this check existed the animator moved the
        // anchor's mouth while the correspondent was talking — the anchor's
        // plate was animating on a voice that did not belong to them.
        //
        // `speakerIsSeated()` returns true for anything spoken by an anchor,
        // false for a correspondent, and true by default outside a two-way,
        // which is everything else the station plays. `onEnd` is
        // unconditional: whatever was moving stops.
        GNNTTS.onStart = () => GNNAnimator.setSpeaking(
            typeof GNNDirector !== 'undefined' && GNNDirector.speakerIsSeated
                ? GNNDirector.speakerIsSeated() : true);
        GNNTTS.onEnd = () => GNNAnimator.setSpeaking(false);

        GNNFeedManager.onNewItems = (items) => GNNDirector.enqueueAll(items);
        GNNFeedManager.onStatusChange = (text, isError) => {
            statusText.textContent = text;
            statusDot.className = isError ? 'error' : 'live';
        };

        // Commercial beats are spoken by the same anchor unit.
        GNNCutsceneManager.onBeat = (text, shot) => {
            if (!text) return null;
            // Hand the promise back so the shot holds until its line is out.
            return GNNTTS.speak(text, GNNCutsceneManager.voiceOptsFor(shot.beat));
        };

        GNNGlitch.onSecret = (id, line) => {
            if (secretLog) {
                const li = document.createElement('li');
                li.textContent = line;
                secretLog.prepend(li);
                while (secretLog.children.length > 6) secretLog.lastChild.remove();
            }
            // Through the director's speech queue, not straight to the TTS.
            //
            // This used to poll for the station to stop talking and then
            // call `GNNTTS.speak()` itself. That poll has a race: if it
            // expired in the same tick the pump was starting the next line,
            // the interjection cut the anchor off mid-word. It is why the
            // station ident was stepped on at first boot exactly once and
            // then never again on the same build — the timer won the race
            // that one time.
            //
            // Through `interject()` the line waits its turn like anything
            // else. It plays when the anchor finishes rather than cutting
            // them off, and the caption presents at the moment its own line
            // starts, which is what the rest of the station does.
            if (typeof GNNDirector !== 'undefined' && GNNDirector.interject) {
                GNNDirector.interject(line, { pitch: -26, rate: -12 });
            } else {
                // Director not wired yet — the fallback keeps the secret
                // audible rather than silently dropping it. Should never
                // happen in the normal boot order.
                GNNTextEngine.present(line, {
                    kind: 'wire', cue: '◆ UNLISTED TRANSMISSION',
                    durationMs: 3200,
                });
                GNNTTS.speak(line, { pitch: -26, rate: -12 });
            }
        };
    }

    // =========================================================
    // Boot
    // =========================================================

    /**
     * Fade the controls out when the pointer stops. Watching a channel should
     * not mean looking at a toolbar; it comes back the moment the mouse does.
     */
    /** Station configuration, on a key, since nothing is on screen. */
    function wireSettingsKey() {
        window.addEventListener('keydown', (e) => {
            if (e.key !== 's' && e.key !== 'S' && e.key !== 'Escape') return;
            const panel = $('settings-panel');
            if (!panel) return;
            const t = e.target && e.target.tagName;
            if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
            panel.classList.toggle('hidden');
        });
    }

    function watchPointerIdle() {
        const IDLE_MS = 2800;
        let timer = null;
        const wake = () => {
            document.body.classList.remove('ui-idle');
            clearTimeout(timer);
            timer = setTimeout(
                () => document.body.classList.add('ui-idle'), IDLE_MS);
        };
        ['mousemove', 'mousedown', 'keydown', 'touchstart']
            .forEach((e) => window.addEventListener(e, wake, { passive: true }));
        wake();
    }

    // =========================================================
    // Boot sequence
    // =========================================================

    /**
     * Show the boot overlay and start the music bed that covers the load.
     *
     * Returns when the track has finished and the fade is complete. Along
     * the way it fires the fade-out three seconds before the track ends,
     * so the studio is already visible behind the card when the station
     * goes on air.
     *
     * Called from `init()` after the renderer is wired and the game loop
     * has started — the loop is what draws the studio behind the overlay,
     * so by the time the fade begins the picture underneath is stable.
     */
    async function runBootSequence() {
        const card = $('boot-card');
        if (card) card.src = BOOT_CARD;

        // Warm the TTS pipeline while the track plays. The first synthesis
        // on a cold server is the largest single source of the first-
        // minute weirdness — the model takes seconds to load, and every
        // line dispatched before it is ready lands late or fails. This
        // call is a throwaway whose only job is to force that load. The
        // result is discarded; by the time the ident speaks, the pipeline
        // is warm.
        try { GNNTTS.prefetch('Loading.'); } catch (err) { /* not fatal */ }

        log('boot', 'boot sequence starting');

        let result = null;
        try {
            result = await GNNAudio.playBootTrack(BOOT_TRACK, { gain: 0.7 });
        } catch (err) {
            log('boot', 'boot track failed', err && err.message ? err.message : err);
        }

        // Fire the booth ident FROM HERE, not from the director's cold open.
        //
        // The ident and the anchor's sign-on used to be queued microseconds
        // apart inside beginColdOpen(), which is a race: the pump plays them
        // in order, but the robot's line is the first ever line synthesised
        // through a cold TTS pipeline, so its speak() promise can settle
        // early under load and the anchor's line — queued immediately after
        // it — pre-empts it. That is the "Hale cut off the robot" fault, and
        // it is non-deterministic because it depends on how long the first
        // synthesis takes on that particular boot.
        //
        // Moving the ident here means it fires 8+ seconds before the anchor's
        // line is even queued. There is no overlap window for the pump to
        // mis-order, and the voice is warm by the time the anchor speaks.
        //
        // Timing: the ident is scheduled to finish one beat before the
        // crossfade from the title card to the studio begins, so the viewer
        // hears the station identify itself and then, as the sounder ends,
        // watches the picture change. That is a sign-on.
        function fireBoothIdent() {
            log('boot', 'booth ident firing');
            GNNDirector.boothIdent();
        }

        if (result && result.duration > BOOT_FADE_S + 1) {
            const fadeMs = (result.duration - BOOT_FADE_S) * 1000;

            // Estimate the ident's length so the ident can be scheduled to
            // end just as the fade begins. The line is a constant on the
            // director's side — `BOOTH_IDENT_LINE` — so the estimate is
            // measured against that same constant here. This is what keeps
            // the estimate and the spoken line in sync: if the constant
            // ever changes, both the estimate and the spoken line change
            // together, and the timing self-corrects.
            let identLeadMs = 0;
            try {
                const identMs = GNNTTS.estimateMs('This is the Galactic News Network.');
                // 100 ms of margin so the ident is definitely done before
                // the fade starts. If the estimate is short, the ident
                // overlaps the fade slightly, which is fine — better than
                // firing it too early and leaving silence before the
                // transition.
                identLeadMs = Math.max(0, fadeMs - identMs - 100);
                setTimeout(() => {
                    log('boot', 'booth ident firing, ends '
                        + ((identMs + 100) / 1000).toFixed(1)
                        + 's before fade');
                    GNNDirector.boothIdent();
                }, identLeadMs);
            } catch (err) {
                log('boot', 'booth ident scheduling failed',
                    err && err.message ? err.message : err);
                // No estimate available. Fire the ident a fixed five seconds
                // before the fade — enough runway for a short line to
                // finish, short enough that it does not leave a gap.
                setTimeout(fireBoothIdent, Math.max(0, fadeMs - 5000));
            }

            log('boot', 'boot track duration='
                + result.duration.toFixed(2) + 's',
                'fade in ' + (fadeMs / 1000).toFixed(2) + 's',
                'ident at ' + (identLeadMs / 1000).toFixed(2) + 's');
            setTimeout(fadeBootOverlay, fadeMs);
            await result.stopped;
        } else if (result) {
            // Track too short for the fade. Fire the ident now and wait out
            // the remaining time.
            fireBoothIdent();
            await result.stopped;
            fadeBootOverlay();
        } else {
            // No track — autoplay blocked, manifest missing, or decode
            // failed. Fire the ident mid-hold so there is still a station
            // sound before the studio comes up, then fall back to a fixed
            // hold so the warm-up still happens.
            log('boot', 'no boot track — falling back to '
                + (BOOT_FALLBACK_MS / 1000) + 's hold');
            setTimeout(fireBoothIdent,
                Math.max(500, BOOT_FALLBACK_MS - BOOT_FADE_S * 1000 - 5000));
            setTimeout(fadeBootOverlay, BOOT_FALLBACK_MS - BOOT_FADE_S * 1000);
            await new Promise((r) => setTimeout(r, BOOT_FALLBACK_MS));
        }

        // Track is over. The fade has been running for the last three
        // seconds of it, so the overlay's alpha is already zero. Take
        // it out of the DOM entirely so the next frame does not pay for
        // an invisible element.
        const overlay = $('boot-overlay');
        if (overlay) overlay.classList.add('hidden');

        // Release the director. Its S.BOOT case gates on this flag.
        window.GNNBootReady = true;
        log('boot', 'boot sequence complete — releasing director');
    }

    function fadeBootOverlay() {
        const overlay = $('boot-overlay');
        if (overlay) overlay.classList.add('fading-out');
        log('boot', 'studio fade-in started');
    }

    async function init() {
        watchPointerIdle();
        wireSettingsKey();

        // Start watching the AudioContext from the very beginning of boot.
        // The AudioContext does not exist yet — `getContext()` returns null
        // — so the first samples will read `state=none`. That is expected
        // and useful: it tells us the moment the context is actually
        // created, and whether it comes up running or suspended.
        watchAudioContext();
        log('boot', 'init start');

        try {
            try {
                if (document.fonts && document.fonts.load) {
                    await document.fonts.load('16px "Press Start 2P"');
                }
            } catch (fontErr) {
                console.warn('[GNN] font load warning:', fontErr);
            }

            // Ask the server which engine and voices it has before the
            // selector is built, so the two can never disagree.
            const catalogue = await GNNTTS.loadCatalogue();
            if (catalogue && catalogue.engine) {
                log('boot', 'voice engine:',
                    catalogue.engine, catalogue.cloud ? 'cloud' : 'local');
            }

            const assets = await loadAllAssets();
            log('boot', 'assets loaded',
                'seated=' + (assets.seated ? assets.seated.length : 0),
                'robot=' + (assets.robot ? 'ok' : 'missing'));
            GNNRenderer.init(canvas, assets);

            // The anchor in the first seat of the first block reads, so the
            // station speaks with that character's voice rather than
            // whatever the catalogue happened to list first. The per-block
            // voice is set by the director inside `beginColdOpen` every
            // time the block swaps.
            if (assets.deskVoice) GNNTTS.setVoice(assets.deskVoice);

            wireModules();
            wireUI();

            const ctx = GNNRenderer.getContext();
            if (ctx) GNNTickerManager.rebuild(ctx, []);

            // Start the loop immediately, before the boot sequence — it is
            // what draws the studio behind the title card, so by the time
            // the fade begins the picture underneath is already there.
            requestAnimationFrame(gameLoop);

            // Start the feed manager too. Its poll runs in the background
            // during boot so the queue has stories ready by the time the
            // director is released. The director does not act on them
            // until `GNNBootReady` is set, so nothing is spoken early.
            GNNFeedManager.start();

            // Boot track, crossfade, warm-up window. Resolves when the
            // station is on air. Everything the first minute used to
            // fight over — TTS pipeline, icon plates, first feed poll —
            // has the track's runtime to settle.
            await runBootSequence();

            log('boot', 'on air',
                'voice=' + GNNTTS.getVoice(),
                'engine=' + (GNNTTS.getEngine() || 'unknown'));

            iconPlay.classList.add('hidden');
            iconPause.classList.remove('hidden');
        } catch (err) {
            bootError = true;
            console.error('[GNN] initialization failed:', err);
            log('boot', 'FAILED', err && err.message ? err.message : String(err));
            statusText.textContent = 'Error loading assets — see console';
            statusDot.className = 'error';
            try {
                GNNFeedManager.start();
                requestAnimationFrame(gameLoop);
            } catch (_) { /* nothing further to do */ }
        }
    }

    init();
})();