-- ============================================================
-- telemetri.sql — Skema Telemetri Nasional & Distribusi MBG
-- Badan Gizi Nasional (BGN) Republik Indonesia
-- ============================================================

-- 1. Tabel Telemetri Nasional (5 KPI Utama)
CREATE TABLE IF NOT EXISTS telemetri_nasional (
    id SERIAL PRIMARY KEY,
    porsi_tersalurkan BIGINT NOT NULL DEFAULT 4850210,
    persen_target NUMERIC(5,2) NOT NULL DEFAULT 99.20,
    sppg_aktif INT NOT NULL DEFAULT 1284,
    sekolah_terlayani INT NOT NULL DEFAULT 18420,
    kepatuhan_akg NUMERIC(5,2) NOT NULL DEFAULT 99.60,
    suhu_rata_rata NUMERIC(4,1) NOT NULL DEFAULT 65.8,
    sla_distribusi NUMERIC(5,2) NOT NULL DEFAULT 99.80,
    pembaruan_teks VARCHAR(100) NOT NULL DEFAULT 'Hari ini, Pukul 11.45 WIB',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabel Distribusi Per Provinsi
CREATE TABLE IF NOT EXISTS distribusi_provinsi (
    id SERIAL PRIMARY KEY,
    provinsi VARCHAR(100) NOT NULL UNIQUE,
    target_porsi BIGINT NOT NULL,
    ketepatan NUMERIC(5,2) NOT NULL,
    status VARCHAR(50) NOT NULL,
    region_code VARCHAR(30) NOT NULL DEFAULT 'jawa',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Data Default / Awal (Sinkron dengan Data Resmi BGN)
INSERT INTO telemetri_nasional (
    porsi_tersalurkan, persen_target, sppg_aktif, sekolah_terlayani, kepatuhan_akg, suhu_rata_rata, sla_distribusi, pembaruan_teks
) VALUES (
    4850210, 99.20, 1284, 18420, 99.60, 65.8, 99.80, 'Hari ini, Pukul 11.45 WIB'
) ON CONFLICT DO NOTHING;

INSERT INTO distribusi_provinsi (provinsi, target_porsi, ketepatan, status, region_code, updated_at)
VALUES
    ('DKI Jakarta', 480200, 99.90, 'Selesai Salur', 'jawa', NOW()),
    ('Jawa Barat', 1250000, 99.40, 'Selesai Salur', 'jawa', NOW()),
    ('Jawa Timur', 1180500, 99.10, 'Selesai Salur', 'jawa', NOW()),
    ('Sumatera Utara', 540000, 98.80, '94% Salur', 'sumatera', NOW()),
    ('Kalimantan Timur', 210300, 98.60, 'Selesai Salur', 'kalimantan', NOW()),
    ('Sulawesi Selatan', 360400, 98.20, 'Selesai Salur', 'sulawesi', NOW()),
    ('Papua Induk', 125800, 96.50, 'Jalur Khusus', 'papua', NOW())
ON CONFLICT (provinsi) DO UPDATE SET
    target_porsi = EXCLUDED.target_porsi,
    ketepatan = EXCLUDED.ketepatan,
    status = EXCLUDED.status,
    region_code = EXCLUDED.region_code,
    updated_at = NOW();
