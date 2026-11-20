<?php
/**
 * api/auth_user.php - Session Status & Profile Info Endpoint
 * Radar MBG - Badan Gizi Nasional
 */

require_once __DIR__ . '/../database/api_bootstrap.php';
require_once __DIR__ . '/../database/auth.php';
require_once __DIR__ . '/../database/security.php';

header('Content-Type: application/json; charset=UTF-8');
if (ALLOWED_ORIGIN !== '*') {
    header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
}
header('Cache-Control: no-cache, no-store, must-revalidate');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'POST') {
    $action = is_string($_POST['action'] ?? null) ? $_POST['action'] : '';
    $accountActions = [
        'list_users',
        'list_deleted_users',
        'list_deletion_requests',
        'request_user_deletion',
        'review_user_deletion',
        'restore_user'
    ];

    if (in_array($action, $accountActions, true)) {
        Auth::requireApiRole('admin');
        $actor = Auth::user();
        $pdo = getDB();
        $actorQuery = $pdo->prepare('SELECT id, email FROM users WHERE id = ? AND is_active = TRUE AND deleted_at IS NULL');
        $actorQuery->execute([(int)$actor['id']]);
        $actorRow = $actorQuery->fetch();
        if (!$actorRow) {
            Security::rejectRequest(401, 'Sesi administrator tidak valid.');
        }
        $actorId = (int)$actorRow['id'];
        $isSuperAdmin = strtolower((string)$actorRow['email']) === '19250779@bsi.ac.id';
        $respond = static function (array $payload, int $status = 200): void {
            http_response_code($status);
            echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            exit;
        };
        $cleanupExpiredAccounts = static function () use ($pdo): void {
            $pdo->exec(
                "DELETE FROM users
                 WHERE deleted_at IS NOT NULL AND deleted_at <= NOW() - INTERVAL '7 days'
                   AND LOWER(email) <> '19250779@bsi.ac.id'"
            );
        };

        if ($action === 'list_users') {
            $cleanupExpiredAccounts();
            $users = $pdo->query(
                'SELECT id, username, full_name, email, role, sppg_name, avatar_status,
                        is_active AS active, created_at
                 FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 200'
            )->fetchAll();
            $respond(['status' => 'success', 'data' => $users, 'is_superadmin' => $isSuperAdmin, 'current_user_id' => $actorId]);
        }

        if ($action === 'list_deleted_users' || $action === 'list_deletion_requests') {
            if (!$isSuperAdmin) {
                Security::rejectRequest(403, 'Hanya superadmin yang dapat mengakses antrean penghapusan.');
            }
            $cleanupExpiredAccounts();
            if ($action === 'list_deleted_users') {
                $deleted = $pdo->query(
                    "SELECT id, username, full_name, email, role, deleted_at
                     FROM users
                     WHERE deleted_at IS NOT NULL AND deleted_at > NOW() - INTERVAL '7 days'
                     ORDER BY deleted_at DESC LIMIT 200"
                )->fetchAll();
                $respond(['status' => 'success', 'data' => $deleted]);
            }
            $requests = $pdo->query(
                "SELECT r.id, r.target_user_id, r.request_note, r.requested_at,
                        target.username, target.full_name, target.email, target.role,
                        requester.username AS requested_by_username
                 FROM user_deletion_requests r
                 JOIN users target ON target.id = r.target_user_id
                 LEFT JOIN users requester ON requester.id = r.requested_by
                 WHERE r.status = 'pending'
                 ORDER BY r.requested_at ASC LIMIT 200"
            )->fetchAll();
            $respond(['status' => 'success', 'data' => $requests]);
        }

        if ($action === 'request_user_deletion') {
            $targetId = filter_var($_POST['user_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
            if (!$targetId) {
                $respond(['status' => 'error', 'message' => 'ID akun tidak valid.'], 400);
            }
            $targetQuery = $pdo->prepare('SELECT id, email, is_active, deleted_at FROM users WHERE id = ?');
            $targetQuery->execute([(int)$targetId]);
            $target = $targetQuery->fetch();
            if (!$target || $target['deleted_at'] !== null) {
                $respond(['status' => 'error', 'message' => 'Akun tidak ditemukan atau sudah berada di penyimpanan sementara.'], 404);
            }
            if ((int)$target['id'] === $actorId || strtolower((string)$target['email']) === '19250779@bsi.ac.id') {
                $respond(['status' => 'error', 'message' => 'Akun sendiri dan akun superadmin tidak dapat dihapus.'], 403);
            }
            if ($isSuperAdmin) {
                $pdo->beginTransaction();
                try {
                    $delete = $pdo->prepare(
                        'UPDATE users SET deleted_was_active = is_active, is_active = FALSE, deleted_at = NOW(), deleted_by = ?, session_version = session_version + 1
                         WHERE id = ? AND deleted_at IS NULL RETURNING id'
                    );
                    $delete->execute([$actorId, (int)$targetId]);
                    if (!$delete->fetch()) {
                        $pdo->rollBack();
                        $respond(['status' => 'error', 'message' => 'Akun berubah sebelum dapat dipindahkan ke sementara.'], 409);
                    }
                    $closePending = $pdo->prepare(
                        "UPDATE user_deletion_requests
                         SET status = 'approved', reviewed_by = ?, reviewed_at = NOW()
                         WHERE target_user_id = ? AND status = 'pending'"
                    );
                    $closePending->execute([$actorId, (int)$targetId]);
                    $pdo->commit();
                } catch (Throwable $error) {
                    if ($pdo->inTransaction()) $pdo->rollBack();
                    throw $error;
                }
                $respond(['status' => 'success', 'message' => 'Akun dipindahkan ke penyimpanan sementara selama 7 hari.']);
            }

            try {
                $request = $pdo->prepare(
                    "INSERT INTO user_deletion_requests (target_user_id, requested_by, request_note)
                     VALUES (?, ?, ?)
                     RETURNING id"
                );
                $request->execute([(int)$targetId, $actorId, 'Permintaan penghapusan oleh administrator']);
                $request->fetch();
            } catch (PDOException $error) {
                if ($error->getCode() === '23505') {
                    $respond(['status' => 'error', 'message' => 'Permintaan penghapusan akun ini masih menunggu persetujuan.'], 409);
                }
                throw $error;
            }
            $respond(['status' => 'success', 'message' => 'Permintaan penghapusan dikirim ke superadmin untuk persetujuan.']);
        }

        if ($action === 'review_user_deletion') {
            if (!$isSuperAdmin) {
                Security::rejectRequest(403, 'Hanya superadmin yang dapat menyetujui penghapusan.');
            }
            $requestId = filter_var($_POST['request_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
            $decision = is_string($_POST['decision'] ?? null) ? $_POST['decision'] : '';
            if (!$requestId || !in_array($decision, ['approve', 'reject'], true)) {
                $respond(['status' => 'error', 'message' => 'Permintaan atau keputusan tidak valid.'], 400);
            }
            $pdo->beginTransaction();
            try {
                $requestQuery = $pdo->prepare(
                    "SELECT r.id, r.target_user_id, target.email
                     FROM user_deletion_requests r
                     JOIN users target ON target.id = r.target_user_id
                     WHERE r.id = ? AND r.status = 'pending'
                     FOR UPDATE OF r, target"
                );
                $requestQuery->execute([(int)$requestId]);
                $requestRow = $requestQuery->fetch();
                if (!$requestRow) {
                    $pdo->rollBack();
                    $respond(['status' => 'error', 'message' => 'Permintaan tidak ditemukan atau sudah diproses.'], 404);
                }
                if (strtolower((string)$requestRow['email']) === '19250779@bsi.ac.id') {
                    $pdo->rollBack();
                    $respond(['status' => 'error', 'message' => 'Akun superadmin tidak dapat dihapus.'], 403);
                }
                if ($decision === 'approve') {
                    $delete = $pdo->prepare(
                        'UPDATE users SET deleted_was_active = is_active, is_active = FALSE, deleted_at = NOW(), deleted_by = ?, session_version = session_version + 1
                         WHERE id = ? AND deleted_at IS NULL'
                    );
                    $delete->execute([$actorId, (int)$requestRow['target_user_id']]);
                    if ($delete->rowCount() !== 1) {
                        $pdo->rollBack();
                        $respond(['status' => 'error', 'message' => 'Akun sudah berada di penyimpanan sementara.'], 409);
                    }
                }
                $review = $pdo->prepare(
                    'UPDATE user_deletion_requests SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?'
                );
                $review->execute([$decision === 'approve' ? 'approved' : 'rejected', $actorId, (int)$requestId]);
                $pdo->commit();
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                throw $error;
            }
            $respond([
                'status' => 'success',
                'message' => $decision === 'approve' ? 'Penghapusan disetujui; akun masuk penyimpanan sementara 7 hari.' : 'Permintaan penghapusan ditolak.'
            ]);
        }

        if ($action === 'restore_user') {
            if (!$isSuperAdmin) {
                Security::rejectRequest(403, 'Hanya superadmin yang dapat memulihkan akun.');
            }
            $targetId = filter_var($_POST['user_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
            if (!$targetId) {
                $respond(['status' => 'error', 'message' => 'ID akun tidak valid.'], 400);
            }
            $restore = $pdo->prepare(
                "UPDATE users
                 SET is_active = COALESCE(deleted_was_active, TRUE), deleted_at = NULL,
                     deleted_by = NULL, deleted_was_active = NULL, session_version = session_version + 1
                 WHERE id = ? AND deleted_at > NOW() - INTERVAL '7 days' RETURNING id"
            );
            $restore->execute([(int)$targetId]);
            if (!$restore->fetch()) {
                $respond(['status' => 'error', 'message' => 'Akun tidak ditemukan atau masa pemulihannya sudah berakhir.'], 404);
            }
            $respond(['status' => 'success', 'message' => 'Akun berhasil dipulihkan.']);
        }
    }

    if ($action === 'login') {
        $username = is_string($_POST['username'] ?? null) ? $_POST['username'] : '';
        $password = is_string($_POST['password'] ?? null) ? $_POST['password'] : '';
        $result = Auth::login($username, $password);
        if (!$result['status']) {
            $statusCode = !empty($result['blocked']) ? 429 : (!empty($result['unavailable']) ? 503 : 401);
            http_response_code($statusCode);
            echo json_encode([
                'status' => 'error',
                'message' => $result['message'] ?? 'Username atau kata sandi tidak cocok.',
                'lockout' => $result['lockout'] ?? null,
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
        echo json_encode([
            'status' => 'success',
            'user' => [
                'full_name' => $result['user']['full_name'] ?? '',
                'role' => $result['user']['role'] ?? 'user',
            ],
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'register') {
        $fields = ['full_name', 'email', 'username', 'password', 'role', 'sppg_name', 'nib', 'no_slhs'];
        foreach ($fields as $field) {
            if (isset($_POST[$field]) && !is_string($_POST[$field])) {
                Security::rejectRequest(400, 'Format data pendaftaran tidak valid.');
            }
        }
        $result = Auth::register(
            $_POST['full_name'] ?? '',
            $_POST['email'] ?? '',
            $_POST['username'] ?? '',
            $_POST['password'] ?? '',
            $_POST['role'] ?? 'user',
            $_POST['sppg_name'] ?? null,
            $_POST['nib'] ?? null,
            $_POST['no_slhs'] ?? null
        );
        if (!$result['status']) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => $result['message']], JSON_UNESCAPED_UNICODE);
            exit;
        }
        echo json_encode(['status' => 'success', 'message' => $result['message']], JSON_UNESCAPED_UNICODE);
        exit;
    }

    Security::rejectRequest(400, 'Aksi autentikasi tidak dikenal.');
}

if ($method === 'GET' && ($_GET['action'] ?? '') === 'logout') {
    Auth::logout();
    echo json_encode(['status' => 'success'], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'GET' && ($_GET['action'] ?? '') === 'login_status') {
    echo json_encode([
        'status' => 'success',
        'lockout' => Auth::lockoutStatus()
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$u = Auth::currentApiUser();
if ($u !== null) {
    $role = $u['role'] ?? 'user';
    $roleLabels = [
        'admin' => 'Admin Satgas BGN',
        'sppg'  => 'Pengelola Dapur SPPG',
        'user'  => 'Wali Murid / Publik'
    ];
    
    // Check if user uploaded a custom avatar in DB
    $avatar = $u['avatar_url'] ?? '';
    if (empty($avatar) || !file_exists(__DIR__ . '/../' . ltrim($avatar, '/'))) {
        // High quality, self-contained SVG avatars that never break even offline
        if ($role === 'admin') {
            $avatar = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='20' fill='%23001026'/><path d='M20 7l9 4v7c0 5.5-3.8 10.7-9 12-5.2-1.3-9-6.5-9-12V11l9-4z' fill='%23134074'/><circle cx='20' cy='15' r='4' fill='%236ffbbe'/><path d='M13 26c0-3.5 3.1-6 7-6s7 2.5 7 6v1h-14v-1z' fill='%236ffbbe'/></svg>";
        } elseif ($role === 'sppg') {
            $avatar = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='20' fill='%230b2545'/><path d='M20 10c-3.3 0-6 2.7-6 6v1h12v-1c0-3.3-2.7-6-6-6zm-8 9v2h16v-2H12zm2 4c0 3.3 2.7 6 6 6s6-2.7 6-6H14z' fill='%23f59e0b'/></svg>";
        } else {
            $avatar = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='20' fill='%23395f95'/><path d='M20 11c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 12c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z' fill='%23ffffff'/></svg>";
        }
    }

    echo json_encode([
        'logged_in' => true,
        'user' => [
            'id' => (int)$u['id'],
            'username' => Security::cleanOutput($u['username']),
            'full_name' => Security::cleanOutput($u['full_name'] ?: $u['username']),
            'email' => Security::cleanOutput($u['email'] ?? ''),
            'role' => $role,
            'role_label' => $roleLabels[$role] ?? ucfirst($role),
            'sppg_name' => Security::cleanOutput($u['sppg_name'] ?? ''),
            'avatar' => $avatar,
            'avatar_url' => $u['avatar_url'] ?? '',
            'avatar_pending_url' => $u['avatar_pending_url'] ?? '',
            'avatar_status' => $u['avatar_status'] ?? 'approved'
        ]
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
} else {
    echo json_encode([
        'logged_in' => false
    ], JSON_UNESCAPED_UNICODE);
}
