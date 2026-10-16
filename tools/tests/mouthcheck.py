"""Does each anchor's mouth actually move while they read?

Measured in the running app rather than reasoned about: grab frames at
80ms while a story is read, crop the head of each seat, and count how many
consecutive frames differ there. A mouth that flaps changes; one that does
not, does not.
"""
import base64, io, sys, time
import numpy as np
from PIL import Image
sys.path.insert(0, '/home/ekco/github/GNN/tools')
import drive                                             # noqa: E402

STORIES = [("Council votes to restrict warp lane access over Antares",
            "Delegates approved the measure after six hours of debate, with "
            "three abstentions recorded by the chair."),
           ("Mining consortium reports record zortrium yield at Vega Four",
            "Output rose eleven percent on the quarter, the consortium said."),
           ("Quarantine lifted on the Rigel colony after eight weeks",
            "Medical teams confirmed no new cases in fourteen days.")]
# head boxes at 1200x750-ish capture, as fractions of the frame
SEATS = {'left': (0.28, 0.12, 0.44, 0.30), 'right': (0.54, 0.12, 0.70, 0.30)}


def grab(cdp):
    d = cdp.send('Page.captureScreenshot', format='png')['data']
    return Image.open(io.BytesIO(base64.b64decode(d))).convert('RGB')


def main():
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
        time.sleep(4)
        payload = str([{'title': t, 'description': d, 'source': 'GNN Wire',
                        'link': ''} for t, d in STORIES]).replace("'", '"')
        cdp.eval('GNNDirector.enqueueAll(%s)' % payload)

        for story in range(2):
            for _ in range(70):
                try:
                    if cdp.eval("GNNDirector.getState()==='READ' "
                                "&& !GNNCutsceneManager.isCutawayActive()"):
                        break
                except Exception:                         # noqa: BLE001
                    pass
                time.sleep(0.5)
            seat = cdp.eval('GNNDirector.activeSeat()')
            ids = cdp.eval('JSON.stringify(GNNRenderer.seatedIds())')
            frames = []
            for _ in range(22):
                frames.append(grab(cdp)); time.sleep(0.08)
            W, H = frames[0].size
            print('story %d: activeSeat=%s seated=%s  frame %dx%d'
                  % (story, seat, ids, W, H))
            for name, (x0, y0, x1, y1) in SEATS.items():
                box = (int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H))
                crops = [np.asarray(f.crop(box), dtype=int) for f in frames]
                changes = sum(1 for a, b in zip(crops, crops[1:])
                              if np.abs(a - b).mean() > 0.35)
                print('   %-5s head changed in %2d of %d frame gaps'
                      % (name, changes, len(crops) - 1))
            # wait out this story
            for _ in range(60):
                if not cdp.eval("GNNDirector.getState()==='READ'"):
                    break
                time.sleep(0.5)
    finally:
        drive.shutdown(cdp)
    return 0


sys.exit(main())
