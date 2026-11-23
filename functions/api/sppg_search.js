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
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 10, 1), 50);
  const offset = (page - 1) * limit;

  if (query.length < 2) {
    return json({ status: 'success', count: 0, query, data: [], page: 1, total_pages: 0, total: 0 });
  }

  try {
    // "sppg jakarta" -> setiap kata harus cocok di salah satu kolom (urutan kata bebas)
    const tokens = query.split(/\s+/).filter(Boolean).slice(0, 5);
    const cols = ['nama', 'alamat', 'provinsi', 'kabupaten_kota', 'kecamatan'];
    const params = [];
    const conds = tokens.map(tok => {
      const like = '%' + tok.replace(/[\\%_]/g, '\\$&') + '%';
      return '(' + cols.map(c => { params.push(like); return `${c} ILIKE $${params.length}`; }).join(' OR ') + ')';
    });
    let where = conds.join(' AND ');
    if (/^\d+$/.test(query)) {
      params.push(query);
      where = `(id::text = $${params.length} OR (${where}))`;
    }

    const countResult = await dbQuery(env.DATABASE_URL,
      `SELECT COUNT(*)::int AS total FROM sppg WHERE ${where}`, params);
    const totalCount = countResult.rows[0]?.total || 0;
    const totalPages = Math.ceil(totalCount / limit);

    const n = params.length;
    const result = await dbQuery(env.DATABASE_URL,
      `SELECT id, nama, provinsi, kabupaten_kota, kecamatan, kelurahan_desa,
              alamat, nama_yayasan, status, data_bulan, latitude, longitude,
              kepatuhan_score, total_antaran, masalah_terakhir,
              tanggal_terakhir_antaran, status_verifikasi
       FROM sppg
       WHERE ${where}
       ORDER BY CASE WHEN id::text = $${n + 1} THEN 0 ELSE 1 END, nama ASC
       LIMIT $${n + 2} OFFSET $${n + 3}`,
      [...params, query, limit, offset]
    );

    const data = (result.rows || []).map(row => ({
      id: parseInt(row.id),
      nama: row.nama,
      provinsi: row.provinsi,
      kabupaten_kota: row.kabupaten_kota,
      kecamatan: row.kecamatan,
      kelurahan_desa: row.kelurahan_desa,
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
      data,
      page,
      limit,
      total: totalCount,
      total_pages: totalPages
    });
  } catch (err) {
    return json({ status: 'error', message: err.message }, 500);
  }
}