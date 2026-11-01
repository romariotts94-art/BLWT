import {readFormBody} from '../../../../lib/request-body';
import {env} from 'cloudflare:workers';
import {currentUser,one,run,uid,now,guardOrigin,HttpError,fail} from '../../../../lib/server';
export const dynamic='force-dynamic';

export async function GET(){try{
 const u=await currentUser();if(u.role!=='admin')throw new HttpError(403,'Доступно администратору');
 const profile=await one('SELECT avatar_key FROM admin_profiles WHERE member_id=?',u.id);
 if(!profile?.avatar_key)throw new HttpError(404,'Фото администратора не добавлено');
 const file=await env.BUCKET?.get(profile.avatar_key);if(!file)throw new HttpError(404,'Фото не найдено');
 return new Response(file.body,{headers:{'Content-Type':file.httpMetadata?.contentType||'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}catch(e){return fail(e)}}

export async function POST(req:Request){try{
 guardOrigin(req);const u=await currentUser();if(u.role!=='admin')throw new HttpError(403,'Доступно администратору');
 if(Number(req.headers.get('content-length')||0)>5*1024*1024)throw new HttpError(413,'Фото должно быть до 4 МБ');
 const file=(await readFormBody(req)).get('file');
 if(!(file instanceof File)||!['image/jpeg','image/png','image/webp'].includes(file.type)||!file.size||file.size>4*1024*1024)throw new HttpError(400,'Выберите JPEG, PNG или WebP до 4 МБ');
 const bytes=new Uint8Array(await file.arrayBuffer());
 const valid=file.type==='image/jpeg'?bytes[0]===255&&bytes[1]===216:file.type==='image/png'?bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10':new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP';
 if(!valid)throw new HttpError(400,'Формат файла не совпадает с изображением');
 if(!env.BUCKET)throw new HttpError(503,'Хранилище фотографий недоступно');
 const key=uid(),previous=await one('SELECT avatar_key FROM admin_profiles WHERE member_id=?',u.id);
 await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:file.type}});
 await run('INSERT INTO admin_profiles(member_id,avatar_key,updated) VALUES(?,?,?) ON CONFLICT(member_id) DO UPDATE SET avatar_key=excluded.avatar_key,updated=excluded.updated',u.id,key,now());
 if(previous?.avatar_key)await env.BUCKET.delete(previous.avatar_key).catch(()=>{});
 return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
}catch(e){return fail(e)}}
