"""Offline checks on the content tables. No browser, no server.

Safe to run while the station is on air: it reads the source files and
`assets/`, and loads `cast.js` and `script-writer.js` in Node. Exits 1 if a
structural check fails, so it can gate a change.

Fails on:
  - a scheduled pair with no exchange in either direction
    (19 of 22 pairs had none: their banter stitched stock lines together)
  - a show promo that does not resolve to a configured show with a title
    card and a `covers` line
  - a non-sports show drawing the sports bucket
  - a scheduled show with no title card on disk

Reports, without failing, art that the code names but that is not on disk
yet — the roadmap wires prompts in before their art exists.

    python3 tools/tests/content_check.py
"""
import json
import os
import re
import subprocess
import sys

ROOT = os.environ.get('GNN_ROOT') or os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GEN = os.path.join(ROOT, 'assets', 'generated')

NODE = r"""
global.window = { location: { search: '' }, addEventListener() {} };
global.GNNAssets = { vocab: () => [] };
const fs = require('fs');
eval(fs.readFileSync('js/cast.js', 'utf8').replace(/^const GNNCast/m, 'global.GNNCast'));
eval(fs.readFileSync('js/script-writer.js', 'utf8').replace(/^const GNNScript/m, 'global.GNNScript'));
const cfg = JSON.parse(fs.readFileSync('assets/generated/show-config.json'));
GNNScript.setShows(cfg.shows);
const promos = new Map();
for (let i = 0; i < 6000; i++) {
  const p = GNNScript.promo();
  if (!p.isPSA) promos.set(p.product, { card: p.titlecard, body: p.beats[1].text });
}
console.log(JSON.stringify({
  rel: GNNCast.RELATIONSHIPS.map((r) => [r.from, r.to]),
  promos: [...promos.entries()],
}));
"""

fails, notes = [], []


def fail(msg):
    fails.append(msg)


def main():
    cfg = json.load(open(os.path.join(GEN, 'show-config.json')))
    shows = cfg['shows']
    out = subprocess.run(['node', '-e', NODE], cwd=ROOT, capture_output=True, text=True)
    if out.returncode:
        print(out.stderr[-2000:])
        sys.exit(2)
    data = json.loads(out.stdout)
    rel = data['rel']

    # Exchanges for every seated pair, both ways.
    for s in shows:
        a, b = s['pair']
        ab = sum(1 for f, t in rel if f == a and t == b)
        ba = sum(1 for f, t in rel if f == b and t == a)
        if not ab or not ba:
            fail('pair %s+%s (%s) has %d/%d exchanges' % (a, b, s['id'], ab, ba))

    # Promos resolve to their show.
    promos = dict(data['promos'])
    for show, p in promos.items():
        if not p['card']:
            fail('promo "%s" found no show-config entry (title mismatch?)' % show)
        elif not os.path.exists(os.path.join(ROOT, p['card'])):
            fail('promo "%s" card missing: %s' % (show, p['card']))
        if not p['body'].startswith('Join ') or 'the news' in p['body'][-12:]:
            fail('promo "%s" body has no anchors or no covers: %s' % (show, p['body']))

    # Title cards.
    for s in shows:
        card = s.get('titlecard')
        if not card or not os.path.exists(os.path.join(GEN, 'titlecards', card)):
            fail('show %s has no title card on disk (%s)' % (s['id'], card))

    # Sport stays on the sports shows.
    src = open(os.path.join(ROOT, 'js', 'broadcast-director.js')).read()
    for m in re.finditer(r"\{ id: '([a-z_]+)'[^}]*genre: '([a-z]+)'(?:, draws: \[([^\]]*)\])?", src):
        sid, genre, draws = m.group(1), m.group(2), m.group(3) or ''
        if "'sports'" in draws and genre != 'sports':
            fail('%s (%s) draws the sports bucket' % (sid, genre))

    # Art named in code but not yet on disk: waiting, not broken.
    cm = open(os.path.join(ROOT, 'js', 'cutscene-manager.js')).read()
    named = set(re.findall(r"'(assets/generated/[A-Za-z0-9_/]+\.png)'", cm))
    named |= {'assets/generated/infomercials/' + n
              for n in re.findall(r"\b(?:P|IP) \+ '([A-Za-z0-9_]+\.png)'", cm)}
    missing = sorted(p for p in named if not os.path.exists(os.path.join(ROOT, p)))
    for p in missing:
        notes.append('waiting art: ' + p)

    print('exchanges: %d entries, %d scheduled pairs' % (len(rel), len(shows)))
    print('promos: %d shows resolved' % len(promos))
    print('art named in cutscene-manager: %d, on disk: %d' % (len(named), len(named) - len(missing)))
    for n in notes:
        print('  ' + n)
    for f in fails:
        print('FAIL ' + f)
    print('FAIL' if fails else 'PASS')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
