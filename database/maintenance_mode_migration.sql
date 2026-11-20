-- Jalankan satu kali pada database Neon yang sudah memiliki tabel users.
CREATE TABLE IF NOT EXISTS system_maintenance (
  id          BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE),
  active      BOOLEAN NOT NULL DEFAULT FALSE,
  message     VARCHAR(1000) NOT NULL DEFAULT 'Sedang dalam pemeliharaan sistem.',
  eta         TIMESTAMPTZ,
  updated_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO system_maintenance (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;
