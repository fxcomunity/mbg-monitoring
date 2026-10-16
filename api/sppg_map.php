<?php
// api/sppg_map.php — GeoJSON FeatureCollection for SPPG map
if (!function_exists('getDB')) { require_once __DIR__ . '/../database/db.php'; }
if (!class_exists('Security')) { require_once __DIR__ . '/../database/security.php'; }

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: public, max-age=60');

try {
    $pdo = getDB();

    // Parameters
    $provinsi = trim($_GET['provinsi'] ?? '');
    $bbox     = trim($_GET['bbox']     ?? '');  // minlat,minlng,maxlat,maxlng
    $limit    = min((int)($_GET['limit'] ?? 5000), 30000);
    if ($limit <= 0) { $limit = 5000; }

    $where  = ['latitude IS NOT NULL', 'longitude IS NOT NULL'];
    $params = [];

    if ($provinsi !== '') {
        $where[]  = 'provinsi ILIKE ?';
        $params[] = $provinsi;
    }

    if ($bbox !== '') {
        $parts = array_map('trim', explode(',', $bbox));
        if (count($parts) === 4) {
            [$minlat, $minlng, $maxlat, $maxlng] = $parts;
            $where[]  = 'latitude  BETWEEN ? AND ?';
            $params[] = (float)$minlat;
            $params[] = (float)$maxlat;
            $where[]  = 'longitude BETWEEN ? AND ?';
            $params[] = (float)$minlng;
            $params[] = (float)$maxlng;
        }
    }

    $whereClause = 'WHERE ' . implode(' AND ', $where);

    $sql = "SELECT id, nama, provinsi, kabupaten_kota, status, latitude, longitude
            FROM sppg
            {$whereClause}
            ORDER BY id
            LIMIT {$limit}";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $features = [];
    foreach ($rows as $r) {
        $features[] = [
            'type'       => 'Feature',
            'geometry'   => [
                'type'        => 'Point',
                'coordinates' => [(float)$r['longitude'], (float)$r['latitude']],
            ],
            'properties' => [
                'id'             => (int)$r['id'],
                'nama'           => $r['nama'],
                'provinsi'       => $r['provinsi'],
                'kabupaten_kota' => $r['kabupaten_kota'],
                'status'         => $r['status'],
            ],
        ];
    }

    echo json_encode([
        'type'     => 'FeatureCollection',
        'count'    => count($features),
        'features' => $features,
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    error_log('[api/sppg_map.php error] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Gagal mengambil data peta SPPG'
    ]);
}
