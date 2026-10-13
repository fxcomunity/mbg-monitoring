<?php
http_response_code(503);
header('Retry-After: 300');
?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>503 Pemeliharaan Sistem - Radar MBG Badan Gizi Nasional</title>
  <link rel="icon" type="image/webp" href="assets/images/logo.webp"/>
  <link rel="apple-touch-icon" href="assets/images/logo.webp"/>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet"/>
  <link rel="stylesheet" href="assets/css/style.css"/>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#F8FAFC] font-['Plus_Jakarta_Sans',sans-serif] text-slate-800 min-h-screen flex flex-col justify-between antialiased">

  <!-- Header Mini -->
  <header class="w-full bg-white border-b border-slate-200/80 px-6 sm:px-12 py-3.5 flex items-center justify-between shadow-sm">
    <a href="index.html" class="flex items-center gap-3">
      <img src="assets/images/logo.webp" alt="Logo Badan Gizi Nasional" class="h-10 w-auto object-contain">
      <div class="flex flex-col">
        <span class="font-bold text-sm sm:text-base text-slate-900 tracking-tight leading-tight">Radar MBG (Makan Bergizi Gratis)</span>
        <span class="text-xs text-slate-500 font-medium">Badan Gizi Nasional Republik Indonesia</span>
      </div>
    </a>
    <div class="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60">
      <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
      <span>Pemeliharaan Terjadwal (Maintenance)</span>
    </div>
  </header>

  <!-- Central 503 Card -->
  <main class="flex-grow flex items-center justify-center p-4 sm:p-6 my-8">
    <div class="w-full max-w-2xl bg-white border border-slate-200/80 rounded-3xl p-8 sm:p-14 text-center shadow-[0_2px_12px_rgba(0,0,0,0.03)] relative overflow-hidden">
      <!-- Maintenance Icon -->
      <div class="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 mx-auto mb-5 border border-amber-200 shadow-sm">
        <span class="material-symbols-outlined text-[34px] text-amber-600">construction</span>
      </div>

      <!-- Title & Message -->
      <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-2">Sistem Sedang Dalam Pemeliharaan</h1>
      <p class="text-sm sm:text-base text-slate-500 max-w-lg mx-auto mb-8 leading-relaxed">
        Layanan Radar MBG Nasional sedang menjalani peningkatan performa basis data dan sinkronisasi simpul telemetri SPPG. Kami akan segera kembali beroperasi penuh dalam beberapa saat.
      </p>

      <!-- Schedule Box -->
      <div class="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 text-left max-w-md mx-auto mb-8">
        <div class="flex items-center gap-2 text-xs font-bold text-amber-800 mb-1">
          <span class="material-symbols-outlined text-[16px]">schedule</span>
          <span>Jadwal Optimasi Sistem Terpadu</span>
        </div>
        <p class="text-xs text-amber-900">Pemberitahuan: Pemeliharaan rutin dilakukan secara berkala demi menjamin integritas data audit pangan dan akurasi 82+ juta porsi penerima MBG.</p>
      </div>

      <!-- Action Buttons -->
      <div class="flex flex-wrap items-center justify-center gap-3">
        <button onclick="window.location.reload();" class="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm transition-all shadow-md shadow-amber-600/20">
          <span class="material-symbols-outlined text-[18px]">cached</span>
          <span>Cek Ketersediaan Sistem</span>
        </button>
        <a href="index.html" class="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm transition-all border border-slate-300">
          <span class="material-symbols-outlined text-[18px]">home</span>
          <span>Halaman Beranda</span>
        </a>
      </div>
    </div>
  </main>

  <!-- Footer -->
  <footer class="py-5 text-center text-xs text-slate-400 border-t border-slate-200/60 bg-white">
    <span>Radar MBG (Makan Bergizi Gratis) — Badan Gizi Nasional</span>
  </footer>

</body>
</html>
