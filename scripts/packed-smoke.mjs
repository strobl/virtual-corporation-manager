import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir, cpus, platform, arch } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const started=performance.now();
const temp=await mkdtemp(join(tmpdir(),'gitflash-packed-'));
const children=new Set();
const npm=process.env.npm_execpath;
if(!npm)throw new Error('Run with npm run test:package so the npm executable is explicit.');
function command(args,cwd=process.cwd()){const p=spawnSync(process.execPath,[npm,...args],{cwd,encoding:'utf8',env:process.env,timeout:120000});if(p.status!==0)throw new Error(p.stderr||p.stdout||`Command failed: ${args.join(' ')}`);return p.stdout;}
async function cli(entry,args){return new Promise((resolve,reject)=>{let output='';const p=spawn(process.execPath,[entry,...args],{env:process.env});p.stdout.on('data',c=>output+=c);p.stderr.on('data',c=>output+=c);p.on('error',reject);p.on('close',code=>code===0?resolve(output):reject(new Error(output)));});}
async function start(entry,dataDir){return new Promise((resolve,reject)=>{let output='';const child=spawn(process.execPath,[entry,'--data-dir',dataDir,'--port','0','--no-open'],{env:{...process.env,HTTP_PROXY:'http://127.0.0.1:1',HTTPS_PROXY:'http://127.0.0.1:1',GITFLASH_CODEX_PATH:'',GITFLASH_BUZZ_PATH:''}});children.add(child);const timeout=setTimeout(()=>{child.kill();reject(new Error('Packaged startup timed out: '+output));},15000);child.stdout.on('data',c=>{output+=c;const match=output.match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timeout);resolve({child,url:match[0],output});}});child.stderr.on('data',c=>output+=c);child.on('error',reject);child.on('exit',code=>{children.delete(child);clearTimeout(timeout);if(code)reject(new Error(output));});});}
async function stop(app){await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Shutdown timed out')),10000);app.child.once('exit',()=>{clearTimeout(timeout);resolve();});app.child.kill('SIGTERM');});}
let evidence;
try {
 const packed=JSON.parse(command(['pack','--json','--pack-destination',temp]))[0];
 const tarball=join(temp,packed.filename);const bytes=await readFile(tarball);
 const forbidden=packed.files.filter(f=>/(^|\/)\.env|\.sqlite|source-prototype|audit\/|\.lovable|\.map$/.test(f.path));assert.deepEqual(forbidden,[]);
 const install=join(temp,'installed');await mkdir(install);await writeFile(join(install,'package.json'),'{"private":true}');
 command(['install','--offline','--ignore-scripts','--no-audit','--no-fund','--prefix',install,tarball]);
 const entry=join(install,'node_modules','gitflash','dist','cli.js');const data=join(temp,'data');
 let app=await start(entry,data);
 const html=await(await fetch(app.url)).text();assert.match(html,/GitFlash/);
 const assets=[...html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css))"/g)].map(m=>m[1]);assert(assets.length>=2);
 for(const path of assets){assert(!/^https?:/.test(path));const response=await fetch(app.url+path);assert.equal(response.status,200);assert((await response.text()).length>100);}
 const session=await(await fetch(app.url+'/api/session')).json();
 const post=async(path,value)=>{const r=await fetch(app.url+path,{method:'POST',headers:{'Content-Type':'application/json','X-GitFlash-Token':session.token},body:JSON.stringify(value)});const b=await r.json();assert.equal(r.status,200,JSON.stringify(b));return b;};
 let state=await(await fetch(app.url+'/api/state')).json();assert.equal(state.companies.length,0);
 let p=await post('/api/preview',{commands:[{type:'company.create',input:{name:'Packaged Company',shortCode:'PACK',description:'Created from the installed tarball',color:'#f4dc42'}}],baseRevision:state.revision});
 state=(await post('/api/apply',{previewId:p.id})).state;const companyId=state.companies[0].id;
 p=await post('/api/preview',{commands:[{type:'agent.create',companyId,input:{name:'Release analyst',role:'Validate install and recovery',kind:'agent',instructions:'Use supplied evidence and return a reviewable report.',responsibilities:['Review release evidence'],departmentId:null,managerId:null}}],baseRevision:state.revision});
 state=(await post('/api/apply',{previewId:p.id})).state;const agentId=state.agents[0].id;
 const templateStart=performance.now();p=await post('/api/templates/studio-100/preview',{baseRevision:state.revision});state=(await post('/api/apply',{previewId:p.id})).state;const templateMs=performance.now()-templateStart;assert.equal(state.agents.filter(a=>a.status==='active').length,101);assert.equal(state.work.length,0);
 const exported=await(await fetch(app.url+'/api/export')).json();assert.equal(exported.agents.length,101);
 await stop(app);app=await start(entry,data);const reopened=await(await fetch(app.url+'/api/state')).json();assert.equal(reopened.agents.length,101);assert(reopened.agents.some(a=>a.id===agentId));assert(reopened.companies.some(c=>c.id===companyId));await stop(app);
 const backup=join(temp,'backup.sqlite');await cli(entry,['backup','--data-dir',data,'--output',backup]);const restored=join(temp,'restored');await cli(entry,['restore','--data-dir',restored,'--from',backup]);app=await start(entry,restored);const recovered=await(await fetch(app.url+'/api/state')).json();assert.deepEqual(recovered.agents,reopened.agents);assert.deepEqual(recovered.assignments,reopened.assignments);assert.deepEqual(recovered.history,reopened.history);await stop(app);
 evidence={artifact:packed.filename,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,files:packed.files.length,node:process.version,os:platform(),arch:arch(),cpu:cpus()[0]?.model,template100PreviewAndApplyMs:Math.round(templateMs),totalMs:Math.round(performance.now()-started),checks:['offline npm install of self-contained tarball','packaged CLI and all referenced assets','company and agent creation through API','100-agent template atomic apply','restart IDs preserved','SQLite backup and fresh restore preserve agents assignments history','no seeded work claimed'],networkScope:'Registry blocked by npm --offline; core assets and API use loopback. Browser offline acceptance is recorded separately.'};
 console.log(JSON.stringify(evidence,null,2));
 if(process.env.GITFLASH_EVIDENCE_DIR){await mkdir(process.env.GITFLASH_EVIDENCE_DIR,{recursive:true});await writeFile(join(process.env.GITFLASH_EVIDENCE_DIR,`packed-${platform()}-${arch()}-${process.versions.node}.json`),JSON.stringify(evidence,null,2));}
} finally {for(const child of children)child.kill('SIGTERM');await rm(temp,{recursive:true,force:true});}
