import {supportRoute} from './rebel-air-support.js';
// A continuous three-orbit observation pass centred on the ordered location.
export function makeReconRoute(from,target,cell=180,bounds={width:14550,height:7550}){
 if(![from.x,from.y,target.x,target.y,cell].every(Number.isFinite)||cell<=0)throw Error('إحداثيات استطلاع غير صالحة');
 const dx=target.x-from.x,dy=target.y-from.y,d=Math.max(1,Math.hypot(dx,dy)),ux=dx/d,uy=dy/d;
 const r=Math.max(16,Math.min(cell*.95,target.x-8,bounds.width-target.x-8,target.y-8,bounds.height-target.y-8));
 const start=Math.atan2(uy,ux)+Math.PI/2,entry={x:target.x+Math.cos(start)*r,y:target.y+Math.sin(start)*r};
 const points=[from,{x:entry.x-ux*cell*.8,y:entry.y-uy*cell*.8},entry];
 const loops=Math.max(3,Math.ceil(16*cell*1.1/(2*Math.PI*r)));
 for(let i=1;i<=loops*32;i++){const a=start+i*Math.PI*2/32;points.push({x:target.x+Math.cos(a)*r,y:target.y+Math.sin(a)*r});}
 const orbitEnd=points.length-1;points.push({x:entry.x-ux*cell,y:entry.y-uy*cell},from);
 const route=supportRoute(points),sample=route.sample,returnDistance=route.waypointDistances[orbitEnd];
 return {...route,orbitStart:route.waypointDistances[2],returnDistance,releaseDistance:returnDistance,loiterSeconds:loops*2*Math.PI*r/(cell*1.1),sample(s){const p=sample(s),a=sample(Math.max(0,s-5)),b=sample(Math.min(route.length,s+5));const angle=Math.atan2(Math.sin(b.heading-a.heading),Math.cos(b.heading-a.heading));return {...p,curvature:angle/10};}};
}
