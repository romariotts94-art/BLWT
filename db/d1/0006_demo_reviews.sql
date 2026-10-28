CREATE TABLE IF NOT EXISTS demo_reviews (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL UNIQUE,
  client_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text TEXT NOT NULL,
  service TEXT NOT NULL,
  created TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);
