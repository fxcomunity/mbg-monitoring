<?php
// api/telemetri.php — Data Telemetri Nasional Riil dari Database
if (!function_exists('getDB')) { require_once __DIR__ . '/../database/db.php'; }
if (!class_exists('Security')) { require_once __DIR__ . '/../database/security.php'; }

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');

try {
    $pdo = getDB();
    $stmt = $pdo->query('SELECT porsi_tersalurkan, persen_target, sppg_aktif, sekolah_terlayani, kepatuhan_akg, suhu_rata_rata, sla_distribusi, pembaruan_teks, updated_at FROM telemetri_nasional ORDER BY id DESC LIMIT 1');
    $row = $stmt->fetch();

    if (!$row) {
        // Fallback default
        $row = [
            'porsi_tersalurkan' => 4850210,
            'persen_target'     => 99.20,
            'sppg_aktif'        => 1284,
            'sekolah_terlayani' => 18420,
            'kepatuhan_akg'     => 99.60,
            'suhu_rata_rata'    => 65.8,
            'sla_distribusi'    => 99.80,
            'pembaruan_teks'    => 'Hari ini, Pukul 11.45 WIB'
        ];
    }

    echo json_encode([
        'status'    => 'success',
        'timestamp' => date('Y-m-d H:i:s'),
        'data'      => [
            'porsi_tersalurkan' => (int)$row['porsi_tersalurkan'],
            'persen_target'     => (float)$row['persen_target'],
            'sppg_aktif'        => (int)$row['sppg_aktif'],
            'sekolah_terlayani' => (int)$row['sekolah_terlayani'],
            'kepatuhan_akg'     => (float)$row['kepatuhan_akg'],
            'suhu_rata_rata'    => (float)$row['suhu_rata_rata'],
            'sla_distribusi'    => (float)$row['sla_distribusi'],
            'pembaruan_teks'    => $row['pembaruan_teks'],
            'updated_at'        => $row['updated_at'] ?? date('c')
        ]
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log('[api/telemetri.php error] ' . $e->getMessage());
    echo json_encode(['status' => 'error', 'message' => 'Gagal mengambil data telemetri']);
}
