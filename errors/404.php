<?php
http_response_code(404);
?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="robots" content="noindex, nofollow"/>
  <title>Halaman Tidak Ditemukan - Radar MBG Badan Gizi Nasional</title>
  <link rel="icon" type="image/webp" href="assets/images/logo.webp"/>
  <link rel="apple-touch-icon" href="assets/images/logo.webp"/>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet"/>
  <link rel="stylesheet" href="assets/css/style.css"/>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @keyframes float-soft {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-6px); }
    }
    @keyframes pulse-ring {
      0% { transform: scale(0.9); opacity: 0.6; }
      100% { transform: scale(1.6); opacity: 0; }
    }
    @keyframes fade-up {
      from { opacity: 0; transform: translateY(14px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .float-soft { animation: float-soft 4s ease-in-out infinite; }
    .pulse-ring { animation: pulse-ring 2.4s ease-out infinite; }
    .fade-up { animation: fade-up 0.6s ease-out both; }
    .fade-up-2 { animation: fade-up 0.6s 0.1s ease-out both; }
    .fade-up-3 { animation: fade-up 0.6s 0.2s ease-out both; }

    /* Video latar: disembunyikan bagi pengguna yang memilih reduced motion */
    @media (prefers-reduced-motion: reduce) {
      .float-soft, .pulse-ring, .fade-up, .fade-up-2, .fade-up-3 { animation: none; }
      .bg-video { display: none; }
    }
  </style>
</head>
<body class="relative bg-[#001026] font-['Plus_Jakarta_Sans',sans-serif] text-slate-800 min-h-screen flex flex-col antialiased overflow-x-hidden">

  <!-- Video Latar Belakang -->
  <div class="fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
    <video
      class="bg-video absolute inset-0 w-full h-full object-cover"
      autoplay muted loop playsinline preload="auto"
      disablepictureinpicture
    >
      <source src="https://res.cloudinary.com/dgenxagit/video/upload/v1791923878/gemini_generated_video_22b0321d.mp4" type="video/mp4">
    </video>
    <!-- Overlay agar teks dan kartu tetap terbaca -->
    <div class="absolute inset-0 bg-gradient-to-b from-[#001026]/60 via-[#001026]/35 to-[#001026]/70"></div>
  </div>

  <!-- Header Mini -->
  <header class="relative z-10 w-full bg-white/85 backdrop-blur-md border-b border-white/40 px-5 sm:px-12 py-3.5 flex items-center justify-between">
    <a href="index.html" class="flex items-center gap-3 group">
      <img src="assets/images/logo.webp" alt="Logo Badan Gizi Nasional" class="h-10 w-auto object-contain transition-transform duration-300 group-hover:scale-105">
      <div class="flex flex-col">
        <span class="font-bold text-sm sm:text-base text-slate-900 tracking-tight leading-tight">Radar MBG (Makan Bergizi Gratis)</span>
        <span class="text-xs text-slate-500 font-medium">Badan Gizi Nasional</span>
      </div>
    </a>
    <a href="index.html" class="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-[#001026] transition-colors">
      <span class="material-symbols-outlined text-[18px]">arrow_back</span>
      Beranda
    </a>
  </header>

  <!-- Kartu 404 -->
  <main class="relative z-10 flex-grow flex items-center justify-center p-4 sm:p-6 my-8">
    <div class="w-full max-w-2xl bg-white/90 backdrop-blur-xl border border-white/60 rounded-3xl px-6 py-10 sm:p-14 text-center shadow-[0_20px_60px_rgba(0,0,0,0.35)] relative overflow-hidden">

      <!-- Garis aksen atas -->
      <div class="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#001026] via-blue-500 to-emerald-400"></div>

      <!-- Ikon -->
      <div class="fade-up relative w-20 h-20 mx-auto mb-6">
        <span class="pulse-ring absolute inset-0 rounded-full bg-blue-200/60"></span>
        <div class="float-soft relative w-20 h-20 rounded-full bg-gradient-to-br from-blue-50 to-white flex items-center justify-center border border-blue-100">
          <span class="material-symbols-outlined text-[38px] text-[#0b2545]">travel_explore</span>
        </div>
      </div>

      <!-- Kode error -->
      <p class="fade-up text-7xl sm:text-8xl font-extrabold tracking-tight bg-gradient-to-b from-[#001026] to-slate-400 bg-clip-text text-transparent leading-none mb-3">
        404
      </p>

      <!-- Judul & pesan -->
      <h1 class="fade-up-2 text-xl sm:text-2xl font-bold text-slate-900 mb-2">Halaman Tidak Ditemukan</h1>
      <p class="fade-up-2 text-sm sm:text-[15px] text-slate-600 max-w-md mx-auto mb-8 leading-relaxed">
        Halaman yang Anda cari tidak tersedia, sudah dipindahkan, atau tautannya tidak valid.
      </p>

      <!-- Tombol aksi -->
      <div class="fade-up-3 flex flex-col sm:flex-row items-center justify-center gap-3">
        <a href="index.html" class="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-[#001026] hover:bg-[#0b2545] text-white font-semibold text-sm transition-all shadow-md shadow-[#001026]/10 hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200">
          <span class="material-symbols-outlined text-[18px]">home</span>
          <span>Kembali ke Beranda</span>
        </a>
        <button type="button" onclick="history.length > 1 ? history.back() : (window.location.href='index.html')" class="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm border border-slate-200 transition-all hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-200">
          <span class="material-symbols-outlined text-[18px]">undo</span>
          <span>Halaman Sebelumnya</span>
        </button>
      </div>
    </div>
  </main>

  <!-- Footer -->
  <footer class="relative z-10 py-5 px-4 text-center text-xs text-slate-500 border-t border-white/40 bg-white/85 backdrop-blur-md">
    <span>&copy; <?= date('Y') ?> Radar MBG (Makan Bergizi Gratis) — Badan Gizi Nasional</span>
  </footer>

</body>
</html>