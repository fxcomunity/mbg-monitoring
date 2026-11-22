/**
 * Cloudflare Pages Function
 * Route: GET /api/sppg_search?q=<query>
 * Search SPPG berdasarkan nama, ID, atau alamat
 */

import { CORS, json, dbQuery } from './_shared.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (request.method !== 'GET') return json({ status: 'error', message: 'Method tidak diizinkan.' }, 405);

  const url = new URL(request.url);
  const query = (url.searchParams.get('q') || '').trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 10, 1), 50);

  if (query.length < 2) {
    return json({ status: 'success', count: 0, query, data: [] });
  }

  try {
    const searchTerm = `%${query}%`;
    const result = await dbQuery(env.DATABASE_URL,
      `SELECT id, nama, provinsi, kabupaten_kota, alamat, nama_yayasan,
              status, data_bulan, latitude, longitude,
              kepatuhan_score, total_antaran, masalah_terakhir,
              tanggal_terakhir_antaran, status_verifikasi
       FROM sppg
       WHERE id::text = $1
          OR nama ILIKE $2
          OR alamat ILIKE $3
          OR provinsi ILIKE $4
          OR kabupaten_kota ILIKE $5
       ORDER BY
         CASE WHEN id::text = $1 THEN 0 ELSE 1 END,
         nama ASC
       LIMIT $6`,
      [query, searchTerm, searchTerm, searchTerm, searchTerm, limit]
    );

    const data = (result.rows || []).map(row => ({
      id: parseInt(row.id),
      nama: row.nama,
      provinsi: row.provinsi,
      kabupaten_kota: row.kabupaten_kota,
      alamat: row.alamat,
      nama_yayasan: row.nama_yayasan,
      status: row.status,
      data_bulan: row.data_bulan,
      kepatuhan_score: parseInt(row.kepatuhan_score) || 0,
      total_antaran: parseInt(row.total_antaran) || 0,
      masalah_terakhir: row.masalah_terakhir,
      tanggal_terakhir_antaran: row.tanggal_terakhir_antaran,
      status_verifikasi: row.status_verifikasi,
      has_gps: (row.latitude && row.longitude) ? true : false
    }));

    return json({
      status: 'success',
      count: data.length,
      query,
      data
    });
  } catch (err) {
    return json({ status: 'error', message: err.message }, 500);
  }
}
