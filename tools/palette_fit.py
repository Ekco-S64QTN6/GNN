#!/usr/bin/env python3
"""palette_fit.py — find items whose palette is unlike their siblings'.

NEGATIVE RESULT FIRST, because the next person will try the same idea:
**choosing a palette automatically from image statistics does not work.**
Two principled attempts are in the history of this file and both failed
`--validate`, which checks a proposal against six archives already settled
by community data and by eye:

  1. Ramp smoothness — mean colour step between adjacent opaque pixels.
     Rewards whichever palette has the least internal contrast, so the
     flattest palette wins every archive. 0 of 6.
  2. The same, normalised against the palette's own shuffle, to cancel
     that contrast bias. Still 0 of 6.

So this tool does not pick palettes. It does the weaker thing that is
actually defensible: it reports which items in an archive use a *different
range of palette indices* from their siblings. That is a fact about the
file, not a judgement about colour, and it is exactly the shape of the
reported problem — "some items in folders use different numbers than other
items in the folder". Those items are then settled by eye with
`palette_compare.py`, which renders one item against every palette.


The per-archive palette problem is solved; what is left is per-item. Items
inside one archive do not always share a palette, and `scan_moo2_quality.py`
only catches the gross failure — indices collapsing to a solid blob.

The signal used here is **ramp smoothness**.

Hand-drawn sprite art shades with palette ramps: consecutive indices are
consecutive shades of one hue. Neighbouring pixels in the image are usually
neighbouring indices in a ramp. Under the right palette those neighbours are
a small colour step apart and a gradient reads as a gradient. Under the wrong
palette the same indices land on unrelated colours and every shaded surface
turns to confetti.

So: mean colour distance between horizontally and vertically adjacent opaque
pixels. Lower is better. It needs no judgement about whether a picture looks
nice, which is the trap every previous metric in this project fell into.

Validated before use — see `--validate`, which checks the score against the
palettes already confirmed by eye and by the community data.

    python3 tools/palette_fit.py --validate
    python3 tools/palette_fit.py --archive CMBTSHP
    python3 tools/palette_fit.py --scan --write
"""
import argparse
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lbx                                                 # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOO2 = os.path.join(ROOT, 'Master of Orion 1', 'mastori2')
PMAP = os.path.join(ROOT, 'tools', 'palette_map.json')
# The external palette archives. Item 0 of each is font data, not a palette.
SOURCES = ('FONTS', 'IFONTS')
CANDIDATES = tuple(range(1, 14))


def palettes():
    """Every candidate palette, keyed (source, index)."""
    out = {}
    for src in SOURCES:
        path = os.path.join(MOO2, src + '.LBX')
        if not os.path.exists(path):
            continue
        for i in CANDIDATES:
            try:
                pal = lbx.get_moo2_palette(path, i)
            except Exception:                              # noqa: BLE001
                continue
            if pal:
                out[(src, i)] = pal
    return out


def roughness(raw, w, h):
    """Mean colour step between adjacent opaque pixels. Lower fits better.

    `render_rgba` hands back packed RGBA bytes and a flag, not an image.
    """
    a = np.frombuffer(raw, dtype=np.uint8)
    if a.size != w * h * 4:
        return None, 0
    a = a.reshape(h, w, 4).astype(np.int16)
    op = a[:, :, 3] > 128
    if op.sum() < 40:
        return None, 0
    rgb = a[:, :, :3]
    steps = []
    for dy, dx in ((0, 1), (1, 0)):
        sl_a = (slice(None, h - dy or None), slice(None, w - dx or None))
        sl_b = (slice(dy, None), slice(dx, None))
        both = op[sl_a] & op[sl_b]
        if not both.any():
            continue
        steps.append(np.abs(rgb[sl_a] - rgb[sl_b]).sum(axis=2)[both])
    if not steps:
        return None, 0
    return float(np.concatenate(steps).mean()), int(op.sum())


def _rough_from_indices(idx, op, pal_rgb, h, w):
    """Roughness of an index map rendered through `pal_rgb`."""
    rgb = pal_rgb[idx]
    steps = []
    for dy, dx in ((0, 1), (1, 0)):
        sl_a = (slice(None, h - dy or None), slice(None, w - dx or None))
        sl_b = (slice(dy, None), slice(dx, None))
        both = op[sl_a] & op[sl_b]
        if not both.any():
            continue
        steps.append(np.abs(rgb[sl_a].astype(np.int16)
                            - rgb[sl_b].astype(np.int16)).sum(axis=2)[both])
    if not steps:
        return None
    return float(np.concatenate(steps).mean())


def score_item(item, pals, index_map, frame=0, shuffles=6, rng=None):
    """How much better than chance each palette's ramps are, best first.

    Plain roughness does not work and was discarded: it rewards whichever
    palette has the least internal contrast, so the flattest one wins every
    archive regardless of fit. Checked against six palettes already settled
    by the community data and by eye, it agreed with none of them.

    What is actually being asked is whether consecutive indices in *this*
    image land on consecutive colours in *this* palette — whether the
    palette's ramps are the ramps the artist drew with. So the image's real
    roughness is compared against the same image rendered through the same
    palette with its colours shuffled. A correct palette is far smoother
    than its own shuffle; a wrong one is no better than chance, because its
    ramps mean nothing to these indices.

    Scoring the ratio cancels out palette contrast, which is what made the
    first attempt useless.
    """
    idx, op, h, w = index_map
    if idx is None:
        return []
    rng = rng or np.random.default_rng(12345)
    out = []
    for key, pal in pals.items():
        # The palette is a dict keyed by index, not a list.
        pal_rgb = np.array([tuple(pal.get(i, (0, 0, 0)))[:3]
                            for i in range(256)], dtype=np.uint8)
        real = _rough_from_indices(idx, op, pal_rgb, h, w)
        if real is None:
            continue
        chance = []
        for _ in range(shuffles):
            perm = rng.permutation(256)
            chance.append(_rough_from_indices(idx, op, pal_rgb[perm], h, w))
        chance = [c for c in chance if c is not None]
        if not chance:
            continue
        ref = float(np.mean(chance))
        if ref <= 0:
            continue
        out.append((real / ref, key, int(op.sum())))
    out.sort()
    return out


def index_map_of(item, frame=0):
    """The frame's palette indices and an opacity mask.

    `decode_frame` gives the index plane; `render_rgba` is used only for its
    alpha, because MoO2 transparency is absent runs rather than a reserved
    index and only the renderer knows which zeros were drawn.
    """
    try:
        raw_idx, _ = item.decode_frame(frame)
        rgba, _ = item.render_rgba(frame, {i: (0, 0, 0) for i in range(256)})
    except Exception:                                      # noqa: BLE001
        return (None, None, 0, 0)
    w, h = item.w, item.h
    if len(raw_idx) != w * h or len(rgba) != w * h * 4:
        return (None, None, 0, 0)
    idx = np.frombuffer(bytes(raw_idx), dtype=np.uint8).reshape(h, w)
    op = np.frombuffer(rgba, dtype=np.uint8).reshape(h, w, 4)[:, :, 3] > 128
    if op.sum() < 40:
        return (None, None, 0, 0)
    return (idx, op, h, w)


# Palettes already settled, by community data or by the owner's eye. The
# scorer has to agree with these before it is allowed an opinion about
# anything else.
KNOWN = [
    ('CMBTSHP', 1, 'verified by eye; palette 3 rendered solid green'),
    ('CMBTMISL', 1, 'same family, same fix'),
    ('CMBTFGTR', 1, 'same family, same fix'),
    ('CMBTPLNT', 1, 'same family, same fix'),
    ('SHIPS', 12, 'liblbx moo2-data.txt'),
    ('SHIPS2', 12, 'liblbx moo2-data.txt'),
]


def items_of(archive, limit=None):
    path = os.path.join(MOO2, archive + '.LBX')
    if not os.path.exists(path):
        return []
    try:
        ar = lbx.LbxArchive(path)
    except Exception:                                      # noqa: BLE001
        return []
    out = []
    for i in range(len(ar)):
        try:
            it = lbx.GfxItem(ar.item(i), format='moo2')
        except Exception:                                  # noqa: BLE001
            continue
        if it.plausible() and it.nframes:
            out.append((i, it))
        if limit and len(out) >= limit:
            break
    return out


def archive_verdict(archive, pals, limit=14):
    """Which palette fits most items of this archive, and how clearly."""
    tally, detail = {}, []
    for idx, item in items_of(archive, limit):
        ranked = score_item(item, pals, index_map_of(item))
        if len(ranked) < 2:
            continue
        best, second = ranked[0], ranked[1]
        tally[best[1]] = tally.get(best[1], 0) + 1
        detail.append((idx, best[1], best[0], second[0]))
    if not tally:
        return None, 0, detail
    win = max(tally.items(), key=lambda kv: kv[1])
    return win[0], win[1] / max(1, sum(tally.values())), detail


def validate(pals):
    print('Checking the scorer against palettes already settled.\n')
    ok = 0
    for archive, want, why in KNOWN:
        got, share, _ = archive_verdict(archive, pals)
        if got is None:
            print('  %-10s no items decoded' % archive)
            continue
        hit = got[1] == want
        ok += hit
        print('  %-10s wants %-3s got %-10s %5.0f%% of items   %s  (%s)'
              % (archive, want, '%s %d' % got, share * 100,
                 'OK' if hit else 'MISS', why))
    print('\n%d of %d known archives agree.' % (ok, len(KNOWN)))
    return ok


def index_profile(item, frame=0):
    """Which palette indices this item draws with, as a 16-bucket histogram.

    Buckets rather than raw indices because two frames of the same ship use
    neighbouring shades of one ramp; what distinguishes a differently-
    palettised sibling is which *region* of the palette it lives in.
    """
    idx, op, h, w = index_map_of(item, frame)
    if idx is None:
        return None
    vals = idx[op]
    if vals.size < 40:
        return None
    hist = np.bincount(vals >> 4, minlength=16).astype(float)
    return hist / hist.sum()


def outliers(archive, limit=None, z=2.5):
    """Items whose index profile is unlike the archive's own consensus.

    Median and MAD rather than mean and standard deviation: the thing being
    looked for is a minority of odd items, and a mean is dragged toward
    whatever it is supposed to be finding.
    """
    profs = []
    for idx, item in items_of(archive, limit):
        p = index_profile(item)
        if p is not None:
            profs.append((idx, p))
    if len(profs) < 6:
        return [], len(profs)
    mat = np.array([p for _, p in profs])
    centre = np.median(mat, axis=0)
    dist = np.abs(mat - centre).sum(axis=1)
    med = float(np.median(dist))
    spread = float(np.median(np.abs(dist - med))) or 1e-6
    flagged = []
    for (idx, _), d in zip(profs, dist):
        score = (d - med) / (spread * 1.4826)
        if score >= z:
            flagged.append((idx, float(score), float(d)))
    flagged.sort(key=lambda t: -t[1])
    return flagged, len(profs)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--validate', action='store_true',
                    help='check a palette proposal against settled archives')
    ap.add_argument('--archive', help='comma-separated archive names')
    ap.add_argument('--scan', action='store_true',
                    help='every MoO2 archive in the palette map')
    ap.add_argument('--limit', type=int, default=0,
                    help='items per archive, 0 for all')
    ap.add_argument('--z', type=float, default=2.5)
    args = ap.parse_args()

    if args.validate:
        pals = palettes()
        print('%d candidate palettes loaded\n' % len(pals))
        return 0 if validate(pals) == len(KNOWN) else 1

    names = []
    if args.archive:
        names = args.archive.split(',')
    elif args.scan:
        with open(PMAP, encoding='utf-8') as fh:
            pm = json.load(fh)
        names = sorted(k for k in pm if not k.startswith('_')
                       and not k.startswith('TANM_'))
    else:
        ap.error('pass --archive, --scan or --validate')

    limit = args.limit or None
    total = 0
    print('Items whose palette indices are unlike their siblings.')
    print('These are candidates to settle by eye with palette_compare.py;')
    print('an outlier is a fact about the file, not proof of a wrong palette.\n')
    for arch in names:
        flagged, n = outliers(arch, limit, args.z)
        if not flagged:
            continue
        total += len(flagged)
        print('%-12s %2d of %3d items' % (arch, len(flagged), n))
        for idx, score, _ in flagged[:8]:
            print('     item %-4d  z=%.1f' % (idx, score))
    print('\n%d flagged across %d archives.' % (total, len(names)))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
