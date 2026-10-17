-- MBG-MONITORING: Seed Data Telemetri Awal
-- Jalankan: psql $DATABASE_URL -f database/migrations/009_seed_telemetri.sql
-- Sumber: database/schema_all.sql (seed section)
-- Dependensi: 003_schema_telemetri.sql

-- ------------------------------------------------------------------------------
-- SEED: Telemetri Nasional (KPI awal)
-- ------------------------------------------------------------------------------
INSERT INTO telemetri_nasional (
  porsi_tersalurkan, persen_target, sppg_aktif, sekolah_terlayani,
  kepatuhan_akg, suhu_rata_rata, sla_distribusi, pembaruan_teks
) VALUES (
  4850210, 99.20, 1284, 18420, 99.60, 65.8, 99.80, 'Hari ini, Pukul 11.45 WIB'
) ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------------------
-- SEED: Distribusi Provinsi (34 Provinsi Indonesia — data awal)
-- ------------------------------------------------------------------------------
INSERT INTO distribusi_provinsi (provinsi, target_porsi, ketepatan, status, region_code, updated_at)
VALUES
  ('DKI Jakarta',         480200,   99.90, 'Selesai Salur',  'jawa',       NOW()),
  ('Jawa Barat',         1250000,   99.40, 'Selesai Salur',  'jawa',       NOW()),
  ('Jawa Timur',         1180500,   99.10, 'Selesai Salur',  'jawa',       NOW()),
  ('Jawa Tengah',         940000,   99.20, 'Selesai Salur',  'jawa',       NOW()),
  ('Banten',              320000,   98.50, 'Selesai Salur',  'jawa',       NOW()),
  ('DI Yogyakarta',       145000,   99.30, 'Selesai Salur',  'jawa',       NOW()),
  ('Sumatera Utara',      540000,   98.80, '94% Salur',      'sumatera',   NOW()),
  ('Sumatera Barat',      210000,   98.40, 'Selesai Salur',  'sumatera',   NOW()),
  ('Sumatera Selatan',    280000,   97.90, 'Selesai Salur',  'sumatera',   NOW()),
  ('Riau',                185000,   98.10, 'Selesai Salur',  'sumatera',   NOW()),
  ('Kepulauan Riau',       95000,   97.80, 'Selesai Salur',  'sumatera',   NOW()),
  ('Jambi',               145000,   98.00, 'Selesai Salur',  'sumatera',   NOW()),
  ('Bengkulu',             90000,   97.50, 'Selesai Salur',  'sumatera',   NOW()),
  ('Lampung',             310000,   98.20, 'Selesai Salur',  'sumatera',   NOW()),
  ('Bangka Belitung',      65000,   98.60, 'Selesai Salur',  'sumatera',   NOW()),
  ('Aceh',                220000,   97.30, 'Selesai Salur',  'sumatera',   NOW()),
  ('Kalimantan Timur',    210300,   98.60, 'Selesai Salur',  'kalimantan', NOW()),
  ('Kalimantan Barat',    185000,   97.90, 'Selesai Salur',  'kalimantan', NOW()),
  ('Kalimantan Selatan',  175000,   98.30, 'Selesai Salur',  'kalimantan', NOW()),
  ('Kalimantan Tengah',   140000,   97.70, 'Selesai Salur',  'kalimantan', NOW()),
  ('Kalimantan Utara',     55000,   97.20, 'Selesai Salur',  'kalimantan', NOW()),
  ('Sulawesi Selatan',    360400,   98.20, 'Selesai Salur',  'sulawesi',   NOW()),
  ('Sulawesi Utara',       95000,   98.00, 'Selesai Salur',  'sulawesi',   NOW()),
  ('Sulawesi Tengah',     125000,   97.60, 'Selesai Salur',  'sulawesi',   NOW()),
  ('Sulawesi Tenggara',   110000,   97.80, 'Selesai Salur',  'sulawesi',   NOW()),
  ('Gorontalo',            55000,   97.40, 'Selesai Salur',  'sulawesi',   NOW()),
  ('Sulawesi Barat',       70000,   97.10, 'Selesai Salur',  'sulawesi',   NOW()),
  ('Bali',                185000,   99.70, 'Selesai Salur',  'bali-nusa',  NOW()),
  ('Nusa Tenggara Barat', 185000,   97.50, 'Selesai Salur',  'bali-nusa',  NOW()),
  ('Nusa Tenggara Timur', 175000,   96.80, 'Jalur Khusus',   'bali-nusa',  NOW()),
  ('Maluku',               85000,   96.20, 'Jalur Khusus',   'maluku',     NOW()),
  ('Maluku Utara',         65000,   96.00, 'Jalur Khusus',   'maluku',     NOW()),
  ('Papua Induk',         125800,   96.50, 'Jalur Khusus',   'papua',      NOW()),
  ('Papua Barat',          55000,   95.80, 'Jalur Khusus',   'papua',      NOW())
ON CONFLICT (provinsi) DO UPDATE SET
  target_porsi = EXCLUDED.target_porsi,
  ketepatan    = EXCLUDED.ketepatan,
  status       = EXCLUDED.status,
  region_code  = EXCLUDED.region_code,
  updated_at   = NOW();
