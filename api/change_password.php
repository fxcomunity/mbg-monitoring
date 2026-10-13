<?php
/**
 * api/change_password.php – Ganti Kata Sandi (Password)
 * Berlaku untuk Administrator, Dapur SPPG, dan Pengguna / Wali Murid
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
$userId = (int)$currentUser['id'];
$role = $currentUser['role'];

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Metode HTTP tidak didukung.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$action = $_POST['action'] ?? 'change_self';

// ── Admin: Reset Password Pengguna Lain ───────────────────────────
if ($action === 'admin_reset_user') {
    if ($role !== 'admin') {
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'Hanya Satgas Admin yang dapat mereset sandi pengguna lain.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $targetUserId = (int)($_POST['target_user_id'] ?? 0);
    $newPassword  = $_POST['new_password'] ?? '';

    if ($targetUserId <= 0) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'ID pengguna tidak valid.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if (strlen($newPassword) < 6) {
        http_response_code(422);
        echo json_encode(['status' => 'error', 'message' => 'Kata sandi baru minimal 6 karakter.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $hash = password_hash($newPassword, PASSWORD_BCRYPT);
    $stmt = $pdo->prepare("UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?");
    $stmt->execute([$hash, $targetUserId]);

    echo json_encode(['status' => 'success', 'message' => 'Kata sandi pengguna ID #' . $targetUserId . ' berhasil direset.']);
    exit;
}

// ── Ganti Password Sendiri (Admin, SPPG, User) ───────────────────
$currentPassword = $_POST['current_password'] ?? '';
$newPassword     = $_POST['new_password'] ?? '';
$confirmPassword = $_POST['confirm_password'] ?? '';

if (empty($currentPassword) || empty($newPassword) || empty($confirmPassword)) {
    http_response_code(422);
    echo json_encode(['status' => 'error', 'message' => 'Semua kolom kata sandi wajib diisi.'], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($newPassword !== $confirmPassword) {
    http_response_code(422);
    echo json_encode(['status' => 'error', 'message' => 'Konfirmasi kata sandi baru tidak cocok.'], JSON_UNESCAPED_UNICODE);
    exit;
}

if (strlen($newPassword) < 6) {
    http_response_code(422);
    echo json_encode(['status' => 'error', 'message' => 'Kata sandi baru minimal 6 karakter.'], JSON_UNESCAPED_UNICODE);
    exit;
}

// Ambil hash saat ini dari DB
$stmt = $pdo->prepare("SELECT password_hash FROM users WHERE id = ?");
$stmt->execute([$userId]);
$userRecord = $stmt->fetch();

if (!$userRecord || !password_verify($currentPassword, $userRecord['password_hash'])) {
    http_response_code(422);
    echo json_encode(['status' => 'error', 'message' => 'Kata sandi saat ini (lama) tidak valid.'], JSON_UNESCAPED_UNICODE);
    exit;
}

// Update dengan hash baru
$newHash = password_hash($newPassword, PASSWORD_BCRYPT);
$updateStmt = $pdo->prepare("UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?");
$updateStmt->execute([$newHash, $userId]);

echo json_encode([
    'status' => 'success',
    'message' => 'Kata sandi Anda berhasil diperbarui! Silakan gunakan sandi baru untuk login selanjutnya.'
], JSON_UNESCAPED_UNICODE);
