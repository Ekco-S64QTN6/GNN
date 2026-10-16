/* ============================================================
   GNN — Live Market Ticker
   ------------------------------------------------------------
   Real quotes are fetched from /api/market on this server, which
   proxies the upstream sources. The proxy exists because a
   browser cannot reach them directly: Yahoo refuses any client
   without a browser TLS fingerprint, and the CORS gate applies
   regardless.

   Quotes refresh in the background, while the crawl itself stays
   smooth. If the provider is blocked or unavailable, the ticker
   keeps the last successful quotes and labels them as delayed.

   The crawl is no longer one long string. Each segment carries its
   own colour, so a quote that is up reads green and one that is
   down reads red without the arrow glyph carrying the meaning on
   its own. Status and wire lines sit in amber, so the price stream
   is visually distinct from the meta commentary around it.

   A quote that is held over from an earlier cycle — the provider
   returned seven of eight this time, or the fetch failed entirely
   — is drawn in that same amber. It is not a live market number,
   and the colour says so without a word of copy.
   ============================================================ */

const GNNTickerManager = (() => {
    'use strict';

    const BAR_H = 30;
    const FONT = '12px "Press Start 2P", monospace';
    const SEP = '   ///   ';
    const REFRESH_MS = 60_000;
    const REQUEST_TIMEOUT_MS = 10_000;

    // The crawl labels. Kept client-side so the row on air reads the
    // short name and the server can return full symbol ids for any
    // caller that wants them.
    const SYMBOLS = [
        { symbol: 'AAPL', label: 'AAPL' },
        { symbol: 'MSFT', label: 'MSFT' },
        { symbol: 'NVDA', label: 'NVDA' },
        { symbol: 'AMZN', label: 'AMZN' },
        { symbol: 'TSLA', label: 'TSLA' },
        { symbol: 'SPY', label: 'SPY' },
        { symbol: 'BTC-USD', label: 'BTC' },
        { symbol: 'ETH-USD', label: 'ETH' },
    ];

    // Segment colours. The price stream is green/red per direction when
    // it is live; a held-over quote and the status line both sit in the
    // same amber, so anything on this bar that is not a live market
    // number reads the same way.
    const COLOUR = {
        up: '#5ef88a',       // bright green — clear on the dark bar
        down: '#ff7a7a',     // soft red, matches the flash tone
        flat: '#7dfcb0',     // station green, unchanged
        meta: '#e8c46a',     // amber — status text, wire, and stale quotes
        flash: '#ffd0d0',    // breaking-alert override
    };

    let enabled = true;
    // The crawl, as measured segments. Each entry carries the text to
    // draw, the colour to draw it in, and the width the text occupies
    // at the current font — the render loop only advances an x-cursor.
    let segments = [];
    let blockWidth = 0;
    let offset = 0;
    let speed = 0.62;
    let lastNow = 0;
    let flash = 0;

    let latestCtx = null;
    let latestStories = [];
    let marketSegments = [];   // [{text, colour}] from the quote builder
    const quoteCache = Object.create(null);
    let lastSuccessfulAt = 0;
    let lastAttemptAt = 0;
    let refreshPromise = null;
    let dataStatus = 'CONNECTING TO MARKET FEED';

    function formatPrice(price, currency) {
        if (!Number.isFinite(price)) return '—';
        const code = currency || 'USD';
        if (price >= 1000) {
            return new Intl.NumberFormat('en-US', {
                style: 'currency', currency: code,
                minimumFractionDigits: 0, maximumFractionDigits: 0
            }).format(price);
        }
        return new Intl.NumberFormat('en-US', {
            style: 'currency', currency: code,
            minimumFractionDigits: 2, maximumFractionDigits: 2
        }).format(price);
    }

    /**
     * One quote, as a {text, colour} pair.
     *
     * The colour tracks direction, not the label. A quote that is up is
     * green and one that is down is red on the crawl itself, so the
     * change is read at a glance rather than by following the arrow
     * glyph. Flat sits at the station's own green so the price stream
     * does not read as all-red on a quiet day.
     *
     * A held-over quote is drawn in amber. The arrow is kept — the
     * direction was true of the moment the quote was fetched — but the
     * green/red is dropped, because those colours mean "this number is
     * moving now" and a cached number is not. Amber is the same colour
     * the status line and the wire headlines use, so the grammar on the
     * bar stays: green/red is live market data, amber is everything
     * else.
     */
    function quoteSegment(item, quote, fresh = true) {
        const price = formatPrice(quote.price, quote.currency);
        const change = Number.isFinite(quote.changePct) ? quote.changePct : 0;
        const arrow = change > 0 ? '▲' : change < 0 ? '▼' : '■';
        const colour = !fresh ? COLOUR.meta
            : change > 0 ? COLOUR.up
                : change < 0 ? COLOUR.down
                    : COLOUR.flat;
        return {
            text: `${item.label} ${price} ${arrow}${Math.abs(change).toFixed(2)}%`,
            colour,
        };
    }

    /**
     * Build the price-stream segments from the quote cache.
     *
     * `fresh` is the set of symbols that came back on the current fetch
     * cycle. A symbol in the cache but not in `fresh` is held over from
     * an earlier cycle, and `quoteSegment` is told so it can colour the
     * row as cached rather than live.
     *
     * Extracted so the two paths that reach here — the successful fetch
     * and the outer catch that fires when the fetch chain throws — build
     * the segments the same way. When only the try body built them, a
     * throw anywhere in that body left the previous cycle's segments on
     * the bar at full green/red, and a viewer had no way to tell.
     */
    function rebuildMarketSegments(fresh) {
        marketSegments = SYMBOLS
            .filter(item => quoteCache[item.symbol])
            .map(item => quoteSegment(
                item,
                quoteCache[item.symbol],
                fresh.has(item.symbol)));
    }

    /**
     * One fetch, all symbols.
     *
     * The server fans out to the upstream sources, parses the response,
     * and hands back `{ok, quotes: [{symbol, price, changePct,
     * currency}], t}`. The client does the display formatting — labels,
     * currency symbol, arrow glyph, colour — so a change to how a quote
     * reads on the crawl is a client-side change and does not touch the
     * proxy.
     */
    async function fetchMarket() {
        const controller = typeof AbortController !== 'undefined'
            ? new AbortController() : null;
        let timer = null;
        try {
            if (controller) {
                timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
            }
            const response = await fetch('api/market', {
                method: 'GET',
                cache: 'no-store',
                credentials: 'omit',
                signal: controller ? controller.signal : null,
                headers: { 'Accept': 'application/json' },
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const json = await response.json();
            return Array.isArray(json && json.quotes) ? json.quotes : [];
        } finally {
            if (timer !== null) clearTimeout(timer);
        }
    }

    /**
     * Build the crawl as measured, coloured segments.
     *
     * Every segment is emitted as `text + SEP` and measured in one pass,
     * so the join between two copies of the block reads the same as the
     * separator between two segments within a copy. blockWidth is the
     * sum of every segment's width — the length of one full cycle.
     *
     * Wire headlines come from the script writer with an empty market
     * list, so the function that used to interleave them here can keep
     * returning plain strings and the colour decision stays on this
     * side of the module boundary.
     */
    function rebuildBlock(ctx) {
        if (!ctx) return;
        const segs = [];

        // Market quotes — each carries its own colour, and a held-over
        // quote carries amber.
        for (const m of marketSegments) {
            if (!m || !m.text) continue;
            segs.push({
                text: String(m.text).toUpperCase(),
                colour: m.colour || COLOUR.flat,
            });
        }

        // Status line — station furniture, not a quote.
        if (dataStatus) {
            segs.push({
                text: dataStatus.toUpperCase(),
                colour: COLOUR.meta,
            });
        }

        // Wire headlines from the script writer, in the same amber.
        if (typeof GNNScript !== 'undefined') {
            const extras = GNNScript.tickerSegments(latestStories, []);
            for (const e of extras) {
                if (!e) continue;
                segs.push({
                    text: String(e).toUpperCase(),
                    colour: COLOUR.meta,
                });
            }
        }

        if (!segs.length) {
            segments = [];
            blockWidth = 0;
            return;
        }

        ctx.save();
        ctx.font = FONT;
        segments = [];
        let total = 0;
        for (const s of segs) {
            const text = s.text + SEP;
            const w = ctx.measureText(text).width;
            if (!w) continue;
            segments.push({ text, colour: s.colour, width: w });
            total += w;
        }
        ctx.restore();
        blockWidth = total;
    }

    /**
     * Fetch every symbol and re-mark the price stream.
     *
     * `fresh` is the set of symbols the current cycle returned. Every
     * symbol in `quoteCache` is drawn, but only the ones in `fresh` are
     * coloured as live. A held-over row is a normal thing — the server
     * can return seven of eight when one upstream lags — and the bar
     * says so without the crawl going blank for the missing one.
     */
    async function refreshMarketData() {
        const now = Date.now();
        if (refreshPromise || (now - lastAttemptAt < REFRESH_MS)) {
            return refreshPromise;
        }
        lastAttemptAt = now;

        refreshPromise = (async () => {
            let quotes = [];
            try {
                quotes = await fetchMarket();
            } catch (err) {
                quotes = [];
            }

            const fresh = new Set();
            for (const q of quotes) {
                if (q && q.symbol) {
                    quoteCache[q.symbol] = q;
                    fresh.add(q.symbol);
                }
            }
            rebuildMarketSegments(fresh);

            const freshCount = fresh.size;
            if (freshCount === SYMBOLS.length) {
                lastSuccessfulAt = Date.now();
                dataStatus = 'MARKET QUOTES — MAY BE DELAYED';
            } else if (freshCount) {
                lastSuccessfulAt = Date.now();
                dataStatus = `MARKET FEED PARTIAL ${freshCount}/${SYMBOLS.length}`;
            } else if (marketSegments.length) {
                dataStatus = 'MARKET DATA DELAYED — LAST SUCCESSFUL QUOTES';
            } else {
                dataStatus = 'MARKET DATA UNAVAILABLE — CHECK SERVER';
            }

            if (latestCtx) rebuildBlock(latestCtx);
        })().catch(() => {
            // The chain above threw somewhere unexpected — a bad quote
            // object, a rebuild that could not measure, anything. Hold
            // what is on the crawl but re-mark every symbol stale, so the
            // amber says the numbers are cached rather than live. If the
            // try body had partially updated `marketSegments` before it
            // threw, this rebuilds them from the cache and clears the
            // partial state.
            rebuildMarketSegments(new Set());
            dataStatus = marketSegments.length
                ? 'MARKET DATA DELAYED — LAST SUCCESSFUL QUOTES'
                : 'MARKET DATA UNAVAILABLE — CHECK SERVER';
            if (latestCtx) rebuildBlock(latestCtx);
        }).finally(() => {
            refreshPromise = null;
        });

        return refreshPromise;
    }

    function rebuild(ctx, stories) {
        latestCtx = ctx;
        latestStories = Array.isArray(stories) ? stories.slice() : [];
        rebuildBlock(ctx);

        // Start network work in the background; never block the game loop.
        if (Date.now() - lastAttemptAt >= REFRESH_MS && !refreshPromise) {
            refreshMarketData();
        }
    }

    function update(now) {
        if (!lastNow) lastNow = now;
        const dt = Math.min(120, now - lastNow);
        lastNow = now;
        if (flash > 0) flash -= dt;
        if (!enabled || !blockWidth) return;
        offset += speed * dt * 0.06;
        if (offset >= blockWidth) offset %= blockWidth;
    }

    /**
     * Draw the crawl.
     *
     * The render walks a copy of the full segment cycle from
     * `view.x + 4 - offset`, then steps by blockWidth and draws the next
     * copy, until the start of a copy is past the right edge. The clip
     * rect takes care of the picture frame; there is no per-segment
     * clipping and no measuring in the draw loop — every segment's width
     * was measured once when the block was built.
     *
     * The flash state replaces every segment's colour with the alert
     * tone. A breaking transmission tints the whole bar the same way it
     * tints the frame border; that is the one place colour is not
     * per-segment.
     */
    function render(ctx, view) {
        if (!enabled || !segments.length) return;
        const y = view.y + view.h - BAR_H - 2;
        ctx.save();
        ctx.beginPath();
        ctx.rect(view.x + 2, y, view.w - 4, BAR_H);
        ctx.clip();

        ctx.fillStyle = flash > 0 ? 'rgba(60,8,8,0.92)' : 'rgba(2,10,8,0.88)';
        ctx.fillRect(view.x + 2, y, view.w - 4, BAR_H);
        ctx.fillStyle = flash > 0 ? '#ff8080' : '#54e08a';
        ctx.fillRect(view.x + 2, y, view.w - 4, 2);

        ctx.font = FONT;
        ctx.textBaseline = 'middle';
        ctx.imageSmoothingEnabled = false;

        const alert = flash > 0;
        let startX = view.x + 4 - offset;
        while (startX < view.x + view.w) {
            let cx = startX;
            for (let i = 0; i < segments.length; i++) {
                const seg = segments[i];
                ctx.fillStyle = alert ? COLOUR.flash : seg.colour;
                ctx.fillText(seg.text, cx, y + BAR_H / 2);
                cx += seg.width;
            }
            startX += blockWidth;
        }
        ctx.restore();
    }

    function setEnabled(v) { enabled = !!v; }
    function isEnabled() { return enabled; }
    function alert() { flash = 3000; }
    function setSpeed(v) { speed = Math.max(0, Number(v) || 0); }

    return {
        rebuild, update, render, setEnabled, isEnabled, alert, setSpeed,
        refreshMarketData, BAR_H
    };
})();