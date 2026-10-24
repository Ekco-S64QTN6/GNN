import sys, time
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # repo root
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import drive                                             # noqa: E402
cdp = None
drive.launch()
try:
    cdp = drive.CDP(drive.ws_url())
    cdp.send('Page.enable'); cdp.send('Runtime.enable')
    errs = []
    cdp.on = getattr(cdp, 'on', None)
    cdp.send('Page.navigate', url=drive.URL)
    time.sleep(16)
    for ev in ('mousePressed', 'mouseReleased'):
        cdp.send('Input.dispatchMouseEvent', type=ev, x=600, y=880,
                 button='left', clickCount=1)
    time.sleep(25)
    q = cdp.eval('JSON.stringify((GNNDirector.getQueue()||[]).map(i=>i.title))')
    cur = cdp.eval('JSON.stringify((GNNDirector.getCurrent()||{}).title||null)')
    print('on air :', cur)
    print('rundown:')
    import json
    for t in json.loads(q):
        print('   -', t[:74])
finally:
    drive.shutdown(cdp)
