# Database Migrations — MBG-MONITORING

## Cara Menjalankan

### Jalankan semua secara berurutan:
```bash
for f in database/migrations/*.sql; do psql $DATABASE_URL -f "$f"; done
```

### Jalankan satu file:
```bash
psql $DATABASE_URL -f database/migrations/001_schema_users.sql
```

## Daftar Migration

| File | Isi |
|------|-----|
| 001_schema_users.sql | Tabel users (termasuk kolom salt, active dari setup_users.sql) |
| 002_schema_sppg.sql | Tabel SPPG versi peta 30K (source_key UNIQUE, latitude/longitude) |
| 003_schema_telemetri.sql | Tabel telemetri nasional, distribusi provinsi, data_penerima_mbg |
| 004_schema_menu.sql | Tabel menu_sppg, menu_harian, menu_backup, views & fungsi cron |
| 005_schema_laporan.sql | Tabel laporan_aduan, aduan_log |
| 006_schema_live_chat.sql | Tabel live_chat_messages (+ index poll & unread), live_chat_templates |
| 007_schema_security.sql | Tabel exploit_logs |
| 008_seed_users.sql | Seed data users default + update salt/hash SHA-256 |
| 009_seed_telemetri.sql | Seed data telemetri & distribusi 34 provinsi Indonesia |

## Catatan

- Semua schema menggunakan `IF NOT EXISTS` (idempotent — aman dijalankan berulang)
- Semua seed menggunakan `ON CONFLICT DO NOTHING` atau `ON CONFLICT DO UPDATE` (idempotent)
- Lihat `database/schema_all.sql` untuk skema lengkap dalam satu file

### Konflik Nama Tabel (Hutang Teknis)

Ada dua tabel dengan nama yang sama karena sejarah import:

| Tabel | Versi | File Migration | Dipakai oleh |
|-------|-------|---------------|--------------|
| `sppg` | Peta 30K (PK: `id BIGSERIAL`, `source_key UNIQUE`) | 002 | `api/sppg_map.php`, `api/sppg_provinsi.php` |
| `sppg` | Hierarki instansi (PK: `id_sppg VARCHAR`) | 008 (belum ada) | `api/menu.php` |
| `menu_harian` | Backup/cron (kolom: `kalori_kkal`) | 004 | Cron Cloudflare Worker |
| `menu_harian` | Instansi (FK: `id_instansi`, kolom: `porsi`) | 008 (belum ada) | `api/menu.php` |

**Jangan menggabungkan kedua versi tanpa koordinasi** — perubahan schema berdampak ke semua API.

### File yang Masih Perlu Dimigrasikan (TODO)

- `008_schema_menu_instansi.sql` — hierarki provinsi/kabupaten/kecamatan/sppg/instansi (dari `migrate_sppg_bali.php`)
- `009_schema_juknis.sql` — tabel `dokumen_juknis`
- `010_seed_menu.sql` — seed data menu_sppg awal
- `011_seed_laporan.sql` — seed data laporan contoh
- `012_seed_live_chat.sql` — seed data live_chat_templates
