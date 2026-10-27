CREATE TABLE IF NOT EXISTS cleaner_cards (
  member_id TEXT PRIMARY KEY REFERENCES members(id),
  display_name TEXT NOT NULL DEFAULT '',
  experience_years INTEGER NOT NULL DEFAULT 0 CHECK(experience_years BETWEEN 0 AND 60),
  gender TEXT NOT NULL DEFAULT 'unspecified' CHECK(gender IN ('female', 'male', 'unspecified')),
  languages TEXT NOT NULL DEFAULT 'Русский',
  specialties TEXT NOT NULL DEFAULT '',
  equipment TEXT NOT NULL DEFAULT '',
  fragrance_free INTEGER NOT NULL DEFAULT 0,
  pet_friendly INTEGER NOT NULL DEFAULT 0,
  own_products INTEGER NOT NULL DEFAULT 0,
  avatar_key TEXT,
  updated TEXT NOT NULL
);
ALTER TABLE documents ADD COLUMN worker_id TEXT REFERENCES members(id);
CREATE INDEX IF NOT EXISTS documents_worker_idx ON documents(worker_id, created DESC);

CREATE TABLE IF NOT EXISTS staff_messages (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL REFERENCES members(id),
  sender_id TEXT NOT NULL REFERENCES members(id),
  text TEXT NOT NULL,
  created TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS staff_messages_thread_idx ON staff_messages(worker_id, created);
CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES members(id),
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
  created TEXT NOT NULL,
  updated TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS support_user_idx ON support_tickets(user_id, updated DESC);
CREATE TABLE IF NOT EXISTS support_messages (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES support_tickets(id),
  sender_id TEXT NOT NULL REFERENCES members(id),
  text TEXT NOT NULL,
  created TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS support_message_idx ON support_messages(ticket_id, created);
CREATE TABLE IF NOT EXISTS support_delivery (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES support_messages(id),
  chat_id TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  delivered_at TEXT,
  next_attempt INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT '',
  UNIQUE(message_id, chat_id)
);
