// Presentation only. One bounded, visibility-aware clock; no flight or damage rules.
const NS='http://www.w3.org/2000/svg',systems=new WeakMap();
const make=(tag,attrs,parent)=>{const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);parent.append(n);return n};
const opacity=(n,a)=>n.setAttribute('opacity',Math.max(0,Math.min(1,a)).toFixed(3));
export function createStealthImpactFX(layer){
 if(systems.has(layer))return systems.get(layer);
 let active=[],scars=[],raf=0,last=0,epoch=null,serial=0,disposed=false;
 const root=make('g',{'data-stealth-fx':'v5','pointer-events':'none','aria-hidden':'true'},layer);
 layer.insertBefore(root,layer.firstChild);
 const scarLayer=make('g',{'data-stealth-scars':'true'},root),plumes=make('g',{'data-stealth-plumes':'true'},root);
 function clear(){if(raf)cancelAnimationFrame(raf);raf=0;last=0;active=[];scars=[];scarLayer.replaceChildren();plumes.replaceChildren();}
 function bind(token){if(epoch!==token){clear();epoch=token;}if(!root.isConnected)layer.insertBefore(root,layer.firstChild);}
 function schedule(){if(!disposed&&!document.hidden&&!raf&&active.length)raf=requestAnimationFrame(tick);}
 function tick(now){raf=0;if(disposed||!layer.isConnected){clear();return;}const dt=last&&!document.hidden?Math.min(.05,Math.max(0,(now-last)/1000)):0;last=now;
  const view=layer.ownerSVGElement?.viewBox?.baseVal;
  for(const b of active){b.age+=dt;const t=b.age,size=b.size;
   const onscreen=!view||!view.width||b.x>view.x-200&&b.x<view.x+view.width+200&&b.y>view.y-150&&b.y<view.y+view.height+250;
   b.g.setAttribute('visibility',onscreen?'visible':'hidden');if(!onscreen)continue;
   const flash=Math.max(0,1-t/.24);b.flash.setAttribute('r',size*(10+38*Math.min(1,t/.12)));opacity(b.flash,flash*.9);
   b.ring.setAttribute('rx',size*(10+150*Math.min(1,t/.85)));b.ring.setAttribute('ry',size*(5+48*Math.min(1,t/.85)));opacity(b.ring,(1-t/.85)*.5);
   opacity(b.fire,t<.12?t/.12:Math.max(0,1-(t-.12)/.75));b.fire.setAttribute('transform',`translate(0 ${-t*12}) scale(${size*(.7+Math.min(t,.25))})`);
   b.dust.forEach((n,i)=>{const a=i*2.399,d=18+Math.min(1,t/1.4)*66;n.setAttribute('transform',`translate(${Math.cos(a)*d*size} ${Math.sin(a)*d*.36*size+12}) scale(${size*(.5+Math.min(t,2)*.65)})`);opacity(n,Math.min(1,t/.15)*Math.max(0,1-t/2.8)*.3)});
   b.smoke.forEach((n,i)=>{const a=Math.max(0,t-i*.14),k=Math.min(1,a/1.3),fade=Math.max(0,1-(a-2.5)/(b.life-2.5));n.setAttribute('transform',`translate(${((i-2)*12+a*6)*size} ${(-18-a*13-i*6)*size}) scale(${size*(.35+k*.65+a*.055)})`);opacity(n,Math.min(1,a/.6)*fade*(b.wreck?.37:.29))});
   b.debris.forEach((n,i)=>{const a=i*1.26+.2,d=Math.min(t,1.2)*(62+i*8)*size;n.setAttribute('transform',`translate(${Math.cos(a)*d} ${Math.sin(a)*d*.45-70*t+90*t*t}) rotate(${t*(110+i*39)})`);opacity(n,Math.max(0,1-t/1.1))});
  }
  active=active.filter(b=>{if(b.age<b.life)return true;b.g.remove();return false;});if(active.length)schedule();else last=0;
 }
 function burst(point,{wreck=false,size=1,token=null}={}){
  if(disposed||!Number.isFinite(point.x)||!Number.isFinite(point.y))return;bind(token);
  // Merge dense simultaneous hits; later bombs keep their own impact timing.
  const nearby=active.find(b=>b.age<.16&&Math.hypot(b.x-point.x,b.y-point.y)<48);if(nearby){nearby.size=Math.max(nearby.size,size);nearby.wreck=nearby.wreck||wreck;nearby.life=Math.max(nearby.life,wreck?11:8.5);return;}
  if(active.length>=28){const old=active.shift();old.g.remove();}
  const seed=serial++,g=make('g',{transform:`translate(${point.x} ${point.y})`,'data-stealth-burst':seed},plumes);
  const ring=make('ellipse',{rx:10,ry:5,fill:'none',stroke:'#d8c5a4','stroke-width':4},g);
  const dust=Array.from({length:4},(_,i)=>make('ellipse',{rx:27+i*3,ry:13+i*2,fill:i%2?'#a99b7e':'#8d866f',opacity:0},g));
  const fire=make('path',{d:'M-27 6Q-42-12-18-27L-10-13Q-5-40 4-47Q6-20 21-25Q40-2 25 12Q0 24-27 6Z',fill:'#dd8c43',opacity:0},g);
  const flash=make('circle',{r:8,fill:'#fff0b3'},g);
  const debris=Array.from({length:5},(_,i)=>make('path',{d:'M-3-2L4-1L2 4L-3 2Z',fill:i%2?'#665e4c':'#b49e71'},g));
  const smoke=Array.from({length:5},(_,i)=>make('path',{d:'M-24 9Q-40-1-28-16Q-25-29-11-27Q-4-40 10-28Q29-31 31-15Q47-4 31 11Q19 27 4 20Q-13 28-24 9Z',fill:i%2?'#6e7068':'#575c57',opacity:0},g));
  active.push({g,ring,dust,fire,flash,debris,smoke,x:point.x,y:point.y,age:0,size,wreck,life:wreck?11:8.5});
  const old=scars.find(s=>Math.hypot(s.x-point.x,s.y-point.y)<55);
  if(!old){const n=make('g',{transform:`translate(${point.x} ${point.y}) scale(${size})`,opacity:'.32'},scarLayer);make('ellipse',{cx:0,cy:10,rx:35,ry:13,fill:'#383b32'},n);make('path',{d:wreck?'M-23 10L-13-3L5 2L17-5L29 13L10 18Z':'M-26 8Q0-10 28 8Q0-2-26 8Z',fill:'#575343'},n);scars.push({n,x:point.x,y:point.y});if(scars.length>60)scars.shift().n.remove();}
  schedule();
 }
 const onVisibility=()=>{last=0;if(document.hidden){if(raf)cancelAnimationFrame(raf);raf=0;}else schedule()};document.addEventListener('visibilitychange',onVisibility);
 const api={burst,reset:token=>bind(token),clear,dispose(){disposed=true;clear();root.remove();document.removeEventListener('visibilitychange',onVisibility);systems.delete(layer)},stats:()=>({active:active.length,scars:scars.length,raf:!!raf,nodes:root.querySelectorAll('*').length})};systems.set(layer,api);return api;
}
