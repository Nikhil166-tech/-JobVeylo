CREATE TABLE IF NOT EXISTS resume_usage (
  bucket text PRIMARY KEY,
  uses integer NOT NULL DEFAULT 0 CHECK (uses >= 0),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS resume_usage_expiry ON resume_usage(expires_at);
