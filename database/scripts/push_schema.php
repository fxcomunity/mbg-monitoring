<?php
/**
 * push_schema.php - Migration Script for Neon PostgreSQL
 * Pushes all SQL files from database/ to the live database.
 */

require_once __DIR__ . '/../db.php';

header('Content-Type: text/plain; charset=UTF-8');

try {
    $pdo = getDB();
    echo "✅ Connected to Neon PostgreSQL successfully.\n";

    $sqlFiles = [
        'schema_all.sql',
        'setup_users.sql'
    ];

    foreach ($sqlFiles as $file) {
        $filePath = __DIR__ . '/../' . $file;
        if (!file_exists($filePath)) {
            echo "⚠️ File not found: $file, skipping...\n";
            continue;
        }

        echo "🚀 Pushing $file... ";
        $sql = file_get_contents($filePath);
        
        // Execute the entire file content as one single command to preserve trigger/function definitions
        $pdo->exec($sql);
        echo "DONE\n";
    }

    echo "\n✨ All SQL changes have been pushed to Neon successfully, broo!\n";

} catch (Throwable $e) {
    echo "\n❌ ERROR: " . $e->getMessage() . "\n";
    exit(1);
}
