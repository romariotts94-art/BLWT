CREATE TABLE IF NOT EXISTS management_messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS management_messages_pair_idx
  ON management_messages(sender_id, recipient_id, created);

CREATE INDEX IF NOT EXISTS management_messages_recipient_idx
  ON management_messages(recipient_id, created);

INSERT INTO management_messages(id,sender_id,recipient_id,text,created)
SELECT s.id || '-legacy-' || a.id,s.sender_id,a.id,s.text,s.created
FROM staff_messages s JOIN members a ON a.role='admin' AND a.active=1
WHERE s.sender_id=s.worker_id
ON CONFLICT(id) DO NOTHING;

INSERT INTO management_messages(id,sender_id,recipient_id,text,created)
SELECT s.id || '-legacy-worker',s.sender_id,s.worker_id,s.text,s.created
FROM staff_messages s JOIN members a ON a.id=s.sender_id AND a.role='admin'
WHERE s.sender_id<>s.worker_id
ON CONFLICT(id) DO NOTHING;
