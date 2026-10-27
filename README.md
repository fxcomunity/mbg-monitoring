<div align="center">

<img src="assets/images/ic_launcher.png" width="100" alt="Logo Radar MBG"/>

# Radar MBG Nasional
### Portal Monitoring & Transparansi Program Makan Bergizi Gratis
**Badan Gizi Nasional Republik Indonesia**

[![Cloudflare Pages](https://img.shields.io/badge/Hosted%20on-Cloudflare%20Pages-F38020?logo=cloudflare&logoColor=white)](https://mbg.jack-ai.my.id)
[![Android](https://img.shields.io/badge/Android-v1.1.0-3DDC84?logo=android&logoColor=white)](https://github.com/fxcomunity/mbg-monitoring/releases/latest)
[![PostgreSQL](https://img.shields.io/badge/Database-Neon%20PostgreSQL-4169E1?logo=postgresql&logoColor=white)](#)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](docs/LICENSE)

**🌐 [mbg.jack-ai.my.id](https://mbg.jack-ai.my.id)**

</div>

---

## 📱 Download Aplikasi Android

> APK tersedia di halaman **[Releases](https://github.com/fxcomunity/mbg-monitoring/releases/latest)** GitHub.

| Versi | File | Ukuran | Min Android |
|---|---|---|---|
| v1.1.0 | `Radar-MBG-V2.apk` | ~20.8 MB | 7.0 (API 24+) |

### Cara Install APK

1. Buka **[Releases → v1.1.0](https://github.com/fxcomunity/mbg-monitoring/releases/tag/v1.1.0)** → download `Radar-MBG-V2.apk`
2. Transfer ke HP Android
3. **Pengaturan → Keamanan → Izinkan sumber tidak dikenal**
4. Buka file APK → **Install**

---

## ✨ Fitur Utama

| Fitur | Web | Android |
|---|:---:|:---:|
| Dashboard KPI Nasional (sekolah, porsi, AKG) | ✅ | ✅ |
| Peta lokasi SPPG dengan koordinat di basis data | ✅ | ✅ |
| Distribusi provinsi interaktif (klik → list SPPG) | ✅ | — |
| Menu MBG hari ini per sekolah | ✅ | ✅ |
| Laporan & aduan publik + sistem tiket | ✅ | ✅ |
| Live chat Satgas BGN (AI powered) | ✅ | ✅ |
| Login multi-role (Admin / SPPG / User) | ✅ | ✅ |
| Panel Admin lengkap (akun, approval, log) | ✅ | — |
| Maintenance mode (aktifkan via panel admin) | ✅ | — |
| Log keamanan & deteksi ancaman | ✅ | — |
| Backup menu harian (download Excel) | ✅ | — |
| Video background login & hero banner | ✅ | — |

---

## 🛠️ Tech Stack

### Web
- **Frontend** — HTML5, Tailwind CSS (CDN), Vanilla JS
- **Backend** — PHP 8+ (Apache/Laragon lokal), Cloudflare Workers (production)
- **Database** — Neon PostgreSQL (30.546 data SPPG)
- **Peta** — Leaflet.js + Leaflet.MarkerCluster + OpenStreetMap
- **AI Chat** — OpenRouter API (Gemini 2.0 Flash)
- **Deploy** — Cloudflare Pages + Workers

### Android
- **Language** — Kotlin + Jetpack Compose
- **Navigation** — Navigation Compose
- **Networking** — Retrofit 2 + OkHttp 4
- **Peta** — OSMDroid (OpenStreetMap native)
- **Storage** — Jetpack DataStore (session lokal)
- **UI** — Material Design 3

---

## 📁 Struktur Project

```
mbg-monitoring/
├── index.html                  # Halaman publik utama
├── maintenance.html            # Halaman maintenance mode
├── maintenance.json            # State maintenance (aktif/nonaktif)
├── _redirects                  # Cloudflare Pages routing
├── auth/                       # Login, register, logout
├── dashboard/
│   ├── admin/                  # Dashboard & panel admin (KPI, SPPG, log keamanan)
│   ├── sppg/                   # Dashboard mitra dapur SPPG
│   └── user/                   # Dashboard wali murid
├── fitur/                      # Menu harian, distribusi, laporan, standar AKG
├── map/                        # Peta realtime 30K SPPG
├── api/                        # PHP API endpoints
│   ├── menu.php                # Menu harian
│   ├── home_menu.php           # Menu beranda dari basis data
│   ├── telemetri.php           # KPI nasional
│   ├── distribusi.php          # Distribusi per provinsi
│   ├── sppg_provinsi.php       # List SPPG per provinsi (modal interaktif)
│   ├── sppg_map.php            # GeoJSON lokasi SPPG dari basis data
│   ├── sppg_status.php         # Status operasional SPPG
│   ├── security_threats.php    # Log ancaman keamanan
│   ├── maintenance.php         # Maintenance mode toggle
│   ├── live_chat.php           # Live chat AI
│   └── ...
├── workers/                    # Cloudflare Workers (auth, data, menu, security)
├── database/
│   ├── db.php                  # PDO singleton (Neon PostgreSQL)
│   ├── schema_all.sql          # Schema lengkap semua tabel
│   ├── schema_sppg.sql         # Schema tabel SPPG
│   ├── schema_menu.sql         # Schema tabel menu harian
│   ├── setup_users.sql         # Penyesuaian kolom akun
│   └── scripts/
│       ├── cleanup.php         # Cleanup data DB
│       └── geocode_sppg.py     # Geocoding koordinat SPPG
├── assets/
│   ├── css/                    # Stylesheet
│   ├── js/script.js            # JS utama (nav, modal, peta, maintenance check)
│   └── images/
├── error/                      # Halaman 404, 500
├── docs/                       # Lisensi & dokumentasi
└── android/                    # Aplikasi Android native
    └── app/src/main/
        ├── java/.../
        │   ├── ui/screens/     # Compose screens (Login, Home, Peta, Menu, dll)
        │   ├── data/api/       # Retrofit services & models
        │   └── viewmodel/      # AuthViewModel, dll
        └── res/                # Layout, drawable, values
```

---

## 🚀 Setup & Jalankan Lokal

### Web (PHP + PostgreSQL)

**Prerequisite:** Laragon / XAMPP (PHP 8+), PostgreSQL 18

```bash
git clone https://github.com/fxcomunity/mbg-monitoring.git
cd mbg-monitoring
```

Buat file `.env` di root:
```env
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
DB_HOST=localhost
DB_PORT=5432
DB_NAME=neondb
DB_USER=postgres
DB_PASS=your_password
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=google/gemini-2.0-flash-001
APP_URL=https://mbg.jack-ai.my.id
```

Buka di browser: `http://localhost/MBG-MONITORING`

### Web (Deploy ke Cloudflare Pages)

```bash
npm install -g wrangler
wrangler login

# Deploy workers
cd workers
wrangler deploy auth.js --name mbg-auth
wrangler deploy data.js --name mbg-data
wrangler deploy menu.js --name mbg-menu
wrangler deploy security.js --name mbg-security

# Deploy pages
npx wrangler pages deploy . --project-name=mbg-monitoring
```

### Android — Build APK

**Prerequisite:** Android Studio + JDK 17

```bash
cd android

# Windows
.\gradlew.bat assembleDebug

# Mac/Linux
./gradlew assembleDebug
```

APK output:
```
android/app/build/outputs/apk/debug/Radar-MBG-V2.apk
```

---

## 🗄️ Database

**Neon PostgreSQL** — seluruh informasi ditampilkan berdasarkan data yang tersedia pada basis data yang dikonfigurasi.

| Tabel | Isi |
|---|---|
| `sppg` | Data lokasi SPPG |
| `users` | Akun admin, mitra SPPG, wali murid |
| `menu_sppg` | Menu harian per dapur SPPG |
| `telemetri_nasional` | KPI nasional (porsi, sekolah, AKG) |
| `distribusi_provinsi` | Rekapitulasi per provinsi |
| `laporan_aduan` | Laporan & aduan publik |
| `live_chat_messages` | Riwayat chat AI |
| `exploit_logs` | Log keamanan WAF |

Schema SQL ada di `database/schema_all.sql`. Skema tidak mengisi data contoh; aplikasi hanya menampilkan catatan yang tersedia pada basis data.

---

## 🔐 Akun

Skema tidak membuat akun demo atau menetapkan kata sandi bawaan. Gunakan proses provisioning akun yang sudah terhubung ke basis data aplikasi.

---

## 🔧 Maintenance Mode

Admin dapat mengaktifkan maintenance mode melalui **Dashboard Admin → Panel → Mode Maintenance**:
- Atur pesan dan estimasi selesai
- Semua halaman publik otomatis menampilkan halaman maintenance
- Nonaktifkan kapan saja dari panel yang sama

---

## 📄 Lisensi

[MIT License](docs/LICENSE) — © 2026 Badan Gizi Nasional Republik Indonesia
