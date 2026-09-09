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

    function pickFrom(list, fallback) {
        if (list && list.length) return list[(Math.random() * list.length) | 0];
        return fallback;
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
    // Anchor banter
    // ---------------------------------------------------------

    const OPENERS = [
        'Cross-referencing that against sector archives.',
        'Filed under ongoing developments.',
        'That item is now logged with the orbital registry.',
        'We are holding that transmission open.',
        'Our correspondents continue to monitor.',
        'That confirms the earlier relay from the beacon net.',
    ];

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

    /** A standalone commentary beat delivered between headlines. */
    function banter(story) {
        const roll = Math.random();
        if (roll < 0.34) return fillGeneric(pickFrom(ROBOT_ASIDES, ''), story);
        if (roll < 0.62) return fillGeneric(pickFrom(CONTEXT_LINES, ''), story);
        if (roll < 0.78) return pickFrom(OPENERS, '');
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
                { kind: 'hook', text: pickFrom([
                    'Deep space is not forgiving.',
                    'Every empire runs on something.',
                    'You have questions about the dark.',
                    'Somewhere out there, a hull is failing.',
                    'The Council will not save your convoy.',
                ], 'Deep space is not forgiving.') },
                { kind: 'body', text: `${brand} presents the ${product} programme.` },
                { kind: 'claim', text: pickFrom([
                    `Rated for ${(2 + (Math.random() * 40) | 0)} standard years of continuous operation.`,
                    `Now servicing ${(3 + (Math.random() * 60) | 0)} systems across the rim.`,
                    `Certified by the ${pickFrom(GNNAssets.vocab('races'), 'Psilon')} standards board.`,
                    `Field-proven at ${pickFrom(GNNAssets.vocab('stars'), 'Antares')}.`,
                ], 'Field proven.') },
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
                { kind: 'body', text: pickFrom([
                    'Sector Watch, with continuous relay coverage.',
                    'The Colonial Report, every six hours.',
                    'Deep Survey, from the edge of the mapped dark.',
                    'Council Floor, gavel to gavel.',
                ], 'Sector Watch.') },
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
        sectorWire, banter, toss, hold,
        ident, signoff, commercial, promo,
        tickerSegments, chyron, sponsorName,
    };
})();
