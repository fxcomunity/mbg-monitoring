<?php
require_once __DIR__ . '/../db.php';

try {
    $pdo = getDB();
    echo "Connected to DB\n";

    // 1. provinsi
    $pdo->exec("
    CREATE TABLE IF NOT EXISTS provinsi (
        kode_prov_dagri VARCHAR(10) PRIMARY KEY,
        kode_prov_dikdasmen VARCHAR(10),
        nama_provinsi VARCHAR(100) NOT NULL,
        zona_waktu VARCHAR(10),
        iana_timezone VARCHAR(100),
        tanggal_update TIMESTAMP
    );");

    $pdo->exec("
    INSERT INTO provinsi (
        kode_prov_dagri, kode_prov_dikdasmen, nama_provinsi, zona_waktu, iana_timezone, tanggal_update
    ) VALUES (
        '51', '22', 'BALI', 'WITA', 'Asia/Makassar', '2026-07-10 21:41:55'
    ) ON CONFLICT (kode_prov_dagri) DO UPDATE SET
        nama_provinsi = EXCLUDED.nama_provinsi,
        zona_waktu = EXCLUDED.zona_waktu,
        iana_timezone = EXCLUDED.iana_timezone;
    ");

    // 2. kabupaten_kota
    $pdo->exec("
    CREATE TABLE IF NOT EXISTS kabupaten_kota (
        kode_kabko_dagri VARCHAR(10) PRIMARY KEY,
        kode_kabko_dikdasmen VARCHAR(10),
        kode_prov_dagri VARCHAR(10) NOT NULL REFERENCES provinsi(kode_prov_dagri),
        nama_kabko VARCHAR(100) NOT NULL
    );");

    // Insert Bali kabupaten/kota
    $kabkos = [
        ['51.03', '2204', '51', 'BADUNG'],
        ['51.06', '2207', '51', 'BANGLI'],
        ['51.08', '2201', '51', 'BULELENG'],
        ['51.04', '2205', '51', 'GIANYAR'],
        ['51.01', '2202', '51', 'JEMBRANA'],
        ['51.07', '2208', '51', 'KARANGASEM'],
        ['51.05', '2206', '51', 'KLUNGKUNG'],
        ['51.71', '2260', '51', 'KOTA DENPASAR'],
        ['51.02', '2203', '51', 'TABANAN'],
    ];

    $stmtKab = $pdo->prepare("
        INSERT INTO kabupaten_kota (kode_kabko_dagri, kode_kabko_dikdasmen, kode_prov_dagri, nama_kabko)
        VALUES (?, ?, ?, ?)
        ON CONFLICT (kode_kabko_dagri) DO UPDATE SET
            kode_kabko_dikdasmen = EXCLUDED.kode_kabko_dikdasmen,
            kode_prov_dagri = EXCLUDED.kode_prov_dagri,
            nama_kabko = EXCLUDED.nama_kabko
    ");
    foreach ($kabkos as $k) {
        $stmtKab->execute($k);
    }

    // 3. kecamatan
    $pdo->exec("
    CREATE TABLE IF NOT EXISTS kecamatan (
        kode_kec_dagri VARCHAR(20) PRIMARY KEY,
        kode_kabko_dagri VARCHAR(10) NOT NULL REFERENCES kabupaten_kota(kode_kabko_dagri),
        nama_kecamatan VARCHAR(100)
    );");

    $pdo->exec("
    INSERT INTO kecamatan (kode_kec_dagri, kode_kabko_dagri, nama_kecamatan)
    VALUES ('51.06.04', '51.06', 'Kintamani')
    ON CONFLICT (kode_kec_dagri) DO UPDATE SET
        kode_kabko_dagri = EXCLUDED.kode_kabko_dagri,
        nama_kecamatan = EXCLUDED.nama_kecamatan;
    ");

    // 4. sppg
    $pdo->exec("
    CREATE TABLE IF NOT EXISTS sppg (
        id_sppg VARCHAR(30) PRIMARY KEY,
        kode_sppg VARCHAR(50),
        nama_sppg VARCHAR(200) NOT NULL,
        alamat TEXT
    );");

    $pdo->exec("
    INSERT INTO sppg (id_sppg, kode_sppg, nama_sppg, alamat)
    VALUES ('C54XQES5', '51.06.02.2009.01', 'SPPG BANGLI BANGLI LANDIH', 'JLN. RAYA PENAGA LANDIH')
    ON CONFLICT (id_sppg) DO UPDATE SET
        kode_sppg = EXCLUDED.kode_sppg,
        nama_sppg = EXCLUDED.nama_sppg,
        alamat = EXCLUDED.alamat;
    ");

    // 5. instansi
    $pdo->exec("
    CREATE TABLE IF NOT EXISTS instansi (
        id_instansi VARCHAR(30) PRIMARY KEY,
        nama_instansi VARCHAR(200) NOT NULL,
        kode_prov_dagri VARCHAR(10) REFERENCES provinsi(kode_prov_dagri),
        kode_kabko_dagri VARCHAR(10) REFERENCES kabupaten_kota(kode_kabko_dagri),
        kode_kec_dagri VARCHAR(20) REFERENCES kecamatan(kode_kec_dagri),
        kode_kel_dagri VARCHAR(30),
        id_sppg VARCHAR(30) REFERENCES sppg(id_sppg)
    );");

    $instansis = [
        ['K3390354458', 'KB MEKAR ANOM', '51', '51.06', '51.06.04', '51.06.04.2020', 'C54XQES5'],
        ['K4524164808', 'SD NEGERI ABANGSONGAN', '51', '51.06', '51.06.04', '51.06.04.2020', 'C54XQES5'],
    ];

    $stmtInst = $pdo->prepare("
        INSERT INTO instansi (id_instansi, nama_instansi, kode_prov_dagri, kode_kabko_dagri, kode_kec_dagri, kode_kel_dagri, id_sppg)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (id_instansi) DO UPDATE SET
            nama_instansi = EXCLUDED.nama_instansi,
            kode_prov_dagri = EXCLUDED.kode_prov_dagri,
            kode_kabko_dagri = EXCLUDED.kode_kabko_dagri,
            kode_kec_dagri = EXCLUDED.kode_kec_dagri,
            kode_kel_dagri = EXCLUDED.kode_kel_dagri,
            id_sppg = EXCLUDED.id_sppg;
    ");
    foreach ($instansis as $inst) {
        $stmtInst->execute($inst);
    }

    // 6. menu_harian
    $pdo->exec("
    CREATE TABLE IF NOT EXISTS menu_harian (
        id_menu VARCHAR(100) PRIMARY KEY,
        id_instansi VARCHAR(30) NOT NULL REFERENCES instansi(id_instansi),
        tanggal_menu DATE NOT NULL,
        nama_menu TEXT NOT NULL,
        porsi VARCHAR(10) NOT NULL CHECK (porsi IN ('large', 'small')),
        komposisi TEXT,
        UNIQUE (id_instansi, tanggal_menu, porsi)
    );");

    $menus = [
        ['f05909e3-d868-439e-8b41-3145b35a94e6-large', 'K3390354458', '2026-10-14', 'Nasi putih + ayam goreng sambal embe + tempe ongseng + tumis kacang panjang sawi putih + semangka, pepaya', 'large', 'Nasi putih; ayam goreng sambal embe; tempe ongseng; tumis kacang panjang sawi putih; semangka; pepaya'],
        ['f05909e3-d868-439e-8b41-3145b35a94e6-small', 'K3390354458', '2026-10-14', 'Nasi putih + ayam goreng sambal embe + tempe ongseng + tumis kacang panjang sawi putih + semangka, pepaya', 'small', 'Nasi putih; ayam goreng sambal embe; tempe ongseng; tumis kacang panjang sawi putih; semangka; pepaya'],
        ['a61cba91-447f-4c5e-b10e-22acef7fa7c7-large', 'K4524164808', '2026-10-14', 'Nasi putih + ayam goreng sambal embe + tempe ongseng + tumis kacang panjang sawi putih + semangka, pepaya', 'large', 'Nasi putih; ayam goreng sambal embe; tempe ongseng; tumis kacang panjang sawi putih; semangka; pepaya'],
        ['a61cba91-447f-4c5e-b10e-22acef7fa7c7-small', 'K4524164808', '2026-10-14', 'Nasi putih + ayam goreng sambal embe + tempe ongseng + tumis kacang panjang sawi putih + semangka, pepaya', 'small', 'Nasi putih; ayam goreng sambal embe; tempe ongseng; tumis kacang panjang sawi putih; semangka; pepaya'],
    ];

    $stmtMenu = $pdo->prepare("
        INSERT INTO menu_harian (id_menu, id_instansi, tanggal_menu, nama_menu, porsi, komposisi)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (id_menu) DO UPDATE SET
            id_instansi = EXCLUDED.id_instansi,
            tanggal_menu = EXCLUDED.tanggal_menu,
            nama_menu = EXCLUDED.nama_menu,
            porsi = EXCLUDED.porsi,
            komposisi = EXCLUDED.komposisi;
    ");
    foreach ($menus as $m) {
        $stmtMenu->execute($m);
    }

    // 7. gizi_menu
    $pdo->exec("
    CREATE TABLE IF NOT EXISTS gizi_menu (
        id_menu VARCHAR(100) PRIMARY KEY REFERENCES menu_harian(id_menu) ON DELETE CASCADE,
        energi_kkal NUMERIC(10,2),
        protein_g NUMERIC(10,2),
        lemak_g NUMERIC(10,2),
        karbohidrat_g NUMERIC(10,2),
        serat_g NUMERIC(10,2)
    );");

    $gizis = [
        ['f05909e3-d868-439e-8b41-3145b35a94e6-large', 629.38, 26.15, 24.65, 76.85, 3.15],
        ['f05909e3-d868-439e-8b41-3145b35a94e6-small', 466.59, 19.38, 19.66, 54.22, 2.49],
        ['a61cba91-447f-4c5e-b10e-22acef7fa7c7-large', 629.38, 26.15, 24.65, 76.85, 3.15],
        ['a61cba91-447f-4c5e-b10e-22acef7fa7c7-small', 466.59, 19.38, 19.66, 54.22, 2.49],
    ];

    $stmtGizi = $pdo->prepare("
        INSERT INTO gizi_menu (id_menu, energi_kkal, protein_g, lemak_g, karbohidrat_g, serat_g)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (id_menu) DO UPDATE SET
            energi_kkal = EXCLUDED.energi_kkal,
            protein_g = EXCLUDED.protein_g,
            lemak_g = EXCLUDED.lemak_g,
            karbohidrat_g = EXCLUDED.karbohidrat_g,
            serat_g = EXCLUDED.serat_g;
    ");
    foreach ($gizis as $g) {
        $stmtGizi->execute($g);
    }

    // 8. gambar_menu
    $pdo->exec("
    CREATE TABLE IF NOT EXISTS gambar_menu (
        id_gambar BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        id_menu VARCHAR(100) NOT NULL REFERENCES menu_harian(id_menu) ON DELETE CASCADE,
        jenis_gambar VARCHAR(50) NOT NULL,
        gambar_url TEXT,
        url_berlabel TEXT,
        UNIQUE (id_menu, jenis_gambar)
    );");

    echo "Migration completed successfully!\n";
} catch (Exception $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
}
