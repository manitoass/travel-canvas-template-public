declare namespace JSX {interface Element {readonly type:unknown;readonly props:any;readonly key:any;} interface IntrinsicElements {[elem:string]:any} interface IntrinsicClassAttributes<T>{ref?:any} interface ElementChildrenAttribute {children:{}}}
declare namespace React {
 type ReactNode=any;
 interface SyntheticEvent<T=any>{target:T;currentTarget:T;preventDefault():void;stopPropagation():void;nativeEvent:any}
 interface MouseEvent<T=any> extends SyntheticEvent<T>{clientX:number;clientY:number;button:number;shiftKey:boolean}
 interface PointerEvent<T=any> extends MouseEvent<T>{pointerId:number;pointerType:string}
 interface ChangeEvent<T=any> extends SyntheticEvent<T>{}
 function createElement(type:any,props?:any,...children:any[]):any;
 function createRef<T>():{current:T|null};
 class Component<P={},S={}>{props:Readonly<P>;state:Readonly<S>;constructor(props:P);setState(state:Partial<S>|((prev:S,props:P)=>Partial<S>),cb?:()=>void):void;forceUpdate(cb?:()=>void):void;render():any;}
 class PureComponent<P={},S={}> extends Component<P,S>{}
}
declare const React:typeof React;
declare const ReactDOM:{render(element:any,container:Element):void;createRoot?:(container:Element)=>{render:(element:any)=>void}};
interface Window {TRAVEL_CANVAS_WORLD?:Array<Array<[number,number]>>;TravelCanvasDebug?:any;}
