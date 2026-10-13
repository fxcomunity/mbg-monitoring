<?php
/**
 * api/juknis.php — REST API for BGN Juknis (Technical Guidelines) documents
 * Radar MBG - Badan Gizi Nasional
 */

require_once __DIR__ . '/../database/db.php';

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: public, max-age=3600');

$pdo = getDB();

try {
    $rows = $pdo->query("
        SELECT id, judul, deskripsi, pdf_url, sumber, kategori, tanggal_terbit, created_at
        FROM dokumen_juknis
        ORDER BY id ASC
    ")->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'status' => 'ok',
        'source' => 'BGN Pusat (bgnpusat.org/juknis)',
        'count' => count($rows),
        'data' => $rows
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
