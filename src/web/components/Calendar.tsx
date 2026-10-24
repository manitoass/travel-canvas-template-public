import * as React from 'react';
import type {PlanningState,Stay} from '../../engine/types';
import {epoch,isoAt,overlapPairs} from '../../engine/dates';
import {hasStayLink} from '../../engine/links';
import {add,days,ordered,span,currentJourney,currentLeg,currentScenario,legBounds,STAY_COLORS,formatDate,MONTHS,WEEK} from '../model/state';
import {Icon} from './Icon';

// Browser globals shared by the calendar shell and world map.
// Keep these declarations available to the production TypeScript build.
declare global {
  interface Window {
    TravelCanvasDebug?: unknown;
    TRAVEL_CANVAS_WORLD?: Array<Array<[number, number]>>;
  }
}

type Interval={id:string;legId:string;kind:'stay'|'leg'|'placeholder'|'ghost';start:string;end:string;label:string;color:string;legColor:string;locked:boolean;muted:boolean;status:string;conflict:boolean;prev?:Stay;next?:Stay;linkBefore:boolean;linkAfter:boolean};
type Segment=Interval&{col:number;len:number;lane:number;isStart:boolean;isEnd:boolean};
const overlapped=(a:string,b:string,c:string,d:string)=>a<d&&c<b;
export function intervals(data:PlanningState):Interval[]{
 const legs=currentJourney(data).legs;
 if(data.view==='overview')return legs.map(l=>{const b=legBounds(l);return {id:l.id,legId:l.id,kind:'leg',start:b.start!,end:b.end!,label:l.title,color:String(l.color||'#5186c9'),legColor:String(l.color||'#5186c9'),locked:l.locked,muted:false,status:'placed',conflict:legs.some(other=>other.id!==l.id&&overlapped(b.start!,b.end!,legBounds(other).start!,legBounds(other).end!)),linkBefore:false,linkAfter:false};});
 const out:Interval[]=[];for(const leg of legs){const scenario=currentScenario(leg),route=ordered(scenario.stays.filter(s=>s.start&&s.end)),muted=data.view==='leg'&&leg.id!==data.selectedLegId,collisions=new Set(overlapPairs(route).flat());
 if(!route.length){const b=legBounds(leg);out.push({id:leg.id,legId:leg.id,kind:'placeholder',start:b.start!,end:b.end!,label:leg.title+' · add a destination',color:String(leg.color),legColor:String(leg.color),locked:leg.locked,muted,status:'tentative',conflict:false,linkBefore:false,linkAfter:false});}
 for(let i=0;i<route.length;i++){const s=route[i],prev=route[i-1],next=route[i+1];out.push({id:s.id,legId:leg.id,kind:'stay',start:s.start,end:s.end,label:s.place.name,color:s.color||STAY_COLORS[i%STAY_COLORS.length],legColor:String(leg.color),locked:s.locked||leg.locked,muted,status:s.status||'placed',conflict:collisions.has(s.id),prev,next,linkBefore:!!prev&&hasStayLink(s.id,prev.id,scenario),linkAfter:!!next&&hasStayLink(s.id,next.id,scenario)});}
 }return out;
}
export function calendarWeeks(data:PlanningState):string[]{const b=span(data),d0=new Date(`${b.start.slice(0,7)}-01T00:00:00Z`);d0.setUTCMonth(d0.getUTCMonth()-1);const d1=new Date(`${b.end.slice(0,7)}-01T00:00:00Z`);d1.setUTCMonth(d1.getUTCMonth()+3);let first=isoAt(d0.getTime()/86400000),to=isoAt(d1.getTime()/86400000);first=add(first,-(d0.getUTCDay()+6)%7);const weeks: string[]=[];for(let d=first;d<to&&weeks.length<190;d=add(d,7))weeks.push(d);return weeks;}
function segmentsForWeek(intervals:Interval[],start:string):Segment[]{const finish=add(start,7),segs:Segment[]=[],laneEnds:number[]=[];
 for(const it of intervals){const s=it.start>start?it.start:start,e=it.end<finish?it.end:finish;if(s>=e)continue;
 const col=days(start,s),len=days(s,e);let lane=laneEnds.findIndex(n=>n<=col);if(lane<0){lane=laneEnds.length;laneEnds.push(0);}laneEnds[lane]=col+len;segs.push({...it,col,len,lane,isStart:s===it.start,isEnd:e===it.end});}
 return segs;
}
export type CalendarProps={data:PlanningState;selectedLegId:string;selectedStayId?:string|null;ghostRange?:{start:string;end:string}|null;previewChanged?:string[];blocked?:boolean;
 onBarDown:(e:PointerEvent,bar:HTMLElement)=>void;onCellDown:(e:PointerEvent,date:string)=>void;onLink:(a:string,b:string)=>void;onLock:(kind:'stay'|'leg',id:string,legId:string)=>void;onSelect:(id:string,legId:string,kind:string)=>void;onDropDate?:(date:string)=>void;scrolldate?:string|null};
export class Calendar extends React.PureComponent<CalendarProps,{month:string}>{
 scrollRef:{current:HTMLDivElement|null}={current:null};rootRef:{current:HTMLDivElement|null}={current:null};
 constructor(p:CalendarProps){super(p);this.state={month:''};}
 componentDidMount(){this.rootRef.current?.addEventListener('pointerdown',this.pointerDown);this.positionToLeg();this.sticky();}
 componentWillUnmount(){this.rootRef.current?.removeEventListener('pointerdown',this.pointerDown);}
 componentDidUpdate(prev:CalendarProps){if(prev.scrolldate!==this.props.scrolldate&&this.props.scrolldate)this.positionToLeg();else if(prev.selectedLegId!==this.props.selectedLegId&&!this.props.scrolldate)this.positionToLeg();}
 positionToLeg(){const focus=this.props.scrolldate||legBounds(currentLeg(this.props.data)).start||span(this.props.data).start;const rows=this.rootRef.current?.querySelectorAll<HTMLElement>('.week-row')||[];let target:HTMLElement|undefined;for(const row of Array.from(rows)){const d=row.dataset.weekStart||'';if(d<=focus&&add(d,7)>focus){target=row;break;}}
 if(this.scrollRef.current&&target)this.scrollRef.current.scrollTop=Math.max(0,target.offsetTop-(this.rootRef.current?.offsetTop||0)-88);this.sticky();}
 sticky=()=>{const s=this.scrollRef.current;if(!s)return;const top=s.getBoundingClientRect().top+60;const rows=this.rootRef.current?.querySelectorAll<HTMLElement>('.week-row')||[];let hit:HTMLElement|undefined;for(const row of Array.from(rows)){if(row.getBoundingClientRect().bottom>top){hit=row;break;}}const d=hit?.dataset.weekStart;if(d){const mid=add(d,3);const title=MONTHS[Number(mid.slice(5,7))-1]+' '+mid.slice(0,4);if(title!==this.state.month)this.setState({month:title});}};
 pointerDown=(e:PointerEvent)=>{if(e.button!==0&&e.pointerType==='mouse')return;const target=e.target as HTMLElement;
 if(target.closest('button.bar-link-toggle,button.bar-lock-toggle'))return;
 const bar=target.closest<HTMLElement>('.calendar-bar');if(bar){this.props.onBarDown(e,bar);return;}
 const cell=target.closest<HTMLElement>('.day-cell');if(cell?.dataset.date&&this.props.data.view==='leg')this.props.onCellDown(e,cell.dataset.date);
 };
 render(){const p=this.props,weeks=calendarWeeks(p.data),its=intervals(p.data),sel=p.selectedStayId,selectedLeg=p.selectedLegId;
 if(p.ghostRange)its.push({id:'ghost-new',legId:selectedLeg,kind:'ghost',label:'New destination',color:'#67a5bc',legColor:'#67a5bc',start:p.ghostRange.start,end:p.ghostRange.end,locked:false,muted:false,status:'tentative',conflict:false,linkBefore:false,linkAfter:false});
 return <div className="calendar-scroll" ref={(v:any)=>{this.scrollRef.current=v;}} onScroll={this.sticky}><div ref={(v:any)=>{this.rootRef.current=v;}} className="continuous-calendar" data-testid="react-calendar">
  <div className="continuous-header"><div className="continuous-heading"><span className="eyebrow">CONTINUOUS CALENDAR</span><strong>{this.state.month||MONTHS[Number(span(p.data).start.slice(5,7))-1]}</strong><span className="stream-hint">Drag stays to move or resize · drag empty dates to add</span><span className="touch-edit-hint">Swipe to scroll · hold a stay to drag or resize</span></div><div className="weekday-header">{WEEK.map((d,i)=><span key={d} className={i>=5?'weekend':''}>{d}</span>)}</div></div>
  <div className="calendar-stream">{weeks.map(ws=>{const weekSegments=segmentsForWeek(its,ws);const maxLane=Math.max(0,...weekSegments.map(seg=>seg.lane));
   const tallRow=maxLane>=2?{height:`calc(var(--stay-top) + ${maxLane*25+34}px)`,minHeight:`calc(var(--stay-top) + ${maxLane*25+34}px)`}:undefined;
   return <div className="week-row" data-week-start={ws} key={ws} style={tallRow}>
    {Array.from({length:7},(_,i)=>{const dt=add(ws,i),number=Number(dt.slice(-2));return <div key={dt} data-date={dt} className={'day-cell '+(i>=5?'weekend ':'')+(number===1?'month-start ':'')} title={formatDate(dt,true)}><span className="day-date-label"><span className="today-number">{number}</span>{number===1?<span className="month-start-label">{MONTHS[Number(dt.slice(5,7))-1].slice(0,3).toUpperCase()}</span>:null}</span></div>})}
    {weekSegments.map(seg=>{const narrow=seg.len<2,active=seg.kind==='stay'&&!seg.muted&&p.data.view==='leg';const canBefore=active&&seg.isStart&&seg.prev,canAfter=active&&seg.isEnd&&seg.next;
    const selected=seg.id===sel&&seg.legId===selectedLeg||seg.kind!=='stay'&&seg.legId===selectedLeg;
    const startsSunday=new Date(epoch(seg.start)*86400000).getUTCDay()===0;const label=(seg.isStart||startsSunday)?seg.label:seg.len>=3?seg.label+' · continued':seg.label;
    if(seg.kind==='ghost')return <div key={'ghost-'+ws} className="range-ghost start end" style={{left:`calc(${seg.col*100/7}% + 1px)`,width:`calc(${seg.len*100/7}% - 2px)`,top:`calc(var(--stay-top) + ${seg.lane*25}px)`}}>{seg.isStart?'New destination · '+days(seg.start,seg.end)+' nights':''}</div>;
    return <div key={seg.id+'-'+ws} role="button" tabIndex={0} data-kind={seg.kind==='placeholder'?'leg-placeholder':seg.kind} data-object-id={seg.id} data-leg-id={seg.legId}
      aria-label={seg.label+' '+formatDate(seg.start)+' to '+formatDate(seg.end)} title={`${seg.label} · ${formatDate(seg.start)}–${formatDate(seg.end)} · ${days(seg.start,seg.end)} nights`}
      onClick={()=>p.onSelect(seg.id,seg.legId,seg.kind)} onKeyDown={(e:any)=>{if(e.key==='Enter')p.onSelect(seg.id,seg.legId,seg.kind)}}
      className={['calendar-bar',seg.isStart?'start':'',seg.isEnd?'end':'',narrow?'short-segment':'',seg.len===2?'two-day-segment':'',seg.muted?'inactive-leg':'',seg.kind==='placeholder'?'empty-leg':'',selected?'selected':'',seg.locked?'locked':'',seg.status==='tentative'?'tentative':'',seg.conflict||p.blocked&&p.previewChanged?.includes(seg.id)?'conflict':'',p.previewChanged?.includes(seg.id)?'preview':''].filter(Boolean).join(' ')}
      style={{left:`calc(${seg.col*100/7}% + 2px)`,width:`calc(${seg.len*100/7}% - 4px)`,top:`calc(var(--stay-top) + ${seg.lane*25}px)`,background:seg.color,'--leg-accent':seg.legColor} as any}>
      {seg.isStart&&active?<span className="bar-handle left" data-handle="left" title="Resize arrival"/>:null}
      <span className="bar-label">{narrow&&!seg.isEnd?'':seg.conflict?'⚠ '+label:label}{narrow?'':<span className="bar-subtitle"> · {days(seg.start,seg.end)}n</span>}</span>
      {canBefore?<button type="button" className={'bar-link-toggle before '+(seg.linkBefore?'is-linked':'')} aria-label={'Link before '+seg.label} title={'Link before: '+seg.prev?.place.name} onPointerDown={(e:any)=>e.stopPropagation()} onClick={(e:any)=>{e.stopPropagation();p.onLink(seg.prev!.id,seg.id)}}><Icon name={seg.linkBefore?'link':'unlink'}/></button>:null}
      {canAfter?<button type="button" className={'bar-link-toggle after '+(seg.linkAfter?'is-linked':'')} aria-label={'Link after '+seg.label} title={'Link after: '+seg.next?.place.name} onPointerDown={(e:any)=>e.stopPropagation()} onClick={(e:any)=>{e.stopPropagation();p.onLink(seg.id,seg.next!.id)}}><Icon name={seg.linkAfter?'link':'unlink'}/></button>:null}
      {(active||seg.kind==='leg')?<button type="button" className={'bar-lock-toggle '+(seg.locked?'is-locked':'')} aria-label={(seg.locked?'Unlock ':'Lock ')+seg.label} onPointerDown={(e:any)=>e.stopPropagation()} onClick={(e:any)=>{e.stopPropagation();p.onLock(seg.kind==='leg'?'leg':'stay',seg.id,seg.legId)}}><Icon name={seg.locked?'lock':'unlock'}/></button>:null}
      {seg.isEnd&&active?<span className="bar-handle right" data-handle="right" title="Resize departure"/>:null}
    </div>})}
   </div>;})}</div>
  </div></div>;
 }
}
