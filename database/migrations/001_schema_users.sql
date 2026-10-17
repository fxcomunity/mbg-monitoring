-- MBG-MONITORING: Users & Roles Schema
-- Jalankan: psql $DATABASE_URL -f database/migrations/001_schema_users.sql
-- Dependensi: 000_extensions.sql (uuid-ossp, pgcrypto, set_updated_at())

-- ------------------------------------------------------------------------------
-- TABEL: users (Akun Satgas Admin, Mitra Dapur SPPG, dan Pengguna/Wali Murid)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                 BIGSERIAL PRIMARY KEY,
  username           VARCHAR(60)  NOT NULL UNIQUE,
  email              VARCHAR(120) NOT NULL UNIQUE,
  password_hash      VARCHAR(255) NOT NULL,
  full_name          VARCHAR(120) NOT NULL,
  role               VARCHAR(20)  NOT NULL DEFAULT 'user'
                       CHECK (role IN ('admin', 'sppg', 'user')),
  sppg_name          VARCHAR(150),
  sppg_code          VARCHAR(50),
  phone              VARCHAR(25),
  avatar_url         VARCHAR(500),
  avatar_pending_url VARCHAR(500),
  avatar_status      VARCHAR(20)  NOT NULL DEFAULT 'approved'
                       CHECK (avatar_status IN ('approved', 'pending_approval', 'rejected')),
  salt               VARCHAR(32)  DEFAULT '',
  active             BOOLEAN      NOT NULL DEFAULT TRUE,
  is_active          BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role     ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_sppg     ON users(sppg_code);

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
