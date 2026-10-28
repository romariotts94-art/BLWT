ALTER TABLE order_skips ADD COLUMN snoozed_until INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS order_skips_snooze_idx ON order_skips(order_id,snoozed_until);
