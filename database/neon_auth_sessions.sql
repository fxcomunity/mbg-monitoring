-- Neon-backed Cloudflare Pages sessions. Apply once to the production database.
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash      CHAR(64) PRIMARY KEY
                  CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_version INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user
  ON auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires
  ON auth_sessions (expires_at);
