# Fix Summary — Radar MBG Static Site

**Date:** 2026-10-15  
**Executor:** Kiro AI Agent (workflow step)  
**Scope:** URL fixes, responsiveness, bug fixes, redundancy removal, _redirects update

---

## 1. Files Modified

### `index.html` (root)
- Fixed 2× `href="auth/login.php"` → `href="login.html"` (desktop nav + mobile nav)
- Removed 2 duplicate `<link>` tags for Material Symbols Outlined (kept only 1)
- Removed `::-webkit-scrollbar{display:none;}` from inline `<style>` (conflicts with style.css)
- Added `preload="none"` to hero video `<video>` tag
- Changed suggestion chips row from `flex flex-wrap` to `flex overflow-x-auto pb-1 no-scrollbar`
- Removed duplicate `<span class="material-symbols-outlined ...">arrow_forward</span>` in Card 1 footer

### `login.html` (root)
- Fixed `onerror="this.src='logo.webp'"` → `onerror="this.src='assets/images/logo.webp'"`
- Changed video `preload="auto"` → `preload="metadata"` (reduces mobile bandwidth usage)

### `dashboard/admin/index.html`
- Header padding: `px-6 sm:px-12` → `px-4 sm:px-8`
- Quick-nav pill bar: replaced `flex flex-wrap` with `flex overflow-x-auto pb-3 no-scrollbar` (horizontal scroll on mobile)
- All 8 form `action="index.php"` → `action="#"` (including 2 maintenance panel forms)
- Replaced blocking `alert('Mode demo statis: perubahan tidak disimpan.')` with non-blocking toast notification

### `dashboard/sppg/index.html`
- Header padding: `px-6 sm:px-12` → `px-4 sm:px-8`
- Both form `action="index.php"` → `action="#"`
- Replaced blocking `alert()` with non-blocking toast notification

### `dashboard/user/index.html`
- Header padding: `px-6 sm:px-12` → `px-4 sm:px-8`
- Fixed `<img id="navUserAvatar" src="assets/images/logo.webp"` → `src="../../assets/images/logo.webp"`
- Fixed `<img id="userAvatarPreview" src="assets/images/logo.webp"` → `src="../../assets/images/logo.webp"`
- Both form `action="index.php"` → `action="#"`
- Replaced blocking `alert()` with non-blocking toast notification

### `assets/css/style.css`
- Added `.no-scrollbar` utility class (hides scrollbar while keeping scroll functionality)

### `assets/js/script.js`
- Replaced all `dashboard/${u.role}/index.php` → `dashboard/${u.role}/`
- Replaced all `dashboard/admin/index.php#...` → `dashboard/admin/#...`
- Replaced all `dashboard/sppg/index.php#...` → `dashboard/sppg/#...`
- Replaced all `dashboard/user/index.php#...` → `dashboard/user/#...`
- Replaced `login.php?action=logout` → `login.html?logout=1` (both desktop and mobile dropdown)
- Fixed `href="login.php"` → `href="login.html"` in `renderEmptyState()`

### `assets/js/api.js`
- Fixed hardcoded `api.php?action=cek_tiket&...` in `cekTiketAduan()` → `${BASE_URL}?action=cek_tiket&...`

### `_redirects`
- Added 5 new redirect rules:
  - `/aduan.php → /laporan-aduan.html 301`
  - `/generate_og_image.php → /assets/images/og-preview.png 301`
  - `/api.php → / 301`
  - `/build.php → / 301`
  - `/auth/logout.php → /login.html?logout=1 301`

---

## 2. Files Deleted

| File | Reason |
|------|--------|
| `build.php` | PHP build script, never executed on Cloudflare Pages static hosting |
| `login.php` | Old PHP login, replaced by `login.html`; _redirects already covered |
| `register.php` | Old PHP register, replaced by login.html tab; _redirects already covered |
| `assets/images/og-preview.jpg` | Unused duplicate — all OG meta tags reference `og-preview.png` only |

Note: `generate_og_image.php` was not found (already absent from repo).

---

## 3. Files NOT Deleted (with reason)

- `aduan.php` — Redirected via _redirects to `/laporan-aduan.html`, kept in repo harmlessly
- `api.php` — Root API entrypoint; _redirects entry added for direct browser access
- `assets/css/theme.css` — `@import url('theme.css')` in style.css; CSS variables used throughout
- `api/` folder — Backend PHP code, kept for future PHP hosting migration
- `database/` folder — DB connection code, kept for future PHP hosting migration
- `auth/` folder — Referenced by _redirects rules

---

## 4. Known Non-Issues (documented)

- `api/auth_user.php` fetch in login.html and dashboards will fail on Cloudflare Pages (no PHP execution). The catch blocks provide static demo fallback — this is intentional behavior.
- `api/live_chat.php` fetch in sppg dashboard will fail gracefully with user-visible error message.
- `api/upload_avatar.php` fetch will fail gracefully with user-visible error message.
- The remaining `alert()` calls in the sppg chat reply function (lines ~563, 1306) are API error handlers for the live chat feature, NOT form submit handlers — they are intentionally left as-is.
- `assets/js/live_chat.js` — `OPENROUTER_API_KEY` placeholder is visible in client-side source; for production, move to a backend proxy or Cloudflare Worker.

---

## 5. Verification Checklist

- [x] No `alert()` in form submit handlers across all 3 dashboards
- [x] No `auth/login.php` links remain in any HTML file
- [x] No `index.php` in any form action attributes
- [x] No `login.php` links remain in script.js
- [x] `_redirects` updated with 5 new rules
- [x] Avatar images in user dashboard load correctly (`../../assets/images/logo.webp`)
- [x] All 3 dashboards have reduced header padding (`px-4 sm:px-8`)
- [x] Admin quick-nav scrolls horizontally on mobile
- [x] Hero video in index.html has `preload="none"`
- [x] Login page video has `preload="metadata"`
- [x] Material Symbols font loaded only once in index.html
- [x] No duplicate `arrow_forward` icon in Card 1 of index.html
- [x] `.no-scrollbar` utility class added to style.css
- [x] `cekTiketAduan` in api.js uses `BASE_URL` variable
