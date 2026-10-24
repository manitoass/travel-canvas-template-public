/* Travel Canvas interactive concept prototype — zero-build vanilla JavaScript.
   Geographic polygons from Natural Earth (public domain). Place lookup optional via OpenStreetMap Nominatim.
   This is a single-user browser prototype; it is not a secure server-backed V1 release. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const svgIcon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const MS = 86400000;
const WEEK = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const LEG_COLORS = ['#5186c9','#159e8b','#9775c5','#d29b51','#d16d85','#508f9c','#8f9d4c','#aa7a62'];
const STAY_COLORS = ['#d28d38','#159d92','#9070c3','#4d83d1','#cd6688','#8c9d4b','#b67f58','#5b99a9','#b080ab','#89984b'];
const STORAGE_KEY = 'travel-canvas-working-prototype-2026-10-23-v1';
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`;
const clone = o => JSON.parse(JSON.stringify(o));
const epoch = iso => { const [y,m,d] = iso.split('-').map(Number); return Date.UTC(y,m-1,d)/MS; };
const isoAt = n => new Date(n*MS).toISOString().slice(0,10);
const add = (iso,n) => isoAt(epoch(iso)+n);
const days = (a,b) => epoch(b)-epoch(a);
const clamp = (n,a,b) => Math.min(b,Math.max(a,n));
const minDate = (...dates) => dates.filter(Boolean).sort()[0]||null;
const maxDate = (...dates) => dates.filter(Boolean).sort().at(-1)||null;
function fmtDate(iso,year=false){ if(!iso)return 'Flexible';let [y,m,d]=iso.split('-').map(Number);return `${MONTHS[m-1].slice(0,3)} ${d}${year?`, ${y}`:''}`;}
const monthName = iso => MONTHS[Number(iso.slice(5,7))-1];
function marker(n){return `<span class="color-dot" style="background:${n}"></span>`;}
const CITY_DATA = [
 ['Bangkok','Thailand',13.7563,100.5018,'🇹🇭'],['Chiang Mai','Thailand',18.7883,98.9853,'🇹🇭'],['Phuket','Thailand',7.8804,98.3923,'🇹🇭'],['Krabi','Thailand',8.0863,98.9063,'🇹🇭'],['Siem Reap','Cambodia',13.3671,103.8448,'🇰🇭'],['Phnom Penh','Cambodia',11.5564,104.9282,'🇰🇭'],['Luang Prabang','Laos',19.8833,102.1333,'🇱🇦'],['Vientiane','Laos',17.9757,102.6331,'🇱🇦'],['Hanoi','Vietnam',21.0278,105.8342,'🇻🇳'],['Hoi An','Vietnam',15.8801,108.338,'🇻🇳'],['Ho Chi Minh City','Vietnam',10.8231,106.6297,'🇻🇳'],['Hue','Vietnam',16.4637,107.5909,'🇻🇳'],['Da Nang','Vietnam',16.0544,108.2022,'🇻🇳'],['Ha Long Bay','Vietnam',20.9101,107.1839,'🇻🇳'],['Ninh Binh','Vietnam',20.2506,105.9745,'🇻🇳'],
 ['Tokyo','Japan',35.6762,139.6503,'🇯🇵'],['Kyoto','Japan',35.0116,135.7681,'🇯🇵'],['Osaka','Japan',34.6937,135.5023,'🇯🇵'],['Nara','Japan',34.6851,135.8048,'🇯🇵'],['Kanazawa','Japan',36.5613,136.6562,'🇯🇵'],['Takayama','Japan',36.1461,137.2522,'🇯🇵'],['Hakone','Japan',35.2324,139.1069,'🇯🇵'],['Hiroshima','Japan',34.3853,132.4553,'🇯🇵'],['Fukuoka','Japan',33.5904,130.4017,'🇯🇵'],['Sapporo','Japan',43.0618,141.3545,'🇯🇵'],
 ['Taipei','Taiwan',25.033,121.5654,'🇹🇼'],['Tainan','Taiwan',22.9997,120.227,'🇹🇼'],['Kaohsiung','Taiwan',22.6273,120.3014,'🇹🇼'],['Hong Kong','Hong Kong',22.3193,114.1694,'🇭🇰'],['Singapore','Singapore',1.3521,103.8198,'🇸🇬'],['Kuala Lumpur','Malaysia',3.139,101.6869,'🇲🇾'],['George Town','Malaysia',5.4141,100.3288,'🇲🇾'],['Bali','Indonesia',-8.4095,115.1889,'🇮🇩'],['Yogyakarta','Indonesia',-7.7956,110.3695,'🇮🇩'],
 ['Paris','France',48.8566,2.3522,'🇫🇷'],['Nice','France',43.7102,7.262,'🇫🇷'],['Lyon','France',45.764,4.8357,'🇫🇷'],['Strasbourg','France',48.5734,7.7521,'🇫🇷'],['Colmar','France',48.0794,7.3585,'🇫🇷'],['Rome','Italy',41.9028,12.4964,'🇮🇹'],['Florence','Italy',43.7696,11.2558,'🇮🇹'],['Venice','Italy',45.4408,12.3155,'🇮🇹'],['Bologna','Italy',44.4949,11.3426,'🇮🇹'],['Naples','Italy',40.8518,14.2681,'🇮🇹'],['Milan','Italy',45.4642,9.19,'🇮🇹'],['Lisbon','Portugal',38.7223,-9.1393,'🇵🇹'],['Porto','Portugal',41.1579,-8.6291,'🇵🇹'],['Barcelona','Spain',41.3874,2.1686,'🇪🇸'],['Madrid','Spain',40.4168,-3.7038,'🇪🇸'],['Seville','Spain',37.3891,-5.9845,'🇪🇸'],['Prague','Czechia',50.0755,14.4378,'🇨🇿'],['Vienna','Austria',48.2082,16.3738,'🇦🇹'],['Budapest','Hungary',47.4979,19.0402,'🇭🇺'],['Amsterdam','Netherlands',52.3676,4.9041,'🇳🇱'],['London','United Kingdom',51.5072,-0.1276,'🇬🇧'],['Edinburgh','United Kingdom',55.9533,-3.1883,'🇬🇧'],['Zurich','Switzerland',47.3769,8.5417,'🇨🇭'],['Lucerne','Switzerland',47.0502,8.3093,'🇨🇭'],['Berlin','Germany',52.52,13.405,'🇩🇪'],['Munich','Germany',48.1351,11.582,'🇩🇪'],['Copenhagen','Denmark',55.6761,12.5683,'🇩🇰'],
 ['Los Angeles','USA',34.0522,-118.2437,'🇺🇸'],['Ventura','USA',34.2746,-119.229,'🇺🇸'],['San Diego','USA',32.7157,-117.1611,'🇺🇸'],['San Francisco','USA',37.7749,-122.4194,'🇺🇸'],['Seattle','USA',47.6062,-122.3321,'🇺🇸'],['Portland','USA',45.5152,-122.6784,'🇺🇸'],['St. Louis','USA',38.627,-90.1994,'🇺🇸'],['New York','USA',40.7128,-74.006,'🇺🇸'],['Vancouver','Canada',49.2827,-123.1207,'🇨🇦'],['Victoria','Canada',48.4284,-123.3656,'🇨🇦'],
 ['Sydney','Australia',-33.8688,151.2093,'🇦🇺'],['Melbourne','Australia',-37.8136,144.9631,'🇦🇺'],['Queenstown','New Zealand',-45.0312,168.6626,'🇳🇿'],['Auckland','New Zealand',-36.8485,174.7633,'🇳🇿'],['Kathmandu','Nepal',27.7172,85.324,'🇳🇵'],['Delhi','India',28.6139,77.209,'🇮🇳'],['Agra','India',27.1767,78.0081,'🇮🇳'],['Istanbul','Turkey',41.0082,28.9784,'🇹🇷'],['Cairo','Egypt',30.0444,31.2357,'🇪🇬'],['Dubai','UAE',25.2048,55.2708,'🇦🇪']
].map(([name,country,lat,lon,flag])=>({name,country,lat,lon,flag,id:`geo-${name.toLowerCase().replace(/[^a-z]/g,'')}-${country.toLowerCase().replace(/[^a-z]/g,'')}`}));
const city = (name,country) => clone(CITY_DATA.find(p=>p.name===name&&(!country||p.country===country))||CITY_DATA.find(p=>p.name===name)||{id:uid(),name,country:country||'',lat:0,lon:0,flag:'🌐'});
const S = (id,p,start,nights,status='placed')=>({id,place:city(p),start,end:add(start,nights),status,locked:false});
function leg(id,title,color,start,end,stayDefs,ideas=[]){return {id,title,color,start,end,locked:false,activeScenarioId:`${id}-sc1`,scenarios:[{id:`${id}-sc1`,name:'Main plan',stays:stayDefs,ideas:ideas.map(name=>({id:uid(),place:city(name)})),connections:{},stayLinks:[],stayLinksV07:true,stayLinksInitialized:true}]};}
function seedState(){const legs=[
 leg('europe','Europe','#5186c9','2027-01-08','2027-02-09',[S('eu1','Paris','2027-01-08',9),S('eu2','Strasbourg','2027-01-17',5),S('eu3','Rome','2027-01-22',10),S('eu4','Florence','2027-02-01',8)]),
 leg('sea','Southeast Asia','#159e8b','2027-02-10','2027-03-15',[S('sea1','Bangkok','2027-02-10',5),S('sea2','Siem Reap','2027-02-15',6),S('sea3','Luang Prabang','2027-02-21',6),S('sea4','Hanoi','2027-02-27',7),S('sea5','Hoi An','2027-03-06',9)],['Chiang Mai','Ninh Binh','Hue']),
 leg('japan','Japan','#9876c4','2027-03-20','2027-04-18',[S('jp1','Tokyo','2027-03-20',7),S('jp2','Kanazawa','2027-03-27',5),S('jp3','Kyoto','2027-04-01',9),S('jp4','Osaka','2027-04-10',8)],['Takayama','Nara']),
 leg('taiwan','Taiwan','#d69a4f','2027-04-19','2027-05-05',[S('tw1','Taipei','2027-04-19',7),S('tw2','Tainan','2027-04-26',5),S('tw3','Kaohsiung','2027-05-01',4)]),
 leg('california','California','#d06c85','2027-05-08','2027-05-22',[S('ca1','Los Angeles','2027-05-08',5),S('ca2','Ventura','2027-05-13',5),S('ca3','San Diego','2027-05-18',4)]),
 leg('pnw','Pacific Northwest','#508f9c','2027-05-24','2027-06-17',[S('pn1','Portland','2027-05-24',8),S('pn2','Seattle','2027-06-01',8),S('pn3','Vancouver','2027-06-09',8)])
 ];
 return {title:'Winter–Summer 2027',view:'leg',selectedLegId:'sea',selectedStayId:'sea3',activeJourneyVersionId:'journey-base',journeyVersions:[{id:'journey-base',name:'Main journey',legs}]};
}
let state;
try{const s=localStorage.getItem(STORAGE_KEY);state=s?JSON.parse(s):seedState();if(!state.journeyVersions?.length)throw Error('Bad stored state');}catch{state=seedState();}
function ensureStayColors(wholeState=state){
  for(const j of wholeState.journeyVersions||[])for(const l of j.legs||[]){
    if(!j.title)j.title=wholeState.title||j.name||'Untitled journey';
    if(typeof l.locked!=='boolean')l.locked=false;
    if(!l.linkNextId)l.linkNextId=null;
    for(const sc of l.scenarios||[]){
      const stays=sc.stays||[];
      for(const [i,stay] of stays.entries()){
        if(!stay.color)stay.color=STAY_COLORS[i%STAY_COLORS.length];
      }
      // Migrate existing v0.6 journeys once: neighbouring contiguous stays
      // initially retain the familiar ripple behaviour. Users can unlink any
      // pair independently. Never recreate a deliberately removed link.
      if(!sc.stayLinksInitialized){
        const dated=[...stays.filter(x=>x.start&&x.end)].sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id));
        for(let i=0;i<dated.length;i++){
          const item=dated[i],next=dated[i+1];
          if(item.linkNextId===undefined)item.linkNextId=next&&item.end===next.start?next.id:null;
        }
        sc.stayLinksInitialized=true;
      }
      const ids=new Set(stays.map(x=>x.id));
      for(const stay of stays){
        if(!ids.has(stay.linkNextId)||stay.linkNextId===stay.id)stay.linkNextId=null;
      }
      // v0.7: A link is one shared, undirected edge between two specific stay IDs.
      // Import the user's actual old forward links ONCE; do not invent links for
      // newly created stays or silently reconnect links after reordering.
      if(!sc.stayLinksV07){
        sc.stayLinks=stays.filter(s=>s.linkNextId&&ids.has(s.linkNextId))
          .map(s=>({a:s.id,b:s.linkNextId}));
        sc.stayLinksV07=true;
      }
      const used=new Set();
      sc.stayLinks=(sc.stayLinks||[]).filter(edge=>{
        if(!ids.has(edge.a)||!ids.has(edge.b)||edge.a===edge.b)return false;
        const key=[edge.a,edge.b].sort().join('|');
        if(used.has(key))return false;
        used.add(key);return true;
      });
    }
  }
}
ensureStayColors();
const ui={pendingDate:null,pendingRange:null,drag:null,ideaDrag:null,pendingMapPoint:null,localResults:[],remoteResults:[],lastSearchAt:0,editingTitle:false,saveError:false,view:'calendar',mobile:false,calendarPadBefore:2,calendarPadAfter:2,calendarPositioned:false,suppressClickUntil:0,ribbonExpanded:false};
const undoStack=[],redoStack=[];
const currentJourney=()=>state.journeyVersions.find(v=>v.id===state.activeJourneyVersionId)||state.journeyVersions[0];
const currentLeg=()=>currentJourney().legs.find(l=>l.id===state.selectedLegId)||currentJourney().legs[0];
const planTitle=()=>currentJourney()?.title||state.title||'Untitled journey';
const currentScenario=(leg=currentLeg())=>leg?.scenarios.find(v=>v.id===leg.activeScenarioId)||leg?.scenarios[0];
const currentStay=()=>currentScenario()?.stays.find(s=>s.id===state.selectedStayId)||null;
const ordered=stays=>[...stays].sort((a,b)=>(a.start||'9999').localeCompare(b.start||'9999')||a.id.localeCompare(b.id));
const workingPreview=()=>ui.drag?.candidate||null;
const effectiveLegs=()=>workingPreview()?.kind==='leg' ? workingPreview().legs : currentJourney().legs;
const visibleStays=(leg=currentLeg())=>{
  const preview=workingPreview();
  return preview?.kind==='stay'&&preview.legId===leg.id ? preview.stays : currentScenario(leg).stays;
};
const visibleStay=()=>visibleStays().find(s=>s.id===state.selectedStayId)||null;
function stayColor(s){return s?.color||STAY_COLORS[0];}
function overlapPairs(stays){
  const sorted=ordered(stays.filter(s=>s.start&&s.end)),conflicts=[];
  for(let i=0;i<sorted.length;i++)for(let j=i+1;j<sorted.length;j++){
    if(sorted[i].start<sorted[j].end&&sorted[j].start<sorted[i].end)
      conflicts.push([sorted[i].id,sorted[j].id]);
  }
  return conflicts;
}
function legBounds(l){const sc=currentScenario(l),stays=workingPreview()?.kind==='stay'&&l.id===currentLeg()?.id?visibleStays(l):(sc?.stays||[]),placed=stays.filter(s=>s.start&&s.end);return {start:minDate(sc?.start||l.start,...placed.map(s=>s.start)),end:maxDate(sc?.end||l.end,...placed.map(s=>s.end))};}
function legOverlaps(legs){return overlapPairs(legs.map(l=>({...legBounds(l),id:l.id})));}
const journeyBounds=()=>{let legs=effectiveLegs();return {start:minDate(...legs.map(l=>legBounds(l).start)),end:maxDate(...legs.map(l=>legBounds(l).end))};};
// Calendar gestures commit instantly; there are no stacked, unapplied drafts.
function hasDraft(){return false;}
function draftBlocked(){return false;}
function clearDraft(){if(ui.drag)ui.drag.candidate=null;renderAll();}
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));ui.saveError=false;$('saveLabel').textContent='Saved locally';$('saveIndicator').title='This prototype saves in this browser only, not across devices';}catch(err){ui.saveError=true;$('saveLabel').textContent='Save failed';$('saveIndicator').title=String(err);toast('Saving failed — check browser storage permissions.');}}
function commit(label,fn,options={}){
  if(ui.drag?.candidate)ui.drag.candidate=null;
  const before=JSON.stringify(state);
  fn();ensureStayColors();
  if(JSON.stringify(state)===before){renderAll();return false;}
  undoStack.push(before);if(undoStack.length>90)undoStack.shift();redoStack.length=0;
  persist();renderAll();if(!options.silent)toast(label);return true;
}
function undo(){
  if(ui.drag){ui.drag=null;removeDragGhost();hideDragTooltip();renderAll();toast('Canceled drag');return;}
  if(!undoStack.length)return;
  redoStack.push(JSON.stringify(state));state=JSON.parse(undoStack.pop());ensureStayColors();persist();renderAll();toast('Undid last change');
}
function redo(){
  if(ui.drag){toast('Release or cancel the drag first');return;}
  if(!redoStack.length)return;
  undoStack.push(JSON.stringify(state));state=JSON.parse(redoStack.pop());ensureStayColors();persist();renderAll();toast('Redid change');
}
function toast(msg){const el=document.createElement('div');el.className='toast';el.textContent=msg;$('toastStack').appendChild(el);setTimeout(()=>el.remove(),3400);}
function numNights(stays){return stays.filter(s=>s.start&&s.end).reduce((total,s)=>total+days(s.start,s.end),0);}
function allActiveStays(){return currentJourney().legs.flatMap(l=>currentScenario(l).stays);}
function activeLegStayCount(){return currentScenario().stays.length;}
function pickStay(id,legId=null){
 const owner=legId||currentLeg()?.id;
 if(owner!==state.selectedLegId||state.view!=='leg'){
  state.selectedLegId=owner;state.view='leg';state.selectedStayId=id;
  ui.calendarPositioned=true;renderAll();fitMap('leg');return;
 }
 state.selectedStayId=id;renderRibbon();renderCalendar();renderInspector();renderMobileEditStrip();renderMapPins();
}
function setLeg(id){if(draftBlocked())return;state.selectedLegId=id;state.view='leg';state.selectedStayId=currentScenario().stays[0]?.id||null;ui.calendarPositioned=false;renderAll();fitMap('leg');}
function viewScope(mode){if(draftBlocked())return;state.view=mode;ui.calendarPositioned=false;renderAll();fitMap(mode==='leg'?'leg':'journey');}
function loadSample(){if(draftBlocked())return;if(!confirm('Replace your locally saved prototype with the original six-leg example? You cannot undo this reset.'))return;state=seedState();ensureStayColors();undoStack.length=0;redoStack.length=0;ui.calendarPositioned=false;persist();renderAll();fitMap('leg');toast('Sample journey restored');}
function renderAll(){if(!ui.drag)removeDragGhost();renderTop();renderRibbon();renderToolbar();renderCalendar();renderIdeas();renderInspector();renderMobileEditStrip();renderMapAll();renderEditReview();renderUndoBtns();if(!$('versionsDrawer').classList.contains('hidden'))renderVersionsBody();}
function renderUndoBtns(){$('undoBtn').disabled=!undoStack.length;$('redoBtn').disabled=!redoStack.length;}
function renderTop(){
  if(!ui.editingTitle)$('journeyTitle').value=planTitle();
  const bounds=journeyBounds(),legs=effectiveLegs(),nights=legs.reduce((n,l)=>n+numNights(visibleStays(l)),0);
  $('journeyMeta').textContent=`${fmtDate(bounds.start)} – ${fmtDate(bounds.end,true)} · ${legs.length} legs · ${nights} planned nights`;
  $('journeySpanText').textContent=`${legs.length} legs · ${days(bounds.start,bounds.end)} calendar nights`;
  const dragging=!!ui.drag?.moved;
  $('saveLabel').textContent=dragging?'Previewing drag':ui.saveError?'Save failed':'Saved locally';
  $('saveIndicator').classList.toggle('pending',dragging);
  $('saveIndicator').title=dragging?'Release to save the new positions; unlocked collisions move automatically.':'Changes save immediately in this browser. Ctrl+Z undoes the last change.';
}
function renderRibbon(){
  $('journeyRibbon').classList.toggle('is-collapsed',!ui.ribbonExpanded);
  $('ribbonToggle').setAttribute('aria-expanded',String(ui.ribbonExpanded));
  $('ribbonToggle').innerHTML=`${svgIcon('chevron')}<span>${ui.ribbonExpanded?'Hide timeline':'Show timeline'}</span>`;
  $('ribbonEyebrow').textContent=ui.ribbonExpanded?'JOURNEY AT A GLANCE':state.view==='leg'?'DESTINATION LINKS':'LEG CONNECTIONS';
  const legs=[...effectiveLegs()].sort((a,b)=>legBounds(a).start.localeCompare(legBounds(b).start));
  const b=journeyBounds(),total=Math.max(1,days(b.start,b.end)),lanes=[],conf=legOverlaps(legs).flat();
  $('ribbonBars').style.height='48px';
  $('ribbonBars').innerHTML=legs.map(l=>{
    const range=legBounds(l),n=days(range.start,range.end),from=days(b.start,range.start);
    let lane=lanes.findIndex(e=>e<=range.start);
    if(lane<0){lane=lanes.length;lanes.push('0000-01-01');}
    lanes[lane]=range.end;
    const overlapping=conf.includes(l.id);
    return `<button class="ribbon-chunk ${state.selectedLegId===l.id&&state.view==='leg'?'selected':''} ${overlapping?'ribbon-conflict':''}" style="position:absolute;left:${100*from/total}%;width:${100*n/total}%;top:${Math.min(lane,1)*25}px;height:23px;background:${l.color}" data-leg="${esc(l.id)}" title="${esc(l.title)} · ${n} calendar nights${overlapping?' · overlaps another leg':''}"><span>${overlapping?'⚠ ':''}${esc(l.title)} · ${n}n</span></button>`;
  }).join('');
  $('ribbonLabels').innerHTML=`<span>${fmtDate(b.start,true)}</span><span>${fmtDate(b.end,true)}</span>`;
  if(state.view==='leg'){
    const route=ordered(visibleStays()),parentLocked=currentLeg().locked;
    $('legChain').innerHTML=route.length?route.map((stay,i)=>{
      const next=route[i+1],linked=!!next&&hasStayLink(stay.id,next.id);
      const nonAdjacent=linkedNeighbours(stay.id).some(id=>id!==route[i-1]?.id&&id!==next?.id);
      const selected=stay.id===state.selectedStayId;
      const chip=`<div class="chain-leg stay-chain-chip ${selected?'is-selected':''}" style="--chain-color:${stayColor(stay)}"><button class="chain-open" data-stay-open="${esc(stay.id)}" title="Select ${esc(stay.place.name)} · ${days(stay.start,stay.end)} nights">${esc(stay.place.name)}</button><button class="chain-lock ${stay.locked||parentLocked?'is-locked':''}" data-stay-lock="${esc(stay.id)}" aria-pressed="${!!stay.locked}" ${parentLocked?'disabled':''} title="${stay.locked?'Unlock':'Lock'} ${esc(stay.place.name)} dates">${svgIcon(stay.locked||parentLocked?'lock':'unlock')}</button>${selected?`<button class="chain-to-ideas" data-stay-to-ideas="${esc(stay.id)}" ${stay.locked||parentLocked?'disabled':''} title="Move ${esc(stay.place.name)} to unscheduled Ideas" aria-label="Move ${esc(stay.place.name)} to Ideas">${svgIcon('lightbulb')}</button>`:''}</div>`;
      const connector=next?`<button class="chain-link stay-link ${linked?'is-linked':''} ${nonAdjacent?'out-of-order':''}" data-stay-link-from="${esc(stay.id)}" data-stay-link-to="${esc(next.id)}" aria-pressed="${linked}" title="${linked?`Unlink ${stay.place.name} from ${next.place.name}`:`Link ${stay.place.name} to ${next.place.name}`} · ${nonAdjacent?'This stay also has a link to a non-adjacent destination; check the selection details.':linked?'These destinations deliberately stay together.':'Free: it moves only if another stay collides with it.'}">${svgIcon(linked?'link':'unlink')}<span>${linked?'Linked':'Free'}</span></button>`:'';
      return chip+connector;
    }).join(''):`<span class="chain-empty">No scheduled destinations yet. Add a stay or drag an idea onto the calendar.</span>`;
    if(currentScenario().stayLinks?.length){
      $('legChain').insertAdjacentHTML('beforeend',`<button type="button" class="chain-clear-links" data-unlink-all-stays="true" title="Remove all destination links in this leg. Dates and locks will not change; Undo restores the links.">Unlink all</button>`);
    }
    return;
  }
  // Journey mode retains separate directional connections between entire legs.
  const route=currentJourney().legs;
  $('legChain').innerHTML=route.map((l,i)=>{
    const next=route[i+1],linked=l.linkNextId===next?.id;
    const chip=`<div class="chain-leg" style="--chain-color:${l.color}"><button class="chain-open" data-leg-open="${esc(l.id)}" title="Open ${esc(l.title)}">${esc(l.title)}</button><button class="chain-lock ${l.locked?'is-locked':''}" data-leg-lock="${esc(l.id)}" aria-pressed="${!!l.locked}" title="${l.locked?'Unlock':'Lock'} ${esc(l.title)} dates">${svgIcon(l.locked?'lock':'unlock')}</button></div>`;
    const connection=next?`<button class="chain-link ${linked?'is-linked':''}" data-link-from="${esc(l.id)}" data-link-to="${esc(next.id)}" aria-pressed="${linked}" title="${linked?`Unlink ${l.title} from ${next.title}`:`Link ${l.title} to ${next.title}`} — moving ${l.title} ${linked?'also moves':'does not move'} ${next.title}">${svgIcon(linked?'link':'unlink')}<span>${linked?'Linked':'Free'}</span></button>`:'';
    return chip+connection;
  }).join('');
}
function toggleLegLink(fromId,toId){
  const route=currentJourney().legs,from=route.find(x=>x.id===fromId);
  if(!from||!route.some(x=>x.id===toId)||fromId===toId)return;
  const wasLinked=from.linkNextId===toId;
  commit(wasLinked?'Unlinked legs':'Linked legs',()=>{from.linkNextId=wasLinked?null:toId;});
}
// Links are attached to pairs of actual stays. Either side can be toggled,
// and a link survives reordering rather than transferring to a new neighbour.
function hasStayLink(a,b,sc=currentScenario()){
  return !!a&&!!b&&(sc.stayLinks||[]).some(e=>(e.a===a&&e.b===b)||(e.a===b&&e.b===a));
}
function linkedNeighbours(id,sc=currentScenario()){
  return (sc.stayLinks||[]).flatMap(e=>e.a===id?[e.b]:e.b===id?[e.a]:[]);
}
function linkedComponent(id,sc=currentScenario(),allowed=null){
  const seen=new Set(),stack=[id];
  while(stack.length){
    const item=stack.pop();if(seen.has(item)||allowed&&!allowed.has(item))continue;
    seen.add(item);
    for(const other of linkedNeighbours(item,sc))if(!seen.has(other))stack.push(other);
  }
  return seen;
}
function toggleStayLink(fromId,toId){
  const sc=currentScenario(),stays=sc.stays;
  const from=stays.find(s=>s.id===fromId),to=stays.find(s=>s.id===toId);
  if(!from||!to||from.id===to.id)return;
  const wasLinked=hasStayLink(fromId,toId,sc);
  if(!wasLinked){
    const route=ordered(stays),a=route.findIndex(s=>s.id===fromId),b=route.findIndex(s=>s.id===toId);
    if(Math.abs(a-b)!==1){toast('New links can only be added between neighbouring destinations');return;}
    if(linkedComponent(fromId,sc).has(toId)){toast('Those destinations are already joined by links; another link would create a loop');return;}
  }
  commit(wasLinked?`Unlinked ${from.place.name} and ${to.place.name}`:`Linked ${from.place.name} with ${to.place.name}`,()=>{
    if(wasLinked)sc.stayLinks=sc.stayLinks.filter(e=>!((e.a===fromId&&e.b===toId)||(e.a===toId&&e.b===fromId)));
    else sc.stayLinks.push({a:fromId,b:toId});
  });
}

function renderToolbar(){
  $('overviewModeBtn').classList.toggle('active',state.view==='overview');$('journeyModeBtn').classList.toggle('active',state.view==='journey');$('legModeBtn').classList.toggle('active',state.view==='leg');
  const j=currentJourney();
  $('legSelect').innerHTML=j.legs.map(l=>`<option value="${esc(l.id)}" ${l.id===currentLeg().id?'selected':''}>${esc(l.title)}</option>`).join('');
  $('legSelect').disabled=state.view==='overview';
  $('legVersionSelect').innerHTML=currentLeg().scenarios.map(sc=>`<option value="${esc(sc.id)}" ${sc.id===currentLeg().activeScenarioId?'selected':''}>${esc(sc.name)}</option>`).join('');
  $('legVersionSelect').disabled=state.view!=='leg';$('duplicateLegBtn').disabled=state.view!=='leg';
  const conflicts=legOverlaps(effectiveLegs()),warn=conflicts.length?` ⚠ ${conflicts.length} overlapping leg pair(s).`:'';
  $('calendarHelp').textContent=state.view==='overview'?'Move whole leg blocks; padlocks protect fixed dates.':state.view==='journey'?'All destinations across the journey; click a stay to focus its leg.':'Drag active-color stays; click gray destinations to open their legs.';
  $('mapContext').textContent=state.view==='leg'?currentLeg().title:'Entire journey';
}
function calendarWeeks(){
  const bounds=journeyBounds();
  const bStart=bounds.start||'2027-02-01',bEnd=add(bounds.end||'2027-03-01',-1);
  const start=new Date(Date.UTC(+bStart.slice(0,4),+bStart.slice(5,7)-1-ui.calendarPadBefore,1));
  const end=new Date(Date.UTC(+bEnd.slice(0,4),+bEnd.slice(5,7)-1+ui.calendarPadAfter+1,1));
  const from=isoAt(Date.UTC(start.getUTCFullYear(),start.getUTCMonth(),start.getUTCDate())/MS);
  const to=isoAt(end.getTime()/MS);
  const day=(new Date(epoch(from)*MS).getUTCDay()+6)%7;
  const weeks=[];for(let dt=add(from,-day);dt<to;dt=add(dt,7)){
    weeks.push(dt);if(weeks.length>190)break;
  }
  return weeks;
}
function intervalsForView(){
 if(state.view==='overview'){
  const conflicted=new Set(legOverlaps(effectiveLegs()).flat());
  return effectiveLegs().map(l=>{const b=legBounds(l);return {id:l.id,legId:l.id,kind:'leg',label:l.title,sub:`${days(b.start,b.end)}n`,start:b.start,end:b.end,color:l.color,status:'placed',locked:!!l.locked,conflict:conflicted.has(l.id)};});
 }
 const result=[];
 for(const leg of effectiveLegs()){
  const stays=ordered(visibleStays(leg).filter(st=>st.start&&st.end));
  const conflicted=new Set(overlapPairs(stays).flat());
  const muted=state.view==='leg'&&leg.id!==currentLeg().id;
  if(!stays.length){
   const b=legBounds(leg);
   if(b.start&&b.end&&b.start<b.end)result.push({id:leg.id,legId:leg.id,kind:'leg-placeholder',label:leg.title,sub:'No destinations yet',start:b.start,end:b.end,color:leg.color,status:'tentative',locked:leg.locked,muted,conflict:false});
  }
  stays.forEach((st,i)=>result.push({id:st.id,legId:leg.id,kind:'stay',label:st.place.name,sub:`${days(st.start,st.end)}n`,start:st.start,end:st.end,color:stayColor(st),legColor:leg.color,status:st.status,locked:!!st.locked||!!leg.locked,muted,conflict:conflicted.has(st.id),prevStayId:stays[i-1]?.id||null,prevStayName:stays[i-1]?.place.name||null,nextStayId:stays[i+1]?.id||null,nextStayName:stays[i+1]?.place.name||null,linkBefore:hasStayLink(st.id,stays[i-1]?.id,currentScenario(leg)),linkAfter:hasStayLink(st.id,stays[i+1]?.id,currentScenario(leg))}));
 }
 return result;
}
function getTransferDates(){if(state.view!=='leg')return new Set();const s=ordered(visibleStays());return new Set(s.slice(1).map(st=>st.start));}
function segmentsForWeek(intervals,ws){
  const weekEnd=add(ws,7),found=[];
  for(const it of intervals){const s=maxDate(it.start,ws),e=minDate(it.end,weekEnd);
    if(s&&e&&s<e)found.push({...it,segStart:s,segEnd:e,col:days(ws,s)+1,span:days(s,e),isStart:s===it.start,isEnd:e===it.end});
  }
  found.sort((a,b)=>a.col-b.col || b.span-a.span);const lanes=[];
  for(const seg of found){let lane=lanes.findIndex(end=>end<=seg.col);if(lane<0){lane=lanes.length;lanes.push(0);}seg.lane=lane;lanes[lane]=seg.col+seg.span;}
  return {found,lanes:lanes.length};
}
function renderCalendar(){
  const scroll=$('calendarScroll'),keepTop=scroll.scrollTop;
  // Preserve the *visible date* if the calendar range grows/shrinks after a
  // commit; preserving only scrollTop makes the viewport jump a full month.
  let anchorWeek=null,anchorOffset=0;
  if(ui.calendarPositioned){
    const sr=scroll.getBoundingClientRect(),headerHeight=$('calendarRoot').querySelector('.continuous-header')?.getBoundingClientRect().height||64;
    const row=[...$('calendarRoot').querySelectorAll('.week-row')].find(el=>el.getBoundingClientRect().bottom>sr.top+headerHeight+6);
    if(row){anchorWeek=row.dataset.weekStart;anchorOffset=row.getBoundingClientRect().top-sr.top;}
  }
  const weeks=calendarWeeks(),intervals=intervalsForView();
  let html='<div class="continuous-header"><div class="continuous-heading"><span class="eyebrow">CONTINUOUS CALENDAR</span><strong id="streamMonthTitle"></strong><span class="stream-hint">Drag bars to move/resize · empty dates to add</span></div><div class="weekday-header">'+WEEK.map((day,i)=>`<span class="${i>4?'weekend':''}">${day}</span>`).join('')+'</div></div><div class="calendar-stream">';
  const transfers=getTransferDates();
  for(const ws of weeks){
    // Every week has the same geometry regardless of changed stay overlaps.
    // A drop can never push all later weeks downward by inserting a new lane.
    // A stable, compact week height: never change geometry during a gesture.
    html+=`<div class="week-row" data-week-start="${ws}">`;
    for(let i=0;i<7;i++){
      const dt=add(ws,i),dateNum=+dt.slice(-2),newMonth=dateNum===1,transfer=transfers.has(dt);
      const selected=state.view==='leg'&&visibleStay()?.start===dt;
      html+=`<div class="day-cell ${i>=5?'weekend':''} ${newMonth?'month-start':''} ${transfer?'transfer-day':''} ${selected?'selected-day':''}" data-date="${dt}" title="${fmtDate(dt,true)}"><span class="day-date-label"><span class="today-number">${dateNum}</span>${newMonth?`<span class="month-start-label">${MONTHS[+dt.slice(5,7)-1].slice(0,3).toUpperCase()}</span>`:''}</span></div>`;
    }
    html+='</div>';
  }
  $('calendarRoot').innerHTML=html+'</div>';
  renderCalendarBars();
  if(!ui.calendarPositioned){
    const b=state.view==='leg'?legBounds(currentLeg()):journeyBounds(),dt=b.start;
    const focus=[...$('calendarRoot').querySelectorAll('.week-row')].find(el=>el.dataset.weekStart<=dt && add(el.dataset.weekStart,7)>dt);
    scroll.scrollTop=focus?Math.max(0,focus.offsetTop-$('calendarRoot').offsetTop-85):keepTop;
    ui.calendarPositioned=true;
  }else{
    scroll.scrollTop=keepTop;
    if(anchorWeek){
      const newRow=$('calendarRoot').querySelector(`.week-row[data-week-start="${anchorWeek}"]`);
      if(newRow)scroll.scrollTop+=newRow.getBoundingClientRect().top-scroll.getBoundingClientRect().top-anchorOffset;
    }
  }
  updateStickyMonth();
}
function renderCalendarBars(){
  const intervals=intervalsForView(),ghost=ui.drag?.kind==='create'&&ui.drag.range||ui.pendingRange;
  const active=ghost?.start&&ghost?.end?[...intervals,{id:'new-stay-ghost',kind:'ghost',label:'New destination',sub:`${days(ghost.start,ghost.end)}n`,start:ghost.start,end:ghost.end,color:'#67a5bc',status:'tentative',locked:false,conflict:false}]:intervals;
  for(const row of $('calendarRoot').querySelectorAll('.week-row')){
    // Do NOT replace week rows, cells, or the scroll container during a drag.
    row.querySelectorAll('.calendar-bar,.range-ghost').forEach(el=>el.remove());
    const {found}=segmentsForWeek(active,row.dataset.weekStart);
    const fragments=[];
    for(const it of found){
      const left=(it.col-1)*100/7,width=it.span*100/7;
      if(it.kind==='ghost'){
        fragments.push(`<div class="range-ghost ${it.isStart?'start':''} ${it.isEnd?'end':''}" style="left:calc(${left}% + 1px);width:calc(${width}% - 2px);top:calc(var(--stay-top) + ${it.lane*25}px)">${it.isStart?`New stay · ${days(it.start,it.end)} nights`:''}</div>`);continue;
      }
      const selected=(it.kind==='stay'&&state.selectedStayId===it.id&&state.selectedLegId===it.legId)||(it.kind!=='stay'&&state.selectedLegId===it.id);
      // A stay beginning on Sunday has a ONE-DAY first segment. That must
      // still expose its left link; the same holds for a Saturday-ending stay.
      const activeStay=it.kind==='stay'&&!it.muted&&state.view==='leg';
      const linkableAfter=activeStay&&it.isEnd&&!!it.nextStayId;
      const linkableBefore=activeStay&&it.isStart&&!!it.prevStayId;
      const prev=!!workingPreview()?.changedIds?.includes(it.id),originDrag=ui.drag?.moved&&ui.drag?.id===it.id;
      const startsSunday=new Date(epoch(it.start)*MS).getUTCDay()===0;
      // A Sunday first fragment may have no label; the following week's
      // continuation carries the clean full place name instead.
      const label=it.kind==='leg-placeholder'?`${it.label} · add a destination`:it.isStart||startsSunday?it.label:(it.span>=3?`${it.label} · continued`:it.label);
      const sizeSmall=it.span<2;
      fragments.push(`<div class="calendar-bar ${it.isStart?'start':''} ${it.isEnd?'end':''} ${it.span===1?'short-segment':''} ${it.muted?'inactive-leg':''} ${it.kind==='leg-placeholder'?'empty-leg':''} ${selected?'selected':''} ${it.status==='tentative'?'tentative':''} ${it.locked?'locked':''} ${prev?'preview':''} ${originDrag?'drag-origin':''} ${it.conflict?'conflict':''} lane${it.lane}" style="left:calc(${left}% + 2px);width:calc(${width}% - 4px);top:calc(var(--stay-top) + ${it.lane*25}px);background:${it.color};--leg-accent:${it.legColor||it.color}" data-object-id="${esc(it.id)}" data-kind="${it.kind}" data-leg-id="${esc(it.legId||it.id)}" ${it.conflict?'data-conflict="true"':''} role="button" tabindex="0" aria-label="${esc(it.label)}, ${esc(fmtDate(it.start))} to ${esc(fmtDate(it.end))}, ${esc(it.sub)}${it.conflict?', overlaps another item':''}" title="${esc(it.label)} · ${fmtDate(it.start)}–${fmtDate(it.end)} · ${it.sub}${it.locked?' · locked':''}${it.conflict?' · ⚠ OVERLAP':''}">
        ${it.isStart&&activeStay?'<span class="bar-handle left" data-handle="left" title="Resize arrival date"></span>':''}
        <span class="bar-label">${it.conflict?'⚠ ':''}${sizeSmall&&!it.isEnd?'':esc(label)}${sizeSmall?'':` <span class="bar-subtitle">${esc(it.sub)}</span>`}</span>
        ${linkableBefore?`<button type="button" class="bar-link-toggle before ${it.linkBefore?'is-linked':''}" data-stay-link-from="${esc(it.prevStayId)}" data-stay-link-to="${esc(it.id)}" title="${it.linkBefore?'Unlink':'Link'} before: ${esc(it.prevStayName)} ↔ ${esc(it.label)}" aria-label="${it.linkBefore?'Unlink':'Link'} before ${esc(it.label)}: ${esc(it.prevStayName)}" aria-pressed="${it.linkBefore}">${svgIcon(it.linkBefore?'link':'unlink')}</button>`:''}
        ${linkableAfter?`<button type="button" class="bar-link-toggle after ${it.linkAfter?'is-linked':''}" data-stay-link-from="${esc(it.id)}" data-stay-link-to="${esc(it.nextStayId)}" title="${it.linkAfter?'Unlink':'Link'} after: ${esc(it.label)} ↔ ${esc(it.nextStayName)}" aria-label="${it.linkAfter?'Unlink':'Link'} after ${esc(it.label)}: ${esc(it.nextStayName)}" aria-pressed="${it.linkAfter}">${svgIcon(it.linkAfter?'link':'unlink')}</button>`:''}
        ${activeStay||it.kind==='leg'?`<button type="button" class="bar-lock-toggle ${it.locked?'is-locked':''}" data-lock-toggle="true" title="${it.locked?'Unlock':'Lock'} ${esc(it.label)} dates" aria-label="${it.locked?'Unlock':'Lock'} ${esc(it.label)} dates" aria-pressed="${it.locked}">${svgIcon(it.locked?'lock':'unlock')}</button>`:''}
        ${it.isEnd&&activeStay?'<span class="bar-handle right" data-handle="right" title="Resize departure date"></span>':''}
      </div>`);
    }
    row.insertAdjacentHTML('beforeend',fragments.join(''));
  }
}
function updateStickyMonth(){
  const sc=$('calendarScroll'),r=sc.getBoundingClientRect();
  const header=$('calendarRoot').querySelector('.continuous-header');
  const threshold=r.top+(header?.getBoundingClientRect().height||65)+35;
  let current=null;
  const rows=[...$('calendarRoot').querySelectorAll('.week-row')];
  // Prefer the week that actually begins below the sticky header, not a
  // mostly-hidden row from the previous month.
  const nextRow=rows.find(row=>row.getBoundingClientRect().top>=threshold-36);
  const firstVisible=rows.find(row=>row.getBoundingClientRect().bottom>threshold);
  const row=nextRow||firstVisible;
  if(row)current=row.dataset.weekStart;
  if(!current)return;
  const mid=add(current,3);
  const name=monthName(mid)+' '+mid.slice(0,4);
  const label=$('streamMonthTitle');if(label)label.textContent=name;
}

function renderIdeas(){const sc=currentScenario();$('ideasCount').textContent=sc.ideas.length;$('ideasCards').innerHTML=sc.ideas.length?sc.ideas.map(i=>`<button class="idea-pill" data-idea-id="${esc(i.id)}" title="Drag this onto a calendar date, or click to add at end">${svgIcon('pin')}${esc(i.place.name)} ${i.nightsTarget?`<span class="idea-nights">${i.nightsTarget}n</span>`:''} ${svgIcon('menu')}</button>`).join(''):`<span class="ideas-empty">No unscheduled ideas yet — save one from search or the map.</span>`;}
function renderMobileEditStrip(){
  const root=$('mobileEditStrip');if(!root)return;
  if(state.view!=='leg'){
    root.innerHTML='<span class="mobile-stay-name">Drag a leg to shift later legs; tap its lock to anchor dates.</span><button type="button" data-mobile-undo="true" '+(!undoStack.length?'disabled':'')+'>Undo</button>';
    return;
  }
  const s=visibleStay();
  if(!s){root.innerHTML='<span class="mobile-stay-name">Tap a stay to edit its nights</span><button type="button" data-mobile-undo="true" '+(!undoStack.length?'disabled':'')+'>Undo</button>';return;}
  const n=days(s.start,s.end),locked=!!s.locked||!!currentLeg().locked;
  const route=ordered(visibleStays()),ix=route.findIndex(it=>it.id===s.id),before=route[ix-1],after=route[ix+1];
  root.innerHTML=`<div class="mobile-stay-name"><strong>${esc(s.place.name)}</strong><span>${n} night${n===1?'':'s'} · ${locked?'Locked':'Flexible · collision ripple'}</span></div>${before?`<button type="button" data-mobile-link-peer="${esc(before.id)}" aria-pressed="${hasStayLink(s.id,before.id)}" title="Link before: ${esc(before.place.name)}">${svgIcon(hasStayLink(s.id,before.id)?'link':'unlink')} Before</button>`:''}${after?`<button type="button" data-mobile-link-peer="${esc(after.id)}" aria-pressed="${hasStayLink(s.id,after.id)}" title="Link after: ${esc(after.place.name)}">${svgIcon(hasStayLink(s.id,after.id)?'link':'unlink')} After</button>`:''}<button type="button" data-mobile-lock="true" title="${locked?'Unlock':'Lock'} selected stay dates" aria-label="${locked?'Unlock':'Lock'} selected stay dates" ${currentLeg().locked?'disabled title="Unlock the leg first"':''}>${svgIcon(locked?'lock':'unlock')}</button><button type="button" data-mobile-step="-1" ${n===1||locked?'disabled':''} aria-label="Shorten selected stay by one night">−1</button><button type="button" data-mobile-step="1" ${locked?'disabled':''} aria-label="Extend selected stay by one night">+1</button><button type="button" data-mobile-ideas="true" ${locked?'disabled':''} title="Move selected stay to unscheduled Ideas">To Ideas</button><button type="button" data-mobile-undo="true" ${undoStack.length?'':'disabled'}>Undo</button>`;
}
function renderInspector(){
  let html='',leg=currentLeg(),sc=currentScenario(),sel=visibleStay();
  if(state.view!=='leg'){
    const b=journeyBounds(),legConflict=legOverlaps(effectiveLegs()).length;
    html=`<div class="details-heading">Entire journey</div><div class="details-location">${svgIcon('calendar')} ${fmtDate(b.start,true)} – ${fmtDate(b.end,true)}</div><div class="details-dates"><div class="info-block"><div class="info-label">TRIP LEGS</div><div class="info-value">${effectiveLegs().length}</div></div><div class="info-block"><div class="info-label">PLANNED NIGHTS</div><div class="info-value">${effectiveLegs().reduce((n,l)=>n+numNights(currentScenario(l).stays),0)}</div></div></div>${legConflict?`<div class="conflict-notice">⚠ ${legConflict} overlapping leg pair(s). Open the affected legs to inspect their dates.</div>`:''}<div class="details-hint">${state.view==='overview'?'Drag a leg block to move that leg, or click it to open its stays.':'Click any destination in the calendar to open its leg. All stays remain visible across the journey.'}</div><div class="details-actions"><button class="button button-outline" id="inspectorFocusLeg">${svgIcon('zoom')} Open ${esc(leg.title)}</button></div>`;
  }else if(!sel){
    const b=legBounds(leg);
    html=`<div class="details-heading">${esc(leg.title)}</div><div class="details-location">${svgIcon('calendar')} ${fmtDate(b.start)} – ${fmtDate(b.end,true)}</div><div class="details-dates"><div class="info-block"><div class="info-label">STAYS</div><div class="info-value">${visibleStays().length}</div></div><div class="info-block"><div class="info-label">PLANNED NIGHTS</div><div class="info-value">${numNights(visibleStays())}</div></div></div><p class="details-hint">Select a stay on the calendar or map, or add a place and drag it into position.</p><div class="details-actions"><button class="button button-primary" id="inspectorSearch">${svgIcon('plus')} Add a destination</button><button class="button button-outline" id="inspectorRenameLeg">Rename leg</button><button class="button button-outline button-danger" id="inspectorDeleteLeg" ${currentJourney().legs.length<=1?'disabled':''}>Delete leg</button></div>`;
  }else{
    const arr=ordered(visibleStays()),n=days(sel.start,sel.end),pos=arr.findIndex(s=>s.id===sel.id),prev=arr[pos-1],next=arr[pos+1],currentMode=sc.connections?.[sel.id]?.mode||'unspecified';
    const linked=hasStayLink(sel.id,next?.id),linkedBefore=hasStayLink(sel.id,prev?.id);
    const remoteLinks=linkedNeighbours(sel.id).filter(id=>id!==prev?.id&&id!==next?.id).map(id=>arr.find(s=>s.id===id)).filter(Boolean);
    const conflict=overlapPairs(visibleStays()).some(pair=>pair.includes(sel.id));
    const pending=false,locked=!!sel.locked||!!leg.locked;
    html=`<div class="details-heading"><span style="width:10px;height:10px;border-radius:50%;background:${stayColor(sel)};flex-shrink:0"></span>${esc(sel.place.name)}</div><div class="details-location">${svgIcon('pin')} ${esc(sel.place.country||'Custom map location')} · ${esc(leg.title)}</div>${leg.locked?'<div class="lock-notice">This entire leg is locked. Unlock it on the Journey calendar to change dates.</div>':''}${conflict?'<div class="conflict-notice">⚠ This stay overlaps another stay.</div>':''}<div class="details-dates"><div class="info-block"><div class="info-label">ARRIVE</div><div class="info-value">${fmtDate(sel.start)}</div></div><div class="info-block"><div class="info-label">DEPART</div><div class="info-value">${fmtDate(sel.end)}</div></div><div class="info-block"><div class="info-label">NIGHTS</div><div class="info-value">${n}</div></div></div><div class="details-status"><span class="status-icon"></span>${locked?'Locked against automatic changes':sel.status==='tentative'?'Tentative placement':'Placed, not necessarily booked'}</div><div class="details-actions"><button class="button button-outline" id="shortenStay" ${n<=1||locked?'disabled':''}>${svgIcon('minus')} 1 night</button><button class="button button-outline" id="lengthenStay" ${locked?'disabled':''}>${svgIcon('plus')} 1 night</button><button class="button button-outline" id="toggleLock" ${leg.locked?'disabled title="Unlock the whole leg first"':''}>${svgIcon(sel.locked?'unlock':'lock')} ${sel.locked?'Unlock':'Lock'} dates</button><button class="button button-outline" id="toggleTentative" ${pending?'disabled':''}>${sel.status==='tentative'?'Mark placed':'Mark tentative'}</button><button class="button button-outline" id="moveStayToIdeas" ${locked?'disabled title="Unlock dates before unscheduling"':''}>${svgIcon('lightbulb')} To Ideas</button></div>${prev?`<div class="stay-connection-row"><span>${svgIcon(linkedBefore?'link':'unlink')} Before: ${esc(prev.place.name)}</span><button class="button button-outline" data-inspector-link="${esc(prev.id)}" data-stay="${esc(sel.id)}">${svgIcon(linkedBefore?'unlink':'link')} ${linkedBefore?'Unlink':'Link'}</button></div>`:''}${next?`<div class="stay-connection-row"><span>${svgIcon(linked?'link':'unlink')} After: ${esc(next.place.name)}</span><button class="button button-outline" data-inspector-link="${esc(next.id)}" data-stay="${esc(sel.id)}">${svgIcon(linked?'unlink':'link')} ${linked?'Unlink':'Link'}</button></div>`:''}${remoteLinks.map(peer=>`<div class="stay-connection-row"><span>${svgIcon('link')} Linked to ${esc(peer.place.name)} (moved in route)</span><button class="button button-outline" data-inspector-link="${esc(peer.id)}" data-stay="${esc(sel.id)}">${svgIcon('unlink')} Unlink</button></div>`).join('')}<div class="details-subhead">Other quick edits</div><div class="details-editrow"><label for="inspectorDate">Arrival date</label><input id="inspectorDate" type="date" value="${sel.start}" aria-label="Change arrival date" /></div><div class="details-editrow"><label for="inspectorNights">Length of stay</label><select id="inspectorNights" aria-label="Length of stay">${Array.from({length:Math.max(35,n)},(_,i)=>`<option value="${i+1}" ${i+1===n?'selected':''}>${i+1} night${i?'s':''}</option>`).join('')}</select></div>${next?`<div class="details-editrow"><label for="travelMode">Travel to ${esc(next.place.name)}</label><select id="travelMode" ${pending?'disabled':''}><option value="unspecified" ${currentMode==='unspecified'?'selected':''}>Not decided</option>${['flight','train','bus','car','ferry','cruise','walk','other'].map(m=>`<option value="${m}" ${currentMode===m?'selected':''}>${m.charAt(0).toUpperCase()+m.slice(1)}</option>`).join('')}</select></div>`:''}<div class="details-actions"><button class="button button-outline button-danger" id="deleteStay" ${pending?'disabled':''}>${svgIcon('trash')} Delete</button><button class="button button-outline" id="fitSelectedFromInspector">${svgIcon('zoom')} Show on map</button></div><div class="details-hint">Edits save on release. Unlocked stays shift only to make room; left/right links deliberately move destinations together. Locked dates stay fixed. Undo reverses the entire gesture.</div>`;
  }
  $('detailsRoot').innerHTML=`<div class="details-root">${html}</div>`;
}
// === Actual zoomable geographic map ===
const mapState={cx:0.59,cy:0.48,zoom:3.15,layer:'atlas',scope:'leg',panning:null,initialized:false};
const mercX = lon => (Number(lon)+180)/360;
const mercY = lat => {const r=Math.PI/180*clamp(Number(lat),-85,85);return .5-Math.log(Math.tan(Math.PI/4+r/2))/(2*Math.PI);};
const lonFromX = x => ((x%1+1)%1)*360-180;
const latFromY = y => Math.atan(Math.sinh(Math.PI*(1-2*y)))*180/Math.PI;
const unitSize = () => 256*Math.pow(2,mapState.zoom);
const mapDim = () => ({w:$('mapViewport').clientWidth||450,h:$('mapViewport').clientHeight||400});
const pxFor = (lon,lat) => {const {w,h}=mapDim(),size=unitSize();let x=mercX(lon);x-=Math.round(x-mapState.cx);return {x:w/2+(x-mapState.cx)*size,y:h/2+(mercY(lat)-mapState.cy)*size};};
const geoFor = (screenX,screenY) => {const {w,h}=mapDim(),size=unitSize(),x=mapState.cx+(screenX-w/2)/size,y=mapState.cy+(screenY-h/2)/size;return {lon:lonFromX(x),lat:clamp(latFromY(y),-85,85)};};
function worldSvgInit(){const root=$('mapWorld');const shapes=(window.TRAVEL_CANVAS_WORLD||[]).map(p=>`<path class="land" d="${p.map((q,i)=>`${i?'L':'M'}${q[0]},${q[1]}`).join('')}Z"/>`).join('');root.innerHTML=[-1,0,1].map(offset=>`<g transform="translate(${offset},0)">${shapes}</g>`).join('');mapState.initialized=true;}
function getMapStops(){
  if(mapState.scope==='journey')return effectiveLegs().map((leg,i)=>{
    const ss=ordered(visibleStays(leg)).filter(s=>s.place&&Number.isFinite(s.place.lon));if(!ss.length)return null;
    return {id:leg.id,legId:leg.id,place:ss[0].place,name:leg.title,color:leg.color,index:i+1,kind:'leg'};
  }).filter(Boolean);
  return ordered(visibleStays()).filter(s=>s.place&&Number.isFinite(s.place.lon)).map((s,i)=>({id:s.id,legId:currentLeg().id,place:s.place,name:s.place.name,color:stayColor(s),index:i+1,kind:'stay'}));
}
function fullRouteStays(){
  if(mapState.scope==='journey')return effectiveLegs().map(l=>ordered(visibleStays(l)).filter(s=>s.place?.lat!=null)).filter(x=>x.length);
  return [ordered(visibleStays()).filter(s=>s.place?.lat!=null)];
}
function renderMapRoutes(){
  const routes=[],segments=fullRouteStays();
  const line=(a,b,color,dashed,extraClass='')=>{
    let x1=mercX(a.lon),x2=mercX(b.lon);if(x2-x1>.5)x2--;if(x2-x1<-.5)x2++;
    const y1=mercY(a.lat),y2=mercY(b.lat);
    for(const k of [-1,0,1])routes.push(`<path class="route-line ${mapState.scope==='journey'?'journey':''} ${extraClass}" d="M${x1+k},${y1}L${x2+k},${y2}" stroke="${color}" ${dashed?'stroke-dasharray="7 7"':''}/>`);
  };
  for(let ix=0;ix<segments.length;ix++){
    const arr=segments[ix],leg=mapState.scope==='journey'?effectiveLegs()[ix]:currentLeg();
    for(let j=0;j<arr.length-1;j++)line(arr[j].place,arr[j+1].place,mapState.scope==='journey'?leg.color:'#557b9b',false);
    if(mapState.scope==='journey'&&ix<segments.length-1){const next=segments[ix+1];if(arr.length&&next?.length)line(arr.at(-1).place,next[0].place,'#879cad',true);}
  }
  $('mapRoutes').innerHTML=routes.join('');
}
function renderMapPins(){
  const pins=getMapStops(),root=$('mapPins');
  root.innerHTML=pins.map(p=>{
    const sel=(p.kind==='leg'?state.selectedLegId:state.selectedStayId)===p.id;
    return `<button class="map-pin ${sel?'selected':''}" style="--pin:${p.color}" data-pin-id="${esc(p.id)}" data-kind="${p.kind}" title="${esc(p.name)}"><span class="map-pin-dot">${p.index}</span><span class="map-pin-label">${esc(p.name)}</span></button>`;
  }).join('');projectPins();
}
function projectPins(){const pins=getMapStops(),els=$('mapPins').querySelectorAll('.map-pin');els.forEach((el,i)=>{const p=pins[i];if(!p)return;const {x,y}=pxFor(p.place.lon,p.place.lat);el.style.left=`${x}px`;el.style.top=`${y}px`;el.style.display=x< -70||x>mapDim().w+70||y< -70||y>mapDim().h+70?'none':'';});}
function renderTiles(){const root=$('mapTiles');if(mapState.layer!=='street'||!location.protocol.startsWith('http')){root.replaceChildren();return;}const {w,h}=mapDim(),world=unitSize(),z=Math.floor(mapState.zoom),n=Math.pow(2,z),tileSize=world/n;const x0=mapState.cx-w/(2*world),x1=mapState.cx+w/(2*world),y0=mapState.cy-h/(2*world),y1=mapState.cy+h/(2*world);
 const a=Math.floor(x0*n),b=Math.floor(x1*n),c=clamp(Math.floor(y0*n),0,n-1),d=clamp(Math.floor(y1*n),0,n-1);const needed=new Map();for(let tx=a;tx<=b;tx++)for(let ty=c;ty<=d;ty++){const xx=((tx%n)+n)%n,key=`${z}/${xx}/${ty}`;needed.set(key,{tx,ty,xx,z});if(needed.size>56)break;}
 for(const img of [...root.querySelectorAll('img')])if(!needed.has(img.dataset.key))img.remove();for(const [key,item]of needed){let img=[...root.querySelectorAll('img')].find(x=>x.dataset.key===key);if(!img){img=document.createElement('img');img.dataset.key=key;img.alt='';img.draggable=false;img.decoding='async';img.src=`https://tile.openstreetmap.org/${item.z}/${item.xx}/${item.ty}.png`;root.appendChild(img);}img.style.left=`${w/2+((item.tx/n)-mapState.cx)*world}px`;img.style.top=`${h/2+((item.ty/n)-mapState.cy)*world}px`;img.style.width=`${tileSize+.3}px`;img.style.height=`${tileSize+.3}px`;}}
function projectMap(){if(!mapState.initialized)return;const {w,h}=mapDim(),world=unitSize();$('mapSvg').setAttribute('viewBox',`0 0 ${w} ${h}`);const transform=`translate(${w/2} ${h/2}) scale(${world}) translate(${-mapState.cx} ${-mapState.cy})`;$('mapWorld').setAttribute('transform',transform);$('mapRoutes').setAttribute('transform',transform);projectPins();renderTiles();}
function renderMapAll(){if(!mapState.initialized)worldSvgInit();renderMapRoutes();renderMapPins();projectMap();$('mapContext').textContent=mapState.scope==='journey'?'All legs':currentLeg().title;$('mapSvg').classList.toggle('street',mapState.layer==='street');$('vectorMapBtn').classList.toggle('active',mapState.layer==='atlas');$('streetMapBtn').classList.toggle('active',mapState.layer==='street');$('mapAttribution').innerHTML=mapState.layer==='street'?`© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>`:`Land shapes: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a> (public domain)`;}
function setMapLayer(layer){if(layer==='street'&&!location.protocol.startsWith('http')){toast('Street tiles need an HTTP address. Use the local launcher in the ZIP.');return;}mapState.layer=layer;renderMapAll();}
function changeZoom(delta,anchor){const {w,h}=mapDim(),p=anchor||{x:w/2,y:h/2};const a=geoFor(p.x,p.y);mapState.zoom=clamp(mapState.zoom+delta,1,14);const size=unitSize();let x=mercX(a.lon);x+=Math.round(mapState.cx-x);mapState.cx=x-(p.x-w/2)/size;mapState.cy=clamp(mercY(a.lat)-(p.y-h/2)/size,.02,.98);projectMap();}
function fitPlaces(places,zoomMax){if(!places.length)return;const {w,h}=mapDim();const pts=places.map(p=>({x:mercX(p.lon),y:mercY(p.lat)}));if(pts.length===1){mapState.cx=pts[0].x;mapState.cy=pts[0].y;mapState.zoom=zoomMax??8;projectMap();return;}
 const xs=pts.map(p=>p.x).sort((a,b)=>a-b);let maxGap=-1,arcStart=xs[0];for(let i=0;i<xs.length;i++){const next=i===xs.length-1?xs[0]+1:xs[i+1];let gap=next-xs[i];if(gap>maxGap){maxGap=gap;arcStart=next%1;}}
 const unwrapped=pts.map(p=>({x:p.x<arcStart?p.x+1:p.x,y:p.y}));const minX=Math.min(...unwrapped.map(p=>p.x)),maxX=Math.max(...unwrapped.map(p=>p.x)),minY=Math.min(...unwrapped.map(p=>p.y)),maxY=Math.max(...unwrapped.map(p=>p.y));mapState.cx=(minX+maxX)/2;mapState.cy=clamp((minY+maxY)/2,.02,.98);
 const dx=Math.max(.002,maxX-minX),dy=Math.max(.002,maxY-minY);mapState.zoom=clamp(Math.log2(Math.min((w-110)/(256*dx),(h-135)/(256*dy))),1,zoomMax??11);projectMap();}
function fitMap(scope){mapState.scope=scope==='journey'?'journey':'leg';renderMapAll();let places=[];if(scope==='journey')places=currentJourney().legs.flatMap(l=>currentScenario(l).stays.map(s=>s.place).filter(Boolean));else if(scope==='leg')places=currentScenario().stays.map(s=>s.place).filter(Boolean);else if(scope==='stay'){const s=currentStay();places=s?[s.place]:currentScenario().stays.slice(0,1).map(s=>s.place);}if(!places.length&&scope!=='journey')return fitMap('journey');fitPlaces(places,scope==='journey'?5:scope==='stay'?10:8.5);}
function mapClickScreen(e){const rect=$('mapViewport').getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;ui.pendingMapPoint=geoFor(x,y);$('mapPlaceName').value='';$('mapPlaceName').placeholder=`Location ${ui.pendingMapPoint.lat.toFixed(2)}, ${ui.pendingMapPoint.lon.toFixed(2)}`;$('mapPopup').classList.remove('hidden');$('mapPlaceName').focus();}
function mapClosePopup(){$('mapPopup').classList.add('hidden');ui.pendingMapPoint=null;}
function addFromMap(asIdea){const p=ui.pendingMapPoint;if(!p)return;const name=$('mapPlaceName').value.trim()||`Place ${p.lat.toFixed(2)}, ${p.lon.toFixed(2)}`;const place={id:uid(),name,country:'Custom location',lat:+p.lat.toFixed(5),lon:+p.lon.toFixed(5),flag:'📍'};mapClosePopup();addPlace(place,asIdea);}
// === Immediate date-only operations, previewed during each drag ===
// Each completed gesture commits once; locks and explicit links determine propagation.
// Collision-based packing is separate from explicit links:
// - An unlocked, unlinked stay remains where it is unless an actual collision
//   requires moving it. Its original duration is preserved.
// - A linked component moves as a unit even when no collision occurs.
// - A lock anchors exactly its own dates, never the dates around it.
// - Moving into an occupied interval inserts there and pushes conflicting
//   unlocked stays forward. Left-edge extension pushes backwards instead.
function resolveCollisions(stays,initialIds,original,sc=currentScenario(),direction='forward'){
  const changed=new Set(initialIds),hardIds=new Set(initialIds);
  const baseline=new Set(overlapPairs(original).map(p=>[...p].sort().join('|')));
  const byId=new Map(stays.map(s=>[s.id,s]));
  const allIds=new Set(byId.keys());
  const queue=[...initialIds];
  let operations=0;
  while(queue.length){
    if(++operations>450)return {valid:false,reason:'Could not resolve all overlaps automatically. Try moving a smaller group or unlinking a connection.'};
    const moving=byId.get(queue.shift());if(!moving)continue;
    let collided=null;
    for(const other of stays){
      if(other.id===moving.id)continue;
      if(moving.start>=other.end||other.start>=moving.end)continue;
      if(baseline.has([moving.id,other.id].sort().join('|')))continue;
      collided=other;break;
    }
    if(!collided)continue;
    // Keep the explicitly dragged/resized component pinned. If two members
    // of that component collide, the user must change the edit. But a group
    // *previously pushed* by ripple is NOT an anchor: it can be pushed again
    // by another member of the original group. This matters when moving a
    // linked pair into a different linked pair's date range.
    if(hardIds.has(moving.id)&&hardIds.has(collided.id))
      return {valid:false,reason:`The linked destinations overlap ${collided.place.name}. Try a different date or unlink.`};
    let anchor=moving,group=linkedComponent(collided.id,sc,allIds);
    if(hardIds.has(collided.id)||[...group].some(id=>hardIds.has(id))){
      anchor=collided;
      group=linkedComponent(moving.id,sc,allIds);
    }
    if([...group].some(id=>hardIds.has(id)))
      return {valid:false,reason:`The linked destinations cannot fit together at these dates. Unlink or change the placement.`};
    const locked=[...group].map(id=>byId.get(id)).find(s=>s?.locked);
    if(locked)return {valid:false,reason:`Locked ${locked.place.name} occupies those dates. Move to an open range or unlock it.`};
    const groupStays=[...group].map(id=>byId.get(id)).filter(Boolean);
    // Push the entire connected group as little as possible, repeating when
    // another member of the anchored group also occupies the new dates.
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
      changed.add(stay.id);
      queue.push(stay.id);
    }
  }
  const remaining=overlapPairs(stays).filter(pair=>!baseline.has([...pair].sort().join('|')));
  if(remaining.length)return {valid:false,reason:'Unable to find a free placement without changing protected dates.'};
  return {valid:true,changedIds:[...changed],shiftCount:changed.size-initialIds.length,conflicts:overlapPairs(stays)};
}
function analyzeEdit(stayId,mode,delta,ripple=true,baseStays=currentScenario().stays){
  const original=ordered(baseStays),source=original.find(s=>s.id===stayId);
  if(!source)return {valid:false,reason:'Stay not found'};
  if(currentLeg().locked)return {valid:false,reason:`Unlock the ${currentLeg().title} leg to edit its stays`};
  if(source.locked)return {valid:false,reason:`Unlock ${source.place.name} to edit its dates`};
  const altered=clone(original),byId=new Map(altered.map(s=>[s.id,s]));
  const active=byId.get(stayId),before={start:active.start,end:active.end};
  if(mode==='move'){active.start=add(before.start,delta);active.end=add(before.end,delta);}
  else if(mode==='left')active.start=add(before.start,delta);
  else if(mode==='right')active.end=add(before.end,delta);
  else return {valid:false,reason:'Unknown edit operation'};
  if(active.start>=active.end)return {valid:false,reason:'Minimum stay: 1 night'};
  if(!delta)return {valid:true,stays:altered,changedIds:[],shiftCount:0,conflicts:overlapPairs(altered),isDifferent:false,mode,delta};
  const sc=currentScenario(),initial=new Set([stayId]),route=ordered(original),index=route.findIndex(s=>s.id===stayId);
  if(ripple){
    let linked=new Set([stayId]);
    if(mode==='move')linked=linkedComponent(stayId,sc);
    else{
      // Resizing the left edge pulls ONLY left-linked neighbours; resizing
      // the right edge pushes ONLY right-linked neighbours. The opposite side
      // remains where it is because its boundary has not changed.
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
// One gesture = one undoable, immediately saved change; no pending batches.
function shiftLeg(l,delta){
  const sc=currentScenario(l);
  sc.start=add(sc.start||l.start,delta);sc.end=add(sc.end||l.end,delta);
  for(const s of sc.stays){if(s.start)s.start=add(s.start,delta);if(s.end)s.end=add(s.end,delta);}
}
function analyzeLegMove(legId,delta,ripple=true,baseLegs=currentJourney().legs){
  const altered=clone(baseLegs),source=altered.find(l=>l.id===legId);
  if(!source)return {valid:false,reason:'Leg not found'};
  if(!delta)return {valid:true,legs:altered,changedIds:[],blocked:[],conflicts:legOverlaps(altered),isDifferent:false};
  const chain=[],visited=new Set();let current=source;
  while(current){
    if(visited.has(current.id))return {valid:false,reason:'Linked legs contain a loop. Unlink one of the legs.'};
    visited.add(current.id);chain.push(current);
    if(!ripple||!current.linkNextId)break;
    const next=altered.find(l=>l.id===current.linkNextId);
    if(!next)return {valid:false,reason:`${current.title} links to a removed leg. Unlink it first.`};
    current=next;
  }
  for(const l of chain){
    if(l.locked)return {valid:false,reason:`${l.title} is locked. Unlock or unlink it before moving this group.`};
    if(currentScenario(l).stays.some(s=>s.locked))return {valid:false,reason:`${l.title} contains locked dates. Unlock the stay before moving the whole leg.`};
  }
  chain.forEach(l=>shiftLeg(l,delta));
  // Unlinked legs may legitimately overlap: dates of those legs remain fixed.
  // Conflicts are displayed, never silently fixed or shifted.
  return {valid:true,legs:altered,changedIds:chain.map(l=>l.id),blocked:[],conflicts:legOverlaps(altered),isDifferent:true};
}
function computeOperation(kind,op){
  if(kind==='leg'){
    const result=analyzeLegMove(op.id,op.delta,true);
    return result.valid?{kind:'leg',...result}:result;
  }
  const result=analyzeEdit(op.id,op.mode,op.delta,true);
  if(!result.valid)return result;
  // A linked follower should also follow an end-boundary change made by an
  // internal stay edit, if that actually changes the leg's date envelope.
  // Existing unallocated gap at the leg's end is kept intentionally.
  const l=currentLeg(),sc=currentScenario(l);
  const bounds=stays=>({start:minDate(sc.start||l.start,...stays.map(s=>s.start)),end:maxDate(sc.end||l.end,...stays.map(s=>s.end))});
  const endDelta=days(bounds(sc.stays).end,bounds(result.stays).end);
  let followers=null;
  if(l.linkNextId&&endDelta){
    followers=analyzeLegMove(l.linkNextId,endDelta,true);
    if(!followers.valid)return {valid:false,reason:followers.reason};
  }
  return {kind:'stay',legId:l.id,...result,followers,linkedDelta:endDelta};
}
function applyOperation(kind,op){
  const candidate=computeOperation(kind,op);
  if(!candidate.valid){toast(candidate.reason);return false;}
  if(!candidate.isDifferent)return false;
  const updated=clone(kind==='leg'?candidate.legs:candidate.stays);
  const linkedFollowers=candidate.followers?.legs?clone(candidate.followers.legs):null;
  commit(kind==='leg'?'Moved linked leg group':'Adjusted stay; moved any colliding unlocked destinations',()=>{
    if(kind==='leg')currentJourney().legs=updated;
    else{
      // Replace both the leg's stays and its linked followers as ONE undo step.
      if(linkedFollowers)currentJourney().legs=linkedFollowers;
      currentScenario().stays=updated;
    }
  },{silent:true});
  if(candidate.blocked?.length)toast(`Locked ${candidate.blocked.join(', ')} stayed fixed. Later dates did not ripple past the lock.`);
  return true;
}
function stageOperation(kind,op){return applyOperation(kind,op);}
// A smooth, pointer-following representation of the grabbed bar. Date-snapped
// planning previews remain in the calendar below; this element never enters
// the hit-testing tree and never changes the saved plan.
function createDragGhost(d,bar,label){
  removeDragGhost();
  const rect=bar.getBoundingClientRect();
  d.ghostRect={left:rect.left,top:rect.top,width:rect.width,height:rect.height};
  const el=document.createElement('div');
  el.id='dragGhost';el.className='drag-ghost';el.setAttribute('aria-hidden','true');
  el.style.left=`${rect.left}px`;el.style.top=`${rect.top}px`;
  const resizing=d.mode==='left'||d.mode==='right';if(resizing){el.classList.add('resize-cursor');el.style.left=`${d.startX-8}px`;el.style.top=`${d.startY-13}px`;el.style.width='16px';el.style.height='28px';}else{el.style.width=`${rect.width}px`;el.style.height=`${rect.height}px`;}
  el.style.setProperty('--drag-color',getComputedStyle(bar).backgroundColor);
  const text=document.createElement('span');text.className='drag-ghost-label';text.textContent=d.mode==='left'||d.mode==='right'?'':label;
  el.appendChild(text);document.body.appendChild(el);
  $('calendarScroll').classList.add('is-edit-dragging');
}
function updateDragGhost(){
  const d=ui.drag,el=$('dragGhost');
  if(!d||!d.ghostRect||!el)return;
  const r=d.ghostRect,dx=d.clientX-d.startX,dy=d.clientY-d.startY;
  if(d.mode==='left'||d.mode==='right'){el.style.left=`${d.clientX-8}px`;el.style.top=`${d.clientY-13}px`;el.style.transform='none';}else el.style.transform=`translate3d(${dx}px,${dy}px,0)`;
  el.classList.toggle('blocked',!!d.invalidReason);
  el.classList.toggle('resizing',d.mode==='left'||d.mode==='right');
}
function removeDragGhost(){
  $('dragGhost')?.remove();
  $('calendarPanel')?.querySelector('.ideas-tray')?.classList.remove('drop-target');
  $('calendarScroll')?.classList.remove('is-edit-dragging');
  document.querySelectorAll('.day-cell.target-day').forEach(el=>el.classList.remove('target-day'));
}
function markDragDate(dt){
  const d=ui.drag;if(!d||d.markedDate===dt)return;
  document.querySelectorAll('.day-cell.target-day').forEach(el=>el.classList.remove('target-day'));
  if(dt){const cell=$('calendarRoot').querySelector(`.day-cell[data-date="${dt}"]`);cell?.classList.add('target-day');}
  d.markedDate=dt;
}
function setDragPreview(delta){
  const d=ui.drag;if(!d||!['stay','leg'].includes(d.kind))return;
  const candidate=computeOperation(d.kind,{id:d.id,mode:d.mode||'move',delta});
  d.candidate=candidate.valid?candidate:null;
  d.invalidReason=!candidate.valid?candidate.reason:null;
  // Critical: during the gesture, update overlays ONLY. Never rebuild the
  // calendar grid or alter the scroll layout based on transient dates.
  renderCalendarBars();
  updateDragGhost();
  updateDragTooltip();
}
function finishDrag(){
  const d=ui.drag;ui.drag=null;if(!d)return;
  $('calendarPanel').querySelector('.ideas-tray')?.classList.remove('drop-target');
  hideDragTooltip();removeDragGhost();
  if(d.kind==='idea'){finalizeIdeaDrag(d);renderCalendarBars();return;}
  if(d.kind==='create'){
    ui.suppressClickUntil=performance.now()+260;
    if(d.range&&d.moved){
      ui.suppressClickUntil=performance.now()+450;
      ui.pendingRange=d.range;
      renderCalendarBars();
      showQuickAdd(d.range,d.clientX,d.clientY);
    }else{
      renderCalendarBars();
      if(d.startDate)openSearch(d.startDate);
    }
    return;
  }
  if(!d.moved){
    if(d.kind==='leg')setLeg(d.id);
    else {state.selectedStayId=d.id;renderAll();}
    return;
  }
  ui.suppressClickUntil=performance.now()+260;
  if(d.kind==='stay'&&d.dropToIdeas){moveStayToIdeas(d.id);renderAll();return;}
  if(d.invalidReason)toast(d.invalidReason);
  else if(d.delta&&d.candidate?.valid)applyOperation(d.kind,{id:d.id,mode:d.mode||'move',delta:d.delta});
  else if(d.delta)toast('Drop on a valid date to edit the trip');
  renderAll();
}
function renderEditReview(){
  // Kept as a placeholder for backwards-compatible HTML; there is no review panel.
  const root=$('editReview');root.classList.add('hidden');root.innerHTML='';
}
function toggleCalendarLock(kind,id){
  if(kind==='leg'){
    const l=currentJourney().legs.find(x=>x.id===id);if(!l)return;
    commit(l.locked?`Unlocked ${l.title} leg`:`Locked ${l.title} leg`,()=>{l.locked=!l.locked;});
    return;
  }
  const s=currentScenario().stays.find(x=>x.id===id);if(!s)return;
  if(currentLeg().locked){toast(`Unlock the ${currentLeg().title} leg first`);return;}
  commit(s.locked?`Unlocked ${s.place.name}`:`Locked ${s.place.name} dates`,()=>{s.locked=!s.locked;});
}
function dateForEvent(e){
  const target=document.elementFromPoint(e.clientX,e.clientY),row=target?.closest('.week-row');
  if(!row)return null;
  const rect=row.getBoundingClientRect(),i=clamp(Math.floor((e.clientX-rect.left)/(rect.width/7)),0,6);
  return add(row.dataset.weekStart,i);
}
function calendarPointerDown(e){
  // Desktop drag creation; touch users can also tap a day to search.
  if(!$('quickAdd').classList.contains('hidden')&&!e.target.closest('#quickAdd'))dismissQuickAdd();
  if(e.button!==0&&e.pointerType==='mouse')return;
  const bar=e.target.closest('.calendar-bar'),chip=e.target.closest('.idea-pill');
  if(chip){e.preventDefault();ui.drag={kind:'idea',id:chip.dataset.ideaId,startX:e.clientX,startY:e.clientY,moved:false};return;}
  if(e.target.closest('.bar-lock-toggle,.bar-link-toggle'))return;
  if(!bar){
    const cell=e.target.closest('.day-cell');
    if(cell&&state.view==='leg'&&!currentLeg().locked){
      dismissQuickAdd();e.preventDefault();
      ui.drag={kind:'create',startDate:cell.dataset.date,startX:e.clientX,startY:e.clientY,clientX:e.clientX,clientY:e.clientY,moved:false,range:null};
    }
    return;
  }
  const id=bar.dataset.objectId,kind=bar.dataset.kind;
  if(kind==='leg-placeholder'||(kind==='stay'&&(state.view!=='leg'||bar.dataset.legId!==currentLeg()?.id)))return;
  if(kind==='stay'){
    const stay=visibleStays().find(s=>s.id===id);if(!stay)return;
    if(stay.locked||currentLeg().locked){toast(`Unlock ${currentLeg().locked?'the '+currentLeg().title+' leg':stay.place.name} before dragging`);return;}
    e.preventDefault();state.selectedStayId=id;
    const dt=dateForEvent(e)||stay.start;
    ui.drag={kind:'stay',id,mode:e.target.dataset.handle||'move',startX:e.clientX,startY:e.clientY,pointerDate:dt,delta:0,moved:false,candidate:null,barElement:bar,ghostLabel:stay.place.name};
    renderInspector();renderMapPins();
  }else{
    e.preventDefault();
    const l=effectiveLegs().find(l=>l.id===id);if(!l)return;
    if(l.locked||currentScenario(l).stays.some(s=>s.locked)){toast(`Unlock ${l.title}${l.locked?'':' stays'} to move this leg`);return;}
    const date=dateForEvent(e)||legBounds(l).start;
    state.selectedLegId=id;
    ui.drag={kind:'leg',id,mode:'move',pointerDate:date,startX:e.clientX,startY:e.clientY,delta:0,moved:false,candidate:null,barElement:bar,ghostLabel:l.title};
  }
}
function maybeAutoScroll(){
  const d=ui.drag;if(!d||!['stay','leg','idea','create'].includes(d.kind))return;
  const now=performance.now();if(now-(ui.lastAutoScroll||0)<45)return;ui.lastAutoScroll=now;
  const sc=$('calendarScroll'),r=sc.getBoundingClientRect(),y=d.clientY;
  if(!Number.isFinite(y)||y<r.top-12||y>r.bottom+12)return;
  const edge=76,direction=y<r.top+edge?-1:y>r.bottom-edge?1:0;
  if(!direction)return;
  const before=sc.scrollTop,max=sc.scrollHeight-sc.clientHeight;
  if((direction<0&&before<=1)||(direction>0&&before>=max-1)){
    if(direction<0)ui.calendarPadBefore++;else ui.calendarPadAfter++;
    renderCalendar();
  }else sc.scrollTop+=direction*12;
  const dt=Number.isFinite(d.clientX)?dateForEvent({clientX:d.clientX,clientY:d.clientY}):null;
  if(!dt)return;
  if(d.kind==='create')updateCreateDrag(d,dt);
  else if(['stay','leg'].includes(d.kind)&&d.moved){const delta=days(d.pointerDate,dt);if(delta!==d.delta){d.delta=delta;setDragPreview(delta);}}
}
function updateCreateDrag(d,dt){
  d.moved=true;
  const start=minDate(d.startDate,dt),end=add(maxDate(d.startDate,dt),1);
  if(d.range?.start===start&&d.range?.end===end)return;
  d.range={start,end};renderCalendarBars();updateDragTooltip();
}
function updateDragTooltip(){
  const d=ui.drag;if(!d||!d.moved)return;
  let el=$('dragTooltip');if(!el){el=document.createElement('div');el.id='dragTooltip';el.className='drag-tooltip';document.body.appendChild(el);}
  if(d.dropToIdeas){el.textContent='Release to move this destination to Ideas';el.classList.remove('invalid');}
  else if(d.kind==='create'&&d.range)el.textContent=`New stay · ${days(d.range.start,d.range.end)} nights · ${fmtDate(d.range.start)}–${fmtDate(d.range.end)}`;
  else if(d.invalidReason){el.textContent=`⚠ ${d.invalidReason}`;el.classList.add('invalid');}
  else if(d.candidate){
    el.classList.remove('invalid');
    const obj=d.kind==='stay'?d.candidate.stays.find(s=>s.id===d.id):d.candidate.legs.find(l=>l.id===d.id);
    const range=d.kind==='stay'?obj:legBounds(obj);
    el.textContent=`${d.kind==='leg'?'Move leg':'Edit stay'} · ${fmtDate(range.start)}–${fmtDate(range.end)} · ${days(range.start,range.end)} nights`;
  }
  if(d.kind==='create')el.classList.remove('invalid');
  el.style.left=`${Math.min(innerWidth-235,Math.max(9,(d.clientX||0)+12))}px`;
  el.style.top=`${Math.min(innerHeight-55,Math.max(8,(d.clientY||0)-43))}px`;
}
function hideDragTooltip(){$('dragTooltip')?.remove();}

function pointerMove(e){
  const d=ui.drag;
  if(d){
    d.clientX=e.clientX;d.clientY=e.clientY;
    if(d.kind==='stay'){d.dropToIdeas=!!document.elementFromPoint(e.clientX,e.clientY)?.closest('.ideas-tray');$('calendarPanel').querySelector('.ideas-tray')?.classList.toggle('drop-target',d.dropToIdeas);}
    if(['stay','leg'].includes(d.kind)){
      const distance=Math.hypot(e.clientX-d.startX,e.clientY-d.startY);
      if(distance>=5||d.moved){
        if(!d.moved){
          d.moved=true;
          $('saveLabel').textContent='Previewing drag';
          $('saveIndicator').classList.add('pending');
          createDragGhost(d,d.barElement,d.ghostLabel);
          // Even for a sub-day movement, render the edit affordances immediately.
          setDragPreview(0);
        }
        if(d.kind==='stay'&&d.dropToIdeas){d.candidate=null;d.invalidReason=null;renderCalendarBars();updateDragGhost();updateDragTooltip();return;}
        const dt=dateForEvent(e);
        markDragDate(dt);
        if(dt){
          const delta=days(d.pointerDate,dt);
          if(delta!==d.delta||d.invalidReason){d.delta=delta;setDragPreview(delta);}
        }else{
          d.invalidReason='Drop on a calendar date to move this item';
          d.candidate=null;
        }
        updateDragGhost();
        updateDragTooltip();
      }
    }else if(d.kind==='create'){
      const dt=dateForEvent(e);
      if(dt&&(Math.hypot(e.clientX-d.startX,e.clientY-d.startY)>5||dt!==d.startDate||d.moved))updateCreateDrag(d,dt);
    }else if(d.kind==='idea'){
      if(Math.hypot(e.clientX-d.startX,e.clientY-d.startY)>8){
        d.moved=true;
        let floating=$('ideaFloating');
        if(!floating){floating=document.createElement('div');floating.id='ideaFloating';floating.className='idea-pill';floating.style.cssText='position:fixed;z-index:80;pointer-events:none;box-shadow:0 7px 25px #2343;';document.body.appendChild(floating);}
        const idea=currentScenario().ideas.find(x=>x.id===d.id);
        floating.textContent=`📍 ${idea?.place.name||'Idea'}`;floating.style.left=`${e.clientX+12}px`;floating.style.top=`${e.clientY+7}px`;
        document.querySelectorAll('.day-cell.target-day').forEach(el=>el.classList.remove('target-day'));
        const dt=dateForEvent(e);
        if(dt){const cell=[...document.querySelectorAll('.day-cell')].find(el=>el.dataset.date===dt);cell?.classList.add('target-day');d.dropDate=dt;}
      }
    }
  }
  if(mapState.panning){const p=mapState.panning,dx=e.clientX-p.startX,dy=e.clientY-p.startY;if(Math.hypot(dx,dy)>3)p.moved=true;if(p.moved){mapState.cx=p.cx-dx/unitSize();mapState.cy=clamp(p.cy-dy/unitSize(),.02,.98);projectMap();}}
}
function pointerUp(e){
  if(ui.drag?.kind==='stay')ui.drag.dropToIdeas=!!document.elementFromPoint(e.clientX,e.clientY)?.closest('.ideas-tray');
  if(mapState.panning){const p=mapState.panning;mapState.panning=null;$('mapViewport').classList.remove('panning');if(!p.moved&&e.target.closest('#mapViewport')&&!e.target.closest('button')&&!e.target.closest('.map-popup'))mapClickScreen(e);}
  if(ui.drag){const d=ui.drag;if(d.kind==='idea')d.dropDate=dateForEvent(e)||d.dropDate;finishDrag();}
  document.querySelectorAll('.day-cell.target-day').forEach(el=>el.classList.remove('target-day'));$('ideaFloating')?.remove();
}
function finalizeIdeaDrag(d){
  const idea=currentScenario().ideas.find(x=>x.id===d.id);if(!idea)return;
  if(d.moved&&d.dropDate){scheduleIdea(d.id,d.dropDate);return;}
  if(!d.moved){const last=ordered(currentScenario().stays).at(-1);scheduleIdea(d.id,last?.end||legBounds(currentLeg()).start);}
}
function scheduleIdea(id,dt){
  const idea=currentScenario().ideas.find(x=>x.id===id);if(!idea)return;
  attemptInsertStay(idea.place,dt,add(dt,idea.nightsTarget||3),id);
}
function attemptInsertStay(place,start,end,ideaId=null){
  if(currentLeg().locked){toast(`Unlock the ${currentLeg().title} leg first`);return false;}
  if(!start||!end||start>=end){toast('Choose at least one night');return false;}
  const sc=currentScenario(),original=ordered(sc.stays),idea=ideaId?sc.ideas.find(x=>x.id===ideaId):null;
  const item={id:idea?.sourceStayId&&!original.some(s=>s.id===idea.sourceStayId)?idea.sourceStayId:uid(),place:clone(place),start,end,color:idea?.color||STAY_COLORS[original.length%STAY_COLORS.length],status:idea?.status||'tentative',locked:false,linkNextId:null};
  // Creating a stay obeys the same collision rules as moving one: a new
  // placement may push unlocked stays without creating any permanent links.
  const candidate=[...clone(original),clone(item)];
  const resolved=resolveCollisions(candidate,[item.id],original,sc,'forward');
  if(!resolved.valid){toast(resolved.reason);return false;}
  const leg=currentLeg(),oldBoundary=maxDate(sc.end||leg.end,...original.map(s=>s.end));
  const boundaryDelta=days(oldBoundary,maxDate(oldBoundary,...candidate.map(s=>s.end)));
  let linkedFollowers=null;
  if(leg.linkNextId&&boundaryDelta){
    linkedFollowers=analyzeLegMove(leg.linkNextId,boundaryDelta,true);
    if(!linkedFollowers.valid){toast(linkedFollowers.reason);return false;}
  }
  commit(`Added ${place.name} · ${days(start,end)} nights`,()=>{
    if(linkedFollowers)currentJourney().legs=clone(linkedFollowers.legs);
    const active=currentScenario();active.stays=clone(candidate);
    if(ideaId)active.ideas=active.ideas.filter(i=>i.id!==ideaId);
    state.selectedStayId=item.id;state.view='leg';
  },{silent:true});
  dismissQuickAdd();return true;
}
// Unscheduling is a reversible change, not deletion. Preserve identity,
// location, color and the former duration, but leave other dates untouched.
function moveStayToIdeas(stayId=state.selectedStayId){
  const leg=currentLeg(),sc=currentScenario(),stay=sc.stays.find(s=>s.id===stayId);
  if(!stay)return false;
  if(leg.locked||stay.locked){toast(`Unlock ${leg.locked?leg.title:stay.place.name} before unscheduling`);return false;}
  commit(`Moved ${stay.place.name} to Ideas`,()=>{
    sc.ideas.push({id:uid(),sourceStayId:stay.id,place:clone(stay.place),color:stay.color,
      nightsTarget:days(stay.start,stay.end),lastDates:{start:stay.start,end:stay.end},status:stay.status});
    sc.stays=sc.stays.filter(s=>s.id!==stay.id);
    sc.stayLinks=(sc.stayLinks||[]).filter(e=>e.a!==stay.id&&e.b!==stay.id);
    for(const remaining of sc.stays)if(remaining.linkNextId===stay.id)remaining.linkNextId=null;
    if(sc.connections){delete sc.connections[stay.id];}
    if(state.selectedStayId===stay.id)state.selectedStayId=null;
  },{silent:true});
  return true;
}
function showQuickAdd(range,x,y){
  const pop=$('quickAdd');if(!pop)return;
  $('quickRangeLabel').textContent=`${fmtDate(range.start,true)} – ${fmtDate(add(range.end,-1),true)} · ${days(range.start,range.end)} nights`;
  pop.classList.remove('hidden');
  const r=$('calendarPanel').getBoundingClientRect();
  const w=pop.offsetWidth||300,h=pop.offsetHeight||290;
  pop.style.left=`${clamp(x||r.left+70,12,innerWidth-w-12)}px`;
  pop.style.top=`${clamp((y||r.top+100)+8,12,innerHeight-h-12)}px`;
  $('quickSearch').value='';renderQuickMatches();$('quickSearch').focus();
}
function renderQuickMatches(){
  const q=$('quickSearch').value.trim().toLowerCase();
  const list=q?CITY_DATA.filter(p=>`${p.name} ${p.country}`.toLowerCase().includes(q)).slice(0,7):CITY_DATA.filter(p=>['Kyoto','Tokyo','Bangkok','Hanoi','Rome'].includes(p.name));
  $('quickMatches').innerHTML=list.map(p=>`<button class="quick-place" data-quick-place="${esc(p.id)}"><span>${p.flag||'📍'}</span><strong>${esc(p.name)}</strong><small>${esc(p.country)}</small></button>`).join('')||'<p class="quick-empty">No included matches. Use the full location search or select an idea.</p>';
  $('quickIdeas').innerHTML=currentScenario().ideas.slice(0,8).map(i=>`<button class="quick-idea" data-quick-idea="${esc(i.id)}">${svgIcon('pin')}${esc(i.place.name)} <span>${i.nightsTarget?i.nightsTarget+'n':'Idea'}</span></button>`).join('');
}
function dismissQuickAdd(){ui.pendingRange=null;$('quickAdd')?.classList.add('hidden');renderCalendarBars();}
function quickChoose(e){
  if(!ui.pendingRange)return;
  const match=e.target.closest('[data-quick-place]'),idea=e.target.closest('[data-quick-idea]');
  if(match){const p=CITY_DATA.find(p=>p.id===match.dataset.quickPlace);if(p)attemptInsertStay(p,ui.pendingRange.start,ui.pendingRange.end);}
  else if(idea){const i=currentScenario().ideas.find(i=>i.id===idea.dataset.quickIdea);if(i)attemptInsertStay(i.place,ui.pendingRange.start,ui.pendingRange.end,i.id);}
}
function changeStayNights(delta){
  const stay=visibleStay();if(!stay)return;
  if(stay.locked||currentLeg().locked)return toast(`Unlock ${currentLeg().locked?currentLeg().title:stay.place.name} first`);
  stageOperation('stay',{id:stay.id,mode:'right',delta});
}
function changeStayArrival(date){
  const stay=visibleStay();if(!stay||stay.locked||currentLeg().locked)return toast('Unlock the stay or leg before changing dates');
  if(!date)return toast('Enter a date first');
  stageOperation('stay',{id:stay.id,mode:'move',delta:days(stay.start,date)});
}
// === Search, ideas and scenarios ===
function drawerOpen(id){$(id).classList.remove('hidden');}
function drawerClose(id){$(id).classList.add('hidden');}
function openSearch(date=null){ui.pendingDate=date;ui.remoteResults=[];$('placeQuery').value='';$('searchInfo').textContent=date?`Click Add stay to place it on ${fmtDate(date,true)} for three tentative nights, then drag/resize on the calendar.`:'Type a destination for instant matches. World lookup runs only when you press Search world.';renderSearchResults();drawerOpen('searchDrawer');setTimeout(()=>$('placeQuery').focus(),25);}
function renderSearchResults(){const q=$('placeQuery').value.trim().toLocaleLowerCase();let list;if(ui.remoteResults.length)list=ui.remoteResults;else if(q)list=CITY_DATA.filter(p=>`${p.name} ${p.country}`.toLowerCase().includes(q)).slice(0,14);else list=CITY_DATA.filter(p=>['Bangkok','Chiang Mai','Siem Reap','Hanoi','Kyoto','Tokyo','Colmar','Rome'].includes(p.name));ui.localResults=list;const resultList=$('placeResults');if(!list.length){resultList.innerHTML='<div class="results-note">No included-city match. Try Search world (when served locally), or click directly on the map to add a custom place.</div>';return;}
 resultList.innerHTML=list.map((p,i)=>`<div class="place-result"><div class="place-flag">${p.flag||'🌐'}</div><div class="place-result-main"><div class="place-result-name">${esc(p.name)}</div><div class="place-result-region">${esc(p.country||'Map location')}</div></div><div class="place-result-actions"><button class="button button-soft" data-search-index="${i}" data-add-type="idea">Save idea</button><button class="button button-primary" data-search-index="${i}" data-add-type="stay">+ Add stay</button></div></div>`).join('');}
async function worldSearch(){const q=$('placeQuery').value.trim();if(q.length<2){toast('Enter at least two characters to search.');return;}if(!location.protocol.startsWith('http')){$('searchInfo').textContent='World lookup needs the app served over HTTP (the Windows launcher does this). Included-city search and map click work when opened as a file.';return;}const now=Date.now();if(now-ui.lastSearchAt<1250){toast('Please wait a moment between online searches.');return;}ui.lastSearchAt=now;const btn=$('searchWorldBtn');btn.disabled=true;btn.textContent='Searching…';$('searchInfo').textContent='Querying OpenStreetMap Nominatim once for this search. No live/autocomplete lookups.';try{const url=`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(q)}`;const resp=await fetch(url,{headers:{'Accept-Language':'en'}});if(!resp.ok)throw Error(`HTTP ${resp.status}`);const data=await resp.json();ui.remoteResults=data.map(p=>{let addr=p.address||{},loc=[addr.city,addr.town,addr.village,addr.municipality,addr.county,addr.state,addr.country].filter(Boolean);let name=p.name||addr.city||addr.town||addr.village||p.display_name?.split(',')[0]||'Unnamed place';return {id:`osm-${p.osm_type}-${p.osm_id}`,name,country:loc.filter(n=>n!==name).join(', '),lat:Number(p.lat),lon:Number(p.lon),flag:'🌐'};});$('searchInfo').textContent=`${data.length} world match(es) · place data © OpenStreetMap contributors · Request is only sent when you click Search world.`;renderSearchResults();}catch(err){ui.remoteResults=[];$('searchInfo').textContent=`World lookup unavailable (${err.message}). Use included-city search or click the map to create a custom location.`;renderSearchResults();}finally{btn.disabled=false;btn.textContent='Search world';}}
function addPlace(place,asIdea){if(!place)return;if(!asIdea&&currentLeg().locked)return toast(`Unlock the ${currentLeg().title} leg first`);drawerClose('searchDrawer');if(asIdea){ui.pendingRange=null;ui.pendingDate=null;commit(`Saved ${place.name} as an unscheduled idea`,()=>{currentScenario().ideas.push({id:uid(),place:clone(place)});});return;}if(ui.pendingRange){const {start,end}=ui.pendingRange;ui.pendingRange=null;ui.pendingDate=null;attemptInsertStay(place,start,end);return;}const sc=currentScenario();const last=ordered(sc.stays).at(-1);const start=ui.pendingDate||last?.end||legBounds(currentLeg()).start;ui.pendingDate=null;attemptInsertStay(place,start,add(start,3));}
function duplicateLegScenario(){if(draftBlocked())return;const l=currentLeg(),orig=currentScenario(l);let copy=clone(orig);copy.id=uid();copy.name=`${orig.name} — alternative ${l.scenarios.length}`;copy.parentId=orig.id;l.scenarios.push(copy);const savedCopy=clone(l.scenarios);const newId=copy.id; // mutation is committed below via a snapshot, not before it
 l.scenarios.pop();commit(`Created ${copy.name}`,()=>{l.scenarios=savedCopy;l.activeScenarioId=newId;state.selectedStayId=copy.stays[0]?.id||null;});renderVersionsBody();}
function duplicateJourneyVersion(){if(draftBlocked())return;const orig=currentJourney();let newJourney=clone(orig);newJourney.id=uid();newJourney.name=`${orig.name} — alternative ${state.journeyVersions.length}`;newJourney.parentId=orig.id;const oldSelected=state.selectedLegId;const copiedIds=new Map(newJourney.legs.map(l=>[l.id,uid()]));newJourney.legs=newJourney.legs.map(l=>{const oldIndex=l.scenarios.findIndex(s=>s.id===l.activeScenarioId);const newScenarios=l.scenarios.map(s=>({...s,id:uid()}));return {...l,id:copiedIds.get(l.id),linkNextId:l.linkNextId?copiedIds.get(l.linkNextId)||null:null,scenarios:newScenarios,activeScenarioId:newScenarios[Math.max(0,oldIndex)].id};});const legIdx=orig.legs.findIndex(l=>l.id===oldSelected),nextLegId=newJourney.legs[Math.max(0,legIdx)]?.id;commit(`Created entire-journey alternative`,()=>{state.journeyVersions.push(newJourney);state.activeJourneyVersionId=newJourney.id;state.selectedLegId=nextLegId||newJourney.legs[0]?.id;state.selectedStayId=currentScenario().stays[0]?.id||null;});renderVersionsBody();}
function switchLegScenario(id){if(draftBlocked())return;const l=currentLeg();if(!l.scenarios.some(s=>s.id===id))return;commit('Switched leg scenario',()=>{l.activeScenarioId=id;state.selectedStayId=l.scenarios.find(s=>s.id===id).stays[0]?.id||null;});renderVersionsBody();}
function switchJourneyVersion(id){if(draftBlocked())return;if(!state.journeyVersions.some(j=>j.id===id))return;commit('Switched journey version',()=>{const ix=currentJourney().legs.findIndex(l=>l.id===state.selectedLegId);state.activeJourneyVersionId=id;const j=currentJourney();state.selectedLegId=j.legs[clamp(ix,0,j.legs.length-1)]?.id;state.selectedStayId=currentScenario()?.stays[0]?.id||null;});renderVersionsBody();fitMap(state.view==='leg'?'leg':'journey');}
function deleteJourneyPlan(id){
 const plan=state.journeyVersions.find(x=>x.id===id);
 if(!plan||state.journeyVersions.length<=1)return toast('Keep at least one plan.');
 if(!confirm(`Delete the plan "${plan.name}" and all its legs and versions? You can Undo afterward.`))return;
 ui.calendarPositioned=false;
 commit(`Deleted plan ${plan.name}`,()=>{
  state.journeyVersions=state.journeyVersions.filter(x=>x.id!==id);
  if(state.activeJourneyVersionId===id){state.activeJourneyVersionId=state.journeyVersions[0].id;state.selectedLegId=currentJourney().legs[0]?.id||null;state.selectedStayId=currentScenario()?.stays[0]?.id||null;}
 });renderVersionsBody();fitMap(state.view==='leg'?'leg':'journey');
}
function deleteLegVersion(id){
 const leg=currentLeg(),sc=leg.scenarios.find(x=>x.id===id);
 if(!sc||leg.scenarios.length<=1)return toast('Keep at least one leg version.');
 if(!confirm(`Delete the leg version "${sc.name}"? You can Undo afterward.`))return;
 commit(`Deleted leg version ${sc.name}`,()=>{
  leg.scenarios=leg.scenarios.filter(x=>x.id!==id);
  if(leg.activeScenarioId===id){leg.activeScenarioId=leg.scenarios[0].id;state.selectedStayId=currentScenario().stays[0]?.id||null;}
 });renderVersionsBody();
}
function renamePlan(id,kind){
 const item=kind==='journey'?state.journeyVersions.find(x=>x.id===id):currentLeg().scenarios.find(x=>x.id===id);
 if(!item)return;
 const name=prompt(kind==='journey'?'Rename plan':'Rename leg version',item.name);
 if(!name?.trim())return;
 commit('Renamed '+kind,()=>{item.name=name.trim();if(kind==='journey')item.title=name.trim();});renderVersionsBody();
}
function newBlankPlan(){
 const id=uid(),legId=uid(),start=journeyBounds().start||'2027-01-01';
 const title=`New journey ${state.journeyVersions.length+1}`;
 const starter=leg(legId,'First leg',LEG_COLORS[0],start,add(start,21),[]);
 ui.calendarPositioned=false;
 commit('Created blank plan',()=>{
  state.journeyVersions.push({id,name:title,title,legs:[starter]});
  state.activeJourneyVersionId=id;state.selectedLegId=legId;state.selectedStayId=null;state.view='leg';
 });renderVersionsBody();fitMap('leg');toast('Plan ready. Drag across calendar dates to add a stay.');
}
function renameCurrentLeg(){
 const l=currentLeg();if(!l)return;
 const title=prompt('Rename this leg',l.title);
 if(title?.trim())commit('Renamed leg',()=>{l.title=title.trim();});
}
function deleteCurrentLeg(){
 const j=currentJourney(),l=currentLeg();if(!l||j.legs.length<=1)return toast('A plan needs at least one leg.');
 if(!confirm(`Delete ${l.title} and all its destinations? You can Undo afterward.`))return;
 ui.calendarPositioned=false;
 commit(`Deleted leg ${l.title}`,()=>{
  j.legs=j.legs.filter(x=>x.id!==l.id);
  for(const other of j.legs)if(other.linkNextId===l.id)other.linkNextId=null;
  state.selectedLegId=j.legs[0].id;state.selectedStayId=currentScenario()?.stays[0]?.id||null;
 });fitMap('leg');
}
function renderVersionsBody(){const j=currentJourney(),leg=currentLeg();let html=`<div class="version-card"><h3>Saved plans</h3><p>Open, rename, duplicate or delete independent plans. Deleted plans can be restored with Undo.</p>`;state.journeyVersions.forEach(v=>{html+=`<div class="version-row"><div class="version-name">${esc(v.name)} <div class="version-small">${v.legs.length} legs</div></div>${v.id===state.activeJourneyVersionId?'<span class="version-active">ACTIVE</span>':`<button class="button button-outline" data-version-action="switch-journey" data-id="${v.id}">Open</button>`}<button class="button button-outline" data-version-action="rename-journey" data-id="${v.id}">Rename</button><button class="button button-outline button-danger" data-version-action="delete-journey" data-id="${v.id}" ${state.journeyVersions.length<2?'disabled':''}>Delete</button></div>`;});html+=`<div class="details-actions"><button class="button button-soft" data-version-action="fork-journey">${svgIcon('copy')} Duplicate plan</button><button class="button button-outline" data-version-action="new-journey">${svgIcon('plus')} New blank plan</button></div></div>`;
 html+=`<div class="version-card"><h3>${esc(leg.title)} · leg versions</h3><p>Only this leg changes when you fork it. The other journey legs remain intact.</p>`;leg.scenarios.forEach(sc=>{html+=`<div class="version-row"><div class="version-name">${esc(sc.name)} <div class="version-small">${sc.stays.length} destinations · ${numNights(sc.stays)} nights</div></div>${sc.id===leg.activeScenarioId?'<span class="version-active">ACTIVE</span>':`<button class="button button-outline" data-version-action="switch-leg" data-id="${sc.id}">Open</button>`}<button class="button button-outline" data-version-action="rename-leg-version" data-id="${sc.id}">Rename</button><button class="button button-outline button-danger" data-version-action="delete-leg-version" data-id="${sc.id}" ${leg.scenarios.length<2?'disabled':''}>Delete</button></div>`;});html+=`<button class="button button-soft full-button" data-version-action="fork-leg">${svgIcon('copy')} Duplicate ${esc(leg.title)} leg</button>`;if(leg.scenarios.length>1)html+=`<button class="button button-outline full-button" data-version-action="compare-leg">Compare leg versions</button>`;html+='</div><div class="version-card"><h3>Local data backup</h3><p>This prototype saves only in this browser. Download a portable JSON copy for safekeeping or to transfer to another device.</p><div class="details-actions"><button class="button button-outline" data-version-action="backup">Download backup</button><button class="button button-outline" data-version-action="restore">Restore backup</button></div><input type="file" id="restoreBackupInput" accept="application/json,.json" class="hidden"></div><div id="compareResult"></div>';$('versionsBody').innerHTML=html;}
function compareScenarios(){const l=currentLeg();if(l.scenarios.length<2)return;const one=l.scenarios.find(x=>x.id===l.activeScenarioId),two=l.scenarios.find(x=>x.id!==l.activeScenarioId)||l.scenarios[0];const names=new Map();for(const s of one.stays)names.set(s.place.name, {a:s,b:null});for(const s of two.stays){let obj=names.get(s.place.name)||{a:null,b:null};obj.b=s;names.set(s.place.name,obj);}const row=sc=>ordered(sc.stays).map(s=>{const ref=sc===one?names.get(s.place.name)?.b:names.get(s.place.name)?.a;let different=!ref||ref.start!==s.start||ref.end!==s.end;return `<div class="compare-stay ${different?'changed':''}"><span>${esc(s.place.name)}</span><span>${fmtDate(s.start)} · ${days(s.start,s.end)}n</span></div>`;}).join('');$('compareResult').innerHTML=`<div class="version-card"><h3>Leg comparison</h3><div class="version-compare"><div class="compare-column"><h4>${esc(one.name)} (active)</h4>${row(one)||'No stays'}</div><div class="compare-column"><h4>${esc(two.name)}</h4>${row(two)||'No stays'}</div></div><p class="compare-tip">Amber text indicates changed or missing destinations or dates. Switch versions above to make edits. This prototype has a simple difference view; linked side-by-side maps and calendars are reserved for full V1.</p></div>`;}
function downloadBackup(){const blob=new Blob([JSON.stringify({format:'travel-canvas-prototype',version:1,exportedAt:new Date().toISOString(),state},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`travel-canvas-backup-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);toast('Downloaded JSON backup');}
async function restoreBackup(file){try{const obj=JSON.parse(await file.text());const incoming=obj.state;if(obj.format!=='travel-canvas-prototype'||!incoming||!Array.isArray(incoming.journeyVersions)||!incoming.journeyVersions.length)throw Error('This is not a Travel Canvas prototype backup.');if(!confirm('Replace the current browser plan with the JSON backup? Download a backup of your current plan first.'))return;state=incoming;ensureStayColors();ui.calendarPositioned=false;undoStack.length=0;redoStack.length=0;ui.preview=null;persist();renderAll();fitMap('leg');renderVersionsBody();toast('Backup restored successfully');}catch(err){toast(`Could not restore: ${err.message}`);}}
function createLegFromForm(e){
 e.preventDefault();if(draftBlocked())return;
 const title=$('legNameInput').value.trim(),start=$('legStartInput').value,end=$('legEndInput').value;
 if(!title||!start||!end||start>=end){$('legFormError').textContent='Enter a name and an end date after the start date.';return;}
 const legId=uid(),l=leg(legId,title,LEG_COLORS[currentJourney().legs.length%LEG_COLORS.length],start,end,[]);
 ui.calendarPositioned=false;
 commit(`Created ${title}`,()=>{
  currentJourney().legs.push(l);currentJourney().legs.sort((a,b)=>a.start.localeCompare(b.start));
  state.selectedLegId=legId;state.selectedStayId=null;state.view='leg';
 });drawerClose('legDrawer');$('legForm').reset();fitMap('leg');
 toast(`${title} is ready. Drag across empty dates to add a stay.`);
}
// === Event handlers ===
function setupEvents(){
 $('journeyTitle').addEventListener('focus',()=>ui.editingTitle=true);$('journeyTitle').addEventListener('blur',()=>{ui.editingTitle=false;const val=$('journeyTitle').value.trim();if(val&&val!==planTitle())commit('Renamed journey',()=>{currentJourney().title=val;currentJourney().name=val;});else $('journeyTitle').value=planTitle();});$('journeyTitle').addEventListener('keydown',e=>{if(e.key==='Enter')e.target.blur();});
 $('undoBtn').onclick=undo;$('redoBtn').onclick=redo;$('overviewModeBtn').onclick=()=>viewScope('overview');$('journeyModeBtn').onclick=()=>viewScope('journey');$('legModeBtn').onclick=()=>viewScope('leg');$('overviewQuick').onclick=()=>viewScope('journey');$('legSelect').onchange=e=>setLeg(e.target.value);$('legVersionSelect').onchange=e=>switchLegScenario(e.target.value);$('duplicateLegBtn').onclick=duplicateLegScenario;
 $('ribbonBars').addEventListener('click',e=>{const id=e.target.closest('[data-leg]')?.dataset.leg;if(id)setLeg(id);});
 $('legChain').addEventListener('click',e=>{
   if(e.target.closest('[data-unlink-all-stays]')){const sc=currentScenario();commit('Unlinked all destinations in this leg',()=>{sc.stayLinks=[];});return;}
   const idea=e.target.closest('[data-stay-to-ideas]');if(idea){moveStayToIdeas(idea.dataset.stayToIdeas);return;}
   const slink=e.target.closest('[data-stay-link-from]');if(slink){toggleStayLink(slink.dataset.stayLinkFrom,slink.dataset.stayLinkTo);return;}
   const slock=e.target.closest('[data-stay-lock]');if(slock){toggleCalendarLock('stay',slock.dataset.stayLock);return;}
   const sopen=e.target.closest('[data-stay-open]');if(sopen){pickStay(sopen.dataset.stayOpen);return;}
   const link=e.target.closest('[data-link-from]');if(link){toggleLegLink(link.dataset.linkFrom,link.dataset.linkTo);return;}
   const lock=e.target.closest('[data-leg-lock]');if(lock){toggleCalendarLock('leg',lock.dataset.legLock);return;}
   const open=e.target.closest('[data-leg-open]');if(open)setLeg(open.dataset.legOpen);
 });
 $('addLegBtn').onclick=()=>{const j=journeyBounds();$('legStartInput').value=add(j.end,2);$('legEndInput').value=add(j.end,23);$('legFormError').textContent='';drawerOpen('legDrawer');};$('closeLegDrawer').onclick=()=>drawerClose('legDrawer');$('legScrim').onclick=()=>drawerClose('legDrawer');$('legForm').onsubmit=createLegFromForm;
 $('variantsBtn').onclick=()=>{renderVersionsBody();drawerOpen('versionsDrawer');};$('closeVersions').onclick=()=>drawerClose('versionsDrawer');$('versionsScrim').onclick=()=>drawerClose('versionsDrawer');$('versionsBody').addEventListener('change',async e=>{if(e.target.id!=='restoreBackupInput')return;const f=e.target.files?.[0];if(f)await restoreBackup(f);});$('versionsBody').addEventListener('click',e=>{const el=e.target.closest('[data-version-action]');if(!el)return;switch(el.dataset.versionAction){case 'fork-leg':duplicateLegScenario();break;case 'fork-journey':duplicateJourneyVersion();break;case 'switch-leg':switchLegScenario(el.dataset.id);break;case 'switch-journey':switchJourneyVersion(el.dataset.id);break;case 'delete-journey':deleteJourneyPlan(el.dataset.id);break;case 'delete-leg-version':deleteLegVersion(el.dataset.id);break;case 'rename-journey':renamePlan(el.dataset.id,'journey');break;case 'rename-leg-version':renamePlan(el.dataset.id,'leg');break;case 'new-journey':newBlankPlan();break;case 'compare-leg':compareScenarios();break;case 'backup':downloadBackup();break;case 'restore':$('restoreBackupInput').click();break;}});
 $('calendarRoot').addEventListener('pointerdown',calendarPointerDown);$('ideasCards').addEventListener('pointerdown',calendarPointerDown);$('calendarRoot').addEventListener('click',e=>{if(ui.drag||performance.now()<ui.suppressClickUntil)return;const slink=e.target.closest('.bar-link-toggle');if(slink){e.preventDefault();e.stopPropagation();toggleStayLink(slink.dataset.stayLinkFrom,slink.dataset.stayLinkTo);return;}const lock=e.target.closest('.bar-lock-toggle');if(lock){e.preventDefault();e.stopPropagation();const parent=lock.closest('.calendar-bar');if(parent)toggleCalendarLock(parent.dataset.kind,parent.dataset.objectId);return;}const bar=e.target.closest('.calendar-bar');if(bar){if(bar.dataset.kind==='leg'||bar.dataset.kind==='leg-placeholder')setLeg(bar.dataset.legId||bar.dataset.objectId);else pickStay(bar.dataset.objectId,bar.dataset.legId);return;}const cell=e.target.closest('.day-cell');if(cell&&state.view==='leg'){if(!draftBlocked())openSearch(cell.dataset.date);}});$('calendarScroll').addEventListener('scroll',updateStickyMonth,{passive:true});$('ribbonToggle').addEventListener('click',()=>{ui.ribbonExpanded=!ui.ribbonExpanded;renderRibbon();});
 $('calendarRoot').addEventListener('keydown',e=>{if(e.key!=='Enter')return;if(e.target.closest('.bar-lock-toggle,.bar-link-toggle'))return;const bar=e.target.closest('.calendar-bar');if(!bar)return;if(bar.dataset.kind==='leg'||bar.dataset.kind==='leg-placeholder')setLeg(bar.dataset.legId||bar.dataset.objectId);else pickStay(bar.dataset.objectId,bar.dataset.legId);});
 $('mobileEditStrip').addEventListener('click',e=>{
   const link=e.target.closest('[data-mobile-link-peer]');if(link){const stay=currentStay();if(stay)toggleStayLink(stay.id,link.dataset.mobileLinkPeer);return;}
   const step=e.target.closest('[data-mobile-step]');
   if(step){changeStayNights(Number(step.dataset.mobileStep));return;}
   if(e.target.closest('[data-mobile-lock]')){const st=currentStay();if(st)toggleCalendarLock('stay',st.id);return;}
   if(e.target.closest('[data-mobile-ideas]')){moveStayToIdeas();return;}
   if(e.target.closest('[data-mobile-undo]')){undo();return;}
   if(e.target.closest('[data-mobile-details]')){
      $('mobileMap').click();
   }
 });
 $('quickSearch').addEventListener('input',renderQuickMatches);
 $('quickSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('quickMatches .quick-place')?.click();}if(e.key==='Escape'){e.preventDefault();dismissQuickAdd();}});
 $('quickMatches').addEventListener('click',quickChoose);$('quickIdeas').addEventListener('click',quickChoose);
 $('quickAddCancel').onclick=dismissQuickAdd;
 $('quickExpandSearch').onclick=()=>{const r=ui.pendingRange;dismissQuickAdd();if(r){ui.pendingRange=r;openSearch(r.start);$('searchInfo').textContent=`Selected ${days(r.start,r.end)} nights, ${fmtDate(r.start)} – ${fmtDate(add(r.end,-1))}. Select a place to add it.`;}};
 document.addEventListener('pointerdown',e=>{if(!$('quickAdd').classList.contains('hidden')&&!e.target.closest('#quickAdd')&&!e.target.closest('.day-cell')&&!e.target.closest('.calendar-bar'))dismissQuickAdd();},{capture:true});
 $('addIdeaBtn').onclick=()=>openSearch();$('ideasToggle').onclick=()=>$('ideasToggle').closest('.ideas-tray').classList.toggle('collapsed');
 // Individual calendar actions now commit on release; no review prompt.
 $('detailsRoot').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const id=b.id,s=currentStay();if(id==='inspectorFocusLeg')setLeg(currentLeg().id);if(id==='inspectorSearch')openSearch();if(id==='inspectorRenameLeg')renameCurrentLeg();if(id==='inspectorDeleteLeg')deleteCurrentLeg();if(id==='shortenStay')changeStayNights(-1);if(id==='lengthenStay')changeStayNights(1);if(id==='toggleLock'&&s)toggleCalendarLock('stay',s.id);if(b.dataset.inspectorLink&&s)toggleStayLink(s.id,b.dataset.inspectorLink);if(id==='moveStayToIdeas'&&s)moveStayToIdeas(s.id);if(id==='toggleTentative'&&s)commit('Changed planning status',()=>{s.status=s.status==='tentative'?'placed':'tentative';});if(id==='deleteStay'&&s){if(confirm(`Remove ${s.place.name} from this leg? You can undo.`))commit(`Removed ${s.place.name}`,()=>{currentScenario().stays=currentScenario().stays.filter(x=>x.id!==s.id);state.selectedStayId=null;});}if(id==='fitSelectedFromInspector')fitMap('stay');});
 $('detailsRoot').addEventListener('change',e=>{const s=currentStay();if(!s)return;if(e.target.id==='inspectorDate')changeStayArrival(e.target.value);if(e.target.id==='inspectorNights')changeStayNights(+e.target.value-days(visibleStay().start,visibleStay().end));if(e.target.id==='travelMode'){if(draftBlocked())return;const val=e.target.value;commit(`Updated travel mode`,()=>{currentScenario().connections[s.id]={mode:val};});}});
 $('clearSelection').onclick=()=>{state.selectedStayId=null;renderCalendar();renderInspector();renderMobileEditStrip();renderMapPins();};
 $('mapPins').addEventListener('click',e=>{const pin=e.target.closest('.map-pin');if(!pin)return;e.stopPropagation();mapClosePopup();if(pin.dataset.kind==='leg'){setLeg(pin.dataset.pinId);}else{if(window.innerWidth<=840){$('workspace').classList.add('show-map');$('mobileCalendar').classList.remove('active');$('mobileMap').classList.add('active');}pickStay(pin.dataset.pinId);}});
 $('vectorMapBtn').onclick=()=>setMapLayer('atlas');$('streetMapBtn').onclick=()=>setMapLayer('street');$('mapZoomIn').onclick=()=>changeZoom(.75);$('mapZoomOut').onclick=()=>changeZoom(-.75);$('fitJourney').onclick=()=>fitMap('journey');$('fitLeg').onclick=()=>fitMap('leg');$('fitStay').onclick=()=>fitMap('stay');$('mapTipBtn').onclick=()=>toast('Drag to pan, scroll/pinch to zoom, or click the map to add a place. Fit buttons frame the route.');
 $('mapViewport').addEventListener('pointerdown',e=>{if(e.button!==0&&e.pointerType==='mouse')return;if(e.target.closest('.map-pin,.map-popup,.map-controls,.map-fit-actions'))return;mapState.panning={startX:e.clientX,startY:e.clientY,cx:mapState.cx,cy:mapState.cy,moved:false};$('mapViewport').classList.add('panning');});$('mapViewport').addEventListener('wheel',e=>{e.preventDefault();const rect=$('mapViewport').getBoundingClientRect();changeZoom(e.deltaY<0?.34:-.34,{x:e.clientX-rect.left,y:e.clientY-rect.top});},{passive:false});
 $('mapSaveIdea').onclick=()=>addFromMap(true);$('mapAddStay').onclick=()=>addFromMap(false);$('mapPopup').addEventListener('pointerdown',e=>e.stopPropagation());
 $('searchDrawer').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='placeQuery'){e.preventDefault();worldSearch();}});$('placeQuery').oninput=()=>{ui.remoteResults=[];renderSearchResults();};$('searchWorldBtn').onclick=worldSearch;$('placeResults').addEventListener('click',e=>{const b=e.target.closest('[data-search-index]');if(!b)return;addPlace(ui.localResults[Number(b.dataset.searchIndex)],b.dataset.addType==='idea');});$('closeSearch').onclick=()=>drawerClose('searchDrawer');$('drawerScrim').onclick=()=>drawerClose('searchDrawer');
 $('mobileCalendar').onclick=()=>{ui.view='calendar';$('workspace').classList.remove('show-map');$('mobileCalendar').classList.add('active');$('mobileMap').classList.remove('active');renderEditReview();};$('mobileMap').onclick=()=>{ui.view='map';$('workspace').classList.add('show-map');$('mobileMap').classList.add('active');$('mobileCalendar').classList.remove('active');renderEditReview();setTimeout(()=>{if(!ui.hasShownMap){ui.hasShownMap=true;fitMap(state.view==='leg'?'leg':'journey');}else projectMap();},15);};
 document.addEventListener('pointermove',pointerMove);function autoScrollLoop(){if(ui.drag)maybeAutoScroll();requestAnimationFrame(autoScrollLoop);}requestAnimationFrame(autoScrollLoop);document.addEventListener('pointerup',pointerUp);document.addEventListener('pointercancel',e=>{ui.drag=null;mapState.panning=null;removeDragGhost();hideDragTooltip();renderAll();toast('Drag canceled; saved plan unchanged');});
 document.addEventListener('keydown',e=>{const editing=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName);if((e.ctrlKey||e.metaKey)&&!editing&&(e.key.toLowerCase()==='z')){e.preventDefault();e.shiftKey?redo():undo();}if((e.ctrlKey||e.metaKey)&&!editing&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}if(e.key==='Escape'){dismissQuickAdd();hideDragTooltip();for(const id of ['searchDrawer','versionsDrawer','legDrawer'])drawerClose(id);mapClosePopup();if(ui.drag){ui.drag=null;removeDragGhost();renderAll();}}});
 if('ResizeObserver' in window)new ResizeObserver(()=>projectMap()).observe($('mapViewport'));else window.addEventListener('resize',projectMap);
}
setupEvents();renderAll();renderSearchResults();fitMap('leg');
// A small public inspection API makes manual and automated smoke testing easier.
window.TravelCanvasDebug={getCalendarWeeks:()=>calendarWeeks(),intervalsForView,viewScope,pickStay,deleteJourneyPlan,deleteLegVersion,newBlankPlan,createLegFromForm,toggleLegLink,analyzeLegMove,attemptInsertStay,getState:()=>clone(state),getVisibleStays:()=>clone(visibleStays()),getPreview:()=>clone(ui.drag?.candidate||null),getDrag:()=>clone(ui.drag),getMap:()=>clone(mapState),analyzeEdit,computeOperation,applyOperation,toggleStayLink,hasStayLink,linkedComponent,moveStayToIdeas,undo,redo,reset:loadSample,fitMap};
})();
