/**
 * Behavior-preserving extraction of Travel Canvas v0.9's date, link, lock,
 * collision, and leg-scene editing rules. No document, browser or database use.
 *
 * This module intentionally preserves v0.9 quirks. Use parity tests before
 * considering future behavior changes. Avoid modifying the source in legacy/.
 */
import type {PlanningState,Journey,Leg,LegScenario,Stay,StayEditResult,StayPreview,LegPreview,
  ComputedOperation,PlanningOperation,ApplyResult,Idea} from './types';
import {add,days,ordered,overlapPairs,minDate,maxDate} from './dates';
import {hasStayLink,linkedComponent} from './links';

const clone=<T>(x:T):T=>JSON.parse(JSON.stringify(x)) as T;
export function currentJourney(state:PlanningState):Journey {
  const result=state.journeyVersions.find(v=>v.id===state.activeJourneyVersionId)||state.journeyVersions[0];
  if(!result)throw Error('State contains no journey');
  return result;
}
export function currentLeg(state:PlanningState):Leg {
  const j=currentJourney(state),leg=j.legs.find(l=>l.id===state.selectedLegId)||j.legs[0];
  if(!leg)throw Error('Journey contains no legs');
  return leg;
}
export function currentScenario(leg:Leg):LegScenario {
  const sc=leg.scenarios.find(v=>v.id===leg.activeScenarioId)||leg.scenarios[0];
  if(!sc)throw Error('Leg contains no scenarios');
  return sc;
}
export function legBounds(leg:Leg):{start:string|null;end:string|null} {
  const sc=currentScenario(leg),placed=sc.stays.filter(s=>s.start&&s.end);
  return {start:minDate(sc.start||leg.start,...placed.map(s=>s.start)),end:maxDate(sc.end||leg.end,...placed.map(s=>s.end))};
}
export function legOverlaps(legs:Leg[]):[string,string][] {
  // The baseline maps legs to their derived intervals and reuses overlapPairs.
  return overlapPairs(legs.map(l=>({...legBounds(l),id:l.id} as Stay)));
}

export function resolveCollisions(stays:Stay[],initialIds:string[],original:Stay[],sc:LegScenario,
   direction:'forward'|'backward'='forward'):
 {valid:true;changedIds:string[];shiftCount:number;conflicts:[string,string][]} | {valid:false;reason:string} {
  const changed=new Set(initialIds),hardIds=new Set(initialIds);
  const baseline=new Set(overlapPairs(original).map(p=>[...p].sort().join('|')));
  const byId=new Map(stays.map(s=>[s.id,s]));
  const allIds=new Set(byId.keys());
  const queue=[...initialIds];
  let operations=0;
  while(queue.length){
    if(++operations>450)return {valid:false,reason:'Could not resolve all overlaps automatically. Try moving a smaller group or unlinking a connection.'};
    const moving=byId.get(queue.shift()!);if(!moving)continue;
    let collided:Stay|null=null;
    for(const other of stays){
      if(other.id===moving.id)continue;
      if(moving.start>=other.end||other.start>=moving.end)continue;
      if(baseline.has([moving.id,other.id].sort().join('|')))continue;
      collided=other;break;
    }
    if(!collided)continue;
    if(hardIds.has(moving.id)&&hardIds.has(collided.id))
      return {valid:false,reason:`The linked destinations overlap ${collided.place.name}. Try a different date or unlink.`};
    let anchor=moving,group=linkedComponent(collided.id,sc,allIds);
    if(hardIds.has(collided.id)||[...group].some(id=>hardIds.has(id))){
      anchor=collided;
      group=linkedComponent(moving.id,sc,allIds);
    }
    if([...group].some(id=>hardIds.has(id)))
      return {valid:false,reason:'The linked destinations cannot fit together at these dates. Unlink or change the placement.'};
    const locked=[...group].map(id=>byId.get(id)).find(s=>s?.locked);
    if(locked)return {valid:false,reason:`Locked ${locked.place.name} occupies those dates. Move to an open range or unlock it.`};
    const groupStays=[...group].map(id=>byId.get(id)).filter((s):s is Stay=>!!s);
    let shift=0,settled=false;
    for(let tries=0;tries<75;tries++){
      const conflicts=groupStays.flatMap(b=>{
        const bs=add(b.start,shift),be=add(b.end,shift);
        return anchor.start<be&&bs<anchor.end?[{bs,be}]:[];
      });
      if(!conflicts.length){settled=true;break;}
      const step=direction==='backward'
        ?Math.min(...conflicts.map(c=>days(c.be,anchor.start)))
        :Math.max(...conflicts.map(c=>days(c.bs,anchor.end)));
      if(step===0)break;
      shift+=step;
    }
    if(!settled||!shift)return {valid:false,reason:'Could not find a non-overlapping placement for linked stays.'};
    for(const stay of groupStays){
      stay.start=add(stay.start,shift);stay.end=add(stay.end,shift);
      changed.add(stay.id);queue.push(stay.id);
    }
  }
  const remaining=overlapPairs(stays).filter(pair=>!baseline.has([...pair].sort().join('|')));
  if(remaining.length)return {valid:false,reason:'Unable to find a free placement without changing protected dates.'};
  return {valid:true,changedIds:[...changed],shiftCount:changed.size-initialIds.length,conflicts:overlapPairs(stays)};
}

export function analyzeStayEdit(state:PlanningState,stayId:string,mode:'move'|'left'|'right',delta:number,
   ripple=true,baseStays?:Stay[]):StayPreview {
  const leg=currentLeg(state),sc=currentScenario(leg),original=ordered(baseStays??sc.stays),source=original.find(s=>s.id===stayId);
  if(!source)return {valid:false,reason:'Stay not found'};
  if(leg.locked)return {valid:false,reason:`Unlock the ${leg.title} leg to edit its stays`};
  if(source.locked)return {valid:false,reason:`Unlock ${source.place.name} to edit its dates`};
  const altered=clone(original),byId=new Map(altered.map(s=>[s.id,s]));
  const active=byId.get(stayId)!,before={start:active.start,end:active.end};
  if(mode==='move'){active.start=add(before.start,delta);active.end=add(before.end,delta);}
  else if(mode==='left')active.start=add(before.start,delta);
  else if(mode==='right')active.end=add(before.end,delta);
  else return {valid:false,reason:'Unknown edit operation'};
  if(active.start>=active.end)return {valid:false,reason:'Minimum stay: 1 night'};
  if(!delta)return {valid:true,stays:altered,changedIds:[],shiftCount:0,conflicts:overlapPairs(altered),isDifferent:false,mode,delta};
  const initial=new Set([stayId]),route=ordered(original),index=route.findIndex(s=>s.id===stayId);
  if(ripple){
    let linked=new Set([stayId]);
    if(mode==='move')linked=linkedComponent(stayId,sc);
    else{
      let i=index,step=mode==='left'?-1:1;
      while(i+step>=0&&i+step<route.length&&hasStayLink(route[i].id,route[i+step].id,sc)){
        linked.add(route[i+step].id);i+=step;
      }
    }
    for(const id of linked){
      if(id===stayId)continue;
      const follower=byId.get(id);if(!follower)continue;
      if(follower.locked)return {valid:false,reason:`Locked ${follower.place.name} is linked to this edit. Unlink or unlock it.`};
      follower.start=add(follower.start,delta);follower.end=add(follower.end,delta);
      initial.add(id);
    }
  }
  const resolved=resolveCollisions(altered,[...initial],original,sc,mode==='left'?'backward':'forward');
  if(!resolved.valid)return resolved;
  return {valid:true,stays:altered,changedIds:resolved.changedIds,shiftCount:resolved.shiftCount,
    blocked:[],conflicts:resolved.conflicts,isDifferent:true,mode,delta};
}
function shiftLeg(l:Leg,delta:number):void {
  const sc=currentScenario(l);
  sc.start=add(sc.start||l.start,delta);sc.end=add(sc.end||l.end,delta);
  for(const s of sc.stays){if(s.start)s.start=add(s.start,delta);if(s.end)s.end=add(s.end,delta);}
}
export function analyzeLegMove(state:PlanningState,legId:string,delta:number,ripple=true,baseLegs?:Leg[]):LegPreview {
  const altered=clone(baseLegs??currentJourney(state).legs),source=altered.find(l=>l.id===legId);
  if(!source)return {valid:false,reason:'Leg not found'};
  if(!delta)return {valid:true,legs:altered,changedIds:[],blocked:[],conflicts:legOverlaps(altered),isDifferent:false};
  const chain:Leg[]=[],visited=new Set<string>();let current:Leg|undefined=source;
  while(current){
    if(visited.has(current.id))return {valid:false,reason:'Linked legs contain a loop. Unlink one of the legs.'};
    visited.add(current.id);chain.push(current);
    if(!ripple||!current.linkNextId)break;
    const next:Leg|undefined=altered.find(l=>l.id===current!.linkNextId);
    if(!next)return {valid:false,reason:`${current.title} links to a removed leg. Unlink it first.`};
    current=next;
  }
  for(const l of chain){
    if(l.locked)return {valid:false,reason:`${l.title} is locked. Unlock or unlink it before moving this group.`};
    if(currentScenario(l).stays.some(s=>s.locked))return {valid:false,reason:`${l.title} contains locked dates. Unlock the stay before moving the whole leg.`};
  }
  chain.forEach(l=>shiftLeg(l,delta));
  return {valid:true,legs:altered,changedIds:chain.map(l=>l.id),blocked:[],conflicts:legOverlaps(altered),isDifferent:true};
}
export function computePlanningOperation(state:PlanningState,op:PlanningOperation):ComputedOperation {
  if(op.kind==='leg'){
    const result=analyzeLegMove(state,op.id,op.delta,true);
    return result.valid?{kind:'leg',...result}:result;
  }
  const result=analyzeStayEdit(state,op.id,op.mode,op.delta,true);
  if(!result.valid)return result;
  const l=currentLeg(state),sc=currentScenario(l);
  const bounds=(stays:Stay[])=>({start:minDate(sc.start||l.start,...stays.map(s=>s.start)),end:maxDate(sc.end||l.end,...stays.map(s=>s.end))});
  const endDelta=days(bounds(sc.stays).end!,bounds(result.stays).end!);
  let followers:LegPreview|null=null;
  if(l.linkNextId&&endDelta){
    followers=analyzeLegMove(state,l.linkNextId,endDelta,true);
    if(!followers.valid)return {valid:false,reason:followers.reason};
  }
  return {kind:'stay',legId:l.id,...result,followers,linkedDelta:endDelta};
}
/** Pure equivalent of the existing commit path; UI undo can store `before` state. */
export function applyPlanningOperation(state:PlanningState,op:PlanningOperation):ApplyResult {
  const candidate=computePlanningOperation(state,op);
  if(!candidate.valid)return {valid:false,reason:candidate.reason,state:clone(state)};
  if(!candidate.isDifferent)return {valid:true,changed:false,state:clone(state),result:candidate};
  const next=clone(state);
  if(candidate.kind==='leg')currentJourney(next).legs=clone(candidate.legs);
  else {
    if(candidate.followers?.valid)currentJourney(next).legs=clone(candidate.followers.legs);
    const leg=currentJourney(next).legs.find(l=>l.id===candidate.legId)!;
    currentScenario(leg).stays=clone(candidate.stays);
  }
  return {valid:true,changed:true,state:next,result:candidate};
}
/** Intentionally separate, identity-preserving action with caller-supplied ID. */
export function moveStayToIdeas(state:PlanningState,stayId:string,ideaId:string):
  {valid:true;state:PlanningState;idea:Idea}|{valid:false;reason:string} {
  const next=clone(state),leg=currentLeg(next),sc=currentScenario(leg),stay=sc.stays.find(s=>s.id===stayId);
  if(!stay)return {valid:false,reason:'Stay not found'};
  if(leg.locked||stay.locked)return {valid:false,reason:`Unlock ${leg.locked?leg.title:stay.place.name} before unscheduling`};
  const idea:Idea={id:ideaId,sourceStayId:stay.id,place:clone(stay.place),color:stay.color,
    nightsTarget:days(stay.start,stay.end),lastDates:{start:stay.start,end:stay.end},status:stay.status};
  sc.ideas.push(idea);
  sc.stays=sc.stays.filter(s=>s.id!==stay.id);
  sc.stayLinks=(sc.stayLinks||[]).filter(e=>e.a!==stay.id&&e.b!==stay.id);
  for(const remaining of sc.stays)if(remaining.linkNextId===stay.id)remaining.linkNextId=null;
  if(sc.connections)delete sc.connections[stay.id];
  if(next.selectedStayId===stay.id)next.selectedStayId=null;
  return {valid:true,state:next,idea};
}
