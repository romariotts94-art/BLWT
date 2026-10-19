-- PostgreSQL starting schema for the Black and White pilot.
-- This is a separate migration track. It does not alter the existing Cloudflare D1 schema.
-- JSON-shaped fields stay TEXT initially so the existing application data format can be
-- migrated without changing its meaning. Convert them to JSONB only with an app migration.

BEGIN;

CREATE TABLE members (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'client',
  team_id TEXT,
  active SMALLINT NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created TEXT NOT NULL
);

CREATE TABLE invitations (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  team_id TEXT
);

CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  skills TEXT NOT NULL DEFAULT '',
  created TEXT NOT NULL
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  status TEXT NOT NULL,
  details TEXT NOT NULL,
  crew TEXT NOT NULL DEFAULT '[]',
  target TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created TEXT NOT NULL,
  updated TEXT NOT NULL
);

CREATE TABLE notices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  order_id TEXT,
  text TEXT NOT NULL,
  read SMALLINT NOT NULL DEFAULT 0 CHECK (read IN (0, 1)),
  created TEXT NOT NULL
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  text TEXT NOT NULL,
  created TEXT NOT NULL
);

CREATE TABLE audit (
  id TEXT PRIMARY KEY,
  order_id TEXT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  created TEXT NOT NULL
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE channels (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  viewer_id TEXT NOT NULL,
  offer TEXT NOT NULL,
  answer TEXT,
  updated BIGINT NOT NULL,
  state TEXT NOT NULL DEFAULT 'waiting'
);

CREATE TABLE media (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  created TEXT NOT NULL
);

-- Indexes follow the application's current access patterns and keep the initial
-- PostgreSQL deployment useful without changing existing API behavior.
CREATE INDEX orders_client_created_idx ON orders (client_id, created DESC);
CREATE INDEX orders_status_created_idx ON orders (status, created DESC);
CREATE INDEX orders_target_status_idx ON orders (target, status);
CREATE INDEX notices_user_created_idx ON notices (user_id, created DESC);
CREATE INDEX messages_order_created_idx ON messages (order_id, created);
CREATE INDEX audit_order_created_idx ON audit (order_id, created DESC);
CREATE INDEX channels_order_worker_updated_idx ON channels (order_id, worker_id, updated DESC);
CREATE INDEX channels_order_viewer_updated_idx ON channels (order_id, viewer_id, updated DESC);
CREATE INDEX channels_updated_idx ON channels (updated);
CREATE INDEX media_order_created_idx ON media (order_id, created);
CREATE INDEX members_role_active_idx ON members (role, active);

COMMIT;
