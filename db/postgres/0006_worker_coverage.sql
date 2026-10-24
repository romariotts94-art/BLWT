BEGIN;
ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS service_city_ids TEXT NOT NULL DEFAULT '[]';
ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS serve_region SMALLINT NOT NULL DEFAULT 0 CHECK (serve_region IN (0,1));
CREATE INDEX IF NOT EXISTS worker_service_cities_idx ON worker_profiles USING GIN ((service_city_ids::jsonb));
COMMIT;
