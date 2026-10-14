<?php
/**
 * api/live_chat.php — API Live Chat Interaktif MBG Nasional (Dual Canvas & OpenRouter AI)
 * Mendukung komunikasi publik langsung ke Admin Satgas BGN maupun Dapur SPPG.
 * Fitur:
 *   1. Canvas Terpisah: Satgas BGN (Admin) & Mitra Dapur SPPG
 *   2. Integrasi OpenRouter AI (Fallback otomatis ke Smart Rule-Based Engine jika offline)
 *   3. Balasan Dua Arah: Admin & Mitra SPPG dapat membalas chat masyarakat langsung dari Dashboard
 *   4. Polling Realtime & Riwayat Pesan per Sesi
 */

require_once __DIR__ . '/../database/auth.php';
require_once __DIR__ . '/../database/security.php';

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');

$pdo = getDB();
$action = $_GET['action'] ?? ($_POST['action'] ?? 'history');

// ------------------------------------------------------------------------------
// Konfigurasi OpenRouter AI
// ------------------------------------------------------------------------------
function getOpenRouterConfig(): array {
    $apiKey = getenv('OPENROUTER_API_KEY') ?: '';
    $model  = getenv('OPENROUTER_MODEL') ?: 'google/gemini-2.0-flash-001';
    $base   = getenv('OPENROUTER_BASE_URL') ?: 'https://openrouter.ai/api/v1';

    // Parse langsung dari .env jika getenv kosong
    if (empty($apiKey) && file_exists(__DIR__ . '/../.env')) {
        $lines = file(__DIR__ . '/../.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            $line = trim($line);
            if (str_starts_with($line, '#')) continue;
            if (str_starts_with($line, 'OPENROUTER_API_KEY=')) {
                $apiKey = trim(substr($line, 19), '"\'');
            } elseif (str_starts_with($line, 'OPENROUTER_MODEL=')) {
                $model = trim(substr($line, 17), '"\'');
            } elseif (str_starts_with($line, 'OPENROUTER_BASE_URL=')) {
                $base = trim(substr($line, 20), '"\'');
            }
        }
    }
    return [
        'api_key'  => $apiKey,
        'model'    => $model ?: 'google/gemini-2.0-flash-001',
        'base_url' => rtrim($base ?: 'https://openrouter.ai/api/v1', '/')
    ];
}

// ------------------------------------------------------------------------------
// Helper Session ID
// ------------------------------------------------------------------------------
function getChatSessionId(string $prefix = 'bgn'): string {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    $key = 'chat_session_' . $prefix;
    if (empty($_SESSION[$key])) {
        $_SESSION[$key] = 'cs_' . $prefix . '_' . bin2hex(random_bytes(12));
    }
    return $_SESSION[$key];
}

// ------------------------------------------------------------------------------
// Generator Balasan OpenRouter AI (atau Fallback Rule-Based)
// ------------------------------------------------------------------------------
function generateAiReply(string $userMsg, string $targetType, ?string $targetSppgName, array $history = []): array {
    $config = getOpenRouterConfig();
    $aiReply = null;
    $modelUsed = 'rule-engine';

    if (!empty($config['api_key'])) {
        if ($targetType === 'sppg') {
            $sppgTitle = $targetSppgName ?: 'Mitra Dapur SPPG Terdekat';
            $systemPrompt = "Anda adalah Customer Service & Petugas Layanan Dapur dari {$sppgTitle} (Mitra Resmi Badan Gizi Nasional - BGN RI).\n"
                . "Tugas Anda adalah merespons pertanyaan wali murid, pihak sekolah, atau masyarakat mengenai:\n"
                . "- Menu makanan hari ini (contoh menu Bali Bangli: Nasi putih, Ayam goreng sambal embe, tempe ongseng, tumis sayur sawi putih buncis, semangka, pepaya, total energi 629 kkal).\n"
                . "- Standar penyajian hangat (suhu minimal 60°C saat pengantaran).\n"
                . "- Keamanan pangan & bebas alergen berbahaya (bebas kacang tanah berbahaya, seafood terkontrol).\n"
                . "- Jam estimasi pengiriman porsi ke sekolah (09:30 - 11:00 WITA/WIB).\n"
                . "Berikan jawaban yang ramah, ringkas, jelas, dan profesional dalam Bahasa Indonesia. Maksimal 3-4 kalimat per respon.";
        } else {
            $systemPrompt = "Anda adalah Satgas BGN Pusat (Layanan Pengawasan & Bantuan Resmi Badan Gizi Nasional RI).\n"
                . "Tugas Anda adalah merespons pertanyaan masyarakat, wali murid, dan pihak sekolah mengenai:\n"
                . "- Regulasi dan pengawasan mutu program Makan Bergizi Gratis (MBG) Nasional.\n"
                . "- Standar Angka Kecukupan Gizi (AKG): 629 kkal, 26g protein, kepatuhan 99.4%, sertifikat SLHS 100%.\n"
                . "- Penanganan laporan aduan porsi kurang, makanan dingin/rusak, dan investigasi satgas ke dapur SPPG.\n"
                . "- Prosedur pengaduan resmi via tiket laporan MBG.\n"
                . "Berikan jawaban yang sigap, tegas, sopan, berbasis prosedur resmi BGN dalam Bahasa Indonesia. Maksimal 3-4 kalimat.";
        }

        $messages = [
            ['role' => 'system', 'content' => $systemPrompt]
        ];

        // Sertakan beberapa pesan terakhir untuk konteks dialog
        $lastHistory = array_slice($history, -4);
        foreach ($lastHistory as $h) {
            $r = ($h['sender_type'] === 'user') ? 'user' : 'assistant';
            $messages[] = ['role' => $r, 'content' => $h['message']];
        }

        $messages[] = ['role' => 'user', 'content' => $userMsg];

        $payload = json_encode([
            'model'       => $config['model'],
            'messages'    => $messages,
            'temperature' => 0.4,
            'max_tokens'  => 300
        ]);

        $ch = curl_init($config['base_url'] . '/chat/completions');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_TIMEOUT        => 8,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $config['api_key'],
                'HTTP-Referer: https://mbg.jack-ai.my.id',
                'X-Title: Radar MBG Nasional Live Chat'
            ]
        ]);

        $res = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 200 && $res) {
            $json = json_decode($res, true);
            $parsed = $json['choices'][0]['message']['content'] ?? null;
            if (!empty($parsed)) {
                $aiReply = trim($parsed);
                $modelUsed = 'openrouter:' . $config['model'];
            }
        }
    }

    // Fallback Cerdas (Smart Rule-Based) jika OpenRouter belum ada / gagal
    if (!$aiReply) {
        $lower = strtolower($userMsg);
        if (str_contains($lower, 'menu') || str_contains($lower, 'makan apa') || str_contains($lower, 'sekarang apa')) {
            $aiReply = "Menu MBG hari ini (Siklus Bali Bangli): Nasi putih, ayam goreng sambal embe, tempe ongseng gurih, tumis kacang panjang sawi putih, serta buah semangka dan pepaya segar. Total energi 629.38 kkal dengan 26.15g protein hewani.";
        } elseif (str_contains($lower, 'alergen') || str_contains($lower, 'alergi') || str_contains($lower, 'kacang')) {
            $aiReply = "Sajian MBG hari ini diproduksi bebas dari kacang tanah dan seafood risiko tinggi. Bila anak memiliki alergi spesifik, harap laporkan ke wali kelas atau gunakan formulir Laporan Aduan agar SPPG menyiapkan menu substitusi aman.";
        } elseif (str_contains($lower, 'dingin') || str_contains($lower, 'basi') || str_contains($lower, 'rusak') || str_contains($lower, 'lapor')) {
            $aiReply = "Seluruh makanan MBG wajib diantar dengan thermal box bersuhu minimal 60°C. Jika ditemukan makanan dingin atau basi, segera laporkan melalui portal Laporan Aduan agar tim Satgas BGN langsung melakukan investigasi ke dapur SPPG terkait.";
        } elseif (str_contains($lower, 'jam berapa') || str_contains($lower, 'jadwal') || str_contains($lower, 'sampai')) {
            $aiReply = "Distribusi makanan dilakukan secara bertahap mulai pukul 09.30 WITA/WIB dan tiba di seluruh sekolah terlayani maksimal pukul 11.15 sebelum jam istirahat makan siang siswa.";
        } elseif ($targetType === 'sppg') {
            $sppgTitle = $targetSppgName ?: 'Mitra Dapur SPPG Terdekat';
            $aiReply = "Halo! Layanan Dapur {$sppgTitle} siap membantu. Makanan hari ini dimasak sesuai SOP Higiene BGN. Untuk permintaan khusus porsi anak, Anda juga dapat menyampaikan kepada pihak sekolah.";
        } else {
            $aiReply = "Terima kasih telah menghubungi Satgas BGN Pusat. Seluruh operasional dapur SPPG dan distribusi MBG dipantau secara berkala melalui sensor telemetri dan audit berkala tim pengawas lapangan.";
        }
    }

    return [
        'reply' => $aiReply,
        'model' => $modelUsed
    ];
}

// ------------------------------------------------------------------------------
// 1. Ambil Template Pertanyaan Cepat (Quick Replies)
// ------------------------------------------------------------------------------
if ($action === 'templates') {
    $target = $_GET['target'] ?? 'all';
    if ($target === 'sppg') {
        $stmt = $pdo->prepare("SELECT id, target_role, category, label, question, auto_answer FROM live_chat_templates WHERE target_role IN ('all', 'sppg') ORDER BY sort_order ASC");
        $stmt->execute();
    } elseif ($target === 'admin') {
        $stmt = $pdo->prepare("SELECT id, target_role, category, label, question, auto_answer FROM live_chat_templates WHERE target_role IN ('all', 'admin') ORDER BY sort_order ASC");
        $stmt->execute();
    } else {
        $stmt = $pdo->query("SELECT id, target_role, category, label, question, auto_answer FROM live_chat_templates ORDER BY sort_order ASC");
    }
    $templates = $stmt->fetchAll();
    echo json_encode(['status' => 'success', 'data' => $templates], JSON_UNESCAPED_UNICODE);
    exit;
}

// ------------------------------------------------------------------------------
// 2. Ambil Daftar Mitra SPPG untuk Opsi Tujuan Chat
// ------------------------------------------------------------------------------
if ($action === 'sppg_list') {
    $list = [];

    // Ambil dari tabel master sppg jika ada
    try {
        $stmtSppg = $pdo->query("SELECT id_sppg as id, nama_sppg as sppg_name, kode_sppg as sppg_code, alamat FROM sppg ORDER BY nama_sppg ASC");
        $list = $stmtSppg->fetchAll();
    } catch (Throwable $e) {}

    // Jika kosong, ambil dari users role = 'sppg'
    if (empty($list)) {
        try {
            $stmtUser = $pdo->query("SELECT id, sppg_name, sppg_code, full_name, phone FROM users WHERE role = 'sppg' AND is_active = TRUE ORDER BY sppg_name ASC");
            $list = $stmtUser->fetchAll();
        } catch (Throwable $e) {}
    }

    // Default fallback
    if (empty($list)) {
        $list = [
            ['id' => 'C54XQES5', 'sppg_name' => 'SPPG BANGLI BANGLI LANDIH', 'sppg_code' => '51.06.02.2009.01', 'alamat' => 'JLN. RAYA PENAGA LANDIH'],
            ['id' => 'SPPG-JKT-01', 'sppg_name' => 'SPPG Menteng Senayan Jakarta Pusat', 'sppg_code' => 'SPPG-JKT-01', 'alamat' => 'Jakarta Pusat'],
            ['id' => 'SPPG-BDG-01', 'sppg_name' => 'SPPG Sukajadi Kota Bandung', 'sppg_code' => 'SPPG-BDG-01', 'alamat' => 'Kota Bandung'],
            ['id' => 'SPPG-SBY-01', 'sppg_name' => 'SPPG Gubeng Surabaya', 'sppg_code' => 'SPPG-SBY-01', 'alamat' => 'Surabaya']
        ];
    }
    echo json_encode(['status' => 'success', 'data' => $list], JSON_UNESCAPED_UNICODE);
    exit;
}

// ------------------------------------------------------------------------------
// 3. Ambil Riwayat Chat (History) per Sesi & Target Canvas
// ------------------------------------------------------------------------------
if ($action === 'history') {
    $targetType = trim($_GET['target_type'] ?? 'admin');
    $defaultPrefix = $targetType === 'sppg' ? 'sppg' : 'satgas';
    $sessionId = trim($_GET['session_id'] ?? getChatSessionId($defaultPrefix));

    $stmt = $pdo->prepare("
        SELECT id, session_id, sender_type, sender_name, target_type, target_sppg_name, message, is_template, created_at
        FROM live_chat_messages
        WHERE session_id = ?
        ORDER BY created_at ASC
        LIMIT 100
    ");
    $stmt->execute([$sessionId]);
    $messages = $stmt->fetchAll();

    echo json_encode([
        'status'     => 'success',
        'session_id' => $sessionId,
        'target_type'=> $targetType,
        'messages'   => $messages
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ------------------------------------------------------------------------------
// 4. Polling Pesan Baru (Untuk Update Realtime Balasan Admin/SPPG)
// ------------------------------------------------------------------------------
if ($action === 'poll') {
    $sessionId = trim($_GET['session_id'] ?? '');
    $afterId   = (int)($_GET['after_id'] ?? 0);

    if (empty($sessionId)) {
        echo json_encode(['status' => 'error', 'message' => 'session_id wajib diisi.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $stmt = $pdo->prepare("
        SELECT id, session_id, sender_type, sender_name, target_type, target_sppg_name, message, is_template, created_at
        FROM live_chat_messages
        WHERE session_id = ? AND id > ?
        ORDER BY id ASC
    ");
    $stmt->execute([$sessionId, $afterId]);
    $newMessages = $stmt->fetchAll();

    echo json_encode([
        'status'   => 'success',
        'count'    => count($newMessages),
        'messages' => $newMessages
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ------------------------------------------------------------------------------
// 5. Kirim Pesan Chat Baru dari Pengguna (Wali Murid / Publik)
// ------------------------------------------------------------------------------
if ($action === 'send' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $targetType     = trim($_POST['target_type'] ?? 'admin');
    $defaultPrefix  = $targetType === 'sppg' ? 'sppg' : 'satgas';
    $sessionId      = trim($_POST['session_id'] ?? getChatSessionId($defaultPrefix));
    $senderName     = trim($_POST['sender_name'] ?? '');
    $targetSppgName = trim($_POST['target_sppg_name'] ?? '');
    $message        = trim($_POST['message'] ?? '');
    $isTemplate     = (bool)($_POST['is_template'] ?? false);

    // Ambil data user jika sedang login
    $currentUserId = null;
    $senderType = 'user';
    if (Auth::check()) {
        $u = Auth::user();
        $currentUserId = (int)$u['id'];
        $senderType = $u['role'];
        if (empty($senderName)) {
            $senderName = $u['full_name'] ?: $u['username'];
        }
    }

    if (empty($senderName)) {
        $senderName = 'Masyarakat / Wali Murid';
    }

    if (empty($message)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Pesan tidak boleh kosong.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $safeMessage = Security::cleanInput($message);
    $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';

    // Simpan pesan user ke database
    $stmt = $pdo->prepare("
        INSERT INTO live_chat_messages 
          (session_id, sender_type, sender_id, sender_name, target_type, target_sppg_name, message, is_template, ip_address, created_at)
        VALUES 
          (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        RETURNING id, created_at
    ");
    $stmt->execute([
        $sessionId,
        $senderType,
        $currentUserId,
        $senderName,
        $targetType,
        $targetSppgName ?: null,
        $safeMessage,
        $isTemplate ? 'true' : 'false',
        $ip
    ]);
    $sentMsg = $stmt->fetch();

    // Ambil histori sesi untuk context OpenRouter AI
    $histStmt = $pdo->prepare("SELECT sender_type, message FROM live_chat_messages WHERE session_id = ? ORDER BY id ASC LIMIT 10");
    $histStmt->execute([$sessionId]);
    $history = $histStmt->fetchAll();

    // Hasilkan respon cerdas via OpenRouter AI / Fallback
    $aiRes = generateAiReply($safeMessage, $targetType, $targetSppgName, $history);
    $autoReply = $aiRes['reply'];

    // Simpan auto-reply ke database
    $botMsgId = null;
    $botTime = null;
    if ($autoReply) {
        $botSenderName = $targetType === 'sppg' ? ($targetSppgName ?: 'Petugas Dapur SPPG') : 'Satgas BGN Pusat';
        $botType = $targetType === 'sppg' ? 'sppg' : 'admin';
        
        $botStmt = $pdo->prepare("
            INSERT INTO live_chat_messages 
              (session_id, sender_type, sender_name, target_type, target_sppg_name, message, is_template, ip_address, created_at)
            VALUES 
              (?, ?, ?, ?, ?, ?, FALSE, '127.0.0.1', NOW() + INTERVAL '1 second')
            RETURNING id, created_at
        ");
        $botStmt->execute([
            $sessionId,
            $botType,
            $botSenderName,
            $targetType,
            $targetSppgName ?: null,
            $autoReply
        ]);
        $botRow = $botStmt->fetch();
        $botMsgId = $botRow['id'] ?? null;
        $botTime = $botRow['created_at'] ?? date('Y-m-d H:i:s');
    }

    echo json_encode([
        'status' => 'success',
        'message_sent' => [
            'id' => $sentMsg['id'],
            'session_id' => $sessionId,
            'sender_name' => $senderName,
            'message' => $safeMessage,
            'created_at' => $sentMsg['created_at']
        ],
        'auto_reply' => $autoReply ? [
            'id' => $botMsgId,
            'sender_name' => $targetType === 'sppg' ? ($targetSppgName ?: 'Petugas Dapur SPPG') : 'Satgas BGN Pusat',
            'sender_type' => $targetType === 'sppg' ? 'sppg' : 'admin',
            'message' => $autoReply,
            'model' => $aiRes['model'],
            'created_at' => $botTime
        ] : null
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ------------------------------------------------------------------------------
// 6. Balas Chat Pengguna dari Dashboard (Admin BGN / Mitra SPPG)
// ------------------------------------------------------------------------------
if ($action === 'reply' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!Auth::check()) {
        http_response_code(401);
        echo json_encode(['status' => 'error', 'message' => 'Anda harus login untuk membalas pesan.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $currentUser = Auth::user();
    $role = $currentUser['role']; // 'admin' atau 'sppg'
    if (!in_array($role, ['admin', 'sppg'], true)) {
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'Hanya Admin Satgas atau Mitra SPPG yang diizinkan membalas chat.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $sessionId      = trim($_POST['session_id'] ?? '');
    $message        = trim($_POST['message'] ?? '');
    $targetType     = trim($_POST['target_type'] ?? ($role === 'sppg' ? 'sppg' : 'admin'));
    $targetSppgName = trim($_POST['target_sppg_name'] ?? ($currentUser['sppg_name'] ?? ''));

    if (empty($sessionId) || empty($message)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Session ID dan pesan balasan wajib diisi.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $senderName = $role === 'admin' 
        ? ($currentUser['full_name'] ?: 'Satgas BGN Pusat') 
        : ($currentUser['sppg_name'] ?: ($currentUser['full_name'] ?: 'Petugas Dapur SPPG'));

    $safeMsg = Security::cleanInput($message);
    $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';

    $stmt = $pdo->prepare("
        INSERT INTO live_chat_messages 
          (session_id, sender_type, sender_id, sender_name, target_type, target_sppg_name, message, is_template, ip_address, created_at)
        VALUES 
          (?, ?, ?, ?, ?, ?, FALSE, ?, NOW())
        RETURNING id, created_at
    ");
    $stmt->execute([
        $sessionId,
        $role,
        (int)$currentUser['id'],
        $senderName,
        $targetType,
        $targetSppgName ?: null,
        $safeMsg,
        $ip
    ]);
    $sent = $stmt->fetch();

    echo json_encode([
        'status' => 'success',
        'message' => 'Pesan balasan berhasil dikirim ke pengguna.',
        'data' => [
            'id'          => $sent['id'],
            'session_id'  => $sessionId,
            'sender_type' => $role,
            'sender_name' => $senderName,
            'message'     => $safeMsg,
            'created_at'  => $sent['created_at']
        ]
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ------------------------------------------------------------------------------
// 7. Ambil Daftar Sesi Masuk untuk Dashboard Admin (Satgas BGN)
// ------------------------------------------------------------------------------
if ($action === 'admin_sessions') {
    if (!Auth::check() || Auth::user()['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'Akses ditolak.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $stmt = $pdo->query("
        SELECT 
            session_id,
            target_type,
            MAX(created_at) as last_time,
            COUNT(id) as total_messages,
            (SELECT sender_name FROM live_chat_messages m2 WHERE m2.session_id = m1.session_id AND sender_type = 'user' LIMIT 1) as user_name,
            (SELECT message FROM live_chat_messages m3 WHERE m3.session_id = m1.session_id ORDER BY id DESC LIMIT 1) as last_message,
            (SELECT sender_type FROM live_chat_messages m4 WHERE m4.session_id = m1.session_id ORDER BY id DESC LIMIT 1) as last_sender_type
        FROM live_chat_messages m1
        WHERE target_type = 'admin'
        GROUP BY session_id, target_type
        ORDER BY last_time DESC
        LIMIT 50
    ");
    $sessions = $stmt->fetchAll();

    echo json_encode(['status' => 'success', 'data' => $sessions], JSON_UNESCAPED_UNICODE);
    exit;
}

// ------------------------------------------------------------------------------
// 8. Ambil Daftar Sesi Masuk untuk Dashboard SPPG
// ------------------------------------------------------------------------------
if ($action === 'sppg_sessions') {
    if (!Auth::check() || Auth::user()['role'] !== 'sppg') {
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'Akses ditolak.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $currentUser = Auth::user();
    $sppgName = $currentUser['sppg_name'] ?? '';

    $sql = "
        SELECT 
            session_id,
            target_type,
            target_sppg_name,
            MAX(created_at) as last_time,
            COUNT(id) as total_messages,
            (SELECT sender_name FROM live_chat_messages m2 WHERE m2.session_id = m1.session_id AND sender_type = 'user' LIMIT 1) as user_name,
            (SELECT message FROM live_chat_messages m3 WHERE m3.session_id = m1.session_id ORDER BY id DESC LIMIT 1) as last_message,
            (SELECT sender_type FROM live_chat_messages m4 WHERE m4.session_id = m1.session_id ORDER BY id DESC LIMIT 1) as last_sender_type
        FROM live_chat_messages m1
        WHERE target_type = 'sppg'
    ";
    $params = [];
    if (!empty($sppgName)) {
        $sql .= " AND (target_sppg_name ILIKE ? OR target_sppg_name IS NULL)";
        $params[] = '%' . $sppgName . '%';
    }
    $sql .= " GROUP BY session_id, target_type, target_sppg_name ORDER BY last_time DESC LIMIT 50";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $sessions = $stmt->fetchAll();

    echo json_encode(['status' => 'success', 'data' => $sessions], JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code(400);
echo json_encode(['status' => 'error', 'message' => 'Aksi live chat tidak valid.'], JSON_UNESCAPED_UNICODE);
