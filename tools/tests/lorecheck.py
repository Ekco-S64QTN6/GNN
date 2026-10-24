import json, sys, time
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # repo root
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import drive
block, secs = sys.argv[1], int(sys.argv[2])
cdp = None
drive.launch()
try:
    cdp = drive.CDP(drive.ws_url())
    cdp.send('Page.enable'); cdp.send('Runtime.enable')
    cdp.send('Page.addScriptToEvaluateOnNewDocument', source=
        "window.__errs=[];window.addEventListener('error',e=>window.__errs.push(String(e.message)));")
    cdp.send('Page.navigate', url=drive.URL + '?block=%s&clock=off' % block)
    for _ in range(90):
        time.sleep(1)
        try:
            if cdp.eval('!!window.GNNBootReady'): break
        except Exception: pass
    cdp.eval("window.__lines=[];(function(){const o=GNNTextEngine.present;"
             "GNNTextEngine.present=function(t,opts){window.__lines.push([(opts&&opts.cue)||'',String(t).slice(0,110)]);"
             "return o.apply(this,arguments)}})()")
    cdp.eval("window.__reads=[];(function(){const T=window.GNNTranscript=window.GNNTranscript||{};const o=T.logStory;"
             "T.logStory=function(s){window.__reads.push([s.source||'',String(s.title).slice(0,90)]);if(o)try{o(s)}catch(e){}}})()")
    time.sleep(secs)
    show = cdp.eval('JSON.stringify(GNNDirector.getShowInfo?GNNDirector.getShowInfo():null)')
    reads = json.loads(cdp.eval('JSON.stringify(window.__reads)'))
    lines = json.loads(cdp.eval('JSON.stringify(window.__lines)'))
    print('show:', show)
    print('stories read: %d' % len(reads))
    for src, t in reads: print('   [%s] %s' % (src[:18], t))
    wire = [l for l in lines if 'WIRE' in l[0].upper() or 'sector wire' in l[1].lower()]
    print('lines presented: %d, of which sector-wire: %d' % (len(lines), len(wire)))
    for c, t in wire[:4]: print('   wire>', c, '|', t)
    print('page errors:', json.loads(cdp.eval('JSON.stringify(window.__errs)')))
finally:
    drive.shutdown(cdp)
