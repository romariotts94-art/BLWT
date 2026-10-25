'use client';
import React,{useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {DayPicker} from 'react-day-picker';
import {ru} from 'react-day-picker/locale';
import {CalendarDays,ChevronDown,X} from 'lucide-react';

const dateValue=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export default function BookingDate({value,onChange,label='Желаемая дата уборки'}:{value:string;onChange:(value:string)=>void;label?:string}){
  const id=useId(),trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null);
  const [open,setOpen]=useState(false),[position,setPosition]=useState({top:0,left:0});
  const minimum=new Date(new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Moscow'})+'T12:00:00');
  const selected=value?new Date(value+'T12:00:00'):undefined;
  const close=(focus=false)=>{setOpen(false);if(focus)trigger.current?.focus()};
  useEffect(()=>{
    if(!open)return;
    const place=()=>{const r=trigger.current?.getBoundingClientRect();if(!r)return;const height=panel.current?.offsetHeight||440;setPosition({left:Math.max(12,Math.min(r.left,window.innerWidth-352)),top:r.bottom+height+12<window.innerHeight?r.bottom+8:Math.max(12,r.top-height-8)})};
    const outside=(e:PointerEvent)=>{if(!panel.current?.contains(e.target as Node)&&!trigger.current?.contains(e.target as Node))close()};
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();close(true)}};
    place();window.addEventListener('resize',place);window.addEventListener('scroll',place,true);document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
    return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape)};
  },[open]);
  const pick=(day:Date|undefined)=>{if(day){onChange(dateValue(day));close(true)}};
  return <><button ref={trigger} type="button" className="bw-date-trigger" aria-label={label} aria-haspopup="dialog" aria-expanded={open} aria-controls={open?id:undefined} onClick={()=>setOpen(!open)}><CalendarDays size={20}/><span>{selected?selected.toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'}):'Выберите дату'}</span><ChevronDown size={17}/></button>{open&&createPortal(<div ref={panel} id={id} className="bw-date-popover" role="dialog" aria-label="Выберите дату уборки" style={position}><div className="bw-date-heading"><span>ДЕНЬ ДЛЯ ЧИСТОТЫ</span><button type="button" aria-label="Закрыть календарь" onClick={()=>close(true)}><X size={18}/></button></div><DayPicker mode="single" locale={ru} selected={selected} onSelect={pick} defaultMonth={selected||minimum} startMonth={minimum} disabled={{before:minimum}} showOutsideDays autoFocus/><div className="bw-date-shortcuts">{[0,1].map(offset=>{const day=new Date(minimum);day.setDate(day.getDate()+offset);return <button key={offset} type="button" onClick={()=>pick(day)}>{offset?'Завтра':'Сегодня'}</button>})}</div><p>Выберите удобный день.<br/>Время подтвердим при согласовании.</p></div>,document.body)}</>;
}
