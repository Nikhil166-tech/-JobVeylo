CREATE TABLE IF NOT EXISTS reel_experiment (
 id INTEGER PRIMARY KEY CHECK(id=1), starts_at INTEGER NOT NULL, ends_at INTEGER NOT NULL,
 version TEXT NOT NULL DEFAULT 'freshers-v2', enabled INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS reel_test_jobs (
 listing_id TEXT PRIMARY KEY, variant TEXT NOT NULL, stratum TEXT NOT NULL,
 version TEXT NOT NULL, assigned_at INTEGER NOT NULL, rendered_at INTEGER,
 publish_slot INTEGER
);
CREATE TABLE IF NOT EXISTS reel_test_insights (
 listing_id TEXT NOT NULL, age_hours INTEGER NOT NULL, status TEXT NOT NULL,
 measured_at INTEGER, next_attempt INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0,
 metrics TEXT, error_code INTEGER, PRIMARY KEY(listing_id,age_hours)
);
