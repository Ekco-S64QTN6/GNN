#!/usr/bin/env python3
"""
audio_probe.py — find where the broadcast's audio pops.

Taps the master bus with a ScriptProcessor so every sample is inspected,
then counts two defects and attributes them to whatever the station was
doing at the time:

  clip  |x| >= 0.999   -- summing past full scale
  pop   an isolated sample-to-sample jump far above the local roughness of
        the signal: |dx| > max(FLOOR, RATIO * running mean |dx|)

A fixed delta threshold does not work here: speech and music legitimately
step by 0.2 between samples at normal levels, so a flat threshold either
misses quiet pops or flags ordinary programme material. Measuring the jump
against the signal's own recent behaviour finds the discontinuities and
ignores the content.

    ./start.sh --bg && python3 tools/audio_probe.py
"""

import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import drive  # noqa: E402

FLOOR = 0.10
RATIO = 12.0

PROBE = """
(() => {
  const ctx = GNNAudio.getContext();
  if (!ctx) return 'no audio context';
  if (window.__probe) return 'already installed';
  const bus = GNNAudio.getMasterBus();
  const sp = ctx.createScriptProcessor(4096, 2, 2);
  const sink = ctx.createGain(); sink.gain.value = 0;
  const st = { clips: 0, steps: 0, peak: 0, blocks: 0, events: [], label: 'idle',
               maxStep: 0, worstRatio: 0 };
  let last = 0, ema = 0.001;
  sp.onaudioprocess = (e) => {
    const d = e.inputBuffer.getChannelData(0);
    st.blocks++;
    let clips = 0, steps = 0, peak = 0, maxStep = 0, worst = 0;
    for (let i = 0; i < d.length; i++) {
      const v = d[i], a = Math.abs(v);
      if (a > peak) peak = a;
      if (a >= 0.999) clips++;
      const dv = Math.abs(v - last);
      if (dv > maxStep) maxStep = dv;
      const r = dv / Math.max(ema, 1e-4);
      if (dv >= %f && r >= %f) { steps++; if (r > worst) worst = r; }
      ema += (dv - ema) * 0.002;      // slow, so a pop cannot hide itself
      last = v;
    }
    st.clips += clips; st.steps += steps;
    if (peak > st.peak) st.peak = peak;
    if (maxStep > st.maxStep) st.maxStep = maxStep;
    if (worst > st.worstRatio) st.worstRatio = worst;
    if (clips || steps) {
      st.events.push({ t: Math.round(performance.now()), label: st.label,
                       clips, steps, peak: +peak.toFixed(3),
                       maxStep: +maxStep.toFixed(3) });
      if (st.events.length > 400) st.events.shift();
    }
  };
  bus.connect(sp); sp.connect(sink); sink.connect(ctx.destination);
  window.__probe = st;
  return 'installed';
})()
""" % (FLOOR, RATIO)


def main():
    seconds = float(sys.argv[1]) if len(sys.argv) > 1 else 100
    cdp = None
    drive.launch()
    try:
        cdp = drive.CDP(drive.ws_url())
        cdp.send('Page.enable')
        cdp.send('Runtime.enable')
        cdp.send('Page.navigate', url=drive.URL)
        time.sleep(9)
        cdp.send('Input.dispatchMouseEvent', type='mousePressed', x=600, y=880,
                 button='left', clickCount=1)
        cdp.send('Input.dispatchMouseEvent', type='mouseReleased', x=600, y=880,
                 button='left', clickCount=1)
        time.sleep(3)
        print('probe:', cdp.eval(PROBE))

        def label(name):
            cdp.eval("window.__probe.label = %s" % json.dumps(name))

        # Exercise each suspect in isolation, with quiet gaps between.
        script = [
            ('idle', 6, None),
            ('one-shot sfx', 6, "for(let i=0;i<6;i++) setTimeout(()=>GNNAudio.playRole('blast',{gain:0.6}), i*700)"),
            ('teletype burst', 6, None),
            ('klaxon', 4, "GNNAudio.playKlaxon()"),
            ('music start', 6, "GNNAudio.playMusic(GNNAssets.musicTracks()[3].id,{gain:0.6})"),
            ('music stop', 5, "GNNAudio.stopMusic(0.8)"),
            ('glitch crush', 5, "GNNGlitch.fire('carrier_drop', performance.now())"),
            ('tape stop', 6, "GNNAudio.playMusic(GNNAssets.musicTracks()[5].id,{gain:0.6}); setTimeout(()=>GNNGlitch.fire('tape_stop',performance.now()),1500)"),
            ('voice cut (skip)', 8, "for(let i=0;i<3;i++) setTimeout(()=>GNNDirector.skip(), i*2000)"),
            ('commercial break', 22, "GNNDirector.forceBreak()"),
            ('mixed run', 20, None),
        ]
        for name, dur, action in script:
            label(name)
            if action:
                cdp.eval(action)
            time.sleep(dur)

        st = cdp.eval('({clips:__probe.clips,steps:__probe.steps,peak:__probe.peak,'
                      'blocks:__probe.blocks,maxStep:__probe.maxStep,'
                      'worstRatio:__probe.worstRatio,events:__probe.events})')
        per = {}
        for e in st['events']:
            d = per.setdefault(e['label'], {'clips': 0, 'steps': 0, 'peak': 0, 'maxStep': 0})
            d['clips'] += e['clips']; d['steps'] += e['steps']
            d['peak'] = max(d['peak'], e['peak']); d['maxStep'] = max(d['maxStep'], e['maxStep'])
        print('\n%-20s %8s %8s %7s %8s' % ('segment', 'clips', 'pops', 'peak', 'maxStep'))
        for name, _d, _a in script:
            d = per.get(name)
            if d:
                print('%-20s %8d %8d %7.3f %8.3f'
                      % (name, d['clips'], d['steps'], d['peak'], d['maxStep']))
            else:
                print('%-20s %8s %8s %7s %8s' % (name, '-', '-', '-', '-'))
        print('\ntotal: %d clipped samples, %d pops, peak %.3f, worst jump %.1fx '
              'local roughness, %d blocks'
              % (st['clips'], st['steps'], st['peak'], st['worstRatio'], st['blocks']))
    finally:
        drive.shutdown(cdp)


if __name__ == '__main__':
    main()
