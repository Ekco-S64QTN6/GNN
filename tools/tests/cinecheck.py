import base64, io, json, sys, time
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # repo root
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import drive
from PIL import Image, ImageDraw
S = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
cdp = None
drive.launch()
try:
    cdp = drive.CDP(drive.ws_url())
    cdp.send('Page.enable'); cdp.send('Runtime.enable')
    cdp.send('Page.addScriptToEvaluateOnNewDocument', source=
        "window.__errs=[];window.addEventListener('error',e=>window.__errs.push(String(e.message)));")
    cdp.send('Page.navigate', url=drive.URL + '?cutaways=footage')
    for _ in range(90):
        time.sleep(1)
        try:
            if cdp.eval('!!window.GNNBootReady'): break
        except Exception: pass
    stories = [
        ('Unexplained anomaly signal detected beyond the rift', 'Astronomers cannot explain the source of the anomaly.'),
        ('Fleet convoy arrives at Vega after long transit', 'The convoy of freighters docked without incident.'),
        ('Planetary defences destroyed in orbital battle', 'The attack left the planet exposed to bombardment.'),
    ]
    rows = []
    for title, desc in stories:
        story = json.dumps({'title': title, 'description': desc})
        kind = cdp.eval('GNNCutsceneManager.routeFor(%s)' % story)
        cdp.eval('GNNCutsceneManager.endCutaway&&GNNCutsceneManager.endCutaway()')
        cdp.eval('window.__ok=null;GNNCutsceneManager.prefetch(%s).then(()=>GNNCutsceneManager.triggerCutaway(%s,performance.now())).then(r=>window.__ok=r)' % (story, story))
        for _ in range(40):
            time.sleep(0.25)
            if cdp.eval('window.__ok!==null'): break
        frames = []
        for _ in range(4):
            d = cdp.send('Page.captureScreenshot', format='jpeg', quality=70)['data']
            frames.append(Image.open(io.BytesIO(base64.b64decode(d))).convert('RGB'))
            time.sleep(1.4)
        print('%-9s ok=%s' % (kind, cdp.eval('String(window.__ok)')), title[:46])
        rows.append((kind, frames))
    print('page errors:', json.loads(cdp.eval('JSON.stringify(window.__errs)')))
    W = frames[0].width; H = frames[0].height
    # crop to the right-hand monitor region generously
    box = (int(W * 0.70), int(H * 0.04), int(W * 0.99), int(H * 0.36))
    tw = box[2] - box[0]; th = box[3] - box[1]
    sheet = Image.new('RGB', (4 * (tw + 6), len(rows) * (th + 20)), (14, 14, 16))
    d = ImageDraw.Draw(sheet)
    for r, (kind, fr) in enumerate(rows):
        d.text((4, r * (th + 20) + 3), str(kind), fill=(255, 220, 120))
        for c, f in enumerate(fr):
            sheet.paste(f.crop(box), (c * (tw + 6), r * (th + 20) + 16))
    sheet.save(S + '/cine_live.png'); print('sheet', sheet.size)
finally:
    drive.shutdown(cdp)
