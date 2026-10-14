# Implementation Plan — MBG Monitoring Major Restructure

## Codebase Facts (from exploration)

### Files confirmed at root (to be moved to `fitur/`)
- `kebijakan-privasi.html` ✓ exists
- `laporan-aduan.html` ✓ exists  
- `menu-hari-ini.html` ✓ exists
- `standar-uji-akg.html` ✓ exists
- `distribusi-sebaran-sppg.html` ✓ exists

### Files confirmed at root (auth/)
- `login.html` ✓ exists at root — full HTML auth page with login + register tabs
- `auth/login.php` ✓ still exists (PHP file, unused on Cloudflare Pages — to be deleted)
- `auth/logout.php` ✓ still exists (PHP file, unused — to be deleted)

### Dashboard auth guard findings
All 3 dashboards embed an inline `<script>` that:
1. Reads `mbg_session` from sessionStorage/localStorage
2. Falls back to `fetch('../../api/auth_user.php', ...)` — this PHP fetch will always fail on CF Pages
3. On fetch failure → redirects to `../../login.html`
The fallback already goes to `login.html`. After moving login to `auth/login.html`, both the session check redirect AND the `a[href$="login.html"]` click listener must be updated to `../../auth/login.html`.

### Demo references found
- All 3 dashboards: `Mode demo statis — perubahan tidak disimpan ke database.` toast on every non-skipped form submit
- `dashboard/sppg/index.html`: `<strong>SPPG Demo</strong>` (navbar Unit label AND h1 heading)
- `dashboard/user/index.html`: `<strong>Wali Murid Demo</strong>` (navbar welcome AND input default value)
- `dashboard/admin/index.html`: `Admin Satgas BGN` (hardcoded in navbar span — this is acceptable, not a demo label)
- `login.html` line 431: fallback creates session with `demo: true`
- `assets/js/script.js` line 252: `href="login.html"` in renderEmptyState
- `assets/js/script.js` line 80: `href='menu-hari-ini.html'` in global search

### Current `_redirects`
Points `/login.php`, `/auth/login.php`, `/register.php`, etc. → `/login.html`. After moving login, these must point to `/auth/login.html`.

### `assets/js/api.js`
Uses `window.location.pathname.includes('/features/')` to compute `BASE_URL`. After moving fitur files to `/fitur/` (not `/features/`), this path-based detection is irrelevant (Workers will handle `/api/*`). BASE_URL needs to become `/api/`.

### Existing `404.html` at root
Full standalone styled page — references `assets/css/style.css` and `assets/images/logo.webp` with root-relative paths. The new `error/` pages must mirror this design. The root `404.html` stays (for root-level Cloudflare 404), but we also add `error/404.html` for the `_redirects` 404 rule.

---

## Ordered Implementation Steps

- [ ] 1. **Create `fitur/` folder and move 5 root HTML pages into it.**
      Copy each file to `fitur/`, then delete the originals. Update every internal path in each moved file:
      - `assets/` → `../assets/`
      - `href="index.html"` → `href="../index.html"`
      - `href="login.html"` → `href="../auth/login.html"`
      - `href="laporan-aduan.html"` → `href="laporan-aduan.html"` (sibling in same folder — no change for internal cross-links)
      - `href="menu-hari-ini.html"` → `href="menu-hari-ini.html"` (sibling)
      - `href="standar-uji-akg.html"` → `href="standar-uji-akg.html"` (sibling)
      - `href="distribusi-sebaran-sppg.html"` → `href="distribusi-sebaran-sppg.html"` (sibling)
      - `href="kebijakan-privasi.html"` → `href="kebijakan-privasi.html"` (sibling)
      Files: `fitur/kebijakan-privasi.html`, `fitur/laporan-aduan.html`, `fitur/menu-hari-ini.html`, `fitur/standar-uji-akg.html`, `fitur/distribusi-sebaran-sppg.html`
      Verify: Open each file in a browser — logo, CSS, and all nav links resolve correctly.

- [ ] 2. **Move `login.html` (root) → `auth/login.html`; delete `auth/login.php` and `auth/logout.php`.**
      Copy `login.html` to `auth/login.html`. Update internal paths in `auth/login.html`:
      - `href="assets/..."` → `href="../assets/..."`
      - `src="assets/..."` → `src="../assets/..."`
      - `href="index.html"` → `href="../index.html"`
      - `href="laporan-aduan.html"` → `href="../fitur/laporan-aduan.html"`
      - `href="kebijakan-privasi.html"` → `href="../fitur/kebijakan-privasi.html"`
      - The two `fetch('api/auth_user.php', ...)` calls → `fetch('/api/auth', ...)`
      - The session fallback redirect: `window.location.href = 'dashboard/' + role + '/'` → `window.location.href = '../dashboard/' + role + '/'`
      - The session-already-active redirect in head script: `location.replace('dashboard/' + s.role + '/')` → `location.replace('../dashboard/' + s.role + '/')`
      - The inline `demo: true` in the catch block fallback → remove the `demo: true` property entirely
      Delete `auth/login.php`, `auth/logout.php` (PHP files never run on CF Pages).
      Files: `auth/login.html` (create), `auth/login.php` (delete), `auth/logout.php` (delete)
      Verify: Navigate to `/auth/login.html` — page loads with correct logo/CSS; tabs switch correctly.

- [ ] 3. **Create `auth/register.html` as standalone register page.**
      Extract the register tab HTML from `auth/login.html` into a full standalone page. Same design (dark navy background, glass card, same Tailwind config). Page should auto-redirect to `../dashboard/<role>/` if session exists. The register form submits to `fetch('/api/auth', {action:'register',...})`.
      Files: `auth/register.html` (create)
      Verify: Navigate to `/auth/register.html` — form renders, all tabs/fields work.

- [ ] 4. **Update `_redirects` with new paths for moved files.**
      Replace existing PHP→login.html redirects with PHP→/auth/login.html. Add 301s for all moved fitur pages. Add error page rules at the bottom.
      Exact new rules to add/replace:
      ```
      # Auth redirects (login moved to /auth/)
      /login.php             /auth/login.html          301
      /login.html            /auth/login.html          301
      /login                 /auth/login.html          301
      /auth/login.php        /auth/login.html          301
      /register.php          /auth/register.html       301
      /auth/register.php     /auth/register.html       301
      /features/login.php    /auth/login.html          301
      /pages/login.php       /auth/login.html          301
      /auth/logout.php       /auth/login.html?logout=1 301

      # Fitur page redirects (old root paths)
      /kebijakan-privasi.html   /fitur/kebijakan-privasi.html   301
      /laporan-aduan.html       /fitur/laporan-aduan.html       301
      /menu-hari-ini.html       /fitur/menu-hari-ini.html       301
      /standar-uji-akg.html     /fitur/standar-uji-akg.html     301
      /distribusi-sebaran-sppg.html /fitur/distribusi-sebaran-sppg.html 301
      /aduan.php                /fitur/laporan-aduan.html       301

      # Error pages
      /404                   /error/404.html           404
      /*                     /error/404.html           404
      ```
      Files: `_redirects`
      Verify: `cat _redirects` shows expected rules (no duplicate `/404` with root `404.html`).

- [ ] 5. **Update all inbound links in `index.html` to use new paths.**
      In `index.html` navbar (desktop + mobile menu) and body, update:
      - `href="menu-hari-ini.html"` → `href="fitur/menu-hari-ini.html"`
      - `href="distribusi-sebaran-sppg.html"` → `href="fitur/distribusi-sebaran-sppg.html"`
      - `href="standar-uji-akg.html"` → `href="fitur/standar-uji-akg.html"`
      - `href="laporan-aduan.html"` → `href="fitur/laporan-aduan.html"`
      - `href="login.html"` → `href="auth/login.html"`
      Also update the notification dropdown link at bottom of header: `href="laporan-aduan.html"` → `href="fitur/laporan-aduan.html"`
      Files: `index.html`
      Verify: Open index.html — all navbar links and card links point to correct new paths.

- [ ] 6. **Update links in all 3 dashboard files.**
      Each dashboard at `dashboard/{role}/index.html` currently has hardcoded `login.html` references in:
      - The inline auth guard script: `go('../../login.html')` → `go('../../auth/login.html')` (×2 per file)
      - `a[href$="login.html"]` click listener pattern (logout click handler)
      - The logout `<a href="../../login.html">` buttons in the header
      - Links to public pages (`../../distribusi-sebaran-sppg.html` → `../../fitur/distribusi-sebaran-sppg.html`, etc.)
      Files: `dashboard/admin/index.html`, `dashboard/sppg/index.html`, `dashboard/user/index.html`
      Verify: Session check redirects to `../../auth/login.html` on invalid session (test by clearing storage).

- [ ] 7. **Update `assets/js/script.js` page references.**
      - Line 80: `'menu-hari-ini.html?q='` — when called from root, this is fine; but since `script.js` is shared, use a root-relative URL: `'/fitur/menu-hari-ini.html?q='`
      - Line 252: `href="login.html"` in `renderEmptyState()` → `href="/auth/login.html"`
      - Any references to `api/notifications.php` (line ~430) → `fetch('/api/notifications')`
      - Any references to `api/auth_user.php` → `fetch('/api/auth', ...)`
      Files: `assets/js/script.js`
      Verify: Global search redirects to `/fitur/menu-hari-ini.html`; "Portal SPPG" link in empty state goes to `/auth/login.html`.

- [ ] 8. **Update `assets/js/api.js` to use Cloudflare Workers routes.**
      Replace the `BASE_URL` logic (path detection) with a fixed `/api/` base. Add `X-Requested-By: mbg-radar` to all fetch calls. Update `cekTiketAduan` to use `/api/data?action=cek_tiket&...`.
      Files: `assets/js/api.js`
      Verify: No `api.php` references remain; `X-Requested-By` header present in all requests.

- [ ] 9. **Create `error/` folder with 5 styled error pages.**
      All pages use: `background: #001026`, Tailwind CDN, Plus Jakarta Sans, logo at `../assets/images/logo.webp`.
      - `error/404.html` — "Halaman Tidak Ditemukan" with back/home buttons
      - `error/500.html` — "Kesalahan Internal Server" with retry button
      - `error/505.html` — "Versi HTTP Tidak Didukung"
      - `error/blocked.html` — "Anda Terdeteksi Melakukan Aktivitas Mencurigakan" (static, no JS needed)
      - `error/caught.html` — Dynamic page: reads `?type=` URL param, shows attack type + timestamp + "IP Anda telah dicatat", 10-second countdown then `location.replace('/')`
      Files: `error/404.html`, `error/500.html`, `error/505.html`, `error/blocked.html`, `error/caught.html`
      Verify: Open each — correct title, logo loads, countdown works on `caught.html`.

- [ ] 10. **Create `workers/` folder with Cloudflare Workers JS files.**
       Decision: Use plain ES module Workers (not Hono), since the project has no Node build step. KV-based, no PHP.
       - `workers/auth.js` — handles POST /api/auth with `action=login|register|session-check`. Uses SubtleCrypto SHA-256 for password hashing. Rate limit: tracks IP→count in KV `THREATS`. Rejects missing `X-Requested-By: mbg-radar` header. Returns JSON `{status, user: {role, full_name}}`.
       - `workers/data.js` — handles GET/POST /api/data for `action=telemetri|distribusi|menu|cek_tiket`. Reads from KV `DATA`. Rejects missing header.
       - `workers/security.js` — POST /api/security/log stores threat to KV `THREATS` with IP+type+timestamp. GET /api/security/threats (admin only, checks session). Auto-block logic: counts threats per IP in last hour, blocks if >3.
       - `workers/wrangler.toml` — declares three KV namespaces: USERS, DATA, THREATS with placeholder IDs. Routes: `/api/auth*`, `/api/data*`, `/api/security*`.
       - `workers/README.md` — step-by-step deploy instructions.
       Files: `workers/auth.js`, `workers/data.js`, `workers/security.js`, `workers/wrangler.toml`, `workers/README.md`
       Verify: Each Worker file is valid ES module JS (`export default { fetch(req, env) {...} }`); wrangler.toml is valid TOML.

- [ ] 11. **Overhaul `assets/js/security.js` — append new security features.**
       Read current file (112 lines), then rewrite/extend to add all required features without breaking existing `BGNSecurity` API. The module already exports `escapeHTML`, `checkExploit`, `showExploitAlert`, `attachFormGuards`.
       New additions:
       1. **DevTools detection**: `window.outerWidth - window.innerWidth > 160` → blur `.data-protected` elements + show toast "Mode baca dilindungi aktif". Do NOT redirect.
       2. **Fetch/XHR interceptor**: Override `window.fetch` to inject `X-Requested-By: mbg-radar` for same-origin requests (check `url.startsWith('/')` or same hostname).
       3. **Right-click prevention** on `.protected-data` only (contextmenu event, not globally).
       4. **Honeypot**: On DOMContentLoaded, find `input[name="website"].hidden` in laporan-aduan form; if user fills it → `location.replace('/error/caught.html?type=bot')`.
       5. **XSS/injection flow** (replaces `showExploitAlert` behavior): On exploit detected in form submit: 3-second delay → POST `/api/security/log` with payload → `location.replace('/error/caught.html?type=xss')`. Keep `showExploitAlert` for non-form contexts (backward compat).
       6. **Rate limiting UI**: Track failed logins in `sessionStorage` key `mbg_login_fails`. After 3 → inject math CAPTCHA into `#formLogin`. After 5 → disable form + show 5-minute countdown.
       Files: `assets/js/security.js`
       Verify: File loads without errors; `window.BGNSecurity` still exposed; fetch interceptor adds header.

- [ ] 12. **Remove all "demo" references from dashboards and JS files.**
       Specific targeted replacements:
       **`dashboard/admin/index.html`**:
       - Remove the entire `document.addEventListener('submit', ...)` demo toast block from the inline `<script>`
       **`dashboard/sppg/index.html`**:
       - Remove demo toast submit listener from inline `<script>`
       - `<strong>SPPG Demo</strong>` in navbar → `<strong id="sppgUnitName">—</strong>`
       - `<h1 ...>SPPG Demo</h1>` in hero section → `<h1 ... id="sppgHeroName">—</h1>`
       - Add JS at end of body: reads `mbg_session` from storage, sets `sppgUnitName` and `sppgHeroName` to `s.name || 'SPPG Radar MBG'`
       **`dashboard/user/index.html`**:
       - Remove demo toast submit listener from inline `<script>`
       - `<strong>Wali Murid Demo</strong>` in navbar → `<strong id="userDisplayName">Pengguna</strong>`
       - `value="Wali Murid Demo"` in reporter_name input → `value=""` (will be filled by JS)
       - Add JS: reads `mbg_session`, sets `userDisplayName` to `s.name || 'Pengguna'`; sets reporter_name input value to `s.name || ''`
       **`login.html` / `auth/login.html`** (already handled in step 2 — remove `demo: true`):
       - In catch block fallback: remove `, demo: true` from session JSON
       **`assets/js/script.js`**:
       - No demo references found (script.js has no demo: flags per grep)
       Files: `dashboard/admin/index.html`, `dashboard/sppg/index.html`, `dashboard/user/index.html`, `auth/login.html`
       Verify: Load each dashboard — no demo toast appears on form submit; SPPG and user names read from mbg_session.

---

## Dependency Order Summary

Steps 1–4 can be worked in parallel (all are independent file ops). Steps 5–8 depend on steps 1–4 (link target paths must exist). Steps 9–12 are independent of each other and of steps 1–8.

Safe parallelism:
- Batch A (independent): Steps 1, 2, 9, 10
- Batch B (after A): Steps 3, 4, 5, 6, 7, 8
- Batch C (independent): Steps 11, 12

---

## Risks & Edge Cases

1. **`login.html` root file**: Confirmed exists. Must be deleted after `auth/login.html` is created and tested — or leave it; the `_redirects` 301 will handle old URLs. Do NOT delete it until `_redirects` is in place.
2. **Dashboard auth guard**: The inline guard script checks `a[href$="login.html"]` for click-based logout. After rename to `../../auth/login.html`, this selector no longer matches `href$="login.html"` — it needs to match `href*="auth/login.html"` or use a separate data-logout approach.
3. **`api/auth_user.php` fetch in dashboards**: Currently falls back to `../../login.html` on error (which is correct behavior post-move, as the redirect will handle it). After step 6, this fetch is no longer needed but the fallback redirect must point to `../../auth/login.html`.
4. **`workers/` folder**: These Workers must be deployed separately via `wrangler deploy` — they don't auto-deploy with Cloudflare Pages. The README must make this clear.
5. **`error/` relative paths**: Error pages live at depth 1 from root, so `../assets/` is correct for images/CSS. The `caught.html` redirect goes to `/` (absolute) to avoid double-depth issues.
6. **`_redirects` catch-all rule `/* /error/404.html 404`**: This must be the LAST rule in the file (Cloudflare applies rules top-to-bottom). It will catch any unmatched URL.
7. **`distribusi-sebaran-sppg.html` uses Leaflet map**: When moved to `fitur/`, the Leaflet CDN links are absolute so they are fine. Only relative `assets/` paths need updating.
8. **No test runner exists**: This is a static site with no build/test tooling. Verification is done by opening pages in a browser and checking that linked resources (CSS, JS, images) load with HTTP 200.
