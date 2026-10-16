#!/usr/bin/env python3
"""Merge per-archive MoO2 manifests into assets/gfx-manifest.json.

extract_moo2.py writes one manifest.json per archive under
assets/cutscenes/moo2/<ARCHIVE>/. The GNN runtime reads a single file at
assets/gfx-manifest.json and looks up entries by directory name. This
tool combines them.

The merge is additive and non-destructive: existing MoO1 entries under a
top-level key are preserved, and a MoO2 archive whose name collides with a
MoO1 one (SHIPS, MONSTER, PLANETS) is stored under a "<NAME>_moo2" key so
the two libraries never overwrite each other.
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, 'assets', 'gfx-manifest.json')
MOO2_DIR = os.path.join(ROOT, 'assets', 'cutscenes', 'moo2')

# A few MoO2 archives share a name with a MoO1 archive. MoO1 already owns
# the top-level key, so the MoO2 side is namespaced to keep both reachable
# via GNNAssets.find({dir: ...}).
COLLISION_SUFFIX = '_moo2'


def main():
    if not os.path.isdir(MOO2_DIR):
        print('no MoO2 extraction directory at %s' % MOO2_DIR)
        return 1

    try:
        with open(MANIFEST) as fh:
            top = json.load(fh)
    except (OSError, ValueError) as err:
        print('cannot read %s: %s' % (MANIFEST, err))
        return 1

    # Snapshot MoO1 dirs so we know which keys are already in use.
    moo1_keys = set(top.keys())
    added = 0
    merged = 0

    for name in sorted(os.listdir(MOO2_DIR)):
        archive_dir = os.path.join(MOO2_DIR, name)
        archive_manifest = os.path.join(archive_dir, 'manifest.json')
        if not os.path.isfile(archive_manifest):
            continue

        try:
            with open(archive_manifest) as fh:
                arc = json.load(fh)
        except (OSError, ValueError) as err:
            print('%-16s skip (%s)' % (name, err))
            continue

        items = arc.get('items') or []
        if not items:
            continue

        # The archive key. Collision with an existing MoO1 archive is
        # resolved by suffixing the MoO2 side.
        key = name.upper()
        if key in moo1_keys and top.get(key) and top[key]:
            key = key + COLLISION_SUFFIX

        # Each entry needs: id, source, dir, item, w, h, frames, hero,
        # role, pools, and the file paths. extract_moo2.py already writes
        # most of this; the merge adds source/dir consistency and stashes
        # the per-archive manifest path so the runtime can find it.
        for e in items:
            e.setdefault('source', 'moo2')
            e.setdefault('dir', name)
            e['manifest_path'] = 'assets/cutscenes/moo2/%s/manifest.json' % name
            e['frames_dir'] = 'assets/cutscenes/moo2/%s' % name

        if key in top:
            top[key].extend(items)
            merged += len(items)
        else:
            top[key] = items
            added += len(items)

        print('%-16s -> %-20s +%d items' % (name, key, len(items)))

    with open(MANIFEST, 'w') as fh:
        json.dump(top, fh, separators=(',', ':'))

    total = sum(len(v) for v in top.values())
    print('\n%d MoO2 items added, %d appended to existing keys' % (added, merged))
    print('gfx-manifest.json now holds %d items across %d keys'
          % (total, len(top)))
    return 0


if __name__ == '__main__':
    sys.exit(main())