-- MBG-MONITORING: Security / WAF Schema
-- Jalankan: psql $DATABASE_URL -f database/migrations/007_schema_security.sql
-- Sumber: database/schema_all.sql (section 8)

-- ------------------------------------------------------------------------------
-- TABEL: exploit_logs (Deteksi Serangan WAF, XSS, SQL Injection)
-- ------------------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS idx_exploit_type ON exploit_logs(exploit_type);
CREATE INDEX IF NOT EXISTS idx_exploit_time ON exploit_logs(created_at DESC);
