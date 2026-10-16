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
 * Query Neon PostgreSQL via HTTP API
 * Tidak perlu npm package — Neon mendukung REST query via fetch + Basic Auth
 */
export async function dbQuery(databaseUrl, query, params = []) {
  if (!databaseUrl) throw new Error('DATABASE_URL tidak dikonfigurasi');

  const m = databaseUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^\/]+)\/([^?]+)/);
  if (!m) throw new Error('DATABASE_URL format salah');
  const [, user, password, host] = m;

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
    throw new Error(`Neon ${res.status}: ${txt.substring(0, 200)}`);
  }

  const data = await res.json();
  return data.rows ?? data;
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

export async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(salt + password);
  const buf  = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

export async function getSession(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match  = cookie.match(/mbg_token=([a-f0-9]{64})/);
  if (!match) return null;
  if (!env?.SESSIONS) return null;
  const data = await env.SESSIONS.get(match[1]);
  return data ? JSON.parse(data) : null;
}
