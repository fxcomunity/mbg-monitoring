<?php
// api/tiket.php – Tracking Tiket Laporan Aduan Publik BGN
require_once __DIR__ . '/../database/api_bootstrap.php';
require_once __DIR__ . '/../database/auth.php';

function normalizeReportPhoto(string $sourcePath, string $targetPath, string $sourceMime): bool {
    if (!function_exists('imagecreatefromstring') || !function_exists('imagejpeg')) {
        return false;
    }

    $imageInfo = @getimagesize($sourcePath);
    if (!$imageInfo || ($imageInfo['mime'] ?? '') !== $sourceMime) {
        return false;
    }
    $width = (int)$imageInfo[0];
    $height = (int)$imageInfo[1];
    if ($width < 1 || $height < 1 || $width > 8000 || $height > 8000 || $width * $height > 12000000) {
        return false;
    }

    $sourceBytes = file_get_contents($sourcePath);
    if ($sourceBytes === false) {
        return false;
    }
    $sourceImage = @imagecreatefromstring($sourceBytes);
    unset($sourceBytes);
    if ($sourceImage === false) {
        return false;
    }

    $cleanImage = imagecreatetruecolor($width, $height);
    if ($cleanImage === false) {
        imagedestroy($sourceImage);
        return false;
    }
    $background = imagecolorallocate($cleanImage, 255, 255, 255);
    imagefill($cleanImage, 0, 0, $background);
    imagecopy($cleanImage, $sourceImage, 0, 0, 0, 0, $width, $height);
    $saved = imagejpeg($cleanImage, $targetPath, 88);
    imagedestroy($sourceImage);
    imagedestroy($cleanImage);
    return $saved;
}

function removeTemporaryReportPhoto(?string $path): void {
    if ($path !== null && is_file($path) && !unlink($path)) {
        error_log('[Report] Uploaded photo temp file could not be removed.');
    }
}

function cleanupExpiredLocalReports(): void {
    $pdo = getDB();
    $directory = __DIR__ . '/../uploads/laporan';
    $pdo->beginTransaction();
    try {
        $expired = $pdo->query(
            "SELECT id, photo_path
             FROM laporan_aduan
             WHERE created_at <= NOW() - INTERVAL '30 days'
               AND (photo_path IS NULL OR photo_path LIKE '/api/tiket.php?photo=%')
             ORDER BY created_at ASC
             LIMIT 100
             FOR UPDATE"
        )->fetchAll();
        if (!$expired) {
            $pdo->commit();
            return;
        }
        $delete = $pdo->prepare(
            "DELETE FROM laporan_aduan
             WHERE id = ? AND created_at <= NOW() - INTERVAL '30 days'"
        );
        foreach ($expired as $report) {
            $photoPath = $report['photo_path'] ?? null;
            if ($photoPath !== null) {
                parse_str((string)parse_url($photoPath, PHP_URL_QUERY), $query);
                $filename = is_string($query['photo'] ?? null) ? $query['photo'] : '';
                if (preg_match('/^TKT-BGN-\d{8}-[A-F0-9]{32,64}$/i', $filename)) {
                    $filename = '';
                } elseif (!preg_match('/^[a-f0-9]{32}\.(jpg|png|webp)$/i', $filename)) {
                    throw new RuntimeException('Path lampiran laporan lama tidak valid.');
                }
                if ($filename !== '') {
                    $photoFile = $directory . DIRECTORY_SEPARATOR . $filename;
                    if (is_file($photoFile) && !unlink($photoFile)) {
                        throw new RuntimeException('Lampiran laporan lama tidak dapat dihapus.');
                    }
                }
            }
            $delete->execute([(int)$report['id']]);
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

cleanupExpiredLocalReports();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json; charset=UTF-8');
    $action = is_string($_POST['action'] ?? null) ? $_POST['action'] : '';
    if ($action === 'admin_update') {
        Auth::requireApiRole('admin');
        $actor = Auth::user();
        $ticketCode = trim(is_string($_POST['ticket_code'] ?? null) ? $_POST['ticket_code'] : '');
        $status = is_string($_POST['status'] ?? null) ? $_POST['status'] : '';
        $notes = trim(is_string($_POST['satgas_notes'] ?? null) ? $_POST['satgas_notes'] : '');
        $validStatuses = ['masuk', 'verifikasi', 'proses', 'selesai', 'ditolak'];
        if ($ticketCode === '' || strlen($ticketCode) > 60 || !preg_match('/^[A-Za-z0-9-]+$/D', $ticketCode)
            || !in_array($status, $validStatuses, true) || strlen($notes) > 2000) {
            http_response_code(422);
            echo json_encode(['status' => 'error', 'message' => 'Data pembaruan aduan tidak valid.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        try {
            $pdo = getDB();
            $stmt = $pdo->prepare(
                "WITH target AS (
                    SELECT id, status FROM laporan_aduan WHERE ticket_code = ? FOR UPDATE
                 ), updated AS (
                    UPDATE laporan_aduan AS report
                    SET status = ?, satgas_notes = NULLIF(?, ''), updated_at = NOW()
                    FROM target
                    WHERE report.id = target.id
                    RETURNING report.id, target.status AS old_status, report.status AS new_status
                 )
                 INSERT INTO aduan_log (laporan_id, old_status, new_status, changed_by, notes)
                 SELECT id, old_status, new_status, ?, NULLIF(?, '')
                 FROM updated
                 RETURNING laporan_id"
            );
            $stmt->execute([$ticketCode, $status, $notes, (string)($actor['username'] ?? 'admin'), $notes]);
            if (!$stmt->fetchColumn()) {
                http_response_code(404);
                echo json_encode(['status' => 'error', 'message' => 'Tiket tidak ditemukan di server.'], JSON_UNESCAPED_UNICODE);
                exit;
            }
            echo json_encode(['status' => 'success', 'message' => 'Aduan berhasil diperbarui.'], JSON_UNESCAPED_UNICODE);
        } catch (Throwable $error) {
            Security::logFailure('tiket_admin_update', $error);
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => 'Pembaruan aduan gagal disimpan.'], JSON_UNESCAPED_UNICODE);
        }
        exit;
    }

    $name = trim($_POST['reporter_name'] ?? '');
    $phone = trim($_POST['reporter_phone'] ?? '');
    $role = trim($_POST['reporter_role'] ?? '');
    $category = trim($_POST['issue_category'] ?? '');
    $school = trim($_POST['school_target'] ?? '');
    $incidentDate = trim($_POST['incident_date'] ?? '');
    $description = trim($_POST['description'] ?? '');
    $roles = ['wali', 'guru', 'komite', 'siswa', 'masyarakat'];
    $categories = ['waktu', 'menu', 'suhu', 'higienitas', 'alergen', 'lainnya'];
    $date = DateTime::createFromFormat('!Y-m-d', $incidentDate);
    $validDate = $date && $date->format('Y-m-d') === $incidentDate;
    $photoPath = null;
    $photoName = null;
    $savedPhoto = null;

    if ($name === '' || strlen($name) > 120
        || !preg_match('/^[0-9+()\-\s]{8,20}$/', $phone)
        || !in_array($role, $roles, true)
        || !in_array($category, $categories, true)
        || $school === '' || strlen($school) > 200
        || !$validDate
        || $description === '' || strlen($description) > 10000) {
        http_response_code(422);
        echo json_encode(['status' => 'error', 'message' => 'Periksa kembali data wajib laporan.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $ticketCode = 'TKT-BGN-' . str_replace('-', '', $incidentDate) . '-' . strtoupper(bin2hex(random_bytes(16)));

    if (isset($_FILES['photo']) && $_FILES['photo']['error'] !== UPLOAD_ERR_NO_FILE) {
        $photo = $_FILES['photo'];
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime = $photo['error'] === UPLOAD_ERR_OK ? $finfo->file($photo['tmp_name']) : false;
        $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        if ($photo['error'] !== UPLOAD_ERR_OK || $photo['size'] > 10 * 1024 * 1024 || !isset($extensions[$mime])) {
            http_response_code(422);
            echo json_encode(['status' => 'error', 'message' => 'Foto harus JPG, PNG, atau WEBP dan maksimal 10 MB.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $savedPhoto = tempnam(sys_get_temp_dir(), 'mbg-report-');
        if ($savedPhoto === false) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => 'Penyimpanan sementara foto tidak tersedia.'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        if (!normalizeReportPhoto($photo['tmp_name'], $savedPhoto, $mime)) {
            removeTemporaryReportPhoto($savedPhoto);
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => 'Foto tidak dapat diverifikasi atau diproses dengan aman. Pilih file JPG, PNG, atau WEBP yang valid.'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $photoPath = '/api/tiket.php?photo=' . rawurlencode($ticketCode);
        $photoName = basename($photo['name']);
    }

    try {
        $pdo = getDB();
        $photoBytes = $savedPhoto ? file_get_contents($savedPhoto) : null;
        if ($savedPhoto && $photoBytes === false) {
            throw new RuntimeException('Foto sementara tidak dapat dibaca untuk disimpan ke database.');
        }
        $photoBase64 = is_string($photoBytes) ? base64_encode($photoBytes) : null;
        $stmt = $pdo->prepare(
            "INSERT INTO laporan_aduan (
                ticket_code, reporter_name, reporter_phone, reporter_role,
                issue_category, school_target, incident_date, description,
                photo_path, photo_original_name, photo_data, status, priority, ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, decode(?, 'base64'), 'masuk', 'sedang', ?, ?)
            RETURNING ticket_code"
        );
        $stmt->execute([
            $ticketCode, $name, $phone, $role, $category, $school, $incidentDate, $description,
            $photoPath, $photoName, $photoBase64, $_SERVER['REMOTE_ADDR'] ?? null,
            substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 500)
        ]);
        removeTemporaryReportPhoto($savedPhoto);
        echo json_encode([
            'status' => 'success',
            'ticket_code' => $stmt->fetchColumn(),
            'message' => 'Laporan berhasil disimpan.'
        ], JSON_UNESCAPED_UNICODE);
    } catch (Throwable $e) {
        removeTemporaryReportPhoto($savedPhoto);
        Security::logFailure('tiket_submit', $e);
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Laporan gagal disimpan. Coba lagi beberapa saat.'], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

if (($_GET['action'] ?? '') === 'admin_list') {
    header('Content-Type: application/json; charset=UTF-8');
    Auth::requireApiRole('admin');
    try {
        $reports = getDB()->query(
            "SELECT ticket_code, reporter_name, reporter_role, issue_category, school_target,
                    incident_date, description, photo_path, status, priority, satgas_notes,
                    created_at, updated_at
             FROM laporan_aduan
             ORDER BY created_at DESC
             LIMIT 100"
        )->fetchAll();
        echo json_encode(['status' => 'success', 'data' => $reports], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } catch (Throwable $error) {
        Security::logFailure('tiket_admin_list', $error);
        http_response_code(503);
        echo json_encode(['status' => 'error', 'message' => 'Daftar aduan tidak dapat dimuat dari server.'], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

if (isset($_GET['photo'])) {
    $currentUser = Auth::check() ? Auth::user() : null;
    if (($currentUser['role'] ?? '') !== 'admin') {
        http_response_code(403);
        exit('Akses lampiran hanya untuk Admin Satgas.');
    }
    $photoReference = (string)$_GET['photo'];
    if (preg_match('/^TKT-BGN-\d{8}-[A-F0-9]{32,64}$/i', $photoReference)) {
        $stmt = getDB()->prepare(
            "SELECT replace(encode(photo_data, 'base64'), E'\\n', '') AS photo_base64
             FROM laporan_aduan
             WHERE ticket_code = ? AND photo_data IS NOT NULL
             LIMIT 1"
        );
        $stmt->execute([$photoReference]);
        $photoBase64 = $stmt->fetchColumn();
        $photoBytes = is_string($photoBase64) ? base64_decode($photoBase64, true) : false;
        if ($photoBytes === false) {
            http_response_code(404);
            exit('Lampiran tidak ditemukan.');
        }
        header('Content-Type: image/jpeg');
        header('Content-Disposition: inline');
        header('Cache-Control: private, no-store');
        header('X-Content-Type-Options: nosniff');
        header('Content-Length: ' . strlen($photoBytes));
        echo $photoBytes;
        exit;
    }

    $filename = basename($photoReference);
    if (!preg_match('/^[a-f0-9]{32}\.(jpg|png|webp)$/', $filename)) {
        http_response_code(404);
        exit('Lampiran tidak ditemukan.');
    }

    $photoFile = __DIR__ . '/../uploads/laporan/' . $filename;
    if (!is_file($photoFile)) {
        http_response_code(404);
        exit('Lampiran tidak ditemukan.');
    }
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($photoFile);
    if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
        http_response_code(415);
        exit('Format lampiran tidak didukung.');
    }
    header('Content-Type: ' . $mime);
    header('Content-Disposition: inline');
    header('Cache-Control: private, no-store');
    header('X-Content-Type-Options: nosniff');
    readfile($photoFile);
    exit;
}

$tiket = trim($_GET['tiket'] ?? $_GET['ticket'] ?? '');

if ($tiket === '') {
    echo json_encode(['status' => 'error', 'message' => 'Nomor tiket wajib disertakan']);
    exit;
}

try {
    $pdo = getDB();
    $stmt = $pdo->prepare('SELECT ticket_code, status, created_at FROM laporan_aduan WHERE ticket_code = ?');
    $stmt->execute([$tiket]);
    $row = $stmt->fetch();

    if ($row) {
        echo json_encode([
            'status' => 'success',
            'data'   => [
                'nomor_tiket'     => $row['ticket_code'],
                'status'          => $row['status'],
                'tanggal_lapor'   => $row['created_at']
            ]
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    } else {
        echo json_encode(['status' => 'not_found', 'message' => 'Nomor tiket aduan tidak ditemukan di database resmi']);
    }
} catch (Throwable $e) {
    Security::logFailure('tiket.php', $e);
    echo json_encode(['status' => 'error', 'message' => 'Terjadi kesalahan sistem internal']);
}
