<?php
/**
 * api/auth_user.php - Session Status & Profile Info Endpoint
 * Radar MBG - Badan Gizi Nasional
 */

require_once __DIR__ . '/../database/auth.php';
require_once __DIR__ . '/../database/security.php';

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: ' . (defined('ALLOWED_ORIGIN') ? ALLOWED_ORIGIN : '*'));
header('Access-Control-Allow-Credentials: true');
header('Cache-Control: no-cache, no-store, must-revalidate');

if (Auth::check()) {
    $u = Auth::user();
    $role = $u['role'] ?? 'user';
    $roleLabels = [
        'admin' => 'Admin Satgas BGN',
        'sppg'  => 'Pengelola Dapur SPPG',
        'user'  => 'Wali Murid / Publik'
    ];
    
    // Check if user uploaded a custom avatar in DB
    $avatar = $u['avatar_url'] ?? '';
    if (empty($avatar) || !file_exists(__DIR__ . '/../' . ltrim($avatar, '/'))) {
        // High quality, self-contained SVG avatars that never break even offline
        if ($role === 'admin') {
            $avatar = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='20' fill='%23001026'/><path d='M20 7l9 4v7c0 5.5-3.8 10.7-9 12-5.2-1.3-9-6.5-9-12V11l9-4z' fill='%23134074'/><circle cx='20' cy='15' r='4' fill='%236ffbbe'/><path d='M13 26c0-3.5 3.1-6 7-6s7 2.5 7 6v1h-14v-1z' fill='%236ffbbe'/></svg>";
        } elseif ($role === 'sppg') {
            $avatar = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='20' fill='%230b2545'/><path d='M20 10c-3.3 0-6 2.7-6 6v1h12v-1c0-3.3-2.7-6-6-6zm-8 9v2h16v-2H12zm2 4c0 3.3 2.7 6 6 6s6-2.7 6-6H14z' fill='%23f59e0b'/></svg>";
        } else {
            $avatar = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='20' fill='%23395f95'/><path d='M20 11c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 12c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z' fill='%23ffffff'/></svg>";
        }
    }

    echo json_encode([
        'logged_in' => true,
        'user' => [
            'id' => (int)$u['id'],
            'username' => Security::cleanOutput($u['username']),
            'full_name' => Security::cleanOutput($u['full_name'] ?: $u['username']),
            'email' => Security::cleanOutput($u['email'] ?? ''),
            'role' => $role,
            'role_label' => $roleLabels[$role] ?? ucfirst($role),
            'sppg_name' => Security::cleanOutput($u['sppg_name'] ?? ''),
            'avatar' => $avatar,
            'avatar_url' => $u['avatar_url'] ?? '',
            'avatar_pending_url' => $u['avatar_pending_url'] ?? '',
            'avatar_status' => $u['avatar_status'] ?? 'approved'
        ]
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
} else {
    echo json_encode([
        'logged_in' => false
    ], JSON_UNESCAPED_UNICODE);
}
