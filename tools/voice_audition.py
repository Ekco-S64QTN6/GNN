#!/usr/bin/env python3
"""
voice_audition.py — render every voice in the selector to disk, back to back.

The selector's labels describe the *role*, not the quality, and the only way
to choose between neural voices is to hear them read the same copy. This
writes one file per voice plus a level report, so a voice that is simply
quieter than the rest is visible before it is blamed on the mix.

    ./start.sh --bg && python3 tools/voice_audition.py [outdir]

Requires ffmpeg for the level column; without it the files are still written.
"""

import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENDPOINT = 'http://localhost:%s/api/tts' % os.environ.get('GNN_PORT', '8080')

COPY = ("Good evening, and welcome to the Galactic News Network. "
        "Station control confirms the orbital relay has resumed normal "
        "transmission after a brief carrier interruption.")


def voices_from_client():
    """Read the selector list out of js/tts.js so the two cannot drift."""
    src = open(os.path.join(ROOT, 'js', 'tts.js')).read()
    block = re.search(r'const VOICES = \[(.*?)\];', src, re.S)
    if not block:
        sys.exit('could not find VOICES in js/tts.js')
    return re.findall(r"id:\s*'([^']+)'.*?label:\s*'([^']+)'", block.group(1))


def level(path):
    try:
        raw = subprocess.run(
            ['ffmpeg', '-v', 'quiet', '-i', path, '-f', 'f32le', '-ac', '1',
             '-ar', '48000', '-'], capture_output=True).stdout
    except FileNotFoundError:
        return None
    if not raw:
        return None
    import array
    import math
    x = array.array('f')
    x.frombytes(raw)
    peak = max(abs(v) for v in x)
    rms = math.sqrt(sum(v * v for v in x) / len(x))
    return peak, rms, len(x) / 48000.0


def main():
    outdir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'voice-audition')
    os.makedirs(outdir, exist_ok=True)
    rows = []
    for vid, label in voices_from_client():
        q = urllib.parse.urlencode({'text': COPY, 'voice': vid,
                                    'pitch': '0Hz', 'rate': '0%', 'seq': '0'})
        path = os.path.join(outdir, '%s.mp3' % vid)
        try:
            data = urllib.request.urlopen('%s?%s' % (ENDPOINT, q), timeout=120).read()
        except Exception as err:                       # noqa: BLE001 - report and continue
            rows.append((label, vid, 'FAILED: %s' % err))
            continue
        with open(path, 'wb') as fh:
            fh.write(data)
        m = level(path)
        rows.append((label, vid,
                     'peak %.3f  rms %.4f  %.2fs' % m if m else '%d bytes' % len(data)))

    width = max(len(r[0]) for r in rows)
    print('\nwrote %d files to %s\n' % (len(rows), outdir))
    for label, vid, info in rows:
        print('  %-*s  %-34s %s' % (width, label, vid, info))
    print('\nPlay them in order and pick the one that sounds least synthetic;\n'
          'reorder js/tts.js VOICES so your choice is first (it is the default).')


if __name__ == '__main__':
    main()
