import * as React from 'react';
import type {Idea} from '../../engine/types';
import {Icon} from './Icon';
export class IdeasTray extends React.PureComponent<{ideas:Idea[];onIdeaDown:(e:PointerEvent,id:string)=>void;onSchedule:(id:string)=>void;onNew:()=>void;dropTarget:boolean},{collapsed:boolean}>{
 root:{current:HTMLDivElement|null}={current:null};constructor(p:any){super(p);this.state={collapsed:false}}
 componentDidMount(){this.root.current?.addEventListener('pointerdown',this.onPointerDown)}
 componentWillUnmount(){this.root.current?.removeEventListener('pointerdown',this.onPointerDown)}
 onPointerDown=(e:PointerEvent)=>{const button=(e.target as HTMLElement).closest<HTMLElement>('[data-idea-id]');if(button)this.props.onIdeaDown(e,button.dataset.ideaId!)};
 render(){return <div ref={(v:any)=>{this.root.current=v;}} className={'ideas-tray '+(this.state.collapsed?'collapsed ':'')+(this.props.dropTarget?'drop-target':'')}><div className="ideas-head"><div className="ideas-title"><Icon name="lightbulb"/><span>Unscheduled ideas</span><span className="ideas-count">{this.props.ideas.length}</span></div><div className="ideas-actions"><button className="quiet-link" onClick={this.props.onNew}>+ Add idea</button><button className="icon-button mini" onClick={()=>this.setState({collapsed:!this.state.collapsed})} title="Expand / collapse ideas"><Icon name="chevron"/></button></div></div>{!this.state.collapsed?<div className="idea-cards">{this.props.ideas.length?this.props.ideas.map(idea=><button className="idea-pill" data-idea-id={idea.id} key={idea.id} title="Drag onto calendar to schedule, or click to schedule at end" onClick={()=>this.props.onSchedule(idea.id)}><Icon name="pin"/>{idea.place.name}{idea.nightsTarget?<span className="idea-nights">{idea.nightsTarget}n</span>:null}<Icon name="menu"/></button>):<span className="ideas-empty">No unscheduled ideas. Save a place from search or the map.</span>}</div>:null}</div>}
}
