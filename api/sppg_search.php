<?php
/**
 * API: Search SPPG berdasarkan nama, ID, atau alamat
 * Route: GET /api/sppg_search.php?q=<query>
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

$query = isset($_GET['q']) ? trim($_GET['q']) : '';
$page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
$limit = isset($_GET['limit']) ? min(50, max(1, intval($_GET['limit']))) : 10;
$offset = ($page - 1) * $limit;

if (strlen($query) < 2) {
    echo json_encode(['status' => 'success', 'count' => 0, 'data' => [], 'page' => 1, 'total_pages' => 0, 'total' => 0]);
    exit;
}

try {
    // "sppg jakarta" -> setiap kata harus cocok di salah satu kolom (urutan kata bebas)
    $tokens = array_slice(array_values(array_filter(preg_split('/\s+/', $query))), 0, 5);
    $cols = ['nama', 'alamat', 'provinsi', 'kabupaten_kota', 'kecamatan'];
    $conds = [];
    $params = [];
    foreach ($tokens as $tok) {
        $like = '%' . addcslashes($tok, '%_\\') . '%';
        $conds[] = '(' . implode(' OR ', array_map(function ($c) { return "$c ILIKE ?"; }, $cols)) . ')';
        foreach ($cols as $_) { $params[] = $like; }
    }
    $where = implode(' AND ', $conds);
    if (ctype_digit($query)) {
        $where = "(id::text = ? OR ($where))";
        array_unshift($params, $query);
    }

    $countStmt = $pdo->prepare("SELECT COUNT(*) AS total FROM sppg WHERE $where");
    $countStmt->execute($params);
    $totalCount = (int)$countStmt->fetch(PDO::FETCH_ASSOC)['total'];
    $totalPages = (int)ceil($totalCount / $limit);

    $stmt = $pdo->prepare("
        SELECT id, nama, provinsi, kabupaten_kota, kecamatan, kelurahan_desa,
               alamat, nama_yayasan, status, data_bulan, latitude, longitude,
               kepatuhan_score, total_antaran, masalah_terakhir,
               tanggal_terakhir_antaran, status_verifikasi
        FROM sppg
        WHERE $where
        ORDER BY CASE WHEN id::text = ? THEN 0 ELSE 1 END, nama ASC
        LIMIT ? OFFSET ?
    ");
    $stmt->execute(array_merge($params, [$query, $limit, $offset]));
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Format results
    $data = array_map(function($row) {
        return [
            'id' => (int)$row['id'],
            'nama' => $row['nama'],
            'provinsi' => $row['provinsi'],
            'kabupaten_kota' => $row['kabupaten_kota'],
            'kecamatan' => $row['kecamatan'],
            'kelurahan_desa' => $row['kelurahan_desa'],
            'alamat' => $row['alamat'],
            'nama_yayasan' => $row['nama_yayasan'],
            'status' => $row['status'],
            'data_bulan' => $row['data_bulan'],
            'kepatuhan_score' => (int)$row['kepatuhan_score'],
            'total_antaran' => (int)$row['total_antaran'],
            'masalah_terakhir' => $row['masalah_terakhir'],
            'tanggal_terakhir_antaran' => $row['tanggal_terakhir_antaran'],
            'status_verifikasi' => $row['status_verifikasi'],
            'has_gps' => ($row['latitude'] && $row['longitude']) ? true : false
        ];
    }, $results);

    echo json_encode([
        'status' => 'success',
        'count' => count($data),
        'query' => $query,
        'data' => $data,
        'page' => $page,
        'limit' => $limit,
        'total' => $totalCount,
        'total_pages' => $totalPages
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}