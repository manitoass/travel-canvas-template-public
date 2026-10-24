import * as React from 'react';
import {createRoot} from 'react-dom/client';
import type {PlanningState,Place} from '../engine/types';
import {App} from './App';
import {SyncClient} from './services/SyncClient';

// Cloudflare Access handles sign-in; the Worker is the only source of saved plans.
// There is deliberately no browser-only data mode or second app password system.
async function json(path:string):Promise<any>{
 const response=await fetch(path,{cache:'no-store'});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(result.error||`Request failed (${response.status}). Sign in through Cloudflare Access and reload.`);
 return result;
}
async function main(){
 const container=document.getElementById('root');
 if(!container)throw new Error('Travel Canvas mount point missing.');
 try{
   const session=await json('/api/auth/session');
   if(!session.authenticated)throw new Error('Cloudflare Access sign-in is required.');
   const [saved,cities]=await Promise.all([json('/api/state'),json('/cities.json')]);
   if(!Number.isInteger(saved.revision)||!saved.state)throw new Error('Saved travel plans were not returned by the database.');
   createRoot(container).render(<App seed={saved.state as PlanningState} cities={cities as Place[]}
     serverRevision={saved.revision} recovery={SyncClient.recovery()}/>);
 }catch(e:any){
   container.textContent='Travel Canvas could not open: '+String(e.message||e)+'. No travel data was overwritten. Check your Cloudflare Access login and try reloading.';
 }
}
void main();
