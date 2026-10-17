# Radar MBG — Android App

Aplikasi Android native untuk monitoring Program Makan Bergizi Gratis.

## Info APK

| Field | Value |
|---|---|
| Package | `id.go.bgn.radarmbg` |
| Version | 1.1.0 (versionCode 2) |
| Min Android | 7.0 (API 24) |
| Target Android | 14 (API 35) |
| Base URL | `https://mbg.jack-ai.my.id` |

## Download

APK tersedia di [GitHub Releases](https://github.com/fxcomunity/mbg-monitoring/releases/latest).

## Build APK

**Prerequisite:** Android Studio + JDK 17

```bash
# Dari root project
cd android

# Windows — debug
.\gradlew.bat assembleDebug

# Windows — release
.\gradlew.bat assembleRelease

# Mac/Linux
./gradlew assembleDebug
```

Output APK:
```
app/build/outputs/apk/debug/Radar-MBG-V2.apk
```

## Struktur

```
android/
├── app/
│   ├── build.gradle              ← dependencies & config (versionCode, versionName)
│   └── src/main/
│       ├── AndroidManifest.xml
│       └── java/id/go/bgn/radarmbg/
│           ├── MainActivity.kt   ← NavHost utama (Compose)
│           ├── ui/
│           │   ├── screens/      ← Splash, Login, Register, Home, Menu,
│           │   │                    Peta, Laporan, Dashboard, AdminPanel,
│           │   │                    Profile, Notifikasi
│           │   ├── components/   ← AppTopBar, RadarNavBar
│           │   └── theme/        ← RadarMBGTheme
│           ├── data/
│           │   ├── api/          ← ApiClient, ApiService, AuthApiService,
│           │   │                    DataApiService, MenuApiService, Models
│           │   ├── local/        ← SessionDataStore
│           │   └── repository/   ← AuthRepository
│           └── viewmodel/        ← AuthViewModel
└── gradle/
    └── wrapper/
        └── gradle-wrapper.properties
```

## API Endpoints

| Instance | URL | Kegunaan |
|---|---|---|
| `authInstance` | `mbg-auth.aqsholhalqi4.workers.dev` | Login, register, session |
| `dataInstance` | `mbg-data.aqsholhalqi4.workers.dev` | Telemetri & distribusi |
| `menuInstance` | `mbg-menu.aqsholhalqi4.workers.dev` | Menu harian |
| `instance` | `mbg.jack-ai.my.id` | Endpoint utama |
