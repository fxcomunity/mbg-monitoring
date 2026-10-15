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
        '<span class="font-black tabular-nums tracking-tight">' + time + '</span>' +
        '<span class="text-[10px] font-bold opacity-70 ml-1">' + tzInfo.label + '</span>' +
        '<span class="hidden sm:inline text-[10px] opacity-50 ml-2">' + date + '</span>';
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
      if (!s) return;
      var roleLabel = { admin: 'Admin Satgas BGN', sppg: 'Mitra Dapur SPPG', user: 'Wali Murid / Publik' };
      var roleBg = { admin: 'bg-red-100 text-red-800', sppg: 'bg-blue-100 text-blue-800', user: 'bg-emerald-100 text-emerald-800' };
      var tzInfo = getIndonesianTimezone();
      card.innerHTML =
        '<div class="flex items-center gap-3 p-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/80 shadow-sm">' +
          '<div class="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-black text-base shrink-0">' +
            (s.name ? s.name.charAt(0).toUpperCase() : '?') +
          '</div>' +
          '<div class="min-w-0">' +
            '<p class="font-bold text-sm text-primary truncate">' + escHTML(s.name || '—') + '</p>' +
            '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full ' + (roleBg[s.role] || 'bg-slate-100 text-slate-700') + '">' +
              (roleLabel[s.role] || s.role) +
            '</span>' +
          '</div>' +
          '<div id="mbgDashClock" class="ml-auto text-right text-xs text-slate-600 shrink-0 leading-tight"></div>' +
        '</div>';
      startClock('mbgDashClock');
    } catch (e) {}
  }

  function escHTML(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = menu.classList.toggle('hidden') === false;
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      // Swap icon
      var icon = btn.querySelector('.material-symbols-outlined');
      if (icon) icon.textContent = isOpen ? 'close' : 'menu';
    });

    // Close on outside click
    document.addEventListener('click', function (e) {
      if (!menu.contains(e.target) && e.target !== btn) {
        menu.classList.add('hidden');
        btn.setAttribute('aria-expanded', 'false');
        var icon = btn.querySelector('.material-symbols-outlined');
        if (icon) icon.textContent = 'menu';
      }
    });

    // Close on link click inside menu
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        menu.classList.add('hidden');
        btn.setAttribute('aria-expanded', 'false');
        var icon = btn.querySelector('.material-symbols-outlined');
        if (icon) icon.textContent = 'menu';
      });
    });
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
    t.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">' + icon + '</span><span>' + msg + '</span>';
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
    loadXLSX(function () {
      try {
        var allKeys = [];
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.startsWith('mbg_menu_backup_')) {
            if (!dateStr || k === 'mbg_menu_backup_' + dateStr) allKeys.push(k);
          }
        }
        allKeys.sort();

        if (allKeys.length === 0) {
          showBackupToast('Tidak ada data backup untuk tanggal tersebut.', 'error');
          return;
        }

        // Kumpulkan semua baris dari semua keys
        var allRows = [];
        allKeys.forEach(function (k) {
          var entries = JSON.parse(localStorage.getItem(k) || '[]');
          entries.forEach(function (e) { allRows.push(e); });
        });

        if (allRows.length === 0) {
          showBackupToast('Data backup kosong.', 'error');
          return;
        }

        // Bangun headers dari union semua keys, dengan label Indonesia
        var headerKeys = [];
        allRows.forEach(function (row) {
          Object.keys(row).forEach(function (k) {
            if (headerKeys.indexOf(k) === -1) headerKeys.push(k);
          });
        });
        // Urutkan: field data dulu, metadata (_ts, _submitted_*) di akhir
        headerKeys.sort(function (a, b) {
          var aM = a.startsWith('_'), bM = b.startsWith('_');
          if (aM && !bM) return 1;
          if (!aM && bM) return -1;
          return 0;
        });

        // Baris header (label Indonesia kalau ada, fallback ke nama field)
        var headerRow = headerKeys.map(function (k) {
          return COLUMN_LABELS[k] || k.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
        });

        // Baris data
        var dataRows = allRows.map(function (row) {
          return headerKeys.map(function (k) { return row[k] !== undefined ? row[k] : ''; });
        });

        // Buat worksheet
        var wsData = [headerRow].concat(dataRows);
        var ws = window.XLSX.utils.aoa_to_sheet(wsData);

        // Style: lebar kolom otomatis
        var colWidths = headerRow.map(function (h, i) {
          var max = h.length;
          dataRows.forEach(function (r) {
            var v = String(r[i] || '');
            if (v.length > max) max = v.length;
          });
          return { wch: Math.min(max + 2, 40) };
        });
        ws['!cols'] = colWidths;

        // Buat workbook dengan metadata sheet ringkasan
        var wb = window.XLSX.utils.book_new();
        wb.Props = {
          Title: 'Backup Menu MBG',
          Subject: 'Data Menu Harian Program Makan Bergizi Gratis',
          Author: 'Radar MBG — Badan Gizi Nasional RI',
          CreatedDate: new Date()
        };

        window.XLSX.utils.book_append_sheet(wb, ws, 'Data Menu');

        // Sheet ringkasan per tanggal
        var summaryData = [['Tanggal', 'Jumlah Entry', 'Kota (contoh)']];
        allKeys.forEach(function (k) {
          var entries = JSON.parse(localStorage.getItem(k) || '[]');
          var contohKota = entries.length > 0 ? (entries[0].city || entries[0].kota || '—') : '—';
          summaryData.push([k.replace('mbg_menu_backup_', ''), entries.length, contohKota]);
        });
        var wsSummary = window.XLSX.utils.aoa_to_sheet(summaryData);
        wsSummary['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 24 }];
        window.XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan');

        // Nama file
        var filename = 'backup-menu-mbg-' + (dateStr || 'semua-' + new Date().toISOString().slice(0, 10)) + '.xlsx';
        window.XLSX.writeFile(wb, filename);

        showBackupToast('File Excel berhasil diunduh: ' + filename, 'success');
      } catch (err) {
        showBackupToast('Gagal membuat file Excel: ' + err.message, 'error');
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
  function init() {
    renderProfileCard();
    initHamburger();
    hookMenuForm();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
