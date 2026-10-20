#!/usr/bin/env python3
"""
scan_strays.py — find content the LBX offset table does not reference.

Every LBX file has a header, an offset table, and (usually) padding between
the end of the table and the first item. Some tools — and some of the game's
own installers — leave orphan data in that padding, or after the last
declared item. This script walks the whole file and reports every region
that is not covered by a declared item, then probes each region for a
plausible MoO1 (0x12-byte header) or MoO2 (0x0C-byte header) item.

Usage
    python3 tools/scan_strays.py path/to/file.lbx
    python3 tools/scan_strays.py "Master of Orion 1/data" -r
    python3 tools/scan_strays.py path/to/file.lbx --dump-region 0x800:0x900
    python3 tools/scan_strays.py "Master of Orion 1/data" -r --quiet

Output, per file:
    container header (count, type, offset-table span)
    every gap, with a hex preview and any header-like reads inside it

--quiet prints a one-line summary per file and only for files that have
non-trivial (non-zero) gaps. Useful when scanning a whole directory.
"""

import argparse
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lbx import LBX_MAGIC, MOO1_HEADER, MOO2_HEADER  # noqa: E402

# ----------------------------------------------------------------------
# Header probes
# ----------------------------------------------------------------------
#
# Neither probe decodes a frame. They only answer "could this 80-or-so
# byte region be an item header?" — that is enough to flag padding worth
# investigating, and cheap enough to run at every offset inside every gap.
#
# The MoO1 probe is stricter on w/h because MoO1 assets top out at 640x400.
# The MoO2 probe allows 1024 on both axes, since MoO2 shipped at 640x480
# and a few scenes at higher internal resolutions.

def looks_like_moo1_item(blob, off):
    if off + MOO1_HEADER > len(blob):
        return None
    (w, h, _u, nframes,
     _ls, _fl) = struct.unpack_from('<6H', blob, off)
    if not (0 < w <= 640 and 0 < h <= 400):
        return None
    if not (0 < nframes <= 512):
        return None
    table_end = off + MOO1_HEADER + (nframes + 1) * 4
    if table_end > len(blob):
        return None
    first_off = struct.unpack_from('<I', blob, off + MOO1_HEADER)[0]
    if first_off < MOO1_HEADER + (nframes + 1) * 4:
        return None
    if first_off > len(blob) - off:
        return None
    return (w, h, nframes, first_off)


def looks_like_moo2_item(blob, off):
    if off + MOO2_HEADER > len(blob):
        return None
    w, h, _u, nframes = struct.unpack_from('<4H', blob, off)
    if not (0 < w <= 1024 and 0 < h <= 1024):
        return None
    if not (0 < nframes <= 512):
        return None
    table_end = off + MOO2_HEADER + (nframes + 1) * 4
    if table_end > len(blob):
        return None
    first_off = struct.unpack_from('<I', blob, off + MOO2_HEADER)[0]
    if first_off < MOO2_HEADER + (nframes + 1) * 4:
        return None
    if first_off > len(blob) - off:
        return None
    return (w, h, nframes, first_off)


# ----------------------------------------------------------------------
# Gap discovery
# ----------------------------------------------------------------------

def find_gaps(path):
    with open(path, 'rb') as fh:
        blob = fh.read()
    if len(blob) < 8:
        return blob, None, None, []
    count, magic, itype = struct.unpack_from('<HIH', blob, 0)
    if magic != LBX_MAGIC:
        return blob, None, None, []

    table_start = 8
    table_end = table_start + (count + 1) * 4
    if table_end > len(blob):
        return blob, None, (count, magic, itype), [(table_start, len(blob), 'truncated-table')]

    offsets = struct.unpack_from('<%dI' % (count + 1), blob, table_start)
    gaps = []

    if offsets[0] > table_end:
        gaps.append((table_end, offsets[0], 'padding'))

    prev = offsets[0]
    for i in range(1, count + 1):
        cur = offsets[i]
        if cur < prev:
            gaps.append((prev, cur, 'out-of-order-after-item-%d' % (i - 1)))
        elif cur > prev + 0x100000:            # >1 MB gap inside declared items
            gaps.append((prev, cur, 'large-gap-after-item-%d' % (i - 1)))
        prev = cur

    if offsets[-1] < len(blob):
        gaps.append((offsets[-1], len(blob), 'trailing'))

    return blob, offsets, (count, magic, itype), gaps


# ----------------------------------------------------------------------
# Reporting
# ----------------------------------------------------------------------

def hex_preview(blob, start, n=48):
    chunk = blob[start:start + n]
    out = []
    for i in range(0, len(chunk), 16):
        row = chunk[i:i + 16]
        hex_str = ' '.join('%02x' % b for b in row)
        asc = ''.join(chr(b) if 32 <= b < 127 else '.' for b in row)
        out.append('        %08x: %-47s  %s'
                   % (start + i, hex_str, asc))
    return '\n'.join(out)


def probe_gap(blob, start, end):
    """
    Return a list of (offset, kind, w, h, nframes, first_off) for every
    alignment inside the gap that reads as a plausible item header.

    `kind` is 'moo1' or 'moo2'. `first_off` is the first frame offset
    relative to the header, so the caller can tell whether the frame
    data lies inside the gap.
    """
    hits = []
    # Probe byte 0 and a handful of plausible alignment offsets. Item
    # headers in MoO1 and MoO2 start on 2-byte boundaries, but archives
    # that concatenate items can shift by any number; probing every byte
    # is only ~2 KB per gap and cheap.
    for p in range(start, end):
        if p + MOO2_HEADER > end:
            break
        m1 = looks_like_moo1_item(blob, p)
        if m1:
            hits.append((p, 'moo1') + m1)
            continue
        m2 = looks_like_moo2_item(blob, p)
        if m2:
            hits.append((p, 'moo2') + m2)
    return hits


def report_file(path, quiet=False, dump_regions=None):
    blob, offsets, header, gaps = find_gaps(path)
    if not blob:
        print('%s: empty' % path)
        return False

    if header is None:
        # Not an LBX at all. Report and bail.
        if not quiet:
            print('=== %s' % path)
            print('    not an LBX container (magic mismatch)')
            print()
        return False

    count, _magic, itype = header
    interesting = False

    for (start, end, label) in gaps:
        if end <= start:
            continue
        # A padding region that is all zeros is not interesting.
        chunk = blob[start:end]
        if not any(chunk):
            continue
        interesting = True

    if quiet and not interesting:
        print('%-60s ok (%d items, clean)' % (path, count))
        return False

    print('=== %s' % path)
    print('    size         : %d bytes' % len(blob))
    print('    items        : %d' % count)
    print('    type         : %d' % itype)
    if offsets:
        print('    offset table : 0x%x..0x%x'
              % (8, 8 + (count + 1) * 4))
        print('    offsets[0]   : 0x%x' % offsets[0])
        print('    offsets[-1]  : 0x%x' % offsets[-1])
        if offsets[-1] != len(blob):
            print('    trailing     : %d bytes after the last declared item'
                  % (len(blob) - offsets[-1]))

    if not gaps:
        print('    gaps         : none')
        print()
        return False

    for (start, end, label) in gaps:
        size = end - start
        if size <= 0:
            continue
        chunk = blob[start:end]
        if not any(chunk):
            print('    gap %-28s: 0x%x..0x%x  (%d bytes, all zero)'
                  % (label, start, end, size))
            continue

        print('    gap %-28s: 0x%x..0x%x  (%d bytes)'
              % (label, start, end, size))
        print(hex_preview(blob, start, min(size, 48)))

        hits = probe_gap(blob, start, end)
        if hits:
            print('        %d plausible item header(s) inside this gap:'
                  % len(hits))
            for (off, kind, w, h, nframes, first_off) in hits:
                first_abs = off + first_off
                inside = 'inside gap' if first_abs < end else 'past gap'
                print('            %s at 0x%x: %dx%d, %d frames, '
                      'first frame at +0x%x (%s)'
                      % (kind, off, w, h, nframes, first_off, inside))
        print()

    if dump_regions:
        for spec in dump_regions:
            try:
                a, b = (int(x, 0) for x in spec.split(':'))
            except (ValueError, TypeError):
                print('    bad --dump-region spec: %r' % spec)
                continue
            a = max(0, min(a, len(blob)))
            b = max(a, min(b, len(blob)))
            print('    dump 0x%x..0x%x:' % (a, b))
            print(hex_preview(blob, a, b - a))
            print()

    return interesting


# ----------------------------------------------------------------------
# Directory walker
# ----------------------------------------------------------------------

def iter_lbx(paths, recursive):
    for p in paths:
        if os.path.isdir(p):
            if recursive:
                for root, _dirs, names in os.walk(p):
                    for n in sorted(names):
                        if n.lower().endswith('.lbx'):
                            yield os.path.join(root, n)
            else:
                for n in sorted(os.listdir(p)):
                    if n.lower().endswith('.lbx'):
                        yield os.path.join(p, n)
        else:
            yield p


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('paths', nargs='+',
                    help='LBX files or directories containing them')
    ap.add_argument('-r', '--recursive', action='store_true',
                    help='recurse into directories')
    ap.add_argument('-q', '--quiet', action='store_true',
                    help='one line per file; only files with content '
                         'in their gaps are printed in full')
    ap.add_argument('--dump-region', action='append', default=None,
                    metavar='START:END',
                    help='hex-dump an arbitrary byte range of each file '
                         '(may be repeated; offsets accept 0x prefixes)')
    args = ap.parse_args()

    total = 0
    interesting = 0
    for f in iter_lbx(args.paths, args.recursive):
        total += 1
        try:
            if report_file(f, quiet=args.quiet,
                           dump_regions=args.dump_region):
                interesting += 1
        except Exception as err:
            print('%s: scan failed: %s' % (f, err))

    if args.quiet:
        print('%d files scanned, %d with non-trivial gaps'
              % (total, interesting))


if __name__ == '__main__':
    main()