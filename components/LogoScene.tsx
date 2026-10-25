'use client';
import React,{useEffect,useRef,useState} from 'react';
import {LOGO_SCENE_DURATION,LOGO_SCENE_INTERVAL,LOGO_SCENE_REST,logoSceneFrame,logoSceneGeometry} from '../lib/logo-animation';

const SPRITES=['/media/cleaning-kitten-logo-choreography-v4.png','/media/cleaning-kitten-logo-heart.png','/media/cleaning-kitten-logo-tools-v4.png'];
/** Animate the existing brand DOM: the font, symbol, accessible name and link stay intact. */
export default function LogoScene({children,enabled=true}:{children:React.ReactNode;enabled?:boolean}){
 const root=useRef<HTMLSpanElement>(null),ink=useRef<HTMLSpanElement>(null),cat=useRef<HTMLSpanElement>(null),props=useRef<HTMLSpanElement>(null);
 const [paused,setPaused]=useState(false);
 const stop=useRef(()=>{});
 useEffect(()=>{
  if(!enabled||paused||!root.current||!ink.current||!cat.current||!props.current)return;
  const host=root.current,original=ink.current,actor=cat.current,equipment=props.current;
  const header=host.closest<HTMLElement>('.public-header');
  const calculator=header?.querySelector<HTMLElement>('.bw-header-calc');
  // The scene belongs to this real button, never to a guessed screen edge.
  if(!header||!calculator)return;
  const body=actor.firstElementChild as HTMLElement;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let ready=false,visible=false,running=false,disposed=false;
  let raf=0,delay:ReturnType<typeof setTimeout>|undefined,inkWidth=0,catWidth=0,baseY=0,gate={left:0,y:0};
  const measure=()=>{
   const origin=host.getBoundingClientRect(),button=calculator.getBoundingClientRect();
   inkWidth=original.getBoundingClientRect().width;catWidth=actor.offsetWidth;baseY=origin.height/2;
   gate={left:button.left-origin.left,y:button.top+button.height/2-origin.top-baseY-.07*actor.offsetHeight};
  };
  measure();
  const resize=new ResizeObserver(measure);[original,actor,header,calculator].forEach(el=>resize.observe(el));
  window.addEventListener('resize',measure);
  const restore=()=>{
   cancelAnimationFrame(raf);running=false;
   original.style.removeProperty('clip-path');
   actor.style.opacity='0';actor.style.removeProperty('clip-path');equipment.style.opacity='0';host.dataset.phase='idle';
  };
  const start=()=>{
   if(disposed||!ready||!visible||running||motion.matches||document.hidden||original.contains(document.activeElement))return;
   running=true;measure();
   const started=performance.now();
   const tick=(now:number)=>{
    if(disposed||!visible||document.hidden||motion.matches){restore();return}
    const elapsed=now-started;
    if(elapsed>=LOGO_SCENE_DURATION){restore();return}
    const frame=logoSceneFrame(elapsed);
    if(frame.phase==='enter'||frame.phase==='exit')measure();
    const geometry=logoSceneGeometry(frame,inkWidth,catWidth,gate);
    host.dataset.phase=frame.phase;
    original.style.clipPath=frame.clip;
    actor.style.left=geometry.actorLeft+'px';
    actor.style.top=(baseY+geometry.actorY)+'px';
    actor.style.clipPath=geometry.actorClip;
    actor.style.opacity=String(frame.opacity);
    actor.style.setProperty('--logo-tool-y',frame.y+'px');
    actor.dataset.sheet=frame.sheet;
    body.style.backgroundPosition=(frame.sprite%4)/3*100+'% '+(frame.sheet==='heart'?0:Math.floor(frame.sprite/4)*100)+'%';
    body.style.transform=geometry.mirror?'scaleX(-1)':'none';
    equipment.style.left=geometry.propsLeft+'px';
    equipment.style.width=geometry.propsWidth+'px';
    equipment.style.opacity=String(frame.propsOpacity);
    raf=requestAnimationFrame(tick);
   };
   raf=requestAnimationFrame(tick);
  };
  const cancelSchedule=()=>{if(delay)clearTimeout(delay);delay=undefined};
  const schedule=(wait=1400)=>{
   cancelSchedule();
   if(!disposed&&ready&&visible&&!motion.matches&&!document.hidden)
    delay=setTimeout(()=>{start();schedule(LOGO_SCENE_INTERVAL)},wait);
  };
  const observer=new IntersectionObserver(([entry])=>{
   visible=entry.isIntersecting&&entry.intersectionRatio>=.9;
   if(visible)schedule();else{cancelSchedule();restore()}
  },{threshold:.9});
  observer.observe(host);
  const sprites=SPRITES.map(()=>new Image());
  void Promise.all(sprites.map((sprite,index)=>new Promise<void>((resolve,reject)=>{
   sprite.onload=()=>resolve();sprite.onerror=()=>reject(new Error('Logo sprite unavailable'));sprite.src=SPRITES[index];
  }))).then(()=>document.fonts.ready).then(()=>{if(!disposed){ready=true;measure();schedule()}}).catch(()=>{if(!disposed)restore()});
  const onVisibility=()=>{if(document.hidden){cancelSchedule();restore()}else schedule()};
  const onMotion=()=>{if(motion.matches){cancelSchedule();restore()}else schedule()};
  document.addEventListener('visibilitychange',onVisibility);motion.addEventListener('change',onMotion);
  stop.current=()=>{cancelSchedule();restore();schedule(LOGO_SCENE_REST)};
  return()=>{disposed=true;cancelSchedule();restore();resize.disconnect();observer.disconnect();window.removeEventListener('resize',measure);sprites.forEach(sprite=>{sprite.onload=null;sprite.onerror=null});document.removeEventListener('visibilitychange',onVisibility);motion.removeEventListener('change',onMotion);stop.current=()=>{}};
 },[enabled,paused]);
 if(!enabled)return <>{children}</>;
 return <span ref={root} className="bw-logo-scene" data-phase="idle">
  <span ref={ink} className="bw-logo-original" onFocus={()=>stop.current()} onClick={()=>stop.current()}>{children}</span>
  <span ref={props} className="bw-logo-equipment" aria-hidden="true"/>
  <span ref={cat} className="bw-logo-cat" data-sheet="actions" aria-hidden="true"><span/></span>
  <button type="button" className="bw-logo-motion-toggle" aria-label={paused?'Включить анимацию котика у логотипа':'Приостановить анимацию котика у логотипа'} title={paused?'Включить анимацию':'Пауза анимации'} aria-pressed={paused} onClick={()=>setPaused(value=>!value)}><span aria-hidden="true">{paused?'▷':'Ⅱ'}</span></button>
 </span>;
}
