import {center} from '/rebel-terrain.js';
const NS='http://www.w3.org/2000/svg';
function el(tag,attrs,parent){const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);parent.append(n);return n;}
let currentContext=null,installed=false,chooser=null;
function closeChooser(){chooser?.remove();chooser=null;}
function choosePart(baseId,original){
 const ctx=currentContext,b=ctx.battle,parts=b.campaignAssets.filter(a=>a.airbaseId===baseId),turn=b.turn,wasTargeting=ctx.targeting();
 closeChooser();chooser=document.createElement('aside');chooser.className='airport-chooser';chooser.dir='rtl';
 const title=document.createElement('strong');title.textContent='اختر الجزء المستهدف';chooser.append(title);
 for(const part of parts){const button=document.createElement('button');button.textContent=part.name.split(' · ').at(-1)+' · '+Math.round(part.structureHp)+'/'+part.structureMaxHp;button.onclick=()=>{
  closeChooser();if(b!==currentContext.battle||b.turn!==turn||b.phase!=='player'||ctx.busy()||wasTargeting!==ctx.targeting()){ctx.setHint('تغير وضع الأوامر؛ اختر المطار مرة أخرى.');return;}
  if(wasTargeting){const target=ctx.svg.querySelector('[data-campaign-id="'+part.id+'"]');target?.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,clientX:original.clientX,clientY:original.clientY}));}
  else ctx.showFacilityChoices('campaign:'+part.id);
 };chooser.append(button);}
 const cancel=document.createElement('button');cancel.textContent='إلغاء';cancel.onclick=closeChooser;chooser.append(cancel);document.body.append(chooser);
}
export function renderAirportGround(b,layer,ctx){
 currentContext=ctx;
 if(!installed){installed=true;window.addEventListener('click',e=>{
  const campus=e.target.closest?.('[data-airport-campus]');if(!campus)return;
  e.preventDefault();e.stopImmediatePropagation();const c=currentContext;if(c.busy()||c.battle.phase!=='player'||c.battle.finished)return;
  const id=campus.dataset.airportCampus,base=c.battle.campaignAirbases.find(a=>a.id===id);if(!base)return;
  if(!c.targeting()&&base.side==='blue'){closeChooser();window.__REBEL_LAB__?.activateAirbase?.(id);}else choosePart(id,e);
 },true);window.addEventListener('keydown',e=>{if(e.key==='Escape')closeChooser();});}
 for(const base of b.campaignAirbases??[]){
  const parts=b.campaignAssets.filter(a=>a.airbaseId===base.id);if(!parts.length)continue;
  const p=center(base.x,base.y),g=el('g',{class:'airport-campus','data-airport-campus':base.id,transform:`translate(${p.x} ${p.y})`,role:'button',tabindex:0,'aria-label':base.name+' · '+(base.side==='blue'?'فتح أوامر الطيران':'استهداف المطار')},layer);
  g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();g.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));}});
  el('rect',{x:-120,y:-73,width:240,height:146,rx:10,fill:'#737e71',stroke:base.side==='blue'?'#8acbd1':'#c5b998','stroke-width':2},g);
  const art=el('g',{'pointer-events':'none'},g);
  el('path',{d:'M-112-65H112V65H-112Z',fill:'none',stroke:'#b7b69b','stroke-width':1,'stroke-dasharray':'4 5'},art);
  el('path',{d:'M-82-20V8H80V-20M-3 8V28',fill:'none',stroke:'#4d5b59','stroke-width':15},art);
  el('path',{d:'M-82-20V8H80V-20M-3 8V28',fill:'none',stroke:'#c6b976','stroke-width':1},art);
  // All four parts stay within the original airport icon; logical durability is unchanged.
  const hangars=parts.filter(a=>a.part==='hangar'),service=parts.find(a=>a.part==='service'),runway=parts.find(a=>a.part==='runway');
  const layouts=hangars.map((a,i)=>({a,x:i?76:-79,y:-35,scale:.46}));if(service)layouts.push({a:service,x:0,y:-31,scale:.45});
  for(const{a,x,y,scale}of layouts){const n=el('g',{transform:`translate(${x} ${y}) scale(${scale})`},art);n.innerHTML=airportPartArt(a);if(a.structureHp<=0)n.setAttribute('opacity','.5');if(a.structureHp<a.structureMaxHp&&a.lastDamageTurn>=b.turn-1)el('ellipse',{cx:x,cy:y-10,rx:9,ry:17,fill:'#37403e',opacity:'.4'},art);}
  const r=el('g',{transform:'translate(0 38)'},art);r.innerHTML=`<rect x="-108" y="-16" width="216" height="32" rx="2" fill="#34454a" stroke="#c5c7b0" stroke-width="1.4"/><path d="M-86 0H86" stroke="#e5dfc4" stroke-width="1.5" stroke-dasharray="12 9"/><path d="M-100-10V10M-95-10V10M95-10V10M100-10V10" stroke="#dddcc4" stroke-width="2"/>`;
  if(runway?.structureHp<runway?.structureMaxHp)el('ellipse',{cx:14,cy:38,rx:runway.structureHp<=0?16:8,ry:7,fill:'#202e30'},art);
  const text=el('text',{x:0,y:91,'text-anchor':'middle',fill:base.side==='blue'?'#9de7eb':'#e3d2ad','font-size':15,'font-weight':700,'paint-order':'stroke',stroke:'#273f44','stroke-width':4},art);text.textContent=base.name;
 }
}
export function airportPartArt(a){
 const broken=a.structureHp<=0;
 if(a.part==='runway')return `<g transform="rotate(-35)" stroke-linejoin="round"><rect x="-145" y="-25" width="290" height="50" rx="3" fill="#36464a" stroke="#bcc1af" stroke-width="2"/><path d="M-135-20H135M-135 20H135" stroke="#d7d8c5" stroke-width="1.2"/><path d="M-107 0H107" stroke="#e7dfbf" stroke-width="2" stroke-dasharray="16 12"/><path d="M-128-16V16M-121-16V16M121-16V16M128-16V16" stroke="#dddcc8" stroke-width="3"/><g fill="#d5b876"><circle cx="-143" cy="-29" r="2"/><circle cx="143" cy="-29" r="2"/><circle cx="-143" cy="29" r="2"/><circle cx="143" cy="29" r="2"/></g>${broken?'<ellipse cx="15" cy="3" rx="26" ry="14" fill="#252c2c"/><path d="M-12 8L-30 18M35-2L55-15M4-8L-2-22" stroke="#222c2d" stroke-width="3"/>':''}</g>`;
 if(a.part==='service')return `<g stroke="#3c514e" stroke-width="1.6" stroke-linejoin="round"><path d="M-55 29V-6H18V29Z" fill="#b5b49a"/><path d="M-55-6L-44-17H29L18-6Z" fill="#d0cbb0"/><path d="M18-6L29-17V18L18 29Z" fill="#889987"/><path d="M-44 2H-32V13H-44ZM-24 2H-12V13H-24ZM-4 6H9V29H-4Z" fill="#3d5c62"/><path d="M34 24V-26H47V24Z" fill="#c2c4ad"/><path d="M27-27V-44H53V-27Z" fill="#496b75"/><path d="M25-44L32-50H57L53-44Z" fill="#c5c8b4"/><path d="M27-35H53M35-43V-27M45-43V-27" stroke="#99b4b0"/><path d="M43-50V-62" stroke="#d2d1ad"/></g>`;
 return `<g stroke="#3b514e" stroke-width="1.7" stroke-linejoin="round"><path d="M-55 29V-8Q-28-38 0-8V29Z" fill="#bec2a8"/><path d="M-55-8Q-28-38 0-8L48-24Q20-54-8-25Z" fill="#d4d0b5"/><path d="M0-8L48-24V13L0 29Z" fill="#859a8b"/><path d="M-48 29V-6Q-28-28-7-6V29Z" fill="${broken?'#252f30':'#344d53'}"/><path d="M-44 0H-10M-44 7H-10M-44 14H-10" stroke="#698078" stroke-width="1"/><path d="M5-1L43-14M5 9L43-4" stroke="#b5bda6"/><path d="M-50 31H3" stroke="#d5c38c" stroke-width="3"/>${broken?'<path d="M-50 28L-31 6L-15 23L-1 12L22 29Z" fill="#7f8173"/>':''}</g>`;
}
