<?php
/**
 * api/upload_avatar.php – Upload Avatar / Logo Profil
 * Role-Based: User & Admin langsung aktif; SPPG wajib konfirmasi Satgas BGN
 */

require_once __DIR__ . '/../database/auth.php';
require_once __DIR__ . '/../database/security.php';

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');

if (!Auth::check()) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Silakan masuk terlebih dahulu.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$currentUser = Auth::user();
$pdo = getDB();
$role = $currentUser['role'];
$userId = (int)$currentUser['id'];

$action = $_POST['action'] ?? 'upload';

// ── Admin: Konfirmasi Logo SPPG ─────────────────────────────────
if ($action === 'approve_sppg_logo' || $action === 'reject_sppg_logo') {
    if ($role !== 'admin') {
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'Hanya Satgas Admin yang dapat mengonfirmasi logo SPPG.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $targetUserId = (int)($_POST['target_user_id'] ?? 0);
    if ($targetUserId <= 0) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'ID pengguna tidak valid.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'approve_sppg_logo') {
        $stmt = $pdo->prepare("
            UPDATE users 
            SET avatar_url = avatar_pending_url, 
                avatar_pending_url = NULL, 
                avatar_status = 'approved',
                updated_at = NOW()
            WHERE id = ? AND role = 'sppg'
        ");
        $stmt->execute([$targetUserId]);
        echo json_encode(['status' => 'success', 'message' => 'Logo SPPG berhasil dikonfirmasi dan disetujui!']);
        exit;
    } else {
        $stmt = $pdo->prepare("
            UPDATE users 
            SET avatar_pending_url = NULL, 
                avatar_status = 'rejected',
                updated_at = NOW()
            WHERE id = ? AND role = 'sppg'
        ");
        $stmt->execute([$targetUserId]);
        echo json_encode(['status' => 'success', 'message' => 'Pengajuan logo SPPG ditolak.']);
        exit;
    }
}

// ── Upload Avatar / Logo ─────────────────────────────────────────
if (!isset($_FILES['avatar']) || $_FILES['avatar']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'File foto tidak ditemukan atau terjadi kesalahan saat mengunggah.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$file = $_FILES['avatar'];
$maxBytes = 5 * 1024 * 1024; // 5 MB

if ($file['size'] > $maxBytes) {
    http_response_code(413);
    echo json_encode(['status' => 'error', 'message' => 'Ukuran foto maksimal 5 MB.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$mime = mime_content_type($file['tmp_name']);
$allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];

if (!in_array($mime, $allowedMimes, true)) {
    http_response_code(415);
    echo json_encode(['status' => 'error', 'message' => 'Format file tidak didukung. Gunakan JPG, PNG, atau WEBP.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$uploadDir = __DIR__ . '/../uploads/avatars/';
if (!is_dir($uploadDir)) {
    @mkdir($uploadDir, 0755, true);
}

$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp'], true)) {
    $ext = 'jpg';
}

$safeFilename = 'avatar_' . $userId . '_' . date('Ymd_His') . '_' . bin2hex(random_bytes(3)) . '.' . $ext;
$destination = $uploadDir . $safeFilename;
$publicPath = 'uploads/avatars/' . $safeFilename;

if (!move_uploaded_file($file['tmp_name'], $destination)) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Gagal menyimpan file ke server.'], JSON_UNESCAPED_UNICODE);
    exit;
}

// Update Database
if ($role === 'sppg') {
    // SPPG WAJIB KONFIRMASI: simpan ke pending
    $stmt = $pdo->prepare("
        UPDATE users 
        SET avatar_pending_url = ?, 
            avatar_status = 'pending_approval', 
            updated_at = NOW() 
        WHERE id = ?
    ");
    $stmt->execute([$publicPath, $userId]);

    echo json_encode([
        'status' => 'success',
        'pending' => true,
        'message' => 'Logo dapur SPPG berhasil diunggah! Status: Menunggu Konfirmasi & Verifikasi Satgas BGN Pusat.',
        'avatar_pending_url' => $publicPath,
        'avatar_status' => 'pending_approval'
    ], JSON_UNESCAPED_UNICODE);
} else {
    // User & Admin: langsung aktif
    $stmt = $pdo->prepare("
        UPDATE users 
        SET avatar_url = ?, 
            avatar_status = 'approved', 
            updated_at = NOW() 
        WHERE id = ?
    ");
    $stmt->execute([$publicPath, $userId]);

    echo json_encode([
        'status' => 'success',
        'pending' => false,
        'message' => 'Foto profil berhasil diperbarui!',
        'avatar_url' => $publicPath,
        'avatar_status' => 'approved'
    ], JSON_UNESCAPED_UNICODE);
}
