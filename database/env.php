<?php
/**
 * env.php — Lightweight .env loader (tanpa Composer/dependency)
 * Radar MBG Nasional – Badan Gizi Nasional
 *
 * Cara pakai:
 *   require_once __DIR__ . '/env.php';
 *   Env::load(__DIR__ . '/../.env');
 *   $host = Env::get('DB_HOST', 'localhost');
 */

class Env
{
    private static bool $loaded = false;

    /**
     * Load file .env ke dalam $_ENV dan getenv().
     * Dipanggil satu kali; call berulang diabaikan.
     */
    public static function load(string $filePath): void
    {
        if (self::$loaded) {
            return;
        }

        if (!is_file($filePath)) {
            // Tidak fatal — fallback ke OS environment vars (berguna di Cloudflare Workers / VPS)
            self::$loaded = true;
            return;
        }

        $lines = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            $line = trim($line);

            // Lewati komentar dan baris kosong
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }

            // Pisah KEY=VALUE (value boleh mengandung '=')
            $eqPos = strpos($line, '=');
            if ($eqPos === false) {
                continue;
            }

            $key   = trim(substr($line, 0, $eqPos));
            $value = trim(substr($line, $eqPos + 1));

            // Hapus kutip pembungkus: "value" atau 'value'
            if (
                (str_starts_with($value, '"') && str_ends_with($value, '"')) ||
                (str_starts_with($value, "'") && str_ends_with($value, "'"))
            ) {
                $value = substr($value, 1, -1);
            }

            // Set hanya jika belum ada (OS env vars lebih diprioritaskan)
            if (getenv($key) === false) {
                putenv("{$key}={$value}");
                $_ENV[$key] = $value;
            }
        }

        self::$loaded = true;
    }

    /**
     * Ambil nilai env var dengan fallback default.
     */
    public static function get(string $key, mixed $default = null): mixed
    {
        $val = $_ENV[$key] ?? getenv($key);
        return ($val !== false && $val !== null && $val !== '') ? $val : $default;
    }

    /**
     * Ambil nilai sebagai boolean.
     * Mengenali: true/false/1/0/yes/no/on/off
     */
    public static function bool(string $key, bool $default = false): bool
    {
        $val = strtolower((string) self::get($key, $default ? 'true' : 'false'));
        return in_array($val, ['true', '1', 'yes', 'on'], true);
    }

    /**
     * Ambil nilai sebagai integer.
     */
    public static function int(string $key, int $default = 0): int
    {
        return (int) self::get($key, $default);
    }
}
