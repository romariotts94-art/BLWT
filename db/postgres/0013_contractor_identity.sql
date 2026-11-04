ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS legal_name TEXT;
ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS claim_email TEXT;
ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS legal_checked_at TEXT;
