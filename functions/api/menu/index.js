/**
 * Cloudflare Pages Function
 * Route: GET/POST /api/menu
 * 
 * GET  /api/menu              → menu hari ini (dari Neon view menu_hari_ini)
 * GET  /api/menu?date=YYYY-MM-DD → menu tanggal lama (dari menu_backup)
 * POST /api/menu              → tambah menu baru (sppg/admin only)
 */
import { dbQuery, getSession } from '../_shared.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Requested-By',
  'Content-Type': 'application/json'
};

function jsonRes(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

// Tanggal hari ini dalam WIB (UTC+7)
function todayWIB() {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  const db = env.DATABASE_URL;

  if (!db) return jsonRes({ status: 'error', message: 'DATABASE_URL tidak terkonfigurasi' }, 500);

  // ── GET ──────────────────────────────────────────────────────────────────
  if (request.method === 'GET') {
    const allSchools = url.searchParams.has('all_schools') || url.searchParams.has('list_all');
    const schoolKey = url.searchParams.get('school_key');

    // Handle all_schools request from menu-hari-ini.html
    if (allSchools) {
      try {
        const harianRes = await dbQuery(db, `
          SELECT DISTINCT ON (i.id_instansi)
                 m.*, i.nama_instansi, i.kode_prov_dagri, p.nama_provinsi, i.kode_kabko_dagri, k.nama_kabko,
                 i.kode_kec_dagri, kc.nama_kecamatan, s.nama AS nama_sppg, s.alamat,
                 g.energi_kkal, g.protein_g, g.lemak_g, g.karbohidrat_g, g.serat_g, gm.gambar_url
          FROM menu_harian m
          JOIN instansi i ON m.id_instansi = i.id_instansi
          LEFT JOIN provinsi p ON i.kode_prov_dagri = p.kode_prov_dagri
          LEFT JOIN kabupaten_kota k ON i.kode_kabko_dagri = k.kode_kabko_dagri
          LEFT JOIN kecamatan kc ON i.kode_kec_dagri = kc.kode_kec_dagri
          LEFT JOIN sppg s ON i.id_sppg = s.id::text
          LEFT JOIN gizi_menu g ON m.id_menu = g.id_menu
          LEFT JOIN gambar_menu gm ON m.id_menu = gm.id_menu
          ORDER BY i.id_instansi, m.tanggal_menu DESC
        `);

        const sppgRes = await dbQuery(db, `
          SELECT DISTINCT ON (school_key) * FROM menu_sppg 
          ORDER BY school_key, menu_date DESC, id DESC
        `);

        const kabRes = await dbQuery(db, `SELECT kode_prov_dagri, kode_kabko_dagri, nama_kabko FROM kabupaten_kota ORDER BY nama_kabko ASC`);

        const schoolsMap = {};
        const regionCascade = {};

        const parseList = (str) => {
          if (!str) return [];
          return [...new Set(str.split(/[;+]/).map(s => s.trim()).filter(Boolean))];
        };

        const detectJenjang = (n) => {
          const u = (n || '').toUpperCase();
          if (u.includes('KB') || u.includes('PAUD') || u.includes('TK')) return 'paud';
          if (u.includes('SMP') || u.includes('MTS')) return 'smp';
          if (u.includes('SMA') || u.includes('SMK') || u.includes('MA')) return 'sma';
          return 'sd';
        };

        for (const rh of (harianRes.rows || [])) {
          const key = rh.id_instansi;
          const kList = parseList(rh.komposisi || rh.nama_menu);
          schoolsMap[key] = {
            key,
            name: rh.nama_instansi,
            provinsi: rh.kode_prov_dagri,
            provinsiName: rh.nama_provinsi,
            kota: rh.kode_kabko_dagri,
            kotaName: rh.nama_kabko,
            kecamatan: rh.nama_kecamatan,
            jenjang: detectJenjang(rh.nama_instansi),
            ageGroup: null,
            arrival: null,
            cycle: `Siklus Menu: Tanggal ${rh.tanggal_menu || 'Hari Ini'}`,
            packageName: rh.nama_menu,
            desc: `Komposisi resmi: ${rh.komposisi || rh.nama_menu}`,
            calories: rh.energi_kkal ? Math.round(Number(rh.energi_kkal)) : null,
            protein: rh.protein_g,
            lemak: rh.lemak_g,
            karbohidrat: rh.karbohidrat_g,
            serat: rh.serat_g,
            porsi: rh.porsi,
            komposisiList: kList,
            photo: rh.gambar_url || null,
            sppg: {
              name: rh.nama_sppg,
              address: rh.alamat
            }
          };

          const pCode = rh.kode_prov_dagri;
          if (!regionCascade[pCode]) {
            regionCascade[pCode] = { name: rh.nama_provinsi, cities: [] };
          }
          if (!regionCascade[pCode].cities.some(c => c.id === rh.kode_kabko_dagri)) {
            regionCascade[pCode].cities.push({ id: rh.kode_kabko_dagri, name: rh.nama_kabko });
          }
        }

        for (const r of (sppgRes.rows || [])) {
          const key = r.school_key || `sch-${r.id}`;
          if (schoolsMap[key]) continue;
          schoolsMap[key] = {
            key,
            name: r.school_target,
            provinsi: r.province_code,
            provinsiName: r.province_name,
            kota: r.city_code,
            kotaName: r.city,
            kecamatan: r.kecamatan,
            jenjang: r.jenjang,
            ageGroup: r.age_group,
            arrival: r.arrival_status,
            cycle: r.menu_cycle,
            packageName: r.menu_title,
            desc: r.description,
            calories: r.calories ? Number(r.calories) : null,
            protein: null,
            lemak: null,
            karbohidrat: null,
            serat: null,
            komposisiList: parseList(`${r.menu_title}; ${r.description || ''}`),
            photo: r.photo_url,
            sppg: {
              name: r.sppg_name,
              address: r.sppg_address,
              radius: r.sppg_radius,
              dietitian: r.dietitian,
              dietitianTitle: r.dietitian_title,
              lab: r.lab_test_cert,
              temp: r.temperature !== null ? `${r.temperature}°C` : null
            }
          };

          const pCode = r.province_code;
          if (!regionCascade[pCode]) {
            regionCascade[pCode] = { name: r.province_name, cities: [] };
          }
          if (!regionCascade[pCode].cities.some(c => c.id === r.city_code)) {
            regionCascade[pCode].cities.push({ id: r.city_code, name: r.city });
          }
        }

        for (const kab of (kabRes.rows || [])) {
          if (regionCascade[kab.kode_prov_dagri]) {
            if (!regionCascade[kab.kode_prov_dagri].cities.some(c => c.id === kab.kode_kabko_dagri)) {
              regionCascade[kab.kode_prov_dagri].cities.push({ id: kab.kode_kabko_dagri, name: kab.nama_kabko });
            }
          }
        }

        return jsonRes({
          status: 'success',
          source: 'postgresql_neon',
          today_date: todayWIB(),
          total_schools: Object.keys(schoolsMap).length,
          schools: schoolsMap,
          region_cascade: regionCascade
        });
      } catch (err) {
        return jsonRes({ status: 'error', message: err.message }, 500);
      }
    }

    if (schoolKey) {
      try {
        const singleRes = await dbQuery(db, `
          SELECT * FROM menu_sppg 
          WHERE (school_key = $1 OR LOWER(school_target) = LOWER($2))
          ORDER BY menu_date DESC LIMIT 1
        `, [schoolKey, schoolKey]);
        if (singleRes.rows?.length > 0) {
          const r = singleRes.rows[0];
          return jsonRes({
            status: 'success',
            data: {
              key: r.school_key,
              name: r.school_target,
              provinsi: r.province_code,
              provinsiName: r.province_name,
              kota: r.city_code,
              kotaName: r.city,
              kecamatan: r.kecamatan,
              jenjang: r.jenjang,
              ageGroup: r.age_group,
              arrival: r.arrival_status,
              cycle: r.menu_cycle,
              packageName: r.menu_title,
              desc: r.description,
              calories: r.calories ? Number(r.calories) : null,
              photo: r.photo_url,
              sppg: {
                name: r.sppg_name,
                address: r.sppg_address,
                radius: r.sppg_radius,
                dietitian: r.dietitian,
                dietitianTitle: r.dietitian_title,
                lab: r.lab_test_cert,
                temp: r.temperature !== null ? `${r.temperature}°C` : null
              }
            }
          });
        }
      } catch (err) {
        return jsonRes({ status: 'error', message: err.message }, 500);
      }
    }

    const targetDate = date || todayWIB();
    const isToday = targetDate === todayWIB();

    // Cek cache
    const cacheKey = `menu_${targetDate}`;
    if (env.MENU_CACHE) {
      const cached = await env.MENU_CACHE.get(cacheKey);
      if (cached) return new Response(cached, { headers: { ...CORS, 'X-Cache': 'HIT' } });
    }

    let result;
    try {
      if (isToday) {
        result = await dbQuery(db, `SELECT * FROM menu_hari_ini`);
      } else {
        result = await dbQuery(db,
          `SELECT * FROM menu_backup WHERE menu_date = $1 ORDER BY sppg_name`,
          [targetDate]
        );
      }
    } catch (err) {
      return jsonRes({ status: 'error', message: err.message }, 500);
    }

    const payload = JSON.stringify({
      status: 'success',
      date: targetDate,
      data: result.rows || []
    });

    // Cache 5 menit
    if (env.MENU_CACHE) {
      await env.MENU_CACHE.put(cacheKey, payload, { expirationTtl: 300 });
    }

    return new Response(payload, { headers: CORS });
  }

  // ── POST ─────────────────────────────────────────────────────────────────
  if (request.method === 'POST') {
    const session = await getSession(request, env);
    if (!session || !['admin', 'sppg'].includes(session.role)) {
      return jsonRes({ status: 'error', message: 'Hanya SPPG/admin yang bisa input menu.' }, 403);
    }

    const body = await request.json().catch(() => null);
    if (!body?.school_target || !body?.menu_title || !body?.menu_date) {
      return jsonRes({ status: 'error', message: 'school_target, menu_title, menu_date wajib diisi.' }, 400);
    }

    if (body.menu_date < todayWIB()) {
      return jsonRes({
        status: 'error',
        message: `Tanggal ${body.menu_date} sudah lewat. Data lama otomatis diarsip ke backup.`
      }, 400);
    }

    try {
      await dbQuery(db, `
        INSERT INTO menu_harian (
          sppg_id, sppg_name, school_target, city, menu_title, menu_date,
          protein_g, karbohidrat_g, lemak_g, kalori_kkal, catatan,
          submitted_by, submitted_role
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (sppg_id, school_target, menu_date)
        DO UPDATE SET
          menu_title = EXCLUDED.menu_title,
          protein_g = EXCLUDED.protein_g,
          karbohidrat_g = EXCLUDED.karbohidrat_g,
          lemak_g = EXCLUDED.lemak_g,
          kalori_kkal = EXCLUDED.kalori_kkal,
          catatan = EXCLUDED.catatan,
          updated_at = NOW()
      `, [
        session.username || session.name,
        body.sppg_name || session.name,
        body.school_target,
        body.city || '',
        body.menu_title,
        body.menu_date,
        body.protein_g || null,
        body.karbohidrat_g || null,
        body.lemak_g || null,
        body.kalori_kkal || null,
        body.catatan || null,
        session.name,
        session.role
      ]);

      if (env.MENU_CACHE) await env.MENU_CACHE.delete(`menu_${todayWIB()}`);
      return jsonRes({ status: 'success', message: 'Menu berhasil disimpan.' });
    } catch (err) {
      return jsonRes({ status: 'error', message: err.message }, 500);
    }
  }

  return jsonRes({ status: 'error', message: 'Method tidak diizinkan.' }, 405);
}
