/**
 * admin-header.js — Header & navigasi bersama untuk semua halaman dashboard/admin/*
 *
 * Cara pakai di tiap halaman:
 *   <body data-admin-page="telemetri">
 *   <div data-admin-header></div>
 *   <script src="../../assets/js/admin-header.js" defer></script>
 *
 * `data-admin-page` menentukan menu yang di-highlight (opsional).
 * Header di-inject ke elemen [data-admin-header] (diisi via outerHTML
 * agar header menjadi elemen <header> langsung di bawah <body>,
 * sehingga selector CSS `body > header` di dashboard.css tetap berlaku).
 */
(function () {
  'use strict';

  var NAV_ITEMS = [
    { page: 'index',       href: 'index.html',              icon: 'dashboard',            label: 'Dashboard',            desc: 'Ringkasan & KPI nasional',        accent: 'cyan' },
    { page: 'telemetri',   href: 'telemetri.html',          icon: 'monitoring',           label: 'Telemetri & KPI',      desc: 'Input 5 KPI telemetri',            accent: 'blue' },
    { page: 'distribusi',  href: 'distribusi.html',         icon: 'map',                  label: 'Distribusi Provinsi',  desc: 'Kepatuhan per provinsi',          accent: 'emerald' },
    { page: 'data-mbg',    href: 'data-mbg.html',           icon: 'school',               label: 'Data Penerima MBG',    desc: '8 jenjang pendidikan',            accent: 'amber' },
    { page: 'pengguna',    href: 'pengguna.html',           icon: 'manage_accounts',      label: 'Manajemen Akun',       desc: 'Akun & hak akses',                 accent: 'purple' },
    { page: 'aduan',       href: 'aduan.html',              icon: 'receipt_long',         label: 'Laporan Aduan',        desc: 'Pengaduan publik masuk',          accent: 'rose' },
    { page: 'chat',        href: 'chat.html',               icon: 'chat',                 label: 'Live Chat',            desc: 'Balas konsultasi publik',         accent: 'sky' },
    { page: 'logo-sppg',   href: 'logo-sppg.html',          icon: 'verified_user',        label: 'Logo SPPG',            desc: 'Verifikasi logo dapur',           accent: 'teal' },
    { page: 'backup-menu', href: 'backup-menu.html',        icon: 'backup_table',         label: 'Backup Menu',          desc: 'Arsip menu harian Excel',         accent: 'indigo' },
    { page: 'keamanan',    href: 'keamanan.html',           icon: 'security',             label: 'Log Keamanan',         desc: 'Audit WAF & eksploitasi',         accent: 'red' },
    { page: 'pemeliharaan',href: 'pemeliharaan.html',       icon: 'admin_panel_settings', label: 'Pemeliharaan',         desc: 'Kesehatan database Neon',         accent: 'violet' },
    { page: 'panel',       href: 'panel.html',              icon: 'admin_panel_settings', label: 'Panel Sistem',         desc: 'SPPG, approval & konfigurasi',    accent: 'slate' },
    { page: 'maintenance', href: 'maintenance.html',        icon: 'build',                label: 'Mode Maintenance',     desc: 'Aktif/nonaktif situs',            accent: 'orange' }
  ];

  var ACCENT_TEXT = {
    cyan: 'text-cyan-300', blue: 'text-blue-300', emerald: 'text-emerald-300',
    amber: 'text-amber-300', purple: 'text-purple-300', rose: 'text-rose-300',
    sky: 'text-sky-300', teal: 'text-teal-300', indigo: 'text-indigo-300',
    red: 'text-red-300', violet: 'text-violet-300', orange: 'text-orange-300',
    slate: 'text-slate-300'
  };
  var ACCENT_BG = {
    cyan: 'bg-cyan-400/15', blue: 'bg-blue-400/15', emerald: 'bg-emerald-400/15',
    amber: 'bg-amber-400/15', purple: 'bg-purple-400/15', rose: 'bg-rose-400/15',
    sky: 'bg-sky-400/15', teal: 'bg-teal-400/15', indigo: 'bg-indigo-400/15',
    red: 'bg-red-400/15', violet: 'bg-violet-400/15', orange: 'bg-orange-400/15',
    slate: 'bg-slate-400/15'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function init() {
    var host = document.querySelector('[data-admin-header]');
    if (!host) return;

    var current = document.body.getAttribute('data-admin-page') || '';

    var mobileLinks = NAV_ITEMS.map(function (item) {
      var active = item.page === current;
      return '<a href="' + item.href + '" class="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ' +
        (active ? 'bg-white/20 text-white' : 'bg-white/5 hover:bg-white/15 text-slate-200') + '">' +
        '<span class="material-symbols-outlined text-base ' + ACCENT_TEXT[item.accent] + '">' + item.icon + '</span>' +
        '<span class="flex-1">' + item.label + '</span>' +
        '<span class="text-[10px] opacity-60">' + esc(item.desc) + '</span></a>';
    }).join('');

    host.outerHTML =
      '<header class="admin-header w-full bg-primary text-white sticky top-0 z-40 px-4 sm:px-8 py-3 flex items-center justify-between shadow-md">' +
        '<div class="flex items-center gap-3 min-w-0">' +
          '<img src="../../assets/images/ic_launcher.png" alt="Logo BGN" class="h-9 w-auto shrink-0" loading="lazy">' +
          '<span class="font-extrabold text-sm sm:text-base tracking-tight truncate">Pusat Komando Satgas MBG</span>' +
        '</div>' +
        '<div class="flex items-center gap-2 shrink-0">' +
          '<div class="relative" id="mbgBellWrap">' +
            '<button id="mbgBellBtn" type="button" title="Notifikasi" aria-haspopup="true" aria-expanded="false" class="relative p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all flex items-center justify-center">' +
              '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>' +
              '<span id="mbgBellBadge" class="absolute -top-1 -right-1 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-black border border-white">0</span>' +
            '</button>' +
            '<div id="mbgBellPanel" class="hidden absolute right-0 mt-2 w-80 max-w-[90vw] bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden">' +
              '<div class="flex items-center justify-between px-4 py-3 border-b border-slate-100">' +
                '<span class="font-bold text-sm">Notifikasi Terkini</span>' +
                '<button id="mbgBellRead" type="button" class="text-[11px] font-semibold text-blue-700 hover:underline">Tandai dibaca</button>' +
              '</div>' +
              '<div id="mbgBellList" class="max-h-72 overflow-y-auto divide-y divide-slate-100"></div>' +
            '</div>' +
          '</div>' +
          '<a href="../komunikasi.html" class="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-xs font-semibold text-white transition-all">' +
            '<span class="material-symbols-outlined text-sm">forum</span><span>Komunikasi</span></a>' +
          '<a href="../../index.html" class="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-all">' +
            '<span class="material-symbols-outlined text-sm">public</span><span>Web Publik</span></a>' +
          '<a href="../../auth/login.html?logout=1" class="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white transition-all shadow-sm">' +
            '<span class="material-symbols-outlined text-sm">logout</span><span>Keluar</span></a>' +
          '<button id="dashHamburger" type="button" aria-expanded="false" aria-label="Buka menu navigasi" class="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all flex items-center justify-center">' +
            '<span class="material-symbols-outlined text-xl">menu</span>' +
          '</button>' +
        '</div>' +
      '</header>' +

      '<div id="dashMobileMenu" class="hidden fixed z-50 bg-primary border border-white/10 shadow-2xl px-4 py-4 flex flex-col gap-1.5 max-w-sm rounded-2xl" role="navigation" aria-label="Navigasi dashboard">' +
        '<div class="flex items-center gap-2.5 px-2 pb-2.5 mb-1 border-b border-white/10">' +
          '<span class="material-symbols-outlined text-lg text-cyan-300">menu_open</span>' +
          '<div class="flex-1 min-w-0"><p class="text-sm font-extrabold text-white leading-tight">Menu Navigasi</p>' +
          '<p class="text-[10px] text-slate-400">Pilih modul dashboard</p></div>' +
          '<span class="text-[9px] font-bold uppercase tracking-wider text-slate-500">Admin</span>' +
        '</div>' +
        mobileLinks +
        '<hr class="border-white/10 my-2">' +
        '<a href="../../index.html" class="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-200 text-sm font-semibold transition-all">' +
          '<span class="material-symbols-outlined text-base text-slate-300">public</span><span class="flex-1">Lihat Web Publik</span></a>' +
        '<a href="../account/profile.html" class="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-200 text-sm font-semibold transition-all">' +
          '<span class="material-symbols-outlined text-base text-indigo-300">account_circle</span><span class="flex-1">Atur Profil</span></a>' +
        '<a href="../account/password.html" class="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-200 text-sm font-semibold transition-all">' +
          '<span class="material-symbols-outlined text-base text-amber-300">key</span><span class="flex-1">Ganti Kata Sandi</span></a>' +
        '<a href="../../auth/login.html?logout=1" class="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-red-600/80 hover:bg-red-600 text-white text-sm font-bold transition-all">' +
          '<span class="material-symbols-outlined text-base">logout</span><span class="flex-1">Keluar</span></a>' +
      '</div>';

    initBell();
  }

  /* Panel notifikasi bell — logika sama seperti sebelumnya, kini per-halaman. */
  function initBell() {
    var wrap = document.getElementById('mbgBellWrap');
    var btn = document.getElementById('mbgBellBtn');
    var panel = document.getElementById('mbgBellPanel');
    var badge = document.getElementById('mbgBellBadge');
    var list = document.getElementById('mbgBellList');
    if (!wrap || !btn || !panel) return;

    var N = [];
    var unread = N.length;

    function escLocal(s) {
      return String(s).replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
      });
    }
    function render() {
      badge.textContent = unread;
      badge.style.display = unread > 0 ? '' : 'none';
      list.innerHTML = N.length ? N.map(function (n, i) {
        var dot = i < unread ? '<span class="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1.5"></span>' : '<span class="w-2 h-2 shrink-0"></span>';
        var tag = n[4] ? 'a href="' + n[4] + '"' : 'div';
        var end = n[4] ? 'a' : 'div';
        return '<' + tag + ' class="flex gap-3 px-4 py-3 hover:bg-slate-50 text-left">' + dot +
          '<span class="material-symbols-outlined text-[20px] text-slate-500 shrink-0">' + n[0] + '</span>' +
          '<span class="flex-1 min-w-0"><span class="block text-xs font-bold">' + escLocal(n[1]) + '</span>' +
          '<span class="block text-[11px] text-slate-500">' + escLocal(n[2]) + '</span>' +
          '<span class="block text-[10px] text-slate-400 mt-0.5">' + escLocal(n[3]) + '</span></span></' + end + '>';
      }).join('') : '<p class="px-4 py-5 text-xs text-slate-500">Belum ada notifikasi terbaru.</p>';
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = panel.classList.toggle('hidden') === false;
      btn.setAttribute('aria-expanded', open);
    });
    panel.addEventListener('click', function (e) {
      e.stopPropagation();
      if (e.target.closest('a')) panel.classList.add('hidden');
    });
    document.getElementById('mbgBellRead').addEventListener('click', function () { unread = 0; render(); });
    document.addEventListener('click', function () { panel.classList.add('hidden'); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') panel.classList.add('hidden'); });
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
