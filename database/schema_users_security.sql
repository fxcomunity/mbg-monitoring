-- ============================================================
-- Skema Penambahan: Users, Sessions, Exploit Logs, SPPG Menu
-- Database: neondb (PostgreSQL)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabel users (Admin, SPPG, User Publik)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  username      VARCHAR(60) NOT NULL UNIQUE,
  email         VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(120) NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'user'
                  CHECK (role IN ('admin', 'sppg', 'user')),
  sppg_name     VARCHAR(150),
  sppg_code     VARCHAR(50),
  phone         VARCHAR(25),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role     ON users(role);

-- ------------------------------------------------------------
-- 2. Tabel exploit_logs (Deteksi Serangan XSS / SQLi / WAF)
-- ------------------------------------------------------------
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
CREATE INDEX IF NOT EXISTS idx_exploit_ip   ON exploit_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_exploit_time ON exploit_logs(created_at DESC);

-- ------------------------------------------------------------
-- 3. Tabel menu_sppg (Manajemen Menu oleh SPPG)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS menu_sppg (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT REFERENCES users(id) ON DELETE SET NULL,
  sppg_name     VARCHAR(150) NOT NULL,
  school_target VARCHAR(200) NOT NULL,
  city          VARCHAR(80) NOT NULL,
  menu_date     DATE NOT NULL,
  menu_title    VARCHAR(200) NOT NULL,
  description   TEXT,
  calories      INT NOT NULL DEFAULT 620,
  temperature   NUMERIC(4,1) NOT NULL DEFAULT 65.0,
  portion_count INT NOT NULL DEFAULT 500,
  dietitian     VARCHAR(120) NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'terkirim'
                  CHECK (status IN ('persiapan', 'dikirim', 'terkirim', 'evaluasi')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_date   ON menu_sppg(menu_date);
CREATE INDEX IF NOT EXISTS idx_menu_school ON menu_sppg(school_target);

-- ------------------------------------------------------------
-- 4. Akun Default Seeder
-- Password default:
-- admin: 'admin1234'
-- sppg:  'sppg1234'
-- user:  'user1234'
-- (Password hash menggunakan BCRYPT standar PHP password_hash)
-- ------------------------------------------------------------
INSERT INTO users (username, email, password_hash, full_name, role, sppg_name, sppg_code, phone)
VALUES
  ('admin_bgn', 'admin@bgn.go.id', '$2y$10$wT0E0jP7n9Fj.P9OQjX5s.1bO4c6X51x6y3z4B5n6M7l8K9j0H1g2', 'Satgas Administrator BGN', 'admin', NULL, 'ADM-01', '081110008008'),
  ('sppg_kebayoran', 'sppg.kebayoran@bgn.go.id', '$2y$10$wT0E0jP7n9Fj.P9OQjX5s.1bO4c6X51x6y3z4B5n6M7l8K9j0H1g2', 'Dapur Sentral Kebayoran Baru 03', 'sppg', 'SPPG Kebayoran Baru 03', 'SPPG-JKTSEL-008', '08119000123'),
  ('sppg_bandung', 'sppg.sukajadi@bgn.go.id', '$2y$10$wT0E0jP7n9Fj.P9OQjX5s.1bO4c6X51x6y3z4B5n6M7l8K9j0H1g2', 'SPPG Sukajadi Bandung', 'sppg', 'SPPG Sukajadi Sentral', 'SPPG-JBRBDG-003', '08119000456'),
  ('budi_wali', 'budi@gmail.com', '$2y$10$wT0E0jP7n9Fj.P9OQjX5s.1bO4c6X51x6y3z4B5n6M7l8K9j0H1g2', 'Budi Santoso (Wali Murid)', 'user', NULL, NULL, '081234567890')
ON CONFLICT (username) DO NOTHING;
