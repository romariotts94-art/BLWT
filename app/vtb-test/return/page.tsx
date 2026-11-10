'use client';
import {Suspense,useEffect,useState} from 'react';
import {useSearchParams} from 'next/navigation';

function Status(){
 const query=useSearchParams(),attempt=query.get('attempt'),[message,setMessage]=useState('Проверяем статус тестового платежа…');
 useEffect(()=>{
  if(!attempt){setMessage('Не указан тестовый платёж.');return}
  let active=true;
  async function check(){
   try{const response=await fetch(`/api/vtb-sandbox?attempt=${encodeURIComponent(attempt!)}`,{cache:'no-store'});
    const data:any=await response.json();if(!active)return;
    if(!response.ok){setMessage(data.error||'Не удалось проверить тестовый платёж');return}
    const state=data.attempt?.state;
    setMessage(state==='captured'?'Тестовая оплата подтверждена банком.':state==='authorized'?'Тестовая сумма зарезервирована.':state==='refunded'?'Тестовая оплата возвращена.':state==='reversed'?'Тестовый резерв отменён.':state==='declined'?'Банк отклонил тестовую оплату.':'Ожидаем подтверждение тестового платежа от банка.');
   }catch{if(active)setMessage('Связь прервалась. Обновите страницу для повторной проверки.')}
  }
  void check();const timer=setInterval(()=>void check(),10000);return()=>{active=false;clearInterval(timer)};
 },[attempt]);
 return <main style={{maxWidth:620,margin:'12vh auto',padding:24,fontFamily:'system-ui'}}><h1>Тестовая оплата ВТБ</h1><p role="status">{message}</p><a href="/">Вернуться на главную</a></main>;
}
export default function Page(){return <Suspense fallback={<main>Проверяем статус…</main>}><Status/></Suspense>}
