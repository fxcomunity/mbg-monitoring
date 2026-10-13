-- ============================================================
-- Database: radar_mbg
-- Skema lengkap untuk sistem laporan/aduan MBG Nasional
-- ============================================================

CREATE DATABASE IF NOT EXISTS `radar_mbg`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `radar_mbg`;

-- ----------------------------------------------------------------
-- Tabel: laporan_aduan
-- Menyimpan setiap pengaduan publik yang masuk dari formulir web
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `laporan_aduan` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ticket_code`       VARCHAR(30)     NOT NULL UNIQUE COMMENT 'Kode tiket unik, cth: TKT-BGN-20261014-4821',
  `reporter_name`     VARCHAR(120)    NOT NULL COMMENT 'Nama lengkap atau inisial pelapor',
  `reporter_phone`    VARCHAR(20)     NOT NULL COMMENT 'Nomor WhatsApp aktif pelapor',
  `reporter_role`     ENUM('wali','guru','komite','siswa','masyarakat') NOT NULL DEFAULT 'masyarakat'
                                      COMMENT 'Peran/status pelapor',
  `issue_category`    ENUM('waktu','menu','suhu','higienitas','alergen','lainnya') NOT NULL DEFAULT 'lainnya'
                                      COMMENT 'Kategori jenis masalah',
  `school_target`     VARCHAR(200)    NOT NULL COMMENT 'Nama sekolah atau lembaga yang dilaporkan',
  `incident_date`     DATE            NOT NULL COMMENT 'Tanggal kejadian yang dilaporkan',
  `description`       TEXT            NOT NULL COMMENT 'Deskripsi rinci kronologi kejadian',
  `photo_path`        VARCHAR(500)    NULL COMMENT 'Path file foto bukti yang diunggah',
  `photo_original_name` VARCHAR(255)  NULL COMMENT 'Nama file asli foto',
  `status`            ENUM('masuk','verifikasi','proses','selesai','ditolak') NOT NULL DEFAULT 'masuk'
                                      COMMENT 'Status penanganan laporan oleh satgas',
  `priority`          ENUM('rendah','sedang','tinggi','kritis') NOT NULL DEFAULT 'sedang'
                                      COMMENT 'Prioritas penanganan',
  `satgas_notes`      TEXT            NULL COMMENT 'Catatan internal tim satgas verifikator',
  `ip_address`        VARCHAR(45)     NULL COMMENT 'IP address pengirim (IPv4/IPv6)',
  `user_agent`        VARCHAR(500)    NULL COMMENT 'Browser/client pengirim',
  `created_at`        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_ticket`          (`ticket_code`),
  INDEX `idx_status`          (`status`),
  INDEX `idx_category`        (`issue_category`),
  INDEX `idx_school`          (`school_target`(100)),
  INDEX `idx_incident_date`   (`incident_date`),
  INDEX `idx_created`         (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Tabel pengaduan publik program MBG – dikelola Satgas BGN';

-- ----------------------------------------------------------------
-- Tabel: aduan_log
-- Riwayat perubahan status untuk audit trail
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `aduan_log` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `laporan_id`    BIGINT UNSIGNED NOT NULL,
  `old_status`    VARCHAR(20)     NULL,
  `new_status`    VARCHAR(20)     NOT NULL,
  `changed_by`    VARCHAR(80)     NOT NULL DEFAULT 'sistem',
  `notes`         TEXT            NULL,
  `created_at`    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_log_laporan`
    FOREIGN KEY (`laporan_id`) REFERENCES `laporan_aduan` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX `idx_log_laporan` (`laporan_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Audit trail perubahan status laporan aduan';

-- ----------------------------------------------------------------
-- Data contoh awal (3 baris demo)
-- ----------------------------------------------------------------
INSERT INTO `laporan_aduan`
  (`ticket_code`, `reporter_name`, `reporter_phone`, `reporter_role`,
   `issue_category`, `school_target`, `incident_date`, `description`,
   `status`, `priority`, `ip_address`)
VALUES
  ('TKT-BGN-20261013-1001', 'Budi S.', '082111000001', 'wali',
   'suhu', 'SDN 01 Senayan Jakarta', '2026-10-13',
   'Makanan tiba sudah dingin, suhu jauh di bawah 60°C.',
   'verifikasi', 'tinggi', '127.0.0.1'),

  ('TKT-BGN-20261013-1002', 'Sari (Guru)', '081200000002', 'guru',
   'menu', 'SMPN 19 Kebayoran Baru', '2026-10-13',
   'Menu tertulis ayam panggang tapi yang datang hanya tahu kukus tanpa lauk utama.',
   'masuk', 'sedang', '127.0.0.1'),

  ('TKT-BGN-20261013-1003', 'Komite RW.05', '087800000003', 'komite',
   'waktu', 'SDN Sukajadi 03 Bandung', '2026-10-12',
   'Pengantaran terlambat lebih dari 90 menit tanpa pemberitahuan.',
   'proses', 'sedang', '127.0.0.1');
