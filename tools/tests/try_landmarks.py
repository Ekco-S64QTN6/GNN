"""Does MediaPipe's face landmarker find a face on each GNN anchor?

Feasibility only. The question is not whether every point is perfect but
whether it detects at all, and on which species — a Silicoid is a rock and
a Klackon has mandibles where a mouth should be.
"""
import glob, json, os, sys
import numpy as np
from PIL import Image, ImageDraw
import mediapipe as mp
from mediapipe.tasks.python import vision, BaseOptions

MODEL = sys.argv[1]
OUT = sys.argv[2]
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # repo root
A = os.path.join(ROOT, 'assets/generated/anchors')
IDX = {"eyeR_outer": 33, "eyeR_inner": 133, "eyeR_top": 159, "eyeR_bot": 145,
       "eyeL_outer": 263, "eyeL_inner": 362, "eyeL_top": 386, "eyeL_bot": 374,
       "irisR": 468, "irisL": 473,
       "browR_mid": 105, "browL_mid": 334,
       "mouth_R": 61, "mouth_L": 291, "lip_top": 0, "lip_upper_in": 13,
       "lip_lower_in": 14, "lip_bot": 17,
       "nose_tip": 1, "chin": 152, "forehead": 10}

det = vision.FaceLandmarker.create_from_options(
    vision.FaceLandmarkerOptions(base_options=BaseOptions(model_asset_path=MODEL),
                                 num_faces=1))
panels, report = [], {}
for p in sorted(glob.glob(os.path.join(A, '*_desk_hero.png'))):
    sid = os.path.basename(p)[:-len('_desk_hero.png')]
    im = Image.open(p).convert('RGBA')
    flat = Image.new('RGB', im.size, (255, 255, 255))
    flat.paste(im, mask=im.getchannel('A'))
    big = flat.resize((flat.width * 3, flat.height * 3), Image.LANCZOS)
    res = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB,
                              data=np.asarray(big)))
    ok = bool(res.face_landmarks)
    report[sid] = ok
    shot = big.copy()
    d = ImageDraw.Draw(shot)
    if ok:
        lm = res.face_landmarks[0]
        for name, i in IDX.items():
            x, y = lm[i].x * big.width, lm[i].y * big.height
            d.ellipse((x - 5, y - 5, x + 5, y + 5), outline=(255, 0, 255), width=3)
    d.text((8, 8), '%s  %s' % (sid, 'DETECTED' if ok else 'no face'),
           fill=(255, 0, 0) if not ok else (0, 140, 0))
    panels.append(shot.resize((shot.width // 3, shot.height // 3), Image.LANCZOS))

cols = 4
rows = (len(panels) + cols - 1) // cols
cw = max(p.width for p in panels) + 8
ch = max(p.height for p in panels) + 8
sheet = Image.new('RGB', (cw * cols + 8, ch * rows + 8), (40, 44, 50))
for i, p in enumerate(panels):
    sheet.paste(p, (8 + (i % cols) * cw, 8 + (i // cols) * ch))
sheet.save(OUT)
print(json.dumps(report, indent=1))
print('detected %d of %d' % (sum(report.values()), len(report)))
