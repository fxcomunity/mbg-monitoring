/**
 * Cloudflare Pages Function
 * Route: GET /api/tiket?tiket=TKT-xxx
 * Menggantikan: api/tiket.php
 */

import { CORS, json, dbQuery } from './_shared.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url    = new URL(request.url);
  const tiket  = (url.searchParams.get('tiket') || url.searchParams.get('ticket') || '').trim().toUpperCase();

  if (!tiket) return json({ status: 'error', message: 'Nomor tiket wajib disertakan.' });

  try {
    const result = await dbQuery(env.DATABASE_URL,
      `SELECT id, ticket_code, reporter_name, reporter_role, issue_category,
              school_target, incident_date, description, status, priority,
              satgas_notes, created_at
       FROM laporan_aduan WHERE ticket_code = $1`,
      [tiket]
    );

    const row = result.rows?.[0];
    if (!row) return json({ status: 'not_found', message: 'Nomor tiket tidak ditemukan dalam database resmi.' });

    return json({
      status: 'success',
      data: {
        nomor_tiket:    row.ticket_code,
        kategori:       row.issue_category,
        target_sekolah: row.school_target,
        status:         row.status,
        priority:       row.priority,
        tanggal_lapor:  row.created_at,
        nama_pelapor:   row.reporter_name,
        deskripsi:      row.description,
        catatan_satgas: row.satgas_notes || 'Dalam proses peninjauan Satgas BGN'
      }
    });
  } catch (err) {
    return json({ status: 'error', message: 'Terjadi kesalahan sistem internal.' }, 500);
  }
}
