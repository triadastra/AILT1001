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
