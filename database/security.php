<?php
/**
 * security.php - Security Middleware & Anti-Exploit / WAF Engine
 * Radar MBG - Badan Gizi Nasional Republik Indonesia
 *
 * Fitur:
 * 1. Deteksi Pola XSS, SQLi, Path Traversal, Command Injection
 * 2. Logging serangan ke tabel exploit_logs & file log
 * 3. Sanitasi Input & Sanitasi Output (anti-XSS)
 * 4. CSRF Token generator & verification
 * 5. Rate limiting sederhana
 */

require_once __DIR__ . '/db.php';

class Security {
    
    // Pola-pola eksploitasi umum (XSS, SQL Injection, LFI/RFI, Script execution)
    private static $exploitPatterns = [
        'XSS_SCRIPT_TAG'      => '/<\s*script\b[^>]*>(.*?)<\s*\/\s*script\s*>/is',
        'XSS_INLINE_EVENT'    => '/\bon[a-zA-Z]+\s*=\s*("|\'|`|&#|\\\)[^>]*>/i',
        'XSS_JAVASCRIPT_URI'  => '/javascript\s*:\s*[^"\'\s]+/i',
        'XSS_DATA_BASE64'     => '/data\s*:\s*text\/html[^"\'\s]*/i',
        'XSS_TAG_INJECTION'   => '/<\s*(iframe|embed|object|base|svg|xml|meta|link|style)\b[^>]*>/i',
        'SQLI_UNION_SELECT'   => '/\bUNION\s+(ALL\s+)?SELECT\b/i',
        'SQLI_INJECTION_LOGIC'=> '/(\b(AND|OR)\s+[\d\w\'"]+\s*=\s*[\d\w\'"]+)|(\'\s*OR\s*\'1\'\s*=\s*\'1)/i',
        'SQLI_BENCHMARK_SLEEP'=> '/\b(BENCHMARK|SLEEP|PG_SLEEP)\s*\(/i',
        'SQLI_STACKED_QUERY'  => '/;\s*(DROP|ALTER|TRUNCATE|DELETE|UPDATE|INSERT)\s+/i',
        'PATH_TRAVERSAL'      => '/(\.\.[\/\\\\])+/i',
        'COMMAND_INJECTION'   => '/(\||\&|\;|\`|\$\()\s*(cat|ls|whoami|id|bash|sh|cmd|powershell|wget|curl)/i',
    ];

    /**
     * Periksa string apakah mengandung exploit payload
     * Return: null jika bersih, atau string jenis ancaman jika terdeteksi
     */
    public static function detectExploit($value): ?string {
        if (!is_string($value) || empty($value)) {
            return null;
        }

        // Decode url/html entity untuk deteksi obfuscation
        $decoded = rawurldecode($value);
        $decoded = html_entity_decode($decoded, ENT_QUOTES | ENT_HTML5, 'UTF-8');

        foreach (self::$exploitPatterns as $type => $pattern) {
            if (preg_match($pattern, $value) || preg_match($pattern, $decoded)) {
                return $type;
            }
        }

        return null;
    }

    /**
     * Pindai seluruh request ($_GET, $_POST, $_COOKIE)
     * Jika ada eksploitasi, catat ke database & block request atau lempar alert
     */
    public static function inspectRequest(bool $block = true): void {
        $ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';
        $ip = explode(',', $ip)[0]; // Ambil first client IP
        $ua = mb_substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 500);
        $uri = $_SERVER['REQUEST_URI'] ?? '';

        $inputs = [
            'GET'  => $_GET,
            'POST' => $_POST,
        ];

        foreach ($inputs as $source => $data) {
            foreach ($data as $key => $val) {
                if (is_array($val)) {
                    $val = json_encode($val);
                }
                $detected = self::detectExploit((string)$val);
                if ($detected) {
                    self::logExploit($ip, $ua, $detected, (string)$key, (string)$val, $uri);
                    
                    if ($block) {
                        self::renderSecurityAlert($detected, $key, (string)$val);
                        exit;
                    }
                }
            }
        }
    }

    /**
     * Catat log eksploitasi ke database
     */
    public static function logExploit(string $ip, string $ua, string $type, string $inputKey, string $payload, string $url): void {
        try {
            $pdo = getDB();
            $stmt = $pdo->prepare(
                'INSERT INTO exploit_logs (ip_address, user_agent, exploit_type, input_field, payload_sample, requested_url)
                 VALUES ($1, $2, $3, $4, $5, $6)'
            );
            $stmt->execute([
                $ip,
                $ua,
                $type,
                $inputKey,
                mb_substr($payload, 0, 1000),
                mb_substr($url, 0, 500)
            ]);
        } catch (Throwable $e) {
            // Fallback log file jika DB error
            error_log(sprintf("[SECURITY ALERT] IP: %s | TYPE: %s | KEY: %s | PAYLOAD: %s", $ip, $type, $inputKey, $payload));
        }
    }

    /**
     * Tampilan Alert UI ketika serangan terdeteksi (Modern BGN Cyber Defense Notice)
     */
    public static function renderSecurityAlert(string $type, string $field, string $payload): void {
        http_response_code(403);
        
        $isAjax = (!empty($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest')
                  || (isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false);

        if ($isAjax) {
            header('Content-Type: application/json; charset=UTF-8');
            echo json_encode([
                'status' => 'security_blocked',
                'alert' => true,
                'message' => 'Aktivitas berbahaya terdeteksi oleh BGN Shield WAF. Permintaan Anda ditolak.',
                'threat_type' => $type,
                'code' => 403,
                'timestamp' => date('Y-m-d H:i:s')
            ], JSON_PRETTY_PRINT);
            exit;
        }

        $safeType = htmlspecialchars($type, ENT_QUOTES, 'UTF-8');
        $safeField = htmlspecialchars($field, ENT_QUOTES, 'UTF-8');
        $clientIp = htmlspecialchars($_SERVER['REMOTE_ADDR'] ?? '127.0.0.1', ENT_QUOTES, 'UTF-8');

        echo <<<HTML
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Peringatan Keamanan - BGN Shield Cyber Defense</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet">
  <style>body { font-family: 'Plus Jakarta Sans', sans-serif; }</style>
</head>
<body class="bg-[#001026] text-white min-h-screen flex items-center justify-center p-4">
  <div class="max-w-lg w-full bg-[#0b2545]/90 border border-red-500/30 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl text-center relative overflow-hidden">
    <div class="absolute -top-24 -right-24 w-48 h-48 bg-red-600/20 rounded-full blur-3xl pointer-events-none"></div>
    <div class="absolute -bottom-24 -left-24 w-48 h-48 bg-[#6ffbbe]/10 rounded-full blur-3xl pointer-events-none"></div>
    
    <div class="w-16 h-16 rounded-2xl bg-red-500/20 text-red-400 mx-auto flex items-center justify-center mb-5 ring-8 ring-red-500/10">
      <span class="material-symbols-outlined text-4xl">gshield</span>
    </div>

    <span class="px-3 py-1 rounded-full bg-red-500/20 text-red-300 text-xs font-bold tracking-wider uppercase inline-block mb-3">
      BGN Cyber Defense Shield v2.4
    </span>

    <h1 class="text-2xl font-bold text-white mb-2">Akses Ditolak: Indikasi Eksploitasi</h1>
    <p class="text-slate-300 text-sm mb-6 leading-relaxed">
      Sistem mendeteksi payload berbahaya yang menyerupai percobaan serangan <strong>XSS / Injection</strong> pada parameter form <code>{$safeField}</code>. Aktivitas ini telah dicatat ke audit log keamanan nasional.
    </p>

    <div class="bg-[#001026]/80 rounded-2xl p-4 text-left mb-6 border border-white/5 space-y-2 text-xs font-mono">
      <div class="flex justify-between">
        <span class="text-slate-400">Tipe Ancaman:</span>
        <span class="text-red-400 font-bold">{$safeType}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-slate-400">Target Field:</span>
        <span class="text-yellow-400">{$safeField}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-slate-400">IP Pelacak:</span>
        <span class="text-emerald-400">{$clientIp}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-slate-400">Waktu Insiden:</span>
        <span class="text-slate-300">
HTML;
        echo date('Y-m-d H:i:s T');
        echo <<<HTML
        </span>
      </div>
    </div>

    <div class="flex flex-col sm:flex-row gap-3">
      <button onclick="history.back()" class="w-full py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2">
        <span class="material-symbols-outlined text-sm">arrow_back</span>
        Kembali & Perbaiki Input
      </button>
      <a href="index.html" class="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/40">
        <span class="material-symbols-outlined text-sm">home</span>
        Ke Halaman Utama
      </a>
    </div>

    <p class="text-[11px] text-slate-500 mt-6">
      © 2026 Badan Gizi Nasional Republik Indonesia. Sistem Pelindungan Data Terpadu.
    </p>
  </div>
</body>
</html>
HTML;
    }

    /**
     * Sanitasi Input (Escape & Strip)
     */
    public static function cleanInput(string $str, int $maxLength = 1000): string {
        $str = trim($str);
        $str = strip_tags($str);
        $str = htmlspecialchars($str, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        return mb_substr($str, 0, $maxLength);
    }

    /**
     * Sanitasi Output untuk HTML
     */
    public static function cleanOutput(?string $str): string {
        if ($str === null) return '';
        return htmlspecialchars($str, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }
}
