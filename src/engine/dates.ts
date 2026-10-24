import type {ISODate,Stay} from './types';
const MS=86400000;
/** Exact v0.9 date-only semantics; no local timezone or DST arithmetic. */
export function epoch(iso:ISODate):number {const [y,m,d]=iso.split('-').map(Number);return Date.UTC(y,m-1,d)/MS;}
export function isoAt(n:number):ISODate {return new Date(n*MS).toISOString().slice(0,10);}
export function add(iso:ISODate,n:number):ISODate {return isoAt(epoch(iso)+n);}
export function days(a:ISODate,b:ISODate):number {return epoch(b)-epoch(a);}
export function minDate(...dates:(ISODate|undefined|null)[]):ISODate|null {return dates.filter(Boolean).sort()[0]||null;}
export function maxDate(...dates:(ISODate|undefined|null)[]):ISODate|null {return dates.filter(Boolean).sort().at(-1)||null;}
export function ordered(stays:Stay[]):Stay[] {return [...stays].sort((a,b)=>(a.start||'9999').localeCompare(b.start||'9999')||a.id.localeCompare(b.id));}
export function overlapPairs(stays:Stay[]):[string,string][] {
  const sorted=ordered(stays.filter(s=>s.start&&s.end)), conflicts:[string,string][]=[];
  for(let i=0;i<sorted.length;i++)for(let j=i+1;j<sorted.length;j++) {
    if(sorted[i].start<sorted[j].end&&sorted[j].start<sorted[i].end)conflicts.push([sorted[i].id,sorted[j].id]);
  }
  return conflicts;
}
