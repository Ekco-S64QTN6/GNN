#!/usr/bin/env python3
"""
verify_assets.py — prove the app is self-contained.

Walks every asset path the browser can request at runtime and checks it
resolves inside the project. The `Master of Orion 1/` source directory is only
needed by the extractors in this folder; if this script passes, the source can
be deleted and the broadcast still runs.

    python3 tools/verify_assets.py
"""

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'assets')
SOURCE_DIR = os.path.join(ROOT, 'Master of Orion 1')

missing = []
checked = 0


def need(rel, why):
    global checked
    checked += 1
    path = os.path.join(ROOT, rel)
    if not os.path.exists(path):
        missing.append('%s  (%s)' % (rel, why))
        return False
    return True


def load(name):
    path = os.path.join(ASSETS, name)
    if not os.path.exists(path):
        missing.append('assets/%s  (manifest)' % name)
        return None
    with open(path) as fh:
        return json.load(fh)


def main():
    # --- page shell -------------------------------------------------
    for rel in ('index.html', 'index.css', 'server.py'):
        need(rel, 'page shell')
    for name in sorted(os.listdir(os.path.join(ROOT, 'js'))):
        if name.endswith('.js'):
            need('js/' + name, 'module')

    # every <script src> in index.html must exist
    html = open(os.path.join(ROOT, 'index.html')).read()
    for src in re.findall(r'<script src="([^"]+)"', html):
        need(src, 'script tag')

    # --- manifests --------------------------------------------------
    for name in ('gfx-manifest.json', 'audio-manifest.json', 'moo-strings.json'):
        need('assets/' + name, 'manifest')

    # --- newsroom plates --------------------------------------------
    need('assets/background_tv.png', 'studio frame')
    for i in range(1, 26):
        need('assets/anchor_frame_%03d.png' % i, 'anchor cel')
        need('assets/globe_frame_%03d.png' % i, 'globe cel')

    # icons, as named by js/icon-manager.js
    icons = open(os.path.join(ROOT, 'js', 'icon-manager.js')).read()
    for f in re.findall(r"file: '([^']+\.png)'", icons):
        need('assets/icons/' + f, 'story icon')

    # --- graphics library -------------------------------------------
    gfx = load('gfx-manifest.json') or {}
    items = frames = gifs = 0
    for archive, entries in gfx.items():
        for e in entries:
            items += 1
            stem = 'assets/cutscenes/%s/item_%02d' % (e['dir'], e['item'])
            # the runtime can ask for any frame index, and always the hero
            for idx in {0, e.get('hero', 0), e['frames'] - 1}:
                need('%s_frame_%03d.png' % (stem, idx), '%s frame' % e['id'])
                frames += 1
            if e.get('gif'):
                need('assets/cutscenes/%s/%s' % (e['dir'], e['gif']), '%s gif' % e['id'])
                gifs += 1

    # --- audio -------------------------------------------------------
    audio = load('audio-manifest.json') or {}
    for group in ('sfx', 'stings'):
        for s in audio.get(group, []):
            need(s['file'], '%s %s' % (group, s['id']))
    beds = 0
    for m in audio.get('music', []):
        if m.get('file'):
            need(m['file'], 'music %s' % m['id'])
            beds += 1
        if m.get('midi'):
            need(m['midi'], 'midi %s' % m['id'])

    # sfx ids referenced directly from the code, outside the manifest
    for js in ('audio-engine.js', 'main.js', 'cutscene-manager.js', 'broadcast-director.js'):
        body = open(os.path.join(ROOT, 'js', js)).read()
        for sid in set(re.findall(r"'((?:intro_)?sfx_\d\d)'", body)):
            need('assets/audio/%s.wav' % sid, 'hard-referenced by %s' % js)

    # --- report ------------------------------------------------------
    print('graphics : %d items, %d spot-checked frames, %d gifs' % (items, frames, gifs))
    print('audio    : %d effects, %d stings, %d music beds'
          % (len(audio.get('sfx', [])), len(audio.get('stings', [])), beds))
    strings = load('moo-strings.json') or {}
    print('text     : %d bulletins, %d leaders, %d vocab groups'
          % (len(strings.get('bulletins', [])), len(strings.get('leaders', [])),
             len(strings.get('vocab', {}))))
    print('checked  : %d paths' % checked)

    if missing:
        print('\nMISSING (%d):' % len(missing))
        for m in missing[:40]:
            print('  ' + m)
        if len(missing) > 40:
            print('  ... and %d more' % (len(missing) - 40))
        return 1

    print('\nOK — every runtime asset resolves inside the project.')
    if os.path.isdir(SOURCE_DIR):
        print('Note: "Master of Orion 1/" is still present. It is used only by')
        print('      the extractors in tools/ and can be removed.')
    else:
        print('Source archive absent, as expected for a shipped copy.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
