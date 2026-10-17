-- MBG-MONITORING: SPPG (Peta 30K) Schema
-- Jalankan: psql $DATABASE_URL -f database/migrations/002_schema_sppg.sql
-- Sumber: database/schema_sppg.sql
--
-- CATATAN: Ini adalah tabel SPPG versi peta (30K baris, source_key UNIQUE).
-- Tabel SPPG versi hierarki instansi (id_sppg VARCHAR PK) ada di
-- 008_schema_menu_instansi.sql — keduanya aktif dipakai API yang berbeda.

CREATE TABLE IF NOT EXISTS sppg (
  id               BIGSERIAL PRIMARY KEY,
  source_key       TEXT NOT NULL UNIQUE,
  source_row_number INTEGER,
  nama             TEXT NOT NULL,
  provinsi         TEXT,
  kabupaten_kota   TEXT,
  kecamatan        TEXT,
  kelurahan_desa   TEXT,
  alamat           TEXT,
  nama_yayasan     TEXT,
  latitude         DOUBLE PRECISION,
  longitude        DOUBLE PRECISION,
  status           TEXT NOT NULL DEFAULT 'operasional',
  source           TEXT NOT NULL DEFAULT 'BGN',
  data_bulan       TEXT DEFAULT 'Maret 2025',
  retrieved_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sppg_latitude_range  CHECK (latitude  IS NULL OR latitude  BETWEEN -90  AND 90),
  CONSTRAINT sppg_longitude_range CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

CREATE INDEX IF NOT EXISTS idx_sppg_provinsi    ON sppg(provinsi);
CREATE INDEX IF NOT EXISTS idx_sppg_kabupaten   ON sppg(kabupaten_kota);
CREATE INDEX IF NOT EXISTS idx_sppg_geo         ON sppg(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sppg_source      ON sppg(source);
