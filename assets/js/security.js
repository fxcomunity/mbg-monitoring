/**
 * security.js — BGN Client-Side Security Guard
 * - XSS / injection detection (3s delay before redirect)
 * - Anti-scraping fetch intercept
 * - DevTools detection (blur sensitive data, non-aggressive)
 * - Honeypot bot detection
 * - Rate limiting UI (login form)
 */
const BGNSecurity = (function () {
  'use strict';

  const CAUGHT_PAGE = '/error/caught.html';
  const SECURITY_API = '/api/security/log';

  // ─── XSS / Injection patterns ────────────────────────────────────────────
  const DANGEROUS_PATTERNS = [
    /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
    /<script\b[^>]*>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /data:text\/html/gi,
    /on(error|load|click|mouseover|focus|blur|change|submit|mouseenter)\s*=/gi,
    /<iframe[\s\S]*?>/gi,
    /<object[\s\S]*?>/gi,
    /<embed[\s\S]*?>/gi,
    /\bunion\s+select\b/gi,
    /\bexec(\s|\()+/gi,
    /eval\s*\(/gi,
    /document\.cookie/gi,
    /window\.location\s*=/gi
  ];

  function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function checkExploit(str) {
    if (typeof str !== 'string') return false;
    for (const p of DANGEROUS_PATTERNS) { p.lastIndex = 0; if (p.test(str)) return true; }
    return false;
  }

  // ─── Log threat to Cloudflare Worker (non-blocking) ──────────────────────
  function logThreat(type, indicator, url) {
    try {
      fetch(SECURITY_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-By': 'mbg-radar' },
        body: JSON.stringify({
          type,
          indicator: indicator.substring(0, 80),
          url: url || location.href,
          userAgent: navigator.userAgent.substring(0, 120)
        }),
        keepalive: true
      }).catch(() => {});
    } catch (e) {}
    // also store locally
    try {
      const logs = JSON.parse(localStorage.getItem('mbg_security_log') || '[]');
      logs.push({ type, indicator: indicator.substring(0, 80), url: url || location.href, ts: Date.now() });
      if (logs.length > 50) logs.splice(0, logs.length - 50);
      localStorage.setItem('mbg_security_log', JSON.stringify(logs));
    } catch (e) {}
  }

  // ─── Redirect to caught page with 3s delay ───────────────────────────────
  function redirectCaught(type, ref) {
    const target = CAUGHT_PAGE + '?type=' + encodeURIComponent(type) + '&ref=' + encodeURIComponent(ref || location.href);
    // Show countdown toast before redirect
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:999999;background:rgba(0,0,0,0.85);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:Plus Jakarta Sans,sans-serif;';
    toast.innerHTML = '<span style="font-size:48px;margin-bottom:16px;">🚨</span><h2 style="font-size:20px;font-weight:800;margin-bottom:8px;">Aktivitas Mencurigakan Terdeteksi</h2><p style="font-size:13px;color:#f87171;margin-bottom:16px;">Tindakan ini telah dicatat. Mengalihkan dalam <span id="bgnCountdown">3</span> detik...</p>';
    document.body.appendChild(toast);
    let c = 3;
    const iv = setInterval(function () {
      c--;
      const el = document.getElementById('bgnCountdown');
      if (el) el.textContent = c;
      if (c <= 0) { clearInterval(iv); location.replace(target); }
    }, 1000);
  }

  // ─── XSS Alert modal (before redirect) ───────────────────────────────────
  function showExploitAlert(detectedCode) {
    const existing = document.getElementById('bgn-waf-alert-modal');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'bgn-waf-alert-modal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(0,10,26,0.92);display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML = `<div style="background:#fff;border-radius:20px;padding:28px 24px;max-width:400px;width:100%;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.4);">
      <div style="width:56px;height:56px;border-radius:50%;background:#fee2e2;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
        <span class="material-symbols-outlined" style="color:#dc2626;font-size:28px;">security</span>
      </div>
      <h3 style="font-size:16px;font-weight:800;color:#1e293b;margin-bottom:8px;">BGN Shield — Input Berbahaya Terdeteksi</h3>
      <p style="font-size:12px;color:#64748b;margin-bottom:16px;">Sistem mendeteksi upaya injeksi kode. Tindakan ini dicatat dan diteruskan ke tim keamanan BGN.</p>
      <code style="display:block;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:8px;font-size:11px;color:#991b1b;margin-bottom:16px;word-break:break-all;">${escapeHTML(detectedCode).substring(0, 80)}...</code>
      <button id="btnCloseWafAlert" style="width:100%;padding:10px;background:#dc2626;color:#fff;font-weight:700;border:none;border-radius:12px;cursor:pointer;font-size:13px;">Mengerti & Bersihkan Input</button>
    </div>`;
    document.body.appendChild(overlay);
    document.getElementById('btnCloseWafAlert')?.addEventListener('click', () => overlay.remove());
  }

  // ─── Form Guards (XSS detection + honeypot) ──────────────────────────────
  function attachFormGuards() {
    // Global XSS scanner via event delegation
    document.addEventListener('submit', function (e) {
      const form = e.target;
      if (!form || form.tagName !== 'FORM') return;

      // Honeypot check
      const honeypot = form.querySelector('input[name="website"]');
      if (honeypot && honeypot.value.trim() !== '') {
        e.preventDefault(); e.stopImmediatePropagation();
        logThreat('bot', 'honeypot_filled', location.href);
        setTimeout(() => location.replace(CAUGHT_PAGE + '?type=bot'), 500);
        return false;
      }

      // XSS check
      const inputs = form.querySelectorAll('input, textarea, select');
      for (const input of inputs) {
        if (checkExploit(input.value)) {
          e.preventDefault(); e.stopImmediatePropagation();
          logThreat('xss', input.value, location.href);
          showExploitAlert(input.value);
          input.value = '';
          input.focus();
          setTimeout(() => redirectCaught('xss', location.href), 3000);
          return false;
        }
      }
    }, true);

    // Add honeypot to public forms dynamically
    document.querySelectorAll('form[data-public]').forEach(form => {
      if (!form.querySelector('input[name="website"]')) {
        const hp = document.createElement('input');
        hp.type = 'text'; hp.name = 'website';
        hp.setAttribute('tabindex', '-1');
        hp.setAttribute('autocomplete', 'off');
        hp.setAttribute('aria-hidden', 'true');
        hp.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
        form.appendChild(hp);
      }
    });
  }

  // ─── Anti-scraping: intercept fetch & XHR ────────────────────────────────
  function patchFetch() {
    const _origFetch = window.fetch;
    window.fetch = function (input, init) {
      const url = typeof input === 'string' ? input : (input?.url || '');
      const isSameOrigin = url.startsWith('/') || url.startsWith(location.origin) || url.startsWith('http://localhost');
      if (isSameOrigin) {
        init = init || {};
        init.headers = Object.assign({}, init.headers || {}, { 'X-Requested-By': 'mbg-radar' });
      }
      return _origFetch.call(this, input, init);
    };

    const _origXHROpen = XMLHttpRequest.prototype.open;
    const _origXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) {
      this._mbgUrl = url;
      return _origXHROpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function () {
      const url = this._mbgUrl || '';
      const isSameOrigin = url.startsWith('/') || url.startsWith(location.origin);
      if (isSameOrigin) this.setRequestHeader('X-Requested-By', 'mbg-radar');
      return _origXHRSend.apply(this, arguments);
    };
  }

  // ─── DevTools detection (non-aggressive, just blurs sensitive data) ───────
  function devToolsGuard() {
    let devOpen = false;
    const THRESHOLD = 160;
    function check() {
      const open = (window.outerWidth - window.innerWidth) > THRESHOLD || (window.outerHeight - window.innerHeight) > THRESHOLD;
      if (open && !devOpen) {
        devOpen = true;
        document.querySelectorAll('.protected-data').forEach(el => {
          el.style.filter = 'blur(6px)';
          el.title = 'Data dilindungi saat DevTools aktif';
        });
        showToast('Mode baca dilindungi aktif', 'info');
      } else if (!open && devOpen) {
        devOpen = false;
        document.querySelectorAll('.protected-data').forEach(el => {
          el.style.filter = '';
          el.title = '';
        });
      }
    }
    setInterval(check, 1500);
    window.addEventListener('resize', check);
  }

  // ─── Right-click disable (only on .protected-data elements) ─────────────
  function rightClickGuard() {
    document.addEventListener('contextmenu', function (e) {
      if (e.target.closest('.protected-data')) {
        e.preventDefault();
        showToast('Konten ini dilindungi dari penyalinan langsung', 'info');
      }
    });
  }

  // ─── Rate limiting UI for login form ─────────────────────────────────────
  function setupLoginRateLimit() {
    const form = document.getElementById('formLogin');
    if (!form) return;
    const KEY = 'mbg_login_attempts';
    const BLOCK_KEY = 'mbg_login_blocked_until';

    function getAttempts() { return parseInt(sessionStorage.getItem(KEY) || '0'); }
    function incAttempts() { sessionStorage.setItem(KEY, String(getAttempts() + 1)); }
    function isBlocked() {
      const until = parseInt(sessionStorage.getItem(BLOCK_KEY) || '0');
      return Date.now() < until;
    }
    function blockFor(ms) { sessionStorage.setItem(BLOCK_KEY, String(Date.now() + ms)); }

    // Listen for failed login responses
    window._mbgLoginFailed = function () {
      incAttempts();
      const attempts = getAttempts();
      if (attempts >= 5) {
        blockFor(5 * 60 * 1000); // block 5 min
        applyBlock();
        logThreat('brute_force', `${attempts}_attempts`, location.href);
        return;
      }
      if (attempts >= 3) {
        showMathChallenge();
      }
    };

    function applyBlock() {
      const btn = document.getElementById('btnSubmitLogin');
      if (!btn) return;
      const until = parseInt(sessionStorage.getItem(BLOCK_KEY) || '0');
      const remaining = Math.ceil((until - Date.now()) / 1000);
      btn.disabled = true;
      btn.textContent = `Tunggu ${remaining}s`;
      const iv = setInterval(function () {
        const r = Math.ceil((until - Date.now()) / 1000);
        if (r <= 0) {
          clearInterval(iv);
          btn.disabled = false;
          btn.innerHTML = '<span>Masuk ke Dashboard</span><span class="material-symbols-outlined text-[18px]">arrow_forward</span>';
          sessionStorage.removeItem(KEY);
          sessionStorage.removeItem(BLOCK_KEY);
        } else {
          btn.textContent = `Tunggu ${r}s`;
        }
      }, 1000);
    }

    function showMathChallenge() {
      if (document.getElementById('mbg-math-challenge')) return;
      const a = Math.floor(Math.random() * 9) + 1;
      const b = Math.floor(Math.random() * 9) + 1;
      const answer = a + b;
      const wrap = document.createElement('div');
      wrap.id = 'mbg-math-challenge';
      wrap.style.cssText = 'margin-top:12px;padding:12px 14px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:14px;';
      wrap.innerHTML = `<p style="font-size:12px;font-weight:700;color:#1e293b;margin-bottom:6px;">Verifikasi: Berapa ${a} + ${b}?</p>
        <input id="mbgMathInput" type="number" placeholder="Jawab di sini" style="width:100%;padding:8px 12px;border:1px solid #cbd5e1;border-radius:10px;font-size:13px;outline:none;">`;
      document.getElementById('btnSubmitLogin')?.insertAdjacentElement('beforebegin', wrap);

      const btn = document.getElementById('btnSubmitLogin');
      btn?.addEventListener('click', function checkMath(ev) {
        const val = parseInt(document.getElementById('mbgMathInput')?.value || '');
        if (val !== answer) {
          ev.preventDefault(); ev.stopImmediatePropagation();
          document.getElementById('mbgMathInput').style.borderColor = '#ef4444';
          return false;
        }
        wrap.remove();
        btn.removeEventListener('click', checkMath);
      }, true);
    }

    // Check on page load if already blocked
    if (isBlocked()) applyBlock();
  }

  // ─── Simple toast ─────────────────────────────────────────────────────────
  function showToast(msg, type) {
    const existing = document.getElementById('bgn-sec-toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.id = 'bgn-sec-toast';
    const bg = type === 'info' ? '#1e293b' : '#dc2626';
    t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:99990;padding:10px 18px;background:${bg};color:#fff;font-size:12px;font-weight:600;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.25);display:flex;align-items:center;gap:8px;max-width:320px;font-family:Plus Jakarta Sans,sans-serif;`;
    t.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;">shield</span><span>${msg}</span>`;
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .4s'; setTimeout(() => t.remove(), 400); }, 3500);
  }

  // ─── Init ─────────────────────────────────────────────────────────────────
  function init() {
    patchFetch();
    attachFormGuards();
    devToolsGuard();
    rightClickGuard();
    setupLoginRateLimit();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { escapeHTML, checkExploit, showToast, logThreat };
})();

window.BGNSecurity = BGNSecurity;
