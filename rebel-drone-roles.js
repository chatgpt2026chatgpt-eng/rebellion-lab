// Explicit map-game loadouts and target roles; counts stay consistent with supply.
export const DRONE_ROLES={light:'خفيفة · أفراد وأهداف خفيفة · مدى ٧',standard:'متوسطة · متعددة المهام · مدى ١١',heavy:'ثقيلة · مدرعات ومبانٍ · مدى ١٥'};
export function ensureDroneInventory(unit){
 if(!unit)return{};const total=Math.max(0,unit.droneStock||0);
 if(!unit.droneInventory){const heavy=unit.role==='droneVehicle'?Math.floor(total/3):0,light=unit.role==='droneOperator'?total:Math.min(1,total-heavy);unit.droneInventory={light,standard:total-heavy-light,heavy};}
 const inv=unit.droneInventory;let sum=Object.values(inv).reduce((a,b)=>a+b,0),delta=total-sum;
 if(delta>0)inv[unit.role==='droneOperator'?'light':'standard']+=delta;
 if(delta<0)for(const key of ['standard','light','heavy']){const n=Math.min(inv[key],-delta);inv[key]-=n;delta+=n;}
 return inv;
}
export function preferredDrone(target){return target?.modelId||['building','air-defense','supply-depot','drone-base','refinery'].includes(target?.kind)?'heavy':target?.kind==='ground'?'standard':'light';}
export function droneDamageFactor(type,target){const armored=!!target?.modelId,structure=['building','air-defense','supply-depot','drone-base','refinery'].includes(target?.kind);return armored?({light:.6,standard:1,heavy:1.45}[type]):structure?({light:.65,standard:1,heavy:1.25}[type]):({light:1.15,standard:1,heavy:.9}[type]);}
