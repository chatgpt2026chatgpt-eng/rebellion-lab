// Aircraft-only effects: bounded pools and a single shared animation clock.
const NS='http://www.w3.org/2000/svg',jobs=new Set();let raf=0,last=0;
const el=(tag,a,parent)=>{const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(a))n.setAttribute(k,v);parent.append(n);return n;};
function run(fn){jobs.add(fn);if(!raf)raf=requestAnimationFrame(tick);}
function tick(now){const dt=last?Math.min(.05,(now-last)/1000):0;last=now;if(!document.hidden)for(const fn of jobs)if(fn(dt)===false)jobs.delete(fn);if(jobs.size)raf=requestAnimationFrame(tick);else{raf=0;last=0;}}
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function aircraftMunitionFX(layer,from,target,{heading=0,rocket=false,valid=()=>true,aim=null,weaponId='guided'}={}){
 return new Promise(resolve=>{
  const g=el('g',{'class':'air35-munition','pointer-events':'none'},layer),body=el('g',{},g),history=[];
  const trail=el('g',{},g),puffs=rocket?Array.from({length:16},()=>el('ellipse',{rx:3,ry:3,fill:'#c9c5b8',opacity:0},trail)):[];
  // Front is +X; rockets have a seeker/nose and fins, bombs have tail kit and no flame.
  const flame=rocket?el('path',{d:'M-12-2L-30 0L-12 2Z',fill:'#efad68'},body):null;
  el('path',{d:rocket?'M18 0L11-2.8H-11L-14-2V2L-11 2.8H11Z':'M13 0Q11-4 5-4H-8L-12-3V3L-8 4H5Q11 4 13 0Z',fill:rocket?'#c8d0ce':'#667665',stroke:'#2e4249','stroke-width':.7},body);
  el('path',{d:'M-8-2L-15-7H-18L-13 0L-18 7H-15L-8 2',fill:rocket?'#879b9f':'#98a292',stroke:'#32494f','stroke-width':.5},body);
  if(rocket)el('path',{d:'M4-2L0-6H-3L0 0L-3 6H0L4 2M11-2L18 0L11 2',fill:'#697f88'},body);
  else if(weaponId!=='freefall')el('path',{d:'M4-3L-2-13H-5L-1 0L-5 13H-2L4 3',fill:'#a4b1a7',stroke:'#354d50','stroke-width':.6},body);
  el('path',{d:'M-5-3V3',stroke:'#c6b77d','stroke-width':1.4},body);
  const distance=Math.hypot(target.x-from.x,target.y-from.y),duration=clamp(distance/(rocket?750:510),.8,3.6),forward=Math.min(distance*.32,210),c={x:from.x+Math.cos(heading)*forward,y:from.y+Math.sin(heading)*forward};let age=0,to={...target},previous={...from};
  run(dt=>{if(!g.isConnected||!valid()){g.remove();resolve(false);return false;}age+=dt;if(aim){const point=aim();if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)){g.remove();resolve(false);return false;}to={...point};}
   const t=clamp(age/duration,0,1),q=1-t,pt={x:q*q*from.x+2*q*t*c.x+t*t*to.x,y:q*q*from.y+2*q*t*c.y+t*t*to.y};
   const angle=Math.atan2(pt.y-previous.y,pt.x-previous.x);previous=pt;
   body.setAttribute('transform',`translate(${pt.x} ${pt.y}) rotate(${angle*180/Math.PI}) scale(${rocket?.85:1-t*.22})`);
   if(flame)flame.setAttribute('opacity',t<.78?String(.65+.2*Math.sin(age*30)):'0');
   history.push({...pt,age});while(history.length>48||history[0]?.age<age-.9)history.shift();
   for(let i=0;i<puffs.length;i++){const h=history[Math.floor(i*(history.length-1)/(puffs.length-1))],old=age-h.age;puffs[i].setAttribute('cx',h.x+old*4);puffs[i].setAttribute('cy',h.y-old*5);puffs[i].setAttribute('rx',2+old*6);puffs[i].setAttribute('ry',1.7+old*4);puffs[i].setAttribute('opacity',String(Math.max(0,.24*(1-old/.9))));}
   if(t>=1){g.remove();resolve(true);return false;}return true;
  });
 });
}
const impacts=[];
export function aircraftImpactFX(layer,point,{size=1,label=''}={}){
 const g=el('g',{class:'air35-impact','pointer-events':'none',transform:`translate(${point.x} ${point.y}) scale(${size})`},layer);impacts.push(g);while(impacts.length>12)impacts.shift().remove();
 el('ellipse',{cy:9,rx:29,ry:10,fill:'#343b37',opacity:.35},g);
 const flash=el('g',{},g);el('ellipse',{rx:24,ry:18,fill:'#e18b43'},flash);el('ellipse',{rx:13,ry:10,fill:'#ffe7af'},flash);
 const ring=el('ellipse',{rx:1,ry:1,fill:'none',stroke:'#c6b18b','stroke-width':2,opacity:.6},g);
 const dust=Array.from({length:10},(_,i)=>({n:el('ellipse',{rx:10+i%3*3,ry:7+i%2*2,fill:i%2?'#b3a083':'#978e78',opacity:0},g),a:i*2.399}));
 const smoke=Array.from({length:9},(_,i)=>({n:el('ellipse',{rx:10+i%3*3,ry:12+i%2*4,fill:i%3===0?'#414a47':'#636b62',opacity:0},g),x:Math.sin(i*2.399)*19,delay:i*.1}));
 const debris=Array.from({length:8},(_,i)=>({n:el('path',{d:'M-2-1L3 0L0 2Z',fill:'#584f41'},g),a:i*2.399,v:40+i%3*15}));
 const text=label?el('text',{y:65,'text-anchor':'middle',class:'tac-damage-label'},g):null;if(text)text.textContent=label;
 let age=0;run(dt=>{if(!g.isConnected)return false;age+=dt;flash.setAttribute('opacity',Math.max(0,1-age/.38));flash.setAttribute('transform',`scale(${.4+Math.min(.4,age)*2})`);
  ring.setAttribute('rx',4+age*100);ring.setAttribute('ry',2+age*40);ring.setAttribute('opacity',Math.max(0,.55-age));
  for(const q of dust){const spread=1-Math.exp(-age*2.7);q.n.setAttribute('transform',`translate(${Math.cos(q.a)*48*spread} ${8+Math.sin(q.a)*21*spread}) scale(${.35+age*.45})`);q.n.setAttribute('opacity',Math.max(0,Math.min(.32,age*2)*(1-age/2.4)));}
  for(const q of smoke){const t=Math.max(0,age-q.delay);q.n.setAttribute('transform',`translate(${q.x+t*10} ${-t*27}) scale(${.3+Math.min(t,3)*.32})`);q.n.setAttribute('opacity',Math.max(0,Math.min(.34,t*.8)*(1-t/4.6)));}
  for(const q of debris){q.n.setAttribute('transform',`translate(${Math.cos(q.a)*q.v*age} ${Math.sin(q.a)*q.v*age+age*age*45}) rotate(${age*150})`);q.n.setAttribute('opacity',Math.max(0,1-age/.85));}
  if(text)text.setAttribute('opacity',Math.max(0,1-(age-1.3)/1.2));if(age>=5.5){g.remove();const i=impacts.indexOf(g);if(i>=0)impacts.splice(i,1);return false;}return true;
 });return g;
}
