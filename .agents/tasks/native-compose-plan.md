# Implementation Plan — Radar MBG Native Android (Kotlin + Jetpack Compose)

## Project context

- **Package:** `id.go.bgn.radarmbg`
- **Build:** AGP 8.7.3, Kotlin 2.0.21, Gradle 8.14
- **Compose plugin note:** Kotlin 2.0.21 uses `id 'org.jetbrains.kotlin.plugin.compose' version '2.0.21'`
  in the root build.gradle (apply false) and `id 'org.jetbrains.kotlin.plugin.compose'` in the app
  module — NOT `composeOptions.kotlinCompilerExtensionVersion`. The compose BOM handles UI library versions.
- **API base:** `https://mbg.jack-ai.my.id/`
- **Auth:** cookie `mbg_token` (HttpOnly/Secure set by server), header `X-Requested-By: mbg-radar` required on all requests
- **Build command:** `cd c:\laragon\www\MBG-MONITORING\android && .\gradlew.bat assembleDebug`

---

## FEAT-001 — Build system + resource cleanup

- [ ] 1. Replace `android/build.gradle` (root) — add Compose compiler plugin
      Add `id 'org.jetbrains.kotlin.plugin.compose' version '2.0.21' apply false` alongside the
      existing `com.android.application` and `org.jetbrains.kotlin.android` plugin declarations.
      Keep AGP 8.7.3 and kotlin.android 2.0.21 unchanged.
      Files: `android/build.gradle`
      Verify: step 3 build check.

- [ ] 2. Replace `android/app/build.gradle` (app module) — full dependency overhaul
      Keep: namespace, compileSdk 35, minSdk 24, targetSdk 35, applicationId, versionCode/Name,
      testRunner, compileOptions JavaVersion.VERSION_17, kotlinOptions jvmTarget 17.
      Add to plugins block: `id 'org.jetbrains.kotlin.plugin.compose'` (no version — inherited from root).
      Add to android block: `buildFeatures { compose = true }`.
      DO NOT add a `composeOptions` block — the plugin handles the compiler version automatically.
      Remove: `androidx.webkit`, `androidx.swiperefreshlayout`, `androidx.constraintlayout`,
      `androidx.appcompat`, `com.google.android.material` — not needed in Compose.
      Add dependencies:
      ```groovy
      implementation platform('androidx.compose:compose-bom:2024.12.01')
      implementation 'androidx.compose.ui:ui'
      implementation 'androidx.compose.ui:ui-tooling-preview'
      implementation 'androidx.compose.material3:material3'
      implementation 'androidx.activity:activity-compose:1.9.3'
      implementation 'androidx.navigation:navigation-compose:2.8.5'
      implementation 'androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7'
      implementation 'androidx.lifecycle:lifecycle-runtime-ktx:2.8.7'
      implementation 'com.squareup.retrofit2:retrofit:2.11.0'
      implementation 'com.squareup.retrofit2:converter-gson:2.11.0'
      implementation 'com.squareup.okhttp3:okhttp:4.12.0'
      implementation 'com.squareup.okhttp3:logging-interceptor:4.12.0'
      implementation 'io.coil-kt:coil-compose:2.7.0'
      implementation 'org.osmdroid:osmdroid-android:6.1.20'
      implementation 'androidx.datastore:datastore-preferences:1.1.1'
      implementation 'com.google.accompanist:accompanist-permissions:0.36.0'
      implementation 'androidx.core:core-ktx:1.15.0'
      debugImplementation 'androidx.compose.ui:ui-tooling'
      debugImplementation 'androidx.compose.ui:ui-test-manifest'
      ```
      Keep testImplementation and androidTestImplementation lines unchanged.
      Files: `android/app/build.gradle`
      Verify: step 3 build check.

- [ ] 3. Delete legacy XML layout files and SplashActivity
      Delete these files:
      - `android/app/src/main/res/layout/activity_main.xml`
      - `android/app/src/main/res/layout/activity_splash.xml`
      - `android/app/src/main/res/layout/dialog_school_picker.xml`
      - `android/app/src/main/res/layout/item_menu_card.xml`
      - `android/app/src/main/java/id/go/bgn/radarmbg/SplashActivity.kt`
      Files: deleted as listed
      Verify: step 5 build check.

- [ ] 4. Update `android/app/src/main/AndroidManifest.xml`
      - Change LAUNCHER activity from `.SplashActivity` to `.MainActivity`.
      - Set `android:theme="@style/Theme.RadarMBG"` on MainActivity.
      - Remove `android:screenOrientation="portrait"` (Compose manages orientation).
      - Keep `android:configChanges="orientation|screenSize|keyboardHidden"` and
        `android:windowSoftInputMode="adjustResize"`.
      - Remove the entire `.SplashActivity` `<activity>` block.
      - Keep all permissions, `<queries>` block, FileProvider `<provider>`, and
        the deep-link `<intent-filter>` on MainActivity unchanged.
      - Ensure `android:exported="true"` is on MainActivity.
      Files: `android/app/src/main/AndroidManifest.xml`
      Verify: step 5 build check.

- [ ] 5. Add strings to `android/app/src/main/res/values/strings.xml`
      Append (keep all existing strings):
      ```xml
      <!-- Auth screens -->
      <string name="login_judul">Masuk ke Akun</string>
      <string name="login_subtitle">Monitor program MBG secara real-time</string>
      <string name="hint_username">Username</string>
      <string name="hint_password">Kata Sandi</string>
      <string name="btn_login">Masuk</string>
      <string name="link_register">Belum punya akun? Daftar</string>
      <string name="label_error_login">Login gagal</string>
      <string name="register_judul">Buat Akun Baru</string>
      <string name="hint_nama_lengkap">Nama Lengkap</string>
      <string name="hint_email">Email</string>
      <string name="hint_konfirmasi_password">Konfirmasi Kata Sandi</string>
      <string name="label_role">Daftar sebagai</string>
      <string name="role_user">Wali Murid / Publik</string>
      <string name="role_sppg">Pengelola SPPG</string>
      <string name="hint_sppg_name">Nama Dapur SPPG</string>
      <string name="btn_register">Daftar</string>
      <string name="link_login">Sudah punya akun? Masuk</string>
      <!-- Home screen -->
      <string name="kpi_sekolah_terlayani">Sekolah Terlayani</string>
      <string name="kpi_porsi">Porsi Terdistribusi</string>
      <string name="kpi_kepatuhan">Kepatuhan AKG</string>
      <string name="kpi_sppg_aktif">SPPG Aktif</string>
      <string name="label_distribusi_provinsi">Distribusi per Provinsi</string>
      <string name="label_ketepatan">Ketepatan</string>
      <!-- Menu screen -->
      <string name="menu_judul">Menu Hari Ini</string>
      <string name="menu_empty">Belum ada data menu untuk hari ini</string>
      <string name="label_kalori">kkal</string>
      <string name="label_protein">Protein</string>
      <string name="label_karbohidrat">Karbohidrat</string>
      <string name="label_lemak">Lemak</string>
      <!-- Peta screen -->
      <string name="peta_judul">Peta Distribusi SPPG</string>
      <string name="nav_peta">Peta SPPG</string>
      <string name="wilayah_semua">Seluruh Indonesia</string>
      <string name="wilayah_dki">DKI Jakarta</string>
      <string name="wilayah_jabar">Jawa Barat</string>
      <string name="wilayah_jateng">Jawa Tengah</string>
      <string name="wilayah_jatim">Jawa Timur</string>
      <!-- Laporan screen -->
      <string name="laporan_judul">Laporan &amp; Aduan</string>
      <string name="hint_nama">Nama Lengkap</string>
      <string name="hint_telepon">Nomor Telepon</string>
      <string name="hint_sekolah">Nama Sekolah</string>
      <string name="hint_tanggal">Tanggal Kejadian</string>
      <string name="hint_deskripsi">Deskripsi Aduan</string>
      <string name="label_kategori">Kategori Aduan</string>
      <string name="btn_foto">Lampirkan Foto</string>
      <string name="btn_kirim">Kirim Laporan</string>
      <string name="label_tiket_tracking">Lacak Status Laporan</string>
      <string name="hint_nomor_tiket">Nomor Tiket: TKT-XXXXX</string>
      <string name="btn_cek_tiket">Cek Status</string>
      <!-- Profile screen -->
      <string name="profile_judul">Profil Saya</string>
      <string name="btn_ganti_password">Ganti Kata Sandi</string>
      <string name="btn_logout">Keluar</string>
      <string name="confirm_logout">Yakin ingin keluar?</string>
      <!-- Notifikasi screen -->
      <string name="notifikasi_judul">Notifikasi</string>
      <string name="notif_empty">Tidak ada notifikasi baru</string>
      <!-- General -->
      <string name="loading">Memuat data…</string>
      <string name="error_umum">Terjadi kesalahan. Coba lagi.</string>
      ```
      Files: `android/app/src/main/res/values/strings.xml`
      Verify: step 6 build check.

- [ ] 6. Write placeholder `MainActivity.kt` that compiles with Compose
      Replace the existing WebView MainActivity with a minimal Compose stub so the build can
      validate steps 1–5 before the full implementation in FEAT-003:
      ```kotlin
      package id.go.bgn.radarmbg

      import android.os.Bundle
      import androidx.activity.ComponentActivity
      import androidx.activity.compose.setContent
      import androidx.compose.material3.Surface
      import androidx.compose.material3.Text
      import id.go.bgn.radarmbg.ui.theme.RadarMBGTheme

      class MainActivity : ComponentActivity() {
          override fun onCreate(savedInstanceState: Bundle?) {
              super.onCreate(savedInstanceState)
              setContent {
                  RadarMBGTheme {
                      Surface { Text("Radar MBG") }
                  }
              }
          }
      }
      ```
      NOTE: RadarMBGTheme does not exist yet; this file will fail until FEAT-003 step 1
      (ui/theme/Theme.kt) is created first. The coder must create the theme file before or
      alongside this file — order within FEAT steps can be reordered as needed as long as
      the final `assembleDebug` passes.
      Files: `android/app/src/main/java/id/go/bgn/radarmbg/MainActivity.kt`
      Verify: `.\gradlew.bat assembleDebug` → BUILD SUCCESSFUL

---

## FEAT-002 — Data layer (Retrofit + repositories + ViewModels)

> Depends on: FEAT-001 complete (build.gradle has all dependencies available).

- [ ] 7. Create data model classes
      Single file for all models (avoids cross-file import issues during incremental builds):
      File: `android/app/src/main/java/id/go/bgn/radarmbg/data/api/models/Models.kt`

      ```kotlin
      package id.go.bgn.radarmbg.data.api.models

      data class AuthResponse(
          val logged_in: Boolean = false,
          val user: UserData? = null,
          val status: String? = null,
          val message: String? = null
      )

      data class UserData(
          val id: Int? = null,
          val username: String = "",
          val full_name: String = "",
          val role: String = "",
          val role_label: String = "",
          val sppg_name: String = "",
          val avatar: String? = null
      )

      data class TelemetriWrapper(val status: String = "", val data: TelemetriData = TelemetriData())

      data class TelemetriData(
          val porsi_tersalurkan: Long = 0,
          val persen_target: Double = 0.0,
          val sppg_aktif: Int = 0,
          val sekolah_terlayani: Int = 0,
          val kepatuhan_akg: Double = 0.0,
          val suhu_rata_rata: Double = 0.0,
          val sla_distribusi: Double = 0.0,
          val pembaruan_teks: String = ""
      )

      data class DistribusiWrapper(val status: String = "", val data: List<ProvinsiData> = emptyList())

      data class ProvinsiData(
          val provinsi: String = "",
          val target_porsi: Long = 0,
          val ketepatan: Double = 0.0,
          val status: String = "",
          val region_code: String = ""
      )

      data class MenuWrapper(
          val status: String = "",
          val date: String = "",
          val data: List<MenuData> = emptyList()
      )

      data class MenuData(
          val id: Int? = null,
          val sppg_name: String = "",
          val school_target: String = "",
          val city: String = "",
          val menu_title: String = "",
          val menu_date: String = "",
          val protein_g: Double? = null,
          val karbohidrat_g: Double? = null,
          val lemak_g: Double? = null,
          val kalori_kkal: Int? = null,
          val catatan: String? = null
      )

      data class NotifikasiData(
          val badge_count: Int = 0,
          val laporan_masuk_count: Int = 0,
          val latest_reports: List<LaporanReport> = emptyList()
      )

      data class LaporanReport(
          val id: Int? = null,
          val ticket_code: String = "",
          val reporter_name: String = "",
          val school_target: String = "",
          val issue_category: String = "",
          val status: String = "",
          val created_at: String = ""
      )

      data class TiketWrapper(
          val status: String = "",
          val data: TiketData? = null,
          val message: String? = null
      )

      data class TiketData(
          val nomor_tiket: String = "",
          val kategori: String = "",
          val target_sekolah: String = "",
          val status: String = "",
          val priority: String = "",
          val tanggal_lapor: String = "",
          val nama_pelapor: String = "",
          val deskripsi: String = "",
          val catatan_satgas: String = ""
      )

      data class ChatResponse(
          val status: String = "",
          val reply: String = "",
          val session_id: String = ""
      )
      ```
      Verify: subsequent build check.

- [ ] 8. Create `ApiService.kt` — Retrofit interface
      File: `android/app/src/main/java/id/go/bgn/radarmbg/data/api/ApiService.kt`

      ```kotlin
      package id.go.bgn.radarmbg.data.api

      import id.go.bgn.radarmbg.data.api.models.*
      import retrofit2.http.*

      interface ApiService {
          @GET("api/auth_user")
          suspend fun checkSession(): AuthResponse

          @FormUrlEncoded
          @POST("api/auth_user")
          suspend fun login(
              @Field("action") action: String = "login",
              @Field("username") username: String,
              @Field("password") password: String
          ): AuthResponse

          @FormUrlEncoded
          @POST("api/auth_user")
          suspend fun register(
              @Field("action") action: String = "register",
              @Field("full_name") fullName: String,
              @Field("email") email: String,
              @Field("username") username: String,
              @Field("password") password: String,
              @Field("role") role: String,
              @Field("sppg_name") sppgName: String = ""
          ): AuthResponse

          @GET("api/telemetri")
          suspend fun getTelemetri(): TelemetriWrapper

          @GET("api/distribusi")
          suspend fun getDistribusi(): DistribusiWrapper

          @GET("api/menu")
          suspend fun getMenu(): MenuWrapper

          @GET("api/notifications")
          suspend fun getNotifikasi(): NotifikasiData

          @GET("api/tiket")
          suspend fun getTiket(@Query("tiket") tiket: String): TiketWrapper

          @FormUrlEncoded
          @POST("api/live_chat")
          suspend fun sendChat(
              @Field("message") message: String,
              @Field("session_id") sessionId: String = ""
          ): ChatResponse
      }
      ```
      Verify: subsequent build check.

- [ ] 9. Create `ApiClient.kt` — OkHttp + Retrofit singleton
      File: `android/app/src/main/java/id/go/bgn/radarmbg/data/api/ApiClient.kt`

      Implement a simple in-memory cookie jar using a `ConcurrentHashMap<String, MutableList<Cookie>>`
      that implements `okhttp3.CookieJar`. `saveFromResponse` stores cookies by host.
      `loadForRequest` returns cookies for that host. Also implement `clearCookies()` to wipe the map.

      Add an `Interceptor` that injects `X-Requested-By: mbg-radar` header on every request.

      Add `HttpLoggingInterceptor` set to `BODY` when `BuildConfig.DEBUG` is true, `NONE` otherwise.

      Build `OkHttpClient` with 30s connect/read/write timeouts, the cookie jar, the header
      interceptor, and the logging interceptor.

      Build `Retrofit` with base URL `"https://mbg.jack-ai.my.id/"` and `GsonConverterFactory.create()`.

      Expose as a Kotlin object (singleton):
      ```kotlin
      object ApiClient {
          private val cookieStore = ConcurrentHashMap<String, MutableList<Cookie>>()
          // ... CookieJar, interceptors, OkHttpClient, Retrofit ...
          val instance: ApiService by lazy { retrofit.create(ApiService::class.java) }
          fun clearCookies() { cookieStore.clear() }
      }
      ```
      Verify: subsequent build check.

- [ ] 10. Create `SessionDataStore.kt` — DataStore Preferences wrapper
       File: `android/app/src/main/java/id/go/bgn/radarmbg/data/local/SessionDataStore.kt`

       ```kotlin
       package id.go.bgn.radarmbg.data.local

       import android.content.Context
       import androidx.datastore.core.DataStore
       import androidx.datastore.preferences.core.*
       import androidx.datastore.preferences.preferencesDataStore
       import id.go.bgn.radarmbg.data.api.models.UserData
       import kotlinx.coroutines.flow.Flow
       import kotlinx.coroutines.flow.map

       val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "radar_mbg_session")

       object SessionKeys {
           val IS_LOGGED_IN = booleanPreferencesKey("is_logged_in")
           val USERNAME = stringPreferencesKey("username")
           val FULL_NAME = stringPreferencesKey("full_name")
           val ROLE = stringPreferencesKey("role")
           val SPPG_NAME = stringPreferencesKey("sppg_name")
       }

       suspend fun saveSession(context: Context, user: UserData) {
           context.dataStore.edit { prefs ->
               prefs[SessionKeys.IS_LOGGED_IN] = true
               prefs[SessionKeys.USERNAME] = user.username
               prefs[SessionKeys.FULL_NAME] = user.full_name
               prefs[SessionKeys.ROLE] = user.role
               prefs[SessionKeys.SPPG_NAME] = user.sppg_name
           }
       }

       suspend fun clearSession(context: Context) {
           context.dataStore.edit { it.clear() }
       }

       fun isLoggedIn(context: Context): Flow<Boolean> =
           context.dataStore.data.map { it[SessionKeys.IS_LOGGED_IN] ?: false }

       fun getUser(context: Context): Flow<UserData?> =
           context.dataStore.data.map { prefs ->
               val username = prefs[SessionKeys.USERNAME] ?: return@map null
               UserData(
                   username = username,
                   full_name = prefs[SessionKeys.FULL_NAME] ?: "",
                   role = prefs[SessionKeys.ROLE] ?: "",
                   sppg_name = prefs[SessionKeys.SPPG_NAME] ?: ""
               )
           }
       ```
       Verify: subsequent build check.

- [ ] 11. Create `AuthRepository.kt`
       File: `android/app/src/main/java/id/go/bgn/radarmbg/data/repository/AuthRepository.kt`

       Wraps `ApiClient.instance` calls in `runCatching`. Methods:
       - `suspend fun checkSession(): Result<AuthResponse>` — calls `ApiClient.instance.checkSession()`
       - `suspend fun login(username: String, password: String): Result<AuthResponse>`
       - `suspend fun register(fullName, email, username, password, role, sppgName): Result<AuthResponse>`
       - `suspend fun logout(): Result<Unit>` — calls `ApiClient.clearCookies()`

       Implement as a Kotlin `object AuthRepository`.
       Verify: subsequent build check.

- [ ] 12. Create `DataRepository.kt`
       File: `android/app/src/main/java/id/go/bgn/radarmbg/data/repository/DataRepository.kt`

       Kotlin `object DataRepository`. Methods, all wrapping `ApiClient.instance` in `runCatching`:
       - `suspend fun getTelemetri(): Result<TelemetriData>` — maps `TelemetriWrapper.data`
       - `suspend fun getDistribusi(): Result<List<ProvinsiData>>` — maps `DistribusiWrapper.data`
       - `suspend fun getMenu(): Result<List<MenuData>>` — maps `MenuWrapper.data`
       - `suspend fun getNotifikasi(): Result<NotifikasiData>`
       - `suspend fun getTiket(tiketId: String): Result<TiketWrapper>`
       - `suspend fun sendChat(message: String): Result<ChatResponse>`
       Verify: subsequent build check.

- [ ] 13. Create `AuthViewModel.kt`
       File: `android/app/src/main/java/id/go/bgn/radarmbg/viewmodel/AuthViewModel.kt`

       ```kotlin
       sealed class AuthUiState {
           object Idle : AuthUiState()
           object Loading : AuthUiState()
           data class Success(val user: UserData) : AuthUiState()
           object LoggedOut : AuthUiState()
           data class Error(val message: String) : AuthUiState()
       }
       ```

       `class AuthViewModel(application: Application) : AndroidViewModel(application)`.
       Private `MutableStateFlow<AuthUiState>` initialized to `Idle`.
       Public `val uiState` as `StateFlow`.

       - `fun checkSession()` — `viewModelScope.launch { emit Loading; val result = AuthRepository.checkSession(); on success: if logged_in emit Success(user!!) else emit LoggedOut; on failure emit Error(exception.message) }`
       - `fun login(username, password)` — launch, Loading, call login(), on `status=="success"` call `saveSession(getApplication(), user!!)`, emit Success; on status error emit Error with response.message; on exception emit Error
       - `fun register(...)` — similar pattern, on success emit Idle (don't auto-login, navigate to login screen)
       - `fun logout()` — launch, call AuthRepository.logout(), clearSession(getApplication()), emit LoggedOut
       Verify: subsequent build check.

- [ ] 14. Create `HomeViewModel.kt`
       File: `android/app/src/main/java/id/go/bgn/radarmbg/viewmodel/HomeViewModel.kt`

       ```kotlin
       sealed class HomeUiState {
           object Loading : HomeUiState()
           data class Success(val telemetri: TelemetriData, val distribusi: List<ProvinsiData>) : HomeUiState()
           data class Error(val message: String) : HomeUiState()
       }
       class HomeViewModel : ViewModel() {
           private val _uiState = MutableStateFlow<HomeUiState>(HomeUiState.Loading)
           val uiState = _uiState.asStateFlow()
           fun loadData() {
               viewModelScope.launch {
                   _uiState.value = HomeUiState.Loading
                   val telResult = async { DataRepository.getTelemetri() }
                   val distResult = async { DataRepository.getDistribusi() }
                   val tel = telResult.await()
                   val dist = distResult.await()
                   if (tel.isSuccess && dist.isSuccess) {
                       _uiState.value = HomeUiState.Success(tel.getOrThrow(), dist.getOrThrow())
                   } else {
                       _uiState.value = HomeUiState.Error(
                           tel.exceptionOrNull()?.message ?: dist.exceptionOrNull()?.message ?: "Gagal memuat data"
                       )
                   }
               }
           }
       }
       ```
       Verify: subsequent build check.

- [ ] 15. Create `MenuViewModel.kt`
       File: `android/app/src/main/java/id/go/bgn/radarmbg/viewmodel/MenuViewModel.kt`

       Sealed class `MenuUiState`: Loading, Success(allItems, filtered, kotaList, selectedKota), Error.
       `fun loadMenu()` fetches and populates both lists. `fun filterByKota(kota: String)` updates
       filtered list (empty string = show all).
       Verify: subsequent build check.

- [ ] 16. Create `LaporanViewModel.kt`
       File: `android/app/src/main/java/id/go/bgn/radarmbg/viewmodel/LaporanViewModel.kt`

       Form state fields as individual `MutableStateFlow<String>`: nama, telepon, role, kategori,
       sekolah, tanggal, deskripsi. Plus `MutableStateFlow<android.net.Uri?> photoUri`.
       Sealed class `TiketUiState`: Idle, Loading, Found(TiketData), NotFound, Error.
       `fun trackTiket(tiketId: String)`: calls `DataRepository.getTiket()`.
       `fun submitLaporan()`: serializes form fields into a structured Indonesian message string,
       calls `DataRepository.sendChat(message)` — the AI chat endpoint is the submission channel
       since no dedicated POST /api/laporan endpoint exists. On success, generate a local TKT
       reference: `"TKT-${System.currentTimeMillis().toString().takeLast(5)}"` and emit a
       success state with that reference.
       Verify: subsequent build check.

- [ ] 17. Create `NotifikasiViewModel.kt`
       File: `android/app/src/main/java/id/go/bgn/radarmbg/viewmodel/NotifikasiViewModel.kt`

       Sealed class `NotifikasiUiState`: Loading, Success(NotifikasiData), Error(String).
       `fun loadNotifikasi()` calls `DataRepository.getNotifikasi()`.
       Verify: `.\gradlew.bat assembleDebug` → BUILD SUCCESSFUL

---

## FEAT-003 — UI layer (Compose screens + final MainActivity)

> Depends on: FEAT-002 complete.

- [ ] 18. Create theme files
       Three files:

       **`ui/theme/Color.kt`**:
       ```kotlin
       package id.go.bgn.radarmbg.ui.theme
       import androidx.compose.ui.graphics.Color
       val BgnPrimary = Color(0xFF001026)
       val BgnPrimaryContainer = Color(0xFF0B2545)
       val BgnSecondary = Color(0xFF395F95)
       val BgnTertiaryFixed = Color(0xFF6FFBBE)
       val BgnBackground = Color(0xFFF8F9FF)
       val BgnSurface = Color(0xFFFFFFFF)
       val BgnOnSurface = Color(0xFF0B1C30)
       val BgnOnSurfaceVariant = Color(0xFF44474E)
       val StatusSuccess = Color(0xFF059669)
       val StatusWarning = Color(0xFFF59E0B)
       val StatusError = Color(0xFFEF4444)
       ```

       **`ui/theme/Type.kt`**:
       ```kotlin
       package id.go.bgn.radarmbg.ui.theme
       import androidx.compose.material3.Typography
       val Typography = Typography()
       ```

       **`ui/theme/Theme.kt`**:
       ```kotlin
       package id.go.bgn.radarmbg.ui.theme
       import androidx.compose.material3.*
       import androidx.compose.runtime.Composable
       private val LightColors = lightColorScheme(
           primary = BgnPrimary,
           primaryContainer = BgnPrimaryContainer,
           secondary = BgnSecondary,
           background = BgnBackground,
           surface = BgnSurface,
           onSurface = BgnOnSurface,
           onSurfaceVariant = BgnOnSurfaceVariant,
           error = StatusError
       )
       @Composable
       fun RadarMBGTheme(content: @Composable () -> Unit) {
           MaterialTheme(colorScheme = LightColors, typography = Typography, content = content)
       }
       ```
       Files: `ui/theme/Color.kt`, `ui/theme/Type.kt`, `ui/theme/Theme.kt`
       Verify: subsequent build check.

- [ ] 19. Create shared UI components
       Four files under `ui/components/`:

       **`KpiCard.kt`**: `@Composable fun KpiCard(value: String, label: String, modifier: Modifier)`.
       `ElevatedCard(modifier)`, padding 16dp. `Text(value)` style MaterialTheme.typography.headlineMedium
       color BgnPrimary. `Text(label)` style labelMedium color BgnOnSurfaceVariant.

       **`MenuCard.kt`**: `@Composable fun MenuCard(menu: MenuData, modifier: Modifier)`.
       `ElevatedCard`. Top row: school_target bold + kalori_kkal badge (BgnTertiaryFixed bg).
       menu_title in BgnSecondary. city chip. Nutrisi chips row: protein_g, karbohidrat_g, lemak_g
       (show only if not null), each as a small SuggestionChip or AssistChip.

       **`AppTopBar.kt`**: `@Composable fun AppTopBar(title: String, badgeCount: Int, onNotificationClick: () -> Unit, onProfileClick: () -> Unit)`.
       `TopAppBar` with `colors = TopAppBarDefaults.topAppBarColors(containerColor = BgnPrimary, titleContentColor = Color.White, actionIconContentColor = Color.White)`.
       Actions: `BadgedBox(badge = { if (badgeCount > 0) Badge { Text("$badgeCount") } }) { IconButton(onNotificationClick) { Icon(Icons.Default.Notifications, ...) } }`.
       Second action: `IconButton(onProfileClick)` with a Box circle (BgnSecondary bg) + initial letter Text.

       **`NavBar.kt`**: `@Composable fun RadarNavBar(selectedRoute: String, onNavigate: (String) -> Unit)`.
       `NavigationBar(containerColor = BgnSurface)`. Four `NavigationBarItem`:
       - route "home", icon from `painterResource(R.drawable.ic_beranda)`, label nav_beranda
       - route "menu", icon from `painterResource(R.drawable.ic_menu_hari_ini)`, label nav_menu
       - route "peta", icon from `painterResource(R.drawable.ic_distribusi)`, label nav_peta
       - route "laporan", icon from `painterResource(R.drawable.ic_laporan)`, label nav_laporan
       Use `Icon(painter = painterResource(...))` not ImageVector for XML drawables.

       Files: `ui/components/KpiCard.kt`, `ui/components/MenuCard.kt`,
              `ui/components/AppTopBar.kt`, `ui/components/NavBar.kt`
       Verify: subsequent build check.

- [ ] 20. Create `SplashScreen.kt`
       File: `android/app/src/main/java/id/go/bgn/radarmbg/ui/screens/SplashScreen.kt`

       Full-screen `Box(Modifier.fillMaxSize().background(BgnPrimary))`.
       Center column: `Image(painter = painterResource(R.mipmap.ic_launcher), ...)` 120dp,
       `Text("Radar MBG")` bold 28sp white,
       `Text(stringResource(R.string.bgn_institution_name))` 13sp Color(0xFFB0C4D8).
       Bottom: `Text(stringResource(R.string.copyright_text))` 10sp at bottom.

       `LaunchedEffect(Unit)`: call `authViewModel.checkSession()`.
       Collect `authViewModel.uiState.collectAsStateWithLifecycle()`. When state changes to
       `AuthUiState.Success` → call `onNavigateToHome()`. When `LoggedOut` → call `onNavigateToLogin()`.
       While `Loading` show `CircularProgressIndicator(color = BgnTertiaryFixed)`.
       Verify: subsequent build check.

- [ ] 21. Create `LoginScreen.kt`
       File: `android/app/src/main/java/id/go/bgn/radarmbg/ui/screens/LoginScreen.kt`

       `Column(Modifier.fillMaxSize())`:
       - Top Box (weight 0.35f): BgnPrimary background, centered logo + "Radar MBG" + subtitle
       - Bottom Card (weight 0.65f): white, rounded top corners 24dp

       Inside the card: OutlinedTextField for username, OutlinedTextField for password with
       `visualTransformation` toggle (eye icon trailing icon), ElevatedButton "Masuk" full-width
       (BgnPrimary bg) calls `authViewModel.login(username, password)`,
       TextButton "Belum punya akun? Daftar" calls `onNavigateToRegister`.

       Error state: `AnimatedVisibility` showing red Text with message when uiState is Error.
       Loading state: `CircularProgressIndicator` replaces button or overlays card.
       Verify: subsequent build check.

- [ ] 22. Create `RegisterScreen.kt`
       File: `android/app/src/main/java/id/go/bgn/radarmbg/ui/screens/RegisterScreen.kt`

       Scrollable `Column`. Fields in order: nama lengkap, email, username, password,
       konfirmasi password. Role section: `Text("Daftar sebagai")` + `Row` with two
       `RadioButton` + `Text` pairs (user / sppg). If role == "sppg" show OutlinedTextField
       for sppg_name (animated with `AnimatedVisibility`).
       Validate `password == konfirmasi` before submit; show inline error if mismatch.
       Submit button calls `authViewModel.register(...)`.
       On Success state (after register): show Snackbar "Akun berhasil didaftarkan" + navigate to login.
       TextButton "Sudah punya akun? Masuk" calls `onNavigateToLogin`.
       Verify: subsequent build check.

- [ ] 23. Create `HomeScreen.kt`
       File: `android/app/src/main/java/id/go/bgn/radarmbg/ui/screens/HomeScreen.kt`

       `Scaffold` with `AppTopBar`. `LaunchedEffect(Unit)` calls `homeViewModel.loadData()`.

       Body: `PullToRefreshBox` (from `androidx.compose.material3`) or simple `SwipeRefresh`
       if M3 experimental is unavailable, wrapping `LazyColumn`:
       - Item: `LazyVerticalGrid(columns = Fixed(2), modifier = Modifier.height(IntrinsicSize.Min))`
         with 4 `KpiCard` items:
         - Sekolah Terlayani: `NumberFormat.getIntegerInstance().format(telemetri.sekolah_terlayani)`
         - Porsi Terdistribusi: `NumberFormat.getIntegerInstance().format(telemetri.porsi_tersalurkan)`
         - Kepatuhan AKG: `"${telemetri.kepatuhan_akg}%"`
         - SPPG Aktif: `"${telemetri.sppg_aktif}"`
       - Item: `Text(stringResource(R.string.label_distribusi_provinsi))` section header
       - Items: for each `ProvinsiData`, a `Row` in a `Card`: provinsi name, target_porsi formatted,
         ketepatan %, status chip with color (green ≥ 98%, yellow ≥ 95%, red < 95%).

       Loading state: show shimmer placeholders (3 grey Box items with animated alpha in 0.3–0.7 range).
       Error state: `Card` with error message Text + retry `TextButton` that calls `loadData()`.
       Verify: subsequent build check.

- [ ] 24. Create `MenuScreen.kt`
       File: `android/app/src/main/java/id/go/bgn/radarmbg/ui/screens/MenuScreen.kt`

       `Scaffold` with `TopAppBar(title = stringResource(R.string.menu_judul))`.
       `LaunchedEffect(Unit)` calls `menuViewModel.loadMenu()`.
       Body: `Column`. Filter chips: `LazyRow` of `FilterChip` — "Semua" always first, then
       `kotaList` items. Selection calls `menuViewModel.filterByKota(kota)`.
       `LazyColumn` of `MenuCard(menu)` items from `filtered`.
       Empty state: `Box` centered with Text `stringResource(R.string.menu_empty)`.
       Loading and error states handled the same as HomeScreen.
       Verify: subsequent build check.

- [ ] 25. Create `PetaScreen.kt`
       File: `android/app/src/main/java/id/go/bgn/radarmbg/ui/screens/PetaScreen.kt`

       Wilayah data class (local to file):
       ```kotlin
       data class Wilayah(val label: String, val lat: Double, val lon: Double, val zoom: Double)
       val wilayahList = listOf(
           Wilayah("Seluruh Indonesia", -2.5, 118.0, 5.0),
           Wilayah("DKI Jakarta", -6.2, 106.816667, 12.0),
           Wilayah("Jawa Barat", -6.9, 107.6, 9.0),
           Wilayah("Jawa Tengah", -7.15, 110.1, 9.0),
           Wilayah("Jawa Timur", -7.75, 112.5, 9.0)
       )
       ```

       `Scaffold` with TopAppBar. Body: `Column`. Top: `ExposedDropdownMenuBox` for wilayah
       selection (state: `var selectedWilayah by remember { mutableStateOf(wilayahList[0]) }`).

       OSMDroid map:
       ```kotlin
       AndroidView(
           factory = { ctx ->
               MapView(ctx).apply {
                   setTileSource(TileSourceFactory.MAPNIK)
                   setMultiTouchControls(true)
                   controller.setZoom(selectedWilayah.zoom)
                   controller.setCenter(GeoPoint(selectedWilayah.lat, selectedWilayah.lon))
                   // Add SPPG markers (green) from distribusi data
                   // Add 3 van markers (blue) with initial positions
               }
           },
           update = { mapView ->
               mapView.controller.animateTo(
                   GeoPoint(selectedWilayah.lat, selectedWilayah.lon),
                   selectedWilayah.zoom.toLong(), 1000L
               )
           },
           modifier = Modifier.fillMaxSize().weight(1f)
       )
       ```
       Province approximate coordinates map (for markers):
       DKI Jakarta (-6.2, 106.82), Jawa Barat (-6.9, 107.6), Jawa Tengah (-7.15, 110.1),
       Jawa Timur (-7.75, 112.5), Bali (-8.34, 115.09), Sumatera Utara (2.07, 99.33),
       Sulawesi Selatan (-5.0, 120.0), Kalimantan Timur (0.0, 117.0).

       Van markers: `var vanPositions by remember { mutableStateOf(listOf(GeoPoint(-6.2, 106.82), GeoPoint(-7.0, 107.5), GeoPoint(-7.6, 112.4))) }`.
       `LaunchedEffect(Unit) { while(true) { delay(3000); vanPositions = vanPositions.map { GeoPoint(it.latitude + (Random.nextDouble() - 0.5) * 0.05, it.longitude + (Random.nextDouble() - 0.5) * 0.05) } } }`.
       In `update` block, clear all van markers and re-add at new positions with blue tint.

       For marker icons, use `Marker` from org.osmdroid. Use `context.getDrawable(R.drawable.ic_location)`
       tinted with `green` for SPPG and `blue` for vans via `DrawableCompat.setTint`.
       Verify: subsequent build check.

- [ ] 26. Create `LaporanScreen.kt`
       File: `android/app/src/main/java/id/go/bgn/radarmbg/ui/screens/LaporanScreen.kt`

       `Scaffold` with TopAppBar. Scrollable body `Column`:

       **Section 1 — Form Aduan:**
       - `OutlinedTextField` for nama, telepon, sekolah, deskripsi (multiline, minLines=3)
       - Role dropdown: `ExposedDropdownMenuBox` with options [Wali Murid, Pengelola SPPG, Lainnya]
       - Kategori dropdown: [Kualitas Makanan, Keterlambatan, Porsi Tidak Sesuai, Kebersihan, Lainnya]
       - Tanggal: `OutlinedTextField` + `IconButton` that shows `DatePickerDialog`
       - Foto: `OutlinedButton` with camera icon. Uses `rememberLauncherForActivityResult(ActivityResultContracts.TakePicture())`.
         Create temp file via `FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", File(context.cacheDir, "images/aduan_${System.currentTimeMillis()}.jpg"))`.
         Show thumbnail if photoUri is set.
       - Submit `ElevatedButton` full width: calls `laporanViewModel.submitLaporan()`.

       **Section 2 — Tiket Tracking** (below `HorizontalDivider`):
       - `OutlinedTextField` for tiket ID + `Button` "Cek Status" calls `laporanViewModel.trackTiket()`
       - Result `AnimatedVisibility` `Card`: shows nomor_tiket, status badge (color-coded),
         kategori, target_sekolah, catatan_satgas.
       Verify: subsequent build check.

- [ ] 27. Create `ProfileScreen.kt`
       File: `android/app/src/main/java/id/go/bgn/radarmbg/ui/screens/ProfileScreen.kt`

       Collect user from `SessionDataStore.getUser(context).collectAsStateWithLifecycle(null)`.
       `Scaffold` with TopAppBar.
       Body `Column(horizontalAlignment = CenterHorizontally)`:
       - Avatar circle 80dp: `Box(Modifier.size(80.dp).clip(CircleShape).background(BgnSecondary))`,
         centered `Text` of `user.full_name.firstOrNull()?.uppercaseChar()?.toString() ?: "U"` in BgnTertiaryFixed 32sp bold.
       - `Text(user.full_name)` headline
       - `SuggestionChip` for role_label
       - `Text(user.username)` with `@` prefix
       - `Spacer(32dp)`
       - `OutlinedButton("Ganti Kata Sandi")`: opens `AlertDialog` with two `OutlinedTextField`
         (kata sandi lama, kata sandi baru). Confirm calls POST `/api/change_password` (use a new
         `suspend fun changePassword(old, new)` in `AuthRepository` calling `ApiClient.instance`
         with `@FormUrlEncoded @POST("api/change_password")`). On error show Snackbar.
       - `ElevatedButton("Keluar", colors red)`: opens confirmation `AlertDialog`. On confirm
         calls `authViewModel.logout()` then `onLogout()`.
       Verify: subsequent build check.

- [ ] 28. Create `NotifikasiScreen.kt`
       File: `android/app/src/main/java/id/go/bgn/radarmbg/ui/screens/NotifikasiScreen.kt`

       `LaunchedEffect(Unit)` calls `notifikasiViewModel.loadNotifikasi()`.
       `Scaffold` + `LazyColumn`:
       - First item (if laporan_masuk_count > 0): summary `Card` "X laporan masuk menunggu tindak lanjut"
       - Then items: for each `LaporanReport` in `latest_reports`, `ElevatedCard` with
         ticket_code bold, reporter_name + school_target, issue_category chip, status badge,
         created_at formatted as date.
       Empty state: centered Box with Text `stringResource(R.string.notif_empty)`.
       Verify: subsequent build check.

- [ ] 29. Replace `MainActivity.kt` — final single-activity NavHost
       File: `android/app/src/main/java/id/go/bgn/radarmbg/MainActivity.kt`

       ```kotlin
       package id.go.bgn.radarmbg

       import android.os.Bundle
       import androidx.activity.ComponentActivity
       import androidx.activity.compose.setContent
       import androidx.activity.enableEdgeToEdge
       import androidx.compose.runtime.Composable
       import androidx.lifecycle.viewmodel.compose.viewModel
       import androidx.navigation.compose.NavHost
       import androidx.navigation.compose.composable
       import androidx.navigation.compose.rememberNavController
       import id.go.bgn.radarmbg.ui.theme.RadarMBGTheme
       import id.go.bgn.radarmbg.viewmodel.AuthViewModel
       // ... other imports

       class MainActivity : ComponentActivity() {
           override fun onCreate(savedInstanceState: Bundle?) {
               super.onCreate(savedInstanceState)
               enableEdgeToEdge()
               setContent {
                   RadarMBGTheme {
                       AppNavigation()
                   }
               }
           }
       }

       @Composable
       fun AppNavigation() {
           val navController = rememberNavController()
           val authViewModel: AuthViewModel = viewModel()

           NavHost(navController = navController, startDestination = "splash") {
               composable("splash") {
                   SplashScreen(
                       onNavigateToHome = {
                           navController.navigate("main") {
                               popUpTo("splash") { inclusive = true }
                           }
                       },
                       onNavigateToLogin = {
                           navController.navigate("login") {
                               popUpTo("splash") { inclusive = true }
                           }
                       },
                       authViewModel = authViewModel
                   )
               }
               composable("login") {
                   LoginScreen(
                       onLoginSuccess = {
                           navController.navigate("main") {
                               popUpTo("login") { inclusive = true }
                           }
                       },
                       onNavigateToRegister = { navController.navigate("register") }
                   )
               }
               composable("register") {
                   RegisterScreen(
                       onRegisterSuccess = {
                           navController.navigate("login") {
                               popUpTo("register") { inclusive = true }
                           }
                       },
                       onNavigateToLogin = { navController.popBackStack() }
                   )
               }
               composable("main") {
                   MainDashboard(
                       onNotificationClick = { navController.navigate("notifikasi") },
                       onProfileClick = { navController.navigate("profile") }
                   )
               }
               composable("notifikasi") { NotifikasiScreen() }
               composable("profile") {
                   ProfileScreen(
                       onLogout = {
                           navController.navigate("login") {
                               popUpTo(0) { inclusive = true }
                           }
                       },
                       authViewModel = authViewModel
                   )
               }
           }
       }

       @Composable
       fun MainDashboard(onNotificationClick: () -> Unit, onProfileClick: () -> Unit) {
           val dashNavController = rememberNavController()
           // currentRoute for selected tab highlighting
           androidx.compose.material3.Scaffold(
               bottomBar = {
                   val navBackStackEntry by dashNavController.currentBackStackEntryAsState()
                   val currentRoute = navBackStackEntry?.destination?.route ?: "home"
                   RadarNavBar(selectedRoute = currentRoute, onNavigate = { route ->
                       dashNavController.navigate(route) {
                           popUpTo(dashNavController.graph.startDestinationId) { saveState = true }
                           launchSingleTop = true
                           restoreState = true
                       }
                   })
               }
           ) { innerPadding ->
               NavHost(
                   navController = dashNavController,
                   startDestination = "home",
                   modifier = androidx.compose.ui.Modifier.padding(innerPadding)
               ) {
                   composable("home") {
                       HomeScreen(
                           onNotificationClick = onNotificationClick,
                           onProfileClick = onProfileClick
                       )
                   }
                   composable("menu") { MenuScreen() }
                   composable("peta") { PetaScreen() }
                   composable("laporan") { LaporanScreen() }
               }
           }
       }
       ```
       Verify: `.\gradlew.bat assembleDebug` → BUILD SUCCESSFUL, APK exists.

---

## Final build verification

```powershell
cd c:\laragon\www\MBG-MONITORING\android
.\gradlew.bat assembleDebug
```

Expected: `BUILD SUCCESSFUL` and APK at:
`android\app\build\outputs\apk\debug\app-debug.apk`

---

## File inventory

### New files to create

| Path | Purpose |
|------|---------|
| `data/api/models/Models.kt` | All data classes |
| `data/api/ApiService.kt` | Retrofit interface |
| `data/api/ApiClient.kt` | OkHttp + Retrofit singleton |
| `data/local/SessionDataStore.kt` | DataStore auth persistence |
| `data/repository/AuthRepository.kt` | Auth API calls |
| `data/repository/DataRepository.kt` | Data API calls |
| `viewmodel/AuthViewModel.kt` | Auth state machine |
| `viewmodel/HomeViewModel.kt` | Home/telemetri state |
| `viewmodel/MenuViewModel.kt` | Menu list + filter |
| `viewmodel/LaporanViewModel.kt` | Form state + tiket tracking |
| `viewmodel/NotifikasiViewModel.kt` | Notifications state |
| `ui/theme/Color.kt` | Brand colors |
| `ui/theme/Type.kt` | Typography |
| `ui/theme/Theme.kt` | RadarMBGTheme composable |
| `ui/components/KpiCard.kt` | KPI display card |
| `ui/components/MenuCard.kt` | Menu item card |
| `ui/components/AppTopBar.kt` | Top bar with notification badge |
| `ui/components/NavBar.kt` | Bottom navigation |
| `ui/screens/SplashScreen.kt` | Splash + session check |
| `ui/screens/LoginScreen.kt` | Login form |
| `ui/screens/RegisterScreen.kt` | Registration form |
| `ui/screens/HomeScreen.kt` | Dashboard + KPIs |
| `ui/screens/MenuScreen.kt` | Menu list + filter |
| `ui/screens/PetaScreen.kt` | OSMDroid map + SPPG markers |
| `ui/screens/LaporanScreen.kt` | Report form + tiket tracking |
| `ui/screens/ProfileScreen.kt` | User profile + logout |
| `ui/screens/NotifikasiScreen.kt` | Notifications list |

All paths above are relative to `android/app/src/main/java/id/go/bgn/radarmbg/`.

### Files to replace
- `android/build.gradle`
- `android/app/build.gradle`
- `android/app/src/main/AndroidManifest.xml`
- `android/app/src/main/res/values/strings.xml` (append, not replace)
- `android/app/src/main/java/id/go/bgn/radarmbg/MainActivity.kt`

### Files to delete
- `android/app/src/main/res/layout/activity_main.xml`
- `android/app/src/main/res/layout/activity_splash.xml`
- `android/app/src/main/res/layout/dialog_school_picker.xml`
- `android/app/src/main/res/layout/item_menu_card.xml`
- `android/app/src/main/java/id/go/bgn/radarmbg/SplashActivity.kt`
