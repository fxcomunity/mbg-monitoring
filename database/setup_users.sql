-- ============================================================
-- Update kolom salt + password_hash untuk semua user yang ada
-- Jalankan di: console.neon.tech → SQL Editor → Run
-- ============================================================

-- 1. Tambah kolom yang dibutuhkan (aman dijalankan berulang)
ALTER TABLE users ADD COLUMN IF NOT EXISTS salt   VARCHAR(32) DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS active  BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Update salt + hash untuk semua user yang ada
--    Password default per role:
--    admin → admin123
--    sppg  → sppg123
--    user  → user123

UPDATE users SET salt = 'mbgadmin_bg01',
  password_hash = 'b5ed41b460aed4182dc9264711bea4065c7dc81003992371b2dd092eb4058a7b',
  active = TRUE WHERE username = 'admin_bgn';

UPDATE users SET salt = 'mbgsppg_keb01',
  password_hash = 'bf9aae06bcde786ba4c975941dbacc19ff9af206f7010a2bc1aea8df7d5c3298',
  active = TRUE WHERE username = 'sppg_kebayoran';

UPDATE users SET salt = 'mbgsppg_ban01',
  password_hash = '5aa3d8264001893e608bf2f312773461ad50a5b8b53c044c39620a3aea0a5691',
  active = TRUE WHERE username = 'sppg_bandung';

UPDATE users SET salt = 'mbgbudi_wal01',
  password_hash = '19b90a2fb0c674a9ca5a1d7433a7a23536fa016a5630b3a72f5f107e7964157b',
  active = TRUE WHERE username = 'budi_wali';

UPDATE users SET salt = 'mbgsppg000001',
  password_hash = '11bc69ea23e9f725cacb53d73f3af7de79b88cef66f7235b663c31423ed63e28',
  active = TRUE WHERE username = 'sppg';

UPDATE users SET salt = 'mbguser000001',
  password_hash = '419670be6686f441ed8624c51e338b6a5d686ad8008c8e722504fc232b32059e',
  active = TRUE WHERE username = 'user';

UPDATE users SET salt = 'mbgsppg_jak01',
  password_hash = 'b56f61a5918b84866c8a2c2de7238a1de0f1c6801bbb1dfa7356d388be9dc461',
  active = TRUE WHERE username = 'sppg_jakarta';

UPDATE users SET salt = 'mbgadmin00001',
  password_hash = 'f709e6e82353e65f8ba2523f98860fe1165b382a84e4ec7d121a5ff80f651a1c',
  active = TRUE WHERE username = 'admin';

UPDATE users SET salt = 'mbgsppg_jak01',
  password_hash = 'b56f61a5918b84866c8a2c2de7238a1de0f1c6801bbb1dfa7356d388be9dc461',
  active = TRUE WHERE username = 'sppg_jakpus_01';

UPDATE users SET salt = 'mbgsppg_ban01',
  password_hash = '5aa3d8264001893e608bf2f312773461ad50a5b8b53c044c39620a3aea0a5691',
  active = TRUE WHERE username = 'sppg_bandung_01';

UPDATE users SET salt = 'mbgwali_mur01',
  password_hash = '3e75eb111b2975a4e0a6fedc9dbf2092c689951f8eba0948cf9268bba9724d7e',
  active = TRUE WHERE username = 'wali_murid_01';

-- 3. Verifikasi
SELECT id, username, role, active,
       LENGTH(salt) as salt_len,
       LENGTH(password_hash) as hash_len
FROM users ORDER BY role, username;
