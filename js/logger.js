/**
 * GNN Newsroom — Universal Browser Logging Subsystem
 * ===================================================
 * Intercepts console.* calls, unhandled errors, and promise rejections,
 * forwarding them to /api/log so they are recorded directly into gnn-server.log.
 */
(function() {
    'use strict';

    if (window.__GNN_LOGGER_INITIALIZED__) return;
    window.__GNN_LOGGER_INITIALIZED__ = true;

    const originalConsole = {
        log: console.log.bind(console),
        info: console.info.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console),
        debug: (console.debug || console.log).bind(console),
    };

    const queue = [];
    let flushTimer = null;
    let isFlushing = false;
    let lastLogKey = '';
    let duplicateCount = 0;

    const MAX_QUEUE_SIZE = 300;
    const FLUSH_INTERVAL_MS = 60;

    function getTimestamp() {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    function formatArg(arg) {
        if (arg === null) return 'null';
        if (arg === undefined) return 'undefined';
        if (arg instanceof Error) {
            return arg.stack || `${arg.name}: ${arg.message}`;
        }
        if (typeof arg === 'symbol') return arg.toString();
        if (typeof arg === 'function') return `[Function: ${arg.name || 'anonymous'}]`;
        if (typeof arg === 'object') {
            try {
                const seen = new WeakSet();
                return JSON.stringify(arg, (key, value) => {
                    if (typeof value === 'object' && value !== null) {
                        if (seen.has(value)) return '[Circular]';
                        seen.add(value);
                    }
                    if (value instanceof Error) {
                        return { name: value.name, message: value.message, stack: value.stack };
                    }
                    return value;
                });
            } catch (err) {
                return String(arg);
            }
        }
        return String(arg);
    }

    function formatArgs(args) {
        return args.map(formatArg).join(' ');
    }

    function scheduleFlush(immediate) {
        if (immediate) {
            if (flushTimer) {
                clearTimeout(flushTimer);
                flushTimer = null;
            }
            flush();
        } else if (!flushTimer) {
            flushTimer = setTimeout(() => {
                flushTimer = null;
                flush();
            }, FLUSH_INTERVAL_MS);
        }
    }

    function enqueue(level, message, stack) {
        const time = getTimestamp();
        const key = `${level}:${message}`;

        // Rate-limit identical bursts (e.g. repeated in a 60fps render loop)
        if (key === lastLogKey) {
            duplicateCount++;
            if (duplicateCount === 5) {
                queue.push({
                    time,
                    level: 'WARN',
                    message: '[Repeated] Previous message repeated 5 times, suppressing further identical lines...',
                });
            }
            if (duplicateCount >= 5) {
                return;
            }
        } else {
            if (duplicateCount >= 5) {
                queue.push({
                    time,
                    level: 'INFO',
                    message: `[Repeated] Suppressed ${duplicateCount - 4} identical messages.`,
                });
            }
            lastLogKey = key;
            duplicateCount = 0;
        }

        queue.push({
            time,
            level: level.toUpperCase(),
            message,
            stack: stack || undefined,
        });

        while (queue.length > MAX_QUEUE_SIZE) {
            queue.shift();
        }

        const isUrgent = level === 'error' || level === 'warn';
        scheduleFlush(isUrgent || queue.length >= 10);
    }

    function flush() {
        if (queue.length === 0 || isFlushing) return;
        isFlushing = true;

        const batch = queue.splice(0, 40);
        const payload = JSON.stringify(batch);

        try {
            fetch('/api/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload,
                keepalive: true,
            }).then(() => {
                isFlushing = false;
                if (queue.length > 0) {
                    scheduleFlush(false);
                }
            }).catch(() => {
                // If fetch fails (server unreachable/restarting), restore unsent items at front of queue
                isFlushing = false;
                if (queue.length + batch.length <= MAX_QUEUE_SIZE) {
                    queue.unshift(...batch);
                }
            });
        } catch (e) {
            isFlushing = false;
        }
    }

    // Hook console methods
    ['log', 'info', 'warn', 'error', 'debug'].forEach((method) => {
        const orig = originalConsole[method];
        console[method] = function(...args) {
            try {
                orig.apply(console, args);
            } catch (err) {
                // Ignore console display errors
            }

            try {
                let stack = null;
                for (const a of args) {
                    if (a instanceof Error && a.stack) {
                        stack = a.stack;
                        break;
                    }
                }
                const formatted = formatArgs(args);
                enqueue(method, formatted, stack);
            } catch (err) {
                // Avoid crashing caller
            }
        };
    });

    // Capture uncaught window runtime errors
    window.addEventListener('error', (event) => {
        try {
            const err = event.error || {};
            const msg = event.message || 'Unknown runtime error';
            const loc = event.filename ? ` (${event.filename}:${event.lineno}:${event.colno})` : '';
            const stack = err.stack || '';
            enqueue('error', `[Uncaught Error] ${msg}${loc}`, stack);
            scheduleFlush(true);
        } catch (e) {}
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        try {
            const reason = event.reason;
            let msg = 'Unhandled Promise Rejection';
            let stack = '';
            if (reason instanceof Error) {
                msg = reason.message || reason.name || msg;
                stack = reason.stack || '';
            } else if (typeof reason === 'string') {
                msg = reason;
            } else {
                msg = formatArg(reason);
            }
            enqueue('error', `[Unhandled Rejection] ${msg}`, stack);
            scheduleFlush(true);
        } catch (e) {}
    });

    // ---------------------------------------------------------
    // Broadcast Transcript Subsystem (gnn-transcript.log)
    // ---------------------------------------------------------

    const transcriptQueue = [];
    let transcriptFlushTimer = null;
    let isTranscriptFlushing = false;
    const MAX_TRANSCRIPT_QUEUE = 500;
    const TRANSCRIPT_FLUSH_INTERVAL_MS = 80;

    function getMsTimestamp() {
        const d = new Date();
        const pad = (n, len = 2) => String(n).padStart(len, '0');
        return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
    }

    function scheduleTranscriptFlush(immediate) {
        if (immediate) {
            if (transcriptFlushTimer) {
                clearTimeout(transcriptFlushTimer);
                transcriptFlushTimer = null;
            }
            flushTranscript();
        } else if (!transcriptFlushTimer) {
            transcriptFlushTimer = setTimeout(() => {
                transcriptFlushTimer = null;
                flushTranscript();
            }, TRANSCRIPT_FLUSH_INTERVAL_MS);
        }
    }

    function enqueueTranscriptLines(lines) {
        if (!lines) return;
        const arr = Array.isArray(lines) ? lines : [lines];
        for (const line of arr) {
            if (!line) continue;
            transcriptQueue.push(line);
        }
        while (transcriptQueue.length > MAX_TRANSCRIPT_QUEUE) {
            transcriptQueue.shift();
        }
        scheduleTranscriptFlush(transcriptQueue.length >= 8);
    }

    function flushTranscript() {
        if (transcriptQueue.length === 0 || isTranscriptFlushing) return;
        isTranscriptFlushing = true;

        const batch = transcriptQueue.splice(0, 50);
        const payload = JSON.stringify(batch);

        try {
            fetch('/api/transcript', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload,
                keepalive: true,
            }).then(() => {
                isTranscriptFlushing = false;
                if (transcriptQueue.length > 0) {
                    scheduleTranscriptFlush(false);
                }
            }).catch(() => {
                isTranscriptFlushing = false;
                if (transcriptQueue.length + batch.length <= MAX_TRANSCRIPT_QUEUE) {
                    transcriptQueue.unshift(...batch);
                }
            });
        } catch (e) {
            isTranscriptFlushing = false;
        }
    }

    // Flush any pending logs and transcripts on page unload
    window.addEventListener('beforeunload', () => {
        if (queue.length > 0) {
            const payload = JSON.stringify(queue);
            queue.length = 0;
            if (navigator.sendBeacon) {
                const blob = new Blob([payload], { type: 'application/json' });
                navigator.sendBeacon('/api/log', blob);
            }
        }
        if (transcriptQueue.length > 0) {
            const tPayload = JSON.stringify(transcriptQueue);
            transcriptQueue.length = 0;
            if (navigator.sendBeacon) {
                const tBlob = new Blob([tPayload], { type: 'application/json' });
                navigator.sendBeacon('/api/transcript', tBlob);
            }
        }
    });

    window.GNNTranscript = {
        getTimestamp: getMsTimestamp,

        logSpeech(params = {}) {
            const ts = getMsTimestamp();
            const speakerLabel = params.speakerName || params.speakerId || 'Desk';
            const seatLabel = params.speakerSeat
                ? ` [${params.speakerSeat}]`
                : (params.speakerRole ? ` [${params.speakerRole}]` : '');
            const targetStr = params.addressedTo ? ` -> ${params.addressedTo}` : '';
            const voiceStr = params.voiceId ? ` | Voice: ${params.voiceId}` : '';
            const expVoiceStr = (params.expectedVoiceId && params.expectedVoiceId !== params.voiceId)
                ? ` (EXPECTED: ${params.expectedVoiceId})`
                : '';

            const lines = [];
            lines.push(`[${ts}] [DIALOGUE] ${speakerLabel}${seatLabel}${targetStr}: "${params.text}"${voiceStr}${expVoiceStr}`);

            // Voice mismatch detection
            const isMismatch = params.isMismatch || (params.expectedVoiceId && params.voiceId && params.expectedVoiceId !== params.voiceId);
            if (isMismatch) {
                const warnMsg = `Speaker '${params.speakerId || speakerLabel}' assigned voice '${params.expectedVoiceId}' but speech audio generated with voice '${params.voiceId}'!`;
                lines.push(`[${ts}] [VOICE-MISMATCH WARNING] ${warnMsg}`);
                console.warn(`[GNN VoiceMismatch] ${warnMsg}`);
            }

            if (params.sourceUrl) {
                const headlinePart = params.headline ? `Story: "${params.headline}" | ` : '';
                lines.push(`[${ts}] [DIALOGUE:SOURCE] ${headlinePart}Feed: ${params.sourceUrl}`);
            }

            enqueueTranscriptLines(lines);
            if (isMismatch) scheduleTranscriptFlush(true);
        },

        logSegment(segmentName, details = {}) {
            const ts = getMsTimestamp();
            const prev = details.previousState ? ` | Previous: '${details.previousState}'` : '';
            const q = details.queueLength !== undefined ? ` | Queue remaining: ${details.queueLength}` : '';
            const read = details.storiesRead !== undefined ? ` | Stories read: ${details.storiesRead}` : '';
            const line = `[${ts}] [SEGMENT] Transition to '${segmentName}'${prev}${q}${read}`;
            enqueueTranscriptLines(line);
        },

        logStory(story = {}) {
            const ts = getMsTimestamp();
            const breaking = story.breaking ? ' [BREAKING]' : '';
            const cat = story.category ? ` | Category: ${story.category}` : '';
            const prio = story.importance !== undefined ? ` | Priority: ${story.importance}` : '';
            const idx = story.index !== undefined ? `#${story.index} ` : '';
            const line1 = `[${ts}] [STORY] ${idx}"${story.title}"${breaking}${cat}${prio}`;
            const src = story.sourceUrl || story.source || 'Local wire';
            const line2 = `[${ts}] [STORY:SOURCE] Feed: ${src}`;
            enqueueTranscriptLines([line1, line2]);
        },

        logCommercial(comm = {}) {
            const ts = getMsTimestamp();
            const lines = [];
            const recipe = comm.recipe || comm.recipeName || 'standard';
            const brand = comm.brand || comm.sponsor || 'GNN Sponsor';
            const prod = comm.product || 'Network Promo';
            const shotsCount = Array.isArray(comm.shots) ? comm.shots.length : (comm.shotsCount || 0);
            const durStr = comm.durationMs ? `${(comm.durationMs / 1000).toFixed(1)}s` : 'variable';
            lines.push(`[${ts}] [COMMERCIAL] Recipe: ${recipe} | Sponsor: "${brand}" | Product: "${prod}" | Shots: ${shotsCount} | Duration: ${durStr}`);

            const backdrops = comm.backdrops && comm.backdrops.length ? comm.backdrops.join(', ') : 'none';
            const sprites = comm.sprites && comm.sprites.length ? comm.sprites.join(', ') : 'none';
            const overlays = comm.overlays && comm.overlays.length ? comm.overlays.join(', ') : 'none';
            const announcer = comm.announcerVoice || comm.voice || 'N/A';
            lines.push(`[${ts}] [COMMERCIAL:ASSETS] Announcer Voice: ${announcer} | Backdrops: [${backdrops}] | Sprites: [${sprites}] | Overlays: [${overlays}]`);

            if (Array.isArray(comm.shots)) {
                comm.shots.forEach((s, idx) => {
                    const shotKind = s.kind || (s.beat && s.beat.kind) || 'shot';
                    const sceneKind = s.sceneKind || (s.scene && s.scene.kind) || 'single';
                    const shotVoice = s.voice || announcer;
                    const shotDur = s.duration || 0;
                    const shotTrans = s.transition || 'cut';
                    const copy = s.text || (s.beat && s.beat.text) || '(instrumental)';
                    lines.push(`[${ts}] [COMMERCIAL:RUNDOWN] Shot ${idx + 1}/${comm.shots.length} [${shotKind}] Scene: ${sceneKind} | Dur: ${shotDur}ms | Trans: ${shotTrans} | Voice: ${shotVoice} | Copy: "${copy}"`);
                });
            }
            enqueueTranscriptLines(lines);
        },

        logCutaway(cut = {}) {
            const ts = getMsTimestamp();
            const kind = cut.kind || cut.recipe || cut.subject || 'cutaway';
            const mode = cut.mode || 'pip';
            const durStr = cut.duration ? `${(cut.duration / 1000).toFixed(1)}s` : 'variable';
            const assets = cut.assets && cut.assets.length ? cut.assets.join(', ') : 'composite';
            const line = `[${ts}] [CUTAWAY] Recipe/Subject: ${kind} | Mode: ${mode} | Duration: ${durStr} | Assets: [${assets}]`;
            enqueueTranscriptLines(line);
        },

        logCustom(tag, message) {
            const ts = getMsTimestamp();
            enqueueTranscriptLines(`[${ts}] [${tag.toUpperCase()}] ${message}`);
        },

        flush: flushTranscript,
    };

    window.GNNLog = {
        log: (...args) => console.log(...args),
        info: (...args) => console.info(...args),
        warn: (...args) => console.warn(...args),
        error: (...args) => console.error(...args),
        debug: (...args) => console.debug(...args),
        flush,
    };

    console.log('[GNN Logger] Browser logging & broadcast transcript initialized');
})();
