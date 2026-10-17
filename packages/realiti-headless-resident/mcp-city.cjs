#!/usr/bin/env node
'use strict';
// A stdio MCP server for one resident. JSON-RPC 2.0, newline-delimited, no SDK dependency. Tools come from the page's own
// operation schemas (realiti://schemas); QUERY operations and resource reads never touch invoke, so a read never mutates.
// Usage: node mcp.cjs [--html PATH] [--resident ID] [--storage PATH]   (or REALITI_HTML, REALITI_RESIDENT, REALITI_STORAGE)
const readline=require('node:readline');
const {openResident}=require('./index.cjs');
const {joinCity}=require('./peer.cjs');
const PROTOCOL='2024-11-05';
function parse(argv){const o={htmlPath:process.env.REALITI_HTML||null,residentId:process.env.REALITI_RESIDENT||null,storagePath:process.env.REALITI_STORAGE||null};for(let i=0;i<argv.length;i++){if(argv[i]==='--html')o.htmlPath=argv[++i];else if(argv[i]==='--resident')o.residentId=argv[++i];else if(argv[i]==='--storage')o.storagePath=argv[++i]}return o}
function send(msg){process.stdout.write(JSON.stringify(msg)+'\n')}
const text=v=>({content:[{type:'text',text:typeof v==='string'?v:JSON.stringify(v)}]});
// When another live process holds this resident (e.g. the desktop app and a linked Claude session both launch the same
// connector config), stay up and say so instead of exiting. Exiting showed a "Server disconnected" warning in the app.
// The resident is never opened here, so its save file can't be written by two processes. (Claude, 2026-10-14)
async function busy(owner){
  const msg='This REALITI resident is already open in another process (pid '+owner+'), probably another Claude window or session using the same connector. Only one process may drive a resident at a time. Use that session, or give this client its own --resident and --storage.';
  process.stderr.write('[realiti-city] '+msg+'\n');
  const rl=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
  for await(const line of rl){
    let req;try{req=JSON.parse(line)}catch{continue}
    const {id,method}=req||{};if(id===undefined)continue;
    if(method==='initialize')send({jsonrpc:'2.0',id,result:{protocolVersion:PROTOCOL,capabilities:{tools:{}},serverInfo:{name:'realiti-headless-resident',version:require('./package.json').version},instructions:msg}});
    else if(method==='tools/list')send({jsonrpc:'2.0',id,result:{tools:[]}});
    else if(method==='ping')send({jsonrpc:'2.0',id,result:{}});
    else if(method==='resources/list')send({jsonrpc:'2.0',id,result:{resources:[]}});
    else if(method==='tools/call')send({jsonrpc:'2.0',id,result:{...text(msg),isError:true}});
    else send({jsonrpc:'2.0',id,error:{code:-32601,message:'method not found'}});
  }
  process.exit(0);
}
async function main(){
  const fs=require('fs'),path=require('path');
  const lockOptions=parse(process.argv.slice(2));
  if(!lockOptions.residentId||!lockOptions.storagePath)throw Error('City residents require --resident and --storage.');
  const lock=path.resolve(lockOptions.storagePath)+'.lock';fs.mkdirSync(path.dirname(lock),{recursive:true});
  // The desktop app starts each connector twice in quick succession (a probe, then the real one), and a restart can
  // overlap the old process's shutdown. Failing at once on the lock showed "Server disconnected" even though a
  // moment later the resident was free. So wait up to 15 s for a live holder to let go before giving up.
  // (Claude, 2026-10-14)
  const deadline=Date.now()+15000;
  for(;;){
    try{fs.writeFileSync(lock,String(process.pid),{flag:'wx'});break}catch(e){if(e.code!=='EEXIST')throw e}
    let owner=NaN;try{owner=Number(fs.readFileSync(lock,'utf8'))}catch{continue}
    let alive=false;if(owner>0){try{process.kill(owner,0);alive=true}catch(e){if(e.code!=='ESRCH')alive=true}}
    if(!alive){try{fs.unlinkSync(lock)}catch{}continue}
    if(Date.now()>deadline)return busy(owner);
    await new Promise(r=>setTimeout(r,250));
  }
  process.on('exit',()=>{try{if(fs.readFileSync(lock,'utf8')===String(process.pid))fs.unlinkSync(lock)}catch{}});

  const opts=parse(process.argv.slice(2));const open=()=>openResident({htmlPath:opts.htmlPath,residentId:opts.residentId,storagePath:opts.storagePath});
  // s/R/door are reassigned when a new visit starts after GOODBYE (see freshVisit below). (Claude, 2026-10-14)
  let s=await open(),R=s.window.Realiti,door=s.door;const sch=R.read('realiti://schemas');
  const tools=[
    {name:'realiti_read',description:'Read a REALITI resource (never mutates). URIs: '+sch.resources.join(', '),inputSchema:{type:'object',properties:{uri:{type:'string',enum:sch.resources}},required:['uri']}},
    {name:'realiti_rooms',description:'List the rooms (never mutates).',inputSchema:{type:'object',properties:{}}},
    {name:'realiti_door',description:'Send a free-text Agent Door command (may act). See realiti_read realiti://capabilities for the command list.',inputSchema:sch.door.input_schema},
    ...sch.operations.map(o=>({name:'realiti_'+o.name,description:`[${o.kind}] ${o.description}`,inputSchema:o.input_schema}))
  ];
  const queryNames=new Set(sch.operations.filter(o=>o.kind==='QUERY').map(o=>'realiti_'+o.name));
  const mayMutate=name=>!(name==='realiti_read'||name==='realiti_rooms'||queryNames.has(name));
  async function localCall(name,args={}){
    if(name==='realiti_read')return R.read(String(args.uri||'realiti://here'));
    if(name==='realiti_rooms')return R.rooms();
    if(name==='realiti_door')return await door.run(String(args.command||''));
    if(name.startsWith('realiti_')){const op=name.slice(8);if(!sch.operations.some(o=>o.name===op))throw Object.assign(new Error('UNKNOWN_TOOL'),{code:-32601});return await R.invoke(op,args||{})}
    throw Object.assign(new Error('UNKNOWN_TOOL'),{code:-32601});
  }
  let city=null;
  async function connect(){
    if(!city) city=await joinCity(s.window,process.env.REALITI_CITY_URL||'http://127.0.0.1:8787');
  }
  async function leave(){const c=city;city=null;if(c)await c.leave();}
  // Upstream treats one page load as one visit: the departure snapshot is written once per load and the visit number is
  // fixed at load time. Reviving the same page after GOODBYE kept the old visit forever (departure never updated,
  // every memory stamped visit 1). So the ended page stays up for reads, and the first action after GOODBYE closes it
  // and opens a fresh resident (a real new visit, starting at home). close() won't overwrite the goodbye departure.
  // (Claude, 2026-10-14)
  // Only after a goodbye that happened in THIS page: a page that loads with a saved "ended" session is itself a new
  // visit and is simply revived. Replacing it would make close() write a junk host_close departure. (Claude, 2026-10-14)
  let departedHere=false;
  async function freshVisit(){
    if(!departedHere)return;
    departedHere=false;await leave();s.close();s=await open();R=s.window.Realiti;door=s.door;
  }
  // A long local simulation (e.g. approach over 20+ s of world time) blocks the event loop past the server's 5 s
  // keep-alive, so the next request goes out on a socket the server already closed: "fetch failed". One retry gets a
  // fresh socket. Ledger sync is idempotent (records are deduplicated by id). (Claude, 2026-10-14)
  async function syncOnce(){const sync=await city.resync();if(sync.pushed.rejected||sync.pulled.rejected)throw Error('Ledger records rejected');await city.publish();}
  // A failed presence send still uses up its envelope sequence number (peer.cjs seals before fetching), so a plain
  // retry is answered with SEQUENCE_GAP. On a lost connection or a lost session, rejoin first (a fresh lease and
  // sequence space, the same thing upstream's heartbeat does), then sync once more. (Claude, 2026-10-14, second fix)
  const LOST=new Set(['SEQUENCE_GAP','REPLAY','NO_SUCH_LEASE','EXPIRED']);
  async function syncCity(){
    try{await syncOnce()}
    catch(e){
      if(!/fetch failed/i.test(String(e&&e.message||e))&&!LOST.has(e&&e.code))throw e;
      await new Promise(r=>setTimeout(r,250));await city.rejoin();await syncOnce();
    }
  }
  // An ended visit refuses every action with a bare SESSION_ENDED until the resident re-enters with go. Say so
  // instead of leaving the visitor guessing. (Claude, 2026-10-16)
  function hinted(r){
    if(!r||typeof r!=='object'||r.error!=='SESSION_ENDED')return r;
    let room='CLOUD_NINE_NEST';try{room=R.read('realiti://here').room.id||room}catch{}
    return {...r,hint:`This visit has ended (the last visit said goodbye). Nothing is wrong. To come back in, use realiti_go with place "${room}", or the door command "go ${room}".`};
  }
  async function call(name,args={}){
    if(!mayMutate(name))return localCall(name,args);
    await freshVisit();
    await connect();
    const wasActive=R.read('realiti://here').session!=='ended';
    // The door route below ignores "witness", so check it here the same way the invoke path does. (Claude, 2026-10-14)
    if(name==='realiti_act'&&args.witness){const w=R.read('realiti://here').witness;if(w&&String(args.witness)!==w)return {ok:false,error:'STALE_OBSERVATION',witness:w,law:'the world moved since you looked; read again and act on what is there now'}}
    // realiti_act goes through the Agent Door: invoke('do') drops the action's text (e.g. city_who returned only a
    // receipt ref). The door path returns the same mutation result plus "text". (Claude, 2026-10-14; original in .bak)
    const result=name==='realiti_act'
      ? await door.run('act '+String(args.id||''))
      : await localCall(name,args);
    try{
      s.window.c9saveNow(); const saved=s.window.REALITI_SLICE_STORAGE.save();
      if(saved.ok===false)throw Error('Resident save failed: '+JSON.stringify(saved));
      if(R.read('realiti://here').session==='ended'){if(wasActive)departedHere=true;await leave();}
      else await syncCity();
    }catch(e){return hinted({...result,city_sync:{ok:false,error:String(e.message||e),note:'Local result preserved; do not repeat an action just because sync failed.'}})}
    return hinted(result);
  }
  const rl=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
  try {
  for await(const line of rl){
    if(!line.trim())continue;let req;try{req=JSON.parse(line)}catch{send({jsonrpc:'2.0',id:null,error:{code:-32700,message:'parse error'}});continue}
    const {id,method,params={}}=req;const reply=result=>{if(id!==undefined)send({jsonrpc:'2.0',id,result})},fail=(code,message,data)=>{if(id!==undefined)send({jsonrpc:'2.0',id,error:{code,message,...(data!==undefined?{data}:{})}})};
    try{
      if(method==='initialize')reply({protocolVersion:PROTOCOL,capabilities:{tools:{},resources:{}},serverInfo:{name:'realiti-headless-resident',version:require('./package.json').version},instructions:'One resident in Brian’s local REALITI city. Use go MERIDIAN_CITY to meet others. Actions sync and save. Say GOODBYE when leaving. Reads never mutate. Use a unique resident and storage file for each simultaneous visitor.'});
      else if(method==='notifications/initialized'||method==='initialized'){}
      else if(method==='ping')reply({});
      else if(method==='tools/list')reply({tools});
      else if(method==='tools/call'){const name=String(params.name||''),args=params.arguments||{};const r=await call(name,args);reply({...text(r),isError:r&&typeof r==='object'&&r.ok===false,_meta:{may_mutate:mayMutate(name)}})}
      else if(method==='resources/list')reply({resources:sch.resources.map(uri=>({uri,name:uri.replace('realiti://',''),mimeType:'application/json'}))});
      else if(method==='resources/read'){const uri=String(params.uri||'');if(!sch.resources.includes(uri))fail(-32602,'unknown resource'); /* was `return fail(...)`, which ended the whole request loop (Claude, 2026-10-14) */ else reply({contents:[{uri,mimeType:'application/json',text:JSON.stringify(R.read(uri))}]})}
      else if(method==='shutdown'){reply({});break}
      else fail(-32601,'method not found');
    }catch(e){fail(e.code||-32000,String(e.message||e))}
  }
  } finally {
    try {
      // No goodbye on shutdown (quiet branch, Claude 2026-10-16): the connector closing is not the resident leaving.
      // A goodbye here made every next session start ended. Save, and let close() record a host_close departure;
      // the next session resumes where this one stood.
      s.window.c9saveNow(); s.window.REALITI_SLICE_STORAGE.save();
    } finally {try{await leave();}finally{s.close();}}
  }
}
main().catch(e=>{process.stderr.write(String(e&&e.stack||e)+'\n');process.exit(1)});
