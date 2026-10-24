import type {PlanningState,Leg,LegScenario,Stay,Place,Idea} from '../../engine/types';
import {add,days,ordered,minDate,maxDate} from '../../engine/dates';
import {currentJourney,currentLeg,currentScenario,legBounds,resolveCollisions,analyzeLegMove} from '../../engine/planning';

export const STORAGE='travel-canvas-react-milestone-2-v1';
export const LEG_COLORS=['#5186c9','#159e8b','#9775c5','#d29b51','#d16d85','#508f9c','#8f9d4c','#aa7a62'];
export const STAY_COLORS=['#d28d38','#159d92','#9070c3','#4d83d1','#cd6688','#8c9d4b','#b67f58','#5b99a9','#b080ab'];
export const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
export const WEEK=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
export const clone=<T,>(v:T):T=>JSON.parse(JSON.stringify(v));
export const uid=()=>typeof crypto!=='undefined'&&'randomUUID'in crypto?crypto.randomUUID():`${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`;
export const formatDate=(str?:string|null,year=false):string=>{if(!str)return 'Flexible';const[y,m,d]=str.split('-').map(Number);return `${MONTHS[m-1]?.slice(0,3)} ${d}${year?`, ${y}`:''}`;};
export const stayColor=(s:Stay)=>s.color||STAY_COLORS[0];
export const activeLegs=(s:PlanningState)=>currentJourney(s).legs;
export const activeStays=(s:PlanningState,leg?:Leg)=>currentScenario(leg||currentLeg(s)).stays;
export const selectedStay=(s:PlanningState)=>activeStays(s).find(v=>v.id===s.selectedStayId)||null;
export const span=(s:PlanningState)=>{const legs=activeLegs(s),ranges=legs.map(legBounds);return {start:minDate(...ranges.map(v=>v.start))||'2027-02-01',end:maxDate(...ranges.map(v=>v.end))||'2027-03-01'};};
export const countNights=(stays:Stay[])=>stays.reduce((t,s)=>t+(s.start&&s.end?days(s.start,s.end):0),0);
export const totalNights=(s:PlanningState)=>activeLegs(s).reduce((n,l)=>n+countNights(activeStays(s,l)),0);
export const defaultLeg=(title:string,start:string,end:string,index:number):Leg=>{const id=uid(),scenarioId=uid();return {id,title,color:LEG_COLORS[index%LEG_COLORS.length],start,end,locked:false,linkNextId:null,activeScenarioId:scenarioId,scenarios:[{id:scenarioId,name:'Main plan',stays:[],ideas:[],stayLinks:[],stayLinksV07:true,stayLinksInitialized:true,connections:{}}]};};
export function normalize(s:PlanningState):PlanningState{
 if(!s?.journeyVersions?.length)throw Error('Missing journeys');
 const a=clone(s);for(const journey of a.journeyVersions){for(const leg of journey.legs){leg.locked=!!leg.locked;leg.linkNextId=leg.linkNextId||null;
  for(const scenario of leg.scenarios){scenario.stays=scenario.stays||[];scenario.ideas=scenario.ideas||[];
   for(const [i,stay] of scenario.stays.entries()){stay.locked=!!stay.locked;stay.color=stay.color||STAY_COLORS[i%STAY_COLORS.length];}
   const ids=new Set(scenario.stays.map(st=>st.id));
   // Respect already configured v0.7+ links, import old forward links once, never automatically re-link.
   if(!scenario.stayLinksV07){scenario.stayLinks=scenario.stays.filter(st=>st.linkNextId&&ids.has(st.linkNextId)).map(st=>({a:st.id,b:st.linkNextId!}));scenario.stayLinksV07=true;}
   const seen=new Set<string>();scenario.stayLinks=(scenario.stayLinks||[]).filter(e=>{const k=[e.a,e.b].sort().join('|');if(e.a===e.b||!ids.has(e.a)||!ids.has(e.b)||seen.has(k))return false;seen.add(k);return true;});
  }
 }}
 if(!a.journeyVersions.some(j=>j.id===a.activeJourneyVersionId))a.activeJourneyVersionId=a.journeyVersions[0].id;
 const j=currentJourney(a);if(!j.legs.some(l=>l.id===a.selectedLegId))a.selectedLegId=j.legs[0]?.id;
 a.view=['leg','journey','overview'].includes(a.view||'')?a.view:'leg';return a;
}
/** v0.9-equivalent insertion: an unlocked stay can displace other unlocked stays.
 * The calculation happens on a clone and becomes one undoable change in App.
 */
export function insertStay(s:PlanningState,legId:string,place:Place,start:string,end:string,ideaId?:string):PlanningState{
 const next=clone(s),leg=activeLegs(next).find(l=>l.id===legId);
 if(!leg||leg.locked||!start||!end||start>=end)throw Error('Choose a valid unlocked leg and date range');
 const sc=currentScenario(leg),original=ordered(sc.stays),idea=sc.ideas.find(i=>i.id===ideaId);
 const item:Stay={id:idea?.sourceStayId&&!original.some(st=>st.id===idea.sourceStayId)?idea.sourceStayId:uid(),
   place:clone(place),start,end,locked:false,status:idea?.status||'tentative',
   color:idea?.color||STAY_COLORS[original.length%STAY_COLORS.length],linkNextId:null};
 const candidate=[...clone(original),item];
 const collisions=resolveCollisions(candidate,[item.id],original,sc,'forward');
 if(!collisions.valid)throw Error(collisions.reason);
 const oldBoundary=maxDate(sc.end||leg.end,...original.map(st=>st.end))!;
 const newBoundary=maxDate(oldBoundary,...candidate.map(st=>st.end))!;
 const boundaryDelta=days(oldBoundary,newBoundary);
 if(leg.linkNextId&&boundaryDelta){
   const followers=analyzeLegMove(s,leg.linkNextId,boundaryDelta,true);
   if(!followers.valid)throw Error(followers.reason);
   currentJourney(next).legs=clone(followers.legs);
 }
 const active=activeLegs(next).find(l=>l.id===legId)!;
 currentScenario(active).stays=clone(candidate);
 if(ideaId)currentScenario(active).ideas=currentScenario(active).ideas.filter(i=>i.id!==ideaId);
 next.selectedLegId=legId;next.selectedStayId=item.id;next.view='leg';return next;
}
export function addIdea(s:PlanningState,legId:string,place:Place,nightsTarget=3):PlanningState{
 const n=clone(s),leg=activeLegs(n).find(l=>l.id===legId);if(!leg)throw Error('Choose a leg');
 currentScenario(leg).ideas.push({id:uid(),place:clone(place),nightsTarget});return n;
}
export function scheduleIdea(s:PlanningState,idea:Idea,start:string):PlanningState {return insertStay(s,currentLeg(s).id,idea.place,start,add(start,idea.nightsTarget||3),idea.id);}
export {add,days,ordered,currentJourney,currentLeg,currentScenario,legBounds};
