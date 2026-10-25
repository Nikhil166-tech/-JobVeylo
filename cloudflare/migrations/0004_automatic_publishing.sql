CREATE TABLE IF NOT EXISTS publishing_control (
 id INTEGER PRIMARY KEY CHECK(id=1), enabled INTEGER NOT NULL DEFAULT 1,
 instagram_enabled INTEGER NOT NULL DEFAULT 1
);
INSERT OR IGNORE INTO publishing_control(id) VALUES(1);
CREATE TABLE IF NOT EXISTS publishing_slots (
 slot INTEGER PRIMARY KEY, status TEXT NOT NULL, listing_id TEXT,
 created_at TEXT NOT NULL, message TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS publishing_holds (
 collection_id TEXT PRIMARY KEY, reason TEXT NOT NULL, updated_at TEXT NOT NULL
);
INSERT OR IGNORE INTO publishing_holds(collection_id,reason,updated_at)
 SELECT id,'Employer location fields conflict; editorial correction is required.',datetime('now')
 FROM collection_items WHERE source_id='greenhouse-cloudflare' AND external_id='8288769';
CREATE TABLE IF NOT EXISTS social_jobs (
 listing_id TEXT PRIMARY KEY, priority INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'waiting_media',
 created_at TEXT NOT NULL, lease_until INTEGER NOT NULL DEFAULT 0,
 media_key TEXT, media_created_at TEXT, container_id TEXT, instagram_id TEXT,
 attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, published_at TEXT
);
CREATE INDEX IF NOT EXISTS social_job_queue ON social_jobs(status,priority,created_at);
CREATE TABLE IF NOT EXISTS instagram_slots (
 slot INTEGER PRIMARY KEY, listing_id TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL
);
