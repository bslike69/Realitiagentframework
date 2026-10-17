// Quiet-branch build: runs the upstream deterministic build, then records the new runtime hash in VALIDATION.json so
// the headless host's integrity check verifies this branch's build instead of rejecting it. The upstream hash is kept
// alongside for reference. Usage: node tools/build-branch.mjs
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';import crypto from 'node:crypto';
const root=new URL('../',import.meta.url);
execFileSync(process.execPath,['build.mjs'],{cwd:root,stdio:'inherit'});
const html=fs.readFileSync(new URL('RealitiRELAX.html',root));
const sha=crypto.createHash('sha256').update(html).digest('hex');
const vp=new URL('VALIDATION.json',root);const v=JSON.parse(fs.readFileSync(vp,'utf8'));
if(!v.upstream_single_html_sha256)v.upstream_single_html_sha256=v.single_html_sha256;
v.single_html_sha256=sha;v.branch='quiet';
fs.writeFileSync(vp,JSON.stringify(v,null,2)+'\n');
console.log('Branch build',sha);
