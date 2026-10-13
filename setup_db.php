<?php
// setup_db.php – Run once to create database and tables
require __DIR__ . '/database/db.php';

// Connect without dbname first to create the database
$dsn = sprintf('mysql:host=%s;port=%s;charset=%s', DB_HOST, DB_PORT, DB_CHARSET);
$pdo = new PDO($dsn, DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

$sql = file_get_contents(__DIR__ . '/database/schema.sql');

// Split by semicolons and run each statement
$statements = array_filter(array_map('trim', explode(';', $sql)));
foreach ($statements as $stmt) {
    if (!empty($stmt)) {
        try {
            $pdo->exec($stmt);
        } catch (PDOException $e) {
            // Ignore duplicate entry errors for demo data
            if ($e->getCode() !== '23000') {
                echo "Error: " . $e->getMessage() . "\n";
            }
        }
    }
}
echo "Database 'radar_mbg' dan tabel berhasil dibuat!\n";
