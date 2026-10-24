#!/usr/bin/env python3
"""The MoO2 decoder against liblbx's reference renders.

    python3 tools/tests/moo2_reference.py [moo2-dir]

liblbx (Nick Bowler) ships MD5 hashes of twelve decoded frames in
tests/moo2data.at: LOGO 0 and 1, MAINMENU 0, 7 and 21, MONSTER 7 (with
override item 14), STARBG 9 and SHIPS 42 (with override item 49). Its
`lbximg -F pam` writes the palette's raw 6-bit components (MAXVAL 63);
images with any transparent pixel get a fourth byte, 63 where drawn and
all four bytes 0 where not. The hash covers the pixel bytes, not the PAM
header. This builds the same bytes from tools/lbx.py and compares.

The game files are not distributed, so without them this prints SKIP and
exits 0. Exits 1 on any mismatch.
"""
import hashlib
import os
import struct
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # repo root
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from lbx import LbxArchive, GfxItem  # noqa: E402

# archive, item, external palette (FONTS item) or None, override item or None,
# {frame: md5}
CASES = [
    ('LOGO', 0, None, None, {0: 'e51c564aa638dc62dd1fd79e6f6cc375'}),
    ('LOGO', 1, None, None, {0: '13a60ede277eebe8fec69f03c5cb5843',
                             30: 'c687fc35b940d0bfdaea5b6d51aa03c4',
                             63: '7c694409997fe15272abe71f3fea2759'}),
    ('MAINMENU', 21, None, None, {0: '848e33a0addc6e9acdc4fee6cbd56639'}),
    ('MAINMENU', 7, 6, None, {0: 'f301ffcc1a2faa3a0aa68514784012ec'}),
    ('MAINMENU', 0, 6, None, {0: '7c3b347e03d42cd7bd1597f9dd58594e',
                              15: '2a66f4c30ca315cc061606b27cef4adf',
                              49: '848e33a0addc6e9acdc4fee6cbd56639'}),
    ('MONSTER', 7, 4, 14, {0: '35d32459bfce6b19df14cafd2faf398b',
                           5: '924fafdc83e0414331e0c627c3f9b3c7',
                           19: '272ca2d13132a1b0497e47225ee680e2'}),
    ('STARBG', 9, 5, None, {0: '3b6ccbe3fc46e13c1fa80edf611d7a62'}),
    ('SHIPS', 42, 12, 49, {0: '4ababc13ae860494d4f512f8ebeca834'}),
]


def external6(path, n):
    """A FONTS.LBX palette as raw 6-bit (R, G, B) triples."""
    data = LbxArchive(path).item(n)
    return {i: tuple(data[i * 4 + 1:i * 4 + 4]) for i in range(256)}


def internal6(item):
    """An item's embedded palette patch as raw 6-bit triples."""
    if item.internal_palette() is None:
        return {}
    start = 0x0C + (item.nframes + 1) * 4
    first, count = struct.unpack_from('<HH', item.data, start)
    return {first + i: tuple(item.data[start + 4 + i * 4 + 1:start + 8 + i * 4])
            for i in range(count)}


def pam_pixels(item, frame, palette):
    pixels, _ = item.decode_frame(frame)
    cov = item._moo2_coverage_cache.get(frame)
    masked = cov is not None and not all(cov)
    out = bytearray()
    for j, v in enumerate(pixels):
        rgb = bytes(palette.get(v, (0, 0, 0)))
        if not masked:
            out += rgb
        elif cov[j]:
            out += rgb + b'\x3f'
        else:
            out += b'\0\0\0\0'
    return out


def main():
    moo2 = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        ROOT, 'Master of Orion 1', 'mastori2')
    if not os.path.isfile(os.path.join(moo2, 'FONTS.LBX')):
        print('SKIP: no MoO2 game files at %s' % moo2)
        return 0
    failed = total = 0
    for archive, idx, ext, override, frames in CASES:
        ar = LbxArchive(os.path.join(moo2, archive + '.LBX'))
        item = GfxItem(ar.item(idx), format='moo2')
        palette = external6(os.path.join(moo2, 'FONTS.LBX'), ext) if ext else {}
        if override is not None:
            palette.update(internal6(GfxItem(ar.item(override), format='moo2')))
        palette.update(internal6(item))
        for frame, want in sorted(frames.items()):
            got = hashlib.md5(pam_pixels(item, frame, palette)).hexdigest()
            total += 1
            ok = got == want
            failed += not ok
            print('%-4s %-8s item %-3d frame %-3d %s' % (
                'ok' if ok else 'FAIL', archive, idx, frame,
                '' if ok else 'got %s want %s' % (got, want)))
    print('%d/%d frames match liblbx' % (total - failed, total))
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
