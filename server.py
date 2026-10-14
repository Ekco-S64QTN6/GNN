#!/usr/bin/env python3
"""
GNN Newsroom — static host + zero-cloud neural voice endpoint
=============================================================

    python3 server.py            # http://localhost:8080

Routes
    /                 static files from the project directory
    /api/tts          kokoro (local) or edge-tts synthesis
    /api/status       what the station has available
    /api/log          browser diagnostics append to gnn-server.log
    /api/voices       the running engine's voice catalogue
    /api/localnews    local digest fallback when RSS is rate-limited
    /api/market       live market quotes

The TTS route prefers the local Kokoro engine. If Kokoro is missing it
falls back to edge-tts, and if that is missing too it answers 503 and
the browser client silently falls back to the Web Speech API, so the
broadcast never goes mute.

The market route exists because a browser cannot reach the upstream
sources directly. Yahoo's chart endpoint refuses any client that does
not present a browser TLS fingerprint — plain urllib, requests and
httpx all get HTTP 429 regardless of headers — and the CORS gate
would apply regardless. The server has no such restriction: it fetches
Yahoo via curl_cffi (a real Chrome handshake), falls back to CoinGecko
for crypto when curl_cffi is not installed, and hands the parsed quotes
back to the browser. Same pattern as /api/localnews.

    pip install curl_cffi

Without it, the equities are absent and only crypto shows on the
crawl. With it, the full row is present.
"""

import asyncio
import atexit
import http.server
import json
import os
import shutil
import signal
import socketserver
import subprocess
import sys
import threading
import time
import urllib.parse
import urllib.request

PORT = int(os.environ.get('GNN_PORT', 8080))
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
PIDFILE = os.path.join(DIRECTORY, '.gnn-server.pid')
# The same file --bg redirects the server's stdout and stderr into. The
# /api/log route writes to it explicitly rather than relying on the shell
# redirect, so browser-side diagnostic lines land here even when the
# server runs in the foreground and its own output goes to the terminal.
LOG = os.path.join(DIRECTORY, 'gnn-server.log')

ALLOWED_VOICE = set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_')
MAX_TEXT = 1200

try:
    import edge_tts
    HAVE_TTS = True
except ImportError:
    edge_tts = None
    HAVE_TTS = False

# curl_cffi is the only reliable way past Yahoo's TLS-fingerprint gate.
# It wraps libcurl with a genuine Chrome handshake, so the request looks
# like a browser at the layer Yahoo actually inspects. Optional: if it is
# not installed, the market route falls back to CoinGecko for crypto and
# leaves the equities off the crawl rather than refusing to start.
try:
    from curl_cffi import requests as curl_requests
    HAVE_CURL_CFFI = True
except ImportError:
    curl_requests = None
    HAVE_CURL_CFFI = False

# --- synthesis quality -------------------------------------------------
#
# edge-tts hardcodes audio-24khz-48kbitrate-mono-mp3 into the websocket
# speech.config frame. 48 kbps mono is genuinely poor and is audible as coder
# crunch on sibilants no matter what the mixer does downstream. The service
# hands out 96 kbps for the asking; 48 kHz and PCM formats are refused.
# Rewrite the frame on its way out, and no-op safely if upstream ever changes
# the literal.
EDGE_DEFAULT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3'
EDGE_FORMAT = os.environ.get('GNN_TTS_FORMAT', 'audio-24khz-96kbitrate-mono-mp3')

# Voices arrive at different levels: Guy lands near -19.6 LUFS with 0.6 dB of
# headroom, Ryan at -21.7 with 3.8 dB. Through a compressor the hot ones get
# squashed and the quiet ones do not, which is why one voice sounds clean and
# the next sounds harsh. Normalise to one broadcast target before the browser
# ever sees it.
TARGET_LUFS = float(os.environ.get('GNN_TTS_LUFS', -21.0))
TARGET_PEAK_DB = float(os.environ.get('GNN_TTS_PEAK', -3.0))
INTERSAMPLE_HEADROOM_DB = 1.8


# --- local voice engine ------------------------------------------------
#
# Kokoro-82M, Apache-2.0, run in-process. This is what makes the project's
# "zero-cloud" claim actually true: edge-tts is a Microsoft cloud call on
# every line, and its models are an older generation that reads slowly
# enough to sit in the uncanny valley. Kokoro runs about 7x faster than
# real time on CPU alone, so the RTX in this machine is not even needed.
#
# edge-tts stays wired up as a fallback for anyone without the venv.
try:
    from kokoro import KPipeline
    HAVE_LOCAL = True
except Exception:                                     # noqa: BLE001
    KPipeline = None
    HAVE_LOCAL = False

LOCAL_SR = 24000

# A voice that is known to exist in every release of Kokoro this project has
# been built against. Used as the fallback when a requested voice is not in
# the installed release — Kokoro adds voices between versions, and the
# station should stay on air rather than go silent because one character's
# voice name was not yet shipped.
#
# `am_michael` is Hale's voice and is in the original Kokoro voice set.
SAFE_VOICE = 'am_michael'

# One pipeline per language code, built on first use. Loading costs ~11s,
# so it is warmed in the background at startup rather than on the first
# line of the broadcast.
#
# Two languages matter here: `'a'` for the American voices (af_*, am_*) and
# `'b'` for the British ones (bf_*, bm_*). They share a model but not a
# phonemizer — the `'b'` pipeline is a separate object with its own state,
# and building it on the request path is what made the first British line
# slow and, when it failed, produced a bare 502 with no diagnostic.
_pipelines = {}
_pipe_lock = threading.Lock()

# The catalogue the selector is built from. Kokoro's ids encode accent and
# gender: a/b = American/British, m/f = male/female.
# The shortlist, chosen by ear. The engine ships a good many more and most
# of them are worse; offering them only makes the good ones harder to find.
LOCAL_VOICES = [
    ('am_michael', 'MICHAEL — Anchor Prime'),
    ('am_fenrir', 'FENRIR — Deep Baritone'),
    ('bm_george', 'GEORGE — Interstellar BBC'),
    ('bm_daniel', 'DANIEL — Council Desk'),
    ('bm_fable', 'FABLE — Archive Reader'),
    ('bm_lewis', 'LEWIS — Colonial Service'),
    ('af_heart', 'HEART — Anchor (F)'),
    ('af_bella', 'BELLA — Smooth Sci-Fi (F)'),
    ('bf_emma', 'EMMA — Interstellar BBC (F)'),
    ('bf_isabella', 'ISABELLA — Council Desk (F)'),
    ('bf_lily', 'LILY — Science Desk (F)'),
    ('vox_unit', 'VOX UNIT — Station Automation'),
]

# The anchor is a machine, and no speech model ships a convincing robot: they
# are all trained to sound human. So one is built instead, by putting a human
# read through the things that make a voice sound machine-made.
#
#   asetrate/atempo  drop the pitch a little without slowing the read
#   tremolo at 55Hz  amplitude modulation — the buzz under the voice, and the
#                    nearest thing ffmpeg has to a ring modulator
#   chorus           two detuned copies, so it is a unit speaking, not a mouth
#   highpass/lowpass band-limit it to a comm channel
#   acrusher         quantise, for the 1993 of it
ROBOT_VOICES = {
    'vox_unit': (
        'am_michael',
        'asetrate=24000*0.92,aresample=24000,atempo=1.087,'
        'tremolo=f=55:d=0.35,'
        'chorus=0.6:0.9:50|60:0.4|0.32:0.25|0.4:2|2.3,'
        'highpass=f=180,lowpass=f=6800,'
        'acrusher=bits=10:mode=log:aa=0.4'
    ),
}

LOCAL_VOICE_IDS = {v for v, _ in LOCAL_VOICES}


def local_pipeline(lang):
    with _pipe_lock:
        pipe = _pipelines.get(lang)
        if pipe is None:
            pipe = _pipelines[lang] = KPipeline(lang_code=lang)
        return pipe


def warm_local():
    """Load both pipelines off the request path so the first line is not slow.

    Warming only `'a'` was the bug: the American voices came up instantly
    and the British ones — `bf_lily`, `bf_emma`, `bf_isabella`, and every
    `bm_*` — paid the full pipeline-construction cost on their first
    request. Worse, when construction failed under load, `handle_tts`
    caught it as a generic exception and returned 502 with no message;
    the browser showed `noblob` and the anchor went silent for that line
    and every line after it by the same voice.
    """
    if not HAVE_LOCAL:
        return
    for lang in ('a', 'b'):
        try:
            local_pipeline(lang)
            sys.stderr.write(
                '[GNN] local voice ready (kokoro, lang=%s)\n' % lang)
        except Exception as err:                      # noqa: BLE001
            sys.stderr.write(
                '[GNN] local voice lang=%s unavailable: %s\n' % (lang, err))


def synthesize_local(text, voice, rate):
    """Render locally and return WAV bytes. `rate` is a percentage string.

    Two attempts: the requested voice, then `SAFE_VOICE` if the first one
    fails. The fallback exists because Kokoro ships its voice list with
    the model, not the library — a name that is valid on one release may
    not exist on another — and a station that goes mute because one
    character's voice name changed is worse than one that reads the line
    in a different voice and logs the substitution.

    Every failure is written to stderr with the voice name and the
    exception message, so `tail -f gnn-server.log` tells you exactly
    which voice failed and why, rather than a bare 502 with no context.
    """
    import io
    import numpy as np
    import soundfile as sf

    try:
        speed = 1.0 + int(float(rate.rstrip('%'))) / 100.0
    except (AttributeError, ValueError):
        speed = 1.0
    speed = max(0.5, min(2.0, speed))

    robot = ROBOT_VOICES.get(voice)
    base = robot[0] if robot else voice

    # Try the requested voice, then the safe fallback. `SAFE_VOICE` is not
    # retried if it *is* the requested voice — that would just be the same
    # call twice.
    candidates = [base]
    if base != SAFE_VOICE:
        candidates.append(SAFE_VOICE)

    parts = []
    used = None
    for candidate in candidates:
        lang = 'b' if candidate.startswith('b') else 'a'
        try:
            pipe = local_pipeline(lang)
            parts = [chunk.audio.numpy()
                     for chunk in pipe(text, voice=candidate, speed=speed)]
            if parts:
                used = candidate
                break
        except Exception as err:                      # noqa: BLE001
            sys.stderr.write(
                '[GNN] kokoro failed voice=%s lang=%s: %s\n'
                % (candidate, lang, err))
            parts = []

    if not parts:
        sys.stderr.write(
            '[GNN] kokoro gave no audio for any candidate voice '
            '(requested=%s)\n' % base)
        return b''

    if used != base:
        sys.stderr.write(
            '[GNN] substituted voice %s for requested %s\n' % (used, base))

    audio = np.concatenate(parts)
    buf = io.BytesIO()
    sf.write(buf, audio, LOCAL_SR, format='WAV', subtype='PCM_16')
    wav = buf.getvalue()

    if robot and shutil.which('ffmpeg'):
        r = _ffmpeg(['-i', 'pipe:0', '-af', robot[1],
                     '-ar', str(LOCAL_SR), '-ac', '1', '-c:a', 'pcm_s16le',
                     '-f', 'wav', 'pipe:1'], wav)
        if r.returncode == 0 and r.stdout:
            return r.stdout
        sys.stderr.write('[GNN] robot filter failed, serving the plain read\n')
    return wav


def _install_format_override():
    if not HAVE_TTS or EDGE_FORMAT == EDGE_DEFAULT_FORMAT:
        return
    try:
        import aiohttp
    except ImportError:
        return
    original = aiohttp.ClientSession.ws_connect

    class _Proxy:
        def __init__(self, ws):
            self._ws = ws

        def __getattr__(self, name):
            return getattr(self._ws, name)

        def __aiter__(self):
            return self._ws.__aiter__()

        async def send_str(self, data, *a, **k):
            if EDGE_DEFAULT_FORMAT in data:
                data = data.replace(EDGE_DEFAULT_FORMAT, EDGE_FORMAT)
            return await self._ws.send_str(data, *a, **k)

    class _Ctx:
        def __init__(self, cm):
            self._cm = cm

        async def __aenter__(self):
            return _Proxy(await self._cm.__aenter__())

        async def __aexit__(self, *a):
            return await self._cm.__aexit__(*a)

    def ws_connect(self, *a, **k):
        return _Ctx(original(self, *a, **k))

    aiohttp.ClientSession.ws_connect = ws_connect


_install_format_override()

_tts_lock = threading.Lock()

# Highest request sequence each client session has asked for. The browser
# abandons a superseded <audio> request by closing the socket, but the server
# has already taken the synthesis lock by then and will hold it for a full
# round trip — delaying the line that is actually wanted. Comparing sequence
# numbers lets a stale request drop out instead of queueing ahead of a live one.
#
# This MUST be scoped per session. The client's counter restarts at zero on
# every page load, so a single global high-water mark meant that after one
# session had reached N, every request from the next page load looked stale
# and was refused with a 409 — permanently, until the server was restarted.
# The anchor simply went mute on reload.
_seq_lock = threading.Lock()
_latest_seq = {}
_SEQ_SESSIONS = 64


def clean_session(sid):
    sid = ''.join(c for c in (sid or '') if c.isalnum())
    return sid[:32]


def note_sequence(sid, seq):
    if not sid or not seq:
        return
    with _seq_lock:
        if seq > _latest_seq.get(sid, 0):
            _latest_seq[sid] = seq
        # A long-lived station accumulates one entry per page load; keep the
        # newest handful and let the rest go.
        while len(_latest_seq) > _SEQ_SESSIONS:
            _latest_seq.pop(next(iter(_latest_seq)))


def superseded(sid, seq):
    if not sid or not seq:
        return False
    with _seq_lock:
        return seq < _latest_seq.get(sid, 0)


# Matches the client's default (js/tts.js VOICES[0]): a later generation than
# the plain *Neural voices and audibly less synthetic.
DEFAULT_VOICE = 'en-US-AndrewMultilingualNeural'


def default_voice():
    """Whichever engine is actually running owns the default."""
    if HAVE_LOCAL:
        return LOCAL_VOICES[0][0]
    return DEFAULT_VOICE


def clean_voice(v):
    v = (v or '').strip()
    if not v or any(c not in ALLOWED_VOICE for c in v):
        return default_voice()
    return v


def clean_prosody(value, default, suffix):
    value = (value or '').strip() or default
    if not value.endswith(suffix):
        value = default
    body = value[:-len(suffix)]
    if body and body[0] in '+-':
        body = body[1:]
    if not body.replace('.', '', 1).isdigit():
        return default
    if not value[0] in '+-':
        value = '+' + value
    return value


async def _synth(text, voice, rate, pitch):
    chunks = []
    comm = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    async for chunk in comm.stream():
        if chunk.get('type') == 'audio':
            chunks.append(chunk['data'])
    return b''.join(chunks)


def synthesize(text, voice, rate, pitch):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_synth(text, voice, rate, pitch))
    finally:
        loop.close()


def _ffmpeg(args, payload):
    return subprocess.run(['ffmpeg', '-hide_banner', '-nostats'] + args,
                          input=payload, capture_output=True)


def measure_loudness(mp3):
    """Integrated loudness and true peak in dB, or (None, None)."""
    r = _ffmpeg(['-i', 'pipe:0', '-filter_complex', 'ebur128=peak=true',
                 '-f', 'null', '-'], mp3)
    lufs = peak = None
    for line in r.stderr.decode('utf-8', 'replace').splitlines():
        line = line.strip()
        if line.startswith('I:') and 'LUFS' in line:
            try:
                lufs = float(line.split()[1])
            except (IndexError, ValueError):
                pass
        elif line.startswith('Peak:') and 'dBFS' in line:
            try:
                peak = float(line.split()[1])
            except (IndexError, ValueError):
                pass
    return lufs, peak


# Speech from the local engine averages -26 to -28 LUFS with peaks only
# 4-10dB below full scale: quiet body, tall transients. Lifting that to a
# broadcast target with gain alone drives the peaks over and leaves a limiter
# removing up to 10dB, which is heard as every word being squashed — and the
# amount varies per clip, so one story sounds fine and the next is mangled.
#
# The fix is to reduce the crest factor first, the way any broadcast chain
# does: gentle compression, then gain, then a limiter that only ever catches
# strays.
#
# Settings chosen by sweep, not taste. The engine's raw loudness range is only
# 2.9 LU, so compression costs almost no dynamics here — the crest is isolated
# plosives, not expression. 4:1 above -24dB with a -21 LUFS target leaves the
# limiter removing 1.8dB on the tallest transient (it was 10dB) while LRA
# stays at 1.3 LU.
COMP_THRESHOLD_DB = -24.0
COMP_RATIO = 4.0
COMP_ATTACK_MS = 10
COMP_RELEASE_MS = 200
COMP_FILTER = ('acompressor=threshold=%.1fdB:ratio=%.1f:attack=%d:release=%d'
               ':knee=6:detection=rms'
               % (COMP_THRESHOLD_DB, COMP_RATIO, COMP_ATTACK_MS, COMP_RELEASE_MS))


def normalize(mp3):
    """
    Level-match a clip to a loudness target and hand it back as lossless PCM.

    Three stages, in the order a broadcast chain uses them:

      1. compress  — tame the crest factor so the clip *can* reach the target
      2. gain      — put it at the loudness target
      3. limit     — catch whatever still pokes through

    The limiter is a safety net, not a leveller. If it is removing more than a
    decibel or two the stage in front of it is wrong, and the result will
    sound like each word is being stepped on.

    Returns (payload, content_type), falling back to the original MP3 if
    ffmpeg cannot be used.
    """
    if not shutil.which('ffmpeg'):
        return mp3, 'audio/mpeg'
    try:
        # Measure *after* compression: that is the signal being levelled.
        probe = _ffmpeg(['-i', 'pipe:0', '-af', COMP_FILTER,
                         '-f', 'wav', 'pipe:1'], mp3)
        measured = probe.stdout if probe.returncode == 0 and probe.stdout else mp3
        lufs, peak = measure_loudness(measured)

        gain = 0.0
        if lufs is not None and lufs > -70:
            gain = TARGET_LUFS - lufs
        elif peak is not None:
            # Integrated loudness is meaningless on a very short clip; fall
            # back to placing the peak where a normal read's peak lands.
            gain = TARGET_PEAK_DB - peak
        gain = max(-24.0, min(24.0, gain))

        # The limiter runs on sample peaks while the target is a true peak,
        # and inter-sample peaks sit 1-2dB above sample peaks, so it is set
        # that much below the target.
        ceiling = 10 ** ((TARGET_PEAK_DB - INTERSAMPLE_HEADROOM_DB) / 20.0)
        chain = ('%s,volume=%.2fdB,'
                 'alimiter=limit=%.4f:attack=5:release=120:level=disabled'
                 % (COMP_FILTER, gain, ceiling))
        r = _ffmpeg(['-i', 'pipe:0', '-af', chain,
                     '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le',
                     '-f', 'wav', 'pipe:1'], mp3)
        if r.returncode == 0 and r.stdout:
            return r.stdout, 'audio/wav'
    except Exception as err:                              # noqa: BLE001
        sys.stderr.write('[GNN] normalise failed, serving raw: %s\n' % err)
    return mp3, 'audio/mpeg'


# --- market quotes -----------------------------------------------------
#
# Yahoo Finance's chart endpoint refuses any client without a browser TLS
# fingerprint. Plain urllib, requests and httpx all get HTTP 429 on every
# query regardless of headers, cookies or crumb — the gate is at the TLS
# layer, so a cookie/crumb handshake does not get past it.
#
# curl_cffi presents a genuine Chrome TLS handshake, which is what the
# endpoint checks. With it installed, all eight symbols come from Yahoo.
# Without it, the equities are absent and the crypto comes from CoinGecko
# so the crawl still carries something real.
#
# A sixty-second cache means the eight symbol requests are one batch per
# minute, not one per crawl rebuild.

_ALL_SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'TSLA', 'SPY',
                'BTC-USD', 'ETH-USD']
_CRYPTO_IDS = {'BTC-USD': 'bitcoin', 'ETH-USD': 'ethereum'}
_MARKET_TTL_S = 60.0
_market_cache = {'t': 0.0, 'quotes': []}
_market_lock = threading.Lock()


def _fetch_yahoo(symbol):
    """One quote from Yahoo Finance via curl_cffi. Returns a dict or None.

    The chart endpoint returns a result object with a `meta` block. The
    price is `regularMarketPrice`; the previous close is either
    `chartPreviousClose` or `previousClose`, depending on the range
    parameter's own semantics. Percentage change is computed against
    whichever is present.
    """
    if not HAVE_CURL_CFFI:
        return None
    url = ('https://query1.finance.yahoo.com/v8/finance/chart/'
           + urllib.parse.quote(symbol) + '?range=1d&interval=1m')
    r = curl_requests.get(url, impersonate='chrome', timeout=8)
    if r.status_code != 200:
        raise RuntimeError('HTTP %d' % r.status_code)
    data = r.json()
    result = (data.get('chart', {}).get('result') or [None])[0]
    if not result:
        return None
    meta = result.get('meta') or {}
    price = meta.get('regularMarketPrice')
    if not isinstance(price, (int, float)):
        return None
    prev = meta.get('chartPreviousClose')
    if not isinstance(prev, (int, float)):
        prev = meta.get('previousClose')
    if isinstance(prev, (int, float)) and prev:
        change_pct = (price - prev) / prev * 100.0
    else:
        change_pct = 0.0
    return {
        'symbol': symbol,
        'price': float(price),
        'changePct': float(change_pct),
        'currency': meta.get('currency') or 'USD',
    }


def _fetch_coingecko(ids):
    """Crypto quotes from CoinGecko, batched into one request.

    The fallback for when curl_cffi is not installed. Returns a dict
    keyed by CoinGecko id, each value `{price, changePct, currency}`. A
    missing id is absent from the dict; the caller drops the symbol.
    """
    url = ('https://api.coingecko.com/api/v3/simple/price'
           '?ids=' + ','.join(ids)
           + '&vs_currencies=usd&include_24hr_change=true')
    req = urllib.request.Request(
        url, headers={'User-Agent': 'GNN-Newsroom/1.0'})
    with urllib.request.urlopen(req, timeout=8) as resp:
        data = json.loads(resp.read().decode('utf-8', 'replace'))
    out = {}
    for cg_id in ids:
        entry = data.get(cg_id) or {}
        price = entry.get('usd')
        if not isinstance(price, (int, float)):
            continue
        change = entry.get('usd_24h_change')
        if not isinstance(change, (int, float)):
            change = 0.0
        out[cg_id] = {
            'price': float(price),
            'changePct': float(change),
            'currency': 'USD',
        }
    return out


def _refresh_market():
    """Fetch every symbol and return the quotes that came back.

    Two passes. First, Yahoo via curl_cffi for all eight symbols. Any
    crypto that came back missing is then filled in from CoinGecko, so a
    partial Yahoo failure does not leave a gap on the crawl. If curl_cffi
    is not installed at all, the second pass is the only one that runs,
    and the equities are simply absent.

    Runs on the request thread. Eight serial requests plus one CoinGecko
    batch is a fraction of a second worst case, and the sixty-second
    cache keeps this off the hot path.
    """
    quotes = []
    seen = set()

    if HAVE_CURL_CFFI:
        for sym in _ALL_SYMBOLS:
            try:
                q = _fetch_yahoo(sym)
                if q:
                    quotes.append(q)
                    seen.add(sym)
            except Exception as err:                      # noqa: BLE001
                sys.stderr.write(
                    '[GNN] market %s failed: %s\n' % (sym, err))
    else:
        sys.stderr.write(
            '[GNN] market: curl_cffi not installed — '
            'equities unavailable (pip install curl_cffi)\n')

    missing_crypto = [s for s in _CRYPTO_IDS if s not in seen]
    if missing_crypto:
        try:
            cg = _fetch_coingecko(
                [_CRYPTO_IDS[s] for s in missing_crypto])
            for sym in missing_crypto:
                entry = cg.get(_CRYPTO_IDS[sym])
                if entry:
                    quotes.append({
                        'symbol': sym,
                        'price': entry['price'],
                        'changePct': entry['changePct'],
                        'currency': entry['currency'],
                    })
        except Exception as err:                          # noqa: BLE001
            sys.stderr.write(
                '[GNN] market coingecko failed: %s\n' % err)

    return quotes


class GNNRequestHandler(http.server.SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    # Ceiling on a single browser log line, in bytes. A diagnostic line is
    # a couple of hundred bytes at most; anything larger is either an
    # accident or abuse and gets rejected rather than written.
    LOG_LINE_MAX = 2000

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Static files are served with only Last-Modified, which lets a
        # browser cache them heuristically and skip revalidation entirely —
        # so a fixed .js can keep serving stale for hours and a measurement
        # taken afterwards is measuring the old build. Force revalidation;
        # unchanged files still answer 304, which costs nothing on localhost.
        if not self.path.startswith('/api/'):
            self.send_header('Cache-Control', 'no-cache, must-revalidate')
        super().end_headers()

    def log_message(self, fmt, *args):
        if '/api/' in (self.path or ''):
            sys.stderr.write('[GNN] %s\n' % (fmt % args))

    # -- routing ------------------------------------------------

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path.rstrip('/') == '/api/tts':
            return self.handle_tts(urllib.parse.parse_qs(parsed.query))
        if parsed.path.rstrip('/') == '/api/status':
            return self.handle_status()
        if parsed.path.rstrip('/') == '/api/voices':
            return self.handle_voices()
        if parsed.path.rstrip('/') == '/api/localnews':
            return self.handle_localnews()
        if parsed.path.rstrip('/') == '/api/market':
            return self.handle_market()
        return super().do_GET()

    def do_POST(self):
        # The only POST route this server serves. Anything else is a 404
        # rather than a fall-through to SimpleHTTPRequestHandler, which
        # only implements GET and HEAD and would give a confusing error.
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path.rstrip('/') == '/api/log':
            return self.handle_log()
        return self.send_bytes(b'{"error":"not found"}', 'application/json', 404)

    # -- browser log sink ---------------------------------------
    #
    # The client-side diagnostics — the [TTS] lines that trace the boot
    # race — happen in the browser and have no way to reach a file on
    # this machine's disk without being told to. This endpoint is that
    # telling: the browser POSTs one line per call, the server appends
    # it to gnn-server.log, and the line lands in the same file the
    # Python side already writes to.
    #
    # Deliberately best-effort. A log call that fails is not worth failing
    # a page load over, and the browser's own console.log still works
    # regardless of whether this route is reachable.

    def handle_log(self):
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            length = 0
        if length <= 0 or length > self.LOG_LINE_MAX:
            return self.send_bytes(b'{"ok":false}', 'application/json', 400)
        try:
            raw = self.rfile.read(length)
            line = raw.decode('utf-8', 'replace').rstrip('\r\n')
        except (OSError, UnicodeError):
            return self.send_bytes(b'{"ok":false}', 'application/json', 400)
        if not line:
            return self.send_bytes(b'{"ok":true}', 'application/json')

        # Append to gnn-server.log. O_APPEND is atomic for writes under a
        # few KB on every filesystem this project runs on, so interleaving
        # with the shell's own redirect of the server's stdout and stderr
        # is safe — lines do not splice.
        try:
            import datetime
            stamp = datetime.datetime.now().strftime('%H:%M:%S')
            with open(LOG, 'a', encoding='utf-8') as fh:
                fh.write('[%s] [Browser] %s\n' % (stamp, line))
        except OSError:
            # Disk full, permissions, whatever — the browser still has its
            # console and the page is not worth breaking over a log.
            pass
        return self.send_bytes(b'{"ok":true}', 'application/json')

    # rss2json has a daily cap, and when it is reached every feed returns an
    # error and the channel has nothing to read. The Kaiacord project drops a
    # Gemini-summarised digest into knowledge_base/news/daily every day, which
    # is a local file and cannot rate-limit. Served here as a fallback the
    # feed manager can fall back on.
    NEWS_DIRS = [
        os.path.expanduser('~/github/Kaiacord/knowledge_base/news/daily'),
        os.path.expanduser('~/github/Kaiacord/knowledge_base/news'),
    ]
    # The digest's own section headings, mapped onto the show blocks in
    # docs/ROADMAP.md so the scheduler can target them like any other feed.
    NEWS_SECTIONS = {
        'GENERAL NEWS': 'world', 'WORLD': 'world', 'INTERNATIONAL': 'world',
        'US POLITICS': 'diplomacy', 'POLITICS': 'diplomacy',
        'BUSINESS': 'markets', 'ECONOMY': 'markets', 'MARKETS': 'markets',
        'TECH': 'tech', 'TECHNOLOGY': 'tech', 'SCIENCE': 'science',
        'SPORTS': 'sport', 'SPORT': 'sport', 'HEALTH': 'science',
        'ENTERTAINMENT': 'world',
    }

    def handle_localnews(self):
        """The newest local digest, as items the feed manager understands."""
        path = None
        for d in self.NEWS_DIRS:
            if not os.path.isdir(d):
                continue
            files = [os.path.join(d, f) for f in os.listdir(d)
                     if f.endswith('.md')]
            if files:
                path = max(files, key=os.path.getmtime)
                break
        if not path:
            return self.send_bytes(json.dumps({'items': []}).encode(),
                                   'application/json')
        items, section = [], 'world'
        try:
            with open(path, encoding='utf-8') as fh:
                for raw in fh:
                    line = raw.rstrip()
                    if line.startswith('#'):
                        head = line.lstrip('#').strip().upper()
                        section = self.NEWS_SECTIONS.get(head, 'world')
                        continue
                    if not line.startswith('- '):
                        continue
                    text = line[2:].strip()
                    # The digest writes "&" and "/" as shorthand; the anchor
                    # has to say words.
                    text = text.replace(' & ', ' and ').replace('/', ', ')
                    if len(text) < 25:
                        continue
                    # One sentence: it is a headline, not a story, so the
                    # title carries it and there is no summary to echo.
                    items.append({'title': text.rstrip('.'),
                                  'description': '',
                                  'category': section})
        except OSError:
            pass
        body = json.dumps({'source': os.path.basename(path),
                           'items': items}).encode()
        return self.send_bytes(body, 'application/json')

    # -- market quotes ------------------------------------------
    #
    # The response carries `ok`, `quotes` and `t` — the epoch seconds of
    # the last successful fetch. When a refresh fails partway through,
    # the previous quotes are returned with their original timestamp, so
    # the client can label them delayed without inventing a time.

    def handle_market(self):
        now = time.time()
        with _market_lock:
            fresh = (_market_cache['quotes']
                     and now - _market_cache['t'] < _MARKET_TTL_S)
            if fresh:
                payload = {'ok': True,
                           'quotes': list(_market_cache['quotes']),
                           't': int(_market_cache['t'])}
                return self.send_bytes(json.dumps(payload).encode(),
                                       'application/json')

        quotes = _refresh_market()
        with _market_lock:
            if quotes:
                _market_cache['quotes'] = quotes
                _market_cache['t'] = now
            payload = {
                'ok': bool(quotes),
                'quotes': list(quotes or _market_cache['quotes']),
                't': int(_market_cache['t'] or now),
            }
        if not quotes:
            sys.stderr.write('[GNN] market: no quotes this cycle, '
                             'serving %d stale\n' % len(payload['quotes']))
        return self.send_bytes(json.dumps(payload).encode(),
                               'application/json')

    def send_bytes(self, payload, ctype, code=200):
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        try:
            self.wfile.write(payload)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def handle_voices(self):
        """The selector is built from this, so it always matches the engine."""
        if HAVE_LOCAL:
            payload = {'engine': 'kokoro', 'cloud': False,
                       'voices': [{'id': v, 'label': l} for v, l in LOCAL_VOICES]}
        else:
            payload = {'engine': 'edge-tts' if HAVE_TTS else None,
                       'cloud': bool(HAVE_TTS), 'voices': []}
        self.send_bytes(json.dumps(payload).encode(), 'application/json')

    def handle_status(self):
        assets = os.path.join(DIRECTORY, 'assets')
        info = {
            'tts': HAVE_TTS or HAVE_LOCAL,
            'engine': 'kokoro' if HAVE_LOCAL else ('edge-tts' if HAVE_TTS else None),
            'cloud': bool(not HAVE_LOCAL and HAVE_TTS),
            'manifests': {
                name: os.path.exists(os.path.join(assets, name))
                for name in ('gfx-manifest.json', 'audio-manifest.json', 'moo-strings.json')
            },
            'format': EDGE_FORMAT,
            'normalise': bool(shutil.which('ffmpeg')),
            'market': HAVE_CURL_CFFI,
            'music': len([f for f in os.listdir(os.path.join(assets, 'audio', 'music'))
                          if f.endswith('.ogg')]) if os.path.isdir(
                              os.path.join(assets, 'audio', 'music')) else 0,
        }
        self.send_bytes(json.dumps(info).encode(), 'application/json')

    def handle_tts(self, q):
        text = (q.get('text', [''])[0] or '').strip()[:MAX_TEXT]
        if not text:
            return self.send_bytes(b'{"error":"no text"}', 'application/json', 400)
        if not HAVE_TTS and not HAVE_LOCAL:
            return self.send_bytes(
                b'{"error":"no voice engine; run ./start.sh so the venv is used"}',
                'application/json', 503)

        voice = clean_voice(q.get('voice', [''])[0])
        use_local = HAVE_LOCAL and (voice in LOCAL_VOICE_IDS or not HAVE_TTS)
        rate = clean_prosody(q.get('rate', [''])[0], '-5%', '%')
        pitch = clean_prosody(q.get('pitch', [''])[0], '-10Hz', 'Hz')
        try:
            seq = int(q.get('seq', ['0'])[0])
        except ValueError:
            seq = 0
        sid = clean_session(q.get('sid', [''])[0])
        note_sequence(sid, seq)

        # edge-tts opens its own websocket per call; serialise so a rapid skip
        # storm cannot open dozens at once. Wait in slices so a request the
        # client has already moved past can give up instead of blocking.
        while not _tts_lock.acquire(timeout=0.2):
            if superseded(sid, seq):
                return self.send_bytes(b'{"error":"superseded"}',
                                       'application/json', 409)
        try:
            if superseded(sid, seq):
                return self.send_bytes(b'{"error":"superseded"}',
                                       'application/json', 409)
            audio = (synthesize_local(text, voice, rate) if use_local
                     else synthesize(text, voice, rate, pitch))
        except Exception as err:                      # noqa: BLE001 - report to client
            sys.stderr.write('[GNN] tts failed voice=%s: %s\n' % (voice, err))
            return self.send_bytes(
                json.dumps({'error': str(err)}).encode(), 'application/json', 502)
        finally:
            _tts_lock.release()

        if not audio:
            return self.send_bytes(b'{"error":"empty synthesis"}', 'application/json', 502)
        payload, ctype = normalize(audio)
        self.send_bytes(payload, ctype)


class ThreadedServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True


def write_pidfile():
    """Leave a PID behind so stop.sh can take the station off air cleanly."""
    try:
        with open(PIDFILE, 'w') as fh:
            fh.write(str(os.getpid()))
        atexit.register(clear_pidfile)
    except OSError:
        pass


def clear_pidfile():
    try:
        if os.path.exists(PIDFILE):
            with open(PIDFILE) as fh:
                if fh.read().strip() == str(os.getpid()):
                    os.remove(PIDFILE)
    except OSError:
        pass


def run_server():
    write_pidfile()
    if HAVE_LOCAL:
        threading.Thread(target=warm_local, daemon=True).start()
    with ThreadedServer(('', PORT), GNNRequestHandler) as httpd:
        def go_off_air(*_args):
            # Shut the listener from another thread; serve_forever then returns.
            threading.Thread(target=httpd.shutdown, daemon=True).start()

        for sig in (signal.SIGTERM, signal.SIGINT):
            try:
                signal.signal(sig, go_off_air)
            except ValueError:
                pass

        print('[GNN Server] http://localhost:%d  (pid %d)' % (PORT, os.getpid()))
        if HAVE_LOCAL:
            engine = 'kokoro (local, nothing leaves this machine)'
        elif HAVE_TTS:
            engine = 'edge-tts (calls Microsoft)'
        else:
            engine = 'UNAVAILABLE - start with ./start.sh so the venv is used'
        print('[GNN Server] voice engine: %s' % engine)
        print('[GNN Server] market: %s'
              % ('yahoo (curl_cffi) + coingecko' if HAVE_CURL_CFFI
                 else 'coingecko only — pip install curl_cffi for equities'))
        print('[GNN Server] stop with Ctrl-C, or ./stop.sh')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            httpd.server_close()
            clear_pidfile()
            print('\n[GNN Server] off air.')


if __name__ == '__main__':
    run_server()