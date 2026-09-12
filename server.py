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
import signal
import socketserver
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

_tts_lock = threading.Lock()

# Highest request sequence the client has asked for. The browser abandons a
# superseded <audio> request by closing the socket, but the server has already
# taken the synthesis lock by then and will hold it for a full round trip —
# delaying the line that is actually wanted. Comparing sequence numbers lets a
# stale request drop out instead of queueing ahead of a live one.
_seq_lock = threading.Lock()
_latest_seq = [0]


def note_sequence(seq):
    with _seq_lock:
        if seq > _latest_seq[0]:
            _latest_seq[0] = seq


def superseded(seq):
    if not seq:
        return False
    with _seq_lock:
        return seq < _latest_seq[0]


def clean_voice(v):
    v = (v or 'en-US-GuyNeural').strip()
    if not v or any(c not in ALLOWED_VOICE for c in v):
        return 'en-US-GuyNeural'
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
        note_sequence(seq)

        # edge-tts opens its own websocket per call; serialise so a rapid skip
        # storm cannot open dozens at once. Wait in slices so a request the
        # client has already moved past can give up instead of blocking.
        while not _tts_lock.acquire(timeout=0.2):
            if superseded(seq):
                return self.send_bytes(b'{"error":"superseded"}',
                                       'application/json', 409)
        try:
            if superseded(seq):
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
        self.send_bytes(audio, 'audio/mpeg')


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
