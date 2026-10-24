import * as React from 'react';
import {ownerPost} from '../services/AuthClient';
type Backup={id:string;revision:number;createdAt:string;kind:string;verified:boolean};
type PanelState={busy:boolean;error:string;message:string;status:any;backups:Backup[];chosen:string;preview:any};
async function getJSON(url:string){const r=await fetch(url,{cache:'no-store'}),data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||`Request failed: ${r.status}`);return data;}
/** Cloudflare Access owns login and recovery; this panel only manages plan snapshots. */
export class OwnerPanel extends React.Component<{close:()=>void;canRestore:boolean},PanelState>{
 constructor(p:any){super(p);this.state={busy:false,error:'',message:'',status:null,backups:[],chosen:'',preview:null};}
 componentDidMount(){void this.refresh();}
 async refresh(){try{const [status,results]=await Promise.all([getJSON('/api/system/status'),getJSON('/api/backups')]);this.setState({status,backups:results.backups||[],chosen:this.state.chosen||results.backups?.[0]?.id||'',error:''});}catch(e:any){this.setState({error:String(e.message||e)});}}
 async backup(){this.setState({busy:true,error:'',message:''});try{const b=await ownerPost('/api/backup',{});this.setState({busy:false,message:'Snapshot saved ('+b.createdAt+'). Download a separate JSON file for off-cloud safety.'});void this.refresh();}catch(e:any){this.setState({busy:false,error:String(e.message||e)});}}
 async preview(){if(!this.props.canRestore){this.setState({error:'Finish saving or resolve unsaved edits before restoring.'});return;}this.setState({busy:true,error:'',preview:null});try{const p=await ownerPost('/api/restore/preview',{snapshotId:this.state.chosen});this.setState({busy:false,preview:p});}catch(e:any){this.setState({busy:false,error:String(e.message||e)});}}
 async restore(){const p=this.state.preview;if(!p||!this.props.canRestore)return;
  const confirmation=prompt(`This replaces your CURRENT plans with ${p.counts.journeys} journeys, ${p.counts.stays} stays and ${p.counts.ideas} Ideas from ${p.createdAt}. A separate pre-restore snapshot will preserve today's plan.\n\nType RESTORE to continue:`);
  if(confirmation!=='RESTORE')return;
  this.setState({busy:true,error:'',message:'Restoring...'});
  try{await ownerPost('/api/restore/commit',{snapshotId:p.snapshotId,baseRevision:p.currentRevision,operationId:'restore-'+Date.now()+'-'+crypto.randomUUID(),confirm:'RESTORE'});window.location.reload();}
  catch(e:any){this.setState({busy:false,error:String(e.message||e),message:'',preview:null});}
 }
 render(){const s=this.state;return <div className="search-drawer" role="dialog" aria-modal="true" aria-label="System and backups"><div className="drawer-scrim" onClick={this.props.close}/><div className="drawer-sheet versions-sheet owner-sheet"><div className="drawer-head"><div><div className="eyebrow">CLOUD WORKSPACE</div><h2>System & backups</h2><p>Your plans are saved in Cloudflare D1 and protected by Cloudflare Access. There is no NAS or server to maintain.</p></div><button className="icon-button" aria-label="Close" onClick={this.props.close}>×</button></div>
  <div className="version-card"><h3>Your workspace</h3><p>{s.status?.healthy?'● Connected':'Checking connection...'} · Revision {s.status?.revision??'—'} · {s.status?.email||'Cloudflare Access'}</p><p>Last in-app snapshot: {s.status?.latestBackup?.createdAt||'None yet'}. Daily snapshots run automatically when the scheduled job is enabled.</p><div className="details-actions"><button className="button button-outline" disabled={s.busy} onClick={()=>this.refresh()}>Refresh status</button><button className="button button-primary" disabled={s.busy} onClick={()=>this.backup()}>Save snapshot</button><a className="button button-outline" href="/api/export" download="travel-canvas-backup.json">Download full JSON backup</a></div>
  <p><strong>Important:</strong> In-app snapshots are in the same D1 database; they are not a disaster backup. Occasionally download the JSON file to your computer or NAS. Cloudflare D1 Time Travel is another short-term recovery option.</p></div>
  <div className="version-card"><h3>Restore an earlier snapshot</h3><p>This restores your entire travel workspace. We take a pre-restore safety snapshot first. Finish saving all changes before starting.</p>
  <label className="form-label">Saved snapshot<select className="text-input" value={s.chosen} onChange={(e:any)=>this.setState({chosen:e.target.value,preview:null})}>{!s.backups.length?<option value="">No snapshots</option>:s.backups.map(x=><option key={x.id} value={x.id}>{x.createdAt} · r{x.revision} · {x.kind}</option>)}</select></label>
  <div className="details-actions"><button className="button button-outline" disabled={s.busy||!s.chosen||!this.props.canRestore} onClick={()=>this.preview()}>Preview restore</button></div>
  {s.preview?<div className="restore-confirm"><strong>{s.preview.counts.journeys} journeys, {s.preview.counts.stays} stays and {s.preview.counts.ideas} Ideas</strong><p>Saved {s.preview.createdAt}; current revision {s.preview.currentRevision}</p><button className="button button-primary" disabled={s.busy||!this.props.canRestore} onClick={()=>this.restore()}>Restore snapshot...</button></div>:null}
  </div>
  <div className="version-card"><h3>Account</h3><p>Cloudflare Access handles sign-in and session expiration. You can revoke access from the Cloudflare dashboard.</p><a className="button button-outline" href="/cdn-cgi/access/logout">Sign out of Cloudflare Access</a></div>
  {s.message?<p className="owner-message" role="status">{s.message}</p>:null}{s.error?<p className="owner-error" role="alert">{s.error}</p>:null}
  </div></div>}
}
