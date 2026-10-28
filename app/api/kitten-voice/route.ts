import {z} from 'zod';
import {env} from 'cloudflare:workers';
import {guardOrigin} from '../../../lib/server';

export const dynamic='force-dynamic';

const schema=z.object({text:z.string().trim().min(1).max(600)});
const requests=new Map<string,{count:number;reset:number}>();

function allowRequest(req:Request){
 const ip=req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')?.split(',')[0].trim()||'unknown';
 const now=Date.now(),current=requests.get(ip);
 if(!current||current.reset<=now){requests.set(ip,{count:1,reset:now+60_000});return true;}
 if(current.count>=20)return false;
 current.count+=1;return true;
}

export async function POST(req:Request){
 try{
  guardOrigin(req);
  if(!allowRequest(req))return Response.json({error:'Слишком много запросов. Попробуйте через минуту.'},{status:429,headers:{'Cache-Control':'no-store'}});
  const {text}=schema.parse(await req.json());
  const runtimeEnv=env as unknown as Record<string,unknown>;
  const apiKey=String(runtimeEnv.QWEN_API_KEY||'').trim();
  if(!apiKey)return Response.json({error:'Озвучивание пока не настроено.'},{status:503,headers:{'Cache-Control':'no-store'}});

  const response=await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',{
   method:'POST',
   headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
   body:JSON.stringify({model:'qwen3-tts-flash',input:{text,voice:'Cherry',language_type:'Russian'}}),
  });
  if(!response.ok){
   console.error('Qwen TTS request failed',response.status,(await response.text()).slice(0,300));
   return Response.json({error:'Не удалось подготовить озвучивание.'},{status:502,headers:{'Cache-Control':'no-store'}});
  }
  const payload=await response.json() as {output?:{audio?:{url?:string}}};
  const audioUrl=payload.output?.audio?.url;
  if(!audioUrl)return Response.json({error:'Сервис речи не вернул аудио.'},{status:502,headers:{'Cache-Control':'no-store'}});
  const parsedAudioUrl=new URL(audioUrl);
  if(!['http:','https:'].includes(parsedAudioUrl.protocol)||!parsedAudioUrl.hostname.endsWith('.aliyuncs.com'))throw new Error('Unexpected Qwen audio URL');
  parsedAudioUrl.protocol='https:';
  const audio=await fetch(parsedAudioUrl);
  if(!audio.ok)throw new Error(`Qwen audio download failed: ${audio.status}`);
  return new Response(await audio.arrayBuffer(),{headers:{'Content-Type':audio.headers.get('content-type')||'audio/mpeg','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch(error:unknown){
  const details=error&&typeof error==='object'?error as {issues?:unknown}:{ };
  return Response.json({error:details.issues?'Проверьте текст для озвучивания.':'Не удалось подготовить озвучивание.'},{status:details.issues?400:500,headers:{'Cache-Control':'no-store'}});
 }
}
