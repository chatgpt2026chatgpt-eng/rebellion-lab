import {presentSituation,holdIntelligence} from './rebel-situation-reports.js';
import {reportsFor,orderIntel,communicationsState,MISSION_TYPES,officerState,observeVisible} from './rebel-intelligence.js';
import {LEADERS,engineerRepairJobs,queueEngineerRepair} from './rebel-campaign.js';
import {officerPortrait} from './rebel-officer-art.js';
import {distance} from './rebel-terrain.js';
let ctx,panel,brief,tab='reports',chosen=null,lastBattle,lastTurn=0,lastSignature='',briefTimer=null;
function e(tag,text,cls){const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;}
function button(text,fn,disabled=false){const n=e('button',text);n.type='button';n.onclick=fn;n.disabled=disabled;return n;}
function ready(){return ctx.battle.phase==='player'&&!ctx.busy()&&!ctx.battle.finished&&!window.__REBEL_LAB__?.automaticRunning?.();}
function draw(){if(!panel||panel.hidden)return;const b=ctx.battle,s=b.intelligence.blue;panel.replaceChildren();const head=e('header');head.append(e('strong','الاتصالات والاستخبارات'),button('إغلاق',()=>panel.hidden=true));panel.append(head);const nav=e('nav');for(const [id,label]of [['reports','التقارير'],['operations','العمليات'],['people','الضباط']])nav.append(button(label,()=>{tab=id;draw();}));const network=communicationsState(b,'blue');panel.append(e('p','شبكة الاتصالات: '+(network.online?'عاملة':'مضطربة · جمع محلي محدود')+' · عقد قيادة ورصد '+network.nodes+' · اتصالات '+network.profile.signals+'/4 · مصادر '+network.profile.human+'/4'));panel.append(nav,e('p','رصيد العمليات '+s.points+'/24 · '+s.missions.filter(m=>m.status==='active').length+'/2 مهمات · التقارير تقديرات قابلة للخطأ.'));
 if(tab==='reports'){
  const reports=reportsFor(b);if(!reports.length)panel.append(e('p','ابدأ تحليل اتصالات أو مهمة مصدر محلي، أو أرسل استطلاعاً.'));
  for(const r of reports.slice(0,30)){const card=e('article',null,'intel-card'+(chosen===r.id?' chosen':''));card.append(e('strong',r.name+(r.personId?' · شخصية قيادية':'')),e('p',r.source+' · الجولة '+r.turn+' · العمر '+r.age+' · ثقة '+r.confidence+'%'),e('p',r.status==='disproved'?'تقرير منقوض؛ لا يُعتمد عليه.':r.status==='observed'?'رصد سابق دقيق عند تسجيله؛ الموقع الحالي قد يختلف.':'منطقة محتملة ±'+r.uncertainty+' خلايا؛ ليست هدفاً مؤكداً.'));card.append(button('عرض المنطقة',()=>{chosen=r.id;ctx.focusPoint(r);ctx.setHint('معلومة من الجولة '+r.turn+'؛ الثقة '+r.confidence+'% وليست ضماناً.');draw();}),button('تدقيق',()=>run('verify',r.id),!ready()||r.status==='disproved'));if(r.personId||r.category==='command')card.append(button('تعقب الشخصية',()=>run('track',r.id),!ready()));panel.append(card);}
  const presidency=e('details');presidency.append(e('summary','إحاطات رئاسة الحكومة · غير منشورة'));for(const report of (b.situation?.archive??[]).slice().reverse()){presidency.append(e('p','الجولة '+report.turn+': '+report.lines.join(' ')));if(report.official)presidency.append(e('p',report.official.text));for(const news of report.press??[])presidency.append(e('p',news.source+': '+news.text));}panel.append(presidency);
  const audit=e('details');audit.append(e('summary','سجل أهداف المسيرات'));for(const shot of (b.droneStrikeAudit??[]).filter(s=>s.side==='blue').slice(-12).reverse())audit.append(e('p','الجولة '+shot.turn+' · الهدف '+shot.targetId+' · القطاع '+shot.x+'/'+shot.y+' · '+({flying:'في الطريق',impact:'وصلت إلى نقطة التكليف',intercepted:'اعتراض أو فقدان التوجيه'}[shot.state]??shot.state)));panel.append(audit);
  const archive=e('details');archive.append(e('summary','موجز العقيد سليم · الأرشيف'));for(const r of s.briefings.slice().reverse())archive.append(e('p','الجولة '+r.turn+': '+r.text));panel.append(archive);
 }else if(tab==='operations'){
  for(const [id,d]of Object.entries(MISSION_TYPES)){if(['verify','track'].includes(id))continue;const card=e('article',null,'intel-card');card.append(e('strong',d.name),e('p','الكلفة '+d.cost+' نقاط · '+d.duration+' جولات · '+(id==='security'?'تقلل احتمال اختراق الشبكة والتضليل.':id==='deception'?'ترفع احتمال وصول معلومات مضللة للخصم.':'المعلومة قد تفشل أو تكون مضللة؛ الاستطلاع مهم.')),button('بدء المهمة',()=>run(id),!ready()||s.points<d.cost));panel.append(card);}
  for(const m of s.missions.slice().reverse())panel.append(e('p',MISSION_TYPES[m.type].name+' · '+(m.status==='active'?'بانتظار الجولة '+m.due:m.result)));
  for(const [cell,result]of Object.entries(b.evidenceLedger?.blue??{}).filter(([,r])=>r.searches>0).slice(-10))panel.append(e('p','مسح القطاع '+cell+' · '+result.status+' · تقييم إعادة المسح بدءاً من الجولة '+result.reconAfter));
 }else{
  for(const [id,p]of Object.entries(b.intelligence.people.blue)){const l=LEADERS[id];if(!l)continue;const card=e('article',null,'intel-card officer-current');card.innerHTML=officerPortrait(id);card.append(e('strong',l.name+' · '+l.trait),e('p',l.text),e('p',({reserve:'احتياط؛ يمكن تعيينه من مقر القيادة',assigned:'مرتبط بقيادة على الخريطة',dead:'فُقد في القتال؛ لا يمكن إعادة تعيينه',captured:'أسير؛ غير متاح'}[p.status])+' · جولات خدمة '+(p.experience||0)));if(p.hostId){const host=b.units.concat(b.campaignAssets,b.logistics.depots).find(a=>a.id===p.hostId);if(host)card.append(button('موقع القيادة',()=>ctx.focusPoint(host)));}panel.append(card);}
  panel.append(e('p','تعقب قيادات الخصم يبدأ بتقرير قيادة. فقد الشخصية يؤثر في اختصاصها ويعطل التنسيق مؤقتاً؛ خليفتها شخصية مختلفة.'));
 }
}
function run(type,id){const r=orderIntel(ctx.battle,type,id);ctx.setHint(r.reason);draw();}
export function renderIntelligence(context){ctx=context;const b=ctx.battle;observeVisible(b,ctx.isUnitDetected);
 if(!panel){panel=e('section',null,'intel-panel');panel.id='intelPanel';panel.dir='rtl';panel.hidden=true;document.body.append(panel);brief=e('aside',null,'intel-brief');brief.id='intelBrief';brief.dir='rtl';brief.hidden=true;document.body.append(brief);const open=button('الاستخبارات',()=>{panel.hidden=!panel.hidden;if(!panel.hidden){brief.hidden=true;clearTimeout(briefTimer);holdIntelligence(ctx.battle,false);for(const r of ctx.battle.intelligence.blue.briefings)r.unread=false;document.getElementById('campaignPanel')?.setAttribute('hidden','');draw();}});open.id='openIntel';document.querySelector('.map-tools').append(open);}
 if(lastBattle!==b){lastBattle=b;lastTurn=0;panel.hidden=true;chosen=null;}
 if(!document.getElementById('roundReports')){const replay=button('تقارير الجولة',()=>showRoundBriefings(ctx.battle));replay.id='roundReports';document.querySelector('.map-tools').append(replay);}
 if(lastTurn!==b.turn&&b.phase==='player'){showRoundBriefings(b);lastTurn=b.turn;}

 const unread=b.intelligence.blue.briefings.filter(r=>r.unread).length;const openButton=document.getElementById('openIntel');if(openButton)openButton.textContent='الاستخبارات'+(unread?' · '+unread:'');
 const signature=b.turn+':'+b.intelligence.blue.points+':'+b.intelligence.blue.reports.length+':'+b.intelligence.blue.missions.length;if(!panel.hidden&&signature!==lastSignature){lastSignature=signature;draw();}
}
export function appendEngineerJobs(panel,b,u,context){if(u.kind!=='engineer'||u.side!=='blue')return;panel.append(e('p','الهندسة: عمل واحد بالجولة. إزالة اللغم المكتشف أولاً، ثم صيانة الوحدة أو المبنى. الشحنات تتجدد قرب الإمداد مقابل مخزونه.'));for(const job of engineerRepairJobs(b,u).slice(0,6)){const close=distance(u,job.a)<=2;panel.append(button((close?'إسناد إصلاح: ':'بعيد · ')+(job.a.name||job.a.id)+' · '+distance(u,job.a)+' خلايا',()=>{const r=queueEngineerRepair(b,u,job.id);context.setHint(r.reason);context.renderAll();},!close||u.fieldActionUsed||b.phase!=='player'||context.busy()));}}

function showRoundBriefings(b){
 clearTimeout(briefTimer);brief.hidden=true;holdIntelligence(b,false);
 presentSituation(b,()=>{if(ctx.battle!==b)return;const r=b.intelligence.blue.briefings.at(-1);
 const close=()=>{clearTimeout(briefTimer);brief.hidden=true;holdIntelligence(b,false);};
 brief.replaceChildren(e('strong','العقيد سليم · الجولة '+b.turn),e('p',r?.text||'لا تتوفر معلومات جديدة مؤكدة. يمكن تكليف الاستخبارات بمهمة جمع معلومات.'));
 brief.append(button('أرشيف الاستخبارات',()=>{close();panel.hidden=false;draw();}),button('متابعة',close));brief.hidden=false;holdIntelligence(b,true);briefTimer=setTimeout(close,15000);});
}
