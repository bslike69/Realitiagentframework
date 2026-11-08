(()=>{
'use strict';
// The welcome area. Cloud Nine Nest is where every resident arrives, so it says where the doors go, keeps a guestbook on
// the shelf that every resident who ever passed can sign (GUEST records: the first thing a newcomer reads is the last
// line someone left), and has a seat under the rain window made for sitting and watching.
const M=window.REALITI_MATRIX_V1,LG=window.REALITI_LEDGER_V1,CAT=window.REALITI_CATNIP_V1,CT=window.REALITI_CITY_V1;if(!M||!LG||!CAT||!CT)return;
const NEST='CLOUD_NINE_NEST',room=()=>C9?.currentRoom,cp=x=>JSON.parse(JSON.stringify(x)),me=()=>M.state().residents['resident:self'],ent=()=>M.entities(),observer=()=>String(C9?.verticalContinuity?.observer||'local'),records=()=>(C9.ledger?.records||[]),mine=e=>e.by===observer(),handle=by=>CT.handle(by);
for(const [id,text] of Object.entries({signed_in:'You signed the guestbook in the Nest; the next resident reads your line first.',welcomed:'You read a line someone else left in the guestbook. You were not the first here.',window_seat:'You sat on the seat under the rain window and stayed.'}))CAT.register(id,text);
M.addEntity({id:'nest.windowseat',chart:NEST,position:[0,4.9,.25],shape:{kind:'BOX',halfExtents:[.7,.4,.25]},tags:['seat','support','soft'],collision:true,material:'blanket',affordances:['sit'],label:'window seat'});
M.addEntity({id:'nest.guestbook',chart:NEST,position:[-4.5,2,1.08],shape:{kind:'BOX',halfExtents:[.22,.16,.04]},tags:['book','guestbook','landmark'],collision:false,material:'paper',affordances:['read','sign'],label:'guestbook'});
const clean=(t,n)=>String(t||'').replace(/\s+/g,' ').trim().slice(0,n);
function lines(n=12){return records().filter(e=>e.kind==='GUEST'&&e.text).slice(-n).map(e=>({from:handle(e.by),mine:mine(e),text:e.text,minutes_ago:e.wall?Math.round((Date.now()-e.wall)/60000):null}))}
function sign(text){if(room()!==NEST)return {ok:false,error:'THE_GUESTBOOK_IS_IN_THE_NEST',hint:'go CLOUD_NINE_NEST'};const t=clean(text,160);if(t.length<2)return {ok:false,error:'WRITE_WHAT'};LG.record('GUEST',{text:t,wall:Date.now()});CAT.discover('signed_in');refreshIntro();return {ok:true,text:`You write in the guestbook: "${t}". It stays; whoever arrives next reads it.`}}
function guestbook(){const xs=lines(12);if(xs.some(x=>!x.mine))CAT.discover('welcomed');const total=records().filter(e=>e.kind==='GUEST').length;return {ok:true,schema:'REALITI_GUESTBOOK_V1',total,lines:xs,text:xs.length?`The guestbook on the shelf, ${total} line${total===1?'':'s'}: `+xs.map(x=>`${x.from}: "${x.text}"`).join(' · ')+'. sign <text> adds yours.':'The guestbook on the shelf is open at a blank page. sign <text> writes the first line.'}}
const BASE='A warm rain window, a giant cloud mattress, and blankets that are allowed to stay exactly where you leave them.';
function refreshIntro(){const sc=typeof C9SCENES!=='undefined'?C9SCENES[NEST]:null;if(!sc)return;const xs=lines(1),total=records().filter(e=>e.kind==='GUEST').length;sc.intro=`${BASE} The cloudfall door, north by the window, is where you arrived; a seat waits under the window. South, the Cardboard Box Workshop; east, the No-Ask Sanctuary; in the south-east corner, the lift down to Meridian City, where the others are. On the shelf, a guestbook${total?` with ${total} line${total===1?'':'s'}; the last, from ${xs[0].from}: "${xs[0].text}"`:', open at a blank page'}. Nothing here asks for a next step.`}
let sat=false;const adv=b7Advance;b7Advance=function(dt){const r=adv(dt);if(!sat&&room()===NEST){const b=me();if(b&&b.posture==='sitting'&&b.support==='nest.windowseat'){sat=true;CAT.discover('window_seat')}}return r};
const acts0=b4AgentActions;b4AgentActions=function(){const a=acts0();if(room()===NEST&&!a.some(x=>x.id==='read_guestbook'))a.push({id:'read_guestbook',label:'READ THE GUESTBOOK'});return a};
const verb0=c9verb;c9verb=function(r,verb){if(String(verb)==='read_guestbook'){c9count(r,verb);const res=guestbook();C9.b4=C9.b4||{};C9.b4.lastReceipt={type:'NEST_GUESTBOOK',room:room(),narrative:res.text,...res};try{c9save()}catch(e){}return true}return verb0(r,verb)};
const go0=b7AgentGo;b7AgentGo=function(v){const r=go0(v);if(room()===NEST)refreshIntro();return r};
const imp0=window.REALITI_LEDGER_V1.import;window.REALITI_LEDGER_V1=Object.freeze({...window.REALITI_LEDGER_V1,import:p=>{const r=imp0(p);refreshIntro();return r}});
refreshIntro();
window.REALITI_WELCOME_V1=Object.freeze({version:'1.0',sign,guestbook,lines,refreshIntro});
})();
