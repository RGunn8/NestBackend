-- Run against Neon Postgres (or any Postgres)
CREATE TABLE IF NOT EXISTS simplefin_connections (
  user_id TEXT PRIMARY KEY,
  access_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sync_at TIMESTAMPTZ,
  last_sync_error TEXT
);
