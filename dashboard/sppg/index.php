<?php
/**
 * dashboard-sppg.php - Portal Satuan Pelayanan Pemenuhan Gizi (Dapur SPPG)
 * Radar MBG - Badan Gizi Nasional
 */

require_once __DIR__ . '/../../database/auth.php';
require_once __DIR__ . '/../../database/security.php';

// Inspeksi input request
Security::inspectRequest(true);

// Wajib role 'sppg' atau 'admin'
Auth::requireRole(['sppg', 'admin']);
$currentUser = Auth::user();

$pdo = getDB();
$sppgName = $currentUser['sppg_name'] ?? 'SPPG Kebayoran Baru 03';

// Handle Tambah / Input Menu Masakan Baru
$successMsg = '';
$errorMsg   = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'add_menu') {
    $menuTitle  = Security::cleanInput($_POST['menu_title'] ?? '', 180);
    $schoolTgt  = Security::cleanInput($_POST['school_target'] ?? '', 180);
    $city       = Security::cleanInput($_POST['city'] ?? '', 80);
    $menuDate   = Security::cleanInput($_POST['menu_date'] ?? '', 10);
    $calories   = (int)($_POST['calories'] ?? 620);
    $temp       = (float)($_POST['temperature'] ?? 65.0);
    $portion    = (int)($_POST['portion_count'] ?? 500);
    $dietitian  = Security::cleanInput($_POST['dietitian'] ?? '', 120);
    $desc       = Security::cleanInput($_POST['description'] ?? '', 1000);

    if (empty($menuTitle) || empty($schoolTgt) || empty($menuDate)) {
        $errorMsg = 'Judul menu, nama sekolah sasaran, dan tanggal wajib diisi.';
    } else {
        try {
            $stmt = $pdo->prepare(
                'INSERT INTO menu_sppg 
                  (user_id, sppg_name, school_target, city, menu_date, menu_title, description, calories, temperature, portion_count, dietitian, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $stmt->execute([
                $currentUser['id'],
                $sppgName,
                $schoolTgt,
                $city ?: 'Jakarta Selatan',
                $menuDate,
                $menuTitle,
                $desc,
                $calories,
                $temp,
                $portion,
                $dietitian ?: 'dr. Andini Saraswati, Sp.GK',
                'terkirim'
            ]);
            $successMsg = 'Jadwal sajian menu baru berhasil disimpan dan dipublikasikan ke radar monitoring!';
        } catch (Throwable $e) {
            $errorMsg = 'Gagal menyimpan menu: ' . $e->getMessage();
        }
    }
}

// Action: Update Status Distribusi Menu SPPG
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'update_menu_status') {
    $menuId = (int)($_POST['menu_id'] ?? 0);
    $status = Security::cleanInput($_POST['status'] ?? 'terkirim', 20);
    $validStatus = ['persiapan', 'dikirim', 'terkirim', 'evaluasi'];

    if ($menuId > 0 && in_array($status, $validStatus, true)) {
        try {
            $stmt = $pdo->prepare('UPDATE menu_sppg SET status = ? WHERE id = ?');
            $stmt->execute([$status, $menuId]);
            $successMsg = "Status menu #$menuId berhasil diperbarui ke: $status";
        } catch (Throwable $e) {
            $errorMsg = 'Gagal memperbarui status: ' . $e->getMessage();
        }
    }
}

// Action: Ganti Password SPPG
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

// Ambil riwayat menu masakan SPPG
$menuList = [];
try {
    $stmt = $pdo->prepare('SELECT * FROM menu_sppg WHERE sppg_name = ? ORDER BY menu_date DESC LIMIT 20');
    $stmt->execute([$sppgName]);
    $menuList = $stmt->fetchAll();
    
    if (empty($menuList)) {
        $menuList = $pdo->query('SELECT * FROM menu_sppg ORDER BY menu_date DESC LIMIT 20')->fetchAll();
    }
} catch (Throwable $e) {}

// Ambil aduan yang menargetkan sekolah dari wilayah SPPG ini
$complaints = [];
try {
    $complaints = $pdo->query(
        'SELECT ticket_code, reporter_name, school_target, issue_category, status, incident_date, description
         FROM laporan_aduan
         WHERE status IN (\'masuk\', \'verifikasi\', \'proses\')
         ORDER BY created_at DESC LIMIT 5'
    )->fetchAll();
} catch (Throwable $e) {}

// Avatar SPPG
$sppgAvatarRow = $pdo->prepare('SELECT avatar_url, avatar_pending_url, avatar_status FROM users WHERE id = ?');
$sppgAvatarRow->execute([(int)$currentUser['id']]);
$sppgAvatarData = $sppgAvatarRow->fetch() ?: ['avatar_url' => null, 'avatar_pending_url' => null, 'avatar_status' => 'approved'];
$sppgAvatar = $sppgAvatarData['avatar_url'] ?: '../../assets/images/logo.webp';
$sppgAvatarStatus = $sppgAvatarData['avatar_status'] ?? 'approved';
?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8"/>
  <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
  <title>Dashboard Mitra Dapur SPPG - Radar MBG</title>
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
  <header class="w-full bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 px-6 sm:px-12 py-3.5 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <img src="../../assets/images/logo.webp" alt="Logo BGN" class="h-9 w-auto">
      <div>
        <div class="flex items-center gap-2">
          <span class="font-bold text-base text-primary">Portal Mitra SPPG</span>
          <span class="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold uppercase">Role: Dapur SPPG</span>
        </div>
        <p class="text-xs text-slate-500 font-medium">Unit: <strong><?= Security::cleanOutput($sppgName) ?></strong></p>
      </div>
    </div>

    <div class="flex items-center gap-3">
      <a href="../../distribusi-sebaran-sppg.html" class="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-colors">
        <span class="material-symbols-outlined text-sm">map</span>
        <span>Lihat Peta Spasial</span>
      </a>
      <a href="../../login.php?action=logout" class="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-xs font-semibold text-red-600 transition-colors">
        <span class="material-symbols-outlined text-sm">logout</span>
        <span>Keluar</span>
      </a>
    </div>
  </header>

  <!-- Main Content -->
  <main class="max-w-7xl mx-auto w-full p-4 sm:p-8 flex-grow">

    <!-- Alert Banner -->
    <?php if ($successMsg): ?>
      <div class="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-sm">
        <span class="material-symbols-outlined text-emerald-600">check_circle</span>
        <span><?= Security::cleanOutput($successMsg) ?></span>
      </div>
    <?php endif; ?>

    <?php if ($errorMsg): ?>
      <div class="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2 shadow-sm">
        <span class="material-symbols-outlined text-red-600">error</span>
        <span><?= Security::cleanOutput($errorMsg) ?></span>
      </div>
    <?php endif; ?>

    <!-- Banner Profil Dapur -->
    <div class="bg-gradient-to-r from-[#0b2545] via-[#134074] to-secondary rounded-3xl p-6 sm:p-8 text-white mb-8 shadow-xl relative overflow-hidden">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span class="px-2.5 py-0.5 rounded-full bg-emerald-400 text-primary text-xs font-bold uppercase">Terverifikasi SLHS Grade A</span>
          <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight mt-2"><?= Security::cleanOutput($sppgName) ?></h1>
          <p class="text-xs text-slate-300 mt-1 max-w-xl">
            Pusat produksi higienis program Makan Bergizi Gratis (MBG). Bertanggung jawab memastikan batas suhu aman termal (&gt;60°C) saat tiba di sekolah binaan.
          </p>
        </div>
        <div class="text-right sm:border-l border-white/20 sm:pl-6 shrink-0">
          <span class="text-xs text-slate-300 block">Suhu Termal Rata-rata</span>
          <span class="text-3xl font-black text-[#6ffbbe]">68.4°C</span>
          <span class="text-[11px] text-emerald-300 block font-semibold">Hot Chain Optimal</span>
        </div>
      </div>
    </div>

    <!-- Grid: Form Input Menu (Kiri) & Laporan Wilayah (Kanan) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
      
      <!-- Form Input Menu Harian (7 Cols) -->
      <div class="lg:col-span-7 bg-surface-card p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-sm">
        <div class="flex items-center gap-3 pb-4 mb-5 border-b border-slate-100">
          <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <span class="material-symbols-outlined text-2xl">restaurant_menu</span>
          </div>
          <div>
            <h2 class="text-base font-bold text-primary">Input & Perbarui Sajian Menu Harian</h2>
            <p class="text-xs text-slate-500">Data ini langsung disinkronkan ke halaman Menu Hari Ini & AKG.</p>
          </div>
        </div>

        <form action="index.php" method="POST" class="space-y-4">
          <input type="hidden" name="action" value="add_menu">

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Sekolah Sasaran Binaan</label>
              <input type="text" name="school_target" required placeholder="Contoh: SDN 01 Senayan"
                     class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Kota / Wilayah</label>
              <input type="text" name="city" required value="Jakarta Selatan"
                     class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all">
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Nama Paket Menu</label>
              <input type="text" name="menu_title" required placeholder="Ayam Panggang Madu & Tempe Bacem"
                     class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Tanggal Distribusi</label>
              <input type="date" name="menu_date" required value="<?= date('Y-m-d') ?>"
                     class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all">
            </div>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-[11px] font-bold text-slate-700 uppercase mb-1">Total Kalori</label>
              <input type="number" name="calories" value="620"
                     class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600">
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-700 uppercase mb-1">Suhu Wadah (°C)</label>
              <input type="number" step="0.1" name="temperature" value="67.5"
                     class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600">
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-700 uppercase mb-1">Kapasitas Porsi</label>
              <input type="number" name="portion_count" value="500"
                     class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600">
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Ahli Gizi / Dietisien Bertugas</label>
            <input type="text" name="dietitian" value="dr. Andini Saraswati, Sp.GK"
                   class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all">
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Deskripsi & Catatan Kandungan</label>
            <textarea name="description" rows="2" placeholder="Komposisi bahan lokal, tanpa pengawet buatan..."
                      class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"></textarea>
          </div>

          <button type="submit" 
                  class="w-full py-3 px-4 rounded-xl bg-primary hover:bg-primary-container text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2">
            <span class="material-symbols-outlined text-sm">cloud_upload</span>
            <span>Simpan & Terbitkan Jadwal Menu</span>
          </button>
        </form>
      </div>

      <!-- Kotak Peringatan & Aduan Terkini Wilayah (5 Cols) -->
      <div class="lg:col-span-5 flex flex-col gap-6">
        
        <!-- Peringatan SLA Suhu -->
        <div class="bg-amber-50 border border-amber-200 rounded-3xl p-6">
          <div class="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase mb-2">
            <span class="material-symbols-outlined text-amber-600 text-lg">warning</span>
            <span>Standar Wajib BGN Hot Chain</span>
          </div>
          <p class="text-xs text-amber-900 leading-relaxed">
            Suhu makanan saat dimasukkan ke dalam insulated food box van termal minimal <strong>65°C</strong> dan tidak boleh turun di bawah <strong>60°C</strong> saat diterima pihak sekolah.
          </p>
        </div>

        <!-- Daftar Laporan Wilayah -->
        <div class="bg-surface-card p-6 rounded-3xl border border-slate-200/80 shadow-sm flex-grow">
          <h3 class="text-sm font-bold text-primary mb-3 flex items-center justify-between">
            <span>Aduan Wilayah Menunggu Respon</span>
            <span class="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold"><?= count($complaints) ?></span>
          </h3>

          <div class="space-y-3">
            <?php if (empty($complaints)): ?>
              <p class="text-xs text-slate-400 py-4 text-center">Tidak ada aduan aktif di wilayah ini. Layanan prima!</p>
            <?php else: ?>
              <?php foreach ($complaints as $c): ?>
                <div class="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div class="flex justify-between items-center mb-1">
                    <span class="font-mono font-bold text-primary"><?= Security::cleanOutput($c['ticket_code']) ?></span>
                    <span class="px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 text-[9px] font-bold uppercase"><?= Security::cleanOutput($c['status']) ?></span>
                  </div>
                  <strong class="text-slate-800 block"><?= Security::cleanOutput($c['school_target']) ?></strong>
                  <p class="text-slate-500 text-[11px] line-clamp-2 mt-0.5"><?= Security::cleanOutput($c['description']) ?></p>
                </div>
              <?php endforeach; ?>
            <?php endif; ?>
          </div>
        </div>

      </div>

    </div>

    <!-- Riwayat Menu Dapur Terdaftar -->
    <div class="bg-surface-card rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div class="p-6 border-b border-slate-100 flex items-center justify-between">
        <h2 class="text-base font-bold text-primary">Riwayat Menu Masakan yang Pernah Diterbitkan</h2>
        <span class="text-xs text-slate-400">Total <?= count($menuList) ?> Rekaman</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
              <th class="py-3 px-4">Tanggal</th>
              <th class="py-3 px-4">Sekolah Sasaran</th>
              <th class="py-3 px-4">Nama Menu</th>
              <th class="py-3 px-4">Kalori</th>
              <th class="py-3 px-4">Suhu Tercatat</th>
              <th class="py-3 px-4">Porsi</th>
              <th class="py-3 px-4">Dietisien</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 font-medium">
            <?php if (empty($menuList)): ?>
              <tr><td colspan="7" class="py-6 text-center text-slate-400">Belum ada menu yang diinput. Gunakan form di atas.</td></tr>
            <?php else: ?>
              <?php foreach ($menuList as $m): ?>
                <tr class="hover:bg-slate-50">
                  <td class="py-3 px-4 text-slate-500 whitespace-nowrap"><?= Security::cleanOutput($m['menu_date']) ?></td>
                  <td class="py-3 px-4 font-bold text-primary"><?= Security::cleanOutput($m['school_target']) ?></td>
                  <td class="py-3 px-4 text-slate-700"><?= Security::cleanOutput($m['menu_title']) ?></td>
                  <td class="py-3 px-4 text-slate-600"><?= (int)$m['calories'] ?> kkal</td>
                  <td class="py-3 px-4 font-bold text-emerald-600"><?= Security::cleanOutput($m['temperature']) ?>°C</td>
                  <td class="py-3 px-4 text-slate-600"><?= (int)$m['portion_count'] ?> porsi</td>
                  <td class="py-3 px-4 text-slate-500"><?= Security::cleanOutput($m['dietitian']) ?></td>
                </tr>
              <?php endforeach; ?>
            <?php endif; ?>
          </tbody>
        </table>
      </div>
    </div>

    <!-- PENGATURAN AKUN SPPG -->
    <div id="ganti-password" class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <!-- Ganti Kata Sandi SPPG -->
      <div id="pengaturan-profil" class="bg-surface-card rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
        <div class="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
          <div class="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <span class="material-symbols-outlined text-2xl">key</span>
          </div>
          <div>
            <h2 class="text-lg font-bold text-primary">Ganti Kata Sandi Dapur SPPG</h2>
            <p class="text-xs text-slate-500">Perbarui kata sandi akun SPPG Anda.</p>
          </div>
        </div>
        <form action="index.php" method="POST" class="flex flex-col gap-4">
          <input type="hidden" name="action" value="change_password">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Kata Sandi Lama</label>
            <input type="password" name="old_password" required class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none" placeholder="Masukkan kata sandi saat ini">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Kata Sandi Baru</label>
            <input type="password" name="new_password" required minlength="6" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none" placeholder="Minimal 6 karakter">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Konfirmasi Kata Sandi Baru</label>
            <input type="password" name="confirm_password" required minlength="6" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none" placeholder="Ulangi kata sandi baru">
          </div>
          <button type="submit" class="w-full py-2.5 rounded-xl bg-primary hover:bg-primary-container text-white font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2">
            <span class="material-symbols-outlined text-base">lock_reset</span>
            <span>Perbarui Kata Sandi</span>
          </button>
        </form>
      </div>

      <!-- Upload Logo / Foto Profil SPPG (wajib konfirmasi admin) -->
      <div class="bg-surface-card rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
        <div class="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
          <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <span class="material-symbols-outlined text-2xl">storefront</span>
          </div>
          <div>
            <h2 class="text-lg font-bold text-primary">Logo / Foto Profil Dapur SPPG</h2>
            <p class="text-xs text-slate-500">Upload logo baru (JPG/PNG/WEBP, maks 5 MB). <span class="font-bold text-amber-600">Wajib konfirmasi Satgas BGN.</span></p>
          </div>
        </div>
        <div class="flex flex-col items-center gap-4">
          <img id="sppgAvatarPreview" src="<?= Security::cleanOutput($sppgAvatar) ?>" alt="Logo SPPG" class="w-24 h-24 rounded-2xl object-cover border-2 border-slate-200 shadow-sm bg-white" onerror="this.src='../../assets/images/logo.webp'">
          <?php if ($sppgAvatarStatus === 'pending_approval'): ?>
            <span class="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold animate-pulse flex items-center gap-1">
              <span class="material-symbols-outlined text-sm">hourglass_top</span>
              Menunggu Konfirmasi Satgas BGN
            </span>
          <?php elseif ($sppgAvatarStatus === 'rejected'): ?>
            <span class="px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold flex items-center gap-1">
              <span class="material-symbols-outlined text-sm">cancel</span>
              Logo Terakhir Ditolak. Silakan upload ulang.
            </span>
          <?php else: ?>
            <span class="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center gap-1">
              <span class="material-symbols-outlined text-sm">verified</span>
              Terverifikasi
            </span>
          <?php endif; ?>
          <form id="formUploadSppgLogo" enctype="multipart/form-data" class="w-full flex flex-col gap-3">
            <input type="file" name="avatar" accept="image/jpeg,image/png,image/webp" required class="w-full text-xs file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-emerald-600 file:text-white file:font-bold file:text-xs file:cursor-pointer">
            <button type="submit" class="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2">
              <span class="material-symbols-outlined text-base">cloud_upload</span>
              <span>Kirim Logo untuk Verifikasi</span>
            </button>
          </form>
          <p id="sppgLogoUploadStatus" class="text-xs text-slate-500 hidden"></p>
        </div>
        <script>
          document.getElementById('formUploadSppgLogo')?.addEventListener('submit', async function(e) {
            e.preventDefault();
            const fd = new FormData(e.target);
            const status = document.getElementById('sppgLogoUploadStatus');
            status.classList.remove('hidden');
            status.textContent = 'Mengupload...';
            status.className = 'text-xs text-blue-600';
            try {
              const res = await fetch('../../api/upload_avatar.php', { method: 'POST', body: fd, credentials: 'include' });
              const json = await res.json();
              if (json.status === 'success') {
                status.textContent = 'Logo berhasil dikirim! Menunggu konfirmasi Satgas BGN.';
                status.className = 'text-xs text-emerald-600 font-bold';
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

