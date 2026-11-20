# Cloudflare Workers — MBG Monitoring API

Menggantikan seluruh backend PHP yang tidak bisa dijalankan di Cloudflare Pages.

## File Workers

| File | Route | Fungsi |
|------|-------|--------|
| `auth.js` | `/api/auth` | Login, register, cek sesi |
| `data.js` | `/api/data` | Baca/tulis telemetri, distribusi, menu |
| `security.js` | `/api/security` | Worker alternatif untuk log ancaman dan pemeriksaan IP terblokir |
| `../functions/api/security/log.js` | `/api/security/log` | Mencatat ancaman dari halaman melalui Pages Function |
| `../functions/api/security_threats.js` | `/api/security_threats` | Membaca log Neon khusus admin |

## Cara Deploy

### 1. Install Wrangler
```bash
npm install -g wrangler
wrangler login
```

### 2. Buat KV Namespaces
```bash
wrangler kv:namespace create USERS
wrangler kv:namespace create SESSIONS
wrangler kv:namespace create DATA
wrangler kv:namespace create RATE
```
Salin setiap ID yang dihasilkan ke `wrangler.toml`.

### 3. Siapkan Neon dan deploy Worker
Jalankan `database/security_neon.sql` pada Neon SQL Editor untuk menyiapkan tabel log,
daftar IP yang diblokir, dan tabel penghitung legacy yang tidak lagi ditulis oleh
Worker keamanan. Tabel `exploit_logs` dipakai bersama oleh Worker dan dashboard admin.

```bash
# Deploy masing-masing worker
wrangler deploy auth.js --name mbg-auth
wrangler deploy data.js --name mbg-data
wrangler deploy security.js --name mbg-security

# Simpan connection string Neon sebagai secret pada Worker keamanan
wrangler secret put DATABASE_URL --name mbg-security
```

Pastikan Worker keamanan memakai binding KV `SESSIONS` yang sama dengan Worker auth.
Pages Functions pada project utama memakai tabel `auth_sessions` di Neon dan
tidak memerlukan binding KV `SESSIONS`. Jalankan `database/neon_auth_sessions.sql`
di Neon sebelum deploy. Binding KV `RATE` opsional digunakan untuk pembatasan
advisory laporan (20 laporan/menit/IP, best-effort karena KV tidak atomik).

### 4. Bind ke Cloudflare Pages
Di Dashboard Cloudflare → Pages → Project → Settings → Functions:
- Tambahkan KV namespace bindings sesuai `wrangler.toml`
- Tambahkan Custom Domain untuk Workers: `api.mbg.jack-ai.my.id`

### 5. Buat Admin Pertama (via Wrangler CLI)
```bash
# Hash password manual lalu simpan ke KV
wrangler kv:key put --namespace-id=<USERS_ID> "user:admin" \
  '{"full_name":"Admin BGN","email":"admin@bgn.go.id","username":"admin","role":"admin","salt":"randomsalt16chr","password_hash":"<sha256_hash>","created_at":0}'
```

## Catatan Keamanan
- Worker keamanan memakai inspeksi server dan header keamanan yang sama dengan Pages melalui `../functions/_middleware.js`; header `X-Requested-By` bukan bukti keamanan.
- Rate limiting login: 5 percobaan / 15 menit per IP
- Log keamanan dan daftar blokir disimpan di Neon
- `POST /api/security/log` memakai handler Pages: body dibatasi 16 KiB, laporan bersifat advisory, dan tidak menambah penghitung atau membuat blokir otomatis. Payload mentah, indikator, URL kiriman, user-agent, dan kredensial tidak disimpan.
- `GET /api/security/threats` memakai handler Pages: sesi admin wajib memiliki username dan akun tersebut harus masih aktif dengan role admin di database.
- `GET /api/security/check` tetap mengembalikan `{ blocked, ip }` melalui `isManuallyBlocked`, termasuk ketika IP diblokir. Route read-only ini tetap diinspeksi, tetapi dikecualikan dari penolakan blokir middleware agar status dapat dibaca.
- Blokir hanya dibaca dari `security_blocked_ips`; entri lama (termasuk auto-block legacy) tetap berlaku sampai kedaluwarsa atau dicabut manual. Worker ini tidak lagi menulis blokir.
- Enforcement Worker ini hanya mencakup route yang diarahkan kepadanya, bukan Worker lain atau seluruh situs.
- API keamanan ditujukan untuk same-origin dan tidak mengirim wildcard CORS. Akses browser lintas origin tidak didukung; request tulis dengan Origin/Sec-Fetch-Site lintas origin ditolak. Klien Android native tanpa header origin browser tetap didukung.
- Lokasi kota/region bersifat perkiraan dan hanya tersedia bila Cloudflare memberikan metadata tersebut
