/**
 * Cloudflare Pages Function
 * Route: GET/POST /api/menu
 * 
 * GET  /api/menu              → menu hari ini (dari Neon view menu_hari_ini)
 * GET  /api/menu?date=YYYY-MM-DD → menu tanggal lama (dari menu_backup)
 * POST /api/menu              → tambah menu baru (sppg/admin only)
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Requested-By',
  'Content-Type': 'application/json'
};

function jsonRes(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

// Tanggal hari ini dalam WIB (UTC+7)
function todayWIB() {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
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

async function getSession(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/mbg_token=([a-f0-9]{64})/);
  if (!match) return null;
  const data = await env.SESSIONS?.get(match[1]);
  return data ? JSON.parse(data) : null;
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  const db = env.DATABASE_URL;

  if (!db) return jsonRes({ status: 'error', message: 'DATABASE_URL tidak terkonfigurasi' }, 500);

  // ── GET ──────────────────────────────────────────────────────────────────
  if (request.method === 'GET') {
    const targetDate = date || todayWIB();
    const isToday = targetDate === todayWIB();

    // Cek cache
    const cacheKey = `menu_${targetDate}`;
    if (env.MENU_CACHE) {
      const cached = await env.MENU_CACHE.get(cacheKey);
      if (cached) return new Response(cached, { headers: { ...CORS, 'X-Cache': 'HIT' } });
    }

    let result;
    try {
      if (isToday) {
        result = await dbQuery(db, `SELECT * FROM menu_hari_ini`);
      } else {
        result = await dbQuery(db,
          `SELECT * FROM menu_backup WHERE menu_date = $1 ORDER BY sppg_name`,
          [targetDate]
        );
      }
    } catch (err) {
      return jsonRes({ status: 'error', message: err.message }, 500);
    }

    const payload = JSON.stringify({
      status: 'success',
      date: targetDate,
      data: result.rows || []
    });

    // Cache 5 menit
    if (env.MENU_CACHE) {
      await env.MENU_CACHE.put(cacheKey, payload, { expirationTtl: 300 });
    }

    return new Response(payload, { headers: CORS });
  }

  // ── POST ─────────────────────────────────────────────────────────────────
  if (request.method === 'POST') {
    const session = await getSession(request, env);
    if (!session || !['admin', 'sppg'].includes(session.role)) {
      return jsonRes({ status: 'error', message: 'Hanya SPPG/admin yang bisa input menu.' }, 403);
    }

    const body = await request.json().catch(() => null);
    if (!body?.school_target || !body?.menu_title || !body?.menu_date) {
      return jsonRes({ status: 'error', message: 'school_target, menu_title, menu_date wajib diisi.' }, 400);
    }

    if (body.menu_date < todayWIB()) {
      return jsonRes({
        status: 'error',
        message: `Tanggal ${body.menu_date} sudah lewat. Data lama otomatis diarsip ke backup.`
      }, 400);
    }

    try {
      await dbQuery(db, `
        INSERT INTO menu_harian (
          sppg_id, sppg_name, school_target, city, menu_title, menu_date,
          protein_g, karbohidrat_g, lemak_g, kalori_kkal, catatan,
          submitted_by, submitted_role
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (sppg_id, school_target, menu_date)
        DO UPDATE SET
          menu_title = EXCLUDED.menu_title,
          protein_g = EXCLUDED.protein_g,
          karbohidrat_g = EXCLUDED.karbohidrat_g,
          lemak_g = EXCLUDED.lemak_g,
          kalori_kkal = EXCLUDED.kalori_kkal,
          catatan = EXCLUDED.catatan,
          updated_at = NOW()
      `, [
        session.username || session.name,
        body.sppg_name || session.name,
        body.school_target,
        body.city || '',
        body.menu_title,
        body.menu_date,
        body.protein_g || null,
        body.karbohidrat_g || null,
        body.lemak_g || null,
        body.kalori_kkal || null,
        body.catatan || null,
        session.name,
        session.role
      ]);

      if (env.MENU_CACHE) await env.MENU_CACHE.delete(`menu_${todayWIB()}`);
      return jsonRes({ status: 'success', message: 'Menu berhasil disimpan.' });
    } catch (err) {
      return jsonRes({ status: 'error', message: err.message }, 500);
    }
  }

  return jsonRes({ status: 'error', message: 'Method tidak diizinkan.' }, 405);
}
