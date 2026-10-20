#!/usr/bin/env python3
"""Extract SOUND.LBX (Master of Orion 2) to individual WAV files.

Every item in SOUND.LBX is already a complete RIFF/WAVE file — header,
fmt chunk and data chunk all present. The extractor writes each item's
bytes directly to disk; there is no codec to run.

Item 0 is a name table: fixed 20-byte slots, each an ASCII name padded
with NULs. Item 1 through item N are the sound samples. Names are used
as filenames where present; slots without a name fall back to a
position-based name.

Writes:
    assets/audio/moo2/sfx_NN_name.wav   one file per sample
    assets/audio/moo2/manifest.json     names, sizes, durations
"""
import json
import os
import re
import sys
import wave

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lbx import LbxArchive, LbxError  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LBX = os.path.join(ROOT, 'Master of Orion 1', 'mastori2', 'SOUND.LBX')
OUT = os.path.join(ROOT, 'assets', 'audio', 'moo2')

SLOT = 20


def parse_names(blob):
    """Return {index: name} from the fixed 20-byte slot table."""
    out = {}
    for i in range(len(blob) // SLOT):
        chunk = blob[i * SLOT:(i + 1) * SLOT]
        # A name is the first NUL-terminated ASCII run in the slot.
        name_bytes = chunk.split(b'\x00', 1)[0]
        try:
            name = name_bytes.decode('ascii')
        except UnicodeDecodeError:
            continue
        name = name.strip()
        if not name or not all(32 <= ord(c) < 127 for c in name):
            continue
        out[i] = name
    return out


def safe_filename(name, fallback):
    s = re.sub(r'[^a-zA-Z0-9_-]+', '_', name or '').strip('_')
    return s or fallback


def wav_duration(blob):
    """Duration in seconds, read from the WAV header. 0 on any failure."""
    try:
        with wave.open(__import__('io').BytesIO(blob), 'rb') as w:
            frames = w.getnframes()
            rate = w.getframerate()
            if rate > 0 and frames > 0:
                return round(frames / rate, 3)
    except Exception:
        pass
    return 0


def main():
    if not os.path.isfile(LBX):
        print(f'SOUND.LBX not found at {LBX}', file=sys.stderr)
        return 1
    try:
        arc = LbxArchive(LBX)
    except LbxError as err:
        print(f'cannot open SOUND.LBX: {err}', file=sys.stderr)
        return 1

    os.makedirs(OUT, exist_ok=True)
    names = parse_names(arc.item(0))
    print(f'SOUND.LBX: {len(arc)} items, {len(names)} names in table')

    manifest = []
    extracted = 0
    skipped = 0

    for i in range(1, len(arc)):
        blob = arc.item(i)
        if len(blob) < 12 or blob[:4] != b'RIFF' or blob[8:12] != b'WAVE':
            print(f'[{i:02d}] skipped — not a WAV (magic={blob[:12].hex()})',
                  file=sys.stderr)
            skipped += 1
            continue
        name = names.get(i, names.get(i - 1, ''))
        fallback = f'sfx_{i - 1:02d}'
        fname = f'{i - 1:02d}_{safe_filename(name, fallback)}.wav'
        path = os.path.join(OUT, fname)
        with open(path, 'wb') as fh:
            fh.write(blob)
        dur = wav_duration(blob)
        manifest.append({
            'id': f'sfx_moo2_{i - 1:02d}',
            'name': name or fallback,
            'file': os.path.relpath(path, ROOT),
            'bytes': len(blob),
            'dur': dur,
        })
        extracted += 1
        print(f'[{i - 1:02d}] {fname:<40s} {len(blob):>7d}b  {dur:>6.2f}s')

    manifest_path = os.path.join(OUT, 'manifest.json')
    with open(manifest_path, 'w', encoding='utf-8') as fh:
        json.dump({
            'archive': 'SOUND',
            'source': 'moo2',
            'count': extracted,
            'items': manifest,
        }, fh, indent=2)
        fh.write('\n')

    total_dur = sum(m['dur'] for m in manifest)
    print(f'\n{extracted} WAV files extracted, {skipped} skipped, '
          f'{total_dur:.1f}s total')
    print(f'manifest -> {os.path.relpath(manifest_path, ROOT)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())