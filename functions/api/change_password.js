/**
 * Cloudflare Pages Function
 * Route: POST /api/change_password
 * Menggantikan: api/change_password.php
 */

import { CORS, json, dbQuery, getSession, hashPassword, generateToken } from './_shared.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const session = await getSession(request, env);
  if (!session) return json({ status: 'error', message: 'Silakan masuk terlebih dahulu.' }, 401);

  const db = env.DATABASE_URL;
  let body = {};
  const ct = request.headers.get('Content-Type') || '';
  if (ct.includes('application/json')) {
    body = await request.json().catch(() => ({}));
  } else {
    const fd = await request.formData().catch(() => null);
    if (fd) fd.forEach((v, k) => { body[k] = v; });
  }

  const action = body.action || 'change_self';

  // ── Admin reset sandi user lain ──────────────────────────────────────────
  if (action === 'admin_reset_user') {
    if (session.role !== 'admin') return json({ status: 'error', message: 'Hanya admin yang bisa reset sandi pengguna lain.' }, 403);

    const targetUsername = String(body.target_username || '').trim();
    const newPassword    = String(body.new_password    || '');
    if (!targetUsername) return json({ status: 'error', message: 'Username target tidak valid.' }, 400);
    if (newPassword.length < 6) return json({ status: 'error', message: 'Sandi minimal 6 karakter.' }, 422);

    const salt = generateToken().substring(0, 16);
    const hash = await hashPassword(newPassword, salt);
    try {
      const r = await dbQuery(db,
        `UPDATE users SET password_hash=$1, salt=$2, updated_at=NOW() WHERE username=$3`,
        [hash, salt, targetUsername]
      );
      return json({ status: 'success', message: `Sandi ${targetUsername} berhasil direset.` });
    } catch (err) {
      return json({ status: 'error', message: err.message }, 500);
    }
  }

  // ── Ganti sandi sendiri ──────────────────────────────────────────────────
  const currentPassword = String(body.current_password || '');
  const newPassword     = String(body.new_password     || '');
  const confirmPassword = String(body.confirm_password || '');

  if (!currentPassword || !newPassword) return json({ status: 'error', message: 'Sandi lama dan baru wajib diisi.' }, 400);
  if (newPassword.length < 6) return json({ status: 'error', message: 'Sandi baru minimal 6 karakter.' }, 422);
  if (newPassword !== confirmPassword) return json({ status: 'error', message: 'Konfirmasi sandi tidak cocok.' }, 422);

  try {
    const result = await dbQuery(db,
      `SELECT password_hash, salt FROM users WHERE username = $1`,
      [session.username]
    );
    const user = result.rows?.[0];
    if (!user) return json({ status: 'error', message: 'Pengguna tidak ditemukan.' }, 404);

    const currentHash = await hashPassword(currentPassword, user.salt);
    if (currentHash !== user.password_hash) return json({ status: 'error', message: 'Sandi lama tidak cocok.' }, 401);

    const salt = generateToken().substring(0, 16);
    const hash = await hashPassword(newPassword, salt);
    await dbQuery(db,
      `UPDATE users SET password_hash=$1, salt=$2, updated_at=NOW() WHERE username=$3`,
      [hash, salt, session.username]
    );
    return json({ status: 'success', message: 'Kata sandi berhasil diperbarui.' });
  } catch (err) {
    return json({ status: 'error', message: err.message }, 500);
  }
}
