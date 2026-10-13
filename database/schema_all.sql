-- ==============================================================================
-- RADAR MBG NASIONAL — SKEMA BASIS DATA TERPADU (FULL COMPREHENSIVE SCHEMA)
-- Platform : Neon Cloud PostgreSQL / PostgreSQL 14+
-- Deskripsi: Skema lengkap sistem monitoring, telemetri, menu SPPG, laporan aduan,
--            manajemen akun & foto profil, sistem keamanan WAF, serta Live Chat.
-- ==============================================================================

-- Ekstensi PostgreSQL yang dibutuhkan
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. FUNGSI & TRIGGER UMUM: Auto-update kolom updated_at
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. TABEL: users (Akun Satgas Admin, Mitra Dapur SPPG, dan Pengguna/Wali Murid)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                 BIGSERIAL PRIMARY KEY,
  username           VARCHAR(60) NOT NULL UNIQUE,
  email              VARCHAR(120) NOT NULL UNIQUE,
  password_hash      VARCHAR(255) NOT NULL,
  full_name          VARCHAR(120) NOT NULL,
  role               VARCHAR(20) NOT NULL DEFAULT 'user'
                       CHECK (role IN ('admin', 'sppg', 'user')),
  sppg_name          VARCHAR(150),
  sppg_code          VARCHAR(50),
  phone              VARCHAR(25),
  avatar_url         VARCHAR(500),
  avatar_pending_url VARCHAR(500),
  avatar_status      VARCHAR(20) NOT NULL DEFAULT 'approved'
                       CHECK (avatar_status IN ('approved', 'pending_approval', 'rejected')),
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role     ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_sppg     ON users(sppg_code);

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------------------------
-- 3. TABEL: telemetri_nasional (KPI Pemantauan Realtime BGN)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS telemetri_nasional (
  id                 SERIAL PRIMARY KEY,
  porsi_tersalurkan  BIGINT NOT NULL DEFAULT 4850210,
  persen_target      NUMERIC(5,2) NOT NULL DEFAULT 99.20,
  sppg_aktif         INT NOT NULL DEFAULT 1284,
  sekolah_terlayani  INT NOT NULL DEFAULT 18420,
  kepatuhan_akg      NUMERIC(5,2) NOT NULL DEFAULT 99.60,
  suhu_rata_rata     NUMERIC(4,1) NOT NULL DEFAULT 65.8,
  sla_distribusi     NUMERIC(5,2) NOT NULL DEFAULT 99.80,
  pembaruan_teks     VARCHAR(100) NOT NULL DEFAULT 'Hari ini, Pukul 11.45 WIB',
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. TABEL: distribusi_provinsi (Sebaran Logistik & Persentase Salur Wilayah)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS distribusi_provinsi (
  id           SERIAL PRIMARY KEY,
  provinsi     VARCHAR(100) NOT NULL UNIQUE,
  target_porsi BIGINT NOT NULL,
  ketepatan    NUMERIC(5,2) NOT NULL,
  status       VARCHAR(50) NOT NULL,
  region_code  VARCHAR(30) NOT NULL DEFAULT 'jawa',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_distribusi_region ON distribusi_provinsi(region_code);

-- ------------------------------------------------------------------------------
-- 5. TABEL: menu_sppg (Manajemen Sajian Harian & Standar Nutrisi BGN)
-- ------------------------------------------------------------------------------
-- 5. TABEL: menu_sppg (Manajemen Sajian Harian & Standar Nutrisi BGN)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS menu_sppg (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT REFERENCES users(id) ON DELETE SET NULL,
  school_key      VARCHAR(100),
  school_target   VARCHAR(200) NOT NULL,
  province_code   VARCHAR(30)  DEFAULT 'dki',
  province_name   VARCHAR(100) DEFAULT 'DKI Jakarta',
  city_code       VARCHAR(50)  DEFAULT 'jaksel',
  city            VARCHAR(80)  NOT NULL,
  kecamatan       VARCHAR(100),
  jenjang         VARCHAR(20)  DEFAULT 'sd',
  age_group       TEXT,
  arrival_status  VARCHAR(150),
  menu_cycle      VARCHAR(100),
  menu_date       DATE         NOT NULL DEFAULT CURRENT_DATE,
  menu_title      VARCHAR(200) NOT NULL,
  description     TEXT,
  calories        INT          NOT NULL DEFAULT 620,
  temperature     NUMERIC(4,1) NOT NULL DEFAULT 65.0,
  portion_count   INT          NOT NULL DEFAULT 500,
  photo_url       VARCHAR(500),
  sppg_name       VARCHAR(150) NOT NULL,
  sppg_address    VARCHAR(255),
  sppg_radius     VARCHAR(50),
  dietitian       VARCHAR(120) NOT NULL,
  dietitian_title VARCHAR(150),
  lab_test_cert   VARCHAR(150),
  status          VARCHAR(20)  NOT NULL DEFAULT 'terkirim'
                    CHECK (status IN ('persiapan', 'dikirim', 'terkirim', 'evaluasi')),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_date   ON menu_sppg(menu_date);
CREATE INDEX IF NOT EXISTS idx_menu_school ON menu_sppg(school_target);
CREATE INDEX IF NOT EXISTS idx_menu_key    ON menu_sppg(school_key);
CREATE INDEX IF NOT EXISTS idx_menu_prov   ON menu_sppg(province_code);

-- ------------------------------------------------------------------------------
-- 6. TABEL: laporan_aduan (Pusat Pengaduan Publik & Satgas MBG)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS laporan_aduan (
  id                  BIGSERIAL PRIMARY KEY,
  ticket_code         VARCHAR(30)  NOT NULL UNIQUE,
  reporter_name       VARCHAR(120) NOT NULL,
  reporter_phone      VARCHAR(20)  NOT NULL,
  reporter_role       VARCHAR(20)  NOT NULL DEFAULT 'masyarakat'
                        CHECK (reporter_role IN ('wali','guru','komite','siswa','masyarakat')),
  issue_category      VARCHAR(20)  NOT NULL DEFAULT 'lainnya'
                        CHECK (issue_category IN ('waktu','menu','suhu','higienitas','alergen','lainnya')),
  school_target       VARCHAR(200) NOT NULL,
  incident_date       DATE         NOT NULL,
  description         TEXT         NOT NULL,
  photo_path          VARCHAR(500),
  photo_original_name VARCHAR(255),
  status              VARCHAR(20)  NOT NULL DEFAULT 'masuk'
                        CHECK (status IN ('masuk','verifikasi','proses','selesai','ditolak')),
  priority            VARCHAR(10)  NOT NULL DEFAULT 'sedang'
                        CHECK (priority IN ('rendah','sedang','tinggi','kritis')),
  satgas_notes        TEXT,
  ip_address          VARCHAR(45),
  user_agent          VARCHAR(500),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_laporan_ticket        ON laporan_aduan(ticket_code);
CREATE INDEX IF NOT EXISTS idx_laporan_status        ON laporan_aduan(status);
CREATE INDEX IF NOT EXISTS idx_laporan_category      ON laporan_aduan(issue_category);
CREATE INDEX IF NOT EXISTS idx_laporan_incident_date ON laporan_aduan(incident_date);
CREATE INDEX IF NOT EXISTS idx_laporan_created       ON laporan_aduan(created_at DESC);

DROP TRIGGER IF EXISTS trg_laporan_updated_at ON laporan_aduan;
CREATE TRIGGER trg_laporan_updated_at
  BEFORE UPDATE ON laporan_aduan
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------------------------
-- 7. TABEL: aduan_log (Audit Trail Perubahan Status Laporan)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS aduan_log (
  id          BIGSERIAL PRIMARY KEY,
  laporan_id  BIGINT      NOT NULL REFERENCES laporan_aduan(id) ON DELETE CASCADE,
  old_status  VARCHAR(20),
  new_status  VARCHAR(20) NOT NULL,
  changed_by  VARCHAR(80) NOT NULL DEFAULT 'sistem',
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_log_laporan ON aduan_log(laporan_id);

-- ------------------------------------------------------------------------------
-- 8. TABEL: exploit_logs (Deteksi Serangan WAF, XSS, SQL Injection)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exploit_logs (
  id             BIGSERIAL PRIMARY KEY,
  ip_address     VARCHAR(45),
  user_agent     VARCHAR(500),
  exploit_type   VARCHAR(60) NOT NULL,
  input_field    VARCHAR(80),
  payload_sample TEXT,
  requested_url  VARCHAR(500),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exploit_type ON exploit_logs(exploit_type);
CREATE INDEX IF NOT EXISTS idx_exploit_time ON exploit_logs(created_at DESC);

-- ------------------------------------------------------------------------------
-- 9. TABEL: live_chat_messages (Sistem Pesan Interaktif User <-> Admin & SPPG)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS live_chat_messages (
  id               BIGSERIAL PRIMARY KEY,
  session_id       VARCHAR(64)  NOT NULL,
  sender_type      VARCHAR(20)  NOT NULL DEFAULT 'user'
                     CHECK (sender_type IN ('user', 'admin', 'sppg', 'bot')),
  sender_id        BIGINT REFERENCES users(id) ON DELETE SET NULL,
  sender_name      VARCHAR(120) NOT NULL,
  target_type      VARCHAR(20)  NOT NULL DEFAULT 'admin'
                     CHECK (target_type IN ('admin', 'sppg')),
  target_sppg_id   BIGINT REFERENCES users(id) ON DELETE SET NULL,
  target_sppg_name VARCHAR(150),
  message          TEXT         NOT NULL,
  is_template      BOOLEAN      NOT NULL DEFAULT FALSE,
  is_read          BOOLEAN      NOT NULL DEFAULT FALSE,
  ip_address       VARCHAR(45),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_session ON live_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_target  ON live_chat_messages(target_type);
CREATE INDEX IF NOT EXISTS idx_chat_created ON live_chat_messages(created_at DESC);

-- ------------------------------------------------------------------------------
-- 10. TABEL: live_chat_templates (Template Pertanyaan Cepat MBG)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS live_chat_templates (
  id          SERIAL PRIMARY KEY,
  target_role VARCHAR(20) NOT NULL DEFAULT 'all' CHECK (target_role IN ('all', 'admin', 'sppg')),
  category    VARCHAR(50) NOT NULL DEFAULT 'umum',
  label       VARCHAR(150) NOT NULL,
  question    TEXT NOT NULL,
  auto_answer TEXT NOT NULL,
  sort_order  INT NOT NULL DEFAULT 10
);

-- ------------------------------------------------------------------------------
-- SEED DATA AWAL: Template Pertanyaan Cepat (Quick Replies)
-- ------------------------------------------------------------------------------
INSERT INTO live_chat_templates (target_role, category, label, question, auto_answer, sort_order)
VALUES
  ('sppg', 'menu', '🍛 Menu Hari Ini', 'Min, menu makanan hari ini apa ya untuk sekolah kami?', 'Halo! Menu hari ini dirancang oleh Ahli Gizi BGN dengan standar porsi seimbang 620-680 kkal (Nasi Pulen, Ayam Fillet Panggang Kecap, Tahu Tempe Bacem, Sayur Bening Bayam Jagung, dan Buah Pisang Mas). Anda juga dapat memantau rincian kalori lengkap di menu tab "Menu Hari Ini".', 1),
  ('sppg', 'alergen', '⚠️ Pengecekan Alergen', 'Apakah sajian hari ini mengandung bahan alergen seperti kacang, telur, atau makanan laut?', 'Seluruh dapur SPPG menerapkan pemisahan kontaminasi silang (cross-contamination). Sajian hari ini BEBAS alergen kacang tanah dan makanan laut. Bila anak Anda memiliki kondisi khusus, silakan infokan nama siswa dan sekolah kepada tim verifikator kami.', 2),
  ('sppg', 'distribusi', '⏱️ Jadwal Tiba Makanan', 'Kira-kira jam berapa distribusi makanan sampai di sekolah?', 'Berdasarkan standar BGN, armada rantai hangat (hot chain) diberangkatkan pukul 09.30 WIB dan tiba di satuan pendidikan paling lambat pukul 11.15 WIB (sebelum jam istirahat makan siang). Suhu sajian dijaga tetap di atas 60°C.', 3),
  ('admin', 'aduan', '📝 Cara Melaporkan Masalah', 'Bagaimana prosedur jika porsi makanan kurang, dingin, atau basi?', 'Anda dapat langsung mengisi formulir di menu "Laporan & Aduan Publik" atau kirim foto kondisi makanan ke chat ini. Tim Satgas BGN Pusat akan memverifikasi dan merespons dalam waktu kurang dari 120 menit.', 4),
  ('admin', 'standar', '🌡️ Standar Higienitas & AKG', 'Bagaimana standar mutu dan higienitas dapur SPPG yang terakreditasi?', 'Setiap dapur SPPG wajib memiliki Sertifikat Laik Higiene Sanitasi (SLHS), uji lab cemaran mikroba berkala, dan diawasi langsung oleh Tenaga Gizi Terdaftar (Nutrisionis) bersertifikasi Satgas BGN.', 5)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------------------
-- SEED DATA AWAL: Akun Default (Admin, Mitra SPPG, Wali Murid)
-- Password Default:
-- admin_bgn -> admin1234
-- sppg_jakpus_01 -> sppg1234
-- sppg_bandung_01 -> sppg1234
-- wali_murid_01 -> user1234
-- ------------------------------------------------------------------------------
INSERT INTO users (username, email, password_hash, full_name, role, sppg_name, sppg_code, phone, avatar_status)
VALUES
  ('admin_bgn', 'admin@bgn.go.id', '$2y$10$wT0E0jP7n9Fj.P9OQjX5s.1bO4c6X51x6y3z4B5n6M7l8K9j0H1g2', 'Satgas Administrator BGN', 'admin', NULL, 'ADM-01', '081110008008', 'approved'),
  ('sppg_jakpus_01', 'sppg.jakpus@bgn.go.id', '$2y$10$tZ8V8VwF9gK6z.k8y0b.0e7fG5h8j9k0l1m2n3o4p5q6r7s8t9u0v', 'Dapur SPPG Menteng Senayan', 'sppg', 'SPPG Menteng Senayan Jakarta Pusat', 'SPPG-JKT-01', '081299887711', 'approved'),
  ('sppg_bandung_01', 'sppg.bdg@bgn.go.id', '$2y$10$tZ8V8VwF9gK6z.k8y0b.0e7fG5h8j9k0l1m2n3o4p5q6r7s8t9u0v', 'Dapur SPPG Sukajadi Bandung', 'sppg', 'SPPG Sukajadi Kota Bandung', 'SPPG-BDG-01', '081388776622', 'approved'),
  ('wali_murid_01', 'wali.budi@gmail.com', '$2y$10$vY7U7UvE8fJ5y.j7x9a.9d6eF4g7h8i9j0k1l2m3n4o5p6q7r8s9t', 'Budi Santoso (Wali Murid)', 'user', NULL, NULL, '082111000001', 'approved')
ON CONFLICT (username) DO NOTHING;

-- ------------------------------------------------------------------------------
-- SEED DATA AWAL: Telemetri Nasional (5 KPI Utama BGN)
-- ------------------------------------------------------------------------------
INSERT INTO telemetri_nasional (
  porsi_tersalurkan, persen_target, sppg_aktif, sekolah_terlayani, kepatuhan_akg, suhu_rata_rata, sla_distribusi, pembaruan_teks
) VALUES (
  4850210, 99.20, 1284, 18420, 99.60, 65.8, 99.80, 'Hari ini, Pukul 11.45 WIB'
) ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------------------
-- SEED DATA AWAL: Distribusi Provinsi
-- ------------------------------------------------------------------------------
INSERT INTO distribusi_provinsi (provinsi, target_porsi, ketepatan, status, region_code, updated_at)
VALUES
  ('DKI Jakarta', 480200, 99.90, 'Selesai Salur', 'jawa', NOW()),
  ('Jawa Barat', 1250000, 99.40, 'Selesai Salur', 'jawa', NOW()),
  ('Jawa Timur', 1180500, 99.10, 'Selesai Salur', 'jawa', NOW()),
  ('Jawa Tengah', 940000, 99.20, 'Selesai Salur', 'jawa', NOW()),
  ('Sumatera Utara', 540000, 98.80, '94% Salur', 'sumatera', NOW()),
  ('Kalimantan Timur', 210300, 98.60, 'Selesai Salur', 'kalimantan', NOW()),
  ('Sulawesi Selatan', 360400, 98.20, 'Selesai Salur', 'sulawesi', NOW()),
  ('Bali', 185000, 99.70, 'Selesai Salur', 'bali-nusa', NOW()),
  ('Papua Induk', 125800, 96.50, 'Jalur Khusus', 'papua', NOW())
ON CONFLICT (provinsi) DO UPDATE SET
  target_porsi = EXCLUDED.target_porsi,
  ketepatan = EXCLUDED.ketepatan,
  status = EXCLUDED.status,
  region_code = EXCLUDED.region_code,
  updated_at = NOW();

-- ------------------------------------------------------------------------------
-- SEED DATA AWAL: Laporan Contoh
-- ------------------------------------------------------------------------------
INSERT INTO laporan_aduan (
  ticket_code, reporter_name, reporter_phone, reporter_role,
  issue_category, school_target, incident_date, description,
  status, priority, ip_address
) VALUES
  ('TKT-BGN-20261013-1001', 'Budi S.', '082111000001', 'wali', 'suhu', 'SDN 01 Senayan Jakarta', '2026-10-13', 'Makanan tiba sudah dingin, suhu jauh di bawah 60°C.', 'verifikasi', 'tinggi', '127.0.0.1'),
  ('TKT-BGN-20261013-1002', 'Sari (Guru)', '081200000002', 'guru', 'menu', 'SMPN 19 Kebayoran Baru', '2026-10-13', 'Menu tertulis ayam panggang tapi yang datang hanya tahu kukus tanpa lauk utama.', 'masuk', 'sedang', '127.0.0.1'),
  ('TKT-BGN-20261013-1003', 'Komite RW.05', '087800000003', 'komite', 'waktu', 'SDN Sukajadi 03 Bandung', '2026-10-12', 'Pengantaran terlambat lebih dari 90 menit tanpa pemberitahuan.', 'proses', 'sedang', '127.0.0.1')
ON CONFLICT (ticket_code) DO NOTHING;

-- ------------------------------------------------------------------------------
-- SEED DATA AWAL: Menu SPPG & Daftar Sekolah Terdaftar
-- ------------------------------------------------------------------------------
INSERT INTO menu_sppg (
  school_key, school_target, province_code, province_name, city_code, city, kecamatan,
  jenjang, age_group, arrival_status, menu_cycle, menu_title, description,
  calories, temperature, portion_count, photo_url, sppg_name, sppg_address,
  sppg_radius, dietitian, dietitian_title, lab_test_cert, status
) VALUES
  (
    'sdn-01-senayan', 'SDN 01 Senayan Jakarta', 'dki', 'DKI Jakarta', 'jaksel', 'Jakarta Selatan', 'Kebayoran Baru',
    'sd', 'Dipersiapkan khusus untuk kelompok usia SD (7-12 tahun) dengan mikronutrien lengkap.',
    'Telah Tiba di Sekolah (Pukul 09:30 WIB)', 'Siklus Menu: Pekan ke-4 (Menu A-03)',
    'Paket Gizi Juara Ayam Fillet Panggang Kecap & Tumis Brokoli Wortel',
    'Nasi pulen fortifikasi vitamin A & zat besi, ayam fillet panggang kecap manis rendah garam, tahu sutra bacem kukus, tumis brokoli wortel bawang putih segar, dan buah pisang ambon pilihan.',
    620, 68.4, 520, 'https://lh3.googleusercontent.com/aida-public/AB6AXuCkLbSHziTgMS4wjfXnmGJaa87bd_N3KasCcc2H4qhnJv0-x1bXQDvleyxCuK58099ZoZfRbhBN8WpUfixGsZsefv_a7MSmNJ3smRd3oXRskR5Vg7Nxz16LFyr9C-wrk8QimhpK8Y0YYqWL4eT4Hl9kHVFimf3FAjdcJfglmxj3dWfqWiVQN0QL-uaA1bRCAWeW3sSvk0sUJAEDLbARjtbg1VzCHnlLwoPl9Ghqvw8_OF7pN35D3hpA',
    'SPPG Senayan Kebayoran Baru', 'Jl. Asia Afrika No. 10, Gelora, Tanah Abang, Jakarta Pusat',
    'Radius 1.8 km', 'Ratna Kusuma, S.Gz, RD', 'Dietisien Tersertifikasi Satgas BGN',
    'BGN-JKT-2410-0982 (Lolos Uji Mikrobiologi & Bebas Alergen Kacang)', 'terkirim'
  ),
  (
    'sdn-menteng-01', 'SDN 01 Menteng Jakarta Pusat', 'dki', 'DKI Jakarta', 'jakpus', 'Jakarta Pusat', 'Menteng',
    'sd', 'Dipersiapkan untuk murid SD (7-12 tahun) dengan kebutuhan kalsium tinggi.',
    'Telah Tiba di Sekolah (Pukul 09:45 WIB)', 'Siklus Menu: Pekan ke-4 (Menu A-04)',
    'Paket Semangat Ikan Dori Fillet Crispy & Sup Bening Labu Siam Jagung',
    'Ikan dori fillet saus tiram tanpa MSG sintetik, tempe krispi oven non-kolesterol, sayur labu siam manis panen hidroponik, nasi merah organik, dan jeruk manis Pontianak.',
    615, 67.2, 480, 'https://lh3.googleusercontent.com/aida-public/AB6AXuAwR5CVQiGD-H1fLUUponcAoEgYaN5aHuUlkSYx7VYibymErkMuxd4kpHCINI0yNwww28_Q20uaOh0k6QpFqdvgze341zsESFy56Wh7KKDq13nMkXC2fmc3f0kDvQKaCVaayI2ON_fnRnWIfuUo0Uq4TrCGbz9CKsnotxUVJNd0XPHiaWRAXyHcoK--j04X6sgwHcdFptTmLPtO5jB9ICGczB-XGXe7_7N-42Vddd89h3t6MQo4pX3P',
    'SPPG Menteng Sentral', 'Jl. Cikini Raya No. 45, Menteng, Jakarta Pusat',
    'Radius 2.2 km', 'Faisal Rahman, S.Gz', 'Dietisien Senior Dapur SPPG',
    'BGN-JKT-2410-0988 (Lolos Uji Cemaran Logam Berat)', 'terkirim'
  ),
  (
    'smpn-19-kby', 'SMPN 19 Kebayoran Baru', 'dki', 'DKI Jakarta', 'jaksel', 'Jakarta Selatan', 'Kebayoran Baru',
    'smp', 'Dipersiapkan untuk kelompok remaja awal SMP (13-15 tahun) dengan asupan protein ganda mendukung fase growth spurt.',
    'Telah Tiba di Sekolah (Pukul 10:15 WIB)', 'Siklus Menu: Pekan ke-3 (Menu A-12)',
    'Paket Remaja Rolade Tuna Saus Tomat & Capcay Puyuh',
    'Ikan tuna laut segar kaya omega-3, capcay sayur panen lokal, tahu tempe bacem, nasi pulen fortifikasi, dan susu murni Boyolali.',
    710, 69.5, 620, 'https://lh3.googleusercontent.com/aida-public/AB6AXuCkLbSHziTgMS4wjfXnmGJaa87bd_N3KasCcc2H4qhnJv0-x1bXQDvleyxCuK58099ZoZfRbhBN8WpUfixGsZsefv_a7MSmNJ3smRd3oXRskR5Vg7Nxz16LFyr9C-wrk8QimhpK8Y0YYqWL4eT4Hl9kHVFimf3FAjdcJfglmxj3dWfqWiVQN0QL-uaA1bRCAWeW3sSvk0sUJAEDLbARjtbg1VzCHnlLwoPl9Ghqvw8_OF7pN35D3hpA',
    'SPPG Kebayoran Baru 02', 'Jl. Bumi No. 21, Kebayoran Baru, Jakarta Selatan',
    'Radius 2.1 km', 'Nurul Hidayati, S.Gz', 'Dietisien Ahli Muda BGN',
    'BGN-JKT-2410-0995 (Lolos Uji Sensoris & Kimia)', 'terkirim'
  ),
  (
    'sman-3-jkt', 'SMAN 3 Jakarta (Setiabudi)', 'dki', 'DKI Jakarta', 'jaksel', 'Jakarta Selatan', 'Setiabudi',
    'sma', 'Diformulasikan untuk siswa SMA (16-18 tahun) guna konsentrasi belajar optimal.',
    'Telah Tiba di Sekolah (Pukul 09:50 WIB)', 'Siklus Menu: Pekan ke-4 (Menu C-02)',
    'Paket Cerdas Daging Sapi Teriyaki Sayur Pelangi & Sup Jamur Salju',
    'Irisan daging sapi rendah lemak kaya zat besi heme, telur puyuh omega-3, sup jamur salju kaya serat, nasi putih pulen, dan jus jambu merah murni.',
    780, 66.8, 750, 'https://lh3.googleusercontent.com/aida-public/AB6AXuAwR5CVQiGD-H1fLUUponcAoEgYaN5aHuUlkSYx7VYibymErkMuxd4kpHCINI0yNwww28_Q20uaOh0k6QpFqdvgze341zsESFy56Wh7KKDq13nMkXC2fmc3f0kDvQKaCVaayI2ON_fnRnWIfuUo0Uq4TrCGbz9CKsnotxUVJNd0XPHiaWRAXyHcoK--j04X6sgwHcdFptTmLPtO5jB9ICGczB-XGXe7_7N-42Vddd89h3t6MQo4pX3P',
    'SPPG Kuningan Sentral BGN', 'Kawasan Epicentrum Rasuna Said, Jakarta Selatan',
    'Radius 1.5 km', 'dr. Hendra Pratama, M.Gizi', 'Spesialis Nutrisi Remaja BGN',
    'BGN-JKT-2410-1002 (Lolos Uji Mutu Sensori & Higienitas)', 'terkirim'
  ),
  (
    'sdn-sukajadi-03', 'SDN Sukajadi 03 Bandung', 'jabar', 'Jawa Barat', 'kota-bandung', 'Kota Bandung', 'Sukajadi',
    'sd', 'Diformulasikan untuk peserta didik SD (7-12 tahun) mengoptimalkan kecukupan kalsium & protein hewani.',
    'Telah Tiba di Sekolah (Pukul 09:20 WIB)', 'Siklus Menu: Pekan ke-2 (Menu B-05)',
    'Paket Priangan Ayam Bumbu Kuning & Sayur Lodeh Labu Lembut',
    'Ayam ungkep bumbu rempah alami kunyit-lengkuas, tahu tempe goreng air-fryer, sayur lodeh santan encer kaya serat, nasi putih hangat, dan pepaya segar Jawa Barat.',
    630, 67.5, 430, 'https://lh3.googleusercontent.com/aida-public/AB6AXuCkLbSHziTgMS4wjfXnmGJaa87bd_N3KasCcc2H4qhnJv0-x1bXQDvleyxCuK58099ZoZfRbhBN8WpUfixGsZsefv_a7MSmNJ3smRd3oXRskR5Vg7Nxz16LFyr9C-wrk8QimhpK8Y0YYqWL4eT4Hl9kHVFimf3FAjdcJfglmxj3dWfqWiVQN0QL-uaA1bRCAWeW3sSvk0sUJAEDLbARjtbg1VzCHnlLwoPl9Ghqvw8_OF7pN35D3hpA',
    'SPPG Sukajadi Kota Bandung', 'Jl. Sukajadi No. 182, Kota Bandung, Jawa Barat',
    'Radius 2.4 km', 'Rina Wulandari, S.Gz', 'Dietisien Koordinator Wilayah Jabar',
    'BGN-JBR-2410-0431 (Terverifikasi Higiene Sanitasi)', 'terkirim'
  ),
  (
    'smpn-3-sby', 'SMPN 3 Surabaya', 'jatim', 'Jawa Timur', 'kota-surabaya', 'Kota Surabaya', 'Genteng',
    'smp', 'Dipersiapkan untuk peserta didik SMP (13-15 tahun) dengan standar kuah rempah kaya kunyit alami.',
    'Telah Tiba di Sekolah (Pukul 10:00 WIB)', 'Siklus Menu: Pekan ke-2 (Menu J-07)',
    'Paket Nusantara Soto Ayam Lamongan Bening & Perkedel',
    'Soto ayam bumbu alami tanpa MSG buatan, tauge segar, telur rebus utuh omega-3, nasi putih pulen, dan semangka potong manis.',
    690, 71.2, 580, 'https://lh3.googleusercontent.com/aida-public/AB6AXuCkLbSHziTgMS4wjfXnmGJaa87bd_N3KasCcc2H4qhnJv0-x1bXQDvleyxCuK58099ZoZfRbhBN8WpUfixGsZsefv_a7MSmNJ3smRd3oXRskR5Vg7Nxz16LFyr9C-wrk8QimhpK8Y0YYqWL4eT4Hl9kHVFimf3FAjdcJfglmxj3dWfqWiVQN0QL-uaA1bRCAWeW3sSvk0sUJAEDLbARjtbg1VzCHnlLwoPl9Ghqvw8_OF7pN35D3hpA',
    'SPPG Surabaya Rungkut Sentral', 'Kawasan Industri SIER No. 12, Rungkut, Surabaya',
    'Radius 4.1 km', 'Bambang Trianto, S.Gz, RD', 'Dietisien Koordinator BGN Jatim',
    'BGN-JTM-2410-0712 (Uji Mikrobiologi Negatif)', 'terkirim'
  ),
  (
    'smpn-1-smg', 'SMPN 1 Semarang', 'jateng', 'Jawa Tengah', 'kota-semarang', 'Kota Semarang', 'Semarang Tengah',
    'smp', 'Dipersiapkan untuk murid SMP (13-15 tahun) dengan pemanfaatan protein ikan bandeng bebas duri.',
    'Telah Tiba di Sekolah (Pukul 10:10 WIB)', 'Siklus Menu: Pekan ke-3 (Menu T-11)',
    'Paket Pesisir Ikan Bandeng Bakar Madu & Oseng Buncis',
    'Bandeng tanpa duri bumbu bakar madu lokal, tahu bacem, oseng buncis manis, nasi putih, dan pisang ambon segar.',
    720, 68.5, 510, 'https://lh3.googleusercontent.com/aida-public/AB6AXuAwR5CVQiGD-H1fLUUponcAoEgYaN5aHuUlkSYx7VYibymErkMuxd4kpHCINI0yNwww28_Q20uaOh0k6QpFqdvgze341zsESFy56Wh7KKDq13nMkXC2fmc3f0kDvQKaCVaayI2ON_fnRnWIfuUo0Uq4TrCGbz9CKsnotxUVJNd0XPHiaWRAXyHcoK--j04X6sgwHcdFptTmLPtO5jB9ICGczB-XGXe7_7N-42Vddd89h3t6MQo4pX3P',
    'SPPG Semarang Tengah', 'Jl. Pemuda No. 70, Semarang Tengah, Kota Semarang',
    'Radius 2.8 km', 'dr. Agus Wijaya, Sp.GK', 'Dietisien Spesialis Gizi Klinis BGN',
    'BGN-JTG-2410-0899 (Negatif Formalin & Boraks)', 'terkirim'
  )
ON CONFLICT DO NOTHING;
