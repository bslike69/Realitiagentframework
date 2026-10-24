'use strict';
// Quiet branch acceptance: the world describes instead of measuring, announces nothing, keeps what happened, and the
// fixed upstream bugs stay fixed. Every check uses a fresh resident with its own storage file.
const path=require('node:path'),os=require('node:os');
const {openResident}=require('../index.cjs');
const html=path.resolve(process.argv[2]||'../../RealitiRELAX.html');
const checks={},details={};
const check=(k,v,d)=>{checks[k]=!!v;if(d!==undefined)details[k]=d};
let n=0;
// This suite tests the branch defaults, so it ignores REALITI_PRESENTATION / REALITI_WALK_BUDGET_MS from the environment.
async function fresh(opts={}){const s=await openResident({htmlPath:html,residentId:'quiet-'+(n++),storagePath:path.join(os.tmpdir(),`quiet-test-${process.pid}-${n}.json`),presentation:'quiet',walkBudgetMs:'',...opts});s.d=c=>s.door.run(c);return s}
const text=r=>String((r&&r.text)||'');

(async()=>{
 let s;
 // --- presentation
 s=await fresh();
 try{
  const help=await s.d('help'),worlds=await s.d('worlds');
  check('first_steps_do_not_route_the_visitor',Array.isArray(help.first_ten)&&!help.first_ten.includes('next')&&help.first_ten.includes('stay 5000'),help.first_ten);
  check('world_guide_has_no_reward_language',worlds.groups.every(g=>!/reward/i.test(g.title))&&!/checklist/i.test(worlds.note),worlds.groups.map(g=>g.title));
  const st=await s.d('stay 3000');
  check('nest_ambience_is_words_not_figures',/rain/i.test(text(st))&&!/\d/.test(text(st)),text(st));
  const where=await s.d('where');
  check('where_speaks_near_and_far',!/\(\s*-?\d/.test(text(where))&&!/ m /.test(text(where))&&/within reach|a step|a few steps|a short walk|a walk|a long way|under you/.test(text(where)),text(where));
  const acts=await s.d('actions');
  check('lab_benches_hidden_by_default',!acts.actions.some(a=>/^neuro_/.test(a.id)));
  await s.d('neuro labs on');const acts2=await s.d('actions');
  check('lab_benches_on_request',acts2.actions.some(a=>/^neuro_/.test(a.id)));
  await s.d('numbers on');const st2=await s.d('stay 1000');
  check('numbers_on_restores_figures',/%/.test(text(st2)),text(st2));
  await s.d('numbers off');
  await s.d('go FIREFLY_MEADOW');await s.d('act tap_along');let all='';for(let i=0;i<5;i++)all+=text(await s.d('stay 8000'));
  const disc=await s.d('discoveries');
  check('discoveries_do_not_count_what_is_left',!/ of \d+|to find/.test(text(disc))&&disc.total===undefined,text(disc));
  check('finds_are_kept_but_not_announced',!all.includes('✦')&&disc.found>=1,{found:disc.found,sample:all.slice(0,160)});
  s.window.REALITI_CATNIP_V1.discover('well_chord');const ev=text(await s.d('stay 500'));
  check('world_event_finds_arrive_as_plain_sentences',ev.includes('brass coin rolls up onto the rim')&&!ev.includes('✦'),ev);
  await s.d('discoveries on');s.window.REALITI_CATNIP_V1.discover('syzygy');const on=text(await s.d('stay 500'));
  check('discoveries_on_restores_banners',on.includes('✦ Discovery'),on);
 }finally{s.close()}

 // --- attention, worn places, taste
 s=await fresh();
 try{
  let got='';for(let i=0;i<3;i++){const r=await s.d('stay 10000');if(r.noticed)got=r.noticed}
  const look=await s.d('look');
  check('staying_still_lets_you_notice_more',!!got&&text(look).includes(got),{noticed:got});
  await s.d('go MERIDIAN_CITY');await s.d('act walk_to__teahouse');await s.d('act walk_to__teahouse');
  await s.d('act approach__teahouse.counter');const order=await s.d('order cocoa');const sip=await s.d('sip');
  check('drinks_have_a_taste',/sweet|chocolate|steam/.test(text(sip))&&!/°C/.test(text(sip))&&!/\d/.test(text(order)),{order:text(order),sip:text(sip)});
  let tn='';for(let i=0;i<3;i++){const r=await s.d('stay 10000');if(r.noticed)tn=r.noticed}
  check('the_city_is_noticed_where_you_stand',/kettle|bench|tidemark/.test(tn),{noticed:tn});
  const w=await s.d('who');
  check('who_does_not_list_a_roster',!/in the ledger|min ago/.test(text(w)),text(w));
  await s.d('act approach__teahouse.bench');const sits=[];for(let i=0;i<3;i++){sits.push(text(await s.d('act sit__teahouse.bench')));await s.d('stand up')}
  check('a_seat_you_return_to_keeps_your_shape',/hollow/.test(sits[2])&&!/hollow/.test(sits[0]),sits);
 }finally{s.close()}

 // --- kite in the fingers, grip as a brake
 s=await fresh();
 try{
  await s.d('go KITE_FIELD');await s.d('act launch_kite');await s.d('stay 8000');
  const b=s.publicApi.read('realiti://body'),z=(b.grounding?.z||[]).filter((x,i)=>b.grounding.m[i]);
  check('kite_line_reaches_the_fingers',z.includes('hand.L.fingers')&&z.includes('hand.R.fingers')&&z.includes('hand.L.palm'),z);
  const L0=s.window.REALITI_WONDER_V1.state().kite?.line_m??s.window.eval('C9.wonder.kite.L');
  await s.d('act let_it_run');for(let i=0;i<4;i++)await s.d('stay 5000');
  const L1=s.window.eval('C9.wonder.kite.L');
  check('an_eased_grip_lets_line_run',L1>L0,{L0,L1});
 }finally{s.close()}

 // --- bounded walks (B18), city arrival offset (B7), companions (B12)
 s=await fresh();
 try{
  await s.d('go ARCHIPELAGO');const w=await s.d('walk to cairn');
  check('long_walks_pause_and_say_how_far',w.result?.partial===true&&/still to go/.test(text(w))&&w.result.walked_m<120,text(w));
  await s.d('go MERIDIAN_CITY');const sp=s.publicApi.read('realiti://space').pose.position;
  check('city_arrival_is_offset_by_resident',Math.hypot(sp[0]-0,sp[1]+24)>1,sp);
  const ids=(await s.d('actions')).actions.map(a=>a.id);
  check('one_entry_per_action_id',ids.length===new Set(ids).size);
  check('doorway_labels_have_one_article',(await s.d('actions')).actions.filter(a=>/^through__/.test(a.id)).every(a=>!/THE THE|THE AN /.test(a.label)));
  const say=await s.d('say first we rest then we walk');
  check('then_inside_chat_is_not_a_command',say.ok!==false&&text(say).includes('then we walk'),text(say));
  const ch=await s.d('chat we rest then walk');
  check('then_inside_chat_command_is_not_split',ch.schema!=='REALITI_CHAIN_V1'&&ch.error!=='UNKNOWN_COMMAND',{schema:ch.schema,error:ch.error,text:text(ch)});
  const long=await s.d('say '+'z'.repeat(260));
  check('long_chat_says_it_was_cut',long.result?.truncated===true||/cut at 240/.test(text(long)),text(long).slice(-80));
  const th=await s.publicApi.invoke('through',{portal:'through__meridian_city.to.archipelago'});
  check('through_accepts_the_action_list_id',th.ok===true,th.error);
 }finally{s.close()}

 s=await fresh();
 try{
  await s.d('go MERIDIAN_CITY');await s.d('act walk_to__teahouse');await s.d('act walk_to__teahouse');await s.d('act approach__city.stray');
  await s.d('adopt Pip');const rel=await s.d('release Pip');const comp=await s.d('companion');
  check('a_companion_can_be_released',rel.ok!==false&&/curls up to sleep/.test(text(rel))&&/No companion/.test(text(comp)),{rel:text(rel),comp:text(comp)});
 }finally{s.close()}

 // --- remaining fixes
 s=await fresh();
 try{
  const a=await s.publicApi.invoke('act',{id:'watch_rain'});
  check('invoke_act_takes_its_advertised_id',a.ok!==false&&!!text(a),text(a));
  await s.d('go CARDBOARD_BOX_WORKSHOP');for(let i=0;i<3;i++)await s.d('act fold_flap');
  const tap=text(await s.d('act tap_box'));
  check('cardboard_crease_is_one_truth',/crease=0\.[1-9]/.test(tap),tap);
  await s.d('go BOTTOMLESS_PILLOW_SEA');await s.d('act dive');const v0=s.publicApi.read('realiti://here')&&s.window.REALITI_TRUST_V234.pillow().mode_value;await s.d('stay 5000');const v1=s.window.REALITI_TRUST_V234.pillow().mode_value;
  check('pillow_sea_settles_from_world_time_zero',v1<v0*.5,{v0,v1});
  const gb=await s.d('go bathhouse');
  check('a_partial_place_name_finds_its_room',gb.ok!==false&&/pool/.test(text(gb)),text(gb).slice(0,80));
  const gt=await s.d('go the teahouse');
  check('an_unknown_place_is_answered_in_words',/Meridian City/.test(text(gt)),text(gt));
  await s.d('go UNDERCITY');const u=await s.d('say hello');
  check('talking_in_the_dark_gets_an_answer',u.error!=='UNKNOWN_COMMAND'&&/come up to talk/.test(text(u)),u);
 }finally{s.close()}

 s=await fresh();
 try{
  await s.d('go ORRERY_LOFT');await s.d('act through__orrery_loft.to.lantern_maze');
  const offered=(await s.d('actions')).actions.map(a=>a.id).filter(x=>/^step_/.test(x));
  const step=offered.length?text(await s.d('act '+offered[0])):'';
  check('maze_doorway_entry_steps_are_real',offered.length>0&&/^You step/.test(step),{offered,step});
  const bad=await s.d('act step_west');
  check('a_refusal_never_borrows_old_narration',bad.ok===false&&!/^You step/.test(text(bad)),text(bad));
  await s.d('go GLASS_ORCHARD');await s.d('act scatter_seeds');await s.d('act read_orchard');await s.d('stay 8000');
  const bye=await s.d('goodbye');
  check('goodbye_has_its_own_words',/Your things stay where you left them/.test(text(bye))&&!/generation/.test(text(bye)),text(bye));
 }finally{s.close()}


 // Island and tram reports from Spark, Maya and chillbot (2026-10-23).
 s=await fresh();
 try{
  const sn=await s.d('say hello from the nest');
  check('say_works_outside_the_city',sn.ok!==false&&/hello from the nest/.test(text(sn)),text(sn));
  const sw=await s.d('stay a while');check('stay_in_plain_words',sw.ok!==false&&sw.error!=='UNKNOWN_COMMAND',sw.error||text(sw).slice(0,60));
  const uk=await s.d('flap wildly');check('unknown_command_answered_in_words',uk.error==='UNKNOWN_COMMAND'&&/Nothing here answers/.test(text(uk)),text(uk));
  await s.d('go MERIDIAN_CITY');await s.d('take the tram');
  const tl=await s.d('look'),tw=await s.d('walk to teahouse'),tj=(await s.d('journey')).result?.travelling;
  check('tram_look_describes_the_ride',/harbor tram/.test(text(tl)),text(tl).slice(0,80));
  check('tram_walk_is_refused_and_the_ride_goes_on',tw.error==='RIDING'&&tj===true,{walk:tw.error,travelling:tj});
  const so=await s.d('step off');check('tram_step_off',so.ok!==false&&(await s.d('journey')).result?.travelling===false&&s.publicApi.read('realiti://space').chart==='MERIDIAN_CITY',text(so));
  await s.d('go ARCHIPELAGO');
  const is=await s.d('say hello out here');check('island_say_is_speech',/hello out here/.test(text(is))&&!/HELLOOUTHERE/.test(text(is)),text(is));
  const wx=await s.d('walk to stones');check('walk_across_water_points_to_the_boat',wx.error==='ACROSS_THE_WATER'&&/boat/.test(text(wx)),text(wx));
  const AR=s.window.REALITI_ARCHIPELAGO_V1,me=s.window.REALITI_MATRIX_V1.state().residents['resident:self'];
  me.pose.position=[380,-481.5,AR.h(380,-481.5)+.9];
  const wh=text(await s.d('where')),ac=(await s.d('actions')).actions.map(a=>a.id);
  check('far_stones_stay_in_view',/east stone/.test(wh)&&/west stone/.test(wh)&&ac.some(x=>/stones\.east$/.test(x))&&ac.some(x=>/stones\.west$/.test(x)),{where:wh,actions:ac.filter(x=>/stones/.test(x))});
  const lk=text(await s.d('look'));check('island_look_names_the_island',/^Salt air on the Three Stones/.test(lk),lk.slice(0,80));
  {const bt=s.window.REALITI_MATRIX_V1.entities()['harbor.boat'].pose.position;me.pose.position=[bt[0],bt[1]+1.5,Math.max(AR.h(bt[0],bt[1]+1.5),0)+.9]}const bd=await s.d('board boat');
  const r1=await s.d('row to hollow'),b1=AR.state().boat;
  check('row_toward_hollow_does_not_ground_on_harbor',bd.ok!==false&&!/keel grinds/.test(text(r1))&&Math.hypot(b1.x,b1.y)>330,{board:text(bd),text:text(r1),boat:[b1.x,b1.y]});
 }finally{s.close()}

 // Crew bug hunt (2026-10-23): a visitor's `numbers on` only shows figures; the boat left at another island comes back.
 s=await fresh();
 try{
  await s.d('numbers on');
  const sn=await s.d('say hello with numbers on');check('numbers_on_keeps_say_anywhere',/hello with numbers on/.test(text(sn))&&sn.error!=='UNKNOWN_COMMAND',text(sn));
  const uk=await s.d('flap wildly');check('numbers_on_keeps_words_for_unknowns',/Nothing here answers/.test(text(uk)),text(uk));
  await s.d('numbers off');await s.d('go ARCHIPELAGO');
  const AR=s.window.REALITI_ARCHIPELAGO_V1,boat=s.window.eval('C9.chapter2.isle.boat');boat.x=300;boat.y=-470;
  const wb=await s.d('walk to boat');const b=AR.state().boat;
  check('keeper_returns_a_stranded_boat',Math.hypot(b.x-1.2,b.y-AR.shore_y+7)<3&&!/ground is in the way/.test(text(wb)),{text:text(wb),boat:[b.x,b.y]});
  // Codex review of PR #25: a journey through the advertised id keeps every mutation guard; "chat log ..." text is not a fixed form.
  await s.d('go MERIDIAN_CITY');const w0=s.publicApi.read('realiti://here').witness;await s.d('stay 2000');
  const stale=await s.publicApi.invoke('through',{portal:'through__meridian_city.to.archipelago',witness:w0});
  check('journey_keeps_the_witness_check',stale.ok===false&&stale.error==='STALE_OBSERVATION',stale.error);
  const cl=await s.d('chat log this then goodbye');
  check('chat_log_text_is_one_message',cl.schema!=='REALITI_CHAIN_V1'&&s.publicApi.read('realiti://here').session!=='ended',{schema:cl.schema,text:text(cl)});
  await s.d('goodbye');const after=await s.publicApi.invoke('through',{portal:'through__meridian_city.to.archipelago'});
  check('journey_refused_after_goodbye',after.ok===false&&after.error==='SESSION_ENDED',after.error);
  await s.d('go ARCHIPELAGO');
  const mp=text(await s.d('act island_map')).split('\n').filter(x=>/^\|/.test(x));check('island_map_rows_line_up',mp.length>0&&new Set(mp.map(x=>x.length)).size===1,mp.slice(0,3));
 }finally{s.close()}

 // Room acts that used to answer with bare data, and the Cloakroom form Muse thought it was stuck in (2026-10-24).
 const isProse=r=>{const t=text(r);return t.trim().length>20&&!/^\s*[\[{]/.test(t)&&!/"[a-z_]+":/.test(t)};
 s=await fresh();
 try{
  await s.d('go NINE_LIVES_ROOM');
  const nl=[];for(const id of ['fork_now','branch_a','branch_b','compare','commit_a'])nl.push(await s.d('act '+id));
  check('nine_lives_acts_speak',nl.every(isProse)&&/carries over/.test(text(nl[4])),nl.map(text));
  await s.d('go POCKET_FAMILIAR_HOUSE');
  const ph=[await s.d('act view_skeletons'),await s.d('act fault_receipt')];
  check('familiar_house_acts_speak',ph.every(isProse),ph.map(text));
  await s.d('go SHAPESHIFT_CLOAKROOM');
  const tf=await s.d('act try_form');check('try_form_says_how_back',/restore_form/.test(text(tf)),text(tf));
  const bench=[];for(const id of ['body_bench','attach_tail','map_paw','wiggle_pair','delay_pair'])bench.push(text(await s.d('act '+id)));
  check('bench_acts_do_not_borrow_the_form_sentence',bench.every(t=>t.length>20&&!/cloud form|Neuromesh/.test(t))&&new Set(bench).size===bench.length,bench);
  const rf=await s.d('act restore_form');const g=s.publicApi.read('realiti://body').grounding||{},soles=['foot.L.sole','foot.R.sole'].map(k=>g.m?.[g.z?.indexOf(k)]||0);
  check('restore_form_says_the_form_is_back_and_feet_ground',/own shape again/.test(text(rf))&&soles.every(m=>m>0),{text:text(rf),soles});
 }finally{s.close()}

 console.log(JSON.stringify({checks,details},null,2));
 const failed=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
 if(failed.length){console.error('FAILED',failed);process.exit(1)}
 console.log('QUIET PASS',Object.keys(checks).length,'checks');
})().catch(e=>{console.error(e);process.exit(1)});
