<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
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
            'message' => $body['message'] ?? 'Sedang dalam pemeliharaan sistem.',
            'eta' => $body['eta'] ?? ''
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
