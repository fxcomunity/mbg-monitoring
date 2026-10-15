/**
 * _shared.js — Shared utilities untuk semua Pages Functions di /api/
 * Neon PostgreSQL via @neondatabase/serverless (HTTP mode)
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
 * Neon PostgreSQL query via HTTP fetch
 * Neon serverless HTTP endpoint: https://{host}/sql
 * dengan header Neon-Connection-String
 * Format: POST body = { query: string, params: any[] }
 */
export async function dbQuery(databaseUrl, sql, params = []) {
  if (!databaseUrl) throw new Error('DATABASE_URL tidak terkonfigurasi');

  // Parse connection string
  // Format: postgresql://user:password@host/database?sslmode=require
  const match = databaseUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^\/]+)\/([^?]+)/);
  if (!match) throw new Error('DATABASE_URL format tidak valid: ' + databaseUrl.substring(0, 30));

  const [, user, password, host, database] = match;

  // Neon HTTP SQL endpoint
  // Docs: https://neon.com/docs/serverless/serverless-driver
  const endpoint = `https://${host}/sql`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Neon-Connection-String': databaseUrl,
      'Authorization': 'Basic ' + btoa(`${user}:${password}`),
    },
    body: JSON.stringify({ query: sql, params })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown error');
    throw new Error(`Neon HTTP ${res.status}: ${errText.substring(0, 300)}`);
  }

  const data = await res.json();
  // Neon returns { rows: [...], fields: [...] }
  return data;
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
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(salt + password);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Ambil session dari cookie → lookup KV SESSIONS
export async function getSession(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/mbg_token=([a-f0-9]{64})/);
  if (!match) return null;
  if (!env?.SESSIONS) return null;
  const data = await env.SESSIONS.get(match[1]);
  return data ? JSON.parse(data) : null;
}
