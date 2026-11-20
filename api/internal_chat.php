<?php
require_once __DIR__ . '/../database/api_bootstrap.php';
require_once __DIR__ . '/../database/auth.php';
require_once __DIR__ . '/../database/security.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

Auth::requireApiRole(['admin', 'sppg']);
$user = Auth::currentApiUser();
if (!$user) {
    Security::rejectRequest(401, 'Sesi tidak valid. Silakan masuk kembali.');
}

$pdo = getDB();
$userId = (int)$user['id'];
$role = (string)$user['role'];
$respond = static function (array $data, int $status = 200): never {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
};
$touchPresence = static function () use ($pdo, $userId): void {
    $stmt = $pdo->prepare(
        'INSERT INTO internal_chat_presence (user_id, last_seen_at) VALUES (?, NOW())
         ON CONFLICT (user_id) DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at'
    );
    $stmt->execute([$userId]);
};
$requireConversation = static function (int $conversationId) use ($pdo, $userId): void {
    $stmt = $pdo->prepare(
        'SELECT 1 FROM internal_chat_members WHERE conversation_id = ? AND user_id = ?'
    );
    $stmt->execute([$conversationId, $userId]);
    if (!$stmt->fetchColumn()) {
        http_response_code(404);
        echo json_encode(['status' => 'error', 'message' => 'Percakapan tidak ditemukan.'], JSON_UNESCAPED_UNICODE);
        exit;
    }
};

try {
    $touchPresence();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $action = (string)($_GET['action'] ?? '');

    if ($method === 'GET' && $action === 'me') {
        $respond(['status' => 'success', 'user_id' => $userId]);
    }

    if ($method === 'GET' && $action === 'call_config') {
        $iceServers = [['urls' => 'stun:stun.l.google.com:19302']];
        $turnUrl = trim((string)(getenv('TURN_URL') ?: ''));
        $turnSecret = (string)(getenv('TURN_SHARED_SECRET') ?: '');
        if (($turnUrl === '') !== ($turnSecret === '')) {
            $respond(['status' => 'error', 'message' => 'Konfigurasi TURN belum lengkap: atur TURN_URL dan TURN_SHARED_SECRET.'], 503);
        }
        if ($turnUrl !== '' && $turnSecret !== '') {
            $turnUrls = array_values(array_filter(array_map('trim', explode(',', $turnUrl))));
            foreach ($turnUrls as $url) {
                if (!preg_match('/^turns?:[^\s]+$/i', $url)) {
                    $respond(['status' => 'error', 'message' => 'TURN_URL harus berisi URL turn: atau turns: yang valid.'], 503);
                }
            }
            $username = (string)(time() + 3600) . ':' . $userId;
            $iceServers[] = [
                'urls' => $turnUrls,
                'username' => $username,
                'credential' => base64_encode(hash_hmac('sha1', $username, $turnSecret, true)),
            ];
        }
        $respond(['status' => 'success', 'ice_servers' => $iceServers]);
    }

    if ($method === 'GET' && $action === 'call_pending') {
        $pdo->exec(
            "UPDATE internal_chat_calls SET status = 'missed', ended_at = NOW()
             WHERE status = 'ringing' AND created_at < NOW() - INTERVAL '60 seconds'"
        );
        $pdo->exec(
            "UPDATE internal_chat_calls SET status = 'ended', ended_at = NOW()
             WHERE status = 'active' AND answered_at < NOW() - INTERVAL '4 hours'"
        );
        $stmt = $pdo->prepare(
            "SELECT c.id, c.conversation_id, c.created_at,
                    COALESCE(u.sppg_name, u.full_name) AS caller_name, u.role AS caller_role
             FROM internal_chat_calls c JOIN users u ON u.id = c.caller_id
             WHERE c.callee_id = ? AND c.status = 'ringing'
             ORDER BY c.created_at DESC LIMIT 5"
        );
        $stmt->execute([$userId]);
        $respond(['status' => 'success', 'data' => $stmt->fetchAll()]);
    }

    if ($method === 'GET' && $action === 'call_state') {
        $callId = filter_var($_GET['call_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        $afterSignalId = filter_var($_GET['after_signal_id'] ?? 0, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]);
        if (!$callId || $afterSignalId === false) {
            $respond(['status' => 'error', 'message' => 'Panggilan tidak valid.'], 400);
        }
        $call = $pdo->prepare(
            "SELECT c.id, c.conversation_id, c.caller_id, c.callee_id, c.status, c.created_at,
                    COALESCE(peer.sppg_name, peer.full_name) AS peer_name, peer.role AS peer_role
             FROM internal_chat_calls c
             JOIN users peer ON peer.id = CASE WHEN c.caller_id = ? THEN c.callee_id ELSE c.caller_id END
             WHERE c.id = ? AND (c.caller_id = ? OR c.callee_id = ?)"
        );
        $call->execute([$userId, (int)$callId, $userId, $userId]);
        $callData = $call->fetch();
        if (!$callData) $respond(['status' => 'error', 'message' => 'Panggilan tidak ditemukan.'], 404);
        $signals = $pdo->prepare(
            'SELECT id, sender_id, signal_type, payload
             FROM internal_chat_call_signals
             WHERE call_id = ? AND recipient_id = ? AND id > ?
             ORDER BY id ASC LIMIT 100'
        );
        $signals->execute([(int)$callId, $userId, (int)$afterSignalId]);
        $respond(['status' => 'success', 'data' => $callData, 'signals' => $signals->fetchAll()]);
    }

    if ($method === 'GET' && $action === 'directory') {
        $stmt = $pdo->prepare(
            "SELECT u.id, u.full_name, u.role, u.sppg_name, u.avatar_url,
                    p.last_seen_at,
                    COALESCE(p.last_seen_at >= NOW() - INTERVAL '90 seconds', FALSE) AS is_online
             FROM users u
             LEFT JOIN internal_chat_presence p ON p.user_id = u.id
             WHERE u.id <> ? AND u.deleted_at IS NULL AND u.is_active = TRUE
               AND u.role IN ('admin', 'sppg')
               AND (u.role <> 'sppg' OR LOWER(COALESCE(u.status_verifikasi, '')) = 'approved')
             ORDER BY CASE u.role WHEN 'admin' THEN 0 ELSE 1 END,
                      COALESCE(u.sppg_name, u.full_name) ASC
             LIMIT 500"
        );
        $stmt->execute([$userId]);
        $respond(['status' => 'success', 'data' => $stmt->fetchAll()]);
    }

    if ($method === 'GET' && $action === 'conversations') {
        $stmt = $pdo->prepare(
            "SELECT c.id, c.kind, c.name, c.updated_at,
                    (SELECT u.id FROM internal_chat_members peer
                     JOIN users u ON u.id = peer.user_id
                     WHERE peer.conversation_id = c.id AND peer.user_id <> ?
                     ORDER BY peer.joined_at LIMIT 1) AS peer_id,
                    (SELECT COALESCE(u.sppg_name, u.full_name) FROM internal_chat_members peer
                     JOIN users u ON u.id = peer.user_id
                     WHERE peer.conversation_id = c.id AND peer.user_id <> ?
                     ORDER BY peer.joined_at LIMIT 1) AS peer_name,
                    (SELECT u.role FROM internal_chat_members peer
                     JOIN users u ON u.id = peer.user_id
                     WHERE peer.conversation_id = c.id AND peer.user_id <> ?
                     ORDER BY peer.joined_at LIMIT 1) AS peer_role,
                    (SELECT p.last_seen_at FROM internal_chat_members peer
                     JOIN internal_chat_presence p ON p.user_id = peer.user_id
                     WHERE peer.conversation_id = c.id AND peer.user_id <> ?
                     ORDER BY peer.joined_at LIMIT 1) AS peer_last_seen_at,
                    (SELECT p.last_seen_at >= NOW() - INTERVAL '90 seconds'
                     FROM internal_chat_members peer
                     JOIN internal_chat_presence p ON p.user_id = peer.user_id
                     WHERE peer.conversation_id = c.id AND peer.user_id <> ?
                     ORDER BY peer.joined_at LIMIT 1) AS peer_online,
                    (SELECT m.message FROM internal_chat_messages m
                     WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message,
                    (SELECT COUNT(*) FROM internal_chat_messages m
                     WHERE m.conversation_id = c.id AND m.sender_id <> ?
                       AND m.id > mine.last_read_message_id) AS unread_count,
                    (SELECT COUNT(*) FROM internal_chat_members members
                     WHERE members.conversation_id = c.id) AS member_count
             FROM internal_chat_conversations c
             JOIN internal_chat_members mine ON mine.conversation_id = c.id AND mine.user_id = ?
             ORDER BY c.updated_at DESC, c.id DESC
             LIMIT 300"
        );
        $stmt->execute([$userId, $userId, $userId, $userId, $userId, $userId, $userId]);
        $respond(['status' => 'success', 'data' => $stmt->fetchAll()]);
    }

    if ($method === 'GET' && $action === 'messages') {
        $conversationId = filter_var($_GET['conversation_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        $afterId = filter_var($_GET['after_id'] ?? 0, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]);
        if (!$conversationId || $afterId === false) {
            $respond(['status' => 'error', 'message' => 'Percakapan tidak valid.'], 400);
        }
        $requireConversation((int)$conversationId);
        if ((int)$afterId === 0) {
            $stmt = $pdo->prepare(
                "SELECT m.id, m.sender_id, m.message, m.created_at,
                        u.full_name AS sender_name, u.role AS sender_role, u.avatar_url
                 FROM internal_chat_messages m
                 JOIN users u ON u.id = m.sender_id
                 WHERE m.conversation_id = ?
                 ORDER BY m.id DESC LIMIT 100"
            );
            $stmt->execute([(int)$conversationId]);
            $messages = array_reverse($stmt->fetchAll());
        } else {
            $stmt = $pdo->prepare(
                "SELECT m.id, m.sender_id, m.message, m.created_at,
                        u.full_name AS sender_name, u.role AS sender_role, u.avatar_url
                 FROM internal_chat_messages m
                 JOIN users u ON u.id = m.sender_id
                 WHERE m.conversation_id = ? AND m.id > ?
                 ORDER BY m.id ASC LIMIT 100"
            );
            $stmt->execute([(int)$conversationId, (int)$afterId]);
            $messages = $stmt->fetchAll();
        }
        if ($messages) {
            $lastMessageId = (int)$messages[count($messages) - 1]['id'];
            $read = $pdo->prepare(
                'UPDATE internal_chat_members
                 SET last_read_message_id = GREATEST(last_read_message_id, ?)
                 WHERE conversation_id = ? AND user_id = ?'
            );
            $read->execute([$lastMessageId, (int)$conversationId, $userId]);
        }
        $respond(['status' => 'success', 'data' => $messages]);
    }

    if ($method !== 'POST') {
        $respond(['status' => 'error', 'message' => 'Metode tidak diizinkan.'], 405);
    }
    $body = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($body)) {
        $respond(['status' => 'error', 'message' => 'Format permintaan tidak valid.'], 400);
    }
    $action = (string)($body['action'] ?? '');

    if ($action === 'presence') {
        $respond(['status' => 'success']);
    }

    if ($action === 'call_start') {
        $conversationId = filter_var($body['conversation_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if (!$conversationId) $respond(['status' => 'error', 'message' => 'Percakapan tidak valid.'], 400);
        $conversation = $pdo->prepare(
            "SELECT c.id, c.kind, peer.user_id AS peer_id
             FROM internal_chat_conversations c
             JOIN internal_chat_members mine ON mine.conversation_id = c.id AND mine.user_id = ?
             JOIN internal_chat_members peer ON peer.conversation_id = c.id AND peer.user_id <> ?
             JOIN users u ON u.id = peer.user_id
             WHERE c.id = ? AND c.kind = 'direct' AND u.is_active = TRUE AND u.deleted_at IS NULL
             LIMIT 1"
        );
        $conversation->execute([$userId, $userId, (int)$conversationId]);
        $conversationData = $conversation->fetch();
        if (!$conversationData) $respond(['status' => 'error', 'message' => 'Panggilan hanya tersedia untuk percakapan satu lawan satu.'], 404);
        $pdo->exec(
            "UPDATE internal_chat_calls SET status = 'missed', ended_at = NOW()
             WHERE status = 'ringing' AND created_at < NOW() - INTERVAL '60 seconds'"
        );
        $pdo->exec(
            "UPDATE internal_chat_calls SET status = 'ended', ended_at = NOW()
             WHERE status = 'active' AND answered_at < NOW() - INTERVAL '4 hours'"
        );
        $busy = $pdo->prepare(
            "SELECT 1 FROM internal_chat_calls
             WHERE status IN ('ringing', 'active')
               AND ((status = 'ringing' AND created_at > NOW() - INTERVAL '60 seconds')
                 OR (status = 'active' AND answered_at > NOW() - INTERVAL '4 hours'))
               AND (caller_id IN (?, ?) OR callee_id IN (?, ?))
             LIMIT 1"
        );
        $busy->execute([$userId, (int)$conversationData['peer_id'], $userId, (int)$conversationData['peer_id']]);
        if ($busy->fetchColumn()) $respond(['status' => 'error', 'message' => 'Salah satu pengguna sedang dalam panggilan lain.'], 409);
        $create = $pdo->prepare(
            "INSERT INTO internal_chat_calls (conversation_id, caller_id, callee_id)
             VALUES (?, ?, ?) RETURNING id"
        );
        $create->execute([(int)$conversationId, $userId, (int)$conversationData['peer_id']]);
        $respond(['status' => 'success', 'call_id' => (int)$create->fetchColumn()]);
    }

    if (in_array($action, ['call_answer', 'call_decline', 'call_end', 'call_signal'], true)) {
        $callId = filter_var($body['call_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if (!$callId) $respond(['status' => 'error', 'message' => 'Panggilan tidak valid.'], 400);
        $lookup = $pdo->prepare(
            'SELECT id, caller_id, callee_id, status FROM internal_chat_calls
             WHERE id = ? AND (caller_id = ? OR callee_id = ?)'
        );
        $lookup->execute([(int)$callId, $userId, $userId]);
        $call = $lookup->fetch();
        if (!$call) $respond(['status' => 'error', 'message' => 'Panggilan tidak ditemukan.'], 404);

        if ($action === 'call_answer' || $action === 'call_decline') {
            if ((int)$call['callee_id'] !== $userId || $call['status'] !== 'ringing') {
                $respond(['status' => 'error', 'message' => 'Panggilan ini sudah tidak tersedia.'], 409);
            }
            $status = $action === 'call_answer' ? 'active' : 'declined';
            $update = $pdo->prepare(
                'UPDATE internal_chat_calls SET status = ?, answered_at = CASE WHEN ? = \'active\' THEN NOW() ELSE answered_at END,
                 ended_at = CASE WHEN ? = \'declined\' THEN NOW() ELSE ended_at END
                 WHERE id = ? AND status = \'ringing\' AND callee_id = ? RETURNING id'
            );
            $update->execute([$status, $status, $status, (int)$callId, $userId]);
            if (!$update->fetchColumn()) $respond(['status' => 'error', 'message' => 'Panggilan ini sudah tidak tersedia.'], 409);
            $respond(['status' => 'success']);
        }

        if ($action === 'call_end') {
            $end = $pdo->prepare(
                "UPDATE internal_chat_calls SET status = 'ended', ended_at = NOW()
                 WHERE id = ? AND (caller_id = ? OR callee_id = ?) AND status IN ('ringing', 'active')
                 RETURNING id"
            );
            $end->execute([(int)$callId, $userId, $userId]);
            if (!$end->fetchColumn()) $respond(['status' => 'error', 'message' => 'Panggilan sudah berakhir.'], 409);
            $respond(['status' => 'success']);
        }

        $signalType = (string)($body['signal_type'] ?? '');
        $payload = $body['payload'] ?? null;
        $validSignalPayload = is_array($payload)
            && (
                (in_array($signalType, ['offer', 'answer'], true)
                    && ($payload['type'] ?? null) === $signalType
                    && is_string($payload['sdp'] ?? null)
                    && strlen($payload['sdp']) <= 8192)
                || ($signalType === 'candidate'
                    && is_string($payload['candidate'] ?? null)
                    && strlen($payload['candidate']) <= 4096)
            );
        if (!in_array($signalType, ['offer', 'answer', 'candidate'], true)
            || !$validSignalPayload
            || strlen(json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '') > 8192
            || ($signalType === 'offer' && (int)$call['caller_id'] !== $userId)
            || ($signalType === 'answer' && (int)$call['callee_id'] !== $userId)
            || !in_array($call['status'], ['ringing', 'active'], true)) {
            $respond(['status' => 'error', 'message' => 'Sinyal panggilan tidak valid.'], 400);
        }
        $recipientId = (int)$call['caller_id'] === $userId ? (int)$call['callee_id'] : (int)$call['caller_id'];
        $signal = $pdo->prepare(
            'INSERT INTO internal_chat_call_signals (call_id, sender_id, recipient_id, signal_type, payload)
             VALUES (?, ?, ?, ?, ?::jsonb) RETURNING id'
        );
        $signal->execute([
            (int)$callId, $userId, $recipientId, $signalType,
            json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
        ]);
        $respond(['status' => 'success', 'signal_id' => (int)$signal->fetchColumn()]);
    }

    if ($action === 'direct') {
        $peerId = filter_var($body['user_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if (!$peerId || (int)$peerId === $userId) {
            $respond(['status' => 'error', 'message' => 'Kontak tidak valid.'], 400);
        }
        $peer = $pdo->prepare(
            "SELECT id FROM users WHERE id = ? AND deleted_at IS NULL AND is_active = TRUE
             AND role IN ('admin', 'sppg')
             AND (role <> 'sppg' OR LOWER(COALESCE(status_verifikasi, '')) = 'approved')"
        );
        $peer->execute([(int)$peerId]);
        if (!$peer->fetchColumn()) {
            $respond(['status' => 'error', 'message' => 'Akun ini tidak tersedia untuk komunikasi internal.'], 404);
        }
        $directKey = min($userId, (int)$peerId) . ':' . max($userId, (int)$peerId);
        $pdo->beginTransaction();
        try {
            $create = $pdo->prepare(
                "INSERT INTO internal_chat_conversations (kind, direct_key, created_by)
                 VALUES ('direct', ?, ?)
                 ON CONFLICT (direct_key) DO NOTHING RETURNING id"
            );
            $create->execute([$directKey, $userId]);
            $conversationId = $create->fetchColumn();
            if (!$conversationId) {
                $find = $pdo->prepare('SELECT id FROM internal_chat_conversations WHERE direct_key = ?');
                $find->execute([$directKey]);
                $conversationId = $find->fetchColumn();
            }
            $member = $pdo->prepare(
                'INSERT INTO internal_chat_members (conversation_id, user_id) VALUES (?, ?)
                 ON CONFLICT (conversation_id, user_id) DO NOTHING'
            );
            $member->execute([(int)$conversationId, $userId]);
            $member->execute([(int)$conversationId, (int)$peerId]);
            $pdo->commit();
            $respond(['status' => 'success', 'conversation_id' => (int)$conversationId]);
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
    }

    if ($action === 'group') {
        $name = trim((string)($body['name'] ?? ''));
        $memberIds = $body['member_ids'] ?? null;
        if ($name === '' || mb_strlen($name) > 120 || preg_match('/[\x00-\x1F\x7F]/u', $name)) {
            $respond(['status' => 'error', 'message' => 'Nama grup wajib diisi (maksimal 120 karakter).'], 400);
        }
        if (!is_array($memberIds)) {
            $respond(['status' => 'error', 'message' => 'Pilih minimal dua anggota untuk grup.'], 400);
        }
        $memberIds = array_values(array_unique(array_filter(array_map(
            static fn($id) => filter_var($id, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) ?: null,
            $memberIds
        ))));
        $memberIds = array_values(array_diff($memberIds, [$userId]));
        if (count($memberIds) < 2 || count($memberIds) > 49) {
            $respond(['status' => 'error', 'message' => 'Grup memerlukan 2 sampai 49 anggota selain Anda.'], 400);
        }
        $placeholders = implode(',', array_fill(0, count($memberIds), '?'));
        $eligible = $pdo->prepare(
            "SELECT id FROM users WHERE id IN ($placeholders) AND deleted_at IS NULL AND is_active = TRUE
             AND role IN ('admin', 'sppg')
             AND (role <> 'sppg' OR LOWER(COALESCE(status_verifikasi, '')) = 'approved')"
        );
        $eligible->execute($memberIds);
        $eligibleIds = array_map('intval', $eligible->fetchAll(PDO::FETCH_COLUMN));
        if (count($eligibleIds) !== count($memberIds)) {
            $respond(['status' => 'error', 'message' => 'Ada anggota yang tidak aktif atau bukan akun Admin/SPPG.'], 400);
        }
        $pdo->beginTransaction();
        try {
            $create = $pdo->prepare(
                "INSERT INTO internal_chat_conversations (kind, name, created_by)
                 VALUES ('group', ?, ?) RETURNING id"
            );
            $create->execute([$name, $userId]);
            $conversationId = (int)$create->fetchColumn();
            $member = $pdo->prepare(
                'INSERT INTO internal_chat_members (conversation_id, user_id) VALUES (?, ?)'
            );
            $member->execute([$conversationId, $userId]);
            foreach ($eligibleIds as $memberId) {
                $member->execute([$conversationId, $memberId]);
            }
            $pdo->commit();
            $respond(['status' => 'success', 'conversation_id' => $conversationId]);
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
    }

    if ($action === 'send') {
        $conversationId = filter_var($body['conversation_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        $message = trim((string)($body['message'] ?? ''));
        if (!$conversationId || $message === '' || mb_strlen($message) > 2000 || preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', $message)) {
            $respond(['status' => 'error', 'message' => 'Pesan wajib diisi dan maksimal 2.000 karakter.'], 400);
        }
        $requireConversation((int)$conversationId);
        $stmt = $pdo->prepare(
            'INSERT INTO internal_chat_messages (conversation_id, sender_id, message)
             VALUES (?, ?, ?) RETURNING id, created_at'
        );
        $stmt->execute([(int)$conversationId, $userId, $message]);
        $sent = $stmt->fetch();
        $update = $pdo->prepare(
            'UPDATE internal_chat_conversations SET updated_at = NOW() WHERE id = ?'
        );
        $update->execute([(int)$conversationId]);
        $respond([
            'status' => 'success',
            'data' => [
                'id' => (int)$sent['id'],
                'conversation_id' => (int)$conversationId,
                'sender_id' => $userId,
                'sender_name' => $user['full_name'],
                'sender_role' => $role,
                'message' => $message,
                'created_at' => $sent['created_at']
            ]
        ]);
    }

    $respond(['status' => 'error', 'message' => 'Aksi komunikasi tidak valid.'], 400);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('[Internal Chat] ' . $error->getMessage());
    $respond(['status' => 'error', 'message' => 'Layanan komunikasi sementara tidak tersedia. Jalankan database/internal_chat.sql lalu coba lagi.'], 503);
}
