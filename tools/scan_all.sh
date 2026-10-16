#!/usr/bin/env bash
#
# scan_all.sh — run every LBX scan in one pass and write a single report.
#
# Usage
#     tools/scan_all.sh                # writes /tmp/moo_scan.txt
#     tools/scan_all.sh /path/to/out   # writes to a specific path
#
# The report is intended to be pasted back whole. It contains:
#   - a container scan of Master of Orion 1/data
#   - a container scan of Master of Orion 1/mastori2
#   - a full gap dump of MONSTER.LBX and TANM_001.LBX
#   - first-frame hexdumps for both MoO2 files
#
set -u

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

OUT="${1:-/tmp/moo_scan.txt}"
MOO1="Master of Orion 1/data"
MOO2="Master of Orion 1/mastori2"

# Delete any prior report so nothing stale bleeds in.
: > "$OUT"

section() {
    {
        echo
        echo "=============================================================="
        echo "== $1"
        echo "=============================================================="
    } >> "$OUT"
}

run() {
    # Print the command, run it, capture stdout+stderr into the report.
    # The user sees the command line, the report shows the same line
    # followed by its output — so nothing has to be typed twice.
    echo "\$ $*" >> "$OUT"
    "$@" >> "$OUT" 2>&1
    echo >> "$OUT"
}

# ---- preflight ------------------------------------------------------
section "PREFLIGHT"
{
    echo "cwd           : $REPO_ROOT"
    echo "python        : $(command -v python3 || echo 'not found')"
    echo "lbx.py        : $(test -f tools/lbx.py && echo present || echo MISSING)"
    echo "scan_strays.py: $(test -f tools/scan_strays.py && echo present || echo MISSING)"
    echo "MoO1 dir      : $(test -d "$MOO1" && echo "$MOO1" || echo "MISSING: $MOO1")"
    echo "MoO2 dir      : $(test -d "$MOO2" && echo "$MOO2" || echo "MISSING: $MOO2")"
    echo
} >> "$OUT"

if ! command -v python3 >/dev/null; then
    echo "python3 not on PATH; cannot continue." | tee -a "$OUT"
    exit 1
fi
if [ ! -f tools/scan_strays.py ]; then
    echo "tools/scan_strays.py is missing; cannot continue." | tee -a "$OUT"
    exit 1
fi

# ---- MoO1 full scan -------------------------------------------------
section "MoO1 data directory — every LBX, every gap"
if [ -d "$MOO1" ]; then
    run python3 tools/scan_strays.py "$MOO1" -r
else
    echo "(skipped: $MOO1 not present)" >> "$OUT"
fi

# ---- MoO2 full scan -------------------------------------------------
section "MoO2 mastori2 directory — every LBX, every gap"
if [ -d "$MOO2" ]; then
    run python3 tools/scan_strays.py "$MOO2" -r
else
    echo "(skipped: $MOO2 not present)" >> "$OUT"
fi

# ---- Targeted dumps: MoO2 gaps --------------------------------------
section "MONSTER.LBX — gap 0x74..0x800 (padding between table and first item)"
if [ -f "$MOO2/MONSTER.LBX" ]; then
    run python3 tools/scan_strays.py "$MOO2/MONSTER.LBX" \
        --dump-region 0x74:0x800
else
    echo "(skipped: $MOO2/MONSTER.LBX not present)" >> "$OUT"
fi

section "TANM_001.LBX — gap 0x10..0x800 (padding between table and first item)"
if [ -f "$MOO2/TANM_001.LBX" ]; then
    run python3 tools/scan_strays.py "$MOO2/TANM_001.LBX" \
        --dump-region 0x10:0x800
else
    echo "(skipped: $MOO2/TANM_001.LBX not present)" >> "$OUT"
fi

# ---- Frame bodies ---------------------------------------------------
#
# The item starts at 0x800 in both files. Frame offsets are relative to
# the item header, so:
#
#   MONSTER    first frame offset = 0x190  →  absolute 0x990
#   TANM_001   first frame offset = 0x28e8 →  absolute 0x30e8
#
# 128 bytes is enough to see whether the frame body starts with a MoO1
# style `kind` byte followed by column data, or something else entirely.

section "MONSTER.LBX — first 128 bytes of item 0's first frame (abs 0x990)"
if [ -f "$MOO2/MONSTER.LBX" ]; then
    echo "\$ xxd -s 0x990 -l 128 \"$MOO2/MONSTER.LBX\"" >> "$OUT"
    xxd -s 0x990 -l 128 "$MOO2/MONSTER.LBX" >> "$OUT" 2>&1
    echo >> "$OUT"
else
    echo "(skipped: $MOO2/MONSTER.LBX not present)" >> "$OUT"
fi

section "TANM_001.LBX — first 128 bytes of item 0's first frame (abs 0x30e8)"
if [ -f "$MOO2/TANM_001.LBX" ]; then
    echo "\$ xxd -s 0x30e8 -l 128 \"$MOO2/TANM_001.LBX\"" >> "$OUT"
    xxd -s 0x30e8 -l 128 "$MOO2/TANM_001.LBX" >> "$OUT" 2>&1
    echo >> "$OUT"
else
    echo "(skipped: $MOO2/TANM_001.LBX not present)" >> "$OUT"
fi

# ---- A brief header dump of every MoO2 archive ----------------------
#
# Only the first 32 bytes per file — enough to record count, magic,
# and offsets[0] for every archive in one table, so I can tell at a
# glance which ones need deeper inspection.

section "MoO2 archives — header table (first 32 bytes of each file)"
if [ -d "$MOO2" ]; then
    echo "\$ ls \"$MOO2\"/*.LBX | sort" >> "$OUT"
    {
        for f in "$MOO2"/*.LBX "$MOO2"/*.lbx; do
            [ -f "$f" ] || continue
            printf '%s\n' "--- $(basename "$f") ---"
            xxd -l 32 "$f"
        done
    } >> "$OUT" 2>&1
    echo >> "$OUT"
else
    echo "(skipped: $MOO2 not present)" >> "$OUT"
fi

# ---- Footer ---------------------------------------------------------
section "REPORT COMPLETE"
{
    echo "Report written to: $OUT"
    echo "Size            : $(wc -c < "$OUT") bytes"
    echo "Lines           : $(wc -l < "$OUT")"
} >> "$OUT"

# Also tell the user in the terminal, so they know it worked.
echo
echo "Report written to $OUT"
echo "Size: $(wc -c < "$OUT") bytes, $(wc -l < "$OUT") lines"
echo
echo "Paste the whole file back. To view it first:"
echo "    less $OUT"
echo "Or copy it straight to the clipboard:"
echo "    xclip -selection clipboard < $OUT       # X11"
echo "    wl-copy < $OUT                          # Wayland"