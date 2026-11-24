/* Natural-feature poster tracking.
 * FAST-9 corners + oriented binary (rBRIEF-style) descriptors, matched against
 * ~2000 reference points extracted from the printed poster, then a RANSAC
 * homography. Shared by the browser worker, the reference builder and tests. */
(function(root){'use strict';
const W=1682,H=2378;            // poster units, identical to planar-tracking.js
const BITS=256,WORDS=8,ANGLES=32,BORDER=17,ORIENT_R=15;

// ---------- deterministic sampling pattern ----------
function rng(seed){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
const PATTERN=(()=>{const r=rng(0x5eed),p=new Int8Array(BITS*4),gauss=()=>{let v;do{const a=Math.max(1e-9,r()),b=r();v=Math.sqrt(-2*Math.log(a))*Math.cos(2*Math.PI*b)*6.2;}while(Math.abs(v)>12.5);return Math.round(v);};
  for(let i=0;i<BITS;i++){let x1,y1,x2,y2;do{x1=gauss();y1=gauss();x2=gauss();y2=gauss();}while((x1===x2&&y1===y2)||x1*x1+y1*y1>156||x2*x2+y2*y2>156);p.set([x1,y1,x2,y2],i*4);}return p;})();
const ROTATED=(()=>{const out=new Int8Array(ANGLES*BITS*4);for(let a=0;a<ANGLES;a++){const t=a*2*Math.PI/ANGLES,c=Math.cos(t),s=Math.sin(t);for(let i=0;i<BITS*4;i+=2){const x=PATTERN[i],y=PATTERN[i+1];out[a*BITS*4+i]=Math.round(c*x-s*y);out[a*BITS*4+i+1]=Math.round(s*x+c*y);}}return out;})();
const UMAX=(()=>{const u=[];for(let v=0;v<=ORIENT_R;v++)u.push(Math.floor(Math.sqrt(ORIENT_R*ORIENT_R-v*v)));return u;})();
const CIRCLE=[[0,-3],[1,-3],[2,-2],[3,-1],[3,0],[3,1],[2,2],[1,3],[0,3],[-1,3],[-2,2],[-3,1],[-3,0],[-3,-1],[-2,-2],[-1,-3]];

// ---------- image helpers ----------
function toGray(rgba,width,height){const g=new Uint8Array(width*height);for(let i=0,j=0;i<g.length;i++,j+=4)g[i]=(rgba[j]*77+rgba[j+1]*150+rgba[j+2]*29)>>8;return g;}
// Area-average resize (downscale) using an integral image.
function resize(gray,width,height,nw,nh){if(nw===width&&nh===height)return gray.slice();const iw=width+1,I=new Float64Array(iw*(height+1));for(let y=0;y<height;y++){let row=0;for(let x=0;x<width;x++){row+=gray[y*width+x];I[(y+1)*iw+x+1]=I[y*iw+x+1]+row;}}
  const out=new Uint8Array(nw*nh),sx=width/nw,sy=height/nh;for(let y=0;y<nh;y++){const y0=Math.floor(y*sy),y1=Math.max(y0+1,Math.min(height,Math.floor((y+1)*sy)));for(let x=0;x<nw;x++){const x0=Math.floor(x*sx),x1=Math.max(x0+1,Math.min(width,Math.floor((x+1)*sx)));const sum=I[y1*iw+x1]-I[y0*iw+x1]-I[y1*iw+x0]+I[y0*iw+x0];out[y*nw+x]=sum/((x1-x0)*(y1-y0));}}return out;}
// Separable binomial blur (sigma ~1.4) so descriptors tolerate noise, JPEG and print texture.
function blur(gray,width,height){const k=[1,8,28,56,70,56,28,8,1],tmp=new Uint16Array(width*height),out=new Uint8Array(width*height);
  for(let y=0;y<height;y++){const o=y*width;for(let x=0;x<width;x++){let s=0;for(let i=-4;i<=4;i++){const xx=x+i<0?0:x+i>=width?width-1:x+i;s+=k[i+4]*gray[o+xx];}tmp[o+x]=s>>4;}}
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){let s=0;for(let i=-4;i<=4;i++){const yy=y+i<0?0:y+i>=height?height-1:y+i;s+=k[i+4]*tmp[yy*width+x];}out[y*width+x]=s>>12;}return out;}

// ---------- FAST-9 detector with score + 3x3 non-maximum suppression ----------
function fast(gray,width,height,threshold){const offs=CIRCLE.map(([x,y])=>y*width+x),score=new Float32Array(width*height),cand=[];
  for(let y=BORDER;y<height-BORDER;y++)for(let x=BORDER;x<width-BORDER;x++){const p=y*width+x,c=gray[p],hi=c+threshold,lo=c-threshold;
    const a=gray[p+offs[0]],b=gray[p+offs[4]],d=gray[p+offs[8]],e=gray[p+offs[12]];
    if(((a>hi)+(b>hi)+(d>hi)+(e>hi))<2&&((a<lo)+(b<lo)+(d<lo)+(e<lo))<2)continue;
    let best=0;for(const bright of [true,false]){let run=0,max=0;for(let i=0;i<25;i++){const v=gray[p+offs[i&15]];if(bright?v>hi:v<lo){if(++run>max)max=run;}else run=0;}
      if(max>=9){let s=0;for(let i=0;i<16;i++){const dv=bright?gray[p+offs[i]]-hi:lo-gray[p+offs[i]];if(dv>0)s+=dv;}if(s>best)best=s;}}
    if(best>0){score[p]=best;cand.push(p);}}
  const kps=[];for(const p of cand){const s=score[p];if(s<score[p-1]||s<=score[p+1]||s<score[p-width-1]||s<score[p-width]||s<score[p-width+1]||s<=score[p+width-1]||s<=score[p+width]||s<=score[p+width+1])continue;kps.push({x:p%width,y:(p/width)|0,score:s});}return kps;}

// Keep the strongest corners in every grid cell so features cover the whole poster.
function bucket(kps,width,height,limit,cols,rows){const cells=Array.from({length:cols*rows},()=>[]);for(const k of kps){const c=Math.min(cols-1,(k.x*cols/width)|0)+Math.min(rows-1,(k.y*rows/height)|0)*cols;cells[c].push(k);}
  const per=Math.ceil(limit/(cols*rows)),keep=[],rest=[];for(const cell of cells){cell.sort((a,b)=>b.score-a.score);keep.push(...cell.slice(0,per));rest.push(...cell.slice(per));}
  if(keep.length>limit){keep.sort((a,b)=>b.score-a.score);return keep.slice(0,limit);}rest.sort((a,b)=>b.score-a.score);return keep.concat(rest.slice(0,limit-keep.length));}

function orientation(gray,width,x,y){let m01=0,m10=0;const c=y*width+x;for(let u=-ORIENT_R;u<=ORIENT_R;u++)m10+=u*gray[c+u];
  for(let v=1;v<=ORIENT_R;v++){let sum=0;const d=UMAX[v];for(let u=-d;u<=d;u++){const top=gray[c+u-v*width],bottom=gray[c+u+v*width];sum+=bottom-top;m10+=u*(top+bottom);}m01+=v*sum;}return Math.atan2(m01,m10);}

function describe(smooth,width,kps,out,offset){for(let n=0;n<kps.length;n++){const k=kps[n];let a=Math.round(k.angle/(2*Math.PI)*ANGLES)%ANGLES;if(a<0)a+=ANGLES;const pat=a*BITS*4,c=k.y*width+k.x,base=(offset+n)*WORDS;
  for(let w=0;w<WORDS;w++){let word=0;for(let b=0;b<32;b++){const i=pat+(w*32+b)*4;if(smooth[c+ROTATED[i+1]*width+ROTATED[i]]<smooth[c+ROTATED[i+3]*width+ROTATED[i+2]])word|=1<<b;}out[base+w]=word;}}}

// Detect and describe up to `limit` features of a greyscale image.
function extract(gray,width,height,limit,opts={}){let threshold=opts.threshold||18,kps=fast(gray,width,height,threshold);
  while(kps.length<limit*1.2&&threshold>7){threshold=Math.round(threshold*.65);kps=fast(gray,width,height,threshold);}
  kps=bucket(kps,width,height,limit,opts.cols||12,opts.rows||12);const smooth=blur(gray,width,height);for(const k of kps)k.angle=orientation(smooth,width,k.x,k.y);
  const desc=new Int32Array(kps.length*WORDS);describe(smooth,width,kps,desc,0);return {width,height,count:kps.length,x:Float32Array.from(kps,k=>k.x),y:Float32Array.from(kps,k=>k.y),desc,threshold};}

function popcount(v){v=v-((v>>>1)&0x55555555);v=(v&0x33333333)+((v>>>2)&0x33333333);return Math.imul((v+(v>>>4))&0x0F0F0F0F,0x01010101)>>>24;}
function hamming(a,ai,b,bi){let d=0;for(let w=0;w<WORDS;w++)d+=popcount(a[ai*WORDS+w]^b[bi*WORDS+w]);return d;}

// ---------- reference set ----------
// Reference poster rendered at several print-to-camera scales; ~2000 points in total.
const LEVELS=[960,720,540,405,304,228],BUDGET=[400,380,360,320,290,250];
function buildReference(gray,width,height,total=2000){const parts=[];let remaining=total;LEVELS.forEach((lh,i)=>{const lw=Math.round(lh*W/H),img=resize(gray,width,height,lw,lh);const want=i===LEVELS.length-1?remaining:Math.round(BUDGET[i]*total/2000);
    const f=extract(img,lw,lh,want,{cols:10,rows:14});remaining-=f.count;parts.push({level:i,f,sx:W/lw,sy:H/lh});});
  const count=parts.reduce((a,p)=>a+p.f.count,0),ref={count,x:new Float32Array(count),y:new Float32Array(count),level:new Uint8Array(count),desc:new Int32Array(count*WORDS)};let o=0;
  for(const p of parts){for(let i=0;i<p.f.count;i++){ref.x[o+i]=p.f.x[i]*p.sx;ref.y[o+i]=p.f.y[i]*p.sy;ref.level[o+i]=p.level;}ref.desc.set(p.f.desc,o*WORDS);o+=p.f.count;}return ref;}
// Binary file: "PFT1", uint32 count, then per point float32 x, float32 y, uint8 level, 3 pad, 8 x int32 descriptor.
function serialize(ref){const buf=new ArrayBuffer(8+ref.count*44),v=new DataView(buf);v.setUint32(0,0x31544650,true);v.setUint32(4,ref.count,true);for(let i=0;i<ref.count;i++){const o=8+i*44;v.setFloat32(o,ref.x[i],true);v.setFloat32(o+4,ref.y[i],true);v.setUint8(o+8,ref.level[i]);for(let w=0;w<WORDS;w++)v.setInt32(o+12+w*4,ref.desc[i*WORDS+w],true);}return buf;}
function deserialize(buf){const v=new DataView(buf);if(v.getUint32(0,true)!==0x31544650)throw new Error('Not a poster feature file');const count=v.getUint32(4,true),ref={count,x:new Float32Array(count),y:new Float32Array(count),level:new Uint8Array(count),desc:new Int32Array(count*WORDS)};
  for(let i=0;i<count;i++){const o=8+i*44;ref.x[i]=v.getFloat32(o,true);ref.y[i]=v.getFloat32(o+4,true);ref.level[i]=v.getUint8(o+8);for(let w=0;w<WORDS;w++)ref.desc[i*WORDS+w]=v.getInt32(o+12+w*4,true);}return ref;}

// ---------- geometry ----------
function solve8(A,b){const n=8,M=A.map((r,i)=>[...r,b[i]]);for(let i=0;i<n;i++){let p=i;for(let j=i+1;j<n;j++)if(Math.abs(M[j][i])>Math.abs(M[p][i]))p=j;if(Math.abs(M[p][i])<1e-12)return null;[M[i],M[p]]=[M[p],M[i]];const d=M[i][i];for(let k=i;k<=n;k++)M[i][k]/=d;for(let j=0;j<n;j++){if(j===i)continue;const f=M[j][i];if(f)for(let k=i;k<=n;k++)M[j][k]-=f*M[i][k];}}return M.map(r=>r[n]);}
// Least-squares homography from normalised poster (x,y in 0..1) to frame pixels (u,v).
function homography(px,py,pu,pv,idx){const AtA=Array.from({length:8},()=>new Array(8).fill(0)),Atb=new Array(8).fill(0),row=new Array(8);
  for(const i of idx){const x=px[i],y=py[i],u=pu[i],v=pv[i];row[0]=x;row[1]=y;row[2]=1;row[3]=0;row[4]=0;row[5]=0;row[6]=-u*x;row[7]=-u*y;acc(u);row[0]=0;row[1]=0;row[2]=0;row[3]=x;row[4]=y;row[5]=1;row[6]=-v*x;row[7]=-v*y;acc(v);}
  function acc(t){for(let j=0;j<8;j++){if(!row[j])continue;Atb[j]+=row[j]*t;for(let k=0;k<8;k++)AtA[j][k]+=row[j]*row[k];}}return solve8(AtA,Atb);}
function apply(h,x,y){const d=h[6]*x+h[7]*y+1;return [(h[0]*x+h[1]*y+h[2])/d,(h[3]*x+h[4]*y+h[5])/d,d];}
function cross(o,a,b){return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);}
// The projected poster must stay a convex, sensibly proportioned quadrilateral.
function plausible(h,width,height){const c=[[0,0],[1,0],[1,1],[0,1]].map(([x,y])=>apply(h,x,y));if(c.some(p=>!(p[2]>0)||!Number.isFinite(p[0])||!Number.isFinite(p[1])))return false;
  let sign=0;for(let i=0;i<4;i++){const s=Math.sign(cross(c[i],c[(i+1)%4],c[(i+2)%4]));if(!s||(sign&&s!==sign))return false;sign=s;}if(sign<0)return false; // mirror images are not the poster
  const len=i=>Math.hypot(c[(i+1)%4][0]-c[i][0],c[(i+1)%4][1]-c[i][1]),L=[0,1,2,3].map(len);if(Math.max(L[0],L[2])/Math.min(L[0],L[2])>3.5||Math.max(L[1],L[3])/Math.min(L[1],L[3])>3.5)return false;
  const aspect=(L[1]+L[3])/(L[0]+L[2]);if(aspect<.55||aspect>3.2)return false;const area=Math.abs(c.reduce((a,p,i)=>a+p[0]*c[(i+1)%4][1]-p[1]*c[(i+1)%4][0],0)/2)/(width*height);
  return area>.012&&area<25&&c.every(p=>p[0]>-2.5*width&&p[0]<3.5*width&&p[1]>-2.5*height&&p[1]<3.5*height);}

function ransac(m,width,height,opts){const n=m.u.length,threshold=opts.threshold,t2=threshold*threshold,random=rng(opts.seed||7),maxIter=opts.iterations||800;let best=null,bestCount=0;if(n<4)return null;
  const inliersOf=h=>{const idx=[];for(let i=0;i<n;i++){const d=h[6]*m.x[i]+h[7]*m.y[i]+1;if(d<=0)continue;const du=(h[0]*m.x[i]+h[1]*m.y[i]+h[2])/d-m.u[i],dv=(h[3]*m.x[i]+h[4]*m.y[i]+h[5])/d-m.v[i];if(du*du+dv*dv<t2)idx.push(i);}return idx;};
  // Better matches (lower Hamming distance) are sampled more often in early iterations.
  const order=Array.from({length:n},(_,i)=>i).sort((a,b)=>m.d[a]-m.d[b]);let iter=0,needed=maxIter;
  if(opts.prior&&plausible(opts.prior,width,height)){const idx=inliersOf(opts.prior);if(idx.length>=4){best=opts.prior;bestCount=idx.length;}}
  while(iter<Math.min(needed,maxIter)){iter++;const pool=Math.min(n,Math.max(12,Math.round(n*Math.min(1,.15+iter/200))));const s=[];while(s.length<4){const k=order[(random()*pool)|0];if(!s.includes(k))s.push(k);}
    // reject nearly collinear samples in poster space
    let degenerate=false;for(let a=0;a<4&&!degenerate;a++)for(let b=a+1;b<4&&!degenerate;b++)for(let c=b+1;c<4;c++){if(Math.abs(cross([m.x[s[a]],m.y[s[a]]],[m.x[s[b]],m.y[s[b]]],[m.x[s[c]],m.y[s[c]]]))<4e-4){degenerate=true;break;}}if(degenerate)continue;
    const h=homography(m.x,m.y,m.u,m.v,s);if(!h||!plausible(h,width,height))continue;let count=0;for(let i=0;i<n;i++){const d=h[6]*m.x[i]+h[7]*m.y[i]+1;if(d<=0)continue;const du=(h[0]*m.x[i]+h[1]*m.y[i]+h[2])/d-m.u[i],dv=(h[3]*m.x[i]+h[4]*m.y[i]+h[5])/d-m.v[i];if(du*du+dv*dv<t2)count++;}
    if(count>bestCount){bestCount=count;best=h;const w=count/n;needed=Math.ceil(Math.log(.002)/Math.log(Math.max(1e-9,1-w*w*w*w)))+10;}}
  if(!best)return null;let idx=inliersOf(best),h=best;
  for(let r=0;r<3;r++){const refined=homography(m.x,m.y,m.u,m.v,idx);if(!refined||!plausible(refined,width,height))break;const next=inliersOf(refined);if(next.length<idx.length)break;h=refined;idx=next;}
  let err=0;for(const i of idx){const p=apply(h,m.x[i],m.y[i]);err+=(p[0]-m.u[i])**2+(p[1]-m.v[i])**2;}return {h,inliers:idx,error:Math.sqrt(err/Math.max(1,idx.length)),iterations:iter};}

// ---------- matching ----------
function globalMatches(ref,frame){const x=[],y=[],u=[],v=[],d=[],fi=[];const R=ref.desc,F=frame.desc;
  for(let i=0;i<frame.count;i++){let b1=999,b2=999,j1=-1;const fo=i*WORDS,f0=F[fo],f1=F[fo+1],f2=F[fo+2],f3=F[fo+3],f4=F[fo+4],f5=F[fo+5],f6=F[fo+6],f7=F[fo+7];
    for(let j=0,ro=0;j<ref.count;j++,ro+=WORDS){let dist=popcount(f0^R[ro])+popcount(f1^R[ro+1])+popcount(f2^R[ro+2])+popcount(f3^R[ro+3]);if(dist>=b2)continue;dist+=popcount(f4^R[ro+4])+popcount(f5^R[ro+5])+popcount(f6^R[ro+6])+popcount(f7^R[ro+7]);if(dist>=b2)continue;
      // The same printed detail exists at several reference scales: only a *different* location counts as a rival.
      if(dist<b1){if(j1<0||Math.abs(ref.x[j]-ref.x[j1])>24||Math.abs(ref.y[j]-ref.y[j1])>24)b2=b1;b1=dist;j1=j;}else if(Math.abs(ref.x[j]-ref.x[j1])>24||Math.abs(ref.y[j]-ref.y[j1])>24)b2=dist;}
    if(j1>=0&&b1<=72&&b1<.82*b2){x.push(ref.x[j1]/W);y.push(ref.y[j1]/H);u.push(frame.x[i]);v.push(frame.y[i]);d.push(b1);fi.push(i);}}
  return {x,y,u,v,d,fi};}
// With a recent pose, only compare features near where each reference point should appear.
function guidedMatches(ref,frame,h,radius){const cell=Math.max(8,radius),cols=Math.ceil(frame.width/cell),rows=Math.ceil(frame.height/cell),grid=Array.from({length:cols*rows},()=>[]);
  for(let i=0;i<frame.count;i++)grid[Math.min(cols-1,(frame.x[i]/cell)|0)+Math.min(rows-1,(frame.y[i]/cell)|0)*cols].push(i);
  const top=apply(h,.5,0),bottom=apply(h,.5,1),posterHeight=Math.hypot(bottom[0]-top[0],bottom[1]-top[1]);
  const useLevel=LEVELS.map(l=>Math.abs(Math.log(l/posterHeight))<Math.log(1.75));if(!useLevel.some(Boolean))useLevel[posterHeight>LEVELS[0]?0:LEVELS.length-1]=true;
  const bestFor=new Map(),r2=radius*radius;
  for(let j=0;j<ref.count;j++){if(!useLevel[ref.level[j]])continue;const p=apply(h,ref.x[j]/W,ref.y[j]/H);if(p[0]<0||p[1]<0||p[0]>=frame.width||p[1]>=frame.height)continue;
    const cx=(p[0]/cell)|0,cy=(p[1]/cell)|0;let best=999,second=999,bi=-1;
    for(let gy=Math.max(0,cy-1);gy<=Math.min(rows-1,cy+1);gy++)for(let gx=Math.max(0,cx-1);gx<=Math.min(cols-1,cx+1);gx++)for(const i of grid[gy*cols+gx]){const dx=frame.x[i]-p[0],dy=frame.y[i]-p[1];if(dx*dx+dy*dy>r2)continue;const dist=hamming(frame.desc,i,ref.desc,j);if(dist<best){second=best;best=dist;bi=i;}else if(dist<second)second=dist;}
    if(bi<0||best>80||best>=.92*second)continue;const prev=bestFor.get(bi);if(!prev||best<prev.d)bestFor.set(bi,{j,d:best});}
  const x=[],y=[],u=[],v=[],d=[],fi=[];for(const [i,{j,d:dist}] of bestFor){x.push(ref.x[j]/W);y.push(ref.y[j]/H);u.push(frame.x[i]);v.push(frame.y[i]);d.push(dist);fi.push(i);}return {x,y,u,v,d,fi};}

// ---------- tracker ----------
const MIN_INLIERS=20,SEARCH_SIZES=[800,1200,440],TARGET_POSTER=620;
function createTracker(ref){let prior=null,miss=0,posterHeight=0,attempt=0;
  // Pick a processing size that makes the poster appear at a reference scale:
  // close-ups are shrunk, distant posters keep more resolution.
  function processingSize(width,height){const long=Math.max(width,height);if(prior&&posterHeight>0)return Math.max(360,Math.min(1280,long,Math.round(long*TARGET_POSTER/posterHeight)));return Math.min(long,SEARCH_SIZES[attempt%SEARCH_SIZES.length]);}
  // opts.exact: the frame was already captured at its processing size (ar-camera.js), so it is used as it is.
  function locate(gray,width,height,opts={}){const size=opts.exact?Math.max(width,height):processingSize(width,height),scale=Math.min(1,size/Math.max(width,height)),sw=Math.round(width*scale),sh=Math.round(height*scale),small=scale<1?resize(gray,width,height,sw,sh):gray;
    const frame=extract(small,sw,sh,900,{cols:12,rows:12}),threshold=Math.max(3,Math.max(sw,sh)*.006);let result=null,mode='search';
    if(prior){const pix=toPixels(prior,sw,sh),m=guidedMatches(ref,frame,pix,Math.max(18,Math.max(sw,sh)*.045));const r=ransac(m,sw,sh,{threshold,iterations:250,prior:pix});if(r&&r.inliers.length>=MIN_INLIERS&&r.inliers.length>=m.u.length*.25){result={r,m};mode='track';}}
    if(!result){const m=globalMatches(ref,frame),r=ransac(m,sw,sh,{threshold,iterations:1500});if(r&&r.inliers.length>=MIN_INLIERS&&r.inliers.length>=m.u.length*.12)result={r,m};}
    if(!result){attempt++;if(++miss>1){prior=null;posterHeight=0;}return {locked:false,method:'features',count:0,features:frame.count,reason:'features'};}
    miss=0;const h=toNormalised(result.r.h,sw,sh);prior=h;const top=apply(h,.5,0),bottom=apply(h,.5,1);posterHeight=Math.hypot((bottom[0]-top[0])*width,(bottom[1]-top[1])*height);
    const pts=[];const step=Math.max(1,Math.ceil(result.r.inliers.length/160));for(let k=0;k<result.r.inliers.length;k+=step){const i=result.r.inliers[k];pts.push(+(result.m.u[i]/sw).toFixed(4),+(result.m.v[i]/sh).toFixed(4));}
    return {locked:true,method:'features',mode,h,count:result.r.inliers.length,matches:result.m.u.length,features:frame.count,processed:[sw,sh],error:result.r.error/scale,points:pts,corners:[[0,0],[1,0],[1,1],[0,1]].map(([x,y])=>{const p=apply(h,x,y);return {x:p[0],y:p[1]};})};}
  return {locate,seed(h){prior=h;miss=0;posterHeight=0;},hint(h){prior=h;miss=0;},reset(){prior=null;miss=0;posterHeight=0;},reference:ref};}
// Pixel homography <-> the normalised form used by PosterTracking (poster 0..1 -> frame 0..1).
function toNormalised(h,width,height){return [h[0]/width,h[1]/width,h[2]/width,h[3]/height,h[4]/height,h[5]/height,h[6],h[7]];}
function toPixels(h,width,height){return [h[0]*width,h[1]*width,h[2]*width,h[3]*height,h[4]*height,h[5]*height,h[6],h[7]];}

root.PosterFeatures={toNormalised,toPixels,apply,extract,buildReference,serialize,deserialize,createTracker,toGray,resize,ransac,globalMatches,plausible,hamming,LEVELS,width:W,height:H};if(typeof module!=='undefined')module.exports=root.PosterFeatures;
})(typeof self!=='undefined'?self:globalThis);
