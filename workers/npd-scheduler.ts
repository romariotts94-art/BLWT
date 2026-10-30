type Env = { DB: D1Database };

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(checkOne(env.DB));
  },
};

async function checkOne(db: D1Database) {
  const dateParts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const dateValues = Object.fromEntries(dateParts.map(part => [part.type, part.value]));
  const date = `${dateValues.year}-${dateValues.month}-${dateValues.day}`;
  const row = await db.prepare(`SELECT p.member_id,p.npd_inn,p.npd_status,m.name
    FROM worker_profiles p JOIN members m ON m.id=p.member_id
    WHERE p.npd_inn IS NOT NULL AND p.npd_consent_at IS NOT NULL
      AND (p.npd_checked_on IS NULL OR p.npd_checked_on<>? OR (p.npd_status IS NULL AND p.npd_checked_at<?))
      AND m.active=1 AND m.role IN ('cleaner','leader')
    ORDER BY COALESCE(p.npd_checked_on,'0000-00-00'),COALESCE(p.npd_checked_at,'')
  LIMIT 1`).bind(date, new Date(Date.now() - 15 * 60_000).toISOString()).first<any>();
  if (!row) return;

  const timestamp = Date.now();
  const gate = await db.prepare('SELECT last_request_at FROM npd_check_gate WHERE id=1').first<any>();
  if (gate && timestamp - Number(gate.last_request_at) < 35_000) return;
  const reserved = await db.prepare('UPDATE npd_check_gate SET last_request_at=? WHERE id=1 AND last_request_at<=?')
    .bind(timestamp, timestamp - 35_000).run();
  if (!reserved.meta.changes) return;

  let status: boolean | null = null;
  let message = '';
  try {
    const response = await fetch('https://statusnpd.nalog.ru/api/v1/tracker/taxpayer_status', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ inn: String(row.npd_inn), requestDate: date }), signal: AbortSignal.timeout(60_000),
    });
    const result = await response.json() as { status?: unknown; message?: unknown };
    if (!response.ok || typeof result.status !== 'boolean') throw new Error(typeof result.message === 'string' ? result.message : 'Сервис ФНС не вернул статус');
    status = result.status;
    message = typeof result.message === 'string' ? result.message : status ? 'Зарегистрирован плательщиком НПД' : 'Не зарегистрирован плательщиком НПД';
  } catch (error: any) {
    message = error?.name === 'TimeoutError' ? 'ФНС не ответила за 60 секунд' : `Ошибка проверки ФНС: ${String(error?.message || 'сервис недоступен').slice(0, 220)}`;
  }

  const checkedAt = new Date().toISOString();
  await db.prepare('UPDATE worker_profiles SET npd_status=?,npd_checked_at=?,npd_checked_on=?,npd_message=?,updated=? WHERE member_id=?')
    .bind(status === null ? null : status ? 1 : 0, checkedAt, date, message, checkedAt, row.member_id).run();
  if (row.npd_status !== (status === null ? null : status ? 1 : 0)) {
    const notice = status === true ? 'ФНС подтвердила активный статус самозанятого. Приём заказов разрешён.'
      : status === false ? 'ФНС не подтвердила статус самозанятого. Приём новых заказов приостановлен. Оформите НПД и сообщите администрации.'
      : 'ФНС не удалось проверить. Приём новых заказов временно приостановлен до подтверждения статуса.';
    await db.prepare('INSERT INTO notices(id,user_id,text,created) VALUES(?,?,?,?)')
      .bind(crypto.randomUUID(), row.member_id, notice, checkedAt).run();
  }
}