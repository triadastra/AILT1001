# A hand-held "walk up to the poster" camera sequence for the frame-to-frame tracker (tests/flow.test.cjs).
# Writes greyscale frames with the true poster corners; pass a path to also write a .y4m clip for Chromium's fake camera:
#   python3 tests/make-sequence.py /tmp/poster-walk.y4m
from PIL import Image
from pathlib import Path
import numpy as np,json,math,sys
out=Path('/tmp/hollywood-ar-fixtures');out.mkdir(exist_ok=True)
W,H,N=720,1280,120
poster=Image.open('dist/assets/poster-tracking-preview.jpg').convert('RGB');poster=poster.resize((1200,round(1200*poster.height/poster.width)),Image.Resampling.LANCZOS);sw,sh=poster.size
rng=np.random.default_rng(7);ease=lambda t:t*t*(3-2*t)
def corners(i):
 t=i/(N-1);z=ease(min(1,max(0,(t-.3)/.4)))          # 0: whole poster, 1: close on the Text column
 k=(.86+.04*math.sin(t*9))*(1-z)+2.5*z;ph=k*H;pw=ph*1682/2378
 ax,ay=.5+(.155-.5)*z,.5+(.236-.5)*z                   # poster point held near the middle of the frame
 cx=W/2+14*math.sin(t*23)+6*math.sin(t*61);cy=H*.47+11*math.cos(t*19)+5*math.sin(t*47);a=math.radians(1.6*math.sin(t*13));tilt=.035*math.sin(t*7)
 pts=[]
 for x,y in [(0,0),(1,0),(1,1),(0,1)]:
  dx,dy=(x-ax)*pw*(1+tilt*(1-2*y)),(y-ay)*ph;pts.append((cx+dx*math.cos(a)-dy*math.sin(a),cy+dx*math.sin(a)+dy*math.cos(a)))
 return pts
def render(i):
 targets=corners(i);A=[];b=[]
 for (x,y),(u,v) in zip(targets,[(0,0),(sw,0),(sw,sh),(0,sh)]):
  A.extend([[x,y,1,0,0,0,-u*x,-u*y],[0,0,0,x,y,1,-v*x,-v*y]]);b.extend([u,v])
 frame=poster.transform((W,H),Image.Transform.PERSPECTIVE,np.linalg.solve(np.array(A),np.array(b)),Image.Resampling.BILINEAR,fillcolor=(100,108,105))
 a=np.asarray(frame,dtype=np.float32)*(1+.03*math.sin(i*.4))+rng.normal(0,3,(H,W,1));return np.clip(a,0,255).astype(np.uint8),targets
y4m=open(sys.argv[1],'wb') if len(sys.argv)>1 else None
if y4m:y4m.write(b'YUV4MPEG2 W%d H%d F30:1 Ip A1:1 C420jpeg\n'%(W,H))
gray=open(out/'walk.gray','wb');truth=[]
for i in range(N):
 rgb,targets=render(i);truth.append([list(map(float,p)) for p in targets])
 yuv=np.asarray(Image.fromarray(rgb).convert('YCbCr'));gray.write(yuv[:,:,0].tobytes())
 if y4m:y4m.write(b'FRAME\n'+yuv[:,:,0].tobytes()+yuv[::2,::2,1].tobytes()+yuv[::2,::2,2].tobytes())
(out/'walk.json').write_text(json.dumps({'width':W,'height':H,'frames':N,'targets':truth}))
