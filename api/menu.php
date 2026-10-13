<?php
/**
 * api/menu.php – Live Menu & Sekolah Endpoint Neon PostgreSQL
 * Menghubungkan hierarki filter (Provinsi, Kota, Jenjang, Sekolah) 
 * dan rincian menu riil serta dapur SPPG langsung dari database.
 */

require_once __DIR__ . '/../database/db.php';
require_once __DIR__ . '/../database/security.php';

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');

$pdo = getDB();

$schoolKey    = trim($_GET['school_key'] ?? '');
$allSchools   = isset($_GET['all_schools']) || isset($_GET['list_all']);
$query        = trim($_GET['school'] ?? $_GET['q'] ?? '');
$filterProv   = trim($_GET['provinsi'] ?? '');
$filterKota   = trim($_GET['kota'] ?? '');
$filterJenjang= trim($_GET['jenjang'] ?? '');
$filterDate   = trim($_GET['date'] ?? '');

try {
    // --------------------------------------------------------------------------
    // 1. Ambil Detail Tunggal Menu Berdasarkan school_key
    // --------------------------------------------------------------------------
    if ($schoolKey !== '') {
        $stmt = $pdo->prepare("
            SELECT * FROM menu_sppg 
            WHERE school_key = ? OR LOWER(school_target) = LOWER(?)
            ORDER BY menu_date DESC LIMIT 1
        ");
        $stmt->execute([$schoolKey, $schoolKey]);
        $row = $stmt->fetch();

        if ($row) {
            echo json_encode([
                'status' => 'success',
                'source' => 'postgresql_neon',
                'data'   => [
                    'key'          => $row['school_key'] ?: ('sch-' . $row['id']),
                    'name'         => $row['school_target'],
                    'provinsi'     => $row['province_code'] ?: 'dki',
                    'provinsiName' => $row['province_name'] ?: 'DKI Jakarta',
                    'kota'         => $row['city_code'] ?: 'jaksel',
                    'kotaName'     => $row['city'] ?: 'Jakarta',
                    'kecamatan'    => $row['kecamatan'] ?: 'Pusat',
                    'jenjang'      => $row['jenjang'] ?: 'sd',
                    'ageGroup'     => $row['age_group'] ?: 'Dipersiapkan khusus dengan pemenuhan standar AKG Harian BGN.',
                    'arrival'      => $row['arrival_status'] ?: 'Telah Tiba di Sekolah (Pukul 09:30 WIB)',
                    'cycle'        => $row['menu_cycle'] ?: 'Siklus Menu: Pekan ke-4',
                    'packageName'  => $row['menu_title'],
                    'desc'         => $row['description'] ?: 'Porsi standar gizi seimbang terkalibrasi BGN.',
                    'calories'     => (int)$row['calories'],
                    'photo'        => $row['photo_url'] ?: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCkLbSHziTgMS4wjfXnmGJaa87bd_N3KasCcc2H4qhnJv0-x1bXQDvleyxCuK58099ZoZfRbhBN8WpUfixGsZsefv_a7MSmNJ3smRd3oXRskR5Vg7Nxz16LFyr9C-wrk8QimhpK8Y0YYqWL4eT4Hl9kHVFimf3FAjdcJfglmxj3dWfqWiVQN0QL-uaA1bRCAWeW3sSvk0sUJAEDLbARjtbg1VzCHnlLwoPl9Ghqvw8_OF7pN35D3hpA',
                    'sppg'         => [
                        'name'           => $row['sppg_name'],
                        'address'        => $row['sppg_address'] ?: 'Dapur SPPG BGN',
                        'radius'         => $row['sppg_radius'] ?: 'Radius 2.5 km',
                        'dietitian'      => $row['dietitian'] ?: 'Dietisien BGN',
                        'dietitianTitle' => $row['dietitian_title'] ?: 'Dietisien Verifikator BGN',
                        'lab'            => $row['lab_test_cert'] ?: 'Lolos Uji Mutu & Sensoris BGN',
                        'temp'           => ($row['temperature'] ?: 65.0) . '°C'
                    ]
                ]
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            exit;
        } else {
            http_response_code(404);
            echo json_encode(['status' => 'error', 'message' => 'Sekolah tidak ditemukan di database.'], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }

    // --------------------------------------------------------------------------
    // 2. Ambil Seluruh Data Sekolah & Wilayah (Untuk Dropdown Dinamis)
    // --------------------------------------------------------------------------
    if ($allSchools) {
        $stmt = $pdo->query("SELECT * FROM menu_sppg ORDER BY school_target ASC");
        $rows = $stmt->fetchAll();

        $schoolsMap = [];
        $regionCascade = [];

        foreach ($rows as $r) {
            $key = $r['school_key'] ?: ('sch-' . $r['id']);
            $pCode = $r['province_code'] ?: 'dki';
            $pName = $r['province_name'] ?: 'DKI Jakarta';
            $cCode = $r['city_code'] ?: 'jaksel';
            $cName = $r['city'] ?: 'Jakarta';

            // Masukkan ke Map Sekolah
            $schoolsMap[$key] = [
                'name'         => $r['school_target'],
                'provinsi'     => $pCode,
                'provinsiName' => $pName,
                'kota'         => $cCode,
                'kotaName'     => $cName,
                'kecamatan'    => $r['kecamatan'] ?: '',
                'jenjang'      => $r['jenjang'] ?: 'sd',
                'ageGroup'     => $r['age_group'] ?: 'Dipersiapkan dengan standar gizi AKG BGN.',
                'arrival'      => $r['arrival_status'] ?: 'Telah Tiba di Sekolah (Pukul 09:30 WIB)',
                'cycle'        => $r['menu_cycle'] ?: 'Siklus Menu Aktif',
                'packageName'  => $r['menu_title'],
                'desc'         => $r['description'] ?: 'Menu higienis kaya mikronutrien standar BGN.',
                'calories'     => (int)$r['calories'],
                'photo'        => $r['photo_url'] ?: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCkLbSHziTgMS4wjfXnmGJaa87bd_N3KasCcc2H4qhnJv0-x1bXQDvleyxCuK58099ZoZfRbhBN8WpUfixGsZsefv_a7MSmNJ3smRd3oXRskR5Vg7Nxz16LFyr9C-wrk8QimhpK8Y0YYqWL4eT4Hl9kHVFimf3FAjdcJfglmxj3dWfqWiVQN0QL-uaA1bRCAWeW3sSvk0sUJAEDLbARjtbg1VzCHnlLwoPl9Ghqvw8_OF7pN35D3hpA',
                'sppg'         => [
                    'name'           => $r['sppg_name'],
                    'address'        => $r['sppg_address'] ?: 'Dapur SPPG BGN',
                    'radius'         => $r['sppg_radius'] ?: 'Radius 2.5 km',
                    'dietitian'      => $r['dietitian'] ?: 'Nutrisionis BGN',
                    'dietitianTitle' => $r['dietitian_title'] ?: 'Dietisien Verifikator BGN',
                    'lab'            => $r['lab_test_cert'] ?: 'Lolos Uji Sensoris & Kimia BGN',
                    'temp'           => ($r['temperature'] ?: 65.0) . '°C'
                ]
            ];

            // Masukkan ke Hierarki Wilayah (Region Cascade)
            if (!isset($regionCascade[$pCode])) {
                $regionCascade[$pCode] = [
                    'name' => $pName,
                    'cities' => []
                ];
            }
            $exists = false;
            foreach ($regionCascade[$pCode]['cities'] as $c) {
                if ($c['id'] === $cCode) {
                    $exists = true;
                    break;
                }
            }
            if (!$exists) {
                $regionCascade[$pCode]['cities'][] = [
                    'id'   => $cCode,
                    'name' => $cName
                ];
            }
        }

        echo json_encode([
            'status'         => 'success',
            'source'         => 'postgresql_neon',
            'total_schools'  => count($schoolsMap),
            'schools'        => $schoolsMap,
            'region_cascade' => $regionCascade
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        exit;
    }

    // --------------------------------------------------------------------------
    // 3. Pencarian & Filter Query Dinamis
    // --------------------------------------------------------------------------
    $sql = 'SELECT * FROM menu_sppg WHERE 1=1';
    $params = [];

    if ($query !== '') {
        $sql .= ' AND (school_target ILIKE ? OR city ILIKE ? OR sppg_name ILIKE ? OR menu_title ILIKE ?)';
        $p = "%{$query}%";
        $params = array_merge($params, [$p, $p, $p, $p]);
    }
    if ($filterProv !== '') {
        $sql .= ' AND province_code = ?';
        $params[] = $filterProv;
    }
    if ($filterKota !== '') {
        $sql .= ' AND (city_code = ? OR city ILIKE ?)';
        $params[] = $filterKota;
        $params[] = "%{$filterKota}%";
    }
    if ($filterJenjang !== '') {
        $sql .= ' AND jenjang = ?';
        $params[] = $filterJenjang;
    }
    if ($filterDate !== '') {
        $sql .= ' AND menu_date = ?';
        $params[] = $filterDate;
    }

    $sql .= ' ORDER BY menu_date DESC, id DESC LIMIT 50';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $results = [];
    foreach ($rows as $r) {
        $results[] = [
            'id'          => 'SPPG-M-' . $r['id'],
            'school_key'  => $r['school_key'] ?: ('sch-' . $r['id']),
            'school'      => $r['school_target'],
            'city'        => $r['city'],
            'provinsi'    => $r['province_name'] ?: 'DKI Jakarta',
            'date'        => $r['menu_date'],
            'menu'        => $r['menu_title'],
            'description' => $r['description'] ?: 'Porsi standar gizi seimbang terkalibrasi BGN.',
            'calories'    => $r['calories'] . ' kkal',
            'temperature' => $r['temperature'] . '°C',
            'sppg'        => [
                'name'      => $r['sppg_name'],
                'dietitian' => $r['dietitian']
            ],
            'status'      => $r['status']
        ];
    }

    echo json_encode([
        'status'    => 'success',
        'source'    => 'postgresql_neon',
        'timestamp' => date('Y-m-d H:i:s'),
        'count'     => count($results),
        'data'      => $results
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Gagal mengambil data dari database: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
