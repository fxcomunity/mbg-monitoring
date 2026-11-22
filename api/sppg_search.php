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

$query = isset($_GET['q']) ? trim($_GET['q']) : '';
$limit = isset($_GET['limit']) ? intval($_GET['limit']) : 10;

if (strlen($query) < 2) {
    echo json_encode(['status' => 'success', 'count' => 0, 'data' => []]);
    exit;
}

try {
    // Search by ID (exact), nama (partial), alamat (partial), provinsi, kabupaten
    $searchTerm = '%' . $query . '%';
    $stmt = $pdo->prepare("
        SELECT id, nama, provinsi, kabupaten_kota, alamat, nama_yayasan,
               status, data_bulan, latitude, longitude
        FROM sppg
        WHERE id::text = ?
           OR nama ILIKE ?
           OR alamat ILIKE ?
           OR provinsi ILIKE ?
           OR kabupaten_kota ILIKE ?
        ORDER BY
          CASE WHEN id::text = ? THEN 0 ELSE 1 END,
          nama ASC
        LIMIT ?
    ");
    $stmt->execute([$query, $searchTerm, $searchTerm, $searchTerm, $searchTerm, $query, $limit]);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Format results
    $data = array_map(function($row) {
        return [
            'id' => (int)$row['id'],
            'nama' => $row['nama'],
            'provinsi' => $row['provinsi'],
            'kabupaten_kota' => $row['kabupaten_kota'],
            'alamat' => $row['alamat'],
            'nama_yayasan' => $row['nama_yayasan'],
            'status' => $row['status'],
            'data_bulan' => $row['data_bulan'],
            'has_gps' => ($row['latitude'] && $row['longitude']) ? true : false
        ];
    }, $results);

    echo json_encode([
        'status' => 'success',
        'count' => count($data),
        'query' => $query,
        'data' => $data
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
