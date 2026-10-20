#!/usr/bin/env python3
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lbx import LbxArchive

SRC = 'Master of Orion 1/mastori2/STREAM.LBX'
OUT = 'assets/audio/moo2/music_raw'

os.makedirs(OUT, exist_ok=True)
arc = LbxArchive(SRC)
print(f'STREAM.LBX: {len(arc)} items')
for i in range(len(arc)):
    blob = arc.item(i)
    path = os.path.join(OUT, f'stream_{i:02d}.smk')
    with open(path, 'wb') as fh:
        fh.write(blob)
    # Print the first 4 bytes so we can confirm they're all SMK2
    magic = blob[:4].decode('ascii', 'replace') if len(blob) >= 4 else '????'
    print(f'  item {i:02d}: {len(blob):>9d}b  magic={magic!r}')