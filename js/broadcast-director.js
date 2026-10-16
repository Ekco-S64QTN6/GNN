/* ============================================================
   GNN — Broadcast Director
   ------------------------------------------------------------
   Owns the clock. Everything the station does in time is decided
   here.

   The old build had one mode: read the next headline, forever,
   with a fixed two-second gap. A real newscast has rhythm — the
   anchor lands a story, lets it sit, adds a line of his own,
   throws to the next item, and every few stories the whole desk
   goes away for a break.

   The rundown is generated as it plays:

       READ -> HOLD -> [BANTER -> HOLD] -> [TOSS] -> READ ...
                                   \-> BREAK every 4-7 stories
                                   \-> IDENT every ~11 stories

   HOLD is real dead air: the voice is silent, the prompter keeps
   the last line up, the anchor's mouth is shut and the room tone
   carries it. That silence is the single biggest difference
   between "a page reading RSS" and "a channel that is on".

   ------------------------------------------------------------
   Recent fix:

   Between-show bumpers. When a block ends and the next one is
   about to begin — the HOLD case fires with `holdNext` set to
   COLD_OPEN and `blockIndex > 0` — the director hands the
   transition to `window.GNNBumper.play()`, which is main.js's
   nine-second slate → show-card → studio sequence with a music
   interlude. The director pauses for the bumper's duration and
   waits. When the bumper calls `handoffColdOpen()`, this module
   clears its state and runs the cold open, then the bumper calls
   `resume()` and the frame loop picks back up.

   The previous shape of this handoff had a race: the HOLD case
   cleared `holdNext` before dispatching, so a bumper launched on
   one tick would be cancelled on the next — the HOLD case
   re-fired, saw its own pending flag, and took the fall-through
   branch into `beginColdOpen` while the bumper was still showing
   cards. The `coldOpenPending` flag and the `handoffColdOpen()`
   API fix it by making the transition explicit: the bumper owns
   the cold open until it says otherwise, and no path through the
   HOLD case advances past the handoff except the handoff itself.

   A safety timeout — `BUMPER_HANDOFF_TIMEOUT_MS` — releases the
   director if a bumper fails to call back. Without it, a bumper
   that hit an exception between `play()` and `handoffColdOpen()`
   would deadlock the HOLD case: the state machine would wait
   forever for a handoff that was never coming.

   `setState` also clears `coldOpenPending` when the director
   leaves HOLD by any path other than the handoff. That catches
   the case where an operator hits Skip during the bumper, or a
   breaking story pre-empts — the handoff is stale by then, and
   the next COLD_OPEN transition must run its own bumper rather
   than firing a half-completed handoff from the previous one.
   ============================================================ */

const GNNDirector = (() => {
    'use strict';

    const S = {
        BOOT: 'BOOT', COLD_OPEN: 'COLD_OPEN', READ: 'READ', HOLD: 'HOLD',
        BANTER: 'BANTER', WIRE: 'WIRE', TOSS: 'TOSS', BREAK: 'BREAK',
        IDENT: 'IDENT', DRY: 'DRY', SIGNOFF: 'SIGNOFF',
    };

    // --- Show length -----------------------------------------
    //
    // A show is fifteen minutes of airtime, measured on the wall clock, not
    // on a story count. The story count was the previous design — read
    // between nine and fourteen stories and sign off — and it did not match
    // what a channel actually does: a fast wire closed the show in six
    // minutes, a slow one ran it long, and there was no way to keep two
    // consecutive shows to the same length.
    //
    // The floor is a safety rail, not a driver. A very productive wire
    // should not close a show after two stories just because the clock has
    // somehow run out (it cannot, but a stuck `showStartedAt` could), and a
    // very slow one should not overrun forever because it has not filed
    // enough to satisfy a minimum. Four stories and fifteen minutes is the
    // shortest acceptable show.
    const SHOW_MS = 15 * 60 * 1000;
    const MIN_STORIES_PER_SHOW = 4;

    // How long the director will wait for a bumper to hand the cold open
    // back before giving up and running it directly. The bumper is a
    // nine-second sequence by design; anything past this means the bumper
    // itself failed and the director should not deadlock on a handoff
    // that is never coming.
    const BUMPER_HANDOFF_TIMEOUT_MS = 30000;

    // The station's fixed opening announcement.
    //
    // One line, always the same words, read by the station automation.
    // It used to be drawn from `GNNScript.ident()`, which picks at
    // random from five different station announcements, so every boot
    // the ident was different. A station signature is not a variant —
    // the words are the point, and a viewer who has heard them once
    // should hear the same words the next time.
    //
    // The `ident()` pool is still used elsewhere: mid-show idents
    // (`beginIdent`), commercial break idents (`startCommercialBreak`).
    // Those are separate messages for separate moments, and they keep
    // their variety. Only the boot-time booth ident is fixed.
    const BOOTH_IDENT_LINE = 'This is the Galactic News Network.';

    // Broadcasting labels that prefix a wire headline.
    //
    // The feed manager's cleaner strips a label when it is the very first
    // word of the headline — "Watch:", "LIVE:", "Video:". It does not
    // catch a multi-word prefix like "IRAN WAR LIVE:", and that one is
    // not a rare shape: sections of the wire that run continuous coverage
    // file their own items under a section label, and the label stays on
    // the front of the headline when the item lands in the feed.
    //
    // The label is a filing marker, not part of the headline. A viewer
    // watching the station wants "Trump says Houthis", not "Iran war
    // live, Trump says Houthis" — the section the item was filed under
    // is not news.
    //
    // The rule: an optional run of uppercase words, then a broadcasting
    // keyword, then a colon. The keyword is required, so a headline like
    // "TRUMP: Iran deal close" is preserved — "TRUMP" is attribution,
    // not a label. "IRAN WAR LIVE:" is stripped because "LIVE" is the
    // last word before the colon and the words before it are all caps.
    const BROADCAST_LABEL_RE =
        /^\s*(?:(?:[A-Z][A-Z0-9' -]{0,38}?\s+)?(?:LIVE|WATCH|UPDATE|DEVELOPING|BREAKING(?:\s+NEWS)?|VIDEO|RECAP|ANALYSIS|OPINION))\s*:\s*/i;

    // --- Pacing knobs (ms) -----------------------------------
    const PACE = {
        holdAfterRead: [1500, 3600],
        holdAfterBanter: [900, 2100],
        holdBeforeBreak: [700, 1400],
        breathAfterToss: [500, 1100],
        dryLoop: [6000, 11000],
        storiesPerBreak: [4, 7],
        storiesPerIdent: [9, 14],
        banterChance: 0.55,
        wireShare: 0.35,          // of banter beats, how many are sector-wire
        exchangeShare: 0.33,      // ...and how many are the two anchors
        twoWayShare: 0.22,        // ...and how many go to a correspondent
        tossChance: 0.42,
        cutawayChance: 0.62,
        cutawayAt: 0.34,          // fraction through the read
        doubleBanterChance: 0.16,
    };

    let state = S.BOOT;
    let stateSince = 0;
    let holdUntil = 0;

    let queue = []; // active show's queue only; all other stories live in showQueues.
    let pinnedRundown = null; // Teased stories from the cold open rundown, preserved in promised order.
    // Retained for legacy diagnostics/API compatibility. Normal feed stories now
    // use strict per-show queues and are never released across categories.
    const heldByCategory = Object.create(null);
    const showQueues = Object.create(null);
    const directorStoryKeys = new Set();
    let activeQueueShowId = null;
    const HELD_CAP = 40;
    let current = null;
    let storiesRead = 0;
    let sinceBreak = 0;
    let sinceIdent = 0;
    let nextBreakAt = randInt(PACE.storiesPerBreak);
    let nextIdentAt = randInt(PACE.storiesPerIdent);

    // Wall clock for the current show. Set the moment the cold open fires
    // — that is the top of the hour, as far as the station is concerned —
    // and read by `decideAfterRead` and the DRY case to close on time.
    let showStartedAt = 0;

    // Whether this show has already sent to a correspondent. The show
    // block contract is one two-way per show; see `beginBanter` for how the
    // forced use works and why it fires in the second half.
    //
    // A debate in a `DEBATE_BLOCKS` show counts as the correspondent slot
    // and latches this the same way a two-way does. The crossfire block
    // gets a debate instead of a two-way, not in addition to one.
    let correspondentUsed = false;

    // Which show block we are on. Incremented at the end of each show, at
    // the same moment the director schedules a new cold open, so the
    // station walks the ten blocks in order across a long session rather
    // than picking one at random.
    //
    // The renderer is what actually swaps the set, the window rect, the
    // backdrop and the seated pair; this counter is the index it swaps to.
    // See `GNNRenderer.setShowBlock()` — that is where the whole bundle
    // lives.
    let blockIndex = 0;

    const SHOW_SCHEDULE = [
        { id: 'morning_watch', title: 'Galactic Morning Watch', desk: 'MAIN DESK', genre: 'morning' },
        { id: 'economy', title: 'Deep Space Economy', desk: 'TRADE DESK', genre: 'business' },
        { id: 'crossfire', title: 'Council Crossfire', desk: 'SECTOR DEBATE', genre: 'debate' },
        { id: 'cybernetics', title: 'Deep Survey & Cybernetics', desk: 'TECH DESK', genre: 'science' },
        { id: 'machine_intel', title: 'Machine Intelligence Log', desk: 'AUTOMATON DESK', genre: 'ai' },
        { id: 'trade_minerals', title: 'Colonial Mining & Trade', desk: 'COMMERCE DESK', genre: 'industry' },
        { id: 'diplomacy', title: 'Council Summit Floor', desk: 'DIPLOMATIC DESK', genre: 'politics' },
        { id: 'evening_rim', title: 'The Evening Rim Report', desk: 'PRIME DESK', genre: 'prime' },
        { id: 'anomaly', title: 'Anomaly: Deep Dark', desk: 'INVESTIGATION DESK', genre: 'latenight' },
        { id: 'archives', title: 'Imperial Historical Wire', desk: 'ARCHIVE DESK', genre: 'archive' },
    ];

    // Which show blocks run as a debate rather than a normal two-way.
    //
    // Council Crossfire is the one. Its format — a polarized panel shouting
    // past each other while the anchor tries to get a question in — is what
    // the split-screen `openDebate()` in `cutscene-manager.js` was built
    // for, and the reason that feature is in the codebase at all. Every
    // other block runs the standard single-monitor two-way.
    //
    // To make another show a debate, add its id here. No other wiring is
    // needed: `beginBanter` reads this set and switches path on the match,
    // and the rest of the machinery — the arming flag, the drain, the
    // latch on `correspondentUsed` — is shared with the two-way code.
    const DEBATE_BLOCKS = new Set(['crossfire']);

    // Species that have a correspondent plate on disk under
    // `assets/generated/correspondents/`.
    //
    // Mirrors `CORRESPONDENT_READY` in `js/script-writer.js`. That set is
    // scoped to its own IIFE and not exported; the director is the only
    // other caller and the list is small enough that a duplicate with a
    // comment pointing at the original is cheaper than a module boundary.
    //
    // A debate guest must be on this list or `openDebate()` returns false:
    // `correspondentScene()` needs both a `_hero.png` and a `_speaking.png`
    // to open a monitor, and the debate's two PIP windows are built from
    // the same loader. If the correspondent folder gains or loses a
    // species, both sets change together.
    //
    // Owned by the script writer — `GNNScript.CORRESPONDENT_READY`. The
    // director reads it here rather than holding a second copy, so the
    // two-way pool and the debate pool cannot disagree about who has a
    // correspondent plate on disk.
    const CORRESPONDENT_READY = GNNScript.CORRESPONDENT_READY;

    function getShowInfo() {
        const count = SHOW_SCHEDULE.length;
        const idx = ((blockIndex % count) + count) % count;
        const cur = SHOW_SCHEDULE[idx];
        return {
            blockIndex,
            id: cur.id,
            title: cur.title,
            desk: cur.desk,
            genre: cur.genre,
        };
    }

    let speaking = false;
    let speechToken = 0;
    let speechDeadline = 0;
    let cutawayFired = false;
    let readEstimate = 0;
    let running = true;
    let pendingBreaking = null;
    let banterStreak = 0;
    let bootDeadline = 0;
    let breakArming = false;

    // Consecutive DRY ticks. Reset at the top of each show (see
    // `beginColdOpen`) so a block that inherits a starved queue from the
    // previous block is not closed out on its first empty tick.
    let dryTicks = 0;

    // True while an async two-way or debate is between "committed to
    // running" and "monitors open (or failed)". The BANTER/S.WIRE case in
    // `update()` reads this to avoid falling through to a HOLD in the
    // frame-loop window the `await openTwoWay()` or `await openDebate()`
    // opens.
    //
    // The pattern is the same shape as `breakArming` above: an async call
    // fired from the update loop reserves its own state synchronously, and
    // the state's own update case refuses to advance while the reservation
    // is held. Without it, the await is a window the frame loop runs in —
    // which is exactly the fault CLAUDE.md §3 records under "The two-way
    // played over the story it replaced".
    let twoWayArming = false;

    // The between-show bumper handoff.
    //
    // `coldOpenPending` is set the moment the HOLD case hands the cold
    // open to `window.GNNBumper.play()` and cleared by
    // `handoffColdOpen()` when the bumper says it has finished. While
    // set, the HOLD case refuses to advance — it has already asked the
    // bumper to own the transition, and letting it advance early would
    // launch a second bumper or skip past the one running.
    //
    // `coldOpenPendingSince` is the moment the flag was set, used by the
    // safety timeout: a bumper that never calls back must not deadlock
    // the state machine.
    let coldOpenPending = false;
    let coldOpenPendingSince = 0;

    let onStateChange = null;
    let onStory = null;

    function rand(range) {
        return range[0] + Math.random() * (range[1] - range[0]);
    }
    function randInt(range) {
        return Math.round(rand(range));
    }

    function setState(next, now) {
        if (state === next) return;
        const prev = state;
        // A pending bumper handoff only makes sense while the director is
        // sitting in HOLD waiting for it. If any other path takes the
        // director out of HOLD — Skip during the bumper, a breaking story
        // pre-empting, a forced commercial — the handoff is stale and
        // must not fire on a later, unrelated COLD_OPEN.
        if (prev === S.HOLD) {
            coldOpenPending = false;
            coldOpenPendingSince = 0;
        }
        const qLen = queue ? queue.length : 0;
        // eslint-disable-next-line no-console
        console.log(`[GNN Director] state -> ${next} (prev: ${prev}, queue: ${qLen}, storiesRead: ${storiesRead})`);
        state = next;
        stateSince = now;
        if (typeof window !== 'undefined' && window.GNNTranscript && window.GNNTranscript.logSegment) {
            window.GNNTranscript.logSegment(next, {
                previousState: prev,
                queueLength: qLen,
                storiesRead: storiesRead,
                sinceBreak: sinceBreak,
            });
        }
        if (onStateChange) onStateChange(next);
    }

    // ---------------------------------------------------------
    // Who is reading
    // ---------------------------------------------------------
    //
    // A desk with two people at it where one of them reads everything is
    // one person and a bystander. The chair passes on each story, and the
    // voice and the moving mouth follow it, so the station sounds like two
    // anchors rather than one anchor and a decoration.

    let seatIndex = 0;

    /**
     * The cast entry speaking the current line, or — when the line has no
     * specific speaker — whoever currently holds the chair on the rundown.
     *
     * The distinction matters during an exchange and during a two-way, when
     * the chair and the speaker of the moment are different people. The
     * voice was already picked per-line; the caption label and the animating
     * plate were not, so the two disagreed on screen. Varr's bubble pointed
     * at Varr while Hale's voice played.
     */
    function speaker() {
        if (currentLineSpeaker) return currentLineSpeaker;
        if (typeof GNNRenderer === 'undefined' || !GNNRenderer.seatedIds) return null;
        const ids = GNNRenderer.seatedIds();
        if (!ids.length || typeof GNNCast === 'undefined') return null;
        return GNNCast.get(ids[seatIndex % ids.length]);
    }

    /** Pass the chair. Called once per story, not once per line. */
    function passChair() {
        if (typeof GNNRenderer === 'undefined' || !GNNRenderer.seatedIds) return;
        const n = GNNRenderer.seatedIds().length;
        if (n > 1) seatIndex = (seatIndex + 1) % n;
    }

    // One line at a time, in order, with a beat of air between them.
    //
    // `GNNTTS.speak()` bumps its own request id and cuts off whatever is
    // already playing, and every `say()` was fire-and-forget — so any line
    // fired while someone was talking killed the line in progress. That is
    // one fault wearing six costumes: the station ident interrupted, the
    // commander cut off mid-sentence by the other anchor, a line written
    // for one character coming out in the other's voice, the throw to the
    // break stepping on the story, and every cutaway talking over itself.
    //
    // Nothing speaks directly any more. Lines are queued and a pump plays
    // them one at a time, and the caption goes up at the moment its own
    // line starts rather than when it was scheduled — which is why the
    // text box used to appear before the voice.
    const speechQueue = [];
    let pumping = false;
    // Dead air between lines. Without it the next line begins on the same
    // frame the last one ends and the desk sounds like a machine reading.
    const LINE_GAP_MS = 420;

    // Whether the voice on the wire right now belongs to someone at the
    // desk. Read by the animator (through `speakerIsSeated()`) so that a
    // correspondent appearing in the monitor does not move a seated
    // anchor's mouth. Set at the top of each job in `pump()`.
    let currentLineDrivesDesk = true;

    // The cast entry speaking the line currently on the air, or null when
    // the line is being read by the chair (the default for a story, a toss,
    // plain banter, an ident and a commercial beat). Set at the top of each
    // job in `pump()`, cleared when the queue empties.
    let currentLineSpeaker = null;

    /**
     * Queue a line.
     *
     * `opts.caption` is the teleprompter payload; it is presented when the
     * line actually begins. Passing `null` means the line is spoken but
     * carries no caption — which is what the boot-time booth ident does,
     * because it plays under the title card where the canvas is not
     * visible, and a caption presented there would linger past the fade.
     *
     * `opts.drivesDesk` (default true) says whether this line is spoken by
     * somebody sitting at the desk — a two-way correspondent answering from
     * the monitor is not, and their line must not turn the anchor's head or
     * open the anchor's mouth.
     *
     * `opts.speakerId` names the cast entry saying the line, if the caller
     * knows. It is what makes the caption label, the bubble position and
     * the animating plate follow the speaker rather than the story's chair.
     * Omit it when the chair is reading, which is most of the time.
     *
     * Returns the estimated duration, which callers use for pacing, not
     * for display timing.
     */
    function say(text, opts = {}) {
        if (!text) return 0;
        const est = GNNTTS.estimateMs(text);
        speechQueue.push({
            text, opts, est, token: speechToken,
            drivesDesk: opts.drivesDesk !== false,
            speakerId: opts.speakerId || null,
        });
        speaking = true;
        speechDeadline = performance.now() + est * 2.4 + 8000;
        pump();
        return est;
    }

    /**
     * Queue a whole tagged beat — a script-writer sequence of
     * `{who, text}` objects — each line in its own speaker's voice.
     *
     * The pump plays them one at a time in order, so queueing them all at
     * once is correct; the pre-queue code used per-line `setTimeout`s to
     * space them out, which left stale lines in the pipeline when the beat
     * was cancelled mid-flight. This is used by both anchor-to-anchor
     * exchanges and any other multi-line beat from `script-writer.js`.
     *
     * `opts.pitch` may be a number (all lines) or a function
     * `(speakerId) => number` for beats with per-speaker prosody, like a
     * two-way. `opts.drivesDesk` may be a boolean or a function
     * `(speakerId) => boolean`, same idea.
     *
     * Returns the summed estimated duration, so callers can pace the hold
     * that follows.
     */
    function queueTaggedLines(lines, opts = {}) {
        let total = 0;
        const lineArr = lines || [];
        for (let idx = 0; idx < lineArr.length; idx++) {
            const line = lineArr[idx];
            if (!line || !line.who || !line.text) continue;
            const speaker = line.who;
            let addressedTo = line.to ? (line.to.name || line.to.id || line.to) : (opts.addressedTo || null);
            if (!addressedTo && lineArr.length > 1) {
                // In a conversation with multiple speakers, address the partner
                const other = lineArr.find((l, i) => i !== idx && l && l.who && l.who.id !== speaker.id);
                if (other && other.who) {
                    addressedTo = other.who.name;
                }
            }
            const pitch = typeof opts.pitch === 'function'
                ? opts.pitch(speaker.id)
                : (opts.pitch !== undefined ? opts.pitch : -3);
            const drivesDesk = typeof opts.drivesDesk === 'function'
                ? opts.drivesDesk(speaker.id)
                : (opts.drivesDesk !== undefined ? opts.drivesDesk : true);
            total += say(line.text, {
                voice: speaker.voice,
                pitch,
                speakerId: speaker.id,
                addressedTo,
                caption: {
                    kind: opts.kind || 'banter',
                    cue: speaker.name.toUpperCase()
                },
                drivesDesk,
            });
        }
        return total;
    }

    /**
     * Queue a line that is not on the rundown — an unlisted transmission,
     * a staff-channel message, the top-of-hour chime.
     *
     * Same queue as everything else, so it plays when the anchor finishes
     * rather than cutting them off. Used by `GNNGlitch.onSecret`. That
     * handler used to poll for the station to stop talking and then call
     * `GNNTTS.speak()` itself, which has a race: if the poll expired in the
     * same tick the pump was starting a line, the interjection cut the
     * anchor off mid-word. Through the queue it cannot — it waits its turn
     * like anything else.
     */
    function interject(text, opts = {}) {
        return say(text, Object.assign({
            caption: { kind: 'wire', cue: '◆ UNLISTED TRANSMISSION' },
        }, opts));
    }

    async function pump() {
        if (pumping) return;
        pumping = true;
        try {
            while (speechQueue.length) {
                const job = speechQueue[0];
                // Dropped if the rundown moved on while it waited.
                if (job.token !== speechToken) { speechQueue.shift(); continue; }
                speechQueue.shift();
                // Set the line's speaker and its drives-desk flag *before*
                // anything reads them — in particular before the voice
                // fallback below, which asks `speaker()` and would
                // otherwise hear the previous line's speaker.
                currentLineDrivesDesk = job.drivesDesk;
                currentLineSpeaker = (job.speakerId && typeof GNNCast !== 'undefined')
                    ? GNNCast.get(job.speakerId) : null;
                let who = currentLineSpeaker;
                if (!who && job.drivesDesk !== false) {
                    who = speaker();
                }

                const opts = Object.assign({}, job.opts);
                delete opts.caption;
                delete opts.drivesDesk;
                delete opts.speakerId;
                delete opts.addressedTo;
                delete opts.headline;
                delete opts.sourceUrl;

                if (!opts.voice) {
                    if (who && who.voice) opts.voice = who.voice;
                }
                const activeVoice = opts.voice || (typeof GNNTTS !== 'undefined' ? GNNTTS.getVoice() : null);

                const isAutomation = (job.drivesDesk === false && !who) || job.speakerId === 'automation' || opts.voice === 'vox_unit';
                const speakerName = who ? who.name : (isAutomation ? 'Station Automation' : 'Station Desk');
                const speakerId = who ? who.id : (isAutomation ? 'automation' : 'desk');
                const speakerRole = who ? who.role : (isAutomation ? 'Station Automation' : 'Station');
                const expectedVoice = who ? who.voice : (isAutomation ? 'vox_unit' : (opts.voice || null));

                // Seat determination
                let seatLabel = '';
                if (isAutomation) {
                    seatLabel = 'Station Automation';
                } else if (typeof GNNRenderer !== 'undefined' && GNNRenderer.seatedIds) {
                    const ids = GNNRenderer.seatedIds();
                    const sIdx = who ? ids.indexOf(who.id) : -1;
                    if (sIdx >= 0) {
                        seatLabel = `Seat ${sIdx + 1} (${sIdx === 0 ? 'Lead Anchor' : 'Co-Anchor'})`;
                    } else if (job.drivesDesk === false) {
                        seatLabel = 'Remote / Monitor';
                    } else {
                        seatLabel = who ? who.role : 'Station Desk';
                    }
                } else {
                    seatLabel = who ? who.role : 'Station Desk';
                }

                // Addressed target determination
                let addressed = job.opts.addressedTo || null;
                if (!addressed && typeof GNNScript !== 'undefined' && GNNScript.desk) {
                    const seats = GNNScript.desk();
                    if (seats.length > 1 && who) {
                        const other = seats.find(s => s && s.id !== who.id);
                        if (other && (state === S.BANTER || state === S.TOSS)) {
                            addressed = other.name;
                        }
                    }
                }

                // Voice mismatch detection: character has an assigned voice, but active voice differs
                const isMismatch = !!(who && expectedVoice && activeVoice && expectedVoice !== activeVoice);

                // Log speech to window.GNNTranscript
                if (typeof window !== 'undefined' && window.GNNTranscript && window.GNNTranscript.logSpeech) {
                    window.GNNTranscript.logSpeech({
                        speakerId: speakerId,
                        speakerName: speakerName,
                        speakerRole: speakerRole,
                        speakerSeat: seatLabel,
                        addressedTo: addressed,
                        text: job.text,
                        voiceId: activeVoice,
                        expectedVoiceId: expectedVoice,
                        isMismatch: isMismatch,
                        headline: current ? current.title : (job.opts.headline || null),
                        sourceUrl: current ? (current.sourceUrl || current.link) : (job.opts.sourceUrl || null),
                    });
                }

                // Technical diagnostic to console
                console.log(`[GNN Director:Speech] ${speakerName} [${seatLabel}]${addressed ? ` -> ${addressed}` : ''}: "${job.text.length > 70 ? job.text.slice(0, 70) + '…' : job.text}" | Voice: ${activeVoice}${isMismatch ? ` [MISMATCH expected ${expectedVoice}]` : ''}`);

                // Present the caption only if the job carries one.
                if (job.opts.caption) {
                    GNNTextEngine.present(job.text, Object.assign(
                        { durationMs: job.est }, job.opts.caption));
                }
                speechDeadline = performance.now() + job.est * 2.4 + 8000;
                try {
                    await GNNTTS.speak(job.text, opts);
                } catch (e) { /* the rundown outranks the voice */ }
                if (speechQueue.length) {
                    await new Promise((r) => setTimeout(r, LINE_GAP_MS));
                }
            }
        } finally {
            pumping = false;
            if (!speechQueue.length) {
                speaking = false;
                speechDeadline = 0;
                currentLineDrivesDesk = true;
                currentLineSpeaker = null;
            }
        }
    }

    /** Resolves when the queue has emptied, or after a hard ceiling. */
    function drainSpeech(limitMs = 20000) {
        const until = performance.now() + limitMs;
        return new Promise((resolve) => {
            const check = () => {
                if (!speaking || performance.now() > until) return resolve();
                setTimeout(check, 120);
            };
            check();
        });
    }

    /** Second line of defence: the rundown outranks the voice. */
    function checkSpeechWatchdog(now) {
        if (speaking && speechDeadline && now > speechDeadline) {
            speechToken++;
            speechQueue.length = 0;
            speaking = false;
            speechDeadline = 0;
            currentLineDrivesDesk = true;
            currentLineSpeaker = null;
        }
    }

    function cancelSpeech() {
        speechToken++;
        speechQueue.length = 0;
        speaking = false;
        currentLineDrivesDesk = true;
        currentLineSpeaker = null;
        GNNTTS.stop();
    }

    // ---------------------------------------------------------
    // Queue
    // ---------------------------------------------------------

    // Editorial weight halves every six hours on air. Keyword score alone is
    // time-blind: a story with three priority keywords from yesterday
    // outranked a plain one filed ten minutes ago and kept outranking it for
    // as long as it sat in the queue, so stale items displaced breaking ones.
    const RECENCY_HALFLIFE_H = 6;
    const DECAY_LAMBDA = Math.LN2 / RECENCY_HALFLIFE_H;

    function storyScore(item, nowMs) {
        const weight = item.importance || 0;
        const ts = item.timestamp || nowMs;
        // Future-dated pubDates turn up in the wild; clamp the age at zero so
        // a bad timestamp cannot score above a genuinely fresh item.
        const ageH = Math.max(0, (nowMs - ts) / 3600000);
        return weight * Math.exp(-DECAY_LAMBDA * ageH);
    }

    // No subject may appear twice inside a window this wide.
    const TOPIC_SPACING = 3;

    /**
     * Space the rundown out by subject.
     *
     * Score order alone runs every story about one event back to back: a dozen
     * feeds covering the same launch produce near-identical headlines that
     * score near-identically, so they sort into a block and the anchor reads
     * SpaceX four times running. Walk the sorted list and take the best item
     * whose subject has not aired in the last few slots. If the whole
     * remainder is one subject, take the best one anyway rather than stalling.
     */
    function interleaveByTopic(items) {
        const pending = items.slice();
        const out = [];
        const recent = [];
        while (pending.length) {
            let pick = pending.findIndex((it) => !it.topic || recent.indexOf(it.topic) < 0);
            if (pick < 0) pick = 0;
            const [item] = pending.splice(pick, 1);
            out.push(item);
            // Untagged items still consume a slot, so the window measures
            // distance in the rundown rather than distance between tagged items.
            recent.push(item.topic || null);
            if (recent.length > TOPIC_SPACING) recent.shift();
        }
        return out;
    }

    /**
     * Every feed category the current desk covers, as a Set.
     *
     * The desk is whoever is seated — the two anchors `main.js` pinned. Their
     * beats are unioned. If nothing is seated yet, or no seat carries a beat,
     * this returns null and `enqueueAll` skips the filter entirely, which is
     * the behaviour that existed before this change.
     *
     * When the show-block scheduler lands, a block's own `targetCategories`
     * can take precedence — this function is the right seam to override. The
     * scheduler will set `currentBlock` before `beginRead` runs and the beat
     * can be read from there instead.
     */
    function deskBeat() {
        if (typeof GNNRenderer === 'undefined' || !GNNRenderer.seatedIds) return null;
        if (typeof GNNCast === 'undefined') return null;
        const ids = GNNRenderer.seatedIds();
        if (!ids.length) return null;
        const set = new Set();
        let anyBeat = false;
        for (const id of ids) {
            const who = GNNCast.get(id);
            if (who && Array.isArray(who.beat)) {
                anyBeat = true;
                for (const b of who.beat) set.add(b);
            }
        }
        return anyBeat ? set : null;
    }

    function directorStoryKey(item) {
        return String((item && (item.ledgerKey || item.titleKey)) || (item && item.title) || '')
            .toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, ' ').trim();
    }

    /** Assign every wire item to exactly one show. Specific subject cues beat broad feed categories. */
    function targetShowFor(item) {
        const title = String(item.title || '');
        const text = (title + ' ' + String(item.description || '')).toLowerCase();
        const catRaw = String(item.category || '').toLowerCase().replace(/[^a-z]/g, '');
        const categoryAliases = {
            business: 'markets', finance: 'markets', economy: 'markets', economic: 'markets',
            technology: 'tech', ai: 'tech', artificialintelligence: 'tech',
            politics: 'diplomacy', international: 'world', worldnews: 'world',
            space: 'fleet', spaceflight: 'fleet', aerospace: 'fleet', mission: 'fleet',
            weird: 'anomaly', oddities: 'anomaly', environment: 'science', sports: 'sport',
            history: 'archive', historical: 'archive',
        };
        const category = categoryAliases[catRaw] || catRaw;
        const has = (re) => re.test(text);
        const isAI = has(/\b(ai|artificial intelligence|machine learning|neural network|chatgpt|openai|anthropic|claude|llm|robot|automation|semiconductor)\b/);
        const isResource = has(/\b(mining|mineral|minerals|rare earth|commodity|commodities|oil|gas|energy market|supply chain|metals|trade route|port|shipping)\b/);
        const isPolitical = has(/\b(election|parliament|congress|senate|government|minister|president|prime minister|campaign|legislation|policy|sanction|diplomacy|summit|treaty|war|ceasefire|peace talks|foreign affairs)\b/);
        const isDebate = has(/\b(debate|opposition|clash|showdown|court challenge|party leaders|contested|dispute)\b/);
        const isOdd = has(/\b(mysterious|anomal|unexplained|strange|oddity|extraterrestrial|alien life|ufo|unidentified|deep space signal|exoplanet|dark matter|cosmic mystery)\b/);
        const isSport = has(/\b(sport|football|soccer|basketball|baseball|hockey|tennis|olympic|championship|league|playoff|world cup|formula one|f1 racing)\b/);
        const isMarket = has(/\b(stock|stocks|market|markets|earnings|revenue|inflation|interest rate|central bank|economy|economic|currency|shares|investor|banking|profit|gdp|recession)\b/);
        const isSpaceTech = has(/\b(nasa|esa|rocket|spacecraft|spaceflight|satellite|orbit|launch|lunar|mars|asteroid|telescope|space station|astronaut|mission control)\b/);
        const isTech = has(/\b(software|cyber|cybersecurity|computer|chip|processor|quantum|internet|app|smartphone|data breach|vulnerability|technology|tech company)\b/);
        const isArchive = category === 'archive' || has(/\b(century ago|historical archive|from the archives|history of|anniversary of the|ancient civilization)\b/);
        const briefMatch = String(item.source || item.sourceUrl || '').match(/news_brief_(\d{4})(\d{2})(\d{2})/i);
        const briefTime = briefMatch ? Date.UTC(+briefMatch[1], +briefMatch[2] - 1, +briefMatch[3]) : 0;
        const sourceAgeDays = briefTime ? (Date.now() - briefTime) / 86400000 : 0;
        const oldRssAgeDays = item.timestamp ? (Date.now() - Number(item.timestamp)) / 86400000 : 0;

        if (isArchive || sourceAgeDays > 7 || (oldRssAgeDays > 21 && oldRssAgeDays < 3650)) return 'archives';
        if (isOdd || category === 'anomaly') return 'anomaly';
        if (isSport || category === 'sport') return 'evening_rim';
        if (isResource) return 'trade_minerals';
        if (isAI) return 'machine_intel';
        if (isMarket || category === 'markets') return 'economy';
        if (isDebate) return 'crossfire';
        if (isPolitical || category === 'diplomacy' || category === 'politics') return 'diplomacy';
        if (isSpaceTech || category === 'fleet' || category === 'space') return 'cybernetics';
        if (isTech || category === 'tech') return 'cybernetics';
        if (category === 'science') return 'cybernetics';
        // Split the general world pool between the two anchor desks.
        // Crossfire is defined as a show but nothing ever routed a story
        // to it, so its queue stayed empty on every block and the third
        // desk sat in DRY repeating the fallback lines until the hour
        // ended. Splitting the world pool guarantees it a live queue.
        if (category === 'world') {
            return Math.random() < 0.5 ? 'morning_watch' : 'crossfire';
        }

        // Digest sections often use bespoke headings. Keep them on the closest
        // editorial desk rather than letting the current show consume everything.
        if (/\b(market|business|trade|finance|industry)\b/.test(category)) return 'economy';
        if (/\b(tech|computer|cyber|science|research|space)\b/.test(category)) return 'cybernetics';
        if (/\b(politic|diplomat|government|conflict|war)\b/.test(category)) return 'diplomacy';
        return 'evening_rim';
    }

    function sortActiveQueue() {
        const now = Date.now();
        if (pinnedRundown && pinnedRundown.length) {
            const pinnedSet = new Set(pinnedRundown);
            const remaining = queue.filter((item) => !pinnedSet.has(item));
            remaining.sort((a, b) => storyScore(b, now) - storyScore(a, now));
            const interleaved = interleaveByTopic(remaining);
            const activePinned = pinnedRundown.filter((item) => queue.includes(item));
            queue = [...activePinned, ...interleaved];
        } else {
            queue.sort((a, b) => storyScore(b, now) - storyScore(a, now));
            queue = interleaveByTopic(queue);
        }
    }

    /** Switch active queue only at a cold-open boundary; leftovers remain reserved for their own show. */
    function activateShowQueue() {
        pinnedRundown = null;
        const target = getShowInfo().id;
        if (!activeQueueShowId) activeQueueShowId = target;
        if (activeQueueShowId !== target) {
            if (queue.length) {
                const oldBucket = showQueues[activeQueueShowId] || (showQueues[activeQueueShowId] = []);
                oldBucket.push(...queue);
                queue = [];
            }
            activeQueueShowId = target;
            // eslint-disable-next-line no-console
            console.log(`[GNN Director] queue -> ${target} `
                + `(leftovers returned to ${Object.keys(showQueues).join(', ') || 'none'})`);
        }
        const bucket = showQueues[target];
        if (bucket && bucket.length) {
            queue.push(...bucket);
            delete showQueues[target];
        }
        sortActiveQueue();
    }

    function enqueueAll(items) {
        if (!activeQueueShowId) activeQueueShowId = getShowInfo().id;
        const currentShow = activeQueueShowId;
        let assignmentsChanged = false;
        const addedByShow = Object.create(null);
        let addedCount = 0;
        for (const it of items || []) {
            if (!it || !it.title) continue;
            const key = directorStoryKey(it);
            if (!key || directorStoryKeys.has(key)) continue;
            // Some restored ledger records use the canonical key rather than
            // the exact title; track both so alternate sources do not re-enqueue.
            const titleKey = String(it.title || '').toLowerCase()
                .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, ' ').trim();
            if (directorStoryKeys.has(titleKey)) continue;

            // Always recompute the target. Do NOT trust it.targetShow from the
            // ledger: routing rules change (e.g. sport moving off morning_watch),
            // and a stored assignment would pin the story to the old show
            // forever across reloads.
            const target = targetShowFor(it);
            if (it.targetShow !== target) {
                it.targetShow = target;
                if (typeof GNNFeedManager !== 'undefined' && GNNFeedManager.setTargetShow) {
                    GNNFeedManager.setTargetShow(it, target);
                    assignmentsChanged = true;
                }
            }
            directorStoryKeys.add(key);
            directorStoryKeys.add(titleKey);
            if (target === currentShow) {
                queue.push(it);
            } else {
                const bucket = showQueues[target] || (showQueues[target] = []);
                bucket.push(it);
            }
            addedByShow[target] = (addedByShow[target] || 0) + 1;
            addedCount++;
        }
        sortActiveQueue();
        if (addedCount) {
            const breakdown = Object.entries(addedByShow).map(([show, count]) => show + '=' + count).join(', ');
            console.log('[GNN Director] assigned ' + addedCount + ' unique stories by show: ' + breakdown);
        }
        if (assignmentsChanged && typeof GNNFeedManager !== 'undefined' && GNNFeedManager.saveLedger) {
            GNNFeedManager.saveLedger();
        }
    }
    /**
     * Release stories from the held buckets back into the queue.
     *
     * The beat filter holds stories whose category the current desk does
     * not cover. With a Markets desk and a wire full of World news, that is
     * every incoming story — the desk sits in DRY saying "standing by for
     * the next relay" while hundreds of readable stories wait in a bucket.
     * That is not a station reading a rundown that has nothing on it; that
     * is a station that forgot its own bucket.
     *
     * Two passes. The first takes from categories the desk does cover, so a
     * Sports desk gets its Sports stories first. The second pass takes from
     * whatever is left — a Markets desk with no Markets stories airs the
     * World stories instead of going silent, because a channel reads what
     * the wire has and "the news" is not a category.
     *
     * The cap is six per call, so the queue does not go from empty to full
     * in one frame; the next call to `nextStory` will drain more if the
     * desk is still short.
     *
     * Called from `nextStory` before it gives up to DRY.
     */
    function drainHeld(maxItems = 6) {
        const beat = deskBeat();
        const taken = [];

        // First pass: categories the desk covers.
        for (const cat of Object.keys(heldByCategory)) {
            if (taken.length >= maxItems) break;
            if (!beat || !beat.has(cat)) continue;
            const bucket = heldByCategory[cat];
            while (bucket.length && taken.length < maxItems) {
                taken.push(bucket.shift());
            }
            if (!bucket.length) delete heldByCategory[cat];
        }

        // Second pass: whatever remains, if the preferred categories did
        // not fill the batch.
        if (taken.length < maxItems) {
            for (const cat of Object.keys(heldByCategory)) {
                if (taken.length >= maxItems) break;
                const bucket = heldByCategory[cat];
                while (bucket.length && taken.length < maxItems) {
                    taken.push(bucket.shift());
                }
                if (!bucket.length) delete heldByCategory[cat];
            }
        }

        if (!taken.length) return;
        taken.forEach((it) => queue.push(it));
        const now = Date.now();
        queue.sort((a, b) => storyScore(b, now) - storyScore(a, now));
        queue = interleaveByTopic(queue);
    }

    function injectBreaking(title, description) {
        pendingBreaking = {
            title: String(title || '').toUpperCase(),
            description: description || '',
            breaking: true,
            importance: 9999,
            timestamp: Date.now(),
        };
        // eslint-disable-next-line no-console
        console.log('[GNN Director] injectBreaking queued:', pendingBreaking.title);
    }

    /** Loose comparison: case, punctuation and spacing are not the story. */
    function norm(t) {
        return String(t || '').toLowerCase()
            .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    }

    /**
     * Does this sentence just say the headline again?
     *
     * The prefix test below catches a description that opens with the
     * headline verbatim. It does not catch one that *restates* it — the
     * BBC's hurricane coverage led with a reworded version of its own
     * headline, so the anchor read the story, then read it again. Word
     * overlap catches that where string matching cannot.
     */
    function restatesHeadline(sentence, title) {
        const tw = new Set(norm(title).split(' ').filter((w) => w.length > 3));
        if (tw.size < 3) return false;
        const sw = new Set(norm(sentence).split(' ').filter((w) => w.length > 3));
        if (!sw.size) return false;
        let shared = 0;
        tw.forEach((w) => { if (sw.has(w)) shared++; });
        return shared / tw.size >= 0.7;
    }

    /**
     * Strip a broadcasting label from the front of a headline.
     *
     * "IRAN WAR LIVE: TRUMP SAYS HOUTHIS" becomes "TRUMP SAYS HOUTHIS".
     * "WATCH LIVE: Election results" becomes "Election results". The
     * label is the feed's own filing marker — a note to its own reader
     * about what kind of item it is — and it was never part of the
     * headline for anybody else.
     *
     * Only strips when the last word before the colon is a broadcasting
     * keyword from a fixed list. "TRUMP: Iran deal close" is preserved,
     * because "TRUMP" is attribution, not a marker. And a strip that
     * would leave nothing substantial behind is not applied — a title
     * that was nothing but the label is left as-is rather than emptied.
     */
    function stripBroadcastLabel(title) {
        if (!title) return title;
        const m = title.match(BROADCAST_LABEL_RE);
        if (!m) return title;
        // Everything through the label's colon is metadata, not spoken
        // headline text. Do not restore it just because the actual headline
        // is short; only preserve the original if stripping empties it.
        const stripped = title.slice(m[0].length).trim();
        return stripped || title;
    }

    function storyText(item) {
        // Strip any broadcasting label first, before either the echo
        // detection or the restatement guard gets a chance to see it.
        // A label at the front of the headline is not part of the story,
        // and leaving it in confused both the string-match echo trim and
        // the anchor's own reading of the line.
        const title = stripBroadcastLabel((item.title || '').trim());
        let desc = (item.description || '').trim();
        if (!desc) return title.replace(/[.!?]?$/, '.');

        // Wires repeat themselves. A great many feeds put the headline at
        // the top of the summary, so reading title and description straight
        // through says the same sentence twice, and some truncate it part
        // way so the anchor trails off into a fragment of what they just
        // read. Drop whatever the description opens with that the headline
        // already said.
        const nt = norm(title);
        const nd = norm(desc);
        if (nd === nt || nd.startsWith(nt)) {
            desc = desc.slice(title.length).replace(/^[\s\-–—:.,]+/, '');
        } else {
            // A truncated echo: the description begins with a prefix of the
            // headline long enough that it cannot be coincidence.
            const words = nt.split(' ');
            for (let n = words.length; n >= 4; n--) {
                const head = words.slice(0, n).join(' ');
                if (nd.startsWith(head)) {
                    // Walk the raw string forward by the same word count.
                    let seen = 0;
                    let i = 0;
                    while (i < desc.length && seen < n) {
                        while (i < desc.length && !/[a-z0-9]/i.test(desc[i])) i++;
                        while (i < desc.length && /[a-z0-9]/i.test(desc[i])) i++;
                        seen++;
                    }
                    desc = desc.slice(i).replace(/^[\s\-–—:.,]+/, '');
                    break;
                }
            }
        }
        // Drop leading sentences that only restate the headline in other
        // words. The echo-stripping above is a string match and cannot see
        // a paraphrase; this is what made the anchor read the hurricane
        // story and then read it again.
        let guard = 0;
        while (desc && guard++ < 3) {
            const m = desc.match(/^[^.!?]+[.!?]/);
            const first = m ? m[0] : desc;
            if (!restatesHeadline(first, title)) break;
            desc = desc.slice(first.length).replace(/^[\s\-–—:.,]+/, '');
        }
        if (!desc) return title.replace(/[.!?]?$/, '.');
        // What is left of the summary now starts mid-sentence, so it needs
        // its capital back before it follows a full stop.
        desc = desc.charAt(0).toUpperCase() + desc.slice(1);
        const joiner = /[.!?]$/.test(title) ? ' ' : '. ';
        return (title + joiner + desc).replace(/\s+/g, ' ');
    }

    // A genuine emergency, not a word that turned up in a sentence.
    //
    // The old test fired on "killed" and "attack", which appear in a large
    // share of ordinary wire copy, so the red alert ran on most stories and
    // stopped meaning anything. It now wants an emergency word in the
    // headline — not buried in the body — and it will not fire twice inside
    // a few minutes however the wire reads.
    const BREAKING_WORDS =
        /\b(breaking|emergency|catastroph\w*|evacuat\w*|disaster|massacre)\b/i;
    const BREAKING_COOLDOWN_MS = 6 * 60 * 1000;
    let lastBreakingAt = 0;

    function isBreaking(item) {
        if (!item) return false;
        const now = performance.now();
        if (now - lastBreakingAt < BREAKING_COOLDOWN_MS) return false;
        const flagged = item.breaking || BREAKING_WORDS.test(item.title || '');
        if (!flagged) return false;
        lastBreakingAt = now;
        return true;
    }

    // ---------------------------------------------------------
    // Segments
    // ---------------------------------------------------------

    /**
     * The booth ident — the station's fixed opening announcement, read by
     * the station automation rather than by an anchor.
     *
     * Called from `main.js`'s `runBootSequence`, timed so the line finishes
     * just before the title card crossfades to the studio. The sounder
     * sting fires with it, so the line comes in over the sound.
     *
     * The line is read by `vox_unit` — Unit 7, the station's own machine
     * voice — because the anchor's own sign-on already names the station
     * ("I am Commander Hale. This is G N N..."). Hearing the anchor say
     * the station's name twice in five seconds reads as a stutter; a
     * separate machine voice making the announcement gives the ident its
     * own ceremonial beat, and then the anchor introduces themselves on
     * top of it.
     *
     * No caption. The ident plays under the boot card, where the canvas
     * is not visible — and a caption presented here lingers past the
     * fade, so the first thing seen after the card is the anchor's name
     * over the ident's text. The line is a station announcement heard
     * over the title card, not a broadcast caption, and it is `say`-ed
     * without one.
     *
     * The line itself is `BOOTH_IDENT_LINE`, a constant. It used to
     * draw at random from `GNNScript.ident()`, so every boot the station
     * identified itself with different words. A signature is not a
     * variant — the same words every time is what makes it a signature.
     *
     * Takes no arguments, and any line a caller passes is ignored. The
     * old signature accepted an optional `line` for the caller's estimate
     * of the ident's length; that estimate is now unnecessary, because
     * the ident's length is a constant that `main.js` can measure from
     * the same constant if it wants to.
     *
     * Returns the estimated duration in ms.
     */
    function boothIdent() {
        GNNAudio.play('intro_sfx_01', { gain: 0.55 });
        return say(BOOTH_IDENT_LINE, {
            voice: 'vox_unit',
            pitch: -6,
            speakerId: 'automation',
            drivesDesk: false,
            caption: null,
        });
    }

    /**
     * The top of the show, after the boot sequence.
     *
     * The station sounder and the booth ident have already been fired by
     * main.js's runBootSequence, timed so the ident ends as the picture
     * crossfades from the title card to the studio. By the time this
     * function runs, the viewer is looking at the studio and the robot's
     * voice is already out.
     *
     * Only the anchor's own sign-on happens here. It is queued after the
     * ident has finished and after the fade has completed, so there is no
     * window for it to pre-empt the ident — which is what caused the
     * non-deterministic "Hale cut off the robot" fault when both lines
     * were queued microseconds apart from this one function.
     *
     * The music bed is picked from the middle of the library so it does
     * not collide with the boot track that has just finished.
     *
     * The show block is swapped FIRST, before the sign-on is queued. That
     * order matters: `GNNScript.showOpen()` reads the lead anchor from the
     * renderer, so if the swap had not already happened, the sign-on would
     * be spoken by the *previous* block's lead while the picture showed the
     * new one. Swap, then read the desk, then set the voice, then speak.
     *
     * Two show-scoped state variables are reset here, not in
     * `beginShowClose`: the wall clock (`showStartedAt`) and the
     * correspondent flag (`correspondentUsed`). Setting them at the top of
     * the show means a cold open that fires for a different reason — a
     * boot with an empty queue, a resume after a skip — still gives the
     * new show a fresh fifteen minutes and its own one correspondent slot.
     */
    function beginColdOpen(now) {
        activateShowQueue();
        // eslint-disable-next-line no-console
        console.log('[GNN Director] cold open started (block ' + blockIndex + ')');
        setState(S.COLD_OPEN, now);

        // The top of the hour, as far as the show is concerned. Every
        // timing decision in `decideAfterRead` measures against this, and
        // every "is it time for the correspondent yet" check in
        // `beginBanter` does too.
        showStartedAt = now;
        correspondentUsed = false;
        // A new block starts with a clean DRY counter. Without this, a
        // block that closes early on a starved queue passes the counter
        // on to the next block, and the next block is closed on its very
        // first empty tick — one bad wire poisons the rest of the night.
        dryTicks = 0;

        // Move to this block's set, backdrop and seated pair in one call.
        // Synchronous, so nothing renders a half-swapped frame. No
        // transition — the picture changes on the next tick, which is a
        // hard cut from the previous show's closing shot to the new room.
        if (typeof GNNRenderer !== 'undefined' && GNNRenderer.setShowBlock) {
            GNNRenderer.setShowBlock(blockIndex);
        }

        // The new lead anchor reads the sign-on, so the station speaks with
        // that character's voice rather than whatever was left over from
        // the previous block. Same pattern the initial boot uses in
        // main.js's init() — set voice, then queue the line that uses it.
        //
        // `GNNScript.desk()` reads the renderer's *current* seated pair,
        // which is why this must come after the setShowBlock call above.
        const seats = GNNScript.desk();
        const lead = seats[0];
        if (lead && lead.voice) GNNTTS.setVoice(lead.voice);

        const beds = GNNAssets.musicTracks();
        if (beds.length) {
            GNNAudio.playMusic(beds[8 % beds.length].id,
                { gain: 0.55, loop: false, fadeIn: 0.4 });
        }

        const showInfo = getShowInfo();
        const rundownLines = (typeof GNNScript !== 'undefined' && GNNScript.rundownOpen)
            ? GNNScript.rundownOpen(queue, showInfo) : null;
        if (rundownLines && rundownLines.length) {
            pinnedRundown = (rundownLines.teasedStories && rundownLines.teasedStories.length)
                ? rundownLines.teasedStories.slice()
                : null;
            const totalMs = queueTaggedLines(rundownLines, { kind: 'headline' });
            holdUntil = now + Math.max(3800, totalMs + 800);
        } else {
            pinnedRundown = null;
            const open = GNNScript.showOpen(showInfo);
            const openMs = say(open, {
                caption: {
                    kind: 'ident', cue: showInfo.desk || 'STATION IDENT',
                    chyron: showInfo.title ? showInfo.title.toUpperCase() : 'GALACTIC NEWS NETWORK'
                }
            });
            holdUntil = now + Math.max(3200, openMs + 900);
        }
    }

    function beginRead(now, item) {
        current = item;
        passChair();
        storiesRead++;
        sinceBreak++;
        sinceIdent++;
        cutawayFired = false;
        banterStreak = 0;

        const breaking = isBreaking(item);
        // eslint-disable-next-line no-console
        console.log('[GNN Director] reading story #' + storiesRead + (breaking ? ' [BREAKING]' : '') + ':', item.title);

        if (typeof window !== 'undefined' && window.GNNTranscript && window.GNNTranscript.logStory) {
            window.GNNTranscript.logStory({
                title: item.title,
                category: item.category,
                importance: item.importance,
                source: item.source || item.sourceUrl || item.link,
                sourceUrl: item.sourceUrl || item.link,
                breaking: breaking,
                index: storiesRead,
            });
        }

        // Trim once, here, so the caption, the segment's clock and the
        // voice are all reading the same words. Synthesis caps a line at
        // 900 characters; when the teleprompter was handed the untrimmed
        // story it kept scrolling after the audio had finished and the
        // anchor sat there with her mouth shut mid-sentence.
        //
        // `storyText` also strips broadcasting labels ("LIVE:", "WATCH
        // LIVE:") from the headline, and that strip covers both this
        // voice read and the caption below — they both take their text
        // from the same string.
        let rawText = storyText(item);
        if (breaking && typeof GNNScript !== 'undefined' && GNNScript.breakingIntro) {
            rawText = GNNScript.breakingIntro() + ' ' + rawText;
        }

        const text = GNNTTS.trimForSynthesis
            ? GNNTTS.trimForSynthesis(rawText)
            : rawText;
        readEstimate = GNNTTS.estimateMs(text);

        const caption = {
            kind: breaking ? 'breaking' : 'headline',
            cue: breaking ? '⚡ BREAKING TRANSMISSION' : 'SECTOR DESK',
            chyron: breaking ? 'BREAKING — ' + GNNScript.chyron(item)
                : GNNScript.chyron(item),
        };

        if (breaking) {
            GNNAudio.playKlaxon();
            GNNGlitch.flagBreaking(now);
        } else {
            GNNAudio.playRole('blip', { gain: 0.4 });
        }

        GNNCutsceneManager.prefetch(item);
        say(text, {
            caption,
            headline: item.title,
            sourceUrl: item.sourceUrl || item.link,
        });

        // Warm the next story while this one reads. Synthesis takes a fifth
        // of a second to a second and a half depending on length, and the
        // director waits on it, so without this every story starts with a
        // pause that scales with how long it is.
        const upcoming = queue[0];
        if (upcoming && GNNTTS.prefetch) GNNTTS.prefetch(storyText(upcoming));
        setState(S.READ, now);
        if (onStory) onStory(item);
    }

    function beginHold(now, range, nextState) {
        holdUntil = now + rand(range || PACE.holdAfterRead);
        setState(S.HOLD, now);
        holdNext = nextState;
    }
    let holdNext = null;

    /**
     * Two anchors talking to each other instead of at the camera.
     *
     * `GNNScript.exchange()` draws from the asymmetric relationship table
     * in `js/cast.js` — the specific opinion one anchor holds of another,
     * with an optional follow and close now that the entries carry them.
     * A quick entry produces a two-line beat; an extended one produces
     * four. Each line is tagged with who says it, so each goes out in
     * that character's own voice and the animating plate follows.
     *
     * Queue all the lines at once. The pump plays them one at a time in
     * order, with the 420 ms beat of air between them. The old per-line
     * `setTimeout` approach was a workaround from before the queue
     * existed — it left stale lines in the pipeline whenever the beat was
     * cancelled mid-flight, and its token guard only checked the token
     * once, at the moment it queued the follow-up line.
     *
     * Returns true when the beat was queued.
     */
    function beginExchange(now) {
        const lines = GNNScript.exchange();
        if (!lines || lines.length < 2) return false;
        banterStreak++;
        setState(S.BANTER, now);
        const total = queueTaggedLines(lines);
        holdUntil = now + total + 1200;
        return true;
    }

    /**
     * A structured beat between the two anchors — separate from
     * `beginExchange()`, which draws on the relationship table for a
     * specific opinion. This one uses each anchor's own banks on the cast
     * sheet (`openers`, `reactions`, `closers`) to build a short
     * conversation: opener, reaction, optionally one more volley, close.
     *
     * The point is to make the desk feel inhabited rather than reading
     * single canned asides. `banter()` is still called when the beat is
     * just one line — this is the two-anchor path.
     *
     * Returns true when the beat was queued.
     */
    function beginStructuredBeat(now) {
        if (typeof GNNScript.banterBeat !== 'function') return false;
        const lines = GNNScript.banterBeat(current);
        if (!lines || lines.length < 2) return false;
        banterStreak++;
        setState(S.BANTER, now);
        const total = queueTaggedLines(lines);
        holdUntil = now + total + 1000;
        return true;
    }

    /**
     * Build the lines of a Council Crossfire debate: a moderator and two
     * guests taking opposite sides.
     *
     * Draws on the same cast banks the rest of the station draws on, plus
     * the relationship table for the direct exchange in the middle. The
     * table between two arbitrary guests is deliberately sparse, so the
     * direct exchange is a bonus beat rather than a required one — if the
     * pair have no relationship entry, the debate still has a moderator
     * opening, two openings, two rebuttals, a follow-up and a closer.
     *
     * Roughly 10-12 lines, which lands around ninety seconds once the
     * pump's inter-line gaps are counted. That is the length a debate
     * slot wants: shorter than the panel two-way's two minutes because
     * the format is tighter — three voices trading a position, not four
     * rounds of question-and-answer.
     *
     * Every line carries a speaker so `queueTaggedLines` can pick the
     * right voice. The two guests are tagged `drivesDesk: false` by the
     * caller — they are in the monitors, and the moderator's mouth is the
     * only one that moves while they talk.
     */
    function buildDebateLines(host, guestA, guestB) {
        const lines = [];
        const line = (who, kind, fallback) =>
            GNNCast.line(kind, who.id) || fallback;

        // Moderator opens. The `asks` bank is framed at a correspondent,
        // which is the right register for putting a question to a guest.
        lines.push({
            who: host,
            text: line(host, 'asks',
                'Let us start with the position each of you is taking.'),
        });
        // Guest A states a position.
        lines.push({
            who: guestA,
            text: line(guestA, 'openers',
                'I will start with what the record actually shows.'),
        });
        // Guest B's immediate rebuttal.
        lines.push({
            who: guestB,
            text: line(guestB, 'reactions',
                'That is a selective reading of the same record.'),
        });

        // A direct exchange if the pair have a relationship. The table is
        // deliberately sparse — the current cast has entries between
        // specific pairs only — so this is a bonus beat, not a required
        // one. Try both directions; the tables are asymmetric by design,
        // so a line from A aimed at B is different from one from B aimed
        // at A, and either can be the one that exists.
        const rel = GNNCast.exchange(guestA.id, guestB.id)
            || GNNCast.exchange(guestB.id, guestA.id);
        if (rel) {
            lines.push({ who: guestA, text: rel.jab });
            lines.push({ who: guestB, text: rel.reply });
            if (rel.follow) {
                lines.push({ who: guestA, text: rel.follow });
                if (rel.close) lines.push({ who: guestB, text: rel.close });
            }
        }

        // Second round. The moderator probes, both guests take another
        // pass. The order is B-then-A so the last word is with the guest
        // who did not speak immediately before the moderator's question.
        lines.push({
            who: host,
            text: line(host, 'followups',
                'Both of you are using the same evidence for opposite conclusions.'),
        });
        lines.push({
            who: guestB,
            text: line(guestB, 'openers',
                'The evidence is what it is. The question is what it licenses.'),
        });
        lines.push({
            who: guestA,
            text: line(guestA, 'reactions',
                'That is the same argument with a different label on it.'),
        });

        // Moderator closes the segment.
        lines.push({
            who: host,
            text: line(host, 'closers',
                'That is where we leave it. We will revisit when the next filing lands.'),
        });

        return lines;
    }

    /**
     * A Council Crossfire debate. Two guests in the dual PIP monitors,
     * the anchor at the desk between them.
     *
     * The whole reason `openDebate()` exists in `cutscene-manager.js` is
     * this block. A crossfire show that opens a single-monitor two-way is
     * a normal interview — the polarized panel format that makes the
     * show what it is only appears when two guests are on screen at once
     * and can be seen arguing rather than waiting their turns off camera.
     *
     * Same arming pattern as `beginTwoWay`. The flag is set synchronously
     * before the await, `update()`'s BANTER case refuses to advance while
     * it is held, and `finally` clears it whether the monitors opened or
     * not. Without the flag the frame loop would see `!speaking` in the
     * window the await opens and fall through to a HOLD under the debate
     * that has not yet queued its lines.
     *
     * Returns `true` when the debate was queued (and the monitors are
     * open), `false` when there was no pairing to pick or either guest's
     * plates failed to load. The caller latches `correspondentUsed` on a
     * `true` return, so a debate that never opened does not consume the
     * show's one correspondent slot.
     */
    async function beginDebate(now) {
        if (typeof GNNCast === 'undefined') return false;
        const seats = GNNScript.desk();
        if (!seats.length) return false;
        const seated = new Set(seats.map((p) => p.id));
        // The pool: everyone not at this desk, not a machine, and with a
        // correspondent plate on disk. The plate test is what stops the
        // debate opening with a guest whose monitor would be empty —
        // `openDebate()` builds both PIP windows from the same
        // `correspondentScene()` loader that a two-way uses, and it
        // returns `false` if either plate is missing. Filtering here means
        // the pick is made against the plates that actually exist rather
        // than discovering it after the image loads have already run.
        const away = GNNCast.all().filter(
            (p) => !seated.has(p.id) && !p.machine
                && CORRESPONDENT_READY.has(p.id));
        if (away.length < 2) return false;

        // Two guests, picked at random. Fisher-Yates on a copy so the
        // cast registry is not reordered — `all()` returns a fresh array
        // from `Object.keys(CAST)`, but the shuffle is on a slice anyway
        // because the pattern is worth keeping honest.
        const shuffled = away.slice();
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = (Math.random() * (i + 1)) | 0;
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const guestA = shuffled[0];
        const guestB = shuffled[1];
        const host = seats[0];

        const lines = buildDebateLines(host, guestA, guestB);
        if (!lines.length) return false;

        const kind = current ? GNNCutsceneManager.routeFor(current) : null;

        twoWayArming = true;
        try {
            const opened = await GNNCutsceneManager.openDebate(
                guestA.id, guestB.id, kind, performance.now(),
                guestA.name.toUpperCase(), guestB.name.toUpperCase());
            if (!opened) return false;

            // Queue all lines synchronously now the monitors are open.
            // The two guests are in the monitors, so their lines do not
            // turn the desk or open the moderator's mouth. The host's
            // lines do — he is the one at the desk, and the animator is
            // driven off the same `drivesDesk` flag the two-way uses.
            const guestIds = new Set([guestA.id, guestB.id]);
            const total = queueTaggedLines(lines, {
                // Guests through a monitor sit a little lower in pitch,
                // the same as a field correspondent in a two-way. The
                // moderator reads at the standard anchor pitch.
                pitch: (id) => guestIds.has(id) ? -1 : -3,
                drivesDesk: (id) => !guestIds.has(id),
            });

            // Drop both monitors when the beat ends, not on a fixed
            // timer. The ceiling scales with the beat length so a longer
            // debate is not cut short by a hardcoded timeout.
            drainSpeech(total * 3 + 20000).then(() => {
                if (GNNCutsceneManager.isTwoWay()) GNNCutsceneManager.endCutaway();
            });

            holdUntil = now + total + 1200;
            return true;
        } finally {
            twoWayArming = false;
        }
    }

    /**
     * A remote two-way. The correspondent appears in the monitor and the
     * lines go out in order through the speech queue, so the anchor
     * finishes asking before the reporter starts answering — which is the
     * whole reason the queue exists.
     *
     * `GNNScript.twoWay()` returns one of four shapes — brief (2 lines),
     * standard (3 lines), extended (5 lines), or panel (16 lines, ~2
     * minutes) — and this function queues however many come back without
     * caring which. `opts.shape` may force a specific shape; the director
     * uses it to guarantee a panel for the show's one correspondent slot.
     *
     * The correspondent's answering lines are tagged `drivesDesk: false`,
     * so the anchor's mouth stays shut while the correspondent talks. They
     * also carry `speakerId`, so the caption label reads the right name
     * and `activeSeatForLine()` can return -1 to tell the renderer and the
     * text engine that no anchor is speaking.
     *
     * ------------------------------------------------------------------
     * RETURNS A PROMISE. The monitor has to open before the lines are
     * queued, because `GNNCutsceneManager.openTwoWay()` returns `false`
     * when there is no plate for the correspondent on disk — and a
     * two-way whose audio plays over the story icon while the monitor
     * stays shut is worse than no two-way at all.
     *
     * The earlier shape of this function was synchronous and returned
     * `true` unconditionally, on the theory that queueing the lines first
     * put `speaking = true` before any frame could run and closed the
     * window that used to make the two-way play over the top of the story
     * it was meant to replace (CLAUDE.md §3, "The two-way played over the
     * story it replaced"). It did close that window, but it also made the
     * check on `openTwoWay`'s return value impossible — the caller could
     * not distinguish "monitor open, correspondent speaking" from
     * "correspondent's plate is missing, no monitor at all", so it set
     * `correspondentUsed = true` in both cases and the show lost its one
     * correspondent slot to a beat the viewer never saw.
     *
     * The `twoWayArming` flag restores the earlier fix without giving up
     * the newer one: the flag is set synchronously *before* the await, and
     * the BANTER/WIRE case in `update()` refuses to advance while it is
     * held. So no frame can run in the window the await opens, which is
     * what the synchronous version was really protecting against.
     *
     * Returns `true` when the two-way was queued (and the monitor is open),
     * `false` when it was not (no correspondent in the cast, or the
     * correspondent's plate failed to load). The caller uses that return
     * to decide whether to set `correspondentUsed` and whether to fall
     * through to the exchange/plain-banter paths.
     * ------------------------------------------------------------------
     */
    async function beginTwoWay(now, opts = {}) {
        const tw = GNNScript.twoWay(opts);
        if (!tw) return false;

        const correspondentId = tw.correspondent.id;
        const kind = current ? GNNCutsceneManager.routeFor(current) : null;

        // Reserve the BANTER slot before the await. `beginBanter` has
        // already set state and bumped banterStreak synchronously, so the
        // only thing this flag adds is the guarantee that the BANTER case
        // in `update()` will not fall through to a HOLD while the monitor
        // is still opening.
        twoWayArming = true;
        try {
            const opened = await GNNCutsceneManager.openTwoWay(
                tw.correspondent.id, kind, performance.now(),
                tw.correspondent.name.toUpperCase());

            if (!opened) {
                // No plate for this correspondent on disk, or a break is
                // active. Do not queue the lines — the caller falls
                // through to a normal banter beat instead.
                return false;
            }

            // The monitor is up. Queue the lines now — every part of this
            // runs synchronously before the next frame.
            const total = queueTaggedLines(tw.lines, {
                // The correspondent's lines sit a little lower in pitch — a
                // field reporter through a monitor, not an anchor at the desk.
                pitch: (id) => id === correspondentId ? -1 : -3,
                // Only the anchor's lines turn the desk; the correspondent's
                // do not, because they are not at the desk to turn.
                drivesDesk: (id) => id !== correspondentId,
            });

            // Drop the monitor once the exchange is over, not on a timer.
            // Ceiling scales with the beat length so a long panel is not cut
            // short by a hardcoded timeout.
            drainSpeech(total * 3 + 20000).then(() => {
                if (GNNCutsceneManager.isTwoWay()) GNNCutsceneManager.endCutaway();
            });

            holdUntil = now + total + 1200;
            return true;
        } finally {
            twoWayArming = false;
        }
    }

    /**
     * Pick the beat to run after a story.
     *
     * On a debate show — see `DEBATE_BLOCKS` — this tries a split-screen
     * debate first. Council Crossfire's format is a shouting match, and
     * a single-monitor two-way does not deliver it. The debate is the
     * show's reserved correspondent slot: once it fires, the rest of the
     * show runs on the normal banter beats and the block's one slot is
     * spent.
     *
     * On any other show: one two-way per show. The guaranteed one is
     * forced in the second half, and it is forced as a *panel* — the
     * two-minute three-way the change request asked for. Before the
     * second half, a two-way can still fire on the normal
     * `PACE.twoWayShare` draw, and those use whatever shape
     * `GNNScript.twoWay()` rolls naturally (brief, standard or extended)
     * since they are not the show's reserved interview slot.
     *
     * Past halfway with no correspondent yet, every banter beat attempts
     * a panel until it succeeds. If there is no away-correspondent in the
     * cast — everything is seated — `beginTwoWay` returns `false` and the
     * beat falls through to the exchange and plain-banter paths; the show
     * runs without a correspondent rather than stalling.
     *
     * Once the correspondent has been used, no further two-ways fire this
     * show. That is the whole of the "one per show" rule.
     *
     * ------------------------------------------------------------------
     * This function is async. The caller in `update()` fires it without
     * awaiting — the arming flag and the synchronous BANTER state set
     * below are what keep the frame loop from doing anything wrong while
     * the await is open. See the long comment on `beginTwoWay` for the
     * full picture.
     * ------------------------------------------------------------------
     */
    async function beginBanter(now) {
        const show = getShowInfo();

        // Debate shows prefer a debate over a normal two-way. Everything
        // else falls through to the two-way logic below unchanged.
        //
        // The check is `!correspondentUsed` because the debate is the
        // show's one reserved interview slot, exactly like the panel is
        // for the non-debate blocks. Once a debate has run, the rest of
        // the show uses the normal beats; without the latch every banter
        // beat on the crossfire block would try to open a debate, which
        // is both a lot of monitors and a lot of the same two guests.
        if (DEBATE_BLOCKS.has(show.id) && !correspondentUsed) {
            setState(S.BANTER, now);
            banterStreak++;
            if (await beginDebate(now)) {
                correspondentUsed = true;
                return;
            }
            // No two away guests with plates, or the monitors failed to
            // open. Refetch the clock — the await above is a window the
            // frame loop ran in — and fall through to the normal beat.
            // `beginDebate`'s `finally` has cleared `twoWayArming`, so
            // the frame loop is free to advance the state if this
            // fall-through does not land within a tick.
            now = performance.now();
        }

        const elapsed = now - showStartedAt;
        const secondHalf = elapsed >= SHOW_MS * 0.5;
        // The panel is the show's reserved interview slot, so it is only
        // forced — a random draw in the first half still gets whatever
        // shape the roll produces.
        const forcePanel = !correspondentUsed && secondHalf;
        const rollForTwoWay = !correspondentUsed
            && (secondHalf || Math.random() < PACE.twoWayShare);
        if (rollForTwoWay) {
            // Reserve BANTER *before* the async two-way opens.
            //
            // `openTwoWay` awaits image loads; in the meantime the
            // director's HOLD case would see `!speaking` and fall through
            // to `nextStory()`, so the two-way played over the top of the
            // story it was meant to replace. This state set is synchronous
            // — the flag `twoWayArming` inside `beginTwoWay` closes the
            // rest of the window, and the BANTER case in `update()`
            // checks it.
            setState(S.BANTER, now);
            banterStreak++;
            const opts = forcePanel ? { shape: 'panel' } : {};
            if (await beginTwoWay(now, opts)) {
                correspondentUsed = true;
                return;
            }
            // No away-correspondent to call, or the correspondent's plate
            // failed to load. Fall through to the exchange and plain-banter
            // paths. BANTER state was already set above, which is harmless
            // — `beginExchange`, `beginStructuredBeat` and `beginPlainBanter`
            // all set it again for the same reason.
            //
            // Refetch the clock: the await above is a window the frame loop
            // ran in, and every fall-through path uses `now` to compute its
            // hold window. Using the stale value would shorten the beat by
            // however long the two-way's image loads took.
            now = performance.now();
        }
        if (Math.random() < PACE.exchangeShare) {
            if (beginExchange(now)) return;
            // No relationship between this pair worth airing — the table
            // is deliberately sparse. Fall through to the bank-driven
            // beat before the single-line path.
            if (beginStructuredBeat(now)) return;
        }
        beginPlainBanter(now);
    }

    function beginPlainBanter(now) {
        const wire = Math.random() < PACE.wireShare;
        const who = speaker();
        const line = wire ? GNNScript.sectorWire(current)
            : GNNScript.banter(current, who);
        if (!line) { beginHold(now, PACE.holdAfterBanter, S.READ); return; }
        banterStreak++;
        const est = say(line, {
            pitch: wire ? -6 : -3,
            // Tagged with the chair, since plain banter is a single-voice
            // aside from whoever is currently reading.
            speakerId: who ? who.id : null,
            caption: {
                kind: wire ? 'wire' : 'banter',
                cue: wire ? 'SECTOR WIRE' : 'ANCHOR COMMENT'
            }
        });
        if (wire) GNNAudio.playRole('chirp', { gain: 0.3 });
        setState(wire ? S.WIRE : S.BANTER, now);
    }

    function beginToss(now) {
        const line = GNNScript.toss();
        const who = speaker();
        const est = say(line, {
            speakerId: who ? who.id : null,
            caption: { kind: 'banter', cue: '' }
        });
        setState(S.TOSS, now);
    }

    function beginIdent(now) {
        sinceIdent = 0;
        nextIdentAt = randInt(PACE.storiesPerIdent);
        const line = GNNScript.ident();
        const est = say(line);
        GNNTextEngine.present(line, {
            kind: 'ident', cue: 'STATION IDENT',
            chyron: 'GALACTIC NEWS NETWORK', durationMs: est,
        });
        GNNAudio.play('intro_sfx_01', { gain: 0.45 });
        setState(S.IDENT, now);
    }

    async function beginBreak(now) {
        if (breakArming) return;
        // eslint-disable-next-line no-console
        console.log('[GNN Director] commercial break started');
        sinceBreak = 0;
        nextBreakAt = randInt(PACE.storiesPerBreak);
        setState(S.BREAK, now);
        // Assembling a break means loading a dozen composited scenes. Hold the
        // state machine here for the whole assembly, or the desk comes back on
        // air underneath the commercial.
        breakArming = true;
        cancelSpeech();
        // Thrown to the break by whoever has the chair, rather than cutting
        // from a story straight into an advert.
        const toss = GNNScript.intoBreak();
        const who = speaker();
        // Through the queue like everything else, and *awaited* — the
        // commercials must not start underneath the throw to them.
        say(toss, {
            speakerId: who ? who.id : null,
            caption: { kind: 'ad', cue: 'COMMERCIAL BREAK', chyron: '' }
        });
        await drainSpeech();
        GNNCutsceneManager.endCutaway();
        let total = 0;
        try {
            total = await GNNCutsceneManager.startCommercialBreak(now);
        } finally {
            breakArming = false;
        }
        if (!total) { beginHold(performance.now(), [200, 400], S.READ); return; }
        // Wait for the last commercial to actually leave the screen. The
        // assembly promise resolves when the break is *built*, not when it
        // has finished playing, so coming back on it put the anchor's
        // voice over the final advert.
        for (let i = 0; i < 400 && GNNCutsceneManager.isBreakActive(); i++) {
            await new Promise((r) => setTimeout(r, 150));
        }
        // The return from break, once, here.
        //
        // This used to fire twice: `update()`'s S.BREAK case played one line
        // the moment `isBreakActive()` went false, and this continuation
        // played another. The viewer heard "we now return you to regular
        // orbital programming" followed by "and we are back" — the second
        // redundant with the first. The S.BREAK case in `update()` has been
        // removed; the return belongs to whoever started the break, and that
        // is this function.
        const back = GNNScript.signoff();
        const est = say(back, { caption: { kind: 'ident', cue: 'BACK LIVE' } });
        beginHold(performance.now(), [est + 600, est + 1200], S.READ);
    }

    function beginDry(now) {
        const line = GNNScript.hold();
        const est = say(line, { caption: { kind: 'hold', cue: 'STANDING BY' } });
        holdUntil = now + rand(PACE.dryLoop);
        setState(S.DRY, now);
    }

    // ---------------------------------------------------------
    // Main tick
    // ---------------------------------------------------------

    function update(now) {
        if (!running) return;

        checkSpeechWatchdog(now);
        GNNCutsceneManager.update(now);

        // Breaking news pre-empts everything except an active break.
        if (pendingBreaking && state !== S.BREAK && !breakArming) {
            const item = pendingBreaking;
            pendingBreaking = null;
            cancelSpeech();
            GNNCutsceneManager.endCutaway();
            beginRead(now, item);
            return;
        }

        switch (state) {
            case S.BOOT:
                // Hold here until the boot sequence releases us. The
                // station renders behind the boot overlay but starts no
                // rundown and makes no sound until the boot track ends and
                // main.js sets `window.GNNBootReady` — see main.js's
                // `runBootSequence`. That window is what fixes the
                // first-minute weirdness: TTS pipeline warm-up, first
                // feed poll, anchor plates and icon plates all have the
                // track's runtime to settle before a line is spoken.
                if (typeof window !== 'undefined' && !window.GNNBootReady) {
                    break;
                }
                // Open on the first story, but never wait on the feed forever —
                // an empty rundown is still a broadcast, it is just a quiet one.
                if (queue.length) beginColdOpen(now);
                else if (!bootDeadline) bootDeadline = now + 3000;
                else if (now > bootDeadline) beginColdOpen(now);
                break;

            case S.COLD_OPEN:
                if (!speaking && now >= holdUntil) nextStory(now);
                break;

            case S.READ: {
                if (!cutawayFired && GNNTextEngine.progress() >= PACE.cutawayAt) {
                    cutawayFired = true;
                    if (Math.random() < PACE.cutawayChance) {
                        GNNCutsceneManager.triggerCutaway(current, now);
                    }
                }
                // Generous: the clip has to be synthesised before a word of
                // it is heard, and cutting a story short is worse than letting
                // a stuck one run long. The speech watchdog is the real
                // backstop.
                const overrun = now - stateSince > readEstimate * 1.8 + 20000;
                if ((!speaking && !GNNTextEngine.isTyping()) || overrun) {
                    if (overrun) GNNTextEngine.finishTyping();
                    decideAfterRead(now);
                }
                break;
            }

            case S.HOLD:
                // A hold is dead air *after* a line, never a guillotine on
                // one. Every other transition waits for the anchor to finish;
                // this one used to run a bare timer, so anything spoken
                // immediately before a hold — the sign-off coming out of a
                // commercial break especially — was cut mid-sentence.
                if (now >= holdUntil && !speaking) {
                    const next = holdNext;

                    if (next === S.BREAK) {
                        holdNext = null;
                        beginBreak(now);
                    } else if (next === S.BANTER) {
                        holdNext = null;
                        beginBanter(now);
                    } else if (next === S.TOSS) {
                        holdNext = null;
                        beginToss(now);
                    } else if (next === S.IDENT) {
                        holdNext = null;
                        beginIdent(now);
                    } else if (next === S.COLD_OPEN) {
                        // Between-show transition. Three cases:
                        //
                        //   1. No bumper available, or block 0 (the boot
                        //      block, whose page-load boot sequence is
                        //      main.js's own and not the director's).
                        //      Run the cold open directly.
                        //
                        //   2. A bumper is available and none is
                        //      pending. Hand the transition to it and
                        //      wait — do NOT clear `holdNext`, because
                        //      the HOLD case will re-fire on the next
                        //      tick and needs to recognise that a
                        //      bumper is already running.
                        //
                        //   3. A bumper is already pending. Refuse to
                        //      advance. The bumper owns the transition;
                        //      it will call `handoffColdOpen()` when it
                        //      has finished its slate/card/fade
                        //      sequence, which clears both flags and
                        //      runs the cold open in one step.
                        //
                        // The safety timeout covers the case where a
                        // bumper hit an exception between `play()` and
                        // `handoffColdOpen()`: rather than deadlocking
                        // the state machine on a callback that is never
                        // coming, wait out the timeout and run the
                        // cold open directly.
                        if (coldOpenPending) {
                            if (now - coldOpenPendingSince
                                > BUMPER_HANDOFF_TIMEOUT_MS) {
                                console.warn(
                                    '[GNN Director] bumper handoff timed '
                                    + 'out after '
                                    + Math.round(BUMPER_HANDOFF_TIMEOUT_MS / 1000)
                                    + 's — running cold open directly');
                                coldOpenPending = false;
                                coldOpenPendingSince = 0;
                                holdNext = null;
                                beginColdOpen(now);
                            }
                            // Otherwise: bumper is running, wait.
                        } else if (blockIndex > 0
                            && typeof window !== 'undefined'
                            && window.GNNBumper && window.GNNBumper.play) {
                            coldOpenPending = true;
                            coldOpenPendingSince = now;
                            // eslint-disable-next-line no-console
                            console.log('[GNN Director] handing cold open to bumper');
                            window.GNNBumper.play();
                            // holdNext stays S.COLD_OPEN. The bumper
                            // calls handoffColdOpen() when it has
                            // finished.
                        } else {
                            holdNext = null;
                            beginColdOpen(now);
                        }
                    } else {
                        holdNext = null;
                        nextStory(now);
                    }
                }
                break;

            case S.BANTER:
            case S.WIRE:
                // Reserved by an in-flight two-way or debate.
                // `beginTwoWay()` and `beginDebate()` both await the
                // monitors opening — image loads — and the frame loop keeps
                // running while they do. Any frame that lands in that
                // window sees `speaking === false` and would otherwise
                // fall through to a HOLD and start the next story under a
                // beat that has not queued its lines yet. The flag is
                // cleared in the `finally` block of whichever opener is
                // running, at which point either the lines are queued
                // (`speaking` is true and the case below waits naturally)
                // or the opener failed and the caller's fall-through has
                // already decided where to go next.
                if (twoWayArming) break;
                if (!speaking && !GNNTextEngine.isTyping()) {
                    if (banterStreak < 2 && Math.random() < PACE.doubleBanterChance) {
                        beginHold(now, [600, 1400], S.BANTER);
                    } else if (Math.random() < PACE.tossChance) {
                        beginHold(now, PACE.holdAfterBanter, S.TOSS);
                    } else {
                        beginHold(now, PACE.holdAfterBanter, S.READ);
                    }
                }
                break;

            case S.TOSS:
            case S.IDENT:
                if (!speaking && !GNNTextEngine.isTyping()) {
                    beginHold(now, PACE.breathAfterToss, S.READ);
                }
                break;

            // No S.BREAK case. `beginBreak()` owns the return — it is the
            // function that put the break on air, and it is the one that
            // knows when the last advert has finished playing. When the
            // case was here, both it and the continuation played a
            // back-live line and the viewer heard the same announcement
            // twice. The state still exists; nothing runs while it is set.

            case S.DRY: {
                // Cap the number of consecutive DRY ticks. Without this a
                // block with an empty queue re-fires the same fallback
                // lines forever — DRY plays a HOLD line, HOLD calls
                // nextStory, nextStory finds the queue empty, DRY plays
                // another line. The counter never advances the block
                // because it never used to: the old fallback called
                // `this.advanceBlock` which does not exist, so it landed
                // on `setState(S.HOLD)`, which loops straight back here.
                //
                // The correct escape hatch is `beginShowClose` — the same
                // call the DRY timeout branch below uses when the clock
                // runs out. It signs the lead off, queues a HOLD with
                // `holdNext = S.COLD_OPEN`, and the bumper picks up from
                // there. Eight ticks at `PACE.dryLoop` is roughly fifty
                // to ninety seconds of stall before the station gives up
                // on the block, which is long enough to feel like a
                // normal gap in the wire and short enough that the
                // viewer does not start changing channels.
                dryTicks++;
                if (dryTicks > 8) {
                    dryTicks = 0;
                    console.log('[GNN Director] DRY limit hit — closing show early');
                    beginShowClose(now);
                    break;
                }
                if (queue.length) { nextStory(now); break; }
                // The show should still end on time even if the wire has
                // gone quiet. Airtime does not pause because the feed did,
                // and a channel that sat on a HOLD card for six minutes
                // past the end of the block would be a channel that
                // forgot to sign off. Same check as `decideAfterRead`,
                // reading the same two values.
                if (now - showStartedAt >= SHOW_MS
                    && (storiesRead >= MIN_STORIES_PER_SHOW || queue.length === 0)) {
                    beginShowClose(now);
                    break;
                }
                // A queue that is empty is not the same as a wire that has
                // nothing on it. Try the held buckets before giving up to
                // the DRY loop — `drainHeld` was already called by
                // `nextStory`, so reaching here means the buckets are empty
                // too. Fall through to DRY.
                if (!speaking && now >= holdUntil) beginDry(now);
                break;
            }

            default:
                break;
        }
    }

    /**
     * End of a block: the lead signs off and names whoever sat with them,
     * then the channel opens a new show rather than reading on forever.
     *
     * A rundown with no end is a feed, not a broadcast. `showClose()` and
     * `showOpen()` were both written for this and neither was ever called.
     *
     * The block index advances here, at the same moment the next cold open
     * is scheduled, so the two cannot get out of step. By the time
     * `beginColdOpen` runs, `blockIndex` already names the block that
     * sign-on belongs to.
     */
    function beginShowClose(now) {
        const line = GNNScript.showClose();
        // The sign-off is always the lead. `showClose()` names them by
        // name in the text, so the voice must be theirs too — using
        // `speaker()` here read the chair, and when the chair happened to
        // be the co-anchor the station heard Varr introduce herself as
        // Commander Hale.
        //
        // The same rule applies across a block boundary: read `desk()`
        // *before* advancing the block index, so the sign-off uses the
        // outgoing lead's voice, not the incoming one's. The order of these
        // two statements is the whole of the correctness here.
        const seats = GNNScript.desk();
        const lead = seats[0];
        const est = say(line, {
            speakerId: lead ? lead.id : null,
            voice: lead ? lead.voice : undefined,
            caption: {
                kind: 'ident', cue: 'SECTOR DESK',
                chyron: 'GALACTIC NEWS NETWORK'
            }
        });

        storiesRead = 0;

        // Advance to the next block. The swap itself happens in
        // `beginColdOpen`, which runs after this hold resolves — see the
        // comment there for why the order (swap, then read the desk, then
        // set the voice, then speak) matters.
        //
        // A plain increment, not a modulo. `GNNRenderer.setShowBlock()`
        // wraps internally with `((n % count) + count) % count`, so the
        // counter can grow past the number of blocks without the renderer
        // caring. A `% 10` here would be a second, independent count of
        // how many blocks exist — and the day an eleventh set is added to
        // `main.js`'s `SET_FILES`, the two counts would disagree and the
        // rotation would land one block out of step with the seated pair.
        blockIndex++;

        beginHold(now, [est + 600, est + 1200], S.COLD_OPEN);
    }

    /**
     * What the show does after a story finishes.
     *
     * Wall clock first, story floor second. `SHOW_MS` is the length of the
     * show; `MIN_STORIES_PER_SHOW` is a safety rail that keeps a very fast
     * wire from closing after three stories. Both must be satisfied before
     * the show signs off.
     *
     * Below those two, the same priority ordering as before: break, then
     * ident, then banter or toss or another story.
     */
    function decideAfterRead(now) {
        const elapsed = now - showStartedAt;
        if (elapsed >= SHOW_MS && (storiesRead >= MIN_STORIES_PER_SHOW || queue.length === 0)) {
            beginShowClose(now);
        } else if (sinceBreak >= nextBreakAt) {
            beginHold(now, PACE.holdBeforeBreak, S.BREAK);
        } else if (sinceIdent >= nextIdentAt) {
            beginHold(now, PACE.holdAfterRead, S.IDENT);
        } else if (Math.random() < PACE.banterChance) {
            beginHold(now, PACE.holdAfterRead, S.BANTER);
        } else if (Math.random() < PACE.tossChance) {
            beginHold(now, PACE.holdAfterRead, S.TOSS);
        } else {
            beginHold(now, PACE.holdAfterRead, S.READ);
        }
    }

    function nextStory(now) {
        if (typeof GNNFeedManager !== 'undefined' && queue.length < 3) {
            GNNFeedManager.replenishQueue();
        }
        // A queue that is empty because everything got bucketed is not
        // the same as a wire that went quiet. Release the held stories
        // rather than going to DRY with a bucket full of readable copy —
        // a Markets desk that gets nothing but World stories still reads
        // the World stories, because a channel does not refuse to read
        // the news.
        if (!queue.length) drainHeld();
        const item = queue.shift();
        if (!item) { beginDry(now); return; }
        if (pinnedRundown && pinnedRundown.includes(item)) {
            pinnedRundown = pinnedRundown.filter((p) => p !== item);
            if (!pinnedRundown.length) pinnedRundown = null;
        }
        beginRead(now, item);
    }

    // ---------------------------------------------------------
    // Transport controls
    // ---------------------------------------------------------

    function skip() {
        const now = performance.now();
        if (breakArming) return;
        cancelSpeech();
        GNNCutsceneManager.endCutaway();
        if (state === S.BREAK) { GNNCutsceneManager.abortBreak(); }
        GNNTextEngine.finishTyping();
        nextStory(now);
    }

    function pause() {
        running = false;
        cancelSpeech();
        GNNTextEngine.pause();
    }

    function resume() {
        running = true;
        GNNTextEngine.resume();
        holdUntil = performance.now() + 300;
    }

    function forceBreak() {
        beginBreak(performance.now());
    }

    /**
     * The bumper calls this when its slate/card/fade sequence has
     * finished. Clears the pending flag, releases the HOLD case, and runs
     * the cold open directly — rather than having the HOLD case re-fire
     * and try to take the transition a second time.
     *
     * The check on `coldOpenPending` is what makes a stale handoff a
     * no-op. If the operator hit Skip during the bumper, or a breaking
     * story pre-empted, `setState` cleared `coldOpenPending` on the way
     * out of HOLD; a late handoff from the bumper is then just an
     * ignored call rather than an unexpected cold open landing on top of
     * whatever is now on air.
     *
     * Returns `true` when the handoff was taken, `false` when it was
     * ignored. The bumper does not need to branch on the return, but the
     * log is useful for anyone watching the state machine.
     */
    function handoffColdOpen() {
        if (!coldOpenPending) {
            // eslint-disable-next-line no-console
            console.log('[GNN Director] stale bumper handoff ignored');
            return false;
        }
        coldOpenPending = false;
        coldOpenPendingSince = 0;
        holdNext = null;
        // eslint-disable-next-line no-console
        console.log('[GNN Director] bumper handoff received — running cold open');
        beginColdOpen(performance.now());
        return true;
    }

    function report() {
        const elapsed = showStartedAt ? performance.now() - showStartedAt : 0;
        return {
            state, storiesRead, queued: queue.length, queuedByShow: (() => {
                const counts = {};
                for (const [id, items] of Object.entries(showQueues)) counts[id] = items.length;
                if (activeQueueShowId) counts[activeQueueShowId] = (counts[activeQueueShowId] || 0) + queue.length;
                return counts;
            })(), breakArming,
            sinceBreak, nextBreakAt, sinceIdent, nextIdentAt,
            speaking, current: current ? current.title : null,
            block: blockIndex,
            // Show-scoped state, for the telemetry line. `showLeftMs` is
            // what the readout uses to show how much show is left, and
            // `correspondentUsed` is what tells a watching developer
            // whether the two-way has fired yet.
            showElapsedMs: elapsed,
            showLeftMs: Math.max(0, SHOW_MS - elapsed),
            correspondentUsed,
            activeQueueShowId,
            // Whether the director is currently waiting on the bumper's
            // handoff. Exposed for the telemetry line so a stuck bumper is
            // visible at a glance.
            coldOpenPending,
            // Held-bucket counts, for anyone watching the filter from the
            // telemetry line. Empty object when nothing is held.
            held: (() => {
                const out = {};
                for (const cat of Object.keys(heldByCategory)) {
                    if (heldByCategory[cat].length) out[cat] = heldByCategory[cat].length;
                }
                return out;
            })(),
        };
    }

    return {
        STATES: S, PACE,
        update, enqueueAll, injectBreaking, skip, pause, resume, forceBreak,
        interject,
        /**
         * The booth ident — see the function of the same name above.
         * Called from main.js's runBootSequence so the station's fixed
         * opening line lands while the title card is still up, well before
         * the anchor's sign-on is queued. Takes no arguments; the line is
         * the `BOOTH_IDENT_LINE` constant. Returns the estimated duration
         * in ms.
         */
        boothIdent,
        /**
         * The bumper's return path — see the function of the same name
         * above. main.js's `playShowBumper()` calls this when its slate →
         * card → studio sequence has finished. Takes no arguments and
         * returns a boolean: true when a pending handoff was taken, false
         * when the call was stale (the director had already left HOLD by
         * another path).
         */
        handoffColdOpen,
        /** Which seat is reading the story, for the rundown's own use. */
        activeSeat: () => seatIndex,
        /**
         * Which seat is speaking *this line*, or -1 when the speaker is
         * not at the desk.
         *
         * The renderer's hero/speaking swap and the text engine's bubble
         * position both read this.
         *
         * Three cases:
         *
         *   - A specific speaker is set (an exchange, a two-way, a
         *     debate): their seat, or -1 when they are not seated.
         *   - No specific speaker, but the line drives the desk (a normal
         *     anchor read, plain banter, a toss, a commercial throw): the
         *     chair.
         *   - No specific speaker, and the line does NOT drive the desk
         *     (the booth ident, a correspondent's answering line, either
         *     debate guest): -1. The caption draws centred and no anchor
         *     is shown as the speaker, because no anchor is the speaker.
         */
        activeSeatForLine: () => {
            if (!speaking) return seatIndex;
            if (currentLineSpeaker) {
                if (typeof GNNRenderer === 'undefined' || !GNNRenderer.seatedIds) return -1;
                const ids = GNNRenderer.seatedIds();
                return ids.indexOf(currentLineSpeaker.id);
            }
            // No specific speaker. The drivesDesk flag tells us whether
            // the voice belongs to somebody at the desk. If it does not,
            // there is no active seat.
            if (!currentLineDrivesDesk) return -1;
            return seatIndex;
        },
        speaker,
        /**
         * Whether the voice currently on the wire belongs to someone at
         * the desk. The animator reads this — see `js/main.js` — so that a
         * correspondent appearing in the monitor does not move the mouth
         * of the anchor watching them, and so that neither debate guest
         * turns the moderator's head.
         */
        speakerIsSeated: () => currentLineDrivesDesk,
        isRunning: () => running,
        getState: () => state,
        getShowInfo,
        getCurrent: () => current,
        getQueue: () => queue,
        getShowQueues: () => Object.fromEntries(Object.entries(showQueues).map(([id, items]) => [id, items.length])),
        /** Which show's queue is live. Diagnostics only. */
        getActiveQueueShowId: () => activeQueueShowId,
        targetShowFor,
        isSpeaking: () => speaking,
        report,
        /**
         * Stories held because the current desk does not cover their
         * category. Released back into the queue by `drainHeld` when the
         * desk would otherwise go to DRY — so a Markets desk with nothing
         * but World stories on the wire reads the World stories rather
         * than repeating "standing by" at the viewer.
         */
        heldFor: (category) => (heldByCategory[category] || []).slice(),
        /** How many stories are held, per category. Diagnostics only. */
        heldCounts: () => {
            const out = {};
            for (const cat of Object.keys(heldByCategory)) {
                out[cat] = heldByCategory[cat].length;
            }
            return out;
        },
        /** Release held stories back into the queue. Exported for tests. */
        drainHeld,
        set onStateChange(fn) { onStateChange = fn; },
        set onStory(fn) { onStory = fn; },
    };
})();