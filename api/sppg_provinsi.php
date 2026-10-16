<?php
// api/sppg_provinsi.php — SPPG list filtered by province
if (!function_exists('getDB')) { require_once __DIR__ . '/../database/db.php'; }
if (!class_exists('Security')) { require_once __DIR__ . '/../database/security.php'; }

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: public, max-age=300');

try {
    $pdo = getDB();

    $provinsi = trim($_GET['provinsi'] ?? '');

    if ($provinsi === '') {
        http_response_code(400);
        echo json_encode([
            'status'  => 'error',
            'message' => 'Parameter ?provinsi= diperlukan'
        ]);
        exit;
    }

    $sql = "SELECT id, nama, provinsi, kabupaten_kota, kecamatan, alamat,
                   latitude, longitude, status
            FROM sppg
            WHERE provinsi ILIKE ?
            ORDER BY kabupaten_kota, nama
            LIMIT 500";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$provinsi]);
    $rows = $stmt->fetchAll();

    $data = [];
    foreach ($rows as $r) {
        $data[] = [
            'id'             => (int)$r['id'],
            'nama'           => $r['nama'],
            'provinsi'       => $r['provinsi'],
            'kabupaten_kota' => $r['kabupaten_kota'],
            'kecamatan'      => $r['kecamatan'],
            'alamat'         => $r['alamat'],
            'latitude'       => $r['latitude'] !== null ? (float)$r['latitude'] : null,
            'longitude'      => $r['longitude'] !== null ? (float)$r['longitude'] : null,
            'status'         => $r['status'],
        ];
    }

    echo json_encode([
        'status'    => 'success',
        'provinsi'  => $provinsi,
        'count'     => count($data),
        'data'      => $data,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    error_log('[api/sppg_provinsi.php error] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Gagal mengambil data SPPG provinsi'
    ]);
}
