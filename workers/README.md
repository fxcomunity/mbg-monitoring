# Cloudflare Workers — MBG Monitoring API

Menggantikan seluruh backend PHP yang tidak bisa dijalankan di Cloudflare Pages.

## File Workers

| File | Route | Fungsi |
|------|-------|--------|
| `auth.js` | `/api/auth` | Login, register, cek sesi |
| `data.js` | `/api/data` | Baca/tulis telemetri, distribusi, menu |
| `security.js` | `/api/security` | Log ancaman XSS/scraping, auto-block IP |

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
wrangler kv:namespace create THREATS
wrangler kv:namespace create BLOCKED_IPS
```
Salin setiap ID yang dihasilkan ke `wrangler.toml`.

### 3. Deploy Worker
```bash
# Deploy masing-masing worker
wrangler deploy auth.js --name mbg-auth
wrangler deploy data.js --name mbg-data
wrangler deploy security.js --name mbg-security
```

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
- Auto-block IP: 3+ ancaman terdeteksi dalam 1 jam → diblokir 24 jam
