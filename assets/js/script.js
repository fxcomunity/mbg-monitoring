/**
 * script.js "â€ Interaktivitas Utama Radar MBG Nasional
 * Terintegrasi penuh dengan Database Riil & Validasi Anti-Exploit
 */

/**
 * Helper untuk mencegah XSS dengan meng-escape karakter HTML.
 * Mengubah <, >, &, ", ' menjadi HTML entities agar tidak dieksekusi browser.
 */
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
  initHomepageMenuPreview();

  // Inisialisasi Filter & Real-Time Data (jika di halaman menu)
  initMenuPage();

  // Inisialisasi Global Search
  initGlobalSearch();

  // Inisialisasi Province Modal Drill-Down
  initProvinsiModal();
});

async function initHomepageMenuPreview() {
  const container = document.getElementById('homepageMenuPreview');
  if (!container) return;
  const showMessage = message => {
    const paragraph = document.createElement('p');
    paragraph.className = 'font-body-md text-body-md text-on-surface-variant';
    paragraph.textContent = message;
    container.replaceChildren(paragraph);
  };

  try {
    const response = await fetch(`${getApiPrefix()}home_menu.php`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (result.status !== 'success' || !Array.isArray(result.data)) {
      throw new Error(result.message || 'Format data menu tidak valid');
    }
    const item = result.data[0];
    if (!item) {
      showMessage('Belum ada menu yang tercatat hari ini.');
      return;
    }

    const eyebrow = document.createElement('span');
    eyebrow.className = 'font-label-sm text-label-sm text-secondary uppercase font-bold tracking-wider';
    eyebrow.textContent = [item.school, item.city, item.provinsi].filter(Boolean).join(' Â· ');
    const title = document.createElement('h3');
    title.className = 'font-headline-lg text-headline-lg text-primary font-bold';
    title.textContent = item.menu || 'Menu tanpa nama';
    const description = document.createElement('p');
    description.className = 'font-body-md text-body-md text-on-surface-variant';
    description.textContent = item.description || 'Tidak ada keterangan menu pada basis data.';
    const date = document.createElement('span');
    date.className = 'font-body-sm text-body-sm text-on-surface-variant';
    date.textContent = item.date ? `Tanggal menu: ${new Date(item.date).toLocaleDateString('id-ID')}` : 'Tanggal menu tidak tersedia';
    container.replaceChildren(eyebrow, title, description, date);
  } catch (error) {
    console.error('[BGN] Gagal memuat pratinjau menu:', error);
    showMessage('Pratinjau menu tidak dapat dimuat dari basis data.');
  }
}

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
        const menuPage = window.location.pathname.includes('/fitur/')
          ? 'menu-hari-ini.html'
          : 'fitur/menu-hari-ini.html';
        window.location.href = menuPage + '?q=' + encodeURIComponent(query);
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
  const apiPrefix = getApiPrefix();
  const telemetryStatus = document.getElementById('telemetryUpdateText');

  // 1. Ambil 5 KPI Telemetri Utama dari SQL
  if (kpiPorsi) {
    try {
      const res = await fetch(`${apiPrefix}telemetri.php`, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.status !== 'success' || !json.data) throw new Error(json.message || 'Data telemetri tidak tersedia');
      const d = json.data;
      document.getElementById('kpiPorsiTersalurkan').textContent = Number(d.porsi_tersalurkan).toLocaleString('id-ID');
      document.getElementById('kpiPersenTarget').textContent = `${d.persen_target}% dari target harian`;
      document.getElementById('kpiSppgAktif').textContent = Number(d.sppg_aktif).toLocaleString('id-ID');
      document.getElementById('kpiSekolahTerlayani').textContent = Number(d.sekolah_terlayani).toLocaleString('id-ID');
      document.getElementById('kpiKepatuhanAkg').textContent = `${d.kepatuhan_akg}%`;
      document.getElementById('kpiSuhuMakanan').textContent = `${d.suhu_rata_rata}Â°C`;
      if (telemetryStatus) telemetryStatus.textContent = d.updated_at
        ? `Pembaruan: ${new Date(d.updated_at).toLocaleString('id-ID')}`
        : 'Data terbaru dari basis data';
      const elSla = document.getElementById('telemetrySlaDisplay');
      if (elSla) elSla.textContent = `${d.sla_distribusi}% Tepat Waktu`;
      const tempBadge = document.getElementById('telemetryTempBadge');
      if (tempBadge) tempBadge.textContent = `Rata-rata ${d.suhu_rata_rata}Â°C`;
    } catch (err) {
      console.error('[BGN] Gagal memuat data telemetri:', err);
      if (telemetryStatus) telemetryStatus.textContent = 'Data telemetri tidak tersedia';
    }
  }

  // 2. Ambil Tabel Kepatuhan Distribusi Provinsi dari SQL
  if (tableBody) {
    loadDistribusiTable(apiPrefix);
    const regionBtns = document.querySelectorAll('.region-filter-btn');
    regionBtns.forEach(btn => {
      btn.addEventListener('click', function() {
        regionBtns.forEach(b => {
          b.classList.remove('bg-primary', 'text-on-primary');
          b.classList.add('text-on-surface-variant');
        });
        this.classList.remove('text-on-surface-variant');
        this.classList.add('bg-primary', 'text-on-primary');
        renderDistribusiTable(this.getAttribute('data-region') || 'semua');
      });
    });
  }
}

let distribusiRows = [];

async function loadDistribusiTable(apiPrefix) {
  const tableBody = document.getElementById('tableRegionalBody');
  if (!tableBody) return;

  try {
    const res = await fetch(`${apiPrefix}distribusi.php`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.status !== 'success' || !Array.isArray(json.data)) throw new Error(json.message || 'Data distribusi tidak tersedia');
    distribusiRows = json.data;
    const updateText = document.getElementById('distributionUpdateText');
    if (updateText) updateText.textContent = json.timestamp
      ? `Diperbarui ${new Date(json.timestamp).toLocaleString('id-ID')}`
      : 'Dari basis data';
    renderDistribusiTable('semua');
  } catch (err) {
    console.error('[BGN] Gagal memuat tabel distribusi:', err);
    tableBody.innerHTML = '<tr><td class="px-3 py-8 text-center text-on-surface-variant" colspan="4">Data distribusi tidak dapat dimuat dari basis data.</td></tr>';
    const updateText = document.getElementById('distributionUpdateText');
    if (updateText) updateText.textContent = 'Data tidak tersedia';
  }
}

function renderDistribusiTable(region) {
  const tableBody = document.getElementById('tableRegionalBody');
  if (!tableBody) return;
  const filteredRows = distribusiRows.filter(item => {
    const code = String(item.region_code || '').toLowerCase();
    if (region === 'semua') return true;
    if (region === 'timur') return /bali|nusa|maluku|papua|timur/.test(code);
    return code === region;
  });
  if (!filteredRows.length) {
    tableBody.innerHTML = '<tr><td class="px-3 py-8 text-center text-on-surface-variant" colspan="4">Tidak ada data untuk wilayah ini.</td></tr>';
    return;
  }
  tableBody.innerHTML = filteredRows.map(item => {
    const prov = BGNSecurity ? BGNSecurity.escapeHTML(item.provinsi) : String(item.provinsi || '');
    const status = BGNSecurity ? BGNSecurity.escapeHTML(item.status) : String(item.status || '');
    return `<tr class="hover:bg-surface-canvas transition-colors cursor-pointer" data-provinsi="${prov}" title="Klik untuk lihat SPPG">
      <td class="py-3 px-3 font-semibold text-primary">${prov}</td>
      <td class="py-3 px-3">${Number(item.target_porsi).toLocaleString('id-ID')}</td>
      <td class="py-3 px-3 text-status-success font-semibold">${Number(item.ketepatan)}%</td>
      <td class="py-3 px-3"><span class="px-2 py-0.5 rounded-full bg-surface-container text-secondary font-label-sm text-label-sm">${status}</span></td>
    </tr>`;
  }).join('');
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
      <p class="text-sm text-gray-500 max-w-md mb-6">${escapeHTML(msg)}</p>
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
          <img src="${escapeHTML(u.avatar)}" alt="${escapeHTML(BGNSecurity.escapeHTML(u.full_name))}" class="w-7 h-7 rounded-full border border-primary/20 object-cover bg-white">
          <div class="flex flex-col text-left hidden lg:flex">
            <span class="text-xs font-bold text-on-surface leading-tight max-w-[110px] truncate">${escapeHTML(BGNSecurity.escapeHTML(u.full_name))}</span>
            <span class="text-[10px] text-secondary font-medium leading-none">${escapeHTML(BGNSecurity.escapeHTML(u.role_label))}</span>
          </div>
          <span class="material-symbols-outlined text-[16px] text-outline">expand_more</span>
        </button>
        
        <div id="headerProfileMenu" class="hidden absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50">
          <div class="px-4 py-3 border-b border-slate-100 flex items-center gap-3 bg-slate-50/70">
            <img src="${escapeHTML(u.avatar)}" alt="${escapeHTML(BGNSecurity.escapeHTML(u.full_name))}" class="w-10 h-10 rounded-full border-2 border-white shadow-sm bg-white">
            <div class="flex flex-col overflow-hidden">
              <span class="text-xs font-bold text-slate-900 truncate">${escapeHTML(BGNSecurity.escapeHTML(u.full_name))}</span>
              <span class="text-[11px] text-slate-500 font-mono truncate">@${escapeHTML(BGNSecurity.escapeHTML(u.username))}</span>
              <span class="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 w-fit">${escapeHTML(BGNSecurity.escapeHTML(u.role_label))}</span>
            </div>
          </div>

          <div class="py-1">
            <a href="dashboard/${escapeHTML(u.role)}/" class="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
              <span class="material-symbols-outlined text-[18px] text-blue-600">dashboard</span>
              <span>Dashboard ${escapeHTML(u.role.toUpperCase())}</span>
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
          <img src="${escapeHTML(u.avatar)}" alt="${escapeHTML(BGNSecurity.escapeHTML(u.full_name))}" class="w-9 h-9 rounded-full border border-primary/20 bg-white">
          <div class="flex flex-col">
            <span class="text-xs font-bold text-on-surface">${escapeHTML(BGNSecurity.escapeHTML(u.full_name))}</span>
            <span class="text-[11px] text-secondary font-medium">${escapeHTML(BGNSecurity.escapeHTML(u.role_label))}</span>
          </div>
        </div>
        <div class="flex flex-col gap-1 pt-2 border-t border-border-subtle">
          <a href="dashboard/${escapeHTML(u.role)}/" class="px-3 py-1.5 text-xs font-bold text-primary rounded-lg bg-surface-container-high flex items-center gap-2">
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
      const res = await fetch(getApiPrefix() + 'notifications.php', { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json || json.status !== 'success') throw new Error(json.message || 'Data notifikasi tidak tersedia');

      const data = json;
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
                    <p class="text-[11px] text-slate-500 truncate">Status: ${BGNSecurity.escapeHTML(r.status)}</p>
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
              Belum ada laporan baru yang tercatat.
            </div>
          `;
        }

        listContainer.innerHTML = itemsHtml;
      }
      const ticker = document.getElementById('liveTicker');
      if (ticker) {
        const latest = Array.isArray(data.latest_reports) ? data.latest_reports[0] : null;
        ticker.textContent = latest
          ? `${latest.ticket_code} Â· ${latest.issue_category} Â· ${latest.school_target || 'Lokasi tidak dicantumkan'}`
          : 'Belum ada laporan terbaru yang tercatat.';
      }
    } catch (err) {
      console.error('[BGN] Gagal memuat notifikasi:', err);
      const ticker = document.getElementById('liveTicker');
      if (ticker) ticker.textContent = 'Laporan terbaru tidak dapat dimuat dari basis data.';
    }
  }

  // Poll notifikasi pertama kali & setiap 20 detik
  fetchNotifications();
  setInterval(fetchNotifications, 20000);
}

/**
 * ============================================================
 * Peta lokasi SPPG berdasarkan koordinat yang tersimpan di basis data.
 * ============================================================
 */
let mbgLeafletMap = null;

async function initInteractiveTelemetryMap() {
  const mapElement = document.getElementById('mbgInteractiveMap');
  if (!mapElement || typeof L === 'undefined') return;

  mbgLeafletMap = L.map(mapElement, { center: [-2.5, 118], zoom: 5 });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(mbgLeafletMap);
  const markerLayer = L.featureGroup().addTo(mbgLeafletMap);
  const mapCount = document.getElementById('mapLocationCount');

  try {
    const response = await fetch(`${getApiPrefix()}sppg_map.php`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const geoJson = await response.json();
    if (!geoJson || !Array.isArray(geoJson.features)) throw new Error('Format data peta tidak valid');

    geoJson.features.forEach(feature => {
      const coordinates = feature.geometry && feature.geometry.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length < 2) return;
      const properties = feature.properties || {};
      const marker = L.marker([coordinates[1], coordinates[0]]).addTo(markerLayer);
      const popup = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = properties.nama || 'SPPG';
      popup.appendChild(name);
      if (properties.kabupaten_kota || properties.provinsi) {
        const location = document.createElement('div');
        location.textContent = [properties.kabupaten_kota, properties.provinsi].filter(Boolean).join(', ');
        popup.appendChild(location);
      }
      if (properties.status) {
        const status = document.createElement('div');
        status.textContent = `Status: ${properties.status}`;
        popup.appendChild(status);
      }
      marker.bindPopup(popup);
    });

    if (markerLayer.getLayers().length) mbgLeafletMap.fitBounds(markerLayer.getBounds(), { padding: [24, 24] });
    if (mapCount) mapCount.textContent = geoJson.count
      ? `${Number(geoJson.count).toLocaleString('id-ID')} lokasi SPPG`
      : 'Belum ada lokasi SPPG di basis data';
  } catch (error) {
    console.error('[BGN] Gagal memuat lokasi SPPG:', error);
    if (mapCount) mapCount.textContent = 'Lokasi SPPG tidak dapat dimuat';
  }

  setTimeout(() => mbgLeafletMap && mbgLeafletMap.invalidateSize(), 200);
}

/**
 * ============================================================
 * Province Modal: klik baris tabel distribusi â†’ tampil SPPG
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
            '<div style="font-weight:800;font-size:13px;color:#001026;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _escM(s.nama || s.name || 'â€”') + '</div>' +
            '<div style="font-size:11px;color:#64748b;margin-bottom:6px;">' + _escM(s.kabupaten_kota || s.city || 'â€”') + '</div>' +
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
