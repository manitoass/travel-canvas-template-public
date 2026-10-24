'use strict';
// Single-owner authentication.  No application secrets are sent in logs.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {promisify} = require('node:util');
const scrypt = promisify(crypto.scrypt);
const {ApiError} = require('./store.cjs');
const PASSWORD_PARAMS = {N:131072,r:8,p:1,maxmem:256*1024*1024};
const SESSION_AGE = 7 * 24 * 60 * 60 * 1000;
const THROTTLE = 15 * 60 * 1000;
const hex = n => crypto.randomBytes(n).toString('hex');
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
function secureCompare(a,b) {
 const x=Buffer.from(String(a)), y=Buffer.from(String(b));
 return x.length===y.length && crypto.timingSafeEqual(x,y);
}
function validatePassword(p) {
 if(typeof p!=='string'||p.length<12||Buffer.byteLength(p)>1024||p.trim()!==p||!p.trim())throw new ApiError(400,'Use a password of at least 12 characters without leading/trailing spaces.');
}
async function passwordHash(password) {
 validatePassword(password);
 const salt=hex(16);
 const key=await scrypt(password,Buffer.from(salt,'hex'),64,PASSWORD_PARAMS);
 return `scrypt$${PASSWORD_PARAMS.N}$${PASSWORD_PARAMS.r}$${PASSWORD_PARAMS.p}$${salt}$${key.toString('hex')}`;
}
async function verifyPassword(password,stored){
 const parts=String(stored||'').split('$');
 if(parts.length!==6||parts[0]!=='scrypt')return false;
 const [n,r,p]=parts.slice(1,4).map(Number);
 if(n!==PASSWORD_PARAMS.N||r!==PASSWORD_PARAMS.r||p!==PASSWORD_PARAMS.p)return false;
 if(typeof password!=='string'||Buffer.byteLength(password)>1024)return false;
 const key=await scrypt(password,Buffer.from(parts[4],'hex'),64,PASSWORD_PARAMS);
 return secureCompare(key.toString('hex'),parts[5]);
}
function migrateAuth(db){
 const current=db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get().version||1;
 if(current>=2)return false;
 db.exec('BEGIN IMMEDIATE');
 try{
  db.exec(`CREATE TABLE IF NOT EXISTS owner_account(id INTEGER PRIMARY KEY CHECK(id=1),password_hash TEXT NOT NULL,created_at TEXT NOT NULL,changed_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS owner_sessions(token_hash TEXT PRIMARY KEY, csrf_token TEXT NOT NULL,created_ms INTEGER NOT NULL,expires_ms INTEGER NOT NULL,last_seen_ms INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS recovery_codes(hash TEXT PRIMARY KEY,created_at TEXT NOT NULL,used_at TEXT);
CREATE TABLE IF NOT EXISTS login_limits(source_hash TEXT PRIMARY KEY,failures INTEGER NOT NULL,window_ms INTEGER NOT NULL,locked_until_ms INTEGER NOT NULL);
INSERT INTO schema_migrations(version,applied_at) VALUES (2,datetime('now'));`);
  db.exec('COMMIT');return true;
 }catch(e){db.exec('ROLLBACK');throw e;}
}
function createAuth(store,dataDir){
 const db=store.db;
 const setupFile=path.join(dataDir,'owner-setup-token.txt');
 const ownerExists=()=>!!db.prepare('SELECT id FROM owner_account WHERE id=1').get();
 if(!ownerExists()&&!fs.existsSync(setupFile))fs.writeFileSync(setupFile,hex(24)+'\n',{mode:0o600,flag:'wx'});
 function setupTokenHint(){return setupFile;}
 function rateKey(ip){return sha('tc-login:'+ip);}
 function checkRate(ip){
  const row=db.prepare('SELECT * FROM login_limits WHERE source_hash=?').get(rateKey(ip));
  if(row&&row.locked_until_ms>Date.now())throw new ApiError(429,'Too many attempts. Try again in 15 minutes.');
 }
 function markFailure(ip){
  const key=rateKey(ip),now=Date.now(),r=db.prepare('SELECT * FROM login_limits WHERE source_hash=?').get(key);
  const failures=r&&now-r.window_ms<THROTTLE?r.failures+1:1;
  db.prepare('INSERT INTO login_limits(source_hash,failures,window_ms,locked_until_ms) VALUES(?,?,?,?) ON CONFLICT(source_hash) DO UPDATE SET failures=excluded.failures,window_ms=excluded.window_ms,locked_until_ms=excluded.locked_until_ms').run(key,failures,r&&now-r.window_ms<THROTTLE?r.window_ms:now,failures>=5?now+THROTTLE:0);
 }
 function clearFailure(ip){db.prepare('DELETE FROM login_limits WHERE source_hash=?').run(rateKey(ip));}
 function codes(){return Array.from({length:8},()=>crypto.randomBytes(12).toString('hex').match(/.{1,6}/g).join('-'));}
 function storeCodes(items){db.prepare('DELETE FROM recovery_codes').run();const stmt=db.prepare('INSERT INTO recovery_codes(hash,created_at,used_at) VALUES(?,?,NULL)');for(const code of items)stmt.run(sha(code.replaceAll('-','').toLowerCase()),new Date().toISOString());}
 async function setup(token,password,ip){
  if(ownerExists())throw new ApiError(409,'Owner already configured');
  checkRate(ip);
  const expected=fs.existsSync(setupFile)?fs.readFileSync(setupFile,'utf8').trim():'';
  if(!expected||!secureCompare(token,expected)){markFailure(ip);throw new ApiError(403,'Invalid setup code');}
  const hashed=await passwordHash(password),generated=codes(),now=new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');try{
   db.prepare('INSERT INTO owner_account(id,password_hash,created_at,changed_at) VALUES(1,?,?,?)').run(hashed,now,now);
   storeCodes(generated);db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
  fs.rmSync(setupFile,{force:true});clearFailure(ip);
  return generated;
 }
 function newSession(){
  const token=hex(32),csrf=hex(32),now=Date.now();
  db.prepare('DELETE FROM owner_sessions WHERE expires_ms<?').run(now);
  db.prepare('INSERT INTO owner_sessions(token_hash,csrf_token,created_ms,expires_ms,last_seen_ms) VALUES(?,?,?,?,?)').run(sha(token),csrf,now,now+SESSION_AGE,now);
  return {token,csrf,expiresMs:now+SESSION_AGE};
 }
 async function login(password,ip){
  checkRate(ip);
  const owner=db.prepare('SELECT password_hash FROM owner_account WHERE id=1').get();
  if(!owner)throw new ApiError(409,'Owner setup required');
  if(!await verifyPassword(password,owner.password_hash)){markFailure(ip);throw new ApiError(401,'Incorrect password');}
  clearFailure(ip);return newSession();
 }
 function readSession(req){
  const cookie=String(req.headers.cookie||'');
  const pairs=cookie.split(';').map(x=>x.trim().split('='));
  const raw=pairs.find(([key])=>key==='tc_session'||key==='__Host-tc_session')?.[1];
  if(!raw||!(/^[0-9a-f]{64}$/.test(raw)))return null;
  const row=db.prepare('SELECT * FROM owner_sessions WHERE token_hash=? AND expires_ms>?').get(sha(raw),Date.now());
  if(!row)return null;
  if(Date.now()-row.last_seen_ms>60000)db.prepare('UPDATE owner_sessions SET last_seen_ms=? WHERE token_hash=?').run(Date.now(),sha(raw));
  return {hash:sha(raw),csrf:row.csrf_token,expiresMs:row.expires_ms};
 }
 function requireSession(req){const session=readSession(req);if(!session)throw new ApiError(401,'Please sign in to continue.');return session;}
 function requireCSRF(req,session){if(!secureCompare(req.headers['x-csrf-token']||'',session.csrf))throw new ApiError(403,'Invalid or missing CSRF token');}
 function logout(session){db.prepare('DELETE FROM owner_sessions WHERE token_hash=?').run(session.hash);}
 async function restorePassword(code,password,ip){
  checkRate(ip);validatePassword(password);
  if(typeof code!=='string'||!(/^[0-9a-f-]{20,40}$/i.test(code))){markFailure(ip);throw new ApiError(401,'Invalid recovery code');}
  const hash=sha(code.replaceAll('-','').toLowerCase());
  const entry=db.prepare('SELECT hash FROM recovery_codes WHERE hash=? AND used_at IS NULL').get(hash);
  if(!entry){markFailure(ip);throw new ApiError(401,'Invalid recovery code');}
  const hashed=await passwordHash(password),now=new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');try{
   const claim=db.prepare('UPDATE recovery_codes SET used_at=? WHERE hash=? AND used_at IS NULL').run(now,hash);
   if(claim.changes!==1)throw new ApiError(409,'Recovery code already used');
   db.prepare('UPDATE owner_account SET password_hash=?,changed_at=? WHERE id=1').run(hashed,now);
   db.prepare('DELETE FROM owner_sessions').run();db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
  clearFailure(ip);return true;
 }
 async function verifyCurrentPassword(password){const row=db.prepare('SELECT password_hash FROM owner_account WHERE id=1').get();return !!row&&await verifyPassword(password,row.password_hash);}
 function close(){/* database is owned by store */}
 return {ownerExists,setupTokenHint,setup,login,logout,readSession,requireSession,requireCSRF,restorePassword,verifyCurrentPassword,close};
}
module.exports={migrateAuth,createAuth,passwordHash,verifyPassword};
