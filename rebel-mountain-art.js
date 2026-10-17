import {GRID,center,mountainCells,elevationAt,terrainAt,RANGES,PASSES,terrainDescription} from './rebel-terrain.js';
// Batched by row: the mountain field adds a few hundred static SVG nodes, not thousands of animated sprites.
export function drawMountainTerrain(el,parent,hexPolygon){
 const layer=el('g',{class:'rebel-massifs','pointer-events':'none','aria-label':'سلاسل جبلية وممرات؛ نفس خلايا الحركة والرصد'},parent);
 const rows=new Map();for(const [x,y]of mountainCells){if(!rows.has(y))rows.set(y,[]);rows.get(y).push({x,y});}
 for(const [y,cells]of rows){const batches={foot:[],shadow:[],sun:[],shade:[],facet:[],ridge:[],gully:[],scree:[],contour:[]};
  for(const c of cells){const origin=center(c.x,c.y),h=elevationAt(c.x,c.y),variant=(c.x*13+c.y*7)%11,p={x:origin.x+(variant%5-2)*8,y:origin.y+(variant%3-1)*9};
   const height=26+h*142,width=78+(variant%4)*5,peakX=p.x-19+(variant%4)*9,peakY=p.y-height*.62;
   const left=p.x-width,right=p.x+width,base=p.y+49,shoulderX=p.x+35,shoulderY=p.y-height*.09;
   batches.foot.push('M'+hexPolygon(c.x,c.y).map(q=>q.join(' ')).join('L')+'Z');
   if(h<.46){
    batches.facet.push(`M${left} ${base}Q${p.x-34} ${p.y-44*h} ${p.x+13} ${p.y-30*h}Q${p.x+54} ${p.y+11} ${right} ${base}Z`);
    batches.contour.push(`M${left+12} ${base-6}Q${p.x-27} ${p.y-30*h} ${p.x+19} ${p.y-16*h}M${left+33} ${base+9}Q${p.x} ${p.y+15} ${right-16} ${base+3}`);
    continue;
   }
   batches.shadow.push(`M${left+11} ${base+11}L${peakX+24} ${peakY+22}L${right+23} ${base+6}Z`);
   batches.sun.push(`M${left} ${base}L${p.x-52} ${p.y+2}L${peakX} ${peakY}L${shoulderX} ${shoulderY}L${right} ${base}L${p.x} ${base+7}Z`);
   batches.shade.push(`M${peakX} ${peakY}L${shoulderX} ${shoulderY}L${right} ${base}L${p.x+6} ${base-6}L${p.x+18} ${p.y+9}Z`);
   batches.facet.push(`M${left} ${base}L${p.x-52} ${p.y+2}L${p.x-16} ${p.y+29}L${p.x-27} ${base+3}ZM${shoulderX} ${shoulderY}L${p.x+44} ${base-7}L${right} ${base}Z`);
   batches.ridge.push(`M${p.x-52} ${p.y+2}L${peakX} ${peakY}L${shoulderX} ${shoulderY}M${peakX} ${peakY}L${p.x+18} ${p.y+9}L${p.x+6} ${base-6}`);
   batches.gully.push(`M${peakX-5} ${peakY+24}L${p.x-29} ${p.y-2}L${p.x-38} ${p.y+25}M${shoulderX-8} ${shoulderY+12}L${p.x+31} ${base-13}M${left+24} ${base-3}L${p.x-42} ${p.y+20}`);
   batches.scree.push(`M${p.x-33} ${p.y+30}l-9 8m23-15l-5 11m54 1l8 9m-17-5l4 6`);
   if(h<.45)batches.contour.push(`M${p.x-81} ${p.y+61}Q${p.x} ${p.y+28} ${p.x+87} ${p.y+57}`);
  }
  const row=el('g',{'data-mountain-row':y},layer);
  for(const [kind,paths]of Object.entries(batches))if(paths.length)el('path',{d:paths.join(' '),class:'massif-'+kind},row);
 }
 for(const range of RANGES){const mid=range.points[Math.floor(range.points.length/2)],p=center(mid[0],mid[1]);el('text',{x:p.x,y:Math.max(85,p.y-235),'text-anchor':'middle',class:'massif-name'},layer).textContent=range.name;}
 for(const pass of PASSES){const p=center(pass.x,pass.y),g=el('g',{'data-mountain-pass':pass.name},layer);
  el('path',{d:`M${p.x-60} ${p.y-38}l-21 38 21 38M${p.x+60} ${p.y-38}l21 38-21 38`,class:'massif-pass'},g);
  el('rect',{x:p.x-106,y:p.y+54,width:212,height:44,rx:12,class:'massif-pass-plaque'},g);
  el('text',{x:p.x,y:p.y+85,'text-anchor':'middle',class:'massif-pass-name'},g).textContent=pass.name;
 }
 return layer;
}
