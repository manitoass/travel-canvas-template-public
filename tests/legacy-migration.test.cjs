'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {createLegacy,native}=require('./legacy-adapter.cjs');
const {createState,scenario,clone}=require('./cases.cjs');

test('v0.6 explicit forward stay links upgrade to undirected edges exactly once',()=>{
  const s=createState(),sc=scenario(s);
  sc.stayLinks=[];sc.stayLinksV07=false;sc.stayLinksInitialized=true;
  sc.stays[0].linkNextId='sea2';sc.stays[1].linkNextId=null;
  const legacy=createLegacy(s);let upgraded=native(legacy.getState());
  let upgradedSc=upgraded.journeyVersions[0].legs.find(l=>l.id==='sea').scenarios[0];
  assert.deepEqual(upgradedSc.stayLinks,[{a:'sea1',b:'sea2'}]);
  assert.equal(upgradedSc.stayLinksV07,true);
  upgradedSc.stayLinks=[];
  legacy.setState(upgraded);
  upgraded=native(legacy.getState());
  assert.deepEqual(upgraded.journeyVersions[0].legs.find(l=>l.id==='sea').scenarios[0].stayLinks,[],
    'Deliberately removed links must not be reintroduced after migration');
});
test('v0.5 pre-link-tracking contiguous nights are linked only during first migration',()=>{
  const state=createState(),sc=scenario(state);
  delete sc.stayLinksInitialized;delete sc.stayLinksV07;
  for(const st of sc.stays)delete st.linkNextId;
  const legacy=createLegacy(state),s=native(legacy.getState());
  const edges=s.journeyVersions[0].legs.find(l=>l.id==='sea').scenarios[0].stayLinks;
  assert.equal(edges.length,4);
  assert.deepEqual(edges.map(e=>[e.a,e.b]),[['sea1','sea2'],['sea2','sea3'],['sea3','sea4'],['sea4','sea5']]);
});
test('legacy normalizer removes dangling duplicate and self-links without changing stay dates',()=>{
  const s=createState(),sc=scenario(s),before=sc.stays.map(st=>[st.id,st.start,st.end]);
  sc.stayLinks=[{a:'sea2',b:'sea3'},{a:'sea3',b:'sea2'},{a:'sea3',b:'missing'},{a:'sea2',b:'sea2'}];
  const legacy=createLegacy(s),fixed=native(legacy.getState());
  const actual=fixed.journeyVersions[0].legs.find(l=>l.id==='sea').scenarios[0];
  assert.deepEqual(actual.stayLinks,[{a:'sea2',b:'sea3'}]);
  assert.deepEqual(actual.stays.map(st=>[st.id,st.start,st.end]),before);
});
