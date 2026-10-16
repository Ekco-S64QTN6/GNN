#!/usr/bin/env bash
# Watch GNN. Starts the station, opens it in its own window, and takes the
# station off air when you close that window.
#
#   ./broadcast.sh              its own desktop window
#   ./broadcast.sh --browser    force the browser app window
#   ./broadcast.sh --tab        just open a normal tab (no window management)
#
# This is the way to run GNN. ./start.sh and ./stop.sh remain for driving the
# server on its own, which is what the test harness uses.
#
set -uo pipefail
cd "$(dirname "$0")"

PORT="${GNN_PORT:-8080}"
URL="http://localhost:$PORT"
LOG="${GNN_LOG:-gnn-server.log}"
PROFILE="${XDG_CACHE_HOME:-$HOME/.cache}/gnn-window"
MODE=window
case "${1:-}" in
    --browser) MODE=browser ;;
    --tab)     MODE=tab ;;
    "")        ;;
    *) echo "usage: $0 [--browser|--tab]" >&2; exit 2 ;;
esac

# Only take the station off air if this script is what put it on. Someone
# debugging with ./start.sh in another terminal keeps their server.
started_here=0
if curl -fsS --max-time 2 "$URL/api/status" >/dev/null 2>&1; then
    echo "station already on air — attaching"
else
    ./start.sh --bg || exit 1
    started_here=1
fi

window_pid=""
cleanup() {
    echo "[$(date +%H:%M:%S)] [Launcher] broadcast session ending" >> "$LOG" 2>/dev/null || true
    # Close the window too. Closing it normally is what ends this script, but
    # a Ctrl-C or a killed terminal gets here with the browser still up, and
    # an orphaned app window keeps playing a broadcast with no server.
    if [ -n "$window_pid" ] && kill -0 "$window_pid" 2>/dev/null; then
        kill -TERM "$window_pid" 2>/dev/null
        for _ in $(seq 1 12); do
            kill -0 "$window_pid" 2>/dev/null || break
            sleep 0.25
        done
        kill -KILL "$window_pid" 2>/dev/null
    fi
    if [ "$started_here" -eq 1 ]; then
        echo
        ./stop.sh
    else
        echo
        echo "leaving the station on air (it was already running)."
    fi
}
trap cleanup EXIT INT TERM

if [ "$MODE" = tab ]; then
    echo "[$(date +%H:%M:%S)] [Launcher] opened $URL in browser tab" >> "$LOG"
    xdg-open "$URL" >/dev/null 2>&1 &
    echo "opened $URL in your browser. Ctrl-C here to take the station off air."
    while curl -fsS --max-time 2 "$URL/api/status" >/dev/null 2>&1; do sleep 2; done
    exit 0
fi

# A desktop window, in order of preference.
#
#  1. WebKitGTK via tools/app_window.py — a real window, no browser around it.
#     Needs a GStreamer audio sink, and reports itself unavailable without one
#     rather than opening a silent station.
#  2. A browser in app mode — chromeless, its own profile and window class, so
#     it is a window on the desktop rather than a tab in your session. Autoplay
#     is granted explicitly, so the broadcast starts without being clicked.
if [ "$MODE" = window ]; then
    reason="$(/usr/bin/python3 -c "
import sys; sys.path.insert(0, 'tools')
import app_window
sys.stdout.write(app_window.why_unavailable())" 2>/dev/null || echo "")"
    if [ -z "$reason" ]; then
        echo "opening the broadcast in its own window…"
        echo "[$(date +%H:%M:%S)] [Launcher] launching WebKitGTK app window" >> "$LOG"
        /usr/bin/python3 tools/app_window.py --url "$URL" --title "GNN // Galactic News Network" \
            --class GNN --size 1280x900 --icon video-display >>"$LOG" 2>&1 &
        window_pid=$!
        wait "$window_pid"
        exit 0
    fi
    echo "note: $reason"
fi

BROWSER=""
BROWSER_CMD=()
for b in chromium chromium-browser google-chrome-stable google-chrome brave; do
    if command -v "$b" >/dev/null 2>&1; then
        BROWSER="$b"
        BROWSER_CMD=("$b")
        break
    fi
done

if [ -z "$BROWSER" ] && command -v flatpak >/dev/null 2>&1; then
    if flatpak info org.chromium.Chromium >/dev/null 2>&1; then
        BROWSER="org.chromium.Chromium (flatpak)"
        BROWSER_CMD=(flatpak run --filesystem=/tmp --filesystem="$(pwd)" org.chromium.Chromium)
    elif flatpak info com.google.Chrome >/dev/null 2>&1; then
        BROWSER="com.google.Chrome (flatpak)"
        BROWSER_CMD=(flatpak run --filesystem=/tmp --filesystem="$(pwd)" com.google.Chrome)
    fi
fi

if [ -z "$BROWSER" ]; then
    echo "no browser found; the station is at $URL" >&2
    while curl -fsS --max-time 2 "$URL/api/status" >/dev/null 2>&1; do sleep 2; done
    exit 1
fi

mkdir -p "$PROFILE"
echo "opening the broadcast in a $BROWSER app window…"
echo "[$(date +%H:%M:%S)] [Launcher] launching $BROWSER app window (url: $URL)" >> "$LOG"
"${BROWSER_CMD[@]}" --app="$URL" \
    --user-data-dir="$PROFILE" \
    --class=GNN \
    --window-size=1280,900 \
    --no-first-run --no-default-browser-check \
    --autoplay-policy=no-user-gesture-required \
    --enable-logging=stderr \
    >>"$LOG" 2>&1 &
window_pid=$!
wait "$window_pid"
