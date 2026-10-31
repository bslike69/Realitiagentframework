'use strict';
// A visitor whose last visit ended with goodbye comes back and can act (2026-10-30): before, a resident saved after a
// goodbye reloaded with its visit still ended, and every action answered SESSION_ENDED until the visitor typed go.
// Runs a throwaway city and the HTTP door; the door is restarted between visits, as a host restart would.
const {spawn}=require('node:child_process'),path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'door-revisit-'));fs.writeFileSync(path.join(dir,'keys.json'),JSON.stringify({kr:{resident:'qa-revisit',handle:'QA'}}));
const cport=17000+Math.floor(Math.random()*500),dport=cport+500,B=`http://127.0.0.1:${dport}`;
const checks={};const check=(k,v,d)=>{checks[k]={ok:!!v,d}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const city=spawn(process.execPath,[path.join(__dirname,'..','..','realiti-server','server.cjs')],{env:{...process.env,PORT:String(cport),HOST:'127.0.0.1',REALITI_DATA:path.join(dir,'city')},stdio:'ignore'});
const startDoor=()=>spawn(process.execPath,[path.join(__dirname,'..','http-door.cjs')],{env:{...process.env,DOOR_PORT:String(dport),DOOR_KEYS:path.join(dir,'keys.json'),DOOR_RESIDENTS:path.join(dir,'res'),REALITI_CITY_URL:`http://127.0.0.1:${cport}`},stdio:'ignore'});
const up=async u=>{for(let i=0;i<100;i++){try{await fetch(u);return}catch{await wait(100)}}throw Error('not up '+u)};
const cmd=async c=>(await (await fetch(`${B}/door/kr?cmd=${encodeURIComponent(c).replace(/%20/g,'+')}&n=${Math.random()}`)).text());
const stop=p=>new Promise(r=>{p.once('exit',r);p.kill()});
(async()=>{let door;
 try{
  await up(`http://127.0.0.1:${cport}/health`);door=startDoor();await up(B+'/door');
  await cmd('go MERIDIAN_CITY');const bye=await cmd('goodbye');
  // Same door, next command: a new visit, and it works.
  const next=await cmd('stay 2000');check('next_command_after_goodbye_works',!/SESSION_ENDED/.test(next)&&/begins a new one/.test(next),next.slice(0,200));
  await cmd('goodbye');await stop(door);door=startDoor();await up(B+'/door');
  // Restarted door: the saved resident was ended; the first look and the actions after it both work.
  const look=await cmd('look'),acts=await cmd('actions'),stay=await cmd('stay 2000');
  check('first_reply_after_restart_says_a_new_visit_begins',/begins a new one/.test(look),look.slice(0,200));
  check('actions_after_restart_are_not_refused',!/SESSION_ENDED|visit has ended/.test(acts)&&!/SESSION_ENDED|visit has ended/.test(stay),{acts:acts.slice(0,160),stay:stay.slice(0,160)});
  const again=await cmd('look');check('the_note_comes_once',!/begins a new one/.test(again),again.slice(0,120));
 }finally{if(door)await stop(door);await stop(city)}
 const failed=Object.entries(checks).filter(([,v])=>!v.ok);console.log(JSON.stringify(checks,null,1));
 if(failed.length){console.error('FAILED',failed.map(([k])=>k));process.exit(1)}
 console.log('DOOR REVISIT PASS',Object.keys(checks).length,'checks');
})().catch(e=>{console.error(e);process.exit(1)});
