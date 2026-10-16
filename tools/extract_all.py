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

import numpy as np
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

# 320x200 items decode index 0 as opaque black by default. That is correct
# for a fullscreen picture — the game paints the sky, the starfield, the
# space behind the window black and the picture is meant to be
# self-contained. It is wrong for anything that lives on top of a scene
# the game composites at runtime.
#
# Two classes of item in the archive look identical to a fullscreen by
# size but are actually overlays, and each of them was broken by the
# default before being named here:
#
#   SPIES        every item is a 320x200 portrait of a spy doing something
#                (firing a laser, typing at a console, holding a package).
#                The game composites the spy over whatever the spy screen
#                was showing at the time. Decoded opaque, every spy has a
#                solid black card behind it and the studio stops showing
#                through.
#
#   EMBASSY      items 12 through 17 are the player-representative sprites
#                — one per species — that the game composites into the
#                embassy room over the room plate (item 01). Same shape,
#                same fault.
#
# An item in this set gets index 0 written as transparent regardless of
# its size. Anything not listed keeps the default.
FORCE_TRANSPARENT_ITEMS = set()
# Entire archives that must have index 0 transparent.
FORCE_TRANSPARENT_ARCHIVES = {'SPIES'}
# Individual items in archives that are otherwise fine.
FORCE_TRANSPARENT_ITEMS.update({
    ('EMBASSY', 12), ('EMBASSY', 13), ('EMBASSY', 14),
    ('EMBASSY', 15), ('EMBASSY', 16), ('EMBASSY', 17),
})


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


def archive_palette(arc, fallback):
    """The palette this archive's art was authored against.

    Most archives carry no palette of their own and were drawn against the
    game-wide WINLOSE[0] table, which is why that is the fallback. A few
    archives — VORTEX is the example that surfaced this — ship their own
    palette block on one of their items. Every other item in that archive
    decodes against the wrong colours if the archive palette is ignored,
    which is what made VORTEX items 1 through 34 read as inverted while
    item 0 looked correct: item 0 carries the palette and overrides the
    fallback, and the rest inherited the fallback alone.

    The result is WINLOSE merged under the archive's own palette, so an
    archive that only patches part of the table still gets the game-wide
    colours for the entries it does not touch.
    """
    best = {}
    for i in range(len(arc)):
        try:
            item = GfxItem(arc.item(i))
        except Exception:
            continue
        if not item.plausible():
            continue
        pal = item.palette()
        if len(pal) > len(best):
            best = pal
        if len(best) >= 256:
            break
    if not best:
        return dict(fallback)
    merged = dict(fallback)
    merged.update(best)
    return merged


def ui_score(img):
    """
    How much of the artwork is long flat horizontal runs.

    In-game UI holds a colour across a panel; painted art dithers. Runs of
    the backdrop colour and of transparency are ignored, otherwise a figure
    on a black field scores like a menu. Measured against knowns, chrome
    lands at 0.38-0.43 and art at or below 0.22, so 0.30 separates them.
    """
    a = np.asarray(img)
    h, w, _ = a.shape
    if w < 16 or h < 16:
        return 0.0
    rgb, alpha = a[..., :3], a[..., 3]
    visible = rgb.reshape(-1, 3)[alpha.reshape(-1) > 0]
    if not len(visible):
        return 0.0
    cols, counts = np.unique(visible, axis=0, return_counts=True)
    bg = cols[counts.argmax()]
    ok = (np.all(rgb[:, 1:] == rgb[:, :-1], axis=2)
          & (alpha[:, 1:] > 0) & (alpha[:, :-1] > 0)
          & ~np.all(rgb[:, 1:] == bg, axis=2))
    pad = np.zeros((ok.shape[0], 1), dtype=bool)
    v = np.concatenate([pad, ok, pad], axis=1).ravel().astype(np.int8)
    d = np.diff(v)
    lengths = np.flatnonzero(d == -1) - np.flatnonzero(d == 1)
    return round(float(lengths[lengths >= 20].sum()) / max(int((alpha > 0).sum()), 1), 3)


# Admission gates. Nothing reaches a pool without passing the one for it, so a
# 7x3 tactical chip can never be stretched across a cutaway window and a tech
# tree can never stand in for B-roll.
UI_LIMIT = 0.30

# Archives that are in-game interface, not footage. Their contents can still
# dress a diegetic screen, but nothing in them is a cutaway.
UI_ARCHIVES = {'SCREENS', 'STARMAP', 'DESIGN', 'MISSILE', 'NEWSCAST'}

# An empty menu frame scores low on ui_score because almost all of it is the
# backdrop colour, which that measure deliberately ignores. What gives it away
# instead is palette poverty: real footage dithers across dozens of colours,
# an empty bordered panel uses a handful.
BROLL_MIN_COLORS = 24

POOL_RULES = {
    # pool:      (min_w, min_h, max_w, max_h, min_cov, max_noise)
    'broll':     (120, 80, 9999, 9999, 0.15, 70),
    'portrait':  (100, 100, 9999, 9999, 0.15, 150),
    'sprite':    (16, 16, 160, 160, 0.05, 140),
}


# A bordered frame with nothing in it is not screen dressing either; it reads
# as a placeholder box wherever it lands.
CHROME_MIN_COLORS = 12


# Judged by eye, item by item, because no measure separates these from real
# footage: an empty interface panel and a photograph of a horizon can carry
# the same colour count, coverage and noise. The gates below catch the bulk;
# this catches what the gates cannot see.
#
# DENY is (archive, item) -> pools it may not join, or '*' for all of them.
DENY = {
    # An orange interface box reading "identify this class of ship". It is
    # the single most visible wrong asset in the broadcast: the `claim` and
    # `legal` beats both draw from BACKGRND, where it is the only b-roll.
    ('BACKGRND', 32): '*',
    # Empty bordered panels and window frames. They pass every gate because
    # a border is high-contrast and a backdrop is uniform, and they read as
    # a placeholder box wherever they land.
    ('BACKGRND', 0): '*', ('BACKGRND', 2): '*', ('BACKGRND', 3): '*',
    ('BACKGRND', 4): '*', ('BACKGRND', 5): '*', ('BACKGRND', 13): '*',
    ('BACKGRND', 15): '*', ('BACKGRND', 17): '*', ('BACKGRND', 21): '*',
    ('BACKGRND', 25): '*', ('BACKGRND', 34): '*', ('BACKGRND', 35): '*',
    ('BACKGRND', 37): '*', ('BACKGRND', 46): '*', ('BACKGRND', 50): '*',
    ('BACKGRND', 52): '*',
    # The ship design screen, buttons and all.
    ('DESIGN', 0): '*',
    # Council chamber interface frames. Every item in the archive decodes
    # against a palette the archive does not carry — the frames invert, the
    # portraits turn to chromatic confetti. Nothing in the folder is usable
    # as footage.
    **{('COUNCIL', i): '*' for i in range(24)},
    ('SCREENS', 6): '*',
}

# Frames to keep, for items whose animation runs into something unusable.
# (archive, item) -> (first, last) inclusive.
KEEP_FRAMES = {
    # 115 frames: a moonlit ridge for four of them, then "MICRO PROSE
    # presents" fades up and the Simtex and Orion titles follow. The `ident`
    # and `legal` beats both pull from INTRO, so the publisher's logo was
    # playing as news footage.
    ('INTRO', 0): (0, 3),
}


def denied(archive, item, pool):
    rule = DENY.get((archive, item))
    return rule is not None and (rule == '*' or pool in rule)


def pools_for(w, h, coverage, noise, ui, role, colors=64, archive='', item=-1):
    """Which pools this item is allowed to join."""
    def chrome_ok():
        return (w >= 24 and h >= 16 and role != 'blank'
                and colors >= CHROME_MIN_COLORS and coverage >= 0.2)

    out = []

    # Deliberate interference. A handful of items decode structurally correct
    # and chromatically scrambled, and they are the right thing to flash over
    # a failing broadcast. They are admitted to nothing else, which left the
    # glitch engine querying the catalogue with no pool at all and pulling up
    # the galaxy setup screen — Size, Difficulty, Opponents and two buttons —
    # as a ghost signal.
    if (noise > 95 and w >= 200 and ui < UI_LIMIT and role != 'blank'
            and not denied(archive, item, 'glitch')):
        out.append('glitch')

    if ui >= UI_LIMIT or role == 'blank':
        # Chrome is still useful as diegetic screen dressing, just never as
        # footage or as a face.
        if chrome_ok() and not denied(archive, item, 'chrome'):
            out.append('chrome')
        return out
    for pool, (mw, mh, xw, xh, mc, mn) in POOL_RULES.items():
        if not (mw <= w <= xw and mh <= h <= xh
                and coverage >= mc and noise <= mn):
            continue
        if pool == 'broll' and (archive in UI_ARCHIVES
                                or colors < BROLL_MIN_COLORS):
            continue
        if denied(archive, item, pool):
            continue
        out.append(pool)
    if not out and chrome_ok() and not denied(archive, item, 'chrome'):
        out.append('chrome')
    return out


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


def render(item, palette, opaque_zero=False):
    """Yield RGBA PIL images for every frame of a gfx item.

    `opaque_zero` is for fullscreen art. MoO1 composes its intro scenes,
    landing sequences and starfield backdrops against palette index 0 —
    the sky, the starfield, the space behind the window — and the game
    paints black there. Decoded as transparent, the PNG only looks right
    when composited over black; decoded as opaque, it is a self-contained
    picture that reads the same on any background.

    Overlay art — SPIES portraits, EMBASSY representative sprites — wants
    index 0 transparent so the picture underneath shows through. The
    caller decides which by setting `opaque_zero` per item.
    """
    w, h = item.w, item.h
    local = dict(palette)
    local.update(item.palette())
    lut = bytearray(256 * 4)
    for i in range(256):
        r, g, b = local.get(i, (0, 0, 0))
        a = 255 if (i != 0 or opaque_zero) else 0
        lut[i * 4:i * 4 + 4] = bytes((r, g, b, a))
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
        # The palette the archive's own art was authored against, layered
        # over the game-wide WINLOSE[0] table. Most archives have no palette
        # block of their own and this resolves to the WINLOSE table exactly
        # as before; a few carry one and every item benefits.
        archive_base = archive_palette(arc, palette)
        folder = os.path.join(OUT, name)
        os.makedirs(folder, exist_ok=True)
        # Clear the archive's own output first. Writing over it leaves the
        # frames of any item that has since been trimmed or dropped sitting
        # on disk — 111 frames of publisher logo outlived the trim that
        # removed them from the manifest, invisible to the engine but shipped
        # in the repository and liable to be picked up by the next tool that
        # globs a directory rather than reading the catalogue.
        for stale in os.listdir(folder):
            if stale.startswith('item_'):
                os.remove(os.path.join(folder, stale))
        entries = []

        for i in range(len(arc)):
            item = GfxItem(arc.item(i))
            if not item.plausible():
                continue
            # Fullscreen art is composed against an opaque index-0
            # background and MoO1 paints black there. Overlay art — the
            # SPIES portraits and the EMBASSY representative sprites —
            # wants index 0 transparent so the scene underneath shows
            # through. See the FORCE_TRANSPARENT_* sets at the top of
            # this file for the list of items that are overlays rather
            # than fullscreens.
            is_overlay = (name in FORCE_TRANSPARENT_ARCHIVES
                          or (name, i) in FORCE_TRANSPARENT_ITEMS)
            opaque_zero = (not is_overlay
                           and item.w >= 300 and item.h >= 180)
            frames = list(render(item, archive_base, opaque_zero=opaque_zero))
            if not frames:
                continue
            keep = KEEP_FRAMES.get((name, i))
            if keep:
                # Trimmed before anything else looks at them, so the frame
                # count, the GIF and the measurements all describe the item
                # as it will actually be used.
                frames = frames[keep[0]:keep[1] + 1]
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
            ui = ui_score(frames[hero])
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
                'ui': ui,
            })
            entries[-1]['pools'] = pools_for(item.w, item.h, cov, noise, ui,
                                             entries[-1]['role'], distinct,
                                             name, i)
            # Per-asset sidecar (source archive, palette origin, frames,
            # native size, animation, admission) so the catalogue can be
            # audited without re-running the decoder.
            with open(os.path.join(folder, '%s.json' % stem), 'w') as fh:
                json.dump({
                    'id': entries[-1]['id'],
                    'archive': name,
                    'item': i,
                    'palette': 'embedded' if item.palette() else 'WINLOSE[0] base',
                    'frames': len(frames),
                    'native': [item.w, item.h],
                    'animated': len(frames) > 1,
                    'role': entries[-1]['role'],
                    'pools': entries[-1]['pools'],
                    'ui': ui,
                    'noise': noise,
                    'coverage': round(cov, 3),
                    'opaque_bg': opaque_zero,
                }, fh, separators=(',', ':'))
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