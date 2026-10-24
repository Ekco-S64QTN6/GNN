import base64, json, sys, time
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # repo root
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import drive
S = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
WITH_LOGO = {'Galactic Morning Watch', 'Deep Space Economy', 'Council Crossfire',
             'Deep Survey and Cybernetics', 'The Evening Rim Report', 'Anomaly: Deep Dark'}
cdp = None
drive.launch()
try:
    cdp = drive.CDP(drive.ws_url())
    cdp.send('Page.enable'); cdp.send('Runtime.enable')
    cdp.send('Page.navigate', url=drive.URL)
    for _ in range(90):
        time.sleep(1)
        try:
            if cdp.eval('!!window.GNNBootReady'): break
        except Exception: pass
    cdp.eval("window.__metas=[];window.GNNTranscript=window.GNNTranscript||{};"
             "(function(){const o=window.GNNTranscript.logCommercial;"
             "window.GNNTranscript.logCommercial=function(m){window.__metas.push(m);if(o)try{o(m)}catch(e){}}})()")
    def shot(name):
        d = cdp.send('Page.captureScreenshot', format='png')['data']
        open('%s/%s.png' % (S, name), 'wb').write(base64.b64decode(d)); print('  ->', name)
    def run(kind, times, label):
        for attempt in range(8):
            cdp.eval('GNNCutsceneManager.abortBreak&&GNNCutsceneManager.abortBreak()')
            time.sleep(1)
            n0 = len(json.loads(cdp.eval('JSON.stringify(window.__metas)')))
            cdp.eval("GNNCutsceneManager.startCommercialBreak(performance.now(),{kind:'%s'})" % kind)
            for _ in range(30):
                time.sleep(0.5)
                ms = json.loads(cdp.eval('JSON.stringify(window.__metas)'))
                if len(ms) > n0: break
            m = ms[-1]
            print('%s: %s | %s' % (kind, m['brand'], m['product']))
            if kind not in ('promo','infomercial') or m.get('product') in WITH_LOGO or (kind=='infomercial' and m['product'] in ('Zortrium Exposure Class Action','Long-Haul Certification Programme','Psilon Synaptic Neuro-Elixir','Executive Presence Masterclass','At-Home Hull Patch Kit','Cryosleep Injury Claims','Cybernetic Joint Replacement','Interspecies Companionship Registry')):
                dur = m['durationMs'] / 1000.0
                from PIL import Image
                import io
                frames = []
                t0 = time.time()
                while time.time() - t0 < dur + 1:
                    d = cdp.send('Page.captureScreenshot', format='jpeg', quality=60)['data']
                    frames.append(Image.open(io.BytesIO(base64.b64decode(d))).convert('RGB'))
                    time.sleep(1.1)
                tw = 400
                th = frames[0].height * tw // frames[0].width
                cols = 5
                rows = (len(frames) + cols - 1) // cols
                sheet = Image.new('RGB', (cols * (tw + 4), rows * (th + 4)), (10, 10, 12))
                for i, f in enumerate(frames):
                    sheet.paste(f.resize((tw, th)), ((i % cols) * (tw + 4), (i // cols) * (th + 4)))
                sheet.save('%s/%s_strip.png' % (S, label))
                print('  ->', label, len(frames), 'frames over', round(dur, 1), 's')
                return
    run('sponsor', [], 'sponsor')
    run('infomercial', [], 'info')
finally:
    drive.shutdown(cdp)
