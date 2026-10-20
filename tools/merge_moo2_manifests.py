#!/usr/bin/env python3
"""Merge per-archive MoO2 manifests into assets/gfx-manifest.json.

extract_moo2.py writes one manifest.json per archive under
assets/cutscenes/moo2/<ARCHIVE>/. The GNN runtime reads a single file at
assets/gfx-manifest.json and looks up entries by directory name. This
tool combines them.

The merge is additive and idempotent:

  - MoO1 entries are preserved untouched. Their top-level keys are the
    ones already present in the manifest before this tool runs, minus
    anything the tool itself wrote on a previous pass.

  - Keys this tool owns are tracked in a top-level `_moo2_keys` list.
    On every run those keys are removed from the manifest before the
    MoO2 archives are re-scanned, so running this tool twice in a row
    produces the same file rather than doubling every MoO2 entry. That
    is what makes the pipeline re-runnable after `extract_all.py` —
    which overwrites gfx-manifest.json wholesale and drops every MoO2
    entry — without a manual delete step.

  - A MoO2 archive whose name collides with a MoO1 archive (SHIPS,
    MONSTER, PLANETS, SHIPS2) is stored under a `<NAME>_moo2` key so
    both libraries coexist. The runtime does not care: `asset-registry.js`
    keys items by their own `dir` field, not by the manifest's top-level
    key, so a query for `{dirs: ['SHIPS']}` returns the MoO1 items and
    the MoO2 items together. The suffixed key is purely structural.

The runtime path builder (`asset-registry.js:framePath()`) resolves an
item to `<GFX_ROOT>/<source>/<dir>/item_NN_frame_NNN.png` when `source`
is set. MoO2 items carry `source: 'moo2'`, so their files are looked up
under `assets/cutscenes/moo2/<DIR>/` without the runtime needing any
further wiring. Only the pools on the entries — assigned by the
extractor — determine whether a recipe can find them.

Usage:
    python3 tools/merge_moo2_manifests.py
    python3 tools/merge_moo2_manifests.py --dry-run
    python3 tools/merge_moo2_manifests.py --moo2-dir /path/to/moo2-out
"""
import argparse
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_MANIFEST = os.path.join(ROOT, 'assets', 'gfx-manifest.json')
DEFAULT_MOO2_DIR = os.path.join(ROOT, 'assets', 'cutscenes', 'moo2')

# A few MoO2 archives share a name with a MoO1 archive. MoO1 already owns
# the top-level key, so the MoO2 side is namespaced to keep both reachable
# via GNNAssets.find({dir: ...}). See the module docstring for why the
# runtime does not care which key holds the entries.
COLLISION_SUFFIX = '_moo2'

# Top-level key under which the list of MoO2-owned manifest keys is
# stored. Underscore-prefixed so `asset-registry.js` — which iterates
# `Object.keys(gfx)` and treats every key as a directory — never walks
# it as one. Same convention the other manifest-level metadata uses.
MOO2_KEYS_FIELD = '_moo2_keys'


def load_manifest(path):
    """Read the manifest, or return an empty dict if it does not exist."""
    try:
        with open(path, encoding='utf-8') as fh:
            data = json.load(fh)
    except FileNotFoundError:
        return {}
    except (OSError, ValueError) as err:
        raise SystemExit('cannot read %s: %s' % (path, err))
    if not isinstance(data, dict):
        raise SystemExit('%s does not hold a JSON object' % path)
    return data


def moo1_keys(top):
    """Top-level keys the runtime should treat as MoO1 directory names.

    Everything that is not underscore-prefixed and is not in the MoO2
    ownership list. The underscore convention is load-bearing: the
    `asset-registry.js` loop over `Object.keys(gfx)` would otherwise
    try to walk `_moo2_keys` as if it held a list of item objects.
    """
    owned = set(top.get(MOO2_KEYS_FIELD) or [])
    return {k for k in top.keys()
            if not k.startswith('_') and k not in owned}


def is_moo2_list(items):
    """Whether a manifest value is a list of MoO2 items."""
    if not isinstance(items, list) or not items:
        return False
    return all(isinstance(e, dict) and e.get('source') == 'moo2'
               for e in items)


def collect_archives(moo2_dir):
    """Yield (archive_name, item_list) for every archive with a manifest."""
    if not os.path.isdir(moo2_dir):
        return
    for name in sorted(os.listdir(moo2_dir)):
        archive_dir = os.path.join(moo2_dir, name)
        manifest_path = os.path.join(archive_dir, 'manifest.json')
        if not os.path.isfile(manifest_path):
            continue
        try:
            with open(manifest_path, encoding='utf-8') as fh:
                arc = json.load(fh)
        except (OSError, ValueError) as err:
            print('%-16s skip (%s)' % (name, err), file=sys.stderr)
            continue
        items = arc.get('items') or []
        if not items:
            continue
        yield name, items


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--manifest', default=DEFAULT_MANIFEST,
                    help='path to assets/gfx-manifest.json')
    ap.add_argument('--moo2-dir', default=DEFAULT_MOO2_DIR,
                    help='directory holding the per-archive MoO2 output')
    ap.add_argument('--dry-run', action='store_true',
                    help='report what would change without writing')
    args = ap.parse_args()

    top = load_manifest(args.manifest)

    # Remove anything the previous run of this tool wrote, so the merge
    # is idempotent. `_moo2_keys` was introduced in this version; an
    # earlier manifest that predates it will have MoO2 keys under the
    # `_moo2` suffix without being listed. Those are cleaned up by the
    # suffix sweep below so an upgrade does not leave orphans behind.
    owned = set(top.pop(MOO2_KEYS_FIELD, None) or [])
    orphans = 0
    for key in list(top.keys()):
        if key in owned or key.endswith(COLLISION_SUFFIX):
            top.pop(key, None)
        elif is_moo2_list(top.get(key)):
            # A MoO2 archive under a plain key that this tool did not
            # record as its own. 316 of these were in the manifest: hollow
            # stubs with `source: 'moo2'` and no pools or measurements,
            # left by an earlier run. They were then read as MoO1 archives
            # by the line below, so every real MoO2 archive "collided" with
            # its own ghost and was written under a `_moo2` suffix beside
            # it — and the next merge saw the ghosts as MoO1 again. Each
            # MoO2 item was in the manifest twice and the boot log's asset
            # count was inflated by every one of them.
            #
            # Recognised by content, not by name, because the name is the
            # thing that went wrong.
            top.pop(key, None)
            orphans += 1
    if orphans:
        print('removed %d orphaned MoO2 keys left by an earlier run' % orphans)

    # Now that our own previous output is gone, whatever remains with a
    # non-underscore name is MoO1's.
    moo1 = moo1_keys(top)

    added = 0
    merged = 0
    written_keys = []

    for name, items in collect_archives(args.moo2_dir):
        key = name.upper()
        if key in moo1:
            key = key + COLLISION_SUFFIX
        top[key] = items
        written_keys.append(key)
        added += len(items)
        print('%-16s -> %-20s +%d items' % (name, key, len(items)))

    if not written_keys:
        # No MoO2 output on disk. Still write the ownership list, so a
        # follow-up run does not mistake a stale `_moo2` suffix from a
        # previous install for a live MoO1 key.
        print('no MoO2 archives found under %s' % args.moo2_dir)

    top[MOO2_KEYS_FIELD] = sorted(written_keys)

    if args.dry_run:
        total = sum(len(v) for k, v in top.items()
                    if not k.startswith('_') and isinstance(v, list))
        print('\ndry run — %d MoO2 items would be merged across %d keys'
              % (added, len(written_keys)))
        print('manifest would hold %d items across %d directory keys'
              % (total, len([k for k in top
                             if not k.startswith('_')])))
        return 0

    with open(args.manifest, 'w', encoding='utf-8') as fh:
        json.dump(top, fh, separators=(',', ':'))
        fh.write('\n')

    total = sum(len(v) for k, v in top.items()
                if not k.startswith('_') and isinstance(v, list))
    dir_keys = len([k for k in top if not k.startswith('_')])
    print('\n%d MoO2 items merged into %d keys'
          % (added, len(written_keys)))
    print('gfx-manifest.json now holds %d items across %d directory keys'
          % (total, dir_keys))
    print('MoO2-owned keys tracked: %s' % ', '.join(sorted(written_keys)))
    return 0


if __name__ == '__main__':
    sys.exit(main())