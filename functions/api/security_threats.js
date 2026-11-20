import { getSession, json, dbQuery } from './_shared.js';

export async function onRequestGet({ request, env }) {
  let session;
  try {
    session = await getSession(request, env);
  } catch (error) {
    console.error('Security threat session verification failed:', error);
    return json({ status: 'error', message: 'Status autentikasi tidak tersedia.' }, 503);
  }
  if (!session || session.role !== 'admin' || typeof session.username !== 'string' || !session.username) {
    return json({ status: 'error', message: 'Akses ditolak.' }, 403);
  }

  if (!env.DATABASE_URL) {
    return json({ status: 'error', message: 'DATABASE_URL tidak dikonfigurasi.' }, 500);
  }

  try {
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
