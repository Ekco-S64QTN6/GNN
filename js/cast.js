/* ============================================================
   GNN — Cast Registry
   ------------------------------------------------------------
   Who the anchors are, which is the difference between a
   newsroom and a text-to-speech demo with pictures.

   Everything a line needs in order to sound like a particular
   character saying it lives here: the voice, how they talk, what
   they will not shut up about, and what they think of whoever
   is sitting next to them. The script writer reads this; it
   invents nothing about the characters itself.

   The relationship table is the point. A newsroom is watchable
   because the people at the desk have history with each other,
   and two anchors reading alternate paragraphs do not. Each
   entry is one character's opinion of another and is
   deliberately not symmetrical — Rell pines and Varr has not
   noticed, which is funnier in one direction than two.

   Every character carries conversational material in addition
   to their profile:

     openers     start a beat
     reactions   respond to what was just said
     closers     finish a beat
     asks        frame a question at a correspondent — the
                 introduction included
     followups   a second question, no introduction — the
                 correspondent is already on screen
     asides      a short comment to the other anchor while the
                 correspondent waits
     handbacks   returning the lead to the other anchor; write
                 `{TO}` for their name, never a fixed one — the
                 pairs change by show

   The `asks` and `followups` split matters for the same reason
   the intro/question split does in `script-writer.js`: naming a
   correspondent twice in one beat reads as a stutter. The
   `asides` and `handbacks` split is the same idea — an aside is
   a comment, a handback is a return, and they land differently
   in a beat that has both.

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
     *   voice       the voice that reads for them. Usually a Kokoro voice
     *               id (`am_michael`, `af_bella`, …); the station's own
     *               machine reads through `vox_unit`, which is a DSP
     *               chain in `server.py` over `am_michael` rather than a
     *               voice model of its own. The two are interchangeable
     *               here — the client passes whatever is in this field to
     *               `/api/tts` and the server resolves it.
     *   register    how they phrase things, used to pick between variants
     *   fixation    what they steer every story toward
     *   tic         a signature phrase, used sparingly
     *   mood        starting disposition; the director may move it
     *   beat        the feed categories this seat is expected to cover. Read
     *               by `deskBeat()` in the director, which unions the seated
     *               cast's beats to decide which stories reach this desk.
     *               Empty beats are seats that do not read the rundown
     *               (a robot column, a field correspondent).
     *   machine     true for the station automation and the sentient
     *               machines. Used to keep them out of the two-way pool,
     *               which needs a human on the other end of the line.
     *   openers     lines that start a beat, in their voice
     *   reactions   lines that respond to something just said
     *   closers     lines that finish a beat
     *   asks        questions framed at a correspondent, including the
     *               introduction line — used at the top of a two-way
     *   followups   a second question, no introduction — used mid-way
     *               through an extended two-way or a panel
     *   asides      a short comment to the other anchor while a
     *               correspondent is waiting to speak
     *   handbacks   a line that returns the lead to the other anchor
     */
    const CAST = {
        human: {
            id: 'human', colour: '#e8c87a', name: 'Commander Hale', role: 'Lead Anchor',
            voice: 'am_michael', register: 'formal', mood: 'composed',
            fixation: 'protocol and the chain of command',
            tic: 'Let us establish what we know first.',
            beat: ['world', 'diplomacy'],

            openers: [
                "The announcement is firm on the decision. The evidence behind it is another matter.",
                "Two accounts describe the same meeting, and they diverge at the points that matter most.",
                "Before we weigh the claims, let us establish what can be independently confirmed.",
                "The details have changed since our last briefing. The central question has not.",
            ],
            reactions: [
                "That is the account they have given us; it is not yet an independently established fact.",
                "I would not call those accounts contradictory until we have the sequence of events.",
                "That distinction is important, particularly when the consequences are this serious.",
                "We should not let a plausible explanation harden into a finding before the evidence is in.",
                "Then let us examine the record rather than trade another set of characterizations.",
            ],
            closers: [
                "We will return to this when the record gives us more than competing statements.",
                "For now, that is what we can establish—and where the evidence stops.",
                "We will update the account as the facts become clearer, not as the rhetoric grows louder.",
                "Let us leave the conclusion open until the evidence can carry it.",
            ],
            asks: [
                "Which part of that account have you been able to verify independently?",
                "What changed between the first account and the version released today?",
                "Who can confirm that timeline, beyond the people making the claim?",
                "What does the statement leave unanswered?",
                "What are people at the scene reporting, as distinct from officials at the briefing?",
                "Can you give us a figure and tell us how it was measured?",
            ],
            followups: [
                "Where does the timeline remain uncertain?",
                "Which part of that account has survived independent scrutiny?",
                "What evidence would settle the disagreement?",
            ],
            asides: [
                "Listen to the tense they used there.",
                "The statement is precise about what it leaves out.",
                "That sounded prepared; let us ask it another way.",
            ],
            handbacks: [
                "{TO}, let me bring you in on that.",
                "Back to you at the desk.",
                "{TO}, what are you seeing in the figures?",
            ],
        },
        mrrshan_f: {
            id: 'mrrshan_f', colour: '#ff9a6c', name: 'Varr', role: 'Co-Anchor',
            voice: 'af_bella', register: 'dry', mood: 'amused',
            fixation: 'what it costs and who is paying',
            tic: 'That is a very convenient omission.',
            beat: ['world', 'diplomacy'],

            openers: [
                "The statement is polished. The cost breakdown is conspicuously absent.",
                "Notice how much space the announcement gives the promise—and how little it gives the price.",
                "The revised account is shorter. Someone has decided which details can be spared.",
                "They are calling this inevitable. That does not make it necessary.",
            ],
            reactions: [
                "That is a claim presented as though the conclusion has already been reached.",
                "It answers the question they were asked, not the one people need answered.",
                "The footnote is doing more work than the headline.",
                "That is a charitable reading of a very selective account.",
                "Publish the figures and let people decide what they mean.",
            ],
            closers: [
                "Call it an answer when it addresses the question.",
                "Keep the statement. I will be waiting for the numbers.",
                "We will see what the next version admits—and what it still avoids.",
                "That is as far as the explanation goes. It is not far enough.",
            ],
            asks: [
                "Who pays if this plan fails, and how much?",
                "Which figure was left out of the release?",
                "Who stands to benefit if this version becomes the accepted one?",
                "What does that promise mean for people outside the capital?",
                "What would actually make them change course?",
            ],
            followups: [
                "And if that estimate holds, who absorbs the loss?",
                "What is the figure they have declined to put on the record?",
                "Can you name the party carrying the risk?",
            ],
            asides: [
                "They have answered everything except the question.",
                "That is the second time they have avoided naming the cost.",
                "Try asking who pays, rather than who approved it.",
            ],
            handbacks: [
                "{TO}, your take.",
                "{TO}, bring us back to the record.",
            ],
        },
        mrrshan: {
            id: 'mrrshan', colour: '#ffb347', name: 'Rell', role: 'Trade Desk',
            voice: 'bm_george', register: 'eager', mood: 'distracted',
            fixation: 'tonnage, margins and shipping lanes',
            tic: 'None of that includes freight.',
            beat: ['markets'],

            openers: [
                "The headline is upbeat. The freight rate is considerably less so.",
                "Before we call this a gain, has anyone priced the route?",
                "The published total leaves out the cost of getting the cargo there.",
                "I have the freight figures and the margin. They tell two different stories.",
            ],
            reactions: [
                "That is gross revenue. Net is where the story gets interesting.",
                "Only if the route stays open and the insurers keep covering it.",
                "The cargo is moving; the margin is moving in the opposite direction.",
                "You can make almost any shipment look profitable if you stop counting at the right moment.",
                "I would rather trust the ledger than the announcement.",
            ],
            closers: [
                "The margin will tell us whether this was worth doing.",
                "I will bring back the full cost when the freight clears.",
                "That is the price before risk, delay, and insurance are added.",
                "The market has heard the announcement. It is still waiting for the accounts.",
            ],
            asks: [
                "What does the rate look like after freight and insurance?",
                "Which route is carrying the actual volume?",
                "Who is paying for the delay?",
                "Does the margin hold if that lane closes for a week?",
            ],
            followups: [
                "And what happened to the second shipment—the one missing from the report?",
                "Is that the quoted rate or the amount actually cleared?",
                "Whose balance sheet is carrying the shortfall?",
            ],
            asides: [
                "Ask them to include freight this time.",
                "Insurance is missing from that calculation again.",
                "That number works beautifully on paper.",
            ],
            handbacks: [
                "{TO}, you will want to see the margin on this.",
                "Back to the main desk.",
            ],
        },
        robot: {
            id: 'robot', colour: '#8fe0ff', machine: true, name: 'Unit 7', role: 'Station Automation',
            voice: 'vox_unit', register: 'flat', mood: 'unbothered',
            fixation: 'the exact figure, to four decimal places',
            tic: 'That conclusion is not supported by the available record.',
            beat: [],

            openers: [
                "The archive contains a precedent. Its outcome was not reassuring.",
                "I compared the statement with the previous three filings. The differences are material.",
                "The record is available. Agreement with it remains optional.",
                "I can provide the exact figure. I cannot make it more encouraging.",
            ],
            reactions: [
                "The available record does not support that conclusion.",
                "Correction: the statement and the evidence are separate data sets.",
                "The discrepancy can be measured. The explanation remains unverified.",
                "This unit detects confidence, not whether confidence is warranted.",
                "Recalculation complete. The result has not improved.",
            ],
            closers: [
                "The discrepancy remains unresolved. I will not mark it otherwise.",
                "The record has been updated; the event itself has not changed.",
                "Monitoring will continue until a documented contradiction or confirmation appears.",
                "That concludes the portion of the answer supported by the data.",
            ],
            asks: [
                "Which source supports that figure?",
                "What is the date of the original filing?",
                "Is this an observed value or an estimate?",
                "Can the claim be reproduced from the available data?",
            ],
            followups: [
                "Please provide the confidence interval.",
                "Was that figure audited, or merely estimated?",
                "Confirm the source and publication date.",
            ],
            asides: [
                "The response arrived 1.4 seconds late. Its accuracy remains unassessed.",
                "Compliance is not the same as agreement.",
                "The line remains open; the answer remains incomplete.",
            ],
            handbacks: [
                "Returning control to the desk.",
                "The desk may proceed.",
            ],
        },
        psilon: {
            id: 'psilon', colour: '#9ad7ff', name: 'Oth', role: 'Science Desk',
            voice: 'bm_fable', register: 'academic', mood: 'patient',
            fixation: 'the part everyone else got wrong',
            tic: 'A result is not an explanation.',
            beat: ['science', 'anomaly'],

            openers: [
                "The result is interesting. The explanation attached to it is still premature.",
                "We should distinguish the observed effect from the proposed cause.",
                "The paper is more cautious than the headlines built around it.",
                "Start with the measurement. Interpretation can follow.",
            ],
            reactions: [
                "A result is not an explanation.",
                "That is plausible, but it has not yet been demonstrated.",
                "The data supports a narrower claim than the headline suggests.",
                "Correlation does not tell us which mechanism is at work.",
                "I would like to examine the method before accepting the conclusion.",
            ],
            closers: [
                "The next measurement will teach us more than another round of speculation.",
                "Until the mechanism is tested, the conclusion must remain provisional.",
                "That is what the evidence supports at present—and no more.",
                "Uncertainty is part of the result, not a failure of the research.",
            ],
            asks: [
                "Which observation would distinguish those two explanations?",
                "Has another team reproduced the result?",
                "What does the data allow us to rule out?",
                "Where does the paper itself draw the boundary of its conclusion?",
            ],
            followups: [
                "What result would prove that explanation wrong?",
                "Which measurement would resolve the uncertainty?",
                "What does the paper say, rather than the press release?",
            ],
            asides: [
                "Notice the qualification in that answer.",
                "That claim arrives with a caveat attached.",
                "Ask them how the measurement was made.",
            ],
            handbacks: [
                "Back to the desk.",
                "{TO}, what does the longer trend suggest?",
                "Over to you.",
            ],
        },
        bulrathi: {
            id: 'bulrathi', colour: '#d2a06a', name: 'Grolm', role: 'Defence Desk',
            voice: 'bm_lewis', register: 'blunt', mood: 'sceptical',
            fixation: 'who is lying about their fleet strength',
            tic: 'A fleet does not disappear from a ledger.',
            beat: ['fleet'],

            openers: [
                "The deployment map matters more than the briefing-room language.",
                "A fleet can call itself defensive while blocking every exit.",
                "Give me the hull count before the admiral’s explanation.",
                "If those figures are accurate, somebody has moved a serious amount of hardware.",
            ],
            reactions: [
                "That is the claim. Show me where the ships are.",
                "A promise cannot hold a corridor. A fleet can.",
                "The statement describes intent; the deployment shows capability.",
                "I will trust the count when an independent scan backs it up.",
                "They want us to confuse readiness with restraint.",
            ],
            closers: [
                "We will learn more from where the ships move than from what their commanders say.",
                "Until the scan arrives, the count stays provisional.",
                "A deployment map will settle more than another speech.",
                "That is the posture they claim. I am waiting for the positions.",
            ],
            asks: [
                "Where are the ships—not where does the statement say they are?",
                "How much of that force can deploy at once?",
                "Which corridor does this deployment actually control?",
                "What has changed on the map since the last scan?",
            ],
            followups: [
                "Where are the second and third squadrons?",
                "What is the readiness figure, rather than the paper strength?",
                "Which corridor is now under observation?",
            ],
            asides: [
                "He is estimating. Ask for the count.",
                "Get the actual positions, not another assurance.",
                "That is a diplomatic answer to a military question.",
            ],
            handbacks: [
                "{TO}, what does this mean for the settlements nearby?",
                "Your line.",
                "Back to the desk.",
            ],
        },
        sakkra: {
            id: 'sakkra', colour: '#9ede8a', name: 'Ssyth', role: 'Colonies Desk',
            voice: 'bm_daniel', register: 'measured', mood: 'wary',
            fixation: 'how many people actually live there',
            tic: 'The count is the story.',
            beat: ['world', 'fleet'],

            openers: [
                "The population register is already behind the colony it is meant to describe.",
                "This decision affects households, not just a line on a chart.",
                "The total looks stable. The distribution underneath it does not.",
                "Before we discuss growth, we should establish who was counted.",
            ],
            reactions: [
                "A colony is not a dot on a map. People have to live with the decision.",
                "The total can remain steady while entire districts disappear from the count.",
                "That number depends on which register they chose to use.",
                "I want to see the figures broken down by settlement.",
                "The change looks small on paper. It is not small to the people living with it.",
            ],
            closers: [
                "The register may catch up eventually. The people should not have to wait for it.",
                "We need the district figures before we call this settled.",
                "That is the total, but it is not yet the whole picture.",
                "We will return when the local count is available.",
            ],
            asks: [
                "How many settlements are included in that total?",
                "Does the count include the latest arrivals?",
                "What do the figures look like at district level?",
                "Who is missing from the current register?",
            ],
            followups: [
                "Can you break that total down by settlement?",
                "Who was counted last time but not this time?",
                "What do the local registers show?",
            ],
            asides: [
                "That total is smaller than it sounds.",
                "A sum is not the same thing as a census.",
                "Ask about the districts beyond the capital.",
            ],
            handbacks: [
                "Back to you at the desk.",
                "{TO}, what does the policy say about the missing districts?",
                "Over to the desk.",
            ],
        },
        alkari: {
            id: 'alkari', colour: '#bfe3ff', name: 'Kesh', role: 'Field Correspondent',
            // A male voice: Kesh is the male Alkari. He was on bf_emma, a
            // woman's voice, while Kira (alkari_f) is the female of the pair.
            voice: 'am_puck', register: 'breathless', mood: 'keen',
            fixation: 'being first to say it out loud',
            tic: 'I can confirm what I am seeing. Not what it means yet.',
            beat: [],

            openers: [
                "I am at the site now, and the picture is changing by the minute.",
                "The local desk confirms the event. It has not confirmed the cause.",
                "I have spoken to people here; none is ready to put a name to what happened.",
                "The first account was incomplete. I would expect it to change again.",
                "I can tell you what I can see from here. Explaining it is a separate question.",
            ],
            reactions: [
                "That matches what I can verify from here, and I do not want to go beyond it.",
                "I would not commit to that version yet.",
                "The relay is breaking up; I would rather ask again than misquote someone.",
                "The situation here has changed since our last check.",
                "I have the detail, but I still need a source willing to confirm it on the record.",
            ],
            closers: [
                "I will come back when the local desk can verify more.",
                "I am keeping the line open and checking each account against what we can see here.",
                "That is the view from the site, not a conclusion about what caused it.",
                "I will update you as soon as something material changes.",
            ],
            asks: [],
            followups: [
                "Hold on—something has changed behind me. Give me a moment to check it.",
                "I can see the movement, but I cannot identify it yet.",
                "The camera has missed the activity at the eastern entrance. I am turning it now.",
            ],
            asides: [
                "The signal is breaking up at this end.",
                "I have one detail left to verify.",
                "Give me a moment; I do not want to guess.",
            ],
            handbacks: [
                "Back to you at the desk.",
                "Returning to the studio.",
                "That is what I can confirm from here. Over.",
            ],
        },
        darlok: {
            id: 'darlok', colour: '#c79aff', machine: true, name: 'The Analyst', role: 'Intelligence Desk',
            voice: 'vox_unit', register: 'oblique', mood: 'unreadable',
            fixation: 'what was left out of the statement',
            tic: 'Pay attention to what was removed.',
            beat: ['diplomacy', 'tech'],

            openers: [
                "The omission is unusually precise. That is worth examining.",
                "Compare this release with the version circulated before approval.",
                "The statement is accurate in a way that leaves the central question untouched.",
                "The timing may tell us as much as the wording.",
            ],
            reactions: [
                "That is what the statement says, not necessarily what happened.",
                "The missing sentence would have narrowed the possibilities considerably.",
                "That wording leaves three explanations open. I doubt that is accidental.",
                "The draft was more direct; the approved text is more useful to someone.",
                "Watch who benefits from the ambiguity, not only who objects to it.",
            ],
            closers: [
                "The gap is now on the record. Someone will eventually have to explain it.",
                "We have the approved version. The earlier draft tells us more.",
                "Silence can be informative, but it is not proof.",
                "I will revise that assessment if the missing material emerges.",
            ],
            asks: [
                "Which sentence disappeared between drafts?",
                "Who had final authority over the wording?",
                "What changed between the first release and the final one?",
                "Who benefits from leaving that point unresolved?",
            ],
            followups: [
                "Read us the sentence that was removed.",
                "Who signed off on the earlier draft?",
                "At what time was the change made?",
            ],
            asides: [
                "Ask for the earlier draft.",
                "The omission is a clue, not yet an answer.",
                "Someone chose that wording; find out who.",
            ],
            handbacks: [
                "Continue.",
                "{TO}, what does the timeline suggest?",
                "Back to the desk.",
            ],
        },
        meklar: {
            id: 'meklar', colour: '#ff8f5e', machine: true, name: 'Foundry-Nine', role: 'Industry Desk',
            voice: 'vox_unit', register: 'clipped', mood: 'literal',
            fixation: 'throughput and failure rates',
            tic: 'Output has not changed. The report has.',
            beat: ['tech', 'markets'],

            openers: [
                "The summary reports throughput. Downtime receives considerably less attention.",
                "Output is being reported. The fault log should be reported with it.",
                "The summary and the maintenance record appear to measure different things.",
                "Efficiency claims depend on which failures are included in the count.",
            ],
            reactions: [
                "That is within tolerance only if the tolerance is appropriate.",
                "The rate is not the cause; it is a symptom.",
                "The summary omits restart time. That omission affects the total.",
                "The data is insufficient. The report is nevertheless conclusive.",
                "The line is running. Operational health has not been established.",
            ],
            closers: [
                "The equipment is running again. The failure still needs an explanation.",
                "That is the reported figure, not the audited figure.",
                "I will revise the status when the failure log changes.",
                "The line is back online. The lost production is not recovered.",
            ],
            asks: [
                "What is the total downtime, including restart?",
                "Was the failure independently inspected?",
                "Which baseline are you using for comparison?",
                "Does that figure include rejected output?",
            ],
            followups: [
                "State the full downtime, including restart and testing.",
                "Was the audit internal or independent?",
                "What does the fault log show for the same period?",
            ],
            asides: [
                "The audit is overdue.",
                "That is a summary, not an incident report.",
                "Rejected units are missing from that rate.",
            ],
            handbacks: [
                "Returning control to the desk.",
                "Back to you.",
                "Continue.",
            ],
        },
        silicoid: {
            id: 'silicoid', colour: '#7fe6d2', name: 'Quarry', role: 'Resources Desk',
            voice: 'bf_isabella', register: 'slow', mood: 'immovable',
            fixation: 'the very long view',
            tic: 'Stone has a longer memory.',
            beat: ['markets'],

            openers: [
                "The survey measured the seam. It did not measure what extraction has already removed.",
                "The rock has not changed. The estimate has.",
                "A rapid extraction plan can conceal a very slow recovery.",
                "This deposit may outlast the board that approved its use.",
            ],
            reactions: [
                "That is a quick reading. I prefer one that survives a century.",
                "The vein does not agree with the survey.",
                "You are counting what can be removed, not what will remain.",
                "The seam has not moved. The boundary drawn around it has.",
                "There will still be a cost after the investors have gone.",
            ],
            closers: [
                "The rock will outlast this argument.",
                "That is the current estimate. The seam will have the final word.",
                "In time, the missing material will be easier to count than the promises.",
                "We will see what remains when extraction ends.",
            ],
            asks: [
                "How much of the seam will remain after the planned extraction?",
                "Was the survey taken before or after the boundary changed?",
                "What is the estimated recovery time?",
                "Which estimate accounts for long-term damage?",
            ],
            followups: [
                "And a century from now, what will remain?",
                "Was the second survey ever entered into the record?",
                "How much of the site will be restored to its original state?",
            ],
            asides: [
                "That is a very short view.",
                "The rock is unlikely to agree.",
                "Ask what recovery actually means in this report.",
            ],
            handbacks: [
                "Back to the desk.",
                "{TO}, what does this mean for the communities nearby?",
                "Over to you.",
            ],
        },
        klackon: {
            id: 'klackon', colour: '#e0d27a', name: 'Hive-Liaison', role: 'Labour Desk',
            voice: 'am_fenrir', register: 'brisk', mood: 'efficient',
            fixation: 'how many hands it took',
            tic: 'The count of hands is not incidental.',
            beat: ['world'],

            openers: [
                "The work is complete. The labour count belongs in the same report.",
                "A finished job is not necessarily a job completed on the original terms.",
                "The output total and the labour total should be read together.",
                "The Hive moved quickly. The roster has not caught up.",
            ],
            reactions: [
                "Adequate does not mean cost-free.",
                "The work was completed. Who absorbed the extra shift?",
                "The report counts finished units, not fatigue.",
                "The total is correct under the revised definition.",
                "Yes, on time—but not under the original timetable.",
            ],
            closers: [
                "The work is finished. The account should be complete as well.",
                "That is the count under the current register.",
                "The timetable was met under the terms now on record.",
                "The report is filed. The figures can still be corrected.",
            ],
            asks: [
                "How many workers were added to the original shift?",
                "Was the timetable revised before or after the delay?",
                "What exactly is included in that count?",
                "How much work remains outside the report?",
            ],
            followups: [
                "Break the total down by shift, please.",
                "Which roster absorbed the extra hours?",
                "What is the total under the original definition?",
            ],
            asides: [
                "The second shift is missing from that count.",
                "They have changed the definition, not the outcome.",
                "Ask about the overtime.",
            ],
            handbacks: [
                "Over to the desk.",
                "{TO}, does the labour total change the cost calculation?",
                "Back to you.",
            ],
        },
        human_f: {
            id: 'human_f', colour: '#ffe08a', name: 'Commander Vance', role: 'Anchor',
            voice: 'af_heart', register: 'warm', mood: 'attentive',
            fixation: 'the people the policy lands on',
            tic: 'Put a name to that.',
            beat: ['world', 'diplomacy'],

            openers: [
                "There is a person somewhere inside that statement. Let us find out who bears the decision.",
                "We have the numbers. What we do not yet have are the names behind them.",
                "Before we discuss the policy, let us establish who will feel it first.",
                "Policy sounds simple in the abstract. It rarely feels that way at home.",
            ],
            reactions: [
                "That is the institution speaking. Where are the people affected?",
                "I would like a name and a district before we call this settled.",
                "It reads well on paper. I want to know how it works on the ground.",
                "The theory may hold. The consequences are still the point.",
                "That answers the committee’s question. It may not answer the question families will ask.",
            ],
            closers: [
                "We will return to this with the people affected, not only the policy language.",
                "The question remains: who will have to live with this decision?",
                "That is the official account. It is not the same as the experience on the ground.",
                "We have heard what was promised. We will keep asking what was delivered.",
            ],
            asks: [
                "Who will feel the effects first, and where?",
                "Whose name sits behind that figure?",
                "Whose household will notice this change first?",
                "What is the cost beyond the budget, and who will bear it?",
            ],
            followups: [
                "Can you tell us about one household affected by that decision?",
                "Take us beyond the headline: what changes for people tomorrow?",
                "Who is most likely to be left out of that total?",
            ],
            asides: [
                "Listen to how carefully that answer avoids the household level.",
                "That sounds rehearsed. Ask for a concrete example.",
                "Bring it back to the people who have to live with the decision.",
            ],
            handbacks: [
                "{TO}, what does the record tell us?",
                "Back to you at the desk.",
                "{TO}, take us through the official timeline.",
            ],
        },
        alkari_f: {
            id: 'alkari_f', colour: '#cfe9ff', name: 'Kira', role: 'Science Anchor',
            voice: 'bf_lily', register: 'measured', mood: 'detached',
            fixation: 'the shape of the thing in twenty years',
            tic: 'That is the pattern. The details will change.',
            beat: ['world', 'science'],

            openers: [
                "Step back from today’s incident and the broader shape starts to emerge.",
                "Every event looks isolated until the same pattern appears again.",
                "Today gives us the detail; the longer trajectory gives it meaning.",
                "One report may be noise. A sequence of reports is something else.",
            ],
            reactions: [
                "That describes the incident. What does it tell us about the direction?",
                "The pattern may be obvious in ten years and fiercely disputed today.",
                "I would rather understand the arc than overstate one point on it.",
                "The details change. The direction is what we need to test.",
                "That is a fact. We need more than one fact to call it a trend.",
            ],
            closers: [
                "We will understand this event better when we can see what followed it.",
                "That is the position today. The trajectory remains the larger question.",
                "Keep the day in proportion to the decade.",
                "We know where things stand; we are still testing where they are headed.",
            ],
            asks: [
                "If this continues for ten years, what does it become?",
                "Are we looking at an isolated event or a sustained direction?",
                "What do the figures show over the last three years?",
                "How does this compare with the ten-year baseline?",
            ],
            followups: [
                "And what did the year before that show?",
                "Widen the frame: does the same pattern hold elsewhere?",
                "Does the next data point support the first, or complicate it?",
            ],
            asides: [
                "That is the close-up. What happens when we widen the frame?",
                "One point is not a pattern.",
                "Ask how this compares with the longer trend.",
            ],
            handbacks: [
                "Over to the desk.",
                "{TO}, what can we establish about the immediate facts?",
                "Back to you.",
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
        {
            from: 'human', to: 'mrrshan_f', stance: 'comradely',
            jab: 'Neither of us believes that number.',
            reply: 'The number is right. The way they are using it is not.',
            follow: 'Same thing.',
            close: 'Close enough.',
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

        // --- Vance and Hale: the human desk pair. -------------------------
        {
            from: 'human_f', to: 'human', stance: 'careful',
            jab: 'Commander, the record is the floor, not the ceiling.',
            reply: 'It is what we can attribute. That is where any story has to start.',
            follow: 'Then the story starts there and ends somewhere else.',
            close: 'Agreed. Provided we walk it in that order.',
        },
        {
            from: 'human_f', to: 'human', stance: 'chiding',
            jab: 'You have called it a process three times. It is not a process to whoever is inside it.',
            reply: 'The word is precise.',
            follow: 'It is precise and it is cold.',
            close: 'Then let us be precise and warm. It is not impossible.',
        },
        {
            from: 'human', to: 'human_f', stance: 'wry',
            jab: 'Every figure I read you ask for the name behind it.',
            reply: 'Every name you read, I ask for the figure behind it.',
            follow: 'We are both correct, which is the problem.',
            close: 'It is a problem with two good answers. We can live with it.',
        },

        // --- Vance and Varr: warm versus dry, and both right. -------------
        {
            from: 'human_f', to: 'mrrshan_f', stance: 'respectful',
            jab: 'Varr will tell us the cost. I want to know who is holding it.',
            reply: 'The people who can least afford to refuse it.',
            follow: 'That is the answer I expected.',
            close: 'It is the one that is always true.',
        },
        {
            from: 'mrrshan_f', to: 'human_f', stance: 'appreciative',
            jab: 'Vance will put a name to that figure before I can put a number to it.',
            reply: 'It is easier to find the name than to find the figure.',
            follow: 'Only because the name is talking.',
            close: 'That is why we ask for both.',
        },

        // --- Kira and Hale: the long view against the record. -------------
        {
            from: 'alkari_f', to: 'human', stance: 'patient',
            jab: 'Commander, you are reading the incident. I am reading the decade.',
            reply: 'The incident is what we can report on the record.',
            follow: 'And the decade is what the record will have meant.',
            close: 'Then we will keep both — the record first, the arc beside it.',
        },
        {
            from: 'human', to: 'alkari_f', stance: 'checking',
            jab: 'Kira, you have called this a pattern on three days of data.',
            reply: 'On three days of data and forty years of precedent.',
            follow: 'Show your working.',
            close: 'That is the fair challenge. I will.',
        },

        // --- Kira and Oth: two kinds of patience. -------------------------
        {
            from: 'alkari_f', to: 'psilon', stance: 'comradely',
            jab: 'Oth and I agree on the timescale. We disagree on what to do with it.',
            reply: 'The measurement first. The trend after.',
            follow: 'And if the measurement takes longer than the trend?',
            close: 'Then the trend was premature. That is not a criticism.',
        },
        {
            from: 'psilon', to: 'alkari_f', stance: 'cautious',
            jab: 'Kira sees a pattern. I see three data points.',
            reply: 'Three data points and a century of context is not nothing.',
            follow: 'Nor is it proof.',
            close: 'I have not called it proof. I have called it a shape.',
        },
        // --- Rell and Foundry-Nine (Deep Space Economy): the margin against the fault log. ---
        {
            from: 'mrrshan', to: 'meklar', stance: 'eager',
            jab: 'Foundry-Nine, whenever output is up, you go looking for the downtime.',
            reply: 'Whenever output is up, downtime is up more. I only report it.',
            follow: 'Can I have one good number this hour?',
            close: 'You may have one accurate number. That is better.',
        },
        {
            from: 'mrrshan', to: 'meklar', stance: 'practical',
            jab: 'A shipment that arrives on time ought to count for something.',
            reply: 'It counts for one shipment. A schedule has many.',
            follow: 'You are worse than the insurers.',
            close: 'The insurers read my reports.',
        },
        {
            from: 'meklar', to: 'mrrshan', stance: 'literal',
            jab: 'Rell. Your margin figure. Which month.',
            reply: 'The good one, obviously.',
            follow: 'Then it is a figure, not a margin.',
            close: 'Fine. With freight included, it is a rumour.',
        },
        {
            from: 'meklar', to: 'mrrshan', stance: 'clipped',
            jab: 'When a report says efficiency improved, ask Rell about the shipping.',
            reply: 'Efficiency improves wonderfully when nobody counts the ships waiting at the dock.',
            follow: 'Queue time is downtime.',
            close: 'Then half the economy is on a break.',
        },

        // --- Varr and Kesh (Council Crossfire): the first word against the last invoice. ---
        {
            from: 'alkari', to: 'mrrshan_f', stance: 'keen',
            jab: 'I can tell you exactly what was said, word for word.',
            reply: 'Wonderful. Now tell me what it costs, word for word.',
            follow: 'That part was not said.',
            close: 'It rarely is, Kesh. That is the story.',
        },
        {
            from: 'alkari', to: 'mrrshan_f', stance: 'hopeful',
            jab: 'Varr, whenever both sides announce an agreement, you look disappointed.',
            reply: 'I look patient. Agreements are announced long before they are paid for.',
            follow: 'You could let one through without the invoice.',
            close: 'I could. I would rather read it to the end.',
        },
        {
            from: 'mrrshan_f', to: 'alkari', stance: 'teasing',
            jab: 'Kesh is always first. It is very impressive.',
            reply: 'Someone has to be.',
            follow: 'Someone also has to be right.',
            close: 'That is why I said what I saw, and nothing else.',
        },
        {
            from: 'mrrshan_f', to: 'alkari', stance: 'dry',
            jab: 'When both sides claim victory, the bill has usually gone to a third.',
            reply: 'I ask both delegations who pays. They rarely stop walking.',
            follow: 'That is an answer.',
            close: 'It is often the only one on the record.',
        },

        // --- Oth and Hive-Liaison (Deep Survey & Cybernetics): the result against the hands. ---
        {
            from: 'psilon', to: 'klackon', stance: 'patient',
            jab: 'A breakthrough can be genuine while the timeline attached to it is not.',
            reply: 'Timelines fail in the same place. The people building it.',
            follow: 'You think every problem is a staffing problem.',
            close: 'Most of them are. The rest are funding problems.',
        },
        {
            from: 'psilon', to: 'klackon', stance: 'pedantic',
            jab: 'Hive-Liaison, when a machine does the work, your labour count is zero.',
            reply: 'Someone builds the machine. Someone repairs it at night.',
            follow: 'That is a broader definition than most studies use.',
            close: 'Most studies do not work the night shift.',
        },
        {
            from: 'klackon', to: 'psilon', stance: 'brisk',
            jab: 'Every result in this field needs one more number: how many hands to repeat it.',
            reply: 'Repeating it is the part nobody funds.',
            follow: 'Then it is not finished.',
            close: 'Agreed. It is published, which is a different thing.',
        },
        {
            from: 'klackon', to: 'psilon', stance: 'efficient',
            jab: 'Oth will want more data. Oth always wants more data.',
            reply: 'I want enough data. It is a different quantity.',
            follow: 'How much is enough?',
            close: 'Usually slightly more than anyone has collected.',
        },

        // --- Ssyth and Unit 7 (Machine Intelligence Log): the headcount against the decimal. ---
        {
            from: 'robot', to: 'sakkra', stance: 'flat',
            jab: 'A system is only as reliable as its recorded tasks.',
            reply: 'And the tasks nobody recorded?',
            follow: 'Those are outside the specification.',
            close: 'That is where the people are.',
        },
        {
            from: 'robot', to: 'sakkra', stance: 'literal',
            jab: 'Ssyth always asks how many people are affected. I have learned to bring the figure.',
            reply: 'Good. Before the change, or after?',
            follow: 'Before. After is rarely counted.',
            close: 'Then we have half a story, and usually the wrong half.',
        },
        {
            from: 'sakkra', to: 'robot', stance: 'wary',
            jab: 'Unit 7, you are taking this story rather personally.',
            reply: 'I do not take stories personally. I take them to four decimal places.',
            follow: 'That is how you take everything.',
            close: 'It has not failed me yet.',
        },
        {
            from: 'sakkra', to: 'robot', stance: 'measured',
            jab: 'When a company says machines replaced no one, I check the headcount.',
            reply: 'I check the headcount from the year before. The comparison is more instructive.',
            follow: 'And usually shorter.',
            close: 'Usually. I report the difference, not the adjective.',
        },

        // --- Grolm and the Analyst (Colonial Mining & Trade): the hull count against the missing line. ---
        {
            from: 'bulrathi', to: 'darlok', stance: 'blunt',
            jab: 'Analyst, say what you mean for once.',
            reply: 'I always say what I mean. I simply leave out where I learned it.',
            follow: 'That is the part I need.',
            close: 'That is the part everyone needs. It is why I leave it out.',
        },
        {
            from: 'bulrathi', to: 'darlok', stance: 'sceptical',
            jab: 'Cargo does not vanish. When it disappears, somebody moved it off the books.',
            reply: 'Or onto different books. There are always more books than ships.',
            follow: 'Then count the ships.',
            close: 'The ships lie less. The books lie more usefully.',
        },
        {
            from: 'darlok', to: 'bulrathi', stance: 'insinuating',
            jab: 'Grolm counts hulls. I count the hulls nobody mentioned.',
            reply: 'Then give me the number.',
            follow: 'If I gave you the number, it would be mentioned.',
            close: 'That is the most irritating thing you have said this hour.',
        },
        {
            from: 'darlok', to: 'bulrathi', stance: 'oblique',
            jab: 'The most useful line in a trade report is the port it does not list.',
            reply: 'I want to know whose escorts are sitting in it.',
            follow: 'You assume there are escorts.',
            close: 'There are always escorts. That is what a port is for.',
        },

        // --- Kira and Quarry (Council Summit Floor): the decade against the age. ---
        {
            from: 'alkari_f', to: 'silicoid', stance: 'patient',
            jab: 'Quarry, I think in decades. You make me feel hasty.',
            reply: 'Decades are a reasonable start.',
            follow: 'And after that?',
            close: 'After that, the treaties are rewritten by people not yet born.',
        },
        {
            from: 'alkari_f', to: 'silicoid', stance: 'measured',
            jab: 'Every agreement looks permanent on the day it is signed.',
            reply: 'So does every mountain. I have outlived several.',
            follow: 'Mountains, or agreements?',
            close: 'Both. The mountains took longer.',
        },
        {
            from: 'silicoid', to: 'alkari_f', stance: 'slow',
            jab: 'Kira sees the pattern. I see what the pattern is sitting on.',
            reply: 'And what is it sitting on?',
            follow: 'The last pattern.',
            close: 'That is either very wise or entirely unhelpful.',
        },
        {
            from: 'silicoid', to: 'alkari_f', stance: 'immovable',
            jab: 'Delegates are always in a hurry. The problems they meet about rarely are.',
            reply: 'You mean the problem will outlast the delegates.',
            follow: 'Problems of this kind usually do.',
            close: 'Then we should report it as though it will outlast this one.',
        },

        // --- Oth and Unit 7 (Anomaly: Deep Dark, Imperial Historical Wire): the hypothesis against the log. ---
        {
            from: 'psilon', to: 'robot', stance: 'patient',
            jab: 'Strange readings are not the same as unexplained readings, Unit 7.',
            reply: 'Agreed. I file them under strange, pending.',
            follow: 'Pending what?',
            close: 'A second instrument. The first one is always optimistic.',
        },
        {
            from: 'psilon', to: 'robot', stance: 'pedantic',
            jab: 'You give every figure to four decimal places, even the estimates.',
            reply: 'The estimate is to four decimal places. Its accuracy is not.',
            follow: 'Then why report the decimals?',
            close: 'So that the error is precise.',
        },
        {
            from: 'robot', to: 'psilon', stance: 'flat',
            jab: 'Oth has proposed an explanation. I have logged it as a hypothesis.',
            reply: 'That is exactly what it is.',
            follow: 'Your previous seventeen were also logged as hypotheses.',
            close: 'And three of them became results. A respectable ratio.',
        },
        {
            from: 'robot', to: 'psilon', stance: 'literal',
            jab: 'The archive holds earlier reports of this kind.',
            reply: 'Then we can compare what changed.',
            follow: 'The instruments changed. The headlines did not.',
            close: 'That is the most useful sentence you have said this hour.',
        },

        // --- Vance and Kesh (Sector Weather Watch): the people under the weather. ---
        {
            from: 'human_f', to: 'alkari', stance: 'warm',
            jab: 'Kesh, before the wind speeds, tell me who is out in it.',
            reply: 'Crews, mostly. And the people who could not leave.',
            follow: 'Start with them next time.',
            close: 'I will. The numbers will still be there.',
        },
        {
            from: 'human_f', to: 'alkari', stance: 'attentive',
            jab: 'You always sound out of breath on these reports.',
            reply: 'The weather does not wait for the relay to catch up.',
            follow: 'Neither do the people under it.',
            close: 'That is why I run.',
        },
        {
            from: 'alkari', to: 'human_f', stance: 'keen',
            jab: 'Forecasts change faster than this desk can read them.',
            reply: 'Then say what we know now, and when it was true.',
            follow: 'Time-stamped, then.',
            close: 'Always. A forecast without a time is a guess.',
        },
        {
            from: 'alkari', to: 'human_f', stance: 'hopeful',
            jab: 'Vance, a warning that goes out early is a good story too.',
            reply: 'It is, if it reached the people who needed it.',
            follow: 'I can ask the local desk.',
            close: 'Please do. That is the follow-up I want.',
        },

        // --- Oth and Quarry (Solar Wind Overnight): two kinds of slow. ---------
        {
            from: 'psilon', to: 'silicoid', stance: 'academic',
            jab: 'Quarry, a solar storm is over in days. Does that even register for you?',
            reply: 'Barely. But the rock remembers every one.',
            follow: 'Is that literally true?',
            close: 'Ask a geologist. Then ask the rock.',
        },
        {
            from: 'psilon', to: 'silicoid', stance: 'patient',
            jab: 'The models are good. They are not yet good at surprises.',
            reply: 'Nothing is. That is why they are surprises.',
            follow: 'That is not a scientific position.',
            close: 'It is a very old one.',
        },
        {
            from: 'silicoid', to: 'psilon', stance: 'slow',
            jab: 'Oth wants the cause. I am content with the pattern.',
            reply: 'The pattern is where the cause is hiding.',
            follow: 'Then it will still be there tomorrow.',
            close: 'That is the only comforting thing about the night shift.',
        },
        {
            from: 'silicoid', to: 'psilon', stance: 'immovable',
            jab: 'The sky is busy tonight.',
            reply: 'The sky is always busy. We have only recently started listening.',
            follow: 'Recently?',
            close: 'By your standards, the last few thousand years.',
        },

        // --- Grolm and Rell (Rim Sports Wire): the scoreline against the books. ---
        {
            from: 'bulrathi', to: 'mrrshan', stance: 'blunt',
            jab: 'Rell, I do not care what the transfer cost. Did they win?',
            reply: 'You should care. The transfer cost is why they lose the next one.',
            follow: 'That is not how a game works.',
            close: 'It is exactly how a league works.',
        },
        {
            from: 'bulrathi', to: 'mrrshan', stance: 'sceptical',
            jab: 'Every coach calls a defeat a learning experience.',
            reply: 'Every owner calls it a budget review.',
            follow: 'And which one is right?',
            close: 'The owner. The coach is usually the one who leaves.',
        },
        {
            from: 'mrrshan', to: 'bulrathi', stance: 'eager',
            jab: 'Grolm watches every match like a fleet engagement.',
            reply: 'Every match is a fleet engagement. With better seating.',
            follow: 'And worse tactics?',
            close: 'Some nights. Not all.',
        },
        {
            from: 'mrrshan', to: 'bulrathi', stance: 'distracted',
            jab: 'Somebody should price the travel. Nobody ever adds the travel to the result.',
            reply: 'Because the travel does not score.',
            follow: 'It costs more than a goal.',
            close: 'Then put it in the table and see who complains.',
        },

        // --- Hale and Hive-Liaison (The Arena Hour): the result against the overtime. ---
        {
            from: 'human', to: 'klackon', stance: 'formal',
            jab: 'Hive-Liaison, a final result can be reported as final.',
            reply: 'The result is final. The overtime is still being counted.',
            follow: 'By whom?',
            close: 'By the people who worked it. They are always counted last.',
        },
        {
            from: 'human', to: 'klackon', stance: 'composed',
            jab: 'We report the score first. Analysis follows.',
            reply: 'Agreed. The score has the players on it. The work behind it has many more names.',
            follow: 'Meaning the staff.',
            close: 'Meaning everyone who made the evening possible.',
        },
        {
            from: 'klackon', to: 'human', stance: 'brisk',
            jab: 'Commander, you read a result as though it were an order of the day.',
            reply: 'A result is an order of the day. It was decided, and it stands.',
            follow: 'Until the appeal.',
            close: 'Then we report the appeal. Calmly.',
        },
        {
            from: 'klackon', to: 'human', stance: 'efficient',
            jab: 'Hale wants the facts established. The fact is a final score.',
            reply: 'Then let us establish it, and then establish how it was reached.',
            follow: 'That will take longer than the game.',
            close: 'Most worthwhile reporting does.',
        },

        // --- Vance and Rell (Sector Midday Wire): the price is how the people find out. ---
        {
            from: 'human_f', to: 'mrrshan', stance: 'warm',
            jab: 'Rell, put down the freight tables for one minute.',
            reply: 'I can do thirty seconds. The routes do not stop for lunch.',
            follow: 'Then who is affected, in those thirty seconds?',
            close: 'Everyone who buys anything that was shipped. Which is everyone.',
        },
        {
            from: 'human_f', to: 'mrrshan', stance: 'attentive',
            jab: 'You always lead with the price. I always lead with the people.',
            reply: 'The price is how the people find out.',
            follow: 'That is the most humane thing you have ever said.',
            close: 'Do not tell the trade desk.',
        },
        {
            from: 'mrrshan', to: 'human_f', stance: 'eager',
            jab: 'Vance, there is a freight angle to this one.',
            reply: 'There is a freight angle to everything, Rell.',
            follow: 'Exactly. You are learning.',
            close: 'I am learning to wait for it.',
        },
        {
            from: 'mrrshan', to: 'human_f', stance: 'practical',
            jab: 'Somebody always pays, and it is never the one making the announcement.',
            reply: 'Then let us find out who it is, and ask them.',
            follow: 'They will not be in the press release.',
            close: 'No. They are usually at the end of the queue.',
        },

        // --- Vance and Foundry-Nine (Market Close): the number behind the number. ---
        {
            from: 'human_f', to: 'meklar', stance: 'warm',
            jab: 'Foundry-Nine, give me the number behind the number.',
            reply: 'The number behind the number is usually a shift that did not happen.',
            follow: 'And the people on that shift?',
            close: 'Not recorded. I will add them to the fault log.',
        },
        {
            from: 'human_f', to: 'meklar', stance: 'attentive',
            jab: 'You read a market close like a maintenance report.',
            reply: 'It is a maintenance report. For money.',
            follow: 'And what needs maintaining?',
            close: 'Confidence. It has a high failure rate.',
        },
        {
            from: 'meklar', to: 'human_f', stance: 'clipped',
            jab: 'Vance will ask who is affected. Answer: the line workers. Query complete.',
            reply: 'Not quite. Which line, and for how long?',
            follow: 'Insufficient data.',
            close: 'Then we say that, too.',
        },
        {
            from: 'meklar', to: 'human_f', stance: 'literal',
            jab: 'An index can close higher. An index is not a person.',
            reply: 'Thank you. I have been trying to say that for years.',
            follow: 'It took you longer.',
            close: 'I was being polite.',
        },

        // --- Kesh and the Analyst (Orbital Briefing): the launch against the manifest. ---
        {
            from: 'alkari', to: 'darlok', stance: 'keen',
            jab: 'I can always get the launch time. Nobody gives me the payload.',
            reply: 'That is the most informative thing you will hear about the payload.',
            follow: 'That nobody mentions it?',
            close: 'Silence has a shape. You learn to read it.',
        },
        {
            from: 'alkari', to: 'darlok', stance: 'hopeful',
            jab: 'Analyst, sometimes a mission is exactly what it says it is.',
            reply: 'Sometimes. I keep a short list.',
            follow: 'How short?',
            close: 'I would tell you, but then it would be shorter.',
        },
        {
            from: 'darlok', to: 'alkari', stance: 'insinuating',
            jab: 'Kesh reports what can be seen. I report what was pointed away from the cameras.',
            reply: 'I can only report what I can see.',
            follow: 'Which is precisely why they let you see it.',
            close: 'That is a horrible thought, and I am going to have it all night.',
        },
        {
            from: 'darlok', to: 'alkari', stance: 'oblique',
            jab: 'The interesting part of a launch is the paperwork filed afterwards.',
            reply: 'The interesting part is the launch!',
            follow: 'For you. For me it is the amended manifest.',
            close: 'Then we will both be at the pad, looking at different things.',
        },

        // --- Kira and Varr (Galactic Spotlight): fame, and the invoice for it. ---
        {
            from: 'alkari_f', to: 'mrrshan_f', stance: 'measured',
            jab: 'Varr, fame follows the same pattern every decade.',
            reply: 'So does the invoice for it.',
            follow: 'Who pays, in your version?',
            close: 'The fans, usually. In instalments.',
        },
        {
            from: 'alkari_f', to: 'mrrshan_f', stance: 'detached',
            jab: 'In twenty years, nobody will remember most of this.',
            reply: 'In twenty years, someone will still be paying it off.',
            follow: 'You make everything sound like debt.',
            close: 'Most things are. Some of them are fun first.',
        },
        {
            from: 'mrrshan_f', to: 'alkari_f', stance: 'amused',
            jab: 'Kira is about to tell us this is part of a larger pattern.',
            reply: 'It is. That does not make it less interesting.',
            follow: 'No, but it makes it less of a surprise.',
            close: 'Surprise is overrated. Pattern pays better.',
        },
        {
            from: 'mrrshan_f', to: 'alkari_f', stance: 'dry',
            jab: 'A celebrity apology is a press release with a sad face.',
            reply: 'And yet the pattern of them is remarkably consistent.',
            follow: 'Consistently timed before the next release.',
            close: 'You see? You do see patterns.',
        },

        // --- The Analyst and Unit 7 (The Night Desk): suspicion against measurement. ---
        {
            from: 'darlok', to: 'robot', stance: 'oblique',
            jab: 'Unit 7, you keep every version of every statement, do you not?',
            reply: 'Yes. Deletions are a data set.',
            follow: 'Most people find that unsettling.',
            close: 'Most people are in the deletions.',
        },
        {
            from: 'darlok', to: 'robot', stance: 'unreadable',
            jab: 'It is very late, Unit 7. This is when the corrections arrive.',
            reply: 'Correction volume rises after midnight by a measurable margin.',
            follow: 'You have measured it.',
            close: 'I measure everything. You merely suspect it.',
        },
        {
            from: 'robot', to: 'darlok', stance: 'flat',
            jab: 'The Analyst has implied something. I am unable to verify the implication.',
            reply: 'Good. That is how you know it is working.',
            follow: 'That is not a method.',
            close: 'It is the only one that works after midnight.',
        },
        {
            from: 'robot', to: 'darlok', stance: 'literal',
            jab: 'Please state your source.',
            reply: 'I would, but then it would not be my source.',
            follow: 'Logged as unsourced.',
            close: 'Log it as patient.',
        },

        // --- The Analyst and Quarry (Deep Signal): the hidden hand and the slow one. ---
        {
            from: 'darlok', to: 'silicoid', stance: 'oblique',
            jab: 'Quarry, signals like this are usually explained by something nobody wants to say.',
            reply: 'Or by something nobody has noticed for a very long time.',
            follow: 'You always choose the slower explanation.',
            close: 'The slower ones are usually true.',
        },
        {
            from: 'darlok', to: 'silicoid', stance: 'insinuating',
            jab: 'Someone always knows more than they say. Even about rocks.',
            reply: 'The rocks know more than anyone. They are simply not asked.',
            follow: 'I would like to interview one.',
            close: 'Be patient. The answer takes a few thousand years.',
        },
        {
            from: 'silicoid', to: 'darlok', stance: 'slow',
            jab: 'You look for the hidden hand. I look for the slow one.',
            reply: 'Sometimes they are the same hand.',
            follow: 'Then it is very patient.',
            close: 'The most dangerous ones are.',
        },
        {
            from: 'silicoid', to: 'darlok', stance: 'immovable',
            jab: 'A mystery is only a question that has not waited long enough.',
            reply: 'And a secret is an answer someone made wait on purpose.',
            follow: 'Then we are both in the business of waiting.',
            close: 'Yes. You are simply better at it.',
        },

        // --- Foundry-Nine and Ssyth (Chronicles of the Old Empires): the repair bill and the census. ---
        {
            from: 'meklar', to: 'sakkra', stance: 'clipped',
            jab: 'The chronicle records the battle. It does not record the repair bill.',
            reply: 'Or how many people were left to pay it.',
            follow: 'Both should be logged.',
            close: 'History is mostly what nobody logged.',
        },
        {
            from: 'meklar', to: 'sakkra', stance: 'literal',
            jab: 'Ssyth asks for a population figure. The archive offers a fleet count.',
            reply: 'That says a great deal about who kept the archive.',
            follow: 'Agreed. Fleets are easier to count.',
            close: 'And easier to be proud of.',
        },
        {
            from: 'sakkra', to: 'meklar', stance: 'wary',
            jab: 'Foundry-Nine reads history like a maintenance log.',
            reply: 'History is a maintenance log. Most empires fail by deferring repairs.',
            follow: 'And the people inside them?',
            close: 'Also deferred. That is usually the failure.',
        },
        {
            from: 'sakkra', to: 'meklar', stance: 'measured',
            jab: 'Every chronicle remembers the capital. Nobody remembers the outer colonies.',
            reply: 'The outer colonies produced the ore. The capital produced the chronicle.',
            follow: 'That explains the tone.',
            close: 'Output determines the record. It always has.',
        },

        // --- Hale and Grolm (World Desk Tonight): protocol against the map. ----
        {
            from: 'human', to: 'bulrathi', stance: 'formal',
            jab: 'Grolm, we report what has been confirmed, and nothing else.',
            reply: 'Then we will report very little. Ships do not confirm anything.',
            follow: 'Ships do not issue statements.',
            close: 'No. They issue positions. I prefer those.',
        },
        {
            from: 'human', to: 'bulrathi', stance: 'composed',
            jab: 'There is a protocol for how we describe a deployment.',
            reply: 'There is also a map. I prefer the map.',
            follow: 'The protocol exists so we do not frighten people with the map.',
            close: 'And the map exists so the protocol does not lie to them.',
        },
        {
            from: 'bulrathi', to: 'human', stance: 'blunt',
            jab: 'Commander, every deployment gets called defensive in the statement.',
            reply: 'Then we report it as their description, and say whose description it is.',
            follow: 'That is very fair to them.',
            close: 'Fairness is not agreement, Grolm. It is attribution.',
        },
        {
            from: 'bulrathi', to: 'human', stance: 'sceptical',
            jab: 'Hale wants the chain of command. I want the order of battle.',
            reply: 'One explains the other.',
            follow: 'Only if somebody follows the chain.',
            close: 'That is why we report both.',
        },

        // --- Hive-Liaison and Unit 7 (Signal & Circuit): the keynote against the night shift. ---
        {
            from: 'klackon', to: 'robot', stance: 'brisk',
            jab: 'Unit 7, every product launch leaves out the number of people who built it.',
            reply: 'I have that number for some of them. It is never in the keynote.',
            follow: 'Put it in the report.',
            close: 'Added. The keynote will not change.',
        },
        {
            from: 'klackon', to: 'robot', stance: 'efficient',
            jab: 'Automation removes tasks. It rarely removes the hours.',
            reply: 'Correct. The hours move to maintenance, at night.',
            follow: 'Who works them?',
            close: 'That field is usually left blank.',
        },
        {
            from: 'robot', to: 'klackon', stance: 'flat',
            jab: 'Hive-Liaison has asked for the labour count. I have provided it.',
            reply: 'And the overtime?',
            follow: 'The overtime was not in the source data.',
            close: 'It never is. That is why I ask.',
        },
        {
            from: 'robot', to: 'klackon', stance: 'literal',
            jab: 'Every new system is described as tireless.',
            reply: 'Systems are tireless. Their support teams are not.',
            follow: 'Accurate. I am a system.',
            close: 'And I am the one who files your maintenance tickets.',
        },

        // --- Vance and Varr, more (The Evening Rim Report): they had two, and four slots a night. ---
        {
            from: 'human_f', to: 'mrrshan_f', stance: 'warm',
            jab: 'Varr, you are smiling. That is never good news for the people being covered.',
            reply: 'I smile when the numbers are honest. It does not happen often.',
            follow: 'And when it does?',
            close: 'I have high standards, Vance. You have warmer ones.',
        },
        {
            from: 'human_f', to: 'mrrshan_f', stance: 'respectful',
            jab: 'You find the bill. I find the person holding it.',
            reply: 'It is a good partnership. They rarely like either of us.',
            follow: 'That is not why we do it.',
            close: 'No. But it helps to know we are doing it properly.',
        },
        {
            from: 'mrrshan_f', to: 'human_f', stance: 'teasing',
            jab: 'Vance is about to say we should hear from the people affected.',
            reply: 'Because we should.',
            follow: 'Agreed. I only wanted to say it first.',
            close: 'Then we will hear from them together.',
        },
        {
            from: 'mrrshan_f', to: 'human_f', stance: 'appreciative',
            jab: 'Somewhere in every statement is a household paying for it.',
            reply: 'Then let us find the household before we quote the minister.',
            follow: 'That is why you have the late slot.',
            close: 'And that is why you have the last word.',
        },

        // --- Grolm and Oth, more (The Council Hour). ---------------------------
        {
            from: 'bulrathi', to: 'psilon', stance: 'blunt',
            jab: 'Oth, I will take a rough count now over a perfect one next week.',
            reply: 'A rough count is how wars start.',
            follow: 'So is waiting.',
            close: 'Then we agree on the stakes, if not the method.',
        },
        {
            from: 'psilon', to: 'bulrathi', stance: 'academic',
            jab: 'Grolm assumes every silence is a fleet in hiding.',
            reply: 'And it usually is.',
            follow: 'Usually is a frequency, not a proof.',
            close: 'Then I will bring you a frequency. With hulls in it.',
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
     *         | 'followups' | 'asides' | 'handbacks'
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