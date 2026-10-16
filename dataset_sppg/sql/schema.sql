CREATE TABLE IF NOT EXISTS sppg (
  id BIGSERIAL PRIMARY KEY,
  source_key TEXT NOT NULL UNIQUE,
  source_row_number INTEGER,
  nama TEXT NOT NULL,
  provinsi TEXT,
  kabupaten_kota TEXT,
  kecamatan TEXT,
  kelurahan_desa TEXT,
  alamat TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  status TEXT NOT NULL DEFAULT 'operasional',
  source TEXT NOT NULL DEFAULT 'BGN',
  source_url TEXT,
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sppg_latitude_range CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CONSTRAINT sppg_longitude_range CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  CONSTRAINT sppg_coordinates_pair CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_sppg_provinsi ON sppg (provinsi);
CREATE INDEX IF NOT EXISTS idx_sppg_kabupaten_kota ON sppg (kabupaten_kota);
CREATE INDEX IF NOT EXISTS idx_sppg_status ON sppg (status);
CREATE INDEX IF NOT EXISTS idx_sppg_geo ON sppg (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
