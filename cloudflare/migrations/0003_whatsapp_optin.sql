CREATE TABLE IF NOT EXISTS whatsapp_subscribers (
 phone TEXT PRIMARY KEY,
 category TEXT NOT NULL CHECK(category IN ('ALL','GOVERNMENT','PRIVATE')),
 frequency TEXT NOT NULL DEFAULT 'daily' CHECK(frequency='daily'),
 status TEXT NOT NULL CHECK(status IN ('active','stopped')),
 consent_version TEXT NOT NULL,
 opted_in_at TEXT NOT NULL,
 stopped_at TEXT,
 last_event_time INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS whatsapp_inbound (
 message_id TEXT PRIMARY KEY, received_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS whatsapp_inbound_expiry ON whatsapp_inbound(received_at);
