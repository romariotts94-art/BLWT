import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { all, currentUser, guardOrigin, HttpError, json, fail, now, one, orderAccess, requireAdmin, run, uid, event } from '../../../lib/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

export async function GET(req: Request) {
  try {
    const u = await currentUser();
    const url=new URL(req.url),workerId=url.searchParams.get('worker');
    if(workerId){if(u.role!=='admin'&&(u.id!==workerId||!['cleaner','leader'].includes(u.role)))throw new HttpError(403,'Нет доступа');return json({documents:await all('SELECT * FROM documents WHERE worker_id=? ORDER BY created DESC',workerId)});}
    const orderId = url.searchParams.get('order');
    if (orderId) await orderAccess(orderId, u);
    else if (u.role !== 'admin') throw new HttpError(403, 'Документы доступны в карточке заказа');
    const rows = orderId
      ? await all('SELECT d.*, m.name AS uploader_name FROM documents d LEFT JOIN members m ON m.id=d.uploader_id WHERE d.order_id=? ORDER BY d.created DESC', orderId)
      : await all('SELECT d.*, m.name AS uploader_name FROM documents d LEFT JOIN members m ON m.id=d.uploader_id ORDER BY d.created DESC LIMIT 300');
    return json({ documents: u.role==='admin'?rows:rows.filter(d=>d.uploader_id===u.id).map(d=>({...d,uploader_name:'Вы'})) });
  } catch (e) { return fail(e); }
}

export async function POST(req: Request) {
  try {
    guardOrigin(req);
    if (Number(req.headers.get('content-length') || 0) > 16 * 1024 * 1024) throw new HttpError(413, 'Документ должен быть не больше 15 МБ');
    const u = await currentUser();
    const form = await req.formData();
    const orderId = String(form.get('order') || '');
    const file = form.get('file');
    const workerId=String(form.get('worker')||'');
    if(workerId){if(u.role!=='admin'&&(u.id!==workerId||!['cleaner','leader'].includes(u.role)))throw new HttpError(403,'Нет доступа');if(!await one("SELECT id FROM members WHERE id=? AND role IN ('cleaner','leader')",workerId))throw new HttpError(404,'Сотрудник не найден');if(!(file instanceof File)||!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type)||!file.size||file.size>15*1024*1024)throw new HttpError(400,'Нужен PDF или изображение до 15 МБ');const bytes=new Uint8Array(await file.arrayBuffer());const signature=new TextDecoder().decode(bytes.slice(0,5));const valid=file.type==='application/pdf'?signature==='%PDF-':file.type==='image/jpeg'?bytes[0]===255&&bytes[1]===216:file.type==='image/png'?bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10':signature.startsWith('RIFF')&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP';if(!valid)throw new HttpError(400,'Содержимое файла не соответствует типу');if(!(env as any).BUCKET)throw new HttpError(503,'Хранилище недоступно');if(Number((await one('SELECT COUNT(*) AS n FROM documents WHERE worker_id=?',workerId)).n)>=50)throw new HttpError(400,'Лимит 50 документов');const id=uid();await (env as any).BUCKET.put(id,bytes);await run('INSERT INTO documents(id,worker_id,uploader_id,name,mime,size,storage_key,review_status,review_note,created) VALUES(?,?,?,?,?,?,?,?,?,?)',id,workerId,u.id,file.name.slice(0,200),file.type,file.size,id,'pending','',now());return json({ok:true,id});}
    if (!orderId || !z.string().uuid().safeParse(orderId).success) throw new HttpError(400, 'Не указан заказ');
    const o = await orderAccess(orderId, u);
    if (u.role !== 'admin' && !o.crew.includes(u.id)) throw new HttpError(403, 'Документы загружает назначенная команда');
    if (!(file instanceof File) || !allowed.has(file.type) || file.size > 15 * 1024 * 1024) throw new HttpError(400, 'Поддерживаются PDF, DOCX и изображения до 15 МБ');
    if (!(env as any).BUCKET) throw new HttpError(503, 'Хранилище документов пока не подключено');
    const id = uid();
    await (env as any).BUCKET.put(id, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
    await run('INSERT INTO documents(id,order_id,uploader_id,name,mime,size,storage_key,review_status,review_note,created) VALUES(?,?,?,?,?,?,?,?,?,?)', id, orderId, u.id, file.name.slice(0, 200), file.type, file.size, id, 'pending', '', now());
    await event(orderId, u.id, `Загружен документ: ${file.name.slice(0, 80)}`);
    return json({ ok: true, id });
  } catch (e) { return fail(e); }
}

export async function PATCH(req: Request) {
  try {
    guardOrigin(req); const u = await currentUser(); requireAdmin(u);
    const body = z.object({ id: z.string().uuid(), status: z.enum(['approved', 'rejected']), note: z.string().max(500).default('') }).parse(await req.json());
    const doc = await one('SELECT * FROM documents WHERE id=?', body.id); if (!doc) throw new HttpError(404, 'Документ не найден');
    await run('UPDATE documents SET review_status=?,review_note=?,reviewed_at=? WHERE id=?', body.status, body.note, now(), body.id);
    await event(doc.order_id || null, u.id, body.status === 'approved' ? 'Документ проверен' : 'Документ отправлен на замену');
    return json({ ok: true });
  } catch (e) { return fail(e); }
}
