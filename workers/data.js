/**
 * Cloudflare Worker — Data API
 * Route: /api/data
 * Replaces: api/telemetri.php, api/distribusi.php, api/menu.php, api/data_mbg.php
 *
 * KV Bindings required:
 *   DATA     — stores telemetri, distribusi, menu data
 *   SESSIONS — shared with auth.js to validate admin sessions
 *
 * DATABASE_URL harus dikonfigurasi sebagai Wrangler secret:
 *   wrangler secret put DATABASE_URL --name mbg-monitoring-api
 */

import { neon } from '@neondatabase/serverless';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Requested-By',
  'Content-Type': 'application/json'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

async function getSession(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/mbg_token=([a-f0-9]{64})/);
  if (!match) return null;
  const sessionData = await env.SESSIONS.get(match[1]);
  return sessionData ? JSON.parse(sessionData) : null;
}

// Default data jika KV kosong
const DEFAULTS = {
  telemetri: {
    porsi_tersalurkan: 4850210,
    persen_target: 99.2,
    sppg_aktif: 1284,
    sekolah_terlayani: 18420,
    kepatuhan_akg: 99.6,
    suhu_rata_rata: 65.8,
    sla_distribusi: 99.8,
    pembaruan_teks: 'Hari ini, Pukul 11.45 WIB',
    updated_at: Date.now()
  },
  distribusi: [
    { provinsi: 'DKI Jakarta', target_porsi: 120000, ketepatan: 98.5, status: 'Selesai Salur', region: 'ID-01' },
    { provinsi: 'Jawa Barat', target_porsi: 155000, ketepatan: 98.6, status: 'Selesai Salur', region: 'ID-02' },
    { provinsi: 'Jawa Tengah', target_porsi: 148000, ketepatan: 97.9, status: 'Selesai Salur', region: 'ID-03' },
    { provinsi: 'Jawa Timur', target_porsi: 162000, ketepatan: 99.1, status: 'Selesai Salur', region: 'ID-04' },
    { provinsi: 'Bali', target_porsi: 52000, ketepatan: 99.4, status: 'Selesai Salur', region: 'ID-05' },
    { provinsi: 'Sumatera Utara', target_porsi: 98000, ketepatan: 96.8, status: '94% Salur', region: 'ID-06' },
    { provinsi: 'Sulawesi Selatan', target_porsi: 75000, ketepatan: 97.2, status: 'Selesai Salur', region: 'ID-07' },
    { provinsi: 'Kalimantan Timur', target_porsi: 61000, ketepatan: 95.5, status: 'Dalam Pengantaran', region: 'ID-08' }
  ]
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    // Anti-scraping: require X-Requested-By
    if (!request.headers.get('X-Requested-By')) {
      return json({ status: 'error', message: 'Akses langsung tidak diizinkan.' }, 403);
    }

    const url = new URL(request.url);
    const type = url.searchParams.get('type') || '';

    // GET data
    if (request.method === 'GET') {
      if (type === 'telemetri') {
        const stored = await env.DATA.get('telemetri');
        const data = stored ? JSON.parse(stored) : DEFAULTS.telemetri;
        return json({ status: 'success', data });
      }
      if (type === 'distribusi') {
        const stored = await env.DATA.get('distribusi');
        const data = stored ? JSON.parse(stored) : DEFAULTS.distribusi;
        return json({ status: 'success', data });
      }
      if (type === 'menu') {
        const stored = await env.DATA.get('menu');
        const data = stored ? JSON.parse(stored) : [];
        return json({ status: 'success', data });
      }

      // SPPG endpoints — dari Neon PostgreSQL
      if (type === 'sppg') {
        if (!env.DATABASE_URL) {
          return json({ status: 'error', message: 'DATABASE_URL tidak dikonfigurasi' }, 500);
        }
        const sql = neon(env.DATABASE_URL);
        const provinsiFilter = url.searchParams.get('provinsi') || '';

        let rows;
        if (provinsiFilter) {
          rows = await sql`
            SELECT id, nama, provinsi, kabupaten_kota, kecamatan, kelurahan_desa,
                   alamat, nama_yayasan, latitude, longitude, status, data_bulan
            FROM sppg
            WHERE latitude IS NOT NULL
              AND LOWER(provinsi) = LOWER(${provinsiFilter})
            ORDER BY provinsi, kabupaten_kota, nama
          `;
        } else {
          rows = await sql`
            SELECT id, nama, provinsi, kabupaten_kota, kecamatan, kelurahan_desa,
                   alamat, nama_yayasan, latitude, longitude, status, data_bulan
            FROM sppg
            WHERE latitude IS NOT NULL
            ORDER BY provinsi, kabupaten_kota, nama
          `;
        }
        return json({ status: 'success', data: rows, total: rows.length });
      }

      return json({ status: 'error', message: 'Parameter type tidak valid.' }, 400);
    }

    // POST data — admin only
    if (request.method === 'POST') {
      const session = await getSession(request, env);
      if (!session || session.role !== 'admin') {
        return json({ status: 'error', message: 'Akses ditolak. Hanya admin yang dapat mengubah data.' }, 403);
      }

      const body = await request.json().catch(() => null);
      if (!body || !body.type || !body.data) {
        return json({ status: 'error', message: 'Payload tidak valid.' }, 400);
      }

      const allowedTypes = ['telemetri', 'distribusi', 'menu'];
      if (!allowedTypes.includes(body.type)) {
        return json({ status: 'error', message: 'Tipe data tidak dikenal.' }, 400);
      }

      await env.DATA.put(body.type, JSON.stringify({ ...body.data, updated_at: Date.now() }));
      return json({ status: 'success', message: `Data ${body.type} berhasil diperbarui.` });
    }

    return json({ status: 'error', message: 'Method tidak diizinkan.' }, 405);
  }
};
