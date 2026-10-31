import { randomUUID } from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 15_000,
});

const DAILY_RUN_HOUR = 6;
const REQUEST_GATE_MS = 35_000;
const advisoryLockKeys = [1_263_943_508, 1_431_198_772];
let stopping = false;
let timer;

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

function moscowParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, Number(value)]));
}

function moscowDate(parts = moscowParts()) {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function nextDailyRunDelayMs(now = new Date()) {
  const local = moscowParts(now);
  const localWallClock = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
  const utcAtWholeSecond = Math.floor(now.getTime() / 1000) * 1000;
  const moscowOffsetMs = localWallClock - utcAtWholeSecond;
  let nextRunWallClock = Date.UTC(local.year, local.month - 1, local.day, DAILY_RUN_HOUR);
  if (local.hour >= DAILY_RUN_HOUR) nextRunWallClock += 24 * 60 * 60 * 1000;
  return Math.max(1_000, nextRunWallClock - moscowOffsetMs - now.getTime());
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function reserveRequestSlot(client) {
  while (!stopping) {
    const nowMs = Date.now();
    const reserved = await client.query(
      `UPDATE npd_check_gate
       SET last_request_at = $1
       WHERE id = 1 AND last_request_at <= $2
       RETURNING id`,
      [nowMs, nowMs - REQUEST_GATE_MS],
    );
    if (reserved.rowCount === 1) return true;

    const gate = await client.query('SELECT last_request_at FROM npd_check_gate WHERE id = 1');
    const lastRequestAt = Number(gate.rows[0]?.last_request_at || 0);
    await sleep(Math.max(1_000, lastRequestAt + REQUEST_GATE_MS - Date.now() + 100));
  }
  return false;
}

async function checkWorker(client, worker, requestDate) {
  if (!await reserveRequestSlot(client)) return false;

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
  return true;
}

async function runDailyChecks() {
  if (stopping) return;
  const client = await pool.connect();
  let locked = false;

  try {
    const lock = await client.query('SELECT pg_try_advisory_lock($1, $2) AS locked', advisoryLockKeys);
    locked = lock.rows[0]?.locked === true;
    if (!locked) {
      console.log('NPD morning check skipped: another checker holds the lock.');
      return;
    }

    const requestDate = moscowDate();
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
       ORDER BY COALESCE(p.npd_checked_on, '0000-00-00'), COALESCE(p.npd_checked_at, '')`,
      [requestDate, new Date(Date.now() - 15 * 60_000).toISOString()],
    );

    console.log(`NPD morning check started: ${due.rowCount} eligible worker(s).`);
    for (const worker of due.rows) {
      if (stopping) break;
      await checkWorker(client, worker, requestDate);
    }
    console.log('NPD morning check finished.');
  } catch (error) {
    console.error('NPD morning check failed:', error?.message || 'unknown error');
  } finally {
    if (locked) {
      try {
        await client.query('SELECT pg_advisory_unlock($1, $2)', advisoryLockKeys);
      } catch {}
    }
    client.release();
  }
}

function scheduleNextRun() {
  if (stopping) return;
  const delay = nextDailyRunDelayMs();
  console.log(`Next NPD check scheduled in ${Math.round(delay / 60_000)} minute(s), at 06:00 Europe/Moscow.`);
  timer = setTimeout(async () => {
    await runDailyChecks();
    scheduleNextRun();
  }, delay);
}

process.on('SIGTERM', () => { stopping = true; });
process.on('SIGINT', () => { stopping = true; });

await pool.query('SELECT 1 FROM npd_check_gate WHERE id = 1');
console.log('NPD PostgreSQL scheduler started; one daily run at 06:00 Europe/Moscow.');
scheduleNextRun();

async function shutdown() {
  stopping = true;
  clearTimeout(timer);
  await pool.end();
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
