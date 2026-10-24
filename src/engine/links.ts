import type {LegScenario,StayLink} from './types';
import {ordered} from './dates';
export function hasStayLink(a:string,b:string,sc:LegScenario):boolean {
  return !!a&&!!b&&(sc.stayLinks||[]).some(e=>(e.a===a&&e.b===b)||(e.a===b&&e.b===a));
}
export function linkedNeighbours(id:string,sc:LegScenario):string[] {
  return (sc.stayLinks||[]).flatMap(e=>e.a===id?[e.b]:e.b===id?[e.a]:[]);
}
export function linkedComponent(id:string,sc:LegScenario,allowed:Set<string>|null=null):Set<string> {
  const seen=new Set<string>(), stack=[id];
  while(stack.length) {
    const item=stack.pop()!;
    if(seen.has(item)||allowed&&!allowed.has(item))continue;
    seen.add(item);
    for(const other of linkedNeighbours(item,sc))if(!seen.has(other))stack.push(other);
  }
  return seen;
}
/** User intent for an edge is independent of its neighbor's array position.
 * Reject extra edges that would form a loop, just as the v0.9 UI does.
 */
export function toggleStayLink(sc:LegScenario,a:string,b:string):{valid:true;scenario:LegScenario}|{valid:false;reason:string} {
  const from=sc.stays.find(s=>s.id===a),to=sc.stays.find(s=>s.id===b);
  if(!from||!to||a===b)return {valid:false,reason:'Stay not found or cannot link a stay to itself'};
  const updated:LegScenario=JSON.parse(JSON.stringify(sc));
  if(hasStayLink(a,b,sc)) {
    updated.stayLinks=updated.stayLinks.filter(e=>!((e.a===a&&e.b===b)||(e.a===b&&e.b===a)));
  } else {
    const route=ordered(sc.stays),ai=route.findIndex(s=>s.id===a),bi=route.findIndex(s=>s.id===b);
    if(Math.abs(ai-bi)!==1)return {valid:false,reason:'New links can only be added between neighbouring destinations'};
    if(linkedComponent(a,sc).has(b))return {valid:false,reason:'Those destinations are already joined by links; another link would create a loop'};
    updated.stayLinks.push({a,b});
  }
  return {valid:true,scenario:updated};
}
export function normaliseStayLinks(sc:LegScenario):StayLink[] {
  const ids=new Set(sc.stays.map(s=>s.id)),seen=new Set<string>();
  return (sc.stayLinks||[]).filter(({a,b})=>{
    if(!ids.has(a)||!ids.has(b)||a===b)return false;
    const key=[a,b].sort().join('|');if(seen.has(key))return false;seen.add(key);return true;
  });
}
