/**
 * Cloudflare Pages Function
 * Route: GET /api/notifications
 * Menggantikan: api/notifications.php
 */

import { CORS, json, dbQuery, getSession } from './_shared.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const db = env.DATABASE_URL;
  const session = await getSession(request, env);
  const isAdmin = session?.role === 'admin';

  try {
    // Laporan masuk
    const laporanRes = await dbQuery(db,
      `SELECT COUNT(*) AS cnt FROM laporan_aduan WHERE status = 'masuk'`
    );
    const laporanCount = parseInt(laporanRes.rows?.[0]?.cnt || 0);

    // 5 laporan terbaru
    const latestRes = await dbQuery(db,
      `SELECT id, ticket_code, reporter_name, school_target, issue_category, status, created_at
       FROM laporan_aduan ORDER BY created_at DESC LIMIT 5`
    );

    // Pending SPPG logo (admin only)
    let pendingSppg = 0;
    if (isAdmin) {
      const pendingRes = await dbQuery(db,
        `SELECT COUNT(*) AS cnt FROM users WHERE role = 'sppg' AND avatar_status = 'pending_approval'`
      );
      pendingSppg = parseInt(pendingRes.rows?.[0]?.cnt || 0);
    }

    return json({
      status: 'success',
      badge_count:         laporanCount + pendingSppg,
      laporan_masuk_count: laporanCount,
      pending_sppg_logos:  pendingSppg,
      latest_reports:      latestRes.rows || [],
      timestamp:           new Date().toISOString()
    });
  } catch (err) {
    // Fallback data kosong
    return json({
      status: 'success',
      badge_count: 0, laporan_masuk_count: 0,
      pending_sppg_logos: 0, latest_reports: [],
      timestamp: new Date().toISOString()
    });
  }
}
