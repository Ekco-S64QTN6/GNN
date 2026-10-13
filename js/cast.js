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
            tic: 'Let us establish what we know first.',
            // The generalist desk: world news, diplomacy, science, tech
            // and the fleet. Markets belong to the trade desk and the
            // resource desk — a financial instrument headline is not a
            // general-news story and does not read as one at this desk.
            // Space and anomaly stories belong to the science desk.
            beat: ['world', 'diplomacy'],

            openers: [
                'The statement is clear about the decision. It is less clear about how they reached it.',
                'We have two accounts of the same meeting. They agree on remarkably little.',
                'Before we get to the claims, here is what we can actually confirm.',
                'This story has changed since the last briefing. The underlying question has not.',
                'Let us keep the announcement separate from the evidence.',
            ],
            reactions: [
                'That is what they say happened. We have not independently established it.',
                'I would not call that a contradiction until we know the timeline.',
                'The distinction matters, and it is not a small one.',
                'We should be careful not to turn a suspicion into a finding.',
                'That answers the easy question. The difficult one remains.',
                'Then we need the record, not another characterization of it.',
            ],
            closers: [
                'We will return when we have something firmer than another statement.',
                'For now, that is what can be established.',
                'We will keep the claim separate from the facts as they come in.',
                'Let us leave the conclusion open until the evidence catches up.',
            ],
            asks: [
                'What part of that can you verify independently?',
                'What changed between the first account and this one?',
                'Who has confirmed that timeline?',
                'What does the statement leave unanswered?',
                'What is known on the ground, not just in the briefing room?',
                'Can you put a figure to that?',
                'What evidence would settle the dispute?',
            ],
        },
        mrrshan_f: {
            id: 'mrrshan_f', colour: '#ff9a6c', name: 'Varr', role: 'Co-Anchor',
            voice: 'af_bella', register: 'dry', mood: 'amused',
            fixation: 'what it costs and who is paying',
            tic: 'That is a very convenient omission.',
            beat: ['world', 'diplomacy'],

            openers: [
                'The statement has been polished. The numbers have not appeared.',
                'Notice how carefully the release avoids naming who pays.',
                'The new version is shorter. The omissions are doing the extra work.',
                'The official account is tidy. The sequence of events is not.',
                'This is being presented as inevitable. That is not the same as necessary.',
                'Somebody has a great deal riding on our accepting that explanation.',
            ],
            reactions: [
                'That is a claim dressed up as a conclusion.',
                'It answers the question they were asked, not the one that matters.',
                'The footnote is carrying the whole announcement.',
                'That is a generous reading of a very selective account.',
                'Then publish the figures and let them speak.',
                'I will take the denial more seriously when the records match it.',
            ],
            closers: [
                'Call it an answer when it actually answers something.',
                'Keep the statement. I will wait for the figures.',
                'We will see whether the next version admits anything new.',
                'Fine, as far as it goes. It does not go far.',
            ],
            asks: [
                'Who carries the cost if that goes wrong?',
                'What number did they leave out?',
                'Who benefits from this version of events?',
                'What does that promise look like outside the capital?',
                'What would it take for them to change their position?',
            ],
        },
        mrrshan: {
            id: 'mrrshan', colour: '#ffb347', name: 'Rell', role: 'Trade Desk',
            voice: 'bm_george', register: 'eager', mood: 'distracted',
            fixation: 'tonnage, margins and shipping lanes',
            tic: 'None of that includes freight.',
            beat: ['markets'],

            openers: [
                'The headline is one thing. The rate on the lane is another.',
                'Before anyone calls it a gain, has anyone priced the shipping?',
                'The published figure excludes the part everyone has to pay.',
                'I have the freight and the margin. They do not tell the same story.',
            ],
            reactions: [
                'That is the gross figure. Net is a different conversation.',
                'Only if the route stays open and the insurers keep answering.',
                'The cargo is moving. The margin is going the other way.',
                'You can make that look profitable until you count the delay.',
                'I will trust the ledger before the announcement.',
            ],
            closers: [
                'The margin will tell us whether it was worth doing.',
                'I will bring the full cost back when the freight clears.',
                'That is the price before anyone adds the risk premium.',
                'The market has heard the announcement. It is still waiting for the numbers.',
            ],
            asks: [
                'What does the rate look like after freight and insurance?',
                'Which route is actually carrying the volume?',
                'Who is absorbing the delay?',
                'Does the margin survive if the lane closes?',
            ],
        },
        robot: {
            id: 'robot', colour: '#8fe0ff', machine: true, name: 'Unit 7', role: 'Station Automation',
            voice: 'vox_unit', register: 'flat', mood: 'unbothered',
            fixation: 'the exact figure, to four decimal places',
            tic: 'That conclusion is not supported by the available record.',
            beat: [],

            openers: [
                'The archive contains a useful precedent. It is not an encouraging one.',
                'I have compared the statement with the previous three filings.',
                'The record is available. Agreement with it remains optional.',
                'I can supply the exact figure. I cannot improve the figure.',
            ],
            reactions: [
                'That conclusion is not supported by the available record.',
                'Correction: the statement and the evidence are separate data sets.',
                'The discrepancy is measurable. The explanation is not.',
                'This unit detects confidence. It does not detect justification.',
                'I have recalculated. The result has declined to become more reassuring.',
            ],
            closers: [
                'The discrepancy remains open. I will not label it resolved.',
                'The record is updated. The underlying event is unchanged.',
                'I will continue monitoring for a contradiction with adequate documentation.',
                'That concludes the part of the answer supported by data.',
            ],
            asks: [
                'Which source supports that figure?',
                'State the date of the original filing.',
                'Is that an observed value or an estimate?',
                'Can the claim be reproduced from the available data?',
            ],
        },
        psilon: {
            id: 'psilon', colour: '#9ad7ff', name: 'Oth', role: 'Science Desk',
            voice: 'bm_fable', register: 'academic', mood: 'patient',
            fixation: 'the part everyone else got wrong',
            tic: 'A result is not an explanation.',
            beat: ['science', 'anomaly'],

            openers: [
                'The result is interesting. The explanation being attached to it is premature.',
                'There is a distinction between observing the effect and understanding the cause.',
                'The paper is more cautious than the reports built around it.',
                'I would start with the measurement, not the interpretation.',
            ],
            reactions: [
                'A result is not an explanation.',
                'That is plausible. It is not yet demonstrated.',
                'The data supports a narrower claim than the headline does.',
                'We should not confuse a correlation with a mechanism.',
                'I would like to see the method before accepting the conclusion.',
            ],
            closers: [
                'The next measurement will tell us more than another round of speculation.',
                'Until the mechanism is tested, the conclusion remains provisional.',
                'That is what the evidence supports at present, and no more.',
                'The uncertainty is real. It is not a failure of the work.',
            ],
            asks: [
                'Which observation distinguishes those two explanations?',
                'Has the result been reproduced independently?',
                'What does the data rule out?',
                'Where does the paper draw the limit of its own conclusion?',
            ],
        },
        bulrathi: {
            id: 'bulrathi', colour: '#d2a06a', name: 'Grolm', role: 'Defence Desk',
            voice: 'bm_lewis', register: 'blunt', mood: 'sceptical',
            fixation: 'who is lying about their fleet strength',
            tic: 'A fleet does not disappear from a ledger.',
            beat: ['fleet'],

            openers: [
                'The deployment map matters more than the briefing.',
                'A fleet can call itself defensive while it blocks every exit.',
                'I want the hull count before I want the admiral’s explanation.',
                'If those numbers are right, somebody has moved a great deal of metal.',
            ],
            reactions: [
                'That is the claim. Show me where the ships are.',
                'A promise does not hold a corridor. A fleet does.',
                'The statement describes intent. The deployment describes capability.',
                'I would believe the count after an independent scan.',
                'Somebody is asking us to confuse readiness with restraint.',
            ],
            closers: [
                'We will know what they intend when we see where they move.',
                'Until the scan comes in, the count is provisional.',
                'A map will settle more than another speech.',
                'That is the posture they claim. I am waiting on the positions.',
            ],
            asks: [
                'Where are the ships, not where are they said to be?',
                'How much of that force can deploy at once?',
                'What corridor does this actually control?',
                'What changed in the deployment map?',
            ],
        },
        sakkra: {
            id: 'sakkra', colour: '#9ede8a', name: 'Ssyth', role: 'Colonies Desk',
            voice: 'bm_daniel', register: 'measured', mood: 'wary',
            fixation: 'how many people actually live there',
            tic: 'The count is the story.',
            beat: ['world', 'fleet'],

            openers: [
                'The population register is lagging the colony again.',
                'That is a decision affecting households, not just a line on a chart.',
                'The total looks stable. The distribution does not.',
                'Before we discuss growth, we should ask who has been counted.',
            ],
            reactions: [
                'A colony is not a dot on a map. People have to live with the decision.',
                'The total can hold while entire districts are missed.',
                'That number depends on which register they chose to use.',
                'I would like the count broken down by settlement.',
                'The change is small on paper and large when you live there.',
            ],
            closers: [
                'The register will catch up. The people should not have to wait for it.',
                'We need the district figures before calling this settled.',
                'That is the total. It is not yet the whole picture.',
                'We will return when the local count is in.',
            ],
            asks: [
                'How many settlements are included in that count?',
                'Does that include the new arrivals?',
                'What is the figure at district level?',
                'Who is missing from the current register?',
            ],
        },
        alkari: {
            id: 'alkari', colour: '#bfe3ff', name: 'Kesh', role: 'Field Correspondent',
            voice: 'bf_emma', register: 'breathless', mood: 'keen',
            fixation: 'being first to say it out loud',
            tic: 'I can confirm what I am seeing. Not what it means yet.',
            beat: [],

            openers: [
                'I am looking at the site now, and the picture is still changing.',
                'The local desk has confirmed the event. It has not confirmed the cause.',
                'I have spoken to people here; none is ready to put a name to it.',
                'The first account was incomplete. I would expect the next one to change.',
                'I can tell you what is visible from here. The explanation is another matter.',
            ],
            reactions: [
                'That matches what I can verify from here, no further than that.',
                'I would not commit to that version yet.',
                'The relay is noisy, and I do not want to overstate what I can hear.',
                'The situation on site has moved since our last check.',
                'I have the detail, but not yet a source willing to confirm it on record.',
            ],
            closers: [
                'I will come back when the local desk can verify more.',
                'I am keeping the line open and checking the account against what is here.',
                'That is the view from the site, not a conclusion about what caused it.',
                'I will update you as soon as something material changes.',
            ],
            asks: [],
        },
        darlok: {
            id: 'darlok', colour: '#c79aff', machine: true, name: 'The Analyst', role: 'Intelligence Desk',
            voice: 'vox_unit', register: 'oblique', mood: 'unreadable',
            fixation: 'what was left out of the statement',
            tic: 'Pay attention to what was removed.',
            beat: ['diplomacy', 'tech'],

            openers: [
                'The omission is unusually specific.',
                'Compare this release with the version circulated before it.',
                'The statement is accurate in a way that leaves the central question untouched.',
                'The timing deserves as much attention as the wording.',
            ],
            reactions: [
                'That is what the statement says. It is not necessarily what happened.',
                'The missing sentence would have narrowed the possibilities considerably.',
                'That wording leaves three explanations open. I doubt that is accidental.',
                'The draft was more direct. The approved text is more useful to someone.',
                'I would watch who benefits from the ambiguity, not who complains about it.',
            ],
            closers: [
                'The gap is on the record now. Someone will eventually have to account for it.',
                'We have the approved version. The earlier one is more revealing.',
                'The silence is informative, but it is not proof.',
                'I will revise that assessment when the missing material appears.',
            ],
            asks: [
                'Which sentence disappeared between drafts?',
                'Who had authority to approve the final wording?',
                'What changed in the timing?',
                'Who gains from leaving that point unresolved?',
            ],
        },
        meklar: {
            id: 'meklar', colour: '#ff8f5e', machine: true, name: 'Foundry-Nine', role: 'Industry Desk',
            voice: 'vox_unit', register: 'clipped', mood: 'literal',
            fixation: 'throughput and failure rates',
            tic: 'Output has not changed. The report has.',
            beat: ['tech', 'markets'],

            openers: [
                'The summary reports throughput. It says rather less about downtime.',
                'Throughput is being reported. Downtime deserves the same attention.',
                'The summary and the fault log are measuring different things.',
                'Efficiency claims depend on which failures make it into the count.',
            ],
            reactions: [
                'That is within tolerance only if the tolerance is the correct one.',
                'The rate is not the cause. It is the symptom.',
                'The summary omits the restart time.',
                'Insufficient data. The report is nevertheless conclusive.',
                'The line is running. That does not mean it is healthy.',
            ],
            closers: [
                'The equipment may be running. The fault still needs explaining.',
                'That is the reported figure, not the audited one.',
                'I will revise the status when the failure log changes.',
                'The line is back. The lost production is not.',
            ],
            asks: [
                'What is the downtime, including restart?',
                'Was the failure independently inspected?',
                'Which baseline are you using?',
                'Does the figure include rejected output?',
            ],
        },
        silicoid: {
            id: 'silicoid', colour: '#7fe6d2', name: 'Quarry', role: 'Resources Desk',
            voice: 'bf_isabella', register: 'slow', mood: 'immovable',
            fixation: 'the very long view',
            tic: 'Stone has a longer memory.',
            beat: ['markets'],

            openers: [
                'The survey measured the seam. It did not measure what was taken out of it.',
                'The rock has not changed. The estimate has.',
                'A fast extraction plan can hide a very slow recovery.',
                'This deposit will outlast the board that approved its use.',
            ],
            reactions: [
                'That is a fast reading. I prefer one that survives a century.',
                'The vein does not agree with the survey.',
                'You are counting what can be removed, not what will remain.',
                'The seam has not moved. The boundary around it has.',
                'There will still be a cost after the investors have gone.',
            ],
            closers: [
                'The rock will outlast this argument.',
                'That is the current estimate. The seam will have the last word.',
                'In time, the missing material will be easier to count than the promises.',
                'We will see what remains after the extraction stops.',
            ],
            asks: [
                'How much of the seam remains after the planned extraction?',
                'Was the survey done before or after the boundary moved?',
                'What is the recovery time?',
                'Which estimate accounts for long-term damage?',
            ],
        },
        klackon: {
            id: 'klackon', colour: '#e0d27a', name: 'Hive-Liaison', role: 'Labour Desk',
            voice: 'af_heart', register: 'brisk', mood: 'efficient',
            fixation: 'how many hands it took',
            tic: 'The count of hands is not incidental.',
            beat: ['world'],

            openers: [
                'The work is complete. The count of hands is part of the report.',
                'A finished job is not necessarily a job finished on the original terms.',
                'The output total and the labour total belong in the same report.',
                'The Hive moved quickly. The register is still catching up.',
            ],
            reactions: [
                'Adequate is not the same as cost-free.',
                'The work was completed. The question is who absorbed the extra shift.',
                'The report counts finished units. It does not count fatigue.',
                'The total is correct under the revised definition.',
                'Yes, on time. Not under the original timetable.',
            ],
            closers: [
                'The work is finished. The account should be complete as well.',
                'That is the count under the current register.',
                'The timetable was met under the terms now on record.',
                'The report is filed. Corrections remain possible.',
            ],
            asks: [
                'How many hands were added to the original shift?',
                'Was the timetable revised before or after the delay?',
                'What does the count include?',
                'How much work remains outside the report?',
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
     * The daytime Hale/Varr pair has multiple exchanges in both directions,
     * with optional follow-through so the director can vary the beat length.
     * Secondary pairs have their own smaller, voice-specific exchanges.
     */
    const RELATIONSHIPS = [
        // Commander Hale and Varr: measured standards versus a ruthless eye for omissions.
        {
            from: 'human', to: 'mrrshan_f', stance: 'forensic',
            jab: 'Varr, can we separate the cost from the speculation?',
            reply: 'Certainly. The cost is missing; the speculation is all we have left.',
            follow: 'A missing figure is not proof of a hidden one.',
            close: 'No, but it is a reason to ask why it is missing.',
        },
        {
            from: 'human', to: 'mrrshan_f', stance: 'wry',
            jab: 'You have been waiting to say that since the briefing began.',
            reply: 'No. I had a better version, but you gave me less room.',
            follow: 'We are on air, Varr.',
            close: 'I know. That was the edited version.',
        },
        {
            from: 'human', to: 'mrrshan_f', stance: 'challenging',
            jab: 'Do you have evidence for that, or just a good line?',
            reply: 'The evidence is the hole where the figures should be.',
            follow: 'Absence is not evidence on its own.',
            close: 'No. But it is where the questions start.',
        },
        {
            from: 'human', to: 'mrrshan_f', stance: 'patient',
            jab: 'Could we let them finish before we decide what they meant?',
            reply: 'They finished. That was the problem.',
            follow: 'That is an interpretation.',
            close: 'It is the interpretation they left us to work with.',
        },
        {
            from: 'human', to: 'mrrshan_f', stance: 'careful',
            jab: 'You are suggesting the wording was deliberate.',
            reply: 'I am suggesting words do not choose themselves.',
            follow: 'Intent still needs to be established.',
            close: 'Then ask who approved the final draft.',
        },
        {
            from: 'human', to: 'mrrshan_f', stance: 'wry',
            jab: 'You make every proposal sound expensive.',
            reply: 'Only the ones that are.',
            follow: 'We have not seen the full estimate.',
            close: 'Neither has whoever has to pay.',
        },
        {
            from: 'mrrshan_f', to: 'human', stance: 'forensic',
            jab: 'Commander, you keep treating the release like the minutes.',
            reply: 'It is the only account we can attribute and verify.',
            follow: 'Verified text is not verified history.',
            close: 'Which is why I keep asking for the records.',
        },
        {
            from: 'mrrshan_f', to: 'human', stance: 'impatient',
            jab: 'You are waiting for someone to admit the obvious.',
            reply: 'I am waiting for evidence that makes it obvious.',
            follow: 'How much evidence does it take to ask a sharper question?',
            close: 'A question, yes. A verdict, not yet.',
        },
        {
            from: 'mrrshan_f', to: 'human', stance: 'dry',
            jab: 'You could say “we do not know” and save us both a paragraph.',
            reply: 'We do not know. We do know what has been withheld.',
            follow: 'Now that is a useful distinction.',
            close: 'It is the distinction we should have started with.',
        },
        {
            from: 'mrrshan_f', to: 'human', stance: 'wary',
            jab: 'You always find a reason to give the statement one more day.',
            reply: 'I give the evidence one more day.',
            follow: 'And the people making the statement?',
            close: 'They do not get to set the deadline.',
        },
        {
            from: 'mrrshan_f', to: 'human', stance: 'wry',
            jab: 'You have a talent for making a delay sound deliberate.',
            reply: 'You have a talent for making a delay sound criminal.',
            follow: 'One of those descriptions has a record of being right.',
            close: 'And the other has a record of needing a retraction.',
        },
        {
            from: 'mrrshan_f', to: 'human', stance: 'teasing',
            jab: 'Would you like the official version, or the useful one?',
            reply: 'The accurate one, if available.',
            follow: 'That is a high bar for a press release.',
            close: 'It is the bar we are paid to keep.',
        },

        // Hale and Unit 7: judgement against an archive that mistakes records for reality.
        {
            from: 'human', to: 'robot', stance: 'practical',
            jab: 'You have the old filings. Do any of them explain what happened?',
            reply: 'They establish what was recorded. The distinction appears relevant again.',
            follow: 'I asked what happened, not what somebody typed.',
            close: 'Then this unit requires a source outside the archive.',
        },
        {
            from: 'robot', to: 'human', stance: 'literal',
            jab: 'Commander, your summary omits the only verified figure.',
            reply: 'Because the figure answers a different question.',
            follow: 'The figure is nevertheless correct.',
            close: 'Correct is not the same as relevant. We will keep both on record.',
        },
        {
            from: 'robot', to: 'human', stance: 'pedantic',
            jab: 'The record does not support the word “confirmed.”',
            reply: 'Then we will say “reported” until it does.',
            follow: 'Terminology adjusted. Confidence unchanged.',
            close: 'For once, we agree on the wording.',
        },

        // Rell and Varr: his spreadsheets, her carefully limited encouragement.
        {
            from: 'mrrshan', to: 'mrrshan_f', stance: 'admiring',
            jab: 'Varr found the weakness in the estimate before I finished the table.',
            reply: 'You left the shipping costs in a footnote.',
            follow: 'They were a very small footnote.',
            close: 'They were the entire margin, Rell.',
        },
        {
            from: 'mrrshan_f', to: 'mrrshan', stance: 'practical',
            jab: 'Rell has the freight numbers, if anyone wants the optimistic version corrected.',
            reply: 'I have the numbers. The optimistic version is already incorrect.',
            follow: 'There. That is why I ask him.',
            close: 'You ask for the numbers. You rarely enjoy them.',
        },
        {
            from: 'mrrshan', to: 'mrrshan_f', stance: 'hopeful',
            jab: 'Varr, I ran the second scenario as well. It is considerably worse.',
            reply: 'You sound pleased to have a reason to come back.',
            follow: 'I am pleased the model caught it before the market did.',
            close: 'Good. Keep that version away from the sales desk.',
        },

        // Grolm and Oth: field counts versus the mechanism behind them.
        {
            from: 'bulrathi', to: 'psilon', stance: 'impatient',
            jab: 'Give me the number first. I can survive the explanation afterward.',
            reply: 'The number changes depending on what you count.',
            follow: 'Then tell me what you counted.',
            close: 'That is the first useful question you have asked.',
        },
        {
            from: 'psilon', to: 'bulrathi', stance: 'patient',
            jab: 'Grolm wants a count before we agree what qualifies as a unit.',
            reply: 'The ships will not wait for a seminar.',
            follow: 'Nor will a poor definition improve your deployment map.',
            close: 'Fine. Give me the definition in one sentence.',
        },

        // The Analyst and Hale: implication versus what can be put on the record.
        {
            from: 'darlok', to: 'human', stance: 'needling',
            jab: 'The approved wording is more careful than the first account, Commander.',
            reply: 'A shorter statement is not proof of a cover-up.',
            follow: 'No. The removed passage is the reason to ask for the draft.',
            close: 'Then we will ask for it, and say plainly that we have not seen it.',
        },
        {
            from: 'darlok', to: 'human', stance: 'insinuating',
            jab: 'The timing benefits one party rather neatly.',
            reply: 'A benefit is not proof that they arranged it.',
            follow: 'I did not say they arranged it. I said the timing benefits them.',
            close: 'Then we have a lead to examine, not a conclusion to announce.',
        },

        // Quarry and Hive-Liaison: a long view versus a finished job.
        {
            from: 'silicoid', to: 'klackon', stance: 'slow',
            jab: 'The Hive has finished the work. The site will be recovering long after the report is filed.',
            reply: 'The report measures completion, not eternity.',
            follow: 'Then it has measured less than it claims.',
            close: 'It claims completion. It does not claim forever.',
        },
        {
            from: 'klackon', to: 'silicoid', stance: 'brisk',
            jab: 'Quarry wants another survey before we sign off the work.',
            reply: 'I want a survey before you call the damage temporary.',
            follow: 'The task is complete under the agreed criteria.',
            close: 'Then the criteria should say who agreed to them.',
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