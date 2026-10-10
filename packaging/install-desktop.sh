#!/usr/bin/env bash
# Put GNN in the desktop's application list, so it launches like any app.
# Rewrites the paths to wherever this checkout actually lives.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
dest="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
mkdir -p "$dest"
sed -e "s|^Exec=.*|Exec=$here/broadcast.sh|" \
    -e "s|^Path=.*|Path=$here|" \
    "$here/packaging/gnn.desktop" > "$dest/gnn.desktop"
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$dest" || true
echo "installed $dest/gnn.desktop — GNN should now appear in your launcher."
