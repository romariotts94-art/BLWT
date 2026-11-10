'use client';
import {useState} from 'react';

export default function VtbTestPage(){
 const [orderId,setOrderId]=useState(''),[attemptId,setAttemptId]=useState(''),[amount,setAmount]=useState(''),[result,setResult]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function request(action:string){
  setBusy(true);setError('');
  try{
   const body:any=action==='start'?{action,orderId}:{action,attemptId};
   if(action==='capture'||action==='refund')body.amountCents=Number(amount);
   const response=await fetch('/api/vtb-sandbox',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
   const data:any=await response.json();if(!response.ok)throw Error(data.error||'Операция не выполнена');
   setResult(data);if(data.attemptId)setAttemptId(data.attemptId);else if(data.attempt?.id)setAttemptId(data.attempt.id);
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function status(){setBusy(true);setError('');try{
  const target=attemptId?`attempt=${encodeURIComponent(attemptId)}`:`order=${encodeURIComponent(orderId)}`;
  const response=await fetch('/api/vtb-sandbox?'+target,{cache:'no-store'});const data:any=await response.json();if(!response.ok)throw Error(data.error||'Не удалось получить статус');
  setResult(data);if(data.attempt?.id)setAttemptId(data.attempt.id);
 }catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <main style={{maxWidth:720,margin:'4rem auto',padding:24,fontFamily:'system-ui'}}><h1>Тестовая оплата ВТБ</h1><p>Только тестовый терминал ВТБ. Реальные деньги не списываются. Все суммы указаны в копейках.</p>
  <label>Номер тестового заказа <input value={orderId} onChange={e=>setOrderId(e.target.value)} style={{display:'block',width:'100%'}}/></label>
  <button disabled={busy||!orderId} onClick={()=>void request('start')}>Создать тестовый платёж</button>
  <label style={{display:'block',marginTop:16}}>ID попытки <input value={attemptId} onChange={e=>setAttemptId(e.target.value)} style={{display:'block',width:'100%'}}/></label>
  <button disabled={busy||(!attemptId&&!orderId)} onClick={()=>void status()}>Сверить статус с ВТБ</button>
  <label style={{display:'block',marginTop:16}}>Сумма операции, копейки <input type="number" min="1" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
  <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}><button disabled={busy||!attemptId||!amount} onClick={()=>void request('capture')}>Списать резерв</button><button disabled={busy||!attemptId} onClick={()=>void request('reverse')}>Отменить резерв</button><button disabled={busy||!attemptId} onClick={()=>void request('decline')}>Отменить неоплаченный заказ</button><button disabled={busy||!attemptId||!amount} onClick={()=>void request('refund')}>Вернуть сумму</button></div>
  {result?.formUrl&&<p><a href={result.formUrl}>Открыть форму ВТБ</a></p>}
  {error&&<p role="alert">{error}</p>}
  {result?.attempt&&<section aria-live="polite"><h2>Состояние</h2><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(result.attempt,null,2)}</pre></section>}
  {result?.pending&&<p role="status">Банк принял запрос; ожидается подтверждение статуса.</p>}
 </main>;
}
