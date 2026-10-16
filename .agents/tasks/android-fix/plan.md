# Implementation Plan — android-fix

## Context

**Root cause of HTTP 500:** The Android app calls `https://mbg.jack-ai.my.id/api/telemetri`, `api/distribusi`, `api/menu` etc. Those are Cloudflare Pages Functions that fail at build time because they try to import `@neondatabase/serverless` from the Pages environment (which can't resolve npm packages). The auth worker (`mbg-auth.aqsholhalqi4.workers.dev`) already works because it's a standalone Worker deployed via `wrangler deploy`. The fix is the same pattern: give `data.js` and `menu.js` their own wrangler configs and deploy them as standalone Workers.

**Note on workers/menu.js:** It EXISTS and uses raw `fetch()` to Neon's HTTP API (no npm import). It handles `GET /api/menu` with `SESSIONS` and `MENU_CACHE` KV bindings plus `DATABASE_URL` secret.

**Note on workers/data.js:** It uses only KV (`env.DATA`, `env.SESSIONS`) — no npm import needed. Just needs its own wrangler config.

---

## FEAT-001 — Deploy standalone Workers for data and menu APIs

- [ ] 1. Create `workers/wrangler-data.toml`
      Name `mbg-data`, main `data.js`, bind DATA (id `85539fc16a9b49558ef198e7fab116d4`) and SESSIONS (id `2e12b6cbb1e64ab0a7d03ba739ada7de`) KV namespaces. No DATABASE_URL needed.
      Files: `workers/wrangler-data.toml`
      Verify: `npx wrangler deploy --config wrangler-data.toml` from `workers/` — output contains 'Deployed'.

- [ ] 2. Create `workers/wrangler-menu.toml`
      Name `mbg-menu`, main `menu.js`, bind SESSIONS (id `2e12b6cbb1e64ab0a7d03ba739ada7de`) and MENU_CACHE (id `446e89c787a64c2c868e3a54c2025de8`) KV namespaces. Add cron trigger `5 17 * * *`. DATABASE_URL must be set as a Wrangler secret for this worker (`npx wrangler secret put DATABASE_URL --config wrangler-menu.toml`).
      Files: `workers/wrangler-menu.toml`
      Verify: `npx wrangler deploy --config wrangler-menu.toml` from `workers/` — output contains 'Deployed'.

---

## FEAT-002 — Android data layer: point at standalone Workers

- [ ] 3. Create `DataApiService.kt`
      New Retrofit interface with `@GET("/")` methods for telemetri (`?type=telemetri`) and distribusi (`?type=distribusi`) matching `workers/data.js`'s `type` query param API.
      Files: `android/app/src/main/java/id/go/bgn/radarmbg/data/api/DataApiService.kt`
      Verify: Build step below.

- [ ] 4. Create `MenuApiService.kt`
      New Retrofit interface with `@GET("/")` `getMenu(@Query("date") date: String? = null): MenuWrapper`.
      Files: `android/app/src/main/java/id/go/bgn/radarmbg/data/api/MenuApiService.kt`
      Verify: Build step below.

- [ ] 5. Update `ApiClient.kt`
      Add `DATA_WORKER_URL` and `MENU_WORKER_URL` constants (worker URLs from FEAT-001 deploy output). Add `dataInstance: DataApiService` and `menuInstance: MenuApiService` lazy vals reusing the existing OkHttpClient.
      Files: `android/app/src/main/java/id/go/bgn/radarmbg/data/api/ApiClient.kt`
      Verify: Build step below.

- [ ] 6. Update `DataRepository.kt`
      Switch `getTelemetri()` → `ApiClient.dataInstance.getTelemetri().data`, `getDistribusi()` → `ApiClient.dataInstance.getDistribusi().data`, `getMenu()` → `ApiClient.menuInstance.getMenu().data`. Leave other methods (notifications, tiket, chat) on `ApiClient.instance`.
      Files: `android/app/src/main/java/id/go/bgn/radarmbg/data/repository/DataRepository.kt`
      Verify: Build step below.

- [ ] 7. Update `strings.xml` with all new string resources
      Add keys for DashboardScreen tiles, ProfileScreen nav cards, AdminPanelScreen labels (full list in FEAT-002 step 6 and FEAT-003 steps 2-3).
      Files: `android/app/src/main/res/values/strings.xml`
      Verify: `cd android; .\gradlew.bat assembleDebug` — BUILD SUCCESSFUL.

---

## FEAT-003 — DashboardScreen, AdminPanelScreen, ProfileScreen nav cards, build & release

- [ ] 8. Create `DashboardScreen.kt`
      Role-based tiles in a 2-column grid. Admin (5 tiles): KPI Nasional, Manajemen Akun, Status SPPG, Backup Menu, Log Keamanan. SPPG (3 tiles): Input Menu Harian, Profil Dapur, Laporan Distribusi. User (3 tiles): Status Laporan, Menu Sekolah Anak, Kontak Satgas. Enabled tiles: BgnPrimaryContainer background, White text. Disabled tiles: BgnBackground, BgnOnSurfaceVariant + "Segera Hadir" subtitle. All text via stringResource().
      Files: `android/app/src/main/java/id/go/bgn/radarmbg/ui/screens/DashboardScreen.kt`
      Verify: Build step below.

- [ ] 9. Create `AdminPanelScreen.kt`
      Native composable with TopAppBar + back button. Shows icon, title, description, and OutlinedButton that opens `https://mbg.jack-ai.my.id/dashboard/admin/` via Intent. No WebView complexity.
      Files: `android/app/src/main/java/id/go/bgn/radarmbg/ui/screens/AdminPanelScreen.kt`
      Verify: Build step below.

- [ ] 10. Update `ProfileScreen.kt`
       Add `onNavigateToDashboard` and `onNavigateToAdminPanel` lambda params. Insert nav cards section above the action buttons: "Buka Dashboard" (always), "Panel Admin" (admin role only), "Laporan & Aduan" (always). Each card: ElevatedCard with leading icon, title, ChevronRight trailing icon.
       Files: `android/app/src/main/java/id/go/bgn/radarmbg/ui/screens/ProfileScreen.kt`
       Verify: Build step below.

- [ ] 11. Update `MainActivity.kt`
       Add `dashboard` and `admin_panel` composable routes to the outer NavHost. Update the `profile` composable to pass `onNavigateToDashboard` and `onNavigateToAdminPanel` lambdas to ProfileScreen.
       Files: `android/app/src/main/java/id/go/bgn/radarmbg/MainActivity.kt`
       Verify: `cd android; .\gradlew.bat assembleDebug` — BUILD SUCCESSFUL, APK at `android\app\build\outputs\apk\debug\Radar-MBG-V2.apk`.

- [ ] 12. Commit all changes
       Stage all modified/created files. Commit: `feat: data workers + DashboardScreen + ProfileScreen nav cards + fix HTTP 500`.
       Verify: `git log --oneline -1` shows the commit.

- [ ] 13. Push and create GitHub release
       `git push origin main`. Tag: `git tag v2.1.0; git push origin v2.1.0`. Release: `gh release create v2.1.0 android/app/build/outputs/apk/debug/Radar-MBG-V2.apk --title 'Radar MBG v2.1.0' --notes '...'`.
       Verify: `gh release view v2.1.0` — release listed with APK asset.
