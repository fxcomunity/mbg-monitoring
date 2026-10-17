# Implementation Plan — Cleanup, Migration Split & Maintenance Panel

Dibuat oleh: planning agent  
Tanggal audit: berdasarkan state repo aktual  
Workspace: `c:\laragon\www\MBG-MONITORING`

---

## Temuan Audit

### Dua Skema `sppg` yang Berbeda (Penting!)

Ada **dua definisi tabel `sppg`** yang hidup berdampingan di repo dan di database:

| Sumber | Primary Key | Kolom khas | Dipakai oleh |
|---|---|---|---|
| `database/schema_sppg.sql` | `id BIGSERIAL` + `source_key UNIQUE` | `source`, `data_bulan`, `latitude`, `longitude` | `api/sppg_map.php`, `api/sppg_status.php`, `api/sppg_provinsi.php` |
| `database/scripts/migrate_sppg_bali.php` | `id_sppg VARCHAR(30)` | `kode_sppg`, `nama_sppg` | `api/menu.php` (JOIN `instansi`), `api/live_chat.php` |

Ini adalah skema yang berbeda dengan kolom berbeda. Kedua-duanya aktif dipakai. Migration split harus menjaga keduanya.

### Dua Skema `menu_harian` yang Berbeda

| Sumber | Kolom khas | Dipakai oleh |
|---|---|---|
| `database/schema_menu.sql` | `sppg_id VARCHAR`, `school_target`, `kalori_kkal` | Backup/archive cron |
| `database/scripts/migrate_sppg_bali.php` | `id_menu VARCHAR(100)`, `id_instansi FK`, `porsi` | `api/menu.php` JOIN hierarki instansi |

---

## Bagian 1 — File yang Aman Dihapus

File-file berikut **tidak direferensikan sama sekali** oleh kode PHP/JS aktif (`api/`, `functions/`, `workers/`, `assets/js/`). Semua adalah artefak build/import yang sudah selesai dipakai.

| File / Direktori | Alasan aman dihapus |
|---|---|
| `database/schema_all_clean.sql` | Isi **identik byte-per-byte** dengan `database/schema_all.sql`. Tidak ada referensi ke file ini di seluruh codebase. Duplikat murni. |
| `database/import_sppg.sql` | 315 baris data `BGN-Maret` (2025). Cleanup script (`database/scripts/cleanup.php`) sudah dirancang untuk menghapus baris ini dari DB. Tidak ada API yang membaca file ini. |
| `database/import_sppg_mbgwatch.sql` | File generated (output dari `generate_import.js`), bukan source of truth. Dapat di-regenerate dari `data_sppg/sppg_mbgwatch.json`. Ukuran 6.4 MB, sudah di-import ke Neon. |
| `database/sppg_chunks/import_sppg_part1.sql` s/d `part6.sql` | Output generated dari `split_import.js`. ~6.5 MB total. Sudah dipakai untuk import ke Neon. Dapat di-regenerate. |
| `database/scripts/generate_import.js` | One-shot tool. Output-nya (`import_sppg_mbgwatch.sql`) sudah di-import. Referensi ke `data_sppg/sppg_mbgwatch.json` hanya di file ini dan `split_import.js`. |
| `database/scripts/split_import.js` | One-shot tool. Output-nya (`sppg_chunks/`) sudah di-import ke Neon. |
| `database/scripts/neon_sppg_log.txt` | Log import, bukan kode. |
| `database/scripts/neon_import_log.txt` (jika ada) | Log import, bukan kode. |
| `database/scripts/local_dump.sql` | Local dump bukan source skema. Tidak direferensikan. |
| `database/scripts/local_dump_clean.sql` (jika ada) | Idem. |
| `dataset_sppg/` (seluruh folder) | Toolkit scraper terpisah (README, Python scripts, workers, SQL schema sendiri). Tidak ada satu file pun di `api/`, `functions/`, `assets/js/` yang mengimport, fetch, atau require path `dataset_sppg/`. Folder ini adalah project mandiri yang sudah selesai tugasnya (data sudah masuk ke `data_sppg/sppg_mbgwatch.json` lalu ke Neon). |

---

## Bagian 2 — File yang Perlu Dicek Ulang Sebelum Dihapus

File-file ini **tidak direferensikan secara langsung** di kode aktif, tapi punya potensi dependensi tidak langsung atau nilai dokumentasi yang perlu dikonfirmasi sebelum dihapus.

| File | Status | Apa yang harus dicek |
|---|---|---|
| `database/schema.sql` | ⚠️ Subset dari `schema_all.sql` | Berisi tabel `laporan_aduan`, `aduan_log`, `data_penerima_mbg`, `dokumen_juknis`. Tabel `data_penerima_mbg` ada di `schema.sql` tapi tidak ada di `schema_all.sql` / `schema_all_clean.sql`. Harus dipindah ke migration `003` sebelum file ini dihapus. |
| `database/setup_users.sql` | ⚠️ Direferensikan secara tak langsung | `workers/auth.js` dan `functions/api/auth_user.js` menampilkan error "Jalankan setup_users.sql" jika kolom `salt` null. Ini adalah migration password dari bcrypt ke SHA-256+salt. Harus dikonversi menjadi `migrations/010_migrate_password.sql` sebelum dihapus. |
| `database/schema_menu.sql` | ⚠️ Aktif tapi berbeda dari Bali schema | Mendefinisikan `menu_harian` + `menu_backup` + view + function `archive_yesterday_menu()`. Dipakai cron backup. Harus masuk migration `004` dengan catatan perbedaan dengan `migrate_sppg_bali.php`. |
| `database/schema_sppg.sql` | ⚠️ Aktif — dasar tabel sppg (30K rows) | Dipakai `api/sppg_map.php`, `api/sppg_status.php`, `api/sppg_provinsi.php`. Harus masuk migration `002`. |
| `database/live_chat.sql` | ⚠️ Overlap dengan `schema_all.sql` | `schema_all.sql` sudah punya `live_chat_messages` dan `live_chat_templates`, tapi versi di `live_chat.sql` memiliki **2 index tambahan** (`idx_chat_poll` dan `idx_chat_unread`) dan unique constraint `uq_chat_template_label` yang tidak ada di `schema_all.sql`. Harus merge ke migration `006` sebelum dihapus. |
| `database/scripts/migrate_sppg_bali.php` | ⚠️ Aktif — mendefinisikan hierarki Bali | Mendefinisikan tabel `provinsi`, `kabupaten_kota`, `kecamatan`, `sppg` (versi kedua), `instansi`, `menu_harian` (versi kedua), `gizi_menu`, `gambar_menu`. Aktif dipakai `api/menu.php`. Harus dikonversi ke migration SQL sebelum dihapus. |
| `database/scripts/import_runner.php` | ⚠️ Mengandung kredensial hardcoded | File ini menyimpan password Neon plaintext (`npg_KeaS1c4jMAiY`). Segera hapus/rotate setelah yakin tidak dipakai lagi. |
| `database/scripts/cleanup.php` | ⚠️ Masih berguna | Script cleanup aktif (bisa dijalankan via HTTP). Tetap simpan atau pindah ke tool admin. |
| `data_sppg/sppg_mbgwatch.json` | ⚠️ Source data 30K SPPG | JSON 10.3 MB ini adalah source untuk `generate_import.js` dan `split_import.js`. Setelah import ke Neon sudah dikonfirmasi selesai dan `COUNT(*) = 30231` di DB, file ini boleh dihapus. Konfirmasi ke Neon dulu. |

---

## Bagian 3 — Mapping Tabel ke File Migration

Direktori target: `database/migrations/`

### Skema Master (`schema_all.sql` sebagai basis)

```
migrations/
├── 001_schema_users.sql           # users, trigger, index
├── 002_schema_sppg.sql            # sppg (versi map/30K: source_key, source, latitude, longitude)
├── 003_schema_telemetri.sql       # telemetri_nasional, distribusi_provinsi, data_penerima_mbg
├── 004_schema_menu.sql            # menu_sppg (dari schema_all), menu_harian + menu_backup + views (schema_menu.sql)
├── 005_schema_laporan.sql         # laporan_aduan, aduan_log, trigger
├── 006_schema_live_chat.sql       # live_chat_messages (versi gabungan: pakai kolom + index dari live_chat.sql), live_chat_templates
├── 007_schema_security.sql        # exploit_logs
├── 008_schema_menu_instansi.sql   # provinsi, kabupaten_kota, kecamatan, sppg (versi instansi: id_sppg VARCHAR), instansi, menu_harian (versi instansi), gizi_menu, gambar_menu
├── 009_schema_juknis.sql          # dokumen_juknis (dari schema.sql yang tidak ada di schema_all)
├── 010_seed_users.sql             # INSERT users (dari schema_all.sql seed section)
├── 011_seed_telemetri.sql         # INSERT telemetri_nasional, distribusi_provinsi (dari schema_all.sql)
├── 012_seed_menu.sql              # INSERT menu_sppg sample data (dari schema_all.sql)
├── 013_seed_laporan.sql           # INSERT laporan_aduan contoh (dari schema_all.sql)
├── 014_seed_live_chat.sql         # INSERT live_chat_templates (dari live_chat.sql: versi dengan ON CONFLICT (target_role, label))
└── 015_migrate_password.sql       # ALTER TABLE + UPDATE salt/password_hash (dari setup_users.sql)
```

### Detail setiap migration

#### `001_schema_users.sql`
Sumber: `schema_all.sql` section 2  
Tabel: `users`  
Catatan: ekstensi `uuid-ossp`, `pgcrypto`, dan fungsi `set_updated_at()` harus ada di awal file atau di file `000_extensions.sql` terpisah.

#### `002_schema_sppg.sql`
Sumber: `database/schema_sppg.sql`  
Tabel: `sppg` (kolom: `source_key`, `source`, `data_bulan`, `latitude`, `longitude`, `nama_yayasan`)  
Catatan: ini adalah tabel peta 30K baris, bukan tabel hierarki menu.

#### `003_schema_telemetri.sql`
Sumber: `schema_all.sql` section 3–4 + `schema.sql` tabel `data_penerima_mbg`  
Tabel: `telemetri_nasional`, `distribusi_provinsi`, `data_penerima_mbg`

#### `004_schema_menu.sql`
Sumber: `schema_all.sql` section 5 + `database/schema_menu.sql`  
Tabel: `menu_sppg` (dari schema_all), `menu_harian` (versi backup/cron dari schema_menu), `menu_backup`, view `menu_hari_ini`, view `menu_backup_summary`, function `archive_yesterday_menu()`

#### `005_schema_laporan.sql`
Sumber: `schema_all.sql` section 6–7  
Tabel: `laporan_aduan`, `aduan_log`

#### `006_schema_live_chat.sql`
Sumber: gabungan `schema_all.sql` section 9–10 + `database/live_chat.sql`  
Tabel: `live_chat_messages`, `live_chat_templates`  
Catatan: pakai versi `live_chat.sql` karena punya index tambahan `idx_chat_poll`, `idx_chat_unread`, dan unique constraint `uq_chat_template_label` yang tidak ada di `schema_all.sql`.

#### `007_schema_security.sql`
Sumber: `schema_all.sql` section 8  
Tabel: `exploit_logs`

#### `008_schema_menu_instansi.sql`
Sumber: `database/scripts/migrate_sppg_bali.php` (dikonversi ke SQL murni)  
Tabel: `provinsi`, `kabupaten_kota`, `kecamatan`, `sppg` (versi instansi dengan `id_sppg` PK), `instansi`, `menu_harian` (versi instansi: kolom `porsi`, `id_instansi FK`), `gizi_menu`, `gambar_menu`  
⚠️ Konflik nama: `sppg` dan `menu_harian` sudah ada di migration 002 dan 004. File ini harus pakai `CREATE TABLE IF NOT EXISTS` dan mendokumentasikan bahwa ini adalah **tabel berbeda** dengan nama sama yang ada di database karena sejarah import.

#### `009_schema_juknis.sql`
Sumber: `database/schema.sql` (hanya bagian `dokumen_juknis`)  
Tabel: `dokumen_juknis`

#### `010_seed_users.sql` s/d `014_seed_live_chat.sql`
Sumber: section SEED DATA di `schema_all.sql` dan `live_chat.sql`  
Catatan: seed pakai `ON CONFLICT DO NOTHING` — aman dijalankan ulang.

#### `015_migrate_password.sql`
Sumber: `database/setup_users.sql`  
Catatan: ALTER TABLE + UPDATE hash. Jalankan setelah seed users.

---

## Bagian 4 — Pola HTML/CSS Panel Admin untuk Maintenance Section

Berdasarkan pembacaan `dashboard/admin/panel.html`, ini adalah pola yang **harus diikuti** saat menambahkan section Maintenance website baru:

### Struktur Section

```html
<!-- Setiap section = card rounded-3xl dengan border + shadow -->
<div id="[id-anchor]" class="bg-surface-card rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-8">

  <!-- Header section: warna tinted per fitur -->
  <!-- Warna header yang sudah dipakai:
       - Manajemen Akun  → bg-purple-50/60, border-purple-100
       - Status SPPG     → bg-blue-50/60, border-blue-100
       - Approval Foto   → bg-emerald-50/60, border-emerald-100
       - Maintenance     → bg-amber-50/60, border-amber-100  ← PAKAI INI
       - Log Keamanan    → bg-red-50/60, border-red-100
       - Konfigurasi     → bg-slate-50, border-slate-200 -->

  <div class="p-6 bg-amber-50/60 border-b border-amber-100 flex items-center gap-3">
    <!-- Icon 40×40 rounded-xl dengan warna matching -->
    <div class="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
      <span class="material-symbols-outlined text-2xl">build</span>
    </div>
    <div>
      <h2 class="text-base font-bold text-primary">Judul Section</h2>
      <p class="text-xs text-slate-500">Deskripsi singkat.</p>
    </div>
    <!-- Opsional: tombol aksi di kanan (flex justify-between pada header) -->
  </div>

  <!-- Body section -->
  <div class="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

    <!-- Card aksi: pola health card -->
    <div class="p-4 rounded-2xl border border-slate-200 bg-slate-50">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-bold text-slate-700 uppercase">Nama Kartu</span>
        <!-- Badge status dinamis -->
        <span id="badgeId" class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">Aktif</span>
      </div>
      <p class="text-[11px] text-slate-500 mb-3">Deskripsi singkat.</p>
      <!-- Tombol aksi: w-full, rounded-xl, text-[11px], font-semibold -->
      <button onclick="handlerFn()" class="w-full py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold text-[11px] transition-all">
        Aksi
      </button>
    </div>

    <!-- Toggle switch (dipakai untuk Mode Maintenance) -->
    <div class="p-4 rounded-2xl border border-slate-200 bg-slate-50">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-bold text-slate-700 uppercase">Mode X</span>
        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" id="toggleId" class="sr-only peer" onchange="toggleFn(this.checked)"/>
          <div class="w-9 h-5 bg-slate-300 rounded-full peer peer-checked:bg-amber-500 transition-all"></div>
          <div class="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all peer-checked:translate-x-4"></div>
        </label>
      </div>
      <p class="text-[11px] text-slate-500">Deskripsi efek toggle.</p>
    </div>

  </div>
</div>
```

### Font & Warna Sistem

```
Font:         Plus Jakarta Sans (Google Fonts)
Primary:      #001026 (bg header, text utama)
Container:    #0b2545
Secondary:    #395f95
Tertiary:     #6ffbbe (aksen hijau)
Surface:      #f8f9ff (bg halaman)
Surface card: #ffffff (bg card)
```

### Quick Nav Pill (harus ditambahkan ke sticky nav jika tambah section baru)

```html
<a href="#[id-anchor]" class="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-amber-50 hover:text-amber-700 text-xs font-bold text-slate-700 transition-all flex items-center gap-1.5">
  <span class="material-symbols-outlined text-[15px] text-amber-600">build</span> Label
</a>
```

### Tipografi dalam section

| Elemen | Kelas Tailwind |
|---|---|
| Judul section | `text-base font-bold text-primary` |
| Label kartu | `text-xs font-bold text-slate-700 uppercase` |
| Deskripsi | `text-[11px] text-slate-500` |
| Badge status | `text-[10px] font-bold` + warna bg/text matching |
| Tombol aksi | `text-[11px] font-semibold` atau `font-bold` untuk CTA utama |
| Tombol primary panel | `bg-purple-600 hover:bg-purple-700 text-white` |

### Icons

Semua icon: **Material Symbols Outlined** (Google).  
Ukuran dalam header section: `text-2xl`  
Ukuran dalam nav pills: `text-[15px]`  
Ukuran dalam tombol: `text-sm`

---

## Bagian 5 — Rencana Eksekusi (Ordered by Dependency)

- [ ] 1. **Buat folder `database/migrations/`** dan tulis 15 file migration berdasarkan mapping di Bagian 3.  
      Files: `database/migrations/001_schema_users.sql` s/d `database/migrations/015_migrate_password.sql`  
      Verify: jalankan semua file secara berurutan di Neon SQL Editor — tidak ada error.

- [ ] 2. **Tambahkan `000_extensions.sql`** berisi `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"/"pgcrypto"` + fungsi `set_updated_at()`.  
      Files: `database/migrations/000_extensions.sql`  
      Verify: migration 001-015 tidak error karena fungsi belum ada.

- [ ] 3. **Hapus file yang aman** (lihat Bagian 1): `schema_all_clean.sql`, `import_sppg.sql`, `import_sppg_mbgwatch.sql`, folder `sppg_chunks/`, `generate_import.js`, `split_import.js`, `neon_sppg_log.txt`, folder `dataset_sppg/`.  
      Files: di atas  
      Verify: `git status` tidak menampilkan file aktif yang dihapus; `grep -r "dataset_sppg\|sppg_chunks\|generate_import\|split_import" api/ functions/ workers/` kosong.

- [ ] 4. **Hapus/rotate kredensial di `import_runner.php`** lalu pindah ke `database/scripts/` archive atau hapus.  
      Files: `database/scripts/import_runner.php`  
      Verify: credential tidak muncul di `git diff`.

- [ ] 5. **Tambahkan section Maintenance Website ke `dashboard/admin/panel.html`** mengikuti pola di Bagian 4. Section ini mencakup: Mode Maintenance toggle, Database Health check, Cache Clear, Backup Menu, Vacuum DB.  
      Files: `dashboard/admin/panel.html`  
      Verify: buka panel di browser, section tampil di antara Approval dan Log Keamanan, sticky nav pill bekerja.

- [ ] 6. **Tambahkan API endpoint `api/maintenance.php`** untuk mendukung toggle mode maintenance, vacuum, dan backup trigger dari panel admin.  
      Files: `api/maintenance.php`  
      Verify: `GET /api/maintenance.php?action=status` mengembalikan JSON; hanya role `admin` yang bisa akses.

- [ ] 7. **Update `README.md`** di folder `database/` untuk mendokumentasikan struktur migrations baru dan urutan eksekusi.  
      Files: `database/README.md` (buat baru jika belum ada)  
      Verify: file ada dan berisi urutan migration 000-015.

---

## Catatan Penting untuk Implementer

1. **Jangan hapus `data_sppg/sppg_mbgwatch.json`** sampai dikonfirmasi `SELECT COUNT(*) FROM sppg WHERE source='MBGWatch'` mengembalikan 30231 di Neon.

2. **Konflik nama tabel**: ada dua tabel bernama `sppg` (map vs instansi) dan dua `menu_harian` (backup vs instansi) yang keduanya aktif dipakai. Ini adalah hutang teknis yang harus didokumentasikan dalam migration tapi **jangan digabung tanpa koordinasi** — perubahan schema berdampak ke semua API.

3. **`database/scripts/cleanup.php`** dapat diakses via HTTP (`http://localhost/MBG-MONITORING/database/scripts/cleanup.php`). Perlu dilindungi dengan auth guard sebelum produksi.

4. **`database/import_sppg.sql`** berisi 315 baris data Maret 2025 (`source = 'BGN-Maret'`). Data ini sudah ditandai untuk dihapus dari DB oleh `cleanup.php`. Konfirmasi penghapusan di DB sebelum menghapus file SQL-nya.
