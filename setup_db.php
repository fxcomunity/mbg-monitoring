<?php
// setup_db.php – Jalankan SEKALI untuk membuat tabel di Neon PostgreSQL
// Akses via browser: https://mbg.jack-ai.my.id/setup_db.php
// HAPUS file ini setelah berhasil!

require __DIR__ . '/database/db.php';

header('Content-Type: text/plain; charset=UTF-8');

try {
    $pdo = getDB();
    echo "✅ Koneksi ke Neon PostgreSQL berhasil.\n\n";

    $sql = file_get_contents(__DIR__ . '/database/schema.sql');

    // Jalankan seluruh SQL sekaligus (PostgreSQL mendukung multi-statement)
    $pdo->exec($sql);

    echo "✅ Tabel laporan_aduan dan aduan_log berhasil dibuat.\n";
    echo "✅ Trigger updated_at terpasang.\n";
    echo "✅ Data demo (3 baris) berhasil dimasukkan.\n\n";
    echo "⚠️  PENTING: Hapus file setup_db.php dari server setelah ini!\n";

} catch (Throwable $e) {
    http_response_code(500);
    echo "❌ Error: " . $e->getMessage() . "\n";
}
