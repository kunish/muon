DELETE FROM device_sessions;

ALTER TABLE device_sessions DROP COLUMN access_token;
ALTER TABLE device_sessions ADD COLUMN access_token_hash TEXT NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_device_sessions_access_hash
  ON device_sessions (access_token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_sessions_refresh_hash
  ON device_sessions (refresh_token_hash);
