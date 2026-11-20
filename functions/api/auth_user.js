/**
 * Cloudflare Pages Function
 * Route: GET/POST /api/auth_user
 *
 * HARDENED VERSION - Fixed SQLi and Added Input Sanitization
 * Project: MBG Monitoring
 */
import { trustedLoginIp, getLoginLockout, recordLoginFailure, recordLoginSuccess } from './_login_lockout.js';
import { dbQuery, getSession, hashPassword, hashSessionToken, revokeSession, verifyPassword } from './_shared.js';

const CORS = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Requested-By',
  'Cache-Control': 'no-cache, no-store, must-revalidate'
};

const SESSION_TTL = 30 * 24 * 60 * 60;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

// Sanitasi input untuk mencegah karakter aneh masuk ke logic
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.trim().toLowerCase();
}

function containsControl(value) {
  return typeof value === 'string' && /[\u0000-\u001f\u007f]/.test(value);
}

function containsUnsafePayload(value) {
  if (typeof value !== 'string') return true;
  const decoded = value
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  return /(?:'|"|`|--|;|\/\*|\*\/|<|>|\bunion\b|\bselect\b|\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b|\btruncate\b|\bor\b\s+\d+\s*=|\band\b\s+\d+\s*=|javascript\s*:|on[a-z]+\s*=)/i.test(decoded);
}

function validEmail(email) {
  return typeof email === 'string' &&
    email.length <= 254 &&
    /^[a-z0-9.!#$%&*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(email);
}

function validPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 1024 || containsControl(password)) return false;
  let categories = 0;
  if (/[a-z]/.test(password)) categories++;
  if (/[A-Z]/.test(password)) categories++;
  if (/[0-9]/.test(password)) categories++;
  if (/[^A-Za-z0-9]/.test(password)) categories++;
  return categories >= 3;
}

function generateToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2,'0')).join('');
}

const ROLE_LABELS = {
  admin: 'Admin Satgas BGN',
  sppg:  'Pengelola Dapur SPPG',
  user:  'Wali Murid / Publik'
};

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

  if (!env.DATABASE_URL) return json({ status: 'error', message: 'DATABASE_URL tidak dikonfigurasi di Cloudflare Pages' }, 500);

  if (request.method === 'GET') {
    if (new URL(request.url).searchParams.get('action') === 'logout') {
      try {
        await revokeSession(request, env);
      } catch (error) {
        console.error('Session revocation failed:', error);
        return json({ status: 'error', message: 'Sesi tidak dapat diakhiri. Coba lagi.' }, 503);
      }
      const headers = new Headers(CORS);
      headers.set('Set-Cookie', 'mbg_token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/');
      return new Response(JSON.stringify({ status: 'success' }), { headers });
    }
    if (new URL(request.url).searchParams.get('action') === 'login_status') {
      const ip = trustedLoginIp(request);
      if (!ip) return json({ status: 'error', message: 'IP client tidak dapat diverifikasi.' }, 503);
      try {
        return json({ status: 'success', lockout: await getLoginLockout(env, ip) });
      } catch {
        return json({ status: 'error', message: 'Status pembatasan login tidak tersedia.' }, 503);
      }
    }
    let session;
    try {
      session = await getSession(request, env);
    } catch (_) {
      return json({ status: 'error', logged_in: false, message: 'Status autentikasi tidak tersedia.' }, 503);
    }
    if (!session) return json({ logged_in: false });
    let profileRows;
    try {
      profileRows = await dbQuery(env.DATABASE_URL,
        `SELECT full_name, email, sppg_name, avatar_url, avatar_pending_url, avatar_status
         FROM users
         WHERE username = $1 AND is_active = TRUE
         LIMIT 1`,
        [session.username]
      );
    } catch (error) {
      console.error('Account profile lookup failed:', error);
      return json({ status: 'error', logged_in: false, message: 'Profil akun tidak dapat dimuat.' }, 503);
    }
    const profile = profileRows[0];
    if (!profile) return json({ logged_in: false });
    return json({
      logged_in: true,
      user: {
        username:     session.username || '',
        full_name:    profile.full_name || session.name || '',
        email:        profile.email || '',
        role:         session.role,
        role_label:   ROLE_LABELS[session.role] || session.role,
        sppg_name:    profile.sppg_name || session.sppg_name || '',
        avatar:       profile.avatar_url || session.avatar || '',
        avatar_url:   profile.avatar_url || '',
        avatar_pending_url: profile.avatar_pending_url || '',
        avatar_status: profile.avatar_status || session.avatar_status || 'approved'
      }
    });
  }

  if (request.method === 'POST') {
    let body = {};
    const ct = request.headers.get('Content-Type') || '';
    if (ct.includes('application/json')) {
      body = await request.json().catch(() => ({}));
    } else {
      const fd = await request.formData().catch(() => null);
      if (fd) fd.forEach((v, k) => { body[k] = v; });
    }

    const action = typeof body.action === 'string' ? body.action : '';
    const accountActions = new Set([
      'list_users',
      'list_deleted_users',
      'list_deletion_requests',
      'request_user_deletion',
      'review_user_deletion',
      'restore_user'
    ]);

    if (accountActions.has(action)) {
      let session;
      try {
        session = await getSession(request, env);
      } catch (error) {
        console.error('Admin session verification failed:', error);
        return json({ status: 'error', message: 'Status autentikasi tidak tersedia.' }, 503);
      }
      if (!session) return json({ status: 'error', message: 'Silakan masuk terlebih dahulu.' }, 401);

      try {
        const actors = await dbQuery(env.DATABASE_URL,
          `SELECT id, email FROM users
           WHERE username = $1 AND role = 'admin' AND is_active = TRUE AND deleted_at IS NULL
           LIMIT 1`,
          [session.username]
        );
        const actor = actors[0];
        if (!actor) return json({ status: 'error', message: 'Akses hanya untuk administrator aktif.' }, 403);
        const actorId = Number(actor.id);
        const isSuperAdmin = String(actor.email || '').toLowerCase() === '19250779@bsi.ac.id';
        const cleanupExpiredAccounts = () => dbQuery(env.DATABASE_URL,
          `DELETE FROM users
           WHERE deleted_at IS NOT NULL AND deleted_at <= NOW() - INTERVAL '7 days'
             AND LOWER(email) <> '19250779@bsi.ac.id'
           RETURNING id`
        );

        if (action === 'list_users') {
          await cleanupExpiredAccounts();
          const users = await dbQuery(env.DATABASE_URL,
            `SELECT id, username, full_name, email, role, sppg_name, avatar_status,
                    is_active AS active, created_at
             FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 200`
          );
          return json({ status: 'success', data: users, is_superadmin: isSuperAdmin, current_user_id: actorId });
        }

        if (action === 'list_deleted_users' || action === 'list_deletion_requests') {
          if (!isSuperAdmin) return json({ status: 'error', message: 'Hanya superadmin yang dapat mengakses antrean penghapusan.' }, 403);
          await cleanupExpiredAccounts();
          if (action === 'list_deleted_users') {
            const deleted = await dbQuery(env.DATABASE_URL,
              `SELECT id, username, full_name, email, role, deleted_at
               FROM users
               WHERE deleted_at IS NOT NULL AND deleted_at > NOW() - INTERVAL '7 days'
               ORDER BY deleted_at DESC LIMIT 200`
            );
            return json({ status: 'success', data: deleted });
          }
          const requests = await dbQuery(env.DATABASE_URL,
            `SELECT r.id, r.target_user_id, r.request_note, r.requested_at,
                    target.username, target.full_name, target.email, target.role,
                    requester.username AS requested_by_username
             FROM user_deletion_requests r
             JOIN users target ON target.id = r.target_user_id
             LEFT JOIN users requester ON requester.id = r.requested_by
             WHERE r.status = 'pending'
             ORDER BY r.requested_at ASC LIMIT 200`
          );
          return json({ status: 'success', data: requests });
        }

        if (action === 'request_user_deletion') {
          const targetId = Number(body.user_id);
          if (!Number.isSafeInteger(targetId) || targetId <= 0) {
            return json({ status: 'error', message: 'ID akun tidak valid.' }, 400);
          }
          const targets = await dbQuery(env.DATABASE_URL,
            'SELECT id, email, is_active, deleted_at FROM users WHERE id = $1 LIMIT 1',
            [targetId]
          );
          const target = targets[0];
          if (!target || target.deleted_at) {
            return json({ status: 'error', message: 'Akun tidak ditemukan atau sudah berada di penyimpanan sementara.' }, 404);
          }
          if (Number(target.id) === actorId || String(target.email).toLowerCase() === '19250779@bsi.ac.id') {
            return json({ status: 'error', message: 'Akun sendiri dan akun superadmin tidak dapat dihapus.' }, 403);
          }
          if (isSuperAdmin) {
            const deleted = await dbQuery(env.DATABASE_URL,
              `WITH deleted AS (
                 UPDATE users
                 SET deleted_was_active = is_active, is_active = FALSE, deleted_at = NOW(), deleted_by = $1,
                     session_version = session_version + 1
                 WHERE id = $2 AND deleted_at IS NULL
                 RETURNING id
               ),
               closed_requests AS (
                 UPDATE user_deletion_requests
                 SET status = 'approved', reviewed_by = $1, reviewed_at = NOW()
                 WHERE target_user_id = (SELECT id FROM deleted) AND status = 'pending'
                 RETURNING id
               )
               SELECT id FROM deleted`,
              [actorId, targetId]
            );
            if (!deleted.length) return json({ status: 'error', message: 'Akun berubah sebelum dapat dipindahkan ke sementara.' }, 409);
            return json({ status: 'success', message: 'Akun dipindahkan ke penyimpanan sementara selama 7 hari.' });
          }

          try {
            await dbQuery(env.DATABASE_URL,
              `INSERT INTO user_deletion_requests (target_user_id, requested_by, request_note)
               VALUES ($1, $2, $3)`,
              [targetId, actorId, 'Permintaan penghapusan oleh administrator']
            );
          } catch (error) {
            if (error && (error.code === '23505' || String(error.message || '').includes('idx_user_deletion_pending_target'))) {
              return json({ status: 'error', message: 'Permintaan penghapusan akun ini masih menunggu persetujuan.' }, 409);
            }
            throw error;
          }
          return json({ status: 'success', message: 'Permintaan penghapusan dikirim ke superadmin untuk persetujuan.' });
        }

        if (action === 'review_user_deletion') {
          if (!isSuperAdmin) return json({ status: 'error', message: 'Hanya superadmin yang dapat menyetujui penghapusan.' }, 403);
          const requestId = Number(body.request_id);
          const decision = typeof body.decision === 'string' ? body.decision : '';
          if (!Number.isSafeInteger(requestId) || requestId <= 0 || !['approve', 'reject'].includes(decision)) {
            return json({ status: 'error', message: 'Permintaan atau keputusan tidak valid.' }, 400);
          }
          const reviewed = await dbQuery(env.DATABASE_URL,
            `WITH pending AS (
               SELECT r.id, r.target_user_id
               FROM user_deletion_requests r
               JOIN users target ON target.id = r.target_user_id
               WHERE r.id = $3 AND r.status = 'pending'
                 AND LOWER(target.email) <> $4
               FOR UPDATE OF r, target
             ),
             deleted AS (
               UPDATE users u
               SET deleted_was_active = is_active, is_active = FALSE, deleted_at = NOW(), deleted_by = $1,
                   session_version = session_version + 1
               FROM pending p
               WHERE u.id = p.target_user_id AND $2 = 'approve'
                 AND u.deleted_at IS NULL
               RETURNING u.id
             ),
             updated AS (
               UPDATE user_deletion_requests r
               SET status = CASE WHEN $2 = 'approve' THEN 'approved' ELSE 'rejected' END,
                   reviewed_by = $1, reviewed_at = NOW()
               WHERE r.id = (SELECT id FROM pending)
                 AND ($2 = 'reject' OR EXISTS (SELECT 1 FROM deleted))
               RETURNING r.id
             )
             SELECT updated.id FROM updated`,
            [actorId, decision, requestId, '19250779@bsi.ac.id']
          );
          if (!reviewed.length) return json({ status: 'error', message: 'Permintaan tidak ditemukan, sudah diproses, atau akun sudah berada di penyimpanan sementara.' }, 409);
          return json({
            status: 'success',
            message: decision === 'approve' ? 'Penghapusan disetujui; akun masuk penyimpanan sementara 7 hari.' : 'Permintaan penghapusan ditolak.'
          });
        }

        if (action === 'restore_user') {
          if (!isSuperAdmin) return json({ status: 'error', message: 'Hanya superadmin yang dapat memulihkan akun.' }, 403);
          const targetId = Number(body.user_id);
          if (!Number.isSafeInteger(targetId) || targetId <= 0) return json({ status: 'error', message: 'ID akun tidak valid.' }, 400);
          const restored = await dbQuery(env.DATABASE_URL,
            `UPDATE users
             SET is_active = COALESCE(deleted_was_active, TRUE), deleted_at = NULL,
                 deleted_by = NULL, deleted_was_active = NULL,
                 session_version = session_version + 1
             WHERE id = $1 AND deleted_at > NOW() - INTERVAL '7 days'
             RETURNING id`,
            [targetId]
          );
          if (!restored.length) return json({ status: 'error', message: 'Akun tidak ditemukan atau masa pemulihannya sudah berakhir.' }, 404);
          return json({ status: 'success', message: 'Akun berhasil dipulihkan.' });
        }
      } catch (error) {
        console.error('Account lifecycle request failed:', error);
        return json({ status: 'error', message: 'Operasi manajemen akun sementara tidak dapat diproses.' }, 503);
      }
    }

    if (action === 'login') {
      const ip = trustedLoginIp(request);
      if (!ip) return json({ status: 'error', message: 'IP client tidak dapat diverifikasi.' }, 503);

      // HARDENING: Sanitize input
      const username = typeof body.username === 'string' ? sanitize(body.username) : '';
      const password = typeof body.password === 'string' ? body.password : '';

      let authStep = 'account_lookup';
      try {
        if (!username || username.length > 254 || password.length > 1024 ||
            containsControl(username) || containsControl(password) ||
            (!validEmail(username) && !/^[a-z0-9][a-z0-9_.-]{2,59}$/i.test(username)) ||
            containsUnsafePayload(username)) {
          const currentLockout = await getLoginLockout(env, ip);
          if (currentLockout.blocked) {
            return json({ status: 'error', message: 'Alamat IP ini sedang diblokir.', lockout: currentLockout }, 429);
          }
          const lockout = await recordLoginFailure(env, ip);
          return json({ status: 'error', message: 'Username atau kata sandi tidak valid.', lockout }, lockout.blocked ? 429 : 400);
        }

        const rows = await dbQuery(env.DATABASE_URL,
          `SELECT COALESCE(l.is_permanent OR l.locked_until > NOW(), FALSE) AS lockout_blocked,
                  COALESCE(l.failed_attempts, 0) AS lockout_failed_attempts,
                  l.locked_until AS lockout_blocked_until,
                  COALESCE(l.is_permanent, FALSE) AS lockout_permanent,
                  u.id AS user_id, u.username, u.full_name, u.email, u.role, u.sppg_name,
                  u.password_hash, u.salt, u.avatar_url, u.avatar_status,
                  u.status_verifikasi, u.session_version
           FROM (SELECT 1) AS request
           LEFT JOIN auth_ip_lockouts l ON l.ip_address = $1
           LEFT JOIN LATERAL (
             SELECT id, username, full_name, email, role, sppg_name,
                    password_hash, salt, avatar_url, avatar_status, status_verifikasi, session_version
             FROM users
             WHERE (username = $2 OR email = $2) AND is_active = TRUE
               AND NOT COALESCE(l.is_permanent OR l.locked_until > NOW(), FALSE)
             LIMIT 1
           ) u ON TRUE`,
          [ip, username]
        );
        const row = rows[0] || {};
        const currentLockout = {
          ip,
          blocked: row.lockout_blocked === true || row.lockout_blocked === 't',
          failed_attempts: Number(row.lockout_failed_attempts) || 0,
          blocked_until: row.lockout_blocked_until || null,
          permanent: row.lockout_permanent === true || row.lockout_permanent === 't'
        };
        if (currentLockout.blocked) {
          return json({ status: 'error', message: 'Alamat IP ini sedang diblokir.', lockout: currentLockout }, 429);
        }
        const user = row.user_id == null ? null : {
          id: row.user_id,
          username: row.username,
          full_name: row.full_name,
          email: row.email,
          role: row.role,
          sppg_name: row.sppg_name,
          password_hash: row.password_hash,
          salt: row.salt,
          avatar_url: row.avatar_url,
          avatar_status: row.avatar_status,
          status_verifikasi: row.status_verifikasi,
          session_version: row.session_version
        };
        if (!user || !ROLE_LABELS[user.role] ||
            (user.role === 'sppg' && String(user.status_verifikasi || '').toLowerCase() !== 'approved')) {
          authStep = 'record_login_failure';
          const lockout = await recordLoginFailure(env, ip);
          return json({ status: 'error', message: 'Username atau kata sandi tidak cocok.', lockout }, lockout.blocked ? 429 : 401);
        }

        authStep = 'verify_password';
        if (!await verifyPassword(password, user.password_hash, user.salt || '')) {
          authStep = 'record_login_failure';
          const lockout = await recordLoginFailure(env, ip);
          return json({ status: 'error', message: 'Username atau kata sandi tidak cocok.', lockout }, lockout.blocked ? 429 : 401);
        }

        let sessionVersion = Number(user.session_version) || 0;
        if (!String(user.password_hash).startsWith('pbkdf2_sha256$')) {
          authStep = 'upgrade_password_hash';
          const upgradedHash = await hashPassword(password, generateToken().slice(0, 32));
          const updated = await dbQuery(env.DATABASE_URL,
            `UPDATE users SET password_hash = $1, session_version = session_version + 1, updated_at = NOW()
             WHERE id = $2 RETURNING session_version`,
            [upgradedHash, user.id]
          );
          sessionVersion = Number(updated[0]?.session_version) || sessionVersion + 1;
        }
        authStep = 'record_login_success';
        await recordLoginSuccess(env, ip);

        const token   = generateToken();
        authStep = 'clean_expired_sessions';
        await dbQuery(env.DATABASE_URL,
          `DELETE FROM auth_sessions
           WHERE expires_at <= NOW() - INTERVAL '1 day'`
        );
        authStep = 'create_session';
        await dbQuery(env.DATABASE_URL,
          `INSERT INTO auth_sessions (token_hash, user_id, session_version, expires_at)
           VALUES ($1, $2, $3, NOW() + ($4 * INTERVAL '1 second'))`,
          [await hashSessionToken(token), user.id, sessionVersion, SESSION_TTL]
        );

        const headers = new Headers(CORS);
        headers.set('Set-Cookie', `mbg_token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL}; Path=/`);
        return new Response(JSON.stringify({
          status: 'success',
          user: {
            username: user.username,
            full_name: user.full_name,
            role: user.role,
            role_label: ROLE_LABELS[user.role],
            avatar_url: user.avatar_url || '',
            avatar: user.avatar_url || ''
          }
        }), { status: 200, headers });

      } catch (err) {
        console.error('Authentication service unavailable', {
          step: authStep,
          name: err instanceof Error ? err.name : 'UnknownError',
          code: typeof err?.code === 'string' ? err.code : undefined,
          message: err?.name === 'NotSupportedError' && err instanceof Error ? err.message : undefined
        });
        return json({ status: 'error', message: 'Layanan autentikasi sementara tidak tersedia.' }, 503);
      }
    }

    if (action === 'register') {
      if (typeof body.full_name !== 'string' || typeof body.email !== 'string' ||
          typeof body.username !== 'string' || typeof body.password !== 'string') {
        return json({ status: 'error', message: 'Format data pendaftaran tidak valid.' }, 400);
      }
      const full_name = body.full_name.trim();
      const email     = sanitize(body.email);
      const username  = sanitize(body.username);
      const password  = body.password;
      const role      = ['sppg','user'].includes(body.role) ? body.role : 'user';
      const sppg_name = String(body.sppg_name || '').trim();

      if (!full_name || !email || !username || !password) return json({ status: 'error', message: 'Semua kolom wajib diisi.' }, 400);
      if (full_name.length > 120 || containsControl(full_name) || !/^[\p{L}\p{M}][\p{L}\p{M} .'-]{1,119}$/u.test(full_name)) {
        return json({ status: 'error', message: 'Nama lengkap tidak valid.' }, 400);
      }
      if (!validEmail(email) || containsControl(email)) {
        return json({ status: 'error', message: 'Format alamat email tidak valid.' }, 400);
      }
      if (!/^[a-z0-9][a-z0-9_.-]{2,59}$/i.test(username) || containsUnsafePayload(username)) {
        return json({ status: 'error', message: 'Username 3–60 karakter: huruf, angka, titik, garis bawah, atau strip.' }, 400);
      }
      if (!validPassword(password)) {
        return json({ status: 'error', message: 'Kata sandi minimal 12 karakter dan menggabungkan huruf besar, huruf kecil, angka, atau simbol.' }, 400);
      }
      if (role === 'sppg' && (!sppg_name || sppg_name.length > 150 || containsControl(sppg_name) || !/^[\p{L}\p{M}\p{N} .,'()/-]{2,150}$/u.test(sppg_name))) {
        return json({ status: 'error', message: 'Nama dapur SPPG tidak valid.' }, 400);
      }
      const nib = typeof body.nib === 'string' ? body.nib.trim() : '';
      const noSlhs = typeof body.no_slhs === 'string' ? body.no_slhs.trim() : '';
      if (role === 'sppg' && (!/^[a-z0-9./-]{5,40}$/i.test(nib) || !/^[a-z0-9./-]{4,60}$/i.test(noSlhs))) {
        return json({ status: 'error', message: 'NIB dan nomor SLHS wajib diisi dengan format yang valid.' }, 400);
      }

      try {
        const check = await dbQuery(env.DATABASE_URL,
          `SELECT id FROM users WHERE username = $1 OR email = $2 LIMIT 1`,
          [username, email]
        );
        if (check.length) return json({ status: 'error', message: 'Username atau email sudah digunakan.' }, 409);

        const salt = generateToken().substring(0, 16);
        const hash = await hashPassword(password, salt);
        await dbQuery(env.DATABASE_URL,
          `INSERT INTO users (username, full_name, email, role, sppg_name, nib, no_slhs, password_hash, salt, is_active, status_verifikasi, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10, NOW())`,
          [username, full_name, email, role, sppg_name || null, role === 'sppg' ? nib : null, role === 'sppg' ? noSlhs : null, hash, salt, role === 'sppg' ? 'pending_review' : 'approved']
        );
        return json({ status: 'success', message: 'Akun berhasil didaftarkan. Silakan masuk.' });
      } catch (_) {
        return json({ status: 'error', message: 'Registrasi sementara tidak dapat diproses.' }, 503);
      }
    }

    if (action === 'list_users') {
      let session;
      try {
        session = await getSession(request, env);
      } catch (_) {
        return json({ status: 'error', message: 'Status autentikasi tidak tersedia.' }, 503);
      }
      if (!session || session.role !== 'admin') return json({ status: 'error', message: 'Hanya admin.' }, 403);
      try {
        const rows = await dbQuery(env.DATABASE_URL,
          `SELECT id, username, full_name, email, role, sppg_name, avatar_status, is_active AS active, created_at
           FROM users ORDER BY created_at DESC LIMIT 200`
        );
        return json({ status: 'success', data: rows });
      } catch (err) {
        return json({ status: 'error', message: err.message }, 500);
      }
    }

    return json({ status: 'error', message: 'Aksi tidak dikenal.' }, 400);
  }

  return json({ status: 'error', message: 'Method tidak diizinkan.' }, 405);
}