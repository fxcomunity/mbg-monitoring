/**
 * Cloudflare Worker — Menu Harian API + Cron Backup Otomatis
 * 
 * Routes:
 *   GET  /api/menu              → ambil menu hari ini (dari menu_harian WHERE menu_date = today)
 *   GET  /api/menu?date=YYYY-MM-DD → menu tanggal tertentu (dari backup jika bukan hari ini)
 *   POST /api/menu              → tambah/update menu (sppg/admin only)
 *   GET  /api/menu/backup       → list tanggal backup tersedia (admin only)
 *   GET  /api/menu/backup?date=YYYY-MM-DD → data backup tanggal tertentu (admin only)
 * 
 * Cron Trigger:
 *   Setiap hari jam 00:05 WIB (17:05 UTC)
 *   → panggil archive_yesterday_menu() di Neon PostgreSQL
 *   → semua menu_date < CURRENT_DATE dipindah ke menu_backup
 * 
 * Env bindings (di wrangler.toml):
 *   DATABASE_URL  — Neon PostgreSQL connection string
 *   SESSIONS      — KV namespace (shared dengan auth.js)
 *   MENU_CACHE    — KV namespace (cache menu hari ini, TTL 5 menit)
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Requested-By',
  'Content-Type': 'application/json'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

// ─── Neon PostgreSQL query via HTTP API ───────────────────────────────────
// Neon mendukung serverless HTTP query tanpa persistent connection
async function dbQuery(env, sql, params = []) {
  const url = env.DATABASE_URL; // format: postgresql://user:pass@host/dbname
  
  // Parse Neon connection string untuk HTTP endpoint
  const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^/]+)\/(.+)/);
  if (!match) throw new Error('DATABASE_URL format salah');
  
  const [, user, password, host, database] = match;
  const neonHttpUrl = `https://${host}/sql`;
  
  const res = await fetch(neonHttpUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + btoa(`${user}:${password}`)
    },
    body: JSON.stringify({ query: sql, params })
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DB error ${res.status}: ${err}`);
  }
  
  return res.json();
}

// ─── Auth helper ──────────────────────────────────────────────────────────
async function getSession(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/mbg_token=([a-f0-9]{64})/);
  if (!match) return null;
  const data = await env.SESSIONS.get(match[1]);
  return data ? JSON.parse(data) : null;
}

// ─── Tanggal hari ini dalam WIB (UTC+7) ──────────────────────────────────
function todayWIB() {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

// ─── Fetch handler ────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    // Anti-scraping
    if (!request.headers.get('X-Requested-By') && request.method === 'POST') {
      return json({ status: 'error', message: 'Akses tidak diizinkan.' }, 403);
    }

    const url   = new URL(request.url);
    const path  = url.pathname;
    const date  = url.searchParams.get('date');

    // ── GET /api/menu/backup ─────────────────────────────────────────────
    if (request.method === 'GET' && path.endsWith('/backup')) {
      const session = await getSession(request, env);
      if (!session || session.role !== 'admin') {
        return json({ status: 'error', message: 'Hanya admin yang bisa akses backup.' }, 403);
      }

      if (date) {
        // Backup tanggal tertentu
        const result = await dbQuery(env,
          `SELECT * FROM menu_backup WHERE menu_date = $1 ORDER BY sppg_name, school_target`,
          [date]
        );
        return json({ status: 'success', date, data: result.rows || [] });
      }

      // Ringkasan semua backup
      const result = await dbQuery(env,
        `SELECT * FROM menu_backup_summary LIMIT 90`
      );
      return json({ status: 'success', data: result.rows || [] });
    }

    // ── GET /api/menu ────────────────────────────────────────────────────
    if (request.method === 'GET') {
      const targetDate = date || todayWIB();
      const isToday    = targetDate === todayWIB();

      // Cek cache KV untuk hari ini
      if (isToday && env.MENU_CACHE) {
        const cached = await env.MENU_CACHE.get('menu_today');
        if (cached) {
          return new Response(cached, {
            headers: { ...CORS, 'X-Cache': 'HIT' }
          });
        }
      }

      let result;
      if (isToday) {
        // Dari view menu_hari_ini (hanya hari ini, status aktif)
        result = await dbQuery(env, `SELECT * FROM menu_hari_ini`);
      } else {
        // Dari backup jika tanggal lama
        result = await dbQuery(env,
          `SELECT * FROM menu_backup WHERE menu_date = $1 ORDER BY sppg_name`,
          [targetDate]
        );
      }

      const rows = result.rows || [];
      const payload = JSON.stringify({ status: 'success', date: targetDate, data: rows });

      // Cache menu hari ini selama 5 menit
      if (isToday && env.MENU_CACHE) {
        await env.MENU_CACHE.put('menu_today', payload, { expirationTtl: 300 });
      }

      return new Response(payload, { headers: CORS });
    }

    // ── POST /api/menu — tambah/update menu ──────────────────────────────
    if (request.method === 'POST') {
      const session = await getSession(request, env);
      if (!session || !['admin', 'sppg'].includes(session.role)) {
        return json({ status: 'error', message: 'Hanya SPPG/admin yang bisa input menu.' }, 403);
      }

      const body = await request.json().catch(() => null);
      if (!body || !body.school_target || !body.menu_title || !body.menu_date) {
        return json({ status: 'error', message: 'Field school_target, menu_title, menu_date wajib diisi.' }, 400);
      }

      // Hanya boleh input untuk hari ini atau ke depan
      if (body.menu_date < todayWIB()) {
        return json({
          status: 'error',
          message: `Tanggal ${body.menu_date} sudah lewat. Data kemarin otomatis masuk arsip backup.`
        }, 400);
      }

      const result = await dbQuery(env, `
        INSERT INTO menu_harian (
          sppg_id, sppg_name, school_target, city, menu_title, menu_date,
          protein_g, karbohidrat_g, lemak_g, kalori_kkal, catatan,
          submitted_by, submitted_role
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (sppg_id, school_target, menu_date)
        DO UPDATE SET
          menu_title     = EXCLUDED.menu_title,
          protein_g      = EXCLUDED.protein_g,
          karbohidrat_g  = EXCLUDED.karbohidrat_g,
          lemak_g        = EXCLUDED.lemak_g,
          kalori_kkal    = EXCLUDED.kalori_kkal,
          catatan        = EXCLUDED.catatan,
          updated_at     = NOW()
        RETURNING id, menu_date
      `, [
        session.username || session.name,
        body.sppg_name   || session.name,
        body.school_target,
        body.city        || '',
        body.menu_title,
        body.menu_date,
        body.protein_g        || null,
        body.karbohidrat_g    || null,
        body.lemak_g          || null,
        body.kalori_kkal      || null,
        body.catatan          || null,
        session.name,
        session.role
      ]);

      // Invalidate cache
      if (env.MENU_CACHE) await env.MENU_CACHE.delete('menu_today');

      return json({
        status: 'success',
        message: 'Menu berhasil disimpan.',
        data: result.rows?.[0] || {}
      });
    }

    return json({ status: 'error', message: 'Endpoint tidak ditemukan.' }, 404);
  },

  // ── CRON: setiap hari jam 17:05 UTC = 00:05 WIB ──────────────────────
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runDailyArchive(env));
  }
};

// ─── Fungsi arsip harian ─────────────────────────────────────────────────
async function runDailyArchive(env) {
  try {
    // Panggil stored procedure archive_yesterday_menu()
    const result = await dbQuery(env,
      `SELECT * FROM archive_yesterday_menu()`
    );

    const row = result.rows?.[0];
    const count = row?.archived_count || 0;
    const date  = row?.archive_date   || null;

    // Invalidate menu cache
    if (env.MENU_CACHE) await env.MENU_CACHE.delete('menu_today');

    // Log ke KV untuk audit trail
    if (env.SESSIONS && count > 0) {
      const logKey = `archive_log:${new Date().toISOString().slice(0, 10)}`;
      await env.SESSIONS.put(logKey, JSON.stringify({
        archived_count : count,
        archive_date   : date,
        executed_at    : new Date().toISOString(),
        trigger        : 'cron_daily'
      }), { expirationTtl: 90 * 24 * 3600 }); // simpan 90 hari
    }

    console.log(`[CRON] Arsip selesai: ${count} menu tanggal ${date} dipindah ke backup.`);
  } catch (err) {
    console.error('[CRON] Arsip gagal:', err.message);
  }
}
