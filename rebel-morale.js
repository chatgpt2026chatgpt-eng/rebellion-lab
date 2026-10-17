import {distance} from './rebel-terrain.js';
const clamp=n=>Math.max(0,Math.min(100,n));
export function beginMoraleRound(b){b.frontMorale??={};b.frontMorale.before=b.units.map(u=>({id:u.id,side:u.side,x:u.x,y:u.y,hp:u.hp??0,maxHp:u.maxHp??1,ammo:u.ammo??0,kills:u.kills??0,droneStock:u.droneStock??0,combatCredit:u.combatCredit??0}));for(const u of b.units){u.fatigue??=0;u.combatStreak??=0;}}
export function fatigueFireFactor(u){return 1-Math.min(.18,(u.fatigue??0)*.0018);}
export function fatigueMovement(u){return Math.max(1,(u.movement??3)-((u.fatigue??0)>=70?1:0));}
export function recordMoraleDamage(attacker,target,damage){if(attacker&&target&&attacker.side!==target.side&&damage>0)attacker.combatCredit=(attacker.combatCredit??0)+Math.min(1,damage/Math.max(1,target.maxHp??100));}
// Local own losses and confirmed results; no reading of concealed hostile health.
export function finishMoraleRound(b){const state=b.frontMorale;if(!state?.before||state.lastTurn===b.turn)return;state.lastTurn=b.turn;
 const old=new Map(state.before.map(u=>[u.id,u])),current=new Map(b.units.map(u=>[u.id,u]));
 const changes=state.before.map(p=>{const u=current.get(p.id);return{...p,loss:Math.max(0,p.hp-(u?.hp??0))/Math.max(1,p.maxHp),success:Math.max(0,(u?.kills??p.kills)-p.kills)+Math.max(0,(u?.combatCredit??0)-p.combatCredit)*.5};});
 for(const u of b.units.filter(u=>u.strength>0&&u.role!=='supplyTruck')){const p=old.get(u.id);if(!p)continue;
 const hurt=(u.hp??0)<p.hp,fired=(u.ammo??0)<p.ammo||(u.droneStock??0)<p.droneStock||(u.combatCredit??0)>p.combatCredit,moved=distance(u,p)>0,engaged=hurt||fired;
 u.combatStreak=engaged?(u.combatStreak??0)+1:0;const safeRest=!engaged&&!moved&&(u.campaignSupplied||u.rations>0);
 u.fatigue=clamp((u.fatigue??0)+(engaged?6+Math.min(6,u.combatStreak)+(hurt?3:0):moved?3:safeRest?(b.armistice?.active?-16:-11):-4));
 const local=changes.filter(c=>c.side===u.side&&distance(c,u)<=6),momentum=Math.max(-5,Math.min(5,Math.round(local.reduce((n,c)=>n+c.success,0)*1.5-local.reduce((n,c)=>n+c.loss,0)*5))),exhaustion=u.fatigue>=45?Math.ceil((u.fatigue-44)/14):0,recovery=safeRest?(u.order?.regroup?5:b.armistice?.active?4:2):0;
 u.morale=clamp((u.morale??70)+momentum+recovery-exhaustion);u.moraleReason=momentum>0?'نجاح قتالي بالجبهة':momentum<0?'خسائر بالجبهة':exhaustion?'إرهاق القتال':recovery?'راحة وإعادة تنظيم':'موقف مستقر';
 }}
export function cityMoraleEvent(b,site,side){site.ownerHistory??=[site.owner];const recaptured=site.ownerHistory.includes(side);site.ownerHistory.push(side);site.moralePulse={side,turn:b.turn,until:b.turn+3,lastTurn:-1,recaptured};}
export function applyCityMorale(b){for(const s of b.sites){const p=s.moralePulse;if(!p||b.turn>=p.until||p.lastTurn===b.turn)continue;p.lastTurn=b.turn;for(const u of b.units.filter(u=>u.strength>0&&u.role!=='supplyTruck'&&distance(u,s)<=s.radius+5)){const delta=(p.recaptured?6:4)*(distance(u,s)<=s.radius+1?1:.5);u.morale=clamp(u.morale+(u.side===p.side?delta:-delta));u.moraleReason=(u.side===p.side?(p.recaptured?'استعادة ':'السيطرة على '):'خسارة ')+s.name;}}}
