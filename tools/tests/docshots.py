"""README screenshots from the running broadcast.

capture_docs.py waits for live wire states and hangs when the feeds 429.
These drive the director instead: enqueue, then force the state wanted.
"""
import base64, os, sys, time
sys.path.insert(0, '/home/ekco/github/GNN/tools')
import drive                                             # noqa: E402

DOCS = '/home/ekco/github/GNN/docs'
STORIES = [
    ("Council votes to restrict warp lane access over Antares",
     "Delegates approved the measure after six hours of debate."),
    ("Mining consortium reports record zortrium yield at Vega Four",
     "Output rose eleven percent on the quarter."),
    ("Fleet review finds three cruisers unfit for deep patrol",
     "The adjutant's report cites hull fatigue and deferred maintenance."),
    ("Quarantine lifted on the Rigel colony after eight weeks",
     "Medical teams confirmed no new cases in fourteen days."),
]


def shot(cdp, name):
    d = cdp.send('Page.captureScreenshot', format='png')['data']
    with open(os.path.join(DOCS, name), 'wb') as fh:
        fh.write(base64.b64decode(d))
    print('  ->', name, flush=True)


def wait(cdp, expr, limit=70):
    for _ in range(limit):
        try:
            if cdp.eval(expr):
                return True
        except Exception:                                 # noqa: BLE001
            pass
        time.sleep(0.5)
    print('  (timed out: %s)' % expr, flush=True)
    return False


def main():
    cdp = None
    drive.launch()
    try:
        cdp = drive.CDP(drive.ws_url())
        cdp.send('Page.enable'); cdp.send('Runtime.enable')
        cdp.send('Page.navigate', url=drive.URL)
        time.sleep(13)
        for ev in ('mousePressed', 'mouseReleased'):
            cdp.send('Input.dispatchMouseEvent', type=ev, x=600, y=880,
                     button='left', clickCount=1)
        time.sleep(4)
        payload = str([{'title': t, 'description': d, 'source': 'GNN Wire',
                        'link': ''} for t, d in STORIES]).replace("'", '"')
        cdp.eval('GNNDirector.enqueueAll(%s)' % payload)

        print('hero...', flush=True)
        wait(cdp, "GNNDirector.getState()==='READ' "
                  "&& GNNTextEngine.progress()>0.4 "
                  "&& !GNNCutsceneManager.isCutawayActive()")
        shot(cdp, 'hero.png')

        print('correspondent...', flush=True)
        cdp.eval("GNNCutsceneManager.openTwoWay('bulrathi','council',"
                 "performance.now(),'SORREK · ORION COUNCIL')")
        time.sleep(1.2)
        shot(cdp, 'correspondent.png')
        cdp.eval('GNNCutsceneManager.endCutaway()')

        print('cutaway...', flush=True)
        if wait(cdp, 'GNNCutsceneManager.isCutawayActive()'):
            time.sleep(1)
            shot(cdp, 'cutaway.png')

        print('banter...', flush=True)
        if wait(cdp, "GNNDirector.getState()==='BANTER' "
                     "&& GNNTextEngine.progress()>0.3"):
            shot(cdp, 'banter.png')

        print('glitch...', flush=True)
        cdp.eval("GNNGlitch.fire('signal_tear', performance.now())")
        time.sleep(0.35)
        shot(cdp, 'glitch.png')

        print('commercial...', flush=True)
        cdp.eval('GNNDirector.forceBreak()')
        if wait(cdp, 'GNNCutsceneManager.isBreakActive()', 90):
            time.sleep(7)
            shot(cdp, 'commercial.png')
    finally:
        drive.shutdown(cdp)
    return 0


sys.exit(main())
