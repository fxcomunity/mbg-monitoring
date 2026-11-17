import { getSession, json, dbQuery } from './_shared.js';

export async function onRequestGet({ request, env }) {
  const session = await getSession(request, env);
  if (!session || session.role !== 'admin' || typeof session.username !== 'string' || !session.username) {
    return json({ status: 'error', message: 'Akses ditolak.' }, 403);
  }

  if (!env.DATABASE_URL) {
    return json({ status: 'error', message: 'DATABASE_URL tidak dikonfigurasi.' }, 500);
  }

  try {
    // A stale admin session must not retain access after deactivation/demotion.
    const users = await dbQuery(env.DATABASE_URL, `
      SELECT role FROM users WHERE username = $1 AND active = TRUE LIMIT 1
    `, [session.username]);
    if (users[0]?.role !== 'admin') {
      return json({ status: 'error', message: 'Akses ditolak.' }, 403);
    }
    const data = await dbQuery(env.DATABASE_URL, `
      SELECT
        t.id,
        t.exploit_type AS type,
        t.input_field,
        CASE
          WHEN t.input_field LIKE 'server:%' THEN 'server'
          WHEN t.input_field LIKE 'client:%' THEN 'client'
          ELSE 'legacy'
        END AS source,
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
    `);

    return json({ status: 'success', data });
  } catch (error) {
    console.error('Security threat list unavailable');
    return json({ status: 'error', message: 'Gagal mengambil log keamanan.' }, 500);
  }
}

export async function onRequest({ request }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  return json({ status: 'error', message: 'Method tidak diizinkan.' }, 405);
}
