from PIL import Image,ImageDraw
from pathlib import Path
import numpy as np,json
out=Path('/tmp/hollywood-ar-fixtures');out.mkdir(exist_ok=True)
image=Image.open('dist/assets/poster-tracking-preview.jpg').convert('RGBA');sw,sh=image.size
cases=[('rotated',1600,1200,[(1450,80),(1450,1080),(36,1080),(36,80)]),('front',1200,1800,[(60,65),(1140,65),(1140,1592),(60,1592)]),('tilted',1400,2000,[(130,90),(1300,240),(1200,1890),(170,1820)]),('slanted',1400,2000,[(350,120),(1250,160),(1300,1850),(80,1700)])]
for name,w,h,targets in cases:
 source=[(0,0),(sw,0),(sw,sh),(0,sh)];A=[];b=[]
 for (x,y),(u,v) in zip(targets,source):
  A.extend([[x,y,1,0,0,0,-u*x,-u*y],[0,0,0,x,y,1,-v*x,-v*y]]);b.extend([u,v])
 coeff=np.linalg.solve(np.array(A),np.array(b));canvas=image.transform((w,h),Image.Transform.PERSPECTIVE,coeff,Image.Resampling.BICUBIC,fillcolor=(100,108,105,255));(out/(name+'.rgba')).write_bytes(canvas.tobytes());(out/(name+'.json')).write_text(json.dumps({'width':w,'height':h,'targets':targets}));canvas.convert('RGB').save(out/(name+'.jpg'),quality=90)

# Phone-like acquisition: smaller poster, optical blur and JPEG compression.
from PIL import ImageFilter,ImageEnhance
import io
base=Image.open(out/'front.jpg')
for name,size,blur,quality,brightness in [('phone-small',(800,1200),.45,72,1),('phone-dim',(1000,1500),.6,65,.55)]:
 canvas=base.resize(size,Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(blur))
 canvas=ImageEnhance.Brightness(canvas).enhance(brightness)
 encoded=io.BytesIO();canvas.save(encoded,format='JPEG',quality=quality);encoded.seek(0);canvas=Image.open(encoded).convert('RGBA')
 targets=[(x*size[0]/1200,y*size[1]/1800) for x,y in [(60,65),(1140,65),(1140,1592),(60,1592)]]
 (out/(name+'.rgba')).write_bytes(canvas.tobytes());(out/(name+'.json')).write_text(json.dumps({'width':size[0],'height':size[1],'targets':targets}));canvas.convert('RGB').save(out/(name+'.jpg'))

# Negative control: same dense poster artwork, all four corner codes removed.
no_markers=image.copy();draw=ImageDraw.Draw(no_markers)
for x,y in [(8,8),(1594,8),(1594,2290),(8,2290)]:
 draw.rectangle((x/1682*sw,y/2378*sh,(x+80)/1682*sw,(y+80)/2378*sh),fill=(245,239,223,255))
(out/'no-markers.rgba').write_bytes(no_markers.tobytes());(out/'no-markers.json').write_text(json.dumps({'width':sw,'height':sh}))

# Natural-feature cases: corner markers cut off, steep angles, rotation, noise.
import math,random
def perspective(name,w,h,targets,src=image,post=None,background=(100,108,105,255)):
 source=[(0,0),(sw,0),(sw,sh),(0,sh)];A=[];b=[]
 for (x,y),(u,v) in zip(targets,source):
  A.extend([[x,y,1,0,0,0,-u*x,-u*y],[0,0,0,x,y,1,-v*x,-v*y]]);b.extend([u,v])
 coeff=np.linalg.solve(np.array(A),np.array(b));canvas=src.transform((w,h),Image.Transform.PERSPECTIVE,coeff,Image.Resampling.BICUBIC,fillcolor=background)
 if post:canvas=post(canvas)
 (out/(name+'.rgba')).write_bytes(canvas.convert('RGBA').tobytes());(out/(name+'.json')).write_text(json.dumps({'width':w,'height':h,'targets':[list(map(float,t)) for t in targets]}));canvas.convert('RGB').save(out/(name+'.jpg'),quality=88)
def rot(cx,cy,w,h,deg):
 t=math.radians(deg);c,s=math.cos(t),math.sin(t)
 return [(cx+c*x-s*y,cy+s*x+c*y) for x,y in [(-w/2,-h/2),(w/2,-h/2),(w/2,h/2),(-w/2,h/2)]]
def phone(blur,brightness,noise,quality,seed):
 def f(c):
  c=c.convert('RGB').filter(ImageFilter.GaussianBlur(blur));c=ImageEnhance.Brightness(c).enhance(brightness)
  a=np.asarray(c).astype(np.float32);a+=np.random.default_rng(seed).normal(0,noise,a.shape);c=Image.fromarray(np.clip(a,0,255).astype(np.uint8))
  e=io.BytesIO();c.save(e,format='JPEG',quality=quality);e.seek(0);return Image.open(e).convert('RGBA')
 return f
# Close-up: only the middle of the poster is visible, none of the four markers.
perspective('closeup-no-corners',1080,1440,[(-700,-420),(1780,-380),(1820,3100),(-760,3040)],post=phone(.8,.9,4,80,1))
# Steep viewing angle from the left side.
perspective('steep-side',1440,1080,[(330,40),(1060,210),(1050,890),(340,1050)],post=phone(.7,1,3,80,2))
# Phone held at 30 degrees, poster smaller in a cluttered dim room.
perspective('rotated-30-dim',1080,1920,rot(540,960,620,877,30),post=phone(1.1,.6,6,70,3),background=(60,52,44,255))
# Far away: poster is small in the frame.
perspective('far-small',1920,1080,[(810,300),(1110,300),(1110,724),(810,724)],post=phone(.6,1,3,82,4))
# Negative controls: unrelated film still and plain texture must never lock.
wan=Image.open('dist/assets/wan-frame.jpg').convert('RGBA').resize((1280,720))
(out/'unrelated.rgba').write_bytes(wan.tobytes());(out/'unrelated.json').write_text(json.dumps({'width':1280,'height':720}))
noise=Image.fromarray(np.random.default_rng(9).integers(0,255,(960,720,3),dtype=np.uint8)).filter(ImageFilter.GaussianBlur(1.5)).convert('RGBA')
(out/'noise.rgba').write_bytes(noise.tobytes());(out/'noise.json').write_text(json.dumps({'width':720,'height':960}))
