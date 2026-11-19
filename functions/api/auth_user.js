/**
 * Cloudflare Pages Function
 * Route: GET/POST /api/auth_user
 *
 * HARDENED VERSION - Fixed SQLi and Added Input Sanitization
 * Project: MBG Monitoring
 */
import { trustedLoginIp, getLoginLockout, recordLoginFailure, recordLoginSuccess } from './_login_lockout.js';
import { dbQuery } from './_shared.js';

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

function containsControl(value) {
  return typeof value === 'string' && /[\u0000-\u001f\u007f]/.test(value);
}

function containsUnsafePayload(value) {
  if (typeof value !== 'string') return true;
  const decoded = value
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  return /(?:'|"|`|--|;|\/\*|\*\/|<|>|\bunion\b|\bselect\b|\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b|\btruncate\b|\bor\b\s+\d+\s*=|\band\b\s+\d+\s*=|javascript\s*:|on[a-z]+\s*=)/i.test(decoded);
}

function validEmail(email) {
  return typeof email === 'string' &&
    email.length <= 254 &&
    /^[a-z0-9.!#$%&*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(email);
}

function validPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 1024 || containsControl(password)) return false;
  let categories = 0;
  if (/[a-z]/.test(password)) categories++;
  if (/[A-Z]/.test(password)) categories++;
  if (/[0-9]/.test(password)) categories++;
  if (/[^A-Za-z0-9]/.test(password)) categories++;
  return categories >= 3;
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

async function getSession(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match  = cookie.match(/mbg_token=([a-f0-9]{64})/);
  if (!match || !env.SESSIONS) return null;
  const data = await env.SESSIONS.get(match[1]);
  if (!data) return null;
  const session = JSON.parse(data);
  if (!session.username) return null;
  const users = await dbQuery(env.DATABASE_URL,
    'SELECT session_version FROM users WHERE username = $1 AND is_active = TRUE LIMIT 1',
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
    if (new URL(request.url).searchParams.get('action') === 'logout') {
      const cookie = request.headers.get('Cookie') || '';
      const match = cookie.match(/(?:^|;\s*)mbg_token=([a-f0-9]{64})(?:;|$)/);
      if (match && env.SESSIONS) await env.SESSIONS.delete(match[1]);
      const headers = new Headers(CORS);
      headers.set('Set-Cookie', 'mbg_token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/');
      return new Response(JSON.stringify({ status: 'success' }), { headers });
    }
    if (new URL(request.url).searchParams.get('action') === 'login_status') {
      const ip = trustedLoginIp(request);
      if (!ip) return json({ status: 'error', message: 'IP client tidak dapat diverifikasi.' }, 503);
      try {
        return json({ status: 'success', lockout: await getLoginLockout(env, ip) });
      } catch {
        return json({ status: 'error', message: 'Status pembatasan login tidak tersedia.' }, 503);
      }
    }
    let session;
    try {
      session = await getSession(request, env);
    } catch (_) {
      return json({ status: 'error', logged_in: false, message: 'Status autentikasi tidak tersedia.' }, 503);
    }
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
        if (!env.SESSIONS) return json({ status: 'error', message: 'Sesi login belum dikonfigurasi.' }, 503);
        const currentLockout = await getLoginLockout(env, ip);
        if (currentLockout.blocked) {
          return json({ status: 'error', message: 'Alamat IP ini sedang diblokir.', lockout: currentLockout }, 429);
        }
        if (!username || username.length > 254 || password.length > 1024 ||
            containsControl(username) || containsControl(password) ||
            (!validEmail(username) && !/^[a-z0-9][a-z0-9_.-]{2,59}$/i.test(username)) ||
            containsUnsafePayload(username)) {
          const lockout = await recordLoginFailure(env, ip);
          return json({ status: 'error', message: 'Username atau kata sandi tidak valid.', lockout }, lockout.blocked ? 429 : 400);
        }

        // SECURE: Parameterized Query ($1)
        const rows = await dbQuery(env.DATABASE_URL,
          `SELECT id, username, full_name, email, role, sppg_name,
                  password_hash, salt, avatar_url, avatar_status, session_version
           FROM users
           WHERE (username = $1 OR email = $1) AND is_active = TRUE
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
      if (typeof body.full_name !== 'string' || typeof body.email !== 'string' ||
          typeof body.username !== 'string' || typeof body.password !== 'string') {
        return json({ status: 'error', message: 'Format data pendaftaran tidak valid.' }, 400);
      }
      const full_name = body.full_name.trim();
      const email     = sanitize(body.email);
      const username  = sanitize(body.username);
      const password  = body.password;
      const role      = ['sppg','user'].includes(body.role) ? body.role : 'user';
      const sppg_name = String(body.sppg_name || '').trim();

      if (!full_name || !email || !username || !password) return json({ status: 'error', message: 'Semua kolom wajib diisi.' }, 400);
      if (full_name.length > 120 || containsControl(full_name) || !/^[\p{L}\p{M}][\p{L}\p{M} .'-]{1,119}$/u.test(full_name)) {
        return json({ status: 'error', message: 'Nama lengkap tidak valid.' }, 400);
      }
      if (!validEmail(email) || containsControl(email)) {
        return json({ status: 'error', message: 'Format alamat email tidak valid.' }, 400);
      }
      if (!/^[a-z0-9][a-z0-9_.-]{2,59}$/i.test(username) || containsUnsafePayload(username)) {
        return json({ status: 'error', message: 'Username 3–60 karakter: huruf, angka, titik, garis bawah, atau strip.' }, 400);
      }
      if (!validPassword(password)) {
        return json({ status: 'error', message: 'Kata sandi minimal 12 karakter dan menggabungkan huruf besar, huruf kecil, angka, atau simbol.' }, 400);
      }
      if (role === 'sppg' && (!sppg_name || sppg_name.length > 150 || containsControl(sppg_name) || !/^[\p{L}\p{M}\p{N} .,'()/-]{2,150}$/u.test(sppg_name))) {
        return json({ status: 'error', message: 'Nama dapur SPPG tidak valid.' }, 400);
      }
      const nib = typeof body.nib === 'string' ? body.nib.trim() : '';
      const noSlhs = typeof body.no_slhs === 'string' ? body.no_slhs.trim() : '';
      if (role === 'sppg' && (!/^[a-z0-9./-]{5,40}$/i.test(nib) || !/^[a-z0-9./-]{4,60}$/i.test(noSlhs))) {
        return json({ status: 'error', message: 'NIB dan nomor SLHS wajib diisi dengan format yang valid.' }, 400);
      }

      try {
        const check = await dbQuery(env.DATABASE_URL,
          `SELECT id FROM users WHERE username = $1 OR email = $2 LIMIT 1`,
          [username, email]
        );
        if (check.length) return json({ status: 'error', message: 'Username atau email sudah digunakan.' }, 409);

        const salt = generateToken().substring(0, 16);
        const hash = await hashPassword(password, salt);
        await dbQuery(env.DATABASE_URL,
          `INSERT INTO users (username, full_name, email, role, sppg_name, nib, no_slhs, password_hash, salt, is_active, status_verifikasi, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10, NOW())`,
          [username, full_name, email, role, sppg_name || null, role === 'sppg' ? nib : null, role === 'sppg' ? noSlhs : null, hash, salt, role === 'sppg' ? 'pending_review' : 'approved']
        );
        return json({ status: 'success', message: 'Akun berhasil didaftarkan. Silakan masuk.' });
      } catch (_) {
        return json({ status: 'error', message: 'Registrasi sementara tidak dapat diproses.' }, 503);
      }
    }

    if (action === 'list_users') {
      let session;
      try {
        session = await getSession(request, env);
      } catch (_) {
        return json({ status: 'error', message: 'Status autentikasi tidak tersedia.' }, 503);
      }
      if (!session || session.role !== 'admin') return json({ status: 'error', message: 'Hanya admin.' }, 403);
      try {
        const rows = await dbQuery(env.DATABASE_URL,
          `SELECT id, username, full_name, email, role, sppg_name, avatar_status, is_active AS active, created_at
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