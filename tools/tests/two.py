import base64, os, sys, time
sys.path.insert(0, '/home/ekco/github/GNN/tools')
import drive
DOCS = '/home/ekco/github/GNN/docs'


def shot(cdp, name):
    d = cdp.send('Page.captureScreenshot', format='png')['data']
    open(os.path.join(DOCS, name), 'wb').write(base64.b64decode(d))
    print('  ->', name, flush=True)


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
        time.sleep(3)
        cdp.eval('GNNDirector.enqueueAll([{"title":"Fleet review finds three '
                 'cruisers unfit for deep patrol","description":"The '
                 'adjutant cites hull fatigue.","source":"GNN Wire","link":""}])')
        for _ in range(60):
            if cdp.eval("GNNDirector.getState()==='READ'"):
                break
            time.sleep(0.5)
        time.sleep(2)
        # Glitch: fire and grab on the next frames, not a third of a second on.
        print('glitch...', flush=True)
        best = None
        for d in (0.05, 0.10, 0.16, 0.22):
            cdp.eval("GNNGlitch.fire('signal_tear', performance.now())")
            time.sleep(d)
            data = cdp.send('Page.captureScreenshot', format='png')['data']
            if best is None or len(data) > len(best):
                best = data
        open(os.path.join(DOCS, 'glitch.png'), 'wb').write(base64.b64decode(best))
        print('  -> glitch.png', flush=True)

        print('commercial...', flush=True)
        cdp.eval('GNNDirector.forceBreak()')
        for _ in range(90):
            if cdp.eval('GNNCutsceneManager.isBreakActive()'):
                break
            time.sleep(0.5)
        # Walk the break and keep the frame with the most ink: the product
        # card beats a starfield with one line of copy on it.
        best, n = None, 0
        for _ in range(22):
            time.sleep(0.8)
            if not cdp.eval('GNNCutsceneManager.isBreakActive()'):
                break
            data = cdp.send('Page.captureScreenshot', format='png')['data']
            if len(data) > n:
                n, best = len(data), data
        if best:
            open(os.path.join(DOCS, 'commercial.png'), 'wb').write(
                base64.b64decode(best))
            print('  -> commercial.png', flush=True)
    finally:
        drive.shutdown(cdp)
    return 0


sys.exit(main())
