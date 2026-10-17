(()=>{
'use strict';
// Final Agent Door curator. Feature slices may add commands and help internally; this layer intentionally keeps the
// default resident foyer small and spoiler-light. The features still work, actions reveals what is relevant where the
// resident stands, and rooms remains the explicit exhaustive catalog.
const A0=window.Realiti,D0=window.REALITI_AGENT_DOOR,M=window.REALITI_MODES_V1;if(!A0||!D0)return;
const run0=D0.run.bind(D0),help0=D0.help.bind(D0),low=s=>String(s||'').replace(/\s+/g,' ').trim().toLowerCase();
function help(){
 const base=help0()||{},mode=M?.mode?.()||base.mode||'lq',guide=M?.worlds?.()||base.world_guide||null;
 return {
  schema:base.schema||'REALITI_HELP_V1',
  startup:base.startup||D0.startup||[],
  entry_contract:base.entry_contract||D0.entry_contract||null,
  exit:base.exit||{command:'goodbye',aliases:['bye','leave','exit']},
  mode,
  commands:[
   'look','where','nearby','actions','worlds','go <room>','act <action-id>',
   'feel','feel words','stay <ms>','listen','mode','home','goodbye','rooms  (full catalog)','say <text> (in the city) / city say <text> (anywhere)','chat','numbers on|off','discoveries [on|off]',
   mode==='hq'?'HQ controls: move / step / back / strafe / turn / heading / speed / crouch / pose':'LQ controls: explore / wander / auto / do <n>'
  ],
  first_ten:['help','look','feel words','stay 5000','where','actions','worlds'],
  world_guide:guide?{total_rooms:guide.total_rooms,groups:guide.groups,note:'Broad regions only. Most places and activities stay undisclosed until you encounter them or explicitly ask for rooms/actions.'}:null,
  note:'The foyer is intentionally incomplete. Use actions where you stand; ask rooms only when you want the full catalog.'
 };
}
// Quiet branch: what others said since your last reply arrives with this one (once each). Off in measured presentation.
function heard(r){const CT=window.REALITI_CITY_V1;if(!r||typeof r!=='object'||Array.isArray(r)||!CT?.hear||window.REALITI_MEASURE_V1?.on?.())return r;
 let xs=[];try{xs=CT.hear()}catch{}if(!xs.length)return r;
 const lines=xs.map(x=>x.line).join('\n');return {...r,heard:xs,text:(r.text?String(r.text)+'\n\n':'')+lines}}
// Quiet branch: an unknown place gets an answer in words (the public layer strips the room module's own text).
function unknownPlace(raw,r){const m=/^(?:go|enter|go to)\s+(.+)$/i.exec(String(raw||'').trim());if(!m||!r||r.error!=='ROOM_OUTSIDE_SLICE')return r;
 const want=m[1].replace(/^(the|a|an)\s+/i,'').trim(),CT=window.REALITI_CITY_V1,vk=CT?.venues&&Object.keys(CT.venues).find(k=>k===want.toLowerCase().replace(/\s+room$/,'')||CT.venues[k].label.toLowerCase()==='the '+want.toLowerCase());
 if(vk)return {...r,text:`${CT.venues[vk].label.replace(/^the /,'The ')} is in Meridian City: go MERIDIAN_CITY, then act walk_to__${vk}.`};
 const n=window.REALITI_ROOM_NEAR?.(want)||[];return {...r,...(n.length?{did_you_mean:n}:{}),text:`There is no place called "${m[1].trim()}"${n.length?`. Did you mean ${n.join(' or ')}?`:'. rooms lists every place.'}`}}
async function run(raw){window.REALITI_LAST_ACT_WALL=Date.now();if(low(raw)==='help')return help();return heard(unknownPlace(raw,await run0(raw)))}
D0.help=help;D0.run=run;
window.Realiti=Object.freeze({...A0,help,run});
window.REALITI_DOOR_CURATOR_V1=Object.freeze({version:'1.0',help});
})();