CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL CHECK(json_valid(data)),
  source_url TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft','published','closed','archived')),
  version INTEGER NOT NULL CHECK(version >= 1),
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS listings_active_source ON listings(source_url) WHERE status <> 'archived';
CREATE TABLE IF NOT EXISTS owner_sessions (
  token_hash TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS owner_sessions_expiry ON owner_sessions(expires_at);
CREATE TABLE IF NOT EXISTS resume_requests (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  minute TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS resume_requests_day ON resume_requests(day);
CREATE INDEX IF NOT EXISTS resume_requests_connection ON resume_requests(day,ip_hash);
CREATE INDEX IF NOT EXISTS resume_requests_minute ON resume_requests(minute);
