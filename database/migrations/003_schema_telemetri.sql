-- MBG-MONITORING: Telemetri Nasional & Distribusi Provinsi Schema
-- Jalankan: psql $DATABASE_URL -f database/migrations/003_schema_telemetri.sql
-- Sumber: database/schema_all.sql (section 3–4) + database/schema.sql (data_penerima_mbg)

-- ------------------------------------------------------------------------------
-- TABEL: telemetri_nasional (KPI Pemantauan Realtime BGN)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS telemetri_nasional (
  id                SERIAL PRIMARY KEY,
  porsi_tersalurkan BIGINT       NOT NULL DEFAULT 4850210,
  persen_target     NUMERIC(5,2) NOT NULL DEFAULT 99.20,
  sppg_aktif        INT          NOT NULL DEFAULT 1284,
  sekolah_terlayani INT          NOT NULL DEFAULT 18420,
  kepatuhan_akg     NUMERIC(5,2) NOT NULL DEFAULT 99.60,
  suhu_rata_rata    NUMERIC(4,1) NOT NULL DEFAULT 65.8,
  sla_distribusi    NUMERIC(5,2) NOT NULL DEFAULT 99.80,
  pembaruan_teks    VARCHAR(100) NOT NULL DEFAULT 'Hari ini, Pukul 11.45 WIB',
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- TABEL: distribusi_provinsi (Sebaran Logistik & Persentase Salur Wilayah)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS distribusi_provinsi (
  id           SERIAL PRIMARY KEY,
  provinsi     VARCHAR(100) NOT NULL UNIQUE,
  target_porsi BIGINT       NOT NULL,
  ketepatan    NUMERIC(5,2) NOT NULL,
  status       VARCHAR(50)  NOT NULL,
  region_code  VARCHAR(30)  NOT NULL DEFAULT 'jawa',
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_distribusi_region ON distribusi_provinsi(region_code);

-- ------------------------------------------------------------------------------
-- TABEL: data_penerima_mbg (8 Jenjang BGN Pusat 2026)
-- Sumber: database/schema.sql — tabel ini TIDAK ada di schema_all.sql
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS data_penerima_mbg (
  id                 INT PRIMARY KEY,
  year               INT          NOT NULL DEFAULT 2026,
  level              VARCHAR(20)  NOT NULL,
  province_code      VARCHAR(20),
  regency_code       VARCHAR(20),
  district_code      VARCHAR(20),
  education_units    INT          DEFAULT 0,
  male_students      INT          DEFAULT 0,
  female_students    INT          DEFAULT 0,
  beneficiaries      INT          DEFAULT 0,
  allergies          INT          DEFAULT 0,
  phobias            INT          DEFAULT 0,
  intolerances       INT          DEFAULT 0,
  special_conditions INT          DEFAULT 0,
  public_units       INT          DEFAULT 0,
  private_units      INT          DEFAULT 0,
  regency_name       VARCHAR(255),
  source_pulled_at   TIMESTAMPTZ,
  source_url         TEXT,
  created_at         TIMESTAMPTZ  DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mbg_level    ON data_penerima_mbg(level);
CREATE INDEX IF NOT EXISTS idx_mbg_province ON data_penerima_mbg(province_code);
CREATE INDEX IF NOT EXISTS idx_mbg_regency  ON data_penerima_mbg(regency_code);
