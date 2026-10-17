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
  zbd04: { name:'ZBD-04', nation:'الصين', tag:'CN', category:'ifv', movement:5, range:2, maxStrength:4, hpPerUnit:75, firepower:.96, armor:.88, accuracy:.02, antiInfantry:1.12, antiArmor:.80, state:'الأسرع في الحركة ومرافقة المشاة؛ حمايتها وقوتها ضد الدبابات أقل.' }
});
const BLUE_ARMOR_STARTS = [[12,20,'abrams'],[14,21,'t90m'],[16,21,'type99a'],[10,23,'bradley'],[12,24,'bmp3'],[15,24,'zbd04']];
const RED_ARMOR_STARTS = [[25,2,'t90m'],[28,3,'type99a'],[31,2,'abrams'],[26,8,'bmp3'],[29,9,'zbd04'],[33,8,'bradley']];
const BLUE_ENGINEER_START=[15,16],RED_ENGINEER_START=[24,16];

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
  return { id, side, kind, x, y, strength: 6, maxStrength:6, hpPerStrength:hpPer, maxHp:6*hpPer, hp:6*hpPer, morale: 100, movement: kind === 'sniper' ? 3 : 4, moved: false, attacked: false, hidden: false, ambushReady: false, order: null, role, siteId, kills: 0, pinned: false, ammo, maxAmmo:ammo, fuel:0, maxFuel:0, engineerCharges:kind==='engineer'?2:0,maxEngineerCharges:kind==='engineer'?4:0 };
}
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
  const blueEngineer=makeUnit('blue-eng-1','blue',BLUE_ENGINEER_START[0],BLUE_ENGINEER_START[1],'line',null,'engineer');
  const redEngineer=makeUnit('red-eng-1','red',RED_ENGINEER_START[0],RED_ENGINEER_START[1],'line',null,'engineer');
  return {
    turn: 1, phase: 'player', finished: false, winner: null, seed: seed >>> 0,
    objective: { ...OBJECTIVE }, owners, units: [...blue, ...blueArmor, blueEngineer, ...red, ...redArmor, redEngineer],
    engineering:{nextMineId:1,minefields:[],fortifications:[]},
    logistics:{month:1,nextConvoyId:1,nextQueueId:1,depots:[{id:'blue-depot',side:'blue',x:11,y:18,ammo:180,fuel:120,maxAmmo:240,maxFuel:180,engineeringStores:3,maxEngineeringStores:5,auto:true},{id:'red-depot',side:'red',x:31,y:14,ammo:180,fuel:120,maxAmmo:240,maxFuel:180,engineeringStores:3,maxEngineeringStores:5,auto:true}],convoys:[],queue:[]},
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
function perceivedEnemyUnits(battle, side) { return enemyUnits(battle,side).filter(unit => !(side === 'red' && unit.side === 'blue' && unit.hidden)); }
function ownUnits(battle, side) { return battle.units.filter(unit => unit.side === side && unit.strength > 0); }
function distance(a, b) { return hexDistance(a,b); }
export function isMountainAt(x,y) { return inBounds(x,y) && MOUNTAINS.has(cellKey(x,y)); }
export function unitAttackRange(unit,x=unit?.x,y=unit?.y) { const model=unit?.modelId&&ARMOR_MODELS[unit.modelId];return model?model.range:unit?.kind === 'sniper' ? 3 + (isMountainAt(x,y) ? 2 : 0) : 1; }
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

export function attackApproaches(battle, unitId, targetId) {
  const unit = battle.units.find(item => item.id === unitId);
  const target = battle.units.find(item => item.id === targetId && item.side === 'red' && item.strength > 0);
  if (!unit || !target || battle.phase !== 'player' || unit.side !== 'blue' || unit.attacked || unit.ammo<=0) return [];
  const range = unitAttackRange(unit);
  if (distance(unit, target) <= range && terrainSight(unit,target)) return [{ x: unit.x, y: unit.y, cost: 0, path: [] }];
  if (unit.moved) return [];
  return reachableCells(battle, unitId).filter(cell => distance(cell, target) <= unitAttackRange(unit,cell.x,cell.y)&&terrainSight(cell,target))
    .sort((a, b) => a.cost - b.cost || a.path.length - b.path.length);
}

export function issueAttack(battle, unitId, targetId) {
  const unit = battle.units.find(item => item.id === unitId);
  const target = battle.units.find(item => item.id === targetId && item.side === 'red' && item.strength > 0);
  if (!unit || !target || battle.phase !== 'player' || unit.side !== 'blue' || unit.attacked || unit.ammo<=0) return false;
  if (distance(unit, target) > unitAttackRange(unit)) return false;
  return attack(battle, unit, target);
}

export function canAmbush(battle,unitId) {
  const unit=battle.units.find(item=>item.id===unitId);
  return !!unit&&unit.role!=='supplyTruck'&&unit.strength>0&&unit.side==='blue'&&battle.phase==='player'&&!battle.finished&&!unit.moved&&!unit.attacked&&!unit.hidden&&!unit.modelId&&!!urbanSiteAt(unit.x,unit.y);
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
  if (!unit || unit.stoppedByMine || !inBounds(point.x, point.y) || hexDistance(unit, point) !== 1 || unitAt(battle, point.x, point.y, unit)) return false;
  if(unit.side==='blue'&&unit.hidden){unit.hidden=false;unit.ambushReady=false;}
  const fuelNeed=movementFuelCost(unit,point.x,point.y);if(unit.modelId&&fuelNeed>unit.fuel+1e-6)return false;if(unit.modelId)unit.fuel=Math.max(0,unit.fuel-fuelNeed);
  unit.x = point.x; unit.y = point.y;
  battle.owners[indexOf(unit.x,unit.y)] = unit.side;
  const fort=ensureEngineering(battle).fortifications.find(f=>f.x===unit.x&&f.y===unit.y&&f.side!==unit.side);if(fort){battle.engineering.fortifications=battle.engineering.fortifications.filter(f=>f!==fort);log(battle,'أزال الخصم التحصين بعد سيطرته على الموقع.')}
  detonateMine(battle,unit);
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

function ensureEngineering(battle){battle.engineering??={nextMineId:1,minefields:[],fortifications:[]};battle.engineering.minefields??=[];battle.engineering.fortifications??=[];return battle.engineering}
function engineerReady(battle,unit,side=unit?.side){return !!unit&&unit.kind==='engineer'&&unit.side===side&&unit.strength>0&&!unit.fieldActionUsed&&!unit.attacked&&!battle.finished&&(side==='blue'?battle.phase==='player':battle.phase==='enemy')}
function consumeEngineerTurn(unit){unit.fieldActionUsed=true;unit.moved=true;unit.attacked=true;unit.order={fieldEngineering:true}}
function placeMine(battle,unit,x,y){const e=ensureEngineering(battle);if(!engineerReady(battle,unit)||unit.engineerCharges<=0||!inBounds(x,y)||hexDistance(unit,{x,y})!==1||battle.owners[indexOf(x,y)]!==unit.side||unitAt(battle,x,y)||e.minefields.some(m=>m.x===x&&m.y===y))return false;unit.engineerCharges--;consumeEngineerTurn(unit);e.minefields.push({id:'mine-'+e.nextMineId++,side:unit.side,x,y,discoveredBy:[unit.side]});log(battle,'زرع مهندس الميدان لغماً في خلية صديقة قريبة.');return true}
function reinforceSite(battle,unit){const e=ensureEngineering(battle);if(!engineerReady(battle,unit)||unit.engineerCharges<=0||battle.owners[indexOf(unit.x,unit.y)]!==unit.side||e.fortifications.some(f=>f.x===unit.x&&f.y===unit.y))return false;unit.engineerCharges--;consumeEngineerTurn(unit);e.fortifications.push({id:'fort-'+unit.id+'-'+battle.turn,side:unit.side,x:unit.x,y:unit.y});log(battle,'حصّن مهندس الميدان موقعه؛ المدافع هنا يتلقى ضرراً أقل.');return true}
function removeMine(battle,unit,x,y){const e=ensureEngineering(battle),mine=e.minefields.find(m=>m.x===x&&m.y===y&&m.side!==unit?.side);if(!engineerReady(battle,unit)||!mine||!mine.discoveredBy?.includes(unit.side)||hexDistance(unit,{x,y})>1)return false;consumeEngineerTurn(unit);e.minefields=e.minefields.filter(m=>m!==mine);log(battle,'أزال مهندس الميدان لغماً معادياً مكشوفاً.');return true}
function detonateMine(battle,unit){const e=ensureEngineering(battle),mine=e.minefields.find(m=>m.x===unit.x&&m.y===unit.y&&m.side!==unit.side);if(!mine)return false;ensureUnitHealth(unit);const was=unit.strength,damage=unit.modelId?(ARMOR_MODELS[unit.modelId].category==='tank'?58:42):28;unit.hp=Math.max(0,unit.hp-damage);unit.strength=Math.max(0,Math.min(unit.maxStrength,Math.ceil((unit.hp-1e-8)/unit.hpPerStrength)));unit.morale=Math.max(0,unit.morale-18);unit.stoppedByMine=true;unit.moved=true;unit.attacked=true;e.minefields=e.minefields.filter(m=>m!==mine);log(battle,'انفجر لغم معادٍ؛ تضررت القوة وتوقف تقدمها لهذه الجولة.');if(unit.strength<was)log(battle,'خسرت القوة فرداً أو آلية بسبب اللغم.');return true}
export function plantFieldMine(battle,unitId,x,y){return placeMine(battle,battle.units.find(u=>u.id===unitId),x,y)}
export function buildFieldFortification(battle,unitId){return reinforceSite(battle,battle.units.find(u=>u.id===unitId))}
export function clearFieldMine(battle,unitId,x,y){return removeMine(battle,battle.units.find(u=>u.id===unitId),x,y)}
export function scanEngineerMines(battle,side='blue'){const e=ensureEngineering(battle);for(const m of e.minefields)if(m.side!==side&&ownUnits(battle,side).some(u=>u.kind==='engineer'&&hexDistance(u,m)<=1)){m.discoveredBy??=[m.side];if(!m.discoveredBy.includes(side))m.discoveredBy.push(side)}return e.minefields.filter(m=>m.side===side||m.discoveredBy?.includes(side))}
export function engineeringState(battle,unitId){const u=battle.units.find(x=>x.id===unitId),e=ensureEngineering(battle);if(!u||u.kind!=='engineer')return null;const ready=engineerReady(battle,u,'blue'),near=hexNeighbors(u),mineTargets=ready&&u.engineerCharges>0?near.filter(p=>battle.owners[indexOf(p.x,p.y)]==='blue'&&!unitAt(battle,p.x,p.y)&&!e.minefields.some(m=>m.x===p.x&&m.y===p.y)):[],clearTargets=ready?scanEngineerMines(battle,'blue').filter(m=>m.side==='red'&&hexDistance(u,m)<=1).map(m=>({x:m.x,y:m.y})):[];return{charges:u.engineerCharges??0,maxCharges:u.maxEngineerCharges??4,canFortify:ready&&battle.owners[indexOf(u.x,u.y)]==='blue'&&!e.fortifications.some(f=>f.x===u.x&&f.y===u.y),mineTargets,clearTargets,fortifications:e.fortifications,minefields:scanEngineerMines(battle,'blue')}}

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
function supplyCargo(unit,ammoStock,fuelStock,engineeringStock=0){return{ammo:Math.min(Math.max(0,unit.maxAmmo-unit.ammo),8,ammoStock),fuel:Math.min(Math.max(0,(unit.maxFuel??0)-(unit.fuel??0)),12,fuelStock),engineering:unit.kind==='engineer'&&(unit.engineerCharges??0)<(unit.maxEngineerCharges??4)&&engineeringStock>0?1:0}}
function unitNeedsSupply(battle,unit,automatic=false){if(!unit||unit.role==='supplyTruck'||unit.strength<=0)return false;const gear=unit.kind==='engineer'&&(unit.engineerCharges??0)<(unit.maxEngineerCharges??4)&&battle.logistics?.depots?.some(d=>d.side===unit.side&&(d.engineeringStores??0)>0),city=stableCitySupply(battle,unit);if(city)return !!gear;return automatic?(unitAmmoRatio(unit)<.55||(unit.maxFuel>0&&unit.fuel/unit.maxFuel<.5)||!!gear):(unit.ammo<unit.maxAmmo-1e-6||(unit.maxFuel>0&&unit.fuel<unit.maxFuel-1e-6)||!!gear)}
function requestedSupplyUnitIds(battle){const ids=new Set();for(const order of battle.logistics?.queue??[])for(const id of order.unitIds??[order.unitId])ids.add(id);for(const convoy of battle.logistics?.convoys??[])for(const id of convoy.deliveryIds??[convoy.unitId])ids.add(id);return ids}
function supplyCluster(battle,anchor,automatic){const reserved=requestedSupplyUnitIds(battle);return ownUnits(battle,anchor.side).filter(unit=>unit.id===anchor.id||(!reserved.has(unit.id)&&unit.side===anchor.side&&hexDistance(unit,anchor)<=2&&unitNeedsSupply(battle,unit,automatic))).filter(unit=>unitNeedsSupply(battle,unit,automatic)).sort((a,b)=>(a.id===anchor.id?-1:b.id===anchor.id?1:hexDistance(a,anchor)-hexDistance(b,anchor))||Math.min(unitAmmoRatio(a),a.maxFuel?a.fuel/a.maxFuel:1)-Math.min(unitAmmoRatio(b),b.maxFuel?b.fuel/b.maxFuel:1)).slice(0,MAX_UNITS_PER_SUPPLY_CONVOY)}
function launchSupplyOrder(battle,order){const logistics=battle.logistics;if(logistics.convoys.filter(c=>c.side===order.side).length>=MAX_ACTIVE_CONVOYS_PER_SIDE)return false;const units=(order.unitIds??[order.unitId]).map(id=>battle.units.find(unit=>unit.id===id&&unit.side===order.side&&unit.strength>0)).filter(unit=>unit&&unitNeedsSupply(battle,unit,order.automatic));if(!units.length)return false;const depot=logistics.depots.filter(item=>item.side===order.side).sort((a,b)=>hexDistance(a,units[0])-hexDistance(b,units[0]))[0];if(!depot)return false;let ammoStock=depot.ammo,fuelStock=depot.fuel,engineeringStock=depot.engineeringStores??0;const deliveries=[];for(const unit of units){const cargo=supplyCargo(unit,ammoStock,fuelStock,engineeringStock);if(cargo.ammo<=0&&cargo.fuel<=0&&cargo.engineering<=0)continue;ammoStock-=cargo.ammo;fuelStock-=cargo.fuel;engineeringStock-=cargo.engineering;deliveries.push({unitId:unit.id,...cargo})}if(!deliveries.length)return false;const first=battle.units.find(unit=>unit.id===deliveries[0].unitId),launch=[{x:depot.x,y:depot.y},...hexNeighbors(depot)].find(point=>!unitAt(battle,point.x,point.y)&&!supplyBlocked(battle,order.side,point.x,point.y));if(!first||!launch)return false;const path=supplyPath(battle,order.side,launch,first);if(!path)return false;depot.ammo=ammoStock;depot.fuel=fuelStock;depot.engineeringStores=engineeringStock;const id=`${order.side}-supply-${logistics.nextConvoyId++}`,cargo=deliveries.reduce((sum,item)=>({ammo:sum.ammo+item.ammo,fuel:sum.fuel+item.fuel,engineering:sum.engineering+item.engineering}),{ammo:0,fuel:0,engineering:0}),truck={id,side:order.side,kind:'supplyTruck',role:'supplyTruck',x:launch.x,y:launch.y,strength:1,maxStrength:1,hpPerStrength:90,maxHp:90,hp:90,morale:100,movement:0,moved:true,attacked:true,hidden:false,ambushReady:false,order:null,siteId:null,kills:0,pinned:false,ammo:0,maxAmmo:0,fuel:0,maxFuel:0,supplyTargetId:first.id};battle.units.push(truck);logistics.convoys.push({id,truckId:id,side:order.side,unitId:first.id,deliveryIds:deliveries.map(item=>item.unitId),deliveries,x:launch.x,y:launch.y,path,pathTargetId:first.id,pathTargetX:first.x,pathTargetY:first.y,cargo,automatic:order.automatic});log(battle,`${order.automatic?'أُرسلت قافلة آلية':'أُرسلت قافلة إمداد'} إلى ${deliveries.length} قوات متقاربة؛ تحمل ${cargo.ammo} ذخيرة${cargo.fuel?` و${cargo.fuel} وقود`:''}${cargo.engineering?` وشحنة هندسية ${cargo.engineering}`:''}.`);return true}
function dispatchSupply(battle,unit,automatic=false){if(!unitNeedsSupply(battle,unit,automatic))return false;const unitIds=supplyCluster(battle,unit,automatic).map(item=>item.id);if(!unitIds.length)return false;const order={side:unit.side,unitIds,automatic};const active=battle.logistics.convoys.filter(convoy=>convoy.side===unit.side).length;if(active<MAX_ACTIVE_CONVOYS_PER_SIDE&&launchSupplyOrder(battle,order))return true;const queueId=`${unit.side}-supply-queue-${battle.logistics.nextQueueId++}`;battle.logistics.queue.push({id:queueId,...order});log(battle,`طلب الإمداد ${unit.side==='blue'?'الصديق':'المعادي'} دخل طابور الشاحنات؛ ${active} قوافل متحركة حالياً.`);return true}
function launchQueuedSupply(battle){const logistics=battle.logistics;if(!logistics)return;for(const side of ['blue','red']){let blocked=0;while(logistics.convoys.filter(item=>item.side===side).length<MAX_ACTIVE_CONVOYS_PER_SIDE){const index=logistics.queue.findIndex(item=>item.side===side);if(index<0)break;const order=logistics.queue[index];order.unitIds=(order.unitIds??[order.unitId]).filter(id=>{const unit=battle.units.find(item=>item.id===id&&item.side===side&&item.strength>0);return unit&&unitNeedsSupply(battle,unit,order.automatic)});if(!order.unitIds.length){logistics.queue.splice(index,1);continue}if(launchSupplyOrder(battle,order)){logistics.queue.splice(index,1);blocked=0;continue}logistics.queue.push(logistics.queue.splice(index,1)[0]);blocked++;if(blocked>=logistics.queue.filter(item=>item.side===side).length)break}}}
export function requestSupplyConvoy(battle,unitId){if(battle.phase!=='player'||battle.finished)return false;const unit=battle.units.find(item=>item.id===unitId&&item.side==='blue'&&item.strength>0);if(!unit)return false;if(stableCitySupply(battle,unit)&&!(unit.kind==='engineer'&&(unit.engineerCharges??0)<(unit.maxEngineerCharges??4))){log(battle,'هذه القوة داخل مدينة آمنة؛ تحصل على إمداد محلي ولا تحتاج قافلة.');return false}if(!dispatchSupply(battle,unit,false)){log(battle,'تعذر إرسال القافلة: تحقق من مخزون المقر ومن وجود طريق آمن للقوة.');return false}return true}
function performSupplyCycle(battle){const logistics=battle.logistics;if(!logistics)return;logistics.month++;for(const depot of logistics.depots){depot.ammo=Math.min(depot.maxAmmo,depot.ammo+80);depot.fuel=Math.min(depot.maxFuel,depot.fuel+60);depot.engineeringStores=Math.min(depot.maxEngineeringStores??5,(depot.engineeringStores??0)+1)}for(const unit of battle.units.filter(item=>item.strength>0&&item.role!=='supplyTruck'))if(stableCitySupply(battle,unit)){unit.ammo=unit.maxAmmo;unit.fuel=unit.maxFuel??0;log(battle,`${urbanSiteAt(unit.x,unit.y).name} زوّدت ${unit.side==='blue'?'قواتك':'قوات العدو'} تلقائياً ببداية الشهر.`)}for(const side of ['blue','red']){if(!logistics.depots.some(depot=>depot.side===side&&depot.auto))continue;const reserved=requestedSupplyUnitIds(battle),candidates=ownUnits(battle,side).filter(unit=>unit.role!=='supplyTruck'&&!reserved.has(unit.id)&&unitNeedsSupply(battle,unit,true)).sort((a,b)=>Math.min(unitAmmoRatio(a),a.maxFuel?a.fuel/a.maxFuel:1)-Math.min(unitAmmoRatio(b),b.maxFuel?b.fuel/b.maxFuel:1));for(const unit of candidates)dispatchSupply(battle,unit,true)}log(battle,`بدأ شهر الإمداد ${logistics.month}: المدن الآمنة جدّدت مخزونها، ووُضعت طلبات القوافل الميدانية حسب الأولوية.`)}
function supplyRouteBlocked(battle,convoy,truck){const next=convoy.path?.[0];return next&&(unitAt(battle,next.x,next.y,truck)||supplyBlocked(battle,convoy.side,next.x,next.y))}
function deliverSupplyNearTruck(battle,convoy,truck){for(const item of [...convoy.deliveries]){const unit=battle.units.find(candidate=>candidate.id===item.unitId&&candidate.strength>0);if(!unit){convoy.deliveries=convoy.deliveries.filter(entry=>entry!==item);continue}if(stableCitySupply(battle,unit)&&!(unit.kind==='engineer'&&item.engineering>0)){const depot=battle.logistics.depots.find(entry=>entry.side===convoy.side);if(depot){depot.ammo=Math.min(depot.maxAmmo,depot.ammo+item.ammo);depot.fuel=Math.min(depot.maxFuel,depot.fuel+item.fuel);depot.engineeringStores=Math.min(depot.maxEngineeringStores??5,(depot.engineeringStores??0)+item.engineering)}convoy.deliveries=convoy.deliveries.filter(entry=>entry!==item);log(battle,`دخلت ${unit.id} مدينة آمنة قبل استلام الشحنة؛ عاد رصيدها إلى المقر.`);continue}if(hexDistance(truck,unit)>2)continue;unit.ammo=Math.min(unit.maxAmmo,unit.ammo+item.ammo);unit.fuel=Math.min(unit.maxFuel??0,(unit.fuel??0)+item.fuel);if(unit.kind==='engineer')unit.engineerCharges=Math.min(unit.maxEngineerCharges??4,(unit.engineerCharges??0)+item.engineering);convoy.deliveries=convoy.deliveries.filter(entry=>entry!==item);log(battle,`وصلت شاحنة الإمداد إلى ${unit.id} وزودتها؛ بقيت ${convoy.deliveries.length} وحدات على مسار القافلة.`)}convoy.deliveryIds=convoy.deliveries.map(item=>item.unitId);convoy.unitId=convoy.deliveryIds[0]??null;truck.supplyTargetId=convoy.unitId}
export function advanceSupplyConvoys(battle){const movements=[];for(const convoy of [...(battle.logistics?.convoys??[])]){const truck=battle.units.find(item=>item.id===(convoy.truckId??convoy.id)&&item.strength>0);if(!truck){convoy.cancelled=true;continue}deliverSupplyNearTruck(battle,convoy,truck);if(!convoy.deliveries.length){truck.strength=0;truck.hp=0;convoy.cancelled=true;continue}const target=battle.units.find(item=>item.id===convoy.unitId&&item.strength>0);if(!target){convoy.cancelled=true;truck.strength=0;truck.hp=0;continue}const targetMoved=convoy.pathTargetId!==target.id||convoy.pathTargetX!==target.x||convoy.pathTargetY!==target.y;if((!convoy.path?.length&&hexDistance(truck,target)>2)||targetMoved||supplyRouteBlocked(battle,convoy,truck)){convoy.path=supplyPath(battle,convoy.side,truck,target);convoy.pathTargetId=target.id;convoy.pathTargetX=target.x;convoy.pathTargetY=target.y}if(!convoy.path){log(battle,`توقفت قافلة الإمداد ${convoy.side==='blue'?'الصديقة':'المعادية'}؛ الطريق غير آمن أو مقطوع.`);continue}let cost=0;const moved=[];for(const point of convoy.path){const step=ROAD_CELLS.has(cellKey(point.x,point.y))?.75:tileCost(point.x,point.y);if(moved.length&&cost+step>5)break;cost+=step;moved.push(point)}if(!moved.length){deliverSupplyNearTruck(battle,convoy,truck);if(!convoy.deliveries.length){truck.strength=0;truck.hp=0;convoy.cancelled=true}continue}const from={x:truck.x,y:truck.y};truck.x=convoy.x=moved.at(-1).x;truck.y=convoy.y=moved.at(-1).y;convoy.path=convoy.path.slice(moved.length);movements.push({convoyId:convoy.id,truckId:truck.id,side:convoy.side,from,path:moved});deliverSupplyNearTruck(battle,convoy,truck);if(!convoy.deliveries.length){truck.strength=0;truck.hp=0;convoy.cancelled=true}}battle.logistics.convoys=battle.logistics.convoys.filter(item=>!item.cancelled);launchQueuedSupply(battle);return movements}
function consumeRoundSupply(battle){for(const unit of ownUnits(battle,'blue').concat(ownUnits(battle,'red'))){const factor=supplyTerrainFactor(unit.x,unit.y);unit.ammo=Math.max(0,unit.ammo-.75*factor);if(unit.modelId)unit.fuel=Math.max(0,unit.fuel-.5*factor);if(stableCitySupply(battle,unit)){unit.ammo=Math.min(unit.maxAmmo,unit.ammo+2.5);if(unit.modelId)unit.fuel=Math.min(unit.maxFuel,unit.fuel+2.5)}}}
export function supplyState(battle,unitId){const unit=battle.units.find(item=>item.id===unitId);if(!unit)return null;const city=stableCitySupply(battle,unit);return{ammo:unit.ammo,maxAmmo:unit.maxAmmo,fuel:unit.fuel??0,maxFuel:unit.maxFuel??0,engineering:unit.engineerCharges??0,maxEngineering:unit.maxEngineerCharges??0,city:!!city,cityName:city?.name??null,terrainFactor:supplyTerrainFactor(unit.x,unit.y)}}

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
  if(attacker.ammo<=0){log(battle,`${attacker.side==='blue'?'قواتك':'العدو'} نفدت ذخيرته؛ تعذر تنفيذ الهجوم.`);return false;}
  const separation = distance(attacker, defender);
  if (separation > unitAttackRange(attacker) || !terrainSight(attacker,defender)) return false;
  const ambushStrike=attacker.side==='blue'&&attacker.hidden&&attacker.ambushReady;
  if(attacker.hidden){attacker.hidden=false;attacker.ambushReady=false;}
  const armorAttacker=attacker.modelId?ARMOR_MODELS[attacker.modelId]:null;
  const armorDefender=defender.modelId?ARMOR_MODELS[defender.modelId]:null;
  const ranged=separation>1&&(attacker.kind==='sniper'||!!armorAttacker);
  ensureUnitHealth(defender);
  const attackerProfile=cityCombatModifiers(attacker);
  const cover=adjacentCover(battle,defender);
  const strengthFactor=.55+.45*(attacker.strength/Math.max(1,attacker.maxStrength??attacker.strength));
  const fortified=ensureEngineering(battle).fortifications.some(f=>f.x===defender.x&&f.y===defender.y&&f.side===defender.side);
  const coverFactor=Math.max(.50,(1-cover*.45)*(fortified?.82:1));
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
    baseDamage=attacker.kind==='sniper'?3:10;
    weaponFactor=(armorDefender.category==='tank'?.75:1.05)/armorDefender.armor;
  }else{
    baseDamage=attacker.kind==='sniper'?28:attacker.kind==='engineer'?18:22;
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
  const attackerName=armorAttacker?ARMOR_MODELS[attacker.modelId].name:attacker.kind==='sniper'?'القناص':'المشاة';
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
  const reds = ownUnits(battle,'red').filter(unit=>unit.role!=='supplyTruck'), blues = ownUnits(battle,'blue').filter(unit=>!unit.hidden&&unit.role!=='supplyTruck'), blueTrucks=ownUnits(battle,'blue').filter(unit=>unit.role==='supplyTruck');
  const plans = new Map();
  const available = new Set(reds.map(unit=>unit.id));

  // Enemy formations may intercept exposed supply trucks, but never treat them as troops or city threats.
  for(const unit of reds){const truck=blueTrucks.filter(item=>distance(unit,item)<=unitAttackRange(unit)+unit.movement).sort((a,b)=>distance(unit,a)-distance(unit,b))[0];if(truck){plans.set(unit.id,{kind:'interceptSupply',target:truck});available.delete(unit.id)}}
  for(const engineer of reds.filter(unit=>unit.kind==='engineer')){
    const enemyMine=battle.engineering?.minefields?.find(m=>m.side==='blue'&&distance(engineer,m)<=1);
    const nearBlue=blues.filter(u=>distance(engineer,u)<=3).sort((a,b)=>distance(engineer,a)-distance(engineer,b))[0];
    if(enemyMine){plans.set(engineer.id,{kind:'engineerClearMine',mine:enemyMine});available.delete(engineer.id);continue}
    if(!available.has(engineer.id)||!engineer.engineerCharges)continue;
    if(nearBlue&&battle.owners[indexOf(engineer.x,engineer.y)]==='red'&&!battle.engineering?.fortifications?.some(f=>f.x===engineer.x&&f.y===engineer.y)){plans.set(engineer.id,{kind:'engineerFortify'});available.delete(engineer.id);continue}
    const cells=hexNeighbors(engineer).filter(p=>battle.owners[indexOf(p.x,p.y)]==='red'&&!unitAt(battle,p.x,p.y)&&!battle.engineering?.minefields?.some(m=>m.x===p.x&&m.y===p.y)&&blues.some(u=>distance(u,p)<=2)).sort((a,b)=>Math.min(...blues.map(u=>distance(a,u)))-Math.min(...blues.map(u=>distance(b,u))));
    if(cells[0]){plans.set(engineer.id,{kind:'engineerMine',targetCell:cells[0]});available.delete(engineer.id)}
  }

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
    else if (plan.kind === 'sniperAdvance') path = pathIntoRange(battle,unit,plan.target,unitAttackRange(unit))?.path ?? [];
    const targetId=['counterattack','sniperFire','sniperAdvance','interceptSupply'].includes(plan.kind)?plan.target?.id??null:null;
    return { unitId: unit.id, path, attackTargetId: targetId, kind: plan.kind, siteName: plan.site?.name??null,engineeringTarget:plan.targetCell??null,mineId:plan.mine?.id??null };
  });
}

export function resolveEnemyAction(battle, action) {
  const unit = battle.units.find(item => item.id === action.unitId && item.strength > 0);
  if (!unit) return;
  if(action.kind==='engineerFortify'){reinforceSite(battle,unit);return}
  if(action.kind==='engineerMine'){if(action.engineeringTarget)placeMine(battle,unit,action.engineeringTarget.x,action.engineeringTarget.y);return}
  if(action.kind==='engineerClearMine'){const m=battle.engineering?.minefields?.find(v=>v.id===action.mineId);if(m)removeMine(battle,unit,m.x,m.y);return}
  if(unit.stoppedByMine)return;
  if (action.kind === 'defend' && action.path.length) log(battle, `العدو يعزز محيط ${action.siteName} بفصيل إضافي.`);
  else if (action.kind === 'retreat' && action.path.length) log(battle, `فصيل العدو ${unit.id.slice(-1)} يعيد التموضع لتجنب الحصار.`);
  else if(action.kind==='interceptSupply')log(battle,'العدو يحاول اعتراض شاحنة الإمداد المكشوفة.');
  else if (action.kind === 'counterattack') log(battle, `العدو يجهز هجوماً معاكساً على الفصيل ${action.attackTargetId?.replace('blue-','')}.`);
  else if(action.kind==='sniperFire'||action.kind==='sniperAdvance')log(battle,`قناص العدو يطلق النار باتجاه الفصيل ${action.attackTargetId?.replace('blue-','')}.`);
  const target = battle.units.find(item => item.id === action.attackTargetId && item.side === 'blue' && item.strength > 0);
  if (target && distance(unit,target)<=unitAttackRange(unit)) attack(battle,unit,target);
}

export function finalizeTurn(battle) {
  consumeRoundSupply(battle);
  for (const unit of battle.units) { unit.order=null;unit.moved=false;unit.attacked=false;unit.pinned=false;unit.stoppedByMine=false;unit.fieldActionUsed=false;if(unit.strength>0)unit.morale=Math.min(100,unit.morale+2); }
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
  for(const action of actions){for(const point of action.path)if(!stepUnit(battle,action.unitId,point))break;resolveEnemyAction(battle,action);}
  advanceSupplyConvoys(battle);return finalizeTurn(battle);
}

export function countUnits(battle, side) { return ownUnits(battle, side).filter(unit=>unit.role!=='supplyTruck').length; }
export function countSoldiers(battle, side) { return ownUnits(battle, side).filter(unit=>unit.role!=='supplyTruck'&&!unit.modelId).reduce((sum,unit)=>sum+unit.strength,0); }
export function countArmoredUnits(battle,side){return ownUnits(battle,side).filter(unit=>!!unit.modelId).length;}

export function combatPower(battle, side, center, radius = 2) { return localPower(battle,side,center,radius); }

// SOLDIER_FIELD_ENGINEERS_V1
