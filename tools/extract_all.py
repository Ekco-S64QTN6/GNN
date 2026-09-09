#!/usr/bin/env python3
"""
extract_all.py — decode every Master of Orion 1 LBX graphics archive into
RGBA PNG frame sequences + animated GIFs, and emit a machine-readable
manifest describing what each asset actually looks like.

The manifest is what lets the broadcast engine use *every* asset: each entry
carries real dimensions, frame count, coverage, brightness and a derived
"role" (fullscreen / portrait / panel / sprite / chrome / strip / blank) so the
runtime can decide whether an item is a backdrop, an overlay sprite, a HUD
plate or a decorative strip instead of guessing from folder names.
"""

import json
import os
import struct
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lbx import LbxArchive, GfxItem  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'Master of Orion 1', 'data')
OUT = os.path.join(ROOT, 'assets', 'cutscenes')

# Archives that hold newsroom-grade artwork. NEWSCAST/MISSILE/STARMAP/TECHNO/
# DESIGN/V11 were never pulled out of the carcass before this pass.
ARCHIVES = [
    'BACKGRND', 'COLONIES', 'COUNCIL', 'DESIGN', 'EMBASSY', 'INTRO', 'INTRO2',
    'LANDING', 'MISSILE', 'NEBULA', 'NEWSCAST', 'PLANETS', 'SCREENS', 'SHIPS',
    'SHIPS2', 'SPACE', 'SPIES', 'STARMAP', 'STARVIEW', 'TECHNO', 'VORTEX',
    'WINLOSE',
]

MAX_GIF_FRAMES = 120


def require_source():
    """The extractors are the only thing that needs the original game data."""
    if not os.path.isdir(DATA):
        sys.stderr.write(
            'Master of Orion 1 source data not found at:\n  %s\n\n'
            'This script only regenerates assets/ from the original .LBX\n'
            'archives. The broadcast itself needs nothing but assets/ —\n'
            'run "python3 tools/verify_assets.py" to confirm.\n' % DATA)
        raise SystemExit(2)


def base_palette():
    """WINLOSE item 0 carries the game's full 256-colour VGA table."""
    arc = LbxArchive(os.path.join(DATA, 'WINLOSE.LBX'))
    return GfxItem(arc.item(0)).palette()


def classify(w, h, nframes, coverage, mean_lum, distinct, noise):
    if coverage < 0.02 or distinct <= 2:
        return 'blank'
    # A handful of items were authored against screen palettes the archives do
    # not carry. They decode structurally correct but chromatically scrambled,
    # so they are tagged for deliberate reuse as transmission-interference
    # footage rather than being thrown away.
    if noise > 150 and coverage > 0.55 and distinct >= 48:
        return 'noise'
    if w >= 300 and h >= 180:
        return 'fullscreen'
    if w >= 120 and h >= 90:
        return 'panel'
    if h >= 120 and w < 120:
        return 'portrait'
    if w <= 16 or h <= 16:
        return 'chrome'
    if w / max(h, 1) > 6 or h / max(w, 1) > 6:
        return 'strip'
    if max(w, h) <= 64:
        return 'sprite'
    return 'panel'


def render(item, palette):
    """Yield RGBA PIL images for every frame of a gfx item."""
    w, h = item.w, item.h
    local = dict(palette)
    local.update(item.palette())
    lut = bytearray(256 * 4)
    for i in range(256):
        r, g, b = local.get(i, (0, 0, 0))
        lut[i * 4:i * 4 + 4] = bytes((r, g, b, 0 if i == 0 else 255))
    for buf, _clean in item.frames():
        raw = bytearray(w * h * 4)
        for p, idx in enumerate(buf):
            raw[p * 4:p * 4 + 4] = lut[idx * 4:idx * 4 + 4]
        yield Image.frombytes('RGBA', (w, h), bytes(raw))


def measure(img):
    """coverage, mean luminance, distinct colours, horizontal chroma noise."""
    px = img.load()
    w, h = img.size
    step = max(1, (w * h) // 4000)
    n = opaque = lum = 0
    seen = set()
    for p in range(0, w * h, step):
        r, g, b, a = px[p % w, p // w]
        n += 1
        if a:
            opaque += 1
            lum += (r * 299 + g * 587 + b * 114) // 1000
            if len(seen) < 64:
                seen.add((r, g, b))
    delta = pairs = 0
    for y in range(0, h, max(1, h // 40)):
        prev = None
        for x in range(0, w, max(1, w // 60)):
            r, g, b, a = px[x, y]
            if a and prev:
                delta += abs(r - prev[0]) + abs(g - prev[1]) + abs(b - prev[2])
                pairs += 1
            prev = (r, g, b) if a else None
    if not n:
        return 0.0, 0, 0, 0
    return (opaque / n, (lum // opaque if opaque else 0), len(seen),
            delta // max(pairs, 1))


# NEWSCAST.LBX is the studio itself. These are the plates index.html loads
# directly, so they are written to assets/ under the names the renderer and
# icon-manager expect, from the same decoder as everything else.
NEWSROOM = {
    0: ('background_tv.png', 3),      # studio chassis, stored at 3x
    2: ('anchor_frame_%03d.png', 1),  # 25-cel talking anchor
    3: ('globe_frame_%03d.png', 1),   # 25-cel holographic globe
}
ICON_ITEMS = range(4, 26)             # 22 over-the-shoulder story icons


def export_newsroom(palette):
    """Write the plates the page loads by name, not through the manifest."""
    arc = LbxArchive(os.path.join(DATA, 'NEWSCAST.LBX'))
    out_dir = os.path.join(ROOT, 'assets')
    icon_dir = os.path.join(out_dir, 'icons')
    os.makedirs(icon_dir, exist_ok=True)
    written = 0

    for item_idx, (pattern, scale) in NEWSROOM.items():
        item = GfxItem(arc.item(item_idx))
        for fi, img in enumerate(render(item, palette)):
            if scale != 1:
                img = img.resize((img.width * scale, img.height * scale),
                                 Image.NEAREST)
            name = pattern % (fi + 1) if '%' in pattern else pattern
            img.convert('RGB' if item_idx == 0 else 'RGBA') \
               .save(os.path.join(out_dir, name))
            written += 1
            if '%' not in pattern:
                break

    for i in ICON_ITEMS:
        item = GfxItem(arc.item(i))
        frames = list(render(item, palette))
        if frames:
            frames[0].save(os.path.join(icon_dir, 'chunk_%03d_frame_000.png' % i))
            written += 1
    return written


def main():
    require_source()
    palette = base_palette()
    manifest = {}
    totals = {'items': 0, 'frames': 0, 'gifs': 0}

    for name in ARCHIVES:
        path = os.path.join(DATA, name + '.LBX')
        if not os.path.exists(path):
            continue
        arc = LbxArchive(path)
        folder = os.path.join(OUT, name)
        os.makedirs(folder, exist_ok=True)
        entries = []

        for i in range(len(arc)):
            item = GfxItem(arc.item(i))
            if not item.plausible():
                continue
            frames = list(render(item, palette))
            if not frames:
                continue
            stem = 'item_%02d' % i
            for fi, img in enumerate(frames):
                img.save(os.path.join(folder, '%s_frame_%03d.png' % (stem, fi)))

            gif = None
            if len(frames) > 1:
                gif = '%s_animation.gif' % stem
                seq = frames[:MAX_GIF_FRAMES]
                delay = 80
                seq[0].save(
                    os.path.join(folder, gif), save_all=True,
                    append_images=seq[1:], loop=0, duration=min(delay, 200),
                    disposal=2, transparency=0, optimize=False)
                totals['gifs'] += 1

            probes = sorted({0, len(frames) // 2, len(frames) - 1})
            stats = [(measure(frames[k]), k) for k in probes]
            (cov, lum, distinct, noise), hero = max(stats, key=lambda t: t[0][0])
            entries.append({
                'id': '%s/%s' % (name, stem),
                'dir': name,
                'item': i,
                'w': item.w,
                'h': item.h,
                'frames': len(frames),
                'gif': gif,
                'coverage': round(cov, 3),
                'lum': lum,
                'colors': distinct,
                'hero': hero,
                'noise': noise,
                'role': classify(item.w, item.h, len(frames), cov, lum,
                                 distinct, noise),
            })
            totals['items'] += 1
            totals['frames'] += len(frames)

        manifest[name] = entries
        roles = {}
        for e in entries:
            roles[e['role']] = roles.get(e['role'], 0) + 1
        print('%-10s %3d items  %4d frames  %s' % (
            name, len(entries), sum(e['frames'] for e in entries), roles))

    plates = export_newsroom(palette)
    print('\nnewsroom plates rewritten: %d' % plates)

    out = os.path.join(ROOT, 'assets', 'gfx-manifest.json')
    with open(out, 'w') as fh:
        json.dump(manifest, fh, separators=(',', ':'))
    print('\n%(items)d items / %(frames)d frames / %(gifs)d gifs' % totals)
    print('manifest ->', out)


if __name__ == '__main__':
    main()
