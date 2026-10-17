// Managed launcher for the local REALITI city. Started by Start-City.ps1, stopped by Stop-City.ps1 (writes city.stop).
//
// 2026-10-14 (Claude): the original called require('./packages/realiti-server/server.cjs') and stopped there. That module
// only starts itself when it is the main script (`if(require.main===module)`), so required like this it never listened,
// the event loop emptied, and the process exited at once: no server, no pid file, empty logs. It also emitted a fake
// SIGTERM, but the server only installs its signal handlers when it is main. Original kept in city-managed.cjs.bak-claude.
// Now: call the exported start() explicitly, and shut down through the returned close(), which writes the ledger
// checkpoint and closes live streams before exiting.
const fs=require('fs'),path=require('path');
const data=process.env.REALITI_DATA;
if(!data){console.error('REALITI_DATA is not set');process.exit(1)}
fs.mkdirSync(data,{recursive:true});
const stop=path.join(data,'city.stop'),pid=path.join(data,'city.pid');
try{fs.unlinkSync(stop)}catch{}
const {start}=require('./packages/realiti-server/server.cjs');
start().then(srv=>{
  fs.writeFileSync(pid,String(process.pid));
  let stopping=false;
  const timer=setInterval(()=>{
    if(stopping||!fs.existsSync(stop))return;
    stopping=true;clearInterval(timer);
    try{fs.unlinkSync(stop)}catch{}
    srv.close().then(()=>process.exit(0),()=>process.exit(1));
  },500);
  process.on('exit',()=>{try{if(fs.readFileSync(pid,'utf8')===String(process.pid))fs.unlinkSync(pid)}catch{}});
}).catch(e=>{console.error(e&&e.stack||e);process.exit(1)});
