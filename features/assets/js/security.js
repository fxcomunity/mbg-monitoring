/**
 * security.js — BGN Client-Side Security Guard & Anti-Exploit
 * Melindungi antarmuka dari Cross-Site Scripting (XSS) & Input Manipulation
 */
const BGNSecurity = (function() {
  'use strict';

  // Pola exploit berbahaya
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
    /\bexec(\s|\()+/gi
  ];

  /**
   * Sanitasi string untuk mencegah injeksi HTML
   */
  function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Deteksi apakah payload mengandung kode exploit
   */
  function checkExploit(str) {
    if (typeof str !== 'string') return false;
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(str)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Tampilkan Peringatan BGN Shield di Layar jika exploit terdeteksi
   */
  function showExploitAlert(detectedCode) {
    const existing = document.getElementById('bgn-waf-alert-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'bgn-waf-alert-modal';
    overlay.className = 'waf-shield-overlay';
    overlay.innerHTML = `
      <div class="waf-modal">
        <div class="waf-shield-badge">
          <span class="material-symbols-outlined text-[36px]">security</span>
        </div>
        <h3 class="text-xl font-bold text-gray-900 mb-2">Peringatan Keamanan BGN Shield</h3>
        <p class="text-sm text-gray-600 mb-4">
          Sistem mendeteksi upaya injeksi kode berbahaya (XSS / Script Injection). Tindakan ini dilarang dan dicatat dalam audit trail keamanan.
        </p>
        <div class="waf-log-details">
          <strong>Payload Terdeteksi:</strong> ${escapeHTML(detectedCode).slice(0, 100)}...
        </div>
        <button id="btnCloseWafAlert" class="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors shadow-sm">
          Mengerti &amp; Bersihkan Input
        </button>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('btnCloseWafAlert')?.addEventListener('click', () => {
      overlay.remove();
    });
  }

  /**
   * Pasang listener otomatis pada semua form di halaman
   */
  function attachFormGuards() {
    document.querySelectorAll('form').forEach(form => {
      form.addEventListener('submit', function(e) {
        const inputs = form.querySelectorAll('input, textarea');
        for (const input of inputs) {
          if (checkExploit(input.value)) {
            e.preventDefault();
            e.stopPropagation();
            showExploitAlert(input.value);
            input.value = '';
            input.focus();
            return false;
          }
        }
      });
    });
  }

  // Inisialisasi saat DOM siap
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachFormGuards);
  } else {
    attachFormGuards();
  }

  return {
    escapeHTML,
    checkExploit,
    showExploitAlert,
    attachFormGuards
  };
})();

// Export global
window.BGNSecurity = BGNSecurity;
