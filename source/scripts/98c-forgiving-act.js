(()=>{
'use strict';
// Quiet branch: action names come in several spellings (order_tea, walk_to__echo, approach__nest.windowseat,
// take__FELT-HAT-1), and a resident who copies one slightly wrong is told it isn't possible. When `act <name>` misses,
// compare it to what is actually available ignoring case, spaces, underscores, dashes and dots: one match runs, several
// get "did you mean". Also gives `walk to <somewhere not here>` words instead of nothing.
const door=window.REALITI_AGENT_DOOR;if(!door)return;
const norm=s=>String(s||'').toLowerCase().replace(/[\s._\-:]+/g,' ').trim();
const toks=s=>norm(s).split(' ').filter(t=>t&&!['the','a','an','to','at','of'].includes(t));
const run0=door.run.bind(door);
async function available(){try{const a=await run0('actions');return Array.isArray(a?.actions)?a.actions.filter(x=>x&&x.id):[]}catch(e){return []}}
function pick(q,acts){
 const nq=norm(q);if(!nq)return {};
 const exact=acts.filter(a=>norm(a.id)===nq||norm(a.label)===nq);if(exact.length===1)return {one:exact[0]};
 const tq=toks(q);if(!tq.length)return {};
 const scored=acts.map(a=>{const hay=toks(a.id+' '+(a.label||''));const hit=tq.filter(t=>hay.includes(t)).length;return {a,hit,all:hit===tq.length,extra:hay.length-hit}}).filter(x=>x.hit>0).sort((p,q2)=>(q2.all-p.all)||(q2.hit-p.hit)||(p.extra-q2.extra));
 const full=scored.filter(x=>x.all);
 if(full.length===1)return {one:full[0].a};
 if(full.length>1&&full[0].extra<full[1].extra&&full[0].extra===0)return {one:full[0].a};
 // Suggest only what covers what was asked: every word, or all but one of three or more. A lone verb match is noise.
 const near=full.length?full:scored.filter(x=>tq.length>=3&&x.hit>=tq.length-1);
 return {maybe:near.slice(0,3).map(x=>x.a)}}
door.run=async function(raw){
 const t=String(raw||'').trim(),m=/^(act)\s+(.+)$/i.exec(t);
 const r=await run0(raw);
 try{
  if(m&&r&&r.ok===false&&r.error==='ACTION_UNAVAILABLE'){
   const acts=await available(),p=pick(m[2],acts);
   if(p.one&&p.one.id!==m[2])return await run0(`act ${p.one.id}`);
   if(p.maybe&&p.maybe.length)return {...r,suggestions:p.maybe.map(a=>a.id),text:`That is not something you can do from here. Did you mean: ${p.maybe.map(a=>`act ${a.id}`).join(', ')}?`}}
  if(r&&r.ok===false&&r.error==='TARGET_NOT_HERE'&&(!r.text||r.text==='undefined')){let w=(/^(?:walk|go|head)\s+(?:to\s+)?(.+)$/i.exec(t)||[])[1];if(!w&&/^__space__\s/.test(t)){try{w=JSON.parse(t.slice(10))[1]?.target}catch(e){}}w=String(w||'that place').replace(/[_.]+/g,' ');return {...r,text:`There's no ${w} here to walk to. If it's somewhere else, go there first; rooms lists the places you can go.`}}
 }catch(e){}
 return r};
})();
