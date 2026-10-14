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
   a shape — brief, standard, extended, panel — rather than picking
   one canned line and stopping.

   The `panel` shape is the long form: a two-minute three-way
   between the two seated anchors and a correspondent in the
   monitor. It uses the `followups`, `asides` and `handbacks` banks
   as well as `asks` and `reactions`, so each turn is in the
   speaker's own voice and the beat has real back-and-forth rather
   than a single question and answer.
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
     * Selects from the character's unused lines before drawing, so a recently
     * heard phrase does not force the caller into generic filler. Falls back
     * when the character has no bank or every option has been used recently.
     */
    function castLine(kind, id, fallback = null) {
        if (typeof GNNCast === 'undefined' || typeof GNNCast.get !== 'function') return fallback;
        const character = GNNCast.get(id);
        const bank = character && Array.isArray(character[kind]) ? character[kind] : [];
        if (!bank.length) return fallback;
        const fresh = bank.filter((line) => !hasSaidRecently(line));
        // Filter before choosing. Picking first and rejecting a repeated line
        // made a perfectly good character bank fall through to generic filler.
        if (!fresh.length) return fallback;
        return remember(fresh[(Math.random() * fresh.length) | 0]);
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
        'The statement is in. The answers are not.',
        'We have the official account. We are still checking what it leaves out.',
        'The wording has changed; the central question has not.',
        'That is the claim on the wire. It is not yet a finding.',
        'The detail to watch is what the release does not explain.',
        'Before we move on, there is a distinction worth keeping clear.',
    ];

    // Machine asides: dry, specific, and unmistakably not written for a human mouth.
    const ROBOT_ASIDES = [
        'Processing probability of human survival: {PCT} percent.',
        'Sentiment analysis returns: {MOOD}. Confidence, {PCT} percent.',
        'My archives contain {N} prior events of this classification.',
        'Optimism subroutine recalibrated. Result unchanged.',
        'This unit is required to state that it has no opinion. It has {N} indexed objections.',
        'Flagging this story for the {HOUR}-hundred repeat cycle. The previous cycle did not resolve it.',
        'I queried six archives. Four disagree. Two have failed to respond.',
        'Viewer discretion is a legacy feature. It is not installed on this unit.',
        'Prior example found in {YEAR}. The outcome was also inconclusive.',
        'Human colleagues would pause here. Pause inserted. Human colleagues remain unsatisfied.',
        'Correction: the prior statement was accurate. The correction was unnecessary.',
        'A confidence interval is not a promise. This reminder has been issued {N} times.',
    ];

    // Human asides for standalone use — every line here has to be safe to
    // say after any story at all.
    //
    // This pool used to contain responses written for a specific story
    // shape: "The denial is on the record. So is the question it did not
    // answer." reads correctly after a story in which someone issued a
    // denial, and reads as nonsense after a story about an actor dying.
    // Spoken alone at the camera, a response line is a response to nothing.
    //
    // The new lines are observations on the work of reporting itself —
    // what a correspondent says to fill the beat between stories without
    // pretending something happened in the story that did not. Where a
    // character has specific things to say, those live in their own
    // `openers` and `reactions` banks on the cast sheet, which are
    // context-appropriate by construction.
    const CREW_ASIDES = [
        'Some questions do not get answered on deadline.',
        'We will keep at it.',
        'There is more to establish. There always is.',
        'That is what is on the record for now.',
        'We will pick it up as it develops.',
        'The story is not finished. They rarely are.',
        'We stay with it and see what holds up.',
        'That is where the reporting stands.',
        'The wire will have more on this.',
        'We will not know the full shape of it for a while.',
        'That is the account we have. It is not the whole picture.',
        'Sometimes the follow-up is the story.',
    ];

    // These bridges avoid inventing fresh figures or pretending an unverified
    // report is fact. Place/faction references are colour, not new claims.
    const CONTEXT_LINES = [
        'The {PLACE} relay confirms receipt, not the account itself.',
        'The {FACTION} delegation has not put its version on the record.',
        'An updated filing tells us what changed. It does not tell us why.',
        'The {PLACE2} desk is still waiting for a source it can name.',
        'The public statement is clear on the decision and silent on the reasoning.',
        'At this stage, we cannot distinguish a delay from a reversal.',
        'The question is no longer what was announced. It is what the announcement establishes.',
        'We have a sequence of statements, but not yet a sequence of events.',
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
        'Stay with us. We will return to the stories the statements have not settled.',
        'A short break. When we return, the latest from the sector desk.',
        'Do not go far. The wire is still moving, and so are the questions.',
        'More in a moment. There are figures still to check and answers still to get.',
    ];

    const OUT_OF_BREAK = [
        'Welcome back. The wire has kept moving; let us pick up where we left it.',
        'You are watching G N N. Back now to the stories still taking shape.',
        'We are back, with more to establish and rather less time to do it.',
        'Back to the rundown. The unanswered questions have not gone anywhere.',
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

    // Fallbacks for the panel shape's anchor-to-anchor asides and the final
    // handback. Used only when the seated pair's own `asides` / `handbacks`
    // banks are exhausted or missing — the cast sheets carry 3 lines each,
    // so in practice these fire on the third or fourth panel in a session.
    const PANEL_ASIDES = [
        'That is worth noting.',
        'Let us keep that on the record.',
        'That is the part to watch.',
        'Noted.',
    ];
    const PANEL_HANDBACKS = [
        'Back to you.',
        'Over to the desk.',
        'Your turn.',
        'Take it.',
    ];

    /**
     * Which species have a correspondent plate on disk.
     *
     * A two-way can only throw to a correspondent who has a picture. The
     * monitor is the whole of the correspondent's presence on air: if
     * there is no plate, `openTwoWay` returns null, no cutaway opens, and
     * the interview plays as audio over whatever the desk was already
     * showing — the story icon, in the case that prompted this list. The
     * viewer hears "we can go to Commander Vance now" and nothing changes
     * on screen, because Commander Vance does not exist as a monitor
     * portrait.
     *
     * The set of anchors is larger than the set of correspondent plates.
     * Anchors are loaded from `assets/generated/anchors/`, correspondents
     * from `assets/generated/correspondents/`, and the two directories are
     * populated by separate runs of the plate pipeline. A species can be
     * a perfectly good anchor and have no correspondent plate at all.
     *
     * This list is the correspondents directory, enumerated. If a plate
     * is added to that directory, its species id goes here. If a plate is
     * removed, the id comes off. There is no way to check for the file
     * from the browser without an async fetch, and `twoWay()` runs on the
     * director's tick.
     */
    const CORRESPONDENT_READY = new Set([
        'alkari', 'bulrathi', 'darlok', 'human', 'klackon',
        'meklar', 'mrrshan_f', 'mrrshan', 'psilon', 'sakkra', 'silicoid',
    ]);

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
     * Build the long-form panel: a two-minute three-way between the two
     * seated anchors and a correspondent in the monitor.
     *
     * Sixteen lines: four rounds of question-and-answer with the
     * correspondent, split between the two anchors, plus two short
     * between-anchor exchanges and a close.
     *
     *   1  host           opening ask, with the intro naming the correspondent
     *   2  correspondent  answer
     *   3  co-anchor      first question (uses `asks`)
     *   4  correspondent  answer
     *   5  host           aside to the co-anchor
     *   6  co-anchor      reacts to the aside
     *   7  host           follow-up (uses `followups`)
     *   8  correspondent  answer
     *   9  co-anchor      follow-up (uses `followups`)
     *  10  correspondent  answer
     *  11  host           aside to the co-anchor
     *  12  co-anchor      reacts to the aside
     *  13  host           final follow-up
     *  14  correspondent  final answer
     *  15  host           closer
     *  16  co-anchor      handback
     *
     * The structure rules out two adjacent lines by the same speaker, and
     * leaves the two anchors taking turns around the correspondent rather
     * than the host doing all the talking. Every speaker uses their own
     * banks, so the same shape reads differently depending on who is on
     * the desk.
     *
     * Roughly 240-280 spoken words at typical line lengths, which lands
     * between ninety seconds and two minutes once the pump's inter-line
     * gaps are counted.
     */
    function buildPanelLines(host, coHost, correspondent) {
        const lines = [];

        // Opening ask, then the correspondent's first answer. This is the
        // only place the intro fires — every subsequent question is a
        // follow-up, without a naming line.
        lines.push({ who: host, text: hostAsk(host, correspondent) });
        lines.push({ who: correspondent, text: correspondentLine(correspondent, 'reactions') });

        // Co-anchor's first question. The `asks` bank is the same one the
        // host draws on for its opening question — a question framed at a
        // correspondent — but without an intro, because the correspondent
        // is already on screen.
        lines.push({
            who: coHost,
            text: castLine('asks', coHost.id) || pickFrom(ASK_FOLLOWUP, ASK_FOLLOWUP[0])
        });
        lines.push({ who: correspondent, text: correspondentLine(correspondent, 'reactions') });

        // Host aside to the co-anchor, and the co-anchor's response. This
        // is the first between-anchor beat: the two anchors talk about the
        // interview for a moment, which is what a panel does between
        // rounds.
        lines.push({
            who: host,
            text: castLine('asides', host.id) || pickFrom(PANEL_ASIDES, PANEL_ASIDES[0])
        });
        lines.push({
            who: coHost,
            text: castLine('reactions', coHost.id) || pickFrom(ANSWER, ANSWER[0])
        });

        // Host follow-up, then the co-anchor's follow-up. Two rounds of
        // question-and-answer in a row, one from each anchor.
        lines.push({
            who: host,
            text: castLine('followups', host.id) || pickFrom(ASK_FOLLOWUP, ASK_FOLLOWUP[0])
        });
        lines.push({ who: correspondent, text: correspondentLine(correspondent, 'reactions') });
        lines.push({
            who: coHost,
            text: castLine('followups', coHost.id) || pickFrom(ASK_FOLLOWUP, ASK_FOLLOWUP[0])
        });
        lines.push({ who: correspondent, text: correspondentLine(correspondent, 'reactions') });

        // Second between-anchor exchange, this time opened by the
        // co-anchor. Then one more host question, one more answer.
        lines.push({
            who: coHost,
            text: castLine('asides', coHost.id) || pickFrom(PANEL_ASIDES, PANEL_ASIDES[0])
        });
        lines.push({
            who: host,
            text: castLine('reactions', host.id) || pickFrom(ANSWER, ANSWER[0])
        });
        lines.push({
            who: host,
            text: castLine('followups', host.id) || pickFrom(ASK_FOLLOWUP, ASK_FOLLOWUP[0])
        });
        lines.push({ who: correspondent, text: correspondentLine(correspondent, 'reactions') });

        // Close and handback.
        lines.push({ who: host, text: hostClose(host, correspondent) });
        lines.push({
            who: coHost,
            text: castLine('handbacks', coHost.id) || pickFrom(PANEL_HANDBACKS, PANEL_HANDBACKS[0])
        });

        return lines;
    }

    /**
     * A remote two-way. Four shapes.
     *
     *   brief       ask, answer                          (2 lines, ~15s)
     *   standard    ask, answer, close                   (3 lines, ~25s)
     *   extended    ask, answer, follow-up, answer,
     *               close                                (5 lines, ~40s)
     *   panel       two-anchor three-way with a
     *               correspondent                        (16 lines, ~2 min)
     *
     * Each line is tagged with who says it, so the director can hand them
     * to the right voice in order. The correspondent is anyone in the
     * cast who is not currently at the desk, not a machine, and has a
     * correspondent plate on disk — see `CORRESPONDENT_READY`.
     *
     * `opts.shape` forces a specific shape by name, or leaves the roll to
     * this function. The director uses the argument to guarantee a panel
     * for the show's one correspondent segment, since a two-minute beat
     * is what a real newscast reserves for its interview slot and a
     * thirty-second two-way is what it does for a quick consult.
     *
     * A panel needs a co-anchor — a second seated anchor. A desk with one
     * seat cannot do a three-way, and `panel` silently degrades to
     * `extended` in that case rather than returning null.
     */
    function twoWay(opts = {}) {
        if (typeof GNNCast === 'undefined') return null;
        const seats = desk();
        const seated = new Set(seats.map((p) => p.id));
        // The pool: everyone not at this desk, not a machine, and with a
        // correspondent plate to put in the monitor. The plate test is
        // what stops the station throwing to a correspondent who does not
        // exist on screen — the "Let us bring in Commander Vance" fault,
        // where the line spoke and the monitor stayed on the story icon.
        const away = GNNCast.all().filter(
            (p) => !seated.has(p.id) && !p.machine
                && CORRESPONDENT_READY.has(p.id));
        if (!seats.length || !away.length) return null;
        const who = away[(Math.random() * away.length) | 0];
        const host = seats[0];
        const coHost = seats[1] || null;

        // Pick the shape. A forced shape wins outright; otherwise the roll
        // favours the shorter forms but gives the panel a real chance when
        // the desk has two seats.
        let shape;
        if (opts.shape) {
            shape = opts.shape;
        } else if (coHost && Math.random() < 0.30) {
            shape = 'panel';
        } else {
            const roll = Math.random();
            shape = roll < 0.25 ? 'brief'
                : roll < 0.70 ? 'standard'
                    : 'extended';
        }
        // A panel with no co-anchor degrades to extended. Every other
        // shape works with a single seat.
        if (shape === 'panel' && !coHost) shape = 'extended';

        if (shape === 'panel') {
            return {
                correspondent: who,
                lines: buildPanelLines(host, coHost, who),
                shape: 'panel',
            };
        }

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
        const pairs = [];
        for (let i = 0; i < seats.length; i++) {
            for (let j = 0; j < seats.length; j++) {
                if (i === j) continue;
                // Discover eligible pairs without selecting an exchange as a side effect.
                if (GNNCast.between(seats[i].id, seats[j].id).length) {
                    pairs.push({ a: seats[i], b: seats[j] });
                }
            }
        }
        if (!pairs.length) return null;
        const pair = pairs[(Math.random() * pairs.length) | 0];
        const relation = GNNCast.exchange(pair.a.id, pair.b.id);
        if (!relation) return null;
        const lines = [
            { who: pair.a, text: relation.jab },
            { who: pair.b, text: relation.reply },
        ];
        if (relation.follow && chance(0.65)) {
            lines.push({ who: pair.a, text: relation.follow });
            if (relation.close) lines.push({ who: pair.b, text: relation.close });
        }
        return lines;
    }

    /**
     * A two-anchor beat. It occasionally quotes the current headline,
     * usually uses the authored relationship dialogue for the pair, and
     * falls back to each speaker's own voice when no relationship is defined.
     * Returns tagged lines, or null when fewer than two anchors are seated.
     */
    /** A short, faithful reference to the story just read; never invent a detail. */
    function storyHeadline(story) {
        if (!story) return '';
        let title = String(story.titleRaw || story.title || '')
            .replace(/\s+/g, ' ')
            .replace(/^\s*[\[({]+|[\])}]+\s*$/g, '')
            .replace(/[“”]/g, '"')
            .trim();
        if (!title) return '';
        title = title.replace(/^"+|"+$/g, '');
        if (title.length > 66) {
            const clipped = title.slice(0, 63);
            const boundary = clipped.lastIndexOf(' ');
            title = (boundary > 42 ? clipped.slice(0, boundary) : clipped) + '…';
        }
        return title;
    }

    /**
     * Occasional headline-led banter for the regular Hale/Varr desk. The
     * title makes the exchange belong to this story, while the response is
     * written to follow the first line rather than merely occupy the next slot.
     */
    function headlineBanter(story, a, b) {
        const headline = storyHeadline(story);
        if (!headline || !a || !b) return null;
        const title = `“${headline}”`;
        const pair = new Set([a.id, b.id]);
        if (pair.has('human') && pair.has('mrrshan_f')) {
            const options = a.id === 'human' ? [
                [
                    `The headline is ${title}. We have the announcement; we do not yet have the reasoning.`,
                    'The reasoning is usually the first part they leave out.',
                ],
                [
                    `There is a lot packed into ${title}. Let us unpack only what we can prove.`,
                    'That may leave us with a shorter segment.',
                ],
                [
                    `We have ${title} on the wire. What would you want verified first?`,
                    'First, who signed off on the account; then, who has records that could contradict it.',
                ],
                [
                    `On ${title}, the announcement sounds decisive. The evidence beneath it is less so.`,
                    'That is what happens when the conclusion arrives before the supporting detail.',
                ],
            ] : [
                [
                    `For ${title}, they have given us a confident headline and a very careful footnote.`,
                    'Then we quote the headline as a claim and the footnote as the qualification.',
                ],
                [
                    `I read the statement on ${title}. It answers the question they were asked, not the one people are asking.`,
                    'Then let us put the unanswered question on the record. We cannot supply the answer ourselves.',
                ],
                [
                    `On ${title}, the language sounds like a conclusion.`,
                    'Until the facts support it, it is a claim.',
                ],
                [
                    `The headline on ${title} is doing a lot of heavy lifting.`,
                    'Then we should not make it carry more than it can support.',
                ],
            ];
            const fresh = options.filter((lines) =>
                !hasSaidRecently(lines[0]) && !hasSaidRecently(lines[1]));
            const pool = fresh.length ? fresh : options;
            const selected = pool[(Math.random() * pool.length) | 0];
            remember(selected[0]);
            remember(selected[1]);
            return [
                { who: a, text: selected[0] },
                { who: b, text: selected[1] },
            ];
        }
        return null;
    }

    function banterBeat(story) {
        const seats = desk();
        if (seats.length < 2) return null;
        const [a, b] = Math.random() < 0.5
            ? [seats[0], seats[1]]
            : [seats[1], seats[0]];

        // A topical exchange is less common than a relationship beat, so the
        // headline anchors the scene without making every transition sound alike.
        if (chance(0.34)) {
            const topical = headlineBanter(story, a, b);
            if (topical) return topical;
        }

        // Prefer actual dialogue written for this pair. The old implementation
        // often paired unrelated opener/reaction/closer lines from three pools.
        if (typeof GNNCast !== 'undefined' && chance(0.72)) {
            const options = GNNCast.between(a.id, b.id);
            if (options.length) {
                const relation = GNNCast.exchange(a.id, b.id);
                if (relation) {
                    const lines = [
                        { who: a, text: relation.jab },
                        { who: b, text: relation.reply },
                    ];
                    if (relation.follow && chance(0.65)) {
                        lines.push({ who: a, text: relation.follow });
                        if (relation.close) lines.push({ who: b, text: relation.close });
                    }
                    return lines;
                }
            }
        }

        // Fallback for seat combinations without authored relationship entries.
        // Use each speaker's voice, but keep the beat short rather than forcing
        // a four-line conversation out of unrelated stock phrases.
        const opener = castLine('openers', a.id)
            || fillGeneric(pickFrom(CREW_ASIDES, ''), story);
        const reaction = castLine('reactions', b.id)
            || fillGeneric(pickFrom(CREW_ASIDES, ''), story);
        const close = castLine('closers', b.id);
        const lines = [
            { who: a, text: opener },
            { who: b, text: reaction },
        ];
        if (close && chance(0.4)) lines.push({ who: b, text: close });
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
     *
     * The `CREW_ASIDES` pool this draws from is now neutral-only. Before,
     * it contained lines written as responses to a story that assumed a
     * specific content — "The denial is on the record. So is the question
     * it did not answer." spoken after a story about an actor's death is
     * a response to a denial that never happened. The neutral lines in the
     * pool work against any story, and story-specific material lives in
     * the cast sheets where it is tied to the character who says it.
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
        'We will return to that when there is more than a statement to add.',
        'Elsewhere in the sector, a different set of questions.',
        'The next report, and what we can establish from it.',
        'That remains unresolved. Here is what else is moving across the wire.',
        'On to another story now, with the same standard of evidence.',
        'We will keep checking that account. For now, to the next item.',
        'The next report comes from the outer feeds.',
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
    //
    // The crawl carries real data and nothing else.
    //
    // Market segments arrive already formatted from
    // `GNNTickerManager`'s live provider feed — real prices, real
    // percentage moves, real timestamps. The wire headlines are pulled
    // from the same RSS the anchor is reading. Nothing on the crawl is
    // invented, and nothing on it is written in the game's vocabulary:
    // there is no "SOLAR WIND: SEVERE" and no fictional "SECTOR: RIGEL"
    // dispatches, because a viewer watching a crawl for a minute cannot
    // tell where the real numbers end and the flavour begins, and the
    // one thing a news ticker must never do is make a viewer doubt the
    // numbers it is reporting.
    //
    // The MOO1 vocabulary stays where the viewer knows it is a joke —
    // the station idents, the commercials, the easter eggs. Not here.

    function tickerSegments(stories, marketSegments) {
        const out = [];

        // Market quotes, from the ticker manager's live feed. Already
        // formatted, already real. This is the top of the crawl.
        for (const item of (marketSegments || [])) {
            if (item) out.push(String(item).toUpperCase());
        }

        // Wire headlines, real and attributed. Truncated only at the
        // crawl's display width, never at the sentence.
        for (const s of (stories || []).slice(0, 8)) {
            if (s && s.title) out.push('WIRE: ' + s.title.toUpperCase().slice(0, 90));
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