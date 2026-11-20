-- Jalankan satu kali pada database Neon yang sudah memiliki tabel laporan_aduan.
ALTER TABLE laporan_aduan ADD COLUMN IF NOT EXISTS photo_data BYTEA;
