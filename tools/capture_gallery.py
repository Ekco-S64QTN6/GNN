#!/usr/bin/env python3
"""capture_gallery.py — the README screenshots, from the running station.

Each shot loads the page fresh at 1280x720 on the show it belongs to, sets
up the moment it wants (a story on the wire, a cutaway, a commercial beat,
a fault) and photographs it. Nothing waits on the live feeds, so a feed
outage cannot hang it — the reason capture_docs.py was retired.

    ./start.sh --bg
    python3 tools/capture_gallery.py                 # every shot
    python3 tools/capture_gallery.py hero footage    # just these
    python3 tools/capture_gallery.py --list

Writes docs/gallery/<name>.png, plus docs/gallery/shows.png — a montage of
show title cards composed from the files, no browser needed.
"""
import base64
import io
import json
import os
import sys
import time

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import drive                                               # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'docs', 'gallery')
W, H = 1280, 720


def story(title, desc='', source='GNN Wire'):
    return {'title': title, 'description': desc, 'source': source, 'link': '',
            'timestamp': int(time.time() * 1000)}


class Station:
    def __init__(self, cdp):
        self.cdp = cdp

    def open(self, query):
        # prompter=instant: captions shown whole, never mid-typing.
        self.cdp.send('Page.navigate', url=drive.URL + '?prompter=instant&' + query)
        self.wait('!!window.GNNBootReady', 90)
        self.cdp.send('Emulation.setDeviceMetricsOverride', width=W, height=H,
                      deviceScaleFactor=1, mobile=False)
        time.sleep(1.0)

    def eval(self, js):
        return self.cdp.eval(js)

    def wait(self, expr, limit=60):
        end = time.time() + limit
        while time.time() < end:
            try:
                if self.cdp.eval(expr):
                    return True
            except Exception:                              # noqa: BLE001
                pass
            time.sleep(0.25)
        print('    (timed out: %s)' % expr[:70], flush=True)
        return False

    def snap(self, name):
        d = self.cdp.send('Page.captureScreenshot', format='png')['data']
        im = Image.open(io.BytesIO(base64.b64decode(d))).convert('RGB')
        if im.size != (W, H):
            im = im.resize((W, H), Image.LANCZOS)
        im.save(os.path.join(OUT, name + '.png'))
        print('  ->', name, flush=True)

    def read(self, items, progress=None):
        """Put a chosen headline on air and wait until its caption shows.

        Forced to the front (importance 9999) and skipped to, so the shot
        carries a line chosen for it rather than whatever the live wire had
        — the wire once put an execution story in the README's hero shot.
        A new caption appears with its voice, so this waits for the audio.
        """
        self.wait("GNNDirector.getState()==='READ' && GNNTTS.isSpeaking()", 120)
        forced = [dict(x, importance=9999) for x in items]
        self.eval('GNNDirector.enqueueAll(%s); GNNDirector.skip()' % json.dumps(forced))
        ok = self.wait('(GNNDirector.getCurrent()||{}).title===%s && GNNTTS.isSpeaking()'
                       ' && !GNNTTS.waitingForAudio() && !GNNCutsceneManager.isCutawayActive()'
                       % json.dumps(items[0]['title']), 60)
        time.sleep(0.5)
        return ok

    def commercial(self, kind, shot_index, settle=1.6, look=None):
        self.eval("GNNCutsceneManager.startCommercialBreak(performance.now(),{kind:'%s'})" % kind)
        self.wait('GNNCutsceneManager.shotIndex()>=%d' % shot_index, 70)
        time.sleep(settle)


# ---------------------------------------------------------------------------

def hero(s):
    s.open('block=morning_watch&clock=off')
    s.read([story('Leaders reach agreement at climate summit to triple renewable energy',
                  'Delegates from over a hundred nations backed the target on the final day.')])
    s.snap('hero')


def weather(s):
    s.open('block=sector_weather&clock=off')
    s.read([story('Forecasters expect a strong solar storm to bring bright auroras tonight',
                  'Space weather forecasters say geomagnetic activity will peak after dark.')])
    s.snap('weather')


def lore(s):
    s.open('block=archives&clock=off')
    s.wait("GNNDirector.getState()==='READ' && GNNTTS.isSpeaking() && !GNNTTS.waitingForAudio()", 90)
    time.sleep(0.5)
    s.snap('lore')


def cutaway(s):
    s.open('block=evening_rim&clock=off&cutaways=plate')
    st = story('Space agency confirms new crew launch to the orbital station',
               'The rocket lifts off at dawn with four astronauts aboard.')
    s.read([st], progress=0.3)
    s.eval('GNNCutsceneManager.prefetch(%s).then(()=>GNNCutsceneManager.triggerCutaway(%s,performance.now()))'
           % (json.dumps(st), json.dumps(st)))
    s.wait('GNNCutsceneManager.isCutawayActive()', 20)
    time.sleep(1.2)
    s.snap('cutaway')


def footage(s):
    s.open('block=anomaly&clock=off&cutaways=footage')
    st = story('Unexplained signal detected by deep space telescope',
               'Astronomers say the anomaly repeats every eleven hours.')
    s.read([st], progress=0.25)
    # Paused, so the station's own cutaway cannot replace this one.
    s.eval('GNNDirector.pause()')
    s.eval('GNNCutsceneManager.endCutaway()')
    s.eval('GNNCutsceneManager.prefetch(%s).then(()=>GNNCutsceneManager.triggerCutaway(%s,performance.now()))'
           % (json.dumps(st), json.dumps(st)))
    s.wait('GNNCutsceneManager.isFullCutaway()', 20)
    time.sleep(2.0)
    s.snap('footage')


def correspondent(s):
    s.open('block=diplomacy&clock=off')
    s.read([story('Delegates gather in Geneva for talks on sharing river water across borders',
                  'Negotiators hope to agree new rules for rivers that cross national borders.')])
    s.eval('GNNDirector.pause()')
    s.eval("GNNCutsceneManager.openTwoWay('bulrathi','council',performance.now(),'SORREK · ORION COUNCIL')")
    time.sleep(1.5)
    s.snap('correspondent')


def debate(s):
    s.open('block=crossfire&clock=off')
    s.read([story('Scientists debate whether to build a new giant particle collider',
                  'Supporters say it would answer deep questions about matter; critics point to the cost.')])
    s.eval('GNNDirector.pause()')
    s.eval("GNNCutsceneManager.openDebate('psilon','bulrathi','interview',performance.now(),"
           "'OTH · PSILON ACADEMY','GROLM · BULRATHI COMMAND')")
    time.sleep(1.5)
    s.snap('debate')


def shop(s):
    s.open('block=evening_rim&clock=off&commercials=plate')
    s.commercial('qvc', 2)
    s.snap('commercial_shop')


def infomercial(s):
    s.open('block=evening_rim&clock=off&commercials=plate')
    # Ask until one with a testimonial comes up: its claim beat shows the face.
    for _ in range(8):
        s.commercial('infomercial', 1, settle=0.3)
        if s.eval('!!(GNNCutsceneManager.breakScript && GNNCutsceneManager.breakScript() '
                  '&& GNNCutsceneManager.breakScript().testimonial)'):
            break
        s.eval('GNNCutsceneManager.abortBreak && GNNCutsceneManager.abortBreak()')
        time.sleep(0.5)
    s.wait('GNNCutsceneManager.shotIndex()>=3', 40)
    time.sleep(1.4)
    s.snap('commercial_infomercial')


def research(s):
    s.open('block=evening_rim&clock=off')
    s.commercial('research', 2, settle=1.8)
    s.snap('commercial_research')


def groundwar(s):
    s.open('block=evening_rim&clock=off')
    s.commercial('marines', 2, settle=4.2)
    s.snap('groundwar')


def breaking(s):
    s.open('block=evening_rim&clock=off')
    s.eval("GNNDirector.injectBreaking('Major earthquake strikes coastal region',"
           "'Emergency services are responding to reports of damage.')")
    s.wait('GNNGlitch.isBreaking(performance.now())', 30)
    s.wait("GNNTTS.isSpeaking() && !GNNTTS.waitingForAudio()", 20)
    time.sleep(0.6)
    s.snap('breaking')


def glitch(s):
    s.open('block=anomaly&clock=off')
    s.read([story('Researchers report unusual radio burst from nearby galaxy',
                  'The signal lasted less than a second and came from a galaxy next door.')])
    s.eval("GNNGlitch.fire('antaran_intrusion', performance.now())")
    time.sleep(1.6)
    s.snap('glitch')


def colour_bars(s):
    s.open('block=night_desk&clock=off')
    s.eval("GNNGlitch.fire('color_bars', performance.now())")
    time.sleep(1.0)
    s.snap('fault_bars')


SHOTS = {f.__name__: f for f in (hero, weather, lore, cutaway, footage, correspondent, debate,
                                 shop, infomercial, research, groundwar, breaking, glitch,
                                 colour_bars)}


def shows_montage():
    """Nine show title cards, three by three, with the station's name."""
    cards = ['main_desk', 'sector_weather', 'evening_rim', 'the_spotlight', 'anomaly',
             'rim_sports', 'market_desk', 'archives', 'council_hour']
    tw, th = 420, 236
    im = Image.new('RGB', (tw * 3 + 16, th * 3 + 16), (6, 10, 18))
    for i, c in enumerate(cards):
        p = os.path.join(ROOT, 'assets', 'generated', 'titlecards', c + '.png')
        if not os.path.exists(p):
            continue
        t = Image.open(p).convert('RGB').resize((tw, th), Image.LANCZOS)
        im.paste(t, (4 + (i % 3) * (tw + 4), 4 + (i // 3) * (th + 4)))
    im.save(os.path.join(OUT, 'shows.png'))
    print('  -> shows', flush=True)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('-')]
    if '--list' in sys.argv:
        print(' '.join(SHOTS))
        return 0
    os.makedirs(OUT, exist_ok=True)
    shows_montage()
    want = args or list(SHOTS)
    cdp = None
    drive.launch()
    try:
        cdp = drive.CDP(drive.ws_url())
        cdp.send('Page.enable'); cdp.send('Runtime.enable')
        s = Station(cdp)
        for name in want:
            print(name + '...', flush=True)
            try:
                SHOTS[name](s)
            except Exception as err:                        # noqa: BLE001
                print('    failed:', err, flush=True)
    finally:
        drive.shutdown(cdp)
    return 0


if __name__ == '__main__':
    sys.exit(main())
