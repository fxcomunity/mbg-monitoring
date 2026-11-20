-- Jalankan satu kali pada database Neon yang sudah memiliki tabel users.
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_was_active BOOLEAN;

CREATE INDEX IF NOT EXISTS idx_users_deleted_at
  ON users(deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_deletion_requests (
  id              BIGSERIAL PRIMARY KEY,
  target_user_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_by    BIGINT REFERENCES users(id) ON DELETE SET NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
  request_note    VARCHAR(500),
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by     BIGINT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_deletion_pending_target
  ON user_deletion_requests(target_user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_user_deletion_requests_status
  ON user_deletion_requests(status, requested_at);
