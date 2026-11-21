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
        $stmt = $pdo->prepare(
            "SELECT u.id, u.full_name, u.email, u.role, u.sppg_name, u.avatar_url,
                    COALESCE(p.about, '') AS about
             FROM users u LEFT JOIN internal_chat_profiles p ON p.user_id = u.id
             WHERE u.id = ?"
        );
        $stmt->execute([$userId]);
        $respond(['status' => 'success', 'user_id' => $userId, 'data' => $stmt->fetch()]);
    }

    if ($method === 'GET' && $action === 'call_config') {
        $iceServers = [
            ['urls' => 'stun:stun.l.google.com:19302'],
            ['urls' => 'stun:stun1.l.google.com:19302'],
            ['urls' => 'stun:stun2.l.google.com:19302'],
            ['urls' => 'stun:stun.cloudflare.com:3478']
        ];
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

    if ($method === 'GET' && $action === 'call_history') {
        $stmt = $pdo->prepare(
            "SELECT c.id, c.conversation_id, c.status, c.created_at, c.answered_at, c.ended_at,
                    COALESCE(peer.sppg_name, peer.full_name) AS peer_name, peer.role AS peer_role
             FROM internal_chat_calls c
             JOIN users peer ON peer.id = CASE WHEN c.caller_id = ? THEN c.callee_id ELSE c.caller_id END
             WHERE c.caller_id = ? OR c.callee_id = ?
             ORDER BY c.created_at DESC LIMIT 100"
        );
        $stmt->execute([$userId, $userId, $userId]);
        $respond(['status' => 'success', 'data' => $stmt->fetchAll()]);
    }

    if ($method === 'GET' && $action === 'directory') {
        $stmt = $pdo->prepare(
            "SELECT u.id, u.full_name, u.role, u.sppg_name, u.avatar_url,
                    COALESCE(profile.about, '') AS about,
                    p.last_seen_at,
                    COALESCE(p.last_seen_at >= NOW() - INTERVAL '90 seconds', FALSE) AS is_online,
                    (u.id = ?) AS is_self
             FROM users u
             LEFT JOIN internal_chat_profiles profile ON profile.user_id = u.id
             LEFT JOIN internal_chat_presence p ON p.user_id = u.id
             WHERE u.deleted_at IS NULL AND u.is_active = TRUE
               AND LOWER(u.role) IN ('admin', 'sppg')
             ORDER BY CASE WHEN u.id = ? THEN 0 WHEN LOWER(u.role) = 'admin' THEN 1 ELSE 2 END,
                      COALESCE(u.sppg_name, u.full_name) ASC
             LIMIT 500"
        );
        $stmt->execute([$userId, $userId]);
        $respond(['status' => 'success', 'data' => $stmt->fetchAll()]);
    }

    if ($method === 'GET' && $action === 'conversations') {
        $archived = ($_GET['archived'] ?? '') === '1';
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
                    (SELECT u.avatar_url FROM internal_chat_members peer
                     JOIN users u ON u.id = peer.user_id
                     WHERE peer.conversation_id = c.id AND peer.user_id <> ?
                     ORDER BY peer.joined_at LIMIT 1) AS peer_avatar_url,
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
             WHERE (? = TRUE AND EXISTS (
                      SELECT 1 FROM internal_chat_archives a
                      WHERE a.user_id = ? AND a.conversation_id = c.id
                   ))
                OR (? = FALSE AND NOT EXISTS (
                      SELECT 1 FROM internal_chat_archives a
                      WHERE a.user_id = ? AND a.conversation_id = c.id
                   ))
             ORDER BY c.updated_at DESC, c.id DESC
             LIMIT 300"
        );
        $stmt->execute([$userId, $userId, $userId, $userId, $userId, $userId, $userId, $userId, $archived, $userId, $archived, $userId]);
        $respond(['status' => 'success', 'data' => $stmt->fetchAll()]);
    }

    if ($method === 'GET' && $action === 'statuses') {
        $stmt = $pdo->prepare(
            "SELECT s.id, s.author_id, s.conversation_id, s.message, s.created_at, s.expires_at,
                    c.name AS group_name, COALESCE(u.sppg_name, u.full_name) AS author_name, u.role AS author_role
             FROM internal_chat_statuses s
             JOIN users u ON u.id = s.author_id
             LEFT JOIN internal_chat_conversations c ON c.id = s.conversation_id
             WHERE s.expires_at > NOW()
               AND (s.author_id = ? OR s.conversation_id IS NULL OR EXISTS (
                 SELECT 1 FROM internal_chat_members m
                 WHERE m.conversation_id = s.conversation_id AND m.user_id = ?
               ))
             ORDER BY s.created_at DESC LIMIT 200"
        );
        $stmt->execute([$userId, $userId]);
        $respond(['status' => 'success', 'data' => $stmt->fetchAll()]);
    }

    if ($method === 'GET' && $action === 'communities') {
        $stmt = $pdo->prepare(
            "SELECT c.id, c.name, c.description, c.created_at,
                    (SELECT COUNT(*) FROM internal_chat_community_members m WHERE m.community_id = c.id) AS member_count,
                    COALESCE((
                      SELECT json_agg(json_build_object('id', g.id, 'name', g.name) ORDER BY g.name)
                      FROM internal_chat_community_groups cg
                      JOIN internal_chat_conversations g ON g.id = cg.conversation_id
                      WHERE cg.community_id = c.id
                        AND EXISTS (
                          SELECT 1 FROM internal_chat_members gm
                          WHERE gm.conversation_id = g.id AND gm.user_id = ?
                        )
                    ), '[]'::json) AS groups
             FROM internal_chat_communities c
             JOIN internal_chat_community_members mine ON mine.community_id = c.id AND mine.user_id = ?
             ORDER BY c.updated_at DESC LIMIT 100"
        );
        $stmt->execute([$userId, $userId]);
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

    if ($action === 'ai_chat') {
        $message = trim((string)($body['message'] ?? ''));
        if ($message === '' || mb_strlen($message) > 500) {
            $respond(['status' => 'error', 'message' => 'Pertanyaan wajib diisi dan maksimal 500 karakter.'], 400);
        }
        $history = [];
        if (isset($body['history']) && is_array($body['history'])) {
            foreach (array_slice($body['history'], -8) as $item) {
                if (!is_array($item) || !in_array($item['role'] ?? '', ['user', 'assistant'], true) ||
                    !is_string($item['content'] ?? null) || trim($item['content']) === '') continue;
                $history[] = ['role' => $item['role'], 'content' => mb_substr(trim($item['content']), 0, 500)];
            }
        }

        $apiKey = trim((string)(getenv('OPENROUTER_API_KEY') ?: ''));
        $model = trim((string)(getenv('OPENROUTER_MODEL') ?: 'google/gemini-2.0-flash-001'));
        $baseUrl = rtrim(trim((string)(getenv('OPENROUTER_BASE_URL') ?: 'https://openrouter.ai/api/v1')), '/');
        if ($apiKey === '' && is_readable(__DIR__ . '/../.env')) {
            foreach (file(__DIR__ . '/../.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
                $line = trim($line);
                if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) continue;
                [$key, $value] = explode('=', $line, 2);
                $value = trim(trim($value), "\"'");
                if ($key === 'OPENROUTER_API_KEY') $apiKey = $value;
                elseif ($key === 'OPENROUTER_MODEL' && getenv('OPENROUTER_MODEL') === false) $model = $value;
                elseif ($key === 'OPENROUTER_BASE_URL' && getenv('OPENROUTER_BASE_URL') === false) $baseUrl = rtrim($value, '/');
            }
        }
        if ($apiKey === '') {
            $respond(['status' => 'error', 'message' => 'Asisten AI belum dikonfigurasi. Admin perlu mengatur OPENROUTER_API_KEY di environment atau .env.'], 503);
        }
        $systemPrompt = 'Anda adalah AI internal MBG Connect. Jawab ringkas dan ramah dalam Bahasa Indonesia tentang penggunaan komunikasi internal, koordinasi MBG, dan informasi umum. Jangan mengarang informasi akun; pencarian Admin/SPPG dilakukan secara privat di perangkat pengguna. Jika pengguna meminta data akun, arahkan untuk memakai pencarian kontak lokal.';
        if (!function_exists('curl_init')) {
            $respond(['status' => 'error', 'message' => 'Ekstensi cURL PHP belum tersedia untuk layanan AI.'], 503);
        }
        $curl = curl_init($baseUrl . '/chat/completions');
        if ($curl === false) {
            $respond(['status' => 'error', 'message' => 'Asisten AI tidak dapat disiapkan saat ini.'], 503);
        }
        $payload = json_encode([
            'model' => $model,
            'messages' => array_merge(
                [['role' => 'system', 'content' => $systemPrompt]],
                $history,
                [['role' => 'user', 'content' => $message]]
            ),
            'max_tokens' => 500,
            'temperature' => 0.3,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $apiKey,
                'HTTP-Referer: https://mbg.jack-ai.my.id',
                'X-Title: Radar MBG Connect',
            ],
        ]);
        $responseBody = curl_exec($curl);
        $httpCode = (int)curl_getinfo($curl, CURLINFO_HTTP_CODE);
        $curlError = curl_error($curl);
        curl_close($curl);
        $upstream = is_string($responseBody) ? json_decode($responseBody, true) : null;
        $reply = $upstream['choices'][0]['message']['content'] ?? null;
        if ($responseBody === false || $httpCode < 200 || $httpCode >= 300 || !is_string($reply) || trim($reply) === '') {
            error_log('OpenRouter communication AI request failed (HTTP ' . $httpCode . ')' . ($curlError ? ': ' . $curlError : ''));
            $respond(['status' => 'error', 'message' => 'Asisten AI gagal menyusun jawaban. Coba lagi sebentar.'], 502);
        }
        $respond(['status' => 'success', 'reply' => trim($reply)]);
    }

    if ($action === 'profile_save') {
        $about = trim((string)($body['about'] ?? ''));
        if (mb_strlen($about) > 240 || preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', $about)) {
            $respond(['status' => 'error', 'message' => 'Deskripsi maksimal 240 karakter.'], 400);
        }
        $stmt = $pdo->prepare(
            'INSERT INTO internal_chat_profiles (user_id, about, updated_at) VALUES (?, ?, NOW())
             ON CONFLICT (user_id) DO UPDATE SET about = EXCLUDED.about, updated_at = NOW()
             RETURNING about'
        );
        $stmt->execute([$userId, $about]);
        $respond(['status' => 'success', 'data' => $stmt->fetch()]);
    }

    if ($action === 'archive' || $action === 'unarchive') {
        $conversationId = filter_var($body['conversation_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if (!$conversationId) $respond(['status' => 'error', 'message' => 'Percakapan tidak ditemukan.'], 404);
        $requireConversation((int)$conversationId);
        if ($action === 'archive') {
            $stmt = $pdo->prepare(
                'INSERT INTO internal_chat_archives (user_id, conversation_id) VALUES (?, ?)
                 ON CONFLICT (user_id, conversation_id) DO NOTHING'
            );
            $stmt->execute([$userId, (int)$conversationId]);
        } else {
            $stmt = $pdo->prepare('DELETE FROM internal_chat_archives WHERE user_id = ? AND conversation_id = ?');
            $stmt->execute([$userId, (int)$conversationId]);
        }
        $respond(['status' => 'success']);
    }

    if ($action === 'status_create') {
        $message = trim((string)($body['message'] ?? ''));
        $conversationId = isset($body['conversation_id']) && $body['conversation_id'] !== ''
            ? filter_var($body['conversation_id'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) : null;
        if ($message === '' || mb_strlen($message) > 500 || preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', $message)) {
            $respond(['status' => 'error', 'message' => 'Status wajib diisi dan maksimal 500 karakter.'], 400);
        }
        if ($conversationId !== null) {
            if (!$conversationId) $respond(['status' => 'error', 'message' => 'Grup status tidak valid.'], 400);
            $group = $pdo->prepare(
                "SELECT 1 FROM internal_chat_conversations c
                 JOIN internal_chat_members m ON m.conversation_id = c.id AND m.user_id = ?
                 WHERE c.id = ? AND c.kind = 'group'"
            );
            $group->execute([$userId, (int)$conversationId]);
            if (!$group->fetchColumn()) $respond(['status' => 'error', 'message' => 'Status hanya dapat dibuat di grup yang Anda ikuti.'], 403);
        }
        $stmt = $pdo->prepare(
            'INSERT INTO internal_chat_statuses (author_id, conversation_id, message)
             VALUES (?, ?, ?) RETURNING id, created_at, expires_at'
        );
        $stmt->execute([$userId, $conversationId === null ? null : (int)$conversationId, $message]);
        $respond(['status' => 'success', 'data' => $stmt->fetch()]);
    }

    if ($action === 'community_create') {
        $name = trim((string)($body['name'] ?? ''));
        $description = trim((string)($body['description'] ?? ''));
        $memberIds = $body['member_ids'] ?? [];
        $conversationIds = $body['conversation_ids'] ?? [];
        if ($name === '' || mb_strlen($name) > 120 || mb_strlen($description) > 500 ||
            preg_match('/[\x00-\x1F\x7F]/u', $name) ||
            preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', $description)) {
            $respond(['status' => 'error', 'message' => 'Nama komunitas wajib diisi; deskripsi maksimal 500 karakter.'], 400);
        }
        if (!is_array($memberIds) || !is_array($conversationIds) ||
            count($memberIds) > 199 || count($conversationIds) > 100) {
            $respond(['status' => 'error', 'message' => 'Jumlah anggota atau grup komunitas melebihi batas.'], 400);
        }
        $memberIds = array_values(array_unique(array_filter(array_map(
            static fn($id) => filter_var($id, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) ?: null,
            $memberIds
        ))));
        $memberIds = array_values(array_diff($memberIds, [$userId]));
        $conversationIds = array_values(array_unique(array_filter(array_map(
            static fn($id) => filter_var($id, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) ?: null,
            $conversationIds
        ))));
        if (count($memberIds) > 199 || count($conversationIds) > 100) {
            $respond(['status' => 'error', 'message' => 'Jumlah anggota atau grup komunitas melebihi batas.'], 400);
        }
        if ($memberIds) {
            $placeholders = implode(',', array_fill(0, count($memberIds), '?'));
            $eligible = $pdo->prepare(
                "SELECT id FROM users WHERE id IN ($placeholders) AND deleted_at IS NULL AND is_active = TRUE
                 AND role IN ('admin', 'sppg')
                 AND (role <> 'sppg' OR LOWER(COALESCE(status_verifikasi, '')) = 'approved')"
            );
            $eligible->execute($memberIds);
            if (count($eligible->fetchAll(PDO::FETCH_COLUMN)) !== count($memberIds)) {
                $respond(['status' => 'error', 'message' => 'Ada anggota komunitas yang tidak aktif atau bukan akun Admin/SPPG.'], 400);
            }
        }
        if ($conversationIds) {
            $placeholders = implode(',', array_fill(0, count($conversationIds), '?'));
            $groups = $pdo->prepare(
                "SELECT c.id FROM internal_chat_conversations c
                 JOIN internal_chat_members m ON m.conversation_id = c.id AND m.user_id = ?
                 WHERE c.id IN ($placeholders) AND c.kind = 'group'"
            );
            $groups->execute(array_merge([$userId], $conversationIds));
            if (count($groups->fetchAll(PDO::FETCH_COLUMN)) !== count($conversationIds)) {
                $respond(['status' => 'error', 'message' => 'Ada grup yang tidak Anda ikuti atau tidak valid.'], 400);
            }
        }
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare(
                'INSERT INTO internal_chat_communities (name, description, created_by)
                 VALUES (?, ?, ?) RETURNING id'
            );
            $stmt->execute([$name, $description, $userId]);
            $communityId = (int)$stmt->fetchColumn();
            $member = $pdo->prepare(
                'INSERT INTO internal_chat_community_members (community_id, user_id)
                 VALUES (?, ?) ON CONFLICT (community_id, user_id) DO NOTHING'
            );
            $member->execute([$communityId, $userId]);
            foreach ($memberIds as $memberId) $member->execute([$communityId, (int)$memberId]);
            $group = $pdo->prepare(
                'INSERT INTO internal_chat_community_groups (community_id, conversation_id)
                 VALUES (?, ?) ON CONFLICT (community_id, conversation_id) DO NOTHING'
            );
            foreach ($conversationIds as $groupId) $group->execute([$communityId, (int)$groupId]);
            $pdo->commit();
            $respond(['status' => 'success', 'community_id' => $communityId]);
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
    }

    if ($action === 'help_call_start') {
        $ownerId = $userId;

        // Cari admin penerima bantuan (admin aktif, prioritaskan yang sedang online)
        $findAdmin = $pdo->prepare(
            "SELECT u.id, u.full_name, u.role, u.avatar_url, u.phone,
                    COALESCE(p.last_seen_at >= NOW() - INTERVAL '180 seconds', FALSE) AS is_online
             FROM users u
             LEFT JOIN internal_chat_presence p ON p.user_id = u.id
             WHERE u.role = 'admin' AND u.is_active = TRUE AND u.deleted_at IS NULL
               AND u.id <> ?
             ORDER BY is_online DESC, (CASE WHEN u.id = 1 THEN 0 ELSE 1 END), u.id ASC
             LIMIT 1"
        );
        $findAdmin->execute([$ownerId]);
        $targetAdmin = $findAdmin->fetch();

        if (!$targetAdmin) {
            $fallback = $pdo->query(
                "SELECT u.id, u.full_name, u.role, u.avatar_url, u.phone,
                        COALESCE(p.last_seen_at >= NOW() - INTERVAL '180 seconds', FALSE) AS is_online
                 FROM users u
                 LEFT JOIN internal_chat_presence p ON p.user_id = u.id
                 WHERE u.role = 'admin' AND u.is_active = TRUE AND u.deleted_at IS NULL
                 ORDER BY (CASE WHEN u.id = 1 THEN 0 ELSE 1 END), u.id ASC
                 LIMIT 1"
            );
            $targetAdmin = $fallback->fetch();
        }

        if (!$targetAdmin) {
            $respond(['status' => 'error', 'message' => 'Admin Pusat Bantuan tidak tersedia saat ini.'], 404);
        }

        $adminId = (int)$targetAdmin['id'];
        $allowOffline = !empty($body['force']);

        if (!$targetAdmin['is_online'] && !$allowOffline && $adminId !== $ownerId) {
            $respond([
                'status' => 'error',
                'error_code' => 'RECEIVER_OFFLINE',
                'message' => 'Panggilan gagal: Admin Pusat Bantuan sedang offline. Pastikan admin sedang aktif di dashboard MBG Connect untuk menerima panggilan WebRTC.'
            ], 409);
        }

        $directKey = min($ownerId, $adminId) . ':' . max($ownerId, $adminId);
        $convStmt = $pdo->prepare(
            "WITH conversation AS (
               INSERT INTO internal_chat_conversations (kind, direct_key, created_by)
               VALUES ('direct', ?, ?)
               ON CONFLICT (direct_key) DO UPDATE SET direct_key = EXCLUDED.direct_key
               RETURNING id
             ), membership AS (
               INSERT INTO internal_chat_members (conversation_id, user_id)
               SELECT conversation.id, member.user_id
               FROM conversation CROSS JOIN (VALUES (?::bigint), (?::bigint)) AS member(user_id)
               ON CONFLICT (conversation_id, user_id) DO NOTHING
               RETURNING user_id
             )
             SELECT id FROM conversation"
        );
        $convStmt->execute([$directKey, $ownerId, $ownerId, $adminId]);
        $conversationId = (int)$convStmt->fetchColumn();

        $pdo->exec(
            "UPDATE internal_chat_calls SET status = 'missed', ended_at = NOW()
             WHERE status = 'ringing' AND created_at < NOW() - INTERVAL '60 seconds'"
        );
        $pdo->exec(
            "UPDATE internal_chat_calls SET status = 'ended', ended_at = NOW()
             WHERE status = 'active' AND answered_at < NOW() - INTERVAL '4 hours'"
        );

        $endPrev = $pdo->prepare(
            "UPDATE internal_chat_calls SET status = 'ended', ended_at = NOW()
             WHERE status IN ('ringing', 'active') AND caller_id = ?"
        );
        $endPrev->execute([$ownerId]);

        $createCall = $pdo->prepare(
            "INSERT INTO internal_chat_calls (conversation_id, caller_id, callee_id, status)
             VALUES (?, ?, ?, 'ringing') RETURNING id"
        );
        $createCall->execute([$conversationId, $ownerId, $adminId]);
        $callId = (int)$createCall->fetchColumn();

        $respond([
            'status' => 'success',
            'call_id' => $callId,
            'conversation_id' => $conversationId,
            'peer' => [
                'id' => $adminId,
                'name' => $targetAdmin['full_name'] ?: 'Satgas Administrator BGN',
                'role' => 'admin',
                'phone' => $targetAdmin['phone'] ?: '0895404147521',
                'avatar' => $targetAdmin['avatar_url'] ?: ''
            ]
        ]);
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
        if (!$peerId) {
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
