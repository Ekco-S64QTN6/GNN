"""Boot a show, then measure the silence between consecutive voice lines.

Counts how often the booth ident starts (it must be once), and for every
spoken line records audio start and end from the media elements themselves
(`playing` / `ended`, captured at the document). A gap is the silence from one
line's end to the next line's start — what a viewer hears as the pause between
anchors.

    python3 tools/tests/speechgaps.py [block] [seconds] [forced breaks]
"""
import json
import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # repo root
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import drive                                               # noqa: E402

block = sys.argv[1] if len(sys.argv) > 1 else 'night_desk'
secs = int(sys.argv[2]) if len(sys.argv) > 2 else 120
breaks = int(sys.argv[3]) if len(sys.argv) > 3 else 0     # force this many commercial breaks
cdp = None
drive.launch()
try:
    cdp = drive.CDP(drive.ws_url())
    cdp.send('Page.enable'); cdp.send('Runtime.enable')
    cdp.send('Page.addScriptToEvaluateOnNewDocument', source="""
      window.__ev=[]; window.__idents=0;
      // The voice's audio element is never attached to the document, so
      // document listeners miss it: hook play() and watch each element.
      const P = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function(){
        if (!this.__watched) {
          this.__watched = true;
          this.addEventListener('playing', () => window.__ev.push(['start', performance.now()]));
          this.addEventListener('ended', () => window.__ev.push(['end', performance.now()]));
          this.addEventListener('pause', () => { if (!this.ended && this.currentTime > 0.1 && this.currentTime < this.duration - 0.1) window.__ev.push(['cut', performance.now(), this.currentTime, this.duration]); });
        }
        return P.apply(this, arguments);
      };
      const L = console.log; console.log = function(){ const t=[...arguments].join(' ');
        if (t.includes('speak start') && t.includes('chars=34') && t.includes('vox_unit')) window.__idents++;
        if (t.includes('[GNN Director] state ->')) window.__ev.push(['state', performance.now(), t.split('state -> ')[1].split(' ')[0]]);
        L.apply(console, arguments); };
    """)
    cdp.send('Page.navigate', url=drive.URL + '?block=%s&clock=off' % block)
    for _ in range(90):
        time.sleep(1)
        try:
            if cdp.eval('!!window.GNNBootReady'): break
        except Exception: pass
    if breaks:
        # Force breaks back to back; each is waited out before the next.
        per = secs / breaks
        for _ in range(breaks):
            cdp.eval('GNNDirector.forceBreak()')
            t0 = time.time()
            while time.time() - t0 < per:
                time.sleep(1)
    else:
        time.sleep(secs)
    ev = json.loads(cdp.eval('JSON.stringify(window.__ev)'))
    print('ident starts:', cdp.eval('window.__idents'))
    gaps, last_end, states = [], None, []
    for e in ev:
        if e[0] == 'state':
            states.append(e[2])
        elif e[0] == 'end':
            last_end = e[1]; states = []
        elif e[0] == 'start' and last_end is not None:
            gaps.append(((e[1] - last_end) / 1000.0, ' > '.join(states[-3:])))
            last_end = None
    cuts = [e for e in ev if e[0] == 'cut']
    print('lines cut off mid-speech:', len(cuts), ['%.1f/%.1fs' % (c[2], c[3]) for c in cuts][:8])
    for g, st in gaps:
        print('  gap %5.2fs  %s' % (g, st))
    if gaps:
        gs = sorted(g for g, _ in gaps)
        print('gaps: n=%d median %.2fs  p90 %.2fs  max %.2fs' % (len(gs), gs[len(gs) // 2], gs[int(len(gs) * 0.9)], gs[-1]))
finally:
    drive.shutdown(cdp)
