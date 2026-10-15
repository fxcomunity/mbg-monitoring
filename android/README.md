# Radar MBG — Android App (WebView APK)

## Cara Import ke Android Studio

### 1. Buka Android Studio
- Pilih **File → Open** (bukan "New Project")
- Arahkan ke folder: `c:\laragon\www\MBG-MONITORING\android`
- Klik **OK** → tunggu Gradle sync selesai

### 2. Tambahkan Logo BGN sebagai App Icon
Karena file `.webp` dari web tidak bisa langsung jadi launcher icon:

**Cara cepat via Android Studio:**
1. Klik kanan folder `app/src/main/res` → **New → Image Asset**
2. Icon Type: **Launcher Icons (Adaptive and Legacy)**
3. Source Asset: pilih file `c:\laragon\www\MBG-MONITORING\assets\images\logo.webp`
4. Name: `ic_launcher`
5. Klik **Next → Finish**

### 3. Build APK Debug (untuk test)
- Menu **Build → Build Bundle(s) / APK(s) → Build APK(s)**
- APK tersimpan di: `android/app/build/outputs/apk/debug/app-debug.apk`

### 4. Build APK Release (untuk distribusi)
```
Build → Generate Signed Bundle / APK → APK
```
Buat keystore baru → isi password → build.

### 5. Install ke HP (via USB)
```bash
adb install app-debug.apk
```
Atau transfer file APK ke HP dan install manual.

---

## Fitur APK
- **Splash screen** logo BGN + nama "Radar MBG" (2 detik)
- **WebView** load `https://mbg.jack-ai.my.id`
- **Bottom Navigation** → Beranda, Menu Hari Ini, Distribusi SPPG, Laporan
- **Swipe to refresh** pada semua halaman
- **Geolokasi** untuk peta realtime
- **Deep link** `https://mbg.jack-ai.my.id` buka langsung di app
- **Offline page** jika tidak ada koneksi

## Dependencies (build.gradle)
```gradle
implementation 'androidx.appcompat:appcompat:1.7.0'
implementation 'com.google.android.material:material:1.12.0'
implementation 'androidx.swiperefreshlayout:swiperefreshlayout:1.1.0'
```

## Package Name
`id.go.bgn.radarmbg`

## Min SDK
Android 7.0 (API 24)

## Target SDK  
Android 14 (API 34)
