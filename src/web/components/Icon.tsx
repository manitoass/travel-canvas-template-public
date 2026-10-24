import * as React from 'react';
export function Icon(props:{name:string;size?:number;className?:string}){return <svg className={props.className} aria-hidden="true" width={props.size||16} height={props.size||16}><use href={'#i-'+props.name}/></svg>}
