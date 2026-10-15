/**
 * Cloudflare Pages Function
 * Route: GET /api/menu/backup
 * Admin only — list ringkasan backup atau detail per tanggal
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Requested-By',
  'Content-Type': 'application/json'
};

function jsonRes(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

async function dbQuery(databaseUrl, sql, params = []) {
  const match = databaseUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^/]+)\/([^?]+)/);
  if (!match) throw new Error('DATABASE_URL tidak valid');
  const [, user, password, host] = match;

  const res = await fetch(`https://${host}/sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + btoa(`${user}:${password}`)
    },
    body: JSON.stringify({ query: sql, params })
  });
  if (!res.ok) throw new Error(`DB error: ${await res.text()}`);
  return res.json();
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

  // Cek session admin
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/mbg_token=([a-f0-9]{64})/);
  if (!match) return jsonRes({ status: 'error', message: 'Login diperlukan.' }, 401);

  const sessionData = await env.SESSIONS?.get(match[1]);
  const session = sessionData ? JSON.parse(sessionData) : null;
  if (!session || session.role !== 'admin') {
    return jsonRes({ status: 'error', message: 'Hanya admin yang bisa akses backup.' }, 403);
  }

  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  const db = env.DATABASE_URL;
  if (!db) return jsonRes({ status: 'error', message: 'DATABASE_URL tidak terkonfigurasi.' }, 500);

  try {
    let result;
    if (date) {
      // Detail backup tanggal tertentu
      result = await dbQuery(db,
        `SELECT * FROM menu_backup WHERE menu_date = $1 ORDER BY sppg_name, school_target`,
        [date]
      );
    } else {
      // Ringkasan semua backup (view)
      result = await dbQuery(db, `SELECT * FROM menu_backup_summary LIMIT 90`);
    }
    return jsonRes({ status: 'success', data: result.rows || [] });
  } catch (err) {
    return jsonRes({ status: 'error', message: err.message }, 500);
  }
}
