<?php
/**
 * api/data_mbg.php — REST API for MBG Education Recaps (All Levels)
 * Radar MBG - Badan Gizi Nasional
 *
 * GET ?level=SD              → Filter by education level
 * GET ?province=020000       → Filter by province code
 * GET ?regency=020800        → Filter by regency code
 * GET ?summary=1             → Summary per level (aggregate)
 * GET (no params)            → Returns province-level summary per level
 */

require_once __DIR__ . '/../database/db.php';
require_once __DIR__ . '/../database/security.php';

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: public, max-age=300');

$pdo = getDB();

$level    = Security::cleanInput($_GET['level'] ?? '', 10);
$province = Security::cleanInput($_GET['province'] ?? '', 10);
$regency  = Security::cleanInput($_GET['regency'] ?? '', 10);
$summary  = (int)($_GET['summary'] ?? 0);

try {
    // Summary mode: aggregate per level
    if ($summary) {
        $rows = $pdo->query("
            SELECT level, 
                   COUNT(*) as total_rows,
                   SUM(education_units) as total_satpen,
                   SUM(beneficiaries) as total_penerima,
                   SUM(male_students) as total_laki,
                   SUM(female_students) as total_perempuan,
                   SUM(allergies) as total_alergi,
                   SUM(phobias) as total_fobia,
                   SUM(intolerances) as total_intoleransi,
                   SUM(special_conditions) as total_kondisi_khusus,
                   SUM(public_units) as total_negeri,
                   SUM(private_units) as total_swasta
            FROM data_penerima_mbg
            WHERE regency_code IS NULL AND district_code IS NULL
            GROUP BY level
            ORDER BY total_penerima DESC
        ")->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'status' => 'ok',
            'source' => 'BGN Pusat (bgnpusat.org)',
            'year' => 2026,
            'data' => $rows
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }

    // Build query
    $where = [];
    $params = [];

    if ($level) {
        $where[] = 'level = ?';
        $params[] = strtoupper($level);
    }
    if ($province) {
        $where[] = 'province_code = ?';
        $params[] = $province;
    }
    if ($regency) {
        $where[] = 'regency_code = ?';
        $params[] = $regency;
    }

    $sql = "SELECT * FROM data_penerima_mbg";
    if ($where) {
        $sql .= " WHERE " . implode(' AND ', $where);
    }
    $sql .= " ORDER BY beneficiaries DESC LIMIT 500";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'status' => 'ok',
        'source' => 'BGN Pusat (bgnpusat.org)',
        'year' => 2026,
        'count' => count($rows),
        'data' => $rows
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Database query failed: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
