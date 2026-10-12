#!/usr/bin/env python3
"""Turn generated art into plates the engine can composite.

An image model returns a big, smooth, full-colour picture. The engine wants
the opposite: art at the resolution of the lit area of the studio monitor,
with hard alpha and a DOS-era palette, because `renderer.js` disables image
smoothing everywhere and blits at an exact 3x integer scale. Handing it the
raw render would make the canvas resample 2089px down to 876px with
nearest-neighbour, which drops pixels unevenly and destroys the dithering.

Three things are fixed here, in this order, because each depends on the last:

  de-fringe   Cut-outs come back keyed off black, so the partly transparent
              pixels along every edge still hold near-black RGB — 64-76% of
              them in the first batch. Composited over the teal set that is a
              dark halo around the desk. The opaque colour is bled outward
              into those pixels before anything else touches them.

  downscale   Done on premultiplied alpha, so transparent black cannot bleed
              back into the edge on the way down.

  quantise    Hard alpha at 50% (the art direction says no anti-aliasing) and
              256 colours, so generated plates cut together with the assets
              decoded out of the LBX archives rather than sitting on top of
              them looking like a different decade.

    python3 tools/condition_plates.py            # convert everything known
    python3 tools/condition_plates.py --preview  # also write a composite

Anchors are additionally *checked*, not just converted. The three states of a
species are crossfaded by the engine, so they have to share pose, scale and
eye-line; three separate generations never do. The first Bulrathi set drifted
18% in scale across its three states and would have read as the anchor
lurching at the camera. Finding that on the first species costs one batch;
finding it after ten costs thirty generations.
"""
import json
import os
import re
import shutil
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Source art is dropped by hand, so look for it where hands drop things.
# Deliberately NOT recursive: a subdirectory is where art gets filed once it
# has been rejected or superseded, and walking into those picks work back up
# after it has been thrown away.
SRC_ROOTS = [
    os.path.join(ROOT, 'assets', 'generated', '_inbox'),
    os.path.join(ROOT, 'docs'),
    os.path.expanduser('~/Downloads'),
]


def find_source(name, out_dir=None):
    """Newest file called `name` in a source root, or dropped into `out_dir`.

    The output directory counts as a source. It is the path the document
    tells people to save to, so it is where files turn up; a tool that only
    looks in directories of its own choosing reports nothing and looks
    broken. A file already there is a source if it is plainly not output —
    too big, or too many colours to have been through the quantiser.
    """
    roots = list(SRC_ROOTS)
    hits = [os.path.join(r, name) for r in roots
            if os.path.isfile(os.path.join(r, name))]
    if out_dir:
        cand = os.path.join(out_dir, name)
        if os.path.isfile(cand) and not conditioned_already(Image.open(cand)):
            hits.append(cand)
    if not hits:
        return None
    return max(hits, key=os.path.getmtime)
OUT = os.path.join(ROOT, 'assets', 'generated', 'set')

def _frame():
    """The broadcast frame in canvas pixels, read from the renderer.

    Plates are conditioned at the size they are drawn, not at the 320x180
    design grid. Conditioned to the grid they were upscaled four times by
    the canvas, while the anchors — bigger plates drawn smaller — were
    upscaled about twice, so the room looked coarse beside the people
    standing in it. The pixel-art look belongs to the source art, which
    already has chunky hand-sized pixels in it; resampling it down and back
    up does not add that, it only blurs what is there.
    """
    w, h, scale = 320, 180, 4
    try:
        text = open(os.path.join(ROOT, 'js', 'renderer.js')).read()
        mw = re.search(r'BASE_W\s*=\s*(\d+)', text)
        mh = re.search(r'BASE_H\s*=\s*(\d+)', text)
        ms = re.search(r'SCALE\s*=\s*(\d+)', text)
        if mw and mh:
            w, h = int(mw.group(1)), int(mh.group(1))
        if ms:
            scale = int(ms.group(1))
    except OSError:
        pass
    return w * scale, h * scale


VIEW_W, VIEW_H = _frame()

# Where each plate sits in the view. The desk comes back from the image model
# filling its whole frame, and composited at full size it covers the viewport
# and leaves nowhere for anyone to sit; it is a prop in the room, not a second
# backdrop. Width is a fraction of the view, anchored bottom-centre.
#
# The room plate already has consoles built into both side walls, so the two
# standalone consoles are not set dressing — they are free-standing props at a
# different perspective, kept for cutaways. They are conditioned the same way
# but given no place in the set, which is why their role is 'prop'.
#
# Source and installed name are the same: the document tells you to save
# straight to the installed path, so that is where the raw drop appears.
#
# source file -> (installed name, width fraction or None for full bleed, role)
PLATES = [
    ('studio_wide_empty.png', 'studio_wide_empty.png', None, 'room'),
    # The desk is drawn into the set plate now, not supplied separately.
    # Two images had to agree on perspective, lighting and style, and
    # separately generated ones never did.
    ('console_left.png',      'console_left.png',      0.22, 'prop'),
    ('console_right.png',     'console_right.png',     0.22, 'prop'),
]

# Anchors composite into this band, behind the desk: centred, with their heads
# clear of the viewport's lower frame and their waists hidden by the desk top.
ANCHOR_BAND = {'y': 0.06, 'h': 0.46}


def defringe(im, rounds=4):
    """Bleed opaque colour outward into partly transparent pixels.

    Those pixels keep their alpha; only their RGB is replaced, with the
    average of whatever opaque neighbours they have. Four rounds is enough for
    the two-to-three pixel soft edge a generated cut-out carries.
    """
    im = im.convert('RGBA')
    px = im.load()
    w, h = im.size
    for _ in range(rounds):
        fixed = []
        for y in range(h):
            for x in range(w):
                a = px[x, y][3]
                if a >= 250:
                    continue
                r = g = b = n = 0
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1),
                               (1, 1), (-1, -1), (1, -1), (-1, 1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] >= 250:
                        pr, pg, pb, _ = px[nx, ny]
                        r += pr; g += pg; b += pb; n += 1
                if n:
                    fixed.append((x, y, (r // n, g // n, b // n, a)))
        if not fixed:
            break
        for x, y, v in fixed:
            px[x, y] = v
    return im


def resize_premultiplied(im, size):
    """Downscale without letting transparent black bleed into the edge."""
    im = im.convert('RGBA')
    r, g, b, a = im.split()
    pr = Image.merge('RGB', (r, g, b))
    pr = Image.composite(pr, Image.new('RGB', im.size, (0, 0, 0)), a)
    pr = pr.resize(size, Image.LANCZOS)
    a2 = a.resize(size, Image.LANCZOS)
    out = Image.new('RGBA', size)
    op, ap = pr.load(), a2.load()
    o = out.load()
    for y in range(size[1]):
        for x in range(size[0]):
            av = ap[x, y]
            if av == 0:
                o[x, y] = (0, 0, 0, 0)
                continue
            cr, cg, cb = op[x, y]
            s = 255.0 / av
            o[x, y] = (min(255, int(cr * s)), min(255, int(cg * s)),
                       min(255, int(cb * s)), av)
    return out


def quantise(im, colours=256):
    """Hard alpha and a 256-colour palette.

    Fully transparent pixels are flattened to a single value. They keep
    whatever colour the de-fringe bled into them otherwise, which is
    invisible but counts against the palette and bloats the file.
    """
    im = im.convert('RGBA')
    a = im.split()[3].point(lambda v: 255 if v >= 128 else 0)
    rgb = im.convert('RGB').quantize(colors=colours, method=Image.MEDIANCUT)
    out = rgb.convert('RGBA')
    out.putalpha(a)
    flat = Image.new('RGBA', out.size, (0, 0, 0, 0))
    return Image.composite(out, flat, a)


def content_box(im):
    """The bounding box of everything not fully transparent."""
    return im.convert('RGBA').split()[3].point(
        lambda v: 255 if v > 8 else 0).getbbox()


def crop_to_content(im):
    """Drop fully transparent margin.

    An image model centres its subject in the canvas and pads the rest, so a
    cut-out arrives with dead space baked into its height — the desk came
    back with 48 of its 121 rows empty. The engine then places the plate by
    its edges and inherits the padding, which is how the desk ended up with
    its front panel below the bottom of the frame while its invisible top
    margin sat in shot.
    """
    box = content_box(im)
    return im.crop(box) if box else im


def condition(src, frac=None):
    im = Image.open(src).convert('RGBA')
    if im.split()[3].getextrema()[0] < 255:          # has real transparency
        im = crop_to_content(im)
        im = defringe(im)
    if frac is None:
        size = (VIEW_W, VIEW_H)
    else:
        w = max(1, round(VIEW_W * frac))
        size = (w, max(1, round(im.height * w / im.width)))
    return quantise(resize_premultiplied(im, size))


CUTAWAY_OUT = os.path.join(ROOT, 'assets', 'generated', 'cutaways')
ANCHOR_OUT = os.path.join(ROOT, 'assets', 'generated', 'anchors')
RAW_KEEP = os.path.join(ROOT, 'assets', 'generated', '_inbox')
# `listening_flip` is the listening plate with the glance turned the other
# way, for an anchor sitting on the other side of whoever is talking. A
# supplied one is conditioned like any other state; when none is supplied it
# is derived from the finished `listening` plate by mirroring the head only.
#
# Flipping the whole picture turns the glance the right way and turns the
# station badge into backwards lettering with it, which is exactly what two
# of the hand-made flips in this project came back with.
STATES = ('desk_hero', 'speaking', 'listening', 'listening_flip')

def _cast_fraction(default=0.34):
    """`CAST.h` out of renderer.js — the fraction of the frame a plate fills.

    Read rather than repeated. It was a literal 0.34 here and 0.315 there,
    and when the cast was resized to sit at the desk properly this number
    stayed behind, so every plate was conditioned small and then blown back
    up by the canvas — the exact double-resample the tool exists to avoid.
    """
    try:
        text = open(os.path.join(ROOT, 'js', 'renderer.js')).read()
        m = re.search(r'CAST\s*=\s*\{\s*h:\s*([\d.]+)', text)
        if m:
            return float(m.group(1))
    except OSError:
        pass
    return default


# The cast is drawn at CAST.h of the frame height in renderer.js. Matching
# it here means the plate is blitted close to 1:1 instead of being scaled
# twice — once down by this tool and once up by the canvas.
CAST_H = int(VIEW_H * _cast_fraction())


def subject_metrics(im):
    """Where the head sits and how big it is, read off the alpha channel.

    These say whether three states are the same drawing. The measurement is
    taken across the head rather than the shoulders: the body is grafted from
    the hero anyway, so shoulder width is identical by construction and tells
    you nothing, while a head that has moved or changed size is exactly what
    a crossfade exposes.

    There is deliberately no automatic check for a desk baked into the plate.
    The brief asks for the chest cropped at the bottom edge, so a correct
    cut-out is opaque along its bottom row, and every cheap test for a desk
    flagged correct art. A detector that rejects good work is worse than no
    detector, so that one is left to the eye.
    """
    im = im.convert('RGBA')
    a = np.asarray(im)[:, :, 3] > 200
    rows = a.sum(axis=1)
    nz = np.nonzero(rows > 0)[0]
    if not len(nz):
        return {'top': 0, 'head': 0}
    top = int(nz[0])
    neck = neck_row(im)
    # Halfway down the head: past the ears, around the eyes.
    y = min(len(rows) - 1, (top + neck) // 2)
    cols = np.nonzero(a[y])[0]
    head = int(cols.max() - cols.min()) if len(cols) else 0
    return {'top': top, 'head': head}


def neck_row(im):
    """The row where the head ends and the shoulders begin.

    The narrowest row between the two: the silhouette widens through the
    head, pinches at the neck, then widens again into the shoulders.

    Two things make that harder than it sounds. Not every character has a
    neck to pinch — a Bulrathi's mane and a Mrrshan's hair run straight
    into the shoulders, so the profile only ever widens and the minimum
    lands wherever the search happens to start. And a pinch that is real
    can still sit near the top of the search window: on the full-torso
    plates the neck is about a third of the way down, and an earlier guard
    that rejected any minimum near the window's edge threw the human's
    neck away and fell back to 62% — mid-chest, which mirrored the GNN
    badge along with the face.

    So the test is what a pinch actually is, not where it sits: the
    silhouette must be wider above it (the head) and wider still below it
    (the shoulders). Failing that, fall back to a fraction high enough to
    stay above the badge.
    """
    a = np.asarray(im.convert('RGBA'))[:, :, 3] > 128
    w = a.sum(axis=1)
    nz = np.nonzero(w > 0)[0]
    if not len(nz):
        return len(w) // 2
    top, bottom = int(nz[0]), int(nz[-1])
    span = bottom - top + 1
    fallback = top + int(span * 0.40)
    lo = top + max(2, int(span * 0.10))
    hi = top + int(span * 0.70)
    if hi - lo < 8:
        return fallback
    band = w[lo:hi]
    n = lo + int(np.argmin(band))
    pinch = int(w[n])
    if pinch <= 0:
        return fallback
    head = int(w[top:n].max()) if n > top else 0
    body = int(w[n:bottom + 1].max())
    if head >= pinch * 1.10 and body >= pinch * 1.30:
        return int(n)
    return fallback                      # no pinch, just a slope


def head_only_mirror(im, feather=6):
    """Mirror the head and leave the body alone.

    A whole-image flip turns the glance the right way and turns the station
    badge into backwards lettering with it. Only the rows above the neck are
    mirrored, so the uniform — badge, collar, shoulders — stays as drawn.

    The mirror is taken about the *neck*, not the middle of the canvas. A
    head is rarely centred in its plate, so flipping about the canvas centre
    slides it sideways and the shoulders stop meeting the collar: the body
    reads as shifted a few pixels even though not one of its pixels moved.
    The cut row's own centre of mass is the pivot, so the neck lands back on
    the neck.

    The blend across the cut is done on premultiplied alpha. A straight
    linear blend of RGBA mixes in the colour behind transparent pixels,
    which is what ghosted a second uniform and a second GNN badge onto one
    chest the last time two plates were composited here.
    """
    n = neck_row(im)
    a = np.asarray(im.convert('RGBA'), dtype=float) / 255.0
    rows = a.shape[0]
    cols = a.shape[1]

    # Where the neck actually is, across a few rows either side of the cut.
    lo, hi = max(0, n - 4), min(rows, n + 4)
    band = a[lo:hi, :, 3]
    xs = np.arange(cols)
    weight = band.sum()
    centre = float((band * xs).sum() / weight) if weight > 0 else (cols - 1) / 2.0

    flipped = a[:, ::-1, :]
    # Flipping about the canvas maps x -> cols-1-x; the neck wants x -> 2c-x.
    shift = int(round(2 * centre - (cols - 1)))
    if shift:
        flipped = np.roll(flipped, shift, axis=1)
        if shift > 0:
            flipped[:, :shift, :] = 0.0
        else:
            flipped[:, shift:, :] = 0.0

    m = np.zeros((rows, 1, 1))
    m[:max(0, n - feather)] = 1.0
    for i in range(max(0, n - feather), min(rows, n + feather)):
        m[i] = 1.0 - (i - (n - feather)) / float(2 * feather)
    out = blend_premultiplied(flipped, a, m)
    return Image.fromarray((out * 255.0 + 0.5).astype(np.uint8), 'RGBA')


def blend_premultiplied(top, bottom, m):
    """Blend two float RGBA arrays by mask `m`, premultiplied.

    Blending RGBA straight is wrong wherever one side is transparent: its
    RGB is arbitrary, usually black or a leftover edge colour, and it gets
    averaged into the visible result. That is how a graft of one plate onto
    another produced a second ghosted uniform and a second GNN badge on the
    same chest. Premultiplying first weights each side's colour by its own
    coverage, so a transparent pixel contributes nothing but transparency.
    """
    ta, ba = top[:, :, 3:4], bottom[:, :, 3:4]
    rgb = top[:, :, :3] * ta * m + bottom[:, :, :3] * ba * (1 - m)
    alpha = ta * m + ba * (1 - m)
    with np.errstate(divide='ignore', invalid='ignore'):
        rgb = np.where(alpha > 1e-6, rgb / np.maximum(alpha, 1e-6), 0.0)
    return np.clip(np.concatenate([rgb, alpha], axis=2), 0.0, 1.0)


def body_ref(im, frac=0.45):
    """Left, right and bottom edge of the lower body.

    The torso, the arms and the folded hands are the same in every state —
    only the head moves. So the lower part of the plate is what the states
    should be lined up by, and the head is deliberately excluded: it is the
    thing that legitimately differs.
    """
    a = np.asarray(im.convert('RGBA'))[:, :, 3] > 8
    bb = Image.fromarray(a).getbbox()
    if not bb:
        return None
    y0 = int(bb[1] + (bb[3] - bb[1]) * (1 - frac))
    sub = a[y0:bb[3]]
    cols = np.nonzero(sub.any(axis=0))[0]
    if not len(cols):
        return None
    return float(cols[0]), float(cols[-1]), float(bb[3])


def register(variant, hero):
    """Scale and shift `variant` so its body sits on the hero's.

    Separate generations do not come back at the same size. The Mrrshan's
    speaking plate arrived 8.5% smaller than her hero and shifted up and
    left, which the engine shows as the anchor changing size the moment
    she opens her mouth.

    The reference is the lower body: the torso, the arms and the folded
    hands are the same in every state, so they are what the states should
    be lined up by, and the head is excluded because it is the thing that
    legitimately moves.

    The whole drawing is then moved and resized as one picture. Nothing is
    cut and nothing is pasted — that is the point. The previous attempt at
    this grafted the hero's body onto the variant, which put two GNN badges
    on one chest and took a Klackon's jaw off; a plate that is only ever
    scaled and translated cannot come out damaged.

    Two refinements on top of this were tried and both were reverted. A
    best fit over the whole silhouette halved the total mismatch and moved
    the face to do it. A best fit over the head alone held the face still
    and moved the body — and a body that shifts a few pixels on every
    syllable is just as visible as a head that does, because the viewer
    sees the plate jump, not which part of it jumped. Lining the body up
    and leaving the rest alone is the only version that left the human
    looking right, and he is the one whose three plates genuinely match.

    When a variant still drifts after this, the two generations disagree
    and the answer is to regenerate the variant as an *edit* of the hero,
    not to search for a cleverer transform.
    """
    h, v = body_ref(hero), body_ref(variant)
    if not h or not v or v[1] - v[0] < 1:
        return variant, 1.0
    scale = (h[1] - h[0]) / (v[1] - v[0])
    out = variant.resize((max(1, round(variant.width * scale)),
                          max(1, round(variant.height * scale))),
                         Image.LANCZOS)
    canvas = Image.new('RGBA', hero.size, (0, 0, 0, 0))
    canvas.paste(out, (int(round(h[0] - v[0] * scale)),
                       int(round(h[2] - v[2] * scale))), out)
    return canvas, scale


def mouth_region(hero, variant):
    """Where the mouth is, as a soft mask over the hero's head.

    The model redraws a whole plate when asked to change a mouth, so the
    difference between hero and variant is noisy everywhere. Blurred, it
    still peaks hard on the thing that actually changed: on all three
    species with a speaking plate the peak lands on the mouth — 65 against
    a median of 6 on the human, 106 against 18 on the Mrrshan, whose two
    generations disagree the most.

    The *peak* is what is trusted; the extent of the hot area is not. The
    first version took the region where the blurred difference was above
    half the peak, which on the Mrrshan covered two thirds of the plate —
    her noise floor is high enough that half her peak is everywhere. So
    the centre is measured and the size is a fraction of the head, which
    is a thing with a known shape rather than a thing being searched for.

    Returns (mask, (cx, cy, rx, ry)), or None when nothing stands out.
    """
    a = np.asarray(hero.convert('RGB'), dtype=float)
    b = np.asarray(variant.convert('RGB'), dtype=float)
    if a.shape != b.shape:
        return None
    alpha = np.asarray(hero.convert('RGBA'))[:, :, 3] > 128
    d = np.abs(a - b).mean(axis=2) * alpha
    # The blur has to scale with the plate. It was a flat 4 px, chosen when
    # plates were 283 px tall; at 216 that smears the mouth proportionally
    # harder, and the Mrrshan's peak-to-floor ratio fell from 2.6 to 1.9
    # against a gate of 2.0 — so the detector declined by a hair, her whole
    # plate was swapped instead of her mouth, and her body moved when she
    # spoke. A radius in plate-heights holds across any `CAST_H`.
    radius = max(2.0, d.shape[0] / 70.0)
    blur = np.asarray(Image.fromarray(d.astype(np.uint8)).filter(
        ImageFilter.GaussianBlur(radius)), dtype=float)
    rows = int(blur.shape[0] * 0.45)          # the head, not the uniform
    head = blur[:rows]
    peak = head.max()
    inside = blur[:rows][alpha[:rows]]
    floor = float(np.median(inside)) if inside.size else 0.0
    # The floor is high when the two plates are separate generations that
    # disagree everywhere, which is exactly the case where swapping whole
    # plates is worst. 1.8 keeps the mouth as the clear winner without
    # demanding a quiet background that those pairs will never have.
    if peak < 20 or peak < floor * 1.8:
        return None

    # Centre: the centroid of the hottest two percent, so one stray pixel
    # cannot place the mouth.
    hot = head >= peak * 0.92
    ys, xs = np.nonzero(hot)
    if not len(ys):
        return None
    cy, cx = float(ys.mean()), float(xs.mean())

    # Size: a fraction of the head's own width. A mouth is about a quarter
    # of a face across and a little less tall, and that holds for a bear,
    # a cat and a mantis as well as a man.
    widths = alpha[:rows].sum(axis=1)
    head_w = float(widths.max()) if widths.max() else blur.shape[1] * 0.4
    rx, ry = head_w * 0.26, head_w * 0.20

    yy = np.arange(blur.shape[0])[:, None]
    xx = np.arange(blur.shape[1])[None, :]
    r = np.sqrt(((yy - cy) / ry) ** 2 + ((xx - cx) / rx) ** 2)
    mask = np.clip(1.8 - 1.8 * r, 0.0, 1.0)[:, :, None]
    return mask, (cx, cy, rx, ry)


def head_region(hero, variant):
    """A mask over the head, cut at the row where the two plates agree.

    For the listening states the head turns, so the whole head differs and
    there is no feature to centre on. An ellipse around the difference was
    tried and ghosted: where the hero has an antenna and the turned plate
    does not, a half-weight pixel shows both.

    The boundary used instead is measured rather than guessed. Scanning
    down, the per-row difference between the two plates is large through
    the head and collapses to near nothing once it reaches the uniform —
    on the human it runs 18–25 to row 80 and 0–2 from row 88. Cutting at
    that collapse is invisible by construction, because it is defined as
    the place the two pictures already agree. That is the opposite of the
    old `neck_row`, which guessed a boundary from the silhouette and on
    the Klackon guessed one straight through his mandibles.
    """
    a = np.asarray(hero.convert('RGB'), dtype=float)
    b = np.asarray(variant.convert('RGB'), dtype=float)
    if a.shape != b.shape:
        return None
    rowdiff = np.abs(a - b).mean(axis=(1, 2))
    rows = len(rowdiff)
    top = int(rows * 0.60)
    peak = rowdiff[:top].max()
    if peak < 4:
        return None
    quiet = rowdiff < peak * 0.10
    cut = None
    run = 10
    for y in range(int(rows * 0.10), top):
        if quiet[y:y + run].all():
            cut = y
            break
    if cut is None:
        return None
    feather = 4
    mask = np.zeros((rows, 1, 1))
    mask[:max(0, cut - feather)] = 1.0
    for i in range(max(0, cut - feather), min(rows, cut + feather)):
        mask[i] = 1.0 - (i - (cut - feather)) / float(2 * feather)
    return np.broadcast_to(mask, (rows, a.shape[1], 1)).copy(), cut


def quantise_like(im, ref):
    """`im` reduced to `ref`'s exact palette.

    Quantising the two independently is what scattered the difference: each
    gets its own 256 colours, so pixels that were copied verbatim from the
    hero still come back a palette step away and the whole figure shimmers
    on every mouth flap. Sharing the hero's palette means a pixel taken
    from the hero survives the round trip unchanged, and the result cannot
    exceed 256 colours however much blending went into it.
    """
    ref_p = ref.convert('RGB').quantize(colors=256, method=Image.MEDIANCUT)
    out = im.convert('RGB').quantize(palette=ref_p, dither=Image.Dither.NONE)
    out = out.convert('RGBA')
    a = im.convert('RGBA').split()[3].point(lambda v: 255 if v >= 128 else 0)
    out.putalpha(a)
    flat = Image.new('RGBA', out.size, (0, 0, 0, 0))
    return Image.composite(out, flat, a)


def swap_region(hero, variant, mask):
    """The hero, with `variant` showing through `mask`.

    Premultiplied, so a transparent pixel on either side contributes its
    transparency and not the colour hiding behind it.
    """
    h = np.asarray(hero.convert('RGBA'), dtype=float) / 255.0
    v = np.asarray(variant.convert('RGBA'), dtype=float) / 255.0
    out = blend_premultiplied(v, h, mask)
    return Image.fromarray((out * 255.0 + 0.5).astype(np.uint8), 'RGBA')


BACKDROP_OUT = os.path.join(ROOT, 'assets', 'generated', 'backdrops')
CORRESPONDENT_OUT = os.path.join(ROOT, 'assets', 'generated', 'correspondents')


def _pip_height():
    """The monitor's height as a fraction of the frame, out of the engine."""
    try:
        text = open(os.path.join(ROOT, 'js', 'cutscene-manager.js')).read()
        m = re.search(r'PIP\s*=\s*\{[^}]*h:\s*([\d.]+)', text)
        if m:
            return float(m.group(1))
    except OSError:
        pass
    return 0.215


PIP_H = _pip_height()
# The day-cycle suffixes the prompts generate. Matching on these keeps the
# backdrop pass from hoovering up every loose PNG in the inbox.
_BACKDROP_PHASES = ('_dawn.png', '_day.png', '_dusk.png', '_night.png')


def _is_backdrop(name):
    return name.endswith(_BACKDROP_PHASES)


def window_mask(room):
    """The panes of the studio window, as a boolean mask.

    The set prompt says every pane is a flat area of pure black and that
    nothing else in the room may be, which makes the window keyable without
    anyone measuring a rectangle that goes stale the next time the room is
    regenerated.

    Thresholding alone is not enough — the ceiling truss and the two
    wall-mounted monitors are near-black too, and they came to 23% of the
    plate between them. So the black is split into connected regions and
    only the ones sitting where a window sits are kept: eight panes, each
    about 21,000 pixels, centred across the middle of the room. The two
    monitors land at x 0.04 and 0.95 and are dropped.
    """
    try:
        from scipy import ndimage
    except ImportError:
        return None
    a = np.asarray(room.convert('RGB')).astype(int)
    h, w = a.shape[:2]
    lab, n = ndimage.label(a.max(axis=2) <= 24)
    keep = np.zeros((h, w), bool)
    for i in range(1, n + 1):
        comp = lab == i
        if comp.sum() < 1500:
            continue
        ys, xs = np.nonzero(comp)
        if 0.15 < xs.mean() / w < 0.85 and 0.08 < ys.mean() / h < 0.55:
            keep |= comp
    return keep if keep.any() else None


def punch_window(room):
    """The room with its window panes cut out, and where they were.

    The engine draws a backdrop and then the room over it, so the glass has
    to be a hole. Baking a backdrop into the plate instead would fix one
    view into the set for good, and the whole point of the window is that
    it changes with the show block and the hour.
    """
    mask = window_mask(room)
    if mask is None:
        return room, None
    out = room.convert('RGBA')
    a = np.asarray(out).copy()
    a[mask, 3] = 0
    ys, xs = np.nonzero(mask)
    box = (float(xs.min()) / room.width, float(ys.min()) / room.height,
           float(xs.max() + 1) / room.width, float(ys.max() + 1) / room.height)
    return Image.fromarray(a, 'RGBA'), box


def palette_size(im):
    """Distinct colours, or a large number when there are too many to count.

    getcolors() returns None above its limit rather than a count, and `or []`
    turned that into zero — so the richest possible image counted as having
    no colours and read as already conditioned.
    """
    got = im.convert('RGB').getcolors(1 << 16)
    return len(got) if got is not None else (1 << 16)


def head_bands(hero):
    """Where the eyes and the mouth are, as row ranges.

    Measured off the silhouette rather than guessed: the head runs from the
    first opaque row to the neck pinch, and within that the eyes sit a
    little under a third of the way down and the mouth around two thirds.
    Close enough for a band graft on art this size, and it holds across a
    bear, a cat, a lizard, a bird and a rock.
    """
    a = np.asarray(hero.convert('RGBA'))[:, :, 3] > 128
    rows = a.sum(axis=1)
    nz = np.nonzero(rows)[0]
    top = int(nz[0]) if len(nz) else 0
    neck = neck_row(hero)
    span = max(1, neck - top)
    return {
        'top': top, 'neck': neck,
        'eyes': (int(top + span * 0.28), int(top + span * 0.58)),
        'mouth': (int(top + span * 0.58), int(top + span * 0.92)),
    }


def band_graft(hero, variant, y0, y1, feather=6, mirror=False):
    """Hero everywhere, variant only between y0 and y1.

    The brief asks each variant to change one thing, and the image model
    changes several: a `listening` plate came back with its mouth hanging
    open, which on a silent anchor reads as a fault. Taking only the band
    that was meant to change makes the instruction true after the fact.

    With `mirror`, the band is flipped left-to-right about the subject's own
    centre, which turns a glance one way into a glance the other. Only the
    band moves, so the uniform and the station badge — which would read
    backwards — are untouched.
    """
    h = np.asarray(hero.convert('RGBA'), dtype=float)
    v = np.asarray(variant.convert('RGBA'), dtype=float)
    if h.shape != v.shape:
        return hero
    if mirror:
        band = v[y0:y1, ::-1, :].copy()
        v = v.copy()
        v[y0:y1] = band
    rows = h.shape[0]
    m = np.zeros((rows, 1, 1))
    for i in range(max(0, y0), min(rows, y1)):
        m[i] = 1.0
    for k in range(feather):
        w = (k + 1) / float(feather + 1)
        if y0 - 1 - k >= 0:
            m[y0 - 1 - k] = 1.0 - w
        if y1 + k < rows:
            m[y1 + k] = 1.0 - w
    return Image.fromarray((v * m + h * (1 - m)).astype(np.uint8), 'RGBA')


def pupil_x(img, band):
    """Horizontal centre of the darkest pixels in the eye band.

    Returned as a fraction of the subject's own width, so it is comparable
    between a bear and a grey alien. Pupils and sockets are the dark things
    in a face; if the eyes move, this moves.
    """
    a = np.asarray(img.convert('RGBA'))
    y0, y1 = band
    reg = a[y0:y1]
    alpha = reg[:, :, 3] > 128
    if alpha.sum() < 50:
        return None
    lum = reg[:, :, :3].astype(int).sum(axis=2)
    lum = np.where(alpha, lum, 9999)
    thr = np.percentile(lum[alpha], 8)
    mask = (lum <= thr) & alpha
    if mask.sum() < 10:
        return None
    xs = np.nonzero(mask)[1]
    cols = np.nonzero(alpha.any(axis=0))[0]
    width = (cols.max() - cols.min()) or 1
    return (xs.mean() - cols.min()) / float(width)


def band_changed(hero, variant, band):
    """Whether a variant actually altered the region it was asked to.

    Counting changed pixels does not answer this. The model redraws the
    whole plate — 5 to 27% of every band differs as dithering noise — so a
    band that was never touched still reports a healthy-looking percentage,
    and nine `listening` plates passed that way with the eyes exactly where
    the hero left them. This looks for the feature moving instead.
    """
    ph = pupil_x(hero, band)
    pv = pupil_x(variant, band)
    if ph is None or pv is None:
        return None
    return (pv - ph) * 100.0


def conditioned_already(im):
    """Whether this is output rather than something freshly dropped in."""
    return (im.width <= VIEW_W * 2 and im.height <= VIEW_H * 2
            and palette_size(im) <= 256)


def anchor_sources(sid, state):
    return find_source('%s_%s.png' % (sid, state), out_dir=ANCHOR_OUT)


def do_anchors():
    """Condition every complete anchor set, and check the states line up."""
    names = set()
    roots = SRC_ROOTS + [ANCHOR_OUT]
    for root in roots:
        if not os.path.isdir(root):
            continue
        for f in os.listdir(root):
            if f.endswith('_desk_hero.png'):
                names.add(f[:-len('_desk_hero.png')])
    if not names:
        return
    os.makedirs(ANCHOR_OUT, exist_ok=True)
    os.makedirs(RAW_KEEP, exist_ok=True)
    print('\n--- anchors ---')
    for sid in sorted(names):
        found = {}
        for st in STATES:
            src = anchor_sources(sid, st)
            if src:
                found[st] = src
        if not found:
            print('%s: already conditioned' % sid)
            continue

        hero_src = found.get('desk_hero')
        hero_im = Image.open(hero_src).convert('RGBA') if hero_src else None
        bands = head_bands(hero_im) if hero_im is not None else None

        # One crop box for the whole species, so the states stay registered:
        # cropping each to its own content gives a turned head a different
        # bounding box and the plates come out different sizes.
        #
        # The box is the *union* of every state's content, not the hero's
        # alone. A variant that reaches a few pixels wider than the hero —
        # a turned antenna, a raised shoulder — had that much sliced off it
        # by the hero's box.
        plates = {}
        for st, src in found.items():
            im = Image.open(src).convert('RGBA')
            if hero_im is not None and st != 'desk_hero':
                im, sc = register(im, hero_im)
                if abs(sc - 1.0) > 0.02:
                    print('   %s: scaled %+.1f%% to match the hero\'s body'
                          % (st, (sc - 1.0) * 100))
            plates[st] = im

        # Measured after registration, so the report describes the plates
        # that were actually written rather than the drops they came from.
        metrics = {st: subject_metrics(im) for st, im in plates.items()}

        boxes = [content_box(im) for im in plates.values()]
        boxes = [b for b in boxes if b]
        crop = (min(b[0] for b in boxes), min(b[1] for b in boxes),
                max(b[2] for b in boxes), max(b[3] for b in boxes)) \
            if boxes else None

        # The body is NOT taken from the hero any more. Grafting it on did
        # two kinds of damage, both of them plain to the eye once the raw
        # drop and the output were put side by side:
        #
        #   - the cut row came from the *hero's* silhouette and was applied
        #     to a variant whose head is turned and sits lower, so on the
        #     Klackon it fell through the mandibles and took the jaw off;
        #   - the blend was a straight average of two RGBA arrays, which
        #     mixes in the colour behind transparent pixels, so where the
        #     variant's uniform was narrower than the hero's you saw both —
        #     ghosted shoulders and two GNN badges on one chest.
        #
        # The variants are whole coherent drawings as they arrive. They do
        # not need a body transplant; they need registering and conditioning,
        # which is all that happens below. If a generation comes back with a
        # wrong or missing badge, that is a plate to regenerate, not to
        # repair by pasting another plate over it.
        done = {}
        for st, src in found.items():
            im = plates[st]
            if crop:
                im = im.crop(crop)
            im = defringe(im)
            h = CAST_H
            w = max(1, round(im.width * h / im.height))
            im = quantise(resize_premultiplied(im, (w, h)))
            done[st] = im
            dest = os.path.join(ANCHOR_OUT, '%s_%s.png' % (sid, st))
            # Keep the raw drop; conditioning is lossy and not worth redoing
            # from a regeneration.
            # Keep a raw drop that was saved straight into the output
            # directory — but never a `listening_flip`, which the tool
            # derives. Archiving that one puts the tool's own output into
            # the source directory, where the next run reads it back as if
            # a human had drawn it.
            # Never archive a state the tool rebuilds. Putting its own
            # output where it looks for input is how this went wrong twice.
            if (os.path.abspath(src) == os.path.abspath(dest)
                    and st not in ('listening_flip', 'speaking')):
                shutil.copy2(src, os.path.join(RAW_KEEP, os.path.basename(src)))
            im.save(dest)

        # The speaking plate becomes the finished hero with its mouth
        # swapped in.
        #
        # The complaint it answers: "only the mouth should move, not their
        # entire body — it's like each image is pegged to a slightly
        # different x y coord". That is what swapping two whole plates
        # does, because two generations never agree everywhere and no
        # amount of registering them makes them agree everywhere.
        #
        # Done on the *finished* plates, not the sources. Conditioned
        # separately the two get their own 256-colour palettes, so 5% of
        # every pixel flips by a palette step and the flap shimmers across
        # the whole figure. Built from the hero's own finished bytes, the
        # only pixels that can differ are the ones inside the mouth.
        if 'speaking' in done and 'desk_hero' in done:
            hero_p, spk_p = done['desk_hero'], done['speaking']
            region = mouth_region(hero_p, spk_p)
            if region:
                mask, (cx, cy, rx, ry) = region
                out = swap_region(hero_p, spk_p, mask)
                # Outside the feather, the hero verbatim.
                out = Image.composite(
                    out, hero_p,
                    Image.fromarray(((mask[:, :, 0] > 0.02) * 255)
                                    .astype(np.uint8)))
                # Quantised, and this is not cosmetic. The swap blends two
                # 256-colour plates and invents colours; saved as-is the
                # result had over a thousand, which is exactly the test
                # `conditioned_already` uses. The next run therefore read
                # the tool's own output back as source art, registered it
                # (scaling a 216px plate up five and a half times) and
                # conditioned it again, and the anchor's mouth degraded a
                # little further every run.
                out = quantise_like(out, hero_p)
                # Hero verbatim outside the feather, applied last so those
                # pixels are byte-identical and nothing but the mouth can
                # move.
                out = Image.composite(
                    out, hero_p,
                    Image.fromarray(((mask[:, :, 0] > 0.02) * 255)
                                    .astype(np.uint8)))
                out.save(os.path.join(ANCHOR_OUT, '%s_speaking.png' % sid))
                moved = int((np.abs(
                    np.asarray(out.convert('RGBA'), int)
                    - np.asarray(hero_p.convert('RGBA'), int)).sum(2) > 8).sum())
                print('   speaking: mouth only — %d px differ from the hero '
                      '(%.1f%% of the plate)'
                      % (moved, 100.0 * moved / (out.width * out.height)))
            else:
                print('   speaking: no clear mouth region — left whole')

        # The listening states get the same treatment with a bigger
        # region: the head turns, so the head is what is swapped and the
        # body stays the hero's own finished pixels. Switching whole
        # plates to turn a head moved the shoulders and the hands with it,
        # which is what made the turn read as a jump rather than a glance.
        for st in ('listening', 'listening_flip'):
            if st not in done or 'desk_hero' not in done:
                continue
            hero_p = done['desk_hero']
            region = head_region(hero_p, done[st])
            if not region:
                print('   %s: no clear head region — left whole' % st)
                continue
            mask, cut = region
            out = swap_region(hero_p, done[st], mask)
            out = Image.composite(
                out, hero_p,
                Image.fromarray(((mask[:, :, 0] > 0.02) * 255).astype(np.uint8)))
            out = quantise_like(out, hero_p)
            out = Image.composite(
                out, hero_p,
                Image.fromarray(((mask[:, :, 0] > 0.02) * 255).astype(np.uint8)))
            out.save(os.path.join(ANCHOR_OUT, '%s_%s.png' % (sid, st)))
            moved = int((np.abs(
                np.asarray(out.convert('RGBA'), int)
                - np.asarray(hero_p.convert('RGBA'), int)).sum(2) > 8).sum())
            print('   %s: head only, cut at row %d of %d — %d px differ '
                  'from the hero (%.1f%%)'
                  % (st, cut, out.height, moved,
                     100.0 * moved / (out.width * out.height)))

        # No `listening_flip` is derived here any more.
        #
        # It was, by mirroring the rows above the neck of the finished
        # listening plate. Three different cut rules were tried and each
        # one cut a face somewhere: through the Klackon's mandibles, then
        # through the human's chest (which mirrored the GNN badge with it),
        # then at a pivot that left the mirrored head sitting a few pixels
        # off the shoulders it was supposed to join. Finding the neck from
        # a silhouette works until it does not, and when it does not the
        # result is a damaged picture, not a missing one.
        #
        # A flip is one click in an image editor, and the eye that does it
        # can see the badge. So `listening_flip` is now just another
        # supplied plate: drop it in `_inbox/` and it is conditioned like
        # the rest. Without one the renderer falls back to `listening`,
        # which looks the wrong way for a seat on the speaker's right but
        # is not broken art.

        # `listening` is excluded from the size comparison on purpose. It is
        # a head turn now, and a turned head is legitimately narrower than a
        # square-on one — comparing them reported 14% variance and called a
        # correct plate a failure. The hero and the speaking plate are both
        # square to camera, so they are the pair worth comparing.
        square = {k: v for k, v in metrics.items()
                  if not k.startswith('listening')}
        tops = [m['top'] for m in square.values()] or [0]
        heads = [m['head'] for m in square.values() if m['head']]
        drift = max(tops) - min(tops)
        scale = (max(heads) / float(min(heads)) - 1) * 100 if heads else 0
        print('%s: %d states at %dpx tall' % (sid, len(found), CAST_H))
        for st in STATES:
            m = metrics.get(st)
            if m:
                print('   %-10s head top %4d   head width %4d'
                      % (st, m['top'], m['head']))
        # Did the variants change what they were asked to change?
        if hero_im is not None and bands:
            if 'listening' in found:
                shift = band_changed(
                    hero_im, Image.open(found['listening']).convert('RGBA'),
                    bands['eyes'])
                if shift is not None and abs(shift) < 1.2:
                    print('   listening: eyeline unchanged (%.1f%%) — worth a '
                          'look; it may be the hero with noise on it' % shift)
        if 'desk_hero' not in found or 'speaking' not in found:
            print('   INCOMPLETE: needs at least desk_hero and speaking')
        elif drift > 20 or scale > 8:
            print('   REJECT: head top drifts %d px, head size varies %.0f%% '
                  '— the states are not the same drawing' % (drift, scale))
            print('   Make the two variants as edits of the hero, not as '
                  'fresh generations.')
        else:
            print('   OK: states align (head drift %d px, size %.1f%%)'
                  % (drift, scale))
        print('   Check by eye that no desk is drawn into the plate.')


def do_cutaways():
    """Fit the story plates to the frame.

    They are full-bleed pictures rather than cut-outs, so there is nothing
    to de-fringe; they want the frame's shape, a hard palette and none of
    the half-megabyte of colour an image model hands back.
    """
    if not os.path.isdir(CUTAWAY_OUT):
        return
    names = sorted(f for f in os.listdir(CUTAWAY_OUT) if f.endswith('.png'))
    done = 0
    for name in names:
        path = os.path.join(CUTAWAY_OUT, name)
        im = Image.open(path).convert('RGBA')
        if conditioned_already(im):
            continue
        os.makedirs(RAW_KEEP, exist_ok=True)
        shutil.copy2(path, os.path.join(RAW_KEEP, name))
        im = quantise(resize_premultiplied(im, (VIEW_W, VIEW_H)))
        im.save(path)
        done += 1
    if done:
        print('\n--- cutaways ---')
        print('%d of %d fitted to %dx%d' % (done, len(names), VIEW_W, VIEW_H))


def main():
    os.makedirs(OUT, exist_ok=True)
    made = {}
    layout = {'view': {'w': VIEW_W, 'h': VIEW_H}, 'anchors': ANCHOR_BAND,
              'plates': {}}
    for src_name, out_name, frac, role in PLATES:
        dest = os.path.join(OUT, out_name)
        src = find_source(src_name, out_dir=OUT)
        if src and os.path.abspath(src) == os.path.abspath(dest):
            # Dropped straight into the output directory; keep the raw before
            # the conditioned version lands on top of it.
            os.makedirs(RAW_KEEP, exist_ok=True)
            shutil.copy2(src, os.path.join(RAW_KEEP, src_name))
        if not src:
            # A missing source is not a reason to forget a plate that has
            # already been conditioned: re-read it so its entry survives, and
            # only say nothing is there when nothing is.
            if os.path.exists(dest):
                im = Image.open(dest).convert('RGBA')
                made[out_name] = im
                spot = {'w': im.width, 'h': im.height, 'role': role}
                if role == 'room':
                    spot.update(x=0, y=0)
                elif role == 'desk':
                    spot.update(x=(VIEW_W - im.width) // 2,
                                y=VIEW_H - im.height)
                layout['plates'][out_name] = spot
                print('%-24s -- source gone, keeping conditioned %dx%d'
                      % (src_name, im.width, im.height))
            else:
                print('not found anywhere, skipped: %s' % src_name)
            continue
        im = condition(src, frac)
        if role == 'room':
            # Cut the glass out so a backdrop can be drawn behind it.
            im, box = punch_window(im)
            if box:
                layout['window'] = {'x0': round(box[0], 4),
                                    'y0': round(box[1], 4),
                                    'x1': round(box[2], 4),
                                    'y1': round(box[3], 4)}
                print('%-24s    window keyed: %.3f,%.3f - %.3f,%.3f'
                      % ('', box[0], box[1], box[2], box[3]))
        im.save(dest)
        made[out_name] = im
        spot = {'w': im.width, 'h': im.height, 'role': role}
        if role == 'room':
            spot.update(x=0, y=0)
        elif role == 'desk':
            spot.update(x=(VIEW_W - im.width) // 2, y=VIEW_H - im.height)
        layout['plates'][out_name] = spot
        where = ('at (%d,%d)' % (spot['x'], spot['y'])) if 'x' in spot else 'unplaced prop'
        print('%-24s -> set/%-22s %3dx%-3d %-14s %d colours'
              % (src_name, out_name, im.width, im.height, where,
                 len(im.convert('RGB').getcolors(1 << 16) or [])))

    # Backdrops: what is seen through that hole. Conditioned to the shape
    # of the window opening rather than the frame, because that is the only
    # part of them anyone ever sees.
    win = layout.get('window')
    if win:
        os.makedirs(BACKDROP_OUT, exist_ok=True)
        ww = max(1, int(round((win['x1'] - win['x0']) * VIEW_W)))
        wh = max(1, int(round((win['y1'] - win['y0']) * VIEW_H)))
        names = set()
        for root in SRC_ROOTS + [BACKDROP_OUT]:
            if os.path.isdir(root):
                names.update(f for f in os.listdir(root)
                             if f.endswith('.png') and _is_backdrop(f))
        for name in sorted(names):
            src = find_source(name, out_dir=BACKDROP_OUT)
            if not src:
                continue
            bim = Image.open(src).convert('RGB')
            scale = max(ww / bim.width, wh / bim.height)
            bim = bim.resize((max(1, round(bim.width * scale)),
                              max(1, round(bim.height * scale))),
                             Image.LANCZOS)
            left = (bim.width - ww) // 2
            top = (bim.height - wh) // 2
            bim = bim.crop((left, top, left + ww, top + wh))
            bim = bim.quantize(colors=256, method=Image.MEDIANCUT).convert('RGB')
            bim.save(os.path.join(BACKDROP_OUT, name))
            print('%-24s -> backdrops/%-20s %3dx%-3d' % (name, name, ww, wh))

    # Field correspondents.
    #
    # They appear in the monitor above the desk, not on a second set — one
    # portrait instead of a room, per docs/ROADMAP.md. The chest-cropped
    # generation archived in `_inbox/field/` is the right framing for that;
    # the full-torso plates are the anchors' and are too wide for a PIP.
    field_src = os.path.join(RAW_KEEP, 'field')
    if os.path.isdir(field_src):
        os.makedirs(CORRESPONDENT_OUT, exist_ok=True)
        ph = int(VIEW_H * PIP_H * 0.92)
        done_n = 0
        for name in sorted(os.listdir(field_src)):
            if not name.endswith(('_desk_hero.png', '_speaking.png')):
                continue
            im = Image.open(os.path.join(field_src, name)).convert('RGBA')
            im = crop_to_content(defringe(im))
            w = max(1, round(im.width * ph / im.height))
            im = quantise(resize_premultiplied(im, (w, ph)))
            out_name = name.replace('_desk_hero.png', '_hero.png')
            im.save(os.path.join(CORRESPONDENT_OUT, out_name))
            done_n += 1
        print('correspondents            -> %d plates at %dpx tall'
              % (done_n, ph))

    with open(os.path.join(OUT, 'layout.json'), 'w') as fh:
        json.dump(layout, fh, indent=2)
    print('layout -> assets/generated/set/layout.json')

    if '--preview' in sys.argv and 'studio_wide_empty.png' in made:
        room = made['studio_wide_empty.png'].copy()
        band = ImageDraw.Draw(room, 'RGBA')
        by, bh = int(VIEW_H * ANCHOR_BAND['y']), int(VIEW_H * ANCHOR_BAND['h'])
        band.rectangle([VIEW_W // 2 - 46, by, VIEW_W // 2 + 46, by + bh],
                       outline=(255, 0, 128, 180))
        for name in ('desk_oval_front.png',):
            im2 = made.get(name)
            if im2 is None:
                continue
            spot = layout['plates'][name]
            room.alpha_composite(im2, (spot['x'], spot['y']))
        big = room.resize((room.width * 3, room.height * 3), Image.NEAREST)
        p = os.path.join(ROOT, 'docs', 'set-preview.png')
        big.save(p)
        print('preview (room + desk, at the 3x the engine uses) -> docs/set-preview.png')
    do_anchors()
    do_cutaways()
    return 0


if __name__ == '__main__':
    sys.exit(main())
