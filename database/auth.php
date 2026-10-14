<?php
/**
 * auth.php - Session Management & Role-Based Access Control
 * Radar MBG - Badan Gizi Nasional
 */

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/security.php';

class Auth {
    
    /**
     * Login autentikasi dengan sanitasi input & perlindungan brute force
     */
    public static function login(string $username, string $password): array {
        // Cek exploit attempt pada input username/password
        if ($threat = Security::detectExploit($username)) {
            Security::logExploit($_SERVER['REMOTE_ADDR'] ?? '127.0.0.1', $_SERVER['HTTP_USER_AGENT'] ?? '', $threat, 'login_username', $username, '/auth.php');
            return ['status' => false, 'message' => 'Input terdeteksi mengandung payload tidak aman!'];
        }

        $username = trim($username);
        
        try {
            $pdo = getDB();
            $stmt = $pdo->prepare('SELECT id, username, email, password_hash, full_name, role, sppg_name, sppg_code, is_active FROM users WHERE username = ? OR email = ? LIMIT 1');
            $stmt->execute([$username, $username]);
            $user = $stmt->fetch();

            if (!$user) {
                return ['status' => false, 'message' => 'Username atau password tidak ditemukan.'];
            }

            if (!$user['is_active']) {
                return ['status' => false, 'message' => 'Akun dinonaktifkan oleh administrator.'];
            }

            if (!password_verify($password, $user['password_hash'])) {
                return ['status' => false, 'message' => 'Username atau password tidak valid.'];
            }

            if (!headers_sent()) {
                @session_regenerate_id(true);
            }

            $_SESSION['user_id']   = (int)$user['id'];
            $_SESSION['username']  = $user['username'];
            $_SESSION['full_name'] = $user['full_name'];
            $_SESSION['role']      = $user['role'];
            $_SESSION['sppg_name'] = $user['sppg_name'];
            $_SESSION['sppg_code'] = $user['sppg_code'];
            $_SESSION['logged_at'] = time();

            return [
                'status'   => true,
                'user'     => [
                    'id'        => $user['id'],
                    'username'  => $user['username'],
                    'full_name' => $user['full_name'],
                    'role'      => $user['role'],
                    'sppg_name' => $user['sppg_name']
                ]
            ];
        } catch (Throwable $e) {
            error_log('[Auth Error] ' . $e->getMessage());
            return ['status' => false, 'message' => 'Terjadi kesalahan sistem saat autentikasi.'];
        }
    }

    /**
     * Registrasi akun baru (User Wali Murid, Sekolah, atau Mitra SPPG dengan Dokumen Legalitas)
     */
    public static function register(
        string $fullName,
        string $email,
        string $username,
        string $password,
        string $role = 'user',
        ?string $sppgName = null,
        ?string $nib = null,
        ?string $noSlhs = null,
        ?string $dokumenLegalitasUrl = null,
        ?string $namaDietisien = null,
        ?string $alamatDapur = null,
        int $kapasitasPorsi = 500
    ): array {
        $fullName = trim($fullName);
        $email    = strtolower(trim($email));
        $username = strtolower(trim($username));
        $role     = in_array($role, ['user', 'sppg'], true) ? $role : 'user';

        if (empty($fullName) || empty($email) || empty($username) || empty($password)) {
            return ['status' => false, 'message' => 'Seluruh kolom pendaftaran wajib diisi lengkap.'];
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ['status' => false, 'message' => 'Format alamat email tidak valid.'];
        }

        if (strlen($username) < 3 || !preg_match('/^[a-zA-Z0-9_.-]+$/', $username)) {
            return ['status' => false, 'message' => 'Username minimal 3 karakter (hanya huruf, angka, titik, strip).'];
        }

        if (strlen($password) < 6) {
            return ['status' => false, 'message' => 'Kata sandi minimal 6 karakter.'];
        }

        // Validasi khusus Mitra SPPG sesuai SOP BGN
        if ($role === 'sppg') {
            if (empty($sppgName)) {
                return ['status' => false, 'message' => 'Nama Dapur SPPG wajib diisi.'];
            }
            if (empty($nib)) {
                return ['status' => false, 'message' => 'Nomor Induk Berusaha (NIB) SPPG wajib diisi sesuai standar BGN.'];
            }
            if (empty($noSlhs)) {
                return ['status' => false, 'message' => 'Nomor Sertifikat Laik Higiene Sanitasi (SLHS) Dinkes wajib diisi.'];
            }
        }

        $statusVerifikasi = ($role === 'sppg') ? 'pending_review' : 'approved';

        try {
            $pdo = getDB();
            $check = $pdo->prepare('SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1');
            $check->execute([$username, $email]);
            if ($check->fetch()) {
                return ['status' => false, 'message' => 'Username atau email tersebut telah terdaftar sebelumnya.'];
            }

            $hash = password_hash($password, PASSWORD_BCRYPT);
            $stmt = $pdo->prepare('
                INSERT INTO users (
                    username, email, password_hash, full_name, role, sppg_name,
                    nib, no_slhs, dokumen_legalitas_url, nama_dietisien, alamat_dapur, kapasitas_porsi,
                    status_verifikasi, is_active, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, NOW())
            ');
            $stmt->execute([
                $username,
                $email,
                $hash,
                $fullName,
                $role,
                $sppgName,
                $nib ?: null,
                $noSlhs ?: null,
                $dokumenLegalitasUrl ?: null,
                $namaDietisien ?: null,
                $alamatDapur ?: null,
                $kapasitasPorsi > 0 ? $kapasitasPorsi : 500,
                $statusVerifikasi
            ]);

            $successMsg = ($role === 'sppg')
                ? 'Registrasi Dapur SPPG berhasil dikirim! Dokumen legalitas (NIB & SLHS) Anda sedang dalam peninjauan Satgas BGN. Silakan masuk.'
                : 'Registrasi akun berhasil! Silakan masuk dengan akun baru Anda.';

            return [
                'status'  => true,
                'message' => $successMsg
            ];
        } catch (Throwable $e) {
            error_log('[Auth Register Error] ' . $e->getMessage());
            return ['status' => false, 'message' => 'Gagal mendaftarkan akun: ' . $e->getMessage()];
        }
    }

    /**
     * Cek apakah user sedang login
     */
    public static function check(): bool {
        return isset($_SESSION['user_id']) && !empty($_SESSION['user_id']);
    }

    /**
     * Dapatkan user saat ini
     */
    public static function user(): ?array {
        if (!self::check()) return null;
        return [
            'id'        => $_SESSION['user_id'],
            'username'  => $_SESSION['username'],
            'full_name' => $_SESSION['full_name'],
            'role'      => $_SESSION['role'],
            'sppg_name' => $_SESSION['sppg_name'] ?? null,
            'sppg_code' => $_SESSION['sppg_code'] ?? null,
        ];
    }

    /**
     * Wajib login dengan role tertentu
     */
    public static function requireRole(string|array $roles): void {
        if (!self::check()) {
            $docRoot = realpath($_SERVER['DOCUMENT_ROOT'] ?? '') ?: '';
            $proj    = realpath(__DIR__ . '/..') ?: '';
            $base    = ($docRoot !== '' && str_starts_with($proj, $docRoot))
                ? str_replace('\\', '/', substr($proj, strlen($docRoot))) : '';
            header('Location: ' . $base . '/auth/login.php?msg=silakan_login');
            exit;
        }

        $userRole = $_SESSION['role'] ?? 'user';
        $allowed = is_array($roles) ? $roles : [$roles];

        if (!in_array($userRole, $allowed, true)) {
            http_response_code(403);
            echo "<h1>403 Forbidden - Anda tidak memiliki izin mengakses modul ini.</h1>";
            exit;
        }
    }

    /**
     * Logout
     */
    public static function logout(): void {
        $_SESSION = [];
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params["path"], $params["domain"],
                $params["secure"], $params["httponly"]
            );
        }
        session_destroy();
    }
}