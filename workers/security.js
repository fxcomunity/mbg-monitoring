/**
 * Cloudflare Worker — Security & Threat Logging
 * Route: /api/security
 * Replaces: client-side only logging
 *
 * KV Bindings required:
 *   THREATS      — stores threat log entries (TTL 30 days)
 *   BLOCKED_IPS  — stores blocked IP addresses
 *   SESSIONS     — shared for admin auth check
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Requested-By',
  'Content-Type': 'application/json'
};

const THREAT_TTL = 2592000; // 30 days
const AUTO_BLOCK_THRESHOLD = 3;
const AUTO_BLOCK_WINDOW = 3600; // 1 hour

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

async function getSession(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/mbg_token=([a-f0-9]{64})/);
  if (!match) return null;
  const sessionData = await env.SESSIONS.get(match[1]);
  return sessionData ? JSON.parse(sessionData) : null;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const url = new URL(request.url);
    const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
    const country = request.headers.get('CF-IPCountry') || '—';

    // POST /api/security/log — log a threat
    if (request.method === 'POST' && url.pathname.endsWith('/log')) {
      const body = await request.json().catch(() => ({}));
      const allowedTypes = ['xss', 'scrape', 'bot', 'inject', 'csrf', 'brute_force', 'honeypot'];
      const type = allowedTypes.includes(body.type) ? body.type : 'unknown';

      const id = generateId();
      const entry = {
        id,
        type,
        ip,
        country,
        url: (body.url || '').substring(0, 200),
        indicator: (body.indicator || '').substring(0, 100), // sanitized, never raw payload
        userAgent: (body.userAgent || '').substring(0, 150),
        ts: Date.now()
      };

      await env.THREATS.put(`threat:${id}`, JSON.stringify(entry), { expirationTtl: THREAT_TTL });

      // Check if this IP should be auto-blocked
      const countKey = `threat_count:${ip}`;
      const existing = await env.THREATS.get(countKey);
      const count = existing ? parseInt(existing) + 1 : 1;
      await env.THREATS.put(countKey, String(count), { expirationTtl: AUTO_BLOCK_WINDOW });

      if (count >= AUTO_BLOCK_THRESHOLD) {
        await env.BLOCKED_IPS.put(`blocked:${ip}`, JSON.stringify({
          ip, reason: `Auto-blocked: ${count} threats in 1 hour`, blocked_at: Date.now()
        }), { expirationTtl: 86400 }); // blocked 24h
      }

      return json({ status: 'logged', id });
    }

    // GET /api/security/threats — list threats (admin only)
    if (request.method === 'GET' && url.pathname.endsWith('/threats')) {
      const session = await getSession(request, env);
      if (!session || session.role !== 'admin') {
        return json({ status: 'error', message: 'Akses ditolak.' }, 403);
      }

      const list = await env.THREATS.list({ prefix: 'threat:' });
      const entries = await Promise.all(
        list.keys.slice(0, 100).map(async k => {
          const v = await env.THREATS.get(k.name);
          return v ? JSON.parse(v) : null;
        })
      );

      return json({ status: 'success', data: entries.filter(Boolean).sort((a, b) => b.ts - a.ts) });
    }

    // GET /api/security/check — check if IP is blocked (internal use)
    if (request.method === 'GET' && url.pathname.endsWith('/check')) {
      const blocked = await env.BLOCKED_IPS.get(`blocked:${ip}`);
      return json({ blocked: !!blocked, ip });
    }

    return json({ status: 'error', message: 'Endpoint tidak dikenal.' }, 404);
  }
};
