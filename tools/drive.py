#!/usr/bin/env python3
"""
drive.py — run the newsroom in a real headless Chromium over CDP.

Watches the broadcast for a while, samples the director's telemetry,
captures screenshots at the interesting moments and reports any console
errors. This is the harness used to verify the pacing state machine, the
commercial sequencer and the glitch stage without a human at the desk.

    python3 tools/drive.py [seconds] [outdir]
"""

import atexit
import base64
import json
import os
import shutil
import signal
import subprocess
import sys
import time
import urllib.request

import websocket  # websocket-client

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = os.environ.get('GNN_URL', 'http://localhost:8080/')
PORT = int(os.environ.get('GNN_CDP_PORT', 9333))

# Unique markers so shutdown only ever targets browsers this harness started,
# never the user's own Chromium. MATCH has no leading dashes: pgrep would read
# those as its own options. The tag rides in the user agent so it survives in
# argv even if the debugging port is changed.
TAG = 'GNNHarness'
MARKER = '--remote-debugging-port=%d' % PORT
MATCH = 'remote-debugging-port=%d' % PORT

# The harness is headless but Chromium still renders audio to the real output
# device, so an unmuted run broadcasts the newscast out of the user's speakers
# with no window to close. Mute unless someone explicitly wants to hear it.
MUTE = os.environ.get('GNN_HARNESS_AUDIO', '') not in ('1', 'true', 'yes')

_children = []


def launch():
    """Start a headless browser and make sure it dies with us."""
    flags = ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
             '--window-size=1200,900', '--autoplay-policy=no-user-gesture-required',
             '--user-agent=Mozilla/5.0 (X11; Linux x86_64) %s/1' % TAG,
             MARKER, '--remote-allow-origins=*']
    if MUTE:
        flags.insert(0, '--mute-audio')
    flags.append('about:blank')
    browser = (shutil.which('chromium') or shutil.which('chromium-browser')
               or shutil.which('google-chrome-stable') or shutil.which('google-chrome'))
    if browser:
        cmd = [browser] + flags
    elif shutil.which('flatpak'):
        cmd = ['flatpak', 'run', '--filesystem=/tmp', '--filesystem=%s' % ROOT,
               'org.chromium.Chromium'] + flags
    else:
        raise RuntimeError('no Chromium/Chrome found (native or flatpak)')

    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                            start_new_session=True)
    _children.append(proc)
    return proc


def shutdown(cdp=None):
    """Close the harness browser cleanly, then make sure nothing is left.

    Under flatpak the process we spawned is only a launcher — terminating it
    leaves the real browser (and its ~12 helper processes) running. So: ask the
    browser to close over CDP first, then reap by the debugging-port marker.
    """
    if cdp is not None:
        try:
            cdp.send('Browser.close')
        except Exception:
            pass
        try:
            cdp.ws.close()
        except Exception:
            pass

    for proc in _children:
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
        except Exception:
            try:
                proc.terminate()
            except Exception:
                pass
    for proc in _children:
        try:
            proc.wait(timeout=5)
        except Exception:
            try:
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
            except Exception:
                pass
    _children.clear()

    # Flatpak survivors. Match on our debugging port *and* on the process
    # really being a browser, so a shell that merely mentions the port is safe.
    for sig in (signal.SIGTERM, signal.SIGKILL):
        left = _harness_pids()
        if not left:
            break
        for pid in left:
            try:
                os.kill(pid, sig)
            except OSError:
                pass
        time.sleep(1.5)

    # Chromium takes a few seconds to reap its helper processes; don't return
    # until they are actually gone, or a caller can report a clean exit while
    # a dozen renderers are still resident.
    for _ in range(24):
        if not _harness_pids():
            break
        time.sleep(0.5)


def _harness_pids():
    pids = []
    seen = set()
    for pattern in (MATCH, TAG):
        found = subprocess.run(['pgrep', '-f', '--', pattern],
                               capture_output=True, text=True)
        for line in found.stdout.split():
            if line not in seen:
                seen.add(line)
                pids.append(line)
    out = []
    for line in pids:
        try:
            pid = int(line)
        except ValueError:
            continue
        if pid == os.getpid():
            continue
        comm = subprocess.run(['ps', '-o', 'comm=', '-p', str(pid)],
                              capture_output=True, text=True).stdout.strip()
        if comm.lower().startswith(('chrome', 'chromium')):
            out.append(pid)
    return out


atexit.register(shutdown)
for _sig in (signal.SIGINT, signal.SIGTERM):
    signal.signal(_sig, lambda *_a: sys.exit(130))


def ws_url(retries=60):
    for _ in range(retries):
        try:
            data = json.load(urllib.request.urlopen(
                'http://127.0.0.1:%d/json/list' % PORT, timeout=2))
            for t in data:
                if t.get('type') == 'page':
                    return t['webSocketDebuggerUrl']
        except Exception:
            time.sleep(0.5)
    raise RuntimeError('no CDP page target')


class CDP:
    def __init__(self, url):
        self.ws = websocket.create_connection(url, timeout=45)
        self.n = 0

    def send(self, method, **params):
        self.n += 1
        self.ws.send(json.dumps({'id': self.n, 'method': method, 'params': params}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get('id') == self.n:
                return msg.get('result', {})
            if msg.get('method') == 'Runtime.consoleAPICalled':
                CONSOLE.append(msg['params'])
            if msg.get('method') == 'Runtime.exceptionThrown':
                EXCEPTIONS.append(msg['params'])

    def eval(self, expr):
        r = self.send('Runtime.evaluate', expression=expr,
                      returnByValue=True, awaitPromise=True)
        if 'exceptionDetails' in r:
            return {'__error': r['exceptionDetails'].get('text')}
        return r.get('result', {}).get('value')

    def shot(self, path):
        r = self.send('Page.captureScreenshot', format='png')
        if 'data' in r:
            with open(path, 'wb') as fh:
                fh.write(base64.b64decode(r['data']))


CONSOLE = []
EXCEPTIONS = []

PROBE = """(() => {
  const r = GNNDirector.report();
  return {
    state: r.state, queued: r.queued, read: r.storiesRead,
    speaking: r.speaking, sinceBreak: r.sinceBreak, nextBreak: r.nextBreakAt,
    prompt: Math.round(GNNTextEngine.progress()*100),
    promptLen: GNNTextEngine.getText().length,
    kind: GNNTextEngine.getKind(),
    cutaway: GNNCutsceneManager.isCutawayActive(),
    breaking: GNNCutsceneManager.isBreakActive(),
    fx: GNNGlitch.activeName(),
    title: r.current
  };
})()"""


def main():
    seconds = float(sys.argv[1]) if len(sys.argv) > 1 else 90
    outdir = sys.argv[2] if len(sys.argv) > 2 else '.shot'
    os.makedirs(outdir, exist_ok=True)

    cdp = None
    launch()
    try:
        cdp = CDP(ws_url())
        cdp.send('Page.enable')
        cdp.send('Runtime.enable')
        cdp.send('Log.enable')
        cdp.send('Page.navigate', url=URL)
        time.sleep(6)
        # Synthesise the first gesture so audio + speech unlock.
        cdp.send('Input.dispatchMouseEvent', type='mousePressed', x=600, y=880,
                 button='left', clickCount=1)
        cdp.send('Input.dispatchMouseEvent', type='mouseReleased', x=600, y=880,
                 button='left', clickCount=1)

        seen_states = {}
        shots = {}
        t0 = time.time()
        last = None
        while time.time() - t0 < seconds:
            p = cdp.eval(PROBE)
            if isinstance(p, dict) and '__error' not in p:
                key = p['state']
                seen_states[key] = seen_states.get(key, 0) + 1
                tag = None
                if p['breaking']:
                    tag = 'break'
                elif p['cutaway']:
                    tag = 'cutaway'
                elif p['fx']:
                    tag = 'fx_' + p['fx']
                elif key in ('READ', 'BANTER', 'WIRE', 'HOLD', 'IDENT', 'COLD_OPEN'):
                    tag = key.lower()
                if tag and tag not in shots:
                    shots[tag] = True
                    cdp.shot(os.path.join(outdir, '%s.png' % tag))
                if p != last:
                    print('%5.1fs %-10s q=%-3s read=%-2s spk=%-5s prompt=%3s%%/%-4s %s%s%s'
                          % (time.time() - t0, p['state'], p['queued'], p['read'],
                             p['speaking'], p['prompt'], p['promptLen'],
                             'CUT ' if p['cutaway'] else '',
                             'BREAK ' if p['breaking'] else '',
                             ('FX:' + p['fx']) if p['fx'] else ''))
                    last = p
            else:
                print('probe error:', p)
            time.sleep(1.0)

        print('\nstates seen:', seen_states)
        print('screenshots:', sorted(shots))
        errs = [c for c in CONSOLE if c.get('type') in ('error', 'warning')]
        for e in errs[:20]:
            print('CONSOLE', e['type'],
                  ' '.join(str(a.get('value', a.get('description', '')))
                           for a in e.get('args', [])))
        for e in EXCEPTIONS[:10]:
            print('EXCEPTION', json.dumps(e)[:400])
        print('console errors: %d, exceptions: %d' % (len(errs), len(EXCEPTIONS)))
    finally:
        shutdown(cdp if 'cdp' in dir() else None)


if __name__ == '__main__':
    main()
