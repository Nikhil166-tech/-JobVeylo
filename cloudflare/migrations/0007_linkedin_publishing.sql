CREATE TABLE IF NOT EXISTS linkedin_control (
 id INTEGER PRIMARY KEY CHECK(id=1), enabled INTEGER NOT NULL DEFAULT 0,
 organization_id TEXT, channel_id TEXT, channel_name TEXT,
 checked_at INTEGER NOT NULL DEFAULT 0, reconciled_at INTEGER NOT NULL DEFAULT 0,
 publishing_until INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO linkedin_control(id) VALUES(1);
CREATE TABLE IF NOT EXISTS linkedin_jobs (
 listing_id TEXT PRIMARY KEY, priority INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'waiting',
 created_at TEXT NOT NULL, lease_until INTEGER NOT NULL DEFAULT 0,
 buffer_id TEXT, due_at TEXT, last_error TEXT, sent_at TEXT
);
CREATE INDEX IF NOT EXISTS linkedin_job_queue ON linkedin_jobs(status,priority,created_at);
CREATE TABLE IF NOT EXISTS linkedin_slots (
 slot INTEGER PRIMARY KEY, status TEXT NOT NULL, listing_id TEXT, created_at TEXT NOT NULL
);
