# Implementation Plan — Radar MBG Fix: URLs, Responsiveness, Bugs, Redundancies

**Project:** MBG-MONITORING static site hosted on Cloudflare Pages  
**Stack:** HTML5 + Tailwind CSS CDN + Vanilla JS (no PHP execution)  
**Date:** 2026-10-15  

---

## Summary of Findings

| Category | Count | Severity |
|----------|-------|----------|
| Broken / wrong URL / path | 8 | High |
| Responsiveness issues | 9 | Medium–High |
| Bugs | 5 | High |
| Redundant / dead files to delete | 6 | Low |
| Missing `_redirects` entries | 4 | Medium |
| CSS/JS cleanup | 3 | Low |

---

## SECTION A — File-by-File Changes

---

### A1 · `index.html` (root)

#### A1.1 — URL / Path Issues

**1. `href="auth/login.php"` (2 occurrences — desktop nav and mobile nav)**  
Both "Portal Masuk" links point to `auth/login.php`, which does not execute on Cloudflare Pages.  
Change to `login.html` on both.

Location 1 — desktop header `<div class="hidden md:flex ...">`:
```html
<!-- BEFORE -->
<a ... href="auth/login.php">
<!-- AFTER -->
<a ... href="login.html">
```

Location 2 — `#mobileNavMenu`:
```html
<!-- BEFORE -->
<a ... href="auth/login.php">
<!-- AFTER -->
<a ... href="login.html">
```

**2. `href="login.php?action=logout"` in `script.js` (NOT in index.html itself — handled in A12)**

#### A1.2 — Responsiveness Issues

**3. Duplicate `Material Symbols Outlined` font imports (3× in `<head>`)**  
Three separate `<link>` tags all import the same Material Symbols font. This causes 2 extra network round-trips and parse overhead.

Keep only **one** combined import. Replace all three Material Symbols `<link>` tags with:
```html
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet"/>
```
Remove the two redundant ones that follow.

**4. Video background missing `preload="none"` on mobile**  
The `<video autoplay loop muted playsinline>` in the Hero section has no `preload` attribute (defaults to browser decision — usually `auto`, downloading the full video on mobile).

Add `preload="none"` for the Hero video to prevent wasted bandwidth on mobile:
```html
<!-- BEFORE -->
<video autoplay loop muted playsinline class="absolute inset-0 ...">
<!-- AFTER -->
<video autoplay loop muted playsinline preload="none" class="absolute inset-0 ...">
```

**5. Quick-suggestion chip row can overflow on small screens**  
The "Pencarian Terpopuler" chip row uses `flex-wrap items-center gap-2` but chips can still overflow on 375 px screens without a scroll container.  

Wrap the chips container in `overflow-x-auto` and add `flex-nowrap` so it scrolls horizontally instead of overflowing or wrapping awkwardly on very narrow screens. Change the wrapping `div`:
```html
<!-- BEFORE -->
<div class="mt-space-sm flex flex-wrap items-center gap-2 pt-space-xs">
<!-- AFTER -->
<div class="mt-space-sm flex items-center gap-2 pt-space-xs overflow-x-auto pb-1 no-scrollbar">
```

#### A1.3 — Bugs

**6. Duplicate `arrow_forward` icon rendered in Card 1 ("Menu Hari Ini") footer**  
The card footer has two `<span class="material-symbols-outlined ...">arrow_forward</span>` elements — one inside the `<a>` and one after it at the same level. Remove the trailing duplicate:
```html
<!-- BEFORE (at end of card 1 footer) -->
<a href="menu-hari-ini.html" ...><span>Buka Jadwal Menu</span><span class="material-symbols-outlined ...">arrow_forward</span></a>
<span class="material-symbols-outlined text-secondary group-hover:translate-x-1 transition-transform">arrow_forward</span>
<!-- AFTER — remove the second standalone <span> -->
<a href="menu-hari-ini.html" ...><span>Buka Jadwal Menu</span><span class="material-symbols-outlined ...">arrow_forward</span></a>
```

#### A1.4 — CSS

**7. Inline `<style>` in `<head>` — check for duplication with `style.css`**  
The single inline `<style>` block sets:
```css
@layer base{html,body{margin:0;padding:0;}body{overscroll-behavior:none;}...}::-webkit-scrollbar{display:none;}
```
`style.css` already resets margins/padding and has scrollbar styling, but `overscroll-behavior:none` and the `main > :first-child` rules are NOT in `style.css`. The `::-webkit-scrollbar { display: none }` **conflicts** with `style.css` which gives scrollbars a 6px width.

Action: Keep the inline `<style>` but remove the `::-webkit-scrollbar { display: none }` line from it (so `style.css` scroll style wins). The other rules in the inline block are unique and should remain.

---

### A2 · `login.html` (root)

#### A2.1 — URL / Path Issues

**1. `onerror="this.src='logo.webp'"` on the logo `<img>` tag**  
Fallback src `logo.webp` without path will fail (file is at `assets/images/logo.webp`).  
Change to:
```html
onerror="this.src='assets/images/logo.webp'"
```

**2. Video background has `preload="auto"` — heavy on mobile**  
```html
<!-- BEFORE -->
<video autoplay muted loop playsinline preload="auto" ...>
<!-- AFTER -->
<video autoplay muted loop playsinline preload="metadata" ...>
```
`preload="metadata"` loads just the first frame (for poster) without buffering the full file.

#### A2.2 — Bugs

**3. Dashboard redirect after login uses correct paths** ✅  
`window.location.href = 'dashboard/admin/'` — correct for a root-level file.  
`window.location.href = 'dashboard/sppg/'` — correct.  
`window.location.href = 'dashboard/user/'` — correct.  
No changes needed here.

**4. Session-check auto-redirect uses correct paths** ✅  
`location.replace('dashboard/' + s.role + '/')` — correct.  
No changes needed.

**5. `api/auth_user.php` fetch URL — will return 500/MIME error on static hosting**  
The login form submits to `api/auth_user.php`. On Cloudflare Pages without a Worker backend, this will fail with a network error. The code already has a `catch (err)` fallback that does static demo login — this is acceptable. No change required, but the plan documents it as expected behavior.

---

### A3 · `dashboard/admin/index.html`

#### A3.1 — URL / Path Issues

**1. All asset paths use `../../` prefix** ✅  
`../../assets/css/style.css`, `../../assets/images/logo.webp` — all correct.

**2. Logout link `href="../../login.html"`** ✅ Correct.

**3. Home link `href="../../index.html"`** ✅ Correct.

**4. All `form action="index.php"` attributes — PHP will not execute on Cloudflare Pages**  
There are 5 forms all pointing to `action="index.php" method="POST"`. On static hosting these will 404 or return HTML.  
The inline security script already intercepts ALL form submits with `document.addEventListener('submit', ...)` and shows `alert()`. Since the PHP backend is not available on Cloudflare Pages, the correct behaviour is to show a non-blocking toast (see **Section B — Toast Fix**).  
Change each form's `action` to `#` to prevent 404 navigation as a fallback:
```html
<!-- BEFORE -->
<form action="index.php" method="POST">
<!-- AFTER -->
<form action="#" method="POST">
```
Apply to all 5 forms in `dashboard/admin/index.html`.

#### A3.2 — Responsiveness Issues

**5. Header `px-6 sm:px-12` on very narrow screens**  
The admin header uses `px-6 sm:px-12 py-4`. On 375px screens `px-6` = 24px each side, leaving only 327px for content — tight with all the header items. Reduce to `px-4 sm:px-8`:
```html
<!-- BEFORE -->
<header class="... px-6 sm:px-12 py-4 flex items-center justify-between shadow-md">
<!-- AFTER -->
<header class="... px-4 sm:px-8 py-4 flex items-center justify-between shadow-md">
```

**6. Quick-nav pill bar can overflow on mobile (< 640px)**  
The sticky quick-nav div with `flex flex-wrap` pills. Add `overflow-x-auto` and `flex-nowrap` on mobile so it scrolls horizontally:
```html
<!-- BEFORE -->
<div class="flex flex-wrap items-center gap-2 mb-8 p-2.5 bg-white/80 ... sticky top-20 z-20">
<!-- AFTER -->
<div class="flex items-center gap-2 mb-8 p-2.5 bg-white/80 ... sticky top-20 z-20 overflow-x-auto pb-3 no-scrollbar">
```
Remove `flex-wrap` from this element.

**7. KPI cards grid collapses properly** ✅  
`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4` — already responsive. No change needed.

**8. Tables already wrapped in `overflow-x-auto`** ✅ No change.

**9. Forms already use responsive grid with `grid-cols-1`** ✅ No change.

**10. `<span class="hidden sm:inline">Admin Satgas BGN</span>` hides name on mobile** ✅  
This is intentional — the icon still shows. Acceptable behavior.

---

### A4 · `dashboard/sppg/index.html`

#### A4.1 — URL / Path Issues

**1. All asset paths use `../../` prefix** ✅ Correct.

**2. Logout link `href="../../login.html"`** ✅ Correct.

**3. All `form action="index.php" method="POST"` — same issue as Admin**  
Change all 3 form `action` attributes from `index.php` to `#`.

**4. Live chat upload form uses `../../api/upload_avatar.php`** — will fail gracefully with catch block ✅  
The error handling shows user-facing message. No change needed.

#### A4.2 — Responsiveness Issues

**5. Header `px-6 sm:px-12` — same fix as admin**:
```html
<!-- BEFORE -->
<header class="... px-6 sm:px-12 py-3.5 flex items-center justify-between">
<!-- AFTER -->
<header class="... px-4 sm:px-8 py-3.5 flex items-center justify-between">
```

**6. The `lg:col-span-12` form grid falls to full width on mobile** ✅ Already responsive.

**7. Riwayat Menu table wrapped in `overflow-x-auto`** ✅ Already done.

**8. Live chat panel `h-[460px]` fixed height — on mobile this is fine as it's inside a responsive grid** ✅.

---

### A5 · `dashboard/user/index.html`

#### A5.1 — URL / Path Issues

**1. KNOWN BUG: `src="assets/images/logo.webp"` on avatar `<img>` (line in navbar)**  
The nav avatar and the profile section preview image both have wrong paths:

- `<img id="navUserAvatar" src="assets/images/logo.webp" ...>` → should be `../../assets/images/logo.webp`
- `<img id="userAvatarPreview" src="assets/images/logo.webp" ...>` → should be `../../assets/images/logo.webp`

Both have `onerror` fallbacks that point to `../../assets/images/logo.webp`, so they self-heal, but fix the primary `src` too:
```html
<!-- navUserAvatar - BEFORE -->
<img id="navUserAvatar" src="assets/images/logo.webp" ... onerror="this.src='../../assets/images/logo.webp'">
<!-- AFTER -->
<img id="navUserAvatar" src="../../assets/images/logo.webp" ... onerror="this.src='../../assets/images/logo.webp'">

<!-- userAvatarPreview - BEFORE -->
<img id="userAvatarPreview" src="assets/images/logo.webp" ... onerror="this.src='../../assets/images/logo.webp'">
<!-- AFTER -->
<img id="userAvatarPreview" src="../../assets/images/logo.webp" ... onerror="this.src='../../assets/images/logo.webp'">
```

**2. Form `action="index.php" method="POST"` — same issue**  
Change all 2 form actions from `index.php` to `#`.

**3. Upload avatar form fetches `../../api/upload_avatar.php`** ✅ Correct relative path.

**4. `href="../../menu-hari-ini.html"` in menu section** ✅ Correct.

#### A5.2 — Responsiveness Issues

**5. Header `px-6 sm:px-12` — same fix**:
```html
<!-- BEFORE -->
<header class="... px-6 sm:px-12 py-3.5 flex items-center justify-between shadow-sm">
<!-- AFTER -->
<header class="... px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-sm">
```

**6. Complaint form uses `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`** ✅ Already stacks on mobile.

**7. Metrics strip uses `grid-cols-1 sm:grid-cols-3`** ✅ Already responsive.

**8. Aduan history table already wrapped in `overflow-x-auto`** ✅ No change.

**9. Profile settings grid `grid-cols-1 lg:grid-cols-2`** ✅ Already responsive.

---

### A6 · `_redirects`

Add the following entries for PHP files that exist at root and will be crawled / bookmarked:

```
# PHP files at root — redirect to appropriate static pages
/aduan.php                /laporan-aduan.html             301
/generate_og_image.php    /assets/images/og-preview.png  301
/api.php                  /                               301
/build.php                /                               301
/auth/logout.php          /login.html?logout=1            301
```

**Full updated `_redirects` file content:**
```
# Cloudflare Pages (hosting statis, tidak menjalankan PHP).
# Semua link lama ke halaman login PHP diarahkan ke panel login statis.
/login.php                /login.html              301
/auth/login.php           /login.html              301
/register.php             /login.html?tab=register 301
/auth/register.php        /login.html?tab=register 301
/features/login.php       /login.html              301
/pages/login.php          /login.html              301

# Root PHP files — tidak dieksekusi di Cloudflare Pages
/aduan.php                /laporan-aduan.html      301
/generate_og_image.php    /assets/images/og-preview.png  301
/api.php                  /                        301
/build.php                /                        301
/auth/logout.php          /login.html?logout=1     301
```

---

### A7 · `assets/css/style.css`

**1. `@import url('theme.css')` at top** ✅  
`theme.css` IS imported via `@import` in `style.css`. Confirmed: `theme.css` IS used and must NOT be deleted.

**2. No hardcoded URLs to old domains found** ✅

---

### A8 · `assets/css/dashboard.css`

**No issues found.** The file is clean, uses CSS custom properties from `theme.css`, and contains no hardcoded URLs or legacy domain references. ✅

---

### A9 · `assets/css/security.css`

**No issues found.** Pure styling for the WAF modal overlay. No hardcoded URLs. ✅

---

### A10 · `assets/css/theme.css`

**Imported correctly via `@import` in `style.css`** ✅  
No changes needed. Do NOT delete.

---

### A11 · `assets/js/api.js`

**1. `BASE_URL` path logic**  
```js
const BASE_URL = window.location.pathname.includes('/features/') 
  ? '../../api.php' 
  : 'api.php';
```
This points to `api.php` (root), which in turn does `require_once __DIR__ . '/api/index.php'`. On Cloudflare Pages, `api.php` is NOT executed — it will return the PHP source as text.  
The actual API calls will fail and fall through to fallback/error states. This is acceptable behavior for a static demo — the fetch calls fail gracefully.

However, `cekTiketAduan` uses a **hardcoded** `api.php?...` without respecting `BASE_URL`:
```js
const endpoint = `api.php?action=cek_tiket&tiket=${encodeURIComponent(nomorTiket)}`;
```
Fix to use `BASE_URL`:
```js
// BEFORE
const endpoint = `api.php?action=cek_tiket&tiket=${encodeURIComponent(nomorTiket)}`;
// AFTER
const endpoint = `${BASE_URL}?action=cek_tiket&tiket=${encodeURIComponent(nomorTiket)}`;
```

**2. No other hardcoded domain URLs found** ✅

---

### A12 · `assets/js/script.js`

**1. Dashboard links in `initUserAuthStatus()` use `.php` extensions**  
The dropdown built by `initUserAuthStatus()` contains many links like:
- `href="dashboard/${u.role}/index.php"`  
- `href="dashboard/admin/index.php#telemetry-manager"`
- `href="login.php?action=logout"`  

All `.php` links are dead on Cloudflare Pages. Replace them:

| Old | New |
|-----|-----|
| `dashboard/${u.role}/index.php` | `dashboard/${u.role}/` |
| `dashboard/admin/index.php#telemetry-manager` | `dashboard/admin/#telemetry-manager` |
| `dashboard/admin/index.php#maintenance-panel` | `dashboard/admin/#maintenance-panel` |
| `dashboard/sppg/index.php#input-menu` | `dashboard/sppg/#input-menu` |
| `dashboard/sppg/index.php#uji-akg` | `dashboard/sppg/#uji-akg` |
| `dashboard/user/index.php#riwayat-aduan` | `dashboard/user/#riwayat-aduan` |
| `dashboard/${u.role}/index.php#pengaturan-profil` | `dashboard/${u.role}/#pengaturan-profil` |
| `dashboard/${u.role}/index.php#ganti-password` | `dashboard/${u.role}/#ganti-password` |
| `login.php?action=logout` | `login.html?logout=1` |

Apply the same replacements in both the desktop dropdown and mobile dropdown HTML strings inside `initUserAuthStatus()`.

**2. `renderEmptyState()` has a dead link `href="login.php"`**  
```js
// BEFORE
<a href="login.php" class="...">Masuk ke Portal SPPG</a>
// AFTER
<a href="login.html" class="...">Masuk ke Portal SPPG</a>
```

**3. `applyStaticSessionFallback()` logout button** ✅  
Already uses `location.href = 'login.html?logout=1'` — correct.

---

### A13 · `assets/js/security.js`

**No hardcoded URLs to old domains** ✅  
No changes needed.

---

### A14 · `assets/js/live_chat.js`

**1. `OPENROUTER_API_KEY = "YOUR_OPENROUTER_API_KEY"` exposed in source**  
This is a placeholder but should be a note: this key is visible in client-side source. No runtime fix needed for static hosting (it won't work anyway without a backend proxy), but document this for future reference. No code change required.

**2. `apiBase` detection path logic**  
```js
const isSubfolder = window.location.pathname.includes('/features/') || 
                    window.location.pathname.includes('/pages/') ||
                    window.location.pathname.includes('/dashboard/');
const apiBase = isSubfolder ? '../../api/live_chat.php' : 'api/live_chat.php';
```
This correctly resolves to `../../api/live_chat.php` when loaded from a dashboard page. ✅  
On static hosting the API calls fail gracefully (error message shown to user). No change needed.

---

## SECTION B — Bug Fixes

---

### B1 — `document.addEventListener('submit', ..., true)` Blocking Toast Replacement

**Location:** Inline `<script>` in the `<head>` of all three dashboard files:
- `dashboard/admin/index.html`
- `dashboard/sppg/index.html`
- `dashboard/user/index.html`

**Current code (identical in all three):**
```js
document.addEventListener('submit', function(e) {
  e.preventDefault();
  alert('Mode demo statis: perubahan tidak disimpan.');
}, true);
```

**Problem:** `alert()` is blocking — it freezes the entire browser tab. It also captures ALL form submits, including the chat form and avatar upload form which handle their own `preventDefault()` and async logic. The global submit interceptor runs at capture phase (`true`) and fires before any individual form's own listener.

**Fix:** Replace `alert()` with a non-blocking auto-dismiss toast. The toast should:
- Appear at the top-center of the screen
- Use the existing design system colors (`#001026` background, `#6ffbbe` accent)
- Auto-dismiss after 3 seconds
- NOT fire for forms that already call `e.preventDefault()` themselves (the live chat forms, avatar upload form)

**Replacement code for the `document.addEventListener('submit', ...)` block in all three dashboard files:**

```js
document.addEventListener('submit', function(e) {
  // Allow forms with their own async handlers to proceed
  var formId = e.target.id;
  var skipIds = ['formSatgas','formSppg','formUploadUserAvatar','formUploadSppgLogo','sppgReplyForm'];
  if (skipIds.indexOf(formId) >= 0) return;
  
  e.preventDefault();
  
  // Show non-blocking toast
  var existing = document.getElementById('mbg-demo-toast');
  if (existing) existing.remove();
  
  var toast = document.createElement('div');
  toast.id = 'mbg-demo-toast';
  toast.style.cssText = [
    'position:fixed',
    'top:80px',
    'left:50%',
    'transform:translateX(-50%)',
    'z-index:99999',
    'display:flex',
    'align-items:center',
    'gap:10px',
    'padding:12px 20px',
    'border-radius:12px',
    'background:#001026',
    'color:#fff',
    'font-size:13px',
    'font-weight:600',
    'box-shadow:0 8px 24px rgba(0,16,38,0.3)',
    'border:1px solid rgba(111,251,190,0.3)',
    'pointer-events:none',
    'transition:opacity 0.4s ease',
    'opacity:1'
  ].join(';');
  toast.innerHTML = '<span style="color:#6ffbbe;font-size:18px;line-height:1;" class="material-symbols-outlined">info</span>'
    + '<span>Mode demo statis — perubahan tidak disimpan ke database.</span>';
  document.body.appendChild(toast);
  
  setTimeout(function() {
    toast.style.opacity = '0';
    setTimeout(function() { toast.remove(); }, 400);
  }, 3000);
}, true);
```

**Apply this replacement in all three dashboard `index.html` files.**

---

### B2 — Logout Handler: `clr()` Called Before Redirect

**Location:** Inline `<script>` in each dashboard file:
```js
document.addEventListener('click', function(e) {
  var a = e.target.closest && e.target.closest('a[href$="login.html"]');
  if (a) {
    clr();
    try { fetch('../../auth/logout.php', {credentials:'same-origin', keepalive:true}).catch(function(){}); } catch(_) {}
  }
});
```

**Assessment:** `clr()` IS called before the navigation. The selector `a[href$="login.html"]` correctly matches both the logout link `href="../../login.html"` (ends with `login.html`). ✅  

However there is a subtle issue: the click event handler does NOT call `e.preventDefault()`, so the link navigates immediately. `clr()` executes synchronously before navigation, which is correct. The `fetch` to `auth/logout.php` is fire-and-forget with `keepalive:true`. This is correct behavior. **No change needed.**

---

### B3 — `og-preview.jpg` vs `og-preview.png` Redundancy

**Investigation:**
- `index.html` meta tags use `og-preview.png` exclusively (all 4 OG/Twitter image meta tags)
- No file uses `og-preview.jpg` in any meta tag
- Both files exist at `assets/images/`

**Action:** `og-preview.jpg` is a duplicate / unused file. Add to delete list.

---

## SECTION C — Files to Delete

The following PHP files at root have no purpose on Cloudflare Pages static hosting. They are NOT executed, cannot be required, and exist only as source code artifacts that could confuse crawlers or accidentally expose code structure.

| File | Reason | Safe to delete? |
|------|--------|----------------|
| `build.php` | Build script for generating PHP-rendered HTML, useless on static hosting | ✅ Yes |
| `generate_og_image.php` | GD-library OG image generator; static `og-preview.png` already exists | ✅ Yes |
| `login.php` | Old PHP login; `_redirects` already sends visitors to `login.html` | ✅ Yes |
| `register.php` | Old PHP register; `_redirects` already sends visitors to `login.html?tab=register` | ✅ Yes |
| `assets/images/og-preview.jpg` | Duplicate of `og-preview.png`; no meta tag references `.jpg` | ✅ Yes |

**Do NOT delete:**
- `aduan.php` — Has a `_redirects` entry added in A6 pointing to `laporan-aduan.html`. After adding that redirect rule, the file itself becomes inaccessible on Cloudflare Pages. It can optionally be deleted too, but keeping it causes no harm since PHP is never executed.
- `api.php` — Delegates to `api/index.php`. Keep as backend entrypoint; will be redirected by `_redirects` for browsers hitting it directly.
- `api/` folder — All API PHP files are backend code. Keep.
- `database/` folder — Database connection code. Keep.
- `auth/` folder — Keep (referenced by `_redirects`).

---

## SECTION D — Detailed Responsiveness Checklist (All Devices 375px–768px)

This section consolidates all responsiveness fixes across files.

### D1 — All Three Dashboard Headers: `px-6 sm:px-12` → `px-4 sm:px-8`

**Files:** `dashboard/admin/index.html`, `dashboard/sppg/index.html`, `dashboard/user/index.html`  
**Change:** Reduce horizontal padding on the sticky header from 24px to 16px at mobile breakpoint.

```html
<!-- Pattern to find and replace in all 3 files -->
<!-- BEFORE -->
class="... px-6 sm:px-12 ..."
<!-- AFTER -->
class="... px-4 sm:px-8 ..."
```

### D2 — Admin Quick-Nav Pill Bar: Horizontal Scroll on Mobile

**File:** `dashboard/admin/index.html`  
**Change:** Replace `flex-wrap` with `overflow-x-auto` + `no-scrollbar` on the sticky quick-nav bar.

### D3 — Index.html Hero: Suggestion Chips Horizontal Scroll

**File:** `index.html`  
**Change:** Replace `flex-wrap` with `overflow-x-auto` + `no-scrollbar` on the suggestion chips row.

### D4 — Login.html Video: `preload="auto"` → `preload="metadata"`

**File:** `login.html`  
**Change:** Reduce mobile data usage on the login page video background.

### D5 — Index.html Hero Video: Add `preload="none"`

**File:** `index.html`  
**Change:** The hero video autoplay still works but doesn't pre-buffer on mobile.

### D6 — `no-scrollbar` Utility Class

The `no-scrollbar` class is used in `live_chat.js` (`.no-scrollbar` on quick chip rows) and should be added to `assets/css/style.css` if not already there. Check: searching `style.css` — it is NOT currently defined.

**Add to `assets/css/style.css`:**
```css
/* Hide scrollbar for horizontal scroll containers while keeping functionality */
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
```

---

## SECTION E — Complete Change Summary by File

### Files to MODIFY:

| File | Changes |
|------|---------|
| `index.html` | Fix 2× `auth/login.php` → `login.html`; Remove 2 duplicate Material Symbols `<link>` tags; Add `preload="none"` to hero video; Make suggestion chips horizontally scrollable; Remove inline scrollbar-hide conflicting with `style.css`; Remove duplicate `arrow_forward` icon |
| `login.html` | Fix `onerror` fallback src; Change video `preload="auto"` → `preload="metadata"` |
| `dashboard/admin/index.html` | Reduce header padding to `px-4 sm:px-8`; Make quick-nav horizontally scrollable; Change all 5 `action="index.php"` → `action="#"`; Replace `alert()` submit handler with toast |
| `dashboard/sppg/index.html` | Reduce header padding to `px-4 sm:px-8`; Change all 3 `action="index.php"` → `action="#"`; Replace `alert()` submit handler with toast |
| `dashboard/user/index.html` | Fix 2× avatar `src="assets/images/logo.webp"` → `src="../../assets/images/logo.webp"`; Reduce header padding to `px-4 sm:px-8`; Change all 2 `action="index.php"` → `action="#"`; Replace `alert()` submit handler with toast |
| `_redirects` | Add 5 new redirect rules for root PHP files |
| `assets/js/api.js` | Fix hardcoded `api.php` in `cekTiketAduan()` to use `BASE_URL` |
| `assets/js/script.js` | Replace all `index.php` and `login.php` hrefs with `.html`/`/` equivalents in `initUserAuthStatus()` and `renderEmptyState()` |
| `assets/css/style.css` | Add `.no-scrollbar` utility class |

### Files to DELETE:

1. `build.php`
2. `generate_og_image.php`
3. `login.php`
4. `register.php`
5. `assets/images/og-preview.jpg`

---

## SECTION F — Implementation Order (Dependencies First)

- [ ] 1. Add `.no-scrollbar` to `assets/css/style.css`  
      Files: `assets/css/style.css`  
      Verify: Load any dashboard page and check horizontal chip rows scroll without visible scrollbar.

- [ ] 2. Fix URL paths in `index.html` (auth/login.php links, duplicate fonts, video preload, chips scroll, duplicate icon)  
      Files: `index.html`  
      Verify: Open DevTools → Network, load `index.html`. Confirm only 1 Material Symbols request instead of 3. Confirm "Portal Masuk" links point to `login.html`.

- [ ] 3. Fix `login.html` (onerror fallback src, video preload)  
      Files: `login.html`  
      Verify: Load `login.html` on mobile simulation (375px). Network tab shows video `preload=metadata`.

- [ ] 4. Fix `dashboard/user/index.html` (avatar src bug, header padding, form actions, toast)  
      Files: `dashboard/user/index.html`  
      Verify: Open user dashboard — avatar images load without broken icon. Submit any form — see toast appear and auto-dismiss without blocking.

- [ ] 5. Fix `dashboard/sppg/index.html` (header padding, form actions, toast)  
      Files: `dashboard/sppg/index.html`  
      Verify: Submit any form — toast appears.

- [ ] 6. Fix `dashboard/admin/index.html` (header padding, quick-nav scroll, form actions, toast)  
      Files: `dashboard/admin/index.html`  
      Verify: On 375px viewport, quick-nav pills scroll horizontally. Submit any form — toast appears.

- [ ] 7. Fix `assets/js/script.js` (PHP links → HTML links)  
      Files: `assets/js/script.js`  
      Verify: With a valid session in localStorage, load `index.html`. Dropdown links in the profile menu should not contain `.php`.

- [ ] 8. Fix `assets/js/api.js` (hardcoded api.php in cekTiketAduan)  
      Files: `assets/js/api.js`  
      Verify: Code review — `cekTiketAduan` uses `BASE_URL`.

- [ ] 9. Update `_redirects` with new PHP redirect rules  
      Files: `_redirects`  
      Verify: After deploy to Cloudflare Pages, navigating to `/aduan.php` should redirect to `/laporan-aduan.html`.

- [ ] 10. Delete redundant files  
      Files to delete: `build.php`, `generate_og_image.php`, `login.php`, `register.php`, `assets/images/og-preview.jpg`  
      Verify: Files no longer present in repo. `_redirects` covers any inbound links.

---

## SECTION G — Notes & Non-Issues

- **`api/` folder PHP files** — These are backend endpoints. They exist but are never executed on Cloudflare Pages. They silently 404 or return PHP source. This is expected for the static demo. Keeping them is fine; they contain the full backend logic for when the project moves to a PHP host.
- **`aduan.php`** root file — redirected via `_redirects` to `laporan-aduan.html`. Keeping it in the repo doesn't harm anything on static hosting.
- **`database/` folder** — DB connection code. Never executed on Cloudflare Pages. Keep for future PHP hosting migration.
- **`auth/logout.php`** — A new `_redirects` rule sends `/auth/logout.php` to `/login.html?logout=1` so that the dashboard click handler's fire-and-forget fetch fails gracefully, while any direct browser navigation is cleanly handled.
- **`assets/images/og-preview.png`** — This is the canonical OG image referenced in all meta tags. Keep.
- **`theme.css`** — Imported via `@import url('theme.css')` in `style.css`, and its CSS variables (`--bgn-primary`, etc.) are used throughout `dashboard.css` and `style.css`. Do NOT delete.
- **`kebijakan-privasi.html`** — Linked from `login.html`. Exists at root. ✅
- **`laporan-aduan.html`** — Exists at root. `aduan.php` redirect target is valid. ✅
- **`.env` / `.env.example`** — Confirm `.env` is listed in `.gitignore` before any commit. It contains database credentials.
