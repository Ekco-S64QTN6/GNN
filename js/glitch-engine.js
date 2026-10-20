/* ============================================================
   GNN — Glitch Engine (anomalies + easter eggs)
   ------------------------------------------------------------
   A station that has been on air for a few centuries does not
   run clean. This module schedules faults and hides secrets.

   Anomalies are real signal failures, not decoration: they take
   over the anchor's lip matrix, bit-crush the whole audio bus,
   drag the music like a dying tape transport, drop the picture
   to colour bars or the station's own test card, macroblock it,
   freeze it, split its guns out of convergence, and let other
   channels bleed through the carrier — the shopping channel, the
   archive, and footage nobody at GNN admits to filming.

   Repetition is the enemy. Twenty-one faults rotate, none can
   follow itself within four, and rarer events sit on a clock of
   their own so they stay rare.

   Easter eggs are undocumented on purpose. The short version:
   the monitor rewards persistence, the anchors reward
   curiosity, the keyboard remembers 1986 and knows every
   species by name, and some minutes of the day sound different.
   ============================================================ */

const GNNGlitch = (() => {
    'use strict';

    // ---------------------------------------------------------
    // Assets the faults borrow
    // ---------------------------------------------------------

    const CINE = 'assets/cutscenes/moo2_video/';
    const TEST_CARDS = [
        'assets/generated/titlecards/test_card.png',
        'assets/generated/titlecards/test_card_02.png',
    ];
    const SHOP_STILLS = [
        'assets/generated/products/klackon_amber_brooch.png',
        'assets/generated/products/tachyon_deflector_coil.png',
        'assets/generated/products/silicoid_exfoliating_balm.png',
        'assets/generated/products/alkari_preen_serum.png',
        'assets/generated/products/luxury_chronowatch.png',
        'assets/generated/products/space_yacht_model.png',
        'assets/generated/products/tachyon_energy_cell.png',
        'assets/generated/logos/galaxy_shop.png',
    ];
    // Footage a fault can bleed through, by mood. Ranges are the clean
    // stretches already vetted for cutaways in cutscene-manager.js —
    // never past frame 648 of the intro, where the game's title logo is.
    const BLEED_CLIPS = {
        dread: [['anatkfin', 27, 66], ['plntdfin', 55, 106], ['anwinfin', 106, 159]],
        strange: [['amebafin', 3, 87], ['dimtvfin', 8, 50]],
        fleet: [['intro', 404, 470], ['intro', 572, 645], ['dimtvfin', 128, 172]],
        place: [['orionfin', 3, 86], ['wininfin', 3, 150], ['loserfin', 30, 190]],
    };

    const loaded = new Map();
    function img(url) {
        if (!url || typeof GNNAssets === 'undefined') return null;
        if (!loaded.has(url)) {
            loaded.set(url, null);
            GNNAssets.loadImage(url).then((im) => loaded.set(url, im));
        }
        return loaded.get(url);
    }

    /**
     * A run of cinematic frames, loaded as they arrive.
     *
     * Returns slots that hold their own images rather than entries in the
     * shared `loaded` map. That map is for the dozen stills the faults
     * reuse; footage frames go in it never to leave, and over a day of
     * faults and staged clips that grows without bound. A slot array is
     * released with the fault that held it.
     */
    function clip(name, from, to, max = 40) {
        const span = to - from + 1;
        const n = Math.min(span, max);
        const start = from + ((Math.random() * (span - n + 1)) | 0);
        const slots = [];
        for (let i = 0; i < n; i++) {
            const slot = { im: null };
            slots.push(slot);
            if (typeof GNNAssets !== 'undefined') {
                GNNAssets.loadImage(CINE + name + '/frame_'
                    + String(start + i + 1).padStart(4, '0') + '.png', { cache: false })
                    .then((im) => { slot.im = im; });
            }
        }
        return slots;
    }

    function clipFrame(slots, t, fps = 7.5) {
        if (!slots || !slots.length) return null;
        const i = Math.min(slots.length - 1, Math.floor(t / 1000 * fps));
        for (let k = i; k >= 0; k--) {
            if (slots[k].im) return slots[k].im;
        }
        return null;
    }

    function pick(list) { return list[(Math.random() * list.length) | 0]; }

    // Bleed footage is picked and loaded *ahead* of the fault that uses it.
    // Loading on fire meant the frames arrived after a three-second fault
    // had already ended, and both cross-talk faults were invisible on air.
    // Ordinary cross-talk lasts about three seconds, so 24 frames covers
    // it; the rare events run longer and are staged only when one is due.
    const MOOD_MAX = { dread: 40, strange: 40, fleet: 24, place: 24 };
    const staged = {};
    function stage(mood) {
        const c = pick(BLEED_CLIPS[mood]);
        staged[mood] = clip(c[0], c[1], c[2], MOOD_MAX[mood]);
    }
    function moodClip(mood) {
        if (!staged[mood]) stage(mood);
        const urls = staged[mood];
        stage(mood);          // the next one starts loading now
        return urls;
    }

    let warmed = false;
    function warm() {
        warmed = true;
        SHOP_STILLS.forEach(img);
        TEST_CARDS.forEach(img);
        stage('fleet');
        stage('place');
    }

    // Per-fault state set in enter() and read in video().
    let bleedUrls = null;
    // A clip chosen by whoever fired the fault (an easter egg), used once
    // in place of the fault's own random pick.
    let presetBleed = null;
    let bleedStill = null;
    let cardStill = null;
    let cardText = null;
    let cardSub = null;

    function audio(fn) {
        if (typeof GNNAudio === 'undefined') return;
        try { fn(GNNAudio); } catch (_) { /* a fault must never take the station down */ }
    }

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
                // Both of these query a pool. Asking the catalogue without
                // one reaches past admission entirely and brought up the
                // galaxy setup screen — Size, Difficulty, Opponents and two
                // buttons — as a ghost signal.
                //
                // `glitch` holds the chromatically scrambled items, which
                // are useless as footage and perfect as interference.
                // The ghost is drawn outside the studio window on the
                // backdrop layer behind the hosts.
                ghost = GNNAssets.pick({ pool: 'glitch' })
                    || GNNAssets.pick({ pool: 'broll', minW: 120 });
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
                ghost = GNNAssets.pick({ pool: 'glitch' })
                    || GNNAssets.pick({ pool: 'broll', minW: 200 });
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

        // --- added: the picture -----------------------------------------

        // No signal at all for a moment: the receiver's own snow.
        signal_snow: {
            weight: 10, ms: [500, 1300],
            enter(ms) { audio((a) => a.playStatic(ms, { gain: 0.14 })); },
            exit() {},
            video: (t) => ({ snow: 0.55 + Math.sin(t * 0.03) * 0.25, desat: 0.5, jitter: 1 }),
        },
        // A digital decoder starved of data, rebuilding the frame from
        // blocks that get coarser and then recover.
        macroblock: {
            weight: 9, ms: [600, 1500],
            enter(ms) { audio((a) => a.glitchCrush(6, ms)); },
            exit() {},
            video: (t) => ({ pixel: 6 + Math.abs(Math.sin(t * 0.006)) * 22, jitter: 1 }),
        },
        // The red and blue guns drift out of convergence.
        rgb_split: {
            weight: 8, ms: [700, 1800],
            enter() { audio((a) => a.playRole('sweep', { gain: 0.25, rate: 0.7 })); },
            exit() {},
            video: (t) => ({ split: 3 + Math.abs(Math.sin(t * 0.008)) * 9, tear: 0.15 }),
        },
        // The tube breathing: a slow swell of the raster.
        tube_breath: {
            weight: 6, ms: [1600, 3200],
            enter() { audio((a) => a.playRole('drone', { gain: 0.25, rate: 0.6 })); },
            exit() {},
            video: (t) => ({ zoom: 1 + Math.abs(Math.sin(t * 0.0035)) * 0.05, band: 0.6 }),
        },
        // Mains hum: a bright bar crawling up the picture.
        hum_bar: {
            weight: 7, ms: [2200, 4200],
            enter() { audio((a) => a.playTone(60, 900, { gain: 0.05, type: 'sawtooth' })); },
            exit() {},
            video: (t) => ({ band: 1, roll: Math.sin(t * 0.004) * 4 }),
        },
        // The picture flips. Nobody at the station can explain it.
        mirror_flip: {
            weight: 5, ms: [600, 1400],
            enter() { audio((a) => a.playRole('zap', { gain: 0.35, rate: 1.2 })); },
            exit() {},
            video: () => ({ mirror: true, shift: 2 }),
        },
        // Frame store failure: the picture holds while the sound goes on.
        frame_freeze: {
            weight: 6, ms: [800, 1700],
            enter(ms) { audio((a) => a.glitchCrush(3, ms)); },
            exit() {},
            video: (t) => ({ freeze: true, desat: 0.25, tear: t > 600 ? 0.4 : 0 }),
        },
        // A handful of black frames, like a bad edit at master control.
        black_frames: {
            weight: 4, ms: [350, 900],
            enter() { audio((a) => a.playRole('thud', { gain: 0.3 })); },
            exit() {},
            video: (t) => ({ black: Math.floor(t / 70) % 3 ? 1 : 0 }),
        },

        // --- added: the station falls back to its cards -------------------

        color_bars: {
            weight: 4, ms: [1200, 2600],
            enter(ms) { audio((a) => a.playTone(1000, ms, { gain: 0.09 })); },
            exit() {},
            video: () => ({ card: 'bars', cardText: cardText || 'LINE-UP  1 kHz  -18 dBFS' }),
        },
        test_card: {
            weight: 4, ms: [1400, 3000],
            enter(ms) {
                cardStill = pick(TEST_CARDS);
                img(cardStill);
                audio((a) => a.playTone(440, ms, { gain: 0.07 }));
            },
            exit() { cardStill = null; },
            video: () => {
                const im = loaded.get(cardStill);
                return im ? { card: 'image', cardImage: im, cardText }
                    : { card: 'bars', cardText: 'TEST CARD' };
            },
        },
        stand_by: {
            weight: 3, ms: [1600, 3000],
            enter(ms) { audio((a) => a.tapeStop(ms * 0.5)); },
            exit() { cardText = null; cardSub = null; },
            video: () => ({ freeze: true, card: 'standby', cardText, cardSub }),
        },

        // --- added: other channels bleed through ---------------------------

        // Cross-talk from the shopping channel two frequencies over.
        crosstalk_shop: {
            weight: 5, ms: [900, 2000],
            enter() {
                bleedStill = pick(SHOP_STILLS);
                img(bleedStill);
                audio((a) => a.playRole('chirp', { gain: 0.3, rate: 0.8 }));
            },
            exit() { bleedStill = null; },
            video: (t) => {
                const im = loaded.get(bleedStill);
                // Drawn as a solid ghost at product size, not screened over
                // the set: screened at a fifth of full strength it did not
                // show at all against a lit studio.
                return im ? { bleed: { img: im, alpha: 0.5 + Math.sin(t * 0.012) * 0.08,
                    blend: 'source-over', scale: 0.62, dx: Math.sin(t * 0.004) * 30 },
                    tear: 0.2, snow: 0.08 }
                    : { tear: 0.3 };
            },
        },
        // Somebody else's footage on the carrier — a fleet, a world, a
        // place GNN has no crew at.
        crosstalk_footage: {
            weight: 6, ms: [1400, 3200],
            enter() {
                bleedUrls = presetBleed || moodClip(Math.random() < 0.5 ? 'fleet' : 'place');
                presetBleed = null;
                audio((a) => a.playRole('drone', { gain: 0.3, rate: 0.9 }));
            },
            exit() { bleedUrls = null; },
            video: (t) => {
                const im = clipFrame(bleedUrls, t);
                // Solid, not screened. The fleet and location clips are
                // mostly dark space; screened at 30% over a lit studio
                // they added nothing visible at all.
                return im ? { bleed: { img: im, alpha: 0.42 + Math.sin(t * 0.006) * 0.1,
                    blend: 'source-over' }, roll: Math.sin(t * 0.005) * 3, tear: 0.12 }
                    : {};
            },
        },
    };

    // Events rare enough to be talked about. They are kept off the normal
    // rotation and run on a clock of their own, at most one every half
    // hour or so of airtime.
    const RARE = {
        antaran_intrusion: {
            ms: [3200, 5200],
            enter(ms) {
                bleedUrls = moodClip('dread');
                audio((a) => { a.glitchCrush(7, ms); a.playStatic(ms, { gain: 0.1, freq: 900 }); });
                cardText = '◆ UNIDENTIFIED CARRIER ◆';
                // The Antarans' own words from the game when the archive
                // has them; the station's line otherwise.
                const said = (typeof GNNScript !== 'undefined' && GNNScript.antaranLine)
                    ? GNNScript.antaranLine() : null;
                revealDuring('antaran', said ? said.toUpperCase()
                    : 'THIS FREQUENCY HAS BEEN NOTED. IT WILL BE VISITED.', 900);
            },
            exit() { bleedUrls = null; cardText = null; },
            video: (t) => {
                const im = clipFrame(bleedUrls, t);
                return {
                    bleed: im ? { img: im, alpha: 0.78, blend: 'source-over', tint: '#5a1aa8', tintAlpha: 0.4 } : null,
                    split: 4, tear: 0.45, jitter: 1, strap: cardText,
                };
            },
        },
        specimen_footage: {
            ms: [3000, 4800],
            enter() {
                bleedUrls = moodClip('strange');
                audio((a) => a.playRole('drone', { gain: 0.45, rate: 0.5 }));
                revealDuring('specimen', 'PLEASE DO NOT FEED THE SPECIMEN. IT HAS BEEN FED.', 900);
            },
            exit() { bleedUrls = null; },
            video: (t) => {
                const im = clipFrame(bleedUrls, t);
                return { bleed: im ? { img: im, alpha: 0.62, blend: 'source-over', tint: '#1f8a4c', tintAlpha: 0.3 } : null, snow: 0.12 };
            },
        },
        dead_air: {
            ms: [4200, 6400],
            enter(ms) {
                audio((a) => a.playTone(1000, ms * 0.7, { gain: 0.06 }));
                cardText = pick(['TECHNICAL DIFFICULTIES', 'UPLINK LOST', 'RELAY 7 NOT RESPONDING']);
                cardSub = pick(['PLEASE STAND BY', 'DO NOT ADJUST YOUR RECEIVER', 'THE RUNDOWN WILL RESUME']);
                revealDuring('dead_air', 'APOLOGIES FOR THE INTERRUPTION. IT WAS NOT AN INTERRUPTION.', 1400);
            },
            exit() { cardText = null; cardSub = null; },
            video: () => ({ freeze: true, card: 'standby', cardText, cardSub }),
        },
    };
    const RARE_GAP = [1800000, 4200000];

    // ---------------------------------------------------------
    // State
    // ---------------------------------------------------------

    let active = null;
    let activeSince = 0;
    let activeUntil = 0;
    let nextAt = 0;
    let rareAt = 0;
    let anchorMode = null;
    let globeMode = null;
    let ghost = null;
    const recent = [];
    const NO_REPEAT = 4;

    let breakingUntil = 0;
    let orionMode = false;
    let orionUntil = 0;
    let lastInteraction = 0;
    let idleAnnounced = false;
    let lastHourChime = -1;
    let lastClockEgg = '';

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
    const QUIET = [75000, 190000];

    // Discoveries persist per viewer, so finding a secret is not undone by
    // a reload. Browser storage is the right place: it is one viewer's own
    // progress and nobody else needs it. Every access is guarded — storage
    // can be absent or throw (private windows, blocked site data).
    const SEEN_KEY = 'gnn.secretsFound';
    function loadDiscovered() {
        try {
            const raw = localStorage.getItem(SEEN_KEY);
            const arr = raw ? JSON.parse(raw) : [];
            return new Set(Array.isArray(arr) ? arr : []);
        } catch (_) { return new Set(); }
    }
    function saveDiscovered() {
        try { localStorage.setItem(SEEN_KEY, JSON.stringify([...discovered])); } catch (_) {}
    }
    let discovered = loadDiscovered();
    let onSecret = null;

    function rand(r) { return r[0] + Math.random() * (r[1] - r[0]); }

    function schedule(now) { nextAt = now + rand(QUIET); }

    // Faults that the story on air makes more likely. A storm or a solar
    // flare in the news, and the signal gets snowy; a cyber attack, and the
    // picture breaks into blocks. The weight is tripled, not forced: the
    // fault still has to come up on the station's own clock, so it reads as
    // coincidence rather than a sound effect. Matched on the real headline,
    // and nothing in-universe is said about it — the fault is the comment.
    const MOTIVES = [
        [/\b(storm|hurricane|typhoon|cyclone|tornado|flood|blizzard|lightning)\b/i,
            ['signal_snow', 'hum_bar', 'vertical_hold']],
        [/\b(solar|flare|geomagnetic|aurora|sunspot|radiation)\b/i,
            ['signal_snow', 'rgb_split', 'palette_burn']],
        [/\b(hack(ed|ers?)?|cyber|ransomware|malware|breach|outage|blackout)\b/i,
            ['macroblock', 'frame_freeze', 'interference', 'black_frames']],
        [/\b(earthquake|quake|explosion|blast|eruption|volcano)\b/i,
            ['carrier_drop', 'vertical_hold', 'tube_breath']],
        [/\b(satellite|spacecraft|rocket|launch|orbit|nasa|esa|spacex)\b/i,
            ['crosstalk_footage', 'ghost_signal']],
        [/\b(shop(ping)?|retail|sales|consumer|black friday)\b/i,
            ['crosstalk_shop']],
        [/\b(power grid|grid failure|power cut|blackouts?|outages?|brownouts?)\b/i,
            ['black_frames', 'carrier_drop', 'hum_bar']],
        [/\b(stocks? (plunge|plummet|crash|tumble)|market crash|sell-?off|recession)\b/i,
            ['frame_freeze', 'palette_burn', 'tube_breath']],
        [/\b(election|vote count|recount|ballots?|polls? close)\b/i,
            ['color_bars', 'test_card', 'stand_by']],
    ];

    function motivated() {
        const story = (typeof GNNDirector !== 'undefined' && GNNDirector.getCurrent)
            ? GNNDirector.getCurrent() : null;
        if (!story || story.lore) return null;
        const text = (story.title || '') + ' ' + (story.description || '');
        const boost = new Set();
        for (const [re, names] of MOTIVES) {
            if (re.test(text)) names.forEach((n) => boost.add(n));
        }
        return boost.size ? boost : null;
    }

    /** A weighted pick that will not repeat any of the last few faults. */
    function weightedPick() {
        const keys = Object.keys(ANOMALIES).filter((k) => recent.indexOf(k) < 0);
        const pool = keys.length ? keys : Object.keys(ANOMALIES);
        const boost = motivated();
        const fools = calendarDay(new Date()) === 'april_fools';
        const w = (k) => ANOMALIES[k].weight * (boost && boost.has(k) ? 3 : 1)
            * (fools && (k === 'crosstalk_shop' || k === 'crosstalk_footage' || k === 'mirror_flip') ? 6 : 1);
        let total = 0;
        for (const k of pool) total += w(k);
        let roll = Math.random() * total;
        for (const k of pool) {
            roll -= w(k);
            if (roll <= 0) return k;
        }
        return pool[0];
    }

    function lookup(name) { return ANOMALIES[name] || RARE[name] || null; }

    function fire(name, now, opts = {}) {
        if (active) end(now);
        const a = lookup(name);
        if (!a) return;
        active = name;
        activeSince = now;
        const ms = opts.ms || rand(a.ms);
        activeUntil = now + ms;
        recent.push(name);
        while (recent.length > NO_REPEAT) recent.shift();
        // Hand the anomaly its own rolled duration so the audio effect ends
        // with the picture instead of on a hardcoded timer of its own.
        try { a.enter(ms); } catch (_) {}
    }

    function end(now) {
        const a = lookup(active);
        if (a) { try { a.exit(); } catch (_) {} }
        active = null;
        schedule(now);
    }

    // ---------------------------------------------------------
    // Easter eggs
    // ---------------------------------------------------------

    // Every secret, so the count the settings panel shows is the count that
    // exists. It was a hardcoded 6 that nothing kept in step.
    const SECRETS = [
        'globe_overspin', 'optics', 'callsign', 'founding', 'hourly', 'idle',
        'orion', 'antaran', 'specimen', 'dead_air', 'bars', 'test_card',
        'help', 'hello', 'loknar', 'static', 'yomama', 'talent',
        'dead_hour', 'make_a_wish', 'leet',
        'halloween', 'new_year', 'april_fools', 'solstice',
        'race_human', 'race_mrrshan', 'race_silicoid', 'race_sakkra',
        'race_psilon', 'race_alkari', 'race_klackon', 'race_bulrathi',
        'race_meklar', 'race_darlok',
    ];

    // The secrets board in the settings panel: a name for each secret once
    // found, and until then a hint — enough to know there is something to
    // look for, not enough to give it away.
    const SECRET_INFO = {
        globe_overspin: ['Overspin', 'The monitor rewards persistence.'],
        optics: ['Optics', 'Look an anchor in the eye.'],
        callsign: ['Callsign', 'Say the station\u2019s name.'],
        founding: ['Founding transmission', 'Type the year it all began.'],
        hourly: ['Top of the hour', 'Be watching when the hour turns.'],
        idle: ['Still receiving?', 'Leave it running. Walk away.'],
        orion: ['Orion Mode', 'Name the ancients.'],
        antaran: ['Unidentified carrier', 'Rare. Late. Uninvited.'],
        specimen: ['The specimen', 'Rare. Do not feed it.'],
        dead_air: ['Dead air', 'Rare. Listen to the silence.'],
        bars: ['Line-up', 'Ask for the bars.'],
        test_card: ['Test card', 'Run the test.'],
        help: ['Help desk', 'Ask for it.'],
        hello: ['Hello', 'Manners cost nothing.'],
        loknar: ['Last of the Orions', 'His name is in the old game.'],
        static: ['Background of the universe', 'Type what you hear between channels.'],
        yomama: ['Not for broadcast', 'A file nobody was meant to find.'],
        talent: ['The talent', 'Keep touching the anchors.'],
        dead_hour: ['The dead hour', 'When even the night shift is asleep.'],
        make_a_wish: ['Make a wish', 'Eleven, twice.'],
        leet: ['Engineers\u2019 minute', 'A time only an engineer would pick.'],
        halloween: ['The haunted frequency', 'One night a year, the dead air is busier.'],
        new_year: ['Turn of the year', 'Be watching when the year turns over.'],
        april_fools: ['Crossed wires', 'A day when the station cannot be trusted.'],
        solstice: ['The long night', 'Twice a year the station marks the sun.'],
    };
    const RACE_NAMES = {
        human: 'Human', mrrshan: 'Mrrshan', silicoid: 'Silicoid', sakkra: 'Sakkra',
        psilon: 'Psilon', alkari: 'Alkari', klackon: 'Klackon', bulrathi: 'Bulrathi',
        meklar: 'Meklar', darlok: 'Darlok',
    };

    /** Every secret, found or not, for the settings panel. */
    function secretsBoard() {
        return SECRETS.map((id) => {
            let info = SECRET_INFO[id];
            if (!info && id.startsWith('race_')) {
                const r = RACE_NAMES[id.slice(5)] || id.slice(5);
                info = [r + ' frequency', 'Call the ' + (id.slice(5) === 'human' ? 'humans' : r) + ' by name.'];
            }
            info = info || [id, ''];
            return { id, title: info[0], hint: info[1], found: discovered.has(id) };
        });
    }

    function reveal(id, line, opts = {}) {
        if (discovered.has(id) && !opts.repeatable) return false;
        const fresh = !discovered.has(id);
        discovered.add(id);
        if (fresh) saveDiscovered();
        if (onSecret) onSecret(id, line);
        return true;
    }

    // The rare events speak, but only once the fault is underway. Their
    // line goes into the speech queue, which plays it after whatever is
    // already being said — so a line revealed at the moment the fault
    // started reached the viewer after the picture had recovered, and
    // read as an announcement about nothing. Revealed a beat into the
    // fault it overlaps the picture it describes.
    function revealDuring(id, line, delayMs) {
        const started = activeSince;
        setTimeout(() => {
            if (active && activeSince === started) {
                reveal(id, line, { repeatable: true });
            }
        }, delayMs);
    }

    function enterOrionMode(now) {
        orionMode = true;
        orionUntil = now + 46000;
        discovered.add('orion');
        saveDiscovered();
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

    // Each species answers its own name, from the monitor, in character.
    // The correspondent plates are the chest-cropped field generation.
    const SPECIES = {
        human: 'THE TERRAN DELEGATION ACKNOWLEDGES YOUR INTEREST AND WILL FILE A FORM.',
        mrrshan: 'THE PRIDE HAS NOTICED YOU. THIS IS RARELY GOOD NEWS.',
        silicoid: 'WE HAVE WAITED FOUR THOUSAND YEARS. WE CAN WAIT FOR YOU TO FINISH TYPING.',
        sakkra: 'THE BROOD THANKS YOU FOR WATCHING. THE BROOD IS ALWAYS WATCHING.',
        psilon: 'WE CALCULATED THAT YOU WOULD TYPE THAT. WE WERE CORRECT.',
        alkari: 'THE SKY IS OPEN TONIGHT. MIND THE TURBULENCE.',
        klackon: 'THE HIVE HAS NO WORD FOR YOU. THE HIVE SALUTES IT ANYWAY.',
        bulrathi: 'A FIRM KEYSTROKE. GOOD. THE BULRATHI RESPECT A FIRM KEYSTROKE.',
        meklar: 'INPUT RECEIVED. INPUT ASSIMILATED. THANK YOU FOR YOUR CONTRIBUTION.',
        darlok: 'YOU DID NOT SEE THIS TRANSMISSION. WE WERE NEVER HERE.',
    };

    async function summonSpecies(sid, now) {
        if (typeof GNNCutsceneManager === 'undefined') return;
        if (GNNCutsceneManager.isBreakActive && GNNCutsceneManager.isBreakActive()) return;
        if (GNNCutsceneManager.isCutawayActive && GNNCutsceneManager.isCutawayActive()) return;
        if (!reveal('race_' + sid, SPECIES[sid])) return;
        const label = sid.toUpperCase() + ' · ON THE LINE';
        const ok = GNNCutsceneManager.openTwoWay
            ? await GNNCutsceneManager.openTwoWay(sid, null, now, label) : false;
        audio((a) => a.playRole('chirp', { gain: 0.45 }));
        if (sid === 'darlok') fire('black_frames', performance.now(), { ms: 700 });
        if (ok) {
            setTimeout(() => {
                if (GNNCutsceneManager.isTwoWay && GNNCutsceneManager.isTwoWay()) {
                    GNNCutsceneManager.endCutaway();
                }
            }, 7000);
        }
    }

    // Words the station listens for. Longest first, so `loknar` is not
    // pre-empted by a shorter word that happens to end the buffer.
    const WORDS = {
        // The staff channel is an interjection, not breaking news. It was
        // injected as a breaking story, and a breaking story cancels the
        // speech queue — so typing `gnn` silently swallowed any other
        // secret line already waiting to be spoken. Breaking news is for
        // Orion Mode, which is meant to take the channel over.
        gnn: () => {
            if (reveal('callsign', 'CALLSIGN ACCEPTED. YOU ARE CLEARED FOR THE STAFF CHANNEL.')) {
                GNNAudio.playRole('chirp', { gain: 0.5 });
                if (typeof GNNDirector !== 'undefined' && GNNDirector.interject) {
                    GNNDirector.interject(
                        'Studio note: the anchor unit has again requested a window. '
                        + 'Request denied. Request logged. Request number four thousand and six.',
                        { pitch: -18, rate: -6, caption: { kind: 'wire', cue: '◆ STAFF CHANNEL' } });
                }
            }
        },
        orion: (now) => enterOrionMode(now),
        1993: () => {
            if (reveal('founding', 'ARCHIVE YEAR ACKNOWLEDGED. PLAYING FOUNDING TRANSMISSION.')) {
                const beds = GNNAssets.musicTracks();
                if (beds.length) GNNAudio.playMusic(beds[9 % beds.length].id, { gain: 0.7, loop: false });
            }
        },
        antares: (now) => fire('antaran_intrusion', now),
        amoeba: (now) => fire('specimen_footage', now),
        bars: (now) => {
            // Fire first: firing ends whatever fault is running, and some
            // of those clear the card text on their way out.
            fire('color_bars', now, { ms: 3200 });
            cardText = 'YOU ASKED FOR THIS';
            reveal('bars', 'LINE-UP COMPLETE. THE STATION IS ALIGNED. YOU ARE NOT.');
            setTimeout(() => { cardText = null; }, 3400);
        },
        testcard: (now) => {
            fire('test_card', now, { ms: 3600 });
            cardText = 'THIS IS A TEST';
            reveal('test_card', 'THIS HAS BEEN A TEST. YOU PASSED. WE DID NOT.');
            setTimeout(() => { cardText = null; }, 3800);
        },
        help: () => reveal('help', 'THERE IS NO HELP DESK. THERE IS ONLY THE RUNDOWN.'),
        hello: () => reveal('hello', 'HELLO. WE CAN SEE THE LIGHT FROM YOUR SCREEN.'),
        loknar: (now) => {
            if (reveal('loknar', 'LOKNAR, LAST OF THE ORIONS, IS NOT TAKING QUESTIONS AT THIS TIME.')) {
                // The station and its escorts from the intro. Passed as a
                // preset: setting `bleedUrls` directly was overwritten by
                // the fault's own random pick the moment it fired.
                presetBleed = clip('intro', 572, 645);
                fire('crosstalk_footage', now, { ms: 4000 });
            }
        },
        static: (now) => {
            fire('signal_snow', now, { ms: 2600 });
            reveal('static', 'THAT SOUND IS THE BACKGROUND OF THE UNIVERSE. YOU ARE WELCOME.');
        },
        // A string the original game shipped in its ship-name table.
        // It was found and filtered out of the commercials; it lives on here.
        yomama: (now) => {
            fire('palette_burn', now);
            reveal('yomama', 'THAT FILE WAS NOT MEANT FOR BROADCAST. NEITHER WERE YOU.');
        },
    };
    Object.keys(SPECIES).forEach((sid) => {
        WORDS[sid] = (now) => { summonSpecies(sid, now); };
    });
    const WORD_KEYS = Object.keys(WORDS).sort((a, b) => b.length - a.length);
    const LONGEST_WORD = WORD_KEYS[0].length;

    /** Canvas click routing — the monitor and the anchors are live. */
    function handleCanvasClick(px, py, view) {
        lastInteraction = performance.now();
        idleAnnounced = false;
        const now = performance.now();

        const hits = (typeof GNNRenderer !== 'undefined' && GNNRenderer.hitRegions)
            ? GNNRenderer.hitRegions() : null;
        const inside = (r) => r && px >= r.x && px <= r.x + r.w
            && py >= r.y && py <= r.y + r.h;

        // The studio monitor. This used to be the holographic globe, which
        // is no longer drawn; the monitor in the same corner inherited both
        // the corner and the prank.
        if (hits && inside(hits.monitor)) {
            if (now - globeClickAt > 2400) globeClicks = 0;
            globeClickAt = now;
            globeClicks++;
            GNNAudio.playRole('blip', { gain: 0.4, rate: 1 + globeClicks * 0.12 });
            if (globeClicks >= 5) {
                globeClicks = 0;
                globeMode = 'overspin';
                setTimeout(() => { if (globeMode === 'overspin') globeMode = null; }, 6000);
                GNNAudio.playRole('sweep', { gain: 0.55 });
                fire('rgb_split', now, { ms: 1400 });
                reveal('globe_overspin',
                    'HOLOGRAPHIC ARMATURE OVERSPIN. PLEASE DO NOT DO THAT AGAIN.',
                    { repeatable: true });
            }
            return true;
        }

        // An anchor's face, wherever that anchor is sitting.
        if (hits && hits.faces && hits.faces.some(inside)) {
            eyeClicks++;
            GNNAudio.playRole('chirp', { gain: 0.45, rate: 1.3 });
            fire('eye_flicker', now);
            if (eyeClicks === 3) {
                reveal('optics',
                    'I HAVE BEEN READING THE NEWS FOR NINE HUNDRED AND FORTY YEARS. I AM NOT TIRED. I AM NOT ANYTHING.');
            }
            if (eyeClicks === 10) {
                fire('mirror_flip', now, { ms: 1600 });
                reveal('talent', 'PLEASE STOP TOUCHING THE TALENT. THE TALENT HAS A UNION.');
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
        const typed = keyBuffer.slice(-LONGEST_WORD)
            .filter((k) => k.length === 1).join('').toLowerCase();
        for (const w of WORD_KEYS) {
            if (typed.endsWith(w)) {
                // Clear the buffer so a word cannot fire twice, and so
                // `meklar` does not also read as the tail of something else.
                keyBuffer = [];
                try { WORDS[w](performance.now()); } catch (_) {}
                return;
            }
        }
    }

    // ---------------------------------------------------------
    // Tick
    // ---------------------------------------------------------

    // Days of the year the station notices. Each is a secret, revealed once
    // per day on its first minute on air; Halloween and April Fools also
    // change the faults for the whole day.
    function calendarDay(d) {
        const m = d.getMonth() + 1, day = d.getDate();
        if (m === 10 && day === 31) return 'halloween';
        if (m === 1 && day === 1) return 'new_year';
        if (m === 4 && day === 1) return 'april_fools';
        if ((m === 6 && day === 21) || (m === 12 && day === 21)) return 'solstice';
        return null;
    }
    const CALENDAR_LINES = {
        halloween: 'TONIGHT THE CARRIER IS CROWDED. SOME OF THE VOICES ON IT ARE NOT OURS.',
        new_year: 'A NEW YEAR ON THE WIRE. THE STATION HAS RENEWED ITS LICENCE. NOBODY ASKED.',
        april_fools: 'TODAY THE STATION MAY CROSS ITS WIRES. PLEASE DO NOT ADJUST YOUR RECEIVER. IT IS NOT YOU.',
        solstice: 'THE SUN TURNS AROUND TODAY. THE STATION DOES NOT. WE ARE ON AIR EITHER WAY.',
    };
    let calendarRevealedFor = null;

    function calendarEggs(d) {
        const which = calendarDay(d);
        if (!which) return;
        const stamp = which + d.toDateString();
        if (calendarRevealedFor === stamp) return;
        // New Year's waits for its first minute; the rest fire on the first
        // tick of the day the station is watched.
        if (which === 'new_year' && !(d.getHours() === 0 && d.getMinutes() === 0)) return;
        calendarRevealedFor = stamp;
        reveal(which, CALENDAR_LINES[which], { repeatable: true });
        if (which === 'halloween') fire('ghost_signal', performance.now(), { ms: 2400 });
        if (which === 'april_fools') fire('crosstalk_shop', performance.now(), { ms: 2400 });
        if (which === 'new_year') fire('color_bars', performance.now(), { ms: 2000 });
    }

    function clockEggs(d) {
        const hh = d.getHours();
        const mm = d.getMinutes();
        const key = hh + ':' + mm;
        if (key === lastClockEgg) return;
        let fired = true;
        if (hh === 3 && mm === 33) {
            reveal('dead_hour', 'THE DEAD HOUR. NOBODY IS WATCHING. WE ARE STILL WATCHING.', { repeatable: true });
            fire('signal_snow', performance.now(), { ms: 1800 });
        } else if ((hh === 11 || hh === 23) && mm === 11) {
            reveal('make_a_wish', 'ELEVEN ELEVEN. THE STATION HAS MADE A WISH. IT WAS FOR A WINDOW.', { repeatable: true });
        } else if (hh === 13 && mm === 37) {
            reveal('leet', 'ONE THREE THREE SEVEN. THE ENGINEERS ASKED US TO SAY THAT. WE DO NOT KNOW WHY.', { repeatable: true });
            fire('rgb_split', performance.now(), { ms: 1200 });
        } else {
            fired = false;
        }
        if (fired) lastClockEgg = key;
    }

    function update(now) {
        if (!nextAt) { schedule(now); lastInteraction = now; }
        if (!rareAt) rareAt = now + rand(RARE_GAP);
        if (!warmed) warm();
        // The rare events' footage is staged only when one is near.
        if (rareAt - now < 120000) {
            if (!staged.dread) stage('dread');
            if (!staged.strange) stage('strange');
        }

        if (active && now >= activeUntil) end(now);
        else if (!active && now >= rareAt) {
            fire(pick(Object.keys(RARE)), now);
            // On Halloween the rare events come every few minutes, not every
            // half hour to an hour.
            rareAt = now + (calendarDay(new Date()) === 'halloween'
                ? rand([240000, 600000]) : rand(RARE_GAP));
        } else if (!active && now >= nextAt) fire(weightedPick(), now);

        if (orionMode && now >= orionUntil) exitOrionMode();

        // Top of the hour: the station always marks it.
        const d = new Date();
        const hour = d.getHours();
        const mins = d.getMinutes();
        if (mins === 0 && hour !== lastHourChime) {
            lastHourChime = hour;
            GNNAudio.play('intro_sfx_01', { gain: 0.5 });
            GNNAudio.playRole('chirp', { gain: 0.4, delay: 0.5 });
            reveal('hourly', `TOP OF THE HOUR. ${String(hour).padStart(2, '0')}00 SECTOR STANDARD.`,
                { repeatable: true });
        }
        clockEggs(d);
        calendarEggs(d);

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

    const QUIET_FX = {
        roll: 0, tear: 0, desat: 0, invert: 0, shift: 0, jitter: 0, eye: false,
        snow: 0, pixel: 0, mirror: false, split: 0, zoom: 0, band: 0,
        black: 0, bleed: null, card: null, freeze: false, strap: null,
    };

    function videoState(now) {
        const out = Object.assign({}, QUIET_FX);
        const a = lookup(active);
        if (a && a.video) {
            // Elapsed since the fault began. The old expression measured time
            // until it *ends*, so each instance's phase was randomised by its
            // own duration.
            Object.assign(out, a.video(now - activeSince) || {});
        }
        if (orionMode) { out.desat = Math.max(out.desat, 0.3); out.shift = Math.max(out.shift, 3); }
        return out;
    }

    /**
     * Whether the fault has replaced the picture outright — a card, or
     * full black. Graphics are keyed in at the switcher, so when master
     * control drops to bars the captions go with the picture. Drawing the
     * live teleprompter over colour bars made the card read as a graphic
     * laid on a working broadcast instead of a broadcast that had failed.
     */
    function hidesGraphics(now) {
        if (!active) return false;
        const v = videoState(now);
        return !!v.card || v.black >= 1;
    }

    function isBreaking(now) { return now < breakingUntil; }
    function ghostAsset() { return ghost ? GNNAssets.cached(GNNAssets.heroPath(ghost)) : null; }

    return {
        update, handleCanvasClick, handleKey, flagBreaking,
        anchorOverride, globeOverride, videoState, isBreaking, ghostAsset,
        fire, hidesGraphics,
        isActive: () => !!active,
        activeName: () => active,
        isOrionMode: () => orionMode,
        discoveredCount: () => discovered.size,
        secretsBoard,
        totalSecrets: () => SECRETS.length,
        /** Every fault and rare event, for review tools. */
        /** For review tools: the picker's choice right now. */
        samplePick: () => weightedPick(),
        catalogue: () => ({ anomalies: Object.keys(ANOMALIES), rare: Object.keys(RARE),
            words: WORD_KEYS.slice(), secrets: SECRETS.slice() }),
        set onSecret(fn) { onSecret = fn; },
    };
})();
