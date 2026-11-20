/**
 * script.js "â€ Interaktivitas Utama Radar MBG Nasional
 * Terintegrasi penuh dengan Database Riil & Validasi Anti-Exploit
 */

/**
 * Helper untuk mencegah XSS dengan meng-escape karakter HTML.
 * Mengubah <, >, &, ", ' menjadi HTML entities agar tidak dieksekusi browser.
 */
function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Capture the script location now; document.currentScript is null in callbacks.
const mbgAppBaseURL = new URL('../../', document.currentScript.src);
const menuImageFallbackURL = new URL('assets/images/food-placeholder.svg', mbgAppBaseURL).href;
const profileImageFallbackURL = new URL('assets/images/ic_launcher.png', mbgAppBaseURL).href;

function appRoute(path) {
  return new URL(path, mbgAppBaseURL).href;
}

function safeImageURL(value, fallbackURL) {
  if (typeof value !== 'string' || !value.trim() || /[\u0000-\u001f\u007f\\]/.test(value)) return fallbackURL;
  try {
    const url = new URL(value.trim(), document.baseURI);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return fallbackURL;
    return url.href;
  } catch (_) {
    return fallbackURL;
  }
}

function safeProfileImageURL(value) {
  if (typeof value !== 'string' || !value.trim()) return profileImageFallbackURL;
  const imageURL = value.trim();
  if (/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/]+=*$/i.test(imageURL)) return imageURL;
  if (/^uploads\/avatars\/[a-z0-9_.-]+$/i.test(imageURL)) return appRoute(imageURL);
  return safeImageURL(imageURL, profileImageFallbackURL);
}

function finiteNumber(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function attachImageFallbacks(container, fallbackURL) {
  container.querySelectorAll('img').forEach(image => {
    const useFallback = () => {
      if (image.src !== fallbackURL) image.src = fallbackURL;
    };
    image.addEventListener('error', useFallback, { once: true });
    // A cached/broken image may have finished before its listener was attached.
    if (image.complete && image.naturalWidth === 0) useFallback();
  });
}

document.addEventListener('DOMContentLoaded', function() {
  'use strict';

  initPublicPolish();

  // Inisialisasi Mobile Navigation
  initMobileNav();

  // Inisialisasi Lonceng Notifikasi Header
  initNotificationBell();

  // Inisialisasi Status Autentikasi Pengguna & Profil Dropdown
  initUserAuthStatus();

  // Peta dan puluhan ribu titik hanya dimuat saat pengguna mendekatinya.
  initInteractiveTelemetryMapWhenVisible();

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

function initPublicPolish() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if ('IntersectionObserver' in window && !reducedMotion.matches) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('mbg-reveal');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08 });
    document.querySelectorAll('main section > .max-w-7xl, .portal-cards > div').forEach(element => observer.observe(element));
    reducedMotion.addEventListener('change', event => {
      if (event.matches) observer.disconnect();
    });
  }

  const search = document.getElementById('navGlobalSearch');
  if (search) search.setAttribute('aria-label', 'Cari sekolah atau SPPG');
  const nav = document.querySelector('header nav');
  if (nav) nav.setAttribute('aria-label', 'Navigasi utama');
  const currentPath = window.location.pathname.replace(/index\.html$/, '').replace(/\/$/, '');
  document.querySelectorAll('header nav a, #mobileNavMenu a').forEach(link => {
    const path = new URL(link.href).pathname.replace(/index\.html$/, '').replace(/\/$/, '');
    if (path === currentPath) link.setAttribute('aria-current', 'page');
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    [['navUserBtn', 'navUserDropdown'], ['btnHeaderProfile', 'headerProfileMenu']].forEach(([buttonId, panelId]) => {
      const button = document.getElementById(buttonId);
      const panel = document.getElementById(panelId);
      if (button && panel && !panel.classList.contains('hidden')) {
        button.click();
        button.focus();
      }
    });
  });

  initModalFocus('schoolModalBackdrop', 'btnCloseModal', 'modalSchoolQuery');
  initModalFocus('provinsiModal', 'closeProvinsiModal');
}

function initModalFocus(modalId, closeId, inputId) {
  const modal = document.getElementById(modalId);
  const close = document.getElementById(closeId);
  if (!modal || !close) return;
  const dialog = modal.firstElementChild;
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('tabindex', '-1');
  const heading = dialog.querySelector('h2, h4');
  if (heading) {
    if (!heading.id) heading.id = modalId + 'Title';
    dialog.setAttribute('aria-labelledby', heading.id);
  }
  let wasOpen = false;
  let previousFocus;
  let previousOverflow;
  new MutationObserver(() => {
    const isOpen = !modal.classList.contains('hidden');
    if (isOpen === wasOpen) return;
    wasOpen = isOpen;
    if (isOpen) {
      previousFocus = document.activeElement;
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      (document.getElementById(inputId) || close).focus({ preventScroll: true });
    } else {
      document.body.style.overflow = previousOverflow;
      if (previousFocus && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    }
  }).observe(modal, { attributes: true, attributeFilter: ['class'] });

  document.addEventListener('keydown', event => {
    if (modal.classList.contains('hidden')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close.click();
    }
    if (event.key !== 'Tab') return;
    const controls = Array.from(dialog.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'))
      .filter(element => element.getClientRects().length);
    const first = controls[0] || dialog;
    const last = controls[controls.length - 1] || dialog;
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  });
}

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
  if (!toggleBtn || !mobileMenu) return;

  toggleBtn.setAttribute('aria-controls', mobileMenu.id);
  mobileMenu.setAttribute('aria-label', 'Navigasi seluler');
  mobileMenu.setAttribute('role', 'navigation');
  function setOpen(open, restoreFocus = false) {
    mobileMenu.classList.toggle('hidden', !open);
    toggleBtn.setAttribute('aria-expanded', String(open));
    toggleBtn.setAttribute('aria-label', open ? 'Tutup navigasi' : 'Buka navigasi');
    if (restoreFocus) toggleBtn.focus();
  }
  setOpen(false);
  // Feature pages still register legacy inline toggles. Handle this control
  // in capture phase so one tap/keyboard click always produces one toggle.
  toggleBtn.addEventListener('click', event => {
    event.stopImmediatePropagation();
    setOpen(mobileMenu.classList.contains('hidden'));
  }, true);
  mobileMenu.addEventListener('click', event => {
    if (event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('click', event => {
    if (!mobileMenu.contains(event.target) && !toggleBtn.contains(event.target)) setOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !mobileMenu.classList.contains('hidden')) setOpen(false, true);
  });
  document.addEventListener('focusin', event => {
    if (!mobileMenu.contains(event.target) && !toggleBtn.contains(event.target)) setOpen(false);
  });
  window.matchMedia('(min-width: 1600px)').addEventListener('change', () => setOpen(false));
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
    const prov = escapeHTML(item.provinsi);
    const status = escapeHTML(item.status);
    return `<tr class="hover:bg-surface-canvas transition-colors cursor-pointer" data-provinsi="${prov}" title="Klik untuk lihat SPPG">
      <td class="py-3 px-3 font-semibold text-primary"><button type="button" class="text-left underline decoration-dotted underline-offset-4" aria-haspopup="dialog" aria-label="Lihat SPPG di ${prov}">${prov}</button></td>
      <td class="py-3 px-3">${finiteNumber(item.target_porsi).toLocaleString('id-ID')}</td>
      <td class="py-3 px-3 text-status-success font-semibold">${finiteNumber(item.ketepatan)}%</td>
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
    ? `Tidak ditemukan menu yang sesuai dengan pencarian "${searchKeyword}".`
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
    const namaMenu = escapeHTML(item.nama_menu || 'Menu Terverifikasi BGN');
    const namaSppg = escapeHTML(item.nama_sppg || 'SPPG Nasional');
    const wilayah = escapeHTML(item.wilayah || 'Indonesia');
    const targetSekolah = escapeHTML(item.target_sekolah || '-');
    const kalori = finiteNumber(item.kalori_total);
    const protein = finiteNumber(item.protein_gram);
    const karbo = finiteNumber(item.karbo_gram);
    const lemak = finiteNumber(item.lemak_gram);
    const status = escapeHTML(item.status_distribusi || 'Telah Tiba di Sekolah');
    const foto = escapeHTML(safeImageURL(item.foto_url, menuImageFallbackURL));

    html += `
      <div class="bg-surface-card rounded-2xl border border-border-subtle overflow-hidden card-hover flex flex-col">
        <div class="relative h-48 w-full bg-surface-container-low overflow-hidden">
          <img src="${foto}" alt="${namaMenu}" class="w-full h-full object-cover" />
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
  attachImageFallbacks(container, menuImageFallbackURL);
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
  // The homepage owns an immediate cached-avatar render and refreshes it from the session API.
  if (document.getElementById('navUserDropdownWrap')) return;
  // Sesi statis (login.html) punya prioritas; kalau ada, tidak perlu cek PHP
  if (applyStaticSessionFallback()) return;
  try {
    const res = await fetch(getApiPrefix() + 'auth_user.php', { credentials: 'same-origin' });
    if (!res.ok) { applyStaticSessionFallback(); return; }
    const data = await res.json();

    if (!data.logged_in || !data.user) { applyStaticSessionFallback(); return; }

    const u = data.user;
    // Role is a path segment and controls which links are shown, not free text.
    if (!['admin', 'sppg', 'user'].includes(u.role)) return;
    const avatarURL = escapeHTML(safeProfileImageURL(u.avatar_url || u.avatar));
    const desktopLoginLink = document.querySelector('header nav + div a[href*="login.html"], header a[href*="login.html"]:not(#mobileNavMenu a)');
    const mobileLoginLink = document.querySelector('#mobileNavMenu a[href*="login.html"]');

    // Desktop Profile Dropdown
    if (desktopLoginLink) {
      const wrapper = document.createElement('div');
      wrapper.className = 'relative inline-block text-left';
      wrapper.id = 'headerUserDropdownContainer';

      wrapper.innerHTML = `
        <button id="btnHeaderProfile" type="button" class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-border-subtle shadow-sm transition-all focus:outline-none">
          <img src="${avatarURL}" alt="${escapeHTML(u.full_name)}" class="w-7 h-7 rounded-full border border-primary/20 object-cover bg-white">
          <div class="flex flex-col text-left hidden lg:flex">
            <span class="text-xs font-bold text-on-surface leading-tight max-w-[110px] truncate">${escapeHTML(u.full_name)}</span>
            <span class="text-[10px] text-secondary font-medium leading-none">${escapeHTML(u.role_label)}</span>
          </div>
          <span class="material-symbols-outlined text-[16px] text-outline">expand_more</span>
        </button>
        
        <div id="headerProfileMenu" class="hidden absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50">
          <div class="px-4 py-3 border-b border-slate-100 flex items-center gap-3 bg-slate-50/70">
            <img src="${avatarURL}" alt="${escapeHTML(u.full_name)}" class="w-10 h-10 rounded-full border-2 border-white shadow-sm bg-white">
            <div class="flex flex-col overflow-hidden">
              <span class="text-xs font-bold text-slate-900 truncate">${escapeHTML(u.full_name)}</span>
              <span class="text-[11px] text-slate-500 font-mono truncate">@${escapeHTML(u.username)}</span>
              <span class="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 w-fit">${escapeHTML(u.role_label)}</span>
            </div>
          </div>

          <div class="py-1">
            <a href="${escapeHTML(appRoute(`dashboard/${u.role}/index.html`))}" class="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
              <span class="material-symbols-outlined text-[18px] text-blue-600">dashboard</span>
              <span>Dashboard ${escapeHTML(u.role.toUpperCase())}</span>
            </a>
            ${u.role === 'admin' ? `
            <a href="${escapeHTML(appRoute('dashboard/admin/index.html#telemetry-manager'))}" class="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
              <span class="material-symbols-outlined text-[18px] text-emerald-600">monitoring</span>
              <span>Panel Input Telemetri & KPI</span>
            </a>
            <a href="${escapeHTML(appRoute('dashboard/admin/maintenance.html'))}" class="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
              <span class="material-symbols-outlined text-[18px] text-purple-600">admin_panel_settings</span>
              <span>Panel Pemeliharaan Sistem</span>
            </a>
            ` : ''}
            ${u.role === 'sppg' ? `
            <a href="${escapeHTML(appRoute('dashboard/sppg/index.html#input-menu'))}" class="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
              <span class="material-symbols-outlined text-[18px] text-emerald-600">soup_kitchen</span>
              <span>Panel Dapur SPPG & Input Menu</span>
            </a>
            <a href="${escapeHTML(appRoute('dashboard/sppg/index.html#riwayat-menu'))}" class="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
              <span class="material-symbols-outlined text-[18px] text-amber-600">biotech</span>
              <span>Riwayat Menu & Gizi</span>
            </a>
            ` : ''}
            ${u.role === 'user' ? `
            <a href="${escapeHTML(appRoute('dashboard/user/index.html#riwayat-aduan'))}" class="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
              <span class="material-symbols-outlined text-[18px] text-amber-600">receipt_long</span>
              <span>Status Aduan Saya</span>
            </a>
            ` : ''}
            <a href="${escapeHTML(appRoute('dashboard/account/profile.html'))}" class="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
              <span class="material-symbols-outlined text-[18px] text-indigo-600">account_circle</span>
              <span>Atur Profil</span>
            </a>
            <a href="${escapeHTML(appRoute('dashboard/account/password.html'))}" class="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
              <span class="material-symbols-outlined text-[18px] text-amber-600">key</span>
              <span>Ganti Kata Sandi</span>
            </a>
          </div>

          <div class="pt-1 border-t border-slate-100">
            <a href="${escapeHTML(appRoute('auth/login.html?logout=1'))}" class="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors">
              <span class="material-symbols-outlined text-[18px] text-red-500">logout</span>
              <span>Keluar (Logout)</span>
            </a>
          </div>
        </div>
      `;

      attachImageFallbacks(wrapper, profileImageFallbackURL);
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
          <img src="${avatarURL}" alt="${escapeHTML(u.full_name)}" class="w-9 h-9 rounded-full border border-primary/20 bg-white">
          <div class="flex flex-col">
            <span class="text-xs font-bold text-on-surface">${escapeHTML(u.full_name)}</span>
            <span class="text-[11px] text-secondary font-medium">${escapeHTML(u.role_label)}</span>
          </div>
        </div>
        <div class="flex flex-col gap-1 pt-2 border-t border-border-subtle">
          <a href="${escapeHTML(appRoute(`dashboard/${u.role}/index.html`))}" class="px-3 py-1.5 text-xs font-bold text-primary rounded-lg bg-surface-container-high flex items-center gap-2">
            <span class="material-symbols-outlined text-[16px]">dashboard</span>
            <span>Buka Dashboard</span>
          </a>
          ${u.role === 'admin' ? `
          <a href="${escapeHTML(appRoute('dashboard/admin/maintenance.html'))}" class="px-3 py-1.5 text-xs font-bold text-purple-700 rounded-lg bg-purple-50 flex items-center gap-2">
            <span class="material-symbols-outlined text-[16px]">admin_panel_settings</span>
            <span>Panel Pemeliharaan Sistem</span>
          </a>
          ` : ''}
          ${u.role === 'sppg' ? `
          <a href="${escapeHTML(appRoute('dashboard/sppg/index.html#input-menu'))}" class="px-3 py-1.5 text-xs font-bold text-emerald-700 rounded-lg bg-emerald-50 flex items-center gap-2">
            <span class="material-symbols-outlined text-[16px]">soup_kitchen</span>
            <span>Panel Dapur SPPG</span>
          </a>
          ` : ''}
          <a href="${escapeHTML(appRoute('dashboard/account/profile.html'))}" class="px-3 py-1.5 text-xs font-bold text-slate-700 rounded-lg hover:bg-surface-container-high flex items-center gap-2">
            <span class="material-symbols-outlined text-[16px] text-indigo-600">account_circle</span>
            <span>Atur Profil</span>
          </a>
          <a href="${escapeHTML(appRoute('dashboard/account/password.html'))}" class="px-3 py-1.5 text-xs font-bold text-slate-700 rounded-lg hover:bg-surface-container-high flex items-center gap-2">
            <span class="material-symbols-outlined text-[16px] text-amber-600">key</span>
            <span>Ganti Kata Sandi</span>
          </a>
          <a href="${escapeHTML(appRoute('auth/login.html?logout=1'))}" class="px-3 py-1.5 text-xs font-bold text-red-600 rounded-lg hover:bg-red-50 flex items-center gap-2">
            <span class="material-symbols-outlined text-[16px]">logout</span>
            <span>Keluar (Logout)</span>
          </a>
        </div>
      `;
      attachImageFallbacks(mobWrapper, profileImageFallbackURL);
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

  btnBell.setAttribute('aria-label', 'Notifikasi laporan dan sistem');
  btnBell.setAttribute('aria-controls', dropdown.id);
  btnBell.setAttribute('aria-expanded', 'false');
  btnBell.addEventListener('click', function(e) {
    e.stopPropagation();
    const isOpen = !dropdown.classList.toggle('hidden');
    btnBell.setAttribute('aria-expanded', String(isOpen));
    fetchNotifications();
  });

  document.addEventListener('click', function(e) {
    if (container && !container.contains(e.target)) {
      dropdown.classList.add('hidden');
      btnBell.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !dropdown.classList.contains('hidden')) {
      dropdown.classList.add('hidden');
      btnBell.setAttribute('aria-expanded', 'false');
      btnBell.focus();
    }
  });

  async function fetchNotifications() {
    try {
      const res = await fetch(getApiPrefix() + 'notifications.php', { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json || json.status !== 'success') throw new Error(json.message || 'Data notifikasi tidak tersedia');

      const data = json;
      const count = finiteNumber(data.badge_count);
      const pendingLogos = finiteNumber(data.pending_sppg_logos);

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
        if (pendingLogos > 0) {
          itemsHtml += `
            <a href="${escapeHTML(appRoute('dashboard/admin/index.html#verifikasi-logo-sppg'))}" class="block px-4 py-3 hover:bg-amber-50/70 transition-colors bg-amber-50/30">
              <div class="flex items-start gap-2.5">
                <span class="material-symbols-outlined text-amber-600 text-[20px] shrink-0">verified_user</span>
                <div>
                  <p class="text-xs font-bold text-slate-800">Verifikasi Logo Dapur SPPG (${pendingLogos})</p>
                  <p class="text-[11px] text-slate-600 mt-0.5">Ada permohonan pergantian logo SPPG yang menunggu konfirmasi Satgas BGN.</p>
                </div>
              </div>
            </a>
          `;
        }

        if (Array.isArray(data.latest_reports) && data.latest_reports.length > 0) {
          data.latest_reports.forEach(r => {
            const timeAgo = r.created_at ? new Date(r.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB' : 'Baru saja';
            itemsHtml += `
              <a href="${escapeHTML(appRoute('dashboard/admin/index.html'))}" class="block px-4 py-2.5 hover:bg-slate-50 transition-colors">
                <div class="flex items-start gap-2.5">
                  <span class="material-symbols-outlined text-red-500 text-[18px] shrink-0">report_problem</span>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between">
                      <span class="text-[11px] font-mono font-bold text-blue-700">${escapeHTML(r.ticket_code)}</span>
                      <span class="text-[10px] text-slate-400">${escapeHTML(timeAgo)}</span>
                    </div>
                    <p class="text-xs font-semibold text-slate-800 truncate">${escapeHTML(r.issue_category)}: ${escapeHTML(r.school_target || '-')}</p>
                    <p class="text-[11px] text-slate-500 truncate">Status: ${escapeHTML(r.status)}</p>
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
let mbgMapLocationsFitted = false;
let mbgMapRefreshInProgress = false;
let mbgMapDataSignature = null;
let mbgMapRetryAttempt = 0;
let mbgMapRetryTimer = null;
let mbgMapAssetsPromise = null;
const MBG_INDONESIA_MAP_BOUNDS = [[-12, 94], [7, 142]];

function loadMapAsset(tagName, id, url, integrity) {
  const existing = document.getElementById(id);
  if (existing) {
    if (existing.dataset.loaded === 'true') return Promise.resolve();
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', () => reject(new Error(`Gagal memuat ${url}`)), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const asset = document.createElement(tagName);
    asset.id = id;
    if (tagName === 'link') {
      asset.rel = 'stylesheet';
      asset.href = url;
    } else {
      asset.src = url;
    }
    if (integrity) {
      asset.integrity = integrity;
      asset.crossOrigin = 'anonymous';
    }
    asset.addEventListener('load', () => {
      asset.dataset.loaded = 'true';
      resolve();
    }, { once: true });
    asset.addEventListener('error', () => reject(new Error(`Gagal memuat ${url}`)), { once: true });
    document.head.appendChild(asset);
  });
}

function loadInteractiveMapAssets() {
  if (!mbgMapAssetsPromise) {
    mbgMapAssetsPromise = Promise.all([
      loadMapAsset('link', 'mbg-leaflet-css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'),
      loadMapAsset('link', 'mbg-markercluster-css', 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css'),
      loadMapAsset('link', 'mbg-markercluster-default-css', 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css')
    ]).then(() => loadMapAsset(
      'script',
      'mbg-leaflet-js',
      'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
      'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='
    )).then(() => loadMapAsset(
      'script',
      'mbg-markercluster-js',
      'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js'
    ));
  }
  return mbgMapAssetsPromise;
}

function initInteractiveTelemetryMapWhenVisible() {
  const mapElement = document.getElementById('mbgInteractiveMap');
  if (!mapElement) return;

  let started = false;
  const startMap = () => {
    if (started) return;
    started = true;
    const mapCount = document.getElementById('mapLocationCount');
    if (mapCount) mapCount.textContent = 'Memuat peta dan lokasi SPPG…';
    loadInteractiveMapAssets()
      .then(() => initInteractiveTelemetryMap())
      .catch(error => {
        console.error('[BGN] Gagal memuat komponen peta:', error);
        if (mapCount) mapCount.textContent = 'Peta gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.';
      });
  };

  if (!('IntersectionObserver' in window)) {
    window.setTimeout(startMap, 0);
    return;
  }

  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    startMap();
  }, { rootMargin: '400px 0px' });
  observer.observe(mapElement);
}

async function initInteractiveTelemetryMap() {
  const mapElement = document.getElementById('mbgInteractiveMap');
  const mapCount = document.getElementById('mapLocationCount');
  if (!mapElement) return;
  if (typeof L === 'undefined') {
    if (mapCount) mapCount.textContent = 'Peta gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.';
    return;
  }

  mbgLeafletMap = L.map(mapElement, {
    center: [-2.5, 118],
    zoom: 4,
    minZoom: 4,
    maxBounds: [[-22, 80], [17, 155]],
    maxBoundsViscosity: 1
  });
  const baseMapLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(mbgLeafletMap);
  const indonesiaBoundaryLayer = L.layerGroup().addTo(mbgLeafletMap);
  const markerLayer = typeof L.markerClusterGroup === 'function'
    ? L.markerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: 48,
        showCoverageOnHover: false,
        iconCreateFunction: cluster => {
          const sppgCount = cluster.getAllChildMarkers().reduce(
            (total, marker) => total + (marker.sppgCount || 1),
            0
          );
          return L.divIcon({
            html: `<span>${sppgCount.toLocaleString('id-ID')}</span>`,
            className: 'sppg-map-cluster',
            iconSize: [42, 42]
          });
        }
      })
    : L.featureGroup();
  markerLayer.addTo(mbgLeafletMap);

  function showMapStatus(message, canRetry) {
    if (!mapCount) return;
    mapCount.textContent = message;
    if (!canRetry) return;
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'ml-2 underline font-semibold text-primary';
    retry.textContent = 'Coba lagi';
    retry.addEventListener('click', refreshLocations);
    mapCount.appendChild(retry);
  }

  async function loadIndonesiaBoundary() {
    try {
      const response = await fetch('assets/data/indonesia-boundary.geojson', { cache: 'force-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const feature = await response.json();
      const polygons = feature && feature.geometry && feature.geometry.coordinates;
      if (feature.geometry.type !== 'MultiPolygon' || !Array.isArray(polygons) || !polygons.length) {
        throw new Error('Format batas Indonesia tidak valid');
      }

      const countryRings = polygons
        .map(polygon => polygon[0])
        .filter(ring => Array.isArray(ring) && ring.length >= 4)
        .map(ring => ring.map(([longitude, latitude]) => [latitude, longitude]));
      if (!countryRings.length) throw new Error('Batas wilayah Indonesia kosong');

      const outsideRing = [[16, 78], [16, 157], [-23, 157], [-23, 78], [16, 78]];
      L.polygon([outsideRing, ...countryRings], {
        stroke: false,
        fillColor: '#c9e6ed',
        fillOpacity: 1,
        fillRule: 'evenodd',
        interactive: false
      }).addTo(indonesiaBoundaryLayer);
      L.polyline(countryRings, {
        color: '#0f766e',
        opacity: 0.9,
        weight: 1,
        interactive: false
      }).addTo(indonesiaBoundaryLayer);
      mbgLeafletMap.fitBounds(MBG_INDONESIA_MAP_BOUNDS, { padding: [12, 12], maxZoom: 5 });
      return true;
    } catch (error) {
      console.error('[BGN] Gagal memuat batas Indonesia:', error);
      baseMapLayer.remove();
      if (mapCount) mapCount.textContent = 'Batas peta Indonesia gagal dimuat. Muat ulang halaman untuk mencoba kembali.';
      return false;
    }
  }

  async function refreshLocations() {
    if (mbgMapRefreshInProgress) return;
    mbgMapRefreshInProgress = true;
    if (mbgMapRetryTimer !== null) {
      window.clearTimeout(mbgMapRetryTimer);
      mbgMapRetryTimer = null;
    }

    try {
      const response = await fetch(`${getApiPrefix()}sppg_map.php?limit=50000`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const geoJson = await response.json();
      if (!geoJson || !Array.isArray(geoJson.features)) throw new Error('Format data peta tidak valid');
      mbgMapRetryAttempt = 0;

      const dataSignature = geoJson.features.map(feature => {
        const coordinates = feature.geometry && feature.geometry.coordinates || [];
        return [
          feature.properties && feature.properties.id,
          coordinates[0],
          coordinates[1],
          feature.properties && feature.properties.location_accuracy,
          feature.properties && feature.properties.sppg_count
        ].join(':');
      }).join('|');

      if (dataSignature !== mbgMapDataSignature) {
        markerLayer.clearLayers();
        const newMarkers = [];
        let approximateCount = 0;
        let gpsCount = 0;
        geoJson.features.forEach(feature => {
          const coordinates = feature.geometry && feature.geometry.coordinates;
          if (!Array.isArray(coordinates) || coordinates.length < 2) return;
          const longitude = Number(coordinates[0]);
          const latitude = Number(coordinates[1]);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
              latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return;

          const properties = feature.properties || {};
          const isApproximate = properties.location_accuracy === 'approximate';
          const sppgCount = Math.max(1, Number(properties.sppg_count) || 1);
          if (isApproximate) approximateCount += sppgCount;
          else gpsCount += sppgCount;
          const marker = L.marker([latitude, longitude], {
            icon: L.divIcon({
              html: '<span class="sppg-map-marker-dot"></span>',
              className: `sppg-map-marker${isApproximate ? ' approximate' : ''}`,
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            })
          });
          marker.sppgCount = sppgCount;
          const popup = document.createElement('div');
          popup.className = 'sppg-map-popup';
          const name = document.createElement('strong');
          name.textContent = properties.nama || 'SPPG';
          popup.appendChild(name);
          if (sppgCount > 1) {
            const count = document.createElement('div');
            count.textContent = `${sppgCount.toLocaleString('id-ID')} dapur SPPG di wilayah ini`;
            popup.appendChild(count);
          }
          if (Array.isArray(properties.sample_names) && properties.sample_names.length) {
            const samples = document.createElement('small');
            samples.textContent = `Contoh: ${properties.sample_names.join(', ')}`;
            popup.appendChild(samples);
          }
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
          const accuracy = document.createElement('small');
          accuracy.className = isApproximate ? 'approximate' : 'verified';
          accuracy.textContent = properties.location_label || 'Koordinat GPS terdaftar';
          popup.appendChild(accuracy);
          marker.bindPopup(popup, { maxWidth: 260 });
          newMarkers.push(marker);
        });

        if (typeof markerLayer.addLayers === 'function') markerLayer.addLayers(newMarkers);
        else newMarkers.forEach(marker => markerLayer.addLayer(marker));
        mbgMapDataSignature = dataSignature;

        const locationCount = Number(geoJson.count) || newMarkers.length;
        const unmappedCount = Number(geoJson.unmapped) || 0;
        approximateCount = Number(geoJson.approximate_count) || approximateCount;
        gpsCount = Number(geoJson.gps_count) || gpsCount;
        if (newMarkers.length && !mbgMapLocationsFitted) {
          mbgLeafletMap.fitBounds(MBG_INDONESIA_MAP_BOUNDS, { padding: [12, 12], maxZoom: 5 });
          mbgMapLocationsFitted = true;
        }
        if (mapCount) {
          mapCount.textContent = locationCount
            ? `${locationCount.toLocaleString('id-ID')} lokasi · ${approximateCount.toLocaleString('id-ID')} perkiraan · ${gpsCount.toLocaleString('id-ID')} GPS · ${unmappedCount.toLocaleString('id-ID')} belum terpetakan`
            : 'Belum ada lokasi SPPG yang dapat dipetakan';
        }
      }
    } catch (error) {
      console.error('[BGN] Gagal memuat lokasi SPPG:', error);
      const reason = error instanceof Error && /^HTTP \d+$/.test(error.message)
        ? `API peta mengembalikan ${error.message}`
        : 'API peta tidak dapat dihubungi atau datanya tidak valid';
      const retryDelay = Math.min(5000 * (2 ** mbgMapRetryAttempt), 60000);
      mbgMapRetryAttempt++;
      showMapStatus(`${reason}. Mencoba lagi otomatis dalam ${Math.round(retryDelay / 1000)} detik.`, true);
      mbgMapRetryTimer = window.setTimeout(refreshLocations, retryDelay);
    } finally {
      mbgMapRefreshInProgress = false;
    }
  }

  if (!await loadIndonesiaBoundary()) return;
  refreshLocations();
  window.setInterval(refreshLocations, 300000);

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
  function closeProvinsiModal() {
    modal.classList.add('hidden');
  }

  function openProvinsiModal(provinsi) {
    if (!modal || !titleEl || !listEl) return;
    titleEl.textContent = 'SPPG di ' + provinsi;
    listEl.innerHTML =
      '<div class="py-10 text-center text-slate-400 text-sm">' +
      '<div class="w-8 h-8 border-4 border-slate-200 border-t-slate-400 rounded-full animate-spin mx-auto mb-3"></div>' +
      'Memuat data SPPG...</div>';
    modal.classList.remove('hidden');

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
    return escapeHTML(s);
  }
}
