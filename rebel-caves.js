import {GRID,mountainCells,terrainAt,movementCost,distance,RANGES} from '/rebel-terrain.js';
const rangeOf=p=>RANGES.map(r=>({r,d:Math.min(...r.points.map(([x,y])=>distance(p,{x,y})))})).sort((a,c)=>a.d-c.d)[0]?.r;
const active=d=>d.isCave&&d.side==='red'&&!d.disabled&&(d.structureHp??1)>0;
export function seedMountainCaves(b){
 if(b.logistics.depots.some(d=>d.isCave))return;
 const occupied=new Set([...b.units,...b.logistics.depots,...b.droneBases,...b.airDefenses,...b.campaignAssets,...Object.values(b.mapObjects??{})].map(o=>o.x+','+o.y));
 const choices=mountainCells.map(([x,y])=>({x,y,h:terrainAt(x,y).elevation})).filter(p=>p.h>=.3&&p.h<.7&&b.owners[p.y*GRID.columns+p.x]==='red'&&!occupied.has(p.x+','+p.y)&&Number.isFinite(movementCost({role:'supplyTruck'},p.x,p.y))&&!b.sites.some(s=>s.tiles?.some(t=>t.x===p.x&&t.y===p.y))).sort((a,c)=>c.h-a.h);
 const chosen=[];
 for(const r of RANGES.filter(r=>r.id!=='west')){
  const local=choices.filter(p=>rangeOf(p)?.id===r.id),a=local.find(p=>chosen.every(q=>distance(p,q)>=5));if(!a)continue;
  const z=local.filter(p=>distance(p,a)>=5&&distance(p,a)<=11&&chosen.every(q=>distance(p,q)>=5)).sort((p,q)=>distance(q,a)-distance(p,a))[0];if(!z)continue;
  for(const [i,p]of [a,z].entries()){chosen.push(p);b.logistics.depots.push({id:'red-cave-'+r.id+'-'+i,name:'كهف '+r.name+' · '+(i+1),networkId:r.id,isCave:true,side:'red',originalSide:'red',x:p.x,y:p.y,ammo:60,maxAmmo:160,fuel:15,maxFuel:60,spares:30,maxSpares:80,engineeringStores:2,auto:true,disabled:false,structureHp:380,structureMaxHp:380,campaignDurability:true});}
  if(chosen.length>=6)break;
 }
}
export function planTunnelMove(b,u,contacts,reserved=new Set()){
 if(u.side!=='red'||u.modelId||!['infantry','sniper','antiArmor','droneOperator'].includes(u.kind)||u.attacked||u.moved||u.tunnelReadyTurn>b.turn)return null;
 const entrances=b.logistics.depots.filter(active),entry=entrances.find(d=>distance(u,d)<=4&&d.spares>=1);if(!entry||b.tunnelTraffic?.[entry.networkId]===b.turn)return null;
 const danger=p=>contacts.filter(e=>distance(e,p)<=4).length;
 const threatened=danger(u)>0||u.lastRebelFire===b.turn-1;if(!threatened)return null;
 const exits=entrances.filter(d=>d.id!==entry.id&&d.networkId===entry.networkId&&b.owners[d.y*GRID.columns+d.x]==='red'&&danger(d)===0&&!reserved.has(d.x+','+d.y)&&!b.units.some(v=>v.strength>0&&v.id!==u.id&&v.x===d.x&&v.y===d.y));
 const exit=exits.sort((a,c)=>distance(c,u)-distance(a,u))[0];return exit?{entryId:entry.id,exitId:exit.id,networkId:entry.networkId,entryX:entry.x,entryY:entry.y,x:exit.x,y:exit.y}:null;
}
export function executeTunnelMove(b,u,move){
 const entry=b.logistics.depots.find(d=>d.id===move.entryId&&active(d)),exit=b.logistics.depots.find(d=>d.id===move.exitId&&active(d));
 if(!entry||!exit||entry.networkId!==exit.networkId||entry.spares<1||distance(u,entry)>1||b.tunnelTraffic?.[entry.networkId]===b.turn||b.units.some(v=>v.id!==u.id&&v.strength>0&&v.x===exit.x&&v.y===exit.y))return false;
 entry.spares--;b.tunnelTraffic??={};b.tunnelTraffic[entry.networkId]=b.turn;u.x=exit.x;u.y=exit.y;u.moved=true;u.attacked=true;u.order=null;u.hidden=false;u.ambushReady=false;u.tunnelReadyTurn=b.turn+3;
 if(u.garrisonedIn){const house=b.mapObjects?.[u.garrisonedIn];if(house)house.garrisonUnitIds=(house.garrisonUnitIds??[]).filter(id=>id!==u.id);delete u.garrisonedIn;}
 for(const side of ['blue','red']){if(b.airReconContacts?.[side])delete b.airReconContacts[side][u.id];if(b.uavRecon?.[side])delete b.uavRecon[side][u.id];}
 return true;
}
export function balanceTunnelSupply(b){
 const caves=b.logistics.depots.filter(active),groups=new Map();for(const d of caves){if(!d.networkId)continue;const g=groups.get(d.networkId)??[];g.push(d);groups.set(d.networkId,g);}
 for(const group of groups.values()){if(group.length<2)continue;for(const key of ['ammo','spares']){const sorted=group.slice().sort((a,c)=>a[key]-c[key]),low=sorted[0],high=sorted.at(-1),n=Math.min(8,Math.max(0,Math.floor((high[key]-low[key])/2)));low[key]+=n;high[key]-=n;}}
}
export function caveArtwork(destroyed=false){return `<g stroke="#43504c" stroke-width="2" stroke-linejoin="round"><ellipse cy="35" rx="72" ry="14" fill="#263b3e" opacity=".35"/><path d="M-78 31L-55-12L-32-36L-9-44L25-32L49-8L78 32L41 42L-40 40Z" fill="#8b8d79"/><path d="M-9-44L7-15L49-8L78 32L31 29L18-4Z" fill="#64756e"/><path d="M-55-12L-32-36L-25-6L-43 19L-69 31M25-32L34-6L60 19" fill="none" stroke="#b3ad91"/><path d="M-29 31V8Q-27-20 0-21Q27-20 29 8V31Z" fill="#203638" stroke="#b7ad8b" stroke-width="5"/>${destroyed?'<path d="M-33 33L-18 4L-3 17L9 1L34 33Z" fill="#777d6c"/><path d="M-20 30L-11 16L0 30L12 12L25 31" fill="#a1a18a"/>':'<path d="M-22 29V18H-4V30M3 29V12H20V29" fill="#8e9473"/><path d="M-18 20V28M8 15V27" stroke="#c6b68a"/><path d="M-30 35L-51 52M30 35L51 52" stroke="#aba083" stroke-width="5"/>'}<path d="M-59 31l9-9 12 10M43 32l9-13 12 14" fill="#a0a18a"/></g>`;}
