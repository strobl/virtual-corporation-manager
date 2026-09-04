import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import type { DomainCommand, WorkspaceStore } from '../domain/contracts';
import { createWorkspaceStore } from '../db/store';
import { getTemplate, listTemplates } from '../company/templates';
import { createIntegrationService } from '../adapters/index';

export interface ServerOptions { dataDir: string; port?: number; webDir: string; store?: WorkspaceStore }
class HttpError extends Error { constructor(public code: string, message: string, public status: number) { super(message); } }
const types: Record<string,string> = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2','.json':'application/json'};
function json(res:ServerResponse, value:unknown, status=200) { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(value)); }
async function body(req:IncomingMessage):Promise<Record<string,unknown>> {
 let size=0; const parts:Buffer[]=[];
 for await (const part of req) { size+=part.length; if(size>2_000_000) throw new HttpError('BODY_TOO_LARGE','The request exceeds 2 MB. Import a smaller company definition.',413); parts.push(part); }
 try { const value=JSON.parse(Buffer.concat(parts).toString('utf8')); if(!value||typeof value!=='object'||Array.isArray(value)) throw new Error(); return value; } catch { throw new HttpError('INVALID_JSON','Send a JSON object.',400); }
}
function requiredString(value:unknown, field:string):string { if(typeof value!=='string'||!value.trim()) throw new HttpError('INVALID_INPUT',`${field} is required.`,400); return value; }
function revision(value:unknown):number { if(!Number.isSafeInteger(value)||Number(value)<0) throw new HttpError('INVALID_REVISION','Refresh the workspace and retry with its current revision.',400); return Number(value); }
export async function startServer(options:ServerOptions) {
 const store=options.store??createWorkspaceStore(options.dataDir);
 let integration:ReturnType<typeof createIntegrationService>;
 try { integration=createIntegrationService(store,options.dataDir); }
 catch(error) { if(!options.store)store.close(); throw error; }
 const token=randomBytes(32).toString('hex');
 let port=options.port??4310;
 const webDir=resolve(options.webDir);
 const server=createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy','same-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  try {
   const allowedHosts=[`127.0.0.1:${port}`,`localhost:${port}`];
   if(!req.headers.host||!allowedHosts.includes(req.headers.host)) throw new HttpError('INVALID_HOST','Use the loopback URL printed by GitFlash.',403);
   if(req.headers.origin&&!allowedHosts.some(host=>req.headers.origin===`http://${host}`)) throw new HttpError('INVALID_ORIGIN','This request did not originate from your local GitFlash console.',403);
   if(req.headers['sec-fetch-site']==='cross-site') throw new HttpError('CROSS_SITE_REQUEST','Cross-site requests are not allowed.',403);
   const raw=req.url??'/';
   let decoded:string; try { decoded=decodeURIComponent(raw.split('?')[0]); } catch { throw new HttpError('INVALID_PATH','Invalid URL encoding.',400); }
   if(decoded.includes('\\')||decoded.includes('\0')||decoded.split('/').includes('..')) throw new HttpError('INVALID_PATH','Invalid asset path.',400);
   const url=new URL(raw,`http://127.0.0.1:${port}`);
   const path=url.pathname;
   if(req.method==='GET') {
    if(path==='/api/session') return json(res,{token});
    if(path==='/api/health') return json(res,{ok:true,local:true});
    if(path==='/api/state') return json(res,store.snapshot());
    if(path==='/api/templates') return json(res,listTemplates());
    if(path==='/api/export') { res.setHeader('Content-Disposition','attachment; filename="gitflash-company.json"'); return json(res,store.exportDefinition()); }
    if(path==='/api/integrations') return json(res,await integration.status());
    if(path==='/api/runs') return json(res,integration.runs());
    if(path.startsWith('/api/runs/')) { const run=integration.getRun(path.slice('/api/runs/'.length)); if(!run) throw new HttpError('NOT_FOUND','Run not found.',404); return json(res,run); }
    if(path==='/api/buzz/team') { res.setHeader('Content-Disposition','attachment; filename="gitflash.team.json"'); return json(res,integration.exportBuzzTeam(url.searchParams.get('companyId')??undefined)); }
   }
   if(req.method==='POST'&&path.startsWith('/api/')) {
    const supplied=req.headers['x-gitflash-token'];
    if(typeof supplied!=='string'||supplied.length!==token.length||!timingSafeEqual(Buffer.from(supplied),Buffer.from(token))) throw new HttpError('INVALID_SESSION','Reload the console to reconnect to this GitFlash session.',403);
    if(!req.headers['content-type']?.startsWith('application/json')) throw new HttpError('INVALID_CONTENT_TYPE','Send application/json.',415);
    const input=await body(req);
    if(path==='/api/preview') {
     if(!Array.isArray(input.commands)||!input.commands.length||input.commands.length>1000) throw new HttpError('INVALID_COMMANDS','Provide between 1 and 1000 company changes.',400);
     return json(res,store.preview(input.commands as DomainCommand[],revision(input.baseRevision),typeof input.summary==='string'?input.summary:undefined));
    }
    const template=path.match(/^\/api\/templates\/([a-z0-9-]+)\/preview$/);
    if(template) return json(res,store.preview([{type:'definition.import',definition:getTemplate(template[1])}],revision(input.baseRevision),`Create ${template[1]} company`));
    if(path==='/api/apply') return json(res,store.apply(requiredString(input.previewId,'previewId')));
    if(path==='/api/undo') return json(res,store.undo(requiredString(input.changeId,'changeId'),revision(input.baseRevision)));
    if(path==='/api/runs') return json(res,await integration.run({agentId:requiredString(input.agentId,'agentId'),task:requiredString(input.task,'task'),requestId:requiredString(input.requestId,'requestId'),...(input.transport==='buzz'?{transport:'buzz' as const}:{})}),202);
    if(path==='/api/slack/connect') { await integration.connectSlack(); return json(res,await integration.status()); }
    if(path==='/api/slack/disconnect') { await integration.disconnectSlack(); return json(res,await integration.status()); }
   }
   if(path.startsWith('/api/')) throw new HttpError('NOT_FOUND','API route not found.',404);
   if(req.method!=='GET'&&req.method!=='HEAD') throw new HttpError('METHOD_NOT_ALLOWED','Method not allowed.',405);
   const relative=decoded==='/'?'index.html':decoded.replace(/^\/+/, '');
   let file=resolve(webDir,relative);
   if(file!==webDir&&!file.startsWith(webDir+sep)) throw new HttpError('INVALID_PATH','Invalid asset path.',400);
   try { const info=await stat(file); if(!info.isFile()) throw new Error(); } catch { if(extname(relative)) throw new HttpError('NOT_FOUND','Asset not found.',404); file=resolve(webDir,'index.html'); }
   const bytes=await readFile(file);
   res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream','Cache-Control':file.endsWith('.html')?'no-store':'public, max-age=3600'});
   res.end(req.method==='HEAD'?undefined:bytes);
  } catch(error) {
   const e=error as {code?:string;message?:string;status?:number};
   const code=e.code??'INTERNAL_ERROR';
   const known=error instanceof HttpError||error?.constructor?.name==='DomainError'||error?.constructor?.name==='IntegrationError';
   const status=e.status??(/STALE|CONFLICT|BUSY|UNDO|REPLAY/i.test(code)?409:/NOT_FOUND/i.test(code)?404:known?400:500);
   json(res,{error:{code:known?code:'INTERNAL_ERROR',message:known?e.message:'GitFlash could not complete this request. Retry or restart the local server.'}},status);
  }
 });
 server.requestTimeout=30_000; server.headersTimeout=10_000;
 try { await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>{server.removeListener('error',reject);const address=server.address();if(address&&typeof address!=='string') port=address.port;resolve();});}); }
 catch(error) { await integration.close(); store.close(); throw error; }
 let closed=false;
 return {server,store,integration,url:`http://127.0.0.1:${port}`,port,close:async()=>{if(closed)return;closed=true;await integration.close();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));store.close();}};
}
