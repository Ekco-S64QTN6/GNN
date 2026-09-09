#!/usr/bin/env python3
"""
capture_docs.py — grab the screenshots README.md links to.

Drives the running station over CDP, waits for each segment to come up
naturally (or forces it), and writes cropped PNGs into docs/.

    python3 server.py &
    python3 tools/capture_docs.py
"""

import base64
import io
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import drive  # noqa: E402

from PIL import Image  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, 'docs')


def rect(cdp, selector):
    r = cdp.eval("""(()=>{const e=document.querySelector('%s');
        const b=e.getBoundingClientRect();
        return {x:b.x,y:b.y,w:b.width,h:b.height};})()""" % selector)
    return r


def grab(cdp, name, box, pad=0):
    r = cdp.send('Page.captureScreenshot', format='png')
    im = Image.open(io.BytesIO(base64.b64decode(r['data']))).convert('RGB')
    x, y = int(box['x']) - pad, int(box['y']) - pad
    w, h = int(box['w']) + pad * 2, int(box['h']) + pad * 2
    im.crop((max(0, x), max(0, y), min(im.width, x + w), min(im.height, y + h))) \
      .save(os.path.join(DOCS, name))
    print('  ->', name)


def wait_for(cdp, pred, limit=240, label=''):
    t0 = time.time()
    while time.time() - t0 < limit:
        p = cdp.eval(drive.PROBE)
        if isinstance(p, dict) and '__error' not in p and pred(p):
            return p
        time.sleep(0.35)
    print('  (timed out waiting for %s)' % label)
    return None


def main():
    os.makedirs(DOCS, exist_ok=True)
    cdp = None
    drive.launch()
    try:
        cdp = drive.CDP(drive.ws_url())
        cdp.send('Page.enable')
        cdp.send('Runtime.enable')
        cdp.send('Page.navigate', url=drive.URL)
        time.sleep(10)
        cdp.send('Input.dispatchMouseEvent', type='mousePressed', x=600, y=880,
                 button='left', clickCount=1)
        cdp.send('Input.dispatchMouseEvent', type='mouseReleased', x=600, y=880,
                 button='left', clickCount=1)

        app = rect(cdp, '#app')
        tail = rect(cdp, '#telemetry')
        # #app's box can stop short of its last child; extend to the telemetry line.
        app['h'] = max(app['h'], (tail['y'] + tail['h']) - app['y'] + 10)
        screen = rect(cdp, '#canvas-wrapper')

        print('hero...')
        wait_for(cdp, lambda p: p['state'] == 'READ' and 25 < p['prompt'] < 95, label='READ')
        grab(cdp, 'hero.png', app, pad=6)

        print('cutaway...')
        wait_for(cdp, lambda p: p['cutaway'], label='cutaway')
        time.sleep(1.2)
        grab(cdp, 'cutaway.png', screen)

        print('banter...')
        wait_for(cdp, lambda p: p['state'] in ('BANTER', 'WIRE') and p['prompt'] >= 100,
                 label='banter')
        grab(cdp, 'banter.png', screen)

        print('commercial...')
        cdp.eval('GNNDirector.forceBreak(); "ok"')
        wait_for(cdp, lambda p: p['breaking'], label='break')
        time.sleep(9)          # skip the ident, land on a product shot
        grab(cdp, 'commercial.png', screen)

        print('glitch...')
        wait_for(cdp, lambda p: not p['breaking'], label='break end')
        wait_for(cdp, lambda p: p['state'] == 'READ', label='READ')
        cdp.eval("GNNGlitch.fire('interference', performance.now())")
        time.sleep(0.45)
        grab(cdp, 'glitch.png', screen)

        print('scene sheet...')
        cdp.eval('GNNDirector.pause(); GNNTTS.setEnabled(false); "ok"')
        tiles = []
        for kind in cdp.eval('GNNSceneCompositor.recipes()'):
            data = cdp.eval("""(async()=>{
                const s = await GNNSceneCompositor.synthesize('%s');
                if (!s) return null;
                return GNNSceneCompositor.draw(s, 3400).toDataURL('image/png');
            })()""" % kind)
            if data:
                tiles.append((kind, Image.open(io.BytesIO(
                    base64.b64decode(data.split(',', 1)[1]))).convert('RGB')))
        if tiles:
            cols, tw, th, gap = 3, 320, 200, 4
            rows = (len(tiles) + cols - 1) // cols
            sheet = Image.new('RGB', (cols * tw + (cols - 1) * gap,
                                      rows * th + (rows - 1) * gap), (10, 12, 18))
            for i, (_name, im) in enumerate(tiles):
                sheet.paste(im, ((i % cols) * (tw + gap), (i // cols) * (th + gap)))
            sheet.save(os.path.join(DOCS, 'scenes.png'))
            print('  -> scenes.png (%d recipes)' % len(tiles))

        print('exceptions:', len(drive.EXCEPTIONS))
    finally:
        drive.shutdown(cdp)


if __name__ == '__main__':
    main()
