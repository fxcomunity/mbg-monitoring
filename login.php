<?php
/**
 * login.php — Portal Autentikasi & Registrasi Terpadu Radar MBG
 * Badan Gizi Nasional Republik Indonesia
 * Multi-Role: Administrator Satgas BGN, Mitra Dapur SPPG, dan Wali Murid / Sekolah
 */

require_once __DIR__ . '/database/auth.php';
require_once __DIR__ . '/database/security.php';

// Inspeksi Anti-Exploit
Security::inspectRequest(true);

$errorMsg   = '';
$successMsg = '';
$activeTab  = isset($_GET['tab']) && $_GET['tab'] === 'register' ? 'register' : 'login';

// Aksi Logout
if ((isset($_GET['action']) && $_GET['action'] === 'logout') || isset($_GET['logout'])) {
    Auth::logout();
    $successMsg = 'Anda telah berhasil keluar dari sistem.';
}

// Redirect jika sudah login
if (Auth::check()) {
    $role = $_SESSION['role'] ?? 'user';
    if ($role === 'admin') {
        header('Location: dashboard/admin/');
    } elseif ($role === 'sppg') {
        header('Location: dashboard/sppg/');
    } else {
        header('Location: dashboard/user/');
    }
    exit;
}

// Handle Form Submission
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $formType = $_POST['form_type'] ?? 'login';

    if ($formType === 'login') {
        $username = trim($_POST['username'] ?? '');
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
            $errorMsg  = $res['message'];
            $activeTab = 'login';
        }
    } elseif ($formType === 'register') {
        $fullName = trim($_POST['full_name'] ?? '');
        $email    = trim($_POST['email'] ?? '');
        $username = trim($_POST['username'] ?? '');
        $password = $_POST['password'] ?? '';
        $cfmPass  = $_POST['confirm_password'] ?? '';
        $role     = trim($_POST['role'] ?? 'user');
        $sppgName = trim($_POST['sppg_name'] ?? '');

        if ($password !== $cfmPass) {
            $errorMsg  = 'Konfirmasi kata sandi tidak cocok.';
            $activeTab = 'register';
        } else {
            $regRes = Auth::register($fullName, $email, $username, $password, $role, $sppgName ?: null);
            if ($regRes['status']) {
                $successMsg = 'Registrasi berhasil! Silakan masuk menggunakan akun baru Anda.';
                $activeTab  = 'login';
            } else {
                $errorMsg  = $regRes['message'];
                $activeTab = 'register';
            }
        }
    }
}
?>
<!DOCTYPE html>
<html lang="id" class="h-full">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Portal Autentikasi MBG — Badan Gizi Nasional RI</title>
  <link rel="icon" type="image/webp" href="assets/images/logo.webp"/>
  <link rel="apple-touch-icon" href="assets/images/logo.webp"/>

  <!-- Google Fonts: Plus Jakarta Sans -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet"/>

  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: '#001026',
            'primary-container': '#0b2545',
            secondary: '#395f95',
            'secondary-container': '#134074',
            'tertiary-fixed': '#6ffbbe',
            surface: '#f8f9ff',
            'surface-card': '#ffffff',
            'status-success': '#059669',
            'status-error': '#ef4444'
          },
          fontFamily: {
            sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif']
          }
        }
      }
    }
  </script>
  <style>
    /* Background grid subtle effect */
    .bg-grid-pattern {
      background-size: 32px 32px;
      background-image: 
        linear-gradient(to right, rgba(11, 37, 69, 0.05) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(11, 37, 69, 0.05) 1px, transparent 1px);
    }
    .glass-card {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
    }
  </style>
</head>
<body class="relative bg-[#001026] font-sans text-primary min-h-screen flex flex-col justify-between selection:bg-[#6ffbbe] selection:text-[#001026] overflow-x-hidden">

  <!-- Fullscreen Video Background -->
  <div class="fixed inset-0 overflow-hidden pointer-events-none -z-20">
    <video autoplay muted loop playsinline preload="auto" class="w-full h-full object-cover">
      <source src="https://res.cloudinary.com/dgenxagit/video/upload/v1791923878/gemini_generated_video_22b0321d.mp4" type="video/mp4">
    </video>
  </div>
  <!-- High Contrast Dark Glass Overlay -->
  <div class="fixed inset-0 bg-gradient-to-b from-[#001026]/85 via-[#001026]/75 to-[#001026]/90 backdrop-blur-[2px] pointer-events-none -z-10"></div>

  <!-- TOP HEADER -->
  <header class="w-full bg-[#001026]/80 backdrop-blur-md border-b border-white/10 py-3.5 px-4 sm:px-8 sticky top-0 z-40 transition-all">
    <div class="max-w-7xl mx-auto flex items-center justify-between">
      <a href="index.html" class="flex items-center gap-3 group">
        <div class="relative">
          <img src="assets/images/logo.webp" alt="Logo BGN" class="h-10 w-auto object-contain transition-transform group-hover:scale-105" onerror="this.src='logo.webp'">
        </div>
        <div>
          <div class="flex items-center gap-1.5">
            <span class="font-extrabold text-base sm:text-lg text-white tracking-tight">Radar MBG</span>
            <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold tracking-wide border border-emerald-400/30">PORTAL RESMI</span>
          </div>
          <p class="text-[11px] text-slate-300 font-medium hidden sm:block">Badan Gizi Nasional Republik Indonesia</p>
        </div>
      </a>

      <div class="flex items-center gap-3">
        <a href="index.html" class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-200 hover:text-white px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all">
          <span class="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>Kembali ke Beranda</span>
        </a>
      </div>
    </div>
  </header>

  <!-- MAIN CONTAINER -->
  <main class="flex-grow flex items-center justify-center p-4 sm:p-6 lg:p-8 relative">

    <div class="w-full max-w-[480px]">
      
      <!-- AUTH CARD -->
      <div class="glass-card rounded-3xl shadow-2xl shadow-slate-900/10 border border-slate-200/90 p-6 sm:p-8 relative overflow-hidden">
        
        <!-- Top Accent Bar -->
        <div class="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#001026] via-[#134074] to-[#6ffbbe]"></div>

        <!-- HEADER TITLE -->
        <div class="text-center mb-6 pt-1">
          <div class="inline-flex p-3 rounded-2xl bg-gradient-to-br from-[#001026] to-[#0b2545] text-[#6ffbbe] shadow-lg shadow-slate-900/20 mb-3">
            <span class="material-symbols-outlined text-2xl">shield_person</span>
          </div>
          <h1 class="text-xl sm:text-2xl font-extrabold text-primary tracking-tight">Portal Akses Radar MBG</h1>
          <p class="text-xs sm:text-sm text-slate-500 mt-1">Satu pintu pemantauan Makan Bergizi Gratis Nasional</p>
        </div>

        <!-- NOTIFICATION ALERTS -->
        <?php if (!empty($errorMsg)): ?>
          <div class="mb-5 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5 shadow-sm animate-shake">
            <span class="material-symbols-outlined text-lg text-red-600 shrink-0 mt-0.5">error</span>
            <div class="flex-1">
              <span class="font-bold">Gagal: </span>
              <span><?= htmlspecialchars($errorMsg, ENT_QUOTES, 'UTF-8') ?></span>
            </div>
          </div>
        <?php endif; ?>

        <?php if (!empty($successMsg)): ?>
          <div class="mb-5 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5 shadow-sm">
            <span class="material-symbols-outlined text-lg text-emerald-600 shrink-0 mt-0.5">check_circle</span>
            <div class="flex-1">
              <span class="font-bold">Berhasil: </span>
              <span><?= htmlspecialchars($successMsg, ENT_QUOTES, 'UTF-8') ?></span>
            </div>
          </div>
        <?php endif; ?>

        <!-- TABS SWITCHER: MASUK vs DAFTAR -->
        <div class="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-2xl mb-6 border border-slate-200/80">
          <button type="button" id="tabBtnLogin" onclick="switchAuthTab('login')"
                  class="py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 <?= $activeTab === 'login' ? 'bg-white text-primary shadow-sm' : 'text-slate-600 hover:text-primary' ?>">
            <span class="material-symbols-outlined text-[18px]">login</span>
            <span>Masuk Akun</span>
          </button>
          <button type="button" id="tabBtnRegister" onclick="switchAuthTab('register')"
                  class="py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 <?= $activeTab === 'register' ? 'bg-white text-primary shadow-sm' : 'text-slate-600 hover:text-primary' ?>">
            <span class="material-symbols-outlined text-[18px]">how_to_reg</span>
            <span>Daftar Akun</span>
          </button>
        </div>

        <!-- ======================================================== -->
        <!-- TAB 1: FORM LOGIN -->
        <!-- ======================================================== -->
        <div id="formSectionLogin" class="<?= $activeTab === 'login' ? '' : 'hidden' ?>">
          <form action="login.php" method="POST" class="space-y-4">
            <input type="hidden" name="form_type" value="login">

            <!-- Username or Email -->
            <div>
              <label for="loginUsername" class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Username atau Alamat Email
              </label>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <span class="material-symbols-outlined text-[20px]">person</span>
                </div>
                <input type="text" id="loginUsername" name="username" required autocomplete="username"
                       placeholder="Contoh: admin_bgn atau email@bgn.go.id"
                       class="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#134074] focus:border-transparent transition-all shadow-sm">
              </div>
            </div>

            <!-- Password -->
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label for="loginPassword" class="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Kata Sandi
                </label>
                <a href="laporan-aduan.html" class="text-[11px] font-semibold text-secondary hover:underline">
                  Butuh Bantuan?
                </a>
              </div>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <span class="material-symbols-outlined text-[20px]">lock</span>
                </div>
                <input type="password" id="loginPassword" name="password" required autocomplete="current-password"
                       placeholder="Masukkan kata sandi akun"
                       class="w-full pl-10 pr-11 py-3 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#134074] focus:border-transparent transition-all shadow-sm">
                <button type="button" onclick="togglePasswordVisibility('loginPassword', 'eyeIconLogin')" class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600">
                  <span id="eyeIconLogin" class="material-symbols-outlined text-[20px]">visibility</span>
                </button>
              </div>
            </div>

            <!-- Submit Button -->
            <button type="submit" class="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#001026] via-[#0b2545] to-[#134074] hover:from-[#0b2545] hover:to-[#001026] text-white font-bold text-xs sm:text-sm shadow-md shadow-slate-900/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2">
              <span>Masuk ke Dashboard</span>
              <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </form>
        </div>

        <!-- ======================================================== -->
        <!-- TAB 2: FORM REGISTER -->
        <!-- ======================================================== -->
        <div id="formSectionRegister" class="<?= $activeTab === 'register' ? '' : 'hidden' ?>">
          <form action="login.php" method="POST" class="space-y-3.5">
            <input type="hidden" name="form_type" value="register">

            <!-- Role Selector -->
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Pilih Jenis Akun
              </label>
              <div class="grid grid-cols-2 gap-2">
                <label class="cursor-pointer border border-slate-200 rounded-2xl p-2.5 flex items-center gap-2 hover:bg-slate-50 has-[:checked]:border-[#001026] has-[:checked]:bg-blue-50/50 transition-all">
                  <input type="radio" name="role" value="user" checked onchange="toggleSppgField(false)" class="text-[#001026] focus:ring-0">
                  <div>
                    <span class="block text-xs font-bold text-slate-900">Wali Murid / Umum</span>
                    <span class="text-[10px] text-slate-500">Masyarakat & Komite</span>
                  </div>
                </label>
                <label class="cursor-pointer border border-slate-200 rounded-2xl p-2.5 flex items-center gap-2 hover:bg-slate-50 has-[:checked]:border-[#059669] has-[:checked]:bg-emerald-50/50 transition-all">
                  <input type="radio" name="role" value="sppg" onchange="toggleSppgField(true)" class="text-emerald-600 focus:ring-0">
                  <div>
                    <span class="block text-xs font-bold text-slate-900">Mitra SPPG</span>
                    <span class="text-[10px] text-slate-500">Dapur Pangan Lokal</span>
                  </div>
                </label>
              </div>
            </div>

            <!-- Full Name -->
            <div>
              <label for="regFullName" class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Nama Lengkap / Penanggung Jawab
              </label>
              <input type="text" id="regFullName" name="full_name" required autocomplete="name"
                     placeholder="Contoh: Budi Santoso"
                     class="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#134074] transition-all shadow-sm">
            </div>

            <!-- SPPG Kitchen Name (Conditional) -->
            <div id="fieldSppgName" class="hidden">
              <label for="regSppgName" class="block text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">
                Nama Dapur SPPG
              </label>
              <input type="text" id="regSppgName" name="sppg_name"
                     placeholder="Contoh: SPPG Bangli Landih Bali"
                     class="w-full px-3.5 py-2.5 bg-emerald-50/50 border border-emerald-200 rounded-2xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 transition-all shadow-sm">
            </div>

            <!-- Email & Username in Grid -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label for="regEmail" class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Alamat Email
                </label>
                <input type="email" id="regEmail" name="email" required autocomplete="email"
                       placeholder="email@anda.com"
                       class="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#134074] transition-all shadow-sm">
              </div>
              <div>
                <label for="regUsername" class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Username
                </label>
                <input type="text" id="regUsername" name="username" required autocomplete="username" minlength="3"
                       placeholder="huruf/angka"
                       class="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#134074] transition-all shadow-sm">
              </div>
            </div>

            <!-- Password & Confirm Password -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label for="regPassword" class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Kata Sandi
                </label>
                <div class="relative">
                  <input type="password" id="regPassword" name="password" required minlength="6"
                         placeholder="Min 6 karakter"
                         class="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#134074] transition-all shadow-sm">
                </div>
              </div>
              <div>
                <label for="regCfmPassword" class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Ulangi Sandi
                </label>
                <div class="relative">
                  <input type="password" id="regCfmPassword" name="confirm_password" required minlength="6"
                         placeholder="Ketik ulang"
                         class="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#134074] transition-all shadow-sm">
                </div>
              </div>
            </div>

            <!-- Submit Register -->
            <button type="submit" class="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-700/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 mt-2">
              <span class="material-symbols-outlined text-[18px]">verified_user</span>
              <span>Daftarkan Akun Sekarang</span>
            </button>
          </form>
        </div>

        <!-- FOOTER INFO -->
        <div class="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span class="flex items-center gap-1">
            <span class="material-symbols-outlined text-[14px] text-emerald-600">lock</span>
            Enkripsi TLS & Anti-Tamper
          </span>
          <a href="kebijakan-privasi.html" class="hover:underline hover:text-slate-600">Kebijakan Privasi</a>
        </div>

      </div>

    </div>
  </main>

  <!-- MINI FOOTER -->
  <footer class="w-full py-4 text-center text-xs text-slate-400">
    <p>© 2026 Badan Gizi Nasional (BGN) Republik Indonesia. Seluruh hak cipta dilindungi.</p>
  </footer>

  <!-- SCRIPT INTERAKSI -->
  <script>
    // Tab switcher
    function switchAuthTab(tab) {
      const loginSection = document.getElementById('formSectionLogin');
      const regSection = document.getElementById('formSectionRegister');
      const tabLogin = document.getElementById('tabBtnLogin');
      const tabReg = document.getElementById('tabBtnRegister');

      if (tab === 'register') {
        loginSection.classList.add('hidden');
        regSection.classList.remove('hidden');

        tabReg.className = 'py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 bg-white text-primary shadow-sm';
        tabLogin.className = 'py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 text-slate-600 hover:text-primary';

        // Update URL hash/query without reload
        window.history.replaceState(null, '', '?tab=register');
      } else {
        regSection.classList.add('hidden');
        loginSection.classList.remove('hidden');

        tabLogin.className = 'py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 bg-white text-primary shadow-sm';
        tabReg.className = 'py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 text-slate-600 hover:text-primary';

        window.history.replaceState(null, '', '?tab=login');
      }
    }

    // Toggle Password Visibility
    function togglePasswordVisibility(inputId, iconId) {
      const input = document.getElementById(inputId);
      const icon = document.getElementById(iconId);
      if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = 'visibility_off';
      } else {
        input.type = 'password';
        icon.textContent = 'visibility';
      }
    }

    // Toggle SPPG Name field on Register
    function toggleSppgField(show) {
      const field = document.getElementById('fieldSppgName');
      const input = document.getElementById('regSppgName');
      if (show) {
        field.classList.remove('hidden');
        input.required = true;
      } else {
        field.classList.add('hidden');
        input.required = false;
      }
    }
  </script>
</body>
</html>
