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
     handbacks   returning the lead to the other anchor

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
            // The generalist desk: world news, diplomacy, science, tech
            // and the fleet. Markets belong to the trade desk and the
            // resource desk — a financial instrument headline is not a
            // general-news story and does not read as one at this desk.
            // Space and anomaly stories belong to the science desk.
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
                "Varr, let me bring you in on that.",
                "Back to you at the desk.",
                "Varr, what are you seeing in the figures?",
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
                "Commander, your take.",
                "Hale, bring us back to the record.",
                "Back to you, Commander.",
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
                "Varr, you will want to see the margin on this.",
                "Back to the main desk.",
                "Over to you.",
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
                "Back to the anchors.",
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
                "Kira, what does the longer trend suggest?",
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
                "Ssyth, what does this mean for the settlements nearby?",
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
                "Hale, what does the policy say about the missing districts?",
                "Over to the desk.",
            ],
        },
        alkari: {
            id: 'alkari', colour: '#bfe3ff', name: 'Kesh', role: 'Field Correspondent',
            voice: 'bf_emma', register: 'breathless', mood: 'keen',
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
                "Kira, what does the timeline suggest?",
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
                "Ssyth, what does this mean for the communities nearby?",
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
                "Rell, does the labour total change the cost calculation?",
                "Back to you.",
            ],
        },
        // --- Commander Vance: the other half of the human desk pair. -----
        //
        // Hale reads protocol and the record. Vance reads the household —
        // the person a policy lands on, the name behind a statistic. The
        // pair are deliberately not interchangeable: swap them and the
        // station reads the same story twice. Her register is warm and
        // direct; her tic is a demand for a name.
        //
        // She sits on the same beat as Hale — world and diplomacy — so a
        // block that pairs her with him or with Varr covers the same
        // category. `bf_emma` is not used by any seated anchor; it is
        // Kesh's, and Kesh is a correspondent who never sits at the desk,
        // so there is no voice collision possible.
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
                "Hale, what does the record tell us?",
                "Back to you at the desk.",
                "Commander, take us through the official timeline.",
            ],
        },
        // --- Kira: the second Alkari. ------------------------------------
        //
        // Kesh reports from the field, breathless and first-on-the-scene.
        // Kira reads from altitude: the long pattern, the shape of the
        // thing after the noise clears. That is a bird's-eye register, and
        // it is what makes her distinct from every other anchor here —
        // where Hale wants the record and Vance wants the household, Kira
        // wants to know what this looks like in twenty years.
        //
        // She sits on world and science. `bf_isabella` is Quarry's; Quarry
        // is the Resources Desk and only shares a block with Kira if the
        // shuffle pairs them, which is a coincidence the run handles the
        // same way it handles any voice re-use.
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
                "Hale, what can we establish about the immediate facts?",
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
        //
        // Not symmetrical, and deliberately not adversarial either. Hale
        // wants the record; Vance wants the person the record is about.
        // They correct each other, which is the difference between a
        // conversation and two monologues.
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
            from: 'human', to: 'human_f', stance: 'respectful',
            jab: 'Vance has the household figures. They are less comfortable than the totals.',
            reply: 'They are also more accurate. That is rarely the same thing.',
            follow: 'You would rather the total held up.',
            close: 'I would rather we said which one we are quoting.',
        },
        {
            from: 'human', to: 'human_f', stance: 'wry',
            jab: 'Every figure I read you ask for the name behind it.',
            reply: 'Every name you read, I ask for the figure behind it.',
            follow: 'We are both correct, which is the problem.',
            close: 'It is a problem with two good answers. We can live with it.',
        },

        // --- Vance and Varr: warm versus dry, and both right. -------------
        //
        // A useful pairing for the rotation, and one the shuffled schedule
        // will produce. Vance's concern for households, Varr's for who
        // pays, are the same instinct pointed in different directions.
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
        //
        // The rotation will land these two together. Hale wants today and
        // the document; Kira wants the arc. The exchange is the station
        // arguing with itself about what news is for.
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
        //
        // Oth wants the mechanism; Kira wants the trend. Both are willing
        // to wait for evidence, which is not true of the rest of the desk.
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