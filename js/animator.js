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
        const level = (typeof GNNTTS !== 'undefined' && GNNTTS.isSpeaking())
            ? GNNTTS.getLevel() : 0;
        smoothed += (level - smoothed) * 0.45;

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

        return {
            anchor: (aOverride === null || aOverride === undefined) ? anchorFrame : aOverride,
            globe: globeOut,
        };
    }

    function setSpeaking(v) {
        speaking = !!v;
        if (!v) { anchorFrame = 0; smoothed = 0; }
    }

    let lastFrames = { anchor: 0, globe: 0 };
    function tick(now) { lastFrames = update(now); return lastFrames; }

    return {
        tick, update, setSpeaking,
        getAnchorFrame: () => lastFrames.anchor,
        getGlobeFrame: () => lastFrames.globe,
        VISEMES, TOTAL_FRAMES,
    };
})();
