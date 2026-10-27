<?php
require_once __DIR__ . '/../database/db.php';

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: public, max-age=60');

try {
    $pdo = getDB();
    $query = trim($_GET['q'] ?? '');
    $sql = '
        SELECT school_target, city, province_name, menu_date, menu_title,
               description, calories, sppg_name
        FROM menu_sppg
        WHERE menu_date = CURRENT_DATE
    ';
    $params = [];

    if ($query !== '') {
        $sql .= ' AND (school_target ILIKE ? OR sppg_name ILIKE ? OR menu_title ILIKE ?)';
        $search = '%' . $query . '%';
        $params = [$search, $search, $search];
    }

    $sql .= ' ORDER BY school_target ASC LIMIT 50';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $data = array_map(static function (array $row): array {
        return [
            'school' => $row['school_target'],
            'city' => $row['city'],
            'provinsi' => $row['province_name'],
            'date' => $row['menu_date'],
            'menu' => $row['menu_title'],
            'description' => $row['description'],
            'calories' => $row['calories'],
            'sppg' => ['name' => $row['sppg_name']]
        ];
    }, $rows);

    echo json_encode([
        'status' => 'success',
        'timestamp' => date('c'),
        'count' => count($data),
        'data' => $data
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log('[api/home_menu.php error] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Gagal mengambil data menu dari basis data'
    ], JSON_UNESCAPED_UNICODE);
}
