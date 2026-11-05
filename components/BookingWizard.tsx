'use client';
import React,{useLayoutEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,CheckCircle2,ChevronDown,Minus,Plus} from 'lucide-react';
import BookingDate from './BookingDate';
import CleaningScope from './CleaningScope';
import Preferences,{PreferencesSummary} from './care/Preferences';
import {selectedCleaning,hasCleaningSelection} from '../lib/cleaning-catalog';
import {extras,money} from '../lib/domain';
import {uploadError} from '../lib/client-upload';
import {launchCityId} from '../lib/marketplace-policy';

type Props={draft:any;setDraft:React.Dispatch<React.SetStateAction<any>>;rates:any;quote:any;step:number;setStep:(step:number)=>void;photos:File[];setPhotos:(files:File[])=>void;photoError:string;setPhotoError:(message:string)=>void;busy:boolean;onChoose:()=>void;onHome:()=>void;onSubmit:()=>void;onLegal:()=>void};
const dateLabel=(date:string)=>date?new Date(date+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'}):'Уточним дату';

export default function BookingWizard({draft,setDraft,rates,quote,step,setStep,photos,setPhotos,photoError,setPhotoError,busy,onChoose,onHome,onSubmit,onLegal}:Props){
 const [reviewIncomplete,setReviewIncomplete]=useState(false);
 const [extrasOpen,setExtrasOpen]=useState(false);
 const dirtMenu=useRef<HTMLDetailsElement>(null);
 const chosen=hasCleaningSelection(draft),cleaning=selectedCleaning(draft);
 const additions=Object.entries(extras).filter(([id])=>draft.extras?.[id]>0);
 const update=(patch:Record<string,unknown>)=>setDraft((current:any)=>({...current,...patch}));
 const next=(value:number)=>{setReviewIncomplete(false);setStep(value)};
 useLayoutEffect(()=>{window.scrollTo({top:0,behavior:'instant'})},[step]);
 useLayoutEffect(()=>{if(draft.cityId!==launchCityId)update({cityId:launchCityId})},[draft.cityId]);
 useLayoutEffect(()=>{if(reviewIncomplete)document.querySelector('.bw-booking-soft-prompt')?.scrollIntoView({behavior:'instant',block:'center'})},[reviewIncomplete]);
 const checkContact=()=>{
  if(draft.name.trim().length<2||draft.phone.replace(/\D/g,'').length<10||draft.address.trim().length<8){setReviewIncomplete(true);return}
  next(2);
 };
 const onFiles=(event:React.ChangeEvent<HTMLInputElement>)=>{
  const files=Array.from(event.currentTarget.files||[]);if(!files.length)return;
  const problem=files.length>8?'Можно добавить до 8 фотографий. Выберите меньше файлов.':files.map(file=>uploadError(file,8)).find(Boolean);
  if(problem){setPhotoError(problem);event.currentTarget.value='';return}
  setPhotoError('');setPhotos(files);
 };
 return <main className="booking bw-booking-flow">
  <div className="bw-booking-shell">
   <button type="button" className="text-btn bw-booking-back" onClick={step===0?onHome:()=>next(step-1)}><ArrowLeft size={18}/>{step===0?'На главную':'Назад'}</button>
   <div className="bw-booking-heading"><span className="eyebrow">ВАШ ЗАКАЗ · {step+1} шаг из 3</span><h1>{['Ваша уборка','Когда вам удобно','Проверим детали'][step]}</h1></div>
    <nav className="bw-booking-progress" aria-label="Этапы оформления">{['Уборка и пожелания','Дата и контакты','Итог'].map((label,index)=><span key={label} className={step===index?'current':step>index?'complete':''}><b>{step>index?'✓':index+1}</b><span className="bw-booking-stage-copy"><small>{index+1} шаг</small>{label}</span></span>)}</nav>
   {step===0&&<section className="booking-panel">
    {chosen?<><div className="bw-booking-selection"><CheckCircle2 size={24}/><div><strong>{cleaning.name}</strong><span>{draft.area} м²</span></div><b>{quote.total?money(quote.total):'По смете'}</b></div><CleaningScope id={cleaning.id}/></>:<p>Выберите уборку на главной странице, чтобы увидеть состав работ.</p>}
    <button type="button" className="text-btn bw-booking-change" onClick={onChoose}>{chosen?'Изменить уборку':'Выбрать уборку'} <ArrowRight size={17}/></button>
    {chosen&&<><div className="bw-booking-fields"><div className="field">Площадь, м²<div className="bw-booking-area"><button type="button" aria-label="Уменьшить площадь" onClick={()=>update({area:Math.max(15,draft.area-5)})}><Minus size={17}/></button><input aria-label="Площадь помещения в квадратных метрах" type="number" inputMode="numeric" min="15" max="10000" value={draft.area} onChange={event=>update({area:Math.max(15,Math.min(10000,+event.target.value||15))})}/><span>м²</span><button type="button" aria-label="Увеличить площадь" onClick={()=>update({area:Math.min(10000,draft.area+5)})}><Plus size={17}/></button></div></div><div className="field">Загрязнение<details ref={dirtMenu} className="bw-booking-dirt"><summary>{['Обычное','Сильное','Очень сильное'][draft.dirt]||'Обычное'}<ChevronDown size={18}/></summary><div className="bw-booking-dirt-options">{['Обычное','Сильное','Очень сильное'].map((label,index)=><button type="button" key={label} className={draft.dirt===index?'selected':''} onClick={()=>{update({dirt:index});dirtMenu.current?.removeAttribute('open')}}>{label}{draft.dirt===index&&<CheckCircle2 size={17}/>}</button>)}</div></details></div></div>
     <details className="bw-booking-options bw-booking-extras" open={extrasOpen} onToggle={event=>setExtrasOpen(event.currentTarget.open)}><summary><span><strong>Дополнения</strong><small>{additions.length?`Выбрано: ${additions.reduce((sum,[id])=>sum+draft.extras[id],0)}`:'Добавьте нужные задачи, если хотите'}</small></span><Plus size={21}/></summary><div className="extras-list">{Object.entries(extras).map(([id,item])=><div className="extra" key={id}><div><strong>{item.name}</strong><small>{money(rates.extras[id].price)} / {item.unit}</small></div><div className="counter"><button type="button" aria-label={'Уменьшить '+item.name} onClick={()=>setDraft((current:any)=>({...current,extras:{...current.extras,[id]:Math.max(0,(current.extras[id]||0)-1)}}))}><Minus size={15}/></button><span>{draft.extras[id]||0}</span><button type="button" aria-label={'Добавить '+item.name} onClick={()=>setDraft((current:any)=>({...current,extras:{...current.extras,[id]:Math.min(30,(current.extras[id]||0)+1)}}))}><Plus size={15}/></button></div></div>)}</div></details>
     <h2 className="bw-booking-wishes-title">Уборка с учётом ваших пожеланий</h2><Preferences title="" value={draft.preferences||{}} onChange={preferences=>update({preferences})}/>
     <label className="field">Что ещё важно учесть<textarea maxLength={2000} value={draft.notes} placeholder="Например, животные или деликатные поверхности" onChange={event=>update({notes:event.target.value})}/></label>
     <label className="field">Фотографии, если хотите<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onFiles}/><small>{photos.length?`Выбрано: ${photos.length}`:'До 8 фото, каждое до 8 МБ'}</small>{photoError&&<small role="alert" className="upload-field-error">{photoError}</small>}</label>
    </>}
    <button type="button" className="btn accent full bw-booking-next" disabled={!chosen} onClick={()=>next(1)}>Выбрать дату и время <ArrowRight size={19}/></button>
   </section>}
   {step===1&&<section className="booking-panel"><h2>Дата и время</h2><div className="bw-booking-fields"><label className="field">Дата<BookingDate value={draft.date} onChange={date=>update({date})}/></label><label className="field">Время<select value={draft.time} onChange={event=>update({time:event.target.value})}>{Array.from({length:25},(_,index)=>`${String(8+Math.floor(index/2)).padStart(2,'0')}:${index%2?'30':'00'}`).map(time=><option key={time}>{time}</option>)}</select></label></div><h2>Куда приехать и как связаться</h2><div className="bw-booking-fields"><label className="field">Город<input value="Москва" readOnly/></label><label className="field">Адрес<input maxLength={400} value={draft.address} placeholder="Улица и дом; детали можно уточнить позже" onChange={event=>update({address:event.target.value})}/></label><label className="field">Ваше имя<input maxLength={100} autoComplete="name" value={draft.name} placeholder="Как к вам обращаться" onChange={event=>update({name:event.target.value})}/></label><label className="field">Телефон<input type="tel" maxLength={22} autoComplete="tel" value={draft.phone} placeholder="+7 999 123-45-67" onChange={event=>update({phone:event.target.value})}/></label></div>
    {reviewIncomplete&&<div className="bw-booking-soft-prompt" role="status"><strong>Похоже, часть контактов ещё не заполнена</strong><p>Можно проверить данные сейчас или продолжить. Детали уточним до подтверждения уборки.</p><div><button type="button" className="btn secondary" onClick={()=>setReviewIncomplete(false)}>Проверю</button><button type="button" className="btn accent" onClick={()=>next(2)}>Продолжить <ArrowRight size={17}/></button></div></div>}
    {!reviewIncomplete&&<button type="button" className="btn accent full bw-booking-next" onClick={checkContact}>Проверить заказ <ArrowRight size={19}/></button>}
   </section>}
   {step===2&&<section className="booking-panel"><h2>Ваш заказ</h2><div className="bw-booking-receipt"><div><span>Уборка</span><strong>{cleaning.name} · {draft.area} м²</strong></div>{additions.length>0&&<div><span>Дополнения</span><strong>{additions.map(([id,item])=>`${item.name} × ${draft.extras[id]}`).join(', ')}</strong></div>}{photos.length>0&&<div><span>Фотографии</span><strong>{photos.length}</strong></div>}{draft.notes.trim()&&<div><span>Пожелания</span><strong>{draft.notes.trim()}</strong></div>}<div><span>Когда</span><strong>{dateLabel(draft.date)}, {draft.time}</strong></div><div><span>Адрес</span><strong>Москва, {draft.address.trim()||'уточним'}</strong></div><div><span>Контакт</span><strong>{draft.name.trim()||'Уточним имя'} · {draft.phone.trim()||'Уточним телефон'}</strong></div></div><PreferencesSummary value={draft.preferences}/><div className="bw-booking-total"><span>Предварительная стоимость</span><strong>{draft.service==='custom'?'По смете':money(quote.total)}</strong></div><p className="bw-booking-test-note">Оплата пока тестовая: карта не нужна, деньги не спишутся. Отправка заявки не подтверждает визит исполнителя.</p><p className="bw-booking-legal">Продолжая, вы отправляете тестовую заявку и соглашаетесь с <button type="button" className="inline-link" onClick={onLegal}>обработкой данных</button>.</p><button type="button" className="btn accent full bw-booking-next" disabled={busy} onClick={onSubmit}>{busy?'Отправляем…':'Заказать и оплатить'} <ArrowRight size={19}/></button></section>}
  </div>
 </main>;
}
