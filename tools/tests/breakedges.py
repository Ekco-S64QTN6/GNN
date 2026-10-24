"""The ways a commercial break can be interrupted, and a show promo's content.

1. Skip mid-break: the break ends and the next story starts. The return line
   ("we now return you…") must not play over that story.
2. A secret typed mid-break: it must not cut the announcer off. It waits for
   the break (or expires) instead.
3. A show promo: every shot after the ident shows the show's title card, and
   the body line names the show's two anchors.

    python3 tools/tests/breakedges.py
"""
import json
import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # repo root
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import drive                                               # noqa: E402

HOOK = r"""
window.__ev = [];
const P = HTMLMediaElement.prototype.play;
HTMLMediaElement.prototype.play = function () {
  if (!this.__w) {
    this.__w = 1;
    this.addEventListener('pause', () => {
      if (!this.ended && this.currentTime > 0.1 && this.currentTime < this.duration - 0.1)
        __ev.push(['cut', performance.now(), this.currentTime, this.duration]);
    });
  }
  return P.apply(this, arguments);
};
"""


def wait(cdp, expr, secs):
    t0 = time.time()
    while time.time() - t0 < secs:
        if cdp.eval(expr): return True
        time.sleep(0.25)
    return False


cdp = None
drive.launch()
fails = []
try:
    cdp = drive.CDP(drive.ws_url())
    cdp.send('Page.enable'); cdp.send('Runtime.enable')
    cdp.send('Page.addScriptToEvaluateOnNewDocument', source=HOOK)
    cdp.send('Page.navigate', url=drive.URL + '?block=night_desk&clock=off')
    wait(cdp, '!!window.GNNBootReady', 90)
    time.sleep(6)
    cdp.eval("window.__signoffs = 0; const _s = GNNScript.signoff;"
             "GNNScript.signoff = function () { __signoffs++; return _s.apply(this, arguments); }")

    # 1 — skip in the middle of a break
    cdp.eval('GNNDirector.forceBreak()')
    wait(cdp, 'GNNCutsceneManager.shotIndex() >= 2', 90)
    cdp.eval('GNNDirector.skip()')
    time.sleep(8)
    n = cdp.eval('__signoffs')
    print('1. skip mid-break   return lines after skip: %d (want 0)' % n)
    if n: fails.append('skip')

    # 2 — a secret typed in the middle of a break
    time.sleep(10)
    cdp.eval('__ev.length = 0; GNNDirector.forceBreak()')
    wait(cdp, 'GNNCutsceneManager.shotIndex() >= 1', 90)
    time.sleep(0.8)   # mid-line
    cdp.eval("GNNDirector.interject('Unlisted transmission. Testing.')")
    wait(cdp, 'GNNCutsceneManager.shotIndex() === -1', 150)
    time.sleep(6)
    cuts = json.loads(cdp.eval('JSON.stringify(__ev.filter(e => e[0] === "cut"))'))
    print('2. secret mid-break lines cut off: %d (want 0)' % len(cuts))
    if cuts: fails.append('interject')

    # 3 — a show promo
    time.sleep(10)
    cdp.eval("GNNCutsceneManager.endCutaway(); window.__pm = null;"
             "(async () => { await GNNCutsceneManager.startCommercialBreak(performance.now(), {kind:'promo'}); })()")
    wait(cdp, 'GNNCutsceneManager.shotIndex() >= 1', 60)
    info = json.loads(cdp.eval(
        "JSON.stringify((() => { const s = GNNCutsceneManager.breakScript();"
        " return s && { psa: !!s.isPSA, card: s.titlecard, show: s.product,"
        " lines: s.beats.map(b => b.text) }; })())"))
    print('3. promo            ', json.dumps(info, ensure_ascii=False))
    if info and not info.get('psa'):
        if not info.get('card'): fails.append('promo card')
        if not any(l.startswith('Join ') for l in info['lines']): fails.append('promo anchors')
    cdp.eval('GNNCutsceneManager.abortBreak()')
finally:
    drive.shutdown(cdp)
print('FAIL: ' + ', '.join(fails) if fails else 'all passed')
sys.exit(1 if fails else 0)
