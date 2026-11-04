import { currentUser, fail, HttpError, json, one, orderAccess } from '../../../lib/server';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Client agreements must identify the actual contractor. The old version 1.0
// named the platform as the cleaning provider and cannot be accepted.
export async function GET(req: Request) {
  try {
    const user = await currentUser();
    const orderId = new URL(req.url).searchParams.get('order');
    if (!orderId) throw new HttpError(400, 'Не указан заказ');
    const order = await orderAccess(orderId, user);
    if (user.role !== 'admin' && order.clientId !== user.id) {
      const agreement = await one("SELECT id,version,body,body_hash,state,accepted_at FROM worker_agreements WHERE order_id=? AND worker_id=? AND state<>'void' ORDER BY created DESC LIMIT 1", orderId, user.id);
      if (!agreement) throw new HttpError(404, 'Договор исполнителя не сформирован');
      return json(agreement);
    }
    const contract = await one('SELECT * FROM contracts WHERE order_id=?', orderId);
    if (!contract || contract.version === '1.0') throw new HttpError(409, 'Договор с конкретным исполнителем ещё не сформирован. Типовой договор прежней версии недоступен для подтверждения.');
    return json(user.role === 'admin' ? contract : { id: contract.id, order_id: contract.order_id, version: contract.version, body: contract.body, client_accepted_at: contract.client_accepted_at, created: contract.created });
  } catch (error) { return fail(error); }
}

export async function POST() {
  try {
    throw new HttpError(409, 'Подтверждение старого типового договора отключено. Сначала нужно сформировать договор с проверенными данными конкретного исполнителя.');
  } catch (error) { return fail(error); }
}
