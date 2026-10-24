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
    /api/feed         curated RSS/Atom feed proxy
    /api/news-ledger  shared persistent story ledger (GET reads, PUT merges)

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

The /api/localnews route reads *every* news_brief on disk, not just the
newest one. Returning only the newest left the station with about twenty
stories to draw from for an entire session — the same headline cycled
back every fifteen minutes, and the same six headlines appeared across
every show all night. Fourteen daily briefs is roughly two hundred and
eighty distinct stories, and the ledger now records which of them have
already been read so a story cannot air twice in one installation.
"""

import asyncio
import atexit
import datetime
import hashlib
import http.server
import json
import os
import re
import shutil
import signal
import socketserver
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

PORT = int(os.environ.get('GNN_PORT', 8080))
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
# A second instance on another port (a test server) keeps its own pid file:
# sharing one let ./stop.sh kill the test server and ./start.sh report the
# station "already on air" while nothing was listening on 8080.
PIDFILE = os.path.join(DIRECTORY, '.gnn-server.pid' if PORT == 8080
                       else '.gnn-server-%d.pid' % PORT)
# The technical server log
LOG = os.path.join(DIRECTORY, 'gnn-server.log')
# The clean, dedicated broadcast transcript log
TRANSCRIPT_LOG = os.path.join(DIRECTORY, 'gnn-transcript.log')
# The shared story ledger. Every story the station has ever ingested lives
# here with a status of pending / queued / aired, and no story that reaches
# 'aired' is ever dispatched again. Kept beside the logs because it is
# server state — the browser reads and writes it through /api/news-ledger
# so a cleared profile cannot roll history back.
LEDGER = os.path.join(DIRECTORY, 'gnn-news-ledger.json')
# The show-block configuration edited by tools/show-editor.html.
SHOW_CONFIG = os.path.join(DIRECTORY, 'assets', 'generated', 'show-config.json')

# Size capping: default 250MB, configurable up to 1GB (1000MB) via GNN_MAX_LOG_MB
MAX_LOG_SIZE_MB = int(os.environ.get('GNN_MAX_LOG_MB', 250))
MAX_LOG_SIZE_BYTES = max(10, min(1000, MAX_LOG_SIZE_MB)) * 1024 * 1024
MAX_BACKUPS = int(os.environ.get('GNN_LOG_BACKUPS', 3))

_log_rotate_lock = threading.Lock()


def rotate_file_if_needed(path):
    """Rotate log file if it exceeds MAX_LOG_SIZE_BYTES, retaining up to MAX_BACKUPS archives."""
    try:
        if not os.path.exists(path):
            return
        if os.path.getsize(path) < MAX_LOG_SIZE_BYTES:
            return

        with _log_rotate_lock:
            if not os.path.exists(path) or os.path.getsize(path) < MAX_LOG_SIZE_BYTES:
                return

            for i in range(MAX_BACKUPS - 1, 0, -1):
                sfn = f"{path}.{i}"
                dfn = f"{path}.{i + 1}"
                if os.path.exists(sfn):
                    if os.path.exists(dfn):
                        os.remove(dfn)
                    os.rename(sfn, dfn)

            dfn = f"{path}.1"
            if os.path.exists(dfn):
                os.remove(dfn)
            os.rename(path, dfn)

            now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            with open(path, 'w', encoding='utf-8') as f:
                f.write(f"[{now_str}] [System] Log rotated (exceeded {MAX_LOG_SIZE_MB}MB). Previous entries archived in {os.path.basename(dfn)}\n")
    except Exception:
        pass


class TeeStream:
    """Duplicate stream writes to both the original stream and gnn-server.log with rotation support."""
    def __init__(self, original, log_file):
        self.original = original
        self.log_file = log_file
        self._lock = threading.Lock()

    def write(self, data):
        self.original.write(data)
        if not data:
            return
        try:
            rotate_file_if_needed(self.log_file)
            with self._lock:
                with open(self.log_file, 'a', encoding='utf-8') as fh:
                    fh.write(data)
                    fh.flush()
        except OSError:
            pass

    def flush(self):
        self.original.flush()

    def fileno(self):
        return self.original.fileno()

    def isatty(self):
        return getattr(self.original, 'isatty', lambda: False)()


def setup_server_logging():
    """Ensure all server stdout and stderr writes are mirrored into LOG."""
    try:
        import fcntl
        for fd in (1, 2):
            flags = fcntl.fcntl(fd, fcntl.F_GETFL)
            fcntl.fcntl(fd, fcntl.F_SETFL, flags | os.O_APPEND)
    except Exception:
        pass

    try:
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(line_buffering=True)
        if hasattr(sys.stderr, 'reconfigure'):
            sys.stderr.reconfigure(line_buffering=True)
    except Exception:
        pass

    try:
        if os.path.exists(LOG) and hasattr(sys.stdout, 'fileno'):
            s_log = os.stat(LOG)
            s_out = os.fstat(sys.stdout.fileno())
            if s_log.st_ino == s_out.st_ino and s_log.st_dev == s_out.st_dev:
                return
    except Exception:
        pass

    sys.stdout = TeeStream(sys.stdout, LOG)
    sys.stderr = TeeStream(sys.stderr, LOG)


setup_server_logging()

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
    ('am_puck', 'PUCK — Field Reporter'),
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

# One synthesis at a time, granted in order. It was a bare Lock polled every
# 200 ms, so whichever waiter woke first won: a commercial break prefetches
# all sixteen of its lines at once, and the line needed *now* could wait
# behind lines needed a minute later — up to six seconds of a spot on screen
# with no voice. Waiters are served first come, first served, except that a
# live line (seq > 0, the one about to air) goes ahead of every prefetch
# (seq 0) still waiting.
_tts_cond = threading.Condition()
_tts_waiting = []          # tickets, in the order they will be served
_tts_busy = False


def tts_enter(sid, seq):
    """Wait for this request's turn. False if it was superseded first."""
    global _tts_busy
    me = object()
    with _tts_cond:
        if seq:
            at = next((i for i, (_, s) in enumerate(_tts_waiting) if not s),
                      len(_tts_waiting))
            _tts_waiting.insert(at, (me, seq))
        else:
            _tts_waiting.append((me, seq))
        while _tts_busy or _tts_waiting[0][0] is not me:
            _tts_cond.wait(0.2)
            if superseded(sid, seq):
                _tts_waiting[:] = [w for w in _tts_waiting if w[0] is not me]
                _tts_cond.notify_all()
                return False
        _tts_waiting.pop(0)
        _tts_busy = True
        return True


def tts_exit():
    global _tts_busy
    with _tts_cond:
        _tts_busy = False
        _tts_cond.notify_all()

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


# --- persistent news ledger -------------------------------------------
#
# The server holds the shared story ledger. Every story the station has ever
# ingested lives here with a status of pending / queued / aired; the client
# reads it at boot, merges the browser's copy in, and PUTs back any change.
# An 'aired' record is terminal — a stale browser's queued copy never rolls
# it back, so a story that has been read once is never read again, no matter
# how many tabs are open or how many Chromium profiles have been wiped.
#
# The ledger is a single JSON file, rewritten atomically. Records expire
# after LEDGER_RETENTION_DAYS (below), on load and on every merge. That is
# long enough to stop an aired story coming back when an RSS feed republishes
# the same headline weeks later; past it, the director's archive cut-offs
# file a resurfacing story to the lore show instead.

_ledger_lock = threading.Lock()
_ledger_cache = None


def _title_hash(title):
    """Stable content hash of a normalised headline."""
    norm = re.sub(r'[^a-z0-9]+', ' ', str(title or '').lower()).strip()
    if not norm:
        return ''
    return hashlib.sha1(norm.encode('utf-8')).hexdigest()[:16]


def _load_ledger():
    """Load the ledger into memory, or an empty one if it does not exist."""
    global _ledger_cache
    if _ledger_cache is not None:
        return _ledger_cache
    try:
        with open(LEDGER, encoding='utf-8') as fh:
            data = json.load(fh)
            if not isinstance(data, dict) or 'items' not in data:
                data = {'version': 1, 'items': {}}
            if not isinstance(data['items'], dict):
                # Tolerate the list form the client uses.
                items = {}
                for record in data['items'] or []:
                    if isinstance(record, dict):
                        key = str(record.get('key') or
                                  record.get('ledgerKey') or
                                  _title_hash(record.get('title')))
                        if key:
                            items[key] = record
                data['items'] = items
            _ledger_cache = data
    except (OSError, json.JSONDecodeError):
        _ledger_cache = {'version': 1, 'items': {}}
    _expire_ledger(_ledger_cache.setdefault('items', {}))
    return _ledger_cache


# Records first seen this long ago are dropped. The client's fuzzy
# duplicate check looks back 45 days, so older records do nothing but cost:
# every new story is compared with the whole window, and the file had no
# expiry at all. A story that resurfaces after this is older than the
# director's archive cut-offs (7 days for a digest, 21 for RSS), so it is
# filed to the lore show's archive bucket and does not re-air.
LEDGER_RETENTION_DAYS = 90


def _expire_ledger(items, now=None):
    """Drop records first seen before the retention window. Returns count."""
    cutoff = ((now or time.time()) - LEDGER_RETENTION_DAYS * 86400) * 1000
    old = [k for k, r in items.items()
           if isinstance(r, dict) and isinstance(r.get('firstSeenAt'), (int, float))
           and r['firstSeenAt'] < cutoff]
    for k in old:
        del items[k]
    return len(old)


def _save_ledger():
    """Atomically rewrite the ledger file."""
    tmp = LEDGER + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as fh:
        json.dump(_ledger_cache, fh, indent=2, ensure_ascii=False)
        fh.flush()
        os.fsync(fh.fileno())
    os.replace(tmp, LEDGER)


def _merge_ledger_record(existing, incoming):
    """Merge one incoming record over an existing one. 'aired' is terminal."""
    if not existing:
        return dict(incoming)
    merged = dict(existing)
    merged.update(incoming)
    # An aired record never rolls back. The reportedAt and reportedShow
    # fields survive from whichever side first set them.
    if existing.get('status') == 'aired' or incoming.get('status') == 'aired':
        merged['status'] = 'aired'
        merged['reportedAt'] = (existing.get('reportedAt')
                                or incoming.get('reportedAt'))
        merged['reportedShow'] = (existing.get('reportedShow')
                                  or incoming.get('reportedShow'))
    # Alias and source lists union rather than replace. Different browsers
    # see different feeds; every provenance is kept.
    aliases = set(existing.get('aliasKeys') or [])
    aliases.update(incoming.get('aliasKeys') or [])
    merged['aliasKeys'] = sorted(aliases)
    sources = set(existing.get('sources') or [])
    sources.update(incoming.get('sources') or [])
    merged['sources'] = sorted(sources)
    return merged


class GNNRequestHandler(http.server.SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    _log_file_lock = threading.Lock()
    _transcript_file_lock = threading.Lock()

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
        # Do not log /api/log or /api/transcript requests to avoid log noise/recursion
        if self.path and (self.path.startswith('/api/log') or self.path.startswith('/api/transcript')):
            return
        code = str(args[1]) if len(args) > 1 else ''
        # Log all /api/ requests, or any HTTP errors (4xx / 5xx) on static assets
        if '/api/' in (self.path or '') or (code and code.startswith(('4', '5'))):
            stamp = datetime.datetime.now().strftime('%H:%M:%S')
            sys.stderr.write('[%s] [GNN Server] %s\n' % (stamp, fmt % args))
            sys.stderr.flush()

    # -- routing ------------------------------------------------

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip('/')
        if path == '/api/tts':
            return self.handle_tts(urllib.parse.parse_qs(parsed.query))
        if path == '/api/status':
            return self.handle_status()
        if path == '/api/voices':
            return self.handle_voices()
        if path == '/api/localnews':
            return self.handle_localnews()
        if path == '/api/spaceweather':
            return self.handle_spaceweather()
        if path == '/api/market':
            return self.handle_market()
        if path == '/api/feed':
            return self.handle_feed(urllib.parse.parse_qs(parsed.query))
        if path == '/api/news-ledger':
            return self.handle_newsledger_get()
        if path == '/api/config':
            return self.handle_config_get()
        if path == '/api/config/editor-options':
            return self.handle_editor_options()
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip('/')
        if path == '/api/log':
            return self.handle_log()
        if path == '/api/transcript':
            return self.handle_transcript()
        return self.send_bytes(b'{"error":"not found"}', 'application/json', 404)

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip('/')
        if path == '/api/news-ledger':
            return self.handle_newsledger_put()
        if path == '/api/config':
            return self.handle_config_put()
        return self.send_bytes(b'{"error":"method not allowed"}',
                               'application/json', 405)

    # -- browser log sink ---------------------------------------

    def handle_log(self):
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            length = 0
        if length <= 0:
            return self.send_bytes(b'{"ok":false}', 'application/json', 400)

        MAX_READ = 256 * 1024
        try:
            raw = self.rfile.read(min(length, MAX_READ))
            if length > MAX_READ:
                rem = length - MAX_READ
                while rem > 0:
                    chunk = self.rfile.read(min(rem, 65536))
                    if not chunk:
                        break
                    rem -= len(chunk)
            body = raw.decode('utf-8', 'replace').rstrip('\r\n')
        except (OSError, UnicodeError):
            return self.send_bytes(b'{"ok":false}', 'application/json', 400)

        if not body:
            return self.send_bytes(b'{"ok":true}', 'application/json')

        now_str = datetime.datetime.now().strftime('%H:%M:%S')
        lines_to_write = []

        parsed_json = False
        content_type = self.headers.get('Content-Type', '')
        if 'application/json' in content_type or body.lstrip().startswith(('{', '[')):
            try:
                data = json.loads(body)
                parsed_json = True
                entries = data if isinstance(data, list) else [data]
                for item in entries:
                    if not isinstance(item, dict):
                        lines_to_write.append('[%s] [Browser] %s' % (now_str, item))
                        continue
                    lvl = str(item.get('level', 'INFO')).upper()
                    tag = item.get('tag', '')
                    msg = str(item.get('message', ''))
                    stack = item.get('stack', '')
                    item_time = item.get('time', now_str)

                    prefix = '[%s] [Browser:%s]' % (item_time, lvl)
                    if tag:
                        prefix += ' [%s]' % tag

                    for m_line in msg.splitlines():
                        lines_to_write.append('%s %s' % (prefix, m_line))
                    if stack:
                        for s_line in str(stack).splitlines():
                            lines_to_write.append('[%s] [Browser:%s]   %s' % (item_time, lvl, s_line))
            except Exception:
                parsed_json = False

        if not parsed_json:
            for line in body.splitlines():
                line = line.rstrip()
                if not line:
                    continue
                if line.startswith('[') and len(line) > 10 and line[3] == ':' and line[6] == ':':
                    lines_to_write.append('[Browser] %s' % line)
                else:
                    lines_to_write.append('[%s] [Browser] %s' % (now_str, line))

        if lines_to_write:
            try:
                rotate_file_if_needed(LOG)
                with GNNRequestHandler._log_file_lock:
                    with open(LOG, 'a', encoding='utf-8') as fh:
                        for l in lines_to_write:
                            fh.write(l + '\n')
                        fh.flush()
            except OSError:
                pass

        return self.send_bytes(b'{"ok":true}', 'application/json')

    # -- broadcast transcript sink ------------------------------

    def handle_transcript(self):
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            length = 0
        if length <= 0:
            return self.send_bytes(b'{"ok":false}', 'application/json', 400)

        MAX_READ = 512 * 1024
        try:
            raw = self.rfile.read(min(length, MAX_READ))
            if length > MAX_READ:
                rem = length - MAX_READ
                while rem > 0:
                    chunk = self.rfile.read(min(rem, 65536))
                    if not chunk:
                        break
                    rem -= len(chunk)
            body = raw.decode('utf-8', 'replace').rstrip('\r\n')
        except (OSError, UnicodeError):
            return self.send_bytes(b'{"ok":false}', 'application/json', 400)

        if not body:
            return self.send_bytes(b'{"ok":true}', 'application/json')

        now_ms = datetime.datetime.now().strftime('%H:%M:%S.%f')[:-3]
        lines_to_write = []

        parsed_json = False
        content_type = self.headers.get('Content-Type', '')
        if 'application/json' in content_type or body.lstrip().startswith(('{', '[')):
            try:
                data = json.loads(body)
                parsed_json = True
                entries = data if isinstance(data, list) else [data]
                for item in entries:
                    if not isinstance(item, dict):
                        s = str(item)
                        if s.startswith('[') and len(s) > 13 and s[3] == ':' and s[6] == ':' and s[9] == '.':
                            lines_to_write.append(s)
                        else:
                            lines_to_write.append('[%s] %s' % (now_ms, s))
                        continue

                    # Direct formatted lines or list of formatted lines
                    if 'lines' in item and isinstance(item['lines'], list):
                        lines_to_write.extend([str(l) for l in item['lines']])
                    elif 'formatted' in item and item['formatted']:
                        fmt_val = item['formatted']
                        if isinstance(fmt_val, list):
                            lines_to_write.extend([str(l) for l in fmt_val])
                        else:
                            lines_to_write.extend(str(fmt_val).splitlines())
                    else:
                        ts = item.get('timestamp') or item.get('time') or now_ms
                        tag = str(item.get('type') or item.get('tag') or 'EVENT').upper()
                        msg = item.get('text') or item.get('message') or ''
                        lines_to_write.append('[%s] [%s] %s' % (ts, tag, msg))
            except Exception:
                parsed_json = False

        if not parsed_json:
            for line in body.splitlines():
                line = line.rstrip()
                if not line:
                    continue
                # If line already starts with [HH:MM:SS.mmm], preserve it
                if line.startswith('[') and len(line) > 13 and line[3] == ':' and line[6] == ':' and line[9] == '.':
                    lines_to_write.append(line)
                elif line.startswith('[') and len(line) > 9 and line[3] == ':' and line[6] == ':':
                    lines_to_write.append('[%s.%s %s' % (line[1:9], '000]', line[10:].lstrip()))
                else:
                    lines_to_write.append('[%s] %s' % (now_ms, line))

        if lines_to_write:
            try:
                rotate_file_if_needed(TRANSCRIPT_LOG)
                with GNNRequestHandler._transcript_file_lock:
                    with open(TRANSCRIPT_LOG, 'a', encoding='utf-8') as fh:
                        for l in lines_to_write:
                            fh.write(l + '\n')
                        fh.flush()
            except OSError:
                pass

        return self.send_bytes(b'{"ok":true}', 'application/json')

    # Curated RSS/Atom sources only. The allowlist prevents this route from
    # becoming an arbitrary URL fetcher (SSRF). Redirects are checked too.
    FEED_ALLOWED_HOSTS = {
        'feeds.arstechnica.com', 'feeds.bbci.co.uk',
        'feeds.content.dowjones.io', 'news.un.org', 'news.ycombinator.com',
        'phys.org', 'spaceflightnow.com', 'techcrunch.com',
        'www.aljazeera.com', 'www.esa.int', 'www.espn.com',
        'www.livescience.com', 'www.nasa.gov', 'www.nature.com',
        'www.sciencedaily.com', 'www.technologyreview.com',
        'www.theverge.com', 'www.wired.com',
        # Weather desk: the two weather shows had no feed of their own.
        'www.theguardian.com', 'www.severe-weather.eu',
    }
    FEED_MAX_BYTES = 5 * 1024 * 1024

    def handle_feed(self, query):
        raw_url = (query.get('url') or [''])[0]
        try:
            parsed = urllib.parse.urlparse(raw_url)
            if (parsed.scheme != 'https' or not parsed.hostname
                    or parsed.username or parsed.password
                    or parsed.port not in (None, 443)
                    or parsed.hostname.lower() not in self.FEED_ALLOWED_HOSTS):
                return self.send_bytes(b'{"error":"feed URL not allowed"}',
                                       'application/json', 400)

            allowed_hosts = self.FEED_ALLOWED_HOSTS

            class SafeRedirect(urllib.request.HTTPRedirectHandler):
                def redirect_request(self, req, fp, code, msg, headers, newurl):
                    target = urllib.parse.urlparse(newurl)
                    if (target.scheme != 'https' or not target.hostname
                            or target.hostname.lower() not in allowed_hosts
                            or target.username or target.password
                            or target.port not in (None, 443)):
                        raise urllib.error.HTTPError(
                            newurl, code, 'Redirect host not allowed', headers, fp)
                    return super().redirect_request(req, fp, code, msg, headers, newurl)

            request = urllib.request.Request(
                raw_url, headers={'User-Agent': 'GNN-Newsroom/1.0',
                                   'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml'})
            opener = urllib.request.build_opener(SafeRedirect())
            with opener.open(request, timeout=10) as response:
                final = urllib.parse.urlparse(response.geturl())
                if (final.scheme != 'https' or not final.hostname
                        or final.hostname.lower() not in self.FEED_ALLOWED_HOSTS):
                    return self.send_bytes(b'{"error":"feed redirect not allowed"}',
                                           'application/json', 502)
                body = response.read(self.FEED_MAX_BYTES + 1)
                # Some feeds (UN News) send gzip whether or not it was asked
                # for; passed through compressed, the client saw "Invalid feed
                # XML" on every poll.
                if body[:2] == b'\x1f\x8b':
                    import gzip
                    try:
                        body = gzip.decompress(body)[:self.FEED_MAX_BYTES + 1]
                    except OSError:
                        pass
                if len(body) > self.FEED_MAX_BYTES:
                    return self.send_bytes(b'{"error":"feed too large"}',
                                           'application/json', 502)
                if response.status != 200:
                    return self.send_bytes(b'{"error":"upstream failed"}',
                                           'application/json', 502)
            return self.send_bytes(body, 'application/xml; charset=utf-8')
        except urllib.error.HTTPError as err:
            stamp = datetime.datetime.now().strftime('%H:%M:%S')
            # Rejected redirects raise HTTPError with the redirect's own code
            # (301/302/307...), which is not suitable for a JSON error response.
            # Clamp those to 502 while preserving genuine upstream 4xx/5xx codes,
            # including 429 so the client can activate its rate-limit handling.
            code = err.code if 400 <= err.code < 600 else 502
            sys.stderr.write('[%s] [GNN Feed] %s -> HTTP %s: %s\n' %
                             (stamp, raw_url, err.code, err.reason))
            sys.stderr.flush()
            return self.send_bytes(
                json.dumps({'error': 'upstream HTTP %s' % err.code}).encode(),
                'application/json', code)
        except Exception as err:
            sys.stderr.write('[GNN] feed proxy failed %s: %s\n' % (raw_url, err))
            return self.send_bytes(b'{"error":"upstream failed"}',
                                   'application/json', 502)

    # Prefer Kaiacord's item-level news_brief over news_summary:
    # summaries can contain "no news" placeholders, which
    # are not stories and must never be handed to an anchor as headlines.
    NEWS_DIRS = [
        os.path.expanduser('~/github/Kaiacord/knowledge_base/news/daily'),
        os.path.expanduser('~/github/Kaiacord/knowledge_base/news'),
    ]
    NEWS_BRIEF_PREFIX = 'news_brief_'

    NEWS_SECTIONS = {
        'GENERAL NEWS': 'world', 'GENERAL_NEWS': 'world',
        'WORLD': 'world', 'INTERNATIONAL': 'world',
        'US POLITICS': 'diplomacy', 'US_POLITICS': 'diplomacy',
        'POLITICS': 'diplomacy', 'GLOBAL GEOPOLITICS': 'diplomacy',
        'GLOBAL_GEOPOLITICS': 'diplomacy',
        'BUSINESS': 'markets', 'BUSINESS AND ECONOMY': 'markets',
        'BUSINESS_AND_ECONOMY': 'markets', 'ECONOMY': 'markets',
        'MARKETS': 'markets', 'TECH': 'tech', 'TECHNOLOGY': 'tech',
        'TECHNOLOGY AND INFRASTRUCTURE': 'tech',
        'TECHNOLOGY_AND_INFRASTRUCTURE': 'tech',
        'SCIENCE': 'science', 'SCIENCE AND HEALTH': 'science',
        'SCIENCE_AND_HEALTH': 'science', 'SPORTS': 'sport', 'SPORT': 'sport',
        'HEALTH': 'science', 'CULTURE AND ENTERTAINMENT': 'world',
        'CULTURE_AND_ENTERTAINMENT': 'world', 'ENTERTAINMENT': 'world',
        'SECURITY INCIDENTS': 'security', 'SECURITY_INCIDENTS': 'security',
        'HACKER CULTURE': 'security', 'HACKER_CULTURE': 'security',
    }
    # A digest placeholder, not a reportable story. Keep regex escapes single
    # inside raw strings (e.g. r"\b" is a word boundary; r"\\b" is not).
    NON_STORY_LINE = re.compile(
        r'^\s*(?:'
        r'no\b.{0,60}\b(?:news|update|updates|developments?|stories|reports?|details)'
        r'|nothing\s+to\s+report'
        r'|no\s+further\s+(?:details|information|comment)'
        r'|no\s+verified\s+developments?'
        r'|no\s+verifiable\s+quote'
        r'|more\s+on\s+this\s+later'
        r'|developing\s+story'
        r')(?:\s+(?:today|yet|so\s+far|at\s+this\s+time|available|reported))?'
        r'\s*[.!]?\s*$', re.IGNORECASE)

    # -- local news briefs --------------------------------------

    def _all_brief_paths(self):
        """Return every news_brief on disk, newest calendar date first.

        Returns all of them, not just the newest. Returning only the newest
        was the original bug: the station ingested roughly twenty stories,
        aired them all, and then cycled them back on the same schedule every
        fifteen minutes and across every show. Fourteen daily briefs is
        roughly two hundred and eighty distinct stories.
        """
        candidates = []
        for directory in self.NEWS_DIRS:
            if not os.path.isdir(directory):
                continue
            try:
                for name in os.listdir(directory):
                    lower = name.lower()
                    if (lower.startswith(self.NEWS_BRIEF_PREFIX)
                            and lower.endswith('.md')):
                        full = os.path.join(directory, name)
                        if os.path.isfile(full):
                            match = re.search(r'(20\d{6})', name)
                            date_key = match.group(1) if match else ''
                            candidates.append(
                                (date_key, os.path.getmtime(full), full))
            except OSError:
                continue
        # If no briefs are on disk, fall back to news_summary files so the
        # station is not silent in an installation that only has summaries.
        if not candidates:
            for directory in self.NEWS_DIRS:
                if not os.path.isdir(directory):
                    continue
                try:
                    for name in os.listdir(directory):
                        lower = name.lower()
                        if (lower.startswith('news_summary_')
                                and lower.endswith('.md')):
                            full = os.path.join(directory, name)
                            if os.path.isfile(full):
                                match = re.search(r'(20\d{6})', name)
                                candidates.append(
                                    (match.group(1) if match else '',
                                     os.path.getmtime(full), full))
                except OSError:
                    continue
        candidates.sort(key=lambda row: (row[0], row[1]), reverse=True)
        return [row[2] for row in candidates]

    def _parse_brief(self, path):
        """Parse one brief into a list of story items.

        The filename's own date is attached as pubDate so the client's
        recency scoring can prefer a fresh brief over an older one without
        guessing from the file's mtime.
        """
        items = []
        section = 'world'
        in_front_matter = False
        body_started = False
        try:
            with open(path, encoding='utf-8') as fh:
                for raw in fh:
                    line = raw.strip()
                    if line == '---':
                        if not body_started:
                            in_front_matter = not in_front_matter
                        continue
                    if in_front_matter or not line:
                        continue
                    if raw[:1].isspace():
                        # Nested detail lines are not their own story.
                        continue
                    body_started = True
                    if line.startswith('#'):
                        head = line.lstrip('#').strip().upper()
                        if head in ('EXECUTIVE_SUMMARY', 'EXECUTIVE SUMMARY',
                                    'NEWS BRIEF', 'SUMMARY'):
                            section = None
                        else:
                            section = self.NEWS_SECTIONS.get(head, 'world')
                        continue
                    if section is None or not line.startswith('- '):
                        continue
                    text = line[2:].strip()
                    if not text or text.upper().startswith('QUOTE:'):
                        continue
                    if self.NON_STORY_LINE.match(text):
                        continue
                    # A short taxonomy label ("World Events:") is a filing
                    # marker, not part of the story the anchor reads.
                    if ': ' in text:
                        prefix, remainder = text.split(': ', 1)
                        if (len(prefix) <= 32
                                and prefix.replace('_', ' ').isalpha()):
                            text = remainder.strip()
                    text = (text.replace(' & ', ' and ')
                            .replace('/', ', ').rstrip('.').strip())
                    if len(text) < 25 or self.NON_STORY_LINE.match(text):
                        continue
                    match_date = re.search(r'(20\d{2})(\d{2})(\d{2})',
                                           os.path.basename(path))
                    pub_date = ''
                    if match_date:
                        pub_date = '%s-%s-%sT12:00:00Z' % match_date.groups()
                    items.append({
                        'title': text,
                        'description': '',
                        'category': section or 'world',
                        'source': os.path.basename(path),
                        'pubDate': pub_date,
                    })
        except OSError as err:
            sys.stderr.write('[GNN] brief read failed (%s): %s\n'
                             % (os.path.basename(path), err))
        return items

    # NOAA Space Weather Prediction Center alerts, as readable stories for
    # the weather desk (Solar Wind Overnight). Real data, read straight: each
    # alert's own headline and its stated impacts, nothing invented. Only the
    # latest alert of each kind from the last two days, cached 15 minutes.
    SWPC_URL = 'https://services.swpc.noaa.gov/products/alerts.json'
    _swpc_cache = {'at': 0.0, 'items': []}

    @staticmethod
    def _swpc_story(message):
        lines = [l.strip() for l in message.replace('\r', '').split('\n')]
        head = next((l for l in lines if re.match(
            r'^(EXTENDED |CANCEL )?(ALERT|WARNING|WATCH|SUMMARY):', l)), '')
        if not head or head.startswith('CANCEL'):
            return None
        kind, _, what = head.partition(':')
        what = what.strip().rstrip('.')
        kind = kind.replace('EXTENDED ', '').lower()
        m = re.search(r'Geomagnetic K-index of (\d)', what)
        if m:
            k = int(m.group(1))
            storm = {5: ' — a minor G1 storm', 6: ' — a moderate G2 storm',
                     7: ' — a strong G3 storm', 8: ' — a severe G4 storm',
                     9: ' — an extreme G5 storm'}.get(k, '')
            title = ('NOAA %s: geomagnetic activity reaches K-index %d%s' if kind == 'alert'
                     else 'NOAA %s: geomagnetic K-index of %d expected%s') % (kind, k, storm)
        elif 'Geomagnetic Storm Category' in what:
            g = re.search(r'Category (G\d)', what)
            title = 'NOAA %s: %s geomagnetic storm %s' % (
                kind, g.group(1) if g else 'a', 'predicted' if 'Predict' in what else 'conditions')
        elif 'x-ray' in what.lower():
            cls = re.search(r'\b([MX]\d+(?:\.\d)?)\b', what)
            title = 'NOAA %s: solar flare detected%s' % (
                kind, ' at class %s' % cls.group(1) if cls else '')
        elif 'Electron' in what:
            title = 'NOAA %s: high-energy electron levels elevated in geostationary orbit' % kind
        elif 'Proton' in what:
            title = 'NOAA %s: solar radiation storm, proton levels elevated' % kind
        elif 'Sudden Impulse' in what:
            title = 'NOAA %s: sudden jolt to Earth\u2019s magnetic field as solar wind arrives' % kind
        elif 'Radio Emission' in what or 'Radio Burst' in what or 'Type II' in what or 'Type IV' in what:
            title = 'NOAA %s: solar radio burst detected' % kind
        else:
            title = 'NOAA space weather %s: %s' % (kind, what[:90])
        impacts = []
        grab = False
        for l in lines:
            if l.startswith('Potential Impacts'):
                grab = True
                l = l.partition(':')[2].strip()
            elif grab and (not l or l.startswith('NOAA Space Weather')):
                break
            if grab and l and not l.startswith('Area of impact'):
                impacts.append(re.sub(r'^[A-Za-z /]+ - ', '', l))
        desc = ' '.join(impacts[:3])
        return title, desc

    # Current conditions, so the weather desk has a real reading on a quiet
    # day too, when NOAA issues no alerts. Built only from the published
    # numbers: solar wind speed, planetary K-index, the R/S/G scales and the
    # day's probabilities. One report per UTC quarter-day — the title names
    # it, so the ledger's title dedupe lets the next one through.
    SWPC_SCALES = 'https://services.swpc.noaa.gov/products/noaa-scales.json'
    SWPC_WIND = 'https://services.swpc.noaa.gov/products/summary/solar-wind-speed.json'
    SWPC_KP = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json'

    @staticmethod
    def _swpc_json(url):
        req = urllib.request.Request(url, headers={'User-Agent': 'GNN/1.0'})
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read(2 * 1024 * 1024).decode('utf-8', 'replace'))

    @staticmethod
    def _swpc_conditions(scales, wind, kp_rows, now):
        """(title, description) for the current reading, or None."""
        when = datetime.datetime.fromtimestamp(now, datetime.timezone.utc)
        part = ('overnight', 'morning', 'afternoon', 'evening')[when.hour // 6]
        try:
            speed = int(round(float(wind[0]['proton_speed']) / 10.0) * 10)
        except (LookupError, TypeError, ValueError):
            speed = None
        try:
            kp = float(kp_rows[-1]['Kp'])
        except (LookupError, TypeError, ValueError):
            kp = None
        if speed is None and kp is None:
            return None
        if kp is None:
            field = 'geomagnetic field readings delayed'
        elif kp >= 5:
            field = 'a G%d geomagnetic storm in progress' % min(5, int(kp) - 4)
        elif kp >= 4:
            field = 'geomagnetic field active'
        elif kp >= 3:
            field = 'geomagnetic field unsettled'
        else:
            field = 'geomagnetic field quiet'
        wind_txt = ''
        if speed is not None:
            pace = ' fast' if speed >= 600 else ''
            wind_txt = ', solar wind%s at %d kilometres a second' % (pace, speed)
        title = 'Space weather report, %s %s: %s%s' % (
            when.strftime('%A'), part, field, wind_txt)

        said = []
        if kp is not None:
            said.append('The planetary K-index stands at %d.' % round(kp))
        now_scale = (scales or {}).get('0') or {}
        for key, name in (('R', 'Radio blackouts are'), ('S', 'A solar radiation storm is'),
                          ('G', 'A geomagnetic storm is')):
            sc = (now_scale.get(key) or {})
            if str(sc.get('Scale') or '0') not in ('0', 'None'):
                said.append('%s under way at %s%s, rated %s.'
                            % (name, key, sc['Scale'], sc.get('Text') or ''))
        today = (scales or {}).get('1') or {}
        r1 = (today.get('R') or {}).get('MinorProb')
        r3 = (today.get('R') or {}).get('MajorProb')
        s1 = (today.get('S') or {}).get('Prob')
        if r1 and r3:
            said.append('NOAA gives a %s percent chance of minor radio blackouts from '
                        'solar flares today, and %s percent for major ones.' % (r1, r3))
        if s1:
            said.append('The chance of a solar radiation storm is %s percent.' % s1)
        ahead = []
        for k in ('2', '3'):
            day = (scales or {}).get(k) or {}
            g = (day.get('G') or {})
            if str(g.get('Scale') or '0') not in ('0', 'None'):
                try:
                    dname = datetime.datetime.strptime(day['DateStamp'], '%Y-%m-%d').strftime('%A')
                except (KeyError, ValueError):
                    dname = 'the coming days'
                ahead.append('a G%s %s geomagnetic storm is forecast for %s'
                             % (g['Scale'], g.get('Text') or '', dname))
        if ahead:
            said.append(ahead[0][0].upper() + ahead[0][1:] + '.')
        elif scales:
            said.append('No geomagnetic storms are forecast for the next two days.')
        return title, ' '.join(said)

    def handle_spaceweather(self):
        now = time.time()
        cache = self._swpc_cache
        if now - cache['at'] > 900:
            items = []
            try:
                req = urllib.request.Request(self.SWPC_URL, headers={'User-Agent': 'GNN/1.0'})
                with urllib.request.urlopen(req, timeout=10) as r:
                    alerts = json.loads(r.read(2 * 1024 * 1024).decode('utf-8', 'replace'))
                seen = set()
                cutoff = now - 48 * 3600
                for a in alerts:
                    try:
                        t = datetime.datetime.strptime(a['issue_datetime'][:19], '%Y-%m-%d %H:%M:%S') \
                            .replace(tzinfo=datetime.timezone.utc).timestamp()
                    except (KeyError, ValueError):
                        continue
                    if t < cutoff:
                        continue
                    story = self._swpc_story(a.get('message', ''))
                    if not story or story[0] in seen:
                        continue
                    seen.add(story[0])
                    items.append({'title': story[0], 'description': story[1],
                                  # Its own identity: the feed-manager would
                                  # otherwise match every NOAA item to the
                                  # first by their shared link.
                                  'key': 'swpc %s %s' % (a.get('product_id', ''),
                                                         a.get('issue_datetime', '')[:16]),
                                  'pubDate': datetime.datetime.fromtimestamp(t, datetime.timezone.utc)
                                  .strftime('%a, %d %b %Y %H:%M:%S GMT'),
                                  'source': 'NOAA Space Weather', 'category': 'weather',
                                  'link': 'https://www.swpc.noaa.gov/'})
                # The current reading leads; a failure here leaves the alerts.
                try:
                    cond = self._swpc_conditions(self._swpc_json(self.SWPC_SCALES),
                                                 self._swpc_json(self.SWPC_WIND),
                                                 self._swpc_json(self.SWPC_KP), now)
                except Exception as err:                        # noqa: BLE001
                    cond = None
                    sys.stderr.write('[GNN SpaceWeather] conditions failed: %s\n' % err)
                if cond:
                    items.insert(0, {'title': cond[0], 'description': cond[1],
                                     'key': datetime.datetime.fromtimestamp(now, datetime.timezone.utc)
                                     .strftime('swpc report %Y-%m-%d ') + str(int(now // 21600) % 4),
                                     'pubDate': datetime.datetime.fromtimestamp(now, datetime.timezone.utc)
                                     .strftime('%a, %d %b %Y %H:%M:%S GMT'),
                                     'source': 'NOAA Space Weather', 'category': 'weather',
                                     'link': 'https://www.swpc.noaa.gov/'})
                cache['items'] = items[:8]
                cache['at'] = now
            except Exception as err:                            # noqa: BLE001
                sys.stderr.write('[GNN SpaceWeather] fetch failed: %s\n' % err)
                cache['at'] = now - 600   # retry in five minutes
        self.send_bytes(json.dumps({'source': 'NOAA Space Weather', 'items': cache['items']}).encode(),
                        'application/json')

    def handle_localnews(self):
        """Serve the deduplicated union of every brief on disk."""
        paths = self._all_brief_paths()
        if not paths:
            return self.send_bytes(
                json.dumps({'source': None, 'items': []}).encode(),
                'application/json')

        seen = set()
        items = []
        for path in paths:
            for item in self._parse_brief(path):
                key = _title_hash(item['title'])
                if not key or key in seen:
                    continue
                seen.add(key)
                items.append(item)

        stamp = datetime.datetime.now().strftime('%H:%M:%S')
        sys.stderr.write('[%s] [GNN Ledger] local briefs: %d files, %d unique\n'
                         % (stamp, len(paths), len(items)))
        sys.stderr.flush()
        body = json.dumps({
            'source': '%d briefs' % len(paths),
            'items': items,
        }).encode()
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

    # -- persistent news ledger ---------------------------------

    def _read_json_body(self, max_bytes=1024 * 1024):
        """Read a JSON body from the request, or None on any failure.

        The body is *always* consumed, even when it exceeds `max_bytes`
        and will be rejected. Leaving bytes in the socket is how a
        keep-alive connection goes wrong: Python's http.server reads
        the next request line from the leftover body, sees a huge
        opaque run of bytes, and answers 414 Request-URI Too Long.
        That was filling the log every time the ledger crossed the
        old 1 MB ceiling.
        """
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            return None
        if length <= 0:
            return None

        payload = self.rfile.read(min(length, max_bytes))
        remaining = length - len(payload)
        while remaining > 0:
            chunk = self.rfile.read(min(remaining, 65536))
            if not chunk:
                break
            remaining -= len(chunk)

        if length > max_bytes:
            return None
        try:
            return json.loads(payload.decode('utf-8', 'replace'))
        except (OSError, UnicodeError, json.JSONDecodeError):
            return None

    # -- show config editor -------------------------------------
    # The runtime reads this config at boot. tools/show-editor.html edits it
    # through /api/config. Writes use a temporary file and atomic replace so
    # an interrupted save cannot leave a truncated configuration.

    def handle_config_get(self):
        try:
            with open(SHOW_CONFIG, encoding='utf-8') as fh:
                payload = fh.read()
            body = json.dumps(json.loads(payload)).encode('utf-8')
        except FileNotFoundError:
            stamp = datetime.datetime.now().strftime('%H:%M:%S')
            sys.stderr.write('[%s] [GNN Config] no show-config.json at %s\n'
                             % (stamp, SHOW_CONFIG))
            sys.stderr.flush()
            body = b'{}'
        except (OSError, json.JSONDecodeError) as err:
            sys.stderr.write('[GNN] show-config read failed: %s\n' % err)
            body = b'{}'
        return self.send_bytes(body, 'application/json')

    def handle_config_put(self):
        body = self._read_json_body(max_bytes=4 * 1024 * 1024)
        if not isinstance(body, dict):
            return self.send_bytes(b'{"error":"bad body"}',
                                   'application/json', 400)

        shows = body.get('shows')
        if not isinstance(shows, list):
            return self.send_bytes(
                b'{"error":"shows must be an array"}',
                'application/json', 400)
        for i, show in enumerate(shows):
            if not isinstance(show, dict):
                return self.send_bytes(
                    json.dumps({'error': 'show %d is not an object' % i}).encode(),
                    'application/json', 400)
            if not show.get('id') or not isinstance(show.get('pair'), list):
                return self.send_bytes(
                    json.dumps({'error': 'show %d missing id or pair' % i}).encode(),
                    'application/json', 400)

        tmp = SHOW_CONFIG + '.tmp'
        try:
            os.makedirs(os.path.dirname(SHOW_CONFIG), exist_ok=True)
            with open(tmp, 'w', encoding='utf-8') as fh:
                json.dump(body, fh, indent=2, ensure_ascii=False)
                fh.flush()
                os.fsync(fh.fileno())
            os.replace(tmp, SHOW_CONFIG)
        except OSError as err:
            sys.stderr.write('[GNN] show-config write failed: %s\n' % err)
            try:
                if os.path.exists(tmp):
                    os.remove(tmp)
            except OSError:
                pass
            return self.send_bytes(
                json.dumps({'error': 'write failed: %s' % err}).encode(),
                'application/json', 500)

        stamp = datetime.datetime.now().strftime('%H:%M:%S')
        sys.stderr.write('[%s] [GNN Config] saved %d shows\n'
                         % (stamp, len(shows)))
        sys.stderr.flush()
        return self.send_bytes(
            json.dumps({'ok': True, 'shows': len(shows)}).encode(),
            'application/json')

    def handle_editor_options(self):
        """Return editor dropdown options discovered from the assets on disk."""
        gen = os.path.join(DIRECTORY, 'assets', 'generated')

        def ls(sub, ext='.png'):
            directory = os.path.join(gen, sub)
            if not os.path.isdir(directory):
                return []
            return sorted(f for f in os.listdir(directory) if f.endswith(ext))

        anchor_files = ls('anchors')
        suffix = '_desk_hero.png'
        anchors = sorted(set(
            name[:-len(suffix)] for name in anchor_files
            if name.endswith(suffix)))

        music_dir = os.path.join(DIRECTORY, 'assets', 'audio', 'music')
        music = []
        if os.path.isdir(music_dir):
            music = sorted(name for name in os.listdir(music_dir)
                           if name.endswith('.ogg'))

        payload = {
            'sets': ls('set'),
            'backdrops': ls('backdrops'),
            'titlecards': ls('titlecards'),
            'anchors': anchors,
            'music': music,
            'voices': [{'id': voice, 'label': label}
                       for voice, label in LOCAL_VOICES],
        }
        return self.send_bytes(json.dumps(payload).encode('utf-8'),
                               'application/json')

    def handle_newsledger_get(self):
        """Return the full ledger as a JSON object.

        Shape is `{ version, updatedAt, items }` where `items` is the
        dict form keyed by story hash. The client accepts either the dict
        form or a list form; the dict is what the server stores.
        """
        ledger = _load_ledger()
        payload = {
            'version': ledger.get('version', 1),
            'updatedAt': ledger.get('updatedAt'),
            'items': ledger.get('items', {}),
        }
        return self.send_bytes(json.dumps(payload).encode('utf-8'),
                               'application/json')

    def handle_newsledger_put(self):
        """Merge the incoming records into the ledger, then persist.

        Merging is the whole point of the endpoint: two browsers can have
        divergent views of the same story, and only the server's merge rule
        ('aired' wins, aliases and sources union) keeps them from oscillating
        between queued and aired on every PUT.

        The size ceiling is 16 MB, not the 1 MB default the other routes
        use. Records expire after LEDGER_RETENTION_DAYS, but a station on air
        for weeks still legitimately exceeds 1 MB on the write side. The old default
        silently rejected the PUT at the socket layer, the browser saw a
        400 it could not explain, and the file was never written.
        """
        body = self._read_json_body(max_bytes=16 * 1024 * 1024)
        if not body or not isinstance(body, dict):
            return self.send_bytes(b'{"error":"bad body"}',
                                   'application/json', 400)
        incoming_items = body.get('items') or {}
        if isinstance(incoming_items, list):
            # Tolerate the list form the client might send.
            converted = {}
            for record in incoming_items:
                if not isinstance(record, dict):
                    continue
                key = str(record.get('key') or record.get('ledgerKey')
                          or _title_hash(record.get('title')))
                if key:
                    converted[key] = record
            incoming_items = converted
        if not isinstance(incoming_items, dict):
            return self.send_bytes(b'{"error":"items must be object or list"}',
                                   'application/json', 400)

        merged_count = 0
        ledger = _load_ledger()
        with _ledger_lock:
            items = ledger.setdefault('items', {})
            for key, record in incoming_items.items():
                if not isinstance(record, dict) or not record.get('title'):
                    continue
                items[key] = _merge_ledger_record(items.get(key), record)
                merged_count += 1
            ledger['version'] = 1
            ledger['updatedAt'] = datetime.datetime.now(
                datetime.timezone.utc).isoformat()
            expired = _expire_ledger(items)
            if expired:
                sys.stderr.write('[GNN Ledger] expired %d records older than %d days\n'
                                 % (expired, LEDGER_RETENTION_DAYS))
            _save_ledger()

        stamp = datetime.datetime.now().strftime('%H:%M:%S')
        sys.stderr.write('[%s] [GNN Ledger] merged %d records, total %d\n'
                         % (stamp, merged_count, len(ledger.get('items', {}))))
        sys.stderr.flush()
        return self.send_bytes(
            json.dumps({'ok': True, 'count': len(ledger.get('items', {}))}
                       ).encode('utf-8'),
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
        if not use_local:
            # misaki's inline phoneme markup `[word](/phonemes/)` is for
            # Kokoro only; a cloud voice would read the brackets aloud.
            text = re.sub(r'\[([^\]]*)\]\(/[^)]*/\)', r'\1', text)
        rate = clean_prosody(q.get('rate', [''])[0], '-5%', '%')
        pitch = clean_prosody(q.get('pitch', [''])[0], '-10Hz', 'Hz')
        try:
            seq = int(q.get('seq', ['0'])[0])
        except ValueError:
            seq = 0
        t0 = time.time()
        sid = clean_session(q.get('sid', [''])[0])
        note_sequence(sid, seq)
        stamp = datetime.datetime.now().strftime('%H:%M:%S')
        preview = (text[:50] + '...') if len(text) > 50 else text
        sys.stderr.write('[%s] [GNN Server:TTS] request voice=%s local=%s seq=%d: "%s"\n' %
                         (stamp, voice, use_local, seq, preview))
        sys.stderr.flush()

        # edge-tts opens its own websocket per call; serialise so a rapid skip
        # storm cannot open dozens at once. Wait in slices so a request the
        # client has already moved past can give up instead of blocking.
        if not tts_enter(sid, seq):
            return self.send_bytes(b'{"error":"superseded"}',
                                   'application/json', 409)
        try:
            if superseded(sid, seq):
                return self.send_bytes(b'{"error":"superseded"}',
                                       'application/json', 409)
            audio = (synthesize_local(text, voice, rate) if use_local
                     else synthesize(text, voice, rate, pitch))
        except Exception as err:                      # noqa: BLE001 - report to client
            stamp = datetime.datetime.now().strftime('%H:%M:%S')
            sys.stderr.write('[%s] [GNN Server:TTS] failed voice=%s: %s\n' % (stamp, voice, err))
            sys.stderr.flush()
            return self.send_bytes(
                json.dumps({'error': str(err)}).encode(), 'application/json', 502)
        finally:
            tts_exit()

        if not audio:
            return self.send_bytes(b'{"error":"empty synthesis"}', 'application/json', 502)
        payload, ctype = normalize(audio)
        dur_ms = int((time.time() - t0) * 1000)
        stamp = datetime.datetime.now().strftime('%H:%M:%S')
        sys.stderr.write('[%s] [GNN Server:TTS] synthesized voice=%s bytes=%d in %dms\n' %
                         (stamp, voice, len(payload), dur_ms))
        sys.stderr.flush()
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

        stamp = datetime.datetime.now().strftime('%H:%M:%S')
        print('[%s] [GNN Server] http://localhost:%d  (pid %d)' % (stamp, PORT, os.getpid()))
        print('[%s] [GNN Server] server log: %s (max %dMB, %d backups)' % (stamp, LOG, MAX_LOG_SIZE_MB, MAX_BACKUPS))
        print('[%s] [GNN Server] transcript log: %s' % (stamp, TRANSCRIPT_LOG))
        print('[%s] [GNN Server] news ledger: %s' % (stamp, LEDGER))
        if HAVE_LOCAL:
            engine = 'kokoro (local, nothing leaves this machine)'
        elif HAVE_TTS:
            engine = 'edge-tts (calls Microsoft)'
        else:
            engine = 'UNAVAILABLE - start with ./start.sh so the venv is used'
        print('[%s] [GNN Server] voice engine: %s' % (stamp, engine))
        print('[%s] [GNN Server] market: %s'
              % (stamp, 'yahoo (curl_cffi) + coingecko' if HAVE_CURL_CFFI
                 else 'coingecko only — pip install curl_cffi for equities'))
        print('[%s] [GNN Server] stop with Ctrl-C, or ./stop.sh' % stamp)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            httpd.server_close()
            clear_pidfile()
            stamp = datetime.datetime.now().strftime('%H:%M:%S')
            print('\n[%s] [GNN Server] off air.' % stamp)


if __name__ == '__main__':
    run_server()