<?php
// api/sppg_map.php — GeoJSON FeatureCollection for SPPG map
require_once __DIR__ . '/../database/api_bootstrap.php';
if (!class_exists('Security')) { require_once __DIR__ . '/../database/security.php'; }

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

try {
    $pdo = getDB();

    // Parameters
    $provinsi = trim($_GET['provinsi'] ?? '');
    $bbox     = trim($_GET['bbox']     ?? '');  // minlat,minlng,maxlat,maxlng
    $limit    = min((int)($_GET['limit'] ?? 5000), 50000);
    if ($limit <= 0) { $limit = 5000; }

    $where  = [];
    $params = [];

    if ($provinsi !== '') {
        $where[]  = 'provinsi ILIKE ?';
        $params[] = $provinsi;
    }

    $bboxParts = $bbox !== '' ? array_map('trim', explode(',', $bbox)) : [];
    $bounds = count($bboxParts) === 4 ? array_map('floatval', $bboxParts) : null;
    if ($bounds !== null && ($bounds[0] > $bounds[2] || $bounds[1] > $bounds[3])) {
        $bounds = null;
    }

    $baseWhere = $where ? implode(' AND ', $where) : 'TRUE';
    $gpsStmt = $pdo->prepare("
        SELECT id, nama, provinsi, kabupaten_kota, alamat, nama_yayasan,
               status, data_bulan, latitude, longitude
        FROM sppg
        WHERE {$baseWhere} AND latitude IS NOT NULL AND longitude IS NOT NULL
        ORDER BY id
        LIMIT {$limit}
    ");
    $gpsStmt->execute($params);
    $gpsRows = $gpsStmt->fetchAll();

    $approximateStmt = $pdo->prepare("
        SELECT provinsi, kabupaten_kota, COUNT(*) AS sppg_count
        FROM sppg
        WHERE {$baseWhere} AND (latitude IS NULL OR longitude IS NULL)
        GROUP BY provinsi, kabupaten_kota
        ORDER BY provinsi, kabupaten_kota
        LIMIT {$limit}
    ");
    $approximateStmt->execute($params);
    $approximateRows = $approximateStmt->fetchAll();

    $centroidFile = __DIR__ . '/../database/data/indonesia-city-centroids.json';
    $centroidJson = file_get_contents($centroidFile);
    if ($centroidJson === false) {
        throw new RuntimeException('Data centroid kabupaten/kota tidak dapat dibaca');
    }
    $centroidData = json_decode($centroidJson, true, 512, JSON_THROW_ON_ERROR);
    $normalizeName = static function (?string $value): string {
        $value = strtoupper(trim((string)$value));
        $value = preg_replace('/^(KABUPATEN|KAB\\.|KOTA ADMINISTRASI|KOTA)\\s+/u', '', $value);
        $value = preg_replace('/\\s+/u', ' ', $value);
        return trim($value);
    };
    $provinceAliases = [
        'DAERAH ISTIMEWA YOGYAKARTA' => 'DI YOGYAKARTA',
    ];
    $centroidsByProvinceCity = [];
    $centroidsByCity = [];
    $centroidsByProvince = [];
    foreach ($centroidData['provinces'] as $centroid) {
        $provinceKey = $normalizeName($centroid['province'] ?? '');
        if ($provinceKey !== '') {
            $centroidsByProvince[$provinceKey] = $centroid;
        }
    }
    foreach ($centroidData['cities'] as $centroid) {
        $cityKey = $normalizeName($centroid['city'] ?? '');
        $provinceKey = $normalizeName($centroid['province'] ?? '');
        if ($cityKey === '' || $provinceKey === '') {
            continue;
        }
        $centroidsByProvinceCity[$provinceKey . '|' . $cityKey] = $centroid;
        $centroidsByCity[$cityKey][] = $centroid;
    }

    $features = [];
    $approximateFeatureIndexes = [];
    $mappedCount = 0;
    $approximateCount = 0;
    $gpsCount = 0;
    $unmapped = 0;
    foreach ($gpsRows as $r) {
        $latitude = (float)$r['latitude'];
        $longitude = (float)$r['longitude'];
        if ($bounds !== null && (
            $latitude < $bounds[0] || $latitude > $bounds[2] ||
            $longitude < $bounds[1] || $longitude > $bounds[3]
        )) continue;

        $mappedCount++;
        $gpsCount++;
        $features[] = [
            'type' => 'Feature',
            'geometry' => [
                'type' => 'Point',
                'coordinates' => [$longitude, $latitude],
            ],
            'properties' => [
                'id' => (int)$r['id'],
                'nama' => $r['nama'],
                'provinsi' => $r['provinsi'],
                'kabupaten_kota' => $r['kabupaten_kota'],
                'alamat' => $r['alamat'],
                'nama_yayasan' => $r['nama_yayasan'],
                'status' => $r['status'],
                'data_bulan' => $r['data_bulan'],
                'location_accuracy' => 'gps',
                'location_label' => 'Koordinat GPS terdaftar',
                'sppg_count' => 1,
            ],
        ];
    }

    foreach ($approximateRows as $r) {
        $groupCount = (int)$r['sppg_count'];
        $cityKey = $normalizeName($r['kabupaten_kota'] ?? '');
        $provinceName = $normalizeName($r['provinsi'] ?? '');
        $provinceKey = $provinceAliases[$provinceName] ?? $provinceName;
        $centroid = $centroidsByProvinceCity[$provinceKey . '|' . $cityKey] ?? null;

        if ($centroid === null && count($centroidsByCity[$cityKey] ?? []) === 1) {
            $centroid = $centroidsByCity[$cityKey][0];
        }
        $locationLabel = 'Perkiraan pusat kabupaten/kota';
        if ($centroid === null) {
            $centroid = $centroidsByProvince[$provinceKey] ?? null;
            $locationLabel = 'Perkiraan pusat provinsi';
        }
        if ($centroid === null) {
            $unmapped += $groupCount;
            continue;
        }

        $latitude = (float)$centroid['latitude'];
        $longitude = (float)$centroid['longitude'];
        if ($bounds !== null && (
            $latitude < $bounds[0] || $latitude > $bounds[2] ||
            $longitude < $bounds[1] || $longitude > $bounds[3]
        )) continue;

        $mappedCount += $groupCount;
        $approximateCount += $groupCount;
        $featureKey = implode('|', [
            $provinceKey,
            $cityKey,
            number_format($latitude, 6, '.', ''),
            number_format($longitude, 6, '.', ''),
        ]);
        if (!isset($approximateFeatureIndexes[$featureKey])) {
            $approximateFeatureIndexes[$featureKey] = count($features);
            $features[] = [
                'type' => 'Feature',
                'geometry' => [
                    'type' => 'Point',
                    'coordinates' => [$longitude, $latitude],
                ],
                'properties' => [
                    'id' => null,
                    'nama' => $r['kabupaten_kota'] ?: 'Wilayah ' . ($r['provinsi'] ?: 'SPPG'),
                    'provinsi' => $r['provinsi'],
                    'kabupaten_kota' => $r['kabupaten_kota'],
                    'alamat' => null,
                    'nama_yayasan' => null,
                    'status' => null,
                    'data_bulan' => null,
                    'location_accuracy' => 'approximate',
                    'location_label' => $locationLabel,
                    'sppg_count' => 0,
                    'sample_names' => [],
                ],
            ];
        }
        $featureIndex = $approximateFeatureIndexes[$featureKey];
        $features[$featureIndex]['properties']['sppg_count'] += $groupCount;
    }

    echo json_encode([
        'type'     => 'FeatureCollection',
        'count'    => $mappedCount,
        'approximate_count' => $approximateCount,
        'gps_count' => $gpsCount,
        'unmapped' => $unmapped,
        'features' => $features,
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    Security::logFailure('sppg_map.php', $e);
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Gagal mengambil data peta SPPG'
    ]);
}
