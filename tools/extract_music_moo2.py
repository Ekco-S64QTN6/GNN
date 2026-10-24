#!/usr/bin/env python3
"""Render the MoO2 music beds to OGG: assets/audio/music/moo2/*.ogg.

    python3 tools/extract_music_moo2.py          # then tools/build_audio.py
    python3 tools/extract_music_moo2.py --list   # what would be written

Two sources, both decoded by ffmpeg:

  STREAM.LBX   An ordinary LBX container whose items are plain RIFF WAVs
               (8-bit stereo, 22,050 Hz). Items 0, 7 and 9 are not audio:
               each is the same 22-byte text, "cats rule dogs drool". Each
               WAV becomes stream_NN.ogg, NN being its item number.
  *FIN.LBX,    Not LBX files at all, despite the extension: Smacker videos
  INTRO.LBX    (magic "SMK2"). The soundtrack is taken, the picture left to
               tools/extract_moo2_video.py.

STREAMHD.LBX (21 short WAV cues, same layout) and the GENWINFN video's
soundtrack are not rendered. The show themes are picked by position in the
music list (broadcast-director.js, `showIdx * 7 + 3`), so adding a bed
re-themes every show; add them deliberately, not as a side effect.

This replaces dump_stream_lbx.py, which wrote the WAVs out as `.smk` and
left the transcode to be done by hand.
"""
import argparse
import os
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lbx import LbxArchive  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOO2_DIR = os.path.join(ROOT, 'Master of Orion 1', 'mastori2')
OUT = os.path.join(ROOT, 'assets', 'audio', 'music', 'moo2')

# Output name -> video file. The names are the ids the runtime already
# uses (`moo2_<stem>`), so they stay as they are.
VIDEOS = {
    'intro': 'INTRO.LBX',
    'AMEBAFIN': 'AMEBAFIN.LBX', 'ANATKFIN': 'ANATKFIN.LBX',
    'ANWINFIN': 'ANWINFIN.LBX', 'DIMTVFIN': 'DIMTVFIN.LBX',
    'LOSERFIN': 'LOSERFIN.LBX', 'ORIONFIN': 'ORIONFIN.LBX',
    'PLNTDFIN': 'PLNTDFIN.LBX', 'WININFIN': 'WININFIN.LBX',
}


def transcode(src, dest):
    """Audio only, source rate and channels kept, Vorbis quality 4."""
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vn',
                    '-c:a', 'libvorbis', '-q:a', '4', dest], check=True)


def jobs(moo2_dir):
    """(output stem, kind, source) for everything this tool writes."""
    out = []
    stream = LbxArchive(os.path.join(moo2_dir, 'STREAM.LBX'))
    for i in range(len(stream)):
        if stream.item(i)[:4] == b'RIFF':
            out.append(('stream_%02d' % i, 'wav', i))
    for stem, name in VIDEOS.items():
        out.append((stem, 'smk', os.path.join(moo2_dir, name)))
    return out, stream


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--moo2-dir', default=MOO2_DIR)
    ap.add_argument('--out', default=OUT)
    ap.add_argument('--list', action='store_true', help='print the plan only')
    args = ap.parse_args()

    plan, stream = jobs(args.moo2_dir)
    if args.list:
        for stem, kind, src in plan:
            print('%-12s <- %s' % (stem + '.ogg',
                                   'STREAM.LBX item %d' % src if kind == 'wav'
                                   else os.path.basename(src)))
        return 0

    os.makedirs(args.out, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for stem, kind, src in plan:
            dest = os.path.join(args.out, stem + '.ogg')
            if kind == 'wav':
                wav = os.path.join(tmp, stem + '.wav')
                with open(wav, 'wb') as fh:
                    fh.write(stream.item(src))
                src = wav
            transcode(src, dest)
            print('%-12s %8d bytes' % (stem + '.ogg', os.path.getsize(dest)))
    print('%d beds -> %s; run tools/build_audio.py to index them'
          % (len(plan), os.path.relpath(args.out, ROOT)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
