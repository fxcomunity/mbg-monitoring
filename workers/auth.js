/**
 * Cloudflare Worker — Auth API
 * Route: GET/POST /api/auth
 */

import { neon } from '@neondatabase/serverless';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Requested-By',
  'Content-Type': 'application/json'
};

const SESSION_TTL = 30 * 24 * 60 * 60;
const RATE_MAX    = 5;
const RATE_WINDOW = 900;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(salt + password);
  const buf  = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function generateToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function getSession(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match  = cookie.match(/mbg_token=([a-f0-9]{64})/);
  if (!match || !env.SESSIONS) return null;
  const data = await env.SESSIONS.get(match[1]);
  return data ? JSON.parse(data) : null;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (!env.DATABASE_URL) return json({ status: 'error', message: 'DATABASE_URL tidak dikonfigurasi' }, 500);

    // neon() diinisialisasi di sini — pakai template literal untuk query
    const sql = neon(env.DATABASE_URL);

    // ── GET: cek sesi ─────────────────────────────────────────────────────
    if (request.method === 'GET') {
      const session = await getSession(request, env);
      if (!session) return json({ logged_in: false });
      return json({
        logged_in: true,
        user: {
          username:   session.username || '',
          full_name:  session.name || '',
          role:       session.role,
          role_label: { admin: 'Admin Satgas BGN', sppg: 'Mitra Dapur SPPG', user: 'Wali Murid / Publik' }[session.role] || session.role,
          sppg_name:  session.sppg_name || '',
          avatar:     session.avatar || ''
        }
      });
    }

    // ── POST ─────────────────────────────────────────────────────────────
    if (request.method === 'POST') {
      let body = {};
      const ct = request.headers.get('Content-Type') || '';
      if (ct.includes('application/json')) {
        body = await request.json().catch(() => ({}));
      } else {
        const fd = await request.formData().catch(() => null);
        if (fd) fd.forEach((v, k) => { body[k] = v; });
      }

      const action = body.action || '';
      const ip     = request.headers.get('CF-Connecting-IP') || '0.0.0.0';

      // LOGIN
      if (action === 'login') {
        // Rate limiting
        if (env.RATE) {
          const rk  = `rate:login:${ip}`;
          const cnt = parseInt(await env.RATE.get(rk) || '0');
          if (cnt >= RATE_MAX) return json({ status: 'error', message: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' }, 429);
          await env.RATE.put(rk, String(cnt + 1), { expirationTtl: RATE_WINDOW });
        }

        const username = String(body.username || '').trim().toLowerCase();
        const password = String(body.password || '');
        if (!username || !password) return json({ status: 'error', message: 'Username dan kata sandi wajib diisi.' });

        try {
          // Pakai template literal — cara yang benar untuk @neondatabase/serverless
          const rows = await sql`
            SELECT id, username, full_name, email, role, sppg_name,
                   password_hash, salt, avatar_url, avatar_status
            FROM users
            WHERE (username = ${username} OR email = ${username})
              AND active = TRUE
            LIMIT 1
          `;

          const user = rows[0];
          if (!user) return json({ status: 'error', message: 'Username atau kata sandi tidak cocok.' });

          // Cek apakah salt sudah diset (belum jalankan setup_users.sql)
          if (!user.salt) {
            return json({ status: 'error', message: 'Akun belum diaktivasi. Hubungi admin BGN.' });
          }

          const hash = await hashPassword(password, user.salt);
          if (hash !== user.password_hash) {
            return json({ status: 'error', message: 'Username atau kata sandi tidak cocok.' });
          }

          const token   = generateToken();
          const session = {
            username:  user.username,
            name:      user.full_name,
            role:      user.role,
            sppg_name: user.sppg_name || '',
            avatar:    user.avatar_url || ''
          };
          if (env.SESSIONS) await env.SESSIONS.put(token, JSON.stringify(session), { expirationTtl: SESSION_TTL });

          const headers = new Headers(CORS);
          headers.set('Set-Cookie', `mbg_token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL}; Path=/`);
          return new Response(JSON.stringify({
            status: 'success',
            user: {
              username: user.username,
              full_name: user.full_name,
              role: user.role,
              role_label: { admin: 'Admin Satgas BGN', sppg: 'Pengelola Dapur SPPG', user: 'Wali Murid / Publik' }[user.role] || user.role,
              sppg_name: user.sppg_name || '',
              avatar: user.avatar_url || ''
            }
          }), { status: 200, headers });

        } catch (err) {
          return json({ status: 'error', message: 'Error DB: ' + err.message }, 500);
        }
      }

      // REGISTER
      if (action === 'register') {
        const full_name = String(body.full_name || '').trim();
        const email     = String(body.email     || '').trim().toLowerCase();
        const username  = String(body.username  || '').trim().toLowerCase();
        const password  = String(body.password  || '');
        const role      = ['sppg','user'].includes(body.role) ? body.role : 'user';
        const sppg_name = String(body.sppg_name || '').trim();

        if (!full_name || !email || !username || !password) return json({ status: 'error', message: 'Semua kolom wajib diisi.' });
        if (username.length < 3) return json({ status: 'error', message: 'Username minimal 3 karakter.' });
        if (password.length < 6) return json({ status: 'error', message: 'Kata sandi minimal 6 karakter.' });

        try {
          const check = await sql`SELECT id FROM users WHERE username = ${username} OR email = ${email} LIMIT 1`;
          if (check.length) return json({ status: 'error', message: 'Username atau email sudah digunakan.' });

          const salt = generateToken().substring(0, 16);
          const hash = await hashPassword(password, salt);
          await sql`
            INSERT INTO users (username, full_name, email, role, sppg_name, password_hash, salt, active, created_at)
            VALUES (${username}, ${full_name}, ${email}, ${role}, ${sppg_name || null}, ${hash}, ${salt}, TRUE, NOW())
          `;
          return json({ status: 'success', message: 'Akun berhasil didaftarkan. Silakan masuk.' });
        } catch (err) {
          return json({ status: 'error', message: 'Gagal mendaftar: ' + err.message }, 500);
        }
      }

      if (action === 'change_password') {
        const session = await getSession(request, env);
        if (!session) return json({ status: 'error', message: 'Silakan masuk terlebih dahulu.' }, 401);

        const currentPassword = String(body.current_password || '');
        const newPassword = String(body.new_password || '');
        const confirmPassword = String(body.confirm_password || '');
        if (!currentPassword || !newPassword || !confirmPassword) {
          return json({ status: 'error', message: 'Semua kolom kata sandi wajib diisi.' }, 422);
        }
        if (newPassword.length < 6) {
          return json({ status: 'error', message: 'Kata sandi baru minimal 6 karakter.' }, 422);
        }
        if (newPassword !== confirmPassword) {
          return json({ status: 'error', message: 'Konfirmasi kata sandi baru tidak cocok.' }, 422);
        }

        try {
          const users = await sql`
            SELECT password_hash, salt FROM users
            WHERE username = ${session.username} AND active = TRUE
            LIMIT 1
          `;
          const user = users[0];
          if (!user || !user.salt) {
            return json({ status: 'error', message: 'Akun tidak ditemukan atau belum diaktivasi.' }, 404);
          }
          if (await hashPassword(currentPassword, user.salt) !== user.password_hash) {
            return json({ status: 'error', message: 'Kata sandi lama tidak cocok.' }, 401);
          }

          const salt = generateToken().substring(0, 16);
          const passwordHash = await hashPassword(newPassword, salt);
          await sql`
            UPDATE users
            SET password_hash = ${passwordHash}, salt = ${salt}, updated_at = NOW()
            WHERE username = ${session.username}
          `;
          return json({ status: 'success', message: 'Kata sandi berhasil diperbarui.' });
        } catch {
          return json({ status: 'error', message: 'Kata sandi gagal diperbarui. Coba lagi.' }, 500);
        }
      }

      // LIST USERS (admin only)
      if (action === 'list_users') {
        const session = await getSession(request, env);
        if (!session || session.role !== 'admin') return json({ status: 'error', message: 'Hanya admin.' }, 403);
        try {
          const rows = await sql`
            SELECT id, username, full_name, email, role, sppg_name, avatar_status, active, created_at
            FROM users ORDER BY created_at DESC LIMIT 200
          `;
          return json({ status: 'success', data: rows });
        } catch (err) {
          return json({ status: 'error', message: err.message }, 500);
        }
      }

      return json({ status: 'error', message: 'Aksi tidak dikenal.' }, 400);
    }

    return json({ status: 'error', message: 'Method tidak diizinkan.' }, 405);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(purgeExpiredData(env).catch(error => {
      console.error('[CRON] Pembersihan akun/laporan gagal:', error);
      throw error;
    }));
  }
};

async function purgeExpiredData(env) {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL tidak dikonfigurasi untuk pembersihan akun terjadwal.');
  const sql = neon(env.DATABASE_URL);
  const deletedAccounts = await sql`
    DELETE FROM users
    WHERE deleted_at IS NOT NULL AND deleted_at <= NOW() - INTERVAL '7 days'
      AND LOWER(email) <> '19250779@bsi.ac.id'
    RETURNING id
  `;
  console.log(`[CRON] Akun sementara yang dihapus permanen: ${deletedAccounts.length}`);

  let deletedReports = 0;
  for (let batchNumber = 0; batchNumber < 10; batchNumber++) {
    const expiredReports = env.TIKET_PHOTOS ? await sql`
      SELECT id, photo_path
      FROM laporan_aduan
      WHERE created_at <= NOW() - INTERVAL '30 days'
        AND (photo_path IS NULL OR photo_path LIKE '/api/tiket?photo=%')
      ORDER BY created_at ASC
      LIMIT 100
    ` : await sql`
      SELECT id, photo_path
      FROM laporan_aduan
      WHERE created_at <= NOW() - INTERVAL '30 days'
        AND (photo_path IS NULL OR photo_path LIKE '/api/tiket?photo=TKT-BGN-%')
      ORDER BY created_at ASC
      LIMIT 100
    `;
    if (!expiredReports.length) break;

    for (const report of expiredReports) {
      const photoKey = cloudflarePhotoKey(report.photo_path);
      if (photoKey) {
        await env.TIKET_PHOTOS.delete(photoKey);
      }
      const removed = await sql`
        DELETE FROM laporan_aduan
        WHERE id = ${report.id} AND created_at <= NOW() - INTERVAL '30 days'
        RETURNING id
      `;
      deletedReports += removed.length;
    }
    if (expiredReports.length < 100) break;
  }
  console.log(`[CRON] Laporan berumur lebih dari 30 hari yang dihapus: ${deletedReports}`);
  if (!env.TIKET_PHOTOS) {
    const legacy = await sql`
      SELECT COUNT(*)::integer AS count
      FROM laporan_aduan
      WHERE created_at <= NOW() - INTERVAL '30 days'
        AND photo_path LIKE '/api/tiket?photo=aduan%'
    `;
    if (Number(legacy[0]?.count) > 0) {
      console.warn(`[CRON] ${legacy[0].count} laporan legacy memakai foto R2 dan belum dapat dipurge; pasang binding TIKET_PHOTOS untuk bucket lama.`);
    }
  }
}

function cloudflarePhotoKey(photoPath) {
  if (photoPath == null) return null;
  const url = new URL(String(photoPath), 'https://mbg-monitoring.invalid');
  if (url.pathname !== '/api/tiket') {
    throw new Error('Path foto laporan lama tidak dikenali; data tidak dihapus.');
  }
  const photoKey = url.searchParams.get('photo');
  if (photoKey && /^TKT-BGN-\d{8}-[A-F0-9]{32,64}$/i.test(photoKey)) return null;
  if (!photoKey || !/^aduan\/[a-f0-9-]{36}\.jpg$/i.test(photoKey)) {
    throw new Error('Kunci foto laporan lama tidak valid; data tidak dihapus.');
  }
  return photoKey;
}
