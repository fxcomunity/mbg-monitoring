# Komunikasi internal Admin/SPPG

## Database

Jalankan `database/neon_auth_sessions.sql` dan `database/internal_chat.sql` satu kali pada database Neon. Keduanya memerlukan tabel `users` dari schema utama. Migrasi chat mencakup percakapan, pesan, panggilan, status 24 jam, arsip per pengguna, dan komunitas beserta grup anggotanya.

Sesi Cloudflare Pages kini disimpan di Neon pada tabel `auth_sessions`; halaman Pages tidak membutuhkan binding KV `SESSIONS`. Browser tetap menerima cookie token acak HttpOnly, sedangkan database hanya menyimpan hash token. Terapkan `database/neon_auth_sessions.sql` di Neon SQL Editor sebelum deploy versi ini agar login dan validasi sesi berfungsi.

## Halaman

- `dashboard/komunikasi/chat/` — Chat dan percakapan langsung.
- Grup dibuat melalui dialog di halaman chat; membuka grup mengarah ke `dashboard/komunikasi/grup/chat/{id}`.
- `dashboard/komunikasi/chat/telephone/?conversation_id={id}` — memulai panggilan suara.
- `dashboard/komunikasi/chat/telephone/?call_id={id}` — menerima atau melanjutkan panggilan.
- Navigasi bawah menyediakan Chat, Pembaruan, Komunitas, Panggilan, dan Arsip.
- Status pribadi dibagikan ke kontak internal dan kedaluwarsa setelah 24 jam. Status grup hanya terlihat oleh anggota grup.
- Chat dapat diarsipkan per akun. Komunitas menyimpan anggota Admin/SPPG dan tautan ke grup koordinasi.

Panggilan suara menggunakan WebRTC dan meminta izin mikrofon. Aktifkan tombol suara untuk nada panggilan masuk/notifikasi; panggilan keluar memainkan nada tunggu selama menunggu jawaban. Browser dapat meminta izin notifikasi sistem. Verifikasi peran tetap dilakukan di server/database; API chat hanya menerima Admin/SPPG. Dashboard Admin dan SPPG memperbarui presence selama sesi aktif, sehingga status berubah offline setelah heartbeat berhenti selama 90 detik.

### TURN, Cloudflare Pages, dan Neon

Neon adalah PostgreSQL/database, **bukan** server TURN. TURN harus disediakan terpisah—misalnya server VPS yang menjalankan coturn atau layanan TURN terkelola. Jangan menaruh shared secret TURN ke tabel Neon atau mengirimkannya ke browser. Backend membuat kredensial TURN sementara menggunakan `TURN_SHARED_SECRET`; API hanya mengirim kredensial berjangka pendek ke akun Admin/SPPG yang sudah terautentikasi.

1. Sediakan TURN dengan dukungan kredensial REST (`use-auth-secret` coturn) dan siapkan domain yang mengarah ke server TURN.
2. Buka port TURN pada firewall sesuai konfigurasi server. Konfigurasi umum coturn memakai UDP/TCP `3478`, TLS `5349`, serta rentang UDP relay yang ditetapkan pada `min-port`/`max-port`.
   Contoh bagian penting konfigurasi coturn (sesuaikan sertifikat, IP publik, dan rentang port dengan servermu):

   ```ini
   listening-port=3478
   tls-listening-port=5349
   fingerprint
   use-auth-secret
   static-auth-secret=GANTI_DENGAN_SECRET_ACAK_PANJANG
   realm=turn.example.com
   min-port=49160
   max-port=49200
   ```

   Jika TLS diaktifkan, coturn juga harus diberi path sertifikat dan private key yang valid.
3. Tambahkan environment variables pada **Cloudflare Pages → project → Settings → Variables and Secrets**:
   - `TURN_URL`: contoh `turn:turn.example.com:3478?transport=udp,turns:turn.example.com:5349?transport=tcp`. Beberapa URL dapat dipisahkan koma; gunakan hanya endpoint yang memang aktif di servermu.
   - `TURN_SHARED_SECRET`: secret yang sama dengan `static-auth-secret` di coturn. Tandai sebagai **Secret**, bukan variable publik.
4. Redeploy Pages setelah mengubah variables/secrets.
5. Untuk Laragon/PHP, set `TURN_URL` dan `TURN_SHARED_SECRET` sebagai environment variables Apache/PHP, lalu restart Apache. Jangan commit nilainya ke Git.

Jika menggunakan Cloudflare DNS, record hostname TURN harus dapat menerima trafik TURN secara langsung; proxy HTTP biasa tidak meneruskan UDP/TCP TURN standar. Jika kedua environment variable TURN tidak diisi, aplikasi hanya menggunakan STUN bawaan—panggilan dapat gagal di jaringan yang membatasi koneksi langsung. Jika hanya satu variable diisi atau format URL salah, API akan mengembalikan error konfigurasi yang jelas.

Panggilan saat ini satu lawan satu; chat grup mendukung pesan grup.
