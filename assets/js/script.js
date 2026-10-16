/**
 * script.js "” Interaktivitas Utama Radar MBG Nasional
 * Terintegrasi penuh dengan Database Riil & Validasi Anti-Exploit
 */
document.addEventListener('DOMContentLoaded', function() {
  'use strict';

  // Inisialisasi Mobile Navigation
  initMobileNav();

  // Inisialisasi Lonceng Notifikasi Header
  initNotificationBell();

  // Inisialisasi Status Autentikasi Pengguna & Profil Dropdown
  initUserAuthStatus();

  // Inisialisasi Peta Telemetri Interaktif Realtime
  // Delay sedikit supaya container sudah punya dimensi sebelum Leaflet init
  setTimeout(initInteractiveTelemetryMap, 300);

  // Inisialisasi Telemetri & Distribusi Riil dari Database
  initTelemetriAndDistribusi();

  // Inisialisasi Filter & Real-Time Data (jika di halaman menu)
  initMenuPage();

  // Inisialisasi Global Search
  initGlobalSearch();

  // Inisialisasi Province Modal Drill-Down
  initProvinsiModal();
});

/**
 * Mendeteksi prefix path API relatif terhadap lokasi halaman saat ini.
 * Halaman di fitur/ memerlukan '../api/' sedangkan halaman di root memakai 'api/'.
 */
function getApiPrefix() {
  const path = window.location.pathname;
  if (path.includes('/fitur/') || path.includes('/dashboard/') || path.includes('/auth/') || path.includes('/map/')) {
    return '../api/';
  }
  return 'api/';
}

function initMobileNav() {
  const toggleBtn = document.getElementById('btnMobileNavToggle');
  const mobileMenu = document.getElementById('mobileNavMenu');

  if (toggleBtn && mobileMenu) {
    function toggleMenu(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      const isHidden = mobileMenu.classList.contains('hidden');
      if (isHidden) {
        mobileMenu.classList.remove('hidden');
        toggleBtn.setAttribute('aria-expanded', 'true');
      } else {
        mobileMenu.classList.add('hidden');
        toggleBtn.setAttribute('aria-expanded', 'false');
      }
    }

    toggleBtn.addEventListener('click', toggleMenu);
    toggleBtn.addEventListener('touchstart', function(e) {
      toggleMenu(e);
    }, { passive: false });

    // Tutup jika klik / tap di luar menu
    function closeMenuOutside(e) {
      if (!mobileMenu.contains(e.target) && !toggleBtn.contains(e.target)) {
        mobileMenu.classList.add('hidden');
        toggleBtn.setAttribute('aria-expanded', 'false');
      }
    }

    document.addEventListener('click', closeMenuOutside);
    document.addEventListener('touchstart', closeMenuOutside, { passive: true });
  }
}

function initGlobalSearch() {
  const searchInput = document.getElementById('navGlobalSearch');
  if (!searchInput) return;

  searchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      const query = searchInput.value.trim();
      if (query) {
        if (window.BGNSecurity && window.BGNSecurity.checkExploit(query)) {
          window.BGNSecurity.showExploitAlert(query);
          return;
        }
        window.location.href = 'menu-hari-ini.html?q=' + encodeURIComponent(query);
      }
    }
  });
}

/**
 * Memuat Data Telemetri & Tabel Kepatuhan Distribusi Riil dari SQL
 */
async function initTelemetriAndDistribusi() {
  const kpiPorsi = document.getElementById('kpiPorsiTersalurkan');
  const tableBody = document.getElementById('tableRegionalBody');

  const baseApi = window.location.pathname.includes('/features/') ? '../../api.php' : 'api.php';

  // 1. Ambil 5 KPI Telemetri Utama dari SQL
  if (kpiPorsi) {
    try {
      const res = await fetch(`${baseApi}?action=telemetri`);
      const json = await res.json();
      if (json && json.status === 'success' && json.data) {
        const d = json.data;
        const elPorsi = document.getElementById('kpiPorsiTersalurkan');
        const elTarget = document.getElementById('kpiPersenTarget');
        const elSppg = document.getElementById('kpiSppgAktif');
        const elSekolah = document.getElementById('kpiSekolahTerlayani');
        const elAkg = document.getElementById('kpiKepatuhanAkg');
        const elSuhu = document.getElementById('kpiSuhuMakanan');
        const elUpdate = document.getElementById('telemetryUpdateText');
        const elSla = document.getElementById('telemetrySlaDisplay');

        if (elPorsi) elPorsi.textContent = Number(d.porsi_tersalurkan).toLocaleString('id-ID');
        if (elTarget) elTarget.textContent = `${d.persen_target}% dari target harian`;
        if (elSppg) elSppg.textContent = Number(d.sppg_aktif).toLocaleString('id-ID');
        if (elSekolah) elSekolah.textContent = Number(d.sekolah_terlayani).toLocaleString('id-ID');
        if (elAkg) elAkg.textContent = `${d.kepatuhan_akg}%`;
        if (elSuhu) elSuhu.textContent = `${d.suhu_rata_rata}°C`;
        if (elUpdate && d.pembaruan_teks) elUpdate.textContent = `Pembaruan: ${d.pembaruan_teks}`;
        if (elSla && d.sla_distribusi) elSla.textContent = `${d.sla_distribusi}% Tepat Waktu`;
      }
    } catch (err) {
      console.warn('[BGN] Menggunakan fallback data telemetri:', err);
    }
  }

  // 2. Ambil Tabel Kepatuhan Distribusi Provinsi dari SQL
  if (tableBody) {
    loadDistribusiTable(baseApi, 'semua');

    // Filter Buttons (Jawa, Sumatera, dll)
    const regionBtns = document.querySelectorAll('.region-telemetry-btn');
    regionBtns.forEach(btn => {
      btn.addEventListener('click', function() {
        regionBtns.forEach(b => b.classList.remove('bg-primary', 'text-white'));
        this.classList.add('bg-primary', 'text-white');
        const reg = this.getAttribute('data-region') || 'semua';
        loadDistribusiTable(baseApi, reg);
      });
    });
  }
}

async function loadDistribusiTable(baseApi, region = 'semua') {
  const tableBody = document.getElementById('tableRegionalBody');
  if (!tableBody) return;

  try {
    const url = region && region !== 'semua' 
      ? `${baseApi}?action=distribusi&region=${encodeURIComponent(region)}` 
      : `${baseApi}?action=distribusi`;
    
    const res = await fetch(url);
    const json = await res.json();

    if (json && json.status === 'success' && Array.isArray(json.data) && json.data.length > 0) {
      let html = '';
      json.data.forEach(item => {
        const prov = BGNSecurity ? BGNSecurity.escapeHTML(item.provinsi) : item.provinsi;
        const target = Number(item.target_porsi).toLocaleString('id-ID');
        const ketepatan = `${item.ketepatan}%`;
        const status = BGNSecurity ? BGNSecurity.escapeHTML(item.status) : item.status;
        const regCode = item.region_code || 'nasional';

        html += `
          <tr class="hover:bg-surface-canvas transition-colors cursor-pointer" data-region="${regCode}" data-provinsi="${prov}" title="Klik untuk lihat SPPG">
            <td class="py-3 px-3 font-semibold text-primary">${prov}</td>
            <td class="py-3 px-3">${target}</td>
            <td class="py-3 px-3 text-status-success font-semibold">${ketepatan}</td>
            <td class="py-3 px-3">
              <span class="px-2 py-0.5 rounded-full bg-surface-container text-secondary font-label-sm text-label-sm">${status}</span>
            </td>
          </tr>
        `;
      });
      tableBody.innerHTML = html;
    }
  } catch (err) {
    console.error('[BGN] Gagal memuat tabel distribusi:', err);
  }
}

function initMenuPage() {
  const menuContainer = document.getElementById('menu-list-container');
  if (!menuContainer) return;

  const urlParams = new URLSearchParams(window.location.search);
  const initialQuery = urlParams.get('q') || '';

  loadMenuData({ search: initialQuery });

  const filterBtn = document.getElementById('btnApplyFilter');
  if (filterBtn) {
    filterBtn.addEventListener('click', function() {
      const searchVal = document.getElementById('filterSearch')?.value || '';
      const sppgVal = document.getElementById('filterSppg')?.value || '';
      const dateVal = document.getElementById('filterDate')?.value || '';

      if (window.BGNSecurity && (window.BGNSecurity.checkExploit(searchVal) || window.BGNSecurity.checkExploit(sppgVal))) {
        window.BGNSecurity.showExploitAlert(searchVal || sppgVal);
        return;
      }

      loadMenuData({
        search: searchVal,
        sppg: sppgVal,
        date: dateVal
      });
    });
  }
}

async function loadMenuData(params = {}) {
  const container = document.getElementById('menu-list-container');
  if (!container) return;

  container.innerHTML = `
    <div class="col-span-full py-16 flex flex-col items-center justify-center text-center">
      <div class="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
      <p class="text-sm font-medium text-gray-500">Memuat data resmi dari database BGN...</p>
    </div>
  `;

  try {
    const res = await window.BGNApi.getMenuHariIni(params);
    if (!res || res.status !== 'success' || !res.data || res.data.length === 0) {
      renderEmptyState(container, params.search);
      return;
    }

    renderMenuItems(container, res.data);
  } catch (err) {
    console.error('Error loading menu:', err);
    renderEmptyState(container);
  }
}

function renderEmptyState(container, searchKeyword = '') {
  const msg = searchKeyword 
    ? `Tidak ditemukan menu yang sesuai dengan pencarian "<strong>${BGNSecurity.escapeHTML(searchKeyword)}</strong>".`
    : `Belum ada data menu terverifikasi untuk filter yang dipilih. Silakan masukkan data melalui Dashboard SPPG.`;

  container.innerHTML = `
    <div class="col-span-full empty-state-box">
      <div class="empty-state-icon">
        <span class="material-symbols-outlined text-[32px]">dinner_dining</span>
      </div>
      <h3 class="text-lg font-bold text-gray-900 mb-1">Belum Ada Menu Terverifikasi</h3>
      <p class="text-sm text-gray-500 max-w-md mb-6">${msg}</p>
      <div class="flex flex-wrap gap-3">
        <a href="menu-hari-ini.html" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition-colors">
          Reset Filter
        </a>
        <a href="login.html" class="px-4 py-2 bg-primary hover:bg-primary-container text-white text-xs font-semibold rounded-xl transition-colors">
          Masuk ke Portal SPPG
        </a>
      </div>
    </div>
  `;
}

function renderMenuItems(container, items) {
  let html = '';
  items.forEach(item => {
    const namaMenu = BGNSecurity.escapeHTML(item.nama_menu || 'Menu Terverifikasi BGN');
    const namaSppg = BGNSecurity.escapeHTML(item.nama_sppg || 'SPPG Nasional');
    const wilayah = BGNSecurity.escapeHTML(item.wilayah || 'Indonesia');
    const targetSekolah = BGNSecurity.escapeHTML(item.target_sekolah || '-');
    const kalori = item.kalori_total || 620;
    const protein = item.protein_gram || 25;
    const karbo = item.karbo_gram || 75;
    const lemak = item.lemak_gram || 18;
    const status = item.status_distribusi || 'Telah Tiba di Sekolah';
    const foto = item.foto_url || 'assets/images/food-placeholder.svg';

    html += `
      <div class="bg-surface-card rounded-2xl border border-border-subtle overflow-hidden card-hover flex flex-col">
        <div class="relative h-48 w-full bg-surface-container-low overflow-hidden">
          <img src="${foto}" alt="${namaMenu}" class="w-full h-full object-cover" onerror="this.src='assets/images/food-placeholder.svg'" />
          <div class="absolute top-3 right-3 px-3 py-1 rounded-full bg-white/90 backdrop-blur-sm text-xs font-bold text-primary shadow-sm flex items-center gap-1">
            <span class="material-symbols-outlined text-[14px] text-status-success">verified</span>
            <span>Terverifikasi BGN</span>
          </div>
          <div class="absolute bottom-3 left-3 px-3 py-1 rounded-lg bg-primary/80 backdrop-blur-sm text-xs font-medium text-white flex items-center gap-1.5">
            <span class="material-symbols-outlined text-[14px]">storefront</span>
            <span>${namaSppg} (${wilayah})</span>
          </div>
        </div>
        <div class="p-5 flex-1 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between gap-2 mb-2">
              <span class="text-xs font-bold text-secondary uppercase tracking-wider">${status}</span>
              <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">${kalori} kkal</span>
            </div>
            <h4 class="font-headline-sm text-base text-primary font-bold mb-1">${namaMenu}</h4>
            <p class="text-xs text-gray-500 mb-4 flex items-center gap-1">
              <span class="material-symbols-outlined text-[14px]">school</span>
              <span>Target: ${targetSekolah}</span>
            </p>
          </div>
          <div class="pt-3 border-t border-border-subtle flex items-center justify-between text-xs text-gray-600">
            <span>Protein: <strong>${protein}g</strong></span>
            <span>Karbo: <strong>${karbo}g</strong></span>
            <span>Lemak: <strong>${lemak}g</strong></span>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

/**
 * Sesi statis (Cloudflare Pages / tanpa PHP): dibaca dari localStorage 'mbg_session'
 * yang diisi login.html. Dipakai untuk semua role: admin, sppg, user.
 */
function clearStaticSession() {
  try { localStorage.removeItem('mbg_session'); sessionStorage.removeItem('mbg_session'); } catch (_) {}
}

function readStaticSession() {
  try {
    const s = JSON.parse(localStorage.getItem('mbg_session') || sessionStorage.getItem('mbg_session') || 'null');
    if (!s || !['admin', 'sppg', 'user'].includes(s.role)) return null;
    if (s.exp && s.exp < Date.now()) { clearStaticSession(); return null; }
    return s;
  } catch (_) { return null; }
}

/**
 * Ganti tombol "Portal Masuk" di navbar (desktop + mobile) jadi
 * tombol "Dashboard" + "Keluar" kalau sesi statis masih aktif.
 * Return true kalau berhasil diterapkan.
 */
function applyStaticSessionFallback() {
  // Digantikan oleh navbar dropdown di index.html
  // Tidak inject Keluar button agar tidak duplikat
  return false;
}

/**
 * Cek status autentikasi aktif via API dan render Profil Avatar + Dropdown jika login
 */
async function initUserAuthStatus() {
  // Sesi statis (login.html) punya prioritas; kalau ada, tidak perlu cek PHP
  if (applyStaticSessionFallback()) return;
  try {
    const res = await fetch(getApiPrefix() + 'auth_user.php', { credentials: 'same-origin' });
    if (!res.ok) { applyStaticSessionFallback(); return; }
    const data = await res.json();

    if (!data.logged_in || !data.user) { applyStaticSessionFallback(); return; }

    const u = data.user;
    const desktopLoginLink = document.querySelector('header nav + div a[href*="login.html"], header a[href*="login.html"]:not(#mobileNavMenu a)');
    const mobileLoginLink = document.querySelector('#mobileNavMenu a[href*="login.html"]');

    // Desktop Profile Dropdown
    if (desktopLoginLink) {
      const wrapper = document.createElement('div');
      wrapper.className = 'relative inline-block text-left';
      wrapper.id = 'headerUserDropdownContainer';

      wrapper.innerHTML = `
        <button id="btnHeaderProfile" type="button" class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-border-subtle shadow-sm transition-all focus:outline-none">
          <img src="${u.avatar}" alt="${BGNSecurity.escapeHTML(u.full_name)}" class="w-7 h-7 rounded-full border border-primary/20 object-cover bg-white">
          <div class="flex flex-col text-left hidden lg:flex">
            <span class="text-xs font-bold text-on-surface leading-tight max-w-[110px] truncate">${BGNSecurity.escapeHTML(u.full_name)}</span>
            <span class="text-[10px] text-secondary font-medium leading-none">${BGNSecurity.escapeHTML(u.role_label)}</span>
          </div>
          <span class="material-symbols-outlined text-[16px] text-outline">expand_more</span>
        </button>
        
        <div id="headerProfileMenu" class="hidden absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50">
          <div class="px-4 py-3 border-b border-slate-100 flex items-center gap-3 bg-slate-50/70">
            <img src="${u.avatar}" alt="${BGNSecurity.escapeHTML(u.full_name)}" class="w-10 h-10 rounded-full border-2 border-white shadow-sm bg-white">
            <div class="flex flex-col overflow-hidden">
              <span class="text-xs font-bold text-slate-900 truncate">${BGNSecurity.escapeHTML(u.full_name)}</span>
              <span class="text-[11px] text-slate-500 font-mono truncate">@${BGNSecurity.escapeHTML(u.username)}</span>
              <span class="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 w-fit">${BGNSecurity.escapeHTML(u.role_label)}</span>
            </div>
          </div>

          <div class="py-1">
            <a href="dashboard/${u.role}/" class="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
              <span class="material-symbols-outlined text-[18px] text-blue-600">dashboard</span>
              <span>Dashboard ${u.role.toUpperCase()}</span>
            </a>
            ${u.role === 'admin' ? `
            <a href="dashboard/admin/#telemetry-manager" class="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
              <span class="material-symbols-outlined text-[18px] text-emerald-600">monitoring</span>
              <span>Panel Input Telemetri & KPI</span>
            </a>
            <a href="dashboard/admin/#maintenance-panel" class="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
              <span class="material-symbols-outlined text-[18px] text-purple-600">admin_panel_settings</span>
              <span>Panel Pemeliharaan Sistem</span>
            </a>
            ` : ''}
            ${u.role === 'sppg' ? `
            <a href="dashboard/sppg/#input-menu" class="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
              <span class="material-symbols-outlined text-[18px] text-emerald-600">soup_kitchen</span>
              <span>Panel Dapur SPPG & Input Menu</span>
            </a>
            <a href="dashboard/sppg/#uji-akg" class="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
              <span class="material-symbols-outlined text-[18px] text-amber-600">biotech</span>
              <span>Uji Sampel & AKG Makanan</span>
            </a>
            ` : ''}
            ${u.role === 'user' ? `
            <a href="dashboard/user/#riwayat-aduan" class="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
              <span class="material-symbols-outlined text-[18px] text-amber-600">receipt_long</span>
              <span>Status Aduan Saya</span>
            </a>
            ` : ''}
            <a href="dashboard/${u.role}/#pengaturan-profil" class="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
              <span class="material-symbols-outlined text-[18px] text-indigo-600">account_circle</span>
              <span>Atur Foto / Logo Profil</span>
            </a>
            <a href="dashboard/${u.role}/#ganti-password" class="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
              <span class="material-symbols-outlined text-[18px] text-amber-600">key</span>
              <span>Ganti Kata Sandi</span>
            </a>
          </div>

          <div class="pt-1 border-t border-slate-100">
            <a href="login.html?logout=1" class="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors">
              <span class="material-symbols-outlined text-[18px] text-red-500">logout</span>
              <span>Keluar (Logout)</span>
            </a>
          </div>
        </div>
      `;

      desktopLoginLink.replaceWith(wrapper);

      // Event listener dropdown
      const btn = document.getElementById('btnHeaderProfile');
      const menu = document.getElementById('headerProfileMenu');
      if (btn && menu) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          menu.classList.toggle('hidden');
        });

        document.addEventListener('click', function(e) {
          if (!wrapper.contains(e.target)) {
            menu.classList.add('hidden');
          }
        });
      }
    }

    // Mobile Profile Dropdown in menu
    if (mobileLoginLink) {
      const mobWrapper = document.createElement('div');
      mobWrapper.className = 'p-3 bg-surface-container rounded-xl flex flex-col gap-2 border border-border-subtle';
      mobWrapper.innerHTML = `
        <div class="flex items-center gap-3">
          <img src="${u.avatar}" alt="${BGNSecurity.escapeHTML(u.full_name)}" class="w-9 h-9 rounded-full border border-primary/20 bg-white">
          <div class="flex flex-col">
            <span class="text-xs font-bold text-on-surface">${BGNSecurity.escapeHTML(u.full_name)}</span>
            <span class="text-[11px] text-secondary font-medium">${BGNSecurity.escapeHTML(u.role_label)}</span>
          </div>
        </div>
        <div class="flex flex-col gap-1 pt-2 border-t border-border-subtle">
          <a href="dashboard/${u.role}/" class="px-3 py-1.5 text-xs font-bold text-primary rounded-lg bg-surface-container-high flex items-center gap-2">
            <span class="material-symbols-outlined text-[16px]">dashboard</span>
            <span>Buka Dashboard</span>
          </a>
          ${u.role === 'admin' ? `
          <a href="dashboard/admin/#maintenance-panel" class="px-3 py-1.5 text-xs font-bold text-purple-700 rounded-lg bg-purple-50 flex items-center gap-2">
            <span class="material-symbols-outlined text-[16px]">admin_panel_settings</span>
            <span>Panel Pemeliharaan Sistem</span>
          </a>
          ` : ''}
          ${u.role === 'sppg' ? `
          <a href="dashboard/sppg/#input-menu" class="px-3 py-1.5 text-xs font-bold text-emerald-700 rounded-lg bg-emerald-50 flex items-center gap-2">
            <span class="material-symbols-outlined text-[16px]">soup_kitchen</span>
            <span>Panel Dapur SPPG</span>
          </a>
          ` : ''}
          <a href="dashboard/${u.role}/#pengaturan-profil" class="px-3 py-1.5 text-xs font-bold text-slate-700 rounded-lg hover:bg-surface-container-high flex items-center gap-2">
            <span class="material-symbols-outlined text-[16px] text-indigo-600">account_circle</span>
            <span>Atur Foto / Logo</span>
          </a>
          <a href="dashboard/${u.role}/#ganti-password" class="px-3 py-1.5 text-xs font-bold text-slate-700 rounded-lg hover:bg-surface-container-high flex items-center gap-2">
            <span class="material-symbols-outlined text-[16px] text-amber-600">key</span>
            <span>Ganti Kata Sandi</span>
          </a>
          <a href="login.html?logout=1" class="px-3 py-1.5 text-xs font-bold text-red-600 rounded-lg hover:bg-red-50 flex items-center gap-2">
            <span class="material-symbols-outlined text-[16px]">logout</span>
            <span>Keluar (Logout)</span>
          </a>
        </div>
      `;
      mobileLoginLink.replaceWith(mobWrapper);
    }
  } catch (err) {
    console.warn('Gagal memuat status autentikasi:', err);
    applyStaticSessionFallback();
  }
}

/**
 * ============================================================
 * Lonceng Notifikasi Terkini & Realtime Sinkronisasi
 * ============================================================
 */
function initNotificationBell() {
  const btnBell = document.getElementById('btnHeaderNotif');
  const dropdown = document.getElementById('headerNotifDropdown');
  const badge = document.getElementById('headerNotifBadge');
  const totalText = document.getElementById('notifTotalBadgeText');
  const listContainer = document.getElementById('headerNotifList');
  const container = document.getElementById('headerNotifContainer');

  if (!btnBell || !dropdown) return;

  btnBell.addEventListener('click', function(e) {
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
    fetchNotifications();
  });

  document.addEventListener('click', function(e) {
    if (container && !container.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });

  async function fetchNotifications() {
    try {
      const res = await fetch(getApiPrefix() + 'notifications.php');
      const json = await res.json();
      if (!json || json.status !== 'success') return;

      const data = json.data;
      const count = data.badge_count || 0;

      if (badge) {
        if (count > 0) {
          badge.textContent = count > 99 ? '99+' : count;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      }

      if (totalText) {
        totalText.textContent = `${count} Baru`;
      }

      if (listContainer) {
        let itemsHtml = '';
        if (data.pending_sppg_logos > 0) {
          itemsHtml += `
            <a href="dashboard/admin/#verifikasi-logo-sppg" class="block px-4 py-3 hover:bg-amber-50/70 transition-colors bg-amber-50/30">
              <div class="flex items-start gap-2.5">
                <span class="material-symbols-outlined text-amber-600 text-[20px] shrink-0">verified_user</span>
                <div>
                  <p class="text-xs font-bold text-slate-800">Verifikasi Logo Dapur SPPG (${data.pending_sppg_logos})</p>
                  <p class="text-[11px] text-slate-600 mt-0.5">Ada permohonan pergantian logo SPPG yang menunggu konfirmasi Satgas BGN.</p>
                </div>
              </div>
            </a>
          `;
        }

        if (data.latest_reports && data.latest_reports.length > 0) {
          data.latest_reports.forEach(r => {
            const timeAgo = r.created_at ? new Date(r.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB' : 'Baru saja';
            itemsHtml += `
              <a href="dashboard/admin/" class="block px-4 py-2.5 hover:bg-slate-50 transition-colors">
                <div class="flex items-start gap-2.5">
                  <span class="material-symbols-outlined text-red-500 text-[18px] shrink-0">report_problem</span>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between">
                      <span class="text-[11px] font-mono font-bold text-blue-700">${BGNSecurity.escapeHTML(r.ticket_code)}</span>
                      <span class="text-[10px] text-slate-400">${timeAgo}</span>
                    </div>
                    <p class="text-xs font-semibold text-slate-800 truncate">${BGNSecurity.escapeHTML(r.issue_category)}: ${BGNSecurity.escapeHTML(r.school_target || '-')}</p>
                    <p class="text-[11px] text-slate-500 truncate">${BGNSecurity.escapeHTML(r.description)}</p>
                  </div>
                </div>
              </a>
            `;
          });
        }

        if (!itemsHtml) {
          itemsHtml = `
            <div class="p-4 text-center text-xs text-slate-400">
              <span class="material-symbols-outlined text-[28px] text-slate-300 block mb-1">done_all</span>
              Tidak ada laporan baru. Sistem telemetri dan logistik berjalan normal.
            </div>
          `;
        }

        listContainer.innerHTML = itemsHtml;
      }
    } catch (err) {
      console.warn('Gagal memuat notifikasi:', err);
    }
  }

  // Poll notifikasi pertama kali & setiap 20 detik
  fetchNotifications();
  setInterval(fetchNotifications, 20000);
}

/**
 * ============================================================
 * Peta Telemetri Wilayah Logistik MBG (Leaflet Realtime)
 * Realtime Zoom In / Zoom Out + Titik Armada Van Termal IoT
 * ============================================================
 */
let mbgLeafletMap = null;
let mbgMarkers = [];
let mbgDeliveryVans = [];

function initInteractiveTelemetryMap() {
  const mapElement = document.getElementById('mbgInteractiveMap');
  if (!mapElement || typeof L === 'undefined') return;

  // Hancurkan instance lama jika ada (hindari double init)
  if (mbgLeafletMap) {
    mbgLeafletMap.remove();
    mbgLeafletMap = null;
    mbgMarkers = [];
    mbgDeliveryVans = [];
  }

  mbgLeafletMap = L.map('mbgInteractiveMap', {
    center: [-6.2088, 106.8456],
    zoom: 11,
    zoomControl: true,
    scrollWheelZoom: true,
    attributionControl: true
  });

  // ── OpenStreetMap tile — 100% gratis, zero API key ──────────────────────
  // Pakai URL tanpa subdomains variabel untuk hindari cache mix lama
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
  }).addTo(mbgLeafletMap);

  // Force Leaflet hitung ulang ukuran container (kritis jika parent div baru visible)
  setTimeout(() => { if (mbgLeafletMap) mbgLeafletMap.invalidateSize(); }, 200);

  // ── Data Stasiun SPPG — tersebar berbeda per wilayah ────────────────────
  const sppgStations = [
    { name: 'SPPG Jakarta Pusat',         lat: -6.1824, lng: 106.8290, radius: 4500, porsi: '34.200', temp: '65.4°C', wilayah: 'DKI Jakarta' },
    { name: 'SPPG Jakarta Selatan',        lat: -6.2615, lng: 106.8106, radius: 3800, porsi: '28.500', temp: '64.8°C', wilayah: 'DKI Jakarta' },
    { name: 'SPPG Jakarta Timur',          lat: -6.2251, lng: 106.9004, radius: 4200, porsi: '31.000', temp: '65.1°C', wilayah: 'DKI Jakarta' },
    { name: 'SPPG Bandung Kota',           lat: -6.9175, lng: 107.6191, radius: 5000, porsi: '41.100', temp: '66.2°C', wilayah: 'Jawa Barat' },
    { name: 'SPPG Bekasi Raya',            lat: -6.2349, lng: 106.9896, radius: 4600, porsi: '37.400', temp: '65.7°C', wilayah: 'Jawa Barat' },
    { name: 'SPPG Depok',                  lat: -6.4025, lng: 106.7942, radius: 4000, porsi: '29.800', temp: '64.5°C', wilayah: 'Jawa Barat' },
    { name: 'SPPG Semarang Tengah',        lat: -6.9932, lng: 110.4203, radius: 4200, porsi: '31.800', temp: '65.1°C', wilayah: 'Jawa Tengah' },
    { name: 'SPPG Solo Raya',              lat: -7.5661, lng: 110.8314, radius: 3900, porsi: '27.600', temp: '63.9°C', wilayah: 'Jawa Tengah' },
    { name: 'SPPG Surabaya Pusat',         lat: -7.2575, lng: 112.7521, radius: 4800, porsi: '39.000', temp: '65.9°C', wilayah: 'Jawa Timur' },
    { name: 'SPPG Malang Kota',            lat: -7.9797, lng: 112.6304, radius: 4300, porsi: '32.500', temp: '64.3°C', wilayah: 'Jawa Timur' },
    { name: 'SPPG Medan Kota',             lat:  3.5952, lng:  98.6722, radius: 5200, porsi: '43.000', temp: '66.8°C', wilayah: 'Sumatera Utara' },
    { name: 'SPPG Makassar Pusat',         lat: -5.1477, lng: 119.4327, radius: 4700, porsi: '38.200', temp: '65.6°C', wilayah: 'Sulawesi Selatan' },
    { name: 'SPPG Denpasar',               lat: -8.6705, lng: 115.2126, radius: 3600, porsi: '26.100', temp: '64.0°C', wilayah: 'Bali' },
  ];

  // ── Render SPPG markers + radius ────────────────────────────────────────
  sppgStations.forEach(sppg => {
    L.circle([sppg.lat, sppg.lng], {
      color: '#059669', fillColor: '#10B981', fillOpacity: 0.12,
      radius: sppg.radius, weight: 1.5, dashArray: '4 4'
    }).addTo(mbgLeafletMap);

    const iconSppg = L.divIcon({
      className: '',
      html: `<div style="
        background:linear-gradient(135deg,#059669,#047857);
        color:#fff; width:32px; height:32px; border-radius:50%;
        display:flex; align-items:center; justify-content:center;
        box-shadow:0 2px 8px rgba(5,150,105,0.5); border:2.5px solid #fff;
        font-size:15px; line-height:1;">🏭</div>`,
      iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -18]
    });

    const m = L.marker([sppg.lat, sppg.lng], { icon: iconSppg }).addTo(mbgLeafletMap);
    m.bindPopup(`
      <div style="font-family:'Plus Jakarta Sans',sans-serif;min-width:190px;padding:2px 0">
        <div style="font-size:9px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px;">Dapur SPPG Terakreditasi BGN</div>
        <div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:6px;">${sppg.name}</div>
        <div style="font-size:11px;color:#475569;line-height:1.7;">
          <div>📍 <strong>${sppg.wilayah}</strong></div>
          <div>🍱 Kapasitas: <strong>${sppg.porsi} porsi/hari</strong></div>
          <div>🌡️ Suhu Termal: <strong style="color:#059669;">${sppg.temp}</strong></div>
          <div>📐 Radius Layanan: <strong>${sppg.radius/1000} km</strong></div>
        </div>
      </div>`, { maxWidth: 240 });
    mbgMarkers.push(m);
  });

  // ── Data Van — tersebar berbeda per kota ─────────────────────────────────
  const initialVans = [
    { id: 'VAN-JKT-01', lat: -6.1950, lng: 106.8315, temp: 65.8, dest: 'SDN Menteng 01',       status: 'Mengantar', region: 'dki' },
    { id: 'VAN-JKT-02', lat: -6.2080, lng: 106.8520, temp: 66.2, dest: 'SMPN 1 Jakarta',       status: 'Mengantar', region: 'dki' },
    { id: 'VAN-JKT-03', lat: -6.2410, lng: 106.7980, temp: 64.9, dest: 'SDN Cilandak Barat',   status: 'Menuju Sekolah', region: 'dki' },
    { id: 'VAN-JKT-04', lat: -6.1720, lng: 106.8650, temp: 65.3, dest: 'SDN Rawamangun 02',    status: 'Mengantar', region: 'dki' },
    { id: 'VAN-BDG-01', lat: -6.9050, lng: 107.6350, temp: 65.4, dest: 'SDN Merdeka Bandung',  status: 'Selesai 99%', region: 'jabar' },
    { id: 'VAN-BDG-02', lat: -6.9380, lng: 107.6010, temp: 63.8, dest: 'SMPN 5 Bandung',       status: 'Kembali', region: 'jabar' },
    { id: 'VAN-BKS-01', lat: -6.2180, lng: 107.0120, temp: 66.1, dest: 'SDN Bekasi Jaya 01',   status: 'Mengantar', region: 'jabar' },
    { id: 'VAN-SMG-01', lat: -7.0050, lng: 110.4380, temp: 65.1, dest: 'SDN Semarang Tengah',  status: 'Mengantar', region: 'jateng' },
    { id: 'VAN-SMG-02', lat: -6.9810, lng: 110.4020, temp: 64.7, dest: 'SMPN 3 Semarang',      status: 'Menuju Sekolah', region: 'jateng' },
    { id: 'VAN-SBY-01', lat: -7.2480, lng: 112.7380, temp: 66.0, dest: 'SDN Ketabang Surabaya',status: 'Selesai', region: 'jatim' },
    { id: 'VAN-SBY-02', lat: -7.2720, lng: 112.7650, temp: 65.5, dest: 'SMPN 7 Surabaya',      status: 'Mengantar', region: 'jatim' },
    { id: 'VAN-MLG-01', lat: -7.9680, lng: 112.6450, temp: 64.2, dest: 'SDN Malang 01',         status: 'Menuju Sekolah', region: 'jatim' },
  ];

  initialVans.forEach(v => {
    const tempColor = v.temp >= 65 ? '#059669' : v.temp >= 62 ? '#d97706' : '#dc2626';
    const iconVan = L.divIcon({
      className: '',
      html: `<div style="
        background:linear-gradient(135deg,#1d4ed8,#2563eb);
        color:#fff; width:30px; height:30px; border-radius:8px;
        display:flex; align-items:center; justify-content:center;
        box-shadow:0 2px 8px rgba(37,99,235,0.45); border:2px solid #fff;
        font-size:14px; line-height:1;">🚚</div>`,
      iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -17]
    });

    const vm = L.marker([v.lat, v.lng], { icon: iconVan }).addTo(mbgLeafletMap);
    vm.bindPopup(`
      <div style="font-family:'Plus Jakarta Sans',sans-serif;min-width:180px;padding:2px 0">
        <div style="font-size:9px;font-weight:700;color:#2563EB;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px;">Sensor IoT Rantai Hangat</div>
        <div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:5px;">${v.id}</div>
        <div style="font-size:11px;color:#475569;line-height:1.7;">
          <div>🏫 Tujuan: <strong>${v.dest}</strong></div>
          <div>🌡️ Suhu: <strong style="color:${tempColor};">${v.temp}°C</strong> <span style="color:#94a3b8;">(min 60°C)</span></div>
          <div>📡 Status: <strong style="color:#059669;">${v.status}</strong></div>
        </div>
      </div>`, { maxWidth: 220 });

    mbgDeliveryVans.push({ marker: vm, data: { ...v } });
  });

  // ── Simulasi GPS bergerak + suhu berfluktuasi setiap 3 detik ─────────────
  setInterval(() => {
    mbgDeliveryVans.forEach(item => {
      const d = item.data;
      d.lat += (Math.random() - 0.5) * 0.0008;
      d.lng += (Math.random() - 0.5) * 0.0008;
      item.marker.setLatLng([d.lat, d.lng]);

      d.temp = Math.round((d.temp + (Math.random() - 0.5) * 0.4) * 10) / 10;
      if (d.temp < 61.5) d.temp = 64.0;
      if (d.temp > 68.5) d.temp = 66.0;
    });
  }, 3000);

  // ── Fly to region on button click ────────────────────────────────────────
  const regionCoords = {
    dki:      { center: [-6.2088, 106.8456], zoom: 12 },
    jabar:    { center: [-6.9175, 107.6191], zoom: 11 },
    jateng:   { center: [-6.9932, 110.4203], zoom: 11 },
    jatim:    { center: [-7.2575, 112.7521], zoom: 11 },
    nasional: { center: [-2.5489, 118.0149], zoom: 5  }
  };

  const regionBtns = document.querySelectorAll('.region-telemetry-btn');
  regionBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const regKey = this.getAttribute('data-region');
      if (regKey && regionCoords[regKey]) {
        const target = regionCoords[regKey];
        mbgLeafletMap.flyTo(target.center, target.zoom, {
          duration: 1.5
        });
      }
    });
  });
}


/**
 * ============================================================
 * Province Modal: klik baris tabel distribusi → tampil SPPG
 * ============================================================
 */
function initProvinsiModal() {
  var tableBody = document.getElementById('tableRegionalBody');
  var modal     = document.getElementById('provinsiModal');
  var closeBtn  = document.getElementById('closeProvinsiModal');
  var listEl    = document.getElementById('sppgModalList');
  var titleEl   = document.getElementById('provinsiModalTitle');

  if (!tableBody || !modal) return;

  tableBody.addEventListener('click', function(e) {
    var row = e.target.closest('tr[data-provinsi]');
    if (!row) return;
    var provinsi = row.getAttribute('data-provinsi');
    if (!provinsi) return;
    openProvinsiModal(provinsi);
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', closeProvinsiModal);
  }
  modal.addEventListener('click', function(e) {
    if (e.target === modal) closeProvinsiModal();
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeProvinsiModal();
  });

  function closeProvinsiModal() {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  function openProvinsiModal(provinsi) {
    if (!modal || !titleEl || !listEl) return;
    titleEl.textContent = 'SPPG di ' + provinsi;
    listEl.innerHTML =
      '<div class="py-10 text-center text-slate-400 text-sm">' +
      '<div class="w-8 h-8 border-4 border-slate-200 border-t-slate-400 rounded-full animate-spin mx-auto mb-3"></div>' +
      'Memuat data SPPG...</div>';
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    var apiPrefix = getApiPrefix();
    fetch(apiPrefix + 'sppg_provinsi.php?provinsi=' + encodeURIComponent(provinsi))
      .then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function(json) {
        var data = json.data || json;
        if (!Array.isArray(data) || data.length === 0) {
          listEl.innerHTML =
            '<div class="py-10 text-center text-slate-400 text-sm">' +
            '<span class="material-symbols-outlined text-4xl text-slate-300 block mb-2">soup_kitchen</span>' +
            'Belum ada data SPPG untuk <strong>' + _escM(provinsi) + '</strong>.</div>';
          return;
        }
        listEl.innerHTML = data.map(function(s) {
          var status = (s.status || 'operasional').toLowerCase();
          var isAktif = status === 'aktif' || status === 'operasional';
          var badgeStyle = isAktif
            ? 'background:#d1fae5;color:#065f46;'
            : 'background:#fee2e2;color:#991b1b;';
          return '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:12px 14px;display:flex;align-items:flex-start;gap:12px;">' +
            '<div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#001026,#395f95);display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
            '<span class="material-symbols-outlined" style="font-size:18px;color:#6ffbbe;">soup_kitchen</span></div>' +
            '<div style="flex:1;min-width:0;">' +
            '<div style="font-weight:800;font-size:13px;color:#001026;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _escM(s.nama || s.name || '—') + '</div>' +
            '<div style="font-size:11px;color:#64748b;margin-bottom:6px;">' + _escM(s.kabupaten_kota || s.city || '—') + '</div>' +
            '<span style="' + badgeStyle + 'font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;text-transform:uppercase;letter-spacing:.04em;">' + _escM(s.status || 'Operasional') + '</span>' +
            '</div></div>';
        }).join('');
      })
      .catch(function() {
        listEl.innerHTML =
          '<div class="py-8 text-center text-slate-400 text-sm">' +
          '<span class="material-symbols-outlined text-4xl text-slate-300 block mb-2">wifi_off</span>' +
          'Gagal memuat data. Pastikan endpoint API tersedia.</div>';
      });
  }

  function _escM(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
}