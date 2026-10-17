import {policy} from '/rebel-command-policy.js';
import {movementCost,GRID} from '/rebel-terrain.js';
import {isUnitDetected} from '/rebel-artillery-sim.js';
// REBEL_POLITICAL_READY_V27 — campaign-ready strategic layer for the rebel lab.
const sideName = side => side === 'blue' ? 'الدولة' : 'المتمردون';
const dist = (a,b) => {
  const aq=a.x-(a.y-(a.y&1))/2, bq=b.x-(b.y-(b.y&1))/2, dq=aq-bq, dr=a.y-b.y;
  return Math.max(Math.abs(dq),Math.abs(dr),Math.abs(dq+dr));
};

export function initializePoliticalSystems(battle){
  battle.economyBridge ??= {schema:'political-economy-v1',ready:true,currency:'industrial-output',turn:0,assets:{},monthly:{fuel:0,materials:0,industrialCapacity:0},events:[]};
  battle.armistice ??= {active:false,proposals:[],history:[],until:0,violations:0};
  battle.publicReports ??= {policy:{blue:{ownLosses:'public',enemyLosses:'summary',territory:'public',operations:'hidden'},red:{ownLosses:'summary',enemyLosses:'summary',territory:'public',operations:'hidden'}},items:[],lastSnapshot:{blue:(battle.units??[]).filter(u=>u.side==='blue'&&u.role!=='supplyTruck'&&u.strength>0).reduce((n,u)=>n+u.strength,0),red:(battle.units??[]).filter(u=>u.side==='red'&&u.role!=='supplyTruck'&&u.strength>0).reduce((n,u)=>n+u.strength,0)}};
  for(const site of battle.sites??[])site._reportedOwner??=site.owner;
  battle.rebelRecruitment ??= {pool:2,lastTurn:0,turnsSinceRecruit:0,limitPerTruce:2};
  battle.enemyStrategy ??= {mode:'defend',objective:null,lastTurn:0,history:[]};
  syncIndustryLedger(battle);
  return battle;
}

export function syncIndustryLedger(battle){
  initializeLedgerOnly(battle);
  const ledger=battle.economyBridge.assets, active=new Map();
  for(const object of Object.values(battle.mapObjects??{}))if(object.category==='facility'&&['factory','oilRefinery'].includes(object.type)){
    const id=object.id;active.set(id,{id,type:object.type,side:object.side??'red',x:object.x,y:object.y,hp:object.hp??100,status:object.status??'intact',militaryOutput:object.type==='factory'?{materials:8,ammo:12}:{fuel:18,chemicals:5},economicOutput:object.type==='factory'?{industrialCapacity:10,materials:5}:{fuel:22,energy:4},politicalValue:object.type==='factory'?4:6,lastAccountedTurn:battle.turn});
  }
  for(const asset of battle.campaignAssets??[]){const type=/refinery|oil/i.test(`${asset.type??''} ${asset.kind??''} ${asset.name??''}`)?'oilRefinery':/factory|plant/i.test(`${asset.type??''} ${asset.kind??''} ${asset.name??''}`)?'factory':null;if(!type)continue;const id=asset.id??`campaign:${asset.name}:${asset.x},${asset.y}`;active.set(id,{id,type,side:asset.side??'red',x:asset.x,y:asset.y,hp:asset.hp??100,status:asset.disabled?'disabled':'active',militaryOutput:type==='factory'?{materials:6,ammo:10}:{fuel:15,chemicals:4},economicOutput:type==='factory'?{industrialCapacity:8,materials:4}:{fuel:18,energy:3},politicalValue:type==='factory'?4:6,lastAccountedTurn:battle.turn});}
  for(const asset of battle.refineries??[]){const id=asset.id??`refinery:${asset.x},${asset.y}`;active.set(id,{id,type:'oilRefinery',side:asset.side??'red',x:asset.x,y:asset.y,hp:asset.hp??100,status:asset.destroyed?'destroyed':'active',militaryOutput:{fuel:18,chemicals:5},economicOutput:{fuel:22,energy:4},politicalValue:6,lastAccountedTurn:battle.turn});}
  for(const [id,value] of active)ledger[id]={...(ledger[id]??{}),...value};
  for(const [id,value] of Object.entries(ledger))if(!active.has(id)&&value.status!=='destroyed')ledger[id]={...value,status:'inactive'};
  return ledger;
}
function initializeLedgerOnly(battle){battle.economyBridge??={schema:'political-economy-v1',ready:true,currency:'industrial-output',turn:0,assets:{},monthly:{fuel:0,materials:0,industrialCapacity:0},events:[]};battle.economyBridge.assets??={};battle.economyBridge.monthly??={fuel:0,materials:0,industrialCapacity:0};battle.economyBridge.events??=[];}

export function accountIndustry(battle){
  syncIndustryLedger(battle);const monthly={fuel:0,materials:0,industrialCapacity:0};
  for(const asset of Object.values(battle.economyBridge.assets))if(['intact','active','damaged'].includes(asset.status)){const condition=asset.status==='damaged'?Math.max(.25,(asset.hp??60)/(asset.maxHp??100)):1;for(const key of Object.keys(monthly))monthly[key]+=(asset.economicOutput?.[key]??0)*condition;}
  battle.economyBridge.turn=battle.turn;battle.economyBridge.monthly=monthly;
  battle.economyBridge.events.push({turn:battle.turn,kind:'industrial-output',...monthly});battle.economyBridge.events=battle.economyBridge.events.slice(-24);
  return monthly;
}

function depotSecure(battle,depot){
  if(depot.disabled)return false;
  if(!depot.forward)return true;
  const site=battle.sites?.find(s=>s.id===depot.siteId);
  if(!site||site.owner!==depot.side||site.contested)return false;
  return !battle.units.some(u=>u.side!==depot.side&&u.strength>0&&dist(u,site)<=site.radius+2);
}
export function syncForwardSupplyNetwork(battle){
  const depots=battle.logistics?.depots??[];
  for(const d of depots)if(d.forward){const was=d.networkActive!==false;d.networkActive=depotSecure(battle,d);d.disabled=!d.networkActive;
    if(was&&!d.networkActive){d.lostTurn=battle.turn;d.fallbackDepotId=depots.filter(old=>old.side===d.side&&!old.forward&&!old.disabled).sort((a,b)=>dist(a,d)-dist(b,d))[0]?.id??null;for(const c of battle.logistics.convoys??[])if(c.depotId===d.id)c.recalculate=true;
      battle.logistics.queue=(battle.logistics.queue??[]).filter(q=>q.depotId!==d.id);battle.events?.push(`انقطع المركز الأمامي ${d.name??'للإمداد'}؛ أعادت الشبكة توجيه الطلبات إلى ${depots.find(x=>x.id===d.fallbackDepotId)?.name??'المخزن الخلفي العامل'}.`);}
    else if(!was&&d.networkActive){battle.events?.push(`عاد المركز الأمامي ${d.name??'للإمداد'} إلى الشبكة بعد تأمين المدينة.`);}
  }
  for(const c of battle.logistics?.convoys??[])if(!depots.some(d=>d.id===c.depotId&&!d.disabled)){c.recalculate=true;c.depotId=null;}
  return depots.filter(d=>d.side==='blue'&&!d.disabled);
}
export function buildForwardSupplyCenter(battle,siteId,side='blue'){
  const site=battle.sites?.find(s=>s.id===siteId);
  if(!site||site.owner!==side||site.contested)return{ok:false,reason:'يجب تحرير المدينة وحسم السيطرة عليها أولاً.'};
  if(battle.units.some(u=>u.side!==side&&u.strength>0&&dist(u,site)<=site.radius+2))return{ok:false,reason:'لا يمكن إنشاء مركز قبل تأمين محيط المدينة.'};
  const existing=(battle.logistics?.depots??[]).find(d=>d.side===side&&dist(d,site)<=3&&depotSecure(battle,d));
  if(existing)return{ok:false,reason:`المدينة مخدومة بالفعل من ${existing.name??'مركز قريب'}؛ تجنباً للتكرار لم يُنشأ مركز آخر.`};
  const source=(battle.logistics?.depots??[]).filter(d=>d.side===side&&!d.disabled).sort((a,b)=>dist(a,site)-dist(b,site))[0];
  if(!source||source.ammo<35||source.fuel<20||(source.rations??0)<30)return{ok:false,reason:'المخزن الحالي لا يملك مواد كافية لإنشاء المركز (35 ذخيرة، 20 وقود، 30 إعاشة).'};
  source.ammo-=35;source.fuel-=20;source.rations-=30;
  const id=`${side}-forward-${site.id}`;
  const depot={id,side,x:site.x,y:site.y,siteId:site.id,name:`مركز ${site.name}`,forward:true,networkActive:true,disabled:false,linkedTo:source.id,ammo:24,fuel:18,rations:24,maxAmmo:90,maxFuel:70,maxRations:90,engineeringStores:2,maxEngineeringStores:8,auto:true,builtTurn:battle.turn,constructionTurns:0};
  battle.logistics.depots.push(depot);battle.events?.push(`اكتمل مركز الإمداد الأمامي في ${site.name}؛ رُبط بـ${source.name??'المخزن الخلفي'} وتقصّر مسار القوافل.`);
  return{ok:true,depot,source};
}

export function getArmisticeState(battle){
 const state=battle.armistice??(battle.armistice={active:false,proposals:[],history:[],until:0,violations:0});
 state.proposals??=[];state.history??=[];state.cooldownUntil??=0;state.offerTurnsBySide??={};state.extensionCount??=0;
 return state;
}
const MAX_ARMISTICE_ROUNDS=8;
const clampRounds=value=>Math.max(1,Math.min(MAX_ARMISTICE_ROUNDS,Math.round(Number(value)||1)));
function armisticeMetrics(battle,side){
 const enemy=side==='blue'?'red':'blue';
 const own=battle.units.filter(u=>u.side===side&&u.strength>0&&u.role!=='supplyTruck');
 const hostile=battle.units.filter(u=>u.side===enemy&&u.strength>0&&u.role!=='supplyTruck'&&isUnitDetected(battle,u,side));
 const strength=units=>units.reduce((n,u)=>n+(u.strength??0),0);
 const ownStrength=strength(own),enemyStrength=strength(hostile),ratio=ownStrength/Math.max(1,enemyStrength);
 const ownSites=(battle.sites??[]).filter(site=>site.radius>=2&&site.owner===side&&!site.contested);
 const enemySites=(battle.sites??[]).filter(site=>site.radius>=2&&site.owner===enemy&&!site.contested);
 const threatened=ownSites.some(site=>{
  const attackers=hostile.filter(u=>dist(u,site)<=site.radius+3).reduce((n,u)=>n+(u.strength??0),0);
  const defenders=own.filter(u=>dist(u,site)<=site.radius+2).reduce((n,u)=>n+(u.strength??0),0);
  return attackers>=4&&attackers>defenders*1.15;
 });
 const stressed=own.filter(u=>u.morale<40||(u.fatigue??0)>=60||(u.maxAmmo>0&&u.ammo/u.maxAmmo<.22)||(u.maxFuel>0&&u.fuel/u.maxFuel<.18)||(u.maxRations>0&&(u.rations??0)/u.maxRations<.2)).length/Math.max(1,own.length);
 return{ownStrength,enemyStrength,ratio,ownSites:ownSites.length,enemySites:enemySites.length,threatened,stressed,ownCount:own.length,enemyCount:hostile.length};
}
export function assessArmisticeDecision(battle,side,proposal){
 const m=armisticeMetrics(battle,side),duration=clampRounds(proposal?.rounds),canCounter=(proposal?.counterDepth??0)<2;
 const desperate=(m.enemyCount>0&&m.ratio<.65)||(m.threatened&&m.ownSites<=1),strained=m.stressed>=.3||m.threatened||(m.enemyCount>0&&m.ratio<.9),leading=m.enemyCount>0&&m.ratio>1.25&&!m.threatened;
 const need=desperate||m.stressed>=.65?6:m.stressed>=.4?4:strained?2:1;
 const reason=desperate?'حماية الجبهة المهددة وإعادة بناء الاحتياط':m.stressed>=.3?'إراحة التشكيلات المرهقة وتعويض العتاد':m.threatened?'تأمين المدن المهددة وإعادة الانتشار':leading?'الحفاظ على زخم التقدم مع جاهزية القوات':'توازن الجبهة؛ توقف محدود لإعادة التنظيم';
 const preference=policy(battle,side).truce;let action='accept',rounds=duration;if(preference==='firm'&&!desperate&&m.stressed<.4||leading&&!strained&&preference!=='open'){action='reject';rounds=null;}else if(duration>need+1||duration<Math.ceil(need/2)){action=canCounter?'counter':'reject';rounds=action==='counter'?need:null;}
 const result={action,rounds,reason},state=getArmisticeState(battle);state.lastDecision={...result,side,turn:battle.turn};state.history.push({event:'assessment',...state.lastDecision});state.history=state.history.slice(-100);return result;
}
export function proposeArmistice(battle,from='blue',rounds=2){
 const state=getArmisticeState(battle);
 if(state.active)return{ok:false,reason:'الهدنة قائمة بالفعل.'};
 if(state.proposals.some(p=>p.status==='pending'))return{ok:false,reason:'هناك عرض هدنة قيد التفاوض.'};
 if(battle.turn<(state.cooldownUntil??0))return{ok:false,reason:`لا يمكن تقديم عرض آخر قبل الجولة ${state.cooldownUntil}.`};
 const duration=clampRounds(rounds),proposal={id:`truce-${battle.turn}-${state.proposals.length+1}`,from,to:from==='blue'?'red':'blue',rounds:duration,turn:battle.turn,status:'pending',counterDepth:0};
 state.proposals.push(proposal);state.pending=proposal.id;state.lastProposalTurn=battle.turn;state.cooldownUntil=battle.turn+4;
 state.history.push({turn:battle.turn,event:'proposed',from,rounds:duration});return{ok:true,proposal};
}
export function answerArmistice(battle,decision,rounds=null,from='blue'){
 const state=getArmisticeState(battle),proposal=state.proposals.find(p=>p.id===state.pending&&p.status==='pending');
 if(!proposal)return{ok:false,reason:'لا يوجد مقترح هدنة قيد التفاوض.'};
 if(proposal.to!==from)return{ok:false,reason:'هذا العرض موجّه للطرف الآخر.'};
 if(decision==='reject'){
  proposal.status='rejected';state.pending=null;state.cooldownUntil=Math.max(state.cooldownUntil??0,battle.turn+4);state.history.push({turn:battle.turn,event:'rejected',by:from});
  if(proposal.from==='red')state.redRejectedUntil=battle.turn+8;
  return{ok:true};
 }
 if(decision==='counter'){
  if((proposal.counterDepth??0)>=2)return{ok:false,reason:'وصل التفاوض إلى عرضين مقابلين؛ اختر القبول أو الرفض.'};
  const counterRounds=clampRounds(rounds||proposal.rounds);if(counterRounds===clampRounds(proposal.counterRounds??proposal.rounds))return{ok:false,reason:'مدة العرض المقابل يجب أن تختلف عن العرض الحالي.'};if(proposal.extension&&state.until-(state.started??battle.turn)+counterRounds>12)return{ok:false,reason:'التمديد يتجاوز سقف الاتفاق الحالي: ١٢ جولة.'};proposal.status='countered';proposal.counterRounds=counterRounds;proposal.counterBy=from;
  const counter={id:`counter-${battle.turn}-${state.proposals.length+1}`,from,to:from==='blue'?'red':'blue',rounds:proposal.counterRounds,turn:battle.turn,status:'pending',extension:!!proposal.extension,counterDepth:(proposal.counterDepth??0)+1};
  state.proposals.push(counter);state.pending=counter.id;state.history.push({turn:battle.turn,event:'countered',by:from,rounds:counter.rounds});return{ok:true,proposal:counter};
 }
 if(decision!=='accept')return{ok:false,reason:'قرار غير معروف.'};
 const duration=clampRounds(proposal.counterRounds||proposal.rounds);
 state.active=true;state.until=proposal.extension?Math.max(state.until,battle.turn)+duration:battle.turn+duration;state.remaining=Math.max(0,state.until-battle.turn);
 if(!proposal.extension)state.started=battle.turn;state.terms={groundCombat:false,regrouping:true,espionageAllowed:true,reconAllowed:true,armedDroneAllowed:true,discoveryCanCollapse:true};state.pending=null;proposal.status='accepted';proposal.agreedRounds=duration;
 if(proposal.extension)state.extensionCount=(state.extensionCount??0)+1;else state.extensionCount=0;
 state.history.push({turn:battle.turn,event:'accepted',by:from,rounds:duration});battle.events?.push(`دخل الطرفان هدنة لمدة ${duration} جولة؛ الهجمات البرية متوقفة ويمكن للقوات إعادة التنظيم.`);return{ok:true,rounds:duration};
}
export function extendArmistice(battle,rounds=1,from='blue'){
 const state=getArmisticeState(battle);if(!state.active)return{ok:false,reason:'لا توجد هدنة لتمديدها.'};
 if((state.extensionCount??0)>=2||state.until-(state.started??battle.turn)>=12)return{ok:false,reason:'بلغ الاتفاق حد التمديد؛ لا يمكن تمديده بلا نهاية.'};
 if(state.proposals.some(p=>p.status==='pending'))return{ok:false,reason:'يوجد طلب قيد التفاوض.'};
 const duration=Math.min(clampRounds(rounds),Math.max(0,12-(state.until-(state.started??battle.turn)))),proposal={id:`extend-${battle.turn}-${state.history.length}`,from,to:from==='blue'?'red':'blue',rounds:duration,turn:battle.turn,status:'pending',extension:true,counterDepth:0};
 state.proposals.push(proposal);state.pending=proposal.id;state.history.push({turn:battle.turn,event:'extension-proposed',from,rounds:duration});return{ok:true,proposal};
}
export function breakArmistice(battle,reason,side='red'){
 const state=getArmisticeState(battle);if(!state.active)return false;state.active=false;state.remaining=0;state.brokenTurn=battle.turn;state.breakReason=reason;state.violations++;state.history.push({turn:battle.turn,event:'broken',side,reason});battle.events?.push(`انهارت الهدنة بعد رصد ${sideName(side)} ${reason}؛ عادت العمليات القتالية.`);return true;
}
export function advanceArmistice(battle){
 const s=getArmisticeState(battle);if(!s.active)return;
 if(battle.turn+1>=s.until){s.active=false;s.remaining=0;s.extensionCount=0;s.history.push({turn:battle.turn,event:'expired'});battle.events?.push('انتهت الهدنة وعادت قواعد القتال المعتادة.');}
 else s.remaining=Math.max(0,s.until-battle.turn-1);
}
export function maybeArmisticeIncident(battle,side,kind,observed=false){
 const s=getArmisticeState(battle);if(!s.active)return false;
 const chance=observed?.8:kind==='recon'?0.12:kind==='drone'?0.2:0.08;
 const roll=(((battle.seed=(battle.seed*1664525+1013904223)>>>0)>>>8)%1000)/1000;
 if(roll<chance){breakArmistice(battle,kind==='recon'?'طلعة استطلاع غير مصرّح بها':kind==='drone'?'إطلاق مسيرة هجومية':'نشاطاً استخباراتياً مكشوفاً',side);return true;}return false;
}
export function maybeOfferArmisticeForAI(battle,side='red'){
 const s=getArmisticeState(battle);if(s.active||s.proposals.some(p=>p.status==='pending')||battle.turn<4||battle.turn<(s.cooldownUntil??0))return null;
 const turns=s.offerTurnsBySide[side]??[];s.offerTurnsBySide[side]=turns.filter(turn=>battle.turn-turn<20);
 if(battle.turn-(turns.at(-1)??-99)<8||s.offerTurnsBySide[side].length>=3)return null;
 if(side==='red'&&battle.turn<(s.redRejectedUntil??0))return null;
 const m=armisticeMetrics(battle,side),desperate=(m.enemyCount>0&&m.ratio<.65)||(m.ownSites===1&&m.threatened)||m.stressed>.4;
 if(!desperate)return null;
 const result=proposeArmistice(battle,side,m.stressed>.65?6:m.stressed>.4?4:2);if(!result.ok)return null;
 s.offerTurnsBySide[side].push(battle.turn);if(side==='red')s.lastEnemyOfferTurn=battle.turn;
 battle.events?.push(`تقدير قيادة ${sideName(side)}: طلب هدنة لتأمين الجبهة وإراحة القوات؛ مدة العرض ${result.proposal.rounds} جولة.`);
 return result.proposal;
}
export function maybeOfferEnemyArmistice(battle){return maybeOfferArmisticeForAI(battle,'red');}

export function recordPublicReport(battle,event){
  const reports=battle.publicReports??(battle.publicReports={policy:{blue:{ownLosses:'public',enemyLosses:'summary',territory:'public',operations:'hidden'},red:{ownLosses:'summary',enemyLosses:'summary',territory:'public',operations:'hidden'}},items:[],lastSnapshot:{blue:0,red:0}});
  const item={id:`report-${battle.turn}-${reports.items.length+1}`,turn:battle.turn,time:new Date().toISOString(),...event};reports.items.push(item);reports.items=reports.items.slice(-60);return item;
}
export function recordOperationPlan(battle,side='blue',target={}){
  const label=target.name??target.asset?.name??target.label??`القطاع ${Number(target.x??0)+1}/${Number(target.y??0)+1}`;
  const text=`خطة مسجلة للتقدم باتجاه ${label}؛ التنفيذ الميداني لم يُؤكد بعد.`;
  battle.commandBriefings??={blue:[],red:[]};battle.commandBriefings[side]??=[];
  const briefing={turn:battle.turn,side,targetId:target.id??target.asset?.id??null,label,text};
  battle.commandBriefings[side].push(briefing);battle.commandBriefings[side]=battle.commandBriefings[side].slice(-24);
  const visibility=battle.publicReports?.policy?.[side]?.operations??'hidden';
  if(visibility!=='hidden')recordPublicReport(battle,{kind:'operation',side,label:`خطة تقدم القوات باتجاه ${label}`,visibility});
  battle.events?.push(`إحاطة القيادة: ${text}`);return briefing;
}
export function updatePublicBattleReports(battle){
  const p=battle.publicReports??(battle.publicReports={policy:{blue:{ownLosses:'public',enemyLosses:'summary',territory:'public',operations:'hidden'},red:{ownLosses:'summary',enemyLosses:'summary',territory:'public',operations:'hidden'}},items:[],lastSnapshot:{blue:0,red:0}});
  for(const side of ['blue','red']){const now=battle.units.filter(u=>u.side===side&&u.role!=='supplyTruck'&&u.strength>0).reduce((n,u)=>n+u.strength,0),before=p.lastSnapshot[side]??now,loss=Math.max(0,before-now);if(loss)recordPublicReport(battle,{kind:'casualties',side,amount:loss,label:`خسائر ${sideName(side)}`});p.lastSnapshot[side]=now;}
  for(const site of battle.sites??[]){const last=site._reportedOwner;if(last&&last!==site.owner)recordPublicReport(battle,{kind:'territory',side:site.owner,siteId:site.id,amount:1,label:`${site.owner==='blue'?'تحرير':'خسارة'} ${site.name}`});site._reportedOwner=site.owner;}
}
export function publicReportText(battle,item,viewer='blue'){
  const policy=battle.publicReports?.policy?.[viewer]??{},visibility=item.visibility??(item.kind==='casualties'?(item.side===viewer?policy.ownLosses:policy.enemyLosses):item.kind==='operation'?policy.operations:policy.territory);
  if(visibility==='hidden')return `الجولة ${item.turn}: تقرير ميداني غير معلن.`;
  if(visibility==='summary'&&item.kind==='casualties')return `الجولة ${item.turn}: اشتباكات وخسائر مؤكدة، العدد غير معلن.`;
  if(item.kind==='operation'&&visibility==='summary')return `الجولة ${item.turn}: تحرك ميداني ضمن خطة تقدم؛ الوجهة غير معلنة.`;
  return `الجولة ${item.turn}: ${item.label}${item.amount&&item.kind==='casualties'?` · ${item.amount} أفراد`:''}.`;
}
export function setDisclosurePolicy(battle,key,value,side='blue'){
  const p=battle.publicReports.policy[side]??(battle.publicReports.policy[side]={});if(!['public','summary','hidden'].includes(value))return false;p[key]=value;return true;
}

export function assessRebelStrategy(battle){
  const rebels=battle.units.filter(u=>u.side==='red'&&u.strength>0&&u.role!=='supplyTruck'),cities=battle.sites.filter(s=>s.radius>=2&&s.owner==='red'),blue=battle.units.filter(u=>u.side==='blue'&&u.strength>0&&u.role!=='supplyTruck'&&isKnown(battle,u,'red'));
  const lastCity=cities.length===1?cities[0]:null, encircled=lastCity&&blue.filter(u=>dist(u,lastCity)<=lastCity.radius+2).length>=4;
  let mode='counterattack',objective=null;
  if(lastCity&&encircled){const nearbyRed=rebels.filter(u=>dist(u,lastCity)<=lastCity.radius+4).reduce((n,u)=>n+u.strength,0),nearbyBlue=blue.filter(u=>dist(u,lastCity)<=lastCity.radius+4).reduce((n,u)=>n+u.strength,0);mode=nearbyBlue>nearbyRed*1.25?'break-siege':'hold-last-city';objective=lastCity.id;}
  else if(cities.length===0)mode='mobile-resistance';
  else {const threatened=cities.map(site=>({site,threat:blue.filter(u=>dist(u,site)<=site.radius+4).length})).sort((a,b)=>b.threat-a.threat)[0];if(threatened?.threat){mode='reinforce-city';objective=threatened.site.id;}}
  const s=battle.enemyStrategy??(battle.enemyStrategy={history:[]});if(s.mode!==mode||s.objective!==objective){s.history??=[];s.history.push({turn:battle.turn,mode,objective});s.history=s.history.slice(-12);s.mode=mode;s.objective=objective;battle.events?.push(mode==='break-siege'?'تقدير قيادة المتمردين: محاولة فتح ثغرة في الطوق قبل خسارة آخر مدينة.':mode==='hold-last-city'?'تقدير قيادة المتمردين: تثبيت الدفاع حول آخر مدينة وعدم الاندفاع إلى هجوم مكشوف.':mode==='reinforce-city'?'تقدير قيادة المتمردين: سحب احتياطيات لتعزيز مدينة مهددة.':'تقدير قيادة المتمردين: إعادة تنظيم المقاومة وفق ميزان الجبهة.');}
  s.lastTurn=battle.turn;return s;
}
function isKnown(battle,unit,side){return isUnitDetected(battle,unit,side);}

export function processRecruitment(battle){
 const r=battle.rebelRecruitment??={pool:2,lastTurn:0,turnsSinceRecruit:0};if(r.processedTurn===battle.turn)return null;r.processedTurn=battle.turn;r.history??=[];r.total??=0;r.turnsSinceRecruit++;
 const contacts=battle.units.filter(u=>u.side==='blue'&&u.strength>0&&isKnown(battle,u,'red'));
 const safe=s=>s&&s.owner==='red'&&!s.contested&&(s.support??s.loyalty??60)>=55&&!contacts.some(u=>dist(u,s)<s.radius+4);
 const supportive=(battle.sites??[]).filter(safe).sort((a,b)=>Math.min(30,...contacts.map(u=>dist(u,b)))-Math.min(30,...contacts.map(u=>dist(u,a))));
 if(battle.turn%4===0&&supportive.length)r.pool=Math.min(6,r.pool+1);let spawned=null;
 if(r.training&&r.training.readyTurn<=battle.turn){const job=r.training,site=battle.sites.find(s=>s.id===job.siteId),slot=safe(site)&&site.tiles.find(p=>p.x>=0&&p.y>=0&&p.x<GRID.columns&&p.y<GRID.rows&&Number.isFinite(movementCost({kind:job.kind},p.x,p.y))&&!battle.units.some(u=>u.strength>0&&u.x===p.x&&u.y===p.y));
  if(slot){const sniper=job.kind==='sniper',strength=sniper?3:4,hp=strength*22;spawned={id:`red-recruit-${battle.turn}-${++r.total}`,side:'red',kind:job.kind,role:'reserve',...slot,strength,maxStrength:strength,hpPerStrength:22,maxHp:hp,hp,morale:65,fatigue:0,movement:sniper?3:4,moved:true,attacked:true,hidden:true,ambushReady:true,order:null,siteId:site.id,kills:0,pinned:false,ammo:8,maxAmmo:sniper?10:14,fuel:0,maxFuel:0,rations:4,maxRations:6};battle.units.push(spawned);r.lastTurn=battle.turn;r.history.push({turn:battle.turn,event:'trained',siteId:site.id,kind:job.kind});r.training=null;}
  else if(!safe(site)||battle.turn>job.readyTurn+2){r.history.push({turn:battle.turn,event:'training-cancelled',siteId:job.siteId});r.training=null;}
 }
 const interval=getArmisticeState(battle).active?2:4,existing=battle.units.filter(u=>u.side==='red'&&u.strength>0&&u.role!=='supplyTruck');r.forceCeiling??=Math.min(64,Math.max(32,existing.length+8));if(r.training||!supportive.length||r.pool<=0||r.turnsSinceRecruit<interval||existing.length>=r.forceCeiling)return spawned;
 for(const site of supportive){if(existing.filter(u=>dist(u,site)<=site.radius+1).length>=6)continue;
 const depot=(battle.logistics?.depots??[]).filter(d=>d.side==='red'&&!d.disabled&&(d.structureHp??1)>0&&dist(d,site)<=8&&d.ammo>=8&&(d.spares??0)>=2&&(d.rations??0)>=4).sort((a,b)=>dist(a,site)-dist(b,site))[0];if(!depot)continue;
 depot.ammo-=8;depot.spares-=2;depot.rations-=4;r.pool--;r.turnsSinceRecruit=0;r.training={siteId:site.id,readyTurn:battle.turn+1,kind:r.total%3===2?'sniper':'infantry'};r.history.push({turn:battle.turn,event:'training',...r.training});r.history=r.history.slice(-30);break;
 }return spawned;
}
