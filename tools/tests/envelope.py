"""What the voice envelope actually looks like during a read.

CLAUDE.md records that the level fix flattened it to about a decibel, which
is why lip-sync went to a free-running syllable clock. Before gating the
mouth on it again, measure it rather than assume either way.
"""
import sys, time
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
             'measure after six hours of debate, with three abstentions.",'
             '"source":"GNN Wire","link":""}])')
    cdp.eval('window.__lv=[];window.__iv&&clearInterval(window.__iv);'
             'window.__iv=setInterval(()=>{if(window.__lv.length<1200)'
             'window.__lv.push(+(GNNTTS.getLevel()||0).toFixed(3))},30)')
    for _ in range(80):
        if cdp.eval("GNNDirector.getState()==='READ'"):
            break
        time.sleep(0.5)
    time.sleep(12)
    import json
    lv = json.loads(cdp.eval('JSON.stringify(window.__lv)'))
    nz = [x for x in lv if x > 0]
    print('samples %d, speaking %d' % (len(lv), len(nz)))
    if nz:
        nz_s = sorted(nz)
        def pc(p): return nz_s[int(len(nz_s) * p)]
        print('  min %.3f  p5 %.3f  p25 %.3f  med %.3f  p75 %.3f  max %.3f'
              % (nz_s[0], pc(.05), pc(.25), pc(.5), pc(.75), nz_s[-1]))
        for g in (0.05, 0.10, 0.15, 0.20, 0.25, 0.30):
            print('    gate %.2f -> mouth open %4.1f%% of the read'
                  % (g, 100.0 * sum(1 for x in nz if x > g) / len(nz)))
    print('  dur of a silent gap, longest run below 0.10: %d samples'
          % max([0] + [len(r) for r in ''.join('x' if x <= 0.10 else '.'
                for x in nz).split('.')]))
finally:
    drive.shutdown(cdp)
