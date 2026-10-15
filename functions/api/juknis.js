/**
 * Cloudflare Pages Function
 * Route: GET /api/juknis
 * Menggantikan: api/juknis.php
 * Data standar AKG dan juknis gizi
 */

import { CORS, json, dbQuery } from './_shared.js';

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const result = await dbQuery(env.DATABASE_URL,
      `SELECT id, judul, kategori, isi, updated_at FROM juknis ORDER BY kategori, id LIMIT 100`
    );
    return json({ status: 'success', data: result.rows || [] });
  } catch (err) {
    // Fallback data statis
    return json({
      status: 'success',
      data: [
        { id: 1, kategori: 'akg', judul: 'Standar Energi', isi: 'Minimal 629 kkal per porsi MBG' },
        { id: 2, kategori: 'akg', judul: 'Standar Protein', isi: 'Minimal 26g protein per porsi' },
        { id: 3, kategori: 'suhu', judul: 'Rantai Hangat', isi: 'Suhu minimal 60°C saat diterima di sekolah' }
      ]
    });
  }
}
