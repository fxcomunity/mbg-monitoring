<?php
// api/index.php – Router & Central Controller API Radar MBG
require_once __DIR__ . '/../database/security.php';
require_once __DIR__ . '/../database/db.php';

// WAF Inspection for API
Security::inspectRequest(true);

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');

$action = trim($_GET['action'] ?? 'menu');

switch ($action) {
    case 'telemetri':
        require __DIR__ . '/telemetri.php';
        break;
    case 'distribusi':
        require __DIR__ . '/distribusi.php';
        break;
    case 'cek_tiket':
        require __DIR__ . '/tiket.php';
        break;
    case 'auth_user':
        require __DIR__ . '/auth_user.php';
        break;
    case 'data_mbg':
        require __DIR__ . '/data_mbg.php';
        break;
    case 'notifications':
        require __DIR__ . '/notifications.php';
        break;
    case 'change_password':
        require __DIR__ . '/change_password.php';
        break;
    case 'upload_avatar':
        require __DIR__ . '/upload_avatar.php';
        break;
    case 'menu':
    default:
        require __DIR__ . '/menu.php';
        break;
}
