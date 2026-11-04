'use client';
import {useEffect,useRef,useState} from 'react';

const extrasScenes=[
 {name:'window',src:'/media/extras-pencil-window.webp'},
 {name:'fridge',src:'/media/extras-pencil-fridge.webp'},
 {name:'mirror',src:'/media/extras-pencil-mirror.webp'},
] as const;

const pencilTrace=Array.from({length:8},(_,index)=>{
 const y=30+index*60;
 const forward=index%2===0;
 const curve=`C${forward?170:470} ${y-8} ${forward?470:170} ${y+8} ${forward?640:0} ${y}`;
 return `${index===0?'M0 30 ':''}${curve}${index<7?` L${forward?640:0} ${y+60} `:''}`;
}).join('');

function RevealMask({id}:{id:string}){
 return <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="640" height="480">
  <path className="bw-pencil-trace" d={pencilTrace} fill="none" stroke="white" strokeWidth="72" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1" pathLength={1}/>
  <rect className="bw-pencil-finish" x="0" y="0" width="640" height="480" fill="white"/>
 </mask>;
}

export default function PencilVignette({kind}:{kind:'extras'|'academy'}){
 const ref=useRef<HTMLDivElement>(null);
 const [visible,setVisible]=useState(false);
 const [sceneState,setSceneState]=useState({index:0,token:0});
 useEffect(()=>{const element=ref.current;if(!element)return;const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting),{threshold:.1});observer.observe(element);return()=>observer.disconnect()},[]);
 useEffect(()=>{if(!visible||kind!=='extras')return;setSceneState(state=>({index:0,token:state.token+1}));const timer=window.setInterval(()=>setSceneState(state=>({index:(state.index+1)%extrasScenes.length,token:state.token+1})),20000);return()=>window.clearInterval(timer)},[kind,visible]);
 if(kind==='academy')return <div ref={ref} className={`bw-pencil-vignette bw-pencil-academy${visible?' is-visible':''}`} aria-hidden="true"><svg viewBox="0 0 640 480" role="presentation"><defs><RevealMask id="bw-academy-pencil-mask"/></defs><image href="/media/academy-pencil-cap-book.webp" width="640" height="480" mask="url(#bw-academy-pencil-mask)"/></svg></div>;
 return <div ref={ref} className={`bw-pencil-vignette bw-pencil-extras${visible?' is-visible':''}`} aria-hidden="true"><svg viewBox="0 0 640 480" role="presentation">
  <defs><RevealMask key={sceneState.token} id={`bw-extras-pencil-mask-${sceneState.token}`}/></defs>
  <g key={sceneState.token} className="bw-pencil-scene"><image href={extrasScenes[sceneState.index].src} width="640" height="480" mask={`url(#bw-extras-pencil-mask-${sceneState.token})`}/></g>
 </svg>
 </div>;
}
