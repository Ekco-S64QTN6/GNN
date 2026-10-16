import json, sys, time
sys.path.insert(0, '/home/ekco/github/GNN/tools')
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
    time.sleep(3)
    cdp.eval('GNNDirector.enqueueAll([{"title":"Council votes to restrict warp '
             'lane access over Antares","description":"Delegates approved the '
             'measure after six hours of debate, with three abstentions '
             'recorded by the chair of the session.","source":"GNN Wire",'
             '"link":""}])')
    cdp.eval('window.__s=[];window.__i&&clearInterval(window.__i);'
             'window.__i=setInterval(()=>{if(window.__s.length<900){'
             'var a=GNNTTS.playbackProgress();'
             'window.__s.push([a===null?-1:+a.toFixed(3),'
             '+(GNNTextEngine.progress()||0).toFixed(3),'
             'GNNAnimator.mouthOpen()?1:0,'
             '+(GNNTTS.getLevel()||0).toFixed(3)])}},40)')
    for _ in range(80):
        if cdp.eval("GNNDirector.getState()==='READ'"):
            break
        time.sleep(0.5)
    time.sleep(14)
    s = json.loads(cdp.eval('JSON.stringify(window.__s)'))
    live = [r for r in s if r[0] >= 0]
    print("samples %d, with audio %d" % (len(s), len(live)))
    for r in live[::max(1,len(live)//14)]:
        print("   audio %.3f  text %.3f  mouth %d  lvl %.2f" % tuple(r))
    if live:
        drift = [abs(r[1] - r[0]) for r in live]
        drift.sort()
        print('  |text progress - audio progress|: med %.3f  p90 %.3f  max %.3f'
              % (drift[len(drift)//2], drift[int(len(drift)*.9)], drift[-1]))
        openf = sum(r[2] for r in live) / len(live)
        print('  mouth open %.0f%% of samples' % (100 * openf))
        quiet = [r for r in live if r[3] <= 0.10]
        if quiet:
            print('  during quiet (level<=0.10, %d samples): mouth open %.0f%%'
                  % (len(quiet), 100 * sum(r[2] for r in quiet) / len(quiet)))
        loud = [r for r in live if r[3] > 0.3]
        if loud:
            print('  during speech (level>0.30, %d samples): mouth open %.0f%%'
                  % (len(loud), 100 * sum(r[2] for r in loud) / len(loud)))
finally:
    drive.shutdown(cdp)
