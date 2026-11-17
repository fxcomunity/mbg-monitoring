<?php
/**
 * Catatan hardening PHP lokal (bukan konfigurasi Worker/Cloudflare).
 *
 * Jalankan setelah terminal/PHP tersedia:
 *   php -l database/security.php
 *   php -l database/api_bootstrap.php
 *   php -l database/auth.php
 *   php tests/security_test.php
 * Lint juga api/*.php dan tests/*.php dengan php -l per file.
 * Butuh PHP 8+ dan proc_open untuk suite; aplikasi memakai pdo_pgsql/mbstring.
 * Tes otomatis tidak membuka koneksi DB/network. Cache raw body diinjeksi
 * melalui Reflection dan persistence log disupresi pada kasus serangan.
 * Karena itu, PASS tes ini BUKAN bukti headers HTTP, pembacaan stream nyata,
 * INSERT PostgreSQL, atau role aktif/non-admin telah lolos integrasi.
 *
 * Kontrak:
 * - Semua 18 api/*.php memuat api_bootstrap.php sebelum proses endpoint,
 *   baik akses langsung maupun melalui index.php. Inspeksi blocking idempoten.
 * - application/json dan application/*+json dibaca maksimal 1 MiB + 1 byte,
 *   ditolak 413 jika lebih besar. JSON rusak/scalar/terlalu dalam ditolak 400.
 *   JSON object/array kosong valid. Maksimal depth decoder 32, total 1024 field,
 *   total key+scalar 1 MiB, dan 64 KiB per key/nilai. Pelanggaran leaf dianggap
 *   INPUT_LIMIT (403); field/depth/total budget ditolak 413.
 * - JSON diinspeksi per key/leaf secara rekursif tanpa mengubah data. jsonBody()
 *   selalu memeriksa decoded body sebelum mengembalikannya, termasuk bila
 *   Content-Type salah/hilang; tidak memanggil inspectRequest() secara rekursif.
 *   Decoder, inspeksi JSON, dan inspeksi GET/POST memakai cache/flag terpisah.
 *   Budget GET/POST + JSON tetap digabung, terlepas dari urutan pemanggilan.
 *   rawBody() hanya accessor byte terbatas, bukan jaminan inspeksi decoded data;
 *   handler JSON wajib memakai jsonBody(), bukan json_decode(rawBody()) sendiri.
 *   $_POST tidak ditimpa JSON, sehingga form/multipart tetap memakai kontraknya.
 * - Nilai key kredensial (password/current_password/new_password/confirm_password,
 *   token/secret/authorization/api_key beserta varian case/camel/hyphen) dan
 *   nilai turunannya dilewati regex pada form/page maupun JSON. Semua key tetap
 *   diperiksa, termasuk key dalam subtree secret. Budget ukuran/jumlah/depth
 *   tetap berlaku; nilai secret >64 KiB ditolak 413 tanpa log nilai mentah.
 *   Endpoint tetap wajib memvalidasi tipe dan menggunakan binding SQL; penamaan
 *   credential bukan mekanisme authorization atau jaminan input aman.
 * - Multipart binary/file tidak dipindai regex; validasi upload tetap terpisah.
 *   Cookie/header autentikasi tidak disimpan atau dipindai sebagai body input.
 *   Limit upload/form di php.ini dan web server tetap diperlukan, sebab PHP
 *   sudah memproses $_POST sebelum middleware dijalankan.
 * - IP peer hanya REMOTE_ADDR tervalidasi; XFF tidak dipercaya. Pada reverse
 *   proxy, log akan berisi IP proxy sampai ada konfigurasi trust di luar PHP.
 * - Log menggunakan placeholder PDO ?, native prepares tetap aktif di db.php.
 *   Tidak ada migrasi skema. Kolom dasar exploit_logs mengikuti schema_all.sql:
 *   id, ip_address, user_agent, exploit_type, input_field, payload_sample,
 *   requested_url, created_at. Kolom geo opsional tidak diasumsikan tersedia.
 * - Log baru: user_agent/payload/key arbitrer direduksi; hanya sumber field,
 *   tipe allowlist, peer IP, jumlah byte, dan path endpoint allowlist disimpan.
 *   Query string/fragment selalu dibuang; maksimal 5 event per request.
 *   Fallback JSON satu baris berisi metadata identik, tanpa exception mentah.
 * - Reader log admin hanya SELECT metadata; log lama juga direduksi. Respons
 *   mempertahankan ip/type/url/ts dan menambah id/field/source. source=server
 *   hanya klasifikasi field metadata PHP allowlist GET/POST/JSON/login_username;
 *   field legacy lain source=unknown. Ini BUKAN bukti asal yang terautentikasi:
 *   data lama/penulis lain bisa memakai label yang sama. Tidak mengeluarkan
 *   payload_sample/user_agent/geo. Nilai id berupa string agar BIGSERIAL utuh.
 * - Reader hanya GET; anonim 401, role lain 403, verifikasi DB gagal 503.
 *   Role/status aktif dibaca ulang dari users untuk API session terlindungi.
 *   Tabel exploit_logs hilang (42P01) menghasilkan 503 dengan petunjuk skema,
 *   bukan success/count=0 yang keliru menyiratkan tidak ada log.
 *   notifications dipakai bell publik (assets/js/script.js): ringkasan COUNT
 *   tetap publik, latest_reports=[] dan pending_sppg_logos=0 untuk non-admin.
 *   Query detail tiket/pelapor dan antrean logo hanya untuk admin terverifikasi.
 *   sppg_status tetap admin-only: satu-satunya pemanggil yang ditemukan adalah
 *   dashboard/admin/panel.html, bukan dashboard SPPG. Data fallback username/
 *   full_name tidak dibuka ke publik. Tidak ada perubahan JS/HTML.
 * - API mendapat nosniff, frame DENY, no-referrer, Permissions-Policy, CSP
 *   default-src none, dan default no-store. Endpoint data publik tetap boleh
 *   mengganti Cache-Control. API privat tidak boleh di-cache oleh reverse proxy.
 *   Header CORS wildcard+credentials pada auth_user dihapus; credentials hanya
 *   untuk ALLOWED_ORIGIN eksplisit. Tidak memakai XFF untuk keputusan apapun.
 *
 * Smoke/integration test LAN lokal dengan PostgreSQL disposable diperlukan:
 * 1. GET security_threats langsung: anonim 401, user/SPPG aktif 403, admin aktif
 *    200. Uji juga admin yang role-nya dicabut/is_active=false setelah login,
 *    dan DB tidak tersedia (fail closed). Jangan pakai kredensial produksi.
 * 2. Pastikan response application/json, nosniff, no-store, CSP tetap muncul
 *    pada sukses maupun error 400/401/403/413/500 serta akses lewat router.
 * 3. POST maintenance memakai JSON benign: pesan diterima utuh setelah inspeksi;
 *    JSON bersarang berisi <img onerror=...> / UNION/** /SELECT ditolak 403.
 *    Uji application/*+json, JSON rusak, body >1 MiB, dan form/multipart normal.
 * 4. Kirim password/token dan query string canary bersama payload serangan;
 *    periksa INSERT pada exploit_logs dan fallback (DB unavailable) tidak
 *    mengandung canary, user-agent, key arbitrer, newline, atau payload mentah.
 * 5. Seed log lama dengan HTML/secret di setiap kolom, cek reader hanya
 *    mengeluarkan metadata aman dan tidak merujuk kolom geo tambahan. Uji tabel
 *    exploit_logs hilang: admin mendapat 503 actionable, bukan success kosong.
 * 6. Kirim X-Forwarded-For palsu: IP log harus peer koneksi REMOTE_ADDR.
 * 7. Uji password SQL/HTML sah pada page login/register dan change_password:
 *    lolos WAF, tidak berubah, tidak masuk log. Key berbahaya di subtree secret
 *    atau payload pada sibling non-secret tetap ditolak. Uji jsonBody() pada
 *    Content-Type text/plain/hilang sebelum/sesudah inspectRequest().
 * 8. Notifikasi anonim/user/SPPG: sukses ringkasan agregat, latest_reports=[],
 *    pending_sppg_logos=0, tanpa query detail pribadi. Admin aktif menerima detail;
 *    role sesi admin yang dicabut tidak dapat menerima detail. Tes otomatis
 *    memeriksa wiring gate ini secara statis; proyeksi dan 42P01 belum diuji DB.
 *
 * Batasan eksplisit / pekerjaan terpisah:
 * - Regex heuristik punya false positive dan bypass. Prepared SQL, validasi
 *   domain, authorization objek, serta output encoding tetap pertahanan utama.
 *   cleanInput bukan fungsi pengaman SQL; cleanOutput hanya konteks teks HTML.
 * - Ini bukan audit seluruh autentikasi. Belum menambah CSRF token ke UI,
 *   rate limiting terpusat, kebijakan password, cookie/session deployment,
 *   ataupun mengubah logout GET. CORS/headers bukan pengganti CSRF.
 * - Kepemilikan session_id live_chat, pembatasan balasan lintas SPPG, pengiriman
 *   data chat ke OpenRouter, serta privasi lookup tiket berbasis kode masih
 *   perlu audit terpisah. Pembaruan ini hanya memperbarui role aktif chat dan
 *   memasang middleware; jangan anggap semua authorization objek sudah aman.
 * - Log lama mungkin masih menyimpan secret di DB/backups. Reader mereduksinya
 *   tetapi tidak menghapus data lama. Retensi/purge dan rotasi secret yang
 *   pernah terpapar perlu keputusan operator; tidak dimodifikasi otomatis.
 * - Batas 5 log berlaku per request, bukan lintas request. Akses log harus
 *   diberi retensi/rate limit infrastruktur agar tidak memenuhi storage.
 * - Terminal Zed gagal start karena libasound.so.2 saat pengerjaan. Tidak ada
 *   klaim php -l, suite runtime, Git diff/status, atau integrasi DB telah lulus.
 */
