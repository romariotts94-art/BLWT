'use client';
import React,{useEffect,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,X} from 'lucide-react';

export default function PhotoViewer({photos,startIndex,onClose}:{photos:{url:string,name?:string}[],startIndex:number,onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [index,setIndex]=useState(Math.min(startIndex,photos.length-1));
 const swipeStart=useRef<number|null>(null);
 const move=(step:number)=>setIndex(current=>(current+step+photos.length)%photos.length);
 useEffect(()=>{
  const node=dialog.current,previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
  node?.showModal();document.body.style.overflow='hidden';
  return()=>{node?.close();document.body.style.overflow=overflow;previous?.focus()};
 },[]);
 if(!photos.length)return null;
 return <dialog ref={dialog} className="care-photo-dialog" aria-label="Фотографии исполнителя" onCancel={event=>{event.preventDefault();onClose()}} onClick={event=>{if(event.target===event.currentTarget)onClose()}} onKeyDown={event=>{if(event.key==='ArrowRight'){event.preventDefault();move(1)}if(event.key==='ArrowLeft'){event.preventDefault();move(-1)}}}>
  <div className="care-photo-viewer-panel">
   <button autoFocus type="button" className="care-photo-viewer-close" aria-label="Закрыть просмотр" onClick={onClose}><X size={20}/></button>
   <button type="button" className="care-photo-viewer-nav previous" aria-label="Предыдущее фото" disabled={photos.length<2} onClick={()=>move(-1)}><ChevronLeft size={24}/></button>
   <figure onTouchStart={event=>{swipeStart.current=event.touches[0].clientX}} onTouchEnd={event=>{if(swipeStart.current!==null){const distance=event.changedTouches[0].clientX-swipeStart.current;if(Math.abs(distance)>45)move(distance<0?1:-1)}swipeStart.current=null}}>
    <img src={photos[index].url} alt={photos[index].name||`Фото ${index+1}`}/>
    <figcaption aria-live="polite">{photos[index].name||'Фотография'} · {index+1} из {photos.length}</figcaption>
   </figure>
   <button type="button" className="care-photo-viewer-nav next" aria-label="Следующее фото" disabled={photos.length<2} onClick={()=>move(1)}><ChevronRight size={24}/></button>
  </div>
 </dialog>;
}
