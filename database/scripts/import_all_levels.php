<?php
/**
 * import_all_levels.php — Fetch & Import Official BGN MBG Data from API
 * Levels: PAUD, SD, SMP, SMA, SMK, SLB, PKBM, SKB
 * Source: https://www.bgnpusat.org/api/v1/mbg/education-recaps
 */

require_once __DIR__ . '/db.php';

$pdo = getDB();
echo "=== BGN MBG Data Importer (All Levels) ===" . PHP_EOL;

// 1. Rename table to hold ALL levels, not just PAUD
$pdo->exec("
CREATE TABLE IF NOT EXISTS data_penerima_mbg (
    id INT PRIMARY KEY,
    year INT NOT NULL DEFAULT 2026,
    level VARCHAR(50) NOT NULL DEFAULT 'PAUD',
    province_code VARCHAR(20),
    regency_code VARCHAR(20),
    district_code VARCHAR(20),
    education_units INT DEFAULT 0,
    male_students INT DEFAULT 0,
    female_students INT DEFAULT 0,
    beneficiaries INT DEFAULT 0,
    allergies INT DEFAULT 0,
    phobias INT DEFAULT 0,
    intolerances INT DEFAULT 0,
    special_conditions INT DEFAULT 0,
    public_units INT DEFAULT 0,
    private_units INT DEFAULT 0,
    source_pulled_at TIMESTAMP,
    source_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    regency_name VARCHAR(150)
);
");
echo "[OK] Table data_penerima_mbg ready." . PHP_EOL;

// 2. Migrate existing data_penerima_paud into data_penerima_mbg
try {
    $existing = (int)$pdo->query("SELECT COUNT(*) FROM data_penerima_paud")->fetchColumn();
    if ($existing > 0) {
        $pdo->exec("
            INSERT INTO data_penerima_mbg
            SELECT * FROM data_penerima_paud
            ON CONFLICT (id) DO NOTHING
        ");
        echo "[OK] Migrated $existing rows from data_penerima_paud." . PHP_EOL;
    }
} catch (Throwable $e) {
    echo "[SKIP] No data_penerima_paud table or migration skipped: " . $e->getMessage() . PHP_EOL;
}

// 3. Prepare INSERT/UPSERT statement
$stmt = $pdo->prepare("
INSERT INTO data_penerima_mbg (
    id, year, level, province_code, regency_code, district_code,
    education_units, male_students, female_students, beneficiaries,
    allergies, phobias, intolerances, special_conditions,
    public_units, private_units, source_pulled_at, source_url,
    created_at, updated_at, regency_name
) VALUES (
    :id, :year, :level, :province_code, :regency_code, :district_code,
    :education_units, :male_students, :female_students, :beneficiaries,
    :allergies, :phobias, :intolerances, :special_conditions,
    :public_units, :private_units, :source_pulled_at, :source_url,
    :created_at, :updated_at, :regency_name
)
ON CONFLICT (id) DO UPDATE SET
    year = EXCLUDED.year,
    level = EXCLUDED.level,
    province_code = EXCLUDED.province_code,
    regency_code = EXCLUDED.regency_code,
    district_code = EXCLUDED.district_code,
    education_units = EXCLUDED.education_units,
    male_students = EXCLUDED.male_students,
    female_students = EXCLUDED.female_students,
    beneficiaries = EXCLUDED.beneficiaries,
    allergies = EXCLUDED.allergies,
    phobias = EXCLUDED.phobias,
    intolerances = EXCLUDED.intolerances,
    special_conditions = EXCLUDED.special_conditions,
    public_units = EXCLUDED.public_units,
    private_units = EXCLUDED.private_units,
    source_pulled_at = EXCLUDED.source_pulled_at,
    source_url = EXCLUDED.source_url,
    updated_at = EXCLUDED.updated_at,
    regency_name = EXCLUDED.regency_name;
");

// 4. Fetch all levels from BGN API
$levels = ['PAUD', 'SD', 'SMP', 'SMA', 'SMK', 'SLB', 'PKBM', 'SKB'];
$totalImported = 0;

foreach ($levels as $level) {
    $apiUrl = "https://www.bgnpusat.org/api/v1/mbg/education-recaps?level=" . urlencode($level) . "&year=2026";
    echo PHP_EOL . "[FETCH] Level=$level from: $apiUrl" . PHP_EOL;

    $ctx = stream_context_create([
        'http' => [
            'timeout' => 60,
            'header' => "Accept: application/json\r\nUser-Agent: RadarMBG/1.0 (Badan Gizi Nasional)\r\n"
        ],
        'ssl' => [
            'verify_peer' => false,
            'verify_peer_name' => false
        ]
    ]);

    $rawJson = @file_get_contents($apiUrl, false, $ctx);
    if ($rawJson === false) {
        echo "  [ERROR] Failed to fetch $level data from API." . PHP_EOL;
        continue;
    }

    $decoded = json_decode($rawJson, true);
    if (!$decoded || !isset($decoded['data']) || empty($decoded['data'])) {
        echo "  [WARN] No data returned for $level. JSON error: " . json_last_error_msg() . PHP_EOL;
        continue;
    }

    $records = $decoded['data'];
    echo "  [OK] Received " . count($records) . " records for $level." . PHP_EOL;

    $count = 0;
    $pdo->beginTransaction();
    foreach ($records as $row) {
        try {
            $stmt->execute([
                ':id' => $row['id'],
                ':year' => $row['year'] ?? 2026,
                ':level' => $row['level'] ?? $level,
                ':province_code' => $row['province_code'] ?? null,
                ':regency_code' => $row['regency_code'] ?? null,
                ':district_code' => $row['district_code'] ?? null,
                ':education_units' => $row['education_units'] ?? 0,
                ':male_students' => $row['male_students'] ?? 0,
                ':female_students' => $row['female_students'] ?? 0,
                ':beneficiaries' => $row['beneficiaries'] ?? 0,
                ':allergies' => $row['allergies'] ?? 0,
                ':phobias' => $row['phobias'] ?? 0,
                ':intolerances' => $row['intolerances'] ?? 0,
                ':special_conditions' => $row['special_conditions'] ?? 0,
                ':public_units' => $row['public_units'] ?? 0,
                ':private_units' => $row['private_units'] ?? 0,
                ':source_pulled_at' => !empty($row['source_pulled_at']) ? date('Y-m-d H:i:s', strtotime($row['source_pulled_at'])) : null,
                ':source_url' => $row['source_url'] ?? null,
                ':created_at' => !empty($row['created_at']) ? date('Y-m-d H:i:s', strtotime($row['created_at'])) : date('Y-m-d H:i:s'),
                ':updated_at' => !empty($row['updated_at']) ? date('Y-m-d H:i:s', strtotime($row['updated_at'])) : date('Y-m-d H:i:s'),
                ':regency_name' => $row['regency_name'] ?? null
            ]);
            $count++;
        } catch (Throwable $e) {
            echo "  [WARN] Row id={$row['id']} skip: " . $e->getMessage() . PHP_EOL;
        }
    }
    $pdo->commit();

    echo "  [DONE] Imported $count records for $level." . PHP_EOL;
    $totalImported += $count;
}

echo PHP_EOL . "======================================" . PHP_EOL;
echo "TOTAL IMPORTED: $totalImported records across " . count($levels) . " levels." . PHP_EOL;

// 5. Show summary per level
echo PHP_EOL . "=== Database Summary ===" . PHP_EOL;
$summary = $pdo->query("
    SELECT level, COUNT(*) as total_rows, 
           SUM(education_units) as total_satpen,
           SUM(beneficiaries) as total_penerima,
           SUM(allergies) as total_alergi,
           SUM(special_conditions) as total_kondisi_khusus
    FROM data_penerima_mbg 
    GROUP BY level 
    ORDER BY total_penerima DESC
")->fetchAll();

foreach ($summary as $s) {
    echo sprintf(
        "  %-6s => %4d rows | %6s satpen | %10s penerima | %6s alergi | %6s kondisi khusus",
        $s['level'],
        $s['total_rows'],
        number_format($s['total_satpen']),
        number_format($s['total_penerima']),
        number_format($s['total_alergi']),
        number_format($s['total_kondisi_khusus'])
    ) . PHP_EOL;
}

$grandTotal = $pdo->query("SELECT COUNT(*), SUM(beneficiaries) FROM data_penerima_mbg")->fetch();
echo PHP_EOL . "GRAND TOTAL: " . number_format($grandTotal[0]) . " rows, " . number_format($grandTotal[1]) . " penerima manfaat." . PHP_EOL;
