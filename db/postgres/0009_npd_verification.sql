BEGIN;
ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS npd_inn TEXT;
ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS npd_consent_at TEXT;
ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS npd_status SMALLINT CHECK(npd_status IN (0, 1));
ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS npd_checked_at TEXT;
ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS npd_checked_on TEXT;
ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS npd_message TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS npd_check_gate (
  id INTEGER PRIMARY KEY CHECK(id=1),
  last_request_at BIGINT NOT NULL DEFAULT 0
);
INSERT INTO npd_check_gate(id,last_request_at) VALUES(1,0) ON CONFLICT(id) DO NOTHING;
CREATE INDEX IF NOT EXISTS worker_npd_queue_idx ON worker_profiles(npd_checked_on,npd_checked_at) WHERE npd_inn IS NOT NULL AND npd_consent_at IS NOT NULL;
COMMIT;