<?php
/**
 * dashboard/user/index.php - Portal Pengguna / Wali Murid / Guru
 * Radar MBG - Badan Gizi Nasional
 */

require_once __DIR__ . '/../../database/auth.php';
require_once __DIR__ . '/../../database/security.php';

Security::inspectRequest(true);

Auth::requireRole(['user', 'admin']);
$currentUser = Auth::user();

$pdo = getDB();

$actionMsg = '';
$actionErr = '';
$successMsg = '';
$errorMsg = '';

// Handle Submit Aduan Baru dari Dashboard User
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'submit_aduan') {
    $reporterName = Security::cleanInput($_POST['reporter_name'] ?? $currentUser['full_name'], 100);
    $reporterPhone= Security::cleanInput($_POST['reporter_phone'] ?? '081234567890', 20);
    $reporterRole = Security::cleanInput($_POST['reporter_role'] ?? 'wali', 30);
    $schoolTarget = Security::cleanInput($_POST['school_target'] ?? '', 180);
    $category     = Security::cleanInput($_POST['issue_category'] ?? 'menu', 30);
    $incidentDate = Security::cleanInput($_POST['incident_date'] ?? date('Y-m-d'), 10);
    $description  = Security::cleanInput($_POST['description'] ?? '', 2000);

    if (empty($schoolTarget) || empty($description)) {
        $actionErr = 'Nama sekolah sasaran dan rincian aduan wajib diisi.';
    } else {
        try {
            $date = date('Ymd');
            $rand = str_pad((string)mt_rand(1000, 9999), 4, '0', STR_PAD_LEFT);
            $ticketCode = "TKT-BGN-{$date}-{$rand}";

            $stmt = $pdo->prepare(
                'INSERT INTO laporan_aduan 
                  (ticket_code, reporter_name, reporter_phone, reporter_role, issue_category, school_target, incident_date, description, status, priority, ip_address, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())'
            );
            $stmt->execute([
                $ticketCode,
                $reporterName,
                $reporterPhone,
                $reporterRole,
                $category,
                $schoolTarget,
                $incidentDate,
                $description,
                'masuk',
                'sedang',
                $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'
            ]);

            $actionMsg = "Laporan berhasil dikirim! Nomor Tiket Anda: <strong>$ticketCode</strong>. Simpan tiket ini untuk melacak status.";
        } catch (Throwable $e) {
            $actionErr = 'Gagal mengirim laporan: ' . $e->getMessage();
        }
    }
}

// Action: Ganti Password User
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'change_password') {
    $oldPass = $_POST['old_password'] ?? '';
    $newPass = $_POST['new_password'] ?? '';
    $cfmPass = $_POST['confirm_password'] ?? '';
    if (strlen($newPass) < 6) {
        $errorMsg = 'Password baru minimal 6 karakter.';
    } elseif ($newPass !== $cfmPass) {
        $errorMsg = 'Konfirmasi password baru tidak cocok.';
    } else {
        $stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = ?');
        $stmt->execute([(int)$currentUser['id']]);
        $currentHash = $stmt->fetchColumn();
        if (!$currentHash || !password_verify($oldPass, $currentHash)) {
            $errorMsg = 'Kata sandi lama yang Anda masukkan salah.';
        } else {
            $newHash = password_hash($newPass, PASSWORD_BCRYPT);
            $upd = $pdo->prepare('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?');
            $upd->execute([$newHash, (int)$currentUser['id']]);
            $successMsg = 'Kata sandi berhasil diperbarui!';
        }
    }
}

// Ambil riwayat aduan
$stmt = $pdo->prepare(
    'SELECT ticket_code, reporter_name, reporter_role, issue_category, school_target, incident_date, status, priority, description, satgas_notes, created_at
     FROM laporan_aduan
     ORDER BY created_at DESC
     LIMIT 20'
);
$stmt->execute();
$laporanList = $stmt->fetchAll();

// Ambil menu hari ini yang tersedia di DB
$menusToday = [];
try {
    $menusToday = $pdo->query('SELECT * FROM menu_sppg ORDER BY menu_date DESC LIMIT 6')->fetchAll();
} catch (Throwable $e) {}

// Statistik ringkas user
$totalLaporan = count($laporanList);
$selesai = count(array_filter($laporanList, fn($x) => $x['status'] === 'selesai'));
$proses  = count(array_filter($laporanList, fn($x) => in_array($x['status'], ['masuk', 'verifikasi', 'proses'])));

// Avatar User
$userAvatarRow = $pdo->prepare('SELECT avatar_url FROM users WHERE id = ?');
$userAvatarRow->execute([(int)$currentUser['id']]);
$userAvatar = $userAvatarRow->fetchColumn() ?: '../../assets/images/logo.webp';
?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8"/>
  <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
  <title>Dashboard Pengguna & Wali Murid - Radar MBG</title>
  <link rel="icon" type="image/webp" href="../../assets/images/logo.webp"/>
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
            'status-warning': '#f59e0b',
            'status-error': '#ef4444'
          },
          fontFamily: { sans: ['Plus Jakarta Sans', 'sans-serif'] }
        }
      }
    }
  </script>
  <link rel="stylesheet" href="../../assets/css/style.css"/>
  <link rel="stylesheet" href="../../assets/css/dashboard.css"/>
  <link rel="stylesheet" href="../../assets/css/security.css"/>
</head>
<body class="bg-surface font-sans text-primary min-h-screen flex flex-col justify-between">

  <!-- Navbar Dashboard -->
  <header class="w-full bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 px-6 sm:px-12 py-3.5 flex items-center justify-between shadow-sm">
    <div class="flex items-center gap-3">
      <img src="../../assets/images/logo.webp" alt="Logo BGN" class="h-9 w-auto">
      <div>
        <div class="flex items-center gap-2">
          <span class="font-bold text-base text-primary">Dashboard Publik & Wali</span>
          <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">Role: User</span>
        </div>
        <p class="text-xs text-slate-500 font-medium">Selamat datang, <strong><?= Security::cleanOutput($currentUser['full_name']) ?></strong></p>
      </div>
    </div>

    <div class="flex items-center gap-3">
      <a href="#pengaturan-profil" class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-colors">
        <img id="navUserAvatar" src="<?= str_starts_with($userAvatar, '../../') ? Security::cleanOutput($userAvatar) : '../../' . Security::cleanOutput($userAvatar) ?>" alt="User Avatar" class="w-6 h-6 rounded-full object-cover bg-white" onerror="this.src='../../assets/images/logo.webp'">
        <span class="hidden sm:inline">Profil &amp; Sandi</span>
      </a>
      <a href="../../index.html" class="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-colors">
        <span class="material-symbols-outlined text-sm">home</span>
        <span>Lihat Web Utama</span>
      </a>
      <a href="../../login.php?action=logout" class="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-xs font-semibold text-red-600 transition-colors">
        <span class="material-symbols-outlined text-sm">logout</span>
        <span>Keluar</span>
      </a>
    </div>
  </header>

  <!-- Main Content -->
  <main class="max-w-7xl mx-auto w-full p-4 sm:p-8 flex-grow">
    
    <!-- Flash Messages -->
    <?php if ($actionMsg || $successMsg): ?>
      <div class="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-sm">
        <span class="material-symbols-outlined text-emerald-600">check_circle</span>
        <span><?= $actionMsg ?: Security::cleanOutput($successMsg) ?></span>
      </div>
    <?php endif; ?>

    <?php if ($actionErr || $errorMsg): ?>
      <div class="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2 shadow-sm">
        <span class="material-symbols-outlined text-red-600">error</span>
        <span><?= Security::cleanOutput($actionErr ?: $errorMsg) ?></span>
      </div>
    <?php endif; ?>

    <!-- Hero Banner -->
    <div class="bg-gradient-to-r from-primary via-primary-container to-secondary rounded-3xl p-6 sm:p-8 text-white mb-8 shadow-xl relative overflow-hidden">
      <div class="relative z-10">
        <div class="flex items-center gap-2 mb-2">
          <span class="px-2.5 py-0.5 rounded-full bg-tertiary-fixed text-primary text-xs font-bold uppercase">Portal Partisipasi Publik</span>
          <span class="text-xs text-slate-300">• Dilindungi UU PDP No. 27/2022</span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight">Pantau Menu Siswa &amp; Laporan Masuk</h1>
        <p class="text-sm text-slate-300 max-w-2xl mt-1 leading-relaxed">
          Di sini Anda dapat melacak perkembangan investigasi laporan makanan sekolah, status tindak lanjut Satgas BGN, serta verifikasi mutu nutrisi harian.
        </p>
      </div>
    </div>

    <!-- Metrics Strip -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      <div class="bg-surface-card p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
        <div>
          <span class="text-xs text-slate-500 font-semibold uppercase">Total Aduan Dipantau</span>
          <h3 class="text-2xl font-bold text-primary mt-1"><?= (int)$totalLaporan ?></h3>
        </div>
        <div class="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
          <span class="material-symbols-outlined text-2xl">assignment</span>
        </div>
      </div>

      <div class="bg-surface-card p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
        <div>
          <span class="text-xs text-slate-500 font-semibold uppercase">Sedang Ditangani Satgas</span>
          <h3 class="text-2xl font-bold text-yellow-600 mt-1"><?= (int)$proses ?></h3>
        </div>
        <div class="w-12 h-12 rounded-xl bg-yellow-50 text-yellow-600 flex items-center justify-center">
          <span class="material-symbols-outlined text-2xl">pending_actions</span>
        </div>
      </div>

      <div class="bg-surface-card p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
        <div>
          <span class="text-xs text-slate-500 font-semibold uppercase">Laporan Selesai Ditangani</span>
          <h3 class="text-2xl font-bold text-emerald-600 mt-1"><?= (int)$selesai ?></h3>
        </div>
        <div class="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <span class="material-symbols-outlined text-2xl">verified</span>
        </div>
      </div>
    </div>

    <!-- SEKSI 1: FORM BUAT ADUAN LANGSUNG -->
    <div class="bg-surface-card rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8 mb-8">
      <div class="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
        <div class="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center">
          <span class="material-symbols-outlined text-2xl">campaign</span>
        </div>
        <div>
          <h2 class="text-lg font-bold text-primary">Kirim Laporan Pengaduan Makanan MBG</h2>
          <p class="text-xs text-slate-500">Laporkan kendala mutu, porsi, keterlambatan, atau suhu makanan sekolah anak Anda.</p>
        </div>
      </div>

      <form action="index.php" method="POST" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <input type="hidden" name="action" value="submit_aduan">
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Nama Lengkap Pelapor</label>
          <input type="text" name="reporter_name" value="<?= Security::cleanOutput($currentUser['full_name']) ?>" required class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs">
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Nomor WhatsApp / HP</label>
          <input type="tel" name="reporter_phone" placeholder="081234567890" required class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs">
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Peran Pelapor</label>
          <select name="reporter_role" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <option value="wali">Orang Tua / Wali Murid</option>
            <option value="guru">Guru / Tenaga Pengajar</option>
            <option value="komite">Komite Sekolah</option>
            <option value="siswa">Siswa / Pelajar</option>
            <option value="masyarakat">Masyarakat Umum</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Nama Sekolah Sasaran</label>
          <input type="text" name="school_target" placeholder="Contoh: SDN 01 Senayan Jakarta" required class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs">
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Kategori Masalah</label>
          <select name="issue_category" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <option value="suhu">Suhu Makanan Dingin (&lt;60°C)</option>
            <option value="menu">Menu Tidak Sesuai Standar BGN</option>
            <option value="porsi">Porsi Kurang / Tidak Cukup</option>
            <option value="basi">Kondisi Basi / Bau / Berlendir</option>
            <option value="waktu">Pengantaran Terlambat</option>
            <option value="kemasan">Kemasan Rusak / Bocor</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Tanggal Kejadian</label>
          <input type="date" name="incident_date" value="<?= date('Y-m-d') ?>" required class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs">
        </div>
        <div class="col-span-full">
          <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Rincian Kejadian &amp; Keterangan Lengkap</label>
          <textarea name="description" rows="3" placeholder="Ceritakan secara detail temuan masalah pada menu MBG..." required class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"></textarea>
        </div>
        <div class="col-span-full">
          <button type="submit" class="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all">
            <span class="material-symbols-outlined text-sm">send</span>
            <span>Kirim Aduan Resmi ke Satgas BGN</span>
          </button>
        </div>
      </form>
    </div>

    <!-- SEKSI 2: JADWAL MENU RESMI SPPG TERVERIFIKASI -->
    <div class="bg-surface-card rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8 mb-8">
      <div class="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <span class="material-symbols-outlined text-2xl">restaurant</span>
          </div>
          <div>
            <h2 class="text-lg font-bold text-primary">Menu MBG Sekolah Hari Ini</h2>
            <p class="text-xs text-slate-500">Data resmi yang telah divalidasi oleh Ahli Gizi / Dietisien SPPG.</p>
          </div>
        </div>
        <a href="../../menu-hari-ini.html" class="text-xs font-bold text-secondary hover:underline flex items-center gap-1">
          <span>Lihat Semua Sekolah</span>
          <span class="material-symbols-outlined text-sm">arrow_forward</span>
        </a>
      </div>

      <?php if (empty($menusToday)): ?>
        <div class="py-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <span class="material-symbols-outlined text-4xl block mb-2 text-slate-300">dinner_dining</span>
          <p class="text-xs font-medium">Belum ada menu yang diinput oleh Mitra SPPG untuk hari ini.</p>
        </div>
      <?php else: ?>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <?php foreach ($menusToday as $m): ?>
            <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
              <div>
                <div class="flex items-center justify-between text-[11px] mb-1">
                  <span class="font-bold text-secondary"><?= Security::cleanOutput($m['sppg_name']) ?></span>
                  <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold"><?= (int)$m['calories'] ?> kkal</span>
                </div>
                <h4 class="font-bold text-sm text-primary mb-1"><?= Security::cleanOutput($m['menu_title']) ?></h4>
                <p class="text-xs text-slate-500 flex items-center gap-1 mb-2">
                  <span class="material-symbols-outlined text-sm text-slate-400">school</span>
                  <span>Target: <?= Security::cleanOutput($m['school_target']) ?></span>
                </p>
                <p class="text-[11px] text-slate-600 line-clamp-2"><?= Security::cleanOutput($m['description'] ?: 'Komposisi porsi seimbang standar BGN.') ?></p>
              </div>
              <div class="pt-3 mt-3 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                <span>Suhu Kirim: <?= (float)$m['temperature'] ?>°C</span>
                <span class="text-emerald-700">Dietisien: <?= Security::cleanOutput($m['dietitian']) ?></span>
              </div>
            </div>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
    </div>

    <!-- SEKSI 3: TABEL RIWAYAT TIKET ADUAN -->
    <div class="bg-surface-card rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden mb-8">
      <div class="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-bold text-primary">Riwayat Pelacakan Aduan</h2>
          <p class="text-xs text-slate-500">Pantau proses tindak lanjut Satgas BGN terhadap laporan Anda.</p>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-100">
              <th class="py-3.5 px-4">Kode Tiket</th>
              <th class="py-3.5 px-4">Sekolah Sasaran</th>
              <th class="py-3.5 px-4">Kategori Masalah</th>
              <th class="py-3.5 px-4">Tanggal Kejadian</th>
              <th class="py-3.5 px-4">Status Penanganan</th>
              <th class="py-3.5 px-4">Catatan Satgas BGN</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 font-medium">
            <?php if (empty($laporanList)): ?>
              <tr>
                <td colspan="6" class="py-8 text-center text-slate-400">
                  <span class="material-symbols-outlined text-4xl block mb-1">inbox</span>
                  Belum ada aduan yang diajukan. Gunakan formulir di atas untuk menyampaikan laporan.
                </td>
              </tr>
            <?php else: ?>
              <?php foreach ($laporanList as $lap): ?>
                <tr class="hover:bg-slate-50/60 transition-colors">
                  <td class="py-3.5 px-4 font-mono font-bold text-primary whitespace-nowrap">
                    <?= Security::cleanOutput($lap['ticket_code']) ?>
                  </td>
                  <td class="py-3.5 px-4 text-slate-900 font-semibold">
                    <?= Security::cleanOutput($lap['school_target']) ?>
                  </td>
                  <td class="py-3.5 px-4">
                    <span class="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-semibold uppercase text-[10px]">
                      <?= Security::cleanOutput($lap['issue_category']) ?>
                    </span>
                  </td>
                  <td class="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                    <?= Security::cleanOutput($lap['incident_date']) ?>
                  </td>
                  <td class="py-3.5 px-4 whitespace-nowrap">
                    <?php
                      $st = $lap['status'];
                      $badgeCls = match($st) {
                        'selesai'    => 'bg-emerald-100 text-emerald-800',
                        'proses'     => 'bg-blue-100 text-blue-800',
                        'verifikasi' => 'bg-amber-100 text-amber-800',
                        'ditolak'    => 'bg-red-100 text-red-800',
                        default      => 'bg-slate-100 text-slate-700'
                      };
                    ?>
                    <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase <?= $badgeCls ?>">
                      <?= Security::cleanOutput($st) ?>
                    </span>
                  </td>
                  <td class="py-3.5 px-4 text-slate-600 text-[11px] max-w-xs">
                    <?= Security::cleanOutput($lap['satgas_notes'] ?: 'Laporan telah diterima dan masuk antrean penelaahan tim Satgas.') ?>
                  </td>
                </tr>
              <?php endforeach; ?>
            <?php endif; ?>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- PENGATURAN PROFIL & GANTI PASSWORD USER -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <div id="pengaturan-profil" class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <!-- Ganti Kata Sandi Akun -->
      <div id="ganti-password" class="bg-surface-card rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
        <div class="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
          <div class="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <span class="material-symbols-outlined text-2xl">key</span>
          </div>
          <div>
            <h2 class="text-lg font-bold text-primary">Ganti Kata Sandi Akun</h2>
            <p class="text-xs text-slate-500">Perbarui kata sandi akun Anda untuk menjaga keamanan data.</p>
          </div>
        </div>
        <form action="index.php" method="POST" class="flex flex-col gap-4">
          <input type="hidden" name="action" value="change_password">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Kata Sandi Lama</label>
            <input type="password" name="old_password" required class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none" placeholder="Masukkan kata sandi saat ini">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Kata Sandi Baru</label>
            <input type="password" name="new_password" required minlength="6" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none" placeholder="Minimal 6 karakter">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Konfirmasi Kata Sandi Baru</label>
            <input type="password" name="confirm_password" required minlength="6" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none" placeholder="Ulangi kata sandi baru">
          </div>
          <button type="submit" class="w-full py-2.5 rounded-xl bg-primary hover:bg-primary-container text-white font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2">
            <span class="material-symbols-outlined text-base">lock_reset</span>
            <span>Perbarui Kata Sandi</span>
          </button>
        </form>
      </div>

      <!-- Upload / Ganti Avatar User -->
      <div class="bg-surface-card rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
        <div class="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
          <div class="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
            <span class="material-symbols-outlined text-2xl">account_circle</span>
          </div>
          <div>
            <h2 class="text-lg font-bold text-primary">Atur Foto Profil Akun</h2>
            <p class="text-xs text-slate-500">Upload foto profil Anda (JPG/PNG/WEBP, maks 5 MB). Langsung aktif tanpa verifikasi.</p>
          </div>
        </div>
        <div class="flex flex-col items-center gap-4">
          <img id="userAvatarPreview" src="<?= str_starts_with($userAvatar, '../../') ? Security::cleanOutput($userAvatar) : '../../' . Security::cleanOutput($userAvatar) ?>" alt="Avatar User" class="w-24 h-24 rounded-2xl object-cover border-2 border-slate-200 shadow-sm bg-white" onerror="this.src='../../assets/images/logo.webp'">
          <form id="formUploadUserAvatar" enctype="multipart/form-data" class="w-full flex flex-col gap-3">
            <input type="file" name="avatar" accept="image/jpeg,image/png,image/webp" required class="w-full text-xs file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-primary file:text-white file:font-bold file:text-xs file:cursor-pointer">
            <button type="submit" class="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2">
              <span class="material-symbols-outlined text-base">cloud_upload</span>
              <span>Upload Foto Profil</span>
            </button>
          </form>
          <p id="avatarUploadStatus" class="text-xs text-slate-500 hidden"></p>
        </div>
        <script>
          document.getElementById('formUploadUserAvatar')?.addEventListener('submit', async function(e) {
            e.preventDefault();
            const form = e.target;
            const fd = new FormData(form);
            const status = document.getElementById('avatarUploadStatus');
            status.classList.remove('hidden');
            status.textContent = 'Mengupload...';
            status.className = 'text-xs text-blue-600';
            try {
              const res = await fetch('../../api/upload_avatar.php', { method: 'POST', body: fd, credentials: 'include' });
              const json = await res.json();
              if (json.status === 'success') {
                status.textContent = 'Foto profil berhasil diperbarui!';
                status.className = 'text-xs text-emerald-600 font-bold';
                if (json.avatar_url) {
                  const newSrc = '../../' + json.avatar_url;
                  document.getElementById('userAvatarPreview').src = newSrc;
                  const navAvatar = document.getElementById('navUserAvatar');
                  if (navAvatar) navAvatar.src = newSrc;
                }
              } else {
                status.textContent = json.message || 'Gagal mengupload.';
                status.className = 'text-xs text-red-600 font-bold';
              }
            } catch (err) {
              status.textContent = 'Gagal koneksi ke server.';
              status.className = 'text-xs text-red-600 font-bold';
            }
          });
        </script>
      </div>
    </div>

  </main>

  <!-- Footer Mini -->
  <footer class="py-4 text-center text-xs text-slate-400 border-t border-slate-200 bg-white">
    <span>Redesain | © 2026 Badan Gizi Nasional Republik Indonesia. Dilengkapi BGN Shield Anti-Exploit.</span>
  </footer>

  <script src="../../assets/js/security.js"></script>
  <script src="../../assets/js/live_chat.js"></script>
</body>
</html>
