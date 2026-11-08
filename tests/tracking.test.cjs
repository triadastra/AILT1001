const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');const root=path.resolve('dist');
// withFeatures=false runs the corner-marker fallback on its own.
function worker(withFeatures=true){let result;const ctx={Uint8ClampedArray,console,Set,Map,Math,Array,Number,Error,Date};ctx.self=ctx;ctx.postMessage=r=>result=r;
if(withFeatures)ctx.fetch=async file=>{const b=fs.readFileSync(path.join(root,file));return {ok:true,arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)};};
vm.createContext(ctx);ctx.importScripts=(...files)=>files.forEach(f=>vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx));vm.runInContext(fs.readFileSync(path.join(root,'ar-worker.js'),'utf8'),ctx);return {ready:ctx.posterFeaturesReady.catch(()=>{}),run:image=>{result=null;ctx.onmessage({data:{...image,session:1}});return result;},tracking:ctx.PosterTracking};}
function load(name){const meta=JSON.parse(fs.readFileSync('/tmp/hollywood-ar-fixtures/'+name+'.json')),data=fs.readFileSync('/tmp/hollywood-ar-fixtures/'+name+'.rgba');return {meta,frame:{width:meta.width,height:meta.height,buffer:data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)}};}
(async()=>{
const w=worker(false);await w.ready;let reports=[];for(const name of ['front','tilted','slanted','rotated','phone-small','phone-dim']){const meta=JSON.parse(fs.readFileSync('/tmp/hollywood-ar-fixtures/'+name+'.json'));const data=fs.readFileSync('/tmp/hollywood-ar-fixtures/'+name+'.rgba');const start=Date.now(),r=w.run({width:meta.width,height:meta.height,buffer:data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)});assert(r.locked,name+' did not lock: '+JSON.stringify(r));const predicted=[[0,0],[1,0],[1,1],[0,1]].map(([x,y])=>w.tracking.project(r.h,x,y));let maxError=0;predicted.forEach((p,i)=>maxError=Math.max(maxError,Math.hypot(p.x*meta.width-meta.targets[i][0],p.y*meta.height-meta.targets[i][1])));assert(maxError<12,name+' alignment '+maxError);reports.push({name,ids:r.ids,maxCornerErrorPixels:maxError,fitErrorPixels:r.error,processingMs:Date.now()-start});}
assert(!w.tracking.fit([],1000,1500).locked);assert(!w.tracking.fit([{id:0,hammingDistance:0,corners:[]}],1000,1500).locked);console.log(JSON.stringify({passed:true,reports},null,2));fs.writeFileSync('tests/tracking-report.json',JSON.stringify({passed:true,reports},null,2));
const meta=JSON.parse(fs.readFileSync('/tmp/hollywood-ar-fixtures/slanted.json')),buf=fs.readFileSync('/tmp/hollywood-ar-fixtures/slanted.rgba');const frame={width:meta.width,height:meta.height,buffer:buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength)};
assert(w.run(frame).locked);const repeatStart=Date.now(),repeat=w.run(frame);assert(repeat.locked);console.log('Tracked-region repeat ms:',Date.now()-repeatStart);
const blank=new Uint8ClampedArray(meta.width*meta.height*4).fill(255);const loss=w.run({width:meta.width,height:meta.height,buffer:blank.buffer});assert(!loss.locked,'Blank frame must lose registration');assert(w.run(frame).locked,'Poster must reacquire after loss');
const h=[.7,.03,.1,.05,.8,.08,.03,.04];const matrix=w.tracking.cssMatrix(h,600,900,20,40);for(const [x,y] of [[0,0],[1682,2378],[800,1000]]){const q=w.tracking.project(h,x/1682,y/2378),den=matrix[3]*x+matrix[7]*y+matrix[15],sx=(matrix[0]*x+matrix[4]*y+matrix[12])/den,sy=(matrix[1]*x+matrix[5]*y+matrix[13])/den;assert(Math.abs(sx-(q.x*600+20))<1e-7);assert(Math.abs(sy-(q.y*900+40))<1e-7);}
console.log('Loss, reacquisition, and CSS perspective mapping passed.');

// Full-bleed camera and contained preview must use the same transform as their images.
for(const cover of [true,false]){const v=w.tracking.viewport(1920,1080,390,844,cover);assert.equal(v.left+v.width/2,195);assert.equal(v.top+v.height/2,422);assert(cover?v.width>=390&&v.height>=844:v.width<=390&&v.height<=844);}
const synthetic=Object.entries(w.tracking.positions).map(([id,[x,y]])=>({id:Number(id),hammingDistance:1,corners:[[x+8,y+8],[x+72,y+8],[x+72,y+72],[x+8,y+72]].map(([x,y])=>({x,y}))}));
assert(w.tracking.fit(synthetic,1682,2378).locked,'One-bit errors must be recoverable');
assert(!w.tracking.fit(synthetic.slice(0,2),1682,2378).locked,'Two corners cannot lock');
assert(!w.tracking.fit(synthetic.map(m=>({...m,hammingDistance:4})),1682,2378).locked,'More than three bits must be rejected');
const scrambled=synthetic.map((m,i)=>({...m,corners:synthetic[(i+1)%4].corners}));assert(!w.tracking.fit(scrambled,1682,2378).locked,'Incorrect corner layout must not lock');
console.log('Cover/contain mapping, bounded error correction and invalid layout rejection passed.');

// Optional real phone screenshot, kept outside the repository for privacy.
if(fs.existsSync('/tmp/hollywood-ar-fixtures/phone-real.rgba')){const meta=JSON.parse(fs.readFileSync('/tmp/hollywood-ar-fixtures/phone-real.json'));const b=fs.readFileSync('/tmp/hollywood-ar-fixtures/phone-real.rgba');const result=worker(false).run({...meta,buffer:b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)});assert(result.locked,'Real phone screenshot must acquire three matching corners');assert(result.count>=3);console.log('Real phone screenshot:',JSON.stringify(result));}
const negativeMeta=JSON.parse(fs.readFileSync('/tmp/hollywood-ar-fixtures/no-markers.json')),negativeBuffer=fs.readFileSync('/tmp/hollywood-ar-fixtures/no-markers.rgba');assert(!worker(false).run({...negativeMeta,buffer:negativeBuffer.buffer.slice(negativeBuffer.byteOffset,negativeBuffer.byteOffset+negativeBuffer.byteLength)}).locked,'Marker fallback alone must not lock without corner codes');console.log('Marker-only negative control passed.');

if(fs.existsSync('/tmp/hollywood-ar-fixtures/phone-camera.rgba')){const meta=JSON.parse(fs.readFileSync('/tmp/hollywood-ar-fixtures/phone-camera.json'));const b=fs.readFileSync('/tmp/hollywood-ar-fixtures/phone-camera.rgba');const result=worker(false).run({...meta,buffer:b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)});assert(result.locked,'Resized phone camera crop must lock');console.log('Resized phone camera crop: locked',result.ids);}

// ---- Natural-feature tracking (primary): ~2000 reference points from the print PDF ----
const ref=fs.readFileSync(path.join(root,'assets/poster-features.bin'));const F=require(path.join(root,'ar-features.js'));const reference=F.deserialize(ref.buffer.slice(ref.byteOffset,ref.byteOffset+ref.byteLength));
assert(reference.count>=1900&&reference.count<=2100,'Reference should hold about 2000 poster feature points, has '+reference.count);
const levels=new Set(reference.level);assert.equal(levels.size,F.LEVELS.length,'Every reference scale must contribute points');
const cells=new Set();for(let i=0;i<reference.count;i++)cells.add(Math.floor(reference.x[i]/1682*6)+'-'+Math.floor(reference.y[i]/2378*8));assert(cells.size>=44,'Feature points must cover the poster, covered cells '+cells.size+'/48');
const fw=worker(true);await fw.ready;
function truthError(meta,h){// unit square -> fixture targets, compared where the poster is on screen
const A=[],B=[];[[0,0],[1,0],[1,1],[0,1]].forEach(([x,y],i)=>{const [u,v]=meta.targets[i];A.push([x,y,1,0,0,0,-u*x,-u*y]);B.push(u);A.push([0,0,0,x,y,1,-v*x,-v*y]);B.push(v);});
const M=A.map((r,i)=>[...r,B[i]]);for(let i=0;i<8;i++){let p=i;for(let j=i+1;j<8;j++)if(Math.abs(M[j][i])>Math.abs(M[p][i]))p=j;[M[i],M[p]]=[M[p],M[i]];const d=M[i][i];for(let k=i;k<=8;k++)M[i][k]/=d;for(let j=0;j<8;j++){if(j===i)continue;const f=M[j][i];for(let k=i;k<=8;k++)M[j][k]-=f*M[i][k];}}const t=M.map(r=>r[8]);
let max=0;for(let y=0;y<=1;y+=.05)for(let x=0;x<=1;x+=.05){const d=t[6]*x+t[7]*y+1,u=(t[0]*x+t[1]*y+t[2])/d,v=(t[3]*x+t[4]*y+t[5])/d;if(u<0||v<0||u>meta.width||v>meta.height)continue;const q=fw.tracking.project(h,x,y);max=Math.max(max,Math.hypot(q.x*meta.width-u,q.y*meta.height-v));}return max;}
const featureReports=[];
for(const name of ['front','tilted','slanted','rotated','phone-small','phone-dim','closeup-no-corners','steep-side','rotated-30-dim','far-small']){const {meta,frame}=load(name);const t=worker(true);await t.ready;let r;for(let i=0;i<3&&!(r&&r.locked);i++)r=t.run({...frame,buffer:frame.buffer.slice(0)});
assert(r.locked&&r.method==='features',name+' must lock on natural features: '+JSON.stringify({locked:r.locked,method:r.method,count:r.count}));assert(r.count>=20,name+' inliers '+r.count);const err=truthError(meta,r.h),limit=Math.max(meta.width,meta.height)*.006;assert(err<limit,name+' on-screen alignment '+err.toFixed(2)+'px > '+limit.toFixed(1));
const again=t.run({...frame,buffer:frame.buffer.slice(0)});assert(again.locked&&again.mode==='track',name+' must keep tracking with guided matching');featureReports.push({name,inliers:r.count,trackedInliers:again.count,maxOnScreenErrorPixels:+err.toFixed(2)});}
{const {frame}=load('no-markers');const r=fw.run(frame);assert(r.locked&&r.method==='features','Poster artwork alone must lock with natural features (corner codes removed)');}
for(const name of ['unrelated','noise']){const {frame}=load(name);const t=worker(true);await t.ready;for(let i=0;i<4;i++){const r=t.run({...frame,buffer:frame.buffer.slice(0)});assert(!r.locked,name+' must never lock');}}
console.log(JSON.stringify({naturalFeatures:{referencePoints:reference.count,reports:featureReports}},null,2));
console.log('Natural-feature acquisition, close-up without corners, guided tracking and false-lock rejection passed.');
})().catch(e=>{console.error(e);process.exit(1);});
