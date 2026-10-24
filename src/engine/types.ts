/** Portable V1 domain types based on the immutable v0.9 JSON state shape.
 * Dates are local calendar dates YYYY-MM-DD; stay departure is exclusive.
 */
export type ISODate = string;
export interface Place {
  id: string;
  name: string;
  country?: string;
  lat?: number;
  lon?: number;
  flag?: string;
  [key: string]: unknown;
}
export interface Stay {
  id: string;
  place: Place;
  start: ISODate;
  end: ISODate;
  locked: boolean;
  status?: string;
  color?: string;
  linkNextId?: string | null; // Legacy input only: v0.7+ uses stayLinks edges
  [key: string]: unknown;
}
export interface StayLink {a: string; b: string;}
export interface Idea {
  id: string;
  sourceStayId?: string;
  place: Place;
  color?: string;
  nightsTarget?: number;
  lastDates?: {start: ISODate; end: ISODate};
  status?: string;
  [key: string]: unknown;
}
export interface LegScenario {
  id: string;
  name: string;
  start?: ISODate;
  end?: ISODate;
  stays: Stay[];
  ideas: Idea[];
  stayLinks: StayLink[];
  connections?: Record<string, unknown>;
  [key: string]: unknown;
}
export interface Leg {
  id: string;
  title: string;
  start: ISODate;
  end: ISODate;
  locked: boolean;
  linkNextId?: string | null;
  activeScenarioId: string;
  scenarios: LegScenario[];
  [key: string]: unknown;
}
export interface Journey {
  id: string;
  name: string;
  title?: string;
  legs: Leg[];
  [key: string]: unknown;
}
export interface PlanningState {
  title?: string;
  view?: string;
  selectedLegId: string;
  selectedStayId?: string | null;
  activeJourneyVersionId: string;
  journeyVersions: Journey[];
  [key: string]: unknown;
}
export type EditMode = 'move' | 'left' | 'right';
export type PlanningOperation =
  | {kind:'stay'; id:string; mode:EditMode; delta:number}
  | {kind:'leg'; id:string; delta:number};

export interface InvalidResult { valid:false; reason:string; }
export interface StayEditResult {
  valid:true;
  stays:Stay[];
  changedIds:string[];
  shiftCount:number;
  conflicts:[string,string][];
  isDifferent:boolean;
  mode:EditMode;
  delta:number;
  blocked?:string[];
}
export interface LegEditResult {
  valid:true;
  legs:Leg[];
  changedIds:string[];
  blocked:string[];
  conflicts:[string,string][];
  isDifferent:boolean;
}
export type StayPreview = InvalidResult | StayEditResult;
export type LegPreview = InvalidResult | LegEditResult;
export type ComputedOperation = InvalidResult |
  (StayEditResult & {kind:'stay'; legId:string; followers:LegPreview|null; linkedDelta:number}) |
  (LegEditResult & {kind:'leg'});
export type ApplyResult = {valid:false; reason:string; state:PlanningState} |
  {valid:true; changed:boolean; state:PlanningState; result:Exclude<ComputedOperation,InvalidResult>};
