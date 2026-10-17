import {policy} from '/rebel-command-policy.js';
import {distance} from '/rebel-terrain.js';
// Persistent local sectors prevent a single attractive objective from emptying every front.
export function frontOrder(b,u,contacts){
 b.frontDoctrine??={assignments:{},captures:{}};
 const state=b.frontDoctrine,old=state.assignments[u.id];
 const lane=old?.lane??Math.floor(u.y/12),local=p=>Math.abs(p.y-(lane*12+5.5))<=9;
 const foes=contacts.filter(t=>distance(u,t)<=8||local(t));
 const cities=b.sites.filter(s=>s.owner!==u.side&&local(s));
 const current=old&&cities.find(s=>s.id===old.objective);
 const objective=current??cities.sort((a,c)=>distance(u,a)-distance(u,c))[0];
 state.assignments[u.id]={lane,objective:objective?.id??null};
 const threat=foes.filter(t=>distance(u,t)<=6).sort((a,c)=>distance(u,a)-distance(u,c))[0];
 const owned=b.sites.filter(s=>s.owner===u.side&&local(s));
 const guardSite=owned.find(s=>{
  const vulnerable=contacts.some(t=>distance(t,s)<=(s.radius??3)+5)||b.sites.some(t=>t.owner!==u.side&&distance(t,s)<20);
  if(!vulnerable)return false;
  const candidates=b.units.filter(v=>v.side===u.side&&v.strength>0&&v.role!=='supplyTruck'&&!['commander','droneVehicle','droneOperator','jammer','reconRadar'].includes(v.role)&&Math.abs(v.y-s.y)<=8).sort((a,c)=>distance(a,s)-distance(c,s)||String(a.id).localeCompare(String(c.id)));
  const n=policy(b,u.side).reserve==='strong'?2:1;return candidates.slice(0,n).some(c=>c.id===u.id);
 });
 if(guardSite&&!threat)return{goal:guardSite,guard:true,contacts:foes,lane};
 if(threat)return{goal:threat,contacts:foes,lane};
 if(objective)return{goal:objective,contacts:foes,lane};
 // A cleared sector lends only part of its strength; remaining troops secure its approaches.
 const localUnits=b.units.filter(v=>v.side===u.side&&v.strength>0&&Math.floor((state.assignments[v.id]?.lane??Math.floor(v.y/12)))===lane).sort((a,c)=>String(a.id).localeCompare(String(c.id)));
 const reserve=policy(b,u.side).reserve,position=localUnits.indexOf(u),lend=reserve==='strong'?position%3===0:reserve==='lean'?position%3!==2:position%2===0;
 if(lend){const next=b.sites.filter(s=>s.owner!==u.side).sort((a,c)=>distance(u,a)-distance(u,c))[0];if(next)return{goal:next,contacts:foes,lane};}
 return{goal:owned.sort((a,c)=>distance(u,a)-distance(u,c))[0],guard:true,contacts:foes,lane};
}
export function markLocalParticipants(b){
 b.frontDoctrine??={assignments:{},captures:{}};
 for(const s of b.sites){if(s.owner==='blue')continue;s.liberationParticipants=b.units.filter(u=>u.side==='blue'&&u.strength>0&&distance(u,s)<=(s.radius??3)+3).map(u=>u.id);}
}
export function canRestLocally(b,u,site){return u.side==='blue'&&!!site&&site.owner==='blue'&&!site.contested&&(site.liberationParticipants??[]).includes(u.id)&&distance(u,site)<=(site.radius??3)+1;}
