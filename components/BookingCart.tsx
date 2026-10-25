'use client';
import React,{useEffect,useRef} from 'react';
import {ShoppingBag,X,Trash2,ArrowRight} from 'lucide-react';
import {extras,money} from '../lib/domain';
import {hasCleaningSelection,selectedCleaning} from '../lib/cleaning-catalog';
import CleaningScope from './CleaningScope';

export default function BookingCart({open,onClose,draft,setDraft,quote,rates,onRemove,onCheckout,onChoose}:{open:boolean;onClose:()=>void;draft:any;setDraft:any;quote:any;rates:any;onRemove:()=>void;onCheckout:()=>void;onChoose:()=>void}) {
 const dialog=useRef<HTMLDialogElement>(null);
 const chosen=hasCleaningSelection(draft),service=selectedCleaning(draft);
 const additions=Object.entries(extras).filter(([key])=>draft.extras[key]>0);
 useEffect(()=>{const el=dialog.current;if(!el)return;if(open){const previous=document.activeElement as HTMLElement|null;el.showModal();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{el.close();document.body.style.overflow=overflow;previous?.focus()}}else el.close()},[open]);
 return <dialog ref={dialog} className="bw-cart" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose()}}} aria-labelledby="cart-title">
  <header className="bw-cart-head"><div><span className="eyebrow">ВАШ ПЛАН ЧИСТОТЫ</span><h2 id="cart-title"><ShoppingBag size={25}/> Корзина</h2></div><button autoFocus className="icon-btn" aria-label="Закрыть корзину" onClick={onClose}><X/></button></header>
  {chosen?<><div className="bw-cart-service"><div><h3>{service.name}</h3><p>{draft.area} м² · {draft.date?new Date(draft.date+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long'}):'Дата не выбрана'} · {draft.time}</p></div><button className="icon-btn" aria-label="Удалить уборку из корзины" onClick={onRemove}><Trash2 size={19}/></button></div>
   <CleaningScope id={service.id}/>
   {additions.length>0&&<section className="bw-cart-extras"><h3>Дополнения</h3>{additions.map(([key,extra])=><div key={key}><div><strong>{extra.name} × {draft.extras[key]}</strong><small>{extra.description}</small><b>{money(rates.extras[key].price*draft.extras[key])}</b></div><button className="icon-btn" aria-label={'Удалить '+extra.name+' из корзины'} onClick={()=>setDraft((d:any)=>({...d,extras:{...d.extras,[key]:0}}))}><X size={17}/></button></div>)}</section>}
   <div className="bw-cart-footer"><div><span>Предварительная стоимость</span><strong>{draft.service==='custom'?'По смете':money(quote.total)}</strong></div><small>Это одна уборка с выбранными дополнениями. Заявка ещё не отправлена, оплата не списывается.</small><button className="btn accent full" onClick={onCheckout}>Перейти к оформлению <ArrowRight size={18}/></button><button className="text-btn" onClick={onClose}>Продолжить выбор</button></div>
  </>:<div className="bw-cart-empty"><ShoppingBag size={44}/><h3>В корзине пока пусто</h3><p>Выберите уборку — здесь появятся её состав, дополнения и стоимость.</p><button className="btn accent" onClick={onChoose}>Выбрать уборку <ArrowRight size={18}/></button></div>}
 </dialog>;
}
