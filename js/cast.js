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
     *   tic         a phrase that is theirs
     *   mood        starting disposition; the director may move it
     */
    const CAST = {
        human: {
            id: 'human', colour: '#e8c87a', name: 'Commander Hale', role: 'Lead Anchor',
            voice: 'am_michael', register: 'formal', mood: 'composed',
            fixation: 'protocol and the chain of command',
            tic: 'Let us be precise about this.',
        },
        mrrshan_f: {
            id: 'mrrshan_f', colour: '#ff9a6c', name: 'Varr', role: 'Co-Anchor',
            voice: 'af_bella', register: 'dry', mood: 'amused',
            fixation: 'what it costs and who is paying',
            tic: 'Which is one way of putting it.',
        },
        mrrshan: {
            id: 'mrrshan', colour: '#ffb347', name: 'Rell', role: 'Trade Desk',
            voice: 'bm_george', register: 'eager', mood: 'distracted',
            fixation: 'tonnage, margins and shipping lanes',
            tic: 'And that is before freight.',
        },
        robot: {
            id: 'robot', colour: '#8fe0ff', machine: true, name: 'Unit 7', role: 'Station Automation',
            voice: 'vox_unit', register: 'flat', mood: 'unbothered',
            fixation: 'the exact figure, to four decimal places',
            tic: 'That is not what the record says.',
        },
        psilon: {
            id: 'psilon', colour: '#9ad7ff', name: 'Oth', role: 'Science Desk',
            voice: 'bm_fable', register: 'academic', mood: 'patient',
            fixation: 'the part everyone else got wrong',
            tic: 'The mechanism is more interesting than the result.',
        },
        bulrathi: {
            id: 'bulrathi', colour: '#d2a06a', name: 'Grolm', role: 'Defence Desk',
            voice: 'bm_lewis', register: 'blunt', mood: 'sceptical',
            fixation: 'who is lying about their fleet strength',
            tic: 'Somebody is counting wrong.',
        },
        sakkra: {
            id: 'sakkra', colour: '#9ede8a', name: 'Ssyth', role: 'Colonies Desk',
            voice: 'bm_daniel', register: 'measured', mood: 'wary',
            fixation: 'how many people actually live there',
            tic: 'The population figure is the story.',
        },
        alkari: {
            id: 'alkari', colour: '#bfe3ff', name: 'Kesh', role: 'Field Correspondent',
            voice: 'bf_emma', register: 'breathless', mood: 'keen',
            fixation: 'being first to say it out loud',
            tic: 'I am told this is still developing.',
        },
        darlok: {
            id: 'darlok', colour: '#c79aff', machine: true, name: 'The Analyst', role: 'Intelligence Desk',
            voice: 'vox_unit', register: 'oblique', mood: 'unreadable',
            fixation: 'what was left out of the statement',
            tic: 'What interests me is the omission.',
        },
        meklar: {
            id: 'meklar', colour: '#ff8f5e', machine: true, name: 'Foundry-Nine', role: 'Industry Desk',
            voice: 'vox_unit', register: 'clipped', mood: 'literal',
            fixation: 'throughput and failure rates',
            tic: 'Output is output.',
        },
        silicoid: {
            id: 'silicoid', colour: '#7fe6d2', name: 'Quarry', role: 'Resources Desk',
            voice: 'bf_isabella', register: 'slow', mood: 'immovable',
            fixation: 'the very long view',
            tic: 'This will matter in a century.',
        },
        klackon: {
            id: 'klackon', colour: '#e0d27a', name: 'Hive-Liaison', role: 'Labour Desk',
            voice: 'af_heart', register: 'brisk', mood: 'efficient',
            fixation: 'how many hands it took',
            tic: 'The work was done. That is the report.',
        },
    };

    /**
     * What one character makes of another. `from` is doing the thinking.
     *
     *   stance   how they treat them on air
     *   jab      something `from` says about or to `to`
     *   reply    how `to` answers it, in their own register
     *
     * The desk is pinned to Human + Mrrshan for most of the day (see
     * main.js lineup), so most of the volume lives on that pair — with
     * only one entry per direction, every exchange between them was the
     * same two lines, and `exchange()` had nothing to pick from. There
     * are six in each direction now.
     */
    const RELATIONSHIPS = [
        // -------- Commander Hale ↔ Varr (the daytime desk) --------

        // Hale on Varr
        {
            from: 'human', to: 'mrrshan_f', stance: 'deferential',
            jab: 'Varr has the floor, if she wants it.',
            reply: 'I usually do.',
        },
        {
            from: 'human', to: 'mrrshan_f', stance: 'tired',
            jab: 'You enjoy this.',
            reply: 'I enjoy the parts where you are wrong.',
        },
        {
            from: 'human', to: 'mrrshan_f', stance: 'careful',
            jab: 'Correct me if I have that wrong.',
            reply: 'You have it wrong.',
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
        },
        {
            from: 'mrrshan_f', to: 'human', stance: 'dry',
            jab: 'Hale reads it the way it was filed.',
            reply: 'The way it was written.',
        },
        {
            from: 'mrrshan_f', to: 'human', stance: 'baiting',
            jab: 'You could just say you do not know.',
            reply: 'I know.',
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
        },
        {
            from: 'robot', to: 'human', stance: 'correcting',
            jab: 'That is not what the record says, Commander.',
            reply: 'The record is not the whole of it.',
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

    return { get, all, between, exchange, CAST, RELATIONSHIPS };
})();