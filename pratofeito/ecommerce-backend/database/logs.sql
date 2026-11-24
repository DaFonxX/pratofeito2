CREATE TABLE IF NOT EXISTS access_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  method VARCHAR(10) NOT NULL, path VARCHAR(200) NOT NULL, status INT NOT NULL, duration_ms INT NOT NULL,
  user_id UUID, user_type VARCHAR(20), ip VARCHAR(64), lang VARCHAR(10), user_agent VARCHAR(200)
);
CREATE INDEX IF NOT EXISTS idx_access_logs_created ON access_logs (created_at DESC);
