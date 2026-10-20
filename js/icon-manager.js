/* ============================================================
   GNN — Icon Manager (Over-the-shoulder story icons)
   ============================================================ */

const GNNIconManager = (() => {
    // The twenty-two story icons, by what each one shows.
    //
    // `old` is the MoO1 event icon (assets/icons/, 41x37, its name lettered
    // inside a green border); `file` is the generated icon of the same
    // subject (assets/generated/icons/, transparent, no lettering). The
    // generated one is shown by default, with the name and border drawn
    // inside the monitor the way the original drew them. The MoO1 one is a
    // throwback: about one story in fourteen, chosen by the headline so a
    // story keeps the same icon for as long as it is on air.
    //
    // The previous table labelled the MoO1 files by position, and the
    // positions were wrong: the QUAKE icon was keyed as COLONY, WASTE as
    // CONTACT, VIRUS as COUNCIL, SPACE CRYSTAL as LIGHT and so on, so a
    // colony story showed QUAKE. Every label here is the name lettered on
    // the icon itself; keywords follow the picture. Order matters — the
    // first match wins, so specific subjects come before broad ones.
    // `color` is the colour of the name on the MoO1 icon.
    const ICON_DEFINITIONS = [
        { label: 'GENOCIDE', old: 'chunk_024', file: 'genocide', color: '#ff3b3b',
          keywords: ['genocide', 'massacre', 'atrocity', 'atrocities', 'war crimes', 'ethnic cleansing', 'death toll', 'mass grave'] },
        { label: 'VIRUS', old: 'chunk_009', file: 'virus', color: '#ff3b3b',
          keywords: ['computer virus', 'malware', 'ransomware', 'hacked', 'hackers', 'hacker', 'cyberattack', 'cyber attack', 'data breach', 'breach', 'vulnerability', 'exploit', 'zero-day', 'spyware', 'phishing', 'botnet'] },
        { label: 'PLAGUE', old: 'chunk_004', file: 'plague', color: '#ff3b3b',
          keywords: ['plague', 'pandemic', 'epidemic', 'outbreak', 'ebola', 'cholera', 'measles', 'mpox', 'bird flu', 'covid', 'infection', 'disease', 'vaccine'] },
        { label: 'QUAKE', old: 'chunk_005', file: 'quake', color: '#c64bd8',
          keywords: ['earthquake', 'quake', 'tremor', 'seismic', 'tsunami', 'aftershock', 'landslide', 'volcano', 'eruption', 'collapse', 'collapsed'] },
        { label: 'WASTE', old: 'chunk_007', file: 'waste', color: '#ff3b3b',
          keywords: ['radiation', 'radioactive', 'nuclear waste', 'toxic', 'pollution', 'contamination', 'contaminated', 'chemical spill', 'oil spill', 'spill', 'meltdown', 'fallout'] },
        { label: 'NOVA', old: 'chunk_006', file: 'nova', color: '#c9a52a',
          keywords: ['supernova', 'nova', 'solar flare', 'solar storm', 'geomagnetic', 'explosion', 'blast', 'exploded', 'detonation'] },
        { label: 'COMET', old: 'chunk_010', file: 'comet', color: '#c64bd8',
          keywords: ['comet', 'asteroid', 'meteor', 'meteorite', 'impact crater', 'near-earth object', 'space debris'] },
        { label: 'SPACE AMOEBA', old: 'chunk_015', file: 'space_amoeba', color: '#c64bd8',
          keywords: ['alien', 'extraterrestrial', 'ufo', 'uap', 'microbe', 'microbes', 'bacteria', 'organism', 'new species', 'creature', 'parasite'] },
        { label: 'SPACE CRYSTAL', old: 'chunk_014', file: 'space_crystal', color: '#4bd84b',
          keywords: ['breakthrough', 'discovery', 'discovered', 'quantum', 'crystal', 'superconductor', 'fusion', 'laser', 'physicists', 'particle'] },
        { label: 'PLANETS', old: 'chunk_022', file: 'planets', color: '#ff3b3b',
          keywords: ['exoplanet', 'planet', 'planets', 'telescope', 'nasa', 'esa', 'spacex', 'rocket', 'launch', 'spacecraft', 'astronaut', 'orbit', 'mars', 'moon', 'lunar', 'jupiter', 'saturn', 'satellite', 'space station'] },
        { label: 'DERELICT', old: 'chunk_012', file: 'derelict', color: '#ff3b3b',
          keywords: ['wreck', 'wreckage', 'shipwreck', 'derelict', 'abandoned', 'crash', 'crashed', 'sank', 'sunk', 'capsized', 'plane crash', 'debris'] },
        { label: 'PIRATES', old: 'chunk_011', file: 'pirates', color: '#ff3b3b',
          keywords: ['pirates', 'piracy', 'hijack', 'hijacked', 'smuggling', 'smugglers', 'robbery', 'heist', 'theft', 'stolen', 'scam', 'fraud', 'cartel', 'gang'] },
        { label: 'REVOLT', old: 'chunk_021', file: 'revolt', color: '#ff3b3b',
          keywords: ['coup', 'revolt', 'revolution', 'uprising', 'riot', 'riots', 'unrest', 'civil war', 'overthrow', 'martial law', 'insurrection'] },
        { label: 'REBELS', old: 'chunk_013', file: 'rebels', color: '#ff3b3b',
          keywords: ['rebels', 'rebel', 'militia', 'militants', 'insurgents', 'guerrilla', 'armed group', 'protest', 'protests', 'protesters', 'strike', 'strikes', 'walkout'] },
        { label: 'DIPLOMAT', old: 'chunk_008', file: 'diplomat', color: '#ff3b3b',
          keywords: ['diplomat', 'diplomatic', 'treaty', 'peace talks', 'ceasefire', 'summit', 'accord', 'ambassador', 'negotiation', 'negotiations', 'talks', 'sanctions', 'foreign minister', 'united nations'] },
        { label: 'GUARDIAN', old: 'chunk_025', file: 'guardian', color: '#c64bd8',
          keywords: ['security', 'defence', 'defense', 'military', 'army', 'navy', 'air force', 'troops', 'missile', 'drone', 'shield', 'police', 'border'] },
        { label: 'DEPLETED', old: 'chunk_019', file: 'depleted', color: '#ff3b3b',
          keywords: ['drought', 'shortage', 'shortages', 'famine', 'scarcity', 'depleted', 'water crisis', 'blackout', 'power outage', 'outage', 'rationing'] },
        { label: 'MINING', old: 'chunk_017', file: 'mining', color: '#ff3b3b',
          keywords: ['mining', 'miners', 'mine', 'minerals', 'lithium', 'copper', 'rare earth', 'oil', 'gas', 'pipeline', 'refinery', 'semiconductor', 'chip', 'chips', 'factory', 'manufacturing'] },
        { label: 'FERTILE', old: 'chunk_016', file: 'fertile', color: '#ff3b3b',
          keywords: ['agriculture', 'farming', 'farmers', 'crops', 'harvest', 'food', 'climate', 'environment', 'forest', 'wildlife', 'ocean', 'biodiversity', 'conservation'] },
        { label: 'DONATION', old: 'chunk_018', file: 'donation', color: '#c64bd8',
          keywords: ['aid', 'donation', 'donations', 'charity', 'funding', 'grant', 'billion', 'investment', 'budget', 'bank', 'gold', 'tariff', 'tariffs', 'trade deal', 'economy', 'inflation'] },
        { label: 'STATUS', old: 'chunk_023', file: 'status', color: '#ff3b3b',
          keywords: ['poll', 'polls', 'survey', 'statistics', 'data', 'figures', 'unemployment', 'gdp', 'report', 'results', 'stocks', 'markets', 'shares', 'index'] },
        { label: 'ORION', old: 'chunk_020', file: 'orion', color: '#9a9ad8',
          keywords: ['ancient', 'archaeology', 'archaeologists', 'artifact', 'artefact', 'ruins', 'tomb', 'relic', 'fossil', 'museum', 'pharaoh', 'emperor', 'king', 'queen', 'royal'] },
    ];

    // MoO2's own Galactic News Network pictures, for the lore show only.
    //
    // MoO2's EVENTS archive is the game's GNN: items 2-37 are the event
    // pictures its newsroom showed, 157x125, scanlined, the GNN logo in the
    // corner. They are in-universe illustrations of in-universe events, so
    // they illustrate archive bulletins on Imperial Historical Wire and never
    // a real story (the lore line, ROADMAP.md §1). Each was identified by
    // eye from a contact sheet; the ones whose subject is not certain (3, 6,
    // 9, 11-14, 23, 25, 27-29, 31, 32, 34, 35, 37) are left out. First match
    // wins, so specific subjects come first.
    const GNN_EVENT_DIR = 'assets/cutscenes/moo2/EVENTS';
    const GNN_EVENT_PICTURES = [
        [/\bplague|\bepidemic|\bdisease/i, 18],
        [/computer virus|\bvirus/i, 5],
        [/\bcomet/i, 4],
        [/supernova|\bnova\b/i, 26],
        [/amoeba/i, 21],
        [/crystal/i, 22],
        [/derelict|\bwreck/i, 2],
        [/\bpirat|\braider/i, 16],
        [/assassin/i, 17],
        [/\brebel|\brevolt|uprising|civil war/i, 15],
        [/breakthrough|discover/i, 20],
        [/population boom|birth rate/i, 19],
        [/accident|explosion/i, 10],
        [/donat|\bgift/i, 7],
        [/\bgold\b/i, 8],
        [/ion storm/i, 30],
    ];
    const gnnEventImages = {};

    // label -> { img (generated), old (MoO1) }
    let iconImages = {};
    let isLoaded = false;

    function loadOne(src) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = src;
        });
    }

    /** Preload both icon sets. */
    async function loadIcons(basePath = 'assets/icons', genPath = 'assets/generated/icons') {
        await Promise.all(ICON_DEFINITIONS.map(async (def) => {
            const [img, old] = await Promise.all([
                loadOne(`${genPath}/${def.file}.png`),
                loadOne(`${basePath}/${def.old}_frame_000.png`),
            ]);
            if (img || old) iconImages[def.label] = { img, old };
        }));
        // Extracted assets are gitignored; a clone without them has none.
        await Promise.all(GNN_EVENT_PICTURES.map(async ([, n]) => {
            const img = await loadOne(`${GNN_EVENT_DIR}/item_${String(n).padStart(2, '0')}_frame_000.png`);
            if (img) gnnEventImages[n] = img;
        }));
        isLoaded = true;
        console.log(`[GNN Icon] Loaded ${Object.keys(iconImages).length} story icons`);
    }

    /** Check if a text contains a keyword as a whole word */
    function hasWholeWord(text, keyword) {
        const escaped = keyword.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp('\\b' + escaped + '\\b', 'i');
        return regex.test(text);
    }

    /**
     * Match story text against icon keywords, returning the label.
     *
     * Separate from matchIcon() because the label is useful on its own —
     * the rundown uses it as a coarse subject tag — and because it answers
     * even before the PNGs have finished loading, where matchIcon() can
     * only return null.
     */
    function matchLabel(title = '', description = '') {
        const text = `${title} ${description}`.toLowerCase();

        for (const def of ICON_DEFINITIONS) {
            for (const kw of def.keywords) {
                if (hasWholeWord(text, kw)) return def.label;
            }
        }
        return null;
    }

    /**
     * Auto-match story text against icon keywords.
     * Returns matching HTMLImageElement, or null when nothing matched.
     *
     * There is no fallback. It used to return the STATUS plate whenever a
     * story matched no keyword — sports, entertainment, anything outside
     * the twenty-two science and MOO categories — and that plate then sat
     * on the monitor for the whole of every such story. A blank monitor is
     * the right default: the icon means "this story is about X", and a
     * story that is not about any of the twenty-two X's is not about
     * STATUS.
     */
    const RETRO_ONE_IN = 14;
    function headlineHash(t) {
        let h = 0;
        for (let i = 0; i < t.length; i++) h = ((h << 5) - h + t.charCodeAt(i)) | 0;
        return Math.abs(h);
    }

    /**
     * The icon for a story: `{ img, label, color, retro }`, or null.
     * `opts.lore` marks an archive bulletin (see GNN_EVENT_PICTURES).
     * `retro` marks the MoO1 throwback, which carries its own lettering and
     * border; otherwise the renderer letters the generated icon itself.
     */
    function matchIcon(title = '', description = '', opts = {}) {
        // An archive bulletin shows MoO2's own GNN picture of the event when
        // one exists. It carries its own logo and scanlines, so it is drawn
        // as-is, like the MoO1 throwback.
        if (opts.lore) {
            const text = `${title} ${description}`;
            const hit = GNN_EVENT_PICTURES.find(([re, n]) => re.test(text) && gnnEventImages[n]);
            if (hit) return { img: gnnEventImages[hit[1]], label: matchLabel(title, description) || 'ARCHIVE', retro: true };
        }
        const label = matchLabel(title, description);
        if (!label || !iconImages[label]) return null;
        const def = ICON_DEFINITIONS.find((d) => d.label === label);
        const set = iconImages[label];
        const retro = !!set.old && (!set.img || headlineHash(String(title)) % RETRO_ONE_IN === 0);
        const img = retro ? set.old : set.img;
        return img ? { img, label, color: def.color, retro } : null;
    }

    /** The MoO2 EVENTS item that pictures this lore text, or null. */
    function gnnEventFor(text) {
        const hit = GNN_EVENT_PICTURES.find(([re]) => re.test(String(text || '')));
        return hit ? hit[1] : null;
    }

    function getIconByLabel(label) {
        const set = iconImages[label];
        return set ? (set.img || set.old) : null;
    }

    function getDefinitions() {
        return [...ICON_DEFINITIONS];
    }

    return {
        loadIcons,
        matchIcon,
        matchLabel,
        gnnEventFor,
        getIconByLabel,
        getDefinitions,
        isLoaded: () => isLoaded,
    };
})();