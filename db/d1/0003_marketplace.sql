-- Marketplace tables and order fields used by the current D1 application.
CREATE TABLE IF NOT EXISTS cities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  region TEXT NOT NULL,
  timezone TEXT NOT NULL,
  utc_offset TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS cities_name_idx ON cities(name, region);

CREATE TABLE IF NOT EXISTS customer_profiles (
  member_id TEXT PRIMARY KEY REFERENCES members(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  updated TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS customer_cities (
  member_id TEXT NOT NULL REFERENCES members(id),
  city_id TEXT NOT NULL REFERENCES cities(id),
  last_order_at TEXT NOT NULL,
  PRIMARY KEY(member_id, city_id)
);
CREATE INDEX IF NOT EXISTS customer_city_idx ON customer_cities(city_id, member_id);

CREATE TABLE IF NOT EXISTS worker_profiles (
  member_id TEXT PRIMARY KEY REFERENCES members(id),
  city_id TEXT REFERENCES cities(id),
  bio TEXT NOT NULL DEFAULT '',
  services TEXT NOT NULL DEFAULT '["standard"]',
  extras TEXT NOT NULL DEFAULT '[]',
  capacity INTEGER NOT NULL DEFAULT 1 CHECK(capacity BETWEEN 1 AND 12),
  min_payout_cents INTEGER NOT NULL DEFAULT 0 CHECK(min_payout_cents >= 0),
  travel_minutes INTEGER NOT NULL DEFAULT 60 CHECK(travel_minutes BETWEEN 30 AND 180),
  accepts_video INTEGER NOT NULL DEFAULT 0 CHECK(accepts_video IN (0, 1)),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1)),
  verified INTEGER NOT NULL DEFAULT 0 CHECK(verified IN (0, 1)),
  updated TEXT NOT NULL,
  service_city_ids TEXT NOT NULL DEFAULT '[]',
  serve_region INTEGER NOT NULL DEFAULT 0 CHECK(serve_region IN (0, 1))
);
CREATE INDEX IF NOT EXISTS worker_city_idx ON worker_profiles(city_id, verified, enabled);
CREATE INDEX IF NOT EXISTS worker_service_cities_idx ON worker_profiles(service_city_ids);
CREATE TABLE IF NOT EXISTS worker_availability (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL REFERENCES worker_profiles(member_id),
  work_date TEXT NOT NULL,
  start_min INTEGER NOT NULL CHECK(start_min >= 0),
  end_min INTEGER NOT NULL CHECK(end_min <= 1440),
  CHECK(start_min < end_min),
  UNIQUE(worker_id, work_date, start_min)
);
CREATE INDEX IF NOT EXISTS availability_date_idx ON worker_availability(worker_id, work_date);

ALTER TABLE orders ADD COLUMN marketplace_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN city_id TEXT REFERENCES cities(id);
ALTER TABLE orders ADD COLUMN start_at INTEGER;
ALTER TABLE orders ADD COLUMN end_at INTEGER;
ALTER TABLE orders ADD COLUMN gross_cents INTEGER CHECK(gross_cents >= 0);
ALTER TABLE orders ADD COLUMN payout_cents INTEGER CHECK(payout_cents >= 0 AND payout_cents <= gross_cents);
ALTER TABLE orders ADD COLUMN assigned_worker_id TEXT REFERENCES members(id);
ALTER TABLE orders ADD COLUMN claim_until INTEGER;
ALTER TABLE orders ADD COLUMN request_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS orders_request_key_idx ON orders(client_id, request_key) WHERE request_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_market_city_idx ON orders(city_id, status, start_at) WHERE marketplace_version = 1;
CREATE INDEX IF NOT EXISTS orders_worker_time_idx ON orders(assigned_worker_id, start_at, end_at);
CREATE INDEX IF NOT EXISTS orders_claim_expiry_idx ON orders(claim_until) WHERE status = 'contract_pending';

CREATE TABLE IF NOT EXISTS order_skips (
  order_id TEXT NOT NULL REFERENCES orders(id),
  worker_id TEXT NOT NULL REFERENCES members(id),
  created TEXT NOT NULL,
  PRIMARY KEY(order_id, worker_id)
);
CREATE TABLE IF NOT EXISTS worker_agreements (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  worker_id TEXT NOT NULL REFERENCES members(id),
  version TEXT NOT NULL,
  body TEXT NOT NULL,
  body_hash TEXT NOT NULL,
  payout_cents INTEGER NOT NULL,
  penalty_percent REAL NOT NULL,
  accepted_at TEXT,
  accepted_by TEXT REFERENCES members(id),
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending', 'signed', 'void')),
  created TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS agreement_order_idx ON worker_agreements(order_id, created DESC);
CREATE TABLE IF NOT EXISTS quality_attempts (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL REFERENCES members(id),
  week TEXT NOT NULL,
  score INTEGER NOT NULL CHECK(score BETWEEN 0 AND 5),
  passed INTEGER NOT NULL CHECK(passed IN (0, 1)),
  valid_until INTEGER NOT NULL,
  created TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS quality_worker_idx ON quality_attempts(worker_id, valid_until DESC);
CREATE TABLE IF NOT EXISTS wallet_ledger (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL REFERENCES members(id),
  order_id TEXT REFERENCES orders(id),
  kind TEXT NOT NULL CHECK(kind IN ('earning', 'payout', 'penalty')),
  amount_cents INTEGER NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  note TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL REFERENCES members(id),
  created TEXT NOT NULL,
  CHECK((kind = 'earning' AND amount_cents > 0) OR (kind IN ('payout', 'penalty') AND amount_cents < 0))
);
CREATE UNIQUE INDEX IF NOT EXISTS wallet_order_earning_idx ON wallet_ledger(order_id) WHERE kind = 'earning';
CREATE INDEX IF NOT EXISTS wallet_worker_idx ON wallet_ledger(worker_id, created DESC);
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL REFERENCES members(id),
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'rejected')),
  reference TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created TEXT NOT NULL,
  updated TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS withdrawal_pending_idx ON withdrawal_requests(worker_id) WHERE status = 'pending';
CREATE TABLE IF NOT EXISTS order_incidents (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  worker_id TEXT NOT NULL REFERENCES members(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'excused', 'penalty')),
  admin_note TEXT NOT NULL DEFAULT '',
  penalty_cents INTEGER NOT NULL DEFAULT 0 CHECK(penalty_cents >= 0),
  created TEXT NOT NULL,
  reviewed_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS incident_pending_idx ON order_incidents(order_id, worker_id) WHERE status = 'pending';

ALTER TABLE media ADD COLUMN purpose TEXT NOT NULL DEFAULT 'report';
ALTER TABLE notices ADD COLUMN dedupe_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS notices_dedupe_idx ON notices(dedupe_key) WHERE dedupe_key IS NOT NULL;

INSERT OR IGNORE INTO worker_profiles(member_id, updated)
SELECT id, created FROM members WHERE role IN ('cleaner', 'leader');
INSERT OR IGNORE INTO customer_profiles(member_id, name, phone, updated)
SELECT o.client_id,
       COALESCE(json_extract(o.details, '$.name'), m.name),
       COALESCE(json_extract(o.details, '$.phone'), ''),
       MAX(o.updated)
FROM orders o JOIN members m ON m.id = o.client_id
WHERE json_valid(o.details)
GROUP BY o.client_id;
