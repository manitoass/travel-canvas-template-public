import {AccessError,verifiedOwner} from './access.mjs';
import {validateState,counts,importBackup,remapImportedPlans,fingerprint} from './validation.mjs';
import {ensureSchema} from './schema.mjs';

class ApiError extends Error {
  constructor(status,message,extra={}){super(message);this.status=status;this.extra=extra;}
}
const NO_STORE={'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const MAX_BODY=4*1024*1024;
const idOK=id=>typeof id==='string'&&/^[-_a-zA-Z0-9]{8,128}$/.test(id);
const snapshotId=()=>`snap-${crypto.randomUUID()}`;
function response(status,data,headers={}){
  return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8',...NO_STORE,...headers}});
}
async function inputJSON(req,limit=MAX_BODY){
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type')||''))throw new ApiError(415,'JSON body required.');
  const length=Number(req.headers.get('content-length')||'0');
  if(length>limit)throw new ApiError(413,'Request too large.');
  const reader=req.body?.getReader();let n=0;const chunks=[];
  if(reader){
    while(true){const part=await reader.read();if(part.done)break;n+=part.value.byteLength;
      if(n>limit){await reader.cancel();throw new ApiError(413,'Request too large.');}
      chunks.push(part.value);
    }
  }
  const bytes=new Uint8Array(n);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new ApiError(400,'Invalid JSON.');}
}
function safety(req){
  const url=new URL(req.url),method=req.method.toUpperCase();
  if(!['GET','HEAD','POST'].includes(method))throw new ApiError(405,'Method not allowed.');
  if(method==='POST'){
    if(req.headers.get('X-Travel-Canvas-Write')!=='1')throw new ApiError(403,'Mutation request must come from the app.');
    if(req.headers.get('sec-fetch-site')==='cross-site')throw new ApiError(403,'Cross-site request blocked.');
    const origin=req.headers.get('origin');if(origin&&origin!==url.origin)throw new ApiError(403,'Origin mismatch.');
  }
  return {url,method};
}
async function stateDB(db,seed){
  let row=await db.prepare('SELECT revision,content,updated_at FROM document_state WHERE id=1').first();
  if(!row){
    const initial=validateState(seed);
    await db.prepare('INSERT OR IGNORE INTO document_state(id,revision,content,updated_at,last_operation_id) VALUES (1,0,?,?,\'\')')
      .bind(JSON.stringify(initial),new Date().toISOString()).run();
    row=await db.prepare('SELECT revision,content,updated_at FROM document_state WHERE id=1').first();
  }
  if(!row)throw new ApiError(503,'Database is not initialized.');
  return {revision:row.revision,state:JSON.parse(row.content),updatedAt:row.updated_at};
}
function withoutUI(state){const s=structuredClone(state);delete s.view;delete s.selectedStayId;delete s.selectedLegId;return s;}
async function createSnapshot(db,kind,seed){
  const present=await stateDB(db,seed);
  const id=snapshotId(),at=new Date().toISOString();
  await db.prepare('INSERT INTO snapshots(id,revision,content,created_at,kind) VALUES (?,?,?,?,?)')
    .bind(id,present.revision,JSON.stringify(present.state),at,kind).run();
  const retain=kind==='daily'?14:kind==='manual'?8:6;
  await db.prepare('DELETE FROM snapshots WHERE id IN (SELECT id FROM snapshots WHERE kind=? ORDER BY created_at DESC, id DESC LIMIT -1 OFFSET ?)')
    .bind(kind,retain).run();
  return {id,filename:id,revision:present.revision,createdAt:at,kind,verified:true};
}
async function listSnapshots(db){
  const {results}=await db.prepare('SELECT id,revision,created_at,kind FROM snapshots ORDER BY created_at DESC, id DESC LIMIT 40').all();
  return results.map(r=>({id:r.id,filename:r.id,revision:r.revision,createdAt:r.created_at,kind:r.kind,verified:true}));
}
async function applyMutation(db,req,seed,planningEngine){
  if(!idOK(req.operationId))throw new ApiError(400,'Invalid operation ID.');
  if(!Number.isSafeInteger(req.baseRevision)||req.baseRevision<0)throw new ApiError(400,'Invalid base revision.');
  if(!['state','planning','import'].includes(req.type))throw new ApiError(400,'Unknown operation type.');
  const hash=await fingerprint(req);
  const old=await db.prepare('SELECT payload_hash,response FROM operation_history WHERE operation_id=?').bind(req.operationId).first();
  if(old){
    if(old.payload_hash!==hash)throw new ApiError(409,'An operation ID was reused for different changes.');
    return {...JSON.parse(old.response),state:(await stateDB(db,seed)).state,duplicate:true};
  }
  const previous=await stateDB(db,seed);
  if(req.baseRevision!==previous.revision)throw new ApiError(409,'This plan changed in another browser.',{currentRevision:previous.revision});
  let next;
  if(req.type==='planning'){
    const op=req.operation;
    if(!op||!['stay','leg'].includes(op.kind)||typeof op.id!=='string'||!Number.isInteger(op.delta)||Math.abs(op.delta)>5000||op.kind==='stay'&&!['move','left','right'].includes(op.mode))throw new ApiError(400,'Invalid calendar edit.');
    const result=planningEngine(previous.state,op);
    if(!result.valid)throw new ApiError(422,result.reason);
    next=validateState(result.state);
    if(req.state&&(await fingerprint(withoutUI(next)))!==(await fingerprint(withoutUI(validateState(req.state)))))
      throw new ApiError(409,'Server and browser disagree about the calendar. Nothing saved.',{currentRevision:previous.revision});
  }else if(req.type==='import'){
    const imported=importBackup(req.backup);
    if(req.previewHash!==await fingerprint(imported))throw new ApiError(409,'Import file changed after preview.');
    next=remapImportedPlans(previous.state,imported);
  }else next=validateState(req.state);
  const revision=previous.revision+1,at=new Date().toISOString();
  const result={revision,state:next,updatedAt:at,operationId:req.operationId};
  const update=db.prepare('UPDATE document_state SET revision=?,content=?,updated_at=?,last_operation_id=? WHERE id=1 AND revision=?')
    .bind(revision,JSON.stringify(next),at,req.operationId,previous.revision);
  const history=db.prepare('INSERT INTO operation_history(operation_id,payload_hash,revision,response,kind,applied_at) SELECT ?,?,?,?,?,? FROM document_state WHERE id=1 AND last_operation_id=?')
    .bind(req.operationId,hash,revision,JSON.stringify({revision,updatedAt:at,operationId:req.operationId}),req.type,at,req.operationId);
  const statements=[update,history];
  if(req.type==='import')statements.push(db.prepare('INSERT INTO snapshots(id,revision,content,created_at,kind) SELECT ?,revision-1,?, ?,\'pre-import\' FROM document_state WHERE id=1 AND last_operation_id=?')
    .bind(snapshotId(),JSON.stringify(previous.state),at,req.operationId));
  // D1.batch executes statements within one transactional scope. If another device wins
  // the compare-and-swap, neither history nor the pre-import snapshot can be inserted.
  const outcomes=await db.batch(statements);
  if(outcomes[0]?.meta?.changes!==1){
    const raced=await db.prepare('SELECT payload_hash,response FROM operation_history WHERE operation_id=?').bind(req.operationId).first();
    if(raced&&raced.payload_hash===hash)return {...JSON.parse(raced.response),state:(await stateDB(db,seed)).state,duplicate:true};
    const latest=await stateDB(db,seed);
    throw new ApiError(409,'This plan changed in another browser.',{currentRevision:latest.revision});
  }
  return result;
}
async function restoreSnapshot(db,p,seed){
  if(p.confirm!=='RESTORE'||!idOK(p.operationId)||!Number.isSafeInteger(p.baseRevision)||typeof p.snapshotId!=='string')throw new ApiError(400,'Restore confirmation is incomplete.');
  const record=await db.prepare('SELECT id,revision,content,created_at FROM snapshots WHERE id=?').bind(p.snapshotId).first();
  if(!record)throw new ApiError(404,'Snapshot not found.');
  const restored=validateState(JSON.parse(record.content));
  const old=await stateDB(db,seed);
  const hash=await fingerprint({type:'restore',...p});
  const prior=await db.prepare('SELECT payload_hash,response FROM operation_history WHERE operation_id=?').bind(p.operationId).first();
  if(prior){if(prior.payload_hash!==hash)throw new ApiError(409,'Restore operation ID reused.');return {...JSON.parse(prior.response),state:(await stateDB(db,seed)).state,duplicate:true};}
  if(p.baseRevision!==old.revision)throw new ApiError(409,'Plans changed after the restore preview.',{currentRevision:old.revision});
  const rev=old.revision+1,at=new Date().toISOString(),result={revision:rev,state:restored,updatedAt:at,operationId:p.operationId,restoredFrom:p.snapshotId};
  const outcomes=await db.batch([
    db.prepare('UPDATE document_state SET revision=?,content=?,updated_at=?,last_operation_id=? WHERE id=1 AND revision=?').bind(rev,JSON.stringify(restored),at,p.operationId,old.revision),
    db.prepare('INSERT INTO operation_history(operation_id,payload_hash,revision,response,kind,applied_at) SELECT ?,?,?,?,?,? FROM document_state WHERE last_operation_id=?').bind(p.operationId,hash,rev,JSON.stringify({revision:rev,updatedAt:at,operationId:p.operationId}),'restore',at,p.operationId),
    db.prepare('INSERT INTO snapshots(id,revision,content,created_at,kind) SELECT ?,?,?,?,\'pre-restore\' FROM document_state WHERE last_operation_id=?')
      .bind(snapshotId(),old.revision,JSON.stringify(old.state),at,p.operationId)
  ]);
  if(outcomes[0]?.meta?.changes!==1){const latest=await stateDB(db,seed);throw new ApiError(409,'Restore conflicted with a newer save.',{currentRevision:latest.revision});}
  return result;
}

export function createWorker({seed,applyPlanningOperation,fetchCerts=fetch,checkIdentity=verifiedOwner}={}){
  if(!seed||typeof applyPlanningOperation!=='function')throw Error('Seed and planning engine required');
  const getOwner=(req,env)=>checkIdentity(req,env,fetchCerts);
  return {
    async fetch(request,env){
      try{
        // Always authenticate before serving static assets too: a Worker cannot accidentally
        // go public solely because the dashboard Access switch was left off.
        const owner=await getOwner(request,env);
        const {url,method}=safety(request);
        if(url.pathname.startsWith('/api/')){
          const db=env.DB;
          if(!db||typeof db.prepare!=='function')throw new ApiError(503,'D1 is not connected. Add the DB binding.');
          await ensureSchema(db);
          if(method==='GET'&&url.pathname==='/api/auth/session')return response(200,{authenticated:true,username:owner.email,needsSetup:false,csrfToken:''});
          if(method==='GET'&&url.pathname==='/api/state')return response(200,await stateDB(db,seed));
          if(method==='GET'&&url.pathname==='/api/export'){
            const current=await stateDB(db,seed);
            return response(200,{format:'travel-canvas-prototype',version:1,exportedAt:new Date().toISOString(),state:current.state},{'Content-Disposition':'attachment; filename="travel-canvas-backup.json"'});
          }
          if(method==='GET'&&url.pathname==='/api/health')return response(200,{ok:true});
          if(method==='GET'&&url.pathname==='/api/backups'){
            const snapshots=await listSnapshots(db);
            return response(200,{backups:snapshots,latest:snapshots[0]||null,offsite:{configured:false,verified:false,message:'Save a downloaded JSON backup to another device periodically.'}});
          }
          if(method==='GET'&&url.pathname==='/api/system/status'){
            const current=await stateDB(db,seed),snapshots=await listSnapshots(db);
            return response(200,{application:'Travel Canvas - Cloudflare',revision:current.revision,healthy:true,latestBackup:snapshots[0]||null,offsite:{configured:false,verified:false},authenticated:true,email:owner.email});
          }
          if(method==='POST'&&url.pathname==='/api/import/preview'){
            const imported=importBackup(await inputJSON(request));
            const current=await stateDB(db,seed);
            return response(200,{valid:true,hash:await fingerprint(imported),counts:counts(imported),journeyNames:imported.journeyVersions.map(j=>j.name),mode:'add-new-plans',currentRevision:current.revision});
          }
          if(method==='POST'&&url.pathname==='/api/operations')return response(200,await applyMutation(db,await inputJSON(request),seed,applyPlanningOperation));
          if(method==='POST'&&url.pathname==='/api/backup')return response(201,await createSnapshot(db,'manual',seed));
          if(method==='POST'&&url.pathname==='/api/restore/preview'){
            const p=await inputJSON(request,2048);
            const snapshot=await db.prepare('SELECT id,revision,content,created_at FROM snapshots WHERE id=?').bind(p.snapshotId).first();
            if(!snapshot)throw new ApiError(404,'Snapshot not found.');
            const restored=validateState(JSON.parse(snapshot.content)),current=await stateDB(db,seed);
            return response(200,{snapshotId:snapshot.id,backupRevision:snapshot.revision,createdAt:snapshot.created_at,counts:counts(restored),currentRevision:current.revision});
          }
          if(method==='POST'&&url.pathname==='/api/restore/commit')return response(200,await restoreSnapshot(db,await inputJSON(request,4096),seed));
          return response(404,{error:'API endpoint not found.'});
        }
        if(method!=='GET'&&method!=='HEAD')throw new ApiError(405,'Unsupported method.');
        if(!env.ASSETS||typeof env.ASSETS.fetch!=='function')throw new ApiError(503,'Website assets not configured.');
        const asset=await env.ASSETS.fetch(request);
        const headers=new Headers(asset.headers);
        headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','no-referrer');
        headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://tile.openstreetmap.org; connect-src 'self' https://nominatim.openstreetmap.org; object-src 'none'; frame-ancestors 'none'; base-uri 'none'");
        return new Response(asset.body,{status:asset.status,statusText:asset.statusText,headers});
      }catch(e){
        const status=Number.isInteger(e?.status)?e.status:500;
        if(status>=500)console.error('Travel Canvas cloud error',e?.stack||e?.message);
        return response(status,{error:status>=500?(status===503?e.message:'Service error. No changes were saved.'):e.message,...status<500?e.extra||{}:{}});
      }
    },
    async scheduled(_event,env){
      if(!env.DB||!env.ACCESS_OWNER_EMAIL)return;
      await ensureSchema(env.DB);
      await createSnapshot(env.DB,'daily',seed);
      // Keep replay IDs long enough for normal retries without an unbounded table.
      await env.DB.prepare('DELETE FROM operation_history WHERE operation_id IN (SELECT operation_id FROM operation_history ORDER BY applied_at DESC, rowid DESC LIMIT -1 OFFSET 1200)').run();
    }
  };
}
export {ApiError,stateDB,applyMutation,createSnapshot,restoreSnapshot};
