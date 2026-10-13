<?php
/**
 * db.php – Koneksi database PDO singleton
 * Radar MBG Nasional – Badan Gizi Nasional
 */

define('DB_HOST', '127.0.0.1');
define('DB_PORT', '3306');
define('DB_NAME', 'radar_mbg');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_CHARSET', 'utf8mb4');

// Upload config
define('UPLOAD_DIR', __DIR__ . '/uploads/aduan/');
define('UPLOAD_MAX_MB', 10);
define('UPLOAD_ALLOWED_TYPES', ['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=%s',
            DB_HOST, DB_PORT, DB_NAME, DB_CHARSET
        );
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    }
    return $pdo;
}
