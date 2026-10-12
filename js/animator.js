/* ============================================================
   GNN — Animator
   ------------------------------------------------------------
   Drives the anchor's 25-frame lip matrix and the globe's
   25-cel rotation.

   The mouth no longer flaps on a random timer. NEWSCAST.LBX
   item 2 is a 25-frame sheet whose cels sit at different mouth
   openings; those cels are grouped into visemes and selected by
   the live amplitude of the neural voice, so the jaw actually
   tracks the waveform. The glitch engine can seize both the
   mouth table and the globe cel at any time.
   ============================================================ */

const GNNAnimator = (() => {
    'use strict';

    const TOTAL_FRAMES = 25;
    const GLOBE_INTERVAL = 90;

    // Cels bucketed by how far the jaw is open, quietest first.
    // Index 0 is the neutral closed-mouth pose.
    const VISEMES = [
        [0, 1, 2],              // closed / rest
        [4, 8, 12, 20],         // barely parted
        [5, 9, 15, 21],         // mid
        [3, 6, 10, 13, 17],     // open
        [7, 18, 19, 23, 24],    // wide
    ];

    let globeFrame = 0;
    let anchorFrame = 0;
    let speaking = false;
    let lastGlobeTick = 0;
    let lastMouthTick = 0;
    let mouthHold = 0;
    let smoothed = 0;
    let blinkUntil = 0;
    let nextBlink = 0;

    function update(now) {
        // --- Globe ---
        if (now - lastGlobeTick >= GLOBE_INTERVAL) {
            globeFrame = (globeFrame + 1) % TOTAL_FRAMES;
            lastGlobeTick = now;
        }
        const gOverride = (typeof GNNGlitch !== 'undefined')
            ? GNNGlitch.globeOverride(globeFrame, now) : null;
        const globeOut = gOverride === null || gOverride === undefined ? globeFrame : gOverride;

        // --- Mouth ---
        //
        // The level is only read when the desk is the thing speaking.
        //
        // Not every voice on the station's voice bus belongs to somebody at
        // the desk. A remote two-way plays the correspondent's answering
        // line through the same `GNNTTS.speak()` path, so `GNNTTS.isSpeaking()`
        // is true and `GNNTTS.getLevel()` returns the correspondent's
        // amplitude — and until this check existed, the animator read that
        // and moved the *anchor's* mouth on the correspondent's voice while
        // the correspondent's own face sat still in the monitor.
        //
        // `speaking` is now driven from the director, not from the raw
        // voice events: `main.js` calls `setSpeaking(GNNDirector.speakerIsSeated())`
        // on start, so during a correspondent's line it is false. Gating
        // the level read on it means `smoothed` decays to zero for the
        // whole of that line, `jawOpen` stays false, `mouthOpen()` returns
        // false, and the seated anchor's mouth is shut while the
        // correspondent talks.
        //
        // The correspondent's own mouth is animated by the cutscene manager
        // — see `tickCorrespondentMouth()` in cutscene-manager.js — because
        // this animator is a singleton built for the desk and cannot serve
        // two mouths at once.
        const level = (speaking && typeof GNNTTS !== 'undefined' && GNNTTS.isSpeaking())
            ? GNNTTS.getLevel() : 0;
        // Light smoothing only. Heavier than this and the gaps between
        // words smear shut, which is the thing the gate below exists to
        // catch.
        smoothed += (level - smoothed) * 0.7;

        // Two-state art flaps on a syllable clock, not on the waveform.
        //
        // Reading the envelope is the right way to drive a 25-cel matrix and
        // the wrong way to drive two pictures, because there is almost no
        // envelope left to read: the voice is compressed to about a
        // decibel of variation on the way out of the server, which is what
        // makes the station sit at an even level. Measured against it, the
        // jaw was open for 248 consecutive samples and never once shut.
        //
        // So the mouth opens and closes at the rate a mouth does — roughly
        // five times a second — for as long as there is speech, with the
        // shut half shorter than the open half, and the loudness only
        // nudging the timing. It is not lip-sync. At two frames it was
        // never going to be, and it reads as talking, which is the job.
        // ...but it is GATED on the voice, so it runs only while a word is
        // actually being said.
        //
        // When this was written the envelope was useless — the server
        // compressed the voice to about a decibel of variation, so there
        // was nothing to read and the clock had to free-run. That is no
        // longer true: measured live through the analyser during a read,
        // the level runs 0.002 to 1.000 with a median of 0.628, and the
        // pauses between sentences show up as runs of 400 ms or more below
        // 0.10. A gate at 0.15 has the mouth active for 83% of a read,
        // which is about what a person's is.
        //
        // The hangover keeps it from chattering shut inside a word, where
        // a consonant can drop the level for a frame or two.
        const GATE = 0.15;
        if (smoothed > GATE) voiceUntil = now + 90;
        if (now < voiceUntil) {
            if (now >= jawUntil) {
                jawOpen = !jawOpen;
                const hurry = 1 - Math.min(0.5, smoothed);
                jawUntil = now + (jawOpen ? 70 + hurry * 70 : 50 + hurry * 50);
            }
        } else {
            jawOpen = false;
            jawUntil = 0;
        }

        if (now - lastMouthTick >= mouthHold) {
            lastMouthTick = now;
            if (speaking || smoothed > 0.04) {
                const band = Math.min(VISEMES.length - 1,
                    Math.max(1, Math.round(smoothed * (VISEMES.length - 1) * 1.35)));
                const bucket = VISEMES[band];
                anchorFrame = bucket[(Math.random() * bucket.length) | 0];
                // Louder syllables get held slightly longer, like real jaw motion.
                mouthHold = 55 + (1 - smoothed) * 90;
            } else {
                anchorFrame = 0;
                mouthHold = 120;
            }
        }

        // Idle blink so the desk never looks frozen during dead air.
        if (!speaking && smoothed < 0.05) {
            if (!nextBlink || now > nextBlink) {
                nextBlink = now + 2600 + Math.random() * 5200;
                blinkUntil = now + 110;
            }
            if (now < blinkUntil) anchorFrame = 1;
        }

        const aOverride = (typeof GNNGlitch !== 'undefined')
            ? GNNGlitch.anchorOverride(anchorFrame, now) : null;
        // A glitch that bends the mouth has to bend it for two-state cast
        // art too, and that reads the envelope rather than the frame index.
        // Without this, desync and flicker reached the MOO1 robot alone.
        if (aOverride !== null && aOverride !== undefined) {
            smoothed = aOverride ? 0.5 : 0;
            jawOpen = !!aOverride;
        }

        return {
            anchor: (aOverride === null || aOverride === undefined) ? anchorFrame : aOverride,
            globe: globeOut,
        };
    }

    function setSpeaking(v) {
        speaking = !!v;
        if (!v) {
            anchorFrame = 0; smoothed = 0;
            jawOpen = false; jawUntil = 0; voiceUntil = 0;
        }
    }

    let jawOpen = false;
    let jawUntil = 0;
    // How long the mouth keeps moving after the level drops.
    let voiceUntil = 0;

    let lastFrames = { anchor: 0, globe: 0 };
    function tick(now) { lastFrames = update(now); return lastFrames; }

    return {
        tick, update, setSpeaking,
        /**
         * How far open the jaw is, 0 to about 1.
         *
         * The frame index cannot answer this. It indexes a 25-cel matrix and
         * is non-zero for every moment of an utterance, so art with two
         * mouth states read it as "open" and held the mouth open from the
         * first syllable to the last. This is the smoothed envelope, which
         * moves at the speed of speech.
         */
        mouthLevel: () => smoothed,
        /** Whether the jaw is open this instant. Two-state art draws this. */
        mouthOpen: () => jawOpen,
        getAnchorFrame: () => lastFrames.anchor,
        getGlobeFrame: () => lastFrames.globe,
        VISEMES, TOTAL_FRAMES,
    };
})();