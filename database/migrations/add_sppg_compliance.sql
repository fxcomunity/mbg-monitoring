-- Migration: Tambahkan kolom untuk data kepatuhan dan antaran SPPG
ALTER TABLE sppg
ADD COLUMN IF NOT EXISTS kepatuhan_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_antaran INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS masalah_terakhir TEXT,
ADD COLUMN IF NOT EXISTS tanggal_terakhir_antaran DATE,
ADD COLUMN IF NOT EXISTS status_verifikasi VARCHAR(20) DEFAULT 'belum_diverifikasi';

-- Update data existing dengan nilai default
UPDATE sppg SET kepatuhan_score = 85 WHERE kepatuhan_score = 0;
UPDATE sppg SET status_verifikasi = 'aktif' WHERE status = 'operasional';
