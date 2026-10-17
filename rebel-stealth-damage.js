// AIR_BATTLE_STEALTH_DAMAGE_V1 — game balance, not physical weapon modelling.
export function stealthUnitDamage(distance,cellSize,armor=1,cover=1){
 if(!Number.isFinite(distance)||distance<0||!(cellSize>0))return 0;
 const d=distance/cellSize,protection=Math.max(.65,Number(armor)||1);
 if(d<=.22)return Math.round(600*Math.max(.1,Math.min(1,cover))/protection);
 if(d>=1.6)return 0;
 return Math.max(0,Math.round(180*Math.pow((1.6-d)/1.38,1.35)*Math.max(.1,Math.min(1,cover))/protection));
}
export function applyStealthUnitDamage(unit,amount){
 const before=unit.strength,hp=Math.max(0,Number(unit.hp)||0);
 const dealt=Math.min(hp,Math.max(0,Math.round(amount)));
 if(!dealt||before<=0)return{dealt:0,lost:0,destroyed:false};
 unit.hp=hp-dealt;
 unit.strength=unit.hp===0?0:Math.min(before,Math.ceil(unit.hp/Math.max(1,unit.hpPerStrength||hp/before)));
 unit.morale=Math.max(0,(unit.morale??100)-Math.ceil(30*dealt/Math.max(1,hp)));
 unit.hitFlash=false;
 if(unit.hp===0){unit.order=null;unit.moved=true;unit.attacked=true;unit.hidden=false;unit.ambushReady=false;}
 return{dealt,lost:before-unit.strength,destroyed:unit.hp===0};
}
