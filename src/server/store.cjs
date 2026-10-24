'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {DatabaseSync,backup}=require('./database.cjs');
const {randomUUID}=require('node:crypto');
const {validateState,counts,importBackup,remapImportedPlans,fingerprint}=require('./validation.cjs');
const {applyPlanningOperation}=require('../../dist/engine/planning.js');

class ApiError extends Error {constructor(status,message,extra={}){super(message);this.status=status;this.extra=extra;}}
function makeStore(dataDir,seed){
 fs.mkdirSync(dataDir,{recursive:true,mode:0o700});
 const file=path.join(dataDir,'travel-canvas.sqlite');
 const db=new DatabaseSync(file);
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS document_state (
 id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL CHECK(revision>=0),
 content TEXT NOT NULL, updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS operation_history (
 operation_id TEXT PRIMARY KEY, payload_hash TEXT NOT NULL, revision INTEGER NOT NULL,
 response TEXT NOT NULL, kind TEXT NOT NULL, applied_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS operation_history_recent ON operation_history(applied_at);
 CREATE TABLE IF NOT EXISTS backup_records (
 file TEXT PRIMARY KEY, revision INTEGER NOT NULL, created_at TEXT NOT NULL, integrity TEXT NOT NULL);
 INSERT OR IGNORE INTO schema_migrations VALUES (1,datetime('now'));`);
 if(!db.prepare('SELECT id FROM document_state WHERE id=1').get()){
  const initial=validateState(seed);
  db.prepare('INSERT INTO document_state(id,revision,content,updated_at) VALUES(1,0,?,?)')
    .run(JSON.stringify(initial),new Date().toISOString());
 }
 const state = () => {
  const row=db.prepare('SELECT revision,content,updated_at FROM document_state WHERE id=1').get();
  return {revision:row.revision,state:JSON.parse(row.content),updatedAt:row.updated_at};
 };
 function checkIntegrity(){const out=db.prepare('PRAGMA quick_check').all().map(x=>x.quick_check);return out.length===1&&out[0]==='ok';}
 function applyMutation(req){
  if(typeof req.operationId!=='string'||!/^[-_a-zA-Z0-9]{8,128}$/.test(req.operationId))throw new ApiError(400,'Invalid operation ID');
  if(!Number.isSafeInteger(req.baseRevision)||req.baseRevision<0)throw new ApiError(400,'Invalid base revision');
  if(!['state','planning','import'].includes(req.type))throw new ApiError(400,'Unknown operation type');
  const hash=fingerprint(req);
  db.exec('BEGIN IMMEDIATE');
  try{
   const old=db.prepare('SELECT payload_hash,response FROM operation_history WHERE operation_id=?').get(req.operationId);
   if(old){if(old.payload_hash!==hash)throw new ApiError(409,'Operation ID already used with different contents');
    db.exec('COMMIT');return {...JSON.parse(old.response),duplicate:true};}
   const previous=state();
   if(req.baseRevision!==previous.revision)throw new ApiError(409,'This plan changed in another browser.',{currentRevision:previous.revision});
   let next;
   if(req.type==='planning'){
    const op=req.operation;
    if(!op||!['stay','leg'].includes(op.kind)||typeof op.id!=='string'||!Number.isInteger(op.delta)||Math.abs(op.delta)>5000||(op.kind==='stay'&&!['move','left','right'].includes(op.mode)))throw new ApiError(400,'Invalid calendar operation');
    const result=applyPlanningOperation(previous.state,op);
    if(!result.valid)throw new ApiError(422,result.reason);
    next=validateState(result.state);
    // A mismatch means two versions of the planning rules produced a different result.
    if(req.state && fingerprint(withoutUIPreferences(next))!==fingerprint(withoutUIPreferences(validateState(req.state))))throw new ApiError(409,'Calendar changed differently on the server. No change saved.',{currentRevision:previous.revision});
   } else if(req.type==='import'){
    const imported=importBackup(req.backup);
    if(req.previewHash!==fingerprint(imported))throw new ApiError(409,'The import file changed since preview.');
    next=remapImportedPlans(previous.state,imported);
   } else next=validateState(req.state);
   const revision=previous.revision+1;
   const at=new Date().toISOString();
   db.prepare('UPDATE document_state SET revision=?,content=?,updated_at=? WHERE id=1').run(revision,JSON.stringify(next),at);
   const response={revision,state:next,updatedAt:at,operationId:req.operationId};
   db.prepare('INSERT INTO operation_history(operation_id,payload_hash,revision,response,kind,applied_at) VALUES(?,?,?,?,?,?)')
     .run(req.operationId,hash,revision,JSON.stringify(response),req.type,at);
   db.exec('COMMIT');return response;
  }catch(e){try{db.exec('ROLLBACK');}catch{}throw e;}
 }
 function importPreview(fileContent){const imported=importBackup(fileContent);
  return {valid:true,hash:fingerprint(imported),counts:counts(imported),journeyNames:imported.journeyVersions.map(j=>j.name),mode:'add-new-plans',currentRevision:state().revision};}
 async function makeBackup(reason='automatic'){
  const backups=path.join(dataDir,'backups');fs.mkdirSync(backups,{recursive:true,mode:0o700});
  const at=new Date().toISOString(),now=at.replaceAll(':','-').replaceAll('.','-');
  const filename=`travel-canvas-r${state().revision}-${now}-${randomUUID().slice(0,8)}-${reason}.sqlite`;
  const target=path.join(backups,filename);
  await backup(db,target);
  const verify=new DatabaseSync(target);let integrity='FAILED';
  try{verify.exec('PRAGMA wal_checkpoint(TRUNCATE)');verify.exec('PRAGMA journal_mode=DELETE');integrity=verify.prepare('PRAGMA integrity_check').all().map(x=>x.integrity_check).join('|');}finally{verify.close();}
  if(integrity!=='ok'){fs.unlinkSync(target);throw new ApiError(500,'Backup integrity check failed');}
  db.prepare('INSERT INTO backup_records(file,revision,created_at,integrity) VALUES(?,?,?,?)').run(filename,state().revision,at,integrity);
  // Retain the 14 most recent automatic snapshots; never auto-delete manual/pre-import backups.
  if(reason==='daily'||reason==='startup'){
    const expired=db.prepare("SELECT file FROM backup_records WHERE file LIKE '%-daily.sqlite' OR file LIKE '%-startup.sqlite' ORDER BY created_at DESC LIMIT -1 OFFSET 14").all();
    for(const row of expired){try{for(const suffix of ['', '-wal', '-shm']){const f=path.join(backups,row.file+suffix);if(fs.existsSync(f))fs.unlinkSync(f);}db.prepare('DELETE FROM backup_records WHERE file=?').run(row.file);}catch(e){console.error('Could not prune old backup',row.file,e.message);}}
  }
  const dest=process.env.TRAVEL_CANVAS_OFFSITE_BACKUP_DIR;
  let offsite=false;
  if(dest){
    const root=path.resolve(dest),local=path.resolve(dataDir);
    if(root!==local&&!root.startsWith(local+path.sep))try{
      fs.mkdirSync(root,{recursive:true,mode:0o700});
      const replica=path.join(root,filename);
      fs.copyFileSync(target,replica,fs.constants.COPYFILE_EXCL);
      const sample=new DatabaseSync(replica,{readOnly:true});
      try{offsite=sample.prepare('PRAGMA integrity_check').all().map(r=>r.integrity_check).join('|')==='ok';}
      finally{sample.close();}
      if(!offsite)fs.rmSync(replica,{force:true});
    }catch(e){console.error('OFF-NAS backup copy unavailable:',e.message);}
  }
  return {filename,revision:state().revision,createdAt:at,verified:true,offsite};
 }
 function latestBackup(){const row=db.prepare('SELECT file,revision,created_at,integrity FROM backup_records ORDER BY created_at DESC LIMIT 1').get();return row ? {filename:row.file,revision:row.revision,createdAt:row.created_at,verified:row.integrity==='ok'}:null;}
 function listBackups(){return db.prepare('SELECT file,revision,created_at,integrity FROM backup_records ORDER BY created_at DESC LIMIT 35').all().map(r=>({filename:r.file,revision:r.revision,createdAt:r.created_at,verified:r.integrity==='ok'}));}
 function snapshot(filename){
  if(typeof filename!=='string'||!/^travel-canvas-r[0-9]+-[0-9T.\-Z]+-[0-9a-f]{8}-[a-z-]+\.sqlite$/.test(filename))throw new ApiError(400,'Invalid backup name');
  const known=db.prepare('SELECT * FROM backup_records WHERE file=?').get(filename);
  if(!known)throw new ApiError(404,'Backup not found');
  const filepath=path.join(dataDir,'backups',filename);
  if(!fs.existsSync(filepath)||fs.lstatSync(filepath).isSymbolicLink())throw new ApiError(404,'Backup file missing');
  let verify;
  try{
   verify=new DatabaseSync(filepath,{readOnly:true});
   if(verify.prepare('PRAGMA integrity_check').all().map(x=>x.integrity_check).join('|')!=='ok')throw new ApiError(422,'Backup is damaged; restore refused');
   const source=verify.prepare('SELECT revision,content,updated_at FROM document_state WHERE id=1').get();
   if(!source)throw new ApiError(422,'Backup has no journey data');
   return {revision:source.revision,state:validateState(JSON.parse(source.content)),createdAt:known.created_at,filename};
  }catch(e){if(e instanceof ApiError)throw e;throw new ApiError(422,'Backup failed integrity verification; restore refused');}
  finally{if(verify)verify.close();}
 }
 function restoreSnapshot(filename,baseRevision,operationId){
  const saved=snapshot(filename);
  if(!Number.isSafeInteger(baseRevision)||baseRevision<0||typeof operationId!=='string'||!/^[-_a-zA-Z0-9]{8,128}$/.test(operationId))throw new ApiError(400,'Invalid restore request');
  const existing=db.prepare('SELECT payload_hash,response FROM operation_history WHERE operation_id=?').get(operationId);
  const payloadHash=fingerprint({filename,baseRevision});
  if(existing){if(existing.payload_hash!==payloadHash)throw new ApiError(409,'Restore operation ID reused for a different action');return {...JSON.parse(existing.response),duplicate:true};}
  const old=state();
  if(old.revision!==baseRevision)throw new ApiError(409,'Plan changed; please reload before restoring',{currentRevision:old.revision});
  const revision=old.revision+1,at=new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try{
   db.prepare('UPDATE document_state SET revision=?,content=?,updated_at=? WHERE id=1').run(revision,JSON.stringify(saved.state),at);
   const response={revision,state:saved.state,updatedAt:at,operationId,restoredFrom:filename};
   db.prepare('INSERT INTO operation_history(operation_id,payload_hash,revision,response,kind,applied_at) VALUES(?,?,?,?,?,?)').run(operationId,payloadHash,revision,JSON.stringify(response),'restore',at);
   db.exec('COMMIT');return response;
  }catch(e){db.exec('ROLLBACK');throw e;}
 }
 function offsiteStatus(){
  const dest=process.env.TRAVEL_CANVAS_OFFSITE_BACKUP_DIR;
  if(!dest)return {configured:false,verified:false,message:'No separate backup destination configured. Download a backup and save it on another device.'};
  const root=path.resolve(dest),local=path.resolve(dataDir);
  if(root===local||root.startsWith(local+path.sep))return {configured:false,verified:false,message:'The backup location must be outside the Travel Canvas data directory'};
  try{
   const files=fs.readdirSync(root).filter(f=>f.endsWith('.sqlite')).sort().reverse();
   if(!files.length)return {configured:true,verified:false,message:'No off-device backup files found'};
   let mirror;
   try{mirror=new DatabaseSync(path.join(root,files[0]),{readOnly:true});return {configured:true,verified:mirror.prepare('PRAGMA integrity_check').get().integrity_check==='ok',mostRecentFile:files[0]};}
   finally{if(mirror)mirror.close();}
  }catch{return {configured:true,verified:false,message:'Off-device backup not accessible or failed verification'};}
 }
 function close(){db.close();}
 return {file,db,state,applyMutation,importPreview,makeBackup,latestBackup,listBackups,snapshot,restoreSnapshot,offsiteStatus,checkIntegrity,close};
}
function withoutUIPreferences(s){const v=structuredClone(s);delete v.view;delete v.selectedStayId;delete v.selectedLegId;return v;}
module.exports={makeStore,ApiError};
