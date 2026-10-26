CREATE TABLE IF NOT EXISTS visitor_metrics (
 day TEXT NOT NULL, path TEXT NOT NULL, source TEXT NOT NULL,
 campaign TEXT NOT NULL, event TEXT NOT NULL, total INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(day,path,source,campaign,event)
);
