-- ============================================================
-- Schema: Menu Harian MBG + Backup Otomatis
-- Database: Neon PostgreSQL
-- 
-- Logika:
--   menu_harian  → data hari ini (aktif tampil di web)
--   menu_backup  → arsip menu hari-hari sebelumnya
--
-- Cron job Cloudflare Worker (setiap 24 jam, jam 00:05 WIB)
-- otomatis memindahkan semua record dari menu_harian yang
-- tanggal distribusinya < CURRENT_DATE ke menu_backup,
-- lalu menghapusnya dari menu_harian.
-- ============================================================

-- ----------------------------------------------------------------
-- Tabel: menu_harian  (data aktif — tampil di web)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS menu_harian (
  id                BIGSERIAL       PRIMARY KEY,
  sppg_id           VARCHAR(50)     NOT NULL,                    -- ID dapur SPPG penginput
  sppg_name         VARCHAR(200)    NOT NULL,                    -- Nama dapur SPPG
  school_target     VARCHAR(200)    NOT NULL,                    -- Sekolah sasaran
  city              VARCHAR(100)    NOT NULL,                    -- Kota / wilayah
  menu_title        VARCHAR(300)    NOT NULL,                    -- Nama paket menu
  menu_date         DATE            NOT NULL,                    -- Tanggal distribusi
  protein_g         NUMERIC(6,1),                               -- Protein (gram)
  karbohidrat_g     NUMERIC(6,1),                               -- Karbohidrat (gram)
  lemak_g           NUMERIC(6,1),                               -- Lemak (gram)
  kalori_kkal       NUMERIC(7,1),                               -- Kalori (kkal)
  catatan           TEXT,                                        -- Catatan tambahan
  status            VARCHAR(20)     NOT NULL DEFAULT 'aktif'
                      CHECK (status IN ('aktif', 'revisi', 'batal')),
  submitted_by      VARCHAR(120)    NOT NULL DEFAULT 'sistem',   -- Username yang submit
  submitted_role    VARCHAR(20)     NOT NULL DEFAULT 'sppg',
  created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  -- Satu SPPG hanya boleh punya 1 menu aktif per sekolah per tanggal
  UNIQUE (sppg_id, school_target, menu_date)
);

CREATE INDEX IF NOT EXISTS idx_menu_harian_date    ON menu_harian (menu_date DESC);
CREATE INDEX IF NOT EXISTS idx_menu_harian_sppg    ON menu_harian (sppg_id);
CREATE INDEX IF NOT EXISTS idx_menu_harian_city    ON menu_harian (city);
CREATE INDEX IF NOT EXISTS idx_menu_harian_status  ON menu_harian (status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_menu_harian_updated_at ON menu_harian;
CREATE TRIGGER trg_menu_harian_updated_at
  BEFORE UPDATE ON menu_harian
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ----------------------------------------------------------------
-- Tabel: menu_backup  (arsip menu hari sebelumnya — tidak tampil di web)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS menu_backup (
  id                BIGSERIAL       PRIMARY KEY,
  original_id       BIGINT          NOT NULL,                    -- ID asli dari menu_harian
  sppg_id           VARCHAR(50)     NOT NULL,
  sppg_name         VARCHAR(200)    NOT NULL,
  school_target     VARCHAR(200)    NOT NULL,
  city              VARCHAR(100)    NOT NULL,
  menu_title        VARCHAR(300)    NOT NULL,
  menu_date         DATE            NOT NULL,
  protein_g         NUMERIC(6,1),
  karbohidrat_g     NUMERIC(6,1),
  lemak_g           NUMERIC(6,1),
  kalori_kkal       NUMERIC(7,1),
  catatan           TEXT,
  status            VARCHAR(20)     NOT NULL DEFAULT 'aktif',
  submitted_by      VARCHAR(120)    NOT NULL,
  submitted_role    VARCHAR(20)     NOT NULL,
  created_at        TIMESTAMPTZ     NOT NULL,                    -- Waktu asli dibuat
  archived_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW()       -- Waktu dipindahkan ke backup
);

CREATE INDEX IF NOT EXISTS idx_menu_backup_date      ON menu_backup (menu_date DESC);
CREATE INDEX IF NOT EXISTS idx_menu_backup_sppg      ON menu_backup (sppg_id);
CREATE INDEX IF NOT EXISTS idx_menu_backup_archived  ON menu_backup (archived_at DESC);
CREATE INDEX IF NOT EXISTS idx_menu_backup_city      ON menu_backup (city);


-- ----------------------------------------------------------------
-- Fungsi: archive_yesterday_menu()
-- Dipanggil oleh Cloudflare Worker Cron setiap 24 jam
-- Memindahkan semua menu_harian dengan menu_date < CURRENT_DATE
-- ke menu_backup, lalu menghapus dari menu_harian
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION archive_yesterday_menu()
RETURNS TABLE(archived_count INT, archive_date DATE)
LANGUAGE plpgsql AS $$
DECLARE
  v_count INT;
  v_date  DATE;
BEGIN
  -- Tanggal paling baru yang akan diarsip (kemarin atau lebih lama)
  SELECT MAX(menu_date) INTO v_date
  FROM menu_harian
  WHERE menu_date < CURRENT_DATE;

  IF v_date IS NULL THEN
    RETURN QUERY SELECT 0, NULL::DATE;
    RETURN;
  END IF;

  -- Salin ke menu_backup
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

  -- Hapus dari menu_harian
  DELETE FROM menu_harian WHERE menu_date < CURRENT_DATE;

  RETURN QUERY SELECT v_count, v_date;
END;
$$;


-- ----------------------------------------------------------------
-- View: menu_hari_ini  (shortcut untuk frontend — hanya hari ini)
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW menu_hari_ini AS
SELECT
  id, sppg_id, sppg_name, school_target, city,
  menu_title, menu_date,
  COALESCE(protein_g, 0)       AS protein_g,
  COALESCE(karbohidrat_g, 0)   AS karbohidrat_g,
  COALESCE(lemak_g, 0)         AS lemak_g,
  COALESCE(kalori_kkal, 0)     AS kalori_kkal,
  catatan, status, submitted_by, created_at
FROM menu_harian
WHERE menu_date = CURRENT_DATE
  AND status = 'aktif'
ORDER BY created_at DESC;


-- ----------------------------------------------------------------
-- View: menu_backup_summary  (ringkasan untuk admin dashboard)
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW menu_backup_summary AS
SELECT
  menu_date,
  COUNT(*)                          AS total_menu,
  COUNT(DISTINCT sppg_id)           AS total_sppg,
  COUNT(DISTINCT school_target)     AS total_sekolah,
  ROUND(AVG(kalori_kkal), 1)        AS rata_kalori,
  MIN(archived_at)                  AS archived_at
FROM menu_backup
GROUP BY menu_date
ORDER BY menu_date DESC;
