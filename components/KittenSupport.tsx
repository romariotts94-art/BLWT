'use client';
import React,{useEffect,useRef,useState} from 'react';
import {X,ArrowUpRight,ArrowLeft} from 'lucide-react';
import {kittenAnswer} from '../lib/kitten-help';

export default function KittenSupport({draft={},quote={total:0},human}:{draft?:any;quote?:any;human:React.ReactNode|((close:()=>void)=>React.ReactNode)}) {
 const [open,setOpen]=useState(false),[throwing,setThrowing]=useState(false),[text,setText]=useState(''),[manager,setManager]=useState(false);
 const [messages,setMessages]=useState<{question:string;answer:string}[]>([]);
 const [activity,setActivity]=useState<'listening'|'writing'>('listening');
 const activityTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const dialog=useRef<HTMLDialogElement>(null),log=useRef<HTMLDivElement>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);if(activityTimer.current)clearTimeout(activityTimer.current)},[]);
 useEffect(()=>{const el=dialog.current;if(!el)return;if(open){const previous=document.activeElement as HTMLElement|null;el.showModal();return()=>{el.close();previous?.focus()}}else el.close()},[open]);
 useEffect(()=>{if(log.current)log.current.scrollTop=log.current.scrollHeight},[messages]);
 const summon=()=>{if(open){setOpen(false);return}if(throwing)return;setThrowing(true);timer.current=setTimeout(()=>{setThrowing(false);setOpen(true)},matchMedia('(prefers-reduced-motion: reduce)').matches?0:480)};
 const reactToQuestion=()=>{if(activityTimer.current)clearTimeout(activityTimer.current);setActivity('writing');activityTimer.current=setTimeout(()=>setActivity('listening'),1500)};
 const send=(question:string)=>{if(!question.trim())return;setMessages(ms=>[...ms,{question:question.trim(),answer:kittenAnswer(question,draft,quote.total)}]);setText('');reactToQuestion()};
 return <div className="bw-kitten-support">
  <dialog ref={dialog} className="bw-kitten-dialog" aria-labelledby="kitten-title" onCancel={()=>setOpen(false)}>
   <header><span key={messages.length} className={'bw-kitten-avatar bw-kitten-secretary is-'+activity} aria-hidden="true"/><div><h2 id="kitten-title">Мяу, я рядом!</h2><small>Помощник Black & White</small><span className="bw-kitten-activity">{activity==='writing'?'Записываю ваш вопрос…':'Слушаю и записываю'}</span></div><button autoFocus className="icon-btn" aria-label="Закрыть поддержку" onClick={()=>setOpen(false)}><X size={19}/></button></header>
   {manager?<div className="bw-kitten-human"><button className="text-btn" onClick={()=>setManager(false)}><ArrowLeft size={16}/> К котику</button>{typeof human==='function'?human(()=>setOpen(false)):human}</div>:<>
    <div className="bw-kitten-log" ref={log} role="log" aria-live="polite"><p className="bw-cat-message">Мяу! Тапочек поймал. Спрашивайте про уборку, стоимость и средства. Я автоматический помощник по типовым вопросам; личные вопросы по заказу передавайте менеджеру.</p>{messages.map((m,i)=><React.Fragment key={i}><p className="bw-cat-message is-user">{m.question}</p><p className="bw-cat-message">{m.answer}</p></React.Fragment>)}</div>
    <div className="bw-kitten-prompts">{['Что входит в уборку?','Сколько стоит?','Какие средства подходят?'].map(q=><button key={q} onClick={()=>send(q)}>{q}</button>)}</div>
    <form className="bw-kitten-form" onSubmit={e=>{e.preventDefault();send(text)}}><label className="sr-only" htmlFor="kitten-question">Ваш вопрос котику</label><input id="kitten-question" value={text} onChange={e=>{setText(e.target.value);reactToQuestion()}} maxLength={1000} placeholder="Спросите меня, мяу…"/><button className="icon-btn" aria-label="Отправить вопрос котику" disabled={!text.trim()}><ArrowUpRight size={21}/></button></form>
    <button className="text-btn bw-kitten-manager" onClick={()=>setManager(true)}>Написать менеджеру <ArrowUpRight size={15}/></button>
   </>}
  </dialog>
  <button className={'care-support-toggle bw-cat-toggle'+(throwing?' is-throwing':'')} aria-label="Спросить котика — открыть поддержку" aria-expanded={open} onClick={summon}>
   <span className="bw-cat-invite">Есть вопросы? Спросите меня.</span>
   <span className="bw-kitten-avatar bw-kitten-secretary" aria-hidden="true"/>
   <svg className="bw-flying-slipper" viewBox="0 0 48 48" aria-hidden="true"><path d="M13 43C5 40 10 27 15 17S25 3 31 6c12 6 2 22-3 30-4 7-9 9-15 7Z" fill="#dbe997" stroke="#52613d" strokeWidth="2"/><path d="m14 20 17 7c5-9 5-15-1-18-6-2-11 3-16 11Z" fill="#f7f4e9" stroke="#52613d" strokeWidth="2"/></svg>
  </button>
 </div>;
}
