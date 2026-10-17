-- MBG-MONITORING: Laporan & Aduan Schema
-- Jalankan: psql $DATABASE_URL -f database/migrations/005_schema_laporan.sql
-- Sumber: database/schema_all.sql (section 6–7)
-- Dependensi: 000_extensions.sql (set_updated_at())

-- ------------------------------------------------------------------------------
-- TABEL: laporan_aduan (Pusat Pengaduan Publik & Satgas MBG)
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
-- TABEL: aduan_log (Audit Trail Perubahan Status Laporan)
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
