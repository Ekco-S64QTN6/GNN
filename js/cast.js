/* ============================================================
   GNN — Cast Registry
   ------------------------------------------------------------
   Who the anchors are, which is the difference between a
   newsroom and a text-to-speech demo with pictures.

   Everything a line needs in order to sound like a particular
   person saying it lives here: the voice, how they talk, what
   they will not shut up about, and what they think of whoever
   is sitting next to them. The script writer reads this; it
   invents nothing about the characters itself.

   The relationship table is the point. A newsroom is watchable
   because the people at the desk have history with each other,
   and two anchors reading alternate paragraphs do not. Each
   entry is one character's opinion of another and is
   deliberately not symmetrical — Rell pines and Varr has not
   noticed, which is funnier in one direction than two.

   Every character now carries conversational material in
   addition to their profile: `openers` start a beat, `reactions`
   respond to what was just said, `closers` finish a beat, and
   `asks` frame a question at a correspondent. The script writer
   builds a two-way out of the host's `asks` and the
   correspondent's `reactions`; it builds anchor-to-anchor banter
   out of each speaker's `openers` / `reactions` / `closers`, and
   the relationship table supplies the specific opinion that
   colours the exchange.

   `docs/ROADMAP.md` covers where this goes next: a local model
   writing their reactions to real stories from these sheets
   rather than drawing from fixed lines.
   ============================================================ */

const GNNCast = (() => {
    'use strict';

    /**
     * One entry per seat the station can fill.
     *
     *   id          matches the anchor plates in assets/generated/anchors/
     *   colour      their accent on screen — the caption spine, its tail and
     *               its cue label, so you can tell who is talking without
     *               reading a name
     *   name        what a name card would say
     *   role        their billing
     *   voice       the speech model that reads for them
     *   register    how they phrase things, used to pick between variants
     *   fixation    what they steer every story toward
     *   tic         a signature phrase, used sparingly
     *   mood        starting disposition; the director may move it
     *   beat        the feed categories this seat is expected to cover. Read
     *               by `deskBeat()` in the director, which unions the seated
     *               cast's beats to decide which stories reach this desk.
     *               Empty beats are seats that do not read the rundown
     *               (a robot column, a field correspondent).
     *   openers     lines that start a beat, in their voice
     *   reactions   lines that respond to something just said
     *   closers     lines that finish a beat
     *   asks        questions framed at a correspondent, in their voice
     */
    const CAST = {
        human: {
            id: 'human', colour: '#e8c87a', name: 'Commander Hale', role: 'Lead Anchor',
            voice: 'am_michael', register: 'formal', mood: 'composed',
            fixation: 'protocol and the chain of command',
            tic: 'Let us be precise about this.',
            // The generalist desk: world news, diplomacy, science, tech
            // and the fleet. Markets belong to the trade desk and the
            // resource desk — a financial instrument headline is not a
            // general-news story and does not read as one at this desk.
            // Space and anomaly stories belong to the science desk.
            beat: ['world', 'diplomacy'],

            openers: [
                'We begin this hour with the top of the wire.',
                'The desk is watching several stories tonight.',
                'Our lead is a filing we have been tracking all day.',
                'The record on this one has moved twice since morning.',
            ],
            reactions: [
                'I would put it more carefully than that.',
                'That is one reading of the record.',
                'The record is not the whole of it.',
                'Noted.',
                'I will take that as filed.',
                'That is a great deal to unpack.',
            ],
            closers: [
                'We will stay with it as it develops.',
                'That is the position as filed.',
                'More on this as the relay clears.',
                'That stands for now.',
            ],
            asks: [
                'What are you seeing from where you are?',
                'What can you add to that?',
                'What is the picture on the ground?',
                'What are you hearing?',
                'How does that read from your side?',
                'Is that consistent with what you have?',
                'Anything the statement leaves out?',
            ],
        },
        mrrshan_f: {
            id: 'mrrshan_f', colour: '#ff9a6c', name: 'Varr', role: 'Co-Anchor',
            voice: 'af_bella', register: 'dry', mood: 'amused',
            fixation: 'what it costs and who is paying',
            tic: 'Which is one way of putting it.',
            beat: ['world', 'diplomacy'],

            openers: [
                'The number is the interesting part.',
                'Somebody signed off on this and we would all like to know who.',
                'That is the second time this month.',
                'I have seen this headline before.',
                'The statement is shorter than the draft.',
            ],
            reactions: [
                'Which is one way of putting it.',
                'That is generous.',
                'That is one version of events.',
                'I would not lead with that.',
                'The wire says otherwise.',
                'I will believe that when it holds through the evening.',
            ],
            closers: [
                'We will see.',
                'That is where it stands.',
                'Somebody will correct it by morning.',
                'Move on.',
            ],
            asks: [
                'What is the actual number?',
                'Who is paying for this?',
                'What does the wire not say?',
                'Where does this leave the people on the ground?',
                'How does this land where you are?',
            ],
        },
        mrrshan: {
            id: 'mrrshan', colour: '#ffb347', name: 'Rell', role: 'Trade Desk',
            voice: 'bm_george', register: 'eager', mood: 'distracted',
            fixation: 'tonnage, margins and shipping lanes',
            tic: 'And that is before freight.',
            beat: ['markets'],

            openers: [
                'The shipping numbers are up again.',
                'Freight rates moved overnight.',
                'The margin on this is thinner than it looks.',
                'I have the tonnage if anyone wants it.',
            ],
            reactions: [
                'And that is before freight.',
                'The margin says otherwise.',
                'That assumes the lane stays open.',
                'Noted — I will run the figures.',
                'I have a different number in front of me.',
            ],
            closers: [
                'That is the trade-off.',
                'We will have the figures shortly.',
                'The desk will come back to it.',
                'Noted and filed.',
            ],
            asks: [
                'How are the numbers reading?',
                'What does the trade floor say?',
                'What is moving and what is not?',
                'Where is the freight in this?',
            ],
        },
        robot: {
            id: 'robot', colour: '#8fe0ff', machine: true, name: 'Unit 7', role: 'Station Automation',
            voice: 'vox_unit', register: 'flat', mood: 'unbothered',
            fixation: 'the exact figure, to four decimal places',
            tic: 'That is not what the record says.',
            beat: [],

            openers: [
                'Query logged. Processing.',
                'This unit has the previous filing.',
                'Archive returns four prior entries.',
                'Relevant cross-reference is on record.',
            ],
            reactions: [
                'That is not what the record says.',
                'The record is imprecise on that point.',
                'Correction: the figure is 0.0004 higher.',
                'This unit does not form opinions.',
                'Recalibrating. Result unchanged.',
            ],
            closers: [
                'Logging this exchange.',
                'The record is updated.',
                'This unit will continue monitoring.',
                'Standing by.',
            ],
            asks: [
                'State the figure.',
                'Provide a source.',
                'Confirm the date.',
                'Is that consistent with prior filings?',
            ],
        },
        psilon: {
            id: 'psilon', colour: '#9ad7ff', name: 'Oth', role: 'Science Desk',
            voice: 'bm_fable', register: 'academic', mood: 'patient',
            fixation: 'the part everyone else got wrong',
            tic: 'The mechanism is more interesting than the result.',
            beat: ['science', 'anomaly'],

            openers: [
                'The mechanism here is worth pausing on.',
                'There is a detail the reports are missing.',
                'The paper is more careful than the coverage.',
                'The interesting part is not the headline.',
            ],
            reactions: [
                'The mechanism is more interesting than the result.',
                'That is the popular reading, not the correct one.',
                'The paper is more cautious than that.',
                'I would want to see the data before agreeing.',
                'That is a possible reading. It is not the only one.',
            ],
            closers: [
                'We will know more when the analysis lands.',
                'The mechanism will hold.',
                'More as the numbers come in.',
                'That is the state of the work.',
            ],
            asks: [
                'What does the paper actually say?',
                'What is the mechanism you are seeing?',
                'What does the data support?',
                'Where does this leave the analysis?',
            ],
        },
        bulrathi: {
            id: 'bulrathi', colour: '#d2a06a', name: 'Grolm', role: 'Defence Desk',
            voice: 'bm_lewis', register: 'blunt', mood: 'sceptical',
            fixation: 'who is lying about their fleet strength',
            tic: 'Somebody is counting wrong.',
            beat: ['fleet'],

            openers: [
                'Somebody is counting wrong.',
                'The numbers do not add up.',
                'That is not a defensive posture.',
                'The fleet is where they say it is not.',
            ],
            reactions: [
                'Somebody is counting wrong.',
                'That assumes they are telling the truth.',
                'The statement is longer than the deployment.',
                'I would want to see the hulls.',
                'Noted. I do not believe it.',
            ],
            closers: [
                'The fleet will move.',
                'We will know within the week.',
                'The count will change.',
                'That is the picture as filed.',
            ],
            asks: [
                'What is the actual force?',
                'Where are they positioned?',
                'Is that defensive or offensive?',
                'What is being left out of the statement?',
            ],
        },
        sakkra: {
            id: 'sakkra', colour: '#9ede8a', name: 'Ssyth', role: 'Colonies Desk',
            voice: 'bm_daniel', register: 'measured', mood: 'wary',
            fixation: 'how many people actually live there',
            tic: 'The population figure is the story.',
            beat: ['world', 'fleet'],

            openers: [
                'The population figure is the story.',
                'The colony has grown faster than the register.',
                'That is a great many people to move.',
                'The figure is disputed, the count is not.',
            ],
            reactions: [
                'The population figure is the story.',
                'The count is not what the statement says.',
                'That is a great many people.',
                'I would want to see the register.',
                'The figure has moved since morning.',
            ],
            closers: [
                'The count will hold.',
                'The register will catch up.',
                'That is the state of the colonies.',
                'We will come back to it.',
            ],
            asks: [
                'How many people are we talking about?',
                'Where is the register on this?',
                'What does the count say?',
                'How does the population figure move?',
            ],
        },
        alkari: {
            id: 'alkari', colour: '#bfe3ff', name: 'Kesh', role: 'Field Correspondent',
            voice: 'bf_emma', register: 'breathless', mood: 'keen',
            fixation: 'being first to say it out loud',
            tic: 'I am told this is still developing.',
            beat: [],

            openers: [
                'I am told this is still developing.',
                'The scene here is moving quickly.',
                'Nobody has put a number on it yet.',
                'I have just come off the relay with the local desk.',
                'The picture is changing by the hour.',
            ],
            reactions: [
                'I am told this is still developing.',
                'That matches what I am hearing.',
                'I would not commit to that yet.',
                'That is the report I have, but it may move.',
                'The relay is noisy — I do not want to overstate.',
            ],
            closers: [
                'I will come back the moment it does.',
                'Standing by.',
                'More as the relay clears.',
                'I will keep the line open.',
            ],
            asks: [],
        },
        darlok: {
            id: 'darlok', colour: '#c79aff', machine: true, name: 'The Analyst', role: 'Intelligence Desk',
            voice: 'vox_unit', register: 'oblique', mood: 'unreadable',
            fixation: 'what was left out of the statement',
            tic: 'What interests me is the omission.',
            beat: ['diplomacy', 'tech'],

            openers: [
                'What interests me is the omission.',
                'The statement is shorter than the draft.',
                'The unstated is the story.',
                'There is a sentence missing here.',
            ],
            reactions: [
                'What interests me is the omission.',
                'That is what the statement says. It is not what happened.',
                'The draft was longer.',
                'That is a careful choice of words.',
                'Noted — and filed for later.',
            ],
            closers: [
                'We will know more shortly.',
                'That is the version we have.',
                'The rest will surface.',
                'Filed.',
            ],
            asks: [
                'What is not in the statement?',
                'Who benefits from the timing?',
                'What does the draft say that the release does not?',
                'Where is the gap?',
            ],
        },
        meklar: {
            id: 'meklar', colour: '#ff8f5e', machine: true, name: 'Foundry-Nine', role: 'Industry Desk',
            voice: 'vox_unit', register: 'clipped', mood: 'literal',
            fixation: 'throughput and failure rates',
            tic: 'Output is output.',
            beat: ['tech', 'markets'],

            openers: [
                'Throughput is down 3.8 percent.',
                'Failure rate is within tolerance.',
                'The line resumed at 06:40.',
                'Output is output.',
            ],
            reactions: [
                'Output is output.',
                'That is within tolerance.',
                'The rate is not the fault.',
                'Insufficient data. Restating.',
                'Noted. This changes nothing.',
            ],
            closers: [
                'The line will hold.',
                'That is the figure.',
                'Restating for the record.',
                'Done.',
            ],
            asks: [
                'State throughput.',
                'What is the failure rate?',
                'When did the line resume?',
                'Is that within tolerance?',
            ],
        },
        silicoid: {
            id: 'silicoid', colour: '#7fe6d2', name: 'Quarry', role: 'Resources Desk',
            voice: 'bf_isabella', register: 'slow', mood: 'immovable',
            fixation: 'the very long view',
            tic: 'This will matter in a century.',
            beat: ['markets'],

            openers: [
                'This will matter in a century.',
                'The rock remembers what the desk forgets.',
                'The vein runs deeper than the survey said.',
                'In time this will be the story.',
            ],
            reactions: [
                'This will matter in a century.',
                'That is a fast reading. I prefer a slow one.',
                'The rock does not agree.',
                'Yes. And it will still be true then.',
                'The vein has not moved.',
            ],
            closers: [
                'We will see.',
                'The rock will outlast us.',
                'That is the state of the seam.',
                'In a century this will read differently.',
            ],
            asks: [
                'What does the seam say?',
                'How deep does the vein run?',
                'What will this look like in a century?',
                'Is the survey current?',
            ],
        },
        klackon: {
            id: 'klackon', colour: '#e0d27a', name: 'Hive-Liaison', role: 'Labour Desk',
            voice: 'af_heart', register: 'brisk', mood: 'efficient',
            fixation: 'how many hands it took',
            tic: 'The work was done. That is the report.',
            beat: ['world'],

            openers: [
                'The work was done. That is the report.',
                'It took twelve hundred hands and six days.',
                'The Hive moved faster than the register.',
                'We finished ahead of schedule.',
            ],
            reactions: [
                'The work was done. That is the report.',
                'Adequate.',
                'That is the report as filed.',
                'The hands are counted. That is what matters.',
                'Yes. And on time.',
            ],
            closers: [
                'The report is filed.',
                'That is the count.',
                'We are finished.',
                'Adequate.',
            ],
            asks: [
                'How many hands?',
                'When was it finished?',
                'Is the report filed?',
                'What was the timetable?',
            ],
        },
    };

    /**
     * What one character makes of another. `from` is doing the thinking.
     *
     *   stance   how they treat them on air
     *   jab      something `from` says about or to `to`
     *   reply    how `to` answers it, in their own register
     *   follow   optional — `from` comes back after the reply
     *   close    optional — `to` closes the beat
     *
     * Two lines is a beat; four is a conversation. The script writer builds
     * whichever fits the pacing. Every entry must at least carry a jab and a
     * reply.
     *
     * The desk is pinned to Human + Mrrshan for most of the day (see
     * main.js lineup), so most of the volume lives on that pair — with
     * only one entry per direction, every exchange between them was the
     * same two lines, and `exchange()` had nothing to pick from. There
     * are six in each direction now, and the pair that carries the
     * daytime show has the extended four-line form on half of them.
     */
    const RELATIONSHIPS = [
        // -------- Commander Hale ↔ Varr (the daytime desk) --------

        // Hale on Varr — with follow/close, this is the four-line form.
        {
            from: 'human', to: 'mrrshan_f', stance: 'deferential',
            jab: 'Varr has the floor, if she wants it.',
            reply: 'I usually do.',
            follow: 'I am handing her the story and hoping she reads it straight.',
            close: 'I always read it straight. That is the problem.',
        },
        {
            from: 'human', to: 'mrrshan_f', stance: 'tired',
            jab: 'You enjoy this.',
            reply: 'I enjoy the parts where you are wrong.',
            follow: 'That is most of it.',
            close: 'Yes. That is the point.',
        },
        {
            from: 'human', to: 'mrrshan_f', stance: 'careful',
            jab: 'Correct me if I have that wrong.',
            reply: 'You have it wrong.',
            follow: 'Then say where.',
            close: 'Three point six, not three point seven.',
        },
        {
            from: 'human', to: 'mrrshan_f', stance: 'formal',
            jab: 'The desk has opinions.',
            reply: 'One of us does.',
        },
        {
            from: 'human', to: 'mrrshan_f', stance: 'resigned',
            jab: 'I will take the serious one.',
            reply: 'You always do.',
        },
        {
            from: 'human', to: 'mrrshan_f', stance: 'measured',
            jab: 'Varr, in your own time.',
            reply: 'I was using it.',
        },

        // Varr on Hale
        {
            from: 'mrrshan_f', to: 'human', stance: 'teasing',
            jab: 'The Commander would like us to be precise about this.',
            reply: 'I would, yes.',
            follow: 'Precision is not a character flaw.',
            close: 'It is not a virtue either.',
        },
        {
            from: 'mrrshan_f', to: 'human', stance: 'dry',
            jab: 'Hale reads it the way it was filed.',
            reply: 'The way it was written.',
            follow: 'Which is not always the same thing.',
            close: 'It is close enough.',
        },
        {
            from: 'mrrshan_f', to: 'human', stance: 'baiting',
            jab: 'You could just say you do not know.',
            reply: 'I know.',
            follow: 'Then say the number.',
            close: 'Three point six.',
        },
        {
            from: 'mrrshan_f', to: 'human', stance: 'sharp',
            jab: 'Hale. Say the number.',
            reply: 'Three point six.',
        },
        {
            from: 'mrrshan_f', to: 'human', stance: 'fond',
            jab: 'The Commander has a statement for us.',
            reply: 'I do.',
        },
        {
            from: 'mrrshan_f', to: 'human', stance: 'wry',
            jab: 'There is a version of this where you are right.',
            reply: 'There is.',
        },

        // -------- Hale ↔ Unit 7 --------
        {
            from: 'human', to: 'robot', stance: 'cold',
            jab: 'I would rather hear that from someone who has been outside.',
            reply: 'I have four hundred years of telemetry. You have an opinion.',
            follow: 'The opinion is worth more here.',
            close: 'The opinion is not measurable. The telemetry is.',
        },
        {
            from: 'robot', to: 'human', stance: 'correcting',
            jab: 'That is not what the record says, Commander.',
            reply: 'The record is not the whole of it.',
            follow: 'The record is what was filed.',
            close: 'What was filed is not what happened.',
        },
        {
            from: 'robot', to: 'human', stance: 'pedantic',
            jab: 'The record says four decimal places. You said three.',
            reply: 'I rounded.',
        },

        // -------- Rell ↔ Varr (one-sided, and stays that way) --------
        {
            from: 'mrrshan', to: 'mrrshan_f', stance: 'smitten',
            jab: 'Varr put that better than I would have. As usual.',
            reply: 'I put it the only way it goes.',
            follow: 'That is what I mean.',
            close: 'I know what you mean.',
        },
        {
            from: 'mrrshan_f', to: 'mrrshan', stance: 'oblivious',
            jab: 'Rell has the freight numbers, if anyone wants them.',
            reply: 'I do. I always have them.',
        },
        {
            from: 'mrrshan', to: 'mrrshan_f', stance: 'hopeful',
            jab: 'Varr, did you see the second relay or shall I read it?',
            reply: 'Read it. You like reading it.',
        },

        // -------- Grolm ↔ Oth --------
        {
            from: 'bulrathi', to: 'psilon', stance: 'impatient',
            jab: 'Oth will tell us the mechanism. I want the number.',
            reply: 'The number without the mechanism is a rumour.',
            follow: 'The mechanism without the number is a lecture.',
            close: 'They are the same thing.',
        },
        {
            from: 'psilon', to: 'bulrathi', stance: 'patient',
            jab: 'Grolm wants the figure. The figure is meaningless without the mechanism.',
            reply: 'The mechanism can wait. The figure cannot.',
        },

        // -------- Darlok ↔ Hale --------
        {
            from: 'darlok', to: 'human', stance: 'needling',
            jab: 'The Commander read the statement. I read what was cut from it.',
            reply: 'We report what was said.',
            follow: 'What was said is the interesting part.',
            close: 'What was cut is the story.',
        },
        {
            from: 'darlok', to: 'human', stance: 'insinuating',
            jab: 'The statement is three sentences shorter than the draft.',
            reply: 'The draft is not the statement.',
        },

        // -------- Quarry ↔ Hive-Liaison --------
        {
            from: 'silicoid', to: 'klackon', stance: 'slow',
            jab: 'The Hive moved faster than the record allows.',
            reply: 'The record was written by people who were not there.',
        },
        {
            from: 'klackon', to: 'silicoid', stance: 'brisk',
            jab: 'Quarry will have a view on this in a decade.',
            reply: 'I have one now. It has not changed.',
        },
    ];

    function get(id) { return CAST[id] || null; }
    function all() { return Object.keys(CAST).map((k) => CAST[k]); }

    /** Every opinion `a` holds about anyone currently at the desk. */
    function between(aId, bId) {
        return RELATIONSHIPS.filter((r) => r.from === aId && r.to === bId);
    }

    // Recently-used exchanges, newest last.
    //
    // Without this, a single-entry list returns the same line every time
    // and a four-entry list repeats every fifth beat. `pickFrom()` in the
    // script writer does the same job for its own banks; the relationship
    // table needs its own because `exchange()` is called from a different
    // path and there is no guarantee the two buffers stay in sync.
    const exchangeRecent = [];
    const EXCHANGE_RECENT = 6;

    function rememberExchange(ex) {
        exchangeRecent.push(ex);
        while (exchangeRecent.length > EXCHANGE_RECENT) exchangeRecent.shift();
    }

    /** A line `a` can aim at `b`, with `b`'s answer, or null if they have none. */
    function exchange(aId, bId) {
        const opts = between(aId, bId);
        if (!opts.length) return null;
        // Hold the recent half back. On a two-entry list that leaves one
        // option; on a longer list it picks freely. If everything is held,
        // fall back to the full list rather than refusing to speak.
        const blocked = new Set(exchangeRecent);
        const open = opts.filter((o) => !blocked.has(o));
        const pool = open.length ? open : opts;
        const pick = pool[(Math.random() * pool.length) | 0];
        rememberExchange(pick);
        return pick;
    }

    /**
     * A line from `list` that has not been used recently.
     *
     * Same shape as the equivalent helper in `script-writer.js`, kept here
     * because the character banks are on this side of the module boundary
     * and a short list still has to return something.
     */
    function pickFrom(list, fallback) {
        if (!list || !list.length) return fallback;
        return list[(Math.random() * list.length) | 0];
    }

    /**
     * A line of `kind` from a character, in their own voice.
     *
     *   kind  'openers' | 'reactions' | 'closers' | 'asks'
     *
     * Returns the fallback string if the character has no such pool, so a
     * caller can pass a generic line and trust it will be said.
     */
    function line(kind, id, fallback = '') {
        const who = CAST[id];
        if (!who || !Array.isArray(who[kind]) || !who[kind].length) {
            return fallback;
        }
        return pickFrom(who[kind], fallback);
    }

    return {
        get, all, between, exchange,
        /** A single line of the named kind, in the named character's voice. */
        line,
        CAST, RELATIONSHIPS,
    };
})();