/**
 * Cloudflare Pages Function
 * Route: GET/POST /api/auth_user
 * Menggantikan: api/auth_user.php
 *
 * GET  → cek status sesi aktif, return user info
 * POST action=login    → autentikasi username+password
 * POST action=register → daftar akun baru
 * POST action=list_users → daftar semua user (admin only)
 */

import { CORS, json, dbQuery, getSession, generateToken, hashPassword } from './_shared.js';

const SESSION_TTL = 43200; // 12 jam
const RATE_MAX    = 5;
const RATE_WINDOW = 900;   // 15 menit

const ROLE_LABELS = {
  admin: 'Admin Satgas BGN',
  sppg:  'Pengelola Dapur SPPG',
  user:  'Wali Murid / Publik'
};

function avatarSvg(role) {
  const svgs = {
    admin: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='20' fill='%23001026'/><path d='M20 7l9 4v7c0 5.5-3.8 10.7-9 12-5.2-1.3-9-6.5-9-12V11l9-4z' fill='%23134074'/><circle cx='20' cy='15' r='4' fill='%236ffbbe'/><path d='M13 26c0-3.5 3.1-6 7-6s7 2.5 7 6v1h-14v-1z' fill='%236ffbbe'/></svg>`,
    sppg:  `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='20' fill='%230b2545'/><path d='M20 10c-3.3 0-6 2.7-6 6v1h12v-1c0-3.3-2.7-6-6-6zm-8 9v2h16v-2H12zm2 4c0 3.3 2.7 6 6 6s6-2.7 6-6H14z' fill='%23f59e0b'/></svg>`,
    user:  `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='20' fill='%23395f95'/><path d='M20 11c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 12c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z' fill='%23ffffff'/></svg>`
  };
  return svgs[role] || svgs.user;
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const db = env.DATABASE_URL;

  // ── GET: cek sesi aktif ──────────────────────────────────────────────────
  if (request.method === 'GET') {
    const session = await getSession(request, env);
    if (!session) return json({ logged_in: false });

    return json({
      logged_in: true,
      user: {
        username:       session.username || '',
        full_name:      session.name || '',
        role:           session.role,
        role_label:     ROLE_LABELS[session.role] || session.role,
        sppg_name:      session.sppg_name || '',
        avatar:         session.avatar || avatarSvg(session.role),
        avatar_status:  session.avatar_status || 'approved'
      }
    });
  }

  // ── POST ─────────────────────────────────────────────────────────────────
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
    const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';

    // ── LOGIN ──────────────────────────────────────────────────────────────
    if (action === 'login') {
      // Rate limiting
      if (env.RATE) {
        const rk = `rate:login:${ip}`;
        const cnt = parseInt(await env.RATE.get(rk) || '0');
        if (cnt >= RATE_MAX) return json({ status: 'error', message: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' }, 429);
        await env.RATE.put(rk, String(cnt + 1), { expirationTtl: RATE_WINDOW });
      }

      const username = String(body.username || '').trim().toLowerCase();
      const password = String(body.password || '');
      if (!username || !password) return json({ status: 'error', message: 'Username dan kata sandi wajib diisi.' });

      try {
        const result = await dbQuery(db,
          `SELECT id, username, full_name, email, role, sppg_name, password_hash, salt, avatar_url, avatar_status
           FROM users WHERE username = $1 OR email = $1 LIMIT 1`,
          [username]
        );
        const user = result.rows?.[0];
        if (!user) return json({ status: 'error', message: 'Username atau kata sandi tidak cocok.' });

        const hash = await hashPassword(password, user.salt || '');
        if (hash !== user.password_hash) return json({ status: 'error', message: 'Username atau kata sandi tidak cocok.' });

        const token = generateToken();
        const sessionPayload = {
          username: user.username,
          name:     user.full_name || user.username,
          role:     user.role,
          sppg_name: user.sppg_name || '',
          avatar:   user.avatar_url || avatarSvg(user.role),
          avatar_status: user.avatar_status || 'approved'
        };
        if (env.SESSIONS) await env.SESSIONS.put(token, JSON.stringify(sessionPayload), { expirationTtl: SESSION_TTL });

        const headers = new Headers(CORS);
        headers.set('Set-Cookie', `mbg_token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL}; Path=/`);
        return new Response(JSON.stringify({
          status: 'success',
          user: { full_name: sessionPayload.name, role: user.role, role_label: ROLE_LABELS[user.role] }
        }), { status: 200, headers });
      } catch (err) {
        return json({ status: 'error', message: 'Gagal memproses login: ' + err.message }, 500);
      }
    }

    // ── REGISTER ───────────────────────────────────────────────────────────
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
        const check = await dbQuery(db, `SELECT id FROM users WHERE username = $1 OR email = $2 LIMIT 1`, [username, email]);
        if (check.rows?.length) return json({ status: 'error', message: 'Username atau email sudah digunakan.' });

        const salt = generateToken().substring(0, 16);
        const hash = await hashPassword(password, salt);
        await dbQuery(db,
          `INSERT INTO users (username, full_name, email, role, sppg_name, password_hash, salt, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
          [username, full_name, email, role, sppg_name || null, hash, salt]
        );
        return json({ status: 'success', message: 'Akun berhasil didaftarkan. Silakan masuk.' });
      } catch (err) {
        return json({ status: 'error', message: 'Gagal mendaftar: ' + err.message }, 500);
      }
    }

    // ── LIST USERS (admin only) ────────────────────────────────────────────
    if (action === 'list_users') {
      const session = await getSession(request, env);
      if (!session || session.role !== 'admin') return json({ status: 'error', message: 'Hanya admin.' }, 403);
      try {
        const result = await dbQuery(db,
          `SELECT id, username, full_name, email, role, sppg_name, avatar_status, active, created_at
           FROM users ORDER BY created_at DESC LIMIT 200`
        );
        return json({ status: 'success', data: result.rows || [] });
      } catch (err) {
        return json({ status: 'error', message: err.message }, 500);
      }
    }

    return json({ status: 'error', message: 'Aksi tidak dikenal.' }, 400);
  }

  return json({ status: 'error', message: 'Method tidak diizinkan.' }, 405);
}
