CREATE TABLE IF NOT EXISTS admin_profiles (
  member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  avatar_key TEXT,
  updated TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_direct_messages (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES members(id),
  text TEXT NOT NULL,
  created TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS order_direct_messages_thread_idx
  ON order_direct_messages(order_id, participant_id, created);
