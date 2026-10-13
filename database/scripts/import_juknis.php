<?php
/**
 * import_juknis.php — Insert official BGN Juknis (technical guidelines) documents
 * Source: https://www.bgnpusat.org/juknis
 */

require_once __DIR__ . '/db.php';

$pdo = getDB();

echo "Creating table dokumen_juknis..." . PHP_EOL;

$pdo->exec("
CREATE TABLE IF NOT EXISTS dokumen_juknis (
    id SERIAL PRIMARY KEY,
    judul VARCHAR(500) NOT NULL,
    deskripsi TEXT,
    pdf_url TEXT NOT NULL,
    sumber VARCHAR(200) DEFAULT 'BGN Pusat',
    kategori VARCHAR(100) DEFAULT 'Petunjuk Teknis',
    tanggal_terbit DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
");

echo "Table ready. Inserting juknis documents..." . PHP_EOL;

$documents = [
    [
        'judul' => 'Pedoman Teknis Tata Kelola Program Makan Bergizi Gratis di Wilayah Terpencil',
        'deskripsi' => 'Pedoman teknis untuk pelaksanaan program MBG di wilayah terpencil Indonesia, mencakup mekanisme distribusi, logistik pangan, dan adaptasi kondisi geografis khusus.',
        'pdf_url' => 'https://cdn-web.bgn.go.id/juknis/01KGCYQMYQYJZCPWC5AC9PFHRX.pdf',
        'kategori' => 'Pedoman Teknis',
    ],
    [
        'judul' => 'Petunjuk Teknis Tata Kelola Penyelenggaraan Program Makan Bergizi Gratis',
        'deskripsi' => 'Panduan komprehensif tata kelola penyelenggaraan program MBG secara nasional, meliputi perencanaan, pelaksanaan, monitoring dan evaluasi program.',
        'pdf_url' => 'https://cdn-web.bgn.go.id/juknis/01KFZQGR85YKY1HRMNDK4RRM1P.pdf',
        'kategori' => 'Petunjuk Teknis',
    ],
    [
        'judul' => 'Pedoman Umum Sistem dan Tata Kelola Badan Gizi Nasional Untuk Program Makan Bergizi Gratis',
        'deskripsi' => 'Pedoman umum sistem dan tata kelola BGN yang menjadi acuan utama dalam penyelenggaraan program MBG di seluruh Indonesia.',
        'pdf_url' => 'https://cdn-web.bgn.go.id/juknis/01KA7N19KSJ5GPG927034K3RP0.pdf',
        'kategori' => 'Pedoman Umum',
    ],
    [
        'judul' => 'Pedoman Sertifikasi Keamanan Pangan Pada Satuan Pelayanan Pemenuhan Gizi',
        'deskripsi' => 'Standar dan prosedur sertifikasi keamanan pangan yang wajib dipenuhi oleh seluruh SPPG dalam program MBG.',
        'pdf_url' => 'https://cdn-web.bgn.go.id/juknis/01KA7MRKDF4HY0J5H008X5Z201.pdf',
        'kategori' => 'Sertifikasi & Standar',
    ],
    [
        'judul' => 'Pedoman Tata Kelola Penyelenggaraan Program Makan Bergizi Gratis Selama Libur Sekolah',
        'deskripsi' => 'Keputusan tentang Pedoman Tata Kelola Penyelenggaraan Program MBG Selama Libur Sekolah — acuan bagi SPPG di seluruh Indonesia dalam mendistribusikan paket MBG selama libur sekolah untuk mendukung asupan gizi seimbang penerima manfaat.',
        'pdf_url' => 'https://cdn-web.bgn.go.id/juknis/01K9SBCDXA1PT6C7MHHVXKQVWT.pdf',
        'kategori' => 'Pedoman Teknis',
    ],
    [
        'judul' => 'Pedoman Teknis Distribusi Makanan dan Edukasi Gizi pada Program MBG Bagi Ibu Hamil, Ibu Menyusui, dan Anak Balita Non-PAUD',
        'deskripsi' => 'Program MBG bagi Ibu Hamil, Ibu Menyusui, dan Anak Balita Non-PAUD — komitmen nasional dalam percepatan penurunan stunting serta perbaikan status gizi masyarakat melalui kolaborasi BGN, BKKBN, Kemenkes, dan pemangku kepentingan komunitas.',
        'pdf_url' => 'https://cdn-web.bgn.go.id/juknis/01K9SB3PR4KZMCVR9GY83NHP2C.pdf',
        'kategori' => 'Pedoman Teknis',
    ],
    [
        'judul' => 'Petunjuk Teknis Pembuatan Rekening SPPG dan Penggunaan Dana Makan Bergizi Gratis',
        'deskripsi' => 'Panduan teknis tata kelola penggunaan dana program MBG secara sistematis — memastikan penggunaan dana serta pelaporan keuangan yang efektif, transparan, dan akuntabel bagi seluruh SPPG.',
        'pdf_url' => 'https://cdn-web.bgn.go.id/juknis/01K9SAS4H4053JG9FHRGSPC06S.pdf',
        'kategori' => 'Keuangan & Akuntabilitas',
    ],
    [
        'judul' => 'Petunjuk Teknis Standar, Penyediaan dan Distribusi Susu Pada Program MBG',
        'deskripsi' => 'Keputusan Deputi Bidang Sistem dan Tata Kelola tentang standar, penyediaan dan distribusi susu pada program MBG, disusun oleh Kedeputian Sistem dan Tata Kelola Badan Gizi Nasional.',
        'pdf_url' => 'https://cdn-web.bgn.go.id/juknis/01K9RJQJM8EKHEH5AT8XEVMK6Y.pdf',
        'kategori' => 'Standar Distribusi',
    ],
];

$stmt = $pdo->prepare("
    INSERT INTO dokumen_juknis (judul, deskripsi, pdf_url, sumber, kategori, tanggal_terbit)
    VALUES (:judul, :deskripsi, :pdf_url, 'Badan Gizi Nasional (BGN)', :kategori, '2026-09-05')
    ON CONFLICT DO NOTHING
");

$count = 0;
foreach ($documents as $doc) {
    // Check if already exists by pdf_url
    $exists = $pdo->prepare("SELECT COUNT(*) FROM dokumen_juknis WHERE pdf_url = ?");
    $exists->execute([$doc['pdf_url']]);
    if ((int)$exists->fetchColumn() === 0) {
        $stmt->execute([
            ':judul' => $doc['judul'],
            ':deskripsi' => $doc['deskripsi'],
            ':pdf_url' => $doc['pdf_url'],
            ':kategori' => $doc['kategori'],
        ]);
        $count++;
    }
}

echo "Inserted $count juknis documents into database." . PHP_EOL;

// Verify
$total = $pdo->query("SELECT COUNT(*) FROM dokumen_juknis")->fetchColumn();
echo "Total dokumen juknis in database: $total" . PHP_EOL;
