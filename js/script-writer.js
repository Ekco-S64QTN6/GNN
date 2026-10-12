/* ============================================================
   GNN — Script Writer
   ------------------------------------------------------------
   Generates everything the anchor says that is not a headline:
   the beat of dead air between stories, the localized commentary
   ("banter"), the sector wire riffs built from the 75 authentic
   EVENTMSG.LBX bulletins, the commercial copy, the ticker crawl
   and the station idents.

   Real feed nouns are lifted out of the current story and dropped
   into the 1993 templates, so the robot sounds like it is reading
   our galaxy rather than reciting canned lines.

   Conversations, not single lines. Every character in `js/cast.js`
   carries banks for openers, reactions, closers and asks; the
   relationship table between them carries optional follow and
   close lines. Two-ways and exchanges now draw on those to build
   a shape — brief, standard, extended — rather than picking one
   canned line and stopping. A two-anchor beat is a real exchange:
   one anchor opens, the other reacts, and it closes.
   ============================================================ */

const GNNScript = (() => {
    'use strict';

    const STOP = new Set(('the a an and or of for to in on at by with from as is are was were be been ' +
        'this that these those it its his her their our your they we you he she has have had will would ' +
        'can could may might must new says said after before over under about into more most than then ' +
        'first last year years day days week month report reports study happened happens ' +
        'according including according following amid despite while during since until ' +
        'people made make makes take takes get gets go goes come comes back down up out ' +
        'video watch read live news update updates plus also here there what when where why how').split(/\s+/));

    // ---------------------------------------------------------
    // Entity mining from the live feed
    // ---------------------------------------------------------

    /** Prefer the original-case headline; an all-caps one carries no signal. */
    function sourceText(story) {
        if (!story) return '';
        const title = story.titleRaw || story.title || '';
        const looksShouted = title === title.toUpperCase() && /[A-Z]{4}/.test(title);
        const desc = story.description || '';
        return looksShouted ? desc : (title + ' ' + desc);
    }

    function properNouns(text) {
        const out = [];
        const src = String(text || '');
        const re = /\b([A-Z][A-Za-z0-9'’\-]{2,}(?:\s+[A-Z][A-Za-z0-9'’\-]{2,}){0,2})\b/g;
        let m;
        while ((m = re.exec(src))) {
            const w = m[1].trim();
            if (w.length < 3 || w.length > 34) continue;
            if (STOP.has(w.toLowerCase())) continue;
            out.push(w);
        }
        return out;
    }

    function numbers(text) {
        return (String(text || '').match(/\b\d[\d,.]*\s*(?:%|percent|million|billion|trillion|km|kg|years?)?\b/gi) || [])
            .map((s) => s.trim());
    }

    function keywords(text) {
        const words = String(text || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ')
            .split(/\s+/).filter((w) => w.length > 4 && !STOP.has(w));
        // Longer words carry more of the story than the first one that fits.
        return words.sort((a, b) => b.length - a.length);
    }

    // Every line this module has said lately, newest last.
    //
    // `pickFrom` was a bare random pick with no memory, so on a short list
    // the same line came round every few draws — "the Commander would like
    // us to be precise about this" four times in five minutes. Random with
    // replacement feels repetitive long before it is statistically odd.
    const recent = [];
    const RECENT_LIMIT = 60;

    function remember(line) {
        recent.push(line);
        while (recent.length > RECENT_LIMIT) recent.shift();
        return line;
    }

    function hasSaidRecently(line) {
        return recent.indexOf(line) >= 0;
    }

    /**
     * A line from `list` that has not been used recently.
     *
     * Half the list is held back as "recent" at most, so a short list still
     * always returns something — with three lines to choose from, refusing
     * to repeat at all would mean refusing to speak.
     */
    function pickFrom(list, fallback) {
        if (!list || !list.length) return fallback;
        const hold = Math.min(recent.length, Math.max(1, Math.floor(list.length / 2)));
        const blocked = new Set(recent.slice(-hold));
        const open = list.filter((l) => !blocked.has(l));
        const pool = open.length ? open : list;
        return remember(pool[(Math.random() * pool.length) | 0]);
    }

    /**
     * A line from a character's own bank, filtered through this module's
     * recency buffer.
     *
     * `GNNCast.line()` does the picking; this wrapper remembers the result
     * so the same opener cannot fire twice in a session, and falls back to
     * `fallback` when the character has no such bank. Falls through to
     * `fallback` on null so callers can chain: `castLine('closers', id)
     * || genericLine`.
     */
    function castLine(kind, id, fallback = null) {
        if (typeof GNNCast === 'undefined') return fallback;
        const raw = GNNCast.line(kind, id, null);
        if (!raw) return fallback;
        if (hasSaidRecently(raw)) return fallback;
        return remember(raw);
    }

    function chance(p) { return Math.random() < p; }

    // ---------------------------------------------------------
    // Sector wire — the 75 authentic bulletins, re-pointed at our galaxy
    // ---------------------------------------------------------

    const RANKS = ['Sector Marshal', 'Prime Assessor', 'Trade Legate', 'Fleet Adjutant',
        'Colonial Registrar', 'Chief Astrogator', 'Survey Prefect'];
    const TRAITS = ['ruthless', 'erratic', 'pacifist', 'expansionist', 'honorable',
        'aggressive', 'xenophobic', 'technologist'];

    function fillBulletin(template, ctx) {
        const nouns = ctx.nouns || [];
        const nums = ctx.numbers || [];
        const place = pickFrom(nouns, pickFrom(GNNAssets.vocab('stars'), 'Rigel'));
        const place2 = pickFrom(GNNAssets.vocab('stars'), 'Vega');
        const faction = pickFrom(nouns.slice(1), pickFrom(GNNAssets.vocab('races'), 'Psilon'));
        const num = (pickFrom(nums, '') || String(2 + ((Math.random() * 40) | 0))).replace(/\s+/g, ' ');
        return template
            .replace(/\{PLACE2\}/g, place2)
            .replace(/\{PLACE\}/g, place)
            .replace(/\{FACTION2\}/g, pickFrom(GNNAssets.vocab('races'), 'Darlok'))
            .replace(/\{FACTION\}/g, faction)
            .replace(/\{EMPIRE\}/g, 'Terran')
            .replace(/\{NUM2\}/g, String(10 + ((Math.random() * 900) | 0)))
            .replace(/\{NUM\}/g, num)
            .replace(/\{LEADER\}/g, pickFrom(GNNAssets.leaders(), 'Alexander'))
            .replace(/\{TITLE\}/g, pickFrom(RANKS, 'Sector Marshal'))
            .replace(/\{TRAIT2\}/g, pickFrom(TRAITS, 'erratic'))
            .replace(/\{TRAIT\}/g, pickFrom(TRAITS, 'ruthless'))
            .replace(/\{RANK\}/g, pickFrom(RANKS, 'Prime Assessor'))
            .replace(/\{S2\}/g, 's')
            .replace(/\{S\}/g, 's')
            .replace(/\{THE\}/g, 'the')
            .replace(/\{A\}/g, 'a')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /** A short in-universe wire item, seeded by whatever we just read out. */
    function sectorWire(story) {
        const pool = GNNAssets.bulletins();
        if (!pool.length) return null;
        const ctx = {
            nouns: properNouns(sourceText(story)),
            numbers: numbers(sourceText(story)),
        };
        return fillBulletin(pickFrom(pool, ''), ctx);
    }

    // ---------------------------------------------------------
    // Anchor banter — single-line asides, and the beat-level pools
    // ---------------------------------------------------------

    const OPENERS = [
        'Cross-referencing that against sector archives.',
        'Filed under ongoing developments.',
        'That item is now logged with the orbital registry.',
        'We are holding that transmission open.',
        'Our correspondents continue to monitor.',
        'That confirms the earlier relay from the beacon net.',
    ];

    // Machine asides. These are Unit 7's and Foundry-Nine's; in a human
    // mouth they are nonsense, and banter() used to hand them to whoever
    // happened to be reading, so the Commander announced that this unit had
    // no opinion.
    const ROBOT_ASIDES = [
        'Processing probability of human survival: {PCT} percent.',
        'Sentiment analysis returns: {MOOD}. Confidence, {PCT} percent.',
        'My archives contain {N} prior events of this classification.',
        'Recalibrating optimism subroutine. Result unchanged.',
        'This unit is required to state that it has no opinion. This unit has {N} opinions.',
        'Flagging that story for the {HOUR}-hundred repeat cycle.',
        'Estimated relevance decay: {N} hours.',
        'I have queried six archives. Four disagree. Two are on fire.',
        'Reminder: viewer discretion is a legacy feature and is no longer supported.',
        'My predecessor unit filed the same story in {YEAR}. It was also inconclusive.',
        'Human colleagues would insert a pause here. Inserting pause.',
        'Correction: the previous statement was correct. Retracting correction.',
    ];

    // Asides for the people. Same job as the machine ones — fill the beat
    // after a story — in a register a person can plausibly use.
    const CREW_ASIDES = [
        'We will stay with that one as it develops.',
        'There will be more on that, and probably worse.',
        'Nobody has put a number on it yet. Somebody will.',
        'That is the second time this month, for anyone counting.',
        'I would not want to be the one explaining that.',
        'The statement says very little, at some length.',
        'We asked. We are told there will be a briefing.',
        'Make of that what you will.',
        'The figure is disputed. The event is not.',
        'Somebody signed off on that, and we would all like to know who.',
    ];

    const CONTEXT_LINES = [
        'Analysts on {PLACE} put the figure closer to {N}.',
        'The {FACTION} delegation has declined to comment through three separate relays.',
        'Commodity desks moved {N} points on that headline before the beacon caught up.',
        'That is the {ORD} filing on this subject from the same source array this cycle.',
        'Our {PLACE} bureau notes the timing is, and I quote, "not accidental".',
        'Independent verification is pending on the {PLACE2} relay.',
    ];

    const MOODS = ['cautious', 'deteriorating', 'nominal', 'inconclusive', 'unusually calm',
        'statistically improbable', 'within tolerance', 'outside tolerance'];
    const ORDINALS = ['second', 'third', 'fourth', 'ninth', 'eleventh', 'nineteenth'];

    function fillGeneric(line, story) {
        const nouns = properNouns(sourceText(story));
        return line
            .replace(/\{PCT\}/g, String((Math.random() * 99).toFixed(1)))
            .replace(/\{N\}/g, String(2 + ((Math.random() * 400) | 0)))
            .replace(/\{MOOD\}/g, pickFrom(MOODS, 'inconclusive'))
            .replace(/\{HOUR\}/g, String(((Math.random() * 23) | 0)).padStart(2, '0'))
            .replace(/\{YEAR\}/g, String(2380 + ((Math.random() * 90) | 0)))
            .replace(/\{ORD\}/g, pickFrom(ORDINALS, 'third'))
            .replace(/\{PLACE2\}/g, pickFrom(GNNAssets.vocab('stars'), 'Vega'))
            .replace(/\{PLACE\}/g, pickFrom(nouns, pickFrom(GNNAssets.vocab('stars'), 'Rigel')))
            .replace(/\{FACTION\}/g, pickFrom(GNNAssets.vocab('races'), 'Psilon'));
    }

    // ---------------------------------------------------------
    // The show, as a shape
    // ---------------------------------------------------------
    //
    // A newscast is not a list of stories; it is an opening, a run of
    // stories with people talking between them, breaks that are announced
    // and come back from, and a close. These supply the joins. Characters
    // come from GNNCast, so the same line reads differently depending on
    // who is at the desk.

    /** Who is in which seat right now, as cast entries. */
    function desk() {
        if (typeof GNNRenderer === 'undefined' || !GNNRenderer.seatedIds) return [];
        return GNNRenderer.seatedIds()
            .map((id) => (typeof GNNCast !== 'undefined' ? GNNCast.get(id) : null))
            .filter(Boolean);
    }

    function lead() { return desk()[0] || null; }

    // The station's opening lines. The anchor's name goes *in front* of
    // these, not after — see `showOpen()` below. Each of these starts with
    // "This is G N N" or an equivalent, followed by the tease of what the
    // programme is about to cover.
    //
    // The order matters. Naming the station, then the tease, then the
    // anchor reads as if the anchor is a footnote to the station. Naming
    // the anchor first, then the station, then the tease is how a real
    // sign-on runs: the person introduces themselves, the station
    // identifies, and then the programme begins.
    const SHOW_OPEN = [
        'This is G N N. Let\'s get to the news from across the sector tonight.',
        'This is G N N. The rundown is live and the wire is open.',
        'This is G N N. The top of the hour, and the top of the wire.',
        'This is G N N, broadcasting from station control.',
        'This is G N N. Wherever the relay reaches, we are on.',
    ];

    /**
     * Top of the hour: the anchor names themselves first, then the
     * station, then what is coming up. `SHOW_OPEN` lines all begin with
     * the station's identification; the anchor's name is prefixed.
     */
    function showOpen() {
        const who = lead();
        const line = pickFrom(SHOW_OPEN, SHOW_OPEN[0]);
        if (!who) return line;
        return `I am ${who.name}. ${line}`;
    }

    const INTO_BREAK = [
        'Stay with us. There is more on the other side of this.',
        'We will be back after these messages.',
        'Hold the channel. We are not finished.',
        'More in a moment, including the figures nobody wants to read out.',
    ];

    const OUT_OF_BREAK = [
        'And we are back.',
        'You are still watching G N N.',
        'This is G N N, and the rundown continues.',
        'Back on the channel. Where were we.',
    ];

    function intoBreak() { return pickFrom(INTO_BREAK, INTO_BREAK[0]); }

    /**
     * The return-from-break line.
     *
     * This used to append the lead anchor's tic 40% of the time. The tic is
     * a character tell, not a sign-off, and — because the desk is pinned to
     * Human + Mrrshan, whose tic is "Let us be precise about this" — it was
     * landing every third return. The line is now the base only. A tic
     * belongs in banter, where it has a recent-line check around it.
     */
    function outOfBreak() {
        return pickFrom(OUT_OF_BREAK, OUT_OF_BREAK[0]);
    }

    const SHOW_CLOSE = [
        'That is the rundown. The wire stays open whether anyone is reading '
        + 'it or not.',
        'That is where we leave it. The sector does not stop because we do.',
        'We are out of time and the story is not finished. It rarely is.',
    ];

    /** End of a block: the lead signs off, and names whoever sat with them. */
    function showClose() {
        const seats = desk();
        const line = pickFrom(SHOW_CLOSE, SHOW_CLOSE[0]);
        if (!seats.length) return line;
        if (seats.length === 1) return `${line} I have been ${seats[0].name}.`;
        const others = seats.slice(1).map((p) => p.name).join(' and ');
        return `${line} I have been ${seats[0].name}, with ${others}. Good night.`;
    }

    // ---------------------------------------------------------
    // Two-ways — a real interview, not a single question and answer
    // ---------------------------------------------------------

    // The two halves of a two-way question: an intro that names the
    // correspondent, and a question that does not. Kept separate so the
    // follow-up can drop the intro — repeating "we can go to Grolm now"
    // on the second question reads as a stutter, not an interview.
    const INTRO = [
        'We can go to %s now.',
        'Let us bring in %s.',
        '%s is across this for us.',
        'Our correspondent %s is standing by.',
        'We have %s on the line.',
    ];
    // The question on the opening ask, after the intro. Also used alone
    // when the host has no asks bank and no intro to prepend.
    const ASK = [
        'What are you seeing?',
        'What is the picture from where you are?',
        'What can you add?',
        'What are you hearing?',
        'How does that read from your side?',
    ];
    // The follow-up question. No intro line, no correspondent name — they
    // are already on screen and mid-interview by the time this fires.
    const ASK_FOLLOWUP = [
        'Is that consistent with what you have?',
        'What else can you tell us?',
        'What does that mean on the ground?',
        'Anything you can add?',
        'Where does that leave us?',
        'Is there more to it than that?',
    ];
    const ANSWER = [
        'What I can tell you is that nobody here is calling it settled. '
        + 'That is the part everyone keeps leaving out.',
        'It is moving faster than the official line suggests. I would not '
        + 'expect the figures to hold by this evening.',
        'The people I have spoken to are being careful with their words, '
        + 'which tells you something on its own.',
        'There is a lot of confidence in the statements and very little of '
        + 'it in the corridors. Make of that what you will.',
        'It depends entirely on what happens in the next few hours, and '
        + 'nobody here will say what they think that is.',
    ];
    const THANKS = [
        'Thank you, %s.',
        '%s, thank you. We will come back to you.',
        'Our thanks to %s.',
        'Stay with it, %s. Thank you.',
    ];

    /**
     * The host's line to the correspondent.
     *
     * `withIntro` is true on the first ask of a two-way — it prepends a
     * line that names the correspondent — and false on any follow-up.
     * The correspondent is already on screen by then, and repeating the
     * naming line reads as a stutter: "We can go to Grolm now. What is
     * the picture? ... We can go to Grolm now. Is that consistent?"
     *
     * When the host has asks on their cast sheet, those win. Otherwise a
     * fallback pool supplies the question — a different pool for the
     * intro variant and the follow-up variant, since they read
     * differently in context.
     */
    function hostAsk(host, correspondent, withIntro = true) {
        const castAsk = castLine('asks', host.id);
        if (withIntro) {
            const intro = pickFrom(INTRO, 'We can go to %s now.')
                .replace('%s', correspondent.name);
            return `${intro} ${castAsk || pickFrom(ASK, ASK[0])}`;
        }
        if (castAsk) return castAsk;
        return pickFrom(ASK_FOLLOWUP, ASK_FOLLOWUP[0]);
    }

    /**
     * The host's closer. Prefers their own closers; falls back to the
     * thank-you templates with the correspondent's name.
     */
    function hostClose(host, correspondent) {
        const castClose = castLine('closers', host.id);
        if (castClose) return castClose;
        return pickFrom(THANKS, THANKS[0]).replace('%s', correspondent.name);
    }

    /**
     * The correspondent's answer. On their first turn in an extended
     * two-way, this comes from their openers — a framing line that sets
     * up the report. Otherwise it comes from reactions — a direct answer.
     */
    function correspondentLine(correspondent, kind) {
        const fromCast = castLine(kind, correspondent.id);
        if (fromCast) return fromCast;
        return pickFrom(ANSWER, ANSWER[0]);
    }

    /**
     * A remote two-way. Three shapes, rolled up front so the whole beat
     * holds a coherent form rather than drifting longer midway through.
     *
     *   brief       ask, answer                          (2 lines)
     *   standard    ask, answer, close                   (3 lines)
     *   extended    ask, answer, follow-up, answer,
     *               close                                (5 lines)
     *
     * Each line is tagged with who says it, so the director can hand them
     * to the right voice in order. The correspondent is anyone in the
     * cast who is not currently at the desk and not a machine.
     */
    function twoWay() {
        if (typeof GNNCast === 'undefined') return null;
        const seats = desk();
        const seated = new Set(seats.map((p) => p.id));
        const away = GNNCast.all().filter(
            (p) => !seated.has(p.id) && !p.machine);
        if (!seats.length || !away.length) return null;
        const who = away[(Math.random() * away.length) | 0];
        const host = seats[0];

        const roll = Math.random();
        const shape = roll < 0.25 ? 'brief'
            : roll < 0.70 ? 'standard'
                : 'extended';

        const lines = [];
        // The first ask names the correspondent. Everything after it — the
        // follow-up in the extended shape, in particular — drops the
        // intro, so the interviewer does not introduce them twice.
        lines.push({ who: host, text: hostAsk(host, who) });

        if (shape === 'brief') {
            lines.push({ who, text: correspondentLine(who, 'reactions') });
        } else if (shape === 'standard') {
            lines.push({ who, text: correspondentLine(who, 'reactions') });
            lines.push({ who: host, text: hostClose(host, who) });
        } else {
            // extended: ask, answer, follow-up, answer, close. The
            // follow-up drops the intro — see hostAsk — so the
            // interviewer does not name the correspondent twice in the
            // space of one beat.
            lines.push({ who, text: correspondentLine(who, 'reactions') });
            lines.push({ who: host, text: hostAsk(host, who, false) });
            lines.push({ who, text: correspondentLine(who, 'reactions') });
            lines.push({ who: host, text: hostClose(host, who) });
        }

        return { correspondent: who, lines, shape };
    }

    // ---------------------------------------------------------
    // Anchor-to-anchor exchanges and structured banter
    // ---------------------------------------------------------

    /**
     * A beat of two anchors talking to each other.
     *
     * Uses the relationship table for the specific opinion that colours
     * the exchange — Varr teasing Hale, Rell pining after Varr, the
     * robot correcting the Commander — and extends the pair with
     * `follow` and `close` lines when the entry carries them. A four-line
     * exchange is a real conversation; a two-line one is a quick aside.
     *
     * Returns an array of tagged lines, or null when the pair have no
     * relationship worth airing.
     */
    function exchange() {
        const seats = desk();
        if (seats.length < 2 || typeof GNNCast === 'undefined') return null;
        // Try both directions; the table is deliberately one-sided in places.
        const pairs = [];
        for (let i = 0; i < seats.length; i++) {
            for (let j = 0; j < seats.length; j++) {
                if (i === j) continue;
                const ex = GNNCast.exchange(seats[i].id, seats[j].id);
                if (ex) pairs.push({ a: seats[i], b: seats[j], ex });
            }
        }
        if (!pairs.length) return null;
        const pick = pairs[(Math.random() * pairs.length) | 0];
        const lines = [
            { who: pick.a, text: pick.ex.jab },
            { who: pick.b, text: pick.ex.reply },
        ];
        // Half the extended relationships carry follow and close; the
        // script writer uses them when they are present, and stops at the
        // reply when they are not. Two-anchor beats are also shorter on
        // average than they look — a four-line exchange needs a longer
        // hold at the desk than a two-line one.
        if (pick.ex.follow && chance(0.65)) {
            lines.push({ who: pick.a, text: pick.ex.follow });
            if (pick.ex.close) {
                lines.push({ who: pick.b, text: pick.ex.close });
            }
        }
        return lines;
    }

    /**
     * A structured beat of banter between the two anchors — separate
     * from `exchange()`, which draws from the relationship table for a
     * specific opinion. This one builds from each anchor's own banks:
     * an opener from one, a reaction from the other, optionally a
     * follow-up, and a close.
     *
     * The point is to make the desk feel inhabited rather than reading
     * a list. `banter()` still exists for the single-line aside case;
     * `banterBeat()` is what a two-anchor moment should call.
     *
     * Returns an array of tagged lines, or null when fewer than two
     * anchors are seated.
     */
    function banterBeat(story) {
        const seats = desk();
        if (seats.length < 2) return null;
        // Randomly swap the order so the same anchor does not always open.
        const [a, b] = Math.random() < 0.5
            ? [seats[0], seats[1]]
            : [seats[1], seats[0]];

        const lines = [];
        const opener = castLine('openers', a.id)
            || fillGeneric(pickFrom(CREW_ASIDES, ''), story);
        lines.push({ who: a, text: opener });

        const reaction = castLine('reactions', b.id)
            || fillGeneric(pickFrom(CREW_ASIDES, ''), story);
        lines.push({ who: b, text: reaction });

        // A longer form: one more volley before closing. Chosen by chance
        // so the same shape does not repeat every time a beat lands.
        if (chance(0.5)) {
            const follow = castLine('reactions', a.id);
            if (follow) lines.push({ who: a, text: follow });
        }

        const close = castLine('closers', b.id)
            || pickFrom(TOSSES, 'We move on.');
        lines.push({ who: b, text: close });

        return lines;
    }

    /**
     * A single-line aside from whoever is reading — the beat after a
     * story when there is no exchange. Same shape as before this change;
     * the two-anchor form lives in `banterBeat()`.
     *
     * `who` is a cast entry. Without one the line has no owner and the
     * machine pool is left alone, because a line that only a robot can
     * say is worse than a bland one when a person says it.
     *
     * The tic branch used to fire on every 8% roll regardless of whether
     * the tic had already been said, so a broadcast with the same two
     * anchors at the desk — which is the default — heard the same tic five
     * or six times an hour. It now skips if the tic is in the recent buffer
     * and falls through to the next option.
     */
    function banter(story, who) {
        const machine = !!(who && who.machine);
        const roll = Math.random();
        if (roll < 0.34) {
            return fillGeneric(
                pickFrom(machine ? ROBOT_ASIDES : CREW_ASIDES, ''), story);
        }
        if (roll < 0.62) return fillGeneric(pickFrom(CONTEXT_LINES, ''), story);
        if (roll < 0.74) {
            const castOpener = who ? castLine('openers', who.id) : null;
            return castOpener || pickFrom(OPENERS, '');
        }
        if (roll < 0.82 && who && who.tic && !hasSaidRecently(who.tic)) {
            return remember(who.tic);
        }
        const wire = sectorWire(story);
        return wire ? 'From the sector wire. ' + wire : pickFrom(OPENERS, '');
    }

    /** The short line that hands off to the next item. */
    const TOSSES = [
        'More on that as the relay clears.', 'Now, elsewhere in the sector.',
        'Turning to the next item on the rundown.', 'We move on.',
        'Staying with us. Next.', 'That story continues to develop. Meanwhile.',
        'Our next item comes in from the outer feeds.',
    ];
    function toss() { return pickFrom(TOSSES, 'We move on.'); }

    /** Dead-air filler: what the anchor mutters when nothing is queued. */
    const HOLDS = [
        'Standing by for the next relay.',
        'Holding. The feed is quiet.',
        'We appear to have a gap in the rundown. That is unusual.',
        'One moment. The beacon net is re-syncing.',
        'No traffic on the wire. That is either good news or the last news.',
    ];
    function hold() { return pickFrom(HOLDS, 'Standing by.'); }

    // ---------------------------------------------------------
    // Station idents
    // ---------------------------------------------------------

    const IDENTS = [
        'This is the Galactic News Network. Live, across the sector.',
        'You are watching G N N. The relay never sleeps.',
        'Galactic News Network. Every system. Every hour.',
        'G N N. Broadcasting on the beacon net since the founding.',
        'This is G N N sector control. Signal nominal.',
    ];
    function ident() { return pickFrom(IDENTS, IDENTS[0]); }

    const SIGNOFFS = [
        'We now return you to regular orbital programming.',
        'That is the state of the sector. G N N will continue to monitor.',
        'This has been the Galactic News Network. Stay on this frequency.',
    ];
    function signoff() { return pickFrom(SIGNOFFS, SIGNOFFS[0]); }

    // ---------------------------------------------------------
    // Commercials
    // ---------------------------------------------------------

    const SPONSOR_PREFIX = ['Orion', 'Meklar', 'Psilon', 'Silicoid', 'Darlok', 'Sakkra',
        'Klackon', 'Bulrathi', 'Alkari', 'Mrrshan', 'Antares', 'Draconis', 'Trans-Sector'];
    const SPONSOR_KIND = ['Heavy Industries', 'Cybernetics', 'Research Labs', 'Shipyards',
        'Commerce Hub', 'Stealth Optics', 'Mining Consortium', 'Terraforming Group',
        'Logistics Guild', 'Reactor Works', 'Assurance Syndicate', 'Deep Survey'];
    const TAGLINES = [
        'Built for the long dark.', 'We were there first.', 'Hull integrity is a promise.',
        'Because the vacuum does not negotiate.', 'Twelve centuries of tolerable outcomes.',
        'Ask your colony administrator.', 'Now approved in nineteen systems.',
        'The quiet choice of serious empires.', 'Refined where it is mined.',
        'Some assembly required. Assembly not included.',
    ];
    const LEGAL = [
        'Not liable for events beyond the heliopause.',
        'Results vary by gravity well.',
        'Void where prohibited by treaty.',
        'Subject to Council review. Council review is subject to us.',
        'Terms renegotiated annually, without notice, in your absence.',
        'Warranty ends at the terminator line.',
    ];

    function sponsorName() {
        return pickFrom(SPONSOR_PREFIX, 'Orion') + ' ' + pickFrom(SPONSOR_KIND, 'Heavy Industries');
    }

    /**
     * A multi-shot commercial script. The cutscene manager stitches actual
     * assets to each beat; this supplies the words.
     */
    function commercial() {
        const brand = sponsorName();
        const HARDWARE = ['Reactor', 'Hull', 'Drive', 'Array', 'Lattice', 'Foil',
            'Shield', 'Scanner', 'Cell', 'Frame', 'Rig'];
        const product = chance(0.55)
            ? pickFrom(GNNAssets.vocab('shipclasses'), 'Annihilator') + '-Class'
            : pickFrom(GNNAssets.vocab('stars'), 'Rigel') + ' '
            + pickFrom(HARDWARE, 'Reactor');
        return {
            brand,
            product,
            beats: [
                {
                    kind: 'hook', text: pickFrom([
                        'Deep space is not forgiving.',
                        'Every empire runs on something.',
                        'You have questions about the dark.',
                        'Somewhere out there, a hull is failing.',
                        'The Council will not save your convoy.',
                    ], 'Deep space is not forgiving.')
                },
                { kind: 'body', text: `${brand} presents the ${product} programme.` },
                {
                    kind: 'claim', text: pickFrom([
                        `Rated for ${(2 + (Math.random() * 40) | 0)} standard years of continuous operation.`,
                        `Now servicing ${(3 + (Math.random() * 60) | 0)} systems across the rim.`,
                        `Certified by the ${pickFrom(GNNAssets.vocab('races'), 'Psilon')} standards board.`,
                        `Field-proven at ${pickFrom(GNNAssets.vocab('stars'), 'Antares')}.`,
                    ], 'Field proven.')
                },
                { kind: 'tag', text: `${brand}. ${pickFrom(TAGLINES, 'Built for the long dark.')}` },
                { kind: 'legal', text: pickFrom(LEGAL, 'Results vary by gravity well.') },
            ],
        };
    }

    /** Public-service / network promos that break up the sponsor rotation. */
    function promo() {
        return {
            brand: 'GALACTIC NEWS NETWORK',
            product: 'SECTOR WATCH',
            beats: [
                { kind: 'hook', text: 'Coming up on the Galactic News Network.' },
                {
                    kind: 'body', text: pickFrom([
                        'Sector Watch, with continuous relay coverage.',
                        'The Colonial Report, every six hours.',
                        'Deep Survey, from the edge of the mapped dark.',
                        'Council Floor, gavel to gavel.',
                    ], 'Sector Watch.')
                },
                { kind: 'tag', text: 'Only on G N N.' },
            ],
        };
    }

    // ---------------------------------------------------------
    // Ticker
    // ---------------------------------------------------------

    const COMMODITIES = ['NEUTRONIUM FOIL', 'ZORTRIUM ORE', 'DURALLOY PLATE', 'ADAMANTIUM BAR',
        'DEUTERIUM', 'ANTIMATTER CELL', 'ORION ARTIFACT', 'CRYSTAL LATTICE',
        'BC/CREDIT EXCH', 'COLONY BOND', 'FUEL RANGE INDEX', 'HULL SCRAP'];
    const CONDITIONS = ['SOLAR WIND: SEVERE', 'SOLAR WIND: CALM', 'BEACON NET: NOMINAL',
        'BEACON NET: DEGRADED', 'WARP LANES: OPEN', 'WARP LANES: RESTRICTED',
        'COUNCIL SESSION: IN RECESS', 'QUARANTINE: LIFTED', 'PIRACY WATCH: ELEVATED'];

    function tickerSegments(stories) {
        const out = [];
        for (const c of COMMODITIES) {
            const v = (Math.random() * 9000 + 20).toFixed(1);
            const d = (Math.random() * 8 - 4);
            out.push(`${c}: ${v} ${d >= 0 ? '▲' : '▼'}${Math.abs(d).toFixed(2)}%`);
        }
        for (const c of CONDITIONS) out.push(c);
        for (const s of (stories || []).slice(0, 8)) {
            if (s && s.title) out.push('WIRE: ' + s.title.toUpperCase().slice(0, 90));
        }
        for (let i = 0; i < 3; i++) {
            out.push('SECTOR: ' + pickFrom(GNNAssets.vocab('stars'), 'RIGEL').toUpperCase()
                + ' — ' + pickFrom(['SURVEY COMPLETE', 'TRAFFIC HEAVY', 'RELAY REBUILD',
                    'CENSUS PENDING', 'DOCK FEES RAISED'], 'SURVEY COMPLETE'));
        }
        // Deterministic shuffle so the crawl never repeats the same neighbours.
        for (let i = out.length - 1; i > 0; i--) {
            const j = (Math.random() * (i + 1)) | 0;
            const t = out[i]; out[i] = out[j]; out[j] = t;
        }
        return out;
    }

    // ---------------------------------------------------------
    // Chyron / lower-third text
    // ---------------------------------------------------------

    function chyron(story) {
        if (!story) return 'GNN SECTOR RELAY';
        const k = keywords(story.titleRaw || story.title);
        const lead = (k[0] || 'sector').toUpperCase();
        return pickFrom([
            `${lead} WATCH`, `LIVE — ${lead}`, `DEVELOPING: ${lead}`,
            `${lead} — CONTINUOUS COVERAGE`, `SECTOR DESK: ${lead}`,
        ], 'GNN SECTOR RELAY');
    }

    return {
        properNouns, numbers, keywords, sourceText,
        sectorWire, banter, banterBeat, toss, hold,
        ident, signoff, commercial, promo,
        showOpen, intoBreak, outOfBreak, showClose, exchange, desk,
        twoWay,
        tickerSegments, chyron, sponsorName,
    };
})();