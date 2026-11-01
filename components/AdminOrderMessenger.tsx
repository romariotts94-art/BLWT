'use client';
import {readJson} from '../lib/http-client';
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ArrowLeft,MessageCircle,Send,ShieldCheck,UserRound,Users,X} from 'lucide-react';
import {sendOnEnter} from './care/useModule';

type Contact={id:string|null;name:string;kind:'client'|'worker';disabled?:boolean};

export default function AdminOrderMessenger({order,workerName,onClose}:{order:any;workerName:string;onClose:()=>void}){
 const orderCode=`BW–${String(order.id||'').slice(0,6).toUpperCase()}`;
 const workerId=order.assignedWorkerId||order.crew?.[0]||null;
 const contacts:Contact[]=[
  {id:order.clientId,name:order.name||'Заказчик',kind:'client'},
  {id:workerId,name:workerId?workerName:'Исполнитель ещё не назначен',kind:'worker',disabled:!workerId},
 ];
 const [selected,setSelected]=useState<Contact|null>(null),[messages,setMessages]=useState<any[]>([]),[text,setText]=useState(''),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const feed=useRef<HTMLDivElement>(null);
 const load=useCallback(async(contact:Contact,signal?:AbortSignal)=>{
  if(!contact.id)return;
  try{
   const params=new URLSearchParams({orderId:order.id,participantId:contact.id});
   const response=await fetch(`/api/order-messages?${params}`,{cache:'no-store',signal});
   const result=await readJson(response);if(!response.ok)throw Error(result.error||'Не удалось загрузить переписку');
   setMessages(result.messages||[]);setError('');
  }catch(e:any){if(e?.name!=='AbortError')setError(e?.message||'Не удалось загрузить переписку')}
 },[order.id]);

 useEffect(()=>{
  if(!selected)return;
  let alive=true;const controller=new AbortController();setLoading(true);setMessages([]);setError('');
  void load(selected,controller.signal).finally(()=>alive&&setLoading(false));
  const timer=window.setInterval(()=>{if(alive)void load(selected)},5000);
  return()=>{alive=false;controller.abort();window.clearInterval(timer)};
 },[selected,load]);
 useEffect(()=>{if(feed.current)feed.current.scrollTop=feed.current.scrollHeight},[messages,selected]);
 useEffect(()=>{const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose()};window.addEventListener('keydown',closeOnEscape);return()=>window.removeEventListener('keydown',closeOnEscape)},[onClose]);

 async function send(event:React.FormEvent){
  event.preventDefault();const clean=text.trim();if(!selected?.id||!clean||busy)return;
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/order-messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId:order.id,participantId:selected.id,text:clean})});
   const result=await readJson(response);if(!response.ok)throw Error(result.error||'Не удалось отправить сообщение');
   setText('');await load(selected);
  }catch(e:any){setError(e?.message||'Не удалось отправить сообщение')}finally{setBusy(false)}
 }

 return <div className="admin-order-messenger-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
  <section className="admin-order-messenger" role="dialog" aria-modal="true" aria-label={`Переписки по заказу ${orderCode}`}>
   <header className="admin-order-messenger-head">
    <button type="button" className="icon-btn admin-messenger-close" onClick={onClose} aria-label="Закрыть переписки"><X size={20}/></button>
    <span className="admin-messenger-mark"><MessageCircle size={20}/></span>
    <div className="admin-messenger-title"><span className="op-eyebrow">ПЕРЕПИСКИ ПО ЗАКАЗУ</span><h2>{orderCode}</h2><p>{order.city?`${order.city}, `:''}{order.address||'Адрес не указан'}</p></div>
   </header>
   <div className="admin-messenger-contacts" aria-label="Собеседники заказа">
    <p>Выберите, кому написать</p>
    {contacts.map(contact=><button key={contact.kind} type="button" disabled={contact.disabled} className={'admin-messenger-contact '+(selected?.kind===contact.kind?'selected':'')} onClick={()=>setSelected(contact)}>
     <span className="admin-messenger-contact-icon">{contact.kind==='client'?<UserRound size={18}/>:<Users size={18}/>}</span>
     <span><b>{contact.kind==='client'?'Заказчик':'Исполнитель заказа'}</b><small>{contact.name}</small></span>
     <MessageCircle size={16}/>
    </button>)}
   </div>
   <div className="admin-messenger-thread">
    {!selected?<div className="admin-messenger-empty"><MessageCircle size={28}/><b>Откройте переписку</b><span>Сообщения привязаны к номеру и адресу этого заказа.</span></div>:<>
     <div className="admin-messenger-recipient"><span><b>{selected.name}</b><small>{selected.kind==='client'?'Заказчик':'Исполнитель'} · {orderCode}</small></span><span className="support-secure"><ShieldCheck size={15}/>Личный чат</span></div>
     <div className="admin-messenger-feed" ref={feed} aria-live="polite">
      {loading?<p className="support-empty">Загружаем переписку…</p>:messages.length?messages.map(message=><article key={message.id} className={'support-bubble '+(message.participant_id===message.sender_id&&message.sender_id===selected.id?'incoming':'outgoing')}><small>{message.name}</small><p>{message.text}</p><time>{new Date(message.created).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</time></article>):<div className="admin-messenger-empty"><MessageCircle size={24}/><b>Начните переписку</b><span>Этот личный чат виден участнику и администрации.</span></div>}
     </div>
     {error&&<p className="support-error" role="alert">{error}</p>}
     <form className="admin-messenger-composer" onSubmit={send}><label className="sr-only" htmlFor="admin-order-message">Сообщение для {selected.name}</label><textarea id="admin-order-message" rows={1} maxLength={2000} value={text} onChange={event=>setText(event.target.value)} onKeyDown={sendOnEnter} placeholder={`Сообщение · ${orderCode}`} required/><button type="submit" aria-label="Отправить сообщение" disabled={busy||!text.trim()}>{busy?'…':<Send size={18}/>}</button><small>Enter — отправить · Shift+Enter — перенос строки</small></form>
    </>}
   </div>
  </section>
 </div>;
}
