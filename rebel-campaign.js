import {staffEffect,staffReview,assignedStaff} from './rebel-staff-command.js';
import {OFFICERS,initIntelligence,syncPeople,officerAvailable} from './rebel-intelligence.js';
// REBEL-CAMPAIGN-13. Pure campaign state; no timers or rendering side effects.
import {GRID,distance,terrainAt,movementCost,center,RIVER_POINTS,ROAD_LINES} from './rebel-terrain.js';
export const SELECTABLE_LEADERS=['steadfast','quartermaster','support','medic','armor','artillery','aviation','intelligence'];
export const LEADERS=Object.freeze({
 ...OFFICERS,
 organizer:{name:'العميد سامر',trait:'تنظيم وإمداد',text:'تعافي المعنويات +4؛ استهلاك الإعاشة الدوري أقل 15% ضمن القيادة.',recovery:4,supply:.85,shock:.9},
 steadfast:{name:'العقيد مريم',trait:'قائد القتال',text:'تعافي المعنويات +3؛ خسارة المعنويات تحت الرمي أقل 25%.',recovery:3,supply:1,shock:.75},
 support:{name:'العميد رائد',trait:'قائد الصيانة',text:'تعافي المعنويات +2؛ إصلاح المعدات القريبة أسرع 25% مع دفع الموارد.',recovery:2,supply:1,shock:.9,repair:1.25},
 quartermaster:{name:'العقيد ياسر',trait:'قائد الإمداد',text:'تعافي المعنويات +1؛ استهلاك الإعاشة الدوري أقل 25%.',recovery:1,supply:.75,shock:1},
 medic:{name:'العقيد سلمى',trait:'استعادة التماسك',text:'تعافي المعنويات +6؛ لا يعيد الأفراد أو الآليات المفقودة.',recovery:6,supply:1,shock:1},
 rebel:{name:'قائد الميدان نادر',trait:'تماسك المجموعات',text:'تعافي المعنويات +3؛ خسارة المعنويات تحت الرمي أقل 15%.',recovery:3,supply:1,shock:.85}
});
export const neighbors=p=>(p.y%2?[[1,0],[-1,0],[0,-1],[1,-1],[0,1],[1,1]]:[[1,0],[-1,0],[-1,-1],[0,-1],[-1,1],[0,1]]).map(([x,y])=>({x:p.x+x,y:p.y+y})).filter(p=>p.x>=0&&p.x<GRID.columns&&p.y>=0&&p.y<GRID.rows);
const key=p=>p.x+','+p.y;
const nearLine=(p,line,r)=>line.slice(1).some((z,i)=>{const a=line[i],dx=z[0]-a[0],dy=z[1]-a[1],t=Math.max(0,Math.min(1,((p.x-a[0])*dx+(p.y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a[0]-t*dx,p.y-a[1]-t*dy)<r;});
const blockedRiver=new Set();for(let y=0;y<GRID.rows;y++)for(let x=0;x<GRID.columns;x++){const p=center(x,y);if(nearLine(p,RIVER_POINTS,72)&&!ROAD_LINES.some(l=>nearLine(p,l,108)))blockedRiver.add(x+','+y);}

const note=(b,s)=>{b.events.push(s);b.events=b.events.slice(-10);};
const alive=u=>u.strength>0&&u.hp>0;
export function allStructures(b){return [...(b.logistics?.depots??[]),...(b.droneBases??[]),...(b.airDefenses??[]),...(b.campaignAssets??[]),...(b.refineries??[])];}
export function initCampaign(b){
 if(b.campaign)return;
 b.campaign={version:13,contacts:{blue:{},red:{}},repairs:[],disrupted:{blue:0,red:0},lastTick:0,losses:[],revision:0};b.campaignAssets=[];
 for(const d of b.logistics.depots){d.spares=100;d.maxSpares=180;}
 const used=new Set([...b.units,...allStructures(b)].map(key));
 const free=(side,desired)=>{let candidates=[];for(let y=1;y<GRID.rows-1;y++)for(let x=1;x<GRID.columns-1;x++){const p={x,y};if(used.has(key(p))||b.owners[y*GRID.columns+x]!==side||terrainAt(x,y).elevation>=.3||b.mapCells?.[key(p)]?.landUse==='urban'||b.sites.some(s=>s.tiles?.some(t=>t.x===x&&t.y===y)))continue;candidates.push(p);}const p=candidates.sort((a,c)=>distance(a,desired)-distance(c,desired))[0];if(p)used.add(key(p));return p;};
 for(const side of ['blue','red']){
  const p=free(side,side==='blue'?{x:13,y:10}:{x:35,y:20});if(!p)continue;
  const common={side,...p,strength:1,maxStrength:1,hp:180,maxHp:180,hpPerStrength:180,morale:100,movement:3,moved:false,attacked:false,hidden:false,ammo:0,maxAmmo:0,fuel:0,maxFuel:0,kills:0,order:null,pinned:false};
  b.units.push({...common,id:side+'-commander-1',role:'commander',kind:'commander',leader:side==='blue'?'steadfast':'rebel',readyTurn:1});
  const j=free(side,side==='blue'?{x:14,y:16}:{x:34,y:22});if(j)b.units.push({...common,...j,id:side+'-jammer-1',role:'jammer',kind:'jammer',hp:110,maxHp:110,hpPerStrength:110,jammerOn:true});
  const post=free(side,side==='blue'?{x:11,y:11}:{x:37,y:20});if(post)b.campaignAssets.push({id:side+'-command-post',side,...post,type:'commandPost',name:'مقر القيادة '+(side==='blue'?'الميداني':'للمتمردين'),structureHp:320,structureMaxHp:320,originalSide:side});
 }
 for(const s of b.sites){const population=s.radius>=3?18000:s.radius===2?9000:2200;s.civilians={initial:population,present:population,killed:0,displaced:0,anger:{blue:0,red:0},casualties:{blue:0,red:0},lastHit:-99,lastResistance:{},aidTurn:0};}
 upgradeStructures(b);
}
export function upgradeStructures(b){
 for(const a of allStructures(b)){
  if(a.campaignDurability)continue;a.campaignDurability=true;
  if(b.refineries?.includes(a)){const ratio=a.hp/a.maxHp;a.maxHp=480;a.hp=Math.round(ratio*a.maxHp);a.originalSide??=a.side;Object.defineProperty(a,'structureHp',{get(){return this.hp;},set(v){this.hp=v;},configurable:true});Object.defineProperty(a,'structureMaxHp',{get(){return this.maxHp;},set(v){this.maxHp=v;},configurable:true});continue;}
  const old=a.structureMaxHp??(b.airDefenses?.includes(a)?60:b.droneBases?.includes(a)?90:100),ratio=(a.structureHp??old)/old;
  a.structureMaxHp=a.type==='airportPart'?a.structureMaxHp:a.type==='commandPost'?320:a.industryRole==='factory'?360:b.airDefenses?.includes(a)?180:b.logistics.depots.includes(a)?300:240;
  a.structureHp=Math.round(a.structureMaxHp*ratio);a.savedRange=a.range;a.originalSide??=a.side;
 }
}
// One cached, bounded flood per side. Borders do not block supply; hostile presence does.
export function supplyNetwork(b,side){
 const signature=b.turn+'|'+b.units.filter(alive).map(u=>u.id+':'+u.x+','+u.y).join(';')+'|'+b.logistics.depots.map(d=>d.side+':'+d.disabled).join(';');
 b._campaignNetwork??={};if(b._campaignNetwork[side]?.signature===signature)return b._campaignNetwork[side].map;
 const blocked=new Set();for(const u of b.units.filter(u=>u.side!==side&&alive(u))){blocked.add(key(u));for(const p of neighbors(u))blocked.add(key(p));}
 const map=new Map(),queue=[];for(const d of b.logistics.depots.filter(d=>d.side===side&&!d.disabled)){map.set(key(d),d);queue.push(d);}
 for(let i=0;i<queue.length;i++){const p=queue[i],depot=map.get(key(p));for(const n of neighbors(p)){const k=key(n);if(map.has(k)||blocked.has(k)||blockedRiver.has(k)||!Number.isFinite(movementCost({role:'supplyTruck'},n.x,n.y)))continue;map.set(k,depot);queue.push(n);}}
 b._campaignNetwork[side]={signature,map};return map;
}
export function supplyDepot(b,a){const map=supplyNetwork(b,a.side);return map.get(key(a))??neighbors(a).map(n=>map.get(key(n))).find(Boolean)??null;}
export function leadership(b,u){
 if(!b.campaign||b.campaign.disrupted[u.side]>b.turn)return null;
 const leader=[...b.campaignAssets.filter(a=>a.type==='commandPost'&&a.leader&&a.structureHp>0&&!a.construction).map(a=>({...a,hp:a.structureHp,strength:1})),...b.logistics.depots.filter(c=>c.leader&&!c.disabled).map(a=>({...a,hp:a.structureHp,strength:1})),...b.units.filter(c=>c.role==='commander')].find(c=>c.side===u.side&&alive(c)&&(!b.intelligence||officerAvailable(b,u.side,c.leader))&&c.readyTurn<=b.turn&&distance(c,u)<=5&&supplyDepot(b,c));

 const staff=staffEffect(b,'logistics',u.side);if(!leader&&!staff)return null;return {unit:leader,name:'هيئة الإمداد',...(leader?LEADERS[leader.leader]:{}),supply:(leader?LEADERS[leader.leader]?.supply??1:1)*(1-staff),repair:(leader?LEADERS[leader.leader]?.repair??1:1)*(1+staff)};
}
export function moveCampaignUnit(b,u){if(!b.campaign)return;delete b._campaignNetwork;if(u.role==='commander')u.readyTurn=b.turn+1;
 const site=b.sites.find(s=>s.tiles?.some(t=>t.x===u.x&&t.y===u.y)),c=site?.civilians;
 if(c&&c.present>0&&(c.casualties?.[u.side]??0)>0&&c.anger[u.side]>=65&&c.lastResistance[u.side]!==b.turn&&u.role!=='supplyTruck'){
 c.lastResistance[u.side]=b.turn;const roll=(((b.seed=(b.seed*1664525+1013904223)>>>0)>>>8)%1000)/1000;
 if(roll<Math.min(.65,.2+(c.anger[u.side]-65)/70)){const damage=Math.min(u.hp,u.modelId?8:5);u.hp=Math.max(0,u.hp-damage);u.strength=Math.max(0,Math.min(u.maxStrength,Math.ceil(u.hp/u.hpPerStrength)));u.morale=Math.max(0,u.morale-5);u.moved=true;u.pinned=true;u.streetBlockedTurn=b.turn;note(b,'اضطرابات في '+site.name+': مولوتوف أوقف تقدم القوة المسؤولة عن خسائر مدنية؛ '+damage+' ضرر.');b.campaign.lastStreet={x:u.x,y:u.y,turn:b.turn,side:u.side,damage};}
 }

}
export function updateMemory(b,visible){if(!b.campaign)return;for(const side of ['blue','red']){const contacts=b.campaign.contacts[side];for(const u of b.units){if(u.side===side)continue;if(alive(u)&&visible(b,u,side))contacts[u.id]={id:u.id,x:u.x,y:u.y,turn:b.turn,role:u.role,kind:u.kind};}
 for(const[id,c]of Object.entries(contacts)){const observed=b.units.some(u=>u.side===side&&alive(u)&&distance(u,c)<=2);if(observed&&!b.units.some(u=>u.id===id&&alive(u)&&u.x===c.x&&u.y===c.y)||b.turn-c.turn>4)delete contacts[id];}}
}
export function civilianImpact(b,x,y,power,side){
 if(!b.campaign||power<=0)return;side=side==='red'?'red':'blue';
 const site=b.sites.find(s=>s.structureTiles?.some(t=>t.x===x&&t.y===y));if(!site?.civilians)return;const c=site.civilians;if(!c.present)return;
 const exposure=c.present/c.initial,loss=Math.min(c.present,Math.max(1,Math.round(power*.09*exposure))),flee=Math.min(c.present-loss,loss*7);
 c.killed+=loss;c.casualties[side]+=loss;c.displaced+=flee;c.present-=loss+flee;c.anger[side]=Math.min(100,c.anger[side]+loss*.8+3);c.lastHit=b.turn;
 note(b,site.name+': '+loss+' ضحايا مدنيين و'+flee+' نازحين؛ المسؤول '+(side==='blue'?'قوات الدولة':'قوات التمرد')+'.');
}
export function assetDamaged(b,a,amount){if(!amount)return;if(b.refineries?.includes(a)){a.ignited=true;a.destroyed=a.hp<=0;}a.lastDamageAt=Date.now();a.lastDamageTurn=b.turn;
 if(a.type==='airportPart'){
  const base=b.campaignAirbases?.find(q=>q.id===a.airbaseId);if(base){
   if(a.part==='hangar'&&a.structureHp<=0&&!a.stockLost){a.stockLost=true;for(const id of a.aircraftIds){const inAir=base.campaignAirborne?.[id]??0,lost=Math.max(0,(base.stock[id]??0)-inAir);base.stock[id]=inAir;base.turnStock[id]=0;note(b,'تدمير '+a.name+': فُقدت '+lost+' طائرات '+id+' كانت في الحظيرة.');}}
   syncAirport(b,base);
  }
 }
 if(a.type==='commandPost'&&a.structureHp<=0&&!a.commandLoss){a.commandLoss=true;b.campaign.disrupted[a.side]=Math.max(b.campaign.disrupted[a.side],b.turn+2);note(b,'تعطل مقر القيادة: اضطراب التنسيق لجولتين.');}
}
export function syncAirport(b,base){const parts=b.campaignAssets.filter(a=>a.airbaseId===base.id);if(!parts.length)return;const runway=parts.find(a=>a.part==='runway');base.hp=runway.structureHp;base.maxHp=runway.structureMaxHp;base.disabled=runway.structureHp<=0||runway.side!==base.side;
 for(const a of parts.filter(a=>a.part==='hangar'&&(a.structureHp<=0||a.side!==base.side)))for(const id of a.aircraftIds)base.turnStock[id]=0;
 const service=parts.find(a=>a.part==='service');base.campaignServiceDown=service?.structureHp<=0;
}
export function seedAirports(b,bases){b.campaignAirbases=bases;
 const occupied=new Set([...allStructures(b),...b.units,...bases].map(key));
 for(const base of bases){if(base.forwardRef)continue;const existing=b.campaignAssets.filter(a=>a.airbaseId===base.id);if(existing.length){for(const id of Object.keys(base.stock).filter(id=>base.stock[id]>0&&!existing.some(a=>a.aircraftIds?.includes(id)))){const hangar=existing.filter(a=>a.part==='hangar').sort((a,c)=>a.aircraftIds.length-c.aircraftIds.length)[0];if(hangar)hangar.aircraftIds.push(id);}continue;}
  const slots=neighbors(base).filter(p=>!occupied.has(key(p))&&!b.sites.some(s=>s.tiles?.some(t=>t.x===p.x&&t.y===p.y))&&Number.isFinite(movementCost({role:'supplyTruck'},p.x,p.y)));
  const types=Object.keys(base.stock).filter(k=>base.stock[k]>0),split=Math.ceil(types.length/2);
  const parts=[{part:'runway',name:'مدرج',x:base.x,y:base.y,max:420},{part:'hangar',name:'حظيرة ١',...slots[0],max:300,aircraftIds:types.slice(0,split)},{part:'hangar',name:'حظيرة ٢',...slots[1],max:300,aircraftIds:types.slice(split)},{part:'service',name:'خدمات',...slots[2],max:260}];
  for(const [i,p]of parts.entries()){if(!Number.isInteger(p.x))continue;occupied.add(key(p));b.campaignAssets.push({...p,id:base.id+'-part-'+i,airbaseId:base.id,type:'airportPart',side:base.side,originalSide:base.side,name:base.name+' · '+p.name,structureHp:p.max,structureMaxHp:p.max,campaignDurability:true,aircraftIds:p.aircraftIds??[]});}syncAirport(b,base);
 }
}
export function airportReady(b,base,id){syncAirport(b,base);const hangar=b.campaignAssets.find(a=>a.airbaseId===base.id&&a.aircraftIds?.includes(id));return !base.disabled&&(!hangar||hangar.structureHp>0)&&(!base.campaignServiceDown||b.turn%2===0);}
export function repairTarget(b,id){if(id.startsWith('unit:'))return b.units.find(u=>u.id===id.slice(5));if(id.startsWith('house:')){const o=b.mapObjects?.[id.slice(6)];if(o)o.side=b.sites.find(s=>s.id===o.siteId)?.owner;return o;}return allStructures(b).find(a=>a.id===id);}
const hp=a=>a.structureHp??a.hp;
const maxhp=a=>a.structureMaxHp??a.maxHp;
export function repairCheck(b,id,side='blue'){
 const a=repairTarget(b,id);if(!a||a.side!==side)return{ok:false,reason:'الموقع لا يتبع قواتك.'};
 if(side==='red'&&a.rebuildOrdered&&hp(a)<=0)return{ok:false,reason:'نُقل الإعمار إلى المقر البديل.'};
 if(a.construction)return{ok:false,reason:'المقر قيد الإنشاء.'};if(side==='red'&&b.units.some(u=>u.side==='blue'&&alive(u)&&distance(u,a)<=3))return{ok:false,reason:'توقف الترميم بسبب اقتراب قوات الدولة.'};
 const isUnit=id.startsWith('unit:'),limit=isUnit?Math.min(a.maxHp,a.strength*a.hpPerStrength):maxhp(a);
 if(isUnit&&!alive(a)||hp(a)>=limit)return{ok:false,reason:'لا يوجد ضرر قابل للإصلاح؛ المعدات المدمرة لا تُستعاد.'};
 const nearbyEngineers=b.units.filter(u=>u.side===side&&u.kind==='engineer'&&alive(u)&&distance(u,a)<=2);const engineer=nearbyEngineers.find(u=>!u.fieldActionUsed&&u.engineerWorkedTurn!==b.turn)??nearbyEngineers[0];
 if(isUnit&&!engineer&&(!supplyDepot(b,a)||distance(supplyDepot(b,a),a)>2))return{ok:false,reason:'الصيانة الميدانية تحتاج مهندساً ضمن خليتين أو العودة قرب مركز الإمداد.'};
 if(engineer&&(engineer.fieldActionUsed||engineer.engineerWorkedTurn===b.turn))return{ok:false,reason:'المهندس مشغول بمهمة أخرى بهذه الجولة.'};
 if(hp(a)<=0&&!engineer&&!(side==='red'&&supplyDepot(b,a)&&distance(supplyDepot(b,a),a)<=8))return{ok:false,reason:'إعادة بناء الجزء المدمر تحتاج مهندساً ضمن خليتين.'};
 const depot=supplyDepot(b,a);if(!depot)return{ok:false,reason:'الإصلاح متوقف: طريق الإمداد مقطوع.'};
 if(depot.spares<8)return{ok:false,reason:'الإصلاح متوقف: مواد الصيانة أقل من 8.'};
 return{ok:true,a,depot,engineer,limit};
}
export function orderRepair(b,id){if(b.phase!=='player'||b.finished)return{ok:false,reason:'انتظر دورك.'};const old=b.campaign.repairs.find(o=>o.id===id);if(old){b.campaign.repairs=b.campaign.repairs.filter(o=>o!==old);return{ok:true,reason:'أُلغي طلب الإصلاح.'};}const check=repairCheck(b,id);if(!check.ok)return check;b.campaign.repairs.push({id,side:'blue',status:'بانتظار نهاية الجولة'});return{ok:true,reason:'أُضيف الإصلاح؛ تُستهلك الموارد عند وصولها والعمل فعلياً.'};}
export function provideAid(b,siteId){const s=b.sites.find(s=>s.id===siteId),c=s?.civilians;if(b.phase!=='player'||b.finished||s?.owner!=='blue'||s.contested||c?.aidTurn===b.turn)return false;const d=supplyDepot(b,{...s,side:'blue'});if(!d||d.spares<10)return false;d.spares-=10;c.aidTurn=b.turn;c.anger.blue=Math.max(0,c.anger.blue-8);return true;}
export function changeLeader(b,id){const u=b.units.find(u=>u.side==='blue'&&u.role==='commander'&&alive(u));if(b.phase!=='player'||b.finished||!u||!LEADERS[id]||!SELECTABLE_LEADERS.includes(id)||!officerAvailable(b,'blue',id)||u.changedLeaderTurn===b.turn||!b.logistics.depots.some(d=>d.side==='blue'&&!d.disabled&&distance(d,u)<=3))return false;if(assignedStaff(b,id)||b.campaignAssets.some(a=>a.side==='blue'&&a.leader===id&&a.structureHp>0))return false;u.leader=id;u.readyTurn=b.turn+1;u.changedLeaderTurn=b.turn;return true;}
export function jamDrone(b,flight,target){if(!b.campaign||flight.jamResolved)return false;flight.jamResolved=true;
 const jammer=b.units.find(u=>u.side!==flight.side&&u.role==='jammer'&&u.jammerOn&&!u.moved&&alive(u)&&distance(u,target)<=4&&supplyDepot(b,u));if(!jammer)return false;
 const count=jammer.jamTurn===b.turn?jammer.jamUsed:0;if(count>=3)return false;jammer.jamTurn=b.turn;jammer.jamUsed=count+1;jammer.hidden=false;jammer.revealedUntil=b.turn+1;
 // At most one interruption per three attempts; heavier drones resist more often.
 const stopped=(b.turn+count+(flight.typeId==='heavy'?1:0))%3===0;
 if(stopped){flight.status='jammed';b.inFlightDrones=b.inFlightDrones.filter(f=>f!==flight);note(b,'انقطع توجيه المسيرة بفعل التشويش قبل الوصول؛ لا انفجار عند منصة الإطلاق.');}return stopped;
}
export function campaignTick(b){if(!b.campaign||b.campaign.lastTick===b.turn)return;b.campaign.lastTick=b.turn;staffReview(b);delete b._campaignNetwork;upgradeStructures(b);syncPeople(b);advanceRebelRebuilding(b);
 for(const c of b.units.filter(u=>u.role==='commander'))if(!alive(c)&&!c.lossRecorded){c.lossRecorded=true;b.campaign.disrupted[c.side]=b.turn+2;b.campaign.losses.push({side:c.side,turn:b.turn+3,leader:c.leader});note(b,'فُقدت القيادة الميدانية؛ نائب القيادة يتولى بعد ثلاث جولات إذا بقي المقر.');}
 for(const loss of b.campaign.losses.filter(l=>!l.done&&l.turn<=b.turn)){const post=b.campaignAssets.find(a=>a.type==='commandPost'&&a.side===loss.side&&a.structureHp>0&&!a.construction);if(!post)continue;const c=b.units.find(u=>u.role==='commander'&&u.side===loss.side&&!alive(u));const p=neighbors(post).find(p=>Number.isFinite(movementCost({role:'commander'},p.x,p.y))&&!b.units.some(u=>alive(u)&&u.x===p.x&&u.y===p.y));if(c&&p){const successor=c.side==='blue'?'deputy':'rebelDeputy';if(!officerAvailable(b,c.side,successor)){loss.done=true;continue;}Object.assign(c,p,{leader:successor,hp:c.maxHp,strength:1,readyTurn:b.turn+1,lossRecorded:false});loss.done=true;note(b,'وصل نائب القيادة إلى المقر الميداني.');}}
 for(const u of b.units.filter(alive)){const command=leadership(b,u),d=supplyDepot(b,u);u.campaignSupplied=!!d;u.morale=Math.max(0,Math.min(100,u.morale+(command?.recovery??0)-(d?0:3)));}
 for(const a of allStructures(b)){if(a.disabled&&a.structureHp>0){a.disabled=false;a.status='damaged';if(a.savedRange!=null)a.range=a.savedRange;}if(a.type==='airportPart'){const base=b.campaignAirbases?.find(q=>q.id===a.airbaseId);if(base)syncAirport(b,base);}}
 // The enemy maintains damaged assets through the same cost and access rules.
 for(const a of allStructures(b).filter(a=>a.side==='red'&&hp(a)<maxhp(a)))if(!b.campaign.repairs.some(o=>o.id===a.id))b.campaign.repairs.push({id:a.id,side:'red'});
 for(const o of b.campaign.repairs){const check=repairCheck(b,o.id,o.side);o.status=check.reason??'جارٍ الإصلاح';if(!check.ok)continue;const{a,depot,engineer,limit}=check;if(o.id.startsWith('unit:')&&(a.moved||a.attacked)){o.status='تحتاج الوحدة جولة ثبات للصيانة';continue;}
  const scale=engineer?.2:.12,boost=leadership(b,a)?.repair??1,gain=Math.min(limit-hp(a),Math.round(maxhp(a)*scale*boost)),cost=Math.max(8,Math.ceil(gain/4));if(depot.spares<cost){o.status='بانتظار مواد الصيانة';continue;}depot.spares-=cost;if(engineer){engineer.engineerWorkedTurn=b.turn;engineer.fieldActionUsed=true;engineer.attacked=true;engineer.moved=true;}
  if(a.structureHp!=null){if(a.structureHp<=0&&a.part==='hangar')a.stockLost=false;a.structureHp+=gain;a.commandLoss=false;a.disabled=false;if(b.refineries?.includes(a)){a.destroyed=false;a.ignited=false;}a.status='repairing';if(a.savedRange!=null)a.range=a.savedRange;}else {a.hp+=gain;a.status=a.hp>=a.maxHp?'intact':'damaged';}
  if(a.type==='airportPart'){const base=b.campaignAirbases.find(q=>q.id===a.airbaseId);if(base)syncAirport(b,base);}o.status='أُصلح '+gain+' · كلفة '+cost;if(hp(a)>=limit)o.done=true;
 }
 b.campaign.repairs=b.campaign.repairs.filter(o=>!o.done&&repairTarget(b,o.id));
 for(const d of b.logistics.depots)if(!d.disabled&&b.turn%4===0)d.spares=Math.min(d.maxSpares,d.spares+24);
 for(const s of b.sites){const c=s.civilians;if(!c)continue;if(b.turn-c.lastHit>2){c.anger.blue=Math.max(0,c.anger.blue-1);c.anger.red=Math.max(0,c.anger.red-1);if(!s.contested&&s.owner==='blue'&&c.aidTurn>=b.turn-2){const n=Math.min(c.displaced,Math.ceil(c.initial*.005));c.displaced-=n;c.present+=n;}}}
}

export function resupplyStructure(b,id){
 const a=repairTarget(b,id);if(b.phase!=='player'||b.finished||!a||a.side!=='blue'||a.disabled||a.resupplyTurn===b.turn)return{ok:false,reason:'المنشأة غير جاهزة أو زُودت بهذه الجولة.'};
 const d=supplyDepot(b,a);if(!d)return{ok:false,reason:'طريق الإمداد مقطوع.'};
 if(b.airDefenses.includes(a)){const n=Math.min(2,Math.max(0,(a.maxMissiles??6)-(a.missiles??0)),Math.floor(d.ammo/3));if(!n)return{ok:false,reason:'المخزون ممتلئ أو ذخيرة الإمداد غير كافية.'};d.ammo-=n*3;a.missiles=(a.missiles??0)+n;}
 else if(b.droneBases.includes(a)){const n=Math.min(2,Math.max(0,12-(a.stock.standard??0)),Math.floor(d.ammo/4));if(!n)return{ok:false,reason:'المخزون ممتلئ أو ذخيرة الإمداد غير كافية.'};d.ammo-=n*4;a.stock.standard=(a.stock.standard??0)+n;}
 else return{ok:false,reason:'هذه المنشأة لا تستخدم هذا التموين.'};a.resupplyTurn=b.turn;return{ok:true,reason:'وصلت الذخيرة من مركز الإمداد.'};
}

export function assignPostLeader(b,postId,leaderId){
 const post=b.campaignAssets.find(a=>a.id===postId&&a.type==='commandPost');
 if(b.phase!=='player'||b.finished)return{ok:false,reason:'انتظر دورك.'};
 if(!post||post.side!=='blue'||post.structureHp<=0||post.construction)return{ok:false,reason:'تحتاج مقر قيادة تابعاً لك وسليماً.'};
 if(assignedStaff(b,leaderId))return{ok:false,reason:'القائد مرتبط بمهمة اختصاصية.'};
 if(!LEADERS[leaderId]||!SELECTABLE_LEADERS.includes(leaderId)||!officerAvailable(b,'blue',leaderId))return{ok:false,reason:'هذا الضابط غير متاح.'};
 if(post.changedLeaderTurn===b.turn)return{ok:false,reason:'يمكن تغيير ضابط المقر مرة واحدة بالجولة.'};
 if(b.units.some(u=>u.side==='blue'&&u.role==='commander'&&alive(u)&&u.leader===leaderId)||b.campaignAssets.some(a=>a!==post&&a.side==='blue'&&a.structureHp>0&&a.leader===leaderId))return{ok:false,reason:'الضابط مرتبط بقيادة أخرى.'};
 if(post.leader===leaderId)return{ok:false,reason:'هذا الضابط يقود المقر بالفعل.'};
 const depot=supplyDepot(b,post);if(!depot||depot.spares<12)return{ok:false,reason:'التعيين يحتاج إمداداً متصلاً و12 مادة تجهيز.'};
 depot.spares-=12;post.leader=leaderId;post.readyTurn=b.turn+1;post.changedLeaderTurn=b.turn;
 return{ok:true,reason:'تم تعيين '+LEADERS[leaderId].name+'؛ يبدأ تأثيره من الجولة التالية ضمن خمس خلايا مع اتصال الإمداد.'};
}

export function advanceRebelRebuilding(b){
 const state=b.campaign;state.rebuildCount??=0;
 const danger=p=>b.units.some(u=>u.side==='blue'&&alive(u)&&distance(u,p)<6);
 for(const post of b.campaignAssets.filter(a=>a.construction)){
  if(post.side!=='red'||post.structureHp<=0){post.construction=null;continue;}
  const depot=supplyDepot(b,post);
  if(danger(post)||!depot||depot.spares<20){post.buildStatus='متوقف: تهديد أو نقص إمداد';continue;}
  depot.spares-=20;post.construction.progress++;post.buildStatus='إنشاء '+post.construction.progress+'/3';
  post.structureHp=Math.min(post.structureMaxHp,post.structureHp+100);
  if(post.construction.progress>=3){post.construction=null;post.structureHp=post.structureMaxHp;post.disabled=false;post.status='intact';post.buildStatus='مقر بديل جاهز';note(b,'أكمل المتمردون إنشاء مقر قيادة بديل.');}
 }
 if(state.rebuildCount>=2||b.campaignAssets.some(a=>a.construction))return;
 const source=b.campaignAssets.find(a=>a.type==='commandPost'&&a.originalSide==='red'&&a.side==='red'&&a.structureHp<=0&&!a.rebuildOrdered&&!a.rebuildGeneration);
 if(!source)return;
 const occupied=new Set([...allStructures(b),...b.units.filter(alive),...Object.values(b.mapObjects??{}).filter(o=>o.hp>0)].map(key));const network=supplyNetwork(b,'red'),blue=b.units.filter(u=>u.side==='blue'&&alive(u));
 const nearest=p=>Math.min(...blue.map(u=>distance(u,p)),60),oldDistance=nearest(source);let best=null;
 for(let y=2;y<GRID.rows-2;y++)for(let x=2;x<GRID.columns-2;x++){
  const p={x,y},terrain=terrainAt(x,y),depot=network.get(key(p));
  if(b.owners[y*GRID.columns+x]!=='red'||occupied.has(key(p))||blockedRiver.has(key(p))||terrain.elevation>=.7||!Number.isFinite(movementCost({role:'supplyTruck'},x,y))||!depot||depot.spares<20||danger(p)||nearest(p)<oldDistance+2||b.sites.some(s=>s.tiles?.some(t=>t.x===x&&t.y===y)))continue;
  // Prefer accessible foothills and proximity to existing supply, never occupy houses.
  const score=terrain.elevation*24+Math.min(nearest(p),20)-distance(p,depot)*.7;
  if(!best||score>best.score)best={...p,score};
 }
 if(!best)return;
 source.rebuildOrdered=true;state.rebuildCount++;
 b.campaignAssets.push({id:'red-rebuilt-command-'+state.rebuildCount,type:'commandPost',name:'مقر قيادة بديل محصّن',x:best.x,y:best.y,side:'red',originalSide:'red',structureHp:20,structureMaxHp:320,campaignDurability:true,rebuildGeneration:1,construction:{progress:0},buildStatus:'تهيئة الموقع · 0/3'});
 note(b,'رُصد بدء إنشاء مقر بديل للمتمردين؛ يحتاج ثلاث جولات إمداد لإكماله.');
}

export function commandAttackFactor(b,u,domain){const c=leadership(b,u);return (c?.domain===domain?(c.attack??1):1)*(1+staffEffect(b,domain==='air'?'air':'ground',u.side));}
export function intelCommandBonus(b,side){if(staffEffect(b,'intelligence',side)>.06)return 2;return b.units.concat(b.campaignAssets).some(a=>a.side===side&&(a.structureHp??a.hp)>0&&LEADERS[a.leader]?.domain==='intel'&&leadership(b,a))?1:0;}
export function engineerRepairJobs(b,u){if(!u||u.kind!=='engineer')return[];return [...b.units.filter(a=>a.side===u.side&&alive(a)).map(a=>({id:'unit:'+a.id,a})),...allStructures(b).filter(a=>a.side===u.side).map(a=>({id:a.id,a}))].filter(({a})=>hp(a)<(a.strength!=null?Math.min(maxhp(a),a.strength*a.hpPerStrength):maxhp(a))).sort((x,y)=>distance(u,x.a)-distance(u,y.a));}
export function queueEngineerRepair(b,u,id){if(!u||!alive(u)||u.fieldActionUsed||distance(u,repairTarget(b,id)??{x:-999,y:-999})>2)return{ok:false,reason:'اقترب بالمهندس ضمن خليتين، ومهمة واحدة لكل جولة.'};const c=repairCheck(b,id,u.side);if(!c.ok)return c;if(!b.campaign.repairs.some(o=>o.id===id))b.campaign.repairs.push({id,side:u.side,status:'إصلاح نهاية الجولة؛ ثبّت المهندس والوحدة'});return{ok:true,reason:'أُسند الإصلاح لنهاية الجولة؛ أبقِ المهندس والوحدة في موضعهما.'};}
