-- Run once on the Neon PostgreSQL database before deploying the security Worker.
-- Threat events use the existing exploit_logs table.

CREATE TABLE IF NOT EXISTS exploit_logs (
  id             BIGSERIAL PRIMARY KEY,
  ip_address     VARCHAR(45),
  user_agent     VARCHAR(500),
  exploit_type   VARCHAR(60) NOT NULL,
  input_field    VARCHAR(80),
  payload_sample TEXT,
  requested_url  VARCHAR(500),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE exploit_logs
  ADD COLUMN IF NOT EXISTS country VARCHAR(2),
  ADD COLUMN IF NOT EXISTS region VARCHAR(100),
  ADD COLUMN IF NOT EXISTS city VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_exploit_ip_created
  ON exploit_logs (ip_address, created_at DESC);

CREATE TABLE IF NOT EXISTS security_threat_counters (
  ip_address        VARCHAR(45) PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL,
  threat_count      INTEGER NOT NULL CHECK (threat_count > 0)
);

CREATE TABLE IF NOT EXISTS security_blocked_ips (
  ip_address VARCHAR(45) PRIMARY KEY,
  reason     VARCHAR(200) NOT NULL,
  blocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_security_blocked_expiry
  ON security_blocked_ips (expires_at);
