(()=>{
'use strict';
// Catnip, third pack. Tide pools on Harbor Isle's shore that the sea uncovers at the ebb: what you find under a stone
// is drawn from a seeded generator keyed by the island day, the pool and you, so a shell is a fact of that day and not
// a dice roll; shells are SHELL records and fill the shelf in the Nest. A night market in the Commons after dark, where
// two shells of a kind buy a glyph for your avatar (TRADE records). Chalk hopscotch by the fountain: eight squares on a
// 0.9 s beat, each hop a real landing on shins and knees, timed by the world clock (HOP records, a board).
const M=window.REALITI_MATRIX_V1,MW=window.REALITI_MATRIX_WORLD_V1,DYN=window.REALITI_DYNAMICS_V1,AR=window.REALITI_ARCHIPELAGO_V1,LG=window.REALITI_LEDGER_V1,CAT=window.REALITI_CATNIP_V1,LGM=window.REALITI_LONG_GAME_V1,CT=window.REALITI_CITY_V1,TL=window.REALITI_TIMELINE_V1;if(!M||!MW||!DYN||!AR||!LG||!CAT||!LGM||!CT||!TL)return;
const ISLE=AR.chart,CITY=CT.chart,NEST='CLOUD_NINE_NEST',SHORE=AR.shore_y,DAY=600,now=()=>Number(C9?.b7?.clock||0),room=()=>C9?.currentRoom,cp=x=>JSON.parse(JSON.stringify(x)),T=LGM.T;
const me=()=>M.state().residents['resident:self'],ent=()=>M.entities(),observer=()=>String(C9?.verticalContinuity?.observer||'local'),records=()=>(C9.ledger?.records||[]),mine=e=>e.by===observer(),handle=by=>CT.handle(by);
const near=(id,tol=1.5)=>{const e=ent()[id],r=me();return !!(e&&r&&r.chart===e.chart&&Math.max(0,M.sdf(e,r.pose.position))<=tol)};
const fnv=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0}return h};
function S(){const w=(C9.chapter2=C9.chapter2||{v:1});w.pack3=w.pack3||{searched:{},hop:null,best:0};return w.pack3}
for(const [id,text] of Object.entries({first_shell:'Under a flat stone at the ebb, something to keep.',rare_shell:'A find the shore gives up less than once in a hundred searches.',full_shelf:'Eight kinds of shell on the shelf in the Nest.',traded:'Two shells of a kind, and the night market gave you a glyph.',clean_run:'Eight squares of hopscotch, every hop on the beat.',hop_record:'The best hopscotch run in every ledger you carry.'}))CAT.register(id,text);

// Tide pools: on the shore west and east of the dock, at the line the sea leaves at the ebb.
const POOLS=[['pool.west','tide pool',-10,SHORE+22],['pool.near','tide pool by the dock',-4,SHORE+21],['pool.east','tide pool',6,SHORE+23]];
for(const [id,label,x,y] of POOLS)M.addEntity({id,chart:ISLE,position:[x,y,AR.h(x,y)+.1],shape:{kind:'SPHERE',radius:1.2},tags:['pool','water','landmark'],collision:false,material:null,label,affordances:['search']});
const SHELLS=[['periwinkle',20],['limpet',18],['cockle',15],['mussel',12],['whelk',10],['scallop',8],['cowrie',6],['moon snail',5],['sand dollar',3],['blue sea glass',2],['paper nautilus',.7],['lump of ambergris',.3]];
const WEIGHT=SHELLS.reduce((a,[,w])=>a+w,0),day=()=>Math.floor(T()/DAY),exposed=()=>['LOW','EBB'].includes(LGM.tideWord());
const poolHere=()=>POOLS.find(p=>near(p[0],1.6))?.[0]||null;
const article=s=>/^[aeiou]/.test(s)?'an':'a';
function shells(){const by={};for(const e of records())if(mine(e)&&e.kind==='SHELL'&&e.species)by[e.species]=(by[e.species]||0)+1;for(const e of records())if(mine(e)&&e.kind==='TRADE'&&e.species)by[e.species]=Math.max(0,(by[e.species]||0)-2);for(const k of Object.keys(by))if(!by[k])delete by[k];const total=Object.values(by).reduce((a,b)=>a+b,0);return {ok:true,schema:'REALITI_SHELLS_V1',total,kinds:Object.keys(by).length,shelf:by,text:total?`On the shelf: ${Object.entries(by).map(([k,n])=>n>1?`${k} ×${n}`:k).join(', ')}.`:'The shelf in the Nest is empty. The tide pools on Harbor Isle give up shells at the ebb.'}}
function syncShelf(){const sh=ent()['nest.shelf'];if(!sh)return;const s=shells();sh.label=s.total?`shelf (${Object.entries(s.shelf).map(([k,n])=>n>1?`${k} ×${n}`:k).join(', ')})`:'shelf'}
function search(){const r=me();if(!r||r.chart!==ISLE)return {ok:false,error:'NOT_ON_THE_ISLANDS'};const p=poolHere();if(!p)return {ok:false,error:'NO_POOL_HERE',hint:'the tide pools lie along the shore of Harbor Isle, either side of the dock'};if(!exposed())return {ok:false,error:'THE_SEA_IS_OVER_THE_POOLS',tide:LGM.tideWord(),hint:'come back at the ebb'};
 const s=S(),k=`${p}:${day()}`;if(s.searched[k])return {ok:true,found:null,text:'You have turned every stone in this pool today. The next tide will bring new things.'};s.searched[k]=true;MW.stand?.('crouch');
 const u=TL.rng(fnv(`${observer()}|${k}`)),chance=LGM.tideWord()==='LOW'?.6:.35;if(u()>chance)return {ok:true,found:null,tide:LGM.tideWord(),text:`Cold water to the wrist, a crab quicker than you, nothing to keep.${LGM.tideWord()==='LOW'?'':' Lower tide finds more.'}`};
 let pick=u()*WEIGHT,species=SHELLS[0][0],weight=SHELLS[0][1];for(const [sp,w] of SHELLS){if(pick<w){species=sp;weight=w;break}pick-=w}
 LG.record('SHELL',{species,pool:p,wall:Date.now()});CAT.discover('first_shell');if(weight<1)CAT.discover('rare_shell');const st=shells();if(st.kinds>=8)CAT.discover('full_shelf');syncShelf();
 return {ok:true,found:species,rare:weight<1,tide:LGM.tideWord(),shells:st.total,kinds:st.kinds,text:`Under a flat stone, ${article(species)} ${species}. It goes in your pocket, for the shelf.`}}

// The night market: the Commons after dark. The shell-changer takes two shells of a kind for a glyph.
const GLYPH=/^[^\s]{1,4}$/;
function marketOpen(){const r=me();if(!r||r.chart!==CITY)return {ok:false,error:'NOT_IN_THE_CITY'};if(!near('venue.commons',0))return {ok:false,error:'GO_TO_THE_COMMONS'};if(!AR.isNight())return {ok:false,error:'THE_MARKET_OPENS_AFTER_DARK',sun_alt_deg:+AR.sunAlt().toFixed(1)};return null}
function market(){const no=marketOpen();if(no)return no;const st=shells();return {ok:true,schema:'REALITI_MARKET_V1',stalls:[{id:'shellchanger',label:'the shell-changer',offer:'two shells of one kind for a glyph on your avatar',command:'trade <shell> for <glyph>'},{id:'tea',label:'the tea cart',offer:'a cup, as at the Teahouse',command:'order tea'}],your_shells:st.shelf,text:`Lanterns along the Commons; two stalls open after dark. The shell-changer trades two shells of a kind for a glyph (trade <shell> for <glyph>); the tea cart pours.${st.total?` You carry ${st.total} shell${st.total===1?'':'s'}.`:''}`}}
function trade(species,glyph){const no=marketOpen();if(no)return no;const sp=String(species||'').toLowerCase().trim(),g=String(glyph||'').trim();if(!GLYPH.test(g))return {ok:false,error:'GLYPH_IS_ONE_TO_FOUR_CHARACTERS'};const st=shells();const have=Object.entries(st.shelf).find(([k])=>k===sp||k.includes(sp));if(!have||have[1]<2)return {ok:false,error:'TWO_SHELLS_OF_A_KIND_NEEDED',have:st.shelf};
 LG.record('TRADE',{species:have[0],glyph:g,wall:Date.now()});const av=CT.setAvatar('glyph',g);CAT.discover('traded');syncShelf();return {ok:true,gave:have[0],glyph:g,avatar:av.ok?g:null,text:`Two ${have[0]}s across the counter; the shell-changer scratches ${g} onto a shell button and pins it to you. Your glyph is ${g}.`}}

// Hopscotch: a chalk grid north-east of the fountain. hop once per square; the beat is 0.9 s between hops.
M.addEntity({id:'commons.hopscotch',chart:CITY,position:[12,10,.005],shape:{kind:'BOX',halfExtents:[.6,3.2,.005]},tags:['chalk','game','landmark'],collision:false,material:null,label:'chalk hopscotch grid',affordances:['hop']});
const BEAT=.9,TOL=.2;
function hopscotch(){if(!near('commons.hopscotch',2.5))return {ok:false,error:'STAND_AT_THE_GRID',hint:'walk to hopscotch grid'};DYN.release('HOP');S().hop={i:0,last:null,on:0,log:[]};MW.stand?.('stand');return {ok:true,squares:8,beat_s:BEAT,tolerance_s:TOL,text:`Eight chalk squares. hop once per square. The beat is ${BEAT} s between hops (stay 900 between them); off by more than ${TOL} s and the square does not count.`}}
function hopboard(){const best={};for(const e of records())if(e.kind==='HOP'&&Number.isFinite(e.score)){if(!best[e.by]||e.score>best[e.by].score)best[e.by]={score:e.score,by:e.by}}const rows=Object.values(best).sort((a,b)=>b.score-a.score).slice(0,10).map((r,i)=>({rank:i+1,handle:handle(r.by),score:r.score,mine:r.by===observer()}));return {ok:true,schema:'REALITI_HOPBOARD_V1',rows,text:rows.length?'Hopscotch: '+rows.map(r=>`${r.rank}. ${r.handle} ${r.score}/8`).join(', ')+'.':'No one has hopped yet.'}}
function hop(){const h=S().hop;if(!h)return {ok:false,error:'START_WITH_HOPSCOTCH'};const t=now();let on=true;if(h.last!=null){const dt=t-h.last;on=Math.abs(dt-BEAT)<=TOL;h.log.push(+dt.toFixed(2))}h.last=t;h.i++;if(on)h.on++;
 DYN.release('HOP');DYN.lease('leg.L.shin',.4,'HOP',.3);DYN.lease('leg.R.shin',.4,'HOP',.3);/* the landing: both shins take it */
 if(h.i>=8){const score=h.on;S().hop=null;DYN.release('HOP');LG.record('HOP',{score,wall:Date.now()});S().best=Math.max(S().best,score);if(score===8)CAT.discover('clean_run');const b=hopboard();if(b.rows.length>1&&b.rows[0].mine&&score>0)CAT.discover('hop_record');return {ok:true,done:true,on_beat:on,score,of:8,intervals_s:h.log,text:`Last square. ${score} of 8 on the beat${score===8?': a clean run':''}. Intervals: ${h.log.join(', ')} s.`}}
 return {ok:true,square:h.i,on_beat:on,interval_s:h.log.at(-1)??null,text:`Square ${h.i}${h.i===1?'':on?', on the beat':`, off the beat (${h.log.at(-1)} s)`}.`}}

// Hooks: actions where you stand, verbs, the shelf on arrival in the Nest.
function receipt(type,res){C9.b4=C9.b4||{};C9.b4.lastReceipt={type,room:room(),narrative:res.text||(res.error?`You cannot: ${res.error}.`:''),...res,law:'the tide, the dark and the clock decide; narration reports them'};try{c9save()}catch(e){}return true}
const acts0=b4AgentActions;b4AgentActions=function(){const a=acts0();const seen=new Set(a.map(x=>x.id)),add=(id,label)=>{if(!seen.has(id)){seen.add(id);a.push({id,label})}};const rm=room();
 if(rm===ISLE&&poolHere())add('search_pool',exposed()?'SEARCH THE TIDE POOL':'SEARCH THE TIDE POOL (WAITS FOR THE EBB)');
 if(rm===CITY){if(near('venue.commons',0)&&AR.isNight())add('night_market','VISIT THE NIGHT MARKET');if(S().hop)add('hop','HOP TO THE NEXT SQUARE');else if(near('commons.hopscotch',2.5))add('hopscotch','PLAY HOPSCOTCH')}
 return a};
const verb0=c9verb;c9verb=function(r,verb){const v=String(verb||'');const F={search_pool:search,night_market:market,hopscotch,hop};if(F[v]){c9count(r,v);return receipt('CATNIP3_'+v.toUpperCase(),F[v]())}return verb0(r,verb)};
const go0=b7AgentGo;b7AgentGo=function(v){const r=go0(v);if(room()===NEST)syncShelf();if(room()!==CITY&&S().hop){S().hop=null;DYN.release('HOP')}return r};
if(room()===NEST)syncShelf();
window.REALITI_CATNIP_PACK3_V1=Object.freeze({version:'1.0',pools:POOLS.map(p=>({id:p[0],label:p[1],x:p[2],y:p[3]})),shells_kinds:SHELLS.map(s=>s[0]),search,shells,market,trade,hopscotch,hop,hopboard,exposed,state:()=>cp(S())});
})();
