CREATE TABLE IF NOT EXISTS requests (
  request_id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  links TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK(status IN ('pending','accepted','uncertain')),
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_expiry ON rate_limits(expires_at);
