import {contactVisible,supportCheck,supportFire} from '/rebel-support-rules.js';
import {artilleryFacilities} from '/rebel-facilities.js';
import {THEATER as MAP_THEATER,GRID as MAP_GRID,CITIES as MAP_CITIES,mountainCells,elevationAt,passAt,terrainAt,movementCost,terrainSight,coverMultiplier,ROAD_LINES as MAP_ROADS,RIVER_POINTS as MAP_RIVER,terrainDescription,CITY_LAYOUT,AIRPORT_CELLS,RANGES,PASSES} from '/rebel-terrain.js';
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
const sideName = side => side === 'blue' ? 'الأزرق' : 'الأحمر';

// Game-balance profiles: recognizable equipment families, deliberately abstracted for fair turn-based play.
export const ARMOR_MODELS = Object.freeze({
  abrams: { name:'M1A2 Abrams', nation:'الولايات المتحدة', tag:'US', category:'tank', movement:3, range:2, maxStrength:3, hpPerUnit:100, firepower:1.30, armor:1.34, accuracy:.10, antiInfantry:1.10, antiArmor:1.28, state:'قوة نيران ودقة وحماية مرتفعة؛ حركتها أبطأ ومدى اشتباكها أقصر.' },
  t90m: { name:'T-90M', nation:'روسيا', tag:'RU', category:'tank', movement:4, range:2, maxStrength:3, hpPerUnit:100, firepower:1.20, armor:1.20, accuracy:.03, antiInfantry:1.05, antiArmor:1.14, state:'توازن جيد بين الحماية والحركة؛ لا تتفوق بميزة واحدة على Abrams أو Type 99A.' },
  type99a: { name:'Type 99A', nation:'الصين', tag:'CN', category:'tank', movement:4, range:3, maxStrength:3, hpPerUnit:100, firepower:1.13, armor:1.08, accuracy:.06, antiInfantry:1.02, antiArmor:1.16, state:'مدى أطول وحركة جيدة؛ حماية أقل من Abrams وT-90M.' },
  bradley: { name:'M2 Bradley', nation:'الولايات المتحدة', tag:'US', category:'ifv', movement:4, range:2, maxStrength:4, hpPerUnit:75, firepower:1.00, armor:.98, accuracy:.03, antiInfantry:1.25, antiArmor:.78, state:'دعم قوي ضد المشاة ومساندة القناصة؛ أضعف في مواجهة الدبابات.' },
  bmp3: { name:'BMP-3', nation:'روسيا', tag:'RU', category:'ifv', movement:4, range:2, maxStrength:4, hpPerUnit:75, firepower:1.08, armor:.91, accuracy:.02, antiInfantry:1.12, antiArmor:1.08, state:'تسليح متنوع ضد المشاة والمدرعات؛ حمايتها أخف من الدبابات.' },
  zbd04: { name:'ZBD-04', nation:'الصين', tag:'CN', category:'ifv', movement:5, range:2, maxStrength:4, hpPerUnit:75, firepower:.96, armor:.88, accuracy:.02, antiInfantry:1.12, antiArmor:.80, state:'الأسرع في الحركة ومرافقة المشاة؛ حمايتها وقوتها ضد الدبابات أقل.' },
  m1128: { name:'M1128 Stryker MGS', nation:'الولايات المتحدة', tag:'AT', category:'vehicleAT', movement:4, range:4, maxStrength:2, hpPerUnit:78, firepower:1.15, armor:.91, accuracy:.08, antiInfantry:.58, antiArmor:1.55, state:'مدفع بعيد مضاد للمدرعات؛ ضرره أقل على المشاة وحمايته أخف من الدبابة.' },
  strykerAA: { name:'M-SHORAD', nation:'الولايات المتحدة', tag:'AA', category:'airDefense', movement:4, range:7, maxStrength:2, hpPerUnit:78, firepower:1, armor:.94, accuracy:.08, antiInfantry:.25, antiArmor:.18, state:'منظومة دفاع جوي متحركة؛ تعترض الأهداف الجوية فقط ضمن مداها.' }
});
const BLUE_ARMOR_STARTS = [[12,20,'abrams'],[14,21,'t90m'],[16,21,'type99a'],[10,23,'bradley'],[12,24,'bmp3'],[15,24,'zbd04'],[11,21,'m1128'],[17,4,'strykerAA']];
const RED_ARMOR_STARTS = [[25,2,'t90m'],[28,3,'type99a'],[31,2,'abrams'],[26,8,'bmp3'],[29,9,'zbd04'],[33,8,'bradley'],[34,11,'m1128'],[35,8,'strykerAA']];

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
function defaultAmmo(kind,modelId=null){const model=modelId&&ARMOR_MODELS[modelId];return model?.category==='tank'?20:model?.category==='ifv'?18:model?.category==='vehicleAT'?12:model?.category==='airDefense'?8:kind==='sniper'?16:kind==='antiArmor'?10:14}
function makeUnit(id, side, x, y, role = 'line', siteId = null, kind = 'infantry') {
  const hpPer=hpPerStrength(kind),ammo=defaultAmmo(kind);
  return { id, side, kind, x, y, strength: 6, maxStrength:6, hpPerStrength:hpPer, maxHp:6*hpPer, hp:6*hpPer, morale: 100, movement: kind === 'sniper' ? 3 : 4, moved: false, attacked: false, hidden: false, ambushReady: false, order: null, role, siteId, kills: 0, pinned: false, ammo, maxAmmo:ammo, fuel:0, maxFuel:0 };
}
function makeArtilleryUnit(id,side,x,y,role){const kat=role==='katyusha',mortar=role==='mortar',ammo=kat?4:mortar?10:7;return{id,side,kind:role,x,y,strength:1,maxStrength:1,hpPerStrength:120,maxHp:120,hp:120,morale:100,movement:kat?4:3,moved:false,attacked:false,hidden:false,ambushReady:false,order:null,role,siteId:null,kills:0,pinned:false,ammo,maxAmmo:ammo,fuel:0,maxFuel:0}}
function makeSupportUnit(id,side,x,y,role){const anti=role==='antiArmor',strength=anti?4:1,hpPerStrength=anti?22:90,ammo=anti?10:0;return{id,side,kind:anti?'antiArmor':'reconRadar',x,y,strength,maxStrength:strength,hpPerStrength,maxHp:strength*hpPerStrength,hp:strength*hpPerStrength,morale:100,movement:anti?4:3,moved:false,attacked:false,hidden:false,ambushReady:false,order:null,role,siteId:null,kills:0,pinned:false,ammo,maxAmmo:ammo,fuel:0,maxFuel:0}}
function makeArmoredUnit(id,side,x,y,modelId){
  const model=ARMOR_MODELS[modelId],unit={...makeUnit(id,side,x,y,'armored',null,model.category),modelId,strength:model.maxStrength,maxStrength:model.maxStrength,hpPerStrength:model.hpPerUnit,maxHp:model.maxStrength*model.hpPerUnit,hp:model.maxStrength*model.hpPerUnit,movement:model.movement};
  unit.ammo=unit.maxAmmo=defaultAmmo(model.category,modelId);unit.fuel=unit.maxFuel=Math.round(model.movement*4*1.25+4);return unit;
}

function log(battle, message) {
  battle.events.push(message);
  if (battle.events.length > 8) battle.events.shift();
}

export function createBattle(seed = 4106) {
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
  const artillery=[makeArtilleryUnit('blue-artillery-1','blue',18,8,'fieldArtillery'),makeArtilleryUnit('blue-katyusha-1','blue',19,9,'katyusha'),makeArtilleryUnit('red-artillery-1','red',23,5,'fieldArtillery'),makeArtilleryUnit('red-katyusha-1','red',24,11,'katyusha'),makeArtilleryUnit('blue-mortar-1','blue',20,8,'mortar'),makeArtilleryUnit('red-mortar-1','red',25,14,'mortar')];
  const specialists=[makeSupportUnit('blue-at-1','blue',15,18,'antiArmor'),makeSupportUnit('red-at-1','red',29,17,'antiArmor'),makeSupportUnit('blue-radar-1','blue',15,8,'reconRadar'),makeSupportUnit('red-radar-1','red',32,12,'reconRadar')];
  red[0].hidden=true;red[0].ambushReady=true;
  const airThreat={id:'red-air-1',side:'red',kind:'airRecon',domain:'air',x:23,y:4,strength:1,maxStrength:1,hpPerStrength:55,maxHp:55,hp:55,morale:100,movement:4,moved:false,attacked:false,hidden:false,ambushReady:false,order:null,role:'airRecon',siteId:null,kills:0,pinned:false,ammo:12,maxAmmo:12,fuel:0,maxFuel:0};
  return {
    turn: 1, phase: 'player', finished: false, winner: null, seed: seed >>> 0,
    objective: { ...OBJECTIVE }, owners, units: [...blue, ...blueArmor, ...red, ...redArmor, ...artillery, ...specialists, airThreat],
    logistics:{month:1,nextConvoyId:1,nextQueueId:1,depots:[{id:'blue-depot',side:'blue',x:11,y:18,ammo:180,fuel:120,maxAmmo:240,maxFuel:180,auto:true},{id:'red-depot',side:'red',x:31,y:14,ammo:180,fuel:120,maxAmmo:240,maxFuel:180,auto:true}],convoys:[],queue:[]},
    sites: SITE_CELLS.map(site => {const tiles=[...INFLUENCE].filter(([,id])=>id===site.id).map(([cell])=>cell.split(',').map(Number)).map(([x,y])=>({x,y}));const blue=tiles.filter(p=>owners[indexOf(p.x,p.y)]==='blue').length,red=tiles.length-blue;return{...site,tiles,owner:blue===red?owners[indexOf(site.x,site.y)]:blue>red?'blue':'red',contested:false}}),
    events: ['جولة 1: قواتك 12 فصيلاً مشاة و6 مدرعات ومدفع ميداني وراجمات كاتيوشا؛ للعدو 10 فصائل و6 مدرعات ومدفعية مقابلة.']
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
function ownUnits(battle, side) { return battle.units.filter(unit => unit.side === side && unit.strength > 0); }
export const isUnitDetected=(battle,unit,viewer='blue')=>{const recon=battle.uavRecon?.[viewer]?.[unit?.id]??(viewer==='blue'?battle.uavRecon?.[unit?.id]:null);return (unit?.strength>0&&recon?.until>=battle.turn&&recon.x===unit.x&&recon.y===unit.y)||(unit?.strength>0&&battle.airReconContacts?.[viewer]?.[unit.id]>performance.now())||contactVisible(battle,unit,viewer,hexDistance,terrainSight,elevationAt)};
function perceivedEnemyUnits(battle, side) { return enemyUnits(battle,side).filter(unit=>isUnitDetected(battle,unit,side)); }
function distance(a, b) { return hexDistance(a,b); }
export function isMountainAt(x,y) { return inBounds(x,y) && MOUNTAINS.has(cellKey(x,y)); }
export function unitAttackRange(unit,x=unit?.x,y=unit?.y) { const model=unit?.modelId&&ARMOR_MODELS[unit.modelId];return model?model.range:unit?.role==='fieldArtillery'?6:unit?.role==='katyusha'?6:unit?.role==='mortar'?4:unit?.role==='antiArmor'?3:unit?.role==='reconRadar'?9:unit?.role==='airRecon'?3:unit?.kind === 'sniper' ? 3 + (isMountainAt(x,y) ? 2 : 0) : 1; }
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
  if (!unit || unit.role==='supplyTruck' || unit.strength <= 0 || unit.moved || unit.attacked || battle.phase !== 'player' || unit.side !== 'blue') return [];
  const limit = budget ?? unit.movement;
  const distances = new Map([[cellKey(unit.x, unit.y), 0]]);
  const parents = new Map(),fuelCosts=new Map([[cellKey(unit.x,unit.y),0]]);
  const queue = [{ x: unit.x, y: unit.y, cost: 0 }];
  while (queue.length) {
    queue.sort((a,b)=>a.cost-b.cost);
    const current = queue.shift(), currentKey = cellKey(current.x, current.y), cost = distances.get(currentKey);
    if (current.cost !== cost) continue;
    if (currentKey !== cellKey(unit.x, unit.y) && inEnemyControl(battle, 'blue', current.x, current.y)) continue;
    for (const [dx, dy] of directions(current.y)) {
      const x = current.x + dx, y = current.y + dy, key = cellKey(x, y);
      if (!inBounds(x,y) || unitAt(battle,x,y,unit)) continue;
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

export const canFireArtillery=(battle,id,x,y,side='blue')=>supportCheck(battle,id,x,y,side,GRID,hexDistance);
export const fireArtillery=(battle,id,x,y,side='blue')=>supportFire(battle,canFireArtillery(battle,id,x,y,side),side,hexDistance,ARMOR_MODELS,coverMultiplier);
export function attackApproaches(battle,unitId,targetId){
 const unit=battle.units.find(item=>item.id===unitId),target=battle.units.find(item=>item.id===targetId&&item.side==='red'&&item.strength>0);
 if(!unit||!target||!isUnitDetected(battle,target,'blue')||battle.phase!=='player'||unit.side!=='blue'||unit.attacked||unit.ammo<=0||unit.role==='reconRadar')return[];
 const antiAir=unit.modelId==='strykerAA';if(antiAir!==(target.domain==='air'))return[];
 const indirect=['fieldArtillery','katyusha','mortar'].includes(unit.role),range=unitAttackRange(unit),d=hexDistance(unit,target),minimum=indirect?2:0;
 if(d<=range&&d>=minimum)return[{x:unit.x,y:unit.y,cost:0,path:[]}];if(unit.moved)return[];
 return reachableCells(battle,unitId).filter(cell=>{const distanceAfter=hexDistance(cell,target);return distanceAfter<=unitAttackRange(unit,cell.x,cell.y)&&distanceAfter>=minimum}).sort((a,b)=>a.cost-b.cost||a.path.length-b.path.length);
}
export function issueAttack(battle,unitId,targetId){
 const unit=battle.units.find(item=>item.id===unitId),target=battle.units.find(item=>item.id===targetId&&item.side==='red'&&item.strength>0);
 if(!unit||!target||!isUnitDetected(battle,target,'blue')||battle.phase!=='player'||unit.side!=='blue'||unit.attacked||unit.ammo<=0)return false;
 if(unit.role==='reconRadar'||(unit.modelId==='strykerAA')!==(target.domain==='air'))return false;
 if(['fieldArtillery','katyusha','mortar'].includes(unit.role))return fireArtillery(battle,unitId,target.x,target.y,'blue').ok;
 if(distance(unit,target)>unitAttackRange(unit))return false;return attack(battle,unit,target);
}
export function canAmbush(battle,unitId) {
  const unit=battle.units.find(item=>item.id===unitId);
  return !!unit&&unit.role!=='supplyTruck'&&unit.role!=='reconRadar'&&unit.strength>0&&unit.side==='blue'&&battle.phase==='player'&&!battle.finished&&!unit.moved&&!unit.attacked&&!unit.hidden&&!unit.modelId&&!!urbanSiteAt(unit.x,unit.y);
}

export function issueAmbush(battle,unitId) {
  if(!canAmbush(battle,unitId))return false;
  const unit=battle.units.find(item=>item.id===unitId);unit.hidden=true;unit.ambushReady=true;unit.moved=true;unit.order={ambush:true};
  log(battle,`الفصيل ${unit.id.replace('blue-','')} اختبأ داخل ${urbanSiteAt(unit.x,unit.y).name} وينتظر لحظة الهجوم.`);
  return true;
}

export function issueHold(battle, unitId) {
  const unit = battle.units.find(item => item.id === unitId);
  if (!unit || unit.role==='supplyTruck' || battle.phase !== 'player' || unit.side !== 'blue' || unit.moved || unit.attacked) return false;
  unit.order = { hold: true };
  unit.moved = true;
  log(battle, `الفصيل ${unit.id.replace('blue-','')} يثبت موقعه ويرفع دفاعه.`);
  return true;
}

export function beginMove(battle, unitId, x, y) {
  const unit = battle.units.find(item => item.id === unitId);
  if (!unit || unit.role==='supplyTruck' || battle.phase !== 'player' || unit.side !== 'blue' || unit.moved || unit.attacked) return null;
  const destination = reachableCells(battle, unitId).find(cell => cell.x === x && cell.y === y);
  if (!destination) return null;
  unit.moved = true;
  unit.order = { path: destination.path, target: { x, y }, cost: destination.cost };
  log(battle, `الفصيل ${unit.id.replace('blue-','')} يتحرك ${destination.cost} نقاط حركة.`);
  return { path: destination.path.map(p => ({...p})), cost: destination.cost };
}

export function stepUnit(battle, unitId, point) {
  const unit = battle.units.find(item => item.id === unitId && item.strength > 0);
  if (!unit || !inBounds(point.x, point.y) || hexDistance(unit, point) !== 1 || unitAt(battle, point.x, point.y, unit)) return false;
  if(unit.side==='blue'&&unit.hidden){unit.hidden=false;unit.ambushReady=false;}
  const fuelNeed=movementFuelCost(unit,point.x,point.y);if(unit.modelId&&fuelNeed>unit.fuel+1e-6)return false;if(unit.modelId)unit.fuel=Math.max(0,unit.fuel-fuelNeed);
  unit.x = point.x; unit.y = point.y;
  battle.owners[indexOf(unit.x,unit.y)] = unit.side;
  const site = battle.sites.find(item => item.tiles?.some(tile => tile.x === unit.x && tile.y === unit.y));
  if (site) site.contested = true;
  captureSites(battle);
  return true;
}

export function completeMovement(battle, unitId) {
  const unit = battle.units.find(item => item.id === unitId);
  if (unit) unit.order = null;
}

function siteThreatened(battle, site, side) {
  return perceivedEnemyUnits(battle, side).some(enemy => distance(enemy,site)<=site.radius+3);
}

function captureSites(battle) {
  for(const site of battle.sites){
    const tiles=site.tiles??[];let blue=0,red=0,blueInside=0,redInside=0;
    for(const p of tiles){const side=battle.owners[indexOf(p.x,p.y)];if(side==='blue')blue++;else red++;const unit=unitAt(battle,p.x,p.y);if(unit?.role!=='supplyTruck'&&unit?.side==='blue')blueInside++;else if(unit?.role!=='supplyTruck'&&unit?.side==='red')redInside++}
    const next=blue>red?'blue':red>blue?'red':site.owner;
    site.contested=blueInside>0&&redInside>0;
    if(next!==site.owner){site.owner=next;log(battle,`أصبحت ${site.name} تحت سيطرة ${sideName(next)} (${Math.max(blue,red)} من ${tiles.length} خلايا عمرانية).`)}
  }
}

export function urbanSiteAt(x,y){return URBAN_SITE_BY_CELL.get(cellKey(x,y))??null}
export function cityCombatModifiers(unit){const urban=!!urbanSiteAt(unit.x,unit.y);return{insideCity:urban,firePower:urban?1.25:1,holdPower:urban?1.25:1,cover:urban?.52:0}}
export function urbanControl(battle,siteId){const site=battle.sites.find(s=>s.id===siteId);if(!site)return null;let blue=0,red=0;for(const p of site.tiles){if(battle.owners[indexOf(p.x,p.y)]==='blue')blue++;else red++}return{blue,red,total:site.tiles.length,owner:site.owner,bluePercent:Math.round(blue/site.tiles.length*100)}}
export function cityVictoryProgress(battle){const cities=battle.sites.filter(site=>site.radius>=2);return{controlled:cities.filter(site=>site.owner==='blue').length,total:cities.length};}

export function supplyTerrainFactor(x,y){if(urbanSiteAt(x,y))return .55;if(isMountainAt(x,y))return 1.5;if(RIVER_CELLS.has(cellKey(x,y)))return 1.4;if(ROAD_CELLS.has(cellKey(x,y)))return .8;return 1.25}
function unitAmmoCost(unit){return unit.modelId?(ARMOR_MODELS[unit.modelId].category==='tank'?4:3):unit.kind==='sniper'?2.5:2}
function unitAmmoRatio(unit){return unit.maxAmmo?unit.ammo/unit.maxAmmo:1}
function stableCitySupply(battle,unit){const urban=urbanSiteAt(unit.x,unit.y),site=battle.sites.find(item=>item.id===urban?.id),depot=battle.logistics?.depots?.find(item=>item.side===unit.side);return site&&site.owner===unit.side&&!site.contested&&depot&&supplyPath(battle,unit.side,depot,site)?site:null}
function movementFuelCost(unit,x,y){return unit.modelId?tileCost(x,y,unit)*supplyTerrainFactor(x,y):0}
function supplyBlocked(battle,side,x,y){const idx=indexOf(x,y);return RIVER_CELLS.has(cellKey(x,y))&&!BRIDGES.has(cellKey(x,y))||battle.owners[idx]!==side||inEnemyControl(battle,side,x,y)}
function supplyPath(battle,side,start,target){
 const startKey=cellKey(start.x,start.y),queue=[{x:start.x,y:start.y,cost:0}],costs=new Map([[startKey,0]]),parents=new Map();let goal=null;
 while(queue.length){queue.sort((a,b)=>a.cost-b.cost);const cur=queue.shift(),key=cellKey(cur.x,cur.y);if(cur.cost!==costs.get(key))continue;if(hexDistance(cur,target)<=1){goal=key;break}
  for(const next of hexNeighbors(cur)){const nk=cellKey(next.x,next.y);if(nk!==startKey&&unitAt(battle,next.x,next.y))continue;if(nk!==startKey&&supplyBlocked(battle,side,next.x,next.y))continue;const step=ROAD_CELLS.has(nk)?.75:tileCost(next.x,next.y),nc=cur.cost+step;if(nc<(costs.get(nk)??Infinity)){costs.set(nk,nc);parents.set(nk,key);queue.push({...next,cost:nc})}}
 }
 if(!goal)return null;const path=[];let cursor=goal;while(cursor!==startKey){const [x,y]=cursor.split(',').map(Number);path.unshift({x,y});cursor=parents.get(cursor);if(!cursor)return null}return path;
}
const MAX_ACTIVE_CONVOYS_PER_SIDE=10,MAX_UNITS_PER_SUPPLY_CONVOY=3;
function supplyCargo(unit,ammoStock,fuelStock){return{ammo:Math.min(Math.max(0,unit.maxAmmo-unit.ammo),8,ammoStock),fuel:Math.min(Math.max(0,(unit.maxFuel??0)-(unit.fuel??0)),12,fuelStock)}}
function unitNeedsSupply(battle,unit,automatic=false){if(!unit||unit.role==='supplyTruck'||unit.strength<=0||stableCitySupply(battle,unit))return false;return automatic?(unitAmmoRatio(unit)<.55||(unit.maxFuel>0&&unit.fuel/unit.maxFuel<.5)):(unit.ammo<unit.maxAmmo-1e-6||(unit.maxFuel>0&&unit.fuel<unit.maxFuel-1e-6))}
function requestedSupplyUnitIds(battle){const ids=new Set();for(const order of battle.logistics?.queue??[])for(const id of order.unitIds??[order.unitId])ids.add(id);for(const convoy of battle.logistics?.convoys??[])for(const id of convoy.deliveryIds??[convoy.unitId])ids.add(id);return ids}
function supplyCluster(battle,anchor,automatic){const reserved=requestedSupplyUnitIds(battle);return ownUnits(battle,anchor.side).filter(unit=>unit.id===anchor.id||(!reserved.has(unit.id)&&unit.side===anchor.side&&hexDistance(unit,anchor)<=2&&unitNeedsSupply(battle,unit,automatic))).filter(unit=>unitNeedsSupply(battle,unit,automatic)).sort((a,b)=>(a.id===anchor.id?-1:b.id===anchor.id?1:hexDistance(a,anchor)-hexDistance(b,anchor))||Math.min(unitAmmoRatio(a),a.maxFuel?a.fuel/a.maxFuel:1)-Math.min(unitAmmoRatio(b),b.maxFuel?b.fuel/b.maxFuel:1)).slice(0,MAX_UNITS_PER_SUPPLY_CONVOY)}
function launchSupplyOrder(battle,order){const logistics=battle.logistics;if(logistics.convoys.filter(c=>c.side===order.side).length>=MAX_ACTIVE_CONVOYS_PER_SIDE)return false;const units=(order.unitIds??[order.unitId]).map(id=>battle.units.find(unit=>unit.id===id&&unit.side===order.side&&unit.strength>0)).filter(unit=>unit&&unitNeedsSupply(battle,unit,order.automatic));if(!units.length)return false;const depot=logistics.depots.filter(item=>item.side===order.side).sort((a,b)=>hexDistance(a,units[0])-hexDistance(b,units[0]))[0];if(!depot)return false;let ammoStock=depot.ammo,fuelStock=depot.fuel;const deliveries=[];for(const unit of units){const cargo=supplyCargo(unit,ammoStock,fuelStock);if(cargo.ammo<=0&&cargo.fuel<=0)continue;ammoStock-=cargo.ammo;fuelStock-=cargo.fuel;deliveries.push({unitId:unit.id,...cargo})}if(!deliveries.length)return false;const first=battle.units.find(unit=>unit.id===deliveries[0].unitId),launch=[{x:depot.x,y:depot.y},...hexNeighbors(depot)].find(point=>!unitAt(battle,point.x,point.y)&&!supplyBlocked(battle,order.side,point.x,point.y));if(!first||!launch)return false;const path=supplyPath(battle,order.side,launch,first);if(!path)return false;depot.ammo=ammoStock;depot.fuel=fuelStock;const id=`${order.side}-supply-${logistics.nextConvoyId++}`,cargo=deliveries.reduce((sum,item)=>({ammo:sum.ammo+item.ammo,fuel:sum.fuel+item.fuel}),{ammo:0,fuel:0}),truck={id,side:order.side,kind:'supplyTruck',role:'supplyTruck',x:launch.x,y:launch.y,strength:1,maxStrength:1,hpPerStrength:90,maxHp:90,hp:90,morale:100,movement:0,moved:true,attacked:true,hidden:false,ambushReady:false,order:null,siteId:null,kills:0,pinned:false,ammo:0,maxAmmo:0,fuel:0,maxFuel:0,supplyTargetId:first.id};battle.units.push(truck);logistics.convoys.push({id,truckId:id,side:order.side,unitId:first.id,deliveryIds:deliveries.map(item=>item.unitId),deliveries,x:launch.x,y:launch.y,path,pathTargetId:first.id,pathTargetX:first.x,pathTargetY:first.y,cargo,automatic:order.automatic});log(battle,`${order.automatic?'أُرسلت قافلة آلية':'أُرسلت قافلة إمداد'} إلى ${deliveries.length} قوات متقاربة؛ تحمل ${cargo.ammo} ذخيرة${cargo.fuel?` و${cargo.fuel} وقود`:''}.`);return true}
function dispatchSupply(battle,unit,automatic=false){if(!unitNeedsSupply(battle,unit,automatic))return false;const unitIds=supplyCluster(battle,unit,automatic).map(item=>item.id);if(!unitIds.length)return false;const order={side:unit.side,unitIds,automatic};const active=battle.logistics.convoys.filter(convoy=>convoy.side===unit.side).length;if(active<MAX_ACTIVE_CONVOYS_PER_SIDE&&launchSupplyOrder(battle,order))return true;const queueId=`${unit.side}-supply-queue-${battle.logistics.nextQueueId++}`;battle.logistics.queue.push({id:queueId,...order});log(battle,`طلب الإمداد ${unit.side==='blue'?'الصديق':'المعادي'} دخل طابور الشاحنات؛ ${active} قوافل متحركة حالياً.`);return true}
function launchQueuedSupply(battle){const logistics=battle.logistics;if(!logistics)return;for(const side of ['blue','red']){let blocked=0;while(logistics.convoys.filter(item=>item.side===side).length<MAX_ACTIVE_CONVOYS_PER_SIDE){const index=logistics.queue.findIndex(item=>item.side===side);if(index<0)break;const order=logistics.queue[index];order.unitIds=(order.unitIds??[order.unitId]).filter(id=>{const unit=battle.units.find(item=>item.id===id&&item.side===side&&item.strength>0);return unit&&unitNeedsSupply(battle,unit,order.automatic)});if(!order.unitIds.length){logistics.queue.splice(index,1);continue}if(launchSupplyOrder(battle,order)){logistics.queue.splice(index,1);blocked=0;continue}logistics.queue.push(logistics.queue.splice(index,1)[0]);blocked++;if(blocked>=logistics.queue.filter(item=>item.side===side).length)break}}}
export function requestSupplyConvoy(battle,unitId){if(battle.phase!=='player'||battle.finished)return false;const unit=battle.units.find(item=>item.id===unitId&&item.side==='blue'&&item.strength>0);if(!unit)return false;if(stableCitySupply(battle,unit)){log(battle,'هذه القوة داخل مدينة آمنة؛ تحصل على إمداد محلي ولا تحتاج قافلة.');return false}if(!dispatchSupply(battle,unit,false)){log(battle,'تعذر إرسال القافلة: تحقق من مخزون المقر ومن وجود طريق آمن للقوة.');return false}return true}
function performSupplyCycle(battle){const logistics=battle.logistics;if(!logistics)return;logistics.month++;for(const depot of logistics.depots){depot.ammo=Math.min(depot.maxAmmo,depot.ammo+80);depot.fuel=Math.min(depot.maxFuel,depot.fuel+60)}for(const unit of battle.units.filter(item=>item.strength>0&&item.role!=='supplyTruck'))if(stableCitySupply(battle,unit)){unit.ammo=unit.maxAmmo;unit.fuel=unit.maxFuel??0;log(battle,`${urbanSiteAt(unit.x,unit.y).name} زوّدت ${unit.side==='blue'?'قواتك':'قوات العدو'} تلقائياً ببداية الشهر.`)}for(const side of ['blue','red']){if(!logistics.depots.some(depot=>depot.side===side&&depot.auto))continue;const reserved=requestedSupplyUnitIds(battle),candidates=ownUnits(battle,side).filter(unit=>unit.role!=='supplyTruck'&&!reserved.has(unit.id)&&unitNeedsSupply(battle,unit,true)).sort((a,b)=>Math.min(unitAmmoRatio(a),a.maxFuel?a.fuel/a.maxFuel:1)-Math.min(unitAmmoRatio(b),b.maxFuel?b.fuel/b.maxFuel:1));for(const unit of candidates)dispatchSupply(battle,unit,true)}log(battle,`بدأ شهر الإمداد ${logistics.month}: المدن الآمنة جدّدت مخزونها، ووُضعت طلبات القوافل الميدانية حسب الأولوية.`)}
function supplyRouteBlocked(battle,convoy,truck){const next=convoy.path?.[0];return next&&(unitAt(battle,next.x,next.y,truck)||supplyBlocked(battle,convoy.side,next.x,next.y))}
function deliverSupplyNearTruck(battle,convoy,truck){for(const item of [...convoy.deliveries]){const unit=battle.units.find(candidate=>candidate.id===item.unitId&&candidate.strength>0);if(!unit){convoy.deliveries=convoy.deliveries.filter(entry=>entry!==item);continue}if(stableCitySupply(battle,unit)){const depot=battle.logistics.depots.find(entry=>entry.side===convoy.side);if(depot){depot.ammo=Math.min(depot.maxAmmo,depot.ammo+item.ammo);depot.fuel=Math.min(depot.maxFuel,depot.fuel+item.fuel)}convoy.deliveries=convoy.deliveries.filter(entry=>entry!==item);log(battle,`دخلت ${unit.id} مدينة آمنة قبل استلام الشحنة؛ عاد رصيدها إلى المقر.`);continue}if(hexDistance(truck,unit)>2)continue;unit.ammo=Math.min(unit.maxAmmo,unit.ammo+item.ammo);unit.fuel=Math.min(unit.maxFuel??0,(unit.fuel??0)+item.fuel);convoy.deliveries=convoy.deliveries.filter(entry=>entry!==item);log(battle,`وصلت شاحنة الإمداد إلى ${unit.id} وزودتها؛ بقيت ${convoy.deliveries.length} وحدات على مسار القافلة.`)}convoy.deliveryIds=convoy.deliveries.map(item=>item.unitId);convoy.unitId=convoy.deliveryIds[0]??null;truck.supplyTargetId=convoy.unitId}
export function advanceSupplyConvoys(battle){const movements=[];for(const convoy of [...(battle.logistics?.convoys??[])]){const truck=battle.units.find(item=>item.id===(convoy.truckId??convoy.id)&&item.strength>0);if(!truck){convoy.cancelled=true;continue}deliverSupplyNearTruck(battle,convoy,truck);if(!convoy.deliveries.length){truck.strength=0;truck.hp=0;convoy.cancelled=true;continue}const target=battle.units.find(item=>item.id===convoy.unitId&&item.strength>0);if(!target){convoy.cancelled=true;truck.strength=0;truck.hp=0;continue}const targetMoved=convoy.pathTargetId!==target.id||convoy.pathTargetX!==target.x||convoy.pathTargetY!==target.y;if((!convoy.path?.length&&hexDistance(truck,target)>2)||targetMoved||supplyRouteBlocked(battle,convoy,truck)){convoy.path=supplyPath(battle,convoy.side,truck,target);convoy.pathTargetId=target.id;convoy.pathTargetX=target.x;convoy.pathTargetY=target.y}if(!convoy.path){log(battle,`توقفت قافلة الإمداد ${convoy.side==='blue'?'الصديقة':'المعادية'}؛ الطريق غير آمن أو مقطوع.`);continue}let cost=0;const moved=[];for(const point of convoy.path){const step=ROAD_CELLS.has(cellKey(point.x,point.y))?.75:tileCost(point.x,point.y);if(moved.length&&cost+step>5)break;cost+=step;moved.push(point)}if(!moved.length){deliverSupplyNearTruck(battle,convoy,truck);if(!convoy.deliveries.length){truck.strength=0;truck.hp=0;convoy.cancelled=true}continue}const from={x:truck.x,y:truck.y};truck.x=convoy.x=moved.at(-1).x;truck.y=convoy.y=moved.at(-1).y;convoy.path=convoy.path.slice(moved.length);movements.push({convoyId:convoy.id,truckId:truck.id,side:convoy.side,from,path:moved});deliverSupplyNearTruck(battle,convoy,truck);if(!convoy.deliveries.length){truck.strength=0;truck.hp=0;convoy.cancelled=true}}battle.logistics.convoys=battle.logistics.convoys.filter(item=>!item.cancelled);launchQueuedSupply(battle);return movements}
function consumeRoundSupply(battle){for(const unit of ownUnits(battle,'blue').concat(ownUnits(battle,'red'))){const factor=supplyTerrainFactor(unit.x,unit.y);unit.ammo=Math.max(0,unit.ammo-.75*factor);if(unit.modelId)unit.fuel=Math.max(0,unit.fuel-.5*factor);if(stableCitySupply(battle,unit)){unit.ammo=Math.min(unit.maxAmmo,unit.ammo+2.5);if(unit.modelId)unit.fuel=Math.min(unit.maxFuel,unit.fuel+2.5)}}}
export function supplyState(battle,unitId){const unit=battle.units.find(item=>item.id===unitId);if(!unit)return null;const city=stableCitySupply(battle,unit);return{ammo:unit.ammo,maxAmmo:unit.maxAmmo,fuel:unit.fuel??0,maxFuel:unit.maxFuel??0,city:!!city,cityName:city?.name??null,terrainFactor:supplyTerrainFactor(unit.x,unit.y)}}

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

function attack(battle, attacker, defender) {
  if (!attacker || !defender || attacker.strength <= 0 || defender.strength <= 0) return false;
  if(attacker.role==='reconRadar'||(attacker.modelId==='strykerAA')!==(defender.domain==='air'))return false;
  if(attacker.ammo<=0){log(battle,`${attacker.side==='blue'?'قواتك':'العدو'} نفدت ذخيرته؛ تعذر تنفيذ الهجوم.`);return false;}
  const separation = distance(attacker, defender);
  if (separation > unitAttackRange(attacker) || !terrainSight(attacker,defender)) return false;
  const ambushStrike=attacker.side==='blue'&&attacker.hidden&&attacker.ambushReady;
  if(attacker.hidden){attacker.hidden=false;attacker.ambushReady=false;}
  const armorAttacker=attacker.modelId?ARMOR_MODELS[attacker.modelId]:null;
  const armorDefender=defender.modelId?ARMOR_MODELS[defender.modelId]:null;
  const ranged=separation>1&&(attacker.kind==='sniper'||!!armorAttacker||attacker.role==='antiArmor'||attacker.domain==='air');
  ensureUnitHealth(defender);
  const attackerProfile=cityCombatModifiers(attacker);
  const cover=adjacentCover(battle,defender);
  const strengthFactor=.55+.45*(attacker.strength/Math.max(1,attacker.maxStrength??attacker.strength));
  const coverFactor=Math.max(.62,1-cover*.45);
  let baseDamage,weaponFactor=1;
  if(attacker.domain==='air'){baseDamage=25;weaponFactor=armorDefender?.45:.9;}
  else if(attacker.role==='antiArmor'){baseDamage=armorDefender?40:7;weaponFactor=armorDefender?1.25/armorDefender.armor:.48;}
  else if(armorAttacker?.category==='vehicleAT'){baseDamage=armorDefender?39:9;weaponFactor=armorAttacker.firepower*(armorDefender?armorAttacker.antiArmor/armorDefender.armor:armorAttacker.antiInfantry);}
  else if(attacker.modelId==='strykerAA'&&defender.domain==='air'){baseDamage=48;weaponFactor=1.05;}
  else if(armorAttacker){
    if(armorAttacker.category==='tank'){
      baseDamage=armorDefender?36:26;
      weaponFactor=armorAttacker.firepower*(armorDefender?armorAttacker.antiArmor/armorDefender.armor:armorAttacker.antiInfantry);
    }else{
      baseDamage=armorDefender?16:20;
      weaponFactor=armorAttacker.firepower*(armorDefender?armorAttacker.antiArmor/armorDefender.armor:armorAttacker.antiInfantry);
    }
  }else if(armorDefender){
    baseDamage=attacker.kind==='sniper'?3:10;
    weaponFactor=(armorDefender.category==='tank'?.75:1.05)/armorDefender.armor;
  }else{
    baseDamage=attacker.kind==='sniper'?28:22;
  }
  const accuracyFactor=armorAttacker?.92+armorAttacker.accuracy*.8:1;
  const ammoRatio=attacker.maxAmmo?attacker.ammo/attacker.maxAmmo:1,ammoFactor=ammoRatio>=.35?1:.62+.38*(ammoRatio/.35);
  const terrainFactor=supplyTerrainFactor(attacker.x,attacker.y),ammoCost=unitAmmoCost(attacker)*terrainFactor;
  const damage=Math.max(1,Math.min(defender.hp,Math.round(baseDamage*weaponFactor*accuracyFactor*strengthFactor*coverFactor*(ambushStrike?1.25:1)*ammoFactor)));
  attacker.ammo=Math.max(0,attacker.ammo-ammoCost);
  attacker.attacked = true;
  attacker.moved = true;
  const previousHp=defender.hp,previousStrength=defender.strength;
  defender.hp=Math.max(0,defender.hp-damage);
  defender.strength=Math.max(0,Math.min(defender.maxStrength,Math.ceil((defender.hp-1e-8)/defender.hpPerStrength)));
  const lost=previousStrength-defender.strength;
  defender.morale=Math.max(0,defender.morale-Math.round(3+damage*.18+lost*8));
  attacker.kills += lost;
  const place=urbanSiteAt(defender.x,defender.y)?.name??`الخلية ${defender.x+1}:${defender.y+1}`;
  const applied=previousHp-defender.hp;
  const targetName=defender.role==='supplyTruck'?'شاحنة الإمداد':armorDefender?ARMOR_MODELS[defender.modelId].name:`فصيل ${sideName(defender.side)}`;
  const attackerName=armorAttacker?ARMOR_MODELS[attacker.modelId].name:attacker.role==='antiArmor'?'فريق مضاد الدروع':attacker.domain==='air'?'المسيّرة الاستطلاعية':attacker.kind==='sniper'?'القناص':'المشاة';
  const lossText=lost?` خرج ${lost} من القوة من المعركة؛ المتبقي ${defender.strength}/${defender.maxStrength}.`:' لم تُدمّر أي آلية أو جندي.';
  log(battle,`${ambushStrike?'ضربة كمين مباغتة؛ ':''}${attackerName} أصاب ${targetName} وسبب ${applied} ضرر؛ الصحة ${defender.hp}/${defender.maxHp}.${lossText}`);
  if (defender.strength <= 0) {
    if(!ranged&&defender.role!=='supplyTruck')battle.owners[indexOf(defender.x,defender.y)]=attacker.side;
    if(defender.role==='supplyTruck'){const convoy=battle.logistics?.convoys?.find(item=>(item.truckId??item.id)===defender.id);if(convoy){convoy.cancelled=true;battle.logistics.convoys=battle.logistics.convoys.filter(item=>!item.cancelled)}log(battle,'دُمّرت شاحنة الإمداد؛ فُقدت حمولتها ولن تصل إلى القوة المقصودة.')}else log(battle, `تم إخراج فصيل ${sideName(defender.side)} من المعركة.`);
  }
  return true;
}

function localPower(battle, side, center, radius = 2) {
  return ownUnits(battle,side).filter(unit => unit.role!=='supplyTruck'&&distance(unit,center) <= radius).reduce((sum,unit)=>sum+unit.strength,0);
}
function perceivedLocalPower(battle,side,center,radius=2){return ownUnits(battle,side).filter(unit=>unit.role!=='supplyTruck'&&!(side==='blue'&&unit.hidden)&&distance(unit,center)<=radius).reduce((sum,unit)=>sum+unit.strength,0);}

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
  const seen = new Map([[cellKey(unit.x,unit.y),0]]), parents = new Map(),fuelCosts=new Map([[cellKey(unit.x,unit.y),0]]), queue = [{x:unit.x,y:unit.y,cost:0}];
  while(queue.length){
    queue.sort((a,b)=>a.cost-b.cost);
    const current=queue.shift(), key=cellKey(current.x,current.y), cost=seen.get(key);
    if(current.cost!==cost)continue;
    if(key!==cellKey(unit.x,unit.y)&&!ignoreControl&&inEnemyControl(battle,'red',current.x,current.y)) continue;
    for(const [dx,dy]of directions(current.y)){const x=current.x+dx,y=current.y+dy,next=cellKey(x,y);if(!inBounds(x,y)||unitAt(battle,x,y,unit))continue;const nextCost=Math.round((cost+tileCost(x,y,unit))*10)/10,fuelCost=(fuelCosts.get(key)??0)+movementFuelCost(unit,x,y);if(nextCost>budget||(unit.modelId&&fuelCost>unit.fuel+1e-6)||(seen.has(next)&&seen.get(next)<=nextCost))continue;seen.set(next,nextCost);fuelCosts.set(next,fuelCost);parents.set(next,key);queue.push({x,y,cost:nextCost})}
  }
  return [...seen].filter(([key])=>key!==cellKey(unit.x,unit.y)).map(([key,cost])=>{const [x,y]=key.split(',').map(Number),path=[];let cur=key;while(cur!==cellKey(unit.x,unit.y)){const [px,py]=cur.split(',').map(Number);path.unshift({x:px,y:py});cur=parents.get(cur);if(!cur)break}return{x,y,cost,path}});
}

function planEnemy(battle) {
  const reds = ownUnits(battle,'red').filter(unit=>unit.role!=='supplyTruck'&&unit.modelId!=='strykerAA'), blues = ownUnits(battle,'blue').filter(unit=>!unit.hidden&&unit.role!=='supplyTruck'), blueTrucks=ownUnits(battle,'blue').filter(unit=>unit.role==='supplyTruck');
  const plans = new Map();
  const available = new Set(reds.map(unit=>unit.id));
  for(const drone of reds.filter(unit=>unit.domain==='air')){const target=blues.filter(unit=>unit.role!=='supplyTruck').sort((a,b)=>distance(drone,a)-distance(drone,b))[0];if(target){plans.set(drone.id,{kind:distance(drone,target)<=unitAttackRange(drone)?'airRaid':'airRaidAdvance',target});available.delete(drone.id)}}

  // Separate artillery doctrine: fixed guns fire from their current tile and never use infantry movement logic.
  for(const unit of reds.filter(item=>['fieldArtillery','katyusha','mortar'].includes(item.role))){let best=null;for(let y=0;y<GRID.rows;y++)for(let x=0;x<GRID.columns;x++){const center={x,y},range=unitAttackRange(unit),d=distance(unit,center);if(d<2||d>range)continue;const victims=blues.filter(enemy=>distance(enemy,center)<= (['katyusha','mortar'].includes(unit.role)?1:0));const score=victims.reduce((sum,enemy)=>sum+(['katyusha','mortar'].includes(unit.role)&&distance(enemy,center)>0?.65:1)+(enemy.modelId?.8:0),0);if(score&&(!best||score>best.score))best={x,y,score}}if(best&&unit.ammo>0){plans.set(unit.id,{kind:'artilleryFire',targetCell:{x:best.x,y:best.y}});available.delete(unit.id)}}

  // Enemy formations may intercept exposed supply trucks, but never treat them as troops or city threats.
  for(const unit of reds.filter(item=>available.has(item.id)&&item.domain!=='air'&&!['fieldArtillery','katyusha','mortar'].includes(item.role))){const truck=blueTrucks.filter(item=>distance(unit,item)<=unitAttackRange(unit)+unit.movement).sort((a,b)=>distance(unit,a)-distance(unit,b))[0];if(truck){plans.set(unit.id,{kind:'interceptSupply',target:truck});available.delete(unit.id)}}

  // Pull reserves toward important cities when blue forces approach an uncovered site.
  const threats = battle.sites.filter(site=>site.owner==='red'&&siteThreatened(battle,site,'red'))
    .map(site=>({site,blueDistance:Math.min(...blues.map(unit=>distance(site,unit)),99),garrison:reds.filter(unit=>urbanSiteAt(unit.x,unit.y)?.id===site.id).length}))
    .sort((a,b)=>b.site.priority/(b.blueDistance+1)-a.site.priority/(a.blueDistance+1));
  for(const threat of threats){
    const need=threat.blueDistance<=2?3:threat.blueDistance<=4?2:1;
    let assigned=threat.garrison;
    while(assigned<need){
      const defender=reds.filter(unit=>available.has(unit.id)&&!['fieldArtillery','katyusha','mortar'].includes(unit.role)&&urbanSiteAt(unit.x,unit.y)?.id!==threat.site.id).sort((a,b)=>distance(a,threat.site)-distance(b,threat.site))[0];
      if(!defender)break;
      plans.set(defender.id,{kind:'defend',site:threat.site});available.delete(defender.id);assigned++;
    }
  }

  // A threatened formation breaks contact before it is boxed into one or no escape cells.
  for(const unit of reds.filter(unit=>available.has(unit.id)&&!['fieldArtillery','katyusha','mortar'].includes(unit.role))){
    const hostileAdjacent=blues.filter(enemy=>distance(unit,enemy)<=1).length;
    const safeExits=hexNeighbors(unit).filter(p=>inBounds(p.x,p.y)&&!unitAt(battle,p.x,p.y,unit)&&!inEnemyControl(battle,'red',p.x,p.y)).length;
    if((hostileAdjacent>=2&&safeExits<=2)||hostileAdjacent>=3){const destination=safeRetreat(battle,unit);if(destination){plans.set(unit.id,{kind:'retreat',path:destination.path});available.delete(unit.id)}}
  }

  // Snipers fire at range, or advance only when no higher-priority retreat is needed.
  for(const unit of reds.filter(unit=>unit.kind==='sniper'&&!['fieldArtillery','katyusha','mortar'].includes(unit.role))){
    if(plans.get(unit.id)?.kind==='retreat')continue;
    const range=unitAttackRange(unit), target=blues.filter(enemy=>distance(unit,enemy)<=range+unit.movement+2)
      .sort((a,b)=>distance(unit,a)-distance(unit,b)||a.strength-b.strength)[0];
    if(!target)continue;
    if(distance(unit,target)<=range){plans.set(unit.id,{kind:'sniperFire',target});available.delete(unit.id)}
    else if(available.has(unit.id)){plans.set(unit.id,{kind:'sniperAdvance',target});available.delete(unit.id)}
  }

  // Concentrate locally superior forces for a counterattack; do not attack at a bad exchange.
  for(const unit of reds.filter(unit=>available.has(unit.id)&&unit.kind!=='sniper'&&!['fieldArtillery','katyusha','mortar'].includes(unit.role))){
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

export function beginEnemyTurn(battle) {
  if (battle.phase !== 'player' || battle.finished) return [];
  battle.phase = 'enemy';
  const plans = planEnemy(battle);
  return ownUnits(battle, 'red').filter(unit=>unit.role!=='supplyTruck').map(unit => {
    const plan = plans.get(unit.id);
    if (!plan) return { unitId: unit.id, path: [], attackTargetId: null, kind: 'hold' };
    let path = [];
    if (plan.kind === 'defend' && urbanSiteAt(unit.x,unit.y)?.id !== plan.site.id) path = pathToward(battle,unit,plan.site,true)?.path ?? [];
    else if (plan.kind === 'retreat') path = plan.path ?? [];
    else if ((plan.kind === 'counterattack'||plan.kind==='interceptSupply') && distance(unit,plan.target)>unitAttackRange(unit)) path = pathIntoRange(battle,unit,plan.target,unitAttackRange(unit))?.path ?? [];
    else if (plan.kind === 'sniperAdvance'||plan.kind==='airRaidAdvance') path = pathIntoRange(battle,unit,plan.target,unitAttackRange(unit))?.path ?? [];
    const targetId=['counterattack','sniperFire','sniperAdvance','airRaid','airRaidAdvance','interceptSupply'].includes(plan.kind)?plan.target?.id??null:null;
    return { unitId: unit.id, path, attackTargetId: targetId, kind: plan.kind, artilleryTarget:plan.targetCell??null, siteName: plan.site?.name??null };
  });
}

export function resolveEnemyAction(battle, action) {
  const unit = battle.units.find(item => item.id === action.unitId && item.strength > 0);
  if (!unit) return;
  if(action.kind==='artilleryFire'){const p=action.artilleryTarget;if(p)fireArtillery(battle,unit.id,p.x,p.y,'red');return}
  if (action.kind === 'defend' && action.path.length) log(battle, `العدو يعزز محيط ${action.siteName} بفصيل إضافي.`);
  else if (action.kind === 'retreat' && action.path.length) log(battle, `فصيل العدو ${unit.id.slice(-1)} يعيد التموضع لتجنب الحصار.`);
  else if(action.kind==='airRaid'||action.kind==='airRaidAdvance')log(battle,'المسيّرة المعادية تهاجم من الجو؛ تحرك وحدات الدفاع الجوي إلى مداها لاعتراضها.');
  else if(action.kind==='interceptSupply')log(battle,'العدو يحاول اعتراض شاحنة الإمداد المكشوفة.');
  else if (action.kind === 'counterattack') log(battle, `العدو يجهز هجوماً معاكساً على الفصيل ${action.attackTargetId?.replace('blue-','')}.`);
  else if(action.kind==='sniperFire'||action.kind==='sniperAdvance')log(battle,`قناص العدو يطلق النار باتجاه الفصيل ${action.attackTargetId?.replace('blue-','')}.`);
  const target = battle.units.find(item => item.id === action.attackTargetId && item.side === 'blue' && item.strength > 0);
  if (target && distance(unit,target)<=unitAttackRange(unit)) attack(battle,unit,target);
}

export function finalizeTurn(battle) {
  consumeRoundSupply(battle);
  for (const unit of battle.units) { unit.order=null;unit.moved=false;unit.attacked=false;unit.pinned=false;if(unit.strength>0)unit.morale=Math.min(100,unit.morale+2); }
  captureSites(battle);
  if(battle.turn%4===0)performSupplyCycle(battle);
  const aliveBlue=ownUnits(battle,'blue').filter(unit=>unit.role!=='supplyTruck').length, aliveRed=ownUnits(battle,'red').filter(unit=>unit.role!=='supplyTruck').length;
  const progress=cityVictoryProgress(battle);
  if(aliveBlue===0){battle.finished=true;battle.winner='red';log(battle,'انتهت المعركة؛ خسر الفصيل الأزرق جميع وحداته.');}
  else if(progress.total>0&&progress.controlled===progress.total){battle.finished=true;battle.winner='blue';log(battle,'انتهت المعركة؛ أصبحت جميع المدن تحت سيطرة قواتك.');}
  battle.turn++;
  if(!battle.finished){battle.phase='player';log(battle,`بدأت الجولة ${battle.turn}. قواتك ${aliveBlue} فصائل، والعدو ${aliveRed} فصائل.`);}
  return true;
}

export function remainingPlayerActivations(battle) {
  return ownUnits(battle,'blue').filter(unit => unit.role!=='supplyTruck'&&!unit.moved && !unit.attacked).length;
}

export function endPlayerTurn(battle) {
  if(battle.phase!=='player'||battle.finished)return false;
  const actions=beginEnemyTurn(battle);
  for(const action of actions){for(const point of action.path)stepUnit(battle,action.unitId,point);resolveEnemyAction(battle,action);}
  advanceSupplyConvoys(battle);return finalizeTurn(battle);
}

export function countUnits(battle, side) { return ownUnits(battle, side).filter(unit=>unit.role!=='supplyTruck').length; }
export function countSoldiers(battle, side) { return ownUnits(battle, side).filter(unit=>unit.role!=='supplyTruck'&&!unit.modelId&&!['fieldArtillery','katyusha','mortar','reconRadar'].includes(unit.role)&&unit.domain!=='air').reduce((sum,unit)=>sum+unit.strength,0); }
export function countArmoredUnits(battle,side){return ownUnits(battle,side).filter(unit=>!!unit.modelId).length;}

export function combatPower(battle, side, center, radius = 2) { return localPower(battle,side,center,radius); }
