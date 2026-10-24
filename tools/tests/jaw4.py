"""Does the mouth actually flap?

Polls a running counter every couple of seconds rather than sleeping for a
minute and asking once: a long idle sleep drops the CDP websocket, which
cost four attempts at this measurement.
"""
import json
import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # repo root
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import drive                                             # noqa: E402

TAP = """
(() => {
  if (window.__jw) return 'already';
  const s = { talk: 0, shut: 0, flips: 0, prev: null, runs: [], cur: 0 };
  window.__jw = s;
  setInterval(() => {
    if (!GNNTTS.isSpeaking()) { s.prev = null; return; }
    s.talk++;
    const open = GNNAnimator.mouthOpen();
    if (!open) s.shut++;
    if (s.prev !== null && s.prev !== open) {
      s.flips++;
      if (s.cur) s.runs.push(s.cur);
      s.cur = 1;
    } else { s.cur++; }
    s.prev = open;
  }, 40);
  return 'tapping';
})()
"""

READ = ("JSON.stringify({t:__jw.talk,s:__jw.shut,f:__jw.flips,"
        "r:__jw.runs.length?Math.round(__jw.runs.reduce((a,b)=>a+b,0)"
        "/__jw.runs.length):0})")


def main():
    cdp = None
    drive.launch()
    last = {}
    try:
        cdp = drive.CDP(drive.ws_url())
        cdp.send('Page.enable')
        cdp.send('Runtime.enable')
        cdp.send('Page.navigate', url=drive.URL)
        for _ in range(7):
            time.sleep(2)
            cdp.eval('1')
        cdp.send('Input.dispatchMouseEvent', type='mousePressed',
                 x=600, y=880, button='left', clickCount=1)
        cdp.send('Input.dispatchMouseEvent', type='mouseReleased',
                 x=600, y=880, button='left', clickCount=1)
        time.sleep(2)
        print(cdp.eval(TAP), flush=True)
        for i in range(28):
            time.sleep(2)
            last = json.loads(cdp.eval(READ))
            if i % 5 == 4:
                print('  %2ds talking=%d flips=%d'
                      % ((i + 1) * 2, last['t'], last['f']), flush=True)
    finally:
        drive.shutdown(cdp)

    if not last or not last.get('t'):
        print('never caught it speaking')
        return 0
    t, sh, f, r = last['t'], last['s'], last['f'], last['r']
    print()
    print('samples while talking : %d  (40ms each, so %.0fs of speech)'
          % (t, t * 0.04))
    print('mouth shut for        : %d of them (%.0f%%)' % (sh, 100.0 * sh / t))
    print('open/shut transitions : %d' % f)
    print('average hold          : %.0f ms' % (r * 40))
    if f < 5:
        print('VERDICT: the mouth is not flapping')
    elif sh < t * 0.1:
        print('VERDICT: flapping, but barely ever shut')
    else:
        print('VERDICT: flapping at speech rate')
    return 0


if __name__ == '__main__':
    sys.exit(main())
