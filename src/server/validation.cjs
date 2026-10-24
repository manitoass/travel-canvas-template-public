'use strict';
const { randomUUID, createHash } = require('node:crypto');
const LIMIT_BYTES = 4 * 1024 * 1024;
const plain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (message) => { const e = new Error(message); e.status = 422; throw e; };
const idOK = (v) => typeof v === 'string' && v.length > 0 && v.length <= 160;
const dateOK = (v) => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const n = new Date(v + 'T00:00:00Z');
  return !Number.isNaN(n.valueOf()) && n.toISOString().slice(0, 10) === v;
};
const clone = (x) => structuredClone(x);
function normalize(source) {
  if (!plain(source)) fail('Plan must be a JSON object');
  const s = clone(source);
  if (!Array.isArray(s.journeyVersions) || !s.journeyVersions.length) fail('At least one journey is required');
  if (s.journeyVersions.length > 150) fail('Too many journeys');
  for (const j of s.journeyVersions) {
    if (!Array.isArray(j.legs) || !j.legs.length) fail('Every journey must contain a leg');
    if (j.legs.length > 300) fail('Too many legs in a journey');
    for (const l of j.legs) {
      l.locked = !!l.locked;
      l.linkNextId = l.linkNextId || null;
      if (!Array.isArray(l.scenarios) || !l.scenarios.length) fail('Each leg requires a scenario');
      for (const sc of l.scenarios) {
        sc.stays ||= [];
        sc.ideas ||= [];
        const ids = new Set(sc.stays.map(st => st.id));
        if (!sc.stayLinksV07) {
          sc.stayLinks = sc.stays.filter(st => st.linkNextId && ids.has(st.linkNextId))
            .map(st => ({a: st.id, b: st.linkNextId}));
          sc.stayLinksV07 = true;
        }
        const seen = new Set();
        sc.stayLinks = (sc.stayLinks || []).filter(link => {
          if (!plain(link) || !ids.has(link.a) || !ids.has(link.b) || link.a === link.b) return false;
          const key = [link.a, link.b].sort().join('|');
          if (seen.has(key)) return false;
          seen.add(key); return true;
        });
        for (const st of sc.stays) st.locked = !!st.locked;
      }
    }
  }
  if (!s.journeyVersions.some(j => j.id === s.activeJourneyVersionId)) s.activeJourneyVersionId = s.journeyVersions[0].id;
  const current = s.journeyVersions.find(j => j.id === s.activeJourneyVersionId);
  if (!current.legs.some(l => l.id === s.selectedLegId)) s.selectedLegId = current.legs[0].id;
  s.view = ['leg', 'journey', 'overview'].includes(s.view) ? s.view : 'leg';
  if (s.selectedStayId != null && typeof s.selectedStayId !== 'string') s.selectedStayId = null;
  return s;
}
function validateState(source) {
  const raw = JSON.stringify(source);
  if (raw.length > LIMIT_BYTES) fail('Plan exceeds the 4 MB safety limit');
  // Newer plans must not have dangling links silently removed by normalization.
  for(const j of source.journeyVersions || []) for(const l of j.legs || []) for(const sc of l.scenarios || []) {
    if(sc.stayLinksV07 && Array.isArray(sc.stayLinks)) {
      const ids=new Set((sc.stays||[]).map(st=>st.id)),seen=new Set();
      for(const e of sc.stayLinks){const k=[e.a,e.b].sort().join('|');if(!ids.has(e.a)||!ids.has(e.b)||e.a===e.b||seen.has(k))fail('Invalid destination link; nothing was saved');seen.add(k);}
    }
  }
  const s = normalize(source);
  const journeyIDs = new Set();
  for (const j of s.journeyVersions) {
    if (!idOK(j.id) || journeyIDs.has(j.id)) fail('Duplicate or invalid journey ID');
    journeyIDs.add(j.id);
    if (typeof j.name !== 'string' || j.name.length > 320) fail('Invalid journey name');
    const legIDs = new Set();
    for (const l of j.legs) {
      if (!idOK(l.id) || legIDs.has(l.id)) fail('Duplicate or invalid leg ID');
      legIDs.add(l.id);
      if (!dateOK(l.start) || !dateOK(l.end) || l.end <= l.start) fail('Invalid leg date interval');
      if (typeof l.title !== 'string' || l.title.length > 320) fail('Invalid leg title');
      const scenarioIDs = new Set();
      for (const sc of l.scenarios) {
        if (!idOK(sc.id) || scenarioIDs.has(sc.id)) fail('Duplicate or invalid scenario ID');
        scenarioIDs.add(sc.id);
        if (typeof sc.name !== 'string' || sc.name.length > 320) fail('Invalid scenario name');
        if (!Array.isArray(sc.stays) || !Array.isArray(sc.ideas) || !Array.isArray(sc.stayLinks)) fail('Invalid scenario collections');
        if (sc.stays.length > 1500 || sc.ideas.length > 2500) fail('Too many destinations in a scenario');
        const stayIDs = new Set(), ideaIDs = new Set();
        for (const st of sc.stays) {
          if (!idOK(st.id) || stayIDs.has(st.id)) fail('Duplicate or invalid stay ID');
          stayIDs.add(st.id);
          if (!dateOK(st.start) || !dateOK(st.end) || st.end <= st.start) fail('Invalid destination interval');
          if (!plain(st.place) || typeof st.place.name !== 'string' || st.place.name.length > 400) fail('Invalid destination place');
          for (const key of ['lat','lon']) if (st.place[key] !== undefined && st.place[key] !== null && (!Number.isFinite(st.place[key]) || Math.abs(st.place[key]) > (key === 'lat' ? 90 : 180))) fail('Invalid coordinates');
        }
        for (const idea of sc.ideas) {
          if (!idOK(idea.id) || ideaIDs.has(idea.id)) fail('Duplicate or invalid idea ID');
          ideaIDs.add(idea.id);
          if (!plain(idea.place) || typeof idea.place.name !== 'string') fail('Invalid idea location');
          if (idea.nightsTarget != null && (!Number.isInteger(idea.nightsTarget) || idea.nightsTarget < 1 || idea.nightsTarget > 3650)) fail('Invalid idea duration');
        }
        for (const link of sc.stayLinks) if (!stayIDs.has(link.a) || !stayIDs.has(link.b)) fail('Link references missing stay');
      }
      if (!scenarioIDs.has(l.activeScenarioId)) fail('Leg references missing active scenario');
    }
    for (const l of j.legs) if (l.linkNextId && !legIDs.has(l.linkNextId)) fail('Leg link references missing leg');
  }
  return s;
}
function counts(s) {
  let legs=0, scenarios=0, stays=0, ideas=0, links=0, nights=0;
  for (const j of s.journeyVersions) for (const l of j.legs) {
    legs++;
    for (const sc of l.scenarios) {
      scenarios++; stays += sc.stays.length; ideas += sc.ideas.length; links += sc.stayLinks.length;
      for (const st of sc.stays) nights += (new Date(st.end+'T00:00:00Z')-new Date(st.start+'T00:00:00Z'))/86400000;
    }
  }
  return {journeys:s.journeyVersions.length, legs, scenarios, stays, ideas, links, nightsAcrossAllVersions:nights};
}
function importBackup(input) {
  if (!plain(input)) fail('Import file is not an object');
  if (input.format !== 'travel-canvas-prototype' && input.format !== 'travel-canvas-milestone-3') fail('Unknown Travel Canvas backup format');
  return validateState(input.state);
}
function remapImportedPlans(existing, imported) {
  const out = clone(existing);
  const allIDs = new Map();
  const newid = old => { if (!allIDs.has(old)) allIDs.set(old, randomUUID()); return allIDs.get(old); };
  for (const sourceJourney of imported.journeyVersions) {
    // IDs are scoped to each scenario; map all references per leg instead of by identical string across journeys.
    const j=clone(sourceJourney);
    j.id=randomUUID(); j.name=(j.name || 'Journey')+' (imported)'; j.title=(j.title||sourceJourney.name||'Journey')+' (imported)';
    const legMap=new Map(j.legs.map(l=>[l.id,randomUUID()]));
    for(const l of j.legs){
      const oldLegId=l.id;
      l.id=legMap.get(oldLegId);
      l.linkNextId=l.linkNextId ? legMap.get(l.linkNextId)||null : null;
      const scenarioMap=new Map(l.scenarios.map(sc=>[sc.id,randomUUID()]));
      l.activeScenarioId=scenarioMap.get(l.activeScenarioId);
      for(const sc of l.scenarios){
        sc.id=scenarioMap.get(sc.id);
        const stayMap=new Map(sc.stays.map(st=>[st.id,randomUUID()]));
        const ideaMap=new Map(sc.ideas.map(i=>[i.id,randomUUID()]));
        for(const st of sc.stays){st.id=stayMap.get(st.id);if(st.linkNextId)st.linkNextId=stayMap.get(st.linkNextId)||null;}
        for(const idea of sc.ideas){idea.id=ideaMap.get(idea.id);if(idea.sourceStayId)idea.sourceStayId=stayMap.get(idea.sourceStayId)||randomUUID();}
        for(const edge of sc.stayLinks){edge.a=stayMap.get(edge.a);edge.b=stayMap.get(edge.b);}
        if(sc.connections && typeof sc.connections === 'object'){
          // Connection metadata can have arbitrary legacy keys; keep data, remap recognizable stay ID references.
          const visit=(v)=>{if(Array.isArray(v))return v.map(visit);if(plain(v)){for(const k of Object.keys(v)){if(['fromStayId','toStayId','fromId','toId','stayId'].includes(k)&&stayMap.has(v[k]))v[k]=stayMap.get(v[k]);else v[k]=visit(v[k]);}}return v;};
          visit(sc.connections);
        }
      }
    }
    out.journeyVersions.push(j);
  }
  const first=out.journeyVersions[existing.journeyVersions.length];
  out.activeJourneyVersionId=first.id;out.selectedLegId=first.legs[0].id;out.selectedStayId=null;out.view='leg';
  return validateState(out);
}
const fingerprint = obj => createHash('sha256').update(JSON.stringify(obj)).digest('hex');
module.exports={LIMIT_BYTES,dateOK,validateState,normalize,counts,importBackup,remapImportedPlans,fingerprint};
