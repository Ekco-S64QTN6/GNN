#!/usr/bin/env bash
# Put GNN on air.
#
#   ./start.sh          run in the foreground (Ctrl-C stops it cleanly)
#   ./start.sh --bg     run detached, then use ./stop.sh
#
set -uo pipefail
cd "$(dirname "$0")"

PORT="${GNN_PORT:-8080}"
PIDFILE=".gnn-server.pid"
LOG="gnn-server.log"

if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE" 2>/dev/null)" 2>/dev/null; then
    echo "GNN is already on air (pid $(cat "$PIDFILE")) — http://localhost:$PORT"
    echo "Take it off air with ./stop.sh"
    exit 0
fi

python3 - <<'PY' || exit 1
import sys
sys.exit(0 if sys.version_info >= (3, 8) else 1)
PY

python3 -c "import edge_tts" 2>/dev/null \
    || echo "note: edge-tts not installed — the browser voice will be used instead."

if [ "${1:-}" = "--bg" ]; then
    nohup python3 server.py >"$LOG" 2>&1 &
    for _ in $(seq 1 40); do
        if curl -fsS "http://localhost:$PORT/api/status" >/dev/null 2>&1; then
            echo "GNN on air  ->  http://localhost:$PORT   (log: $LOG)"
            echo "Take it off air with ./stop.sh"
            exit 0
        fi
        sleep 0.25
    done
    echo "server did not come up; see $LOG" >&2
    exit 1
fi

exec python3 server.py
