/* ============================================================
   GNN — Feed Manager (Curated News RSS Feeds & Strict Ad Filters)
   ============================================================ */

const GNNFeedManager = (() => {
    const RSS2JSON_API = 'https://api.rss2json.com/v1/api.json';
    const POLL_INTERVAL_MS = 2 * 60 * 1000; // Poll every 2 minutes

    // Curated high-quality world, tech, space & science feeds (zero ads / sponsored junk)
    const DEFAULT_FEEDS = [
        'https://feeds.arstechnica.com/arstechnica/index',
        'https://feeds.arstechnica.com/arstechnica/science',
        'https://www.nasa.gov/rss/dyn/breaking_news.rss',
        'https://www.space.com/feeds/all',
        'https://spaceflightnow.com/feed/',
        'https://www.esa.int/rssfeed/Our_Activities/Space_News',
        'https://feeds.bbci.co.uk/news/world/rss.xml',
        'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
        'https://feeds.bbci.co.uk/news/technology/rss.xml',
        'https://www.aljazeera.com/xml/rss/all.xml',
        'https://www.technologyreview.com/feed/',
        'https://news.ycombinator.com/rss',
        'https://www.wired.com/feed/rss',
        'https://techcrunch.com/feed/',
        'https://www.theverge.com/rss/index.xml',
        'https://search.cnbc.com/rs/search/combinednewsletter/rss?partnerId=wrss01&id=100003114',
        'https://www.nature.com/nature.rss'
    ];

    // Filter out sponsored ads, deals, shopping links, and podcasts
    const AD_KEYWORDS = [
        'SPONSORED', 'PROMOTED', 'DISCOUNT', 'DEAL:', 'DEALS:', 'SAVE $', '% OFF', 'COUPON',
        'BUY NOW', 'NEWSLETTER', 'PODCAST:', 'EPISODE ', 'SUBSCRIBE', 'AFFILIATE',
        'ADVERTISEMENT', 'SPONSORED BY', 'PARTNER CONTENT', 'BEST DEALS', 'SHOP NOW',
        'CHROMEBOOK', 'IPHONE DEAL', 'MACBOOK SALE'
    ];

    let feeds = [...DEFAULT_FEEDS];
    let rssPool = [];           // Array of clean RSS stories fetched
    let seenTitles = new Set();
    let broadcast = new Set();   // titles already put to air this cycle
    let pollTimer = null;
    let onNewItems = null;      // callback: (items[]) => void
    let onStatusChange = null;  // callback: (status: string, isError: boolean) => void

    /** Strip HTML tags from string */
    function stripHtml(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return (tmp.textContent || tmp.innerText || '').trim();
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

    /** Calculate the story's agentic importance score */
    function calculateImportance(title, desc) {
        let score = 0;
        const text = `${title} ${desc}`.toUpperCase();
        
        // Priority news keywords
        const priorityKeywords = [
            'BREAKING', 'CRITICAL', 'DISCOVERY', 'ANNOUNCES', 'FIRST TIME', 'REVEALS', 'LAUNCH', 
            'THREAT', 'DANGER', 'COLLISION', 'OUTBREAK', 'SABOTAGE', 'WAR ', 'INVASION', 'DISASTER',
            'NEW MODEL', 'AI', 'QUANTUM', 'FUSION', 'SUPERCONDUCTOR', 'NASA', 'ESA', 'SPACE', 'HISTORIC'
        ];
        
        priorityKeywords.forEach(kw => {
            if (text.includes(kw)) score += 10;
        });

        // Add small random weight to avoid deterministic ordering for same-priority items
        score += Math.random() * 5;
        
        return score;
    }

    /** Fetch single feed via rss2json */
    async function fetchFeed(url, retries = 2) {
        const apiUrl = `${RSS2JSON_API}?rss_url=${encodeURIComponent(url)}`;
        
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const resp = await fetch(apiUrl);
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
                    const timestamp = Date.parse(item.pubDate || new Date().toISOString()) || Date.now();
                    
                    validItems.push({
                        title,
                        // Keep the original casing: the script writer mines
                        // proper nouns out of it, and an upper-cased headline
                        // makes every word look like a place name.
                        titleRaw: rawTitle,
                        description: desc,
                        icon: matchedIcon,
                        link: item.link,
                        pubDate: item.pubDate || new Date().toISOString(),
                        timestamp: timestamp,
                        importance: importance
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
        setStatus('Fetching live RSS feeds…', false);
        let fetchedItems = [];
        let successCount = 0;

        for (const url of feeds) {
            try {
                const items = await fetchFeed(url);
                fetchedItems = fetchedItems.concat(items);
                successCount++;
            } catch (err) {
                console.warn(`[GNN Feed] Feed error (${url}):`, err.message);
            }
        }

        if (fetchedItems.length === 0) {
            if (rssPool.length > 0) {
                setStatus(`Live — ${rssPool.length} stories in RSS pool`, false);
                replenishQueue();
            } else {
                setStatus('Connecting to RSS feeds…', true);
            }
            return;
        }

        // Deduplicate and store in rssPool
        const newItems = [];
        for (const item of fetchedItems) {
            if (item.title && !seenTitles.has(item.title)) {
                seenTitles.add(item.title);
                rssPool.push(item);
                newItems.push(item);
            }
        }

        if (onNewItems && newItems.length > 0) {
            newItems.forEach((i) => broadcast.add(i.title));
            onNewItems(newItems);
        }

        setStatus(`Live RSS — ${rssPool.length} stories loaded (${successCount}/${feeds.length} feeds)`, false);
    }

    /** Top the director's rundown back up from the deduplicated RSS pool. */
    function replenishQueue() {
        if (!onNewItems || rssPool.length === 0) return;

        const rundown = (typeof GNNDirector !== 'undefined' && GNNDirector.getQueue)
            ? GNNDirector.getQueue() : [];
        const onAir = (typeof GNNDirector !== 'undefined' && GNNDirector.getCurrent)
            ? GNNDirector.getCurrent() : null;

        const queued = new Set(rundown.map((q) => q.title));
        if (onAir) queued.add(onAir.title);

        const fresh = rssPool.filter((item) => !queued.has(item.title) && !broadcast.has(item.title));
        if (fresh.length) {
            fresh.sort((a, b) => b.timestamp - a.timestamp);
            const batch = fresh.slice(0, 6);
            batch.forEach((i) => broadcast.add(i.title));
            onNewItems(batch);
            return;
        }

        // Everything in the pool has aired. Start the cycle over rather than
        // going silent — a station with nothing new still has a rundown.
        broadcast.clear();
        const recycled = rssPool
            .filter((item) => !queued.has(item.title))
            .sort(() => Math.random() - 0.5)
            .slice(0, 6);
        if (recycled.length) {
            recycled.forEach((i) => broadcast.add(i.title));
            onNewItems(recycled);
        }
    }

    function setStatus(text, isError) {
        if (onStatusChange) onStatusChange(text, isError);
    }

    function start() {
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
