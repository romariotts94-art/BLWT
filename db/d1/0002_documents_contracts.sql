CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  order_id TEXT,
  uploader_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  storage_key TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'pending',
  review_note TEXT NOT NULL DEFAULT '',
  created TEXT NOT NULL,
  reviewed_at TEXT
);
CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  version TEXT NOT NULL,
  body TEXT NOT NULL,
  client_accepted_by TEXT,
  client_accepted_at TEXT,
  worker_accepted_by TEXT,
  worker_accepted_at TEXT,
  created TEXT NOT NULL,
  updated TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS documents_order_created_idx ON documents (order_id, created DESC);
CREATE INDEX IF NOT EXISTS documents_review_status_idx ON documents (review_status, created DESC);
