/* ============================================================
 G N*N — Neural Voice Client
 ------------------------------------------------------------
 Talks to the local /api/tts endpoint (edge-tts, zero cloud
 account required) and plays the result through the station's
 voice bus so the music bed ducks under it and the glitch
 stage can chew on it.

 The element is also tapped by an AnalyserNode: `getLevel()`
 returns the current mouth-opening amplitude, which is what
 drives the anchor's 25-frame lip-sync matrix. Before this the
 mouth flapped on a random timer; now it tracks the actual
 waveform.

 The `play()` promise can reject with "the media was removed
 from the document" while the element is playing fine — see the
 long comment in `speak()` for why. That rejection is treated
 as a false alarm and the line resolves via `onended` instead.
 ============================================================ */

const GNNTTS = (() => {
    'use strict';

    const ENDPOINT = 'api/tts';

    // Identifies this page load to the server's supersede check. requestId
    // restarts at zero on every reload, so without a session to scope it to,
    // a fresh page's first requests all look older than the previous page's
    // last one and the server refuses every one of them.
    const SESSION = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);

    // Boot-race diagnostics. Every line is prefixed [TTS] so it can be
    // grepped out once the load-order fault is understood. Flip to false
    // to silence without editing every site; leave it true for now.
    const DEBUG = true;
    function log(...args) {
        if (!DEBUG) return;
        // eslint-disable-next-line no-console
        console.log('[TTS]', ...args);
    }

    // Fallback only: replaced at boot by whatever /api/voices reports, so the
    // selector always matches the engine that is actually running. These are
    // the edge-tts picks, chosen by ear — the newer "Multilingual" models
    // read too slowly for a news anchor.
    const VOICES = [
        { id: 'en-GB-RyanNeural', label: 'RYAN — Interstellar BBC' },
        { id: 'en-AU-WilliamNeural', label: 'WILLIAM — Outer Rim' },
        { id: 'en-GB-ThomasNeural', label: 'THOMAS — Sector Desk' },
        { id: 'en-IE-ConnorNeural', label: 'CONNOR — Field Correspondent' },
        { id: 'en-US-EricNeural', label: 'ERIC — Resonant Sci-Fi' },
        { id: 'en-US-SteffanNeural', label: 'STEFFAN — Broadcast Desk' },
        { id: 'en-US-BrianNeural', label: 'BRIAN — Deep Baritone' },
        { id: 'en-US-GuyNeural', label: 'GUY — Anchor Prime' },
        { id: 'en-US-AriaNeural', label: 'ARIA — Anchor (F)' },
                { id: 'en-US-AvaNeural', label: 'AVA — Smooth Sci-Fi (F)' },
    ];

    let voice = VOICES[0].id;
    let enabled = true;
    let unlocked = false;
    let available = null;          // null = untested, false = fall back

    let audioEl = null;
    let mediaSource = null;
    let analyser = null;
    let voiceGain = null;
    let levelData = null;

    let requestId = 0;
    let speaking = false;
    let lastLine = null;
    let currentResolve = null;
    let pitchHz = 0;
    let ratePct = 0;
    let engine = null;
    let cloud = false;

    // True from the moment `speak()` is entered to the moment playback is
    // actually attempted. The fetch and decode of the clip sit in that
    // window: locally a few milliseconds, on a cold line a second or more.
    let awaitingAudio = false;

    let onStart = null;
    let onEnd = null;

    // ---------------------------------------------------------
    // Element + analyser plumbing
    // ---------------------------------------------------------

    function element() {
        if (!audioEl) {
            audioEl = new Audio();
            audioEl.preload = 'auto';
            audioEl.crossOrigin = 'anonymous';
            audioEl.preservesPitch = false;
            audioEl.mozPreservesPitch = false;
            audioEl.webkitPreservesPitch = false;
        }
        return audioEl;
    }

    function attachAnalyser() {
        if (mediaSource || typeof GNNAudio === 'undefined') return;
        GNNAudio.whenRunning(connectGraph);
    }

    function connectGraph() {
        if (mediaSource || typeof GNNAudio === 'undefined') return;
        const ctx = GNNAudio.getContext();
        if (!ctx || ctx.state !== 'running') return;
        try {
            mediaSource = ctx.createMediaElementSource(element());
            analyser = ctx.createAnalyser();
            analyser.fftSize = 512;
            analyser.smoothingTimeConstant = 0.15;
            levelData = new Uint8Array(analyser.frequencyBinCount);
            voiceGain = ctx.createGain();
            voiceGain.gain.value = 1;
            mediaSource.connect(analyser);
            analyser.connect(voiceGain);
            voiceGain.connect(GNNAudio.getVoiceBus());
            log('analyser connected');
        } catch (err) {
            mediaSource = null; analyser = null;
            log('analyser connect failed', err && err.message);
        }
    }

    /** 0..1 mouth-opening amplitude for the current instant. */
    function getLevel() {
        if (!speaking) return 0;
        if (!analyser) return 0.55 + Math.sin(performance.now() / 90) * 0.25;
        analyser.getByteFrequencyData(levelData);
        let sum = 0;
        const n = Math.max(1, levelData.length / 3) | 0;
        for (let i = 0; i < n; i++) sum += levelData[i];
        return Math.min(1, (sum / n) / 128);
    }

    function unlock() {
        if (unlocked) return;
        unlocked = true;
        const el = element();
        el.muted = true;
        const p = el.play();
        if (p && p.catch) p.catch(() => { });
        el.pause();
        el.muted = false;
        el.currentTime = 0;
        attachAnalyser();
        log('unlocked');
    }

    // ---------------------------------------------------------
    // Speaking — sanitisation
    // ---------------------------------------------------------

    // Initialisms that are genuinely spoken letter by letter.
    const SPELLED_OUT = new Set([
        'US', 'USA', 'UK', 'EU', 'UN', 'UAE', 'FBI', 'CIA', 'NSA', 'DOJ',
        'NHS', 'BBC', 'CNN', 'ITV', 'WHO', 'IMF', 'WTO', 'OPEC', 'NFL',
        'NBA', 'MLB', 'UFC', 'GDP', 'CEO', 'CFO', 'IPO', 'AI', 'EV', 'UFO',
        'ISS', 'ESA', 'FAA', 'CDC', 'EPA', 'IRS', 'GOP', 'PM', 'MP', 'DC',
    ]);

    // Ordinary words that arrive capitalised for emphasis.
    const COMMON_SHORT = new Set([
        'ON', 'IN', 'AT', 'IS', 'AS', 'IT', 'BY', 'OR', 'AN', 'UP', 'TO',
        'OF', 'NO', 'SO', 'WE', 'HE', 'DO', 'IF', 'BE', 'ME', 'MY', 'AM',
        'ALL', 'AND', 'THE', 'FOR', 'NOT', 'BUT', 'OUT', 'NEW', 'TWO',
        'ONE', 'SIX', 'TEN', 'HAS', 'HAD', 'WAS', 'ARE', 'WHO', 'HOW',
        'WHY', 'ITS', 'HIS', 'HER', 'OFF', 'OWN', 'SAY', 'SEE', 'NOW',
        'END', 'TOP', 'WAR', 'LAW', 'BIG', 'OLD', 'MAY', 'CAN', 'GET',
        'GOT', 'PUT', 'SET', 'RUN', 'DAY', 'MAN', 'MEN', 'WIN', 'DIE',
        'HIT', 'CUT', 'ASK', 'YET', 'FAR', 'BAD', 'LOW', 'KEY', 'JOB',
    ]);

    function unshout(text) {
        const str = String(text);
        const words = str.match(/\b[A-Za-z][A-Za-z'’.-]*\b/g) || [];
        const longEnough = words.filter((w) => w.replace(/[^A-Za-z]/g, '').length > 2);
        const shouted = longEnough.filter((w) => w === w.toUpperCase());
        const headline = longEnough.length > 0
        && shouted.length / longEnough.length > 0.5;

        return str.replace(/\b[A-Z][A-Z'’.-]+\b/g, (word) => {
            const letters = word.replace(/[^A-Z]/g, '');
            if (letters.length < 2) return word;
            if (SPELLED_OUT.has(letters)) return word;
            if (COMMON_SHORT.has(letters)) {
                return word.charAt(0) + word.slice(1).toLowerCase();
            }
            if (!headline) {
                if (letters.length < 4) return word;
                if (!/[AEIOUY]/.test(letters)) return word;
            } else if (!/[AEIOUY]/.test(letters) && letters.length <= 4) {
                return word;
            }
            return word.charAt(0) + word.slice(1).toLowerCase();
        });
    }

    // Names the phonemiser gets wrong, respelled so it gets them right.
    // Nothing here changes what is shown on screen — sanitize() runs on
    // the way to synthesis only.
    // News-feed pronunciation overrides. These substitutions affect synthesis only;
    // captions and on-screen RSS text retain the publisher's original spelling.
    // Keep specific multi-word abbreviations above shorter ones (DR Congo before DR).
    const PRONOUNCE = [
        // International organisations and initialisms
        [/\bWorld Health Organization\b/gi, 'World Health Organization'],
        // Keep the TV character distinct from the health agency acronym.
        [/\bDR\.?\s+WHO\b/g, 'Doctor Who'],
        [/\bDr\.(?=\s+[A-Z])/g, 'Doctor'],
                [/\bWHO\b/g, 'W H O'],
                [/\bWho(?=\s+(?:says|said|warns|warned|reports|reported|announces|announced|confirms|confirmed|urges|urged|calls|called|estimates|estimated|finds|found|declares|declared|has|is|was|will|expects|expected|backs|backed|criticizes|criticised|criticizes|criticized|raises|raised|links|linked|advises|advised)\b)/g, 'W H O'],
                [/\bUNESCO\b/gi, 'you-NESS-koh'],
                [/\bUNICEF\b/gi, 'you-nih-sef'],
                [/\bUNHCR\b/gi, 'U N H C R'],
                [/\bNATO\b/gi, 'NAY-toh'],
                [/\bOAS\b/g, 'O A S'],
                [/\bASEAN\b/gi, 'AH-see-ahn'],
                [/\bAUKUS\b/gi, 'AW-kus'],
                [/\bBRICS\b/gi, 'bricks'],
                [/\bG7\b/g, 'G seven'],
                [/\bG20\b/g, 'G twenty'],
                [/\bEU\b/g, 'E U'],
                [/\bUN\b/g, 'U N'],
                [/\bIMF\b/g, 'I M F'],
                [/\bWTO\b/g, 'W T O'],
                [/\bICC\b/g, 'I C C'],
                [/\bICJ\b/g, 'I C J'],
                [/\bIAEA\b/gi, 'I A E A'],
                [/\bOPEC\b/g, 'O P E C'],
                [/\bOECD\b/gi, 'O E C D'],
                [/\bWHO\b/g, 'W H O'],
                [/\bNGO\b/gi, 'N G O'],
                [/\bINGO\b/gi, 'I N G O'],
                [/\bIDF\b/g, 'I D F'],
                [/\bIRGC\b/gi, 'I R G C'],
                [/\bISIS\b/g, 'eye-sis'],
                [/\bISIL\b/g, 'eye-sil'],
                [/\bHamas\b/gi, 'hah-MOSS'],
                [/\bHezbollah\b/gi, 'Hezb-ullah'],
                [/\bHizbollah\b/gi, 'Hezb-ullah'],
                [/\bHouthis\b/gi, 'Hoothees'],
                [/\bHouthi\b/gi, 'Hoothee'],
                [/\bTaliban\b/gi, 'TAL-ih-bahn'],
                [/\bAl Qaeda\b/gi, 'al KYE-duh'],
                [/\bAl-Qaeda\b/gi, 'al KYE-duh'],
                [/\bAl-Shabaab\b/gi, 'al-shah-BAHB'],
                [/\bBoko Haram\b/gi, 'BOH-koh hah-RAHM'],

                // Countries, regions, and frequently misread place names
                [/\bDR\.?\s+Congo\b/gi, 'Democratic Republic of Congo'],
                [/\bDemocratic Republic of the Congo\b/gi, 'Democratic Republic of the Congo'],
                [/\bDRC\b/g, 'D R C'],
                [/\bD\.R\.C\.\b/gi, 'D R C'],
                [/\bCongo-Brazzaville\b/gi, 'Congo Brazzaville'],
                [/\bCongo-Kinshasa\b/gi, 'Congo Kinshasa'],
                [/\bCôte d’Ivoire\b/gi, 'coat dee-VWAHR'],
                [/\bCôte d'Ivoire\b/gi, 'coat dee-VWAHR'],
                [/\bIvory Coast\b/gi, 'Eye-vuh-ree Coast'],
                [/\bEswatini\b/gi, 'ess-wah-TEE-nee'],
                [/\bLesotho\b/gi, 'leh-SOO-too'],
                [/\bDjibouti\b/gi, 'jih-BOO-tee'],
                [/\bSeychelles\b/gi, 'say-SHELLZ'],
                [/\bMauritius\b/gi, 'muh-RISH-us'],
                [/\bMaldives\b/gi, 'MAWL-deevz'],
                [/\bKyrgyzstan\b/gi, 'keer-gih-STAHN'],
                [/\bTajikistan\b/gi, 'tah-JEE-kih-stahn'],
                [/\bTurkmenistan\b/gi, 'turk-MEN-ih-stahn'],
                [/\bUzbekistan\b/gi, 'ooz-BEK-ih-stahn'],
                [/\bKazakhstan\b/gi, 'kah-zahk-STAHN'],
                [/\bAzerbaijan\b/gi, 'az-er-by-JAHN'],
                [/\bArmenia\b/gi, 'ar-MEE-nee-uh'],
                [/\bGeorgia\b/gi, 'JOR-juh'], // Country pronunciation; context may also mean the US state.
                [/\bMoldova\b/gi, 'mol-DOH-vuh'],
                [/\bBelarus\b/gi, 'bell-uh-ROOSS'],
                [/\bUkraine\b/gi, 'you-KRAYN'],
                [/\bKyiv\b/gi, 'Keev'],
                [/\bOdesa\b/gi, 'oh-DESS-uh'],
                [/\bKharkiv\b/gi, 'KAR-kiv'],
                [/\bZaporizhzhia\b/gi, 'zap-oh-RIZH-uh'],
                [/\bDonbas\b/gi, 'DON-bahs'],
                [/\bCrimea\b/gi, 'kry-MEE-uh'],
                [/\bTransnistria\b/gi, 'trans-NISS-tree-uh'],
                [/\bNagorno-Karabakh\b/gi, 'nuh-GOR-noh kar-uh-BAHK'],
                [/\bChechnya\b/gi, 'CHECH-nee-uh'],
                [/\bDagestan\b/gi, 'dah-guh-STAHN'],
                [/\bXinjiang\b/gi, 'shin-jyahng'],
                [/\bTaiwan\b/gi, 'tie-WAHN'],
                [/\bTaipei\b/gi, 'tie-PAY'],
                [/\bBeijing\b/gi, 'bay-JING'],
                [/\bShanghai\b/gi, 'shang-HIGH'],
                [/\bQatar\b/gi, 'KUH-tar'],
                [/\bDoha\b/gi, 'DOH-hah'],
                [/\bBahrain\b/gi, 'bah-RAYN'],
                [/\bKuwait\b/gi, 'koo-WAIT'],
                [/\bOman\b/gi, 'oh-MAHN'],
                [/\bYemen\b/gi, 'YEM-en'],
                [/\bSanaa\b/gi, 'sah-NAH'],
                [/\bSana'a\b/gi, 'sah-NAH'],
                [/\bRiyadh\b/gi, 'ree-YAHD'],
                [/\bTehran\b/gi, 'teh-RAHN'],
                [/\bBaghdad\b/gi, 'bag-DAD'],
                [/\bMosul\b/gi, 'MOH-sul'],
                [/\bKurdistan\b/gi, 'kur-dih-STAN'],
                [/\bGaza\b/gi, 'GAH-zuh'],
                [/\bGaza Strip\b/gi, 'GAH-zuh Strip'],
                [/\bWest Bank\b/gi, 'West Bank'],
                [/\bJerusalem\b/gi, 'juh-ROO-suh-lem'],
                [/\bTel Aviv\b/gi, 'tel uh-VEV'],
                [/\bNetanyahu\b/gi, 'Netan-yah-hoo'],
                [/\bBibi\b/g, 'Bee-bee'],
                [/\bCairo\b/gi, 'KYE-roh'],
                [/\bKhartoum\b/gi, 'kar-TOOM'],
                [/\bDarfur\b/gi, 'dar-FOOR'],
                [/\bSahel\b/gi, 'sah-HELL'],
                [/\bNiger\b/gi, 'nee-ZHAIR'],
                [/\bNigeria\b/gi, 'nye-JEER-ee-uh'],
                [/\bNigerien\b/gi, 'nee-ZHAIR-ee-en'],
                [/\bNigerian\b/gi, 'nye-JEER-ee-an'],
                [/\bBurkina Faso\b/gi, 'bur-KEE-nah FAH-soh'],
                [/\bOuagadougou\b/gi, 'wah-guh-DOO-goo'],
                [/\bMali\b/gi, 'MAH-lee'],
                [/\bBamako\b/gi, 'BAH-muh-koh'],
                [/\bSenegal\b/gi, 'SEN-ih-gawl'],
                [/\bDakar\b/gi, 'dah-KAR'],
                [/\bGambia\b/gi, 'GAM-bee-uh'],
                [/\bGuinea-Bissau\b/gi, 'GIN-ee bih-SOW'],
                [/\bCabo Verde\b/gi, 'KAH-boh VER-day'],
                [/\bEritrea\b/gi, 'air-ih-TREE-uh'],
                [/\bAsmara\b/gi, 'ahs-MAH-rah'],
                [/\bTigray\b/gi, 'tee-GRYE'],
                [/\bAddis Ababa\b/gi, 'AH-dis AH-buh-buh'],
                [/\bEthiopia\b/gi, 'ee-thee-OH-pee-uh'],
                [/\bSomalia\b/gi, 'soh-MAH-lee-uh'],
                [/\bMogadishu\b/gi, 'moh-guh-DEE-shoo'],
                [/\bRwanda\b/gi, 'roo-AHN-duh'],
                [/\bBurundi\b/gi, 'buh-ROON-dee'],
                [/\bUganda\b/gi, 'yoo-GAN-duh'],
                [/\bKampala\b/gi, 'kam-PAH-luh'],
                [/\bKinshasa\b/gi, 'kin-SHAH-suh'],
                [/\bBrazzaville\b/gi, 'BRAH-zuh-veel'],
                [/\bLubumbashi\b/gi, 'loo-boom-BAH-shee'],
                [/\bM23\b/g, 'M twenty-three'],
                [/\bFARC\b/g, 'F A R C'],
                [/\bELN\b/g, 'E L N'],
                [/\bPKK\b/g, 'P K K'],
                [/\bYPG\b/g, 'Y P G'],
                [/\bSDF\b/g, 'S D F'],
                [/\bDPRK\b/g, 'D P R K'],
                [/\bROK\b/g, 'R O K'],
                [/\bPLA\b/g, 'P L A'],
                [/\bCCP\b/g, 'C C P'],
                [/\bKremlin\b/gi, 'KREM-lin'],
                [/\bMoscow\b/gi, 'MOS-kow'],
                [/\bVladimir Putin\b/gi, 'Vlah-dee-meer POO-tin'],
                [/\bVolodymyr Zelenskyy?\b/gi, 'voh-loh-DIM-eer zuh-LEN-skee'],
                [/\bZelenskyy?\b/gi, 'zuh-LEN-skee'],
                [/\bXi Jinping\b/gi, 'shee jin-PING'],
                [/\bKim Jong Un\b/gi, 'kim jong OON'],
                [/\bPyongyang\b/gi, 'pyong-YAHNG'],
                [/\bSeoul\b/gi, 'sohl'],
                [/\bMyanmar\b/gi, 'mee-an-MAR'],
                [/\bNaypyidaw\b/gi, 'nay-pee-DAW'],
                [/\bRohingya\b/gi, 'roh-HIN-juh'],
                [/\bBangladesh\b/gi, 'bang-gluh-DESH'],
                [/\bDhaka\b/gi, 'DAH-kuh'],
                [/\bPakistan\b/gi, 'PAK-ih-stan'],
                [/\bIslamabad\b/gi, 'iz-LAH-muh-bad'],
                [/\bAfghanistan\b/gi, 'af-GAN-ih-stan'],
                [/\bKabul\b/gi, 'KAH-bul'],
                [/\bTaliban\b/gi, 'TAL-ih-bahn'],
                [/\bIslamic State\b/gi, 'Islamic State'],
                [/\bBiden\b/gi, 'BYE-den'],
                [/\bTrump\b/gi, 'Trump'],
                [/\bMacron\b/gi, 'mah-KRON'],
                [/\bScholz\b/gi, 'sholts'],
                [/\bMeloni\b/gi, 'meh-LOH-nee'],
                [/\bErdogan\b/gi, 'AIR-doh-wahn'],
                [/\bRecep Tayyip Erdogan\b/gi, 'REH-jep TYE-yip AIR-doh-wahn'],
                [/\bMohammed bin Salman\b/gi, 'moh-HAH-med bin sal-MAHN'],
                [/\bMbS\b/g, 'M B S'],

                // Common news, law, medicine, science, and finance abbreviations
                [/\bAI\b/g, 'A I'],
                [/\bA\.I\.\b/g, 'A I'],
                [/\bGDP\b/g, 'G D P'],
                [/\bCPI\b/g, 'C P I'],
                [/\bPCE\b/g, 'P C E'],
                [/\bFOMC\b/gi, 'F O M C'],
                [/\bFed\b/g, 'Fed'],
                [/\bSEC\b/g, 'S E C'],
                [/\bFTC\b/g, 'F T C'],
                [/\bDOJ\b/g, 'D O J'],
                [/\bFBI\b/g, 'F B I'],
                [/\bCIA\b/g, 'C I A'],
                [/\bNSA\b/g, 'N S A'],
                [/\bDHS\b/g, 'D H S'],
                [/\bICE\b/g, 'I C E'],
                [/\bCBP\b/g, 'C B P'],
                [/\bATF\b/g, 'A T F'],
                [/\bCDC\b/g, 'C D C'],
                [/\bFDA\b/g, 'F D A'],
                [/\bEPA\b/g, 'E P A'],
                [/\bIRS\b/g, 'I R S'],
                [/\bNHS\b/g, 'N H S'],
                [/\bMPs?\b/g, 'M P'],
                [/\bMAGA\b/gi, 'MAG-uh'],
                [/\bSCOTUS\b/gi, 'SKOH-tus'],
                [/\bOTAN\b/gi, 'oh-TAHN'],
                [/\bCOVID-?19\b/gi, 'COVID nineteen'],
                [/\bCOVID\b/gi, 'CO-vid'],
                [/\bSARS-CoV-2\b/gi, 'sars cov two'],
                [/\bH5N1\b/g, 'H five N one'],
                [/\bH1N1\b/g, 'H one N one'],
                [/\bRSV\b/g, 'R S V'],
                [/\bHIV\b/g, 'H I V'],
                [/\bAIDS\b/g, 'AIDS'],
                [/\bWHO\b/g, 'W H O'],
                [/\bNvidia\b/gi, 'en-VID-ee-uh'],
                [/\bHuawei\b/gi, 'wah-WAY'],
                [/\bXiaomi\b/gi, 'shy-OW-mee'],
                [/\bBYD\b/g, 'B Y D'],
                [/\bTSMC\b/gi, 'T S M C'],
                [/\bASML\b/gi, 'A S M L'],
                [/\bNASDAQ\b/gi, 'NAZ-dak'],
                [/\bNYSE\b/g, 'N Y S E'],
                [/\bSEC\b/g, 'S E C'],
                [/\bIPO\b/g, 'I P O'],
                [/\bCEO\b/g, 'C E O'],
                [/\bCFO\b/g, 'C F O'],
                [/\bCOO\b/g, 'C O O'],
                [/\bCTO\b/g, 'C T O'],
                [/\bEVs?\b/g, 'E V'],
                [/\bUFOs?\b/g, 'U F O'],
                [/\bGPS\b/g, 'G P S'],
                [/\bUSB\b/g, 'U S B'],
                [/\bURL\b/g, 'U R L'],
                [/\bPDF\b/g, 'P D F'],
                [/\bAPI\b/g, 'A P I'],
                [/\bSQL\b/g, 'sequel'],
                [/\bHTTP\b/g, 'H T T P'],
                [/\bHTTPS\b/g, 'H T T P S'],
                [/\bAI\b/g, 'A I'],

                // Dates, symbols, and units commonly present in RSS copy
                [/\bkm\/h\b/gi, 'kilometres per hour'],
                [/\bkph\b/gi, 'kilometres per hour'],
                [/\bmph\b/gi, 'miles per hour'],
                [/\bkm²\b/gi, 'square kilometres'],
                [/\bkm2\b/gi, 'square kilometres'],
                [/\bkg\b/gi, 'kilograms'],
                [/\bmg\b/gi, 'milligrams'],
                [/\bGHz\b/g, 'gigahertz'],
                [/\bMHz\b/g, 'megahertz'],
                [/\bGB\b/g, 'gigabytes'],
                [/\bTB\b/g, 'terabytes'],
                [/\bUSD\b/g, 'U S dollars'],
                [/\bEUR\b/g, 'euros'],
                [/\bGBP\b/g, 'pounds sterling'],
                [/\bJPY\b/g, 'yen'],
                [/\bpercent\b/gi, 'percent'],
                [/\bper cent\b/gi, 'percent'],
                [/\bQ[1-4]\b/g, (m) => `quarter ${m[1]}`],
                [/\bFY(\d{2,4})\b/gi, 'financial year $1'],
                [/\bNo\.\s*(\d+)\b/g, 'number $1'],

                // Pronunciation traps in ordinary English and international reporting
                [/\bconvoys\b/gi, 'KAHN-voys'],
                [/\bconvoy\b/gi, 'KAHN-voy'],
                [/\bcorvette\b/gi, 'cor-VET'],
                [/\bcoup\b/gi, 'coo'],
                [/\bquay\b/gi, 'key'],
                [/\bWorcestershire\b/gi, 'WUSS-ter-sher'],
                [/\bLeicester\b/gi, 'LESS-ter'],
                [/\bGloucestershire\b/gi, 'GLOSS-ter-sher'],
                [/\bEdinburgh\b/gi, 'ED-in-buh-ruh'],
                [/\bBirmingham\b/gi, 'BUR-ming-um'],
                [/\bReykjavík\b/gi, 'RAYK-yuh-veek'],
                [/\bReykjavik\b/gi, 'RAYK-yuh-veek'],
                [/\bDáil\b/gi, 'dawl'],
                [/\bTaoiseach\b/gi, 'TEE-shock'],
                [/\bSaoirse\b/gi, 'SEER-shuh'],
                [/\bSiobhán\b/gi, 'shi-VAWN'],
                [/\bNguyễn\b/gi, 'ngwin'],
                [/\bNguyen\b/gi, 'ngwin'],
                [/\bWagner\b/gi, 'VAHG-ner'],
                [/\bBoeing\b/gi, 'BOH-ing'],
                [/\bHuawei\b/gi, 'wah-WAY'],
                [/\bHyundai\b/gi, 'HYUN-day'],
                [/\bPorsche\b/gi, 'POR-shuh'],
                [/\bQatar\b/gi, 'KUH-tar'],

                // GNN / Master-of-Orion universe names — preserve these project spellings.
                [/\bGNN\b/g, 'G N N'],
                [/\bChyron\b/gi, 'Ky-ron'],
                [/\bBulrathi\b/gi, 'Bull-rah-thee'],
                [/\bMrrshan\b/gi, 'Mur-shahn'],
                [/\bAlkari\b/gi, 'Al-kah-ree'],
                [/\bKlackon\b/gi, 'Klak-on'],
                [/\bPsilon\b/gi, 'Sy-lon'],
                [/\bSakkra\b/gi, 'Sah-kruh'],
                [/\bDarlok\b/gi, 'Dar-lok'],
                [/\bMeklar\b/gi, 'Mek-lar'],
                [/\bSilicoid\b/gi, 'Sill-ih-koyd'],
                [/\bSsyth\b/gi, 'Sissith'],
                [/\bzortrium\b/gi, 'Zor-tree-um'],
                [/\bAntares\b/gi, 'An-tah-reez'],
                [/\bBetelgeuse\b/gi, 'Beetle-juice'],
                [/\bAldebaran\b/gi, 'Al-deb-uh-ran'],
    ];

    function respell(text) {
        let out = text;
        for (const [re, to] of PRONOUNCE) out = out.replace(re, to);
        return out;
    }

    function sanitize(text) {
        return respell(unshout(String(text || '')
        .replace(/\s*—\s*/g, ', ')
        .replace(/[«»"“”]/g, '')
        .replace(/&[a-z]+;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()));
    }

    function trimForSynthesis(text, maxChars = 900) {
        if (text.length <= maxChars) return text;
        const head = text.slice(0, maxChars);
        const stop = Math.max(head.lastIndexOf('. '),
                              head.lastIndexOf('! '),
                              head.lastIndexOf('? '));
        if (stop > maxChars * 0.4) return head.slice(0, stop + 1).trim();
        const space = head.lastIndexOf(' ');
        return (space > 0 ? head.slice(0, space) : head).trim() + '.';
    }

    function estimateMs(text) {
        const words = sanitize(text).split(/\s+/).filter(Boolean).length;
        return Math.max(1200, (words / 2.6) * 1000);
    }

    const FADE = 0.035;
    const TAIL_MS = 280;

    /**
     * Duck the voice stage to silence. Returns ms to wait before cutting.
     */
    function duckVoice() {
        if (!voiceGain || typeof GNNAudio === 'undefined') return 0;
        const ctx = GNNAudio.getContext();
        if (!ctx || !audioEl || audioEl.paused) return 0;
        const t = ctx.currentTime;
        voiceGain.gain.cancelScheduledValues(t);
        voiceGain.gain.setValueAtTime(voiceGain.gain.value, t);
        voiceGain.gain.linearRampToValueAtTime(0.0001, t + FADE);
        return FADE * 1000 + 8;
    }

    let rateTimer = null;
    function cancelRateGlide() {
        if (rateTimer) { clearInterval(rateTimer); rateTimer = null; }
    }

    function cutElement() {
        if (!audioEl) return;
        try { audioEl.pause(); } catch (_) { }
        try { audioEl.removeAttribute('src'); audioEl.load(); } catch (_) { }
        if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
    }

    function stop() {
        const myId = ++requestId;
        awaitingAudio = false;
        const wait = duckVoice();
        if (wait) {
            setTimeout(() => { if (requestId === myId) cutElement(); }, wait);
        } else {
            cutElement();
        }
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            try { window.speechSynthesis.cancel(); } catch (_) { }
        }
        log('stop()');
        finish('stop');
    }

    function openVoiceGate() {
        if (!voiceGain || typeof GNNAudio === 'undefined') return;
        const ctx = GNNAudio.getContext();
        if (!ctx) return;
        const t = ctx.currentTime;
        voiceGain.gain.cancelScheduledValues(t);
        voiceGain.gain.setValueAtTime(0.0001, t);
        voiceGain.gain.linearRampToValueAtTime(1, t + 0.03);
    }

    function finish(reason = 'unknown') {
        if (!speaking) { resolveNow(); return; }
        if (audioEl) {
            log('finish',
                'reason=' + reason,
                'id=' + requestId,
                't=' + (audioEl.currentTime || 0).toFixed(2),
                'dur=' + (isFinite(audioEl.duration) ? audioEl.duration.toFixed(2) : 'NaN'),
                'ready=' + audioEl.readyState,
                'paused=' + audioEl.paused);
        } else {
            log('finish', 'reason=' + reason, 'id=' + requestId, 'no element');
        }
        speaking = false;
        awaitingAudio = false;
        if (typeof GNNAudio !== 'undefined') GNNAudio.duckUnderVoice(false);
        if (onEnd) onEnd();
        resolveNow();
    }

    function resolveNow() {
        const r = currentResolve;
        currentResolve = null;
        if (r) r();
    }

    function browserFallback(text, id) {
        return new Promise((resolve) => {
            if (!window.speechSynthesis) {
                setTimeout(resolve, estimateMs(text));
                return;
            }
            const u = new SpeechSynthesisUtterance(sanitize(text));
            u.rate = 0.98; u.pitch = 0.72;
            u.onend = () => { if (id === requestId) resolve(); };
            u.onerror = () => { if (id === requestId) resolve(); };
            window.speechSynthesis.speak(u);
        });
    }

    // ---------------------------------------------------------
    // Clip fetching
    // ---------------------------------------------------------

    const clipCache = new Map();
    const CLIP_CACHE = 16;
    let objectUrl = null;

    function clipKey(clean, opts) {
        return [clean, opts.voice || voice,
        (opts.pitch !== undefined ? opts.pitch : pitchHz),
                (opts.rate !== undefined ? opts.rate : ratePct)].join('|');
    }

    function buildUrl(clean, opts, seq) {
        return ENDPOINT
        + '?text=' + encodeURIComponent(clean)
        + '&voice=' + encodeURIComponent(opts.voice || voice)
        + '&pitch=' + encodeURIComponent((opts.pitch !== undefined ? opts.pitch : pitchHz) + 'Hz')
        + '&rate=' + encodeURIComponent((opts.rate !== undefined ? opts.rate : ratePct) + '%')
        + '&seq=' + seq
        + '&sid=' + SESSION;
    }

    function fetchClip(clean, opts, seq) {
        const key = clipKey(clean, opts);
        const hit = clipCache.get(key);
        if (hit) {
            log('fetchClip: cache hit', 'seq=' + seq, 'key=' + key.slice(0, 40));
            return hit;
        }
        const t0 = performance.now();
        const pending = fetch(buildUrl(clean, opts, seq))
        .then((r) => {
            const durMs = Math.round(performance.now() - t0);
            if (r.status === 503) {
                log('fetchClip: 503 unavailable', 'seq=' + seq, 'dur=' + durMs + 'ms');
                available = false;
                return null;
            }
            if (!r.ok) {
                log('fetchClip: HTTP ' + r.status, 'seq=' + seq, 'dur=' + durMs + 'ms');
                clipCache.delete(key);
                return null;
            }
            available = true;
            return r.blob().then((blob) => {
                log('fetchClip: synthesis complete', 'seq=' + seq, 'size=' + blob.size + 'B', 'dur=' + durMs + 'ms');
                return blob;
            });
        })
        .catch((err) => {
            const durMs = Math.round(performance.now() - t0);
            log('fetchClip: network error', 'seq=' + seq, 'dur=' + durMs + 'ms', 'err=' + (err && err.message ? err.message : err));
            clipCache.delete(key);
            if (available === null) available = false;
            return null;
        });
        clipCache.set(key, pending);
        while (clipCache.size > CLIP_CACHE) {
            clipCache.delete(clipCache.keys().next().value);
        }
        return pending;
    }

    async function loadCatalogue() {
        try {
            const r = await fetch('api/voices');
            if (!r.ok) return null;
            const cat = await r.json();
            if (cat && cat.voices && cat.voices.length) {
                VOICES.length = 0;
                cat.voices.forEach((v) => VOICES.push(v));
                voice = VOICES[0].id;
            }
            engine = cat && cat.engine;
            cloud = !!(cat && cat.cloud);
            return cat;
        } catch (err) {
            return null;
        }
    }

    function prefetch(text, opts = {}) {
        const clean = sanitize(text);
        if (!enabled || !clean || available === false) return;
        fetchClip(clean, opts, 0);
    }

    function setSource(url) {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = url;
        element().src = url;
    }

    function speak(text, opts = {}) {
        const clean = sanitize(text);
        if (!enabled || !clean) {
            return new Promise((r) => setTimeout(r, opts.silentMs || 300));
        }

        const handoverMs = duckVoice();
        const id = ++requestId;
        if (!handoverMs) cutElement();
        resolveNow();

        const est = estimateMs(clean);
        log('speak start',
            'id=' + id,
            'chars=' + clean.length,
            'est=' + est + 'ms',
            'handover=' + handoverMs + 'ms',
            'voice=' + (opts.voice || voice));

        speaking = true;
        awaitingAudio = true;
        lastLine = { text: clean, opts: opts };
        if (typeof GNNAudio !== 'undefined') {
            GNNAudio.ensureContext();
            GNNAudio.duckUnderVoice(true, { music: opts.duck, effects: opts.duckSfx });
        }
        attachAnalyser();
        if (onStart) onStart();

        return new Promise((resolve) => {
            currentResolve = resolve;

            if (available === false) {
                awaitingAudio = false;
                log('speak: web speech fallback', 'id=' + id);
                browserFallback(clean, id).then(() => {
                    if (id === requestId) finish('webspeech');
                });
                    return;
            }

            const el = element();
            const guardMs = est * 2.2 + 6000;
            const guard = setTimeout(() => {
                if (id !== requestId) return;
                log('guard fired',
                    'id=' + id,
                    'guardMs=' + guardMs,
                    't=' + (el.currentTime || 0).toFixed(2),
                    'dur=' + (isFinite(el.duration) ? el.duration.toFixed(2) : 'NaN'),
                    'paused=' + el.paused,
                    'ready=' + el.readyState);
                cutElement();
                finish('guard');
            }, guardMs);
            const clearGuard = () => clearTimeout(guard);

            el.onended = () => {
                clearGuard();
                if (id !== requestId) return;
                setTimeout(() => { if (id === requestId) finish('onended'); }, TAIL_MS);
            };
            el.onerror = () => {
                clearGuard();
                if (id === requestId) finish('error');
            };

                fetchClip(clean, opts, id).then((blob) => {
                    if (id !== requestId) { clearGuard(); return; }
                    if (!blob) {
                        clearGuard();
                        log('speak: no blob', 'id=' + id, 'available=' + available);
                        if (available === false) {
                            awaitingAudio = false;
                            browserFallback(clean, id).then(() => {
                                if (id === requestId) finish('webspeech');
                            });
                        } else {
                            finish('noblob');
                        }
                        return;
                    }
                    log('speak: blob arrived',
                        'id=' + id,
                        'size=' + blob.size,
                        'blobType=' + blob.type);
                    const begin = () => {
                        if (id !== requestId) { clearGuard(); return; }
                        setSource(URL.createObjectURL(blob));
                        el.playbackRate = opts.playbackRate || 1;
                        openVoiceGate();
                        awaitingAudio = false;
                        const p = el.play();
                        if (p && p.then) {
                            p.then(() => {
                                if (id !== requestId) return;
                                log('speak: play() resolved',
                                    'id=' + id,
                                    'dur=' + (isFinite(el.duration) ? el.duration.toFixed(2) : 'NaN'),
                                    'est=' + est + 'ms');
                            }).catch((err) => {
                                if (id !== requestId) { clearGuard(); return; }
                                // Chromium can reject the play() promise with
                                // "the media was removed from the document"
                                // even though the element plays fine. The
                                // promise's internal resource-selection state
                                // is invalidated by `cutElement()` at the top
                                // of `speak()` — the load() reset there makes
                                // the promise's resource reference stale —
                                // but the element itself uses whatever source
                                // is set by the time it starts.
                                //
                                // Wait a beat, then check whether audio is
                                // actually running. If it is, this is a false
                                // alarm and onended will resolve the line
                                // normally. If it is not, the autoplay policy
                                // really did refuse and the fallback fires.
                                setTimeout(() => {
                                    if (id !== requestId) { clearGuard(); return; }
                                    const playing = audioEl
                                    && !audioEl.paused
                                    && audioEl.currentTime > 0;
                                    if (playing) {
                                        log('speak: play() rejected but element '
                                        + 'is playing — treating as success',
                                        'id=' + id,
                                        'err=' + (err && err.message ? err.message : err));
                                        return;
                                    }
                                    clearGuard();
                                    log('speak: play() refused and element is '
                                    + 'not playing',
                                    'id=' + id,
                                    'err=' + (err && err.message ? err.message : err));
                                    finish('autoplay');
                                }, 400);
                            });
                        } else if (p && p.catch) {
                            p.catch((err) => {
                                if (id !== requestId) { clearGuard(); return; }
                                setTimeout(() => {
                                    if (id !== requestId) { clearGuard(); return; }
                                    const playing = audioEl
                                    && !audioEl.paused
                                    && audioEl.currentTime > 0;
                                    if (playing) {
                                        log('speak: play() rejected but element '
                                        + 'is playing — treating as success',
                                        'id=' + id,
                                        'err=' + (err && err.message ? err.message : err));
                                        return;
                                    }
                                    clearGuard();
                                    log('speak: play() refused and element is '
                                    + 'not playing',
                                    'id=' + id,
                                    'err=' + (err && err.message ? err.message : err));
                                    finish('autoplay');
                                }, 400);
                            });
                        }
                    };
                    if (handoverMs > 0) setTimeout(begin, handoverMs); else begin();
                });
        });
    }

    // ---------------------------------------------------------
    // Voice controls
    // ---------------------------------------------------------

    function setVoice(v) {
        if (!v || v === voice) return;
        voice = v;
        if (!speaking || !lastLine) return;
        const pending = currentResolve;
        currentResolve = null;
        speak(lastLine.text, lastLine.opts);
        currentResolve = pending;
    }
    function getVoice() { return voice; }
    function getVoiceName() {
        const v = VOICES.find((x) => x.id === voice);
        if (!v) return '';
        return String(v.label).split('—')[0].trim();
    }
    function setEnabled(v) { enabled = !!v; if (!enabled) { cancelRateGlide(); stop(); } }
    function isEnabled() { return enabled; }
    function isSpeaking() { return speaking; }
    function setPitch(hz) { pitchHz = hz; }
    function setRate(pct) { ratePct = pct; }
    function nudgePlaybackRate(r) {
        if (!audioEl) return;
        if (rateTimer) { clearInterval(rateTimer); rateTimer = null; }
        const from = audioEl.playbackRate || 1;
        const steps = 8;
        let i = 0;
        rateTimer = setInterval(() => {
            i++;
            if (!audioEl) { clearInterval(rateTimer); rateTimer = null; return; }
            audioEl.playbackRate = from + (r - from) * (i / steps);
            if (i >= steps) { clearInterval(rateTimer); rateTimer = null; }
        }, 12);
    }

    function waitingForAudio() {
        if (!speaking) return false;
        if (available === false) return false;
        return awaitingAudio;
    }

    return {
        VOICES, speak, prefetch, stop, unlock, getLevel, estimateMs,
        playbackProgress: () => {
            if (!speaking || !audioEl) return null;
            const d = audioEl.duration;
            if (!isFinite(d) || d <= 0) return null;
            return Math.max(0, Math.min(1, audioEl.currentTime / d));
        },
        waitingForAudio,
        trimForSynthesis,
        loadCatalogue, getEngine: () => engine, isCloud: () => cloud,
                setVoice, getVoice, getVoiceName, setEnabled, isEnabled, isSpeaking,
                setPitch, setRate, nudgePlaybackRate,
                set onStart(fn) { onStart = fn; },
                set onEnd(fn) { onEnd = fn; },
    };
})();
