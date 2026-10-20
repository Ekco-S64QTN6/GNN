#!/usr/bin/env python3
"""
build_audio.py — profile the SOUNDFX.LBX effects (both games), render all
40 MUSIC.LBX tracks to OGG with the FluidR3 GM soundfont, and emit
assets/audio-manifest.json.

Every effect is measured (duration, RMS, peak, spectral centroid, attack time)
and given a role so the broadcast engine can pick a plausible sound for a
situation instead of hard-coding a handful of indices.
"""

import json
import math
import os
import struct
import subprocess
import sys
import wave

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO = os.path.join(ROOT, 'assets', 'audio')
MUSIC_OUT = os.path.join(AUDIO, 'music')
SOUNDFONT = '/usr/share/soundfonts/FluidR3_GM.sf2'


def read_wav(path):
    with wave.open(path, 'rb') as w:
        n, sw, ch, fr = w.getnframes(), w.getsampwidth(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    if sw == 1:
        samples = [(b - 128) / 128.0 for b in raw]
    else:
        cnt = len(raw) // 2
        samples = [v / 32768.0 for v in struct.unpack('<%dh' % cnt, raw[:cnt * 2])]
    if ch > 1:
        samples = samples[::ch]
    return samples, fr


def profile(samples, rate):
    n = len(samples)
    if not n:
        return None
    peak = max(abs(s) for s in samples)
    rms = math.sqrt(sum(s * s for s in samples) / n)
    # zero-crossing rate stands in for spectral brightness
    zc = sum(1 for i in range(1, n) if (samples[i - 1] < 0) != (samples[i] < 0))
    brightness = zc * rate / (2 * n) if n else 0
    # attack: samples until we first exceed half the peak
    attack = next((i for i, s in enumerate(samples) if abs(s) >= peak * 0.5), 0) / rate
    # sustain: fraction of the tail still above a tenth of peak
    tail = samples[int(n * 0.6):] or [0]
    sustain = sum(1 for s in tail if abs(s) > peak * 0.1) / len(tail)
    return {
        'dur': round(n / rate, 3), 'rate': rate, 'peak': round(peak, 3),
        'rms': round(rms, 4), 'bright': int(brightness),
        'attack': round(attack, 4), 'sustain': round(sustain, 3),
    }


def role_of(p):
    """Bucket an effect by its measured shape, not by a hand-kept index list."""
    d, b, s, a = p['dur'], p['bright'], p['sustain'], p['attack']
    if d < 0.08:
        return 'click'
    if d < 0.2:
        return 'blip' if b > 700 else 'tick'
    if d < 0.36:
        if b >= 1400:
            return 'chirp'
        return 'thud' if b < 900 else 'beep'
    if d < 0.6:
        if b >= 1400 and a < 0.09:
            return 'zap'
        if b < 500:
            return 'rumble'
        return 'servo' if a < 0.02 else 'beep'
    if a > 0.15:
        return 'sweep'
    if s > 0.45:
        return 'alarm' if b >= 1100 else 'drone'
    if b < 600:
        return 'rumble'
    return 'blast' if b < 1200 else 'siren'


def main():
    manifest = {'sfx': [], 'music': [], 'stings': []}

    # --- MoO1 SFX ---
    for i in range(41):
        name = 'sfx_%02d.wav' % i
        path = os.path.join(AUDIO, name)
        if not os.path.exists(path):
            continue
        p = profile(*read_wav(path))
        if not p:
            continue
        p.update({'id': 'sfx_%02d' % i, 'file': 'assets/audio/' + name,
                  'role': role_of(p)})
        manifest['sfx'].append(p)

    # --- MoO2 SFX ---
    # The SOUND.LBX extractor writes WAVs into assets/audio/moo2/
    # and a manifest alongside them. Read that manifest, profile
    # each WAV, and append them to the main sfx pool so the audio
    # engine can play them.
    moo2_dir = os.path.join(AUDIO, 'moo2')
    moo2_manifest_path = os.path.join(moo2_dir, 'manifest.json')
    if os.path.exists(moo2_manifest_path):
        with open(moo2_manifest_path, 'r', encoding='utf-8') as fh:
            moo2_data = json.load(fh)
        for entry in moo2_data.get('items', []):
            path = os.path.join(ROOT, entry['file'])
            if not os.path.exists(path):
                continue
            p = profile(*read_wav(path))
            if not p:
                continue
            p.update({
                'id': f'moo2_{entry["id"]}',
                'file': entry['file'],
                'role': role_of(p),
                'name': entry.get('name', '')
            })
            manifest['sfx'].append(p)
        print(f'  merged {len(moo2_data.get("items", []))} MoO2 SFX')

    # --- MoO1 Stings ---
    for name in sorted(os.listdir(AUDIO)):
        if not name.startswith('intro_sfx_') or not name.endswith('.wav'):
            continue
        p = profile(*read_wav(os.path.join(AUDIO, name)))
        if not p:
            continue
        p.update({'id': name[:-4], 'file': 'assets/audio/' + name,
                  'role': role_of(p)})
        manifest['stings'].append(p)

    # --- Music (Both Games) ---
    os.makedirs(MUSIC_OUT, exist_ok=True)
    have_sf = os.path.exists(SOUNDFONT)
    if not have_sf:
        print('soundfont missing (%s) — keeping any OGGs already rendered'
              % SOUNDFONT)

    # MoO1 Music
    for i in range(40):
        mid = os.path.join(AUDIO, 'music_track_%02d.mid' % i)
        ogg = os.path.join(MUSIC_OUT, 'track_%02d.ogg' % i)
        if not os.path.exists(mid):
            continue
        if have_sf and not os.path.exists(ogg):
            wav = ogg[:-4] + '.raw.wav'
            subprocess.run(['fluidsynth', '-ni', '-F', wav, '-r', '44100',
                            '-g', '0.7', SOUNDFONT, mid],
                           check=False, stdout=subprocess.DEVNULL,
                           stderr=subprocess.DEVNULL)
            if os.path.exists(wav):
                subprocess.run(['ffmpeg', '-y', '-i', wav, '-ac', '2',
                                '-c:a', 'libvorbis', '-q:a', '3', ogg],
                               check=False, stdout=subprocess.DEVNULL,
                               stderr=subprocess.DEVNULL)
                os.remove(wav)
        entry = {'id': 'track_%02d' % i, 'source': 'moo1',
                 'midi': 'assets/audio/music_track_%02d.mid' % i}
        if os.path.exists(ogg):
            out = subprocess.run(
                ['ffprobe', '-v', 'quiet', '-show_entries', 'format=duration',
                 '-of', 'csv=p=0', ogg], capture_output=True, text=True)
            try:
                entry['dur'] = round(float(out.stdout.strip()), 2)
            except ValueError:
                entry['dur'] = 0
            entry['file'] = 'assets/audio/music/track_%02d.ogg' % i
            entry['bytes'] = os.path.getsize(ogg)
        manifest['music'].append(entry)

    # MoO2 Music
    moo2_music_dir = os.path.join(MUSIC_OUT, 'moo2')
    if os.path.isdir(moo2_music_dir):
        for name in sorted(os.listdir(moo2_music_dir)):
            if not name.endswith('.ogg'):
                continue
            path = os.path.join(moo2_music_dir, name)
            stem = os.path.splitext(name)[0]
            out = subprocess.run(
                ['ffprobe', '-v', 'quiet', '-show_entries', 'format=duration',
                 '-of', 'csv=p=0', path], capture_output=True, text=True)
            try:
                dur = round(float(out.stdout.strip()), 2)
            except ValueError:
                dur = 0
            manifest['music'].append({
                'id': f'moo2_{stem}',
                'source': 'moo2',
                'file': 'assets/audio/music/moo2/' + name,
                'dur': dur,
                'bytes': os.path.getsize(path),
            })

    dest = os.path.join(ROOT, 'assets', 'audio-manifest.json')
    with open(dest, 'w') as fh:
        json.dump(manifest, fh, separators=(',', ':'))

    roles = {}
    for s in manifest['sfx']:
        roles[s['role']] = roles.get(s['role'], 0) + 1
    print('sfx', len(manifest['sfx']), roles)
    print('stings', len(manifest['stings']))
    rendered = [m for m in manifest['music'] if 'file' in m]
    print('music', len(manifest['music']), 'rendered', len(rendered),
          'total %.1fs' % sum(m.get('dur', 0) for m in rendered))
    print('->', dest)


if __name__ == '__main__':
    main()