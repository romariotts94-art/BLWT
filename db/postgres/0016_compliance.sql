CREATE TABLE IF NOT EXISTS legal_acceptances (
 id TEXT PRIMARY KEY,member_id TEXT NOT NULL REFERENCES members(id),document_key TEXT NOT NULL,version TEXT NOT NULL,
 body TEXT NOT NULL,body_hash TEXT NOT NULL,accepted_at TEXT NOT NULL,revoked_at TEXT,
 UNIQUE(member_id,document_key,version,body_hash)
);
CREATE TABLE IF NOT EXISTS contract_versions (
 id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id),worker_id TEXT NOT NULL REFERENCES members(id),
 client_id TEXT NOT NULL REFERENCES members(id),version TEXT NOT NULL,body TEXT NOT NULL,body_hash TEXT NOT NULL,fingerprint TEXT NOT NULL,
 client_accepted_at TEXT,worker_accepted_at TEXT,created TEXT NOT NULL,voided_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS contract_current_idx ON contract_versions(order_id) WHERE voided_at IS NULL;
CREATE TABLE IF NOT EXISTS order_finance (
 order_id TEXT PRIMARY KEY REFERENCES orders(id),mode TEXT NOT NULL CHECK(mode IN ('sandbox','live')),
 state TEXT NOT NULL DEFAULT 'unpaid',provider_order_id TEXT UNIQUE,request_key TEXT NOT NULL UNIQUE,
 gross_cents BIGINT NOT NULL CHECK(gross_cents>0),captured_cents BIGINT NOT NULL DEFAULT 0 CHECK(captured_cents>=0),
 refunded_cents BIGINT NOT NULL DEFAULT 0 CHECK(refunded_cents>=0 AND refunded_cents<=captured_cents),
 available_cents BIGINT NOT NULL DEFAULT 0 CHECK(available_cents>=0),authorization_expires_at TEXT,
 payout_cents BIGINT NOT NULL DEFAULT 0 CHECK(payout_cents>=0),payout_state TEXT NOT NULL DEFAULT 'none',
 recipient_id TEXT,created TEXT NOT NULL,updated TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS finance_events (
 id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id),kind TEXT NOT NULL,amount_cents BIGINT NOT NULL,
 reference TEXT NOT NULL UNIQUE,body TEXT NOT NULL,actor TEXT NOT NULL,created TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS payout_recipients (
 id TEXT PRIMARY KEY,worker_id TEXT NOT NULL REFERENCES members(id),legal_name TEXT NOT NULL,inn TEXT NOT NULL,
 bank_token TEXT NOT NULL,masked_details TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN('pending','verified','revoked')),
 evidence TEXT NOT NULL DEFAULT '',verified_by TEXT,verified_at TEXT,created TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS fiscal_documents (
 id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id),kind TEXT NOT NULL,
 provider_reference TEXT NOT NULL UNIQUE,receipt_url TEXT NOT NULL,amount_cents BIGINT NOT NULL CHECK(amount_cents>=0),
 mode TEXT NOT NULL CHECK(mode IN('sandbox','live')),actor TEXT NOT NULL,created TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS refund_requests (
 id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id),member_id TEXT NOT NULL REFERENCES members(id),
 reason TEXT NOT NULL,requested_cents BIGINT NOT NULL CHECK(requested_cents>0),state TEXT NOT NULL DEFAULT 'requested',
 resolution TEXT NOT NULL DEFAULT '',bank_reference TEXT UNIQUE,created TEXT NOT NULL,updated TEXT NOT NULL
);
