#!/usr/bin/env python3
"""Probe SOUND.LBX to determine the sound format."""
import os, sys, wave
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lbx import LbxArchive

MOO2 = 'Master of Orion 1/mastori2'
OUT = 'assets/audio/moo2/probe'


def _w8u(path, blob, rate):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(1)
        w.setframerate(rate)
        w.writeframes(bytes(blob))


def _w16s(path, blob, rate):
    n = len(blob) & ~1
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(bytes(blob[:n]))


def main():
    arc = LbxArchive(os.path.join(MOO2, 'SOUND.LBX'))
    os.makedirs(OUT, exist_ok=True)

    # Name table: 20-byte entries
    blob0 = arc.item(0)
    names = {}
    for i in range(len(blob0) // 20):
        chunk = blob0[i * 20:(i + 1) * 20]
        name = chunk.split(b'\x00')[0].decode('ascii', 'replace').strip('. ').strip()
        if name and name.isprintable():
            names[i] = name

    print(f'SOUND.LBX: {len(arc)} items, {len(names)} named entries')
    for i in sorted(names)[:15]:
        print(f'  [{i:3d}] {names[i]}')
    if len(names) > 15:
        print(f'  ... and {len(names) - 15} more')

    # Probe items 1, 5, 20 with each candidate format
    for probe_item in (1, 5, 20):
        if probe_item >= len(arc):
            continue
        blob = arc.item(probe_item)
        name = names.get(probe_item, f'item_{probe_item}')
        print(f'\nItem {probe_item} ({name}): {len(blob)} bytes')
        print(f'  First 16 bytes: {blob[:16].hex()}')

        for tag, rate, writer in (
            ('8u_8000',   8000,  _w8u),
            ('8u_11025',  11025, _w8u),
            ('16s_11025', 11025, _w16s),
            ('16s_22050', 22050, _w16s),
        ):
            path = os.path.join(OUT, f'item_{probe_item:02d}_{tag}.wav')
            try:
                writer(path, blob, rate)
                print(f'  {tag:12s} -> {path}')
            except Exception as e:
                print(f'  {tag:12s} FAILED: {e}')

    print(f'\nFiles written to {OUT}/')
    print('Listen to item_01 at each format. Which one sounds like a real sound effect?')


if __name__ == '__main__':
    sys.exit(main())