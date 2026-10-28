import {env} from 'cloudflare:workers';
import {currentUser,fail,guardOrigin,HttpError,json,now,one,run,uid} from '../../../../lib/server';

export const dynamic='force-dynamic';
export const runtime='nodejs';
const prefix='Фото работы · ';

async function canSee(u:any,workerId:string){
 if(u.role==='admin'||u.id===workerId&&['cleaner','leader'].includes(u.role))return;
 if(!await one("SELECT id FROM orders WHERE client_id=? AND assigned_worker_id=? AND status NOT IN ('cancelled','requested','offered') LIMIT 1",u.id,workerId))throw new HttpError(403,'Фото доступны только клиенту назначенного заказа');
}

function validImage(file:File,bytes:Uint8Array){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||!file.size||file.size>8*1024*1024)throw new HttpError(400,'Нужно изображение JPEG, PNG или WebP до 8 МБ');
 return file.type==='image/jpeg'?bytes[0]===255&&bytes[1]===216:file.type==='image/png'?bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10':new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP';
}

export async function GET(req:Request){try{
 const u=await currentUser(),id=new URL(req.url).searchParams.get('id')||'',doc=await one("SELECT * FROM documents WHERE id=? AND name LIKE ?",id,prefix+'%');
 if(!doc)throw new HttpError(404,'Фото работы не найдено');await canSee(u,doc.worker_id);const object=await (env as any).BUCKET?.get(doc.storage_key);if(!object)throw new HttpError(404,'Фото работы не найдено в хранилище');
 return new Response(object.body,{headers:{'Content-Type':doc.mime,'Content-Disposition':'inline','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}catch(e){return fail(e)}}

export async function POST(req:Request){try{
 guardOrigin(req);const u=await currentUser(),form=await req.formData(),workerId=String(form.get('worker')||u.id),file=form.get('file');
 if(u.role!=='admin'&&(u.id!==workerId||!['cleaner','leader'].includes(u.role)))throw new HttpError(403,'Нет доступа');
 if(!await one("SELECT id FROM members WHERE id=? AND role IN ('cleaner','leader')",workerId))throw new HttpError(404,'Исполнитель не найден');
 if(!(file instanceof File))throw new HttpError(400,'Выберите фотографию');const bytes=new Uint8Array(await file.arrayBuffer());if(!validImage(file,bytes))throw new HttpError(400,'Содержимое файла не соответствует типу');
 if(!(env as any).BUCKET)throw new HttpError(503,'Хранилище фотографий пока не подключено');if(Number((await one("SELECT COUNT(*) AS n FROM documents WHERE worker_id=? AND name LIKE ?",workerId,prefix+'%')).n)>=12)throw new HttpError(400,'Можно добавить до 12 фотографий работ');
 const id=uid();await (env as any).BUCKET.put(id,bytes,{httpMetadata:{contentType:file.type}});await run('INSERT INTO documents(id,worker_id,uploader_id,name,mime,size,storage_key,review_status,review_note,created) VALUES(?,?,?,?,?,?,?,?,?,?)',id,workerId,u.id,prefix+file.name.slice(0,180),file.type,file.size,id,'approved','',now());return json({ok:true,id});
}catch(e){return fail(e)}}

export async function DELETE(req:Request){try{
 guardOrigin(req);const u=await currentUser(),id=new URL(req.url).searchParams.get('id')||'',doc=await one("SELECT * FROM documents WHERE id=? AND name LIKE ?",id,prefix+'%');if(!doc)throw new HttpError(404,'Фото работы не найдено');
 if(u.role!=='admin'&&u.id!==doc.worker_id)throw new HttpError(403,'Нет доступа');await (env as any).BUCKET?.delete(doc.storage_key);await run('DELETE FROM documents WHERE id=?',id);return json({ok:true});
}catch(e){return fail(e)}}
