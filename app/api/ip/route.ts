import { readJsonBody } from '../../../lib/request-body';
import { z } from 'zod';
import { currentUser, event, fail, guardOrigin, HttpError, json, now, one, requireAdmin, run } from '../../../lib/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const today = () => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};
const innChecksum = (value: string, coefficients: number[]) => coefficients.reduce((sum, coefficient, i) => sum + Number(value[i]) * coefficient, 0) % 11 % 10;
const validInn = (value: string) => /^\d{12}$/.test(value) &&
  innChecksum(value, [7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === Number(value[10]) &&
  innChecksum(value, [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === Number(value[11]);
const validOgrnip = (value: string) => /^\d{15}$/.test(value) && value.slice(0, 14).split('').reduce((remainder, digit) => (remainder * 10 + Number(digit)) % 13, 0) % 10 === Number(value[14]);

export async function POST(req: Request) {
  try {
    guardOrigin(req);
    const user = await currentUser();
    const body = z.discriminatedUnion('action', [
      z.object({ action: z.literal('save'), inn: z.string(), ogrnip: z.string(), consent: z.literal(true) }),
      z.object({ action: z.literal('confirm'), workerId: z.string().uuid(), egripReference: z.string().trim().min(10).max(300), active: z.boolean() }),
    ]).parse(await readJsonBody(req));
    if (body.action === 'save') {
      if (!['cleaner', 'leader'].includes(user.role)) throw new HttpError(403, 'Реквизиты ИП может изменить только исполнитель');
      const inn = body.inn.replace(/\s/g, '');
      const ogrnip = body.ogrnip.replace(/\s/g, '');
      if (!validInn(inn) || !validOgrnip(ogrnip)) throw new HttpError(400, 'Проверьте ИНН и ОГРНИП: контрольные цифры не совпадают');
      const timestamp = now();
      await run('INSERT INTO worker_profiles(member_id,updated) VALUES(?,?) ON CONFLICT(member_id) DO NOTHING', user.id, timestamp);
      await run("UPDATE worker_profiles SET contractor_type='ip',verified=0,ip_inn=?,ip_ogrnip=?,ip_consent_at=?,ip_status=NULL,ip_checked_at=NULL,ip_checked_on=NULL,ip_egrip_reference=NULL,updated=? WHERE member_id=?", inn, ogrnip, timestamp, timestamp, user.id);
      await event(null, user.id, 'Исполнитель предоставил ИНН и ОГРНИП ИП для проверки в ЕГРИП');
      return json({ ok: true, message: 'Реквизиты ИП сохранены. Администратор проверит актуальную выписку ЕГРИП.' });
    }
    requireAdmin(user);
    const profile = await one("SELECT p.contractor_type,p.ip_inn,p.ip_ogrnip,p.ip_consent_at,m.name FROM worker_profiles p JOIN members m ON m.id=p.member_id WHERE p.member_id=? AND m.role IN ('cleaner','leader')", body.workerId);
    if (profile?.contractor_type !== 'ip' || !profile.ip_inn || !profile.ip_ogrnip || !profile.ip_consent_at) throw new HttpError(409, 'Исполнитель не предоставил действующие реквизиты ИП');
    const checkedAt = now();
    const checkedOn = today();
    const saved = await run("UPDATE worker_profiles SET ip_status=?,ip_checked_at=?,ip_checked_on=?,ip_egrip_reference=?,updated=? WHERE member_id=? AND contractor_type='ip' AND ip_inn=? AND ip_ogrnip=?", body.active ? 1 : 0, checkedAt, checkedOn, body.egripReference, checkedAt, body.workerId, profile.ip_inn, profile.ip_ogrnip);
    if (!saved.meta.changes) throw new HttpError(409, 'Реквизиты изменились во время проверки');
    await event(null, user.id, `Администратор проверил ИП ${profile.name} по ИНН ${profile.ip_inn} в ЕГРИП: ${body.active ? 'действует' : 'не действует'}; основание: ${body.egripReference}`);
    return json({ ok: true, result: { status: body.active, checkedAt, checkedOn, message: body.active ? 'Статус ИП подтверждён по выписке ЕГРИП' : 'Статус ИП не подтверждён' } });
  } catch (error) { return fail(error); }
}
