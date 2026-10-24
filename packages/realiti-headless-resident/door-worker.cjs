'use strict';
// One door visitor's resident, in its own thread (quiet branch). The HTTP door used to run every visitor's resident on
// its one event loop, so one visitor's long walk or row (tens of seconds of simulation) held up everyone else's
// replies, and a reply that waited past the tunnel's ~100 s cut-off came back as an error page.
// The lifecycle is unchanged: no goodbye on close; a goodbye ends the visit and the next command opens a fresh one;
// sync after every command; messages that arrive with the sync are delivered.
const {parentPort,workerData}=require('node:worker_threads');
const fs=require('node:fs'),path=require('node:path');
const {openResident}=require('./index.cjs');
const {joinCity}=require('./peer.cjs');
const cfg=workerData.cfg;
const log=(...a)=>parentPort.postMessage({log:a.map(String).join(' ')});
// --- one visitor's resident, the same lifecycle as mcp-city.cjs (no goodbye on close; a goodbye ends the visit and the
// next command opens a fresh one; sync after every command; messages that arrive with the sync are delivered).
function Session(v){
  this.v=v;this.s=null;this.city=null;this.chain=Promise.resolve();this.last=Date.now();this.departedHere=false;
  this.storage=path.join(cfg.residents,v.resident.replace(/[^\w.-]/g,'_')+'.json');
}
Session.prototype.open=async function(){
  const fresh=!fs.existsSync(this.storage);fs.mkdirSync(cfg.residents,{recursive:true});
  this.s=await openResident({htmlPath:cfg.html,residentId:this.v.resident,storagePath:this.storage,walkBudgetMs:cfg.walkMs});
  if(fresh&&this.v.handle){try{await this.s.door.run('call me '+this.v.handle)}catch{}}
  log('opened',this.v.resident);
};
Session.prototype.connect=async function(){if(!this.city)this.city=await joinCity(this.s.window,cfg.city,{password:cfg.password})};
Session.prototype.leave=async function(){const c=this.city;this.city=null;if(c){try{await c.leave()}catch{}}};
Session.prototype.sync=async function(){
  const once=async()=>{const r=await this.city.resync();if(r.pushed.rejected||r.pulled.rejected)throw Error('Ledger records rejected');await this.city.publish()};
  try{await once()}catch(e){if(!/fetch failed/i.test(String(e&&e.message||e))&&!['SEQUENCE_GAP','REPLAY','NO_SUCH_LEASE','EXPIRED'].includes(e&&e.code))throw e;await new Promise(r=>setTimeout(r,250));await this.city.rejoin();await once()}
};
Session.prototype.here=function(){try{return this.s.window.Realiti.read('realiti://here')}catch{return {}}};
Session.prototype.run=function(cmd){const p=this.chain.then(()=>this.run0(cmd));this.chain=p.catch(()=>{});return p};
Session.prototype.run0=async function(cmd){
  this.last=Date.now();
  if(!this.s)await this.open();
  if(this.departedHere){this.departedHere=false;await this.leave();this.s.close();await this.open()}
  await this.connect();
  const wasActive=this.here().session!=='ended';
  if(/^(chat|messages|chat log)$/i.test(cmd)){try{await this.sync()}catch{}}
  let result=await this.s.door.run(cmd);let late=[];
  try{
    this.s.window.c9saveNow();this.s.window.REALITI_SLICE_STORAGE.save();
    if(this.here().session==='ended'){if(wasActive)this.departedHere=true;await this.leave()}
    else{await this.sync();if(!this.s.window.REALITI_MEASURE_V1?.on?.()){late=this.s.window.REALITI_CITY_V1?.hear?.()||[];if(late.length)this.s.window.c9saveNow()}}
  }catch(e){result={...(result&&typeof result==='object'?result:{text:String(result)}),city_sync:{ok:false,error:String(e.message||e),note:'Your action happened; only the city sync failed. Do not repeat it.'}}}
  if(late.length&&result&&typeof result==='object')result={...result,heard:[...(result.heard||[]),...late],text:(result.text?String(result.text)+'\n\n':'')+late.map(x=>x.line).join('\n')};
  if(result&&result.error==='SESSION_ENDED')result={...result,hint:`This visit has ended (you said goodbye). To come back in: go ${this.here().room?.id||'MERIDIAN_CITY'}`};
  return result;
};
Session.prototype.close=async function(){if(!this.s)return;try{await this.chain}catch{}await this.leave();try{this.s.close()}catch{}this.s=null;log('closed',this.v.resident)};

const se=new Session(workerData.v);
parentPort.on('message',async m=>{
  try{
    if(m.op==='run'){const r=await se.run(m.cmd);parentPort.postMessage({id:m.id,result:JSON.parse(JSON.stringify(r===undefined?null:r))})}
    else if(m.op==='close'){await se.close();parentPort.postMessage({id:m.id,result:true})}
  }catch(e){parentPort.postMessage({id:m.id,error:String(e&&e.message||e),code:e&&e.code})}
});
