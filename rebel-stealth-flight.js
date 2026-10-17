// AIR_BATTLE_STEALTH_SYSTEM_V2 — pure world-space flight planning.
// One geometry owns position, heading, distance and bomb release coordinates.
const TAU = Math.PI * 2;
export const TRAFFIC_STEP = .2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mod = v => {const a=((v % TAU)+TAU)%TAU;return a<1e-9||TAU-a<1e-9?0:a;};
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const ahead = (p, d) => ({x:p.x + Math.cos(p.heading) * d, y:p.y + Math.sin(p.heading) * d, heading:p.heading});

function segment(start, length, curvature, phase) {
  const end = curvature === 0 ? ahead(start, length) : {
    x:start.x + (Math.sin(start.heading + curvature * length) - Math.sin(start.heading)) / curvature,
    y:start.y + (Math.cos(start.heading) - Math.cos(start.heading + curvature * length)) / curvature,
    heading:start.heading + curvature * length
  };
  return {start:{...start}, end, length, curvature, phase};
}
function pushLine(list, start, length, phase) {
  const s = segment(start, length, 0, phase); list.push(s); return s.end;
}

// Common tangents between equal-radius turn circles. Long-turn aircraft use
// turn / straight / turn connections, never a pivot or an unconstrained spline.
export function turnConnections(start, end, radius, phase = 'ingress') {
  const paths = [];
  for (const first of [-1, 1]) for (const last of [-1, 1]) {
    const a = {x:start.x - Math.sin(start.heading)*first*radius, y:start.y + Math.cos(start.heading)*first*radius};
    const b = {x:end.x - Math.sin(end.heading)*last*radius, y:end.y + Math.cos(end.heading)*last*radius};
    const d = distance(a, b), lateral = (last-first)*radius;
    if (d < Math.abs(lateral) + 1e-6) continue;
    const tangent = Math.atan2(b.y-a.y, b.x-a.x) - Math.asin(clamp(lateral/d, -1, 1));
    const firstLength = mod((tangent-start.heading)*first)*radius;
    const lastLength = mod((end.heading-tangent)*last)*radius;
    const lineLength = Math.sqrt(Math.max(0, d*d-lateral*lateral));
    const list = [], arc = segment(start, firstLength, first/radius, phase);
    if (firstLength > 1e-6) list.push(arc);
    const line = segment(arc.end, lineLength, 0, phase);
    if (lineLength > 1e-6) list.push(line);
    const tail = segment(line.end, lastLength, last/radius, phase);
    if (lastLength > 1e-6) list.push(tail);
    if (distance(tail.end, end) > .01) throw new Error('Stealth tangent endpoint mismatch');
    paths.push(list);
  }
  if (!paths.length) {
    if (distance(start,end)<.01 && Math.abs(Math.sin(start.heading-end.heading))<1e-6) return [[]];
    throw new Error('No bounded-turn connection');
  }
  return paths;
}

function poseOnSegment(s, d) {
  d = clamp(d, 0, s.length);
  const pose = segment(s.start, d, s.curvature, s.phase).end;
  return {...pose, curvature:s.curvature, phase:s.phase};
}
function pathCost(path, options) {
  let cost = 0;
  for (const s of path) {
    cost += s.length;
    const steps = Math.max(1, Math.ceil(s.length/90)), ds = s.length/steps;
    for (let i=0;i<=steps;i++) {
      const p = poseOnSegment(s, s.length*i/steps), margin = 85;
      const outside = Math.max(0,margin-p.x,p.x-options.bounds.width+margin,margin-p.y,p.y-options.bounds.height+margin);
      cost += outside * ds * .22;
      if (options.approach === 'sead') for (const defense of options.defenses) {
        const proximity = Math.max(0, 1-distance(p,defense)/(defense.radius+options.cellSize));
        cost += proximity*proximity*ds*18;
      }
    }
  }
  return cost;
}
function connect(start, end, radius, phase, options) {
  let choices = turnConnections(start, end, radius, phase);
  if(options.firstTurn)choices=choices.filter(path=>!path.length||Math.sign(path.find(s=>s.curvature)?.curvature||options.firstTurn)===options.firstTurn);
  // Two optional side corridors are considered before flight, not every frame.
  if (!options.firstTurn && options.approach !== 'low' && distance(start,end)>radius*5) {
    const heading=Math.atan2(end.y-start.y,end.x-start.x);
    for (const side of [-1,1]) {
      const mid={x:(start.x+end.x)/2-Math.sin(heading)*radius*side,
        y:(start.y+end.y)/2+Math.cos(heading)*radius*side,heading};
      const best = (a,b) => turnConnections(a,b,radius,phase).sort((x,y)=>pathCost(x,options)-pathCost(y,options))[0];
      const via=[...best(start,mid),...best(mid,end)];
      choices.push(via);
    }
  }
  choices=choices.map(path=>({path, cost:pathCost(path,options)}));
  choices.sort((a,b)=>a.cost-b.cost);
  return choices[0].path;
}

function finalizeTrack(segments) {
  let length=0;
  for (const s of segments) {s.from=length; length+=s.length; s.to=length;}
  return {segments,length};
}
export function sampleTrack(track, d) {
  d=clamp(d,0,track.length);
  let lo=0,hi=track.segments.length-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(track.segments[mid].to<d)lo=mid+1;else hi=mid;}
  const s=track.segments[lo];
  return {...poseOnSegment(s,d-s.from),distance:d};
}
export function trackPath(track, phases) {
  const list=track.segments.filter(s=>!phases||phases.includes(s.phase));
  let d='';
  for(const s of list){
    if(!d)d='M'+s.start.x.toFixed(2)+' '+s.start.y.toFixed(2);
    if(!s.curvature)d+=' L'+s.end.x.toFixed(2)+' '+s.end.y.toFixed(2);
    else {
      // Split large arcs so SVG always uses the intended turn, including loops.
      const steps=Math.max(1,Math.ceil(s.length*Math.abs(s.curvature)/(Math.PI*.75)));
      for(let i=1;i<=steps;i++){const p=poseOnSegment(s,s.length*i/steps),r=1/Math.abs(s.curvature);d+=' A'+r.toFixed(2)+' '+r.toFixed(2)+' 0 0 '+(s.curvature>0?1:0)+' '+p.x.toFixed(2)+' '+p.y.toFixed(2);}
    }
  }
  return d;
}

function speedAt(profile,d) {
  const cruise=profile.cruise, {rollEnd,climbEnd,approachStart,touchdown,end}=profile.marks;
  if(d<rollEnd)return cruise*(.30+.54*smooth(d/rollEnd));
  if(d<climbEnd)return cruise*(.84+.16*smooth((d-rollEnd)/(climbEnd-rollEnd)));
  if(d>touchdown)return cruise*(.72-.54*smooth((d-touchdown)/(end-touchdown)));
  if(d>approachStart)return cruise*(1-.28*smooth((d-approachStart)/(touchdown-approachStart)));
  return cruise;
}
function buildTimeline(profile) {
  const ds=12,points=[{distance:0,time:0,speed:speedAt(profile,0)}];
  for(let d=ds;d<profile.track.length;d+=ds)points.push({distance:d});
  points.push({distance:profile.track.length});
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];b.speed=speedAt(profile,b.distance);b.time=a.time+2*(b.distance-a.distance)/(a.speed+b.speed);}
  profile.timeline=points;profile.duration=points.at(-1).time;
  profile.trafficSamples=Array.from({length:Math.ceil(profile.duration/TRAFFIC_STEP)+1},(_,i)=>sampleProfile(profile,Math.min(profile.duration,i*TRAFFIC_STEP)));
}
export function timeAtDistance(profile,d) {
  d=clamp(d,0,profile.track.length);
  const timeline=profile.timeline;let lo=0,hi=timeline.length-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(timeline[mid].distance<d)lo=mid+1;else hi=mid;}
  if(!lo)return 0;
  const a=timeline[lo-1],b=timeline[lo],accel=(b.speed-a.speed)/(b.time-a.time),delta=d-a.distance;
  return a.time+(Math.abs(accel)<1e-8?delta/a.speed:2*delta/(a.speed+Math.sqrt(Math.max(0,a.speed*a.speed+2*accel*delta))));
}
export function sampleProfile(profile,time) {
  const timeline=profile.timeline;time=clamp(time,0,profile.duration??timeline.at(-1).time);
  let lo=0,hi=timeline.length-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(timeline[mid].time<time)lo=mid+1;else hi=mid;}
  if(!lo)return {...sampleTrack(profile.track,0),speed:timeline[0].speed,altitude:0};
  const a=timeline[lo-1],b=timeline[lo],dt=time-a.time,accel=(b.speed-a.speed)/(b.time-a.time);
  const d=clamp(a.distance+a.speed*dt+.5*accel*dt*dt,a.distance,b.distance),pose=sampleTrack(profile.track,d),m=profile.marks;
  const altitude=d<m.climbEnd?smooth((d-m.rollEnd)/(m.climbEnd-m.rollEnd)):1-smooth((d-m.approachStart)/(m.touchdown-m.approachStart));
  return {...pose,speed:a.speed+accel*dt,altitude};
}

export function buildStealthPlan(input) {
  const cellSize=input.cellSize||180,scale=cellSize/180;
  const o={...input,cellSize,bounds:input.bounds||{width:7200,height:4080},defenses:input.defenses||[]};
  const count=clamp(input.count||1,1,4),bombCount=clamp(input.bombCount||5,1,5),spread=(input.spread||520)*scale;
  const runwayHeading=input.base.heading??(input.base.side==='red'?Math.PI:0),axis={x:Math.cos(runwayHeading),y:Math.sin(runwayHeading)};
  const runwayStart={x:input.base.x-axis.x*112,y:input.base.y+13-axis.y*112,heading:runwayHeading};
  const vertical=input.pattern==='vertical',nominal=vertical?Math.PI/2:0;
  const direction=(input.target.x-input.base.x)*Math.cos(nominal)+(input.target.y-input.base.y)*Math.sin(nominal)>=0?1:-1;
  const attackHeading=nominal+(direction<0?Math.PI:0),ux=Math.cos(attackHeading),uy=Math.sin(attackHeading),nx=-uy,ny=ux;
  const separation=240*scale,laneGap=260*scale,profiles=[];
  // Focused runs share the target axis, separated by the existing traffic scheduler.
  // Area runs retain lateral coverage but always include a lane through the aim point.
  const laneFor=i=>input.focused===true?0:(i-Math.floor((count-1)/2))*laneGap;
  // Pick one safe exit side for the wave, preserving each plane's own radius
  // and lane. Opposite turn directions would cross the other aircraft's runs.
  const exitChoices=[-1,1].map(side=>{
    let cost=0;
    for(let i=0;i<count;i++){
      const r=(500+i*12)*scale,lane=laneFor(i);
      const exit={x:input.target.x+nx*lane+ux*(spread/2+r*1.75),y:input.target.y+ny*lane+uy*(spread/2+r*1.75),heading:attackHeading};
      const home=ahead(runwayStart,-r*2.3),options={...o,firstTurn:side};
      cost+=pathCost(connect(exit,home,r,'return',options),options);
    }
    return{side,cost};
  }).sort((a,b)=>a.cost-b.cost);
  const returnTurn=exitChoices[0].side;
  for(let index=0;index<count;index++){
    const radius=(500+index*12)*scale,cruise=(190+[0,2,-2,1][index])*scale;
    const lane=laneFor(index);
    const first={x:input.target.x+nx*lane-ux*spread/2,y:input.target.y+ny*lane-uy*spread/2};
    const attackStart={x:first.x-ux*radius*.75,y:first.y-uy*radius*.75,heading:attackHeading};
    const segments=[],marks={};let p=pushLine(segments,runwayStart,224,'takeoff');marks.rollEnd=224;
    p=pushLine(segments,p,radius*.95,'climb');marks.climbEnd=marks.rollEnd+radius*.95;
    segments.push(...connect(p,attackStart,radius,'ingress',o));
    marks.attackStart=segments.reduce((n,s)=>n+s.length,0);
    const attackLength=radius*.75+spread+radius*.85;
    p=pushLine(segments,attackStart,attackLength,'attack');
    p=pushLine(segments,p,radius*.9,'egress');
    const approachStart=ahead(runwayStart,-radius*2.3);
    segments.push(...connect(p,approachStart,radius,'return',{...o,firstTurn:returnTurn}));
    marks.approachStart=segments.reduce((n,s)=>n+s.length,0);
    p=pushLine(segments,approachStart,radius*2.3,'approach');
    marks.touchdown=marks.approachStart+radius*2.3;
    pushLine(segments,p,224,'landing');
    const track=finalizeTrack(segments);marks.end=track.length;
    const profile={index,track,marks,radius,cruise,lane,separation,bombs:[],scale};
    buildTimeline(profile);
    for(let i=0;i<bombCount;i++){
      // Put a real release on the target station even with an even bomb count.
      // Every impact stays on its aircraft's straight attack track.
      const station=i-Math.floor(bombCount/2);
      const spacing=input.focused===true?Math.min(cellSize*.18,spread/Math.max(1,bombCount%2?bombCount-1:bombCount)):spread/Math.max(1,bombCount%2?bombCount-1:bombCount);
      const along=bombCount===1?spread/2:spread/2+station*spacing;
      const impactDistance=marks.attackStart+radius*.75+along;
      const impact=sampleTrack(track,impactDistance),releaseDistance=impactDistance-cruise*.8;
      profile.bombs.push({x:impact.x,y:impact.y,releaseDistance,releaseTime:timeAtDistance(profile,releaseDistance),fallTime:.8,index:i+1});
    }
    profiles.push(profile);
  }
  return {profiles,separation,runwayStart,runwayHeading,cellSize,scale,version:2};
}

// Closest relative position during a shared 200ms interval. The guard exceeds
// the rendered wingspan and includes sampling error on curved segments.
export function reservationConflict(a,b,separation) {
  const begin=Math.max(a.startTick,b.startTick),end=Math.min(a.startTick+a.profile.trafficSamples.length-1,b.startTick+b.profile.trafficSamples.length-1);
  if(begin>=end)return false;
  const limit=separation*separation;
  for(let tick=begin;tick<end;tick++){
    const ap=a.profile.trafficSamples[tick-a.startTick],an=a.profile.trafficSamples[tick-a.startTick+1];
    const bp=b.profile.trafficSamples[tick-b.startTick],bn=b.profile.trafficSamples[tick-b.startTick+1];
    const x=ap.x-bp.x,y=ap.y-bp.y,vx=an.x-bn.x-x,vy=an.y-bn.y-y,den=vx*vx+vy*vy;
    const t=den?clamp(-(x*vx+y*vy)/den,0,1):0;
    if((x+vx*t)**2+(y+vy*t)**2<limit)return true;
  }
  return false;
}
export function scheduleStealthPlan(plan,existing=[],now=0) {
  plan={...plan,profiles:[...plan.profiles].sort((a,b)=>timeAtDistance(a,a.marks.attackStart)-timeAtDistance(b,b.marks.attackStart))};
  const earliest=Math.ceil(now/TRAFFIC_STEP),gap=Math.ceil(2.5/TRAFFIC_STEP);
  const memo=new Map();
  const conflicts=(a,b)=>{
    const key=a.profile.index+':'+b.profile.index+':'+(a.startTick-b.startTick);
    if(!memo.has(key))memo.set(key,reservationConflict(a,b,plan.separation+8*plan.scale));
    return memo.get(key);
  };
  // Reserve a compact wave jointly. Greedily placing the first three can force
  // the fourth to wait through an entire return corridor.
  for(let horizon=gap*(plan.profiles.length-1);horizon<=110;horizon+=5){
    let visits=0;
    const search=(scheduled)=>{
      if(scheduled.length===plan.profiles.length)return scheduled;
      if(++visits>12000)return null;
      const index=scheduled.length,profile=plan.profiles[index];
      const low=index?scheduled.at(-1).startTick+gap:earliest;
      const high=index?earliest+horizon-gap*(plan.profiles.length-1-index):earliest;
      for(let tick=low;tick<=high;tick+=2){
        const candidate={profile,startTick:tick,startTime:tick*TRAFFIC_STEP};
        if(existing.some(other=>reservationConflict(candidate,other,Math.max(profile.separation,other.profile.separation)+8*plan.scale)))continue;
        if(scheduled.some(other=>conflicts(candidate,other)))continue;
        const result=search([...scheduled,candidate]);if(result)return result;
      }
      return null;
    };
    const result=search([]);if(result)return result;
  }
  // Busy airspace can require a longer queue; reserve it safely rather than
  // changing heading, teleporting or braking an aircraft already in flight.
  const scheduled=[];
  for(const profile of plan.profiles){
    let startTick=scheduled.length?scheduled.at(-1).startTick+gap:earliest;
    const others=[...existing,...scheduled];
    const candidate={profile,startTick};
    while(others.some(other=>reservationConflict(candidate,other,Math.max(profile.separation,other.profile.separation)+8*plan.scale)))candidate.startTick+=2;
    candidate.startTime=candidate.startTick*TRAFFIC_STEP;
    scheduled.push(candidate);
  }
  return scheduled;
}
