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
penghitung ancaman, dan daftar IP yang diblokir. Tabel `exploit_logs` dipakai bersama
oleh Worker dan dashboard admin.

```bash
# Deploy masing-masing worker
wrangler deploy auth.js --name mbg-auth
wrangler deploy data.js --name mbg-data
wrangler deploy security.js --name mbg-security

# Simpan connection string Neon sebagai secret pada Worker keamanan
wrangler secret put DATABASE_URL --name mbg-security
```

Pastikan Worker keamanan memakai binding KV `SESSIONS` yang sama dengan Worker auth.
Pages Functions keamanan juga memerlukan secret `DATABASE_URL` dan binding KV
`SESSIONS` pada project Pages, sama seperti endpoint autentikasi.

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
- Semua endpoint POST wajib kirim header `X-Requested-By: mbg-radar`
- Rate limiting login: 5 percobaan / 15 menit per IP
- Log keamanan dan daftar blokir disimpan di Neon
- Auto-block IP: 3+ ancaman dalam 1 jam → IP disimpan di Neon selama 24 jam dan endpoint keamanan menolak laporan berikutnya dari IP tersebut
- Pemblokiran endpoint ini belum otomatis menolak request ke semua halaman/API; enforcement global perlu dipasang di jalur request utama Cloudflare
- Lokasi kota/region bersifat perkiraan dan hanya tersedia bila Cloudflare memberikan metadata tersebut
