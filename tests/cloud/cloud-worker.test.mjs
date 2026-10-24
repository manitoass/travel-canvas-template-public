import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {webcrypto} from 'node:crypto';
import {createWorker} from '../../src/cloud/handler.mjs';
import {resetAccessKeyCache} from '../../src/cloud/access.mjs';
import {validateState,counts,fingerprint} from '../../src/cloud/validation.mjs';
const require=createRequire(import.meta.url);
const {applyPlanningOperation}=require('../../dist/engine/planning.js');
const legacy=require('../../src/server/validation.cjs');
const seed=JSON.parse(readFileSync(new URL('../../public/seed.json',import.meta.url),'utf8'));
const migration=readFileSync(new URL('../../migrations/0001_initial.sql',import.meta.url),'utf8');
const base='https://travel-canvas.account.workers.dev';
const team='journey-dev.cloudflareaccess.com';
const owner='owner@example.com';
const aud='d31b56d68b247855e488';
const envAttrs={ACCESS_TEAM_DOMAIN:team,ACCESS_AUD:aud,ACCESS_OWNER_EMAIL:owner};
const enc=new TextEncoder();
const b64url=b=>Buffer.from(b).toString('base64url');
let signing=null,jwks=null;
class TestDB{
  constructor(db=null,skipMigration=false){this.raw=db||new DatabaseSync(':memory:');if(!skipMigration)this.raw.exec(migration);}
  prepare(sql){const owner=this;let params=[];
    const stmt={bind(...items){params=items;return stmt;},
      async first(){return owner.raw.prepare(sql).get(...params)||null;},
      async all(){return {results:owner.raw.prepare(sql).all(...params)};},
      async run(){return stmt._run();},
      _run(){return {meta:{changes:owner.raw.prepare(sql).run(...params).changes}};}};
    return stmt;
  }

  async batch(stmts){const results=[];this.raw.exec('BEGIN IMMEDIATE');try{for(const stmt of stmts)results.push(stmt._run());this.raw.exec('COMMIT');return results;}catch(e){this.raw.exec('ROLLBACK');throw e;}}
}
let worker;
function makeEnv(db=new TestDB(),other={}){return {DB:db,ASSETS:{fetch:async()=>new Response('<h1>Travel Canvas</h1>',{headers:{'Content-Type':'text/html'}})},...envAttrs,...other};}
async function signJwt(claimOverride={},headers={}){
 const now=Math.floor(Date.now()/1000);
 const h={alg:'RS256',kid:'travel-canvas-kid',typ:'JWT',...headers};
 const p={iss:`https://${team}`,aud:[aud],email:owner,iat:now-10,nbf:now-10,exp:now+3600,...claimOverride};
 const unsigned=b64url(JSON.stringify(h))+'.'+b64url(JSON.stringify(p));
 const sig=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',signing.privateKey,enc.encode(unsigned));
 return unsigned+'.'+b64url(sig);
}
async function request(env,path='/api/state',{method='GET',body,auth=true,headers={},claimOverride={}}={}){
 const h=new Headers();
 if(auth)h.set('Cf-Access-Jwt-Assertion',await signJwt(claimOverride));
 if(method==='POST'){h.set('Content-Type','application/json');h.set('X-Travel-Canvas-Write','1');h.set('Origin',base);}
 for(const [name,value] of Object.entries(headers))h.set(name,value);
 const req=new Request(base+path,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)});
 const res=await worker.fetch(req,env);
 const payload=await res.json().catch(()=>({}));
 return {status:res.status,payload,headers:res.headers};
}
before(async()=>{
 signing=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const pub=await crypto.subtle.exportKey('jwk',signing.publicKey);jwks={keys:[{...pub,kid:'travel-canvas-kid',alg:'RS256',use:'sig'}]};
 worker=createWorker({seed,applyPlanningOperation,fetchCerts:async()=>Response.json(jwks)});
});

test('port validates same 6-leg seed as NAS contract',()=>{
 assert.deepEqual(validateState(seed),legacy.validateState(seed));assert.deepEqual(counts(seed),legacy.counts(seed));
});
test('identity verification rejects missing Cloudflare setup (fail closed)',async()=>{
 const env=makeEnv(undefined,{ACCESS_AUD:''});const r=await request(env,'/');assert.equal(r.status,503);
});
test('unprotected requests cannot see HTML or plan data',async()=>{
 const env=makeEnv();assert.equal((await request(env,'/',{auth:false})).status,401);
 assert.equal((await request(env,'/api/state',{auth:false})).status,401);
});
test('JWT is cryptographically verified before returning private plans',async()=>{
 const env=makeEnv();assert.equal((await request(env)).status,200);
 assert.equal((await request(env,'/api/state',{claimOverride:{aud:['different-audience']}})).status,401);
 assert.equal((await request(env,'/api/state',{claimOverride:{email:'another@example.com'}})).status,403);
 assert.equal((await request(env,'/api/state',{claimOverride:{exp:Math.floor(Date.now()/1000)-5}})).status,401);
 const token=await signJwt();const damaged=token.slice(0,-8)+'aaaaaaaa';
 const r=await request(env,'/api/state',{auth:false,headers:{'Cf-Access-Jwt-Assertion':damaged}});
 assert.equal(r.status,401);
});
test('a different Access team domain cannot impersonate owner',async()=>{
 const env=makeEnv();const r=await request(env,'/api/state',{claimOverride:{iss:'https://other.cloudflareaccess.com'}});assert.equal(r.status,401);
});
test('static assets protected and return secure headers',async()=>{
 const r=await request(makeEnv(),'/');assert.equal(r.status,200);assert.match(r.headers.get('Content-Security-Policy'),/script-src 'self'/);
});
test('first read creates the single initial database row and second read preserves it',async()=>{
 const env=makeEnv();const one=await request(env);const two=await request(env);
 assert.equal(one.status,200);assert.equal(one.payload.revision,0);assert.deepEqual(one.payload.state,seed);assert.deepEqual(one.payload,two.payload);
});
test('GET auth/session uses verified Cloudflare Access email (no password account)',async()=>{
 const r=await request(makeEnv(),'/api/auth/session');assert.equal(r.status,200);assert.equal(r.payload.username,owner);assert.equal(r.payload.needsSetup,false);
});
test('state edit saves and returns revision and canonical data',async()=>{
 const env=makeEnv(),s=(await request(env)).payload,n=structuredClone(s.state);
 n.journeyVersions[0].name='Test journey';
 const op={type:'state',operationId:'op-save-123456',baseRevision:0,state:n};
 const r=await request(env,'/api/operations',{method:'POST',body:op});
 assert.equal(r.status,200);assert.equal(r.payload.revision,1);
 assert.equal((await request(env)).payload.state.journeyVersions[0].name,'Test journey');
});
test('same operation returns same revision with duplicate and no second mutation',async()=>{
 const env=makeEnv(),n=structuredClone((await request(env)).payload.state);
 n.journeyVersions[0].name='Idempotent';const op={type:'state',operationId:'repeat-123456789',baseRevision:0,state:n};
 assert.equal((await request(env,'/api/operations',{method:'POST',body:op})).status,200);
 const second=await request(env,'/api/operations',{method:'POST',body:op});
 assert.equal(second.payload.duplicate,true);assert.equal((await request(env)).payload.revision,1);
});
test('stale browser cannot overwrite a newer browser (revision 409)',async()=>{
 const env=makeEnv(),n=structuredClone((await request(env)).payload.state);n.journeyVersions[0].name='Winner';
 await request(env,'/api/operations',{method:'POST',body:{type:'state',operationId:'winner-12345678',baseRevision:0,state:n}});
 const bad=await request(env,'/api/operations',{method:'POST',body:{type:'state',operationId:'loser-123456789',baseRevision:0,state:seed}});
 assert.equal(bad.status,409);assert.equal(bad.payload.currentRevision,1);assert.equal((await request(env)).payload.state.journeyVersions[0].name,'Winner');
});
test('state edit rejects duplicate stay IDs and retains database',async()=>{
 const env=makeEnv();await request(env);const bad=structuredClone(seed);
 bad.journeyVersions[0].legs[0].scenarios[0].stays[1].id=bad.journeyVersions[0].legs[0].scenarios[0].stays[0].id;
 const r=await request(env,'/api/operations',{method:'POST',body:{type:'state',operationId:'bad-state-123456',baseRevision:0,state:bad}});
 assert.equal(r.status,422);assert.equal((await request(env)).payload.revision,0);
});
test('planning op uses original engine and rejects mismatched frontend projection',async()=>{
 const env=makeEnv();await request(env);
 const op={kind:'stay',id:'sea1',mode:'move',delta:1};const prediction=applyPlanningOperation(seed,op);
 assert.equal(prediction.valid,true);
 const accepted=await request(env,'/api/operations',{method:'POST',body:{type:'planning',operationId:'engine-123456789',baseRevision:0,operation:op,state:prediction.state}});
 assert.equal(accepted.status,200);assert.equal(accepted.payload.state.journeyVersions[0].legs.find(l=>l.title==='Southeast Asia').scenarios[0].stays.find(st=>st.id==='sea1').start,'2027-02-11');
 const secondOp={kind:'stay',id:'sea1',mode:'move',delta:1};
 const mismatch=await request(env,'/api/operations',{method:'POST',body:{type:'planning',operationId:'mismatch-12345678',baseRevision:1,operation:secondOp,state:seed}});
 assert.equal(mismatch.status,409);assert.equal((await request(env)).payload.revision,1);
});
test('import preview and additive commit preserve original plans and remap IDs',async()=>{
 const env=makeEnv();await request(env);
 const backup={format:'travel-canvas-prototype',version:1,state:seed};
 const p=await request(env,'/api/import/preview',{method:'POST',body:backup});
 assert.equal(p.status,200);assert.equal(p.payload.counts.journeys,1);
 const commit=await request(env,'/api/operations',{method:'POST',body:{type:'import',baseRevision:0,operationId:'import-123456789',backup,previewHash:p.payload.hash}});
 assert.equal(commit.status,200);assert.equal(commit.payload.state.journeyVersions.length,2);
 assert.notEqual(commit.payload.state.journeyVersions[0].id,commit.payload.state.journeyVersions[1].id);
 const b=await request(env,'/api/backups');assert.ok(b.payload.backups.some(x=>x.kind==='pre-import'));
});
test('import file modification after preview is rejected without data loss',async()=>{
 const env=makeEnv();await request(env);const backup={format:'travel-canvas-prototype',version:1,state:seed};
 const res=await request(env,'/api/operations',{method:'POST',body:{type:'import',baseRevision:0,operationId:'tamper-12345678',backup,previewHash:'wrong'}});
 assert.equal(res.status,409);assert.equal((await request(env)).payload.revision,0);
});
test('manual snapshot can be previewed and restored, preserving a pre-restore snapshot',async()=>{
 const env=makeEnv();await request(env);
 const snap=await request(env,'/api/backup',{method:'POST',body:{}});assert.equal(snap.status,201);
 const n=structuredClone(seed);n.journeyVersions[0].name='Changed later';
 await request(env,'/api/operations',{method:'POST',body:{type:'state',operationId:'post-snapshot-12',baseRevision:0,state:n}});
 const preview=await request(env,'/api/restore/preview',{method:'POST',body:{snapshotId:snap.payload.id}});
 assert.equal(preview.status,200);assert.equal(preview.payload.currentRevision,1);
 const restored=await request(env,'/api/restore/commit',{method:'POST',body:{snapshotId:snap.payload.id,baseRevision:1,operationId:'restore-123456789',confirm:'RESTORE'}});
 assert.equal(restored.status,200);assert.equal(restored.payload.revision,2);
 assert.deepEqual(restored.payload.state,seed);
 const list=await request(env,'/api/backups');assert.ok(list.payload.backups.some(x=>x.kind==='pre-restore'));
});
test('restore fails closed without explicit typed confirmation',async()=>{
 const env=makeEnv();await request(env);const snap=(await request(env,'/api/backup',{method:'POST',body:{}})).payload;
 const r=await request(env,'/api/restore/commit',{method:'POST',body:{snapshotId:snap.id,baseRevision:0,operationId:'restore-no-123456',confirm:'yes'}});
 assert.equal(r.status,400);assert.equal((await request(env)).payload.revision,0);
});
test('automatic daily snapshots are created and limited to the last 14',async()=>{
 const env=makeEnv();await request(env);
 for(let i=0;i<17;i++)await worker.scheduled({},env);
 const r=await request(env,'/api/backups');assert.equal(r.status,200);
 assert.equal(r.payload.backups.filter(x=>x.kind==='daily').length,14);
});
test('write without custom header is rejected even if Access cookie is valid',async()=>{
 const env=makeEnv();await request(env);
 const r=await request(env,'/api/operations',{method:'POST',body:{type:'state',operationId:'bad-headers-123456',baseRevision:0,state:seed},headers:{'X-Travel-Canvas-Write':'invalid'}});
 assert.equal(r.status,403);
});
test('write from another origin or cross-site is blocked',async()=>{
 const env=makeEnv();await request(env);
 const req={type:'state',operationId:'bad-origin-1234567',baseRevision:0,state:seed};
 assert.equal((await request(env,'/api/operations',{method:'POST',body:req,headers:{Origin:'https://evil.test'}})).status,403);
 assert.equal((await request(env,'/api/operations',{method:'POST',body:req,headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
});
test('oversized requests cannot exhaust D1',async()=>{
 const env=makeEnv();await request(env);
 const r=await request(env,'/api/operations',{method:'POST',body:{large:'x'.repeat(4*1024*1024)}});
 assert.equal(r.status,413);
});
test('invalid database binding never writes or serves private plans',async()=>{
 const env=makeEnv(null,{DB:null});const r=await request(env);assert.equal(r.status,503);
});
test('export is a portable prototype JSON with a download filename',async()=>{
 const env=makeEnv();await request(env);
 const r=await request(env,'/api/export');assert.equal(r.status,200);assert.equal(r.payload.format,'travel-canvas-prototype');assert.equal(r.payload.state.journeyVersions.length,1);
 assert.match(r.headers.get('Content-Disposition'),/attachment/);
});
test('wrong/malformed Content-Type and unknown mutation rejected',async()=>{
 const env=makeEnv();await request(env);
 const bad=await request(env,'/api/operations',{method:'POST',body:{type:'not-real',operationId:'op-unknown-1234',baseRevision:0}});
 assert.equal(bad.status,400);
 const res=await worker.fetch(new Request(base+'/api/operations',{method:'POST',headers:{'Origin':base,'Content-Type':'text/plain','X-Travel-Canvas-Write':'1','Cf-Access-Jwt-Assertion':await signJwt()},body:'whatever'}),env);
 assert.equal(res.status,415);
});

test('first authenticated request creates D1 schema without owner entering SQL',async()=>{
 const db=new TestDB(null,true),env=makeEnv(db);
 const r=await request(env,'/api/state');
 assert.equal(r.status,200);assert.equal(r.payload.revision,0);
 const tables=db.raw.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('document_state','operation_history','snapshots')").all().map(x=>x.name).sort();
 assert.deepEqual(tables,['document_state','operation_history','snapshots']);
 assert.equal((await request(env,'/api/backups')).status,200);
});
