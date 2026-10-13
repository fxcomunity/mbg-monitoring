<?php
/**
 * db.php – Koneksi database PDO singleton (env-driven, PostgreSQL/Neon)
 * Radar MBG Nasional – Badan Gizi Nasional
 *
 * Mendukung DATABASE_URL maupun variabel individual (DB_HOST, DB_USER, dll)
 */

require_once __DIR__ . '/env.php';

Env::load(__DIR__ . '/../.env');

// Cek apakah DATABASE_URL tersedia di .env
$dbUrl = Env::get('DATABASE_URL', '');

if (!empty($dbUrl)) {
    // Parse DATABASE_URL: postgresql://user:pass@host:port/dbname?sslmode=require...
    $parsed = parse_url($dbUrl);
    
    $driver   = ($parsed['scheme'] === 'postgres' || $parsed['scheme'] === 'postgresql') ? 'pgsql' : $parsed['scheme'];
    $dbHost   = $parsed['host'] ?? '127.0.0.1';
    $dbPort   = $parsed['port'] ?? '5432';
    $dbUser   = $parsed['user'] ?? 'postgres';
    $dbPass   = $parsed['pass'] ?? '';
    $dbName   = isset($parsed['path']) ? ltrim($parsed['path'], '/') : 'neondb';
    
    // Parse query params for sslmode
    $sslMode = 'require';
    if (!empty($parsed['query'])) {
        parse_str($parsed['query'], $queryParams);
        if (!empty($queryParams['sslmode'])) {
            $sslMode = $queryParams['sslmode'];
        }
    }

    define('DB_CONNECTION', $driver);
    define('DB_HOST',       $dbHost);
    define('DB_PORT',       (string)$dbPort);
    define('DB_NAME',       $dbName);
    define('DB_USER',       $dbUser);
    define('DB_PASS',       $dbPass);
    define('DB_SSL',        true);
    define('DB_SSL_MODE',   $sslMode);
} else {
    // Fallback ke config individual
    define('DB_CONNECTION', Env::get('DB_CONNECTION', 'pgsql'));
    define('DB_HOST',       Env::get('DB_HOST',       '127.0.0.1'));
    define('DB_PORT',       Env::get('DB_PORT',       '5432'));
    define('DB_NAME',       Env::get('DB_NAME',       'neondb'));
    define('DB_USER',       Env::get('DB_USER',       'postgres'));
    define('DB_PASS',       Env::get('DB_PASS',       ''));
    define('DB_SSL',        Env::bool('DB_SSL',        true));
    define('DB_SSL_MODE',   Env::get('DB_SSL_MODE',   'require'));
}

// Upload config
define('UPLOAD_DIR',           __DIR__ . '/../uploads/aduan/');
define('UPLOAD_MAX_MB',        Env::int('UPLOAD_MAX_MB', 10));
define('UPLOAD_ALLOWED_TYPES', ['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

// CORS
define('ALLOWED_ORIGIN', Env::get('ALLOWED_ORIGIN', '*'));

/**
 * Singleton PDO – PostgreSQL (Neon)
 */
function getDB(): PDO
{
    static $pdo = null;

    if ($pdo !== null) {
        return $pdo;
    }

    // Build DSN
    $sslmode = DB_SSL ? DB_SSL_MODE : 'disable';

    $dsn = sprintf(
        'pgsql:host=%s;port=%s;dbname=%s;sslmode=%s',
        DB_HOST, DB_PORT, DB_NAME, $sslmode
    );

    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
        PDO::ATTR_TIMEOUT            => 15,
    ];

    $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);

    // Set timezone ke UTC
    $pdo->exec("SET TIME ZONE 'UTC'");

    return $pdo;
}
