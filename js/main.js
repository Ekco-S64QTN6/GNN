/* ============================================================
   GNN — Bootstrap & Control Room
   ------------------------------------------------------------
   Loads the asset manifests, preloads the newsroom plates,
   wires the modules to each other and runs the frame loop.
   ============================================================ */

(function () {
    'use strict';

    const ASSET_DIR = 'assets';
    const TOTAL_FRAMES = 25;
    const RENDER_FPS = 20;
    const FRAME_MS = 1000 / RENDER_FPS;

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
        const bg = await GNNAssets.loadImage(`${ASSET_DIR}/background_tv.png`);

        // The generated newsroom, if it has been made. All optional: the
        // station still goes to air on the MOO1 scene alone, so a missing
        // plate is a look rather than a failure.
        const GEN = `${ASSET_DIR}/generated`;
        const [set, desk] = await Promise.all([
            GNNAssets.loadImage(`${GEN}/set/studio_wide_empty.png`),
            GNNAssets.loadImage(`${GEN}/set/desk_oval_front.png`),
        ]);

        // Two at the desk. Three looked like a panel show, and with the
        // over-the-shoulder box in the corner the third was half hidden
        // behind it anyway.
        //
        // Each seat carries its own voice, because the anchor is a
        // character rather than a sprite: one speech model reading for a
        // bear, a cat and a grey alien is the same person wearing masks.
        // The line-up turns over through the day so there is a morning desk
        // and a night desk, and rotating by block rather than at random
        // means a given hour always shows the same team.
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
            { sid: 'klackon', voice: 'af_heart' },
        ];
        // The main desk is fixed: the human commander reads and the Mrrshan
        // matriarch sits beside him. Rotating the whole roster by the hour
        // put two of whoever came next in the list at the desk, which is not
        // a newsroom — a channel has anchors, and the rest of the cast are
        // correspondents who appear elsewhere. The rotation is kept for the
        // show-block work in docs/ROADMAP.md, which is where it belongs.
        const lineup = [ROSTER[0], ROSTER[1]];
        const seated = (await Promise.all(lineup.map(async (who) => {
            const [hero, speaking, listening] = await Promise.all([
                GNNAssets.loadImage(`${GEN}/anchors/${who.sid}_desk_hero.png`),
                GNNAssets.loadImage(`${GEN}/anchors/${who.sid}_speaking.png`),
                GNNAssets.loadImage(`${GEN}/anchors/${who.sid}_listening.png`),
            ]);
            return hero ? { sid: who.sid, voice: who.voice, hero,
                            speaking: speaking || hero,
                            listening: listening || hero } : null;
        }))).filter(Boolean);

        // The MOO1 newscast cels. Still loaded: they are the fallback when
        // the generated set is absent, and the globe plays on the studio
        // monitor either way.
        const nums = [];
        for (let i = 1; i <= TOTAL_FRAMES; i++) nums.push(String(i).padStart(3, '0'));
        const [anchors, globes] = await Promise.all([
            Promise.all(nums.map((n) => GNNAssets.loadImage(`${ASSET_DIR}/anchor_frame_${n}.png`))),
            Promise.all(nums.map((n) => GNNAssets.loadImage(`${ASSET_DIR}/globe_frame_${n}.png`))),
        ]);

        await GNNIconManager.loadIcons(`${ASSET_DIR}/icons`);

        const s = GNNAssets.stats();
        if (assetReadout) {
            assetReadout.textContent =
                `${s.items} graphics items · ${s.frames} frames · ${s.dirs} archives · ` +
                `${s.sfx} effects · ${s.music} music beds · ${s.bulletins} archive bulletins`;
        }
        statusText.textContent = 'Studio ready';
        return {
            bg, set, desk, seated,
            deskVoice: seated.length ? seated[0].voice : null,
            anchors: anchors.filter(Boolean),
            globes: globes.filter(Boolean),
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
            ? (story.icon || GNNIconManager.matchIcon(story.title, story.description))
            : GNNIconManager.getIconByLabel('STATUS');

        GNNRenderer.renderFrame(now, frames, icon);

        if (telemetry && document.body.classList.contains('show-telemetry')) {
            const r = GNNDirector.report();
            telemetry.textContent =
                `SEG ${r.state} · RUNDOWN ${r.queued} · READ ${r.storiesRead} · ` +
                `BREAK IN ${Math.max(0, r.nextBreakAt - r.sinceBreak)} · ` +
                `VOICE ${r.speaking ? 'ON' : 'OFF'} · ` +
                `PROMPT ${Math.round(GNNTextEngine.progress() * 100)}%/${GNNTextEngine.getText().length}c · ` +
                `FX ${GNNGlitch.activeName() || '—'} · F${frameCount}@${(now/1000).toFixed(0)}s`;
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
        GNNTTS.onStart = () => GNNAnimator.setSpeaking(true);
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
            GNNTextEngine.present(line, {
                kind: 'wire', cue: '◆ UNLISTED TRANSMISSION', durationMs: 3200,
            });
            GNNTTS.speak(line, { pitch: -26, rate: -12 });
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

    async function init() {
        watchPointerIdle();
        wireSettingsKey();
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
                console.log('[GNN] voice engine: %s (%s)', catalogue.engine,
                    catalogue.cloud ? 'cloud' : 'local');
            }

            const assets = await loadAllAssets();
            GNNRenderer.init(canvas, assets);

            // The anchor in the first seat reads, so the station speaks with
            // that character's voice rather than whatever the catalogue
            // happened to list first.
            if (assets.deskVoice) GNNTTS.setVoice(assets.deskVoice);

            wireModules();
            wireUI();

            const ctx = GNNRenderer.getContext();
            if (ctx) GNNTickerManager.rebuild(ctx, []);

            GNNFeedManager.start();
            requestAnimationFrame(gameLoop);

            iconPlay.classList.add('hidden');
            iconPause.classList.remove('hidden');
        } catch (err) {
            bootError = true;
            console.error('[GNN] initialization failed:', err);
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
