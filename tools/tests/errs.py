import json, sys, time
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # repo root
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import drive
cdp = None
drive.launch()
try:
    cdp = drive.CDP(drive.ws_url())
    cdp.send('Runtime.enable'); cdp.send('Log.enable'); cdp.send('Page.enable')
    cdp.send('Page.navigate', url=drive.URL)
    time.sleep(14)
    for k in ('GNNDirector','GNNScript','GNNFeedManager','GNNCast'):
        print('%-16s %s' % (k, cdp.eval('typeof %s' % k)))
    print('state  ', cdp.eval('try{GNNDirector.getState()}catch(e){String(e)}'))
    print('pool   ', cdp.eval('try{String(GNNFeedManager.poolSize&&GNNFeedManager.poolSize())}catch(e){String(e)}'))
    print('err    ', cdp.eval('String(window.__lastError||"none")'))
finally:
    drive.shutdown(cdp)
