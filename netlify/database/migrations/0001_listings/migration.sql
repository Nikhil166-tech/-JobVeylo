CREATE TABLE IF NOT EXISTS listings (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('draft','published','closed','archived')),
  version integer NOT NULL CHECK (version >= 1),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS listings_active_source
  ON listings ((data->>'url')) WHERE status <> 'archived';
