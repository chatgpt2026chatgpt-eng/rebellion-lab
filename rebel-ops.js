import {aircraftMunitionFX,aircraftImpactFX} from '/rebel-air-visual-fx.js';
import {blastCover} from '/rebel-command-policy.js';
import {recordSortie} from '/rebel-situation-reports.js';
import {planAirOrder} from '/rebel-air-doctrine.js';
import {observeArea,knownTargets} from '/rebel-intelligence.js';
import {commandAttackFactor} from '/rebel-campaign.js';
import {makeReconRoute} from '/rebel-recon-route.js';
import {uavArtwork} from '/rebel-uav-art.js';
import {inspectCampaign} from '/rebel-campaign-view.js';
import {seedAirports,syncAirport,airportReady,civilianImpact,supplyDepot} from '/rebel-campaign.js';
import {facilityTargets,damageFacility} from '/rebel-facilities.js';
import {VIPER_LOAD,supportRoute,tankerArtwork,viperDetails} from '/rebel-air-support.js';
import {pickMapTarget} from '/rebel-map-picking.js';
import {createStealthImpactFX} from '/stealth-impact-fx.js';
import {AIRPORT_CELLS,GRID as MAP_GRID,movementCost} from '/rebel-terrain.js';
import {makeTacticalRoute,smoothAircraftRoute,flightPace,paceAt} from '/rebel-tactical-path.js';
import {tacticalAircraftArt} from '/rebel-tactical-art.js';
import {isUnitDetected} from '/rebel-artillery-sim.js';
import {recordEvidence} from '/rebel-command-policy.js';
import {coverMultiplier} from '/rebel-terrain.js';
import {impactFX,munitionFX} from '/rebel-combat-fx.js';
import {pollDefense,finishDefenseFlight} from '/rebel-defense.js';
import { ARMOR_MODELS, leaveHouse, attemptDroneInterception, hexDistance, damageMapObject } from '/rebel-sim.js';
import {getArmisticeState,maybeArmisticeIncident,breakArmistice} from '/rebel-political-systems.js';
import { buildStealthPlan, sampleProfile, trackPath, scheduleStealthPlan } from '/rebel-stealth-flight.js';


const NS='http://www.w3.org/2000/svg';
const MODELS={
 rq7:{name:'RQ-7B Shadow',range:24,speed:2500,damage:0,stock:2,kind:'fighter',airframe:'RQ7',recon:true,label:'استطلاع جبلي غير مسلح · كشف مؤقت'},
 mq9:{name:'MQ-9 Reaper',range:28,speed:2500,damage:62,stock:2,kind:'fighter',airframe:'MQ9',label:'مسيرة قصف عائدة · ضربة واحدة لكل طلعة'},
 ah1z:{name:'AH-1Z Viper',range:11,speed:2500,damage:38,stock:2,kind:'helicopter',airframe:'AH1Z',label:'استطلاع ومرافقة المسار'},
 a10:{name:'A-10C',range:18,speed:2700,damage:64,stock:2,kind:'fighter',airframe:'A10',label:'إسناد أرضي'},
 f16:{name:'F-16',range:20,speed:2100,damage:54,stock:4,kind:'fighter',airframe:'F16',label:'ضربة دقيقة'},
 mig29:{name:'MiG-29',range:17,speed:1900,damage:46,stock:3,kind:'fighter',airframe:'MIG29',label:'صاروخ جو-أرض'},
 su24:{name:'Su-24',range:22,speed:2300,damage:42,stock:3,kind:'bomber',airframe:'SU24',label:'قصف تكتيكي'},
 ah64:{name:'AH-64',range:9,speed:2500,damage:38,stock:3,kind:'helicopter',airframe:'AH64',label:'هجوم مروحي'},
 uh60:{name:'UH-60',range:14,speed:2400,damage:0,stock:2,kind:'transport',airframe:'UH60',label:'إنزال جوي'},
 stealth:{name:'قاذفة شبحية',range:26,speed:2400,damage:40,stock:2,kind:'stealth',label:'حزام قنابل · ٥ نقاط'}
};
const AIR_BATTLE_WEAPONS={rq7:{camera:{label:"مستشعر استطلاع · دون تسليح",standoff:0,damage:0}},mq9:{hellfire:{label:"صاروخ موجه",standoff:3,damage:.8},guided:{label:"قنبلة موجهة · قصف نقطة",standoff:2,damage:1}},ah1z:{hellfire:{label:'حمولة مرافقة مختلطة',standoff:3,damage:1}},a10:{maverick:{label:'صاروخ Maverick جو-أرض',standoff:3.8,damage:1.12},guided:{label:'قنبلة موجهة',standoff:2,damage:1}},f16:{glide:{label:'قنبلة انزلاقية موجهة',standoff:4.5,damage:1},agm:{label:'صاروخ جو-أرض بعيد',standoff:7,damage:1.08},guided:{label:'قنابل موجهة قصيرة المدى',standoff:2.5,damage:.96},freefall:{label:'قنابل سقوط حر',standoff:0,damage:1.06}},mig29:{guided:{label:'قنابل موجهة قصيرة المدى',standoff:2.5,damage:.96},freefall:{label:'قنابل سقوط حر',standoff:0,damage:1.06}},su24:{glide:{label:'قنبلة انزلاقية موجهة',standoff:4.5,damage:1},agm:{label:'صاروخ جو-أرض بعيد',standoff:7,damage:1.08},guided:{label:'قنابل موجهة قصيرة المدى',standoff:2.5,damage:.96},freefall:{label:'قنابل سقوط حر',standoff:0,damage:1.06}},ah64:{hellfire:{label:'صواريخ Hellfire الموجهة',standoff:3.7,damage:.42},rockets:{label:'صواريخ غير موجهة',standoff:1.3,damage:.30}}};
const AIR_BATTLE_DEFAULT_WEAPON={rq7:"camera",mq9:"guided",ah1z:'hellfire',a10:'maverick',f16:'glide',mig29:'guided',su24:'agm',ah64:'hellfire'};
const AIR_BATTLE_WEAPON_KEYS={rq7:["camera"],mq9:["guided","hellfire"],ah1z:['hellfire'],a10:['maverick','guided'],f16:['glide','agm','guided','freefall'],mig29:['guided','freefall'],su24:['glide','agm','guided','freefall'],ah64:['hellfire','rockets']};
const AIR_BATTLE_APPROACHES={offset:{label:'مسار جانبي مراوغ',bend:1,exposure:1},low:{label:'دخول منخفض',bend:1.28,exposure:.74},sead:{label:'مسار مضاد للرصد',bend:1.16,exposure:.84}};
const inventory=(f16,mig29,su24,stealth,ah64=0,uh60=0)=>({f16,mig29,su24,stealth,ah64,uh60,a10:f16>0?2:0});
const friendly=[
 {id:'ab-blue-1',side:'blue',name:'رأس الحربة',x:14,y:7,stock:inventory(5,3,2,2)},
 {id:'ab-blue-2',side:'blue',name:'الاختراق المنخفض',x:6,y:12,stock:inventory(4,3,2,2)},
 {id:'ab-blue-3',side:'blue',name:'صيادو الرادار',x:17,y:16,stock:inventory(3,3,2,2)},
 {id:'ab-blue-4',side:'blue',name:'الموجة السوداء',x:12,y:20,stock:inventory(5,2,4,3)},
 {id:'ab-blue-5',side:'blue',name:'قاعدة المروحيات',x:13,y:10,stock:inventory(0,0,0,0,6,6)}
];
friendly.forEach(base=>{if(base.side==='blue'&&base.stock.stealth>0)base.stock.stealth=4});
friendly.push(
 {id:'ab-red-1',side:'blue',name:'قاعدة فالين الجوية',x:33,y:6,stock:inventory(5,3,3,2,0,0)},
 {id:'ab-red-2',side:'blue',name:'قاعدة ميراف المتقدمة',x:24,y:9,stock:inventory(4,3,2,2,0,0)},
 {id:'ab-red-3',side:'blue',name:'قاعدة سيراف القتالية',x:29,y:17,stock:inventory(4,2,4,2,2,0)}
);
const hostile=[];friendly.forEach((base,i)=>{base.x=AIRPORT_CELLS[i][0];base.y=AIRPORT_CELLS[i][1];});
let api,battle,centers,groups,svg,baseLayer,commandMode=false,activeCraft='f16',isBusy=false,activeMissions=0,flightSequence=0,roundStamp=0;
let pendingStealthTarget=null,stealthPreviewLayer=null;
let groundReleased=false;
function releaseGroundControl(){if(groundReleased)return;groundReleased=true;if(battle.lastAirOrder)battle.lastAirOrder.state="returning";commandMode=false;supportPicking=false;status("اكتملت المهمة؛ يمكنك تحريك قواتك. الطائرات عائدة وغير متاحة لطلعة جديدة حتى تهبط.");api.renderAll();}
let supportPicking=false,supportPoints=[],supportPreview=null,tankerEscort=null;
for(const b of [...friendly,...hostile]){if(b.side==='blue'){b.stock.rq7=b.stock.f16>0||b.stock.ah64>0?2:0;b.stock.mq9=b.stock.f16>0?2:0;b.stock.ah1z=b.stock.ah64>0?2:0;b.tankers=b.stock.f16>0?2:0;}else{b.tankers=0;}b.initialStock={...b.stock};}
const $=id=>document.getElementById(id);
const status=(message,kind='')=>{const local=$('airSupportFeedback');if(local){local.textContent=message;local.dataset.state=kind;}const node=$('airBattleStatus');if(node){node.textContent=message;node.dataset.state=kind}};
const model=()=>MODELS[$('airBattleCraft').value]||MODELS.f16;
const bases=()=>[...friendly,...hostile];
const selectedBase=()=>friendly.find(base=>base.id===$('airBattleBase').value)||friendly[0];
const nfmt=n=>new Intl.NumberFormat('ar').format(n);
const dist=(a,b)=>hexDistance(a,b);
function node(tag,attrs={},parent){const e=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));if(parent)parent.append(e);return e}
function chooseFreeBasePositions(){for(const b of bases()){b.anchor??={x:b.x,y:b.y};let c={...b.anchor};if(!battle.owners?.[c.y*MAP_GRID.columns+c.x]){}let tries=0;while(tries++<18&&battle.units.some(u=>u.x===c.x&&u.y===c.y&&u.strength>0)){const dx=tries%2?1:-1;c={x:Math.max(1,Math.min(MAP_GRID.columns-2,b.x+dx*tries)),y:b.y}}b.x=c.x;b.y=c.y;b.stock={...b.initialStock};b.campaignAirborne={};b.maxHp=100;b.hp=100;b.disabled=false;b.turnStock={...b.stock};b.lastRefillTurn=battle.turn}}
function drawBase(base){}
function drawBases(){seedAirports(battle,bases());baseLayer.replaceChildren();for(const b of bases())syncAirport(battle,b);api.renderCampaign?.();}
function initBaseSelect(){const select=$('airBattleBase');select.replaceChildren();for(const b of friendly){const op=document.createElement('option');op.value=b.id;op.textContent=b.name;select.append(op)}select.value=friendly[0].id;syncBaseAircraft()}
const AIRCRAFT_SELECT_LABELS={rq7:"RQ-7B Shadow · استطلاع غير مسلح",mq9:"MQ-9 Reaper · مسيرة قصف عائدة",ah1z:'AH-1Z Viper · مرافقة واستطلاع',a10:'A-10C · إسناد أرضي',f16:'F-16 · مقاتلة متعددة المهام',mig29:'MiG-29 · مقاتلة اعتراضية',su24:'Su-24 · قاذفة تكتيكية',ah64:'AH-64 · مروحية قتالية',uh60:'UH-60 · مروحية إنزال',stealth:'قاذفة شبحية · قصف مساحة'};
function syncBaseAircraft(){const select=$('airBattleCraft'),base=selectedBase(),current=select.value,ids=Object.keys(MODELS).filter(id=>(base?.turnStock?.[id]??base?.stock?.[id]??0)>0);select.replaceChildren();for(const id of ids){const op=document.createElement('option');op.value=id;op.textContent=AIRCRAFT_SELECT_LABELS[id]||MODELS[id].name;select.append(op)}select.value=ids.includes(current)?current:(ids[0]||'');}
function settleAircraftRepairs(base){base.aircraftRepairs??=[];const done=base.aircraftRepairs.filter(r=>r.readyTurn!=null&&r.readyTurn<=battle.turn);for(const r of done){if(base.stock[r.craftId]!=null)base.stock[r.craftId]++;battle.events?.push(`عادت ${MODELS[r.craftId]?.name??r.craftId} إلى الخدمة في ${base.name} بعد الإصلاح.`);}base.aircraftRepairs=base.aircraftRepairs.filter(r=>!done.includes(r));}
function queueAircraftRepairs(base){if(!base||base.side!=='blue'||battle.phase!=='player'||battle.finished)return{ok:false,reason:'الصيانة متاحة خلال دورك فقط.'};base.aircraftRepairs??=[];const jobs=base.aircraftRepairs.filter(r=>r.readyTurn==null);if(!jobs.length)return{ok:false,reason:'لا توجد طائرات متضررة قابلة للإصلاح.'};if(!airportReady(battle,base,jobs[0].craftId))return{ok:false,reason:'المدرج أو الحظيرة لا يسمحان بالصيانة الآن.'};const depot=supplyDepot(battle,base);if(!depot)return{ok:false,reason:'الإصلاح يحتاج خط إمداد ومواد صيانة.'};let queued=0;for(const job of jobs){if(depot.spares<12)break;depot.spares-=12;job.readyTurn=battle.turn+1;queued++;}return queued?{ok:true,reason:`بدأ إصلاح ${queued} طائرة؛ تبقى خارج طلعات هذه الجولة وتعود عند بداية دورك القادم.`}:{ok:false,reason:'لا تكفي مواد الصيانة؛ تحتاج كل طائرة إلى 12 مادة.'};}
function markAirframeDamage(base,craftId,count){base.aircraftRepairs??=[];base.writtenOff??={};for(let i=0;i<count;i++){const roll=((battle.turn*1103515245+(base.id.length*31)+(flightSequence*17)+(i*997))>>>0)%100;base.stock[craftId]=Math.max(0,(base.stock[craftId]??0)-1);if(roll<72)base.aircraftRepairs.push({craftId,damage:35+(roll%45),readyTurn:null,damagedTurn:battle.turn});else base.writtenOff[craftId]=(base.writtenOff[craftId]??0)+1;}}
function refreshAirbaseStocks(){if(!battle)return;roundStamp=battle.turn;for(const base of bases()){settleAircraftRepairs(base);base.turnStock={...base.stock};base.lastRefillTurn=battle.turn;syncAirport(battle,base)}drawBases();syncBaseAircraft();refreshControls()}
function updateCommandTitle(){const id=$('airBattleCraft').value;const title=id==='stealth'?'مركز قيادة الطائرات الشبحية':(['ah64','uh60','ah1z'].includes(id)?'مركز قيادة المروحيات':'مركز قيادة الطيران التكتيكي');$('airBattleCommandTitle').textContent=title;}
function activateAirbase(base){document.querySelector('.facility-choice')?.remove();if(isBusy||api.groundBusy?.()||battle.phase!=='player')return;document.getElementById('campaignPanel')?.setAttribute('hidden','');window.dispatchEvent(new Event('rebel-enter-air-command'));clearSupportPlan();pendingStealthTarget=null;stealthPreviewLayer?.replaceChildren();commandMode=false;$('airBattleBase').value=base.id;syncBaseAircraft();$('airBattleCommand').hidden=false;$('droneCommand').hidden=true;document.querySelector('.command-dock').classList.add('contextual-active');refreshControls();updateCommandTitle();status(`${base.name}: اختر نوع الطائرة، ثم ${$('airBattleCraft').value==='stealth'?'اضغط تحديد منطقة القصف واختر مركز الحزام.':'حدد الهدف على الخريطة.'}`)}
function syncAirBattleMissionOptions(){const craft=$('airBattleCraft').value,stealth=craft==='stealth',weaponLabel=$('airBattleWeaponLabel'),weaponSelect=$('airBattleWeapon'),approachLabel=$('airBattleApproachLabel'),approachSelect=$('airBattleApproach'),patternLabel=$('airBattlePatternLabel');$('airBattleFocusLabel').hidden=!stealth;patternLabel.hidden=!stealth;patternLabel.setAttribute('aria-hidden',String(!stealth));if(!stealth)$('airBattlePattern').value='point';const pointPattern=$('airBattlePattern').querySelector('option[value=point]');if(pointPattern)pointPattern.hidden=stealth;if(stealth&&$('airBattlePattern').value==='point')$('airBattlePattern').value='horizontal';const allowed=AIR_BATTLE_WEAPON_KEYS[craft]||[],current=weaponSelect.value||AIR_BATTLE_DEFAULT_WEAPON[craft]||'';weaponLabel.hidden=!allowed.length;weaponSelect.replaceChildren();for(const id of allowed){const option=document.createElement('option');option.value=id;option.textContent=AIR_BATTLE_WEAPONS[craft][id].label;weaponSelect.append(option)}weaponSelect.value=allowed.includes(current)?current:(AIR_BATTLE_DEFAULT_WEAPON[craft]||allowed[0]||'');const previousApproach=approachSelect.value,approachMode=stealth?'stealth':'standard',approachChanged=approachSelect.dataset.mode!==approachMode,canApproach=stealth||(!!allowed.length&&craft!=='ah64');approachLabel.hidden=!canApproach;const approachChoices=stealth?[['radar-avoid','التفاف لتقليل كشف الرادار'],['offset','اقتراب جانبي'],['direct','مسار مباشر']]:[['offset','مسار جانبي مراوغ'],['low','دخول منخفض'],['sead','مسار مضاد للرصد']];if(approachChanged){approachSelect.replaceChildren(...approachChoices.map(([value,label])=>{const option=document.createElement('option');option.value=value;option.textContent=label;return option}));approachSelect.dataset.mode=approachMode}approachSelect.value=approachChanged?(stealth?'radar-avoid':'offset'):approachChoices.some(([value])=>value===previousApproach)?previousApproach:(stealth?'radar-avoid':'offset');$('airBattleBombCountLabel').hidden=!stealth;$('airBattleSpreadLabel').hidden=!stealth;const key=document.querySelector('.air-battle-key');if(key){key.textContent=stealth?`قاذفة شبحية · ${$('airBattleBombCount').value} قنابل لكل طائرة · قصف مساحة`:craft==='ah64'?'مروحية قتالية · اختر صواريخها وطريقة الاقتراب':craft==='uh60'?'مروحية إنزال · نقل قوات':craft==='su24'?'Su-24 · اختر القنابل أو صواريخ جو-أرض':'مقاتلة · اختر الذخيرة وطريقة الاقتراب';key.dataset.craftContext=craft}}
function refreshStealthPlan(){
 const visible=$('airBattleCraft').value==='stealth'&&!!pendingStealthTarget;
 const panel=$('airBattleStealthPlan');if(panel)panel.hidden=!visible;
 if(!stealthPreviewLayer)return;
 if(!visible){stealthPreviewLayer.replaceChildren();stealthPreviewLayer._plan=null;return;}
 const base=selectedBase(),target=pendingStealthTarget,pattern=$('airBattlePattern').value;
 const orders={sortieCount:Number($('airBattleCount').value)||1,bombCount:Number($('airBattleBombCount').value)||5,
  spread:Number($('airBattleSpread').value)||520,approachId:({'radar-avoid':'sead',offset:'offset',direct:'low'}[$('airBattleApproach').value]||'offset')};
 const key=JSON.stringify([base?.id,target,pattern,orders,battle.turn]);if(stealthPreviewLayer._previewKey===key&&stealthPreviewLayer.childElementCount)return;stealthPreviewLayer._previewKey=key;const plan=getStealthMissionPlan(base,target,pattern,orders);
 if(stealthPreviewLayer._plan!==plan||!stealthPreviewLayer.childElementCount){
  stealthPreviewLayer.replaceChildren();stealthPreviewLayer._plan=plan;
  stealthPreviewLayer.classList.add('stealth-v2-preview');drawStealthRoutes(stealthPreviewLayer,plan,true);
 }
 const text=$('airBattleStealthPlanText');
 if(text)text.textContent='القطاع '+(target.x+1)+'/'+(target.y+1)+' · '+orders.sortieCount+' طائرات بإقلاع متتابع · '+orders.bombCount+' قنابل لكل طائرة · '+(pattern==='vertical'?'حزام عمودي':'حزام أفقي')+' · '+(getStealthMissionPlan(base,target,pattern,orders).profiles[0].bombs.every(p=>Math.hypot(p.x-centers[target.y][target.x].x,p.y-centers[target.y][target.x].y)<200)?'تركيز الإصابة':'تغطية مع إصابة المركز')+' · النقاط الظاهرة هي مواقع الإصابة';
}

function refreshControls(){if(!battle)return;syncAirBattleMissionOptions();if(battle.phase==='player'&&battle.turn!==roundStamp){roundStamp=battle.turn;for(const b of bases()){b.turnStock={...b.stock};b.lastRefillTurn=battle.turn;syncAirport(battle,b)}drawBases()}const base=selectedBase(),craft=$('airBattleCraft').value,available=base?.turnStock?.[craft]??0;$('airBattleStock').textContent=nfmt(available)+' طائرة · '+(base?.name||'');$('airBattleTurnBadge').textContent='الجولة '+nfmt(battle.turn)+' · '+(battle.phase==='player'?'دورك':'دور العدو');const count=$('airBattleCount');for(const op of count.options){const num=Number(op.value);op.disabled=num>available||(craft==='uh60'&&num>1)}if(craft==='uh60')count.value='1';if(Number(count.value)>available)count.value=String(Math.max(1,Math.min(available,4)));$('airBattleTargetMode').disabled=available<1||battle.phase!=='player'||battle.finished||base?.disabled||!airportReady(battle,base,craft)||(craft==='stealth'&&!pendingStealthTarget&&!commandMode&&available<1);const stealthTarget=craft==='stealth';$('airBattleTargetMode').textContent=stealthTarget?(pendingStealthTarget?'تنفيذ الضربة الشبحية':commandMode?'إلغاء اختيار المنطقة':'تحديد منطقة القصف'):commandMode?'إلغاء تحديد الهدف':(craft==='rq7'?'تحديد منطقة الاستطلاع':'تحديد الهدف أو الأرض المفتوحة');const targetHint=document.querySelector('#airBattleCommand .air-battle-heading small');if(targetHint)targetHint.textContent=stealthTarget?'اختر مركز حزام القنابل داخل أرض العدو؛ لا يلزم الضغط على وحدة أو مبنى.':'اختر أي بيت أو نقطة للقصف؛ الأضرار تصيب ما يوجد في الخلية حتى لو كان صديقاً.';$('airBattleTargetMode').classList.toggle('armed',commandMode||!!pendingStealthTarget);refreshStealthPlan();refreshSupportUI()}

function previewStealthTarget(cell){if(!cell||!Number.isInteger(cell.x)||!Number.isInteger(cell.y))return;const base=selectedBase(),available=base?.turnStock?.stealth??0,count=Number($('airBattleCount').value)||1;if(battle.phase!=='player'||battle.finished){status('انتظر حتى يعود دور قواتك قبل اختيار منطقة القصف.','warn');return}if(!isEnemyOwnedCell(cell)){status('اختر مركز الحزام داخل أرض العدو.','warn');return}if(!base||base.disabled||dist(cell,base)>effectiveRange(MODELS.stealth)){status('مركز الحزام خارج مدى القاعدة؛ اختر منطقة أقرب أو قاعدة أخرى.','warn');return}if(available<count){status('المخزون في هذه القاعدة لا يكفي لعدد الطائرات المحدد.','warn');return}pendingStealthTarget={...cell};commandMode=false;refreshControls();status(`معاينة حزام ${$('airBattlePattern').value==='horizontal'?'أفقي':'عمودي'} · ${count} طائرات · ${$('airBattleBombCount').value} قنابل لكل طائرة · طول ${$('airBattleSpread').value}. اضغط «تنفيذ الضربة الشبحية» بعد مراجعة الحزام.`)}
function selectedCellFromEvent(event){
 const picked=pickMapTarget(event,{svg,battle,centers,bases:bases()});if(!picked)return null;
 const facility=facilityTargets(battle).find(t=>t.id===picked.id);
 return facility?{...picked,x:facility.x,y:facility.y,facility:facility.asset,id:facility.id}:picked;
}
function captureAirMapInput(event){
 if(!svg?.contains(event.target)||(!commandMode&&!supportPicking))return;
 // The airport chooser owns its campus click and redispatches a specific component.
 if(event.target.closest?.('[data-airport-campus]'))return;
 event.preventDefault();event.stopImmediatePropagation();
 if(battle.phase!=='player'||isBusy||api.groundBusy?.()){status('انتظر اكتمال الأمر الجاري وعودة دورك.','warn');return;}
 if(api.consumeMapDrag?.())return;
 const cell=selectedCellFromEvent(event);if(!cell){status('تعذر تحديد هذه النقطة؛ اضغط الهدف داخل الخريطة.','warn');return;}
 document.querySelector('.facility-choice')?.remove();
 if(supportPicking){if(supportPoints.length>=6){status('الحد ٦ نقاط؛ احذف نقطة لتعديل المسار.','warn');return;}if(supportPoints.at(-1)?.x===cell.x&&supportPoints.at(-1)?.y===cell.y)return;supportPoints.push({x:cell.x,y:cell.y});showSupportPlan();return;}
 if(model().kind==='stealth'){void previewStealthTarget(cell);return;}void mission(cell);
}

let refineryBattleRef=null,refineryVisualNode=null,refineryFireNode=null;
function ensureRefineryStyle(){if(document.getElementById('enemy-refinery-style'))return;const style=document.createElement('style');style.id='enemy-refinery-style';style.textContent='.enemy-oil-refinery{cursor:crosshair;filter:drop-shadow(0 9px 8px #1119)}.refinery-pad{fill:#4d514b;stroke:#252f2c;stroke-width:8}.refinery-plant-front{fill:#766f5a;stroke:#283432;stroke-width:7}.refinery-plant-side{fill:#4d5a50;stroke:#25312f;stroke-width:6}.refinery-tank-wall{fill:#9b9a7d;stroke:#293835;stroke-width:7}.refinery-tank-roof{fill:#c1b996;stroke:#293835;stroke-width:7}.refinery-tank-seam{fill:none;stroke:#5a675d;stroke-width:5}.refinery-column{fill:#798575;stroke:#202e2c;stroke-width:7}.refinery-column-band{fill:#c2ad78;stroke:#343b32;stroke-width:4}.refinery-pipe{fill:none;stroke:#b39d68;stroke-width:12;stroke-linecap:round;stroke-linejoin:round}.refinery-dark-window{fill:#273a39;stroke:#b6a979;stroke-width:3}.refinery-warning{fill:#d8b847;stroke:#303b35;stroke-width:4}.refinery-label-box{fill:#111d20;fill-opacity:.94;stroke:#df9872;stroke-width:4}.refinery-label{font:800 38px Tahoma,sans-serif;fill:#f3e7ca;paint-order:stroke;stroke:#172123;stroke-width:7}.refinery-hp{font:700 25px Tahoma,sans-serif;fill:#f3c48c;paint-order:stroke;stroke:#172123;stroke-width:6}.enemy-oil-refinery.damaged .refinery-tank-wall,.enemy-oil-refinery.damaged .refinery-plant-front{fill:#554a3d}.enemy-oil-refinery.destroyed .refinery-structure{opacity:.1;filter:grayscale(1)}.refinery-collapse-detail{opacity:0;pointer-events:none}.enemy-oil-refinery.destroyed .refinery-collapse-detail{opacity:1}.refinery-rubble{fill:#242725;stroke:#0c100f;stroke-width:7}.refinery-burn-mark{fill:#171b19;stroke:#080b0a;stroke-width:5}.refinery-fire-effect{pointer-events:none;filter:drop-shadow(0 2px 12px #000c)}.refinery-ground-smoke{fill:#252927;opacity:.48;filter:blur(15px);transform-box:fill-box;transform-origin:center;animation:refinery-smoke-cover 1.15s cubic-bezier(.12,.72,.2,1) both}.refinery-smoke-core{fill:#292d2b;opacity:.62;filter:blur(18px)}.refinery-smoke-puff{fill:#292d2b;opacity:.68;filter:blur(7px);transform-box:fill-box;transform-origin:center;animation:refinery-smoke-rise var(--time) linear var(--delay) infinite}.refinery-flame-lobe{fill:#ed6422;stroke:#a92e16;stroke-width:5;transform-box:fill-box;transform-origin:center;animation:refinery-fire-dance var(--time) ease-in-out var(--delay) infinite alternate}.refinery-flame-inner{fill:#ffd16c;stroke:#ed7626;stroke-width:3;transform-box:fill-box;transform-origin:center;animation:refinery-fire-dance 430ms ease-in-out infinite alternate}.refinery-spark{fill:#ffd179;animation:refinery-spark 1.1s ease-out infinite}.refinery-fire-tag{font:800 24px Tahoma,sans-serif;fill:#ffbf80;paint-order:stroke;stroke:#111817;stroke-width:6}.refinery-blast{pointer-events:none;transform-box:fill-box;transform-origin:center}.refinery-blast-flash{fill:#fff1ae;stroke:#ff9b3a;stroke-width:7;animation:refinery-blast-flash 780ms ease-out both}.refinery-blast-ring{fill:none;stroke:#ffc56b;stroke-width:12;animation:refinery-blast-ring 900ms ease-out both}.refinery-debris{fill:#343631;stroke:#0b0d0d;stroke-width:3;animation:refinery-debris 1050ms cubic-bezier(.1,.6,.25,1) both}.refinery-fire-tag{font:800 24px Tahoma,sans-serif;fill:#ffbf80;paint-order:stroke;stroke:#111817;stroke-width:6}@keyframes refinery-smoke-cover{0%{transform:scale(.12,.18);opacity:0}28%{transform:scale(1.18,.84);opacity:.98}100%{transform:scale(1.38,1.15);opacity:.96}}@keyframes refinery-smoke-rise{0%{transform:translate(0,0) scale(.32);opacity:.02}9%{opacity:.72}100%{transform:translate(var(--drift),-310px) scale(1.9);opacity:0}}@keyframes refinery-fire-dance{0%{transform:translate(0,0) rotate(-4deg) scale(.74,.82);opacity:.76}55%{transform:translate(var(--drift),-11px) rotate(5deg) scale(1.1,1.18);opacity:1}100%{transform:translate(calc(var(--drift)*-1),-3px) rotate(-3deg) scale(.88,1.04);opacity:.9}}@keyframes refinery-spark{0%{transform:translate(0,0);opacity:0}15%{opacity:1}100%{transform:translate(38px,-88px);opacity:0}}@keyframes refinery-blast-flash{0%{transform:scale(.2);opacity:1}35%{transform:scale(1.3);opacity:.98}100%{transform:scale(2.1);opacity:0}}@keyframes refinery-blast-ring{0%{transform:scale(.12);opacity:1}100%{transform:scale(2.6);opacity:0}}@keyframes refinery-debris{0%{transform:translate(0,0) rotate(0) scale(1);opacity:1}100%{transform:translate(var(--dx),var(--dy)) rotate(var(--rot)) scale(.35);opacity:0}}';document.head.append(style)}
function refineryAt(x,y){return (battle?.refineries??[]).find(refinery=>refinery.side==='red'&&refinery.hp>0&&refinery.tiles.some(tile=>tile.x===x&&tile.y===y))||null}
function refineryLabel(refinery){if(refinery.hp<=0)return'مصفاة النفط · مدمرة';if(refinery.hp<refinery.maxHp*.55)return'مصفاة النفط · متضررة بشدة';if(refinery.ignited)return'مصفاة النفط · تحترق';if(refinery.hp<refinery.maxHp)return'مصفاة النفط · متضررة';return refinery.side==='blue'?'مصفاة النفط الوطنية':'مصفاة النفط · منطقة التمرد'}
function drawEnemyRefinery(refinery){ensureRefineryStyle();const p=centers[refinery.y]?.[refinery.x];if(!p)return;const g=node('g',{class:'enemy-oil-refinery '+refinery.side+'-owned','data-refinery-id':refinery.id,transform:'translate('+p.x+' '+p.y+') scale(.48)'},groups.sites);refineryVisualNode=g;refinery.node=g;const structure=node('g',{class:'refinery-structure'},g);node('path',{d:'M-275 106L-216 148H235L282 108L238 72H-238Z',class:'refinery-pad'},structure);node('path',{d:'M-223 70H195V113H-223Z',class:'refinery-plant-front'},structure);node('path',{d:'M195 70L235 48V91L195 113Z',class:'refinery-plant-side'},structure);node('path',{d:'M-227 70L-198 47H219L195 70Z',class:'refinery-plant-front'},structure);node('path',{d:'M-165 84H-127V105H-165ZM-80 84H-42V105H-80ZM28 84H66V105H28ZM112 84H150V105H112Z',class:'refinery-dark-window'},structure);const tanks=[[-154,39,55],[-47,44,51],[113,40,59]];for(const [x,y,r]of tanks){const tank=node('g',{transform:'translate('+x+' '+y+')'},structure);node('path',{d:'M'+(-r)+' 0V-37A'+r+' 18 0 0 1 '+r+' -37V0A'+r+' 18 0 0 1 '+(-r)+' 0Z',class:'refinery-tank-wall'},tank);node('ellipse',{cx:0,cy:-37,rx:r,ry:18,class:'refinery-tank-roof'},tank);node('path',{d:'M'+(-r)+' -2A'+r+' 18 0 0 0 '+r+' -2',class:'refinery-tank-seam'},tank);node('path',{d:'M0-54V-66',class:'refinery-pipe'},tank)}const tower=node('g',{transform:'translate(24 -20)'},structure);node('path',{d:'M-30 66L-23-72Q0-94 23-72L30 66Z',class:'refinery-column'},tower);for(const y of [-54,-17,20])node('path',{d:'M-25 '+y+'H25',class:'refinery-column-band'},tower);node('path',{d:'M-20-70Q0-91 20-70',class:'refinery-column-band'},tower);for(const [x,y]of [[-13,-48],[13,-8],[-13,31]])node('rect',{x,y,width:12,height:15,rx:2,class:'refinery-dark-window'},tower);node('path',{d:'M-206 36H-176V16H-98V-4H-46M-92 25H-55V14H-2M76 38H154V16H205',class:'refinery-pipe'},structure);node('path',{d:'M-198 32V-82H-178V-6M174 19V-99H194V45',class:'refinery-column'},structure);node('path',{d:'M-203-82H-173M169-99H199',class:'refinery-column-band'},structure);node('path',{d:'M-232 111L-203 93L-181 99L-166 82L-123 87L-109 105L-77 96L-58 78L-22 89L-9 102L29 98L52 81L93 85L111 102L147 91L166 96L191 86L231 109V122H-232Z',class:'refinery-rubble refinery-collapse-detail'},g);node('path',{d:'M-233 101L-215 80L-198 101L-181 80L-164 101Z',class:'refinery-warning'},structure);node('rect',{x:-230,y:119,width:460,height:45,rx:8,class:'refinery-label-box'},g);const name=node('text',{x:0,y:151,'text-anchor':'middle',class:'refinery-label'},g);name.textContent=refineryLabel(refinery);const health=node('text',{x:0,y:192,'text-anchor':'middle',class:'refinery-hp','data-refinery-health':'true'},g);health.textContent='سلامة المنشأة '+refinery.hp+'/'+refinery.maxHp;if(refinery.hp<refinery.maxHp)for(let i=0;i<Math.min(6,Math.floor((refinery.maxHp-refinery.hp)/45));i++)node('path',{d:'M'+(-205+i*73)+' '+(43+(i%2)*32)+'l17-9 12 7-9 21-17 3Z',class:'refinery-burn-mark'},structure);g.addEventListener('click',event=>{event.stopPropagation();if(!commandMode)status(refineryLabel(refinery)+' · سلامة '+refinery.hp+'/'+refinery.maxHp+'.')});return g}
import { mapCellInfo as refineryMapCellInfo } from '/rebel-sim.js';
/* AIR_BATTLE_REFINERY_COMPACT_V2 */
function chooseRefineryCell(){
 if(!battle.mapCells)refineryMapCellInfo(battle,0,0);
 const urban=battle.sites.flatMap(s=>s.tiles||[{x:s.x,y:s.y}]);
 const occupied=[...bases(),...(battle.droneBases||[]),...(battle.airDefenses||[]),...(battle.logistics?.depots||[])];
 let best=null;
 for(let y=2;y<centers.length-2;y++)for(let x=2;x<(centers[y]?.length||0)-2;x++){
  const cell={x,y},info=battle.mapCells?.[`${x},${y}`];
  if(!info||info.terrain!=='land'||info.landUse!=='open'||info.objectIds?.length)continue;
  if(urban.some(t=>hexDistance(cell,t)<3)||occupied.some(t=>hexDistance(cell,t)<2)||battle.units.some(u=>u.strength>0&&hexDistance(cell,u)<2))continue;
  const score=hexDistance(cell,{x:41,y:30});
  if(!best||score<best.score)best={x,y,score};
 }
 return best;
}
function ensureEnemyRefinery(){
 if(!battle)return null;
 if(refineryBattleRef!==battle){refineryFireNode?.remove();refineryVisualNode?.remove();refineryFireNode=null;refineryVisualNode=null;refineryBattleRef=battle;}
 battle.refineries??=[];let refinery=battle.refineries.find(item=>item.id==='enemy-oil-refinery');
 if(!refinery||refinery.layoutVersion!==2){
  const cell=chooseRefineryCell();if(!cell){console.warn('لا توجد مساحة منفصلة مناسبة للمصفاة');return null;}
  refineryFireNode?.remove();refineryVisualNode?.remove();refineryFireNode=null;refineryVisualNode=null;
  if(!refinery){refinery={id:'enemy-oil-refinery',name:'مصفاة النفط',side:battle.owners[cell.y*centers[cell.y].length+cell.x],hp:360,maxHp:360,ignited:false};battle.refineries.push(refinery);}
  Object.assign(refinery,{x:cell.x,y:cell.y,tiles:[{x:cell.x,y:cell.y}],layoutVersion:2});
  // Reserve the footprint so future facility placement cannot overlap it.
  const slot=battle.mapCells[`${cell.x},${cell.y}`];slot.landUse='developed';
 }
 if(!refineryVisualNode?.isConnected){drawEnemyRefinery(refinery);updateEnemyRefinery(refinery);}
 if(refinery.ignited&&!refineryFireNode?.isConnected)igniteRefinery(refinery);
 return refinery;
}
function igniteRefinery(refinery,impactPoint=null){
 if(!refinery)return;refinery.ignited=true;
 const p=centers[refinery.y]?.[refinery.x];if(!p)return;
 const stage=refinery.hp<=0?'ruin':refinery.hp<refinery.maxHp*.55?'heavy':'light';
 if(!refineryFireNode?.isConnected||refineryFireNode.getAttribute('data-stage')!==stage){
  refineryFireNode?.remove();
  const fire=node('g',{class:'refinery-v2-fire','data-stage':stage,'data-refinery-fire':refinery.id,transform:`translate(${p.x} ${p.y}) scale(.48)`,'pointer-events':'none'},groups.effects);refineryFireNode=fire;
  const sources=stage==='light'?[[-115,25]]:stage==='heavy'?[[-115,25],[108,30]]:[[-92,85],[108,90]];
  for(const [index,[x,y]]of sources.entries()){
   const source=node('g',{transform:`translate(${x} ${y})`},fire);
   node('ellipse',{cx:0,cy:5,rx:32,ry:12,fill:'#b35c28',opacity:.3},source);
   node('path',{d:'M-22 5Q-34-15-12-34L-7-15Q8-35 2-53Q35-23 20 5Z',class:'refinery-v2-flame',style:`--delay:${-index*.37}s`},source);
   node('path',{d:'M-9 4Q-16-13-1-24Q15-8 8 4Z',fill:'#ffd184',class:'refinery-v2-ember'},source);
   for(let i=0;i<5;i++)node('ellipse',{cx:0,cy:-20,rx:20+i*2,ry:25+i*2,class:'refinery-v2-smoke',style:`--delay:${-(i*.86+index*.35)}s;--drift:${45+index*17}px;--rise:${stage==='light'?180:235}px;--time:4.3s`},source);
  }
 }
 const now=Date.now();if(impactPoint&&now-(refinery.lastBlastFx||0)>400){refinery.lastBlastFx=now;createRefineryBlast(impactPoint);}
}

function createRefineryBlast(point){const blast=node('g',{class:'refinery-blast',transform:'translate('+point.x+' '+point.y+')'},groups.effects);node('circle',{r:34,class:'refinery-blast-flash'},blast);node('circle',{r:28,class:'refinery-blast-ring'},blast);for(let i=0;i<10;i++){const angle=(i/10)*Math.PI*2,distance=85+(i%4)*24,dx=Math.cos(angle)*distance,dy=Math.sin(angle)*distance-35,rot=(i*83)%360,size=8+(i%4)*3;node('path',{d:'M0-'+size+'L'+size+' 0L0 '+size+'L-'+size+' 0Z',class:'refinery-debris',style:'--dx:'+dx+'px;--dy:'+dy+'px;--rot:'+rot+'deg'},blast)}setTimeout(()=>blast.remove(),1500)}

function updateEnemyRefinery(refinery){if(!refinery?.node?.isConnected)return;refinery.node.classList.toggle('damaged',refinery.hp<refinery.maxHp);refinery.node.classList.toggle('destroyed',refinery.hp<=0);const title=refinery.node.querySelector('.refinery-label');if(title)title.textContent=refineryLabel(refinery);const health=refinery.node.querySelector('[data-refinery-health]');if(health)health.textContent='سلامة المنشأة '+Math.max(0,refinery.hp)+'/'+refinery.maxHp}

function isEnemyTarget(cell){if(cell.unit)return cell.unit.side==='red'&&cell.unit.strength>0;if(cell.base)return cell.base.side==='red'&&!cell.base.disabled;if(cell.refinery)return cell.refinery.side==='red'&&cell.refinery.hp>0;const refinery=!!refineryAt(cell.x,cell.y);const direct=battle.units.some(u=>u.side==='red'&&u.strength>0&&dist(cell,u)===0);const site=battle.sites.some(s=>s.owner==='red'&&(s.structureHp??100)>0&&siteHasCell(s,cell.x,cell.y));const depot=battle.logistics?.depots?.some(d=>d.side==='red'&&!d.disabled&&dist(cell,d)===0);const defense=battle.airDefenses?.some(d=>d.side==='red'&&!d.disabled&&dist(cell,d)===0);return direct||site||depot||defense||refinery||battle.units.some(u=>u.side==='red'&&u.strength>0&&dist(cell,u)<=1)}
function isEnemyOwnedCell(cell){if(!cell||!Number.isInteger(cell.x)||!Number.isInteger(cell.y)||cell.x<0||cell.x>=MAP_GRID.columns||cell.y<0||cell.y>=MAP_GRID.rows)return false;return true}
function stealthTargetPrompt(){return 'اختر مركز حزام القنابل داخل أرض العدو؛ لا يلزم تحديد وحدة أو مبنى.'}
function missionTargetName(cell,craft){if(craft.recon)return 'منطقة استطلاع · القطاع '+(cell.x+1)+'/'+(cell.y+1);const facility=facilityTargets(battle).find(t=>t.id===cell.id||t.asset.id===cell.facility?.id);if(facility)return facility.asset.industryRole==='factory'?'مصنع تصنيع المسيرات':facility.name;const unit=cell.unit&&battle.units.find(u=>u.id===cell.unit.id);if(unit)return 'الوحدة '+unit.id;const refinery=cell.refinery||refineryAt(cell.x,cell.y);if(refinery)return refinery.name;if(craft.kind!=='stealth')return targetText(cell);const col=String(cell.x+1),row=String(cell.y+1);return `منطقة القصف · القطاع ${col}/${row}`}
function siteHasCell(site,x,y){if(site.structureTiles?.some(t=>t.x===x&&t.y===y))return true;return site.x===x&&site.y===y}
function targetDistance(cell,base){return dist(cell,base)}
function lerpPoint(a,b,t,bend=0){const dx=b.x-a.x,dy=b.y-a.y,len=Math.max(1,Math.hypot(dx,dy)),nx=-dy/len,ny=dx/len,c={x:(a.x+b.x)/2+nx*bend,y:(a.y+b.y)/2+ny*bend},q=1-t;return{x:q*q*a.x+2*q*t*c.x+t*t*b.x,y:q*q*a.y+2*q*t*c.y+t*t*b.y}}
function makePreviousPlane(root,kind,airframe=kind){
 const type=airframe||({fighter:'F16',bomber:'SU24',stealth:'B2',helicopter:'AH64',transport:'UH60'}[kind]??'F16');
 if(type==='B2'){
  const g=node('g',{class:'air-flight-icon b2-plane'},root),art=node('g',{transform:'scale(.42)'},g);
  node('path',{d:'M0 -104 L28 -75 L205 12 L235 40 L217 57 L112 29 L83 54 L54 39 L25 70 L0 54 L-25 70 L-54 39 L-83 54 L-112 29 L-217 57 L-235 40 L-205 12 L-28 -75 Z'},art);
  node('path',{d:'M0 -90L8 -56L0 -35L-8 -56Z',class:'canopy'},art);
  node('path',{d:'M-155 26L-102 18L-73 37M155 26L102 18L73 37M-48 47L-25 42M48 47L25 42M-24-60L0-48L24-60',class:'wing-panel'},art);
  node('path',{d:'M-92 11L-53 22M92 11L53 22',class:'engine-detail'},art);
  return g;
 }
 if(type==='AH64'||type==='UH60'||type==='AH1Z'){
  const attack=type==='AH64',g=node('g',{class:`air-flight-icon helicopter helicopter-${type.toLowerCase()}`},root);
  if(attack){
   node('path',{d:'M-5-38Q-12-34-14-24L-12-11L-8-3L-7 13L-11 27L-7 34L0 39L7 34L11 27L7 13L8-3L12-11L14-24Q12-34 5-38Z',class:'heli-fuselage'},g);
   node('path',{d:'M-11-27Q-8-34 0-35Q8-34 11-27L8-14L1-10L-8-14Z',class:'heli-glass'},g);
   node('path',{d:'M-7-12L0-8L7-12M-6 3H6M-7 15H7',class:'heli-detail'},g);
   node('path',{d:'M-7 19L-10 33M7 19L10 33M-25 0L-9 4L-10 11L-28 8ZM25 0L9 4L10 11L28 8Z',class:'heli-stub-wings'},g);
   node('path',{d:'M-22 4V18M22 4V18M-29 17H-15M15 17H29M-20 18L-20 22M20 18L20 22',class:'heli-pylons'},g);
  }else{
   node('path',{d:'M-10-38Q-21-34-25-23L-27-8L-25 13Q-23 26-15 31L-9 35L-7 43L0 48L7 43L9 35L15 31Q23 26 25 13L27-8L25-23Q21-34 10-38L6-42H-6Z',class:'heli-fuselage'},g);
   node('path',{d:'M-16-29Q-11-36 0-37Q11-36 16-29L12-17H-12Z',class:'heli-glass'},g);
   node('path',{d:'M-20-12H20V12H-20Z',class:'heli-cabin'},g);
   node('path',{d:'M-19-8V9M19-8V9M-12-10V10M12-10V10M-7 0H7',class:'heli-detail'},g);
   node('path',{d:'M-16 18H16M-15 25H15',class:'heli-cabin-line'},g);
   node('path',{d:'M-21 29L-26 38M21 29L26 38M-27 38H27',class:'heli-skids'},g);
  }
  const tail=node('g',{class:'heli-tail'},g);
  node('path',{d:attack?'M-3 31L-4 57L-2 65L2 65L4 57L3 31Z':'M-4 39L-5 64L-3 71L3 71L5 64L4 39Z',class:'heli-boom'},tail);
  node('path',{d:attack?'M-15 53L15 53L15 58L-15 58Z':'M-20 60L20 60L18 65L-18 65Z',class:'heli-stabilizer'},tail);
  const rotor=node('g',{class:'helicopter-rotor'},g);
  node('path',{d:'M-54-2Q-24-5-5-1V1Q-27 4-54 2ZM5-1Q27-5 54-2V2Q24 5 5 1Z',class:'heli-rotor-blade'},rotor);
  node('path',{d:'M-2-47Q-5-22-1-5H1Q5-24 2-47ZM-1 5Q-5 25-2 47H2Q5 23 1 5Z',class:'heli-rotor-blade secondary'},rotor);
  node('circle',{cx:0,cy:0,r:4.5,class:'heli-rotor-hub'},rotor);
  const tailRotor=node('g',{transform:attack?'translate(0 60)':'translate(0 67)',class:'heli-tail-rotor'},g);
  node('path',{d:'M-9-1Q-4-3 0-1V1Q-5 3-9 1ZM0-9Q3-4 1 0H-1Q-3-5-1-9ZM1 0Q5-2 9 0V2Q4 4 1 2ZM0 1Q3 5 1 9H-1Q-3 4-1 1Z',class:'heli-tail-blades'},tailRotor);
  node('circle',{r:2.4,class:'heli-tail-hub'},tailRotor);return g;
 }
 const shapes={
  F16:{wing:'M0-13L29 2L39 18L9 13L7 25L18 37L0 32L-18 37L-7 25L-9 13L-39 18L-29 2Z',body:'M0-44L4-27L6 5L8 23L14 35L14 39L0 34L-14 39L-14 35L-8 23L-6 5L-4-27Z',tail:'M0 19L20 29L17 34L5 30L4 35L0 32L-4 35L-5 30L-17 34L-20 29Z'},
  MIG29:{wing:'M0-13L34-2L43 15L12 13L10 24L23 36L0 32L-23 36L-10 24L-12 13L-43 15L-34-2Z',body:'M0-43L5-25L7 4L10 22L15 34L15 38L0 33L-15 38L-15 34L-10 22L-7 4L-5-25Z',tail:'M0 17L24 27L20 33L7 29L5 36L0 33L-5 36L-7 29L-20 33L-24 27Z'},
  SU24:{wing:'M0-19L47-5L42 10L12 15L10 25L26 40L0 34L-26 40L-10 25L-12 15L-42 10L-47-5Z',body:'M0-46L5-26L7 3L9 22L15 35L15 40L0 34L-15 40L-15 35L-9 22L-7 3L-5-26Z',tail:'M0 16L26 26L22 33L8 29L5 36L0 33L-5 36L-8 29L-22 33L-26 26Z'}
 };
 const s=shapes[type]??shapes.F16,g=node('g',{class:`air-flight-icon plane aircraft-${type.toLowerCase()}`},root);
 node('path',{d:s.wing,class:'aircraft-wing'},g);node('path',{d:s.tail,class:'aircraft-tail'},g);
 if(type==='MIG29'){node('path',{d:'M-10 9L-8 29L-6 34L-3 29L-2 10ZM10 9L8 29L6 34L3 29L2 10Z',class:'engine-pods'},g);node('path',{d:'M-17 21L-25 34L-14 31M17 21L25 34L14 31',class:'twin-fins'},g)}
 else if(type==='SU24'){node('path',{d:'M-5 7L-8 31L-5 38L-2 30L0 8ZM5 7L8 31L5 38L2 30L0 8Z',class:'engine-pods'},g);node('path',{d:'M-14 25L-23 35L-10 32M14 25L23 35L10 32',class:'twin-fins'},g)}else node('path',{d:'M0 8L0 36',class:'engine-line'},g);
 node('path',{d:s.body,class:'aircraft-body'},g);node('path',{d:'M0-29L3-17L0-11L-3-17Z',class:'aircraft-canopy'},g);node('path',{d:'M-27 9L-11 12M27 9L11 12M-5 20L5 20',class:'aircraft-panel'},g);return g;
}
function helicopterArt(parent,type){
 const g=node("g",{class:`plane helicopter helicopter-${type.toLowerCase()}`},parent),attack=type!=="UH60";
 if(attack){
  node("path",{d:"M-5-38Q-12-34-14-24L-12-11L-8-3L-7 13L-11 27L-7 34L0 39L7 34L11 27L7 13L8-3L12-11L14-24Q12-34 5-38Z",class:"heli-fuselage"},g);
  node("path",{d:"M-11-27Q-8-34 0-35Q8-34 11-27L8-14L1-10L-8-14Z",class:"heli-glass"},g);
  node("path",{d:"M-7-12L0-8L7-12M-6 3H6M-7 15H7",class:"heli-detail"},g);
  node("path",{d:"M-7 19L-10 33M7 19L10 33M-25 0L-9 4L-10 11L-28 8ZM25 0L9 4L10 11L28 8Z",class:"heli-stub-wings"},g);
  node("path",{d:"M-22 4V18M22 4V18M-29 17H-15M15 17H29M-20 18L-20 22M20 18L20 22",class:"heli-pylons"},g);
 }else{
  node("path",{d:"M-10-38Q-21-34-25-23L-27-8L-25 13Q-23 26-15 31L-9 35L-7 43L0 48L7 43L9 35L15 31Q23 26 25 13L27-8L25-23Q21-34 10-38L6-42H-6Z",class:"heli-fuselage"},g);
  node("path",{d:"M-16-29Q-11-36 0-37Q11-36 16-29L12-17H-12Z",class:"heli-glass"},g);
  node("path",{d:"M-20-12H20V12H-20Z",class:"heli-cabin"},g);
  node("path",{d:"M-19-8V9M19-8V9M-12-10V10M12-10V10M-7 0H7",class:"heli-detail"},g);
  node("path",{d:"M-16 18H16M-15 25H15",class:"heli-cabin-line"},g);
  node("path",{d:"M-21 29L-26 38M21 29L26 38M-27 38H27",class:"heli-skids"},g);
 }
 const tail=node("g",{class:"heli-tail"},g);
 node("path",{d:attack?"M-3 31L-4 57L-2 65L2 65L4 57L3 31Z":"M-4 39L-5 64L-3 71L3 71L5 64L4 39Z",class:"heli-boom"},tail);
 node("path",{d:attack?"M-15 53L15 53L15 58L-15 58Z":"M-20 60L20 60L18 65L-18 65Z",class:"heli-stabilizer"},tail);
 const details=node('g',{class:'heli-v9-details'},g);
 details.innerHTML=attack?'<path d="M-10-12L-17-8L-16 12L-10 17ZM10-12L17-8L16 12L10 17Z" fill="#6d806b" stroke="#253c39"/><path d="M-14-6V7M14-6V7" stroke="#bbc3a0" stroke-width="2"/><path d="M-7-29L0-33L7-29L5-20H-5ZM-5-16H5L4-8H-4Z" fill="#315866" stroke="#a3beb4"/><path d="M-5-20H5" stroke="#ced0ac"/><circle cy="-37" r="4" fill="#263e42"/><path d="M0-39V-47" stroke="#b4bba0" stroke-width="3"/><path d="M-25 6V17M-20 6V17M20 6V17M25 6V17" stroke="#d0ccaa" stroke-width="3"/>':'<path d="M-23-8L-29-3V18L-23 22ZM23-8L29-3V18L23 22Z" fill="#6c8270" stroke="#263d3b"/><path d="M-17-10H-7V1H-17ZM7-10H17V1H7Z" fill="#315967" stroke="#acbeb0"/><path d="M-16 7V22M16 7V22M-11 30H11" stroke="#b3bca0" fill="none"/>';
 node('circle',{r:51,fill:'#bacab7',opacity:.055,'pointer-events':'none'},g);
 if(type==='AH1Z'){const detail=node('g',{class:'viper-details'},g);detail.innerHTML=viperDetails();}
 const rotor=node("g",{class:"helicopter-rotor"},g);
 node("path",{d:"M-54-2Q-24-5-5-1V1Q-27 4-54 2ZM5-1Q27-5 54-2V2Q24 5 5 1Z",class:"heli-rotor-blade"},rotor);
 node("path",{d:"M-2-47Q-5-22-1-5H1Q5-24 2-47ZM-1 5Q-5 25-2 47H2Q5 23 1 5Z",class:"heli-rotor-blade secondary"},rotor);
 node("circle",{cx:0,cy:0,r:4.5,class:"heli-rotor-hub"},rotor);
 const tailRotor=node("g",{transform:attack?"translate(0 60)":"translate(0 67)",class:"heli-tail-rotor"},g);
 node("path",{d:"M-9-1Q-4-3 0-1V1Q-5 3-9 1ZM0-9Q3-4 1 0H-1Q-3-5-1-9ZM1 0Q5-2 9 0V2Q4 4 1 2ZM0 1Q3 5 1 9H-1Q-3 4-1 1Z",class:"heli-tail-blades"},tailRotor);
 node("circle",{r:2.4,class:"heli-tail-hub"},tailRotor);
 g._alive=true;g._position={x:0,y:0};return g
}
function planeArt(parent,type){if(type==='AH64'||type==='UH60'||type==='AH1Z')return helicopterArt(parent,type);const g=node('g',{class:'plane aircraft-'+type.toLowerCase()},parent),body=node('g',{class:'tac-airframe'},g);body.innerHTML=type==='KC46'?tankerArtwork():['RQ7','MQ9'].includes(type)?uavArtwork(type):tacticalAircraftArt(type);g._alive=true;g._position={x:0,y:0};return g}
function makePlane(root,kind,airframe){if(kind==='stealth')return makePreviousPlane(root,kind,airframe);const g=planeArt(root,airframe||({fighter:'F16',bomber:'SU24',helicopter:'AH64',transport:'UH60'}[kind]||'F16'));g.classList.add('air-flight-icon');return g}
function findDefenses(side='blue'){return battle.airDefenses.filter(d=>d.side!==side&&!d.disabled&&d.missiles>0).concat(battle.units.filter(d=>d.side!==side&&d.role==='antiAir'&&d.strength>0&&d.antiDroneAmmo>0))}
function defenseForFlight(flight,point){return pollDefense(flight,point)}
function showIntercept(defense,planeAt){/* The defense engine draws the travelling interceptor and its impact. */}
function showImpact(point,label,kind='normal'){const g=node('g',{class:`air-battle-impact ${kind}`,transform:`translate(${point.x} ${point.y})`},groups.effects);node('path',{d:'M-34 10L-23-1L-18-16L-7-6L4-24L8-7L24-11L19 2L33 11L20 20L-17 23Z',class:'air-impact-smoke'},g);node('path',{d:'M-11 7L-18-5L-8-3L-3-18L4-4L13-9L10 1L19 8L4 12L-4 20Z',class:'air-impact-flash'},g);const t=node('text',{x:0,y:43,'text-anchor':'middle',class:'air-impact-label'},g);t.textContent=label;setTimeout(()=>g.remove(),2400)}
import { stealthUnitDamage, applyStealthUnitDamage } from '/rebel-stealth-damage.js';
/* AIR_BATTLE_STEALTH_DAMAGE_V1 */
let stealthFx=null,stealthDirty=null,stealthRefreshTimer=0;
function impactEngine(){return stealthFx??=createStealthImpactFX(groups.effects)}
function queueStealthRefresh(unitId=null,cell=null){
 if(!stealthDirty||stealthDirty.battle!==battle)stealthDirty={battle,units:new Set(),cells:new Map()};
 if(unitId)stealthDirty.units.add(unitId);if(cell)stealthDirty.cells.set(cell.x+','+cell.y,cell);
 if(stealthRefreshTimer)return;
 stealthRefreshTimer=setTimeout(()=>{stealthRefreshTimer=0;const dirty=stealthDirty;stealthDirty=null;if(dirty?.battle===api.battle)api.renderStrikeDamage({unitIds:[...dirty.units],cells:[...dirty.cells.values()]});},80);
}
function stealthDamageVisual(unit,result,point){
 queueStealthRefresh(unit.id);
 const original=groups.units.querySelector(`[data-unit-id="${unit.id}"]`);
 if(result.destroyed){
  if(original)impactEngine().burst(point,{wreck:true,size:(!!unit.modelId||unit.role==='supplyTruck')?.68:.42,token:battle});
  original?.remove();
 }
}
function resolveStealthBombImpact(mission,target){
 if(mission.battle!==api.battle)return{dealt:0,impacts:0};
 let dealt=0,impacts=0;civilianImpact(battle,target.cell.x,target.cell.y,mission.craft.damage,mission.base.side);
 for(const unit of battle.units){
  if(unit.side===mission.base.side||unit.strength<=0||unit.hp<=0)continue;
  const p=centers[unit.y]?.[unit.x];if(!p)continue;
  const observed=isUnitDetected(battle,unit,mission.base.side);const house=battle.mapObjects?.[unit.garrisonedIn];
  const amount=stealthUnitDamage(Math.hypot(p.x-target.x,p.y-target.y),mission.plan.cellSize,ARMOR_MODELS[unit.modelId]?.armor||1,Math.min(house?.hp>0?.65:1,blastCover(battle,unit)));
  const result=applyStealthUnitDamage(unit,Math.round(amount*commandAttackFactor(battle,mission.base,'air')));if(!result.dealt)continue;
  if(observed){dealt+=result.dealt;impacts++;}
  stealthDamageVisual(unit,result,p);
  if(result.destroyed){
   leaveHouse(battle,unit.id);
   if(battle.logistics?.convoys)battle.logistics.convoys=battle.logistics.convoys.filter(c=>(c.truckId??c.id)!==unit.id);
  }
 }
 // Buildings use the same physical impact position as the bomb; direct and nearby damage differ.
 let buildingDamage=0,buildingHits=0;
 for(const object of Object.values(battle.mapObjects??{})){
  if(object.category!=='building'||object.hp<=0)continue;
  const point=centers[object.y]?.[object.x];if(!point)continue;
  const gap=Math.hypot(point.x-target.x,point.y-target.y)/mission.plan.cellSize;
  const amount=gap<=.55?130:gap<=1.15?Math.round(55*(1-(gap-.55)/.8)):0;
  if(amount<=0)continue;const hit=damageMapObject(battle,object.x,object.y,Math.round(amount*commandAttackFactor(battle,mission.base,'air')),'building');
  if(hit?.damage){buildingDamage+=hit.damage;buildingHits++;queueStealthRefresh(null,{x:object.x,y:object.y});}
 }
 const structures=damageAt(target.cell.x,target.cell.y,mission.craft.damage,mission.base.side,{skipUnits:true,skipBuildings:true});
 structures.dealt+=buildingDamage;structures.impacts+=buildingHits;
 queueStealthRefresh(null,target.cell);
 return{dealt:dealt+structures.dealt,impacts:impacts+structures.impacts};
}

/* CITY_OBJECT_REGISTRY_DAMAGE_V1 */
function damageAt(x,y,damage,side='blue',options={}){
 let dealt=0,impacts=0;
 for(const unit of battle.units.filter(u=>!options.skipUnits&&u.side!==side&&u.strength>0&&u.x===x&&u.y===y)){const observed=isUnitDetected(battle,unit,options.attackerSide??side);const amount=Math.min(unit.hp,Math.round(damage*(unit.modelId?0.76:1)*blastCover(battle,unit)));const before=unit.strength;unit.hp=Math.max(0,unit.hp-amount);unit.strength=Math.max(0,Math.min(unit.maxStrength,Math.ceil((unit.hp-1e-8)/unit.hpPerStrength)));unit.morale=Math.max(0,unit.morale-10);unit.hitFlash=amount>0;if(observed){dealt+=amount;impacts++;}}
 for(const site of battle.sites.filter(s=>!options.skipBuildings&&s.owner!==side&&siteHasCell(s,x,y))){site.buildingIntegrity??={};const k=`${x},${y}`,result=damageMapObject(battle,x,y,damage,'building'),building=result?.object??site.buildingIntegrity[k]??{hp:100,maxHp:100,hits:0};if(!result){const amount=Math.min(building.hp,damage);building.hp-=amount;building.hits++;site.buildingIntegrity[k]=building}site.hitBuildingKey=k;dealt+=result?.damage??0;impacts++;}
 for(const t of facilityTargets(battle).filter(t=>t.x===x&&t.y===y&&t.side!==side&&!t.asset.disabled)){const hit=damageFacility(battle,t.id,damage,options.attackerSide??side);if(hit){dealt+=hit.damage;impacts++;}}
 return{dealt,impacts};
}
function targetCells(center,craft,pattern,bombCount=5,spread=520){if(craft.kind!=='stealth'||pattern==='point')return[center];const count=Math.max(1,Math.min(5,Number(bombCount)||5)),origin=centers[center.y]?.[center.x];if(!origin)return[center];const out=[];for(let i=0;i<count;i++){const offset=count===1?0:(i/(count-1)-.5)*Math.max(0,Number(spread)||520),wanted={x:origin.x+(pattern==='horizontal'?offset:0),y:origin.y+(pattern==='vertical'?offset:0)};let best=null;for(let y=0;y<centers.length;y++)for(let x=0;x<(centers[y]||[]).length;x++){const point=centers[y][x];if(!point)continue;const d=Math.hypot(point.x-wanted.x,point.y-wanted.y);if(!best||d<best.d)best={x,y,d}}if(best)out.push({x:best.x,y:best.y})}return out}
function stageFlightFlight(flight){battle.inFlightDrones??=[];battle.inFlightDrones.push(flight)}
/* AIR_BATTLE_STEALTH_SYSTEM_V2 */
let stealthPlanCache=null;
const stealthTraffic={clock:0,last:null,raf:0,missions:[]};
const STEALTH_OUTLINE='M0-104L28-75L205 12L235 40L217 57L112 29L83 54L54 39L25 70L0 54L-25 70L-54 39L-83 54L-112 29L-217 57L-235 40L-205 12L-28-75Z';

function getStealthMissionPlan(base,target,pattern,orders={}){
 const from=centers[base.y]?.[base.x],to=centers[target.y]?.[target.x];
 if(!from||!to)throw new Error('تعذر تحديد المطار أو منطقة القصف.');
 const cellSize=airBattleCellPixels(base,target);
 const defenses=findDefenses(base.side).map(d=>({x:centers[d.y]?.[d.x]?.x,y:centers[d.y]?.[d.x]?.y,radius:(d.range??d.antiDroneRange??2.5)*cellSize})).filter(d=>Number.isFinite(d.x)&&Number.isFinite(d.y));
 const input={base:{...from,side:base.side,heading:base.side==='red'?Math.PI:0},target:to,pattern,focused:$('airBattleFocus')?.value==='focused'||$('airBattleFocus')?.value!=='area'&&!!(target.unit||target.facility||target.radar||target.depot||target.base||target.refinery||target.intelReportId||refineryMapCellInfo(battle,target.x,target.y)?.objects?.some(o=>['building','facility'].includes(o.category))),
  count:Math.max(1,Math.min(4,Number(orders.sortieCount)||1)),bombCount:Number(orders.bombCount)||5,
  spread:Number(orders.spread)||520,cellSize,approach:orders.approachId||'offset',defenses,
  bounds:{width:api.THEATER?.width||7200,height:api.THEATER?.height||4080}};
 const key=JSON.stringify(input);
 if(stealthPlanCache?.key!==key)stealthPlanCache={key,plan:buildStealthPlan(input)};
 return stealthPlanCache.plan;
}
function drawStealthRoutes(parent,plan,preview=false){
 for(const profile of plan.profiles){
  for(const [kind,phases] of [['ingress',['takeoff','climb','ingress']],['attack',['attack']],['return',['egress','return','approach','landing']]]){
   node('path',{d:trackPath(profile.track,phases),class:'stealth-v2-route stealth-v2-'+kind,'data-aircraft':profile.index+1},parent);
  }
  if(preview)for(const bomb of profile.bombs){
   const dot=node('g',{class:'stealth-v2-target',transform:`translate(${bomb.x} ${bomb.y})`,'data-aircraft':profile.index+1},parent);
   node('circle',{r:15*plan.scale},dot);node('path',{d:'M-22 0H-16M16 0H22M0-22V-16M0 16V22'},dot);
  }
 }
}
function makeTransferredB2(root,index=0){
 const g=node('g',{class:'air-flight-icon b2-plane stealth-v2-plane',visibility:'hidden','data-aircraft':index+1},root);
 const shadow=node('path',{d:STEALTH_OUTLINE,class:'stealth-v2-shadow'},g);
 const body=node('g',{class:'stealth-v2-body'},g);
 node('path',{d:STEALTH_OUTLINE,class:'stealth-v2-skin'},body);
 node('path',{d:'M0-104L-28-75L-205 12L-235 40L-217 57L-112 29L-83 54L-54 39L-25 70L0 54Z',class:'stealth-v2-left'},body);
 node('path',{d:'M0-104L28-75L205 12L235 40L217 57L112 29L83 54L54 39L25 70L0 54Z',class:'stealth-v2-right'},body);
 node('path',{d:'M0-101L-28-68L-49 26L-25 59L0 47L25 59L49 26L28-68Z',class:'stealth-v2-spine'},body);
 node('path',{d:'M-28-74L-192 12L-207 28L-47-35ZM28-74L192 12L207 28L47-35Z',class:'stealth-v2-shoulder'},body);
 node('path',{d:'M0-78L-12-59L-10-44L0-39L10-44L12-59Z',class:'stealth-v2-glass'},body);
 node('path',{d:'M0-77V-41M-10-57H10',class:'stealth-v2-windowline'},body);
 node('path',{d:'M-42-21L-22-26L-17-4L-39 1ZM42-21L22-26L17-4L39 1Z',class:'stealth-v2-intake'},body);
 node('path',{d:'M-41-21L-23-25M41-21L23-25',class:'stealth-v2-lip'},body);
 node('path',{d:'M-43 20L-19 20L-20 31L-41 32ZM43 20L19 20L20 31L41 32Z',class:'stealth-v2-exhaust'},body);
 node('path',{d:'M-39 26H-23M23 26H39M-148 5L-94 17L-81 40M148 5L94 17L81 40M-52 34L-28 40M52 34L28 40M-12 5H12V33H-12ZM-112 29L-196 34M112 29L196 34',class:'stealth-v2-panel'},body);
 node('path',{d:'M-221 36L-201 21M221 36L201 21M-14-86L0-101L14-86',class:'stealth-v2-edge'},body);
 const bankLeft=node('path',{d:'M0-101L-28-74L-221 39L-111 26L-54 36L-25 61L0 49Z',class:'stealth-v2-bank'},body);
 const bankRight=node('path',{d:'M0-101L28-74L221 39L111 26L54 36L25 61L0 49Z',class:'stealth-v2-bank'},body);
 g._body=body;g._shadow=shadow;g._bankLeft=bankLeft;g._bankRight=bankRight;g._bank=0;
 return g;
}
function placeStealthPlane(plane,pose,scale,dt){
 const degrees=pose.heading*180/Math.PI+90,alt=pose.altitude;
 const targetBank=Math.max(-16,Math.min(16,pose.curvature*pose.speed*34));
 plane._bank+=(targetBank-plane._bank)*(1-Math.exp(-dt/.32));
 const bank=plane._bank,modelScale=(.34+.08*alt)*scale,wingScale=modelScale*(1-Math.abs(bank)*.0035);
 plane.setAttribute('transform',`translate(${pose.x.toFixed(2)} ${pose.y.toFixed(2)})`);
 plane._body.setAttribute('transform',`translate(0 ${(-18*alt*scale).toFixed(2)}) rotate(${degrees.toFixed(3)}) scale(${wingScale.toFixed(4)} ${modelScale.toFixed(4)})`);
 plane._shadow.setAttribute('transform',`translate(${(11*alt*scale).toFixed(2)} ${(20*alt*scale+3).toFixed(2)}) rotate(${degrees.toFixed(3)}) scale(${modelScale.toFixed(4)})`);
 plane._shadow.style.opacity=String(.18-.08*alt);
 plane._bankLeft.style.opacity=String(Math.max(0,bank)*.009);
 plane._bankRight.style.opacity=String(Math.max(0,-bank)*.009);
 plane._position={x:pose.x,y:pose.y-18*alt*scale};
 plane.setAttribute('data-phase',pose.phase);
}
function transferredStealthBurst(point,label){impactEngine().burst(point,{size:1,token:battle});}
function releaseStealthBomb(mission,item,bomb){
 const release=sampleProfile(item.profile,bomb.releaseTime);
 const from={x:release.x,y:release.y-18*mission.plan.scale};
 const g=node('g',{class:'stealth-v2-bomb'},mission.layer);
 node('path',{d:'M0-14L5-5L4 9L0 14L-4 9L-5-5ZM-6-10H6',class:'stealth-v2-bomb-body'},g);
 mission.bombs.push({node:g,from,target:bomb,heading:release.heading*180/Math.PI+90,
  start:item.reservation.startTime+bomb.releaseTime,duration:bomb.fallTime,item});
 item.released++;
}
function completeStealthMission(mission,canceled=false){
 if(mission.done)return;mission.done=true;
 for(const item of mission.items){
  mission.battle.inFlightDrones=(mission.battle.inFlightDrones||[]).filter(f=>f.id!==item.flight.id);
  if(!item.intercepted)item.flight.status=canceled?'canceled':'returned';
 }
 mission.layer.remove();
 mission.resolve(mission.items.map(item=>({intercepted:item.intercepted,dealt:item.total,hits:item.hits,cells:item.released,failed:false,canceled})));
}
function advanceStealthTraffic(now){
 stealthTraffic.raf=0;
 const dt=document.hidden?0:Math.min(.05,Math.max(0,(now-(stealthTraffic.last??now))/1000));
 stealthTraffic.last=now;stealthTraffic.clock+=dt;
 for(const mission of stealthTraffic.missions){
  if(mission.done)continue;
  if(mission.battle!==api.battle||!mission.layer.isConnected){completeStealthMission(mission,true);continue;}
  try{
   for(const item of mission.items){
    if(item.completed||item.intercepted)continue;
    const elapsed=stealthTraffic.clock-item.reservation.startTime;
    if(elapsed<0)continue;
    if(!item.started){item.started=true;item.plane.setAttribute('visibility','visible');item.flight.status='flying';stageFlightFlight(item.flight);}
    const pose=sampleProfile(item.profile,elapsed);
    placeStealthPlane(item.plane,pose,mission.plan.scale,dt);
    Object.assign(item.flight,{x:pose.x,y:pose.y,phase:pose.phase,progress:pose.distance/item.profile.track.length});
    // Resolve defenses before the release event of this frame. Pending bombs
    // keep falling if their aircraft is intercepted after release.
    if(item.flight.status==='intercepted'||pose.altitude>.25&&stealthTraffic.clock-item.lastDefense>=.26){
     item.lastDefense=stealthTraffic.clock;
     const shot=defenseForFlight(item.flight,pose);
     if(shot){showIntercept(shot.defense,pose);if(shot.hit){item.intercepted=true;item.flight.status='intercepted';item.plane.remove();showImpact(pose,'اعتراض صاروخي','intercepted');continue;}}
    }
    while(item.released<item.profile.bombs.length&&elapsed>=item.profile.bombs[item.released].releaseTime){releaseStealthBomb(mission,item,item.profile.bombs[item.released]);}
    if(elapsed>=item.profile.duration){item.completed=true;item.flight.status='returned';item.flight.phase='landed';item.plane.remove();mission.battle.inFlightDrones=mission.battle.inFlightDrones.filter(f=>f.id!==item.flight.id);}
   }
   for(const bomb of mission.bombs){
    if(bomb.done)continue;
    const t=Math.max(0,Math.min(1,(stealthTraffic.clock-bomb.start)/bomb.duration));
    const x=bomb.from.x+(bomb.target.x-bomb.from.x)*t,y=bomb.from.y+(bomb.target.y-bomb.from.y)*t;
    bomb.node.setAttribute('transform',`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${bomb.heading.toFixed(2)}) scale(${((.85-.4*t)*mission.plan.scale).toFixed(3)})`);
    if(t>=1){
     bomb.done=true;bomb.node.remove();
     const result=resolveStealthBombImpact(mission,bomb.target);if(battle.lastAirOrder)battle.lastAirOrder.impacts.push({x:bomb.target.cell.x,y:bomb.target.cell.y,damage:result.dealt});
     bomb.item.total+=result.dealt;bomb.item.hits+=result.impacts;
     bomb.item.flight.damageDealt=bomb.item.total;bomb.item.flight.hitCount=bomb.item.hits;
     transferredStealthBurst(bomb.target,'قنبلة شبحية');
    }
   }
   if(!mission.attackDone&&mission.items.every(item=>item.intercepted||item.released===item.profile.bombs.length)&&mission.bombs.every(b=>b.done)){mission.attackDone=true;mission.onAttackDone?.();}
   if(mission.items.every(item=>item.completed||item.intercepted)&&mission.bombs.every(b=>b.done))completeStealthMission(mission);
  }catch(error){console.error('Stealth flight controller:',error);status('تعذر إكمال طلعة الشبح؛ أُوقف التنفيذ واستُعيد التحكم.','warn');completeStealthMission(mission,true);}
 }
 stealthTraffic.missions=stealthTraffic.missions.filter(m=>!m.done);
 if(stealthTraffic.missions.length)stealthTraffic.raf=requestAnimationFrame(advanceStealthTraffic);
 else stealthTraffic.last=null;
}
async function flyStealthFormation(base,target,craft,pattern,orders={}){
 const key=JSON.stringify([base?.id,target,pattern,orders,battle.turn]);if(stealthPreviewLayer._previewKey===key&&stealthPreviewLayer.childElementCount)return;stealthPreviewLayer._previewKey=key;const plan=getStealthMissionPlan(base,target,pattern,orders);
 const activeReservations=stealthTraffic.missions.flatMap(m=>m.items.filter(i=>!i.completed&&!i.intercepted).map(i=>i.reservation));
 const reservations=scheduleStealthPlan(plan,activeReservations,stealthTraffic.clock+.2);
 const layer=node('g',{class:'air-sortie stealth air-stealth-transfer air-stealth-v2'},groups.effects);
 drawStealthRoutes(layer,plan);
 const mission={base,craft,plan,layer,battle,items:[],bombs:[],done:false,onAttackDone:orders.onAttackDone};
 const nearestCell=point=>{let best={x:target.x,y:target.y,d:Infinity};for(let y=0;y<centers.length;y++)for(let x=0;x<centers[y].length;x++){const p=centers[y][x],d=Math.hypot(p.x-point.x,p.y-point.y);if(d<best.d)best={x,y,d};}return{x:best.x,y:best.y};};
 // Resolve grid hit locations once, not on each animation frame or explosion.
 for(const reservation of reservations){
  const source=reservation.profile,profile={...source,bombs:source.bombs.map(b=>({...b,cell:nearestCell(b)}))};
  const plane=makeTransferredB2(layer,profile.index);
  const flight={id:'air-battle-flight-'+battle.turn+'-'+(++flightSequence),side:base.side,kind:'stealth',cellPixels:plan.cellSize,
   exposure:(AIR_BATTLE_APPROACHES[orders.approachId]||AIR_BATTLE_APPROACHES.offset).exposure,typeId:'standard',damage:craft.damage,targetId:'',
   start:{x:base.x,y:base.y},progress:0,x:plan.runwayStart.x,y:plan.runwayStart.y,status:'queued',phase:'queued',engagedDefenses:[]};
  mission.items.push({profile,reservation,plane,flight,started:false,completed:false,intercepted:false,released:0,total:0,hits:0,lastDefense:-1});
 }
 const result=new Promise(resolve=>{mission.resolve=resolve;});
 stealthTraffic.missions.push(mission);
 if(!stealthTraffic.raf){stealthTraffic.last=null;stealthTraffic.raf=requestAnimationFrame(advanceStealthTraffic);}
 return result;
}


function approachIdForStealth(id,cellPixels){return id==='low'?Math.max(60,cellPixels*.4):id==='sead'?Math.max(250,cellPixels*2.8):Math.max(180,cellPixels*1.35)}

function airBattleCellPixels(a,b){const samples=[];for(const cell of [a,b])for(let y=Math.max(0,cell.y-2);y<=Math.min(centers.length-1,cell.y+2);y++)for(let x=Math.max(0,cell.x-2);x<=Math.min((centers[y]||[]).length-1,cell.x+2);x++){if(hexDistance(cell,{x,y})!==1)continue;const p=centers[cell.y]?.[cell.x],q=centers[y]?.[x];if(p&&q)samples.push(Math.hypot(q.x-p.x,q.y-p.y))}samples.sort((x,y)=>x-y);return samples.length?samples[Math.floor(samples.length/2)]:Math.max(1,(api.HEX_RADIUS||70)*Math.sqrt(3))}
function airBattleCubicLength(p0,p1,p2,p3){let length=0,last=p0;for(let i=1;i<=24;i++){const t=i/24,q=1-t,p={x:q*q*q*p0.x+3*q*q*t*p1.x+3*q*t*t*p2.x+t*t*t*p3.x,y:q*q*q*p0.y+3*q*q*t*p1.y+3*q*t*t*p2.y+t*t*t*p3.y};length+=Math.hypot(p.x-last.x,p.y-last.y);last=p}return length}
function makeAirBattlePaths(a,b,bend=2.2,standoff=6,seed=1,cellPixels=120){const dx=b.x-a.x,dy=b.y-a.y,d=Math.max(1,Math.hypot(dx,dy)),ux=dx/d,uy=dy/d,nx=-uy,ny=ux,side=seed%2?1:-1,releaseDistance=Math.min(Math.max(0,standoff),d*.45),release={x:b.x-ux*releaseDistance,y:b.y-uy*releaseDistance},turn=Math.max(cellPixels,Math.min(cellPixels*4,d*.16)),c1={x:a.x+dx*.34+nx*bend*side,y:a.y+dy*.34+ny*bend*side},c2={x:release.x-ux*turn+nx*bend*.22*side,y:release.y-uy*turn+ny*bend*.22*side},escape={x:release.x+nx*turn*.9*side,y:release.y+ny*turn*.9*side},e1={x:release.x+ux*turn-nx*bend*.22*side,y:release.y+uy*turn-ny*bend*.22*side},e2={x:escape.x+ux*turn*.65-nx*bend*.1*side,y:escape.y+uy*turn*.65-ny*bend*.1*side},b1={x:escape.x-ux*turn*.65+nx*bend*.1*side,y:escape.y-uy*turn*.65+ny*bend*.1*side},b2={x:a.x+ux*turn,y:a.y+uy*turn},outLength=airBattleCubicLength(a,c1,c2,release),escapeLength=airBattleCubicLength(release,e1,e2,escape),backLength=airBattleCubicLength(escape,b1,b2,a),full='M'+a.x+' '+a.y+' C'+c1.x+' '+c1.y+' '+c2.x+' '+c2.y+' '+release.x+' '+release.y+' C'+e1.x+' '+e1.y+' '+e2.x+' '+e2.y+' '+escape.x+' '+escape.y+' C'+b1.x+' '+b1.y+' '+b2.x+' '+b2.y+' '+a.x+' '+a.y;return{release,outLength,releaseAt:outLength/(outLength+escapeLength+backLength),full,out:'M'+a.x+' '+a.y+' C'+c1.x+' '+c1.y+' '+c2.x+' '+c2.y+' '+release.x+' '+release.y,escape:'M'+release.x+' '+release.y+' C'+e1.x+' '+e1.y+' '+e2.x+' '+e2.y+' '+escape.x+' '+escape.y,back:'M'+escape.x+' '+escape.y+' C'+b1.x+' '+b1.y+' '+b2.x+' '+b2.y+' '+a.x+' '+a.y}}

const AIR_BATTLE_LOADOUT={fighter:{pace:3,standoff:6,bend:2.2,munition:'قنبلة موجهة'},bomber:{pace:2.4,standoff:8.2,bend:2.5,munition:'قنابل تكتيكية'},helicopter:{pace:3,bend:1.9,standoff:3.7,munition:'صاروخ موجه'},transport:{pace:3.3,standoff:0,bend:1.8,munition:''}};
function addAirBattleSmoke(point,label){const g=node('g',{class:'air-strike-impact',transform:'translate('+point.x+' '+point.y+')'},groups.effects);node('ellipse',{cx:0,cy:14,rx:39,ry:12,class:'air-strike-scorch'},g);node('path',{d:'M0-31L4-14L16-25L13-8L31-12L18 0L30 13L11 10L8 30L0 14L-11 27L-9 9L-29 14L-17 1L-30-12L-11-9L-15-26L-2-14Z',class:'air-strike-burst'},g);node('path',{d:'M-18 10L-10-3L-6 3L-2-18L3-1L10-13L13 3L19 10Z',class:'air-strike-flame'},g);const offsets=[-6,-3,0,3,6,0];for(let i=0;i<offsets.length;i++)node('circle',{cx:offsets[i],cy:5,r:9+(i%3)*2,class:'air-strike-smoke',style:'animation-delay:'+i*120+'ms'},g);const t=node('text',{x:0,y:39,'text-anchor':'middle',class:'air-impact-label'},g);t.textContent=label;setTimeout(()=>g.remove(),6200)}
function animateAirBattleMunition(from,to,craft,side,layer,cellPixels=120){return new Promise(resolve=>{const d=Math.hypot(to.x-from.x,to.y-from.y),height=Math.max(90,Math.min(240,d*.15)),control={x:(from.x+to.x)/2,y:(from.y+to.y)/2-height},g=node('g',{class:'air-battle-munition'},layer),trail=node('path',{class:'air-battle-munition-trail',d:`M${from.x} ${from.y}`},g),body=node('path',{d:craft.kind==='helicopter'?'M0-14L5-3L3 9L0 14L-3 9L-5-3Z':'M0-19L5-5L3 12L0 18L-3 12L-5-5Z',class:'air-battle-munition-body'},g),start=performance.now(),duration=Math.max(850,Math.min(2200,(d/Math.max(1,cellPixels))*110)),sample=p=>{const q=1-p;return{x:q*q*from.x+2*q*p*control.x+p*p*to.x,y:q*q*from.y+2*q*p*control.y+p*p*to.y}},tick=now=>{const p=Math.min(1,(now-start)/duration),pt=sample(p),ahead=sample(Math.min(1,p+.012));body.setAttribute('transform',`translate(${pt.x} ${pt.y}) rotate(${Math.atan2(ahead.y-pt.y,ahead.x-pt.x)*180/Math.PI+90})`);trail.setAttribute('d',`M${from.x} ${from.y} Q${(from.x+pt.x)/2} ${(from.y+pt.y)/2-height*.45} ${pt.x} ${pt.y}`);if(p<1){requestAnimationFrame(tick);return}g.remove();resolve(true)};requestAnimationFrame(tick)})}
async function flyAirBattleContinuous(pathNode,icon,flight,pace,releaseAt,onRelease){const length=pathNode.getTotalLength(),cellPixels=Math.max(1,flight.cellPixels||api.HEX_RADIUS*Math.sqrt(3)),duration=Math.max(4800,(length/cellPixels)/Math.max(.1,pace)*1000),start=performance.now();return new Promise(resolve=>{let lastDefense=0,released=false;const tick=now=>{if(!icon.isConnected){resolve(false);return}if(flight.status==='intercepted'){defenseForFlight(flight,{x:flight.x,y:flight.y});resolve(false);return}const p=Math.min(1,(now-start)/duration),pt=pathNode.getPointAtLength(length*p),ahead=pathNode.getPointAtLength(Math.min(length,length*p+Math.max(4,length*.002))),angle=Math.atan2(ahead.y-pt.y,ahead.x-pt.x)*180/Math.PI;flight.progress=p;flight.x=pt.x;flight.y=pt.y;icon._position={x:pt.x,y:pt.y};icon._heading=angle+90;icon.setAttribute('transform','translate('+pt.x+' '+pt.y+') rotate('+(angle+90)+') scale(1.35)');if(!released&&p>=releaseAt){released=true;onRelease()}if(now-lastDefense>130&&p<.995){lastDefense=now;const shot=defenseForFlight(flight,pt);if(shot){showIntercept(shot.defense,pt);if(shot.hit){flight.status='intercepted';resolve(false);return}}}if(p>=1){resolve(true);return}requestAnimationFrame(tick)};requestAnimationFrame(tick)})}
/* AIR_BATTLE_CONVENTIONAL_V3 */
function tacticalCellFromEvent(event){
 const find=(selector,attribute,items)=>{const n=event.target.closest?.(selector);return n?items.find(x=>x.id===n.getAttribute(attribute)):null};
 const direct=find('[data-unit-id]','data-unit-id',battle.units)||find('[data-airbase-id]','data-airbase-id',bases())||find('[data-ad-id]','data-ad-id',battle.airDefenses)||find('[data-refinery-id]','data-refinery-id',battle.refineries||[])||find('[data-drone-base-id]','data-drone-base-id',battle.droneBases||[])||find('[data-depot-id]','data-depot-id',battle.logistics?.depots||[]);
 if(direct)return{x:direct.x,y:direct.y};
 for(const [selector,ax,ay]of [['[data-building-x][data-building-y]','data-building-x','data-building-y'],['[data-x][data-y]','data-x','data-y']]){const n=event.target.closest?.(selector);if(n){const x=Number(n.getAttribute(ax)),y=Number(n.getAttribute(ay));if(Number.isInteger(x)&&Number.isInteger(y)&&centers[y]?.[x])return{x,y}}}
 if(!svg.getScreenCTM())return null;const p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;const q=p.matrixTransform(svg.getScreenCTM().inverse());
 if(q.x<0||q.y<0||q.x>api.THEATER.width||q.y>api.THEATER.height)return null;
 let best=null;for(let y=0;y<centers.length;y++)for(let x=0;x<centers[y].length;x++){const c=centers[y][x],d=Math.hypot(c.x-q.x,c.y-q.y);if(!best||d<best.d)best={x,y,d}}return best;
}
function validTacticalTarget(cell){return Number.isInteger(cell?.x)&&Number.isInteger(cell?.y)&&!!centers[cell.y]?.[cell.x]}
function targetText(cell){const object=refineryMapCellInfo(battle,cell.x,cell.y)?.objects?.find(o=>o.category==='building');return object?'مبنى · القطاع '+(cell.x+1)+'/'+(cell.y+1):'نقطة القصف · القطاع '+(cell.x+1)+'/'+(cell.y+1)}
function isFriendlyLanding(cell){return validTacticalTarget(cell)&&battle.owners[cell.y*MAP_GRID.columns+cell.x]==='blue'&&!battle.units.some(u=>u.strength>0&&u.x===cell.x&&u.y===cell.y)&&refineryMapCellInfo(battle,cell.x,cell.y)?.landUse==='open'&&!battle.airDefenses.some(d=>d.x===cell.x&&d.y===cell.y)&&!bases().some(d=>d.x===cell.x&&d.y===cell.y)}
let transportPassenger=null;
function landTransport(cell){const u=transportPassenger&&battle.units.find(u=>u.id===transportPassenger&&u.hp>0&&u.strength>0);if(!u||!isFriendlyLanding(cell))return false;leaveHouse(battle,u.id);u.x=cell.x;u.y=cell.y;u.moved=true;u.attacked=true;u.airliftReserved=false;u.airliftDelivered=true;api.renderAll();return true;}
function conventionalDamage(cell,amount,side='blue'){
 const r=damageAt(cell.x,cell.y,amount,'__point_strike__',{attackerSide:side});
 const objects=refineryMapCellInfo(battle,cell.x,cell.y)?.objects||[];for(const o of objects){if(o.category==='building'||o.type==='oilRefinery'||o.hp<=0)continue;const dealt=Math.min(o.hp,amount);o.hp-=dealt;o.status=o.hp<=0?'destroyed':'damaged';r.dealt+=dealt;r.impacts++;}
 api.renderAll();drawBases();return r;
}
// Helicopter fire control: identity remains fixed; visuals and damage use one solution.
function helicopterTarget(target){
 const picked=target.unit;
 const unit=picked?battle.units.find(u=>u.id===picked.id):null;
 if(picked&&(!unit||unit.strength<=0||unit.hp<=0||unit.side!==picked.side||!isUnitDetected(battle,unit,'blue')))return null;
 const asset=target.facility||target.radar||target.depot||target.refinery||target.base;
 if(asset&&(asset.disabled||asset.destroyed||asset.structureHp===0))return null;
 const cell=unit?{...target,x:unit.x,y:unit.y,unit}:{...target};
 const center=centers[cell.y]?.[cell.x];if(!center)return null;
 let point={...center};
 if(unit){const garrison=!!unit.garrisonedIn||unit.role!=='supplyTruck'&&battle.sites.some(s=>s.x===unit.x&&s.y===unit.y);if(garrison)point={x:center.x+115,y:center.y-90};}
 else if(target.base&&battle.droneBases?.includes(target.base))point={x:center.x+88,y:center.y+42};
 return {cell,point,unit};
}
function strikeReachable(base,target,craft,weapon,range=effectiveRange(craft)){
 if(!base||!validTacticalTarget(target))return false;
 const distance=targetDistance(target,base),release=Math.min(weapon?.standoff??0,distance*.45);
 return distance-release<=range+1e-6;
}
function tacticalSolution(base,target,craft,weapon,pose,cell,range){
 const solution=helicopterTarget(target);if(!solution)return null;
 if(!strikeReachable(base,solution.cell,craft,weapon,range))return null;
 // Release must remain within this weapon's reach of the original named target.
 const reach=Math.max(.8,(weapon?.standoff??0)+.35)*cell;
 const targetCenter=centers[solution.cell.y][solution.cell.x];
 if(pose&&Math.hypot(targetCenter.x-pose.x,targetCenter.y-pose.y)>reach)return null;
 return solution;
}
function helicopterUnitDamage(unit,amount,side='blue'){
 if(!unit||unit.hp<=0||unit.strength<=0)return{dealt:0,impacts:0};
 const dealt=Math.min(unit.hp,Math.round(amount*(unit.modelId?.76:1)*blastCover(battle,unit)));civilianImpact(battle,unit.x,unit.y,amount*.15,side);
 unit.hp=Math.max(0,unit.hp-dealt);unit.strength=Math.max(0,Math.min(unit.maxStrength,Math.ceil((unit.hp-1e-8)/unit.hpPerStrength)));unit.morale=Math.max(0,unit.morale-10);unit.hitFlash=dealt>0;
 api.renderAll();return{dealt,impacts:1};
}

async function flyConventionalAirBattle(base,target,craft,index,orders={}){
 const missionBattle=battle,missionRange=orders.range??effectiveRange(craft),from=centers[base.y][base.x],to=centers[target.y][target.x],cell=airBattleCellPixels(base,target),craftId=orders.aircraftId||Object.keys(MODELS).find(id=>MODELS[id]===craft)||'f16',weaponId=orders.weaponId||AIR_BATTLE_DEFAULT_WEAPON[craftId],weapon=AIR_BATTLE_WEAPONS[craftId]?.[weaponId],damage=Math.max(1,Math.round(craft.damage*(weapon?.damage??1)));
 const flight={id:'conventional-v3-'+battle.turn+'-'+(++flightSequence),kind:craft.kind,side:base.side,status:'flying',typeId:'standard',x:from.x,y:from.y,progress:0,exposure:orders.approachId==='low'?.74:orders.approachId==='sead'?.84:1,engagedDefenses:[],cellPixels:cell};
 const threats=battle.airDefenses.filter(d=>d.side!==base.side&&!d.disabled).map(d=>({...centers[d.y][d.x],range:(d.range||4)*cell}));
 let route=craft.recon?makeReconRoute(from,to,cell,api.THEATER):makeTacticalRoute(from,to,{cell,standoff:(weapon?.standoff||0)*cell,index,kind:craft.kind,approach:orders.approachId,threats,width:api.THEATER.width,height:api.THEATER.height});
 if(['F16','MIG29','SU24','A10'].includes(craft.airframe))route=smoothAircraftRoute(route,cell);
 const layer=node('g',{class:'air-sortie air-sortie-lab-style tactical-v3 '+craft.kind},groups.effects),icon=makePlane(layer,craft.kind,craft.airframe);
 const reconBefore=new Map(knownTargets(battle,base.side).map(r=>[r.entityId,{x:r.x,y:r.y,status:r.status}]));stageFlightFlight(flight);let attackNotified=false,strikeImpacted=false;const attackDone=()=>{if(!attackNotified){attackNotified=true;orders.onAttackDone?.();}};let truceIncidentChecked=false;let reconClock=0;let aborted=false;let distance=0,last=null,bank=0,released=false,total=0,hits=0,landed=false,pause=0,strikePromise=Promise.resolve(),pose=route.sample(0);
 const current=()=>api.battle===missionBattle;
 const strike=()=>{if(released)return;released=true;if(craft.recon)return;
  if(craft.kind==='transport'){pause=2;return}if(craft.kind==='helicopter')pause=1.15;
  const heading=pose.heading,start={x:pose.x-Math.cos(heading)*8-Math.sin(heading)*16,y:pose.y-Math.sin(heading)*8+Math.cos(heading)*16};
  strikePromise=(async()=>{
   const heli=craft.kind==='helicopter',guided=!['freefall','rockets'].includes(weaponId);
   let solution=tacticalSolution(base,target,craft,weapon,pose,cell,missionRange);
   if(!solution){aborted=true;status('أُلغي إطلاق السلاح: الهدف المحدد لم يعد صالحاً أو خرج من مدى الإصابة؛ الطائرة تعود دون قصف بديل.','warn');return;}
   if(!guided&&target.unit&&(solution.cell.x!==target.x||solution.cell.y!==target.y)){aborted=true;status('تحرك الهدف خارج نقطة القصف؛ أُلغيت الضربة غير الموجهة.','warn');return;}
   // Unguided rockets keep their release-time aim; guided missiles retain target identity.
   const fixed=solution;
   const aim=()=>{solution=guided?tacticalSolution(base,target,craft,weapon,start,cell,missionRange):fixed;return solution?.point;};
   if(getArmisticeState(battle).active)breakArmistice(battle,'إطلاق سلاح جوي أثناء الهدنة',base.side);const fixedWing=['F16','MIG29','SU24','A10'].includes(craft.airframe);const arrived=await (fixedWing?aircraftMunitionFX:munitionFX)(groups.effects,start,solution.point,{heading,weaponId,rocket:['agm','hellfire','rockets','maverick'].includes(weaponId),valid:current,aim:guided?aim:null});
   if(!arrived||!current()||!solution){aborted=true;return;}
   const result=guided&&solution.unit?helicopterUnitDamage(solution.unit,damage,base.side):conventionalDamage(solution.cell,damage,base.side);
   recordEvidence(battle,base.side,solution.cell,{damage:result.dealt});total+=result.dealt;hits+=result.impacts;if(battle.lastAirOrder)battle.lastAirOrder.impacts.push({x:solution.cell.x,y:solution.cell.y,targetId:target.id??target.unit?.id??null,damage:result.dealt});
   (fixedWing?aircraftImpactFX:impactFX)(groups.effects,solution.point,{size:craft.kind==='bomber'?1.25:heli?.8:1,label:result.dealt?'−'+result.dealt:weapon?.label||'أثر القصف'});strikeImpacted=true;
  })().finally(attackDone);
 };
 const ok=await new Promise(resolve=>{const tick=now=>{try{
  if(!current()||!icon.isConnected){resolve(false);return}if(document.hidden){last=null;requestAnimationFrame(tick);return}
  const dt=last===null?0:Math.min(.05,(now-last)/1000);last=now;
  if(!truceIncidentChecked&&getArmisticeState(battle).active){const detected=[...battle.airDefenses.filter(d=>!d.disabled),...battle.units.filter(u=>u.strength>0&&u.role==='reconRadar')].some(d=>d.side!==base.side&&Math.hypot(centers[d.y][d.x].x-pose.x,centers[d.y][d.x].y-pose.y)<=(d.range??6)*cell);if(detected){truceIncidentChecked=true;maybeArmisticeIncident(battle,base.side,craft.recon?'recon':'drone',true);}}const shot=defenseForFlight(flight,pose);if(shot?.hit||flight.status==='intercepted'){strikeImpacted=true;flight.status='intercepted';impactFX(groups.effects,pose,{size:.9,kind:'air',label:'اعتراض'});resolve(false);return}
  if(pause>0){pause=Math.max(0,pause-dt);if(pause===0&&craft.kind==='transport'){landed=landTransport(target);hits+=landed?1:0;attackDone();}}
  else{const next=Math.min(route.length,distance+paceAt(distance,route.length,cell,(['RQ7','MQ9'].includes(craft.airframe)?1.1:flightPace(craft.kind,craft.airframe)))*dt);if(!released&&next>=route.releaseDistance){distance=route.releaseDistance;pose=route.sample(distance);strike()}else distance=next;}
  pose=route.sample(distance);if(base.side==='blue'&&craft.kind!=='transport'&&!strikeImpacted&&(!craft.recon||distance<route.returnDistance))api.followFriendlyAirPoint?.(pose);Object.assign(flight,{x:pose.x,y:pose.y,progress:distance/route.length});
  if(craft.recon&&distance>=route.returnDistance&&!attackNotified){recordEvidence(battle,base.side,target,{recon:true,confirmed:knownTargets(battle,base.side).some(r=>r.status==='observed'&&r.turn===battle.turn&&hexDistance(r,target)<=3&&(!reconBefore.has(r.entityId)||reconBefore.get(r.entityId).x!==r.x||reconBefore.get(r.entityId).y!==r.y||reconBefore.get(r.entityId).status!=='observed'))});attackDone();}
  if(craft.recon){reconClock-=dt;if(reconClock<=0){reconClock=.5;observeAirPosition(base.side,pose,3);let changed=false;battle.uavRecon??={};for(const u of battle.units){if(u.side===base.side||u.strength<=0)continue;const p=centers[u.y]?.[u.x];if(!p||Math.hypot(p.x-pose.x,p.y-pose.y)>cell*3)continue;battle.uavRecon[base.side]??={};const previous=battle.uavRecon[base.side][u.id];if(!previous||previous.x!==u.x||previous.y!==u.y||previous.until<battle.turn)changed=true;battle.uavRecon[base.side][u.id]={x:u.x,y:u.y,until:battle.turn+1};}if(changed)api.renderAll();}}

  bank+=(Math.max(-1,Math.min(1,pose.curvature*cell*2))-bank)*Math.min(1,dt*3);
  const altitude=Math.min(1,distance/(cell*1.4),(route.length-distance)/(cell*1.8)),scale=(1.05+.3*Math.max(0,altitude))*(craft.airframe==='RQ7'?.42:craft.airframe==='MQ9'?.5:['helicopter','transport'].includes(craft.kind)?.86:1);
  icon.setAttribute('transform',`translate(${pose.x} ${pose.y}) rotate(${pose.heading*180/Math.PI+90}) scale(${scale})`);
  const body=icon.querySelector('.tac-airframe');if(body)body.setAttribute('transform',`skewY(${['F16','MIG29','SU24','A10'].includes(craft.airframe)?bank*4:0}) scale(${1-Math.abs(bank)*(['F16','MIG29','SU24','A10'].includes(craft.airframe)?.22:.14)} 1)`);
  if(distance>=route.length){resolve(true);return}requestAnimationFrame(tick);
 }catch(error){console.error('Helicopter/tactical animation failed',error);resolve(false);}};requestAnimationFrame(tick)});
 finishDefenseFlight(flight);icon.remove();await strikePromise;layer.remove();missionBattle.inFlightDrones=missionBattle.inFlightDrones.filter(f=>f!==flight);
 if(!current())return{canceled:true,dealt:0,hits:0};if(ok)flight.status='returned';return{intercepted:!ok,aborted,dealt:total,hits,cells:released&&!aborted?1:0,landed};
}

async function flyOne(base,target,craft,pattern,index,orders={}){if(craft.kind==='stealth')return(await flyStealthFormation(base,target,craft,pattern,{...orders,sortieCount:1}))[0];return flyConventionalAirBattle(base,target,craft,index,orders)}

async function mission(cell){if(getArmisticeState(battle).active&&$('airBattleCraft').value!=='rq7'&&$('airBattleCraft').value!=='mq9'){status('الهدنة تمنع الغارات القتالية؛ المسموح حالياً طلعات الاستطلاع والطائرات غير المسلحة.','warn');return;}if(isBusy||api.groundBusy?.()){status('انتظر اكتمال الأمر الجاري قبل إطلاق طلعة جديدة.','warn');return;}if(!validTacticalTarget(cell)){status('تعذر تحديد الهدف؛ اختر وحدة أو نقطة صالحة داخل الخريطة.','warn');return;}cell={...cell,...(cell.unit?{unit:{id:cell.unit.id,side:cell.unit.side}}:{})};const missionBattle=battle;if(battle.phase!=='player'||battle.finished){status('انتظر حتى يعود دور قواتك قبل إصدار طلعة جديدة.','warn');return}const base=selectedBase(),craftId=$('airBattleCraft').value,craft={...model(),damage:model().damage*commandAttackFactor(battle,base,'air')},available=base?.turnStock?.[craftId]??0,count=craft.kind==='transport'?1:(Number($('airBattleCount').value)||1),distance=targetDistance(cell,base),weaponId=$('airBattleWeapon').value,weapon=AIR_BATTLE_WEAPONS[craftId]?.[weaponId],approachId=craft.kind==='stealth'?({'radar-avoid':'sead',offset:'offset',direct:'low'}[$('airBattleApproach').value]||'offset'):$('airBattleApproach').value;if(!base||base.disabled||!forwardAvailable(base)||!airportReady(battle,base,craftId)){status('تعطل المدرج أو الحظيرة، أو الخدمات متوقفة بهذه الجولة؛ راجع لوحة الإعمار.','warn');return}if(craft.kind==='transport'?!isFriendlyLanding(cell):craft.kind==='stealth'?!isEnemyOwnedCell(cell):!validTacticalTarget(cell)){status(craft.kind==='transport'?'اختر خلية زرقاء خالية للإنزال.':craft.kind==='stealth'?'اختر مركز منطقة القصف داخل أرض العدو؛ لا يلزم وجود وحدة أو مبنى في المركز.':'اختر بيتاً أو وحدة أو أي نقطة داخل الخريطة.','warn');return}if(craft.kind!=='stealth'&&craft.kind!=='transport'&&!weapon){status('اختر سلاحاً متوافقاً مع الطائرة المحددة.','warn');return}const release=Math.min(weapon?.standoff??0,distance*.45),needed=Math.max(0,distance-release)+(craft.recon?2:0);if(needed>effectiveRange(craft)){status(craft.kind==='stealth'?'منطقة القصف خارج مدى القاعدة؛ اختر مركزاً أقرب أو قاعدة أخرى.':'الهدف يبعد '+distance.toFixed(1)+' خلية؛ الوصول لنقطة إطلاق السلاح يحتاج '+needed.toFixed(1)+' والمتاح '+effectiveRange(craft).toFixed(1)+'. لم تُطلق الطائرات؛ اختر قاعدة أقرب أو فعّل مرافقة الوقود إن توفرت.','warn');return}if(craft.kind!=='stealth'&&craft.kind!=='transport'&&!helicopterTarget(cell)){status('الهدف المحدد دُمّر أو لم يعد موجوداً؛ لم تُطلق أي طائرة.','warn');return;}if(getArmisticeState(battle).active&&craftId==='mq9'&&!window.confirm('إطلاق المسيرة المسلحة وقصف الهدف ينهي الهدنة. هل تريد المتابعة؟'))return;if(available<count){status('المخزون المتاح في '+base.name+' هو '+nfmt(available)+' طائرة فقط.','warn');return}if(craft.kind==='transport'){const passenger=battle.units.find(u=>u.side==='blue'&&u.kind==='infantry'&&!u.modelId&&u.strength>0&&!u.moved&&!u.attacked&&hexDistance(u,base)<=2);if(!passenger){status('النقل يحتاج فصيل مشاة جاهزاً ضمن خليتين من المطار؛ لا يُنشئ قوات جديدة.','warn');return;}transportPassenger=passenger.id;passenger.airliftReserved=true;passenger.airliftDelivered=false;}battle.lastAirOrder={targetId:cell.id??cell.unit?.id??null,x:cell.x,y:cell.y,name:cell.name??missionTargetName(cell,craft),craftId,tanker:tankerEnabled(craft),impacts:[],state:'flying'};const missionRange=effectiveRange(craft),pattern=$('airBattlePattern').value,bombCount=craft.kind==='stealth'?(Number($('airBattleBombCount').value)||5):5,spread=craft.kind==='stealth'?(Number($('airBattleSpread').value)||520):520;if(tankerEnabled(craft)){tankerEscort=startTanker(base,cell);if(!tankerEscort)return;}base.turnStock[craftId]-=count;base.campaignAirborne??={};base.campaignAirborne[craftId]=(base.campaignAirborne[craftId]??0)+count;activeMissions++;isBusy=true;groundReleased=false;syncBaseAircraft();commandMode=false;pendingStealthTarget=null;stealthPreviewLayer?.replaceChildren();refreshControls();status('أقلعت '+craft.name+' نحو '+missionTargetName(cell,craft)+' · القطاع '+(cell.x+1)+'/'+(cell.y+1)+'.');if(craft.kind==='helicopter')status('بدأت طلعة المروحية نحو '+(cell.unit?'الوحدة المحددة':'نقطة القصف المحددة')+' · القطاع '+(cell.x+1)+'/'+(cell.y+1)+'.');const settled=new Set(),onAttackDone=i=>{settled.add(i);if(settled.size===count&&missionBattle===api.battle)releaseGroundControl();};const flown=[];if(craft.kind==='stealth'){try{flown.push(...await flyStealthFormation(base,cell,craft,pattern,{aircraftId:craftId,weaponId,approachId,sortieCount:count,bombCount,spread,onAttackDone:()=>{for(let i=0;i<count;i++)onAttackDone(i);}}))}catch(error){console.error('Stealth formation failed:',error);flown.push({intercepted:true,dealt:0,failed:true})}}else{const promises=[];for(let i=0;i<count;i++)promises.push(new Promise(resolve=>setTimeout(resolve,i*1300)).then(()=>flyOne(base,cell,craft,pattern,i,{aircraftId:craftId,weaponId,approachId,sortieCount:count,bombCount,spread,range:missionRange,onAttackDone:()=>onAttackDone(i)})).then(result=>flown.push(result)).finally(()=>onAttackDone(i)));const outcomes=await Promise.allSettled(promises);for(const outcome of outcomes)if(outcome.status==='rejected'){console.error('Air sortie failed:',outcome.reason);flown.push({intercepted:true,dealt:0,failed:true})}}base.campaignAirborne[craftId]=Math.max(0,(base.campaignAirborne[craftId]??0)-count);if(missionBattle!==api.battle||flown.some(result=>result.canceled)){activeMissions=Math.max(0,activeMissions-1);isBusy=activeMissions>0;if(missionBattle===api.battle){refreshControls();status('توقفت الطلعة؛ راجع رسالة الخطأ في الطرفية.','warn')}return}if(battle.lastAirOrder)battle.lastAirOrder.state=flown.some(x=>x.aborted)?'aborted':flown.every(x=>x.intercepted)?'intercepted':'completed';if(craft.kind==='transport'){const passenger=battle.units.find(u=>u.id===transportPassenger);if(passenger){passenger.airliftReserved=false;if(!passenger.airliftDelivered&&flown.some(x=>x.intercepted)){passenger.hp=0;passenger.strength=0;battle.events.push('فُقد الفصيل المنقول مع مروحية النقل.');}}transportPassenger=null;}const lost=flown.filter(x=>x.intercepted).length;if(lost>0)markAirframeDamage(base,craftId,lost);const damage=flown.reduce((sum,x)=>sum+x.dealt,0),bombs=craft.kind==='stealth'?count*bombCount:count;const targetName=missionTargetName(cell,craft),weaponName=weapon?.label||(craft.kind==='stealth'?'قصف شبح مساحي':craft.label);battle.events.push(craft.name+': '+weaponName+' · '+(AIR_BATTLE_APPROACHES[approachId]?.label||'مسار المهمة')+' · أقلعت '+count+' طائرات من '+base.name+' نحو '+targetName+'؛ '+lost+' اعتراضات، '+damage+' ضرراً.');battle.events=battle.events.slice(-10);recordSortie(battle,battle.lastAirOrder);activeMissions=Math.max(0,activeMissions-1);isBusy=activeMissions>0;syncBaseAircraft();api.renderAll();refreshControls();status(craft.recon?'انتهت طلعة الاستطلاع · أُسقطت '+lost+' مسيرة. الرصد يبقى حتى نهاية الجولة التالية في المواقع المرصودة، وتختفي الوحدة إذا غادرت موقع الرصد.':flown.some(x=>x.aborted)?'انتهت الطلعة: أُلغيت ضربة أو أكثر بسبب فقدان الهدف المحدد أو خروجه من المدى؛ لم يُستبدل بهدف آخر. الضرر المنفذ: '+damage:lost===count&&damage===0?'أُطلقت الطلعة نحو '+targetName+' لكن الدفاع الجوي اعترض جميع الطائرات قبل الإصابة.':'انتهت طلعة '+craft.name+' نحو '+targetName+': '+count+' طائرات · '+(craft.kind==='stealth'?bombs+' قنابل موزعة':weapon?.label||craft.label)+' · '+damage+' ضرر · '+lost+' طائرات أُسقطت.')}

function enemyAirTarget(base,craft){
 const contacts=battle.units.filter(u=>u.side==='blue'&&u.strength>0&&!u.hidden&&dist(base,u)<=craft.range);
 const urgent=contacts.filter(u=>dist(base,u)<=4).sort((a,b)=>dist(base,a)-dist(base,b)||a.hp-b.hp)[0];if(urgent)return{target:{x:urgent.x,y:urgent.y},name:urgent.modelId??urgent.role??'قوة قريبة'};
 const reports=knownTargets(battle,'red').filter(r=>r.status==='observed'&&r.age<=1&&r.confidence>=90);
 const strategic=facilityTargets(battle).filter(t=>t.side==='blue'&&!t.asset.disabled&&(t.asset.structureHp??t.asset.hp??1)>0&&dist(base,t)<=craft.range&&reports.some(r=>r.entityId===t.asset.id))
  .sort((a,b)=>({command:95,factory:90,airDefense:88,airport:84,radar:76,depot:72,refinery:68,base:64}[b.type]??55)-({command:95,factory:90,airDefense:88,airport:84,radar:76,depot:72,refinery:68,base:64}[a.type]??55)||dist(base,a)-dist(base,b))[0];
 if(strategic)return{target:{x:strategic.x,y:strategic.y},name:strategic.name};
 const target=contacts.sort((a,b)=>dist(base,a)-dist(base,b)||a.hp-b.hp)[0];return target?{target:{x:target.x,y:target.y},name:target.modelId??target.role??'قوة مرصودة'}:null;
}
async function runEnemyAirSortie(){if(!battle||battle.phase!=='enemy'||battle.finished||getArmisticeState(battle).active)return;const options=['mig29','f16','su24','stealth'];for(const base of hostile){if(base.disabled)continue;for(const id of options){const craft=MODELS[id];if((base.turnStock?.[id]??0)<=0)continue;const order=enemyAirTarget(base,craft);if(!order)continue;base.turnStock[id]--;const result=await flyOne(base,order.target,craft,id==='stealth'?'horizontal':'point',0,{fastResolve:true});if(result.canceled)return;battle.events.push(`طلعة العدو ${craft.name} من ${base.name} نحو ${order.name}: ${result.intercepted?'تم اعتراضها أو إسقاطها':'نفذت الضربة'}؛ ${result.dealt} ضرر.`);battle.events=battle.events.slice(-10);api.renderAll();break;}}}
function install(){api=window.__REBEL_LAB__;if(!api){setTimeout(install,60);return}api.activateAirbase=id=>{const base=bases().find(b=>b.id===id);if(base?.side==='blue')activateAirbase(base);};api.airBusy=()=>isBusy&&!groundReleased;api.hasActiveSorties=()=>activeMissions>0;api.airTargeting=()=>commandMode||supportPicking;window.addEventListener('click',captureAirMapInput,true);api.renderRefinery=()=>{for(const r of battle.refineries??[]){updateEnemyRefinery(r);if(r.ignited&&battle.turn-(r.lastDamageTurn??battle.turn)<=1)igniteRefinery(r);else{refineryFireNode?.remove();refineryFireNode=null;}}};battle=api.battle;centers=api.centers;groups=api.groups;svg=api.svg;api.runEnemyAirSortie=runEnemyAirSortie;api.planAutomaticAir=automaticAirPlan;api.startAutomaticAir=startAutomaticAir;api.refreshAirbaseStocks=refreshAirbaseStocks;chooseFreeBasePositions();baseLayer=node('g',{id:'airBattleBases'},null);svg.insertBefore(baseLayer,groups.logistics);stealthPreviewLayer=node('g',{class:'air-battle-stealth-plan-layer'},svg);drawBases();ensureEnemyRefinery();initBaseSelect();installAirSupport();const partsButton=document.createElement('button');partsButton.id='airportPartsButton';partsButton.textContent='أجزاء المطار';partsButton.onclick=()=>{const part=battle.campaignAssets.find(a=>a.airbaseId===selectedBase()?.id&&a.part==='runway');if(part)inspectCampaign(part.id);};const repairButton=document.createElement('button');repairButton.id='aircraftRepairButton';repairButton.textContent='إصلاح الطائرات المتضررة';repairButton.title='إصلاح الطائرات المتضررة بمواد الإمداد؛ تعود في دورك التالي.';repairButton.onclick=()=>{const result=queueAircraftRepairs(selectedBase());status(result.reason,result.ok?'':'warn');refreshControls();api.renderAll();};$('airBattleCommand').append(partsButton,repairButton);$('airBattleBase').addEventListener('change',()=>{pendingStealthTarget=null;commandMode=false;stealthPreviewLayer?.replaceChildren();syncBaseAircraft();updateCommandTitle();refreshControls()});$('airBattleCraft').addEventListener('change',()=>{pendingStealthTarget=null;commandMode=false;stealthPreviewLayer?.replaceChildren();updateCommandTitle();if($('airBattleCraft').value==='stealth'&&$('airBattlePattern').value==='point')$('airBattlePattern').value='horizontal';refreshControls();const m=model();status(`${m.name}: مدى ${nfmt(m.range)} خلية · ${m.label}${m.kind==='stealth'?' · ٥ قنابل في خط واحد':''}.`)});$('airBattleCount').addEventListener('change',()=>{if(pendingStealthTarget)refreshStealthPlan();refreshControls()});$('airBattleBombCount').addEventListener('change',()=>{if(pendingStealthTarget)refreshStealthPlan();refreshControls()});$('airBattleSpread').addEventListener('input',()=>{$('airBattleSpreadValue').value=$('airBattleSpread').value;if(pendingStealthTarget)refreshStealthPlan();refreshControls()});$('airBattleFocus').addEventListener('change',()=>{if(pendingStealthTarget)refreshStealthPlan();});$('airBattlePattern').addEventListener('change',()=>{if(pendingStealthTarget)refreshStealthPlan();refreshControls()});$('airBattleApproach').addEventListener('change',()=>{if(pendingStealthTarget)refreshStealthPlan();refreshControls()});$('airBattleStealthClear').addEventListener('click',()=>{pendingStealthTarget=null;commandMode=true;stealthPreviewLayer?.replaceChildren();refreshControls();status(stealthTargetPrompt())});$('closeAirCommand').addEventListener('click',()=>{$('airBattleCommand').hidden=true;pendingStealthTarget=null;stealthPreviewLayer?.replaceChildren();commandMode=false;document.querySelector('.command-dock').classList.remove('contextual-active');refreshControls()});svg.addEventListener('click',event=>{let t=event.target.closest?.('[data-airbase-id]'),base=t?bases().find(q=>q.id===t.getAttribute('data-airbase-id')):null;if(!base&&!event.target.closest?.('[data-campaign-id]')&&typeof svg.createSVGPoint==='function'&&svg.getScreenCTM()){const p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;const q=p.matrixTransform(svg.getScreenCTM().inverse());base=friendly.map(b=>({b,c:centers[b.y]?.[b.x]})).filter(v=>v.c&&Math.abs(q.x-v.c.x)<=126&&Math.abs(q.y-v.c.y)<=78).sort((a,b)=>Math.hypot(q.x-a.c.x,q.y-a.c.y)-Math.hypot(q.x-b.c.x,q.y-b.c.y))[0]?.b}if(base?.side==='blue'&&!commandMode&&!supportPicking){activateAirbase(base);event.preventDefault();event.stopImmediatePropagation();return}t=event.target.closest?.('.drone-base,[data-unit-id]');if(!t)return;const droneBase=t.classList?.contains('drone-base'),unitId=t.getAttribute('data-unit-id'),unit=unitId?battle.units.find(q=>q.id===unitId):null;if(droneBase&&t.classList.contains('blue')||unit?.side==='blue'&&['droneOperator','droneVehicle'].includes(unit.role)){$('airBattleCommand').hidden=true;$('droneCommand').hidden=false;document.querySelector('.command-dock').classList.add('contextual-active')}else if(unit?.side==='blue'){$('airBattleCommand').hidden=true;$('droneCommand').hidden=true;document.querySelector('.command-dock').classList.remove('contextual-active')}},true);$('droneSourceSelect').addEventListener('change',()=>{const source=$('droneSourceSelect').value;$('droneCommand').hidden=!source;if(source){$('airBattleCommand').hidden=true;document.querySelector('.command-dock').classList.add('contextual-active')}else document.querySelector('.command-dock').classList.remove('contextual-active')});$('airBattleFocus').addEventListener('change',()=>{if(pendingStealthTarget)refreshStealthPlan();});$('airBattlePattern').addEventListener('change',()=>{if(pendingStealthTarget)refreshStealthPlan();status(`توزيع القنابل الشبحية: ${$('airBattlePattern').value==='horizontal'?'حزام أفقي':'حزام عمودي'} · ${$('airBattleBombCount').value} قنابل · طول ${$('airBattleSpread').value}.`)});$('airBattleTargetMode').addEventListener('click',()=>{document.querySelector('.facility-choice')?.remove();document.getElementById('campaignPanel')?.setAttribute('hidden','');if(model().kind==='stealth'){if(pendingStealthTarget){const target={...pendingStealthTarget};void mission(target);return}commandMode=!commandMode;refreshControls();status(commandMode?stealthTargetPrompt():'أُلغي اختيار منطقة القصف.');return}commandMode=!commandMode;refreshControls();status(commandMode?`تم اختيار ${model().name} من ${selectedBase().name}. اضغط البيت أو نقطة القصف على الخريطة.`:'أُلغي اختيار الهدف.');});svg.addEventListener('click',event=>{if(!commandMode||battle.phase!=='player'||isBusy)return;const cell=selectedCellFromEvent(event);if(!cell){status(model().kind==='stealth'?'اضغط داخل أرض العدو لاختيار مركز حزام القنابل.':'اضغط خلية من الخريطة أو وحدة أو مدينة.','warn');return}event.preventDefault();event.stopImmediatePropagation();if(model().kind==='stealth'){void previewStealthTarget(cell);return}void mission(cell)},true);$('endTurn').addEventListener('click',event=>{if(activeMissions>0){event.preventDefault();event.stopImmediatePropagation();status('انتظر اكتمال الغارات الجوية الجارية قبل إنهاء الجولة.','warn')}},true);$('endTurn').addEventListener('click',()=>setTimeout(()=>{refreshControls();status(battle.phase==='player'?'عاد دورك؛ تتجدد طلعات القواعد لهذا الدور.':'دور العدو؛ قواعدك تنتظر عودة الطلعات.')},300));$('resetBattle').addEventListener('click',()=>setTimeout(()=>{battle=api.battle;roundStamp=battle.turn;chooseFreeBasePositions();drawBases();ensureEnemyRefinery();refreshControls()},40));roundStamp=battle.turn;updateCommandTitle();refreshControls();setInterval(()=>{if(!isBusy){refreshControls();drawBases()}},1800);}
install();

/* AIR_BATTLE_ROUTE_UI_FIX_V1 */

/* AIR_BATTLE_FIGHTER_MISSIONS_V1 */
/* AIR_BATTLE_SORTIE_ROUND_RESET_V1 */
/* AIR_BATTLE_MULTI_SORTIE_V1 */
/* AIR_BATTLE_PARALLEL_SORTIES_V1 */

/* AIR_BATTLE_STEALTH_HEADING_V1 */

/* AIR_BATTLE_STEALTH_FLIGHT_FIX_V1 */

/* AIR_BATTLE_STEALTH_COMMAND_DETAILS_V1 */

/* AIR_BATTLE_STEALTH_FORMATION_SYNC_V1 */

/* AIR_BATTLE_STEALTH_SYNC_FIX_V2 */

/* AIR_BATTLE_STEALTH_FORMATION_FIX_V1 */

/* AIR_BATTLE_STEALTH_TURN_BOMB_FIX_V1 */

/* AIR_BATTLE_STEALTH_WAVE_TIMING_V1 */

/* AIR_BATTLE_STEALTH_ROUTE_ALIGNMENT_FIX_V1 */

/* AIR_BATTLE_STEALTH_VISIBILITY_HOTFIX_V1 */

/* AIR_BATTLE_STEALTH_ROUTE_SMOOTHING_V1 */

/* AIR_BATTLE_STEALTH_TURN_RADIUS_V1 */

/* AIR_BATTLE_STEALTH_FLIGHT_REALISM_V1 */

/* AIR_BATTLE_STEALTH_PATH_OWNERSHIP_V1 */

/* AIR_BATTLE_STEALTH_FLIGHT_DYNAMICS_V1 */

/* AIR_BATTLE_STEALTH_PERFORMANCE_PACE_V1 */

/* AIR_BATTLE_STEALTH_STABILITY_V1 */

/* AIR_BATTLE_STEALTH_TURN_LAG_FIX_V1 */

/* AIR_BATTLE_STEALTH_INDEPENDENT_FLIGHT_AI_V1 */

/* AIR_BATTLE_ENEMY_REFINERY_COMBUSTION_V1 */

/* AIR_BATTLE_REFINERY_DESTRUCTION_V2 */

/* AIR_BATTLE_REFINERY_DESTRUCTION_V3 */

document.getElementById('resetBattle').addEventListener('click',()=>{if(stealthRefreshTimer)clearTimeout(stealthRefreshTimer);stealthRefreshTimer=0;stealthDirty=null;stealthFx?.clear();});

window.addEventListener('rebel-cancel-air-target',()=>{commandMode=false;pendingStealthTarget=null;stealthPreviewLayer?.replaceChildren();if(api)refreshControls();});

const stableMission=mission;
mission=async function(cell){if(isBusy||api.groundBusy?.()||battle.phase!=='player')return;window.dispatchEvent(new Event('rebel-enter-air-command'));const before=activeMissions;try{return await stableMission(cell);}catch(error){console.error('Sortie failed',error);activeMissions=before;isBusy=activeMissions>0;commandMode=false;pendingStealthTarget=null;status('تعذر إكمال الطلعة؛ استُعيد التحكم.','warn');refreshControls();}finally{if(transportPassenger){const passenger=battle.units.find(u=>u.id===transportPassenger);if(passenger)passenger.airliftReserved=false;transportPassenger=null;}if(tankerEscort){const escort=tankerEscort;tankerEscort=null;isBusy=true;await escort.finish();activeMissions=before;isBusy=activeMissions>0;refreshControls();}}};

// AIR SUPPORT V11 — isolated command flow for corridor patrols and relocation.
function tankerEnabled(craft=model()){
 const b=selectedBase(),used=b?.tankerTurn===battle?.turn?(b.tankerUsed||0):0;
 return !['RQ7','MQ9'].includes(craft.airframe)&&!!$('airTanker')?.checked&&['fighter','bomber','stealth'].includes(craft.kind)&&(b?.tankers||0)>used;
}
function effectiveRange(craft=model()){return craft.range*(tankerEnabled(craft)?1.5:1);}
function forwardAvailable(base){return !base.forwardRef||base.forwardRef.side==='blue'&&!base.forwardRef.disabled;}
function relocationTargets(source){
 const destinations=bases().filter(b=>b!==source&&!b.disabled&&forwardAvailable(b)&&battle.owners[b.y*MAP_GRID.columns+b.x]==='blue').map(b=>({id:'air:'+b.id,name:b.name,x:b.x,y:b.y,base:b}));
 for(const d of battle.logistics?.depots||[])if(d.side==='blue'&&!d.disabled&&!bases().some(b=>b.x===d.x&&b.y===d.y))destinations.push({id:'depot:'+d.id,name:'مهبط أمامي · '+(d.name||'مقر الإمداد'),x:d.x,y:d.y,depot:d});
 return destinations;
}
function patrolCheck(){
 const base=selectedBase(),cell=104*Math.sqrt(3),limit=32;
 const fail=reason=>({ok:false,reason});
 if(battle.finished)return fail('انتهت المعركة؛ لا يمكن إصدار طلعة.');
 if(battle.phase!=='player')return fail('انتظر عودة دورك لتنفيذ مسار الاستطلاع.');
 if(isBusy||api.groundBusy?.())return fail('انتظر اكتمال الحركة أو الطلعة الجارية.');
 if($('airBattleCraft').value!=='ah1z'||$('airHeliTask').value!=='mission')return fail('اختر مروحية Viper وأمر المهمة القتالية / الاستطلاع.');
 if(!base||!forwardAvailable(base))return fail('المهبط غير متاح أو لم يعد تحت سيطرتك.');
 if(base.disabled)return fail('مدرج المطار معطل؛ أصلحه أو اختر قاعدة أخرى.');
 if(!airportReady(battle,base,'ah1z'))return fail('الحظيرة أو المدرج معطل، أو الخدمات لا تسمح بالإقلاع بهذه الجولة؛ راجع أجزاء المطار والإصلاح.');
 if(!(base.turnStock?.ah1z>0))return fail('لا توجد مروحية Viper جاهزة بهذه القاعدة؛ انتظر الجولة التالية أو اختر قاعدة أخرى.');
 if(!supportPoints.length)return fail('ارسم نقطة واحدة على الأقل لمسار الاستطلاع.');
 if(supportPoints.some(p=>!validTacticalTarget(p)))return fail('بالمسار نقطة خارج الخريطة؛ امسح المسار وأعد رسمه.');
 const route=patrolRoute(base,supportPoints);if(!route||!Number.isFinite(route.length))return fail('تعذر حساب المسار؛ أعد رسم النقاط.');
 const required=route.length/cell;
 if(required>limit)return fail('الوقود لا يكفي: طول الذهاب والعودة مع الالتفاف '+required.toFixed(1)+' خلية، والمتاح '+limit+'. احذف نقطة أو قرّب المسار من القاعدة.');
 return {ok:true,route,reason:'جاهزة للتنفيذ · الذهاب والعودة '+required.toFixed(1)+' / '+limit+' خلية.'};
}
function refreshSupportUI(){
 if(!$('airSupportPanel'))return;
 const craft=model(),id=$('airBattleCraft').value,heli=craft.kind==='helicopter'||craft.kind==='transport',base=selectedBase(),busy=isBusy||api.groundBusy?.()||battle.phase!=='player'||battle.finished;
 $('airTankerLabel').hidden=heli||['rq7','mq9'].includes(id);$('airTanker').disabled=busy||!(base?.tankers>0);if(heli||['rq7','mq9'].includes(id))$('airTanker').checked=false;
 const used=base?.tankerTurn===battle.turn?(base.tankerUsed||0):0;
 if(used>=(base?.tankers||0)){$('airTanker').checked=false;$('airTanker').disabled=true;}
 $('airTankerInfo').textContent=`KC-46A · المتاح ${Math.max(0,(base?.tankers||0)-used)} · المدى ${effectiveRange(craft).toFixed(1)} خلية (+٥٠٪ مع المرافقة)`;
 const relocating=$('airHeliTask')?.value==='relocate';$('airHeliTaskLabel').hidden=!heli;$('airPatrolControls').hidden=id!=='ah1z'||relocating;$('airRelocateControls').hidden=!heli||!relocating;
 $('airBattleTargetMode').hidden=id==='ah1z'||(heli&&relocating);$('airBattleCount').disabled=id==='ah1z';if(id==='ah1z')$('airBattleCount').value='1';
 for(const name of ['airPatrolPick','airPatrolUndo','airPatrolClear','airPatrolRun','airRelocate'])$(name).disabled=busy;
 let uavInfo=$('uavMissionBrief');if(!uavInfo){uavInfo=document.createElement('div');uavInfo.id='uavMissionBrief';$('airSupportPanel').append(uavInfo);}uavInfo.hidden=!['rq7','mq9'].includes(id);if(!uavInfo.hidden)uavInfo.innerHTML='<svg viewBox="-125 -85 250 170" width="95" height="65" aria-hidden="true">'+uavArtwork(id==='rq7'?'RQ7':'MQ9')+'</svg><span>'+(id==='rq7'?'غير مسلحة: اختر نقطة استطلاع. تنفذ دورتين فوق المنطقة لنحو 27 ثانية، وتكشف محيط 3 خلايا ثم تعود.':'اختر وحدة أو مبنى أو أرضاً مفتوحة، حتى داخل الجبال. ضربة واحدة ثم عودة؛ الذخيرة والمدى قيم موازنة للعبة.')+'</span>';
 const check=patrolCheck();$('airPatrolRun').disabled=busy;$('airPatrolRun').title=check.reason;$('airPatrolRun').hidden=id!=='ah1z'||relocating;const execution=document.getElementById('patrolExecutionInfo');if(execution){execution.hidden=id!=='ah1z'||relocating;execution.textContent=check.reason;execution.dataset.state=check.ok?'ready':'warn';}if(id==='ah1z'&&!relocating&&!isBusy){$('airSupportFeedback').textContent=check.reason;$('airSupportFeedback').dataset.state=check.ok?'ready':'warn';}
 const select=$('airRelocateTarget'),previous=select.value,targets=relocationTargets(base);select.replaceChildren(...targets.map(d=>{const o=document.createElement('option');o.value=d.id;o.textContent=d.name+' · '+dist(base,d)+' خلايا';return o;}));if(targets.some(d=>d.id===previous))select.value=previous;
 $('airRelocate').disabled=busy||!airportReady(battle,base,id)||!targets.length||!(base?.turnStock?.[id]>0);
 $('airPatrolPick').textContent=supportPicking?'إنهاء رسم المسار':'رسم مسار المرافقة';
 if(base?.forwardRef&&!forwardAvailable(base))$('airBattleTargetMode').disabled=true;
}
function clearSupportPlan(){supportPicking=false;supportPoints=[];supportPreview?.replaceChildren();if($('airPatrolReadout'))$('airPatrolReadout').textContent='ارسم حتى ٦ نقاط · ٨ موجهة / ١٤ خفيفة / ٦٥٠ طلقة';refreshSupportUI();}
function patrolRoute(base,points){
 const from=centers[base.y][base.x],out=points.map(c=>centers[c.y][c.x]);if(!out.length)return null;
 // A rounded return loop avoids an instantaneous reversal at the final waypoint.
 const end=out.at(-1),prev=out.length>1?out.at(-2):from,angle=Math.atan2(end.y-prev.y,end.x-prev.x),r=145,n={x:-Math.sin(angle),y:Math.cos(angle)},u={x:Math.cos(angle),y:Math.sin(angle)};
 const turn=[{x:end.x+u.x*r+n.x*r,y:end.y+u.y*r+n.y*r},{x:end.x+n.x*r*2,y:end.y+n.y*r*2}];
 const back=[]; // Return directly after the turn, without retracing every patrol waypoint.
 const route=supportRoute([from,...out,...turn,...back,{x:from.x+n.x*r,y:from.y+n.y*r},from]);return {...route,returnDistance:route.waypointDistances[out.length]};
}
function showSupportPlan(){
 supportPreview.replaceChildren();const route=patrolRoute(selectedBase(),supportPoints);if(!route){refreshSupportUI();return;}
 node('path',{d:route.path,fill:'none',stroke:'#7fe0c1','stroke-width':9,'stroke-dasharray':'22 14',opacity:.75},supportPreview);
 supportPoints.forEach((p,i)=>{const c=centers[p.y][p.x];node('circle',{cx:c.x,cy:c.y,r:34,fill:'#16363c',stroke:'#8be6ca','stroke-width':5},supportPreview);node('text',{x:c.x,y:c.y+11,'text-anchor':'middle',fill:'#fff','font-size':30},supportPreview).textContent=i+1;});
 $('airPatrolReadout').textContent=`${supportPoints.length}/٦ نقاط · طول الرحلة ${(route.length/(104*Math.sqrt(3))).toFixed(1)}/٣٢ خلية · ٨ موجهة / ١٤ خفيفة / ٦٥٠ طلقة`;
 refreshSupportUI();
}
async function animateSupport(route,icon,flight,{speed=110,onTick=()=>{},valid=()=>true}={}){
 return new Promise(resolve=>{let last=null,distance=0;const tick=now=>{try{
  if(!valid()||!icon.isConnected){resolve(false);return;}if(document.hidden){last=null;requestAnimationFrame(tick);return;}
  const dt=last===null?0:Math.min(.05,(now-last)/1000);last=now;distance=Math.min(route.length,distance+speed*(.4+.6*Math.min(1,distance/200,(route.length-distance)/200))*dt);
  const pose=route.sample(distance);Object.assign(flight,{x:pose.x,y:pose.y,progress:distance/route.length});
icon.setAttribute('transform',`translate(${pose.x} ${pose.y}) rotate(${pose.heading*180/Math.PI+90}) scale(1.1)`);
  if(defenseForFlight(flight,pose)?.hit||flight.status==='intercepted'){impactFX(groups.effects,pose,{kind:'air',size:.9,label:'اعتراض'});resolve(false);return;}
  onTick(pose,dt);if(distance>=route.length){resolve(true);return;}requestAnimationFrame(tick);
 }catch(e){console.error('Support flight',e);resolve(false);}};requestAnimationFrame(tick);});
}
async function runPatrol(){
 const check=patrolCheck();if(!check.ok){status(check.reason,'warn');return;}
 const base=selectedBase(),route=check.route,patrolCells=supportPoints.map(p=>({...p})),cell=104*Math.sqrt(3);
 const missionBattle=battle;window.dispatchEvent(new Event('rebel-enter-air-command'));clearSupportPlan();commandMode=false;base.turnStock.ah1z--;base.campaignAirborne??={};base.campaignAirborne.ah1z=(base.campaignAirborne.ah1z??0)+1;activeMissions++;isBusy=true;groundReleased=false;status('أقلعت Viper لتنفيذ المسار؛ راقب الاستطلاع والعتاد المتبقي.');refreshSupportUI();
 const layer=node('g',{class:'tactical-v3 air-support-v11 helicopter'},groups.effects),icon=makePlane(layer,'helicopter','AH1Z'),flight={id:'patrol-'+(++flightSequence),side:'blue',kind:'helicopter',typeId:'standard',status:'flying',cellPixels:cell,engagedDefenses:[]};stageFlightFlight(flight);
 const ammo={...VIPER_LOAD};let cooldown=0,scan=0,shots=0,inShot=false,returning=false;const pending=[];
 const valid=()=>api.battle===missionBattle;
 try{
  const ok=await animateSupport(route,icon,flight,{valid,onTick:(pose,dt)=>{
   if(flight.progress*route.length>=route.returnDistance){if(!returning){returning=true;Promise.allSettled(pending).then(()=>{if(valid())releaseGroundControl();});}return;}
   cooldown=Math.max(0,cooldown-dt);scan-=dt;if(scan>0)return;scan=.35;observeAirPosition('blue',pose,3);
   battle.airReconContacts??={};battle.airReconContacts.blue??={};
   const candidates=battle.units.filter(u=>u.side!=='blue'&&u.strength>0&&u.domain!=='air').map(u=>({u,p:centers[u.y]?.[u.x]})).filter(t=>t.p&&Math.hypot(t.p.x-pose.x,t.p.y-pose.y)<cell*(t.u.hidden?1.2:3));
   let newlySeen=false;for(const [id,until] of Object.entries(battle.airReconContacts.blue)){if(until<=performance.now()){delete battle.airReconContacts.blue[id];newlySeen=true;}}for(const {u}of candidates){if(!(battle.airReconContacts.blue[u.id]>performance.now()))newlySeen=true;battle.airReconContacts.blue[u.id]=performance.now()+10000;}
   if(newlySeen)api.renderAll();
   if(inShot||cooldown>0||getArmisticeState(battle).active)return;
   const target=candidates.filter(t=>Math.hypot(t.p.x-pose.x,t.p.y-pose.y)<cell*2.4).sort((a,b)=>(b.u.role==='antiAir'?100:0)+(b.u.modelId?30:0)-(a.u.role==='antiAir'?100:0)-(a.u.modelId?30:0)||Math.hypot(a.p.x-pose.x,a.p.y-pose.y)-Math.hypot(b.p.x-pose.x,b.p.y-pose.y))[0]?.u;
   if(!target)return;let damage,kind;
   if((target.modelId||target.role==='antiAir')&&ammo.missiles>0){ammo.missiles--;damage=42;kind='موجّه';}
   else if(ammo.rockets>=2){ammo.rockets-=2;damage=24;kind='صاروخان خفيفان';}
   else if(ammo.rounds>=50){ammo.rounds-=50;damage=12;kind='رشقة ٥٠ طلقة';}
   else if(ammo.missiles>0){ammo.missiles--;damage=42;kind='موجّه';}else return;
   shots++;cooldown=2.4;inShot=true;
   status(`Viper · ${kind} · الباقي: ${ammo.missiles} موجهة / ${ammo.rockets} خفيفة / ${ammo.rounds} طلقة`);
   const shot=(async()=>{let solution=helicopterTarget({unit:target});if(!solution)return;const arrived=await munitionFX(groups.effects,pose,solution.point,{heading:pose.heading,rocket:kind!=='رشقة ٥٠ طلقة',valid,aim:()=>{solution=helicopterTarget({unit:target});return solution?.point;}});if(arrived&&valid()&&solution){const result=helicopterUnitDamage(target,damage,base.side);impactFX(groups.effects,solution.point,{size:.65,label:'−'+result.dealt});}})().finally(()=>inShot=false);pending.push(shot);
  }});
  await Promise.allSettled(pending);
  if(valid()){for(const p of patrolCells)recordEvidence(battle,'blue',p,{recon:true,confirmed:shots>0});if(!ok)markAirframeDamage(base,'ah1z',1);battle.lastPatrol={shots,ammo:{...ammo},returned:ok,turn:battle.turn};status(ok?`عادت Viper · ${shots} اشتباكات · الاستطلاع مؤقت؛ لا يضمن المسار خلوه من العدو.`:'اعترضت المروحية أثناء المهمة.');return true;}
 }finally{base.campaignAirborne.ah1z=Math.max(0,(base.campaignAirborne.ah1z??0)-1);finishDefenseFlight(flight);layer.remove();missionBattle.inFlightDrones=missionBattle.inFlightDrones.filter(f=>f!==flight);activeMissions=Math.max(0,activeMissions-1);isBusy=activeMissions>0;if(valid()){api.renderAll();syncBaseAircraft();refreshControls();setTimeout(()=>{if(valid())api.renderAll();},10100);}}
}
async function relocateHelicopters(){
 const source=selectedBase(),id=$('airBattleCraft').value,craft=MODELS[id],count=Math.max(1,Number($('airBattleCount').value)||1),dest=relocationTargets(source).find(d=>d.id===$('airRelocateTarget').value);
 if(isBusy||api.groundBusy?.()||battle.phase!=='player'||battle.finished||!['helicopter','transport'].includes(craft?.kind)||!dest||source.disabled||!airportReady(battle,source,id)||!forwardAvailable(source)||(source.turnStock[id]||0)<count)return;
 if(dist(source,dest)>craft.range){status('المهبط خارج مدى الانتقال؛ اختر مقراً أقرب.','warn');return;}
 const missionBattle=battle,valid=()=>api.battle===missionBattle,from=centers[source.y][source.x],to=centers[dest.y][dest.x],route=supportRoute([from,{x:(from.x+to.x)/2,y:(from.y+to.y)/2-100},to]);
 source.turnStock[id]-=count;source.stock[id]-=count;activeMissions++;isBusy=true;groundReleased=false;clearSupportPlan();commandMode=false;let arrived=0;
 try{await Promise.all(Array.from({length:count},async(_,i)=>{await new Promise(r=>setTimeout(r,i*800));if(!valid())return;const layer=node('g',{class:'tactical-v3 helicopter air-transfer'},groups.effects),icon=makePlane(layer,craft.kind,craft.airframe),flight={id:'transfer-'+(++flightSequence),side:'blue',kind:craft.kind,typeId:'standard',status:'flying',cellPixels:180,engagedDefenses:[]};stageFlightFlight(flight);try{if(await animateSupport(route,icon,flight,{valid}))arrived++;}finally{finishDefenseFlight(flight);layer.remove();missionBattle.inFlightDrones=missionBattle.inFlightDrones.filter(f=>f!==flight);}}));
  if(valid()){
   const stillValid=relocationTargets(source).some(d=>d.id===dest.id);
   if(!stillValid){source.stock[id]+=arrived;status('تعذر اعتماد المهبط؛ أُلغي النقل وعادت المروحيات الناجية إلى مخزون القاعدة.','warn');return;}
   let base=dest.base;if(!base){base={id:'forward-'+dest.depot.id,side:'blue',name:dest.name,x:dest.x,y:dest.y,stock:{},turnStock:{},hp:100,maxHp:100,forwardRef:dest.depot,tankers:0};friendly.push(base);}
   base.stock[id]=(base.stock[id]||0)+arrived;base.turnStock[id]??=0;const selected=source.id;initBaseSelect();$('airBattleBase').value=selected;syncBaseAircraft();drawBases();status(`وصلت ${arrived}/${count} مروحيات إلى ${dest.name}؛ جاهزة للطلعات في الجولة القادمة.`);
  }
 }finally{activeMissions=Math.max(0,activeMissions-1);isBusy=activeMissions>0;if(valid())refreshControls();}
}
function tankerRoute(base,target){
 const home=centers[base.y][base.x],goal=centers[target.y][target.x],heading=Math.atan2(goal.y-home.y,goal.x-home.x),ux=Math.cos(heading),uy=Math.sin(heading);
 const own=p=>{const y=Math.round((p.y-104)/156),x=Math.round(p.x/(104*Math.sqrt(3))-.5-(y%2)*.5);return x>=0&&y>=0&&x<MAP_GRID.columns&&y<MAP_GRID.rows&&battle.owners[y*MAP_GRID.columns+x]==='blue';};
 const point=(f,l)=>({x:home.x+ux*f-uy*l,y:home.y+uy*f+ux*l});
 // Follow the contiguous friendly corridor toward the assigned target, not a loop near home.
 let frontier=0;const limit=Math.hypot(goal.x-home.x,goal.y-home.y);
 for(let d=0;d<=limit;d+=25){if(!own(point(d,0)))break;frontier=d;}
 for(let reach=frontier-40;reach>=300;reach-=60)for(const radius of [220,160,110]){
  if(reach<radius*2)continue;
  const route=supportRoute([home,point((reach-radius)*.4,-radius),point(reach-radius,-radius),point(reach,0),point(reach-radius,radius),point((reach-radius)*.4,radius),home]);
  let safe=true;for(let d=0;d<=route.length;d+=4){const p=route.sample(d);if(!own(p)||!own({x:p.x+18,y:p.y})||!own({x:p.x-18,y:p.y})||!own({x:p.x,y:p.y+18})||!own({x:p.x,y:p.y-18})){safe=false;break;}}
  if(safe)return {...route,frontier,escortReach:reach};
 }
 return null;
}
function startTanker(base,target){
 const route=tankerRoute(base,target);if(!route){status('لا توجد مساحة آمنة لمرافقة الوقود والانعطاف باتجاه الهدف؛ اختر مطاراً خلفياً أو ألغِ المرافقة.','warn');return null;}
 base.tankerUsed=(base.tankerTurn===battle.turn?base.tankerUsed||0:0)+1;base.tankerTurn=battle.turn;
 activeMissions++;const missionBattle=battle,cell=180;
 const layer=node('g',{class:'tactical-v3 tanker-support'},groups.effects),icon=makePlane(layer,'bomber','KC46'),flight={id:'tanker-'+(++flightSequence),side:'blue',kind:'bomber',typeId:'standard',status:'flying',cellPixels:cell,engagedDefenses:[]};stageFlightFlight(flight);
 let resolveDone;const done=new Promise(r=>resolveDone=r);let distance=0,last=null,finished=false,tankerBank=0;
 const cleanup=()=>{if(finished)return;finished=true;finishDefenseFlight(flight);layer.remove();missionBattle.inFlightDrones=missionBattle.inFlightDrones.filter(f=>f!==flight);activeMissions=Math.max(0,activeMissions-1);resolveDone();};
 const tick=now=>{try{if(api.battle!==missionBattle||!icon.isConnected){cleanup();return;}if(document.hidden){last=null;requestAnimationFrame(tick);return;}
  const dt=last===null?0:Math.min(.05,(now-last)/1000);last=now;distance=Math.min(route.length,distance+dt*paceAt(distance,route.length,cell,1.28));const pose=route.sample(distance),behind=route.sample(Math.max(0,distance-20)),ahead=route.sample(Math.min(route.length,distance+20));pose.heading=Math.atan2(ahead.y-behind.y,ahead.x-behind.x);const bend=Math.atan2(Math.sin(ahead.heading-behind.heading),Math.cos(ahead.heading-behind.heading));tankerBank+=(Math.max(-.65,Math.min(.65,bend*3))-tankerBank)*Math.min(1,dt*2);
  Object.assign(flight,{x:pose.x,y:pose.y,progress:distance/route.length});icon.setAttribute('transform',`translate(${pose.x} ${pose.y}) rotate(${pose.heading*180/Math.PI+90}) scale(${1+.15*Math.min(1,distance/250,(route.length-distance)/250)})`);const airframe=icon.querySelector('.tac-airframe');if(airframe)airframe.setAttribute('transform',`skewY(${tankerBank*3}) scale(${1-Math.abs(tankerBank)*.18} 1)`);
  if(defenseForFlight(flight,pose)?.hit||flight.status==='intercepted'){impactFX(groups.effects,pose,{kind:'air',size:1.3,label:'اعتراض طائرة الوقود'});cleanup();return;}
  if(distance>=route.length){cleanup();return;}requestAnimationFrame(tick);
 }catch(error){console.error('Tanker support',error);cleanup();}};requestAnimationFrame(tick);
 return{async finish(){await done;}};
}
function installAirSupport(){
 const panel=document.createElement('div');panel.id='airSupportPanel';panel.className='air-support-panel';panel.innerHTML=`<label id="airHeliTaskLabel">أمر المروحية<select id="airHeliTask"><option value="mission">مهمة قتالية / استطلاع</option><option value="relocate">نقل واستقرار في قاعدة جديدة</option></select></label><p id="airSupportFeedback" role="status"></p><label id="airTankerLabel"><input id="airTanker" type="checkbox"> مرافقة طائرة وقود <span id="airTankerInfo"></span></label><div id="airPatrolControls" hidden><b>Viper · استطلاع ومرافقة المسار</b><p id="airPatrolReadout">ارسم حتى ٦ نقاط؛ المروحية تكشف وتشتبك قرب المسار ثم تعود. الحمولة: ٨ موجهة / ١٤ خفيفة / ٦٥٠ طلقة.</p><button id="airPatrolPick">رسم مسار المرافقة</button><button id="airPatrolUndo">تراجع نقطة</button><button id="airPatrolClear">مسح</button><button id="airPatrolRun">تنفيذ المرافقة</button></div><div id="airRelocateControls" hidden><label>نقل المروحيات إلى مطار أو مقر محرر<select id="airRelocateTarget"></select></label><button id="airRelocate">نقل واستقرار</button><small>ضمن مدى المروحية؛ الوصول يستهلك طلعة الجولة. الجاهزية من الجولة التالية.</small></div>`;$('airBattleCommand').append(panel);
 supportPreview=node('g',{'pointer-events':'none',class:'support-route-preview'},svg);
 $('airHeliTask').onchange=()=>{clearSupportPlan();commandMode=false;window.dispatchEvent(new Event('rebel-enter-air-command'));refreshControls();};
 $('airTanker').addEventListener('change',()=>{refreshSupportUI();if(pendingStealthTarget)refreshStealthPlan();});
 $('airPatrolPick').onclick=()=>{if(isBusy||api.groundBusy?.()||battle.phase!=='player')return;window.dispatchEvent(new Event('rebel-enter-air-command'));supportPicking=!supportPicking;commandMode=false;refreshSupportUI();status('اضغط نقاط المسار بالترتيب ثم تنفيذ المرافقة.');};
 $('airPatrolUndo').onclick=()=>{supportPoints.pop();showSupportPlan();};$('airPatrolClear').onclick=clearSupportPlan;$('airPatrolRun').onclick=()=>void runPatrol();$('airRelocate').onclick=()=>void relocateHelicopters();
 svg.addEventListener('click',event=>{if(!supportPicking)return;event.preventDefault();event.stopImmediatePropagation();if(isBusy||battle.phase!=='player')return;const p=selectedCellFromEvent(event);if(!p)return;if(supportPoints.length>=6){status('الحد ٦ نقاط؛ تراجع عن نقطة لتعديل المسار.','warn');return;}if(supportPoints.at(-1)?.x===p.x&&supportPoints.at(-1)?.y===p.y)return;supportPoints.push({x:p.x,y:p.y});showSupportPlan();},true);
 for(const id of ['airBattleBase','airBattleCraft'])$(id).addEventListener('change',()=>{$('airHeliTask').value='mission';clearSupportPlan();window.dispatchEvent(new Event('rebel-enter-air-command'));refreshControls();});
 $('closeAirCommand').addEventListener('click',()=>{supportPicking=false;refreshSupportUI();});
 window.addEventListener('rebel-cancel-air-target',clearSupportPlan);
 $('resetBattle').addEventListener('click',e=>{if(activeMissions){e.preventDefault();e.stopImmediatePropagation();status('انتظر عودة الطلعات قبل إعادة المختبر.','warn');return;}clearSupportPlan();friendly.splice(0,friendly.length,...friendly.filter(b=>!b.forwardRef));for(const b of friendly){b.stock={...b.initialStock};b.tankerUsed=0;b.tankerTurn=-1;}setTimeout(()=>{initBaseSelect();refreshControls();},80);},true);
 refreshSupportUI();
}

function observeAirPosition(side,pose,radius){let best=null,gap=Infinity;for(let y=0;y<centers.length;y++){const row=centers[y];if(!row?.length||Math.abs(row[0].y-pose.y)>220)continue;for(let x=0;x<row.length;x++){const p=row[x],d=Math.hypot(p.x-pose.x,p.y-pose.y);if(d<gap){gap=d;best={x,y};}}}if(best)observeArea(battle,side,best,radius);}
function automaticAirPlan(){refreshControls();return planAirOrder(battle,friendly.filter(base=>!base.disabled&&forwardAvailable(base)).flatMap(base=>Object.entries(MODELS).map(([id,craft])=>({id,craft,base,available:base.turnStock?.[id]??0,ready:airportReady(battle,base,id),weapons:AIR_BATTLE_WEAPONS[id],tanker:(base.tankers??0)>(base.tankerTurn===battle.turn?base.tankerUsed??0:0)}))));}
async function startAutomaticAir(){if(isBusy||activeMissions||api.groundBusy?.()||battle.phase!=='player')return false;for(const base of friendly)queueAircraftRepairs(base);const previousOrder=battle.lastAirOrder,previousPatrol=battle.lastPatrol,plan=automaticAirPlan();if(!plan){battle.airDoctrine??={};battle.airDoctrine.reason='لا هدف موثوق داخل مدى طائرة جاهزة؛ استمر الاستطلاع أو قرّب القاعدة.';return false;}if(battle.airDoctrine?.turn!==battle.turn)battle.airDoctrine={turn:battle.turn,used:[],history:battle.airDoctrine?.history??[]};const state=battle.airDoctrine;state.history.push({turn:battle.turn,craft:plan.id,count:plan.count,weapon:plan.weapon,task:plan.task,x:plan.target.x,y:plan.target.y,reason:plan.reason});state.history=state.history.slice(-24);state.reason=plan.reason;activateAirbase(plan.base);$('airBattleCraft').value=plan.id;syncAirBattleMissionOptions();$('airBattleCount').value=String(plan.count??1);if(plan.weapon)$('airBattleWeapon').value=plan.weapon;$('airTanker').checked=!!plan.escort;$('airHeliTask').value='mission';$('airBattlePattern').value=plan.id==='stealth'?'horizontal':'point';status('الطيران الآلي: '+plan.reason);battle.events.push('قرار الطيران: '+MODELS[plan.id].name+' · '+plan.reason);let launched=false;if(plan.task==='patrol'){supportPoints=[plan.target];await runPatrol();launched=battle.lastPatrol!==previousPatrol&&battle.lastPatrol?.turn===battle.turn;}else{await mission(plan.target);launched=battle.lastAirOrder!==previousOrder&&['completed','intercepted','aborted'].includes(battle.lastAirOrder?.state);}if(launched){state.used.push(plan.reportId+':'+plan.id);return true;}state.reason='لم تُطلق الطلعة: الهدف ربما اختفى أو خرج من المدى؛ لم يُسجل كهدف مستهلك.';return false;}
