# Radar MBG — Android APK

## Cara Build APK via Terminal Android Studio

### 1. Buka Terminal di Android Studio
`View → Tool Windows → Terminal`

### 2. Masuk ke folder android
```
cd c:\laragon\www\MBG-MONITORING\android
```

### 3. Build APK Debug
```
.\gradlew.bat assembleDebug
```
Tunggu ~3-5 menit (download Gradle pertama kali lebih lama).

APK tersimpan di:
```
android\app\build\outputs\apk\debug\app-debug.apk
```

### 4. Build APK Release (tanpa signing, untuk test)
```
.\gradlew.bat assembleRelease
```

---

## Struktur Project
```
android/
  app/
    build.gradle          ← dependencies & config
    src/main/
      AndroidManifest.xml
      java/.../
        MainActivity.kt   ← WebView utama
        SplashActivity.kt ← Splash logo BGN
      res/
        layout/           ← XML layout
        values/           ← strings, colors, themes
        mipmap-*/         ← ic_launcher.png (semua densitas)
        drawable/         ← background gradient
        xml/              ← network security config
  build.gradle            ← plugin versions
  settings.gradle         ← module config
  gradlew.bat             ← build script Windows
  gradle.properties       ← JVM & Android flags
  gradle/wrapper/
    gradle-wrapper.jar
    gradle-wrapper.properties
```

## Info APK
| Field | Value |
|---|---|
| Package | `id.go.bgn.radarmbg` |
| Min Android | 7.0 (API 24) |
| Target Android | 14 (API 35) |
| URL | `https://mbg.jack-ai.my.id` |
