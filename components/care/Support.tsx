'use client';
import React,{useEffect,useRef,useState} from 'react';
import {ArrowLeft,LifeBuoy,MessageCircle,Send,ShieldCheck,Users,X} from 'lucide-react';
import KittenSupport from '../KittenSupport';
import {request,sendOnEnter,useModule} from './useModule';

type SupportInboxProps={admin?:boolean;workerId?:string;userId?:string};

export function SupportInbox({admin=false,workerId,userId,initialWorkerId,drawer=false,onClose}:{admin?:boolean;workerId?:string;userId?:string;initialWorkerId?:string;drawer?:boolean;onClose?:()=>void}){
 const staff=admin||!!workerId;
 const [section,setSection]=useState<'staff'|'tickets'>(staff?'staff':'tickets');
 const [selectedWorker,setSelectedWorker]=useState<string|null>(initialWorkerId||null);
 const [ticket,setTicket]=useState<string|null>(null),[compose,setCompose]=useState(false);
 const [text,setText]=useState(''),[subject,setSubject]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const contacts=useModule(staff?'/api/staff-messages?contacts=1':null,true);
 const activeWorker=workerId||selectedWorker;
 const direct=useModule(staff&&activeWorker?'/api/staff-messages?worker='+encodeURIComponent(activeWorker):null,true);
 const list=useModule('/api/support',true),thread=useModule(ticket?'/api/support?ticket='+ticket:null,true);
 const feed=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(admin&&!selectedWorker&&contacts.data?.contacts?.length)setSelectedWorker(contacts.data.contacts[0].id)},[admin,selectedWorker,contacts.data]);
 useEffect(()=>{if(feed.current)feed.current.scrollTop=feed.current.scrollHeight},[direct.data?.messages,thread.data?.messages,section,ticket,selectedWorker]);

 async function sendStaff(e:React.FormEvent){e.preventDefault();if(!activeWorker||!text.trim())return;setBusy(true);setError('');try{await request('/api/staff-messages',{workerId:activeWorker,text});setText('');await direct.refresh();await contacts.refresh()}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 async function sendTicket(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{const r=await request('/api/support',{ticketId:ticket||undefined,subject:subject||'Помощь по заказу',text});setTicket(r.id);setCompose(false);setText('');await list.refresh();await thread.refresh()}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 async function closeTicket(){if(!ticket)return;setBusy(true);try{await request('/api/support',{ticketId:ticket,close:thread.data?.ticket?.status!=='closed'});await thread.refresh();await list.refresh()}catch(e:any){setError(e.message)}finally{setBusy(false)}}

 const adminNames=(contacts.data?.contacts||[]).map((item:any)=>item.name).join(', ');
 const chosen=(contacts.data?.contacts||[]).find((item:any)=>item.id===selectedWorker);
 const directMessages=(direct.data?.messages||[]).slice().reverse();
 const ticketMessages=thread.data?.messages||[];
 const canReply=!!workerId||!!admin&&!!selectedWorker;

 return <section className={'support-messenger'+(drawer?' support-messenger-drawer':'')}>
  <header className="support-messenger-top">{drawer&&<button type="button" className="icon-btn support-drawer-close" aria-label="Закрыть переписку" onClick={onClose}><X size={20}/></button>}<div className="support-mark"><MessageCircle size={21}/></div><div><span className="op-eyebrow">BLACK TO WHITE · СООБЩЕНИЯ</span><h1>{admin?'Центр поддержки':workerId?'Связь с руководством':'Поддержка'}</h1><p>{admin?'Команда и обращения клиентов в одном окне.':workerId?'Напишите администрации напрямую — ответ появится в этом чате.':'Задайте вопрос и продолжайте переписку здесь.'}</p></div></header>
  {staff&&<div className="support-tabs" role="tablist" aria-label="Разделы поддержки"><button role="tab" aria-selected={section==='staff'} className={section==='staff'?'active':''} onClick={()=>setSection('staff')}><Users size={16}/>{admin?'Команда':'Руководство'}</button><button role="tab" aria-selected={section==='tickets'} className={section==='tickets'?'active':''} onClick={()=>setSection('tickets')}><LifeBuoy size={16}/>Обращения</button></div>}
  {(error||contacts.error||direct.error||list.error||thread.error)&&<p role="alert" className="support-error">{error||contacts.error||direct.error||list.error||thread.error}<button className="text-btn" onClick={()=>{contacts.refresh();direct.refresh();list.refresh();thread.refresh()}}>Повторить</button></p>}

  {section==='staff'&&staff?<div className="support-chat-layout">
   <aside className={'support-contact-list '+(!admin?'worker-contact-list':'')} aria-label={admin?'Список сотрудников':'Контакты администрации'}>
    <div className="support-list-heading"><b>{admin?'Сотрудники':'Контакты'}</b><span>{admin?(contacts.data?.contacts?.length||0):1}</span></div>
    {admin?contacts.loading?<p className="support-empty">Загружаем команду…</p>:(contacts.data?.contacts||[]).map((c:any)=><button type="button" key={c.id} className={'support-contact '+(selectedWorker===c.id?'selected':'')} onClick={()=>setSelectedWorker(c.id)}><span className="support-avatar">{c.name?.slice(0,1)||'С'}</span><span className="support-contact-copy"><b>{c.name}</b><small>{c.active===0?'Аккаунт приостановлен · ':''}{c.city||'Исполнитель'}{c.last_text?' · '+c.last_text:' · Напишите напрямую'}</small></span><span className="support-online" aria-label={c.active===0?'Неактивный аккаунт':'Контакт доступен'}/></button>):<div className="support-contact support-leadership"><span className="support-avatar leadership-avatar"><Users size={19}/></span><span className="support-contact-copy"><b>Руководство Black to White</b><small>{adminNames||'Администратор сервиса'} · общий рабочий чат</small></span><span className="support-online" aria-label="Контакт доступен"/></div>}
    {admin&&!contacts.loading&&!contacts.data?.contacts?.length&&<p className="support-empty">Пока нет профилей исполнителей.</p>}
    {workerId&&<p className="support-contact-hint">Сообщение увидят активные администраторы. Ответит тот, кто сможет помочь.</p>}
   </aside>
   <div className="support-conversation">
    <div className="support-conversation-head"><span className="support-avatar">{admin?(chosen?.name?.slice(0,1)||'С'):<Users size={19}/>}</span><span><b>{admin?(chosen?.name||'Выберите сотрудника'):'Руководство Black to White'}</b><small>{admin?chosen?.city||'Личный чат сотрудника':adminNames||'Администрация сервиса'}</small></span><span className="support-secure"><ShieldCheck size={15}/>Внутри сервиса</span></div>
    <div className="support-chat-feed" ref={feed} aria-live="polite">
     {!canReply?<p className="support-empty">Выберите сотрудника слева, чтобы открыть переписку.</p>:direct.loading?<p className="support-empty">Загружаем переписку…</p>:directMessages.length?directMessages.map((m:any)=><article key={m.id} className={'support-bubble '+(m.sender_id===userId?'outgoing':'incoming')}><small>{m.sender_id===userId?'Вы':m.name}</small><p>{m.text}</p><time>{new Date(m.created).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</time></article>):<div className="support-first-message"><MessageCircle size={24}/><b>Начните переписку</b><span>{admin?'Напишите сотруднику напрямую по рабочему вопросу.':'Задайте вопрос руководству. История останется в кабинете.'}</span></div>}
    </div>
    {canReply&&<form className="support-composer" onSubmit={sendStaff}><label className="sr-only" htmlFor="support-staff-message">Сообщение</label><textarea id="support-staff-message" value={text} onChange={e=>setText(e.target.value)} onKeyDown={sendOnEnter} maxLength={2000} placeholder="Напишите сообщение…" rows={1} required/><button type="submit" aria-label="Отправить сообщение" disabled={busy||!text.trim()}>{busy?'…':<Send size={18}/>}</button><small>Enter — отправить · Shift+Enter — новая строка</small></form>}
   </div>
  </div>:section==='tickets'?<div className="support-ticket-layout">
    {ticket||compose?<div className="support-ticket-thread"><button className="text-btn" onClick={()=>{setTicket(null);setCompose(false);setError('')}}><ArrowLeft size={16}/> Все обращения</button>
      {ticket?<><div className="support-conversation-head ticket-head"><span className="support-avatar"><LifeBuoy size={18}/></span><span><b>{thread.data?.ticket?.subject||'Поддержка'}</b><small>{thread.data?.ticket?.status==='closed'?'Обращение закрыто':'Ответит команда поддержки'}</small></span></div><div className="support-chat-feed" ref={feed} aria-live="polite">{thread.loading?<p className="support-empty">Загружаем переписку…</p>:ticketMessages.map((m:any)=><article key={m.id} className={'support-bubble '+(m.sender_id===userId?'outgoing':'incoming')}><small>{m.sender_id===userId?'Вы':m.name}</small><p>{m.text}</p><time>{new Date(m.created).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</time></article>)}</div></>:<div className="support-compose-ticket"><h2>Новое обращение</h2><form onSubmit={sendTicket}><label className="field">Тема<input value={subject} onChange={e=>setSubject(e.target.value)} maxLength={120} minLength={3} placeholder="Например, вопрос по заказу" required/></label><label className="field">Сообщение<textarea value={text} onChange={e=>setText(e.target.value)} onKeyDown={sendOnEnter} required maxLength={3000} placeholder="Опишите, чем помочь…"/></label><button className="btn accent" disabled={busy||!text.trim()}>{busy?'Отправляем…':'Отправить обращение'}</button><small>Enter — отправить · Shift+Enter — новая строка</small></form></div>}
      {ticket&&<div className="support-ticket-actions">{thread.data?.ticket?.status!=='closed'&&<form className="support-composer" onSubmit={sendTicket}><label className="sr-only" htmlFor="support-ticket-message">Ответ</label><textarea id="support-ticket-message" value={text} onChange={e=>setText(e.target.value)} onKeyDown={sendOnEnter} maxLength={3000} placeholder="Напишите сообщение…" rows={1} required/><button type="submit" aria-label="Отправить сообщение" disabled={busy||!text.trim()}>{busy?'…':<Send size={18}/>}</button></form>}{admin&&<button className="text-btn" disabled={busy} onClick={closeTicket}>{thread.data?.ticket?.status==='closed'?'Открыть обращение':'Закрыть обращение'}</button>}</div>}
      <p className="support-privacy-note">Не отправляйте пароли, паспортные данные и коды доступа.</p>
    </div>:<div className="support-ticket-list"><div className="support-ticket-list-head"><div><span className="op-eyebrow">{admin?'ВХОДЯЩИЕ':'ВАШИ СООБЩЕНИЯ'}</span><h2>{admin?'Обращения клиентов':'История обращений'}</h2></div>{!admin&&<button className="btn accent" onClick={()=>{setText('');setSubject('');setCompose(true)}}>Новое сообщение</button>}</div>{list.loading?<p>Загружаем обращения…</p>:(list.data?.tickets||[]).map((t:any)=><button className="support-ticket-row" key={t.id} onClick={()=>setTicket(t.id)}><span className="support-avatar"><MessageCircle size={17}/></span><span><b>{t.subject}</b><small>{admin?t.name+' · ':''}{t.status==='open'?'Открыто':'Закрыто'} · {new Date(t.updated).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</small></span><span className={'support-status '+(t.status==='open'?'open':'')}>{t.status==='open'?'Открыто':'Закрыто'}</span></button>)}{!list.loading&&!list.data?.tickets?.length&&<div className="support-first-message"><LifeBuoy size={24}/><b>{admin?'Новых обращений пока нет':'Пока нет обращений'}</b><span>{admin?'Новые сообщения клиентов появятся здесь.':'Создайте обращение — ответ придёт в этот кабинет.'}</span></div>}</div>}
  </div>:null}
 </section>
}

export default function SupportWidget({user,onLogin,draft,quote,onOpenCalculator,onStartBooking}:{user:any;onLogin:()=>void;draft?:any;quote?:any;onOpenCalculator?:()=>void;onStartBooking?:(update?:Record<string,unknown>)=>void}){
 return <KittenSupport draft={draft} quote={quote} onOpenCalculator={onOpenCalculator} onStartBooking={onStartBooking} human={close=>user?<SupportInbox admin={user.role==='admin'} workerId={['cleaner','leader'].includes(user.role)?user.id:undefined} userId={user.id}/>:<><h3>Написать менеджеру</h3><p>Войдите, чтобы отправить обращение и сохранить историю ответов. Вопросы котику доступны без входа.</p><button className="btn accent" onClick={()=>{close();onLogin()}}>Войти и написать</button></>}/>;
}