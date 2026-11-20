import { json, dbQuery, getSession } from '../_shared.js';

async function requireAdmin(request, env) {
  const session = await getSession(request, env);
  return session?.role === 'admin';
}

export async function onRequestGet({ request, env }) {
  if (!env.DATABASE_URL) return json({ status: 'error', message: 'Database belum dikonfigurasi.' }, 500);

  try {
    if (!await requireAdmin(request, env)) {
      return json({ status: 'error', message: 'Hanya admin yang dapat mengakses backup.' }, 403);
    }

    const url = new URL(request.url);
    const date = url.searchParams.get('date');
    let result;
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return json({ status: 'error', message: 'Format tanggal backup tidak valid.' }, 400);
      }
      result = await dbQuery(env.DATABASE_URL,
        `SELECT * FROM menu_backup WHERE menu_date = $1 ORDER BY sppg_name, school_target LIMIT 10000`,
        [date]
      );
    } else if (url.searchParams.get('export') === '1') {
      result = await dbQuery(env.DATABASE_URL,
        `SELECT * FROM menu_backup ORDER BY menu_date DESC, sppg_name, school_target LIMIT 20000`
      );
    } else {
      result = await dbQuery(env.DATABASE_URL, `SELECT * FROM menu_backup_summary LIMIT 90`);
    }
    return json({ status: 'success', data: result.rows || [] });
  } catch (error) {
    console.error('Menu backup read failed:', error);
    return json({ status: 'error', message: 'Data backup gagal dimuat dari database.' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.DATABASE_URL) return json({ status: 'error', message: 'Database belum dikonfigurasi.' }, 500);

  try {
    if (!await requireAdmin(request, env)) {
      return json({ status: 'error', message: 'Hanya admin yang dapat menjalankan backup.' }, 403);
    }

    const result = await dbQuery(env.DATABASE_URL, 'SELECT * FROM archive_yesterday_menu()');
    const row = result.rows?.[0] || {};
    return json({
      status: 'success',
      archived_count: Number(row.archived_count) || 0,
      archive_date: row.archive_date || null,
      executed_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Manual menu backup failed:', error);
    return json({ status: 'error', message: 'Arsip menu gagal dijalankan. Periksa konfigurasi database.' }, 500);
  }
}
