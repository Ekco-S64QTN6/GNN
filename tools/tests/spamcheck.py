import json, sys, time
sys.path.insert(0, '/home/ekco/github/GNN/tools')
import drive
cdp = None
drive.launch()
try:
    cdp = drive.CDP(drive.ws_url())
    cdp.send('Page.enable'); cdp.send('Runtime.enable')
    cdp.send('Page.addScriptToEvaluateOnNewDocument', source=
        "window.__errs=[];window.addEventListener('error',e=>window.__errs.push(String(e.message)));")
    cdp.send('Page.navigate', url=drive.URL)
    for _ in range(90):
        time.sleep(1)
        try:
            if cdp.eval('!!window.GNNBootReady'): break
        except Exception: pass
    time.sleep(4)
    cdp.eval("window.__said=[];(function(){const o=GNNTTS.speak;GNNTTS.speak=function(t,op){"
             "window.__said.push([performance.now()|0,String(t).slice(0,60)]);return o.apply(this,arguments)}})()")
    cdp.eval("window.__rev=[];(function(){const d=GNNDirector.interject;GNNDirector.interject=function(t,o){"
             "const r=d.apply(this,arguments);window.__rev.push([performance.now()|0,String(t).slice(0,40),r]);return r}})()")
    t0 = cdp.eval('performance.now()|0')
    for w in ['help', 'hello', 'static', 'yomama', 'gnn', 'bars', 'help', 'hello']:
        for ch in w:
            cdp.send('Input.dispatchKeyEvent', type='keyDown', key=ch, text=ch)
            cdp.send('Input.dispatchKeyEvent', type='keyUp', key=ch)
        time.sleep(0.15)
    time.sleep(60)
    said = json.loads(cdp.eval('JSON.stringify(window.__said)'))
    caps = [x for x in said if x[1].isupper()]
    print('secret lines spoken in 60 s after typing 8 words:', len(caps))
    for t, x in caps: print('  +%5.1fs  %s' % ((t - t0) / 1000.0, x))
    print('interject calls:', json.loads(cdp.eval('JSON.stringify(window.__rev)')))
    print('discovered:', cdp.eval('GNNGlitch.discoveredCount()'))
    print('all speak calls:', len(said), [x[1][:30] for x in said][:8])
    print('page errors:', json.loads(cdp.eval('JSON.stringify(window.__errs)')))
finally:
    drive.shutdown(cdp)
