<?php
/**
 * Import SQL file ke PostgreSQL Neon via PDO
 * Jalankan: php database/scripts/import_runner.php
 */

// ── Koneksi ─────────────────────────────────────────────────
$host    = 'ep-green-snow-b565oin5-pooler.c-7.us-east-2.aws.neon.tech';
$port    = '5432';
$dbname  = 'neondb';
$user    = 'neondb_owner';
$pass    = 'npg_KeaS1c4jMAiY';
$sslmode = 'require';

$dsn = "pgsql:host=$host;port=$port;dbname=$dbname;sslmode=$sslmode";

echo "Connecting to Neon PostgreSQL...\n";

try {
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    echo "Connected!\n";
} catch (PDOException $e) {
    echo "Connection FAILED: " . $e->getMessage() . "\n";
    exit(1);
}

// ── Baca file SQL ────────────────────────────────────────────
$sqlFile = __DIR__ . '/../import_sppg_mbgwatch.sql';

if (!file_exists($sqlFile)) {
    echo "File not found: $sqlFile\n";
    exit(1);
}

echo "Reading SQL file (" . round(filesize($sqlFile) / 1024 / 1024, 2) . " MB)...\n";
$sql = file_get_contents($sqlFile);

// ── Jalankan dalam transaksi ─────────────────────────────────
echo "Starting import...\n";
$start = microtime(true);

try {
    $pdo->beginTransaction();

    // Split per statement (DELETE dan INSERT besar)
    // Strategi: jalankan DELETE dulu, lalu INSERT
    $statements = array_filter(
        array_map('trim', explode(";\n\n", $sql)),
        fn($s) => $s !== ''
    );

    $count = 0;
    foreach ($statements as $stmt) {
        if (empty(trim($stmt))) continue;
        // Hilangkan komentar leading
        $stmt = preg_replace('/^--.*$/m', '', $stmt);
        $stmt = trim($stmt);
        if (empty($stmt)) continue;

        $pdo->exec($stmt);
        $count++;
        echo "Statement $count done\n";
    }

    $pdo->commit();

    $elapsed = round(microtime(true) - $start, 2);
    echo "\n✓ Import selesai! $count statement dieksekusi dalam {$elapsed}s\n";

} catch (PDOException $e) {
    $pdo->rollBack();
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}

// ── Verifikasi ───────────────────────────────────────────────
echo "\nVerifikasi row count...\n";
$stmt = $pdo->query("SELECT COUNT(*) AS total FROM sppg WHERE source = 'MBGWatch'");
$row  = $stmt->fetch();
echo "Total SPPG (MBGWatch) di database: " . $row['total'] . "\n";
