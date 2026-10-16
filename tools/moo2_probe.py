#!/usr/bin/env python3
"""Inspect LBX containers and dump item/frame bytes using actual offsets.

Default mode reports both game directories and prints a few dynamically
located reference blocks. To inspect the start of a text item (as in the
TECHNAME.LBX investigation), use:

    python3 tools/moo2_probe.py --archive TECHNAME --item 0 --bytes 256
"""

import argparse
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lbx import LbxArchive, GfxItem, LbxError  # noqa: E402

DEFAULT_MOO2 = 'Master of Orion 1/mastori2'
DEFAULT_MOO1 = 'Master of Orion 1/data'
MAGIC = 0xFEAD


def hexblock(chunk, start_abs, max_bytes=128):
    lines = []
    chunk = chunk[:max_bytes]
    for i in range(0, len(chunk), 16):
        row = chunk[i:i + 16]
        hx = ' '.join('%02x' % b for b in row)
        asc = ''.join(chr(b) if 32 <= b < 127 else '.' for b in row)
        lines.append('%08x  %-47s  %s' % (start_abs + i, hx, asc))
    return '\n'.join(lines)


def header(path):
    """Return (count, type, offsets or None, file_size) or None if not LBX."""
    try:
        size = os.path.getsize(path)
        with open(path, 'rb') as fh:
            head = fh.read(8)
            if len(head) < 8:
                return None
            count, magic, item_type = struct.unpack('<HIH', head)
            if magic != MAGIC:
                return None
            need = 8 + (count + 1) * 4
            if need > size:
                return count, item_type, None, size
            fh.seek(0)
            table = fh.read(need)
        offsets = struct.unpack_from('<%dI' % (count + 1), table, 8)
        if any(offsets[i] > offsets[i + 1] for i in range(len(offsets) - 1)):
            return count, item_type, None, size
        if offsets and offsets[-1] > size:
            return count, item_type, None, size
        return count, item_type, offsets, size
    except OSError:
        return None


def scan_dir(directory, label):
    print('=' * 82)
    print('== %s (%s)' % (label, directory))
    print('=' * 82)
    if not os.path.isdir(directory):
        print('(missing)\n')
        return
    names = sorted(n for n in os.listdir(directory) if n.lower().endswith('.lbx'))
    print('%d LBX files\n' % len(names))
    print('%-22s %10s %6s %4s %10s %10s  %s' %
          ('name', 'size', 'count', 'type', 'off0', 'offN', 'note'))
    for name in names:
        path = os.path.join(directory, name)
        info = header(path)
        if info is None:
            print('%-22s %10d  ---  --  %10s %10s  not-LBX' %
                  (name, os.path.getsize(path), '', ''))
            continue
        count, item_type, offsets, size = info
        if offsets is None:
            print('%-22s %10d %6d %4d  %10s %10s  invalid/truncated offset table' %
                  (name, size, count, item_type, '', ''))
            continue
        note = ''
        table_end = 8 + (count + 1) * 4
        if count and offsets[0] != 0x800:
            note = 'first item at 0x%x (table end 0x%x)' % (offsets[0], table_end)
        print('%-22s %10d %6d %4d  0x%08x 0x%08x  %s' %
              (name, size, count, item_type, offsets[0], offsets[-1], note))
    print()


def dump_item(path, item_index, nbytes=128, label=None):
    info = header(path)
    if not info or info[2] is None:
        print('%s: not a readable LBX archive\n' % path)
        return
    count, _item_type, offsets, _size = info
    if not 0 <= item_index < count:
        print('%s: item %d out of range (0..%d)\n' %
              (path, item_index, count - 1))
        return
    start, end = offsets[item_index:item_index + 2]
    with open(path, 'rb') as fh:
        fh.seek(start)
        chunk = fh.read(min(nbytes, end - start))
    print('=' * 82)
    print('== %s item %d (absolute 0x%x, %d bytes)' %
          (label or os.path.basename(path), item_index, start, end - start))
    print('=' * 82)
    print(hexblock(chunk, start, nbytes))
    print()


def dump_frame(path, item_index=0, frame_index=0, nbytes=160):
    try:
        archive = LbxArchive(path)
    except (OSError, LbxError) as err:
        print('%s: %s\n' % (path, err))
        return
    if not 0 <= item_index < len(archive):
        print('%s: item %d out of range\n' % (path, item_index))
        return
    raw_item = archive.item(item_index)
    try:
        item = GfxItem(raw_item, format='moo2')
    except Exception as err:
        print('%s item %d: cannot parse graphic header (%s)\n' %
              (path, item_index, err))
        return
    if not item.plausible() or not 0 <= frame_index < item.nframes:
        print('%s item %d: no plausible frame %d\n' %
              (path, item_index, frame_index))
        return
    start = archive.offsets[item_index] + item.frame_offsets[frame_index]
    body = raw_item[item.frame_offsets[frame_index]:item.frame_offsets[frame_index + 1]]
    print('=' * 82)
    print('== %s item %d frame %d body (absolute 0x%x, %d bytes)' %
          (os.path.basename(path), item_index, frame_index, start, len(body)))
    print('=' * 82)
    print(hexblock(body, start, nbytes))
    print()


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--moo2-dir', default=DEFAULT_MOO2)
    ap.add_argument('--moo1-dir', default=DEFAULT_MOO1)
    ap.add_argument('--archive', default=None,
                    help='dump the beginning of one item in this MoO2 archive basename')
    ap.add_argument('--item', type=int, default=0, help='item index for --archive')
    ap.add_argument('--bytes', type=int, default=256,
                    help='max bytes for an item/frame dump (default: 256)')
    ap.add_argument('--frame', type=int, default=None,
                    help='when supplied with --archive, dump this graphic frame body instead')
    ap.add_argument('--scan-only', action='store_true',
                    help='only list archive metadata, without reference dumps')
    args = ap.parse_args()

    scan_dir(args.moo2_dir, 'MoO2 archives')
    scan_dir(args.moo1_dir, 'MoO1 archives')
    if args.scan_only:
        return 0

    if args.archive:
        path = os.path.join(args.moo2_dir, args.archive.upper() + '.LBX')
        if not os.path.isfile(path):
            path = os.path.join(args.moo2_dir, args.archive + '.lbx')
        if not os.path.isfile(path):
            print('archive not found: %s' % args.archive, file=sys.stderr)
            return 1
        if args.frame is None:
            dump_item(path, args.item, args.bytes)
        else:
            dump_frame(path, args.item, args.frame, args.bytes)
        return 0

    # Reference items/frames are located from each archive's real tables,
    # rather than stale hard-coded absolute offsets.
    references = (
        ('MONSTER.LBX', 0, 0),
        ('TANM_001.LBX', 0, 0),
    )
    for filename, item_index, frame_index in references:
        path = os.path.join(args.moo2_dir, filename)
        if os.path.isfile(path):
            dump_frame(path, item_index, frame_index, min(args.bytes, 160))

    techname = os.path.join(args.moo2_dir, 'TECHNAME.LBX')
    if os.path.isfile(techname):
        print('TECHNAME.LBX item 0 starts with the first table of NUL-delimited strings:')
        dump_item(techname, 0, min(args.bytes, 256))
    return 0


if __name__ == '__main__':
    sys.exit(main())
