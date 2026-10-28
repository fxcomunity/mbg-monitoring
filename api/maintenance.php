<?php
/**
 * api/maintenance.php — Maintenance Mode Control (Admin Only)
 * Radar MBG - Badan Gizi Nasional
 */

require_once __DIR__ . '/../database/auth.php';
require_once __DIR__ . '/../database/security.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// ── Security Check ──────────────────────────────────────────────────
// Ensure user is logged in and is an Admin
if (!Auth::check()) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized: Silakan masuk terlebih dahulu.']);
    exit;
}

$currentUser = Auth::user();
if ($currentUser['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden: Hanya Satgas Admin yang dapat mengelola mode maintenance.']);
    exit;
}

$maintenanceFile = __DIR__ . '/../maintenance.json';

function getState(string $file): array {
    if (!file_exists($file)) {
        return ['active' => false, 'message' => '', 'eta' => ''];
    }
    $data = json_decode(file_get_contents($file), true);
    return is_array($data) ? $data : ['active' => false, 'message' => '', 'eta' => ''];
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode(getState($maintenanceFile));
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    $action = $body['action'] ?? ($_POST['action'] ?? '');

    if ($action === 'enable') {
        $state = [
            'active' => true,
            'message' => Security::cleanInput($body['message'] ?? 'Sedang dalam pemeliharaan sistem.'),
            'eta' => Security::cleanInput($body['eta'] ?? '')
        ];
        file_put_contents($maintenanceFile, json_encode($state, JSON_PRETTY_PRINT));
        echo json_encode(['success' => true, 'state' => $state]);
    } elseif ($action === 'disable') {
        $state = getState($maintenanceFile);
        $state['active'] = false;
        file_put_contents($maintenanceFile, json_encode($state, JSON_PRETTY_PRINT));
        echo json_encode(['success' => true, 'state' => $state]);
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'Action tidak valid. Gunakan enable atau disable.']);
    }
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
