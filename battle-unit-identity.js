import {armorTier} from './battle-ground-rules.js';
export function decorateIdentity(g,unit,el,rebel=false) {
  const blue=unit.side==='blue',tier=armorTier(unit),badge=el('g',{class:'faction-identity','pointer-events':'none'},g);
  el('rect',{x:-79,y:-65,width:158,height:26,rx:5,class:'identity-banner'},badge);
  el('path',{d:blue?'M-72-59H-51V-46H-72ZM-68-55H-55V-50H-68Z':'M-62-61L-49-52L-62-43L-75-52Z',class:'identity-emblem','fill-rule':'evenodd'},badge);
  if(tier){
    for(let i=0;i<tier;i++){
      const x=8+(i-(tier-1)/2)*23;
      el('path',{d:'M0-10L3-3L10-3L5 2L7 9L0 5L-7 9L-5 2L-10-3L-3-3Z',transform:`translate(${x} -52)`,class:'armor-tier-star'},badge);
    }
    el('title',{},badge).textContent=`تصنيف قوة الموديل: ${tier} من 3؛ الصحة تظهر بالشريط السفلي`;
  }else el('text',{x:3,y:-46,'text-anchor':'middle',class:'identity-name'},badge).textContent=blue?'قواتك':rebel?'تمرد':'خصم';
  el('path',{d:blue?'M-78-31V38M-70-31V38':'M69-30L78-22M69-10L78-2M69 10L78 18M69 30L78 38',class:'identity-side-mark'},g);
  el('rect',{x:-91,y:-77,width:182,height:151,rx:17,class:'identity-selection','pointer-events':'none'},g);
}
