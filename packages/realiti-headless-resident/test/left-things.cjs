'use strict';
// Quiet branch: things left for others cross between residents' copies; everything else stays in one copy.
// Three fresh residents (Maya, Grok, Muse) pass ledgers between them by hand, the way the city server does.
const path=require('node:path'),os=require('node:os');
const {openResident}=require('../index.cjs');
const html=path.resolve(process.argv[2]||'../../RealitiRELAX.html');
const checks={},details={};
const check=(k,v,d)=>{checks[k]=!!v;if(!v&&d!==undefined)details[k]=d};
let n=0;
async function fresh(name){const s=await openResident({htmlPath:html,residentId:'left-'+name+'-'+(n++),storagePath:path.join(os.tmpdir(),`left-test-${process.pid}-${n}.json`),presentation:'quiet',walkBudgetMs:'',});
 s.d=c=>s.door.run(c);s.W=s.window;s.W.REALITI_CITY_V1.setAvatar('name',name);s.C=s.W.eval('C9');s.me=String(s.C.verticalContinuity.observer);return s}
const text=r=>String((r&&r.text)||'');
const mine=s=>s.W.REALITI_LEDGER_V1.records().filter(e=>e.by===s.me);
const share=(from,to)=>to.W.REALITI_LEDGER_V1.import({records:mine(from)});
const LT=s=>s.W.REALITI_LEFT_THINGS_V1;
const objs=s=>s.C.b14.objects;

(async()=>{
 const maya=await fresh('Maya'),grok=await fresh('Grok'),muse=await fresh('Muse');
 try{
  for(const s of [maya,grok,muse]){share(s,maya);share(s,grok);share(s,muse)}
  // Bare `leave` no longer ends a visit; exit does.
  const bare=await maya.d('leave');
  check('bare_leave_asks_what',/Leave what/.test(text(bare))&&maya.W.Realiti.read('realiti://here').session!=='ended',text(bare));
  const alone=await maya.d('leave me alone');
  check('leave_me_alone_is_not_an_object',!/no me|to leave/i.test(text(alone)),text(alone));

  // Setting a thing down keeps it in your copy, and says so.
  await maya.d('act take__FELT-HAT-1');
  check('maya_carries_her_hat',objs(maya)['TESTER-HAT-1'].location==='CARRIED',objs(maya)['TESTER-HAT-1']);
  await maya.d('go meridian city');
  check('maya_in_the_city',maya.C.currentRoom==='MERIDIAN_CITY',maya.C.currentRoom);
  const put=await maya.d('act place__FELT-HAT-1');
  check('place_says_only_you_will_find_it',/Only you will find/.test(text(put))&&/leave hat/.test(text(put)),text(put));
  await maya.d('act take__FELT-HAT-1');
  const left=await maya.d('leave the hat here');
  check('leave_puts_it_in_every_copy',left.ok&&/every copy/.test(text(left)),left);
  const lm=LT(maya).list();
  check('maya_sees_it_as_hers',lm.length===1&&lm[0].mine&&!lm[0].taken_by&&objs(maya)['TESTER-HAT-1'].location==='GIVEN'&&Object.values(objs(maya)).some(o=>o.leftRef&&o.location==='MERIDIAN_CITY'),{lm,hat:objs(maya)['TESTER-HAT-1']});
  maya.C.b14.objects['TOKEN-M']={id:'TOKEN-M',label:'paper boat',aliases:['paper boat'],kind:'boat',material:'cardboard',location:'CARRIED',portable:true,state:{t:0}};
  const again=await maya.d('act place__TOKEN-M');
  check('no_hint_after_leave_is_known',!/Only you will find/.test(text(again)),text(again));

  // Grok's copy gets it once the records cross.
  share(maya,grok);await grok.d('go meridian city');
  const gl=Object.values(objs(grok)).find(o=>o.leftRef);
  check('grok_finds_mayas_hat',gl&&gl.location==='MERIDIAN_CITY'&&/Maya left/.test(gl.label),gl);
  const look=await grok.d('look');
  check('look_mentions_it',/Left here, in every copy of the world: small felt hat Maya left/.test(text(look)),text(look));
  const took=await grok.d("take maya's hat");
  check('grok_takes_it',gl&&objs(grok)[gl.id]?.location==='CARRIED'&&mine(grok).some(e=>e.kind==='TOOK'),{r:text(took),o:gl&&objs(grok)[gl.id]});
  check('grok_now_has_it_from_maya',gl&&/from Maya/.test(objs(grok)[gl.id]?.label),gl&&objs(grok)[gl.id]);

  // Maya's copy loses it, and she hears who took it.
  share(grok,maya);const told=await maya.d('look');
  check('gone_from_mayas_copy',!Object.values(objs(maya)).some(o=>o.leftRef),Object.values(objs(maya)).filter(o=>o.leftRef));
  check('maya_hears_grok_took_it',/Grok took the small felt hat you left/.test(text(told)),text(told));
  const told2=await maya.d('look');
  check('told_once',!/Grok took/.test(text(told2)));

  // Grok passes it on, for Muse only.
  const forMuse=await grok.d('leave hat for Muse');
  check('leave_for_one',forMuse.ok&&/only Muse can take it/.test(text(forMuse)),forMuse);
  share(grok,maya);share(grok,muse);await muse.d('go meridian city');
  const refused=await maya.d("take grok's hat");
  const ml=Object.values(objs(maya)).find(o=>o.leftRef);
  check('others_cannot_take_it',/waiting for Muse/.test(text(refused))&&ml&&ml.location==='MERIDIAN_CITY'&&!mine(maya).some(e=>e.kind==='TOOK'),{r:text(refused),ml});
  const mt=await muse.d("take grok's hat");
  const mo=Object.values(objs(muse)).find(o=>o.leftRef);
  check('muse_can',mo&&mo.location==='CARRIED',{r:text(mt),mo});

  // A race: Grok and Maya both take something Muse leaves; the earlier one keeps it.
  const mb=await muse.d("leave grok's hat");
  share(muse,grok);share(muse,maya);
  await grok.d('look');await maya.d('look');
  const gx=Object.values(objs(grok)).find(o=>o.leftRef&&/Muse left/.test(o.label)),mx=Object.values(objs(maya)).find(o=>o.leftRef&&/Muse left/.test(o.label));
  check('both_see_it',mb.ok&&gx&&mx,{mb:text(mb),gx,mx});
  await maya.d(`act take__${mx?.id}`);
  await new Promise(r=>setTimeout(r,5));
  await grok.d(`act take__${gx?.id}`);
  share(grok,maya);share(maya,grok);
  const gr=await grok.d('look'),mr=await maya.d('look');
  check('earlier_take_wins',objs(maya)[mx?.id]?.location==='CARRIED'&&!objs(grok)[gx?.id],{maya:objs(maya)[mx?.id],grok:objs(grok)[gx?.id]});
  check('later_taker_is_told',/just before you/.test(text(gr)),text(gr));

  // Caps: five things at a time.
  const extra=await fresh('Lots');share(maya,extra);await extra.d('go meridian city');
  const W=extra.W;for(let i=0;i<5;i++){extra.C.b14.objects['TOKEN-'+i]={id:'TOKEN-'+i,label:'pebble '+i,aliases:['pebble'+i],kind:'pebble',material:'cardboard',location:'CARRIED',portable:true,state:{t:0}}}
  const outs=[];for(let i=0;i<5;i++)outs.push((await extra.d('leave pebble'+i)).ok);
  extra.C.b14.objects['TOKEN-X']={id:'TOKEN-X',label:'pebble x',aliases:['pebblex'],kind:'pebble',material:'cardboard',location:'CARRIED',portable:true,state:{t:0}};
  const sixth=await extra.d('leave pebblex');
  check('five_at_a_time',outs.every(Boolean)&&!sixth.ok&&sixth.error==='LEFT_ENOUGH',{outs,sixth});
  const nothing=await extra.d('leave the city');
  check('leave_the_city_points_to_exit',/exit/.test(text(nothing))&&W.Realiti.read('realiti://here').session!=='ended',text(nothing));
  extra.close();

  // exit still ends a visit.
  await muse.d('exit');
  check('exit_ends_the_visit',muse.W.Realiti.read('realiti://here').session==='ended');
 }catch(e){checks.crashed=false;details.crashed=String(e.stack||e)}
 finally{for(const s of [maya,grok,muse])try{s.close()}catch(e){}}
 const failed=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
 console.log(JSON.stringify({ok:!failed.length,passed:Object.keys(checks).length-failed.length,total:Object.keys(checks).length,failed,details},null,1));
 process.exit(failed.length?1:0);
})();
