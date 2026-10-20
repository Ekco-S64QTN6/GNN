#!/usr/bin/env python3
"""GNN trailer — cut from the station's own footage.

The picture is takes recorded from the running broadcast (record_takes.py),
title cards drawn here with PIL, and TV static. The sound is the Master of
Orion II intro score, the station's own audio from the takes, narration in
the station's own voices (build/vo/, made by the Kokoro server), and hits
and sweeps from both games' effects library — mixed with the score ducked
under every spoken line, and mastered to YouTube's -14 LUFS.

The cut is a list of segments (EDL below); each knows its length, and every
voice line and effect is placed relative to the segment it belongs to, so
lengthening one shot moves everything after it.

    python3 trailer/make_trailer.py            # build trailer/out/gnn_trailer.mp4
    python3 trailer/make_trailer.py --sheet    # contact sheet of the cut only
    python3 trailer/make_trailer.py --audio-only   # remix onto the existing picture
"""
import json
import math
import os
import random
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
BUILD = os.path.join(HERE, 'build')
TAKES = os.path.join(BUILD, 'takes')
VO = os.path.join(BUILD, 'vo')
SEG = os.path.join(BUILD, 'segments')
OUT = os.path.join(HERE, 'out')
W, H, FPS = 1920, 1080, 30
GEN = os.path.join(ROOT, 'assets', 'generated')
SFX = os.path.join(ROOT, 'assets', 'audio')

FONT_BLACK = '/usr/share/fonts/noto/NotoSans-Black.ttf'
FONT_BOLD = '/usr/share/fonts/noto/NotoSans-Bold.ttf'
FONT_MONO = '/usr/share/fonts/TTF/Hack-Bold.ttf'

random.seed(1993)
_fonts = {}


def font(path, size):
    key = (path, size)
    if key not in _fonts:
        _fonts[key] = ImageFont.truetype(path, size)
    return _fonts[key]


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(' '.join(cmd[:12]), '...\n', r.stderr[-2000:])
        raise SystemExit(1)
    return r


def dur_of(path):
    r = subprocess.run(['ffprobe', '-v', 'quiet', '-show_entries', 'format=duration',
                        '-of', 'csv=p=0', path], capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


# ---------------------------------------------------------------------------
# Look
# ---------------------------------------------------------------------------

_scan = None


def scanlines():
    global _scan
    if _scan is None:
        a = np.zeros((H, W, 4), np.uint8)
        a[::3, :, 3] = 34
        yy, xx = np.mgrid[0:H, 0:W]
        d = np.sqrt(((xx - W / 2) / (W * 0.62)) ** 2 + ((yy - H / 2) / (H * 0.62)) ** 2)
        a[:, :, 3] = np.clip(a[:, :, 3] + np.clip((d - 0.75) * 260, 0, 170), 0, 255).astype(np.uint8)
        _scan = Image.fromarray(a, 'RGBA')
    return _scan


def crt(im):
    """Scanlines and vignette, so drawn cards sit with the broadcast."""
    im = im.convert('RGBA')
    im.alpha_composite(scanlines())
    return im.convert('RGB')


def rgb_split(im, px):
    if px <= 0:
        return im
    r, g, b = im.split()
    r = ImageChops.offset(r, px, 0)
    b = ImageChops.offset(b, -px, 0)
    return Image.merge('RGB', (r, g, b))


def ease_out(t):
    return 1 - (1 - t) ** 3


def text_size(draw, text, f):
    box = draw.textbbox((0, 0), text, font=f)
    return box[2] - box[0], box[3] - box[1], box


def cover(im, w=W, h=H):
    s = max(w / im.width, h / im.height)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    x = (im.width - w) // 2
    y = (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def take_frame(name, t):
    """One frame from a take, for card backgrounds."""
    path = os.path.join(TAKES, name + '.webm')
    out = os.path.join(BUILD, '_frame.png')
    subprocess.run(['ffmpeg', '-v', 'quiet', '-y', '-ss', str(t), '-i', path,
                    '-frames:v', '1', out])
    return Image.open(out).convert('RGB') if os.path.exists(out) else Image.new('RGB', (W, H))


# ---------------------------------------------------------------------------
# Cards
# ---------------------------------------------------------------------------

def card_slam(lines, bg=None, color=(255, 214, 120), sub=None, size=170, dim=0.32, blur=10):
    """Words that slam in: overshoot scale, a flash, a little chromatic split."""
    base = Image.new('RGB', (W, H), (4, 6, 12))
    if bg is not None:
        b = cover(bg).filter(ImageFilter.GaussianBlur(blur))
        base = Image.blend(base, b, dim)

    def frame(i, n):
        t = i / FPS
        k = min(1.0, t / 0.22)
        scale = 1.0 + 0.35 * (1 - ease_out(k))
        im = base.copy()
        layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        f = font(FONT_BLACK, size)
        total_h = 0
        dims = []
        for ln in lines:
            w, h, box = text_size(d, ln, f)
            dims.append((w, h, box))
            total_h += h + int(size * 0.18)
        y = (H - total_h) // 2 - (40 if sub else 0)
        for ln, (w, h, box) in zip(lines, dims):
            d.text(((W - w) // 2 - box[0], y - box[1]), ln, font=f, fill=color + (255,))
            y += h + int(size * 0.18)
        if sub:
            fs = font(FONT_MONO, 40)
            w, h, box = text_size(d, sub, fs)
            d.text(((W - w) // 2 - box[0], y + 20 - box[1]), sub, font=fs, fill=(160, 220, 255, 255))
        if scale != 1.0:
            lw, lh = int(W * scale), int(H * scale)
            layer = layer.resize((lw, lh), Image.LANCZOS).crop(
                ((lw - W) // 2, (lh - H) // 2, (lw - W) // 2 + W, (lh - H) // 2 + H))
        glow = layer.filter(ImageFilter.GaussianBlur(18))
        im = im.convert('RGBA')
        im.alpha_composite(glow)
        im.alpha_composite(layer)
        im = im.convert('RGB')
        if i < 3:
            im = Image.blend(im, Image.new('RGB', (W, H), (255, 255, 255)), 0.55 - i * 0.18)
        im = rgb_split(im, max(0, 9 - i * 2))
        return crt(im)
    return frame


def card_type(text, sub=None, bg=None):
    """A line typed out, teletype style, with a block cursor."""
    base = Image.new('RGB', (W, H), (3, 7, 12))
    if bg is not None:
        base = Image.blend(base, cover(bg).filter(ImageFilter.GaussianBlur(14)), 0.28)
    f = font(FONT_MONO, 78)

    def frame(i, n):
        shown = min(len(text), int(i / 1.6))
        im = base.copy()
        d = ImageDraw.Draw(im)
        w, h, box = text_size(d, text, f)
        x = (W - w) // 2
        y = H // 2 - 70
        d.text((x - box[0], y - box[1]), text[:shown], font=f, fill=(255, 210, 110))
        if (i // 8) % 2 == 0 or shown < len(text):
            cw, _, _ = text_size(d, text[:shown] or ' ', f)
            d.rectangle((x + (cw if shown else 0) + 8, y, x + (cw if shown else 0) + 52, y + 80),
                        fill=(255, 210, 110))
        if sub and shown == len(text):
            fs = font(FONT_MONO, 42)
            sw, sh, sb = text_size(d, sub, fs)
            d.text(((W - sw) // 2 - sb[0], y + 140 - sb[1]), sub, font=fs, fill=(150, 220, 255))
        return crt(im)
    return frame


def card_image(path, zoom=(1.0, 1.08), dim=1.0, text=None):
    """A still picture with a slow push-in."""
    src = Image.open(path).convert('RGB')

    def frame(i, n):
        z = zoom[0] + (zoom[1] - zoom[0]) * (i / max(1, n - 1))
        im = cover(src, int(W * z), int(H * z))
        x = (im.width - W) // 2
        y = (im.height - H) // 2
        im = im.crop((x, y, x + W, y + H))
        if dim < 1:
            im = Image.blend(Image.new('RGB', (W, H)), im, dim)
        return crt(im)
    return frame


def card_shows():
    """Every show's title card, one after another, with the slot clock."""
    names = ['sector_weather', 'main_desk', 'midday_wire', 'market_desk', 'fleet_briefing',
             'tech_desk', 'machine_intel', 'diplomacy', 'council_hour', 'evening_rim',
             'galactic_spotlight', 'rim_sports', 'arena_hour', 'world_tonight', 'the_spotlight',
             'night_desk', 'anomaly', 'deep_signal', 'solar_wind', 'archives', 'old_empires',
             'orbital_briefing', 'market_close', 'signal_circuit']
    cards = []
    for n in names:
        p = os.path.join(GEN, 'titlecards', n + '.png')
        if os.path.exists(p):
            cards.append(cover(Image.open(p).convert('RGB')))
    per = 8  # frames each

    def frame(i, n):
        k = min(len(cards) - 1, i // per)
        im = cards[k].copy()
        d = ImageDraw.Draw(im)
        slot = (k * 4 + 24) % 96
        clock = '%02d:%02d' % (slot // 4, (slot % 4) * 15)
        f = font(FONT_MONO, 46)
        label = 'GST %s  SLOT %02d/96' % (clock, slot + 1)
        tw, th, tb = text_size(d, label, f)
        d.rectangle((40, 36, 40 + tw + 44, 36 + th + 34), fill=(4, 10, 20))
        d.text((62 - tb[0], 53 - tb[1]), label, font=f, fill=(255, 210, 110))
        if i % per < 2:
            im = rgb_split(im, 10)
        return crt(im)
    return frame, len(cards) * per


def card_end():
    """The logo slam: the Main Desk mark (globe and ring over GNN), the name."""
    raw = Image.open(os.path.join(GEN, '_inbox', 'logos', 'main_desk.png')).convert('RGBA')
    a = np.asarray(raw)[:, :, 3]
    filled = (a > 40).sum(axis=1)
    rows = np.where(filled > 0)[0]
    # Keep the globe and the letters; drop the "MAIN DESK" line beneath —
    # cut at the first empty row below the letters, not at a fraction.
    lo = rows[0] + int((rows[-1] - rows[0]) * 0.55)
    gap = next((r for r in range(lo, rows[-1]) if filled[r] == 0), rows[-1])
    logo = raw.crop((0, rows[0], raw.width, gap))
    bbox = logo.getbbox()
    logo = logo.crop(bbox)
    lh = 560
    logo = logo.resize((int(logo.width * lh / logo.height), lh), Image.LANCZOS)
    stars = Image.new('RGB', (W, H), (2, 4, 10))
    sd = ImageDraw.Draw(stars)
    for _ in range(900):
        x, y = random.randrange(W), random.randrange(H)
        v = random.randrange(60, 220)
        sd.point((x, y), fill=(v, v, min(255, v + 30)))
    neb = Image.open(os.path.join(GEN, 'backdrops', 'earth_globe_night.png')).convert('RGB')
    stars = Image.blend(stars, cover(neb).filter(ImageFilter.GaussianBlur(3)), 0.35)

    def frame(i, n):
        t = i / FPS
        k = min(1.0, t / 0.35)
        s = 1.0 + 0.5 * (1 - ease_out(k)) + 0.03 * (t / (n / FPS))
        im = stars.copy().convert('RGBA')
        lw, lh2 = int(logo.width * s), int(logo.height * s)
        lg = logo.resize((lw, lh2), Image.LANCZOS)
        glow = lg.filter(ImageFilter.GaussianBlur(30))
        x = (W - lw) // 2
        y = int(H * 0.40 - lh2 / 2)
        im.alpha_composite(glow, (x, y))
        im.alpha_composite(lg, (x, y))
        d = ImageDraw.Draw(im)
        if t > 0.9:
            al = min(255, int((t - 0.9) * 400))
            f = font(FONT_BOLD, 62)
            txt = 'G A L A C T I C   N E W S   N E T W O R K'
            w, h, box = text_size(d, txt, f)
            d.text(((W - w) // 2 - box[0], int(H * 0.78) - box[1]), txt, font=f,
                   fill=(235, 238, 245, al))
        if t > 2.6:
            al = min(255, int((t - 2.6) * 300))
            f = font(FONT_MONO, 44)
            txt = 'ON AIR  ·  ALWAYS'
            w, h, box = text_size(d, txt, f)
            d.text(((W - w) // 2 - box[0], int(H * 0.87) - box[1]), txt, font=f,
                   fill=(255, 205, 105, al))
        im = im.convert('RGB')
        if i < 4:
            im = Image.blend(im, Image.new('RGB', (W, H), (255, 255, 255)), 0.8 - i * 0.2)
            im = rgb_split(im, 14 - i * 3)
        return crt(im)
    return frame


def card_final():
    """Small card after the button: GNN, stay tuned, the credits line."""
    def frame(i, n):
        im = Image.new('RGB', (W, H), (0, 0, 0))
        d = ImageDraw.Draw(im)
        t = i / FPS
        al = min(1.0, t / 0.6)
        c = tuple(int(v * al) for v in (255, 205, 105))
        f = font(FONT_BLACK, 150)
        w, h, box = text_size(d, 'GNN', f)
        d.text(((W - w) // 2 - box[0], H // 2 - 170 - box[1]), 'GNN', font=f, fill=c)
        f2 = font(FONT_MONO, 44)
        for k, line in enumerate(['STAY TUNED', 'real news  ·  alien anchors  ·  around the clock']):
            w, h, box = text_size(d, line, f2 if k else font(FONT_MONO, 56))
            ff = f2 if k else font(FONT_MONO, 56)
            col = (230, 235, 245) if k == 0 else (140, 190, 230)
            col = tuple(int(v * al) for v in col)
            d.text(((W - w) // 2 - box[0], H // 2 + 30 + k * 90 - box[1]), line, font=ff, fill=col)
        f3 = font(FONT_MONO, 26)
        line = 'built from Master of Orion I & II  ·  voiced locally by Kokoro  ·  github.com/Ekco-S64QTN6/GNN'
        w, h, box = text_size(d, line, f3)
        d.text(((W - w) // 2 - box[0], H - 90 - box[1]), line, font=f3,
               fill=tuple(int(v * al) for v in (110, 120, 140)))
        return crt(im)
    return frame


def card_newscast(bulletin, logo_s=2.0, zoom_s=1.0):
    """The original 1993 GNN broadcast: the console, the logo, the robot
    anchor with the spinning globe beside its head, a bulletin typing out
    centred in the lower panel — and at the end, a push into the screen."""
    C = os.path.join(ROOT, 'assets', 'cutscenes', 'NEWSCAST')
    ld = lambda n, k: Image.open(os.path.join(C, 'item_%02d_frame_%03d.png' % (n, k))).convert('RGBA')
    console = ld(0, 0)
    logo = [ld(1, k) for k in range(20)]
    robot = [ld(2, k) for k in range(25)]
    globe = [ld(3, k) for k in range(25)]
    sc = H / 200.0                       # 5.4
    vw = int(320 * sc)
    f = font(FONT_MONO, 34)

    def frame(i, n):
        t = i / FPS
        im = console.copy()
        if t < logo_s:
            im.alpha_composite(logo[min(19, int(t * 10))], (14, 14))
        else:
            k = int((t - logo_s) * 10)
            im.alpha_composite(robot[k % 25], (14, 14))
            # The globe is the little monitor beside the anchor's head,
            # in the upper-right of the viewport — not down in the text
            # panel. Drawn on top of the robot so it sits in its frame.
            im.alpha_composite(globe[k % 25], (210, 30))
        big = im.convert('RGB').resize((vw, H), Image.NEAREST)
        d = ImageDraw.Draw(big)
        if t >= logo_s + 0.3:
            shown = bulletin[:int((t - logo_s - 0.3) * 24)]
            # The bulletin panel is x 33..286 in console coords. Use all of
            # it — nothing is reserved on the left now the globe has moved
            # up — and centre each wrapped line inside it.
            max_w = (286 - 33) * sc
            text_cx = (33 + 286) / 2 * sc
            words, lines, cur = shown.split(' '), [], ''
            for w in words:
                trial = (cur + ' ' + w).strip()
                if d.textlength(trial, font=f) > max_w:
                    lines.append(cur); cur = w
                else:
                    cur = trial
            lines.append(cur)
            for li, ln in enumerate(lines[-3:]):
                box = d.textbbox((0, 0), ln, font=f)
                x = text_cx - (box[0] + box[2]) / 2
                d.text((x, (144 + li * 12) * sc), ln, font=f,
                       fill=(255, 214, 96))
        out = Image.new('RGB', (W, H), (0, 0, 0))
        out.paste(big, ((W - vw) // 2, 0))
        tz = t - (n / FPS - zoom_s)
        if tz > 0:
            u = ease_out(min(1.0, tz / zoom_s))
            z = 1 + 1.4 * u
            zcx, zcy = W / 2, 66 * sc
            w2, h2 = W / z, H / z
            x0 = max(0, min(W - w2, zcx - w2 / 2)); y0 = max(0, min(H - h2, zcy - h2 / 2))
            out = out.crop((int(x0), int(y0), int(x0 + w2), int(y0 + h2))).resize((W, H), Image.LANCZOS)
        return crt(out)
    return frame


def card_seq(paths, src_fps, push=0.06):
    """An image sequence (archive animation) played at its own rate,
    nearest-neighbour upscaled to cover the frame, with a slow push-in."""
    imgs = [Image.open(p).convert('RGB') for p in paths]

    def frame(i, n):
        k = min(len(imgs) - 1, int(i / FPS * src_fps))
        z = 1 + push * i / max(1, n - 1)
        src = imgs[k]
        s = max(W / src.width, H / src.height) * z
        big = src.resize((int(src.width * s), int(src.height * s)), Image.NEAREST)
        x = (big.width - W) // 2; y = (big.height - H) // 2
        return crt(big.crop((x, y, x + W, y + H)))
    return frame


def card_montage(paths, push=0.05):
    """Generated art, a quick cut every few frames."""
    imgs = [cover(Image.open(p).convert('RGB')) for p in paths]

    def frame(i, n):
        per = n / len(imgs)
        k = min(len(imgs) - 1, int(i / per))
        z = 1 + push * ((i - k * per) / per)
        src = imgs[k]
        big = src.resize((int(W * z), int(H * z)), Image.LANCZOS)
        x = (big.width - W) // 2; y = (big.height - H) // 2
        im = big.crop((x, y, x + W, y + H))
        if i - k * per < 2:
            im = rgb_split(im, 6)
        return crt(im)
    return frame


def render_cine(path, name, t_in, dur, push=0.06):
    """MoO2 cinematic at its native 13 fps, from build/cine/ (decoded from
    the game's own file). The 480x160 videos are line-doubled back to
    480x320 first."""
    src = os.path.join(BUILD, 'cine', name + '.mp4')
    n = max(1, int(round(dur * FPS)))
    w, h = (480, 160) if name in ('INTRO', 'WININFIN', 'LOSERFIN', 'ANWINFIN') else (288, 208)
    fix = 'scale=480:320:flags=bicubic,' if h == 160 else ''
    z, x, y = move_expr('push_centre', push, n)
    vf = (fix + 'fps=%d,scale=%d:%d:force_original_aspect_ratio=increase:flags=lanczos,crop=%d:%d,'
          "zoompan=z='%s':x='%s':y='%s':d=1:s=%dx%d:fps=%d,eq=contrast=1.08:saturation=1.1,vignette=PI/5"
          % (FPS, int(W * 1.3), int(H * 1.3), int(W * 1.3), int(H * 1.3), z, x, y, W, H, FPS))
    run(['ffmpeg', '-v', 'error', '-y', '-ss', '%.3f' % t_in, '-i', src, '-t', '%.3f' % dur,
         '-vf', vf, '-frames:v', str(n)] + ENC + [path])


# ---------------------------------------------------------------------------
# Segment rendering
# ---------------------------------------------------------------------------

ENC = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p',
       '-r', str(FPS), '-an']


def render_frames(path, frame_fn, n):
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
                          '-s', '%dx%d' % (W, H), '-r', str(FPS), '-i', '-'] + ENC + [path],
                         stdin=subprocess.PIPE)
    for i in range(n):
        im = frame_fn(i, n)
        p.stdin.write(im.tobytes())
    p.stdin.close()
    p.wait()


# Camera moves. The first cut pushed every shot in by growing the frame
# and cropping a fixed window, and the crop pinned to one corner, so every
# shot crept toward the same spot (owner: "always zooming into the same
# corner"). Each shot now gets a move of its own — a push toward the left,
# centre, right or the faces, a slow pull-out, or a lateral pan — never the
# same move twice running. `zoompan` works from a 1.5x oversampled frame so
# a move never softens the picture.
MOVES = ['push_centre', 'push_left', 'push_right', 'push_faces', 'pull_out',
         'pan_right', 'pan_left', 'push_low']
_last_move = [None]


def pick_move(rng):
    choices = [m for m in MOVES if m != _last_move[0]]
    m = rng.choice(choices)
    _last_move[0] = m
    return m


def move_expr(move, amount, n):
    """zoompan z/x/y expressions for a move over n frames."""
    u = 'on/%d' % max(1, n - 1)
    if move == 'ticker':
        # Close on the market crawl along the bottom edge, panning along it.
        # Tight enough that only the crawl shows; held still so the quotes
        # scroll past on their own.
        return '3.4', '(iw-iw/zoom)*0.12', '(ih-ih/zoom)'
    a = max(0.02, amount)
    if move == 'pull_out':
        z = '%.4f-%.4f*%s' % (1 + a, a, u)
    elif move in ('pan_right', 'pan_left'):
        z = '%.4f' % (1 + max(a, 0.06))
    else:
        z = '1+%.4f*%s' % (a, u)
    fx, fy = {
        'push_centre': ('0.5', '0.5'), 'push_left': ('0.22', '0.45'),
        'push_right': ('0.78', '0.45'), 'push_faces': ('0.5', '0.28'),
        'push_low': ('0.5', '0.72'), 'pull_out': ('0.5', '0.42'),
        'pan_right': ('0.15+0.7*%s' % u, '0.45'), 'pan_left': ('0.85-0.7*%s' % u, '0.45'),
    }[move]
    return z, '(iw-iw/zoom)*(%s)' % fx, '(ih-ih/zoom)*(%s)' % fy


def render_take(path, name, t_in, dur, push=0.05, grade=True, move='push_centre'):
    src = os.path.join(TAKES, name + '.webm')
    n = max(1, int(round(dur * FPS)))
    if push:
        z, x, y = move_expr(move, push, n)
        vf = ('fps=%d,scale=%d:%d:flags=lanczos,'
              "zoompan=z='%s':x='%s':y='%s':d=1:s=%dx%d:fps=%d"
              % (FPS, int(W * 1.5), int(H * 1.5), z, x, y, W, H, FPS))
    else:
        vf = 'fps=%d,scale=%d:%d:flags=lanczos' % (FPS, W, H)
    if grade:
        vf += ',eq=contrast=1.06:saturation=1.08,vignette=PI/5'
    run(['ffmpeg', '-v', 'error', '-y', '-ss', '%.3f' % t_in, '-i', src, '-t', '%.3f' % dur,
         '-vf', vf, '-frames:v', str(n)] + ENC + [path])


def render_noise(path, dur):
    run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i',
         'nullsrc=s=%dx%d:r=%d,geq=lum=random(1)*255:cb=128:cr=128' % (W // 4, H // 4, FPS),
         '-t', '%.3f' % dur, '-vf', 'scale=%d:%d:flags=neighbor,eq=contrast=1.3' % (W, H)]
        + ENC + [path])


def render_black(path, dur):
    run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i',
         'color=c=black:s=%dx%d:r=%d' % (W, H, FPS), '-t', '%.3f' % dur] + ENC + [path])


# ---------------------------------------------------------------------------
# The cut
# ---------------------------------------------------------------------------
#
# Each segment: (kind, args, seconds, extras). extras may hold:
#   'vo':  [(file, offset_s, gain_db)]   narration placed in the segment
#   'sfx': [(file, offset_s, gain_db)]   effects placed in the segment
#   'audio': gain_db                       keep the take's own sound
#
# The score starts at MUSIC_AT and its landmarks (lift at 57 s, peak at 80 s,
# final hit at 101 s) are what the breaking-news cut, the ground-war blast
# and the logo slam are timed to.

MUSIC_AT = 3.0       # overridden by the segment marked 'music_start'
MUSIC_DB = -13.0
SF = lambda name: os.path.join(SFX, name)         # noqa: E731
STING = lambda n: SF('intro_sfx_%02d.wav' % n)     # noqa: E731
GEN_ART = [os.path.join(GEN, *p.split('/')) for p in (
    'infomercials/ocean_villa_interior.png', 'cutaways/starship_battle_02.png',
    'infomercials/foundry_floor.png', 'backdrops/orion_shipyard_night.png',
    'infomercials/hyperspace_bridge.png', 'cutaways/black_hole.png',
    'infomercials/gold_exchange_counter.png', 'cutaways/planet_invasion_02.png',
    'infomercials/hydroponic_dome_fields.png', 'set/anomaly_wide_empty.png')]
INTRO2_BLAST = [os.path.join(ROOT, 'assets', 'cutscenes', 'INTRO2', 'item_00_frame_%03d.png' % k)
                for k in range(4, 40)]
GW_FRAMES = sorted(os.path.join(BUILD, 'gw_frames', f) for f in os.listdir(os.path.join(BUILD, 'gw_frames'))) \
    if os.path.isdir(os.path.join(BUILD, 'gw_frames')) else []


def edl():
    show_frames, show_n = card_shows()
    bulletin = ('THE DREADED COMET HAS UTTERLY DESTROYED THE SAKKRA COLONY. '
                'THE PSILON EMPIRE NOW SPANS FOURTEEN STAR SYSTEMS.')
    return [
        # --- Cold open: the original 1993 newscast. No score yet. ---------
        ('noise', None, 0.8, {'sfx': [(SF('sfx_09.wav'), 0.0, -8)], 'noise_audio': -16}),
        ('newscast', bulletin, 13.0, {
            'vo': [('c1.wav', 2.2, 0), ('c2.wav', 6.6, 0), ('c3.wav', 11.7, 0)],
            'sfx': [(STING(3), 0.0, -10), (SF('sfx_28.wav'), 2.0, -12)]}),
        ('noise', None, 0.3, {'noise_audio': -14}),
        ('take', ('desk_archive', 1.0), 3.4, {'vo': [('c4.wav', 0.2, 0)], 'push': 0.04}),
        ('take', ('desk_morning', 1.0), 2.3, {'vo': [('c5.wav', 0.1, 0)], 'push': 0.04}),
        ('image', (os.path.join(GEN, 'titlecards', 'test_card.png'), (1.0, 1.06)), 3.6,
         {'music_start': True, 'vo': [('ident.wav', 0.3, 0)], 'sfx': [(STING(3), 0.0, -8)]}),
        # --- The desk ------------------------------------------------------
        ('image', (os.path.join(GEN, 'titlecards', 'main_desk_04.png'), (1.0, 1.10)), 3.4,
         {'vo': [('r1.wav', 0.0, 0)]}),
        ('take', ('desk_weather', 1.0), 2.0, {'vo': [('x1.wav', 0.2, 0)]}),
        ('take', ('desk_spotlight', 1.0), 2.0, {}),
        ('take', ('desk_anomaly', 1.0), 2.0, {'sfx': [(SF('sfx_13.wav'), 1.4, -10)]}),
        ('slam', (['REAL NEWS.'], 'desk_morning'), 2.0, {'vo': [('n3.wav', 0.25, 0)],
                                                          'sfx': [(SF('sfx_00.wav'), 0.0, -2)]}),
        ('take', ('desk_diplomacy', 0.3), 4.0, {'audio': -1, 'push': 0.03}),
        ('slam', (['READ BY ALIENS.'], 'desk_crossfire'), 2.2, {'vo': [('n4.wav', 0.25, 0)],
                                                                 'sfx': [(SF('sfx_26.wav'), 0.0, -2)]}),
        ('take', ('desk_crossfire', 1.0), 3.2, {'audio': -1, 'push': 0.03}),
        ('take', ('desk_sports', 3.0), 2.8, {'vo': [('t1.wav', 0.2, 0)], 'move': 'ticker', 'push': 1}),
        ('frames', (show_frames, show_n), show_n / FPS, {'vo': [('n5.wav', 0.4, 0)],
                                                          'sfx': [(SF('sfx_19.wav'), 0.0, -10)]}),
        ('take', ('correspondent', 0.6), 2.8, {'vo': [('n6.wav', 0.2, 0)]}),
        ('take', ('debate', 0.6), 2.0, {}),
        # --- Built from both games -----------------------------------------
        ('seq', (INTRO2_BLAST, 11), 3.0, {'vo': [('g1.wav', 0.1, 0)], 'sfx': [(SF('sfx_21.wav'), 1.0, -6)]}),
        ('cine', ('INTRO', 79.0), 4.0, {'vo': [('g2.wav', 0.2, 0)]}),
        ('cine', ('ANATKFIN', 5.4), 3.4, {}),
        ('montage', None, 3.4, {'vo': [('g3.wav', 0.1, 0)]}),
        # --- Weather, then breaking news (the score lifts) ------------------
        ('take', ('desk_weather', 1.0), 5.0, {'vo': [('w1.wav', 0.2, 0)], 'push': 0.04}),
        ('take', ('breaking', 0.0), 5.4, {'audio': -2, 'vo': [('n7.wav', 0.0, 0), ('n8.wav', 3.0, 0)], 'push': 0.02}),
        # --- Commercials: one announcer, one script -------------------------
        ('type', ('A WORD FROM OUR SPONSORS', 'commercial break'), 2.6,
         {'vo': [('n9.wav', 0.1, 0)], 'sfx': [(SF('sfx_28.wav'), 0.0, -8)]}),
        ('take', ('ad_shop', 2.6), 4.6, {'vo': [('a1.wav', 0.2, 0)]}),
        ('take', ('ad_research', 4.0), 3.1, {'vo': [('a2.wav', 0.15, 0)]}),
        ('take', ('ad_salvage', 2.6), 2.8, {'vo': [('a3.wav', 0.15, 0)]}),
        ('take', ('ad_ships', 4.2), 2.6, {'vo': [('a4.wav', 0.15, 0)]}),
        ('take', ('ad_infomercial', 5.0), 3.3, {'vo': [('a5.wav', 0.2, 0)]}),
        # --- Galaxy events stinger (the score peaks) -----------------------
        ('seq', (GW_FRAMES, 30), 5.6, {'vo': [('s1.wav', 2.4, 0)],
                                       'sfx': [(SF('moo2/12_NRGBLST3.wav'), 0.3, -4), (SF('sfx_21.wav'), 4.6, -8)]}),
        ('cine', ('WININFIN', 27.5), 2.4, {}),
        ('cine', ('PLNTDFIN', 6.2), 2.8, {'sfx': [(SF('sfx_35.wav'), 1.6, -6)]}),
        # --- The signal -----------------------------------------------------
        ('noise', None, 0.35, {'noise_audio': -12}),
        ('take', ('fx_snow', 0.0), 0.7, {'audio': -8, 'vo': [('n10.wav', 0.1, 0)]}),
        ('take', ('fx_rgb', 0.1), 1.0, {'audio': -8}),
        ('take', ('fx_bars', 0.0), 1.1, {'audio': -14}),
        ('take', ('fx_antaran', 0.5), 3.3, {'audio': -6, 'vo': [('n11.wav', 0.2, 0)]}),
        ('montage_takes', ['fx_crosstalk', 'groundwar', 'footage_battle', 'ad_ships', 'desk_anomaly',
                           'breaking', 'debate', 'ad_research', 'footage_anomaly', 'desk_sports'],
         2.2, {'sfx': [(SF('sfx_22.wav'), 0.8, -8)]}),
        # --- Final hit -------------------------------------------------------
        ('end', None, 6.6, {'vo': [('n12.wav', 0.7, 0), ('n13.wav', 4.1, 0)],
                            'sfx': [(SF('moo2/12_NRGBLST3.wav'), 0.0, -4), (STING(2), 0.0, -8)]}),
        ('black', None, 0.8, {}),
        ('take', ('signoff_desk', 0.3), 6.0, {'audio': 0, 'push': 0.04}),
        ('noise', None, 0.3, {'noise_audio': -14}),
        ('final', None, 4.0, {'vo': [('signoff2.wav', 0.4, 0)], 'sfx': [(STING(5), 3.3, -12)]}),
    ]


def build(audio_only=False):
    os.makedirs(SEG, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    cut = edl()
    moves_rng = random.Random(2026)
    files, events, t = [], [], 0.0
    for idx, (kind, args, dur, ex) in enumerate(cut):
        path = os.path.join(SEG, '%03d_%s.mp4' % (idx, kind))
        n = int(round(dur * FPS))
        dur = n / FPS
        if not audio_only:
            print('%6.2f  %-8s %-34s %.2fs' % (t, kind, str(args[0] if isinstance(args, tuple) else '')[:34], dur),
                  flush=True)
        if audio_only:
            if kind == 'take' and 'audio' in ex:
                events.append(('take', args[0], args[1], t, dur, ex['audio']))
            elif kind == 'noise':
                events.append(('noise', None, 0, t, dur, ex.get('noise_audio', -14)))
        elif kind == 'take':
            name, t_in = args
            render_take(path, name, t_in, dur, push=ex.get('push', 0.05),
                        move=ex.get('move') or pick_move(moves_rng))
            if 'audio' in ex:
                events.append(('take', name, t_in, t, dur, ex['audio']))
        elif kind == 'noise':
            render_noise(path, dur)
            events.append(('noise', None, 0, t, dur, ex.get('noise_audio', -14)))
        elif kind == 'black':
            render_black(path, dur)
        elif kind == 'image':
            render_frames(path, card_image(args[0], zoom=args[1]), n)
        elif kind == 'slam':
            lines, bg_take = args
            render_frames(path, card_slam(lines, bg=take_frame(bg_take, 2.0)), n)
        elif kind == 'type':
            render_frames(path, card_type(args[0], sub=args[1]), n)
        elif kind == 'frames':
            render_frames(path, args[0], n)
        elif kind == 'end':
            render_frames(path, card_end(), n)
        elif kind == 'final':
            render_frames(path, card_final(), n)
        elif kind == 'newscast':
            render_frames(path, card_newscast(args), n)
        elif kind == 'seq':
            render_frames(path, card_seq(args[0], args[1]), n)
        elif kind == 'cine':
            render_cine(path, args[0], args[1], dur)
        elif kind == 'montage':
            render_frames(path, card_montage(GEN_ART), n)
        elif kind == 'montage_takes':
            parts = []
            each = dur / len(args)
            for k, name in enumerate(args):
                pp = os.path.join(SEG, '%03d_m%02d.mp4' % (idx, k))
                total = dur_of(os.path.join(TAKES, name + '.webm')) or 4.0
                render_take(pp, name, random.uniform(0.5, max(0.6, total - each - 0.3)), each, push=0.12,
                            move=pick_move(moves_rng))
                parts.append(pp)
            concat(parts, path)
        files.append(path)
        if ex.get('music_start'):
            global MUSIC_AT
            MUSIC_AT = t
        for f, off, g in ex.get('vo', []):
            events.append(('file', os.path.join(VO, f), 0, t + off, None, g, 'dialog'))
        for f, off, g in ex.get('sfx', []):
            events.append(('file', f, 0, t + off, None, g, 'fx'))
        t += dur
    if not audio_only:
        concat(files, os.path.join(BUILD, 'picture.mp4'))
    print('picture: %.2fs' % t)
    mix(events, t, os.path.join(BUILD, 'sound.wav'))
    final = os.path.join(OUT, 'gnn_trailer.mp4')
    run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(BUILD, 'picture.mp4'),
         '-i', os.path.join(BUILD, 'sound.wav'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
         '-pix_fmt', 'yuv420p', '-r', str(FPS), '-c:a', 'aac', '-b:a', '320k', '-ar', '48000',
         '-shortest', '-movflags', '+faststart', final])
    print('->', final, '%.1f MB' % (os.path.getsize(final) / 1e6))


def concat(parts, out):
    lst = out + '.txt'
    with open(lst, 'w') as fh:
        for p in parts:
            fh.write("file '%s'\n" % p)
    run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', out])


def mix(events, total, out):
    """Score + dialogue + effects; the score ducks under every spoken line."""
    inputs, chains, dialog, fx = [], [], [], []
    k = 0
    for ev in events:
        if ev[0] == 'take':
            _, name, t_in, at, dur, g = ev
            inputs += ['-ss', '%.3f' % t_in, '-t', '%.3f' % dur, '-i', os.path.join(TAKES, name + '.webm')]
            chains.append('[%d:a]aresample=48000,aformat=channel_layouts=stereo,volume=%.1fdB,'
                          'afade=t=in:d=0.04,afade=t=out:st=%.3f:d=0.08,adelay=%d|%d[a%d]'
                          % (k, g, max(0, dur - 0.08), at * 1000, at * 1000, k))
            dialog.append('[a%d]' % k)
        elif ev[0] == 'noise':
            _, _, _, at, dur, g = ev
            inputs += ['-f', 'lavfi', '-t', '%.3f' % dur, '-i', 'anoisesrc=color=white:amplitude=0.5:r=48000']
            chains.append('[%d:a]aformat=channel_layouts=stereo,highpass=f=400,volume=%.1fdB,adelay=%d|%d[a%d]'
                          % (k, g, at * 1000, at * 1000, k))
            fx.append('[a%d]' % k)
        else:
            _, path, _, at, _, g, bus = ev
            if not os.path.exists(path):
                print('  missing', path)
                continue
            inputs += ['-i', path]
            chains.append('[%d:a]aresample=48000,aformat=channel_layouts=stereo,volume=%.1fdB,adelay=%d|%d[a%d]'
                          % (k, g, at * 1000, at * 1000, k))
            (dialog if bus == 'dialog' else fx).append('[a%d]' % k)
        k += 1
    music = k
    inputs += ['-i', os.path.join(ROOT, 'assets', 'audio', 'music', 'moo2', 'intro.ogg')]
    # The score is the MoO2 intro's own soundtrack, which carries the
    # cinematic's radio chatter. At -4 dB that chatter sat above the
    # narrator (owner: "a little loud ... louder than the announcer"); it is
    # a bed now, and ducks hard under every spoken line.
    chains.append('[%d:a]aresample=48000,aformat=channel_layouts=stereo,volume=%.1fdB,'
                  'adelay=%d|%d[mus]' % (music, MUSIC_DB, MUSIC_AT * 1000, MUSIC_AT * 1000))
    chains.append('%samix=inputs=%d:normalize=0:duration=longest,apad=whole_dur=%.3f[dia]'
                  % (''.join(dialog), len(dialog), total))
    chains.append('[dia]asplit=2[dia1][key]')
    chains.append('[mus][key]sidechaincompress=threshold=0.015:ratio=12:attack=25:release=600:makeup=1[duck]')
    chains.append('%samix=inputs=%d:normalize=0[fxb]' % (''.join(fx), len(fx)))
    chains.append('[duck][dia1][fxb]amix=inputs=3:normalize=0:duration=longest,'
                  'atrim=0:%.3f,afade=t=out:st=%.3f:d=0.6,'
                  'loudnorm=I=-14:TP=-1.0:LRA=11[out]' % (total, total - 0.6))
    run(['ffmpeg', '-v', 'error', '-y'] + inputs + ['-filter_complex', ';'.join(chains),
                                                      '-map', '[out]', '-ar', '48000', '-ac', '2', out])


def sheet():
    cut = edl()
    print('\n'.join('%-8s %s %.2f' % (k, str(a)[:50], d) for k, a, d, e in cut))
    print('total %.1fs' % sum(d for _, _, d, _ in cut))


if __name__ == '__main__':
    if '--sheet' in sys.argv:
        sheet()
    else:
        build(audio_only='--audio-only' in sys.argv)