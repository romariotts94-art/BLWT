'use client';
import React,{useEffect,useRef,useState} from 'react';
import {Coins,Pause,Play,X} from 'lucide-react';
import {catAppearance,catPose,clickRoom,gamePlaces,newCleaningGame,tickCleaningGame,type Point} from '../lib/cleaning-game';

const ASSETS=['/media/cleaning-game-room-v2.webp','/media/cleaning-game-objects-v2.webp','/media/cleaning-game-cat-v2.webp','/media/cleaning-game-cat-explore-v3.webp','/media/cleaning-game-cat-milk-v3.webp'];
function ObjectSprite({task,className=''}:{task:number;className?:string}){
 return <span className={'cg-object-sprite '+className} style={{backgroundPosition:task%3*50+'% '+Math.floor(task/3)*100+'%'}}/>;
}
export default function CleaningGame({open,onClose}:{open:boolean;onClose:()=>void}){
 const [game,setGame]=useState(newCleaningGame);
 const [assets,setAssets]=useState<'loading'|'ready'|'error'>('loading'),[retry,setRetry]=useState(0);
 const [aim,setAim]=useState<Point>({x:50,y:70}),[keyboard,setKeyboard]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null),viewport=useRef<HTMLDivElement>(null),board=useRef<HTMLDivElement>(null),feedbackTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const [feedback,setFeedback]=useState('');
 const followCat=useRef(false),press=useRef<{x:number;y:number;moved:boolean}|null>(null);
 useEffect(()=>()=>{if(feedbackTimer.current)clearTimeout(feedbackTimer.current)},[]);
 const playing=game.status==='playing',pose=catPose(game),appearance=catAppearance(game);
 const held=game.items.find(item=>item.id===game.heldId);
 const photoReady=assets==='ready';
 useEffect(()=>{
  if(!open)return;
  let cancelled=false;setAssets('loading');
  Promise.all(ASSETS.map(src=>new Promise<void>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve();img.onerror=()=>reject();img.src=src})))
   .then(()=>{if(!cancelled)setAssets('ready')}).catch(()=>{if(!cancelled)setAssets('error')});
  return()=>{cancelled=true};
 },[open,retry]);
 useEffect(()=>{
  if(!open||!dialog.current)return;
  const el=dialog.current,previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
  el.showModal();document.body.style.overflow='hidden';
  return()=>{el.close();document.body.style.overflow=overflow;previous?.focus()};
 },[open]);
 useEffect(()=>{
  if(!open||!playing||!game.job||!photoReady)return;
  let frame=0,previous=performance.now();
  const tick=(now:number)=>{const delta=Math.min(100,now-previous);previous=now;setGame(g=>tickCleaningGame(g,delta));frame=requestAnimationFrame(tick)};
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
 },[open,playing,!!game.job,photoReady]);
 useEffect(()=>{
  const pause=()=>{if(document.hidden)setGame(g=>g.status==='playing'?{...g,status:'paused'}:g)};
  document.addEventListener('visibilitychange',pause);return()=>document.removeEventListener('visibilitychange',pause);
 },[]);
 useEffect(()=>{
  if(!open||!photoReady)return;
  if(playing)board.current?.focus({preventScroll:true});
  else dialog.current?.querySelector<HTMLButtonElement>('.cg-card button, .cg-reward button')?.focus({preventScroll:true});
 },[open,game.status,photoReady]);
 useEffect(()=>{
  const el=viewport.current;
  if(!playing||!game.job||!followCat.current||!el||el.scrollWidth<=el.clientWidth)return;
  const catX=pose.x/100*el.scrollWidth,relative=catX-el.scrollLeft;
  if(relative<el.clientWidth*.25||relative>el.clientWidth*.75){
   const target=Math.max(0,Math.min(el.scrollWidth-el.clientWidth,catX-el.clientWidth*.5));
   el.scrollLeft+=(target-el.scrollLeft)*.16;
  }
 },[pose.x,playing,!!game.job]);
 const close=()=>{setGame(g=>g.status==='playing'?{...g,status:'paused'}:g);onClose()};
 const start=()=>{setGame({...newCleaningGame(),status:'playing'});setKeyboard(false);if(viewport.current)viewport.current.scrollLeft=0};
 const go=(point:Point)=>{if(!photoReady)return;followCat.current=true;const item=game.items.find(v=>v.id===game.heldId),place=gamePlaces.findIndex(v=>point.x>=v.bounds[0]&&point.x<=v.bounds[2]&&point.y>=v.bounds[1]&&point.y<=v.bounds[3]);if(item&&place>=0&&place!==item.task){setFeedback('Это не то место. Найди место!');if(feedbackTimer.current)clearTimeout(feedbackTimer.current);feedbackTimer.current=setTimeout(()=>setFeedback(''),2400)}else if(place>=0){setFeedback('');if(feedbackTimer.current)clearTimeout(feedbackTimer.current)}setGame(g=>clickRoom(g,point))};
 const click=(event:React.MouseEvent<HTMLDivElement>)=>{
  if(!playing||!board.current||press.current?.moved)return;
  const rect=board.current.getBoundingClientRect();
  setKeyboard(false);go({x:(event.clientX-rect.left)/rect.width*100,y:(event.clientY-rect.top)/rect.height*100});
 };
 const key=(event:React.KeyboardEvent<HTMLDivElement>)=>{
  if(!playing)return;
  if(event.key==='Enter'||event.key===' '){event.preventDefault();go(aim);return}
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
  event.preventDefault();setKeyboard(true);followCat.current=false;
  const next={x:Math.max(2,Math.min(98,aim.x+(event.key==='ArrowRight'?3:event.key==='ArrowLeft'?-3:0))),y:Math.max(2,Math.min(98,aim.y+(event.key==='ArrowDown'?3:event.key==='ArrowUp'?-3:0)))};
  setAim(next);
  const el=viewport.current;if(el)el.scrollLeft=next.x/100*el.scrollWidth-el.clientWidth/2;
 };
 const expr=appearance.sheet==='expressions';
 const spriteStyle={backgroundPosition:(appearance.frame%4)/3*100+'% '+(expr?Math.floor(appearance.frame/4)*100:0)+'%'};
 const overlay=!photoReady||game.status==='intro'||game.status==='paused';
 return <>
  <dialog ref={dialog} className="cg-dialog" aria-labelledby="cleaning-game-title" onCancel={event=>{event.preventDefault();close()}}>
   <div className="cg-heading"><div><span className="cg-kicker">BLACK & WHITE · УРОВЕНЬ 01</span><h2 id="cleaning-game-title">Уют — дело лап.</h2></div><div className="cg-window-controls"><span className="cg-earnings" aria-live="polite"><Coins size={17}/>{game.items.filter(item=>item.done).length*100} BW</span><button className="cg-icon-button" disabled={!playing} onClick={()=>setGame(g=>({...g,status:'paused'}))} aria-label="Пауза"><Pause size={17}/></button><button className="cg-icon-button" aria-label="Закрыть игру" onClick={close}><X size={20}/></button></div></div>
   <div className={'cg-scene'+(!playing?' is-paused':'')+(game.status==='won'?' is-won':'')}>
    <div className="cg-viewport" ref={viewport} onPointerDown={()=>{followCat.current=false}} onWheel={()=>{followCat.current=false}}>
     <div className="cg-board" ref={board} tabIndex={playing?0:-1} role="application" aria-label="Комната для игры" aria-describedby="cg-keyboard-controls" onClick={click} onKeyDown={key} onPointerDown={e=>{press.current={x:e.clientX,y:e.clientY,moved:false}}} onPointerMove={e=>{if(press.current&&Math.hypot(e.clientX-press.current.x,e.clientY-press.current.y)>8)press.current.moved=true}} onPointerCancel={()=>{if(press.current)press.current.moved=true}}>
      <img className="cg-room-photo" src={ASSETS[0]} loading="lazy" alt="Светлая гостиная с мебелью и разбросанными вещами." draggable={false}/>
      {game.items.filter(item=>item.done).map(item=>{
       const place=gamePlaces[item.task];
       return <span key={item.id} className={'cg-stored cg-stored-'+item.task} style={{left:(place.putX+item.id%2*3)+'%',top:(place.putY+item.id%2*.6)+'%'}} aria-hidden="true"><ObjectSprite task={item.task}/></span>;
      })}
      {game.items.filter(item=>!item.done&&item.id!==game.heldId).map(item=><span key={item.id} className={'cg-item'+(game.job?.itemId===item.id&&pose.phase==='pickup'?' is-picking':'')} style={{left:item.x+'%',top:item.y+'%',zIndex:Math.round(item.y),'--item-angle':item.angle+'deg'} as React.CSSProperties} aria-hidden="true"><ObjectSprite task={item.task}/></span>)}
      <div className={'cg-cat is-'+pose.phase+' sheet-'+appearance.sheet+(appearance.mirror?' faces-right':'')+(held?' has-item':'')} style={{left:pose.x+'%',top:pose.y+'%',zIndex:Math.round(pose.y)+1}} aria-hidden="true">
       <div className="cg-cat-motion"><div className="cg-cat-body" style={spriteStyle}>
        {held&&pose.direction!=='back'&&<ObjectSprite task={held.task} className={'cg-carried'+(appearance.sheet==='walk'?' at-side':'')}/>}
       </div></div>
      </div>
      {feedback&&<div className="cg-misplaced" role="status" aria-live="polite">{feedback}</div>}
      {keyboard&&playing&&<span className="cg-keyboard-aim" style={{left:aim.x+'%',top:aim.y+'%'}} aria-hidden="true"/>}
     </div>
    </div>
    {overlay&&<div className="cg-overlay"><div className="cg-card">
     {assets==='error'?<><h3>Комната не загрузилась</h3><button className="cg-primary" onClick={()=>setRetry(v=>v+1)}>Попробовать ещё</button></>:assets==='loading'?<><h3>Открываем комнату…</h3><p role="status">Ещё немного.</p></>:game.status==='intro'?<><h3>Правила игры</h3><p>Помоги котику убрать комнату. За каждую правильно выполненную задачу он получает 100 игровых монет — до 1 200 за уровень.</p><ol className="cg-rules"><li>Нажми на вещь — котик подойдёт и подберёт её.</li><li>Нажми на место, где, по-твоему, ей будет уютно.</li><li>Если место не подойдёт, котик сохранит вещь. Попробуй другое.</li><li>Собери все 12 вещей. Подсказок и отметок на поле нет.</li></ol><p className="cg-control-hint">На телефоне нажимай на поле и двигай его пальцем. На клавиатуре используй стрелки и Enter.</p><button className="cg-primary" onClick={start}>Начать</button></>:<><h3>Перерыв на мурр</h3><button className="cg-primary" onClick={()=>setGame(g=>({...g,status:'playing'}))}><Play size={16}/> Продолжить</button><button className="cg-text-button" onClick={start}>Начать заново</button></>}
    </div></div>}
   </div>
   {game.status==='won'&&<div className="cg-reward"><div><span className="cg-kicker">ЗАРПЛАТА ПОЛУЧЕНА</span><h3>За хорошую работу — молочко.</h3><p>Котик заработал {game.items.filter(item=>item.done).length*100} игровых BW-монет — по 100 за каждое задание. Это награда внутри игры.</p></div><button className="cg-primary" onClick={start}>Сыграть ещё</button></div>}
   <p id="cg-keyboard-controls" className="cg-sr-only">Нажмите на любую точку комнаты. С клавиатуры: стрелки перемещают указатель, Enter отправляет туда котика. На телефоне комнату можно сдвигать пальцем.</p>
   <span className="cg-sr-only" role="status" aria-live="polite">{game.status==='won'?'Уровень пройден. Котик получил молочко.':pose.phase==='cheer'?'Котик радуется!':pose.phase==='idle'&&held?'Котик держит вещь.':''}</span>
  </dialog>
 </>;
}
