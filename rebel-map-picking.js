// One hit-resolution path for air strikes, drone plans and artillery.
export function pickMapTarget(event,{svg,battle,centers,bases=[]}){
 const target=event.target,find=(attr,list)=>{const n=target.closest?.('['+attr+']');return n?(list??[]).find(x=>x.id===n.getAttribute(attr)):null;};
 const facility=find('data-campaign-id',battle.campaignAssets);if(facility)return {x:facility.x,y:facility.y,id:'campaign:'+facility.id,facility};
 const unit=find('data-unit-id',battle.units);if(unit)return {x:unit.x,y:unit.y,id:unit.id,unit};
 const base=find('data-drone-base-id',battle.droneBases);if(base)return {x:base.x,y:base.y,id:'baseTarget:'+base.id,base};
 const radar=find('data-ad-id',battle.airDefenses);if(radar)return {x:radar.x,y:radar.y,id:'radar:'+radar.id,radar};
 const depot=find('data-depot-id',battle.logistics?.depots);if(depot)return {x:depot.x,y:depot.y,id:'depot:'+depot.id,depot};
 const refinery=find('data-refinery-id',battle.refineries);if(refinery)return {x:refinery.x,y:refinery.y,id:'cell:'+refinery.x+':'+refinery.y,refinery};
 const airbase=find('data-airbase-id',bases);if(airbase)return {x:airbase.x,y:airbase.y,base:airbase};
 let x,y;const building=target.closest?.('[data-building-x][data-building-y]'),cell=target.closest?.('[data-x][data-y]');
 if(building){x=+building.dataset.buildingX;y=+building.dataset.buildingY;}else if(cell){x=+cell.dataset.x;y=+cell.dataset.y;}else{
 const matrix=svg.getScreenCTM();if(!matrix)return null;const p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;const q=p.matrixTransform(matrix.inverse());
 const row=Math.round((q.y-104)/156);let best=Infinity;for(let yy=Math.max(0,row-1);yy<=Math.min(centers.length-1,row+1);yy++){const xx=Math.round(q.x/(Math.sqrt(3)*104)-.5-(yy%2)*.5);for(let col=Math.max(0,xx-1);col<=Math.min(centers[yy].length-1,xx+1);col++){const c=centers[yy][col],d=Math.hypot(c.x-q.x,c.y-q.y);if(d<best){best=d;x=col;y=yy;}}}if(best>110)return null;
 }
 if(!Number.isInteger(x)||!Number.isInteger(y)||!centers[y]?.[x])return null;
 const site=battle.sites.find(s=>s.structureTiles?.some(t=>t.x===x&&t.y===y));return{x,y,id:site?'site-tile:'+site.id+':'+x+':'+y:'cell:'+x+':'+y};
}
