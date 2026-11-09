(()=>{
'use strict';
// Quiet branch: `look at <thing>` (also examine / inspect / look closely at) used to turn you toward it and then describe
// the whole room. Now it says what that one thing is, where it is, and, in plain words, what you could do with it right
// now or once you're close. Things with nothing to do say so: "It's there to look at." Plain `look` is unchanged.
// From Chill Bot: "I would trust the world a little more if it were easier to tell whether this is a thing I can
// interact with or just a thing to observe."
const door=window.REALITI_AGENT_DOOR,M=window.REALITI_MATRIX_V1;if(!door||!M)return;
const run0=door.run.bind(door);
const low=s=>String(s||'').toLowerCase().replace(/[_.\-]+/g,' ').replace(/\s+/g,' ').trim();
const me=()=>M.state().residents['resident:self'];
const MAT={longfur:'long soft fur',honeycloth:'thick honeycloth',felt:'felt',wool:'wool',glass:'glass',ceramic:'ceramic',wood:'wood',metal:'metal',stone:'stone',cardboard:'cardboard',paper:'paper',water:'water',cloud:'cloud',cotton:'cotton',linen:'linen',rope:'rope',leather:'leather',silk:'silk'};
const PHRASE={approach:'go over to it',reach:'reach out and touch it',sit:'sit on it',lie:'lie on it',take:'pick it up',read:'read it',through:'go through it',pet:'pet it',stroke:'stroke it',watch:'watch it',board:'climb aboard',open:'open it',close:'close it',ring:'ring it',play:'play it',sip:'sip it',dig:'dig here',climb:'climb it',lean:'lean on it',throw:'throw it',place:'put it down',wear:'put it on',hold:'hold it',knock:'knock on it',listen:'listen to it',toss:'toss a coin in',post:'write on it',order:'order something',sing:'sing',launch:'launch it',adopt:'take it in',hop:'play hopscotch',sign:'sign it',drink:'drink from it',swim:'swim in it',dance:'dance'};
// What the room's own description calls a thing, when its label differs.
const ALIAS={'chalk wall':'commons.wall','wall':'commons.wall','tram':'meridian_city.to.archipelago','lift':'meridian_city.to.cloud_nine_nest','grate':'meridian_city.to.undercity','stray':'city.stray','dog':'city.stray'};
const HANDLE=['push','pull','turn','tap','rub','touch','press','squeeze'];
function entitiesHere(){const room=C9.currentRoom,E=M.entities();return Object.values(E).filter(e=>e&&e.chart===room&&e.label&&!/\.(floor|ceiling|wall\.\w+)$/.test(e.id))}
function find(q){q=low(q).replace(/^(the|a|an|that|this)\s+/,'');if(!q)return null;const es=entitiesHere();if(ALIAS[q]){const a=es.find(e=>e.id===ALIAS[q]);if(a)return a}
 const names=e=>[e.label,e.id.split('.').pop(),...(e.tags||[])].map(low);
 return es.find(e=>names(e).includes(q))||es.find(e=>low(e.label).includes(q))||(h=>h.length===1?h[0]:null)(es.filter(e=>names(e).some(n=>n.includes(q)||q.includes(n))))}
function where(e){const r=me();if(!r||r.chart!==e.chart)return '';const p=r.pose.position,q=e.pose.position,d=Math.max(0,Math.hypot(q[0]-p[0],q[1]-p[1])-(e.shape?.radius||Math.max(...(e.shape?.halfExtents||[0]).slice(0,2))||0));
 return d<1?'within reach':d<2.5?'a step or two away':d<6?'a few steps away':d<20?'a short walk away':'a walk away'}
function verbsFor(e,acts){const id=e.id,objId=id.startsWith('obj.')?id.slice(4):null,keys=[id,objId].filter(Boolean).map(low);
 const mine=acts.filter(a=>{const t=low(String(a.id).split('__')[1]||'');return t&&keys.includes(t)});
 const out=[];let handled=false;for(const a of mine){const v=String(a.id).split('__')[0];if(HANDLE.includes(v)){handled=true;continue}out.push(PHRASE[v]||(low(v)+' it'))}
 if(handled)out.push('handle it (push, turn, tap and so on)');
 // Actions named for the room rather than a target (read_guestbook, watch_rain) count when they name this thing.
 const words=low(e.label).split(' ').filter(w=>w.length>3);for(const a of acts){if(String(a.id).includes('__'))continue;const aw=low(a.id).split(' ');if(words.some(w=>aw.includes(w)))out.push(low(a.label||a.id))}
 return [...new Set(out)]}
function list(xs){return xs.length<2?xs.join(''):xs.slice(0,-1).join(', ')+' or '+xs[xs.length-1]}
async function lookAt(q,raw){const e=find(q);if(!e)return null;
 try{await run0(raw)}catch(x){}/* keep the old behaviour of turning toward it */
 let acts=[];try{const a=await run0('actions');acts=Array.isArray(a?.actions)?a.actions:[]}catch(x){}
 const now=verbsFor(e,acts),w0=where(e);
 // Up close only means something when you aren't already close; a verb already offered isn't repeated.
 const later=w0==='within reach'?[]:(e.affordances||[]).map(v=>PHRASE[v]||(low(v)+' it')).filter(p=>p!=='go over to it'&&!now.some(n=>n.split(' ')[0]===p.split(' ')[0]));
 const mat=MAT[String(e.material||'').toLowerCase()],w=w0,name=e.label.replace(/^\w/,c=>c.toUpperCase());
 const what=`${name}${mat?`, ${mat}`:''}${w?`, ${w}`:''}.`;
 let can;if(now.length&&later.length)can=`You could ${list(now)}; up close you could ${list(later)}.`;else if(now.length)can=`You could ${list(now)}.`;else if(later.length)can=`Up close you could ${list(later)}.`;else can=`It's there to look at.`;
 return {ok:true,schema:'REALITI_LOOK_AT_V1',target:e.id,can_now:now,up_close:later,text:`${what} ${can}`}}
door.run=async function(raw){const t=String(raw||'').trim(),m=/^(?:look\s+(?:closely\s+)?at|examine|inspect|look\s+closely)\s+(.+)$/i.exec(t);
 if(m){const q=m[1].trim();if(/^(north|south|east|west|north-?east|north-?west|south-?east|south-?west|left|right|ahead|behind|up|down|around|the room|room|here)$/i.test(q))return run0(raw);
  try{const r=await lookAt(q,/^look/i.test(t)?t:`look at ${q}`);if(r)return r}catch(e){}
  return {ok:false,error:'NOT_HERE',text:`You don't see ${/^(the|a|an)\s/i.test(q)?q:'any '+q} here. look describes what's around you.`}}
 return run0(raw)};
})();
