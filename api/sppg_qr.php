<?php
/**
 * API: Generate data QR code untuk verifikasi SPPG
 * Route: GET /api/sppg_qr.php?id=<sppg_id>
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/../database/db.php';

$pdo = getDB();

$sppgId = isset($_GET['id']) ? intval($_GET['id']) : null;

if (!$sppgId) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Parameter id wajib.']);
    exit;
}

try {
    $stmt = $pdo->prepare("
        SELECT id, nama, provinsi, kabupaten_kota, kecamatan, kelurahan_desa,
               alamat, nama_yayasan, status, data_bulan, latitude, longitude,
               created_at, updated_at, kepatuhan_score, total_antaran,
               masalah_terakhir, tanggal_terakhir_antaran, status_verifikasi
        FROM sppg
        WHERE id = ?
    ");
    $stmt->execute([$sppgId]);
    $sppg = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$sppg) {
        http_response_code(404);
        echo json_encode(['status' => 'error', 'message' => 'SPPG tidak ditemukan.']);
        exit;
    }

    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $baseUrl = $protocol . '://' . $host;

    $qrData = [
        'id' => (int)$sppg['id'],
        'nama' => $sppg['nama'],
        'provinsi' => $sppg['provinsi'],
        'kabupaten_kota' => $sppg['kabupaten_kota'],
        'kecamatan' => $sppg['kecamatan'],
        'kelurahan_desa' => $sppg['kelurahan_desa'],
        'alamat' => $sppg['alamat'],
        'nama_yayasan' => $sppg['nama_yayasan'],
        'status' => $sppg['status'],
        'data_bulan' => $sppg['data_bulan'],
        'kepatuhan_score' => (int)$sppg['kepatuhan_score'],
        'total_antaran' => (int)$sppg['total_antaran'],
        'masalah_terakhir' => $sppg['masalah_terakhir'],
        'tanggal_terakhir_antaran' => $sppg['tanggal_terakhir_antaran'],
        'status_verifikasi' => $sppg['status_verifikasi'],
        'koordinat' => ($sppg['latitude'] && $sppg['longitude']) ? [
            'lat' => (float)$sppg['latitude'],
            'lng' => (float)$sppg['longitude']
        ] : null,
        'verified_at' => date('c'),
        'verification_url' => $baseUrl . '/verify-sppg.html?id=' . $sppg['id'] . '&direct=1'
    ];

    echo json_encode([
        'status' => 'success',
        'sppg' => $qrData,
        'qr_content' => json_encode($qrData, JSON_UNESCAPED_UNICODE)
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
