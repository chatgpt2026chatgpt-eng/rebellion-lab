// Conventional aircraft only. All distances/speeds are map-game values.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function makeTacticalRoute(from,target,{cell=180,standoff=0,index=0,kind='fighter',approach='offset',threats=[],width=7200,height=4080}={}){
 const distance=Math.hypot(target.x-from.x,target.y-from.y),heading=Math.atan2(target.y-from.y,target.x-from.x),ux=Math.cos(heading),uy=Math.sin(heading),nx=-uy,ny=ux;
 const radius=cell*((kind==='helicopter'||kind==='transport')?1.25:kind==='bomber'?3.1:2.45)+index*cell*.12;
 const release=Math.max(0,distance-Math.min(standoff,distance*.65)),end=Math.max(release+cell*2.2,cell*3.1);
 const world=(x,y,side)=>({x:from.x+ux*x+nx*y*side,y:from.y+uy*x+ny*y*side});
 function sampleSide(s,side){
  let x,y,a,curvature=0;
  if(s<=end){x=s;y=0;a=0}
  else if(s<=end+Math.PI*radius){a=(s-end)/radius;x=end+Math.sin(a)*radius;y=radius-Math.cos(a)*radius;curvature=side/radius}
  else if(s<=2*end+Math.PI*radius){x=end-(s-end-Math.PI*radius);y=2*radius;a=Math.PI}
  else{a=Math.PI+(s-2*end-Math.PI*radius)/radius;x=Math.sin(a)*radius;y=radius-Math.cos(a)*radius;curvature=side/radius}
  return{...world(x,y,side),heading:heading+a*side,curvature};
 }
 const length=2*end+2*Math.PI*radius;
 const cost=side=>{let n=0;for(let s=0;s<=length;s+=cell*.4){const p=sampleSide(s,side);n+=Math.max(0,60-p.x,p.x-width+60,60-p.y,p.y-height+60)*8;for(const d of threats){const dist=Math.hypot(p.x-d.x,p.y-d.y);n+=Math.max(0,d.range-dist)*(approach==='sead'?2:.35)}}return n};
 const a=cost(1),b=cost(-1),side=Math.abs(a-b)<1?(index%2?-1:1):a<b?1:-1;
 const sample=s=>sampleSide(clamp(s,0,length),side);
 const points=[];for(let s=0;s<length;s+=cell*.14)points.push(sample(s));points.push(sample(length));
 return{length,releaseDistance:release,radius,side,heading,sample,path:points.map((p,i)=>(i?'L':'M')+p.x.toFixed(2)+' '+p.y.toFixed(2)).join(' ')};
}
export function flightPace(kind,airframe){return airframe==='A10'?1.15:kind==='bomber'?1.35:kind==='helicopter'?.65:kind==='transport'?.75:1.75}
export function paceAt(distance,length,cell,pace){const departure=clamp(distance/(cell*2.2),0,1),arrival=clamp((length-distance)/(cell*2.8),0,1);return cell*pace*(.38+.62*Math.min(departure,arrival))}

// C2 transition at straight/turn joins. Reparameterize by travelled distance,
// so bank develops progressively without a speed jump at the join.
export function smoothAircraftRoute(route,cell=180){
 const half=Math.min(cell*.38,route.radius*.22),joins=[route.releaseDistance+cell*2.2];
 // The first tangent can be farther out on very short missions.
 const end=(route.length-2*Math.PI*route.radius)/2;
 joins[0]=end;joins.push(end+Math.PI*route.radius,2*end+Math.PI*route.radius);
 const axis=(s,key)=>route.sample(s)[key];
 const derivative=(s,key,n)=>{const h=.04;return n===1?(axis(s+h,key)-axis(s-h,key))/(2*h):(axis(s+h,key)-2*axis(s,key)+axis(s-h,key))/(h*h);};
 const spans=joins.map(j=>{const lo=j-half,hi=j+half,L=hi-lo;const coeff=key=>{const a=axis(lo,key),b=derivative(lo,key,1)*L,c=derivative(lo,key,2)*L*L/2,A=axis(hi,key)-a-b-c,B=derivative(hi,key,1)*L-b-2*c,C=derivative(hi,key,2)*L*L-2*c;return[a,b,c,10*A-4*B+C/2,-15*A+7*B-C,6*A-3*B+C/2];};return{lo,hi,x:coeff('x'),y:coeff('y')};});
 const raw=s=>{const span=spans.find(v=>s>=v.lo&&s<=v.hi);if(!span)return route.sample(s);const t=(s-span.lo)/(span.hi-span.lo),calc=c=>c.reduce((n,v,i)=>n+v*t**i,0);return{x:calc(span.x),y:calc(span.y)};};
 const pts=[];let length=0,previous;for(let s=0;s<route.length;s+=cell*.025){const q=raw(s);if(previous)length+=Math.hypot(q.x-previous.x,q.y-previous.y);pts.push({...q,s:length});previous=q;}const finish=raw(route.length);length+=Math.hypot(finish.x-previous.x,finish.y-previous.y);pts.push({...finish,s:length});
 const position=s=>{s=clamp(s,0,length);let lo=0,hi=pts.length-1;while(lo+1<hi){const m=(lo+hi)>>1;if(pts[m].s<s)lo=m;else hi=m;}const a=pts[lo],b=pts[hi],t=(s-a.s)/Math.max(.00001,b.s-a.s);return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};};
 const heading=s=>{const a=position(Math.max(0,s-cell*.035)),b=position(Math.min(length,s+cell*.035));return Math.atan2(b.y-a.y,b.x-a.x);};
 return{...route,length,sample(s){const h=heading(s),a=heading(Math.max(0,s-cell*.08)),b=heading(Math.min(length,s+cell*.08)),delta=Math.atan2(Math.sin(b-a),Math.cos(b-a));return{...position(s),heading:h,curvature:delta/(cell*.16)};}};
}
