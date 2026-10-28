import { dbQuery, json } from '../_shared.js';

const AUTO_BLOCK_THRESHOLD = 3;
const ALLOWED_TYPES = ['xss', 'scrape', 'bot', 'inject', 'csrf', 'brute_force', 'honeypot'];

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

export async function onRequestPost({ request, env }) {
  if (!env.DATABASE_URL) {
    return json({ status: 'error', message: 'DATABASE_URL tidak dikonfigurasi.' }, 500);
  }

  const ip = boundedText(request.headers.get('CF-Connecting-IP'), 45);
  if (!ip) return json({ status: 'error', message: 'Alamat IP tidak tersedia.' }, 400);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ status: 'error', message: 'Body JSON tidak valid.' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ status: 'error', message: 'Body JSON harus berupa objek.' }, 400);
  }

  const type = ALLOWED_TYPES.includes(body.type) ? body.type : 'unknown';
  const userAgent = boundedText(request.headers.get('User-Agent'), 500);
  const indicator = boundedText(body.indicator, 100);
  const requestedUrl = sourcePath(body.url);
  const cf = request.cf || {};
  const country = boundedText(request.headers.get('CF-IPCountry') || cf.country, 2) || null;
  const region = boundedText(cf.region, 100) || null;
  const city = boundedText(cf.city, 100) || null;

  try {
    const blockedRows = await dbQuery(env.DATABASE_URL, `
      SELECT EXISTS (
        SELECT 1
        FROM security_blocked_ips
        WHERE ip_address = $1 AND expires_at > NOW()
      ) AS blocked
    `, [ip]);
    if (blockedRows[0]?.blocked) {
      return json({ status: 'blocked', message: 'Akses dari alamat IP ini diblokir sementara.' }, 403);
    }

    const rows = await dbQuery(env.DATABASE_URL, `
      WITH new_threat AS (
        INSERT INTO exploit_logs (
          ip_address, user_agent, exploit_type, input_field, payload_sample,
          requested_url, country, region, city
        )
        VALUES ($1, $2, $3, $3, $4, $5, $6, $7, $8)
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
        WHERE threat_count >= $9
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
    `, [ip, userAgent, type, indicator || null, requestedUrl, country, region, city, AUTO_BLOCK_THRESHOLD]);

    return json({
      status: 'logged',
      id: rows[0].id,
      blocked: Boolean(rows[0].blocked),
      threat_count: Number(rows[0].threat_count)
    });
  } catch (error) {
    console.error('Gagal menyimpan log keamanan ke Neon:', error);
    return json({ status: 'error', message: 'Gagal menyimpan log keamanan.' }, 500);
  }
}

export async function onRequest({ request }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  return json({ status: 'error', message: 'Method tidak diizinkan.' }, 405);
}
