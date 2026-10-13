-- ============================================================
-- Database: neondb (Neon PostgreSQL)
-- Skema lengkap sistem laporan/aduan MBG Nasional
-- ============================================================

-- ----------------------------------------------------------------
-- Tabel: laporan_aduan
-- ----------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS idx_laporan_ticket        ON laporan_aduan (ticket_code);
CREATE INDEX IF NOT EXISTS idx_laporan_status        ON laporan_aduan (status);
CREATE INDEX IF NOT EXISTS idx_laporan_category      ON laporan_aduan (issue_category);
CREATE INDEX IF NOT EXISTS idx_laporan_incident_date ON laporan_aduan (incident_date);
CREATE INDEX IF NOT EXISTS idx_laporan_created       ON laporan_aduan (created_at DESC);

-- Auto-update updated_at via trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_laporan_updated_at ON laporan_aduan;
CREATE TRIGGER trg_laporan_updated_at
  BEFORE UPDATE ON laporan_aduan
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------
-- Tabel: aduan_log (audit trail)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS aduan_log (
  id          BIGSERIAL PRIMARY KEY,
  laporan_id  BIGINT      NOT NULL REFERENCES laporan_aduan(id) ON DELETE CASCADE,
  old_status  VARCHAR(20),
  new_status  VARCHAR(20) NOT NULL,
  changed_by  VARCHAR(80) NOT NULL DEFAULT 'sistem',
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_log_laporan ON aduan_log (laporan_id);

-- ----------------------------------------------------------------
-- Data contoh (3 baris demo) – pakai ON CONFLICT agar aman dijalankan ulang
-- ----------------------------------------------------------------
INSERT INTO laporan_aduan
  (ticket_code, reporter_name, reporter_phone, reporter_role,
   issue_category, school_target, incident_date, description,
   status, priority, ip_address)
VALUES
  ('TKT-BGN-20261013-1001', 'Budi S.', '082111000001', 'wali',
   'suhu', 'SDN 01 Senayan Jakarta', '2026-10-13',
   'Makanan tiba sudah dingin, suhu jauh di bawah 60°C.',
   'verifikasi', 'tinggi', '127.0.0.1'),

  ('TKT-BGN-20261013-1002', 'Sari (Guru)', '081200000002', 'guru',
   'menu', 'SMPN 19 Kebayoran Baru', '2026-10-13',
   'Menu tertulis ayam panggang tapi yang datang hanya tahu kukus tanpa lauk utama.',
   'masuk', 'sedang', '127.0.0.1'),

  ('TKT-BGN-20261013-1003', 'Komite RW.05', '087800000003', 'komite',
   'waktu', 'SDN Sukajadi 03 Bandung', '2026-10-12',
   'Pengantaran terlambat lebih dari 90 menit tanpa pemberitahuan.',
   'proses', 'sedang', '127.0.0.1')
ON CONFLICT (ticket_code) DO NOTHING;

-- ----------------------------------------------------------------
-- Tabel: data_penerima_mbg (8 Jenjang BGN Pusat 2026)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS data_penerima_mbg (
  id                 INT PRIMARY KEY,
  year               INT NOT NULL DEFAULT 2026,
  level              VARCHAR(20) NOT NULL,
  province_code      VARCHAR(20),
  regency_code       VARCHAR(20),
  district_code      VARCHAR(20),
  education_units    INT DEFAULT 0,
  male_students      INT DEFAULT 0,
  female_students    INT DEFAULT 0,
  beneficiaries      INT DEFAULT 0,
  allergies          INT DEFAULT 0,
  phobias            INT DEFAULT 0,
  intolerances       INT DEFAULT 0,
  special_conditions INT DEFAULT 0,
  public_units       INT DEFAULT 0,
  private_units      INT DEFAULT 0,
  source_pulled_at   TIMESTAMPTZ,
  source_url         TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  regency_name       VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_mbg_level ON data_penerima_mbg(level);
CREATE INDEX IF NOT EXISTS idx_mbg_province ON data_penerima_mbg(province_code);
CREATE INDEX IF NOT EXISTS idx_mbg_regency ON data_penerima_mbg(regency_code);

-- ----------------------------------------------------------------
-- Tabel: dokumen_juknis (Petunjuk Teknis Resmi BGN RI)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dokumen_juknis (
  id             SERIAL PRIMARY KEY,
  judul          VARCHAR(500) NOT NULL,
  deskripsi      TEXT,
  pdf_url        TEXT NOT NULL,
  sumber         VARCHAR(200) DEFAULT 'Badan Gizi Nasional (BGN)',
  kategori       VARCHAR(100) DEFAULT 'Petunjuk Teknis',
  tanggal_terbit DATE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
