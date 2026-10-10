"""The broadcast as a desktop window, not a browser tab.

GNN is a page served on 127.0.0.1. Opened in a browser it still behaves like a
website: a tab strip and URL bar around a 1993 newscast, a right-click menu, a
pinch-zoom that halves the set, and the broadcast held until the page is
clicked because autoplay is blocked. This opens it in a GTK window holding a
WebKitGTK view — its own title, window class and icon, none of the browser.

Run by the *system* Python (`/usr/bin/python3`), which has GObject
introspection and WebKitGTK; the project virtualenv has neither, and this file
imports nothing from the project so either interpreter can load it.
`launch()` is what the launcher calls; it returns None when GTK/WebKit cannot
play sound on this machine, and the caller falls back to a browser.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from typing import Optional

SYSTEM_PYTHON = "/usr/bin/python3"
_available: Optional[bool] = None


def _python() -> str:
    return SYSTEM_PYTHON if os.path.exists(SYSTEM_PYTHON) else (shutil.which("python3") or "python3")


def available() -> bool:
    """Whether the system Python can open a WebKitGTK window *that plays*.

    The sink check is not optional. WebKitGTK routes all its audio — media
    elements and Web Audio alike — through a GStreamer sink from
    gst-plugins-good. Without one the window opens and the station is silent,
    and for this project a browser that plays beats a window that does not.
    """
    global _available
    if _available is None:
        probe = ("import gi; gi.require_version('Gtk', '3.0'); "
                 "gi.require_version('WebKit2', '4.1'); gi.require_version('Gst', '1.0'); "
                 "from gi.repository import Gtk, WebKit2, Gst; Gst.init(None); "
                 "import sys; sys.exit(0 if Gst.ElementFactory.find('autoaudiosink') else 3)")
        try:
            out = subprocess.run([_python(), "-c", probe], capture_output=True, timeout=20)
            _available = out.returncode == 0
        except (OSError, subprocess.SubprocessError):
            _available = False
    return _available


def why_unavailable() -> str:
    """A line to print when the native window cannot be used."""
    if available():
        return ""
    return ("no GStreamer audio sink (install gst-plugins-good for the native "
            "window); opening in a browser app window instead")


def launch(url: str, title: str = "GNN", wm_class: str = "GNN",
           size: str = "1280x900", icon: str = "video-display",
           preexec_fn=None) -> Optional[subprocess.Popen]:
    """Open `url` in its own window; None if this machine can't."""
    if not available():
        return None
    try:
        return subprocess.Popen([_python(), os.path.abspath(__file__), "--url", url,
                                 "--title", title, "--class", wm_class,
                                 "--size", size, "--icon", icon],
                                stdin=subprocess.DEVNULL,
                                preexec_fn=preexec_fn, env={**os.environ})
    except OSError:
        return None


def _main() -> int:
    import argparse
    ap = argparse.ArgumentParser(description="Open the broadcast in its own window.")
    ap.add_argument("--url", required=True)
    ap.add_argument("--title", default="GNN")
    ap.add_argument("--class", dest="wm_class", default="GNN")
    ap.add_argument("--size", default="1280x900")
    ap.add_argument("--icon", default="video-display")
    a = ap.parse_args()

    # WebKitGTK's DMA-BUF renderer fails on some NVIDIA drivers under Wayland
    # ("Error 71 (Protocol error) dispatching to Wayland display") and the
    # window closes at once; without it the page is still composited.
    os.environ.setdefault("WEBKIT_DISABLE_DMABUF_RENDERER", "1")
    import gi
    gi.require_version("Gtk", "3.0")
    gi.require_version("WebKit2", "4.1")
    from gi.repository import GLib, Gtk, WebKit2

    GLib.set_prgname(a.wm_class)              # the window class the desktop groups it by
    GLib.set_application_name(a.title)
    w, h = (int(x) for x in a.size.lower().split("x"))
    win = Gtk.Window(title=a.title)
    win.set_default_size(w, h)
    if a.icon:
        win.set_icon_name(a.icon)

    view = WebKit2.WebView()
    s = view.get_settings()
    s.set_enable_webaudio(True)
    s.set_media_playback_requires_user_gesture(False)   # the broadcast starts on its own
    s.set_enable_developer_extras(False)
    s.set_hardware_acceleration_policy(WebKit2.HardwareAccelerationPolicy.ALWAYS)
    s.set_enable_smooth_scrolling(True)
    view.connect("context-menu", lambda *args: True)    # no browser menu on right-click
    view.load_uri(a.url)

    win.add(view)
    win.connect("destroy", Gtk.main_quit)
    win.show_all()
    Gtk.main()
    return 0


if __name__ == "__main__":
    sys.exit(_main())
