/**
 * Cloudflare Pages Function
 * Route: GET/POST /api/auth_user
 *
 * HARDENED VERSION - Fixed SQLi and Added Input Sanitization
 * Project: MBG Monitoring
 */

const CORS = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Requested-By',
  'Cache-Control': 'no-cache, no-store, must-revalidate'
};

const SESSION_TTL = 43200;
const RATE_MAX    = 5;
const RATE_WINDOW = 900;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

// Sanitasi input untuk mencegah karakter aneh masuk ke logic
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.trim().toLowerCase();
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

async function dbQuery(databaseUrl, query, params = []) {
  if (!databaseUrl) throw new Error('DATABASE_URL tidak dikonfigurasi');

  const m = databaseUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^\/]+)\/([^?]+)/);
  if (!m) throw new Error('DATABASE_URL format salah');
  const [, user, password, host, db] = m;

  const res = await fetch(`https://${host}/sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + btoa(`${user}:${password}`),
      'Neon-Connection-String': databaseUrl,
    },
    body: JSON.stringify({ query, params })
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Neon ${res.status}: ${txt.substring(0,200)}`);
  }

  const data = await res.json();
  return data.rows ?? data;
}

async function getSession(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match  = cookie.match(/mbg_token=([a-f0-9]{64})/);
  if (!match || !env.SESSIONS) return null;
  const data = await env.SESSIONS.get(match[1]);
  return data ? JSON.parse(data) : null;
}

const ROLE_LABELS = {
  admin: 'Admin Satgas BGN',
  sppg:  'Pengelola Dapur SPPG',
  user:  'Wali Murid / Publik'
};

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

  if (!env.DATABASE_URL) return json({ status: 'error', message: 'DATABASE_URL tidak dikonfigurasi di Cloudflare Pages' }, 500);

  if (request.method === 'GET') {
    const session = await getSession(request, env);
    if (!session) return json({ logged_in: false });
    return json({
      logged_in: true,
      user: {
        username:     session.username || '',
        full_name:    session.name || '',
        role:         session.role,
        role_label:   ROLE_LABELS[session.role] || session.role,
        sppg_name:    session.sppg_name || '',
        avatar:       session.avatar || '',
        avatar_status: session.avatar_status || 'approved'
      }
    });
  }

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

    if (action === 'login') {
      if (env.RATE) {
        const rk  = `rate:login:${ip}`;
        const cnt = parseInt(await env.RATE.get(rk) || '0');
        if (cnt >= RATE_MAX) return json({ status: 'error', message: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' }, 429);
        await env.RATE.put(rk, String(cnt + 1), { expirationTtl: RATE_WINDOW });
      }

      // HARDENING: Sanitize input
      const username = sanitize(body.username);
      const password = String(body.password || '');
      
      if (!username || !password) return json({ status: 'error', message: 'Username dan kata sandi wajib diisi.' });

      try {
        // SECURE: Parameterized Query ($1)
        const rows = await dbQuery(env.DATABASE_URL,
          `SELECT id, username, full_name, email, role, sppg_name,
                  password_hash, salt, avatar_url, avatar_status
           FROM users
           WHERE (username = $1 OR email = $1) AND active = TRUE
           LIMIT 1`,
          [username]
        );
        
        const user = rows[0];
        if (!user) return json({ status: 'error', message: 'Username atau kata sandi tidak cocok.' });
        if (!user.salt) return json({ status: 'error', message: 'Akun belum diaktivasi.' });

        const hash = await hashPassword(password, user.salt);
        if (hash !== user.password_hash) return json({ status: 'error', message: 'Username atau kata sandi tidak cocok.' });

        const token   = generateToken();
        const session = {
          username:     user.username,
          name:         user.full_name,
          role:         user.role,
          sppg_name:    user.sppg_name || '',
          avatar:       user.avatar_url || '',
          avatar_status: user.avatar_status || 'approved'
        };
        if (env.SESSIONS) await env.SESSIONS.put(token, JSON.stringify(session), { expirationTtl: SESSION_TTL });

        const headers = new Headers(CORS);
        headers.set('Set-Cookie', `mbg_token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL}; Path=/`);
        return new Response(JSON.stringify({
          status: 'success',
          user: { full_name: user.full_name, role: user.role, role_label: ROLE_LABELS[user.role] }
        }), { status: 200, headers });

      } catch (err) {
        return json({ status: 'error', message: 'DB Error: ' + err.message }, 500);
      }
    }

    if (action === 'register') {
      const full_name = String(body.full_name || '').trim();
      const email     = sanitize(body.email);
      const username  = sanitize(body.username);
      const password  = String(body.password || '');
      const role      = ['sppg','user'].includes(body.role) ? body.role : 'user';
      const sppg_name = String(body.sppg_name || '').trim();

      if (!full_name || !email || !username || !password) return json({ status: 'error', message: 'Semua kolom wajib diisi.' });
      if (username.length < 3) return json({ status: 'error', message: 'Username minimal 3 karakter.' });
      if (password.length < 6) return json({ status: 'error', message: 'Kata sandi minimal 6 karakter.' });

      try {
        const check = await dbQuery(env.DATABASE_URL,
          `SELECT id FROM users WHERE username = $1 OR email = $2 LIMIT 1`,
          [username, email]
        );
        if (check.length) return json({ status: 'error', message: 'Username atau email sudah digunakan.' });

        const salt = generateToken().substring(0, 16);
        const hash = await hashPassword(password, salt);
        await dbQuery(env.DATABASE_URL,
          `INSERT INTO users (username, full_name, email, role, sppg_name, password_hash, salt, active, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW())`,
          [username, full_name, email, role, sppg_name || null, hash, salt]
        );
        return json({ status: 'success', message: 'Akun berhasil didaftarkan. Silakan masuk.' });
      } catch (err) {
        return json({ status: 'error', message: 'Gagal mendaftar: ' + err.message }, 500);
      }
    }

    if (action === 'list_users') {
      const session = await getSession(request, env);
      if (!session || session.role !== 'admin') return json({ status: 'error', message: 'Hanya admin.' }, 403);
      try {
        const rows = await dbQuery(env.DATABASE_URL,
          `SELECT id, username, full_name, email, role, sppg_name, avatar_status, active, created_at
           FROM users ORDER BY created_at DESC LIMIT 200`
        );
        return json({ status: 'success', data: rows });
      } catch (err) {
        return json({ status: 'error', message: err.message }, 500);
      }
    }

    return json({ status: 'error', message: 'Aksi tidak dikenal.' }, 400);
  }

  return json({ status: 'error', message: 'Method tidak diizinkan.' }, 405);
}