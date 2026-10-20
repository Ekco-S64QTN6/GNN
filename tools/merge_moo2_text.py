#!/usr/bin/env python3
"""Merge per-archive MoO2 text extractions into assets/moo2-strings.json.

Reads every JSON under assets/text/moo2/ (including .EXE dumps),
filters out binary noise (control markers, format specifiers, path-like
strings, one-word blobs), and produces the four pools the runtime
consumes: bulletins, leaders, topics, vocab.

Examples:
    python3 tools/merge_moo2_text.py
    python3 tools/merge_moo2_text.py --dry-run
"""
import argparse
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEXT_ROOT = os.path.join(ROOT, 'assets', 'text', 'moo2')
OUT = os.path.join(ROOT, 'assets', 'moo2-strings.json')

BULLETIN_MIN = 40
BULLETIN_MAX = 260
NAME_RE = re.compile(r"^[A-Z][a-zA-Z'\-\s]{3,39}$")
TOPIC_MIN = 3
TOPIC_MAX = 30

BAD_MARKERS = ('<0x', '%s', '%d', '%1', '%2', '\\n', '\\t',
               '.LBX', '.lbx', '.EXE', '.exe', '.FLI', '.fli',
               'C:\\', '/usr/', 'Windows', 'SOFTWARE', 'HKEY_')

PROSE_RE = re.compile(r"^[A-Z][^\s]+(\s+[A-Za-z0-9'\-\.,;:!\?]+){2,}"
                      r"[\.\?\!]?$")

STAR_WORDS = set('''Altair Antares Aquilae Arietis Artemis Aurora Beta Ceti
    Bootis Capella Celtsi Centauri Collassa Coraona Crypti Cygni Denubius
    Draconis Drakka Endoria Escalon Fierias Formalhaut Gorra Guradas
    Herculis Hyades Incedius Iranha Jinga Kailis Kholdan Kinnison Klystron
    Laan Lyae Maalor Mentar Meklon Misha Mobas Moro Mrrshan Nazin Nikko
    Nyarlath Omicron Ophiuchi Orion Paladia Pegasi Persephone Pictoris
    Polaris Procyon Proxima Quaris Regulus Rigel Romulis Rhilus
    Sagittarius Sarnia Sirius Sol Spica Sssla Talas Tao Tauri Trax Trilar
    Tyr Ukko Ursa Vega Volantis Willow Xendalla Yarrow Zoctan
    Zortrium'''.split())

TECH_HINTS = ('laser', 'beam', 'shield', 'drive', 'engine', 'missile',
              'bomb', 'armor', 'computer', 'scanner', 'reactor', 'cannon',
              'torpedo', 'cloak', 'warp', 'fusion', 'plasma', 'quantum',
              'photon', 'graviton', 'neutronium', 'zortrium', 'duralloy',
              'tritanium', 'adamantium', 'antimatter')

PLANET_WORDS = ('terran', 'jungle', 'ocean', 'arid', 'steppe', 'desert',
                'tundra', 'barren', 'inferno', 'toxic', 'radiated', 'gaia',
                'hostile', 'planet', 'world', 'moon', 'colony', 'asteroid',
                'nebula', 'comet', 'gas giant')


def is_bad(s):
    return any(m in s for m in BAD_MARKERS)


def iter_records(directory):
    for dirpath, _dirnames, filenames in os.walk(directory):
        for fname in sorted(filenames):
            if not fname.endswith('.json'):
                continue
            try:
                with open(os.path.join(dirpath, fname), encoding='utf-8') as fh:
                    data = json.load(fh)
            except (OSError, ValueError):
                continue
            if isinstance(data.get('items'), list):
                for item in data['items']:
                    for rec in item.get('records', []):
                        yield rec.get('text', '')
            elif isinstance(data.get('records'), list):
                for rec in data['records']:
                    yield rec.get('text', '')


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    if not os.path.isdir(TEXT_ROOT):
        print('nothing to merge — run tools/extract_moo2_text.py first',
              file=sys.stderr)
        return 1

    bulletins, names, topics = set(), set(), set()
    raw_count = 0
    for record in iter_records(TEXT_ROOT):
        raw_count += 1
        s = record.strip()
        if not s or is_bad(s):
            continue
        n = len(s)
        if n <= 40 and NAME_RE.match(s):
            names.add(s)
            continue
        if BULLETIN_MIN <= n <= BULLETIN_MAX and PROSE_RE.match(s):
            bulletins.add(s)
            continue
        if TOPIC_MIN <= n <= TOPIC_MAX and s[0].isalpha():
            topics.add(s)

    all_words = set()
    for source in (bulletins, names, topics):
        for s in source:
            for w in re.findall(r'\b[A-Za-z]{4,}\b', s):
                all_words.add(w)

    vocab = {
        'tech': sorted(w for w in all_words
                       if any(h in w.lower() for h in TECH_HINTS))[:400],
        'planets': sorted(w for w in all_words
                          if w.lower() in PLANET_WORDS)[:400],
        'races': sorted({r.capitalize() for r in (
            'human', 'mrrshan', 'silicoid', 'sakkra', 'psilon', 'alkari',
            'klackon', 'bulrathi', 'meklar', 'darlok', 'antaran')}),
        'stars': sorted(w for w in all_words if w in STAR_WORDS)[:400],
        'shipclasses': sorted(w for w in all_words if w.isupper()
                              and 3 <= len(w) <= 20)[:400],
        'misc': sorted(w for w in all_words
                       if w not in STAR_WORDS and len(w) >= 5)[:400],
    }

    data = {
        'source': 'moo2',
        'bulletins': sorted(bulletins),
        'leaders': sorted(names),
        'topics': sorted(topics),
        'vocab': vocab,
    }

    print('scanned %d records' % raw_count)
    print('  bulletins  %4d' % len(data['bulletins']))
    print('  leaders    %4d' % len(data['leaders']))
    print('  topics     %4d' % len(data['topics']))
    print('  tech       %4d' % len(vocab['tech']))
    print('  planets    %4d' % len(vocab['planets']))
    print('  stars      %4d' % len(vocab['stars']))
    print('  misc       %4d' % len(vocab['misc']))

    if args.dry_run:
        return 0

    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(',', ':'))
        fh.write('\n')
    print('-> %s' % os.path.relpath(OUT, ROOT))
    return 0


if __name__ == '__main__':
    sys.exit(main())