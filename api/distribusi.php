<?php
// api/distribusi.php — Data Distribusi Provinsi Riil dari Database
if (!function_exists('getDB')) { require_once __DIR__ . '/../database/db.php'; }
if (!class_exists('Security')) { require_once __DIR__ . '/../database/security.php'; }

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: public, max-age=300');

try {
    $pdo = getDB();
    $region = trim($_GET['region'] ?? '');
    
    $sql = 'SELECT provinsi, target_porsi, ketepatan, status, region_code, updated_at,
                   MAX(updated_at) OVER () AS latest_updated_at
            FROM distribusi_provinsi';
    $params = [];
    if ($region !== '' && $region !== 'semua') {
        $sql .= ' WHERE region_code = ?';
        $params[] = $region;
    }
    $sql .= ' ORDER BY target_porsi DESC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $data = [];
    foreach ($rows as $r) {
        $data[] = [
            'provinsi'     => $r['provinsi'],
            'target_porsi' => (int)$r['target_porsi'],
            'ketepatan'    => (float)$r['ketepatan'],
            'status'       => $r['status'],
            'region_code'  => $r['region_code']
        ];
    }

    echo json_encode([
        'status'    => 'success',
        'count'     => count($data),
        'timestamp' => $rows[0]['latest_updated_at'] ?? null,
        'data'      => $data
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log('[api/distribusi.php error] ' . $e->getMessage());
    echo json_encode(['status' => 'error', 'message' => 'Gagal mengambil data distribusi']);
}
