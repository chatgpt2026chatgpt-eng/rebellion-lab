import {isUnitDetected} from '/rebel-artillery-sim.js';
import {policy,civilianStrikeAllowed,evidencePermission,recordEvidence,truceMoveRisk,truceWithdrawal} from '/rebel-command-policy.js';
import {getArmisticeState} from '/rebel-political-systems.js';
import {knownTargets} from '/rebel-intelligence.js';
import {distance,GRID} from '/rebel-terrain.js';
const IMPORTANCE={command:92,factory:88,airDefense:92,supply:72,airport:82,radar:82,armor:64,convoy:56,unit:40};
const DURABILITY={command:240,factory:280,airDefense:100,supply:150,airport:300,radar:90,armor:150,convoy:65,unit:75};
// Only the recorded report is used: no lookup of a concealed enemy's present position or health.
export function planAirOrder(b,catalog,side='blue'){
 if(getArmisticeState(b).active)return null;
 const p=policy(b,side),reports=knownTargets(b,side),own=b.units.filter(u=>u.side===side&&u.strength>0),state=b.airDoctrine??{},used=state.turn===b.turn?state.used??[]:[],choices=[];
 for(const option of catalog){const {id,base,craft,weapons,tanker}=option;if(option.available<1||!option.ready||base.side!==side)continue;
 if(craft.kind==='transport'){const unit=own.find(u=>u.kind==='infantry'&&!u.modelId&&!u.moved&&!u.attacked&&!u.garrisonedIn&&distance(u,base)<=2);const city=unit&&b.sites.filter(s=>s.owner===side&&!s.contested&&distance(base,s)<=craft.range&&distance(unit,s)>5&&Math.abs(s.y-unit.y)<=10&&!reports.some(r=>r.age<=1&&distance(r,s)<4)).sort((a,c)=>distance(base,c)-distance(base,a))[0];if(city&&!used.includes('airlift:'+id)){for(let y=Math.max(0,city.y-1);y<=Math.min(GRID.rows-1,city.y+1);y++)for(let x=Math.max(0,city.x-1);x<=Math.min(GRID.columns-1,city.x+1);x++){if(b.owners[y*GRID.columns+x]!==side||own.some(u=>u.x===x&&u.y===y))continue;choices.push({...option,target:{x,y},unitId:unit.id,reportId:'airlift',task:'transport',count:1,score:35,reason:'نقل قوة محلية إلى مدينة مؤمنة ضمن جبهتها'});}}continue;}
  for(const r of reports){
   if(!Number.isInteger(r.x)||!Number.isInteger(r.y)||r.x<0||r.x>=GRID.columns||r.y<0||r.y>=GRID.rows||used.includes(r.id+':'+id))continue;
   const d=distance(base,r),age=r.age??b.turn-r.turn,importance=IMPORTANCE[r.category]??40;
   const recent=age<=1&&r.status==='observed'&&r.uncertainty===0&&r.confidence>=70;
   const intelligenceStrike=!recent&&importance>=72&&age<=1&&r.confidence>=75&&r.uncertainty<=1;
   if(recent&&Number.isFinite(r.health)&&r.health<=0)continue;
   const live=recent?own.length&&b.units.find(u=>u.id===r.entityId&&u.side!==side&&u.strength>0&&u.x===r.x&&u.y===r.y&&isUnitDetected(b,u,side)):null;
   const target={x:r.x,y:r.y,name:r.name,intelReportId:r.id,...(live?{unit:{id:live.id,side:live.side}}:{})};
   if(!evidencePermission(b,side,r,{recon:!!craft.recon||id==='ah1z'&&!recent,report:r}))continue;
   const previous=(state.history??[]).filter(h=>h.turn===b.turn&&h.x===r.x&&h.y===r.y);
   if(craft.recon&&(state.history??[]).filter(h=>h.turn===b.turn&&h.task==='recon').length>=2)continue;
   if(craft.recon||id==='ah1z'&&!recent){
    // Leave an orbit margin. Never move an unreachable order to another point.
    if(recent||d+2>craft.range||previous.some(h=>h.task==='recon'||h.task==='patrol'))continue;
    choices.push({...option,target,reportId:r.id,count:1,score:importance*.65+12-d*.3,task:craft.recon?'recon':'patrol',reason:'استطلاع منطقة '+r.name+' · المدى يشمل هامش التحليق'});continue;
   }
   if(getArmisticeState(b).active)continue;
   if(!recent&&!intelligenceStrike)continue;
   if(!recent&&previous.some(h=>h.task==='strike'))continue;
   if(own.some(u=>distance(u,r)<=(id==='stealth'?2:1)+(r.uncertainty??0)))continue;
   if(id==='stealth'&&b.owners[r.y*GRID.columns+r.x]===side)continue;
   const defense=reports.filter(q=>q.category==='airDefense'&&(q.age??b.turn-q.turn)<=2&&q.confidence>=65&&distance(q,r)<6).length;
   if(defense&&['helicopter','transport'].includes(craft.kind))continue;
   if(!recent&&id!=='mq9')continue; // Precision UAV may act on strong but fallible intelligence.
   const weaponsList=Object.entries(weapons??{});if(!weaponsList.length)weaponsList.push(['stealth',{damage:1,standoff:0}]);
   for(const [weapon,w] of weaponsList){
    const needed=d-Math.min(w.standoff??0,d*.45),escort=needed>craft.range&&tanker&&!['rq7','mq9','ah1z','ah64'].includes(id);
    if(needed>craft.range*(escort?1.5:1))continue;
    const hp=recent&&Number.isFinite(r.health)?r.health:DURABILITY[r.category]??90;
    const damage=Math.max(1,craft.damage*(w.damage??1)*(id==='stealth'?4:1));
    const count=Math.min(recent?4:1,option.available,Math.max(1,Math.ceil(hp/(damage*.85))));
    const completion=Math.min(1,count*damage/Math.max(1,hp));
    let affinity=0;
    if(id==='stealth')affinity=['factory','command','airport'].includes(r.category)?30:-28;
    if(id==='f16')affinity=['airDefense','radar'].includes(r.category)?28:importance>=72?15:3;
    if(id==='mig29')affinity=['unit','convoy'].includes(r.category)?13:4;
    if(id==='su24')affinity=['factory','supply','command'].includes(r.category)?22:-4;
    if(id==='a10'||id==='ah64')affinity=r.category==='armor'?24:0;
    if(id==='mq9')affinity=intelligenceStrike?25:hp<=90&&!defense?16:-16;
    const precision=weapon!=='freefall'&&weapon!=='rockets'&&id!=='stealth';
    if(!civilianStrikeAllowed(b,r,{side,area:!precision,confidence:r.confidence}))continue;
    if(p.airRisk==='low'&&defense&&id!=='stealth'&&(w.standoff??0)<5)continue;
    const homes=Object.values(b.mapObjects??{}).some(o=>o.category==='building'&&o.hp>0&&distance(o,r)<=1);
    const score=(p.tempo==='press'?8:p.tempo==='cautious'?-6:0)+(p.airRisk==='high'?defense*5:0)+importance+affinity+completion*20-d*.4-count*3-defense*(id==='stealth'?3:id==='mq9'?25:10)+(defense?Math.min(7,w.standoff??0)*2:0)-(homes&&!precision?22:0)-previous.filter(h=>h.task==='strike').length*90;
    choices.push({...option,target,reportId:r.id,weapon:weapon==='stealth'?undefined:weapon,count,escort,task:'strike',score,reason:`${r.name} · أولوية ${importance} · ${count} طائرة · ${w.label??'قنابل شبحية'} · ${recent?'رصد حديث':'معلومة استخباراتية بثقة '+r.confidence+'%؛ إصابة الهدف غير مضمونة'}`});
   }
  }
  if(craft.recon){for(const city of b.sites.filter(s=>s.owner!==side&&distance(base,s)+2<=craft.range)){
   if(!evidencePermission(b,side,city,{recon:true})||(state.history??[]).filter(h=>h.turn===b.turn&&h.task==='recon').length>=2||used.includes('frontier-'+city.id+':'+id)||reports.some(r=>(r.age??b.turn-r.turn)<2&&r.status==='observed'&&distance(r,city)<=3))continue;
   if((state.history??[]).some(h=>b.turn-h.turn<2&&h.task==='recon'&&distance(h,city)<=3))continue;
   choices.push({...option,target:{x:city.x,y:city.y},reportId:'frontier-'+city.id,count:1,task:'recon',score:42-distance(base,city)*.3,reason:'تحديث استطلاع '+city.name+' مع احتياطي لزمن التحليق'});
  }}
 }
 return choices.filter(c=>c.score>=20).sort((a,c)=>c.score-a.score||a.count-c.count)[0]??null;
}
