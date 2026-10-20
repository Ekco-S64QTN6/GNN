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

   The `CORRESPONDENT_READY` set is exported. It is the species that
   have a correspondent plate on disk and can therefore be thrown to
   on air — the two-way pool and the debate pool both filter against
   it. The director holds the read-only reference; this module owns
   the value. When the correspondents directory gains or loses a
   species, this file is the one that changes.
   ============================================================ */

const GNNScript = (() => {
    'use strict';

    // Defense in depth: a placeholder can already be queued or injected by
    // another path, so never let it become an on-air rundown teaser.
    const NON_STORY_TITLE = /^\s*(?:no\b.{0,60}\b(?:news|update|updates|developments?|stories|reports?|details)|nothing\s+to\s+report|no\s+further\s+(?:details|information|comment)|no\s+verified\s+developments?|no\s+verifiable\s+quote|more\s+on\s+this\s+later|developing\s+story)(?:\s+(?:today|yet|so\s+far|at\s+this\s+time|available|reported))?\s*[.!]?\s*$/i;

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

    /** What a colleague calls them across the desk: "Vance", "Analyst". */
    function addressName(p) {
        const name = String((p && p.name) || '');
        return name.replace(/^Commander\s+/, '').replace(/^The\s+/, '') || 'Commander';
    }

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
        const faction = pickFrom(nouns.slice(1), pickFrom(GNNAssets.vocab('races'), 'Psilon'));
        // The second place and faction must differ from the first, or a
        // bulletin reads "a ceasefire between the Psilon and the Psilon".
        const other = (list, not, fallback) => {
            const rest = (list || []).filter((x) => x !== not);
            return rest.length ? rest[(Math.random() * rest.length) | 0] : fallback;
        };
        const place2 = other(GNNAssets.vocab('stars'), place, 'Vega');
        const faction2 = other(GNNAssets.vocab('races'), faction, 'Darlok');
        const num = (pickFrom(nums, '') || String(2 + ((Math.random() * 40) | 0))).replace(/\s+/g, ' ');
        return template
            .replace(/\{PLACE2\}/g, place2)
            .replace(/\{PLACE\}/g, place)
            .replace(/\{FACTION2\}/g, faction2)
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
    // Removed: mining proper nouns out of the live RSS story and dropping
    // them into the 1993 bulletins. A story about a tragedy could surface
    // a real name or place inside a fabricated Galactic News Network
    // bulletin, which is the one thing this station must never do.
    // The bulletins now fill their {PLACE} and {FACTION} slots entirely
    // from the game's own vocabulary, where the viewer knows the
    // vocabulary is a joke.
    // Archive copy for the lore show, written in the voice of the 75
    // original bulletins and filled the same way. Two hours a night of
    // *Imperial Historical Wire* drawing on 75 lines repeated itself within
    // the first half hour; these are the station's own back catalogue.
    // Lore only — this pool is read by the lore show and nowhere else.
    const ARCHIVE_BULLETINS = [
        'The {FACTION} and {FACTION2} delegations have signed a non-aggression pact at {PLACE}. Observers give it {NUM} years at most.',
        'Trade talks between the {FACTION} and the {FACTION2} collapsed after {NUM} days when neither side would agree on the wording of the opening statement.',
        'The {FACTION} survey ship sent beyond {PLACE2} has returned with charts of {NUM} previously unknown systems.',
        'The {FACTION} have declared the {PLACE} system a protected nature reserve. Mining interests have filed {NUM2} objections.',
        'A derelict warship of unknown design has been found drifting near {PLACE}. Its crew has not been located.',
        'Pirates operating out of the {PLACE} asteroid belt have seized one of the {FACTION} freighters, carrying {NUM2} tonnes of refined zortrium.',
        'The {FACTION} high command has promoted {LEADER} to {TITLE} after the defence of {PLACE}.',
        'Colonists on {PLACE} report strange lights moving in formation over the northern ice fields. The {FACTION} garrison has declined to comment.',
        'A plague of crystalline spores has swept the {PLACE} agricultural domes. Food shipments from {PLACE2} are being diverted.',
        'The {FACTION} have completed an orbital ring around {PLACE}, the largest structure ever built by their engineers.',
        'An experimental hyperspace drive exploded on its first test run near {PLACE}. The {FACTION} research council has suspended the programme.',
        '{FACTION} archaeologists on {PLACE} have uncovered a vault sealed with symbols matching no known language. They have not yet opened it.',
        'The {FACTION} fleet has blockaded {PLACE}, demanding the return of {NUM} prisoners taken in the border dispute.',
        'A solar flare from the {PLACE} star has knocked out communications across {NUM} systems for nearly a week.',
        'The {FACTION} senate has voted {NUM} to {NUM2} to increase military spending for the third year running.',
        'Refugees from the {PLACE} colony have arrived at {PLACE2} after their world was rendered uninhabitable by orbital bombardment.',
        'The {FACTION} have announced a breakthrough in planetary shielding. Rivals have announced they do not believe it.',
        'The Space Amoeba has been sighted near {PLACE} for the first time in {NUM} years. Shipping lanes have been closed.',
        'A spy ring working for the {FACTION} on {PLACE} has been exposed. {NUM} agents were arrested, and {NUM} more are thought to have escaped.',
        'The great library of {PLACE} has been destroyed by fire. The {FACTION} claim the archives were backed up. Historians remain doubtful.',
        'The {FACTION} have terraformed {PLACE} from barren rock to temperate world in a single generation, a feat once thought impossible.',
        'An assassination attempt on {LEADER} of the {FACTION} has failed. The attacker was found to be carrying {FACTION2} credentials.',
        'Mining crews on {PLACE} have broken through into a cavern system containing what appear to be ancient Orion machines.',
        'The {FACTION} have recalled their ambassador from {PLACE2} after a diplomatic dinner ended in what witnesses describe as a brawl.',
        'A rogue planet has entered the {PLACE} system. Astronomers estimate it will pass within {NUM} million kilometres of the colony.',
        'The {FACTION} navy has commissioned its largest battleship yet, christened after the fallen of {PLACE}.',
        'A ceasefire has been declared between the {FACTION} and the {FACTION2} after {NUM} years of open war. Neither side has disarmed.',
        'Scientists on {PLACE} report that the local star has begun to dim. No natural cause has been identified.',
        'The {FACTION} have launched a colony ship toward {PLACE2} carrying {NUM} thousand settlers in cold sleep.',
        'The {FACTION} have unveiled a monument on {PLACE} to the crews lost in the Antaran raids.',
        'Antaran raiders struck {PLACE} without warning, destroying {NUM2} factories before vanishing through a dimensional rift.',
        'The {FACTION} research team at {PLACE} has reported contact with an intelligence living in the gas giant. The report has been classified.',
        'A record harvest on {PLACE} has ended the famine that has gripped the {FACTION} worlds for {NUM} seasons.',
        'The {FACTION} have outlawed robotic labour on {PLACE} after the workers there refused, collectively, to stop working.',
        'An entire {FACTION} patrol squadron has vanished near {PLACE}. The last transmission received was a single repeated word.',
        'The orbital shipyards of {PLACE} have launched {NUM2} warships this year, a record for the {FACTION} industrial sector.',
        'The Guardian of Orion has again destroyed a fleet attempting to land on the Orion homeworld. There were no survivors.',
        'The {FACTION} have granted full citizenship to the inhabitants of {PLACE}, ending {NUM} years of occupation.',
        'Diplomats meeting at {PLACE} have agreed to a common system of interstellar timekeeping. Nobody has agreed on what time it is now.',
        'A comet rich in frozen water has been captured into orbit around {PLACE}, solving the colony water shortage for a generation.',
        'The {FACTION} chief scientist {LEADER} has resigned after the failure of the {PLACE} weather control project.',
        'The ruins of a pre-Orion civilisation have been mapped on {PLACE}. The {FACTION} expedition reports the cities were abandoned in a single day.',
        'Smugglers have been caught moving banned {FACTION2} technology through the {PLACE} customs station hidden inside crates of livestock feed.',
        'The {FACTION} have opened the first public hyperspace ferry between {PLACE} and {PLACE2}. The waiting list runs to {NUM} years.',
        'A border skirmish near {PLACE} between {FACTION} and {FACTION2} patrols has left {NUM} ships disabled and both sides claiming victory.',
        'Children on {PLACE} have been taught in the {FACTION} tongue for the first time, after the colony changed hands {NUM} times in a generation.',
    ];

    function usableBulletin(b) {
        // The original set includes a header fragment that reads like a
        // sentence cut off mid-thought on air: "The census rankings of
        // empire populations:". Nothing ending in a colon, nothing tiny.
        const t = String(b || '').trim();
        return t.length >= 30 && !/:\s*$/.test(t);
    }

    /**
     * An intercepted transmission between empires, from the archive. The
     * words are the game's own diplomacy text, picked by hand
     * (assets/moo2-transmissions.json); the framing names who sent it, so
     * a line that says "our emperor" has an emperor to belong to. Lore only.
     */
    function intercepted() {
        if (typeof GNNAssets === 'undefined' || !GNNAssets.transmissions) return null;
        const court = chance(0.15);
        const pool = GNNAssets.transmissions(court ? 'court' : 'diplomatic');
        if (!pool.length) return null;
        const line = pickFrom(pool, pool[0]);
        const race = pickFrom(GNNAssets.vocab('races'), 'Psilon');
        const frame = court
            ? pickFrom([
                'From the archive, an address to the Emperor recorded in the ' + race + ' court.',
                'Recovered from the ' + race + ' state broadcast, an address to the throne.',
            ], '')
            : pickFrom([
                'From the archive, an intercepted transmission from the ' + race + ' delegation.',
                'Recovered from a ' + race + ' diplomatic channel, archive copy.',
                'An intercepted signal, attributed to the ' + race + ' foreign office.',
                'From the treaty archive, a message sent by the ' + race + ' envoy.',
            ], '');
        return frame + ' ' + line;
    }

    /** An Antaran transmission, for the intrusion fault. */
    function antaranLine() {
        if (typeof GNNAssets === 'undefined' || !GNNAssets.transmissions) return null;
        const pool = GNNAssets.transmissions('antaran');
        return pool.length ? pickFrom(pool, pool[0]) : null;
    }

    function sectorWire() {
        const pool = GNNAssets.bulletins().filter(usableBulletin)
            .concat(ARCHIVE_BULLETINS);
        if (!pool.length) return null;
        return fillBulletin(pickFrom(pool, ''), { nouns: [], numbers: [] });
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
        'This unit has logged the story. It has also logged its doubts.',
        'Probability that this account is complete: {PCT} percent.',
        'Cross-referencing. Cross-reference returned more questions than answers.',
        'My records show {N} similar reports. None ended as first described.',
        'Sentiment of the statement: {MOOD}. Sentiment of this unit: unchanged.',
        'This unit is not permitted to express surprise. It is noting the absence of surprise.',
        'Archiving under: unresolved. The archive is very large.',
        'A summary has been generated. It is shorter than the questions.',
        'This unit detects a pattern. It is not authorised to name it.',
        'Logging. Flagging. Waiting. This is most of what this unit does.',
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
        'We will be watching that one.',
        'Interesting.',
        'That will not be the final word.',
        'There is a lot left unsaid there.',
        'Expect a follow-up on that.',
        'We have questions. We will ask them.',
        'File that under developing.',
        'That is a story with a second act.',
        'Hm. Noted.',
        'It reads cleanly. That is what worries me.',
        'We will see how long that version lasts.',
        'That is the official line, anyway.',
    ];

    // These bridges avoid inventing fresh figures or pretending an unverified
    // report is fact. Place/faction references are colour, not new claims.
    const CONTEXT_LINES = [
        'The relay confirms receipt. It does not confirm the account.',
        'The other side has not yet put its version on the record.',
        'An updated filing tells us what changed. It does not tell us why.',
        'Our desk is still waiting for a source it can name.',
        'The public statement is clear on the decision and silent on the reasoning.',
        'At this stage, we cannot distinguish a delay from a reversal.',
        'The question is no longer what was announced. It is what the announcement establishes.',
        'We have a sequence of statements, but not yet a sequence of events.',
        'We will want to see the documents behind that.',
        'The timing of that announcement is worth noting.',
        'Two accounts so far, and they do not quite match.',
        'The official figure and the reported figure are not the same number.',
        'What has not been said is as interesting as what has.',
        'We have the claim. We do not yet have the evidence for it.',
        'There will be a response to this, and it will matter.',
        'The detail that matters may be the one buried in the third paragraph.',
        'It is early, and early reports are often wrong.',
        'This is the first account. It will not be the last.',
        'The question now is who confirms it, and when.',
        'Nobody involved has disputed it yet. That may change.',
    ];

    const MOODS = ['cautious', 'deteriorating', 'nominal', 'inconclusive', 'unusually calm',
        'statistically improbable', 'within tolerance', 'outside tolerance'];
    const ORDINALS = ['second', 'third', 'fourth', 'ninth', 'eleventh', 'nineteenth'];

    // Removed: the second parameter was read for proper nouns and used to
    // fill {PLACE}. Same fault as sectorWire had — a real name or place
    // from the RSS story appearing inside a fictional Galactic News
    // Network line. Every slot now fills from the game's vocabulary.
    // The `story` parameter is kept for API compatibility; it is unused.
    function fillGeneric(line, story) {   // eslint-disable-line no-unused-vars
        return line
            .replace(/\{PCT\}/g, String((Math.random() * 99).toFixed(1)))
            .replace(/\{N\}/g, String(2 + ((Math.random() * 400) | 0)))
            .replace(/\{MOOD\}/g, pickFrom(MOODS, 'inconclusive'))
            .replace(/\{HOUR\}/g, String(((Math.random() * 23) | 0)).padStart(2, '0'))
            .replace(/\{YEAR\}/g, String(2380 + ((Math.random() * 90) | 0)))
            .replace(/\{ORD\}/g, pickFrom(ORDINALS, 'third'));
        // No {PLACE} or {FACTION} here. These lines are spoken straight
        // after real stories, and filling them from the in-universe star
        // and race lists put "the Klackon delegation" and "the Antares
        // relay" into commentary on a real headline — lore and real news
        // are kept completely apart (LORE_BLOCKS, broadcast-director.js).
        // In-universe names belong in fillBulletin, which only the lore
        // show uses.
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

    const WIRE_LABEL_RE = /^(\[[^\]]+\]|\b(?:live|breaking|update|exclusive|analysis|watch|photos?|report|new|just in)\b\s*[:\-–—]\s*)/i;
    const CATEGORY_PREFIX_RE = /^(?:world(?:\s+events)?|white\s+house|international\s+relations|data\s+breaches|markets?|politics?|tech(?:nology)?|science|sports?|defense|military|business|economy|energy)\s*:\s*/i;
    const TRAILING_SOURCE_RE = /\s+(?:[|–—]|--|-)\s+[A-Za-z0-9\s.]{1,40}$/i;
    const TRAILING_PAREN_RE = /\s*\([^)]*\)$/;
    const DANGLING_RE = /^(?:of|in|to|for|with|on|at|from|by|about|into|through|after|over|between|under|against|during|without|before|towards|toward|around|round|among|across|behind|beyond|upon|and|or|but|nor|so|yet|as|if|while|though|although|because|unless|since|the|a|an|this|that|these|those|its|their|his|her|our|your|my|who|whom|whose|which|what|where|when|why|how|is|are|was|were|be|been|being|has|have|had|will|would|shall|should|can|could|may|might|must)$/i;
    const PREP_PHRASE_LEAD_RE = /^(?:strait|gulf|bay|sea|cape|isle|port|bank|city|state|house|department|ministry|secretary|president|minister|court|republic|kingdom|union|coast|border|island)\s+of$/i;
    const TWO_WORD_COMPOUNDS = [
        ['strait', 'of'], ['gulf', 'of'], ['bay', 'of'], ['sea', 'of'], ['cape', 'of'],
        ['white', 'house'], ['space', 'force'], ['wall', 'street'], ['federal', 'reserve'],
        ['united', 'states'], ['european', 'union'], ['united', 'nations'], ['prime', 'minister'],
        ['foreign', 'minister'], ['supreme', 'court'], ['defense', 'forces'], ['national', 'security']
    ];

    /**
     * Sentence-to-noun headline shortener.
     * Transforms long wire headlines into crisp, punchy spoken broadcast teasers
     * while preserving multi-word proper nouns, questions, and natural clause boundaries.
     */
    function shortenHeadline(title) {
        const original = String(title || '').trim();
        if (!original) return 'Developing stories on the wire';
        let t = original;

        // 1. Strip leading broadcast & category prefixes, but never allow a
        //    label-only headline to collapse to an empty string.
        t = t.replace(WIRE_LABEL_RE, '').trim() || original;
        t = t.replace(CATEGORY_PREFIX_RE, '').trim() || original;

        // 2. Strip trailing attribution and parentheticals, with the same
        //    protection against producing an empty teaser.
        const withoutSource = t.replace(TRAILING_SOURCE_RE, '').trim();
        if (withoutSource) t = withoutSource;
        const withoutParen = t.replace(TRAILING_PAREN_RE, '').trim();
        if (withoutParen) t = withoutParen;

        // Check if original headline is phrased as a question
        const isQuestion = /\?$/.test(t) || /^(?:could|can|will|would|is|are|was|were|why|how|what|who|where)\b/i.test(t);

        // 3. Remove mid-sentence appositive if it leaves a complete sentence
        // e.g. "Amber Siyavus, a star from 'Big Brother 8', has died at the age of 46"
        t = t.replace(/^([A-Z][a-zA-Z0-9'.\-–—\s]{1,35}),\s+[^,]{3,45},\s+(has|have|had|is|was|were|will|announces|dies|died|resigns|steps|faces|warns|says|leads)\b/i, '$1 $2');

        // 4. Split on secondary clause comma (e.g. ", with...", ", as...", ", carrying...", ", aiming to...")
        const commaClauseIdx = t.search(/,\s+(?:with|as|amid|amidst|following|after|prompting|sparking|aiming|seeking|according|officials|sources|report|reports|which|where|potentially|resulting|marking|triggering|described|highlighting|urging|warning|sending|bringing|leaving|carrying|while)\b/i);
        if (commaClauseIdx > 0) {
            const leadClause = t.slice(0, commaClauseIdx).trim();
            if (leadClause.split(/\s+/).length >= 4) {
                t = leadClause;
            }
        } else {
            // Also check standalone semicolon or em-dash clause
            const dashIdx = t.search(/\s+[;–—]\s+/);
            if (dashIdx > 0) {
                const leadClause = t.slice(0, dashIdx).trim();
                if (leadClause.split(/\s+/).length >= 4) {
                    t = leadClause;
                }
            }
        }

        // 5. Subordinate trailing clauses without comma if long (> 10 words)
        let words = t.split(/\s+/);
        if (words.length > 10) {
            const subIdx = t.search(/\s+(?:amid|in\s+the\s+wake\s+of|in\s+wake\s+of|ahead\s+of|after\s+(?:an?|the|\d+|reports?))\b/i);
            if (subIdx > 0) {
                const leadClause = t.slice(0, subIdx).trim();
                if (leadClause.split(/\s+/).length >= 5) {
                    t = leadClause;
                    words = t.split(/\s+/);
                }
            }
        }

        // 6. Word count budget: keep intact up to 14 words to avoid mutilating proper nouns
        if (words.length > 14) {
            let cut = 13;

            // Check if cutoff is splitting a compound or "Strait of [Name]"
            const wCutMinus1 = (words[cut - 1] || '').toLowerCase();
            const wCut = (words[cut] || '').toLowerCase();

            // Check if cut lands right on "Strait of"
            const prevTwo = `${(words[cut - 2] || '').toLowerCase()} ${wCutMinus1}`;
            if (PREP_PHRASE_LEAD_RE.test(prevTwo) && words[cut]) {
                cut++; // include the proper noun! e.g. "Strait of Hormuz"
            } else if (PREP_PHRASE_LEAD_RE.test(`${wCutMinus1} ${wCut}`) && words[cut + 1]) {
                cut += 2; // include "of" and the proper noun!
            } else {
                // Check 2-word compounds
                for (const [w1, w2] of TWO_WORD_COMPOUNDS) {
                    if (wCutMinus1 === w1 && wCut === w2) {
                        cut++;
                        break;
                    }
                }
            }

            t = words.slice(0, cut).join(' ');
        }

        // Run the dangling-ending correction after every kind of shortening,
        // not just the word-count cut. If the correction would leave only a
        // fragment, preserve the original headline instead.
        words = t.split(/\s+/);
        while (words.length > 4 && DANGLING_RE.test(words[words.length - 1])) {
            words.pop();
        }
        if (words.length < 4) {
            t = original;
        } else {
            t = words.join(' ');
        }

        // Strip trailing punctuation
        t = t.replace(/[.,:;!?-]+$/, '').trim();

        if (isQuestion) {
            t += '?';
        }

        return t || 'Developing stories on the wire';
    }

    function formatTeaser(text) {
        const s = String(text || '').trim();
        if (!s) return '';
        if (/[.!?]$/.test(s)) return s;
        return s + '.';
    }

    /**
     * Multi-story cold open rundown teaser ("Tonight on GNN: ...").
     * Uses queued stories to deliver a structured newsroom rundown exchange.
     */
    function rundownOpen(queue, showInfo) {
        const seats = desk();
        const leadAnchor = seats[0] || null;
        const coAnchor = seats[1] || null;
        if (!leadAnchor) return null;

        const stories = (queue || []).filter((s) =>
            s && (s.title || s.titleRaw)
            && !NON_STORY_TITLE.test(String(s.titleRaw || s.title || '')));
        if (stories.length < 2) return null;

        const t1 = shortenHeadline(stories[0].titleRaw || stories[0].title);
        const t2 = shortenHeadline(stories[1].titleRaw || stories[1].title);
        const t3 = stories[2] ? shortenHeadline(stories[2].titleRaw || stories[2].title) : null;

        const showName = (showInfo && showInfo.title) ? showInfo.title : 'the broadcast';
        const lines = [];
        lines.push({
            who: leadAnchor,
            text: `I am ${leadAnchor.name}. This is G N N. Tonight on ${showName}: ${formatTeaser(t1)}`,
            to: coAnchor,
        });

        if (coAnchor) {
            let coLine = `Plus: ${formatTeaser(t2)}`;
            if (t3) coLine += ` And later: ${formatTeaser(t3)}`;
            lines.push({
                who: coAnchor,
                text: coLine,
                to: leadAnchor,
            });
            lines.push({
                who: leadAnchor,
                text: 'We begin with the headlines.',
                to: coAnchor,
            });
        } else {
            lines.push({
                who: leadAnchor,
                text: `Plus: ${formatTeaser(t2)} We begin with the headlines.`,
                to: null,
            });
        }

        lines.teasedStories = stories.slice(0, t3 ? 3 : 2);
        return lines;
    }

    const BREAKING_INTROS = [
        'We interrupt with breaking news.',
        'Urgent reports crossing the desk right now.',
        'An emergency bulletin has just reached station control.',
        'We are breaking into the rundown with an urgent update.',
        'This just in.',
        'We have breaking news.',
        'We are interrupting the programme for an urgent report.',
        'A developing story has just reached the desk.',
        'We need to bring you an urgent update.',
        'Breaking now, and the details are still coming in.',
    ];

    function breakingIntro() {
        return pickFrom(BREAKING_INTROS, BREAKING_INTROS[0]);
    }

    /**
     * Top of the hour: the anchor names themselves first, then the
     * station, then what is coming up. `SHOW_OPEN` lines all begin with
     * the station's identification; the anchor's name is prefixed.
     */
    function showOpen(showInfo) {
        const who = lead();
        const showName = (showInfo && showInfo.title) ? showInfo.title : null;
        const line = showName
            ? `This is G N N and welcome to ${showName}. Let's get to the news from across the sector tonight.`
            : pickFrom(SHOW_OPEN, SHOW_OPEN[0]);
        if (!who) return line;
        return `I am ${who.name}. ${line}`;
    }

    const INTO_BREAK = [
        'Stay with us. We will return to the stories the statements have not settled.',
        'A short break. When we return, the latest from the sector desk.',
        'Do not go far. The wire is still moving, and so are the questions.',
        'More in a moment. There are figures still to check and answers still to get.',
        'We are going to pause there. The questions will still be waiting.',
        'Stay with us. There is more to get through on the other side of this.',
        'Time for a short break. Do not adjust your receiver.',
        'We will be right back with what is still unresolved.',
        'A break now. When we return, the stories that are still moving.',
        'Hold that thought. We will be back in a moment.',
        'Stay on this frequency. We have more to come.',
        'We take a short break. The rundown resumes shortly.',
        'Do not go anywhere. We are only just getting to the interesting part.',
        'More after this. Some of it may even be good news.',
        'A moment for our sponsors, who would like a word.',
        'Back shortly, with the parts of the story nobody has explained yet.',
    ];

    const OUT_OF_BREAK = [
        'Welcome back. The wire has kept moving; let us pick up where we left it.',
        'You are watching G N N. Back now to the stories still taking shape.',
        'We are back, with more to establish and rather less time to do it.',
        'Back to the rundown. The unanswered questions have not gone anywhere.',
        'And we are back. Thank you for staying with us.',
        'Back on air. Let us see what has changed while we were away.',
        'Welcome back to G N N. The rundown continues.',
        'We are back, and the wire has not been idle.',
        'Back to the desk, and back to the questions.',
        'Thank you for waiting. Let us get straight to it.',
        'We return to the news, which did not wait for us.',
        'Back with you now. Where we left off, things have moved.',
        'You are back with the Galactic News Network.',
        'We are on air again. Let us pick up the thread.',
        'Welcome back. Not much has been settled, so let us keep going.',
        'And we resume. The questions were all still here when we got back.',
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
        'That is all the time we have. The questions will keep.',
        'We leave it there for now. There will be more by the next hour.',
        'That is the end of the rundown. Thank you for watching.',
        'Nothing is settled, but our time is. Good night.',
        'We will be back on these stories as they develop.',
        'That brings us to the end. Stay with G N N for what comes next.',
        'That is the programme. The wire never closes, but we do, for now.',
        'Thank you for your attention. It is the scarcest thing we report on.',
        'We will leave it there, and pick it up again when there is more to say.',
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
        'We are joined now by %s.',
        '%s has been following this closely.',
        'For more, %s.',
        'Let us get the latest from %s.',
        '%s joins us from the scene.',
    ];
    // The question on the opening ask, after the intro. Also used alone
    // when the host has no asks bank and no intro to prepend.
    const ASK = [
        'What are you seeing?',
        'What is the picture from where you are?',
        'What can you add?',
        'What are you hearing?',
        'How does that read from your side?',
        'What is the latest?',
        'What is the mood where you are?',
        'Bring us up to date.',
        'What are people saying there?',
        'How much of the official account holds up?',
        'What do we know for certain?',
        'What should we be watching for?',
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
        'And is anyone disputing that?',
        'How long before we know more?',
        'Who is saying that, exactly?',
        'Does that change the picture?',
        'What happens next?',
        'Is that confirmed?',
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
        'It is quieter here than the statements would suggest. That usually means something is being decided behind closed doors.',
        'Everyone I have spoken to has a different version, and every version is convenient for whoever is telling it.',
        'The headline figure is holding for now. The detail underneath it is not.',
        'Nobody wants to be the first to say it on the record. Off the record, they are saying a great deal.',
        'The official line arrived very quickly, which is not the same thing as arriving accurately.',
        'What I can confirm is narrower than what has been reported. Much narrower.',
        'There is a lot of movement and not much information. I would treat early numbers with caution.',
        'The people closest to this are the least willing to talk about it. Draw your own conclusions.',
        'It is calmer than it was an hour ago. Calmer is not the same as settled.',
        'I have one source I trust on this, and they are not ready to say anything yet.',
    ];
    const THANKS = [
        'Thank you, %s.',
        '%s, thank you. We will come back to you.',
        'Our thanks to %s.',
        'Stay with it, %s. Thank you.',
        'We will check back with you, %s.',
        'Thank you, %s. Keep us posted.',
        '%s, appreciated. Stay safe out there.',
        'Thanks, %s. We will return to you as it develops.',
        'That is %s, reporting for us.',
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
        'That is the crux of it.',
        'I would push back on that.',
        'Fair point.',
        'We should be careful with that claim.',
        'That is a big assumption.',
        'Agreed, up to a point.',
        'That is where the evidence runs out.',
        'Let us stay with that for a moment.',
    ];
    const PANEL_HANDBACKS = [
        'Back to you.',
        'Over to the desk.',
        'Your turn.',
        'Take it.',
        'Back to you at the desk.',
        'I will leave it there.',
        'That is my view. Over to you.',
        'Your floor.',
        'Over to the panel.',
        'I will hand it back.',
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
     *
     * It is exported as `GNNScript.CORRESPONDENT_READY`. The director
     * holds the read-only reference and uses it in `beginDebate` — the
     * debate pool needs the same filter, because a debate guest goes into
     * the same PIP monitor a two-way uses and the same plate availability
     * applies. Keeping one copy rather than two means the two pools
     * cannot disagree about who is on disk.
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
        // `{TO}` is whoever has the lead. The banks used to name a fixed
        // partner — Vance, Kira and Ssyth all handed back to "Hale", who
        // never sits at their desks.
        lines.push({
            who: coHost,
            text: (castLine('handbacks', coHost.id) || pickFrom(PANEL_HANDBACKS, PANEL_HANDBACKS[0]))
                .replace(/\{TO\}/g, addressName(host))
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
        // No bulletin fallback. This used to end in "From the sector wire."
        // and a MoO1 event bulletin, which put lore straight after a real
        // story. Lore airs only in its own show now (LORE_BLOCKS in
        // broadcast-director.js).
        return pickFrom(OPENERS, '');
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
        'On to the next story.',
        'Turning now to something else on the wire.',
        'That is where it stands. Next.',
        'Moving on, to a story that has had a busier day.',
        'Let us turn to the next report.',
        'Next, a story we have been following.',
        'Now to another item crossing the desk.',
        'We will leave that there and move on.',
        'From that, to this.',
        'Another story now, and another set of claims to check.',
        'Next on the rundown.',
    ];
    function toss() { return pickFrom(TOSSES, 'We move on.'); }

    /** Dead-air filler: what the anchor mutters when nothing is queued. */
    const HOLDS = [
        'Standing by for the next relay.',
        'Holding. The feed is quiet.',
        'We appear to have a gap in the rundown. That is unusual.',
        'One moment. The beacon net is re-syncing.',
        'No traffic on the wire. That is either good news or the last news.',
        'The rundown is empty for the moment. That never lasts.',
        'Standing by. The next report is on its way.',
        'A quiet minute on the wire. We will take it.',
        'Waiting on the next feed. Please stay with us.',
        'Nothing new for the moment. We are still listening.',
        'The desk is clear. That is unusual, and probably temporary.',
        'We are between stories. Bear with us.',
        'Holding for the next item. It is on its way.',
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
        'G N N. Every hour, every system, on the record.',
        'You are tuned to the Galactic News Network.',
        'This is G N N. The news, checked twice.',
        'Galactic News Network. Live and on the record.',
        'G N N. The station that does not sleep.',
        'This is the Galactic News Network, broadcasting continuously.',
        'G N N. We report. We verify. We report again.',
        'Galactic News Network. Stay on this frequency.',
        'This is G N N. Signal steady.',
        'G N N. Where the story is not finished until it is checked.',
    ];
    function ident() { return pickFrom(IDENTS, IDENTS[0]); }

    const SIGNOFFS = [
        'We now return you to regular orbital programming.',
        'That is the state of the sector. G N N will continue to monitor.',
        'This has been the Galactic News Network. Stay on this frequency.',
        'Stay tuned to G N N.',
        'This is G N N. We will be right here.',
        'The Galactic News Network, on air around the clock.',
        'You are watching G N N. The rundown continues.',
        'G N N. Still here. Still checking.',
        'We return now to the news desk.',
        'That was a word from our sponsors. This is G N N.',
    ];
    function signoff() { return pickFrom(SIGNOFFS, SIGNOFFS[0]); }

    // ---------------------------------------------------------
    // Commercials
    // ---------------------------------------------------------

    // The generator behind most commercial spots. Every bank here was a
    // handful long — five hooks, four claims, six legal lines — which on a
    // channel running for hours means the same sentence every few breaks.
    // `pickFrom` holds back the recent half of a list, so a list of four
    // can only ever alternate; these are long enough that it cannot.
    const SPONSOR_PREFIX = ['Orion', 'Meklar', 'Psilon', 'Silicoid', 'Darlok', 'Sakkra',
        'Klackon', 'Bulrathi', 'Alkari', 'Mrrshan', 'Antares', 'Draconis', 'Trans-Sector',
        'Rigel', 'Vega', 'Sirius', 'Altair', 'Kholdan', 'Fieras', 'Mentar', 'Cryslon',
        'Ursa', 'Meklon', 'Nazin', 'Sssla', 'Elerian', 'Gnolam', 'Trilarian',
        'First Colonial', 'Deep Rim', 'Inner Belt', 'Heliopause'];
    const SPONSOR_KIND = ['Heavy Industries', 'Cybernetics', 'Research Labs', 'Shipyards',
        'Commerce Hub', 'Stealth Optics', 'Mining Consortium', 'Terraforming Group',
        'Logistics Guild', 'Reactor Works', 'Assurance Syndicate', 'Deep Survey',
        'Propulsion Company', 'Agricultural Collective', 'Orbital Foundry',
        'Medical Directorate', 'Hydroponics', 'Data Exchange', 'Freight Lines',
        'Armaments', 'Atmospherics', 'Holdings', 'Biologics', 'Navigation Bureau',
        'Life Support Systems', 'Drydock Services', 'Credit Union', 'Salvage Rights'];
    const HARDWARE = ['Reactor', 'Hull', 'Drive', 'Array', 'Lattice', 'Foil',
        'Shield', 'Scanner', 'Cell', 'Frame', 'Rig', 'Coil', 'Manifold', 'Lens',
        'Stabiliser', 'Condenser', 'Gyro', 'Beacon', 'Filter', 'Regulator',
        'Thruster', 'Capacitor', 'Scrubber', 'Plating', 'Harness'];
    // Generator hardware a product still reads as. A shield is the
    // deflector coil; a power part is the energy cell.
    const HARDWARE_STILLS = {
        Shield: 'tachyon_deflector_coil.png', Coil: 'tachyon_deflector_coil.png',
        Drive: 'tachyon_deflector_coil.png', Stabiliser: 'tachyon_deflector_coil.png',
        Reactor: 'tachyon_energy_cell.png', Cell: 'tachyon_energy_cell.png',
        Capacitor: 'tachyon_energy_cell.png', Condenser: 'tachyon_energy_cell.png',
        Scanner: 'navigation_computer.png', Array: 'navigation_computer.png',
        Regulator: 'navigation_computer.png', Foil: 'thermal_survival_envelope.png',
        Lens: 'mrrshan_hunting_optics.png',
    };
    const HOOKS = [
        'Deep space is not forgiving.',
        'Every empire runs on something.',
        'You have questions about the dark.',
        'Somewhere out there, a hull is failing.',
        'The Council will not save your convoy.',
        'Nobody remembers the second ship to arrive.',
        'Your reactor has been making that sound for a week.',
        'There are two kinds of captain. Insured, and remembered.',
        'The nearest drydock is four jumps away. Plan accordingly.',
        'Vacuum is patient. Are you?',
        'Your colony deserves better air.',
        'Out here, a spare part is a love letter.',
        'The rim does not care about your schedule.',
        'Every great fleet started with one reliable bolt.',
        'You did not cross eleven systems to settle for second best.',
        'When the lights go out on deck four, who do you call?',
        'Some things should not be built by the lowest bidder.',
        'Your grandparents trusted us with the first colony ships.',
        'The quiet hum of a well-tuned drive. Listen.',
        'Thirty light years from help. Choose your equipment carefully.',
        'Meteor season is coming to the inner belt.',
        'Ask any veteran what failed first.',
    ];
    const TAGLINES = [
        'Built for the long dark.', 'We were there first.', 'Hull integrity is a promise.',
        'Because the vacuum does not negotiate.', 'Twelve centuries of tolerable outcomes.',
        'Ask your colony administrator.', 'Now approved in nineteen systems.',
        'The quiet choice of serious empires.', 'Refined where it is mined.',
        'Some assembly required. Assembly not included.',
        'Engineered to outlast the warranty, and the engineer.',
        'Trusted by three of the five surviving admiralties.',
        'Making the impossible merely expensive.',
        'Go further. Come back.',
        'Because spare parts are not a personality.',
        'Built by people who have actually been out there.',
        'The standard every other standard is measured against.',
        'Proudly over-specified since the founding.',
        'Good enough for the frontier. Better than it needs to be.',
        'Your crew will never know how close it was.',
        'Reliability you will forget you paid for.',
        'From the core worlds to the last lit buoy.',
        'Nothing fancy. Nothing fails.',
        'Ask for it by name. Then ask again, louder, over the static.',
        'The difference between a delay and a disaster.',
        'Because hope is not a maintenance schedule.',
        'Built once. Built right. Built in triplicate, for the auditors.',
        'Somewhere, a quartermaster is smiling.',
    ];
    const LEGAL = [
        'Not liable for events beyond the heliopause.',
        'Results vary by gravity well.',
        'Void where prohibited by treaty.',
        'Subject to Council review. Council review is subject to us.',
        'Terms renegotiated annually, without notice, in your absence.',
        'Warranty ends at the terminator line.',
        'Not rated for use within the event horizon of anything.',
        'Performance figures obtained under laboratory vacuum by trained staff.',
        'Past orbital performance does not guarantee future orbital performance.',
        'Some features require a licence your species may not qualify for.',
        'Do not operate while hibernating.',
        'Product may contain trace amounts of the previous product.',
        'Consult your ship’s physician before any jump exceeding nine parsecs.',
        'Offer not valid in contested sectors or during declared hostilities.',
        'All sales final once the vessel has left the system.',
        'Recall notices are delivered by the slowest available courier.',
        'Any resemblance to a known hull failure is coincidental.',
        'Financing subject to approval by a committee that rarely meets.',
        'Not compatible with ships older than their captains.',
        'Batteries, fuel, crew and common sense not included.',
        'Prices quoted in standard credits at today’s exchange, which has already changed.',
        'Pending certification in the Psilon jurisdictions. Pending indefinitely.',
    ];

    function sponsorName() {
        return pickFrom(SPONSOR_PREFIX, 'Orion') + ' ' + pickFrom(SPONSOR_KIND, 'Heavy Industries');
    }

    function claimLine(brand) {
        const n = (lo, hi) => lo + ((Math.random() * (hi - lo + 1)) | 0);
        const star = () => pickFrom(GNNAssets.vocab('stars'), 'Antares');
        const race = () => pickFrom(GNNAssets.vocab('races'), 'Psilon');
        return pickFrom([
            `Rated for ${n(2, 41)} standard years of continuous operation.`,
            `Now servicing ${n(3, 62)} systems across the rim.`,
            `Certified by the ${race()} standards board.`,
            `Field-proven at ${star()}.`,
            `Ninety-${n(1, 9)} percent of surveyed captains would fly it again.`,
            `Tested through ${n(4, 30)} consecutive solar flares at ${star()}.`,
            `Lighter than the last model by ${n(6, 31)} percent. Stronger by more.`,
            `The only one of its kind to survive the ${star()} incident.`,
            `Specified as standard by ${n(2, 9)} colonial fleets.`,
            `Installs in under ${n(2, 9)} hours with a crew of ${n(1, 3)}.`,
            `Approved for civilian use in every system the ${race()} still recognise.`,
            `Backed by ${brand}'s ${n(10, 99)}-cycle structural guarantee.`,
            `Now with ${n(2, 6)} redundant systems, where it used to have one.`,
            `Built in the orbital foundries above ${star()}.`,
        ], 'Field proven.');
    }

    /**
     * A multi-shot commercial script. The cutscene manager stitches actual
     * assets to each beat; this supplies the words.
     */
    function commercial() {
        const brand = sponsorName();
        const part = pickFrom(HARDWARE, 'Reactor');
        const ship = chance(0.55);
        const product = ship
            ? pickFrom(GNNAssets.vocab('shipclasses'), 'Annihilator') + '-Class'
            : pickFrom(GNNAssets.vocab('stars'), 'Rigel') + ' ' + part;
        // Hardware that one of the shop's product stills can stand in for
        // goes on the showroom pedestal; anything else keeps the usual
        // footage and generic sets.
        const still = !ship && HARDWARE_STILLS[part];
        return {
            kind: 'commercial',
            brand,
            product,
            productImage: still ? 'assets/generated/products/' + still : undefined,
            stage: still ? ['assets/generated/infomercials/galaxy_shop_pedestal.png'] : undefined,
            beats: [
                { kind: 'hook', text: pickFrom(HOOKS, HOOKS[0]) },
                {
                    kind: 'body', text: pickFrom([
                        `${brand} presents the ${product} programme.`,
                        `From ${brand}: the ${product}.`,
                        `Introducing the ${product}, from ${brand}.`,
                        `${brand} is proud to present the new ${product}.`,
                        `The ${product}. Only from ${brand}.`,
                    ], `${brand} presents the ${product}.`)
                },
                { kind: 'claim', text: claimLine(brand) },
                { kind: 'tag', text: `${brand}. ${pickFrom(TAGLINES, 'Built for the long dark.')}` },
                { kind: 'legal', text: pickFrom(LEGAL, 'Results vary by gravity well.') },
            ],
        };
    }

    // The station's named sponsors. Each has a generated logo in
    // assets/generated/sponsors/ that closes its spot; the procedural
    // generator above makes up a brand every time and so has none. These
    // are the regulars a viewer comes to recognise.
    const SPONSORS = [
        { brand: 'Orion Heavy Industries', logo: 'orion_heavy_industries.png',
          stage: 'foundry_floor.png',
          products: ['Titan-Class Ore Hauler', 'Orbital Drydock Module', 'Mark Nine Reactor Housing'],
          hooks: ['Somebody has to build the things that build the empire.',
                  'Every great fleet starts in a foundry.',
                  'You have seen our work. You have probably flown in it.'],
          claims: ['Over {N} hulls launched from our yards this cycle alone.',
                   'Rated to {N} standard gravities of structural load.',
                   'The yard of choice for {N} colonial navies.'],
          tags: ['Orion Heavy Industries. We build the long dark a little smaller.',
                 'Orion Heavy Industries. Forged, not assembled.'] },
        { brand: 'Sirius Hyper-Drive Systems', logo: 'sirius_hyperdrive.png',
          stage: 'hyperspace_bridge.png',
          products: ['Starlance Jump Drive', 'Mark Four Warp Coil', 'Quiet-Run Navigation Core'],
          hooks: ['The distance between stars is a choice.',
                  'Why wait three weeks to arrive somewhere?',
                  'Every second in transit is a second not spent arriving.'],
          claims: ['Cuts transit times by up to {N} percent on standard lanes.',
                   'Certified for {N} consecutive jumps without recalibration.',
                   'Now installed in {N} thousand civilian hulls.'],
          tags: ['Sirius Hyper-Drive Systems. Be there already.',
                 'Sirius Hyper-Drive Systems. The fastest way across the dark.'] },
        { brand: 'Betelgeuse Pharmaceuticals', logo: 'betelgeuse_pharmaceuticals.png',
          stage: 'pharmacy_med_bay.png',
          products: ['Jump-Sickness Relief Tablets', 'Cryosleep Recovery Tonic', 'Radiation Shield Supplement'],
          hooks: ['Space travel is hard on the body. We make it a little easier.',
                  'Arrived at your destination feeling like you crossed four systems?',
                  'Your crew deserves to feel human. Or whatever they are.'],
          claims: ['Clinically tested on {N} species, with acceptable results in most of them.',
                   'Relief within {N} minutes for nine travellers in ten.',
                   'The most prescribed travel medicine in {N} systems.'],
          tags: ['Betelgeuse Pharmaceuticals. Feel better, wherever you are.',
                 'Betelgeuse Pharmaceuticals. Ask your ship’s physician.'] },
        { brand: 'Rigel Agricultural Cartel', logo: 'rigel_agricultural_cartel.png',
          stage: 'hydroponic_dome_fields.png',
          products: ['Hydroponic Grain Seed', 'Dome-Grown Protein Ration', 'Orbital Fruit Harvest'],
          hooks: ['Every colony is three meals away from a crisis.',
                  'You cannot terraform an appetite.',
                  'The galaxy runs on many things. Mostly, it runs on lunch.'],
          claims: ['Feeding {N} million colonists every standard day.',
                   'Our grain grows in {N} percent less light than the leading strain.',
                   'Harvested on {N} worlds, shipped to all of them.'],
          tags: ['Rigel Agricultural Cartel. We feed the frontier.',
                 'Rigel Agricultural Cartel. From our domes to your table.'] },
        { brand: 'Darlok Security Solutions', logo: 'darlok_security_solutions.png',
          stage: 'security_monitoring_room.png',
          products: ['Perimeter Cloak Field', 'Silent Watch Monitoring Service', 'Encrypted Comm Relay'],
          hooks: ['Who is watching your colony tonight?',
                  'You will never see us coming. Neither will they.',
                  'The best security is the kind nobody notices.'],
          claims: ['Protecting {N} installations across the sector. We cannot say which.',
                   'Zero confirmed breaches in {N} years of service.',
                   'Trusted by {N} governments, several of them at war with each other.'],
          tags: ['Darlok Security Solutions. We were never here.',
                 'Darlok Security Solutions. Rest easy. We are watching.'] },
    ];

    /** A spot for one of the station's named sponsors. */
    function sponsored() {
        const sp = pickFrom(SPONSORS, SPONSORS[0]);
        const fill = (t) => fillGeneric(t, null);
        // Picked once: the body line used to pick again, so the card and
        // the product still could name a different product from the voice.
        const product = pickFrom(sp.products, sp.products[0]);
        return {
            kind: 'commercial',
            brand: sp.brand,
            product,
            logo: sp.logo,
            // The sponsor's own set, once generated (Prompts/
            // Infomercial_Backdrop_prompts.md). Until the file exists the
            // spot uses archive footage, as before.
            stage: sp.stage ? ['assets/generated/infomercials/' + sp.stage] : null,
            beats: [
                { kind: 'hook', text: pickFrom(sp.hooks, sp.hooks[0]) },
                { kind: 'body', text: sp.brand + ' presents the ' + product + '.' },
                { kind: 'claim', text: fill(pickFrom(sp.claims, sp.claims[0])) },
                { kind: 'tag', text: pickFrom(sp.tags, sp.tags[0]) },
                { kind: 'legal', text: pickFrom(LEGAL, 'Results vary by gravity well.') },
            ],
        };
    }

    // Network promos, one per real show on this channel (the ten blocks in
    // assets/generated/show-config.json), plus Council public-service
    // notices.
    //
    // `logo` is a file in assets/generated/logos/, shown on the promo's
    // body and tag shots. A logo is attached only when its lettering names
    // the show or that show's desk — TECH DESK is Deep Survey's desk, so it
    // qualifies; MARKET DESK names no show's desk, so it does not. Four
    // shows have no logo that fits and run without one rather than with a
    // card advertising a different programme. There were four promos, all generic, and three of the four
    // named shows the channel does not run.
    const SHOW_PROMOS = [
        // Shows added with the 96-slot day. Logos where one exists.
        { show: 'Sector Weather Watch', covers: 'storms, fires and floods across the sector', lines: [
            'Storms, heat and flood, wherever they are breaking, every two hours.',
            'The forecast for the worlds you live on, and the ones you are travelling to.',
        ], tag: 'Sector Weather Watch. Know before you launch.' },
        { show: 'Solar Wind Overnight', covers: 'the overnight weather and the science behind it', lines: [
            'Through the night, the weather that does not stop when you sleep.',
            'Flares, storms and the long dark forecast, read quietly.',
        ], tag: 'Solar Wind Overnight. We watch the sky so you can close your eyes.' },
        { show: 'Rim Sports Wire', covers: 'every result on the sports wire', lines: [
            'Every result, every upset, from every league worth following.',
            'The scores, the stories behind them, and the arguments after.',
        ], tag: 'Rim Sports Wire. Somebody always wins.' },
        { show: 'The Arena Hour', covers: 'the games, the scores and the arguments after', lines: [
            'The evening’s games, picked apart by people who played them.',
            'Big wins, bad calls and the replays nobody can agree on.',
        ], tag: 'The Arena Hour. Settle in.' },
        { show: 'Sector Midday Wire', covers: 'politics, diplomacy and the markets at midday', logo: 'sector_midday_wire.png', lines: [
            'Halfway through the cycle, and here is what has changed since morning.',
            'The noon briefing: politics, markets and the stories still moving.',
        ], tag: 'Sector Midday Wire. The day so far.' },
        { show: 'Market Close', covers: 'the markets, trade and the money behind them', lines: [
            'The closing bell, the numbers, and what they mean for tomorrow.',
            'Where the money went today, in fifteen minutes.',
        ], tag: 'Market Close. Before the next market opens.' },
        { show: 'Orbital Briefing', covers: 'launches, missions and the science of space', lines: [
            'Launches, landings and everything in between.',
            'The missions, the hardware and the people far above us.',
        ], tag: 'Orbital Briefing. Look up.' },
        { show: 'The Council Hour', covers: 'the debates the delegations would rather avoid', lines: [
            'One question. Two sides. No easy answers.',
            'The debate the delegations would rather not have on air.',
        ], tag: 'The Council Hour. Hold your seat.' },
        { show: 'Galactic Spotlight', covers: 'the stories everyone is talking about', lines: [
            'Culture, celebrity and the people the whole sector is talking about.',
            'The stories behind the headlines everyone is sharing.',
        ], tag: 'Galactic Spotlight. Look who is talking.' },
        { show: 'The Night Desk', covers: 'the night’s top stories from across the wire', lines: [
            'For the long shift and the sleepless: the news, kept company.',
            'When the sector sleeps, the desk stays open.',
        ], tag: 'The Night Desk. We are still here.' },
        { show: 'Deep Signal', covers: 'the strange, the unexplained and the newest science', lines: [
            'The strange, the unexplained, and the questions science has not closed.',
            'Signals from the edge, and the people listening for them.',
        ], tag: 'Deep Signal. Something is out there. We report it.' },
        { show: 'Chronicles of the Old Empires', covers: 'the histories of the old empires', lines: [
            'The wars and treaties that drew the borders we live inside.',
            'From the archive, the history the empires would rather you forgot.',
        ], tag: 'Chronicles of the Old Empires. The past is not finished.' },
        { show: 'World Desk Tonight', covers: 'world news, and the politics behind it', lines: [
            'The whole world in one desk, every night.',
            'Tonight’s biggest stories, and the questions no one is answering.',
        ], tag: 'World Desk Tonight. The day, accounted for.' },
        { show: 'Signal and Circuit', covers: 'technology, computing and the thinking machines', lines: [
            'The chips, the code and the companies betting everything on them.',
            'Technology news, without the brochure.',
        ], tag: 'Signal and Circuit. Plug in.' },
        { show: 'Galactic Morning Watch', covers: 'the morning’s world news and diplomacy', logo: 'galactic_morning_watch.png', lines: [
            'Start the cycle with the whole sector in one hour.',
            'Overnight from the rim, the markets at first light, and the weather on fourteen worlds.',
        ], tag: 'Galactic Morning Watch. Every morning, every system.' },
        { show: 'Deep Space Economy', covers: 'markets, money and the economy', logo: 'deep_space_economy.png', lines: [
            'Where the credits went, and who is still holding them.',
            'Tariffs, freight rates and the price of zortrium, explained by people who lose money on it.',
        ], tag: 'Deep Space Economy. Follow the cargo.' },
        { show: 'Council Crossfire', covers: 'the arguments the sector cannot settle', logo: 'council_crossfire.png', lines: [
            'Two delegations. One microphone. No mercy from the chair.',
            'The arguments the Council has in private, held in public.',
        ], tag: 'Council Crossfire. Someone always walks out.' },
        { show: 'Deep Survey and Cybernetics', covers: 'science, space and technology', logo: 'tech_desk.png', lines: [
            'The machines, the labs, and the edge of what anyone understands.',
            'New hardware, old mysteries, and the engineers who will not stop poking them.',
        ], tag: 'Deep Survey and Cybernetics. Read the fine print of the universe.' },
        { show: 'Machine Intelligence Log', covers: 'artificial intelligence and the machines that think', lines: [
            'What the thinking machines are thinking. As far as they will say.',
            'Synthetic minds, reported by a desk that includes one.',
        ], tag: 'Machine Intelligence Log. The unit is listening.' },
        { show: 'Colonial Mining and Trade', covers: 'mining, energy and the trade routes', lines: [
            'From the ore face to the freight dock, the economy you can hold.',
            'Every claim filed, every seam struck, every convoy that came home light.',
        ], tag: 'Colonial Mining and Trade. Dig deeper.' },
        { show: 'Council Summit Floor', covers: 'politics and diplomacy, live from the floor', lines: [
            'Gavel to gavel from the floor of the Galactic Council.',
            'Every vote, every walkout, every motion tabled until nobody remembers it.',
        ], tag: 'Council Summit Floor. Diplomacy, live and unedited.' },
        { show: 'The Evening Rim Report', covers: 'the day’s top stories, told properly', logo: 'evening_rim_report.png', lines: [
            'The day across the sector, told properly, at the hour you can listen.',
            'When the rim goes dark, the Evening Rim Report goes on.',
        ], tag: 'The Evening Rim Report. The day, in full.' },
        { show: 'Anomaly: Deep Dark', covers: 'the oddities and mysteries on the wire', logo: 'anomaly_late_night.png', lines: [
            'Signals with no source. Ships with no crew. Questions with no answer yet.',
            'After midnight, the reports nobody else will read on air.',
        ], tag: 'Anomaly: Deep Dark. Keep the lights on.' },
        { show: 'Imperial Historical Wire', covers: 'the history of the sector, from the archive', lines: [
            'The wars, treaties and catastrophes that made the sector what it is.',
            'From the founding colonies to the last great war, the archive opens.',
        ], tag: 'Imperial Historical Wire. Nothing is ever really over.' },
    ];
    const PSAS = [
        { brand: 'GALACTIC COUNCIL', product: 'Public Notice',
          hook: 'A message from the Galactic Council.',
          body: 'Unlicensed hyperspace jumps endanger every vessel in the lane.',
          tag: 'File your flight plan. It is the law, and it is how we find you.' },
        { brand: 'GALACTIC COUNCIL', product: 'Public Notice',
          hook: 'A message from the Office of Colonial Health.',
          body: 'Quarantine protocols exist because the last colony to ignore them is not there any more.',
          tag: 'If you are told to stay in the dome, stay in the dome.' },
        { brand: 'GALACTIC COUNCIL', product: 'Public Notice',
          hook: 'A message from the Navigation Bureau.',
          body: 'Beacon tampering is a capital offence in twelve systems and a very long walk in the rest.',
          tag: 'Leave the buoys alone. Someone is counting on them.' },
        { brand: 'GALACTIC COUNCIL', product: 'Public Notice',
          hook: 'A message from the Office of Atmospheric Standards.',
          body: 'Check your seals every cycle. Air is not something you notice until it is gone.',
          tag: 'Seal it. Test it. Breathe easy.' },
        { brand: 'GALACTIC COUNCIL', product: 'Public Notice',
          hook: 'A reminder from the Trans-Sector Census.',
          body: 'Every colony counts, and every colony is counted. Return your forms before the next jump window.',
          tag: 'Be counted. It is how the Council knows you are there.' },
        { brand: 'GALACTIC COUNCIL', product: 'Public Notice',
          hook: 'A message from the Bureau of Salvage.',
          body: 'A drifting hull is somebody’s property, somebody’s grave, or both.',
          tag: 'Report derelicts. Do not board them.' },
    ];

    /** A network promo or a public-service notice. */
    function promo() {
        if (chance(0.3)) {
            const p = pickFrom(PSAS, PSAS[0]);
            return {
                kind: 'promo', isPSA: true,
                brand: p.brand, product: p.product,
                // The Council chamber, for every public notice.
                stage: ['assets/generated/infomercials/council_notice_chamber.png'],
                beats: [
                    { kind: 'hook', text: p.hook },
                    { kind: 'body', text: p.body },
                    { kind: 'tag', text: p.tag },
                ],
            };
        }
        const sp = pickFrom(SHOW_PROMOS, SHOW_PROMOS[0]);
        // The show itself, from show-config.json: its title card and the
        // two anchors who present it. A promo used to air random archive
        // footage and name nobody (owner).
        const cfg = showByTitle(sp.show);
        const names = (cfg && Array.isArray(cfg.pair) && typeof GNNCast !== 'undefined')
            ? cfg.pair.map((id) => GNNCast.get(id)).filter(Boolean).map((p) => p.name) : [];
        const join = names.length === 2
            ? `Join ${names[0]} and ${names[1]} on ${sp.show}, for ${sp.covers || 'the news'}.`
            : `${sp.show}: ${sp.covers || 'the news, every cycle'}.`;
        const titlecard = cfg && cfg.titlecard
            ? 'assets/generated/titlecards/' + cfg.titlecard : null;
        return {
            kind: 'promo',
            brand: 'GALACTIC NEWS NETWORK',
            product: sp.show,
            titlecard,
            // The card already carries the show's name; a logo over it is
            // the title twice.
            logo: titlecard ? null : (sp.logo || null),
            beats: [
                { kind: 'hook', text: pickFrom(sp.lines, sp.lines[0]) },
                { kind: 'body', text: join },
                { kind: 'tag', text: sp.tag + ' Only on G N N.' },
            ],
        };
    }

    // Shows as configured (main.js passes show-config.json's list).
    let SHOW_CFG = [];
    function setShows(list) { SHOW_CFG = Array.isArray(list) ? list : []; }
    const titleKey = (t) => String(t || '').toLowerCase().replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, ' ').trim();
    function showByTitle(title) {
        const k = titleKey(title);
        return SHOW_CFG.find((x) => titleKey(x.title) === k) || null;
    }

    /**
     * GNN Galaxy Shop — Late-night spoof QVC / Home Shopping Network script.
     * Features high-energy sales pitches, item prices, unit countdowns, and phone hotlines.
     */
    // The Imperial Research Exchange: technology sold as a shop item, paid
    // for in research points. Every picture comes from the MoO1 TECHNO
    // archive — the research lab console, with one of its forty blueprint
    // schematics on the monitor. `item` is the TECHNO item number; each name
    // was written by looking at that schematic, so the voice names what the
    // screen shows. Lore-side, like every commercial.
    const RESEARCH_ITEMS = [
        [8, 'Mark Two Scout Hull', 'a lightweight hull for long-range survey work'],
        [9, 'Battle Computer, Mark Three', 'a targeting computer that thinks faster than the enemy can dodge'],
        [10, 'Automated Factory Module', 'a factory that runs itself through the night shift'],
        [11, 'Planetary Shield Generator', 'a grid of force that wraps an entire world'],
        [12, 'Domed City Habitat', 'a pressurised city for worlds that would rather you did not live on them'],
        [13, 'Interceptor Hull', 'a narrow, fast hull built to arrive first'],
        [14, 'Frigate Hull Refit', 'a frigate frame with room for the weapons you have been meaning to buy'],
        [15, 'Twin-Boom Destroyer Hull', 'a destroyer frame with twice the engine and twice the nerve'],
        [16, 'Hyper-Drive Engine Assembly', 'a drive that folds the long dark down to a weekend'],
        [17, 'Guided Missile Rack', 'a missile that remembers where you told it to go'],
        [18, 'Deep Space Scanner', 'a dish that hears a fleet coming three systems away'],
        [19, 'Class Two Deflector Shield', 'a field that turns a direct hit into a near miss'],
        [20, 'Inertial Stabiliser Field', 'a field that keeps your crew where they were standing'],
        [21, 'Robotic Control Unit', 'a control rig that lets one engineer do the work of nine'],
        [22, 'Prefabricated Colony Base', 'a colony in a crate, assembled on landing'],
        [23, 'Advanced Biology Formula', 'the molecular work behind tougher, healthier colonists'],
        [24, 'Classified Prototype', 'a device we are not permitted to describe'],
        [25, 'Soil Enrichment Kit', 'everything a barren world needs to start growing things'],
        [26, 'Stealth Hull Plating', 'plating that scanners slide right off'],
        [27, 'Navigational Star Charts', 'routes through the sector that the other empires do not have'],
        [28, 'Fusion Fuel Canister', 'a canister that keeps a ship running months past its range'],
        [29, 'Reserve Fuel Tanks', 'extra range for fleets that do not like to turn back'],
        [30, 'Ion Cannon', 'a long-barrelled cannon that strips shields like paint'],
        [31, 'Long-Range Sensor Saucer', 'a sensor array that sees around corners in space'],
        [32, 'Heavy Laser Barrel', 'a heavy laser for captains who prefer to settle things early'],
        [33, 'Mass Driver Rounds', 'solid rounds for when the subtle approach has failed'],
        [34, 'Tractor Beam Emitter', 'a beam that brings the enemy closer whether they like it or not'],
        [35, 'Particle Beam Projector', 'a beam weapon with a remarkably short argument'],
        [36, 'Plasma Cannon', 'the cannon other cannons are afraid of'],
        [37, 'Anti-Matter Bomb', 'the last word in planetary diplomacy'],
        [38, 'Hyper-Space Communications Array', 'a dish that talks to your fleet faster than light'],
        [39, 'Dimensional Portal Frame', 'a doorway to somewhere that is not here'],
        [40, 'Combat Android', 'a soldier that does not sleep, eat or ask about leave'],
        [41, 'Personal Laser Rifle', 'standard issue for marines who expect resistance'],
        [42, 'Powered Armour Suit', 'armour that makes a marine into a small tank'],
        [43, 'Hand Phaser', 'a sidearm small enough to forget you are carrying'],
        [44, 'Personal Shield Harness', 'a shield you wear, for boarding actions that go badly'],
        [45, 'Cloning Vats', 'a population boom, grown to order'],
        [46, 'Planetary Barrier Shield', 'a dome of force that turns away orbital bombardment'],
        [47, 'Genetic Engineering Formula', 'the science of a better colonist, one gene at a time'],
    ];

    function researchExchange() {
        const [item, name, what] = pickFrom(RESEARCH_ITEMS, RESEARCH_ITEMS[0]);
        const rp = (1 + ((Math.random() * 48) | 0)) * 250;
        const rpText = rp.toLocaleString('en-US');
        const left = 2 + ((Math.random() * 11) | 0);
        return {
            kind: 'qvc',
            isQVC: true,
            isResearch: true,
            brand: 'IMPERIAL RESEARCH EXCHANGE',
            product: name,
            schematic: 'TECHNO/item_' + String(item).padStart(2, '0'),
            price: rpText + ' RP',
            stock: left + ' BLUEPRINTS LEFT',
            phone: '1-800-TECH-NOW',
            beats: [
                { kind: 'hook', text: pickFrom([
                    'Tired of waiting decades for your scientists to finish?',
                    'Why research it yourself when someone else already has?',
                    'Your labs are slow. Your rivals are not.',
                    'Skip the long years of trial and error. Buy the breakthrough.',
                    'The Imperial Research Exchange is open, and the blueprints are moving fast.',
                ], '') },
                { kind: 'body', text: 'Tonight only, the ' + name + ': ' + what + '.' },
                { kind: 'claim', text: pickFrom([
                    'Full blueprint, tested specifications, and installation notes for your engineers.',
                    'Recovered from the archives of a fallen empire. They will not be needing it.',
                    'Saves your laboratories an estimated ' + (5 + ((Math.random() * 40) | 0)) + ' years of research.',
                    'Already in service with fleets who were smart enough to buy early.',
                ], '') },
                { kind: 'tag', text: 'Just ' + rpText + ' research points. Only '
                    + left + ' blueprints left. Call now.' },
                { kind: 'legal', text: pickFrom([
                    'Research points are non-refundable. Blueprints may already be obsolete on arrival.',
                    'The Exchange accepts no liability for technology used against the purchaser.',
                    'Installation requires a functioning laboratory and a cooperative engineer.',
                    'Some assembly required. Some physics may be required as well.',
                ], '') },
            ],
        };
    }

    // The Orion Salvage Auction: the 212 applied-research pictures from
    // MoO2's APP_PICS, sold as numbered lots on the shop pedestal. Grouped
    // by eye from a contact sheet; every item not listed here (modules,
    // pods, engines — most of the archive) is `equipment`. 00 (a wireframe
    // grid) and 03 (a blank panel) are not lots.
    const SALVAGE_GROUPS = {
        weapon: [100, 101, 104, 105, 115, 123, 128, 138, 140, 145, 148, 171, 54, 63, 70, 73, 78, 79, 80, 95, 96, 97, 47],
        missile: [106, 119, 12, 121, 13, 139, 146, 149, 71, 202, 10, 118, 46, 59, 85, 88],
        building: [5, 103, 125, 126, 127, 129, 130, 131, 132, 133, 134, 135, 136, 141, 142, 152, 154, 155, 156, 163, 164, 174, 178, 18, 197, 198, 21, 22, 30, 32, 39, 40, 49, 50, 61, 67, 68, 74, 75, 76, 86, 87],
        craft: [113, 137, 17, 167, 31, 66, 83, 69, 109, 189, 41, 20],
        trooper: [4, 6, 7, 8, 144, 173, 24, 124],
        device: [1, 2, 9, 110, 122, 143, 151, 158, 159, 44, 58],
        bio: [107, 108, 162, 29, 28, 62, 84],
        medal: [204, 205, 206, 207, 208, 209, 210, 211, 65, 77, 193, 42],
    };
    const SALVAGE_COPY = {
        weapon: ['a salvaged weapon system, still warm', 'a decommissioned naval gun with a fresh coat of paint', 'heavy ordnance from a fleet that no longer needs it'],
        missile: ['a live warhead, sold as a decorative piece', 'a missile casing recovered from a battlefield', 'ordnance from a disarmament treaty nobody enforced'],
        building: ['a complete colony installation, packed for transport', 'a prefabricated planetary facility, foundations not included', 'a surplus colonial building from a world that changed hands'],
        craft: ['a light craft with very few previous owners', 'a small vessel recovered intact from a derelict carrier', 'a runabout, as seen in several famous retreats'],
        trooper: ['a suit of battle armour, recently vacated', 'a combat automaton, memory wiped, mostly', 'trooper equipment from a garrison that surrendered early'],
        device: ['a piece of laboratory equipment of uncertain purpose', 'a control console from a decommissioned research station', 'an instrument our appraisers could not identify'],
        bio: ['a biological specimen, sealed, and we are told stable', 'a sample from an expedition that did not come back', 'a living curiosity, feeding instructions included'],
        medal: ['a decoration from an empire that no longer exists', 'a ceremonial emblem, provenance disputed', 'a medal awarded for a victory both sides claim'],
        equipment: ['a component salvaged from a capital ship', 'a ship module, removed by careful hands and a cutting torch', 'a piece of starship equipment, fully functional on arrival'],
    };

    function orionSalvage() {
        const skip = new Set([0, 3]);
        const grouped = new Map();
        for (const [g, ids] of Object.entries(SALVAGE_GROUPS)) ids.forEach((i) => grouped.set(i, g));
        let item;
        do { item = (Math.random() * 212) | 0; } while (skip.has(item));
        const group = grouped.get(item) || 'equipment';
        const lot = 100 + item * 7 + ((Math.random() * 7) | 0);
        const bid = (2 + ((Math.random() * 90) | 0)) * 50;
        const what = pickFrom(SALVAGE_COPY[group], SALVAGE_COPY.equipment[0]);
        return {
            kind: 'qvc',
            isQVC: true,
            brand: 'ORION SALVAGE AUCTION',
            product: 'Lot ' + lot,
            productImage: 'assets/cutscenes/moo2/APP_PICS/item_' + String(item).padStart(2, '0') + '_frame_000.png',
            stage: ['assets/generated/infomercials/galaxy_shop_pedestal.png'],
            price: 'BID ' + bid.toLocaleString('en-US') + ' CR',
            stock: 'CLOSING SOON',
            phone: '1-800-BID-LOTS',
            beats: [
                { kind: 'hook', text: pickFrom([
                    'The Orion Salvage Auction is live, and the lots are moving.',
                    'Wrecks, relics and things nobody could explain. Bidding is open.',
                    'Every fallen empire leaves something behind. We sell it.',
                ], '') },
                { kind: 'body', text: 'Lot ' + lot + ': ' + what + '.' },
                { kind: 'claim', text: pickFrom([
                    'Recovered under salvage law and inspected by our appraisers.',
                    'Sold as seen. What you see is what was left.',
                    'One of a kind. The other one exploded.',
                    'Provenance on request. Some of it is even true.',
                ], '') },
                { kind: 'tag', text: 'Current bid, ' + bid.toLocaleString('en-US') + ' credits. Call now before the hammer falls.' },
                { kind: 'legal', text: pickFrom([
                    'All lots sold as is. The auction house is not responsible for anything that was alive.',
                    'Buyer collects. Some lots require a gravity well to store.',
                    'Bids are binding in eleven systems and enforceable in four.',
                ], '') },
            ],
        };
    }

    // Pre-owned starships. Every shot draws a different hull from the
    // archive's ship sprites — both games, about 570 of them — onto the
    // shipyard showroom pad, so a spot is a walk along the lot.
    function shipDealer() {
        const classes = (typeof GNNAssets !== 'undefined' && GNNAssets.vocab('shipclasses').length)
            ? GNNAssets.vocab('shipclasses') : ['Falcon', 'Corsair', 'Pathfinder', 'Warden'];
        const race = pickFrom((typeof GNNAssets !== 'undefined' && GNNAssets.vocab('races')) || [], 'Meklar');
        const hull = pickFrom(['Frigate', 'Destroyer', 'Cruiser', 'Freighter', 'Scout', 'Battleship', 'Courier'], 'Frigate');
        const name = race + ' ' + pickFrom(classes, 'Falcon') + '-class ' + hull;
        const price = (5 + ((Math.random() * 200) | 0)) * 1000;
        return {
            kind: 'qvc',
            isQVC: true,
            isShipyard: true,
            brand: "HONEST GNOLAM'S STARSHIPS",
            product: name,
            stage: ['assets/generated/infomercials/shipyard_showroom.png'],
            price: price.toLocaleString('en-US') + ' CR',
            stock: pickFrom(['ONE OWNER', 'LOW LIGHT-YEARS', 'NEEDS HULL WORK', 'NO QUESTIONS ASKED'], 'ONE OWNER'),
            phone: '1-800-GNO-LAMS',
            beats: [
                { kind: 'hook', text: pickFrom([
                    'Come on down to Honest Gnolam\u2019s, where every ship has a story and most of them are true!',
                    'Prices so low, the previous owners are still filing complaints!',
                    'Why buy new when the war has left so many perfectly good hulls?',
                ], '') },
                { kind: 'body', text: 'Take a look at this ' + name + '. Barely scorched.' },
                { kind: 'claim', text: pickFrom([
                    'Or this one! Shields work, mostly, and the reactor has only been replaced twice.',
                    'Or how about this beauty! Previous owner was a retired admiral. Retired very suddenly.',
                    'And this one comes with a full tank of fuel and a crew that has not been told yet.',
                ], '') },
                { kind: 'tag', text: 'Just ' + price.toLocaleString('en-US') + ' credits. Honest Gnolam\u2019s. Fly it off the lot today.' },
                { kind: 'legal', text: pickFrom([
                    'Ships sold as is. Weapons may not be legal in your system. Previous owners may want them back.',
                    'Registration and docking fees extra. Hull breaches are cosmetic until they are not.',
                ], '') },
            ],
        };
    }

    // Recruitment, over the ground war (COLGCBT troops on a MoO2 planet
    // surface). In-universe, like every commercial.
    function marines() {
        return {
            kind: 'commercial',
            groundWar: true,
            // Always moving footage around the battle: a random stage
            // plate (an ocean villa, a law office) would not suit it.
            look: 'footage',
            brand: 'COLONIAL MARINE CORPS',
            product: 'Enlist Today',
            beats: [
                { kind: 'hook', text: pickFrom([
                    'Somebody has to hold the ground after the fleet moves on.',
                    'The fleet takes the orbit. The Marines take the planet.',
                    'Looking for a career with a view? Several views. Most of them hostile.',
                ], '') },
                { kind: 'body', text: pickFrom([
                    'The Colonial Marine Corps. Boots on worlds nobody else will land on.',
                    'Training on twelve gravities, three atmospheres and one very patient sergeant.',
                    'Armour, transport and a rifle that has never once asked why.',
                ], '') },
                { kind: 'claim', text: pickFrom([
                    'Full pension after twenty years, or after one very brave afternoon.',
                    'Travel, adventure, and meals that are technically food.',
                    'Ninety percent of recruits return home. We are working on the other ten.',
                ], '') },
                { kind: 'tag', text: 'The Colonial Marine Corps. Hold the line.' },
                { kind: 'legal', text: 'Service terms are binding across all occupied systems. Planets not included.' },
            ],
        };
    }

    function galaxyShop() {
        const PRODUCTS = [
            {
                brand: 'GNN GALAXY SHOP',
                product: 'Klackon Queen Amber Brooch',
                price: '399 CREDITS',
                stock: '14 UNITS LEFT',
                hook: 'Calling all Terran mineral collectors and jewel connoisseurs!',
                body: 'Direct from the subterranean hive depths of Kholdan: authentic Klackon queen amber.',
                claim: 'Mined under high-pressure hive chambers. Guaranteed zero resin impurities.',
                tag: 'Only 399 Galactic Credits! Operators are standing by in orbit.',
                legal: 'GNN Galaxy Shop is not liable for spontaneous amber resonance or hive claims.',
            },
            {
                brand: 'ORION SURPLUS OUTLET',
                product: 'Class-3 Tachyon Deflector Coil',
                price: '899 CREDITS',
                stock: '7 IN STOCK',
                hook: 'Is your civilian star-skiff prepared for micro-meteorite storms?',
                body: 'Introducing the refurbished Class-3 Tachyon Deflector Coil.',
                claim: 'Guaranteed to deflect hyper-velocity micro-debris or full credit reimbursement.',
                tag: 'Call 1-800-RIM-DEAL now! Fits standard civilian hulls with no drydock refit.',
                legal: 'Void where prohibited by treaty. Deflection field efficacy depends on local gravity well.',
            },
            {
                brand: 'CRYSTAL DERMA LABS',
                product: 'Silicoid Crystalline Exfoliating Balm',
                price: '149 CREDITS',
                stock: '23 FLASKS LEFT',
                hook: 'Tired of harsh planetary atmospheric weathering on your skin?',
                body: 'Silicoid Crystalline Balm: the premier dermal treatment from the magma shelf.',
                claim: 'Hardens humanoid dermal tissue to basalt-grade durability in just three cycles.',
                tag: 'Order today and receive a complimentary quartz buffing sponge!',
                legal: 'May cause irreversible epidermal mineralization in non-lithoid humanoids.',
            },
            {
                brand: 'AVIAN REGALIA GALAXY',
                product: 'Alkari Feather-Gloss & Preen Serum',
                price: '79 CREDITS',
                stock: '42 FLASKS LEFT',
                hook: 'Essential plumage grooming for the modern high-ranking diplomat.',
                body: 'Alkari Feather-Gloss Serum eliminates ionizing warp static and restores feather sheen.',
                claim: 'Certified by the Altair Diplomatic Academy for ceremonial presentations.',
                tag: 'Dial 1-800-RIM-DEAL. Look your absolute best at your next Council summit.',
                legal: 'Do not ingest. Highly flammable near exposed plasma manifolds.',
            },
            {
                brand: 'FIERAS TACTICAL',
                product: 'Mrrshan Velocity Hunting Optics',
                price: '649 CREDITS',
                stock: '11 SETS LEFT',
                hook: 'Never lose visual track of hyper-speed targets again.',
                body: 'Military-spec thermal and infrared tracking visors from the pride workshops of Fieras.',
                claim: 'Microsecond target lock across all standard atmospheric gas densities.',
                tag: 'Available exclusively through GNN Galaxy Shop. Claim yours before stock depletes.',
                legal: 'Export restricted in demilitarized neutral zones under Council Edict 44.',
            },
            {
                brand: 'ORION HOROLOGY',
                product: 'Orion Executive Chrono-Timepiece',
                price: '2,400 CREDITS',
                stock: '9 UNITS LEFT',
                hook: 'Own a piece of history. And tell the time on it.',
                body: 'The Orion Executive Chrono-Timepiece, hand-assembled in the mountain workshops of Sirius Prime.',
                claim: 'Holographic readout dial. Titanium case. Sapphire crystal. Rated to one million cycles.',
                tag: 'Available in a limited series of four hundred. Claim yours before the series closes.',
                legal: 'Battery life varies by local gravity. Warranty void if submerged below 400 atmospheres.',
            },
            {
                brand: 'SIRIUS LEISURE CRAFT',
                product: 'Celeste-Class Personal Yacht',
                price: '94,000 CREDITS',
                stock: '3 HULLS AVAILABLE',
                hook: 'The stars are wide. Your time is not.',
                body: 'The Celeste-Class personal yacht, from the leisure yards of Sirius Prime.',
                claim: 'Observation dome, teak-effect aft deck, and a thousand-light-year cruising range on a single core.',
                tag: 'Financing available to qualified purchasers through the Orion Merchant Bank.',
                legal: 'Range dependent on load, route and pilot. Cruising range measured under ideal vacuum conditions.',
            },
            {
                brand: 'SIRIUS POWER SYSTEMS',
                product: 'Tachyon Standard Energy Cell',
                price: '89 CREDITS',
                stock: '214 CELLS LEFT',
                hook: 'One cell. Every appliance on your ship.',
                body: 'The Tachyon Standard Energy Cell, now rated for the deep vacuum of a Class-2 hull.',
                claim: 'Twelve thousand cycles. Negative thermal drift. Compatible with all standard pin configurations.',
                tag: 'Buy the twelve-cell contractor pack and save thirty percent.',
                legal: 'Do not short across terminals. Do not expose to open plasma. Cell contents under pressure.',
            },
            {
                brand: 'ORION HOROLOGY',
                product: 'Chronowatch Navigator Edition',
                price: '1,650 CREDITS',
                stock: '6 UNITS LEFT',
                hook: 'For the pilot who still knows the time.',
                body: 'The Navigator Edition Chronowatch — for orbital approach and surface landing alike.',
                claim: 'Dual-time planetary standard. Holographic overlay dial. Submersible to two hundred fathoms.',
                tag: 'Limited production run. Numbered engraving on the case back.',
                legal: 'Holographic projection requires a recharge cycle every sixty planetary days.',
            },
            {
                brand: 'GNN GALAXY SHOP',
                product: 'Bulrathi Heirloom Grooming Comb',
                price: '219 CREDITS',
                stock: '31 UNITS LEFT',
                hook: 'For the mane that has seen three campaigns and refuses to lie flat.',
                body: 'Hand-forged on Ursa from tempered hull alloy, with tines spaced for the thickest Bulrathi coat.',
                claim: 'Detangles a full ceremonial mane in under four minutes. Will not bend. Has been tested.',
                tag: 'Only 219 credits, with a lifetime sharpening service included.',
                legal: 'Not suitable for species with fewer than one hundred hairs per square centimetre.',
            },
            {
                brand: 'MEKLAR SURPLUS DIRECT',
                product: 'Refurbished Meklar Servo-Arm',
                price: '1,180 CREDITS',
                stock: '8 ARMS LEFT',
                hook: 'Need a third hand around the ship? Or a fourth?',
                body: 'A genuine Meklar factory servo-arm, refurbished and re-tasked for civilian maintenance work.',
                claim: 'Lifts four times its own mass. Holds a torch steady through a hull vibration. Never gets bored.',
                tag: 'Clamp it to any bulkhead. Operators are standing by in orbit.',
                legal: 'Original Meklar programming has been removed. Mostly. Report any unprompted assembly.',
            },
            {
                brand: 'SAKKRA HEARTH WARES',
                product: 'Sakkra Heated Basking Stone',
                price: '129 CREDITS',
                stock: '45 STONES LEFT',
                hook: 'Ship decks are cold. Your scales should not be.',
                body: 'Quarried from the volcanic plains of Sssla and fitted with a slow-release thermal core.',
                claim: 'Holds a perfect basking temperature for a full sleep cycle. Silent. Odourless. Comforting.',
                tag: 'Order two and get a third for the egg chamber, free.',
                legal: 'Do not place directly on fuel lines, cargo manifests or mammals.',
            },
            {
                brand: 'PSILON PRECISION INSTRUMENTS',
                product: 'Psilon Pocket Probability Engine',
                price: '549 CREDITS',
                stock: '19 UNITS LEFT',
                hook: 'Should you take the Rigel run tonight? There is an engine for that.',
                body: 'A palm-sized Psilon calculator that weighs every outcome before you have finished asking.',
                claim: 'Correct to six decimal places on a good day. Correct-sounding on every other day.',
                tag: 'Make every decision with confidence. Even the wrong ones.',
                legal: 'Probabilities are advisory. Psilon Precision Instruments is not responsible for outcomes, only for odds.',
            },
            {
                brand: 'DARLOK DISCREET GOODS',
                product: 'Darlok Shadow-Weave Cloak',
                price: '760 CREDITS',
                stock: 'STOCK LEVEL CLASSIFIED',
                hook: 'Some evenings you would simply rather not be noticed.',
                body: 'The Shadow-Weave Cloak, woven on Nazin from a fibre that drinks the light around it.',
                claim: 'Reduces your visual profile by up to eighty percent in standard station lighting.',
                tag: 'Shipped in an unmarked crate, to an address we will not repeat.',
                legal: 'Not for use during customs inspections, Council sessions or your own wedding.',
            },
            {
                brand: 'GNN GALAXY SHOP',
                product: 'Alkari Sky-Glass Wind Chimes',
                price: '95 CREDITS',
                stock: '52 SETS LEFT',
                hook: 'Bring the open sky of Altair home to a cabin with no window.',
                body: 'Blown from the singing glass of the Altair highlands, tuned by Alkari artisans by ear.',
                claim: 'Each chime is cut to resonate in the ventilation draught of a standard crew deck.',
                tag: 'Peace and quiet, for ninety-five credits, delivered to your docking bay.',
                legal: 'May trigger nostalgia in Alkari crew members. GNN Galaxy Shop accepts no liability for poetry.',
            },
            {
                brand: 'HELIOPAUSE OUTFITTERS',
                product: 'Thermal Survival Envelope',
                price: '179 CREDITS',
                stock: '64 UNITS LEFT',
                hook: 'Life pods are cramped, cold and in no hurry to be found.',
                body: 'The Thermal Survival Envelope folds to the size of a ration bar and keeps you warm for ten days.',
                claim: 'Rated to minus two hundred. Reflective to search beacons. Comfortable enough to sleep in. Just.',
                tag: 'One in every locker. Because rescue takes as long as it takes.',
                legal: 'Not a substitute for a functioning life pod, rescue crew or a better choice of captain.',
            },
            {
                brand: 'GNN GALAXY SHOP',
                product: 'Silicoid Geode Desk Companion',
                price: '310 CREDITS',
                stock: '12 GEODES LEFT',
                hook: 'It does not talk. It does not judge. It grows a quarter-centimetre a year.',
                body: 'A living Silicoid juvenile geode from Cryslon, certified docile, and dazzling under cabin light.',
                claim: 'Needs no food, no water and no attention. Outlives every other houseplant you have owned.',
                tag: 'A friend for the next four hundred years, for three hundred and ten credits.',
                legal: 'Geode may attempt to communicate after the first century. This is normal.',
            },
            {
                brand: 'KLACKON HIVEWORKS EXPORT',
                product: 'Klackon Hive-Built Storage Lattice',
                price: '449 CREDITS',
                stock: '23 LATTICES LEFT',
                hook: 'Cargo hold chaos? The hive has solved this problem for a million years.',
                body: 'A modular hexagonal storage lattice, assembled by Klackon workers on Kholdan to a single standard.',
                claim: 'Fits any bulkhead. Holds four times the cargo of a standard rack. Self-levels in zero gravity.',
                tag: 'Order now and the hive will include a second lattice. The hive insists.',
                legal: 'Klackon Hiveworks does not process refunds. The concept is not recognised.',
            },
            {
                brand: 'ORION SURPLUS OUTLET',
                product: 'Decommissioned Navigation Computer',
                price: '1,450 CREDITS',
                stock: '5 UNITS LEFT',
                hook: 'Retired from a frontier patrol cruiser. Still knows every jump lane by heart.',
                body: 'A full military-grade navigation core, stripped of classified routes and fitted for civilian hulls.',
                claim: 'Plots a nine-jump course in under a second. Remembers every buoy it has ever passed.',
                tag: 'Call 1-800-RIM-DEAL before the patrol fleet changes its mind.',
                legal: 'Unit may occasionally suggest hostile engagement. Decline the suggestion.',
            },
            {
                brand: 'MRRSHAN PRIDE ATELIER',
                product: 'Mrrshan Ceremonial Claw Sheaths',
                price: '385 CREDITS',
                stock: '17 SETS LEFT',
                hook: 'Elegance at court. Readiness everywhere else.',
                body: 'Gilt claw sheaths in the style of the Fieras royal court, each set fitted by hand.',
                claim: 'Polished to a mirror finish. Removable in a single motion, which matters more than you would think.',
                tag: 'Worn by three of the last four Mrrshan ambassadors. The fourth was not invited back.',
                legal: 'Sheaths are decorative. Claws remain fully functional and are the owner’s responsibility.',
            },
            {
                brand: 'GNN GALAXY SHOP',
                product: 'GNN Anniversary Commemorative Beacon',
                price: '59 CREDITS',
                stock: '200 BEACONS LEFT',
                hook: 'Celebrate a century of broadcasting across the beacon net.',
                body: 'A working miniature relay beacon, finished in GNN colours, that picks up the station on any deck.',
                claim: 'Receives the Galactic News Network anywhere within a light-year of a working relay.',
                tag: 'Fifty-nine credits. Stay on this frequency.',
                legal: 'Reception depends on the relay network, which depends on the Council, which depends on you.',
            },
        ];
        const item = pickFrom(PRODUCTS, PRODUCTS[0]);
        return {
            kind: 'qvc',
            isQVC: true,
            brand: item.brand,
            product: item.product,
            price: item.price,
            stock: item.stock,
            phone: '1-800-RIM-DEAL',
            beats: [
                { kind: 'hook', text: item.hook },
                { kind: 'body', text: item.body },
                { kind: 'claim', text: item.claim },
                { kind: 'tag', text: item.tag },
                { kind: 'legal', text: item.legal },
            ],
        };
    }

    /**
     * Overnight Paid Programming & Shady Infomercials script.
     * Features class-action legal syndicates, frontier bio-domes, and cognitive tonics.
     */
    function infomercial() {
        const SHOWS = [
            {
                brand: 'VEX & SAKKRA ATTORNEYS',
                product: 'Zortrium Exposure Class Action',
                testimonial: 'radiation_claimant.png',
                phone: '1-888-VEX-SAKKRA',
                hook: 'Have you or a loved one been exposed to unshielded Zortrium radiation?',
                body: 'Starfarers and dockworkers stationed at Orion Heavy Industries yards may have suffered chronic cellular decay.',
                claim: 'You may be entitled to substantial imperial credits under the Trans-Sector Settlement Accord.',
                tag: 'Call the Law Offices of Vex and Sakkra today. We do not rest until justice is served.',
                legal: 'Prior imperial settlements do not guarantee identical outcomes in provincial tribunals.',
            },
            {
                brand: 'COLONIAL REAL ESTATE CORP',
                product: 'Antares IV Bio-Dome Crater Estates',
                phone: '1-800-BIO-DOME',
                hook: 'Tired of cramped orbital modules and recycled station air?',
                body: 'Claim your private luxury bio-dome crater on the newly terraformed rim world of Antares IV.',
                claim: 'Zero down payment for certified fleet veterans with panoramic views of the binary sunset.',
                tag: 'Inquire today with Colonial Real Estate. Your frontier sanctuary awaits.',
                legal: 'Atmospheric scrubbers sold separately. Habitation subject to imperial territorial re-zoning.',
            },
            {
                brand: 'DR. OTH LABORATORIES',
                product: 'Psilon Synaptic Neuro-Elixir',
                testimonial: 'psilon_scientist.png',
                phone: '1-877-NEURO-IQ',
                hook: 'Struggling with quantum calculation fatigue and telepathic fog?',
                body: 'Dr. Oth\'s Synaptic Neuro-Elixir is distilled from pure Mentar cognitive crystal extract.',
                claim: 'Clinically shown to sharpen subspace computation and harden thoughts against Darlok probes.',
                tag: 'Order the thirty-cycle supply now and elevate your mental capabilities.',
                legal: 'Not evaluated by the Galactic Medical Registry. May cause temporary chromatic aura vision.',
            },
            {
                brand: 'COLONIAL FREIGHT GUILD',
                product: 'Long-Haul Certification Programme',
                testimonial: 'happy_trucker.png',
                phone: '1-800-HAUL-LONG',
                hook: 'Are you getting paid what you are worth on the Antares run?',
                body: 'The Colonial Freight Guild is now accepting drivers for the deep-lane certification.',
                claim: 'Guild-certified drivers earn on average forty percent more per standard cycle on the same routes.',
                tag: 'Call 1-800-HAUL-LONG. Operators are standing by in every major shipping hub.',
                legal: 'Earnings vary by route, cargo class, seniority and local tariff schedules. Not a guarantee of income.',
            },
            {
                brand: 'SIRIUS EXECUTIVE SERVICES',
                product: 'Executive Presence Masterclass',
                testimonial: 'corporate_executive.png',
                phone: '1-877-PRESENCE',
                hook: 'Are you the smartest voice in the room nobody remembers?',
                body: 'The Sirius Executive Presence Masterclass teaches command-bearing posture, decisive language and quiet authority.',
                claim: 'Ninety-three percent of graduates reported a promotion within one standard year of completing the programme.',
                tag: 'Call 1-877-PRESENCE. Courses begin the first cycle of every quarter.',
                legal: 'Testimonials are individual results and not typical. Prior performance does not guarantee future outcomes.',
            },
            {
                brand: 'TRANS-SECTOR REPAIR SERVICES',
                product: 'At-Home Hull Patch Kit',
                testimonial: 'alien_mechanic.png',
                phone: '1-888-FIX-HULL',
                hook: 'Micro-meteorite breach at 04:00 and no drydock within six hours?',
                body: 'The Trans-Sector At-Home Hull Patch Kit lets a single crew member seal a standard hull breach in under ninety seconds.',
                claim: 'Certified for pressure ratings up to four atmospheres. Suitable for all standard civilian hulls.',
                tag: 'Call 1-888-FIX-HULL. Every kit ships with three patch units and a pressure gauge.',
                legal: 'Not rated for military hulls or pressurised cargo sections. Sealing a hull does not substitute for a proper drydock inspection.',
            },
            {
                brand: 'THE ORION DEBT RELIEF BUREAU',
                product: 'Interstellar Debt Consolidation',
                phone: '1-888-NO-DEBT',
                hook: 'Owing credits in four systems at four different interest rates?',
                body: 'The Orion Debt Relief Bureau rolls every outstanding loan into one easy cycle payment.',
                claim: 'Clients reduced their monthly obligations by an average of thirty-eight percent.',
                tag: 'Call 1-888-NO-DEBT. One payment. One lender. One less thing to run from.',
                legal: 'Total repayment may exceed original debt. Consolidated debts are not forgiven, merely gathered.',
            },
            {
                brand: 'FIRST COLONIAL ASSURANCE',
                product: 'Final Expense Life Cover for Spacers',
                phone: '1-877-SPACER',
                hook: 'Nobody plans to be lost between stars. But somebody has to pay for the memorial beacon.',
                body: 'First Colonial offers guaranteed life cover for spacers aged eighteen to four hundred.',
                claim: 'No medical exam. No questions about your last three jumps. Acceptance is guaranteed.',
                tag: 'Call 1-877-SPACER and protect the people you leave on the dock.',
                legal: 'Benefits reduced in the first two cycles. Excludes deaths from known hazards, which is most of them.',
            },
            {
                brand: 'GNOLAM GOLD EXCHANGE',
                product: 'Precious Metals Buy-Back Programme',
                phone: '1-800-GNOLAM',
                hook: 'Is there old jewellery, spare wiring or a broken reactor shield gathering dust in your hold?',
                body: 'The Gnolam Gold Exchange buys precious metals in any condition, at prices set fresh every cycle.',
                claim: 'Instant appraisal. Payment in credits the same cycle. Insured courier collection on any station.',
                tag: 'Call 1-800-GNOLAM. Turn clutter into credits today.',
                legal: 'Prices offered may be below market value. The Gnolam have never once paid market value.',
            },
            {
                brand: 'VEX & SAKKRA ATTORNEYS',
                product: 'Cryosleep Injury Claims',
                testimonial: 'radiation_claimant.png',
                phone: '1-888-VEX-SAKKRA',
                hook: 'Did you wake from cryosleep years later than your contract said you would?',
                body: 'Colonists on long-haul transports may be entitled to compensation for lost time, missed elections and freezer burn.',
                claim: 'Vex and Sakkra have recovered over four billion credits for wronged sleepers.',
                tag: 'You lost decades. Do not lose your claim. Call 1-888-VEX-SAKKRA.',
                legal: 'Claims must be filed within two cycles of waking. Time spent asleep does not count. We checked.',
            },
            {
                brand: 'ALTAIR SKY ACADEMY',
                product: 'Learn to Pilot From Home',
                phone: '1-800-FLY-ALKARI',
                hook: 'Always dreamed of the captain’s chair, but the academy waiting list is eleven years long?',
                body: 'The Altair Sky Academy correspondence course teaches basic interstellar piloting by holo-lesson.',
                claim: 'Graduates pass the civilian pilot’s examination at nearly twice the rate of the self-taught.',
                tag: 'Call 1-800-FLY-ALKARI. Your first lesson module ships free.',
                legal: 'Course does not include an actual ship. Simulator results do not transfer to real vacuum.',
            },
            {
                brand: 'TRILARIAN DEEP WATER RESORTS',
                product: 'Ocean World Timeshare',
                phone: '1-877-DEEP-H2O',
                hook: 'Imagine waking up beneath a blue ocean sky, three hundred metres down.',
                body: 'Own a share of a luxury submerged villa on the Trilarian homeworld, two weeks of every standard year.',
                claim: 'Pressurised suites, private reef access and a view no surface resort can offer.',
                tag: 'Call 1-877-DEEP-H2O for a free presentation. Attendance is strongly encouraged.',
                legal: 'Timeshare obligations are perpetual and transferable to heirs. The ocean is deeper than it looks.',
            },
            {
                brand: 'MEKLAR LIFESPAN SOLUTIONS',
                product: 'Cybernetic Joint Replacement',
                testimonial: 'alien_mechanic.png',
                phone: '1-888-NEW-KNEE',
                hook: 'Has a lifetime of heavy-gravity worlds left your knees on strike?',
                body: 'Meklar Lifespan Solutions offers cybernetic joint replacements, fitted in a single visit.',
                claim: 'Patients report full mobility within one cycle, and a slight improvement in arithmetic.',
                tag: 'Call 1-888-NEW-KNEE. Walk tall on any world.',
                legal: 'Replacement joints remain Meklar property. Firmware updates are mandatory and unannounced.',
            },
            {
                brand: 'THE LONELY STARS SOCIETY',
                product: 'Interspecies Companionship Registry',
                testimonial: 'mrrshan_beauty.png',
                phone: '1-800-NOT-ALONE',
                hook: 'The galaxy is vast. You do not have to cross it alone.',
                body: 'The Lonely Stars Society matches compatible travellers across nineteen species and forty systems.',
                claim: 'Over one million successful pairings, and only a few diplomatic incidents.',
                tag: 'Call 1-800-NOT-ALONE. Somebody out there is waiting by the comm.',
                legal: 'Compatibility is not guaranteed across atmospheres, life cycles or digestive systems.',
            },
        ];
        const item = pickFrom(SHOWS, SHOWS[0]);
        return {
            kind: 'infomercial',
            isInfomercial: true,
            brand: item.brand,
            product: item.product,
            testimonial: item.testimonial || null,
            // The law firm has a crest in assets/generated/sponsors/.
            logo: /VEX & SAKKRA/.test(item.brand) ? 'vex_sakkra_law.png' : null,
            phone: item.phone,
            beats: [
                { kind: 'hook', text: item.hook },
                { kind: 'body', text: item.body },
                { kind: 'claim', text: item.claim },
                { kind: 'tag', text: item.tag },
                { kind: 'legal', text: item.legal },
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
        ident, signoff, commercial, promo, setShows, galaxyShop, infomercial, sponsored,
        intercepted, antaranLine, researchExchange, orionSalvage, shipDealer, marines,
        showOpen, intoBreak, outOfBreak, showClose, exchange, desk,
        twoWay,
        tickerSegments, chyron, sponsorName,
        shortenHeadline, rundownOpen, breakingIntro,
        /** The species with a correspondent plate on disk — read-only. */
        CORRESPONDENT_READY,
    };
})();