<?php
/**
 * Middleware PHP lokal: inspeksi heuristik dan audit metadata terbatas.
 * Regex bukan jaminan keamanan: gunakan prepared statements, authorization,
 * validasi domain, dan output encoding sesuai konteks di setiap endpoint.
 */

require_once __DIR__ . '/db.php';

class Security {
    
    public const MAX_JSON_BYTES = 1048576;
    public const MAX_VALUE_BYTES = 65536;
    private const MAX_FIELDS = 1024;
    private const MAX_DEPTH = 32;
    private static $rawBody = null;
    private static $jsonBody = null;
    private static $inspected = false;
    private static $jsonInspected = false;
    private static $inputFields = 0;
    private static $inputBytes = 0;
    private static $jsonFields = 0;
    private static $jsonBytes = 0;
    private static $apiRequest = false;
    private static $logCount = 0;

    // Heuristik tambahan saja; tidak digunakan sebagai pengganti binding SQL.
    private static $exploitPatterns = [
        'XSS_SCRIPT_TAG'      => '~<\s*/?\s*script\b~i',
        'XSS_INLINE_EVENT'    => '~<[^>]*[\s/]on[a-z]+\s*=~i',
        'XSS_JAVASCRIPT_URI'  => '~(?:javascript|vbscript)\s*:~i',
        'XSS_DATA_BASE64'     => '/data\s*:\s*text\/html[^"\'\s]*/i',
        'XSS_TAG_INJECTION'   => '/<\s*(iframe|embed|object|base|svg|xml|meta|link|style)\b[^>]*>/i',
        'SQLI_UNION_SELECT'   => '~\bUNION\s+(?:(?:ALL|DISTINCT)\s+)?SELECT\b~i',
        'SQLI_INJECTION_LOGIC'=> '~(?:[\'"`]\s*|\b\d+\s+)\b(?:OR|AND)\s+(?:\d+\s*=\s*\d+|[\'"`][^\'"`]*[\'"`]\s*=\s*[\'"`][^\'"`]*|TRUE\b)~i',
        'SQLI_BENCHMARK_SLEEP'=> '/\b(BENCHMARK|SLEEP|PG_SLEEP|LOAD_FILE|EXTRACTVALUE)\s*\(/i',
        'SQLI_STACKED_QUERY'  => '/;\s*(DROP|ALTER|TRUNCATE|DELETE|UPDATE|INSERT)\s+/i',
        'PATH_TRAVERSAL'      => '/(\.\.[\/\\\\])+/i',
        'COMMAND_INJECTION'   => '/(\||\&|\;|\`|\$\()\s*(cat|ls|whoami|id|bash|sh|cmd|powershell|wget|curl)/i',
    ];

    /**
     * Periksa string apakah mengandung exploit payload
     * Return: null jika bersih, atau string jenis ancaman jika terdeteksi
     */
    public static function detectExploit($value): ?string {
        if (!is_string($value) || $value === '') {
            return null;
        }
        if (strlen($value) > self::MAX_VALUE_BYTES) {
            return 'INPUT_LIMIT';
        }

        // Batasi decoding untuk menghindari kerja tak terbatas pada input berlapis.
        $variants = [$value];
        for ($i = 0; $i < 2; $i++) {
            $decoded = html_entity_decode(rawurldecode($value), ENT_QUOTES | ENT_HTML5, 'UTF-8');
            $decoded = preg_replace('/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/', '', $decoded);
            $variants[] = $decoded;
            $variants[] = preg_replace('~/\*.*?\*/~s', ' ', $decoded);
            $variants[] = preg_replace('~/\*.*?\*/~s', '', $decoded);
            $variants[] = preg_replace('/[\x00-\x1f\x7f]/', '', $decoded);
            $value = $decoded;
        }
        foreach (self::$exploitPatterns as $type => $pattern) {
            foreach ($variants as $variant) {
                if (preg_match($pattern, $variant) === 1) {
                    return $type;
                }
            }
        }
        return null;
    }

    public static function sendHeaders(bool $api = false): void {
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('Referrer-Policy: no-referrer');
        header('Permissions-Policy: camera=(), microphone=(self), geolocation=()');
        if ($api) {
            self::$apiRequest = true;
            header('Content-Type: application/json; charset=UTF-8');
            header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
            header('Cache-Control: no-store');
        }
    }

    public static function clientIp(): string {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : 'UNKNOWN';
    }

    public static function logFailure(string $context, Throwable $error): void {
        // PostgreSQL exception text dapat berisi nilai bind dan data pribadi.
        $code = (string)$error->getCode();
        $code = preg_match('/^[A-Z0-9]{5}$/D', $code) ? $code : 'UNKNOWN';
        error_log('[PHP API] ' . preg_replace('/[^a-z0-9_.-]/i', '_', substr($context, 0, 80)) . ' code=' . $code);
    }

    public static function rejectRequest(int $status, string $message): void {
        http_response_code($status);
        header('Content-Type: application/json; charset=UTF-8');
        header('Cache-Control: no-store');
        echo json_encode(['status' => 'error', 'message' => $message]);
        exit;
    }

    public static function isJsonRequest(): bool {
        $type = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
        return $type === 'application/json' || preg_match('~^application/[a-z0-9.+-]+\+json$~D', $type) === 1;
    }

    // Cache tidak mengubah $_POST atau nilai body. Endpoint JSON memakai getter yang sama.
    public static function rawBody(): string {
        if (self::$rawBody === null) {
            $stream = fopen('php://input', 'rb');
            if ($stream === false) {
                self::rejectRequest(400, 'Body permintaan tidak dapat dibaca.');
            }
            $raw = stream_get_contents($stream, self::MAX_JSON_BYTES + 1);
            fclose($stream);
            if ($raw === false) {
                self::rejectRequest(400, 'Body permintaan tidak dapat dibaca.');
            }
            self::$rawBody = $raw;
        }
        if (strlen(self::$rawBody) > self::MAX_JSON_BYTES) {
            self::rejectRequest(413, 'Body JSON terlalu besar.');
        }
        return self::$rawBody;
    }

    public static function jsonBody(): array {
        // Jaminan berlaku juga bila handler menerima JSON dengan Content-Type salah.
        self::inspectJsonBody(true);
        return self::$jsonBody;
    }

    private static function decodeJsonBody(): array {
        if (self::$jsonBody === null) {
            $raw = self::rawBody();
            $body = json_decode($raw, true, self::MAX_DEPTH);
            if (json_last_error() !== JSON_ERROR_NONE || !is_array($body)) {
                self::rejectRequest(400, 'Body JSON harus berupa object atau array yang valid.');
            }
            self::$jsonBody = $body;
        }
        return self::$jsonBody;
    }

    private static function inspectJsonBody(bool $block): void {
        if (self::$jsonInspected) return;
        $body = self::decodeJsonBody();
        $fields = 0;
        $bytes = 0;
        self::inspectValues($body, 'JSON', 0, $fields, $bytes, $block);
        self::$jsonFields = $fields;
        self::$jsonBytes = $bytes;
        self::checkInputBudget(self::$inputFields + $fields, self::$inputBytes + $bytes);
        self::$jsonInspected = $block;
    }

    public static function inspectRequest(bool $block = true): void {
        if (self::$inspected) return;
        $fields = 0;
        $bytes = 0;
        foreach (['GET' => $_GET, 'POST' => $_POST] as $source => $data) {
            self::inspectValues($data, $source, 0, $fields, $bytes, $block);
        }
        self::$inputFields = $fields;
        self::$inputBytes = $bytes;
        if (self::isJsonRequest()) {
            self::inspectJsonBody($block);
        }
        self::checkInputBudget($fields + self::$jsonFields, $bytes + self::$jsonBytes);
        self::$inspected = $block;
    }

    private static function checkInputBudget(int $fields, int $bytes): void {
        if ($fields > self::MAX_FIELDS || $bytes > self::MAX_JSON_BYTES) {
            self::rejectRequest(413, 'Batas input terlampaui.');
        }
    }

    private static function isCredentialKey(string $key): bool {
        $key = strtolower(preg_replace('/([a-z0-9])([A-Z])/', '$1_$2', $key));
        $key = str_replace('-', '_', $key);
        return preg_match('/(?:^|_)(?:password|passwd|pwd|token|secret|authorization)(?:_|$)/D', $key) === 1
            || in_array($key, ['pass', 'api_key', 'apikey'], true);
    }

    private static function inspectValues(array $data, string $source, int $depth, int &$fields, int &$bytes, bool $block, bool $credentialSubtree = false): void {
        if ($depth > self::MAX_DEPTH) {
            self::rejectRequest(413, 'Struktur input terlalu dalam.');
        }
        foreach ($data as $key => $value) {
            $fields++;
            $bytes += strlen((string)$key) + (is_scalar($value) ? strlen((string)$value) : 0);
            self::checkInputBudget($fields, $bytes);
            $credentialValue = $credentialSubtree || self::isCredentialKey((string)$key);
            // Secret bebas memiliki simbol SQL/HTML. Batas resource dan inspeksi
            // SEMUA key (termasuk di bawah subtree secret) tetap diberlakukan.
            if ($credentialValue && is_scalar($value) && strlen((string)$value) > self::MAX_VALUE_BYTES) {
                self::rejectRequest(413, 'Nilai kredensial terlalu besar.');
            }
            $candidates = [(string)$key];
            if (!$credentialValue && is_scalar($value)) $candidates[] = (string)$value;
            foreach ($candidates as $candidate) {
                $detected = self::detectExploit($candidate);
                if ($detected !== null) {
                    self::logExploit(self::clientIp(), '', $detected, $source, $candidate, $_SERVER['REQUEST_URI'] ?? '');
                    if ($block) {
                        self::renderSecurityAlert($detected, $source, '');
                        exit;
                    }
                }
            }
            if (is_array($value)) {
                self::inspectValues($value, $source, $depth + 1, $fields, $bytes, $block, $credentialValue);
            }
        }
    }

    // Allowlist path endpoint saja; query/fragment, kredensial, dan path lain dibuang.
    public static function safeLogUrl(string $url): string {
        $path = parse_url(substr($url, 0, 4096), PHP_URL_PATH);
        if (!is_string($path)) return '[REDACTED]';
        $apiNames = ['auth_user', 'change_password', 'data_mbg', 'distribusi', 'home_menu', 'index', 'juknis', 'live_chat', 'maintenance', 'menu', 'notifications', 'security_threats', 'sppg_map', 'sppg_provinsi', 'sppg_status', 'telemetri', 'tiket', 'upload_avatar'];
        foreach ($apiNames as $name) {
            $suffix = '/api/' . $name . '.php';
            if (str_ends_with($path, $suffix)) return $suffix;
        }
        foreach (['/auth/login.php', '/auth/logout.php'] as $suffix) {
            if (str_ends_with($path, $suffix)) return $suffix;
        }
        return '[REDACTED]';
    }

    /**
     * Catat log eksploitasi ke database
     */
    public static function logExploit(string $ip, string $ua, string $type, string $inputKey, string $payload, string $url): void {
        // Jangan simpan sampel mentah, bahkan untuk field non-secret: isinya bisa
        // menyertakan password/token milik field lain. Batasi juga amplifikasi log.
        if (self::$logCount++ >= 5) return;
        $metadata = self::logMetadata($ip, $type, $inputKey, $payload, $url);
        try {
            $pdo = getDB();
            $stmt = $pdo->prepare(
                'INSERT INTO exploit_logs (ip_address, user_agent, exploit_type, input_field, payload_sample, requested_url)
                 VALUES (?, ?, ?, ?, ?, ?)'
            );
            $stmt->execute([
                $metadata['ip'], '[REDACTED]', $metadata['type'],
                $metadata['field'], $metadata['sample'], $metadata['url']
            ]);
        } catch (Throwable $e) {
            // JSON satu baris mencegah log forging; exception DB bisa memuat bind values.
            error_log('[SECURITY ALERT] ' . json_encode($metadata, JSON_INVALID_UTF8_SUBSTITUTE));
        }
    }

    private static function isServerLogField(string $field): bool {
        return in_array($field, ['GET', 'POST', 'JSON', 'login_username'], true);
    }

    public static function logMetadata(string $ip, string $type, string $field, string $payload, string $url): array {
        return [
            'ip' => filter_var($ip, FILTER_VALIDATE_IP) ? $ip : 'UNKNOWN',
            'type' => array_key_exists($type, self::$exploitPatterns) || $type === 'INPUT_LIMIT' ? $type : 'UNKNOWN',
            'field' => self::isServerLogField($field) ? $field : '[REDACTED]',
            'sample' => '[REDACTED; bytes=' . strlen($payload) . ']',
            'url' => self::safeLogUrl($url),
        ];
    }

    public static function safeLogRow(array $row): array {
        $metadata = self::logMetadata((string)($row['ip_address'] ?? ''), (string)($row['exploit_type'] ?? ''), (string)($row['input_field'] ?? ''), '', (string)($row['requested_url'] ?? ''));
        return [
            'id' => ctype_digit((string)($row['id'] ?? '')) ? (string)$row['id'] : null,
            'ip' => $metadata['ip'],
            'type' => $metadata['type'],
            'field' => $metadata['field'],
            // Klasifikasi format metadata saja, BUKAN bukti asal/autentisitas log.
            'source' => self::isServerLogField((string)($row['input_field'] ?? '')) ? 'server' : 'unknown',
            'url' => $metadata['url'],
            'ts' => htmlspecialchars(substr((string)($row['created_at'] ?? ''), 0, 64), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'),
        ];
    }

    /**
     * Tampilan Alert UI ketika serangan terdeteksi (Modern BGN Cyber Defense Notice)
     */
    public static function renderSecurityAlert(string $type, string $field, string $payload): void {
        http_response_code(403);
        header('Cache-Control: no-store');
        
        $isAjax = self::$apiRequest || (!empty($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest')
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
        return htmlspecialchars($str, ENT_QUOTES | ENT_HTML5 | ENT_SUBSTITUTE, 'UTF-8');
    }
}
