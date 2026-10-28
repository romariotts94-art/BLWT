ALTER TABLE order_skips ADD COLUMN IF NOT EXISTS snoozed_until BIGINT NOT NULL DEFAULT 0;
UPDATE order_skips SET snoozed_until=0 WHERE snoozed_until IS NULL;
CREATE INDEX IF NOT EXISTS order_skips_snooze_idx ON order_skips(order_id,snoozed_until);
