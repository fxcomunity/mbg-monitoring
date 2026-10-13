<?php
/**
 * api/notifications.php – Pusat Notifikasi Satgas & Portal MBG
 * Menghitung laporan masuk, peringatan WAF, dan verifikasi SPPG secara real-time
 */

require_once __DIR__ . '/../database/auth.php';
require_once __DIR__ . '/../database/db.php';
require_once __DIR__ . '/../database/security.php';

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache, no-store, must-revalidate');

$pdo = getDB();

$isAdmin = Auth::check() && Auth::user()['role'] === 'admin';

try {
    // 1. Hitung jumlah aduan baru status 'masuk'
    $laporanMasukCount = (int)$pdo->query("SELECT COUNT(*) FROM laporan_aduan WHERE status = 'masuk'")->fetchColumn();

    // 2. Ambil 5 laporan aduan terbaru
    $latestLaporan = $pdo->query("
        SELECT id, ticket_code, reporter_name, school_target, issue_category, status, created_at
        FROM laporan_aduan
        ORDER BY created_at DESC
        LIMIT 5
    ")->fetchAll(PDO::FETCH_ASSOC);

    // 3. Pending SPPG Logo approvals (khusus admin)
    $pendingSppgLogos = 0;
    if ($isAdmin) {
        $pendingSppgLogos = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'sppg' AND avatar_status = 'pending_approval'")->fetchColumn();
    }

    // 4. Total unread badge count
    $totalBadge = $laporanMasukCount + $pendingSppgLogos;

    echo json_encode([
        'status' => 'success',
        'badge_count' => $totalBadge,
        'laporan_masuk_count' => $laporanMasukCount,
        'pending_sppg_logos' => $pendingSppgLogos,
        'latest_reports' => $latestLaporan,
        'timestamp' => date('Y-m-d H:i:s')
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
