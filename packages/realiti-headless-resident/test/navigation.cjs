'use strict';
// Quiet branch: getting around shouldn't take more tries than the place deserves. From Chill Bot's and Muse's visits:
// forgiving action names, words when a walk target isn't here, stones and the boat that walk you up, a carved pace
// length, and a near miss at the dig that says you're close.
const path=require('node:path'),os=require('node:os');
const {openResident}=require('../index.cjs');
const html=path.resolve(process.argv[2]||'../../RealitiRELAX.html');
const checks={},details={};const check=(k,v,d)=>{checks[k]=!!v;if(!v)details[k]=d};
const text=r=>String((r&&r.text)||'');
(async()=>{
 const s=await openResident({htmlPath:html,residentId:'nav-'+process.pid,storagePath:path.join(os.tmpdir(),`nav-${process.pid}.json`),presentation:'quiet',walkBudgetMs:''});
 const d=c=>s.door.run(c),W=s.window,M=W.REALITI_MATRIX_V1,AR=W.REALITI_ARCHIPELAGO_V1,LGM=W.REALITI_LONG_GAME_V1;
 const me=()=>M.state().residents['resident:self'];
 const tp=(x,y)=>{const r=me();r.pose.position=[x,y,AR.h(x,y)+.85];r.v=[0,0,0];r.intent=null;M.bump()};
 const dist=(id)=>{const e=M.entities()[id],p=me().pose.position;return Math.hypot(e.pose.position[0]-p[0],e.pose.position[1]-p[1])};
 try{
  // Words when a walk target isn't in this room.
  const far=await d('walk to teahouse');
  check('walk_target_elsewhere_has_words',/no teahouse here/.test(text(far))&&!/undefined/.test(text(far)),text(far));
  await d('go MERIDIAN_CITY');
  // Forgiving action names.
  const one=await d('act walk_to_teahouse');
  check('single_underscore_lands',one.ok!==false&&/Teahouse/.test(text(one)),text(one));
  const spaced=await d('act approach teahouse counter');
  check('spaces_land',spaced.ok!==false&&/counter/.test(text(spaced)),text(spaced));
  const shout=await d('act ORDER-TEA');
  check('case_and_dashes_land',shout.ok!==false&&/tea/i.test(text(shout)),text(shout));
  const vague=await d('act walk');
  check('several_matches_suggest',vague.ok===false&&/Did you mean: act walk_to__/.test(text(vague)),text(vague));
  const noise=await d('act fly to the moon');
  check('nothing_close_stays_plain',noise.ok===false&&!/Did you mean/.test(text(noise)),text(noise));
  const exact=await d('act walk_to__echo');
  check('exact_names_still_work',exact.ok!==false&&/Echo/.test(text(exact)),text(exact));

  // The islands: a stone you can see walks you up to it, and says how long a pace is.
  await d('go ARCHIPELAGO');
  const N=M.entities()['stones.north'].pose.position;tp(N[0]+20,N[1]-45);
  const before=dist('stones.north');let read=null,tries=0;
  while(tries<4){tries++;read=await d('act read_stone__north');if(/"\d+ paces"/.test(text(read)))break}
  check('reading_a_far_stone_walks_up',before>30&&/"123 paces"/.test(text(read)),{before,tries,t:text(read),r:read.result});
  check('stone_says_how_long_a_pace_is',/three quarters of a metre/.test(text(read)),text(read));
  check('took_at_most_two_calls',tries<=2,{tries});
  // A near miss says you're close.
  tp(396+5,-571+1);const near=LGM.dig();tp(396+30,-571+30);const away=LGM.dig();
  check('near_miss_says_close',/close by\. Not this hole, but not far/.test(near.text||'')&&/crab/.test(away.text||''),{near:near.text,away:away.text});

  // The boat: boarding from further off walks you to it.
  const B=M.entities()['harbor.boat'].pose.position;const home=AR.islandAt(B[0],B[1+0])||AR.islandAt(B[0],B[1]+20),cands=[];for(let a=0;a<32;a++){const th=a*Math.PI/16,x=B[0]+60*Math.cos(th),y=B[1]+60*Math.sin(th),isl=AR.islandAt(x,y);if(isl&&AR.h(x,y)>AR.h(B[0],B[1])+.6)cands.push({id:`${isl.id||isl.name}@${a}`,x,y})}
  if(cands.length){tp(cands[0].x,cands[0].y);const b0=dist('harbor.boat');let bd=null,bt=0;while(bt<4){bt++;bd=await d('board boat');if(/step down into the boat/.test(text(bd)))break}
   check('boarding_from_afar_walks_to_the_boat',b0>40&&/step down into the boat/.test(text(bd))&&bt<=2,{from:cands[0].id,b0,bt,t:text(bd)})}
  else check('boarding_from_afar_walks_to_the_boat',false,'no land 60 m from the boat');
 }catch(e){checks.crashed=false;details.crashed=String(e.stack||e)}
 finally{try{s.close()}catch(e){}}
 const failed=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
 console.log(JSON.stringify({ok:!failed.length,passed:Object.keys(checks).length-failed.length,total:Object.keys(checks).length,failed,details},null,1));
 process.exit(failed.length?1:0);
})();
