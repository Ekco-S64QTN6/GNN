import os, sys
from PIL import Image, ImageDraw
S = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # repo root
A = os.path.join(ROOT, 'assets/generated/anchors')
RAW = os.path.join(S, 'anchors_before')

def norm(im, h=300):
    s = h / float(im.height)
    im = im.resize((max(1, round(im.width*s)), h), Image.LANCZOS)
    return im

def sheet(names, out):
    panels = []
    for n in names:
        r = os.path.join(RAW, n+'.png')
        c = os.path.join(A, n+'.png')
        if os.path.exists(r):
            panels.append(('RAW '+n, norm(Image.open(r).convert('RGBA'))))
        panels.append(('TOOL '+n, norm(Image.open(c).convert('RGBA'))))
    w = sum(i.width+12 for _, i in panels)+12
    h = max(i.height for _, i in panels)+30
    bg = Image.new('RGBA', (w, h), (70, 78, 86, 255))
    d = ImageDraw.Draw(bg); x = 12
    for l, i in panels:
        bg.alpha_composite(i, (x, 24)); d.text((x, 6), l, fill=(255,255,255))
        x += i.width+12
    bg.convert('RGB').save(out); print(out, bg.size)

sheet(['mrrshan_f_speaking', 'mrrshan_f_desk_hero'], os.path.join(S, 'cmp_mrrshan.png'))
sheet(['klackon_listening', 'klackon_listening_flip'], os.path.join(S, 'cmp_klackon.png'))
sheet(['human_listening', 'human_listening_flip', 'human_speaking'], os.path.join(S, 'cmp_human.png'))
