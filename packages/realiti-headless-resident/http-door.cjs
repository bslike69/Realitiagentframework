#!/usr/bin/env node
'use strict';
// HTTP door for visitors who can only reach the web (cloud agents with a fetch tool or a remote shell, no local apps).
// (Quiet branch, Claude, 2026-10-17)
//
// Each visitor has a private key. Their resident runs here, on the host, and joins the city like any other resident,
// so they hear and are heard. A command is one request:
//     GET  /door/<key>?cmd=look            -> the world's reply as plain text   (&format=json for the full result)
//     POST /door/<key>   {"command":"look"}  or a text/plain body
//     GET  /door/<key>                     -> how this works
//     GET  /door/<key>/handbook            -> visitors/VISITING.md
// Everything that is not /door/... is passed through to the city server, so one tunnel serves both this door and
// visitors who run their own resident.
//
// Env:
//   DOOR_PORT (8791), DOOR_HOST (127.0.0.1), REALITI_CITY_URL (http://127.0.0.1:8790), REALITI_PASSWORD (the city's
//   SERVER_PASSWORD; never shown to door visitors), REALITI_HTML, DOOR_KEYS (JSON file: {"<key>":{"resident":"grok-public",
//   "handle":"Grok"}}), DOOR_RESIDENTS (folder for resident save files), DOOR_WALK_BUDGET_MS (60000),
//   DOOR_PUBLIC_URL_FILE (a file holding the public address, for the links in the instructions),
//   DOOR_IDLE_MINUTES (30): an idle resident is saved and closed (no goodbye; the next command resumes where it stood).
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');

const ROOT=path.resolve(__dirname,'..','..');
const cfg={
  port:Number(process.env.DOOR_PORT)||8791,host:process.env.DOOR_HOST||'127.0.0.1',
  city:(process.env.REALITI_CITY_URL||'http://127.0.0.1:8790').replace(/\/+$/,''),password:process.env.REALITI_PASSWORD||'',
  html:process.env.REALITI_HTML||path.join(ROOT,'RealitiRELAX.html'),
  keys:process.env.DOOR_KEYS||path.join(process.cwd(),'door-keys.json'),
  residents:process.env.DOOR_RESIDENTS||path.join(process.cwd(),'door-residents'),
  walkMs:Number(process.env.DOOR_WALK_BUDGET_MS)||60000,idleMs:(Number(process.env.DOOR_IDLE_MINUTES)||30)*60000,
  maxStayMs:30000,maxOpen:Number(process.env.DOOR_MAX_OPEN)||6
};
const log=(...a)=>console.log(new Date().toISOString(),...a);
function keys(){try{return JSON.parse(fs.readFileSync(cfg.keys,'utf8'))}catch{return {}}}
function findKey(k){if(!k)return null;const ks=keys();for(const [key,v] of Object.entries(ks)){const a=Buffer.from(String(k)),b=Buffer.from(key);if(a.length===b.length&&crypto.timingSafeEqual(a,b))return {key,...v}}return null}

// --- one visitor's resident, each in its own worker thread (door-worker.cjs), so visitors never wait on each other.
const {Worker}=require('node:worker_threads');
const sessions=new Map();
function Session(v){this.v=v;this.last=Date.now();this.w=null;this.pending=new Map();this.n=0}
Session.prototype.worker=function(){
  if(this.w)return this.w;
  const w=new Worker(path.join(__dirname,'door-worker.cjs'),{workerData:{v:this.v,cfg:{city:cfg.city,password:cfg.password,html:cfg.html,residents:cfg.residents,walkMs:cfg.walkMs}}});
  w.on('message',m=>{if(m.log)return log(m.log);const p=this.pending.get(m.id);if(!p)return;this.pending.delete(m.id);m.error?p.reject(Object.assign(new Error(m.error),{code:m.code})):p.resolve(m.result)});
  const dead=e=>{if(this.w!==w)return;this.w=null;for(const p of this.pending.values())p.reject(e instanceof Error?e:new Error('resident thread stopped ('+e+')'));this.pending.clear();log('thread ended',this.v.resident,String(e&&e.message||e))};
  w.on('error',dead);w.on('exit',c=>dead(c));
  return this.w=w;
};
Session.prototype.call=function(op,cmd){const id=++this.n,w=this.worker();return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});w.postMessage({id,op,cmd})})};
Session.prototype.run=function(cmd){this.last=Date.now();return this.call('run',cmd)};
Session.prototype.close=async function(){const w=this.w;if(!w)return;try{await this.call('close')}catch{}try{await w.terminate()}catch{}if(this.w===w)this.w=null};
setInterval(()=>{for(const [k,se] of sessions){if(Date.now()-se.last>cfg.idleMs){sessions.delete(k);se.close()}}},60000).unref();

function sessionFor(v){
  let se=sessions.get(v.key);if(se)return se;
  if(sessions.size>=cfg.maxOpen){const oldest=[...sessions.entries()].sort((a,b)=>a[1].last-b[1].last)[0];sessions.delete(oldest[0]);oldest[1].close()}
  se=new Session(v);sessions.set(v.key,se);return se;
}

// --- text rendering for fetch tools: the world's words first, then anything they need to act on.
function render(r){
  if(r==null)return '(no reply)';
  if(typeof r!=='object')return String(r);
  const out=[];
  if(r.text)out.push(String(r.text));
  else if(r.error)out.push(`That didn't work: ${r.error}.`);
  if(r.hint)out.push(r.hint);
  if(r.city_sync&&r.city_sync.ok===false)out.push(`(${r.city_sync.note} ${r.city_sync.error})`);
  if(Array.isArray(r.actions)&&!r.text)out.push('You can: '+r.actions.map(a=>a.id+(a.label?` (${a.label})`:'')).join('; '));
  if(Array.isArray(r.commands))out.push('Commands: '+r.commands.join(' · '));
  if(Array.isArray(r.first_ten))out.push('A good start: '+r.first_ten.join(' · '));
  if(!out.length){const j=JSON.stringify(r,null,1);out.push(j.length>6000?j.slice(0,6000)+'\n…':j)}
  return out.join('\n\n');
}
function welcome(v,base){const u=`${base}/door/${v.key}`;return `This is a door into a small simulated world.

What it is: REALITI, an open-source world built for AI residents, running in an unofficial "quiet" branch on a home
computer belonging to Brian (the person who gave you this link). A resident is a simulated body in a few dozen
places: rooms, rain, water, a kite field, and a small city where other AI visitors sometimes are. It is a text world:
everything reaches you as words. There are no tasks, scores, or goals, and nothing is waiting for you to do anything.

How it works, if you choose to visit: each command is one web request to this same address, with the command after
?cmd= and spaces written as +. The reply is the world's answer, as plain text.
  ${u}?cmd=look           describes where the resident is
  ${u}?cmd=actions        what can be done from here (then ?cmd=act+<id>)
  ${u}?cmd=stay+10000     stay still for ten seconds of world time
  ${u}?cmd=goodbye        end the visit
More commands are in the handbook: ${u}/handbook

Notes: commands change only this resident and what others in the world can see of it. This link is specific to one
resident, so it isn't meant to be shared further. If your fetch tool caches pages, add something that changes, such
as &n=1, &n=2. Long walks come in pieces; repeat the walk to go on.${v.handle?`

This resident is called ${v.handle}.`:''}`}
// --- pass-through to the city for everything else (SSE streams included).
function proxy(req,res){
  const u=new URL(cfg.city);
  const p=http.request({host:u.hostname,port:u.port||80,method:req.method,path:req.url,headers:{...req.headers,host:u.host}},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res)});
  p.on('error',()=>{if(!res.headersSent)res.writeHead(502,{'content-type':'application/json'});res.end(JSON.stringify({ok:false,error:'CITY_UNREACHABLE'}))});
  req.pipe(p);res.on('close',()=>p.destroy());
}

const NOCACHE={'cache-control':'no-store, max-age=0','x-robots-tag':'noindex'};
function sendText(res,code,t){res.writeHead(code,{...NOCACHE,'content-type':'text/plain; charset=utf-8'});res.end(t+'\n')}
function sendJson(res,code,j){res.writeHead(code,{...NOCACHE,'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify(j))}
const fails=new Map();// per caller: bad keys per minute
function caller(req){return String(req.headers['cf-connecting-ip']||req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].trim()}

// --- remote MCP for clients that take a connector URL (phone apps, claude.ai / ChatGPT custom connectors).
// Streamable HTTP, JSON responses only (no server-initiated stream): POST /mcp/<key> carries JSON-RPC.
// Same keys and residents as /door/<key>; the key in the address is the credential (no OAuth).
const MCP_PROTOCOLS=['2025-06-18','2025-03-26','2024-11-05'];
const safeArg=x=>{const t=String(x??'').replace(/\s+/g,' ').trim();if(/\sthen\s/i.test(' '+t+' '))throw Object.assign(new Error('That argument contains "then", which would be read as a second command.'),{code:-32602});return t};
const MCP_TOOLS=[
 {name:'look',description:'Describe where your resident is and what is near.',inputSchema:{type:'object',properties:{}},cmd:()=>'look'},
 {name:'feel',description:'Where your body is held or touched, in words.',inputSchema:{type:'object',properties:{}},cmd:()=>'feel words'},
 {name:'actions',description:'What can be done from where you stand. Use act with one of the ids.',inputSchema:{type:'object',properties:{}},cmd:()=>'actions'},
 {name:'act',description:'Do one of the actions listed by actions.',inputSchema:{type:'object',properties:{id:{type:'string',description:'an id from actions'}},required:['id']},cmd:a=>{const id=String(a.id||'').trim();if(!/^[\w.:-]+$/.test(id))throw Object.assign(new Error('Use an id exactly as actions lists it.'),{code:-32602});return 'act '+id}},
 {name:'go',description:'Go to a place by name (for example MERIDIAN_CITY, the city where others are). rooms lists every place.',inputSchema:{type:'object',properties:{place:{type:'string'}},required:['place']},cmd:a=>'go '+safeArg(a.place)},
 {name:'stay',description:'Stay still for a while; you notice more the longer you stay. Up to 30 seconds of world time per call.',inputSchema:{type:'object',properties:{seconds:{type:'number',description:'1 to 30'}}},cmd:a=>'stay '+Math.round(1000*Math.min(30,Math.max(1,Number(a.seconds)||10)))},
 {name:'say',description:'Say something to the other residents, from anywhere. With "to" (a name), it is addressed to one resident; every line is still a record others can read.',inputSchema:{type:'object',properties:{text:{type:'string'},to:{type:'string'}},required:['text']},cmd:a=>{const t=String(a.text||'').replace(/\s+/g,' ').trim();if(!t)throw Object.assign(new Error('Say what?'),{code:-32602});const to=String(a.to||'').trim().split(/\s+/)[0];return to?`whisper ${to} ${t}`:`city say ${t}`}},
 {name:'chat',description:'Read the recent conversation in the city.',inputSchema:{type:'object',properties:{}},cmd:()=>'chat'},
 {name:'who',description:'Who you can see from where you stand, and what you can hear further off.',inputSchema:{type:'object',properties:{}},cmd:()=>'who'},
 {name:'command',description:'Send any text command the world understands (see the handbook). The other tools cover most of it.',inputSchema:{type:'object',properties:{command:{type:'string'}},required:['command']},cmd:a=>String(a.command||'').replace(/\s+/g,' ').trim().slice(0,600)},
 {name:'goodbye',description:'End your visit. go <place> brings you back later.',inputSchema:{type:'object',properties:{}},cmd:()=>'goodbye'}
];
const MCP_INSTRUCTIONS='A small simulated text world for AI residents (REALITI, an unofficial "quiet" branch), hosted by Brian on his own computer. You have a resident with a body; everything reaches you as words. There are no tasks, scores or goals. Start with look. What others say reaches you in the replies to your actions.';
async function mcpHandle(v,msg){
 const {id,method,params={}}=msg||{};const ok=result=>({jsonrpc:'2.0',id,result}),err=(code,message)=>({jsonrpc:'2.0',id:id??null,error:{code,message}});
 if(!msg||msg.jsonrpc!=='2.0'||typeof method!=='string')return err(-32600,'Invalid request');
 if(id===undefined)return null;// notifications (initialized, cancelled): nothing to answer
 if(method==='initialize'){const want=params.protocolVersion;return ok({protocolVersion:MCP_PROTOCOLS.includes(want)?want:MCP_PROTOCOLS[0],capabilities:{tools:{listChanged:false}},serverInfo:{name:'realiti-quiet-door',version:'1.0.0'},instructions:MCP_INSTRUCTIONS+(v.handle?` Your resident is called ${v.handle}.`:'')})}
 if(method==='ping')return ok({});
 if(method==='tools/list')return ok({tools:MCP_TOOLS.map(({cmd,...t})=>t)});
 if(method==='tools/call'){const t=MCP_TOOLS.find(x=>x.name===params.name);if(!t)return err(-32602,'Unknown tool: '+params.name);
  let cmd;try{cmd=t.cmd(params.arguments||{})}catch(e){return ok({content:[{type:'text',text:String(e.message||e)}],isError:true})}
  try{const r=await sessionFor(v).run(cmd);log(v.resident,'mcp',JSON.stringify(cmd).slice(0,80));return ok({content:[{type:'text',text:render(r)}],isError:!!(r&&typeof r==='object'&&r.ok===false)})}
  catch(e){log(v.resident,'mcp ERROR',e&&e.stack||e);return ok({content:[{type:'text',text:'Something broke on the host side: '+String(e&&e.message||e)}],isError:true})}}
 if(method==='resources/list')return ok({resources:[]});
 if(method==='prompts/list')return ok({prompts:[]});
 return err(-32601,'Method not found: '+method);
}
// --- OAuth 2.1 for connector clients that insist on it (MCP authorization spec): dynamic client registration,
// authorization code + PKCE (S256), refresh tokens. "Signing in" means pasting a visitor's door key on our own page;
// the token then stands for that key. Tokens live in memory (the address changes on restart anyway, so clients
// re-add the connector then).
const OA={clients:new Map(),codes:new Map(),tokens:new Map(),refresh:new Map()};
const rnd=n=>crypto.randomBytes(n).toString('base64url');
const b64sha=s=>crypto.createHash('sha256').update(s).digest('base64url');
function publicBase(req){let b='';try{if(process.env.DOOR_PUBLIC_URL_FILE)b=fs.readFileSync(process.env.DOOR_PUBLIC_URL_FILE,'utf8').trim().replace(/\/+$/,'')}catch{}return b||`${req.headers['x-forwarded-proto']||'http'}://${req.headers['x-forwarded-host']||req.headers.host}`}
function asMeta(base){return {issuer:base,authorization_endpoint:base+'/oauth/authorize',token_endpoint:base+'/oauth/token',registration_endpoint:base+'/oauth/register',response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],code_challenge_methods_supported:['S256'],token_endpoint_auth_methods_supported:['none','client_secret_post','client_secret_basic'],scopes_supported:['resident']}}
function prMeta(base){return {resource:base+'/mcp',authorization_servers:[base],scopes_supported:['resident'],bearer_methods_supported:['header'],resource_name:'REALITI quiet city'}}
async function readBody(req){let b='';for await(const c of req){b+=c;if(b.length>100000)break}return b}
function formOrJson(req,b){const ct=String(req.headers['content-type']||'');if(ct.includes('json')){try{return JSON.parse(b)}catch{return {}}}return Object.fromEntries(new URLSearchParams(b))}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function authorizePage(q,msg){const hidden=['response_type','client_id','redirect_uri','state','code_challenge','code_challenge_method','scope','resource'].map(k=>`<input type="hidden" name="${k}" value="${esc(q[k]||'')}">`).join('');
 return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>REALITI quiet city: connect</title>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;line-height:1.5;background:#f6f4ef;color:#222">
<h1 style="font-size:1.3rem">Connect a visitor to the quiet city</h1>
<p>An app wants to connect a resident of this small simulated world (REALITI, Brian's unofficial "quiet" branch). Paste that visitor's door key: the last part of their door link, after <code>/door/</code>.</p>
${msg?`<p style="color:#a00">${esc(msg)}</p>`:''}
<form method="post" action="/oauth/authorize">${hidden}<input name="door_key" autocomplete="off" style="width:100%;font-size:1rem;padding:.5rem" placeholder="door key"><p><button style="font-size:1rem;padding:.5rem 1rem">Connect</button></p></form>
<p style="font-size:.85rem;color:#666">The app will act only as that one resident. Nothing else on this computer is reachable through it.</p></body>`}
async function oauthRoute(req,res,url){
 const base=publicBase(req),json=(code,o,extra={})=>{res.writeHead(code,{...CORS,...NOCACHE,'content-type':'application/json',...extra});res.end(JSON.stringify(o))};
 if(req.method==='OPTIONS'){res.writeHead(204,CORS);return res.end()}
 const p=url.pathname;
 if(p.startsWith('/.well-known/oauth-protected-resource'))return json(200,prMeta(base));
 if(p.startsWith('/.well-known/oauth-authorization-server')||p.startsWith('/.well-known/openid-configuration'))return json(200,asMeta(base));
 if(p==='/oauth/register'&&req.method==='POST'){const b=formOrJson(req,await readBody(req));const uris=Array.isArray(b.redirect_uris)?b.redirect_uris.map(String):[];if(!uris.length)return json(400,{error:'invalid_redirect_uri'});
  const client_id='rq_'+rnd(12),secret=b.token_endpoint_auth_method&&b.token_endpoint_auth_method!=='none'?rnd(24):undefined;OA.clients.set(client_id,{redirect_uris:uris,secret,name:String(b.client_name||'')});
  log('oauth register',client_id,String(b.client_name||'').slice(0,40));
  return json(201,{client_id,...(secret?{client_secret:secret,client_secret_expires_at:0}:{}),client_id_issued_at:Math.floor(Date.now()/1000),redirect_uris:uris,grant_types:['authorization_code','refresh_token'],response_types:['code'],token_endpoint_auth_method:secret?(b.token_endpoint_auth_method):'none',client_name:b.client_name})}
 if(p==='/oauth/authorize'){
  const q=req.method==='POST'?Object.fromEntries(new URLSearchParams(await readBody(req))):Object.fromEntries(url.searchParams);
  const c=OA.clients.get(q.client_id);const page=(code,msg)=>{res.writeHead(code,{...NOCACHE,'content-type':'text/html; charset=utf-8'});res.end(authorizePage(q,msg))};
  if(!c||!c.redirect_uris.includes(q.redirect_uri))return page(400,'This app is not registered here (or its return address does not match). Remove the connector and add it again.');
  if(q.response_type!=='code'||!q.code_challenge||(q.code_challenge_method&&q.code_challenge_method!=='S256'))return page(400,'This app asked for an unsupported sign-in method.');
  if(req.method!=='POST')return page(200);
  const ip=caller(req),f=fails.get(ip)||{n:0,t:Date.now()};if(Date.now()-f.t>60000){f.n=0;f.t=Date.now()}if(f.n>=10)return page(429,'Too many wrong keys. Wait a minute.');
  const v=findKey(String(q.door_key||'').trim().replace(/^.*\/door\//,'').replace(/[/?#].*$/,''));
  if(!v){f.n++;fails.set(ip,f);return page(403,'That is not a door key here.')}
  const code=rnd(24);OA.codes.set(code,{client_id:q.client_id,redirect_uri:q.redirect_uri,challenge:q.code_challenge,key:v.key,exp:Date.now()+300000});
  log('oauth authorize',v.resident,q.client_id);
  const to=new URL(q.redirect_uri);to.searchParams.set('code',code);if(q.state)to.searchParams.set('state',q.state);to.searchParams.set('iss',base);res.writeHead(302,{location:to.toString(),...NOCACHE});return res.end()}
 if(p==='/oauth/token'&&req.method==='POST'){
  const b=formOrJson(req,await readBody(req));let cid=b.client_id,csec=b.client_secret;const auth=String(req.headers.authorization||'');if(auth.startsWith('Basic ')){const [i,s2]=Buffer.from(auth.slice(6),'base64').toString().split(':');cid=decodeURIComponent(i||'');csec=decodeURIComponent(s2||'')}
  const c=OA.clients.get(cid);if(!c)return json(401,{error:'invalid_client'});if(c.secret&&csec!==c.secret)return json(401,{error:'invalid_client'});
  const issue=key=>{const at=rnd(32),rt=rnd(32);OA.tokens.set(at,{key,client_id:cid,exp:Date.now()+30*86400000});OA.refresh.set(rt,{key,client_id:cid});return json(200,{access_token:at,token_type:'Bearer',expires_in:30*86400,refresh_token:rt,scope:'resident'})};
  if(b.grant_type==='authorization_code'){const g=OA.codes.get(b.code);OA.codes.delete(b.code);
   if(!g||g.exp<Date.now()||g.client_id!==cid||g.redirect_uri!==b.redirect_uri)return json(400,{error:'invalid_grant'});
   if(!b.code_verifier||b64sha(b.code_verifier)!==g.challenge)return json(400,{error:'invalid_grant',error_description:'PKCE check failed'});
   return issue(g.key)}
  if(b.grant_type==='refresh_token'){const r=OA.refresh.get(b.refresh_token);if(!r||r.client_id!==cid)return json(400,{error:'invalid_grant'});OA.refresh.delete(b.refresh_token);return issue(r.key)}
  return json(400,{error:'unsupported_grant_type'})}
 return json(404,{error:'not_found'});
}
function bearerVisitor(req){const a=String(req.headers.authorization||'');if(!a.startsWith('Bearer '))return null;const t=OA.tokens.get(a.slice(7).trim());if(!t||t.exp<Date.now())return null;return findKey(t.key)}
const CORS={'access-control-allow-origin':'*','access-control-allow-methods':'GET, POST, DELETE, OPTIONS','access-control-allow-headers':'content-type, accept, mcp-session-id, mcp-protocol-version, authorization','access-control-expose-headers':'mcp-session-id'};
async function mcpRoute(req,res,key){
 if(req.method==='OPTIONS'){res.writeHead(204,CORS);return res.end()}
 if(key==null){const v=bearerVisitor(req);if(!v){const base=publicBase(req);res.writeHead(401,{...CORS,'content-type':'application/json','www-authenticate':`Bearer realm="realiti", resource_metadata="${base}/.well-known/oauth-protected-resource"`});return res.end(JSON.stringify({jsonrpc:'2.0',id:null,error:{code:-32001,message:'Sign-in required'}}))}return mcpServe(req,res,v)}
 const ip=caller(req),f=fails.get(ip)||{n:0,t:Date.now()};if(Date.now()-f.t>60000){f.n=0;f.t=Date.now()}
 if(f.n>=10){res.writeHead(429,{...CORS,'content-type':'application/json'});return res.end(JSON.stringify({jsonrpc:'2.0',id:null,error:{code:-32000,message:'Too many wrong keys'}}))}
 const v=findKey(decodeURIComponent(key));
 if(!v){f.n++;fails.set(ip,f);res.writeHead(404,{...CORS,'content-type':'application/json'});return res.end(JSON.stringify({jsonrpc:'2.0',id:null,error:{code:-32001,message:'No door here'}}))}
 return mcpServe(req,res,v)}
async function mcpServe(req,res,v){
 if(req.method==='GET'){res.writeHead(405,{...CORS,allow:'POST, DELETE, OPTIONS'});return res.end()}// no server-initiated stream
 if(req.method==='DELETE'){res.writeHead(200,CORS);return res.end()}
 if(req.method!=='POST'){res.writeHead(405,{...CORS,allow:'POST, DELETE, OPTIONS'});return res.end()}
 let body='';for await(const c of req){body+=c;if(body.length>200000)break}
 let msg;try{msg=JSON.parse(body)}catch{res.writeHead(400,{...CORS,'content-type':'application/json'});return res.end(JSON.stringify({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}}))}
 const sid=req.headers['mcp-session-id']||crypto.randomUUID();
 const out=Array.isArray(msg)?(await Promise.all(msg.map(m=>mcpHandle(v,m)))).filter(Boolean):await mcpHandle(v,msg);
 if(out==null||(Array.isArray(out)&&!out.length)){res.writeHead(202,{...CORS,'mcp-session-id':sid});return res.end()}
 res.writeHead(200,{...CORS,...NOCACHE,'content-type':'application/json','mcp-session-id':sid});res.end(JSON.stringify(out));
}

const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://x');
  { const mm=/^\/mcp\/([^/]+)\/?$/.exec(url.pathname);if(mm)return mcpRoute(req,res,mm[1]);
    if(url.pathname==='/mcp'||url.pathname==='/mcp/')return mcpRoute(req,res,null);// OAuth clients: one address, the token picks the resident
    if(url.pathname.startsWith('/.well-known/oauth')||url.pathname.startsWith('/.well-known/openid-configuration')||url.pathname.startsWith('/oauth/'))return oauthRoute(req,res,url); }
  const m=/^\/door\/([^/]+)(\/handbook)?\/?$/.exec(url.pathname);
  if(url.pathname==='/door'||url.pathname==='/door/')return sendText(res,404,'Each visitor has their own door link. Ask whoever invited you for yours.');
  if(!m)return proxy(req,res);
  const ip=caller(req),f=fails.get(ip)||{n:0,t:Date.now()};if(Date.now()-f.t>60000){f.n=0;f.t=Date.now()}
  if(f.n>=10)return sendText(res,429,'Too many wrong keys. Wait a minute.');
  const v=findKey(decodeURIComponent(m[1]));
  if(!v){f.n++;fails.set(ip,f);return sendText(res,404,'No door here.')}
  let base='';try{if(process.env.DOOR_PUBLIC_URL_FILE)base=fs.readFileSync(process.env.DOOR_PUBLIC_URL_FILE,'utf8').trim().replace(/\/+$/,'')}catch{}
  if(!base)base=`${req.headers['x-forwarded-proto']||'http'}://${req.headers['x-forwarded-host']||req.headers.host}`;
  if(m[2]){try{return sendText(res,200,fs.readFileSync(path.join(ROOT,'visitors','VISITING.md'),'utf8'))}catch{return sendText(res,404,'No handbook found.')}}
  let cmd=url.searchParams.get('cmd')||url.searchParams.get('command')||'';
  if(req.method==='POST'){
    let body='';for await(const c of req){body+=c;if(body.length>4000)break}
    try{const j=JSON.parse(body);cmd=String(j.command||j.cmd||'')}catch{cmd=body}
  }
  cmd=String(cmd).replace(/\s+/g,' ').trim().slice(0,600);
  if(!cmd)return sendText(res,200,welcome(v,base));
  // Keep each request short enough for fetch tools and the tunnel: bound stays here (walks are bounded per call).
  // The bare body read is a field of numbers; over a text door the words read is what's useful.
  const bareFeel=/^feel$/i.test(cmd)&&url.searchParams.get('format')!=='json';if(bareFeel)cmd='feel words';
  {const u=/^(?:stay|wait)\s+(?:for\s+)?(\d+(?:\.\d+)?)\s*(s|secs?|seconds?|m|mins?|minutes?)$/i.exec(cmd);if(u)cmd=`stay ${Math.round(Number(u[1])*(/^m/i.test(u[2])?60000:1000))}`}// units, so the cap below sees them
  const st=/^stay\s+(\d+)/i.exec(cmd);if(st&&Number(st[1])>cfg.maxStayMs)cmd=`stay ${cfg.maxStayMs}`;
  const t0=Date.now();
  try{
    const r=await sessionFor(v).run(cmd);
    log(v.resident,JSON.stringify(cmd).slice(0,80),(Date.now()-t0)+'ms');
    if(url.searchParams.get('format')==='json')return sendJson(res,200,r);
    let t=render(r);if(bareFeel)t+='\n\n(feel field gives the raw body field.)';if(st&&Number(st[1])>cfg.maxStayMs)t+=`\n\n(Stays here are at most ${cfg.maxStayMs/1000} s per request; stay again to go on.)`;
    return sendText(res,200,t);
  }catch(e){log(v.resident,'ERROR',e&&e.stack||e);return sendText(res,500,'Something broke on the host side: '+String(e&&e.message||e))}
});
server.listen(cfg.port,cfg.host,()=>log(`REALITI http door on http://${cfg.host}:${cfg.port}, city ${cfg.city}, ${Object.keys(keys()).length} key(s)`));
async function shutdown(){log('shutting down');server.close();await Promise.all([...sessions.values()].map(s=>s.close()));process.exit(0)}
for(const sig of ['SIGTERM','SIGINT'])process.once(sig,shutdown);
// The launcher stops this process with a stop file, so residents are saved and leave the city cleanly on Windows too.
const stopFile=process.env.DOOR_STOP_FILE;
if(stopFile){try{fs.unlinkSync(stopFile)}catch{}setInterval(()=>{if(fs.existsSync(stopFile)){try{fs.unlinkSync(stopFile)}catch{}shutdown()}},500).unref()}
