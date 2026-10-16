# Database Scripts

## geocode_sppg.py
Geocode SPPG alamat via Nominatim (OpenStreetMap, free).

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
Progress disimpan ke geocoding_progress.json. Aman dijalankan ulang.
