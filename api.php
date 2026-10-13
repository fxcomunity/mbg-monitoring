<?php
// api.php – Endpoint JSON Telemetri & Data Terpadu Radar MBG - Badan Gizi Nasional
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');

$database = [
    [
        'id' => 'SCH-001',
        'school' => 'SDN 01 Senayan',
        'city' => 'Jakarta Selatan',
        'region' => 'DKI Jakarta',
        'level' => 'sd',
        'date' => '2026-10-13',
        'time' => '10:30 WIB',
        'menu' => 'Ayam Panggang Madu & Tempe Bacem',
        'description' => 'Ayam panggang madu bumbu kuning, tempe bacem kukus gurih, nasi fortifikasi, tumis sayur pelangi wortel-jagung, pisang barangan, dan susu segar pasteurisasi.',
        'calories' => '620 kkal',
        'temperature' => '67.4°C',
        'photo' => 'https://lh3.googleusercontent.com/aida-public/AB6AXuAwR5CVQiGD-H1fLUUponcAoEgYaN5aHuUlkSYx7VYibymErkMuxd4kpHCINI0yNwww28_Q20uaOh0k6QpFqdvgze341zsESFy56Wh7KKDq13nMkXC2fmc3f0kDvQKaCVaayI2ON_fnRnWIfuUo0Uq4TrCGbz9CKsnotxUVJNd0XPHiaWRAXyHcoK--j04X6sgwHcdFptTmLPtO5jB9ICGczB-XGXe7_7N-42Vddd89h3t6MQo4pX3P',
        'nutrition' => [
            'energi' => '620 kkal',
            'protein' => '24.5 g',
            'karbo' => '78 g',
            'lemak' => '16 g',
            'serat' => '4.2 g',
            'kalsium' => '320 mg',
            'zat_besi' => '4.2 mg'
        ],
        'sppg' => [
            'name' => 'Dapur Sentral Kebayoran Baru 03',
            'address' => 'Jl. Kyai Maja No. 14, Kebayoran Baru, Jakarta Selatan',
            'contact' => '021-7245890',
            'radius' => '3.2 km',
            'slhs' => 'Tersertifikasi SLHS Kemenkes Grade A',
            'dietitian' => 'dr. Andini Saraswati, Sp.GK'
        ],
        'sla' => '99.9% Tepat Waktu',
        'status' => 'complete'
    ],
    [
        'id' => 'SCH-002',
        'school' => 'SDN 01 Menteng Jakarta',
        'city' => 'Jakarta Pusat',
        'region' => 'DKI Jakarta',
        'level' => 'sd',
        'date' => '2026-10-13',
        'time' => '10:15 WIB',
        'menu' => 'Ayam Panggang Kunyit & Sayur Bening Jagung Manis',
        'description' => 'Ayam panggang rempah nusantara rendah garam, tahu sutra organik kukus, nasi pulen lokal, sayur labu manis, dan jeruk nipis madu.',
        'calories' => '580 kkal',
        'temperature' => '68.2°C',
        'photo' => 'https://lh3.googleusercontent.com/aida-public/AB6AXuAwR5CVQiGD-H1fLUUponcAoEgYaN5aHuUlkSYx7VYibymErkMuxd4kpHCINI0yNwww28_Q20uaOh0k6QpFqdvgze341zsESFy56Wh7KKDq13nMkXC2fmc3f0kDvQKaCVaayI2ON_fnRnWIfuUo0Uq4TrCGbz9CKsnotxUVJNd0XPHiaWRAXyHcoK--j04X6sgwHcdFptTmLPtO5jB9ICGczB-XGXe7_7N-42Vddd89h3t6MQo4pX3P',
        'nutrition' => [
            'energi' => '580 kkal',
            'protein' => '22.0 g',
            'karbo' => '72 g',
            'lemak' => '14 g',
            'serat' => '3.8 g',
            'kalsium' => '300 mg',
            'zat_besi' => '3.9 mg'
        ],
        'sppg' => [
            'name' => 'SPPG Menteng 01',
            'address' => 'Jl. Teuku Umar No. 8, Jakarta Pusat',
            'contact' => '021-3901122',
            'radius' => '2.4 km',
            'slhs' => 'Tersertifikasi SLHS Kemenkes Grade A',
            'dietitian' => 'dr. Rian Satria, Sp.GK'
        ],
        'sla' => '100% Tepat Waktu',
        'status' => 'complete'
    ],
    [
        'id' => 'SCH-003',
        'school' => 'SMPN 19 Kebayoran Baru',
        'city' => 'Jakarta Selatan',
        'region' => 'DKI Jakarta',
        'level' => 'smp',
        'date' => '2026-10-13',
        'time' => '10:55 WIB',
        'menu' => 'Rolade Ikan Tuna Saus Tomat Segar & Capcay Telur Puyuh',
        'description' => 'Ikan tuna laut segar kaya omega-3, capcay sayur segar panen lokal, tahu tempe bacem, nasi pulen, dan susu murni Boyolali.',
        'calories' => '710 kkal',
        'temperature' => '69.5°C',
        'photo' => 'https://lh3.googleusercontent.com/aida-public/AB6AXuCkLbSHziTgMS4wjfXnmGJaa87bd_N3KasCcc2H4qhnJv0-x1bXQDvleyxCuK58099ZoZfRbhBN8WpUfixGsZsefv_a7MSmNJ3smRd3oXRskR5Vg7Nxz16LFyr9C-wrk8QimhpK8Y0YYqWL4eT4Hl9kHVFimf3FAjdcJfglmxj3dWfqWiVQN0QL-uaA1bRCAWeW3sSvk0sUJAEDLbARjtbg1VzCHnlLwoPl9Ghqvw8_OF7pN35D3hpA',
        'nutrition' => [
            'energi' => '710 kkal',
            'protein' => '28.0 g',
            'karbo' => '95 g',
            'lemak' => '18 g',
            'serat' => '5.0 g',
            'kalsium' => '380 mg',
            'zat_besi' => '8.5 mg'
        ],
        'sppg' => [
            'name' => 'SPPG Kebayoran Baru 02',
            'address' => 'Jl. Bumi No. 21, Kebayoran Baru, Jakarta Selatan',
            'contact' => '021-7201919',
            'radius' => '2.1 km',
            'slhs' => 'Tersertifikasi SLHS Kemenkes Grade A',
            'dietitian' => 'Nurul Hidayati, S.Gz'
        ],
        'sla' => '99.8% Tepat Waktu',
        'status' => 'complete'
    ],
    [
        'id' => 'SCH-004',
        'school' => 'SMPN 3 Surabaya',
        'city' => 'Surabaya',
        'region' => 'Jawa Timur',
        'level' => 'smp',
        'date' => '2026-10-13',
        'time' => '10:45 WIB',
        'menu' => 'Soto Ayam Lamongan Kuah Bening & Perkedel Tahu',
        'description' => 'Soto ayam bumbu alami tanpa MSG buatan, tauge segar, telur rebus utuh omega, nasi putih, dan semangka merah potong.',
        'calories' => '690 kkal',
        'temperature' => '71.2°C',
        'photo' => 'https://lh3.googleusercontent.com/aida-public/AB6AXuAwR5CVQiGD-H1fLUUponcAoEgYaN5aHuUlkSYx7VYibymErkMuxd4kpHCINI0yNwww28_Q20uaOh0k6QpFqdvgze341zsESFy56Wh7KKDq13nMkXC2fmc3f0kDvQKaCVaayI2ON_fnRnWIfuUo0Uq4TrCGbz9CKsnotxUVJNd0XPHiaWRAXyHcoK--j04X6sgwHcdFptTmLPtO5jB9ICGczB-XGXe7_7N-42Vddd89h3t6MQo4pX3P',
        'nutrition' => [
            'energi' => '690 kkal',
            'protein' => '27.2 g',
            'karbo' => '90 g',
            'lemak' => '17 g',
            'serat' => '4.5 g',
            'kalsium' => '340 mg',
            'zat_besi' => '7.8 mg'
        ],
        'sppg' => [
            'name' => 'SPPG Surabaya Rungkut',
            'address' => 'Kawasan Industri SIER No. 12, Surabaya',
            'contact' => '031-8432100',
            'radius' => '4.1 km',
            'slhs' => 'Tersertifikasi SLHS Kemenkes Grade A',
            'dietitian' => 'Bambang Trianto, S.Gz, RD'
        ],
        'sla' => '99.7% Tepat Waktu',
        'status' => 'complete'
    ],
    [
        'id' => 'SCH-005',
        'school' => 'SDN Sukajadi 03 Bandung',
        'city' => 'Bandung',
        'region' => 'Jawa Barat',
        'level' => 'sd',
        'date' => '2026-10-13',
        'time' => '10:20 WIB',
        'menu' => 'Semur Ayam Kampung & Oreg Tempe Daun Bawang',
        'description' => 'Semur ayam kampung empuk kecap kelapa, oreg tempe manis gurih, sayur sop buncis wortel Lembang, pepaya potong, dan susu UHT.',
        'calories' => '610 kkal',
        'temperature' => '67.8°C',
        'photo' => 'https://lh3.googleusercontent.com/aida-public/AB6AXuCkLbSHziTgMS4wjfXnmGJaa87bd_N3KasCcc2H4qhnJv0-x1bXQDvleyxCuK58099ZoZfRbhBN8WpUfixGsZsefv_a7MSmNJ3smRd3oXRskR5Vg7Nxz16LFyr9C-wrk8QimhpK8Y0YYqWL4eT4Hl9kHVFimf3FAjdcJfglmxj3dWfqWiVQN0QL-uaA1bRCAWeW3sSvk0sUJAEDLbARjtbg1VzCHnlLwoPl9Ghqvw8_OF7pN35D3hpA',
        'nutrition' => [
            'energi' => '610 kkal',
            'protein' => '23.8 g',
            'karbo' => '76 g',
            'lemak' => '15 g',
            'serat' => '4.0 g',
            'kalsium' => '310 mg',
            'zat_besi' => '4.1 mg'
        ],
        'sppg' => [
            'name' => 'SPPG Sukajadi Bandung',
            'address' => 'Jl. Sukajadi No. 188, Bandung',
            'contact' => '022-2031122',
            'radius' => '3.0 km',
            'slhs' => 'Tersertifikasi SLHS Kemenkes Grade A',
            'dietitian' => 'dr. Fitriani Lestari, M.Gizi'
        ],
        'sla' => '99.5% Tepat Waktu',
        'status' => 'complete'
    ],
    [
        'id' => 'SCH-006',
        'school' => 'SMPN 1 Semarang',
        'city' => 'Semarang',
        'region' => 'Jawa Tengah',
        'level' => 'smp',
        'date' => '2026-10-13',
        'time' => '10:40 WIB',
        'menu' => 'Ikan Bandeng Cabut Duri Bakar Madu & Oseng Buncis',
        'description' => 'Bandeng tanpa duri bumbu bakar madu lokal, tahu bacem, oseng buncis manis, nasi putih, dan pisang ambon.',
        'calories' => '720 kkal',
        'temperature' => '68.5°C',
        'photo' => 'https://lh3.googleusercontent.com/aida-public/AB6AXuAwR5CVQiGD-H1fLUUponcAoEgYaN5aHuUlkSYx7VYibymErkMuxd4kpHCINI0yNwww28_Q20uaOh0k6QpFqdvgze341zsESFy56Wh7KKDq13nMkXC2fmc3f0kDvQKaCVaayI2ON_fnRnWIfuUo0Uq4TrCGbz9CKsnotxUVJNd0XPHiaWRAXyHcoK--j04X6sgwHcdFptTmLPtO5jB9ICGczB-XGXe7_7N-42Vddd89h3t6MQo4pX3P',
        'nutrition' => [
            'energi' => '720 kkal',
            'protein' => '29.0 g',
            'karbo' => '96 g',
            'lemak' => '17.5 g',
            'serat' => '4.8 g',
            'kalsium' => '420 mg',
            'zat_besi' => '8.0 mg'
        ],
        'sppg' => [
            'name' => 'SPPG Semarang Tengah',
            'address' => 'Jl. Pemuda No. 70, Semarang',
            'contact' => '024-3512345',
            'radius' => '2.8 km',
            'slhs' => 'Tersertifikasi SLHS Kemenkes Grade A',
            'dietitian' => 'dr. Agus Wijaya, Sp.GK'
        ],
        'sla' => '99.8% Tepat Waktu',
        'status' => 'complete'
    ],
    [
        'id' => 'SCH-007',
        'school' => 'SMAN 70 Jakarta',
        'city' => 'Jakarta Selatan',
        'region' => 'DKI Jakarta',
        'level' => 'sma',
        'date' => '2026-10-13',
        'time' => '11:10 WIB',
        'menu' => 'Ayam Suwir Rica Manis & Telur Puyuh Jamur Kuping',
        'description' => 'Ayam suwir kaya protein tanpa kulit, telur puyuh omega, jamur kuping tinggi serat, nasi pulen fortifikasi, dan buah melon potong.',
        'calories' => '760 kkal',
        'temperature' => '69.0°C',
        'photo' => 'https://lh3.googleusercontent.com/aida-public/AB6AXuCkLbSHziTgMS4wjfXnmGJaa87bd_N3KasCcc2H4qhnJv0-x1bXQDvleyxCuK58099ZoZfRbhBN8WpUfixGsZsefv_a7MSmNJ3smRd3oXRskR5Vg7Nxz16LFyr9C-wrk8QimhpK8Y0YYqWL4eT4Hl9kHVFimf3FAjdcJfglmxj3dWfqWiVQN0QL-uaA1bRCAWeW3sSvk0sUJAEDLbARjtbg1VzCHnlLwoPl9Ghqvw8_OF7pN35D3hpA',
        'nutrition' => [
            'energi' => '760 kkal',
            'protein' => '30.5 g',
            'karbo' => '105 g',
            'lemak' => '19 g',
            'serat' => '5.2 g',
            'kalsium' => '390 mg',
            'zat_besi' => '9.5 mg'
        ],
        'sppg' => [
            'name' => 'Dapur Sentral Kebayoran Baru 03',
            'address' => 'Jl. Kyai Maja No. 14, Jakarta Selatan',
            'contact' => '021-7245890',
            'radius' => '1.5 km',
            'slhs' => 'Tersertifikasi SLHS Kemenkes Grade A',
            'dietitian' => 'dr. Andini Saraswati, Sp.GK'
        ],
        'sla' => '100% Tepat Waktu',
        'status' => 'complete'
    ]
];

// Query filtering
$query = trim($_GET['school'] ?? $_GET['q'] ?? '');
$filterRegion = trim($_GET['region'] ?? '');
$filterLevel = trim($_GET['level'] ?? '');
$filterDate = trim($_GET['date'] ?? '');

$results = array_filter($database, function($item) use ($query, $filterRegion, $filterLevel, $filterDate) {
    if ($query !== '') {
        $matchQuery = (stripos($item['school'], $query) !== false) ||
                      (stripos($item['city'], $query) !== false) ||
                      (stripos($item['region'], $query) !== false) ||
                      (stripos($item['sppg']['name'], $query) !== false) ||
                      (stripos($item['menu'], $query) !== false);
        if (!$matchQuery) return false;
    }
    if ($filterRegion !== '' && $filterRegion !== 'semua') {
        $targetRegion = strtolower(str_replace(['-', ' '], '', $filterRegion));
        $itemRegion = strtolower(str_replace(['-', ' '], '', $item['region']));
        if (strpos($itemRegion, $targetRegion) === false && strpos($targetRegion, $itemRegion) === false) {
            return false;
        }
    }
    if ($filterLevel !== '' && $filterLevel !== 'semua' && strtolower($item['level']) !== strtolower($filterLevel)) {
        return false;
    }
    if ($filterDate !== '' && $item['date'] !== $filterDate) {
        return false;
    }
    return true;
});

echo json_encode([
    'status' => 'success',
    'timestamp' => date('Y-m-d H:i:s'),
    'count' => count($results),
    'data' => array_values($results)
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
?>
