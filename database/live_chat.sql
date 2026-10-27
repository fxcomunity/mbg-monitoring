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

-- 3. (Opsional) bersihin chat lama > 90 hari — jalankan manual / cron
-- DELETE FROM live_chat_messages WHERE created_at < NOW() - INTERVAL '90 days';