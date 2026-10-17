const NS='http://www.w3.org/2000/svg';
const node=(tag,attrs,parent)=>{const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);parent.append(n);return n};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function tween(duration,fn){return new Promise(resolve=>{const start=performance.now();function tick(now){const t=Math.min(1,(now-start)/duration);fn(t);if(t<1)requestAnimationFrame(tick);else resolve()}requestAnimationFrame(tick)})}
export function supportImpact(layer,p,{size=1,drone=false,label=''}={}){
 const g=node('g',{transform:`translate(${p.x} ${p.y})`,'pointer-events':'none',class:'support-impact'},layer);
 const ring=node('ellipse',{rx:8,ry:4,fill:'none',stroke:'#dab997','stroke-width':5},g),core=node('circle',{r:10,fill:'#fff4bd'},g);
 const smoke=Array.from({length:7},(_,i)=>node('circle',{cx:Math.cos(i*2.4)*12,cy:Math.sin(i*2.4)*8,r:10,fill:i%2?'#62645b':'#897e68'},g));
 const sparks=Array.from({length:8},(_,i)=>node('path',{d:'M0 0L9 0',stroke:i%2?'#ffd48a':'#d49b58','stroke-width':3},g));
 if(label)node('text',{x:0,y:-55,fill:'#ffe1a3','font-size':23,'text-anchor':'middle'},g).textContent=label;
 void tween(drone?1300:1100,t=>{const r=(12+70*t)*size;ring.setAttribute('rx',r);ring.setAttribute('ry',r*.38);ring.setAttribute('opacity',Math.max(0,1-t*2));core.setAttribute('r',(8+30*Math.sin(Math.min(1,t*4)*Math.PI))*size);core.setAttribute('opacity',Math.max(0,1-t*4));smoke.forEach((n,i)=>{n.setAttribute('cx',Math.cos(i*2.4)*(15+24*t)*size);n.setAttribute('cy',-t*(35+i*5)*size+Math.sin(i*2.4)*15);n.setAttribute('r',(9+21*t)*size);n.setAttribute('opacity',Math.sin(Math.PI*t)*.64)});sparks.forEach((n,i)=>{const a=i*Math.PI/4,d=70*t*size;n.setAttribute('transform',`translate(${Math.cos(a)*d} ${Math.sin(a)*d*.6+t*t*30}) rotate(${i*45})`);n.setAttribute('opacity',Math.max(0,1-t*2.7))})}).then(()=>g.remove());
}
export async function supportBarrage(layer,start,end,role,centers,impacts=[],visible=()=>true){
 const count=role==='katyusha'?6:role==='mortar'?3:1;
 const tasks=[];
 for(let i=0;i<count;i++){
  const offset=role==='fieldArtillery'?0:role==='mortar'?35:75,angle=i*2.4,to={x:end.x+Math.cos(angle)*offset,y:end.y+Math.sin(angle)*offset*.6};
  const g=node('g',{'pointer-events':'none',class:'support-projectile'},layer),trail=node('path',{fill:'none',stroke:role==='katyusha'?'#d7bf93':'#c8bd92','stroke-width':role==='katyusha'?5:2,opacity:.6},g),shell=node('path',{d:role==='katyusha'?'M-16-3L9-3L16 0L9 3H-16Z':'M-6-3L5-3L9 0L5 3H-6Z',fill:'#dac798',stroke:'#4e5348','stroke-width':1},g);
  const arc=role==='mortar'?240:role==='fieldArtillery'?150:115;
  const point=t=>({x:start.x+(to.x-start.x)*t,y:start.y+(to.y-start.y)*t-4*arc*t*(1-t)});
  tasks.push(tween(role==='mortar'?1250:950,t=>{const p=point(t),q=point(Math.max(0,t-.1)),angle=Math.atan2((to.y-start.y)-4*arc*(1-2*t),to.x-start.x)*180/Math.PI;shell.setAttribute('transform',`translate(${p.x} ${p.y}) rotate(${angle})`);trail.setAttribute('d',`M${q.x} ${q.y}Q${point(Math.max(0,t-.05)).x} ${point(Math.max(0,t-.05)).y} ${p.x} ${p.y}`)}).then(()=>{g.remove();supportImpact(layer,to,{size:role==='fieldArtillery'?1.1:role==='mortar'?.65:.8})}));
  if(i<count-1)await pause(role==='katyusha'?130:230);
 }
 await Promise.all(tasks);
 for(const hit of impacts)if(!hit.unit||visible(hit.unit))supportImpact(layer,centers[hit.y][hit.x],{size:.4,label:'−'+hit.damage});
 await pause(160);
}
