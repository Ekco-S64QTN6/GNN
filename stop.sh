#!/usr/bin/env bash
# Take GNN off air: stop the server and anything the test harness left running.
#
#   ./stop.sh
#
# Only ever touches processes this project started — the server on $GNN_PORT
# and headless browsers carrying the harness's own debugging port. Your own
# browser is never a target.
#
set -uo pipefail
cd "$(dirname "$0")"

PORT="${GNN_PORT:-8080}"
CDP_PORT="${GNN_CDP_PORT:-9333}"
PIDFILE=".gnn-server.pid"
stopped=0

wait_gone() {           # wait_gone <pid> <seconds>
    local pid=$1 limit=$2 i=0
    while kill -0 "$pid" 2>/dev/null; do
        i=$((i + 1)); [ "$i" -ge "$((limit * 4))" ] && return 1
        sleep 0.25
    done
    return 0
}

# --- 1. the server, by pidfile -------------------------------------------
if [ -f "$PIDFILE" ]; then
    pid="$(cat "$PIDFILE" 2>/dev/null || true)"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        echo "stopping server (pid $pid)…"
        kill -TERM "$pid" 2>/dev/null
        wait_gone "$pid" 8 || { echo "  forcing"; kill -KILL "$pid" 2>/dev/null; }
        stopped=$((stopped + 1))
    fi
    rm -f "$PIDFILE"
fi

# --- 2. anything else still holding the port -----------------------------
for pid in $(pgrep -f "python3? .*server\.py" 2>/dev/null); do
    kill -0 "$pid" 2>/dev/null || continue
    echo "stopping stray server (pid $pid)…"
    kill -TERM "$pid" 2>/dev/null
    wait_gone "$pid" 5 || kill -KILL "$pid" 2>/dev/null
    stopped=$((stopped + 1))
done

# --- 3. harness browsers, matched only by our own debugging port ----------
# Match on the port AND on the process actually being a browser, so a shell
# whose command line happens to mention the port is never a target.
marker="remote-debugging-port=$CDP_PORT"
harness_pids() {
    local pid comm
    for pid in $(pgrep -f "$marker" 2>/dev/null); do
        [ "$pid" = "$$" ] && continue
        comm="$(ps -o comm= -p "$pid" 2>/dev/null)"
        case "$comm" in
            chrome|chromium|chromium-browser|google-chrome*|Chromium*) echo "$pid" ;;
        esac
    done
}

pids="$(harness_pids)"
if [ -n "$pids" ]; then
    echo "closing $(echo "$pids" | wc -l) headless browser process(es) from the test harness…"
    # shellcheck disable=SC2086
    kill -TERM $pids 2>/dev/null
    sleep 2
    pids="$(harness_pids)"
    if [ -n "$pids" ]; then
        # shellcheck disable=SC2086
        kill -KILL $pids 2>/dev/null
        sleep 1
    fi
    stopped=$((stopped + 1))
fi

# --- 4. report ------------------------------------------------------------
if curl -fsS --max-time 2 "http://localhost:$PORT/api/status" >/dev/null 2>&1; then
    echo "warning: something is still answering on port $PORT" >&2
    exit 1
fi

left="$(harness_pids)"
if [ -n "$left" ]; then
    echo "warning: $(echo "$left" | wc -l) harness browser process(es) survived" >&2
    exit 1
fi

if [ "$stopped" -eq 0 ]; then
    echo "nothing was running."
else
    echo "GNN off air. Everything this project started has been stopped."
fi
