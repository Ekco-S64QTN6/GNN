#!/usr/bin/env python3
"""Render the ground-war stinger frame by frame from the station's compositor.

The COLGCBT troop battle (scene-compositor.js `groundwar`) on a MoO2 planet
surface, with warships from the MoO2 ship archive crossing the sky above it.
Drawn by GNNSceneCompositor.draw() in the page at 320x180 per frame and saved
as PNGs, so every frame is exact (no screen capture).

    ./start.sh --bg
    python3 trailer/render_stinger.py [seconds] [seed]
"""
import base64
import json
import os
import shutil
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'tools'))
import drive                                               # noqa: E402

OUT = os.path.join(HERE, 'build', 'gw_frames')
SECS = float(sys.argv[1]) if len(sys.argv) > 1 else 7.0
FPS = 30

BUILD = r"""
(async function(secs){
  const sc = await GNNSceneCompositor.groundWar(secs);
  const pool = GNNAssets.find({ pool: 'sprite', dirs: ['SHIPS'], minW: 36, maxW: 64 })
      .filter(e => e.source === 'moo2');
  const ships = [];
  for (let i = 0; i < 5 && pool.length; i++) ships.push(pool[(Math.random() * pool.length) | 0]);
  const layers = [];
  for (let i = 0; i < ships.length; i++) {
    const y = 0.04 + i * 0.07 + Math.random() * 0.03;
    const t0 = i * 0.9 + Math.random() * 0.6;
    const dur = 4.5 + Math.random() * 2.5;
    const left = i % 2 === 0;
    const L = await GNNSceneCompositor.makeLayer(ships[i], {
      fit: 'native', rect: { x: left ? -0.2 : 1.02, y, w: 0.16, h: 0.16 },
      motion: 'shot', params: { t0, dur, dx: (left ? 1 : -1) * 1.3 * 320, dy: (Math.random() - 0.5) * 18 },
      fps: 0, flip: !left, alpha: 0.95,
    });
    if (L) layers.push(L);
  }
  // Behind the ground (which is transparent in the sky), above the stars.
  sc.layers.splice(1, 0, ...layers);
  window.__gw = sc;
  return sc.layers.length;
})(__SECS__)
"""

FRAME = "GNNSceneCompositor.draw(window.__gw, %d).toDataURL('image/png')"


def main():
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    cdp = None
    drive.launch()
    try:
        cdp = drive.CDP(drive.ws_url())
        cdp.send('Page.enable'); cdp.send('Runtime.enable')
        cdp.send('Page.navigate', url=drive.URL + '?block=archives&clock=off')
        for _ in range(90):
            time.sleep(1)
            try:
                if cdp.eval('!!window.GNNBootReady'):
                    break
            except Exception:                                # noqa: BLE001
                pass
        cdp.eval('GNNDirector.pause()')
        print('layers:', cdp.eval(BUILD.replace('__SECS__', str(SECS))))
        n = int(SECS * FPS)
        for f in range(n):
            url = cdp.eval(FRAME % int(f * 1000 / FPS))
            with open(os.path.join(OUT, 'f_%04d.png' % f), 'wb') as fh:
                fh.write(base64.b64decode(url.split(',', 1)[1]))
        print('frames:', n, '->', OUT)
    finally:
        drive.shutdown(cdp)


if __name__ == '__main__':
    main()
