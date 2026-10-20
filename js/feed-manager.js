/* ============================================================
   GNN — Feed Manager (Curated News RSS Feeds & Strict Ad Filters)
   ============================================================ */

const GNNFeedManager = (() => {
    const FEED_PROXY_API = '/api/feed?url=';
    // Keep polling conservative so a page reload or another station instance
    // cannot trigger a rapid upstream request loop.
    const POLL_INTERVAL_MS = 15 * 60 * 1000;
    const POLL_JITTER_MS = 60 * 1000;
    const BACKOFF_BASE_MS = 5 * 60 * 1000;
    const BACKOFF_MAX_MS = 6 * 60 * 60 * 1000;
    const FAILURE_TRIP = 5;

    // Curated high-quality world, tech, space & science feeds (zero ads / sponsored junk)
    // Tagged by the show block that wants them, per docs/ROADMAP.md §4:
    // Morning Index, Main News Desk, Sports / Fleet Briefs, Diplomatic Hour,
    // Late Night Anomaly Log. Nothing reads the tag yet — the scheduler is
    // still to build — but the categories are the reason a feed is on the
    // list, and an untagged list is how it ended up seventeen tech feeds
    // deep with no sport, no markets and no oddities for four of the five
    // blocks to draw on.
    //
    // Curated upstream RSS/Atom endpoints fetched by the same-origin server
    // proxy. `space.com/feeds/all` returned no items during prior probes and
    // is dropped; feeds are parsed directly from their XML responses.
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

        // --- Weather desk: Sector Weather Watch and Solar Wind Overnight ---
        // The two weather shows read stories the weather regex catches and
        // fell back to science and space; these give them a beat of their
        // own. Both checked live before adding: real weather news (fires,
        // floods, storms) and storm-tracking forecasts. GDACS was tried and
        // left out — its items read as machine alerts on air.
        { url: 'https://www.theguardian.com/world/extreme-weather/rss', cat: 'weather' },
        { url: 'https://www.severe-weather.eu/feed/', cat: 'weather' },

        // --- Late Night Anomaly Log: odd science, deep space, the weird ---
        { url: 'https://www.sciencedaily.com/rss/strange_offbeat.xml', cat: 'anomaly' },
        { url: 'https://phys.org/rss-feed/', cat: 'anomaly' },
        { url: 'https://www.livescience.com/feeds.xml', cat: 'anomaly' },
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

    // Digest placeholders describe an empty category, not a news story.
    // Keep this deliberately narrow so real headlines such as "No survivors
    // found..." are not rejected.
    const NON_STORY_TITLE = /^\s*(?:no\b.{0,60}\b(?:news|update|updates|developments?|stories|reports?|details)|nothing\s+to\s+report|no\s+further\s+(?:details|information|comment)|no\s+verified\s+developments?|no\s+verifiable\s+quote|more\s+on\s+this\s+later|developing\s+story)(?:\s+(?:today|yet|so\s+far|at\s+this\s+time|available|reported))?\s*[.!]?\s*$/i;

    // This is designed to run as a channel, for days. Both of these grow on
    // every poll, so both need a ceiling.
    const POOL_LIMIT = 400;
    const SEEN_LIMIT = 2000;

    // Durable story ledger. localStorage keeps the station safe across reloads;
    // /api/news-ledger can mirror the same records to a server-side JSON file
    // shared by browsers/stations. The backend route is provided in the ZIP's
    // server integration guide; without it, browser persistence still works.
    const LEDGER_STORAGE_KEY = 'gnn.newsLedger.v1';
    const LEDGER_ENDPOINT = '/api/news-ledger';
    const LEDGER_STOPWORDS = new Set([
        'about', 'after', 'against', 'amid', 'among', 'and', 'are', 'around', 'been', 'before',
        'being', 'between', 'but', 'can', 'could', 'from', 'have', 'into', 'just', 'more', 'most',
        'new', 'news', 'over', 'says', 'said', 'that', 'the', 'their', 'there', 'these', 'this',
        'those', 'through', 'today', 'under', 'update', 'updates', 'was', 'were', 'what', 'when',
        'where', 'which', 'while', 'with', 'will', 'would'
    ]);

    // How many feeds one poll may ask rss2json for, and where the
    // next poll picks up.
    //
    // Was 8. rss2json rate-limits anonymous callers aggressively, and
    // three back-to-back batches of 8 (the boot sweep) was the whole
    // budget. Every feed in the second and third batch came back 429,
    // the failure counter tripped the breaker inside ten seconds, and
    // the station then ran the rest of the session on local briefs
    // alone. Four per batch completes the sweep in six rounds instead
    // of three, which stays under the limit.
    const POLL_BATCH = 4;
    let pollCursor = 0;
    let consecutiveFailures = 0;
    let tripped = false;
    let trippedSince = 0;
    let feeds = [...DEFAULT_FEEDS];
    let rssPool = [];           // Array of clean RSS stories fetched
    let seenTitles = new Set();
    let broadcast = new Set();   // ledger keys already dispatched this browser session
    const newsLedger = new Map();
    // Only records changed locally since the last successful server PUT are
    // sent to the merge endpoint. The server performs per-record merging.
    const dirtyKeys = new Set();
    function markDirty(key) {
        if (key != null && String(key)) dirtyKeys.add(String(key));
    }
    let ledgerRemoteAvailable = null;
    let ledgerWriteTimer = null;
    let initialSweepRemaining = DEFAULT_FEEDS.length;
    let pollTimer = null;
    let pollInProgress = false;
    let schedulerEnabled = false;
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
            // Newsletter plugs inside the Guardian's summaries, which arrive
            // glued to the story: "Sign up for the US Breaking News email",
            // "Get our breaking news email, free app or daily news podcast".
            // The anchors were reading them out as part of the news.
            .replace(/\b(?:Sign up for|Get our|Subscribe to)\b[^.!?]{0,80}?\b(?:news email|newsletter|email)(?:,\s*free app\s*(?:or|and)\s*daily news podcast)?/gi, ' ')
            .replace(/Continue reading\.*/gi, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
        if (/^comments?$/i.test(cleaned)) return '';
        return cleaned;
    }

    // Product reviews and buying guides from the tech feeds: "These 12
    // automatic cat feeders were the best we tested", "Ember's new mug makes
    // my nightly tea ritual…". Not news; the anchors were reading them out.
    // Title only — a story's description can mention testing legitimately.
    const SHOPPING_TITLE = /\b(?:best\b.{0,50}\b(?:we(?:'|’)?ve tested|we tested|to buy|you can buy|of 20\d\d|for 20\d\d|right now)|we tested|tested and reviewed|buying guide|gift guide|gift ideas|deals?\s+(?:on|for)\b|is on sale|on sale now|price drop|lowest price|our favou?rite|makes my\b|review:)/i;

    /** Check if story is a valid news headline (reject ads/promos) */
    function isValidStory(title, desc) {
        if (!title || title.length < 15) return false;
        if (NON_STORY_TITLE.test(title)) return false;
        if (SHOPPING_TITLE.test(title)) return false;
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

    function canonicalLink(link) {
        if (!link) return '';
        try {
            const u = new URL(String(link));
            u.hash = '';
            for (const key of [...u.searchParams.keys()]) {
                if (/^(utm_|fbclid$|gclid$|ocid$|ref$|source$)/i.test(key)) u.searchParams.delete(key);
            }
            u.searchParams.sort();
            return (u.origin + u.pathname).replace(/\/$/, '').toLowerCase()
                + (u.searchParams.toString() ? '?' + u.searchParams.toString() : '');
        } catch (_) { return String(link).split('#')[0].trim().toLowerCase(); }
    }

    // Every new story is compared with every ledger record from the last 45
    // days, and each comparison used to re-tokenise both titles: at 20,000
    // records a 20-story poll cost about two seconds on the frame loop.
    // Tokens are memoised per title; the cache is dropped when it outgrows
    // any plausible ledger.
    const tokenCache = new Map();
    function headlineTokens(value) {
        const key = String(value || '');
        let tokens = tokenCache.get(key);
        if (!tokens) {
            if (tokenCache.size > 5000) tokenCache.clear();
            tokens = new Set(titleKey(key).split(' ').filter((w) =>
                w.length >= 4 && !LEDGER_STOPWORDS.has(w)));
            tokenCache.set(key, tokens);
        }
        return tokens;
    }

    function headlineSimilarity(a, b) {
        const aa = headlineTokens(a), bb = headlineTokens(b);
        if (aa.size < 3 || bb.size < 3) return 0;
        let common = 0;
        for (const word of aa) if (bb.has(word)) common++;
        const jaccard = common / (aa.size + bb.size - common);
        // A daily brief may store the headline and its summary in one bullet.
        // In that case the RSS headline is a small token subset of the longer
        // brief line, so Jaccard alone understates the match. A four-token,
        // near-complete overlap with the shorter title is strong enough to
        // treat as the same story while avoiding generic two-word matches.
        const overlap = common / Math.min(aa.size, bb.size);
        return (common >= 4 && overlap >= 0.85) ? Math.max(jaccard, 0.73) : jaccard;
    }

    function readLedgerPayload(payload, options = {}) {
        // Browser localStorage has historically stored an array. The server
        // ledger may store `items` as an object keyed by a stable story hash.
        // Accept both shapes (and a bare array from older clients). Preserve
        // object keys as a fallback identity when a record omits its own key.
        let entries = [];
        if (Array.isArray(payload)) {
            entries = payload.map((raw) => [null, raw]);
        } else if (payload && Array.isArray(payload.items)) {
            entries = payload.items.map((raw) => [null, raw]);
        } else if (payload && payload.items && typeof payload.items === 'object') {
            entries = Object.entries(payload.items);
        }

        for (const [payloadKey, raw] of entries) {
            if (!raw || !raw.title) continue;
            const key = String(raw.key || raw.ledgerKey || payloadKey || titleKey(raw.title));
            if (!key) continue;
            const old = newsLedger.get(key);
            if (!old) {
                newsLedger.set(key, {
                    ...raw, key, ledgerKey: key,
                    aliasKeys: Array.isArray(raw.aliasKeys) ? raw.aliasKeys : [],
                    sources: Array.isArray(raw.sources) ? raw.sources : []
                });
                if (options.markDirty) markDirty(key);
            } else {
                // An aired record is terminal. A stale browser's queued copy
                // must never roll it back to unread.
                const merged = { ...old, ...raw, key, ledgerKey: key };
                if (old.status === 'aired' || raw.status === 'aired') {
                    merged.status = 'aired';
                    merged.reportedAt = old.reportedAt || raw.reportedAt || null;
                    merged.reportedShow = old.reportedShow || raw.reportedShow || null;
                }
                merged.aliasKeys = [...new Set([...(old.aliasKeys || []), ...(raw.aliasKeys || [])])];
                merged.sources = [...new Set([...(old.sources || []), ...(raw.sources || [])])];
                newsLedger.set(key, merged);
                if (options.markDirty && JSON.stringify(merged) !== JSON.stringify(old)) markDirty(key);
            }
        }
    }

    function ledgerPayload(keys = null) {
        const records = keys == null
            ? Array.from(newsLedger.values())
            : Array.from(keys, (key) => newsLedger.get(key)).filter(Boolean);
        return {
            version: 1, updatedAt: new Date().toISOString(),
            items: records
        };
    }

    function saveLocalLedger() {
        try {
            const records = Array.from(newsLedger.values()).map((record) => {
                if (record.status !== 'aired') return record;
                // Once read aloud, the full description is no longer needed to
                // restore the queue. Keep the permanent identity/aired marker
                // and aliases, but trim payload so the browser ledger can grow
                // for months without forgetting older stories.
                return {
                    key: record.key, ledgerKey: record.ledgerKey || record.key,
                    title: record.title, titleRaw: record.titleRaw,
                    titleKey: record.titleKey || titleKey(record.title),
                    link: record.link || '', sourceUrl: record.sourceUrl || '',
                    category: record.category || 'world', targetShow: record.targetShow || null,
                    status: 'aired', firstSeenAt: record.firstSeenAt || null,
                    reportedAt: record.reportedAt || null, reportedShow: record.reportedShow || null,
                    aliasKeys: record.aliasKeys || [], sources: (record.sources || []).slice(0, 6),
                    pubDate: record.pubDate || '', timestamp: record.timestamp || 0,
                };
            });
            localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify({ version: 1, items: records }));
        } catch (err) {
            // If quota/private-mode storage is unavailable, the runtime Set
            // still enforces no-repeat during this page. The server JSON ledger
            // is the durable, unbounded store when /api/news-ledger is enabled.
            console.warn('[GNN Feed] Could not persist browser ledger:', err && err.message ? err.message : err);
        }
    }

    function persistLedger() {
        saveLocalLedger();
        if (ledgerRemoteAvailable !== true) return;
        if (ledgerWriteTimer) clearTimeout(ledgerWriteTimer);
        ledgerWriteTimer = setTimeout(async () => {
            ledgerWriteTimer = null;
            const keysToWrite = Array.from(dirtyKeys);
            if (!keysToWrite.length) return;
            // Snapshot exactly what is sent. If a record changes while the PUT
            // is in flight, leave its key dirty so the newer state is sent too.
            const sentVersions = new Map(keysToWrite.map((key) => [
                key, JSON.stringify(newsLedger.get(key))
            ]));
            try {
                const response = await fetch(LEDGER_ENDPOINT, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(ledgerPayload(keysToWrite)),
                });
                if (!response.ok) throw new Error('HTTP ' + response.status);
                const json = await response.json().catch(() => ({}));
                for (const key of keysToWrite) {
                    if (JSON.stringify(newsLedger.get(key)) === sentVersions.get(key)) {
                        dirtyKeys.delete(key);
                    }
                }
                const total = json.count ?? json.total ?? '?';
                console.log(`[GNN Ledger] server merged ${keysToWrite.length} changed records, total ${total}`);
                // A change may have happened during the request. Schedule the
                // next delta without waiting for another feed poll.
                if (dirtyKeys.size) persistLedger();
            } catch (err) {
                console.warn('[GNN Feed] Server ledger write failed; browser ledger retained:', err.message);
            }
        }, 250);
    }

    function mergeLedgerRecord(key, item, status = 'queued') {
        const now = Date.now();
        const record = {
            ...item,
            key,
            ledgerKey: key,
            status,
            firstSeenAt: now,
            reportedAt: null,
            reportedShow: null,
            aliasKeys: [...new Set([key, item.titleKey || titleKey(item.title)])],
            sources: [...new Set([item.sourceUrl || item.source || 'unknown'])],
        };
        delete record.icon;
        newsLedger.set(key, record);
        markDirty(key);
        return record;
    }

    function findLedgerDuplicate(item) {
        const key = item.titleKey || titleKey(item.title);
        const link = canonicalLink(item.link);
        if (!key) return null;
        if (newsLedger.has(key)) return newsLedger.get(key);
        // A source that names each item itself (NOAA: product and issue time)
        // is matched by that name only. Every NOAA item shares one link and
        // the quarter-day reports share most of their words, so the link and
        // fuzzy tests below filed each new one as a repeat of the first — one
        // space weather story had ever aired.
        if (item.exactKey) return null;
        // Alias keys cover alternate headlines that were already matched to a
        // canonical story in an earlier poll/session.
        for (const record of newsLedger.values()) {
            if ((record.aliasKeys || []).includes(key)) return record;
            const oldLink = canonicalLink(record.link);
            if (link && oldLink && link === oldLink) return record;
        }
        // RSS sources frequently syndicate one event with slightly different
        // headlines. Only fuzzy-match records seen in the last 45 days and only
        // at a high overlap, to avoid merging unrelated stories.
        const cutoff = Date.now() - 45 * 24 * 60 * 60 * 1000;
        let best = null, bestScore = 0;
        for (const record of newsLedger.values()) {
            const seenAt = Number(record.firstSeenAt || record.timestamp || 0);
            if (seenAt && seenAt < cutoff) continue;
            const score = headlineSimilarity(item.title, record.title);
            if (score >= 0.72 && score > bestScore) { best = record; bestScore = score; }
        }
        return best;
    }

    function restoreQueuedLedgerItems() {
        if (!onNewItems) return;
        const restored = [];
        for (const record of newsLedger.values()) {
            if (record.status !== 'queued' || !record.title) continue;
            const key = record.key || record.ledgerKey || titleKey(record.title);
            if (broadcast.has(key)) continue;
            const item = { ...record, ledgerKey: key, titleKey: record.titleKey || titleKey(record.title) };
            broadcast.add(key);
            restored.push(item);
        }
        if (restored.length) {
            console.log(`[GNN Feed] Restoring ${restored.length} queued stories from ledger`);
            onNewItems(restored);
        }
    }

    async function initializeLedger() {
        try {
            const raw = localStorage.getItem(LEDGER_STORAGE_KEY);
            if (raw) readLedgerPayload(JSON.parse(raw), { markDirty: true });
        } catch (err) {
            console.warn('[GNN Feed] Browser ledger could not be read:', err && err.message ? err.message : err);
        }
        try {
            const response = await fetch(LEDGER_ENDPOINT, { headers: { 'Accept': 'application/json' } });
            if (response.ok) {
                const payload = await response.json();
                const before = newsLedger.size;
                readLedgerPayload(payload);
                ledgerRemoteAvailable = true;
                saveLocalLedger();
                const serverItems = Array.isArray(payload) ? payload.length
                    : (payload && payload.items && Array.isArray(payload.items)
                        ? payload.items.length
                        : (payload && payload.items && typeof payload.items === 'object'
                            ? Object.keys(payload.items).length : 0));
                console.log(`[GNN Feed] Server ledger loaded: ${serverItems} on server, `
                    + `${newsLedger.size} merged (${newsLedger.size - before} new)`);
            } else {
                ledgerRemoteAvailable = false;
                if (response.status !== 404) console.warn('[GNN Feed] Server ledger unavailable: HTTP ' + response.status);
            }
        } catch (_) {
            ledgerRemoteAvailable = false;
        }
    }

    function markAired(item, showId) {
        if (!item || !item.title) return false;
        const key = item.ledgerKey || item.titleKey || titleKey(item.title);
        if (!key) {
            console.warn('[GNN Ledger] markAired called with no key:', item.title);
            return false;
        }
        const existing = newsLedger.get(key);
        if (!existing) {
            console.warn('[GNN Ledger] markAired for untracked story:', item.title);
        }
        let record = existing;
        if (!record) record = findLedgerDuplicate(item);
        if (!record) record = mergeLedgerRecord(key, item, 'aired');
        record.status = 'aired';
        record.reportedAt = record.reportedAt || new Date().toISOString();
        record.reportedShow = record.reportedShow || showId || item.targetShow || 'unknown';
        record.targetShow = record.targetShow || item.targetShow || record.reportedShow;
        record.lastAiredTitle = item.title;
        newsLedger.set(record.key || key, record);
        markDirty(record.key || key);
        broadcast.add(record.key || key);
        persistLedger();
        console.log(`[GNN Ledger] Aired once: ${record.title} [show=${record.reportedShow}]`);
        return true;
    }

    function setTargetShow(item, showId) {
        if (!item || !showId) return;
        item.targetShow = showId;
        const key = item.ledgerKey || item.titleKey || titleKey(item.title);
        const record = newsLedger.get(key) || findLedgerDuplicate(item);
        if (record) {
            record.targetShow = showId;
            newsLedger.set(record.key || key, record);
            markDirty(record.key || key);
            persistLedger();
        }
    }

    function downloadLedger() {
        const blob = new Blob([JSON.stringify(ledgerPayload(), null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'news-ledger.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // Load local ledger before the first feed response can arrive.
    try {
        const localRaw = localStorage.getItem(LEDGER_STORAGE_KEY);
        if (localRaw) readLedgerPayload(JSON.parse(localRaw), { markDirty: true });
    } catch (_) { /* localStorage may be unavailable */ }

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
            const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

    /**
     * Fetch one curated feed through the same-origin server proxy and parse
     * RSS 2.0 or Atom XML in the browser. Do not retry failures here.
     */
    async function fetchFeed(url) {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeout = controller ? setTimeout(() => controller.abort(), 12000) : null;
        let resp;
        try {
            resp = await fetch(`${FEED_PROXY_API}${encodeURIComponent(url)}`,
                controller ? { signal: controller.signal } : undefined);
        } finally {
            if (timeout) clearTimeout(timeout);
        }
        if (!resp.ok) {
            const err = new Error(`HTTP ${resp.status}`);
            if (resp.status === 429) err.rateLimited = true;
            throw err;
        }

        const xml = await resp.text();
        if (typeof DOMParser === 'undefined') throw new Error('XML parser unavailable');
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        if (doc.querySelector('parsererror')) throw new Error('Invalid feed XML');
        const nodes = [...doc.getElementsByTagName('item'),
        ...doc.getElementsByTagNameNS('http://www.w3.org/2005/Atom', 'entry')];
        const textOf = (node, names) => {
            for (const name of names) {
                const found = node.getElementsByTagName(name)[0]
                    || node.getElementsByTagNameNS('*', name)[0];
                if (found && found.textContent) return found.textContent.trim();
            }
            return '';
        };
        const validItems = [];
        for (const item of nodes) {
            const rawTitle = cleanFeedText(textOf(item, ['title']));
            const rawDesc = cleanFeedText(textOf(item, ['description', 'summary', 'content', 'encoded']));
            const title = rawTitle.toUpperCase();
            const desc = rawDesc.length > 0 && !/^comments?$/i.test(rawDesc)
                ? truncateSentenceCleanly(rawDesc, 280) : '';
            if (!isValidStory(title, desc)) continue;

            // An Atom entry may carry several links (alternate, replies,
            // enclosure) in any order. The ledger matches stories by link, so
            // take the article itself: rel="alternate", or a link with no rel.
            const links = [...item.getElementsByTagName('link'),
            ...item.getElementsByTagNameNS('http://www.w3.org/2005/Atom', 'link')];
            const linkNode = links.find((l) => !l.getAttribute('rel')
                || l.getAttribute('rel') === 'alternate') || links[0];
            const link = linkNode
                ? (linkNode.getAttribute('href') || linkNode.textContent || '').trim() : '';
            const pubDate = textOf(item, ['pubDate', 'published', 'updated', 'date']);
            validItems.push({
                title,
                titleKey: titleKey(title),
                titleRaw: rawTitle,
                description: desc,
                icon: GNNIconManager.matchIcon(title, desc),
                link,
                sourceUrl: url,
                pubDate,
                timestamp: Date.parse(pubDate) || 0,
                importance: calculateImportance(title, desc),
                topic: extractTopic(rawTitle, rawDesc),
                category: FEED_CATEGORY.get(url) || 'world'
            });
        }
        return validItems;
    }

    function ingestFetchedItems(fetchedItems, batchLabel) {
        if (!Array.isArray(fetchedItems) || !fetchedItems.length) return { added: 0, duplicates: 0 };
        const newItems = [];
        let ledgerChanged = false;
        let droppedCount = 0;
        for (const item of fetchedItems) {
            const key = item.titleKey || titleKey(item.title);
            if (!key) { droppedCount++; continue; }
            const duplicate = findLedgerDuplicate(item);
            if (duplicate) {
                // Keep provenance from all feeds/briefs without queueing an
                // alternate headline for the same event a second time.
                const oldAliasCount = (duplicate.aliasKeys || []).length;
                const oldSourceCount = (duplicate.sources || []).length;
                duplicate.aliasKeys = [...new Set([...(duplicate.aliasKeys || []), key])];
                duplicate.sources = [...new Set([...(duplicate.sources || []), item.sourceUrl || item.source || 'unknown'])];
                if (duplicate.aliasKeys.length !== oldAliasCount || duplicate.sources.length !== oldSourceCount) ledgerChanged = true;
                if (item.link && !duplicate.link) { duplicate.link = item.link; ledgerChanged = true; }
                const ledgerKey = duplicate.key || duplicate.ledgerKey || key;
                if (duplicate.status !== 'aired' && !broadcast.has(ledgerKey)) {
                    duplicate.status = 'queued';
                    duplicate.ledgerKey = ledgerKey;
                    duplicate.titleKey = duplicate.titleKey || titleKey(duplicate.title);
                    broadcast.add(ledgerKey);
                    newItems.push({ ...duplicate, ledgerKey });
                }
                droppedCount++;
                continue;
            }
            if (seenTitles.has(key)) { droppedCount++; continue; }
            item.titleKey = key;
            const record = mergeLedgerRecord(key, item, 'queued');
            ledgerChanged = true;
            item.ledgerKey = key;
            item.aliasKeys = record.aliasKeys;
            seenTitles.add(key);
            rssPool.push(item);
            broadcast.add(key);
            newItems.push(item);
        }
        console.log(`[GNN Feed:Metrics] ${batchLabel || 'items'} fetched=${fetchedItems.length}, new=${newItems.length}, duplicates=${droppedCount}, pool=${rssPool.length}, ledger=${newsLedger.size}`);
        if (ledgerChanged || newItems.length) persistLedger();
        // Deliver each batch as soon as its source responds. In particular,
        // the local digest must not wait behind eight slow RSS proxy requests.
        if (newItems.length && onNewItems) onNewItems(newItems);
        return { added: newItems.length, duplicates: droppedCount };
    }

    // `endpoint`: the local digest by default; '/api/spaceweather' gives the
    // NOAA alerts the server turns into stories, same shape.
    async function fetchLocalNewsItems(endpoint = '/api/localnews') {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeout = controller ? setTimeout(() => controller.abort(), 8000) : null;
        try {
            const response = await fetch(endpoint, controller ? { signal: controller.signal } : undefined);
            if (!response.ok) {
                console.warn(`[GNN Feed] Local digest request failed: HTTP ${response.status}`);
                return { source: 'local', items: [] };
            }
            const local = await response.json();
            const localItems = [];
            const now = Date.now();
            for (const it of (local.items || [])) {
                const localTitle = cleanFeedText(it.title || '');
                const localDesc = cleanFeedText(it.description || '');
                if (!isValidStory(localTitle.toUpperCase(), localDesc)) continue;
                localItems.push({
                    title: localTitle.toUpperCase(),
                    titleRaw: localTitle,
                    titleKey: it.key ? titleKey(it.key) : titleKey(localTitle),
                    exactKey: !!it.key,
                    description: localDesc,
                    icon: GNNIconManager.matchIcon(localTitle, localDesc),
                    link: it.link || '',
                    source: it.source || local.source || 'news_brief',
                    sourceUrl: `local:${it.source || local.source || 'news_brief'}`,
                    pubDate: it.pubDate || '',
                    timestamp: Date.parse(it.pubDate || '') || now,
                    importance: calculateImportance(localTitle, localDesc),
                    topic: extractTopic(localTitle, localDesc),
                    category: it.category || 'world'
                });
            }
            console.log(`[GNN Feed] Local digest (${local.source || 'local'}): ${localItems.length} usable stories`);
            return { source: local.source || 'local', items: localItems };
        } catch (err) {
            console.warn('[GNN Feed] Local digest unavailable:', err && err.message ? err.message : err);
            return { source: 'local', items: [] };
        } finally {
            if (timeout) clearTimeout(timeout);
        }
    }

    /** Fetch RSS in a rotating batch while ingesting the local digest independently. */
    async function pollAll() {
        if (pollInProgress) return;
        pollInProgress = true;
        let successCount = 0;
        let sawRateLimit = false;
        let failedCount = 0;
        let slice = [];

        // A tripped breaker pauses RSS, not the station. Recheck after the
        // maximum backoff so a recovered upstream can be tried without reload.
        if (tripped && Date.now() - trippedSince >= BACKOFF_MAX_MS) {
            tripped = false;
            trippedSince = 0;
            consecutiveFailures = 0;
            console.log('[GNN Feed] Breaker reset after backoff window');
        }

        try {
            if (feeds.length && !tripped) {
                setStatus('Fetching live RSS feeds and local news brief…', false);
                for (let i = 0; i < Math.min(POLL_BATCH, feeds.length); i++) {
                    slice.push(feeds[(pollCursor + i) % feeds.length]);
                }
                pollCursor = (pollCursor + slice.length) % Math.max(1, feeds.length);
                initialSweepRemaining = Math.max(0, initialSweepRemaining - slice.length);
            } else if (tripped) {
                setStatus('RSS polling paused; refreshing local news brief…', false);
            } else {
                initialSweepRemaining = 0;
                setStatus('No RSS feeds configured; loading local news brief…', true);
            }

            // Kick off the local digest immediately. It is the reliable boot
            // source and must be allowed to populate the rundown while RSS
            // proxy requests are still in flight.
            const localTask = (async () => {
                const local = await fetchLocalNewsItems();
                if (local.items.length) ingestFetchedItems(local.items, 'local digest');
                // Real space weather for the weather desk (server caches it).
                const sw = await fetchLocalNewsItems('/api/spaceweather');
                if (sw.items.length) ingestFetchedItems(sw.items, 'space weather');
                return local.items.length;
            })();

            const rssTask = (async () => {
                const fetchedItems = [];
                for (const url of slice) {
                    try {
                        const items = await fetchFeed(url);
                        fetchedItems.push(...items);
                        successCount++;
                    } catch (err) {
                        failedCount++;
                        if (err && err.rateLimited) sawRateLimit = true;
                        console.warn(`[GNN Feed] Feed error (${url}):`, err.message);
                    }
                }
                if (fetchedItems.length) ingestFetchedItems(fetchedItems, 'RSS');
                return fetchedItems.length;
            })();

            await Promise.all([localTask, rssTask]);

            // A rate limit counts as a serious failure even if one feed worked.
            if (sawRateLimit) consecutiveFailures += 2;
            else if (failedCount > 0 && successCount === 0 && slice.length) consecutiveFailures++;
            else consecutiveFailures = 0;

            if (consecutiveFailures >= FAILURE_TRIP) {
                if (!tripped) trippedSince = Date.now();
                tripped = true;
                setStatus('RSS polling paused after repeated failures', true);
                console.warn('[GNN Feed] Polling paused after repeated failures; existing stories remain available.');
            }

            prunePool();
            if (rssPool.length) {
                setStatus(`News pool — ${rssPool.length} stories (${successCount}/${slice.length} RSS feeds checked + local brief)`, false);
            } else if (successCount > 0) {
                setStatus(`${successCount}/${slice.length} feeds OK — pool empty`, false);
            } else if (tripped) {
                setStatus('RSS polling paused; refreshing local news brief…', false);
            } else {
                setStatus('No usable feed stories yet', true);
            }
        } finally {
            pollInProgress = false;
            scheduleNextPoll();
        }
    }

    function scheduleNextPoll() {
        if (pollTimer) {
            clearTimeout(pollTimer);
            pollTimer = null;
        }
        if (!schedulerEnabled) return;
        // Once RSS is tripped, keep refreshing the local brief on the normal
        // cadence; only upstream RSS requests are disabled by the breaker.
        //
        // The fast sweep exists to fill the ledger on a cold boot, and it
        // only runs while the sweep is clean. A rate-limited batch means
        // the proxy is already unhappy — pressing it with the next batch
        // in 1.5 s makes it unhappier, and the whole sweep then trips the
        // breaker inside ten seconds. Any failure at all falls back to
        // the normal cadence instead.
        const fastSweep = initialSweepRemaining > 0
            && feeds.length > 0
            && consecutiveFailures === 0;
        const delay = tripped ? POLL_INTERVAL_MS + Math.random() * POLL_JITTER_MS
            : (fastSweep
                ? 1500 + Math.random() * 3500
                : (consecutiveFailures === 0 ? POLL_INTERVAL_MS + Math.random() * POLL_JITTER_MS
                    : Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * Math.pow(2, consecutiveFailures - 1))));
        pollTimer = setTimeout(pollAll, delay);
        if (consecutiveFailures > 0) {
            console.warn(`[GNN Feed] Next poll in ${Math.round(delay / 60000)} minutes after failures.`);
        }
    }

    /** Evict the oldest stories once the pool passes its ceiling. */
    function prunePool() {
        if (rssPool.length > POOL_LIMIT) {
            rssPool.sort((a, b) => b.timestamp - a.timestamp);
            for (const dropped of rssPool.splice(POOL_LIMIT)) {
                seenTitles.delete(dropped.titleKey || titleKey(dropped.title));
                // Do not remove the ledger/broadcast marker when pruning the in-memory pool.
                // An already-reported story must never become eligible again.
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

    /** Top the director's rundown up only with never-dispatched stories. Never recycle aired copy. */
    function replenishQueue() {
        if (!onNewItems || rssPool.length === 0) return;
        const rundown = (typeof GNNDirector !== 'undefined' && GNNDirector.getQueue)
            ? GNNDirector.getQueue() : [];
        const onAir = (typeof GNNDirector !== 'undefined' && GNNDirector.getCurrent)
            ? GNNDirector.getCurrent() : null;
        const queued = new Set(rundown.map((q) => q.ledgerKey || q.titleKey || titleKey(q.title)));
        if (onAir) queued.add(onAir.ledgerKey || onAir.titleKey || titleKey(onAir.title));
        const fresh = rssPool.filter((item) => {
            const key = item.ledgerKey || item.titleKey || titleKey(item.title);
            const record = newsLedger.get(key);
            return key && !queued.has(key) && !broadcast.has(key)
                && (!record || record.status !== 'aired')
                && !NON_STORY_TITLE.test(item.titleRaw || item.title);
        });
        if (!fresh.length) return;
        fresh.sort((a, b) => b.timestamp - a.timestamp);
        const batch = fresh.slice(0, 6);
        batch.forEach((item) => {
            const key = item.ledgerKey || item.titleKey || titleKey(item.title);
            broadcast.add(key);
            const record = newsLedger.get(key);
            if (record && record.status !== 'aired') {
                record.status = 'queued';
                markDirty(record.key || key);
            }
        });
        persistLedger();
        onNewItems(batch);
    }

    function setStatus(text, isError) {
        if (onStatusChange) onStatusChange(text, isError);
    }

    function start() {
        if (schedulerEnabled || pollInProgress || tripped) return;
        schedulerEnabled = true;
        // Hydrate the persistent ledger, restore unread queued stories, then
        // run the first poll quickly. A warm-up sweep checks all 24 feeds in
        // three conservative batches before returning to the 15-minute cadence.
        initializeLedger().then(() => {
            if (!schedulerEnabled) return;
            restoreQueuedLedgerItems();
            pollTimer = setTimeout(pollAll, 1500 + Math.random() * 2000);
        }).catch((err) => {
            console.warn('[GNN Feed] Ledger initialization failed:', err && err.message ? err.message : err);
            if (schedulerEnabled) pollTimer = setTimeout(pollAll, 1500 + Math.random() * 2000);
        });
    }

    function stop() {
        schedulerEnabled = false;
        if (pollTimer) {
            clearTimeout(pollTimer);
            pollTimer = null;
        }
    }

    function addFeed(url) {
        if (typeof url !== 'string' || !url.trim()) return false;
        let parsed;
        try { parsed = new URL(url); } catch (_) { return false; }
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
            console.warn('[GNN Feed] Refusing invalid feed URL or embedded credentials.');
            return false;
        }
        const normalized = parsed.href;
        if (!feeds.includes(normalized)) {
            feeds.push(normalized);
            if (!pollInProgress && !tripped) {
                if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
                pollAll();
            }
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
        markAired,
        setTargetShow,
        saveLedger: persistLedger,
        downloadLedger,
        getLedger: () => ledgerPayload(),
        set onNewItems(fn) { onNewItems = fn; },
        set onStatusChange(fn) { onStatusChange = fn; },
    };
})();