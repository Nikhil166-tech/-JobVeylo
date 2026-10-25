CREATE TABLE IF NOT EXISTS renderer_dispatches (
 slot INTEGER PRIMARY KEY, status TEXT NOT NULL, created_at TEXT NOT NULL,
 finished_at TEXT, run_id TEXT, message TEXT NOT NULL DEFAULT ''
);
