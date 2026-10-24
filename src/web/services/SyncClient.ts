import {mutationHeaders} from './AuthClient';
import type {PlanningState,PlanningOperation} from '../../engine/types';
export type SavePhase='saved'|'saving'|'failed'|'conflict';
export type SyncMessage={phase:SavePhase; message:string; revision:number; pending:number};
type Queued={operationId:string;type:'state'|'planning';state:PlanningState;operation?:PlanningOperation};
const RECOVERY_KEY='travel-canvas-m3-unsaved-recovery';
const clone=<T,>(v:T):T=>JSON.parse(JSON.stringify(v));
const id=()=>typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
async function responseJSON(res:Response):Promise<any>{let json:any={};try{json=await res.json();}catch{}if(!res.ok){const e:any=new Error(json.error||`HTTP ${res.status}`);e.status=res.status;e.currentRevision=json.currentRevision;throw e;}return json;}
/** Serial optimistic operation queue: each gesture is one atomic server revision. */
export class SyncClient {
 revision:number;
 pending:Queued[]=[];
 phase:SavePhase='saved';
 message='Saved to server';
 private processing=false;
 private polling:any=null;
 private closed=false;
 private onStatus:(s:SyncMessage)=>void;
 private onRemote:(s:PlanningState)=>void;
 private isBusy:()=>boolean;
 constructor(revision:number,onStatus:(s:SyncMessage)=>void,onRemote:(s:PlanningState)=>void,isBusy:()=>boolean){this.revision=revision;this.onStatus=onStatus;this.onRemote=onRemote;this.isBusy=isBusy;}
 get status():SyncMessage{return {phase:this.phase,message:this.message,revision:this.revision,pending:this.pending.length};}
 notify(phase:SavePhase,message:string){this.phase=phase;this.message=message;this.onStatus(this.status);}
 static recovery():PlanningState|null{try{const data=localStorage.getItem(RECOVERY_KEY);if(!data)return null;return JSON.parse(data).state||null;}catch{return null;}}
 static clearRecovery(){try{localStorage.removeItem(RECOVERY_KEY);}catch{}}
 private keepRecovery(){const last=this.pending.at(-1);if(!last)return;try{localStorage.setItem(RECOVERY_KEY,JSON.stringify({state:last.state,revision:this.revision,pending:this.pending.length,at:new Date().toISOString()}));}catch{}}
 enqueue(state:PlanningState,operation?:PlanningOperation){if(this.closed)return;this.pending.push({operationId:id(),type:operation?'planning':'state',operation,state:clone(state)});this.keepRecovery();this.notify('saving','Saving to server...');void this.flush();}
 private async flush(){if(this.processing||this.closed||this.phase==='conflict')return;this.processing=true;
  try{while(this.pending.length&&!this.closed){const item=this.pending[0];try{
     const res=await fetch('/api/operations',{method:'POST',headers:mutationHeaders(),body:JSON.stringify({...item,baseRevision:this.revision})});
     const json=await responseJSON(res);this.revision=json.revision;this.pending.shift();if(this.pending.length){this.keepRecovery();this.notify('saving','Saving to server...');}else{SyncClient.clearRecovery();this.notify('saved','Saved to server');}
   }catch(e:any){if(e.status===409){this.notify('conflict','Another browser changed this plan. Download your unsaved copy, then load the newer plan.');}else{this.notify('failed',e.status===401?'Session expired. Download your unsaved copy, then reload to sign in.':'Not saved - server unavailable. Edits are kept locally for recovery.');}break;}}
  }finally{this.processing=false;}
 }
 retry(){if(this.phase==='conflict')return;if(!this.pending.length){this.notify('saved','Checking server...');void this.poll();return;}this.notify('saving','Retrying save...');void this.flush();}
 async importFile(fileContent:any){if(this.pending.length)throw new Error('Finish saving or resolve unsaved changes before importing.');
  const preview=await responseJSON(await fetch('/api/import/preview',{method:'POST',headers:mutationHeaders(),body:JSON.stringify(fileContent)}));
  return preview;
 }
 async commitImport(fileContent:any,preview:{hash:string}){
  if(this.pending.length)throw new Error('Finish saving before importing.');
  const payload={type:'import',operationId:id(),baseRevision:this.revision,backup:fileContent,previewHash:preview.hash};
  this.notify('saving','Importing plans...');
  try{const result=await responseJSON(await fetch('/api/operations',{method:'POST',headers:mutationHeaders(),body:JSON.stringify(payload)}));
   this.revision=result.revision;this.notify('saved','Saved to server');this.onRemote(result.state);return result.state as PlanningState;
  }catch(e){this.notify('failed','Import was not saved');throw e;}
 }
 async poll(){if(this.pending.length||this.closed||this.phase!=='saved'||this.isBusy())return;
  try{const r=await responseJSON(await fetch('/api/state',{cache:'no-store'}));
   if(r.revision!==this.revision && !this.pending.length && !this.isBusy()){this.revision=r.revision;this.onRemote(r.state);this.notify('saved','Updated from another browser');}}
  catch{this.notify('failed','Server or login unavailable. No changes are being saved.');}
 }
 async reload(discardLocal:boolean){if(!discardLocal&&this.pending.length)throw new Error('Unsent changes exist');
  const r=await responseJSON(await fetch('/api/state',{cache:'no-store'}));
  this.pending=[];SyncClient.clearRecovery();this.revision=r.revision;this.onRemote(r.state);this.notify('saved','Loaded latest saved plan');return r.state as PlanningState;
 }
 start(){this.polling=setInterval(()=>{void this.poll();},8000);document.addEventListener('visibilitychange',this.visibility);window.addEventListener('beforeunload',this.beforeUnload);}
 visibility=()=>{if(!document.hidden)void this.poll();};
 beforeUnload=(event:BeforeUnloadEvent)=>{if(!this.pending.length)return;event.preventDefault();event.returnValue='';};
 stop(){this.closed=true;clearInterval(this.polling);document.removeEventListener('visibilitychange',this.visibility);window.removeEventListener('beforeunload',this.beforeUnload);}
}
