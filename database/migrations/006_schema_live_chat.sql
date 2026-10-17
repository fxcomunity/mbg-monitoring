-- MBG-MONITORING: Live Chat Schema
-- Jalankan: psql $DATABASE_URL -f database/migrations/006_schema_live_chat.sql
-- Sumber: gabungan database/schema_all.sql (section 9–10) + database/live_chat.sql
-- Dependensi: 001_schema_users.sql (FK ke users)
--
-- Versi ini menggunakan definisi dari live_chat.sql karena memiliki:
--   - idx_chat_poll  : index (session_id, id) untuk polling "id > ?"
--   - idx_chat_unread: partial index WHERE is_read = FALSE
--   - uq_chat_template_label: UNIQUE (target_role, label) pada live_chat_templates
-- Ketiga hal di atas tidak ada di schema_all.sql.

-- Backward compat: rename tabel lama jika ada kolom yang tidak sesuai
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

-- ------------------------------------------------------------------------------
-- TABEL: live_chat_messages (Sistem Pesan Interaktif User <-> Admin & SPPG)
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
CREATE INDEX IF NOT EXISTS idx_chat_poll    ON live_chat_messages(session_id, id);
CREATE INDEX IF NOT EXISTS idx_chat_target  ON live_chat_messages(target_type, target_sppg_name);
CREATE INDEX IF NOT EXISTS idx_chat_created ON live_chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_unread  ON live_chat_messages(target_type) WHERE is_read = FALSE;

-- ------------------------------------------------------------------------------
-- TABEL: live_chat_templates (Template Pertanyaan Cepat MBG)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS live_chat_templates (
  id          SERIAL PRIMARY KEY,
  target_role VARCHAR(20)  NOT NULL DEFAULT 'all'
                CHECK (target_role IN ('all', 'admin', 'sppg')),
  category    VARCHAR(50)  NOT NULL DEFAULT 'umum',
  label       VARCHAR(150) NOT NULL,
  question    TEXT         NOT NULL,
  auto_answer TEXT         NOT NULL,
  sort_order  INT          NOT NULL DEFAULT 10
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_template_label ON live_chat_templates(target_role, label);
