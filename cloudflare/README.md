# Radar MBG Nasional — Cloudflare Pages Deployment Package

> **Bahasa Indonesia** | [English below](#english-guide)

---

## 🇮🇩 Panduan Deploy (Bahasa Indonesia)

Folder ini berisi paket siap-deploy untuk **Cloudflare Pages** — layanan hosting statis gratis dari Cloudflare.

### Struktur Folder

```
cloudflare/
├── public/                        ← Root yang di-deploy ke Cloudflare Pages
│   ├── index.html                 ← Halaman utama / Dashboard
│   ├── menu-hari-ini.html         ← Menu Hari Ini
│   ├── distribusi-sebaran-sppg.html ← Distribusi Sebaran SPPG
│   ├── standar-uji-akg.html       ← Standar Uji AKG
│   ├── laporan-aduan.html         ← Laporan & Pengaduan
│   ├── kebijakan-privasi.html     ← Kebijakan Privasi
│   ├── logo.webp                  ← Logo aplikasi
│   ├── _headers                   ← Header keamanan HTTP
│   └── _redirects                 ← Pengalihan URL
├── wrangler.toml                  ← Konfigurasi Wrangler CLI
└── README.md                      ← Dokumentasi ini
```

### Cara Deploy

#### Metode 1: Drag & Drop (Paling Mudah)

1. Buka [https://pages.cloudflare.com](https://pages.cloudflare.com)
2. Login / daftar akun Cloudflare (gratis)
3. Klik **"Create a project"** → **"Direct Upload"**
4. Beri nama proyek: `radar-mbg-nasional`
5. **Drag & drop folder `public/`** ke area upload
6. Klik **"Deploy site"**
7. Situs akan tersedia di `https://radar-mbg-nasional.pages.dev`

#### Metode 2: Via GitHub (Recommended untuk Tim)

1. Push seluruh repository ke GitHub
2. Buka [https://pages.cloudflare.com](https://pages.cloudflare.com) → **"Create a project"** → **"Connect to Git"**
3. Pilih repository Anda
4. Atur konfigurasi build:
   - **Production branch:** `main`
   - **Root directory:** `cloudflare/public`
   - **Build command:** *(kosongkan — tidak diperlukan)*
   - **Build output directory:** *(kosongkan — sudah ditetapkan di root directory)*
5. Klik **"Save and Deploy"**

#### Metode 3: Via Wrangler CLI

```bash
# Install Wrangler
npm install -g wrangler

# Login ke Cloudflare
wrangler login

# Deploy dari dalam folder cloudflare/
cd cloudflare
wrangler pages deploy public --project-name=radar-mbg-nasional
```

### Custom Domain

1. Di dashboard Cloudflare Pages, buka proyek Anda
2. Tab **"Custom domains"** → **"Set up a custom domain"**
3. Masukkan domain Anda (contoh: `radar.bgn.go.id`)
4. Ikuti instruksi untuk menambahkan record DNS
5. SSL/HTTPS otomatis diaktifkan oleh Cloudflare

### Preview Lokal

Gunakan server HTTP sederhana untuk preview di browser:

```bash
# Menggunakan Python (sudah terinstall di sebagian besar sistem)
cd cloudflare/public
python -m http.server 8080
# Buka: http://localhost:8080

# Atau menggunakan Node.js
npx serve public -p 8080
# Buka: http://localhost:8080
```

### ⚠️ Catatan Penting: `api.php` Tidak Berfungsi di Cloudflare Pages

Cloudflare Pages adalah **hosting statis** — hanya mendukung HTML, CSS, JS, dan aset statis. File `api.php` **tidak akan berfungsi**.

**Solusi untuk fitur dinamis:**
- Gunakan **Cloudflare Workers** untuk logika backend (JavaScript/TypeScript)
- Atau gunakan layanan backend terpisah (misalnya VPS, server PHP, dll.)
- Untuk formulir pengaduan: pertimbangkan menggunakan layanan form pihak ketiga seperti Formspree atau Netlify Forms

### Konfigurasi Android — Setelah Deploy

Setelah berhasil deploy ke Cloudflare Pages, perbarui URL di `MainActivity.kt`:

```kotlin
// SEBELUM (emulator lokal):
private val BASE = "http://10.0.2.2/MBG-MONITORING/"

// SESUDAH (Cloudflare Pages):
private val BASE = "https://radar-mbg-nasional.pages.dev/"
// atau dengan custom domain:
private val BASE = "https://radar.bgn.go.id/"
```

---

## English Guide

### What Is This?

This folder contains the **Cloudflare Pages** static deployment package for the **Radar MBG Nasional** web application. It is ready to be deployed as-is — no build step required.

### Deployment

#### Method 1: Drag & Drop

1. Go to [https://pages.cloudflare.com](https://pages.cloudflare.com)
2. Log in / sign up (free)
3. Click **"Create a project"** → **"Direct Upload"**
4. Name the project: `radar-mbg-nasional`
5. **Drag & drop the `public/` folder** into the upload area
6. Click **"Deploy site"**
7. Your site will be live at `https://radar-mbg-nasional.pages.dev`

#### Method 2: GitHub Integration

1. Push the repository to GitHub
2. Go to Cloudflare Pages → **"Create a project"** → **"Connect to Git"**
3. Select your repository
4. Build settings:
   - **Production branch:** `main`
   - **Root directory:** `cloudflare/public`
   - **Build command:** *(leave blank — static site)*
   - **Build output directory:** *(leave blank)*
5. Click **"Save and Deploy"**

#### Method 3: Wrangler CLI

```bash
npm install -g wrangler
wrangler login
cd cloudflare
wrangler pages deploy public --project-name=radar-mbg-nasional
```

### Custom Domain

1. In the Cloudflare Pages dashboard, open your project
2. Go to **"Custom domains"** → **"Set up a custom domain"**
3. Enter your domain (e.g. `radar.bgn.go.id`)
4. Follow DNS instructions — SSL is automatic

### Local Preview

```bash
cd cloudflare/public
python -m http.server 8080
# Open: http://localhost:8080
```

### ⚠️ Note: `api.php` Does Not Work on Cloudflare Pages

Cloudflare Pages is **static hosting only**. The `api.php` backend will not execute.

**Options for dynamic features:**
- Use **Cloudflare Workers** (JavaScript/TypeScript serverless functions)
- Host the PHP backend on a separate server/VPS
- Use third-party form services (Formspree, etc.) for complaint forms

### Android — After Deploy

After deploying to Cloudflare Pages, update `MainActivity.kt`:

```kotlin
// BEFORE (local emulator):
private val BASE = "http://10.0.2.2/MBG-MONITORING/"

// AFTER (Cloudflare Pages):
private val BASE = "https://radar-mbg-nasional.pages.dev/"
// or with custom domain:
private val BASE = "https://radar.bgn.go.id/"
```

---

## URL Shortcuts (`_redirects`)

| Short URL       | Destination                        | Type     |
|-----------------|------------------------------------|----------|
| `/home`         | `/index.html`                      | 301      |
| `/menu`         | `/menu-hari-ini.html`              | 301      |
| `/distribusi`   | `/distribusi-sebaran-sppg.html`    | 301      |
| `/standar`      | `/standar-uji-akg.html`            | 301      |
| `/aduan`        | `/laporan-aduan.html`              | 301      |
| `/privasi`      | `/kebijakan-privasi.html`          | 301      |
| `/*`            | `/index.html`                      | 200 (SPA)|

## Security Headers (`_headers`)

| Header                    | Value                                |
|---------------------------|--------------------------------------|
| `X-Frame-Options`         | `DENY`                               |
| `X-Content-Type-Options`  | `nosniff`                            |
| `Referrer-Policy`         | `strict-origin-when-cross-origin`    |
| `X-XSS-Protection`        | `1; mode=block`                      |
| `Content-Security-Policy` | Allowlists Tailwind CDN, Google Fonts|
| `Cache-Control` (HTML)    | `max-age=60, stale-while-revalidate` |
| `Cache-Control` (logo)    | `max-age=604800, immutable`          |
