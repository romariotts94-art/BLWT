import { env } from 'cloudflare:workers';
import { currentUser, fail, HttpError, one, orderAccess } from '../../../../lib/server';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const u = await currentUser(); const id = new URL(req.url).searchParams.get('id');
    const doc = await one('SELECT * FROM documents WHERE id=?', id); if (!doc) throw new HttpError(404, 'Документ не найден');
    if(doc.worker_id){if(u.role!=='admin'&&doc.worker_id!==u.id)throw new HttpError(403,'Нет доступа');}else await orderAccess(doc.order_id, u);
    if(!doc.worker_id&&u.role!=='admin'&&doc.uploader_id!==u.id)throw new HttpError(403,'Этот документ доступен загрузившему его сотруднику и администратору');
    const object = await (env as any).BUCKET?.get(doc.storage_key);
    if (!object) throw new HttpError(404, 'Файл не найден в хранилище');
    return new Response(object.body, { headers: { 'Content-Type': doc.mime, 'Content-Disposition': `attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(doc.name)}`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (e) { return fail(e); }
}
