<?php
// api/sppg_status.php — Admin SPPG KPIs and status table
if (!function_exists('getDB')) { require_once __DIR__ . '/../database/db.php'; }
if (!class_exists('Security')) { require_once __DIR__ . '/../database/security.php'; }

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: public, max-age=300');

try {
    $pdo = getDB();

    // ── KPI counts from sppg table ────────────────────────────────────────────
    $stmtCounts = $pdo->query(
        "SELECT
             COUNT(*) FILTER (WHERE status ILIKE '%aktif%' OR status ILIKE '%operasional%') AS aktif,
             COUNT(*) FILTER (WHERE status ILIKE '%sertifikasi%' OR status ILIKE '%habis%')  AS sertifikasi_habis,
             COUNT(*) FILTER (WHERE status ILIKE '%suspend%')                                AS suspend,
             COUNT(*)                                                                         AS total
         FROM sppg"
    );
    $counts = $stmtCounts->fetch();

    // ── Row data from users table (role = 'sppg') ────────────────────────────
    $stmtUsers = $pdo->prepare(
        "SELECT id, full_name, username, sppg_name, sppg_code, created_at
         FROM users
         WHERE role = 'sppg'
         ORDER BY full_name
         LIMIT 100"
    );
    $stmtUsers->execute();
    $userRows = $stmtUsers->fetchAll();

    $data = [];
    foreach ($userRows as $u) {
        $data[] = [
            'name'        => $u['sppg_name'] ?: ($u['full_name'] ?: $u['username']),
            'city'        => $u['sppg_code'] ?: $u['username'],
            'status'      => 'aktif',
            'cert_expiry' => '—',
            'capacity'    => 500,
            'last_menu'   => '—',
        ];
    }

    echo json_encode([
        'status' => 'success',
        'counts' => [
            'aktif'            => (int)($counts['aktif']            ?? 0),
            'sertifikasi_habis'=> (int)($counts['sertifikasi_habis'] ?? 0),
            'suspend'          => (int)($counts['suspend']           ?? 0),
            'total'            => (int)($counts['total']             ?? 0),
        ],
        'data' => $data,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    error_log('[api/sppg_status.php error] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Gagal mengambil data status SPPG'
    ]);
}
