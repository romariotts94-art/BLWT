import { currentUser, fail, guardOrigin, HttpError } from '../../../lib/server';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Existing profiles remain available; enrollment in this launch is limited to NPD individuals.
export async function POST(req: Request) {
 try {
  guardOrigin(req);
  await currentUser();
  throw new HttpError(409, 'В текущем запуске участвуют только самозанятые без статуса ИП. Подключение ИП-исполнителей недоступно.');
 } catch (error) { return fail(error); }
}
