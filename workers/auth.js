/**
 * Cloudflare Worker — Auth API
 * Route: /api/auth
 * Replaces: api/auth_user.php
 *
 * KV Bindings required:
 *   USERS  — stores user records keyed by username
 *   SESSIONS — stores active sessions keyed by session token
 *   RATE   — stores rate limit counters keyed by IP
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Requested-By',
  'Content-Type': 'application/json'
};

const SESSION_TTL = 43200; // 12 hours in seconds
const RATE_MAX = 5;
const RATE_WINDOW = 900; // 15 minutes

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function checkRateLimit(env, ip) {
  const key = `rate:${ip}`;
  const current = await env.RATE.get(key);
  const count = current ? parseInt(current) : 0;
  if (count >= RATE_MAX) return false;
  await env.RATE.put(key, String(count + 1), { expirationTtl: RATE_WINDOW });
  return true;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    // Validate X-Requested-By header (anti-scraping)
    if (request.headers.get('X-Requested-By') !== 'mbg-radar' && request.method === 'POST') {
      return json({ status: 'error', message: 'Akses tidak diizinkan.' }, 403);
    }

    const url = new URL(request.url);
    const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';

    // GET /api/auth — check session
    if (request.method === 'GET') {
      const cookie = request.headers.get('Cookie') || '';
      const match = cookie.match(/mbg_token=([a-f0-9]{64})/);
      if (!match) return json({ logged_in: false });

      const sessionData = await env.SESSIONS.get(match[1]);
      if (!sessionData) return json({ logged_in: false });

      const session = JSON.parse(sessionData);
      return json({ logged_in: true, user: { full_name: session.name, role: session.role } });
    }

    // POST /api/auth — login or register
    if (request.method === 'POST') {
      const formData = await request.formData();
      const action = formData.get('action');

      // ── LOGIN ──────────────────────────────────────────────
      if (action === 'login') {
        const allowed = await checkRateLimit(env, ip);
        if (!allowed) {
          return json({ status: 'error', message: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' }, 429);
        }

        const username = (formData.get('username') || '').trim().toLowerCase();
        const password = formData.get('password') || '';

        if (!username || !password) {
          return json({ status: 'error', message: 'Username dan kata sandi wajib diisi.' });
        }

        const userData = await env.USERS.get(`user:${username}`);
        if (!userData) {
          return json({ status: 'error', message: 'Username atau kata sandi tidak cocok.' });
        }

        const user = JSON.parse(userData);
        const hashedInput = await hashPassword(password, user.salt);

        if (hashedInput !== user.password_hash) {
          return json({ status: 'error', message: 'Username atau kata sandi tidak cocok.' });
        }

        // Create session
        const token = generateToken();
        const sessionPayload = { name: user.full_name, role: user.role, username };
        await env.SESSIONS.put(token, JSON.stringify(sessionPayload), { expirationTtl: SESSION_TTL });

        const headers = new Headers(CORS);
        headers.set('Set-Cookie', `mbg_token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL}; Path=/`);

        return new Response(JSON.stringify({
          status: 'success',
          user: { full_name: user.full_name, role: user.role }
        }), { status: 200, headers });
      }

      // ── REGISTER ───────────────────────────────────────────
      if (action === 'register') {
        const full_name = (formData.get('full_name') || '').trim();
        const email = (formData.get('email') || '').trim().toLowerCase();
        const username = (formData.get('username') || '').trim().toLowerCase();
        const password = formData.get('password') || '';
        const role = formData.get('role') === 'sppg' ? 'sppg' : 'user';

        if (!full_name || !email || !username || !password) {
          return json({ status: 'error', message: 'Semua kolom wajib diisi.' });
        }
        if (username.length < 3) {
          return json({ status: 'error', message: 'Username minimal 3 karakter.' });
        }
        if (password.length < 6) {
          return json({ status: 'error', message: 'Kata sandi minimal 6 karakter.' });
        }

        const existing = await env.USERS.get(`user:${username}`);
        if (existing) {
          return json({ status: 'error', message: 'Username sudah digunakan.' });
        }

        const salt = generateToken().substring(0, 16);
        const password_hash = await hashPassword(password, salt);

        const newUser = { full_name, email, username, role, salt, password_hash, created_at: Date.now() };
        await env.USERS.put(`user:${username}`, JSON.stringify(newUser));

        return json({ status: 'success', message: 'Akun berhasil didaftarkan. Silakan masuk.' });
      }

      return json({ status: 'error', message: 'Aksi tidak dikenal.' }, 400);
    }

    return json({ status: 'error', message: 'Method tidak diizinkan.' }, 405);
  }
};
