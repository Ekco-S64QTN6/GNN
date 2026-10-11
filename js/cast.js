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
            id: 'human', name: 'Commander Hale', role: 'Lead Anchor',
            voice: 'am_michael', register: 'formal', mood: 'composed',
            fixation: 'protocol and the chain of command',
            tic: 'Let us be precise about this.',
        },
        mrrshan_f: {
            id: 'mrrshan_f', name: 'Varr', role: 'Co-Anchor',
            voice: 'af_bella', register: 'dry', mood: 'amused',
            fixation: 'what it costs and who is paying',
            tic: 'Which is one way of putting it.',
        },
        mrrshan: {
            id: 'mrrshan', name: 'Rell', role: 'Trade Desk',
            voice: 'bm_george', register: 'eager', mood: 'distracted',
            fixation: 'tonnage, margins and shipping lanes',
            tic: 'And that is before freight.',
        },
        robot: {
            id: 'robot', machine: true, name: 'Unit 7', role: 'Station Automation',
            voice: 'vox_unit', register: 'flat', mood: 'unbothered',
            fixation: 'the exact figure, to four decimal places',
            tic: 'That is not what the record says.',
        },
        psilon: {
            id: 'psilon', name: 'Oth', role: 'Science Desk',
            voice: 'bm_fable', register: 'academic', mood: 'patient',
            fixation: 'the part everyone else got wrong',
            tic: 'The mechanism is more interesting than the result.',
        },
        bulrathi: {
            id: 'bulrathi', name: 'Grolm', role: 'Defence Desk',
            voice: 'bm_lewis', register: 'blunt', mood: 'sceptical',
            fixation: 'who is lying about their fleet strength',
            tic: 'Somebody is counting wrong.',
        },
        sakkra: {
            id: 'sakkra', name: 'Ssyth', role: 'Colonies Desk',
            voice: 'bm_daniel', register: 'measured', mood: 'wary',
            fixation: 'how many people actually live there',
            tic: 'The population figure is the story.',
        },
        alkari: {
            id: 'alkari', name: 'Kesh', role: 'Field Correspondent',
            voice: 'bf_emma', register: 'breathless', mood: 'keen',
            fixation: 'being first to say it out loud',
            tic: 'I am told this is still developing.',
        },
        darlok: {
            id: 'darlok', name: 'The Analyst', role: 'Intelligence Desk',
            voice: 'vox_unit', register: 'oblique', mood: 'unreadable',
            fixation: 'what was left out of the statement',
            tic: 'What interests me is the omission.',
        },
        meklar: {
            id: 'meklar', machine: true, name: 'Foundry-Nine', role: 'Industry Desk',
            voice: 'vox_unit', register: 'clipped', mood: 'literal',
            fixation: 'throughput and failure rates',
            tic: 'Output is output.',
        },
        silicoid: {
            id: 'silicoid', name: 'Quarry', role: 'Resources Desk',
            voice: 'bf_isabella', register: 'slow', mood: 'immovable',
            fixation: 'the very long view',
            tic: 'This will matter in a century.',
        },
        klackon: {
            id: 'klackon', name: 'Hive-Liaison', role: 'Labour Desk',
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
     */
    const RELATIONSHIPS = [
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
            from: 'mrrshan_f', to: 'human', stance: 'teasing',
            jab: 'The Commander would like us to be precise about this.',
            reply: 'I would, yes.',
        },
        {
            from: 'bulrathi', to: 'psilon', stance: 'impatient',
            jab: 'Oth will tell us the mechanism. I want the number.',
            reply: 'The number without the mechanism is a rumour.',
        },
        {
            from: 'darlok', to: 'human', stance: 'needling',
            jab: 'The Commander read the statement. I read what was cut from it.',
            reply: 'We report what was said.',
        },
    ];

    function get(id) { return CAST[id] || null; }
    function all() { return Object.keys(CAST).map((k) => CAST[k]); }

    /** Every opinion `a` holds about anyone currently at the desk. */
    function between(aId, bId) {
        return RELATIONSHIPS.filter((r) => r.from === aId && r.to === bId);
    }

    /** A line `a` can aim at `b`, with `b`'s answer, or null if they have none. */
    function exchange(aId, bId) {
        const opts = between(aId, bId);
        if (!opts.length) return null;
        return opts[(Math.random() * opts.length) | 0];
    }

    return { get, all, between, exchange, CAST, RELATIONSHIPS };
})();
