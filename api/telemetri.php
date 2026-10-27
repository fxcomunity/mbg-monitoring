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
        http_response_code(503);
        echo json_encode([
            'status'  => 'error',
            'message' => 'Data telemetri belum tersedia di basis data'
        ], JSON_UNESCAPED_UNICODE);
        exit;
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
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Gagal mengambil data telemetri']);
}
