(function () {
  var script = document.currentScript;
  var footerHost = document.querySelector('[data-site-footer]');

  if (!script || !footerHost) {
    console.error('Footer Radar MBG tidak dapat dipasang: elemen atau skrip footer tidak ditemukan.');
    return;
  }

  var rootUrl = new URL('../../', script.src).href;
  var footerHtml = `
<footer class="site-footer w-full mt-space-xl">
  <div class="sf-wrap">

    <div class="sf-cta">
      <div class="sf-cta-copy">
        <span class="sf-cta-eyebrow">TRANSPARANSI PUBLIK</span>
        <h2 class="sf-cta-title">Saksikan langsung pantauan MBG di wilayah Anda</h2>
        <p class="sf-cta-text">Laporkan kendala distribusi, verifikasi gizi, atau tanyakan status SPPG melalui portal aduan resmi.</p>
      </div>
      <a class="sf-cta-btn" href="${rootUrl}fitur/laporan-aduan.html">
        <span class="material-symbols-outlined" aria-hidden="true">campaign</span>
        Buat Laporan
      </a>
    </div>

    <div class="sf-grid">
      <div class="sf-col sf-brand">
        <div class="sf-brand-head">
          <img src="${rootUrl}assets/images/ic_launcher.png" alt="Logo Badan Gizi Nasional" class="sf-logo"/>
          <div>
            <strong class="sf-brand-name">Badan Gizi Nasional</strong>
            <span class="sf-brand-sub">Radar MBG Nasional</span>
          </div>
        </div>
        <p class="sf-desc">
          Lembaga Pemerintah yang bertanggung jawab atas pengelolaan, pemenuhan gizi berkualitas, dan program Makan Bergizi Gratis (MBG) bagi generasi emas Indonesia.
        </p>
        <div class="sf-badges">
          <span class="sf-badge"><span class="material-symbols-outlined" aria-hidden="true">verified</span>Portal Resmi</span>
          <span class="sf-badge"><span class="material-symbols-outlined" aria-hidden="true">public</span>Keterbukaan Info</span>
        </div>
      </div>

      <div class="sf-col">
        <h3 class="sf-heading"><span class="material-symbols-outlined" aria-hidden="true">support_agent</span>Layanan Aduan</h3>
        <ul class="sf-links">
          <li>
            <a class="sf-link" href="https://wa.me/6281110008008" target="_blank" rel="noopener noreferrer">
              <span class="material-symbols-outlined" aria-hidden="true">call</span>
              <span><strong>Halo MBG RI</strong><small>+62 811-1000-8008</small></span>
            </a>
          </li>
          <li>
            <a class="sf-link" href="mailto:halo@bgn.go.id">
              <span class="material-symbols-outlined" aria-hidden="true">mail</span>
              <span><strong>Surat Elektronik</strong><small>halo@bgn.go.id</small></span>
            </a>
          </li>
          <li>
            <span class="sf-link sf-static">
              <span class="material-symbols-outlined" aria-hidden="true">schedule</span>
              <span><strong>Jam Layanan</strong><small>Senin–Minggu · 06.00–20.00 WIB</small></span>
            </span>
          </li>
        </ul>
      </div>

      <div class="sf-col">
        <h3 class="sf-heading"><span class="material-symbols-outlined" aria-hidden="true">explore</span>Portal &amp; Modul</h3>
        <ul class="sf-links">
          <li><a class="sf-link sf-simple" href="${rootUrl}index.html"><span class="material-symbols-outlined" aria-hidden="true">monitoring</span>Monitoring Nasional</a></li>
          <li><a class="sf-link sf-simple" href="${rootUrl}tim-kelompok.html"><span class="material-symbols-outlined" aria-hidden="true">groups</span>Tim Kelompok</a></li>
          <li><a class="sf-link sf-simple" href="${rootUrl}fitur/menu-hari-ini.html"><span class="material-symbols-outlined" aria-hidden="true">restaurant_menu</span>Menu Hari Ini &amp; AKG</a></li>
          <li><a class="sf-link sf-simple" href="${rootUrl}fitur/distribusi-sebaran-sppg.html"><span class="material-symbols-outlined" aria-hidden="true">map</span>Distribusi &amp; SPPG</a></li>
          <li><a class="sf-link sf-simple" href="${rootUrl}fitur/standar-uji-akg.html"><span class="material-symbols-outlined" aria-hidden="true">science</span>Standar AKG</a></li>
          <li><a class="sf-link sf-simple" href="${rootUrl}fitur/laporan-aduan.html"><span class="material-symbols-outlined" aria-hidden="true">receipt_long</span>Aduan Publik</a></li>
        </ul>
      </div>

      <div class="sf-col">
        <h3 class="sf-heading"><span class="material-symbols-outlined" aria-hidden="true">verified_user</span>Transparansi</h3>
        <div class="sf-card">
          <strong>Audit Publik Mandiri</strong>
          <p>Masyarakat berhak memantau komposisi nutrisi, asal suplai pangan lokal, dan verifikasi Satuan Pelayanan Pemenuhan Gizi (SPPG).</p>
          <a class="sf-card-link" href="${rootUrl}fitur/laporan-aduan.html">
            Buka Form Aduan <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
          </a>
        </div>
      </div>
    </div>

    <div class="sf-bottom">
      <div class="sf-copy">
        <span>© 2026 Badan Gizi Nasional Republik Indonesia</span>
        <span class="sf-dot">•</span>
        <span>Hak Cipta Dilindungi Undang-Undang</span>
      </div>
      <nav class="sf-legal" aria-label="Tautan kebijakan">
        <a href="${rootUrl}tim-kelompok.html">Tim Kelompok</a>
        <a href="${rootUrl}fitur/kebijakan-privasi.html">Kebijakan Privasi</a>
        <a href="${rootUrl}fitur/standar-uji-akg.html">Standar Kualitas</a>
        <a href="${rootUrl}index.html">Keterbukaan Informasi</a>
      </nav>
    </div>
  </div>
</footer>`;

  footerHost.outerHTML = footerHtml;
})();
