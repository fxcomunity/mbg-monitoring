-- CATATAN: File ini adalah skema lengkap dalam satu file.
-- Untuk versi modular per fitur, lihat database/migrations/
-- Jalankan database/migrations/*.sql secara berurutan untuk setup modular.

-- ==============================================================================
-- RADAR MBG NASIONAL — SKEMA BASIS DATA TERPADU (FULL COMPREHENSIVE SCHEMA)
-- Platform : Neon Cloud PostgreSQL / PostgreSQL 14+
-- Deskripsi: Skema lengkap sistem monitoring, telemetri, menu SPPG, laporan aduan,
--            manajemen akun & foto profil, sistem keamanan WAF, serta Live Chat.
-- ==============================================================================

-- Ekstensi PostgreSQL yang dibutuhkan
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. FUNGSI & TRIGGER UMUM: Auto-update kolom updated_at
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. TABEL: users (Akun Satgas Admin, Mitra Dapur SPPG, dan Pengguna/Wali Murid)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                 BIGSERIAL PRIMARY KEY,
  username           VARCHAR(60) NOT NULL UNIQUE,
  email              VARCHAR(120) NOT NULL UNIQUE,
  password_hash      VARCHAR(255) NOT NULL,
  full_name          VARCHAR(120) NOT NULL,
  role               VARCHAR(20) NOT NULL DEFAULT 'user'
                       CHECK (role IN ('admin', 'sppg', 'user')),
  sppg_name          VARCHAR(150),
  sppg_code          VARCHAR(50),
  phone              VARCHAR(25),
  avatar_url         VARCHAR(500),
  avatar_pending_url VARCHAR(500),
  avatar_status      VARCHAR(20) NOT NULL DEFAULT 'approved'
                       CHECK (avatar_status IN ('approved', 'pending_approval', 'rejected')),
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role     ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_sppg     ON users(sppg_code);

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------------------------
-- 3. TABEL: telemetri_nasional (KPI Pemantauan Realtime BGN)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS telemetri_nasional (
  id                 SERIAL PRIMARY KEY,
  porsi_tersalurkan  BIGINT NOT NULL,
  persen_target      NUMERIC(5,2) NOT NULL,
  sppg_aktif         INT NOT NULL,
  sekolah_terlayani  INT NOT NULL,
  kepatuhan_akg      NUMERIC(5,2) NOT NULL,
  suhu_rata_rata     NUMERIC(4,1) NOT NULL,
  sla_distribusi     NUMERIC(5,2) NOT NULL,
  pembaruan_teks     VARCHAR(100) NOT NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE telemetri_nasional
  ALTER COLUMN porsi_tersalurkan DROP DEFAULT,
  ALTER COLUMN persen_target DROP DEFAULT,
  ALTER COLUMN sppg_aktif DROP DEFAULT,
  ALTER COLUMN sekolah_terlayani DROP DEFAULT,
  ALTER COLUMN kepatuhan_akg DROP DEFAULT,
  ALTER COLUMN suhu_rata_rata DROP DEFAULT,
  ALTER COLUMN sla_distribusi DROP DEFAULT,
  ALTER COLUMN pembaruan_teks DROP DEFAULT;

-- ------------------------------------------------------------------------------
-- 4. TABEL: distribusi_provinsi (Sebaran Logistik & Persentase Salur Wilayah)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS distribusi_provinsi (
  id           SERIAL PRIMARY KEY,
  provinsi     VARCHAR(100) NOT NULL UNIQUE,
  target_porsi BIGINT NOT NULL,
  ketepatan    NUMERIC(5,2) NOT NULL,
  status       VARCHAR(50) NOT NULL,
  region_code  VARCHAR(30) NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_distribusi_region ON distribusi_provinsi(region_code);

ALTER TABLE distribusi_provinsi
  ALTER COLUMN region_code DROP DEFAULT;

-- ------------------------------------------------------------------------------
-- 5. TABEL: menu_sppg (Manajemen Sajian Harian & Standar Nutrisi BGN)
-- ------------------------------------------------------------------------------
-- 5. TABEL: menu_sppg (Manajemen Sajian Harian & Standar Nutrisi BGN)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS menu_sppg (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT REFERENCES users(id) ON DELETE SET NULL,
  school_key      VARCHAR(100),
  school_target   VARCHAR(200) NOT NULL,
  province_code   VARCHAR(30),
  province_name   VARCHAR(100),
  city_code       VARCHAR(50),
  city            VARCHAR(80)  NOT NULL,
  kecamatan       VARCHAR(100),
  jenjang         VARCHAR(20),
  age_group       TEXT,
  arrival_status  VARCHAR(150),
  menu_cycle      VARCHAR(100),
  menu_date       DATE         NOT NULL DEFAULT CURRENT_DATE,
  menu_title      VARCHAR(200) NOT NULL,
  description     TEXT,
  calories        INT,
  temperature     NUMERIC(4,1),
  portion_count   INT,
  photo_url       VARCHAR(500),
  sppg_name       VARCHAR(150) NOT NULL,
  sppg_address    VARCHAR(255),
  sppg_radius     VARCHAR(50),
  dietitian       VARCHAR(120) NOT NULL,
  dietitian_title VARCHAR(150),
  lab_test_cert   VARCHAR(150),
  status          VARCHAR(20)  NOT NULL
                    CHECK (status IN ('persiapan', 'dikirim', 'terkirim', 'evaluasi')),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE menu_sppg
  ALTER COLUMN province_code DROP DEFAULT,
  ALTER COLUMN province_name DROP DEFAULT,
  ALTER COLUMN city_code DROP DEFAULT,
  ALTER COLUMN jenjang DROP DEFAULT,
  ALTER COLUMN calories DROP DEFAULT,
  ALTER COLUMN calories DROP NOT NULL,
  ALTER COLUMN temperature DROP DEFAULT,
  ALTER COLUMN temperature DROP NOT NULL,
  ALTER COLUMN portion_count DROP DEFAULT,
  ALTER COLUMN portion_count DROP NOT NULL,
  ALTER COLUMN status DROP DEFAULT;

CREATE INDEX IF NOT EXISTS idx_menu_date   ON menu_sppg(menu_date);
CREATE INDEX IF NOT EXISTS idx_menu_school ON menu_sppg(school_target);
CREATE INDEX IF NOT EXISTS idx_menu_key    ON menu_sppg(school_key);
CREATE INDEX IF NOT EXISTS idx_menu_prov   ON menu_sppg(province_code);

-- ------------------------------------------------------------------------------
-- 6. TABEL: laporan_aduan (Pusat Pengaduan Publik & Satgas MBG)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS laporan_aduan (
  id                  BIGSERIAL PRIMARY KEY,
  ticket_code         VARCHAR(30)  NOT NULL UNIQUE,
  reporter_name       VARCHAR(120) NOT NULL,
  reporter_phone      VARCHAR(20)  NOT NULL,
  reporter_role       VARCHAR(20)  NOT NULL DEFAULT 'masyarakat'
                        CHECK (reporter_role IN ('wali','guru','komite','siswa','masyarakat')),
  issue_category      VARCHAR(20)  NOT NULL DEFAULT 'lainnya'
                        CHECK (issue_category IN ('waktu','menu','suhu','higienitas','alergen','lainnya')),
  school_target       VARCHAR(200) NOT NULL,
  incident_date       DATE         NOT NULL,
  description         TEXT         NOT NULL,
  photo_path          VARCHAR(500),
  photo_original_name VARCHAR(255),
  status              VARCHAR(20)  NOT NULL DEFAULT 'masuk'
                        CHECK (status IN ('masuk','verifikasi','proses','selesai','ditolak')),
  priority            VARCHAR(10)  NOT NULL DEFAULT 'sedang'
                        CHECK (priority IN ('rendah','sedang','tinggi','kritis')),
  satgas_notes        TEXT,
  ip_address          VARCHAR(45),
  user_agent          VARCHAR(500),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_laporan_ticket        ON laporan_aduan(ticket_code);
CREATE INDEX IF NOT EXISTS idx_laporan_status        ON laporan_aduan(status);
CREATE INDEX IF NOT EXISTS idx_laporan_category      ON laporan_aduan(issue_category);
CREATE INDEX IF NOT EXISTS idx_laporan_incident_date ON laporan_aduan(incident_date);
CREATE INDEX IF NOT EXISTS idx_laporan_created       ON laporan_aduan(created_at DESC);

DROP TRIGGER IF EXISTS trg_laporan_updated_at ON laporan_aduan;
CREATE TRIGGER trg_laporan_updated_at
  BEFORE UPDATE ON laporan_aduan
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------------------------
-- 7. TABEL: aduan_log (Audit Trail Perubahan Status Laporan)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS aduan_log (
  id          BIGSERIAL PRIMARY KEY,
  laporan_id  BIGINT      NOT NULL REFERENCES laporan_aduan(id) ON DELETE CASCADE,
  old_status  VARCHAR(20),
  new_status  VARCHAR(20) NOT NULL,
  changed_by  VARCHAR(80) NOT NULL DEFAULT 'sistem',
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_log_laporan ON aduan_log(laporan_id);

-- ------------------------------------------------------------------------------
-- 8. TABEL: exploit_logs (Deteksi Serangan WAF, XSS, SQL Injection)
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

-- ------------------------------------------------------------------------------
-- 9. TABEL: live_chat_messages (Sistem Pesan Interaktif User <-> Admin & SPPG)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS live_chat_messages (
  id               BIGSERIAL PRIMARY KEY,
  session_id       VARCHAR(64)  NOT NULL,
  sender_type      VARCHAR(20)  NOT NULL DEFAULT 'user'
                     CHECK (sender_type IN ('user', 'admin', 'sppg', 'bot')),
  sender_id        BIGINT REFERENCES users(id) ON DELETE SET NULL,
  sender_name      VARCHAR(120) NOT NULL,
  target_type      VARCHAR(20)  NOT NULL DEFAULT 'admin'
                     CHECK (target_type IN ('admin', 'sppg')),
  target_sppg_id   BIGINT REFERENCES users(id) ON DELETE SET NULL,
  target_sppg_name VARCHAR(150),
  message          TEXT         NOT NULL,
  is_template      BOOLEAN      NOT NULL DEFAULT FALSE,
  is_read          BOOLEAN      NOT NULL DEFAULT FALSE,
  ip_address       VARCHAR(45),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_session ON live_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_target  ON live_chat_messages(target_type);
CREATE INDEX IF NOT EXISTS idx_chat_created ON live_chat_messages(created_at DESC);

-- ------------------------------------------------------------------------------
-- 10. TABEL: live_chat_templates (Template Pertanyaan Cepat MBG)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS live_chat_templates (
  id          SERIAL PRIMARY KEY,
  target_role VARCHAR(20) NOT NULL DEFAULT 'all' CHECK (target_role IN ('all', 'admin', 'sppg')),
  category    VARCHAR(50) NOT NULL DEFAULT 'umum',
  label       VARCHAR(150) NOT NULL,
  question    TEXT NOT NULL,
  auto_answer TEXT NOT NULL,
  sort_order  INT NOT NULL DEFAULT 10
);

-- ------------------------------------------------------------------------------
