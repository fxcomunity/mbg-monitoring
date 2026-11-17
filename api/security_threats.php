<?php
// api/security_threats.php — Admin security log reader (exploit_logs table)
require_once __DIR__ . '/../database/api_bootstrap.php';
require_once __DIR__ . '/../database/auth.php';

Auth::requireApiRole('admin');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    header('Allow: GET');
    Security::rejectRequest(405, 'Metode HTTP tidak didukung.');
}

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');

try {
    $pdo = getDB();

    $stmt = $pdo->query(
        "SELECT id, ip_address, exploit_type, input_field, requested_url, created_at
         FROM exploit_logs
         ORDER BY created_at DESC
         LIMIT 50"
    );
    // Jangan SELECT payload_sample/user_agent, termasuk untuk log lama.
    $rows = array_map([Security::class, 'safeLogRow'], $stmt->fetchAll());

    echo json_encode([
        'status' => 'success',
        'count'  => count($rows),
        'data'   => $rows,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (PDOException $e) {
    // Tabel hilang bukan bukti bahwa tidak ada ancaman/log.
    if ((string)$e->getCode() === '42P01') {
        Security::logFailure('security_threats.php', $e);
        Security::rejectRequest(503, 'Log keamanan belum tersedia. Terapkan skema exploit_logs dari database/schema_all.sql lalu coba kembali.');
    }
    Security::logFailure('security_threats.php', $e);
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Gagal mengambil log keamanan'
    ]);
} catch (Throwable $e) {
    Security::logFailure('security_threats.php', $e);
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Gagal mengambil log keamanan'
    ]);
}
