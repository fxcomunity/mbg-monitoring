/**
 * Cloudflare Pages Function
 * Route: GET/POST /api/auth_user
 *
 * HARDENED VERSION - Fixed SQLi and Added Input Sanitization
 * Project: MBG Monitoring
 */
import { trustedLoginIp, getLoginLockout, recordLoginFailure, recordLoginSuccess } from './_login_lockout.js';

const CORS = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Requested-By',
  'Cache-Control': 'no-cache, no-store, must-revalidate'
};

const SESSION_TTL = 43200;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

// Sanitasi input untuk mencegah karakter aneh masuk ke logic
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.trim().toLowerCase();
}

async function hashPassword(password, salt) {
  const rounds = 310000;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: rounds, hash: 'SHA-256' }, key, 512);
  const digest = Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2_sha256$${rounds}$${salt}$${digest}`;
}

async function verifyPassword(password, storedHash, legacySalt = '') {
  const match = /^pbkdf2_sha256\$(\d{6})\$([a-f0-9]{32})\$([a-f0-9]{128})$/i.exec(String(storedHash || ''));
  if (match) {
    const rounds = Number(match[1]);
    if (rounds < 100000 || rounds > 600000) return false;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(match[2]), iterations: rounds, hash: 'SHA-256' }, key, 512);
    const candidate = Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, '0')).join('');
    if (candidate.length !== match[3].length) return false;
    let diff = 0;
    for (let i = 0; i < candidate.length; i++) diff |= candidate.charCodeAt(i) ^ match[3].toLowerCase().charCodeAt(i);
    return diff === 0;
  }
  if (!legacySalt || !/^[a-f0-9]{64}$/i.test(String(storedHash || ''))) return false;
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(legacySalt + password));
  const candidate = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
  return candidate === String(storedHash).toLowerCase();
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
  if (!data) return null;
  const session = JSON.parse(data);
  if (!session.username) return null;
  const users = await dbQuery(env.DATABASE_URL,
    'SELECT session_version FROM users WHERE username = $1 AND active = TRUE LIMIT 1',
    [session.username]
  );
  if (!users[0] || Number(users[0].session_version || 0) !== Number(session.session_version || 0)) return null;
  return session;
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
    if (new URL(request.url).searchParams.get('action') === 'login_status') {
      const ip = trustedLoginIp(request);
      if (!ip) return json({ status: 'error', message: 'IP client tidak dapat diverifikasi.' }, 503);
      try {
        return json({ status: 'success', lockout: await getLoginLockout(env, ip) });
      } catch {
        return json({ status: 'error', message: 'Status pembatasan login tidak tersedia.' }, 503);
      }
    }
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

    const action = typeof body.action === 'string' ? body.action : '';

    if (action === 'login') {
      const ip = trustedLoginIp(request);
      if (!ip) return json({ status: 'error', message: 'IP client tidak dapat diverifikasi.' }, 503);

      // HARDENING: Sanitize input
      const username = typeof body.username === 'string' ? sanitize(body.username) : '';
      const password = typeof body.password === 'string' ? body.password : '';

      try {
        const currentLockout = await getLoginLockout(env, ip);
        if (currentLockout.blocked) {
          return json({ status: 'error', message: 'Alamat IP ini sedang diblokir.', lockout: currentLockout }, 429);
        }
        if (!username || username.length > 120 || password.length > 1024 || /[\u0000-\u001f\u007f]/.test(username)) {
          const lockout = await recordLoginFailure(env, ip);
          return json({ status: 'error', message: 'Username atau kata sandi tidak cocok.', lockout }, lockout.blocked ? 429 : 401);
        }

        // SECURE: Parameterized Query ($1)
        const rows = await dbQuery(env.DATABASE_URL,
          `SELECT id, username, full_name, email, role, sppg_name,
                  password_hash, salt, avatar_url, avatar_status, session_version
           FROM users
           WHERE (username = $1 OR email = $1) AND active = TRUE
           LIMIT 1`,
          [username]
        );
        
        const user = rows[0];
        if (!user || !await verifyPassword(password, user.password_hash, user.salt || '')) {
          const lockout = await recordLoginFailure(env, ip);
          return json({ status: 'error', message: 'Username atau kata sandi tidak cocok.', lockout }, lockout.blocked ? 429 : 401);
        }

        let sessionVersion = Number(user.session_version) || 0;
        if (!String(user.password_hash).startsWith('pbkdf2_sha256$')) {
          const upgradedHash = await hashPassword(password, generateToken().slice(0, 32));
          const updated = await dbQuery(env.DATABASE_URL,
            `UPDATE users SET password_hash = $1, session_version = session_version + 1, updated_at = NOW()
             WHERE id = $2 RETURNING session_version`,
            [upgradedHash, user.id]
          );
          sessionVersion = Number(updated[0]?.session_version) || sessionVersion + 1;
        }
        await recordLoginSuccess(env, ip);

        const token   = generateToken();
        const session = {
          username:     user.username,
          name:         user.full_name,
          role:         user.role,
          sppg_name:    user.sppg_name || '',
          avatar:       user.avatar_url || '',
          avatar_status: user.avatar_status || 'approved',
          session_version: sessionVersion
        };
        if (env.SESSIONS) await env.SESSIONS.put(token, JSON.stringify(session), { expirationTtl: SESSION_TTL });

        const headers = new Headers(CORS);
        headers.set('Set-Cookie', `mbg_token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL}; Path=/`);
        return new Response(JSON.stringify({
          status: 'success',
          user: { full_name: user.full_name, role: user.role, role_label: ROLE_LABELS[user.role] }
        }), { status: 200, headers });

      } catch (err) {
        console.error('Authentication service unavailable');
        return json({ status: 'error', message: 'Layanan autentikasi sementara tidak tersedia.' }, 503);
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