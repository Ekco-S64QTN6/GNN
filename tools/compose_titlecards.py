#!/usr/bin/env python3
"""compose_titlecards.py — a title card for every show that lacks one.

Five of the ten shows opened on the station slate because no card had been
generated for them. The existing cards are the show's own set with its pair
in front of the desk and a branded bar along the bottom. Standing figures do
not exist for any of the five pairs, but every show already looks right on
air — so the picture is taken from the running renderer itself, with the
captions and crawl switched off, and the bar is added here.

Pixel-true by construction: the set, the desk line and the seat positions
are whatever the renderer draws. Nothing about their geometry is repeated
in this file, which is how the plates and the desk drifted apart before.

    ./start.sh --bg
    python3 tools/compose_titlecards.py            # only shows with no card
    python3 tools/compose_titlecards.py --all      # every show
    python3 tools/compose_titlecards.py --only anomaly,archives

Writes assets/generated/titlecards/<show id>.png at 1280x720 and prints the
`SHOW_CARDS` entries to add to js/main.js.
"""
import argparse
import base64
import io
import json
import os
import sys
import time

from PIL import Image, ImageDraw, ImageFont, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import drive                                               # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG = os.path.join(ROOT, 'assets', 'generated', 'show-config.json')
OUT = os.path.join(ROOT, 'assets', 'generated', 'titlecards')
LOGOS = os.path.join(ROOT, 'assets', 'generated', 'logos')
W, H = 1280, 720

# A logo whose lettering names the show. Shows without one get the station
# mark and the title set in type.
SHOW_LOGO = {
    'evening_rim': 'evening_rim_report.png',
    'anomaly': 'anomaly_late_night.png',
    'crossfire': 'council_crossfire.png',
    'economy': 'deep_space_economy.png',
    'morning_watch': 'galactic_morning_watch.png',
    'midday_wire': 'sector_midday_wire.png',
}

FONT_PATHS = [
    '/usr/share/fonts/noto/NotoSans-Black.ttf',
    '/usr/share/fonts/noto/NotoSans-Bold.ttf',
    '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
]


def font(size):
    for p in FONT_PATHS:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def capture(cdp, block):
    """The show's studio as the renderer draws it, captions and crawl off."""
    cdp.send('Page.navigate', url=drive.URL + '?block=%s&clock=off' % block)
    for _ in range(90):
        time.sleep(1)
        try:
            if cdp.eval('!!window.GNNBootReady'):
                break
        except Exception:                                    # noqa: BLE001
            pass
    time.sleep(3)
    # The modules are top-level consts, not window properties, so they are
    # named bare. `window.GNNTextEngine` is undefined and silently did
    # nothing: the first cards went out with the caption still on them.
    cdp.eval("""(function(){
        GNNDirector.pause();
        GNNCutsceneManager.endCutaway && GNNCutsceneManager.endCutaway(performance.now());
        GNNRenderer.setCleanFrame(true);
    })()""")
    time.sleep(1.5)
    cdp.send('Emulation.setDeviceMetricsOverride', width=W, height=H,
             deviceScaleFactor=1, mobile=False)
    time.sleep(1.5)
    data = cdp.send('Page.captureScreenshot', format='png')['data']
    cdp.send('Emulation.clearDeviceMetricsOverride')
    im = Image.open(io.BytesIO(base64.b64decode(data))).convert('RGB')
    return im.resize((W, H), Image.LANCZOS) if im.size != (W, H) else im


def brand(studio, show):
    """Add the lower bar: logo or station mark, title, network line."""
    card = studio.convert('RGBA')
    bar_h = int(H * 0.215)
    top = H - bar_h
    bar = Image.new('RGBA', (W, bar_h), (0, 0, 0, 0))
    d = ImageDraw.Draw(bar)
    for y in range(bar_h):
        t = y / max(1, bar_h - 1)
        d.line([(0, y), (W, y)], fill=(8, int(18 + 10 * t), int(46 + 20 * t), 236))
    d.rectangle((0, 0, W, 3), fill=(232, 182, 72, 255))
    card.alpha_composite(bar, (0, top))
    d = ImageDraw.Draw(card)

    x = 40
    logo_file = SHOW_LOGO.get(show['id'])
    if logo_file and os.path.exists(os.path.join(LOGOS, logo_file)):
        lg = Image.open(os.path.join(LOGOS, logo_file)).convert('RGBA')
        lh = bar_h - 22
        lg = lg.resize((max(1, round(lg.width * lh / lg.height)), lh), Image.LANCZOS)
        card.alpha_composite(lg, (x, top + 12))
        x += lg.width + 30
    else:
        d.text((x, top + 22), 'GNN', font=font(66), fill=(232, 236, 244))
        x += int(font(66).getlength('GNN')) + 30

    title = show['title'].upper()
    size = 46
    while size > 22 and font(size).getlength(title) > W - x - 40:
        size -= 2
    shadow = Image.new('RGBA', card.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.text((x + 2, top + 30), title, font=font(size), fill=(0, 0, 0, 200))
    card.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(2)))
    d.text((x, top + 28), title, font=font(size), fill=(244, 216, 140))
    d.text((x, top + 34 + size), (show.get('desk') or '').upper()
           + '   ·   GALACTIC NEWS NETWORK', font=font(18), fill=(170, 190, 220))
    return card.convert('RGB')


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--only')
    args = ap.parse_args()
    shows = json.load(open(CONFIG, encoding='utf-8'))['shows']
    if args.only:
        want = set(args.only.split(','))
        shows = [s for s in shows if s['id'] in want]
    elif not args.all:
        shows = [s for s in shows if not s.get('titlecard')]
    if not shows:
        print('every show already has a card; pass --all to redo them')
        return 0
    os.makedirs(OUT, exist_ok=True)
    cdp = None
    drive.launch()
    made = []
    try:
        cdp = drive.CDP(drive.ws_url())
        cdp.send('Page.enable'); cdp.send('Runtime.enable')
        for show in shows:
            card = brand(capture(cdp, show['id']), show)
            name = show['id'] + '.png'
            card.save(os.path.join(OUT, name))
            made.append((show['id'], name))
            print('%-15s -> titlecards/%s' % (show['id'], name), flush=True)
    finally:
        drive.shutdown(cdp)
    print('\nAdd to SHOW_CARDS in js/main.js and "titlecard" in show-config.json:')
    for sid, name in made:
        print("        %s: '%s'," % (sid, name))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
