import sys, time, json
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # repo root
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import drive
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
    print('twoWay script:', cdp.eval(
        'JSON.stringify((GNNScript.twoWay()||{}).correspondent||null)'))
    ok = cdp.eval("GNNCutsceneManager.openTwoWay('bulrathi',null,"
                  "performance.now(),'SORREK').then(r=>window.__ok=r)")
    time.sleep(3)
    print('openTwoWay ->', cdp.eval('String(window.__ok)'),
          '| isTwoWay', cdp.eval('String(GNNCutsceneManager.isTwoWay())'))
    time.sleep(1)
    import base64
    d = cdp.send('Page.captureScreenshot', format='png')['data']
    open(sys.argv[1], 'wb').write(base64.b64decode(d))
    print('shot written')
finally:
    drive.shutdown(cdp)
