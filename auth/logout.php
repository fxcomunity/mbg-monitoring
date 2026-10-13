<?php
// auth/logout.php – Sesi Logout Pengguna BGN
require_once __DIR__ . '/../database/auth.php';
Auth::logout();
header('Location: ../login.php?logout=1');
exit;
