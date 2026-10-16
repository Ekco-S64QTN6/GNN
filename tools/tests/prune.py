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

ROOT = '/home/ekco/github/GNN'
MAN = os.path.join(ROOT, 'assets', 'gfx-manifest.json')
CUT = os.path.join(ROOT, 'assets', 'cutscenes')


def frame_path(e, i):
    return os.path.join(CUT, e['dir'], 'item_%02d_frame_%03d.png'
                        % (e['item'], i))


m = json.load(open(MAN))
dropped, trimmed, kept = 0, 0, 0
out = {}
for d, items in m.items():
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
        if gif and not os.path.exists(os.path.join(CUT, e['dir'],
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
    for e in items:
        for p in e.get('pools') or []:
            pools[p] += 1
print('pools:', dict(pools))
