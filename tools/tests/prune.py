"""Drop manifest entries whose frames are no longer on disk.

The owner deleted a few hundred decoded items by hand — UI buttons and the
like that were never wanted as footage. Re-running `extract_all.py` would
put them straight back, because it decodes from the archives; the manifest
is what has to change instead.

An entry goes if its first frame is missing. Entries that keep some frames
have their count corrected rather than being dropped.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # repo root
MAN = os.path.join(ROOT, 'assets', 'gfx-manifest.json')
CUT = os.path.join(ROOT, 'assets', 'cutscenes')


def frame_path(e, i):
    # MoO2 items live under cutscenes/moo2/<DIR>/ (entry.source == 'moo2').
    src = e.get('source')
    base = os.path.join(CUT, src, e['dir']) if src else os.path.join(CUT, e['dir'])
    return os.path.join(base, 'item_%02d_frame_%03d.png' % (e['item'], i))


m = json.load(open(MAN))
dropped, trimmed, kept = 0, 0, 0
out = {}
for d, items in m.items():
    # Bookkeeping keys (`_moo2_keys`, …) are not archive lists: keep as is.
    # The first version of this tool crashed on them, and would have
    # dropped them from the file it wrote back.
    if d.startswith('_') or not isinstance(items, list) or (items and not isinstance(items[0], dict)):
        out[d] = items
        continue
    keep = []
    for e in items:
        have = 0
        for i in range(e.get('frames', 1)):
            if os.path.exists(frame_path(e, i)):
                have += 1
            else:
                break
        if not have:
            dropped += 1
            continue
        if have != e.get('frames', 1):
            e['frames'] = have
            trimmed += 1
        gif = e.get('gif')
        if gif and not os.path.exists(os.path.join(os.path.dirname(frame_path(e, 0)),
                                                   os.path.basename(gif))):
            e['gif'] = None
        keep.append(e)
        kept += 1
    if keep:
        out[d] = keep
json.dump(out, open(MAN, 'w'), indent=1)
print('kept %d, dropped %d, frame-count corrected %d' % (kept, dropped, trimmed))
from collections import Counter
pools = Counter()
for items in out.values():
    if not isinstance(items, list):
        continue
    for e in items:
        if not isinstance(e, dict):
            continue
        for p in e.get('pools') or []:
            pools[p] += 1
print('pools:', dict(pools))
