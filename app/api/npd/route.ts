import { z } from 'zod';
import { all, currentUser, event, fail, guardOrigin, HttpError, json, now, one, requireAdmin, run, uid } from '../../../lib/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const innSchema = z.string().trim().regex(/^(?:\d{10}|\d{12})$/, 'Введите ИНН из 10 или 12 цифр');
const COEFFICIENTS_10 = [2, 4, 10, 3, 5, 9, 4, 6, 8];
const COEFFICIENTS_11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
const COEFFICIENTS_12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
function checksum(digits: string, coefficients: number[]) {
  return coefficients.reduce((sum, coefficient, i) => sum + Number(digits[i]) * coefficient, 0) % 11 % 10;
}
function validInn(value: string) {
  const digits = innSchema.parse(value);
  if (digits.length === 10) return checksum(digits, COEFFICIENTS_10) === Number(digits[9]);
  return checksum(digits, COEFFICIENTS_11) === Number(digits[10]) && checksum(digits, COEFFICIENTS_12) === Number(digits[11]);
}
const today = () => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

export async function GET(req: Request) {
  try {
    const user = await currentUser();
    const workerId = new URL(req.url).searchParams.get('worker') || user.id;
    if (user.role !== 'admin' && (workerId !== user.id || !['cleaner', 'leader'].includes(user.role))) throw new HttpError(403, 'Нет доступа к статусу исполнителя');
    const profile = await one("SELECT p.npd_inn,p.npd_consent_at,p.npd_status,p.npd_checked_at,p.npd_checked_on,p.npd_message,m.name FROM worker_profiles p JOIN members m ON m.id=p.member_id WHERE p.member_id=? AND m.role IN ('cleaner','leader')", workerId);
    if (!profile) throw new HttpError(404, 'Анкета исполнителя не найдена');
    return json({ status: profile });
  } catch (error) { return fail(error); }
}

export async function POST(req: Request) {
  try {
    guardOrigin(req);
    const user = await currentUser();
    const body = z.object({ action: z.enum(['saveInn', 'check']), workerId: z.string().uuid().optional(), inn: z.string().optional(), consent: z.boolean().optional() }).parse(await req.json());
    if (body.action === 'saveInn') {
      if (!['cleaner', 'leader'].includes(user.role)) throw new HttpError(403, 'ИНН в анкете может изменить только исполнитель');
      if (body.consent !== true) throw new HttpError(400, 'Подтвердите согласие на ежедневную проверку статуса в ФНС');
      const inn = body.inn ? body.inn.replace(/\s/g, '') : '';
      if (!validInn(inn)) throw new HttpError(400, 'Проверьте ИНН: контрольные цифры не совпадают');
      await run('INSERT INTO worker_profiles(member_id,updated) VALUES(?,?) ON CONFLICT(member_id) DO NOTHING', user.id, now());
      await run('UPDATE worker_profiles SET npd_inn=?,npd_consent_at=?,npd_status=NULL,npd_checked_at=NULL,npd_checked_on=NULL,npd_message=?,updated=? WHERE member_id=?', inn, now(), 'Ожидает проверки ФНС', now(), user.id);
      await event(null, user.id, 'Исполнитель предоставил ИНН и согласие на ежедневную проверку НПД');
      return json({ ok: true, message: 'ИНН сохранён. После проверки ФНС статус появится в анкете.' });
    }

    requireAdmin(user);
    const workerId = z.string().uuid().parse(body.workerId);
    const profile = await one("SELECT p.npd_inn,p.npd_consent_at,m.name FROM worker_profiles p JOIN members m ON m.id=p.member_id WHERE p.member_id=? AND m.role IN ('cleaner','leader')", workerId);
    if (!profile?.npd_inn || !profile.npd_consent_at) throw new HttpError(409, 'Исполнитель ещё не предоставил ИНН и согласие на проверку');
    const nowMs = Date.now();
    const reserved = await run('UPDATE npd_check_gate SET last_request_at=? WHERE id=1 AND last_request_at<=?', nowMs, nowMs - 35_000);
    if (!reserved.meta.changes) throw new HttpError(429, 'Сервис ФНС ограничивает частоту проверок. Попробуйте через минуту.');

    const requestDate = today();
    let status: boolean | null = null;
    let message = '';
    try {
      const response = await fetch('https://statusnpd.nalog.ru/api/v1/tracker/taxpayer_status', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ inn: String(profile.npd_inn), requestDate }), signal: AbortSignal.timeout(60_000),
      });
      const result = await response.json() as { status?: unknown; message?: unknown };
      if (!response.ok || typeof result.status !== 'boolean') throw new Error(typeof result.message === 'string' ? result.message : 'ФНС не вернула результат проверки');
      status = result.status;
      message = typeof result.message === 'string' ? result.message : status ? 'Зарегистрирован плательщиком НПД' : 'Не зарегистрирован плательщиком НПД';
    } catch (error: any) {
      message = error?.name === 'TimeoutError' ? 'ФНС не ответила за отведённое время. Повторная проверка будет доступна позже.' : `Не удалось получить подтверждение ФНС: ${String(error?.message || 'сервис недоступен').slice(0, 250)}`;
    }

    const checkedAt = now();
    await run('UPDATE worker_profiles SET npd_status=?,npd_checked_at=?,npd_checked_on=?,npd_message=?,updated=? WHERE member_id=?', status === null ? null : status ? 1 : 0, checkedAt, requestDate, message, checkedAt, workerId);
    await event(null, user.id, `Проверен статус НПД исполнителя ${profile.name}: ${status === null ? 'ошибка проверки' : status ? 'активен' : 'не зарегистрирован'}`);
    const notice = status === true ? 'ФНС подтвердила активный статус самозанятого. Приём заказов разрешён.' : status === false ? 'ФНС не подтвердила статус самозанятого. Приём новых заказов приостановлен. Оформите НПД и сообщите администрации.' : 'Проверка ФНС не завершилась. Приём новых заказов временно приостановлен до подтверждения статуса.';
    await run('INSERT INTO notices(id,user_id,text,created) VALUES(?,?,?,?)', uid(), workerId, notice, checkedAt);
    return json({ ok: true, result: { status, checkedAt, checkedOn: requestDate, message } });
  } catch (error) { return fail(error); }
}