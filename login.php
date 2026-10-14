<?php
/**
 * login.php - Portal Autentikasi Terpadu Radar MBG
 * Multi-Role: Administrator BGN, Dapur SPPG, dan Pengguna / Wali Murid
 */

require_once __DIR__ . '/database/auth.php';
require_once __DIR__ . '/database/security.php';

// Jalankan inspeksi keamanan (Anti-XSS & Anti-SQLi)
Security::inspectRequest(true);

$errorMsg = '';
$successMsg = '';

if (isset($_GET['action']) && $_GET['action'] === 'logout') {
    Auth::logout();
    $successMsg = 'Anda telah berhasil keluar dari sesi.';
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = $_POST['username'] ?? '';
    $password = $_POST['password'] ?? '';

    $res = Auth::login($username, $password);
    if ($res['status']) {
        $role = $res['user']['role'];
        if ($role === 'admin') {
            header('Location: dashboard/admin/');
        } elseif ($role === 'sppg') {
            header('Location: dashboard/sppg/');
        } else {
            header('Location: dashboard/user/');
        }
        exit;
    } else {
        $errorMsg = $res['message'];
    }
}

// Redirect jika sudah login
if (Auth::check()) {
    $role = $_SESSION['role'] ?? 'user';
    if ($role === 'admin') header('Location: dashboard/admin/');
    elseif ($role === 'sppg') header('Location: dashboard/sppg/');
    else header('Location: dashboard/user/');
    exit;
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8"/>
  <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
  <title>Masuk Portal Terpadu - Radar MBG Badan Gizi Nasional</title>
  <link rel="icon" type="image/webp" href="assets/images/logo.webp"/>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet"/>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: '#001026',
            'primary-container': '#0b2545',
            secondary: '#395f95',
            'tertiary-fixed': '#6ffbbe',
            surface: '#f8f9ff',
            'surface-card': '#ffffff',
            'status-success': '#059669',
            'status-error': '#ef4444'
          },
          fontFamily: {
            sans: ['Plus Jakarta Sans', 'sans-serif']
          }
        }
      }
    }
  </script>
<link rel="stylesheet" href="assets/css/style.css"/>
<link rel="stylesheet" href="assets/css/security.css"/>
</head>
<body class="bg-surface font-sans text-primary min-h-screen flex flex-col justify-between">

  <!-- Header Mini -->
  <header class="w-full bg-white/90 backdrop-blur-md border-b border-slate-200 py-4 px-6 sm:px-12 flex items-center justify-between">
    <a href="index.html" class="flex items-center gap-3">
      <img src="assets/images/logo.webp" alt="Logo BGN" class="h-10 w-auto object-contain">
      <div>
        <div class="flex items-center gap-1.5">
          <span class="font-bold text-lg text-primary tracking-tight">Radar MBG</span>
          <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">Portal Masuk</span>
        </div>
        <p class="text-xs text-slate-500 font-medium">Badan Gizi Nasional Republik Indonesia</p>
      </div>
    </a>
    <a href="index.html" class="text-xs font-semibold text-secondary hover:text-primary flex items-center gap-1 transition-colors">
      <span class="material-symbols-outlined text-[16px]">arrow_back</span>
      <span>Kembali ke Beranda</span>
    </a>
  </header>

  <!-- Login Container -->
  <main class="flex-grow flex items-center justify-center p-4 sm:p-6 my-6">
    <div class="w-full max-w-md bg-surface-card rounded-3xl shadow-xl border border-slate-200/80 p-8 relative overflow-hidden">
      <!-- Glow background accent -->
      <div class="absolute -top-20 -right-20 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
      
      <div class="text-center mb-8">
        <div class="w-14 h-14 rounded-2xl bg-primary text-tertiary-fixed flex items-center justify-center mx-auto mb-3 shadow-md shadow-primary/20">
          <span class="material-symbols-outlined text-3xl">lock_open</span>
        </div>
        <h1 class="text-2xl font-bold text-primary tracking-tight">Login Portal Terpadu</h1>
        <p class="text-sm text-slate-500 mt-1">Akses Dashboard User, SPPG, dan Satgas Admin</p>
      </div>

      <?php if (!empty($errorMsg)): ?>
        <div class="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <span class="material-symbols-outlined text-lg text-red-600">error</span>
          <span><?= htmlspecialchars($errorMsg, ENT_QUOTES, 'UTF-8') ?></span>
        </div>
      <?php endif; ?>

      <?php if (!empty($successMsg)): ?>
        <div class="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
          <span class="material-symbols-outlined text-lg text-emerald-600">check_circle</span>
          <span><?= htmlspecialchars($successMsg, ENT_QUOTES, 'UTF-8') ?></span>
        </div>
      <?php endif; ?>

      <form action="login.php" method="POST" class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Username / Email Resmi</label>
          <div class="relative">
            <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">person</span>
            <input type="text" name="username" required autocomplete="username"
                   placeholder="Masukkan username atau email"
                   class="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all">
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Kata Sandi (Password)</label>
          <div class="relative">
            <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">key</span>
            <input type="password" name="password" required autocomplete="current-password"
                   placeholder="••••••••••••"
                   class="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all">
          </div>
        </div>

        <button type="submit" 
                class="w-full py-3 px-4 rounded-xl bg-primary hover:bg-primary-container text-white font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 mt-2">
          <span>Masuk ke Dashboard</span>
          <span class="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
      </form>


    </div>
  </main>

  <!-- Footer Mini -->
  <footer class="py-4 text-center text-xs text-slate-400 border-t border-slate-200">
    <span>Redesain | © 2026 Badan Gizi Nasional Republik Indonesia. Dilengkapi BGN Shield Anti-Exploit.</span>
  </footer>

  <script>
    function fillCreds(u, p) {
      document.querySelector('input[name="username"]').value = u;
      document.querySelector('input[name="password"]').value = p;
    }
  </script>
<script src="assets/js/security.js"></script>
</body>
</html>
