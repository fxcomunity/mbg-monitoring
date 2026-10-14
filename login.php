<?php
// Legacy redirect ke lokasi autentikasi baru (query string dipertahankan,
// supaya ?action=logout dan ?tab=register tetap bekerja)
$qs = $_SERVER['QUERY_STRING'] ?? '';
header('Location: auth/login.php' . ($qs !== '' ? '?' . $qs : ''));
exit();