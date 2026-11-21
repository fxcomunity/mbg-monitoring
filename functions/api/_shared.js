/**
 * _shared.js — Shared utilities untuk semua Pages Functions di /api/
 * Shared Pages helpers.
 */
import { pbkdf2Sync } from 'node:crypto';

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

  let rows;
  const neonMod = await import('@neondatabase/serverless').catch(() => null);
  if (neonMod && typeof neonMod.neon === 'function') {
    const sql = neonMod.neon(databaseUrl);
    rows = await sql.query(query, params);
  } else {
    // Fallback native HTTP API fetch for Cloudflare Workers
    const parsed = new URL(databaseUrl);
    const endpoint = `https://${parsed.host}/sql`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${parsed.password}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, params })
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Database error (${response.status}): ${errText}`);
    }
    const result = await response.json().catch(() => ({}));
    rows = result.rows || [];
  }

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

async function derivePasswordKey(password, salt, iterations, hashLength, databaseUrl) {
  if (databaseUrl) {
    const rows = await dbQuery(databaseUrl,
      `SELECT encode(public.mbg_pbkdf2_sha256($1, $2, $3, $4), 'hex') AS digest`,
      [password, salt, iterations, hashLength]
    );
    if (typeof rows[0]?.digest !== 'string' || !/^[a-f0-9]+$/i.test(rows[0].digest)) {
      throw new Error('Neon PBKDF2 function returned an invalid digest.');
    }
    return rows[0].digest;
  }

  return pbkdf2Sync(password, salt, iterations, hashLength, 'sha256').toString('hex');
}

export async function hashPassword(password, salt = generateToken().slice(0, 32), databaseUrl) {
  const iterations = 310000;
  const digest = await derivePasswordKey(password, salt, iterations, 64, databaseUrl);
  return `pbkdf2_sha256$${iterations}$${salt}$${digest}`;
}

export async function hashSessionToken(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i++) mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return mismatch === 0;
}

export async function verifyPassword(password, storedHash, legacySalt = '', databaseUrl) {
  if (typeof storedHash !== 'string') return false;
  const match = /^pbkdf2_sha256\$(\d{6})\$([a-f0-9]{32})\$([a-f0-9]{64}|[a-f0-9]{128})$/i.exec(storedHash);
  if (match) {
    const iterations = Number(match[1]);
    if (iterations < 100000 || iterations > 600000) return false;
    const candidate = await derivePasswordKey(password, match[2], iterations, match[3].length / 2, databaseUrl);
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
  const match = cookie.match(/(?:^|;\s*)mbg_token=([a-f0-9]{64})(?:;|$)/);
  if (!match || !env?.DATABASE_URL) return null;
  const tokenHash = await hashSessionToken(match[1]);
  const rows = await dbQuery(env.DATABASE_URL, `
    SELECT u.id, u.username, u.full_name AS name, u.role, u.sppg_name,
           u.avatar_url AS avatar, u.avatar_status, u.session_version
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = $1 AND s.expires_at > NOW()
      AND u.is_active = TRUE AND u.deleted_at IS NULL
      AND s.session_version = u.session_version
      AND u.role IN ('admin', 'sppg', 'user')
      AND (u.role <> 'sppg' OR LOWER(COALESCE(u.status_verifikasi, '')) = 'approved')
    LIMIT 1
  `, [tokenHash]);
  const session = rows[0];
  if (!session) return null;
  return {
    ...session,
    id: Number(session.id),
    session_version: Number(session.session_version)
  };
}

export async function revokeSession(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/(?:^|;\s*)mbg_token=([a-f0-9]{64})(?:;|$)/);
  if (!match || !env?.DATABASE_URL) return;
  const tokenHash = await hashSessionToken(match[1]);
  await dbQuery(env.DATABASE_URL, 'DELETE FROM auth_sessions WHERE token_hash = $1', [tokenHash]);
}
