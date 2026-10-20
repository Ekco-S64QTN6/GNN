import json
import os
import struct
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TOOLS = os.path.join(ROOT, 'tools')
sys.path.insert(0, TOOLS)

from PIL import Image
from lbx import (GfxItem, LbxError, load_moo2_external_palette,
                 MOO2_FLAG_INTERNAL_PALETTE)
from extract_moo2_text import split_nul_strings, extract_archive as extract_text_archive
from extract_moo2 import (is_palette_holder, load_palette_map, extract_archive,
                          apply_forced_palette)


def make_moo2_item(flags=0x1000, w=2, h=1, first_color=5, colors=None):
    """Build a tiny self-contained MoO2 graphic with an optional palette."""
    colors = colors if colors is not None else [(1, 1, 2, 3), (1, 63, 32, 16)]
    nframes = 1
    table_end = 0x0C + (nframes + 1) * 4
    palette_bytes = b''
    if flags & MOO2_FLAG_INTERNAL_PALETTE:
        palette_bytes = struct.pack('<HH', first_color, len(colors))
        palette_bytes += b''.join(bytes(c) for c in colors)
    frame_start = table_end + len(palette_bytes)
    # Marker 1, initial y 0, then the (0, 1000) end-of-frame command: a frame
    # that draws nothing. The decoder's grammar is in lbx.py:_decode_moo2_one.
    frame_body = struct.pack('<HHHH', 1, 0, 0, 1000)
    frame_end = frame_start + len(frame_body)
    header = struct.pack('<6H', w, h, 0, nframes, 0, flags)
    offsets = struct.pack('<2I', frame_start, frame_end)
    return header + offsets + palette_bytes + frame_body


def make_moo2_sprite(colors=(1, 2), flags=0):
    """Build a 2x1 image: marker, one run of pixels at x 0, end of frame."""
    nframes = 1
    table_end = 0x0C + (nframes + 1) * 4
    frame_body = (struct.pack('<HH', 1, 0) + struct.pack('<HH', len(colors), 0)
                  + bytes(colors) + struct.pack('<HH', 0, 1000))
    frame_start = table_end
    frame_end = frame_start + len(frame_body)
    return (struct.pack('<6H', 2, 1, 0, nframes, 0, flags)
            + struct.pack('<2I', frame_start, frame_end) + frame_body)


def make_lbx(path, items):
    header_size = 8 + (len(items) + 1) * 4
    first = 0x800
    offsets = [first]
    for item in items:
        offsets.append(offsets[-1] + len(item))
    with open(path, 'wb') as fh:
        fh.write(struct.pack('<HIH', len(items), 0xFEAD, 0))
        fh.write(struct.pack('<%dI' % len(offsets), *offsets))
        fh.write(b'\0' * (first - header_size))
        for item in items:
            fh.write(item)


class Moo2ToolsTests(unittest.TestCase):
    def test_internal_palette_patches_only_declared_range(self):
        raw = make_moo2_item()
        item = GfxItem(raw, format='moo2')
        self.assertTrue(item.plausible())
        self.assertEqual(item.internal_palette()[0], 5)
        base = {5: (10, 20, 30), 6: (20, 30, 40), 7: (1, 2, 3)}
        merged = item.palette(base)
        self.assertEqual(merged[5], (4, 8, 12))
        self.assertEqual(merged[6], (252, 128, 64))
        self.assertEqual(merged[7], (1, 2, 3))

    def test_tiny_internal_palette_item_is_a_holder(self):
        item = GfxItem(make_moo2_item(w=1, h=1), format='moo2')
        self.assertTrue(is_palette_holder(item))

    def test_small_image_without_internal_palette_is_not_assumed_holder(self):
        item = GfxItem(make_moo2_item(flags=0, w=1, h=1), format='moo2')
        self.assertFalse(is_palette_holder(item))

    def test_techname_style_nul_strings_preserve_order_and_empty_slots(self):
        records = split_nul_strings(b'Starting Tech\0Advanced Biology\0\0Anti-Matter\0')
        self.assertEqual([r['text'] for r in records],
                         ['Starting Tech', 'Advanced Biology', '', 'Anti-Matter'])
        self.assertEqual([r['index'] for r in records], [0, 1, 2, 3])

    def test_text_extractor_writes_json_txt_and_raw_items(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = os.path.join(tmp, 'TECHNAME.LBX')
            out_root = os.path.join(tmp, 'out')
            payload = b'Starting Tech\x00Advanced Biology\x00'
            make_lbx(source, [payload])
            item_count, record_count, json_path = extract_text_archive(source, out_root)
            self.assertEqual((item_count, record_count), (1, 2))
            with open(json_path, encoding='utf-8') as fh:
                parsed = json.load(fh)
            self.assertEqual([r['text'] for r in parsed['items'][0]['records']],
                             ['Starting Tech', 'Advanced Biology'])
            archive_dir = os.path.dirname(json_path)
            self.assertTrue(os.path.isfile(os.path.join(archive_dir, 'techname.txt')))
            with open(os.path.join(archive_dir, 'raw', 'item_00.bin'), 'rb') as fh:
                self.assertEqual(fh.read(), payload)

    def test_external_palette_item_zero_is_rejected_and_item_one_loads(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, 'FONTS.LBX')
            font_payload = bytes(1024)
            palette_payload = b''.join(bytes((1, i % 64, 10, 20)) for i in range(256))
            make_lbx(path, [font_payload, palette_payload])
            with self.assertRaises(LbxError):
                load_moo2_external_palette(path, 0)
            palette = load_moo2_external_palette(path, 1)
            self.assertEqual(len(palette), 256)
            self.assertEqual(palette[1], (4, 40, 80))

    def test_item_specific_override_can_reference_later_archive_item(self):
        with tempfile.TemporaryDirectory() as tmp:
            archive_path = os.path.join(tmp, 'SYNTH.LBX')
            out_dir = os.path.join(tmp, 'out')
            sprite = make_moo2_sprite()
            override_holder = make_moo2_item(
                w=1, h=1, first_color=1, colors=[(1, 0, 63, 0)])
            make_lbx(archive_path, [sprite, override_holder])

            def palette_for(index):
                if index == 12:
                    return {1: (11, 22, 33), 2: (44, 55, 66)}
                return {1: (1, 2, 3), 2: (4, 5, 6)}

            extracted, skipped = extract_archive(
                archive_path, out_dir, palette_for(3), 3,
                palette_for, {0: 12}, {0: 1})
            self.assertEqual((extracted, skipped), (1, 1))
            rendered = Image.open(os.path.join(out_dir, 'item_00_frame_000.png')).convert('RGBA')
            self.assertEqual(rendered.getpixel((0, 0)), (0, 252, 0, 255))
            with open(os.path.join(out_dir, 'manifest.json'), encoding='utf-8') as fh:
                manifest = json.load(fh)
            self.assertEqual(manifest['items'][0]['palette_index'], 12)
            self.assertEqual(manifest['items'][0]['palette_override_item'], 1)


    def test_forced_palette_clears_archive_and_item_overrides(self):
        archive_map = {'SHIPS': 3}
        item_palettes = {'SHIPS': {42: 12}}
        item_overrides = {'SHIPS': {42: 49}}
        result = apply_forced_palette(3, archive_map, 1, item_palettes, item_overrides,
                                      {'GAME': [[0, 9, 2]]}, {'MONSTER': [[0, 9, 4]]})
        self.assertEqual(result, ({}, 3, {}, {}, {}, {}))

    def test_moo2_decoder_exposes_truncated_run_diagnostic(self):
        # A run that declares five pixels and carries one.
        body = struct.pack('<HH', 1, 0) + struct.pack('<HH', 5, 0) + b'\x7f'
        nframes = 1
        table_end = 0x0C + (nframes + 1) * 4
        header = struct.pack('<6H', 2, 1, 0, nframes, 0, 0)
        offsets = struct.pack('<2I', table_end, table_end + len(body))
        item = GfxItem(header + offsets + body, format='moo2')
        _pixels, clean = item.decode_frame(0)
        self.assertFalse(clean)
        self.assertEqual(item.decode_warnings[0][0]['kind'], 'truncated_pixel_run')
        self.assertEqual(item.decode_warnings[0][0]['declared_length'], 5)
        self.assertEqual(item.decode_warnings[0][0]['remaining_bytes'], 1)

    def test_palette_map_nested_overrides(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, 'palette_map.json')
            with open(path, 'w', encoding='utf-8') as fh:
                json.dump({
                    '_default': 1,
                    'SHIPS': 3,
                    '_item_palettes': {'SHIPS': {'42': 12}},
                    '_item_overrides': {'SHIPS': {'42': 49}},
                }, fh)
            archive_map, default, per_item, overrides, _splits, _chains = load_palette_map(path)
            self.assertEqual(default, 1)
            self.assertEqual(archive_map, {'SHIPS': 3})
            self.assertEqual(per_item['SHIPS'], {42: 12})
            self.assertEqual(overrides['SHIPS'], {42: 49})

    def test_palette_holder_updates_later_items_during_extraction(self):
        with tempfile.TemporaryDirectory() as tmp:
            archive_path = os.path.join(tmp, 'SYNTH.LBX')
            out_dir = os.path.join(tmp, 'out')
            sprite_before = make_moo2_sprite()
            holder = make_moo2_item(
                w=1, h=1, first_color=1, colors=[(1, 63, 0, 0)])
            sprite_after = make_moo2_sprite()
            make_lbx(archive_path, [sprite_before, holder, sprite_after])

            def unused_palette_loader(index):
                return {1: (10, 20, 30), 2: (40, 50, 60)}

            extracted, skipped = extract_archive(
                archive_path, out_dir, unused_palette_loader(1), 1,
                unused_palette_loader, {}, {})
            self.assertEqual(extracted, 2)
            self.assertEqual(skipped, 1)
            before = Image.open(os.path.join(out_dir, 'item_00_frame_000.png')).convert('RGBA')
            after = Image.open(os.path.join(out_dir, 'item_02_frame_000.png')).convert('RGBA')
            self.assertEqual(before.getpixel((0, 0)), (10, 20, 30, 255))
            self.assertEqual(after.getpixel((0, 0)), (252, 0, 0, 255))
            with open(os.path.join(out_dir, 'manifest.json'), encoding='utf-8') as fh:
                manifest = json.load(fh)
            self.assertEqual(manifest['palette_holders'][0]['item'], 1)


if __name__ == '__main__':
    unittest.main(verbosity=2)
