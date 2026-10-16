"""Hammer every bus at once and confirm the output cannot pass full scale."""
import sys, time
sys.path.insert(0,'/home/ekco/github/GNN/tools')
import drive, audio_probe
cdp=None; drive.launch()
try:
    cdp=drive.CDP(drive.ws_url()); cdp.send('Page.enable'); cdp.send('Runtime.enable')
    cdp.send('Page.navigate', url=drive.URL); time.sleep(12)
    cdp.send('Input.dispatchMouseEvent', type='mousePressed', x=600,y=880,button='left',clickCount=1)
    cdp.send('Input.dispatchMouseEvent', type='mouseReleased', x=600,y=880,button='left',clickCount=1)
    time.sleep(4)
    print(cdp.eval(audio_probe.PROBE))
    def peak(label, secs):
        cdp.eval("window.__probe.peak=0; window.__probe.clips=0")
        time.sleep(secs)
        r=cdp.eval("({p:__probe.peak,c:__probe.clips})")
        flag = '  *** OVER FULL SCALE' if r['p']>=0.999 else ''
        print('  %-30s peak %.3f  clipped %d%s' % (label, r['p'], r['c'], flag))
        return r
    print('\nstress: everything at once')
    peak('normal broadcast', 10)
    cdp.eval("GNNAudio.playMusic(GNNAssets.musicTracks()[3].id,{gain:1.0,fadeIn:0.2})")
    time.sleep(3)
    peak('+ music at full mix level', 6)
    cdp.eval("""(()=>{for(let i=0;i<10;i++) setTimeout(()=>{
        GNNAudio.playRole('blast',{gain:1.0}); GNNAudio.playRole('siren',{gain:1.0});
        GNNAudio.playKlaxon(); }, i*250);})()""")
    peak('+ 30 stacked one-shots at 1.0', 6)
    cdp.eval("GNNGlitch.fire('carrier_drop', performance.now())")
    peak('+ bitcrush glitch', 5)
    cdp.eval("GNNDirector.forceBreak()")
    time.sleep(2)
    peak('+ commercial break', 14)
finally:
    drive.shutdown(cdp)
