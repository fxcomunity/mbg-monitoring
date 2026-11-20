-- Internal admin/SPPG messaging. Run once after database/schema_all.sql.
-- Safe to apply repeatedly.

CREATE TABLE IF NOT EXISTS internal_chat_conversations (
  id         BIGSERIAL PRIMARY KEY,
  kind       VARCHAR(10) NOT NULL CHECK (kind IN ('direct', 'group')),
  name       VARCHAR(120),
  direct_key VARCHAR(64) UNIQUE,
  created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((kind = 'direct' AND direct_key IS NOT NULL AND name IS NULL)
      OR (kind = 'group' AND direct_key IS NULL AND name IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS internal_chat_members (
  conversation_id       BIGINT NOT NULL REFERENCES internal_chat_conversations(id) ON DELETE CASCADE,
  user_id               BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_read_message_id  BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS internal_chat_messages (
  id              BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES internal_chat_conversations(id) ON DELETE CASCADE,
  sender_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message         VARCHAR(2000) NOT NULL CHECK (length(trim(message)) > 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS internal_chat_presence (
  user_id      BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS internal_chat_calls (
  id              BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES internal_chat_conversations(id) ON DELETE CASCADE,
  caller_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  callee_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          VARCHAR(12) NOT NULL DEFAULT 'ringing'
                  CHECK (status IN ('ringing', 'active', 'declined', 'ended', 'missed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at     TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  CHECK (caller_id <> callee_id)
);

CREATE TABLE IF NOT EXISTS internal_chat_call_signals (
  id           BIGSERIAL PRIMARY KEY,
  call_id      BIGINT NOT NULL REFERENCES internal_chat_calls(id) ON DELETE CASCADE,
  sender_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signal_type  VARCHAR(12) NOT NULL CHECK (signal_type IN ('offer', 'answer', 'candidate')),
  payload      JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_chat_members_user
  ON internal_chat_members (user_id, conversation_id);
CREATE INDEX IF NOT EXISTS idx_internal_chat_messages_conversation
  ON internal_chat_messages (conversation_id, id);
CREATE INDEX IF NOT EXISTS idx_internal_chat_presence_last_seen
  ON internal_chat_presence (last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_internal_chat_calls_participants
  ON internal_chat_calls (callee_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_internal_chat_call_signals_poll
  ON internal_chat_call_signals (call_id, recipient_id, id);
