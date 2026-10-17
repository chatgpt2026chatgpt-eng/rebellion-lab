// Air Battle Lab only: presentation of resolved ground combat, no simulation writes.
const NS='http://www.w3.org/2000/svg';
const node=(tag,attrs,parent)=>{const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);parent.append(n);return n};
let sequence=0;const jobs=new Set();let frame=0,last=0;
function run(fn){jobs.add(fn);if(!frame){last=0;frame=requestAnimationFrame(tick)}}
function tick(time){frame=0;const dt=last?Math.min(.05,(time-last)/1000):.016;last=time;for(const fn of [...jobs])if(fn(dt)===false)jobs.delete(fn);if(jobs.size)frame=requestAnimationFrame(tick)}
export function groundWeapon(unit){if(unit.weaponId==='kornet')return 'kornet';if(['antiAir','droneOperator','droneVehicle','supplyTruck'].includes(unit.role)||unit.kind==='antiAir')return null;if(unit.modelId||['tank','ifv','scoutVehicle'].includes(unit.kind))return ['bradley','bmp3','zbd04'].includes(unit.modelId)||unit.kind==='ifv'?'cannon':'tank';return unit.kind==='sniper'?'sniper':unit.kind==='antiArmor'?'rocket':'rifle'}
// These sockets match the existing side-view card artwork; only facing is mirrored.
export function groundSocket(unit,center,scale,sign){const w=groundWeapon(unit),x=w==='sniper'?57:w==='rifle'?59:w==='rocket'?54:54,y=w==='kornet'?-21:w==='sniper'?-15:w==='rifle'?-38:w==='rocket'?-49:-27;return{x:center.x+x*scale*sign,y:center.y+y*scale}}
function puff(parent,x,y,r,color){return node('ellipse',{cx:x,cy:y,rx:r,ry:r*.65,fill:color,opacity:0},parent)}
export function groundFireFX(layer,from,to,{weapon='rifle',damage=0,armored=false,vehicle=false,destroyed=false,valid=()=>true,onRecoil=()=>{},onHit=()=>{},onReaction=()=>{}}={}){
 return new Promise(resolve=>{
 const root=node('g',{'class':'ground-v5-fx','pointer-events':'none'},layer),dx=to.x-from.x,dy=to.y-from.y,d=Math.hypot(dx,dy),angle=Math.atan2(dy,dx)*180/Math.PI,heavy=['tank','cannon','rocket','kornet'].includes(weapon),count=weapon==='rifle'?4:weapon==='cannon'?3:1,interval=weapon==='rifle'?.095:.12,travel=weapon==='kornet'?Math.max(.45,Math.min(1.8,d/600)):Math.max(.16,Math.min(.6,d/(heavy?1600:2600))),lastHit=travel+(count-1)*interval;
 const muzzle=node('g',{transform:`translate(${from.x} ${from.y}) rotate(${angle})`},root),flash=node('path',{d:heavy?'M-3 0L15-12L11-4L38 0L12 5L17 13Z':'M0 0L9-4L7-1L20 0L8 2L10 5Z',fill:'#ffc565'},muzzle);node('path',{d:'M0 0L13-2L23 0L13 3Z',fill:'#fff0ba'},flash.parentNode??muzzle);
 const smoke=Array.from({length:4},(_,i)=>puff(muzzle,-3-i*5,i%2*4,heavy?8:3,'#c4c3ac'));
 const defs=node('defs',{},root),gradientId='ground-v5-smoke-'+(++sequence),gradient=node('radialGradient',{id:gradientId},defs);node('stop',{offset:'0%','stop-color':'#afa995','stop-opacity':.85},gradient);node('stop',{offset:'65%','stop-color':'#aaa28f','stop-opacity':.45},gradient);node('stop',{offset:'100%','stop-color':'#8a857a','stop-opacity':0},gradient);for(const n of smoke)n.setAttribute('fill',`url(#${gradientId})`);
 const shots=Array.from({length:count},(_,i)=>({delay:i*interval,fired:false,hit:false,n:node('path',{d:heavy?'M-10-2H4L10 0L4 2H-10Z':'M-9 0H2',fill:heavy?'#cabd8d':'none',stroke:'#ffe0a0','stroke-width':heavy?1:2.1,'stroke-linecap':'round',opacity:0},root)}));
 const trail=weapon==='kornet'?Array.from({length:12},()=>puff(root,0,0,3,'#d8d2bc')):[];
 const target=node('g',{transform:`translate(${to.x} ${to.y})`},root),hot=node('path',{d:'M-10 5L-16-6L-4-9L0-21L8-8L19-4L12 9L0 14Z',fill:'#ffbd62',opacity:0},target);
 const debris=Array.from({length:armored?9:6},(_,i)=>({n:node('path',{d:armored?'M0 0L5-1':'M-3 0Q0-5 4 0Q1 4-3 0',stroke:armored?'#f5d29a':'none',fill:armored?'none':'#b4a084','stroke-width':2,opacity:0},target),a:i*2.399}));
 const dust=Array.from({length:6},(_,i)=>puff(target,(i-2.5)*6,5,6+i%3*2,'#b9a58c'));
 const plume=Array.from({length:5},(_,i)=>puff(target,(i-2)*7,-6,9+i%2*4,'#77766b'));
 for(const n of [...dust,...plume])n.setAttribute('fill',`url(#${gradientId})`);
 const fire=node('path',{d:'M-13 9Q-22-3-9-22L-7-9Q3-18 1-37Q19-22 12-9Q23 6 9 13Z',fill:'#e99642',opacity:0},target);
 const label=node('text',{x:0,y:42,'text-anchor':'middle',fill:'#fff1cc','font-size':18,'font-weight':700,opacity:0},target);label.textContent=destroyed?'دُمّرت':damage>0?'−'+damage:armored?'صَدّ':'أخفق';
 let age=0,first=false,settled=false,lastImpact=-100;const finish=value=>{if(!settled){settled=true;onRecoil(0);onReaction(0);resolve(value)}};
 run(dt=>{if(!root.isConnected||!valid()){root.remove();finish(false);return false}age+=dt;
 for(const [i,n]of trail.entries()){const t=age-i*.035,p=t/travel;n.setAttribute('cx',from.x+dx*Math.min(1,Math.max(0,p)));n.setAttribute('cy',from.y+dy*Math.min(1,Math.max(0,p)));n.setAttribute('opacity',t>0&&p<1?.28*(1-i/12):0);n.setAttribute('rx',2+i*.3);}
 let recoil=0,flashAmount=0;for(const s of shots){const t=age-s.delay;if(t>=0&&!s.fired)s.fired=true;if(t>=0&&t<.16){recoil=Math.max(recoil,Math.sin(Math.min(1,t/.16)*Math.PI)*(heavy?5:2));flashAmount=Math.max(flashAmount,Math.max(0,1-t/.075))}const p=Math.max(0,Math.min(1,t/travel));s.n.setAttribute('opacity',t>=0&&p<1?1:0);s.n.setAttribute('transform',`translate(${from.x+dx*p} ${from.y+dy*p}) rotate(${angle})`);if(t>=travel&&!s.hit){s.hit=true;lastImpact=age;if(!first){first=true;onHit()}}}
 if(!settled)onRecoil(recoil);muzzle.setAttribute('opacity',Math.max(0,1-age/(lastHit+.4)));for(const c of muzzle.children)if(c.tagName==='path'||c.tag==='path')c.setAttribute('opacity',flashAmount);
 for(const [i,n]of smoke.entries()){n.setAttribute('transform',`translate(${-age*8} ${-age*13}) scale(${1+age})`);n.setAttribute('opacity',Math.max(0,.22-age*.24))}
 const t=age-travel;if(!settled)onReaction(damage>0&&t>=0&&t<.18?Math.sin(t/.18*Math.PI)*(armored?3:5):0);if(t>=0){const pulse=age-lastImpact;const blast=heavy?(weapon==='tank'?1:.65):.24;hot.setAttribute('transform',`scale(${blast*(.5+Math.min(pulse,.2)*4)})`);hot.setAttribute('opacity',Math.max(0,1-pulse/.22));label.setAttribute('opacity',Math.min(1,t*8)*Math.max(0,1-(t-1)/.7));label.setAttribute('y',42-t*9);
 for(const q of debris){q.n.setAttribute('transform',`translate(${Math.cos(q.a)*t*(armored?95:35)} ${Math.sin(q.a)*t*48+t*t*70})`);q.n.setAttribute('opacity',Math.max(0,1-t/.55))}
 for(const [i,n]of dust.entries()){n.setAttribute('transform',`translate(${(i-2.5)*t*14} ${t*3}) scale(${.4+t*1.5})`);n.setAttribute('opacity',Math.max(0,Math.min(.27,t*2)*(1-t/1.1)))}
 const burning=destroyed&&vehicle;for(const [i,n]of plume.entries()){n.setAttribute('transform',`translate(${t*7} ${-t*(16+i*3)}) scale(${.4+t*.6})`);n.setAttribute('opacity',(burning?.38:heavy?.18:0)*Math.min(1,t*4)*Math.max(0,1-t/(burning?3.2:1.3)))}fire.setAttribute('transform',`scale(${.65+Math.sin(t*17)*.08} ${.75+Math.sin(t*21)*.13})`);fire.setAttribute('opacity',burning?Math.min(1,t*6)*Math.max(0,1-t/1.9):0);
 }
 if(age>=lastHit+.2)finish(true);if(age>=travel+(destroyed&&vehicle?3.3:1.8)){root.remove();return false}return true});
 });
}
