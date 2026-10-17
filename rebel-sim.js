import {blastCover} from './rebel-command-policy.js';
import {truceMoveRisk,truceWithdrawal} from './rebel-command-policy.js';
import {finishMoraleRound,applyCityMorale,cityMoraleEvent,fatigueFireFactor,fatigueMovement} from './rebel-morale.js';
import {planRebelFronts,frontPlanFor,rebelPositionScore} from './rebel-front-plans.js';
import {startSituationRound,finishSituationRound} from './rebel-situation-reports.js';
import {initIntelligence,intelligenceTick,knownTargets} from './rebel-intelligence.js';
import {seedMountainCaves,planTunnelMove,executeTunnelMove,balanceTunnelSupply} from './rebel-caves.js';
import {initCampaign,campaignTick,leadership,commandAttackFactor,intelCommandBonus,engineerRepairJobs,queueEngineerRepair,moveCampaignUnit,civilianImpact,jamDrone,assetDamaged,supplyDepot} from './rebel-campaign.js';
import {ensureDroneInventory,droneDamageFactor} from './rebel-drone-roles.js';
import {seedDroneIndustry,advanceDroneIndustry} from './rebel-drone-industry.js';
import {droneAllowance,spendDrone,SUPPORT_PROFILES} from './rebel-support-rules.js';
import {directWeapon,canReact,recordExchange,targetScore,targetValue,facilityTargets,syncFacilities,captureFacilities,damageFacility,rebellionObjectives} from './rebel-facilities.js';
import {THEATER as MAP_THEATER,GRID as MAP_GRID,CITIES as MAP_CITIES,mountainCells,elevationAt,passAt,terrainAt,movementCost,terrainSight,coverMultiplier,ROAD_LINES as MAP_ROADS,RIVER_POINTS as MAP_RIVER,terrainDescription,CITY_LAYOUT,AIRPORT_CELLS,RANGES,PASSES} from './rebel-terrain.js';
import { fireArtillery, isUnitDetected } from './rebel-artillery-sim.js';
import {initializePoliticalSystems,buildForwardSupplyCenter,syncForwardSupplyNetwork,accountIndustry,assessRebelStrategy,processRecruitment,advanceArmistice,updatePublicBattleReports,getArmisticeState,maybeArmisticeIncident,maybeOfferEnemyArmistice,breakArmistice} from './rebel-political-systems.js';
import { plantFieldMine, buildFieldFortification,clearFieldMine,scanEngineerMines } from './rebel-engineering-sim.js';
export const THEATER = MAP_THEATER;
export const GRID = MAP_GRID;
export const OBJECTIVE = {...MAP_CITIES.find(c=>c.id==='miraf')};
export const CITIES = MAP_CITIES;

const BLUE_STARTS = [[15,7],[15,10],[15,13],[16,5],[16,9],[16,12],[17,15],[18,7],[18,11],[19,17],[14,17],[18,20]];
const RED_STARTS = [[23,7],[30,6],[35,12],[27,20],[26,11],[30,15],[36,5],[37,6],[32,16],[24,23]];
// Pointy-top, odd-row offset hexes. Geometry and rules share these functions.
export const HEX_RADIUS = 104;
export function hexCenter(x,y){return {x:Math.sqrt(3)*HEX_RADIUS*(x+.5+(y%2)*.5),y:HEX_RADIUS+1.5*HEX_RADIUS*y}}
export function hexPolygon(x,y){const c=hexCenter(x,y);return Array.from({length:6},(_,i)=>{const a=(i*60-30)*Math.PI/180;return [c.x+HEX_RADIUS*Math.cos(a),c.y+HEX_RADIUS*Math.sin(a)]})}
export function hexDistance(a,b){const aq=a.x-(a.y-(a.y&1))/2,bq=b.x-(b.y-(b.y&1))/2,dq=aq-bq,dr=a.y-b.y;return Math.max(Math.abs(dq),Math.abs(dr),Math.abs(dq+dr))}
function directions(y){return y%2?[[1,0],[-1,0],[0,-1],[1,-1],[0,1],[1,1]]:[[1,0],[-1,0],[-1,-1],[0,-1],[-1,1],[0,1]]}
export function hexNeighbors(p){return directions(p.y).map(([dx,dy])=>({x:p.x+dx,y:p.y+dy})).filter(p=>inBounds(p.x,p.y))}
const cellKey = (x, y) => `${x},${y}`;
const indexOf = (x, y) => y * GRID.columns + x;
const inBounds = (x, y) => x >= 0 && x < GRID.columns && y >= 0 && y < GRID.rows;
const sideName = side => side === 'blue' ? 'الدولة' : 'المتمردين';

// Game-balance profiles: recognizable equipment families, deliberately abstracted for fair turn-based play.
export const ARMOR_MODELS = Object.freeze({
  abrams: { name:'M1A2 Abrams', nation:'الولايات المتحدة', tag:'US', category:'tank', movement:3, range:2, maxStrength:3, hpPerUnit:100, firepower:1.30, armor:1.34, accuracy:.10, antiInfantry:1.10, antiArmor:1.28, state:'قوة نيران ودقة وحماية مرتفعة؛ حركتها أبطأ ومدى اشتباكها أقصر.' },
  t90m: { name:'T-90M', nation:'روسيا', tag:'RU', category:'tank', movement:4, range:2, maxStrength:3, hpPerUnit:100, firepower:1.20, armor:1.20, accuracy:.03, antiInfantry:1.05, antiArmor:1.14, state:'توازن جيد بين الحماية والحركة؛ لا تتفوق بميزة واحدة على Abrams أو Type 99A.' },
  type99a: { name:'Type 99A', nation:'الصين', tag:'CN', category:'tank', movement:4, range:3, maxStrength:3, hpPerUnit:100, firepower:1.13, armor:1.08, accuracy:.06, antiInfantry:1.02, antiArmor:1.16, state:'مدى أطول وحركة جيدة؛ حماية أقل من Abrams وT-90M.' },
  bradley: { name:'M2 Bradley', nation:'الولايات المتحدة', tag:'US', category:'ifv', movement:4, range:2, maxStrength:4, hpPerUnit:75, firepower:1.00, armor:.98, accuracy:.03, antiInfantry:1.25, antiArmor:.78, state:'دعم قوي ضد المشاة ومساندة القناصة؛ أضعف في مواجهة الدبابات.' },
  bmp3: { name:'BMP-3', nation:'روسيا', tag:'RU', category:'ifv', movement:4, range:2, maxStrength:4, hpPerUnit:75, firepower:1.08, armor:.91, accuracy:.02, antiInfantry:1.12, antiArmor:1.08, state:'تسليح متنوع ضد المشاة والمدرعات؛ حمايتها أخف من الدبابات.' },
  zbd04: { name:'ZBD-04', nation:'الصين', tag:'CN', category:'ifv', movement:5, range:2, maxStrength:4, hpPerUnit:75, firepower:.96, armor:.88, accuracy:.02, antiInfantry:1.12, antiArmor:.80, state:'الأسرع في الحركة ومرافقة المشاة؛ حمايتها وقوتها ضد الدبابات أقل.' }
});
const BLUE_ARMOR_STARTS = [[12,20,'abrams'],[14,21,'t90m'],[16,21,'type99a'],[10,23,'bradley'],[12,24,'bmp3'],[15,24,'zbd04']];
const RED_ARMOR_STARTS = [[25,2,'t90m'],[28,3,'type99a'],[31,2,'abrams'],[26,8,'bmp3'],[29,9,'zbd04'],[33,8,'bradley']];

function hash(x, y, s = 0) {
  let n = Math.imul(x + 17, 374761393) ^ Math.imul(y + 29, 668265263) ^ Math.imul(s + 7, 2246822519);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

export const borderAt = y => 19 + Math.round(Math.sin(y * .43) * 2.6 + Math.sin(y * .91) * 1.15);

function cityCell(city) {
 let best={x:0,y:0},d=Infinity;
 for(let y=0;y<GRID.rows;y++)for(let x=0;x<GRID.columns;x++){const c=hexCenter(x,y),n=Math.hypot(c.x-city.x,c.y-city.y);if(n<d){best={x,y};d=n}}
 return best;
}

const SITE_CELLS = CITIES.map(site => ({ ...site, ...cityCell(site), radius: site.id==='qalara'?5:site.priority >= 9 ? 3 : site.priority >= 5 ? 2 : 1 }));
const SITE_BY_CELL = new Map(SITE_CELLS.map(site => [cellKey(site.x, site.y), site]));
const INFLUENCE = new Map(), URBAN_SITE_BY_CELL=new Map();
for (let y = 0; y < GRID.rows; y++) for (let x = 0; x < GRID.columns; x++) {
  const candidate = SITE_CELLS.map(site => ({ site, d: hexDistance(site,{x,y}) }))
    .filter(item => item.d <= item.site.radius).sort((a, b) => a.d - b.d || b.site.priority - a.site.priority)[0];
  if (candidate) {INFLUENCE.set(cellKey(x,y),candidate.site.id);URBAN_SITE_BY_CELL.set(cellKey(x,y),candidate.site)}
}

export const MOUNTAIN_ART_CELLS = mountainCells;
const MOUNTAINS = new Set(mountainCells.map(([x,y])=>cellKey(x,y)));
const ROAD_LINES = MAP_ROADS;
const ROAD_CELLS = new Set(), RIVER_CELLS = new Set(), BRIDGES = new Set();
function pointSegmentDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],u=Math.max(0,Math.min(1,((p.x-a[0])*dx+(p.y-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(a[0]+u*dx-p.x,a[1]+u*dy-p.y)}
for(let y=0;y<GRID.rows;y++)for(let x=0;x<GRID.columns;x++){
  const p=hexCenter(x,y);
  if(ROAD_LINES.some(line=>line.slice(1).some((point,i)=>pointSegmentDistance(p,line[i],point)<108)))ROAD_CELLS.add(cellKey(x,y));
}
const RIVER_POINTS=MAP_RIVER;
for(let y=0;y<GRID.rows;y++)for(let x=0;x<GRID.columns;x++){
  const p=hexCenter(x,y);
  if(RIVER_POINTS.slice(1).some((point,i)=>pointSegmentDistance(p,RIVER_POINTS[i],point)<72))RIVER_CELLS.add(cellKey(x,y));
  if(ROAD_CELLS.has(cellKey(x,y))&&RIVER_CELLS.has(cellKey(x,y)))BRIDGES.add(cellKey(x,y));
}

function hpPerStrength(kind,modelId=null){return modelId?ARMOR_MODELS[modelId].hpPerUnit:22}
function defaultAmmo(kind,modelId=null){const model=modelId&&ARMOR_MODELS[modelId];return model?.category==='tank'?20:model?.category==='ifv'?18:kind==='sniper'?16:14}
function makeUnit(id, side, x, y, role = 'line', siteId = null, kind = 'infantry') {
  const hpPer=hpPerStrength(kind),ammo=defaultAmmo(kind);
  return { id, side, kind, x, y, strength: 6, maxStrength:6, hpPerStrength:hpPer, maxHp:6*hpPer, hp:6*hpPer, morale: 100, movement: kind === 'sniper' ? 3 : 4, moved: false, attacked: false, hidden: false, ambushReady: false, order: null, role, siteId, kills: 0, pinned: false, ammo, maxAmmo:ammo, fuel:0, maxFuel:0 };
}
function makeArmoredUnit(id,side,x,y,modelId){
  const model=ARMOR_MODELS[modelId],unit={...makeUnit(id,side,x,y,'armored',null,model.category),modelId,strength:model.maxStrength,maxStrength:model.maxStrength,hpPerStrength:model.hpPerUnit,maxHp:model.maxStrength*model.hpPerUnit,hp:model.maxStrength*model.hpPerUnit,movement:model.movement};
  unit.ammo=unit.maxAmmo=defaultAmmo(model.category,modelId);unit.fuel=unit.maxFuel=Math.round(model.movement*4*1.25+4);return unit;
}

function log(battle, message) {
  battle.events.push(message);
  if (battle.events.length > 8) battle.events.shift();
}

function createSoldierBattle(seed = 4106) {
  const owners = [];
  for (let y = 0; y < GRID.rows; y++) for (let x = 0; x < GRID.columns; x++) owners.push(Math.floor(hexCenter(x,y).x/180)<=borderAt(Math.floor(hexCenter(x,y).y/170))?'blue':'red');
  const blue = BLUE_STARTS.map(([x,y], i) => makeUnit(`blue-${i + 1}`, 'blue', x, y, 'line', null, i === 0 ? 'sniper' : 'infantry'));
  const red = RED_STARTS.map(([x,y], i) => {
    const site = SITE_CELLS.filter(s => s.x > 20).sort((a,b) => hexDistance(a,{x,y})-hexDistance(b,{x,y}))[0];
    const kind = i === 0 || i === 6 || i === 7 ? 'sniper' : 'infantry';
    return makeUnit(`red-${i + 1}`, 'red', x, y, i < 4 ? 'garrison' : 'reserve', i < 4 ? site.id : null, kind);
  });
  const blueArmor=BLUE_ARMOR_STARTS.map(([x,y,model],i)=>makeArmoredUnit(`blue-v${i+1}`,'blue',x,y,model));
  const redArmor=RED_ARMOR_STARTS.map(([x,y,model],i)=>makeArmoredUnit(`red-v${i+1}`,'red',x,y,model));
  return {
    turn: 1, phase: 'player', finished: false, winner: null, seed: seed >>> 0,
    objective: { ...OBJECTIVE }, owners, units: [...blue, ...blueArmor, ...red, ...redArmor],
    logistics:{month:1,nextConvoyId:1,nextQueueId:1,depots:[{id:'blue-depot',side:'blue',x:11,y:18,ammo:180,fuel:120,maxAmmo:240,maxFuel:180,engineeringStores:12,maxEngineeringStores:20,auto:true},{id:'red-depot',side:'red',x:31,y:14,ammo:180,fuel:120,maxAmmo:240,maxFuel:180,engineeringStores:12,maxEngineeringStores:20,auto:true}],convoys:[],queue:[]},
    sites: SITE_CELLS.map(site => {const tiles=[...INFLUENCE].filter(([,id])=>id===site.id).map(([cell])=>cell.split(',').map(Number)).map(([x,y])=>({x,y}));const blue=tiles.filter(p=>owners[indexOf(p.x,p.y)]==='blue').length,red=tiles.length-blue;return{...site,tiles,owner:blue===red?owners[indexOf(site.x,site.y)]:blue>red?'blue':'red',contested:false}}),
    events: ['جولة 1: قواتك 12 فصيلاً مشاة و6 تشكيلات مدرعة؛ العدو 10 فصائل مشاة و6 مدرعات، وقناصته على جبل حازان.']
  };
}

function random(battle) {
  battle.seed = (battle.seed * 1664525 + 1013904223) >>> 0;
  return battle.seed / 4294967296;
}

function unitAt(battle, x, y, except = null) {
  return battle.units.find(unit => unit !== except && unit.strength > 0 && unit.x === x && unit.y === y) || null;
}

function enemyUnits(battle, side) { return battle.units.filter(unit => unit.side !== side && unit.strength > 0); }
function perceivedEnemyUnits(battle, side) { return enemyUnits(battle,side).filter(unit => isUnitDetected(battle,unit,side)); }
function ownUnits(battle, side) { return battle.units.filter(unit => unit.side === side && unit.strength > 0); }
function distance(a, b) { return hexDistance(a,b); }
export function isMountainAt(x,y) { return inBounds(x,y) && MOUNTAINS.has(cellKey(x,y)); }
export function kornetReady(battle,unit){return unit?.weaponId!=='kornet'||(unit.ammo>=1&&unit.kornetMovedTurn!==battle.turn&&unit.lastKornetFireTurn!==battle.turn);}
export function unitAttackRange(unit,x=unit?.x,y=unit?.y) { if(unit?.weaponId==='kornet')return 5; const model=unit?.modelId&&ARMOR_MODELS[unit.modelId];return model?model.range:SUPPORT_PROFILES[unit?.role]?SUPPORT_PROFILES[unit.role].range+(elevationAt(x,y)>=.3?1:0):unit?.role==='antiArmor'?3:unit?.role==='reconRadar'?9:unit?.kind === 'sniper' ? 3 + (isMountainAt(x,y) ? 2 : 0) : 1; }
function nearestEnemy(battle, unit) { return enemyUnits(battle, unit.side).sort((a,b) => distance(unit,a) - distance(unit,b))[0] || null; }

function tileCost(x, y, unit=null) {
 const key=cellKey(x,y);
 const base=URBAN_SITE_BY_CELL.has(key)||BRIDGES.has(key)?1:ROAD_CELLS.has(key)?.7:RIVER_CELLS.has(key)?2.5:1;
 return movementCost(unit,x,y,base);
}

function inEnemyControl(battle, side, x, y) {
  return perceivedEnemyUnits(battle, side).some(enemy => distance(enemy, { x, y }) <= 1);
}

export function reachableCells(battle, unitId, budget = null) {
  const unit = battle.units.find(item => item.id === unitId);
  if (!unit || unit.airliftReserved || unit.role==='supplyTruck' || unit.strength <= 0 || unit.moved || unit.attacked || battle.phase !== 'player' || unit.side !== 'blue') return [];
  const limit = Math.min(budget ?? unit.movement,fatigueMovement(unit));
  const distances = new Map([[cellKey(unit.x, unit.y), 0]]);
  const parents = new Map(),fuelCosts=new Map([[cellKey(unit.x,unit.y),0]]);
  const queue = [{ x: unit.x, y: unit.y, cost: 0 }];
  while (queue.length) {
    queue.sort((a,b)=>a.cost-b.cost);
    const current = queue.shift(), currentKey = cellKey(current.x, current.y), cost = distances.get(currentKey);
    if (current.cost !== cost) continue;
    // Enemy influence is a risk, never an invisible movement wall.
    for (const [dx, dy] of directions(current.y)) {
      const x = current.x + dx, y = current.y + dy, key = cellKey(x, y);
      if (!inBounds(x,y))continue;const occupant=unitAt(battle,x,y,unit);if(occupant&&(occupant.side===unit.side||isUnitDetected(battle,occupant,unit.side)))continue;
      const nextCost = Math.round((cost + tileCost(x,y,unit))*10)/10,fuelCost=(fuelCosts.get(currentKey)??0)+movementFuelCost(unit,x,y);
      if (nextCost > limit || (unit.modelId&&fuelCost>unit.fuel+1e-6) || (distances.has(key) && distances.get(key) <= nextCost)) continue;
      distances.set(key, nextCost);fuelCosts.set(key,fuelCost);parents.set(key, currentKey); queue.push({x,y,cost:nextCost});
    }
  }
  return [...distances].filter(([key]) => key !== cellKey(unit.x, unit.y)).map(([key, cost]) => {
    const [x,y] = key.split(',').map(Number), path = [];
    let cursor = key;
    while (cursor !== cellKey(unit.x, unit.y)) {
      const [px,py] = cursor.split(',').map(Number);
      path.unshift({x:px,y:py}); cursor = parents.get(cursor);
      if (!cursor) break;
    }
    return { x,y,cost,path };
  });
}

export function attackApproaches(battle, unitId, targetId) {
  const unit = battle.units.find(item => item.id === unitId);
  const target = battle.units.find(item => item.id === targetId && item.side === 'red' && item.strength > 0);
  if (!unit || unit.airliftReserved || unit.order?.regroup || unit.strength<=0 || battle.finished || !target || !isUnitDetected(battle,target,'blue') || ['commander','jammer','fieldArtillery','katyusha','mortar','reconRadar','engineer'].includes(unit.role) || battle.phase !== 'player' || unit.side !== 'blue' || unit.attacked || unit.ammo<=0) return [];
  if(!kornetReady(battle,unit))return [];
  const range = unitAttackRange(unit);
  if (distance(unit, target) <= range && terrainSight(unit,target)) return [{ x: unit.x, y: unit.y, cost: 0, path: [] }];
  if (unit.moved||unit.weaponId==='kornet') return [];
  return reachableCells(battle, unitId).filter(cell => distance(cell, target) <= unitAttackRange(unit,cell.x,cell.y)&&terrainSight(cell,target))
    .sort((a, b) => a.cost - b.cost || a.path.length - b.path.length);
}

export function issueAttack(battle, unitId, targetId) {
  const unit = battle.units.find(item => item.id === unitId);
  const target = battle.units.find(item => item.id === targetId && item.side === 'red' && item.strength > 0);
  if (!unit || unit.airliftReserved || unit.strength<=0 || battle.finished || !target || !isUnitDetected(battle,target,'blue') || ['commander','jammer','fieldArtillery','katyusha','mortar','reconRadar','engineer'].includes(unit.role) || battle.phase !== 'player' || unit.side !== 'blue' || unit.attacked || unit.ammo<=0) return false;
  if (distance(unit, target) > unitAttackRange(unit)) return false;
  return attack(battle, unit, target);
}

export function canAmbush(battle,unitId) {
  const unit=battle.units.find(item=>item.id===unitId);
  return !!unit&&!unit.order?.regroup&&unit.role!=='supplyTruck'&&!['commander','jammer','fieldArtillery','katyusha','mortar','reconRadar','engineer'].includes(unit.role)&&unit.strength>0&&unit.side==='blue'&&battle.phase==='player'&&!battle.finished&&!unit.moved&&!unit.attacked&&!unit.hidden&&!unit.modelId&&(!!urbanSiteAt(unit.x,unit.y)||isMountainAt(unit.x,unit.y));
}

export function issueAmbush(battle,unitId) {
  if(!canAmbush(battle,unitId))return false;
  const unit=battle.units.find(item=>item.id===unitId),house=mapObjectAt(battle,unit.x,unit.y,'building');if(house&&['house','apartment'].includes(house.type)&&house.hp>0)garrisonInHouse(battle,unit.id);unit.hidden=true;unit.ambushReady=true;unit.moved=true;unit.order={ambush:true};
  log(battle,`الفصيل ${unit.id.replace('blue-','')} تحصن في ${house&&['house','apartment'].includes(house.type)?'بيت':'منطقة'} ${urbanSiteAt(unit.x,unit.y)?.name??'المرتفعات'} وينتظر لحظة الهجوم.`);
  return true;
}

export function cancelRegroup(battle,unitId){const unit=battle.units.find(u=>u.id===unitId);if(!unit?.order?.regroup||unit.side!=='blue'||battle.phase!=='player')return false;unit.order=null;unit.moved=false;unit.attacked=false;log(battle,'أُلغي التجمع؛ أصبح الفصيل جاهزاً للأوامر.');return true;}

export function issueRegroup(battle,unitId) {
 const unit=battle.units.find(u=>u.id===unitId),site=unit&&battle.sites.find(s=>s.owner===unit.side&&!s.contested&&distance(unit,s)<=s.radius);
 if(!unit||!site||battle.phase!==(unit.side==='blue'?'player':'enemy')||unit.role==='supplyTruck'||unit.strength<=0||perceivedEnemyUnits(battle,unit.side).some(e=>distance(e,unit)<=3))return false;
 unit.order={regroup:{siteId:site.id,side:unit.side,until:battle.turn+2}};unit.moved=true;unit.attacked=true;log(battle,`${sideName(unit.side)} يجمع الفصيل قرب ${site.name} لإعادة التنظيم واستعادة المعنويات.`);return true;
}

export function issueHold(battle, unitId) {
  const unit = battle.units.find(item => item.id === unitId);
  if (!unit || unit.airliftReserved || unit.order?.regroup || unit.role==='supplyTruck' || battle.phase !== 'player' || unit.side !== 'blue' || unit.moved || unit.attacked) return false;
  unit.order = { hold: true };
  unit.moved = true;
  log(battle, `الفصيل ${unit.id.replace('blue-','')} يثبت موقعه ويرفع دفاعه.`);
  return true;
}

export function beginMove(battle, unitId, x, y) {
  const unit = battle.units.find(item => item.id === unitId);
  if (!unit || unit.airliftReserved || unit.order?.regroup || unit.role==='supplyTruck' || battle.phase !== 'player' || unit.side !== 'blue' || unit.moved || unit.attacked) return null;
  const destination = reachableCells(battle, unitId).find(cell => cell.x === x && cell.y === y);
  if (!destination) return null;
  if(truceMoveRisk(battle,unit,destination.path,perceivedEnemyUnits(battle,unit.side)))return null;
  unit.moved = true;
  unit.order = { path: destination.path, target: { x, y }, cost: destination.cost };
  log(battle, `الفصيل ${unit.id.replace('blue-','')} يتحرك ${destination.cost} نقاط حركة.`);
  return { path: destination.path.map(p => ({...p})), cost: destination.cost };
}

export function stepUnit(battle, unitId, point) {
  const unit = battle.units.find(item => item.id === unitId && item.strength > 0);
  if (!unit || !inBounds(point.x, point.y) || hexDistance(unit, point) !== 1 || unitAt(battle, point.x, point.y, unit)) return false;
  if(!Number.isFinite(movementCost(unit,point.x,point.y)))return false;
  if(unit.garrisonedIn)leaveHouse(battle,unit.id);if(unit.hidden){unit.hidden=false;unit.ambushReady=false;}
  const fuelNeed=movementFuelCost(unit,point.x,point.y);if(unit.modelId&&fuelNeed>unit.fuel+1e-6)return false;if(unit.modelId)unit.fuel=Math.max(0,unit.fuel-fuelNeed);
  if(unit.weaponId==='kornet')unit.kornetMovedTurn=battle.turn;
  unit.x = point.x; unit.y = point.y;moveCampaignUnit(battle,unit);
  const mine=battle.engineering?.minefields?.find(m=>m.x===unit.x&&m.y===unit.y&&m.side!==unit.side);
  if(mine){const damage=unit.modelId?(ARMOR_MODELS[unit.modelId].category==='tank'?58:42):28;unit.hp=Math.max(0,unit.hp-damage);unit.strength=Math.max(0,Math.min(unit.maxStrength,Math.ceil((unit.hp-1e-8)/unit.hpPerStrength)));unit.morale=Math.max(0,unit.morale-18);unit.moved=true;unit.attacked=true;unit.stoppedByMine=true;battle.engineering.minefields=battle.engineering.minefields.filter(m=>m!==mine);log(battle,'انفجر لغم مزروع؛ تضررت القوة وتوقف تقدمها لهذه الجولة.');}
  // Strategic control changes at round end, never by passing through a hex.
  const site = battle.sites.find(item => item.tiles?.some(tile => tile.x === unit.x && tile.y === unit.y));
  if (site) site.contested = true;
  if(!getArmisticeState(battle).active){captureSites(battle);captureFacilities(battle,distance);}
  for(const defender of ownUnits(battle,unit.side==='blue'?'red':'blue')){if(defender.hidden&&defender.ambushReady&&!defender.attacked&&distance(defender,unit)<=Math.min(2,unitAttackRange(defender))){if(!shouldSpringAmbush(battle,defender,unit))continue;if(!attack(battle,defender,unit,false,true))continue;defender.reactionTurn=battle.turn;unit.moved=true;unit.pinned=true;log(battle,'توقف التقدم تحت نيران كمين قريب.');return false;}}
  if(mine||unit.streetBlockedTurn===battle.turn)return false;
  return true;
}

export function completeMovement(battle, unitId) {
  const unit = battle.units.find(item => item.id === unitId);
  if (unit) unit.order = null;
}

function siteThreatened(battle, site, side) {
  return perceivedEnemyUnits(battle, side).some(enemy => distance(enemy,site)<=site.radius+3);
}

function captureSites(battle, advance=false) {
 let changed=false;
 for(const site of battle.sites){
  const present=battle.units.filter(u=>u.strength>0&&u.role!=='supplyTruck'&&distance(u,site)<=site.radius);
  const blue=present.some(u=>u.side==='blue'),red=present.some(u=>u.side==='red');
  site.contested=blue&&red;
  const claimant=blue&&!red?'blue':red&&!blue?'red':null;
  if(!advance)continue;
  if(claimant&&claimant!==site.owner){
   site.captureRounds=site.claimant===claimant?(site.captureRounds??0)+1:1;site.claimant=claimant;
   if(site.captureRounds>=2){changed=true;site.liberationParticipants=present.filter(u=>u.side===claimant).map(u=>u.id);cityMoraleEvent(battle,site,claimant);site.owner=claimant;site.captureRounds=0;log(battle,`أصبحت ${site.name} تحت سيطرة ${sideName(claimant)} بعد تثبيت القوات جولتين.`)}
  }else{site.captureRounds=0;site.claimant=null}
 }
 if(changed)updateRebelTerritory(battle);
}
function updateRebelTerritory(battle){
 for(let y=0;y<GRID.rows;y++)for(let x=0;x<GRID.columns;x++){
  const site=battle.sites.reduce((best,s)=>!best||distance(s,{x,y})<distance(best,{x,y})?s:best,null);
  battle.owners[indexOf(x,y)]=site?.owner??'blue';
 }
}

export function urbanSiteAt(x,y){return URBAN_SITE_BY_CELL.get(cellKey(x,y))??null}
export function cityCombatModifiers(unit){const urban=!!urbanSiteAt(unit.x,unit.y);return{insideCity:urban,firePower:urban?1.25:1,holdPower:urban?1.25:1,cover:urban?.52:0}}

// CITY_OBJECT_REGISTRY_V1: one serializable source of truth for terrain, city lots and structures.
const mapKey=(x,y)=>`${x},${y}`;
function registerObject(battle,site,x,y,type,category='building'){
  const key=mapKey(x,y),id=`${category}:${site?.id??'field'}:${key}`;
  const previous=battle.mapObjects[id];
  const object=previous??{id,type,category,siteId:site?.id??null,x,y,hp:100,maxHp:100,hits:0,status:'intact',garrisonUnitIds:[]};
  object.type=type;object.category=category;object.siteId=site?.id??null;
  battle.mapObjects[id]=object;
  const cell=battle.mapCells[key]??{x,y,terrain:'land',landUse:'open',siteId:null,objectIds:[]};
  if(!cell.objectIds.includes(id))cell.objectIds.push(id);
  cell.landUse=site?'urban':'developed';if(site)cell.siteId=site.id;
  battle.mapCells[key]=cell;
  if(site&&category==='building'){
    site.structureTiles??=[];
    if(!site.structureTiles.some(tile=>tile.x===x&&tile.y===y))site.structureTiles.push({x,y});
  }
  return object;
}
export function initializeMapObjectRegistry(battle){
  battle.mapCells=Object.fromEntries(Array.from({length:GRID.rows*GRID.columns},(_,i)=>{const x=i%GRID.columns,y=Math.floor(i/GRID.columns);return[mapKey(x,y),{x,y,terrain:isMountainAt(x,y)?'mountain':'land',elevation:elevationAt(x,y),pass:passAt(x,y)?.name??null,landUse:'open',siteId:null,objectIds:[]}]}));
  battle.mapObjects={};
  for(const site of battle.sites){
    for(const tile of site.tiles){const cell=battle.mapCells[mapKey(tile.x,tile.y)];cell.landUse='urban';cell.siteId=site.id}
    const tiles=site.tiles,market=site.radius>=3?(tiles.find(t=>t.x===site.x+1&&t.y===site.y)||tiles.find(t=>t.x===site.x-1&&t.y===site.y)):null;
    const factory=site.radius>=3?tiles.filter(t=>!(t.x===site.x&&t.y===site.y)&&!(market&&t.x===market.x&&t.y===market.y)).sort((a,b)=>hexDistance(site,b)-hexDistance(site,a)||((a.x*13+a.y*7)-(b.x*13+b.y*7)))[0]:null;
    for(const tile of tiles){const center=tile.x===site.x&&tile.y===site.y,code=(tile.x*7+tile.y*11+site.priority)%10,density=site.radius>=2?10:4;
      if(site.radius>=2&&center)registerObject(battle,site,tile.x,tile.y,'cityHall');
      else if(market&&tile.x===market.x&&tile.y===market.y)registerObject(battle,site,tile.x,tile.y,'market');
      else if(center&&site.radius===1)registerObject(battle,site,tile.x,tile.y,'house');
      else if(!center&&code<density)registerObject(battle,site,tile.x,tile.y,factory&&factory.x===tile.x&&factory.y===tile.y?'urbanFactory':site.radius>=2&&(code===1||code===6)?'apartment':'house');
    }
  }
  return battle.mapCells;
}
export function mapCellInfo(battle,x,y){if(!battle||!inBounds(x,y))return null;if(!battle.mapCells)initializeMapObjectRegistry(battle);const cell=battle.mapCells[mapKey(x,y)];return{...cell,objects:cell.objectIds.map(id=>battle.mapObjects[id]).filter(Boolean)}}
export function mapObjectAt(battle,x,y,category=null){const cell=mapCellInfo(battle,x,y);return cell?.objects.find(object=>!category||object.category===category)??null}
export function canPlaceFacility(battle,x,y,type='factory'){
  const cell=mapCellInfo(battle,x,y);if(!cell||cell.landUse!=='open'||cell.terrain==='mountain'||cell.objectIds.length)return false;
  if([...battle.units??[],...battle.airDefenses??[],...battle.droneBases??[],...battle.logistics?.depots??[],...battle.campaignAssets??[]].some(item=>(item.strength??1)>0&&item.x===x&&item.y===y&&!item.disabled))return false;
  return ['factory','oilRefinery','airbase','depot','radar'].includes(type);
}
export function placeFacility(battle,x,y,type='factory',side='blue'){
  if(!canPlaceFacility(battle,x,y,type))return{ok:false,reason:'الموقع داخل مدينة أو مشغول أو غير صالح.'};
  const object=registerObject(battle,null,x,y,type,'facility');object.side=side;return{ok:true,object};
}
export function damageMapObject(battle,x,y,damage,category='building'){
  const object=mapObjectAt(battle,x,y,category);if(!object)return null;
  const amount=Math.min(object.hp,Math.max(0,Number(damage)||0));object.hp-=amount;object.hits++;object.status=object.hp<=0?'destroyed':'damaged';
  const site=battle.sites.find(item=>item.id===object.siteId);if(site){site.buildingIntegrity??={};site.buildingIntegrity[mapKey(x,y)]=object;site.hitBuildingKey=mapKey(x,y)}if(object.status==='destroyed'){for(const id of object.garrisonUnitIds??[]){const unit=battle.units.find(item=>item.id===id);if(unit){delete unit.garrisonedIn;unit.hidden=false}}object.garrisonUnitIds=[]}
  return{object,damage:amount};
}
export function garrisonInHouse(battle,unitId,x=null,y=null){
  const unit=battle.units.find(item=>item.id===unitId&&item.strength>0);if(!unit)return{ok:false,reason:'الوحدة غير موجودة.'};
  x??=unit.x;y??=unit.y;const house=mapObjectAt(battle,x,y,'building');
  if(!house||!['house','apartment'].includes(house.type)||house.hp<=0)return{ok:false,reason:'لا يوجد بيت صالح للتحصن في هذه الخلية.'};
  if(unit.x!==x||unit.y!==y||unit.garrisonedIn)return{ok:false,reason:'يجب أن تكون الوحدة داخل خلية البيت وغير متحصنة مسبقاً.'};
  house.garrisonUnitIds??=[];if(house.garrisonUnitIds.length>=2)return{ok:false,reason:'البيت ممتلئ.'};
  house.garrisonUnitIds.push(unit.id);unit.garrisonedIn=house.id;unit.hidden=true;return{ok:true,house};
}
export function leaveHouse(battle,unitId){const unit=battle.units.find(item=>item.id===unitId&&item.garrisonedIn);if(!unit)return false;const house=battle.mapObjects?.[unit.garrisonedIn];if(house)house.garrisonUnitIds=(house.garrisonUnitIds??[]).filter(id=>id!==unit.id);delete unit.garrisonedIn;unit.hidden=false;return true}
export function urbanControl(battle,siteId){const site=battle.sites.find(s=>s.id===siteId);if(!site)return null;let blue=0,red=0;for(const p of site.tiles){if(battle.owners[indexOf(p.x,p.y)]==='blue')blue++;else red++}return{blue,red,total:site.tiles.length,owner:site.owner,bluePercent:Math.round(blue/site.tiles.length*100)}}
export function cityVictoryProgress(battle){const cities=battle.sites.filter(site=>site.radius>=2);return{controlled:cities.filter(site=>site.owner==='blue').length,total:cities.length};}

export function supplyTerrainFactor(x,y){if(urbanSiteAt(x,y))return .55;if(isMountainAt(x,y))return 1.5;if(RIVER_CELLS.has(cellKey(x,y)))return 1.4;if(ROAD_CELLS.has(cellKey(x,y)))return .8;return 1.25}
function unitAmmoCost(unit){if(unit.weaponId==='kornet')return 1;return unit.modelId?(ARMOR_MODELS[unit.modelId].category==='tank'?4:3):unit.kind==='sniper'?2.5:2}
function unitAmmoRatio(unit){return unit.maxAmmo?unit.ammo/unit.maxAmmo:1}
function stableCitySupply(){return null;}
function movementFuelCost(unit,x,y){return unit.modelId?tileCost(x,y,unit)*supplyTerrainFactor(x,y):0}
function supplyBlocked(battle,side,x,y){const idx=indexOf(x,y);return RIVER_CELLS.has(cellKey(x,y))&&!BRIDGES.has(cellKey(x,y))||inEnemyControl(battle,side,x,y)}
function supplyPath(battle,side,start,target){
 const occupied=new Set(battle.units.filter(u=>u.strength>0).map(u=>cellKey(u.x,u.y))),hostile=new Set();
 for(const u of perceivedEnemyUnits(battle,side))for(const c of [u,...hexNeighbors(u)])hostile.add(cellKey(c.x,c.y));
 const startKey=cellKey(start.x,start.y),queue=[{x:start.x,y:start.y,cost:0}],costs=new Map([[startKey,0]]),parents=new Map();let goal=null;
 while(queue.length){queue.sort((a,b)=>a.cost-b.cost);const cur=queue.shift(),key=cellKey(cur.x,cur.y);if(cur.cost!==costs.get(key))continue;if(hexDistance(cur,target)<=1){goal=key;break}
  for(const next of hexNeighbors(cur)){const nk=cellKey(next.x,next.y);if(nk!==startKey&&(occupied.has(nk)||hostile.has(nk)||RIVER_CELLS.has(nk)&&!BRIDGES.has(nk)))continue;const step=tileCost(next.x,next.y,{role:'supplyTruck'}),nc=cur.cost+step;if(nc<(costs.get(nk)??Infinity)){costs.set(nk,nc);parents.set(nk,key);queue.push({...next,cost:nc})}}
 }
 if(!goal)return null;const path=[];let cursor=goal;while(cursor!==startKey){const [x,y]=cursor.split(',').map(Number);path.unshift({x,y});cursor=parents.get(cursor);if(!cursor)return null}return path;
}
const MAX_ACTIVE_CONVOYS_PER_SIDE=10,MAX_UNITS_PER_SUPPLY_CONVOY=3;
function supplyCargo(unit,ammoStock,fuelStock,rationStock=0){return{rations:Math.min(Math.max(0,(unit.maxRations??6)-(unit.rations??6)),rationStock),ammo:unit.weaponId==='kornet'?Math.max(0,Math.min(unit.maxAmmo-unit.ammo,2,Math.floor(ammoStock))):Math.min(Math.max(0,unit.maxAmmo-unit.ammo),8,ammoStock),fuel:Math.min(Math.max(0,(unit.maxFuel??0)-(unit.fuel??0)),12,fuelStock)}}
function unitNeedsSupply(battle,unit,automatic=false){if(!unit||unit.role==='supplyTruck'||unit.strength<=0)return false;return automatic?((unit.rations??6)<3||unitAmmoRatio(unit)<.55||(unit.maxFuel>0&&unit.fuel/unit.maxFuel<.5)):((unit.rations??6)<(unit.maxRations??6)||unit.ammo<unit.maxAmmo-1e-6||(unit.maxFuel>0&&unit.fuel<unit.maxFuel-1e-6))}
function requestedSupplyUnitIds(battle){const ids=new Set();for(const order of battle.logistics?.queue??[])for(const id of order.unitIds??[order.unitId])ids.add(id);for(const convoy of battle.logistics?.convoys??[])for(const id of convoy.deliveryIds??[convoy.unitId])ids.add(id);return ids}
function supplyCluster(battle,anchor,automatic){const reserved=requestedSupplyUnitIds(battle);return ownUnits(battle,anchor.side).filter(unit=>unit.id===anchor.id||(!reserved.has(unit.id)&&unit.side===anchor.side&&hexDistance(unit,anchor)<=2&&unitNeedsSupply(battle,unit,automatic))).filter(unit=>unitNeedsSupply(battle,unit,automatic)).sort((a,b)=>(a.id===anchor.id?-1:b.id===anchor.id?1:hexDistance(a,anchor)-hexDistance(b,anchor))||Math.min(unitAmmoRatio(a),a.maxFuel?a.fuel/a.maxFuel:1)-Math.min(unitAmmoRatio(b),b.maxFuel?b.fuel/b.maxFuel:1)).slice(0,MAX_UNITS_PER_SUPPLY_CONVOY)}
function launchSupplyOrder(battle,order){const logistics=battle.logistics;if(logistics.convoys.filter(c=>c.side===order.side).length>=MAX_ACTIVE_CONVOYS_PER_SIDE)return false;const units=(order.unitIds??[order.unitId]).map(id=>battle.units.find(unit=>unit.id===id&&unit.side===order.side&&unit.strength>0)).filter(unit=>unit&&unitNeedsSupply(battle,unit,order.automatic));if(!units.length)return false;const depot=logistics.depots.filter(item=>item.side===order.side&&!item.disabled).sort((a,b)=>hexDistance(a,units[0])-hexDistance(b,units[0]))[0];if(!depot)return false;let ammoStock=depot.ammo,fuelStock=depot.fuel,rationStock=depot.rations??0;const deliveries=[];for(const unit of units){const cargo=supplyCargo(unit,ammoStock,fuelStock,rationStock);if(cargo.ammo<=0&&cargo.fuel<=0&&cargo.rations<=0)continue;rationStock-=cargo.rations;ammoStock-=cargo.ammo;fuelStock-=cargo.fuel;deliveries.push({unitId:unit.id,...cargo})}if(!deliveries.length)return false;const first=battle.units.find(unit=>unit.id===deliveries[0].unitId),launch=[{x:depot.x,y:depot.y},...hexNeighbors(depot)].find(point=>!unitAt(battle,point.x,point.y)&&!supplyBlocked(battle,order.side,point.x,point.y));if(!first||!launch)return false;const path=supplyPath(battle,order.side,launch,first);if(!path)return false;depot.rations=rationStock;depot.ammo=ammoStock;depot.fuel=fuelStock;const id=`${order.side}-supply-${logistics.nextConvoyId++}`,cargo=deliveries.reduce((sum,item)=>({ammo:sum.ammo+item.ammo,fuel:sum.fuel+item.fuel,rations:sum.rations+(item.rations??0)}),{ammo:0,fuel:0,rations:0}),truck={id,side:order.side,kind:'supplyTruck',role:'supplyTruck',x:launch.x,y:launch.y,strength:1,maxStrength:1,hpPerStrength:90,maxHp:90,hp:90,morale:100,movement:0,moved:true,attacked:true,hidden:false,ambushReady:false,order:null,siteId:null,kills:0,pinned:false,ammo:0,maxAmmo:0,fuel:0,maxFuel:0,supplyTargetId:first.id};battle.units.push(truck);logistics.convoys.push({id,truckId:id,side:order.side,unitId:first.id,deliveryIds:deliveries.map(item=>item.unitId),deliveries,x:launch.x,y:launch.y,path,pathTargetId:first.id,pathTargetX:first.x,pathTargetY:first.y,cargo,automatic:order.automatic});log(battle,`${order.automatic?'أُرسلت قافلة آلية':'أُرسلت قافلة إمداد'} إلى ${deliveries.length} قوات متقاربة؛ تحمل ${cargo.rations} إعاشة و${cargo.ammo} ذخيرة${cargo.fuel?` و${cargo.fuel} وقود`:''}.`);return true}
function dispatchSupply(battle,unit,automatic=false){if(!unit||!battle.logistics?.depots?.some(depot=>depot.side===unit.side&&!depot.disabled)||!unitNeedsSupply(battle,unit,automatic))return false;const unitIds=supplyCluster(battle,unit,automatic).map(item=>item.id);if(!unitIds.length)return false;const order={side:unit.side,unitIds,automatic};const active=battle.logistics.convoys.filter(convoy=>convoy.side===unit.side).length;if(active<MAX_ACTIVE_CONVOYS_PER_SIDE&&launchSupplyOrder(battle,order))return true;const queueId=`${unit.side}-supply-queue-${battle.logistics.nextQueueId++}`;battle.logistics.queue.push({id:queueId,...order});log(battle,`طلب الإمداد ${unit.side==='blue'?'الصديق':'المعادي'} دخل طابور الشاحنات؛ ${active} قوافل متحركة حالياً.`);return true}
function launchQueuedSupply(battle){const logistics=battle.logistics;if(!logistics)return;for(const side of ['blue','red']){let blocked=0;while(logistics.convoys.filter(item=>item.side===side).length<MAX_ACTIVE_CONVOYS_PER_SIDE){const index=logistics.queue.findIndex(item=>item.side===side);if(index<0)break;const order=logistics.queue[index];order.unitIds=(order.unitIds??[order.unitId]).filter(id=>{const unit=battle.units.find(item=>item.id===id&&item.side===side&&item.strength>0);return unit&&unitNeedsSupply(battle,unit,order.automatic)});if(!order.unitIds.length){logistics.queue.splice(index,1);continue}if(launchSupplyOrder(battle,order)){logistics.queue.splice(index,1);blocked=0;continue}logistics.queue.push(logistics.queue.splice(index,1)[0]);blocked++;if(blocked>=logistics.queue.filter(item=>item.side===side).length)break}}}
export function requestSupplyConvoy(battle,unitId){if(battle.phase!=='player'||battle.finished)return false;const unit=battle.units.find(item=>item.id===unitId&&item.side==='blue'&&item.strength>0);if(!unit)return false;if(stableCitySupply(battle,unit)){log(battle,'هذه القوة داخل مدينة آمنة؛ تحصل على إمداد محلي ولا تحتاج قافلة.');return false}if(!dispatchSupply(battle,unit,false)){log(battle,'تعذر إرسال القافلة: تحقق من مخزون المقر ومن وجود طريق آمن للقوة.');return false}return true}
export function establishForwardSupplyCenter(battle,siteId,side='blue'){return buildForwardSupplyCenter(battle,siteId,side)}
function performSupplyCycle(battle){const l=battle.logistics;if(!l)return;l.month++;syncForwardSupplyNetwork(battle);const assets=Object.values(battle.economyBridge?.assets??{}).filter(a=>['intact','active','damaged'].includes(a.status));for(const d of l.depots){if(d.disabled)continue;const output=(type,key)=>assets.filter(a=>a.side===d.side&&a.type===type).reduce((n,a)=>n+(a.status==='damaged'?Math.max(.25,(a.hp??60)/100):1),0);const factories=output('factory','ammo'),refineries=output('oilRefinery','fuel');d.ammo=Math.min(d.maxAmmo,d.ammo+80+factories*12);d.fuel=Math.min(d.maxFuel,d.fuel+60+refineries*24);d.rations=Math.min(d.maxRations??180,(d.rations??0)+80);d.engineeringStores=Math.min(12,(d.engineeringStores??0)+4);}log(battle,'وصل الإنتاج الشهري إلى المراكز العاملة؛ المصانع تزيد الذخيرة والمواد، والمصافي ترفع الوقود. يلزم توزيعها بقوافل الإمداد.');}
function supplyRouteBlocked(battle,convoy,truck){const next=convoy.path?.[0];return next&&(unitAt(battle,next.x,next.y,truck)||supplyBlocked(battle,convoy.side,next.x,next.y))}
function deliverSupplyNearTruck(battle,convoy,truck){for(const item of [...convoy.deliveries]){const unit=battle.units.find(candidate=>candidate.id===item.unitId&&candidate.strength>0);if(!unit){convoy.deliveries=convoy.deliveries.filter(entry=>entry!==item);continue}if(stableCitySupply(battle,unit)){const depot=battle.logistics.depots.find(entry=>entry.side===convoy.side&&!entry.disabled);if(depot){depot.ammo=Math.min(depot.maxAmmo,depot.ammo+item.ammo);depot.fuel=Math.min(depot.maxFuel,depot.fuel+item.fuel)}convoy.deliveries=convoy.deliveries.filter(entry=>entry!==item);log(battle,`دخلت ${unit.id} مدينة آمنة قبل استلام الشحنة؛ عاد رصيدها إلى المقر.`);continue}if(hexDistance(truck,unit)>2)continue;unit.rations=Math.min(unit.maxRations??6,(unit.rations??0)+(item.rations??0));unit.ammo=Math.min(unit.maxAmmo,unit.ammo+item.ammo);unit.fuel=Math.min(unit.maxFuel??0,(unit.fuel??0)+item.fuel);convoy.deliveries=convoy.deliveries.filter(entry=>entry!==item);log(battle,`وصلت شاحنة الإمداد إلى ${unit.id} وزودتها؛ بقيت ${convoy.deliveries.length} وحدات على مسار القافلة.`)}convoy.deliveryIds=convoy.deliveries.map(item=>item.unitId);convoy.unitId=convoy.deliveryIds[0]??null;truck.supplyTargetId=convoy.unitId}
export function advanceSupplyConvoys(battle){const movements=[];for(const convoy of [...(battle.logistics?.convoys??[])]){const truck=battle.units.find(item=>item.id===(convoy.truckId??convoy.id)&&item.strength>0);if(!truck){convoy.cancelled=true;continue}deliverSupplyNearTruck(battle,convoy,truck);if(!convoy.deliveries.length){truck.strength=0;truck.hp=0;convoy.cancelled=true;continue}const target=battle.units.find(item=>item.id===convoy.unitId&&item.strength>0);if(!target){convoy.cancelled=true;truck.strength=0;truck.hp=0;continue}const targetMoved=convoy.pathTargetId!==target.id||convoy.pathTargetX!==target.x||convoy.pathTargetY!==target.y;if((!convoy.path?.length&&hexDistance(truck,target)>2)||targetMoved||supplyRouteBlocked(battle,convoy,truck)){convoy.path=supplyPath(battle,convoy.side,truck,target);convoy.pathTargetId=target.id;convoy.pathTargetX=target.x;convoy.pathTargetY=target.y}if(!convoy.path){log(battle,`توقفت قافلة الإمداد ${convoy.side==='blue'?'الصديقة':'المعادية'}؛ الطريق غير آمن أو مقطوع.`);continue}let cost=0;const moved=[];for(const point of convoy.path){if(unitAt(battle,point.x,point.y,truck))break;const step=tileCost(point.x,point.y,truck);if(!Number.isFinite(step))break;const travelStep=step;if(moved.length&&cost+step>5)break;cost+=step;moved.push(point)}if(!moved.length){deliverSupplyNearTruck(battle,convoy,truck);if(!convoy.deliveries.length){truck.strength=0;truck.hp=0;convoy.cancelled=true}continue}const from={x:truck.x,y:truck.y};truck.x=convoy.x=moved.at(-1).x;truck.y=convoy.y=moved.at(-1).y;convoy.path=convoy.path.slice(moved.length);movements.push({convoyId:convoy.id,truckId:truck.id,side:convoy.side,from,path:moved});deliverSupplyNearTruck(battle,convoy,truck);if(!convoy.deliveries.length){truck.strength=0;truck.hp=0;convoy.cancelled=true}}battle.logistics.convoys=battle.logistics.convoys.filter(item=>!item.cancelled);launchQueuedSupply(battle);return movements}
function initRations(b){for(const u of b.units){if(u.role==='supplyTruck')continue;u.maxRations??=6;u.rations??=u.maxRations;}for(const d of b.logistics.depots){d.maxRations??=180;d.rations??=120;}}
function consumeRoundSupply(battle){initRations(battle);for(const u of battle.units.filter(u=>u.strength>0&&u.role!=='supplyTruck')){u.rations=Math.max(0,u.rations-(leadership(battle,u)?.supply??1));if(u.rations<=0)u.morale=Math.max(0,u.morale-8);if(u.kind==='engineer'&&(u.engineerCharges??0)<(u.maxEngineerCharges??4)){const d=battle.logistics.depots.find(d=>d.side===u.side&&!d.disabled&&hexDistance(u,d)<=2&&(d.engineeringStores??0)>0);if(d){d.engineeringStores--;u.engineerCharges++;}}}dispatchAutomaticSupply(battle);}
function dispatchAutomaticSupply(battle){for(const side of ['blue','red']){if(!battle.logistics.depots.some(d=>d.side===side&&d.auto&&!d.disabled))continue;const reserved=requestedSupplyUnitIds(battle);for(const u of ownUnits(battle,side).filter(u=>!reserved.has(u.id)&&unitNeedsSupply(battle,u,true)).sort((a,b)=>(a.rations??6)-(b.rations??6))){if(reserved.has(u.id))continue;dispatchSupply(battle,u,true);for(const id of requestedSupplyUnitIds(battle))reserved.add(id);}}}
export function supplyState(battle,unitId){const unit=battle.units.find(item=>item.id===unitId);if(!unit)return null;const city=stableCitySupply(battle,unit);const convoy=battle.logistics.convoys.find(c=>c.deliveries?.some(d=>d.unitId===unitId));return{rations:unit.rations??6,maxRations:unit.maxRations??6,volleys:Math.floor(unit.ammo/(['fieldArtillery','mortar','katyusha'].includes(unit.role)?1:unitAmmoCost(unit)*supplyTerrainFactor(unit.x,unit.y))),convoy:convoy?{id:convoy.id,eta:convoy.path?Math.max(1,Math.ceil(convoy.path.length/3)):null}:null,ammo:unit.ammo,maxAmmo:unit.maxAmmo,fuel:unit.fuel??0,maxFuel:unit.maxFuel??0,city:!!city,cityName:city?.name??null,terrainFactor:supplyTerrainFactor(unit.x,unit.y)}}

function adjacentCover(battle, unit) {
  const city=urbanSiteAt(unit.x,unit.y);
  const hill = elevationAt(unit.x,unit.y)>=.3;
  return (city ? .52 : 0) + (hill ? .18 : 0) + (unit.order?.hold ? .18 : 0);
}

function ensureUnitHealth(unit){
 unit.hpPerStrength??=hpPerStrength(unit.kind,unit.modelId);
 unit.maxHp??=(unit.maxStrength??unit.strength)*unit.hpPerStrength;
 unit.hp??=unit.strength*unit.hpPerStrength;
 unit.hp=Math.max(0,Math.min(unit.maxHp,unit.hp));
}

function attack(battle, attacker, defender, reaction=false, ambush=false) {
  if(getArmisticeState(battle).active){if(!reaction&&!ambush)log(battle,'الهجمات البرية معلّقة خلال الهدنة؛ يمكن إعادة التموضع وإعادة التنظيم.');return false;}
  if (battle.finished || !attacker || attacker.order?.regroup&&!reaction || !defender || attacker.side===defender.side || attacker.strength <= 0 || defender.strength <= 0) return false;
  if(!kornetReady(battle,attacker))return false;
  if(attacker.ammo<=0){log(battle,`${attacker.side==='blue'?'قواتك':'العدو'} نفدت ذخيرته؛ تعذر تنفيذ الهجوم.`);return false;}
  const separation = distance(attacker, defender);
  if (separation > unitAttackRange(attacker) || !terrainSight(attacker,defender)) return false;
  const ambushStrike=attacker.hidden&&attacker.ambushReady;attacker.revealedUntil=battle.turn+1;
  if(attacker.hidden){attacker.hidden=false;attacker.ambushReady=false;}
  const armorAttacker=attacker.modelId?ARMOR_MODELS[attacker.modelId]:null;
  const armorDefender=defender.modelId?ARMOR_MODELS[defender.modelId]:null;
  const ranged=separation>1&&(attacker.kind==='sniper'||attacker.role==='antiArmor'||!!armorAttacker);
  ensureUnitHealth(defender);
  const attackerProfile=cityCombatModifiers(attacker);
  const cover=adjacentCover(battle,defender);
  const strengthFactor=.55+.45*(attacker.strength/Math.max(1,attacker.maxStrength??attacker.strength));
  const fortified=battle.engineering?.fortifications?.some(f=>f.side===defender.side&&f.x===defender.x&&f.y===defender.y);
  const urbanCover=urbanSiteAt(defender.x,defender.y)?.id?(ranged?.9:.84):1;
  const coverFactor=Math.max(.62,1-cover*.45)*(fortified?.72:1)*(defender.garrisonedIn?.85:1)*coverMultiplier(defender.x,defender.y)*urbanCover;
  let baseDamage,weaponFactor=1;
  if(armorAttacker){
    if(armorAttacker.category==='tank'){
      baseDamage=armorDefender?36:26;
      weaponFactor=armorAttacker.firepower*(armorDefender?armorAttacker.antiArmor/armorDefender.armor:armorAttacker.antiInfantry);
    }else{
      baseDamage=armorDefender?16:20;
      weaponFactor=armorAttacker.firepower*(armorDefender?armorAttacker.antiArmor/armorDefender.armor:armorAttacker.antiInfantry);
    }
  }else if(armorDefender){
    baseDamage=attacker.role==='antiArmor'?31:attacker.kind==='sniper'?3:10;
    weaponFactor=(armorDefender.category==='tank'?.75:1.05)/armorDefender.armor;
  }else{
    baseDamage=attacker.role==='antiArmor'?13:attacker.kind==='sniper'?28:22;
  }
  const kornet=attacker.weaponId==='kornet';
  if(kornet){baseDamage=armorDefender?112:defender.role==='supplyTruck'?90:18;weaponFactor=armorDefender?1/armorDefender.armor:1;}
  const accuracyFactor=armorAttacker?.92+armorAttacker.accuracy*.8:1;
  const ammoRatio=attacker.maxAmmo?attacker.ammo/attacker.maxAmmo:1,ammoFactor=ammoRatio>=.35?1:.62+.38*(ammoRatio/.35);
  const terrainFactor=supplyTerrainFactor(attacker.x,attacker.y),ammoCost=kornet?1:unitAmmoCost(attacker)*terrainFactor;
  const damage=Math.max(1,Math.min(defender.hp,kornet&&armorDefender?defender.hpPerStrength:Infinity,Math.round(baseDamage*fatigueFireFactor(attacker)*commandAttackFactor(battle,attacker,attacker.modelId?'armor':'infantry')*weaponFactor*accuracyFactor*strengthFactor*coverFactor*(.85+.15*attacker.morale/100)*(ambushStrike?1.25:1)*(kornet?1:ammoFactor))));
  attacker.ammo=Math.max(0,attacker.ammo-ammoCost);if(kornet)attacker.lastKornetFireTurn=battle.turn;
  if(reaction)attacker.reactionTurn=battle.turn;
  else {attacker.attacked=true;attacker.moved=true;}
  const previousHp=defender.hp,previousStrength=defender.strength;
  defender.hp=Math.max(0,defender.hp-damage);
  defender.strength=Math.max(0,Math.min(defender.maxStrength,Math.ceil((defender.hp-1e-8)/defender.hpPerStrength)));
  const lost=previousStrength-defender.strength;
  defender.morale=Math.max(0,defender.morale-Math.round((3+damage*.18+lost*8)*(leadership(battle,defender)?.shock??1)));
  attacker.kills += lost;civilianImpact(battle,defender.x,defender.y,damage*.15,attacker.side);
  const place=urbanSiteAt(defender.x,defender.y)?.name??`الخلية ${defender.x+1}:${defender.y+1}`;
  const applied=previousHp-defender.hp;
  const targetName=defender.role==='supplyTruck'?'شاحنة الإمداد':armorDefender?ARMOR_MODELS[defender.modelId].name:`فصيل ${sideName(defender.side)}`;
  const attackerName=kornet?'فريق كورنيت':armorAttacker?ARMOR_MODELS[attacker.modelId].name:attacker.kind==='sniper'?'القناص':'المشاة';
  const lossText=lost?` خرج ${lost} من القوة من المعركة؛ المتبقي ${defender.strength}/${defender.maxStrength}.`:' لم تُدمّر أي آلية أو جندي.';
  log(battle,`${ambushStrike?'ضربة كمين مباغتة؛ ':''}${attackerName} أصاب ${targetName} وسبب ${applied} ضرر؛ الصحة ${defender.hp}/${defender.maxHp}.${lossText}`);
  if (defender.strength <= 0) {

    if(defender.role==='supplyTruck'){const convoy=battle.logistics?.convoys?.find(item=>(item.truckId??item.id)===defender.id);if(convoy){convoy.cancelled=true;battle.logistics.convoys=battle.logistics.convoys.filter(item=>!item.cancelled)}log(battle,'دُمّرت شاحنة الإمداد؛ فُقدت حمولتها ولن تصل إلى القوة المقصودة.')}else log(battle, `تم إخراج فصيل ${sideName(defender.side)} من المعركة.`);
  }
  recordExchange(battle,attacker,defender,applied,reaction?'reaction':ambush?'ambush':'attack');
  if(!reaction&&!ambush&&canReact(battle,defender,attacker,unitAttackRange,distance,terrainSight)) {
    log(battle,defender.weaponId==='kornet'?'ردّ دفاعي بصاروخ كورنيت؛ استُهلكت رمية الفريق لهذه الجولة.':'ردّ دفاعي فوري؛ يبقى أمر الوحدة الهجومي متاحاً في دورها.');
    attack(battle,defender,attacker,true);
  }
  return true;
}

function localPower(battle, side, center, radius = 2) {
  return ownUnits(battle,side).filter(unit => unit.role!=='supplyTruck'&&distance(unit,center) <= radius).reduce((sum,unit)=>sum+unit.strength,0);
}
function perceivedLocalPower(battle,side,center,radius=2){return ownUnits(battle,side).filter(unit=>unit.role!=='supplyTruck'&&isUnitDetected(battle,unit,side==='blue'?'red':'blue')&&distance(unit,center)<=radius).reduce((sum,unit)=>sum+unit.strength,0);}

function closestStrategicSite(battle, point, side) {
  return battle.sites.filter(site => site.owner === side).sort((a,b) => distance(a,point) - distance(b,point))[0] || null;
}

function safeRetreat(battle, unit) {
  const reach = redReachable(battle,unit,unit.movement,true);
  const post=unit.siteId?battle.sites.find(site=>site.id===unit.siteId&&site.owner==='red'):null;
  return reach.filter(cell => !inEnemyControl(battle,'red',cell.x,cell.y)).sort((a,b) => {
    const aEnemy = Math.min(...perceivedEnemyUnits(battle,'red').map(enemy => distance(a,enemy)),99);
    const bEnemy = Math.min(...perceivedEnemyUnits(battle,'red').map(enemy => distance(b,enemy)),99);
    const aSite = closestStrategicSite(battle,a,'red'), bSite = closestStrategicSite(battle,b,'red');
    const aSafe = aEnemy * 2 - (aSite ? distance(a,aSite) * .35 : 0) + (battle.owners[indexOf(a.x,a.y)] === 'red' ? 1 : 0) + (post ? Math.max(0,4-distance(a,post))*2 : 0);
    const bSafe = bEnemy * 2 - (bSite ? distance(b,bSite) * .35 : 0) + (battle.owners[indexOf(b.x,b.y)] === 'red' ? 1 : 0) + (post ? Math.max(0,4-distance(b,post))*2 : 0);
    return bSafe - aSafe;
  })[0] || null;
}

function redReachable(battle, unit, budget = unit.movement, ignoreControl = false) {
 budget=Math.min(budget,fatigueMovement(unit));
  const seen = new Map([[cellKey(unit.x,unit.y),0]]), parents = new Map(),fuelCosts=new Map([[cellKey(unit.x,unit.y),0]]), queue = [{x:unit.x,y:unit.y,cost:0}];
  while(queue.length){
    queue.sort((a,b)=>a.cost-b.cost);
    const current=queue.shift(), key=cellKey(current.x,current.y), cost=seen.get(key);
    if(current.cost!==cost)continue;

    for(const [dx,dy]of directions(current.y)){const x=current.x+dx,y=current.y+dy,next=cellKey(x,y);if(!inBounds(x,y)||unitAt(battle,x,y,unit))continue;const nextCost=Math.round((cost+tileCost(x,y,unit))*10)/10,fuelCost=(fuelCosts.get(key)??0)+movementFuelCost(unit,x,y);if(nextCost>budget||(unit.modelId&&fuelCost>unit.fuel+1e-6)||(seen.has(next)&&seen.get(next)<=nextCost))continue;seen.set(next,nextCost);fuelCosts.set(next,fuelCost);parents.set(next,key);queue.push({x,y,cost:nextCost})}
  }
  return [...seen].filter(([key])=>key!==cellKey(unit.x,unit.y)).map(([key,cost])=>{const [x,y]=key.split(',').map(Number),path=[];let cur=key;while(cur!==cellKey(unit.x,unit.y)){const [px,py]=cur.split(',').map(Number);path.unshift({x:px,y:py});cur=parents.get(cur);if(!cur)break}return{x,y,cost,path}});
}

function planEnemy(battle) {
  const reds = ownUnits(battle,'red').filter(unit=>unit.role!=='supplyTruck'), blues = ownUnits(battle,'blue').filter(unit=>!unit.hidden&&unit.role!=='supplyTruck'), blueTrucks=ownUnits(battle,'blue').filter(unit=>unit.role==='supplyTruck');
  const plans = new Map();
  const available = new Set(reds.map(unit=>unit.id));
  for(const unit of reds.filter(u=>['fieldArtillery','katyusha','mortar','reconRadar'].includes(u.role))){
    available.delete(unit.id);
    if(unit.role==='reconRadar')continue;
    const target=blues.filter(enemy=>isUnitDetected(battle,enemy,'red')&&enemy.domain!=='air'&&distance(unit,enemy)>=2&&distance(unit,enemy)<=unitAttackRange(unit)).sort((a,b)=>distance(unit,a)-distance(unit,b))[0];
    if(target)plans.set(unit.id,{kind:'artilleryFire',targetPoint:{x:target.x,y:target.y}});
  }
  for(const unit of reds.filter(u=>u.kind==='engineer'&&available.has(u.id))){
    const enemy=blues.slice().sort((a,b)=>distance(unit,a)-distance(unit,b))[0];
    if(enemy&&distance(unit,enemy)<=2&&(unit.engineerCharges??0)>0)plans.set(unit.id,{kind:'engineerMine',target:enemy});
    else if(!battle.engineering?.fortifications?.some(f=>f.x===unit.x&&f.y===unit.y))plans.set(unit.id,{kind:'engineerFortify'});
    available.delete(unit.id);
  }

  // Enemy formations may intercept exposed supply trucks, but never treat them as troops or city threats.
  for(const unit of reds){const truck=blueTrucks.filter(item=>distance(unit,item)<=unitAttackRange(unit)+unit.movement).sort((a,b)=>distance(unit,a)-distance(unit,b))[0];if(truck){plans.set(unit.id,{kind:'interceptSupply',target:truck});available.delete(unit.id)}}

  // Pull reserves toward important cities when blue forces approach an uncovered site.
  const threats = battle.sites.filter(site=>site.owner==='red'&&siteThreatened(battle,site,'red'))
    .map(site=>({site,blueDistance:Math.min(...blues.map(unit=>distance(site,unit)),99),garrison:reds.filter(unit=>urbanSiteAt(unit.x,unit.y)?.id===site.id).length}))
    .sort((a,b)=>b.site.priority/(b.blueDistance+1)-a.site.priority/(a.blueDistance+1));
  for(const threat of threats){
    const need=threat.blueDistance<=2?3:threat.blueDistance<=4?2:1;
    let assigned=threat.garrison;
    while(assigned<need){
      const defender=reds.filter(unit=>available.has(unit.id)&&urbanSiteAt(unit.x,unit.y)?.id!==threat.site.id).sort((a,b)=>distance(a,threat.site)-distance(b,threat.site))[0];
      if(!defender)break;
      plans.set(defender.id,{kind:'defend',site:threat.site});available.delete(defender.id);assigned++;
    }
  }

  // A threatened formation breaks contact before it is boxed into one or no escape cells.
  for(const unit of reds.filter(unit=>available.has(unit.id))){
    const hostileAdjacent=blues.filter(enemy=>distance(unit,enemy)<=1).length;
    const safeExits=hexNeighbors(unit).filter(p=>inBounds(p.x,p.y)&&!unitAt(battle,p.x,p.y,unit)&&!inEnemyControl(battle,'red',p.x,p.y)).length;
    if((hostileAdjacent>=2&&safeExits<=2)||hostileAdjacent>=3){const destination=safeRetreat(battle,unit);if(destination){plans.set(unit.id,{kind:'retreat',path:destination.path});available.delete(unit.id)}}
  }

  // Snipers fire at range, or advance only when no higher-priority retreat is needed.
  for(const unit of reds.filter(unit=>unit.kind==='sniper')){
    if(plans.get(unit.id)?.kind==='retreat')continue;
    const range=unitAttackRange(unit), target=blues.filter(enemy=>distance(unit,enemy)<=range+unit.movement+2)
      .sort((a,b)=>distance(unit,a)-distance(unit,b)||a.strength-b.strength)[0];
    if(!target)continue;
    if(distance(unit,target)<=range){plans.set(unit.id,{kind:'sniperFire',target});available.delete(unit.id)}
    else if(available.has(unit.id)){plans.set(unit.id,{kind:'sniperAdvance',target});available.delete(unit.id)}
  }

  // Concentrate locally superior forces for a counterattack; do not attack at a bad exchange.
  for(const unit of reds.filter(unit=>available.has(unit.id)&&unit.kind!=='sniper')){
    const target=blues.filter(enemy=>distance(unit,enemy)<=Math.max(4,unitAttackRange(unit)+unit.movement)).sort((a,b)=>{
      const siteA=closestStrategicSite(battle,a,'red'),siteB=closestStrategicSite(battle,b,'red');
      return (siteA?distance(siteA,a)-siteA.priority*.35:99)-(siteB?distance(siteB,b)-siteB.priority*.35:99);
    })[0];
    if(!target)continue;
    const own=localPower(battle,'red',target,2), enemy=perceivedLocalPower(battle,'blue',target,2);
    const nearbySite=closestStrategicSite(battle,target,'red');
    const siteUrgent=nearbySite&&distance(nearbySite,target)<=3;
    const counterattackRatio=siteUrgent?.58:.82;
    if(own>=enemy*counterattackRatio&&(siteUrgent||distance(unit,target)<=2)){
      plans.set(unit.id,{kind:'counterattack',target});available.delete(unit.id);
    }
  }

  // Remaining defenders hold useful ground; reserves keep a screen around cities and roads.
  for(const unit of reds.filter(unit=>available.has(unit.id))){
    const site=unit.siteId?battle.sites.find(item=>item.id===unit.siteId&&item.owner==='red'):closestStrategicSite(battle,unit,'red');
    const target=blues.filter(enemy=>distance(unit,enemy)<=5).sort((a,b)=>distance(unit,a)-distance(unit,b))[0];
    if(target&&localPower(battle,'red',target,2)>=perceivedLocalPower(battle,'blue',target,2)*.65){plans.set(unit.id,{kind:'counterattack',target});}
    else if(site&&urbanSiteAt(unit.x,unit.y)?.id!==site.id&&!(unit.kind==='sniper'&&isMountainAt(unit.x,unit.y))){plans.set(unit.id,{kind:'defend',site});}
    else plans.set(unit.id,{kind:'hold',site});
  }
  return plans;
}

function pathToward(battle, unit, target, stopAdjacent = false) {
  const destinations=redReachable(battle,unit,unit.movement);
  if(!destinations.length)return null;
  const valid=destinations.filter(cell=>!stopAdjacent||distance(cell,target)<=1);
  if(valid.length)return valid.sort((a,b)=>distance(a,target)-distance(b,target)||a.cost-b.cost)[0];
  return destinations.sort((a,b)=>distance(a,target)-distance(b,target)||a.cost-b.cost)[0];
}

function pathIntoRange(battle,unit,target,range){
  const destinations=redReachable(battle,unit,unit.movement);
  const firing=destinations.filter(cell=>distance(cell,target)<=unitAttackRange(unit,cell.x,cell.y)&&distance(cell,target)>1)
    .sort((a,b)=>distance(b,target)-distance(a,target)||a.cost-b.cost);
  if(firing.length)return firing[0];
  return destinations.sort((a,b)=>distance(a,target)-distance(b,target)||a.cost-b.cost)[0]??null;
}

function shouldSpringAmbush(battle,defender,target) {
 if(!directWeapon(defender)||defender.reactionTurn===battle.turn||!terrainSight(defender,target))return false;
 const contacts=perceivedEnemyUnits(battle,defender.side).filter(t=>t.domain!=='air');
 const valuable=contacts.filter(t=>distance(defender,t)<=unitAttackRange(defender)+2)
   .sort((a,b)=>targetScore(defender,b,contacts,distance)-targetScore(defender,a,contacts,distance))[0];
 const current=targetScore(defender,target,contacts,distance);
 // A visible better target can justify waiting; immediate detection or danger overrides patience.
 return !valuable||valuable.id===target.id||current>=targetScore(defender,valuable,contacts,distance)-5
   ||defender.hp/defender.maxHp<.45||isUnitDetected(battle,defender,target.side);
}
export function beginEnemyTurn(battle) {
 if(battle.phase!=='player'||battle.finished)return [];
 battle.phase='enemy';
 if(getArmisticeState(battle).active){const contacts=perceivedEnemyUnits(battle,'red'),reserved=new Set();return ownUnits(battle,'red').filter(u=>u.role!=='supplyTruck').map(u=>{const choice=truceWithdrawal(battle,u,redReachable(battle,u).filter(c=>!reserved.has(cellKey(c.x,c.y))),contacts);if(choice)reserved.add(cellKey(choice.x,choice.y));return{unitId:u.id,kind:choice?'truceWithdraw':'hold',path:choice?.path??[]};});}
 const rebelPlan=assessRebelStrategy(battle);
 const rebels=ownUnits(battle,'red').filter(u=>u.role!=='supplyTruck');
 const contacts=perceivedEnemyUnits(battle,'red').filter(u=>u.domain!=='air');
 planRebelFronts(battle,contacts);
 const reserved=new Set(),commitments=new Map(),actions=[];
 const cover=c=>(urbanSiteAt(c.x,c.y)?2:0)+(elevationAt(c.x,c.y)>=.7?3:elevationAt(c.x,c.y)>=.3?2:0)+(passAt(c.x,c.y)?1:0);
 const ordered=rebels.slice().sort((a,b)=>(b.role==='antiArmor'?2:0)-(a.role==='antiArmor'?2:0));
 for(const unit of ordered){
  let action={unitId:unit.id,path:[],attackTargetId:null,kind:'hold'};
  const home=battle.sites.find(s=>s.id===unit.siteId&&s.owner==='red')??closestStrategicSite(battle,unit,'red')??unit;
  if(unit.attacked||unit.stoppedByMine){actions.push(action);reserved.add(cellKey(unit.x,unit.y));continue;}
  const tunnel=planTunnelMove(battle,unit,contacts,reserved);if(tunnel){if(distance(unit,{x:tunnel.entryX,y:tunnel.entryY})<=1){actions.push({...action,kind:'tunnel',tunnel});reserved.add(cellKey(tunnel.x,tunnel.y));continue;}const entry={x:tunnel.entryX,y:tunnel.entryY},approach=redReachable(battle,unit).filter(c=>!reserved.has(cellKey(c.x,c.y))).sort((a,b)=>distance(a,entry)-distance(b,entry)||a.cost-b.cost)[0];if(approach&&distance(approach,entry)<distance(unit,entry)){actions.push({...action,kind:'retreat',path:approach.path});reserved.add(cellKey(approach.x,approach.y));continue;}}
  const choices=[{x:unit.x,y:unit.y,path:[],cost:0},...redReachable(battle,unit)].filter(c=>!reserved.has(cellKey(c.x,c.y))||c.x===unit.x&&c.y===unit.y);
  const nearby=contacts.filter(t=>distance(unit,t)<=unit.movement+unitAttackRange(unit)+2);
  const ranked=nearby.slice().sort((a,b)=>
   (targetScore(unit,b,contacts,distance)-(commitments.get(b.id)??0)*12)-
   (targetScore(unit,a,contacts,distance)-(commitments.get(a.id)??0)*12));
  const nearest=contacts.slice().sort((a,b)=>distance(unit,a)-distance(unit,b))[0];
  const threats=c=>contacts.filter(t=>distance(t,c)<=unitAttackRange(t)&&terrainSight(t,c)).length;
  const safest=()=>choices.slice().sort((a,b)=>{
   const score=c=>Math.min(7,...contacts.map(t=>distance(c,t)))*2+cover(c)-threats(c)*2-distance(c,home)*.2-c.cost*.15;
   return score(b)-score(a);
  })[0];
  if(['commander','jammer'].includes(unit.role)){if(unit.role==='commander'&&nearest&&distance(unit,nearest)<6){const rear=choices.filter(c=>battle.owners[indexOf(c.x,c.y)]==='red').sort((a,b)=>(distance(b,nearest)*2-distance(b,home)-b.cost*.1)-(distance(a,nearest)*2-distance(a,home)-a.cost*.1))[0];action.path=rear?.path??[];action.kind='retreat';}else action.kind='campaignSupport';actions.push(action);const end=action.path.at(-1)??unit;reserved.add(cellKey(end.x,end.y));continue;}
  if(unit.order?.regroup&&battle.turn<unit.order.regroup.until&&battle.sites.some(s=>s.id===unit.order.regroup.siteId&&s.owner==='red'&&!s.contested)&&!nearby.length){action.kind='regroup';actions.push(action);reserved.add(cellKey(unit.x,unit.y));continue;}
  if((unit.morale<38||(unit.fatigue??0)>=65)&&battle.sites.some(s=>s.id===urbanSiteAt(unit.x,unit.y)?.id&&s.owner==='red'&&!s.contested)&&!nearby.length){action.kind='regroup';actions.push(action);reserved.add(cellKey(unit.x,unit.y));continue;}
  if(rebelPlan.mode==='hold-last-city'&&unit.role!=='commander'&&unit.role!=='jammer'&&nearby.length===0){const last=battle.sites.find(s=>s.id===rebelPlan.objective);if(last&&Math.abs(unit.y-last.y)<10&&distance(unit,last)>last.radius+1){const post=choices.filter(c=>battle.owners[indexOf(c.x,c.y)]==='red').sort((a,b)=>distance(a,last)-distance(b,last)||a.cost-b.cost)[0];action.kind='defend';action.path=post?.path??[];action.site=last;actions.push(action);const end=action.path.at(-1)??unit;reserved.add(cellKey(end.x,end.y));continue;}}
  if(unit.weaponId==='kornet'){
   const targets=ranked.filter(t=>t.modelId||t.role==='supplyTruck'||distance(unit,t)<=2);
   const t=targets.find(t=>distance(unit,t)<=5&&terrainSight(unit,t));
   if(t&&kornetReady(battle,unit)){action.kind='counterattack';action.attackTargetId=t.id;commitments.set(t.id,(commitments.get(t.id)??0)+1);}
   else if(nearest&&(unit.ammo<1||unit.hp/unit.maxHp<.35||distance(unit,nearest)<2)){action.kind='retreat';action.path=safest()?.path??[];}
   else if(targets[0]&&unit.ammo>=1){const goal=targets[0],score=c=>cover(c)*1.3-threats(c)*2-Math.abs(distance(c,goal)-4)*2+(terrainSight(c,goal)?2:0)-c.cost*.2;action.path=choices.slice().sort((a,b)=>score(b)-score(a))[0]?.path??[];action.kind='reposition';}
   const end=action.path.at(-1)??unit;reserved.add(cellKey(end.x,end.y));actions.push(action);continue;
  }
  const artillery=['fieldArtillery','katyusha','mortar'].includes(unit.role);
  const targetFacility=facilityTargets(battle).filter(t=>t.side==='blue'&&!t.asset.disabled&&distance(unit,t)<=unitAttackRange(unit)&&(!artillery||distance(unit,t)>=2)&&terrainSight(unit,t)).sort((a,b)=>(b.type==='commandPost'?2:0)-(a.type==='commandPost'?2:0))[0];
  if(targetFacility&&unit.ammo>0&&!ranked.some(t=>distance(unit,t)<=unitAttackRange(unit))){action.kind='facilityFire';action.facilityId=targetFacility.id;actions.push(action);continue;}
  if(nearest&&(unit.hp/unit.maxHp<.35||artillery&&distance(unit,nearest)<2)){
   action.kind='retreat';action.path=safest()?.path??[];
  }else if(artillery){
   const targets=ranked.filter(t=>distance(unit,t)>=2&&distance(unit,t)<=unitAttackRange(unit));
   targets.sort((a,b)=>{const score=t=>targetScore(unit,t,contacts,distance)+contacts.filter(v=>distance(v,t)<=1).length*(unit.role==='fieldArtillery'?0:7);return score(b)-score(a)});
   if(unit.lastRebelFire===battle.turn-1){action.kind='retreat';action.path=safest()?.path??[];}
   else if(targets.length&&unit.ammo>0){const t=targets[0];action.kind='artilleryFire';action.artilleryTarget={x:t.x,y:t.y};commitments.set(t.id,(commitments.get(t.id)??0)+1);}
   else if(unit.ammo>0&&knownTargets(battle,'red').some(r=>r.confidence>=65&&r.age<=2&&distance(unit,r)>=2&&distance(unit,r)<=unitAttackRange(unit))){const r=knownTargets(battle,'red').find(r=>r.confidence>=65&&r.age<=2&&distance(unit,r)>=2&&distance(unit,r)<=unitAttackRange(unit));action.kind='artilleryFire';action.artilleryTarget={x:r.x,y:r.y};}
   else if(ranked[0]){const t=ranked[0],range=unitAttackRange(unit);action.path=choices.slice().sort((a,b)=>(Math.abs(distance(a,t)-(range-1))+threats(a))-(Math.abs(distance(b,t)-(range-1))+threats(b))||a.cost-b.cost)[0]?.path??[];}
  }else if(unit.kind==='engineer'){
   const mine=scanEngineerMines(battle,'red').find(m=>m.side!=='red'&&distance(unit,m)<=1),job=engineerRepairJobs(battle,unit)[0];if(mine){action.kind='engineerClear';action.engineerTarget=mine;}else if(job){action.kind='engineerRepair';action.repairId=job.id;if(distance(unit,job.a)>2)action.path=choices.slice().sort((a,b)=>distance(a,job.a)-distance(b,job.a)||a.cost-b.cost)[0]?.path??[];}else{action.kind=nearest&&distance(unit,nearest)<=3?'engineerMine':'engineerFortify';action.engineerTarget=nearest;}
  }else if(['droneOperator','droneVehicle','antiAir'].includes(unit.role)){
   if(unit.role==='droneVehicle'||unit.role==='droneOperator'){if(nearest&&distance(unit,nearest)<=unitAttackRange(nearest)+1){const rear=choices.filter(c=>battle.owners[indexOf(c.x,c.y)]==='red').sort((a,b)=>(Math.min(8,...contacts.map(t=>distance(b,t)))*3-distance(b,home)-b.cost*.1)-(Math.min(8,...contacts.map(t=>distance(a,t)))*3-distance(a,home)-a.cost*.1))[0];action.kind='retreat';action.path=rear?.path??[];}else action.kind='hold';}else if(nearest&&distance(unit,nearest)<3){action.kind='retreat';action.path=safest()?.path??[];}
  }else if(directWeapon(unit)){
   const inRange=ranked.filter(t=>distance(unit,t)<=unitAttackRange(unit)&&terrainSight(unit,t));
   const t=inRange[0];
   if(t&&(!unit.hidden||shouldSpringAmbush(battle,unit,t))){action.kind='counterattack';action.attackTargetId=t.id;}
   else if(unit.hidden&&unit.ambushReady&&nearby.length){action.kind='ambushWait';}
   else if(ranked.length){
    const target=ranked[0],support=rebels.filter(u=>distance(u,target)<=5).length,opposition=contacts.filter(u=>distance(u,target)<=2).length;
    const flank=unit.rebelDuty==='flank'&&support>=2;
    const front=frontPlanFor(battle,unit),prepared=front?.mode==='attack'&&front.participants?.includes(unit.id);
    if(prepared&&(flank||support>=opposition)){
     const rear=battle.sites.filter(s=>s.owner==='blue').sort((a,b)=>distance(a,target)-distance(b,target))[0]??{x:target.x-3,y:target.y};
     const goals=hexNeighbors(target).flatMap(c=>hexNeighbors(c)).filter(c=>distance(c,target)===2);
     const goal=flank?(goals.sort((a,b)=>distance(a,rear)-distance(b,rear))[0]??target):target;
     const score=c=>-distance(c,goal)*2.5+cover(c)-threats(c)*1.6-c.cost*.1+
       (distance(c,target)<=unitAttackRange(unit,c.x,c.y)&&terrainSight(c,target)?4:0)+rebelPositionScore(battle,unit,c,contacts);
     const best=choices.slice().sort((a,b)=>score(b)-score(a))[0];
     if(best){action.path=best.path;action.kind=flank?'flank':'counterattack';action.attackTargetId=target.id;}
    }
   }
  }
  const front=frontPlanFor(battle,unit);
  if(action.kind==='hold'&&directWeapon(unit)&&nearby.length&&front){const best=choices.slice().sort((a,c)=>rebelPositionScore(battle,unit,c,contacts)-c.cost*.2-(rebelPositionScore(battle,unit,a,contacts)-a.cost*.2))[0];if(best){action.path=best.path;action.kind=front.mode==='stage'?'stage':'defend';}}
  if(action.attackTargetId)commitments.set(action.attackTargetId,(commitments.get(action.attackTargetId)??0)+1);
  if(action.kind==='hold'&&!action.path.length&&distance(unit,home)>(home.radius??1)+4){action.path=choices.slice().sort((a,b)=>distance(a,home)-distance(b,home)||a.cost-b.cost)[0]?.path??[];}
  const end=action.path.at(-1)??unit;reserved.add(cellKey(end.x,end.y));actions.push(action);
 }
 return actions;
}

export function resolveEnemyAction(battle, action) {
  const unit = battle.units.find(item => item.id === action.unitId && item.strength > 0);
  if (!unit || unit.stoppedByMine || unit.attacked) return;
  if(action.kind==='tunnel'){executeTunnelMove(battle,unit,action.tunnel);return;}
  if(action.kind==='campaignSupport')return;
  if(action.kind==='regroup'){unit.order={regroup:{siteId:urbanSiteAt(unit.x,unit.y)?.id,side:'red',until:battle.turn+2}};unit.attacked=true;unit.moved=true;return;}
  if(action.kind==='facilityFire'){const t=facilityTargets(battle).find(t=>t.id===action.facilityId);if(t){if(['fieldArtillery','katyusha','mortar'].includes(unit.role))fireArtillery(battle,unit.id,t.x,t.y,'red');else {damageFacility(battle,t.id,unit.modelId?38:14,'red');unit.ammo=Math.max(0,unit.ammo-1);unit.attacked=true;}}return;}
  if(action.kind==='ambushWait'){concealRebel(battle,unit);return;}
  if(action.kind==='artilleryFire'&&action.artilleryTarget){const result=fireArtillery(battle,unit.id,action.artilleryTarget.x,action.artilleryTarget.y,'red');if(result?.ok){unit.lastRebelFire=battle.turn;unit.revealedUntil=battle.turn+1;unit.hidden=false;}return}
  if(action.kind==='engineerClear'){clearFieldMine(battle,unit.id,action.engineerTarget.x,action.engineerTarget.y);return;}
  if(action.kind==='engineerRepair'){queueEngineerRepair(battle,unit,action.repairId);return;}
  if(action.kind==='engineerFortify'){buildFieldFortification(battle,unit.id);return}
  if(action.kind==='engineerMine'){
    const cell=hexNeighbors(unit).filter(p=>battle.owners[indexOf(p.x,p.y)]==='red'&&!unitAt(battle,p.x,p.y)&&!battle.engineering.minefields.some(m=>m.x===p.x&&m.y===p.y)).sort((a,b)=>distance(a,action.engineerTarget)-distance(b,action.engineerTarget))[0];
    if(cell)plantFieldMine(battle,unit.id,cell.x,cell.y);else buildFieldFortification(battle,unit.id);return;
  }
  if (action.kind === 'defend' && action.path.length) log(battle, `العدو يعزز محيط ${action.siteName} بفصيل إضافي.`);
  else if (action.kind === 'retreat' && action.path.length) log(battle, `فصيل العدو ${unit.id.slice(-1)} يعيد التموضع لتجنب الحصار.`);
  else if(action.kind==='interceptSupply')log(battle,'العدو يحاول اعتراض شاحنة الإمداد المكشوفة.');
  else if (action.kind === 'counterattack') log(battle, `العدو يجهز هجوماً معاكساً على الفصيل ${action.attackTargetId?.replace('blue-','')}.`);
  else if(action.kind==='sniperFire'||action.kind==='sniperAdvance')log(battle,`قناص العدو يطلق النار باتجاه الفصيل ${action.attackTargetId?.replace('blue-','')}.`);
  let target = battle.units.find(item => item.id === action.attackTargetId && item.side === 'blue' && item.strength > 0);
  if(action.attackTargetId&&(!target||!isUnitDetected(battle,target,'red')||distance(unit,target)>unitAttackRange(unit)||!terrainSight(unit,target))){const contacts=perceivedEnemyUnits(battle,'red');target=contacts.filter(t=>t.domain!=='air'&&distance(unit,t)<=unitAttackRange(unit)&&terrainSight(unit,t)).sort((a,b)=>targetScore(unit,b,contacts,distance)-targetScore(unit,a,contacts,distance))[0];}
  if (target && isUnitDetected(battle,target,'red') && distance(unit,target)<=unitAttackRange(unit)){if(attack(battle,unit,target))unit.lastRebelFire=battle.turn;}
  else if(!action.path.length&&!unit.attacked)concealRebel(battle,unit);
  if(action.kind==='flank'&&action.path.length)log(battle,'تحركت مجموعة متمردين على جناح القوات المتقدمة.');
}

export function finalizeTurn(battle) {
  initializePoliticalSystems(battle);
  syncForwardSupplyNetwork(battle);
  if(!getArmisticeState(battle).active)captureFacilities(battle,distance);
  balanceTunnelSupply(battle);finishMoraleRound(battle);consumeRoundSupply(battle);campaignTick(battle);
  for (const unit of battle.units) { if(!unit.order?.regroup)unit.order=null;unit.moved=false;unit.attacked=false;unit.pinned=false;unit.fieldActionUsed=false;unit.stoppedByMine=false; }
  if(!getArmisticeState(battle).active)captureSites(battle,true);
  syncForwardSupplyNetwork(battle);
  assessRebelStrategy(battle);
  if(battle.turn%4===0)accountIndustry(battle);
  processRecruitment(battle);
  advanceArmistice(battle);
  maybeOfferEnemyArmistice(battle);
  applyCityMorale(battle);
  for(const unit of battle.units.filter(u=>u.order?.regroup)){const order=unit.order.regroup,site=battle.sites.find(s=>s.id===order.siteId&&s.owner===unit.side&&!s.contested);const danger=perceivedEnemyUnits(battle,unit.side).some(e=>distance(e,unit)<=3);if(site&&battle.turn<order.until&&!danger){unit.morale=Math.min(100,unit.morale+7);log(battle,`${sideName(unit.side)} يستعيد بعض المعنويات قرب ${site.name}.`);}else unit.order=null;}
  if(battle.turn%4===0)performSupplyCycle(battle);
  const aliveBlue=ownUnits(battle,'blue').filter(unit=>unit.role!=='supplyTruck').length, aliveRed=ownUnits(battle,'red').filter(unit=>unit.role!=='supplyTruck').length;
  const progress=cityVictoryProgress(battle);
  if(aliveBlue===0){battle.finished=true;battle.winner='red';log(battle,'انتهت المعركة؛ خسر الفصيل الأزرق جميع وحداته.');}
  else if(rebellionObjectives(battle).won){battle.finished=true;battle.winner='blue';log(battle,'انتصار: أُمنت المدن، قُضي على تشكيلات التمرد، وحُيدت مقراته.');}
  finishSituationRound(battle);updatePublicBattleReports(battle);battle.turn++;startSituationRound(battle);intelligenceTick(battle,{blue:intelCommandBonus(battle,'blue'),red:intelCommandBonus(battle,'red')},maybeArmisticeIncident);
  if(!battle.finished){battle.phase='player';log(battle,`بدأت الجولة ${battle.turn}. قواتك ${aliveBlue} فصائل، والعدو ${aliveRed} فصائل.`);}
  return true;
}

export function remainingPlayerActivations(battle) {
  return ownUnits(battle,'blue').filter(unit => unit.role!=='supplyTruck'&&!unit.moved && !unit.attacked).length;
}

export function endPlayerTurn(battle) {
  if(battle.phase!=='player'||battle.finished)return false;
  const actions=beginEnemyTurn(battle);
  for(const action of actions){for(const point of action.path){if(!stepUnit(battle,action.unitId,point))break;}resolveEnemyAction(battle,action);}
  advanceSupplyConvoys(battle);return finalizeTurn(battle);
}

export function countUnits(battle, side) { return ownUnits(battle, side).filter(unit=>unit.role!=='supplyTruck').length; }
export function countSoldiers(battle, side) { return ownUnits(battle, side).filter(unit=>unit.role!=='supplyTruck'&&!['commander','jammer','fieldArtillery','katyusha','mortar','reconRadar'].includes(unit.role)&&!unit.modelId).reduce((sum,unit)=>sum+unit.strength,0); }
export function countArmoredUnits(battle,side){return ownUnits(battle,side).filter(unit=>!!unit.modelId).length;}

export function combatPower(battle, side, center, radius = 2) { return localPower(battle,side,center,radius); }


// Standalone suicide-drone game layer. Values are abstract game-balance values.
export const DRONE_MODELS = Object.freeze({
  light: { name:'خفيفة', range: 7, damage:18, stock:8, color:'#e4d18a' },
  standard: { name:'متوسطة', range: 11, damage:29, stock:6, color:'#8ad2df' },
  heavy: { name:'بعيدة', range: 15, damage:41, stock:4, color:'#e99b79' }
});
function chooseFreeCell(battle, side, desired, used){
  const choices=[];
  for(let y=0;y<GRID.rows;y++)for(let x=0;x<GRID.columns;x++){
    const idx=y*GRID.columns+x,key=`${x},${y}`;
    if(battle.owners[idx]!==side||used.has(key)||battle.units.some(u=>u.strength>0&&u.x===x&&u.y===y))continue;
    choices.push({x,y,d:hexDistance({x,y},desired)});
  }
  choices.sort((a,b)=>a.d-b.d||a.y-b.y||a.x-b.x);
  const point=choices[0];if(!point)throw new Error(`تعذر تحديد موضع آمن لوحدة الدرونات ${side}`);
  used.add(`${point.x},${point.y}`);return point;
}
export function createBattle(seed=4106){
  const battle=createSoldierBattle(seed),used=new Set();
  initializePoliticalSystems(battle);
  for(const u of battle.units)if(u.strength>0)used.add(`${u.x},${u.y}`);
  for(const side of ['blue','red']){
    // Keep the new launcher, team and base near the active front so they are visible on first load.
    const desired=side==='blue'?{team:{x:17,y:14},vehicle:{x:17,y:16},base:{x:13,y:15}}:{team:{x:22,y:14},vehicle:{x:24,y:16},base:{x:27,y:16}};
    const teamAt=chooseFreeCell(battle,side,desired.team,used);
    const vehicleAt=chooseFreeCell(battle,side,desired.vehicle,used);
    const baseAt=chooseFreeCell(battle,side,desired.base,used);
    battle.units.push({id:`${side}-drone-team-1`,side,kind:'droneOperator',role:'droneOperator',...teamAt,strength:2,maxStrength:2,hpPerStrength:22,maxHp:44,hp:44,morale:100,movement:3,moved:false,attacked:false,hidden:false,ambushReady:false,order:null,siteId:null,kills:0,pinned:false,ammo:0,maxAmmo:0,fuel:0,maxFuel:0,droneStock:3,maxDroneStock:3,launchRange: 9});
    battle.units.push({id:`${side}-drone-vehicle-1`,side,kind:'droneVehicle',role:'droneVehicle',...vehicleAt,strength:1,maxStrength:1,hpPerStrength:95,maxHp:95,hp:95,morale:100,movement:3,moved:false,attacked:false,hidden:false,ambushReady:false,order:null,siteId:null,kills:0,pinned:false,ammo:0,maxAmmo:0,fuel:0,maxFuel:0,droneStock:7,maxDroneStock:7,launchRange: 12});
    // ANTI_DRONE_INFANTRY_V1
    const aaAt=chooseFreeCell(battle,side,side==='blue'?{x:16,y:12}:{x:24,y:14},used);
    const manpads=makeUnit(`${side}-manpads-1`,side,aaAt.x,aaAt.y,'antiAir',null,'antiAir');
    Object.assign(manpads,{movement:3,antiDroneAmmo:4,maxAntiDroneAmmo:4,antiDroneRange:2.5,antiDroneAccuracy:.62});
    battle.units.push(manpads);
    battle.droneBases??=[];
    battle.droneBases.push({id:`${side}-drone-base`,side,...baseAt,stock:{light:8,standard:6,heavy:4},lastLaunchTurn:0});
  }
  battle.airDefenses=[];battle.inFlightDrones=[];battle.nextDroneFlightId=1;battle.droneSeed=(seed^0x51f15e)>>>0;
  for(const side of ['blue','red']){const wanted=side==='blue'?{x:18,y:13}:{x:22,y:13},at=chooseFreeCell(battle,side,wanted,used);battle.airDefenses.push({id:`${side}-air-defense-1`,side,...at,range:4.5,missiles:6,maxMissiles:6,accuracy:.62});}
  battle.engineering={nextMineId:1,minefields:[],fortifications:[]};
  for(const side of ['blue','red']){
    const positions=side==='blue'?[[12,17],[13,18],[14,17],[15,19],[16,18],[11,19]]:[[28,12],[29,13],[30,12],[31,14],[32,13],[27,14]];
    const roles=['fieldArtillery','katyusha','mortar','antiArmor','reconRadar','engineer'];
    roles.forEach((role,i)=>{
      const at=chooseFreeCell(battle,side,{x:positions[i][0],y:positions[i][1]},used),anti=role==='antiArmor',radar=role==='reconRadar',eng=role==='engineer',strength=anti?4:eng?6:1,hpPer=anti||eng?22:radar?90:120,ammo=role==='katyusha'?4:role==='mortar'?10:role==='fieldArtillery'?7:anti?10:eng?8:0;
      const unit={id:side+'-'+role+'-1',side,kind:eng?'engineer':role,x:at.x,y:at.y,strength,maxStrength:strength,hpPerStrength:hpPer,maxHp:strength*hpPer,hp:strength*hpPer,morale:100,movement:role==='katyusha'||anti?4:3,moved:false,attacked:false,hidden:false,ambushReady:false,order:null,role,siteId:null,kills:0,pinned:false,ammo,maxAmmo:ammo,fuel:0,maxFuel:0};
      if(eng){unit.engineerCharges=2;unit.maxEngineerCharges=4;unit.fieldActionUsed=false;}
      battle.units.push(unit);
    });
  }
  battle.events.unshift('مختبر الدرونات: الفرق والمركبات تتحرك ضمن نظام الجولات نفسه؛ اختر مصدراً ثم أطلق مسيرة على وحدة معادية ضمن المدى.');
  battle.events=battle.events.slice(-8);
  configureRebellion(battle);
  seedDroneIndustry(battle,{canPlace:canPlaceFacility,place:placeFacility,neighbors:hexNeighbors,path:supplyPath});
  initCampaign(battle);seedMountainCaves(battle);initIntelligence(battle);initRations(battle);intelligenceTick(battle);startSituationRound(battle);
  return battle;
}
/* MANPADS_SIDE_PROPAGATION_20261009 */
export function droneLaunchCheck(battle,{sourceId=null,baseId=null,targetId=null,typeId='standard',side='blue'}={}){
  const model=DRONE_MODELS[typeId];if(!model)return{ok:false,reason:'اختر نوع مسيرة صالحاً.'};
  const campaignTarget=(targetId?.startsWith('campaign:')||targetId?.startsWith('refinery:'))?facilityTargets(battle).find(t=>t.id===targetId&&t.side!==side&&!t.asset.disabled):null;
  const cell=/^cell:(\d+):(\d+)$/.exec(targetId??'');const target=campaignTarget?{...campaignTarget,kind:'building'}:cell&&inBounds(+cell[1],+cell[2])?{id:targetId,x:+cell[1],y:+cell[2],kind:'ground',name:'نقطة أرضية '+(+cell[1]+1)+'/'+(+cell[2]+1),side:'neutral'}:battle.units.find(u=>u.id===targetId&&u.strength>0&&u.side!==side&&isUnitDetected(battle,u,side));
  if(!target)return{ok:false,reason:'اختر وحدة معادية ظاهرة على الخريطة.'};
  let source,point,cap,stock;
  if(baseId){source=battle.droneBases?.find(b=>b.id===baseId&&b.side===side&&!b.disabled);if(!source)return{ok:false,reason:'قاعدة الدرونات غير متاحة.'};point=source;cap=16;stock=source.stock?.[typeId]??0;if((source.launchTurn===battle.turn?(source.launchUsed??0):0)>=4)return{ok:false,reason:'أطلقت هذه القاعدة مسيرة في هذه الجولة.'};}
  else{source=battle.units.find(u=>u.id===sourceId&&u.side===side&&u.strength>0&&['droneOperator','droneVehicle'].includes(u.role));if(!source)return{ok:false,reason:'اختر فريق المشغلين أو عربة إطلاق.'};point=source;cap=source.launchRange;stock=ensureDroneInventory(source)[typeId]??0;if(droneAllowance(battle,source)<=0||(side==='blue'&&battle.phase!=='player'))return{ok:false,reason:'استُهلكت حصة الإطلاق لهذه الجولة.'};}
  if(source.industryRole==='factory')return{ok:false,reason:'المصنع ينتج وينقل المسيرات ولا يطلقها.'};if(source.disabled||stock<=0)return{ok:false,reason:baseId?'نفد مخزون هذا النوع في القاعدة.':'نفدت المسيرات المحمولة؛ لم يعد هذا المصدر قادراً على الإطلاق.'};
  const distance=hexDistance(point,target),range=Math.min(model.range,cap);if(distance===0)return{ok:false,reason:'لا يمكن إطلاق مسيرة على خلية مصدر الإطلاق.'};if(target.kind==='ground'&&(battle.units.some(u=>u.side===side&&u.strength>0&&u.x===target.x&&u.y===target.y)||battle.droneBases?.some(b=>b.side===side&&b.x===target.x&&b.y===target.y)||battle.logistics?.depots?.some(d=>d.side===side&&d.x===target.x&&d.y===target.y)))return{ok:false,reason:'هذه الخلية تحتوي قوات أو منشأة صديقة؛ اختر هدفاً آخر.'};
  if(distance>range)return{ok:false,reason:`الهدف خارج المدى: ${model.name} يصل ${range} خلايا والهدف يبعد ${distance}.`};
  if(side==='blue'&&battle.phase!=='player')return{ok:false,reason:'انتظر دورك لإطلاق المسيرة.'};
  if(side==='red'&&battle.phase!=='enemy')return{ok:false,reason:'العدو لا يطلق خارج دوره.'};
  return{ok:true,source,target,point,model,distance,range,stock,baseId:baseId??null,side};
}
function droneRandom(battle){battle.droneSeed??=((battle.seed??1)^0x51f15e)>>>0;battle.droneSeed=(Math.imul(battle.droneSeed,1664525)+1013904223)>>>0;return battle.droneSeed/4294967296}
function consumeDrone(battle,check,options){if(getArmisticeState(battle).active)breakArmistice(battle,'إطلاق مسيرة هجومية أثناء الهدنة',check.side);const{source,target,model,baseId,distance,side}=check;if(baseId){source.stock[options.typeId]--;if(source.launchTurn!==battle.turn){source.launchTurn=battle.turn;source.launchUsed=0}source.launchUsed=(source.launchUsed??0)+1;source.lastLaunchTurn=battle.turn}else{source.hidden=false;source.revealedUntil=battle.turn+1;spendDrone(battle,source);ensureDroneInventory(source)[options.typeId]--;source.droneStock--;source.lastDroneLaunchTurn=battle.turn;source.attacked=droneAllowance(battle,source)<=0;source.moved=true;if(source.role==='droneOperator'&&source.droneStock===0){source.strength=0;source.hp=0}}const id=`drone-flight-${battle.turn}-${battle.nextDroneFlightId++}`,p=hexCenter(check.point.x,check.point.y),flight={id,side,typeId:options.typeId,modelName:model.name,damage:model.damage,targetId:target.id,targetCell:{x:target.x,y:target.y},sourceId:source.id,baseId:baseId??null,start:{x:check.point.x,y:check.point.y},progress:0,x:p.x,y:p.y,status:'flying',engagedDefenses:[]};battle.inFlightDrones??=[];battle.inFlightDrones.push(flight);battle.droneStrikeAudit??=[];battle.droneStrikeAudit.push({flightId:id,turn:battle.turn,side,sourceId:source.id,targetId:target.id,x:target.x,y:target.y,state:'flying'});battle.droneStrikeAudit=battle.droneStrikeAudit.slice(-80);log(battle,`أُطلقت مسيرة ${model.name} نحو ${target.modelId?ARMOR_MODELS[target.modelId].name:target.kind==='infantry'?'قوات العدو':'وحدة العدو'}؛ المسيرة في الطريق ويمكن اعتراضها.`);return{ok:true,flight,source,target,model,distance,baseId:check.baseId??null,removedOperator:source.role==='droneOperator'&&source.droneStock===0&&source.strength===0}}
/* DRONE_STRIKE_ANY_ASSET_20261009 */
export function droneSiteLaunchCheck(battle,{sourceId=null,baseId=null,siteId=null,siteTileX=null,siteTileY=null,radarId=null,depotId=null,droneBaseTargetId=null,typeId='standard',side='blue'}={}){
 const model=DRONE_MODELS[typeId];if(!model)return{ok:false,reason:'اختر نوع مسيرة صالحاً.'};
 const site=siteId?battle.sites.find(item=>item.id===siteId):null;
 const radar=radarId?battle.airDefenses?.find(item=>item.id===radarId):null;
 const depot=depotId?battle.logistics?.depots?.find(item=>item.id===depotId):null;
 const droneBase=droneBaseTargetId?battle.droneBases?.find(item=>item.id===droneBaseTargetId):null;
 const hasSiteTile=Number.isInteger(siteTileX)&&Number.isInteger(siteTileY),siteTile=hasSiteTile?site?.tiles?.find(tile=>tile.x===siteTileX&&tile.y===siteTileY):null,siteTileKey=hasSiteTile?siteTileX+','+siteTileY:null;
 if(siteId&&(!site||site.owner===side))return{ok:false,reason:'اختر مدينة أو قرية معادية.'};
 if(radarId&&(!radar||radar.side===side||radar.disabled))return{ok:false,reason:'اختر دفاعاً جوياً معادياً.'};
 if(depotId&&(!depot||depot.side===side||depot.disabled))return{ok:false,reason:'مركز الإمداد غير موجود أو خارج الخدمة أو يتبع قواتك.'};
 if(droneBaseTargetId&&(!droneBase||droneBase.side===side||droneBase.disabled))return{ok:false,reason:'قاعدة الدرونات غير موجودة أو مدمرة أو تتبع قواتك.'};
 if(!site&&!radar&&!depot&&!droneBase)return{ok:false,reason:'الهدف المحدد غير موجود.'};
 if(site&&(site.structureHp??100)<=0)return{ok:false,reason:'مباني هذا الموقع مدمرة بالفعل.'};
 if((siteTileX!==null||siteTileY!==null)&&(!hasSiteTile||!siteTile))return{ok:false,reason:'المبنى المحدد غير موجود ضمن هذا الموقع.'};
 if(hasSiteTile&&(site.buildingIntegrity?.[siteTileKey]?.hp??100)<=0)return{ok:false,reason:'هذا المبنى مدمر بالفعل؛ اختر مبنى آخر.'};
 if(depot&&(depot.structureHp??100)<=0)return{ok:false,reason:'مركز الإمداد مدمر بالفعل.'};
 if(droneBase&&(droneBase.structureHp??90)<=0)return{ok:false,reason:'قاعدة الدرونات مدمرة بالفعل.'};
 let source,point,cap,stock;
 if(baseId){source=battle.droneBases?.find(item=>item.id===baseId&&item.side===side&&!item.disabled);if(!source)return{ok:false,reason:'قاعدة الإطلاق غير متاحة.'};point=source;cap=16;stock=source.stock?.[typeId]??0;if((source.launchTurn===battle.turn?(source.launchUsed??0):0)>=4)return{ok:false,reason:'أطلقت هذه القاعدة مسيرة في هذه الجولة.'}}
 else{source=battle.units.find(item=>item.id===sourceId&&item.side===side&&item.strength>0&&['droneOperator','droneVehicle'].includes(item.role));if(!source)return{ok:false,reason:'اختر فريق المشغلين أو عربة الإطلاق.'};point=source;cap=source.launchRange??16;stock=ensureDroneInventory(source)[typeId]??0;if(droneAllowance(battle,source)<=0||(side==='blue'&&battle.phase!=='player'))return{ok:false,reason:'انتهت حصة الإطلاق أو ليس دورك.'}}
 if(source.industryRole==='factory')return{ok:false,reason:'المصنع ينتج وينقل المسيرات ولا يطلقها.'};if(source.disabled||stock<=0)return{ok:false,reason:'نفد مخزون هذا المصدر.'};
 if(side==='blue'&&battle.phase!=='player')return{ok:false,reason:'انتظر دورك لإطلاق المسيرة.'};
 if(side==='red'&&battle.phase!=='enemy')return{ok:false,reason:'العدو لا يطلق خارج دوره.'};
 const target=site?hasSiteTile?{id:'site-tile:'+site.id+':'+siteTileX+':'+siteTileY,siteId:site.id,siteTileX,siteTileY,name:'مبنى '+site.name,kind:'building',side:site.owner,x:siteTileX,y:siteTileY}:{id:'site:'+site.id,siteId:site.id,name:site.name,kind:'building',side:site.owner,x:site.x,y:site.y}:radar?{id:'radar:'+radar.id,radarId:radar.id,name:'الدفاع الجوي',kind:'air-defense',side:radar.side,x:radar.x,y:radar.y}:depot?{id:'depot:'+depot.id,depotId:depot.id,name:'مركز الإمداد',kind:'supply-depot',side:depot.side,x:depot.x,y:depot.y}: {id:'baseTarget:'+droneBase.id,droneBaseTargetId:droneBase.id,name:'قاعدة الدرونات',kind:'drone-base',side:droneBase.side,x:droneBase.x,y:droneBase.y};
 const distance=hexDistance(point,target),range=Math.min(model.range,cap);if(distance===0)return{ok:false,reason:'لا يمكن إطلاق مسيرة على خلية مصدر الإطلاق.'};if(target.kind==='ground'&&(battle.units.some(u=>u.side===side&&u.strength>0&&u.x===target.x&&u.y===target.y)||battle.droneBases?.some(b=>b.side===side&&b.x===target.x&&b.y===target.y)||battle.logistics?.depots?.some(d=>d.side===side&&d.x===target.x&&d.y===target.y)))return{ok:false,reason:'هذه الخلية تحتوي قوات أو منشأة صديقة؛ اختر هدفاً آخر.'};if(distance>range)return{ok:false,reason:'الهدف خارج المدى: '+model.name+' يصل '+range+' خلايا والهدف يبعد '+distance+'.'};
 return{ok:true,source,target,point,model,distance,range,baseId:baseId??null,side,site,siteTile:hasSiteTile?{x:siteTileX,y:siteTileY,key:siteTileKey}:null,radar,depot,droneBase}
}
export function startDroneFlight(battle,options={}){const check=options.siteId||options.radarId||options.depotId||options.droneBaseTargetId?droneSiteLaunchCheck(battle,options):droneLaunchCheck(battle,options);if(!check.ok)return check;if(getArmisticeState(battle).active){const side=options.side??'blue',target=check.target,observed=(battle.airDefenses??[]).some(d=>d.side!==side&&!d.disabled&&hexDistance(d,target)<=d.range)||(battle.units??[]).some(u=>u.side!==side&&u.strength>0&&isUnitDetected(battle,u,side)&&hexDistance(u,target)<=3);maybeArmisticeIncident(battle,side,'drone',observed);}return consumeDrone(battle,check,{...options,typeId:options.typeId??'standard'})}
export function startDroneSalvo(battle,options={}){options={typeId:'standard',side:'blue',...options};const check=options.siteId||options.radarId||options.depotId||options.droneBaseTargetId?droneSiteLaunchCheck(battle,options):droneLaunchCheck(battle,options);if(!check.ok)return check;check.stock??=check.baseId?check.source.stock[options.typeId]:ensureDroneInventory(check.source)[options.typeId];const count=Math.max(1,Math.trunc(Number(options.count)||1));if(check.baseId&&count>4-(check.source.launchTurn===battle.turn?(check.source.launchUsed??0):0))return{ok:false,reason:'حد المنصة أربع مسيرات في الجولة.'};if(!check.baseId&&count>droneAllowance(battle,check.source))return{ok:false,reason:'الحد المتبقي لهذه الجولة '+droneAllowance(battle,check.source)+' مسيرات.'};if(count>check.stock)return{ok:false,reason:'المخزون لا يكفي: المتاح '+check.stock+' والمطلوب '+count+'.'};const flights=[];for(let i=0;i<count;i++){const result=consumeDrone(battle,check,{...options,typeId:options.typeId??'standard'});flights.push(result.flight)}return{ok:true,flights,source:check.source,target:check.target,model:check.model,distance:check.distance,baseId:check.baseId??null,removedOperator:check.source.role==='droneOperator'&&check.source.droneStock===0&&check.source.strength===0}}

export function attemptDroneInterception(battle,flightId,defenseId){
 const flight=battle.inFlightDrones?.find(item=>item.id===flightId&&item.status==='flying');
 const fixed=battle.airDefenses?.find(item=>item.id===defenseId);
 const mobile=fixed?null:battle.units?.find(item=>item.id===defenseId&&item.role==='antiAir');
 const defense=fixed||mobile,ammunition=fixed?defense?.missiles:mobile?.antiDroneAmmo;
 if(!flight||!defense||!flight.side||!defense.side||defense.side===flight.side||defense.disabled||ammunition<=0||flight.engagedDefenses.includes(defense.id))return{attempted:false,intercepted:false};
 flight.engagedDefenses.push(defense.id);if(fixed)defense.missiles--;else defense.antiDroneAmmo--;
 const remaining=fixed?defense.missiles:defense.antiDroneAmmo,maximum=fixed?defense.maxMissiles:defense.maxAntiDroneAmmo;
 const intercepted=droneRandom(battle)<(fixed?defense.accuracy:(defense.antiDroneAccuracy??.62));
 if(intercepted){flight.status='intercepted';battle.inFlightDrones=battle.inFlightDrones.filter(item=>item.id!==flight.id);log(battle,`اعترض ${fixed?'الدفاع الجوي':'جندي الدفاع المحمول'} ${defense.side==='blue'?'الصديق':'المعادي'} المسيرة؛ المتبقي ${remaining} من ${maximum} صواريخ التصدي.`)}
 else log(battle,`أطلق ${fixed?'الدفاع الجوي':'جندي الدفاع المحمول'} صاروخ تصدٍ لكنه أخفق؛ المسيرة تواصل طريقها. المتبقي ${remaining}.`);
 return{attempted:true,intercepted,defense,flight};
}
/* DRONE_ASSET_DAMAGE_RESOLUTION_20261009 */
export function resolveDroneImpact(battle,flightId){const result=resolveDroneImpactAt(battle,flightId);const audit=battle.droneStrikeAudit?.find(a=>a.flightId===flightId);if(audit){audit.state=result.ok?'impact':result.reason??'intercepted';audit.damage=result.damage??0;}return result;}
function resolveDroneImpactAt(battle,flightId){
 const flight=battle.inFlightDrones?.find(item=>item.id===flightId&&item.status==='flying');if(!flight)return{ok:false,intercepted:true};
 const moving=battle.units.find(u=>u.id===flight.targetId);if(moving&&flight.targetCell&&(moving.x!==flight.targetCell.x||moving.y!==flight.targetCell.y||moving.strength<=0))flight.targetId='cell:'+flight.targetCell.x+':'+flight.targetCell.y;
 const campaignTarget=facilityTargets(battle).find(t=>t.id===flight.targetId);
 const flightUnit=battle.units.find(u=>u.id===flight.targetId);const cellCoords=/^cell:(\d+):(\d+)$/.exec(flight.targetId);const targetPoint=campaignTarget??flightUnit??(cellCoords?{x:+cellCoords[1],y:+cellCoords[2]}:null);
 if(targetPoint&&jamDrone(battle,flight,targetPoint))return{ok:false,intercepted:true,reason:'انقطع التوجيه بفعل التشويش.'};
 if(campaignTarget){const hit=damageFacility(battle,campaignTarget.id,DRONE_MODELS[flight.typeId].damage,flight.side);flight.status='impact';battle.inFlightDrones=battle.inFlightDrones.filter(f=>f!==flight);return{ok:!!hit,damage:hit?.damage??0,model:DRONE_MODELS[flight.typeId],target:{...campaignTarget.asset,kind:'building'},targetType:'building',distance:hexDistance(flight.start,campaignTarget)};}
 const ground=/^cell:(\d+):(\d+)$/.exec(flight.targetId);if(ground){const x=+ground[1],y=+ground[2],unit=battle.units.find(u=>u.strength>0&&u.x===x&&u.y===y),asset=facilityTargets(battle).find(t=>t.x===x&&t.y===y&&!t.asset.disabled),site=battle.sites.find(s=>s.structureTiles?.some(t=>t.x===x&&t.y===y));if(unit||asset||site){flight.targetId=unit?.id??asset?.id??('site-tile:'+site.id+':'+x+':'+y);return resolveDroneImpact(battle,flightId);}const refinery=battle.refineries?.find(r=>r.x===x&&r.y===y&&r.hp>0);let damage=0;if(refinery){damage=Math.min(refinery.hp,DRONE_MODELS[flight.typeId].damage);refinery.hp-=damage;refinery.destroyed=refinery.hp<=0;}flight.status='impact';battle.inFlightDrones=battle.inFlightDrones.filter(f=>f!==flight);return{ok:true,damage,model:DRONE_MODELS[flight.typeId],target:refinery??{x,y,kind:'ground',hp:0},targetType:refinery?'refinery':'ground',distance:hexDistance(flight.start,{x,y})};}
 const unit=battle.units.find(item=>item.id===flight.targetId&&item.strength>0),siteTileMatch=/^site-tile:([^:]+):(-?\d+):(-?\d+)$/.exec(flight.targetId),site=unit?null:siteTileMatch?battle.sites.find(item=>item.id===siteTileMatch[1]):battle.sites.find(item=>'site:'+item.id===flight.targetId),radar=!unit&&!site?battle.airDefenses?.find(item=>'radar:'+item.id===flight.targetId):null,depot=!unit&&!site&&!radar?battle.logistics?.depots?.find(item=>'depot:'+item.id===flight.targetId):null,droneBase=!unit&&!site&&!radar&&!depot?battle.droneBases?.find(item=>'baseTarget:'+item.id===flight.targetId):null;
 if(!unit&&!site&&!radar&&!depot&&!droneBase){flight.status='no-target';battle.inFlightDrones=battle.inFlightDrones.filter(item=>item.id!==flight.id);log(battle,'وصلت المسيرة لكن الهدف لم يعد موجوداً؛ لم يسجل ضرر.');return{ok:false,reason:'اختفى الهدف قبل الوصول.'}}
 const model=DRONE_MODELS[flight.typeId];civilianImpact(battle,siteTileMatch?+siteTileMatch[2]:(site??unit)?.x,siteTileMatch?+siteTileMatch[3]:(site??unit)?.y,model.damage,flight.side);let damage=Math.round(model.damage*droneDamageFactor(flight.typeId,unit??{kind:site?'building':radar?'air-defense':depot?'supply-depot':'drone-base'}));
 if(site&&siteTileMatch){const x=Number(siteTileMatch[2]),y=Number(siteTileMatch[3]),tileKey=x+','+y;site.buildingIntegrity??={};const result=damageMapObject(battle,x,y,damage,'building'),building=result?.object??site.buildingIntegrity[tileKey]??{hp:100,maxHp:100,hits:0};if(!result){damage=Math.min(building.hp,damage);building.hp=Math.max(0,building.hp-damage);building.hits++;site.buildingIntegrity[tileKey]=building}else damage=result.damage;site.hitBuildingKey=tileKey;log(battle,building.hp===0?'دمّرت مسيرة '+model.name+' المبنى المحدد في '+site.name+'؛ بقية مباني الموقع لم تتضرر.':'أصابت مسيرة '+model.name+' مبنى في '+site.name+'؛ سلامة هذا المبنى '+building.hp+'/100.')}
 else if(site){site.structureMaxHp??=100;site.structureHp??=100;damage=Math.min(site.structureHp,damage);site.structureHp=Math.max(0,site.structureHp-damage);site.structureDestroyed=site.structureHp===0;site.structureHits=(site.structureHits??0)+1;log(battle,site.structureDestroyed?'دمّرت مسيرة '+model.name+' مباني '+site.name+'؛ بقيت السيطرة على المدينة كما هي.':'أصابت مسيرة '+model.name+' مباني '+site.name+'؛ سلامة المباني '+site.structureHp+'/100.')}
 else if(radar){radar.structureMaxHp??=60;radar.structureHp??=60;damage=Math.min(radar.structureHp,damage);radar.structureHp=Math.max(0,radar.structureHp-damage);radar.disabled=radar.structureHp===0;if(radar.disabled){radar.missiles=0;radar.range=0}log(battle,radar.disabled?'دمّرت المسيرة منظومة الدفاع الجوي؛ توقفت عن اعتراض المسيرات.':'تضررت منظومة الدفاع الجوي؛ سلامتها '+radar.structureHp+'/60.')}
 else if(depot){depot.structureMaxHp??=100;depot.structureHp??=100;damage=Math.min(depot.structureHp,damage);depot.structureHp=Math.max(0,depot.structureHp-damage);const remainingRatio=depot.structureHp/depot.structureMaxHp;depot.ammo=Math.floor(depot.ammo*remainingRatio);depot.fuel=Math.floor(depot.fuel*remainingRatio);if(depot.structureHp===0){depot.disabled=true;depot.auto=false;depot.ammo=0;depot.fuel=0;battle.logistics.queue=(battle.logistics.queue??[]).filter(order=>order.side!==depot.side)}log(battle,depot.disabled?'دمّرت المسيرة مركز الإمداد؛ توقف تجديد الذخيرة والوقود منه.':'أصابت المسيرة مركز الإمداد؛ سلامته '+depot.structureHp+'/100.')}
 else if(droneBase){droneBase.structureMaxHp??=90;droneBase.structureHp??=90;damage=Math.min(droneBase.structureHp,damage);droneBase.structureHp=Math.max(0,droneBase.structureHp-damage);const remainingRatio=droneBase.structureHp/droneBase.structureMaxHp;for(const type of Object.keys(droneBase.stock??{}))droneBase.stock[type]=droneBase.disabled?0:Math.floor(droneBase.stock[type]*remainingRatio);if(droneBase.structureHp===0){droneBase.disabled=true;for(const type of Object.keys(droneBase.stock??{}))droneBase.stock[type]=0}log(battle,droneBase.disabled?'دمّرت المسيرة قاعدة الدرونات؛ أُتلف مخزونها وتوقفت عن الإطلاق.':'أصابت المسيرة قاعدة الدرونات؛ سلامتها '+droneBase.structureHp+'/90.')}
 else{if(unit.modelId){const armor=ARMOR_MODELS[unit.modelId];damage=Math.round(damage*(armor.category==='tank'?.62:.82))}damage=Math.round(damage*blastCover(battle,unit));damage=Math.min(unit.hp,damage);const before=unit.strength;unit.hp=Math.max(0,unit.hp-damage);unit.strength=Math.max(0,Math.min(unit.maxStrength,Math.ceil((unit.hp-1e-8)/unit.hpPerStrength)));unit.morale=Math.max(0,unit.morale-Math.round(4+damage*.14));const source=battle.units.find(item=>item.id===flight.sourceId);if(source)source.kills+=(before-unit.strength);log(battle,unit.strength===0?'أصابت المسيرة الهدف وأخرجته من المعركة.':'وصلت المسيرة: '+damage+' ضرر، المتبقي '+unit.hp+'/'+unit.maxHp+'.')}
 flight.status='impact';battle.inFlightDrones=battle.inFlightDrones.filter(item=>item.id!==flight.id);const target=site??radar??depot??droneBase??unit,source=battle.units.find(item=>item.id===flight.sourceId);return{ok:true,damage,distance:hexDistance(flight.start,target),model,target,targetType:site?'building':radar?'air-defense':depot?'supply-depot':droneBase?'drone-base':'unit',site,radar,depot,droneBase,source,removedOperator:source?.role==='droneOperator'&&source.droneStock===0&&source.strength===0}
}
export function launchDrone(battle,options={}){const started=startDroneFlight(battle,options);if(!started.ok)return started;return resolveDroneImpact(battle,started.flight.id)}

/* SUICIDE_DRONE_TARGETS_TURN_FX_2026_10 */

function concealRebel(battle,unit){
 if(unit.side!=='red'||!['infantry','sniper','antiArmor'].includes(unit.kind)||unit.strength<=0)return;
 if((unit.revealedUntil??0)>=battle.turn||perceivedEnemyUnits(battle,'red').some(u=>distance(u,unit)<=1))return;
 const house=mapObjectAt(battle,unit.x,unit.y,'building');
 if(house&&['house','apartment'].includes(house.type)&&house.hp>0)garrisonInHouse(battle,unit.id);
 if(unit.garrisonedIn||isMountainAt(unit.x,unit.y)){unit.hidden=true;unit.ambushReady=true;}
}
function configureRebellion(battle){
 battle.scenario='rebellion-terrain-v2';
 battle.sites.forEach(s=>{s.owner=['noran','darin','ravan'].includes(s.id)?'blue':'red';s.contested=false;s.captureRounds=0});
 updateRebelTerritory(battle);
 battle.units=battle.units.filter(u=>u.side==='blue'||!u.modelId&&u.role!=='reconRadar');
 battle.units.push({...battle.units.find(u=>u.id==='red-antiArmor-1'),id:'red-antiArmor-2'});
 const templates=['red-2','red-7','red-antiArmor-1','red-drone-team-1'];
 for(const region of ['hazan','darun','narin','qalara'])for(let i=0;i<templates.length;i++){const src=battle.units.find(u=>u.id===templates[i]);battle.units.push({...src,id:'red-'+region+'-'+i,siteId:region});}
 const kornetTeams=new Set(['blue-antiArmor-1','red-antiArmor-1','red-hazan-2','red-darun-2','red-qalara-2']);
 for(const u of battle.units)if(kornetTeams.has(u.id))Object.assign(u,{weaponId:'kornet',strength:3,maxStrength:3,hpPerStrength:22,hp:66,maxHp:66,movement:2,ammo:4,maxAmmo:4});
 const occupied=new Set(AIRPORT_CELLS.map(([x,y])=>cellKey(x,y)));
 function deploy(unit,desired){
  const choices=[];
  for(let y=1;y<GRID.rows-1;y++)for(let x=1;x<GRID.columns-1;x++){
   if(occupied.has(cellKey(x,y))||battle.owners[indexOf(x,y)]!==unit.side||!Number.isFinite(movementCost(unit,x,y)))continue;
   const height=elevationAt(x,y),distanceCost=distance({x,y},desired);
   const coverPreference=unit.kind==='sniper'||unit.rebelDuty==='flank';
   choices.push({x,y,score:distanceCost-(coverPreference&&height>=.3?3.5:0)});
  }
  choices.sort((a,b)=>a.score-b.score||a.y-b.y||a.x-b.x);const p=choices[0];if(!p)throw Error('No valid deployment cell');unit.x=p.x;unit.y=p.y;occupied.add(cellKey(p.x,p.y));
 }
 let blueIndex=0,redIndex=0;
 for(const unit of battle.units){
  if(unit.side==='blue'){const i=blueIndex++,front=[6,19,32][i%3];unit.siteId=['noran','darin','ravan'][i%3];deploy(unit,SUPPORT_PROFILES[unit.role]?{x:15,y:unit.role==='katyusha'?18:unit.role==='fieldArtillery'?20:22}:{x:17-(Math.floor(i/3)%3),y:front+Math.floor(i/9)-1});}
  else {const i=redIndex++,region=unit.siteId&&['hazan','darun','narin','qalara'].includes(unit.siteId)?unit.siteId:['valin','miraf','seraf'][i%3];unit.siteId=region;unit.rebelDuty=unit.kind==='infantry'&&i%3===0?'flank':'defend';const home=battle.sites.find(s=>s.id===region);deploy(unit,{x:home.x-(home.x<40?5:1),y:home.y+(Math.floor(i/3)%5)-2});}
 }
 battle.logistics.depots.forEach(d=>{d.x=d.side==='blue'?12:33;d.y=19});
 battle.droneBases.forEach(d=>{d.x=d.side==='blue'?12:34;d.y=16});
 battle.airDefenses=battle.airDefenses.filter(d=>d.side==='blue');battle.airDefenses.forEach(d=>{d.x=13;d.y=22});
 initializeMapObjectRegistry(battle);battle.units.forEach(u=>concealRebel(battle,u));
 battle.events=['خريطة موسعة: 60 × 40 خلية؛ قرابة ثلثي الأرض تحت سيطرة المتمردين.','السلاسل تحجب الرؤية والنيران المباشرة؛ القمم للمشاة والممرات للمدرعات والإمداد.','الغطاء والرصد والتضاريس تطبق على الطرفين. ثبّت القوات جولتين للسيطرة على المدينة.'];
}

export { isUnitDetected };

// Ground targeting and occupation of logistical assets.
export function facilityAttackCheck(battle,unitId,targetId) {
 syncFacilities(battle);
 if(getArmisticeState(battle).active)return {ok:false,reason:'الهجمات على المقرات متوقفة خلال الهدنة؛ أعد تنظيم القوات أو أنهِ الاتفاق.'};
 const unit=battle.units.find(u=>u.id===unitId),target=facilityTargets(battle).find(t=>t.id===targetId);
 if(battle.finished||battle.phase!=='player'||!unit||unit.side!=='blue'||unit.attacked||!directWeapon(unit))return {ok:false,reason:'اختر وحدة أرضية جاهزة للرمي.'};
 if(!kornetReady(battle,unit))return {ok:false,reason:'الكورنيت يحتاج الثبات: لا رمي بعد الحركة أو بعد استهلاك رمية الجولة؛ يحتاج صاروخاً واحداً.'};
 if(!target||target.side===unit.side||target.asset.disabled)return {ok:false,reason:'المقر تابع لقواتك أو مدمر.'};
 if(distance(unit,target)>unitAttackRange(unit)||!terrainSight(unit,target))return {ok:false,reason:'المقر خارج مدى السلاح أو خلف حاجز؛ تقدم أولاً.'};
 return {ok:true,unit,target};
}
export function issueFacilityAttack(battle,unitId,targetId) {
 const check=facilityAttackCheck(battle,unitId,targetId);if(!check.ok)return check;
 const {unit,target}=check,model=ARMOR_MODELS[unit.modelId];
 const amount=(model?(model.category==='tank'?46:28)*model.firepower:unit.role==='antiArmor'?38:unit.kind==='sniper'?5:12)*(.55+.45*unit.strength/unit.maxStrength);
 const result=damageFacility(battle,targetId,amount,unit.side);if(!result)return {ok:false};
 unit.ammo=Math.max(0,unit.ammo-(unit.weaponId==='kornet'?1:unitAmmoCost(unit)*supplyTerrainFactor(unit.x,unit.y)));unit.attacked=true;unit.moved=true;unit.hidden=false;unit.ambushReady=false;unit.revealedUntil=battle.turn+1;
 if(unit.weaponId==='kornet')unit.lastKornetFireTurn=battle.turn;
 recordExchange(battle,unit,{...target.asset,id:targetId,kind:'facility',strength:result.destroyed?0:1},result.damage);
 return {ok:true,...result};
}

export function advanceDroneFreight(battle){return advanceDroneIndustry(battle,{neighbors:hexNeighbors,path:(b,side,a,z)=>supplyPath(b,side,a,z)?.map(p=>({...p,cost:tileCost(p.x,p.y,{role:"supplyTruck"})}))});}
