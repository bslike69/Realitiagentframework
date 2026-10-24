'use strict';
// The HTTP door survives bad requests (Sol's bug hunt, 2026-10-23): malformed %-escapes in a door or MCP key, and MCP
// requests with null or malformed params, get an error reply, and the same process keeps serving. No city is needed.
const {spawn}=require('node:child_process'),path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'door-test-'));fs.writeFileSync(path.join(dir,'keys.json'),JSON.stringify({kq:{resident:'qa-door',handle:'QA'}}));
const port=18000+Math.floor(Math.random()*1000),B=`http://127.0.0.1:${port}`;
const door=spawn(process.execPath,[path.join(__dirname,'..','http-door.cjs')],{env:{...process.env,DOOR_PORT:String(port),DOOR_KEYS:path.join(dir,'keys.json'),DOOR_RESIDENTS:path.join(dir,'res'),REALITI_CITY_URL:'http://127.0.0.1:9'},stdio:['ignore','pipe','pipe']});
let exited=null;door.on('exit',c=>exited=c);let errout='';door.stderr.on('data',d=>errout+=d);
const checks={};const check=(k,v,d)=>{checks[k]={ok:!!v,d}};
const mcp=(key,body)=>fetch(`${B}/mcp/${key}`,{method:'POST',headers:{'content-type':'application/json'},body:typeof body==='string'?body:JSON.stringify(body)});
(async()=>{
 for(let i=0;i<50;i++){try{await fetch(B+'/door');break}catch{await new Promise(r=>setTimeout(r,100))}}
 const alive=async()=>{try{const r=await mcp('kq',{jsonrpc:'2.0',id:99,method:'ping'});return r.status===200&&exited===null}catch{return false}};
 let r=await fetch(B+'/door/%ZZ?cmd=look');check('bad_escape_door_is_a_client_error',r.status>=400&&r.status<500,r.status);check('alive_after_bad_door_escape',await alive());
 r=await mcp('%ZZ',{jsonrpc:'2.0',id:1,method:'ping'});check('bad_escape_mcp_is_a_client_error',r.status>=400&&r.status<500,r.status);check('alive_after_bad_mcp_escape',await alive());
 for(const [name,body] of [['null_params',{jsonrpc:'2.0',id:2,method:'tools/call',params:null}],['primitive_params',{jsonrpc:'2.0',id:3,method:'tools/call',params:7}],['array_params',{jsonrpc:'2.0',id:4,method:'tools/call',params:[1]}],['null_arguments',{jsonrpc:'2.0',id:5,method:'tools/call',params:{name:'nosuchtool',arguments:null}}],['batch_with_invalid_item',[null,{jsonrpc:'2.0',id:6,method:'ping'}]],['null_initialize',{jsonrpc:'2.0',id:7,method:'initialize',params:null}],['not_json','{nope']]){
  r=await mcp('kq',body);const t=await r.text();let j=null;try{j=JSON.parse(t)}catch{}
  check(name+'_answered',r.status<500&&(j!==null),{status:r.status,body:t.slice(0,120)});check('alive_after_'+name,await alive())}
 r=await fetch(B+'/oauth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({redirect_uris:['not a url']})});await r.text();
 r=await fetch(B+'/oauth/authorize?response_type=code&client_id=x&redirect_uri=%ZZ');check('alive_after_odd_oauth',await alive());
 door.kill();
 const failed=Object.entries(checks).filter(([,v])=>!v.ok);console.log(JSON.stringify(checks,null,1));
 if(failed.length||exited!==null&&exited!==0&&exited!==143&&exited!==null){console.error('FAILED',failed.map(([k])=>k),errout.slice(-600));process.exit(1)}
 console.log('HTTP DOOR PASS',Object.keys(checks).length,'checks');
})().catch(e=>{door.kill();console.error(e);process.exit(1)});
