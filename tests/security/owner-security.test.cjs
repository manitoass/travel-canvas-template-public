'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {createApp}=require('../../src/server/http.cjs');
const {DatabaseSync}=require('../../src/server/database.cjs');
const PASSWORD='Travel Canvas is my private planning workspace 2026';
const rnd=()=>crypto.randomUUID();
async function instance(existingDir){
 const dir=existingDir||fs.mkdtempSync(path.join(os.tmpdir(),'tc-m4-security-'));
 const app=createApp({dir,port:0,backupInterval:0});const a=await app.listen();
 const ctx={app,dir,url:`http://127.0.0.1:${a.port}`,cookie:null,csrf:null,close:async()=>{await app.close();if(!existingDir)fs.rmSync(dir,{force:true,recursive:true});}};
 return ctx;
}
async function request(c,method,route,body,opts={}){
 const headers={...(body!==undefined?{'Content-Type':'application/json'}:{}),...(c.cookie?{Cookie:c.cookie}:{}),...(c.csrf?{'X-CSRF-Token':c.csrf}:{}),...(opts.headers||{})};
 if(opts.noCookie){delete headers.Cookie;delete headers['X-CSRF-Token'];}
 const res=await fetch(c.url+route,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
 const raw=await res.text();let json={};try{json=JSON.parse(raw);}catch{};
 return {code:res.status,body:json,headers:res.headers,raw};
}
async function setup(c){
 const token=fs.readFileSync(path.join(c.dir,'owner-setup-token.txt'),'utf8').trim();
 const r=await request(c,'POST','/api/auth/setup',{token,password:PASSWORD});assert.equal(r.code,201);
 c.cookie=r.headers.get('set-cookie').split(';')[0];c.csrf=r.body.csrfToken;
 return r.body.recoveryCodes;
}
async function login(c,password=PASSWORD){const r=await request(c,'POST','/api/auth/login',{password},{noCookie:true});if(r.code===200){c.cookie=r.headers.get('set-cookie').split(';')[0];c.csrf=r.body.csrfToken;}return r;}
async function current(c){const r=await request(c,'GET','/api/state');assert.equal(r.code,200);return r.body;}
async function save(c,mut){const before=await current(c),state=structuredClone(before.state);mut(state);return request(c,'POST','/api/operations',{type:'state',operationId:rnd(),baseRevision:before.revision,state});}

test('owner setup requires the one-time local code; password minimum and reuse rejected',async()=>{
 const c=await instance();try{
  assert.equal((await request(c,'GET','/api/auth/session')).body.needsSetup,true);
  assert.equal((await request(c,'POST','/api/auth/setup',{token:'wrong',password:PASSWORD})).code,403);
  const token=fs.readFileSync(path.join(c.dir,'owner-setup-token.txt'),'utf8').trim();
  assert.equal((await request(c,'POST','/api/auth/setup',{token,password:'short'})).code,400);
  assert.equal((await request(c,'GET','/api/state')).code,401);
  const codes=await setup(c);assert.equal(codes.length,8);
  assert.equal(fs.existsSync(path.join(c.dir,'owner-setup-token.txt')),false);
  assert.equal((await request(c,'POST','/api/auth/setup',{token,password:PASSWORD})).code,409);
 }finally{await c.close();}
});
test('every private endpoint denies unauthenticated calls including exports/import and restore',async()=>{
 const c=await instance();try{await setup(c);
  for(const route of ['/api/state','/api/export','/api/backups','/api/system/status'])assert.equal((await request(c,'GET',route,undefined,{noCookie:true})).code,401,route);
  for(const route of ['/api/operations','/api/import/preview','/api/backup','/api/restore/preview','/api/restore/commit'])assert.equal((await request(c,'POST',route,{}, {noCookie:true})).code,401,route);
  assert.equal((await request(c,'GET','/api/health',undefined,{noCookie:true})).code,200);
 }finally{await c.close();}
});
test('authenticated writes require CSRF and same origin; session cookies are HTTP-only',async()=>{
 const c=await instance();try{await setup(c);
  const session=await request(c,'GET','/api/auth/session');assert.equal(session.body.authenticated,true);assert.equal(session.body.csrfToken,c.csrf);
  assert.match(c.cookie,/^tc_session=/);
  const r=await request(c,'POST','/api/backup',{}, {headers:{'X-CSRF-Token':''}});assert.equal(r.code,403);
  assert.equal((await request(c,'POST','/api/backup',{}, {headers:{Origin:'https://malicious.example'}})).code,403);
  assert.equal((await request(c,'POST','/api/backup',{}, {headers:{'Sec-Fetch-Site':'cross-site'}})).code,403);
  assert.equal((await request(c,'POST','/api/backup',{})).code,201);
  const r2=await request(c,'GET','/');assert.match(r2.headers.get('content-security-policy'),/script-src 'self'/);
  assert.equal(r2.headers.get('x-frame-options'),'DENY');
 }finally{await c.close();}
});
test('sessions expire, logout invalidates session, and restart preserves valid owner login',async()=>{
 const c=await instance();try{await setup(c);
  assert.equal((await current(c)).revision,0);
  assert.equal((await request(c,'POST','/api/auth/logout',{})).code,200);
  assert.equal((await request(c,'GET','/api/state')).code,401);
  assert.equal((await login(c)).code,200);
  const hash=crypto.createHash('sha256').update(c.cookie.split('=')[1]).digest('hex');
  c.app.store.db.prepare('UPDATE owner_sessions SET expires_ms=? WHERE token_hash=?').run(Date.now()-5,hash);
  assert.equal((await request(c,'GET','/api/state')).code,401);
  assert.equal((await login(c)).code,200);
  await c.app.close();c.app=createApp({dir:c.dir,port:0,backupInterval:0});const a=await c.app.listen();c.url='http://127.0.0.1:'+a.port;
  assert.equal((await request(c,'GET','/api/state')).code,200);
 }finally{await c.app.close();fs.rmSync(c.dir,{recursive:true,force:true});}
});
test('wrong passwords rate limited and lockout persists across server restart',async()=>{
 const c=await instance();try{await setup(c);
  for(let i=0;i<4;i++)assert.equal((await login(c,'bad password')).code,401);
  assert.equal((await login(c,'bad password')).code,401);
  assert.equal((await login(c,PASSWORD)).code,429);
  await c.app.close();c.app=createApp({dir:c.dir,port:0,backupInterval:0});const addr=await c.app.listen();c.url='http://127.0.0.1:'+addr.port;
  assert.equal((await login(c,PASSWORD)).code,429);
 }finally{await c.app.close();fs.rmSync(c.dir,{recursive:true,force:true});}
});
test('recovery code resets password exactly once and invalidates all existing sessions',async()=>{
 const c=await instance();try{const codes=await setup(c);const oldCookie=c.cookie;
  assert.equal((await request(c,'POST','/api/auth/recover',{code:codes[0],password:'This is a different strong password 2026'})).code,200);
  assert.equal((await request(c,'GET','/api/state')).code,401);
  assert.equal((await login(c,PASSWORD)).code,401);
  assert.equal((await login(c,'This is a different strong password 2026')).code,200);
  assert.equal((await request(c,'POST','/api/auth/recover',{code:codes[0],password:PASSWORD})).code,401);
  assert.notEqual(c.cookie,oldCookie);
 }finally{await c.close();}
});
test('server backs up before migrating an existing milestone-3 database and retains data',async()=>{
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'tc-m4-migration-'));
 // M3 database fixture starts with schema 1. Extract it through its existing store.
 const {makeStore}=require('../../src/server/store.cjs');
 const seed=JSON.parse(fs.readFileSync(path.join(__dirname,'../../public/seed.json'),'utf8'));
 const first=makeStore(dataDir,seed);
 first.db.prepare('UPDATE document_state SET content=? WHERE id=1').run(JSON.stringify({...seed,title:'Protected pre-M4 trip'}));first.close();
 const c=await instance(dataDir);try{
  assert.equal(c.app.store.db.prepare('SELECT MAX(version) AS v FROM schema_migrations').get().v,2);
  const backup=c.app.store.listBackups().find(x=>x.filename.includes('pre-m4-upgrade'));
  assert.ok(backup&&backup.verified);
  await setup(c);assert.equal((await current(c)).state.title,'Protected pre-M4 trip');
 }finally{await c.app.close();fs.rmSync(dataDir,{recursive:true,force:true});}
});
test('verified backup restore creates pre-restore snapshot and preserves login',async()=>{
 const c=await instance();try{await setup(c);
  let a=await save(c,s=>{s.journeyVersions[0].name='Before backup';});assert.equal(a.code,200);
  const backup=await request(c,'POST','/api/backup',{});assert.equal(backup.code,201);
  a=await save(c,s=>{s.journeyVersions[0].name='After backup';});assert.equal(a.code,200);
  assert.equal((await current(c)).state.journeyVersions[0].name,'After backup');
  const preview=await request(c,'POST','/api/restore/preview',{filename:backup.body.filename});assert.equal(preview.code,200);
  assert.equal(preview.body.counts.journeys,1);
  assert.equal((await request(c,'POST','/api/restore/commit',{filename:backup.body.filename,baseRevision:2,operationId:rnd(),password:'wrong'})).code,403);
  const result=await request(c,'POST','/api/restore/commit',{filename:backup.body.filename,baseRevision:2,operationId:rnd(),password:PASSWORD});
  assert.equal(result.code,200);assert.equal(result.body.revision,3);
  assert.equal((await current(c)).state.journeyVersions[0].name,'Before backup');
  assert.ok(c.app.store.listBackups().some(x=>x.filename.includes('pre-restore')));
  assert.equal((await request(c,'GET','/api/auth/session')).body.authenticated,true);
 }finally{await c.close();}
});
test('damaged backup, path traversal and stale restore cannot overwrite current trips',async()=>{
 const c=await instance();try{await setup(c);
  const b=await request(c,'POST','/api/backup',{});
  assert.equal((await request(c,'POST','/api/restore/preview',{filename:'../../other.sqlite'})).code,400);
  assert.equal((await request(c,'POST','/api/restore/commit',{filename:b.body.filename,baseRevision:55,operationId:rnd(),password:PASSWORD})).code,409);
  const file=path.join(c.dir,'backups',b.body.filename);fs.writeFileSync(file,'corrupted');
  assert.equal((await request(c,'POST','/api/restore/preview',{filename:b.body.filename})).code,422);
  assert.equal((await current(c)).revision,0);
 }finally{await c.close();}
});
test('off-device backup directory receives a verified readable replica',async()=>{
 const target=fs.mkdtempSync(path.join(os.tmpdir(),'tc-other-drive-'));
 const saved=process.env.TRAVEL_CANVAS_OFFSITE_BACKUP_DIR;
 process.env.TRAVEL_CANVAS_OFFSITE_BACKUP_DIR=target;
 const c=await instance();try{await setup(c);const b=await request(c,'POST','/api/backup',{});assert.equal(b.body.offsite,true);
  const db=new DatabaseSync(path.join(target,b.body.filename),{readOnly:true});assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');db.close();
  assert.equal((await request(c,'GET','/api/backups')).body.offsite.verified,true);
  fs.writeFileSync(path.join(target,b.body.filename),'damaged external copy');
  assert.equal((await request(c,'GET','/api/backups')).body.offsite.verified,false);
 }finally{await c.close();fs.rmSync(target,{recursive:true,force:true});if(saved===undefined)delete process.env.TRAVEL_CANVAS_OFFSITE_BACKUP_DIR;else process.env.TRAVEL_CANVAS_OFFSITE_BACKUP_DIR=saved;}
});
test('server still refuses arbitrary LAN binding and private code/file exposure',async()=>{
 assert.throws(()=>createApp({host:'0.0.0.0',port:0}),/Refusing network binding/);
 const c=await instance();try{await setup(c);
  assert.equal((await request(c,'GET','/src/server/auth.cjs')).code,404);
  assert.equal((await request(c,'GET','/data/travel-canvas.sqlite')).code,404);
 }finally{await c.close();}
});

test('independent full SQLite disaster restore recovers owner and journeys after local shutdown',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tc-m4-disaster-'));
 const c=await instance(dir);
 try{
  await setup(c);
  assert.equal((await save(c,s=>{s.journeyVersions[0].name='Safe archived journey';})).code,200);
  const backup=await request(c,'POST','/api/backup',{});
  assert.equal(backup.code,201);
  assert.equal((await save(c,s=>{s.journeyVersions[0].name='Accidental later change';})).code,200);
  await c.app.close();
  const {execFileSync}=require('node:child_process');
  const output=execFileSync(process.execPath,['--experimental-sqlite','scripts/emergency-restore.cjs',path.join(dir,'backups',backup.body.filename),dir],{cwd:path.join(__dirname,'../..'),encoding:'utf8'});
  assert.match(output,/RESTORE VERIFIED/);
  const resumed=await instance(dir);
  try{
   const logged=await login(resumed);
   assert.equal(logged.code,200);
   assert.equal((await current(resumed)).state.journeyVersions[0].name,'Safe archived journey');
  }finally{await resumed.app.close();}
 }finally{try{await c.app.close();}catch{}fs.rmSync(dir,{recursive:true,force:true});}
});
