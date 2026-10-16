#!/usr/bin/env python3
"""
lbx.py — Master of Orion 1 / Master of Orion 2 LBX reader.

Container (identical in both games)
    u16 count | u32 0x0000FEAD | u16 type | (count+1) x u32 item offsets
    Offsets are absolute file positions. MoO2 pads the header to 0x800.

------------------------------------------------------------
Item header — MoO1 (0x12 bytes)
    0x00 u16 width      0x02 u16 height    0x04 u16 (unused)
    0x06 u16 nframes    0x08 u16 loopstart 0x0a u16 flags
    0x0c u16 (unused)   0x0e u32 pal_offset
    0x12 (nframes+1) x u32 frame offsets

Palette block (referenced by pal_offset, 0 = archive default)
    u16 rgb_offset | u16 firstcol | u16 numcols | u16 (unused)
    then numcols x 3 bytes of 6-bit VGA components.

MoO1 frame body — column-major
    u8 kind (1 = keyframe, 0 = delta over the previous frame)
    then one entry per column x in 0..w-1:
        0xFF                     -> column unchanged
        u8 mode | u8 seglen      -> seglen bytes of run data
    A column is a sequence of vertical runs:
        u8 pixcount | u8 skip | pixcount bytes of payload
    `skip` is a gap from the end of the previous run, not an absolute y.
    mode 0x80 = RLE payload (v >= 0xE0 emits v-0xDF copies of next byte),
    mode 0x00 = raw.

    A delta column describes only the pixels that changed. Pixels inside
    the column that were not re-encoded are left as they were on the
    previous frame, which is what `skip` reserves. A pixel whose new
    value is 0 has been erased by the encoder and is written through as
    transparent; it is not skipped.

------------------------------------------------------------
Item header — MoO2 (0x0C bytes)
    0x00 u16 width      0x02 u16 height    0x04 u16 padding
    0x06 u16 nframes    0x08 u16 frame delay  0x0a u16 flags
    0x0c (nframes+1) x u32 frame offsets

MoO2 frame body — sparse sequence stream
    Unless raw flag 0x0100 is set:
        u16 frame marker       always 1
        u16 initial Y
        repeated sequence commands:
            u16 length
            if length > 0:
                u16 relative X  advance from the previous run's end
                length bytes of palette indices
                if length is odd, skip 1 padding byte
                advance X by length
            if length == 0:
                u16 relative Y  advance Y and reset X to zero
                value 1000 ends the frame

    Raw frames (flag 0x0100) contain width*height palette indices in
    row-major order, with no frame marker or command stream. Flag 0x2000
    (junction) indicates that sparse animation frames compose over the
    preceding frame instead of starting from a blank canvas.

------------------------------------------------------------
Format detection
    The two item headers differ only in length (0x12 vs 0x0C), so the
    decoder tries MoO1 first, validates the offset table, and falls
    back to MoO2. A caller who knows which game an archive came from
    can pass `format='moo1'` or `format='moo2'` to skip detection.
"""

import struct

LBX_MAGIC = 0x0000FEAD
MOO1_HEADER = 0x12
MOO2_HEADER = 0x0C
SKIP_COLUMN = 0xFF
TRANSPARENT = 0
RLE_BASE = 0xDF

# MoO2 image flags (stored in the final u16 of the 0x0C-byte header).
MOO2_FLAG_JUNCTION = 0x2000
MOO2_FLAG_INTERNAL_PALETTE = 0x1000
MOO2_FLAG_FUNCTIONAL_COLOR = 0x0800
MOO2_FLAG_FILL_BACKGROUND = 0x0400
MOO2_FLAG_RAW = 0x0100


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
        if len(self.blob) < 8:
            raise LbxError('%s: truncated LBX header' % path)
        count, magic, self.type = struct.unpack_from('<HIH', self.blob, 0)
        if magic != LBX_MAGIC:
            raise LbxError('%s: bad magic %#x' % (path, magic))
        table_end = 8 + (count + 1) * 4
        if table_end > len(self.blob):
            raise LbxError('%s: truncated LBX item-offset table' % path)
        self.count = count
        self.offsets = struct.unpack_from('<%dI' % (count + 1), self.blob, 8)
        if self.offsets and self.offsets[0] < table_end:
            raise LbxError('%s: first item offset overlaps the LBX header/table' % path)
        if any(a > b for a, b in zip(self.offsets, self.offsets[1:])):
            raise LbxError('%s: LBX item offsets are not monotonic' % path)
        if self.offsets and self.offsets[-1] > len(self.blob):
            raise LbxError('%s: final item offset exceeds file size' % path)

    def __len__(self):
        return self.count

    def item(self, i):
        if not 0 <= i < self.count:
            raise IndexError('LBX item index out of range: %s' % i)
        return self.blob[self.offsets[i]:self.offsets[i + 1]]


def _valid_offset_table(data, header_len, w, h, nframes):
    """True when the candidate header yields a monotonic offset table."""
    if not (0 < w <= 640 and 0 < h <= 480):
        return False
    if not (0 < nframes <= 512):
        return False
    table_end = header_len + (nframes + 1) * 4
    if table_end > len(data):
        return False
    try:
        offsets = struct.unpack_from('<%dI' % (nframes + 1), data, header_len)
    except struct.error:
        return False
    if offsets[0] < table_end:
        return False
    if offsets[-1] > len(data):
        return False
    for i in range(len(offsets) - 1):
        if offsets[i] > offsets[i + 1]:
            return False
    return True


def _detect_format(data):
    if len(data) < MOO2_HEADER:
        return 'moo1'
    w, h, _u, nframes = struct.unpack_from('<4H', data, 0)
    if _valid_offset_table(data, MOO1_HEADER, w, h, nframes):
        return 'moo1'
    if _valid_offset_table(data, MOO2_HEADER, w, h, nframes):
        return 'moo2'
    return 'moo1'  # nothing validates; let the caller fail plausibility


class GfxItem:
    def __init__(self, data, format='auto'):
        self.data = data
        self.decode_warnings = {}
        # MoO2 junction animations need previous-frame pixels and coverage.
        # Cache decoded frames because render_rgba() may request them directly.
        self._moo2_frame_cache = {}
        self._moo2_coverage_cache = {}
        # Bytes after the explicit MoO2 frame terminator are retained as a
        # per-frame trailer, but are not pixel data or structural warnings.
        self._moo2_trailer_cache = {}
        self.format = _detect_format(data) if format == 'auto' else format

        header_len = MOO1_HEADER if self.format == 'moo1' else MOO2_HEADER
        if len(data) < header_len:
            self.w = self.h = self.nframes = 0
            self.loopstart = self.flags = self.pal_offset = 0
            self.frame_offsets = ()
            return

        (self.w, self.h, _u, self.nframes,
         self.loopstart, self.flags) = struct.unpack_from('<6H', data, 0)
        if self.format == 'moo1':
            self.pal_offset = struct.unpack_from('<I', data, 0x0e)[0]
        else:
            self.pal_offset = 0
        try:
            self.frame_offsets = struct.unpack_from(
                '<%dI' % (self.nframes + 1), data, header_len)
        except struct.error:
            self.frame_offsets = ()

    def plausible(self):
        if not (0 < self.w <= 640 and 0 < self.h <= 480):
            return False
        if not (0 < self.nframes <= 512) or len(self.frame_offsets) != self.nframes + 1:
            return False
        header_len = MOO1_HEADER if self.format == 'moo1' else MOO2_HEADER
        o = self.frame_offsets
        if o[0] < header_len + (self.nframes + 1) * 4:
            return False
        if o[-1] > len(self.data):
            return False
        return all(o[i] <= o[i + 1] for i in range(len(o) - 1))

    # ---------------------------------------------------------
    # Palette handling
    # ---------------------------------------------------------

    def internal_palette(self):
        """Return a MoO2 embedded palette as ``(first_index, colors)``.

        MoO2 sets flag 0x1000 when an image has an internal palette. The
        palette follows the frame-offset table and consists of a u16 start
        index, a u16 color count, then ``count`` four-byte A/R/G/B entries.
        The first byte is a game-specific alpha/availability byte; rendered
        palette colors use the following R/G/B values, each scaled by four.

        ``None`` means there is no valid embedded palette. A sparse internal
        palette is a patch over an external palette, not a replacement for
        all 256 entries.
        """
        if self.format != 'moo2' or not (self.flags & MOO2_FLAG_INTERNAL_PALETTE):
            return None

        table_end = MOO2_HEADER + (self.nframes + 1) * 4
        if table_end + 4 > len(self.data):
            return None
        try:
            first_index, count = struct.unpack_from('<HH', self.data, table_end)
        except struct.error:
            return None
        if count == 0 or count > 256 or first_index + count > 256:
            return None

        colors_start = table_end + 4
        colors_end = colors_start + count * 4
        # Palette bytes must fit before the first frame payload. This also
        # prevents malformed flags from making ordinary frame data look like
        # a palette.
        first_frame = self.frame_offsets[0] if self.frame_offsets else len(self.data)
        if colors_end > len(self.data) or colors_end > first_frame:
            return None

        colors = {}
        for i in range(count):
            _alpha, r, g, b = self.data[colors_start + i * 4:colors_start + i * 4 + 4]
            colors[first_index + i] = (
                min(r * 4, 255), min(g * 4, 255), min(b * 4, 255))
        return first_index, colors

    def palette(self, fallback=None):
        """Return the effective palette, applying this item's palette patch.

        For MoO1, an embedded RGB block is layered over ``fallback``. For MoO2,
        an embedded palette (when flag 0x1000 is present) replaces only the
        indexed range it declares; the rest of the external/fallback palette
        is retained. Palette-holder items can therefore update a shared
        palette for subsequent items, while ordinary images can use their
        internal colors for that image alone.
        """
        out = dict(fallback) if fallback else {}
        if self.format == 'moo2':
            embedded = self.internal_palette()
            if embedded is not None:
                _first_index, colors = embedded
                out.update(colors)
            return out

        o = self.pal_offset
        if not o or o + 8 > len(self.data):
            return out
        rgb_off, firstcol, numcols, _u = struct.unpack_from('<4H', self.data, o)
        if firstcol + numcols > 256 or rgb_off + numcols * 3 > len(self.data):
            return out
        for i in range(numcols):
            r, g, b = self.data[rgb_off + i * 3: rgb_off + i * 3 + 3]
            out[firstcol + i] = (_vga8(r), _vga8(g), _vga8(b))
        return out

    # ---------------------------------------------------------
    # MoO1 decoder
    # ---------------------------------------------------------

    @staticmethod
    def _expand_moo1(payload, compressed):
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

    def _decode_moo1(self, idx, prev=None):
        """Decode one MoO1 frame.

        A keyframe (`kind == 1`) starts from a blank canvas; a delta
        (`kind == 0`) starts from the caller's previous-frame buffer.
        Inside a column that the encoder re-encoded, only the pixels the
        runs actually describe are replaced: `skip` leaves the previous
        frame's pixels in place above and between the runs, and a payload
        value of 0 writes through as transparent so the encoder can erase
        a pixel whose sprite has moved on.
        """
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
            while q + 2 <= end:
                pixcount = body[q]
                skip = body[q + 1]
                payload = body[q + 2:q + 2 + pixcount]
                q += 2 + pixcount
                # `skip` reserves rows the encoder has not touched. The
                # previous frame's content survives them untouched.
                y += skip
                for px in self._expand_moo1(payload, mode & 0x80):
                    if 0 <= y < h:
                        out[y * w + x] = px
                    y += 1
            p = end
        return out, p == len(body)

    # ---------------------------------------------------------
    # MoO2 decoder
    # ---------------------------------------------------------

    def _decode_moo2_one(self, idx, base_pixels=None, base_coverage=None):
        """Decode one MoO2 frame from its actual sparse command stream.

        A normal encoded frame begins with u16 marker=1 and u16 initial_y.
        Positive lengths draw a run after a relative X advance. A zero length
        is followed by a relative Y advance; Y=1000 is the end-of-frame marker.
        Flag 0x0100 selects a raw width*height raster instead.

        The coverage plane is separate from pixel values: omitted pixels are
        transparent, while a pixel explicitly encoded as palette index 0 is
        still a drawn pixel. This is also necessary to composite junction
        animations without erasing pixels the current frame did not touch.
        """
        if not 0 <= idx < self.nframes:
            raise IndexError('frame index out of range: %s' % idx)
        start = self.frame_offsets[idx]
        end = self.frame_offsets[idx + 1]
        if start > end or end > len(self.data):
            self.decode_warnings[idx] = [{
                'kind': 'invalid_frame_offsets',
                'frame_start': start,
                'frame_end': end,
                'item_bytes': len(self.data),
            }]
            return bytearray(self.w * self.h), False

        body = self.data[start:end]
        self._moo2_trailer_cache[idx] = b''
        pixel_count = self.w * self.h
        composite = bool(self.flags & MOO2_FLAG_JUNCTION) and base_pixels is not None
        if composite:
            out = bytearray(base_pixels)
            coverage = bytearray(base_coverage or bytes(pixel_count))
        else:
            out = bytearray(pixel_count)
            coverage = bytearray(pixel_count)

        warnings = []
        clean = True

        def warn(kind, **details):
            nonlocal clean
            clean = False
            issue = {'kind': kind}
            issue.update(details)
            warnings.append(issue)

        # The no-compression/raw flag means there is no marker or run grammar.
        #
        # Raw bodies are padded to a 4-byte boundary. `w * h` is not always
        # a multiple of four, so `len(body)` runs 1 to 3 bytes over the
        # pixel count on the items that need the padding. STARBG items 17,
        # 29, 41, 45 and 49 are the ones that surfaced this. The padded
        # bytes are not pixel data; copy the pixel count and ignore the
        # rest.
        if self.flags & MOO2_FLAG_RAW:
            available = min(len(body), pixel_count)
            out[:available] = body[:available]
            coverage[:available] = b'\x01' * available
            padded = ((pixel_count + 3) // 4) * 4
            if len(body) < pixel_count:
                warn('raw_frame_truncated',
                     expected_bytes=pixel_count,
                     actual_bytes=len(body),
                     copied_bytes=available)
            elif len(body) > padded:
                warn('raw_frame_oversize',
                     expected_bytes=pixel_count,
                     padded_bytes=padded,
                     actual_bytes=len(body),
                     copied_bytes=available)
            # A body of exactly pixel_count or up to padded bytes is fine.
            self.decode_warnings[idx] = warnings
            self._moo2_coverage_cache[idx] = bytes(coverage)
            return out, clean

        if len(body) < 4:
            warn('truncated_frame_header', frame_bytes=len(body))
            self.decode_warnings[idx] = warnings
            self._moo2_coverage_cache[idx] = bytes(coverage)
            return out, False

        marker = struct.unpack_from('<H', body, 0)[0]
        initial_y = struct.unpack_from('<H', body, 2)[0]
        if marker != 1:
            warn('invalid_frame_marker', marker=marker, expected=1)
            self.decode_warnings[idx] = warnings
            self._moo2_coverage_cache[idx] = bytes(coverage)
            return out, False

        p = 4
        y = initial_y
        x = 0
        terminated = False

        while p < len(body):
            if p + 2 > len(body):
                warn('truncated_sequence_length',
                     body_offset=p, remaining_bytes=len(body) - p)
                break

            length = struct.unpack_from('<H', body, p)[0]
            p += 2

            if length == 0:
                if p + 2 > len(body):
                    warn('truncated_y_or_end_marker',
                         body_offset=p, remaining_bytes=len(body) - p)
                    break
                y_advance = struct.unpack_from('<H', body, p)[0]
                p += 2
                if y_advance == 1000:
                    terminated = True
                    # The explicit terminator ends the pixel command stream.
                    # Real archives can carry a six-byte trailer here; preserve
                    # it for later inspection, but don't treat it as image data
                    # or as a decoding warning (regardless of its byte values).
                    self._moo2_trailer_cache[idx] = bytes(body[p:])
                    break
                y += y_advance
                x = 0
                continue

            if p + 2 > len(body):
                warn('truncated_x_offset',
                     body_offset=p, remaining_bytes=len(body) - p,
                     declared_length=length)
                break

            x_advance = struct.unpack_from('<H', body, p)[0]
            p += 2
            x += x_advance

            run_data_offset = p
            available = min(length, max(0, len(body) - p))
            color = body[p:p + available]
            p += available
            if available < length:
                warn('truncated_pixel_run',
                     body_offset=run_data_offset,
                     remaining_bytes=len(body) - run_data_offset,
                     available_bytes=available,
                     declared_length=length,
                     x=x, y=y)

            # Runs are clipped to the declared frame dimensions; the cursor
            # still advances by the encoded run length, not the clipped size.
            if 0 <= y < self.h:
                row = y * self.w
                for i, px in enumerate(color):
                    cx = x + i
                    if 0 <= cx < self.w:
                        pos = row + cx
                        out[pos] = px
                        coverage[pos] = 1
                if x < 0 or x + length > self.w:
                    warn('run_outside_canvas', x=x, y=y,
                         declared_length=length, width=self.w)
            elif color:
                # Empty sentinel frames may carry a meaningless initial Y well
                # outside the canvas but terminate without drawing anything.
                # Report an invalid initial Y only when an encoded run contains
                # pixels that overlap the canvas horizontally and would thus be
                # drawn if its Y coordinate were in bounds.
                overlaps_x = x < self.w and (x + min(length, len(color))) > 0
                if overlaps_x:
                    if y == initial_y and initial_y >= self.h:
                        warn('initial_y_out_of_bounds', initial_y=initial_y,
                             height=self.h, x=x, declared_length=length)
                    else:
                        warn('run_y_outside_canvas', x=x, y=y,
                             declared_length=length, height=self.h)

            if available < length:
                # No reliable next command boundary remains after truncation.
                p = len(body)
                break

            if length & 1:
                if p >= len(body):
                    warn('missing_odd_run_padding', body_offset=p)
                    break
                p += 1

            x += length

        if not terminated and not any(w.get('kind') in {
                'truncated_sequence_length', 'truncated_y_or_end_marker',
                'truncated_x_offset', 'truncated_pixel_run',
                'missing_odd_run_padding', 'invalid_frame_marker',
                'truncated_frame_header'} for w in warnings):
            warn('missing_frame_terminator', body_bytes=len(body), final_offset=p)

        self.decode_warnings[idx] = warnings
        self._moo2_coverage_cache[idx] = bytes(coverage)
        return out, clean

    def _decode_moo2(self, idx, prev=None):
        """Decode a MoO2 frame, applying junction-frame compositing as needed."""
        if not 0 <= idx < self.nframes:
            raise IndexError('frame index out of range: %s' % idx)

        if idx in self._moo2_frame_cache and prev is None:
            buf, clean = self._moo2_frame_cache[idx]
            return bytearray(buf), clean

        if self.flags & MOO2_FLAG_JUNCTION:
            if prev is None and idx > 0:
                # Decode/cache all predecessors in order. Later frames contain
                # only the changed pixels and must preserve earlier coverage.
                for frame_no in range(idx):
                    if frame_no not in self._moo2_frame_cache:
                        if frame_no == 0:
                            previous_pixels = previous_coverage = None
                        else:
                            previous_pixels = self._moo2_frame_cache[frame_no - 1][0]
                            previous_coverage = self._moo2_coverage_cache.get(
                                frame_no - 1, bytes(self.w * self.h))
                        decoded, decoded_clean = self._decode_moo2_one(
                            frame_no, previous_pixels, previous_coverage)
                        self._moo2_frame_cache[frame_no] = (bytes(decoded), decoded_clean)
                base_pixels = self._moo2_frame_cache[idx - 1][0]
                base_coverage = self._moo2_coverage_cache.get(
                    idx - 1, bytes(self.w * self.h))
            elif prev is not None:
                base_pixels = prev
                base_coverage = self._moo2_coverage_cache.get(
                    idx - 1, bytes(self.w * self.h))
            else:
                base_pixels = base_coverage = None
        else:
            base_pixels = base_coverage = None

        decoded, clean = self._decode_moo2_one(idx, base_pixels, base_coverage)
        self._moo2_frame_cache[idx] = (bytes(decoded), clean)
        return decoded, clean

    # ---------------------------------------------------------
    # Public decode
    # ---------------------------------------------------------

    def decode_frame(self, idx, prev=None):
        if self.format == 'moo1':
            return self._decode_moo1(idx, prev)
        return self._decode_moo2(idx, prev)

    def render_rgba(self, idx, palette, prev=None):
        """Decode one frame to row-major RGBA bytes.

        MoO1 uses palette index 0 as transparent. For MoO2, transparency is
        represented by absent run pixels; an explicitly drawn index-0 pixel
        is therefore visible when its palette entry is available. Raw MoO2
        frames are fully covered because every pixel is explicitly stored.
        """
        buf, clean = self.decode_frame(idx, prev)
        out = bytearray(self.w * self.h * 4)
        coverage = (self._moo2_coverage_cache.get(idx)
                    if self.format == 'moo2' else None)
        for i, px in enumerate(buf):
            if self.format == 'moo1':
                if px == TRANSPARENT:
                    continue
            elif coverage is not None and not coverage[i]:
                continue
            rgb = palette.get(px)
            if rgb is None:
                continue
            o = i * 4
            out[o] = rgb[0]
            out[o + 1] = rgb[1]
            out[o + 2] = rgb[2]
            out[o + 3] = 255
        return bytes(out), clean

    def frames(self):
        prev = None
        for i in range(self.nframes):
            if self.format == 'moo1':
                kind = self.data[self.frame_offsets[i]]
                buf, clean = self._decode_moo1(
                    i, prev if kind == 0 else None)
                prev = buf
            else:
                buf, clean = self._decode_moo2(i, prev if (self.flags & MOO2_FLAG_JUNCTION) else None)
                prev = buf
            yield buf, clean


def archive_default_palette(archive):
    """Return the fullest embedded palette found within one archive.

    This is mainly useful for MoO1. A MoO2 internal palette is often only a
    sparse range and should be merged over the appropriate FONTS/IFONTS
    palette rather than mistaken for a complete archive-wide palette.
    """
    best = {}
    for i in range(len(archive)):
        try:
            item = GfxItem(archive.item(i))
        except Exception:                               # noqa: BLE001
            continue
        if not item.plausible():
            continue
        pal = item.palette()
        if len(pal) > len(best):
            best = pal
        if len(best) >= 256:
            break
    return best


# ----------------------------------------------------------------------
# MoO2 external palettes
# ----------------------------------------------------------------------
#
# MoO2 uses external palettes in FONTS.LBX / IFONTS.LBX plus optional
# sparse internal palette patches embedded in graphic items. Item 0 of the
# palette archives is font data; later items hold 1024-byte palette blocks:
# 256 entries of [pad, R, G, B] with each RGB component in 0..63.

import os

_PALETTE_CACHE = {}


def load_moo2_external_palette(lbx_path, item_index=1):
    """
    Load a 256-colour palette from a MoO2 external-palette archive.

    Item 0 of FONTS.LBX and IFONTS.LBX is font data, not a palette.
    External palette blocks start at archive item 1. Each block is 1024
    bytes: 256 entries of [pad, R, G, B] with R/G/B in 0..63.

    item_index is the actual zero-based LBX archive item index. For example,
    the second archive item is passed as index 1.

    Returns {index: (r, g, b)} in 8-bit space. The first 1024 bytes of
    the item are the palette; anything after is cursor or font data and
    is ignored.
    """
    archive = LbxArchive(lbx_path)
    if not (0 <= item_index < len(archive)):
        raise LbxError('%s: item %d out of range (0..%d)'
                       % (lbx_path, item_index, len(archive) - 1))
    # In both FONTS.LBX and IFONTS.LBX, item 0 is font data, not a palette.
    # Real external palette blocks start at archive item 1.
    if item_index == 0:
        raise LbxError('%s item 0 is font data, not an external palette' % lbx_path)
    data = archive.item(item_index)
    if len(data) < 1024:
        raise LbxError('%s item %d is too short to contain a 256-colour palette'
                       % (lbx_path, item_index))
    palette = {}
    for i in range(256):
        off = i * 4
        if off + 4 > len(data):
            break
        _pad, r, g, b = data[off:off + 4]
        palette[i] = (min(r * 4, 255),
                      min(g * 4, 255),
                      min(b * 4, 255))
    return palette


def get_moo2_palette(lbx_path, item_index=1):
    """Cached wrapper — same palette is loaded once per process."""
    key = (os.path.abspath(lbx_path), item_index)
    if key not in _PALETTE_CACHE:
        _PALETTE_CACHE[key] = load_moo2_external_palette(lbx_path, item_index)
    return _PALETTE_CACHE[key]