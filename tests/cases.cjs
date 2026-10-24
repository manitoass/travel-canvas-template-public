'use strict';
const fs=require('node:fs'),path=require('node:path');
const frozen=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/v0.9-seed-state.json')));
const clone=o=>JSON.parse(JSON.stringify(o));
function createState(mutator=()=>{},selected='sea'){
  const state=clone(frozen);state.selectedLegId=selected;
  mutator(state,state.journeyVersions[0].legs.find(l=>l.id===selected),state.journeyVersions[0].legs);
  return state;
}
function stay(state,id){return state.journeyVersions[0].legs.flatMap(l=>l.scenarios[0].stays).find(s=>s.id===id);}
function scenario(state,legId='sea'){return state.journeyVersions[0].legs.find(l=>l.id===legId).scenarios[0];}
function links(edges){return (s)=>{scenario(s).stayLinks=edges.map(([a,b])=>({a,b}));};}
const cases=[];
const put=(name,op,mutate=()=>{},selected='sea')=>cases.push({name,op,state:createState(mutate,selected)});
const p=(id,mode,delta)=>({kind:'stay',id,mode,delta});
const lg=(id,delta)=>({kind:'leg',id,delta});
// Canonical v0.9 gestures / date-only invariants
put('zero move',p('sea3','move',0));
put('increase stay right edge +2',p('sea3','right',2));
put('shrink stay right edge -3',p('sea3','right',-3));
put('shrink to minimum one night',p('sea3','right',-5));
put('reject zero-night stay',p('sea3','right',-6));
put('extend left two nights',p('sea3','left',-2));
put('shrink left three nights',p('sea3','left',3));
put('reject invalid left shrink',p('sea3','left',8));
put('move into following',p('sea2','move',4));
put('move into preceding',p('sea4','move',-5));
put('move far before trip',p('sea3','move',-27));
put('move far after trip',p('sea3','move',50));
put('missing stay rejected',p('missing','move',1));
put('stay locked itself',p('sea3','move',2),(s)=>{stay(s,'sea3').locked=true;});
put('leg locked itself',p('sea3','left',-2),(_s,l)=>{l.locked=true;});
put('locked next blocks collision',p('sea3','right',2),(s)=>{stay(s,'sea4').locked=true;});
put('locked previous blocks left extension',p('sea3','left',-2),(s)=>{stay(s,'sea2').locked=true;});
put('move earlier to free range before lock',p('sea3','move',-27),(s)=>{stay(s,'sea1').locked=true;});
put('move past lock to free range',p('sea3','move',38),(s)=>{stay(s,'sea4').locked=true;});
// Linked groups: two sides are shared, explicit edges
put('move with linked left',p('sea3','move',2),links([['sea2','sea3']]));
put('move with linked right',p('sea3','move',2),links([['sea3','sea4']]));
put('move with both sides linked',p('sea3','move',2),links([['sea2','sea3'],['sea3','sea4']]));
put('resize right moves right link only',p('sea3','right',2),links([['sea2','sea3'],['sea3','sea4']]));
put('resize left moves left link only',p('sea3','left',-2),links([['sea2','sea3'],['sea3','sea4']]));
put('resize left with right link alone',p('sea3','left',-2),links([['sea3','sea4']]));
put('resize right with left link alone',p('sea3','right',2),links([['sea2','sea3']]));
put('locked linked follower blocks move',p('sea3','move',3),(s)=>{links([['sea3','sea4']])(s);stay(s,'sea4').locked=true;});
put('locked linked predecessor blocks left resize',p('sea3','left',-3),(s)=>{links([['sea2','sea3']])(s);stay(s,'sea2').locked=true;});
put('linked group collision with unrelated',p('sea3','move',-5),links([['sea3','sea4']]));
put('linked pair into another linked pair',p('sea3','move',-8),links([['sea1','sea2'],['sea3','sea4']]));
put('three grouped stays colliding',p('sea3','move',-7),links([['sea3','sea4'],['sea4','sea5']]));
put('link past reorder independent ID',p('sea3','move',-12),links([['sea2','sea3']]));
put('linked graph cycle already present',p('sea3','move',2),links([['sea2','sea3'],['sea3','sea4'],['sea4','sea2']]));
// Original overlap is grandfathered in v0.9; flag as a known behavior rather than changing it.
put('pre-existing overlap in source',p('sea3','right',3),(s)=>{stay(s,'sea2').end='2027-02-24';});
put('one-night Sunday start across week',p('sea1','right',2),(s)=>{stay(s,'sea1').start='2027-02-14';stay(s,'sea1').end='2027-02-15';});
put('February March boundary',p('sea4','right',9));
put('cross year boundary',p('eu4','right',-7),(s)=>{stay(s,'eu4').start='2026-12-26';stay(s,'eu4').end='2027-01-09';},'europe');
put('leap February boundary',p('sea1','right',5),(s)=>{stay(s,'sea1').start='2028-02-26';stay(s,'sea1').end='2028-03-01';},'sea');
// Whole legs and directed leg links
put('independent leg move',lg('sea',4));
put('whole leg move backwards',lg('sea',-9));
put('whole leg no delta',lg('sea',0));
put('linked legs shift together',lg('sea',7),(_s,l)=>{l.linkNextId='japan';});
put('linked multi-leg chain',lg('sea',3),(_s,l,legs)=>{l.linkNextId='japan';legs.find(x=>x.id==='japan').linkNextId='taiwan';});
put('locked linked leg refuses move',lg('sea',5),(_s,l,legs)=>{l.linkNextId='japan';legs.find(x=>x.id==='japan').locked=true;});
put('locked stay inside leg refuses whole move',lg('sea',4),(s)=>{stay(s,'sea2').locked=true;});
put('linked cycle refuses move',lg('sea',4),(_s,l,legs)=>{l.linkNextId='japan';legs.find(x=>x.id==='japan').linkNextId='sea';});
put('move leg into another unlinked leg',lg('sea',35));
put('missing leg rejected',lg('gone',5));
put('end boundary resize with leg link',p('sea5','right',8),(_s,l)=>{l.linkNextId='japan';});
put('end boundary resize with linked locked leg',p('sea5','right',8),(_s,l,legs)=>{l.linkNextId='japan';legs.find(x=>x.id==='japan').locked=true;});
put('end boundary does not move following leg when buffer remains',p('sea3','right',1),(_s,l)=>{l.linkNextId='japan';});
module.exports={cases,createState,scenario,stay,clone};
