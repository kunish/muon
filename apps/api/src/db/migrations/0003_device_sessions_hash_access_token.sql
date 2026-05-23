-- Clear plain-text tokens before migrating to hashed tokens.
-- Idempotent: safe to run repeatedly.
DELETE FROM device_sessions;

ALTER TABLE device_sessions DROP COLUMN IF EXISTS access_token;
ALTER TABLE device_sessions ADD COLUMN IF NOT EXISTS access_token_hash TEXT NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_device_sessions_access_hash
  ON device_sessions (access_token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_sessions_refresh_hash
  ON device_sessions (refresh_token_hash);
