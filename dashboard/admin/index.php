<?php
/**
 * dashboard/admin/index.php - Pusat Komando & Pengawasan Satgas Nasional BGN
 * Radar MBG - Badan Gizi Nasional
 */

require_once __DIR__ . '/../../database/auth.php';
require_once __DIR__ . '/../../database/security.php';

Security::inspectRequest(true);

Auth::requireRole('admin');
$currentUser = Auth::user();

$pdo = getDB();

$actionMsg = '';
$actionErr = '';

// 1. Action: Update Status Aduan oleh Satgas
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'update_status') {
    $lapId     = (int)($_POST['laporan_id'] ?? 0);
    $newStatus = Security::cleanInput($_POST['status'] ?? '', 20);
    $priority  = Security::cleanInput($_POST['priority'] ?? '', 10);
    $notes     = Security::cleanInput($_POST['satgas_notes'] ?? '', 1000);

    $validStatus = ['masuk', 'verifikasi', 'proses', 'selesai', 'ditolak'];
    $validPrio   = ['rendah', 'sedang', 'tinggi', 'kritis'];

    if ($lapId > 0 && in_array($newStatus, $validStatus, true)) {
        try {
            $curr = $pdo->prepare('SELECT status FROM laporan_aduan WHERE id = ?');
            $curr->execute([$lapId]);
            $oldStatus = $curr->fetchColumn();

            $stmt = $pdo->prepare(
                'UPDATE laporan_aduan 
                 SET status = ?, priority = ?, satgas_notes = ?, updated_at = NOW() 
                 WHERE id = ?'
            );
            $stmt->execute([$newStatus, in_array($priority, $validPrio) ? $priority : 'sedang', $notes, $lapId]);

            $pdo->prepare(
                'INSERT INTO aduan_log (laporan_id, old_status, new_status, changed_by, notes)
                 VALUES (?, ?, ?, ?, ?)'
            )->execute([$lapId, $oldStatus, $newStatus, $currentUser['username'], $notes ?: 'Status diperbarui oleh Admin Satgas']);

            $actionMsg = "Status tiket #$lapId berhasil diperbarui ke: $newStatus";
        } catch (Throwable $e) {
            $actionErr = 'Gagal memperbarui: ' . $e->getMessage();
        }
    }
}

// 2. Action: Update Telemetri Nasional (5 KPI Utama)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'update_telemetri') {
    $porsi   = (int)($_POST['porsi_tersalurkan'] ?? 4850210);
    $target  = (float)($_POST['persen_target'] ?? 99.2);
    $sppg    = (int)($_POST['sppg_aktif'] ?? 1284);
    $sekolah = (int)($_POST['sekolah_terlayani'] ?? 18420);
    $akg     = (float)($_POST['kepatuhan_akg'] ?? 99.6);
    $suhu    = (float)($_POST['suhu_rata_rata'] ?? 65.8);
    $sla     = (float)($_POST['sla_distribusi'] ?? 99.8);
    $teks    = Security::cleanInput($_POST['pembaruan_teks'] ?? 'Hari ini, Pukul 11.45 WIB', 100);

    try {
        $stmt = $pdo->prepare(
            'UPDATE telemetri_nasional 
             SET porsi_tersalurkan = ?, persen_target = ?, sppg_aktif = ?, sekolah_terlayani = ?,
                 kepatuhan_akg = ?, suhu_rata_rata = ?, sla_distribusi = ?, pembaruan_teks = ?, updated_at = NOW()
             WHERE id = (SELECT id FROM telemetri_nasional ORDER BY id DESC LIMIT 1)'
        );
        $stmt->execute([$porsi, $target, $sppg, $sekolah, $akg, $suhu, $sla, $teks]);
        $actionMsg = 'Data Telemetri Nasional berhasil diperbarui secara live di database!';
    } catch (Throwable $e) {
        $actionErr = 'Gagal memperbarui telemetri: ' . $e->getMessage();
    }
}

// 3. Action: Tambah / Edit Distribusi Provinsi
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'save_provinsi') {
    $provinsi  = Security::cleanInput($_POST['provinsi'] ?? '', 100);
    $targetP   = (int)($_POST['target_porsi'] ?? 100000);
    $ketepatan = (float)($_POST['ketepatan'] ?? 99.0);
    $statusP   = Security::cleanInput($_POST['status'] ?? 'Selesai Salur', 50);
    $regCode   = Security::cleanInput($_POST['region_code'] ?? 'jawa', 30);

    if (!empty($provinsi)) {
        try {
            $stmt = $pdo->prepare(
                'INSERT INTO distribusi_provinsi (provinsi, target_porsi, ketepatan, status, region_code, updated_at)
                 VALUES (?, ?, ?, ?, ?, NOW())
                 ON CONFLICT (provinsi) DO UPDATE SET
                    target_porsi = EXCLUDED.target_porsi,
                    ketepatan = EXCLUDED.ketepatan,
                    status = EXCLUDED.status,
                    region_code = EXCLUDED.region_code,
                    updated_at = NOW()'
            );
            $stmt->execute([$provinsi, $targetP, $ketepatan, $statusP, $regCode]);
            $actionMsg = "Data distribusi provinsi '$provinsi' berhasil disimpan ke database!";
        } catch (Throwable $e) {
            $actionErr = 'Gagal menyimpan provinsi: ' . $e->getMessage();
        }
    }
}

// 4. Action: Tambah Akun Pengguna Baru
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'create_user') {
    $newUsername = Security::cleanInput($_POST['username'] ?? '', 50);
    $newEmail    = Security::cleanInput($_POST['email'] ?? '', 100);
    $newPass     = $_POST['password'] ?? '';
    $newRole     = Security::cleanInput($_POST['role'] ?? 'user', 20);
    $newFullName = Security::cleanInput($_POST['full_name'] ?? '', 120);
    $newSppg     = Security::cleanInput($_POST['sppg_name'] ?? '', 150);

    $validRoles = ['admin', 'sppg', 'user'];
    if (!empty($newUsername) && !empty($newEmail) && !empty($newPass) && in_array($newRole, $validRoles, true)) {
        try {
            $hash = password_hash($newPass, PASSWORD_BCRYPT);
            $stmt = $pdo->prepare(
                'INSERT INTO users (username, email, password_hash, full_name, role, sppg_name, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, TRUE)'
            );
            $stmt->execute([$newUsername, $newEmail, $hash, $newFullName, $newRole, $newRole === 'sppg' ? $newSppg : null]);
            $actionMsg = "Akun baru '$newUsername' (Role: $newRole) berhasil didaftarkan!";
        } catch (Throwable $e) {
            $actionErr = 'Gagal mendaftarkan akun: ' . $e->getMessage();
        }
    } else {
        $actionErr = 'Semua field akun (Username, Email, Password, Role) wajib diisi.';
    }
}

// 5. Action: Bersihkan Log Eksploitasi
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'clear_exploit_logs') {
    try {
        $pdo->exec('TRUNCATE TABLE exploit_logs RESTART IDENTITY');
        $actionMsg = 'Seluruh log eksploitasi keamanan telah dibersihkan.';
    } catch (Throwable $e) {
        $actionErr = 'Gagal membersihkan log: ' . $e->getMessage();
    }
}

// 6. Action: Database Maintenance (VACUUM ANALYZE)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'vacuum_db') {
    try {
        $pdo->exec('VACUUM ANALYZE');
        $actionMsg = 'Optimasi PostgreSQL VACUUM ANALYZE berhasil dijalankan. Indeks dan statistik tabel telah disegarkan.';
    } catch (Throwable $e) {
        $actionErr = 'Gagal menjalankan pemeliharaan basis data: ' . $e->getMessage();
    }
}

// 7. Action: Bersihkan Cache Aplikasi
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'clear_cache') {
    if (function_exists('opcache_reset')) {
        @opcache_reset();
    }
    $actionMsg = 'Cache Opcode PHP dan buffer memori aplikasi berhasil dibersihkan.';
}

// 8. Action: Ganti Password Admin
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'change_password') {
    $oldPass = $_POST['old_password'] ?? '';
    $newPass = $_POST['new_password'] ?? '';
    $cfmPass = $_POST['confirm_password'] ?? '';

    if (strlen($newPass) < 6) {
        $actionErr = 'Password baru minimal 6 karakter.';
    } elseif ($newPass !== $cfmPass) {
        $actionErr = 'Konfirmasi password baru tidak cocok.';
    } else {
        $stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = ?');
        $stmt->execute([(int)$currentUser['id']]);
        $currentHash = $stmt->fetchColumn();

        if (!$currentHash || !password_verify($oldPass, $currentHash)) {
            $actionErr = 'Kata sandi lama yang Anda masukkan salah.';
        } else {
            $newHash = password_hash($newPass, PASSWORD_BCRYPT);
            $upd = $pdo->prepare('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?');
            $upd->execute([$newHash, (int)$currentUser['id']]);
            $actionMsg = 'Kata sandi Administrator berhasil diperbarui!';
        }
    }
}

// 9. Action: Konfirmasi / Tolak Logo SPPG
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && in_array($_POST['action'], ['approve_sppg_logo', 'reject_sppg_logo'], true)) {
    $sppgUserId = (int)($_POST['user_id'] ?? 0);
    if ($sppgUserId > 0) {
        if ($_POST['action'] === 'approve_sppg_logo') {
            $stmt = $pdo->prepare('SELECT avatar_pending_url FROM users WHERE id = ? AND role = ?');
            $stmt->execute([$sppgUserId, 'sppg']);
            $pendingUrl = $stmt->fetchColumn();
            if ($pendingUrl) {
                $upd = $pdo->prepare("UPDATE users SET avatar_url = ?, avatar_pending_url = NULL, avatar_status = 'approved', updated_at = NOW() WHERE id = ?");
                $upd->execute([$pendingUrl, $sppgUserId]);
                $actionMsg = 'Logo SPPG berhasil disetujui (dikonfirmasi) dan langsung aktif!';
            }
        } else {
            $upd = $pdo->prepare("UPDATE users SET avatar_pending_url = NULL, avatar_status = 'rejected', updated_at = NOW() WHERE id = ?");
            $upd->execute([$sppgUserId]);
            $actionMsg = 'Permohonan logo SPPG berhasil ditolak.';
        }
    }
}

// ── Ambil Data Database ──────────────────────────────────────────
$totalAduan   = (int)$pdo->query('SELECT COUNT(*) FROM laporan_aduan')->fetchColumn();
$masukAduan   = (int)$pdo->query("SELECT COUNT(*) FROM laporan_aduan WHERE status='masuk'")->fetchColumn();
$prosesAduan  = (int)$pdo->query("SELECT COUNT(*) FROM laporan_aduan WHERE status IN ('verifikasi', 'proses')")->fetchColumn();
$selesaiAduan = (int)$pdo->query("SELECT COUNT(*) FROM laporan_aduan WHERE status='selesai'")->fetchColumn();

// Data Telemetri Terkini
$telRow = $pdo->query('SELECT * FROM telemetri_nasional ORDER BY id DESC LIMIT 1')->fetch();
if (!$telRow) {
    $telRow = [
        'porsi_tersalurkan' => 4850210, 'persen_target' => 99.20, 'sppg_aktif' => 1284,
        'sekolah_terlayani' => 18420, 'kepatuhan_akg' => 99.60, 'suhu_rata_rata' => 65.8,
        'sla_distribusi' => 99.80, 'pembaruan_teks' => 'Hari ini, Pukul 11.45 WIB'
    ];
}

// Data Distribusi Provinsi
$provinsiList = $pdo->query('SELECT * FROM distribusi_provinsi ORDER BY target_porsi DESC')->fetchAll();

// Data Pengguna
$userList = $pdo->query('SELECT id, username, email, full_name, role, sppg_name, is_active, avatar_url, avatar_pending_url, avatar_status, created_at FROM users ORDER BY id ASC')->fetchAll();

// Daftar Logo SPPG yang Menunggu Persetujuan Satgas
$pendingSppgLogos = $pdo->query("SELECT id, username, full_name, sppg_name, avatar_pending_url, updated_at FROM users WHERE role = 'sppg' AND avatar_status = 'pending_approval' AND avatar_pending_url IS NOT NULL")->fetchAll();

// Ambil profil admin saat ini
$adminAvatarRow = $pdo->prepare('SELECT avatar_url FROM users WHERE id = ?');
$adminAvatarRow->execute([(int)$currentUser['id']]);
$rawAvatar = $adminAvatarRow->fetchColumn();
if ($rawAvatar && !str_starts_with($rawAvatar, 'http') && !str_starts_with($rawAvatar, 'data:')) {
    $adminAvatar = str_starts_with($rawAvatar, '../../') ? $rawAvatar : '../../' . ltrim($rawAvatar, '/');
} else {
    $adminAvatar = $rawAvatar ?: '../../assets/images/logo.webp';
}


// Data Laporan Aduan
$laporanList = $pdo->query(
    'SELECT id, ticket_code, reporter_name, reporter_phone, reporter_role, issue_category,
            school_target, incident_date, status, priority, description, satgas_notes, created_at
     FROM laporan_aduan
     ORDER BY created_at DESC
     LIMIT 50'
)->fetchAll();

// Log Eksploitasi Keamanan (WAF)
$exploitLogs = [];
try {
    $exploitLogs = $pdo->query(
        'SELECT id, ip_address, user_agent, exploit_type, input_field, payload_sample, requested_url, created_at
         FROM exploit_logs
         ORDER BY created_at DESC
         LIMIT 15'
    )->fetchAll();
} catch (Throwable $e) {}

// Statistik Pemeliharaan & Kesehatan Basis Data (Neon PostgreSQL)
$dbSize = 'N/A';
$pgVersion = 'PostgreSQL';
$totalMbg = 0;
$mbgStats = ['total_units' => 0, 'total_beneficiaries' => 0, 'total_allergies' => 0, 'total_special' => 0];
$levelStats = [];
try {
    $dbSize = $pdo->query("SELECT pg_size_pretty(pg_database_size(current_database()))")->fetchColumn() ?: 'N/A';
    $pgVersion = $pdo->query("SHOW server_version")->fetchColumn() ?: 'PostgreSQL 16';
    $totalMbg = (int)$pdo->query("SELECT COUNT(*) FROM data_penerima_mbg")->fetchColumn();
    $mbgStats = $pdo->query("
        SELECT 
            COALESCE(SUM(education_units), 0) as total_units,
            COALESCE(SUM(beneficiaries), 0) as total_beneficiaries,
            COALESCE(SUM(allergies), 0) as total_allergies,
            COALESCE(SUM(special_conditions), 0) as total_special
        FROM data_penerima_mbg
    ")->fetch() ?: $mbgStats;

    $levelStats = $pdo->query("
        SELECT level, COUNT(*) as rows,
               COALESCE(SUM(education_units), 0) as units,
               COALESCE(SUM(beneficiaries), 0) as beneficiaries,
               COALESCE(SUM(allergies), 0) as allergies,
               COALESCE(SUM(special_conditions), 0) as special_conditions
        FROM data_penerima_mbg
        GROUP BY level
        ORDER BY beneficiaries DESC
    ")->fetchAll(PDO::FETCH_ASSOC);
} catch (Throwable $e) {}

// Statistik Baris Seluruh Tabel
$tableStats = [
    'data_penerima_mbg'    => $totalMbg,
    'dokumen_juknis'       => (int)($pdo->query("SELECT COUNT(*) FROM dokumen_juknis")->fetchColumn() ?: 0),
    'telemetri_nasional'   => (int)($pdo->query("SELECT COUNT(*) FROM telemetri_nasional")->fetchColumn() ?: 0),
    'distribusi_provinsi'  => (int)($pdo->query("SELECT COUNT(*) FROM distribusi_provinsi")->fetchColumn() ?: 0),
    'users'                => (int)($pdo->query("SELECT COUNT(*) FROM users")->fetchColumn() ?: 0),
    'laporan_aduan'        => $totalAduan,
    'menu_sppg'            => (int)($pdo->query("SELECT COUNT(*) FROM menu_sppg")->fetchColumn() ?: 0),
    'exploit_logs'         => (int)($pdo->query("SELECT COUNT(*) FROM exploit_logs")->fetchColumn() ?: 0),
];

// Sample 15 Data Penerima MBG untuk pratinjau tabel di panel admin
$sampleMbg = [];
try {
    $sampleMbg = $pdo->query("
        SELECT id, level, regency_name, education_units, beneficiaries, allergies, special_conditions 
        FROM data_penerima_mbg 
        WHERE regency_name IS NOT NULL
        ORDER BY beneficiaries DESC 
        LIMIT 15
    ")->fetchAll();
} catch (Throwable $e) {}

// ── KPI Nasional dari DB (Sekolah, Porsi, Kepatuhan AKG, SPPG Aktif) ──────────
// Ambil dari telemetri_nasional (sudah ada di $telRow di atas)
// Tambahan: hitung langsung dari menu_sppg untuk data lebih akurat
$kpiSekolah   = (int)($telRow['sekolah_terlayani'] ?? 18420);
$kpiPorsi     = (int)($telRow['porsi_tersalurkan'] ?? 4850210);
$kpiAkg       = (float)($telRow['kepatuhan_akg'] ?? 99.6);
$kpiSppg      = (int)($telRow['sppg_aktif'] ?? 1284);
$kpiSla       = (float)($telRow['sla_distribusi'] ?? 99.8);
$kpiSuhu      = (float)($telRow['suhu_rata_rata'] ?? 65.8);

// Hitung total sekolah unik dan total porsi dari menu_sppg (live data)
try {
    $menuKpi = $pdo->query("
        SELECT 
            COUNT(DISTINCT school_key) AS sekolah_unik,
            COALESCE(SUM(portion_count), 0) AS total_porsi,
            COALESCE(AVG(temperature), 65.0) AS avg_suhu,
            COUNT(DISTINCT sppg_name) AS total_sppg
        FROM menu_sppg
        WHERE status IN ('terkirim','dikirim')
    ")->fetch();
    if ($menuKpi && $menuKpi['sekolah_unik'] > 0) {
        // Gunakan data live jika ada, kalau tidak fallback ke telemetri
        $kpiSekolahLive = (int)$menuKpi['sekolah_unik'];
        $kpiPorsiLive   = (int)$menuKpi['total_porsi'];
        $kpiSppgLive    = (int)$menuKpi['total_sppg'];
    }
} catch (Throwable $e) {}

// Format angka rapi untuk display
function fmtAngka(int $n): string {
    if ($n >= 1_000_000) return number_format($n / 1_000_000, 1, '.', '') . 'Jt';
    if ($n >= 1_000)     return number_format($n / 1_000, 1, '.', '') . 'Rb';
    return (string)$n;
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8"/>
  <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
  <title>Pusat Komando & Pengawasan Nasional (Admin Satgas) - Radar MBG</title>
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

  <!-- Top Navigation Bar -->
  <header class="w-full bg-primary text-white sticky top-0 z-40 px-6 sm:px-12 py-4 flex items-center justify-between shadow-md">
    <div class="flex items-center gap-3">
      <img src="../../assets/images/logo.webp" alt="Logo BGN" class="h-10 w-auto">
      <div>
        <div class="flex items-center gap-2">
          <span class="font-extrabold text-base tracking-tight">Pusat Komando Satgas MBG</span>
          <span class="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-bold uppercase tracking-wider border border-red-500/30">Superadmin</span>
        </div>
        <p class="text-xs text-slate-300 font-medium">Badan Gizi Nasional Republik Indonesia</p>
      </div>
    </div>

    <div class="flex items-center gap-3">
      <!-- Admin Notification Bell with live count -->
      <a href="#pengaduan-publik" title="<?= $masukAduan ?> Aduan Masuk" class="relative p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all flex items-center justify-center">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
        <?php if ($masukAduan > 0 || count($pendingSppgLogos) > 0): ?>
          <span class="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[10px] font-black border border-primary animate-pulse">
            <?= $masukAduan + count($pendingSppgLogos) ?>
          </span>
        <?php endif; ?>
      </a>

      <a href="#ganti-password" class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-all">
        <img src="<?= Security::cleanOutput($adminAvatar) ?>" alt="Admin" class="w-6 h-6 rounded-full object-cover bg-white/20" onerror="this.src='../../assets/images/logo.webp'">
        <span class="hidden sm:inline"><?= Security::cleanOutput($currentUser['full_name'] ?? 'Admin') ?></span>
      </a>

      <a href="../../index.html" class="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-all">
        <span class="material-symbols-outlined text-sm">visibility</span>
        <span>Lihat Web Publik</span>
      </a>
      <a href="../../login.php?action=logout" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white transition-all shadow-sm">
        <span class="material-symbols-outlined text-sm">logout</span>
        <span>Keluar</span>
      </a>
    </div>
  </header>

  <!-- Main Command Center -->
  <main class="max-w-7xl mx-auto w-full p-4 sm:p-8 flex-grow">

    <!-- Flash message -->
    <?php if ($actionMsg): ?>
      <div class="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-sm">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-emerald-600">check_circle</span>
          <span><?= Security::cleanOutput($actionMsg) ?></span>
        </div>
      </div>
    <?php endif; ?>

    <?php if ($actionErr): ?>
      <div class="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2 shadow-sm">
        <span class="material-symbols-outlined text-red-600">error</span>
        <span><?= Security::cleanOutput($actionErr) ?></span>
      </div>
    <?php endif; ?>

    <!-- ═══════════════════════════════════════════════
         KPI NASIONAL — 4 Indikator Utama Radar MBG
         Data langsung dari database telemetri_nasional
         ═══════════════════════════════════════════════ -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">

      <!-- Card 1: Sekolah Terlayani -->
      <div class="relative bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl p-6 text-white shadow-xl overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
        <div class="absolute -right-4 -top-4 w-28 h-28 rounded-full bg-white/10 group-hover:bg-white/15 transition-all"></div>
        <div class="absolute -right-1 -bottom-6 w-20 h-20 rounded-full bg-white/5"></div>
        <div class="relative">
          <div class="flex items-center justify-between mb-3">
            <div class="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <span class="material-symbols-outlined text-2xl text-white">school</span>
            </div>
            <span class="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 text-[11px] font-bold">
              <span class="material-symbols-outlined text-[13px]">arrow_upward</span>
              <?= number_format($kpiSla, 1) ?>% Target
            </span>
          </div>
          <p class="text-blue-100 text-xs font-semibold uppercase tracking-wider mb-1">Sekolah Terlayani</p>
          <h2 class="text-3xl sm:text-4xl font-black tracking-tight">
            <?= number_format($kpiSekolah) ?>
            <span class="text-xl text-blue-200 font-bold">+</span>
          </h2>
          <p class="text-blue-200 text-[11px] mt-1 font-medium">
            dari target nasional BGN 2026
          </p>
        </div>
      </div>

      <!-- Card 2: Porsi Terdistribusi -->
      <div class="relative bg-gradient-to-br from-emerald-500 to-teal-700 rounded-3xl p-6 text-white shadow-xl overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
        <div class="absolute -right-4 -top-4 w-28 h-28 rounded-full bg-white/10 group-hover:bg-white/15 transition-all"></div>
        <div class="absolute -right-1 -bottom-6 w-20 h-20 rounded-full bg-white/5"></div>
        <div class="relative">
          <div class="flex items-center justify-between mb-3">
            <div class="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <span class="material-symbols-outlined text-2xl text-white">restaurant</span>
            </div>
            <span class="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 text-[11px] font-bold">
              <span class="material-symbols-outlined text-[13px]">schedule</span>
              Rata-rata <?= date('H:i') ?> WIB
            </span>
          </div>
          <p class="text-emerald-100 text-xs font-semibold uppercase tracking-wider mb-1">Porsi Terdistribusi</p>
          <h2 class="text-3xl sm:text-4xl font-black tracking-tight">
            <?= fmtAngka($kpiPorsi) ?>
            <span class="text-xl text-emerald-200 font-bold">+</span>
          </h2>
          <p class="text-emerald-200 text-[11px] mt-1 font-medium">
            porsi sajian MBG terverifikasi hari ini
          </p>
        </div>
      </div>

      <!-- Card 3: Kepatuhan Standar Gizi (AKG) -->
      <div class="relative bg-gradient-to-br from-violet-600 to-purple-800 rounded-3xl p-6 text-white shadow-xl overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
        <div class="absolute -right-4 -top-4 w-28 h-28 rounded-full bg-white/10 group-hover:bg-white/15 transition-all"></div>
        <div class="absolute -right-1 -bottom-6 w-20 h-20 rounded-full bg-white/5"></div>
        <div class="relative">
          <div class="flex items-center justify-between mb-3">
            <div class="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <span class="material-symbols-outlined text-2xl text-white">monitoring</span>
            </div>
            <span class="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 text-[11px] font-bold">
              <span class="material-symbols-outlined text-[13px]">check_circle</span>
              Memenuhi AKG
            </span>
          </div>
          <p class="text-violet-100 text-xs font-semibold uppercase tracking-wider mb-1">Kepatuhan Standar Gizi</p>
          <h2 class="text-3xl sm:text-4xl font-black tracking-tight">
            <?= number_format($kpiAkg, 1) ?>
            <span class="text-xl text-violet-200 font-bold">%</span>
          </h2>
          <p class="text-violet-200 text-[11px] mt-1 font-medium">
            Memenuhi standar AKG Kemenkes RI
          </p>
        </div>
      </div>

      <!-- Card 4: SPPG Aktif Siaga -->
      <div class="relative bg-gradient-to-br from-amber-500 to-orange-700 rounded-3xl p-6 text-white shadow-xl overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
        <div class="absolute -right-4 -top-4 w-28 h-28 rounded-full bg-white/10 group-hover:bg-white/15 transition-all"></div>
        <div class="absolute -right-1 -bottom-6 w-20 h-20 rounded-full bg-white/5"></div>
        <div class="relative">
          <div class="flex items-center justify-between mb-3">
            <div class="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <span class="material-symbols-outlined text-2xl text-white">kitchen</span>
            </div>
            <span class="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 text-[11px] font-bold">
              <span class="material-symbols-outlined text-[13px]">verified</span>
              100% SLHS
            </span>
          </div>
          <p class="text-amber-100 text-xs font-semibold uppercase tracking-wider mb-1">SPPG Aktif Siaga</p>
          <h2 class="text-3xl sm:text-4xl font-black tracking-tight">
            <?= number_format($kpiSppg) ?>
            <span class="text-xl text-amber-200 font-bold">+</span>
          </h2>
          <p class="text-amber-200 text-[11px] mt-1 font-medium">
            Dapur SPPG beroperasi &amp; bersertifikat SLHS
          </p>
        </div>
      </div>

    </div>

    <!-- Metrics Ringkas Aduan Publik -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <div class="bg-surface-card p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
        <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
          <span class="material-symbols-outlined text-slate-500 text-xl">inbox</span>
        </div>
        <div>
          <span class="text-[11px] text-slate-500 font-semibold uppercase block">Total Aduan</span>
          <span class="text-2xl font-black text-primary"><?= $totalAduan ?></span>
          <span class="text-[10px] text-slate-400 block">38 Provinsi</span>
        </div>
      </div>
      <div class="bg-surface-card p-5 rounded-2xl border border-blue-200/80 shadow-sm flex items-center gap-4">
        <div class="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
          <span class="material-symbols-outlined text-blue-500 text-xl">mark_email_unread</span>
        </div>
        <div>
          <span class="text-[11px] text-slate-500 font-semibold uppercase block">Perlu Verifikasi</span>
          <span class="text-2xl font-black text-blue-600"><?= $masukAduan ?></span>
          <span class="text-[10px] text-blue-500 font-semibold block">Status: Masuk</span>
        </div>
      </div>
      <div class="bg-surface-card p-5 rounded-2xl border border-amber-200/80 shadow-sm flex items-center gap-4">
        <div class="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
          <span class="material-symbols-outlined text-amber-500 text-xl">hourglass_top</span>
        </div>
        <div>
          <span class="text-[11px] text-slate-500 font-semibold uppercase block">Ditangani</span>
          <span class="text-2xl font-black text-amber-600"><?= $prosesAduan ?></span>
          <span class="text-[10px] text-amber-500 font-semibold block">Proses / Verifikasi</span>
        </div>
      </div>
      <div class="bg-surface-card p-5 rounded-2xl border border-emerald-200/80 shadow-sm flex items-center gap-4">
        <div class="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
          <span class="material-symbols-outlined text-emerald-500 text-xl">task_alt</span>
        </div>
        <div>
          <span class="text-[11px] text-slate-500 font-semibold uppercase block">Selesai</span>
          <span class="text-2xl font-black text-emerald-600"><?= $selesaiAduan ?></span>
          <span class="text-[10px] text-emerald-500 font-semibold block">Laporan Tuntas</span>
        </div>
      </div>
    </div>

    <!-- Quick Navigation Pill Bar -->
    <div class="flex flex-wrap items-center gap-2 mb-8 p-2.5 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-sm sticky top-20 z-20">
      <a href="#telemetry-manager" class="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-xs font-bold text-slate-700 transition-all flex items-center gap-1.5">
        <span class="material-symbols-outlined text-[16px] text-blue-600">monitoring</span>
        <span>Input Telemetri & KPI</span>
      </a>
      <a href="#distribusi-manager" class="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-xs font-bold text-slate-700 transition-all flex items-center gap-1.5">
        <span class="material-symbols-outlined text-[16px] text-emerald-600">map</span>
        <span>Distribusi Provinsi</span>
      </a>
      <a href="#maintenance-panel" class="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-purple-50 hover:text-purple-700 text-xs font-bold text-slate-700 transition-all flex items-center gap-1.5">
        <span class="material-symbols-outlined text-[16px] text-purple-600">admin_panel_settings</span>
        <span>Pemeliharaan Sistem</span>
      </a>
      <a href="#mbg-panel" class="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-amber-50 hover:text-amber-700 text-xs font-bold text-slate-700 transition-all flex items-center gap-1.5">
        <span class="material-symbols-outlined text-[16px] text-amber-600">school</span>
        <span>Data Penerima MBG (8 Jenjang)</span>
      </a>
      <a href="#user-manager" class="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-xs font-bold text-slate-700 transition-all flex items-center gap-1.5">
        <span class="material-symbols-outlined text-[16px] text-indigo-600">group</span>
        <span>Manajemen Akun</span>
      </a>
      <a href="#aduan-manager" class="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-xs font-bold text-slate-700 transition-all flex items-center gap-1.5">
        <span class="material-symbols-outlined text-[16px] text-rose-600">receipt_long</span>
        <span>Laporan Aduan</span>
      </a>
    </div>

    <!-- TAB 1: KELOLA TELEMETRI NASIONAL & DISTRIBUSI PROVINSI -->
    <div id="telemetry-manager" class="bg-surface-card rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8 mb-8">
      <div class="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
        <div class="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
          <span class="material-symbols-outlined text-2xl">monitoring</span>
        </div>
        <div>
          <h2 class="text-lg font-bold text-primary">Manajemen Telemetri Nasional (5 KPI Utama)</h2>
          <p class="text-xs text-slate-500">Nilai yang diubah di sini langsung terhubung ke database dan tampil secara dinamis pada halaman utama.</p>
        </div>
      </div>

      <form action="index.php" method="POST" class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <input type="hidden" name="action" value="update_telemetri">
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Porsi Tersalurkan</label>
          <input type="number" name="porsi_tersalurkan" value="<?= (int)$telRow['porsi_tersalurkan'] ?>" required class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold">
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Pencapaian Target (%)</label>
          <input type="number" step="0.1" name="persen_target" value="<?= (float)$telRow['persen_target'] ?>" required class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold">
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase mb-1">SPPG Aktif Beroperasi</label>
          <input type="number" name="sppg_aktif" value="<?= (int)$telRow['sppg_aktif'] ?>" required class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold">
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Sekolah Terlayani</label>
          <input type="number" name="sekolah_terlayani" value="<?= (int)$telRow['sekolah_terlayani'] ?>" required class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold">
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Kepatuhan AKG (%)</label>
          <input type="number" step="0.1" name="kepatuhan_akg" value="<?= (float)$telRow['kepatuhan_akg'] ?>" required class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold">
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Rantai Hangat (°C)</label>
          <input type="number" step="0.1" name="suhu_rata_rata" value="<?= (float)$telRow['suhu_rata_rata'] ?>" required class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold">
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase mb-1">SLA Distribusi Pagi (%)</label>
          <input type="number" step="0.1" name="sla_distribusi" value="<?= (float)$telRow['sla_distribusi'] ?>" required class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold">
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Teks Waktu Pembaruan</label>
          <input type="text" name="pembaruan_teks" value="<?= Security::cleanOutput($telRow['pembaruan_teks']) ?>" required class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold">
        </div>
        <div class="col-span-full pt-2">
          <button type="submit" class="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all">
            <span class="material-symbols-outlined text-sm">save</span>
            <span>Simpan Perubahan Telemetri ke Database</span>
          </button>
        </div>
      </form>
    </div>

    <!-- TAB 2: KELOLA KEPATUHAN DISTRIBUSI PROVINSI -->
    <div id="distribusi-manager" class="bg-surface-card rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8 mb-8">
      <div class="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
        <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
          <span class="material-symbols-outlined text-2xl">map</span>
        </div>
        <div>
          <h2 class="text-lg font-bold text-primary">Kepatuhan Distribusi Per Provinsi</h2>
          <p class="text-xs text-slate-500">Data tabel harian yang muncul di halaman beranda Radar MBG.</p>
        </div>
      </div>

      <!-- Form Tambah / Edit Provinsi -->
      <form action="index.php" method="POST" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/80 mb-6">
        <input type="hidden" name="action" value="save_provinsi">
        <div>
          <label class="block text-[11px] font-bold text-slate-600 uppercase mb-1">Nama Provinsi</label>
          <input type="text" name="provinsi" placeholder="Misal: Bali" required class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs">
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-600 uppercase mb-1">Target Porsi</label>
          <input type="number" name="target_porsi" placeholder="Misal: 150000" required class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs">
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-600 uppercase mb-1">Ketepatan (%)</label>
          <input type="number" step="0.1" name="ketepatan" placeholder="99.0" required class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs">
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-600 uppercase mb-1">Status Salur</label>
          <select name="status" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs">
            <option value="Selesai Salur">Selesai Salur</option>
            <option value="94% Salur">94% Salur</option>
            <option value="Jalur Khusus">Jalur Khusus</option>
            <option value="Dalam Pengantaran">Dalam Pengantaran</option>
          </select>
        </div>
        <div class="flex items-end">
          <button type="submit" class="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-sm transition-all">
            <span class="material-symbols-outlined text-sm">add_circle</span>
            <span>Simpan Provinsi</span>
          </button>
        </div>
      </form>

      <!-- Tabel Provinsi Saat Ini -->
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="bg-slate-100 text-slate-600 uppercase font-bold text-[11px]">
              <th class="py-2.5 px-3 rounded-l-lg">Provinsi</th>
              <th class="py-2.5 px-3">Target Porsi</th>
              <th class="py-2.5 px-3">Ketepatan</th>
              <th class="py-2.5 px-3">Status</th>
              <th class="py-2.5 px-3 rounded-r-lg">Region Code</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <?php foreach ($provinsiList as $pr): ?>
              <tr class="hover:bg-slate-50 transition-colors">
                <td class="py-2.5 px-3 font-bold text-primary"><?= Security::cleanOutput($pr['provinsi']) ?></td>
                <td class="py-2.5 px-3 font-mono"><?= number_format($pr['target_porsi'], 0, ',', '.') ?></td>
                <td class="py-2.5 px-3 font-semibold text-emerald-600"><?= $pr['ketepatan'] ?>%</td>
                <td class="py-2.5 px-3">
                  <span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold"><?= Security::cleanOutput($pr['status']) ?></span>
                </td>
                <td class="py-2.5 px-3 text-slate-400 font-mono"><?= Security::cleanOutput($pr['region_code']) ?></td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 3: MANAJEMEN PENGGUNA (USER MANAGEMENT) -->
    <div id="user-manager" class="bg-surface-card rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8 mb-8">
      <div class="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
        <div class="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
          <span class="material-symbols-outlined text-2xl">manage_accounts</span>
        </div>
        <div>
          <h2 class="text-lg font-bold text-primary">Manajemen Akun Pengguna & Hak Akses</h2>
          <p class="text-xs text-slate-500">Mendaftarkan akun resmi baru untuk Admin Satgas, Mitra Dapur SPPG, dan Wali Murid.</p>
        </div>
      </div>

      <!-- Form Tambah User -->
      <form action="index.php" method="POST" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/80 mb-6">
        <input type="hidden" name="action" value="create_user">
        <div>
          <label class="block text-[11px] font-bold text-slate-600 uppercase mb-1">Username</label>
          <input type="text" name="username" placeholder="Contoh: sppg_bali" required class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs">
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-600 uppercase mb-1">Email Resmi</label>
          <input type="email" name="email" placeholder="email@bgn.go.id" required class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs">
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-600 uppercase mb-1">Kata Sandi</label>
          <input type="password" name="password" placeholder="Min. 6 karakter" required class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs">
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-600 uppercase mb-1">Role / Peran</label>
          <select name="role" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold">
            <option value="sppg">SPPG (Mitra Dapur)</option>
            <option value="admin">Admin Satgas BGN</option>
            <option value="user">User / Wali Murid</option>
          </select>
        </div>
        <div class="flex items-end">
          <button type="submit" class="w-full py-2 px-3 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-sm transition-all">
            <span class="material-symbols-outlined text-sm">person_add</span>
            <span>Daftarkan Akun</span>
          </button>
        </div>
      </form>

      <!-- Tabel Pengguna Terdaftar -->
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="bg-slate-100 text-slate-600 uppercase font-bold text-[11px]">
              <th class="py-2.5 px-3 rounded-l-lg">Username</th>
              <th class="py-2.5 px-3">Nama Lengkap</th>
              <th class="py-2.5 px-3">Email</th>
              <th class="py-2.5 px-3">Role</th>
              <th class="py-2.5 px-3">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <?php foreach ($userList as $u): ?>
              <tr class="hover:bg-slate-50 transition-colors">
                <td class="py-2.5 px-3 font-bold text-primary"><?= Security::cleanOutput($u['username']) ?></td>
                <td class="py-2.5 px-3"><?= Security::cleanOutput($u['full_name'] ?: '-') ?></td>
                <td class="py-2.5 px-3 text-slate-500 font-mono"><?= Security::cleanOutput($u['email']) ?></td>
                <td class="py-2.5 px-3">
                  <?php
                    $roleCls = match($u['role']) {
                      'admin' => 'bg-red-100 text-red-800',
                      'sppg'  => 'bg-blue-100 text-blue-800',
                      default => 'bg-emerald-100 text-emerald-800'
                    };
                  ?>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase <?= $roleCls ?>"><?= $u['role'] ?></span>
                </td>
                <td class="py-2.5 px-3">
                  <span class="text-emerald-600 font-bold flex items-center gap-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Aktif
                  </span>
                </td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB: PEMELIHARAAN SISTEM & KESEHATAN DATABASE -->
    <div id="maintenance-panel" class="bg-surface-card rounded-3xl border border-purple-200/80 shadow-sm overflow-hidden mb-8">
      <div class="p-6 bg-purple-50/50 border-b border-purple-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-700 flex items-center justify-center">
            <span class="material-symbols-outlined text-2xl">admin_panel_settings</span>
          </div>
          <div>
            <h2 class="text-base font-bold text-purple-950 flex items-center gap-2">
              <span>Pusat Pemeliharaan Basis Data &amp; Server (Neon PostgreSQL)</span>
              <span class="px-2 py-0.5 rounded-full bg-purple-600 text-white text-[10px] font-black uppercase tracking-wider">Neon Cloud DB</span>
            </h2>
            <p class="text-xs text-purple-700/80">Diagnostik performa, alokasi memori, metrik tabel, dan utilitas pemeliharaan indeks.</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <form action="index.php#maintenance-panel" method="POST" onsubmit="return confirm('Jalankan VACUUM ANALYZE pada Neon PostgreSQL?');">
            <input type="hidden" name="action" value="vacuum_db">
            <button type="submit" class="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1 transition-all shadow-sm">
              <span class="material-symbols-outlined text-sm">tune</span>
              <span>VACUUM ANALYZE</span>
            </button>
          </form>
          <form action="index.php#maintenance-panel" method="POST" onsubmit="return confirm('Bersihkan Opcode Cache & buffer memori?');">
            <input type="hidden" name="action" value="clear_cache">
            <button type="submit" class="px-3 py-1.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-800 font-bold text-xs flex items-center gap-1 transition-all">
              <span class="material-symbols-outlined text-sm">cached</span>
              <span>Reset Cache</span>
            </button>
          </form>
        </div>
      </div>

      <div class="p-6">
        <!-- Metric Cards -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div class="p-4 bg-purple-50/40 rounded-2xl border border-purple-100/80">
            <span class="text-[11px] font-bold text-purple-600 uppercase tracking-wider block mb-1">Ukuran Basis Data</span>
            <div class="text-xl sm:text-2xl font-black text-slate-800 font-mono"><?= htmlspecialchars($dbSize) ?></div>
            <span class="text-[10px] text-slate-500 font-medium">Neon PostgreSQL Cloud</span>
          </div>
          <div class="p-4 bg-purple-50/40 rounded-2xl border border-purple-100/80">
            <span class="text-[11px] font-bold text-purple-600 uppercase tracking-wider block mb-1">Versi Engine DB</span>
            <div class="text-lg sm:text-xl font-bold text-slate-800 font-mono truncate" title="<?= htmlspecialchars($pgVersion) ?>"><?= htmlspecialchars(explode(' ', $pgVersion)[0] ?? 'PostgreSQL') ?></div>
            <span class="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Online (SSL Pooler)</span>
          </div>
          <div class="p-4 bg-purple-50/40 rounded-2xl border border-purple-100/80">
            <span class="text-[11px] font-bold text-purple-600 uppercase tracking-wider block mb-1">Total Data MBG</span>
            <div class="text-xl sm:text-2xl font-black text-purple-900 font-mono"><?= number_format($totalMbg) ?></div>
            <span class="text-[10px] text-slate-500 font-medium">8 Jenjang Pendidikan</span>
          </div>
          <div class="p-4 bg-purple-50/40 rounded-2xl border border-purple-100/80">
            <span class="text-[11px] font-bold text-purple-600 uppercase tracking-wider block mb-1">Dokumen Juknis</span>
            <div class="text-xl sm:text-2xl font-black text-purple-900 font-mono"><?= number_format($tableStats['dokumen_juknis'] ?? 0) ?></div>
            <span class="text-[10px] text-slate-500 font-medium">BGN Official PDF</span>
          </div>
        </div>

        <!-- Table Row Breakdown -->
        <h3 class="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <span class="material-symbols-outlined text-[15px] text-purple-600">table_chart</span>
          <span>Kepadatan Baris Tabel Basis Data</span>
        </h3>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <?php foreach ($tableStats as $tbl => $count): ?>
            <div class="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs">
              <span class="font-mono text-slate-600 font-medium truncate max-w-[120px]" title="<?= $tbl ?>"><?= $tbl ?></span>
              <span class="font-bold font-mono px-2 py-0.5 rounded-md bg-white text-slate-800 border border-slate-200 shadow-2xs"><?= number_format($count) ?></span>
            </div>
          <?php endforeach; ?>
        </div>
      </div>
    </div>

    <!-- TAB: DATA PENERIMA MBG NASIONAL (8 JENJANG PENDIDIKAN) -->
    <div id="mbg-panel" class="bg-surface-card rounded-3xl border border-amber-200/80 shadow-sm overflow-hidden mb-8">
      <a id="paud-panel"></a>
      <div class="p-6 bg-amber-50/50 border-b border-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center">
            <span class="material-symbols-outlined text-2xl">school</span>
          </div>
          <div>
            <h2 class="text-base font-bold text-amber-950 flex items-center gap-2">
              <span>Rekapitulasi MBG Nasional Seluruh Jenjang Pendidikan (2026)</span>
              <span class="px-2 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-black uppercase tracking-wider">BGN Pusat Verified</span>
            </h2>
            <p class="text-xs text-amber-800/80">Data resmi penerima manfaat, satuan pendidikan, alergi, dan intoleransi pangan per jenjang sekolah.</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <a href="../../api/data_mbg.php?summary=1" target="_blank" class="px-3 py-1.5 rounded-xl bg-white hover:bg-amber-100 text-amber-800 font-bold text-xs flex items-center gap-1 transition-all border border-amber-300 shadow-2xs">
            <span class="material-symbols-outlined text-sm">api</span>
            <span>REST API MBG</span>
          </a>
          <a href="../../api/juknis.php" target="_blank" class="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1 transition-all shadow-sm">
            <span class="material-symbols-outlined text-sm">picture_as_pdf</span>
            <span>API Juknis PDF</span>
          </a>
        </div>
      </div>

      <div class="p-6">
        <!-- 4 Grand Metric Cards -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div class="p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
            <span class="text-[11px] font-bold text-blue-600 uppercase block mb-1">Satuan Pendidikan</span>
            <div class="text-2xl font-black text-blue-950"><?= number_format($mbgStats['total_units']) ?></div>
            <span class="text-[10px] text-slate-500">Sekolah &amp; Lembaga Belajar</span>
          </div>
          <div class="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
            <span class="text-[11px] font-bold text-emerald-600 uppercase block mb-1">Penerima Manfaat</span>
            <div class="text-2xl font-black text-emerald-950"><?= number_format($mbgStats['total_beneficiaries']) ?></div>
            <span class="text-[10px] text-slate-500">Siswa/Peserta Didik Aktif</span>
          </div>
          <div class="p-4 bg-rose-50/50 rounded-2xl border border-rose-100">
            <span class="text-[11px] font-bold text-rose-600 uppercase block mb-1">Alergi Teridentifikasi</span>
            <div class="text-2xl font-black text-rose-950"><?= number_format($mbgStats['total_allergies']) ?></div>
            <span class="text-[10px] text-rose-700 font-semibold">Tersaring Ketat Menu Diet</span>
          </div>
          <div class="p-4 bg-amber-50/50 rounded-2xl border border-amber-100">
            <span class="text-[11px] font-bold text-amber-600 uppercase block mb-1">Kondisi Khusus / Intoleransi</span>
            <div class="text-2xl font-black text-amber-950"><?= number_format($mbgStats['total_special']) ?></div>
            <span class="text-[10px] text-amber-800 font-semibold">Protokol Dapur Khusus</span>
          </div>
        </div>

        <!-- 8 Level Cards Breakdown -->
        <h3 class="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <span class="material-symbols-outlined text-[15px] text-amber-600">bar_chart</span>
          <span>Sebaran Menurut 8 Jenjang Pendidikan</span>
        </h3>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <?php foreach ($levelStats as $ls): ?>
            <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 hover:border-amber-400 transition-all">
              <div class="flex items-center justify-between mb-1.5">
                <span class="px-2 py-0.5 rounded-lg bg-amber-500 text-white font-black text-xs"><?= htmlspecialchars($ls['level']) ?></span>
                <span class="text-[10px] text-slate-500 font-mono"><?= number_format($ls['rows']) ?> wilayah</span>
              </div>
              <div class="text-base font-black text-slate-900"><?= number_format($ls['beneficiaries']) ?> <span class="text-[11px] font-normal text-slate-500">siswa</span></div>
              <div class="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/60 text-[10px] text-slate-600">
                <span><?= number_format($ls['units']) ?> satpen</span>
                <span class="text-rose-600 font-bold"><?= number_format($ls['allergies']) ?> alergi</span>
              </div>
            </div>
          <?php endforeach; ?>
        </div>

        <!-- Highest Beneficiaries Sample Table -->
        <div class="border border-slate-200 rounded-2xl overflow-hidden">
          <div class="p-3 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
            <span class="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <span class="material-symbols-outlined text-sm text-blue-600">visibility</span>
              <span>15 Wilayah Kabupaten/Kota dengan Penerima Manfaat Terbanyak</span>
            </span>
            <span class="text-[11px] text-slate-500 font-medium">Sumber: BGN Pusat (Tahun 2026)</span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="bg-slate-50 text-slate-600 font-bold text-[11px] uppercase border-b border-slate-200">
                  <th class="py-2.5 px-3">Jenjang</th>
                  <th class="py-2.5 px-3">Kabupaten / Kota</th>
                  <th class="py-2.5 px-3 text-right">Satpen</th>
                  <th class="py-2.5 px-3 text-right">Penerima</th>
                  <th class="py-2.5 px-3 text-right">Alergi</th>
                  <th class="py-2.5 px-3 text-right">Kondisi Khusus</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <?php foreach ($sampleMbg as $sm): ?>
                  <tr class="hover:bg-slate-50/60 transition-colors">
                    <td class="py-2.5 px-3">
                      <span class="px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 font-bold text-[10px]"><?= htmlspecialchars($sm['level']) ?></span>
                    </td>
                    <td class="py-2.5 px-3 font-semibold text-slate-800"><?= htmlspecialchars($sm['regency_name'] ?? 'Pusat/Provinsi') ?></td>
                    <td class="py-2.5 px-3 text-right font-mono text-slate-600"><?= number_format($sm['education_units']) ?></td>
                    <td class="py-2.5 px-3 text-right font-mono font-bold text-emerald-700"><?= number_format($sm['beneficiaries']) ?></td>
                    <td class="py-2.5 px-3 text-right font-mono text-rose-600"><?= number_format($sm['allergies']) ?></td>
                    <td class="py-2.5 px-3 text-right font-mono text-amber-700"><?= number_format($sm['special_conditions']) ?></td>
                  </tr>
                <?php endforeach; ?>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 4: PERINGATAN EKSPLOITASI KEAMANAN (WAF LOGS) -->
    <div class="bg-surface-card rounded-3xl border border-red-200/80 shadow-sm overflow-hidden mb-8">
      <div class="p-6 bg-red-50/50 border-b border-red-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-red-500/20 text-red-600 flex items-center justify-center">
            <span class="material-symbols-outlined text-2xl">security</span>
          </div>
          <div>
            <h2 class="text-base font-bold text-red-950 flex items-center gap-2">
              <span>BGN Shield: Audit Eksploitasi XSS &amp; Injeksi Input</span>
              <span class="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black uppercase tracking-wider">WAF Aktif</span>
            </h2>
            <p class="text-xs text-red-700/80">Riwayat serangan dan upaya manipulasi form yang berhasil diblokir secara otomatis.</p>
          </div>
        </div>
        <form action="index.php" method="POST" onsubmit="return confirm('Kosongkan riwayat exploit logs?');">
          <input type="hidden" name="action" value="clear_exploit_logs">
          <button type="submit" class="px-3 py-1.5 rounded-xl bg-red-100 hover:bg-red-200 text-red-800 font-bold text-xs flex items-center gap-1 transition-all">
            <span class="material-symbols-outlined text-sm">delete_sweep</span>
            <span>Bersihkan Log</span>
          </button>
        </form>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="bg-red-50/70 text-red-900 text-[11px] font-bold uppercase tracking-wider border-b border-red-100">
              <th class="py-3 px-4">Waktu</th>
              <th class="py-3 px-4">IP Address</th>
              <th class="py-3 px-4">Tipe Ancaman</th>
              <th class="py-3 px-4">Field Input</th>
              <th class="py-3 px-4">Sampel Muatan (Payload) Terdeteksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <?php if (empty($exploitLogs)): ?>
              <tr>
                <td colspan="5" class="py-8 text-center text-slate-400">
                  <span class="material-symbols-outlined text-3xl text-emerald-500 block mb-1">verified_user</span>
                  Tidak ada rekaman exploit. Sistem aman terlindungi.
                </td>
              </tr>
            <?php else: ?>
              <?php foreach ($exploitLogs as $log): ?>
                <tr class="hover:bg-red-50/30 transition-colors">
                  <td class="py-3 px-4 font-mono text-slate-500 whitespace-nowrap"><?= $log['created_at'] ?></td>
                  <td class="py-3 px-4 font-mono font-semibold text-slate-700"><?= Security::cleanOutput($log['ip_address']) ?></td>
                  <td class="py-3 px-4">
                    <span class="px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-bold text-[10px] uppercase">
                      <?= Security::cleanOutput($log['exploit_type']) ?>
                    </span>
                  </td>
                  <td class="py-3 px-4 font-semibold text-slate-700"><?= Security::cleanOutput($log['input_field']) ?></td>
                  <td class="py-3 px-4 font-mono text-[11px] text-red-600 bg-red-50/40 rounded max-w-xs truncate" title="<?= Security::cleanOutput($log['payload_sample']) ?>">
                    <?= Security::cleanOutput(mb_substr($log['payload_sample'] ?? '', 0, 80)) ?>
                  </td>
                </tr>
              <?php endforeach; ?>
            <?php endif; ?>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 5: MANAJEMEN LAPORAN ADUAN PUBLIK -->
    <div id="aduan-manager" class="bg-surface-card rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden mb-8">
      <div class="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-base font-bold text-primary flex items-center gap-2">
            <span>Daftar Seluruh Pengaduan MBG Masuk</span>
            <span class="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold"><?= count($laporanList) ?> Laporan</span>
          </h2>
          <p class="text-xs text-slate-500">Tinjau, ubah status verifikasi, dan berikan catatan penanganan Satgas.</p>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200/80">
              <th class="py-3.5 px-4">Tiket</th>
              <th class="py-3.5 px-4">Pelapor</th>
              <th class="py-3.5 px-4">Sekolah Sasaran</th>
              <th class="py-3.5 px-4">Detail Aduan</th>
              <th class="py-3.5 px-4">Status &amp; Prioritas</th>
              <th class="py-3.5 px-4">Tindakan Satgas</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <?php if (empty($laporanList)): ?>
              <tr>
                <td colspan="6" class="py-12 text-center text-slate-400">
                  <span class="material-symbols-outlined text-4xl block mb-2 text-slate-300">inbox</span>
                  Belum ada laporan pengaduan dalam database.
                </td>
              </tr>
            <?php else: ?>
              <?php foreach ($laporanList as $lap): ?>
                <tr class="hover:bg-slate-50/70 transition-colors">
                  <td class="py-3.5 px-4 whitespace-nowrap">
                    <span class="font-mono font-bold text-primary block"><?= Security::cleanOutput($lap['ticket_code']) ?></span>
                    <span class="text-[10px] text-slate-400"><?= substr($lap['created_at'], 0, 16) ?></span>
                  </td>
                  <td class="py-3.5 px-4">
                    <strong class="text-slate-800 block"><?= Security::cleanOutput($lap['reporter_name']) ?></strong>
                    <span class="text-[10px] text-slate-400 uppercase font-semibold">Peran: <?= Security::cleanOutput($lap['reporter_role']) ?></span>
                  </td>
                  <td class="py-3.5 px-4">
                    <span class="font-medium text-slate-700 block"><?= Security::cleanOutput($lap['school_target']) ?></span>
                    <span class="text-[10px] text-slate-400">Kategori: <?= Security::cleanOutput($lap['issue_category']) ?></span>
                  </td>
                  <td class="py-3.5 px-4 max-w-xs">
                    <p class="text-slate-600 line-clamp-2"><?= Security::cleanOutput($lap['description']) ?></p>
                    <?php if (!empty($lap['satgas_notes'])): ?>
                      <div class="mt-1 p-1.5 rounded bg-amber-50 text-amber-800 text-[10px]">
                        <strong>Catatan Satgas:</strong> <?= Security::cleanOutput($lap['satgas_notes']) ?>
                      </div>
                    <?php endif; ?>
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
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase <?= $badgeCls ?>">
                      <?= Security::cleanOutput($st) ?>
                    </span>
                    <span class="text-[10px] text-slate-400 block mt-0.5 uppercase font-bold">Prio: <?= Security::cleanOutput($lap['priority']) ?></span>
                  </td>
                  <td class="py-3.5 px-4 whitespace-nowrap">
                    <form action="index.php" method="POST" class="flex flex-col gap-1.5">
                      <input type="hidden" name="action" value="update_status">
                      <input type="hidden" name="laporan_id" value="<?= (int)$lap['id'] ?>">

                      <select name="status" class="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-bold focus:ring-1 focus:ring-blue-600">
                        <option value="masuk" <?= $st === 'masuk' ? 'selected' : '' ?>>Masuk</option>
                        <option value="verifikasi" <?= $st === 'verifikasi' ? 'selected' : '' ?>>Verifikasi</option>
                        <option value="proses" <?= $st === 'proses' ? 'selected' : '' ?>>Proses</option>
                        <option value="selesai" <?= $st === 'selesai' ? 'selected' : '' ?>>Selesai</option>
                        <option value="ditolak" <?= $st === 'ditolak' ? 'selected' : '' ?>>Ditolak</option>
                      </select>

                      <input type="text" name="satgas_notes" placeholder="Catatan satgas..." value="<?= Security::cleanOutput($lap['satgas_notes'] ?? '') ?>"
                             class="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px]">

                      <button type="submit" class="px-2.5 py-1 rounded-lg bg-primary hover:bg-primary-container text-white text-[10px] font-bold transition-all">
                        Update
                      </button>
                    </form>
                  </td>
                </tr>
              <?php endforeach; ?>
            <?php endif; ?>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- VERIFIKASI LOGO SPPG (SPPG Logo Approval) -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- KOTAK MASUK LIVE CHAT SATGAS BGN (DUAL-WAY REPLY) -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <div id="live-chat-admin-panel" class="bg-surface-card rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8 mb-8">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center">
            <span class="material-symbols-outlined text-2xl">chat</span>
          </div>
          <div>
            <h2 class="text-lg font-bold text-primary flex items-center gap-2">
              <span>Live Chat Konsultasi Satgas BGN</span>
              <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">2-Way Active</span>
            </h2>
            <p class="text-xs text-slate-500">Balas chat langsung dari masyarakat, wali murid, dan pihak sekolah secara realtime.</p>
          </div>
        </div>
        <button type="button" onclick="loadAdminChatSessions()" class="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-all flex items-center gap-1.5 self-start sm:self-auto">
          <span class="material-symbols-outlined text-sm">refresh</span>
          <span>Segarkan Pesan</span>
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[460px]">
        <!-- Sesi Chat Masuk (List) -->
        <div class="lg:col-span-4 border border-slate-200/90 rounded-2xl p-3 bg-slate-50/70 flex flex-col h-[460px]">
          <div class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1 flex items-center justify-between">
            <span>Daftar Sesi Masuk:</span>
            <span id="adminSessionCountBadge" class="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[10px]">0</span>
          </div>
          <div id="adminChatSessionsList" class="flex-grow overflow-y-auto space-y-2 pr-1">
            <p class="text-xs text-slate-400 p-4 text-center">Memuat daftar sesi...</p>
          </div>
        </div>

        <!-- Ruang Percakapan & Reply Box -->
        <div class="lg:col-span-8 border border-slate-200/90 rounded-2xl bg-white flex flex-col h-[460px] overflow-hidden">
          <!-- Room Header -->
          <div id="adminChatRoomHeader" class="p-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div>
              <p id="adminChatActiveUser" class="text-xs font-bold text-slate-900">Pilih sesi chat di sebelah kiri</p>
              <p id="adminChatActiveSub" class="text-[10px] text-slate-400">Pesan dari portal publik</p>
            </div>
            <span id="adminChatTargetBadge" class="hidden px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">🏛️ Satgas BGN</span>
          </div>

          <!-- Messages Stream -->
          <div id="adminChatTranscript" class="flex-grow p-4 overflow-y-auto space-y-3 bg-slate-50/40 text-xs">
            <div class="h-full flex items-center justify-center text-center text-slate-400">
              <div>
                <span class="material-symbols-outlined text-4xl block mb-2 text-slate-300">forum</span>
                <p class="text-xs">Klik salah satu pengguna di sebelah kiri untuk melihat percakapan dan membalas.</p>
              </div>
            </div>
          </div>

          <!-- Reply Form -->
          <form id="adminReplyForm" onsubmit="sendAdminReply(event)" class="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
            <input type="hidden" id="adminReplySessionId" value="">
            <input type="text" id="adminReplyInput" disabled placeholder="Pilih sesi terlebih dahulu untuk membalas..."
                   class="flex-grow px-3.5 py-2.5 bg-slate-100 text-slate-900 placeholder:text-slate-400 rounded-xl text-xs border border-transparent focus:bg-white focus:border-blue-600 focus:outline-none transition-all">
            <button type="submit" id="adminReplyBtn" disabled class="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-container disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all">
              <span class="material-symbols-outlined text-sm">send</span>
              <span>Kirim</span>
            </button>
          </form>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════ -->
    <div id="verifikasi-logo-sppg" class="bg-surface-card rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8 mb-8">
      <div class="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
        <div class="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
          <span class="material-symbols-outlined text-2xl">verified_user</span>
        </div>
        <div>
          <h2 class="text-lg font-bold text-primary">Verifikasi Logo Dapur SPPG</h2>
          <p class="text-xs text-slate-500">Konfirmasi atau tolak permohonan pergantian logo/foto profil dari mitra Dapur SPPG.</p>
        </div>
        <?php if (count($pendingSppgLogos) > 0): ?>
          <span class="ml-auto px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold animate-pulse"><?= count($pendingSppgLogos) ?> Menunggu</span>
        <?php endif; ?>
      </div>

      <?php if (empty($pendingSppgLogos)): ?>
        <div class="py-10 text-center text-slate-400">
          <span class="material-symbols-outlined text-4xl block mb-2 text-slate-300">check_circle</span>
          <p class="text-sm font-medium">Semua logo SPPG sudah terverifikasi. Tidak ada permohonan baru.</p>
        </div>
      <?php else: ?>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <?php foreach ($pendingSppgLogos as $sp): ?>
            <div class="bg-slate-50 rounded-2xl border border-slate-200 p-4 flex flex-col items-center gap-3">
              <img src="../../<?= Security::cleanOutput($sp['avatar_pending_url']) ?>" alt="Pending Logo" class="w-20 h-20 rounded-xl object-cover border-2 border-amber-300 shadow-sm bg-white" onerror="this.src='../../assets/images/logo.webp'">
              <div class="text-center">
                <p class="text-xs font-bold text-primary"><?= Security::cleanOutput($sp['full_name'] ?? $sp['username']) ?></p>
                <p class="text-[11px] text-slate-500"><?= Security::cleanOutput($sp['sppg_name'] ?? '-') ?></p>
                <p class="text-[10px] text-slate-400 mt-1">Dikirim: <?= substr($sp['updated_at'], 0, 16) ?></p>
              </div>
              <div class="flex gap-2 w-full">
                <form action="index.php" method="POST" class="flex-1">
                  <input type="hidden" name="action" value="approve_sppg_logo">
                  <input type="hidden" name="user_id" value="<?= (int)$sp['id'] ?>">
                  <button type="submit" class="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1">
                    <span class="material-symbols-outlined text-sm">check</span> Setujui
                  </button>
                </form>
                <form action="index.php" method="POST" class="flex-1">
                  <input type="hidden" name="action" value="reject_sppg_logo">
                  <input type="hidden" name="user_id" value="<?= (int)$sp['id'] ?>">
                  <button type="submit" class="w-full py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1">
                    <span class="material-symbols-outlined text-sm">close</span> Tolak
                  </button>
                </form>
              </div>
            </div>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- PENGATURAN PROFIL & GANTI PASSWORD ADMIN -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <div id="ganti-password" class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <!-- Ganti Kata Sandi Administrator -->
      <div id="pengaturan-profil" class="bg-surface-card rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
        <div class="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
          <div class="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <span class="material-symbols-outlined text-2xl">key</span>
          </div>
          <div>
            <h2 class="text-lg font-bold text-primary">Ganti Kata Sandi Administrator</h2>
            <p class="text-xs text-slate-500">Perbarui kata sandi akun Anda untuk keamanan sistem.</p>
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

      <!-- Upload / Ganti Avatar Admin -->
      <div class="bg-surface-card rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
        <div class="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
          <div class="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
            <span class="material-symbols-outlined text-2xl">account_circle</span>
          </div>
          <div>
            <h2 class="text-lg font-bold text-primary">Atur Foto Profil Admin</h2>
            <p class="text-xs text-slate-500">Upload foto profil Anda (JPG/PNG/WEBP, maks 5 MB). Langsung aktif.</p>
          </div>
        </div>
        <div class="flex flex-col items-center gap-4">
          <img id="adminAvatarPreview" src="<?= Security::cleanOutput($adminAvatar) ?>" alt="Avatar Admin" class="w-24 h-24 rounded-2xl object-cover border-2 border-slate-200 shadow-sm bg-white" onerror="this.src='../../assets/images/logo.webp'">
          <form id="formUploadAdminAvatar" enctype="multipart/form-data" class="w-full flex flex-col gap-3">
            <input type="file" name="avatar" accept="image/jpeg,image/png,image/webp" required class="w-full text-xs file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-primary file:text-white file:font-bold file:text-xs file:cursor-pointer">
            <button type="submit" class="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2">
              <span class="material-symbols-outlined text-base">cloud_upload</span>
              <span>Upload Foto Profil</span>
            </button>
          </form>
          <p id="avatarUploadStatus" class="text-xs text-slate-500 hidden"></p>
        </div>
        <script>
          document.getElementById('formUploadAdminAvatar')?.addEventListener('submit', async function(e) {
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
                if (json.avatar_url) document.getElementById('adminAvatarPreview').src = '../../' + json.avatar_url;
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

<script>
  let currentAdminSessionId = '';

  async function loadAdminChatSessions() {
    const listEl = document.getElementById('adminChatSessionsList');
    const badgeEl = document.getElementById('adminSessionCountBadge');
    if (!listEl) return;
    try {
      const res = await fetch('../../api/live_chat.php?action=admin_sessions');
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        if (badgeEl) badgeEl.textContent = json.data.length;
        if (json.data.length === 0) {
          listEl.innerHTML = '<p class="text-xs text-slate-400 p-4 text-center">Belum ada sesi percakapan masuk.</p>';
          return;
        }
        listEl.innerHTML = '';
        json.data.forEach(s => {
          const item = document.createElement('div');
          const isSelected = s.session_id === currentAdminSessionId;
          item.className = `p-3 rounded-xl border transition-all cursor-pointer ${isSelected ? 'bg-blue-50 border-blue-400 shadow-sm' : 'bg-white border-slate-200/80 hover:bg-slate-100'}`;
          item.onclick = () => selectAdminSession(s.session_id, s.user_name || 'Pengguna Publik');
          item.innerHTML = `
            <div class="flex items-center justify-between gap-1 mb-1">
              <span class="font-bold text-xs text-slate-900 truncate">${escapeHtml(s.user_name || 'Masyarakat')}</span>
              <span class="text-[9px] text-slate-400">${formatTimeChat(s.last_time)}</span>
            </div>
            <p class="text-[11px] text-slate-600 truncate">${escapeHtml(s.last_message || '-')}</p>
            <div class="flex items-center justify-between mt-1 text-[9px] text-slate-400">
              <span>${s.total_messages} Pesan</span>
              <span class="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono">${s.session_id.substring(0, 14)}...</span>
            </div>
          `;
          listEl.appendChild(item);
        });
      }
    } catch (e) {
      if (listEl) listEl.innerHTML = '<p class="text-xs text-red-500 p-2">Gagal memuat sesi chat.</p>';
    }
  }

  async function selectAdminSession(sessionId, userName) {
    currentAdminSessionId = sessionId;
    document.getElementById('adminReplySessionId').value = sessionId;
    document.getElementById('adminChatActiveUser').textContent = userName;
    document.getElementById('adminChatActiveSub').textContent = `Sesi ID: ${sessionId}`;
    document.getElementById('adminChatTargetBadge').classList.remove('hidden');

    const input = document.getElementById('adminReplyInput');
    const btn = document.getElementById('adminReplyBtn');
    input.disabled = false;
    btn.disabled = false;
    input.placeholder = `Balas ke ${userName} sebagai Satgas BGN...`;
    input.focus();

    await loadAdminSessionTranscript(sessionId);
    loadAdminChatSessions();
  }

  async function loadAdminSessionTranscript(sessionId) {
    const box = document.getElementById('adminChatTranscript');
    if (!box) return;
    box.innerHTML = '<p class="text-xs text-slate-400 p-4 text-center">Memuat riwayat percakapan...</p>';
    try {
      const res = await fetch(`../../api/live_chat.php?action=history&session_id=${encodeURIComponent(sessionId)}&target_type=admin`);
      const json = await res.json();
      if (json.status === 'success' && json.messages) {
        box.innerHTML = '';
        json.messages.forEach(m => {
          const isUser = m.sender_type === 'user';
          const div = document.createElement('div');
          div.className = isUser ? 'flex items-start gap-2' : 'flex items-start justify-end gap-2';
          div.innerHTML = `
            <div class="${isUser ? 'bg-white text-slate-800 rounded-tl-none border border-slate-200' : 'bg-[#001026] text-white rounded-tr-none'} p-3 rounded-2xl shadow-sm max-w-[80%] text-xs">
              <div class="flex items-center gap-1.5 mb-1 ${isUser ? '' : 'justify-end'}">
                <span class="font-bold text-[11px] ${isUser ? 'text-blue-700' : 'text-[#6ffbbe]'}">${escapeHtml(m.sender_name)}</span>
                <span class="text-[9px] ${isUser ? 'text-slate-400' : 'text-slate-300'}">${m.sender_type}</span>
              </div>
              <p class="leading-relaxed whitespace-pre-wrap">${escapeHtml(m.message)}</p>
              <span class="text-[9px] ${isUser ? 'text-slate-400' : 'text-slate-300'} mt-1 block text-right">${formatTimeChat(m.created_at)}</span>
            </div>
          `;
          box.appendChild(div);
        });
        box.scrollTop = box.scrollHeight;
      }
    } catch (e) {
      box.innerHTML = '<p class="text-xs text-red-500 p-2">Gagal memuat pesan.</p>';
    }
  }

  async function sendAdminReply(e) {
    e.preventDefault();
    const sessionId = document.getElementById('adminReplySessionId').value;
    const input = document.getElementById('adminReplyInput');
    const msg = input.value.trim();
    if (!sessionId || !msg) return;

    input.value = '';
    input.disabled = true;

    try {
      const fd = new FormData();
      fd.append('action', 'reply');
      fd.append('session_id', sessionId);
      fd.append('message', msg);
      fd.append('target_type', 'admin');

      const res = await fetch('../../api/live_chat.php', { method: 'POST', body: fd });
      const json = await res.json();
      if (json.status === 'success') {
        await loadAdminSessionTranscript(sessionId);
        loadAdminChatSessions();
      } else {
        alert(json.message || 'Gagal mengirim balasan.');
      }
    } catch (err) {
      alert('Koneksi gagal saat mengirim balasan.');
    } finally {
      input.disabled = false;
      input.focus();
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatTimeChat(isoStr) {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  document.addEventListener('DOMContentLoaded', loadAdminChatSessions);
</script>

<script src="../../assets/js/security.js"></script>
<script src="../../assets/js/live_chat.js"></script>
</body>
</html>
