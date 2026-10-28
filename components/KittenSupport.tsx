'use client';
import React,{useEffect,useRef,useState} from 'react';
import {X,ArrowUpRight,ArrowLeft,Mic,Volume2,VolumeX,Square} from 'lucide-react';
import {kittenAnswer} from '../lib/kitten-help';

type AssistantAction={id:'calculator'|'booking'|'manager';label:string};
type AssistantMessage={id:string;question:string;answer:string;actions:AssistantAction[];bookingUpdate?:Record<string,unknown>};
type SpeechRecognitionLike={lang:string;interimResults:boolean;maxAlternatives:number;start:()=>void;stop:()=>void;onresult:((event:{results:ArrayLike<{0:{transcript:string}}>})=>void)|null;onerror:((event:{error?:string})=>void)|null;onend:(()=>void)|null};
type SpeechRecognitionConstructor=new()=>SpeechRecognitionLike;
type AudioContextConstructor=new()=>AudioContext;
const localActions=(question:string):AssistantAction[]=>{const q=question.toLocaleLowerCase('ru-RU'),actions:AssistantAction[]=[];if(/стоим|цен|сколько|рассч|калькулятор|площад|дополн|тариф/.test(q))actions.push({id:'calculator',label:'Открыть калькулятор'});if(/заказ|оформ|запис|заброни|уборк[уи]|приех/.test(q))actions.push({id:'booking',label:'Перейти к оформлению'});if(/менеджер|оператор|жалоб|возврат|отмен|перенос|не приех|ущерб/.test(q))actions.push({id:'manager',label:'Написать менеджеру'});return actions.filter((action,index)=>actions.findIndex(item=>item.id===action.id)===index)};

export default function KittenSupport({draft={},quote={total:0},human,onOpenCalculator,onStartBooking}:{draft?:any;quote?:any;human:React.ReactNode|((close:()=>void)=>React.ReactNode);onOpenCalculator?:()=>void;onStartBooking?:(update?:Record<string,unknown>)=>void}) {
 const [open,setOpen]=useState(false),[throwing,setThrowing]=useState(false),[text,setText]=useState(''),[manager,setManager]=useState(false),[busy,setBusy]=useState(false),[voiceEnabled,setVoiceEnabled]=useState(false),[listening,setListening]=useState(false),[speaking,setSpeaking]=useState(false),[voiceError,setVoiceError]=useState('');
 const [messages,setMessages]=useState<AssistantMessage[]>([]);
 const [activity,setActivity]=useState<'listening'|'writing'>('listening');
 const activityTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const dialog=useRef<HTMLDialogElement>(null),log=useRef<HTMLDivElement>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const recognition=useRef<SpeechRecognitionLike|null>(null),voiceDraft=useRef(''),voiceEnabledRef=useRef(false),audioContext=useRef<AudioContext|null>(null),audioSource=useRef<AudioBufferSourceNode|null>(null),audioCache=useRef(new Map<string,AudioBuffer>());
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);if(activityTimer.current)clearTimeout(activityTimer.current);recognition.current?.stop();audioSource.current?.stop();void audioContext.current?.close()},[]);
 useEffect(()=>{const el=dialog.current;if(!el)return;if(open){const previous=document.activeElement as HTMLElement|null;el.showModal();return()=>{el.close();previous?.focus()}}else el.close()},[open]);
 useEffect(()=>{if(log.current)log.current.scrollTop=log.current.scrollHeight},[messages]);
 const summon=()=>{if(open){setOpen(false);return}if(throwing)return;setThrowing(true);timer.current=setTimeout(()=>{setThrowing(false);setOpen(true)},matchMedia('(prefers-reduced-motion: reduce)').matches?0:480)};
 const reactToQuestion=()=>{if(activityTimer.current)clearTimeout(activityTimer.current);setActivity('writing');activityTimer.current=setTimeout(()=>setActivity('listening'),1500)};
 const activateVoice=()=>{voiceEnabledRef.current=true;setVoiceEnabled(true);const source=window as Window&{webkitAudioContext?:AudioContextConstructor};const Context=window.AudioContext||source.webkitAudioContext;if(Context){audioContext.current??=new Context();void audioContext.current.resume().catch(()=>setVoiceError('Safari не разрешил воспроизведение. Нажмите значок динамика ещё раз.'))}else setVoiceError('В этом браузере недоступно автоматическое воспроизведение.');};
 const speak=async(value:string)=>{if(!voiceEnabledRef.current)return;setVoiceError('');try{const context=audioContext.current;if(!context)throw new Error('Safari не создал аудиоконтекст');await context.resume();let buffer=audioCache.current.get(value);if(!buffer){const response=await fetch('/api/kitten-voice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:value}),cache:'no-store'});if(!response.ok){const payload=await response.json().catch(()=>({}));throw new Error(payload.error||`Синтез речи вернул ошибку ${response.status}`)}const bytes=await response.arrayBuffer();if(!bytes.byteLength)throw new Error('Сервис речи вернул пустой аудиофайл');buffer=await context.decodeAudioData(bytes.slice(0));audioCache.current.set(value,buffer)}await context.resume();audioSource.current?.stop();const source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);source.onended=()=>{if(audioSource.current===source)audioSource.current=null;setSpeaking(false)};audioSource.current=source;source.start(0);setSpeaking(true)}catch(error){setSpeaking(false);setVoiceError(error instanceof Error?`Не получилось включить звук: ${error.message}`:'Не получилось включить звук. Проверьте разрешение Safari и громкость.')}};
 const toggleVoice=()=>{if(voiceEnabledRef.current){voiceEnabledRef.current=false;recognition.current?.stop();audioSource.current?.stop();setListening(false);setSpeaking(false);setVoiceEnabled(false);return}setVoiceError('');activateVoice()};
 const listen=()=>{if(busy||listening)return;const source=window as Window&{SpeechRecognition?:SpeechRecognitionConstructor;webkitSpeechRecognition?:SpeechRecognitionConstructor};const SpeechRecognition=source.SpeechRecognition||source.webkitSpeechRecognition;if(!SpeechRecognition){setVoiceError('Голосовой ввод не поддерживается этим браузером. Попробуйте Safari или нажмите кнопку отправки текстом.');return}activateVoice();setVoiceError('');voiceDraft.current='';const instance=new SpeechRecognition();instance.lang='ru-RU';instance.interimResults=false;instance.maxAlternatives=1;instance.onresult=event=>{const transcript=Array.from(event.results).map(result=>result[0]?.transcript||'').join(' ').trim();voiceDraft.current=transcript;setText(transcript)};instance.onerror=event=>{setListening(false);setVoiceError(event.error==='not-allowed'?'Разрешите Safari доступ к микрофону для голосового вопроса.':'Не удалось распознать голос. Попробуйте ещё раз.')};instance.onend=()=>{setListening(false);const question=voiceDraft.current.trim();voiceDraft.current='';if(question)void send(question)};recognition.current=instance;setListening(true);instance.start()};
 const send=async(question:string)=>{
  const trimmed=question.trim();if(!trimmed||busy)return;
  const id=crypto.randomUUID();
  const history=messages.slice(-6).map(({question:oldQuestion,answer})=>({question:oldQuestion,answer}));
  const carriedBookingUpdate=messages.reduce((all:any,message)=>({...all,...message.bookingUpdate,extras:message.bookingUpdate?.extras?{...(all.extras||{}),...message.bookingUpdate.extras}:all.extras}),{});
  setMessages(ms=>[...ms,{id,question:trimmed,answer:'',actions:[]}]);setText('');setBusy(true);setActivity('writing');
  try{
   const response=await fetch('/api/kitten-ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:trimmed,draft,quote,history,bookingUpdate:carriedBookingUpdate})});
   const payload=await response.json().catch(()=>({}));
   if(!response.ok||typeof payload.answer!=='string')throw new Error(payload.error||'AI assistant unavailable');
   const actions=Array.isArray(payload.actions)?payload.actions.filter((action:any)=>action&&['calculator','booking','manager'].includes(action.id)&&typeof action.label==='string'):[];
   const bookingUpdate=[...messages.map(message=>message.bookingUpdate||{}),payload.bookingUpdate&&typeof payload.bookingUpdate==='object'?payload.bookingUpdate:{}].reduce((all:any,next:any)=>({...all,...next,extras:next.extras?{...(all.extras||{}),...next.extras}:all.extras}),{});
   if(bookingUpdate.catalogService&&!actions.some((action:AssistantAction)=>action.id==='booking'))actions.push({id:'booking',label:'Перейти к оформлению'});
   setMessages(ms=>ms.map(message=>message.id===id?{...message,answer:payload.answer,actions,bookingUpdate}:message));
   speak(payload.answer);
   if(payload.readyToReview===true&&(bookingUpdate.catalogService||draft.catalogService)){setOpen(false);onStartBooking?.(bookingUpdate)}
  }catch{
   const fallback=kittenAnswer(trimmed,draft,quote.total);
   setMessages(ms=>ms.map(message=>message.id===id?{...message,answer:fallback,actions:localActions(trimmed)}:message));
   speak(fallback);
  }finally{setBusy(false);setActivity('listening')}
 };
 const runAction=(action:AssistantAction,message:AssistantMessage)=>{if(action.id==='manager'){setManager(true);setOpen(true);return}setOpen(false);if(action.id==='calculator')onOpenCalculator?.();if(action.id==='booking')onStartBooking?.(message.bookingUpdate)};
 return <div className="bw-kitten-support">
  <dialog ref={dialog} className="bw-kitten-dialog" aria-labelledby="kitten-title" onCancel={()=>setOpen(false)}>
   <header><span key={messages.length} className={'bw-kitten-avatar bw-kitten-secretary is-'+activity} aria-hidden="true"/><div><h2 id="kitten-title">Есть вопросы?</h2><small>Помощник Black to White</small><span className="bw-kitten-activity">{activity==='writing'?'Готовлю ответ…':listening?'Слушаю…':voiceEnabled?'Автоозвучка включена':'Нажмите динамик для звука'}</span></div><button type="button" className="bw-kitten-voice-toggle" title={voiceEnabled?'Выключить автоматическую озвучку':'Один раз включите автоматическую озвучку'} aria-pressed={voiceEnabled} aria-label={voiceEnabled?'Выключить автоматическую озвучку':'Включить автоматическую озвучку'} onClick={toggleVoice}>{voiceEnabled?<Volume2 size={17}/>:<VolumeX size={17}/>}</button><button autoFocus className="icon-btn" aria-label="Закрыть поддержку" onClick={()=>setOpen(false)}><X size={19}/></button></header>
   {manager?<div className="bw-kitten-human"><button className="text-btn" onClick={()=>setManager(false)}><ArrowLeft size={16}/> К котику</button>{typeof human==='function'?human(()=>setOpen(false)):human}</div>:<>
    <div className="bw-kitten-log" ref={log} role="log" aria-live="polite"><p className="bw-cat-message">Здравствуйте! Подскажу про виды уборок, подберу подходящий вариант, помогу заполнить заказ и открою его для проверки. Заявка отправится только после вашего подтверждения.</p>{messages.map(m=><React.Fragment key={m.id}><p className="bw-cat-message is-user">{m.question}</p><p className="bw-cat-message">{m.answer||'Готовлю ответ…'}</p>{m.answer&&m.actions.length>0&&<div className="bw-kitten-actions">{m.actions.map(action=><button key={action.id} type="button" onClick={()=>runAction(action,m)}>{action.label}<ArrowUpRight size={14}/></button>)}</div>}</React.Fragment>)}</div>
    <div className="bw-kitten-prompts">{['Что входит в уборку?','Сколько стоит?','Какие средства подходят?'].map(q=><button key={q} disabled={busy} onClick={()=>send(q)}>{q}</button>)}</div>
    <form className="bw-kitten-form" onSubmit={e=>{e.preventDefault();void send(text)}}><label className="sr-only" htmlFor="kitten-question">Ваш вопрос</label><input id="kitten-question" value={text} disabled={busy} onChange={e=>{setText(e.target.value);reactToQuestion()}} maxLength={1000} placeholder={busy?'Готовлю ответ…':listening?'Говорите…':'Напишите вопрос…'}/><button type="button" className={'icon-btn bw-kitten-mic'+(listening?' is-listening':'')} aria-label={listening?'Остановить запись':'Задать вопрос голосом'} disabled={busy} onClick={()=>{if(listening){recognition.current?.stop()}else listen()}}>{listening?<Square size={17}/>:<Mic size={19}/>}</button><button className="icon-btn" aria-label="Отправить вопрос" disabled={busy||!text.trim()}><ArrowUpRight size={21}/></button></form>{voiceError&&<p className="bw-kitten-voice-error" role="status">{voiceError}</p>}{speaking&&<button type="button" className="bw-kitten-stop-speaking" onClick={()=>{audioSource.current?.stop();setSpeaking(false)}}><Square size={13}/> Остановить озвучивание</button>}
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
