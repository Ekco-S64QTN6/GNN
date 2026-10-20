"""Contact-sheet every product still on the stage it actually airs on.

The commercial tables (PRODUCT_SLOT, PRODUCT_IMAGES, INFOMERCIAL_SCENES) are
read out of js/cutscene-manager.js, each product's stage is resolved the way
loadStage() does (first plate on disk, then the spot's fallback), and the
product is composited with compositeProduct()'s arithmetic: fit inside the
slot, centred across it, standing on its bottom edge. Look at the sheets — a
slot whose bottom edge is not the surface makes every product on that set
float or sink. Offline; safe while on air.

    python3 tools/tests/productsheet.py [outdir]
"""
TABLES_JS = r"""
// Pull the commercial tables out of cutscene-manager.js's IIFE without running it.
const fs = require('fs');
const src = fs.readFileSync('js/cutscene-manager.js', 'utf8');
function grab(name) {
  const i = src.indexOf('const ' + name + ' = {');
  let depth = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') depth++; else if (src[k] === '}') { depth--; if (!depth) return src.slice(j, k + 1); } }
}
const P = 'assets/generated/infomercials/';
const out = {
  slots: eval('(' + grab('PRODUCT_SLOT') + ')'),
  images: eval('(' + grab('PRODUCT_IMAGES') + ')'),
  scenes: eval('(' + grab('INFOMERCIAL_SCENES') + ')'),
};
console.log(JSON.stringify(out));
"""
import json, os, glob, random, subprocess, sys
from PIL import Image, ImageDraw, ImageFilter
OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '/tmp/gnn-productsheet')
os.makedirs(OUT, exist_ok=True)
os.chdir(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
t = json.loads(subprocess.run(['node', '-e', TABLES_JS], capture_output=True, text=True, check=True).stdout)
P = 'assets/generated/infomercials/'
# The sponsors' stages live in script-writer.js (SPONSORS); repeated here for
# the products that have a still. Keep in step if a sponsor's set changes.
SPONSOR_STAGE = {'Jump-Sickness Relief Tablets': 'pharmacy_med_bay', 'Cryosleep Recovery Tonic': 'pharmacy_med_bay',
                 'Radiation Shield Supplement': 'pharmacy_med_bay', 'Starlance Jump Drive': 'hyperspace_bridge',
                 'Mark Four Warp Coil': 'hyperspace_bridge', 'Quiet-Run Navigation Core': 'hyperspace_bridge'}
combos = []
for prod, img in t['images'].items():
    if prod in SPONSOR_STAGE:
        cands = [P + SPONSOR_STAGE[prod] + '.png']
    else:
        v = t['scenes'].get(prod)
        cands = (v if isinstance(v, list) else [v] if v else [])
        cands = cands + [P + 'galaxy_shop_stage.png', P + 'legal_office.png']
    stage = next((c for c in cands if os.path.exists(c)), None)
    combos.append((prod, stage, img))
# generator hardware and a few salvage lots, on the pedestal
for f in ['tachyon_deflector_coil', 'tachyon_energy_cell', 'navigation_computer', 'thermal_survival_envelope', 'mrrshan_hunting_optics']:
    combos.append(('generator: ' + f, P + 'galaxy_shop_pedestal.png', 'assets/generated/products/%s.png' % f))
random.seed(3)
for f in random.sample(sorted(glob.glob('assets/cutscenes/moo2/APP_PICS/*_frame_000.png')), 3):
    combos.append(('salvage ' + os.path.basename(f)[:7], P + 'galaxy_shop_pedestal.png', f))

def comp(stage, prod, slot):
    st = Image.open(stage).convert('RGBA').resize((1280, 720))
    pr = Image.open(prod).convert('RGBA')
    sx, sy, sw, sh = slot['x'] * 1280, slot['y'] * 720, slot['w'] * 1280, slot['h'] * 720
    s = min(sw / pr.width, sh / pr.height); pw, ph = int(pr.width * s), int(pr.height * s)
    px = int(sx + (sw - pw) / 2); py = int(sy + sh - ph)
    m = Image.new('L', (1280, 720), 0); d = ImageDraw.Draw(m)
    cx, cy, rx, ry = px + pw / 2, py + ph - ph * 0.03, pw * 0.55, ph * 0.07
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=110); m = m.filter(ImageFilter.GaussianBlur(6))
    st = Image.composite(Image.new('RGBA', (1280, 720), (0, 0, 0, 255)), st, m)
    st.alpha_composite(pr.resize((max(1, pw), max(1, ph))), (px, py))
    return st.convert('RGB').resize((480, 270))

shown = [(p, s, i) for p, s, i in combos if s and s in t['slots'] and os.path.exists(i)]
noslot = [(p, s) for p, s, i in combos if s and s not in t['slots']]
print('composited:', len(shown), ' stage without slot (no product drawn):', len(noslot))
for p, s in noslot: print('   ', p, '->', os.path.basename(s))
cols = 4
for page in range(0, len(shown), 16):
    chunk = shown[page:page + 16]
    sheet = Image.new('RGB', (cols * 480, ((len(chunk) + cols - 1) // cols) * 290), (20, 20, 20)); dr = ImageDraw.Draw(sheet)
    for k, (p, s, i) in enumerate(chunk):
        x, y = (k % cols) * 480, (k // cols) * 290
        sheet.paste(comp(s, i, t['slots'][s]), (x, y))
        dr.text((x + 4, y + 272), '%d %s | %s' % (page + k, p[:34], os.path.basename(s)[:24]), fill=(255, 255, 0))
    sheet.save(os.path.join(OUT, 'products_%d.png' % (page // 16)))
    print('wrote', os.path.join(OUT, 'products_%d.png' % (page // 16)))
