-- ============================================================
-- Setup kolom tambahan untuk Workers API baru
-- Jalankan di: console.neon.tech → SQL Editor → Run
-- Tidak ada data test — ambil dari user yang sudah ada di DB
-- ============================================================

-- 1. Tambah kolom salt (dibutuhkan auth Worker baru)
ALTER TABLE users ADD COLUMN IF NOT EXISTS salt   VARCHAR(32) DEFAULT '';

-- 2. Tambah kolom active jika belum ada
ALTER TABLE users ADD COLUMN IF NOT EXISTS active  BOOLEAN NOT NULL DEFAULT TRUE;

-- 3. Lihat semua user yang sudah ada di database
SELECT id, username, email, role, active, created_at
FROM users
ORDER BY role, created_at;
