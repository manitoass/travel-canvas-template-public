'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {createLegacy,native}=require('./legacy-adapter.cjs');
const {cases,clone,createState,scenario,stay}=require('./cases.cjs');
const {project}=require('./projection.cjs');
const planning=require('../dist/engine/planning.js');
const dates=require('../dist/engine/dates.js');
const links=require('../dist/engine/links.js');
const goldens=require('../fixtures/golden-v0.9-operations.json');
function deterministic(seed){let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
const randInt=(r,a,b)=>a+Math.floor(r()*(b-a+1));

test('immutable v0.9 files exactly match release checksums',()=>{
  const expected=require('../fixtures/baseline-checksums.json');
  for(const [file,hash] of Object.entries(expected)){
    const current=crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'..',file))).digest('hex');
    assert.equal(current,hash,file);
  }
});
test('captured golden corpus has one baseline for each named scenario',()=>{
  assert.equal(cases.length,goldens.count);
  assert.equal(cases.length,goldens.cases.length);
  assert.ok(cases.length>=50);
  assert.equal(new Set(cases.map(x=>x.name)).size,cases.length);
});
for(const entry of cases){
  test(`v0.9 parity: ${entry.name}`,()=>{
    const legacy=createLegacy(entry.state);
    const old=native(legacy.computeOperation(entry.op.kind,entry.op));
    const next=native(planning.computePlanningOperation(entry.state,entry.op));
    assert.deepEqual(next,old,'TypeScript engine must match the original v0.9 output');
    assert.deepEqual(project(next),goldens.cases.find(c=>c.name===entry.name)?.expected,'Frozen golden output changed');
  });
}
test('date-only semantics: same-day transfer, leap year, DST, year crossover',()=>{
  const legacy=createLegacy();
  const casesDate=[
    ['2027-02-10','2027-03-15',33],
    ['2027-02-15','2027-02-15',0],
    ['2028-02-28','2028-03-01',2],
    ['2027-03-13','2027-03-16',3],
    ['2027-12-30','2028-01-03',4],
    ['2027-04-01','2027-03-29',-3],
  ];
  for(const [a,b,n] of casesDate){
    assert.equal(dates.days(a,b),n);
    assert.equal(dates.add(a,n),b);
    assert.equal(dates.days(a,b),legacy.days(a,b));
  }
});
test('v0.9 sample fixture has six independent legs and 22 stays',()=>{
  const state=createState(),journey=planning.currentJourney(state);
  assert.equal(journey.legs.length,6);
  assert.equal(journey.legs.flatMap(l=>planning.currentScenario(l).stays).length,22);
  assert.equal(dates.days('2027-02-10','2027-03-15'),33);
});
test('stay links are symmetric edges attached to IDs, not array positions',()=>{
  const state=createState();const sc=scenario(state);
  sc.stayLinks=[{a:'sea2',b:'sea3'}];
  assert.equal(links.hasStayLink('sea2','sea3',sc),true);
  assert.equal(links.hasStayLink('sea3','sea2',sc),true);
  assert.deepEqual([...links.linkedComponent('sea3',sc)].sort(),['sea2','sea3']);
  const shuffled=clone(sc);shuffled.stays.reverse();
  assert.equal(links.hasStayLink('sea3','sea2',shuffled),true);
  const unlink=links.toggleStayLink(sc,'sea2','sea3');
  assert.equal(unlink.valid,true);
  if(unlink.valid){assert.equal(links.hasStayLink('sea2','sea3',unlink.scenario),false);assert.equal(links.hasStayLink('sea2','sea3',sc),true);}
});
test('links reject cycles and unrelated non-neighbor additions',()=>{
  const sc=scenario(createState());
  const first=links.toggleStayLink(sc,'sea2','sea3');assert.equal(first.valid,true);
  if(!first.valid)return;
  const second=links.toggleStayLink(first.scenario,'sea3','sea4');assert.equal(second.valid,true);
  if(!second.valid)return;
  assert.equal(links.toggleStayLink(second.scenario,'sea2','sea4').valid,false);
});
test('every valid operation has atomic copy-on-write state; input remains unchanged',()=>{
  for(const {op,state,name} of cases){
    const before=JSON.stringify(state);
    const result=planning.applyPlanningOperation(state,op);
    assert.equal(JSON.stringify(state),before,`input mutated in ${name}`);
    if(result.valid&&result.changed){
      assert.notEqual(result.state,state);
      assert.notEqual(JSON.stringify(result.state),before,`no change after successful ${name}`);
    }else assert.equal(JSON.stringify(result.state),before,`unexpected change after blocked ${name}`);
  }
});
test('unschedule is reversible by state snapshot and preserves identity/last duration',()=>{
  const state=createState();
  scenario(state).stayLinks=[{a:'sea2',b:'sea3'},{a:'sea3',b:'sea4'}];
  const before=JSON.stringify(state);
  const result=planning.moveStayToIdeas(state,'sea3','idea-stable');
  assert.equal(result.valid,true);
  if(!result.valid)return;
  const sc=scenario(result.state);
  assert.equal(sc.stays.some(s=>s.id==='sea3'),false);
  assert.deepEqual(sc.stayLinks,[]);
  assert.equal(result.idea.sourceStayId,'sea3');
  assert.equal(result.idea.nightsTarget,6);
  assert.deepEqual(result.idea.lastDates,{start:'2027-02-21',end:'2027-02-27'});
  assert.equal(JSON.stringify(state),before,'source state cannot mutate');
});
test('scenario isolation: editing active leg cannot modify sibling scenarios',()=>{
  const state=createState(),sc=scenario(state),copy=clone(sc);
  copy.id='alternate';copy.name='Alternative';
  state.journeyVersions[0].legs.find(l=>l.id==='sea').scenarios.push(copy);
  const before=JSON.stringify(copy);
  const result=planning.applyPlanningOperation(state,{kind:'stay',id:'sea3',mode:'right',delta:2});
  assert.equal(result.valid,true);
  if(!result.valid)return;
  const sea=result.state.journeyVersions[0].legs.find(l=>l.id==='sea');
  assert.equal(JSON.stringify(sea.scenarios.find(s=>s.id==='alternate')),before);
});
test('undo model: each accepted operation has a complete reversible before state',()=>{
  const seed=createState();let current=clone(seed),history=[];
  const ops=[
    {kind:'stay',id:'sea3',mode:'right',delta:2},
    {kind:'stay',id:'sea3',mode:'move',delta:2},
    {kind:'stay',id:'sea3',mode:'left',delta:-1}
  ];
  for(const op of ops){
    const result=planning.applyPlanningOperation(current,op);
    assert.equal(result.valid,true);
    if(!result.valid)continue;
    if(result.changed){history.push(current);current=result.state;}
  }
  assert.equal(history.length,3);
  while(history.length)current=history.pop();
  assert.deepEqual(current,seed);
});
test('500 seeded random preview comparisons against ACTUAL v0.9 implementation',()=>{
  const rng=deterministic(20261023),legacy=createLegacy();
  let compared=0,accepted=0,blocked=0;
  for(let i=0;i<500;i++){
    let state=createState();const sc=scenario(state);
    const ids=sc.stays.map(s=>s.id);
    const count=randInt(rng,0,3);
    for(let k=0;k<count;k++){
      const idx=randInt(rng,0,3),a=ids[idx],b=ids[idx+1];
      if(!sc.stayLinks.some(e=>e.a===a&&e.b===b))sc.stayLinks.push({a,b});
    }
    if(rng()<0.35)stay(state,ids[randInt(rng,0,4)]).locked=true;
    if(rng()<0.07)state.journeyVersions[0].legs.find(l=>l.id==='sea').locked=true;
    const id=ids[randInt(rng,0,4)],mode=['move','left','right'][randInt(rng,0,2)],delta=randInt(rng,-20,25),op={kind:'stay',id,mode,delta};
    legacy.setState(state);
    const old=native(legacy.computeOperation('stay',op));
    const newer=native(planning.computePlanningOperation(state,op));
    assert.deepEqual(newer,old,`random seed=20261023 iteration=${i} op=${JSON.stringify(op)}`);
    compared++;if(old.valid)accepted++;else blocked++;
  }
  assert.equal(compared,500);
  assert.ok(accepted>100&&blocked>10,`accepted ${accepted}, blocked ${blocked}`);
});
test('200 seeded random repeated edits retain exact v0.9 sequence parity',()=>{
  const rng=deterministic(1701),legacy=createLegacy();
  let state=createState(),applied=0,blocked=0;
  for(let i=0;i<200;i++){
    const sc=scenario(state),list=sc.stays;
    const stayId=list[randInt(rng,0,list.length-1)].id;
    const mode=['move','left','right'][randInt(rng,0,2)];
    const delta=randInt(rng,-8,8);
    const op={kind:'stay',id:stayId,mode,delta};
    legacy.setState(state);
    const old=native(legacy.computeOperation('stay',op));
    const newer=native(planning.computePlanningOperation(state,op));
    assert.deepEqual(newer,old,`sequence iteration ${i}`);
    if(newer.valid&&newer.isDifferent){
      const appliedResult=planning.applyPlanningOperation(state,op);
      assert.equal(appliedResult.valid,true);
      state=appliedResult.state;applied++;
    } else blocked++;
  }
  assert.ok(applied>30&&blocked>20,`applied ${applied}, blocked/no-op ${blocked}`);
});
