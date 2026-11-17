# Database Scripts

## geocode_sppg.py
Geocode alamat SPPG via Nominatim. Hanya gunakan untuk pengujian kecil dan sesuai
kebijakan layanan; server publik Nominatim bukan layanan untuk geocoding massal
30.000 alamat. Untuk seluruh dataset, gunakan koordinat resmi atau penyedia yang
secara eksplisit mengizinkan pemrosesan massal.

### Setup
```
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install "psycopg[binary]"
```

### Jalankan
```
$env:DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require"
py database/scripts/geocode_sppg.py
```
Progress disimpan ke geocoding_progress.json. Alamat yang tidak mendapat hasil
ditandai sebagai tidak ditemukan; error HTTP/koneksi akan menghentikan proses agar
tidak salah dianggap sebagai alamat yang tidak valid.
