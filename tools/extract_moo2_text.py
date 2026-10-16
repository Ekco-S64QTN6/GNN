#!/usr/bin/env python3
"""Extract NUL-delimited text records from Master of Orion II LBX archives.

The first item of TECHNAME.LBX was confirmed to contain strings such as
"Starting Tech\\0Advanced Biology\\0...". This tool preserves item boundaries
and string order, emits readable UTF-8 JSON/TXT, and optionally saves raw item
bytes so formats with binary metadata are not irreversibly flattened.

Examples:
    python3 tools/extract_moo2_text.py
    python3 tools/extract_moo2_text.py --only TECHNAME,RACENAME,TECHDESC
    python3 tools/extract_moo2_text.py --all-lbx --out /tmp/moo2-text

This is a NUL-string-table extractor, not a claim that every byte in every
listed archive is plain text. Raw data is retained by default for later
format-specific parsing.
"""

import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lbx import LbxArchive, LbxError  # noqa: E402

DEFAULT_MOO2_DIR = 'Master of Orion 1/mastori2'
DEFAULT_OUT = 'assets/text/moo2'
TEXT_PREFIXES = (
    'TECHNAME', 'RACENAME', 'SHIPNAME', 'STARNAME', 'HELP', 'TECHDESC',
    'INFO', 'EVENTMSG', 'TEXT', 'STRNGS', 'STRINGS', 'HESTRNGS', 'JIMTEXT',
    'KENTEXT', 'MAINTEXT', 'SHIPTEXT', 'RACETEXT', 'TECHTEXT',
)


def visible_text(raw, encoding='cp437'):
    """Decode a byte string while making embedded control bytes visible."""
    text = raw.decode(encoding, errors='replace')
    out = []
    for ch in text:
        code = ord(ch)
        if code < 32 and ch not in ('\t', '\r', '\n'):
            out.append('<0x%02X>' % code)
        elif code == 127:
            out.append('<0x7F>')
        else:
            out.append(ch)
    return ''.join(out)


def split_nul_strings(payload, encoding='cp437'):
    """Return ordered NUL-delimited records, preserving interior empty slots."""
    chunks = payload.split(b'\x00')
    # A final NUL terminates the previous record; it isn't an extra record.
    if chunks and chunks[-1] == b'':
        chunks.pop()
    return [
        {'index': i, 'text': visible_text(chunk, encoding), 'raw_hex': chunk.hex()}
        for i, chunk in enumerate(chunks)
    ]


def selected_archive(name, only=None):
    base = os.path.splitext(name)[0].upper()
    if only:
        return any(base == key or base.startswith(key) for key in only)
    return any(base.startswith(prefix) for prefix in TEXT_PREFIXES)


def extract_archive(path, out_root, encoding='cp437', write_raw=True):
    archive = LbxArchive(path)
    name = os.path.splitext(os.path.basename(path))[0].upper()
    archive_out = os.path.join(out_root, name)
    os.makedirs(archive_out, exist_ok=True)

    item_records = []
    txt_lines = ['# %s.LBX — NUL-delimited strings (encoding: %s)' % (name, encoding), '']
    for item_index in range(len(archive)):
        start, end = archive.offsets[item_index:item_index + 2]
        payload = archive.item(item_index)
        records = split_nul_strings(payload, encoding)
        item_records.append({
            'item': item_index,
            'absolute_offset': start,
            'size_bytes': len(payload),
            'record_count': len(records),
            'records': records,
        })
        txt_lines.append('## Item %d — offset 0x%X, %d bytes, %d records' %
                         (item_index, start, len(payload), len(records)))
        for record in records:
            txt_lines.append('[%04d] %s' % (record['index'], record['text']))
        txt_lines.append('')

        if write_raw:
            raw_dir = os.path.join(archive_out, 'raw')
            os.makedirs(raw_dir, exist_ok=True)
            raw_path = os.path.join(raw_dir, 'item_%02d.bin' % item_index)
            with open(raw_path, 'wb') as raw_file:
                raw_file.write(payload)

    data = {
        'archive': name,
        'source': 'moo2',
        'container_item_count': len(archive),
        'encoding': encoding,
        'record_format': 'NUL-delimited byte strings; embedded control bytes rendered as <0xNN>',
        'raw_items_saved': bool(write_raw),
        'items': item_records,
    }
    json_path = os.path.join(archive_out, '%s.json' % name.lower())
    txt_path = os.path.join(archive_out, '%s.txt' % name.lower())
    with open(json_path, 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
        fh.write('\n')
    with open(txt_path, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(txt_lines))
        fh.write('\n')

    return len(archive), sum(x['record_count'] for x in item_records), json_path


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--moo2-dir', default=DEFAULT_MOO2_DIR,
                    help='directory containing MoO2 LBX archives')
    ap.add_argument('--out', default=DEFAULT_OUT, help='output directory')
    ap.add_argument('--only', default=None,
                    help='comma-separated archive names/prefixes, e.g. TECHNAME,RACENAME')
    ap.add_argument('--all-lbx', action='store_true',
                    help='process every LBX archive instead of the default text-archive list')
    ap.add_argument('--encoding', default='cp437',
                    help='legacy text encoding used to decode records (default: cp437)')
    ap.add_argument('--no-raw', action='store_true',
                    help='do not write per-item raw .bin files')
    args = ap.parse_args()

    if not os.path.isdir(args.moo2_dir):
        print('MoO2 directory not found: %s' % args.moo2_dir, file=sys.stderr)
        return 1
    only = {x.strip().upper() for x in args.only.split(',') if x.strip()} \
        if args.only else None

    names = sorted(n for n in os.listdir(args.moo2_dir)
                   if n.lower().endswith('.lbx') and
                   (args.all_lbx or selected_archive(n, only)))
    if only and not names:
        print('no matching LBX archives found for --only %s' % args.only,
              file=sys.stderr)
        return 1
    if not names:
        print('no candidate text LBX archives found in %s' % args.moo2_dir,
              file=sys.stderr)
        return 1

    total_items = total_records = processed = 0
    for filename in names:
        path = os.path.join(args.moo2_dir, filename)
        try:
            item_count, record_count, output_path = extract_archive(
                path, args.out, args.encoding, write_raw=not args.no_raw)
        except (LbxError, OSError, ValueError) as err:
            print('%-20s skip (%s)' % (filename, err), file=sys.stderr)
            continue
        print('%-20s items %3d  NUL records %5d  -> %s' %
              (filename, item_count, record_count, output_path))
        total_items += item_count
        total_records += record_count
        processed += 1

    print('\n%d archive(s), %d items, %d NUL-delimited records extracted' %
          (processed, total_items, total_records))
    if processed == 0:
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
