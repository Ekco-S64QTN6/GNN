#!/usr/bin/env bash
# Every check that needs no server and no browser. Safe while on air.
#
#   tools/tests/offline.sh [sheet-dir]
#
# Exits non-zero if any check fails. The product sheet is written for a
# person to look at; it cannot fail, only be wrong.
set -u
cd "$(dirname "$0")/../.."
status=0
run() { echo "== $*"; "$@" || status=1; }
for f in js/*.js; do node --check "$f" || { echo "syntax: $f"; status=1; }; done
run python3 -m py_compile server.py
run python3 tools/tests/content_check.py
run python3 tools/tests/test_moo2_tools.py
run python3 tools/verify_assets.py
python3 tools/tests/productsheet.py "${1:-/tmp/gnn-productsheet}" | tail -3
[ $status -eq 0 ] && echo "offline checks: PASS" || echo "offline checks: FAIL"
exit $status
