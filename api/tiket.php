<?php
// api/tiket.php – Tracking Tiket Laporan Aduan Publik BGN
$tiket = trim($_GET['tiket'] ?? $_GET['ticket'] ?? '');

if ($tiket === '') {
    echo json_encode(['status' => 'error', 'message' => 'Nomor tiket wajib disertakan']);
    exit;
}

try {
    $pdo = getDB();
    $stmt = $pdo->prepare('SELECT id, ticket_code, reporter_name, reporter_role, issue_category, school_target, incident_date, description, status, priority, satgas_notes, created_at FROM laporan_aduan WHERE ticket_code = $1');
    $stmt->execute([$tiket]);
    $row = $stmt->fetch();

    if ($row) {
        echo json_encode([
            'status' => 'success',
            'data'   => [
                'nomor_tiket'     => $row['ticket_code'],
                'kategori'        => $row['issue_category'],
                'target_sekolah'  => htmlspecialchars($row['school_target'], ENT_QUOTES, 'UTF-8'),
                'status'          => $row['status'],
                'priority'        => $row['priority'],
                'tanggal_lapor'   => $row['created_at'],
                'nama_pelapor'    => htmlspecialchars($row['reporter_name'], ENT_QUOTES, 'UTF-8'),
                'deskripsi'       => htmlspecialchars($row['description'], ENT_QUOTES, 'UTF-8'),
                'catatan_satgas'  => htmlspecialchars($row['satgas_notes'] ?? 'Dalam proses peninjauan Satgas BGN', ENT_QUOTES, 'UTF-8')
            ]
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    } else {
        echo json_encode(['status' => 'not_found', 'message' => 'Nomor tiket aduan tidak ditemukan di database resmi']);
    }
} catch (Throwable $e) {
    error_log('[api/tiket.php error] ' . $e->getMessage());
    echo json_encode(['status' => 'error', 'message' => 'Terjadi kesalahan sistem internal']);
}
