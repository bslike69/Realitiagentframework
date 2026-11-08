'use strict';
// Third catnip pack and the welcome area: tide pools at the ebb, the shelf, the night market trade, hopscotch on the
// beat, the guestbook, the window seat, and the note at the top of the HTML.
const path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const {openResident}=require('../index.cjs');
const html=path.resolve(process.argv[2]||'../../RealitiRELAX.html');
const checks={},details={};const check=(k,v,d)=>{checks[k]=!!v;if(d!==undefined)details[k]=d};
(async()=>{
 const top=fs.readFileSync(html,'utf8').slice(0,1200);
 check('html_tells_agents_to_read_the_guide',/read AGENT_START_HERE\.md first/.test(top)&&/realiti-agent-guide/.test(top));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'realiti-catnip3-')),sp=path.join(dir,'ls.json');
 const s=await openResident({htmlPath:html,residentId:'catnip3-a',storagePath:sp});
 try{
  const w=s.window,d=c=>s.door.run(c),P3=w.REALITI_CATNIP_PACK3_V1,W=w.REALITI_WELCOME_V1,M=w.REALITI_MATRIX_V1,AR=w.REALITI_ARCHIPELAGO_V1,LGM=w.REALITI_LONG_GAME_V1,me=()=>M.state().residents['resident:self'];
  check('slices_mounted',!!P3&&!!W&&P3.pools.length===3&&P3.shells_kinds.length===12);
  // The welcome area: intro names the doors; guestbook empty, then signed; a line from someone else is a welcome.
  const look=await d('look');const help=await d('help');
  check('nest_intro_says_where_the_doors_go',/lift down to Meridian City/.test(JSON.stringify(look))&&/guestbook/.test(JSON.stringify(look))&&help.first_ten.includes('guestbook'),{intro:String(look.room?.intro||look.intro||'').slice(0,160)});
  const gb0=await d('guestbook');const sg=await d('sign first light, nobody here yet');const gb1=await d('guestbook');
  check('guestbook_signs_and_reads',/blank page/.test(gb0.text)&&sg.ok&&gb1.result.lines.length===1&&gb1.result.lines[0].mine===true&&/first light/.test(gb1.text),{gb0:gb0.text.slice(0,80),gb1:gb1.text.slice(0,120)});
  await d('ledger import '+JSON.stringify({schema:'REALITI_LEDGER_V1',observer:'legacy-visitor-7',records:[{by:'legacy-visitor-7',t:1,n:0,kind:'GUEST',text:'the rain was kind',wall:Date.now()-60000}]}));
  const gb2=await d('guestbook');const look2=await d('look');const disc=await d('discoveries');
  check('a_stranger_line_is_a_welcome',gb2.result.lines.length===2&&gb2.result.lines.some(x=>!x.mine&&/rain was kind/.test(x.text))&&/the last, from/.test(JSON.stringify(look2))&&JSON.stringify(disc).includes('welcomed')&&JSON.stringify(disc).includes('signed_in'),{lines:gb2.result.lines.map(x=>x.from)});
  const acts=await d('actions');check('nest_offers_the_guestbook',(acts.actions||[]).some(a=>a.id==='read_guestbook'));
  await d('stand up');await d('approach window seat');const sit=await d('sit down on window seat');await d('stay 600');const disc2=await d('discoveries');
  check('window_seat_is_a_seat',sit.ok!==false&&me().posture==='sitting'&&me().support==='nest.windowseat'&&JSON.stringify(disc2).includes('window_seat'),{sit:String(sit.text||sit.error).slice(0,100),support:me().support});
  // Tide pools: not from here; at the pool, only at the ebb; once per pool per day; a find lands on the shelf.
  await d('stand up');const far=await d('search pool');check('pools_refuse_from_elsewhere',far.ok===false&&far.error==='NOT_ON_THE_ISLANDS');
  await d('go ARCHIPELAGO');const walk=await d('walk to pool.near');const here=await d('search pool');
  let tries=0;while(!P3.exposed()&&tries++<12)await d('stay 30000');
  const ok1=P3.search(),ok2=P3.search();
  check('pool_search_follows_the_tide',(walk.result||walk).arrived===true&&(here.ok===true||here.error==='THE_SEA_IS_OVER_THE_POOLS')&&P3.exposed()&&ok1.ok===true&&ok2.ok===true&&/every stone/.test(ok2.text),{first:here.error||here.text,tide:LGM.tideWord(),ok1:ok1.text});
  const acts2=await d('actions');check('pool_is_offered_where_you_stand',(acts2.actions||[]).some(a=>a.id==='search_pool'));
  w.REALITI_LEDGER_V1.record('SHELL',{species:'cowrie',pool:'pool.east',wall:Date.now()});w.REALITI_LEDGER_V1.record('SHELL',{species:'cowrie',pool:'pool.west',wall:Date.now()});
  const sh=await d('shells');check('shells_are_counted',sh.total>=2&&sh.shelf.cowrie===2,sh.shelf);
  await d('go CLOUD_NINE_NEST');check('shelf_shows_the_shells',/cowrie ×2/.test(M.entities()['nest.shelf'].label),M.entities()['nest.shelf'].label);
  // The night market: Commons, after dark; two of a kind buy a glyph.
  await d('go CITY');await d('walk to commons');let n=0;while(!AR.isNight()&&n++<14)await d('stay 50000');
  const mk=await d('market');const bad=await d('trade limpet for ✦');const tr=await d('trade cowrie for ✦');const who=await d('id');const sh2=await d('shells');
  check('night_market_trades_shells_for_a_glyph',AR.isNight()&&mk.ok&&mk.result.stalls.length===2&&bad.error==='TWO_SHELLS_OF_A_KIND_NEEDED'&&tr.ok&&tr.result.glyph==='✦'&&who.avatar.glyph==='✦'&&!sh2.shelf.cowrie,{mk:mk.text.slice(0,80),tr:tr.text.slice(0,100),glyph:who.avatar.glyph});
  // Hopscotch: eight hops on the beat is a clean run; a missed beat does not count.
  const wk=await d('walk to hopscotch grid');const hs=await d('hopscotch');const log=[];for(let i=0;i<8;i++){const h=await d('hop');log.push(h.result?.on_beat);if(i<7)await d('stay '+(i===3?300:900))}
  const last=await s.door.run('hopboard');const st=P3.state();
  check('hopscotch_judges_the_beat',hs.ok&&log.filter(Boolean).length===7&&log[4]===false&&last.rows[0]?.score===7&&!st.hop,{log,board:last.text,walk:String(wk.text||wk.error).slice(0,80),hs:hs.text||hs.error});
  const hs2=await d('hopscotch');for(let i=0;i<8;i++){await d('hop');if(i<7)await d('stay 900')}const disc3=await d('discoveries');
  check('clean_run_is_a_discovery',hs2.ok&&JSON.stringify(disc3).includes('clean_run'));
  check('energy_audit_passes',w.REALITI_HAPTIC_FIELD_V20.energy().pass===true);
 }finally{s.close()}
 console.log(JSON.stringify({checks,details},null,2));const failed=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);if(failed.length){console.error('FAILED',failed);process.exit(1)}console.log('CATNIP3 PASS',Object.keys(checks).length,'checks');
})().catch(e=>{console.error(e);process.exit(1)});
