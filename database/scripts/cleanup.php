<?php
/**
 * database/scripts/cleanup.php
 * Safe DB cleanup with confirmation gate.
 *
 * WARNING: NEVER deletes rows where source='MBGWatch'.
 *
 * Without ?confirm=YES_DELETE  → preview only (SELECT counts, no deletes)
 * With    ?confirm=YES_DELETE  → execute deletes and report before/after counts
 *
 * Radar MBG Nasional – Badan Gizi Nasional
 */
if (!function_exists('getDB')) { require_once __DIR__ . '/../../database/db.php'; }
if (!class_exists('Security')) { require_once __DIR__ . '/../../database/security.php'; }

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');

$confirm = trim($_GET['confirm'] ?? '');
$doDelete = ($confirm === 'YES_DELETE');

try {
    $pdo = getDB();

    // ── Preview counts ────────────────────────────────────────────────────────
    // Total rows, rows by source, rows targeted for deletion
    $stmtTotal = $pdo->query("SELECT COUNT(*) AS total FROM sppg");
    $totalBefore = (int)$stmtTotal->fetchColumn();

    $stmtSources = $pdo->query(
        "SELECT source, COUNT(*) AS cnt FROM sppg GROUP BY source ORDER BY cnt DESC"
    );
    $sourceCounts = $stmtSources->fetchAll();

    // Targeted rows: source != 'MBGWatch' AND (source ILIKE '%BGN%' OR data_bulan ILIKE '%2025%' OR data_bulan ILIKE '%Maret%')
    $stmtTarget = $pdo->query(
        "SELECT COUNT(*) AS cnt FROM sppg
         WHERE source != 'MBGWatch'
           AND (
               source     ILIKE '%BGN%'
             OR data_bulan ILIKE '%2025%'
             OR data_bulan ILIKE '%Maret%'
           )"
    );
    $targetCount = (int)$stmtTarget->fetchColumn();

    // Does dataset_sppg table exist?
    $stmtDataset = $pdo->query(
        "SELECT EXISTS (
             SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public'
               AND table_name   = 'dataset_sppg'
         ) AS exists"
    );
    $datasetExists = (bool)$stmtDataset->fetchColumn();

    if (!$doDelete) {
        // Preview mode – return counts only, nothing deleted
        echo json_encode([
            'status'         => 'preview',
            'warning'        => 'No data deleted. Pass ?confirm=YES_DELETE to execute.',
            'safety_note'    => "Rows with source='MBGWatch' are NEVER deleted.",
            'total_rows'     => $totalBefore,
            'source_counts'  => $sourceCounts,
            'target_delete'  => $targetCount,
            'dataset_sppg'   => $datasetExists ? 'exists (will be dropped)' : 'does not exist (skip)',
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        exit;
    }

    // ── Execute deletes ───────────────────────────────────────────────────────
    $results = [];

    // (a) DROP dataset_sppg if it exists
    if ($datasetExists) {
        $pdo->exec("DROP TABLE IF EXISTS dataset_sppg CASCADE");
        $results['dataset_sppg_dropped'] = true;
    } else {
        $results['dataset_sppg_dropped'] = false;
    }

    // (b) Delete targeted sppg rows (NEVER source='MBGWatch')
    $stmtDel = $pdo->prepare(
        "DELETE FROM sppg
         WHERE source != 'MBGWatch'
           AND (
               source     ILIKE '%BGN%'
             OR data_bulan ILIKE '%2025%'
             OR data_bulan ILIKE '%Maret%'
           )"
    );
    $stmtDel->execute();
    $deletedRows = $stmtDel->rowCount();

    // (c) After counts
    $stmtAfter = $pdo->query("SELECT COUNT(*) AS total FROM sppg");
    $totalAfter = (int)$stmtAfter->fetchColumn();

    $stmtSourcesAfter = $pdo->query(
        "SELECT source, COUNT(*) AS cnt FROM sppg GROUP BY source ORDER BY cnt DESC"
    );
    $sourceCountsAfter = $stmtSourcesAfter->fetchAll();

    echo json_encode([
        'status'               => 'success',
        'safety_note'          => "Rows with source='MBGWatch' were NEVER touched.",
        'dataset_sppg_dropped' => $results['dataset_sppg_dropped'],
        'rows_deleted'         => $deletedRows,
        'total_before'         => $totalBefore,
        'total_after'          => $totalAfter,
        'source_counts_after'  => $sourceCountsAfter,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    error_log('[cleanup.php error] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'DB cleanup failed: ' . $e->getMessage()
    ]);
}
