-- ==============================================================================
-- live_chat.sql — Live Chat Radar MBG (PostgreSQL / Neon)
-- Cocok dengan api/live_chat.php. Aman dijalankan berulang (idempotent).
-- Urutan: jalankan schema_all.sql dulu (butuh tabel users), baru file ini.
-- ==============================================================================

-- 0. Kalau dulu sempat jalanin versi lama (kolom channel/ai_response), amankan dulu
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'live_chat_messages')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name = 'live_chat_messages' AND column_name = 'session_id')
  THEN
    ALTER TABLE live_chat_messages RENAME TO live_chat_messages_old;
  END IF;
END $$;

-- 1. Pesan chat (user <-> Satgas BGN / Mitra SPPG)
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

CREATE INDEX IF NOT EXISTS idx_chat_session  ON live_chat_messages (session_id);
CREATE INDEX IF NOT EXISTS idx_chat_poll     ON live_chat_messages (session_id, id);          -- polling "id > ?"
CREATE INDEX IF NOT EXISTS idx_chat_target   ON live_chat_messages (target_type, target_sppg_name);
CREATE INDEX IF NOT EXISTS idx_chat_created  ON live_chat_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_unread   ON live_chat_messages (target_type) WHERE is_read = FALSE;

-- 2. Template pertanyaan cepat
CREATE TABLE IF NOT EXISTS live_chat_templates (
  id          SERIAL PRIMARY KEY,
  target_role VARCHAR(20)  NOT NULL DEFAULT 'all' CHECK (target_role IN ('all', 'admin', 'sppg')),
  category    VARCHAR(50)  NOT NULL DEFAULT 'umum',
  label       VARCHAR(150) NOT NULL,
  question    TEXT         NOT NULL,
  auto_answer TEXT         NOT NULL,
  sort_order  INT          NOT NULL DEFAULT 10
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_template_label ON live_chat_templates (target_role, label);

INSERT INTO live_chat_templates (target_role, category, label, question, auto_answer, sort_order) VALUES
  ('sppg',  'menu',       '🍛 Menu Hari Ini',
   'Min, menu makanan hari ini apa ya untuk sekolah kami?',
   'Halo! Menu hari ini dirancang oleh Ahli Gizi BGN dengan standar porsi seimbang 620-680 kkal. Rincian lengkap bisa dicek di tab "Menu Hari Ini".', 1),
  ('sppg',  'alergen',    '⚠️ Pengecekan Alergen',
   'Apakah sajian hari ini mengandung bahan alergen seperti kacang, telur, atau makanan laut?',
   'Seluruh dapur SPPG menerapkan pemisahan kontaminasi silang. Bila anak Anda punya kondisi khusus, infokan nama siswa dan sekolah ke tim verifikator kami.', 2),
  ('sppg',  'distribusi', '⏱️ Jadwal Tiba Makanan',
   'Kira-kira jam berapa distribusi makanan sampai di sekolah?',
   'Berdasarkan standar BGN, armada hot chain berangkat 09.30 WIB dan tiba paling lambat 11.15 WIB. Suhu sajian dijaga di atas 60°C.', 3),
  ('admin', 'aduan',      '📝 Cara Melaporkan Masalah',
   'Bagaimana prosedur jika porsi makanan kurang, dingin, atau basi?',
   'Isi formulir di menu "Laporan & Aduan Publik" atau kirim foto kondisinya ke chat ini. Tim Satgas BGN Pusat merespons dalam waktu kurang dari 120 menit.', 4),
  ('admin', 'standar',    '🌡️ Standar Higienitas & AKG',
   'Bagaimana standar mutu dan higienitas dapur SPPG yang terakreditasi?',
   'Setiap dapur SPPG wajib punya Sertifikat Laik Higiene Sanitasi (SLHS), uji lab mikroba berkala, dan diawasi Tenaga Gizi Terdaftar bersertifikasi Satgas BGN.', 5)
ON CONFLICT (target_role, label) DO NOTHING;

-- 3. (Opsional) bersihin chat lama > 90 hari — jalankan manual / cron
-- DELETE FROM live_chat_messages WHERE created_at < NOW() - INTERVAL '90 days';