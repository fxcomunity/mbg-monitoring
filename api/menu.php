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

$pdo = null;

$schoolKey    = trim($_GET['school_key'] ?? '');
$allSchools   = isset($_GET['all_schools']) || isset($_GET['list_all']);
$query        = trim($_GET['school'] ?? $_GET['q'] ?? '');
$filterProv   = trim($_GET['provinsi'] ?? '');
$filterKota   = trim($_GET['kota'] ?? '');
$filterJenjang= trim($_GET['jenjang'] ?? '');
$filterDate   = trim($_GET['date'] ?? '');

function parseKomposisiList(string $komposisiRaw): array {
    $parts = preg_split('/[;+]/', $komposisiRaw);
    $clean = [];
    foreach ($parts as $p) {
        $trimmed = trim($p);
        if ($trimmed !== '') {
            $clean[] = ucwords(strtolower($trimmed));
        }
    }
    return array_values(array_unique($clean));
}

function detectJenjang(string $namaInstansi): string {
    $u = strtoupper($namaInstansi);
    if (str_contains($u, 'KB') || str_contains($u, 'PAUD') || str_contains($u, 'TK')) {
        return 'paud';
    }
    if (str_contains($u, 'SMP') || str_contains($u, 'MTS')) {
        return 'smp';
    }
    if (str_contains($u, 'SMA') || str_contains($u, 'SMK') || str_contains($u, 'MA')) {
        return 'sma';
    }
    return 'sd';
}

function mapInstansiRow(array $r): array {
    $jenjang = detectJenjang($r['nama_instansi']);
    $komposisiRaw = $r['komposisi'] ?: $r['nama_menu'];
    $komposisiList = parseKomposisiList($komposisiRaw);

    return [
        'key'          => $r['id_instansi'],
        'name'         => $r['nama_instansi'],
        'provinsi'     => $r['kode_prov_dagri'],
        'provinsiName' => $r['nama_provinsi'],
        'kota'         => $r['kode_kabko_dagri'],
        'kotaName'     => $r['nama_kabko'],
        'kecamatan'    => $r['nama_kecamatan'],
        'jenjang'      => $jenjang,
        'ageGroup'     => null,
        'arrival'      => null,
        'cycle'        => 'Siklus Menu: Tanggal ' . date('d F Y', strtotime($r['tanggal_menu'] ?? 'today')),
        'packageName'  => $r['nama_menu'],
        'desc'         => 'Komposisi resmi: ' . $komposisiRaw,
        'calories'     => $r['energi_kkal'] !== null ? (int)round((float)$r['energi_kkal']) : null,
        'protein'      => $r['protein_g'],
        'lemak'        => $r['lemak_g'],
        'karbohidrat'   => $r['karbohidrat_g'],
        'serat'        => $r['serat_g'],
        'porsi'        => $r['porsi'],
        'komposisiList'=> $komposisiList,
        'photo'        => (!empty($r['gambar_url']) && filter_var($r['gambar_url'], FILTER_VALIDATE_URL)) ? $r['gambar_url'] : null,
        'sppg'         => [
            'name'           => $r['nama_sppg'],
            'address'        => $r['alamat'],
        ]
    ];
}

try {
    $pdo = getDB();
    // --------------------------------------------------------------------------
    // 1. Ambil Detail Tunggal Menu Berdasarkan school_key / id_instansi
    // --------------------------------------------------------------------------
    if ($schoolKey !== '') {
        // Cek dulu di tabel instansi + menu_harian
        $stmt = $pdo->prepare("
            SELECT m.*, i.nama_instansi, i.kode_prov_dagri, p.nama_provinsi, i.kode_kabko_dagri, k.nama_kabko,
                   i.kode_kec_dagri, kc.nama_kecamatan, s.nama_sppg, s.alamat, s.kode_sppg,
                   g.energi_kkal, g.protein_g, g.lemak_g, g.karbohidrat_g, g.serat_g,
                   gm.gambar_url
            FROM menu_harian m
            JOIN instansi i ON m.id_instansi = i.id_instansi
            LEFT JOIN provinsi p ON i.kode_prov_dagri = p.kode_prov_dagri
            LEFT JOIN kabupaten_kota k ON i.kode_kabko_dagri = k.kode_kabko_dagri
            LEFT JOIN kecamatan kc ON i.kode_kec_dagri = kc.kode_kec_dagri
            LEFT JOIN sppg s ON i.id_sppg = s.id_sppg
            LEFT JOIN gizi_menu g ON m.id_menu = g.id_menu
            LEFT JOIN gambar_menu gm ON m.id_menu = gm.id_menu
            WHERE (i.id_instansi = ? OR LOWER(i.nama_instansi) = LOWER(?))
              AND m.tanggal_menu = CURRENT_DATE
            ORDER BY (CASE WHEN m.porsi = 'large' THEN 0 ELSE 1 END)
            LIMIT 1
        ");
        $stmt->execute([$schoolKey, $schoolKey]);
        $row = $stmt->fetch();

        if ($row) {
            echo json_encode([
                'status' => 'success',
                'source' => 'postgresql_neon_instansi',
                'data'   => mapInstansiRow($row)
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            exit;
        }

        // Jika tidak ada di menu_harian today, cek apakah ada di menu_sppg
        $stmtSppg = $pdo->prepare("
            SELECT * FROM menu_sppg 
            WHERE (school_key = ? OR LOWER(school_target) = LOWER(?))
            ORDER BY (CASE WHEN menu_date = CURRENT_DATE THEN 0 ELSE 1 END), menu_date DESC LIMIT 1
        ");
        $stmtSppg->execute([$schoolKey, $schoolKey]);
        $rowSppg = $stmtSppg->fetch();

        if ($rowSppg) {
            echo json_encode([
                'status' => 'success',
                'source' => 'postgresql_neon_menu_sppg',
                'data'   => [
                    'key'          => $rowSppg['school_key'] ?: ('sch-' . $rowSppg['id']),
                    'name'         => $rowSppg['school_target'],
                    'provinsi'     => $rowSppg['province_code'],
                    'provinsiName' => $rowSppg['province_name'],
                    'kota'         => $rowSppg['city_code'],
                    'kotaName'     => $rowSppg['city'],
                    'kecamatan'    => $rowSppg['kecamatan'],
                    'jenjang'      => $rowSppg['jenjang'],
                    'ageGroup'     => $rowSppg['age_group'],
                    'arrival'      => $rowSppg['arrival_status'],
                    'cycle'        => $rowSppg['menu_cycle'],
                    'packageName'  => $rowSppg['menu_title'],
                    'desc'         => $rowSppg['description'],
                    'calories'     => $rowSppg['calories'] !== null ? (int)$rowSppg['calories'] : null,
                    'protein'      => null,
                    'lemak'        => null,
                    'karbohidrat'   => null,
                    'serat'        => null,
                    'komposisiList'=> parseKomposisiList($rowSppg['menu_title'] . '; ' . ($rowSppg['description'] ?? '')),
                    'photo'        => $rowSppg['photo_url'],
                    'sppg'         => [
                        'name'           => $rowSppg['sppg_name'],
                        'address'        => $rowSppg['sppg_address'],
                        'radius'         => $rowSppg['sppg_radius'],
                        'dietitian'      => $rowSppg['dietitian'],
                        'dietitianTitle' => $rowSppg['dietitian_title'],
                        'lab'            => $rowSppg['lab_test_cert'],
                        'temp'           => $rowSppg['temperature'] !== null ? $rowSppg['temperature'] . '°C' : null
                    ]
                ]
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            exit;
        }

        http_response_code(404);
        echo json_encode(['status' => 'error', 'message' => 'Satuan pendidikan tidak ditemukan.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // --------------------------------------------------------------------------
    // 2. Ambil Seluruh Data Sekolah & Wilayah HARI INI (Untuk Dropdown Dinamis)
    // --------------------------------------------------------------------------
    if ($allSchools) {
        $todayDate = date('Y-m-d');
        $schoolsMap = [];
        $regionCascade = [];

        // A. Ambil dari tabel menu_harian + instansi untuk HARI INI
        $stmtHarian = $pdo->prepare("
            SELECT DISTINCT ON (i.id_instansi)
                   m.*, i.nama_instansi, i.kode_prov_dagri, p.nama_provinsi, i.kode_kabko_dagri, k.nama_kabko,
                   i.kode_kec_dagri, kc.nama_kecamatan, s.nama_sppg, s.alamat, s.kode_sppg,
                   g.energi_kkal, g.protein_g, g.lemak_g, g.karbohidrat_g, g.serat_g,
                   gm.gambar_url
            FROM menu_harian m
            JOIN instansi i ON m.id_instansi = i.id_instansi
            LEFT JOIN provinsi p ON i.kode_prov_dagri = p.kode_prov_dagri
            LEFT JOIN kabupaten_kota k ON i.kode_kabko_dagri = k.kode_kabko_dagri
            LEFT JOIN kecamatan kc ON i.kode_kec_dagri = kc.kode_kec_dagri
            LEFT JOIN sppg s ON i.id_sppg = s.id_sppg
            LEFT JOIN gizi_menu g ON m.id_menu = g.id_menu
            LEFT JOIN gambar_menu gm ON m.id_menu = gm.id_menu
            WHERE m.tanggal_menu = ?
            ORDER BY i.id_instansi, (CASE WHEN m.porsi = 'large' THEN 0 ELSE 1 END)
        ");
        $stmtHarian->execute([$todayDate]);
        $rowsHarian = $stmtHarian->fetchAll();

        foreach ($rowsHarian as $rh) {
            $key = $rh['id_instansi'];
            $schoolsMap[$key] = mapInstansiRow($rh);

            $pCode = $rh['kode_prov_dagri'];
            $pName = $rh['nama_provinsi'];
            $cCode = $rh['kode_kabko_dagri'];
            $cName = $rh['nama_kabko'];

            if (!isset($regionCascade[$pCode])) {
                $regionCascade[$pCode] = [
                    'name' => $pName,
                    'cities' => []
                ];
            }
            $cExists = false;
            foreach ($regionCascade[$pCode]['cities'] as $c) {
                if ($c['id'] === $cCode) {
                    $cExists = true;
                    break;
                }
            }
            if (!$cExists) {
                $regionCascade[$pCode]['cities'][] = [
                    'id'   => $cCode,
                    'name' => $cName
                ];
            }
        }

        // B. Ambil juga dari menu_sppg HANYA jika menu_date = TODAY
        $stmtSppg = $pdo->prepare("SELECT DISTINCT ON (school_key) * FROM menu_sppg WHERE menu_date = ? ORDER BY school_key, id DESC");
        $stmtSppg->execute([$todayDate]);
        $rowsSppg = $stmtSppg->fetchAll();

        foreach ($rowsSppg as $r) {
            $key = $r['school_key'] ?: ('sch-' . $r['id']);
            if (isset($schoolsMap[$key])) continue;

            $pCode = $r['province_code'];
            $pName = $r['province_name'];
            $cCode = $r['city_code'];
            $cName = $r['city'];

            $schoolsMap[$key] = [
                'key'          => $key,
                'name'         => $r['school_target'],
                'provinsi'     => $pCode,
                'provinsiName' => $pName,
                'kota'         => $cCode,
                'kotaName'     => $cName,
                'kecamatan'    => $r['kecamatan'],
                'jenjang'      => $r['jenjang'],
                'ageGroup'     => $r['age_group'],
                'arrival'      => $r['arrival_status'],
                'cycle'        => $r['menu_cycle'],
                'packageName'  => $r['menu_title'],
                'desc'         => $r['description'],
                'calories'     => $r['calories'] !== null ? (int)$r['calories'] : null,
                'protein'      => null,
                'lemak'        => null,
                'karbohidrat'   => null,
                'serat'        => null,
                'komposisiList'=> parseKomposisiList($r['menu_title'] . '; ' . ($r['description'] ?? '')),
                'photo'        => $r['photo_url'],
                'sppg'         => [
                    'name'           => $r['sppg_name'],
                    'address'        => $r['sppg_address'],
                    'radius'         => $r['sppg_radius'],
                    'dietitian'      => $r['dietitian'],
                    'dietitianTitle' => $r['dietitian_title'],
                    'lab'            => $r['lab_test_cert'],
                    'temp'           => $r['temperature'] !== null ? $r['temperature'] . '°C' : null
                ]
            ];

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

        // C. Lengkapi daftar kota di tiap provinsi dari kabupaten_kota jika ada
        foreach ($regionCascade as $pCode => &$pData) {
            $stmtAllKab = $pdo->prepare("SELECT kode_kabko_dagri, nama_kabko FROM kabupaten_kota WHERE kode_prov_dagri = ? ORDER BY nama_kabko ASC");
            $stmtAllKab->execute([$pCode]);
            $allKab = $stmtAllKab->fetchAll();
            foreach ($allKab as $ak) {
                $found = false;
                foreach ($pData['cities'] as $c) {
                    if ($c['id'] === $ak['kode_kabko_dagri']) {
                        $found = true;
                        break;
                    }
                }
                if (!$found) {
                    $pData['cities'][] = [
                        'id'   => $ak['kode_kabko_dagri'],
                        'name' => $ak['nama_kabko']
                    ];
                }
            }
        }
        unset($pData);

        echo json_encode([
            'status'         => 'success',
            'source'         => 'postgresql_neon',
            'today_date'     => $todayDate,
            'total_schools'  => count($schoolsMap),
            'schools'        => $schoolsMap,
            'region_cascade' => $regionCascade
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        exit;
    }

    // --------------------------------------------------------------------------
    // 3. Pencarian & Filter Query Dinamis
    // --------------------------------------------------------------------------
    $todayDate = date('Y-m-d');
    $sql = "
        SELECT m.*, i.nama_instansi, i.kode_prov_dagri, p.nama_provinsi, i.kode_kabko_dagri, k.nama_kabko,
               i.kode_kec_dagri, kc.nama_kecamatan, s.nama_sppg, s.alamat,
               g.energi_kkal, g.protein_g, g.lemak_g, g.karbohidrat_g, g.serat_g
        FROM menu_harian m
        JOIN instansi i ON m.id_instansi = i.id_instansi
        LEFT JOIN provinsi p ON i.kode_prov_dagri = p.kode_prov_dagri
        LEFT JOIN kabupaten_kota k ON i.kode_kabko_dagri = k.kode_kabko_dagri
        LEFT JOIN kecamatan kc ON i.kode_kec_dagri = kc.kode_kec_dagri
        LEFT JOIN sppg s ON i.id_sppg = s.id_sppg
        LEFT JOIN gizi_menu g ON m.id_menu = g.id_menu
        WHERE m.tanggal_menu = ?
    ";
    $params = [$todayDate];

    if ($query !== '') {
        $sql .= " AND (i.nama_instansi ILIKE ? OR k.nama_kabko ILIKE ? OR s.nama_sppg ILIKE ? OR m.nama_menu ILIKE ?)";
        $p = "%{$query}%";
        $params = array_merge($params, [$p, $p, $p, $p]);
    }
    if ($filterProv !== '') {
        $sql .= " AND i.kode_prov_dagri = ?";
        $params[] = $filterProv;
    }
    if ($filterKota !== '') {
        $sql .= " AND i.kode_kabko_dagri = ?";
        $params[] = $filterKota;
    }

    $sql .= " ORDER BY i.nama_instansi ASC LIMIT 50";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $results = [];
    foreach ($rows as $r) {
        $results[] = [
            'id'          => $r['id_menu'],
            'school_key'  => $r['id_instansi'],
            'school'      => $r['nama_instansi'],
            'city'        => $r['nama_kabko'],
            'provinsi'    => $r['nama_provinsi'],
            'date'        => $r['tanggal_menu'],
            'menu'        => $r['nama_menu'],
            'description' => $r['komposisi'],
            'calories'    => $r['energi_kkal'] !== null ? $r['energi_kkal'] . ' kkal' : null,
            'sppg'        => [
                'name'      => $r['nama_sppg']
            ],
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
    error_log('[api/menu.php error] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Gagal mengambil data menu dari basis data'
    ], JSON_UNESCAPED_UNICODE);
}
