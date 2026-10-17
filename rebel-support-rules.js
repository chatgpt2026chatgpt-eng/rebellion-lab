import {blastCover} from './rebel-command-policy.js';
import {fatigueFireFactor,recordMoraleDamage} from './rebel-morale.js';
import {commandAttackFactor} from './rebel-campaign.js';
import {civilianImpact,assetDamaged} from './rebel-campaign.js';
import {artilleryFacilities} from './rebel-facilities.js';
import {elevationAt} from './rebel-terrain.js';
export const SUPPORT_PROFILES=Object.freeze({fieldArtillery:{range:7,min:2,radius:0,damage:68,splash:0,rounds:1,name:'مدفعية ميدانية'},mortar:{range:4,min:2,radius:1,damage:42,splash:18,rounds:3,name:'هاون'},katyusha:{range:7,min:2,radius:1,damage:62,splash:34,rounds:6,name:'كاتيوشا'}});
export function droneAllowance(battle,source){if(!source||source.strength<=0)return 0;const cap=source.role==='droneVehicle'?4:1,used=source.droneBudgetTurn===battle.turn?(source.dronesUsedThisTurn??0):source.lastDroneLaunchTurn===battle.turn?1:0;return Math.max(0,Math.min(source.droneStock??0,cap-used));}
export function spendDrone(battle,source){const used=source.droneBudgetTurn===battle.turn?(source.dronesUsedThisTurn??0):0;source.droneBudgetTurn=battle.turn;source.dronesUsedThisTurn=used+1;}
export function contactVisible(battle,unit,viewer,distance,sight=()=>true,elevation=()=>0){
 if(!unit||unit.strength<=0)return false;if(unit.side===viewer)return true;
 return battle.units.some(o=>o.side===viewer&&o.strength>0&&o.role!=='supplyTruck'&&distance(o,unit)<=(unit.hidden?1:o.role==='reconRadar'?9:o.kind==='sniper'?6:o.modelId?5:4)+(unit.hidden?0:elevation(o.x,o.y)>=.3?3:0)&&sight(o,unit));
}
export function supportCheck(battle,id,x,y,side,grid,distance){
 const unit=battle.units.find(u=>u.id===id),profile=SUPPORT_PROFILES[unit?.role];
 if(!unit||!profile||unit.strength<=0||unit.side!==side)return{ok:false,reason:'اختر مدفعية أو هاوناً أو كاتيوشا.'};
 if(battle.finished||battle.phase!==(side==='blue'?'player':'enemy')||unit.attacked||unit.pinned||unit.ammo<1)return{ok:false,reason:'الوحدة أطلقت أو مثبّتة أو بلا ذخيرة، أو ليس دورها.'};
 if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=grid.columns||y>=grid.rows)return{ok:false,reason:'اختر خلية داخل الخريطة.'};
 const d=distance(unit,{x,y}),range=profile.range+(elevationAt(unit.x,unit.y)>=.3?1:0);if(d<profile.min||d>range)return{ok:false,reason:`مدى ${profile.name}: ${profile.min}–${range} خلايا.`};
 return{ok:true,unit,profile,x,y,radius:profile.radius,range,distance:d};
}
export function supportFire(battle,check,side,distance,models,cover=()=>1){
 if(battle.armistice?.active)return{ok:false,reason:'القصف متوقف أثناء الهدنة.'};if(!check.ok)return check;const {unit,profile,x,y,radius}=check;unit.ammo--;unit.attacked=true;unit.moved=true;unit.hidden=false;unit.order={artillery:{x,y}};
 const impacts=[];
 for(const target of battle.units){const d=distance(target,{x,y});if(target.side===side||target.strength<=0||target.domain==='air'||d>radius)continue;
 const armor=models[target.modelId],base=(d?profile.splash:profile.damage)*(armor?.category==='tank'?.62:armor?.category==='ifv'?.82:1)*Math.min(cover(target.x,target.y,true),blastCover(battle,target));
 const damage=Math.min(target.hp,Math.max(1,Math.round(base*fatigueFireFactor(unit)*commandAttackFactor(battle,unit,'artillery')))),before=target.strength;target.hp-=damage;target.strength=Math.max(0,Math.ceil(target.hp/target.hpPerStrength));target.morale=Math.max(0,target.morale-12-Math.round(damage*.12));if(target.side!==side){unit.kills+=before-target.strength;if(contactVisible(battle,target,side,distance))recordMoraleDamage(unit,target,damage);}impacts.push({unit:target,x:target.x,y:target.y,damage,lost:before-target.strength,observed:contactVisible(battle,target,side,distance)});
 }
 impacts.push(...artilleryFacilities(battle,unit,x,y,radius,distance));
 for(const o of Object.values(battle.mapObjects??{})){const d=distance(o,{x,y});if(o.category!=='building'||d>radius)continue;const amount=(d?profile.splash:profile.damage)*commandAttackFactor(battle,unit,'artillery');if(o.hp>0){const hit=Math.min(o.hp,amount);o.hp-=hit;o.status=o.hp<=0?'destroyed':'damaged';assetDamaged(battle,o,hit);}civilianImpact(battle,o.x,o.y,amount,side);}
 const result={...check,impacts,ammo:unit.ammo};battle.lastArtilleryResult=result;
 battle.events.push(`${profile.name}: ${profile.rounds} مقذوفات في الرشقة · ${impacts.filter(i=>i.observed!==false).length} إصابات مرصودة؛ الأهداف المخفية تحتاج استطلاعاً.`);battle.events=battle.events.slice(-8);return result;
}
