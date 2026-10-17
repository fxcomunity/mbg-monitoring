-- MBG-MONITORING: Menu SPPG & Menu Harian Schema
-- Jalankan: psql $DATABASE_URL -f database/migrations/004_schema_menu.sql
-- Sumber: database/schema_all.sql (section 5) + database/schema_menu.sql
-- Dependensi: 001_schema_users.sql (FK ke users)

-- ------------------------------------------------------------------------------
-- TABEL: menu_sppg (Manajemen Sajian Harian & Standar Nutrisi BGN)
-- Dipakai oleh dashboard dan API menu utama
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS menu_sppg (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT       REFERENCES users(id) ON DELETE SET NULL,
  school_key      VARCHAR(100),
  school_target   VARCHAR(200) NOT NULL,
  province_code   VARCHAR(30)  DEFAULT 'dki',
  province_name   VARCHAR(100) DEFAULT 'DKI Jakarta',
  city_code       VARCHAR(50)  DEFAULT 'jaksel',
  city            VARCHAR(80)  NOT NULL,
  kecamatan       VARCHAR(100),
  jenjang         VARCHAR(20)  DEFAULT 'sd',
  age_group       TEXT,
  arrival_status  VARCHAR(150),
  menu_cycle      VARCHAR(100),
  menu_date       DATE         NOT NULL DEFAULT CURRENT_DATE,
  menu_title      VARCHAR(200) NOT NULL,
  description     TEXT,
  calories        INT          NOT NULL DEFAULT 620,
  temperature     NUMERIC(4,1) NOT NULL DEFAULT 65.0,
  portion_count   INT          NOT NULL DEFAULT 500,
  photo_url       VARCHAR(500),
  sppg_name       VARCHAR(150) NOT NULL,
  sppg_address    VARCHAR(255),
  sppg_radius     VARCHAR(50),
  dietitian       VARCHAR(120) NOT NULL,
  dietitian_title VARCHAR(150),
  lab_test_cert   VARCHAR(150),
  status          VARCHAR(20)  NOT NULL DEFAULT 'terkirim'
                    CHECK (status IN ('persiapan', 'dikirim', 'terkirim', 'evaluasi')),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_date   ON menu_sppg(menu_date);
CREATE INDEX IF NOT EXISTS idx_menu_school ON menu_sppg(school_target);
CREATE INDEX IF NOT EXISTS idx_menu_key    ON menu_sppg(school_key);
CREATE INDEX IF NOT EXISTS idx_menu_prov   ON menu_sppg(province_code);

-- ------------------------------------------------------------------------------
-- TABEL: menu_harian (Cron backup/arsip harian — versi dari schema_menu.sql)
-- CATATAN: Ada dua tabel menu_harian dengan skema berbeda (lihat 008_schema_menu_instansi.sql).
--          Ini adalah versi backup/cron (kolom: sppg_id VARCHAR, kalori_kkal).
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS menu_harian (
  id              BIGSERIAL       PRIMARY KEY,
  sppg_id         VARCHAR(50)     NOT NULL,
  sppg_name       VARCHAR(200)    NOT NULL,
  school_target   VARCHAR(200)    NOT NULL,
  city            VARCHAR(100)    NOT NULL,
  menu_title      VARCHAR(300)    NOT NULL,
  menu_date       DATE            NOT NULL,
  protein_g       NUMERIC(6,1),
  karbohidrat_g   NUMERIC(6,1),
  lemak_g         NUMERIC(6,1),
  kalori_kkal     NUMERIC(7,1),
  catatan         TEXT,
  status          VARCHAR(20)     NOT NULL DEFAULT 'aktif'
                    CHECK (status IN ('aktif', 'revisi', 'batal')),
  submitted_by    VARCHAR(120)    NOT NULL DEFAULT 'sistem',
  submitted_role  VARCHAR(20)     NOT NULL DEFAULT 'sppg',
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  UNIQUE (sppg_id, school_target, menu_date)
);

CREATE INDEX IF NOT EXISTS idx_menu_harian_date   ON menu_harian(menu_date DESC);
CREATE INDEX IF NOT EXISTS idx_menu_harian_sppg   ON menu_harian(sppg_id);
CREATE INDEX IF NOT EXISTS idx_menu_harian_city   ON menu_harian(city);
CREATE INDEX IF NOT EXISTS idx_menu_harian_status ON menu_harian(status);

DROP TRIGGER IF EXISTS trg_menu_harian_updated_at ON menu_harian;
CREATE TRIGGER trg_menu_harian_updated_at
  BEFORE UPDATE ON menu_harian
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------------------------
-- TABEL: menu_backup (Arsip menu hari-hari sebelumnya — tidak tampil di web)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS menu_backup (
  id              BIGSERIAL    PRIMARY KEY,
  original_id     BIGINT       NOT NULL,
  sppg_id         VARCHAR(50)  NOT NULL,
  sppg_name       VARCHAR(200) NOT NULL,
  school_target   VARCHAR(200) NOT NULL,
  city            VARCHAR(100) NOT NULL,
  menu_title      VARCHAR(300) NOT NULL,
  menu_date       DATE         NOT NULL,
  protein_g       NUMERIC(6,1),
  karbohidrat_g   NUMERIC(6,1),
  lemak_g         NUMERIC(6,1),
  kalori_kkal     NUMERIC(7,1),
  catatan         TEXT,
  status          VARCHAR(20)  NOT NULL DEFAULT 'aktif',
  submitted_by    VARCHAR(120) NOT NULL,
  submitted_role  VARCHAR(20)  NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL,
  archived_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_backup_date     ON menu_backup(menu_date DESC);
CREATE INDEX IF NOT EXISTS idx_menu_backup_sppg     ON menu_backup(sppg_id);
CREATE INDEX IF NOT EXISTS idx_menu_backup_archived ON menu_backup(archived_at DESC);
CREATE INDEX IF NOT EXISTS idx_menu_backup_city     ON menu_backup(city);

-- ------------------------------------------------------------------------------
-- FUNGSI: archive_yesterday_menu()
-- Dipanggil cron Cloudflare Worker setiap 24 jam (00:05 WIB)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION archive_yesterday_menu()
RETURNS TABLE(archived_count INT, archive_date DATE)
LANGUAGE plpgsql AS $$
DECLARE
  v_count INT;
  v_date  DATE;
BEGIN
  SELECT MAX(menu_date) INTO v_date
  FROM menu_harian
  WHERE menu_date < CURRENT_DATE;

  IF v_date IS NULL THEN
    RETURN QUERY SELECT 0, NULL::DATE;
    RETURN;
  END IF;

  INSERT INTO menu_backup (
    original_id, sppg_id, sppg_name, school_target, city,
    menu_title, menu_date, protein_g, karbohidrat_g, lemak_g,
    kalori_kkal, catatan, status, submitted_by, submitted_role,
    created_at, archived_at
  )
  SELECT
    id, sppg_id, sppg_name, school_target, city,
    menu_title, menu_date, protein_g, karbohidrat_g, lemak_g,
    kalori_kkal, catatan, status, submitted_by, submitted_role,
    created_at, NOW()
  FROM menu_harian
  WHERE menu_date < CURRENT_DATE;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  DELETE FROM menu_harian WHERE menu_date < CURRENT_DATE;

  RETURN QUERY SELECT v_count, v_date;
END;
$$;

-- ------------------------------------------------------------------------------
-- VIEW: menu_hari_ini (shortcut frontend — hanya hari ini)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW menu_hari_ini AS
SELECT
  id, sppg_id, sppg_name, school_target, city,
  menu_title, menu_date,
  COALESCE(protein_g, 0)     AS protein_g,
  COALESCE(karbohidrat_g, 0) AS karbohidrat_g,
  COALESCE(lemak_g, 0)       AS lemak_g,
  COALESCE(kalori_kkal, 0)   AS kalori_kkal,
  catatan, status, submitted_by, created_at
FROM menu_harian
WHERE menu_date = CURRENT_DATE
  AND status = 'aktif'
ORDER BY created_at DESC;

-- ------------------------------------------------------------------------------
-- VIEW: menu_backup_summary (ringkasan untuk admin dashboard)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW menu_backup_summary AS
SELECT
  menu_date,
  COUNT(*)                      AS total_menu,
  COUNT(DISTINCT sppg_id)       AS total_sppg,
  COUNT(DISTINCT school_target) AS total_sekolah,
  ROUND(AVG(kalori_kkal), 1)    AS rata_kalori,
  MIN(archived_at)              AS archived_at
FROM menu_backup
GROUP BY menu_date
ORDER BY menu_date DESC;
