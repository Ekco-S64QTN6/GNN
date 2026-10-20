#!/usr/bin/env python3
"""Decode Smacker video files (INTRO.LBX, *FIN.LBX) into PNG frames.

ffmpeg auto-detects Smacker when the file has a .smk extension and
refuses to demux it under the .LBX name (the -f smacker demuxer name
this tool used before does not exist in modern ffmpeg; the demuxer is
registered as 'smk' and is easiest to reach via extension auto-detect).
So each .LBX is copied to a temporary .smk file, decoded, then cleaned
up.

Examples:
    python3 tools/extract_moo2_video.py                        # all, every frame
    python3 tools/extract_moo2_video.py --every 2              # half
    python3 tools/extract_moo2_video.py --only INTRO --frame-limit 100
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOO2_DIR = os.path.join(ROOT, 'Master of Orion 1', 'mastori2')
OUT_ROOT = os.path.join(ROOT, 'assets', 'cutscenes', 'moo2_video')

SMACKER_SOURCES = [
    'INTRO.LBX',
    'AMEBAFIN.LBX', 'ANATKFIN.LBX', 'ANWINFIN.LBX',
    'DIMTVFIN.LBX', 'LOSERFIN.LBX', 'ORIONFIN.LBX',
    'PLNTDFIN.LBX', 'WININFIN.LBX',
]


def is_smacker(path):
    try:
        with open(path, 'rb') as fh:
            head = fh.read(4)
        return head in (b'SMK2', b'SMK4')
    except OSError:
        return False


def extract_one(path, name, every=1, frame_limit=None):
    out_dir = os.path.join(OUT_ROOT, name)
    os.makedirs(out_dir, exist_ok=True)
    for f in os.listdir(out_dir):
        if f.startswith('frame_') and f.endswith('.png'):
            os.remove(os.path.join(out_dir, f))

    if not is_smacker(path):
        print('%-16s not Smacker (skipped)' % name)
        return 0

    # Copy to a .smk so ffmpeg's extension auto-detect picks the right
    # demuxer. The .LBX extension is a decoy and does not resolve to a
    # video format.
    tmp_dir = tempfile.mkdtemp(prefix='gnn_smk_')
    tmp_smk = os.path.join(tmp_dir, 'video.smk')
    try:
        shutil.copy2(path, tmp_smk)
    except OSError as err:
        print('%-16s copy failed: %s' % (name, err))
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return 0

    try:
        args = ['ffmpeg', '-y', '-i', tmp_smk]
        if every > 1:
            args += ['-vf', 'select=not(mod(n\\,%d))' % every, '-fps_mode', 'vfr']
        if frame_limit:
            args += ['-frames:v', str(frame_limit)]
        args.append(os.path.join(out_dir, 'frame_%04d.png'))

        try:
            proc = subprocess.run(args, capture_output=True, text=True, timeout=1200)
        except subprocess.SubprocessError as err:
            print('%-16s ffmpeg failed to run: %s' % (name, err))
            return 0

        if proc.returncode != 0:
            print('%-16s ffmpeg exit %d' % (name, proc.returncode))
            last = [ln for ln in (proc.stderr or '').splitlines() if ln.strip()][-3:]
            for ln in last:
                print('  ' + ln[:200])
            return 0
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

    frames = sorted(f for f in os.listdir(out_dir) if f.startswith('frame_'))
    if not frames:
        print('%-16s no frames produced' % name)
        return 0

    with open(os.path.join(out_dir, 'manifest.json'), 'w', encoding='utf-8') as fh:
        json.dump({
            'archive': name,
            'source': 'moo2_video',
            'sampled_every': every,
            'extracted_frames': len(frames),
            'frame_files': frames,
        }, fh, indent=2)
    size_mb = sum(
        os.path.getsize(os.path.join(out_dir, f)) for f in frames) / (1024 * 1024)
    print('%-16s %4d frames  %.1f MB' % (name, len(frames), size_mb))
    return len(frames)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--every', type=int, default=1,
                    help='extract every Nth frame (default 1, all)')
    ap.add_argument('--frame-limit', type=int, default=None,
                    help='cap frames per video (default none)')
    ap.add_argument('--only', default=None,
                    help='comma-separated source basenames')
    args = ap.parse_args()

    if not shutil.which('ffmpeg'):
        print('ffmpeg is required', file=sys.stderr)
        return 1
    if not os.path.isdir(MOO2_DIR):
        print('MoO2 directory not found: %s' % MOO2_DIR, file=sys.stderr)
        return 1
    os.makedirs(OUT_ROOT, exist_ok=True)

    only = ({a.strip().upper() for a in args.only.split(',') if a.strip()}
            if args.only else None)

    total_frames = 0
    total_videos = 0
    for source in SMACKER_SOURCES:
        stem = os.path.splitext(source)[0].upper()
        if only and stem not in only:
            continue
        path = os.path.join(MOO2_DIR, source)
        if not os.path.isfile(path):
            print('%-16s source not found' % stem)
            continue
        frames = extract_one(path, stem.lower(),
                             every=args.every, frame_limit=args.frame_limit)
        if frames:
            total_frames += frames
            total_videos += 1

    print('\n%d video(s) decoded, %d total frames -> %s'
          % (total_videos, total_frames, os.path.relpath(OUT_ROOT, ROOT)))
    return 0


if __name__ == '__main__':
    sys.exit(main())