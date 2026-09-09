#!/usr/bin/env python3
"""
lbx.py — Master of Orion 1 LBX archive reader / LBXGFX decoder.

Container
    u16 count | u32 0x0000FEAD | u16 type | (count+1) x u32 item offsets

LBXGFX item header (0x12 bytes)
    0x00 u16 width      0x02 u16 height    0x04 u16 (unused)
    0x06 u16 nframes    0x08 u16 loopstart 0x0a u16 flags
    0x0c u16 (unused)   0x0e u32 palette-block offset (0 = archive default)
    0x12 (nframes+1) x u32 frame offsets

Embedded palette block
    u16 rgb_offset | u16 firstcol | u16 numcols | u16 (unused)
    then numcols x 3 bytes of 6-bit VGA components.

Frame body
    u8 kind (1 = keyframe, 0 = delta over the previous frame)
    then one entry per column x in 0..w-1:
        0xFF                     -> column unchanged, advance to the next
        u8 mode | u8 seglen      -> seglen bytes of run data follow

    A column is a *sequence* of vertical runs packed into those seglen bytes:
        u8 pixcount | u8 skip | pixcount bytes of payload
    repeated until seglen is exhausted. Most columns hold one run, but 60% of
    the library holds two or more — that is how a sprite gets transparent gaps
    down a single column.

    `skip` is the number of transparent rows *before* this run, measured from
    the end of the previous run in the same column — not an absolute y. Reading
    it as absolute collapses every multi-run column toward the top of the image
    and smears the first run down the rest, which is what produced the vertical
    streaking in earlier extractions. Single-run columns decode identically
    either way, which is why solid artwork (the anchor, the story icons) looked
    correct while planets, consoles and cinematics did not.

    mode 0x80 = RLE payload, 0x00 = raw payload.
    RLE: v >= 0xE0 emits (v - 0xDF) copies of the next byte; else v is literal.
    Palette index 0 is transparent.
"""

import struct

LBX_MAGIC = 0x0000FEAD
GFX_HEADER = 0x12
SKIP_COLUMN = 0xFF
TRANSPARENT = 0
RLE_BASE = 0xDF


def _vga8(v):
    """6-bit VGA component -> 8-bit, by bit replication (63 -> 255)."""
    v &= 0x3F
    return (v << 2) | (v >> 4)


class LbxError(Exception):
    pass


class LbxArchive:
    def __init__(self, path):
        self.path = path
        with open(path, 'rb') as fh:
            self.blob = fh.read()
        count, magic, self.type = struct.unpack_from('<HIH', self.blob, 0)
        if magic != LBX_MAGIC:
            raise LbxError('%s: bad magic %#x' % (path, magic))
        self.count = count
        self.offsets = struct.unpack_from('<%dI' % (count + 1), self.blob, 8)

    def __len__(self):
        return self.count

    def item(self, i):
        return self.blob[self.offsets[i]:self.offsets[i + 1]]


class GfxItem:
    def __init__(self, data):
        self.data = data
        if len(data) < GFX_HEADER:
            self.w = self.h = self.nframes = 0
            self.loopstart = self.flags = self.pal_offset = 0
            self.frame_offsets = ()
            return
        (self.w, self.h, _u, self.nframes,
         self.loopstart, self.flags) = struct.unpack_from('<6H', data, 0)
        self.pal_offset = struct.unpack_from('<I', data, 0x0e)[0]
        try:
            self.frame_offsets = struct.unpack_from(
                '<%dI' % (self.nframes + 1), data, GFX_HEADER)
        except struct.error:
            self.frame_offsets = ()

    def plausible(self):
        if not (0 < self.w <= 640 and 0 < self.h <= 400):
            return False
        if not (0 < self.nframes <= 512) or not self.frame_offsets:
            return False
        o = self.frame_offsets
        if o[0] < GFX_HEADER + (self.nframes + 1) * 4:
            return False
        if o[-1] > len(self.data):
            return False
        return all(o[i] <= o[i + 1] for i in range(len(o) - 1))

    def palette(self):
        """Return {index: (r, g, b)} for the embedded palette, or {}."""
        o = self.pal_offset
        if not o or o + 8 > len(self.data):
            return {}
        rgb_off, firstcol, numcols, _u = struct.unpack_from('<4H', self.data, o)
        if rgb_off + numcols * 3 > len(self.data):
            return {}
        out = {}
        for i in range(numcols):
            r, g, b = self.data[rgb_off + i * 3: rgb_off + i * 3 + 3]
            out[firstcol + i] = (_vga8(r), _vga8(g), _vga8(b))
        return out

    @staticmethod
    def _expand(payload, compressed):
        if not compressed:
            return payload
        out = []
        i = 0
        n = len(payload)
        while i < n:
            v = payload[i]
            if v >= 0xE0 and i + 1 < n:
                out.extend([payload[i + 1]] * (v - RLE_BASE))
                i += 2
            else:
                out.append(v)
                i += 1
        return out

    def decode_frame(self, idx, prev=None):
        """Decode one frame into a bytearray of w*h palette indices."""
        w, h = self.w, self.h
        out = bytearray(prev) if prev is not None else bytearray(w * h)
        body = self.data[self.frame_offsets[idx]:self.frame_offsets[idx + 1]]
        p = 1
        for x in range(w):
            if p >= len(body):
                break
            mode = body[p]
            if mode == SKIP_COLUMN:
                p += 1
                continue
            seglen = body[p + 1]
            end = p + 2 + seglen
            q = p + 2
            y = 0
            # Walk every run in this column, not just the first one, and carry
            # the cursor down: each run's leading byte is a gap, not a y.
            while q + 2 <= end:
                pixcount = body[q]
                skip = body[q + 1]
                payload = body[q + 2:q + 2 + pixcount]
                q += 2 + pixcount
                y += skip
                for px in self._expand(payload, mode & 0x80):
                    if px != TRANSPARENT and 0 <= y < h:
                        out[y * w + x] = px
                    y += 1
            p = end
        return out, p == len(body)

    def frames(self):
        prev = None
        for i in range(self.nframes):
            kind = self.data[self.frame_offsets[i]]
            buf, clean = self.decode_frame(i, prev if kind == 0 else None)
            prev = buf
            yield buf, clean
