import { randomUUID } from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 15_000,
});

const POLL_INTERVAL_MS = 60_000;
const RETRY_AFTER_MS = 15 * 60_000;
const REQUEST_GATE_MS = 35_000;
const advisoryLockKeys = [1_263_943_508, 1_431_198_772];
let stopping = false;

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

function moscowDate() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function checkOne() {
  const client = await pool.connect();
  let locked = false;

  try {
    const lock = await client.query('SELECT pg_try_advisory_lock($1, $2) AS locked', advisoryLockKeys);
    locked = lock.rows[0]?.locked === true;
    if (!locked) return;

    const requestDate = moscowDate();
    const retryBefore = new Date(Date.now() - RETRY_AFTER_MS).toISOString();
    const due = await client.query(
      `SELECT p.member_id, p.npd_inn, p.npd_status
       FROM worker_profiles p
       JOIN members m ON m.id = p.member_id
       WHERE p.npd_inn IS NOT NULL
         AND p.npd_consent_at IS NOT NULL
         AND (
           p.npd_checked_on IS NULL
           OR p.npd_checked_on <> $1
           OR (p.npd_status IS NULL AND p.npd_checked_at < $2)
         )
         AND m.active = 1
         AND m.role IN ('cleaner', 'leader')
       ORDER BY COALESCE(p.npd_checked_on, '0000-00-00'), COALESCE(p.npd_checked_at, '')
       LIMIT 1`,
      [requestDate, retryBefore],
    );
    const worker = due.rows[0];
    if (!worker) return;

    const nowMs = Date.now();
    const reserved = await client.query(
      `UPDATE npd_check_gate
       SET last_request_at = $1
       WHERE id = 1 AND last_request_at <= $2
       RETURNING id`,
      [nowMs, nowMs - REQUEST_GATE_MS],
    );
    if (reserved.rowCount !== 1) return;

    let status = null;
    let message = '';
    try {
      const response = await fetch('https://statusnpd.nalog.ru/api/v1/tracker/taxpayer_status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ inn: String(worker.npd_inn), requestDate }),
        signal: AbortSignal.timeout(60_000),
      });
      const result = await response.json();
      if (!response.ok || typeof result.status !== 'boolean') {
        throw new Error(typeof result.message === 'string' ? result.message : 'Сервис ФНС не вернул статус');
      }
      status = result.status;
      message = typeof result.message === 'string'
        ? result.message
        : status
          ? 'Зарегистрирован плательщиком НПД'
          : 'Не зарегистрирован плательщиком НПД';
    } catch (error) {
      message = error?.name === 'TimeoutError'
        ? 'ФНС не ответила за 60 секунд'
        : `Ошибка проверки ФНС: ${String(error?.message || 'сервис недоступен').slice(0, 220)}`;
    }

    const checkedAt = new Date().toISOString();
    const dbStatus = status === null ? null : status ? 1 : 0;
    const notice = status === true
      ? 'ФНС подтвердила активный статус самозанятого. Приём заказов разрешён.'
      : status === false
        ? 'ФНС не подтвердила статус самозанятого. Приём новых заказов приостановлен. Оформите НПД и сообщите администрации.'
        : 'ФНС не удалось проверить. Приём новых заказов временно приостановлен до подтверждения статуса.';

    await client.query('BEGIN');
    try {
      await client.query(
        `UPDATE worker_profiles
         SET npd_status = $1, npd_checked_at = $2, npd_checked_on = $3, npd_message = $4, updated = $2
         WHERE member_id = $5`,
        [dbStatus, checkedAt, requestDate, message, worker.member_id],
      );

      const previousStatus = worker.npd_status === null ? null : Number(worker.npd_status);
      if (previousStatus !== dbStatus) {
        await client.query(
          'INSERT INTO notices(id, user_id, text, created) VALUES($1, $2, $3, $4)',
          [randomUUID(), worker.member_id, notice, checkedAt],
        );
      }
      await client.query('COMMIT');
      console.log(`NPD check finished: ${dbStatus === null ? 'unconfirmed' : dbStatus === 1 ? 'active' : 'inactive'}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } finally {
    if (locked) {
      try {
        await client.query('SELECT pg_advisory_unlock($1, $2)', advisoryLockKeys);
      } catch {}
    }
    client.release();
  }
}

async function tick() {
  if (stopping) return;
  try {
    await checkOne();
  } catch (error) {
    console.error('NPD scheduler tick failed:', error?.message || 'unknown error');
  }
}

process.on('SIGTERM', () => { stopping = true; });
process.on('SIGINT', () => { stopping = true; });

await pool.query('SELECT 1 FROM npd_check_gate WHERE id = 1');
console.log('NPD PostgreSQL scheduler started; polling every 60 seconds.');
await tick();
const timer = setInterval(() => { void tick(); }, POLL_INTERVAL_MS);

async function shutdown() {
  stopping = true;
  clearInterval(timer);
  await pool.end();
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
