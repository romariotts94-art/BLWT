-- Two allowed contractor statuses: NPD or registered individual entrepreneur.
ALTER TABLE worker_profiles ADD COLUMN contractor_type TEXT NOT NULL DEFAULT 'npd' CHECK(contractor_type IN ('npd','ip'));
ALTER TABLE worker_profiles ADD COLUMN ip_inn TEXT;
ALTER TABLE worker_profiles ADD COLUMN ip_ogrnip TEXT;
ALTER TABLE worker_profiles ADD COLUMN ip_consent_at TEXT;
ALTER TABLE worker_profiles ADD COLUMN ip_status INTEGER CHECK(ip_status IN (0,1));
ALTER TABLE worker_profiles ADD COLUMN ip_checked_at TEXT;
ALTER TABLE worker_profiles ADD COLUMN ip_checked_on TEXT;
ALTER TABLE worker_profiles ADD COLUMN ip_egrip_reference TEXT;
CREATE INDEX IF NOT EXISTS worker_ip_queue_idx ON worker_profiles(ip_checked_on,ip_checked_at) WHERE contractor_type='ip' AND ip_inn IS NOT NULL;
