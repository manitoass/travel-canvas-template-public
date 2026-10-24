'use strict';
const {native}=require('./legacy-adapter.cjs');
/** Human-readable stable golden-master projection; full objects still compared at runtime. */
function project(result){
  const out=native(result);
  if(out.stays)out.stays=out.stays.map(s=>({id:s.id,start:s.start,end:s.end,locked:s.locked}));
  if(out.legs)out.legs=out.legs.map(l=>({id:l.id,start:l.start,end:l.end,linkedTo:l.linkNextId??null,
    scenario:l.scenarios.find(sc=>sc.id===l.activeScenarioId)?.stays.map(s=>({id:s.id,start:s.start,end:s.end,locked:s.locked}))}));
  if(out.followers)out.followers=project(out.followers);
  return out;
}
module.exports={project};
