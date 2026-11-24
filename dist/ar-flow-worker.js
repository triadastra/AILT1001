importScripts('ar-features.js','ar-flow.js');
// Follows the poster on every camera frame (ar-flow.js). The slower detector (ar-worker.js) reports where the
// poster was in an earlier frame; that fix is carried forward to the present, so its delay does not show.
const KEEP=45,ring=new Map();let pose=null,last=null;
function forget(){ring.clear();pose=null;last=null;}
self.onmessage=e=>{const m=e.data;try{
  if(m.type==='reset'){forget();return;}
  if(m.type==='frame'){const gray=PosterFeatures.toGray(new Uint8ClampedArray(m.buffer),m.width,m.height),pyr=PosterFlow.pyramid(gray,m.width,m.height);let n=0;
    if(last&&(last.w!==m.width||last.h!==m.height))forget();
    if(pose&&last){const r=PosterFlow.track(last.pyr,pyr,pose,m.width,m.height);pose=r?r.h:null;n=r?r.n:0;}
    last={id:m.id,pyr,w:m.width,h:m.height};ring.set(m.id,{pyr,pose});for(const k of ring.keys()){if(ring.size<=KEEP)break;ring.delete(k);}
    self.postMessage({type:'flow',session:m.session,gen:m.gen,id:m.id,ok:!!pose,h:pose,n});return;}
  if(m.type==='pose'){const at=ring.get(m.id);if(!at||!last)return;
    if(at.pose&&pose){ // already following: apply the detector's correction to every pose since that frame
      const fix=PosterFlow.mul(PosterFlow.invert(at.pose),m.h);for(const [id,f] of ring)if(id>=m.id&&f.pose)f.pose=PosterFlow.mul(f.pose,fix);pose=PosterFlow.mul(pose,fix);}
    else{ // start following: catch up from the detected frame to the newest one
      at.pose=m.h;let h=m.h,from=at;for(const [id,f] of ring){if(id<=m.id)continue;const r=PosterFlow.track(from.pyr,f.pyr,h,last.w,last.h);if(!r){h=null;break;}h=r.h;f.pose=h;from=f;}pose=h;}
    self.postMessage({type:'flow',session:m.session,gen:m.gen,id:last.id,ok:!!pose,h:pose,n:0,rebased:true});}
}catch(err){forget();self.postMessage({type:'flow',session:m.session,gen:m.gen,id:m.id,ok:false,h:null,n:0,error:String(err)});}};
