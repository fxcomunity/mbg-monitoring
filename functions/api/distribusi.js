/**
 * Cloudflare Pages Function
 * Route: GET/POST /api/distribusi
 * Menggantikan: api/distribusi.php
 */

import { CORS, json, dbQuery, getSession } from './_shared.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const db = env.DATABASE_URL;
  const url = new URL(request.url);
  const region = url.searchParams.get('region') || '';

  if (request.method === 'GET') {
    try {
      let sql = `SELECT provinsi, target_porsi, ketepatan, status, region_code, updated_at
                 FROM distribusi_provinsi`;
      const params = [];
      if (region && region !== 'semua') {
        sql += ` WHERE region_code = $1`;
        params.push(region);
      }
      sql += ` ORDER BY target_porsi DESC`;

      const result = await dbQuery(db, sql, params);
      const data = (result.rows || []).map(r => ({
        provinsi:     r.provinsi,
        target_porsi: parseInt(r.target_porsi),
        ketepatan:    parseFloat(r.ketepatan),
        status:       r.status,
        region_code:  r.region_code
      }));
      return json({ status: 'success', count: data.length, timestamp: new Date().toISOString(), data });
    } catch (err) {
      return json({ status: 'error', message: err.message }, 500);
    }
  }

  if (request.method === 'POST') {
    const session = await getSession(request, env);
    if (!session || session.role !== 'admin') return json({ status: 'error', message: 'Hanya admin.' }, 403);

    const body = await request.json().catch(() => null);
    if (!body?.provinsi) return json({ status: 'error', message: 'Field provinsi wajib.' }, 400);

    try {
      await dbQuery(db,
        `INSERT INTO distribusi_provinsi (provinsi, target_porsi, ketepatan, status, region_code, updated_at)
         VALUES ($1,$2,$3,$4,$5,NOW())
         ON CONFLICT (provinsi) DO UPDATE SET
           target_porsi = EXCLUDED.target_porsi,
           ketepatan    = EXCLUDED.ketepatan,
           status       = EXCLUDED.status,
           updated_at   = NOW()`,
        [body.provinsi, body.target_porsi, body.ketepatan, body.status, body.region_code || null]
      );
      return json({ status: 'success', message: 'Data distribusi disimpan.' });
    } catch (err) {
      return json({ status: 'error', message: err.message }, 500);
    }
  }

  return json({ status: 'error', message: 'Method tidak diizinkan.' }, 405);
}
