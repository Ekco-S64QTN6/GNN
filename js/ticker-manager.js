/* ============================================================
   GNN — Live Market Ticker
   ------------------------------------------------------------
   Real quotes are fetched from Yahoo Finance's public chart
   endpoint (no API key; unofficial and subject to rate limits).
   Quotes refresh in the background, while the crawl itself stays
   smooth. If the provider is blocked or unavailable, the ticker
   keeps the last successful quotes and labels them as delayed.
   ============================================================ */

const GNNTickerManager = (() => {
    'use strict';

    const BAR_H = 30;
    const FONT = '12px "Press Start 2P", monospace';
    const SEP = '   ///   ';
    const REFRESH_MS = 60_000;
    const REQUEST_TIMEOUT_MS = 10_000;

    // Yahoo Finance chart endpoint is free and keyless, but unofficial.
    // A browser or host policy may block cross-origin requests.
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

    let enabled = true;
    let block = '';
    let blockWidth = 0;
    let offset = 0;
    let speed = 0.62;
    let lastNow = 0;
    let flash = 0;

    let latestCtx = null;
    let latestStories = [];
    let marketSegments = [];
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

    function quoteSegment(item, quote) {
        const price = formatPrice(quote.price, quote.currency);
        const change = Number.isFinite(quote.changePct) ? quote.changePct : 0;
        const arrow = change > 0 ? '▲' : change < 0 ? '▼' : '■';
        return `${item.label} ${price} ${arrow}${Math.abs(change).toFixed(2)}%`;
    }

    async function fetchQuote(item) {
        const url = 'https://query1.finance.yahoo.com/v8/finance/chart/'
            + encodeURIComponent(item.symbol) + '?range=1d&interval=1m';
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        let timer = null;
        try {
            if (controller) timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
            const response = await fetch(url, {
                method: 'GET',
                cache: 'no-store',
                credentials: 'omit',
                signal: controller ? controller.signal : undefined,
                headers: { 'Accept': 'application/json' }
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const json = await response.json();
            const result = json && json.chart && json.chart.result && json.chart.result[0];
            const meta = result && result.meta;
            if (!meta || !Number.isFinite(Number(meta.regularMarketPrice))) {
                throw new Error('No quote in provider response');
            }

            const price = Number(meta.regularMarketPrice);
            const previous = Number(meta.chartPreviousClose || meta.previousClose);
            const changePct = Number.isFinite(previous) && previous !== 0
                ? ((price - previous) / previous) * 100 : 0;
            return {
                price,
                changePct,
                currency: meta.currency || 'USD',
                marketState: meta.marketState || '',
                marketTime: Number(meta.regularMarketTime || 0)
            };
        } finally {
            if (timer !== null) clearTimeout(timer);
        }
    }

    function rebuildBlock(ctx) {
        if (!ctx) return;
        const market = marketSegments.slice();
        if (dataStatus) market.push(dataStatus);
        const segs = (typeof GNNScript !== 'undefined')
            ? GNNScript.tickerSegments(latestStories, market) : market;
        if (!segs || !segs.length) return;

        block = segs.join(SEP) + SEP;
        ctx.save();
        ctx.font = FONT;
        blockWidth = ctx.measureText(block).width;
        ctx.restore();
        if (!blockWidth) block = '';
    }

    async function refreshMarketData() {
        const now = Date.now();
        if (refreshPromise || (now - lastAttemptAt < REFRESH_MS)) return refreshPromise;
        lastAttemptAt = now;

        refreshPromise = (async () => {
            const results = await Promise.allSettled(SYMBOLS.map(fetchQuote));
            let freshCount = 0;
            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    quoteCache[SYMBOLS[index].symbol] = result.value;
                    freshCount++;
                }
            });
            marketSegments = SYMBOLS
                .filter(item => quoteCache[item.symbol])
                .map(item => quoteSegment(item, quoteCache[item.symbol]));

            if (freshCount) {
                lastSuccessfulAt = Date.now();
                dataStatus = freshCount === SYMBOLS.length
                    ? 'YAHOO QUOTES — MAY BE DELAYED'
                    : `YAHOO FEED PARTIAL ${freshCount}/${SYMBOLS.length}`;
            } else if (marketSegments.length) {
                dataStatus = 'MARKET DATA DELAYED — LAST SUCCESSFUL QUOTES';
            } else {
                dataStatus = 'MARKET DATA UNAVAILABLE — CHECK CONNECTION/CORS';
            }

            if (latestCtx) rebuildBlock(latestCtx);
        })().catch(() => {
            dataStatus = marketSegments.length
                ? 'MARKET DATA DELAYED — LAST SUCCESSFUL QUOTES'
                : 'MARKET DATA UNAVAILABLE — CHECK CONNECTION/CORS';
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

    function render(ctx, view) {
        if (!enabled || !block) return;
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
        ctx.fillStyle = flash > 0 ? '#ffd0d0' : '#7dfcb0';
        ctx.imageSmoothingEnabled = false;

        let x = view.x + 4 - offset;
        while (x < view.x + view.w) {
            ctx.fillText(block, x, y + BAR_H / 2);
            x += blockWidth;
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
