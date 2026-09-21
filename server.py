#!/usr/bin/env python3
"""
GNN Newsroom — static host + zero-cloud neural voice endpoint
=============================================================

    python3 server.py            # http://localhost:8080

Routes
    /                 static files from the project directory
    /api/tts          edge-tts synthesis  ->  audio/mpeg
    /api/status       what the station has available

The TTS route streams Microsoft neural voices through the local
`edge-tts` package. No account, no key, nothing leaves the machine
except the synthesis request itself. If `edge-tts` is missing the
route answers 503 and the browser client silently falls back to the
Web Speech API, so the broadcast never goes mute.
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
import urllib.parse

PORT = int(os.environ.get('GNN_PORT', 8080))
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
PIDFILE = os.path.join(DIRECTORY, '.gnn-server.pid')

ALLOWED_VOICE = set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-')
MAX_TEXT = 1200

try:
    import edge_tts
    HAVE_TTS = True
except ImportError:
    edge_tts = None
    HAVE_TTS = False

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
TARGET_LUFS = float(os.environ.get('GNN_TTS_LUFS', -19.0))
TARGET_PEAK_DB = float(os.environ.get('GNN_TTS_PEAK', -3.0))


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


def clean_voice(v):
    v = (v or DEFAULT_VOICE).strip()
    if not v or any(c not in ALLOWED_VOICE for c in v):
        return DEFAULT_VOICE
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


def normalize(mp3):
    """
    Level-match a clip and hand it back as lossless PCM.

    A single linear gain, not a compressor: the voice keeps its own dynamics
    and simply arrives where the mixer expects it. Decoding once and serving
    WAV also avoids a second lossy generation, and on localhost the extra
    bytes cost nothing.

    Returns (payload, content_type), falling back to the original MP3 if
    ffmpeg cannot be used.
    """
    if not shutil.which('ffmpeg'):
        return mp3, 'audio/mpeg'
    try:
        lufs, peak = measure_loudness(mp3)
        gain = 0.0
        if lufs is not None and lufs > -70:
            gain = TARGET_LUFS - lufs
        if peak is not None:
            gain = min(gain, TARGET_PEAK_DB - peak)
        gain = max(-24.0, min(24.0, gain))
        r = _ffmpeg(['-i', 'pipe:0', '-af', 'volume=%.2fdB' % gain,
                     '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le',
                     '-f', 'wav', 'pipe:1'], mp3)
        if r.returncode == 0 and r.stdout:
            return r.stdout, 'audio/wav'
    except Exception as err:                              # noqa: BLE001
        sys.stderr.write('[GNN] normalise failed, serving raw: %s\n' % err)
    return mp3, 'audio/mpeg'


class GNNRequestHandler(http.server.SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

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
        return super().do_GET()

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

    def handle_status(self):
        assets = os.path.join(DIRECTORY, 'assets')
        info = {
            'tts': HAVE_TTS,
            'manifests': {
                name: os.path.exists(os.path.join(assets, name))
                for name in ('gfx-manifest.json', 'audio-manifest.json', 'moo-strings.json')
            },
            'format': EDGE_FORMAT,
            'normalise': bool(shutil.which('ffmpeg')),
            'music': len([f for f in os.listdir(os.path.join(assets, 'audio', 'music'))
                          if f.endswith('.ogg')]) if os.path.isdir(
                              os.path.join(assets, 'audio', 'music')) else 0,
        }
        self.send_bytes(json.dumps(info).encode(), 'application/json')

    def handle_tts(self, q):
        text = (q.get('text', [''])[0] or '').strip()[:MAX_TEXT]
        if not text:
            return self.send_bytes(b'{"error":"no text"}', 'application/json', 400)
        if not HAVE_TTS:
            return self.send_bytes(
                b'{"error":"edge-tts not installed; run: pip install edge-tts"}',
                'application/json', 503)

        voice = clean_voice(q.get('voice', [''])[0])
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
            audio = synthesize(text, voice, rate, pitch)
        except Exception as err:                      # noqa: BLE001 - report to client
            sys.stderr.write('[GNN] tts failed: %s\n' % err)
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
        print('[GNN Server] neural voice: %s'
              % ('edge-tts ready' if HAVE_TTS else 'UNAVAILABLE (pip install edge-tts)'))
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
