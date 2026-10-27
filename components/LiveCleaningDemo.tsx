'use client';
import React,{useEffect,useRef,useState} from 'react';
import {Camera,CheckCircle2,LockKeyhole,MessageCircle,Pause,Play,ShieldCheck,Video} from 'lucide-react';
const clips=[
 {src:'/media/vision-cleaning.mp4',poster:'/media/vision-cleaning-poster.webp',name:'Уборка комнаты',credit:'Liliana Drew / Pexels',source:'https://www.pexels.com/video/a-woman-is-using-a-vacuum-cleaner-in-her-room-9473228/',position:'center'},
 {src:'/media/vision-dusting.mp4',poster:'/media/vision-dusting-poster.webp',name:'Внимание к деталям',credit:'Mixkit',source:'https://mixkit.co/free-stock-video/woman-cleaning-her-house-dancing-43369/',position:'center'},
];
export default function LiveCleaningDemo({benefit,screen,note}:{benefit:number;screen:string;note:string}){
 const [index,setIndex]=useState(0),[loaded,setLoaded]=useState(false),[visible,setVisible]=useState(false),[enabled,setEnabled]=useState(false),[playing,setPlaying]=useState(false),[failed,setFailed]=useState(false);
 const frame=useRef<HTMLDivElement>(null),video=useRef<HTMLVideoElement>(null);
 const clip=clips[index];
 useEffect(()=>{const mq=matchMedia('(prefers-reduced-motion: reduce)');setEnabled(!mq.matches);const change=()=>setEnabled(!mq.matches);mq.addEventListener('change',change);return()=>mq.removeEventListener('change',change)},[]);
 useEffect(()=>{const el=frame.current;if(!el)return;const observer=new IntersectionObserver(([entry])=>{setVisible(entry.isIntersecting);if(entry.isIntersecting)setLoaded(true)},{threshold:.25});observer.observe(el);return()=>observer.disconnect()},[]);
 useEffect(()=>{const el=video.current;if(!el)return;const sync=()=>{if(enabled&&visible&&!document.hidden&&!failed){el.play().catch(()=>setPlaying(false))}else el.pause()};sync();document.addEventListener('visibilitychange',sync);return()=>document.removeEventListener('visibilitychange',sync)},[enabled,visible,index,loaded,failed]);
 const select=(i:number)=>{setFailed(false);setIndex(i);setLoaded(true)};
 const toggle=()=>{const el=video.current;if(!el)return;if(playing){setEnabled(false);el.pause()}else{setFailed(false);setLoaded(true);setEnabled(true);if(failed)el.load();el.play().catch(()=>setPlaying(false))}};
 return <div className="bw-live-demo bw-vision-player" ref={frame}><div className="bw-demo-top"><span><span className="bw-live-dot"/> ПРИМЕР КАБИНЕТА</span><span className="bw-vision-demo-tag">СТОКОВОЕ ВИДЕО</span></div><div className={'bw-demo-picture bw-vision-picture clip-'+index} style={{backgroundImage:`url(${clip.poster})`}}>
 <video key={clip.src} ref={video} src={loaded?clip.src:undefined} poster={clip.poster} muted playsInline preload={loaded?'metadata':'none'} aria-label={'Демонстрационный ролик: '+clip.name} style={{objectPosition:clip.position}} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>{if(enabled)select((index+1)%clips.length)}} onError={()=>{setFailed(true);setPlaying(false)}}/>
 <span className="bw-demo-camera"><Camera size={15}/> Вид с камеры · демо</span><span className="bw-vision-privacy"><LockKeyhole size={13}/> Без звука</span>
 </div><div className="bw-vision-message"><strong>{screen}</strong>{benefit===1?<span><CheckCircle2 size={17}/> Кухня · в работе<br/>Полы · следующий этап</span>:benefit===2?<span><MessageCircle size={17}/> «Пожалуйста, уделите внимание плинтусам»<br/>Пример сообщения</span>:<span><ShieldCheck size={17}/> Приватный доступ по заказу</span>}</div>
 <div className="bw-vision-playback"><div role="group" aria-label="Демонстрационные видео">{clips.map((c,i)=><button key={c.src} onClick={()=>select(i)} aria-pressed={index===i} aria-label={'Показать видео: '+c.name}><span>0{i+1}</span><small>{c.name}</small></button>)}</div><button className="bw-vision-pause" onClick={toggle} aria-label={failed?'Повторить загрузку видео':playing?'Приостановить демо':'Воспроизвести демо'}>{playing?<Pause size={18}/>:<Play size={18}/>}</button></div>
 <div className="bw-demo-footer"><Video size={22}/><p>{note}</p></div><div className="bw-vision-credit"><span>{failed?'Видео не загрузилось. Можно повторить или выбрать другой ролик.':'Стоковая демонстрация интерфейса. Не реальный заказ.'}</span><a href={clip.source} target="_blank" rel="noreferrer">Видео: {clip.credit}</a></div></div>
}
