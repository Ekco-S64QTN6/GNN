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
   ============================================================ */

const GNNDirector = (() => {
    'use strict';

    const S = {
        BOOT: 'BOOT', COLD_OPEN: 'COLD_OPEN', READ: 'READ', HOLD: 'HOLD',
        BANTER: 'BANTER', WIRE: 'WIRE', TOSS: 'TOSS', BREAK: 'BREAK',
        IDENT: 'IDENT', DRY: 'DRY', SIGNOFF: 'SIGNOFF',
    };

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
        storiesPerShow: [9, 14],  // before the lead signs the block off
        tossChance: 0.42,
        cutawayChance: 0.62,
        cutawayAt: 0.34,          // fraction through the read
        doubleBanterChance: 0.16,
    };

    let state = S.BOOT;
    let stateSince = 0;
    let holdUntil = 0;

    let queue = [];
    let current = null;
    let storiesRead = 0;
    let sinceBreak = 0;
    let sinceIdent = 0;
    let nextBreakAt = randInt(PACE.storiesPerBreak);
    let nextIdentAt = randInt(PACE.storiesPerIdent);

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
        state = next;
        stateSince = now;
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
     * line actually begins.
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
                const opts = Object.assign({}, job.opts);
                delete opts.caption;
                delete opts.drivesDesk;
                delete opts.speakerId;
                if (!opts.voice) {
                    const who = speaker();
                    if (who && who.voice) opts.voice = who.voice;
                }
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

    function enqueueAll(items) {
        for (const it of items || []) {
            if (!it || !it.title) continue;
            if (queue.some((q) => q.title === it.title)) continue;
            if (current && current.title === it.title) continue;
            queue.push(it);
        }
        // Re-scored on every top-up, not just at ingest, so items already
        // waiting in the rundown decay against the ones arriving now.
        const now = Date.now();
        queue.sort((a, b) => storyScore(b, now) - storyScore(a, now));
        queue = interleaveByTopic(queue);
        if (queue.length > 60) queue.length = 60;
    }

    function injectBreaking(title, description) {
        pendingBreaking = {
            title: String(title || '').toUpperCase(),
            description: description || '',
            breaking: true,
            importance: 9999,
            timestamp: Date.now(),
        };
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

    function storyText(item) {
        const title = (item.title || '').trim();
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

    function beginColdOpen(now) {
        setState(S.COLD_OPEN, now);
        // The lead anchor opens the show and says who they are. Without
        // this the channel came up mid-rundown with two strangers at a
        // desk already reading a wire story.
        const open = GNNScript.showOpen();
        const openMs = say(open, {
            caption: {
                kind: 'ident', cue: 'STATION IDENT',
                chyron: 'GALACTIC NEWS NETWORK'
            }
        });
        GNNAudio.play('intro_sfx_02', { gain: 0.6 });
        const beds = GNNAssets.musicTracks();
        if (beds.length) {
            GNNAudio.playMusic(beds[8 % beds.length].id, { gain: 0.55, loop: false, fadeIn: 0.4 });
        }
        // The show open above is the spoken line. Saying the ident too
        // queued a second utterance straight over it.
        holdUntil = now + Math.max(3200, openMs + 900);
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
        // Trim once, here, so the caption, the segment's clock and the
        // voice are all reading the same words. Synthesis caps a line at
        // 900 characters; when the teleprompter was handed the untrimmed
        // story it kept scrolling after the audio had finished and the
        // anchor sat there with her mouth shut mid-sentence.
        const text = GNNTTS.trimForSynthesis
            ? GNNTTS.trimForSynthesis(storyText(item))
            : storyText(item);
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
        say(text, { caption });

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
     * `GNNScript.exchange()` returns a jab and a reply drawn from the
     * asymmetric relationship table in `js/cast.js`, each tagged with who
     * says it, so each line goes out in that character's own voice. This
     * was written and then never called, which is why the desk only ever
     * talked about the wire.
     */
    function beginExchange(now) {
        const lines = GNNScript.exchange();
        if (!lines || lines.length < 2) return false;
        banterStreak++;
        setState(S.BANTER, now);
        const jab = lines[0];
        const reply = lines[1];
        const estA = say(jab.text, {
            voice: jab.who.voice, pitch: -3,
            speakerId: jab.who.id,
            caption: { kind: 'banter', cue: jab.who.name.toUpperCase() }
        });
        // The reply waits for the jab to finish, then speaks in the other
        // anchor's voice. Both lines through `say()` at once would talk
        // over each other — one voice path, one speaker at a time.
        // Guarded by the speech token, not just by the state.
        //
        // The state can be BANTER again for a different beat by the time
        // this fires, and then the stale reply speaks over whatever is
        // being said — which is how the commander's intro got cut off by
        // the other anchor. `speechToken` changes on every new line, so
        // comparing it catches exactly the case the state check misses.
        const myToken = speechToken;
        setTimeout(() => {
            if (state !== S.BANTER || speechToken !== myToken || speaking) return;
            const estB = say(reply.text, {
                voice: reply.who.voice, pitch: -3,
                speakerId: reply.who.id,
                caption: {
                    kind: 'banter',
                    cue: reply.who.name.toUpperCase()
                }
            });
            holdUntil = performance.now() + estB + 600;
        }, estA + 350);
        holdUntil = now + estA + 1200;
        return true;
    }

    /**
     * A remote two-way. The correspondent appears in the monitor and the
     * three lines go out in order through the speech queue, so the anchor
     * finishes asking before the reporter starts answering — which is the
     * whole reason the queue exists.
     *
     * The correspondent's answering line is tagged `drivesDesk: false`, so
     * the anchor's mouth stays shut while the correspondent talks. It also
     * carries `speakerId: correspondent.id`, so the caption label reads the
     * right name and `activeSeatForLine()` can return -1 to tell the
     * renderer and the text engine that no anchor is speaking.
     */
    function beginTwoWay(now) {
        const tw = GNNScript.twoWay();
        if (!tw) return false;
        // Queue the three lines first, synchronously, so `speaking` is
        // true before any frame can run. Then open the cutaway async.
        let total = 0;
        for (const line of tw.lines) {
            const fromDesk = line.who.id !== tw.correspondent.id;
            total += say(line.text, {
                voice: line.who.voice,
                pitch: line.who.id === tw.correspondent.id ? -1 : -3,
                speakerId: line.who.id,
                caption: {
                    kind: 'banter',
                    cue: line.who.name.toUpperCase()
                },
                drivesDesk: fromDesk,
            });
        }
        const kind = current ? GNNCutsceneManager.routeFor(current) : null;
        GNNCutsceneManager.openTwoWay(
            tw.correspondent.id, kind, performance.now(),
            tw.correspondent.name.toUpperCase());
        // Drop the monitor once the exchange is over, not on a timer.
        drainSpeech(total * 3 + 15000).then(() => {
            if (GNNCutsceneManager.isTwoWay()) GNNCutsceneManager.endCutaway();
        });
        holdUntil = now + total + 1200;
        return true;
    }

    function beginBanter(now) {
        // Some anchor beats are a remote two-way, some are the pair
        // talking to each other, the rest a comment on the story.
        if (Math.random() < PACE.twoWayShare) {
            // Reserve BANTER *before* the async two-way opens.
            // `openTwoWay` awaits image loads; in the meantime the
            // director's HOLD case would see `!speaking` and fall through
            // to `nextStory()`, so the two-way played over the top of the
            // story it was meant to replace.
            setState(S.BANTER, now);
            banterStreak++;
            beginTwoWay(now);
            return;
        }
        if (Math.random() < PACE.exchangeShare && beginExchange(now)) return;
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
                // Open on the first story, but never wait on the feed forever —
                // an empty rundown is still a broadcast, it is just a quiet one.
                if (queue.length) beginColdOpen(now);
                else if (!bootDeadline) bootDeadline = now + 9000;
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
                    holdNext = null;
                    if (next === S.BREAK) beginBreak(now);
                    else if (next === S.BANTER) beginBanter(now);
                    else if (next === S.TOSS) beginToss(now);
                    else if (next === S.IDENT) beginIdent(now);
                    else if (next === S.COLD_OPEN) beginColdOpen(now);
                    else nextStory(now);
                }
                break;

            case S.BANTER:
            case S.WIRE:
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

            case S.DRY:
                if (queue.length) { nextStory(now); break; }
                if (!speaking && now >= holdUntil) beginDry(now);
                break;

            default:
                break;
        }
    }

    let nextCloseAt = randInt(PACE.storiesPerShow);

    /**
     * End of a block: the lead signs off and names whoever sat with them,
     * then the channel opens a new show rather than reading on forever.
     *
     * A rundown with no end is a feed, not a broadcast. `showClose()` and
     * `showOpen()` were both written for this and neither was ever called.
     */
    function beginShowClose(now) {
        const line = GNNScript.showClose();
        // The sign-off is always the lead. `showClose()` names them by
        // name in the text, so the voice must be theirs too — using
        // `speaker()` here read the chair, and when the chair happened to
        // be the co-anchor the station heard Varr introduce herself as
        // Commander Hale.
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
        nextCloseAt = randInt(PACE.storiesPerShow);
        beginHold(now, [est + 600, est + 1200], S.COLD_OPEN);
    }

    function decideAfterRead(now) {
        if (storiesRead >= nextCloseAt) {
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
        const item = queue.shift();
        if (!item) { beginDry(now); return; }
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

    function report() {
        return {
            state, storiesRead, queued: queue.length, breakArming,
            sinceBreak, nextBreakAt, sinceIdent, nextIdentAt,
            speaking, current: current ? current.title : null,
        };
    }

    return {
        STATES: S, PACE,
        update, enqueueAll, injectBreaking, skip, pause, resume, forceBreak,
        interject,
        /** Which seat is reading the story, for the rundown's own use. */
        activeSeat: () => seatIndex,
        /**
         * Which seat is speaking *this line*, or -1 when the speaker is
         * not at the desk — a correspondent in the monitor.
         *
         * The renderer's hero/speaking swap and the text engine's bubble
         * position both read this. `activeSeat()` names the chair, which is
         * who would be speaking if the line were a story; `activeSeatForLine`
         * names who is actually talking, and during an exchange or a two-way
         * that is a different person.
         *
         * Falls back to the chair when no specific speaker is set, which is
         * everything outside an exchange or a two-way.
         */
        activeSeatForLine: () => {
            if (!speaking || !currentLineSpeaker) return seatIndex;
            if (typeof GNNRenderer === 'undefined' || !GNNRenderer.seatedIds) return -1;
            const ids = GNNRenderer.seatedIds();
            return ids.indexOf(currentLineSpeaker.id);
        },
        speaker,
        /**
         * Whether the voice currently on the wire belongs to someone at
         * the desk. The animator reads this — see `js/main.js` — so that a
         * correspondent appearing in the monitor does not move the mouth
         * of the anchor watching them.
         */
        speakerIsSeated: () => currentLineDrivesDesk,
        isRunning: () => running,
        getState: () => state,
        getCurrent: () => current,
        getQueue: () => queue,
        isSpeaking: () => speaking,
        report,
        set onStateChange(fn) { onStateChange = fn; },
        set onStory(fn) { onStory = fn; },
    };
})();