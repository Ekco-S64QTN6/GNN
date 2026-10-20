import json, sys, time
sys.path.insert(0, '/home/ekco/github/GNN/tools')
import drive
cdp = None
drive.launch()
try:
    cdp = drive.CDP(drive.ws_url())
    cdp.send('Page.enable'); cdp.send('Runtime.enable')
    cdp.send('Page.addScriptToEvaluateOnNewDocument', source=
        "window.__errs=[];window.addEventListener('error',e=>window.__errs.push(String(e.message)));"
        "window.addEventListener('unhandledrejection',e=>window.__errs.push('rej:'+String(e.reason)));")
    cdp.send('Page.navigate', url=drive.URL)
    for _ in range(90):
        time.sleep(1)
        try:
            if cdp.eval('!!window.GNNBootReady'): break
        except Exception: pass
    for ev in ('mousePressed', 'mouseReleased'):
        cdp.send('Input.dispatchMouseEvent', type=ev, x=600, y=880, button='left', clickCount=1)
    cdp.eval("window.__metas=[];window.GNNTranscript=window.GNNTranscript||{};"
             "(function(){const o=window.GNNTranscript.logCommercial;"
             "window.GNNTranscript.logCommercial=function(m){window.__metas.push(m);if(o)try{o(m)}catch(e){}}})()")
    for n in range(3):
        cdp.eval('GNNCutsceneManager.endCutaway&&GNNCutsceneManager.endCutaway()')
        cdp.eval('GNNDirector.forceBreak()')
        for _ in range(60):
            time.sleep(1)
            if len(json.loads(cdp.eval('JSON.stringify(window.__metas.map(m=>1))'))) > n: break
        # let it play a while, then cut it short for the next one
        time.sleep(8)
        cdp.eval('GNNCutsceneManager.abortBreak&&GNNCutsceneManager.abortBreak()')
        time.sleep(2)
    metas = json.loads(cdp.eval('JSON.stringify(window.__metas)'))
    for m in metas:
        voices = [s['voice'] for s in m['shots']]
        print('break: %2d shots %6.1fs | first brand %-28s' % (m['shotsCount'], m['durationMs']/1000, m['brand'][:28]))
        print('   kinds  :', ' '.join(s['kind'] for s in m['shots']))
        print('   voices :', ' '.join(v.split('_')[1] if v and '_' in v else str(v) for v in voices))
    print('page errors:', json.loads(cdp.eval('JSON.stringify(window.__errs)')))
finally:
    drive.shutdown(cdp)
