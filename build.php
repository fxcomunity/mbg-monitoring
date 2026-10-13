<?php
// build.php - Generator for Radar MBG pages based on stitch_radar_mbg_redesign

function injectFaviconAndMeta($html, $title = '') {
    $favicon = '<link rel="icon" type="image/webp" href="logo.webp"/><link rel="apple-touch-icon" href="logo.webp"/>';
    if ($title) {
        if (preg_match('/<title>[\s\S]*?<\/title>/', $html)) {
            $html = preg_replace('/<title>[\s\S]*?<\/title>/', "<title>$title</title>", $html);
        } else {
            $html = str_replace('<head>', "<head>\n  <title>$title</title>", $html);
        }
    }
    if (strpos($html, 'rel="icon"') === false) {
        $html = str_replace('<head>', "<head>\n  " . $favicon, $html);
    }
    return $html;
}

function getHeader($activePage = 'index') {
    $items = [
        ['id' => 'index', 'title' => 'Beranda', 'url' => 'index.html'],
        ['id' => 'menu', 'title' => 'Menu Hari Ini', 'url' => 'menu-hari-ini.html'],
        ['id' => 'distribusi', 'title' => 'Distribusi & Wilayah', 'url' => 'distribusi-sebaran-sppg.html'],
        ['id' => 'standar', 'title' => 'Standar & AKG', 'url' => 'standar-uji-akg.html'],
        ['id' => 'aduan', 'title' => 'Laporan & Aduan Publik', 'url' => 'laporan-aduan.html'],
    ];

    $desktopNav = '';
    $mobileNav = '';
    foreach ($items as $item) {
        $isActive = ($item['id'] === $activePage);
        $cls = $isActive 
            ? 'px-space-md py-space-sm bg-primary-container text-on-primary font-semibold rounded-lg shadow-sm transition-all'
            : 'px-space-md py-space-sm font-label-lg text-label-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface rounded-lg transition-all';
        $desktopNav .= '<a class="' . $cls . '" href="' . $item['url'] . '">' . $item['title'] . '</a>';

        $mCls = $isActive
            ? 'px-4 py-2.5 bg-primary-container text-on-primary font-semibold rounded-xl transition-all'
            : 'px-4 py-2.5 font-label-md text-on-surface hover:bg-surface-container rounded-xl transition-all';
        $mobileNav .= '<a class="' . $mCls . '" href="' . $item['url'] . '">' . $item['title'] . '</a>';
    }

    return <<<HTML
<header class="fixed top-0 w-full z-50 bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
  <div class="h-20 w-full px-space-md sm:px-space-lg flex items-center justify-between gap-space-md">
    <a href="index.html" class="flex items-center gap-space-md group">
      <img src="logo.webp" alt="Logo Badan Gizi Nasional" class="h-10 sm:h-12 w-auto object-contain group-hover:scale-105 transition-transform drop-shadow-sm" />
      <div class="flex flex-col">
        <div class="flex items-center gap-space-xs">
          <span class="font-headline-sm text-headline-sm text-primary tracking-tight font-bold">Radar MBG</span>
          <span class="px-2 py-0.5 rounded-full bg-tertiary-container text-tertiary-fixed text-label-sm font-label-sm uppercase tracking-wide font-semibold">Nasional</span>
        </div>
        <span class="font-label-sm text-label-sm text-on-surface-variant font-medium">Badan Gizi Nasional Republik Indonesia</span>
      </div>
    </a>
    
    <nav class="hidden xl:flex items-center gap-1 p-1 bg-surface-container-low rounded-xl">
      $desktopNav
    </nav>
    
    <div class="flex items-center gap-space-sm sm:gap-space-md">
      <div class="hidden md:flex items-center relative w-56 lg:w-64">
        <span class="material-symbols-outlined absolute left-3 text-outline text-[18px]">search</span>
        <input id="navGlobalSearch" class="w-full pl-9 pr-space-md py-2 bg-surface-container-lowest text-on-surface placeholder:text-outline font-body-sm text-body-sm rounded-xl border border-border-subtle focus:outline-none focus:ring-2 focus:ring-border-focus transition-all" placeholder="Cari sekolah, SPPG..." type="text"/>
      </div>
      <a class="hidden sm:flex items-center gap-space-xs px-space-md py-2 rounded-xl bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md transition-colors shadow-sm" href="menu-hari-ini.html">
        <span class="w-2 h-2 rounded-full bg-status-success animate-pulse"></span>
        <span>Status MBG Hari Ini</span>
      </a>
      <!-- Mobile menu button -->
      <button id="btnMobileNavToggle" class="xl:hidden w-10 h-10 rounded-xl bg-surface-container-low hover:bg-surface-container text-primary flex items-center justify-center transition-colors">
        <span class="material-symbols-outlined text-[24px]">menu</span>
      </button>
    </div>
  </div>
  
  <!-- Mobile dropdown menu -->
  <div id="mobileNavMenu" class="hidden xl:hidden w-full bg-surface-card border-b border-border-subtle px-4 py-3 flex flex-col gap-1 shadow-lg">
    $mobileNav
    <div class="pt-2 mt-1 border-t border-border-subtle flex flex-col gap-2">
      <a class="flex items-center justify-center gap-space-xs px-4 py-2.5 rounded-xl bg-primary text-on-primary font-label-md text-label-md shadow-sm" href="menu-hari-ini.html">
        <span class="w-2 h-2 rounded-full bg-status-success animate-pulse"></span>
        <span>Status MBG Hari Ini</span>
      </a>
    </div>
  </div>
</header>
HTML;
}

function getFooter() {
    return <<<HTML
<footer class="w-full bg-surface-container-lowest border-t border-border-subtle mt-space-xl">
  <div class="w-full px-space-lg py-space-xl">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-xl mb-space-xl">
      <div class="flex flex-col gap-space-sm">
        <div class="flex items-center gap-space-sm">
          <img src="logo.webp" alt="Logo Badan Gizi Nasional" class="h-9 w-auto object-contain" />
          <span class="font-headline-sm text-headline-sm text-primary font-bold">Badan Gizi Nasional</span>
        </div>
        <p class="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
          Lembaga Pemerintah yang bertanggung jawab atas pengelolaan, pemenuhan gizi berkualitas, dan program Makan Bergizi Gratis (MBG) bagi generasi emas Indonesia.
        </p>
        <div class="flex items-center gap-space-xs text-status-success font-label-sm text-label-sm">
          <span class="material-symbols-outlined text-[16px]">check_circle</span>
          <span>Portal Resmi Pemerintah RI Terverifikasi</span>
        </div>
      </div>
      <div class="flex flex-col gap-space-sm">
        <span class="font-label-lg text-label-lg text-primary uppercase tracking-wider">Layanan Aduan &amp; Bantuan</span>
        <div class="flex flex-col gap-space-xs font-body-sm text-body-sm text-on-surface-variant">
          <div class="flex items-start gap-space-xs">
            <span class="material-symbols-outlined text-primary text-[18px] mt-0.5">call</span>
            <div>
              <span class="font-label-md text-label-md text-primary block">Halo MBG RI:</span>
              <a href="https://wa.me/6281110008008" target="_blank" class="hover:text-primary font-semibold transition-colors">+62 811-1000-8008</a>
            </div>
          </div>
          <div class="flex items-start gap-space-xs">
            <span class="material-symbols-outlined text-primary text-[18px] mt-0.5">mail</span>
            <div>
              <span class="font-label-md text-label-md text-primary block">Surat Elektronik:</span>
              <a href="mailto:halo@bgn.go.id" class="hover:text-primary font-semibold transition-colors">halo@bgn.go.id</a>
            </div>
          </div>
          <div class="flex items-start gap-space-xs">
            <span class="material-symbols-outlined text-primary text-[18px] mt-0.5">schedule</span>
            <div>
              <span class="font-label-md text-label-md text-primary block">Jam Layanan Siaga:</span>
              <span>Senin - Minggu: 06.00 - 20.00 WIB</span>
            </div>
          </div>
        </div>
      </div>
      <div class="flex flex-col gap-space-sm">
        <span class="font-label-lg text-label-lg text-primary uppercase tracking-wider">Tautan Portal &amp; Modul</span>
        <ul class="flex flex-col gap-space-xs font-body-sm text-body-sm text-on-surface-variant">
          <li><a class="hover:text-primary transition-colors flex items-center gap-1" href="index.html"><span class="material-symbols-outlined text-[14px]">arrow_forward</span>Monitoring Nasional MBG</a></li>
          <li><a class="hover:text-primary transition-colors flex items-center gap-1" href="menu-hari-ini.html"><span class="material-symbols-outlined text-[14px]">arrow_forward</span>Menu Hari Ini &amp; AKG</a></li>
          <li><a class="hover:text-primary transition-colors flex items-center gap-1" href="distribusi-sebaran-sppg.html"><span class="material-symbols-outlined text-[14px]">arrow_forward</span>Distribusi &amp; Sebaran SPPG</a></li>
          <li><a class="hover:text-primary transition-colors flex items-center gap-1" href="standar-uji-akg.html"><span class="material-symbols-outlined text-[14px]">arrow_forward</span>Standar AKG &amp; Uji Mutu</a></li>
          <li><a class="hover:text-primary transition-colors flex items-center gap-1" href="laporan-aduan.html"><span class="material-symbols-outlined text-[14px]">arrow_forward</span>Portal Aduan &amp; Pengaduan Publik</a></li>
        </ul>
      </div>
      <div class="flex flex-col gap-space-sm">
        <span class="font-label-lg text-label-lg text-primary uppercase tracking-wider">Transparansi &amp; Partisipasi</span>
        <div class="p-space-md rounded-xl bg-surface-container-low flex flex-col gap-space-xs">
          <span class="font-label-md text-label-md text-primary font-bold">Audit Publik Mandiri</span>
          <p class="font-body-sm text-body-sm text-on-surface-variant">
            Masyarakat berhak memantau komposisi nutrisi, asal suplai pangan lokal, dan verifikasi Satuan Pelayanan Pemenuhan Gizi (SPPG).
          </p>
          <a class="font-label-md text-label-md text-secondary hover:text-primary transition-colors flex items-center gap-1 mt-1 font-semibold" href="laporan-aduan.html">
            Buka Form Aduan Cepat <span class="material-symbols-outlined text-[14px]">open_in_new</span>
          </a>
        </div>
      </div>
    </div>
    <div class="pt-space-lg border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-space-md text-on-surface-variant font-body-sm text-body-sm">
      <div class="flex flex-wrap items-center gap-2">
        <span class="px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-label-sm font-semibold tracking-wide">Redesain</span>
        <span>© 2026 Badan Gizi Nasional Republik Indonesia. Hak Cipta Dilindungi Undang-Undang.</span>
      </div>
      <div class="flex items-center gap-space-lg font-label-md text-label-md">
        <a class="hover:text-primary transition-colors" href="kebijakan-privasi.html">Kebijakan Privasi</a>
        <a class="hover:text-primary transition-colors" href="standar-uji-akg.html">Standar Kualitas Pangan</a>
        <a class="hover:text-primary transition-colors" href="index.html">Keterbukaan Informasi Publik</a>
      </div>
    </div>
  </div>
</footer>
<script>
  // Mobile Nav Toggle
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btnMobileNavToggle');
    const menu = document.getElementById('mobileNavMenu');
    if (btn && menu) {
      btn.addEventListener('click', () => {
        menu.classList.toggle('hidden');
      });
    }

    // Global Nav Search
    const navSearch = document.getElementById('navGlobalSearch');
    if (navSearch) {
      navSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const q = encodeURIComponent(navSearch.value.trim());
          if (q) window.location.href = 'menu-hari-ini.html?q=' + q;
        }
      });
    }
  });
</script>
HTML;
}

// 1. BUILD index.html
$sourceIndex = file_get_contents(__DIR__ . '/stitch_radar_mbg_redesign/stitch_radar_mbg_redesign/monitoring_nasional_radar_mbg_badan_gizi_nasional/code.html');

// Replace header
$sourceIndex = preg_replace('/<header[\s\S]*?<\/header>/', getHeader('index'), $sourceIndex);
// Replace footer
$sourceIndex = preg_replace('/<footer[\s\S]*?<\/footer>[\s\S]*?<\/body>/', getFooter() . "\n</body>", $sourceIndex);

// Update Quick Access Cards links
$sourceIndex = str_replace(
    '<span class="font-label-md text-label-md text-secondary group-hover:text-primary font-semibold">Buka Jadwal Menu</span>',
    '<a href="menu-hari-ini.html" class="font-label-md text-label-md text-secondary group-hover:text-primary font-semibold flex items-center justify-between w-full"><span>Buka Jadwal Menu</span><span class="material-symbols-outlined text-secondary group-hover:translate-x-1 transition-transform">arrow_forward</span></a>',
    $sourceIndex
);
$sourceIndex = str_replace(
    '<span class="font-label-md text-label-md text-secondary group-hover:text-primary font-semibold">Eksplorasi Peta Dapur</span>',
    '<a href="distribusi-sebaran-sppg.html" class="font-label-md text-label-md text-secondary group-hover:text-primary font-semibold flex items-center justify-between w-full"><span>Eksplorasi Peta Dapur</span><span class="material-symbols-outlined text-secondary group-hover:translate-x-1 transition-transform">arrow_forward</span></a>',
    $sourceIndex
);
$sourceIndex = str_replace(
    '<span class="font-label-md text-label-md text-secondary group-hover:text-primary font-semibold">Unduh Hasil Uji Lab</span>',
    '<a href="standar-uji-akg.html" class="font-label-md text-label-md text-secondary group-hover:text-primary font-semibold flex items-center justify-between w-full"><span>Unduh Hasil Uji Lab</span><span class="material-symbols-outlined text-secondary group-hover:translate-x-1 transition-transform">arrow_forward</span></a>',
    $sourceIndex
);
$sourceIndex = str_replace(
    '<span class="font-label-md text-label-md text-secondary group-hover:text-primary font-semibold">Kirim Laporan Resmi</span>',
    '<a href="laporan-aduan.html" class="font-label-md text-label-md text-secondary group-hover:text-primary font-semibold flex items-center justify-between w-full"><span>Kirim Laporan Resmi</span><span class="material-symbols-outlined text-secondary group-hover:translate-x-1 transition-transform">arrow_forward</span></a>',
    $sourceIndex
);

// Update CTA button "Buat Laporan / Aduan Baru"
$sourceIndex = preg_replace(
    '/<a class="[^"]*" href="#">\s*<span class="material-symbols-outlined text-\[20px\]">send<\/span>\s*<span>Buat Laporan \/ Aduan Baru<\/span>\s*<\/a>/',
    '<a class="px-space-lg py-3.5 rounded-xl bg-tertiary-fixed text-on-tertiary-fixed hover:bg-tertiary-fixed-dim transition-colors font-label-lg text-label-lg font-bold flex items-center justify-center gap-2 shadow-md" href="laporan-aduan.html"><span class="material-symbols-outlined text-[20px]">send</span><span>Buat Laporan / Aduan Baru</span></a>',
    $sourceIndex
);

// Connect dynamic search API in index.html
$apiSearchScript = <<<HTML
<script>
  // Enhanced dynamic search via api.php
  const schoolSearchInput = document.getElementById('schoolSearchInput');
  const modalSchoolQuery = document.getElementById('modalSchoolQuery');
  const btnSchoolModal = document.getElementById('btnSchoolModal');
  const modalBackdrop = document.getElementById('schoolModalBackdrop');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const btnConfirmModal = document.getElementById('btnConfirmModal');
  const modalResultContainer = modalBackdrop ? modalBackdrop.querySelector('.p-space-md.rounded-xl.bg-surface-container-low') : null;

  function fetchSchoolData(query) {
    if (!query) query = 'SDN 01 Senayan';
    fetch('api.php?school=' + encodeURIComponent(query))
      .then(r => r.json())
      .then(res => {
        if (res.data && res.data.length > 0) {
          const item = res.data[0];
          if (modalResultContainer) {
            modalResultContainer.innerHTML = `
              <div class="flex items-center justify-between">
                <span class="font-label-sm text-label-sm text-status-success font-bold flex items-center gap-1">
                  <span class="material-symbols-outlined text-[16px]">check_circle</span> Terjadwal Salur Pukul \${item.time || '10.30 WIB'}
                </span>
                <span class="font-label-sm text-label-sm text-secondary">\${item.sppg ? item.sppg.name : 'SPPG Kebayoran 02'}</span>
              </div>
              <span class="font-headline-sm text-headline-sm text-primary font-bold">\${item.school} - \${item.menu}</span>
              <p class="font-body-sm text-body-sm text-on-surface-variant">\${item.description || 'Porsi standar dengan gizi seimbang.'}</p>
              <div class="flex flex-wrap gap-2 pt-1 border-t border-border-subtle mt-1 text-[11px] text-on-surface-variant">
                <span>Kalori: <strong class="text-primary">\${item.calories || item.nutrition.energi}</strong></span> •
                <span>Suhu: <strong class="text-status-success">\${item.temperature || '68°C'}</strong></span> •
                <span>Dietisien: <strong class="text-secondary">\${item.sppg ? item.sppg.dietitian : 'Terverifikasi'}</strong></span>
              </div>
            `;
          }
        }
      })
      .catch(e => console.error('Fetch error:', e));
  }

  if (btnSchoolModal) {
    btnSchoolModal.addEventListener('click', () => {
      const q = schoolSearchInput ? schoolSearchInput.value.trim() : '';
      if (modalSchoolQuery && q) modalSchoolQuery.value = q;
      fetchSchoolData(q || (modalSchoolQuery ? modalSchoolQuery.value : ''));
    });
  }

  if (modalSchoolQuery) {
    modalSchoolQuery.addEventListener('input', () => {
      fetchSchoolData(modalSchoolQuery.value.trim());
    });
  }

  if (btnConfirmModal) {
    btnConfirmModal.addEventListener('click', () => {
      const q = modalSchoolQuery ? modalSchoolQuery.value.trim() : '';
      window.location.href = 'menu-hari-ini.html?q=' + encodeURIComponent(q);
    });
  }
</script>
HTML;

$sourceIndex = str_replace('</body>', $apiSearchScript . "\n</body>", $sourceIndex);
$sourceIndex = injectFaviconAndMeta($sourceIndex, 'Radar MBG - Pusat Monitoring & Transparansi Badan Gizi Nasional');
file_put_contents(__DIR__ . '/index.html', $sourceIndex);
echo "index.html written successfully.\n";

// 2. BUILD menu-hari-ini.html
$sourceMenu = file_get_contents(__DIR__ . '/stitch_radar_mbg_redesign/stitch_radar_mbg_redesign/radar_mbg_menu_hari_ini_transparansi_distribusi/code.html');
$sourceMenu = injectFaviconAndMeta($sourceMenu, 'Menu Hari Ini & Kandungan Gizi AKG - Radar MBG BGN');
$sourceMenu = preg_replace('/<header[\s\S]*?<\/header>/', getHeader('menu'), $sourceMenu);
$sourceMenu = preg_replace('/<footer[\s\S]*?<\/footer>[\s\S]*?<\/body>/', getFooter() . "\n</body>", $sourceMenu);

// Update Report links to laporan-aduan.html
$sourceMenu = str_replace(
    '<button class="py-2.5 px-3 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md transition-all flex items-center justify-center gap-1.5 shadow-sm">',
    '<a href="laporan-aduan.html" class="py-2.5 px-3 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md transition-all flex items-center justify-center gap-1.5 shadow-sm">',
    $sourceMenu
);
$sourceMenu = str_replace(
    '<span>Form Lapor MBG</span>' . "\n" . '</button>',
    '<span>Form Lapor MBG</span>' . "\n" . '</a>',
    $sourceMenu
);

// Replace Filter Form with cascading selects
$newFilterForm = <<<HTML
<form class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-space-md" id="filterForm">
  <!-- 1. Provinsi -->
  <div class="flex flex-col gap-1.5">
    <label class="font-label-md text-label-md text-primary flex items-center justify-between">
      <span>1. Provinsi</span>
      <span class="text-label-sm text-secondary font-medium">Langkah 1</span>
    </label>
    <div class="relative">
      <select id="filterProvinsi" class="w-full appearance-none bg-surface-container-low text-primary px-3.5 py-2.5 pr-9 rounded-xl font-body-md text-body-md focus:bg-surface-container-lowest focus:ring-2 focus:ring-border-focus focus:outline-none transition-all">
        <option value="">-- Pilih Provinsi --</option>
        <option value="dki">DKI Jakarta</option>
        <option value="jabar">Jawa Barat</option>
        <option value="jatim">Jawa Timur</option>
        <option value="jateng">Jawa Tengah</option>
      </select>
      <span class="material-symbols-outlined pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">expand_more</span>
    </div>
  </div>

  <!-- 2. Kota / Kabupaten -->
  <div class="flex flex-col gap-1.5">
    <label class="font-label-md text-label-md text-primary flex items-center justify-between">
      <span>2. Kota / Kab</span>
      <span class="text-label-sm text-secondary font-medium">Langkah 2</span>
    </label>
    <div class="relative">
      <select id="filterKota" class="w-full appearance-none bg-surface-container-low text-primary px-3.5 py-2.5 pr-9 rounded-xl font-body-md text-body-md focus:bg-surface-container-lowest focus:ring-2 focus:ring-border-focus focus:outline-none transition-all">
        <option value="">-- Pilih Kota / Kab --</option>
      </select>
      <span class="material-symbols-outlined pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">expand_more</span>
    </div>
  </div>

  <!-- 3. Jenjang -->
  <div class="flex flex-col gap-1.5">
    <label class="font-label-md text-label-md text-primary flex items-center justify-between">
      <span>3. Jenjang</span>
      <span class="text-label-sm text-on-surface-variant">Filter</span>
    </label>
    <div class="relative">
      <select id="filterJenjang" class="w-full appearance-none bg-surface-container-low text-primary px-3.5 py-2.5 pr-9 rounded-xl font-body-md text-body-md focus:bg-surface-container-lowest focus:ring-2 focus:ring-border-focus focus:outline-none transition-all">
        <option value="">Semua Jenjang</option>
        <option value="sd">SD (Sekolah Dasar)</option>
        <option value="smp">SMP (Menengah Pertama)</option>
        <option value="sma">SMA (Menengah Atas)</option>
      </select>
      <span class="material-symbols-outlined pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">expand_more</span>
    </div>
  </div>

  <!-- 4. Instansi Pendidikan / Sekolah -->
  <div class="flex flex-col gap-1.5 sm:col-span-2">
    <label class="font-label-md text-label-md text-primary flex items-center justify-between">
      <span>4. Nama Satuan Pendidikan (Sekolah)</span>
      <span id="schoolStatusTag" class="text-label-sm text-on-surface-variant font-semibold">Pilih Wilayah Dulu</span>
    </label>
    <div class="relative">
      <select id="schoolSelect" class="w-full appearance-none bg-surface-container-low text-primary px-3.5 py-2.5 pr-9 rounded-xl font-body-md text-body-md font-semibold focus:bg-surface-container-lowest focus:ring-2 focus:ring-border-focus focus:outline-none transition-all">
        <option value="">-- Pilih Satuan Pendidikan --</option>
      </select>
      <span class="material-symbols-outlined pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">expand_more</span>
    </div>
  </div>
</form>
HTML;

$sourceMenu = preg_replace('/<form class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-space-md" id="filterForm">[\s\S]*?<\/form>/', $newFilterForm, $sourceMenu);

// Update Action Strip & Active Breadcrumbs
$oldBreadcrumbSearch = '<div class="mt-space-md pt-space-md flex flex-wrap items-center justify-between gap-space-md">';
$newBreadcrumb = <<<HTML
<div class="mt-space-md pt-space-md flex flex-wrap items-center justify-between gap-space-md">
  <div class="flex items-center gap-2 flex-wrap" id="breadcrumbContainer">
    <span class="font-label-sm text-label-sm text-on-surface-variant">Rute Lokasi:</span>
    <span id="routeProvinsi" class="px-2 py-0.5 rounded-md bg-surface-container text-primary font-label-sm text-label-sm font-semibold">Belum Memilih</span>
    <span class="text-on-surface-variant text-label-sm">›</span>
    <span id="routeKota" class="px-2 py-0.5 rounded-md bg-surface-container text-primary font-label-sm text-label-sm font-semibold">-</span>
    <span class="text-on-surface-variant text-label-sm">›</span>
    <span id="breadcrumbSchool" class="px-2 py-0.5 rounded-md bg-primary-container text-on-primary font-label-sm text-label-sm font-semibold">-</span>
  </div>
  <div class="flex items-center gap-space-sm w-full sm:w-auto">
    <button id="btnResetFilter" class="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-label-md text-label-md transition-colors flex items-center justify-center gap-1.5" type="button">
      <span class="material-symbols-outlined text-[16px]">restart_alt</span>
      <span>Reset Pilihan</span>
    </button>
    <button id="btnApplyFilter" class="flex-1 sm:flex-initial px-5 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md transition-all shadow-sm flex items-center justify-center gap-1.5" type="button">
      <span class="material-symbols-outlined text-tertiary-fixed text-[18px]">search_check</span>
      <span>Tampilkan Menu MBG</span>
    </button>
  </div>
</div>
HTML;
$sourceMenu = preg_replace('/<div class="mt-space-md pt-space-md flex flex-wrap items-center justify-between gap-space-md">[\s\S]*?<\/div>\s*<\/div>\s*<\/section>/', $newBreadcrumb . "\n</div></section>", $sourceMenu);

// Empty State / Selection Prompt to show BEFORE user chooses a school
$selectionPromptHtml = <<<HTML
<!-- State Belum Memilih Sekolah (Empty / Selection Prompt State) -->
<section id="menuSelectionPrompt" class="w-full px-space-md sm:px-space-lg py-space-xl max-w-[1200px] mx-auto transition-all duration-300">
  <div class="bg-surface-card p-space-xl sm:p-12 rounded-3xl border-2 border-dashed border-border-subtle shadow-sm flex flex-col items-center justify-center text-center">
    <div class="w-16 h-16 rounded-2xl bg-primary-container text-tertiary-fixed flex items-center justify-center mb-4 shadow-sm">
      <span class="material-symbols-outlined text-[36px]">soup_kitchen</span>
    </div>
    <span class="px-3 py-1 rounded-full bg-surface-container text-secondary font-label-sm text-label-sm font-semibold mb-2">Portal Transparansi Publik Radar MBG</span>
    <h3 class="font-headline-xl text-headline-xl text-primary font-bold">Pilih Satuan Pendidikan Terlebih Dahulu</h3>
    <p class="font-body-lg text-body-lg text-on-surface-variant max-w-xl mt-2 leading-relaxed">
      Silakan gunakan dropdown filter wilayah di atas untuk menentukan provinsi, kota, dan sekolah Anda. Atau klik salah satu rekomendasi sekolah di bawah ini untuk langsung memantau menu hari ini, nilai gizi AKG terverifikasi, serta dapur SPPG penyedianya.
    </p>
    
    <!-- Quick Selection Pills -->
    <div class="mt-space-lg pt-space-md border-t border-border-subtle w-full max-w-2xl flex flex-col items-center gap-3">
      <span class="font-label-md text-label-md text-primary font-semibold flex items-center gap-1.5">
        <span class="material-symbols-outlined text-[18px] text-secondary">touch_app</span>
        Pilihan Cepat Sekolah Terpopuler:
      </span>
      <div class="flex flex-wrap items-center justify-center gap-2">
        <button type="button" class="quick-school-btn px-4 py-2 rounded-xl bg-surface-container-low hover:bg-primary hover:text-on-primary text-primary font-label-md text-label-md transition-all shadow-sm border border-border-subtle flex items-center gap-1.5" data-school="sdn-01-senayan">
          <span class="material-symbols-outlined text-[16px] text-tertiary-fixed">school</span>
          <span>SDN 01 Senayan (Jakarta)</span>
        </button>
        <button type="button" class="quick-school-btn px-4 py-2 rounded-xl bg-surface-container-low hover:bg-primary hover:text-on-primary text-primary font-label-md text-label-md transition-all shadow-sm border border-border-subtle flex items-center gap-1.5" data-school="sdn-01-menteng">
          <span class="material-symbols-outlined text-[16px] text-tertiary-fixed">school</span>
          <span>SDN 01 Menteng (Jakarta)</span>
        </button>
        <button type="button" class="quick-school-btn px-4 py-2 rounded-xl bg-surface-container-low hover:bg-primary hover:text-on-primary text-primary font-label-md text-label-md transition-all shadow-sm border border-border-subtle flex items-center gap-1.5" data-school="smpn-19-kby">
          <span class="material-symbols-outlined text-[16px] text-tertiary-fixed">school</span>
          <span>SMPN 19 Kebayoran (Jakarta)</span>
        </button>
        <button type="button" class="quick-school-btn px-4 py-2 rounded-xl bg-surface-container-low hover:bg-primary hover:text-on-primary text-primary font-label-md text-label-md transition-all shadow-sm border border-border-subtle flex items-center gap-1.5" data-school="sdn-sukajadi-03">
          <span class="material-symbols-outlined text-[16px] text-tertiary-fixed">school</span>
          <span>SDN Sukajadi 03 (Bandung)</span>
        </button>
        <button type="button" class="quick-school-btn px-4 py-2 rounded-xl bg-surface-container-low hover:bg-primary hover:text-on-primary text-primary font-label-md text-label-md transition-all shadow-sm border border-border-subtle flex items-center gap-1.5" data-school="smpn-3-sby">
          <span class="material-symbols-outlined text-[16px] text-tertiary-fixed">school</span>
          <span>SMPN 3 Surabaya (Jatim)</span>
        </button>
        <button type="button" class="quick-school-btn px-4 py-2 rounded-xl bg-surface-container-low hover:bg-primary hover:text-on-primary text-primary font-label-md text-label-md transition-all shadow-sm border border-border-subtle flex items-center gap-1.5" data-school="smpn-1-smg">
          <span class="material-symbols-outlined text-[16px] text-tertiary-fixed">school</span>
          <span>SMPN 1 Semarang (Jateng)</span>
        </button>
        <button type="button" class="quick-school-btn px-4 py-2 rounded-xl bg-surface-container-low hover:bg-primary hover:text-on-primary text-primary font-label-md text-label-md transition-all shadow-sm border border-border-subtle flex items-center gap-1.5" data-school="sman-70-jkt">
          <span class="material-symbols-outlined text-[16px] text-tertiary-fixed">school</span>
          <span>SMAN 70 Jakarta (SMA)</span>
        </button>
      </div>
    </div>
  </div>
</section>
HTML;

// Wrap the actual detail sections in #menuDetailWrapper
$startDetailTarget = '<!-- Section Menu MBG Hari Ini (Highlight Utama) -->';
$changeSchoolTopBar = <<<HTML
<div id="menuDetailWrapper" class="hidden transition-all duration-500">
  <div class="w-full max-w-[1200px] mx-auto px-space-md sm:px-space-lg pt-space-md">
    <div class="p-space-md rounded-2xl bg-surface-card border border-border-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full bg-status-success animate-pulse"></span>
        <span class="font-label-md text-label-md text-primary font-bold">Data Menu Terverifikasi Ditampilkan</span>
        <span class="font-body-sm text-body-sm text-on-surface-variant hidden sm:inline">• Diperbarui otomatis dari SPPG Mitra</span>
      </div>
      <button id="btnChangeSchoolTop" type="button" class="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-primary font-label-md text-label-md font-semibold flex items-center gap-1.5 transition-colors">
        <span class="material-symbols-outlined text-[18px]">edit</span>
        <span>Pilih / Ganti Sekolah Lain</span>
      </button>
    </div>
  </div>
HTML;

$sourceMenu = str_replace(
    $startDetailTarget,
    $selectionPromptHtml . "\n" . $changeSchoolTopBar . "\n" . $startDetailTarget,
    $sourceMenu
);

// Close the #menuDetailWrapper right before <footer
$sourceMenu = str_replace('</div></main><footer', '</div></div></main><footer', $sourceMenu);

// Add unique element IDs inside the menu detail section for dynamic injection
$sourceMenu = str_replace(
    '<span class="px-3 py-1 rounded-full bg-status-success/15 text-status-success font-label-sm text-label-sm font-semibold flex items-center gap-1">' . "\n" . '<span class="material-symbols-outlined text-[16px]">local_shipping</span>' . "\n" . '              Telah Tiba di Sekolah (Pukul 09:30 WIB)' . "\n" . '            </span>',
    '<span id="arrivalBadge" class="px-3 py-1 rounded-full bg-status-success/15 text-status-success font-label-sm text-label-sm font-semibold flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">local_shipping</span><span id="arrivalBadgeText">Telah Tiba di Sekolah (Pukul 09:30 WIB)</span></span>',
    $sourceMenu
);

$sourceMenu = str_replace(
    '<h2 id="packageTitle" class="font-headline-xl text-headline-xl text-primary font-bold">Paket Menu Siswa: SDN 01 Senayan Jakarta Selatan</h2>',
    '<h2 id="packageTitle" class="font-headline-xl text-headline-xl text-primary font-bold">Paket Menu Siswa: SDN 01 Senayan Jakarta Selatan</h2>',
    $sourceMenu
);

$sourceMenu = str_replace(
    '<p class="font-body-md text-body-md text-on-surface-variant mt-1">' . "\n" . '            Dipersiapkan khusus untuk kelompok usia 7-12 tahun dengan pemenuhan 32% Angka Kecukupan Gizi (AKG) Harian Nasional.' . "\n" . '          </p>',
    '<p id="packageAgeGroup" class="font-body-md text-body-md text-on-surface-variant mt-1">Dipersiapkan khusus untuk kelompok usia 7-12 tahun dengan pemenuhan 32% Angka Kecukupan Gizi (AKG) Harian Nasional.</p>',
    $sourceMenu
);

$sourceMenu = str_replace(
    '<span class="text-headline-md font-headline-md leading-none">620</span>',
    '<span id="totalCaloriesDisplay" class="text-headline-md font-headline-md leading-none">620</span>',
    $sourceMenu
);

$sourceMenu = str_replace(
    '<h4 class="font-headline-lg text-headline-lg text-on-primary font-bold">' . "\n" . '                Paket Nusantara Ayam Panggang Madu &amp; Tempe Bacem' . "\n" . '              </h4>',
    '<h4 id="heroDishTitle" class="font-headline-lg text-headline-lg text-on-primary font-bold">Paket Nusantara Ayam Panggang Madu &amp; Tempe Bacem</h4>',
    $sourceMenu
);

$sourceMenu = str_replace(
    '<span class="font-label-md text-label-md font-bold block text-on-primary">Dapur Sentral Kebayoran Baru 03</span>',
    '<span id="sppgNameDisplay" class="font-label-md text-label-md font-bold block text-on-primary">Dapur Sentral Kebayoran Baru 03</span>',
    $sourceMenu
);

$sourceMenu = str_replace(
    '<span class="font-body-sm text-body-sm text-on-primary-container">Jl. Kyai Maja No. 14, Jakarta Selatan</span>',
    '<span id="sppgAddressDisplay" class="font-body-sm text-body-sm text-on-primary-container">Jl. Kyai Maja No. 14, Jakarta Selatan</span>',
    $sourceMenu
);

$sourceMenu = str_replace(
    '<span class="font-label-sm text-label-sm text-primary font-bold">dr. Andini Saraswati, Sp.GK</span>',
    '<span id="sppgDietitianDisplay" class="font-label-sm text-label-sm text-primary font-bold">dr. Andini Saraswati, Sp.GK</span>',
    $sourceMenu
);

// JavaScript for Dynamic Cascading & Rendering
$completeMenuScript = <<<HTML
<script>
  // Complete Dataset for Indonesian Schools in MBG
  const schoolDb = {
    "sdn-01-senayan": {
      name: "SDN 01 Senayan",
      provinsi: "dki",
      provinsiName: "DKI Jakarta",
      kota: "jaksel",
      kotaName: "Jakarta Selatan",
      kecamatan: "Kebayoran Baru",
      jenjang: "sd",
      ageGroup: "Dipersiapkan khusus untuk kelompok usia SD (7-12 tahun) dengan pemenuhan 32% Angka Kecukupan Gizi (AKG) Harian Nasional.",
      arrival: "Telah Tiba di Sekolah (Pukul 09:30 WIB)",
      cycle: "Siklus Menu: Pekan ke-4 (Menu C-08)",
      packageName: "Paket Nusantara Ayam Panggang Madu & Tempe Bacem",
      desc: "Diolah tanpa pengawet buatan, rendah natrium (garam beriodium < 1.2g), dan menggunakan bahan pangan lokal segar dari mitra koperasi tani binaan.",
      calories: 620,
      photo: "https://lh3.googleusercontent.com/aida-public/AB6AXuCkLbSHziTgMS4wjfXnmGJaa87bd_N3KasCcc2H4qhnJv0-x1bXQDvleyxCuK58099ZoZfRbhBN8WpUfixGsZsefv_a7MSmNJ3smRd3oXRskR5Vg7Nxz16LFyr9C-wrk8QimhpK8Y0YYqWL4eT4Hl9kHVFimf3FAjdcJfglmxj3dWfqWiVQN0QL-uaA1bRCAWeW3sSvk0sUJAEDLbARjtbg1VzCHnlLwoPl9Ghqvw8_OF7pN35D3hpA",
      sppg: {
        name: "Dapur Sentral Kebayoran Baru 03",
        address: "Jl. Kyai Maja No. 14, Kebayoran Baru, Jakarta Selatan",
        radius: "Radius 3.2 km",
        dietitian: "dr. Andini Saraswati, Sp.GK",
        dietitianTitle: "Dietisien Verifikator BGN",
        lab: "BGN-JKT-2410-0988 (Negatif Formalin & E.coli)",
        temp: "62.4°C"
      }
    },
    "sdn-01-menteng": {
      name: "SDN 01 Menteng Jakarta",
      provinsi: "dki",
      provinsiName: "DKI Jakarta",
      kota: "jakpus",
      kotaName: "Jakarta Pusat",
      kecamatan: "Menteng",
      jenjang: "sd",
      ageGroup: "Dipersiapkan khusus untuk kelompok usia SD Awal (6-9 tahun) dengan fokus mikronutrien zat besi & kalsium.",
      arrival: "Telah Tiba di Sekolah (Pukul 09:15 WIB)",
      cycle: "Siklus Menu: Pekan ke-2 (Menu B-04)",
      packageName: "Paket Gurih Sehat Ayam Panggang Kunyit & Sayur Bening",
      desc: "Ayam panggang rempah nusantara rendah garam, tahu sutra organik kukus, nasi pulen lokal, sayur labu manis, dan jeruk nipis madu.",
      calories: 580,
      photo: "https://lh3.googleusercontent.com/aida-public/AB6AXuAwR5CVQiGD-H1fLUUponcAoEgYaN5aHuUlkSYx7VYibymErkMuxd4kpHCINI0yNwww28_Q20uaOh0k6QpFqdvgze341zsESFy56Wh7KKDq13nMkXC2fmc3f0kDvQKaCVaayI2ON_fnRnWIfuUo0Uq4TrCGbz9CKsnotxUVJNd0XPHiaWRAXyHcoK--j04X6sgwHcdFptTmLPtO5jB9ICGczB-XGXe7_7N-42Vddd89h3t6MQo4pX3P",
      sppg: {
        name: "SPPG Menteng 01 Sentral",
        address: "Jl. Teuku Umar No. 8, Menteng, Jakarta Pusat",
        radius: "Radius 2.4 km",
        dietitian: "dr. Rian Satria, Sp.GK",
        dietitianTitle: "Kepala Tim Dietisien BGN Wilayah Barat",
        lab: "BGN-JKT-2410-1042 (Negatif Cemaran Biologis)",
        temp: "68.2°C"
      }
    },
    "smpn-19-kby": {
      name: "SMPN 19 Kebayoran Baru",
      provinsi: "dki",
      provinsiName: "DKI Jakarta",
      kota: "jaksel",
      kotaName: "Jakarta Selatan",
      kecamatan: "Kebayoran Baru",
      jenjang: "smp",
      ageGroup: "Dipersiapkan untuk kelompok remaja awal SMP (13-15 tahun) dengan asupan protein ganda mendukung fase growth spurt.",
      arrival: "Telah Tiba di Sekolah (Pukul 10:15 WIB)",
      cycle: "Siklus Menu: Pekan ke-3 (Menu A-12)",
      packageName: "Paket Remaja Rolade Tuna Saus Tomat & Capcay Puyuh",
      desc: "Ikan tuna laut segar kaya omega-3, capcay sayur panen lokal, tahu tempe bacem, nasi pulen fortifikasi, dan susu murni Boyolali.",
      calories: 710,
      photo: "https://lh3.googleusercontent.com/aida-public/AB6AXuCkLbSHziTgMS4wjfXnmGJaa87bd_N3KasCcc2H4qhnJv0-x1bXQDvleyxCuK58099ZoZfRbhBN8WpUfixGsZsefv_a7MSmNJ3smRd3oXRskR5Vg7Nxz16LFyr9C-wrk8QimhpK8Y0YYqWL4eT4Hl9kHVFimf3FAjdcJfglmxj3dWfqWiVQN0QL-uaA1bRCAWeW3sSvk0sUJAEDLbARjtbg1VzCHnlLwoPl9Ghqvw8_OF7pN35D3hpA",
      sppg: {
        name: "SPPG Kebayoran Baru 02",
        address: "Jl. Bumi No. 21, Kebayoran Baru, Jakarta Selatan",
        radius: "Radius 2.1 km",
        dietitian: "Nurul Hidayati, S.Gz",
        dietitianTitle: "Dietisien Ahli Muda BGN",
        lab: "BGN-JKT-2410-0995 (Lolos Uji Sensoris & Kimia)",
        temp: "69.5°C"
      }
    },
    "sdn-sukajadi-03": {
      name: "SDN Sukajadi 03 Bandung",
      provinsi: "jabar",
      provinsiName: "Jawa Barat",
      kota: "kota-bandung",
      kotaName: "Kota Bandung",
      kecamatan: "Sukajadi",
      jenjang: "sd",
      ageGroup: "Dipersiapkan untuk murid SD (7-12 tahun) menggunakan serapan produk tani sayur Lembang segar.",
      arrival: "Telah Tiba di Sekolah (Pukul 09:40 WIB)",
      cycle: "Siklus Menu: Pekan ke-1 (Menu S-02)",
      packageName: "Paket Pasundan Semur Ayam Kampung & Oreg Tempe Lembang",
      desc: "Semur ayam kampung empuk kecap kelapa, oreg tempe manis gurih, sayur sop buncis wortel Lembang, pepaya potong, dan susu UHT.",
      calories: 610,
      photo: "https://lh3.googleusercontent.com/aida-public/AB6AXuAwR5CVQiGD-H1fLUUponcAoEgYaN5aHuUlkSYx7VYibymErkMuxd4kpHCINI0yNwww28_Q20uaOh0k6QpFqdvgze341zsESFy56Wh7KKDq13nMkXC2fmc3f0kDvQKaCVaayI2ON_fnRnWIfuUo0Uq4TrCGbz9CKsnotxUVJNd0XPHiaWRAXyHcoK--j04X6sgwHcdFptTmLPtO5jB9ICGczB-XGXe7_7N-42Vddd89h3t6MQo4pX3P",
      sppg: {
        name: "SPPG Sukajadi Bandung Sentral",
        address: "Jl. Sukajadi No. 188, Sukajadi, Kota Bandung",
        radius: "Radius 3.0 km",
        dietitian: "dr. Fitriani Lestari, M.Gizi",
        dietitianTitle: "Konsultan Gizi Klinis BGN Jawa Barat",
        lab: "BGN-JBR-2410-0431 (Bebas Pengawet Sintetis)",
        temp: "67.8°C"
      }
    },
    "smpn-3-sby": {
      name: "SMPN 3 Surabaya",
      provinsi: "jatim",
      provinsiName: "Jawa Timur",
      kota: "kota-surabaya",
      kotaName: "Kota Surabaya",
      kecamatan: "Genteng",
      jenjang: "smp",
      ageGroup: "Dipersiapkan untuk peserta didik SMP (13-15 tahun) dengan standar kuah rempah kaya kunyit alami.",
      arrival: "Telah Tiba di Sekolah (Pukul 10:00 WIB)",
      cycle: "Siklus Menu: Pekan ke-2 (Menu J-07)",
      packageName: "Paket Nusantara Soto Ayam Lamongan Bening & Perkedel",
      desc: "Soto ayam bumbu alami tanpa MSG buatan, tauge segar, telur rebus utuh omega-3, nasi putih pulen, dan semangka potong manis.",
      calories: 690,
      photo: "https://lh3.googleusercontent.com/aida-public/AB6AXuCkLbSHziTgMS4wjfXnmGJaa87bd_N3KasCcc2H4qhnJv0-x1bXQDvleyxCuK58099ZoZfRbhBN8WpUfixGsZsefv_a7MSmNJ3smRd3oXRskR5Vg7Nxz16LFyr9C-wrk8QimhpK8Y0YYqWL4eT4Hl9kHVFimf3FAjdcJfglmxj3dWfqWiVQN0QL-uaA1bRCAWeW3sSvk0sUJAEDLbARjtbg1VzCHnlLwoPl9Ghqvw8_OF7pN35D3hpA",
      sppg: {
        name: "SPPG Surabaya Rungkut Sentral",
        address: "Kawasan Industri SIER No. 12, Rungkut, Surabaya",
        radius: "Radius 4.1 km",
        dietitian: "Bambang Trianto, S.Gz, RD",
        dietitianTitle: "Dietisien Koordinator BGN Jatim",
        lab: "BGN-JTM-2410-0712 (Uji Mikrobiologi Negatif)",
        temp: "71.2°C"
      }
    },
    "smpn-1-smg": {
      name: "SMPN 1 Semarang",
      provinsi: "jateng",
      provinsiName: "Jawa Tengah",
      kota: "kota-semarang",
      kotaName: "Kota Semarang",
      kecamatan: "Semarang Tengah",
      jenjang: "smp",
      ageGroup: "Dipersiapkan untuk murid SMP (13-15 tahun) dengan pemanfaatan protein ikan bandeng bebas duri.",
      arrival: "Telah Tiba di Sekolah (Pukul 10:10 WIB)",
      cycle: "Siklus Menu: Pekan ke-3 (Menu T-11)",
      packageName: "Paket Pesisir Ikan Bandeng Bakar Madu & Oseng Buncis",
      desc: "Bandeng tanpa duri bumbu bakar madu lokal, tahu bacem, oseng buncis manis, nasi putih, dan pisang ambon segar.",
      calories: 720,
      photo: "https://lh3.googleusercontent.com/aida-public/AB6AXuAwR5CVQiGD-H1fLUUponcAoEgYaN5aHuUlkSYx7VYibymErkMuxd4kpHCINI0yNwww28_Q20uaOh0k6QpFqdvgze341zsESFy56Wh7KKDq13nMkXC2fmc3f0kDvQKaCVaayI2ON_fnRnWIfuUo0Uq4TrCGbz9CKsnotxUVJNd0XPHiaWRAXyHcoK--j04X6sgwHcdFptTmLPtO5jB9ICGczB-XGXe7_7N-42Vddd89h3t6MQo4pX3P",
      sppg: {
        name: "SPPG Semarang Tengah",
        address: "Jl. Pemuda No. 70, Semarang Tengah, Kota Semarang",
        radius: "Radius 2.8 km",
        dietitian: "dr. Agus Wijaya, Sp.GK",
        dietitianTitle: "Dietisien Spesialis Gizi Klinis BGN",
        lab: "BGN-JTG-2410-0899 (Negatif Formalin & Boraks)",
        temp: "68.5°C"
      }
    },
    "sman-70-jkt": {
      name: "SMAN 70 Jakarta",
      provinsi: "dki",
      provinsiName: "DKI Jakarta",
      kota: "jaksel",
      kotaName: "Jakarta Selatan",
      kecamatan: "Kebayoran Baru",
      jenjang: "sma",
      ageGroup: "Dipersiapkan untuk siswa tingkat SMA (16-18 tahun) dengan target energi 760 kkal untuk menunjang aktivitas padat.",
      arrival: "Telah Tiba di Sekolah (Pukul 10:30 WIB)",
      cycle: "Siklus Menu: Pekan ke-4 (Menu SMA-05)",
      packageName: "Paket Nutrisi Atlet Muda Ayam Suwir Rica Manis & Telur Puyuh",
      desc: "Ayam suwir kaya protein tanpa kulit, telur puyuh omega, jamur kuping tinggi serat, nasi pulen fortifikasi, dan buah melon potong.",
      calories: 760,
      photo: "https://lh3.googleusercontent.com/aida-public/AB6AXuCkLbSHziTgMS4wjfXnmGJaa87bd_N3KasCcc2H4qhnJv0-x1bXQDvleyxCuK58099ZoZfRbhBN8WpUfixGsZsefv_a7MSmNJ3smRd3oXRskR5Vg7Nxz16LFyr9C-wrk8QimhpK8Y0YYqWL4eT4Hl9kHVFimf3FAjdcJfglmxj3dWfqWiVQN0QL-uaA1bRCAWeW3sSvk0sUJAEDLbARjtbg1VzCHnlLwoPl9Ghqvw8_OF7pN35D3hpA",
      sppg: {
        name: "Dapur Sentral Kebayoran Baru 03",
        address: "Jl. Kyai Maja No. 14, Kebayoran Baru, Jakarta Selatan",
        radius: "Radius 1.5 km",
        dietitian: "dr. Andini Saraswati, Sp.GK",
        dietitianTitle: "Dietisien Verifikator BGN",
        lab: "BGN-JKT-2410-0988 (Hot Chain Verified)",
        temp: "69.0°C"
      }
    }
  };

  // Region hierarchy data
  const regionCascade = {
    "dki": {
      name: "DKI Jakarta",
      cities: [
        { id: "jaksel", name: "Jakarta Selatan" },
        { id: "jakpus", name: "Jakarta Pusat" },
        { id: "jaktim", name: "Jakarta Timur" },
        { id: "jakbar", name: "Jakarta Barat" }
      ]
    },
    "jabar": {
      name: "Jawa Barat",
      cities: [
        { id: "kota-bandung", name: "Kota Bandung" },
        { id: "kota-bogor", name: "Kota Bogor" },
        { id: "kota-bekasi", name: "Kota Bekasi" }
      ]
    },
    "jatim": {
      name: "Jawa Timur",
      cities: [
        { id: "kota-surabaya", name: "Kota Surabaya" },
        { id: "kota-malang", name: "Kota Malang" }
      ]
    },
    "jateng": {
      name: "Jawa Tengah",
      cities: [
        { id: "kota-semarang", name: "Kota Semarang" },
        { id: "kota-surakarta", name: "Kota Surakarta" }
      ]
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const filterProv = document.getElementById('filterProvinsi');
    const filterKota = document.getElementById('filterKota');
    const filterJenjang = document.getElementById('filterJenjang');
    const schoolSelect = document.getElementById('schoolSelect');
    const schoolStatusTag = document.getElementById('schoolStatusTag');

    const promptState = document.getElementById('menuSelectionPrompt');
    const detailWrapper = document.getElementById('menuDetailWrapper');

    const routeProv = document.getElementById('routeProvinsi');
    const routeKota = document.getElementById('routeKota');
    const routeSchool = document.getElementById('breadcrumbSchool');

    const btnApply = document.getElementById('btnApplyFilter');
    const btnReset = document.getElementById('btnResetFilter');
    const btnChangeTop = document.getElementById('btnChangeSchoolTop');

    // Populate Kota based on Provinsi
    function updateKotaOptions(provVal) {
      filterKota.innerHTML = '<option value="">-- Pilih Kota / Kab --</option>';
      if (provVal && regionCascade[provVal]) {
        regionCascade[provVal].cities.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = c.name;
          filterKota.appendChild(opt);
        });
      }
      updateSchoolOptions();
    }

    // Populate Schools based on Prov, Kota, Jenjang
    function updateSchoolOptions() {
      schoolSelect.innerHTML = '<option value="">-- Pilih Satuan Pendidikan --</option>';
      const provVal = filterProv.value;
      const kotaVal = filterKota.value;
      const jenjangVal = filterJenjang ? filterJenjang.value : '';

      let count = 0;
      Object.keys(schoolDb).forEach(key => {
        const item = schoolDb[key];
        const matchProv = !provVal || item.provinsi === provVal;
        const matchKota = !kotaVal || item.kota === kotaVal;
        const matchJenjang = !jenjangVal || item.jenjang === jenjangVal;

        if (matchProv && matchKota && matchJenjang) {
          const opt = document.createElement('option');
          opt.value = key;
          opt.textContent = item.name + ' (' + item.kotaName + ')';
          schoolSelect.appendChild(opt);
          count++;
        }
      });

      if (schoolStatusTag) {
        if (!provVal) {
          schoolStatusTag.textContent = 'Pilih Wilayah Dulu';
          schoolStatusTag.className = 'text-label-sm text-on-surface-variant font-semibold';
        } else {
          schoolStatusTag.textContent = count + ' Sekolah Tersedia';
          schoolStatusTag.className = 'text-label-sm text-status-success font-semibold';
        }
      }
    }

    if (filterProv) {
      filterProv.addEventListener('change', () => {
        updateKotaOptions(filterProv.value);
        if (routeProv) routeProv.textContent = filterProv.value ? regionCascade[filterProv.value].name : 'Belum Memilih';
        if (routeKota) routeKota.textContent = '-';
        if (routeSchool) routeSchool.textContent = '-';
      });
    }

    if (filterKota) {
      filterKota.addEventListener('change', () => {
        updateSchoolOptions();
        if (routeKota) {
          const text = filterKota.options[filterKota.selectedIndex]?.text || '-';
          routeKota.textContent = filterKota.value ? text : '-';
        }
      });
    }

    if (filterJenjang) {
      filterJenjang.addEventListener('change', () => {
        updateSchoolOptions();
      });
    }

    // Render School Details
    function renderSchool(schoolKey) {
      const data = schoolDb[schoolKey];
      if (!data) return;

      // Set dropdowns
      if (filterProv) filterProv.value = data.provinsi;
      updateKotaOptions(data.provinsi);
      if (filterKota) filterKota.value = data.kota;
      updateSchoolOptions();
      if (schoolSelect) schoolSelect.value = schoolKey;

      // Breadcrumb
      if (routeProv) routeProv.textContent = data.provinsiName;
      if (routeKota) routeKota.textContent = data.kotaName;
      if (routeSchool) routeSchool.textContent = data.name;

      // Badges & Titles
      const arrivalText = document.getElementById('arrivalBadgeText');
      if (arrivalText) arrivalText.textContent = data.arrival;

      const pkgTitle = document.getElementById('packageTitle');
      if (pkgTitle) pkgTitle.textContent = 'Paket Menu Siswa: ' + data.name + ' (' + data.kotaName + ')';

      const pkgAge = document.getElementById('packageAgeGroup');
      if (pkgAge) pkgAge.textContent = data.ageGroup;

      const calDisplay = document.getElementById('totalCaloriesDisplay');
      if (calDisplay) calDisplay.textContent = data.calories;

      const heroTitle = document.getElementById('heroDishTitle');
      if (heroTitle) heroTitle.textContent = data.packageName;

      // SPPG Info
      const sppgName = document.getElementById('sppgNameDisplay');
      if (sppgName) sppgName.textContent = data.sppg.name;

      const sppgAddr = document.getElementById('sppgAddressDisplay');
      if (sppgAddr) sppgAddr.textContent = data.sppg.address;

      const sppgDoc = document.getElementById('sppgDietitianDisplay');
      if (sppgDoc) sppgDoc.textContent = data.sppg.dietitian;

      // Toggle View State
      if (promptState) promptState.classList.add('hidden');
      if (detailWrapper) {
        detailWrapper.classList.remove('hidden');
        detailWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    // Reset to selection prompt
    function resetToSelection() {
      if (filterProv) filterProv.value = '';
      if (filterKota) filterKota.innerHTML = '<option value="">-- Pilih Kota / Kab --</option>';
      if (filterJenjang) filterJenjang.value = '';
      if (schoolSelect) schoolSelect.innerHTML = '<option value="">-- Pilih Satuan Pendidikan --</option>';
      if (schoolStatusTag) {
        schoolStatusTag.textContent = 'Pilih Wilayah Dulu';
        schoolStatusTag.className = 'text-label-sm text-on-surface-variant font-semibold';
      }

      if (routeProv) routeProv.textContent = 'Belum Memilih';
      if (routeKota) routeKota.textContent = '-';
      if (routeSchool) routeSchool.textContent = '-';

      if (detailWrapper) detailWrapper.classList.add('hidden');
      if (promptState) promptState.classList.remove('hidden');

      window.scrollTo({ top: 180, behavior: 'smooth' });
    }

    if (btnReset) btnReset.addEventListener('click', resetToSelection);
    if (btnChangeTop) btnChangeTop.addEventListener('click', resetToSelection);

    // Apply Filter button
    if (btnApply) {
      btnApply.addEventListener('click', () => {
        const selected = schoolSelect ? schoolSelect.value : '';
        if (selected && schoolDb[selected]) {
          renderSchool(selected);
        } else {
          alert('Silakan pilih salah satu Satuan Pendidikan (Sekolah) pada dropdown di atas terlebih dahulu.');
        }
      });
    }

    if (schoolSelect) {
      schoolSelect.addEventListener('change', () => {
        if (schoolSelect.value) {
          renderSchool(schoolSelect.value);
        }
      });
    }

    // Quick pick pill buttons
    const quickBtns = document.querySelectorAll('.quick-school-btn');
    quickBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const sKey = btn.getAttribute('data-school');
        if (sKey) renderSchool(sKey);
      });
    });

    // Check URL Param (?q= or ?school=)
    const urlParams = new URLSearchParams(window.location.search);
    const qParam = urlParams.get('q') || urlParams.get('school');
    if (qParam) {
      // Find matching key
      const qLower = qParam.toLowerCase();
      let matchedKey = null;
      Object.keys(schoolDb).forEach(k => {
        if (schoolDb[k].name.toLowerCase().includes(qLower) || k.includes(qLower)) {
          matchedKey = k;
        }
      });
      if (matchedKey) {
        renderSchool(matchedKey);
      } else {
        // Default to senayan if query not matched
        renderSchool('sdn-01-senayan');
      }
    }
  });
</script>
HTML;

$sourceMenu = str_replace('</body>', $completeMenuScript . "\n</body>", $sourceMenu);

file_put_contents(__DIR__ . '/menu-hari-ini.html', $sourceMenu);
echo "menu-hari-ini.html written successfully.\n";

// 3. BUILD distribusi-sebaran-sppg.html
$sourceDist = file_get_contents(__DIR__ . '/stitch_radar_mbg_redesign/stitch_radar_mbg_redesign/distribusi_sebaran_sppg_radar_mbg/code.html');
$sourceDist = injectFaviconAndMeta($sourceDist, 'Distribusi & Sebaran SPPG Nasional - Radar MBG BGN');
$sourceDist = preg_replace('/<header[\s\S]*?<\/header>/', getHeader('distribusi'), $sourceDist);
$sourceDist = preg_replace('/<footer[\s\S]*?<\/footer>[\s\S]*?<\/body>/', getFooter() . "\n</body>", $sourceDist);
file_put_contents(__DIR__ . '/distribusi-sebaran-sppg.html', $sourceDist);
echo "distribusi-sebaran-sppg.html written successfully.\n";

// 4. BUILD standar-uji-akg.html
$sourceAkg = file_get_contents(__DIR__ . '/stitch_radar_mbg_redesign/stitch_radar_mbg_redesign/standar_uji_akg_radar_mbg/code.html');
$sourceAkg = injectFaviconAndMeta($sourceAkg, 'Standar AKG & Uji Mutu Laboratorium - Radar MBG BGN');
$sourceAkg = preg_replace('/<header[\s\S]*?<\/header>/', getHeader('standar'), $sourceAkg);
$sourceAkg = preg_replace('/<footer[\s\S]*?<\/footer>[\s\S]*?<\/body>/', getFooter() . "\n</body>", $sourceAkg);

// Update "Kirim Laporan Cepat" link to laporan-aduan.html
$sourceAkg = preg_replace(
    '/<a class="[^"]*bg-status-success[^"]*" href="#">\s*<span class="material-symbols-outlined text-\[16px\]">campaign<\/span>\s*<span>Kirim Laporan Cepat<\/span>\s*<\/a>/',
    '<a class="w-full sm:w-auto px-4 py-2 rounded-xl bg-status-success text-on-primary hover:opacity-90 font-label-md text-label-md transition-opacity text-center flex items-center justify-center gap-1.5 shadow-sm" href="laporan-aduan.html"><span class="material-symbols-outlined text-[16px]">campaign</span><span>Kirim Laporan Cepat</span></a>',
    $sourceAkg
);

file_put_contents(__DIR__ . '/standar-uji-akg.html', $sourceAkg);
echo "standar-uji-akg.html written successfully.\n";

// 5. BUILD laporan-aduan.html
$aduanContent = <<<HTML
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8"/>
  <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
  <title>Laporan & Aduan Publik MBG - Badan Gizi Nasional</title>
  <link rel="icon" type="image/webp" href="logo.webp"/>
  <link rel="apple-touch-icon" href="logo.webp"/>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet"/>
  <style>@layer base{html,body{margin:0;padding:0;}body{overscroll-behavior:none;}}::-webkit-scrollbar{display:none;}</style>
  <script src="https://cdn.tailwindcss.com"></script>
  <script id="tailwind-config">tailwind.config = { darkMode: "class", theme: { extend: { "colors": { "background": "#f8f9ff", "on-tertiary-fixed-variant": "#005236", "surface": "#f8f9ff", "surface-container-lowest": "#ffffff", "surface-container": "#e5eeff", "border-subtle": "#E2E8F0", "on-error": "#ffffff", "primary": "#001026", "on-primary-container": "#778db2", "tertiary-fixed": "#6ffbbe", "tertiary-container": "#002b1b", "on-secondary": "#ffffff", "on-primary-fixed": "#001c3b", "on-error-container": "#93000a", "inverse-on-surface": "#eaf1ff", "border-focus": "#134074", "status-error": "#EF4444", "surface-container-low": "#eff4ff", "on-tertiary-container": "#009f6e", "secondary-fixed": "#d5e3ff", "inverse-surface": "#213145", "inverse-primary": "#b1c7f0", "on-tertiary-fixed": "#002113", "on-secondary-fixed": "#001c3b", "surface-tint": "#495f82", "outline-variant": "#c4c6cf", "on-primary": "#ffffff", "secondary-fixed-dim": "#a7c8ff", "on-background": "#0b1c30", "status-success": "#059669", "tertiary": "#00130a", "surface-card": "#FFFFFF", "surface-canvas": "#F8FAFC", "surface-variant": "#d3e4fe", "on-primary-fixed-variant": "#314769", "primary-fixed-dim": "#b1c7f0", "surface-container-high": "#dce9ff", "outline": "#74777f", "on-secondary-container": "#274f84", "on-surface": "#0b1c30", "error-container": "#ffdad6", "surface-dim": "#cbdbf5", "tertiary-fixed-dim": "#4edea3", "surface-bright": "#f8f9ff", "on-surface-variant": "#44474e", "surface-container-highest": "#d3e4fe", "on-secondary-fixed-variant": "#1d477c", "status-warning": "#F59E0B", "secondary-container": "#9dc3ff", "primary-container": "#0b2545", "secondary": "#395f95", "on-tertiary": "#ffffff", "error": "#ba1a1a", "primary-fixed": "#d5e3ff" }, "borderRadius": { "DEFAULT": "0.25rem", "lg": "0.5rem", "xl": "0.75rem", "full": "9999px" }, "spacing": { "space-md": "1rem", "margin": "2rem", "space-xl": "2.5rem", "space-xs": "0.25rem", "space-lg": "1.5rem", "gutter-sm": "1rem", "gutter": "1.5rem", "margin-sm": "1rem", "space-sm": "0.5rem" }, "fontFamily": { "headline-xl-mobile": ["Plus Jakarta Sans"], "headline-sm": ["Plus Jakarta Sans"], "label-lg": ["Plus Jakarta Sans"], "headline-lg": ["Plus Jakarta Sans"], "headline-md": ["Plus Jakarta Sans"], "body-md": ["Plus Jakarta Sans"], "headline-xl": ["Plus Jakarta Sans"], "body-lg": ["Plus Jakarta Sans"], "body-sm": ["Plus Jakarta Sans"], "label-md": ["Plus Jakarta Sans"], "label-sm": ["Plus Jakarta Sans"] } } } };</script>
</head>
<body class="bg-surface font-body-md text-on-surface antialiased selection:bg-secondary-container selection:text-on-secondary-container">
__HEADER__
<main class="w-full pt-20 bg-surface min-h-[calc(100vh-20rem)]">
  <div class="flex flex-col w-full">
    <!-- Hero Banner -->
    <section class="w-full bg-primary text-on-primary py-space-xl px-space-md sm:px-space-lg relative overflow-hidden">
      <div class="max-w-7xl mx-auto flex flex-col gap-space-md relative z-10">
        <div class="flex items-center gap-space-xs">
          <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-lowest/10 backdrop-blur-md">
            <span class="w-2.5 h-2.5 rounded-full bg-tertiary-fixed animate-ping"></span>
            <span class="font-label-sm text-label-sm text-surface-container-high tracking-wider uppercase">Layanan Aduan Siaga 24 Jam</span>
          </span>
          <span class="font-label-sm text-label-sm text-surface-container-high">• Respons Satgas &lt; 120 Menit</span>
        </div>
        <h1 class="font-headline-xl text-headline-xl sm:text-[36px] font-bold tracking-tight">
          Pusat Pengaduan &amp; Aduan Partisipatif MBG Nasional
        </h1>
        <p class="font-body-lg text-body-lg text-surface-container-high/90 max-w-3xl leading-relaxed">
          Saluran pengawasan publik resmi Badan Gizi Nasional (BGN). Laporkan segala bentuk ketidaksesuaian menu, keterlambatan distribusi, kualitas cita rasa, maupun kecurigaan pelanggaran sanitasi SPPG. Identitas pelapor dilindungi penuh.
        </p>
      </div>
    </section>

    <!-- Content Section -->
    <section class="w-full px-space-md sm:px-space-lg py-space-xl max-w-7xl mx-auto">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
        <!-- Form Aduan (7 Cols) -->
        <div class="lg:col-span-7 bg-surface-card p-space-lg sm:p-space-xl rounded-3xl shadow-sm border border-border-subtle flex flex-col gap-space-md">
          <div class="flex items-center justify-between pb-space-sm border-b border-border-subtle">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-primary-container text-tertiary-fixed flex items-center justify-center">
                <span class="material-symbols-outlined text-[24px]">edit_note</span>
              </div>
              <div>
                <h2 class="font-headline-md text-headline-md text-primary font-bold">Formulir Laporan Baru</h2>
                <p class="font-body-sm text-body-sm text-on-surface-variant">Lengkapi data agar tim verifikator satgas segera menindaklanjuti.</p>
              </div>
            </div>
            <span class="px-2.5 py-1 rounded-full bg-surface-container text-secondary font-label-sm text-label-sm font-semibold">Tersandikan SSL</span>
          </div>

          <form id="complaintForm" class="flex flex-col gap-space-md">
            <!-- 1. Kategori Pelapor -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
              <div class="flex flex-col gap-1.5">
                <label class="font-label-md text-label-md text-primary font-semibold">Nama Lengkap / Inisial</label>
                <input required id="reporterName" class="px-3.5 py-2.5 rounded-xl bg-surface-container-low text-on-surface border border-border-subtle focus:ring-2 focus:ring-border-focus focus:outline-none" placeholder="Contoh: Budi Santoso (Bisa Inisial)" type="text"/>
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="font-label-md text-label-md text-primary font-semibold">Nomor WhatsApp Aktif</label>
                <input required id="reporterPhone" class="px-3.5 py-2.5 rounded-xl bg-surface-container-low text-on-surface border border-border-subtle focus:ring-2 focus:ring-border-focus focus:outline-none" placeholder="08xxxxxxxxxx (Untuk kirim status)" type="tel"/>
              </div>
            </div>

            <!-- 2. Peran & Kategori Aduan -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
              <div class="flex flex-col gap-1.5">
                <label class="font-label-md text-label-md text-primary font-semibold">Status / Peran Pelapor</label>
                <select id="reporterRole" class="px-3.5 py-2.5 rounded-xl bg-surface-container-low text-on-surface border border-border-subtle focus:ring-2 focus:ring-border-focus focus:outline-none">
                  <option value="wali">Orang Tua / Wali Murid</option>
                  <option value="guru">Guru / Tenaga Pendidik</option>
                  <option value="komite">Komite Sekolah</option>
                  <option value="siswa">Peserta Didik</option>
                  <option value="masyarakat">Masyarakat Umum / Media</option>
                </select>
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="font-label-md text-label-md text-primary font-semibold">Kategori Permasalahan</label>
                <select id="issueCategory" class="px-3.5 py-2.5 rounded-xl bg-surface-container-low text-on-surface border border-border-subtle focus:ring-2 focus:ring-border-focus focus:outline-none">
                  <option value="waktu">Keterlambatan Jam Pengantaran (&gt;30 mnt)</option>
                  <option value="menu">Ketidaksesuaian Menu / Porsi Kurang</option>
                  <option value="suhu">Makanan Dingin / Rantai Termal Rusak (&lt;60°C)</option>
                  <option value="higienitas">Higienitas Makanan / Kemasan Rusak</option>
                  <option value="alergen">Insiden Alergi Siswa / Keamanan Pangan</option>
                  <option value="lainnya">Lainnya</option>
                </select>
              </div>
            </div>

            <!-- 3. Sekolah & Tanggal -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
              <div class="flex flex-col gap-1.5">
                <label class="font-label-md text-label-md text-primary font-semibold">Nama Sekolah / Lembaga</label>
                <input required id="schoolTarget" class="px-3.5 py-2.5 rounded-xl bg-surface-container-low text-on-surface border border-border-subtle focus:ring-2 focus:ring-border-focus focus:outline-none" placeholder="Misal: SDN 01 Senayan Jakarta" type="text"/>
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="font-label-md text-label-md text-primary font-semibold">Tanggal Kejadian</label>
                <input required id="incidentDate" class="px-3.5 py-2.5 rounded-xl bg-surface-container-low text-on-surface border border-border-subtle focus:ring-2 focus:ring-border-focus focus:outline-none" type="date"/>
              </div>
            </div>

            <!-- 4. Deskripsi Laporan -->
            <div class="flex flex-col gap-1.5">
              <label class="font-label-md text-label-md text-primary font-semibold">Deskripsi Rinci Laporan</label>
              <textarea required id="reportDescription" rows="4" class="px-3.5 py-2.5 rounded-xl bg-surface-container-low text-on-surface border border-border-subtle focus:ring-2 focus:ring-border-focus focus:outline-none" placeholder="Ceritakan kronologi, kondisi sajian, atau foto bukti nomor batch wadah..."></textarea>
            </div>

            <!-- 5. Upload File / Foto -->
            <div class="p-space-md rounded-2xl bg-surface-container-low border-2 border-dashed border-border-subtle flex flex-col items-center justify-center text-center gap-2 cursor-pointer hover:bg-surface-container transition-colors" id="uploadDropzone">
              <span class="material-symbols-outlined text-[32px] text-secondary">add_a_photo</span>
              <div class="flex flex-col">
                <span class="font-label-md text-label-md text-primary font-semibold">Unggah Foto Makanan / Label Wadah SPPG</span>
                <span class="font-body-sm text-body-sm text-on-surface-variant">Format JPG, PNG, atau WEBP (Maksimal 10 MB)</span>
              </div>
              <input type="file" id="photoInput" class="hidden" accept="image/*"/>
              <span id="fileChosenLabel" class="text-xs text-status-success font-semibold hidden"></span>
            </div>

            <button type="submit" class="w-full py-3.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg font-bold shadow-md transition-all flex items-center justify-center gap-2 mt-2">
              <span class="material-symbols-outlined text-[20px]">send</span>
              <span>Kirimkan Aduan Resmi ke Satgas BGN</span>
            </button>
          </form>
        </div>

        <!-- Sidebar Bantuan & Saluran Alternatif (5 Cols) -->
        <div class="lg:col-span-5 flex flex-col gap-space-lg">
          <!-- WhatsApp Card -->
          <div class="bg-surface-card p-space-lg rounded-3xl shadow-sm border border-border-subtle flex flex-col gap-space-md">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-status-success/15 text-status-success flex items-center justify-center">
                <span class="material-symbols-outlined text-[24px]">chat</span>
              </div>
              <div>
                <h3 class="font-headline-sm text-headline-sm text-primary font-bold">WhatsApp Hotline Siaga</h3>
                <span class="font-body-sm text-body-sm text-on-surface-variant">Layanan pengaduan cepat via pesan instan</span>
              </div>
            </div>
            <p class="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              Kirimkan foto langsung ke operator siaga BGN melalui WhatsApp resmi bercentang hijau untuk verifikasi instan.
            </p>
            <a href="https://wa.me/6281190000888?text=Halo%20Satgas%20MBG,%20saya%20ingin%20melaporkan%20terkait%20program%20MBG" target="_blank" class="py-3 px-4 rounded-xl bg-status-success hover:bg-status-success/90 text-on-secondary font-label-md text-label-md font-semibold transition-all flex items-center justify-center gap-2 shadow-sm">
              <span class="material-symbols-outlined text-[20px]">chat</span>
              <span>Chat WhatsApp: 0811-9000-0888</span>
            </a>
          </div>

          <!-- Hotline Call Card -->
          <div class="bg-surface-card p-space-lg rounded-3xl shadow-sm border border-border-subtle flex flex-col gap-space-md">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center">
                <span class="material-symbols-outlined text-[24px]">call</span>
              </div>
              <div>
                <h3 class="font-headline-sm text-headline-sm text-primary font-bold">Call Center Bebas Pulsa</h3>
                <span class="font-body-sm text-body-sm text-on-surface-variant">Halo MBG Indonesia</span>
              </div>
            </div>
            <div class="p-4 rounded-2xl bg-surface-container-low flex items-center justify-between">
              <div class="flex flex-col">
                <span class="text-headline-md font-bold text-primary">150-098</span>
                <span class="text-xs text-on-surface-variant">Senin - Minggu: 06.00 - 20.00 WIB</span>
              </div>
              <span class="material-symbols-outlined text-secondary text-[28px]">headset_mic</span>
            </div>
          </div>

          <!-- Alur Penanganan -->
          <div class="bg-surface-container-low p-space-lg rounded-3xl border border-border-subtle flex flex-col gap-space-sm">
            <h4 class="font-label-lg text-label-lg text-primary font-bold flex items-center gap-2">
              <span class="material-symbols-outlined text-secondary text-[20px]">timeline</span>
              Alur Penanganan Laporan Satgas
            </h4>
            <div class="flex flex-col gap-3 pt-2">
              <div class="flex items-start gap-3">
                <span class="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center text-xs font-bold shrink-0">1</span>
                <p class="font-body-sm text-body-sm text-on-surface-variant"><strong>Verifikasi Awal (&lt;15 mnt):</strong> Sistem memvalidasi identitas sekolah dan SPPG penyedia yang bertugas.</p>
              </div>
              <div class="flex items-start gap-3">
                <span class="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center text-xs font-bold shrink-0">2</span>
                <p class="font-body-sm text-body-sm text-on-surface-variant"><strong>Inspeksi Lapangan:</strong> Tim pengawas BGN daerah menghubungi komite sekolah dan mengirim satgas jika terindikasi pelanggaran berat.</p>
              </div>
              <div class="flex items-start gap-3">
                <span class="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center text-xs font-bold shrink-0">3</span>
                <p class="font-body-sm text-body-sm text-on-surface-variant"><strong>Solusi &amp; Penggantian:</strong> SPPG wajib mengganti porsi yang rusak atau menerima surat peringatan evaluasi kemitraan.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</main>

<!-- Ticket Modal -->
<div id="ticketModal" class="fixed inset-0 z-50 bg-primary/70 backdrop-blur-md hidden items-center justify-center p-space-md">
  <div class="w-full max-w-md bg-surface-card rounded-3xl p-space-lg shadow-2xl flex flex-col gap-space-md text-center">
    <div class="w-16 h-16 rounded-2xl bg-tertiary-container text-tertiary-fixed flex items-center justify-center mx-auto">
      <span class="material-symbols-outlined text-[36px]">check_circle</span>
    </div>
    <div>
      <h3 class="font-headline-md text-headline-md text-primary font-bold">Laporan Berhasil Terkirim!</h3>
      <p class="font-body-sm text-body-sm text-on-surface-variant mt-1">Laporan Anda telah masuk ke Sistem Antrean Siaga Satgas BGN RI.</p>
    </div>
    <div class="p-space-md rounded-2xl bg-surface-container-low flex flex-col gap-1 text-left">
      <span class="text-xs text-on-surface-variant font-medium">Nomor Tiket Aduan:</span>
      <span id="ticketNumberDisplay" class="font-headline-sm font-bold text-primary font-mono">TKT-BGN-20261013-8821</span>
      <span class="text-xs text-status-success font-semibold mt-1">Estimasi Respon Pertama: &lt; 45 Menit</span>
    </div>
    <button id="btnCloseTicketModal" class="w-full py-3 rounded-xl bg-primary text-on-primary font-label-md font-semibold hover:bg-primary-container transition-colors">
      Selesai &amp; Kembali
    </button>
  </div>
</div>

<script>
  document.addEventListener('DOMContentLoaded', () => {
    // Set default incident date to today
    const dateInput = document.getElementById('incidentDate');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    // Dropzone upload simulation
    const dropzone = document.getElementById('uploadDropzone');
    const photoInput = document.getElementById('photoInput');
    const fileLabel = document.getElementById('fileChosenLabel');

    if (dropzone && photoInput) {
      dropzone.addEventListener('click', () => photoInput.click());
      photoInput.addEventListener('change', () => {
        if (photoInput.files.length > 0) {
          fileLabel.innerText = 'Foto terpilih: ' + photoInput.files[0].name;
          fileLabel.classList.remove('hidden');
        }
      });
    }

    // Form submit
    const form = document.getElementById('complaintForm');
    const modal = document.getElementById('ticketModal');
    const btnClose = document.getElementById('btnCloseTicketModal');
    const ticketDisplay = document.getElementById('ticketNumberDisplay');

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const randId = Math.floor(1000 + Math.random() * 9000);
        const now = new Date();
        const dateStr = now.getFullYear() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0');
        const ticketCode = 'TKT-BGN-' + dateStr + '-' + randId;
        
        ticketDisplay.innerText = ticketCode;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        form.reset();
        if (fileLabel) fileLabel.classList.add('hidden');
      });
    }

    if (btnClose && modal) {
      btnClose.addEventListener('click', () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
      });
    }
  });
</script>
__FOOTER__
</body>
</html>
HTML;

$aduanContent = str_replace('__HEADER__', getHeader('aduan'), $aduanContent);
$aduanContent = str_replace('__FOOTER__', getFooter(), $aduanContent);
file_put_contents(__DIR__ . '/laporan-aduan.html', $aduanContent);
echo "laporan-aduan.html written successfully.\n";

echo "ALL PAGES BUILT SUCCESSFULLY!\n";
?>
