<div align="center">

<img src="assets/images/ic_launcher.png" width="100" alt="Logo Radar MBG"/>

# Radar MBG Nasional
### Portal Monitoring & Transparansi Program Makan Bergizi Gratis
**Badan Gizi Nasional Republik Indonesia**

[![Cloudflare Pages](https://img.shields.io/badge/Hosted%20on-Cloudflare%20Pages-F38020?logo=cloudflare&logoColor=white)](https://mbg.jack-ai.my.id)
[![Android](https://img.shields.io/badge/Android-APK%20Available-3DDC84?logo=android&logoColor=white)](#-download-aplikasi-android)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](docs/LICENSE)

**🌐 [mbg.jack-ai.my.id](https://mbg.jack-ai.my.id)**

</div>

---

## 📱 Download Aplikasi Android

> APK tersedia di halaman **Releases** GitHub ini.

### Cara Download & Install APK

1. Buka halaman **[Releases](../../releases/latest)** → klik `app-debug.apk`
2. Transfer ke HP atau scan QR code di halaman Releases
3. Di HP: **Pengaturan → Keamanan → Izinkan sumber tidak dikenal**
4. Buka file APK → **Install**

> **Minimum Android:** 7.0 (Nougat) ke atas

---

## ✨ Fitur Utama

| Fitur | Web | Android |
|---|:---:|:---:|
| Dashboard KPI Nasional (sekolah, porsi, AKG) | ✅ | ✅ |
| Peta distribusi SPPG realtime (OpenStreetMap) | ✅ | ✅ |
| Menu MBG hari ini per sekolah | ✅ | ✅ |
| Laporan & aduan publik | ✅ | ✅ |
| Live chat Satgas BGN (AI) | ✅ | ✅ |
| Login multi-role (Admin / SPPG / User) | ✅ | ✅ |
| Peta realtime multi-user (WebSocket) | ✅ | — |
| Backup menu harian (download Excel) | ✅ | — |
| Panel Admin (manajemen akun, approval, log) | ✅ | — |

---

## 🛠️ Tech Stack

**Web (Cloudflare Pages)**
- HTML5 + Tailwind CSS + Vanilla JS
- Cloudflare Pages Functions (JS) — menggantikan PHP backend
- Cloudflare Workers — Auth, Data, Menu, Security, WebSocket
- Cloudflare KV — session storage
- Neon PostgreSQL — database utama
- Leaflet.js + OpenStreetMap — peta tanpa API key

**Android (Native)**
- Kotlin + Jetpack Compose
- Retrofit 2 + OkHttp — API calls ke Cloudflare Workers
- OSMDroid — peta OpenStreetMap native Android
- Jetpack DataStore — session lokal
- Material Design 3

---

## 🚀 Clone & Setup

### Clone Repository

```bash
git clone https://github.com/fxcomunity/mbg-monitoring.git
cd mbg-monitoring
```

### Web — Jalankan Lokal

```bash
# Tidak perlu install apapun — buka langsung di browser
# Atau pakai live server extension di VS Code
```

Untuk fitur yang butuh backend (login, API), deploy ke Cloudflare Pages:

```bash
# Install Wrangler
npm install -g wrangler
wrangler login

# Set secret database
cd workers
wrangler secret put DATABASE_URL

# Deploy workers
wrangler deploy auth.js --name mbg-auth
wrangler deploy data.js --name mbg-data
wrangler deploy menu.js --name mbg-menu
wrangler deploy security.js --name mbg-security

# Deploy ke Cloudflare Pages
npx wrangler pages deploy . --project-name=mbg-monitoring
```

### Android — Build APK

**Prerequisite:** Android Studio + JDK 17

```bash
# Clone repo
git clone https://github.com/fxcomunity/mbg-monitoring.git
cd mbg-monitoring/android

# Set JAVA_HOME ke JDK 17
# Windows:
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot

# Build APK debug
.\gradlew.bat assembleDebug
```

APK tersimpan di:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 📁 Struktur Project

```
mbg-monitoring/
├── index.html              # Halaman publik utama
├── auth/                   # Login & Register
├── dashboard/
│   ├── admin/              # Dashboard Admin Satgas BGN
│   ├── sppg/               # Dashboard Mitra Dapur SPPG
│   └── user/               # Dashboard Wali Murid
├── fitur/                  # Menu, Distribusi, Standar, Laporan, Kebijakan
├── error/                  # Halaman error (404, 500, caught)
├── map/                    # Peta realtime multi-user
├── functions/              # Cloudflare Pages Functions (API)
│   └── api/                # auth_user, telemetri, menu, dll
├── workers/                # Cloudflare Workers standalone
├── database/               # SQL schema (Neon PostgreSQL)
├── assets/
│   ├── css/                # Stylesheet
│   ├── js/                 # Script utama, security, API
│   └── images/
└── android/                # Aplikasi Android native
    └── app/src/main/
        └── java/.../
            ├── ui/screens/ # 9 screen Compose
            ├── data/api/   # Retrofit + Models
            └── viewmodel/  # 5 ViewModels
```

---

## 🔐 Environment Variables

Buat file `.env` di root (sudah di `.gitignore`):

```env
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=google/gemini-2.0-flash-001
APP_URL=https://mbg.jack-ai.my.id
```

---

## 📄 Lisensi

[MIT License](docs/LICENSE) — © 2026 Badan Gizi Nasional Republik Indonesia
