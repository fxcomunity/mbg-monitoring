/**
 * Cloudflare Pages Function
 * Route: GET /api/sppg_qr?id=<sppg_id>
 * Generate data QR code untuk verifikasi SPPG
 */

import { CORS, json, dbQuery } from './_shared.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (request.method !== 'GET') return json({ status: 'error', message: 'Method tidak diizinkan.' }, 405);

  const url = new URL(request.url);
  const sppgId = url.searchParams.get('id');

  if (!sppgId) {
    return json({ status: 'error', message: 'Parameter id wajib.' }, 400);
  }

  try {
    const result = await dbQuery(env.DATABASE_URL,
      `SELECT id, nama, provinsi, kabupaten_kota, kecamatan, kelurahan_desa,
              alamat, nama_yayasan, status, data_bulan, latitude, longitude,
              created_at, updated_at, kepatuhan_score, total_antaran,
              masalah_terakhir, tanggal_terakhir_antaran, status_verifikasi
       FROM sppg
       WHERE id = $1`,
      [parseInt(sppgId)]
    );

    if (!result.rows || result.rows.length === 0) {
      return json({ status: 'error', message: 'SPPG tidak ditemukan.' }, 404);
    }

    const sppg = result.rows[0];

    // Data untuk QR code (JSON string yang bisa di-scan)
    const qrData = {
      id: sppg.id,
      nama: sppg.nama,
      provinsi: sppg.provinsi,
      kabupaten_kota: sppg.kabupaten_kota,
      kecamatan: sppg.kecamatan,
      kelurahan_desa: sppg.kelurahan_desa,
      alamat: sppg.alamat,
      nama_yayasan: sppg.nama_yayasan,
      status: sppg.status,
      data_bulan: sppg.data_bulan,
      kepatuhan_score: parseInt(sppg.kepatuhan_score) || 0,
      total_antaran: parseInt(sppg.total_antaran) || 0,
      masalah_terakhir: sppg.masalah_terakhir,
      tanggal_terakhir_antaran: sppg.tanggal_terakhir_antaran,
      status_verifikasi: sppg.status_verifikasi,
      koordinat: sppg.latitude && sppg.longitude ? {
        lat: parseFloat(sppg.latitude),
        lng: parseFloat(sppg.longitude)
      } : null,
      verified_at: new Date().toISOString(),
      verification_url: `${url.origin}/verify-sppg.html?id=${sppg.id}`
    };

    return json({
      status: 'success',
      sppg: qrData,
      qr_content: JSON.stringify(qrData)
    });
  } catch (err) {
    return json({ status: 'error', message: err.message }, 500);
  }
}
