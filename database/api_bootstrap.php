<?php
/** Bootstrap untuk seluruh entry point API PHP lokal, termasuk akses langsung. */
require_once __DIR__ . '/security.php';

Security::sendHeaders(true);

// Jangan bocorkan exception/stack trace dari jalur endpoint yang belum menangkapnya.
ini_set('display_errors', '0');
set_exception_handler(static function (Throwable $error): void {
    Security::logFailure(basename($_SERVER['SCRIPT_FILENAME'] ?? 'api.php'), $error);
    Security::rejectRequest(500, 'Terjadi kesalahan sistem internal.');
});

Security::inspectRequest(true);
