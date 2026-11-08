(()=>{
'use strict';
// Quiet branch: things left for others. Every resident has their own copy of the world, so a cup set down in one copy
// is never seen in another. `leave <thing> [for <name>]` publishes the thing to the city's shared record instead (the
// same way trees, bottles, letters and the lighthouse lens already cross between copies). Every copy then has it where
// it was left, and the first resident to take it (or the one it was left for) has it, and it is gone from every other
// copy, the leaver's included. Only where a thing is crosses between copies; what is done to it stays in each copy.
const door=window.REALITI_AGENT_DOOR,LG=window.REALITI_LEDGER_V1,M=window.REALITI_MATRIX_V1,MW=window.REALITI_MATRIX_WORLD_V1;
if(!door||!LG||!M||!MW)return;
const CAP_EACH=5,CAP_ALL=48,HINTS=3;
const records=()=>(C9.ledger?.records||[]),observer=()=>String(C9?.verticalContinuity?.observer||'local');
const handle=by=>{try{return window.REALITI_CITY_V1?.handle?.(by)||('#'+String(by).slice(0,8))}catch(e){return '#'+String(by).slice(0,8)}};
const low=s=>String(s||'').replace(/\s+/g,' ').trim().toLowerCase();
const objs=()=>{const b=(C9.b14=C9.b14||{version:14,seq:0,history:[],links:[],stops:{},objects:null});return b.objects||{}};
const dyn=()=>{const s=M.state();s.object_positions=s.object_positions||{};return s.object_positions};
const rooms=()=>{try{return MW.world()}catch(e){return {}}};
const isRoom=id=>{if(typeof id!=='string'||!id)return false;if(rooms()[id])return true;try{const c=M.charts();return !!(Array.isArray(c)?c.some(x=>x===id||x?.id===id):c&&c[id])}catch(e){return false}};
function S(){const s=(C9.leftThings=C9.leftThings||{v:1,hints:0,used:false,notices:[],told:{}});s.notices=s.notices||[];s.told=s.told||{};return s}
const recId=e=>`${e.by}:${e.n}`,objId=e=>`LEFT-${String(e.by).slice(0,8).replace(/\W/g,'')}-${e.n}`;
const str=(x,n)=>typeof x==='string'?x.replace(/\s+/g,' ').trim().slice(0,n):'';
const sameName=(a,b)=>!!a&&!!b&&low(a).replace(/^[@#]/,'')===low(b).replace(/^[@#]/,'');
const iam=name=>sameName(name,handle(observer()))||sameName(name,String(observer()).slice(0,8));

// The shared record, read: each LEFT that is still valid, and who (if anyone) has taken it.
function valid(e){const w=e.what;return e.kind==='LEFT'&&typeof e.by==='string'&&Number.isFinite(e.n)&&w&&typeof w==='object'&&str(w.label,60)&&isRoom(e.room)}
function mayTake(L,by){return !L.for||by===L.by||sameName(L.for,handle(by))||sameName(L.for,String(by).slice(0,8))}
function ledgerState(){
 const lefts=[],took={};
 for(const e of records()){if(valid(e))lefts.push(e);else if(e.kind==='TOOK'&&typeof e.ref==='string')(took[e.ref]=took[e.ref]||[]).push(e)}
 const out=[];
 for(const L of lefts){const id=recId(L),ts=(took[id]||[]).filter(t=>mayTake(L,t.by)).sort((a,b)=>(a.wall||0)-(b.wall||0)||String(a.by).localeCompare(String(b.by))||a.n-b.n);out.push({L,id,obj:objId(L),winner:ts[0]?.by||null})}
 // A flood from one ledger can't fill the world: the latest few open things per resident, and a city-wide ceiling.
 const per={},open=out.filter(x=>!x.winner).reverse().filter(x=>(per[x.L.by]=(per[x.L.by]||0)+1)<=CAP_EACH).slice(0,CAP_ALL);
 const keep=new Set(open.map(x=>x.id));return out.filter(x=>x.winner||keep.has(x.id))}
function labelFor(L,mine){const what=str(L.what.label,60),who=handle(L.by);if(L.by===observer())return mine?what:`${what} you left${L.for?' for '+str(L.for,24):''}`;return mine?`${what} from ${who}`:`${what} ${who} left${L.for?' for '+str(L.for,24):''}`}
function aliasesFor(L){const base=[L.what.label,...(Array.isArray(L.what.aliases)?L.what.aliases:[]),L.what.kind].map(x=>str(x,40).toLowerCase()).filter(Boolean).slice(0,8);const who=low(handle(L.by)).replace(/^#/,'');
 return [...new Set(base.flatMap(a=>[a,`${who}'s ${a}`,`${who} ${a}`,`left ${a}`]))]}

// Bring this copy in line with the shared record. Returns nothing; anything worth telling goes into notices.
function reconcile(){
 const O=objs(),D=dyn(),me=observer(),s=S(),st=ledgerState(),live=new Set();
 for(const x of st){const {L,obj}=x;let o=O[obj];live.add(obj);
  if(!x.winner){
   if(!o){O[obj]=o={id:obj,label:labelFor(L,false),aliases:aliasesFor(L),kind:str(L.what.kind,24)||'thing',material:str(L.what.material,24)||'cardboard',location:L.room,portable:true,composable:false,leftRef:x.id,base:{label:str(L.what.label,60),aliases:(Array.isArray(L.what.aliases)?L.what.aliases:[]).map(x=>str(x,40)).filter(Boolean).slice(0,6)},state:{wear:0,orientation_deg:0,x:.5,support:'floor',t:Number(C9.b7?.clock||0)},left:{id:x.id,by:L.by,for:L.for||null}};
    if(Array.isArray(L.at)&&L.at.length===3&&L.at.every(Number.isFinite))D[obj]={chart:L.room,position:L.at.slice()};else delete D[obj]}
   else if(o.left&&o.location==='CARRIED'&&!o.left.took){
    if(mayTake(L,me)){LG.record('TOOK',{ref:x.id,wall:Date.now()});o.label=labelFor(L,true);delete o.left}
    else{o.location=L.room;if(Array.isArray(L.at)&&L.at.length===3)D[obj]={chart:L.room,position:L.at.slice()};s.notices.push(`That was left for ${str(L.for,24)}, so you set it back where it was.`)}}
  }else if(x.winner===me){if(o&&o.left){o.label=labelFor(L,true);delete o.left}}
  else{
   if(o){if(o.location==='CARRIED')s.notices.push(`Someone got to the ${str(L.what.label,60)} just before you; it isn't in your hands after all.`);delete O[obj];delete D[obj]}
   if(L.by===me&&!s.told[x.id]){s.told[x.id]=1;s.notices.push(`${handle(x.winner)} took the ${str(L.what.label,60)} you left.`)}}}
 // A left thing whose record is gone (or that fell outside the caps) leaves this copy too, unless it's in your hands.
 for(const [id,o] of Object.entries(O))if(o?.leftRef&&!live.has(id)&&o.location!=='CARRIED'){delete O[id];delete D[id]}
}

function resolveAccessible(q){q=low(q).replace(/^(the|a|an|my|your)\s+/,'');if(!q)return null;const room=C9.currentRoom,vals=Object.values(objs()).filter(o=>o&&(o.location==='CARRIED'||o.location===room)&&!o.state?.flight);
 const al=o=>[o.id,o.label,o.kind,...(o.aliases||[])].map(low);
 for(const pool of [vals.filter(o=>o.location==='CARRIED'),vals]){const ex=pool.filter(o=>al(o).includes(q));if(ex.length)return ex.find(o=>!o.left)||ex[0];const hits=pool.filter(o=>al(o).some(a=>a.includes(q)||q.includes(a)));if(hits.length===1)return hits[0]}
 return null}

function leave(rest){
 let raw=String(rest||'').replace(/\s+/g,' ').trim().replace(/\s+(here|behind|down|for others|for anyone|for whoever)$/i,''),forName=null;
 const m=/^(.+?)\s+for\s+(.+)$/i.exec(raw);if(m){raw=m[1];forName=str(m[2].replace(/^@/,'').replace(/\s+(here|behind)$/i,''),24)}
 let q=low(raw);
 q=q.replace(/\s+(here|behind)$/,'');
 const o=resolveAccessible(q),room=C9.currentRoom;
 if(!o){if(/^(the )?(city|room|world|here|now|place|nest|teahouse|island|islands|archipelago)\b/.test(q))return {ok:false,error:'LEAVE_WHAT',text:'To end your visit, exit. To go somewhere else, go <place>. leave is for things: leave <thing> sets it down where the others will find it.'};
  return {ok:false,error:'NOTHING_TO_LEAVE',text:`There's no ${q} with you or here to leave.`}}
 if(!room||!isRoom(room))return {ok:false,error:'NOWHERE_TO_LEAVE',text:'There is nowhere here to leave things for others.'};
 if(!o.portable)return {ok:false,error:'NOT_PORTABLE',text:`The ${o.label} stays where it is.`};
 if(o.left)return {ok:false,error:'ALREADY_LEFT',text:`The ${o.label} is already left here for whoever comes by.`};
 if((C9.b14?.links||[]).some(L=>(L.a===o.id||L.b===o.id)&&['ATTACHED','STACKED'].includes(L.type)))return {ok:false,error:'ATTACHED',text:`The ${o.label} is joined to something; separate it first.`};
 if(forName&&iam(forName))forName=null;
 const mineOpen=ledgerState().filter(x=>!x.winner&&x.L.by===observer()).length;
 if(mineOpen>=CAP_EACH)return {ok:false,error:'LEFT_ENOUGH',text:`You've left ${CAP_EACH} things around already. Once one of them is taken (or you take it back), you can leave another.`};
 const r=M.state().residents['resident:self'],D=dyn();let at=null;
 if(r&&r.chart===room)at=[+r.pose.position[0].toFixed(2),+r.pose.position[1].toFixed(2),.15];else if(D[o.id]?.chart===room&&Array.isArray(D[o.id].position))at=D[o.id].position.slice();
 const label=o.base?.label||String(o.label||o.kind),baseAliases=(o.base?.aliases||o.aliases||[]).slice(0,6);
 const e=LG.record('LEFT',{what:{label,aliases:baseAliases,kind:o.kind||'thing',material:o.material||null},room,at,for:forName||null,wall:Date.now()});
 // The thing itself leaves this copy: a starter object is marked given (so it isn't re-created), a received one goes.
 if(/^LEFT-/.test(o.id))delete objs()[o.id];else o.location='GIVEN';delete D[o.id];
 const s=S();s.used=true;reconcile();try{MW.sync()}catch(x){}try{c9save()}catch(x){}
 return {ok:true,schema:'REALITI_LEFT_V1',left:{id:recId(e),label,room,for:forName||null},text:forName?`You leave the ${label} here for ${forName}. It's in every copy of the city now, and only ${forName} can take it.`:`You leave the ${label} here. It's in every copy of the city now, and whoever comes by first can take it.`}}

function refuseFor(o){const L=o?.left;return L&&L.for&&L.by!==observer()&&!iam(L.for)?{ok:false,error:'LEFT_FOR_SOMEONE',text:`The ${o.label} is waiting for ${L.for}; you leave it where it is.`}:null}
function takeRewrite(raw){const t=String(raw||'').trim();
 const act=/^(?:act|do)\s+take__(\S+)$/i.exec(t);if(act){const k=Object.keys(objs()).find(k=>k.toLowerCase().replace(/_/g,'-')===act[1].toLowerCase().replace(/_/g,'-')),o=k&&objs()[k];return o?.left?(refuseFor(o)?{refuse:refuseFor(o)}:null):null}
 const m=/^(take|pick up|grab|get)\s+(.+)$/i.exec(t);if(!m)return null;
 const q=low(m[2]).replace(/^(the|a|an)\s+/,'').replace(/\s+(back|up|here)$/,''),room=C9.currentRoom,al=o=>[o.id,o.label,o.kind,...(o.aliases||[])].map(low);
 const here=Object.values(objs()).filter(o=>o&&o.location===room&&!o.state?.flight),match=o=>al(o).includes(q)||al(o).some(a=>a.includes(q)||q.includes(a));
 const lefts=here.filter(o=>o.left&&match(o)),own=here.filter(o=>!o.left&&match(o));if(!lefts.length)return null;
 const specific=/'s |^left |\bleft$| from /.test(q);
 const pick=specific?(lefts.find(o=>al(o).includes(q))||(lefts.length===1?lefts[0]:null)):(own.length?null:(lefts.length===1?lefts[0]:null));if(!pick)return null;
 const no=refuseFor(pick);return no?{refuse:no}:{raw:`act take__${pick.id}`}}

function carriedIds(){return new Set(Object.values(objs()).filter(o=>o&&o.location==='CARRIED'&&!o.left).map(o=>o.id))}
function addText(r,lines){if(!lines.length||!r||typeof r!=='object'||Array.isArray(r))return r;return {...r,text:(r.text?String(r.text)+'\n\n':'')+lines.join('\n')}}

const run0=door.run.bind(door);
door.run=async function(raw){
 const l=low(raw);try{reconcile();MW.sync()}catch(e){}
 if(l==='leave')return {ok:false,error:'LEAVE_WHAT',text:'Leave what? leave <thing> sets it down where the others will find it (leave <thing> for <name> keeps it for one of them). To end your visit, exit.'};
 if(/^leave\s+/.test(l)&&!/^leave\s+(me|us)\b/.test(l)){let r;try{r=leave(String(raw).trim().slice(6))}catch(e){r={ok:false,error:'LEAVE_FAILED',text:'It stays in your hands.'}}return addText(r,S().notices.splice(0))}
 let cmd=raw;try{const t=takeRewrite(raw);if(t?.refuse)return t.refuse;if(t?.raw)cmd=t.raw}catch(e){}
 const before=carriedIds();const r=await run0(cmd);const lines=[];
 try{reconcile();MW.sync();const s=S();lines.push(...s.notices.splice(0));
  const others=records().some(e=>e.by&&e.by!==observer());
  if(others&&!s.used&&s.hints<HINTS){const down=[...before].map(id=>objs()[id]).filter(o=>o&&o.location===C9.currentRoom);
   if(down.length){s.hints++;const o=down[0],word=(o.aliases||[])[0]||o.kind||'it';lines.push(`Only you will find the ${o.label} there; everyone has their own copy of the city. To leave it where the others will find it: leave ${word}.`)}}
  if(lines.length)try{c9save()}catch(e){}}catch(e){}
 if(/^(look|look around|l)$/.test(l)){const here=Object.values(objs()).filter(o=>o?.left&&o.location===C9.currentRoom).map(o=>o.label);if(here.length)lines.unshift(`Left here, in every copy of the world: ${here.join('; ')}.`)}
 return addText(r,lines)};

window.REALITI_LEFT_THINGS_V1=Object.freeze({version:'1.0',caps:{each:CAP_EACH,all:CAP_ALL},
 list:()=>ledgerState().map(x=>({id:x.id,label:str(x.L.what.label,60),by:handle(x.L.by),mine:x.L.by===observer(),room:x.L.room,for:x.L.for||null,taken_by:x.winner?handle(x.winner):null})),
 reconcile:()=>{reconcile();try{MW.sync()}catch(e){}return true}});
})();
