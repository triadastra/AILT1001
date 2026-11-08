/* Poster-space homography fitting. Shared by browser worker and deterministic QA. */
(function(root){'use strict';
const W=1682,H=2378;
const positions={0:[8,8],7:[1594,8],2:[1594,2290],3:[8,2290]};
function solve(A,b){const n=b.length,A2=A.map((r,i)=>[...r,b[i]]);for(let i=0;i<n;i++){let p=i;for(let j=i+1;j<n;j++)if(Math.abs(A2[j][i])>Math.abs(A2[p][i]))p=j;if(Math.abs(A2[p][i])<1e-10)return null;[A2[i],A2[p]]=[A2[p],A2[i]];const v=A2[i][i];for(let k=i;k<=n;k++)A2[i][k]/=v;for(let j=0;j<n;j++){if(j===i)continue;const f=A2[j][i];for(let k=i;k<=n;k++)A2[j][k]-=f*A2[i][k];}}return A2.map(r=>r[n]);}
function project(h,x,y){const d=h[6]*x+h[7]*y+1;return {x:(h[0]*x+h[1]*y+h[2])/d,y:(h[3]*x+h[4]*y+h[5])/d};}
function fit(markers,width,height){const accepted=markers.filter(m=>positions[m.id]&&Number.isInteger(m.hammingDistance)&&m.hammingDistance>=0&&m.hammingDistance<=3);const unique=[...new Map(accepted.map(m=>[m.id,m])).values()];if(unique.length<3)return {locked:false,count:unique.length,ids:unique.map(m=>m.id),reason:'markers'};
const pairs=[];for(const m of unique){const [x,y]=positions[m.id];[[x+8,y+8],[x+72,y+8],[x+72,y+72],[x+8,y+72]].forEach((p,i)=>pairs.push({x:p[0]/W,y:p[1]/H,u:m.corners[i].x/width,v:m.corners[i].y/height}));}
const A=[],b=[];for(const p of pairs){A.push([p.x,p.y,1,0,0,0,-p.u*p.x,-p.u*p.y]);b.push(p.u);A.push([0,0,0,p.x,p.y,1,-p.v*p.x,-p.v*p.y]);b.push(p.v);}const AtA=Array.from({length:8},()=>Array(8).fill(0)),Atb=Array(8).fill(0);for(let i=0;i<A.length;i++)for(let j=0;j<8;j++){Atb[j]+=A[i][j]*b[i];for(let k=0;k<8;k++)AtA[j][k]+=A[i][j]*A[i][k];}const h=solve(AtA,Atb);if(!h)return {locked:false,count:unique.length,reason:'geometry'};
const errors=pairs.map(p=>{const q=project(h,p.x,p.y);return Math.hypot((q.x-p.u)*width,(q.y-p.v)*height)});const error=Math.sqrt(errors.reduce((a,b)=>a+b*b,0)/errors.length);const corners=[[0,0],[1,0],[1,1],[0,1]].map(([x,y])=>project(h,x,y));const area=corners.reduce((a,p,i)=>a+p.x*corners[(i+1)%4].y-p.y*corners[(i+1)%4].x,0)/2;if(error>Math.max(5,Math.max(width,height)*.008)||area<.03||area>1.6||corners.some(p=>!Number.isFinite(p.x)||p.x<-.5||p.x>1.5||p.y<-.5||p.y>1.5))return {locked:false,count:unique.length,error,reason:'geometry'};
return {locked:true,count:unique.length,ids:unique.map(m=>m.id),h,error,corners};}
// Homography mapping the unit poster square to four frame corners (used to smooth poses).
function fromCorners(c){const A=[],b=[];[[0,0],[1,0],[1,1],[0,1]].forEach(([x,y],i)=>{const u=c[i].x,v=c[i].y;A.push([x,y,1,0,0,0,-u*x,-u*y]);b.push(u);A.push([0,0,0,x,y,1,-v*x,-v*y]);b.push(v);});return solve(A,b);}
function cssMatrix(h,width,height,left,top){return [width*h[0]/W+left*h[6]/W,height*h[3]/W+top*h[6]/W,0,h[6]/W,width*h[1]/H+left*h[7]/H,height*h[4]/H+top*h[7]/H,0,h[7]/H,0,0,1,0,width*h[2]+left,height*h[5]+top,0,1];}
function viewport(sw,sh,width,height,cover){const scale=(cover?Math.max:Math.min)(width/sw,height/sh);return {width:sw*scale,height:sh*scale,left:(width-sw*scale)/2,top:(height-sh*scale)/2};}
root.PosterTracking={fit,project,fromCorners,cssMatrix,viewport,positions,width:W,height:H};if(typeof module!=='undefined')module.exports=root.PosterTracking;
})(typeof self!=='undefined'?self:globalThis);
