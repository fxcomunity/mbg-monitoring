<?php
// generate_og_image.php
$w = 1200;
$h = 630;

$im = imagecreatetruecolor($w, $h);
imagealphablending($im, true);
imagesavealpha($im, true);

// Colors
$bgDark      = imagecolorallocate($im, 0, 16, 38);       // #001026
$bgCard      = imagecolorallocate($im, 11, 37, 69);      // #0b2545
$bgCardSub   = imagecolorallocate($im, 17, 49, 89);      // #113159
$cWhite      = imagecolorallocate($im, 255, 255, 255);
$cGold       = imagecolorallocate($im, 245, 158, 11);    // #f59e0b
$cEmerald    = imagecolorallocate($im, 16, 185, 129);    // #10b981
$cBlueLight  = imagecolorallocate($im, 147, 197, 253);   // #93c5fd
$cSlate      = imagecolorallocate($im, 203, 213, 225);   // #cbd5e1
$cBorder     = imagecolorallocate($im, 30, 58, 138);     // #1e3a8a
$cRed        = imagecolorallocate($im, 220, 38, 38);     // #dc2626

// Fill background
imagefilledrectangle($im, 0, 0, $w, $h, $bgDark);

// Subtle decorative top accent bar (Merah Putih BGN)
imagefilledrectangle($im, 0, 0, $w, 8, $cRed);
imagefilledrectangle($im, 0, 8, $w, 14, $cWhite);

// Decorative subtle glowing circles
for ($r = 300; $r > 0; $r -= 10) {
    $alpha = (int)(127 - (127 * (1 - $r / 300) * 0.15));
    $glowCol = imagecolorallocatealpha($im, 59, 130, 246, max(0, min(127, $alpha)));
    imagefilledellipse($im, 1100, 120, $r * 2, $r * 2, $glowCol);
}
for ($r = 250; $r > 0; $r -= 10) {
    $alpha = (int)(127 - (127 * (1 - $r / 250) * 0.12));
    $glowCol2 = imagecolorallocatealpha($im, 16, 185, 129, max(0, min(127, $alpha)));
    imagefilledellipse($im, 100, 550, $r * 2, $r * 2, $glowCol2);
}

// Fonts
$fontBold = 'C:\\Windows\\Fonts\\segoeuib.ttf';
$fontSemi = 'C:\\Windows\\Fonts\\segoeui.ttf';
if (!file_exists($fontBold)) {
    $fontBold = 'C:\\Windows\\Fonts\\arialbd.ttf';
    $fontSemi = 'C:\\Windows\\Fonts\\arial.ttf';
}

// Inner rounded card container
$cardMarginX = 40;
$cardMarginY = 40;
imagefilledrectangle($im, $cardMarginX, $cardMarginY, $w - $cardMarginX, $h - $cardMarginY, $bgCard);
imagerectangle($im, $cardMarginX, $cardMarginY, $w - $cardMarginX, $h - $cardMarginY, $cBorder);

// Header badge pill
$pillX = 80;
$pillY = 75;
$pillW = 490;
$pillH = 40;
imagefilledrectangle($im, $pillX, $pillY, $pillX + $pillW, $pillY + $pillH, $bgCardSub);
imagerectangle($im, $pillX, $pillY, $pillX + $pillW, $pillY + $pillH, $cBorder);
// Dot
imagefilledellipse($im, $pillX + 22, $pillY + 20, 12, 12, $cEmerald);
imagettftext($im, 14, 0, $pillX + 40, $pillY + 26, $cEmerald, $fontBold, "BADAN GIZI NASIONAL • REPUBLIK INDONESIA");

// Load & Place Logo
$logoFile = __DIR__ . '/assets/images/logo.webp';
if (file_exists($logoFile)) {
    $logo = @imagecreatefromwebp($logoFile);
    if ($logo) {
        $lw = imagesx($logo);
        $lh = imagesy($logo);
        $targetSize = 150;
        imagecopyresampled($im, $logo, 960, 80, 0, 0, $targetSize, $targetSize, $lw, $lh);
        imagedestroy($logo);
    }
}

// Main Title
imagettftext($im, 42, 0, 80, 195, $cWhite, $fontBold, "RADAR MBG NASIONAL");

// Subtitle
imagettftext($im, 20, 0, 80, 245, $cGold, $fontBold, "Pusat Monitoring & Transparansi Makan Bergizi Gratis");

// Description
imagettftext($im, 15, 0, 80, 290, $cBlueLight, $fontSemi, "Pemantauan Realtime Satuan Pelayanan Pemenuhan Gizi (SPPG),");
imagettftext($im, 15, 0, 80, 320, $cSlate, $fontSemi, "Kesesuaian AKG Nutrisi Siswa, Distribusi Logistik, & Pengaduan Publik.");

// 4 Stats Metrics Cards
$metrics = [
    ['val' => '4.850.210', 'label' => 'Porsi Tersalurkan', 'color' => $cWhite],
    ['val' => '1.284',     'label' => 'Dapur SPPG Aktif',  'color' => $cEmerald],
    ['val' => '18.420',    'label' => 'Sekolah Terlayani', 'color' => $cBlueLight],
    ['val' => '99.6%',     'label' => 'Kepatuhan AKG',     'color' => $cGold],
];

$startX = 80;
$startY = 365;
$cardW  = 240;
$cardH  = 95;
$gap    = 25;

foreach ($metrics as $i => $m) {
    $cx = $startX + ($i * ($cardW + $gap));
    imagefilledrectangle($im, $cx, $startY, $cx + $cardW, $startY + $cardH, $bgCardSub);
    imagerectangle($im, $cx, $startY, $cx + $cardW, $startY + $cardH, $cBorder);
    
    // Top border colored stripe
    imagefilledrectangle($im, $cx, $startY, $cx + $cardW, $startY + 4, $m['color']);
    
    imagettftext($im, 22, 0, $cx + 16, $startY + 45, $m['color'], $fontBold, $m['val']);
    imagettftext($im, 12, 0, $cx + 16, $startY + 75, $cSlate, $fontSemi, $m['label']);
}

// Footer Line inside card
$footY = 530;
imageline($im, 80, $footY, 1120, $footY, $cBorder);

// Footer info
imagettftext($im, 13, 0, 80, 565, $cWhite, $fontBold, "Portal Resmi:");
imagettftext($im, 13, 0, 190, 565, $cGold, $fontBold, "https://mbg.jack-ai.my.id");

imagettftext($im, 12, 0, 760, 565, $cSlate, $fontSemi, "Sistem Pantau 24/7 • Hotline Bebas Pulsa: 150-098");

// Save PNG and JPG
$outPng = __DIR__ . '/assets/images/og-preview.png';
$outJpg = __DIR__ . '/assets/images/og-preview.jpg';

imagepng($im, $outPng, 8);
imagejpeg($im, $outJpg, 90);
imagedestroy($im);

echo "Generated: " . $outPng . " (" . filesize($outPng) . " bytes)\n";
echo "Generated: " . $outJpg . " (" . filesize($outJpg) . " bytes)\n";
