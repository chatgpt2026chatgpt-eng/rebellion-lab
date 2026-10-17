import {tacticalAircraftArt} from './rebel-tactical-art.js';
// Map-scale aircraft support. Ammunition counts are a mixed AH-1Z load;
// distances, damage and tanker bonus are game balance values, not specifications.
export const VIPER_LOAD=Object.freeze({missiles:8,rockets:14,rounds:650});
export function supportRoute(points){
 const pts=points.map(p=>({...p})),samples=[];
 for(let i=0;i<pts.length-1;i++){
  const a=pts[Math.max(0,i-1)],b=pts[i],c=pts[i+1],d=pts[Math.min(pts.length-1,i+2)];
  for(let j=0;j<24;j++){const t=j/24,t2=t*t,t3=t2*t;const axis=k=>.5*(2*b[k]+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t2+(-a[k]+3*b[k]-3*c[k]+d[k])*t3);samples.push({x:axis('x'),y:axis('y')});}
 }
 samples.push(pts.at(-1));let length=0;for(let i=0;i<samples.length;i++){if(i)length+=Math.hypot(samples[i].x-samples[i-1].x,samples[i].y-samples[i-1].y);samples[i].s=length;}
 return{length,waypointDistances:pts.map((_,i)=>samples[Math.min(i*24,samples.length-1)].s),path:samples.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' '),sample(s){s=Math.max(0,Math.min(length,s));let lo=0,hi=samples.length-1;while(lo+1<hi){const mid=(lo+hi)>>1;if(samples[mid].s<s)lo=mid;else hi=mid;}const a=samples[lo],b=samples[hi],t=(s-a.s)/Math.max(.001,b.s-a.s);return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,heading:Math.atan2(b.y-a.y,b.x-a.x)};}};
}
export function tankerArtwork(){return tacticalAircraftArt('KC46');}
export function viperDetails(){return `<path d="M-5-40Q0-47 5-40L7-16L5 19H-5L-7-16Z" fill="#728b83" stroke="#253e42"/><path d="M-5-35L0-39L5-35V-25H-5ZM-4-23H4V-12H-4Z" fill="#244c61" stroke="#c5d7cc"/><path d="M-6 3L-33 10V17L-7 12ZM6 3L33 10V17L7 12Z" fill="#82948a" stroke="#263b3c"/><path d="M-26 12V24M-21 12V24M21 12V24M26 12V24" stroke="#dfd4b4" stroke-width="3"/><circle cy="-42" r="4" fill="#182f3b"/><path d="M-2-44V-52M2-44V-52" stroke="#a3b1a6" stroke-width="2"/>`;}
