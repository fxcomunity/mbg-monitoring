<?php
/** Jalankan: php tests/security_test.php (PHP 8+, proc_open; tanpa database/network). */
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../database/security.php';

function setSecurityState(string $name, $value): void {
    $property = new ReflectionProperty(Security::class, $name);
    $property->setAccessible(true);
    $property->setValue(null, $value);
}

function check(bool $condition, string $label): void {
    if (!$condition) {
        throw new RuntimeException('FAIL: ' . $label);
    }
}

// Subproses menguji jalur exit/status tanpa DB. Body stream diinjeksi pada cache;
// pembacaan php://input nyata dan headers perlu smoke test HTTP terpisah.
if (($argv[1] ?? '') === '--case') {
    $_GET = [];
    $_POST = [];
    $_COOKIE = [];
    $_SESSION = [];
    $_SERVER['REMOTE_ADDR'] = '192.0.2.10';
    $_SERVER['REQUEST_URI'] = '/api/maintenance.php?token=do-not-log';
    $_SERVER['REQUEST_METHOD'] = 'POST';
    $_SERVER['CONTENT_TYPE'] = 'application/json; charset=utf-8';
    setSecurityState('rawBody', '{"message":"Menu sehat","nested":{"value":"O\'Brien"},"password":"s3cret"}');
    // Hindari koneksi DB untuk kasus malicious; redaksi diuji terpisah di bawah.
    setSecurityState('logCount', 5);
    ini_set('session.save_path', sys_get_temp_dir());
    http_response_code(200);
    ob_start();
    register_shutdown_function(static function (): void {
        $body = ob_get_clean();
        echo json_encode(['code' => http_response_code(), 'body' => $body], JSON_INVALID_UTF8_SUBSTITUTE);
    });

    $case = $argv[2] ?? '';
    switch ($case) {
        case 'invalid-json':
            setSecurityState('rawBody', '{"broken":');
            break;
        case 'scalar-json':
            setSecurityState('rawBody', 'null');
            break;
        case 'deep-json':
            setSecurityState('rawBody', str_repeat('[', 40) . '0' . str_repeat(']', 40));
            break;
        case 'large-json':
            setSecurityState('rawBody', str_repeat(' ', Security::MAX_JSON_BYTES + 1));
            break;
        case 'nested-xss':
            setSecurityState('rawBody', json_encode(['nested' => [['message' => '<svg onload=alert(1)>']]]));
            break;
        case 'nested-key':
            setSecurityState('rawBody', json_encode(['nested' => ['<img src=x onerror=alert(1)>' => 'safe']]));
            break;
        case 'nested-sqli':
            setSecurityState('rawBody', json_encode(['nested' => [['query' => 'UNION/**/SELECT password FROM users']]]));
            break;
        case 'field-limit':
            setSecurityState('rawBody', json_encode(array_fill(0, 1025, 'safe')));
            break;
        case 'value-limit':
            setSecurityState('rawBody', json_encode(['value' => str_repeat('a', Security::MAX_VALUE_BYTES + 1)]));
            break;
        case 'form-depth':
            $_SERVER['CONTENT_TYPE'] = 'application/x-www-form-urlencoded';
            $value = 'safe';
            for ($i = 0; $i < 40; $i++) $value = ['nested' => $value];
            $_POST = $value;
            break;
        case 'anonymous-logs':

        case 'anonymous-status':
        case 'router-anonymous-status':
            $_SERVER['REQUEST_METHOD'] = 'GET';
            $_SERVER['CONTENT_TYPE'] = '';
            $files = [
                'anonymous-logs' => 'security_threats.php',

                'anonymous-status' => 'sppg_status.php',
                'router-anonymous-status' => 'index.php',
            ];
            if ($case === 'router-anonymous-status') $_GET['action'] = 'auth_user';
            require __DIR__ . '/../api/' . $files[$case];
            exit;
        case 'error-log':
            Security::logFailure('test.php', new PDOException("password=do-not-log\nforged log entry"));
            echo json_encode(['ok' => true]);
            exit;
        case 'credential-json':
            $body = ['nested' => ['value' => "O'Brien"]];
            foreach (['password', 'PASSWORD', 'currentPassword', 'new_password', 'confirm-password', 'password_confirmation', 'api_key', 'access_token', 'client_secret'] as $key) {
                $body[$key] = "credential-canary'; DROP TABLE users; <script>";
            }
            $body['passwords'] = ['password' => ['nested' => '<svg onload=alert(1)>']];
            setSecurityState('rawBody', json_encode($body));
            break;
        case 'credential-form':
        case 'page-credentials':
            $_SERVER['CONTENT_TYPE'] = 'application/x-www-form-urlencoded';
            $_POST = [
                'username' => 'valid_user',
                'password' => "credential-canary' OR '1'='1",
                'new_password' => '<script>secure-password',
                'confirm_password' => '<script>secure-password',
                'client_secret' => ['nested' => ['value' => 'UNION SELECT secret']],
            ];
            $original = $_POST;
            if ($case === 'credential-form') require __DIR__ . '/../database/api_bootstrap.php';
            Security::inspectRequest(true);
            Security::inspectRequest(true);
            check($_POST === $original, 'form/page credential values preserved');
            echo json_encode(['ok' => true]);
            exit;
        case 'credential-key':
            setSecurityState('rawBody', json_encode(['password' => ['<script>' => 'safe']]));
            break;
        case 'form-credential-key':
        case 'page-credential-key':
            $_SERVER['CONTENT_TYPE'] = 'application/x-www-form-urlencoded';
            $_POST = ['password' => ['<script>' => 'credential-canary']];
            if ($case === 'page-credential-key') {
                Security::inspectRequest(true);
            }
            break;
        case 'form-credential-sibling':
            $_SERVER['CONTENT_TYPE'] = 'application/x-www-form-urlencoded';
            $_POST = ['password' => 'UNION SELECT secret', 'username' => '<script>'];
            break;
        case 'credential-sibling':
            setSecurityState('rawBody', json_encode(['password' => 'UNION SELECT secret', 'message' => '<script>']));
            break;
        case 'credential-size':
            setSecurityState('rawBody', json_encode(['password' => str_repeat('a', Security::MAX_VALUE_BYTES + 1)]));
            break;
        case 'credential-fields':
            setSecurityState('rawBody', json_encode(['password' => array_fill(0, 1025, 'safe')]));
            break;
        case 'misleading-xss':
        case 'missing-type-xss':
        case 'getter-first-xss':
            $_SERVER['CONTENT_TYPE'] = $case === 'missing-type-xss' ? '' : 'text/plain';
            setSecurityState('rawBody', json_encode(['message' => '<img onerror=alert(1)>']));
            if ($case === 'getter-first-xss') {
                Security::sendHeaders(true);
                Security::jsonBody();
            }
            break;
        case 'misleading-sqli':
            $_SERVER['CONTENT_TYPE'] = 'text/plain';
            setSecurityState('rawBody', json_encode(['query' => 'UNION SELECT secret']));
            break;
        case 'getter-first-roundtrip':
            $_SERVER['CONTENT_TYPE'] = 'text/plain';
            check(Security::jsonBody()['password'] === 's3cret', 'getter before middleware');
            break;
        case 'json-limit-once':
            setSecurityState('rawBody', json_encode(array_fill(0, 1024, 'safe')));
            break;
        case 'combined-budget':
        case 'reverse-budget':
            $_GET = array_fill(0, 600, 'safe');
            setSecurityState('rawBody', json_encode(array_fill(0, 500, 'safe')));
            if ($case === 'reverse-budget') Security::jsonBody();
            break;
        case 'audit-upgrade':
            setSecurityState('rawBody', json_encode(['query' => 'UNION SELECT secret']));
            Security::inspectRequest(false);
            break;
        case 'roundtrip':
            break;
        default:
            throw new RuntimeException('Unknown case');
    }
    require __DIR__ . '/../database/api_bootstrap.php';
    // Getter sendiri wajib memeriksa JSON meski bootstrap melewati Content-Type.
    $body = Security::jsonBody();
    if (in_array($case, ['roundtrip', 'getter-first-roundtrip', 'credential-json'], true)) {
        check($body['nested']['value'] === "O'Brien", 'decoded body preserved');
    }
    if ($case === 'credential-json') {
        check($body['currentPassword'] === "credential-canary'; DROP TABLE users; <script>", 'JSON credentials preserved');
        check($body['passwords']['password']['nested'] === '<svg onload=alert(1)>', 'credential subtree preserved');
    }
    if ($case === 'roundtrip') check(str_contains(Security::rawBody(), 's3cret'), 'raw body preserved');
    if ($case === 'json-limit-once') {
        // Instrumentasi subproses: pemindaian ulang body akan memicu sentinel.
        setSecurityState('exploitPatterns', ['RESCAN_SENTINEL' => '~safe~']);
    }
    Security::inspectRequest(true);
    check(Security::jsonBody() === $body && Security::jsonBody() === $body, 'idempotent getter');
    echo json_encode($body);
    exit;
}

$malicious = [
    '<script src=x>' => 'XSS_SCRIPT_TAG',
    '<img src=x onerror=alert(1)>' => 'XSS_INLINE_EVENT',
    '<img/onerror=alert(1)>' => 'XSS_INLINE_EVENT',
    '<svg/onload=alert(1)>' => 'XSS_INLINE_EVENT',
    '<svg>' => 'XSS_TAG_INJECTION',
    'java&#x73;cript:alert(1)' => 'XSS_JAVASCRIPT_URI',
    "java\tscript:alert(1)" => 'XSS_JAVASCRIPT_URI',
    '%253Cscript%253E' => 'XSS_SCRIPT_TAG',
    'UNION/**/ALL/**/SELECT password' => 'SQLI_UNION_SELECT',
    'UN/**/ION SELECT password' => 'SQLI_UNION_SELECT',
    "' OR '1'='1" => 'SQLI_INJECTION_LOGIC',
    '1 OR 1=1' => 'SQLI_INJECTION_LOGIC',
    "'; DROP TABLE users" => 'SQLI_STACKED_QUERY',
    'pg_sleep(10)' => 'SQLI_BENCHMARK_SLEEP',
    '../../etc/passwd' => 'PATH_TRAVERSAL',
];
foreach ($malicious as $value => $expected) {
    check(Security::detectExploit($value) === $expected, 'detect ' . $expected);
}
foreach (["O'Brien", 'Menu nasi, ayam & sayur', 'Sekolah AND dapur', 'password-with-symbols!@#', '0', ''] as $value) {
    check(Security::detectExploit($value) === null, 'benign input preserved');
}
check(Security::detectExploit(str_repeat('x', Security::MAX_VALUE_BYTES + 1)) === 'INPUT_LIMIT', 'value bound');
$_SERVER['REMOTE_ADDR'] = '192.0.2.25';
$_SERVER['HTTP_X_FORWARDED_FOR'] = '127.0.0.1, 10.0.0.1';
check(Security::clientIp() === '192.0.2.25', 'XFF ignored');
$_SERVER['REMOTE_ADDR'] = "127.0.0.1\nforged";
check(Security::clientIp() === 'UNKNOWN', 'invalid peer rejected');
$_SERVER['REMOTE_ADDR'] = '2001:db8::1';
check(Security::clientIp() === '2001:db8::1', 'IPv6 peer');

$metadata = Security::logMetadata('192.0.2.1', 'XSS_SCRIPT_TAG', 'password=private-field', 'token=private-value<script>', '/MBG-MONITORING/api/maintenance.php?password=private-query');
$encoded = json_encode($metadata);
check(!str_contains($encoded, 'private-'), 'secret values, fields and query redacted');
check($metadata['url'] === '/api/maintenance.php', 'only endpoint path retained');
check(strlen($encoded) < 512, 'bounded audit metadata');
check(Security::safeLogUrl('/api/private-token/unknown.php?token=secret') === '[REDACTED]', 'unknown path redacted');
check(Security::safeLogUrl('//[') === '[REDACTED]', 'malformed URL safe');
$row = Security::safeLogRow([
    'id' => '9223372036854775807', 'ip_address' => '<img onerror=x>',
    'exploit_type' => '<script>secret</script>', 'input_field' => 'private-field',
    'requested_url' => '/api/index.php?token=private-query',
    'created_at' => '<svg onload=x>', 'payload_sample' => 'private-payload', 'user_agent' => 'private-ua',
]);
check($row['id'] === '9223372036854775807', 'BIGSERIAL not truncated');
check($row['ip'] === 'UNKNOWN' && $row['type'] === 'UNKNOWN', 'legacy metadata allowlisted');
check(!str_contains(json_encode($row), 'private-'), 'legacy secrets omitted');
check(!str_contains(json_encode($row), '<'), 'legacy HTML encoded');
check(!array_key_exists('payload_sample', $row) && !array_key_exists('user_agent', $row), 'sensitive columns omitted');
check($row['source'] === 'unknown', 'unknown legacy provenance');
foreach (['GET', 'POST', 'JSON', 'login_username'] as $field) {
    $serverRow = Security::safeLogRow(['input_field' => $field]);
    check($serverRow['source'] === 'server', 'PHP metadata field classification ' . $field);
}
foreach (['query', 'password', 'GET.evil', 'get', '', '[REDACTED]'] as $field) {
    check(Security::safeLogRow(['input_field' => $field])['source'] === 'unknown', 'no invented source for legacy field');
}

// Kontrak wiring statis, bukan pengganti tes authorization dengan PostgreSQL.
foreach (glob(__DIR__ . '/../api/*.php') as $apiFile) {
    check(str_contains(file_get_contents($apiFile), "'/../database/api_bootstrap.php'"), 'bootstrap ' . basename($apiFile));
}
check(!preg_match('/VALUES\s*\(\$[1-9]/', file_get_contents(__DIR__ . '/../database/security.php')), 'PDO log placeholders');
check(!preg_match('/ticket_code\s*=\s*\$[1-9]/', file_get_contents(__DIR__ . '/../api/tiket.php')), 'PDO ticket placeholders');

$reader = file_get_contents(__DIR__ . '/../api/security_threats.php');
check(str_contains($reader, "Security::rejectRequest(503, 'Log keamanan belum tersedia."), 'missing log table has actionable 503');
$notifications = file_get_contents(__DIR__ . '/../api/notifications.php');
check(!str_contains($notifications, "Auth::requireApiRole('admin')"), 'public bell not admin-only');
check(str_contains($notifications, '$latestLaporan = [];') && str_contains($notifications, '$pendingSppgLogos = 0;'), 'public detail defaults empty');
check(preg_match('/if \(\$isAdmin\) \{\s*\$latestLaporan = \$pdo->query\(/', $notifications) === 1, 'private reports query restricted to admin');
// Status tabel log dan proyeksi notifikasi juga perlu smoke test PostgreSQL.
$cases = [
    'roundtrip' => 200, 'invalid-json' => 400, 'scalar-json' => 400,
    'deep-json' => 400, 'large-json' => 413, 'nested-xss' => 403,
    'nested-key' => 403, 'nested-sqli' => 403, 'field-limit' => 413,
    'value-limit' => 403, 'form-depth' => 413, 'anonymous-logs' => 401,
    'anonymous-status' => 401, 'router-anonymous-status' => 200, 'error-log' => 200,
    'credential-json' => 200, 'credential-form' => 200, 'page-credentials' => 200,
    'credential-key' => 403, 'form-credential-key' => 403, 'page-credential-key' => 403,
    'form-credential-sibling' => 403, 'credential-sibling' => 403, 'credential-size' => 413,
    'credential-fields' => 413, 'misleading-xss' => 403, 'missing-type-xss' => 403,
    'misleading-sqli' => 403, 'getter-first-xss' => 403, 'getter-first-roundtrip' => 200,
    'json-limit-once' => 200, 'combined-budget' => 413, 'reverse-budget' => 413,
    'audit-upgrade' => 403,
];
foreach ($cases as $case => $expected) {
    $process = proc_open([PHP_BINARY, __FILE__, '--case', $case], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    check(is_resource($process), 'start subprocess ' . $case);
    fclose($pipes[0]);
    $out = stream_get_contents($pipes[1]);
    $err = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $exitCode = proc_close($process);
    $response = json_decode($out, true);
    check($exitCode === 0 && is_array($response), 'subprocess ' . $case . ': ' . $out . $err);
    check($response['code'] === $expected, 'HTTP status ' . $case . ': ' . $out);
    if ($case === 'page-credential-key') {
        check(str_contains($response['body'], '<!DOCTYPE html>'), 'page alert remains HTML');
        check(!str_contains($response['body'], 'credential-canary'), 'page alert does not reflect secret');
    } else {
        check(is_array(json_decode($response['body'], true)), 'JSON response ' . $case);
    }
    check(!str_contains($out . $err, 'do-not-log'), 'secret not reflected/logged ' . $case);
    check(!str_contains($err, 'credential-canary'), 'credentials never logged ' . $case);
    if ($case === 'roundtrip') {
        check(json_decode($response['body'], true)['password'] === 's3cret', 'endpoint receives original body');
    }
}
echo "PASS: PHP security unit, wiring, and isolated request tests\n";
