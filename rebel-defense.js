import {makeMissileVisual,updateMissileVisual,fadeMissileTrail,impactFX} from './rebel-combat-fx.js';
import {DEFENSE_TYPES,defenseType,operational,rounds,createDefenseEngine} from './rebel-defense-core.js';
export {DEFENSE_TYPES};
let context=null,engine=null,raf=0,last=0,lastUI=0,selected=null,coverage='all',panel=null,rangeLayer=null,trackLayer=null,missileLayer=null;
const missileNodes=new Map();
const modes={search:'بحث',acquire:'تثبيت التتبع',track:'تتبع',engage:'اشتباك',reload:'تجهيز إطلاق',empty:'نفدت الذخيرة',disabled:'مدمر',silent:'الرادار صامت',hold:'إمساك النيران'};
const reserved=[[4,3],[4,13],[4,25],[5,36],[14,13],[15,3],[15,24],[15,36]];
export function deployDefenses(battle,{GRID,canPlaceFacility,hexDistance}){
 if(battle.adVersion===2)return; battle.adVersion=2;
 for(const d of battle.airDefenses){d.adType='short';d.missiles=DEFENSE_TYPES.short.ammo;d.maxMissiles=d.missiles;d.range=DEFENSE_TYPES.short.range;d.adGunAmmo=12;d.structureHp??=60;d.structureMaxHp=60;}
 for(const side of ['blue'])for(const [kind,desired] of (side==='blue'?[['medium',{x:14,y:15}],['long',{x:9,y:18}],['radar',{x:11,y:12}]]:[['medium',{x:26,y:12}],['long',{x:31,y:18}],['radar',{x:29,y:13}]])){
  const choices=[];
  for(let y=2;y<GRID.rows-2;y++)for(let x=2;x<GRID.columns-2;x++){
   if(battle.owners[y*GRID.columns+x]!==side||!canPlaceFacility(battle,x,y,'radar'))continue;
   const cell={x,y};if(reserved.some(([rx,ry])=>hexDistance(cell,{x:rx,y:ry})<3))continue;
   if([...battle.airDefenses,...battle.droneBases,...battle.units,...battle.logistics.depots].some(d=>hexDistance(cell,d)<2))continue;
   choices.push({x,y,d:hexDistance(cell,desired)});
  }
  choices.sort((a,b)=>a.d-b.d||a.y-b.y||a.x-b.x);const p=choices[0];if(!p)continue;
  const spec=DEFENSE_TYPES[kind];battle.airDefenses.push({id:side+'-ad-'+kind,side,x:p.x,y:p.y,adType:kind,range:spec.range,missiles:spec.ammo,maxMissiles:spec.ammo,structureHp:60,structureMaxHp:60,disabled:false});
 }
}
export function defenseArt(type){
 const hull='<path d="M-49 12L-40-3H22L35 5H47V25H-49Z" fill="#7f927f" stroke="#243a3c" stroke-width="2"/><path d="M-38 4H19V16H-42Z" fill="#b1bda0"/><path d="M27 5V-7H39L47 5Z" fill="#c6c5a0" stroke="#253c40" stroke-width="2"/><path d="M31-4H38L42 2H31Z" fill="#355966"/>'+[-35,-15,21,39].map(x=>`<circle cx="${x}" cy="25" r="7" fill="#26393d" stroke="#b0bc9e" stroke-width="2"/>`).join('');
 if(type==='radar')return hull+'<path d="M-8 10V-19M-22 11L-8-5L6 11" fill="none" stroke="#c1c9ac" stroke-width="4"/><g class="ad-dish"><path d="M-32-36L5-43L17-22L-20-14Z" fill="#496a71" stroke="#a7cdc7" stroke-width="2"/><path d="M-22-34L-9-17M-10-37L3-20M-29-27L9-34" stroke="#7ba6a8" stroke-width="1.3"/></g>';
 if(type==='short')return hull+'<path d="M-20-4V-22H8V-4Z" fill="#9dab8d" stroke="#253d3a" stroke-width="2"/><path d="M-19-17L-40-32M4-17L28-33" stroke="#d4d4af" stroke-width="5"/><path d="M-16-24L-20-40L-13-42L-8-27M2-24L-2-40L5-42L10-27" fill="#b8c7ad" stroke="#355352" stroke-width="2"/><path d="M-11-27Q-8-37-1-27M-6-30V-40" fill="none" stroke="#94c6c4" stroke-width="2"/>';
 const tubes=type==='long'?[-36,-22,-8,6]:[-30,-16,0];
 return hull+tubes.map((x,i)=>`<path d="M${x} 3L${x+13} ${type==='long'?-44:-32}L${x+23} ${type==='long'?-41:-27}L${x+10} 6Z" fill="${i%2?'#94a990':'#c0c7a6'}" stroke="#2e4946" stroke-width="2"/><path d="M${x+13} ${type==='long'?-43:-31}L${x+23} ${type==='long'?-40:-26}" stroke="#dfdbc0" stroke-width="3"/>`).join('');
}
export function renderDefenseSymbol(g,d,el){
 g.setAttribute('data-ad-id',d.id);g.classList.add('ad-v2-unit');
 el('rect',{x:-59,y:-55,width:118,height:98,rx:10,class:'ad-card'},g);
 const art=el('g',{class:'ad-vehicle'},g);art.innerHTML=defenseArt(d.adType);
 el('text',{x:0,y:64,'text-anchor':'middle',class:'ad-name'},g).textContent=defenseType(d).name;
 el('text',{x:0,y:-64,'text-anchor':'middle',class:'ad-stock'},g).textContent=d.adType==='radar'?'رصد شبكي':`ص ${rounds(d)} / ${d.maxMissiles}`;
 el('circle',{cx:46,cy:-42,r:5,class:'ad-led'},g);
 el('text',{x:0,y:85,'text-anchor':'middle',class:'ad-state'},g).textContent=d.disabled?'مدمر':'بحث';
 const title=el('title',{},g);title.textContent=`${defenseType(d).name} · رصد ${defenseType(d).sensor} خلية · اشتباك ${defenseType(d).range} خلية`;
}
const defenses=()=>[...context.battle.airDefenses,...context.battle.units.filter(d=>d.role==='antiAir')];
const point=d=>context.centers[d.y][d.x];
function el(tag,a,p){return context.el(tag,a,p)}
function event(e){
 if(e.type==='launch')context.battle.events.unshift(`${defenseType(e.defense).name}: ${e.weapon==='gun'?'رشقة مدفع':'إطلاق صاروخ'} نحو ${e.flight.kind==='stealth'?'هدف شبحي':e.flight.kind?'طائرة':'مسيرة'}.`);
 else {context.battle.events.unshift(`${defenseType(e.defense).name}: ${e.type==='hit'?'اعتراض ناجح':'لم يصب الهدف'}؛ الذخيرة ${rounds(e.defense)}.`);
  if(e.flight.kind==='stealth'){
  const g=el('g',{transform:`translate(${e.x} ${e.y})`,class:'ad-intercept-burst'},missileLayer);
  el('circle',{r:e.type==='hit'?25:13,fill:'none',stroke:e.type==='hit'?'#f8d799':'#b4cac7','stroke-width':3},g);
  el('path',{d:'M-20-12L-7-4M18-18L5-5M-16 17L-5 6M20 12L6 3',stroke:'#ffdfa5','stroke-width':3},g);setTimeout(()=>g.remove(),650);
  }else if(e.type==='miss'||!e.flight.kind)impactFX(missileLayer,{x:e.x,y:e.y},{kind:'air',size:e.type==='hit'?.9:.5});
 }
 context.battle.events=context.battle.events.slice(0,10);
}
export function prepareAirDefense(next){
 if(context?.battle===next.battle){context=next;return}
 if(raf)cancelAnimationFrame(raf);context=next;deployDefenses(next.battle,next);selected=next.battle.airDefenses.find(d=>d.side==='blue')?.id;last=0;missileNodes.clear();
 rangeLayer?.remove();trackLayer?.remove();missileLayer?.remove();
 rangeLayer=el('g',{class:'ad-range-layer'},next.svg);next.svg.insertBefore(rangeLayer,next.groups.sites);
 trackLayer=el('g',{class:'ad-track-layer'},next.svg);missileLayer=el('g',{class:'ad-missile-layer'},next.svg);
 let seed=(next.battle.droneSeed||103)>>>0;
 engine=createDefenseEngine({getDefenses:defenses,position:point,cellSize:next.HEX_RADIUS*Math.sqrt(3),random:()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296},onEvent:event});
 buildPanel();drawRanges();raf=requestAnimationFrame(frame);
}
export function pollDefense(flight,pose){if(!context?.battle.inFlightDrones?.includes(flight))return null;const shot=engine?.observe(flight,pose,performance.now())??null;if(shot?.hit)context.battle.inFlightDrones=context.battle.inFlightDrones.filter(f=>f!==flight);return shot}
export function finishDefenseFlight(flight){flight._adComplete=true;if(engine?.tracks.get(flight.id)?.flight===flight)engine.finish(flight.id)}
export function inspectDefense(d){selected=d.id;panel.hidden=false;refreshPanel();drawRanges()}
function buildPanel(){
 if(!document.getElementById('adOpen')){const button=document.createElement('button');button.id='adOpen';button.type='button';button.textContent='الدفاع الجوي';document.querySelector('.map-tools').prepend(button);button.onclick=()=>{panel.hidden=!panel.hidden;refreshPanel()};}
 if(!panel){panel=document.createElement('aside');panel.id='adPanel';panel.dir='rtl';panel.setAttribute('aria-label','شبكة الدفاع الجوي');panel.innerHTML=`<header><b>شبكة الدفاع الجوي</b><button type="button" data-close aria-label="إغلاق">×</button></header><label>المنظومة <select data-system></select></label><label>التغطية <select data-coverage><option value="all">شبكتا الطرفين</option><option value="selected">المنظومة المحددة</option><option value="blue">شبكة قواتك</option><option value="red">شبكة العدو</option><option value="none">إخفاء الدوائر</option></select></label><div class="ad-key"><span>◌ الرصد</span><span>— اشتباك</span><span>·· مدفع / حد داخلي</span></div><div data-details></div><div class="ad-actions"><button type="button" data-focus>الموقع</button><button type="button" data-hold>إمساك النيران</button><button type="button" data-silent>إسكات الرادار</button></div><p>مديات موزونة بخلايا اللعبة. الرادار يرصد ويوجّه؛ لا يطلق سلاحاً. تدميره يضعف الكشف المشترك.</p>`;document.querySelector('.map-frame').append(panel);
  panel.querySelector('[data-close]').onclick=()=>panel.hidden=true;
  panel.querySelector('[data-system]').onchange=e=>{selected=e.target.value;refreshPanel();drawRanges()};
  panel.querySelector('[data-coverage]').onchange=e=>{coverage=e.target.value;drawRanges()};
  panel.querySelector('[data-focus]').onclick=()=>{const d=defenses().find(d=>d.id===selected);if(d)context.focusPoint(d)};
  panel.querySelector('[data-hold]').onclick=()=>{const d=defenses().find(d=>d.id===selected);if(d?.side==='blue'&&operational(d)){d.adHold=!d.adHold;refreshPanel()}};
  panel.querySelector('[data-silent]').onclick=()=>{const d=defenses().find(d=>d.id===selected);if(d?.side==='blue'&&operational(d)){d.adSilent=!d.adSilent;drawRanges();refreshPanel()}};
 }
 panel.hidden=true;panel.querySelector('[data-coverage]').value=coverage;const select=panel.querySelector('[data-system]');select.replaceChildren();for(const d of defenses()){const o=document.createElement('option');o.value=d.id;o.textContent=(d.side==='blue'?'قواتك · ':'العدو · ')+defenseType(d).name;select.append(o)}refreshPanel();
}
function refreshPanel(){
 if(!panel||!engine)return;const d=defenses().find(d=>d.id===selected);if(!d)return;const spec=defenseType(d),s=engine.state(d);panel.querySelector('[data-system]').value=selected;
 const details=panel.querySelector('[data-details]');details.innerHTML=`<strong>${spec.name}</strong><dl><dt>الحالة</dt><dd>${modes[s.mode]}</dd><dt>الصحة</dt><dd>${d.structureHp??d.hp} / ${d.structureMaxHp??d.maxHp}</dd><dt>الرصد / الاشتباك</dt><dd>${spec.sensor} / ${spec.range} خلية</dd><dt>الصواريخ</dt><dd>${rounds(d)} / ${d.maxMissiles??d.maxAntiDroneAmmo??0}</dd>${spec.gun?`<dt>رشقات المدفع</dt><dd>${d.adGunAmmo??0} · مدى ${spec.gun}</dd>`:''}<dt>قنوات الاشتباك</dt><dd>${spec.slots}</dd><dt>تثبيت التتبع</dt><dd>${spec.lock} ثانية</dd><dt>الأهداف</dt><dd>${d.adType==='radar'?'إنذار مبكر ومشاركة الكشف':d.adType==='long'?'الطائرات والقاصفات':d.role==='antiAir'?'مسيرات ومروحيات وطائرات قريبة':'المسيرات والطائرات'}</dd></dl>`;
 for(const key of ['hold','silent']){const b=panel.querySelector('[data-'+key+']');b.disabled=d.side!=='blue'||!operational(d)||(key==='hold'&&d.adType==='radar')||(key==='silent'&&d.role==='antiAir');b.textContent=key==='hold'?(d.adHold?'السماح بالنيران':'إمساك النيران'):(d.adSilent?'تشغيل الرادار':'إسكات الرادار');}
}
let rangeStamp='';
function drawRanges(){
 if(!rangeLayer)return;rangeLayer.replaceChildren();const scale=context.HEX_RADIUS*Math.sqrt(3);
 for(const d of defenses().filter(d=>operational(d)&&!d.adSilent&&(coverage==='all'||(coverage==='selected'?d.id===selected:coverage===d.side)))){
  const p=point(d),s=defenseType(d),g=el('g',{transform:`translate(${p.x} ${p.y})`,class:'ad-coverage '+d.side},rangeLayer);
  el('circle',{r:s.sensor*scale,class:'ad-sensor'},g);if(s.range)el('circle',{r:s.range*scale,class:'ad-engagement'},g);
  if(s.min>.5)el('circle',{r:s.min*scale,class:'ad-minimum'},g);if(s.gun)el('circle',{r:s.gun*scale,class:'ad-gun-range'},g);
  if(d.adType==='radar')for(const ratio of [.38,.68])el('circle',{r:s.sensor*scale*ratio,class:'ad-radar-ring'},g);
  if(d.adType==='radar')el('path',{d:`M0 0L0 ${-s.sensor*scale}A${s.sensor*scale} ${s.sensor*scale} 0 0 1 ${s.sensor*scale*.342} ${-s.sensor*scale*.94}Z`,class:'ad-sweep'},g);
  el('text',{x:0,y:-s.sensor*scale-14,'text-anchor':'middle',class:'ad-range-label'},g).textContent=`${s.name} · رصد ${s.sensor}`;
 }
 rangeStamp=defenses().map(d=>`${d.id}:${d.disabled}:${d.adSilent}:${d.x}:${d.y}`).join('|');
}
function frame(now){
 if(!context)return;if(document.hidden){last=0;raf=requestAnimationFrame(frame);return}if(!last)for(const t of engine.tracks.values()){t.last=now;t.sampled=now;t.vx=0;t.vy=0}if(last&&now-last<32){raf=requestAnimationFrame(frame);return}const dt=last?Math.min(.08,(now-last)/1000):0;last=now;engine.step(dt,now);
 const ids=new Set();for(const m of engine.missiles){ids.add(m.id);let v=missileNodes.get(m.id);if(!v){const g=el('g',{class:'ad-projectile '+m.kind},missileLayer);v={g,...makeMissileVisual(g,{gun:m.kind==='gun',el})};missileNodes.set(m.id,v)}
  updateMissileVisual(v,{x:m.x,y:m.y,angle:m.angle,points:m.trail,age:m.age});}
 for(const [id,v] of missileNodes)if(!ids.has(id)){fadeMissileTrail(v,missileLayer);v.g.remove();missileNodes.delete(id)}
 if(now-lastUI>180){lastUI=now;trackLayer.replaceChildren();
  for(const t of engine.contacts.values()){const g=el('g',{transform:`translate(${t.x} ${t.y})`,class:'ad-contact'},trackLayer);el('path',{d:'M-22-9V-22H-9M9-22H22V-9M22 9V22H9M-9 22H-22V9',class:t.quality>=1?'locked':'acquiring'},g);el('text',{x:0,y:-32,'text-anchor':'middle'},g).textContent=t.quality>=1?'تتبع مثبت':'رصد '+Math.round(t.quality*100)+'٪';}
  for(const d of context.battle.airDefenses){const g=context.groups.logistics.querySelector(`[data-ad-id="${d.id}"]`);if(!g)continue;g.classList.toggle('disabled',!operational(d));const mode=engine.state(d).mode;g.setAttribute('data-ad-state',mode);g.querySelector('.ad-state').textContent=modes[mode];g.querySelector('.ad-stock').textContent=d.adType==='radar'?'رصد شبكي':`ص ${rounds(d)} / ${d.maxMissiles}${d.adType==='short'?' · م '+d.adGunAmmo:''}`;}
  if(!panel.hidden)refreshPanel();const stamp=defenses().map(d=>`${d.id}:${d.disabled}:${d.adSilent}:${d.x}:${d.y}`).join('|');if(stamp!==rangeStamp)drawRanges();
 }
 raf=requestAnimationFrame(frame);
}
