<?php
/**
 * api/live_chat.php — API Live Chat Interaktif MBG Nasional
 * Mendukung chat publik/wali murid ke Admin Satgas BGN maupun Mitra Dapur SPPG.
 */

require_once __DIR__ . '/../database/auth.php';
require_once __DIR__ . '/../database/security.php';

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');

$pdo = getDB();
$action = $_GET['action'] ?? ($_POST['action'] ?? 'history');

// Helper Session ID
function getChatSessionId(): string {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    if (empty($_SESSION['chat_session_id'])) {
        $_SESSION['chat_session_id'] = 'cs_' . bin2hex(random_bytes(16));
    }
    return $_SESSION['chat_session_id'];
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
    $stmt = $pdo->query("
        SELECT id, sppg_name, sppg_code, full_name, phone 
        FROM users 
        WHERE role = 'sppg' AND is_active = TRUE 
        ORDER BY sppg_name ASC
    ");
    $list = $stmt->fetchAll();
    if (empty($list)) {
        // Fallback default SPPG jika belum ada data user SPPG
        $list = [
            ['id' => 2, 'sppg_name' => 'SPPG Menteng Senayan Jakarta Pusat', 'sppg_code' => 'SPPG-JKT-01'],
            ['id' => 3, 'sppg_name' => 'SPPG Sukajadi Kota Bandung', 'sppg_code' => 'SPPG-BDG-01'],
            ['id' => 4, 'sppg_name' => 'SPPG Gubeng Surabaya', 'sppg_code' => 'SPPG-SBY-01'],
            ['id' => 5, 'sppg_name' => 'SPPG Medan Kota', 'sppg_code' => 'SPPG-MDN-01']
        ];
    }
    echo json_encode(['status' => 'success', 'data' => $list], JSON_UNESCAPED_UNICODE);
    exit;
}

// ------------------------------------------------------------------------------
// 3. Ambil Riwayat Chat (History)
// ------------------------------------------------------------------------------
if ($action === 'history') {
    $sessionId = $_GET['session_id'] ?? getChatSessionId();
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
        'status' => 'success',
        'session_id' => $sessionId,
        'messages' => $messages
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ------------------------------------------------------------------------------
// 4. Kirim Pesan Chat Baru
// ------------------------------------------------------------------------------
if ($action === 'send' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $sessionId = trim($_POST['session_id'] ?? getChatSessionId());
    $senderName = trim($_POST['sender_name'] ?? '');
    $targetType = trim($_POST['target_type'] ?? 'admin');
    $targetSppgName = trim($_POST['target_sppg_name'] ?? '');
    $message = trim($_POST['message'] ?? '');
    $isTemplate = (bool)($_POST['is_template'] ?? false);

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

    // Sanitasi XSS
    $safeMessage = Security::cleanInput($message);
    $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';

    // Simpan pesan pengirim
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

    // --------------------------------------------------------------------------
    // Auto-Responder Cerdas (Jika user mengirim template atau pertanyaan umum)
    // --------------------------------------------------------------------------
    $autoReply = null;
    $lowerMsg = strtolower($safeMessage);

    // Cek kecocokan template database
    $tplCheck = $pdo->prepare("SELECT auto_answer FROM live_chat_templates WHERE LOWER(question) = LOWER(?) LIMIT 1");
    $tplCheck->execute([$safeMessage]);
    $matchedAnswer = $tplCheck->fetchColumn();

    if ($matchedAnswer) {
        $autoReply = $matchedAnswer;
    } elseif (str_contains($lowerMsg, 'menu') || str_contains($lowerMsg, 'makanan sekarang') || str_contains($lowerMsg, 'makan apa')) {
        $autoReply = "Menu MBG hari ini: Nasi Pulen, Ayam Panggang Fillet Rempah BGN, Tahu Tempe Bacem, Sayur Bening Bayam Jagung Manis, dan Buah Pisang Mas. Total energi 640 kkal, protein hewani 28g. Anda dapat mengecek detail kalori di halaman 'Menu Hari Ini'.";
    } elseif (str_contains($lowerMsg, 'alergen') || str_contains($lowerMsg, 'kacang') || str_contains($lowerMsg, 'alergi')) {
        $autoReply = "Sajian MBG hari ini diproduksi bebas dari kacang tanah dan makanan laut berbahaya. Jika putra/putri Anda memiliki alergi spesifik, harap laporkan ke wali kelas atau gunakan formulir Laporan Aduan agar SPPG menyiapkan menu substitusi aman.";
    } elseif (str_contains($lowerMsg, 'dingin') || str_contains($lowerMsg, 'basi') || str_contains($lowerMsg, 'lapor') || str_contains($lowerMsg, 'komplain')) {
        $autoReply = "Mohon maaf atas ketidaknyamanannya. Seluruh makanan MBG wajib diantar dengan wadah bersuhu minimal 60°C. Silakan laporkan segera melalui menu 'Laporan & Aduan Publik' dengan foto kondisi makanan agar satgas langsung menindaklanjuti dapur SPPG terkait.";
    } elseif (str_contains($lowerMsg, 'jam berapa') || str_contains($lowerMsg, 'sampai') || str_contains($lowerMsg, 'jadwal')) {
        $autoReply = "Distribusi makanan dilakukan secara bertahap mulai pukul 09.30 WIB dan tiba di seluruh sekolah terlayani maksimal pukul 11.15 WIB sebelum jam makan siang dimulai.";
    } elseif ($targetType === 'sppg') {
        $sppgTitle = $targetSppgName ?: 'Mitra Dapur SPPG Terdekat';
        $autoReply = "Halo! Terima kasih telah menghubungi {$sppgTitle}. Pesan Anda telah diterima oleh petugas dapur piket. Kami sedang menyiapkan distribusi makan bergizi sesuai juknis higienitas standar BGN.";
    } else {
        $autoReply = "Terima kasih telah menghubungi Satgas BGN Pusat. Petugas operator kami sedang meninjau pertanyaan Anda. Untuk informasi cepat, Anda juga dapat menggunakan tombol Template Pertanyaan di bawah.";
    }

    // Jika ada auto-reply, masukkan ke database sebagai bot/petugas
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
            'created_at' => $botTime
        ] : null
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code(400);
echo json_encode(['status' => 'error', 'message' => 'Aksi tidak valid.'], JSON_UNESCAPED_UNICODE);
