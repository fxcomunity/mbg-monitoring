# Radar MBG — Android App (WebView APK)

## Cara Import ke Android Studio

### 1. Buka Android Studio
- Pilih **File → Open** (bukan "New Project")
- Arahkan ke folder: `c:\laragon\www\MBG-MONITORING\android`
- Klik **OK** → tunggu Gradle sync selesai (~1-2 menit)

---

### 2. Icon Launcher (sudah siap ✅)
File `ic_launcher.png` sudah dikopy otomatis ke semua folder mipmap:
```
res/
  mipmap-mdpi/      ic_launcher.png  ic_launcher_round.png
  mipmap-hdpi/      ic_launcher.png  ic_launcher_round.png
  mipmap-xhdpi/     ic_launcher.png  ic_launcher_round.png
  mipmap-xxhdpi/    ic_launcher.png  ic_launcher_round.png
  mipmap-xxxhdpi/   ic_launcher.png  ic_launcher_round.png
```
AndroidManifest sudah set:
```xml
android:icon="@mipmap/ic_launcher"
android:roundIcon="@mipmap/ic_launcher"
```
**Tidak perlu setup manual apapun untuk icon.**

---

### 3. Build APK Debug (untuk test di HP)
1. Menu **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. Tunggu build selesai
3. Klik **"locate"** di notifikasi bawah, atau cari di:
   ```
   android/app/build/outputs/apk/debug/app-debug.apk
   ```
4. Transfer ke HP → install

---

### 4. Build APK Release (untuk distribusi)
1. **Build → Generate Signed Bundle / APK → APK → Next**
2. Klik **"Create new..."** untuk buat keystore:
   - Key store path: pilih lokasi simpan `.jks`
   - Password: isi bebas (ingat ini!)
   - Alias: `radarmbg`
   - Validity: `25`
3. **Next → Release → Finish**
4. APK tersimpan di:
   ```
   android/app/build/outputs/apk/release/app-release.apk
   ```

---

### 5. Install via ADB (opsional)
```bash
adb install app-debug.apk
```

---

## Fitur APK
| Fitur | Status |
|---|---|
| Splash screen logo BGN (2 detik) | ✅ |
| WebView load `https://mbg.jack-ai.my.id` | ✅ |
| Bottom Navigation (Beranda, Menu, Distribusi, Laporan) | ✅ |
| Swipe to refresh | ✅ |
| Geolokasi untuk peta realtime | ✅ |
| Deep link `https://mbg.jack-ai.my.id` | ✅ |
| Halaman error jika offline | ✅ |
| Support Android 7.0+ (API 24+) | ✅ |

## Package Name
`id.go.bgn.radarmbg`
