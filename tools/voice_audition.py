#!/usr/bin/env python3
"""
voice_audition.py — render candidate anchor voices back to back, as one file.

The selector labels describe the role, not the sound, and the only way to
choose between neural voices is to hear them read the same copy in a row.
This renders every candidate through the *live server*, so what you hear is
exactly what the broadcast would play — same 96 kbps synthesis, same loudness
normalisation — then stitches them into a single audition track with a spoken
label before each one.

    ./start.sh --bg
    python3 tools/voice_audition.py [outdir]

Writes <outdir>/audition.wav plus one file per voice, and prints a level
table so a voice that is merely quieter is not mistaken for a worse one.
"""

import json
import os
import subprocess
import sys
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = os.environ.get('GNN_PORT', '8080')
ENDPOINT = 'http://localhost:%s/api/tts' % PORT

COPY = ("Good evening. This is the Galactic News Network, live across the "
        "sector. Six starships were seized at Antares this morning, and the "
        "High Council has called an emergency session.")

def catalogue():
    """Whatever the running server offers, so this follows the engine."""
    try:
        with urllib.request.urlopen(
                'http://localhost:%s/api/voices' % PORT, timeout=10) as r:
            cat = json.load(r)
        if cat.get('voices'):
            return cat['engine'], [(v['label'].split(' —')[0].title(), v['id'])
                                   for v in cat['voices']]
    except Exception:                                  # noqa: BLE001
        pass
    # edge-tts exposes no catalogue endpoint, so fall back to the picks that
    # survived the last listen.
    return 'edge-tts', [
        ('Ryan, British', 'en-GB-RyanNeural'),
        ('William, Australian', 'en-AU-WilliamNeural'),
        ('Thomas, British', 'en-GB-ThomasNeural'),
        ('Connor, Irish', 'en-IE-ConnorNeural'),
        ('Eric', 'en-US-EricNeural'),
        ('Steffan', 'en-US-SteffanNeural'),
        ('Brian', 'en-US-BrianNeural'),
        ('Guy', 'en-US-GuyNeural'),
        ('Aria', 'en-US-AriaNeural'),
        ('Ava', 'en-US-AvaNeural'),
    ]





def fetch(text, voice, pitch, rate, seq=0):
    url = ENDPOINT + '?' + urllib.parse.urlencode({
        'text': text, 'voice': voice,
        'pitch': '%+dHz' % pitch, 'rate': '%+d%%' % rate, 'seq': seq,
    })
    with urllib.request.urlopen(url, timeout=90) as r:
        return r.read(), r.headers.get('Content-Type', '')


def to_wav(path, payload, ctype):
    raw = path + ('.mp3' if 'mpeg' in ctype else '.src.wav')
    with open(raw, 'wb') as fh:
        fh.write(payload)
    subprocess.run(['ffmpeg', '-v', 'quiet', '-y', '-i', raw,
                    '-ar', '24000', '-ac', '1', path], check=True)
    os.remove(raw)
    return path


def level(path):
    out = subprocess.run(['ffmpeg', '-nostats', '-i', path, '-filter_complex',
                          'ebur128=peak=true', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    lufs = peak = '?'
    for line in out.splitlines():
        line = line.strip()
        if line.startswith('I:') and 'LUFS' in line:
            lufs = line.split()[1]
        elif line.startswith('Peak:'):
            peak = line.split()[1]
    return lufs, peak


def silence(path, seconds=0.6):
    subprocess.run(['ffmpeg', '-v', 'quiet', '-y', '-f', 'lavfi', '-i',
                    'anullsrc=r=24000:cl=mono', '-t', str(seconds), path],
                   check=True)
    return path


def main():
    outdir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'audition')
    os.makedirs(outdir, exist_ok=True)

    engine, candidates = catalogue()
    print('engine: %s\n' % engine)
    jobs = [(label, voice, 0, 0, 'flat') for label, voice in candidates]

    label_voice = candidates[0][1]
    parts = []
    gap = silence(os.path.join(outdir, '_gap.wav'))
    print('%-34s %-10s %9s %9s' % ('voice', 'prosody', 'LUFS', 'peak'))
    for i, (label, voice, pitch, rate, tag) in enumerate(jobs):
        stem = os.path.join(outdir, '%02d_%s_%s' % (i, voice, tag))
        try:
            say, ct = fetch('%s.' % label, label_voice, 0, 0)
            lab = to_wav(stem + '_label.wav', say, ct)
            body, ct = fetch(COPY, voice, pitch, rate)
            clip = to_wav(stem + '.wav', body, ct)
        except Exception as err:                       # noqa: BLE001
            print('%-34s %-10s  FAILED %s' % (voice, tag, str(err)[:40]))
            continue
        lufs, peak = level(clip)
        print('%-34s %-10s %9s %9s' % (voice, tag, lufs, peak))
        parts += [lab, gap, clip, gap]

    if not parts:
        print('nothing rendered — is the server up? (./start.sh --bg)')
        return 1
    listing = os.path.join(outdir, '_list.txt')
    with open(listing, 'w') as fh:
        for p in parts:
            fh.write("file '%s'\n" % os.path.abspath(p))
    final = os.path.join(outdir, 'audition.wav')
    subprocess.run(['ffmpeg', '-v', 'quiet', '-y', '-f', 'concat', '-safe', '0',
                    '-i', listing, '-c', 'copy', final], check=True)
    dur = subprocess.run(['ffprobe', '-v', 'quiet', '-show_entries',
                          'format=duration', '-of', 'csv=p=0', final],
                         capture_output=True, text=True).stdout.strip()
    print('\n%s  (%.0f s, %d voices)' % (final, float(dur or 0), len(jobs)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
