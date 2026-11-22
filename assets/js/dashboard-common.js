/**
 * dashboard-common.js
 * Shared utilities untuk semua dashboard:
 *  1. Jam realtime dengan timezone otomatis berdasarkan lokasi browser
 *  2. Greeting + role info dipindah ke in-page (bukan header)
 *  3. Hamburger menu untuk mobile
 *  4. Menu backup harian (auto-save ke localStorage per tanggal DATA,
 *     download sebagai XLSX / Excel via SheetJS)
 */

(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════
     1. TIMEZONE-AWARE CLOCK
     Gunakan Intl.DateTimeFormat dengan timeZone dari
     browser (otomatis sesuai lokasi OS user).
     Untuk Indonesia map ke zona WIB/WITA/WIT.
  ══════════════════════════════════════════════════════ */
  function getIndonesianTimezone() {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // Map timezone ke label Indonesia
      const tzMap = {
        'Asia/Jakarta':    { label: 'WIB', tz: 'Asia/Jakarta' },
        'Asia/Pontianak':  { label: 'WIB', tz: 'Asia/Jakarta' },
        'Asia/Makassar':   { label: 'WITA', tz: 'Asia/Makassar' },
        'Asia/Ujung_Pandang': { label: 'WITA', tz: 'Asia/Makassar' },
        'Asia/Jayapura':   { label: 'WIT', tz: 'Asia/Jayapura' },
        'Asia/Balikpapan': { label: 'WITA', tz: 'Asia/Makassar' },
        'Asia/Banjarmasin':{ label: 'WITA', tz: 'Asia/Makassar' },
        'Asia/Kupang':     { label: 'WITA', tz: 'Asia/Makassar' },
      };
      if (tzMap[tz]) return tzMap[tz];
      // Fallback: detect by UTC offset
      const offset = -new Date().getTimezoneOffset(); // in minutes
      if (offset === 420) return { label: 'WIB',  tz: 'Asia/Jakarta' };
      if (offset === 480) return { label: 'WITA', tz: 'Asia/Makassar' };
      if (offset === 540) return { label: 'WIT',  tz: 'Asia/Jayapura' };
      // Non-Indonesia fallback: use browser timezone as-is
      const abbr = new Date().toLocaleTimeString('id-ID', { timeZone: tz, timeZoneName: 'short' }).split(' ').pop();
      return { label: abbr || tz, tz };
    } catch (e) {
      return { label: 'WIB', tz: 'Asia/Jakarta' };
    }
  }

  function startClock(elementId) {
    var el = document.getElementById(elementId);
    if (!el) return;
    var tzInfo = getIndonesianTimezone();

    function tick() {
      var now = new Date();
      var time = now.toLocaleTimeString('id-ID', {
        timeZone: tzInfo.tz,
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      });
      var date = now.toLocaleDateString('id-ID', {
        timeZone: tzInfo.tz,
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
      });
      el.innerHTML =
        '<span class="font-black tabular-nums tracking-tight">' + escHTML(time) + '</span>' +
        '<span class="text-[10px] font-bold opacity-70 ml-1">' + escHTML(tzInfo.label) + '</span>' +
        '<span class="hidden sm:inline text-[10px] opacity-50 ml-2">' + escHTML(date) + '</span>';
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ═══════════════════════════════════════════════════════
     2. PROFILE CARD (ganti greeting di header)
     Render nama + role di elemen #dashProfileCard
     yang ada di dalam halaman (bukan header).
  ══════════════════════════════════════════════════════ */
  function renderProfileCard() {
    var card = document.getElementById('dashProfileCard');
    if (!card) return;
    try {
      var K = 'mbg_session';
      var s = JSON.parse(sessionStorage.getItem(K) || localStorage.getItem(K) || 'null');
      var accountLinks =
        '<nav class="flex flex-wrap gap-2" aria-label="Pengaturan akun">' +
          '<a href="../account/profile.html" class="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"><span class="material-symbols-outlined text-base text-indigo-600">account_circle</span>Atur profil</a>' +
          '<a href="../account/password.html" class="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"><span class="material-symbols-outlined text-base text-amber-600">key</span>Ganti kata sandi</a>' +
        '</nav>';
      if (!s) {
        card.innerHTML = accountLinks;
        return;
      }
      var roleLabel = { admin: 'Admin Satgas BGN', sppg: 'Mitra Dapur SPPG', user: 'Wali Murid / Publik' };
      var roleBg = { admin: 'bg-red-100 text-red-800', sppg: 'bg-blue-100 text-blue-800', user: 'bg-emerald-100 text-emerald-800' };
      var roleIcon = { admin: 'admin_panel_settings', sppg: 'kitchen', user: 'person' };
      var role = ['admin', 'sppg', 'user'].indexOf(s.role) >= 0 ? s.role : null;
      var profileName = String(s.name || '—');
      var avatarUrl = s.avatar_url || '';
      var avatarHtml = avatarUrl
        ? '<img src="' + escHTML(avatarUrl) + '" alt="Avatar" class="w-12 h-12 rounded-2xl object-cover shadow-md">'
        : '<div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-black text-xl shadow-md">' +
          escHTML(profileName.charAt(0).toUpperCase()) +
        '</div>';
      card.innerHTML =
        '<div class="flex items-center gap-4 p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm">' +
          avatarHtml +
          '<div class="min-w-0 flex-1">' +
            '<p class="font-bold text-base text-primary truncate">' + escHTML(profileName) + '</p>' +
            '<div class="flex items-center gap-2 mt-1">' +
              '<span class="material-symbols-outlined text-sm ' + (role === 'admin' ? 'text-red-600' : role === 'sppg' ? 'text-blue-600' : 'text-emerald-600') + '">' + (roleIcon[role] || 'person') + '</span>' +
              '<span class="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full ' + (roleBg[role] || 'bg-slate-100 text-slate-700') + '">' +
                escHTML(role ? roleLabel[role] : s.role) +
              '</span>' +
            '</div>' +
          '</div>' +
          '<div class="hidden sm:flex flex-col items-end gap-1 pl-4 border-l border-slate-200">' +
            '<div id="mbgDashClock" class="text-right text-sm font-bold text-slate-600 leading-tight"></div>' +
            '<span class="text-[10px] text-slate-400 font-medium">Waktu lokal</span>' +
          '</div>' +
        '</div>' +
        accountLinks;
      startClock('mbgDashClock');
    } catch (e) {}
  }

  function escHTML(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  /* ═══════════════════════════════════════════════════════
     3. HAMBURGER MENU (mobile nav)
     Requires: #dashHamburger (button), #dashMobileMenu (panel)
     dengan list link navigasi dashboard
  ══════════════════════════════════════════════════════ */
  function initHamburger() {
    var btn = document.getElementById('dashHamburger');
    var menu = document.getElementById('dashMobileMenu');
    if (!btn || !menu) return;

    btn.setAttribute('aria-controls', menu.id);
    menu.setAttribute('role', 'navigation');
    menu.setAttribute('aria-label', 'Navigasi dashboard');

    var backdrop = document.getElementById('dashMenuBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'dashMenuBackdrop';
      backdrop.setAttribute('aria-hidden', 'true');
      document.body.appendChild(backdrop);
    }
    backdrop.style.cssText = 'position:fixed;inset:0;z-index:45;background:rgba(2,6,23,.55);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);opacity:0;pointer-events:none;transition:opacity .2s ease;';

    function setOpen(open, restoreFocus) {
      menu.classList.toggle('hidden', !open);
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Tutup navigasi' : 'Buka navigasi');
      var icon = btn.querySelector('.material-symbols-outlined');
      if (icon) {
        icon.textContent = open ? 'close' : 'menu';
        icon.style.transition = 'transform .25s ease, opacity .2s ease';
        icon.style.transform = open ? 'rotate(90deg)' : 'rotate(0deg)';
      }
      backdrop.style.opacity = open ? '1' : '0';
      backdrop.style.pointerEvents = open ? 'auto' : 'none';
      if (restoreFocus) btn.focus();
    }
    setOpen(false);
    backdrop.addEventListener('click', function () { setOpen(false); });
    btn.addEventListener('click', function () {
      setOpen(menu.classList.contains('hidden'));
    });
    document.addEventListener('click', function (e) {
      if (!menu.contains(e.target) && !btn.contains(e.target)) setOpen(false);
    });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.classList.contains('hidden')) setOpen(false, true);
    });
    document.addEventListener('focusin', function (e) {
      if (!menu.contains(e.target) && !btn.contains(e.target)) setOpen(false);
    });
    var desktop = window.matchMedia(btn.classList.contains('md:hidden') ? '(min-width: 768px)' : '(min-width: 640px)');
    desktop.addEventListener('change', function () { setOpen(false); });
  }

  /* ═══════════════════════════════════════════════════════
     4. MENU BACKUP HARIAN
     Key: mbg_menu_backup_YYYY-MM-DD  ← tanggal dari field
     data form (menu_date / tanggal_distribusi), BUKAN
     tanggal hari ini submit. Jadi data tanggal 14 yang
     disubmit tanggal 28 tetap tersimpan di key _14.
     Download: XLSX (Excel) via SheetJS CDN.
  ══════════════════════════════════════════════════════ */

  var XLSX_CDN = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
  var xlsxLoaded = false;
  var xlsxLoadCallbacks = [];

  // Lazy-load SheetJS hanya saat dibutuhkan (klik download)
  function loadXLSX(cb) {
    if (xlsxLoaded && window.XLSX) { cb(); return; }
    xlsxLoadCallbacks.push(cb);
    if (xlsxLoadCallbacks.length > 1) return; // sudah ada request load sebelumnya
    var s = document.createElement('script');
    s.src = XLSX_CDN;
    s.onload = function () {
      xlsxLoaded = true;
      xlsxLoadCallbacks.forEach(function (fn) { fn(); });
      xlsxLoadCallbacks = [];
    };
    s.onerror = function () {
      showBackupToast('Gagal memuat library Excel. Periksa koneksi internet.', 'error');
      xlsxLoadCallbacks = [];
    };
    document.head.appendChild(s);
  }

  // Ambil tanggal data dari form: prioritaskan field menu_date / tanggal_distribusi
  // Fallback ke hari ini jika tidak ada
  function getDataDateKey(formData) {
    var dateVal = formData['menu_date']
      || formData['tanggal_distribusi']
      || formData['date']
      || formData['tanggal']
      || '';
    if (dateVal && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
      return 'mbg_menu_backup_' + dateVal;
    }
    // Coba parse format lain (DD/MM/YYYY dll)
    if (dateVal) {
      var d = new Date(dateVal);
      if (!isNaN(d)) return 'mbg_menu_backup_' + d.toISOString().slice(0, 10);
    }
    return 'mbg_menu_backup_' + new Date().toISOString().slice(0, 10);
  }

  function backupMenuEntry(data) {
    try {
      var key = getDataDateKey(data);
      var existing = JSON.parse(localStorage.getItem(key) || '[]');
      // Tambahkan metadata
      data._submitted_at = new Date().toISOString();
      data._submitted_by = (function () {
        try {
          var s = JSON.parse(sessionStorage.getItem('mbg_session') || localStorage.getItem('mbg_session') || 'null');
          return s ? (s.name + ' (' + s.role + ')') : 'Unknown';
        } catch (e) { return 'Unknown'; }
      })();
      existing.push(data);
      localStorage.setItem(key, JSON.stringify(existing));

      // Prune entries older than 365 days
      var cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 365);
      var keysToRemove = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.startsWith('mbg_menu_backup_')) {
          var dateStr = k.replace('mbg_menu_backup_', '');
          if (new Date(dateStr) < cutoff) keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(function (k) { localStorage.removeItem(k); });

      showBackupToast('Menu tanggal ' + key.replace('mbg_menu_backup_', '') + ' berhasil dibackup.', 'success');
    } catch (e) {}
  }

  function showBackupToast(msg, type) {
    var existing = document.getElementById('mbg-backup-toast');
    if (existing) existing.remove();
    var t = document.createElement('div');
    t.id = 'mbg-backup-toast';
    var bg = type === 'success' ? '#059669' : (type === 'error' ? '#dc2626' : '#1e293b');
    var icon = type === 'success' ? 'check_circle' : (type === 'error' ? 'error' : 'info');
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99990;padding:10px 20px;background:' + bg + ';color:#fff;font-size:12px;font-weight:600;border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,0.25);display:flex;align-items:center;gap:8px;font-family:Plus Jakarta Sans,sans-serif;white-space:nowrap;';
    t.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">' + icon + '</span><span>' + escHTML(msg) + '</span>';
    document.body.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .4s'; setTimeout(function () { t.remove(); }, 400); }, 3500);
  }

  // Intercept SPPG menu form submit → capture data before the toast intercepts it
  function hookMenuForm() {
    var form = document.getElementById('formAddMenu') || document.querySelector('form[data-menu-form]');
    if (!form) return;
    form.addEventListener('submit', function () {
      var data = {};
      form.querySelectorAll('input[name], select[name], textarea[name]').forEach(function (el) {
        if (el.name && el.name !== 'action') data[el.name] = el.value;
      });
      backupMenuEntry(data);
    }, true); // capture phase — runs before toast intercept
  }

  // ── Kolom header yang ditampilkan di Excel (label Indonesia) ──────────────
  var COLUMN_LABELS = {
    school_target:       'Sekolah Sasaran',
    city:                'Kota / Wilayah',
    menu_title:          'Nama Paket Menu',
    menu_date:           'Tanggal Distribusi',
    tanggal_distribusi:  'Tanggal Distribusi',
    protein:             'Protein (g)',
    karbohidrat:         'Karbohidrat (g)',
    lemak:               'Lemak (g)',
    kalori:              'Kalori (kkal)',
    catatan:             'Catatan',
    _submitted_at:       'Waktu Submit',
    _submitted_by:       'Disubmit Oleh'
  };

  // ── Download XLSX ─────────────────────────────────────────────────────────
  // dateStr: 'YYYY-MM-DD' untuk satu hari, undefined untuk semua
  window.downloadMenuBackupXLSX = function (dateStr) {
    loadXLSX(async function () {
      try {
        var localPhp = /^(localhost|127\.0\.0\.1|::1)$/.test(location.hostname);
        var endpoint = localPhp
          ? '../../api/menu.php?backup_action=backup_export'
          : '/api/menu/backup?export=1';
        if (dateStr) endpoint += (endpoint.includes('?') ? '&' : '?') + 'date=' + encodeURIComponent(dateStr);

        var response = await fetch(endpoint, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
        var result = await response.json();
        if (!response.ok || result.status !== 'success') {
          throw new Error(result.message || 'Server menolak permintaan backup.');
        }
        var allRows = Array.isArray(result.data) ? result.data : [];
        if (!allRows.length) {
          showBackupToast('Tidak ada data backup untuk tanggal tersebut.', 'error');
          return;
        }

        var headerKeys = [];
        allRows.forEach(function (row) {
          Object.keys(row).forEach(function (key) {
            if (headerKeys.indexOf(key) === -1) headerKeys.push(key);
          });
        });
        headerKeys.sort(function (a, b) {
          var aMetadata = a.startsWith('_');
          var bMetadata = b.startsWith('_');
          return aMetadata === bMetadata ? 0 : (aMetadata ? 1 : -1);
        });

        var headerRow = headerKeys.map(function (key) {
          return COLUMN_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
        });
        var dataRows = allRows.map(function (row) {
          return headerKeys.map(function (key) { return row[key] == null ? '' : row[key]; });
        });
        var ws = window.XLSX.utils.aoa_to_sheet([headerRow].concat(dataRows));
        ws['!cols'] = headerRow.map(function (header, index) {
          var max = header.length;
          dataRows.forEach(function (row) {
            max = Math.max(max, String(row[index] || '').length);
          });
          return { wch: Math.min(max + 2, 40) };
        });

        var wb = window.XLSX.utils.book_new();
        wb.Props = {
          Title: 'Backup Menu MBG',
          Subject: 'Data Menu Harian Program Makan Bergizi Gratis',
          Author: 'Radar MBG — Badan Gizi Nasional RI',
          CreatedDate: new Date()
        };
        window.XLSX.utils.book_append_sheet(wb, ws, 'Data Menu');

        var grouped = Object.create(null);
        allRows.forEach(function (row) {
          var date = String(row.menu_date || '').slice(0, 10);
          if (!date) return;
          if (!grouped[date]) grouped[date] = { count: 0, city: row.city || '—' };
          grouped[date].count++;
        });
        var summaryData = [['Tanggal', 'Jumlah Entry', 'Kota (contoh)']];
        Object.keys(grouped).sort().reverse().forEach(function (date) {
          summaryData.push([date, grouped[date].count, grouped[date].city]);
        });
        window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(summaryData), 'Ringkasan');

        var filename = 'backup-menu-mbg-' + (dateStr || 'semua-' + new Date().toISOString().slice(0, 10)) + '.xlsx';
        window.XLSX.writeFile(wb, filename);
        showBackupToast('File Excel berhasil diunduh: ' + filename, 'success');
      } catch (err) {
        showBackupToast('Gagal mengunduh backup dari database: ' + err.message, 'error');
      }
    });
  };

  // Backward-compat alias (admin dashboard memanggil ini)
  window.downloadMenuBackupCSV = window.downloadMenuBackupXLSX;

  // List available backup dates (for admin UI)
  window.getMenuBackupDates = function () {
    var dates = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.startsWith('mbg_menu_backup_')) {
        var dateStr = k.replace('mbg_menu_backup_', '');
        var entries = [];
        try { entries = JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) {}
        dates.push({ date: dateStr, count: entries.length });
      }
    }
    return dates.sort(function (a, b) { return b.date.localeCompare(a.date); });
  };

  /* ═══════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════ */
  function initDashboardPolish() {
    var header = document.querySelector('body > header');
    if (header) {
      function updateHeaderHeight() {
        document.documentElement.style.setProperty('--mbg-header-height', header.getBoundingClientRect().height + 'px');
      }
      updateHeaderHeight();
      if ('ResizeObserver' in window) {
        new ResizeObserver(updateHeaderHeight).observe(header);
      } else {
        window.addEventListener('resize', updateHeaderHeight);
      }
    }

    var main = document.querySelector('main');
    if (main && !document.querySelector('.skip-link')) {
      if (!main.id) main.id = 'dashboard-main';
      main.setAttribute('tabindex', '-1');
      var skip = document.createElement('a');
      skip.className = 'skip-link';
      skip.href = '#' + main.id;
      skip.textContent = 'Lewati navigasi ke konten utama';
      document.body.prepend(skip);
    }

    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!('IntersectionObserver' in window) || reducedMotion.matches) return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('mbg-reveal');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08 });
    document.querySelectorAll('main > .grid > *, main > .rounded-3xl, #dashProfileCard').forEach(function (element) {
      observer.observe(element);
    });
    reducedMotion.addEventListener('change', function (event) {
      if (event.matches) observer.disconnect();
    });
  }

  function init() {
    renderProfileCard();
    initDashboardPolish();
    initHamburger();
    hookMenuForm();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
