/* ============================================================
   GNN — Glitch Engine (anomalies + easter eggs)
   ------------------------------------------------------------
   A station that has been on air for a few centuries does not
   run clean. This module schedules faults and hides secrets.

   Anomalies are real signal failures, not decoration: they take
   over the anchor's 25-frame lip matrix, run the 25-frame globe
   backwards or stall it on a single cel, bit-crush the whole
   audio bus, drag the music like a dying tape transport, and
   punch single frames of otherwise-unused artwork into the
   composite for two frames at a time.

   Easter eggs are undocumented on purpose. The short version:
   the globe rewards persistence, the anchor's eye rewards
   curiosity, the keyboard remembers 1986, and the top of the
   hour always sounds different.
   ============================================================ */

const GNNGlitch = (() => {
    'use strict';

    // ---------------------------------------------------------
    // Anomaly catalogue
    // ---------------------------------------------------------

    const ANOMALIES = {
        carrier_drop: {
            weight: 14, ms: [700, 1500],
            enter(ms) {
                GNNAudio.glitchCrush(4, ms);
                GNNAudio.playRole('zap', { gain: 0.5, rate: 0.6 });
                GNNTTS.nudgePlaybackRate(0.82);
            },
            exit() { GNNTTS.nudgePlaybackRate(1); },
            video: (t) => ({ roll: Math.sin(t * 0.05) * 26, tear: 0.9, desat: 0.55 }),
        },
        lipsync_desync: {
            weight: 12, ms: [2600, 5200],
            enter() { anchorMode = 'desync'; GNNAudio.playRole('servo', { gain: 0.3, rate: 0.7 }); },
            exit() { anchorMode = null; },
            video: () => ({ jitter: 1 }),
        },
        globe_reverse: {
            weight: 12, ms: [3000, 7000],
            enter() { globeMode = Math.random() < 0.4 ? 'stall' : (Math.random() < 0.5 ? 'reverse' : 'strobe'); },
            exit() { globeMode = null; },
            video: () => ({}),
        },
        palette_burn: {
            weight: 10, ms: [420, 1100],
            enter() { GNNAudio.playRole('sweep', { gain: 0.4, rate: 1.4 }); },
            exit() {},
            video: (t) => ({ invert: Math.sin(t * 0.02) > 0 ? 0.85 : 0.2, shift: 6 }),
        },
        tape_stop: {
            weight: 8, ms: [1100, 1900],
            enter(ms) { GNNAudio.tapeStop(ms * 0.6); GNNTTS.nudgePlaybackRate(0.7); },
            exit() { GNNTTS.nudgePlaybackRate(1); },
            video: (t) => ({ roll: t * 0.02, desat: 0.7 }),
        },
        ghost_signal: {
            weight: 14, ms: [260, 700],
            enter() {
                // Prefer the chromatically scrambled items: they are useless as
                // footage and perfect as interference.
                ghost = GNNAssets.pick({ minW: 120, minCoverage: 0.4 })
                    || GNNAssets.pick({ minW: 40 });
                const scrambled = GNNAssets.find({ minW: 200, minCoverage: 0.5 })
                    .filter((e) => e.noise > 95);
                if (scrambled.length && Math.random() < 0.7) {
                    ghost = scrambled[(Math.random() * scrambled.length) | 0];
                }
                if (ghost) GNNAssets.loadImage(GNNAssets.heroPath(ghost));
                GNNAudio.playRole(['chirp', 'zap', 'beep'][(Math.random() * 3) | 0],
                    { gain: 0.45, rate: 1.6 });
            },
            exit() { ghost = null; },
            video: () => ({ tear: 0.5 }),
        },
        interference: {
            weight: 10, ms: [500, 1400],
            enter(ms) {
                const scrambled = GNNAssets.find({ minW: 200, minCoverage: 0.4 })
                    .filter((e) => e.noise > 95);
                ghost = scrambled.length
                    ? scrambled[(Math.random() * scrambled.length) | 0]
                    : GNNAssets.pick({ roles: ['fullscreen'] });
                if (ghost) GNNAssets.loadImage(GNNAssets.heroPath(ghost));
                GNNAudio.glitchCrush(5, ms);
                GNNAudio.playRole('rumble', { gain: 0.4, rate: 1.7 });
            },
            exit() { ghost = null; },
            video: (t) => ({ tear: 0.7, shift: 5, roll: Math.sin(t * 0.03) * 12 }),
        },
        vertical_hold: {
            weight: 9, ms: [900, 2200],
            enter() { GNNAudio.playRole('rumble', { gain: 0.35, rate: 0.8 }); },
            exit() {},
            video: (t) => ({ roll: (t * 0.14) % 620, tear: 0.25 }),
        },
        eye_flicker: {
            weight: 11, ms: [900, 1800],
            enter() { anchorMode = 'flicker'; GNNTTS.setPitch(-24); },
            exit() { anchorMode = null; GNNTTS.setPitch(-10); },
            video: () => ({ eye: true }),
        },
    };

    // ---------------------------------------------------------
    // State
    // ---------------------------------------------------------

    let active = null;
    let activeSince = 0;
    let activeUntil = 0;
    let nextAt = 0;
    let anchorMode = null;
    let globeMode = null;
    let ghost = null;

    let breakingUntil = 0;
    let orionMode = false;
    let orionUntil = 0;
    let lastInteraction = 0;
    let idleAnnounced = false;
    let lastHourChime = -1;

    // Expected ghost signals per second of airtime.
    const GHOST_PER_SECOND = 0.0072;
    let lastTick = 0;

    let globeClicks = 0;
    let globeClickAt = 0;
    let eyeClicks = 0;
    let keyBuffer = [];

    const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft',
        'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

    // Between-anomaly spacing. Long enough that they land as faults,
    // not as a visual effect the viewer starts expecting.
    const QUIET = [95000, 220000];

    let discovered = new Set();
    let onSecret = null;

    function rand(r) { return r[0] + Math.random() * (r[1] - r[0]); }

    function schedule(now) { nextAt = now + rand(QUIET); }

    function weightedPick() {
        const keys = Object.keys(ANOMALIES);
        let total = 0;
        for (const k of keys) total += ANOMALIES[k].weight;
        let roll = Math.random() * total;
        for (const k of keys) {
            roll -= ANOMALIES[k].weight;
            if (roll <= 0) return k;
        }
        return keys[0];
    }

    function fire(name, now) {
        if (active) end(now);
        const a = ANOMALIES[name];
        if (!a) return;
        active = name;
        activeSince = now;
        const ms = rand(a.ms);
        activeUntil = now + ms;
        // Hand the anomaly its own rolled duration so the audio effect ends
        // with the picture instead of on a hardcoded timer of its own.
        try { a.enter(ms); } catch (_) {}
    }

    function end(now) {
        const a = ANOMALIES[active];
        if (a) { try { a.exit(); } catch (_) {} }
        active = null;
        schedule(now);
    }

    // ---------------------------------------------------------
    // Easter eggs
    // ---------------------------------------------------------

    function reveal(id, line, opts = {}) {
        if (discovered.has(id) && !opts.repeatable) return false;
        discovered.add(id);
        if (onSecret) onSecret(id, line);
        return true;
    }

    function enterOrionMode(now) {
        orionMode = true;
        orionUntil = now + 46000;
        GNNTTS.setPitch(-32);
        GNNTTS.setRate(-16);
        GNNAudio.playRole('alarm', { gain: 0.6 });
        const beds = GNNAssets.musicTracks();
        if (beds.length) GNNAudio.playMusic(beds[(Math.random() * beds.length) | 0].id, { gain: 0.7 });
        GNNTextEngine.present(
            'GUARDIAN PROTOCOL ENGAGED. THIS UNIT IS NO LONGER READING FROM THE RUNDOWN.',
            { kind: 'breaking', cue: '◆ ORION MODE ◆', chyron: 'UNAUTHORISED TRANSMISSION' });
        GNNDirector.injectBreaking(
            'ORION SIGNAL DETECTED ON THE GNN CARRIER',
            'An unregistered transmission has taken the studio uplink. Station control is attempting to regain the channel.');
    }

    function exitOrionMode() {
        orionMode = false;
        GNNTTS.setPitch(-10);
        GNNTTS.setRate(-5);
        GNNAudio.stopMusic(1.5);
    }

    /** Canvas click routing — the globe and the anchor's eye are live. */
    function handleCanvasClick(px, py, view) {
        lastInteraction = performance.now();
        idleAnnounced = false;
        const now = performance.now();

        // Globe: 25-frame hologram over the left shoulder.
        if (px > 210 && px < 400 && py > 90 && py < 250) {
            if (now - globeClickAt > 2400) globeClicks = 0;
            globeClickAt = now;
            globeClicks++;
            GNNAudio.playRole('blip', { gain: 0.4, rate: 1 + globeClicks * 0.12 });
            if (globeClicks >= 5) {
                globeClicks = 0;
                globeMode = 'overspin';
                setTimeout(() => { if (globeMode === 'overspin') globeMode = null; }, 6000);
                GNNAudio.playRole('sweep', { gain: 0.55 });
                reveal('globe_overspin',
                    'HOLOGRAPHIC ARMATURE OVERSPIN. PLEASE DO NOT DO THAT AGAIN.',
                    { repeatable: true });
            }
            return true;
        }

        // Anchor optics: the three red lenses on the faceplate.
        if (px > 430 && px < 560 && py > 120 && py < 210) {
            eyeClicks++;
            GNNAudio.playRole('chirp', { gain: 0.45, rate: 1.3 });
            fire('eye_flicker', now);
            if (eyeClicks === 3) {
                reveal('optics',
                    'I HAVE BEEN READING THE NEWS FOR NINE HUNDRED AND FORTY YEARS. I AM NOT TIRED. I AM NOT ANYTHING.');
            }
            return true;
        }
        return false;
    }

    function handleKey(e) {
        lastInteraction = performance.now();
        idleAnnounced = false;
        keyBuffer.push(e.key);
        if (keyBuffer.length > 24) keyBuffer.shift();

        const tail = keyBuffer.slice(-KONAMI.length).join(',').toLowerCase();
        if (tail === KONAMI.join(',').toLowerCase()) {
            keyBuffer = [];
            enterOrionMode(performance.now());
            return;
        }
        const typed = keyBuffer.slice(-8).join('').toLowerCase();
        if (typed.endsWith('gnn')) {
            if (reveal('callsign', 'CALLSIGN ACCEPTED. YOU ARE CLEARED FOR THE STAFF CHANNEL.')) {
                GNNAudio.playRole('chirp', { gain: 0.5 });
                GNNDirector.injectBreaking(
                    'STAFF CHANNEL OPEN — GNN INTERNAL',
                    'Studio note: the anchor unit has again requested a window. Request denied. Request logged. Request number four thousand and six.');
            }
        }
        if (typed.endsWith('orion')) {
            enterOrionMode(performance.now());
        }
        if (typed.endsWith('1993')) {
            if (reveal('founding', 'ARCHIVE YEAR ACKNOWLEDGED. PLAYING FOUNDING TRANSMISSION.')) {
                const beds = GNNAssets.musicTracks();
                if (beds.length) GNNAudio.playMusic(beds[9 % beds.length].id, { gain: 0.7, loop: false });
            }
        }
    }

    // ---------------------------------------------------------
    // Tick
    // ---------------------------------------------------------

    function update(now) {
        if (!nextAt) { schedule(now); lastInteraction = now; }

        if (active && now >= activeUntil) end(now);
        else if (!active && now >= nextAt) fire(weightedPick(), now);

        if (orionMode && now >= orionUntil) exitOrionMode();

        // Top of the hour: the station always marks it.
        const hour = new Date().getHours();
        const mins = new Date().getMinutes();
        if (mins === 0 && hour !== lastHourChime) {
            lastHourChime = hour;
            GNNAudio.play('intro_sfx_01', { gain: 0.5 });
            GNNAudio.playRole('chirp', { gain: 0.4, delay: 0.5 });
            reveal('hourly', `TOP OF THE HOUR. ${String(hour).padStart(2, '0')}00 SECTOR STANDARD.`,
                { repeatable: true });
        }

        // Nobody there? The anchor notices.
        if (!idleAnnounced && now - lastInteraction > 420000) {
            idleAnnounced = true;
            reveal('idle', 'IS ANYONE STILL RECEIVING THIS? THE RUNDOWN CONTINUES EITHER WAY.',
                { repeatable: true });
        }

        // Rare single-frame subliminal drawn from the unused library. Rolled
        // against elapsed time, not per frame: a per-tick probability makes
        // the fault two and a half times more frequent on a 144Hz monitor
        // than on a 60Hz one.
        const dt = lastTick ? Math.min(250, now - lastTick) : 0;
        lastTick = now;
        if (!active && dt && Math.random() < GHOST_PER_SECOND * dt / 1000) {
            fire('ghost_signal', now);
        }
    }

    function flagBreaking(now) { breakingUntil = now + 9000; }

    // ---------------------------------------------------------
    // Hooks used by the animator + renderer
    // ---------------------------------------------------------

    /** Remap the anchor's mouth frame during a fault. */
    function anchorOverride(baseFrame, now) {
        if (orionMode) return (Math.floor(now / 60) % 25);
        switch (anchorMode) {
            case 'desync':
                // Mouth runs on its own broken clock, out of step with the voice.
                return (Math.floor(now / 210) * 7) % 25;
            case 'flicker':
                return Math.floor(now / 45) % 2 ? 0 : (baseFrame || 3);
            default:
                return null;
        }
    }

    /** Bend the globe's 25-cel rotation. */
    function globeOverride(baseFrame, now) {
        switch (globeMode) {
            case 'reverse': return (25 - (baseFrame % 25)) % 25;
            case 'stall': return 11;
            case 'strobe': return Math.floor(now / 55) % 2 ? 0 : 17;
            case 'overspin': return Math.floor(now / 22) % 25;
            default: return orionMode ? (24 - baseFrame % 25) : null;
        }
    }

    function videoState(now) {
        const out = { roll: 0, tear: 0, desat: 0, invert: 0, shift: 0, jitter: 0, eye: false };
        if (active && ANOMALIES[active].video) {
            // Elapsed since the fault began. The old expression measured time
            // until it *ends*, so each instance's phase was randomised by its
            // own duration.
            Object.assign(out, ANOMALIES[active].video(now - activeSince) || {});
        }
        if (orionMode) { out.desat = Math.max(out.desat, 0.3); out.shift = Math.max(out.shift, 3); }
        return out;
    }

    function isBreaking(now) { return now < breakingUntil; }
    function ghostAsset() { return ghost ? GNNAssets.cached(GNNAssets.heroPath(ghost)) : null; }

    return {
        update, handleCanvasClick, handleKey, flagBreaking,
        anchorOverride, globeOverride, videoState, isBreaking, ghostAsset,
        fire,
        isActive: () => !!active,
        activeName: () => active,
        isOrionMode: () => orionMode,
        discoveredCount: () => discovered.size,
        totalSecrets: () => 6,
        set onSecret(fn) { onSecret = fn; },
    };
})();
