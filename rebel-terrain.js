// Shared geography: rendering, movement, sight and all ground engines use these cells.
export const GRID=Object.freeze({columns:80,rows:48});
export const THEATER=Object.freeze({width:14550,height:7550});
export const HEX_RADIUS=104;
export const center=(x,y)=>({x:Math.sqrt(3)*104*(x+.5+(y%2)*.5),y:104+156*y});
export const distance=(a,b)=>{const q=a.x-(a.y-(a.y&1))/2-b.x+(b.y-(b.y&1))/2,r=a.y-b.y;return Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r))};
export const CITY_LAYOUT=[
 ['noran','نوران',9,6,5],['darin','دارين',9,19,5],['ravan','رافان',9,32,5],
 ['valin','فالين',29,6,8],['miraf','ميراف',29,19,10],['seraf','سيراف',29,32,6],
 ['qalara','قلعة الوادي',68,24,12],['hazan','حازان',49,6,6],['darun','دارون',49,19,9],['narin','نيرين',49,32,7]
];
export const CITIES=CITY_LAYOUT.map(([id,name,x,y,priority])=>({id,name,...center(x,y),priority}));
export const AIRPORT_CELLS=[[4,3],[4,13],[4,25],[5,36],[14,13],[15,3],[15,24],[15,36]];
export const RANGES=[
 {id:'north',name:'سلسلة حازان',points:[[22,3],[29,2],[37,4],[43,2],[54,4],[57,8]],width:1.75},
 {id:'central',name:'مرتفعات ميراف',points:[[22,11],[27,13],[32,12],[37,15],[41,18],[44,24]],width:1.6},
 {id:'east',name:'جبال دارون',points:[[54,12],[55,17],[53,23],[55,29],[56,35]],width:1.65},
 {id:'south',name:'سلسلة سيراف',points:[[23,26],[27,27],[32,26],[37,29],[40,34],[45,36],[51,37]],width:1.7},
 {id:'valley',name:'حصن قلعة الوادي',points:[[60,24],[68,16],[76,24],[68,32],[60,24]],width:0},
 {id:'west',name:'مرتفعات رافان',points:[[3,9],[7,11],[12,10],[15,12]],width:1.25}
];
export const VALLEY={x:68,y:24,inner:7,outer:8,gate:{x:60,y:24}};
export const valleyWall=(x,y)=>{const d=distance({x,y},VALLEY);return d>=7&&d<=8&&!(y===24&&x<68);};
export const PASSES=[{name:'بوابة الوادي',x:60,y:24},
 {name:'ممر حازان',x:37,y:4},{name:'ممر ميراف',x:27,y:13},
 {name:'ممر الوسط',x:40,y:17},{name:'ممر دارون',x:54,y:25},
 {name:'ممر سيراف',x:33,y:27},{name:'ممر رافان',x:10,y:11}
];
export const ROAD_CELLS_LINES=[[[49,19],[57,24],[60,24],[68,24]],[[1,19],[9,19],[19,19],[29,19],[40,17],[49,19],[58,19]],[[9,2],[9,6],[10,11],[9,19],[9,32],[9,38]],[[29,6],[27,13],[29,19],[33,27],[29,32]],[[49,6],[49,19],[54,25],[49,32]],[[29,6],[37,4],[49,6]],[[9,32],[29,32],[49,32]]];
export const ROAD_LINES=ROAD_CELLS_LINES.map(line=>line.map(([x,y])=>{const p=center(x,y);return[p.x,p.y]}));
export const RIVER_POINTS=Array.from({length:14},(_,i)=>[Math.round(3440+Math.sin(i*.95)*80),i*600-50]);
const segmentDistance=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)};
const heights=new Float32Array(GRID.columns*GRID.rows),rangeIds=new Int8Array(heights.length).fill(-1),passMap=new Map();
export const mountainCells=[];
for(let y=0;y<GRID.rows;y++)for(let x=0;x<GRID.columns;x++){
 const protectedSite=CITY_LAYOUT.some(([, ,cx,cy,p])=>distance({x,y},{x:cx,y:cy})<=(p>=9?4:3))||AIRPORT_CELLS.some(([cx,cy])=>distance({x,y},{x:cx,y:cy})<=2);
 if(valleyWall(x,y)){heights[y*GRID.columns+x]=1.12;rangeIds[y*GRID.columns+x]=4;mountainCells.push([x,y]);continue;}
 if(distance({x,y},VALLEY)<7)continue;
 if(y===24&&x>=60&&x<=61){passMap.set(`${x},${y}`,PASSES[0]);continue;}
 if(protectedSite)continue;
 let height=0,range=-1;
 RANGES.forEach((r,i)=>{if(r.id==='valley')return;const d=Math.min(...r.points.slice(1).map((b,j)=>segmentDistance(x,y,r.points[j],b)));const h=Math.max(0,1-d/(r.width+.65))*(.82+((x*17+y*11)%13)/45);if(h>height){height=h;range=i}});
 const pass=PASSES.find(p=>distance({x,y},p)<=1);
 if(pass&&height>.08){passMap.set(`${x},${y}`,pass);height=.12;}
 if(height>.16){heights[y*GRID.columns+x]=height;rangeIds[y*GRID.columns+x]=range;mountainCells.push([x,y]);}
}
export const elevationAt=(x,y)=>heights[y*GRID.columns+x]??0;
export const passAt=(x,y)=>passMap.get(`${x},${y}`)??null;
export function terrainAt(x,y){const elevation=elevationAt(x,y),pass=passAt(x,y);return{elevation,pass,range:RANGES[rangeIds[y*GRID.columns+x]]??null,type:pass?'pass':elevation>=.7?'ridge':elevation>=.3?'slope':elevation>0?'foothill':'plain'};}
export function movementCost(unit,x,y,base=1){
 if(valleyWall(x,y))return Infinity;
 const t=terrainAt(x,y);if(t.pass)return Math.min(base,1.1);
 const vehicle=!!unit?.modelId||['commander','jammer','droneVehicle','fieldArtillery','katyusha','reconRadar','supplyTruck'].includes(unit?.role);
 if(vehicle&&t.elevation>=.7)return Infinity;
 if(t.elevation>=.7)return 2.6;
 if(t.elevation>=.3)return vehicle?2.5:1.7;
 if(t.elevation>0)return vehicle?1.8:1.3;
 return base<1&&!vehicle?.85:base;
}
function cube(p){const q=p.x-(p.y-(p.y&1))/2;return[q,-q-p.y,p.y]}
function roundCube(v){let [x,y,z]=v.map(Math.round);const d=v.map((a,i)=>Math.abs(a-[x,y,z][i]));if(d[0]>d[1]&&d[0]>d[2])x=-y-z;else if(d[1]>d[2])y=-x-z;else z=-x-y;return{x:x+(z-(z&1))/2,y:z};}
// Static topography permits a bounded geometry cache; unit state never enters this cache.
const sightCache=new Map();
export function terrainSight(a,b){
 const n=distance(a,b);if(n<=1)return true;
 const key=`${a.x},${a.y}:${b.x},${b.y}`;if(sightCache.has(key))return sightCache.get(key);
 const ac=cube(a),bc=cube(b),ah=elevationAt(a.x,a.y)+.22,bh=elevationAt(b.x,b.y)+.16;let visible=true;
 for(let i=1;i<n;i++){const t=i/n,p=roundCube(ac.map((v,j)=>v+(bc[j]-v)*t));if(elevationAt(p.x,p.y)>Math.max(.48,ah+(bh-ah)*t)+.05){visible=false;break}}
 if(sightCache.size>12000)sightCache.clear();sightCache.set(key,visible);return visible;
}
export function coverMultiplier(x,y,indirect=false){const h=elevationAt(x,y);return h>=.7?(indirect?.84:.76):h>=.3?(indirect?.92:.86):1;}
export function terrainDescription(x,y){if(valleyWall(x,y))return 'جرف محيط بالوادي · غير قابل للعبور البري؛ استخدم بوابة الوادي';const t=terrainAt(x,y);return t.pass?`${t.pass.name} · طريق عبور للمدرعات والإمداد`:t.type==='ridge'?'قمم صخرية · غطاء ورصد مرتفع · تعبرها المشاة فقط':t.type==='slope'?'سفوح جبلية · غطاء وحركة أبطأ':t.type==='foothill'?'تلال منخفضة · كلفة حركة إضافية':'أرض مفتوحة';}
