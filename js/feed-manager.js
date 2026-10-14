/* ============================================================
   GNN — Feed Manager (Curated News RSS Feeds & Strict Ad Filters)
   ============================================================ */

const GNNFeedManager = (() => {
    const RSS2JSON_API = 'https://api.rss2json.com/v1/api.json';
    const POLL_INTERVAL_MS = 2 * 60 * 1000; // Poll every 2 minutes

    // Curated high-quality world, tech, space & science feeds (zero ads / sponsored junk)
    // Tagged by the show block that wants them, per docs/ROADMAP.md §4:
    // Morning Index, Main News Desk, Sports / Fleet Briefs, Diplomatic Hour,
    // Late Night Anomaly Log. Nothing reads the tag yet — the scheduler is
    // still to build — but the categories are the reason a feed is on the
    // list, and an untagged list is how it ended up seventeen tech feeds
    // deep with no sport, no markets and no oddities for four of the five
    // blocks to draw on.
    //
    // Verified through rss2json, which is the only path the app has: a feed
    // can answer 200 directly and still come back empty here.
    // `space.com/feeds/all` does exactly that — 0 items on every probe —
    // and is dropped. `nasa.gov/rss/dyn/breaking_news.rss` 301s directly but
    // resolves fine through rss2json, so it stays.
    const FEEDS = [
        // --- Main News Desk: world and general ---
        { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', cat: 'world' },
        { url: 'https://www.aljazeera.com/xml/rss/all.xml', cat: 'world' },
        { url: 'https://feeds.arstechnica.com/arstechnica/index', cat: 'tech' },
        { url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', cat: 'tech' },
        { url: 'https://techcrunch.com/feed/', cat: 'tech' },
        { url: 'https://www.theverge.com/rss/index.xml', cat: 'tech' },
        { url: 'https://www.wired.com/feed/rss', cat: 'tech' },
        { url: 'https://news.ycombinator.com/rss', cat: 'tech' },
        { url: 'https://www.technologyreview.com/feed/', cat: 'tech' },

        // --- Sports / Fleet Briefs: launches, missions, and actual sport ---
        { url: 'https://spaceflightnow.com/feed/', cat: 'fleet' },
        { url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss', cat: 'fleet' },
        { url: 'https://www.esa.int/rssfeed/Our_Activities/Space_News', cat: 'fleet' },
        { url: 'https://feeds.bbci.co.uk/sport/rss.xml', cat: 'sport' },
        { url: 'https://www.espn.com/espn/rss/news', cat: 'sport' },

        // --- Morning Index: markets and money ---
        { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', cat: 'markets' },
        { url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', cat: 'markets' }, // Replaced failing CNBC feed

        // --- Diplomatic Hour ---
        { url: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml', cat: 'diplomacy' },
        { url: 'https://feeds.bbci.co.uk/news/politics/rss.xml', cat: 'diplomacy' },

        // --- Late Night Anomaly Log: odd science, deep space, the weird ---
        { url: 'https://www.sciencedaily.com/rss/strange_offbeat.xml', cat: 'anomaly' },
        { url: 'https://phys.org/rss-feed/', cat: 'anomaly' },
        { url: 'https://www.livescience.com/feeds/all', cat: 'anomaly' },
        { url: 'https://feeds.arstechnica.com/arstechnica/science', cat: 'science' },
        { url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', cat: 'science' },
        { url: 'https://www.nature.com/nature.rss', cat: 'science' },
    ];

    const DEFAULT_FEEDS = FEEDS.map((f) => f.url);
    const FEED_CATEGORY = new Map(FEEDS.map((f) => [f.url, f.cat]));


    // Filter out sponsored ads, deals, shopping links, and podcasts
    const AD_KEYWORDS = [
        'SPONSORED', 'PROMOTED', 'DISCOUNT', 'DEAL:', 'DEALS:', 'SAVE $', '% OFF', 'COUPON',
        'BUY NOW', 'NEWSLETTER', 'PODCAST:', 'EPISODE ', 'SUBSCRIBE', 'AFFILIATE',
        'ADVERTISEMENT', 'SPONSORED BY', 'PARTNER CONTENT', 'BEST DEALS', 'SHOP NOW',
        'CHROMEBOOK', 'IPHONE DEAL', 'MACBOOK SALE'
    ];

    // This is designed to run as a channel, for days. Both of these grow on
    // every poll, so both need a ceiling.
    const POOL_LIMIT = 400;
    const SEEN_LIMIT = 2000;

    // How many feeds one poll may ask rss2json for, and where the
    // next poll picks up.
    const POLL_BATCH = 8;
    let pollCursor = 0;
    let feeds = [...DEFAULT_FEEDS];
    let rssPool = [];           // Array of clean RSS stories fetched
    let seenTitles = new Set();
    let broadcast = new Set();   // titles already put to air this cycle
    let pollTimer = null;
    let pollInProgress = false;
    let onNewItems = null;      // callback: (items[]) => void
    let onStatusChange = null;  // callback: (status: string, isError: boolean) => void

    /** Strip HTML tags from string */
    function stripHtml(html) {
        const value = String(html || '');
        // RSS descriptions are often HTML fragments. Use the DOM parser when
        // available; keep a conservative fallback for tests/non-browser runs.
        if (typeof document !== 'undefined' && document.createElement) {
            const tmp = document.createElement('div');
            tmp.innerHTML = value;
            return (tmp.textContent || tmp.innerText || '').trim();
        }
        return value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
            .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>').replace(/\s+/g, ' ').trim();
    }

    /** Truncate text cleanly at sentence boundary */
    function truncateSentenceCleanly(text, maxChars = 280) {
        if (!text) return '';
        let clean = text.trim();
        if (clean.length <= maxChars) {
            if (clean && !/[.!?]$/.test(clean)) clean += '.';
            return clean;
        }

        const target = clean.substring(0, maxChars);
        const lastPunct = Math.max(
            target.lastIndexOf('. '),
            target.lastIndexOf('! '),
            target.lastIndexOf('? '),
            target.lastIndexOf('.\n')
        );

        if (lastPunct > 80) {
            return target.substring(0, lastPunct + 1).trim();
        }

        const lastSpace = target.lastIndexOf(' ');
        if (lastSpace > 50) {
            return target.substring(0, lastSpace).trim() + '...';
        }

        return target.trim() + '...';
    }

    /** Clean title and description of boilerplates (e.g., 'Comments', 'Article URL') */
    function cleanFeedText(str) {
        if (!str) return '';
        let cleaned = stripHtml(str)
            // Broadcast labels that some feeds put in front of a headline.
            // The BBC's video and live-coverage stories lead with "Watch:",
            // "Watch live:" or "Live:" — the wire is telling its own reader
            // that the item is a video, and the label survives into the
            // anchor's mouth where it reads as a stutter ("Watch. UK PM
            // Andy Burnham says..."). Not part of the headline; not read.
            .replace(/^\s*(watch\s*live|watch|video|live)\s*:\s*/i, '')
            .replace(/Article URL:.*$/i, '')
            .replace(/Comments$/i, '')
            .replace(/—\s*Comments$/i, '')
            .replace(/\s*-\s*Comments$/i, '')
            .replace(/Read more\.\.\.$/i, '')
            .replace(/\[\.\.\.\]/g, '')
            .replace(/Copyright.*$/i, '')
            .replace(/\bVideo:\s*\d{1,2}:\d{2}(:\d{2})?/gi, '')
            .replace(/\bDuration:\s*\d{1,2}:\d{2}(:\d{2})?/gi, '')
            .replace(/\bImage source,?\s*/gi, '')
            .replace(/\bGetty Images\b/gi, '')
            .trim();
        if (/^comments?$/i.test(cleaned)) return '';
        return cleaned;
    }

    /** Check if story is a valid news headline (reject ads/promos) */
    function isValidStory(title, desc) {
        if (!title || title.length < 15) return false;
        const text = `${title} ${desc}`.toUpperCase();
        if (AD_KEYWORDS.some(kw => text.includes(kw))) return false;
        return true;
    }

    /** Stable comparison key: collapse case, punctuation and whitespace variants. */
    function titleKey(title) {
        return String(title || '').toLowerCase()
            .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, ' ').trim();
    }

    /**
     * Primary entity a story is *about*, used to keep the rundown from running
     * four consecutive SpaceX items when every feed covers the same launch.
     * Ordered most specific first: a Starship story is SPACEX, not SPACE.
     */
    const TOPIC_ENTITIES = [
        ['SPACEX', ['spacex', 'starship', 'falcon 9', 'falcon heavy', 'starlink', 'raptor']],
        ['NASA', ['nasa', 'artemis', 'jwst', 'james webb', 'perseverance', 'voyager', 'ingenuity']],
        ['ESA', ['esa', 'european space agency', 'ariane', 'rosalind franklin']],
        ['BLUEORIGIN', ['blue origin', 'new glenn', 'new shepard']],
        ['OPENAI', ['openai', 'chatgpt', 'gpt-4', 'gpt-5', 'sam altman']],
        ['ANTHROPIC', ['anthropic', 'claude']],
        ['GOOGLE', ['google', 'alphabet', 'deepmind', 'gemini', 'android', 'pixel']],
        ['APPLE', ['apple', 'iphone', 'ipad', 'macos', 'vision pro']],
        ['MICROSOFT', ['microsoft', 'windows', 'azure', 'copilot', 'xbox']],
        ['META', ['meta', 'facebook', 'instagram', 'whatsapp', 'zuckerberg']],
        ['AMAZON', ['amazon', 'aws', 'kuiper']],
        ['NVIDIA', ['nvidia', 'cuda', 'blackwell']],
        ['TESLA', ['tesla', 'cybertruck', 'robotaxi']],
        ['AI', ['artificial intelligence', 'machine learning', 'neural network',
            'large language model', ' llm ', 'chatbot']],
        ['UKRAINE', ['ukraine', 'ukrainian', 'kyiv', 'zelensky']],
        ['MIDEAST', ['gaza', 'israel', 'hamas', 'hezbollah', 'palestinian', 'west bank']],
        ['CHINA', ['china', 'chinese', 'beijing', 'taiwan', 'xi jinping']],
        ['RUSSIA', ['russia', 'russian', 'moscow', 'kremlin', 'putin']],
        ['CLIMATE', ['climate', 'emissions', 'global warming', 'carbon', 'wildfire', 'hurricane']],
        ['QUANTUM', ['quantum', 'qubit']],
        ['FUSION', ['fusion', 'tokamak', 'iter ', 'plasma confinement']],
        ['CRYPTO', ['bitcoin', 'ethereum', 'crypto', 'blockchain']],
        ['SECURITY', ['ransomware', 'data breach', 'vulnerability', 'zero-day', 'malware']],
        ['HEALTH', ['vaccine', 'outbreak', 'cancer', 'alzheimer', 'clinical trial', 'fda ']],
    ];

    /**
     * Tag a story with its primary entity. Stories that match nothing get a
     * null tag and are exempt from the spacing rule — they are not a cluster,
     * so lumping them under one bucket would only starve the rundown.
     */
    function extractTopic(title, desc) {
        const text = ` ${title} ${desc} `.toLowerCase();
        for (const [tag, needles] of TOPIC_ENTITIES) {
            if (needles.some((n) => text.includes(n))) return tag;
        }
        // Fall back to the icon subject — coarser than a named entity, but it
        // still separates two consecutive outbreak stories from each other.
        const label = GNNIconManager.matchLabel(title, desc);
        return label ? `SUBJ:${label}` : null;
    }

    /** Score stories for rundown priority without rewarding accidental substrings. */
    function calculateImportance(title, desc) {
        const text = `${title} ${desc}`.toUpperCase();
        let score = 0;
        const priorityPhrases = [
            ['BREAKING', 12], ['URGENT', 10], ['CRITICAL', 10],
            ['FIRST TIME', 8], ['REVEALS', 6], ['ANNOUNCES', 5],
            ['LAUNCH', 5], ['THREAT', 7], ['COLLISION', 8],
            ['OUTBREAK', 8], ['SABOTAGE', 8], ['INVASION', 8],
            ['DISASTER', 8], ['HISTORIC', 6], ['NEW MODEL', 4],
            ['QUANTUM', 3], ['FUSION', 3], ['SUPERCONDUCTOR', 4],
            ['NASA', 2], ['ESA', 2], ['SPACE', 1], ['WAR', 5]
        ];
        for (const [phrase, weight] of priorityPhrases) {
            // Match whole words/phrases, so "AI" does not score "SAID" and
            // "WAR" does not score "WARMING".
            const escaped = phrase.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
            const pattern = new RegExp(`(?:^|[^A-Z0-9])${escaped}(?=$|[^A-Z0-9])`, 'g');
            const matches = text.match(pattern);
            if (matches) score += Math.min(matches.length, 2) * weight;
        }
        // Small stable variation based on the title avoids reshuffling identical
        // stories on each poll while retaining a little tie-breaking variety.
        const key = titleKey(title);
        let hash = 0;
        for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
        score += (hash % 100) / 100;
        return score;
    }

    /** Fetch single feed via rss2json */
    async function fetchFeed(url, retries = 2) {
        const apiUrl = `${RSS2JSON_API}?rss_url=${encodeURIComponent(url)}`;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
                const timeout = controller ? setTimeout(() => controller.abort(), 12000) : null;
                let resp;
                try {
                    resp = await fetch(apiUrl, controller ? { signal: controller.signal } : undefined);
                } finally {
                    if (timeout) clearTimeout(timeout);
                }
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const data = await resp.json();
                if (data.status !== 'ok') throw new Error(data.message || 'Feed error');

                const validItems = [];
                for (const item of (data.items || [])) {
                    const rawTitle = cleanFeedText(item.title || '');
                    const rawDesc = cleanFeedText(item.description || item.content || '');

                    const title = rawTitle.toUpperCase();
                    const desc = (rawDesc.length > 0 && !/^comments?$/i.test(rawDesc))
                        ? truncateSentenceCleanly(rawDesc, 280)
                        : '';

                    if (!isValidStory(title, desc)) continue;

                    const matchedIcon = GNNIconManager.matchIcon(title, desc);
                    const importance = calculateImportance(title, desc);
                    const timestamp = Date.parse(item.pubDate || '') || 0;
                    const topic = extractTopic(rawTitle, rawDesc);

                    validItems.push({
                        title,
                        titleKey: titleKey(title),
                        // Keep the original casing: the script writer mines
                        // proper nouns out of it, and an upper-cased headline
                        // makes every word look like a place name.
                        titleRaw: rawTitle,
                        description: desc,
                        icon: matchedIcon,
                        link: item.link,
                        pubDate: item.pubDate || '',
                        timestamp: timestamp,
                        importance: importance,
                        topic: topic,
                        // Which show block wants this story. Nothing reads
                        // it yet; the scheduler in ROADMAP.md §4 will.
                        category: FEED_CATEGORY.get(url) || 'world'
                    });
                }
                return validItems;
            } catch (err) {
                if (attempt === retries) throw err;
                await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
            }
        }
    }

    /** Fetch all RSS feeds */
    async function pollAll() {
        // A slow request must not overlap the next interval and duplicate work.
        if (pollInProgress) return;
        pollInProgress = true;
        setStatus('Fetching live RSS feeds…', false);
        let fetchedItems = [];
        let successCount = 0;

        // A rotating slice, not the whole list.
        //
        // rss2json's free tier rate-limits a burst: asking for all
        // twenty-five at once returned 429 for most of them and the
        // rundown came up empty, which is how the channel sat in DRY with
        // nothing to read. Eight per poll stays under it, and the window
        // advances so every feed is reached within a few polls — which is
        // fine for a channel that runs for days.
        const slice = [];
        for (let i = 0; i < Math.min(POLL_BATCH, feeds.length); i++) {
            slice.push(feeds[(pollCursor + i) % feeds.length]);
        }
        pollCursor = (pollCursor + slice.length) % Math.max(1, feeds.length);

        for (const url of slice) {
            try {
                const items = await fetchFeed(url);
                fetchedItems = fetchedItems.concat(items);
                successCount++;
            } catch (err) {
                console.warn(`[GNN Feed] Feed error (${url}):`, err.message);
            }
        }

        // rss2json has a daily cap. Reached, every feed errors at once and
        // the channel has nothing to read — which looks exactly like a
        // broken feed list and is not. The server serves the Kaiacord daily
        // digest off disk, which cannot rate-limit.
        if (fetchedItems.length === 0) {
            try {
                const local = await fetch('/api/localnews').then((r) => r.json());
                const now = Date.now();
                for (const it of (local.items || [])) {
                    if (!isValidStory(it.title, it.description)) continue;
                    const localTitle = cleanFeedText(it.title || '');
                    const localDesc = cleanFeedText(it.description || '');
                    fetchedItems.push({
                        title: localTitle.toUpperCase(),
                        titleRaw: localTitle,
                        titleKey: titleKey(localTitle),
                        description: localDesc,
                        icon: GNNIconManager.matchIcon(localTitle, localDesc),
                        link: '',
                        pubDate: new Date(now).toISOString(),
                        timestamp: now,
                        importance: calculateImportance(localTitle, localDesc),
                        topic: extractTopic(localTitle, localDesc),
                        category: it.category || 'world',
                    });
                }
                if (fetchedItems.length) {
                    setStatus(`Wire unavailable — local digest (${local.source})`, false);
                }
            } catch (err) {
                console.warn('[GNN Feed] local digest unavailable:', err.message);
            }
        }

        if (fetchedItems.length === 0) {
            if (rssPool.length > 0) {
                setStatus(`Live — ${rssPool.length} stories in RSS pool`, false);
                replenishQueue();
            } else {
                setStatus('Connecting to RSS feeds…', true);
            }
            pollInProgress = false;
            return;
        }

        // Deduplicate and store in rssPool
        const newItems = [];
        for (const item of fetchedItems) {
            const key = item.titleKey || titleKey(item.title);
            if (key && !seenTitles.has(key)) {
                item.titleKey = key;
                seenTitles.add(key);
                rssPool.push(item);
                newItems.push(item);
            }
        }

        if (onNewItems && newItems.length > 0) {
            newItems.forEach((i) => broadcast.add(i.titleKey || titleKey(i.title)));
            onNewItems(newItems);
        }

        prunePool();
        setStatus(`Live RSS — ${rssPool.length} stories loaded (${successCount}/${slice.length} feeds checked)`, false);
        pollInProgress = false;
    }

    /** Evict the oldest stories once the pool passes its ceiling. */
    function prunePool() {
        if (rssPool.length > POOL_LIMIT) {
            rssPool.sort((a, b) => b.timestamp - a.timestamp);
            for (const dropped of rssPool.splice(POOL_LIMIT)) {
                seenTitles.delete(dropped.titleKey || titleKey(dropped.title));
                broadcast.delete(dropped.titleKey || titleKey(dropped.title));
            }
        }
        if (seenTitles.size > SEEN_LIMIT) {
            const live = new Set(rssPool.map((i) => i.titleKey || titleKey(i.title)));
            for (const t of seenTitles) {
                if (seenTitles.size <= SEEN_LIMIT) break;
                if (!live.has(t)) seenTitles.delete(t);
            }
        }
    }

    // Words too common to tell two stories apart. Deliberately short: the
    // test below leans on how rare a word is in the pool rather than on a
    // list somebody has to maintain.
    const STOPWORDS = new Set([
        'after', 'about', 'above', 'again', 'their', 'there', 'these',
        'those', 'where', 'which', 'while', 'with', 'from', 'into', 'over',
        'under', 'before', 'during', 'between', 'first', 'could', 'would',
        'should', 'says', 'said', 'will', 'more', 'most', 'than', 'that',
        'this', 'they', 'them', 'been', 'being', 'have', 'what', 'when',
        'your', 'news', 'report', 'reports', 'update',
    ]);

    /** Significant words in a headline: long enough and not furniture. */
    function keywords(title) {
        return new Set(String(title || '').toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter((w) => w.length >= 4 && !STOPWORDS.has(w)));
    }

    /**
     * How many items in the pool use each significant word.
     *
     * A word used by two or three headlines out of two hundred is naming
     * something — a storm, a company, a spacecraft. A word used by forty is
     * naming a category. Rarity is what separates them, and it costs nothing
     * to measure, where a hand-written list of topics would need feeding.
     */
    function documentFrequency() {
        const df = new Map();
        rssPool.forEach((item) => {
            keywords(item.title).forEach((w) => df.set(w, (df.get(w) || 0) + 1));
        });
        return df;
    }

    // A word this rare in the pool is a name, not a topic.
    const DISTINCTIVE_DF = 5;

    /**
     * Is this story about the same thing as one already in the rundown?
     *
     * Exact-title matching does not catch it. The BBC science feed served
     * four separate Hurricane Isaias stories in one pull — different
     * headlines, different summaries, all dated that morning, and the
     * rundown read them back to back, which is heard as the anchor saying
     * the same thing twice.
     *
     * Two headlines are the same story when they share a word that almost
     * nothing else in the pool uses. One shared rare word is enough — these
     * four shared only "isaias" between some pairs — but it has to be rare,
     * or every story mentioning "space" collapses into one.
     */
    function sameSubject(title, others, df) {
        const mine = keywords(title);
        for (const other of others) {
            for (const w of keywords(other)) {
                if (mine.has(w) && (df.get(w) || 0) <= DISTINCTIVE_DF) return true;
            }
        }
        return false;
    }

    /** Top the director's rundown back up from the deduplicated RSS pool. */
    function replenishQueue() {
        if (!onNewItems || rssPool.length === 0) return;

        const rundown = (typeof GNNDirector !== 'undefined' && GNNDirector.getQueue)
            ? GNNDirector.getQueue() : [];
        const onAir = (typeof GNNDirector !== 'undefined' && GNNDirector.getCurrent)
            ? GNNDirector.getCurrent() : null;

        const queued = new Set(rundown.map((q) => q.titleKey || titleKey(q.title)));
        if (onAir) queued.add(onAir.titleKey || titleKey(onAir.title));

        const fresh = rssPool.filter((item) => !queued.has(item.titleKey || titleKey(item.title)) && !broadcast.has(item.titleKey || titleKey(item.title)));
        if (fresh.length) {
            fresh.sort((a, b) => b.timestamp - a.timestamp);
            // One story per subject in a batch, and none repeating what is
            // already in the rundown. The rest stay in the pool for a later
            // block, which is what a channel does with a running story.
            const df = documentFrequency();
            const taken = Array.from(queued);
            const batch = [];
            for (const item of fresh) {
                if (batch.length >= 6) break;
                if (sameSubject(item.title, taken, df)) continue;
                batch.push(item);
                taken.push(item.title);
            }
            if (!batch.length) batch.push(fresh[0]);
            batch.forEach((i) => broadcast.add(i.titleKey || titleKey(i.title)));
            onNewItems(batch);
            return;
        }

        // Everything in the pool has aired. Start the cycle over rather than
        // going silent — a station with nothing new still has a rundown.
        broadcast.clear();
        const recycled = rssPool
            .filter((item) => !queued.has(item.titleKey || titleKey(item.title)))
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 6);
        if (recycled.length) {
            recycled.forEach((i) => broadcast.add(i.titleKey || titleKey(i.title)));
            onNewItems(recycled);
        }
    }

    function setStatus(text, isError) {
        if (onStatusChange) onStatusChange(text, isError);
    }

    function start() {
        if (pollTimer) return;
        pollAll();
        pollTimer = setInterval(pollAll, POLL_INTERVAL_MS);
    }

    function stop() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    function addFeed(url) {
        if (url && !feeds.includes(url)) {
            feeds.push(url);
            pollAll();
            return true;
        }
        return false;
    }

    function removeFeed(url) {
        feeds = feeds.filter(f => f !== url);
    }

    function getFeeds() { return [...feeds]; }
    function getRssPool() { return [...rssPool]; }

    return {
        start,
        stop,
        addFeed,
        removeFeed,
        getFeeds,
        getRssPool,
        replenishQueue,
        set onNewItems(fn) { onNewItems = fn; },
        set onStatusChange(fn) { onStatusChange = fn; },
    };
})();