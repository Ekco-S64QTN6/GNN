#!/usr/bin/env python3
"""Inspect CMBTSFX item flags, actual embedded palettes, and frame coverage.

Run from the repository root:
    python3 tools/probe_cmbtsfx.py
    python3 tools/probe_cmbtsfx.py --lbx 'Master of Orion 1/mastori2/CMBTSFX.LBX'

This is diagnostic only: it does not change decoder or palette behaviour.
"""
from __future__ import annotations

import argparse
from collections import Counter
from pathlib import Path
import sys

sys.path.insert(0, "tools")
import lbx  # noqa: E402

DEFAULT_LBX = "Master of Orion 1/mastori2/CMBTSFX.LBX"
ITEMS = (7, 8, 9, 16, 52, 67, 68, 69, 70, 78)


def short_indices(pixels: bytearray, coverage: bytes | None) -> tuple[int, int, int, list[tuple[int, int]]]:
    if coverage is None:
        covered_pixels = list(pixels)
    else:
        covered_pixels = [value for value, covered in zip(pixels, coverage) if covered]
    covered = len(covered_pixels)
    nonzero = sum(value != 0 for value in covered_pixels)
    distinct = len(set(covered_pixels))
    top = Counter(covered_pixels).most_common(8)
    return covered, nonzero, distinct, top


def probe(archive: lbx.LbxArchive, index: int) -> None:
    if not 0 <= index < len(archive):
        print(f"Item {index:02d}: out of range (archive has {len(archive)} items)\n")
        return
    item = lbx.GfxItem(archive.item(index), format="moo2")
    flags = item.flags
    body_sizes = [item.frame_offsets[i + 1] - item.frame_offsets[i]
                  for i in range(item.nframes)]

    print(f"Item {index:02d}: {item.w}x{item.h}, {item.nframes} frames | flags 0x{flags:04X}")
    print(
        "  [FUNC 0x0800: {func}] [FILL 0x0400: {fill}] [INTERNAL_PALETTE flag: {pal_flag}] "
        "[JUNCTION 0x2000: {junc}] [RAW 0x0100: {raw}]".format(
            func=bool(flags & lbx.MOO2_FLAG_FUNCTIONAL_COLOR),
            fill=bool(flags & lbx.MOO2_FLAG_FILL_BACKGROUND),
            pal_flag=bool(flags & lbx.MOO2_FLAG_INTERNAL_PALETTE),
            junc=bool(flags & lbx.MOO2_FLAG_JUNCTION),
            raw=bool(flags & lbx.MOO2_FLAG_RAW),
        )
    )
    print(f"  Frame-body bytes: min={min(body_sizes, default=0)}, "
          f"median={sorted(body_sizes)[len(body_sizes)//2] if body_sizes else 0}, "
          f"max={max(body_sizes, default=0)}")

    # Test whether the flagged internal palette is actually parseable.
    embedded = item.internal_palette()
    if embedded is None:
        print("  internal_palette(): None (no valid embedded palette parsed)")
    else:
        first, colors = embedded
        sample_keys = sorted(colors)[:8]
        sample = {key: colors[key] for key in sample_keys}
        print(f"  internal_palette(): valid; first_index={first}, "
              f"count={len(colors)}, last_index={max(colors) if colors else 'n/a'}")
        print(f"  Palette sample (RGB 8-bit): {sample}")

    frame_stats = []
    sampled_frames = {0, max(0, item.nframes // 2), max(0, item.nframes - 1)}
    if index == 68:
        sampled_frames = set(range(item.nframes))

    for frame_no in range(item.nframes):
        pixels, clean = item.decode_frame(frame_no)
        coverage = item._moo2_coverage_cache.get(frame_no)
        covered, nonzero, distinct, top = short_indices(pixels, coverage)
        frame_stats.append((frame_no, covered, nonzero, distinct, clean))
        if frame_no in sampled_frames:
            total = item.w * item.h
            pct = 100.0 * covered / total if total else 0.0
            print(f"  Frame {frame_no:03d}: body={body_sizes[frame_no]} bytes, "
                  f"covered={covered}/{total} ({pct:.1f}%), "
                  f"covered_nonzero={nonzero}, distinct_covered_indices={distinct}, "
                  f"clean={clean}")
            print(f"    Top covered indices (includes explicit zero): {top}")
            warnings = item.decode_warnings.get(frame_no, [])
            if warnings:
                print(f"    Decoder warnings: {warnings}")
            if index == 68:
                start = item.frame_offsets[frame_no]
                end = item.frame_offsets[frame_no + 1]
                prefix = item.data[start:min(end, start + 32)].hex(" ")
                print(f"    Encoded body prefix: {prefix or '(empty)'}")

    empty_frames = [frame for frame, covered, _nz, _distinct, _clean in frame_stats
                    if covered == 0]
    thin_frames = [(frame, covered) for frame, covered, _nz, _distinct, _clean in frame_stats
                   if 0 < covered < max(1, (item.w * item.h) // 100)]
    print(f"  Frames with zero covered pixels: {empty_frames}")
    if thin_frames:
        print(f"  Frames with <1% covered pixels: {thin_frames}")
    print()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--lbx", default=DEFAULT_LBX, help="path to CMBTSFX.LBX")
    parser.add_argument("--items", default=",".join(map(str, ITEMS)),
                        help="comma-separated item indices to inspect")
    args = parser.parse_args()
    path = Path(args.lbx)
    if not path.is_file():
        print(f"LBX not found: {path}", file=sys.stderr)
        return 2
    try:
        indices = [int(value.strip()) for value in args.items.split(",") if value.strip()]
        archive = lbx.LbxArchive(str(path))
    except (ValueError, OSError, lbx.LbxError) as exc:
        print(f"Could not open diagnostics input: {exc}", file=sys.stderr)
        return 2

    print(f"Archive: {path} ({len(archive)} items)")
    print("Note: 'covered' comes from the decoder's coverage plane, not from pixel value != 0.\n")
    for index in indices:
        probe(archive, index)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
