-- ============================================================
-- Penyesuaian kolom akun tanpa mengubah kata sandi pengguna.
-- Jalankan di: console.neon.tech → SQL Editor → Run
-- ============================================================

-- 1. Tambah kolom yang dibutuhkan (aman dijalankan berulang)
ALTER TABLE users ADD COLUMN IF NOT EXISTS salt   VARCHAR(32) DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS active  BOOLEAN NOT NULL DEFAULT TRUE;
