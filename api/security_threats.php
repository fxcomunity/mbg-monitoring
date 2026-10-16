<?php
// api/security_threats.php — Admin security log reader (exploit_logs table)
if (!function_exists('getDB')) { require_once __DIR__ . '/../database/db.php'; }
if (!class_exists('Security')) { require_once __DIR__ . '/../database/security.php'; }

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');

try {
    $pdo = getDB();

    $stmt = $pdo->query(
        "SELECT ip_address  AS ip,
                exploit_type AS type,
                requested_url AS url,
                created_at    AS ts
         FROM exploit_logs
         ORDER BY created_at DESC
         LIMIT 50"
    );
    $rows = $stmt->fetchAll();

    echo json_encode([
        'status' => 'success',
        'count'  => count($rows),
        'data'   => $rows,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (PDOException $e) {
    // 42P01 = undefined_table — exploit_logs doesn't exist yet, return empty
    if (str_contains($e->getCode(), '42P01') || str_contains($e->getMessage(), '42P01')) {
        echo json_encode([
            'status' => 'success',
            'count'  => 0,
            'data'   => [],
        ], JSON_PRETTY_PRINT);
        exit;
    }
    error_log('[api/security_threats.php error] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Gagal mengambil log keamanan'
    ]);
} catch (Throwable $e) {
    error_log('[api/security_threats.php error] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Gagal mengambil log keamanan'
    ]);
}
