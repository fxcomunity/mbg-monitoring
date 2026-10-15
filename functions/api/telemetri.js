/**
 * Cloudflare Pages Function
 * Route: GET/POST /api/telemetri
 * Menggantikan: api/telemetri.php
 */

import { CORS, json, dbQuery, getSession } from './_shared.js';

const DEFAULTS = {
  porsi_tersalurkan: 4850210, persen_target: 99.20,
  sppg_aktif: 1284, sekolah_terlayani: 18420,
  kepatuhan_akg: 99.60, suhu_rata_rata: 65.8,
  sla_distribusi: 99.80, pembaruan_teks: 'Hari ini, Pukul 11.45 WIB'
};

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const db = env.DATABASE_URL;

  // GET: baca data telemetri
  if (request.method === 'GET') {
    try {
      const result = await dbQuery(db,
        `SELECT porsi_tersalurkan, persen_target, sppg_aktif, sekolah_terlayani,
                kepatuhan_akg, suhu_rata_rata, sla_distribusi, pembaruan_teks, updated_at
         FROM telemetri_nasional ORDER BY id DESC LIMIT 1`
      );
      const row = result.rows?.[0] || DEFAULTS;
      return json({
        status: 'success',
        timestamp: new Date().toISOString(),
        data: {
          porsi_tersalurkan: parseInt(row.porsi_tersalurkan),
          persen_target:     parseFloat(row.persen_target),
          sppg_aktif:        parseInt(row.sppg_aktif),
          sekolah_terlayani: parseInt(row.sekolah_terlayani),
          kepatuhan_akg:     parseFloat(row.kepatuhan_akg),
          suhu_rata_rata:    parseFloat(row.suhu_rata_rata),
          sla_distribusi:    parseFloat(row.sla_distribusi),
          pembaruan_teks:    row.pembaruan_teks,
          updated_at:        row.updated_at || new Date().toISOString()
        }
      });
    } catch (err) {
      return json({ status: 'success', timestamp: new Date().toISOString(), data: DEFAULTS });
    }
  }

  // POST: update telemetri (admin only)
  if (request.method === 'POST') {
    const session = await getSession(request, env);
    if (!session || session.role !== 'admin') return json({ status: 'error', message: 'Hanya admin.' }, 403);

    const body = await request.json().catch(() => null);
    if (!body) return json({ status: 'error', message: 'Payload tidak valid.' }, 400);

    try {
      await dbQuery(db,
        `INSERT INTO telemetri_nasional
           (porsi_tersalurkan, persen_target, sppg_aktif, sekolah_terlayani,
            kepatuhan_akg, suhu_rata_rata, sla_distribusi, pembaruan_teks, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
        [
          body.porsi_tersalurkan, body.persen_target, body.sppg_aktif,
          body.sekolah_terlayani, body.kepatuhan_akg, body.suhu_rata_rata,
          body.sla_distribusi, body.pembaruan_teks
        ]
      );
      return json({ status: 'success', message: 'Data telemetri diperbarui.' });
    } catch (err) {
      return json({ status: 'error', message: err.message }, 500);
    }
  }

  return json({ status: 'error', message: 'Method tidak diizinkan.' }, 405);
}
