<?php
// Safe DB cleanup: removes BGN/Maret-2025 rows, preserves MBGWatch (30k rows)
// Usage: php database/scripts/cleanup.php [YES_DELETE]
//        or: http://localhost/MBG-MONITORING/database/scripts/cleanup.php?confirm=YES_DELETE

if (!function_exists('getDB')) {
    require_once __DIR__ . '/../../database/db.php';
}

header('Content-Type: application/json');

$confirm = $_GET['confirm'] ?? $argv[1] ?? '';
$dryRun = ($confirm !== 'YES_DELETE');

try {
    $pdo = getDB();
    // Count before
    $total_before = $pdo->query('SELECT COUNT(*) FROM sppg')->fetchColumn();
    $by_source_stmt = $pdo->query('SELECT source, COUNT(*) as cnt FROM sppg GROUP BY source ORDER BY cnt DESC');
    $by_source_before = $by_source_stmt->fetchAll(PDO::FETCH_ASSOC);

    $result = [
        'dry_run' => $dryRun,
        'before' => ['total' => $total_before, 'by_source' => $by_source_before],
        'actions' => []
    ];

    if (!$dryRun) {
        // Step A: Drop dataset_sppg table if exists
        $pdo->exec('DROP TABLE IF EXISTS dataset_sppg CASCADE');
        $result['actions'][] = 'DROP TABLE IF EXISTS dataset_sppg';

        // Step B: Delete non-MBGWatch rows matching BGN/Maret/2025
        $stmt = $pdo->prepare(
            "DELETE FROM sppg WHERE source != 'MBGWatch'
             AND (source ILIKE '%BGN%' OR data_bulan ILIKE '%2025%' OR data_bulan ILIKE '%Maret%')"
        );
        $stmt->execute();
        $deleted = $stmt->rowCount();
        $result['actions'][] = "Deleted $deleted rows";

        // Count after
        $total_after = $pdo->query('SELECT COUNT(*) FROM sppg')->fetchColumn();
        $by_source_after = $pdo->query('SELECT source, COUNT(*) as cnt FROM sppg GROUP BY source ORDER BY cnt DESC')->fetchAll(PDO::FETCH_ASSOC);
        $result['after'] = ['total' => $total_after, 'by_source' => $by_source_after];
        $result['deleted'] = $deleted;
    } else {
        $result['message'] = 'DRY RUN — add ?confirm=YES_DELETE to execute deletions';
        // Preview what would be deleted
        $preview = $pdo->query(
            "SELECT source, data_bulan, COUNT(*) as cnt FROM sppg
             WHERE source != 'MBGWatch'
               AND (source ILIKE '%BGN%' OR data_bulan ILIKE '%2025%' OR data_bulan ILIKE '%Maret%')
             GROUP BY source, data_bulan"
        )->fetchAll(PDO::FETCH_ASSOC);
        $result['would_delete'] = $preview;
    }

    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
