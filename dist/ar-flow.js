/* Frame-to-frame poster tracking (pyramidal Lucas-Kanade).
 * The feature tracker in ar-features.js finds the poster from nothing, but it is too slow to run on every
 * camera frame on a phone. Between its results, this follows a grid of points on the poster from one small
 * greyscale frame to the next and refits the poster's homography, which costs a few milliseconds.
 * Shared by the browser worker (ar-flow-worker.js) and the tests. */
(function(root){'use strict';
const F=root.PosterFeatures||(typeof require!=='undefined'?require('./ar-features.js'):null);
const R=4,N=2*R+1,T=N+2,LEVELS=3,MAX_RESIDUAL=14,MIN_TEXTURE=9;
const tpl=new Float32Array(T*T),cur=new Float32Array(N*N),ix=new Float32Array(N*N),iy=new Float32Array(N*N);

function pyramid(gray,w,h){const L=[{d:gray,w,h}];for(let l=1;l<LEVELS;l++){const p=L[l-1],nw=p.w>>1,nh=p.h>>1,d=new Uint8Array(nw*nh);
  for(let y=0;y<nh;y++){const o=2*y*p.w;for(let x=0;x<nw;x++){const i=o+2*x;d[y*nw+x]=(p.d[i]+p.d[i+1]+p.d[i+p.w]+p.d[i+p.w+1]+2)>>2;}}L.push({d,w:nw,h:nh});}return L;}
// Bilinear patch of (2r+1)^2 values centred on (x,y); false when it leaves the image.
function patch(img,x,y,r,out){const x0=Math.floor(x)-r,y0=Math.floor(y)-r,n=2*r+1;if(x0<0||y0<0||x0+n+1>=img.w||y0+n+1>=img.h)return false;
  const fx=x-Math.floor(x),fy=y-Math.floor(y),a=(1-fx)*(1-fy),b=fx*(1-fy),c=(1-fx)*fy,e=fx*fy,d=img.d,w=img.w;
  for(let j=0,k=0;j<n;j++){let i=(y0+j)*w+x0;for(let q=0;q<n;q++,i++,k++)out[k]=a*d[i]+b*d[i+1]+c*d[i+w]+e*d[i+w+1];}return true;}
// Follow the point (x,y) of the previous frame into the current one, coarse to fine. Returns [x,y] or null.
function follow(P,Q,x,y){let dx=0,dy=0;
  for(let l=LEVELS-1;l>=0;l--){const s=1/(1<<l),px=x*s,py=y*s;if(!patch(P[l],px,py,R+1,tpl)){if(l)continue;return null;}
    let gxx=0,gxy=0,gyy=0,mt=0;for(let j=0,k=0;j<N;j++)for(let i=0;i<N;i++,k++){const c=(j+1)*T+i+1,gx=(tpl[c+1]-tpl[c-1])*.5,gy=(tpl[c+T]-tpl[c-T])*.5;ix[k]=gx;iy[k]=gy;gxx+=gx*gx;gxy+=gx*gy;gyy+=gy*gy;mt+=tpl[c];}
    mt/=N*N;const det=gxx*gyy-gxy*gxy,texture=(gxx+gyy-Math.sqrt((gxx-gyy)*(gxx-gyy)+4*gxy*gxy))/(2*N*N);
    if(texture<MIN_TEXTURE){if(l){dx*=2;dy*=2;continue;}return null;} // flat paper or a single edge cannot be followed
    let ok=true,res=0;for(let it=0;it<10;it++){if(!patch(Q[l],px+dx,py+dy,R,cur)){ok=false;break;}
      let mc=0;for(let k=0;k<N*N;k++)mc+=cur[k];mc/=N*N;let bx=0,by=0;res=0;
      for(let j=0,k=0;j<N;j++)for(let i=0;i<N;i++,k++){const e=tpl[(j+1)*T+i+1]-mt-cur[k]+mc;bx+=e*ix[k];by+=e*iy[k];res+=e<0?-e:e;} // brightness changes are removed
      const ax=(gyy*bx-gxy*by)/det,ay=(gxx*by-gxy*bx)/det;dx+=ax;dy+=ay;if(ax*ax+ay*ay<.0009)break;}
    if(!ok){if(l){dx*=2;dy*=2;continue;}return null;}
    if(l){dx*=2;dy*=2;}else if(res/(N*N)>MAX_RESIDUAL)return null;}
  return [x+dx,y+dy];}

// 3x3 homographies stored as 8 numbers (the last element is 1).
function mul(a,b){const m=[a[0]*b[0]+a[1]*b[3]+a[2]*b[6],a[0]*b[1]+a[1]*b[4]+a[2]*b[7],a[0]*b[2]+a[1]*b[5]+a[2],a[3]*b[0]+a[4]*b[3]+a[5]*b[6],a[3]*b[1]+a[4]*b[4]+a[5]*b[7],a[3]*b[2]+a[4]*b[5]+a[5],a[6]*b[0]+a[7]*b[3]+b[6],a[6]*b[1]+a[7]*b[4]+b[7],a[6]*b[2]+a[7]*b[5]+1];
  return m.slice(0,8).map(v=>v/m[8]);}
function invert(h){const a=h[0],b=h[1],c=h[2],d=h[3],e=h[4],f=h[5],g=h[6],k=h[7],m=[e-f*k,c*k-b,b*f-c*e,f*g-d,a-c*g,c*d-a*f,d*k-e*g,b*g-a*k,a*e-b*d];
  if(!(Math.abs(m[8])>1e-12))return null;return m.slice(0,8).map(v=>v/m[8]);}

// Poster pose in the current frame, from its pose in the previous frame. h is normalised (poster 0..1 -> frame 0..1).
function track(P,Q,h,w,ht){const hp=F.toPixels(h,w,ht),inv=invert(hp);if(!inv)return null;
  const cols=w>ht?18:13,rows=w>ht?13:18,edge=(R+3)<<(LEVELS-1),m={x:[],y:[],u:[],v:[],d:[]};
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const fx=edge+(w-2*edge)*(c+.5)/cols,fy=edge+(ht-2*edge)*(r+.5)/rows,p=F.apply(inv,fx,fy);
    if(!(p[2]>0)||p[0]<.005||p[1]<.005||p[0]>.995||p[1]>.995)continue;const q=follow(P,Q,fx,fy);if(!q)continue;m.x.push(p[0]);m.y.push(p[1]);m.u.push(q[0]);m.v.push(q[1]);m.d.push(0);}
  if(m.u.length<14)return null;const fit=F.ransac(m,w,ht,{threshold:1.5,iterations:80});
  if(!fit||fit.inliers.length<Math.max(12,m.u.length*.55))return null;
  return {h:F.toNormalised(fit.h,w,ht),n:fit.inliers.length,followed:m.u.length};}

root.PosterFlow={pyramid,track,mul,invert,LEVELS};if(typeof module!=='undefined')module.exports=root.PosterFlow;
})(typeof self!=='undefined'?self:globalThis);
