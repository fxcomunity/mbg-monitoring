<?php
// api/tiket.php – Tracking Tiket Laporan Aduan Publik BGN
require_once __DIR__ . '/../database/api_bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json; charset=UTF-8');

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

        $directory = __DIR__ . '/../uploads/laporan';
        if (!is_dir($directory) && !mkdir($directory, 0750, true) && !is_dir($directory)) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => 'Penyimpanan foto tidak tersedia.'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $filename = bin2hex(random_bytes(16)) . '.' . $extensions[$mime];
        $savedPhoto = $directory . DIRECTORY_SEPARATOR . $filename;
        if (!move_uploaded_file($photo['tmp_name'], $savedPhoto)) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => 'Foto gagal disimpan. Coba lagi.'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $photoPath = '/api/tiket.php?photo=' . rawurlencode($filename);
        $photoName = basename($photo['name']);
    }

    try {
        $pdo = getDB();
        $ticketCode = 'TKT-BGN-' . str_replace('-', '', $incidentDate) . '-' . strtoupper(bin2hex(random_bytes(4)));
        $stmt = $pdo->prepare(
            "INSERT INTO laporan_aduan (
                ticket_code, reporter_name, reporter_phone, reporter_role,
                issue_category, school_target, incident_date, description,
                photo_path, photo_original_name, status, priority, ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'masuk', 'sedang', ?, ?)
            RETURNING ticket_code"
        );
        $stmt->execute([
            $ticketCode, $name, $phone, $role, $category, $school, $incidentDate, $description,
            $photoPath, $photoName, $_SERVER['REMOTE_ADDR'] ?? null,
            substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 500)
        ]);
        echo json_encode([
            'status' => 'success',
            'ticket_code' => $stmt->fetchColumn(),
            'message' => 'Laporan berhasil disimpan.'
        ], JSON_UNESCAPED_UNICODE);
    } catch (Throwable $e) {
        if ($savedPhoto && is_file($savedPhoto)) unlink($savedPhoto);
        Security::logFailure('tiket_submit', $e);
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Laporan gagal disimpan. Coba lagi beberapa saat.'], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

if (isset($_GET['photo'])) {
    require_once __DIR__ . '/../database/auth.php';
    $currentUser = Auth::check() ? Auth::user() : null;
    $filename = basename((string)$_GET['photo']);
    if (($currentUser['role'] ?? '') !== 'admin') {
        http_response_code(403);
        exit('Akses lampiran hanya untuk Admin Satgas.');
    }
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
    $stmt = $pdo->prepare('SELECT id, ticket_code, reporter_name, reporter_role, issue_category, school_target, incident_date, description, status, priority, satgas_notes, created_at FROM laporan_aduan WHERE ticket_code = ?');
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
    Security::logFailure('tiket.php', $e);
    echo json_encode(['status' => 'error', 'message' => 'Terjadi kesalahan sistem internal']);
}
