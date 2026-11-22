/**
 * Cloudflare Pages Function
 * Route: GET /api/data_mbg
 * Menggantikan: api/data_mbg.php
 * Menyediakan data penerima MBG per jenjang pendidikan
 *
 * GET ?level=SD        → Filter by education level
 * GET ?province=020000 → Filter by province code
 * GET ?regency=020800  → Filter by regency code
 * GET ?summary=1       → Summary per level (aggregate)
 * GET (no params)      → Rows dari data_penerima_mbg
 */

import { CORS, json, dbQuery } from './_shared.js';

const LEVELS = ['PAUD', 'SD', 'SMP', 'SMA', 'SMK', 'SLB', 'SKB', 'PKBM'];

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const level    = (url.searchParams.get('level') || '').toUpperCase().slice(0, 10);
  const province = (url.searchParams.get('province') || '').replace(/[^0-9]/g, '').slice(0, 10);
  const regency  = (url.searchParams.get('regency') || '').replace(/[^0-9]/g, '').slice(0, 10);
  const summary  = url.searchParams.get('summary') === '1';

  try {
    if (summary) {
      const rows = await dbQuery(env.DATABASE_URL, `
        SELECT level,
               COUNT(*) AS total_rows,
               SUM(education_units) AS total_satpen,
               SUM(beneficiaries) AS total_penerima,
               SUM(male_students) AS total_laki,
               SUM(female_students) AS total_perempuan,
               SUM(allergies) AS total_alergi,
               SUM(phobias) AS total_fobia,
               SUM(intolerances) AS total_intoleransi,
               SUM(special_conditions) AS total_kondisi_khusus,
               SUM(public_units) AS total_negeri,
               SUM(private_units) AS total_swasta
        FROM data_penerima_mbg
        WHERE regency_code IS NULL AND district_code IS NULL
        GROUP BY level
        ORDER BY total_penerima DESC
      `);
      return json({ status: 'ok', source: 'BGN Pusat (bgnpusat.org)', year: 2026, data: rows });
    }

    const where = [];
    const params = [];
    let i = 1;
    if (level && LEVELS.includes(level)) { where.push(`level = $${i++}`); params.push(level); }
    if (province) { where.push(`province_code = $${i++}`); params.push(province); }
    if (regency)  { where.push(`regency_code = $${i++}`);  params.push(regency); }

    const rows = await dbQuery(env.DATABASE_URL,
      `SELECT * FROM data_penerima_mbg${where.length ? ' WHERE ' + where.join(' AND ') : ''}
       ORDER BY beneficiaries DESC LIMIT 500`, params);

    return json({ status: 'ok', source: 'BGN Pusat (bgnpusat.org)', year: 2026, count: rows.length, data: rows });
  } catch (err) {
    return json({ status: 'error', message: 'Gagal mengambil data MBG.' }, 500);
  }
}
