#!/usr/bin/env python3
"""
extract_text.py — pull the writing out of the carcass.

EVENTMSG.LBX holds the 154 news bulletins the original GNN anchor read on air;
NAMES.LBX holds the 60 imperial leader names; HELP.LBX holds the manual topics;
ORION.EXE holds the tech / planet / race vocabulary. All of it becomes copy for
the anchor's banter, the commercial breaks and the commodity ticker.
"""

import json
import os
import re
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lbx import LbxArchive  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'Master of Orion 1', 'data')

# MOO1 substitutes these cp437 high bytes at runtime. Named so the broadcast
# engine can fill them with real feed data instead of empire state.
PLACEHOLDERS = {
    '\x80': '{PLACE}', '\x81': '{NUM}', '\x82': '{NUM2}', '\x83': '{S}',
    '\x84': '{FACTION}', '\x85': '{FACTION2}', '\x86': '{EMPIRE}',
    '\x87': '{PLACE2}', '\x88': '{TITLE}', '\x89': '{TRAIT}',
    '\x8a': '{TRAIT2}', '\x8b': '{RANK}', '\x8c': '{LEADER}',
    '\x8d': '{S2}', '\x8e': '{A}', '\x8f': '{THE}',
}


def require_source():
    """The extractors are the only thing that needs the original game data."""
    if not os.path.isdir(DATA):
        sys.stderr.write(
            'Master of Orion 1 source data not found at:\n  %s\n\n'
            'This script only regenerates assets/ from the original .LBX\n'
            'archives. The broadcast itself needs nothing but assets/ —\n'
            'run "python3 tools/verify_assets.py" to confirm.\n' % DATA)
        raise SystemExit(2)


def string_table(path, item=0):
    arc = LbxArchive(path)
    blob = arc.item(item)
    count, stride = struct.unpack_from('<HH', blob, 0)
    out = []
    for i in range(count):
        chunk = blob[4 + i * stride:4 + (i + 1) * stride]
        out.append(chunk.split(b'\x00')[0].decode('latin-1'))
    return out


def raw_rows(path, item=0):
    arc = LbxArchive(path)
    blob = arc.item(item)
    count, stride = struct.unpack_from('<HH', blob, 0)
    return [blob[4 + i * stride:4 + (i + 1) * stride] for i in range(count)]


def normalise(s):
    for k, v in PLACEHOLDERS.items():
        s = s.replace(k, v)
    return re.sub(r'\s+', ' ', s).strip()


def exe_strings(path, minlen=6):
    blob = open(path, 'rb').read()
    return re.findall(rb'[\x20-\x7e]{%d,}' % minlen, blob)


def main():
    require_source()
    out = {}

    events = [normalise(s) for s in string_table(os.path.join(DATA, 'EVENTMSG.LBX'))]
    out['bulletins'] = [s for s in events if len(s) > 30]

    out['leaders'] = [s.strip() for s in string_table(os.path.join(DATA, 'NAMES.LBX')) if s.strip()]

    topics = []
    for row in raw_rows(os.path.join(DATA, 'HELP.LBX')):
        for m in re.findall(rb'[\x20-\x7e]{5,}', row):
            t = m.decode('ascii').strip()
            if t.upper().endswith('.FLI') or not re.match(r'^[A-Za-z]', t):
                continue
            topics.append(t)
            break
    out['topics'] = sorted(set(topics))

    vocab = {'tech': [], 'planets': [], 'races': [], 'stars': [],
             'shipclasses': [], 'misc': []}
    RACES = ['Human', 'Mrrshan', 'Silicoid', 'Sakkra', 'Psilon', 'Alkari',
             'Klackon', 'Bulrathi', 'Meklar', 'Darlok']
    PLANET_WORDS = ['Terran', 'Jungle', 'Ocean', 'Arid', 'Steppe', 'Desert',
                    'Minimal', 'Barren', 'Tundra', 'Dead', 'Inferno',
                    'Toxic', 'Radiated', 'Ultra Poor', 'Poor', 'Abundant',
                    'Rich', 'Ultra Rich', 'Artifacts', 'Gaia']
    TECH_HINTS = ('Laser', 'Beam', 'Shield', 'Drive', 'Engine', 'Missile',
                  'Bomb', 'Armor', 'Computer', 'Scanner', 'Reactor', 'Cannon',
                  'Torpedo', 'Cloak', 'Absorber', 'Controller', 'Repellor',
                  'Terraforming', 'Neutronium', 'Zortrium', 'Duralloy',
                  'Andrium', 'Tritanium', 'Adamantium', 'Stellar', 'Warp',
                  'Fusion', 'Ion', 'Plasma', 'Antimatter', 'Death Ray',
                  'Disruptor', 'Stinger', 'Hyper', 'Sub-Space', 'Gravity')
    STARS = set('''Altair Antares Aquilae Arietis Artemis Aurora Beta Ceti Bootis
        Capella Celtsi Centauri Collassa Coraona Crypti Cygni Denubius Draconis
        Drakka Endoria Escalon Fierias Formalhaut Gorra Guradas Herculis Hyades
        Incedius Iranha Jinga Kailis Kholdan Kinnison Klystron Laan Lyae Maalor
        Mentar Meklon Misha Mobas Moro Mrrshan Nazin Nikko Nyarlath Omicron
        Ophiuchi Orion Paladia Pegasi Persephone Pictoris Polaris Procyon
        Proxima Quaris Regulus Rigel Romulis Rhilus Sagittarius Sarnia Sirius
        Sol Spica Sssla Talas Tao Tauri Trax Trilar Tyr Ukko Ursa Vega Volantis
        Willow Xendalla Yarrow Zoctan Zortrium'''.split())
    seen = set()
    for raw in exe_strings(os.path.join(DATA, 'ORION.EXE')):
        s = raw.decode('ascii', 'replace').strip()
        if len(s) < 5 or len(s) > 40 or s in seen:
            continue
        if not re.match(r'^[A-Z][A-Za-z0-9 \'\-/]+$', s):
            continue
        seen.add(s)
        if s.isupper() and 3 <= len(s) <= 20 and ' ' not in s.strip():
            vocab['shipclasses'].append(s.title())
        elif re.match(r'^[A-Z][a-z]+( [A-Z][a-z]+)?$', s) and len(s.split()) <= 2 and s in STARS:
            vocab['stars'].append(s)
        elif any(h in s for h in TECH_HINTS):
            vocab['tech'].append(s)
        elif s in PLANET_WORDS or any(p in s for p in PLANET_WORDS):
            vocab['planets'].append(s)
        elif s in RACES or s.rstrip('s') in RACES:
            vocab['races'].append(s)
        elif len(s.split()) <= 3:
            vocab['misc'].append(s)
    vocab['races'] = RACES
    for k in vocab:
        vocab[k] = sorted(set(vocab[k]))[:400]
    out['vocab'] = vocab

    dest = os.path.join(ROOT, 'assets', 'moo-strings.json')
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, 'w') as fh:
        json.dump(out, fh, indent=0, separators=(',', ':'))
    print('bulletins', len(out['bulletins']), '| leaders', len(out['leaders']),
          '| topics', len(out['topics']),
          '| tech', len(vocab['tech']), '| planets', len(vocab['planets']),
          '| misc', len(vocab['misc']))
    print('->', dest)


if __name__ == '__main__':
    main()
