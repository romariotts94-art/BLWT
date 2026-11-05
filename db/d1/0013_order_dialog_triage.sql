CREATE TABLE IF NOT EXISTS order_dialog_triage (
 order_id TEXT NOT NULL REFERENCES orders(id),
 participant_id TEXT NOT NULL REFERENCES members(id),
 status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','deferred','resolved')),
 updated_by TEXT NOT NULL REFERENCES members(id),
 updated_at TEXT NOT NULL,
 PRIMARY KEY (order_id,participant_id)
);
CREATE INDEX IF NOT EXISTS order_dialog_triage_status_idx ON order_dialog_triage(status,updated_at);
