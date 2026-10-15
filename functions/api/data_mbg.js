/**
 * Cloudflare Pages Function
 * Route: GET /api/data_mbg
 * Menggantikan: api/data_mbg.php
 * Menyediakan data penerima MBG per jenjang pendidikan
 */

import { CORS, json, dbQuery } from './_shared.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url     = new URL(request.url);
  const jenjang = url.searchParams.get('jenjang') || '';
  const provinsi= url.searchParams.get('provinsi') || '';

  try {
    let sql = `SELECT jenjang, nama_instansi, provinsi, kota, target_porsi,
                      total_siswa, sppg_id, nama_sppg, status, updated_at
               FROM data_penerima_mbg WHERE 1=1`;
    const params = [];
    let i = 1;
    if (jenjang) { sql += ` AND jenjang = $${i++}`; params.push(jenjang); }
    if (provinsi) { sql += ` AND provinsi ILIKE $${i++}`; params.push(`%${provinsi}%`); }
    sql += ` ORDER BY provinsi, nama_instansi LIMIT 500`;

    const result = await dbQuery(env.DATABASE_URL, sql, params);
    return json({ status: 'success', count: result.rows?.length || 0, data: result.rows || [] });
  } catch (err) {
    return json({ status: 'error', message: err.message }, 500);
  }
}
