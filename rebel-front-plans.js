import {distance,elevationAt} from './rebel-terrain.js';
const sector=u=>Math.floor(u.y/12);
const power=u=>(u.strength??1)*(u.modelId?1.8:1)*(.5+(u.morale??70)/200)*(1-(u.fatigue??0)/200)*(u.maxAmmo&&u.ammo<=0?.35:1);
// Only contacts supplied by the observing side are available to planning.
export function planRebelFronts(b,contacts){const state=b.rebelFronts??={plans:{}};if(state.turn===b.turn)return state;state.turn=b.turn;
 const own=b.units.filter(u=>u.side==='red'&&u.strength>0&&u.role!=='supplyTruck');
 for(const key of new Set(own.map(sector))){const units=own.filter(u=>sector(u)===key),enemies=contacts.filter(u=>sector(u)===key),previous=state.plans[key];
 const goals=enemies.map(t=>{const allies=units.filter(u=>distance(u,t)<=8),hostiles=enemies.filter(u=>distance(u,t)<=4),ready=allies.filter(u=>u.morale>=45&&(u.fatigue??0)<70&&(u.ammo>0||u.droneStock>0));const ratio=ready.reduce((n,u)=>n+power(u),0)/Math.max(1,hostiles.reduce((n,u)=>n+power(u),0));return{target:t,allies,ready,ratio,score:(hostiles.length<=2?12:0)+(t.hp/Math.max(1,t.maxHp)<.5?10:0)+(t.role==='supplyTruck'?22:t.role==='commander'?25:t.modelId?12:8)+ratio*8-allies.reduce((n,u)=>n+distance(u,t),0)/Math.max(1,allies.length)};}).filter(g=>g.allies.length>=2).sort((a,c)=>c.score-a.score);
 const goal=goals[0];if(!goal){state.plans[key]={turn:b.turn,mode:'defend',reason:'حماية المداخل دون كشف القوة'};continue;}
 const ownCity=b.sites.find(s=>s.owner==='red'&&sector(s)===key&&distance(s,goal.target)<=s.radius+4),staged=previous?.targetId===goal.target.id&&['stage','attack'].includes(previous.mode)&&previous.turn===b.turn-1;
 let mode=goal.ratio>=1.2&&goal.ready.length>=3?(staged&&goal.ready.filter(u=>distance(u,goal.target)<=5).length>=3?'attack':'stage'):goal.ratio>=.7?'attrition':'defend';if(ownCity&&goal.ratio<1)mode='defend';
 const attackers=goal.ready.filter(u=>!['commander','jammer','reconRadar','droneVehicle','droneOperator','fieldArtillery','mortar','katyusha'].includes(u.role)),max=Math.min(4,Math.max(0,Math.floor(units.length*.5)),Math.max(0,attackers.length-1)),participants=attackers.sort((a,c)=>distance(a,goal.target)-distance(c,goal.target)).slice(0,max).map(u=>u.id);
 if(participants.length<2&&mode==='attack')mode='attrition';state.plans[key]={turn:b.turn,mode,targetId:goal.target.id,x:goal.target.x,y:goal.target.y,participants,ratio:goal.ratio,reason:mode==='attack'?'هجوم محلي بعد التحضير':mode==='stage'?'تهيئة قوة محلية مع بقاء حراسة':mode==='attrition'?'استنزاف موضع مرصود بالمسيرات قبل محاولة الاختراق':'دفاع متفرق يحمي المدينة والممرات'};
 }return state;}
export function frontPlanFor(b,u){return b.rebelFronts?.plans[sector(u)];}
export function rebelPositionScore(b,u,c,contacts){const p=frontPlanFor(b,u);if(!p)return 0;const cover=(b.sites.some(s=>s.tiles?.some(t=>t.x===c.x&&t.y===c.y))?2:0)+Math.min(3,elevationAt(c.x,c.y)*3),danger=contacts.filter(e=>distance(c,e)<=2).length;if(p.mode==='attack'&&p.participants?.includes(u.id))return-distance(c,p)*2+cover-danger;if(p.mode==='stage'&&p.participants?.includes(u.id))return-Math.abs(distance(c,p)-4)*2+cover*2-danger*3;return cover*1.5-danger*2;}
export function droneFrontBonus(b,source,target,side){if(side!=='red')return 0;const p=frontPlanFor(b,source);return p&&['attrition','stage','attack'].includes(p.mode)&&p.targetId===target.id?35:0;}
