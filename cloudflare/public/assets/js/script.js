/**
 * script.js — Interaktivitas Utama Radar MBG Nasional
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
  initInteractiveTelemetryMap();

  // Inisialisasi Telemetri & Distribusi Riil dari Database
  initTelemetriAndDistribusi();

  // Inisialisasi Filter & Real-Time Data (jika di halaman menu)
  initMenuPage();

  // Inisialisasi Global Search
  initGlobalSearch();
});

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
          <tr class="hover:bg-surface-canvas transition-colors" data-region="${regCode}">
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
        <a href="login.php" class="px-4 py-2 bg-primary hover:bg-primary-container text-white text-xs font-semibold rounded-xl transition-colors">
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
 * Cek status autentikasi aktif via API dan render Profil Avatar + Dropdown jika login
 */
async function initUserAuthStatus() {
  try {
    const res = await fetch('api/auth_user.php', { credentials: 'same-origin' });
    if (!res.ok) return;
    const data = await res.json();

    if (!data.logged_in || !data.user) return;

    const u = data.user;
    const desktopLoginLink = document.querySelector('header nav + div a[href*="login.php"], header a[href*="login.php"]:not(#mobileNavMenu a)');
    const mobileLoginLink = document.querySelector('#mobileNavMenu a[href*="login.php"]');

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
            <a href="dashboard/${u.role}/index.php" class="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
              <span class="material-symbols-outlined text-[18px] text-blue-600">dashboard</span>
              <span>Dashboard ${u.role.toUpperCase()}</span>
            </a>
            ${u.role === 'admin' ? `
            <a href="dashboard/admin/index.php#telemetry-manager" class="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
              <span class="material-symbols-outlined text-[18px] text-emerald-600">monitoring</span>
              <span>Panel Input Telemetri & KPI</span>
            </a>
            <a href="dashboard/admin/index.php#maintenance-panel" class="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
              <span class="material-symbols-outlined text-[18px] text-purple-600">admin_panel_settings</span>
              <span>Panel Pemeliharaan Sistem</span>
            </a>
            ` : ''}
            ${u.role === 'sppg' ? `
            <a href="dashboard/sppg/index.php#input-menu" class="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
              <span class="material-symbols-outlined text-[18px] text-emerald-600">soup_kitchen</span>
              <span>Panel Dapur SPPG & Input Menu</span>
            </a>
            <a href="dashboard/sppg/index.php#uji-akg" class="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
              <span class="material-symbols-outlined text-[18px] text-amber-600">biotech</span>
              <span>Uji Sampel & AKG Makanan</span>
            </a>
            ` : ''}
            ${u.role === 'user' ? `
            <a href="dashboard/user/index.php#riwayat-aduan" class="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
              <span class="material-symbols-outlined text-[18px] text-amber-600">receipt_long</span>
              <span>Status Aduan Saya</span>
            </a>
            ` : ''}
            <a href="dashboard/${u.role}/index.php#pengaturan-profil" class="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
              <span class="material-symbols-outlined text-[18px] text-indigo-600">account_circle</span>
              <span>Atur Foto / Logo Profil</span>
            </a>
            <a href="dashboard/${u.role}/index.php#ganti-password" class="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
              <span class="material-symbols-outlined text-[18px] text-amber-600">key</span>
              <span>Ganti Kata Sandi</span>
            </a>
          </div>

          <div class="pt-1 border-t border-slate-100">
            <a href="login.php?action=logout" class="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors">
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
          <a href="dashboard/${u.role}/index.php" class="px-3 py-1.5 text-xs font-bold text-primary rounded-lg bg-surface-container-high flex items-center gap-2">
            <span class="material-symbols-outlined text-[16px]">dashboard</span>
            <span>Buka Dashboard</span>
          </a>
          ${u.role === 'admin' ? `
          <a href="dashboard/admin/index.php#maintenance-panel" class="px-3 py-1.5 text-xs font-bold text-purple-700 rounded-lg bg-purple-50 flex items-center gap-2">
            <span class="material-symbols-outlined text-[16px]">admin_panel_settings</span>
            <span>Panel Pemeliharaan Sistem</span>
          </a>
          ` : ''}
          ${u.role === 'sppg' ? `
          <a href="dashboard/sppg/index.php#input-menu" class="px-3 py-1.5 text-xs font-bold text-emerald-700 rounded-lg bg-emerald-50 flex items-center gap-2">
            <span class="material-symbols-outlined text-[16px]">soup_kitchen</span>
            <span>Panel Dapur SPPG</span>
          </a>
          ` : ''}
          <a href="dashboard/${u.role}/index.php#pengaturan-profil" class="px-3 py-1.5 text-xs font-bold text-slate-700 rounded-lg hover:bg-surface-container-high flex items-center gap-2">
            <span class="material-symbols-outlined text-[16px] text-indigo-600">account_circle</span>
            <span>Atur Foto / Logo</span>
          </a>
          <a href="dashboard/${u.role}/index.php#ganti-password" class="px-3 py-1.5 text-xs font-bold text-slate-700 rounded-lg hover:bg-surface-container-high flex items-center gap-2">
            <span class="material-symbols-outlined text-[16px] text-amber-600">key</span>
            <span>Ganti Kata Sandi</span>
          </a>
          <a href="login.php?action=logout" class="px-3 py-1.5 text-xs font-bold text-red-600 rounded-lg hover:bg-red-50 flex items-center gap-2">
            <span class="material-symbols-outlined text-[16px]">logout</span>
            <span>Keluar (Logout)</span>
          </a>
        </div>
      `;
      mobileLoginLink.replaceWith(mobWrapper);
    }
  } catch (err) {
    console.warn('Gagal memuat status autentikasi:', err);
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
      const res = await fetch('api/notifications.php');
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
            <a href="dashboard/admin/index.php#verifikasi-logo-sppg" class="block px-4 py-3 hover:bg-amber-50/70 transition-colors bg-amber-50/30">
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
              <a href="dashboard/admin/index.php" class="block px-4 py-2.5 hover:bg-slate-50 transition-colors">
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

  // Koordinat Utama Indonesia (Pusat DKI Jakarta)
  const defaultCenter = [-6.2088, 106.8456];
  const defaultZoom = 11;

  // Inisialisasi Leaflet Map
  mbgLeafletMap = L.map('mbgInteractiveMap', {
    center: defaultCenter,
    zoom: defaultZoom,
    zoomControl: true,
    scrollWheelZoom: true,
    attributionControl: false
  });

  // Tile layer OpenStreetMap bergaya CartoDB Positron yang bersih & modern
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd'
  }).addTo(mbgLeafletMap);

  // Data Stasiun Dapur SPPG & Titik Sekolah
  const sppgStations = [
    { name: 'SPPG Satgas DKI Jakarta Pusat', lat: -6.1824, lng: 106.8290, radius: 4500, porsi: '34.200 porsi/hari', temp: '65.4°C' },
    { name: 'SPPG Satgas Jakarta Selatan', lat: -6.2615, lng: 106.8106, radius: 4000, porsi: '28.500 porsi/hari', temp: '64.8°C' },
    { name: 'SPPG Satgas Bandung Raya (Jabar)', lat: -6.9175, lng: 107.6191, radius: 5000, porsi: '41.100 porsi/hari', temp: '66.2°C' },
    { name: 'SPPG Satgas Semarang (Jateng)', lat: -6.9932, lng: 110.4203, radius: 4200, porsi: '31.800 porsi/hari', temp: '65.1°C' },
    { name: 'SPPG Satgas Surabaya (Jatim)', lat: -7.2575, lng: 112.7521, radius: 4800, porsi: '39.000 porsi/hari', temp: '65.9°C' }
  ];

  // Render Dapur SPPG & Radius Distribusi
  sppgStations.forEach(sppg => {
    // Circle Radius Distribusi
    L.circle([sppg.lat, sppg.lng], {
      color: '#059669',
      fillColor: '#10B981',
      fillOpacity: 0.15,
      radius: sppg.radius
    }).addTo(mbgLeafletMap);

    // Marker Dapur SPPG
    const iconSppg = L.divIcon({
      className: 'custom-sppg-icon',
      html: `
        <div style="background:#059669; color:#fff; width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 3px 8px rgba(0,0,0,0.3); border:2px solid #fff;">
          <svg style="width:18px;height:18px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });

    const marker = L.marker([sppg.lat, sppg.lng], { icon: iconSppg }).addTo(mbgLeafletMap);
    marker.bindPopup(`
      <div style="font-family:'Plus Jakarta Sans',sans-serif; min-width:180px;">
        <span style="font-size:10px; font-weight:700; color:#059669; text-transform:uppercase;">Dapur SPPG Terakreditasi BGN</span>
        <h4 style="margin:2px 0 6px 0; font-size:13px; font-weight:700; color:#0f172a;">${sppg.name}</h4>
        <div style="font-size:11px; color:#475569; line-height:1.5;">
          <div>Kapasitas: <strong>${sppg.porsi}</strong></div>
          <div>Suhu Rantai Hangat: <strong style="color:#059669;">${sppg.temp}</strong> (Sesuai SOP)</div>
          <div>Radius Layanan: <strong>${sppg.radius / 1000} KM</strong></div>
        </div>
      </div>
    `);
    mbgMarkers.push(marker);
  });

  // Inisialisasi Armada Van Logistik Ber-Sensor Termal IoT
  const initialVans = [
    { id: 'VAN-BGN-01', lat: -6.2150, lng: 106.8400, temp: 65.8, dest: 'SDN Menteng 01 Jakarta', status: 'Mengantar Porsi Pagi' },
    { id: 'VAN-BGN-02', lat: -6.1950, lng: 106.8220, temp: 66.2, dest: 'SMPN 1 Jakarta Pusat', status: 'Mengantar Porsi Pagi' },
    { id: 'VAN-BGN-03', lat: -6.2700, lng: 106.8050, temp: 64.9, dest: 'SDN Cilandak Barat 03', status: 'Menuju Lokasi Sekolah' },
    { id: 'VAN-BGN-04', lat: -6.9250, lng: 107.6100, temp: 65.4, dest: 'SDN Merdeka Bandung', status: 'Distribusi Selesai 99%' },
    { id: 'VAN-BGN-05', lat: -7.2650, lng: 107.7450, temp: 66.0, dest: 'SDN Ketabang Surabaya', status: 'Selesai Serah Terima' }
  ];

  initialVans.forEach(v => {
    const iconVan = L.divIcon({
      className: 'custom-van-icon',
      html: `
        <div class="van-marker-inner" style="background:#2563EB; color:#fff; width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center; box-shadow:0 3px 6px rgba(37,99,235,0.4); border:2px solid #fff; font-size:10px; font-weight:bold;">
          🚚
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    const vanMarker = L.marker([v.lat, v.lng], { icon: iconVan }).addTo(mbgLeafletMap);
    vanMarker.bindPopup(`
      <div style="font-family:'Plus Jakarta Sans',sans-serif; min-width:170px;">
        <span style="font-size:10px; font-weight:700; color:#2563EB; text-transform:uppercase;">Sensor IoT Rantai Hangat</span>
        <h4 style="margin:2px 0; font-size:12px; font-weight:700; color:#0f172a;">${v.id}</h4>
        <div style="font-size:11px; color:#475569; margin-top:4px;">
          <div>Tujuan: <strong>${v.dest}</strong></div>
          <div>Suhu Termal: <strong style="color:#d97706;" class="van-temp-label">${v.temp}°C</strong> (&gt;60°C Aman)</div>
          <div>Status: <span style="color:#059669; font-weight:600;">${v.status}</span></div>
        </div>
      </div>
    `);

    mbgDeliveryVans.push({
      marker: vanMarker,
      data: v
    });
  });

  // Loop Realtime Telemetri: Pergerakan GPS Halus & Fluktuasi Suhu Termal IoT setiap 4 detik
  setInterval(() => {
    mbgDeliveryVans.forEach(item => {
      // Pergerakan GPS acak kecil (0.0003 lat/lng)
      const latDelta = (Math.random() - 0.5) * 0.0006;
      const lngDelta = (Math.random() - 0.5) * 0.0006;
      const newLat = item.data.lat + latDelta;
      const newLng = item.data.lng + lngDelta;
      item.data.lat = newLat;
      item.data.lng = newLng;
      item.marker.setLatLng([newLat, newLng]);

      // Fluktuasi suhu rantai hangat (antara 63.5°C - 66.8°C)
      const tempDelta = (Math.random() - 0.5) * 0.3;
      item.data.temp = Math.round((item.data.temp + tempDelta) * 10) / 10;
      if (item.data.temp < 62.0) item.data.temp = 64.5;
      if (item.data.temp > 68.0) item.data.temp = 66.2;
    });
  }, 4000);

  // Hubungkan Tombol Pilihan Wilayah ke Peta (Fly to region)
  const regionCoords = {
    dki: { center: [-6.2088, 106.8456], zoom: 11 },
    jabar: { center: [-6.9175, 107.6191], zoom: 11 },
    jateng: { center: [-6.9932, 110.4203], zoom: 11 },
    jatim: { center: [-7.2575, 112.7521], zoom: 11 },
    nasional: { center: [-2.5489, 118.0149], zoom: 5 }
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
