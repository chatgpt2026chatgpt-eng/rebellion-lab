import {beginMoraleRound} from '/rebel-morale.js';
import {distance,RANGES} from '/rebel-terrain.js';
const snapshot=b=>({turn:b.turn,units:b.units.filter(u=>u.side==='blue').map(u=>({id:u.id,x:u.x,y:u.y,strength:u.strength,role:u.role})),sites:b.sites.map(s=>({id:s.id,owner:s.owner,name:s.name}))});
export function startSituationRound(b){beginMoraleRound(b);b.situation??={archive:[],sorties:[]};b.situation.before=snapshot(b);}
export function recordSortie(b,order){if(!order)return;b.situation??={archive:[],sorties:[]};b.situation.sorties.push({turn:b.turn,craft:order.craftId,name:order.name,state:order.state,impacts:order.impacts?.length??0,damage:(order.impacts??[]).reduce((n,i)=>n+(i.damage??0),0)});b.situation.sorties=b.situation.sorties.slice(-80);}
export function finishSituationRound(b){
 const state=b.situation;if(!state?.before){startSituationRound(b);return null;}
 const old=state.before,lines=[],movements=new Map();let losses=0;
 for(const u of old.units){const now=b.units.find(v=>v.id===u.id);losses+=Math.max(0,u.strength-(now?.strength??0));if(!now||now.strength<=0||u.role==='supplyTruck'||distance(u,now)<2)continue;
  const locations=[...b.sites,...RANGES.map(r=>({name:r.name,...r.points.map(([x,y])=>({x,y})).sort((a,c)=>distance(a,now)-distance(c,now))[0]}))];
  const destination=locations.filter(p=>distance(now,p)<distance(u,p)).sort((a,c)=>distance(a,now)-distance(c,now))[0];if(destination)movements.set(destination.name,(movements.get(destination.name)??0)+1);
 }
 for(const s of b.sites){const before=old.sites.find(v=>v.id===s.id);if(before&&before.owner!==s.owner)lines.push(s.owner==='blue'?`ثبتت قواتنا السيطرة على ${s.name}.`:`فقدت قواتنا السيطرة على ${s.name}؛ الجبهة تحتاج إعادة تقييم.`);}
 for(const [name]of [...movements].sort((a,c)=>c[1]-a[1]).slice(0,3))lines.push(`عززت قواتنا تقدمها باتجاه ${name}؛ تواصل القيادة تقييم الموقف قبل إعلان أي تغير في السيطرة.`);
 const sorties=state.sorties.filter(s=>s.turn===b.turn),attacks=sorties.filter(s=>s.impacts>0),recon=sorties.filter(s=>s.craft==='rq7'&&s.state==='completed');
 if(attacks.length)lines.push(`نفذت القوة الجوية ضربات على مواقع العمليات المحددة. تقدير خسائر الخصم يُراجع استخباراتياً.`);
 if(recon.length)lines.push(`أنجزت وحدات الاستطلاع الجوي مهام رصد؛ نتائج الرصد في إحاطة الاستخبارات التالية.`);
 if(sorties.some(s=>s.state==='aborted'||s.state==='intercepted'))lines.push('لم تكتمل بعض الطلعات كما خُطط لها؛ سُجلت حالات اعتراض أو إلغاء في سجل الطيران.');
 if(losses)lines.push(`سجلت قواتنا خسائر خلال العمليات؛ تراجع القيادة سجلات الأفراد والآليات قبل اعتماد الحصيلة النهائية.`);
 if(!lines.length)lines.push('لم يسجل تغير في السيطرة أو تقدم واسع أو ضربة جوية مكتملة خلال الجولة. يستمر تقييم جاهزية الجبهة.');
 const report={turn:b.turn,lines,losses,events:lines.map((text,i)=>({id:b.turn+'-'+i,text})),movements:Object.fromEntries(movements),classification:'للقيادة السياسية · غير منشور',published:false};state.archive.push(report);state.archive=state.archive.slice(-50);return report;
}
// Publication is a decision distinct from the classified military assessment.
export function publishSituation(b,report,{indices=[],tone='formal'}={}){
 const selected=[...new Set(indices)].filter(i=>Number.isInteger(i)&&report.lines[i]);
 const lead=tone==='restrained'?'بيان مقتضب للقيادة العامة:':tone==='confident'?'تؤكد القيادة استمرار تنفيذ مهامها، وتعلن ما يأتي:':'أفادت القيادة العامة في بيانها العسكري:';
 report.official={turn:b.turn,tone,indices:selected,text:selected.length?lead+' '+selected.map(i=>report.lines[i]).join(' '):'لم يصدر بيان رسمي بشأن هذه الجولة.'};report.published=selected.length>0;
 const press=[];
 if(selected.length)press.push({source:'متابعة صحفية',text:'تناولت الصحف البيان الرسمي: '+report.lines[selected[0]]+' وتبقى تقديرات النتائج خاضعة للتحقق المستقل.'});
 // Leaks can mention only actual recorded events; a deterministic chance avoids reroll on reopening.
 const withheld=report.lines.map((text,i)=>({text,i})).filter(e=>!selected.includes(e.i));
 if(withheld.length&&(report.turn+(b.seed??0))%3===0)press.push({source:'مصادر ميدانية غير معلنة',text:'نقلت صحف عن مصادرها: '+withheld[0].text+' لم تؤكد الحكومة هذه الرواية علناً.'});
 if(!press.length)press.push({source:'الرصد الإعلامي',text:'لم تتوفر تغطية مستقلة موثوقة للمستجدات؛ تواصل الصحف طلب معلومات عن سير العمليات.'});
 report.press=press;return report;
}
let panel,timer,release=null,activeBattle,intelBattle=null;
export function holdIntelligence(b,active){intelBattle=active?b:(intelBattle===b?null:intelBattle);}
export function presentationPending(b){return (activeBattle===b&&!!release)||intelBattle===b;}
export function presentSituation(b,after){
 release=null;intelBattle=null;clearTimeout(timer);panel?.remove();
 const report=b.situation?.archive.at(-1)??{turn:0,classification:'للقيادة السياسية · غير منشور',lines:['رفعت القيادة الميدانية تقرير الجاهزية الافتتاحي؛ لم تبدأ بعد حصيلة العمليات.']};
 activeBattle=b;panel=document.createElement('aside');panel.className='intel-brief presidential-brief';panel.dir='rtl';panel.style.cssText='z-index:10195;max-height:46vh;overflow:auto;background:#102331;border-color:#c2a66b';
 const add=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;panel.append(n);return n;};
 const finish=()=>{clearTimeout(timer);panel?.remove();release=null;activeBattle=null;after();};release=finish;
 const showPress=()=>{clearTimeout(timer);panel.replaceChildren();add('strong','الرصد الصحفي · بعد البيان الرسمي');add('p',report.official.text);for(const item of report.press)add('p',item.source+': '+item.text);const next=add('button','متابعة إلى تقرير الاستخبارات');next.onclick=finish;timer=setTimeout(finish,15000);};
 add('strong','التقرير العسكري لرئاسة الحكومة · الجولة '+report.turn);add('small','اختر المعلومات التي تريد إعلانها؛ غير المحدد يبقى للقيادة.');
 const checks=report.lines.map(text=>{const row=add('label','');row.style.cssText='display:flex;gap:8px;margin:9px 0;align-items:start';const input=document.createElement('input');input.type='checkbox';input.checked=false;row.append(input,document.createTextNode(text));return input;});
 const tone=add('select','');tone.setAttribute('aria-label','صيغة البيان الرسمي');for(const [value,label]of [['formal','عسكري رسمي'],['restrained','مقتضب ومتحفظ'],['confident','واثق دون اختلاق انتصارات']]){const o=document.createElement('option');o.value=value;o.textContent=label;tone.append(o);}
 const send=add('button','اعتماد البيان ومتابعة الصحف');const publish=()=>{publishSituation(b,report,{indices:checks.flatMap((v,i)=>v.checked?[i]:[]),tone:tone.value});showPress();};send.onclick=publish;
 const withhold=add('button','تكتم ثم متابعة الصحف');withhold.onclick=()=>{checks.forEach(c=>c.checked=false);publish();};
 add('small','بعد ١٥ ثانية: متابعة بالتكتم إن لم تختَر النشر.');document.body.append(panel);timer=setTimeout(publish,15000);
 panel.addEventListener('change',()=>{clearTimeout(timer);timer=setTimeout(publish,15000);});
}
