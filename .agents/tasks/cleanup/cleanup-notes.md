# Cleanup Notes — Bagian 1 Selesai

Tanggal eksekusi: 2025  
Agent: cleanup step 1  

---

## File / Folder yang Dihapus

| File / Folder | Alasan |
|---|---|
| `database/schema_all_clean.sql` | Duplikat byte-per-byte dari `schema_all.sql`, tidak ada referensi di codebase |
| `database/import_sppg.sql` | 315 baris data dummy BGN-Maret 2025 (`source='BGN-Maret'`), bukan schema aktif |
| `database/sppg_chunks/import_sppg_part1-6.sql` | Output generated dari `split_import.js`, sudah di-import ke Neon (~6.5 MB total) |
| `database/scripts/generate_import.js` | One-shot tool, output sudah di-import ke Neon |
| `database/scripts/split_import.js` | One-shot tool, output (sppg_chunks) sudah di-import ke Neon |
| `database/scripts/neon_sppg_log.txt` | Log import, bukan kode |
| `database/scripts/neon_import_log.txt` | Log import, bukan kode |
| `database/scripts/local_dump.sql` | Local dump, bukan source schema, tidak direferensikan |
| `database/scripts/local_dump_clean.sql` | Idem |
| `database/scripts/import_runner.php` | One-time script dengan kredensial hardcoded Neon (`npg_KeaS1c4jMAiY`) — **kredensial ini harus di-rotate di Neon dashboard** |
| `database/scripts/migrate_sppg_bali.php` | One-time migration script, hierarki sudah masuk DB |
| `dataset_sppg/` (seluruh folder) | Toolkit scraper mandiri (Python, Workers, SQL sendiri), tidak ada file di `api/`, `functions/`, `workers/`, `assets/js/` yang mengimport path ini |

---

## File yang TIDAK Dihapus — Alasan Konten Unik

### `database/schema.sql`
Berisi tabel yang **tidak ada** di `schema_all.sql`:
- `data_penerima_mbg` — tabel data penerima MBG 8 jenjang BGN Pusat
- `dokumen_juknis` — tabel petunjuk teknis resmi BGN RI

Konten ini harus dipindah ke `database/migrations/003_schema_telemetri.sql` dan `database/migrations/009_schema_juknis.sql` sebelum file ini bisa dihapus.

### `database/live_chat.sql`
Punya konten tambahan vs `schema_all.sql`:
- `idx_chat_poll` — index pada `(session_id, id)` untuk polling "id > ?"
- `idx_chat_unread` — partial index `WHERE is_read = FALSE`
- `uq_chat_template_label` — unique constraint pada `(target_role, label)`
- ON CONFLICT clause di INSERT seed data
- Blok `DO $$` untuk backward compat rename kolom lama

Konten ini harus dimerge ke `database/migrations/006_schema_live_chat.sql` sebelum file ini bisa dihapus.

---

## `data_sppg/` — DITUNDA

Folder `data_sppg/sppg_mbgwatch.json` (10.8 MB JSON, 30K SPPG) **belum dihapus** karena plan meminta konfirmasi `SELECT COUNT(*) FROM sppg WHERE source='MBGWatch' = 30231` di Neon sebelum hapus. Jalankan query berikut di Neon SQL Editor untuk konfirmasi:

```sql
SELECT COUNT(*) FROM sppg WHERE source = 'MBGWatch';
```

Jika hasilnya 30231, file `data_sppg/sppg_mbgwatch.json` aman dihapus.

---

## Aksi Lanjutan yang Diperlukan

1. **Rotate kredensial Neon** — password `npg_KeaS1c4jMAiY` yang ada di `import_runner.php` (sudah dihapus dari repo) harus di-reset di Neon dashboard.
2. **Konfirmasi `data_sppg/`** — lihat bagian di atas.
3. **Buat `database/migrations/`** — Bagian 2 & 3 dari plan.md (15 migration files).
4. **Hapus `database/schema.sql`** dan **`database/live_chat.sql`** setelah konten uniknya masuk ke migrations.
