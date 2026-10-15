/**
 * Cloudflare Pages Function
 * Route: POST /api/menu/cron
 * Dipanggil oleh Cloudflare Worker cron trigger setiap hari 00:05 WIB
 * Menjalankan archive_yesterday_menu() di Neon PostgreSQL
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  // Validasi cron secret supaya tidak bisa dipanggil sembarang orang
  const secret = request.headers.get('X-Cron-Secret');
  if (!secret || secret !== env.CRON_SECRET) {
    return new Response(JSON.stringify({ status: 'error', message: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const result = await runArchive(env.DATABASE_URL);
    return new Response(JSON.stringify({
      status: 'success',
      archived_count: result.archived_count,
      archive_date: result.archive_date,
      executed_at: new Date().toISOString()
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({
      status: 'error',
      message: err.message
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

async function runArchive(databaseUrl) {
  // Neon PostgreSQL serverless HTTP driver
  const match = databaseUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^/]+)\/([^?]+)/);
  if (!match) throw new Error('DATABASE_URL format tidak valid');

  const [, user, password, host, database] = match;

  const res = await fetch(`https://${host}/sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + btoa(`${user}:${password}`)
    },
    body: JSON.stringify({
      query: 'SELECT * FROM archive_yesterday_menu()',
      params: []
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DB query gagal: ${err}`);
  }

  const data = await res.json();
  const row = data.rows?.[0];
  return {
    archived_count: row?.archived_count ?? 0,
    archive_date: row?.archive_date ?? null
  };
}
