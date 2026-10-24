"""Force commercial breaks and time every seam in them.

A break has five seams a viewer can hear or see, and this measures each one
from the media elements and the frame loop rather than from the code's own
idea of what it did:

  toss -> first spot   silence between the anchor's throw and the ident
  line -> line         silence between consecutive announcer lines
  line -> next shot    picture holding after its line ended
  frozen tail          an animated shot sitting on its last frame
  last spot -> desk    silence between the last line and the anchor's return

Also counts lines cut off mid-speech, frames that took over 150 ms (the frame
loop stalling while a shot loads), and the director's state when each break
ends, so a break that comes back twice or not at all shows up.

    python3 tools/tests/breakcheck.py [breaks] [block] [extra query, e.g. commercials=footage]
"""
import json
import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # repo root
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import drive                                               # noqa: E402

breaks = int(sys.argv[1]) if len(sys.argv) > 1 else 3
block = sys.argv[2] if len(sys.argv) > 2 else 'night_desk'

HOOK = r"""
window.__ev = []; window.__errs = [];
addEventListener('error', e => __errs.push(String(e.message)));
addEventListener('unhandledrejection', e => __errs.push('rej:' + String(e.reason)));
const P = HTMLMediaElement.prototype.play;
HTMLMediaElement.prototype.play = function () {
  if (!this.__watched) {
    this.__watched = true;
    this.addEventListener('playing', () => __ev.push(['start', performance.now()]));
    this.addEventListener('ended', () => __ev.push(['end', performance.now()]));
    this.addEventListener('pause', () => {
      if (!this.ended && this.currentTime > 0.1 && this.currentTime < this.duration - 0.1)
        __ev.push(['cut', performance.now(), this.currentTime, this.duration]);
    });
  }
  return P.apply(this, arguments);
};
const L = console.log;
console.log = function () {
  const t = [...arguments].join(' ');
  if (t.includes('[GNN Director] state ->')) __ev.push(['state', performance.now(), t.split('state -> ')[1].split(' ')[0]]);
  if (t.includes('commercial break started')) __ev.push(['breakcall', performance.now()]);
  L.apply(console, arguments);
};
// Frame loop: shot changes, break edges, and frames that took too long.
let lastIdx = -1, lastT = 0, lastInfo = null;
const tick = (t) => {
  try {
    if (typeof GNNCutsceneManager !== 'undefined') {
      const info = GNNCutsceneManager.shotInfo();
      const idx = info ? info.index : -1;
      if (idx !== lastIdx) {
        __ev.push(['shot', t, idx, info, lastInfo]);
        lastIdx = idx;
      }
      if (info) {
        if (lastT && t - lastT > 150) __ev.push(['stall', t, t - lastT]);
        lastInfo = Object.assign({}, info, { at: t });
      }
    }
  } catch (_) {}
  lastT = t;
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);
"""

cdp = None
drive.launch()
try:
    cdp = drive.CDP(drive.ws_url())
    cdp.send('Page.enable'); cdp.send('Runtime.enable')
    cdp.send('Page.addScriptToEvaluateOnNewDocument', source=HOOK)
    cdp.send('Page.navigate', url=drive.URL + '?block=%s&clock=off%s' % (block, ('&' + sys.argv[3]) if len(sys.argv) > 3 else ''))
    for _ in range(90):
        time.sleep(1)
        try:
            if cdp.eval('!!window.GNNBootReady'): break
        except Exception: pass
    time.sleep(6)   # let the cold open start; force from a normal read

    for n in range(breaks):
        # Wait for the desk to be mid-read, as a natural break would be.
        cdp.eval('GNNDirector.forceBreak()')
        t0 = time.time()
        # Assembly (shotIndex -1), then the shots, then -1 again: done.
        seen = False
        while time.time() - t0 < 240:
            time.sleep(0.5)
            idx = cdp.eval('GNNCutsceneManager.shotIndex()')
            if idx >= 0: seen = True
            elif seen: break
        time.sleep(14)   # the return to the desk, then some desk time

    ev = json.loads(cdp.eval('JSON.stringify(__ev)'))
    errs = json.loads(cdp.eval('JSON.stringify(__errs)'))
finally:
    drive.shutdown(cdp)

# ---- analysis ----------------------------------------------------------
# Split the event stream into breaks: from each forceBreak call to the first
# voice start after the break's last shot.
calls = [i for i, e in enumerate(ev) if e[0] == 'breakcall']
calls.append(len(ev))
cuts_total = 0
fails = []
for b in range(len(calls) - 1):
    seg = ev[calls[b]:calls[b + 1]]
    print('\n=== break %d ===' % (b + 1))
    starts = [e[1] for e in seg if e[0] == 'start']
    ends = [e[1] for e in seg if e[0] == 'end']
    shots = [e for e in seg if e[0] == 'shot']
    first_shot = next((e for e in shots if e[2] == 0), None)
    last_shot = next((e for e in shots if e[2] == -1), None)
    if not first_shot:
        print('  no shots seen'); continue
    t_open = first_shot[1]
    t_close = last_shot[1] if last_shot else None

    toss_end = max([t for t in ends if t < t_open] or [None], key=lambda x: x or 0)
    # The ident's voice can start a frame before the shot index is seen.
    first_ad = min([t for t in starts if t >= t_open - 150] or [None], key=lambda x: x or 1e18)
    if toss_end:
        print('  toss end -> picture   %5.2fs  (assembly, studio silent)' % ((t_open - toss_end) / 1000))
        if (t_open - toss_end) > 2000: fails.append('break %d: %.1fs silent before the picture' % (b + 1, (t_open - toss_end) / 1000))
    if first_ad:
        print('  picture -> first line %5.2fs' % ((first_ad - t_open) / 1000))
        if (first_ad - t_open) > 1500: fails.append('break %d: first line %.1fs after the picture' % (b + 1, (first_ad - t_open) / 1000))
    if '-v' in sys.argv:
        for e in seg[:40]: print('     ', e[0], round(e[1]), e[2] if len(e) > 2 and not isinstance(e[2], dict) else '')

    # In-break line gaps
    inb = sorted([('s', t) for t in starts if t_open <= t <= (t_close or 1e18)]
                 + [('e', t) for t in ends if t_open <= t <= (t_close or 1e18)], key=lambda x: x[1])
    gaps, le = [], None
    for k, t in inb:
        if k == 'e': le = t
        elif le is not None: gaps.append((t - le) / 1000); le = None
    if gaps:
        g = sorted(gaps)
        print('  line -> line          n=%d median %.2fs  max %.2fs' % (len(g), g[len(g) // 2], g[-1]))

    # Per shot: how long the picture outlived its line, and frozen tails.
    linger, frozen = [], []
    for e in shots:
        prev = e[4]
        if not prev or prev.get('index') is None: continue
        held = e[1] - (next((s[1] for s in shots if s[2] == prev['index']), e[1]))
        line_end = max([t for t in ends if t <= e[1]] or [0])
        if line_end and line_end > e[1] - held:
            linger.append((e[1] - line_end) / 1000)
        if prev['animMs'] > 0 and held > prev['animMs'] + 200:
            frozen.append((prev['kind'], round((held - prev['animMs']) / 1000, 2)))
    if linger:
        l = sorted(linger)
        print('  line end -> next shot median %.2fs  max %.2fs' % (l[len(l) // 2], l[-1]))
    print('  frozen tails          %s' % (frozen or 'none'))
    print('  shots (kind/hold/anim) %s' % ' '.join('%s/%.1f/%.1f' % (e[3]['kind'][:4], e[3]['duration'] / 1000, e[3]['animMs'] / 1000) for e in shots if e[3]))
    if t_close:
        last_ad_end = max([t for t in ends if t <= t_close + 50] or [0])
        back = min([t for t in starts if t > t_close] or [None], key=lambda x: x or 1e18)
        print('  last line -> pic off  %5.2fs' % ((t_close - last_ad_end) / 1000))
        if back:
            print('  pic off -> desk voice %5.2fs' % ((back - t_close) / 1000))
        print('  break on air          %5.1fs, %d shots' % ((t_close - t_open) / 1000, max(e[2] for e in shots) + 1))
    cuts = [e for e in seg if e[0] == 'cut']
    cuts_total += len(cuts)
    print('  lines cut mid-speech  %d %s' % (len(cuts), ['%.1f/%.1fs' % (c[2], c[3]) for c in cuts]))
    if cuts: fails.append('break %d: %d line(s) cut mid-speech' % (b + 1, len(cuts)))
    stalls = [e[2] for e in seg if e[0] == 'stall']
    print('  frame stalls >150ms   %d%s' % (len(stalls), ('  worst %.0fms' % max(stalls)) if stalls else ''))
    states = [e[2] for e in seg if e[0] == 'state' and (not t_close or e[1] >= t_close)]
    print('  states after break    %s' % ' > '.join(states[:5]))
    if states[:2] != ['HOLD', 'READ']: fails.append('break %d: came back as %s' % (b + 1, ' > '.join(states[:3])))
print('\npage errors:', errs[:6])
if errs: fails.append('%d page error(s)' % len(errs))
if len(calls) - 1 < breaks: fails.append('only %d of %d breaks ran' % (len(calls) - 1, breaks))
# Exit code: thresholds are a little above what a healthy break measured on
# 2026-10-18 (toss -> picture 0.3 s, first line on the picture's frame).
for f in fails: print('FAIL ' + f)
print('FAIL' if fails else 'PASS')
sys.exit(1 if fails else 0)
