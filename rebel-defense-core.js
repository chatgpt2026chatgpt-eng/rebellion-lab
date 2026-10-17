// Abstract map-game balance. Distances are cells, not real weapon specifications.
export const DEFENSE_TYPES=Object.freeze({
 short:{name:'حارس · دفاع قريب',label:'قريب',sensor:5,range:3.6,min:.1,lock:.55,reload:2.8,slots:1,ammo:8,speed:5.6,turn:3.8,life:4,accuracy:.76,gun:1.5,gunAmmo:12,targets:['drone','helicopter','transport','fighter','bomber','stealth']},
 medium:{name:'درع · دفاع متوسط',label:'متوسط',sensor:7.8,range:6.2,min:.6,lock:1.1,reload:4.4,slots:2,ammo:6,speed:6.4,turn:2.7,life:5,accuracy:.72,targets:['drone','helicopter','transport','fighter','bomber','stealth']},
 long:{name:'أفق · دفاع بعيد',label:'بعيد',sensor:8.5,range:9,min:1.8,lock:1.7,reload:6,slots:2,ammo:4,speed:7.4,turn:2,life:6,accuracy:.69,targets:['fighter','bomber','transport','stealth']},
 radar:{name:'عين · رادار إنذار',label:'إنذار',sensor:12,range:0,min:0,lock:.7,reload:0,slots:0,ammo:0,speed:0,targets:[]},
 manpads:{name:'دفاع كتفي',label:'كتفي',sensor:3.1,range:2.5,min:.1,lock:.65,reload:4,slots:1,ammo:4,speed:4.8,turn:3.8,life:3.5,accuracy:.62,targets:['drone','helicopter','transport','fighter']}
});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const gap=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
export const defenseType=d=>DEFENSE_TYPES[d.role==='antiAir'?'manpads':d.adType||'short'];
export const operational=d=>!d.disabled&&(d.structureHp??d.hp??1)>0&&(d.strength??1)>0;
export const rounds=d=>d.role==='antiAir'?d.antiDroneAmmo??0:d.missiles??0;
export function createDefenseEngine({getDefenses,position,cellSize,random=Math.random,onEvent=()=>{}}){
 const tracks=new Map(),states=new Map(),missiles=[],results=new Map(),contacts=new Map();let clock=0,seq=0;
 const state=d=>{if(!states.has(d.id))states.set(d.id,{mode:'search',next:0,channelReady:Array(defenseType(d).slots).fill(0),locks:new Map()});return states.get(d.id)};
 const announce=(type,data)=>onEvent({type,time:clock,...data});
 function observe(f,p,now){
  if(results.has(f.id)){const r=results.get(f.id);results.delete(f.id);return r}
  if(f._adComplete||f.status!=='flying')return null;
  let t=tracks.get(f.id);
  if(!t){t={flight:f,x:p.x,y:p.y,vx:0,vy:0,last:now,sampled:now,kind:f.kind||'drone'};tracks.set(f.id,t)}
  const dt=Math.max(.001,(now-t.sampled)/1000);
  if(dt>.015){t.vx=t.vx*.4+((p.x-t.x)/dt)*.6;t.vy=t.vy*.4+((p.y-t.y)/dt)*.6;}
  Object.assign(t,{x:p.x,y:p.y,last:now,sampled:now,altitude:p.altitude??1});return null;
 }
 function finish(id){tracks.delete(id);results.delete(id);for(const s of states.values())s.locks.delete(id);for(let i=missiles.length-1;i>=0;i--)if(missiles[i].target===id)missiles.splice(i,1);}
 function visible(d,t){
  if(!operational(d)||d.adSilent||d.side===t.flight.side||t.altitude<.25)return false;
  const spec=defenseType(d),signature=t.kind==='stealth'?.43:t.kind==='drone'?.72:t.kind==='helicopter'?.82:1;
  const exposure=clamp(t.flight.exposure??1,.65,1.25);
  return gap(position(d),t)<=spec.sensor*cellSize*signature*exposure;
 }
 function launch(d,t,spec,s,channel){
  const origin=position(d),gun=spec.gun&&gap(origin,t)<=spec.gun*cellSize&&(d.adGunAmmo??0)>0;
  if(gun)d.adGunAmmo--;else if(d.role==='antiAir')d.antiDroneAmmo--;else d.missiles--;
  const m={id:++seq,target:t.flight.id,defense:d,kind:gun?'gun':'missile',channel,x:origin.x,y:origin.y,angle:Math.atan2(t.y-origin.y,t.x-origin.x),age:0,speed:(gun?11:spec.speed)*cellSize,life:gun?.65:spec.life,turn:gun?5:spec.turn,accuracy:gun?.58:spec.accuracy,trail:[]};
  missiles.push(m);s.channelReady[channel]=clock+(gun?1.25:spec.reload);s.next=clock+.5;s.mode='engage';announce('launch',{defense:d,flight:t.flight,weapon:m.kind});
 }
 function step(dt,now){
  dt=clamp(dt,0,.08);clock+=dt;const defenses=getDefenses();contacts.clear();
  for(const [id,t] of tracks){if(t.flight._adComplete||t.flight.status!=='flying'||now-t.last>850){finish(id);continue;}}
  for(const d of defenses){const s=state(d);if(!operational(d)||d.adSilent){s.mode=operational(d)?'silent':'disabled';s.locks.clear();continue;}
   const spec=defenseType(d),local=[];
   for(const t of tracks.values()){
    const own=visible(d,t),network=spec!==DEFENSE_TYPES.manpads&&defenses.some(r=>r.adType==='radar'&&r.side===d.side&&visible(r,t));
    if(!own&&!network){const old=s.locks.get(t.flight.id);if(old){old.quality=Math.max(0,old.quality-dt*1.7);if(!old.quality)s.locks.delete(t.flight.id)}continue;}
    const lock=s.locks.get(t.flight.id)||{quality:0};lock.quality=Math.min(1,lock.quality+dt/spec.lock);lock.own=own;s.locks.set(t.flight.id,lock);
    if(!contacts.has(t.flight.id))contacts.set(t.flight.id,{...t,quality:lock.quality,side:d.side});else contacts.get(t.flight.id).quality=Math.max(contacts.get(t.flight.id).quality,lock.quality);
    const distance=gap(position(d),t)/cellSize;
    if(lock.quality>=1&&spec.targets.includes(t.kind)&&distance<=spec.range&&distance>=spec.min)local.push({t,distance});
   }
   const busy=missiles.filter(m=>m.defense.id===d.id).length;
   const channel=s.channelReady.findIndex((ready,i)=>ready<=clock&&!missiles.some(m=>m.defense.id===d.id&&m.channel===i));
   const ammo=rounds(d)>0||(d.adGunAmmo??0)>0;
   s.mode=d.adType==='radar'?(s.locks.size?'track':'search'):d.adHold?'hold':!ammo?'empty':busy?'engage':clock<s.next||channel<0?'reload':s.locks.size?([...s.locks.values()].some(l=>l.quality<1)?'acquire':'track'):'search';
   if(d.adType==='radar'||d.adHold||!ammo||clock<s.next||busy>=spec.slots||channel<0)continue;
   // One missile per tracked target across the network; reserve extra channels for other targets.
   local.sort((a,b)=>a.distance-b.distance||a.t.flight.id.localeCompare(b.t.flight.id));
   const choice=local.find(({t,distance})=>!missiles.some(m=>m.target===t.flight.id)&& (rounds(d)>0||spec.gun&&distance<=spec.gun&&(d.adGunAmmo??0)>0));
   if(choice)launch(d,choice.t,spec,s,channel);
  }
  for(let i=missiles.length-1;i>=0;i--){const m=missiles[i],t=tracks.get(m.target);if(!t){missiles.splice(i,1);continue;}
   m.age+=dt;const guided=visible(m.defense,t)||(operational(m.defense)&&!m.defense.adSilent&&m.defense.role!=='antiAir'&&defenses.some(r=>r.adType==='radar'&&r.side===m.defense.side&&visible(r,t)));
   if(guided){const lead=clamp(gap(m,t)/m.speed,0,.65),desired=Math.atan2(t.y+t.vy*lead-m.y,t.x+t.vx*lead-m.x);m.angle+=clamp(wrap(desired-m.angle),-m.turn*dt,m.turn*dt)}
   const old={x:m.x,y:m.y};m.x+=Math.cos(m.angle)*m.speed*dt;m.y+=Math.sin(m.angle)*m.speed*dt;
   m.trail.push({x:m.x,y:m.y});if(m.trail.length>18)m.trail.shift();
   // Segment distance avoids skipping a target at low frame rates.
   const dx=m.x-old.x,dy=m.y-old.y,q=clamp(((t.x-old.x)*dx+(t.y-old.y)*dy)/(dx*dx+dy*dy||1),0,1),distance=Math.hypot(t.x-old.x-dx*q,t.y-old.y-dy*q);
   if(distance<cellSize*.21||m.age>=m.life){
    const hit=distance<cellSize*.21&&guided&&random()<m.accuracy;
    missiles.splice(i,1);announce(hit?'hit':'miss',{defense:m.defense,flight:t.flight,x:m.x,y:m.y,weapon:m.kind});
    if(hit){t.flight.status='intercepted';results.set(t.flight.id,{defense:m.defense,hit:true});tracks.delete(t.flight.id);for(const s of states.values())s.locks.delete(t.flight.id);}
   }
  }
 }
 return{observe,finish,step,tracks,states,missiles,contacts,state,get clock(){return clock}};
}
