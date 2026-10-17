const NS='http://www.w3.org/2000/svg';
function node(tag,attrs,parent){const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));parent.append(n);return n}
const active=new Set();let raf=0,last=0;
function animate(fn){active.add(fn);if(!raf)raf=requestAnimationFrame(tick)}
function tick(now){const dt=last?Math.min(.045,(now-last)/1000):0;last=now;if(!document.hidden)for(const f of [...active])if(f(dt)===false)active.delete(f);if(active.size)raf=requestAnimationFrame(tick);else{raf=0;last=0}}
let plumeId=0;
function softFill(parent,color,el=node){const id='tac-plume-'+(++plumeId),defs=el('defs',{},parent),gradient=el('radialGradient',{id},defs);for(const [offset,opacity]of [['0%',.85],['48%',.6],['100%',0]])el('stop',{offset,'stop-color':color,'stop-opacity':opacity},gradient);return 'url(#'+id+')'}
const impactRoots=[];
export function impactFX(layer,p,{size=1,kind='bomb',label=''}={}){
 const air=kind==='air',shell=kind==='shell',drone=kind==='drone',power=shell?.8:drone?1.18:air?1.05:1.5,life=shell?2.7:air?2.6:4.2;
 const g=node('g',{class:'tac-impact tac-impact-v4 '+kind,transform:`translate(${p.x} ${p.y}) scale(${size*power})`},layer);
 const smokeFill=softFill(g,'#82877b'),dustFill=softFill(g,'#b8ab8c'),fireFill=softFill(g,'#efa044');
 impactRoots.push(g);while(impactRoots.length>14)impactRoots.shift().remove();
 if(!air)node('ellipse',{cx:0,cy:11,rx:32,ry:12,fill:'#514c3e',opacity:.25},g);
 const dust=[],smoke=[],flames=[],sparks=[];
 const shock=node('ellipse',{rx:7,ry:air?7:3,fill:'none',stroke:'#dcccaa','stroke-width':4,opacity:0},g);
 const hot=node('g',{},g);node('ellipse',{rx:35,ry:29,fill:fireFill},hot);node('ellipse',{rx:23,ry:18,fill:'#e7a04e'},hot);node('ellipse',{cx:-3,cy:-3,rx:13,ry:11,fill:'#ffe3a1'},hot);node('circle',{cx:-2,cy:-3,r:6,fill:'#fff1c9'},hot);
 for(let i=0;i<9;i++){const a=i*2.399;dust.push({n:node('ellipse',{rx:12+i%3*3,ry:7+i%2*3,fill:dustFill},g),x:Math.cos(a)*(35+i%3*8),y:Math.sin(a)*(air?34:16),delay:(i%3)*.035});}
 for(let i=0;i<7;i++){const group=node('g',{},g);for(let j=0;j<3;j++)node('ellipse',{cx:(j-1)*8,cy:j===1?-5:2,rx:12+j*2,ry:10+j,fill:smokeFill},group);smoke.push({n:group,x:Math.sin(i*2.4)*20,y:-12-i%3*7,delay:.12+i*.075,rise:air?18+i*3:28+i*3});}
 if(!air)for(let i=0;i<3;i++){const group=node('g',{},g);node('path',{d:'M-10 5Q-17-4-6-18Q-6-7 0-30Q10-18 5-9Q13-13 12-4Q17 8 0 9Z',fill:'#de863b'},group);node('path',{d:'M-5 4Q-8-3-1-13Q1-5 5-1Q9 7-2 7Z',fill:'#f5c365'},group);flames.push({n:group,x:(i-1)*12,phase:i*1.9});}
 for(let i=0;i<10;i++){const a=i*2.399;sparks.push({n:node('path',{d:i%3?'M0 0L5 1':'M0 0L4-2L7 2Z',fill:i%3?'none':'#554e41',stroke:i%3?'#e8bf76':'#645b49','stroke-width':1.8},g),x:Math.cos(a)*(65+i%4*15),y:Math.sin(a)*(air?65:45)-15});}
 const text=label?node('text',{x:0,y:70,'text-anchor':'middle',class:'tac-damage-label'},g):null;if(text)text.textContent=label;
 let age=0;animate(dt=>{if(!g.isConnected)return false;age+=dt;
  const flash=Math.max(0,1-age/.48);hot.setAttribute('transform',`scale(${.35+Math.min(age,.4)*2.6})`);hot.setAttribute('opacity',String(flash));
  shock.setAttribute('rx',String(7+age*110));shock.setAttribute('ry',String((7+age*110)*(air?1:.4)));shock.setAttribute('opacity',String(Math.max(0,.55-age/.85)));
  for(const q of dust){const t=Math.max(0,age-q.delay),travel=1-Math.exp(-t*2.5);q.n.setAttribute('transform',`translate(${q.x*travel} ${q.y*travel+8}) scale(${.3+t*.8})`);q.n.setAttribute('opacity',String(Math.max(0,Math.min(.57,t*4)*(1-t/1.9))));}
  for(const q of smoke){const t=Math.max(0,age-q.delay);q.n.setAttribute('transform',`translate(${q.x+9*t} ${q.y-q.rise*t}) scale(${.25+Math.min(2,t)*.43})`);q.n.setAttribute('opacity',String(Math.max(0,Math.min(.66,t*1.8)*(1-t/(life-q.delay)))));}
  for(const q of flames){const duration=shell?.5:drone?1:1.45;q.n.setAttribute('transform',`translate(${q.x} 3) scale(${.6+Math.sin(age*14+q.phase)*.12} ${.65+Math.sin(age*17+q.phase)*.2})`);q.n.setAttribute('opacity',String(Math.max(0,Math.min(.85,age*9)*(1-age/duration))));}
  for(const q of sparks){q.n.setAttribute('transform',`translate(${q.x*age} ${q.y*age+45*age*age}) rotate(${age*180})`);q.n.setAttribute('opacity',String(Math.max(0,1-age/.95)));}
  if(text)text.setAttribute('opacity',String(Math.max(0,1-(age-1.5))));
  if(age>=life){g.remove();const i=impactRoots.indexOf(g);if(i>=0)impactRoots.splice(i,1);return false}return true});return g;
}
// Fixed-size reusable smoke trail; never emits an unbounded particle stream.
export function makeMissileVisual(parent,{gun=false,el=node}={}){
 const smoke=el('g',{class:'missile-v4-smoke'},parent),smokeFill=gun?'#aab6ad':softFill(smoke,'#bdc1b3',el),trail=el('path',{class:'missile-v4-core-trail',fill:'none'},smoke),puffs=[];
 if(!gun)for(let i=0;i<14;i++)puffs.push(el('ellipse',{rx:2,ry:2,fill:smokeFill,opacity:0},smoke));
 const body=el('g',{class:'missile-v4-body'},parent);
 if(gun)el('path',{d:'M-6 0H8',stroke:'#f3dba6','stroke-width':2.5},body);
 else{
  el('path',{d:'M-15-3L-44 0L-15 3Z',fill:'#d87735',opacity:.8,class:'missile-v4-flame'},body);
  el('path',{d:'M-15-1.5L-33 0L-15 1.5Z',fill:'#ffe0a1',class:'missile-v4-hot'},body);
  el('path',{d:'M25 0L13-4H-15L-18-3V3L-15 4H13Z',fill:'#d7d8c5',stroke:'#344b50','stroke-width':1.2},body);
  el('path',{d:'M-11-3L-20-10H-24L-19 0L-24 10H-20L-11 3M4-3L0-8H-4L-1 0L-4 8H0L4 3',fill:'#95aaa8',stroke:'#354d51','stroke-width':.9},body);
  el('path',{d:'M13-4L25 0L13 4Z',fill:'#617a7f'},body);
  el('path',{d:'M-8-3V3',stroke:'#a79465','stroke-width':2},body);
 }
 return{smoke,trail,puffs,body,gun};
}
export function fadeMissileTrail(v,layer){if(v.gun)return;layer.append(v.smoke);let age=0;animate(dt=>{if(!v.smoke.isConnected)return false;age+=dt;v.smoke.setAttribute('opacity',String(Math.max(0,1-age/.8)));if(age>=.8){v.smoke.remove();return false}return true});}
export function updateMissileVisual(v,{x,y,angle,points=[],age=0}){
 v.body.setAttribute('transform',`translate(${x} ${y}) rotate(${angle*180/Math.PI})`);
 v.trail.setAttribute('d',points.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' '));
 v.trail.setAttribute('opacity',v.gun?'.12':'.22');v.trail.setAttribute('stroke-width',v.gun?'1':'4');
 for(let i=0;i<v.puffs.length;i++){const p=points[Math.floor(i*Math.max(0,points.length-1)/(v.puffs.length-1))];if(!p){v.puffs[i].setAttribute('opacity','0');continue}const old=1-i/v.puffs.length,r=2+old*6;v.puffs[i].setAttribute('cx',String(p.x+Math.sin(i*2.4+age)*old*4));v.puffs[i].setAttribute('cy',String(p.y-old*3));v.puffs[i].setAttribute('rx',String(r*1.4));v.puffs[i].setAttribute('ry',String(r));v.puffs[i].setAttribute('opacity',String((.1+(1-old)*.28)*Math.min(1,age*5)));}
}

export function shellFX(layer,from,to,{burst=1,onImpact=()=>{},label='',getValid=()=>true}={}){
 return new Promise(resolve=>{const root=node('g',{class:'tac-shell-fx'},layer),angle=Math.atan2(to.y-from.y,to.x-from.x),dx=to.x-from.x,dy=to.y-from.y,distance=Math.hypot(dx,dy),duration=Math.max(.23,Math.min(.55,distance/1700));let age=0,hit=false;
  const muzzle=node('g',{transform:`translate(${from.x} ${from.y}) rotate(${angle*180/Math.PI})`},root);node('path',{d:'M0 0L11-5L7-1L23 0L7 2L11 6Z',fill:'#ffdfa0'},muzzle);
  const shells=Array.from({length:burst},(_,i)=>({g:node('path',{d:'M-6 0H4L7 0L4-2H-6Z',fill:'#d8bd84',stroke:'#6b6250','stroke-width':.8},root),delay:i*.065}));
  animate(dt=>{if(!root.isConnected||!getValid()){root.remove();resolve(false);return false}age+=dt;muzzle.setAttribute('opacity',String(Math.max(0,1-age/.12)));
   for(const [i,s] of shells.entries()){if(i>0&&!s.hit&&age>=duration+s.delay){s.hit=true;impactFX(layer,{x:to.x+i*3,y:to.y-i*2},{size:.28,kind:'shell'})}const p=Math.max(0,Math.min(1,(age-s.delay)/duration));s.g.setAttribute('opacity',age<s.delay||p>=1?'0':'1');s.g.setAttribute('transform',`translate(${from.x+dx*p} ${from.y+dy*p-Math.sin(Math.PI*p)*Math.min(16,distance*.025)}) rotate(${angle*180/Math.PI})`)}
   if(!hit&&age>=duration){hit=true;onImpact();impactFX(layer,to,{size:burst>1?.65:.9,kind:'shell',label})}
   if(age>=duration+(burst-1)*.065){root.remove();resolve(true);return false}return true});
 });
}
export function munitionFX(layer,from,to,{heading=0,rocket=false,valid=()=>true,aim=null}={}){
 return new Promise(resolve=>{const g=node('g',{class:'tac-munition'},layer),missile=rocket?makeMissileVisual(g):null,body=missile?missile.body:node('g',{},g),trail=missile?missile.trail:node('path',{class:'tac-munition-trail',fill:'none'},g);
 if(!rocket){node('path',{d:'M0-15Q5-12 5-5V7L9 13H-9L-5 7V-5Q-5-12 0-15Z',class:'tac-munition-body'},body);node('path',{d:'M-4 5H4M-3-7H3',stroke:'#c9c3a0','stroke-width':1.5},body);}
 const d=Math.hypot(to.x-from.x,to.y-from.y),duration=Math.max(.6,Math.min(2.7,d/(rocket?690:510))),forward=Math.min(d*.38,180),c={x:from.x+Math.cos(heading)*forward,y:from.y+Math.sin(heading)*forward},sample=p=>({x:(1-p)**2*from.x+2*(1-p)*p*c.x+p*p*to.x,y:(1-p)**2*from.y+2*(1-p)*p*c.y+p*p*to.y}),points=[];let age=0;
 animate(dt=>{if(!g.isConnected||!valid()){g.remove();resolve(false);return false}if(aim){const nextAim=aim();if(!nextAim||!Number.isFinite(nextAim.x)||!Number.isFinite(nextAim.y)){g.remove();resolve(false);return false}to=nextAim;}age+=dt;const p=Math.min(1,age/duration),q=sample(p),next=sample(Math.min(1,p+.01));points.push(q);if(points.length>(rocket?25:5))points.shift();const angle=Math.atan2(next.y-q.y,next.x-q.x);
 if(missile)updateMissileVisual(missile,{x:q.x,y:q.y,angle,points,age});else{trail.setAttribute('d',points.map((v,i)=>(i?'L':'M')+v.x+' '+v.y).join(' '));body.setAttribute('transform',`translate(${q.x} ${q.y}) rotate(${angle*180/Math.PI+90}) scale(${1-p*.15})`);}
 if(p>=1){if(missile)fadeMissileTrail(missile,layer);g.remove();resolve(true);return false}return true});
 });
}
