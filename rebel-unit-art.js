// AIR_BATTLE_VISUAL_REFRESH_V1 — presentation only, no simulation state.
const cache=new Map();
const armor=new Set(['tank','ifv','abrams','t90m','type99a','bradley','bmp3','zbd04']);
const palettes={abrams:['#b7aa83','#d3c5a0'],bradley:['#aa9c78','#cabc96'],t90m:['#78846b','#a5ad89'],bmp3:['#748675','#9cb398'],type99a:['#7f8b75','#b4b797'],zbd04:['#7c9182','#a3b9a4']};
export function unitArtwork(kind,source){
 if(cache.has(kind))return cache.get(kind);
 const template=document.createElement('template');template.innerHTML='<svg xmlns="http://www.w3.org/2000/svg">'+source+'</svg>';
 const root=template.content.firstElementChild,first=root.querySelector('path');
 const parts=first.getAttribute('d').match(/[Mm][^Mm]*/g)||[];
 const [base,light]=palettes[kind]||['#81927b','#b3bea0'];
 const soldier=['infantry','sniper','antiArmor','antiAir','droneOperator'].includes(kind);
 const group=document.createElementNS(root.namespaceURI,'g');
 parts.forEach((d,i)=>{
  const p=document.createElementNS(root.namespaceURI,'path');p.setAttribute('d',d);
  let fill=base;
  if(armor.has(kind)){fill=i===0?base:i===1?'#273336':/[Aa]/.test(d)?'#60706a':light;}
  else if(soldier){fill=i===0?light:i===1&&kind==='infantry'?'#bda98b':i>=parts.length-3?'#52656a':i%3===0?light:base;}
  else fill=/[Aa]/.test(d)?'#293538':i%3===0?light:base;
  p.setAttribute('fill',fill);p.setAttribute('stroke','#233334');p.setAttribute('stroke-width','1.5');p.setAttribute('stroke-linejoin','round');group.append(p);
 });first.replaceWith(group);
 root.querySelectorAll('path[fill="none"]').forEach(p=>p.setAttribute('stroke','#d0d8bd'));
 let accents='';
 if(armor.has(kind))accents='<path d="M-54 2H47M-43 4V12M-22 4V12M0 4V12M22 4V12" fill="none" stroke="#dee1c4" stroke-opacity=".48" stroke-width="1.3"/><path d="M-58-3L-48-6M46-3L55 0" stroke="#e5d7a5" stroke-width="3"/>';
 if(kind==='infantry'||kind==='antiAir'||kind==='antiArmor')accents='<path d="M-34-9L-24-14L-16-10L-20 5L-32 1Z" fill="#596b57" stroke="#263a33"/><path d="M-30-7L-22-5M-31-1L-24 1" stroke="#c0c6a7" stroke-width="2"/>';
 if(kind==='droneOperator')accents='<path d="M-8-19L9-21L12-12L-5-10Z" fill="#263f49" stroke="#cfceac"/><path d="M-5-17L6-18L7-14L-4-13Z" fill="#79b7b6"/>';
 const result='<ellipse cx="0" cy="37" rx="55" ry="6" fill="#112326" opacity=".24"/>'+root.innerHTML+accents;
 cache.set(kind,result);return result;
}
export function decorateUnitCard(parent,kind,el){
 const armored=armor.has(kind),drone=kind.startsWith('drone');
 const color=armored?'#d4bc84':drone?'#98c6c1':kind==='antiAir'?'#c6add0':kind==='supplyTruck'?'#c4bc9c':'#b1c49c';
 el('path',{d:'M-69-40V-54H-48M48-54H69V-40M-69 33V42H-49M49 42H69V33',fill:'none',stroke:color,'stroke-width':2,opacity:.65},parent);
 el('path',{d:armored?'M-8-54L0-60L8-54L0-48Z':drone?'M-10-54H10M0-61V-47M-6-59L6-49M6-59L-6-49':'M-7-58L0-52L7-58M-7-53L0-47L7-53',fill:armored?color:'none',stroke:color,'stroke-width':2},parent);
}
export const droneArtwork='<path d="M27 0L14-3L-17-3L-25-9L-29-9L-25 0L-29 9L-25 9L-17 3L14 3Z" fill="#c6cdbe" stroke="#263b40" stroke-width="1.2"/><path d="M4-2L-9-21L-16-21L-9-2ZM4 2L-9 21L-16 21L-9 2Z" fill="#91aaa3" stroke="#263b40" stroke-width="1.2"/><path d="M16-2L21 0L16 2" fill="#375861"/><path d="M-9-15L-13-15M-9 15L-13 15" stroke="#dcd3ab" stroke-width="2"/>';
export const launcherArtwork='<ellipse cx="0" cy="25" rx="43" ry="6" fill="#172a2e" opacity=".3"/><path d="M-39 17H36V25H-39Z" fill="#4d6260" stroke="#23373a" stroke-width="2"/><path d="M-26 18L-12-3H8L22 18M-20 18V25M18 18V25" fill="#9bab8c" stroke="#23373a" stroke-width="3"/><path d="M-30 2L23-30L28-24L-24 9ZM-21 10L32-22L37-16L-15 17Z" fill="#bdc6a6" stroke="#263b3d" stroke-width="2"/><path d="M-24 1L22-26M-15 9L30-18" stroke="#e4dfc0" stroke-width="2"/><path d="M-40 17V-13M-45-12Q-40-18-35-12" fill="none" stroke="#a4beb5" stroke-width="2"/>';
