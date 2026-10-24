CREATE TABLE IF NOT EXISTS collection_control (
 id INTEGER PRIMARY KEY CHECK(id=1), enabled INTEGER NOT NULL DEFAULT 1,
 lease_until INTEGER NOT NULL DEFAULT 0, last_started TEXT, last_finished TEXT, last_summary TEXT
);
INSERT OR IGNORE INTO collection_control(id) VALUES(1);
CREATE TABLE IF NOT EXISTS collection_sources (
 id TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 1, last_checked TEXT,
 last_success TEXT, last_error TEXT, last_count INTEGER NOT NULL DEFAULT 0,
 failures INTEGER NOT NULL DEFAULT 0, next_check INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS collection_items (
 id TEXT PRIMARY KEY, source_id TEXT NOT NULL, external_id TEXT NOT NULL,
 dedupe_key TEXT NOT NULL UNIQUE, data TEXT NOT NULL CHECK(json_valid(data)),
 content_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending'
 CHECK(status IN ('pending','imported','dismissed')),
 discovery_only INTEGER NOT NULL DEFAULT 0, missing_count INTEGER NOT NULL DEFAULT 0,
 first_seen TEXT NOT NULL, last_seen TEXT NOT NULL, changed_at TEXT NOT NULL,
 listing_id TEXT, last_fetched TEXT NOT NULL DEFAULT '', UNIQUE(source_id,external_id)
);
CREATE INDEX IF NOT EXISTS collection_pending ON collection_items(status,source_id);
CREATE TABLE IF NOT EXISTS collection_runs (
 id TEXT PRIMARY KEY, source_id TEXT NOT NULL, finished_at TEXT NOT NULL,
 outcome TEXT NOT NULL, fetched INTEGER NOT NULL DEFAULT 0,
 added INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL DEFAULT 0, message TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS collection_run_date ON collection_runs(finished_at);
