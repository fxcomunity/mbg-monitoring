/**
 * Cloudflare Pages Function
 * Route: POST /api/upload_avatar
 * Menggantikan: api/upload_avatar.php
 *
 * Di Cloudflare Pages tidak bisa simpan file ke disk.
 * Avatar disimpan ke Cloudflare Images ATAU di-encode base64 ke DB (url kolom).
 * Untuk SPPG: upload masuk sebagai "pending_approval" dulu.
 */

import { CORS, json, dbQuery, getSession } from './_shared.js';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED  = ['image/jpeg', 'image/png', 'image/webp'];

export async function onRequestPost(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const session = await getSession(request, env);
  if (!session) return json({ status: 'error', message: 'Silakan masuk terlebih dahulu.' }, 401);

  const db   = env.DATABASE_URL;
  const role = session.role;
  const fd   = await request.formData().catch(() => null);
  if (!fd) return json({ status: 'error', message: 'Form data tidak valid.' }, 400);

  const action = fd.get('action') || 'upload';

  // ── Admin: setujui / tolak avatar SPPG ──────────────────────────────────
  if (action === 'approve_sppg_logo' || action === 'reject_sppg_logo') {
    if (role !== 'admin') return json({ status: 'error', message: 'Hanya admin.' }, 403);

    const targetUsername = String(fd.get('target_username') || '').trim();
    if (!targetUsername) return json({ status: 'error', message: 'Username target tidak valid.' }, 400);

    try {
      if (action === 'approve_sppg_logo') {
        await dbQuery(db,
          `UPDATE users SET
             avatar_url = avatar_pending_url,
             avatar_pending_url = NULL,
             avatar_status = 'approved',
             updated_at = NOW()
           WHERE username = $1 AND role = 'sppg'`,
          [targetUsername]
        );
        return json({ status: 'success', message: 'Logo SPPG disetujui dan diaktifkan.' });
      } else {
        await dbQuery(db,
          `UPDATE users SET
             avatar_pending_url = NULL,
             avatar_status = 'rejected',
             updated_at = NOW()
           WHERE username = $1`,
          [targetUsername]
        );
        return json({ status: 'success', message: 'Logo SPPG ditolak.' });
      }
    } catch (err) {
      return json({ status: 'error', message: err.message }, 500);
    }
  }

  // ── Upload avatar ────────────────────────────────────────────────────────
  const file = fd.get('avatar');
  if (!file || typeof file === 'string') return json({ status: 'error', message: 'File avatar tidak ditemukan.' }, 400);
  if (!ALLOWED.includes(file.type)) return json({ status: 'error', message: 'Format tidak didukung. Gunakan JPG, PNG, atau WebP.' }, 422);

  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > MAX_SIZE) return json({ status: 'error', message: 'Ukuran file maksimal 5MB.' }, 422);

  // Encode ke base64 data URL dan simpan ke DB
  const b64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
  const dataUrl = `data:${file.type};base64,${b64}`;

  try {
    if (role === 'sppg') {
      // SPPG: simpan sebagai pending, perlu approval admin
      await dbQuery(db,
        `UPDATE users SET avatar_pending_url=$1, avatar_status='pending_approval', updated_at=NOW()
         WHERE username=$2`,
        [dataUrl, session.username]
      );
      return json({ status: 'success', message: 'Foto profil dikirim. Menunggu persetujuan Admin BGN.', avatar_status: 'pending_approval' });
    } else {
      // Admin & User: langsung aktif
      await dbQuery(db,
        `UPDATE users SET avatar_url=$1, avatar_status='approved', updated_at=NOW()
         WHERE username=$2`,
        [dataUrl, session.username]
      );
      return json({ status: 'success', message: 'Foto profil berhasil diperbarui.', avatar_url: dataUrl, avatar_status: 'approved' });
    }
  } catch (err) {
    return json({ status: 'error', message: err.message }, 500);
  }
}
