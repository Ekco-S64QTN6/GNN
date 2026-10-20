#!/usr/bin/env python3
import argparse
import html
import json
import os
import re
import struct
import sys
import time

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lbx
import extract_moo2

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOO2 = os.path.join(ROOT, 'Master of Orion 1', 'mastori2')
PMAP = os.path.join(ROOT, 'tools', 'palette_map.json')
MANIFEST = os.path.join(ROOT, 'assets', 'gfx-manifest.json')
OUT = os.path.join(ROOT, 'tools', 'palette_review')

TILE = 96
RUNNING = 'RUNNING'
_USE_MAP_OVERRIDE = object()


def candidates():
    out = []
    for src in extract_moo2.PALETTE_SOURCES:
        path = os.path.join(MOO2, src + '.LBX')
        if not os.path.exists(path):
            continue
        try:
            ar = lbx.LbxArchive(path)
            max_idx = len(ar) - 1
        except Exception:
            max_idx = 13
            
        for n in range(1, max_idx + 1):
            try:
                pal = lbx.get_moo2_palette(path, n)
            except Exception:
                continue
            if not pal:
                continue
            ref = n if src == 'FONTS' else '%s:%d' % (src, n)
            out.append((ref, '%s %d' % ('F' if src == 'FONTS' else 'IF', n), pal))
    return out


def _lookup_ranges(ranges, idx):
    for lo, hi, val in ranges:
        if lo <= idx <= hi:
            return val
    return None


_RUNNING_CACHE = {}


def _running_palette(ar, idx, base_ref, palette_for):
    key = (getattr(ar, 'path', id(ar)), idx, str(base_ref))
    if key in _RUNNING_CACHE:
        return dict(_RUNNING_CACHE[key])
    base = dict(palette_for(base_ref))
    for k in range(idx):
        try:
            it = lbx.GfxItem(ar.item(k), format='moo2')
        except Exception:
            continue
        if extract_moo2.is_palette_holder(it):
            base = it.palette(base)
    _RUNNING_CACHE[key] = dict(base)
    return base


def effective_palette(arch_name, idx, ar, chosen_ref, cfg, palette_for,
                      item_override_idx=_USE_MAP_OVERRIDE, running=False):
    archive_map, default_item, item_pals, item_overrides, splits, pal_overrides = cfg
    split_ref = _lookup_ranges(splits.get(arch_name, []), idx)
    item_ref = item_pals.get(arch_name, {}).get(idx)

    if split_ref is not None:
        base_ref = split_ref
        use_running = False
    elif running:
        base_ref = archive_map.get(arch_name, default_item)
        use_running = True
    elif chosen_ref is not None:
        base_ref = chosen_ref
        use_running = False
    elif item_ref is not None:
        base_ref = item_ref
        use_running = False
    else:
        base_ref = archive_map.get(arch_name, default_item)
        use_running = True

    if use_running:
        effective = _running_palette(ar, idx, base_ref, palette_for)
    else:
        effective = dict(palette_for(base_ref))
    used = base_ref

    chain_idx = _lookup_ranges(pal_overrides.get(arch_name, []), idx)
    if chain_idx is not None and chain_idx != idx and 0 <= chain_idx < len(ar):
        try:
            chain = _custom_internal_palette(lbx.GfxItem(ar.item(chain_idx), format='moo2'))
            if chain is not None:
                effective.update(chain[1])
        except Exception:
            pass

    if item_override_idx is _USE_MAP_OVERRIDE:
        override_idx = item_overrides.get(arch_name, {}).get(idx)
    else:
        override_idx = item_override_idx
    if override_idx is not None and 0 <= override_idx < len(ar):
        try:
            ovr = lbx.GfxItem(ar.item(override_idx), format='moo2')
            if _custom_internal_palette(ovr) is not None:
                effective = ovr.palette(effective)
        except Exception:
            pass

    try:
        it = lbx.GfxItem(ar.item(idx), format='moo2')
        effective = it.palette(effective)
    except Exception:
        pass

    return effective, used


def current_ref(archive, item, cfg, running_applies=False):
    archive_map, default, item_pals, item_overrides, splits, _p = cfg
    override_idx = item_overrides.get(archive, {}).get(item)
    if override_idx is not None:
        return 'SIBLING:%d' % int(override_idx)
    split_ref = _lookup_ranges(splits.get(archive, []), item)
    if split_ref is not None:
        return split_ref
    if item in item_pals.get(archive, {}):
        return item_pals[archive][item]
    return RUNNING


def pooled_ids():
    try:
        m = json.load(open(MANIFEST, encoding='utf-8'))
    except (OSError, ValueError):
        return set()
    ids = set()
    for k, lst in m.items():
        if k.startswith('_') or not isinstance(lst, list):
            continue
        for e in lst:
            if isinstance(e, dict) and e.get('source') == 'moo2' and e.get('pools'):
                ids.add((e['dir'].upper(), int(e['item'])))
    return ids


def load_hero_frames():
    try:
        m = json.load(open(MANIFEST, encoding='utf-8'))
    except (OSError, ValueError):
        return {}
    out = {}
    for k, lst in m.items():
        if k.startswith('_') or not isinstance(lst, list):
            continue
        for e in lst:
            if isinstance(e, dict) and e.get('source') == 'moo2':
                try:
                    out[(e['dir'].upper(), int(e['item']))] = int(e.get('hero', 0))
                except (KeyError, TypeError, ValueError):
                    pass
    return out


CUTS = os.path.join(ROOT, 'assets', 'cutscenes', 'moo2')


def on_air(arch, idx, hero_frame=0):
    for name in (arch, arch.upper()):
        for f in (hero_frame, 0):
            p = os.path.join(CUTS, name, 'item_%02d_frame_%03d.png' % (idx, f))
            if os.path.exists(p):
                try:
                    return Image.open(p).convert('RGBA')
                except OSError:
                    pass
    return None


def tile_of(im):
    if im is None:
        return Image.new('RGB', (TILE, TILE), (12, 12, 14))
    im = im.copy()
    w, h = im.size
    if w <= 0 or h <= 0:
        return Image.new('RGB', (TILE, TILE), (12, 12, 14))

    max_size = TILE - 4
    scale = min(max_size / w, max_size / h)
    nw, nh = max(1, int(round(w * scale))), max(1, int(round(h * scale)))
    if (nw, nh) != im.size:
        im = im.resize((nw, nh), Image.Resampling.NEAREST)

    if im.mode != 'RGBA':
        im = im.convert('RGBA')
    t = Image.new('RGBA', (TILE, TILE), (12, 12, 14, 255))
    t.alpha_composite(im, ((TILE - im.width) // 2, (TILE - im.height) // 2))
    return t.convert('RGB')


def _custom_internal_palette(it):
    pal = it.internal_palette()
    if pal is not None:
        return pal
    table_end = 0x0C + (it.nframes + 1) * 4
    if table_end + 4 > len(it.data):
        return None
    try:
        first_index, count = struct.unpack_from('<HH', it.data, table_end)
    except Exception:
        return None
    if count == 0 or count > 256 or first_index + count > 256:
        return None
    colors_start = table_end + 4
    colors_end = colors_start + count * 4
    if colors_end > len(it.data):
        return None
    colors = {}
    for i in range(count):
        _alpha, r, g, b = it.data[colors_start + i * 4:colors_start + i * 4 + 4]
        colors[first_index + i] = (min(r * 4, 255), min(g * 4, 255), min(b * 4, 255))
    return first_index, colors


def sibling_palettes(ar, limit=5):
    found = []
    for source_idx in range(len(ar)):
        try:
            it = lbx.GfxItem(ar.item(source_idx), format='moo2')
            embedded = _custom_internal_palette(it)
            if embedded is None:
                continue
            found.append((len(found), source_idx, embedded[1]))
            if len(found) >= limit:
                break
        except Exception:
            continue
    return found


def strip_for(item, arch_name, idx, ar, cands, cur, now, cfg, palette_for,
              hero_frame=0, sibling_pals=None, flags=0):
    sibling_pals = sibling_pals or []
    ncols = 2 + len(sibling_pals) + len(cands)
    row = Image.new('RGB', (ncols * (TILE + 2), TILE + 14), (26, 28, 33))
    d = ImageDraw.Draw(row)
    renders = []
    col = 0

    def put_tile(col_idx, im, label, outline=None, label_color=(190, 190, 190)):
        x = col_idx * (TILE + 2)
        if im is not None:
            row.paste(tile_of(im), (x, 0))
        if outline:
            d.rectangle((x, 0, x + TILE - 1, TILE - 1), outline=outline, width=2)
        d.text((x + 2, TILE + 1), label, fill=label_color)

    # Use middle frame for animations (explosions)
    preview_frame = item.nframes // 2 if item and item.nframes > 1 else hero_frame

    put_tile(col, now, 'ON AIR', outline=(120, 200, 255), label_color=(120, 200, 255))
    if now is not None:
        try: renders.append(now.convert('RGB').tobytes())
        except Exception: pass
    col += 1

    run_img = None
    if item is not None:
        try:
            running_pal, _ = effective_palette(arch_name, idx, ar, None, cfg, palette_for, item_override_idx=None, running=True)
            rgba, _ = item.render_rgba(preview_frame, running_pal)
            run_img = Image.frombytes('RGBA', (item.w, item.h), bytes(rgba))
            renders.append(rgba)
        except Exception: pass
    put_tile(col, run_img, 'RUN', outline=(255, 210, 60) if cur == RUNNING else None, label_color=(160, 200, 255))
    col += 1

    choices = [RUNNING]
    for slot, source_idx, _spal in sibling_pals:
        sib_img = None
        if item is not None:
            try:
                merged, _ = effective_palette(arch_name, idx, ar, None, cfg, palette_for, item_override_idx=source_idx)
                rgba, _ = item.render_rgba(preview_frame, merged)
                sib_img = Image.frombytes('RGBA', (item.w, item.h), bytes(rgba))
                renders.append(rgba)
            except Exception: pass
        choice = 'SIBLING:%d' % source_idx
        choices.append(choice)
        put_tile(col, sib_img, 'S%d' % slot, outline=(255, 210, 60) if cur == choice else None, label_color=(255, 180, 180))
        col += 1

    cand_renders = []
    for ref, label, _pal in cands:
        cand_img = None
        try:
            merged, _ = effective_palette(arch_name, idx, ar, ref, cfg, palette_for)
            if item is not None:
                rgba, _ = item.render_rgba(preview_frame, merged)
                cand_img = Image.frombytes('RGBA', (item.w, item.h), bytes(rgba))
                cand_renders.append(rgba)
        except Exception: pass
        choices.append(ref)
        put_tile(col, cand_img, label, outline=(255, 210, 60) if ref == cur else None)
        col += 1

    renders.extend(cand_renders)
    matters = len(set(bytes(r) for r in renders)) > 1
    return row, matters, choices


_holder_cache = {}

def holders_in(arch):
    if arch in _holder_cache:
        return _holder_cache[arch]
    found = False
    try:
        ar = lbx.LbxArchive(os.path.join(MOO2, arch + '.LBX'))
        for i in range(len(ar)):
            try:
                it = lbx.GfxItem(ar.item(i), format='moo2')
            except Exception:
                continue
            if it.plausible() and extract_moo2.is_palette_holder(it):
                found = True
                break
    except Exception:
        pass
    _holder_cache[arch] = found
    return found


def make_palette_for(moo2_dir, palette_archive='FONTS'):
    fonts_path = os.path.join(moo2_dir, palette_archive + '.LBX')
    cache = {}
    def palette_for(ref):
        norm = extract_moo2.parse_palette_ref(ref)
        if norm is None:
            raise lbx.LbxError('palette reference %r is not usable' % (ref,))
        if isinstance(norm, str):
            src, _, num = norm.partition(':')
            path, n = os.path.join(moo2_dir, src + '.LBX'), int(num)
        else:
            path, n = fonts_path, norm
        key = (path, n)
        if key not in cache:
            cache[key] = lbx.get_moo2_palette(path, n)
        return cache[key]
    return palette_for


def build(args):
    cfg = extract_moo2.load_palette_map(PMAP)
    archive_mode = bool(args.archive)
    cands = candidates()
    palette_for = make_palette_for(MOO2)
    hero_frames = load_hero_frames()

    queue = []
    sibling_cache = {}
    if archive_mode:
        for arch in args.archive.upper().split(','):
            path = os.path.join(MOO2, arch + '.LBX')
            if not os.path.exists(path):
                continue
            try:
                ar = lbx.LbxArchive(path)
            except Exception:
                continue
            sibling_cache[arch] = sibling_palettes(ar)
            for i in range(len(ar)):
                queue.append((arch, i, 0.0))
    else:
        import palette_fit
        pm = json.load(open(PMAP, encoding='utf-8'))
        names = sorted(k for k in pm if not k.startswith('_') and not k.startswith('TANM_'))
        pooled = None if args.all else pooled_ids()
        for arch in names:
            flagged, _ = palette_fit.outliers(arch, None, args.z)
            for idx, score, _d in flagged:
                if pooled is not None and (arch, idx) not in pooled:
                    continue
                queue.append((arch, idx, score))
        queue.sort(key=lambda t: (t[0], t[1]))

    os.makedirs(OUT, exist_ok=True)
    rows, n = [], 0
    for arch, idx, score in queue:
        path = os.path.join(MOO2, arch + '.LBX')
        try:
            ar = lbx.LbxArchive(path)
        except Exception:
            continue
        try:
            item = lbx.GfxItem(ar.item(idx), format='moo2')
        except Exception:
            item = None

        if not archive_mode:
            if item is None or not item.plausible() or not item.nframes or item.w < 8 or item.h < 8:
                continue

        pals = sibling_cache.get(arch)
        if pals is None:
            if arch not in sibling_cache:
                try:
                    sibling_cache[arch] = sibling_palettes(ar)
                except Exception:
                    sibling_cache[arch] = []
            pals = sibling_cache[arch]

        hero = hero_frames.get((arch, idx), 0)
        cur = current_ref(arch, idx, cfg)
        img = '%s_%03d.png' % (arch, idx)
        flags = item.flags if item else 0
        
        strip, matters, choices = strip_for(
            item, arch, idx, ar, cands, cur, on_air(arch, idx, hero),
            cfg, palette_for, hero_frame=hero, sibling_pals=pals, flags=flags)
        if not archive_mode and not matters:
            continue
        strip.save(os.path.join(OUT, img))
        rows.append((arch, idx, score, cur, img, holders_in(arch), len(pals), choices, flags))
        n += 1
        if args.max and n >= args.max:
            break

    cache_bust = int(time.time())
    rows.sort(key=lambda r: (r[5], r[0], r[1]))
    page_rows = []
    for arch, idx, score, cur, img, hold, num_sibs, choices, flags in rows:
        cur_str = cur if isinstance(cur, str) else str(cur)
        tiles = 2 + num_sibs + len(cands)
        choice_json = html.escape(json.dumps(choices, separators=(',', ':')), quote=True)
        
        flag_str = f" [Flags: {hex(flags)}]"
        if flags & 0x1000: flag_str += " INT_PAL"
        
        page_rows.append(
            '<div class="row" data-arch="%s" data-item="%d" data-cur="%s" data-choices="%s">'
            '<div class="hd">%s / item %d%s%s%s <span class="pick"></span></div>'
            '<div class="img-wrap"><img src="%s?v=%d" width="%d" height="%d" alt="Palette candidates"></div></div>'
            % (html.escape(arch, quote=True), idx, html.escape(cur_str, quote=True), choice_json,
               html.escape(arch), idx,
               (' &nbsp;<span class="z">z=%.1f</span>' % score) if score else '',
               (' &nbsp;<span class="warn">palette-holder archive</span>') if hold else '',
               f' &nbsp;<span class="diag">{flag_str}</span>',
               img, cache_bust, tiles * (TILE + 2), TILE + 14)
        )
    page = PAGE.replace('@@ROWS@@', '\n'.join(page_rows))
    page = page.replace('@@STEP@@', str(TILE + 2)).replace('@@COUNT@@', str(len(rows)))
    with open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8') as fh:
        fh.write(page)
    print('%d items queued -> %s' % (len(rows), os.path.join(OUT, 'index.html')))
    return 0

def apply(path):
    with open(path, encoding='utf-8') as fh:
        picks = json.load(fh)
    with open(PMAP, encoding='utf-8') as fh:
        pm = json.load(fh)
    cfg = extract_moo2.load_palette_map(PMAP)
    item_pals = pm.setdefault('_item_palettes', {})
    item_overrides = pm.setdefault('_item_overrides', {})
    changed, touched = 0, set()

    def remove_item_entry(section, arch, item_no):
        nonlocal changed
        bucket = section.get(arch)
        if not isinstance(bucket, dict):
            return False
        key = str(item_no)
        if key not in bucket and item_no not in bucket:
            return False
        bucket.pop(key, None)
        bucket.pop(item_no, None)
        changed += 1
        return True

    for key, ref in sorted(picks.items()):
        arch, _, item = key.rpartition('/')
        arch = arch.upper()
        if not arch: continue
        try: item_no = int(item)
        except (TypeError, ValueError): continue

        if ref == RUNNING:
            did_change = remove_item_entry(item_pals, arch, item_no)
            did_change = remove_item_entry(item_overrides, arch, item_no) or did_change
            if did_change: touched.add(arch)
            continue

        match = re.fullmatch(r'SIBLING:(\d+)', str(ref))
        if match:
            sibling_idx = int(match.group(1))
            if sibling_idx < 0: continue
            bucket = item_overrides.setdefault(arch, {})
            skey = str(item_no)
            if bucket.get(skey) != sibling_idx:
                bucket[skey] = sibling_idx
                changed += 1
                touched.add(arch)
            continue

        norm = extract_moo2.parse_palette_ref(ref)
        if norm is None:
            continue

        in_split = _lookup_ranges(cfg[4].get(arch, []), item_no) is not None
        if in_split:
            continue

        archive_ref = cfg[0].get(arch, cfg[1])
        bucket = item_pals.setdefault(arch, {})
        skey = str(item_no)
        if norm == archive_ref:
            if skey in bucket:
                del bucket[skey]
                changed += 1
                touched.add(arch)
            continue
        if bucket.get(skey) != norm:
            bucket[skey] = norm
            changed += 1
            touched.add(arch)

    for table in (item_pals, item_overrides):
        for arch in list(table):
            if not arch.startswith('_') and isinstance(table[arch], dict) and not table[arch]:
                del table[arch]
    with open(PMAP, 'w', encoding='utf-8') as fh:
        json.dump(pm, fh, indent=2)
        fh.write('\n')
    print('%d palette-map entries changed.' % changed)
    if touched:
        print('Re-extract with:\n  python3 tools/extract_moo2.py --only %s' % ','.join(sorted(touched)))
    return 0


PAGE = r'''<!doctype html><html><head><meta charset="utf-8">
<title>Palette review</title>
<style>
body{background:#16181c;color:#d8d8d8;font:13px/1.4 system-ui,sans-serif;margin:16px}
h1{font-size:16px;margin:0 0 4px} p{color:#9aa;margin:0 0 12px;max-width:1050px}
.bar{position:sticky;top:0;background:#16181c;padding:8px 0;z-index:2;border-bottom:1px solid #333;margin-bottom:10px}
button{background:#2b3240;color:#eee;border:1px solid #445;padding:6px 12px;border-radius:4px;cursor:pointer}
.row{margin:0 0 14px}.hd{margin:0 0 3px;color:#ccc}.z{color:#777}.diag{color:#ff6b6b;font-family:monospace;}
.pick{color:#7fdc8a;font-weight:600}
.img-wrap { width: 100%; overflow-x: auto; padding-bottom: 8px; }
.img-wrap img { max-width: none; cursor: crosshair; image-rendering: pixelated; display: block; }
.row.done .hd{color:#7fdc8a}.warn{color:#e0a050}.run{color:#8fc4ff}
</style></head><body>
<div class="bar">
<h1>Palette review — @@COUNT@@ items</h1>
<p>Scroll left/right inside a row if options are cut off. Click the tile that looks correct. <b>Note: For animations (CMBTSFX), the tool now renders the middle frame so you can see the actual effect instead of an empty canvas.</b></p>
<button id="save">Save palette-picks.json</button>
<button id="clear">Clear all</button>
<span id="count"></span>
</div>
@@ROWS@@
<script>
const STEP=@@STEP@@, KEY='gnn.palettePicks';
let picks={}; try{picks=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
function label(r){
 if(r==='RUNNING')return 'RUN';
 if(typeof r==='string'&&r.startsWith('SIBLING:'))return 'SIBLING item '+r.slice(8);
 if(typeof r==='string'&&r.startsWith('IFONTS:'))return 'IF '+r.slice(7);
 if(typeof r==='string'&&r.startsWith('FONTS:'))return 'F '+r.slice(6);
 if(typeof r==='number')return 'F '+r;
 return String(r);
}
function store(){try{localStorage.setItem(KEY,JSON.stringify(picks))}catch(e){}
 document.getElementById('count').textContent=' '+Object.keys(picks).length+' chosen';}
function paint(row){const k=row.dataset.arch+'/'+row.dataset.item,p=picks[k];
 row.querySelector('.pick').textContent=p===undefined?'':'→ '+label(p);
 row.classList.toggle('done',p!==undefined);}
document.querySelectorAll('.row').forEach(row=>{paint(row);
 row.querySelector('img').addEventListener('click',ev=>{
  const r=ev.currentTarget.getBoundingClientRect();
  const col=Math.floor((ev.clientX-r.left)/STEP);
  if(col<1)return;
  let choices=[];try{choices=JSON.parse(row.dataset.choices||'[]')}catch(e){}
  const choice=choices[col-1];if(choice===undefined)return;
  const k=row.dataset.arch+'/'+row.dataset.item;
  if(picks[k]===choice)delete picks[k];else picks[k]=choice;
  paint(row);store();
 });});
document.getElementById('save').onclick=()=>{
 const b=new Blob([JSON.stringify(picks,null,1)],{type:'application/json'});
 const a=document.createElement('a');a.href=URL.createObjectURL(b);
 a.download='palette-picks.json';a.click();URL.revokeObjectURL(a.href);};
document.getElementById('clear').onclick=()=>{if(confirm('Clear every choice?')){
 picks={};store();document.querySelectorAll('.row').forEach(paint);}};
store();
</script></body></html>'''

def main():
    ap = argparse.ArgumentParser(description='Review MoO2 palettes.')
    ap.add_argument('--apply', metavar='PICKS_JSON')
    ap.add_argument('--archive', help='review whole archives, comma-separated')
    ap.add_argument('--all', action='store_true', help='Include outliers that are in no pool')
    ap.add_argument('--z', type=float, default=2.5)
    ap.add_argument('--max', type=int, default=0)
    args = ap.parse_args()
    if args.apply:
        return apply(args.apply)
    return build(args)


if __name__ == '__main__':
    raise SystemExit(main())