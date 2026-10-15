# Cloudflare Pages Functions — MBG Realtime Map

## File
| File | Fungsi |
|------|--------|
| `ws.js` | WebSocket handler + Durable Object `MapRoom` (broadcast lokasi realtime) |
| `_middleware.js` | Security headers untuk semua route |

## Cara Kerja
```
Browser A                    Cloudflare
  │── GET /ws (WebSocket) ──► Pages Function (ws.js)
  │                               │── Durable Object: MapRoom
  │◄── snapshot semua marker ────│     (singleton, selalu hidup)
  │                               │
Browser B kirim lokasi ─────────►│── broadcast ke semua client
Browser A terima, update marker ◄┘
```

## Deploy ke Cloudflare Pages

### 1. Aktifkan Durable Objects
Di `wrangler.toml` (ada di `/workers/wrangler.toml`), Durable Objects sudah dikonfigurasi.
Durable Objects butuh **Cloudflare Workers Paid Plan** ($5/bulan).

### 2. Deploy Worker dulu (untuk Durable Object class)
```bash
cd workers
wrangler deploy
```

### 3. Bind ke Cloudflare Pages
Di Cloudflare Dashboard:
- Buka **Pages** → project MBG → **Settings** → **Functions**
- Di bagian **Durable Object bindings** tambahkan:
  - Variable name: `MAP_ROOM`
  - Durable Object namespace: pilih `MapRoom` dari worker `mbg-monitoring-api`

### 4. Deploy Pages
```bash
# Di root project
npx wrangler pages deploy . --project-name=mbg-monitoring
```

## Dev Lokal (tanpa Durable Objects)
Saat WebSocket gagal connect (misal local dev), map otomatis fallback ke
**BroadcastChannel** — realtime antar tab di browser yang sama, tanpa server.

Buka `map/index.html` di dua tab berbeda → kedua marker akan saling muncul realtime.

## Tidak Ada API Key
- Tile map: **OpenStreetMap** (gratis, tanpa key)
- WebSocket: Cloudflare Durable Objects (infrastruktur sendiri)
- Geolokasi: Browser native `navigator.geolocation`
