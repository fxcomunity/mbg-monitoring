# Implementation Plan — MBG-MONITORING Full Overhaul

> Generated from exploration of `c:\laragon\www\MBG-MONITORING`  
> Stack: PHP 8+ on Apache/Laragon, Neon PostgreSQL, Tailwind CSS (CDN), Leaflet.js, vanilla JS.  
> Deployment: static files + PHP API tier served by Laragon locally, production on Cloudflare Pages + Workers.

---

## Part 1 — Database Cleanup (Neon PostgreSQL)

### Background findings
- `.env` confirms `DATABASE_URL=postgresql://neondb_owner:npg_KeaS1c4jMAiY@ep-green-snow-b565oin5-pooler...`
- `database/db.php` parses `DATABASE_URL` into a PDO singleton via `getDB()`.
- `database/schema_sppg.sql` shows the `sppg` table has columns: `source` (TEXT), `data_bulan` (TEXT), `source_key` (UNIQUE).
- `dataset_sppg/` folder exists for a legacy scrape pipeline — user wants this wiped from DB.
- The 30,231-row MBGWatch dataset must NOT be touched (`source = 'MBGWatch'` based on schema comments).

---

- [ ] 1. Create `database/scripts/cleanup.php` — safe database cleanup script.

  **What to do:** Write a PHP script that:
  1. Loads `.env` via `database/env.php` + `database/db.php` (reuse existing `getDB()`).
  2. Counts rows BEFORE in `sppg` table (total, by source).
  3. Asks for a confirmation token (`?confirm=YES_DELETE` in URL or CLI arg) before any DELETE.
  4. Runs `DROP TABLE IF EXISTS dataset_sppg CASCADE` (this table may not exist in Neon — the `DROP IF EXISTS` makes it safe).
  5. Deletes from `sppg` where `source ILIKE '%BGN%' OR source ILIKE '%Maret%' OR data_bulan ILIKE '%2025%'` — excluding `source = 'MBGWatch'` explicitly with `AND source != 'MBGWatch'`.
  6. Counts rows AFTER and prints a diff report in JSON.
  7. Never touches rows where `source = 'MBGWatch'`.

  **Files:** `database/scripts/cleanup.php` (new)

  **Exact SQL inside the script:**
  ```sql
  -- Step A: Check dataset_sppg table
  DROP TABLE IF EXISTS dataset_sppg CASCADE;

  -- Step B: Count before
  SELECT COUNT(*) FROM sppg;
  SELECT source, COUNT(*) FROM sppg GROUP BY source;

  -- Step C: Delete non-MBGWatch 2025/BGN-Maret rows
  DELETE FROM sppg
  WHERE source != 'MBGWatch'
    AND (source ILIKE '%BGN%' OR data_bulan ILIKE '%2025%' OR data_bulan ILIKE '%Maret%');

  -- Step D: Count after
  SELECT COUNT(*) FROM sppg;
  SELECT source, COUNT(*) FROM sppg GROUP BY source;
  ```

  **How to run safely:**
  - Open browser: `http://localhost/MBG-MONITORING/database/scripts/cleanup.php?confirm=YES_DELETE`
  - Without `?confirm=YES_DELETE`, the script only shows preview (no deletions).
  - Review the output JSON before confirming.

  **Files:** `database/scripts/cleanup.php`  
  **Verify:** Open `http://localhost/MBG-MONITORING/database/scripts/cleanup.php` (no confirm param) — outputs row counts without deleting. Then add `?confirm=YES_DELETE` to execute.

---

## Part 2 — HTTP 500 Fix: Menu Hari Ini

### Root cause analysis from code reading

`fitur/menu-hari-ini.html` calls `api/menu.php` (via relative path `api/menu.php` from the `fitur/` subfolder — this resolves as `fitur/api/menu.php` which does NOT exist). The HTML file is served from `fitur/` but the fetch calls go to `api/menu.php` (without leading slash or `../`).

Additionally, `api/menu.php` itself queries tables that may not exist in the Neon DB (`instansi`, `provinsi`, `kabupaten_kota`, `kecamatan`, `gizi_menu`, `gambar_menu`, `menu_harian`) — these are defined in a schema that may not have been applied to Neon, causing SQL errors → PHP `Throwable` → HTTP 500.

`api/telemetri.php` and `api/distribusi.php` lack the required `require_once __DIR__ . '/../database/db.php'` at the top — they call `getDB()` but only work when included via `api/index.php` which loads `db.php` first. Called directly (e.g., `fetch('api/telemetri.php')`), they 500.

---

- [ ] 2. Fix relative API path in `fitur/menu-hari-ini.html`.

  **What to do:** The fetch calls inside `menu-hari-ini.html` use paths like `api/telemetri.php` and `api/menu.php`. From `fitur/`, these must be `../api/telemetri.php` and `../api/menu.php`. Search for all `fetch('api/` and `fetch("api/` occurrences in `fitur/menu-hari-ini.html` and prefix them with `../`.

  **Files:** `fitur/menu-hari-ini.html`  
  **Verify:** Open `http://localhost/MBG-MONITORING/fitur/menu-hari-ini.html` in browser, open DevTools Network tab — no 404/500 on API calls.

- [ ] 3. Add `require_once` guards to standalone API files.

  **What to do:** `api/telemetri.php`, `api/distribusi.php`, `api/notifications.php`, `api/juknis.php` call `getDB()` but do not load `db.php` themselves (they rely on `api/index.php` to load it first). Add at the top of each:
  ```php
  if (!function_exists('getDB')) {
      require_once __DIR__ . '/../database/db.php';
  }
  ```
  This makes them safe for direct HTTP calls AND for `require` inclusion.

  **Files:** `api/telemetri.php`, `api/distribusi.php`, `api/notifications.php`, `api/juknis.php`  
  **Verify:** `curl http://localhost/MBG-MONITORING/api/telemetri.php` returns `{"status":"success",...}` not a 500.

- [ ] 4. Add graceful empty-data fallback to `api/menu.php`.

  **What to do:** The `menu.php` query joins `instansi`, `menu_harian`, `gizi_menu` etc. If these tables are empty (no menu data for today), the `all_schools` branch returns `schools: {}` with 0 results — which is correct. However, if the tables themselves **don't exist**, PDO throws, causing 500. Add a `try/catch` around the DISTINCT ON query and return `{"status":"success","source":"empty","schools":{},"region_cascade":{}}` on `PDOException` with code `42P01` (undefined table). The outer `catch (Throwable $e)` already exists but returns 500 — change it to return 200 with an empty payload and log the error.

  **Files:** `api/menu.php`  
  **Verify:** Access `http://localhost/MBG-MONITORING/api/menu.php?all_schools=1` — returns HTTP 200 with JSON (even if empty).

- [ ] 5. Fix `fitur/distribusi-sebaran-sppg.html` and `fitur/laporan-aduan.html` API paths.

  **What to do:** Same relative-path bug as menu-hari-ini. Search all `fetch('api/` and `fetch("api/` in both files and prepend `../`. Also fix `src="../assets/js/script.js"` references — ensure all script/link hrefs in `fitur/*.html` use `../` prefix.

  **Files:** `fitur/distribusi-sebaran-sppg.html`, `fitur/laporan-aduan.html`, `fitur/standar-uji-akg.html`  
  **Verify:** Open each page in browser — no 404/500 in Network tab.

---

## Part 3 — UI/UX Overhaul

### 3A — Login Page: Video Background

**Finding:** `auth/login.html` already has a fullscreen `<video>` tag pointing to `https://res.cloudinary.com/dgenxagit/video/upload/v1791923878/gemini_generated_video_22b0321d.mp4`. The video URL is an external Cloudinary URL. `assets/videos/` folder exists but contains only `.gitkeep` — no local video file.

Strategy: Keep the Cloudinary URL (it works). Add a CSS animated gradient fallback in case the video fails to load (slow connection or blocked). Also add `<noscript>` gradient fallback.

---

- [ ] 6. Add CSS animated gradient fallback to login video background.

  **What to do:** In `auth/login.html`, add an `onerror` handler on the `<video>` that activates the fallback, and add a CSS keyframe animation. The gradient cycles through `#001026 → #0b2545 → #001a3d → #001026` using `background: linear-gradient(135deg, ...)` with `animation: bgShift 8s ease infinite`.

  **Files:** `auth/login.html`  
  **Verify:** Temporarily break the video src URL, reload page — background shows animated dark gradient instead of blank.

### 3B — Dashboard Hero Banner with Video

**Finding:** `index.html` already has a `<video autoplay loop muted playsinline>` in the hero section pointing to the same Cloudinary URL. The existing video is already in place — just needs `preload="auto"` (currently `preload="none"`) and a `poster` fallback image.

- [ ] 7. Improve hero video performance in `index.html`.

  **What to do:** Change `preload="none"` to `preload="metadata"` on the hero video element in `index.html`. Add `poster="../assets/images/og-preview.png"` so the fallback image shows while video loads. Add same animated gradient fallback CSS.

  **Files:** `index.html`  
  **Verify:** Load `index.html` — hero section shows poster image immediately, then transitions to video.

### 3C — Distribusi per Provinsi: Interactive Province Modal

**Finding:** `index.html` has a "Status Penyaluran Regional Indonesia" section with province rows built from `api/distribusi.php`. Each province row is a static `<div>` — no click handler. The user wants clicking a province to open a modal showing SPPG list for that province.

New endpoint `api/sppg_provinsi.php` is needed.

- [ ] 8. Create `api/sppg_provinsi.php` — SPPG list by province.

  **What to do:** Create a new PHP API endpoint:
  - Accepts `?provinsi=<nama_provinsi>` (string match against `sppg.provinsi` column, case-insensitive).
  - Queries `sppg` table: `SELECT id, nama, provinsi, kabupaten_kota, kecamatan, alamat, latitude, longitude, status FROM sppg WHERE provinsi ILIKE ? ORDER BY kabupaten_kota, nama LIMIT 500`.
  - Returns JSON: `{status, provinsi, count, data: [{id, nama, kabupaten_kota, kecamatan, alamat, latitude, longitude, status}]}`.
  - Includes `require_once __DIR__ . '/../database/db.php'` and `require_once __DIR__ . '/../database/security.php'`.
  - Add `Cache-Control: public, max-age=300` header.

  **Files:** `api/sppg_provinsi.php` (new)  
  **Verify:** `curl "http://localhost/MBG-MONITORING/api/sppg_provinsi.php?provinsi=BALI"` returns JSON array of SPPG.

- [ ] 9. Add province click → SPPG modal to `index.html`.

  **What to do:** In `index.html`'s distribution table section (the `#tableRegionalBody` rows), add a `data-provinsi` attribute to each rendered province row. Add a click listener in `assets/js/script.js` that:
  1. Calls `api/sppg_provinsi.php?provinsi=<name>`.
  2. Opens a modal overlay (use existing Tailwind classes for consistency: `fixed inset-0 bg-black/60 z-50 flex items-center justify-center`).
  3. Inside the modal: province name header, scrollable list of SPPG cards (nama, kabupaten_kota, alamat, status badge).
  4. A "Lihat di Peta" link that opens `map/?provinsi=<name>`.

  **Files:** `index.html` (add modal HTML skeleton at bottom of body), `assets/js/script.js` (add `initProvinsiModal()` function called from `DOMContentLoaded`)  
  **Verify:** Click "Jakarta" row → modal opens with SPPG list.

### 3D — Peta SPPG: MarkerCluster for 30K Points

**Finding:** `map/index.html` fetches `/api/data?type=sppg` (a Cloudflare Worker endpoint) and renders markers. For 30K points Leaflet needs MarkerCluster. The file uses no clustering currently. The local PHP equivalent is `api/sppg_map.php`.

- [ ] 10. Create `api/sppg_map.php` — optimized map data endpoint.

  **What to do:** Create new PHP endpoint:
  - Accepts optional `?provinsi=<code>`, `?bbox=<minlat,minlng,maxlat,maxlng>`, `?limit=<n>` (default 5000, max 30000).
  - Queries `sppg` table: `SELECT id, nama, provinsi, kabupaten_kota, latitude, longitude, status FROM sppg WHERE latitude IS NOT NULL AND longitude IS NOT NULL`.
  - Adds bbox filter if provided: `AND latitude BETWEEN $minlat AND $maxlat AND longitude BETWEEN $minlng AND $maxlng`.
  - Returns GeoJSON-compatible JSON: `{type:"FeatureCollection", count: N, features: [{type:"Feature", geometry:{type:"Point", coordinates:[lng,lat]}, properties:{id, nama, provinsi, kabupaten_kota, status}}]}`.
  - Add `Cache-Control: public, max-age=60` (map data refreshes per minute).

  **Files:** `api/sppg_map.php` (new)  
  **Verify:** `curl "http://localhost/MBG-MONITORING/api/sppg_map.php"` returns GeoJSON FeatureCollection with features array.

- [ ] 11. Add Leaflet.MarkerCluster to `map/index.html`.

  **What to do:**
  1. Add MarkerCluster CDN links in `<head>`:
     ```html
     <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css"/>
     <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"/>
     <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
     ```
  2. Replace the existing `loadSppgData()` function (which fetches from `/api/data?type=sppg` Worker) to fall back to `/api/sppg_map.php` when the Worker is unavailable.
  3. Use `L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 60 })` to hold all markers.
  4. On marker click popup: show SPPG nama, kabupaten_kota, status badge.

  **Files:** `map/index.html`  
  **Verify:** Open `http://localhost/MBG-MONITORING/map/` — markers cluster visually, clicking a cluster expands it, clicking a marker shows popup.

### 3E — KPI Cards: Fix Broken Endpoints

**Finding:** Dashboard KPI cards in `dashboard/admin/index.html` fetch from endpoints. `api/telemetri.php` and `api/distribusi.php` are broken for direct calls (missing `require_once db.php` — fixed in item 3). The `panel.html` fetches from `/api/data?type=sppg_status` and `/api/security/threats` which are Cloudflare Worker endpoints not available locally.

- [ ] 12. Add local PHP fallback endpoints for `sppg_status` and `security/threats`.

  **What to do:** Create `api/sppg_status.php`:
  - Queries `sppg` table: `SELECT status, COUNT(*) FROM sppg GROUP BY status`.
  - Maps to `{data: [{name, city, status, cert_expiry, capacity, last_menu}]}` format matching what `panel.html`'s `renderSppgTable()` expects.
  - Returns top 100 SPPG rows with their operational status.

  Create `api/security_threats.php`:
  - Queries `exploit_logs` table: `SELECT ip_address as ip, exploit_type as type, requested_url as url, created_at as ts FROM exploit_logs ORDER BY created_at DESC LIMIT 50`.
  - Returns `{data: [{type, ip, country, url, ts}]}`.

  Update `dashboard/admin/panel.html` to replace `/api/data?type=sppg_status` with `../../api/sppg_status.php` and `/api/security/threats` with `../../api/security_threats.php`.

  **Files:** `api/sppg_status.php` (new), `api/security_threats.php` (new), `dashboard/admin/panel.html`  
  **Verify:** Open `http://localhost/MBG-MONITORING/dashboard/admin/panel.html` while logged in as admin — SPPG status table and security log load data (or show fallback gracefully).

### 3F — Broken Buttons: Backup Menu & Log Keamanan

**Finding:** In `dashboard/admin/index.html`, the "Backup Menu" section uses SheetJS (xlsx) to download data from localStorage. The button exists but `dashboard-common.js` handles the backup download via `downloadBackupXLSX()`. This function calls `window.XLSX` (SheetJS CDN). The `<script src="https://cdn.sheetjs.com/...">` tag may be missing or broken.

The "Log Keamanan" button in `dashboard/admin/index.html` links to `#security-log` anchor — this section exists in `panel.html` but NOT in `admin/index.html`. Fix: The anchor should redirect to `panel.html#security-log`.

- [ ] 13. Fix Backup Menu button and add SheetJS CDN.

  **What to do:** In `dashboard/admin/index.html`, search for the SheetJS CDN `<script>` tag. If missing, add:
  ```html
  <script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"></script>
  ```
  This enables the `window.XLSX` object that `dashboard-common.js` uses for Excel export. Also verify that the `#menu-backup-panel` section in `index.html` has its download button wired to `dashboard-common.js`'s `downloadBackupXLSX()` function.

  **Files:** `dashboard/admin/index.html`  
  **Verify:** Click "Backup Menu" → browser downloads an `.xlsx` file (even if empty, the download triggers without error).

- [ ] 14. Fix "Log Keamanan" navigation in `dashboard/admin/index.html`.

  **What to do:** The "Log Keamanan" anchor `<a href="#security-log">` in `dashboard/admin/index.html` points to a section that doesn't exist in that file (it's in `panel.html`). Change it to `href="panel.html#security-log"`.

  **Files:** `dashboard/admin/index.html`  
  **Verify:** Click "Log Keamanan" button → navigates to `panel.html#security-log`.

### 3G — Performance

- [ ] 15. Add `Cache-Control` headers and lazy loading to all API files.

  **What to do:**
  - Add `Cache-Control: public, max-age=300` to `api/distribusi.php` (data changes infrequently).
  - Add `loading="lazy"` attribute to all `<img>` tags in dashboard HTML files.
  - In `index.html` hero video, change `preload="none"` to `preload="metadata"` (done in item 7).
  - Add `fetchpriority="high"` to the `<video>` element in `auth/login.html`.

  **Files:** `api/distribusi.php`, `dashboard/admin/index.html`, `dashboard/sppg/index.html`, `dashboard/user/index.html`  
  **Verify:** Chrome DevTools Lighthouse performance score — no render-blocking requests from images.

---

## Part 4 — Consistency Across All Pages

### Pages needing header/footer/color consistency

| Page | Current Issues |
|------|----------------|
| `fitur/menu-hari-ini.html` | Missing `<script src="../assets/js/script.js">` tag — notification bell JS doesn't load |
| `fitur/distribusi-sebaran-sppg.html` | Same missing script.js |
| `fitur/laporan-aduan.html` | Same missing script.js |
| `fitur/standar-uji-akg.html` | Same missing script.js |
| `dashboard/admin/index.html` | Header uses `bg-primary` (dark navy) — consistent |
| `dashboard/sppg/index.html` | Header uses `bg-white/95` — inconsistent with admin |
| `dashboard/user/index.html` | Header uses `bg-white/95` — inconsistent with admin |
| `auth/login.html` | No footer — consistent with design intent |

- [ ] 16. Add missing `script.js` to all `fitur/*.html` pages.

  **What to do:** In each of `fitur/menu-hari-ini.html`, `fitur/distribusi-sebaran-sppg.html`, `fitur/laporan-aduan.html`, `fitur/standar-uji-akg.html`, search for `</body>` and add before it:
  ```html
  <script src="../assets/js/script.js"></script>
  ```
  Also add the `security.css` and `security.js` references where missing.

  **Files:** `fitur/menu-hari-ini.html`, `fitur/distribusi-sebaran-sppg.html`, `fitur/laporan-aduan.html`, `fitur/standar-uji-akg.html`  
  **Verify:** Open any fitur page — notification bell shows badge count, mobile nav hamburger works.

- [ ] 17. Standardize dashboard headers across sppg and user dashboards.

  **What to do:** `dashboard/sppg/index.html` and `dashboard/user/index.html` use a light `bg-white/95` header. Update them to use `bg-primary text-white` (consistent with admin). Change logo text color to white, button backgrounds to `bg-white/10`.

  **Files:** `dashboard/sppg/index.html`, `dashboard/user/index.html`  
  **Verify:** Open each dashboard — header matches admin dashboard dark navy style.

- [ ] 18. Standardize the navigation link set across all public pages.

  **What to do:** All public-facing pages (`index.html`, `fitur/*.html`) use the same nav component. The `map/index.html` has a custom minimal header. Add a "← Beranda" back-link to `map/index.html`'s topbar (it already has one, but make it consistent: `href="../index.html"`). Verify nav link to `map/` is present in `index.html` (it is, with the pulse dot).

  **Files:** `map/index.html`  
  **Verify:** All nav links in all public pages are consistent, no broken hrefs.

---

## Execution Order & Dependencies

```
Items 2,3,4,5 (HTTP 500 fixes) → FIRST (nothing else works without these)
Item 1 (DB cleanup)            → SECOND (run manually after fixes, irreversible)
Items 6,7 (Video/login)        → Any order after Item 2
Items 8,9 (Province modal)     → Item 8 before Item 9
Items 10,11 (Map cluster)      → Item 10 before Item 11
Items 12,13,14 (Dashboard)     → After Item 3
Items 15,16,17,18 (Polish)     → Last, no dependencies
```
