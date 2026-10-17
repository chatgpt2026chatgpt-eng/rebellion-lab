import {recordMoraleDamage} from './rebel-morale.js';
import {assetDamaged,upgradeStructures,commandAttackFactor} from './rebel-campaign.js';
// Shared by Air Battle and Rebellion only. Pure rules; no DOM or global state.
export const ARMOR_TIERS = Object.freeze({abrams:3,t90m:3,type99a:2,bradley:1,bmp3:1,zbd04:1});
export const armorTier = unit => ARMOR_TIERS[unit?.modelId] ?? 0;
const indirect = new Set(['fieldArtillery','katyusha','mortar']);
export function directWeapon(unit) {
  return !!unit && unit.strength>0 && unit.domain!=='air' && unit.modelId!=='strykerAA'
    && !indirect.has(unit.role) && !['commander','jammer','supplyTruck','droneOperator','droneVehicle','antiAir','reconRadar'].includes(unit.role)
    && unit.kind!=='antiAir' && unit.kind!=='engineer' && unit.ammo>0;
}
export function canReact(battle,defender,attacker,range,distance,sight=()=>true) {
  return !battle.finished && (defender.weaponId!=='kornet'||(defender.ammo>=1&&defender.lastKornetFireTurn!==battle.turn&&defender.kornetMovedTurn!==battle.turn)) && directWeapon(defender) && directWeapon({...attacker,ammo:1})
    && defender.side!==attacker.side && !defender.stoppedByMine && !defender.pinned
    && defender.reactionTurn!==battle.turn && distance(defender,attacker)<=range(defender) && sight(defender,attacker);
}
export function recordExchange(battle,attacker,defender,damage,kind='attack') {
  recordMoraleDamage(attacker,defender,damage);
  battle.groundExchanges??=[];
  battle.groundExchanges.push({attacker:{...attacker},target:{...defender},damage,kind});
  if(battle.groundExchanges.length>100)battle.groundExchanges.shift();
}
export function takeExchanges(battle) {return (battle.groundExchanges??[]).splice(0);}
export function targetValue(unit) {
  if(unit.role==='commander')return 28;if(unit.role==='jammer')return 24;
  if(unit.modelId)return 10+armorTier(unit)*3;
  if(indirect.has(unit.role))return 23;
  if(unit.role==='droneVehicle')return 22;
  if(unit.role==='droneOperator')return 19;
  if(unit.role==='supplyTruck')return 18;
  if(unit.role==='reconRadar')return 20;
  if(unit.role==='antiArmor')return 15;
  if(unit.kind==='engineer')return 16;
  if(unit.kind==='sniper')return 14;
  return 9;
}
export function targetScore(attacker,target,contacts,distance) {
  const armor=!!target.modelId,anti=attacker.role==='antiArmor'||attacker.kind==='antiArmor';
  const suitability=armor?(anti?18:attacker.modelId?8:attacker.kind==='sniper'?-22:-16):anti?-4:0;
  const isolated=contacts.filter(u=>u!==target&&u.side===target.side&&distance(u,target)<=2).length;
  return targetValue(target)+suitability+(1-target.hp/Math.max(1,target.maxHp))*12
    -Math.min(isolated,4)*3-distance(attacker,target)*1.3;
}
export function facilityTargets(battle) {
  return [...(battle.refineries??[]).map(asset=>({id:'refinery:'+asset.id,asset,type:'refinery',name:asset.name})),...(battle.campaignAssets??[]).map(asset=>({id:'campaign:'+asset.id,asset,type:asset.type,name:asset.name})),...(battle.logistics?.depots??[]).map(asset=>({id:'depot:'+asset.id,asset,type:'depot',name:asset.name??'مركز إمداد'})),
    ...(battle.droneBases??[]).map(asset=>({id:'baseTarget:'+asset.id,asset,type:'base',name:'قاعدة مسيرات'})),
    ...(battle.airDefenses??[]).map(asset=>({id:'radar:'+asset.id,asset,type:'radar',name:'منظومة دفاع'}))]
    .map(t=>{const {x,y}=t.asset,near=(battle.sites??[]).slice().sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0],label=t.type==='factory'||t.asset.industryRole==='factory'?'مصنع مسيرات':t.type==='refinery'?'مصفاة النفط':t.type==='base'?'قاعدة مسيرات':t.type==='radar'?'منظومة رصد جوي':t.type==='depot'?'مركز إمداد':t.name??'منشأة';return{...t,name:t.asset.name??(near?`${label} · ${near.name}`:`${label} · القطاع ${x+1}/${y+1}`),x,y,side:t.asset.side,hp:t.asset.structureHp??(t.type==='base'?90:t.type==='radar'?60:100)}});
}
function note(battle,text){battle.events.push(text);battle.events=battle.events.slice(-8);}
export function syncFacilities(battle) {
  if(battle.campaign)upgradeStructures(battle);
  for(const {asset,type} of facilityTargets(battle)){
    asset.structureMaxHp??=type==='base'?90:type==='radar'?60:100;
    asset.structureHp??=asset.disabled?0:asset.structureMaxHp;
    asset.originalSide??=asset.side;
    if(asset.structureHp>0&&!asset.disabled)continue;
    asset.structureHp=0;asset.disabled=true;asset.status='destroyed';
    if(type==='depot'){asset.auto=false;asset.ammo=0;asset.fuel=0;asset.engineeringStores=0;}
    if(type==='base')for(const k of Object.keys(asset.stock??{}))asset.stock[k]=0;
    if(type==='radar'){asset.missiles=0;asset.range=0;}
  }
}
export function captureFacilities(battle,distance) {
  syncFacilities(battle);
  for(const t of facilityTargets(battle)){
    const a=t.asset;
    const occupier=battle.units.find(u=>u.strength>0&&u.role!=='supplyTruck'&&u.domain!=='air'&&u.side!==a.side&&distance(u,a)===0);
    if(!occupier||battle.units.some(u=>u.strength>0&&u.role!=='supplyTruck'&&u.domain!=='air'&&u.side===a.side&&distance(u,a)<=1))continue;
    const old=a.side;a.side=occupier.side;a.status='captured';a.capturedTurn=battle.turn;if(a.type==='commandPost'){battle.campaign.disrupted[old]=battle.turn+2;}
    if(t.type==='base')a.lastLaunchTurn=battle.turn;
    if(t.type==='depot'){a.auto=false;battle.logistics.queue=(battle.logistics.queue??[]).filter(q=>q.side!==old||battle.logistics.depots.some(d=>d.side===old&&!d.disabled));}
    note(battle,`تمت السيطرة على ${t.name}؛ أصبح تابعاً لـ${a.side==='blue'?'قواتك':'الخصم'}.`);
  }
}
export function damageFacility(battle,id,amount,side) {
  syncFacilities(battle);
  const t=facilityTargets(battle).find(t=>t.id===id);if(!t||t.asset.disabled||t.side===side)return null;
  const damage=Math.min(t.asset.structureHp,Math.max(0,Math.round(amount)));
  t.asset.structureHp-=damage;assetDamaged(battle,t.asset,damage);syncFacilities(battle);
  if(!t.asset.disabled)t.asset.status='damaged';
  note(battle,t.asset.disabled?`دُمّر ${t.name} وتوقفت خدماته.`:`أصيب ${t.name}: ${damage} ضرر؛ الصحة ${t.asset.structureHp}/${t.asset.structureMaxHp}.`);
  return {...t,damage,hp:t.asset.structureHp,destroyed:t.asset.disabled};
}
export function artilleryFacilities(battle,unit,x,y,radius,distance) {
  const results=[];
  for(const t of facilityTargets(battle)){
    const d=distance(t,{x,y});if(d>radius||t.side===unit.side||t.asset.disabled)continue;
    const base=unit.role==='fieldArtillery'?54:unit.role==='mortar'?32:38;
    const hit=damageFacility(battle,t.id,base*(d?0.55:1)*commandAttackFactor(battle,unit,'artillery'),unit.side);
    if(hit)results.push({...hit,unit:null,x:t.x,y:t.y});
  }
  return results;
}
export function rebellionObjectives(battle) {
  syncFacilities(battle);
  const cities=battle.sites.filter(s=>s.radius>=2);
  const forces=battle.units.filter(u=>u.side==='red'&&u.strength>0&&u.role!=='supplyTruck');
  const facilities=facilityTargets(battle).filter(t=>t.asset.originalSide==='red');
  const secured=cities.filter(s=>s.owner==='blue'&&!s.contested).length;
  const neutralized=facilities.filter(t=>t.side==='blue'||t.asset.disabled).length;
  return {cities:secured,totalCities:cities.length,forces:forces.length,facilities:neutralized,totalFacilities:facilities.length,
    won:cities.length>0&&secured===cities.length&&forces.length===0&&neutralized===facilities.length};
}
