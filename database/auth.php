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
            header('Location: login.php?msg=silakan_login');
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
