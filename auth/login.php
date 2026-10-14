<?php
/**
 * auth/login.php - Forwarder ke Portal Autentikasi Utama di root
 */
header('Location: ../login.php' . (!empty($_SERVER['QUERY_STRING']) ? '?' . $_SERVER['QUERY_STRING'] : ''));
exit;
