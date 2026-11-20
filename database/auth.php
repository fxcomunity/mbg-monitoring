<?php
/**
 * auth.php - Session Management & Role-Based Access Control
 * Radar MBG - Badan Gizi Nasional
 */

$sessionLifetime = 30 * 24 * 60 * 60;
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.gc_maxlifetime', (string)$sessionLifetime);
    session_set_cookie_params([
        'lifetime' => $sessionLifetime,
        'path' => '/',
        'domain' => '',
        'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/security.php';

Security::sendHeaders();

class Auth {
    public static function hashNewPassword(string $password): string {
        $salt = bin2hex(random_bytes(16));
        $iterations = 310000;
        $hash = bin2hex(hash_pbkdf2('sha256', $password, $salt, $iterations, 64, true));
        return 'pbkdf2_sha256$' . $iterations . '$' . $salt . '$' . $hash;
    }

    public static function verifyPassword(string $password, string $storedHash, ?string $legacySalt = null): bool {
        if (preg_match('/^pbkdf2_sha256\$([0-9]{6})\$([a-f0-9]{32})\$([a-f0-9]{64}|[a-f0-9]{128})$/D', $storedHash, $parts)) {
            $iterations = (int)$parts[1];
            if ($iterations < 100000 || $iterations > 600000) return false;
            $candidate = strlen($parts[3]) === 128
                ? bin2hex(hash_pbkdf2('sha256', $password, $parts[2], $iterations, 64, true))
                : hash_pbkdf2('sha256', $password, $parts[2], $iterations, 64);
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

    private static function recordLoginFailure(string $ip): array {
        $pdo = getDB();
        $stmt = $pdo->prepare(
            "WITH updated_lockout AS (
                INSERT INTO auth_ip_lockouts (ip_address, failed_attempts)
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
                RETURNING ip_address, failed_attempts, locked_until, is_permanent
             ),
             logged_event AS (
                INSERT INTO auth_security_events (ip_address, event_type, failed_attempts, blocked_until, is_permanent)
                SELECT ip_address,
                       CASE WHEN is_permanent OR failed_attempts IN (5, 10) THEN 'login_locked' ELSE 'login_failed' END,
                       failed_attempts, locked_until, is_permanent
                FROM updated_lockout
             )
             SELECT failed_attempts, locked_until, is_permanent FROM updated_lockout"
        );
        $stmt->execute([$ip]);
        $row = $stmt->fetch();
        $attempts = (int)$row['failed_attempts'];
        $permanent = in_array($row['is_permanent'], [true, 1, '1', 't', 'true'], true);
        $until = $row['locked_until'] ?? null;
        return [
            'ip' => $ip,
            'blocked' => $permanent || $until !== null,
            'failed_attempts' => $attempts,
            'blocked_until' => $until,
            'permanent' => $permanent,
        ];
    }

    private static function recordLoginSuccess(string $ip): void {
        $stmt = getDB()->prepare(
            "WITH reset_lockout AS (
                UPDATE auth_ip_lockouts
                SET failed_attempts = 0, locked_until = NULL, updated_at = NOW()
                WHERE ip_address = ? AND is_permanent = FALSE
                RETURNING ip_address
             )
             INSERT INTO auth_security_events (ip_address, event_type, failed_attempts, blocked_until, is_permanent)
             VALUES (?, 'login_success', 0, NULL, FALSE)"
        );
        $stmt->execute([$ip, $ip]);
    }

    /**
     * Login autentikasi dengan sanitasi input & perlindungan brute force
     */
    public static function login(string $username, string $password): array {
        $username = trim($username);

        try {
            $ip = Security::clientIp();
            $threat = Security::detectExploit($username);
            if ($threat || $username === '' || strlen($username) > 254 || strlen($password) > 1024
                || (!filter_var($username, FILTER_VALIDATE_EMAIL)
                    && !preg_match('/^[a-zA-Z0-9_.-]{3,60}$/D', $username))) {
                $lockout = self::lockoutStatus($ip);
                if ($lockout['blocked']) {
                    return ['status' => false, 'blocked' => true, 'lockout' => $lockout, 'message' => 'Akses login dari alamat IP ini sedang dibatasi.'];
                }
            }

            if ($threat) {
                Security::logExploit($ip, '', $threat, 'login_username', $username, '/auth/login.php');
                $lockout = self::recordLoginFailure($ip);
                return ['status' => false, 'blocked' => $lockout['blocked'], 'lockout' => $lockout, 'message' => 'Input tidak valid.'];
            }
            if ($username === '' || strlen($username) > 254 || strlen($password) > 1024
                || (!filter_var($username, FILTER_VALIDATE_EMAIL)
                    && !preg_match('/^[a-zA-Z0-9_.-]{3,60}$/D', $username))) {
                $lockout = self::recordLoginFailure($ip);
                return ['status' => false, 'blocked' => $lockout['blocked'], 'lockout' => $lockout, 'message' => 'Username atau kata sandi tidak cocok.'];
            }

            $pdo = getDB();
            $stmt = $pdo->prepare(
                'SELECT COALESCE(l.failed_attempts, 0) AS lockout_failed_attempts,
                        l.locked_until AS lockout_blocked_until,
                        COALESCE(l.is_permanent, FALSE) AS lockout_permanent,
                        COALESCE(l.is_permanent OR l.locked_until > NOW(), FALSE) AS lockout_blocked,
                        u.id, u.username, u.email, u.password_hash, u.salt, u.full_name,
                        u.role, u.sppg_name, u.sppg_code, u.avatar_url,
                        u.is_active, u.status_verifikasi, u.session_version
                 FROM (SELECT 1) AS request
                 LEFT JOIN auth_ip_lockouts l ON l.ip_address = ?
                 LEFT JOIN LATERAL (
                    SELECT id, username, email, password_hash, salt, full_name,
                           role, sppg_name, sppg_code, avatar_url,
                           is_active, status_verifikasi, session_version
                    FROM users
                    WHERE (username = ? OR email = ?)
                      AND NOT COALESCE(l.is_permanent OR l.locked_until > NOW(), FALSE)
                    LIMIT 1
                 ) u ON TRUE'
            );
            $stmt->execute([$ip, $username, $username]);
            $row = $stmt->fetch() ?: [];
            $lockout = [
                'ip' => $ip,
                'blocked' => in_array($row['lockout_blocked'] ?? false, [true, 1, '1', 't', 'true'], true),
                'failed_attempts' => (int)($row['lockout_failed_attempts'] ?? 0),
                'blocked_until' => $row['lockout_blocked_until'] ?? null,
                'permanent' => in_array($row['lockout_permanent'] ?? false, [true, 1, '1', 't', 'true'], true),
            ];
            if ($lockout['blocked']) {
                return ['status' => false, 'blocked' => true, 'lockout' => $lockout, 'message' => 'Akses login dari alamat IP ini sedang dibatasi.'];
            }
            $user = ($row['id'] ?? null) === null ? null : $row;

            if (!$user || !in_array($user['is_active'], [true, 1, '1', 't', 'true'], true)
                || !in_array($user['role'], ['admin', 'sppg', 'user'], true)
                || ($user['role'] === 'sppg' && strtolower((string)($user['status_verifikasi'] ?? '')) !== 'approved')
                || !self::verifyPassword($password, $user['password_hash'], $user['salt'] ?? null)) {
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
                    'sppg_name' => $user['sppg_name'],
                    'avatar_url' => $user['avatar_url'] ?? ''
                ]
            ];
        } catch (Throwable $e) {
            Security::logFailure('Auth::login', $e);
            return ['status' => false, 'unavailable' => true, 'message' => 'Layanan autentikasi sementara tidak tersedia.'];
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

        if (strlen($fullName) > 120 || strlen($email) > 120 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ['status' => false, 'message' => 'Format alamat email tidak valid.'];
        }

        if (strlen($username) > 60 || strlen($username) < 3 || !preg_match('/^[a-zA-Z0-9_.-]+$/D', $username)) {
            return ['status' => false, 'message' => 'Username minimal 3 karakter (hanya huruf, angka, titik, strip).'];
        }

        if (strlen($password) < 12 || strlen($password) > 1024) {
            return ['status' => false, 'message' => 'Kata sandi minimal 12 karakter dan maksimal 1024 karakter.'];
        }
        $passwordCategories = 0;
        if (preg_match('/[a-z]/', $password)) $passwordCategories++;
        if (preg_match('/[A-Z]/', $password)) $passwordCategories++;
        if (preg_match('/[0-9]/', $password)) $passwordCategories++;
        if (preg_match('/[^A-Za-z0-9]/', $password)) $passwordCategories++;
        if ($passwordCategories < 3) {
            return ['status' => false, 'message' => 'Kata sandi harus menggabungkan minimal tiga jenis: huruf besar, huruf kecil, angka, atau simbol.'];
        }
        if (Security::detectExploit($fullName) || Security::detectExploit($email) ||
            Security::detectExploit($username) || Security::detectExploit($sppgName)) {
            return ['status' => false, 'message' => 'Input pendaftaran tidak valid atau berisi pola berbahaya.'];
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
            $stmt = getDB()->prepare('SELECT session_version, is_active, role, status_verifikasi FROM users WHERE id = ?');
            $stmt->execute([(int)$_SESSION['user_id']]);
            $row = $stmt->fetch();
            if (!$row
                || !in_array($row['is_active'], [true, 1, '1', 't', 'true'], true)
                || ($row['role'] === 'sppg' && strtolower((string)($row['status_verifikasi'] ?? '')) !== 'approved')
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

    /** Ambil profil API beserta validasi sesi dalam satu query. */
    public static function currentApiUser(): ?array {
        if (empty($_SESSION['user_id'])) return null;

        try {
            $stmt = getDB()->prepare(
                'SELECT id, username, email, full_name, role, sppg_name, sppg_code,
                        avatar_url, avatar_pending_url, avatar_status, is_active,
                        status_verifikasi, session_version
                 FROM users WHERE id = ? LIMIT 1'
            );
            $stmt->execute([(int)$_SESSION['user_id']]);
            $user = $stmt->fetch();
        } catch (Throwable $e) {
            error_log('[API Auth] User profile verification unavailable');
            Security::rejectRequest(503, 'Verifikasi akun sementara tidak tersedia.');
        }

        if (!$user
            || !in_array($user['is_active'], [true, 1, '1', 't', 'true'], true)
            || ($user['role'] === 'sppg' && strtolower((string)($user['status_verifikasi'] ?? '')) !== 'approved')
            || (int)$user['session_version'] !== (int)($_SESSION['session_version'] ?? 0)) {
            $_SESSION = [];
            return null;
        }

        foreach (['username', 'full_name', 'role', 'sppg_name', 'sppg_code'] as $key) {
            $_SESSION[$key] = $user[$key];
        }
        return $user;
    }

    /** API: respons JSON, role dan status aktif dibaca ulang dari DB. */
    public static function requireApiRole(string|array|null $roles = null): void {
        if (!self::check()) {
            Security::rejectRequest(401, 'Silakan masuk terlebih dahulu.');
        }
        try {
            $stmt = getDB()->prepare('SELECT id, username, full_name, role, sppg_name, sppg_code, is_active, status_verifikasi, session_version FROM users WHERE id = ?');
            $stmt->execute([(int)$_SESSION['user_id']]);
            $user = $stmt->fetch();
        } catch (Throwable $e) {
            error_log('[API Auth] User verification unavailable');
            Security::rejectRequest(503, 'Verifikasi akun sementara tidak tersedia.');
        }
        if (!$user || !in_array($user['is_active'], [true, 1, '1', 't', 'true'], true)
            || ($user['role'] === 'sppg' && strtolower((string)($user['status_verifikasi'] ?? '')) !== 'approved')
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
            setcookie(session_name(), '', [
                'expires' => time() - 42000,
                'path' => $params['path'],
                'domain' => $params['domain'],
                'secure' => $params['secure'],
                'httponly' => $params['httponly'],
                'samesite' => $params['samesite'] ?: 'Strict',
            ]);
        }
        session_destroy();
    }
}