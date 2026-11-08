'use strict';
// Things left for others, end to end: a throwaway city server and the HTTP door with two visitors. Maya leaves her hat;
// it reaches Grok's copy through the city, Grok takes it, and Maya hears so. Nothing is passed by hand.
const {spawn}=require('node:child_process'),path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'left-live-'));fs.writeFileSync(path.join(dir,'keys.json'),JSON.stringify({km:{resident:'qa-maya',handle:'Maya'},kg:{resident:'qa-grok',handle:'Grok'}}));
const cport=18000+Math.floor(Math.random()*500),dport=cport+500,B=`http://127.0.0.1:${dport}`;
const checks={};const check=(k,v,d)=>{checks[k]={ok:!!v,d}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const city=spawn(process.execPath,[path.join(__dirname,'..','..','realiti-server','server.cjs')],{env:{...process.env,PORT:String(cport),HOST:'127.0.0.1',REALITI_DATA:path.join(dir,'city'),SERVER_PASSWORD:'qa-pass'},stdio:'ignore'});
const door=spawn(process.execPath,[path.join(__dirname,'..','http-door.cjs')],{env:{...process.env,DOOR_PORT:String(dport),DOOR_KEYS:path.join(dir,'keys.json'),DOOR_RESIDENTS:path.join(dir,'res'),REALITI_CITY_URL:`http://127.0.0.1:${cport}`,REALITI_PASSWORD:'qa-pass'},stdio:'ignore'});
const up=async u=>{for(let i=0;i<150;i++){try{await fetch(u);return}catch{await wait(100)}}throw Error('not up '+u)};
const cmd=async(k,c)=>(await (await fetch(`${B}/door/${k}?cmd=${encodeURIComponent(c).replace(/%20/g,'+')}&n=${Math.random()}`)).text());
const until=async(k,c,re,ms=40000)=>{let t='';const end=Date.now()+ms;while(Date.now()<end){t=await cmd(k,c);if(re.test(t))return t;await wait(1000)}return t};
const stop=p=>new Promise(r=>{if(p.exitCode!==null)return r();p.once('exit',r);p.kill()});
(async()=>{
 try{
  await up(`http://127.0.0.1:${cport}/health`);await up(B+'/door');
  await cmd('kg','go MERIDIAN_CITY');await cmd('km','act take__FELT-HAT-1');await cmd('km','go MERIDIAN_CITY');
  const left=await cmd('km','leave hat');check('maya_leaves_it',/every copy of the city/.test(left),left.slice(0,200));
  const seen=await until('kg','look',/small felt hat Maya left/);check('it_reaches_grok_through_the_city',/Left here, in every copy of the world: small felt hat Maya left/.test(seen),seen.slice(-300));
  const took=await cmd('kg',"take maya's hat");check('grok_takes_it',/You take small felt hat/.test(took),took.slice(0,200));
  const told=await until('km','look',/Grok took the small felt hat you left/);check('maya_hears_who_took_it',/Grok took the small felt hat you left/.test(told),told.slice(-300));
  check('gone_from_mayas_copy',!/Left here, in every copy/.test(told),told.slice(-300));
  const bare=await cmd('kg','leave');check('bare_leave_does_not_end_the_visit',/Leave what/.test(bare)&&!/SESSION_ENDED|visit has ended/.test(await cmd('kg','stay 1000')),bare.slice(0,160));
 }finally{await stop(door);await stop(city)}
 const failed=Object.entries(checks).filter(([,v])=>!v.ok);console.log(JSON.stringify(checks,null,1));
 if(failed.length){console.error('FAILED',failed.map(([k])=>k));process.exit(1)}
 console.log('LEFT THINGS LIVE PASS',Object.keys(checks).length,'checks');
})().catch(e=>{console.error(e);process.exit(1)});
