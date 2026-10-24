"""Level of the anchor only, tagged by the engine's own speaking flag."""
import sys, time
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # repo root
sys.path.insert(0,os.path.join(ROOT, 'tools'))
import drive
import numpy as np

TAP = """
(() => {
  const ctx = GNNAudio.getContext(); if (!ctx) return 'no ctx';
  if (window.__lv) return 'already';
  const sp = ctx.createScriptProcessor(4096, 2, 2);
  const sink = ctx.createGain(); sink.gain.value = 0;
  const st = { f: [], peak: 0, clips: 0 };
  sp.onaudioprocess = (e) => {
    const d = e.inputBuffer.getChannelData(0);
    let s = 0, pk = 0, c = 0;
    for (let i = 0; i < d.length; i++) {
      const v = d[i], a = Math.abs(v);
      s += v*v; if (a > pk) pk = a; if (a >= 0.999) c++;
    }
    // tag each frame with whether the anchor was talking during it
    st.f.push([Math.sqrt(s/d.length), GNNTTS.isSpeaking() ? 1 : 0]);
    if (pk > st.peak) st.peak = pk;
    st.clips += c;
  };
  GNNAudio.getMasterBus().connect(sp); sp.connect(sink); sink.connect(ctx.destination);
  window.__lv = st; return 'tapped';
})()
"""

cdp=None; drive.launch()
try:
    cdp=drive.CDP(drive.ws_url()); cdp.send('Page.enable'); cdp.send('Runtime.enable')
    cdp.send('Page.navigate', url=drive.URL); time.sleep(12)
    cdp.send('Input.dispatchMouseEvent', type='mousePressed', x=600,y=880,button='left',clickCount=1)
    cdp.send('Input.dispatchMouseEvent', type='mouseReleased', x=600,y=880,button='left',clickCount=1)
    time.sleep(3)
    print(cdp.eval(TAP), flush=True)
    time.sleep(int(sys.argv[1]) if len(sys.argv)>1 else 170)
    st = cdp.eval("({f:__lv.f,peak:__lv.peak,clips:__lv.clips})")
finally:
    drive.shutdown(cdp)

a=np.array(st['f'],dtype=float); hop=4096/48000.0
rms,spk=a[:,0],a[:,1].astype(bool)
lv=20*np.log10(np.maximum(rms,1e-6))
print('\n%.0f s | peak %.3f | clipped %d' % (len(a)*hop, st['peak'], st['clips']), flush=True)

# contiguous runs where the engine says the anchor is talking
runs=[];s=None
for i,v in enumerate(spk):
    if v and s is None: s=i
    elif not v and s is not None:
        if (i-s)*hop>=0.8: runs.append((s,i))
        s=None
if s is not None and (len(spk)-s)*hop>=0.8: runs.append((s,len(spk)))

lvls=[]
print('\n%8s %6s %10s' % ('span','len','speech lvl'))
for s0,e0 in runs:
    seg=lv[s0:e0]
    seg=seg[seg>-50]
    if len(seg)<6: continue
    # 80th percentile ~ the level of actual speech, ignoring internal pauses
    L=float(np.percentile(seg,80)); lvls.append(L)
    print('%7.1fs %5.1fs %9.1f dBFS' % (s0*hop,(e0-s0)*hop,L))
if lvls:
    print('\nANCHOR level spread: %.1f dB across %d lines (min %.1f, max %.1f)'
          % (max(lvls)-min(lvls), len(lvls), min(lvls), max(lvls)))
