<?php
/**
 * register.php - Form Registrasi untuk MBG-MONITORING
 * Menggunakan PDO via getDB() (database connection) dan Security::inspectRequest()
 */
require_once __DIR__ . '/database/auth.php';
require_once __DIR__ . '/database/security.php';

// Inspeksi keamanan request
Security::inspectRequest(true);

$errorMsg = '';
$successMsg = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $nama = trim($_POST['nama'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';
    $role = $_POST['role'] ?? 'user';

    // Validasi sederhana
    if (empty($nama) || empty($email) || empty($username) || empty($password)) {
        $errorMsg = 'Semua kolom wajib diisi.';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errorMsg = 'Email tidak valid.';
    } else {
        $hash = password_hash($password, PASSWORD_BCRYPT);
        try {
            $pdo = getDB();
            $stmt = $pdo->prepare('INSERT INTO users (full_name, email, username, password_hash, role, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, NOW())');
            $stmt->execute([$nama, $email, $username, $hash, $role]);
            $successMsg = 'Pendaftaran berhasil. Silakan masuk.';
        } catch (Throwable $e) {
            $errorMsg = 'Pendaftaran gagal. Mungkin email atau username sudah terdaftar.';
        }
    }
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Daftar Akun - Radar MBG</title>
    <link rel="icon" type="image/webp" href="assets/images/logo.webp"/>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = { theme: { extend: { colors: { primary: '#001026', 'primary-container': '#0b2545', secondary: '#395f95', 'tertiary-fixed': '#6ffbbe', surface: '#f8f9ff', 'surface-card': '#ffffff', 'status-success': '#059669', 'status-error': '#ef4444' } } } };
    </script>
    <link rel="stylesheet" href="assets/css/style.css"/>
</head>
<body class="bg-surface font-sans text-primary min-h-screen flex flex-col justify-between">
    <header class="w-full bg-white/90 backdrop-blur-md border-b border-slate-200 py-4 px-6 sm:px-12 flex items-center justify-between">
        <a href="index.html" class="flex items-center gap-3">
            <img src="assets/images/logo.webp" alt="Logo BGN" class="h-10 w-auto object-contain"/>
            <div>
                <div class="flex items-center gap-1.5">
                    <span class="font-bold text-lg text-primary tracking-tight">Radar MBG</span>
                    <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">Portal Daftar</span>
                </div>
                <p class="text-xs text-slate-500 font-medium">Badan Gizi Nasional Republik Indonesia</p>
            </div>
        </a>
    </header>
    <main class="flex-grow flex items-center justify-center p-4 sm:p-6 my-6">
        <div class="w-full max-w-md bg-surface-card rounded-3xl shadow-xl border border-slate-200/80 p-8">
            <div class="text-center mb-8">
                <div class="w-14 h-14 rounded-2xl bg-primary text-tertiary-fixed flex items-center justify-center mx-auto mb-3 shadow-md shadow-primary/20">
                    <span class="material-symbols-outlined text-3xl">person_add</span>
                </div>
                <h1 class="text-2xl font-bold text-primary tracking-tight">Daftar Akun Baru</h1>
                <p class="text-sm text-slate-500 mt-1">Buat akun untuk mengakses Dashboard MBG</p>
            </div>
            <?php if (!empty($errorMsg)): ?>
                <div class="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                    <span class="material-symbols-outlined text-lg text-red-600">error</span>
                    <span><?=htmlspecialchars($errorMsg, ENT_QUOTES, 'UTF-8')?></span>
                </div>
            <?php endif; ?>
            <?php if (!empty($successMsg)): ?>
                <div class="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                    <span class="material-symbols-outlined text-lg text-emerald-600">check_circle</span>
                    <span><?=htmlspecialchars($successMsg, ENT_QUOTES, 'UTF-8')?></span>
                </div>
            <?php endif; ?>
            <form action="register.php" method="POST" class="space-y-4">
                <div>
                    <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Nama Lengkap</label>
                    <input type="text" name="nama" required autocomplete="name"
                           class="w-full pl-3 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"/>
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Email</label>
                    <input type="email" name="email" required autocomplete="email"
                           class="w-full pl-3 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"/>
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Username</label>
                    <input type="text" name="username" required autocomplete="username"
                           class="w-full pl-3 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"/>
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Password</label>
                    <input type="password" name="password" required autocomplete="new-password"
                           class="w-full pl-3 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"/>
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Peran / Role</label>
                    <select name="role" required class="w-full pl-3 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all">
                        <option value="">-- Pilih Peran --</option>
                        <option value="admin">Admin Satgas BGN</option>
                        <option value="sppg">Mitra Dapur SPPG</option>
                        <option value="user">Wali Murid / Pengguna</option>
                    </select>
                </div>
                <button type="submit" class="w-full py-3 px-4 rounded-xl bg-primary hover:bg-primary-container text-white font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 mt-2">
                    <span>Daftar Sekarang</span>
                    <span class="material-symbols-outlined text-sm">person_add</span>
                </button>
            </form>
            <div class="text-center mt-4 text-sm">
                <a href="login.php" class="text-primary hover:underline">Sudah punya akun? Masuk di sini</a>
            </div>
        </div>
    </main>
    <footer class="py-4 text-center text-xs text-slate-400 border-t border-slate-200">
        <span>Redesain | © 2026 Badan Gizi Nasional Republik Indonesia.</span>
    </footer>
    <script src="assets/js/security.js"></script>
</body>
</html>
