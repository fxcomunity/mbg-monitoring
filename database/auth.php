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

Security::sendHeaders();

class Auth {
    public static function hashNewPassword(string $password): string {
        $salt = bin2hex(random_bytes(16));
        $iterations = 310000;
        $hash = hash_pbkdf2('sha256', $password, $salt, $iterations, 64);
        return 'pbkdf2_sha256$' . $iterations . '$' . $salt . '$' . $hash;
    }

    public static function verifyPassword(string $password, string $storedHash, ?string $legacySalt = null): bool {
        if (preg_match('/^pbkdf2_sha256\$([0-9]{6})\$([a-f0-9]{32})\$([a-f0-9]{128})$/D', $storedHash, $parts)) {
            $iterations = (int)$parts[1];
            if ($iterations < 100000 || $iterations > 600000) return false;
            $candidate = hash_pbkdf2('sha256', $password, $parts[2], $iterations, 64);
            return hash_equals($parts[3], $candidate);
        }
        if (password_verify($password, $storedHash)) return true;
        if ($legacySalt !== null && preg_match('/^[a-f0-9]{64}$/i', $storedHash)) {
            return hash_equals(strtolower($storedHash), hash('sha256', $legacySalt . $password));
        }
        return false;
    }

    public static function lockoutStatus(?string $ip = null): array {
        $ip ??= Security::clientIp();
        if (!filter_var($ip, FILTER_VALIDATE_IP)) {
            throw new RuntimeException('Client IP tidak tersedia untuk pemeriksaan lockout.');
        }
        $stmt = getDB()->prepare(
            'SELECT failed_attempts, locked_until, is_permanent,
                    (is_permanent OR locked_until > NOW()) AS blocked
             FROM auth_ip_lockouts WHERE ip_address = ?'
        );
        $stmt->execute([$ip]);
        $row = $stmt->fetch() ?: [];
        return [
            'ip' => $ip,
            'blocked' => in_array($row['blocked'] ?? false, [true, 1, '1', 't', 'true'], true),
            'failed_attempts' => (int)($row['failed_attempts'] ?? 0),
            'blocked_until' => $row['locked_until'] ?? null,
            'permanent' => in_array($row['is_permanent'] ?? false, [true, 1, '1', 't', 'true'], true),
        ];
    }

    private static function recordLoginEvent(string $ip, string $event, int $attempts, ?string $until, bool $permanent): void {
        $stmt = getDB()->prepare(
            'INSERT INTO auth_security_events (ip_address, event_type, failed_attempts, blocked_until, is_permanent)
             VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([$ip, $event, $attempts, $until, $permanent]);
    }

    private static function recordLoginFailure(string $ip): array {
        $pdo = getDB();
        $stmt = $pdo->prepare(
            "INSERT INTO auth_ip_lockouts (ip_address, failed_attempts)
             VALUES (?, 1)
             ON CONFLICT (ip_address) DO UPDATE SET
               failed_attempts = CASE WHEN auth_ip_lockouts.is_permanent THEN auth_ip_lockouts.failed_attempts ELSE auth_ip_lockouts.failed_attempts + 1 END,
               is_permanent = auth_ip_lockouts.is_permanent OR auth_ip_lockouts.failed_attempts + 1 >= 15,
               locked_until = CASE
                 WHEN auth_ip_lockouts.is_permanent OR auth_ip_lockouts.failed_attempts + 1 >= 15 THEN NULL
                 WHEN auth_ip_lockouts.failed_attempts + 1 >= 10 THEN NOW() + INTERVAL '1 hour'
                 WHEN auth_ip_lockouts.failed_attempts + 1 >= 5 THEN NOW() + INTERVAL '10 minutes'
                 ELSE NULL
               END,
               updated_at = NOW()
             RETURNING failed_attempts, locked_until, is_permanent"
        );
        $stmt->execute([$ip]);
        $row = $stmt->fetch();
        $attempts = (int)$row['failed_attempts'];
        $permanent = in_array($row['is_permanent'], [true, 1, '1', 't', 'true'], true);
        $until = $row['locked_until'] ?? null;
        $event = $permanent || in_array($attempts, [5, 10], true) ? 'login_locked' : 'login_failed';
        self::recordLoginEvent($ip, $event, $attempts, $until, $permanent);
        return [
            'ip' => $ip,
            'blocked' => $permanent || $until !== null,
            'failed_attempts' => $attempts,
            'blocked_until' => $until,
            'permanent' => $permanent,
        ];
    }

    private static function recordLoginSuccess(string $ip): void {
        $pdo = getDB();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare(
                'UPDATE auth_ip_lockouts
                 SET failed_attempts = 0, locked_until = NULL, updated_at = NOW()
                 WHERE ip_address = ? AND is_permanent = FALSE'
            );
            $stmt->execute([$ip]);
            self::recordLoginEvent($ip, 'login_success', 0, null, false);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    /**
     * Login autentikasi dengan sanitasi input & perlindungan brute force
     */
    public static function login(string $username, string $password): array {
        $username = trim($username);

        try {
            $ip = Security::clientIp();
            $lockout = self::lockoutStatus($ip);
            if ($lockout['blocked']) {
                return ['status' => false, 'blocked' => true, 'lockout' => $lockout, 'message' => 'Akses login dari alamat IP ini sedang dibatasi.'];
            }

            if ($threat = Security::detectExploit($username)) {
                Security::logExploit($ip, '', $threat, 'login_username', $username, '/auth/login.php');
                $lockout = self::recordLoginFailure($ip);
                return ['status' => false, 'blocked' => $lockout['blocked'], 'lockout' => $lockout, 'message' => 'Input tidak valid.'];
            }
            if ($username === '' || strlen($username) > 120 || strlen($password) > 1024) {
                $lockout = self::recordLoginFailure($ip);
                return ['status' => false, 'blocked' => $lockout['blocked'], 'lockout' => $lockout, 'message' => 'Username atau kata sandi tidak cocok.'];
            }

            $pdo = getDB();
            $stmt = $pdo->prepare('SELECT id, username, email, password_hash, salt, full_name, role, sppg_name, sppg_code, is_active, session_version FROM users WHERE username = ? OR email = ? LIMIT 1');
            $stmt->execute([$username, $username]);
            $user = $stmt->fetch();

            if (!$user || !in_array($user['is_active'], [true, 1, '1', 't', 'true'], true) || !self::verifyPassword($password, $user['password_hash'], $user['salt'] ?? null)) {
                $lockout = self::recordLoginFailure($ip);
                return ['status' => false, 'blocked' => $lockout['blocked'], 'lockout' => $lockout, 'message' => 'Username atau kata sandi tidak cocok.'];
            }

            $sessionVersion = (int)($user['session_version'] ?? 0);
            if (strpos($user['password_hash'], 'pbkdf2_sha256$') !== 0) {
                $newHash = self::hashNewPassword($password);
                $update = $pdo->prepare('UPDATE users SET password_hash = ?, session_version = session_version + 1, updated_at = NOW() WHERE id = ? RETURNING session_version');
                $update->execute([$newHash, $user['id']]);
                $sessionVersion = (int)$update->fetchColumn();
            }
            self::recordLoginSuccess($ip);

            if (!headers_sent()) {
                @session_regenerate_id(true);
            }

            $_SESSION['user_id']   = (int)$user['id'];
            $_SESSION['username']  = $user['username'];
            $_SESSION['full_name'] = $user['full_name'];
            $_SESSION['role']      = $user['role'];
            $_SESSION['sppg_name'] = $user['sppg_name'];
            $_SESSION['sppg_code'] = $user['sppg_code'];
            $_SESSION['session_version'] = $sessionVersion;
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
            error_log('[Auth Error] Authentication failed internally');
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

            $hash = self::hashNewPassword($password);
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
            error_log('[Auth Register Error] Registration failed internally');
            return ['status' => false, 'message' => 'Gagal mendaftarkan akun. Silakan coba kembali.'];
        }
    }

    /**
     * Cek apakah user sedang login
     */
    public static function check(): bool {
        if (!isset($_SESSION['user_id']) || empty($_SESSION['user_id'])) return false;
        try {
            $stmt = getDB()->prepare('SELECT session_version, is_active FROM users WHERE id = ?');
            $stmt->execute([(int)$_SESSION['user_id']]);
            $row = $stmt->fetch();
            if (!$row
                || !in_array($row['is_active'], [true, 1, '1', 't', 'true'], true)
                || (int)$row['session_version'] !== (int)($_SESSION['session_version'] ?? 0)) {
                $_SESSION = [];
                return false;
            }
            return true;
        } catch (Throwable $e) {
            error_log('[Auth Error] Session verification unavailable');
            return false;
        }
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

    /** API: respons JSON, role dan status aktif dibaca ulang dari DB. */
    public static function requireApiRole(string|array|null $roles = null): void {
        if (!self::check()) {
            Security::rejectRequest(401, 'Silakan masuk terlebih dahulu.');
        }
        try {
            $stmt = getDB()->prepare('SELECT id, username, full_name, role, sppg_name, sppg_code, is_active, session_version FROM users WHERE id = ?');
            $stmt->execute([(int)$_SESSION['user_id']]);
            $user = $stmt->fetch();
        } catch (Throwable $e) {
            error_log('[API Auth] User verification unavailable');
            Security::rejectRequest(503, 'Verifikasi akun sementara tidak tersedia.');
        }
        if (!$user || !in_array($user['is_active'], [true, 1, '1', 't', 'true'], true)
            || (int)$user['session_version'] !== (int)($_SESSION['session_version'] ?? 0)) {
            $_SESSION = [];
            Security::rejectRequest(401, 'Sesi tidak valid atau akun dinonaktifkan.');
        }
        foreach (['username', 'full_name', 'role', 'sppg_name', 'sppg_code'] as $key) {
            $_SESSION[$key] = $user[$key];
        }
        $allowed = is_array($roles) ? $roles : ($roles === null ? null : [$roles]);
        if ($allowed !== null && !in_array($user['role'], $allowed, true)) {
            Security::rejectRequest(403, 'Anda tidak memiliki izin mengakses API ini.');
        }
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