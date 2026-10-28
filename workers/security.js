/**
 * Cloudflare Worker — Security & Threat Logging
 * Route: /api/security
 *
 * Stores threat logs, rate counters, and temporary IP blocks in Neon.
 * Bindings required:
 *   DATABASE_URL — Neon PostgreSQL connection string
 *   SESSIONS     — shared with the auth Worker for admin authentication
 */

import { neon } from '@neondatabase/serverless';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Requested-By',
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store'
};

const AUTO_BLOCK_THRESHOLD = 3;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

async function getSession(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/(?:^|;\s*)mbg_token=([a-f0-9]{64})(?:;|$)/);
  if (!match || !env.SESSIONS) return null;
  const sessionData = await env.SESSIONS.get(match[1]);
  return sessionData ? JSON.parse(sessionData) : null;
}

function boundedText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function sourcePath(value) {
  const input = boundedText(value, 2000);
  if (!input) return '';

  try {
    const parsed = new URL(input);
    return `${parsed.origin}${parsed.pathname}`.slice(0, 500);
  } catch {
    return input.split(/[?#]/, 1)[0].slice(0, 500);
  }
}

function locationDetails(request) {
  const cf = request.cf || {};
  return {
    country: boundedText(request.headers.get('CF-IPCountry') || cf.country, 2) || null,
    region: boundedText(cf.region, 100) || null,
    city: boundedText(cf.city, 100) || null
  };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    if (!env.DATABASE_URL) {
      return json({ status: 'error', message: 'DATABASE_URL tidak dikonfigurasi.' }, 500);
    }

    const url = new URL(request.url);
    const ip = boundedText(request.headers.get('CF-Connecting-IP'), 45);
    if (!ip) return json({ status: 'error', message: 'Alamat IP tidak tersedia.' }, 400);

    const sql = neon(env.DATABASE_URL);
    const isCheckRequest = request.method === 'GET' && url.pathname.endsWith('/check');

    if (isCheckRequest) {
      const rows = await sql`
        SELECT EXISTS (
          SELECT 1
          FROM security_blocked_ips
          WHERE ip_address = ${ip}
            AND expires_at > NOW()
        ) AS blocked
      `;
      return json({ blocked: Boolean(rows[0]?.blocked), ip });
    }

    const blockedRows = await sql`
      SELECT reason, expires_at
      FROM security_blocked_ips
      WHERE ip_address = ${ip}
        AND expires_at > NOW()
      LIMIT 1
    `;
    if (blockedRows.length) {
      return json({
        status: 'blocked',
        message: 'Akses dari alamat IP ini diblokir sementara.',
        expires_at: blockedRows[0].expires_at
      }, 403);
    }

    if (request.method === 'POST' && url.pathname.endsWith('/log')) {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ status: 'error', message: 'Body JSON tidak valid.' }, 400);
      }
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return json({ status: 'error', message: 'Body JSON harus berupa objek.' }, 400);
      }

      const allowedTypes = ['xss', 'scrape', 'bot', 'inject', 'csrf', 'brute_force', 'honeypot'];
      const type = allowedTypes.includes(body.type) ? body.type : 'unknown';
      const location = locationDetails(request);
      const userAgent = boundedText(request.headers.get('User-Agent'), 500);
      const indicator = boundedText(body.indicator, 100);
      const requestedUrl = sourcePath(body.url);

      const rows = await sql`
        WITH new_threat AS (
          INSERT INTO exploit_logs (
            ip_address, user_agent, exploit_type, input_field, payload_sample,
            requested_url, country, region, city
          )
          VALUES (
            ${ip}, ${userAgent}, ${type}, ${type}, ${indicator || null},
            ${requestedUrl}, ${location.country}, ${location.region}, ${location.city}
          )
          RETURNING id, ip_address
        ),
        threat_counter AS (
          INSERT INTO security_threat_counters (ip_address, window_started_at, threat_count)
          SELECT ip_address, NOW(), 1
          FROM new_threat
          ON CONFLICT (ip_address) DO UPDATE SET
            threat_count = CASE
              WHEN security_threat_counters.window_started_at <= NOW() - INTERVAL '1 hour' THEN 1
              ELSE security_threat_counters.threat_count + 1
            END,
            window_started_at = CASE
              WHEN security_threat_counters.window_started_at <= NOW() - INTERVAL '1 hour' THEN NOW()
              ELSE security_threat_counters.window_started_at
            END
          RETURNING ip_address, threat_count
        ),
        new_block AS (
          INSERT INTO security_blocked_ips (ip_address, reason, blocked_at, expires_at)
          SELECT ip_address, 'Auto-block: 3 or more threats in 1 hour', NOW(), NOW() + INTERVAL '24 hours'
          FROM threat_counter
          WHERE threat_count >= ${AUTO_BLOCK_THRESHOLD}
          ON CONFLICT (ip_address) DO UPDATE SET
            reason = EXCLUDED.reason,
            blocked_at = EXCLUDED.blocked_at,
            expires_at = EXCLUDED.expires_at
          RETURNING ip_address
        )
        SELECT
          new_threat.id,
          threat_counter.threat_count,
          EXISTS (SELECT 1 FROM new_block)
          OR EXISTS (
            SELECT 1
            FROM security_blocked_ips
            WHERE ip_address = new_threat.ip_address
              AND expires_at > NOW()
          ) AS blocked
        FROM new_threat
        JOIN threat_counter USING (ip_address)
      `;

      return json({
        status: 'logged',
        id: rows[0].id,
        blocked: Boolean(rows[0].blocked),
        threat_count: Number(rows[0].threat_count)
      });
    }

    if (request.method === 'GET' && url.pathname.endsWith('/threats')) {
      const session = await getSession(request, env);
      if (!session || session.role !== 'admin') {
        return json({ status: 'error', message: 'Akses ditolak.' }, 403);
      }

      const rows = await sql`
        SELECT
          t.id,
          t.exploit_type AS type,
          t.ip_address AS ip,
          t.country,
          t.region,
          t.city,
          t.requested_url AS url,
          t.created_at AS ts,
          EXISTS (
            SELECT 1
            FROM security_blocked_ips b
            WHERE b.ip_address = t.ip_address
              AND b.expires_at > NOW()
          ) AS blocked
        FROM exploit_logs t
        ORDER BY t.created_at DESC
        LIMIT 100
      `;
      return json({ status: 'success', data: rows });
    }

    return json({ status: 'error', message: 'Endpoint tidak dikenal.' }, 404);
  }
};
