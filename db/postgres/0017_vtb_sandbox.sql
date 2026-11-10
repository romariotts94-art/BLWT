-- Test gateway operations are isolated from production finance evidence.
CREATE TABLE IF NOT EXISTS vtb_sandbox_attempts (
 id TEXT PRIMARY KEY,
 order_id TEXT NOT NULL REFERENCES orders(id),
 order_number TEXT NOT NULL UNIQUE,
 amount_cents BIGINT NOT NULL CHECK(amount_cents > 0),
 provider_order_id TEXT UNIQUE,
 form_url TEXT,
 state TEXT NOT NULL CHECK(state IN (
  'registering','registration_unknown','registered','authorized','captured',
  'partially_captured','reversed','refunded','partially_refunded','declined'
 )),
 bank_status INTEGER,
 captured_cents BIGINT NOT NULL DEFAULT 0 CHECK(captured_cents >= 0),
 refunded_cents BIGINT NOT NULL DEFAULT 0 CHECK(refunded_cents >= 0),
 pending_action TEXT CHECK(pending_action IN ('capture','reverse','refund')),
 pending_action_id TEXT,
 pending_amount_cents BIGINT CHECK(pending_amount_cents > 0),
 created TEXT NOT NULL,
 updated TEXT NOT NULL
);
-- The first private sandbox was created before this source migration existed.
ALTER TABLE vtb_sandbox_attempts ADD COLUMN IF NOT EXISTS captured_cents BIGINT NOT NULL DEFAULT 0;
ALTER TABLE vtb_sandbox_attempts ADD COLUMN IF NOT EXISTS refunded_cents BIGINT NOT NULL DEFAULT 0;
ALTER TABLE vtb_sandbox_attempts ADD COLUMN IF NOT EXISTS pending_action TEXT;
ALTER TABLE vtb_sandbox_attempts ADD COLUMN IF NOT EXISTS pending_action_id TEXT;
ALTER TABLE vtb_sandbox_attempts ADD COLUMN IF NOT EXISTS pending_amount_cents BIGINT;
ALTER TABLE vtb_sandbox_attempts DROP CONSTRAINT IF EXISTS vtb_sandbox_attempts_state_check;
ALTER TABLE vtb_sandbox_attempts ADD CONSTRAINT vtb_sandbox_attempts_state_check CHECK(state IN (
 'registering','registration_unknown','registered','authorized','captured',
 'partially_captured','reversed','refunded','partially_refunded','declined'
));
CREATE INDEX IF NOT EXISTS vtb_sandbox_attempts_order_idx ON vtb_sandbox_attempts(order_id,created DESC);
CREATE TABLE IF NOT EXISTS vtb_sandbox_events (
 id TEXT PRIMARY KEY,
 attempt_id TEXT NOT NULL REFERENCES vtb_sandbox_attempts(id),
 action TEXT NOT NULL,
 amount_cents BIGINT,
 result TEXT NOT NULL,
 bank_status INTEGER,
 created TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS vtb_sandbox_events_attempt_idx ON vtb_sandbox_events(attempt_id,created DESC);
