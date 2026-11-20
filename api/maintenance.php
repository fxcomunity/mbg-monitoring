<?php
require_once __DIR__ . '/../database/api_bootstrap.php';
require_once __DIR__ . '/../database/auth.php';
require_once __DIR__ . '/../database/security.php';

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-By');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

function maintenanceState(PDO $pdo): array {
    $row = $pdo->query(
        'SELECT active, message, eta FROM system_maintenance WHERE id = TRUE LIMIT 1'
    )->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        return ['active' => false, 'message' => 'Sedang dalam pemeliharaan sistem.', 'eta' => null];
    }
    return [
        'active' => in_array($row['active'], [true, 1, '1', 't', 'true'], true),
        'message' => Security::cleanOutput((string)$row['message']),
        'eta' => $row['eta'] ? (new DateTimeImmutable((string)$row['eta']))->format(DATE_ATOM) : null,
    ];
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode(maintenanceState(getDB()), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = Security::isJsonRequest() ? Security::jsonBody() : $_POST;
    $action = is_string($body['action'] ?? null) ? $body['action'] : '';
    Auth::requireApiRole('admin');
    $currentUser = Auth::user();
    $pdo = getDB();

    if ($action === 'enable') {
        $rawMessage = $body['message'] ?? 'Sedang dalam pemeliharaan sistem.';
        $rawEta = $body['eta'] ?? '';
        if (!is_string($rawMessage) || !is_string($rawEta)) {
            http_response_code(400);
            echo json_encode(['error' => 'Format pesan atau estimasi maintenance tidak valid.']);
            exit;
        }
        $message = trim(strip_tags($rawMessage));
        $message = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $message) ?? '';
        if ($message === '') $message = 'Sedang dalam pemeliharaan sistem.';
        if (mb_strlen($message, 'UTF-8') > 500) {
            http_response_code(400);
            echo json_encode(['error' => 'Pesan maintenance maksimal 500 karakter.']);
            exit;
        }
        $eta = null;
        if (trim($rawEta) !== '') {
            if (!preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/D', $rawEta)) {
                http_response_code(400);
                echo json_encode(['error' => 'Format estimasi selesai tidak valid.']);
                exit;
            }
            try {
                $eta = (new DateTimeImmutable($rawEta))->format(DATE_ATOM);
            } catch (Exception $error) {
                http_response_code(400);
                echo json_encode(['error' => 'Format estimasi selesai tidak valid.']);
                exit;
            }
        }
        $stmt = $pdo->prepare(
            'INSERT INTO system_maintenance (id, active, message, eta, updated_by, updated_at)
             VALUES (TRUE, TRUE, ?, ?, ?, NOW())
             ON CONFLICT (id) DO UPDATE
             SET active = TRUE, message = EXCLUDED.message, eta = EXCLUDED.eta,
                 updated_by = EXCLUDED.updated_by, updated_at = NOW()'
        );
        $stmt->execute([$message, $eta, (int)$currentUser['id']]);
        echo json_encode(['success' => true, 'state' => maintenanceState($pdo)], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } elseif ($action === 'disable') {
        $stmt = $pdo->prepare(
            'INSERT INTO system_maintenance (id, active, message, updated_by, updated_at)
             VALUES (TRUE, FALSE, ?, ?, NOW())
             ON CONFLICT (id) DO UPDATE
             SET active = FALSE, message = EXCLUDED.message, eta = NULL,
                 updated_by = EXCLUDED.updated_by, updated_at = NOW()'
        );
        $stmt->execute(['Sedang dalam pemeliharaan sistem.', (int)$currentUser['id']]);
        echo json_encode(['success' => true, 'state' => maintenanceState($pdo)], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'Action tidak valid. Gunakan enable atau disable.']);
    }
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method tidak diizinkan.']);
