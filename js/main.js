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

        // In parallel: fifty sequential awaits is fifty serial round trips.
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
        return { bg, anchors: anchors.filter(Boolean), globes: globes.filter(Boolean) };
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

        if (telemetry) {
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
            if (!text) return;
            // Spots keep their stings closer to the voice than a news read
            // does — a commercial that ducks its own effects to -10dB stops
            // sounding like a commercial.
            const opts = shot.beat.kind === 'legal'
                ? { rate: 38, pitch: -4, duck: 0.5, duckSfx: 0.55 }
                : { rate: shot.beat.kind === 'tag' ? -12 : 0, pitch: -6,
                    duck: 0.45, duckSfx: 0.55 };
            GNNTTS.speak(text, opts);
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

    async function init() {
        try {
            try {
                if (document.fonts && document.fonts.load) {
                    await document.fonts.load('16px "Press Start 2P"');
                }
            } catch (fontErr) {
                console.warn('[GNN] font load warning:', fontErr);
            }

            const assets = await loadAllAssets();
            GNNRenderer.init(canvas, assets);

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
