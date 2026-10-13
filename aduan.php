<?php
/**
 * aduan.php – REST Endpoint Laporan Aduan MBG (PostgreSQL/Neon)
 * Radar MBG Nasional – Badan Gizi Nasional
 *
 * Routes:
 *   POST /aduan.php              → Submit laporan baru
 *   GET  /aduan.php?ticket=TKT-  → Cek status tiket
 *   GET  /aduan.php?action=stats → Statistik ringkas
 */

require_once __DIR__ . '/database/db.php';
require_once __DIR__ . '/database/security.php';

// Anti-Exploit WAF Inspection
Security::inspectRequest(true);

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: ' . (defined('ALLOWED_ORIGIN') ? ALLOWED_ORIGIN : '*'));
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ─── Helpers ────────────────────────────────────────────────────
function respond(int $code, array $body): never {
    http_response_code($code);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function generateTicket(): string {
    $date = date('Ymd');
    $rand = str_pad(mt_rand(1000, 9999), 4, '0', STR_PAD_LEFT);
    return "TKT-BGN-{$date}-{$rand}";
}

function sanitize(string $val, int $max = 255): string {
    return mb_substr(trim(strip_tags($val)), 0, $max);
}

// ─── Upload dir ──────────────────────────────────────────────────
if (!is_dir(UPLOAD_DIR)) {
    @mkdir(UPLOAD_DIR, 0755, true);
}

// ─── Router ──────────────────────────────────────────────────────
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$ticket = $_GET['ticket'] ?? '';

try {
    $pdo = getDB();

    // ── GET: Cek status tiket ─────────────────────────────────────
    if ($method === 'GET' && $ticket !== '') {
        $ticket = strtoupper(sanitize($ticket, 30));
        $stmt   = $pdo->prepare(
            'SELECT ticket_code, reporter_name, school_target, issue_category,
                    incident_date, status, priority,
                    created_at AT TIME ZONE \'Asia/Jakarta\' AS created_at,
                    updated_at AT TIME ZONE \'Asia/Jakarta\' AS updated_at
             FROM laporan_aduan WHERE ticket_code = $1'
        );
        $stmt->execute([$ticket]);
        $row = $stmt->fetch();

        if (!$row) {
            respond(404, ['status' => 'error', 'message' => 'Tiket tidak ditemukan.']);
        }

        $statusMap = [
            'masuk'      => 'Laporan diterima, menunggu verifikasi awal.',
            'verifikasi' => 'Sedang diverifikasi oleh tim satgas BGN.',
            'proses'     => 'Dalam proses penanganan & inspeksi lapangan.',
            'selesai'    => 'Laporan selesai ditangani. Terima kasih.',
            'ditolak'    => 'Laporan tidak dapat diproses (duplikat/tidak valid).',
        ];
        $row['status_label']  = $statusMap[$row['status']] ?? $row['status'];
        $row['created_at']    = substr($row['created_at'], 0, 19);
        $row['updated_at']    = substr($row['updated_at'], 0, 19);

        respond(200, ['status' => 'success', 'data' => $row]);
    }

    // ── GET: Statistik ────────────────────────────────────────────
    if ($method === 'GET' && $action === 'stats') {
        $total   = $pdo->query('SELECT COUNT(*) FROM laporan_aduan')->fetchColumn();
        $masuk   = $pdo->query("SELECT COUNT(*) FROM laporan_aduan WHERE status='masuk'")->fetchColumn();
        $proses  = $pdo->query("SELECT COUNT(*) FROM laporan_aduan WHERE status IN ('verifikasi','proses')")->fetchColumn();
        $selesai = $pdo->query("SELECT COUNT(*) FROM laporan_aduan WHERE status='selesai'")->fetchColumn();
        $byCat   = $pdo->query(
            'SELECT issue_category AS kategori, COUNT(*) AS jumlah
             FROM laporan_aduan GROUP BY issue_category ORDER BY jumlah DESC'
        )->fetchAll();

        respond(200, [
            'status' => 'success',
            'data'   => [
                'total'        => (int)$total,
                'masuk'        => (int)$masuk,
                'diproses'     => (int)$proses,
                'selesai'      => (int)$selesai,
                'per_kategori' => $byCat,
            ],
        ]);
    }

    // ── POST: Submit laporan baru ─────────────────────────────────
    if ($method === 'POST') {
        $name     = sanitize($_POST['reporter_name']  ?? '', 120);
        $phone    = sanitize($_POST['reporter_phone'] ?? '', 20);
        $role     = sanitize($_POST['reporter_role']  ?? 'masyarakat', 20);
        $category = sanitize($_POST['issue_category'] ?? 'lainnya', 20);
        $school   = sanitize($_POST['school_target']  ?? '', 200);
        $date     = sanitize($_POST['incident_date']  ?? '', 10);
        $desc     = mb_substr(trim(strip_tags($_POST['description'] ?? '')), 0, 5000);

        $errors = [];
        if (strlen($name) < 2)   $errors[] = 'Nama lengkap wajib diisi (min. 2 karakter).';
        if (!preg_match('/^[0-9+\-\s]{8,20}$/', $phone)) $errors[] = 'Nomor WhatsApp tidak valid.';
        if (strlen($school) < 3) $errors[] = 'Nama sekolah wajib diisi.';
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) $errors[] = 'Tanggal kejadian tidak valid.';
        if (strlen($desc) < 10)  $errors[] = 'Deskripsi laporan wajib diisi (min. 10 karakter).';

        $validRoles = ['wali','guru','komite','siswa','masyarakat'];
        $validCats  = ['waktu','menu','suhu','higienitas','alergen','lainnya'];
        if (!in_array($role, $validRoles, true))    $role     = 'masyarakat';
        if (!in_array($category, $validCats, true)) $category = 'lainnya';

        if ($errors) {
            respond(422, ['status' => 'error', 'message' => 'Validasi gagal.', 'errors' => $errors]);
        }

        // ── Upload foto (opsional) ───────────────────────────────
        $photoPath = null;
        $photoOriginalName = null;
        if (isset($_FILES['photo']) && $_FILES['photo']['error'] === UPLOAD_ERR_OK) {
            $file   = $_FILES['photo'];
            $sizeMB = $file['size'] / (1024 * 1024);
            $mime   = mime_content_type($file['tmp_name']);

            if ($sizeMB > UPLOAD_MAX_MB) {
                respond(413, ['status' => 'error', 'message' => 'Foto terlalu besar (maks ' . UPLOAD_MAX_MB . ' MB).']);
            }
            if (!in_array($mime, UPLOAD_ALLOWED_TYPES, true)) {
                respond(415, ['status' => 'error', 'message' => 'Format foto tidak didukung (JPG/PNG/WEBP).']);
            }
            $ext      = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            $safeName = date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
            $dest     = UPLOAD_DIR . $safeName;
            if (move_uploaded_file($file['tmp_name'], $dest)) {
                $photoPath         = 'uploads/aduan/' . $safeName;
                $photoOriginalName = basename($file['name']);
            }
        }

        // ── Buat tiket unik ──────────────────────────────────────
        $ticketCode = generateTicket();
        for ($i = 0; $i < 5; $i++) {
            $chk = $pdo->prepare('SELECT id FROM laporan_aduan WHERE ticket_code = $1');
            $chk->execute([$ticketCode]);
            if (!$chk->fetchColumn()) break;
            $ticketCode = generateTicket();
        }

        // ── INSERT (PostgreSQL: RETURNING id) ────────────────────
        $ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? null;
        $ua = mb_substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 500);

        $stmt = $pdo->prepare(
            'INSERT INTO laporan_aduan
              (ticket_code, reporter_name, reporter_phone, reporter_role,
               issue_category, school_target, incident_date, description,
               photo_path, photo_original_name, ip_address, user_agent)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
             RETURNING id'
        );
        $stmt->execute([
            $ticketCode, $name, $phone, $role,
            $category, $school, $date, $desc,
            $photoPath, $photoOriginalName, $ip, $ua,
        ]);
        $insertedId = $stmt->fetchColumn();

        // ── Log awal ─────────────────────────────────────────────
        $pdo->prepare(
            'INSERT INTO aduan_log (laporan_id, old_status, new_status, changed_by, notes)
             VALUES ($1, NULL, $2, $3, $4)'
        )->execute([$insertedId, 'masuk', 'sistem', 'Laporan baru diterima dari web.']);

        respond(201, [
            'status'              => 'success',
            'message'             => 'Laporan berhasil dikirim. Satgas BGN akan segera menindaklanjuti.',
            'ticket_code'         => $ticketCode,
            'estimated_response'  => '< 45 menit',
            'timestamp'           => date('Y-m-d H:i:s'),
        ]);
    }

    respond(405, ['status' => 'error', 'message' => 'Metode tidak didukung.']);

} catch (PDOException $e) {
    error_log('[aduan.php] DB Error: ' . $e->getMessage());
    respond(500, ['status' => 'error', 'message' => 'Terjadi kesalahan sistem. Silakan coba lagi.']);
} catch (Throwable $e) {
    error_log('[aduan.php] Error: ' . $e->getMessage());
    respond(500, ['status' => 'error', 'message' => 'Terjadi kesalahan internal.']);
}
