# SPPG MBG Dataset Kit

Toolkit untuk mengambil daftar SPPG operasional dari portal publik resmi BGN, memvalidasi data, mengekspor JSON, mengimpor ke PostgreSQL/Neon, dan menyajikan API sederhana untuk frontend/peta/Android.

## Sumber dan batasan

- Sumber utama: https://www.bgn.go.id/operasional-sppg/
- Data yang diambil adalah daftar SPPG operasional yang tampil publik di portal saat scraper dijalankan.
- Portal bisa berubah struktur, membatasi akses, atau memperbarui jumlah data. Periksa `metadata.json`, log, dan jumlah baris setelah setiap pengambilan.
- Script **tidak membuat koordinat**. `latitude` dan `longitude` akan `null` kecuali memang tersedia sebagai kolom pada sumber.
- Jangan menganggap dataset selesai/komplet jika script berhenti karena CAPTCHA, HTTP error, halaman kosong tak terduga, atau jumlah baris jauh di bawah perkiraan. Simpan bukti waktu pengambilan dan cocokkan jumlah dengan portal.

## 1. Siapkan Python (Windows/Laragon)

Di PowerShell:

```powershell
cd C:\laragon\www\MBG-MONITORING
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install requests beautifulsoup4
```

## 2. Ambil data resmi dan ekspor JSON

Salin `scripts/fetch_sppg.py` ke project atau jalankan dari folder kit:

```powershell
py .\scripts\fetch_sppg.py --out .\data\sppg.json --max-pages 10000
```

Script mengunjungi halaman paginasi secara berurutan, menghormati jeda antar-request, deduplikasi, lalu menghasilkan:
- `data/sppg.json` — array objek SPPG
- `data/sppg.metadata.json` — URL sumber, waktu pengambilan, jumlah halaman, jumlah baris, dan catatan validasi

Kalau portal mengubah struktur HTML, script sengaja berhenti dengan error alih-alih membuat data palsu. Periksa HTML portal dan sesuaikan parser.

## 3. Format JSON

```json
{
  "source": "BGN",
  "source_url": "https://www.bgn.go.id/operasional-sppg/",
  "retrieved_at": "2026-10-16T00:00:00+00:00",
  "record_count": 1,
  "records": [
    {
      "source_row_number": 1,
      "nama": "Nama sesuai sumber",
      "provinsi": "PROVINSI SESUAI SUMBER",
      "kabupaten_kota": "KAB/KOTA SESUAI SUMBER",
      "kecamatan": "KECAMATAN SESUAI SUMBER",
      "kelurahan_desa": "DESA/KELURAHAN SESUAI SUMBER",
      "alamat": "Alamat sesuai sumber",
      "latitude": null,
      "longitude": null,
      "status": "operasional"
    }
  ]
}
```

Nama dan alamat di atas hanya contoh bentuk, bukan satu rekaman yang diklaim nyata. File hasil scraper menggunakan nilai dari portal.

## 4. Validasi JSON

```powershell
py .\scripts\validate_sppg.py .\data\sppg.json
```

Validasi memeriksa struktur, field wajib, koordinat yang tidak masuk akal, dan duplikat berdasarkan nama/alamat/wilayah. Duplikat dilaporkan, tidak otomatis menghapus data hasil sumber.

## 5. Neon PostgreSQL

1. Buat tabel dengan `sql/schema.sql` di Neon SQL Editor.
2. Jangan commit connection string ke Git.
3. Set environment variable `DATABASE_URL` pada PowerShell:

```powershell
$env:DATABASE_URL = "postgresql://USER:PASSWORD@HOST/DB?sslmode=require"
py -m pip install "psycopg[binary]"
py .\scripts\import_to_neon.py .\data\sppg.json
```

Script melakukan upsert berdasarkan `source_key`. Koordinat tetap NULL jika tidak ada dari sumber.

## 6. Cloudflare Workers

Contoh API tersedia di `workers/`. Contoh memakai binding Hyperdrive `DB` dan package `pg`. Konfigurasikan Hyperdrive ke Neon, lalu deploy dari folder `workers`:

```powershell
npm install
npx wrangler hyperdrive create sppg-neon --connection-string="$env:DATABASE_URL"
```

Salin ID Hyperdrive yang dihasilkan ke `wrangler.toml`. Pastikan versi package/runtime Cloudflare yang dipakai mendukung konfigurasi `pg` pada Workers. Uji endpoint `/api/sppg?limit=50&offset=0` sebelum menghubungkan aplikasi.

Endpoint yang disediakan:
- `GET /api/health`
- `GET /api/sppg?limit=50&offset=0`
- `GET /api/sppg?provinsi=JAWA%20BARAT&limit=50&offset=0`
- `GET /api/sppg/:id`

Jangan membuka kredensial database ke frontend atau Android. Keduanya mengakses API Worker.

## 7. Frontend/peta dan Android

`frontend/fetch-sppg.js` menunjukkan fetch paginasi dari API. Untuk peta, tampilkan marker hanya jika `latitude` dan `longitude` bukan null dan berada pada rentang valid. Jangan geocode alamat secara otomatis tanpa mencatat sumber/akurasi dan mematuhi ketentuan provider geocoding.

## Checklist sebelum produksi

- [ ] Jalankan scraper dan periksa `sppg.metadata.json`.
- [ ] Cocokkan jumlah data dengan portal BGN pada waktu yang sama.
- [ ] Periksa baris pertama/terakhir dan beberapa halaman acak.
- [ ] Jalankan validator dan tinjau laporan duplikat.
- [ ] Simpan waktu pengambilan dan sumber pada database.
- [ ] Atur rate limit, cache, pagination, dan log pada API.
- [ ] Koordinat null tidak ditampilkan sebagai marker.
