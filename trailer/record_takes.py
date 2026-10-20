#!/usr/bin/env python3
"""Record the trailer's footage from the running station.

Each take loads the page fresh at 1920x1080 and 30 fps on the show it needs,
sets up its moment the way tools/capture_gallery.py does, and records the
canvas and the master audio bus for a few seconds (trailer/recorder.py).

    ./start.sh --bg
    python3 trailer/record_takes.py              # every take
    python3 trailer/record_takes.py desk_weather breaking
"""
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, 'tools'))
sys.path.insert(0, HERE)
import drive                                               # noqa: E402
import recorder                                            # noqa: E402

TAKES = os.path.join(HERE, 'build', 'takes')
W, H = 1920, 1080


class Take:
    def __init__(self, cdp):
        self.cdp = cdp

    def open(self, query):
        self.cdp.send('Emulation.setDeviceMetricsOverride', width=W, height=H,
                      deviceScaleFactor=1, mobile=False)
        # prompter=instant: captions appear whole, not mid-typing, in every
        # frame of the trailer (owner: half-typed lines looked like mistakes).
        self.cdp.send('Page.navigate', url=drive.URL + '?fps=30&prompter=instant&' + query)
        self.wait('!!window.GNNBootReady', 90)
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
            time.sleep(0.2)
        print('    (timed out: %s)' % expr[:70], flush=True)
        return False

    def reading(self, progress=0.05, limit=150):
        # Captions appear whole (prompter=instant), so wait for the voice
        # rather than the typing: a read that has just started speaking.
        return self.wait("GNNDirector.getState()==='READ' && GNNTTS.isSpeaking()"
                         " && !GNNCutsceneManager.isCutawayActive()"
                         " && !GNNGlitch.isBreaking(performance.now())", limit)

    def record(self, name, seconds):
        mime = recorder.start(self.cdp)
        time.sleep(seconds)
        size = recorder.stop(self.cdp, os.path.join(TAKES, name + '.webm'))
        print('  -> %-22s %4.1fs %6.1f MB  %s' % (name, seconds, size / 1e6, mime), flush=True)


def place_story(t, story):
    """Put a chosen headline on air now, and wait until its caption shows.

    A new caption appears when its voice starts, so a take that began when
    the director switched story opened on the previous story's caption for
    a second. This waits for the chosen line to be speaking.
    """
    t.reading(limit=100)
    item = {'title': story[0], 'description': story[1], 'source': 'GNN Wire',
            'link': '', 'importance': 9999, 'timestamp': int(time.time() * 1000)}
    t.eval('GNNDirector.enqueueAll(%s); GNNDirector.skip()' % json.dumps([item]))
    t.wait('(GNNDirector.getCurrent()||{}).title===%s && GNNTTS.isSpeaking() && !GNNTTS.waitingForAudio()'
           % json.dumps(story[0]), 40)
    time.sleep(0.4)


def desk(block, name, seconds=7.0, story=None):
    """A desk mid-read. With `story`, that headline is read: queued at top
    priority and skipped to, so a trailer shot with the anchor's voice up
    carries a line chosen for it rather than whatever the wire had."""
    def run(t):
        t.open('block=%s&clock=off' % block)
        if story:
            place_story(t, story)
        else:
            t.reading()
        t.record(name, seconds)
    return run


def cutaway_full(route_title, name):
    def run(t):
        t.open('block=anomaly&clock=off&cutaways=footage')
        t.reading(limit=120)
        t.eval('GNNDirector.pause()')
        t.eval('GNNCutsceneManager.endCutaway()')
        st = json.dumps({'title': route_title, 'description': ''})
        t.eval('GNNCutsceneManager.prefetch(%s).then(()=>GNNCutsceneManager.triggerCutaway(%s,performance.now()))'
               % (st, st))
        t.wait('GNNCutsceneManager.isFullCutaway()', 25)
        t.record(name, 5.5)
    return run


def commercial(kind, name, seconds=11.0, query='commercials=plate', from_shot=1):
    def run(t):
        t.open('block=evening_rim&clock=off&' + query)
        t.eval("GNNCutsceneManager.startCommercialBreak(performance.now(),{kind:'%s'})" % kind)
        t.wait('GNNCutsceneManager.shotIndex()>=%d' % from_shot, 60)
        t.record(name, seconds)
    return run


def fault(fault_name, name, seconds=4.0, block='night_desk'):
    def run(t):
        t.open('block=%s&clock=off' % block)
        t.reading(limit=100)
        t.eval("GNNGlitch.fire('%s', performance.now())" % fault_name)
        time.sleep(0.15)
        t.record(name, seconds)
    return run


def correspondent(t):
    t.open('block=diplomacy&clock=off')
    place_story(t, ('Delegates gather in Geneva for talks on sharing river water across borders',
                    'Negotiators hope to agree new rules for rivers that cross national borders.'))
    t.eval('GNNDirector.pause()')
    t.eval("GNNCutsceneManager.openTwoWay('bulrathi','council',performance.now(),'SORREK · ORION COUNCIL')")
    time.sleep(0.6)
    t.record('correspondent', 4.5)


def debate(t):
    t.open('block=crossfire&clock=off')
    place_story(t, ('Scientists debate whether to build a new giant particle collider',
                    'Supporters say it would answer deep questions about matter; critics point to the cost.'))
    t.eval('GNNDirector.pause()')
    t.eval("GNNCutsceneManager.openDebate('psilon','bulrathi','interview',performance.now(),"
           "'OTH · PSILON ACADEMY','GROLM · BULRATHI COMMAND')")
    time.sleep(0.6)
    t.record('debate', 4.5)


def breaking(t):
    t.open('block=evening_rim&clock=off')
    t.reading(limit=100)
    t.eval("GNNDirector.injectBreaking('Major earthquake strikes coastal region',"
           "'Emergency services are responding to reports of damage.')")
    t.wait('GNNGlitch.isBreaking(performance.now())', 30)
    t.record('breaking', 8.0)


def groundwar(t):
    t.open('block=evening_rim&clock=off')
    t.eval("GNNCutsceneManager.startCommercialBreak(performance.now(),{kind:'marines'})")
    t.wait('GNNCutsceneManager.shotIndex()>=2', 60)
    t.record('groundwar', 6.0)


def signoff(t):
    # A real show close: the lead anchor says the closing line, lips and all.
    t.open('block=morning_watch&clock=off')
    t.reading(limit=100)
    # Pausing cancels whatever is mid-read; the close line then plays alone.
    t.eval('GNNDirector.pause(); GNNTextEngine.resume(); GNNDirector.forceShowClose()')
    # The close line's caption appears with its audio; wait for that, or
    # the take opens on the previous story's caption.
    t.wait('GNNTTS.isSpeaking() && !GNNTTS.waitingForAudio()', 20)
    time.sleep(0.3)
    t.record('signoff_desk', 7.5)


TAKES_LIST = {
    'desk_morning': desk('morning_watch', 'desk_morning', story=(
        'Leaders reach agreement at climate summit to triple renewable energy',
        'Delegates from over a hundred nations backed the target on the final day.')),
    'desk_weather': desk('sector_weather', 'desk_weather', story=(
        'Forecasters expect a strong solar storm to bring bright auroras tonight',
        'Space weather forecasters say geomagnetic activity will peak after dark.')),
    'desk_archive': desk('archives', 'desk_archive'),
    'desk_crossfire': desk('crossfire', 'desk_crossfire', story=(
        'Lawmakers clash over the space budget as the agency plans a return to the Moon',
        'The argument is over how much to spend on crewed missions in the next decade.')),
    'desk_sports': desk('rim_sports', 'desk_sports', story=(
        'Underdogs stun the champions with a last-minute winner in the cup final',
        'The winning goal came deep into stoppage time in front of a sell-out crowd.')),
    'desk_spotlight': desk('galactic_spotlight', 'desk_spotlight', story=(
        'Record crowds turn out for the opening night of the summer film festival',
        'Organisers say ticket sales are the highest in the festival history.')),
    'desk_anomaly': desk('anomaly', 'desk_anomaly', story=(
        'Astronomers puzzle over a mysterious repeating radio signal from deep space',
        'The burst repeats every few hours and its source has still not been identified.')),
    'desk_diplomacy': desk('diplomacy', 'desk_diplomacy', 9.0, story=(
        'Nations sign landmark treaty to protect the high seas',
        'The agreement creates marine sanctuaries across international waters for the first time.')),
    'desk_machine': desk('machine_intel', 'desk_machine', story=(
        'Researchers unveil a robot that learns new chores by watching people',
        'The machine picked up simple household tasks after a single demonstration.')),
    'correspondent': correspondent,
    'debate': debate,
    'breaking': breaking,
    'footage_battle': cutaway_full('Military strike as war escalates, troops mobilise', 'footage_battle'),
    'footage_anomaly': cutaway_full('Unexplained anomaly signal detected beyond the rim', 'footage_anomaly'),
    'footage_convoy': cutaway_full('Fleet convoy arrives after long transit, cargo shipping resumes', 'footage_convoy'),
    'ad_shop': commercial('qvc', 'ad_shop', 12.0),
    'ad_research': commercial('research', 'ad_research', 11.0, query='x=1'),
    'ad_salvage': commercial('salvage', 'ad_salvage', 9.0, query='x=1'),
    'ad_ships': commercial('ships', 'ad_ships', 12.0, query='x=1'),
    'ad_infomercial': commercial('infomercial', 'ad_infomercial', 14.0),
    'ad_sponsor': commercial('sponsor', 'ad_sponsor', 12.0),
    'groundwar': groundwar,
    'fx_snow': fault('signal_snow', 'fx_snow', 3.0),
    'fx_macroblock': fault('macroblock', 'fx_macroblock', 3.0),
    'fx_bars': fault('color_bars', 'fx_bars', 3.5),
    'fx_testcard': fault('test_card', 'fx_testcard', 3.5),
    'fx_antaran': fault('antaran_intrusion', 'fx_antaran', 7.0, block='anomaly'),
    'fx_rgb': fault('rgb_split', 'fx_rgb', 3.0),
    'fx_crosstalk': fault('crosstalk_shop', 'fx_crosstalk', 3.5),
    'signoff_desk': signoff,
}


def main():
    want = [a for a in sys.argv[1:]] or list(TAKES_LIST)
    os.makedirs(TAKES, exist_ok=True)
    cdp = None
    drive.launch()
    try:
        cdp = drive.CDP(drive.ws_url())
        cdp.send('Page.enable'); cdp.send('Runtime.enable')
        t = Take(cdp)
        for name in want:
            print(name + '...', flush=True)
            try:
                TAKES_LIST[name](t)
            except Exception as err:                        # noqa: BLE001
                print('    failed:', repr(err), flush=True)
    finally:
        drive.shutdown(cdp)
    return 0


if __name__ == '__main__':
    sys.exit(main())
