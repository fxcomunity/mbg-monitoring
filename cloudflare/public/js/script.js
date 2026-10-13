/**
 * script.js — Interaktivitas Utama Radar MBG Nasional
 * Terintegrasi penuh dengan Database Riil & Validasi Anti-Exploit
 */
document.addEventListener('DOMContentLoaded', function() {
  'use strict';

  // Inisialisasi Mobile Navigation
  initMobileNav();

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
    toggleBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      mobileMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', function(e) {
      if (!mobileMenu.contains(e.target) && !toggleBtn.contains(e.target)) {
        mobileMenu.classList.add('hidden');
      }
    });
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
