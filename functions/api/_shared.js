/**
 * _shared.js — Shared utilities untuk semua Pages Functions di /api/
 * Tidak pakai npm package — semua vanilla JS agar Cloudflare Pages bisa bundle.
 */

export const CORS = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Requested-By',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'X-Content-Type-Options': 'nosniff'
};

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

export function escHTML(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/**
 * Query Neon PostgreSQL through the Neon serverless HTTP/WebSocket driver.
 */
export async function dbQuery(databaseUrl, query, params = []) {
  if (!databaseUrl) throw new Error('DATABASE_URL tidak dikonfigurasi');
  try {
    const url = new URL(databaseUrl);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
      throw new Error('invalid scheme');
    }
  } catch (_) {
    throw new Error('DATABASE_URL format salah');
  }

  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(databaseUrl);
  const rows = await sql.query(query, params);
  const normalized = Array.isArray(rows) ? rows : (rows?.rows || []);
  Object.defineProperty(normalized, 'rows', {
    value: normalized,
    enumerable: false,
    configurable: true
  });
  return normalized;
}

export function todayWIB() {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

export function nowISO() {
  return new Date().toISOString();
}

export function generateToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2,'0')).join('');
}

export async function hashPassword(password, salt = generateToken().slice(0, 32)) {
  const iterations = 310000;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    salt: new TextEncoder().encode(salt),
    iterations,
    hash: 'SHA-256'
  }, key, 512);
  const digest = Array.from(new Uint8Array(bits), byte => byte.toString(16).padStart(2, '0')).join('');
  return `pbkdf2_sha256$${iterations}$${salt}$${digest}`;
}

function constantTimeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i++) mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return mismatch === 0;
}

export async function verifyPassword(password, storedHash, legacySalt = '') {
  if (typeof storedHash !== 'string') return false;
  const match = /^pbkdf2_sha256\$(\d{6})\$([a-f0-9]{32})\$([a-f0-9]{128})$/i.exec(storedHash);
  if (match) {
    const iterations = Number(match[1]);
    if (iterations < 100000 || iterations > 600000) return false;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({
      name: 'PBKDF2',
      salt: new TextEncoder().encode(match[2]),
      iterations,
      hash: 'SHA-256'
    }, key, 512);
    const candidate = Array.from(new Uint8Array(bits), byte => byte.toString(16).padStart(2, '0')).join('');
    return constantTimeEqual(candidate, match[3].toLowerCase());
  }
  if (!legacySalt || !/^[a-f0-9]{64}$/i.test(storedHash)) return false;
  const legacy = new TextEncoder().encode(legacySalt + password);
  const digest = await crypto.subtle.digest('SHA-256', legacy);
  const candidate = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  return constantTimeEqual(candidate, storedHash.toLowerCase());
}

export async function getSession(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match  = cookie.match(/mbg_token=([a-f0-9]{64})/);
  if (!match) return null;
  if (!env?.SESSIONS) return null;
  const data = await env.SESSIONS.get(match[1]);
  if (!data) return null;
  const session = JSON.parse(data);
  if (!session.username || !env.DATABASE_URL) return null;
  const rows = await dbQuery(env.DATABASE_URL, `
    SELECT session_version FROM users
    WHERE username = $1 AND is_active = TRUE
    LIMIT 1
  `, [session.username]);
  if (!rows[0] || Number(rows[0].session_version || 0) !== Number(session.session_version || 0)) return null;
  return session;
}
