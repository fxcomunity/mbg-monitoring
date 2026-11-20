(function () {
  var script = document.currentScript;
  var footerHost = document.querySelector('[data-site-footer]');

  if (!script || !footerHost) {
    console.error('Footer Radar MBG tidak dapat dipasang: elemen atau skrip footer tidak ditemukan.');
    return;
  }

  var rootUrl = new URL('../../', script.src).href;
  var footerHtml = `
<footer class="site-footer w-full bg-surface-container-lowest border-t border-border-subtle mt-space-xl">
  <div class="w-full px-space-lg py-space-xl">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-xl mb-space-xl">
      <div class="flex flex-col gap-space-sm">
        <div class="flex items-center gap-space-sm">
          <img src="${rootUrl}assets/images/ic_launcher.png" alt="Logo Badan Gizi Nasional" class="h-9 w-auto object-contain"/>
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
              <a href="https://wa.me/6281110008008" target="_blank" rel="noopener noreferrer" class="hover:text-primary font-semibold transition-colors">+62 811-1000-8008</a>
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
          <li><a class="hover:text-primary transition-colors flex items-center gap-1" href="${rootUrl}index.html"><span class="material-symbols-outlined text-[14px]">arrow_forward</span>Monitoring Nasional MBG</a></li>
          <li><a class="hover:text-primary transition-colors flex items-center gap-1" href="${rootUrl}tim-kelompok.html"><span class="material-symbols-outlined text-[14px]">arrow_forward</span>Tim Kelompok</a></li>
          <li><a class="hover:text-primary transition-colors flex items-center gap-1" href="${rootUrl}fitur/menu-hari-ini.html"><span class="material-symbols-outlined text-[14px]">arrow_forward</span>Menu Hari Ini &amp; AKG</a></li>
          <li><a class="hover:text-primary transition-colors flex items-center gap-1" href="${rootUrl}fitur/distribusi-sebaran-sppg.html"><span class="material-symbols-outlined text-[14px]">arrow_forward</span>Distribusi &amp; Sebaran SPPG</a></li>
          <li><a class="hover:text-primary transition-colors flex items-center gap-1" href="${rootUrl}fitur/standar-uji-akg.html"><span class="material-symbols-outlined text-[14px]">arrow_forward</span>Standar AKG &amp; Uji Mutu</a></li>
          <li><a class="hover:text-primary transition-colors flex items-center gap-1" href="${rootUrl}fitur/laporan-aduan.html"><span class="material-symbols-outlined text-[14px]">arrow_forward</span>Portal Aduan &amp; Pengaduan Publik</a></li>
        </ul>
      </div>
      <div class="flex flex-col gap-space-sm">
        <span class="font-label-lg text-label-lg text-primary uppercase tracking-wider">Transparansi &amp; Partisipasi</span>
        <div class="p-space-md rounded-xl bg-surface-container-low flex flex-col gap-space-xs">
          <span class="font-label-md text-label-md text-primary font-bold">Audit Publik Mandiri</span>
          <p class="font-body-sm text-body-sm text-on-surface-variant">
            Masyarakat berhak memantau komposisi nutrisi, asal suplai pangan lokal, dan verifikasi Satuan Pelayanan Pemenuhan Gizi (SPPG).
          </p>
          <a class="font-label-md text-label-md text-secondary hover:text-primary transition-colors flex items-center gap-1 mt-1 font-semibold" href="${rootUrl}fitur/laporan-aduan.html">
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
      <div class="flex flex-wrap items-center gap-space-lg font-label-md text-label-md">
        <a class="hover:text-primary transition-colors font-bold text-secondary" href="${rootUrl}tim-kelompok.html">Tim Kelompok</a>
        <a class="hover:text-primary transition-colors" href="${rootUrl}fitur/kebijakan-privasi.html">Kebijakan Privasi</a>
        <a class="hover:text-primary transition-colors" href="${rootUrl}fitur/standar-uji-akg.html">Standar Kualitas Pangan</a>
        <a class="hover:text-primary transition-colors" href="${rootUrl}index.html">Keterbukaan Informasi Publik</a>
      </div>
    </div>
  </div>
</footer>`;

  footerHost.outerHTML = footerHtml;
})();
