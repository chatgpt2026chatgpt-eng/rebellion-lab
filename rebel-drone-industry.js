import {supplyDepot} from '/rebel-campaign.js';
import {GRID} from '/rebel-terrain.js';
// Manufacturing and delivery use physical, destructible map assets.
export const droneFactoryArt=`<g stroke="#344443" stroke-width="2" stroke-linejoin="round"><ellipse cy="36" rx="72" ry="9" fill="#263432" opacity=".25"/><path d="M-64-8L-14-27L61-7V32H-64Z" fill="#b7b399"/><path d="M-64-8L-44-28L-23-18L-4-36L20-24L39-36L61-7Z" fill="#798d86"/><path d="M39-36L61-7V32L39 22Z" fill="#71817a"/><path d="M-52-20V-56H-39V-18M-28-18V-44H-17V-23" fill="#aca993"/><path d="M-54-56H-37M-30-44H-15" stroke="#586962" stroke-width="4"/><path d="M-49 7H-31V31H-49M-18 8H2V31H-18M12 7H31V17H12" fill="#40595d"/><path d="M-62-4H36M-47 13H-33M-16 15H0" stroke="#dedbc0"/><path d="M-2-16H28M13-24V-7M4-23L22-9M4-9L22-23" fill="none" stroke="#dfe1c8" stroke-width="3"/></g>`;
export function seedDroneIndustry(battle,{canPlace,place,neighbors,path}){
 battle.droneIndustry={lastTurn:0,nextTruck:1};
 const existing=battle.droneBases.find(b=>b.side==='red');if(existing){existing.stock={light:2,standard:3,heavy:0};existing.launchLimit=4;}
 const occupied=(p)=>battle.droneBases.some(a=>a.x===p.x&&a.y===p.y)||battle.units.some(u=>u.strength>0&&u.x===p.x&&u.y===p.y);
 const find=(cx,cy)=>{const cells=[];for(let y=2;y<38;y++)for(let x=22;x<53;x++)if(battle.owners[y*GRID.columns+x]==='red'&&canPlace(battle,x,y,'factory')&&!occupied({x,y}))cells.push({x,y});return cells.sort((a,b)=>Math.hypot(a.x-cx,a.y-cy)-Math.hypot(b.x-cx,b.y-cy))[0]};
 for(const [i,c]of [[0,[39,20]],[1,[39,31]]]){const f=find(...c);if(!f)continue;const platform=find(f.x-5,f.y);if(!platform)continue;
 const id='red-drone-works-'+i;place(battle,f.x,f.y,'factory','red');battle.droneBases.push({id,side:'red',...f,industryRole:'factory',stock:{light:0,standard:8,heavy:0},structureHp:180,structureMaxHp:180,lastLaunchTurn:0,production:2,storageCap:16});
 // Find again after adding the factory so the reserved cell cannot overlap it.
 const p=find(f.x-5,f.y);if(!p)continue;const launch={id:'red-drone-platform-'+i,side:'red',...p,stock:{light:0,standard:2,heavy:0},lastLaunchTurn:0,launchLimit:4};battle.droneBases.push(launch);
 }
}
export function advanceDroneIndustry(battle,{neighbors,path}){
 const state=battle.droneIndustry;if(!state||state.lastTurn===battle.turn)return[];state.lastTurn=battle.turn;const moves=[];
 const bases=battle.droneBases;
 for(const truck of battle.units.filter(u=>u.droneCargo&&u.strength>0)){
  const destination=bases.find(b=>b.id===truck.droneDestination&&b.side===truck.side&&!b.disabled&&b.industryRole!=='factory');
  if(!destination){const candidates=bases.filter(b=>b.side===truck.side&&!b.disabled&&b.industryRole!=='factory');truck.droneDestination=candidates[0]?.id??null;continue;}
  const route=path(battle,truck.side,truck,destination);if(!route)continue;
  const from={x:truck.x,y:truck.y},steps=[];let budget=0;
  for(const p of route){if(battle.units.some(u=>u!==truck&&u.strength>0&&u.x===p.x&&u.y===p.y))break;const cost=p.cost??1;if(budget+cost>3)break;budget+=cost;steps.push(p);if(neighbors(destination).some(n=>n.x===p.x&&n.y===p.y))break;}
  if(steps.length){Object.assign(truck,steps.at(-1));moves.push({truckId:truck.id,from,path:steps});}
  if(neighbors(destination).some(n=>n.x===truck.x&&n.y===truck.y)||(truck.x===destination.x&&truck.y===destination.y)){const room=Math.max(0,12-(destination.stock.standard??0)),amount=Math.min(room,truck.droneCargo);destination.stock.standard+=amount;truck.droneCargo-=amount;if(!truck.droneCargo){truck.hp=0;truck.strength=0;}battle.events.push('وصلت شحنة مسيرات إلى منصة الإطلاق: '+amount);}
 }
 for(const factory of bases.filter(b=>b.industryRole==='factory')){
  if(factory.disabled){factory.stock.standard=0;continue;}const depot=supplyDepot(battle,factory);if(!depot)continue;
  const made=Math.min(factory.production,factory.storageCap-factory.stock.standard,Math.floor(depot.ammo/2));factory.stock.standard+=made;depot.ammo-=made*2;
  if(battle.units.some(u=>u.strength>0&&u.droneFactory===factory.id)||factory.stock.standard<4)continue;
  const targets=bases.filter(b=>b.side===factory.side&&!b.disabled&&b.industryRole!=='factory'&&(b.stock.standard??0)<8&&!battle.units.some(u=>u.strength>0&&u.droneDestination===b.id)).sort((a,b)=>(a.stock.standard??0)-(b.stock.standard??0));
  const start=neighbors(factory).find(p=>!battle.units.some(u=>u.strength>0&&u.x===p.x&&u.y===p.y)&&battle.owners[p.y*GRID.columns+p.x]===factory.side&&path(battle,factory.side,p,targets[0]??factory));if(!start||!targets.length)continue;
  const destination=targets.find(t=>path(battle,factory.side,start,t));if(!destination)continue;
  factory.stock.standard-=4;battle.units.push({id:factory.side+'-drone-cargo-'+state.nextTruck++,side:factory.side,kind:'supplyTruck',role:'supplyTruck',...start,hp:70,maxHp:70,hpPerStrength:70,strength:1,maxStrength:1,morale:100,movement:0,moved:true,attacked:true,hidden:false,ammo:0,maxAmmo:0,fuel:0,maxFuel:0,droneCargo:4,droneFactory:factory.id,droneDestination:destination.id,supplyTargetId:'منصة المسيرات · حمولة ٤'});
 }
 battle.events=battle.events.slice(-8);return moves;
}
