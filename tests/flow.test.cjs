// Frame-to-frame tracking (dist/ar-flow.js) on a synthetic hand-held sequence with known poster corners.
// Run `python3 tests/make-sequence.py` first.
const fs=require('fs'),path=require('path'),assert=require('assert');
const F=require(path.resolve('dist/ar-features.js')),Flow=require(path.resolve('dist/ar-flow.js'));
const meta=JSON.parse(fs.readFileSync('/tmp/hollywood-ar-fixtures/walk.json')),raw=fs.readFileSync('/tmp/hollywood-ar-fixtures/walk.gray');
const W=meta.width,H=meta.height,LONG=360,w=Math.round(W*LONG/H),h=LONG;
const frame=i=>F.resize(new Uint8Array(raw.buffer,raw.byteOffset+i*W*H,W*H),W,H,w,h);
// unit square -> the fixture's corner targets, normalised to the frame
function truth(i){const A=[],B=[];[[0,0],[1,0],[1,1],[0,1]].forEach(([x,y],k)=>{const u=meta.targets[i][k][0]/W,v=meta.targets[i][k][1]/H;A.push([x,y,1,0,0,0,-u*x,-u*y]);B.push(u);A.push([0,0,0,x,y,1,-v*x,-v*y]);B.push(v);});
  const M=A.map((r,k)=>[...r,B[k]]);for(let i=0;i<8;i++){let p=i;for(let j=i+1;j<8;j++)if(Math.abs(M[j][i])>Math.abs(M[p][i]))p=j;[M[i],M[p]]=[M[p],M[i]];const d=M[i][i];for(let k=i;k<=8;k++)M[i][k]/=d;for(let j=0;j<8;j++){if(j===i)continue;const f=M[j][i];for(let k=i;k<=8;k++)M[j][k]-=f*M[i][k];}}return M.map(r=>r[8]);}
// largest disagreement where the poster is on screen, as a fraction of the frame's long side
function error(a,b){let max=0;for(let y=0;y<=1;y+=.05)for(let x=0;x<=1;x+=.05){const p=F.apply(a,x,y),q=F.apply(b,x,y);if(q[0]<0||q[1]<0||q[0]>1||q[1]>1)continue;max=Math.max(max,Math.hypot((p[0]-q[0])*W,(p[1]-q[1])*H)/H);}return max;}

// 1. Following between detector fixes: restart from the truth every 20 frames (the detector corrects about that often)
// and measure the drift at the end of each stretch. Also follow the whole 4 s walk-up with no correction at all.
let worst=0,ms=0,least=1e9,count=0;
for(let start=0;start+20<meta.frames;start+=20){let pose=truth(start),prev=Flow.pyramid(frame(start),w,h);
  for(let i=start+1;i<=start+20;i++){const g=frame(i),t=process.hrtime.bigint(),cur=Flow.pyramid(g,w,h),r=Flow.track(prev,cur,pose,w,h);ms+=Number(process.hrtime.bigint()-t)/1e6;count++;
    assert(r,'lost the poster at frame '+i);pose=r.h;prev=cur;least=Math.min(least,r.n);worst=Math.max(worst,error(pose,truth(i)));}}
let pose=truth(0),prev=Flow.pyramid(frame(0),w,h),long=0;for(let i=1;i<meta.frames;i++){const cur=Flow.pyramid(frame(i),w,h),r=Flow.track(prev,cur,pose,w,h);assert(r,'lost the poster at frame '+i);pose=r.h;prev=cur;long=Math.max(long,error(pose,truth(i)));}
console.log(JSON.stringify({frames:meta.frames,flowSize:[w,h],driftPer20FramesPercent:+(worst*100).toFixed(2),driftUncorrected4sPercent:+(long*100).toFixed(2),fewestInliers:least,msPerFrame:+(ms/count).toFixed(2)}));
assert(worst<.006,'drift between corrections '+(worst*100).toFixed(2)+'% of the frame');assert(long<.05,'uncorrected drift '+(long*100).toFixed(2)+'%');

// 2. A detector fix for an old frame is carried forward: correcting frame 40's pose corrects frame 60's.
{let p=truth(20),pv=Flow.pyramid(frame(20),w,h);const poses={20:p};for(let i=21;i<=60;i++){const cur=Flow.pyramid(frame(i),w,h);if(i===21)p=Flow.mul(p,[1.02,0,.01,0,1.02,-.008,0,0]);p=Flow.track(pv,cur,p,w,h).h;pv=cur;poses[i]=p;}
  const before=error(poses[60],truth(60)),fixed=Flow.mul(poses[60],Flow.mul(Flow.invert(poses[40]),truth(40))),after=error(fixed,truth(60));
  console.log(JSON.stringify({offsetBefore:+(before*100).toFixed(2),afterCorrection:+(after*100).toFixed(2)}));assert(before>.01&&after<.006,'correction must remove an offset');}

// 3. It must give up rather than follow something that is not the poster.
{const a=Flow.pyramid(frame(10),w,h),noise=new Uint8Array(w*h);let s=1;for(let i=0;i<noise.length;i++){s=(Math.imul(s,1664525)+1013904223)>>>0;noise[i]=s>>>24;}
  assert(!Flow.track(a,Flow.pyramid(noise,w,h),truth(10),w,h),'noise must not be followed');
  assert(!Flow.track(a,Flow.pyramid(new Uint8Array(w*h).fill(128),w,h),truth(10),w,h),'a covered lens must not be followed');
  assert(!Flow.track(a,Flow.pyramid(frame(70),w,h),truth(10),w,h),'a jump to a different view must be refused, not guessed');}
console.log('PASS: frame-to-frame following, carried-forward correction and loss detection.');
