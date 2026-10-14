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

    let queue = [];
    // Stories that arrived while a desk was on air that does not cover their
    // category. Held rather than dropped — the show-block scheduler drains a
    // bucket when it seats a desk whose beat includes that category.
    //
    // The beat filter exists so a Markets desk does not read a Sports story
    // when it has a Markets story to read, not so it can refuse to read the
    // news. `drainHeld()` below is what releases these when the desk would
    // otherwise go to DRY with a bucket full of readable copy.
    const heldByCategory = Object.create(null);
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
        for (const line of lines || []) {
            if (!line || !line.who || !line.text) continue;
            const speaker = line.who;
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
                const opts = Object.assign({}, job.opts);
                delete opts.caption;
                delete opts.drivesDesk;
                delete opts.speakerId;
                if (!opts.voice) {
                    const who = speaker();
                    if (who && who.voice) opts.voice = who.voice;
                }
                // Present the caption only if the job carries one. A job
                // with `caption: null` is a line that is spoken but not
                // captioned — the boot-time booth ident, for instance,
                // which plays under the title card where the canvas is
                // not visible. Without this check a caption would be
                // presented for a line that has none, and it would linger
                // on screen past the fade.
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

    function enqueueAll(items) {
        const beat = deskBeat();
        for (const it of items || []) {
            if (!it || !it.title) continue;
            if (queue.some((q) => q.title === it.title)) continue;
            if (current && current.title === it.title) continue;

            // Beat filter. A story whose category the current desk does not
            // cover is held, not dropped. Sport at the main desk is the case
            // this exists for; when the show-block scheduler seats a sports
            // desk, that desk's beat will include 'sport' and the bucket will
            // drain normally.
            //
            // No category, or no beat, means we cannot decide, and the item
            // goes through. That preserves the old behaviour for anything the
            // feed manager has not tagged.
            if (beat && it.category && !beat.has(it.category)) {
                const bucket = heldByCategory[it.category] ||
                    (heldByCategory[it.category] = []);
                bucket.push(it);
                // Cap per bucket so a long session cannot grow one category
                // without bound. Oldest goes first — the newest is the most
                // likely to still be relevant when a matching desk comes on.
                while (bucket.length > HELD_CAP) bucket.shift();
                continue;
            }

            queue.push(it);
        }
        // Re-scored on every top-up, not just at ingest, so items already
        // waiting in the rundown decay against the ones arriving now.
        const now = Date.now();
        queue.sort((a, b) => storyScore(b, now) - storyScore(a, now));
        queue = interleaveByTopic(queue);
        if (queue.length > 60) queue.length = 60;
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
            speakerId: null,
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
        setState(S.COLD_OPEN, now);

        // The top of the hour, as far as the show is concerned. Every
        // timing decision in `decideAfterRead` measures against this, and
        // every "is it time for the correspondent yet" check in
        // `beginBanter` does too.
        showStartedAt = now;
        correspondentUsed = false;

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

        const open = GNNScript.showOpen();
        const openMs = say(open, {
            caption: {
                kind: 'ident', cue: 'STATION IDENT',
                chyron: 'GALACTIC NEWS NETWORK'
            }
        });

        const beds = GNNAssets.musicTracks();
        if (beds.length) {
            GNNAudio.playMusic(beds[8 % beds.length].id,
                { gain: 0.55, loop: false, fadeIn: 0.4 });
        }

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
        //
        // `storyText` also strips broadcasting labels ("LIVE:", "WATCH
        // LIVE:") from the headline, and that strip covers both this
        // voice read and the caption below — they both take their text
        // from the same string.
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
     * Returns `true` synchronously if a two-way was actually queued, or
     * `false` if there was no away-correspondent to call. The caller uses
     * that return to decide whether to set `correspondentUsed` — a
     * two-way that never opened does not count against the show's one.
     */
    function beginTwoWay(now, opts = {}) {
        const tw = GNNScript.twoWay(opts);
        if (!tw) return false;
        // Queue all the lines first, synchronously, so `speaking` is true
        // before any frame can run. Then open the cutaway async.
        const correspondentId = tw.correspondent.id;
        const total = queueTaggedLines(tw.lines, {
            // The correspondent's lines sit a little lower in pitch — a
            // field reporter through a monitor, not an anchor at the desk.
            pitch: (id) => id === correspondentId ? -1 : -3,
            // Only the anchor's lines turn the desk; the correspondent's do
            // not, because they are not at the desk to turn.
            drivesDesk: (id) => id !== correspondentId,
        });
        const kind = current ? GNNCutsceneManager.routeFor(current) : null;
        GNNCutsceneManager.openTwoWay(
            tw.correspondent.id, kind, performance.now(),
            tw.correspondent.name.toUpperCase());
        // Drop the monitor once the exchange is over, not on a timer.
        // Ceiling scales with the beat length so a long panel is not cut
        // short by a hardcoded timeout.
        drainSpeech(total * 3 + 20000).then(() => {
            if (GNNCutsceneManager.isTwoWay()) GNNCutsceneManager.endCutaway();
        });
        holdUntil = now + total + 1200;
        return true;
    }

    /**
     * Pick the beat to run after a story.
     *
     * One two-way per show. The guaranteed one is forced in the second
     * half, and it is forced as a *panel* — the two-minute three-way the
     * change request asked for. Before the second half, a two-way can
     * still fire on the normal `PACE.twoWayShare` draw, and those use
     * whatever shape `GNNScript.twoWay()` rolls naturally (brief, standard
     * or extended) since they are not the show's reserved interview slot.
     *
     * Past halfway with no correspondent yet, every banter beat attempts a
     * panel until it succeeds. If there is no away-correspondent in the
     * cast — everything is seated — `beginTwoWay` returns false and the
     * beat falls through to the exchange and plain-banter paths; the show
     * runs without a correspondent rather than stalling.
     *
     * Once the correspondent has been used, no further two-ways fire this
     * show. That is the whole of the "one per show" rule.
     */
    function beginBanter(now) {
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
            // `openTwoWay` awaits image loads; in the meantime the
            // director's HOLD case would see `!speaking` and fall through
            // to `nextStory()`, so the two-way played over the top of the
            // story it was meant to replace.
            setState(S.BANTER, now);
            banterStreak++;
            const opts = forcePanel ? { shape: 'panel' } : {};
            if (beginTwoWay(now, opts)) {
                correspondentUsed = true;
                return;
            }
            // No away-correspondent to call. Fall through to the exchange
            // and plain-banter paths. BANTER state was already set above,
            // which is harmless — the BANTER case in `update()` will
            // transition out on the next tick when it sees `!speaking` and
            // nothing typed.
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

            case S.DRY: {
                if (queue.length) { nextStory(now); break; }
                // The show should still end on time even if the wire has
                // gone quiet. Airtime does not pause because the feed did,
                // and a channel that sat on a HOLD card for six minutes
                // past the end of the block would be a channel that
                // forgot to sign off. Same check as `decideAfterRead`,
                // reading the same two values.
                if (now - showStartedAt >= SHOW_MS
                    && storiesRead >= MIN_STORIES_PER_SHOW) {
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
        if (elapsed >= SHOW_MS && storiesRead >= MIN_STORIES_PER_SHOW) {
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
        const elapsed = showStartedAt ? performance.now() - showStartedAt : 0;
        return {
            state, storiesRead, queued: queue.length, breakArming,
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
         *   - A specific speaker is set (an exchange, a two-way): their
         *     seat, or -1 when they are not seated.
         *   - No specific speaker, but the line drives the desk (a normal
         *     anchor read, plain banter, a toss, a commercial throw): the
         *     chair.
         *   - No specific speaker, and the line does NOT drive the desk
         *     (the booth ident, a correspondent's answering line): -1.
         *     The caption draws centred and no anchor is shown as the
         *     speaker, because no anchor is the speaker.
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
         * of the anchor watching them.
         */
        speakerIsSeated: () => currentLineDrivesDesk,
        isRunning: () => running,
        getState: () => state,
        getCurrent: () => current,
        getQueue: () => queue,
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