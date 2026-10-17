-- MBG-MONITORING: Seed Data Users Default
-- Jalankan: psql $DATABASE_URL -f database/migrations/008_seed_users.sql
-- Sumber: database/schema_all.sql (seed section) + database/setup_users.sql
-- Dependensi: 001_schema_users.sql
--
-- Password default (bcrypt hash — untuk login awal saja, segera ganti di produksi):
--   admin_bgn       → admin1234
--   sppg_jakpus_01  → sppg1234
--   sppg_bandung_01 → sppg1234
--   wali_murid_01   → user1234

INSERT INTO users (username, email, password_hash, full_name, role, sppg_name, sppg_code, phone, avatar_status)
VALUES
  (
    'admin_bgn', 'admin@bgn.go.id',
    '$2y$10$wT0E0jP7n9Fj.P9OQjX5s.1bO4c6X51x6y3z4B5n6M7l8K9j0H1g2',
    'Satgas Administrator BGN', 'admin', NULL, 'ADM-01', '081110008008', 'approved'
  ),
  (
    'sppg_jakpus_01', 'sppg.jakpus@bgn.go.id',
    '$2y$10$tZ8V8VwF9gK6z.k8y0b.0e7fG5h8j9k0l1m2n3o4p5q6r7s8t9u0v',
    'Dapur SPPG Menteng Senayan', 'sppg',
    'SPPG Menteng Senayan Jakarta Pusat', 'SPPG-JKT-01', '081299887711', 'approved'
  ),
  (
    'sppg_bandung_01', 'sppg.bdg@bgn.go.id',
    '$2y$10$tZ8V8VwF9gK6z.k8y0b.0e7fG5h8j9k0l1m2n3o4p5q6r7s8t9u0v',
    'Dapur SPPG Sukajadi Bandung', 'sppg',
    'SPPG Sukajadi Kota Bandung', 'SPPG-BDG-01', '081388776622', 'approved'
  ),
  (
    'wali_murid_01', 'wali.budi@gmail.com',
    '$2y$10$vY7U7UvE8fJ5y.j7x9a.9d6eF4g7h8i9j0k1l2m3n4o5p6q7r8s9t',
    'Budi Santoso (Wali Murid)', 'user', NULL, NULL, '082111000001', 'approved'
  )
ON CONFLICT (username) DO NOTHING;

-- Update salt + password_hash ke format SHA-256 (dari setup_users.sql)
-- Jalankan setelah seed di atas berhasil.
UPDATE users SET
  salt          = 'mbgadmin_bg01',
  password_hash = 'b5ed41b460aed4182dc9264711bea4065c7dc81003992371b2dd092eb4058a7b',
  active        = TRUE
WHERE username = 'admin_bgn';

UPDATE users SET
  salt          = 'mbgsppg_jak01',
  password_hash = 'b56f61a5918b84866c8a2c2de7238a1de0f1c6801bbb1dfa7356d388be9dc461',
  active        = TRUE
WHERE username = 'sppg_jakpus_01';

UPDATE users SET
  salt          = 'mbgsppg_ban01',
  password_hash = '5aa3d8264001893e608bf2f312773461ad50a5b8b53c044c39620a3aea0a5691',
  active        = TRUE
WHERE username = 'sppg_bandung_01';

UPDATE users SET
  salt          = 'mbgwali_mur01',
  password_hash = '3e75eb111b2975a4e0a6fedc9dbf2092c689951f8eba0948cf9268bba9724d7e',
  active        = TRUE
WHERE username = 'wali_murid_01';
