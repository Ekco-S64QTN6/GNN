"""The two shots the first pass could not wait out: banter and a break.

Both are reached by driving the director rather than by waiting for it to
arrive there on its own, which is what timed out.
"""
import base64
import os
import sys
import time

sys.path.insert(0, '/home/ekco/github/GNN/tools')
import drive                                             # noqa: E402

DOCS = '/home/ekco/github/GNN/docs'
STORIES = [
    ("Council votes to restrict warp lane access over Antares",
     "Delegates approved the measure after six hours of debate."),
    ("Mining consortium reports record zortrium yield at Vega Four",
     "Output rose eleven percent on the quarter."),
]


def shot(cdp, name):
    data = cdp.send('Page.captureScreenshot', format='png')['data']
    with open(os.path.join(DOCS, name), 'wb') as fh:
        fh.write(base64.b64decode(data))
    print('  ->', name, flush=True)


def main():
    cdp = None
    drive.launch()
    try:
        cdp = drive.CDP(drive.ws_url())
        cdp.send('Page.enable')
        cdp.send('Runtime.enable')
        cdp.send('Page.navigate', url=drive.URL)
        time.sleep(13)
        cdp.send('Input.dispatchMouseEvent', type='mousePressed',
                 x=600, y=880, button='left', clickCount=1)
        cdp.send('Input.dispatchMouseEvent', type='mouseReleased',
                 x=600, y=880, button='left', clickCount=1)
        time.sleep(4)
        payload = str([{'title': t, 'description': d,
                        'source': 'GNN Wire', 'link': ''}
                       for t, d in STORIES]).replace("'", '"')
        cdp.eval('GNNDirector.enqueueAll(%s)' % payload)

        # Banter: put one of the desk's own exchanges on the prompter
        # directly, rather than waiting for the rundown to reach one.
        print('banter...', flush=True)
        cdp.eval("""(() => {
          const ex = GNNScript.exchange();
          const line = ex ? (ex[0].who.name + ': ' + ex[0].text)
                          : GNNScript.banter(null);
          GNNTextEngine.present(line, { kind: 'banter', cue: 'ANCHOR COMMENT',
                                        durationMs: 6000 });
          return line;
        })()""")
        time.sleep(3.5)
        shot(cdp, 'banter.png')

        print('commercial...', flush=True)
        cdp.eval('GNNDirector.forceBreak()')
        for _ in range(40):
            if cdp.eval('GNNCutsceneManager.isBreakActive()'):
                break
            time.sleep(1)
        time.sleep(7)
        shot(cdp, 'commercial.png')
    finally:
        drive.shutdown(cdp)
    return 0


if __name__ == '__main__':
    sys.exit(main())
