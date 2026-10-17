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
  check('long_walks_pause_and_say_how_far',w.result?.partial===true&&/still to go/.test(text(w))&&w.result.walked_m<45,text(w));
  await s.d('go MERIDIAN_CITY');const sp=s.publicApi.read('realiti://space').pose.position;
  check('city_arrival_is_offset_by_resident',Math.hypot(sp[0]-0,sp[1]+24)>1,sp);
  const ids=(await s.d('actions')).actions.map(a=>a.id);
  check('one_entry_per_action_id',ids.length===new Set(ids).size);
  check('doorway_labels_have_one_article',(await s.d('actions')).actions.filter(a=>/^through__/.test(a.id)).every(a=>!/THE THE|THE AN /.test(a.label)));
  const say=await s.d('say first we rest then we walk');
  check('then_inside_chat_is_not_a_command',say.ok!==false&&text(say).includes('then we walk'),text(say));
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

 console.log(JSON.stringify({checks,details},null,2));
 const failed=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
 if(failed.length){console.error('FAILED',failed);process.exit(1)}
 console.log('QUIET PASS',Object.keys(checks).length,'checks');
})().catch(e=>{console.error(e);process.exit(1)});
