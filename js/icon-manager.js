/* ============================================================
   GNN — Icon Manager (Over-the-shoulder story icons)
   ============================================================ */

const GNNIconManager = (() => {
    // Exact mapping of 22 extracted icon assets with labels and keywords
    const ICON_DEFINITIONS = [
        { file: 'chunk_004_frame_000.png', label: 'PLAGUE', keywords: ['plague', 'disease', 'virus', 'health', 'outbreak', 'pandemic', 'medical', 'bio', 'covid', 'flu'] },
        { file: 'chunk_005_frame_000.png', label: 'COLONY', keywords: ['colony', 'settlement', 'habitat', 'city', 'base', 'outpost', 'population', 'mars', 'lunar'] },
        { file: 'chunk_006_frame_000.png', label: 'NOVA', keywords: ['nova', 'supernova', 'star', 'explosion', 'sun', 'flare', 'astronomy', 'astrophysics'] },
        { file: 'chunk_007_frame_000.png', label: 'CONTACT', keywords: ['contact', 'alien', 'signal', 'ufo', 'first contact', 'extraterrestrial', 'seti', 'message'] },
        { file: 'chunk_008_frame_000.png', label: 'DIPLOMAT', keywords: ['diplomat', 'treaty', 'peace', 'summit', 'accord', 'ambassador', 'negotiation', 'agreement'] },
        { file: 'chunk_009_frame_000.png', label: 'COUNCIL', keywords: ['council', 'vote', 'election', 'assembly', 'parliament', 'congress', 'senate', 'law', 'policy'] },
        { file: 'chunk_010_frame_000.png', label: 'COMET', keywords: ['comet', 'asteroid', 'meteor', 'impact', 'debris', 'orbit', 'meteorite'] },
        { file: 'chunk_011_frame_000.png', label: 'PIRATES', keywords: ['pirates', 'theft', 'stole', 'stolen', 'robbery', 'piracy', 'hacked', 'cybercrime', 'scam', 'raid'] },
        { file: 'chunk_012_frame_000.png', label: 'DERELICT', keywords: ['derelict', 'wreckage', 'abandoned', 'shipwreck', 'ruins', 'ghost ship', 'crashed'] },
        { file: 'chunk_013_frame_000.png', label: 'REBELS', keywords: ['rebels', 'protest', 'strike', 'resistance', 'activist', 'demonstration', 'dissident'] },
        { file: 'chunk_014_frame_000.png', label: 'LIGHT', keywords: ['light', 'laser', 'optics', 'fusion', 'energy', 'power', 'battery', 'electric', 'quantum'] },
        { file: 'chunk_015_frame_000.png', label: 'SHIPS', keywords: ['ships', 'fleet', 'military', 'warship', 'navy', 'defense', 'vessel', 'cargo', 'shipping'] },
        { file: 'chunk_016_frame_000.png', label: 'FERTILE', keywords: ['fertile', 'agriculture', 'food', 'farming', 'crops', 'climate', 'environment', 'harvest', 'nature'] },
        { file: 'chunk_017_frame_000.png', label: 'MINING', keywords: ['mining', 'minerals', 'gold', 'metal', 'copper', 'lithium', 'chip', 'semiconductor', 'factory'] },
        { file: 'chunk_018_frame_000.png', label: 'BOUNTY', keywords: ['bounty', 'reward', 'wanted', 'fugitive', 'police', 'arrest', 'fbi', 'justice', 'court'] },
        { file: 'chunk_019_frame_000.png', label: 'DEPLETED', keywords: ['depleted', 'drought', 'shortage', 'crisis', 'water', 'oil', 'scarcity', 'famine', 'exhausted'] },
        { file: 'chunk_020_frame_000.png', label: 'SABOTEUR', keywords: ['saboteur', 'sabotage', 'spy', 'espionage', 'infiltrate', 'leak', 'subversion', 'intel'] },
        { file: 'chunk_021_frame_000.png', label: 'REVOLT', keywords: ['revolt', 'revolution', 'uprising', 'civil war', 'coup', 'conflict', 'riot', 'overthrow'] },
        { file: 'chunk_022_frame_000.png', label: 'PLANETS', keywords: ['planets', 'exoplanet', 'jwst', 'hubble', 'telescope', 'solar system', 'orbit', 'atmosphere'] },
        { file: 'chunk_023_frame_000.png', label: 'STATUS', keywords: ['status', 'report', 'update', 'breaking', 'news', 'bulletin', 'brief', 'market'] },
        { file: 'chunk_024_frame_000.png', label: 'GENOCIDE', keywords: ['genocide', 'atrocity', 'massacre', 'war crimes', 'casualties', 'disaster', 'tragedy'] },
        { file: 'chunk_025_frame_000.png', label: 'GUARDIAN', keywords: ['guardian', 'shield', 'protection', 'guard', 'security', 'cybersecurity', 'firewall', 'ai'] }
    ];

    let iconImages = {};
    let isLoaded = false;

    /** Preload all icon PNGs. */
    async function loadIcons(basePath = 'assets/icons') {
        const promises = ICON_DEFINITIONS.map(def => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    iconImages[def.label] = img;
                    resolve();
                };
                img.onerror = () => {
                    console.warn(`[GNN Icon] Failed to load ${def.file}`);
                    resolve();
                };
                img.src = `${basePath}/${def.file}`;
            });
        });

        await Promise.all(promises);
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
     * Auto-match story text against icon keywords.
     * Returns matching HTMLImageElement or null.
     */
    function matchIcon(title = '', description = '') {
        const text = `${title} ${description}`.toLowerCase();

        for (const def of ICON_DEFINITIONS) {
            for (const kw of def.keywords) {
                if (hasWholeWord(text, kw)) {
                    return iconImages[def.label] || null;
                }
            }
        }

        // Default fallback icon
        return iconImages['STATUS'] || null;
    }

    function getIconByLabel(label) {
        return iconImages[label] || null;
    }

    function getDefinitions() {
        return [...ICON_DEFINITIONS];
    }

    return {
        loadIcons,
        matchIcon,
        getIconByLabel,
        getDefinitions,
        isLoaded: () => isLoaded,
    };
})();
