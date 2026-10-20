/* ============================================================
   GNN — Bootstrap & Control Room
   ------------------------------------------------------------
   Loads the asset manifests, preloads the newsroom plates,
   wires the modules to each other and runs the frame loop.
   ============================================================ */

(function () {
    'use strict';

    const ASSET_DIR = 'assets';
    // 20 on air. `?fps=30` (or 60) for recording — the trailer tool asks
    // for 30 so its footage is not stepped at the broadcast's frame rate.
    const RENDER_FPS = (() => {
        const m = String((typeof window !== 'undefined' && window.location && window.location.search) || '')
            .match(/[?&]fps=(30|60)\b/);
        return m ? Number(m[1]) : 20;
    })();
    const FRAME_MS = 1000 / RENDER_FPS;

    // ---------------------------------------------------------
    // Boot sequence
    // ---------------------------------------------------------
    //
    // Two boot flows, both driven by the same list-of-cards format:
    //
    //   Initial boot   the station slate, then the first show's card,
    //                  then the live studio underneath. Plays at page
    //                  load, over the boot track, before the director's
    //                  S.BOOT gate is released.
    //
    //   Show bumper    the station slate, then the incoming show's card,
    //                  then the live studio. Plays between shows, over a
    //                  short music interlude, before the anchor's sign-on.
    //                  Requires a two-line hook in broadcast-director.js
    //                  (see the note at the bottom of this file).
    //
    // The station slate is `test_card.png` — deliberately unpolished, so
    // the first thing on screen reads as a technical rehearsal rather
    // than a programme already in progress. The show card is the block's
    // own titlecard, drawn from `SHOW_CARDS` below.
    const STATION_SLATE = 'assets/generated/titlecards/test_card.png';

    // One titlecard per show block, keyed by the block's id from
    // `SHOW_SCHEDULE` in broadcast-director.js. A block with no entry
    // here runs with only the station slate — no card, no music gap,
    // straight from slate to studio — which is what a show that has not
    // had a card generated yet should do.
    //
    // The mapping is a design choice, not a code constraint. Edit the
    // filenames here to change which card a show opens on; the code
    // reads the value and never assumes what it points at.
    // Every show has a card. A block with no entry here, or whose file is
    // missing, opens on the station slate instead — `bootCardsForBlock()`
    // falls back rather than failing. The value is a filename inside
    // `assets/generated/titlecards/`.
    const SHOW_CARDS = {
        morning_watch: 'main_desk.png',
        economy: 'market_desk.png',
        crossfire: 'the_spotlight.png',
        cybernetics: 'tech_desk.png',
        trade_minerals: 'fleet_briefing.png',
        // Composed by tools/compose_titlecards.py from the show's own studio
        // as the renderer draws it, with a branded bar. Re-run that tool
        // after changing a show's set or pair.
        machine_intel: 'machine_intel.png',
        diplomacy: 'diplomacy.png',
        evening_rim: 'evening_rim.png',
        anomaly: 'anomaly.png',
        archives: 'archives.png',
    };

    // Boot track — the full-length music bed that covers the initial
    // station load. Between shows, a shorter interlude is used instead:
    // the boot track is ~22 seconds, which is right for warming the TTS
    // pipeline and the first feed poll, and wrong for a bumper between
    // two fifteen-minute shows.
    const BOOT_TRACK = 'track_09';
    // The boot crossfade duration, in seconds. The fade is the visible
    // transition from the title card to the live studio, and it is also
    // the window during which Hale's sign-on begins — the director is
    // released a beat into the fade rather than after it, so his voice
    // arrives as the picture is still resolving instead of three
    // seconds after it has settled.
    //
    // Was 3. At three seconds the transition read as a dead beat: the
    // card disappeared, the studio came up over three full seconds of
    // silence, and only then did the anchor speak. At 1.2 the fade is a
    // deliberate cut rather than a slow dissolve, which is what a
    // channel bumper wants.
    const BOOT_FADE_S = 1.2;
    // How long after the fade begins to release the director. Hale's
    // line has already been warmed by the prefetch at boot start, so it
    // plays within ~200 ms of the release. Setting this at 300 ms puts
    // his voice roughly a third of the way into the fade, which is when
    // the studio is legible but still resolving.
    const BOOT_RELEASE_INTO_FADE_MS = 300;
    const BOOT_FALLBACK_MS = 12000; // hold this long if the track will not load

    // Where in the boot track the slate hands off to the show card, as a
    // fraction of duration. At 22.4s this is ~6.7s of slate, then the
    // show card holds for the rest of the track and the fade.
    const BOOT_CARD_SWAP_AT = 0.30;

    // Bumper timing, between shows. Nine seconds is a real station
    // bumper — long enough to see the card and hear a phrase of music,
    // short enough that the viewer does not wonder if the channel is
    // still on air. The swap lands a third of the way through, matching
    // the initial boot's rhythm.
    const BUMPER_MS = 9000;
    const BUMPER_FADE_MS = 800;
    const BUMPER_CARD_SWAP_AT = 0.35;

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
    }

    /**
     * Probe a list of card URLs and return only the ones that load.
     *
     * A card listed in a pool whose file is missing — because it was
     * generated but never dropped into `assets/generated/titlecards/`,
     * or because the pool drifted from the disk — used to leave the
     * boot `<img>` showing a broken-image icon over a black overlay for
     * the whole track. Probing before the track starts turns a visible
     * fault into a silent skip and lets the remaining cards run in
     * order.
     *
     * The probe loads each image before it is needed, so the swap during
     * playback is a synchronous `src` assignment rather than a fetch
     * that could miss its slot under load.
     */
    async function resolveBootSequence(urls) {
        const available = [];
        for (const url of urls) {
            const ok = await new Promise((resolve) => {
                const probe = new Image();
                probe.onload = () => resolve(true);
                probe.onerror = () => resolve(false);
                probe.src = url;
            });
            if (ok) available.push(url);
            else log('boot', 'boot card missing: ' + url);
        }
        if (!available.length) {
            log('boot', 'no boot cards available — the overlay will be blank');
        }
        return available;
    }

    /**
     * The card sequence for one show block.
     *
     * Always the station slate first, then the block's own card when it
     * has one. Returns an array so the caller can iterate — the sequence
     * is exactly the list that plays, in order, and an empty list means
     * the overlay stays black for the length of the track.
     *
     * `blockInfo` is what `GNNDirector.getShowInfo()` returns, or null
     * when the director is not available yet. With no block info, the
     * sequence is just the slate — correct for a boot that runs before
     * the director has been initialized.
     */
    function bootCardsForBlock(blockInfo) {
        const urls = [STATION_SLATE];
        const id = blockInfo && blockInfo.id;
        const blockCard = id && SHOW_CARDS[id];
        if (blockCard) {
            urls.push('assets/generated/titlecards/' + blockCard);
        }
        return urls;
    }

    /**
     * Watch the AudioContext state during boot.
     *
     * Every 500ms during the first 30 seconds is logged so the boot
     * window is fully captured; after that only state *changes* are
     * logged, so a long session does not accumulate thousands of
     * identical lines but a late transition still shows up.
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
    const secretBoard = $('secret-board');
    const secretBoardTitle = $('secret-board-title');

    /** Every secret: found ones by name, the rest as a blank and a hint. */
    function renderSecretBoard() {
        if (!secretBoard || typeof GNNGlitch === 'undefined' || !GNNGlitch.secretsBoard) return;
        const board = GNNGlitch.secretsBoard();
        const found = board.filter((x) => x.found).length;
        if (secretBoardTitle) {
            secretBoardTitle.textContent = 'Secrets — ' + found + ' of ' + board.length + ' found';
        }
        secretBoard.innerHTML = '';
        for (const x of board) {
            const li = document.createElement('li');
            if (x.found) {
                li.className = 'found';
                li.textContent = x.title;
            } else {
                li.textContent = '\u2592\u2592\u2592\u2592\u2592\u2592';
                const hint = document.createElement('span');
                hint.className = 'hint';
                hint.textContent = x.hint;
                li.appendChild(hint);
            }
            secretBoard.appendChild(li);
        }
    }
    const telemetry = $('telemetry');

    let lastRender = 0;
    let tickerRebuiltAt = 0;
    let frameCount = 0;
    let bootError = false;

    // Guards against a second entry into `init()`'s catch block — or the
    // success path — starting a second frame loop. `gameLoop` schedules
    // its own next frame at the top of every call, so calling
    // `requestAnimationFrame(gameLoop)` twice produces two independent
    // infinite chains.
    let loopStarted = false;

    function startLoop() {
        if (loopStarted) return;
        loopStarted = true;
        requestAnimationFrame(gameLoop);
    }

    // =========================================================
    // Preload
    // =========================================================

    async function loadAllAssets() {
        statusText.textContent = 'Reading asset manifests…';
        await GNNAssets.init();

        statusText.textContent = 'Loading studio plates…';

        const GEN = `${ASSET_DIR}/generated`;

        // The layout file first — it tells us where every set's window is,
        // which backdrops exist, and where the anchors sit in each set.
        // Missing it is not fatal: with no layout the sets just load
        // without a window rect or a desk line.
        let layout = null;
        try {
            layout = await fetch(`${GEN}/set/layout.json`).then((r) => r.json());
        } catch (err) {
            log('assets', 'no layout.json — window rects, desk lines and '
                + 'backdrop list unavailable');
        }
        const layoutWindows = (layout && layout.windows) || {};
        const primaryWindow = (layout && layout.window) || null;
        const layoutDeskLines = (layout && layout.deskLines) || {};
        const primaryDeskLine = (layout && layout.deskLine) || null;

        const sets = [];
        for (const name of SET_FILES) {
            const plate = await GNNAssets.loadImage(`${GEN}/set/${name}`);
            if (!plate) continue;
            const key = name.replace(/\.png$/, '');
            sets.push({
                name,
                plate,
                window: layoutWindows[key] || primaryWindow || null,
                deskLine: layoutDeskLines[key] || primaryDeskLine || null,
            });
        }
        if (!sets.length) {
            log('assets', 'no studio sets found — station will show a blank room');
        }

        const backdropNames = (layout && layout.backdrops) || [];
        const backdrops = [];
        for (const name of backdropNames) {
            const img = await GNNAssets.loadImage(`${GEN}/backdrops/${name}`);
            if (img) backdrops.push({ name, img });
        }
        if (!backdrops.length) {
            for (const name of ['earth_globe_dawn.png', 'orion_shipyard_night.png']) {
                const img = await GNNAssets.loadImage(`${GEN}/backdrops/${name}`);
                if (img) backdrops.push({ name, img });
            }
        }

        const ROSTER = [
            { sid: 'human', voice: 'am_michael' },
            { sid: 'mrrshan_f', voice: 'af_bella' },
            { sid: 'bulrathi', voice: 'bm_lewis' },
            { sid: 'psilon', voice: 'bm_fable' },
            { sid: 'sakkra', voice: 'bm_daniel' },
            { sid: 'mrrshan', voice: 'bm_george' },
            { sid: 'alkari', voice: 'am_puck' },
            { sid: 'darlok', voice: 'vox_unit' },
            { sid: 'meklar', voice: 'vox_unit' },
            { sid: 'silicoid', voice: 'bf_isabella' },
            { sid: 'klackon', voice: 'am_fenrir' },
            { sid: 'robot', voice: 'vox_unit' },
            { sid: 'human_f', voice: 'af_heart' },
            { sid: 'alkari_f', voice: 'bf_lily' },
        ];

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
                listeningFlip: flip || listening || hero,
            };
        }

        // Every entry in ROSTER is seatable, including Unit 7. He has a
        // full anchor set on disk (`robot_desk_hero.png` and the three
        // variants) and a cast profile in `js/cast.js`, so the filter
        // that used to keep him out of the seating rotation was the only
        // thing keeping him off the desk. He sits at block 4 now.
        const seatable = ROSTER.slice();
        const anchorList = (await Promise.all(
            seatable.map(loadAnchorSet))).filter(Boolean);

        const robotCfg = ROSTER.find((r) => r.sid === 'robot');
        const robot = robotCfg ? await loadAnchorSet(robotCfg) : null;

        // FALLBACK ONLY. Each show's pair comes from
        // assets/generated/show-config.json, by show id (below); this table
        // is used only for a show the config leaves out or names an anchor
        // that did not load. Left-hand id sits on the left of the desk.
        //
        // A show's pair must match its title card — the card shows the two
        // characters, then the studio fades in to the same two in the same
        // seats. Five cards are generated art; the other five are composed
        // from the running studio by tools/compose_titlecards.py, so after
        // changing one of those pairs, re-run that tool.
        //
        // Every id here must be a species with a `_desk_hero.png` in
        // `assets/generated/anchors/`. That includes `robot` now — see
        // the seatable change below.
        const SHOW_PAIRS = [
            // 0 morning_watch   main_desk.png       Human + Mrrshan_f
            ['human', 'mrrshan_f'],
            // 1 economy         market_desk.png     Mrrshan_m + Meklar
            ['mrrshan', 'meklar'],
            // 2 crossfire       the_spotlight.png   Mrrshan_f + Alkari
            ['mrrshan_f', 'alkari'],
            // 3 cybernetics     tech_desk.png       Psilon + Klackon
            ['psilon', 'klackon'],
            // 4 machine_intel   (no card)           Ssyth + Unit 7
            ['sakkra', 'robot'],
            // 5 trade_minerals  fleet_briefing.png  Bulrathi + Darlok
            ['bulrathi', 'darlok'],
            // 6 diplomacy       (no card)
            ['alkari_f', 'silicoid'],
            // 7 evening_rim     (no card)
            ['human', 'human_f'],
            // 8 anomaly         (no card)
            ['bulrathi', 'psilon'],
            // 9 archives        (no card)
            ['human', 'mrrshan_f'],
        ];

        const anchorById = new Map(anchorList.map((a) => [a.sid, a]));
        let anchorPairs = SHOW_PAIRS
            .map((pair) => pair.map((sid) => anchorById.get(sid)).filter(Boolean))
            .filter((pair) => pair.length > 0);

        // Each show's set and pair, by id, from show-config.json.
        //
        // The renderer swaps all three by *block index*, and they used to be
        // three arrays here lined up only by position with the schedule —
        // which they were not. Four shows aired on another show's set:
        // Anomaly: Deep Dark at the weather desk, the Evening Rim Report on
        // the anomaly set, Colonial Mining & Trade on the sports set, the
        // Machine Intelligence Log on the spotlight set. A set that failed
        // to load would also have shifted every later show by one. And
        // show-config.json — what tools/show-editor.html edits — was read
        // by nothing, so editing a show changed nothing on air.
        //
        // Now each block's entry is looked up by its own id. Anything the
        // config leaves out, or names but cannot be loaded, falls back to
        // the old positional entry rather than leaving the slot empty.
        try {
            const cfg = await fetch(`${GEN}/show-config.json`).then((r) => r.json());
            const ids = (typeof GNNDirector !== 'undefined' && GNNDirector.scheduleIds)
                ? GNNDirector.scheduleIds() : (cfg.shows || []).map((x) => x.id);
            const byShow = new Map((cfg.shows || []).map((x) => [x.id, x]));
            // Title cards too: a show added to the config gets its card
            // without a code change. Missing files are skipped at boot.
            for (const x of cfg.shows || []) {
                if (x.titlecard) SHOW_CARDS[x.id] = x.titlecard;
            }
            // Promos name a show's anchors and air its card.
            if (GNNScript.setShows) GNNScript.setShows(cfg.shows || []);
            const setByName = new Map(sets.map((x) => [x.name, x]));
            // Backdrops are deliberately *not* taken from the config: it
            // names two, and the window rotates through all of layout.json's
            // sixteen. Fewer views would be a step towards repetition.
            const blockSets = [], blockPairs = [];
            ids.forEach((id, i) => {
                const show = byShow.get(id) || {};
                blockSets.push(setByName.get(show.set) || sets[i % Math.max(1, sets.length)]);
                const pair = (show.pair || []).map((sid) => anchorById.get(sid)).filter(Boolean);
                blockPairs.push(pair.length === 2 ? pair
                    : anchorPairs[i % Math.max(1, anchorPairs.length)]);
            });
            if (blockSets.every(Boolean)) {
                sets.splice(0, sets.length, ...blockSets);
            }
            if (blockPairs.every((p) => p && p.length)) anchorPairs = blockPairs;
            log('assets', 'show-config applied: ' + ids.map((id, i) =>
                id + '=' + (sets[i] ? sets[i].name.replace('_wide_empty.png', '') : '?')).join(' '));
        } catch (err) {
            log('assets', 'show-config unavailable, using positional sets: '
                + (err && err.message ? err.message : err));
        }

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

        return {
            set: sets[0] ? sets[0].plate : null,
            desk: null,
            window: sets[0] ? sets[0].window : null,
            deskLine: sets[0] ? sets[0].deskLine : null,
            backdrop: backdrops[0] ? backdrops[0].img : null,
            seated: anchorPairs[0] || [],
            deskVoice: (anchorPairs[0] && anchorPairs[0][0])
                ? anchorPairs[0][0].voice : null,
            robot,

            sets,
            backdrops,
            anchors: anchorList,
            anchorPairs,
        };
    }

    // =========================================================
    // Frame loop
    // =========================================================

    function gameLoop(timestamp) {
        requestAnimationFrame(gameLoop);
        const now = performance.now();

        if (timestamp - lastRender < FRAME_MS) return;
        lastRender = timestamp;
        frameCount++;

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
        const icon = story
            ? GNNIconManager.matchIcon(story.title, story.description, { lore: !!story.lore })
            : null;

        GNNRenderer.renderFrame(now, frames, icon);

        if (telemetry && document.body.classList.contains('show-telemetry')) {
            const r = GNNDirector.report();
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
            const show = (typeof GNNDirector.getShowInfo === 'function') ? GNNDirector.getShowInfo() : null;
            const showTitle = show ? show.title.toUpperCase() : 'GNN NEWS';
            segmentBadge.textContent = `${showTitle} · ${st}`;
            segmentBadge.title = `${show ? show.title : 'Broadcast'} (${show ? show.desk : ''}) - State: ${st}`;
            segmentBadge.className = 'seg-' + st.toLowerCase();
        }

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
            console.log('[GNN UI] Play/Pause toggled, running =', running);
            iconPlay.classList.toggle('hidden', running);
            iconPause.classList.toggle('hidden', !running);
        });

        btnMute.addEventListener('click', () => {
            GNNAudio.ensureContext();
            const muted = GNNAudio.toggleMute();
            console.log('[GNN UI] Mute toggled, muted =', muted);
            iconUnmuted.classList.toggle('hidden', muted);
            iconMuted.classList.toggle('hidden', !muted);
        });

        if (btnVoice) {
            btnVoice.addEventListener('click', () => {
                GNNAudio.ensureContext();
                const on = !GNNTTS.isEnabled();
                GNNTTS.setEnabled(on);
                console.log('[GNN UI] Voice toggled, enabled =', on);
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
                console.log('[GNN UI] Voice selected =', voiceSelect.value);
                GNNTTS.setVoice(voiceSelect.value, { restart: true });
            });
        }

        btnSkip.addEventListener('click', () => {
            GNNAudio.ensureContext();
            console.log('[GNN UI] Skip clicked');
            GNNDirector.skip();
        });

        if (btnBreak) {
            btnBreak.addEventListener('click', () => {
                GNNAudio.ensureContext();
                console.log('[GNN UI] Commercial break button clicked');
                GNNDirector.forceBreak();
            });
        }

        btnSettings.addEventListener('click', () => {
            console.log('[GNN UI] Settings opened');
            settingsPanel.classList.remove('hidden');
            renderFeedList();
            renderSecretBoard();
        });
        btnCloseSettings.addEventListener('click', () => {
            console.log('[GNN UI] Settings closed');
            settingsPanel.classList.add('hidden');
        });
        settingsPanel.addEventListener('click', (e) => {
            if (e.target === settingsPanel) {
                console.log('[GNN UI] Settings backdrop clicked');
                settingsPanel.classList.add('hidden');
            }
        });

        btnAddFeed.addEventListener('click', () => {
            const url = feedUrlInput.value.trim();
            if (url) {
                console.log('[GNN UI] Adding feed:', url);
                GNNFeedManager.addFeed(url);
                feedUrlInput.value = '';
                renderFeedList();
            }
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
                console.log('[GNN UI] Injecting breaking bulletin:', text);
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

        if (telemetryToggle) {
            let on = false;
            try { on = localStorage.getItem('gnn.telemetry') === '1'; }
            catch (err) { on = false; }
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
        // events, not a per-frame poll of the same flag. `onStart` asks
        // the director *who* is about to speak, because not every voice
        // on the wire belongs to somebody at the desk — a remote two-way
        // plays the correspondent's answering line through the same voice
        // bus and must not move the anchor's mouth.
        GNNTTS.onStart = () => GNNAnimator.setSpeaking(
            typeof GNNDirector !== 'undefined' && GNNDirector.speakerIsSeated
                ? GNNDirector.speakerIsSeated() : true);
        GNNTTS.onEnd = () => GNNAnimator.setSpeaking(false);

        GNNFeedManager.onNewItems = (items) => GNNDirector.enqueueAll(items);
        GNNDirector.onStory = (item) => {
            // The ledger is crossed off at the moment the director actually
            // starts reading the story, not when an RSS item is merely fetched
            // or queued. This guarantees a reported headline cannot return on
            // another show or after a page reload.
            // Lore bulletins are not news and are not in the ledger. Marking
            // them warned on every one, and would have filled the shared
            // ledger with in-universe stories if the feed manager had ever
            // accepted them.
            if (item && item.lore) return;
            const showId = GNNDirector.getShowInfo().id;
            // eslint-disable-next-line no-console
            console.log(`[GNN Ledger] onStory fired: "${item.title}" (show=${showId})`);
            try {
                GNNFeedManager.markAired(item, showId);
            } catch (err) {
                console.error('[GNN Ledger] Could not mark story aired:', err);
            }
        };
        window.GNNNewsLedger = {
            download: () => GNNFeedManager.downloadLedger(),
            get: () => GNNFeedManager.getLedger(),
            counts: () => {
                const items = GNNFeedManager.getLedger().items || [];
                return items.reduce((out, item) => {
                    const k = item.status || 'unknown'; out[k] = (out[k] || 0) + 1; return out;
                }, {});
            },
        };
        GNNFeedManager.onStatusChange = (text, isError) => {
            statusText.textContent = text;
            statusDot.className = isError ? 'error' : 'live';
        };

        GNNCutsceneManager.onBeat = (text, shot) => {
            if (!text) return null;
            const opts = GNNCutsceneManager.voiceOptsFor(shot.beat);
            if (typeof window !== 'undefined' && window.GNNTranscript && window.GNNTranscript.logSpeech) {
                window.GNNTranscript.logSpeech({
                    speakerId: 'commercial_announcer',
                    speakerName: shot.beat.kind === 'legal' ? 'Legal Announcer' : 'Commercial Announcer',
                    speakerRole: 'Sponsor Voice',
                    speakerSeat: 'Ad Segment',
                    text: text,
                    voiceId: opts.voice,
                    expectedVoiceId: opts.voice,
                });
            }
            return GNNTTS.speak(text, opts);
        };

        GNNGlitch.onSecret = (id, line) => {
            renderSecretBoard();
            if (secretLog) {
                const li = document.createElement('li');
                li.textContent = line;
                secretLog.prepend(li);
                while (secretLog.children.length > 6) secretLog.lastChild.remove();
            }
            if (typeof GNNDirector !== 'undefined' && GNNDirector.interject) {
                GNNDirector.interject(line, { pitch: -26, rate: -12 });
            } else {
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

    function wireSettingsKey() {
        // `s` opens settings, but the station also listens for typed words
        // (species names, call signs — see the glitch engine), and most of
        // them contain an `s`. So `s` toggles only when it is pressed on
        // its own: no letter in the half-second before it, and none in the
        // half-second after. A word being typed cancels the toggle. Escape
        // still toggles at once.
        const ALONE_MS = 500;
        let lastLetterAt = 0;
        let pending = null;
        const toggle = () => {
            const panel = $('settings-panel');
            if (panel) panel.classList.toggle('hidden');
            renderSecretBoard();
        };
        window.addEventListener('keydown', (e) => {
            const t = e.target && e.target.tagName;
            if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
            if (e.key === 'Escape') { toggle(); return; }
            const letter = /^[a-z0-9]$/i.test(e.key);
            const now = performance.now();
            if (pending && letter) { clearTimeout(pending); pending = null; }
            if ((e.key === 's' || e.key === 'S') && now - lastLetterAt > ALONE_MS) {
                pending = setTimeout(() => { pending = null; toggle(); }, ALONE_MS);
            }
            if (letter) lastLetterAt = now;
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
     * The initial boot.
     *
     * Runs once, at page load, over the full boot track. Fades the
     * overlay through the station slate and the first show's card, then
     * crossfades to the live studio the game loop has been drawing
     * underneath since `startLoop()` was called.
     *
     * Fires the booth ident so its last syllable lands one beat before
     * the crossfade begins — the viewer hears the station identify
     * itself and, as the sounder ends, watches the picture change. That
     * is a sign-on.
     *
     * Releases the director at the end by setting `window.GNNBootReady`,
     * which the director's S.BOOT case gates on.
     */
    async function runBootSequence() {
        const card = $('boot-card');
        const overlay = $('boot-overlay');

        // Build the sequence from block 0's card. Block 0 is the block
        // the director will open on, so the card shown here is the card
        // that matches the first show.
        const blockInfo = (typeof GNNDirector !== 'undefined'
            && GNNDirector.getShowInfo) ? GNNDirector.getShowInfo() : null;
        const sequence = await resolveBootSequence(bootCardsForBlock(blockInfo));

        // Seat that show's set and pair now, under the card. The renderer
        // starts on block 0 — Galactic Morning Watch — and only the first
        // cold open, after the fade, moved it to the show on the clock: every
        // boot showed Hale and Varr for a moment first (owner).
        if (blockInfo && typeof blockInfo.blockIndex === 'number'
            && typeof GNNRenderer !== 'undefined' && GNNRenderer.setShowBlock) {
            GNNRenderer.setShowBlock(blockInfo.blockIndex);
        }

        if (card) {
            if (sequence.length) card.src = sequence[0];
            else card.style.display = 'none';
        }
        if (overlay) {
            overlay.classList.remove('hidden', 'fading-out');
            overlay.style.transition = '';
        }

        // Warm the TTS pipeline while the track plays.
        try { GNNTTS.prefetch('Loading.'); } catch (err) { /* not fatal */ }

        log('boot', 'boot sequence starting');

        let result = null;
        try {
            result = await GNNAudio.playBootTrack(BOOT_TRACK, { gain: 0.7 });
        } catch (err) {
            log('boot', 'boot track failed', err && err.message ? err.message : err);
        }

        // Fire the booth ident FROM HERE, not from the director's cold
        // open. The ident and the anchor's sign-on used to be queued
        // microseconds apart inside beginColdOpen(), which is a race: the
        // pump plays them in order, but the robot's line is the first
        // ever line synthesised through a cold TTS pipeline, so its
        // speak() promise can settle early under load and the anchor's
        // line — queued immediately after — pre-empts it.
        //
        // Timing: the ident is scheduled to finish one beat before the
        // crossfade from the title card to the studio begins.
        function fireBoothIdent() {
            log('boot', 'booth ident firing');
            GNNDirector.boothIdent();
        }

        // Schedule the card swaps. Each entry after the first replaces
        // the one before it at a fixed fraction of the track's length, so
        // the sequence is the same rhythm on a 22s track and a 30s track.
        // The swap is a `src` reassignment, not a crossfade — the boot
        // overlay is a single `<img>`, and the hard cut from slate to
        // show card is what a channel does anyway.
        if (result && result.duration && sequence.length > 1) {
            const swapMs = result.duration * 1000 * BOOT_CARD_SWAP_AT;
            for (let i = 1; i < sequence.length; i++) {
                const delay = swapMs * i;
                if (delay < 500) continue;
                setTimeout(() => {
                    if (card) card.src = sequence[i];
                    log('boot', 'boot card -> ' + sequence[i]
                        + ' at ' + (delay / 1000).toFixed(1) + 's');
                }, delay);
            }
        }

        if (result && result.duration > BOOT_FADE_S + 1) {
            const fadeMs = (result.duration - BOOT_FADE_S) * 1000;

            let identLeadMs = 0;
            try {
                const identMs = GNNTTS.estimateMs('This is the Galactic News Network.');
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
                setTimeout(fireBoothIdent, Math.max(0, fadeMs - 5000));
            }

            log('boot', 'boot track duration='
                + result.duration.toFixed(2) + 's',
                'fade in ' + (fadeMs / 1000).toFixed(2) + 's',
                'ident at ' + (identLeadMs / 1000).toFixed(2) + 's',
                'release at ' + ((fadeMs + BOOT_RELEASE_INTO_FADE_MS) / 1000).toFixed(2) + 's');
            setTimeout(fadeBootOverlay, fadeMs);
            // Release the director a beat into the fade, so the anchor's
            // sign-on begins while the studio is still resolving. The
            // track continues playing under his voice and ends naturally
            // — the await below is what holds the boot function open
            // until then, but the director is already running by the
            // time we get there, so Hale is not waiting on the track.
            setTimeout(() => {
                if (typeof window !== 'undefined' && !window.GNNBootReady) {
                    window.GNNBootReady = true;
                    log('boot', 'director released into the fade');
                }
            }, fadeMs + BOOT_RELEASE_INTO_FADE_MS);
            await result.stopped;
        } else if (result) {
            fireBoothIdent();
            await result.stopped;
            fadeBootOverlay();
        } else {
            log('boot', 'no boot track — falling back to '
                + (BOOT_FALLBACK_MS / 1000) + 's hold');
            setTimeout(fireBoothIdent,
                Math.max(500, BOOT_FALLBACK_MS - BOOT_FADE_S * 1000 - 5000));
            setTimeout(fadeBootOverlay, BOOT_FALLBACK_MS - BOOT_FADE_S * 1000);
            await new Promise((r) => setTimeout(r, BOOT_FALLBACK_MS));
        }

        const finishedOverlay = $('boot-overlay');
        if (finishedOverlay) finishedOverlay.classList.add('hidden');

        window.GNNBootReady = true;
        log('boot', 'boot sequence complete — releasing director');
    }

    function fadeBootOverlay() {
        const overlay = $('boot-overlay');
        if (overlay) overlay.classList.add('fading-out');
        log('boot', 'studio fade-in started');
    }

    // =========================================================
    // Between-show bumper
    // =========================================================

    // Only one bumper at a time. The director calls `play` once per
    // block transition, but a stalled bumper (an image that never
    // resolves, a track that never decodes) must not stack with a
    // second call.
    let bumperRunning = false;

    /**
     * The between-show bumper: slate, incoming show's card, short music
     * interlude, then the fade to the live studio underneath.
     *
     * Structure is the same as the initial boot — same card sequence,
     * same fade-to-studio — but the timing is nine seconds instead of
     * the full boot track, and the music is a random bed from the
     * manifest that is not `track_09`, which is reserved for the initial
     * boot.
     *
     * The director is paused for the duration. That is what stops its
     * state machine from advancing through the bumper: the HOLD that
     * called us is waiting on an absolute timestamp, and pausing the
     * director freezes the state machine at that HOLD. On resume the
     * timestamp has already passed, so the HOLD resolves immediately
     * and the cold open begins under a picture that has just faded in.
     *
     * Returns a promise that resolves when the bumper has finished and
     * the director has been released. Await it, or fire and forget —
     * either way the fade and the resume happen together.
     */
    let bumperPromise = null;

    function playShowBumper() {
        // All callers share one in-flight bumper. A second call must wait for
        // the same handoff rather than returning an already-resolved Promise.
        if (bumperPromise) return bumperPromise;
        bumperRunning = true;
        // Freeze the director synchronously, before any image/card await can
        // yield a frame to the state machine.
        try { if (GNNDirector.pause) GNNDirector.pause(); } catch (_) { /* recover below */ }

        bumperPromise = (async () => {
            let handoffDone = false;
            const swapTimers = [];
            try {
                const card = $('boot-card');
                const overlay = $('boot-overlay');
                if (!card || !overlay) {
                    log('bumper', 'required overlay/card missing; handing off directly');
                    return;
                }

                // Capture the incoming show once. Every card and the eventual
                // director handoff are now tied to this same block ID.
                const blockInfo = (typeof GNNDirector !== 'undefined'
                    && GNNDirector.getShowInfo) ? GNNDirector.getShowInfo() : null;
                const sequence = await resolveBootSequence(bootCardsForBlock(blockInfo));
                if (!sequence.length) {
                    log('bumper', 'no cards for block, handing off directly');
                    return;
                }

                log('bumper', 'starting for block ' + (blockInfo ? blockInfo.id : '?'));
                overlay.classList.remove('hidden', 'fading-out');
                overlay.style.transition = '';
                card.style.display = '';
                card.src = sequence[0];

                // Swap the live studio to the incoming block NOW, while the
                // bumper overlay is still fully opaque and covering the
                // frame. Without this, the overlay fades out over the
                // previous block's set (e.g. main_desk), the viewer sees a
                // split second of the old studio, and only then does
                // beginColdOpen() -> GNNRenderer.setShowBlock() swap to the
                // correct one. Doing the swap here means the fade reveals
                // the right set, anchors and backdrop in one frame.
                //
                // beginColdOpen() will call setShowBlock() again with the
                // same index later; that is harmless and idempotent.
                if (blockInfo && typeof GNNRenderer !== 'undefined'
                    && GNNRenderer.setShowBlock) {
                    GNNRenderer.setShowBlock(blockInfo.blockIndex);
                }

                try {
                    const beds = GNNAssets.musicTracks().filter((t) => t.id !== BOOT_TRACK);
                    if (beds.length) {
                        const interludeTrack = beds[(Math.random() * beds.length) | 0];
                        GNNAudio.playMusic(interludeTrack.id,
                            { gain: 0.6, loop: true, fadeIn: 0.4 });
                        log('bumper', 'interlude track ' + interludeTrack.id);
                    }
                } catch (err) {
                    log('bumper', 'interlude track failed', err && err.message ? err.message : err);
                }

                // Track every scheduled swap so error recovery cannot let a
                // stale previous show's timer replace the next show's card.
                const swapMs = BUMPER_MS * BUMPER_CARD_SWAP_AT;
                for (let i = 1; i < sequence.length; i++) {
                    const delay = swapMs * i;
                    if (delay < 200) continue;
                    const timer = setTimeout(() => {
                        if (card) card.src = sequence[i];
                        log('bumper', 'card -> ' + sequence[i]
                            + ' at ' + (delay / 1000).toFixed(1) + 's');
                    }, delay);
                    swapTimers.push(timer);
                }

                await new Promise((r) => setTimeout(r, BUMPER_MS - BUMPER_FADE_MS));
                overlay.style.transition = `opacity ${BUMPER_FADE_MS}ms ease`;
                overlay.classList.add('fading-out');
                if (GNNAudio.stopMusic) GNNAudio.stopMusic(BUMPER_FADE_MS / 1000);
                await new Promise((r) => setTimeout(r, BUMPER_FADE_MS));
                overlay.classList.add('hidden');
                overlay.classList.remove('fading-out');
                overlay.style.transition = '';

                // Exactly one cold-open handoff for this incoming block.
                if (GNNDirector.handoffColdOpen) GNNDirector.handoffColdOpen();
                if (GNNDirector.resume) GNNDirector.resume();
                handoffDone = true;
                log('bumper', 'complete, director resumed for block ' + (blockInfo ? blockInfo.id : '?'));
            } catch (err) {
                log('bumper', 'failed; releasing director', err && err.message ? err.message : err);
            } finally {
                swapTimers.forEach((timer) => clearTimeout(timer));
                if (!handoffDone) {
                    // No exception/card failure may leave the director paused
                    // or leave a stale show card sitting over live video.
                    const overlay = $('boot-overlay');
                    if (overlay) {
                        overlay.classList.add('hidden');
                        overlay.classList.remove('fading-out');
                        overlay.style.transition = '';
                    }
                    try { if (GNNDirector.handoffColdOpen) GNNDirector.handoffColdOpen(); } catch (_) { }
                    try { if (GNNDirector.resume) GNNDirector.resume(); } catch (_) { }
                }
                bumperRunning = false;
                bumperPromise = null;
            }
        })();
        return bumperPromise;
    }

    /**
     * The boot failed. Release whatever can be released and get out of
     * the way of the operator.
     *
     * Two things the old version of this handler did not do:
     *
     *   1. It did not hide the boot overlay. A failure inside
     *      `runBootSequence()` after the title card was shown but before
     *      the fade left a static image up forever.
     *
     *   2. It did not release the director. `window.GNNBootReady` was only
     *      set on the success path, so the director's S.BOOT case sat on
     *      that flag and never advanced.
     *
     * `startLoop()` is idempotent, so calling it here is a no-op if the
     * try block already started it.
     */
    function handleBootFailure(err) {
        bootError = true;
        console.error('[GNN] initialization failed:', err);
        log('boot', 'FAILED', err && err.message ? err.message : String(err));
        statusText.textContent = 'Error loading assets — see console';
        statusDot.className = 'error';

        const overlay = $('boot-overlay');
        if (overlay) overlay.classList.add('hidden');

        window.GNNBootReady = true;

        if (iconPlay) iconPlay.classList.add('hidden');
        if (iconPause) iconPause.classList.remove('hidden');

        startLoop();
        try { GNNFeedManager.start(); }
        catch (feedErr) { console.error('[GNN] feed start failed:', feedErr); }
    }

    async function init() {
        watchPointerIdle();
        wireSettingsKey();

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

            if (assets.deskVoice) GNNTTS.setVoice(assets.deskVoice);

            wireModules();
            wireUI();

            const ctx = GNNRenderer.getContext();
            if (ctx) GNNTickerManager.rebuild(ctx, []);

            startLoop();

            GNNFeedManager.start();

            // The director's between-show bumper hook. This is what the
            // director reads (if patched) — see the note at the bottom
            // of this file. When the director doesn't read it, the
            // bumper never fires and shows just cut straight to the next
            // one, which is the previous behaviour.
            if (typeof GNNDirector !== 'undefined') {
                GNNDirector.onBeforeColdOpen = playShowBumper;
            }
            // Also expose it globally, so a console session can trigger
            // it manually for testing:
            //     window.GNNBumper.play()
            window.GNNBumper = { play: playShowBumper, isRunning: () => bumperRunning };

            await runBootSequence();

            log('boot', 'on air',
                'voice=' + GNNTTS.getVoice(),
                'engine=' + (GNNTTS.getEngine() || 'unknown'));

            iconPlay.classList.add('hidden');
            iconPause.classList.remove('hidden');
        } catch (err) {
            handleBootFailure(err);
        }
    }

    init();
})();