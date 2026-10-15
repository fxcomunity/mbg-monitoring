-- ============================================================
-- Setup tabel users untuk Workers API baru
-- Jalankan sekali di: console.neon.tech → SQL Editor → Run
-- ============================================================

-- 1. Tambah kolom yang dibutuhkan auth Worker
ALTER TABLE users ADD COLUMN IF NOT EXISTS salt   VARCHAR(32)  DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS active  BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Buat akun Admin pertama
--    Username : admin
--    Password : admin123
--    Hash     : SHA-256("mbgadminsalt001" + "admin123")
INSERT INTO users (username, email, password_hash, salt, full_name, role, active)
VALUES (
  'admin',
  'admin@bgn.go.id',
  'a9130efd91465b75285d9f5dbc9a3424f6a7ccea03ab8cb67434fa95a36253ff',
  'mbgadminsalt001',
  'Admin Satgas BGN',
  'admin',
  TRUE
)
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  salt          = EXCLUDED.salt,
  role          = 'admin',
  active        = TRUE;

-- 3. Verifikasi — harus muncul 1 baris
SELECT id, username, email, role, active FROM users WHERE username = 'admin';
