import base64, io, json, sys, time
sys.path.insert(0, '/home/ekco/github/GNN/tools')
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
    cdp.send('Page.navigate', url=drive.URL)
    for _ in range(90):
        time.sleep(1)
        try:
            if cdp.eval('!!window.GNNBootReady'): break
        except Exception: pass
    time.sleep(8)
    cat = json.loads(cdp.eval('JSON.stringify(GNNGlitch.catalogue())'))
    names = sys.argv[2].split(',') if len(sys.argv) > 2 else cat['anomalies'] + cat['rare']
    shots = []
    for n in names:
        cdp.eval("GNNGlitch.fire('%s', performance.now(), {ms: 3000})" % n)
        time.sleep(1.2)
        d = cdp.send('Page.captureScreenshot', format='jpeg', quality=65)['data']
        shots.append((n, Image.open(io.BytesIO(base64.b64decode(d))).convert('RGB')))
        time.sleep(2.2)
    tw = 300; th = shots[0][1].height * tw // shots[0][1].width
    cols = 5; rows = (len(shots) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * (tw + 4), rows * (th + 18)), (12, 12, 14))
    dr = ImageDraw.Draw(sheet)
    for i, (n, im) in enumerate(shots):
        x = (i % cols) * (tw + 4); y = (i // cols) * (th + 18)
        sheet.paste(im.resize((tw, th)), (x, y + 16)); dr.text((x + 2, y + 2), n, fill=(255, 220, 120))
    out = S + ('/faults2.png' if len(sys.argv) > 2 else '/faults.png')
    sheet.save(out); print('sheet', out, sheet.size, len(shots), 'faults')
    print('page errors:', json.loads(cdp.eval('JSON.stringify(window.__errs)')))
finally:
    drive.shutdown(cdp)
