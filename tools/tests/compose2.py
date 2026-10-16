import os, sys
from PIL import Image, ImageDraw
ROOT='/home/ekco/github/GNN'
W,H=1280,720
casth, line, sep = float(sys.argv[1]), float(sys.argv[2]), float(sys.argv[3])
out=sys.argv[4]
bg=Image.open(ROOT+'/assets/generated/set/studio_wide_empty.png').convert('RGBA').resize((W,H),Image.LANCZOS)
seats=[0.5-sep/2, 0.5+sep/2]
plates=['assets/generated/anchors/human_desk_hero.png',
        'assets/generated/anchors/mrrshan_f_listening.png']
h=casth*H
span=[]
for sx,p in zip(seats,plates):
    im=Image.open(os.path.join(ROOT,p)).convert('RGBA')
    w=round(im.width*h/im.height)
    im=im.resize((w,round(h)),Image.LANCZOS)
    x=round(sx*W-w/2); bg.alpha_composite(im,(x,round(line*H-h)))
    span += [x, x+w]
d=ImageDraw.Draw(bg)
# the desk's seating edge, as marked on the screenshot
d.line([(0.244*W,0.435*H),(0.764*W,0.435*H)],fill=(255,80,80),width=2)
d.line([(0.244*W,0.468*H),(0.764*W,0.468*H)],fill=(255,80,80),width=2)
pair=max(span)-min(span); desk=(0.764-0.244)*W
d.text((10,10),'CAST.h %.3f  line %.3f  sep %.2f   pair %dpx = %.0f%% of desk'
       % (casth,line,sep,pair,100*pair/desk), fill=(255,255,0))
bg.convert('RGB').save(out)
print('%s  pair %d (%.0f%% of desk)' % (os.path.basename(out),pair,100*pair/desk))
