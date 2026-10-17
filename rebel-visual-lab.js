import {mountCommandView} from './rebel-command-view.js';
import {policy,civilianStrikeAllowed,evidencePermission,recordEvidence,truceMoveRisk,truceWithdrawal} from './rebel-command-policy.js';
import {droneFrontBonus} from './rebel-front-plans.js';
import {renderIntelligence} from './rebel-intelligence-view.js';
import {presentationPending} from './rebel-situation-reports.js';
import {frontOrder,markLocalParticipants,canRestLocally} from './rebel-front-doctrine.js';
import {knownTargets,orderIntel} from './rebel-intelligence.js';
import {engineerRepairJobs,queueEngineerRepair} from './rebel-campaign.js';
import {cityVariation,ruinArtwork} from './rebel-city-memory.js';
import {caveArtwork} from './rebel-caves.js';
import {renderCampaign,campaignArt,commandArt,jammerArt} from './rebel-campaign-view.js';
import {DRONE_ROLES,ensureDroneInventory,preferredDrone} from './rebel-drone-roles.js';
import {premiumUnitArt} from './rebel-premium-art.js';
import {pickMapTarget} from './rebel-map-picking.js';
import {droneFactoryArt} from './rebel-drone-industry.js';
import {advanceDroneFreight,droneSiteLaunchCheck} from './rebel-sim.js';
import {rebelInfantryArtwork} from './rebel-infantry-art.js';
import {droneAllowance,SUPPORT_PROFILES} from './rebel-support-rules.js';
import {supportArtwork} from './battle-support-art.js';
import {supportBarrage,supportImpact} from './battle-support-fx.js';
import {armorTier,directWeapon,takeExchanges,syncFacilities,captureFacilities,facilityTargets,rebellionObjectives,targetScore} from './rebel-facilities.js';
import {decorateIdentity} from './battle-unit-identity.js';
import {facilityAttackCheck,issueFacilityAttack} from './rebel-sim.js';
import {ROAD_LINES,RIVER_POINTS,terrainDescription,terrainAt,elevationAt,terrainSight} from './rebel-terrain.js';
import {drawMountainTerrain} from './rebel-mountain-art.js';
import {isUnitDetected} from './rebel-sim.js';
import {groundFireFX,groundWeapon,groundSocket} from './rebel-ground-fx.js';
import {impactFX,shellFX} from './rebel-combat-fx.js';
import {prepareAirDefense,renderDefenseSymbol,inspectDefense,pollDefense,finishDefenseFlight} from './rebel-defense.js';
import {unitArtwork,decorateUnitCard,droneArtwork,launcherArtwork} from './rebel-unit-art.js';
import {canFireArtillery,fireArtillery} from './rebel-artillery-sim.js';
import {proposeArmistice,answerArmistice,extendArmistice,breakArmistice,assessArmisticeDecision,maybeOfferArmisticeForAI,publicReportText,setDisclosurePolicy,syncIndustryLedger,accountIndustry,getArmisticeState,recordOperationPlan} from './rebel-political-systems.js';
import {plantFieldMine,buildFieldFortification,clearFieldMine,engineeringState,scanEngineerMines} from './rebel-engineering-sim.js';
import { THEATER, GRID, HEX_RADIUS, CITIES, OBJECTIVE, ARMOR_MODELS, hexCenter, hexPolygon, hexNeighbors, hexDistance, urbanControl, createBattle, reachableCells, attackApproaches, unitAttackRange, urbanSiteAt, isMountainAt, MOUNTAIN_ART_CELLS, canAmbush, issueAmbush, cityVictoryProgress, beginMove, stepUnit, completeMovement, issueAttack, issueHold, issueRegroup, cancelRegroup, beginEnemyTurn, resolveEnemyAction, finalizeTurn, remainingPlayerActivations, countUnits, countSoldiers, countArmoredUnits, supplyState, requestSupplyConvoy, advanceSupplyConvoys, establishForwardSupplyCenter, DRONE_MODELS, droneLaunchCheck, launchDrone, startDroneFlight, attemptDroneInterception, resolveDroneImpact, startDroneSalvo, mapCellInfo, mapObjectAt, canPlaceFacility, placeFacility, garrisonInHouse, leaveHouse } from './rebel-sim.js';

// Keep the fixed drone panel outside the transformed, scrollable unit dock.
document.querySelector('.lab').append(document.getElementById('droneCommand'));
const closeDronePanel=document.createElement('button');closeDronePanel.type='button';closeDronePanel.className='command-close';closeDronePanel.textContent='إغلاق قيادة المسيرات';closeDronePanel.onclick=()=>{document.getElementById('droneCommand').hidden=true;document.querySelector('.command-dock').classList.remove('contextual-active')};document.getElementById('droneCommand').prepend(closeDronePanel);
const NS='http://www.w3.org/2000/svg',svg=document.querySelector('#soldierMap');
const groups=Object.fromEntries(['terrain','territory','frontline','routes','sites','logistics','units','effects'].map(id=>[id,document.getElementById(id)]));
const el=(tag,attrs={},parent=svg)=>{const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);parent.append(n);return n};
const key=(x,y)=>`${x},${y}`,ownerFill=side=>side==='blue'?'blue-territory':'red-territory';
const selectedDroneType=()=>document.getElementById('droneType').value;
function activeDroneSource(){const base=battle.droneBases?.find(b=>b.id===activeDroneBaseId);if(base)return{baseId:base.id,point:base};const unit=selectedUnit();return unit&&['droneOperator','droneVehicle'].includes(unit.role)?{sourceId:unit.id,point:unit}:null}
function activeDroneRange(){const source=activeDroneSource(),model=DRONE_MODELS[selectedDroneType()];return source&&model?Math.min(model.range,source.baseId?16:(battle.units.find(u=>u.id===source.sourceId)?.launchRange??0)):0}

const unitNo=id=>id.slice(id.lastIndexOf('-')+1),unitLabel=unit=>unit?.weaponId==='kornet'?'فريق كورنيت':unit?.role==='commander'?'معسكر القيادة':unit?.role==='jammer'?'عربة التشويش':unit?.role==='supplyTruck'?'شاحنة إمداد':unit?.role==='airlift'?'مشاة إنزال جوي':unit?.role==='antiAir'?'جندي مضاد للمسيرات':unit?.role==='droneOperator'?'فريق مشغّلي الدرونات':unit?.role==='droneVehicle'?'مركبة إطلاق الدرونات':unit?.role==='fieldArtillery'?'مدفعية ميدانية':unit?.role==='katyusha'?'راجمات كاتيوشا':unit?.role==='mortar'?'هاون ميداني':unit?.role==='antiArmor'?'مضاد دروع':unit?.role==='reconRadar'?'رادار استطلاع':unit?.kind==='engineer'?'مهندس ميدان':UNIT_SYMBOLS[unit?.modelId??unit?.kind]?.name??'مشاة';
const AIRLIFT_KEY='orane-rebel-airlift-v1';
const autoControl={running:false,stop:false,pace:'fast',snapshot:null};
let battle=createBattle(),selectedId='blue-drone-team-1',uiBusy=false,visualMove=null,visualConvoys=new Map(),actingEnemyId=null,droneLaunchActive=false,activeDroneBaseId=null,artilleryTargeting=false,engineeringMode='',view={x:0,y:0,w:THEATER.width,h:THEATER.height},drag=null,skipClick=false,nextAirUnitId=1;
installStrategicDock();
const territoryNodes=[];
const centers=Array.from({length:GRID.rows},(_,y)=>Array.from({length:GRID.columns},(_,x)=>hexCenter(x,y)));
function airliftLandingCell(point,reserved){let best=null;for(let y=0;y<GRID.rows;y++)for(let x=0;x<GRID.columns;x++){const idx=y*GRID.columns+x;if(battle.owners[idx]!=="blue"||reserved.has(`${x},${y}`)||battle.units.some(unit=>unit.strength>0&&unit.x===x&&unit.y===y))continue;const pos=centers[y][x],distance=Math.hypot(pos.x-point.x,pos.y-point.y);if(!best||distance<best.distance)best={x,y,distance}}return best&&best.distance<520?best:null}
function receiveAirlifts(){if(battle.phase!=="player"||battle.finished)return 0;let queue;try{queue=JSON.parse(localStorage.getItem(AIRLIFT_KEY)||"null")}catch{return 0}if(!Array.isArray(queue?.deliveries)||!queue.deliveries.length)return 0;const reserved=new Set(),remaining=[],arrived=[];for(const delivery of queue.deliveries){const cell=airliftLandingCell(delivery,reserved);if(!cell){remaining.push(delivery);continue}reserved.add(`${cell.x},${cell.y}`);const suffix=nextAirUnitId++;battle.units.push({id:`blue-air-L${suffix}`,side:"blue",kind:"infantry",x:cell.x,y:cell.y,strength:6,maxStrength:6,hpPerStrength:22,maxHp:132,hp:132,morale:100,movement:4,moved:false,attacked:false,hidden:false,ambushReady:false,order:null,role:"airlift",siteId:null,kills:0,pinned:false,ammo:14,maxAmmo:14,fuel:0,maxFuel:0,airliftSource:delivery.id});arrived.push(cell)}if(arrived.length){battle.events.push(`وصل ${arrived.length} فصائل إنزال جوي من مختبر الطيران؛ أصبحت جاهزة للحركة ضمن جولتك.`);battle.events=battle.events.slice(-8);if(typeof renderAll==='function')renderAll()}try{if(remaining.length)localStorage.setItem(AIRLIFT_KEY,JSON.stringify({...queue,deliveries:remaining}));else localStorage.removeItem(AIRLIFT_KEY)}catch{}return arrived.length}


// Display-only ownership: every map hex belongs to its nearest strategic city.
// The simulation and unit movement continue to use their original battle state.
const cityJurisdiction=Array.from({length:GRID.rows},(_,y)=>Array.from({length:GRID.columns},(_,x)=>{
 let best=null,bestScore=Infinity;
 for(const site of battle.sites){const score=hexDistance(site,{x,y})-(site.radius-1)*.38;if(score<bestScore||(score===bestScore&&site.priority>(best?.priority??-1))){best=site;bestScore=score}}
 return best?.id??null;
}));
function cityOwnerAt(x,y){return battle.owners[y*GRID.columns+x]}

// Each role has its own outline; faction colour is only on the surrounding frame.
const UNIT_SYMBOLS={
 infantry:{name:'مشاة',state:'متاح في هذه التجربة',shape:`<path d="M-35-29Q-33-44-16-46Q1-45 5-31L1-25H-34Z M-31-25L-21-20L-9-23L-4-16L-12-10L-26-11L-31-17Z M-40-13L-27-20L-10-15L3 2L-8 12L-21 2L-30 16L-45 9Z M-8-12L7-19L20-14L25-6L14 0L7-5L1 10L-10 6Z M-20 2L-7 7L-12 24L-1 36L-4 43H-19L-32 31L-31 21L-45 15Z M-5 8L9 2L18 13L29 25L27 32L13 31L1 22L-12 19Z M-47 36H-29L-24 42L-26 47H-49Z M12 26L28 27L37 34L34 40H15L7 35Z M-13-19L47-35L51-27L-9-9Z M42-37L58-42L60-35L48-30Z"/><path d="M-22-39Q-15-42-9-38" fill="none" stroke="#425251" stroke-width="2.5" stroke-linecap="round"/><path d="M-2-8L8-2M-26 15L-17 20M4 14L13 20" fill="none" stroke="#425251" stroke-width="2.2" stroke-linecap="round"/>`},
 sniper:{name:'قناص',state:'مدى 3 خلايا؛ 5 خلايا عند التموضع على الجبل',shape:`<path d="M-41-4Q-39-20-24-21Q-9-21-5-8L-12-1L-27 1L-38 8Z M-13-7L4-10L20-5L29 1L23 8L8 5L-3 12L-22 12L-37 20L-49 15L-42 6Z M-5 7L10 7L20 16L33 21L30 27L14 25L2 18L-14 18Z M-43 17L-28 14L-31 24L-46 27Z M-14-11L41-17L43-11L-10-4Z M40-18H57V-13H41Z M19-17L25-23L38-22L40-17Z"/><path d="M-31 4L-22 8M-10 1L-2 4" fill="none" stroke="#425251" stroke-width="2.3" stroke-linecap="round"/>`},
 antiArmor:{name:'مضاد دروع',state:'رمز محجوز · غير مضاف للقتال',shape:`<path d="M-36-27Q-34-43-18-44Q-2-42 1-29L-4-23H-35Z M-32-22L-20-18L-7-19L3-10L-5 1L-17-2L-24 13L-40 9L-43-5Z M-9-8L7-16L19-10L23 0L11 5L5 0L-1 15L-14 10Z M-21 9L-7 13L-10 27L2 37L-1 43H-17L-30 31L-29 19L-42 14Z M-5 11L9 5L17 17L31 27L29 33L13 31L0 23L-15 21Z M-48 35H-30L-25 42L-28 47H-49Z M15 27L31 29L38 35L35 40H17L9 35Z M-6-12L32-34L37-26L-1-3Z M23-39L43-48L47-42L29-31Z M41-49L53-54L56-48L46-43Z"/><path d="M-25-37Q-17-39-11-36" fill="none" stroke="#425251" stroke-width="2.5" stroke-linecap="round"/>`},
 antiAir:{name:'جندي مضاد للمسيرات',state:'اعتراض تلقائي ضمن مدى ٢٫٥ خلية · ٤ صواريخ كتفية',shape:`<path d="M-36-27Q-34-43-18-44Q-2-42 1-29L-4-23H-35Z M-32-22L-20-18L-7-19L3-10L-5 1L-17-2L-24 13L-40 9L-43-5Z M-9-8L7-16L19-10L23 0L11 5L5 0L-1 15L-14 10Z M-21 9L-7 13L-10 27L2 37L-1 43H-17L-30 31L-29 19L-42 14Z M-5 11L9 5L17 17L31 27L29 33L13 31L0 23L-15 21Z M-48 35H-30L-25 42L-28 47H-49Z M15 27L31 29L38 35L35 40H17L9 35Z M-11-15L24-46L31-38L-4-7Z M18-46L24-52L33-44L28-38Z M21-43L36-53L41-48L26-36Z M34-52L44-55L47-49L40-45Z"/><path d="M-25-37Q-17-39-11-36" fill="none" stroke="#425251" stroke-width="2.5" stroke-linecap="round"/>`},
 tank:{name:'دبابة قتال رئيسية',state:'قوة نيران وحماية أعلى؛ حركة أبطأ من المشاة.',shape:`<path d="M-52 17Q-52 5-40 3H38Q52 5 53 17V31Q51 41 39 42H-39Q-52 40-52 30Z M-42 12H40V32H-42Z M-33 17A8 8 0 1 0-33 33A8 8 0 1 0-33 17Z M-12 17A8 8 0 1 0-12 33A8 8 0 1 0-12 17Z M10 17A8 8 0 1 0 10 33A8 8 0 1 0 10 17Z M32 17A8 8 0 1 0 32 33A8 8 0 1 0 32 17Z M-26 2L-22-11Q-18-19-7-20H16Q25-19 29-11L34 3Z M-12-20Q-9-31 3-32H16Q24-30 25-22L21-18H-11Z M13-30L52-36L55-29L20-23Z M-3-18H13V-14H-3Z"/><path d="M-45 9H45M-39 37H39" fill="none" stroke="#425251" stroke-width="2.5" stroke-linecap="round"/>`},
 ifv:{name:'ناقلة مشاة مدرعة',state:'ترافق المشاة بحركة أسرع وحماية أخف من الدبابة.',shape:`<path d="M-53 10L-45-8Q-42-15-33-16H28L43-7L51 8V31Q49 39 39 40H-40Q-52 38-53 29Z M-37-9H28L38 1H-42Z M-39 13A8 8 0 1 0-39 29A8 8 0 1 0-39 13Z M-17 13A8 8 0 1 0-17 29A8 8 0 1 0-17 13Z M7 13A8 8 0 1 0 7 29A8 8 0 1 0 7 13Z M31 13A8 8 0 1 0 31 29A8 8 0 1 0 31 13Z M-5-16L1-28H20L27-16Z M13-29L47-34L50-28L25-24Z M-31-12V-4M-10-12V-4M13-12V-4"/><path d="M-46 7H43M-43 35H40" fill="none" stroke="#425251" stroke-width="2.5" stroke-linecap="round"/>`},
 scoutVehicle:{name:'مركبة استطلاع',state:'رمز بصري فقط · غير مضاف للقتال',shape:`<path d="M-50 17L-45 4L-35-4L-24-17H14L29-7L42-3L50 8V26Q48 34 39 35H-39Q-50 33-50 26Z M-23-12L-14-3H4V-12Z M-9-12V-3H22L14-12Z M-40 17A9 9 0 1 0-40 35A9 9 0 1 0-40 17Z M34 17A9 9 0 1 0 34 35A9 9 0 1 0 34 17Z M-30-18H11V-23H-30Z M-30-23L-23-29H8L14-23Z M-4-28V-37M-4-37L5-42"/><path d="M-42 10H-33M26 10H37" fill="none" stroke="#425251" stroke-width="2.5" stroke-linecap="round"/>`},

 abrams:{name:'M1A2 Abrams · الولايات المتحدة',tag:'US',state:ARMOR_MODELS.abrams.state,shape:`<path d="M-69 8L-58-13L-40-19H39L62-7L69 9V31H-68Z M-55 16H55V29H-55Z M-49 17A6 6 0 1 0-49 29A6 6 0 1 0-49 17Z M-27 17A6 6 0 1 0-27 29A6 6 0 1 0-27 17Z M-5 17A6 6 0 1 0-5 29A6 6 0 1 0-5 17Z M17 17A6 6 0 1 0 17 29A6 6 0 1 0 17 17Z M39 17A6 6 0 1 0 39 29A6 6 0 1 0 39 17Z M-30-20L-21-35H20L36-24L39-13H-30Z M-11-35V-42H4V-35Z M18-29L69-35L71-28L27-21Z M-50-12L-41-7M-34-14L-24-9M23-14L33-8"/>`},
 t90m:{name:'T-90M · روسيا',tag:'RU',state:ARMOR_MODELS.t90m.state,shape:`<path d="M-68 8L-57-10L-42-17H40L61-7L68 9V31H-68Z M-55 16H55V29H-55Z M-48 17A6 6 0 1 0-48 29A6 6 0 1 0-48 17Z M-27 17A6 6 0 1 0-27 29A6 6 0 1 0-27 17Z M-6 17A6 6 0 1 0-6 29A6 6 0 1 0-6 17Z M15 17A6 6 0 1 0 15 29A6 6 0 1 0 15 17Z M37 17A6 6 0 1 0 37 29A6 6 0 1 0 37 17Z M-26-17Q-22-34-4-35H15L29-26L32-14H-28Z M-14-34L-9-42H2L8-34ZM11-34L18-41H29L33-29ZM27-13L69-19L70-12L34-8Z M-43-14L-34-6M-24-15L-15-7M-5-15L4-7M14-15L23-7M33-14L42-7"/>`},
 type99a:{name:'Type 99A · الصين',tag:'CN',state:ARMOR_MODELS.type99a.state,shape:`<path d="M-70 7L-60-12L-42-18H39L63-8L70 9V31H-69Z M-56 16H56V29H-56Z M-49 17A6 6 0 1 0-49 29A6 6 0 1 0-49 17Z M-27 17A6 6 0 1 0-27 29A6 6 0 1 0-27 17Z M-5 17A6 6 0 1 0-5 29A6 6 0 1 0-5 17Z M17 17A6 6 0 1 0 17 29A6 6 0 1 0 17 17Z M39 17A6 6 0 1 0 39 29A6 6 0 1 0 39 17Z M-31-18L-20-34L9-39L31-28L38-14H-32Z M-5-38L1-47L8-39ZM25-25L39-31L48-23L39-15Z M27-28L70-36L72-29L34-21Z M-48-11L-38-5M-25-13L-15-7M0-14L10-8M-1-35L11-39"/>`},
 bradley:{name:'M2 Bradley · الولايات المتحدة',tag:'US',state:ARMOR_MODELS.bradley.state,shape:`<path d="M-70 12L-62-17L-45-28H33L52-18L67 2V31H-70Z M-56 18H55V29H-56Z M-49 18A5 5 0 1 0-49 28A5 5 0 1 0-49 18Z M-29 18A5 5 0 1 0-29 28A5 5 0 1 0-29 18Z M-9 18A5 5 0 1 0-9 28A5 5 0 1 0-9 18Z M11 18A5 5 0 1 0 11 28A5 5 0 1 0 11 18Z M31 18A5 5 0 1 0 31 28A5 5 0 1 0 31 18Z M-35-28V-39H-5L2-28Z M-18-39L-12-45H-2L3-39ZM-15-36L46-43L48-37L-8-31Z M-60-10L-47-10M-60-1L-43-1M36-14L48-8M51-4L62 4"/>`},
 bmp3:{name:'BMP-3 · روسيا',tag:'RU',state:ARMOR_MODELS.bmp3.state,shape:`<path d="M-68 13L-59-8L-42-19H40L60-8L68 10V31H-68Z M-54 18H54V29H-54Z M-48 18A5 5 0 1 0-48 28A5 5 0 1 0-48 18Z M-27 18A5 5 0 1 0-27 28A5 5 0 1 0-27 18Z M-6 18A5 5 0 1 0-6 28A5 5 0 1 0-6 18Z M15 18A5 5 0 1 0 15 28A5 5 0 1 0 15 18Z M37 18A5 5 0 1 0 37 28A5 5 0 1 0 37 18Z M-17-18Q-15-34 2-35H15Q30-33 32-19L29-11H-19Z M-7-34V-41H5V-34ZM20-33L28-39L34-34ZM18-36L49-42L51-36L27-29ZM32-23L69-29L71-24L33-17Z M-48-13L-36-7M34-13L46-7"/>`},
 zbd04:{name:'ZBD-04 · الصين',tag:'CN',state:ARMOR_MODELS.zbd04.state,shape:`<path d="M-70 9L-59-16L-42-27H38L59-17L69 3V31H-70Z M-56 18H56V29H-56Z M-49 18A5 5 0 1 0-49 28A5 5 0 1 0-49 18Z M-28 18A5 5 0 1 0-28 28A5 5 0 1 0-28 18Z M-7 18A5 5 0 1 0-7 28A5 5 0 1 0-7 18Z M14 18A5 5 0 1 0 14 28A5 5 0 1 0 14 18Z M36 18A5 5 0 1 0 36 28A5 5 0 1 0 36 18Z M-35-26L-29-39L-8-41L1-29H-29ZM-13-25V-36Q-10-44 3-44H15Q26-42 28-34L26-24Z M-4-43L1-50H12L17-43ZM16-37L51-44L53-38L27-31ZM28-35L36-41L43-36ZM34-21L69-27L71-21L35-15Z M-54-8L-41-5M-38-12L-27-8"/>`},
 supplyTruck:{name:'شاحنة إمداد عسكرية',state:'قافلة قابلة للاستهداف؛ الحمولة تصل عند بلوغ القوة.',shape:`<path d="M-57-27H17Q24-27 24-19V-8H44L58 5V25H-57Z M24-2H49L39-13H24Z M-40 18A10 10 0 1 0-40 38A10 10 0 1 0-40 18Z M37 18A10 10 0 1 0 37 38A10 10 0 1 0 37 18Z"/><path d="M-43-17H-25V-2H-43ZM-17-17H1V-2H-17ZM9-17H17V-2H9ZM-49 4H17M-7-26V-34H7V-26M-5-34L2-41L9-34" fill="none" stroke="#687575" stroke-width="3" stroke-linejoin="round"/>`},
fieldArtillery:{name:'مدفعية ميدانية',state:'مدى 7 خلايا · قذيفة دقيقة على خلية واحدة · طلقة واحدة لكل جولة',shape:`<path d="M-52 18H28V31H-52Z M-43 15A7 7 0 1 0-43 29A7 7 0 1 0-43 15Z M-13 15A7 7 0 1 0-13 29A7 7 0 1 0-13 15Z M16 15A7 7 0 1 0 16 29A7 7 0 1 0 16 15Z M-22 15L-13-5L8-13L26-9L34 4L28 17Z M4-13L28-51L34-47L16-9Z M-6-6L-1-21M-35 9H16"/>`},
katyusha:{name:'راجمات كاتيوشا',state:'مدى 7 خلايا · ستة صواريخ بالرشقة · ضرر مركزي وجانبي',shape:`<path d="M-56 8L-47-12H31L48 2V28H-55Z M-44 18A8 8 0 1 0-44 34A8 8 0 1 0-44 18Z M24 18A8 8 0 1 0 24 34A8 8 0 1 0 24 18Z M-24-12V-27L8-42L31-26V-12Z M-18-27L10-49L16-44L-12-20Z M-8-32L20-54L26-49L-2-26Z M4-36L32-58L38-52L10-30Z M-39-7L-18-21M-9-7L12-21M19-5L37-16"/>`},
mortar:{name:'هاون ميداني',state:'حركة 3 · قصف غير مباشر 2–4 خلايا · دائرة صغيرة وضرر متوسط',shape:'<path d="M-39-32Q-38-45-25-46Q-12-44-10-32L-15-26H-37Z M-34-25L-20-23L-10-14L-14-2L-27 2L-39-5L-43-16Z M-13-17L-2-21L9-14L15-5L9 1L1-5L-5 8L-18 5Z M-27 0L-13-4L-7 7L-11 19L2 26L0 33H-17L-31 24L-33 13L-43 10Z M-8 4L4 0L12 8L10 15L1 15L-9 12Z M-47 26H-29L-23 32L-26 38H-47Z M1 25L13 28L17 34L14 39H-4L-12 34Z M18-43L25-46L43 10L36 13Z M19-40L43-46L45-41L21-35Z M37 8L49 12L47 18L34 15Z M37 11L51 34L47 37L32 17Z M38 11L28 35L23 33L33 10Z M22 31Q37 27 51 33L54 37Q39 41 22 36Z"/><path d="M-29-39Q-22-42-16-38M-13-13L-1-9M-18 9L-9 12M19-42L41-46" fill="none" stroke="#425251" stroke-width="2.5" stroke-linecap="round"/>'},
antiArmor:{name:'مضاد دروع',state:'رمز محجوز · غير مضاف للقتال',shape:`<path d="M-36-27Q-34-43-18-44Q-2-42 1-29L-4-23H-35Z M-32-22L-20-18L-7-19L3-10L-5 1L-17-2L-24 13L-40 9L-43-5Z M-9-8L7-16L19-10L23 0L11 5L5 0L-1 15L-14 10Z M-21 9L-7 13L-10 27L2 37L-1 43H-17L-30 31L-29 19L-42 14Z M-5 11L9 5L17 17L31 27L29 33L13 31L0 23L-15 21Z M-48 35H-30L-25 42L-28 47H-49Z M15 27L31 29L38 35L35 40H17L9 35Z M-6-12L32-34L37-26L-1-3Z M23-39L43-48L47-42L29-31Z M41-49L53-54L56-48L46-43Z"/><path d="M-25-37Q-17-39-11-36" fill="none" stroke="#425251" stroke-width="2.5" stroke-linecap="round"/>`},
reconRadar:{name:'رادار استطلاع متحرك',state:'حركة 3 · يكشف الوحدات المتخفية ضمن 9 خلايا · لا يهاجم',shape:'<path d="M-56 11L-47-13H24L49 0V27H-56Z M-42 20A8 8 0 1 0-42 36A8 8 0 1 0-42 20Z M32 20A8 8 0 1 0 32 36A8 8 0 1 0 32 20Z M-23-13V-24H9V-13Z M-7-24V-33L3-39L14-32V-24Z M5-33L30-52M16-26L43-32M-1-27L-27-49"/><path d="M-28-42Q-4-61 20-43M-38-51Q-5-77 31-52" fill="none" stroke="#101d23" stroke-width="4"/>'},
engineer:{name:'مهندس ميدان',state:'تحصين وزرع ألغام وإزالتها؛ المعدات محدودة.',shape:`<path d="M-34-29Q-32-44-17-45Q0-44 3-30L0-24H-32Z M-32-21L-18-18L-6-21L4-12L-2-2L-15-3L-22 12L-39 8L-42-5Z M-7-10L7-17L21-11L25-2L13 4L6-1L1 14L-13 10Z M-21 9L-7 14L-10 28L3 37V44H-17L-30 31L-29 19L-42 14Z M-5 11L9 5L18 17L31 27L29 34L12 32L0 23L-14 21Z M-48 36H-29L-25 43L-28 48H-49Z M14 28L31 29L39 36L36 41H17L9 36Z M-20-12L31-37L36-29L-11-5Z M43-48L50-44L22 18L16 15Z M43-53Q51-57 57-49L55-42L48-39L41-44Z"/>`}
};
UNIT_SYMBOLS.droneOperator={name:'فريق مشغّلي الدرونات',state:'فردان · ٣ مسيرات كحد أقصى؛ يختفي الفريق بعد إطلاق الثالثة',shape:"<path d=\"M-43-28Q-41-43-27-43Q-13-42-12-29L-17-23H-39Z M-13-30L-4-28L-7-22L-15-22Z M-35-19L-16-20L-5-9L-10 5L-25 5L-31 19L-46 14L-44-1Z M-37-18L-49-13L-51 2L-44 5L-41-7L-31-12Z M-28 5L-13 7L-13 19L-4 30L-7 36H-22L-34 27L-35 16Z M-13 6L0 1L8 12L17 19L14 25L2 24L-8 17L-20 17Z M-48 31H-29L-24 37H-49Z M2 20L16 19L21 24L18 30H6Z M-9-16L2-19L9-15L7-10L-1-10Z M5-16L15-18L16-12L7-10Z M4-21L4-27M4-27L9-31 M28-28L35-33L42-33L49-28L43-23L35-23Z M35-30L25-37M35-30L45-37M35-27L25-20M35-27L45-20 M24-39H27M43-39H46M24-18H27M43-18H46\"/><path d=\"M-9-16L5-18L9-15M6-20L6-27M26-37L35-31L44-37M26-20L35-26L44-20M25-39H27M43-39H46M25-18H27M43-18H46\" fill=\"none\" stroke=\"#bac7c0\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M-25-39Q-19-37-16-32M-47-8L-41-12M-2 31H-8\" fill=\"none\" stroke=\"#11191a\" stroke-width=\"3\" stroke-linecap=\"round\"/>"};
UNIT_SYMBOLS.droneVehicle={name:'مركبة إطلاق الدرونات',state:'مخزون ٧ مسيرات · إطلاق حتى ٤ بالجولة، لهدف واحد أو عدة أهداف',shape:"<path d=\"M-55 10L-49-5L-39-13H8L20-7L30-13H45L54-4L57 16L51 24H-51Z M-44 4A8 8 0 1 0-28 4A8 8 0 1 0-44 4Z M-24 4A8 8 0 1 0-8 4A8 8 0 1 0-24 4Z M-4 4A8 8 0 1 0 12 4A8 8 0 1 0-4 4Z M16 4A8 8 0 1 0 32 4A8 8 0 1 0 16 4Z M36 4A8 8 0 1 0 52 4A8 8 0 1 0 36 4Z M-50 13H53V20H-50Z M19-7L24-21L34-28H47L53-18L53-5H31L25 1H19Z M31-21H45L49-15H30Z M-40-13L-37-24L-32-28L-28-25L-30-13Z M-32-26L-14-48L-7-45L-22-20Z M-20-26L-3-49L4-45L-10-19Z M-8-25L8-47L15-43L1-18Z M-41-2H16M20-2H52\"/><path d=\"M-42-4H15M20-4H50M-32-24L-14-48L-7-45L-22-20M-20-26L-3-49L4-45L-10-19M-8-25L8-47L15-43L1-18M36-28V-34M37-34L43-38\" fill=\"none\" stroke=\"#bac7c0\" stroke-width=\"2.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M-13-39L-7-45M-1-39L5-45M11-37L16-42\" fill=\"none\" stroke=\"#11191a\" stroke-width=\"2.3\"/>"};
Object.assign(UNIT_SYMBOLS,{commander:{name:'معسكر القيادة',shape:commandArt},jammer:{name:'عربة التشويش',shape:jammerArt}});
function symbol(parent,kind,size=1){const g=el('g',{class:'unit-silhouette',transform:`scale(${size})`},parent);g.innerHTML=campaignArt(kind)??premiumUnitArt(kind)??rebelInfantryArtwork(kind)??supportArtwork(kind)??unitArtwork(kind,UNIT_SYMBOLS[kind].shape);return g}
function armorDetails(parent,modelId){
 const g=el('g',{class:`armor-detail armor-detail-${modelId}`},parent);
 const add=(tag,attrs)=>el(tag,attrs,g);
 if(modelId==='abrams'){
  add('path',{d:'M-53 5H49M-48 7V14M-27 7V14M-5 7V14M17 7V14M39 7V14M-30-20L-23-31H18L27-23M-6-30V-37H3V-30M8-31L18-37L22-31'});
 }else if(modelId==='t90m'){
  add('path',{d:'M-44 4H46M-38 7V14M-16 7V14M6 7V14M28 7V14M-24-16Q-20-31-4-32H14Q25-29 28-17M-20-27L-14-33L-8-28M-2-29L4-35L10-29M13-27L19-32L24-25'});
 }else if(modelId==='type99a'){
  add('path',{d:'M-49 3H50M-40 7V14M-18 7V14M4 7V14M26 7V14M-29-17L-18-31L8-36L28-25M-1-36L3-43L8-37M28-25L36-29L42-23'});
 }else if(modelId==='bradley'){
  add('path',{d:'M-55 5H48M-48 8V15M-27 8V15M-6 8V15M15 8V15M36 8V15M-34-26V-35H-8L-2-27M-19-36L-15-41L-7-40M-5-31L38-37'});
 }else if(modelId==='bmp3'){
  add('path',{d:'M-49 5H49M-42 8V15M-20 8V15M2 8V15M24 8V15M-16-18Q-13-30 1-31H15Q26-29 29-18M-4-31V-37H4V-31M17-30L22-35L28-31M21-25L61-30'});
 }else if(modelId==='zbd04'){
  add('path',{d:'M-52 5H51M-44 8V15M-22 8V15M0 8V15M22 8V15M42 8V15M-34-25L-28-36L-8-38M-12-24V-34Q-9-42 4-42H15Q25-40 27-32M0-42V-47H9V-42M23-34L46-39'});
 }
}
let currentUnitScale=1;
function groundShot(attacker,target,damage){
 const weapon=groundWeapon(attacker);if(!weapon)return Promise.resolve(false);
 const shotBattle=battle,sign=centers[target.y][target.x].x>=centers[attacker.y][attacker.x].x?1:-1;
 const center=u=>{const c=centers[u.y][u.x],g=!!u.garrisonedIn||u.role!=='supplyTruck'&&battle.sites.some(s=>s.x===u.x&&s.y===u.y);return{x:c.x+(g?115:0),y:c.y-(g?90:0)}};
 const start=groundSocket(attacker,center(attacker),currentUnitScale,sign),end=center(target);end.y-=13*currentUnitScale;
 const card=groups.units.querySelector(`[data-unit-id="${attacker.id}"]`),art=card?.querySelector('.unit-silhouette'),detail=card?.querySelector('.armor-detail'),victim=groups.units.querySelector(`[data-unit-id="${target.id}"] .unit-silhouette`),victimTransform=victim?.getAttribute('transform')||'';
 const size=attacker.modelId?1.12:1.24,base=`scale(${sign*size} ${size})`;
 if(art)art.setAttribute('transform',base);if(detail)detail.setAttribute('transform',`scale(${sign} 1)`);
 const protectedTarget=target.role==='antiAir'||target.kind==='antiAir';
 return groundFireFX(groups.effects,start,end,{weapon,damage,armored:!!target.modelId,vehicle:!!target.modelId||['supplyTruck','droneVehicle'].includes(target.role),destroyed:target.strength<=0,valid:()=>battle===shotBattle,
 onRecoil:r=>{if(art?.isConnected)art.setAttribute('transform',`translate(${-sign*r} 0) ${base}`);if(detail?.isConnected)detail.setAttribute('transform',`translate(${-sign*r} 0) scale(${sign} 1)`);},
 onReaction:r=>{if(!protectedTarget&&victim?.isConnected)victim.setAttribute('transform',`translate(${sign*r} ${r*.35}) ${victimTransform}`);}
 });
}

function cityHall(g,radius){
 const scale=radius>=3?1:.82,w=96*scale,h=62*scale,x=0,y=-5,front=y-h*.34,roofTop=front-24*scale,depth=14*scale;
 el('ellipse',{cx:x+5,cy:y+h*.48,rx:w*.66,ry:h*.2,class:'city-core-shadow'},g);
 el('path',{d:`M${x-w/2} ${front}H${x+w/2}V${y+h/2}H${x-w/2}Z`,class:'city-core-front'},g);
 el('path',{d:`M${x+w/2} ${front}L${x+w/2+depth} ${roofTop+depth*.25}V${y+h/2-depth*.25}L${x+w/2} ${y+h/2}Z`,class:'city-core-side'},g);
 el('path',{d:`M${x-w/2-7*scale} ${front}L${x} ${roofTop-8*scale}L${x+w/2+7*scale} ${front}Z`,class:'city-core-roof'},g);
 el('path',{d:`M${x-w*.38} ${front+5*scale}H${x+w*.38}`,class:'city-core-eave'},g);
 for(const col of [-.27,-.09,.09,.27])el('path',{d:`M${x+w*col} ${front+8*scale}V${y+h*.42}`,class:'city-core-column'},g);
 el('rect',{x:x-w*.08,y:y+h*.2,width:w*.16,height:h*.3,rx:2*scale,class:'city-core-door'},g);
 el('path',{d:`M${x-w*.18} ${roofTop-5*scale}Q${x} ${roofTop-31*scale} ${x+w*.18} ${roofTop-5*scale}Z`,class:'city-core-dome'},g);
 el('path',{d:`M${x} ${roofTop-29*scale}V${roofTop-39*scale}`,class:'city-core-spire'},g);
}
function marketHall(g,x,y,radius){
 const scale=radius>=3?1:.85,w=76*scale,h=48*scale,front=y-h*.25,depth=12*scale;
 el('ellipse',{cx:x+3,cy:y+h*.42,rx:w*.62,ry:h*.2,class:'city-core-shadow'},g);
 el('path',{d:`M${x-w/2} ${front}H${x+w/2}V${y+h/2}H${x-w/2}Z`,class:'market-front'},g);
 el('path',{d:`M${x+w/2} ${front}L${x+w/2+depth} ${front-depth*.45}V${y+h/2-depth*.3}L${x+w/2} ${y+h/2}Z`,class:'city-core-side'},g);
 el('path',{d:`M${x-w/2-5*scale} ${front}L${x-w*.24} ${front-18*scale}H${x+w*.3}L${x+w/2+5*scale} ${front}Z`,class:'market-roof'},g);
 for(const door of [-.28,0,.28])el('rect',{x:x+w*door-w*.08,y:y+h*.12,width:w*.16,height:h*.38,rx:2,class:'market-opening'},g);
 el('path',{d:`M${x-w*.4} ${front+4}H${x+w*.4}`,class:'market-awning'},g);
}

function drawTerrain(){
 for(let y=0;y<GRID.rows;y++)for(let x=0;x<GRID.columns;x++){
  const cell=el('polygon',{points:hexPolygon(x,y).map(p=>p.join(',')).join(' '),class:'territory','data-x':x,'data-y':y,'data-terrain':terrainAt(x,y).type},groups.territory);
  territoryNodes[y*GRID.columns+x]=cell;el('title',{},cell).textContent=terrainDescription(x,y);cell.addEventListener('click',()=>onCellClick(x,y));
 }
 drawMountains();
 const river=RIVER_POINTS;
 el('path',{d:river.map((p,i)=>`${i?'L':'M'}${p[0]} ${p[1]}`).join(' '),class:'river'},groups.terrain);
 const roads=ROAD_LINES.map(line=>line.map((p,i)=>`${i?'L':'M'}${p[0]} ${p[1]}`).join(' '));
 for(const d of roads)el('path',{d,class:'road'},groups.terrain);
 for(const[label,x,y]of[['أوران',1400,3200],['مناطق التمرد',7700,4100]])el('text',{x,y,'text-anchor':'middle',class:'region-label'},groups.terrain).textContent=label;
 drawCities();
}


function drawMountains(){drawMountainTerrain(el,groups.terrain,hexPolygon);}
function cityStreetLamp(parent,x,y){
 const lamp=el('g',{transform:`translate(${x} ${y})`,'aria-hidden':'true','pointer-events':'none'},parent);
 el('path',{d:'M0 1V-25Q0-30 5-30H13',fill:'none',stroke:'#34494a','stroke-width':3,'stroke-linecap':'round'},lamp);
 el('path',{d:'M8-34H18L16-29H8Z',fill:'#d7c590',stroke:'#3a4d4c','stroke-width':2,'stroke-linejoin':'round'},lamp);
 el('ellipse',{cx:0,cy:2,rx:4,ry:2,fill:'#34494a'},lamp);
}

/* CITY_OBJECT_REGISTRY_UI_V1 */
function drawCities(){
 groups.sites.replaceChildren();
 for(const site of battle.sites){
  const p=centers[site.y][site.x],size=site.radius>=3?'metro':site.radius===2?'town':'village';
  const g=el('g',{class:`site-marker ${site.owner}-owned urban-${size}`,'data-site':site.id,transform:`translate(${p.x} ${p.y})`},groups.sites);site.node=g;
  const tiles=site.tiles??[{x:site.x,y:site.y}],rows=new Map(),roads=[],street=el('path',{class:'urban-street'},g);site.structureTiles=[];const addStructureTile=tile=>{if(!site.structureTiles.some(item=>item.x===tile.x&&item.y===tile.y))site.structureTiles.push({x:tile.x,y:tile.y})};
  const marketTile=site.radius>=3?(tiles.find(t=>t.x===site.x+1&&t.y===site.y)||tiles.find(t=>t.x===site.x-1&&t.y===site.y)):null;
  const factoryTile=site.radius>=3?tiles.filter(t=>!(t.x===site.x&&t.y===site.y)&&!(marketTile&&t.x===marketTile.x&&t.y===marketTile.y)).sort((a,b)=>hexDistance(site,b)-hexDistance(site,a)||((a.x*13+a.y*7)-(b.x*13+b.y*7)))[0]:null;
  g.dataset.cityStyle='tactical';
  for(const tile of tiles){
   const tp=centers[tile.y][tile.x],dx=tp.x-p.x,dy=tp.y-p.y;
   const row=rows.get(tile.y)??[];row.push(tile);rows.set(tile.y,row);
   const code=(tile.x*7+tile.y*11+site.priority)%10;
   const center=tile.x===site.x&&tile.y===site.y;
   const density=site.radius>=2?10:4;
   if(center&&site.radius===1){addStructureTile(tile);citySymbol(g,site,tile,'house',art=>house(art,0,0,70,43,true,0))}
   else if(!center&&!(marketTile&&marketTile.x===tile.x&&marketTile.y===tile.y)&&code<density){
    addStructureTile(tile);
    const edge=hexDistance(site,tile)>=site.radius,variant=(tile.x*3+tile.y*5+site.priority)%3;
    const w=(site.radius>=3?102:site.radius===2?92:64)+(code%3-1)*6-(edge?6:0),h=(site.radius>=2?48:38)+(code%3)*4;
    if(factoryTile&&factoryTile.x===tile.x&&factoryTile.y===tile.y)citySymbol(g,site,tile,'urbanFactory',art=>factoryCompound(art,0,0));
    else if(site.radius>=2&&(code===1||code===6))citySymbol(g,site,tile,'apartment',art=>apartmentBlock(art,0,0,site.radius>=3?72:66,site.radius>=3?90:80,3));
    else if(site.radius>=2&&code===3)citySymbol(g,site,tile,'shops',art=>{art.innerHTML=cityVariation('shops')});
    else if(site.radius>=2&&code===8&&tile.x%3===0)citySymbol(g,site,tile,'school',art=>{art.innerHTML=cityVariation('school')});
    else if(site.radius>=2&&code===4)citySymbol(g,site,tile,'courtyard',art=>{art.innerHTML=cityVariation('courtyard')});
    else citySymbol(g,site,tile,'house',art=>house(art,0,0,w,h,false,variant));
   }
  }
  const spine=[];for(const [y,row] of [...rows.entries()].sort((a,b)=>a[0]-b[0])){const tile=row.reduce((best,t)=>Math.abs(t.x-site.x)<Math.abs(best.x-site.x)?t:best,row[0]),point=centers[y][tile.x];spine.push(`${spine.length?'L':'M'}${point.x-p.x} ${point.y-p.y}`)}if(spine.length>1)roads.push(spine.join(' '));
  if(roads.length)street.setAttribute('d',roads.join(' '));else street.remove();
  if(site.radius>=2){addStructureTile({x:site.x,y:site.y});citySymbol(g,site,{x:site.x,y:site.y},'cityHall',art=>cityHall(art,site.radius))}
  if(marketTile){addStructureTile(marketTile);citySymbol(g,site,marketTile,'market',art=>marketHall(art,0,0,site.radius))}
  if(site.id===OBJECTIVE.id){el('path',{d:'M0-18V-119M1-117H64L48-96H1',class:'command-flag'},g)}
  const control=urbanControl(battle,site.id),labelY=Math.min(...tiles.map(t=>centers[t.y][t.x].y-p.y))-140;
  const label=el('g',{class:'city-label-group'},g),labelWidth=Math.max(148,site.name.length*24);
  el('rect',{x:-labelWidth/2,y:labelY,width:labelWidth,height:40,rx:7,class:'city-name-plaque'},label);
  el('text',{x:0,y:labelY+28,'text-anchor':'middle',class:'site-name'},label).textContent=site.name;
  el('text',{x:0,y:labelY-12,'text-anchor':'middle',class:'site-type'},label).textContent=`${site.id===OBJECTIVE.id?'★ مركز القيادة · ':''}${size==='metro'?'مدينة كبرى':size==='town'?'مدينة':'قرية'} · ${control.blue}/${control.total}`;
  for(const tile of tiles){const hasBuilding=site.structureTiles.some(item=>item.x===tile.x&&item.y===tile.y),hit=el('polygon',{points:hexPolygon(tile.x,tile.y).map(q=>`${q[0]-p.x},${q[1]-p.y}`).join(' '),class:hasBuilding?'urban-hit urban-building-hitbox':'urban-hit','data-building-x':hasBuilding?tile.x:null,'data-building-y':hasBuilding?tile.y:null},g);hit.addEventListener('click',e=>{e.stopPropagation();if(!onCellClick(tile.x,tile.y)){const current=urbanControl(battle,site.id);setHint(`${site.name} · ${site.owner==='blue'?'قواتك':'المتمردون'} · سيطرة قواتك ${current.blue} من ${current.total} خلايا${site.contested?' · قتال داخل المدينة':''}`)}})}
  refreshCitySymbols(site);
  g.addEventListener('click',()=>{const current=urbanControl(battle,site.id);setHint(`${site.name} · ${site.owner==='blue'?'قواتك':'المتمردون'} · ${current.blue} من ${current.total} خلايا تحت سيطرة قواتك${site.contested?' · المدينة متنازع عليها':''}`)});
 }
}

// AIR_BATTLE_CITY_SYMBOLS_V2 — display offsets never change tactical cell coordinates.
function citySymbol(parent,site,tile,type,paint){
 const p=centers[site.y][site.x],c=centers[tile.y][tile.x],seed=(tile.x*31+tile.y*17+site.priority*7)>>>0;
 const center=tile.x===site.x&&tile.y===site.y;
 const fixed=center||type==='urbanFactory';
 const ox=fixed?0:(tile.x%2?-16:16)+(seed%5-2),oy=fixed?0:((Math.floor(tile.x/2)+site.priority)%3-1)*10+((seed>>>3)%3-1)*3;
 const tones=[['#cbbda4','#a39279','#718581','#96a49a'],['#bbc1b4','#909c92','#697e86','#90a0a3'],['#c2ad93','#99836c','#967662','#b59678']];
 const tone=tones[seed%7===0?2:(Math.floor(tile.x/2)+Math.floor(tile.y/2)+site.priority)%2];
 const group=el('g',{class:'city-object',transform:`translate(${c.x-p.x+ox} ${c.y-p.y+oy})`,'data-cell-x':tile.x,'data-cell-y':tile.y,'data-object-type':type,style:`--city-wall:${tone[0]};--city-side:${tone[1]};--city-roof:${tone[2]};--city-roof-light:${tone[3]};`,'pointer-events':'none'},parent);
 const title=el('title',{},group);title.textContent=type;
 const standing=el('g',{class:'city-standing'},group);paint(standing);
 el('path',{d:'M-20-12l7 9-5 9 10 12M24-9l-7 12 8 9',class:'city-damage-cracks'},standing);
 return group;
}
function cityRubble(group){
 const rubble=el('g',{class:'city-rubble'},group);rubble.innerHTML=ruinArtwork(group.dataset.objectType,Number(group.dataset.cellX)+Number(group.dataset.cellY));
}
function cityGarrisonMark(group){
 const shield=el('g',{class:'city-garrison-mark',transform:'translate(46 -42)'},group);
 el('path',{d:'M-10-12H10V1Q8 10 0 14Q-8 10-10 1Z'},shield);
 el('path',{d:'M-5-2l4 5 7-9',class:'city-garrison-check'},shield);
}
function refreshCitySymbols(site){
 for(const group of site.node.querySelectorAll('.city-object')){
  const x=Number(group.dataset.cellX),y=Number(group.dataset.cellY),key=x+','+y;
  const registered=typeof mapObjectAt==='function'?mapObjectAt(battle,x,y,'building'):null;
  const legacy=site.buildingIntegrity?.[key];
  const hp=Math.max(0,Math.min(registered?.hp??100,legacy?.hp??100,site.structureHp??100));
  const occupied=hp>0&&(registered?.garrisonUnitIds??[]).some(id=>battle.units.some(u=>u.id===id&&u.strength>0&&u.x===x&&u.y===y&&u.garrisonedIn===registered.id));
  if(hp<=0&&!group.querySelector('.city-rubble'))cityRubble(group);
  if(occupied&&!group.querySelector('.city-garrison-mark'))cityGarrisonMark(group);
  group.classList.toggle('is-damaged',hp>0&&hp<100);group.classList.toggle('is-ruined',hp<=0);group.classList.toggle('is-garrisoned',occupied);
  const names={shops:'محال الحي',school:'مدرسة الحي',courtyard:'بيت بفناء',house:'بيت',apartment:'عمارة',cityHall:'مركز المدينة',market:'مبنى تجاري',urbanFactory:'مبنى صناعي'};
  group.querySelector('title').textContent=`${names[group.dataset.objectType]??'مبنى'} · ${site.name} · ${hp<=0?'مدمر':'السلامة '+Math.round(hp)+'٪'}${occupied?' · قوات متحصنة':''}`;
 }
}
function house(g,x,y,w,h,landmark=false,variant=0){
 const left=x-w/2,right=x+w/2,top=y-h/2,bottom=y+h/2,dx=13,dy=10;
 const style={stroke:'#514f45','stroke-width':2,'stroke-linejoin':'round'};
 el('path',{d:`M${left+2} ${bottom}H${right+dx}l10-5 5 12-${w+18} 1Z`,class:'city-short-shadow'},g);
 el('path',{d:`M${left} ${top}H${right}V${bottom}H${left}Z`,fill:'var(--city-wall)',...style},g);
 // Four explicit corners: the side ends at the same ground baseline as the front.
 el('path',{d:`M${right} ${top}L${right+dx} ${top-dy}V${bottom-dy}L${right} ${bottom}Z`,fill:'var(--city-side)',...style},g);
 if(variant===2||landmark){
  el('path',{d:`M${left-3} ${top+2}L${x-7} ${top-17}L${right+3} ${top+2}Z`,fill:'var(--city-roof)',...style},g);
  el('path',{d:`M${x-7} ${top-17}l${dx} -${dy}L${right+dx+3} ${top-dy+2}L${right+3} ${top+2}Z`,fill:'var(--city-roof-light)',...style},g);
 }else{
  el('path',{d:`M${left-2} ${top}L${left+dx-2} ${top-dy}H${right+dx+2}L${right+2} ${top}Z`,fill:'var(--city-roof)',...style},g);
  el('path',{d:`M${left+3} ${top-1}H${right-3}`,class:'city-roof-edge'},g);
  if(variant===1)el('path',{d:`M${left+12} ${top-6}l7-5h18v6l-7 5h-18Z`,fill:'var(--city-roof-light)',stroke:'#656d62','stroke-width':1.3},g);
 }
 el('rect',{x:x+w*.14,y:bottom-20,width:12,height:20,rx:1,class:'city-symbol-opening'},g);
 for(const offset of [-.30,-.08])el('rect',{x:x+w*offset,y:top+12,width:9,height:10,rx:1,class:'city-symbol-window'},g);
 if(w>80)el('path',{d:`M${left+9} ${bottom-4}h20`,class:'city-wall-detail'},g);
}

function apartmentBlock(g,x,y,w,h,floors){
 const left=x-w/2,right=x+w/2,top=y-h*.57,bottom=y+h*.43,depth=12,lift=9;
 el('path',{d:`M${left} ${bottom-2}H${right+depth}l12 8-${w+10} 4Z`,class:'city-short-shadow'},g);
 el('path',{d:`M${right} ${top}l${depth}-${lift}V${bottom-lift}L${right} ${bottom}Z`,class:'apartment-side'},g);
 el('path',{d:`M${left} ${top}H${right}V${bottom}H${left}Z`,class:'apartment-front'},g);
 el('path',{d:`M${left-2} ${top}l${depth}-${lift}H${right+depth+2}l-${depth} ${lift}Z`,class:'apartment-roof'},g);
 for(let row=0;row<floors;row++)for(let col=0;col<3;col++)el('rect',{x:left+11+col*(w-27)/2,y:top+12+row*(h-30)/floors,width:8,height:10,rx:1,class:'city-symbol-window'},g);
 el('rect',{x:x+6,y:bottom-17,width:11,height:17,rx:1,class:'city-symbol-opening'},g);
 el('path',{d:`M${left+4} ${top+4}H${right-4}`,class:'city-roof-edge'},g);
}
function factoryCompound(g,x,y){
 const w=132,h=68,roofY=y-h*.27,frontY=y+h*.38,depth=18;
 el('ellipse',{cx:x+8,cy:frontY+8,rx:w*.62,ry:13,class:'factory-shadow'},g);
 el('path',{d:'M'+(x-w/2)+' '+roofY+'L'+(x-w*.22)+' '+(roofY-16)+'L'+x+' '+roofY+'L'+(x+w*.22)+' '+(roofY-16)+'L'+(x+w/2)+' '+roofY+'V'+frontY+'H'+(x-w/2)+'Z',class:'factory-front'},g);
 el('path',{d:'M'+(x+w/2)+' '+roofY+'L'+(x+w/2+depth)+' '+(roofY-11)+'V'+(frontY-9)+'L'+(x+w/2)+' '+frontY+'Z',class:'factory-side'},g);
 for(let i=0;i<3;i++)el('rect',{x:x-w*.38+i*w*.26,y:y+4,width:w*.15,height:15,rx:1,class:'factory-window'},g);
 for(const [cx,top,bw] of [[x-w*.29,roofY-53,12],[x+w*.31,roofY-42,11]]){el('path',{d:'M'+(cx-bw/2)+' '+(roofY+1)+'V'+(top+5)+'H'+(cx+bw/2)+'V'+(roofY+1)+'Z',class:'factory-stack'},g);el('path',{d:'M'+(cx-bw*.75)+' '+(top+5)+'H'+(cx+bw*.75),class:'factory-stack-cap'},g)}
}
function drawFrontline(){
 const edges=new Map();
 for(let y=0;y<GRID.rows;y++)for(let x=0;x<GRID.columns;x++){
  const ps=hexPolygon(x,y),owner=cityOwnerAt(x,y);
  for(let i=0;i<6;i++){const a=ps[i],b=ps[(i+1)%6],k=[a.map(n=>n.toFixed(3)).join(','),b.map(n=>n.toFixed(3)).join(',')].sort().join('|');const prev=edges.get(k);if(prev){prev.border=prev.owner!==owner}else edges.set(k,{a,b,owner,border:false})}
 }
 groups.frontline.replaceChildren();
 const d=[...edges.values()].filter(e=>e.border).map(e=>`M${e.a.join(' ')}L${e.b.join(' ')}`).join(' ');
 el('path',{d,class:'frontline-path'},groups.frontline);
}
function refreshTerritory(){
 for(const cell of groups.territory.children){const x=+cell.dataset.x,y=+cell.dataset.y;cell.setAttribute('class',`territory ${ownerFill(cityOwnerAt(x,y))}`)}
 for(const site of battle.sites){site.node.setAttribute('class',`site-marker ${site.owner}-owned${site.contested?' contested':''}`);const control=urbanControl(battle,site.id);site.node.classList.toggle('structure-damaged',(site.structureHp??100)<100);site.node.classList.toggle('structure-destroyed',(site.structureHp??100)<=0);for(const hit of site.node.querySelectorAll('.urban-building-hitbox')){const x=+hit.dataset.buildingX,y=+hit.dataset.buildingY,obj=mapObjectAt(battle,x,y,'building'),hp=obj?.hp??100;hit.classList.toggle('building-damaged',hp<100);hit.classList.toggle('building-destroyed',hp<=0);hit.classList.toggle('building-garrisoned',!!obj?.garrisonUnitIds?.some(id=>battle.units.some(u=>u.id===id&&isUnitDetected(battle,u,'blue'))));hit.dataset.buildingType=obj?.type??'unknown';hit.setAttribute('aria-label',`${obj?.type??'مبنى'} · سلامة ${hp}/100${obj?.garrisonUnitIds?.some(id=>battle.units.some(u=>u.id===id&&isUnitDetected(battle,u,'blue')))?' · بداخله جنود':''}`)}site.node.querySelector('.site-type').textContent=`${site.id===OBJECTIVE.id?'★ مركز القيادة · ':''}${site.radius>=3?'مدينة كبرى':site.radius===2?'مدينة':'قرية'} · ${site.owner==='blue'?'الدولة':'المتمردون'}${site.captureRounds?' · تثبيت '+site.captureRounds+'/2':''}${site.contested?' · متنازع عليها':''}${(site.structureHp??100)<100?' · سلامة المباني '+site.structureHp+'/100':''}`}
 for(const site of battle.sites)refreshCitySymbols(site);
 drawFrontline();
}

function selectUnit(id){if(uiBusy||window.__REBEL_LAB__?.airBusy?.()||battle.phase!=='player')return;activeDroneBaseId=null;droneLaunchActive=false;artilleryTargeting=false;engineeringMode='';selectedId=id;const u=selectedUnit(),p=centers[u.y][u.x];const drone=['droneVehicle','droneOperator'].includes(u.role);document.getElementById('droneCommand').hidden=!drone;document.querySelector('.command-dock').classList.toggle('contextual-active',drone);document.getElementById('airBattleCommand').hidden=true;if(p.x<view.x+100||p.x>view.x+view.w-100||p.y<view.y+100||p.y>view.y+view.h-100){view.x=p.x-view.w/2;view.y=p.y-view.h/2;applyView()}window.rebelMapPlanner?.close();renderAll();if(drone)setHint('اختر تحريك الوحدة أو تخطيط هجوم المسيرات.');else if(['fieldArtillery','mortar','katyusha'].includes(u.role))setHint('اضغط خلية مضيئة للتحرك، أو اضغط عدواً لقصفه مباشرة. زر القصف لاستهداف أرض أو مبنى.');}
function selectedUnit(){return battle.units.find(u=>u.id===selectedId)||null}
function reachableForSelected(){const unit=selectedUnit();return unit?reachableCells(battle,unit.id):[]}

/* AIR_BATTLE_UNIT_TECH_COPY_V1 */
function isDroneCombatSource(unit){return unit?.side==='blue'&&unit.strength>0&&['droneOperator','droneVehicle'].includes(unit.role)}
function launchDroneFromSelectedUnit(targetId){
 const source=selectedUnit();if(!isDroneCombatSource(source)||uiBusy||battle.phase!=='player')return false;
 const preferred=selectedDroneType(),alternatives=Object.keys(DRONE_MODELS).sort((a,b)=>DRONE_MODELS[a].range-DRONE_MODELS[b].range);
 const candidates=[preferred,...alternatives.filter(id=>id!==preferred)];let lastCheck=null;
 for(const typeId of candidates){const check=droneLaunchCheck(battle,{sourceId:source.id,targetId,typeId,side:'blue'});if(check.ok){document.getElementById('droneType').value=typeId;renderAll();setHint(`إطلاق ${check.model.name} من ${unitLabel(source)} نحو ${unitLabel(check.target)} · ${check.distance}/${check.range} خلايا.`);void performDroneLaunch(targetId,'blue',{sourceId:source.id,point:source});return true}lastCheck??=check}
 if(lastCheck?.reason)setHint(lastCheck.reason);return true;
}

async function performSupportFire(unit,x,y){
 if(getArmisticeState(battle).active){setHint('القصف المدفعي متوقف أثناء الهدنة.');return;}if(uiBusy)return;const check=canFireArtillery(battle,unit.id,x,y,'blue');if(!check.ok){setHint(check.reason);return;}uiBusy=true;renderAll();const snapshot=battle;
 try{await supportBarrage(groups.effects,centers[unit.y][unit.x],centers[y][x],unit.role,centers);if(snapshot!==battle)return;
 const result=fireArtillery(battle,unit.id,x,y,'blue');if(result.ok){for(const hit of result.impacts)if(!hit.unit||isUnitDetected(battle,hit.unit,'blue'))supportImpact(groups.effects,centers[hit.y][hit.x],{size:.45,label:'−'+hit.damage});setHint('اكتمل القصف؛ استُهلكت ذخيرة رشقة واحدة.')}else setHint(result.reason);
 }catch(error){recoverAction(error);}finally{uiBusy=false;artilleryTargeting=false;renderAll();}
}
function quickSupportTarget(x,y){if(getArmisticeState(battle).active){setHint('القصف المدفعي متوقف أثناء الهدنة.');return true;}if(uiBusy||battle.phase!=='player'||window.__REBEL_LAB__?.airBusy?.())return false;const u=selectedUnit();if(!u||!['fieldArtillery','mortar','katyusha'].includes(u.role))return false;const check=canFireArtillery(battle,u.id,x,y,'blue');if(!check.ok){setHint(check.reason);return true;}artilleryTargeting=false;void performSupportFire(u,x,y);return true;}
function onCellClick(x,y){if(uiBusy||window.__REBEL_LAB__?.airBusy?.()||battle.phase!=='player')return false;
 if(droneLaunchActive){const site=battle.sites.find(s=>s.structureTiles?.some(t=>t.x===x&&t.y===y));void performDroneLaunch(site?'site-tile:'+site.id+':'+x+':'+y:'cell:'+x+':'+y);return true;}
  if(uiBusy)return false;
  if(skipClick){skipClick=false;return}
  const unit=selectedUnit();
  if(artilleryTargeting&&unit?.side==='blue'){
    const check=canFireArtillery(battle,unit.id,x,y,'blue');
    if(!check.ok){setHint(check.reason);return true}
    artilleryTargeting=false;void performSupportFire(unit,x,y);return true;
  }
  if(engineeringMode&&unit?.kind==='engineer'){
    const mode=engineeringMode,ok=mode==='mine'?plantFieldMine(battle,unit.id,x,y):clearFieldMine(battle,unit.id,x,y);
    if(ok){engineeringMode='';renderAll();setHint(mode==='mine'?'زُرع حقل ألغام.':'أُزيل اللغم المعادي.');}
    else setHint('هذه الخلية غير صالحة لهذا الأمر الهندسي.');
    return true;
  }
  const sourceSelect=document.getElementById('droneSourceSelect'),selectedSourceValue=activeDroneBaseId?'base:'+activeDroneBaseId:unit&&['droneOperator','droneVehicle'].includes(unit.role)?'unit:'+unit.id:'';
  sourceSelect.replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='١ · مصدر الإطلاق';sourceSelect.append(placeholder);
  for(const sourceUnit of battle.units.filter(u=>u.side==='blue'&&['droneOperator','droneVehicle'].includes(u.role))){const option=document.createElement('option');option.value='unit:'+sourceUnit.id;const roleName=sourceUnit.role==='droneOperator'?'فريق المشغّلين':'مركبة الإطلاق';option.textContent=`${roleName} · ${sourceUnit.droneStock}/${sourceUnit.maxDroneStock}${sourceUnit.strength<=0?' · خرج من المعركة':sourceUnit.droneStock<=0?' · نفدت المسيرات':droneAllowance(battle,sourceUnit)<=0?' · أطلق في هذه الجولة':''}`;option.disabled=sourceUnit.strength<=0||sourceUnit.droneStock<=0||droneAllowance(battle,sourceUnit)<=0;sourceSelect.append(option)}
  for(const base of battle.droneBases.filter(b=>b.side==='blue'&&b.industryRole!=='factory')){const option=document.createElement('option');option.value='base:'+base.id;const stock=Object.values(base.stock).reduce((sum,n)=>sum+n,0);option.textContent=`قاعدة المسيرات · ${stock} متبقية${(base.launchTurn===battle.turn&&(base.launchUsed||0)>=4)?' · أكملت إطلاقها':''}`;option.disabled=stock<=0||(base.launchTurn===battle.turn&&(base.launchUsed||0)>=4);sourceSelect.append(option)}
  sourceSelect.value=selectedSourceValue;sourceSelect.disabled=uiBusy||battle.finished||battle.phase!=='player';
  const occupant=battle.units.find(u=>u.x===x&&u.y===y&&u.strength>0&&isUnitDetected(battle,u,'blue'));
  const droneTargetSite=battle.sites.find(s=>s.tiles.some(t=>t.x===x&&t.y===y));if(droneLaunchActive&&droneTargetSite&&droneTargetSite.owner!=='blue'){const hasBuilding=droneTargetSite.structureTiles?.some(tile=>tile.x===x&&tile.y===y);if(!hasBuilding){setHint('هذه الخلية ما بيها مبنى قابل للاستهداف؛ اضغط على مبنى ظاهر داخل المدينة.');return true}void performDroneLaunch('site-tile:'+droneTargetSite.id+':'+x+':'+y);return true}
  if(droneLaunchActive&&occupant?.side==='red'){void performDroneLaunch(occupant.id);return true}
  if(occupant?.side==='red'&&quickSupportTarget(x,y))return true;
  if(occupant?.side==='red'&&isDroneCombatSource(unit)){setHint('اختر تخطيط هجوم المسيرات ثم حدد الهدف.');return true;}
  if(unit&&unit.side==='blue'&&!unit.moved&&!unit.attacked){const destination=reachableCells(battle,unit.id).find(c=>c.x===x&&c.y===y);if(destination){void performMove(unit.id,x,y,destination.path);return true}}
  if(occupant?.side==='blue'){selectUnit(occupant.id);return true}
  if(occupant?.side==='red'&&unit){if(attackApproaches(battle,unit.id,occupant.id).length){void performAttack(unit.id,occupant.id);return true}setHint('هذا التشكيل خارج مدى الحركة والهجوم أو أن الفصيل أكمل هجومه.');return}
  if(unit&&unit.side==='blue'&&!unit.moved)setHint('هذه الخلية خارج مدى الفصيل في هذه الجولة. اختر خلية مضيئة.')
  const site=battle.sites.find(s=>s.tiles.some(t=>t.x===x&&t.y===y));if(site){const c=urbanControl(battle,site.id);setHint(`${site.name} · ${site.owner==='blue'?'قواتك':'المتمردون'} · قواتك تسيطر على ${c.blue} من ${c.total} خلايا${site.contested?' · متنازع عليها':''}`)}
  return false;
}

function renderUnits(){
 groups.units.replaceChildren();
 const drawOrder=battle.units.filter(unit=>(unit.strength>0||visualMove?.unitId===unit.id)&&isUnitDetected(battle,unit,'blue')).slice().sort((a,b)=>{
  const layer=unit=>unit.side==='blue'&&unit.id===selectedId?2:unit.side==='blue'?1:0;
  return layer(a)-layer(b);
 });
 const selectable=selectedUnit();const highlightCells=battle.phase==='player'&&!uiBusy&&selectable?reachableCells(battle,selectable.id):[];
 for(const unit of drawOrder){
 const mapCenter=centers[unit.y][unit.x];const center=visualMove?.unitId===unit.id?{x:visualMove.from.x+(visualMove.to.x-visualMove.from.x)*visualMove.t,y:visualMove.from.y+(visualMove.to.y-visualMove.from.y)*visualMove.t}:mapCenter,garrison=!!unit.garrisonedIn||unit.role!=='supplyTruck'&&battle.sites.some(site=>site.x===unit.x&&site.y===unit.y),p={x:center.x+(garrison?115:0),y:center.y-(garrison?90:0)},kind=unit.role==='supplyTruck'?'supplyTruck':UNIT_SYMBOLS[unit.modelId??unit.kind]?(unit.modelId??unit.kind):'infantry',pending=unit.role!=='supplyTruck'&&unit.side==='blue'&&!unit.moved&&!unit.attacked,onMountain=isMountainAt(unit.x,unit.y);
 const detail=unit.role==='antiAir'?`${unitLabel(unit)} · ${unit.side==='blue'?'قواتك':'المتمردون'} · صواريخ كتفية ${unit.antiDroneAmmo}/${unit.maxAntiDroneAmmo} · مدى الاعتراض ${unit.antiDroneRange} خلية`:unit.role==='droneOperator'||unit.role==='droneVehicle'?`${unitLabel(unit)} · ${unit.side==='blue'?'قواتك':'المتمردون'} · الصحة ${unit.hp}/${unit.maxHp} · المسيرات ${unit.droneStock}/${unit.maxDroneStock} · مدى المصدر ${unit.launchRange}`:unit.role==='supplyTruck'?`${unitLabel(unit)} · ${unit.side==='blue'?'قواتك':'المتمردون'} · صحة ${unit.hp}/${unit.maxHp} · متجهة إلى ${unit.supplyTargetId??'القوات الميدانية'}`:unit.modelId?`${unitLabel(unit)} · ${unit.side==='blue'?'قواتك':'المتمردون'} · صحة ${unit.hp}/${unit.maxHp} · ${unit.strength}/${unit.maxStrength} آليات · حركة ${unit.movement} · مدى ${unitAttackRange(unit)}`:`${unitLabel(unit)} ${unit.side==='blue'?'قواتك':'المتمردون'} · الفصيل ${unitNo(unit.id)} · صحة ${unit.hp}/${unit.maxHp} · ${unit.strength} أفراد${unit.hidden?' · كمين غير مكشوف':''}${onMountain?' · على جبل':''}`;
 const attackable=battle.phase==='player'&&!uiBusy&&selectedId!==unit.id&&unit.side==='red'&&highlightCells.some(c=>hexDistance(c,unit)<=unitAttackRange(selectable,c.x,c.y));
 const outer=el('g',{class:`squad-unit ${unit.side}${unit.id===selectedId?' selected':''}${attackable?' attack-target':''}${unit.hitFlash?' hit-flash':''}${unit.id===actingEnemyId?' acting-enemy':''}${unit.hidden?' ambushed':''}${onMountain?' mountain-posted':''}${unit.modelId?' armored unit-'+unit.modelId:''}${unit.role==='supplyTruck'?' supply-truck':''}${unit.role==='droneOperator'?' drone-operator':''}${unit.role==='droneVehicle'?' drone-vehicle':''}${unit.role==='antiAir'?' manpads-unit':''}`,transform:`translate(${p.x} ${p.y})`,'data-unit-id':unit.id,role:'button',tabindex:0,'aria-label':detail},groups.units);
 const g=el('g',{class:'squad-art'},outer);
 el('rect',{x:-82,y:-68,width:164,height:137,rx:12,class:'unit-frame'},g);decorateUnitCard(g,kind,el);symbol(g,unit.weaponId==='kornet'?'kornet':kind,unit.role==='supplyTruck'?1.14:unit.modelId?1.12:1.24);if(unit.modelId)armorDetails(g,unit.modelId);
 decorateIdentity(g,unit,el,true);
 el('rect',{x:-71,y:74,width:142,height:34,rx:6,class:'unit-caption'},g);
 el('text',{x:0,y:98,'text-anchor':'middle',class:'squad-number',direction:'ltr'},g).textContent=unit.role==='antiAir'?`م/ط ${unit.antiDroneAmmo}/${unit.maxAntiDroneAmmo}`:unit.role==='droneOperator'||unit.role==='droneVehicle'?`مسيرات ${unit.droneStock} · جولة ${droneAllowance(battle,unit)}`:unit.role==='supplyTruck'?(unit.droneCargo?'مسيرات '+unit.droneCargo:'إمداد'):unit.modelId?`${ARMOR_MODELS[unit.modelId].tag} · ${unit.strength}/${unit.maxStrength}`:`${unitNo(unit.id)}  |  ${unit.strength}/${unit.maxStrength??6}`;
 const healthRatio=Math.max(0,Math.min(1,unit.hp/Math.max(1,unit.maxHp))),healthTone=healthRatio>.62?'healthy':healthRatio>.3?'wounded':'critical';
 el('rect',{x:-58,y:51,width:116,height:9,rx:4.5,class:'unit-health-track'},g);
 el('rect',{x:-56,y:53,width:112*healthRatio,height:5,rx:2.5,class:`unit-health-fill ${healthTone}`},g);
 if(unit.maxAmmo&&unit.ammo/unit.maxAmmo<.3||unit.maxFuel&&unit.fuel/unit.maxFuel<.3){el('circle',{cx:67,cy:45,r:14,class:'unit-supply-warning'},g);el('text',{x:67,y:51,'text-anchor':'middle',class:'unit-supply-warning-text'},g).textContent='!'}if(pending)el('circle',{cx:67,cy:-53,r:13,class:'unit-unmoved-marker'},g);
 if(unit.role==='antiAir')el('text',{x:0,y:-77,'text-anchor':'middle',class:'unit-drone-tag'},g).textContent='مضاد مسيرات';if(unit.role==='droneOperator'||unit.role==='droneVehicle')el('text',{x:0,y:-77,'text-anchor':'middle',class:'unit-drone-tag'},g).textContent=unit.role==='droneOperator'?'فريق مسيرات · ٣':'قاذفة مدرعة · ٧';if(unit.role==='supplyTruck')el('text',{x:0,y:-77,'text-anchor':'middle',class:'unit-truck-tag'},g).textContent=unit.droneCargo?'نقل مسيرات':'قافلة';if(unit.hidden)el('text',{x:0,y:-77,'text-anchor':'middle',class:'unit-ambush-tag'},g).textContent='كمين';if(unit.role==='airlift')el('text',{x:0,y:-77,'text-anchor':'middle',class:'unit-airlift-tag'},g).textContent='إنزال جوي';
 if(onMountain&&unit.kind==='sniper')el('path',{d:'M-61-50L-50-61L-39-50L-50-39Z',class:'unit-mountain-marker'},g);
 outer.addEventListener('click',event=>{event.stopPropagation();if(skipClick||uiBusy)return;if(unit.side==='blue'&&(artilleryTargeting||engineeringMode)){selectUnit(unit.id);return}if(artilleryTargeting||engineeringMode){onCellClick(unit.x,unit.y);return}if(droneLaunchActive&&unit.side==='red'){void performDroneLaunch(unit.id);return}if(unit.side==='blue'){activeDroneBaseId=null;droneLaunchActive=false;selectUnit(unit.id)}else if(quickSupportTarget(unit.x,unit.y)){return;}else if(isDroneCombatSource(selectedUnit())){setHint('اضغط تخطيط هجوم المسيرات أولاً، ثم اختر الهدف.');}else if(attackApproaches(battle,selectedId,unit.id).length){void performAttack(selectedId,unit.id)}else setHint(`${unitLabel(unit)} المتمردون · الصحة ${unit.hp}/${unit.maxHp} · القوة ${unit.strength}/${unit.maxStrength} · ${unit.morale}% معنويات · خارج مدى الهجوم`)});
 outer.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();if(unit.side==='blue')selectUnit(unit.id)}});
 }
 scaleSymbols();
}
function scaleSymbols(){
 const rect=svg.getBoundingClientRect(),scale=Math.min(rect.width/view.w,rect.height/view.h);
 const unitScale=Math.max(.88,Math.min(1.08,30/(164*Math.max(.01,scale))));
 currentUnitScale=unitScale;
 for(const art of groups.units.querySelectorAll('.squad-art'))art.setAttribute('transform',`scale(${unitScale})`);
}

/* DRONE_STRIKEABLE_LOGISTICS_20261009 */
function renderLogistics(){
 groups.logistics.replaceChildren();
 for(const depot of battle.logistics.depots){const c=centers[depot.y][depot.x],g=el('g',{transform:`translate(${c.x} ${c.y})`,class:`supply-depot ${depot.side}${depot.disabled?' disabled':''}${depot.hitFlash?' hit':''}`,role:'button',tabindex:0,'aria-label':depot.side==='blue'?'مركز إمداد قواتك':'مركز إمداد المتمردون'},groups.logistics);g.addEventListener('click',event=>{event.stopPropagation();if(droneLaunchActive&&depot.side!==activeDroneSource()?.point?.side){void performDroneLaunch('depot:'+depot.id);return}setHint((depot.side==='blue'?'مركز إمداد قواتك':'مركز إمداد المتمردون')+' · صحة '+(depot.structureHp??100)+'/'+(depot.structureMaxHp??100)+' · ذخيرة '+depot.ammo+' · وقود '+depot.fuel+(depot.disabled?' · مدمر':''))});if(depot.isCave){const rock=el('g',{'pointer-events':'none'},g);rock.innerHTML=caveArtwork(depot.disabled);}el('rect',{x:-54,y:-40,width:108,height:80,rx:12,class:'depot-frame',...(depot.isCave?{fill:'transparent','fill-opacity':0}: {})},g);el('path',{d:'M-34 7V-8L0-29L34-8V7H-27V-1H27V7M-14 7V-9H0V7M13-12H23V-4H13Z',class:'depot-symbol',...(depot.isCave?{display:'none'}:{})},g);el('text',{x:0,y:59,'text-anchor':'middle',class:'depot-label'},g).textContent=depot.isCave?(depot.disabled?'كهف إمداد معطل':depot.name):depot.disabled?'مركز إمداد مدمر':depot.side==='blue'?'مقر الإمداد':'مقر المتمردون';el('text',{x:0,y:-48,'text-anchor':'middle',class:'depot-stock'},g).textContent=`ذ ${Math.floor(depot.ammo)} · و ${Math.floor(depot.fuel)}`}
 // Active trucks are battlefield units and render in the standard square unit layer.
 for(const base of battle.droneBases??[]){const c=centers[base.y][base.x],g=el('g',{transform:`translate(${c.x+88} ${c.y+42})`,'data-drone-base-id':base.id,class:`drone-base ${base.side}${base.disabled?' disabled':''}${base.hitFlash?' hit':''}${base.id===activeDroneBaseId?' selected':''}`,role:'button',tabindex:0,'aria-label':`قاعدة درونات ${base.side==='blue'?'قواتك':'المتمردون'}`},groups.logistics);el('rect',{x:-61,y:-43,width:122,height:82,rx:12,class:'drone-base-frame'},g);const launcher=el('g',{class:'visual-drone-launcher'},g);launcher.innerHTML=base.industryRole==='factory'?droneFactoryArt:launcherArtwork;el('text',{x:0,y:60,'text-anchor':'middle',class:'drone-base-label'},g).textContent=base.industryRole==='factory'?(base.disabled?'مصنع مدمر':base.side==='blue'?'مصنع مسيطر عليه':'مصنع مسيرات'):base.disabled?'منصة مدمرة':base.side==='blue'?'منصة مسيرات':'منصة المتمردين';el('text',{x:0,y:-51,'text-anchor':'middle',class:'drone-base-stock'},g).textContent=base.industryRole==='factory'?`مخزون ${base.stock.standard} · إنتاج ${base.side==='red'&&!base.disabled?base.production:0}/جولة`:`خ ${base.stock.light} · م ${base.stock.standard} · ب ${base.stock.heavy}`;g.addEventListener('click',event=>{event.stopPropagation();if(droneLaunchActive&&base.side!==activeDroneSource()?.point?.side){void performDroneLaunch('baseTarget:'+base.id);return}activeDroneBaseId=base.side==='blue'&&base.industryRole!=='factory'?base.id:null;droneLaunchActive=false;focusPoint(base);renderAll();if(activeDroneBaseId)window.rebelMapPlanner?.choose('base:'+base.id);setHint(base.side==='blue'?'تم اختيار القاعدة كمصدر. اختر نوع المسيرة ثم اضغط «اختيار الهدف».':'قاعدة معادية؛ اخترها بعد تفعيل أمر إطلاق المسيرة.');});}

 for(const defense of (battle.airDefenses || [])){
  const c=centers[defense.y][defense.x];
  const group=el('g',{transform:'translate('+c.x+' '+c.y+')',class:'drone-air-defense '+defense.side+(defense.disabled?' disabled':''),role:'button',tabindex:0,'aria-label':'رادار دفاع جوي '+(defense.side==='red'?'معادٍ':'صديق')},groups.logistics);group.addEventListener('click',event=>{event.stopPropagation();if(droneLaunchActive&&defense.side!==activeDroneSource()?.point?.side){void performDroneLaunch('radar:'+defense.id);return}inspectDefense(defense)});group.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();group.dispatchEvent(new MouseEvent('click',{bubbles:true}))}});
  renderDefenseSymbol(group,defense,el);
 }
}
function renderSupplyPanel(){const logistics=battle.logistics,blue=logistics.depots.find(d=>d.side==='blue'),unit=selectedUnit(),supply=unit?supplyState(battle,unit.id):null,active=logistics.convoys.filter(c=>c.side==='blue').length,queued=logistics.queue.filter(q=>q.side==='blue').length;document.getElementById('supplyStatus').innerHTML=`<div><b>الشهر ${logistics.month}</b><span>مخزون المقر: إعاشة ${Math.floor(blue.rations??0)} · ذخيرة ${Math.floor(blue.ammo)}/${blue.maxAmmo} · وقود ${Math.floor(blue.fuel)}/${blue.maxFuel}</span></div><div><b>${unit?unitLabel(unit)+' · '+unitNo(unit.id):'لا توجد وحدة محددة'}</b><span>${unit?.role==='supplyTruck'?`شاحنة عسكرية · الحمولة إلى ${unit.supplyTargetId}`:supply?`الإعاشة ${Math.ceil(supply.rations)}/${supply.maxRations} · الذخيرة ${Math.ceil(supply.ammo)}/${supply.maxAmmo} · نحو ${supply.volleys} رميات${supply.maxFuel?` · الوقود ${Math.ceil(supply.fuel)}/${supply.maxFuel}`:''}${supply.city?` · تموين المدينة ${supply.cityName}`:''}`:'اختر قوة صديقة ثم أرسل لها قافلة.'}</span></div>`;const toggle=document.getElementById('toggleAutoSupply');toggle.textContent=`الإمداد التلقائي: ${blue.auto?'يعمل':'متوقف'}`;toggle.classList.toggle('active',blue.auto);toggle.disabled=!!blue.disabled;document.getElementById('dispatchSupply').disabled=!unit||unit.role==='supplyTruck'||unit.strength<=0||battle.phase!=='player'||uiBusy;const list=document.getElementById('convoyList');list.textContent=`قوافل قواتك المتحركة: ${active}/10 · طلبات الانتظار: ${queued}${active?` · الأولوية الحالية: ${logistics.convoys.filter(c=>c.side==='blue').map(c=>c.deliveryIds.length>1?`${c.unitId} + ${c.deliveryIds.length-1}`:c.unitId).join('، ')}`:''}`}
async function animateSupplyConvoys(actions){for(const action of actions){let node=groups.units.querySelector(`[data-unit-id="${action.truckId}"]`);if(!node)continue;let from=centers[action.from.y][action.from.x];for(const point of action.path){const to=centers[point.y][point.x],truck=battle.units.find(u=>u.id===action.truckId),seen=!truck||isUnitDetected(battle,{...truck,x:point.x,y:point.y},'blue');node.setAttribute('visibility',seen?'visible':'hidden');for(let frame=1;frame<=7;frame++){if(seen&&truck?.side==='red')followEnemyPoint(to);const t=frame/7;node.setAttribute('transform',`translate(${from.x+(to.x-from.x)*t} ${from.y+(to.y-from.y)*t})`);await wait(95/7)}from=to}}}

function renderOrders(){
  const roster=document.getElementById('unitRoster');roster.replaceChildren();
  for(const unit of battle.units.filter(u=>u.side==='blue')){const b=document.createElement('button');b.type='button';b.className=`roster-unit blue-unit${unit.id===selectedId?' selected':''}${unit.strength<=0?' eliminated':''}${unit.moved||unit.attacked?' acted':''}${unit.role!=='supplyTruck'&&unit.strength>0&&!unit.moved&&!unit.attacked?' pending':''}`;b.textContent=unit.role==='supplyTruck'?'🚚':unit.role==='antiAir'?'م/ط':unit.role==='droneOperator'?'مش':unit.role==='droneVehicle'?'م':unit.modelId?`${ARMOR_MODELS[unit.modelId].tag}${unitNo(unit.id).slice(1)}`:unitNo(unit.id);b.dataset.role=unit.role;b.title=unit.role==='antiAir'?`${unitLabel(unit)} · صواريخ ${unit.antiDroneAmmo}/${unit.maxAntiDroneAmmo} · مدى اعتراض ${unit.antiDroneRange} خلية`:unit.role==='droneOperator'||unit.role==='droneVehicle'?`${unitLabel(unit)} · ${unit.droneStock}/${unit.maxDroneStock} مسيرات · مدى ${unit.launchRange} خلايا · الصحة ${unit.hp}/${unit.maxHp}`:unit.role==='supplyTruck' ?`${unitLabel(unit)} · الصحة ${unit.hp}/${unit.maxHp} · الحمولة إلى ${unit.supplyTargetId}`:unit.modelId?`${ARMOR_MODELS[unit.modelId].name} · الصحة ${unit.hp}/${unit.maxHp} · الآليات ${unit.strength}/${unit.maxStrength} · ذخيرة ${Math.ceil(unit.ammo)}/${unit.maxAmmo} · وقود ${Math.ceil(unit.fuel)}/${unit.maxFuel}`:`الفصيل ${unitNo(unit.id)} · الصحة ${unit.hp}/${unit.maxHp} · الأفراد ${unit.strength}/${unit.maxStrength??6} · الذخيرة ${Math.ceil(unit.ammo)}/${unit.maxAmmo}${unit.hidden?' · كمين':''}`;if(unit.role==='fieldArtillery')b.textContent='مدفعية';else if(unit.role==='katyusha')b.textContent='كاتيوشا';else if(unit.role==='mortar')b.textContent='هاون';else if(unit.role==='antiArmor')b.textContent=unit.weaponId==='kornet'?'كورنيت':'RPG';else if(unit.role==='reconRadar')b.textContent='ر';else if(unit.kind==='engineer')b.textContent='هـ';else if(unit.role==='commander')b.textContent='قيادة';else if(unit.role==='jammer')b.textContent='تشويش';b.addEventListener('click',()=>selectUnit(unit.id));roster.append(b)}
  const unit=selectedUnit();
  document.getElementById('selectedIcon').innerHTML=unit?`<svg viewBox="-65 -60 130 120" class="unit-silhouette">${UNIT_SYMBOLS[unit.role==='supplyTruck'?'supplyTruck':unit.modelId??unit.kind].shape}</svg>`:'—';
  document.getElementById('selectedTitle').textContent=activeDroneBaseId?'قاعدة الدرونات · مصدر ثابت':unit?unit.role==='droneOperator'||unit.role==='droneVehicle'?`${unitLabel(unit)} · ${unit.droneStock}/${unit.maxDroneStock} مسيرات`:unit.role==='supplyTruck'?`${unitLabel(unit)} · قافلة متحركة`:unit.modelId?`${unitLabel(unit)} · ${ARMOR_MODELS[unit.modelId].nation}`:`${unitLabel(unit)} · الفصيل ${unitNo(unit.id)}`:'لا يوجد فصيل';
  const remaining=remainingPlayerActivations(battle);
  const supply=unit?supplyState(battle,unit.id):null,combatInfo=unit?unit.role==='antiAir'?`الصحة ${unit.hp}/${unit.maxHp} · صواريخ كتفية ${unit.antiDroneAmmo}/${unit.maxAntiDroneAmmo} · مدى الاعتراض ${unit.antiDroneRange} خلية · حركة ${unit.movement}`:unit.role==='droneOperator'||unit.role==='droneVehicle'?`الصحة ${unit.hp}/${unit.maxHp} · مسيرات ${unit.droneStock}/${unit.maxDroneStock} · مدى المصدر ${unit.launchRange} · حركة ${unit.movement}`:unit.role==='supplyTruck'?`شاحنة عسكرية · الصحة ${unit.hp}/${unit.maxHp} · الحمولة مخصصة إلى ${unit.supplyTargetId}`:unit.modelId?`الصحة ${unit.hp}/${unit.maxHp} · ${unit.strength}/${unit.maxStrength} آليات · حركة ${unit.movement} · مدى ${unitAttackRange(unit)} · حماية ${Math.round(ARMOR_MODELS[unit.modelId].armor*100)}%`:`الصحة ${unit.hp}/${unit.maxHp} · ${unit.strength}/${unit.maxStrength??6} أفراد · حركة ${unit.movement}${unit.kind==='sniper'?` · مدى الرمي ${unitAttackRange(unit)}${isMountainAt(unit.x,unit.y)?' · قمة جبلية':''}`:''}${unit.hidden?' · كمين غير مكشوف':''}`:'';document.getElementById('selectedInfo').textContent=activeDroneBaseId?`مخزون الأنواع: خفيفة ${battle.droneBases.find(b=>b.id===activeDroneBaseId).stock.light} · متوسطة ${battle.droneBases.find(b=>b.id===activeDroneBaseId).stock.standard} · بعيدة ${battle.droneBases.find(b=>b.id===activeDroneBaseId).stock.heavy}`:unit?`${combatInfo} · إعاشة ${Math.ceil(supply.rations)}/${supply.maxRations}${supply.convoy?' · قافلة: '+(supply.convoy.eta?('نحو '+supply.convoy.eta+' جولات'):'طريق متوقف'):''}${unit.role==='droneOperator'||unit.role==='droneVehicle'?'':` · ذخيرة ${Math.ceil(supply.ammo)}/${supply.maxAmmo}${supply.maxFuel?` · وقود ${Math.ceil(supply.fuel)}/${supply.maxFuel}`:''}${supply.city?` · تموين ${supply.cityName}`:''}`}`:'اختر فصيلاً من الصف';
  if(unit&&armorTier(unit))document.getElementById('selectedInfo').textContent+=' · تصنيف الموديل '+ '★'.repeat(armorTier(unit))+' / 3';
  if(unit&&directWeapon(unit))document.getElementById('selectedInfo').textContent+=unit.reactionTurn===battle.turn?' · استُخدم الرد الدفاعي':' · رد دفاعي متاح';
  if(unit&&['fieldArtillery','katyusha','mortar'].includes(unit.role))document.getElementById('selectedInfo').textContent='الصحة '+unit.hp+'/120 · ذخيرة '+unit.ammo+'/'+unit.maxAmmo+' · قصف من خليتين إلى '+unitAttackRange(unit)+' · حركة '+unit.movement;
  if(unit?.weaponId==='kornet')document.getElementById('selectedInfo').textContent='كورنيت · '+unit.strength+'/3 أفراد · الصحة '+unit.hp+'/66 · '+unit.ammo+'/4 صواريخ · المدى 5 خلايا · الحركة 2 · '+(unit.kornetMovedTurn===battle.turn?'تثبيت المنصة: الرمي بالجولة التالية':unit.lastKornetFireTurn===battle.turn?'استهلك رمية هذه الجولة':unit.ammo<1?'نفدت الصواريخ: اطلب الإمداد':'جاهز: صاروخ واحد للجولة؛ التحرك يؤجل الرمي')+' · ضد الدروع؛ التضاريس تحجب الرؤية';
  else if(unit?.role==='antiArmor')document.getElementById('selectedInfo').textContent='فريق 4 أفراد · صحة '+unit.hp+'/'+unit.maxHp+' · ذخيرة '+unit.ammo+'/'+unit.maxAmmo+' · مدى 3 · فعّال ضد الآليات';
  if(unit?.role==='reconRadar')document.getElementById('selectedInfo').textContent='رادار متحرك · كشف الوحدات المخفية حتى 9 خلايا · لا يهاجم';
  if(unit?.kind==='engineer')document.getElementById('selectedInfo').textContent='مهندس ميدان · شحنات '+(unit.engineerCharges??0)+'/'+(unit.maxEngineerCharges??4)+' · إزالة ألغام وتحصين وصيانة · افتح القيادة والصيانة لإسناد إصلاح';
  document.getElementById('selectedOrder').textContent=unit?.role==='supplyTruck'?'قافلة ذاتية الحركة':(unit?.role==='droneOperator'||unit?.role==='droneVehicle')&&unit?.attacked?'أطلق مسيرة':unit?.hidden?'كمين جاهز':unit?.attacked?'تحرك وهاجم':unit?.order?.regroup?'إعادة تنظيم':unit?.order?.hold?'ثبات':unit?.moved?'تحرك':'جاهز';
  const unavailable=!unit||unit.strength<=0||battle.finished||battle.phase!=='player';
  const source=activeDroneSource(),droneButton=document.getElementById('droneLaunchOrder');droneButton.classList.toggle('active',droneLaunchActive);droneButton.textContent=droneLaunchActive?'إلغاء تحديد الهدف':'اختيار هدف للإطلاق';droneButton.disabled=uiBusy||battle.finished||battle.phase!=='player'||!source||(!source.baseId&&(source.point.strength<=0||droneAllowance(battle,source.point)<=0||source.point.droneStock<=0));
  const typeSelect=document.getElementById('droneType');typeSelect.disabled=uiBusy||battle.finished||battle.phase!=='player';
  const droneModel=DRONE_MODELS[selectedDroneType()],stockValue=activeDroneBaseId?Object.values(battle.droneBases.find(b=>b.id===activeDroneBaseId).stock).reduce((a,n)=>a+n,0):source?.point.droneStock??'—';document.getElementById('droneRangeValue').textContent=String(source?activeDroneRange():droneModel.range);document.getElementById('droneDamageValue').textContent=String(droneModel.damage);document.getElementById('droneStockValue').textContent=String(stockValue);
  for(const cell of groups.territory.children)cell.classList.remove('drone-range');if(droneLaunchActive&&source){const range=activeDroneRange();for(let y=0;y<GRID.rows;y++)for(let x=0;x<GRID.columns;x++)if(hexDistance(source.point,{x,y})>0&&hexDistance(source.point,{x,y})<=range)territoryNodes[y*GRID.columns+x]?.classList.add('drone-range')}

  document.getElementById('holdOrder').disabled=unavailable||uiBusy||unit?.role==='supplyTruck'||!!unit?.moved;
  document.getElementById('ambushOrder').disabled=unavailable||uiBusy||!unit||unit.role==='supplyTruck'||unit.role==='droneOperator'||unit.role==='droneVehicle'||!canAmbush(battle,unit.id);
  const artBtn=document.getElementById('artilleryOrder');artBtn.hidden=!['fieldArtillery','katyusha','mortar'].includes(unit?.role);artBtn.disabled=unavailable||uiBusy||!!unit?.attacked||unit?.ammo<=0;artBtn.classList.toggle('active',artilleryTargeting);artBtn.textContent=artilleryTargeting?'إلغاء تصويب المدفعية':'قصف مدفعي';
  const eng=unit?.kind==='engineer'?engineeringState(battle,unit.id):null;
  const fortBtn=document.getElementById('fortifyOrder'),mineBtn=document.getElementById('mineOrder'),clearBtn=document.getElementById('clearMineOrder');
  for(const b of [fortBtn,mineBtn,clearBtn])b.hidden=!eng;
  fortBtn.disabled=unavailable||uiBusy||!eng?.canFortify;mineBtn.disabled=unavailable||uiBusy||!eng?.mineTargets.length||eng.charges<=0;clearBtn.disabled=unavailable||uiBusy||!eng?.clearTargets.length;
  mineBtn.classList.toggle('active',engineeringMode==='mine');clearBtn.classList.toggle('active',engineeringMode==='clear');
  document.getElementById('resetBattle').disabled=uiBusy;
  const end=document.getElementById('endTurn');end.disabled=unavailable||uiBusy;end.innerHTML=remaining?`إنهاء الجولة · بقي ${remaining} <span>←</span>`:`إنهاء الجولة <span>←</span>`;
}

function updateUI(){
  const remaining=remainingPlayerActivations(battle);
  document.getElementById('turnNumber').textContent=String(battle.turn);document.getElementById('monthNumber').textContent=String(Math.floor((battle.turn-1)/4)+1);
  document.getElementById('phaseLabel').textContent=battle.finished?(battle.winner==='blue'?'انتصار قواتك':'انتصار المتمردون'):battle.phase==='player'?'دورك · حرّك قواتك':'دور المتمردين · تنفيذ الحركة';
  document.getElementById('blueForce').textContent=`${countUnits(battle,'blue')} وحدة · ${countArmoredUnits(battle,'blue')} مدرعات · ${countSoldiers(battle,'blue')-battle.units.filter(u=>u.side==='blue'&&(u.role==='droneOperator'||u.role==='droneVehicle')).reduce((n,u)=>n+u.strength,0)} أفراد · ${battle.units.filter(u=>u.side==='blue'&&(u.role==='droneOperator'||u.role==='droneVehicle')&&u.strength>0).length} وحدات درونات`;
  document.getElementById('redForce').textContent=`${battle.units.filter(u=>u.side==='red'&&isUnitDetected(battle,u,'blue')).length} وحدات مرصودة · بقية التشكيلات تحتاج استطلاعاً`;
  const target=battle.sites.find(s=>s.id==='miraf');
  const progress=cityVictoryProgress(battle);
  const goals=rebellionObjectives(battle);document.getElementById('objectiveStatus').textContent=`مدن مؤمنة ${goals.cities}/${goals.totalCities} · مقرات محيدة ${goals.facilities}/${goals.totalFacilities} · ${goals.forces?'تشكيلات تمرد قائمة':'قُضي على تشكيلات التمرد'}`;
  const button=document.getElementById('endTurn');if(battle.finished)button.innerHTML=battle.winner==='blue'?'انتهت المعركة · انتصارك':'انتهت المعركة';
  document.getElementById('eventLog').textContent=battle.events.slice(-3).join('　·　');
  const unit=selectedUnit();
  const hint=uiBusy&&battle.phase==='enemy'?'دور المتمردين · تحركات واشتباكات متتابعة':uiBusy?'الفصيل يتحرك إلى موقعه...':unit?.role==='droneOperator'||unit?.role==='droneVehicle'?`${unitLabel(unit)} · بقي ${unit.droneStock}/${unit.maxDroneStock} مسيرات · متاح بالجولة ${droneAllowance(battle,unit)} · اضغط وحدة المتمردون لإطلاق مسيرة مباشرة، أو استخدم زر اختيار الهدف للأهداف الأخرى · المدى ${unit.launchRange}.`:unit?.role==='supplyTruck'?`شاحنة الإمداد تتحرك تلقائياً نحو ${unit.supplyTargetId}؛ يمكن للعدو استهدافها وتدميرها.`:battle.finished?(battle.winner==='blue'?'أُمنت المدن، قُضي على قوات التمرد، وحُيدت مقراته.':'خسرت قواتك المعركة.'):unit?.hidden?'الفصيل في كمين؛ الاقتراب أو إطلاق النار قد يكشف موقعه.':unit?.attacked?'انتهى دور هذا الفصيل. اختر فصيلاً آخر.':unit?.modelId?`${unitLabel(unit)} · مدى ${unitAttackRange(unit)} خلايا · حركة ${unit.movement} · اضغط المتمردون القريب للتقدم والإطلاق؛ لون المدى يوضح نطاق السلاح.`:unit?.kind==='sniper'?`القناص يطلق حتى ${unitAttackRange(unit)} خلايا${isMountainAt(unit.x,unit.y)?' من موقعه الجبلي':''}؛ الأبيض يذكّر بالوحدات الجاهزة · ${reachableForSelected().length} خلايا حركة.`:unit?.moved?'تحرك الفصيل. اضغط عدواً ضمن مداه أو اختر فصيلاً آخر.':`اختر خلية مضيئة للتحرك أو عدواً بالأصفر للهجوم. الدائرة البيضاء تعني أن الفصيل لم يتحرك بعد · ${remaining} فصائل جاهزة. افتح مركز الإمداد للقوافل.`;
  document.getElementById('mapHint').textContent=(unit?`المعنويات ${Math.round(unit.morale??0)}% · التعب ${Math.round(unit.fatigue??0)}% · ${unit.moraleReason??'جاهز'} · `+terrainDescription(unit.x,unit.y)+' · ':'')+hint;
  renderSupplyPanel();if(unit&&!battle.finished){document.getElementById('selectedCard').classList.add('has-unit')}else document.getElementById('selectedCard').classList.remove('has-unit');
}

function setHint(text){document.getElementById('mapHint').textContent=text}

function renderTacticalOverlays(){
  for(const cell of groups.territory.children)cell.classList.remove('reachable','selected-cell','attack-range','sniper-range','armor-range','artillery-range','engineering-target');
  groups.routes.replaceChildren();
  for(const fort of battle.engineering?.fortifications??[]){const c=centers[fort.y][fort.x];el('circle',{cx:c.x,cy:c.y,r:47,class:'field-fortification-mark'},groups.routes)}
  for(const mine of battle.engineering?.minefields??[]){if(mine.side==='blue'||scanEngineerMines(battle,'blue').some(m=>m.id===mine.id)){const c=centers[mine.y][mine.x];el('path',{d:`M${c.x} ${c.y-18}L${c.x+17} ${c.y+14}H${c.x-17}Z`,class:'field-mine-mark'},groups.routes)}}
  const unit=selectedUnit();if(!unit)return;
  const selectedCell=groups.territory.querySelector(`[data-x="${unit.x}"][data-y="${unit.y}"]`);selectedCell?.classList.add('selected-cell');
  if(unit.role==='reconRadar'){const c=centers[unit.y][unit.x];el('circle',{cx:c.x,cy:c.y,r:1620,class:'recon-radar-coverage'},groups.routes)}
  if(artilleryTargeting&&SUPPORT_PROFILES[unit.role]&&!unit.attacked){const range=unitAttackRange(unit);for(let y=0;y<GRID.rows;y++)for(let x=0;x<GRID.columns;x++){const d=hexDistance(unit,{x,y});if(d>=2&&d<=range)territoryNodes[y*GRID.columns+x]?.classList.add('artillery-range')}}
  if(unit.kind==='engineer'&&engineeringMode){const state=engineeringState(battle,unit.id),targets=engineeringMode==='mine'?state?.mineTargets:state?.clearTargets;for(const cell of targets??[])groups.territory.querySelector(`[data-x="${cell.x}"][data-y="${cell.y}"]`)?.classList.add('engineering-target')}
  if((unit.kind==='sniper'||unit.modelId)&&!unit.attacked){const range=unitAttackRange(unit);for(let y=0;y<GRID.rows;y++)for(let x=0;x<GRID.columns;x++){const d=hexDistance(unit,{x,y});if(d>1&&d<=range&&terrainSight(unit,{x,y}))territoryNodes[y*GRID.columns+x]?.classList.add(unit.modelId?'armor-range':'sniper-range')}}
  if(!unit.moved&&!unit.order?.hold)for(const cell of reachableForSelected()){groups.territory.querySelector(`[data-x="${cell.x}"][data-y="${cell.y}"]`)?.classList.add('reachable')}
  for(const enemy of battle.units.filter(u=>u.side==='red'&&u.strength>0&&attackApproaches(battle,unit.id,u.id).length))groups.territory.querySelector(`[data-x="${enemy.x}"][data-y="${enemy.y}"]`)?.classList.add('attack-range');
}

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms*(autoControl.running&&autoControl.pace==='calm'?1.65:1)));
function unitRenderPoint(unit,x,y){const center=centers[y][x],garrison=unit.role!=='supplyTruck'&&battle.sites.some(site=>site.x===x&&site.y===y);return{x:center.x+(garrison?115:0),y:center.y-(garrison?90:0)}}

let enemyCameraEnabled=true,enemyCameraPausedUntil=0,enemyCameraHome=null,lastEnemyFollow=0;
let lastFriendlyAirFollow=0;
function canObserveAirPoint(point){return battle.units.some(u=>u.side==='blue'&&u.strength>0&&u.role!=='supplyTruck'&&Math.hypot(centers[u.y][u.x].x-point.x,centers[u.y][u.x].y-point.y)<(u.role==='reconRadar'?9:u.role==='antiAir'?5:3)*180)||battle.airDefenses.some(d=>d.side==='blue'&&!d.disabled&&Math.hypot(centers[d.y][d.x].x-point.x,centers[d.y][d.x].y-point.y)<(d.range??4)*180);}
function followEnemyPoint(point){
 if(!enemyCameraEnabled||battle.phase!=='enemy'||performance.now()<enemyCameraPausedUntil)return;const now=performance.now();if(now-lastEnemyFollow<140)return;lastEnemyFollow=now;
 const x=Math.max(0,Math.min(THEATER.width-view.w,point.x-view.w/2)),y=Math.max(0,Math.min(THEATER.height-view.h,point.y-view.h/2));
 const blend=autoControl.running&&autoControl.pace==='calm'?.13:.24;view.x+=(x-view.x)*blend;view.y+=(y-view.y)*blend;applyView();
}
function followFriendlyAirPoint(point){
 if(battle.phase!=='player'||!point)return;const now=performance.now();if(now-lastFriendlyAirFollow<100)return;lastFriendlyAirFollow=now;
 const x=Math.max(0,Math.min(THEATER.width-view.w,point.x-view.w/2)),y=Math.max(0,Math.min(THEATER.height-view.h,point.y-view.h/2));
 const blend=autoControl.running&&autoControl.pace==='calm'?.14:.22;view.x+=(x-view.x)*blend;view.y+=(y-view.y)*blend;applyView();
}
function followEnemyUnit(unit){if(unit?.side==='red'&&isUnitDetected(battle,unit,'blue'))followEnemyPoint(centers[unit.y][unit.x]);}
svg.addEventListener('pointerdown',()=>{if(battle.phase==='enemy')enemyCameraPausedUntil=performance.now()+5000;});
const enemyFollowButton=document.createElement('button');enemyFollowButton.id='enemyCameraFollow';enemyFollowButton.textContent='متابعة العدو: مفعّلة';enemyFollowButton.onclick=()=>{enemyCameraEnabled=!enemyCameraEnabled;enemyFollowButton.textContent='متابعة العدو: '+(enemyCameraEnabled?'مفعّلة':'متوقفة');};document.querySelector('.map-tools').append(enemyFollowButton);

async function animatePath(unitId,path,delay=95){
 let unit=battle.units.find(item=>item.id===unitId);if(!unit)return;let node=groups.units.querySelector(`[data-unit-id="${unitId}"]`);
 for(const point of path){unit=battle.units.find(item=>item.id===unitId);if(!unit||unit.strength<=0)break;const from=unitRenderPoint(unit,unit.x,unit.y),to=unitRenderPoint(unit,point.x,point.y);
  if(node&&!isUnitDetected(battle,unit,'blue')){node.remove();node=null;}
  if(node)for(let frame=1;frame<=7;frame++){const t=frame/7;if(unit.side==='blue'&&autoControl.running)followFriendlyAirPoint({x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t});if(unit.side==='red'&&isUnitDetected(battle,{...unit,x:point.x,y:point.y},'blue'))followEnemyPoint({x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t});node.setAttribute('transform',`translate(${from.x+(to.x-from.x)*t} ${from.y+(to.y-from.y)*t})`);await wait(delay/7)}
  const continued=stepUnit(battle,unitId,point);renderUnits();node=groups.units.querySelector(`[data-unit-id="${unitId}"]`);await playGroundExchanges();if(!continued)break;if(!node&&isUnitDetected(battle,unit,'blue')){renderUnits();node=groups.units.querySelector(`[data-unit-id="${unitId}"]`);}if(node)node.setAttribute('transform',`translate(${to.x} ${to.y})`);
  groups.territory.querySelector('.selected-cell')?.classList.remove('selected-cell');if(unitId===selectedId)groups.territory.querySelector(`[data-x="${point.x}"][data-y="${point.y}"]`)?.classList.add('selected-cell');
 }
 completeMovement(battle,unitId);renderAll();
}

function activeDroneOptions(targetId,side='blue'){
 const source=activeDroneSource();if(!source)return{ok:false,reason:'اختر فريق المشغلين أو مركبة الإطلاق أو اضغط القاعدة أولاً.'};
 return droneLaunchCheck(battle,{...source,targetId,typeId:selectedDroneType(),side});
}
function droneSourcePoint(result){const pos=centers[result.point.y][result.point.x];return{x:pos.x+(result.baseId?88:0),y:pos.y+(result.baseId?42:0)}}
/* MANPADS_SEEK_STABILITY_FIX_20261009 */
async function animateAirDefenseShot(defense,flight,hit,token){
 const origin=centers[defense.y][defense.x],start={x:origin.x,y:origin.y-22};
 const initial={x:Number.isFinite(flight.x)?flight.x:start.x,y:Number.isFinite(flight.y)?flight.y:start.y};
 const dx=initial.x-start.x,dy=initial.y-start.y,distance=Math.max(1,Math.hypot(dx,dy)),normal={x:-dy/distance,y:dx/distance};
 const missSide=((defense.x+defense.y)%2?1:-1),missOffset={x:normal.x*missSide*32,y:normal.y*missSide*32};
 const g=el('g',{class:'drone-interceptor-fx'},groups.effects),trail=el('path',{d:`M${start.x} ${start.y}`,class:'drone-interceptor-trail'},g),rocket=el('g',{class:'drone-interceptor-rocket'},g);
 el('path',{d:'M-3 6L0 19L3 6Z',class:'drone-interceptor-flame'},rocket);
 el('path',{d:'M0-24L6-5L3 8L0 5L-3 8L-6-5Z',class:'drone-interceptor-body'},rocket);
 el('path',{d:`M${start.x-18} ${start.y}L${start.x+18} ${start.y}`,class:'drone-interceptor-launch-flash'},g);
 const toInitial={x:hit?initial.x:initial.x+missOffset.x,y:hit?initial.y:initial.y+missOffset.y};
 let angle=Math.atan2(toInitial.y-start.y,toInitial.x-start.x),x=start.x,y=start.y,last=performance.now(),elapsed=0;
 const speed=.48,turnRate=.009,duration=Math.max(850,Math.min(2100,distance/(speed*.76))),trailPoints=[{x,y}];let impact={x:initial.x,y:initial.y},contact=false;
 try{
  while(elapsed<duration){
   await new Promise(resolve=>requestAnimationFrame(resolve));
   if(token.cancelled||!g.isConnected)return null;
   const now=performance.now(),dt=Math.max(0,Math.min(34,now-last));last=now;elapsed+=dt;
   const live={x:Number.isFinite(flight.x)?flight.x:initial.x,y:Number.isFinite(flight.y)?flight.y:initial.y};
   const desired={x:live.x+(hit?0:missOffset.x),y:live.y+(hit?0:missOffset.y)},gap=Math.hypot(desired.x-x,desired.y-y);
   const closeEnough=Math.max(20,speed*dt*1.6);
   if(hit&&gap<=closeEnough){x=live.x;y=live.y;impact=live;contact=true;break}
   const wanted=Math.atan2(desired.y-y,desired.x-x);
   let turn=((wanted-angle+Math.PI*3)%(Math.PI*2))-Math.PI;turn=Math.max(-turnRate*dt,Math.min(turnRate*dt,turn));angle+=turn;
   const step=Math.min(speed*dt,gap);x+=Math.cos(angle)*step;y+=Math.sin(angle)*step;impact={x,y};
   trailPoints.push({x,y});if(trailPoints.length>28)trailPoints.shift();
   rocket.setAttribute('transform',`translate(${x} ${y}) rotate(${angle*180/Math.PI+90})`);
   trail.setAttribute('d',trailPoints.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' '));
  }
  if(hit&&!contact){const live={x:Number.isFinite(flight.x)?flight.x:initial.x,y:Number.isFinite(flight.y)?flight.y:initial.y};impact=live}
  g.remove();
  const burst=el('g',{transform:`translate(${impact.x} ${impact.y})`,class:'drone-interceptor-burst'},groups.effects);
  el('circle',{r:hit?28:15,class:'drone-interceptor-flash'},burst);el('circle',{r:hit?15:8,class:'drone-interceptor-shock'},burst);
  if(hit){el('path',{d:'M-22 0L-8-12L2 1L15-13L26 0L13 11L0 5L-12 17Z',class:'drone-interceptor-fragment'},burst);el('circle',{cx:0,cy:-18,r:13,class:'drone-interceptor-smoke'},burst);el('circle',{cx:11,cy:-22,r:9,class:'drone-interceptor-smoke delayed'},burst)}
  setTimeout(()=>burst.remove(),1900);return hit?impact:null;
 }finally{g.remove()}
}
async function animateDroneFlight(start,end,flight,distance){
 const snapshot=battle;start={...start};end={...end};if(![start.x,start.y,end.x,end.y].every(Number.isFinite)||Math.hypot(end.x-start.x,end.y-start.y)<30){flight.status='cancelled';battle.inFlightDrones=battle.inFlightDrones.filter(f=>f!==flight);setHint('أُلغي مسار مسيرة غير صالح؛ لم يقع انفجار.');return true;}
 const dx=end.x-start.x,dy=end.y-start.y,norm=Math.max(1,Math.hypot(dx,dy)),normal={x:-dy/norm,y:dx/norm},control={x:(start.x+end.x)/2+normal.x*34,y:(start.y+end.y)/2+normal.y*34},sample=t=>{const q=1-t;return{x:q*q*start.x+2*q*t*control.x+t*t*end.x,y:q*q*start.y+2*q*t*control.y+t*t*end.y}},g=el('g',{class:'drone-flight-fx'},groups.effects),marker=el('g',{class:'drone-flight-marker'},g);
 marker.innerHTML=droneArtwork;if(flight.side==='red')marker.setAttribute('visibility','hidden');
 const frames=Math.max(45,Math.min(165,Math.round(Math.max(1,distance)*10.4))),stepMs=Math.max(28,Math.min(36,Math.round(5400/frames)));let completed=false,intercepted=false,impact=end,interceptionPoint=null;const shotToken={cancelled:false},shotTasks=[];
 try{for(let frame=0;frame<=frames;frame++){
  if(battle!==snapshot||!g.isConnected){flight.status='cancelled';return true;}
  const t=frame/frames,p=sample(t),ahead=sample(Math.min(1,t+.006)),angle=Math.atan2(ahead.y-p.y,ahead.x-p.x)*180/Math.PI;flight.progress=t;flight.x=p.x;flight.y=p.y;const observable=flight.side!=='red'||canObserveAirPoint(p);marker.setAttribute('visibility',observable?'visible':'hidden');if(flight.side==='red'&&observable)followEnemyPoint(p);if(flight.side==='blue')window.__REBEL_LAB__?.followFriendlyAirPoint?.(p);marker.setAttribute('transform','translate('+p.x+' '+p.y+') rotate('+angle+' ) scale(.82)');
  if(frame>1){const shot=pollDefense(flight,p);if(shot?.hit)interceptionPoint={x:p.x,y:p.y};}
  await wait(stepMs);if(flight.status==='intercepted'){const shot=pollDefense(flight,p);if(shot?.hit)interceptionPoint={x:p.x,y:p.y}}if(interceptionPoint){intercepted=true;impact=interceptionPoint;break}
 }
 if(!intercepted){const successfulShots=shotTasks.filter(item=>item.hit).map(item=>item.promise);if(successfulShots.length){await Promise.all(successfulShots);if(interceptionPoint){intercepted=true;impact=interceptionPoint}}}
 finishDefenseFlight(flight); shotToken.cancelled=true;await Promise.allSettled(shotTasks.map(item=>item.promise));g.remove();
 if(intercepted){const mark=el('path',{d:'M'+impact.x+' '+(impact.y-12)+'L'+(impact.x+4)+' '+(impact.y-4)+'L'+(impact.x+12)+' '+impact.y+'L'+(impact.x+4)+' '+(impact.y+4)+'L'+impact.x+' '+(impact.y+12)+'L'+(impact.x-4)+' '+(impact.y+4)+'L'+(impact.x-12)+' '+impact.y+'L'+(impact.x-4)+' '+(impact.y-4)+'Z',class:'drone-intercept-mark'},groups.effects);setTimeout(()=>mark.remove(),240);setHint('اعترض الدفاع الجوي المسيرة قبل إصابة الهدف.');renderAll();return true}
 supportImpact(groups.effects,end,{size:flight.typeId==='heavy'?1.05:flight.typeId==='light'?.65:.85,drone:true});completed=true;return false
 }finally{if(!completed&&flight.status==='flying')flight.status='cancelled';finishDefenseFlight(flight);g.remove();if(flight.status==='cancelled')snapshot.inFlightDrones=snapshot.inFlightDrones.filter(f=>f!==flight);}
}
async function performDroneLaunch(targetId,side='blue',sourceOverride=null){if(uiBusy)return false;if(side==='blue'&&getArmisticeState(battle).active&&(autoControl.running||!window.confirm('إطلاق المسيرة الهجومية ينهي الهدنة. هل تريد المتابعة؟')))return false;const source=sourceOverride??activeDroneSource();if(!source)return false;const buildingTarget=/^site-tile:([^:]+):(-?\d+):(-?\d+)$/.exec(targetId),options={...source,...(buildingTarget?{siteId:buildingTarget[1],siteTileX:Number(buildingTarget[2]),siteTileY:Number(buildingTarget[3])}:targetId.startsWith('site:')?{siteId:targetId.slice(5)}:targetId.startsWith('radar:')?{radarId:targetId.slice(6)}:targetId.startsWith('depot:')?{depotId:targetId.slice(6)}:targetId.startsWith('baseTarget:')?{droneBaseTargetId:targetId.slice(11)}:{targetId}),typeId:selectedDroneType(),side},started=startDroneFlight(battle,options);if(!started.ok){battle.events.push('تعذر إطلاق المسيرة: '+started.reason);battle.events=battle.events.slice(-8);setHint(started.reason);renderAll();return false}uiBusy=true;const from=droneSourcePoint({...started,point:started.flight.start}),to=centers[started.target.y][started.target.x];renderAll();const intercepted=await animateDroneFlight(from,to,started.flight,started.distance);let result=intercepted?{ok:false,intercepted:true}:resolveDroneImpact(battle,started.flight.id);recordEvidence(battle,side,started.flight.targetCell,{damage:result.damage??0});if(!result.ok){battle.events.push(intercepted?'اعتراض جوي: أُسقطت المسيرة قبل وصولها.':'تعذر تسجيل إصابة المسيرة؛ راجع حالة الهدف.');battle.events=battle.events.slice(-8);renderAll()}if(result.ok){result.target.hitFlash=result.damage>0;renderAll();await wait(240);result.target.hitFlash=false;setHint(result.removedOperator?'أُطلقت المسيرة الثالثة؛ انتهت مهمة فريق المشغلين واختفى من الخريطة.':`وصلت المسيرة: ${result.model.name} · ${result.damage} ضرر · ${result.distance} خلايا.`)}if(side==='blue'){uiBusy=false;droneLaunchActive=false;activeDroneBaseId=null;renderAll()}return !!result.ok}
function bestEnemyDrone(source,side){if(getArmisticeState(battle).active)return null;if(!source.stock)ensureDroneInventory(source);
 const contacts=battle.units.filter(u=>u.side!==side&&u.strength>0&&isUnitDetected(battle,u,side)&&u.domain!=='air');
 const immediate=contacts.filter(u=>hexDistance(source,u)<=unitAttackRange(u)+1);
 const candidates=Object.entries(DRONE_MODELS).map(([id,m])=>({id,...m})).sort((a,b)=>b.damage-a.damage);
 const targets=(immediate.length?immediate:contacts).slice().sort((a,b)=>immediate.length?hexDistance(source,a)-hexDistance(source,b)||targetScore({...source,role:'antiArmor'},b,contacts,hexDistance)-targetScore({...source,role:'antiArmor'},a,contacts,hexDistance):targetScore({...source,role:'antiArmor'},b,contacts,hexDistance)+droneFrontBonus(battle,source,b,side)-targetScore({...source,role:'antiArmor'},a,contacts,hexDistance)-droneFrontBonus(battle,source,a,side));
 for(const target of targets){if(!evidencePermission(battle,side,target,{report:{status:'observed',turn:battle.turn}})||!civilianStrikeAllowed(battle,target,{side,confidence:100}))continue;const cap=source.stock?16:source.launchRange;const type=candidates.slice().sort((a,b)=>(b.id===preferredDrone(target)?1:0)-(a.id===preferredDrone(target)?1:0)||a.damage-b.damage).find(m=>(source.stock?source.stock[m.id]>0:source.droneInventory[m.id]>0)&&hexDistance(source,target)<=Math.min(m.range,cap));if(type)return{target,type};}
 // When no contact threatens the launcher, use only a fresh, directly observed strategic facility.
 if(!immediate.length){const reports=knownTargets(battle,side).filter(r=>r.status==='observed'&&r.age<=1&&r.confidence>=90);const priorities={command:100,factory:92,airDefense:90,airport:82,radar:78,depot:74,refinery:68,base:66};
  const assets=facilityTargets(battle).filter(t=>t.side!==side&&!t.asset.disabled&&(t.asset.structureHp??t.asset.hp??1)>0&&reports.some(r=>r.entityId===t.asset.id))
   .sort((a,b)=>(priorities[b.type]??55)-(priorities[a.type]??55)||hexDistance(source,a)-hexDistance(source,b));
  for(const facility of assets){if(!evidencePermission(battle,side,facility,{report:reports.find(r=>r.entityId===facility.asset.id)})||!civilianStrikeAllowed(battle,facility,{side,confidence:95}))continue;const type=candidates.find(m=>(source.stock?source.stock[m.id]>0:source.droneInventory[m.id]>0)&&hexDistance(source,facility)<=Math.min(m.range,source.stock?16:source.launchRange));if(type)return{target:{...facility,targetId:facility.id},type};}
 }
 return null;
}

async function enemyDroneLaunch(source,target,type,base=false){const sourceOpt=base?{baseId:source.id}:{sourceId:source.id},targetId=target.targetId??target.id,options={...sourceOpt,...(/^site-tile:([^:]+):(-?\d+):(-?\d+)$/.test(targetId)?(()=>{const m=/^site-tile:([^:]+):(-?\d+):(-?\d+)$/.exec(targetId);return{siteId:m[1],siteTileX:Number(m[2]),siteTileY:Number(m[3])}})():targetId.startsWith('site:')?{siteId:targetId.slice(5)}:targetId.startsWith('radar:')?{radarId:targetId.slice(6)}:targetId.startsWith('depot:')?{depotId:targetId.slice(6)}:targetId.startsWith('baseTarget:')?{droneBaseTargetId:targetId.slice(11)}:{targetId}),typeId:typeof type==='string'?type:type.id,side:'red'},started=startDroneFlight(battle,options);if(!started.ok){battle.events.push(`إطلاق مسيرة ${base?'المنصة':'المتمردين'} لم يبدأ: ${started.reason}`);battle.events=battle.events.slice(-8);return false}const from=droneSourcePoint({...started,point:started.flight.start}),to=centers[started.target.y][started.target.x],intercepted=await animateDroneFlight(from,to,started.flight,started.distance);if(intercepted){recordEvidence(battle,'red',started.flight.targetCell,{damage:0});renderAll();return true}const result=resolveDroneImpact(battle,started.flight.id);recordEvidence(battle,'red',started.flight.targetCell,{damage:result.damage??0});if(result.ok){result.target.hitFlash=result.damage>0;renderAll();await wait(180);result.target.hitFlash=false}return !!result.ok}
async function performMove(unitId,x,y,path){if(uiBusy)return;const u=battle.units.find(u=>u.id===unitId),route=reachableCells(battle,unitId).find(c=>c.x===x&&c.y===y)?.path??[],risk=u&&truceMoveRisk(battle,u,route,autoContacts());if(risk){if(autoControl.running){setHint(risk);return;}if(!window.confirm(risk+' هل تريد إنهاء الهدنة وتنفيذ الحركة؟'))return;breakArmistice(battle,'تقدم هجومي بعد تحذير القيادة','blue');}const movement=beginMove(battle,unitId,x,y);if(!movement)return;uiBusy=true;renderAll();await animatePath(unitId,movement.path);uiBusy=false;renderAll()}
async function performAttack(unitId,targetId){if(uiBusy)return;const approach=attackApproaches(battle,unitId,targetId)[0];if(!approach)return;uiBusy=true;renderAll();
 if(approach.path.length){const movement=beginMove(battle,unitId,approach.x,approach.y);if(!movement){uiBusy=false;renderAll();return}renderAll();await animatePath(unitId,movement.path)}
 const attacker=battle.units.find(u=>u.id===unitId),target=battle.units.find(u=>u.id===targetId);if(attacker&&target&&target.strength>0&&hexDistance(attacker,target)<=unitAttackRange(attacker)){
  const before=target.hp,didAttack=issueAttack(battle,unitId,targetId);const damage=Math.max(0,before-target.hp);
  if(didAttack)await playGroundExchanges();target.hitFlash=damage>0;
  renderAll();await wait(attacker.modelId?440:360);target.hitFlash=false;
 }
 uiBusy=false;renderAll();
}
async function playEnemyTurn(){if(uiBusy||battle.phase!=='player'||battle.finished)return;window.rebelMapPlanner?.close();window.dispatchEvent(new Event('rebel-cancel-air-target'));droneLaunchActive=false;artilleryTargeting=false;engineeringMode='';uiBusy=true;enemyCameraHome={...view};const actions=beginEnemyTurn(battle);renderAll();await wait(280);
 for(const action of actions){const unit=battle.units.find(u=>u.id===action.unitId);if(!unit||unit.strength<=0)continue;actingEnemyId=unit.id;followEnemyUnit(unit);renderUnits();
  await animatePath(action.unitId,action.path,130);const target=battle.units.find(u=>u.id===action.attackTargetId&&u.strength>0),before=target?.hp??0,ammoBefore=unit.ammo,healthBefore=new Map(battle.units.filter(u=>u.side==='blue'&&u.strength>0).map(u=>[u.id,u.hp]));if(action.kind==='tunnel'){resolveEnemyAction(battle,action);renderAll();}else if(unit.role==='droneOperator'||unit.role==='droneVehicle'){const choice=bestEnemyDrone(unit,'red');if(choice&&unit.droneStock>0&&!unit.stoppedByMine){for(let n=0;n<(unit.role==='droneVehicle'?4:1)&&droneAllowance(battle,unit)>0;n++){const next=bestEnemyDrone(unit,'red');if(!next)break;await enemyDroneLaunch(unit,next.target,next.type.id);}}}else resolveEnemyAction(battle,action);followEnemyUnit(unit);
  if(SUPPORT_PROFILES[unit.role]&&unit.ammo<ammoBefore&&battle.lastArtilleryResult?.unit.id===unit.id){const shot=battle.lastArtilleryResult;await supportBarrage(groups.effects,centers[unit.y][unit.x],centers[shot.y][shot.x],unit.role,centers,shot.impacts,u=>isUnitDetected(battle,u,'blue'));}
  const damage=target?Math.max(0,before-target.hp):0;await playGroundExchanges();if(target)target.hitFlash=damage>0;
  renderAll();if(action.attackTargetId)await wait(420);else await wait(160);if(target)target.hitFlash=false;actingEnemyId=null;
 }
 for(const base of battle.droneBases??[]){if(base.industryRole==='factory'||base.side!=='red'||base.disabled)continue;let launched=0;while(launched<4&&(base.launchTurn!==battle.turn||(base.launchUsed??0)<4)){const choice=bestEnemyDrone(base,'red');if(!choice)break;const ok=await enemyDroneLaunch(base,choice.target,choice.type,true);if(!ok)break;launched++;}if(launched)renderAll()}const freightMoves=advanceDroneFreight(battle);renderUnits();if(freightMoves.length)await animateSupplyConvoys(freightMoves);const convoyMoves=advanceSupplyConvoys(battle);if(convoyMoves.length)await animateSupplyConvoys(convoyMoves);await window.__REBEL_LAB__?.runEnemyAirSortie?.();finalizeTurn(battle);window.__REBEL_LAB__?.refreshAirbaseStocks?.();uiBusy=false;receiveAirlifts();const selected=selectedUnit();if(!selected||selected.strength<=0)selectedId=battle.units.find(u=>u.side==='blue'&&u.role!=='supplyTruck'&&u.strength>0)?.id||'blue-1';renderAll();
}
/* AIR_BATTLE_TURN_RECOVERY_GUARD_V1 */
/* AIR_BATTLE_SORTIE_ROUND_RESET_V1 */
const __airBattlePlayEnemyTurnOriginal = playEnemyTurn;
playEnemyTurn = async function(){
 try { await __airBattlePlayEnemyTurnOriginal(); }
 catch(error) {
  console.error('Air battle enemy turn failed:', error);
  if (battle && !battle.finished) { battle.events.push('تعذر إكمال حركة جوية في دور المتمردين؛ استُعيد التحكم باللعبة.'); battle.events=battle.events.slice(-10); if(battle.phase==='enemy')finalizeTurn(battle); }
  uiBusy=false;
  renderAll();
 }finally{if(enemyCameraHome&&enemyCameraEnabled){view={...enemyCameraHome};applyView();}enemyCameraHome=null;actingEnemyId=null;visualMove=null;if(battle.phase==='player')uiBusy=false;renderAll();}
};


let coordinatedDroneOrders=[];
const droneOrderSourceKey=source=>source.baseId?'base:'+source.baseId:'unit:'+source.sourceId;
function plannerSourceFromKey(key){if(!key)return null;if(key.startsWith('base:')){const base=battle.droneBases?.find(item=>item.id===key.slice(5)&&item.side==='blue');return base?{baseId:base.id,point:base}:null}const unit=battle.units.find(item=>item.id===key.slice(5)&&item.side==='blue'&&['droneOperator','droneVehicle'].includes(item.role));return unit?{sourceId:unit.id,point:unit}:null}
function plannerSourceName(source){if(source.baseId)return 'قاعدة الدرونات';const unit=battle.units.find(item=>item.id===source.sourceId);return unit?unitLabel(unit)+' · '+unitNo(unit.id):'مصدر غير متاح'}
function plannerSourceStock(source,type){if(source.baseId){const base=battle.droneBases.find(item=>item.id===source.baseId);return base?.stock?.[type]??0}return ensureDroneInventory(source.point)[type]??0}
function planReserved(key,type=null){return coordinatedDroneOrders.filter(o=>o.sourceKey===key&&(!type||o.type===type)).reduce((n,o)=>n+o.count*o.salvos,0)}
function planBudget(source){return source?.baseId?Math.max(0,4-(source.point.launchTurn===battle.turn?(source.point.launchUsed??0):0)):source?droneAllowance(battle,source.point):0}
function planCapacity(source,type){return Math.min(planBudget(source),type==='auto'?['light','standard','heavy'].reduce((n,t)=>n+plannerSourceStock(source,t),0):source?plannerSourceStock(source,type):0)}
function planFits(source,key){return !!source&&planReserved(key)<=planBudget(source)&&['light','standard','heavy'].every(t=>planReserved(key,t)<=plannerSourceStock(source,t));}

function renderDronePlanner(){window.rebelMapPlanner?.refresh();}
async function executeCoordinatedDroneAttack(){
 if(uiBusy||window.__REBEL_LAB__?.airBusy?.()||battle.phase!=='player'||!coordinatedDroneOrders.length)return;
 const totals=new Map(),plans=[];
 for(const order of coordinatedDroneOrders){const source=plannerSourceFromKey(order.sourceKey),options={...source,...planTargetOptions(order.targetId),typeId:order.type,side:'blue'},check=planCheck(options),n=order.count*order.salvos;
 const total=(totals.get(order.sourceKey)||0)+n;totals.set(order.sourceKey,total);
 if(!check.ok||total>planBudget(source)||!planFits(source,order.sourceKey)){setHint(check.reason||'الحصة غير كافية');return;}plans.push({order,source,options,target:check.target});}
 if(getArmisticeState(battle).active&&(autoControl.running||!window.confirm('تنفيذ هجمة المسيرات ينهي الهدنة. هل تريد المتابعة؟')))return;
 // Preflight every row before spending any stock.
 const reservations=plans.map(p=>({...p,flights:startDroneSalvo(battle,{...p.options,count:p.order.count*p.order.salvos}).flights}));
 uiBusy=true;renderAll();
 try{await Promise.allSettled(reservations.map(async({order,source,target,flights})=>{const start=droneSourcePoint({point:flights[0].start,baseId:source.baseId}),end=centers[target.y][target.x];for(let salvo=0;salvo<order.salvos;salvo++){for(const flight of flights.slice(salvo*order.count,(salvo+1)*order.count)){const intercepted=await animateDroneFlight(start,end,flight,hexDistance(flight.start,target));if(!intercepted){const impact=resolveDroneImpact(battle,flight.id);if(impact.ok){impact.target.hitFlash=true;renderAll();await wait(180);impact.target.hitFlash=false}}await wait(90);}if(salvo<order.salvos-1)await wait(700);}}));setHint('اكتملت الهجمة المخططة.');}finally{uiBusy=false;coordinatedDroneOrders=[];window.rebelMapPlanner?.close();renderAll();}
}
function planTargetOptions(id){let m=/^site-tile:([^:]+):(-?\d+):(-?\d+)$/.exec(id);return m?{siteId:m[1],siteTileX:+m[2],siteTileY:+m[3]}:id.startsWith('baseTarget:')?{droneBaseTargetId:id.slice(11)}:id.startsWith('depot:')?{depotId:id.slice(6)}:id.startsWith('radar:')?{radarId:id.slice(6)}:{targetId:id};}
function planCheck(options){return options.targetId?droneLaunchCheck(battle,options):droneSiteLaunchCheck(battle,options);}


var refreshCommandView;
function installStrategicDock(){
 const host=document.querySelector('.top-actions');if(!host)return;
 const bar=document.createElement('div');bar.className='strategic-dock';bar.innerHTML='<button type="button" id="openArmisticePanel" class="armistice-quick">الهدنة</button><button type="button" id="openStrategicPanel">قيادة الجبهة</button><span id="strategicStatus"></span>';host.prepend(bar);
 const dialog=document.createElement('dialog');dialog.id='strategicPanel';dialog.dir='rtl';dialog.innerHTML=`<div class="guide-head"><h2>الجبهة والإدارة السياسية</h2><button type="button" id="closeStrategicPanel">إغلاق</button></div>
 <section id="armisticeSection" class="strategy-section"><h3>الهدنة وإعادة التنظيم</h3><p id="armisticeSummary"></p><label>مدة الاتفاق <select id="armisticeRounds"><option value="1">جولة واحدة</option><option value="2">جولتان</option><option value="3">ثلاث جولات</option><option value="4" selected>٤ جولات · شهر</option><option value="6">٦ جولات</option><option value="8">٨ جولات · شهران</option></select></label><div class="strategy-actions"><button id="requestArmistice">طلب هدنة</button><button id="extendArmistice">طلب تمديد</button><button id="acceptArmistice">قبول</button><button id="counterArmistice">تعديل المدة</button><button id="rejectArmistice">رفض</button><button id="breakArmistice">إنهاء الهدنة</button></div><p id="armisticeFeedback" role="status"></p></section>
 <section class="strategy-section"><h3>مراكز الإمداد الأمامية</h3><p>تُبنى بعد تحرير المدينة وتأمين محيطها. المركز القريب يخدم الوحدات مع بقاء المخازن الخلفية شبكة احتياطية.</p><label>المدينة <select id="forwardSupplyCity"></select></label><button id="buildForwardSupply">إنشاء مركز أمامي</button><div id="forwardSupplySummary"></div></section>
 <section class="strategy-section"><h3>الصناعة والاستعداد الاقتصادي</h3><p id="industrySummary"></p><small>يسجل المختبر إنتاج المصانع والمصافي العسكري والاقتصادي في سجل مستقل جاهز للربط بالاقتصاد السياسي.</small></section>
 <section class="strategy-section"><h3>التقارير والإعلان</h3><label>خسائر قواتك <select data-policy="ownLosses"><option value="public">إعلان العدد</option><option value="summary">إعلان مختصر</option><option value="hidden">تكتم</option></select></label><label>خسائر العدو <select data-policy="enemyLosses"><option value="public">إعلان العدد المعروف</option><option value="summary">إعلان مختصر</option><option value="hidden">تكتم</option></select></label><label>الأراضي <select data-policy="territory"><option value="public">إعلان التحرير والخسارة</option><option value="summary">إعلان مختصر</option><option value="hidden">تكتم</option></select></label><label>خطط العمليات <select data-policy="operations"><option value="public">نشر الخطة</option><option value="summary">إعلان عام بلا وجهة</option><option value="hidden">للقيادة فقط</option></select></label><label>وجهة العملية <select id="operationTarget"></select></label><button id="recordOperationPlan" type="button">تسجيل خطة التقدم</button><p id="operationBriefing"></p><div id="publicReports"></div></section>`;
 document.body.append(dialog);refreshCommandView=mountCommandView(dialog,()=>battle);
 const style=document.createElement('style');style.textContent=`.strategic-dock{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.top-actions .strategic-dock{margin:0}.top-actions .strategic-dock #strategicStatus{display:none}.strategic-dock button,.strategy-actions button,#buildForwardSupply{border:1px solid #547f8c;background:#102e43;color:#e7d8ae;border-radius:8px;padding:8px 12px;font:inherit;cursor:pointer}.strategic-dock span{color:#d5c58d;font-size:.85rem}.strategic-dock .armistice-quick{border-color:#d8bd72;background:#3b3420;color:#fff0b8}.strategic-dock .armistice-quick.has-offer{background:#70402b;border-color:#f0a26e;box-shadow:0 0 0 2px #f0a26e55}.strategic-dock .armistice-quick:disabled{opacity:.48}.strategy-section{border:1px solid #826c43;border-radius:10px;padding:12px;margin:10px 0;background:#102331;color:#eee}.strategy-section h3{margin:0 0 8px;color:#e5c77e}.strategy-section p{margin:5px 0 10px;line-height:1.5}.strategy-section label{display:inline-flex;gap:7px;align-items:center;margin:5px 10px 5px 0}.strategy-section select{background:#071823;color:#f5e4b0;border:1px solid #51727e;border-radius:6px;padding:6px}.strategy-actions{display:flex;flex-wrap:wrap;gap:6px}.strategy-actions button{padding:6px 9px}.strategy-actions button:disabled{opacity:.4;cursor:not-allowed}#strategicPanel{width:min(820px,92vw);max-height:88vh;overflow:auto;background:#091a25;color:#eee;border:1px solid #af9256;border-radius:14px;padding:18px}#strategicPanel::backdrop{background:#0009}#publicReports{max-height:160px;overflow:auto;font-size:.9rem;line-height:1.6;margin-top:8px;color:#dfd2af}#forwardSupplySummary{margin-top:8px;color:#b8d8dd}`;document.head.append(style);
  const $id=id=>document.getElementById(id),n=Number;
  $id('openStrategicPanel').onclick=()=>{renderStrategicPanel();refreshCommandView();dialog.showModal()};$id('openArmisticePanel').onclick=()=>{renderStrategicPanel();refreshCommandView();dialog.showModal();requestAnimationFrame(()=>$id('armisticeSection').scrollIntoView({block:'start',behavior:'smooth'}))};$id('closeStrategicPanel').onclick=()=>dialog.close();
  const message=text=>{$id('armisticeFeedback').textContent=text;renderStrategicPanel()};
  const answerFromAI=(side)=>{const state=getArmisticeState(battle),proposal=state.proposals.find(item=>item.id===state.pending&&item.status==='pending');if(!proposal||proposal.to!==side)return'none';const judgment=assessArmisticeDecision(battle,side,proposal);answerArmistice(battle,judgment.action,judgment.rounds,side);renderAll();return judgment.action;};
  $id('requestArmistice').onclick=()=>{if(autoControl.running||uiBusy||battle.phase!=='player'){message('يمكن تقديم الطلب خلال دورك اليدوي فقط.');return;}const result=proposeArmistice(battle,'blue',n($id('armisticeRounds').value));if(!result.ok){message(result.reason);return;}const response=answerFromAI('red');message(response==='accept'?'قبلت قيادة المتمردين مدة الاتفاق.':response==='counter'?'اقترح العدو مدة بديلة؛ راجعها واقبل أو عدّل أو ارفض.':'رفض العدو الطلب لأن الوضع الميداني لا يبرر وقف القتال.');};
  
  $id('acceptArmistice').onclick=()=>{const state=getArmisticeState(battle),proposal=state.proposals.find(x=>x.id===state.pending);if(!proposal||proposal.to!=='blue'){message('لا يوجد طلب موجّه إليك.');return;}const result=answerArmistice(battle,'accept',proposal.rounds,'blue');message(result.ok?'دخلت الهدنة حيّز التنفيذ.':'تعذر قبول العرض.');renderAll()};
  $id('counterArmistice').onclick=()=>{const result=answerArmistice(battle,'counter',n($id('armisticeRounds').value),'blue');if(result.ok){const reply=answerFromAI('red');message(reply==='accept'?'قبل العدو المدة المقترحة.':reply==='reject'?'رفض العدو المدة المقترحة.':'أرسل العدو عرضاً مقابلاً؛ هذا آخر تعديل متاح.');}else message(result.reason||'لا يوجد عرض لتعديله.');};
  $id('rejectArmistice').onclick=()=>{const result=answerArmistice(battle,'reject',null,'blue');message(result.ok?'رُفض عرض الهدنة.':'لا يوجد عرض لرفضه.');};
  $id('extendArmistice').onclick=()=>{const r=extendArmistice(battle,n($id('armisticeRounds').value),'blue');if(r.ok){const answer=answerFromAI('red');message(answer==='accept'?'وافق العدو على التمديد.':answer==='counter'?'اقترح العدو مدة تمديد بديلة.':'رفض العدو التمديد وفق وضع الجبهة.');}else message(r.reason);};
  $id('breakArmistice').onclick=()=>{if(breakArmistice(battle,'إنهاء الهدنة بطلب الدولة','blue'))message('أُنهيت الهدنة وعادت قواعد القتال.');else message('لا توجد هدنة قائمة.');renderAll()};
  $id('buildForwardSupply').onclick=()=>{const result=establishForwardSupplyCenter(battle,$id('forwardSupplyCity').value,'blue');if(result.ok){message(`اكتمل مركز ${result.depot.name} وربط بالمخزن الخلفي.`);renderAll()}else message(result.reason);};
  dialog.querySelectorAll('[data-policy]').forEach(select=>select.onchange=()=>{setDisclosurePolicy(battle,select.dataset.policy,select.value,'blue');renderStrategicPanel()});
  $id('recordOperationPlan').onclick=()=>{const value=$id('operationTarget').value,site=battle.sites.find(s=>s.id===value),facility=facilityTargets(battle).find(t=>t.id===value),target=site??(facility?{...facility,asset:facility.asset,name:facility.name??facility.asset?.name}:null);if(!target){message('اختر مدينة أو منشأة معروفة أولاً.');return;}recordOperationPlan(battle,'blue',target);message('سُجلت وجهة التقدم لدى القيادة؛ النشر الإعلامي يتبع خيار خطط العمليات.');renderStrategicPanel()};
  renderStrategicPanel();
}
function renderStrategicPanel(){
 const dialog=document.getElementById('strategicPanel');if(!dialog)return;const $=id=>document.getElementById(id),s=getArmisticeState(battle),pending=s.proposals?.find(p=>p.id===s.pending&&p.status==='pending');
 const incoming=pending?.to==='blue'&&pending.from==='red',manualLocked=autoControl.running||uiBusy||battle.phase!=='player';
 const status=s.active?`هدنة قائمة · تنتهي بعد ${Math.max(0,s.until-battle.turn)} جولات.`:incoming?`طلب هدنة من المتمردين · ${pending.rounds} جولات؛ اختر القبول أو تعديل المدة أو الرفض.`:pending?`عرضك قيد التفاوض · ${pending.counterRounds??pending.rounds} جولات.`:'لا توجد هدنة أو طلب معلّق.';
 $('armisticeSummary').textContent=status+(s.lastDecision?' آخر تقدير: '+s.lastDecision.reason:'');$('strategicStatus').textContent=s.active?`هدنة · ${Math.max(0,s.until-battle.turn)} جولات`:incoming?'طلب هدنة جديد':'الجبهة والإمداد';
 const quick=$('openArmisticePanel');quick.textContent=incoming?'الهدنة · طلب جديد':'الهدنة';quick.classList.toggle('has-offer',!!incoming);quick.setAttribute('aria-label',incoming?'وصل طلب هدنة من المتمردين':'فتح خيارات الهدنة');
 if(incoming&&!autoControl.running&&s.lastNotifiedProposalId!==pending.id){s.lastNotifiedProposalId=pending.id;setHint('وصل طلب هدنة من المتمردين؛ افتح زر الهدنة لقبوله أو تعديله أو رفضه.');}
 const isPlayerOffer=pending?.to==='blue';$('acceptArmistice').disabled=!isPlayerOffer||manualLocked;$('counterArmistice').disabled=!isPlayerOffer||manualLocked||((pending?.counterDepth??0)>=2);$('rejectArmistice').disabled=!isPlayerOffer||manualLocked;$('extendArmistice').disabled=!s.active||manualLocked||(s.extensionCount??0)>=2;$('breakArmistice').disabled=!s.active||manualLocked;$('requestArmistice').disabled=!!s.active||!!pending||manualLocked||battle.turn<(s.cooldownUntil??0);
 const select=$('forwardSupplyCity'),old=select.value;select.innerHTML='';for(const site of battle.sites.filter(x=>x.owner==='blue'&&x.radius>=1)){const op=document.createElement('option');op.value=site.id;op.textContent=`${site.name}${site.contested?' · متنازع عليها':''}`;select.append(op)}if([...select.options].some(o=>o.value===old))select.value=old;
 const depots=battle.logistics.depots.filter(d=>d.side==='blue');$('forwardSupplySummary').textContent=`المراكز العاملة ${depots.filter(d=>!d.disabled).length} من ${depots.length} · `+depots.map(d=>`${d.name??'المخزن الخلفي'} ${d.disabled?'(غير متاح)':'(عامل)'}`).join('، ');
 if((battle.economyBridge?.turn??0)===0)accountIndustry(battle);const ledger=Object.values(syncIndustryLedger(battle)),monthly=battle.economyBridge.monthly??{};const military=ledger.reduce((a,x)=>({ammo:a.ammo+(x.militaryOutput?.ammo??0),materials:a.materials+(x.militaryOutput?.materials??0),fuel:a.fuel+(x.militaryOutput?.fuel??0)}),{ammo:0,materials:0,fuel:0});$('industrySummary').textContent=`مصانع ومصافي مسجلة ${ledger.length} · اقتصادياً: طاقة ${Math.round(monthly.industrialCapacity??0)}، مواد ${Math.round(monthly.materials??0)}، وقود ${Math.round(monthly.fuel??0)} لكل دورة · عسكرياً: ذخيرة ${Math.round(military.ammo)}، مواد ${Math.round(military.materials)}، وقود ${Math.round(military.fuel)} في سجل الإنتاج؛ يُضاف رصيد المصنع والمصفاة للمخازن كل أربعة أدوار.`;
 dialog.querySelectorAll('[data-policy]').forEach(el=>el.value=battle.publicReports?.policy?.blue?.[el.dataset.policy]??(el.dataset.policy==='operations'?'hidden':'summary'));const target=$('operationTarget'),oldTarget=target.value;target.replaceChildren();for(const item of [...battle.sites.filter(x=>x.owner==='red'),...facilityTargets(battle).filter(t=>t.side==='red'&&!t.asset.disabled)]){const op=document.createElement('option');op.value=item.id;op.textContent=item.name??item.asset?.name??item.id;target.append(op)}if([...target.options].some(o=>o.value===oldTarget))target.value=oldTarget;const brief=battle.commandBriefings?.blue?.at(-1);$('operationBriefing').textContent=brief?`للقيادة · الجولة ${brief.turn}: ${brief.text}`:'لا توجد خطة عمليات مسجلة بعد.';const reports=(battle.publicReports?.items??[]).slice(-12).reverse();$('publicReports').innerHTML=reports.length?reports.map(item=>`<div>${escapeHTML(publicReportText(battle,item,'blue'))}</div>`).join(''):'لا توجد تقارير مسجلة بعد.';
}
function escapeHTML(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function renderAll(){renderIntelligence({battle,isUnitDetected,focusPoint,setHint,renderAll,busy:()=>uiBusy||window.__REBEL_LAB__?.airBusy?.()});syncFacilities(battle);prepareAirDefense({battle,centers,groups,svg,el,HEX_RADIUS,setHint,focusPoint,canPlaceFacility,hexDistance,GRID});refreshTerritory();renderLogistics();decorateFacilities();renderUnits();renderOrders();renderTacticalOverlays();updateUI();renderDronePlanner();renderCampaignLayer();renderStrategicPanel()}

const supplyDialog=document.getElementById('supplyPanel');document.getElementById('openSupply').onclick=()=>{renderSupplyPanel();supplyDialog.showModal()};document.getElementById('closeSupply').onclick=()=>supplyDialog.close();document.getElementById('toggleAutoSupply').onclick=()=>{const depot=battle.logistics.depots.find(d=>d.side==='blue');if(!depot||depot.disabled)return;depot.auto=!depot.auto;renderAll()};document.getElementById('dispatchSupply').onclick=()=>{if(selectedUnit()&&selectedUnit().role!=='supplyTruck')requestSupplyConvoy(battle,selectedId);renderAll()};
document.getElementById('droneSourceSelect').addEventListener('change',event=>{const value=event.currentTarget.value;droneLaunchActive=false;activeDroneBaseId=null;if(value.startsWith('base:')){activeDroneBaseId=value.slice(5);const base=battle.droneBases.find(b=>b.id===activeDroneBaseId);focusPoint(base)}else if(value.startsWith('unit:')){selectedId=value.slice(5);const sourceUnit=battle.units.find(u=>u.id===selectedId);focusPoint(sourceUnit)}renderAll();setHint(activeDroneSource()?'تم تحديد مصدر الإطلاق. اختر نوع المسيرة ثم اضغط «اختيار الهدف» وحدد وحدة معادية.':'اختر مصدر إطلاق صالحاً.');});
document.getElementById('droneLaunchOrder').addEventListener('click',()=>{if(uiBusy)return;const source=activeDroneSource();if(!source){setHint('اختر مصدر الإطلاق من القائمة أولاً.');return}droneLaunchActive=!droneLaunchActive;renderAll();setHint(droneLaunchActive?'الخطوة ٣: اضغط المبنى المعادي نفسه داخل نطاق الإطلاق الملوّن.':'أُلغي تحديد الهدف.')});document.getElementById('droneType').addEventListener('change',()=>{renderAll();if(droneLaunchActive)setHint(`المدى الحالي ${activeDroneRange()} خلايا. اختر وحدة أو مبنى محدداً أو مركز إمداد أو قاعدة أو دفاعاً جوياً معادياً ضمن المدى الملوّن.`)});
document.getElementById('holdOrder').addEventListener('click',()=>{const unit=selectedUnit();if(unit&&!uiBusy&&issueHold(battle,unit.id)){renderAll()}});
document.getElementById('regroupOrder').addEventListener('click',()=>{const unit=selectedUnit();if(!unit||uiBusy)return;const cancelling=!!unit.order?.regroup,ok=cancelling?cancelRegroup(battle,unit.id):issueRegroup(battle,unit.id);setHint(ok?(cancelling?'أُلغي التجمع؛ عاد الفصيل متاحاً.':'بدأت إعادة التنظيم قرب مدينة آمنة؛ تستعيد الوحدة معنوياتها جولتين ولا تستعيد الذخيرة أو الخسائر.'):'يلزم وجود الوحدة داخل مدينة صديقة غير متنازع عليها ومن دون تهديد قريب.');renderAll()});
document.getElementById('artilleryOrder').addEventListener('click',()=>{const unit=selectedUnit();if(!unit||!['fieldArtillery','katyusha','mortar'].includes(unit.role))return;artilleryTargeting=!artilleryTargeting;engineeringMode='';renderAll();setHint(artilleryTargeting?'اختر هدفاً أو أرضاً ضمن المدى. للإلغاء اضغط الزر مجدداً أو Esc أو اختر وحدة صديقة.':'أُلغي توجيه القصف.')});
document.getElementById('fortifyOrder').addEventListener('click',()=>{const unit=selectedUnit();if(unit?.kind==='engineer'&&buildFieldFortification(battle,unit.id)){renderAll();setHint('حصّن المهندس موقعه؛ تقل الأضرار على المدافعين في هذه الخلية.')}});
document.getElementById('mineOrder').addEventListener('click',()=>{engineeringMode=engineeringMode==='mine'?'':'mine';artilleryTargeting=false;renderAll();setHint(engineeringMode?'اختر خلية صديقة مجاورة فارغة لزرع اللغم.':'أُلغي وضع زرع الألغام.')});
document.getElementById('clearMineOrder').addEventListener('click',()=>{engineeringMode=engineeringMode==='clear'?'':'clear';artilleryTargeting=false;renderAll();setHint(engineeringMode?'اختر لغم المتمردون المكشوف بجوار المهندس.':'أُلغي وضع إزالة الألغام.')});
document.getElementById('ambushOrder').addEventListener('click',()=>{const unit=selectedUnit();if(unit&&!uiBusy&&issueAmbush(battle,unit.id)){renderAll()}});
document.getElementById('endTurn').addEventListener('click',()=>{if(!uiBusy)void playEnemyTurn()});
document.getElementById('resetBattle').addEventListener('click',()=>{battle=createBattle();selectedId='blue-drone-team-1';uiBusy=false;droneLaunchActive=false;activeDroneBaseId=null;visualMove=null;visualConvoys.clear();actingEnemyId=null;drawCities();renderAll();focusFront()});




function mapPoint(event){const p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;return p.matrixTransform(svg.getScreenCTM().inverse())}
svg.addEventListener('pointerdown',event=>{drag={x:event.clientX,y:event.clientY,view:{...view},moved:false}});
svg.addEventListener('pointermove',event=>{if(!drag)return;const rect=svg.getBoundingClientRect(),dx=(event.clientX-drag.x)/rect.width*view.w,dy=(event.clientY-drag.y)/rect.height*view.h;if(Math.abs(dx)+Math.abs(dy)>4)drag.moved=true;view={...drag.view,x:drag.view.x-dx,y:drag.view.y-dy};if(drag.moved){svg.setPointerCapture(event.pointerId);skipClick=true;svg.classList.add('dragging')}applyView()});
svg.addEventListener('pointerup',()=>{const wasDragging=drag?.moved;drag=null;svg.classList.remove('dragging');if(wasDragging){renderUnits();setTimeout(()=>{skipClick=false},0)}});svg.addEventListener('pointercancel',()=>{const wasDragging=drag?.moved;drag=null;skipClick=false;svg.classList.remove('dragging');if(wasDragging)renderUnits()});
function applyView(){svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);scaleSymbols()}
function zoom(factor){const w=Math.max(900,Math.min(THEATER.width,view.w*factor)),h=w*view.h/view.w;view={x:view.x+(view.w-w)/2,y:view.y+(view.h-h)/2,w,h};applyView();renderUnits()}
document.getElementById('zoomIn').addEventListener('click',()=>zoom(.78));document.getElementById('zoomOut').addEventListener('click',()=>zoom(1.28));document.getElementById('zoomFull').addEventListener('click',()=>{view={x:0,y:0,w:THEATER.width,h:THEATER.height};applyView();renderUnits()});


const terrainButton=document.createElement('button');terrainButton.type='button';terrainButton.textContent='الجبال والممرات';document.querySelector('.map-tools').append(terrainButton);
const terrainGuide=document.createElement('dialog');terrainGuide.className='rebel-terrain-guide';terrainGuide.dir='rtl';terrainGuide.innerHTML='<h2>الجبال جزء من المعركة</h2><p>القمم الصخرية تعبرها المشاة. الدبابات والمركبات الثقيلة تستخدم السفوح والممرات المعلّمة بالذهبي.</p><p>الجبل يحجب الرؤية والنيران المباشرة خلفه. الموقع المرتفع يزيد مدى مشاهدة المشاة، لكنه لا يكشف خلف قمة أعلى.</p><p>الغطاء يقلل ضرر الضربات، ولا يجعل القوة محصنة. المدفعية والطيران قادران على ضرب الموضع الجبلي.</p><p>الممرات مهمة لعبور المدرعات وقوافل الإمداد. قوات الطرفين تخضع للقواعد نفسها.</p><button type="button">رجوع للخريطة</button>';document.body.append(terrainGuide);terrainButton.onclick=()=>terrainGuide.showModal();terrainGuide.querySelector('button').onclick=()=>terrainGuide.close();

receiveAirlifts();window.addEventListener('storage',event=>{if(event.key===AIRLIFT_KEY)receiveAirlifts()});drawTerrain();renderAll();
function focusPoint(point){if(!point)return;const c=centers[point.y][point.x];view.x=c.x-view.w/2;view.y=c.y-view.h/2;view.x=Math.max(0,Math.min(THEATER.width-view.w,view.x));view.y=Math.max(0,Math.min(THEATER.height-view.h,view.y));applyView();renderUnits()}
function focusFront(){const r=svg.getBoundingClientRect();if(!r.width||!r.height){requestAnimationFrame(focusFront);return}view.w=innerWidth<700?3000:4000;view.h=view.w*r.height/r.width;view.x=3850-view.w/2;view.y=3100-view.h/2;view.x=Math.max(0,Math.min(THEATER.width-view.w,view.x));view.y=Math.max(0,Math.min(THEATER.height-view.h,view.y));applyView();renderUnits();const lead=battle.units.find(u=>u.id===selectedId&&u.strength>0);if(lead&&innerWidth<700)focusPoint(lead)}
const frontButton=document.createElement('button');frontButton.textContent='الجبهة';frontButton.onclick=focusFront;document.querySelector('.map-tools').prepend(frontButton);
focusFront();
window.addEventListener('resize',focusFront);


const keyDialog=document.getElementById('symbolGuide');
document.getElementById('openGuide').onclick=()=>keyDialog.showModal();
document.getElementById('closeGuide').onclick=()=>keyDialog.close();
for(const [kind,meta]of Object.entries(UNIT_SYMBOLS)){
 if(kind==='tank'||kind==='ifv')continue;
 const card=document.createElement('article');card.className='symbol-card';card.innerHTML=`<svg viewBox="-70 -64 140 128" aria-label="${meta.name}"><g class="unit-silhouette">${meta.shape}</g></svg><b>${meta.name}</b><small>${meta.state}</small>`;document.getElementById('symbolCards').append(card);
}

/* ORANE_DRONE_COMMAND_CENTER_2026_10 */

/* SUICIDE_DRONE_TARGETS_TURN_FX_2026_10 */

/* SUICIDE_DRONE_RELAUNCH_FX_FIX_2026_10 */

/* SUICIDE_DRONE_UNIT_SILHOUETTES_2026_10 */

/* SUICIDE_DRONE_OPERATOR_ICON_2026_10 */


// AIR_BATTLE_LAB_SHARED_GROUND_STATE
function renderCampaignLayer(){window.__REBEL_LAB__?.renderRefinery?.();renderCampaign({battle,svg,groups,selectedUnit,isUnitDetected,unitLabel,selectUnit,focusPoint,setHint,renderAll,reachableCells,performMove,showFacilityChoices,busy:()=>uiBusy||window.__REBEL_LAB__?.airBusy?.(),targeting:()=>uiBusy||droneLaunchActive||artilleryTargeting||engineeringMode||document.body.classList.contains('drone-planning')||window.__REBEL_LAB__?.airTargeting?.()});}
window.__REBEL_LAB__={automaticRunning:()=>autoControl.running,renderCampaign:renderCampaignLayer,consumeMapDrag:()=>{const value=skipClick;skipClick=false;return value;},groundBusy:()=>uiBusy,get battle(){return battle},get centers(){return centers},get groups(){return groups},get svg(){return svg},el,setHint,renderAll,wait,focusPoint,followFriendlyAirPoint,hexDistance,THEATER,GRID,HEX_RADIUS};

async function playGroundExchanges(){
 const exchanges=takeExchanges(battle);
 for(const event of exchanges){
  if(event.kind==='reaction')setHint('ردّ دفاعي فوري');
  else if(event.kind==='ambush')setHint('انكشف كمين أثناء التقدم!');
  await groundShot(event.attacker,event.target,event.damage);
 }
}
function decorateFacilities(){
 for(const target of facilityTargets(battle)){
  if(target.id.startsWith('campaign:'))continue;
  const selector=target.type==='refinery'?`[data-refinery-id="${target.asset.id}"]`:target.id.startsWith('campaign:')?`[data-campaign-id="${target.asset.id}"]`:target.type==='depot'?`.supply-depot[data-depot-id="${target.asset.id}"]`:target.type==='base'?`[data-drone-base-id="${target.asset.id}"]`:`[data-ad-id="${target.asset.id}"]`;
  let node=svg.querySelector(selector);
  if(!node&&target.type==='depot')node=[...groups.logistics.querySelectorAll('.supply-depot')].find(n=>n.getAttribute('transform')===`translate(${centers[target.y][target.x].x} ${centers[target.y][target.x].y})`);
  if(!node)continue;
  node.dataset.facilityId=target.id;if(!node.querySelector('.facility-hit-area')){const hit=el('rect',{x:-72,y:-70,width:144,height:162,rx:10,fill:'transparent',class:'facility-hit-area','pointer-events':'all'},node);node.insertBefore(hit,node.firstChild);}if(target.type==='depot')node.dataset.depotId=target.asset.id;
  node.classList.toggle('facility-destroyed',!!target.asset.disabled);if(!target.asset.disabled)node.querySelector('.facility-ruin')?.remove();
  if(target.asset.disabled&&!node.querySelector('.facility-ruin'))el('path',{d:'M-32 19L-20 5L-5 16L8-1L24 17L35 12M-30-20L30 25M30-20L-30 25',class:'facility-ruin'},node);
  if(node.dataset.groundCaptureBound)continue;node.dataset.groundCaptureBound='1';
  node.addEventListener('click',event=>{
   if(uiBusy||droneLaunchActive||engineeringMode||window.__REBEL_LAB__?.airTargeting?.()||window.__REBEL_LAB__?.airBusy?.())return;
   if(artilleryTargeting){event.stopImmediatePropagation();onCellClick(target.x,target.y);return;}
   if(target.asset.side==='blue')return;
   event.stopImmediatePropagation();if(quickSupportTarget(target.x,target.y))return;showFacilityChoices(target.id);
  },true);
 }
}
function showFacilityChoices(id){if(window.__REBEL_LAB__?.airTargeting?.()||window.__REBEL_LAB__?.airBusy?.())return;
 document.querySelector('.facility-choice')?.remove();
 const target=facilityTargets(battle).find(t=>t.id===id);if(!target)return;
 const panel=document.createElement('aside');panel.className='facility-choice';panel.dir='rtl';
 const text=document.createElement('p');text.textContent=target.name+' · '+(target.asset.disabled?'مدمر وخارج الخدمة':'الصحة '+target.hp+'/'+target.asset.structureMaxHp+' · ادخل خلية المقر للسيطرة بعد إبعاد حمايته');panel.append(text);
 const attackButton=document.createElement('button');attackButton.textContent='قصف المقر';const check=facilityAttackCheck(battle,selectedId,id);attackButton.disabled=!check.ok;attackButton.title=check.reason??'';
 attackButton.onclick=async()=>{panel.remove();if(uiBusy)return;uiBusy=true;renderAll();try{const result=issueFacilityAttack(battle,selectedId,id);if(result.ok)await playGroundExchanges();else setHint(result.reason??'تعذر الهجوم');}finally{uiBusy=false;renderAll();}};
 const move=document.createElement('button');move.textContent='التقدم للسيطرة';move.disabled=false;move.onclick=()=>{const path=reachableCells(battle,selectedId).find(c=>c.x===target.x&&c.y===target.y);if(!path){setHint('الموقع خارج حركة الوحدة لهذه الجولة أو طريقه مسدود.');return;}panel.remove();void performMove(selectedId,target.x,target.y,path.path);};
 const close=document.createElement('button');close.textContent='إغلاق';close.onclick=()=>panel.remove();panel.append(attackButton,move,close);document.body.append(panel);
}
const factionKey=document.createElement('div');factionKey.className='faction-key';factionKey.dir='rtl';
factionKey.innerHTML='<span><i></i>قواتك</span><span><i class="opponent"></i>المتمردون</span><span class="tier-key">★ إلى ★★★ قوة موديل المدرعة</span>';
document.querySelector('.map-tools')?.after(factionKey);

// Update strike damage without rebuilding territory, routes, planners or aircraft.
function renderStrikeDamage({unitIds=[],cells=[]}={}){
 syncFacilities(battle);
 for(const id of unitIds){
  const unit=battle.units.find(u=>u.id===id),card=groups.units.querySelector(`[data-unit-id="${id}"]`);
  if(!card)continue;if(!unit||unit.strength<=0){card.remove();continue;}
  const ratio=Math.max(0,Math.min(1,unit.hp/Math.max(1,unit.maxHp))),bar=card.querySelector('.unit-health-fill');
  if(bar){bar.setAttribute('width',112*ratio);bar.setAttribute('class','unit-health-fill '+(ratio>.62?'healthy':ratio>.3?'wounded':'critical'));}
  const count=card.querySelector('.squad-number');if(count&&unit.modelId)count.textContent=ARMOR_MODELS[unit.modelId].tag+' · '+unit.strength+'/'+unit.maxStrength;
  else if(count&&!['droneOperator','droneVehicle','supplyTruck','antiAir'].includes(unit.role))count.textContent=unitNo(unit.id)+' | '+unit.strength+'/'+unit.maxStrength;
  card.setAttribute('aria-label',unitLabel(unit)+' · الصحة '+unit.hp+'/'+unit.maxHp);
 }
 const affected=new Set();
 for(const cell of cells){
  for(const site of battle.sites)if(site.tiles?.some(t=>t.x===cell.x&&t.y===cell.y)||site.x===cell.x&&site.y===cell.y){
   affected.add(site);const hit=site.node?.querySelector(`[data-building-x="${cell.x}"][data-building-y="${cell.y}"]`),hp=mapObjectAt(battle,cell.x,cell.y,'building')?.hp??100;
   hit?.classList.toggle('building-damaged',hp<100);hit?.classList.toggle('building-destroyed',hp<=0);hit?.setAttribute('aria-label','مبنى · سلامة '+hp+'/100');
  }
 }
 for(const site of affected)refreshCitySymbols(site);
 for(const t of facilityTargets(battle)){const n=groups.logistics.querySelector(`[data-facility-id="${t.id}"]`);if(n){n.classList.toggle('facility-destroyed',!!t.asset.disabled);n.classList.toggle('disabled',!!t.asset.disabled);}}
 if(unitIds.includes(selectedId))renderOrders();
}
window.__REBEL_LAB__.renderStrikeDamage=renderStrikeDamage;

// Map-first drone planning. The map stays interactive above a compact bottom tray.
(()=>{
 const tray=document.createElement('section');tray.id='mapDroneTray';tray.dir='rtl';tray.hidden=true;document.body.append(tray);
 let sourceKey='',choosingSource=false,open=false;
 const sources=()=>[...battle.units.filter(u=>u.side==='blue'&&u.strength>0&&['droneOperator','droneVehicle'].includes(u.role)).map(u=>'unit:'+u.id),...battle.droneBases.filter(b=>b.side==='blue'&&!b.disabled&&b.industryRole!=='factory').map(b=>'base:'+b.id)];
 const types=new Map();const type=()=>types.get(sourceKey)||'auto';
 const button=(label,fn,disabled=false)=>{const b=document.createElement('button');b.textContent=label;b.disabled=disabled;b.onclick=fn;return b;};
 function close(){document.body.classList.remove('drone-planning');open=false;tray.hidden=true;choosingSource=false;}
 function choose(key){if(uiBusy||window.__REBEL_LAB__?.airBusy?.()||battle.phase!=='player'||battle.finished)return;if(!sources().includes(key))return;sourceKey=key;choosingSource=false;open=true;document.body.classList.add('drone-planning');window.dispatchEvent(new Event('rebel-cancel-air-target'));droneLaunchActive=false;document.getElementById('droneCommand').hidden=true;refresh();setHint('حدد من هدف إلى أربعة أهداف بالضغط على الخريطة.');}
 function refresh(){if(battle.phase!=='player'||battle.finished){close();return;}if(!open)return;tray.hidden=false;tray.replaceChildren();const source=plannerSourceFromKey(sourceKey);if(!source){close();return;}
 const head=document.createElement('div');head.className='map-plan-head';head.append(document.createTextNode(choosingSource?'اضغط منصة أو وحدة مسيرات تابعة لك على الخريطة':'حدد أهدافك على الخريطة · '+plannerSourceName(source)),button('إضافة منصة',()=>{choosingSource=true;refresh();}),button('تحريك الوحدة',()=>{const src=plannerSourceFromKey(sourceKey);close();if(src?.sourceId)selectUnit(src.sourceId);setHint('وضع الحركة: اضغط خلية مضيئة.');},!source.sourceId||uiBusy),button('إغلاق',close));tray.append(head);
 const tabs=document.createElement('div');tabs.className='map-plan-tabs';for(const key of new Set([sourceKey,...coordinatedDroneOrders.map(o=>o.sourceKey)])){const src=plannerSourceFromKey(key);if(src)tabs.append(button(plannerSourceName(src)+(key===sourceKey?' ✓':''),()=>choose(key),uiBusy));}tray.append(tabs);
 const select=document.createElement('select');select.setAttribute('aria-label','نوع المسيرة');select.add(new Option('تلقائي · الأنسب للهدف من المتوفر','auto'));for(const[k,v]of Object.entries(DRONE_MODELS))select.add(new Option(DRONE_ROLES[k]+' · مخزون '+plannerSourceStock(source,k),k));select.value=type();select.disabled=uiBusy;select.onchange=()=>{types.set(sourceKey,select.value);coordinatedDroneOrders=coordinatedDroneOrders.filter(o=>o.sourceKey!==sourceKey);refresh();};tray.append(select);
 const info=document.createElement('span');info.textContent=' متاح '+planCapacity(source,type())+' · محجوز '+planReserved(sourceKey)+' · أربعة أهداف كحد أقصى لكل منصة';tray.append(info);
 const rows=document.createElement('div');rows.className='map-plan-rows';
 coordinatedDroneOrders.filter(o=>o.sourceKey===sourceKey).forEach(o=>{const row=document.createElement('article'),label=document.createElement('span');label.textContent=o.targetName+' · '+DRONE_MODELS[o.type].name+' · '+(o.advice||'اختيار يدوي');row.append(label);
 for(const [key,name]of [['count','مسيرات / رشقة'],['salvos','رشقات']]){const l=document.createElement('label');l.textContent=name;const input=document.createElement('input');input.type='number';input.min='1';input.max='4';input.value=o[key];input.disabled=uiBusy;input.setAttribute('aria-label',name+' '+o.targetName);input.onchange=()=>{const old=o[key];o[key]=Math.max(1,Math.min(4,Math.trunc(+input.value)||1));if(!planFits(source,sourceKey)){o[key]=old;setHint('العدد يتجاوز المخزون أو حصة الجولة.');}refresh();};l.append(input);row.append(l);}row.append(button('حذف',()=>{coordinatedDroneOrders=coordinatedDroneOrders.filter(x=>x!==o);refresh();},uiBusy));rows.append(row);});
 if(!rows.children.length)rows.textContent='اضغط هدفاً معادياً ظاهراً لإضافته هنا.';tray.append(rows);
 const valid=coordinatedDroneOrders.length&&coordinatedDroneOrders.every(o=>{const src=plannerSourceFromKey(o.sourceKey);return src&&planFits(src,o.sourceKey)&&planCheck({...src,...planTargetOptions(o.targetId),typeId:o.type,side:'blue'}).ok;});
 tray.append(button('تنفيذ الهجمة · '+coordinatedDroneOrders.reduce((n,o)=>n+o.count*o.salvos,0)+' مسيرات',()=>void executeCoordinatedDroneAttack(),!valid||uiBusy||battle.phase!=='player'||battle.finished),button('مسح الخطة',()=>{coordinatedDroneOrders=[];refresh();},uiBusy));
 }
 function addTarget(id){
 const source=plannerSourceFromKey(sourceKey),rows=coordinatedDroneOrders.filter(o=>o.sourceKey===sourceKey);
 if(rows.some(o=>o.targetId===id)){setHint('الهدف مضاف؛ عدّل عدد المسيرات من الشريط.');return;}if(rows.length>=4){setHint('أربعة أهداف لكل منصة.');return;}
 const checks=Object.fromEntries(['light','standard','heavy'].map(t=>[t,planCheck({...source,...planTargetOptions(id),typeId:t,side:'blue'})]));
 const target=Object.values(checks).find(c=>c.ok)?.target;const ideal=preferredDrone(target);
 const usable=t=>checks[t].ok&&plannerSourceStock(source,t)>planReserved(sourceKey,t)&&planReserved(sourceKey)<planBudget(source);
 const chosen=type()==='auto'?[ideal,'standard','heavy','light'].find(usable):usable(type())?type():null;
 if(!chosen){setHint(type()==='auto'?'لا توجد مسيرة متاحة تناسب المدى وحصة الجولة. '+(checks[ideal].reason||''):checks[type()].reason||'النوع المحدد محجوز أو غير متوفر؛ جرّب الاختيار التلقائي.');return;}
 const check=checks[chosen],advice=type()!=='auto'?'اختيار يدوي':chosen===ideal?'الأنسب لهذا الهدف':'الأنسب '+DRONE_MODELS[ideal].name+' غير متاح بالمخزون أو المدى؛ البديل '+DRONE_MODELS[chosen].name;
 coordinatedDroneOrders.push({sourceKey,sourceName:plannerSourceName(source),targetId:id,targetName:check.target.name||unitLabel(check.target)+' · '+unitNo(check.target.id),type:chosen,advice,count:1,salvos:1});refresh();setHint(advice);
 }

 svg.addEventListener('click',e=>{if(!open||uiBusy||battle.phase!=='player')return;if(skipClick){skipClick=false;return;}const picked=pickMapTarget(e,{svg,battle,centers});if(!picked)return;const node=e.target.closest('[data-unit-id],[data-drone-base-id],[data-facility-id],[data-building-x]')||{dataset:{}};
 const unit=node.dataset.unitId&&battle.units.find(u=>u.id===node.dataset.unitId),base=node.dataset.droneBaseId&&battle.droneBases.find(b=>b.id===node.dataset.droneBaseId);
 e.stopImmediatePropagation();e.preventDefault();
 if(choosingSource){if(unit?.side==='blue')choose('unit:'+unit.id);else if(base?.side==='blue')choose('base:'+base.id);else setHint('حدد منصة أو وحدة مسيرات تابعة لك.');return;}
 if(unit){if(unit.side==='red')addTarget(unit.id);else{close();selectUnit(unit.id);}return;}if(base){if(base.side==='blue')choose('base:'+base.id);else addTarget('baseTarget:'+base.id);return;}if(node.dataset.facilityId){addTarget(node.dataset.facilityId);return;}if(node.dataset.buildingX){const x=+node.dataset.buildingX,y=+node.dataset.buildingY,site=battle.sites.find(s=>s.tiles.some(t=>t.x===x&&t.y===y));if(site)addTarget('site-tile:'+site.id+':'+x+':'+y);return;}if(picked.id)addTarget(picked.id);
 },true);
 document.getElementById('openDronePlanner').onclick=()=>{const source=activeDroneSource();choose(source?droneOrderSourceKey(source):sources()[0]);};
 document.getElementById('resetBattle').addEventListener('click',()=>{coordinatedDroneOrders=[];types.clear();close();});
 window.rebelMapPlanner={refresh,close,choose};
 document.getElementById('droneMoveMode').onclick=()=>{if(activeDroneBaseId){setHint('هذه منصة ثابتة؛ الحركة متاحة لعربات وفرق المسيرات.');return;}close();droneLaunchActive=false;activeDroneBaseId=null;renderAll();setHint('وضع الحركة: اختر خلية مضيئة لنقل الوحدة.');};
})();

document.getElementById('airBattleTargetMode').addEventListener('click',()=>window.rebelMapPlanner?.close(),true);

for(const name of []){} // ACTION-LIFECYCLE-09
const guardedMove=performMove,guardedAttack=performAttack,guardedDrone=performDroneLaunch;
function recoverAction(error){console.error(error);setHint('توقف تنفيذ الحركة؛ استُعيد التحكم. حاول أمراً آخر.');}
performMove=async function(...args){if(uiBusy||window.__REBEL_LAB__?.airBusy?.()||battle.phase!=='player')return;try{return await guardedMove(...args);}catch(e){recoverAction(e);}finally{uiBusy=false;visualMove=null;renderAll();}};
performAttack=async function(...args){if(uiBusy||window.__REBEL_LAB__?.airBusy?.()||battle.phase!=='player')return;try{return await guardedAttack(...args);}catch(e){recoverAction(e);}finally{uiBusy=false;visualMove=null;renderAll();}};
performDroneLaunch=async function(...args){if(uiBusy||window.__REBEL_LAB__?.airBusy?.()||battle.phase!=='player')return;try{return await guardedDrone(...args);}catch(e){recoverAction(e);}finally{uiBusy=false;droneLaunchActive=false;renderAll();}};
document.getElementById('resetBattle').addEventListener('click',e=>{if(uiBusy){e.stopImmediatePropagation();setHint('انتظر اكتمال الحركة الحالية قبل إعادة المعركة.');}},true);

window.addEventListener('rebel-enter-air-command',()=>{document.querySelector('.facility-choice')?.remove();window.rebelMapPlanner?.close();droneLaunchActive=false;artilleryTargeting=false;engineeringMode='';document.getElementById('droneCommand').hidden=true;});

// REBEL-COMMAND-24: cancellable ground automation; all actions use the player's existing checks.
function cancelGroundTargeting(){artilleryTargeting=false;engineeringMode='';droneLaunchActive=false;window.rebelMapPlanner?.close();window.dispatchEvent(new Event('rebel-cancel-air-target'));document.querySelector('.facility-choice')?.remove();renderAll();}
window.addEventListener('keydown',event=>{if(event.key==='Escape'){if(autoControl.running){autoControl.stop=true;updateAutoButton();}else cancelGroundTargeting();}});
const autoButton=document.createElement('button');autoButton.id='rebelAutoBattle';autoButton.type='button';autoButton.title='تشغيل أو إيقاف القوات والطيران والاستطلاع الآلي';
const paceButton=document.createElement('button');paceButton.id='rebelAutoPace';paceButton.type='button';paceButton.textContent='سريعة';paceButton.title='سرعة متابعة القتال: هادئة أو سريعة';
document.querySelector('.map-tools').prepend(autoButton,paceButton);
function updateAutoButton(){autoButton.textContent=autoControl.running?(autoControl.stop?'جارٍ الإيقاف…':'■ إيقاف الآلي'):'▶ قتال آلي';autoButton.setAttribute('aria-pressed',String(autoControl.running));autoButton.classList.toggle('active',autoControl.running);}
paceButton.onclick=()=>{autoControl.pace=autoControl.pace==='fast'?'calm':'fast';paceButton.textContent=autoControl.pace==='fast'?'سريعة':'هادئة';};
let lastAutomaticFocus=0;async function focusAutomatic(unit){const p=centers[unit.y]?.[unit.x];if(!p||performance.now()-lastAutomaticFocus<550)return;lastAutomaticFocus=performance.now();const start={...view},x=Math.max(0,Math.min(THEATER.width-view.w,p.x-view.w/2)),y=Math.max(0,Math.min(THEATER.height-view.h,p.y-view.h/2));for(let i=1;i<=24;i++){if(autoControl.stop)return;const t=i/24,e=t*t*(3-2*t);view.x=start.x+(x-start.x)*e;view.y=start.y+(y-start.y)*e;applyView();await wait(22);}}
function autoContacts(){return battle.units.filter(u=>u.side==='red'&&u.strength>0&&u.domain!=='air'&&isUnitDetected(battle,u,'blue'));}
function friendlyGarrison(site){return battle.units.filter(u=>u.side==='blue'&&u.strength>0&&u.role!=='supplyTruck'&&!['commander','jammer','reconRadar','droneOperator','droneVehicle'].includes(u.role)).sort((a,b)=>hexDistance(a,site)-hexDistance(b,site))[0]??null;}
function chooseAutomaticFront(){const contacts=autoContacts(),friends=battle.units.filter(u=>u.side==='blue'&&u.strength>0&&u.role!=='supplyTruck');if(contacts.length){return contacts.slice().sort((a,b)=>{const score=t=>targetScore({role:'antiArmor'},t,contacts,hexDistance)+friends.filter(f=>hexDistance(f,t)<=5).length*2-Math.min(...friends.map(f=>hexDistance(f,t)))*.8;return score(b)-score(a)})[0];}const intel=knownTargets(battle).filter(r=>r.status==='observed'&&r.age<=1),assets=facilityTargets(battle).filter(t=>t.side==='red'&&!t.asset.disabled),targets=intel.map(r=>{const asset=assets.find(t=>t.asset.id===r.entityId);return asset?{id:r.entityId,x:r.x,y:r.y,side:'red',priority:asset.type==='commandPost'?18:asset.type==='droneFactory'?14:asset.type==='airDefense'?12:8}:null}).filter(Boolean);if(targets.length)return targets.sort((a,b)=>(b.priority-hexDistance(b,friends[0]??{x:0,y:0}))-(a.priority-hexDistance(a,friends[0]??{x:0,y:0})))[0];return battle.sites.filter(s=>s.owner==='red').sort((a,b)=>hexDistance(a,friends[0]??{x:0,y:0})-hexDistance(b,friends[0]??{x:0,y:0}))[0]??null;}
async function autoUnitOrder(id){
 const unit=battle.units.find(u=>u.id===id&&u.strength>0);if(!unit||unit.attacked||unit.airliftReserved||unit.order?.regroup&&battle.turn<unit.order.regroup.until)return;
 if(getArmisticeState(battle).active){const rear=truceWithdrawal(battle,unit,reachableCells(battle,id),autoContacts());if(rear)await performMove(id,rear.x,rear.y,rear.path);else issueHold(battle,id);return;}
 const assignment=frontOrder(battle,unit,autoContacts()),contacts=assignment.contacts,support=!!SUPPORT_PROFILES[unit.role],drone=['droneOperator','droneVehicle'].includes(unit.role);
 selectedId=id;renderAll();const cameraTarget=unit.role==='commander'||contacts?.some?.(e=>hexDistance(unit,e)<=5);if(cameraTarget)await focusAutomatic(unit);if(autoControl.stop)return;
 const primary=assignment.goal,ranked=contacts.slice().sort((a,b)=>(targetScore(unit,b,contacts,hexDistance)+(b.id===primary?.id?22:0))-(targetScore(unit,a,contacts,hexDistance)+(a.id===primary?.id?22:0)));
 if(unit.role==='commander'){const threat=contacts.filter(e=>hexDistance(unit,e)<=5).sort((a,b)=>hexDistance(unit,a)-hexDistance(unit,b))[0];if(threat){const rear=reachableCells(battle,id).filter(c=>battle.owners[c.y*GRID.columns+c.x]==='blue').sort((a,b)=>hexDistance(b,threat)-hexDistance(a,threat)||a.cost-b.cost)[0];if(rear)await performMove(id,rear.x,rear.y,rear.path);else issueHold(battle,id);}else issueHold(battle,id);return;}
 if(drone&&contacts.some(e=>hexDistance(unit,e)<=unitAttackRange(e)+1)){const safe=reachableCells(battle,id).filter(c=>battle.owners[c.y*GRID.columns+c.x]==='blue');const score=c=>Math.min(8,...contacts.map(e=>hexDistance(c,e)))*3-hexDistance(c,{x:GRID.columns-3,y:Math.floor(GRID.rows/2)})-c.cost*.1;const rear=safe.sort((a,b)=>score(b)-score(a))[0];if(rear&&score(rear)>score(unit)){await performMove(id,rear.x,rear.y,rear.path);setHint('منصة المسيرات تنسحب إلى موضع صديق أبعد عن التهديد القريب.');}else issueHold(battle,id);return;}
 if((unit.morale<38||(unit.fatigue??0)>=65)&&battle.sites.some(s=>canRestLocally(battle,unit,s))&&!contacts.some(e=>hexDistance(unit,e)<=3)){issueRegroup(battle,id);return;}
 const threatenedCities=battle.sites.filter(site=>site.owner==='blue'&&contacts.some(e=>hexDistance(e,site)<=site.radius+3));for(const site of threatenedCities){const guard=friendlyGarrison(site);if(guard?.id===id&&hexDistance(unit,site)<=site.radius+1&&!contacts.some(e=>hexDistance(e,site)<=site.radius)){issueHold(battle,id);return;}}
 if((unit.ammo<unit.maxAmmo*.4||(unit.rations??6)<3)&&!drone)requestSupplyConvoy(battle,id);
 if(unit.kind==='engineer'){
  const es=engineeringState(battle,id);if(es?.clearTargets.length){const m=es.clearTargets[0];clearFieldMine(battle,id,m.x,m.y);renderAll();return;}
  const jobs=engineerRepairJobs(battle,unit);for(const job of jobs){if(hexDistance(unit,job.a)<=2){const r=queueEngineerRepair(battle,unit,job.id);if(r.ok){setHint(r.reason);issueHold(battle,id);return;}}}
  const job=jobs[0];if(job&&!unit.moved){const cell=reachableCells(battle,id).filter(c=>!contacts.some(t=>hexDistance(c,t)<=2)).sort((a,b)=>hexDistance(a,job.a)-hexDistance(b,job.a))[0];if(cell&&hexDistance(cell,job.a)<hexDistance(unit,job.a)){await performMove(id,cell.x,cell.y,cell.path);if(hexDistance(unit,job.a)<=2)queueEngineerRepair(battle,unit,job.id);return;}}
 }
 if(drone){for(let n=0;n<4&&droneAllowance(battle,unit)>0&&!autoControl.stop;n++){const choice=bestEnemyDrone(unit,'blue');if(!choice)break;document.getElementById('droneType').value=choice.type.id;await performDroneLaunch(choice.target.id,'blue',{sourceId:id,point:unit});}if(unit.strength<=0)return;}
 if(support){
  const radius=SUPPORT_PROFILES[unit.role].radius;
  const candidates=ranked.filter(t=>civilianStrikeAllowed(battle,t,{area:true})&&canFireArtillery(battle,id,t.x,t.y,'blue').ok).map(t=>({t,score:targetScore(unit,t,contacts,hexDistance)+(t.id===primary?.id?22:0)+contacts.filter(v=>hexDistance(v,t)<=radius).length*8})).sort((a,b)=>b.score-a.score);
  if(candidates[0]){await performSupportFire(unit,candidates[0].t.x,candidates[0].t.y);return;}
 }else if(directWeapon(unit)){
  // Current-position shots first; never plan through unseen enemy units.
  const currentTargets=ranked.filter(t=>hexDistance(unit,t)<=unitAttackRange(unit));
  const plans=(currentTargets.length?currentTargets:ranked.slice(0,3)).map(t=>({t,p:attackApproaches(battle,id,t.id)[0]})).filter(v=>v.p).sort((a,b)=>a.p.cost-b.p.cost);
  if(plans[0]){await performAttack(id,plans[0].t.id);return;}
 }
 if(unit.moved||unit.attacked)return;
 const information=knownTargets(battle);const hostile=facilityTargets(battle).filter(t=>t.side==='red'&&!t.asset.disabled&&information.some(r=>r.entityId===t.asset.id&&r.status==='observed'&&r.age<=1));
 if(!contacts.length){
  const facility=hostile.find(t=>facilityAttackCheck(battle,id,t.id).ok);
  if(facility){uiBusy=true;try{issueFacilityAttack(battle,id,facility.id);await playGroundExchanges();}finally{uiBusy=false;renderAll();}return;}
  if(support){const t=hostile.find(t=>civilianStrikeAllowed(battle,t,{area:true})&&canFireArtillery(battle,id,t.x,t.y,'blue').ok);if(t){await performSupportFire(unit,t.x,t.y);return;}}
 }
 const cells=reachableCells(battle,id);if(!cells.length){issueHold(battle,id);return;}
 const fragile=support||drone||unit.weaponId==='kornet'||['commander','jammer','reconRadar','antiAir'].includes(unit.role)||unit.modelId==='strykerAA';
 const retreat=unit.hp/unit.maxHp<.35||(!drone&&unit.maxAmmo>0&&unit.ammo<1);
 const friendly=battle.units.filter(u=>u.side==='blue'&&u.strength>0&&u.id!==id);
 let goal=primary??ranked[0];if(!goal){goal=[...hostile,...battle.sites.filter(s=>s.owner==='red')].sort((a,b)=>hexDistance(unit,a)-hexDistance(unit,b))[0];}
 if(!goal){issueHold(battle,id);return;}
 if(assignment.guard&&hexDistance(unit,goal)<=(goal.radius??2)&&!contacts.some(t=>hexDistance(unit,t)<=unitAttackRange(unit))){issueHold(battle,id);return;}
 const desired=assignment.guard?2:fragile?Math.max(3,Math.min(6,unitAttackRange(unit)-1)):1;
 const score=c=>{
  const gap=hexDistance(c,goal),danger=contacts.reduce((sum,e)=>sum+(hexDistance(c,e)<=unitAttackRange(e)?(e.role==='antiArmor'&&unit.modelId?5:2):0),0);
  const allies=friendly.filter(f=>hexDistance(c,f)<=2).length;
  return (retreat?Math.min(8,...contacts.map(e=>hexDistance(c,e)))*4:fragile?-Math.abs(gap-desired)*2:-gap*3)-danger*(fragile?2:policy(battle).tempo==='cautious'?2:policy(battle).tempo==='press'?.65:1)+Math.min(3,allies)*.5-c.cost*.12;
 };
 const current={x:unit.x,y:unit.y,cost:0,path:[]},best=[current,...cells].sort((a,b)=>score(b)-score(a))[0];
 if(best.path.length)await performMove(id,best.x,best.y,best.path);else issueHold(battle,id);
 if(unit.kind==='engineer'&&!unit.fieldActionUsed)buildFieldFortification(battle,id);
}
function answerArmisticeAsAI(side){
 const state=getArmisticeState(battle),proposal=state.proposals.find(item=>item.id===state.pending&&item.status==='pending');
 if(!proposal||proposal.to!==side)return'none';
 const judgment=assessArmisticeDecision(battle,side,proposal);answerArmistice(battle,judgment.action,judgment.rounds,side);return judgment.action;
}
function processAutomaticArmistice(){const state=getArmisticeState(battle);if(!state.active&&!state.proposals.some(p=>p.status==='pending'))maybeOfferArmisticeForAI(battle,'blue');for(let n=0;n<3;n++){const p=state.proposals.find(p=>p.id===state.pending&&p.status==='pending');if(!p)break;answerArmisticeAsAI(p.to);}renderAll();}
async function runRebelAutomatic(){
 if(autoControl.running||uiBusy||battle.phase!=='player'||battle.finished||window.__REBEL_LAB__?.airBusy?.())return;
 cancelGroundTargeting();autoControl.running=true;autoControl.stop=false;autoControl.snapshot=battle;updateAutoButton();
 try{while(!autoControl.stop&&!battle.finished&&battle===autoControl.snapshot){
  if(battle.phase!=='player')break;while(presentationPending(battle)&&!autoControl.stop)await wait(100);if(autoControl.stop)break;
  processAutomaticArmistice();if(autoControl.stop||battle.finished)break;
  const intel=battle.intelligence.blue;if(intel.missions.filter(m=>m.status==='active').length<2){const failed=knownTargets(battle,'blue').find(r=>battle.evidenceLedger?.blue?.[r.x+','+r.y]?.failures>0&&!intel.missions.some(m=>m.reportId===r.id));if(failed)orderIntel(battle,'verify',failed.id);else orderIntel(battle,battle.turn%2?'signals':'human');}
  const sortie=window.__REBEL_LAB__?.startAutomaticAir?.();if(sortie)sortie.catch(recoverAction);
  while(window.__REBEL_LAB__?.airBusy?.()){if(autoControl.stop||battle!==autoControl.snapshot)return;await wait(250);}
  markLocalParticipants(battle);const ids=battle.units.filter(u=>u.side==='blue'&&u.strength>0&&u.role!=='supplyTruck'&&!u.airliftReserved).map(u=>u.id);
  for(const id of ids){if(autoControl.stop||battle.finished||battle!==autoControl.snapshot)break;try{await autoUnitOrder(id);}catch(error){recoverAction(error);uiBusy=false;visualMove=null;renderAll();}await wait(50);}
  if(autoControl.stop||battle.finished||battle!==autoControl.snapshot)break;
  while(window.__REBEL_LAB__?.hasActiveSorties?.()){if(autoControl.stop||battle!==autoControl.snapshot)return;setHint('القتال الآلي ينتظر عودة الطلعات قبل إنهاء الجولة.');await wait(250);}
  if(sortie)await sortie;
  const limit=Math.min(6,Math.max(2,(battle.campaignAirbases??[]).filter(b=>b.side==='blue'&&!b.disabled).length));
  for(let flight=1;flight<limit&&!autoControl.stop&&!battle.finished;flight++){const launched=await window.__REBEL_LAB__?.startAutomaticAir?.();if(!launched)break;await wait(80);}
  if(autoControl.stop)break;const turn=battle.turn;await playEnemyTurn();if(battle.turn===turn&&!battle.finished)throw Error('لم تكتمل الجولة؛ توقف التشغيل الآلي واستُعيد التحكم.');await wait(150);
 }}catch(error){recoverAction(error);}finally{autoControl.running=false;autoControl.stop=false;autoControl.snapshot=null;autoControl.frontTarget=null;updateAutoButton();renderAll();}
}
autoButton.onclick=()=>{if(autoControl.running){autoControl.stop=true;updateAutoButton();}else void runRebelAutomatic();};
// Prevent user commands from racing an automated order. Stop and speed remain accessible.
document.addEventListener('click',event=>{if(!autoControl.running||event.target.closest('#rebelAutoBattle,#rebelAutoPace,#openArmisticePanel,#openStrategicPanel,#closeStrategicPanel'))return;if(event.target.closest('#mapSvg,svg,.command-dock,#endTurn,#resetBattle,.roster-unit,.map-tools')){event.preventDefault();event.stopImmediatePropagation();setHint('أوقف القتال الآلي لتصدر أوامرك يدوياً.');}},true);
updateAutoButton();
