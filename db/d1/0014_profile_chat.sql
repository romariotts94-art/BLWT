CREATE TABLE IF NOT EXISTS profile_messages (
 id TEXT PRIMARY KEY,
 client_id TEXT NOT NULL REFERENCES members(id),
 worker_id TEXT NOT NULL REFERENCES members(id),
 sender_id TEXT NOT NULL REFERENCES members(id),
 text TEXT NOT NULL,
 created TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS profile_messages_pair_idx ON profile_messages(client_id,worker_id,created DESC);
CREATE INDEX IF NOT EXISTS profile_messages_worker_idx ON profile_messages(worker_id,created DESC);
