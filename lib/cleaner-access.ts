import { HttpError, one } from './server';

export async function cleanerAccess(user: any, workerId: string) {
  if (user.role === 'admin' || user.id === workerId && ['cleaner', 'leader'].includes(user.role)) return;
  if (!await one(
    "SELECT id FROM orders WHERE client_id=? AND assigned_worker_id=? AND status NOT IN ('cancelled','requested','offered') LIMIT 1",
    user.id,
    workerId,
  )) throw new HttpError(403, 'Профиль доступен по вашему заказу');
}
