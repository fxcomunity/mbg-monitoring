import { dbQuery, getSession, json } from './_shared.js';

const DEFAULT_MESSAGE = 'Sedang dalam pemeliharaan sistem.';

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
}

function maintenanceState(row) {
  return {
    active: row ? row.active === true : false,
    message: escapeHtml(row?.message || DEFAULT_MESSAGE),
    eta: row?.eta ? new Date(row.eta).toISOString() : null
  };
}

export async function onRequestGet({ env }) {
  if (!env.DATABASE_URL) return json({ error: 'Database belum dikonfigurasi.' }, 503);
  try {
    const rows = await dbQuery(env.DATABASE_URL,
      'SELECT active, message, eta FROM system_maintenance WHERE id = TRUE LIMIT 1'
    );
    return json(maintenanceState(rows[0]));
  } catch (error) {
    console.error('Maintenance state read failed:', error);
    return json({ error: 'Status maintenance tidak dapat dimuat.' }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.DATABASE_URL) return json({ error: 'Database belum dikonfigurasi.' }, 503);
  let session;
  try {
    session = await getSession(request, env);
  } catch (error) {
    console.error('Maintenance admin session verification failed:', error);
    return json({ error: 'Status autentikasi tidak tersedia.' }, 503);
  }
  if (!session) return json({ error: 'Silakan masuk terlebih dahulu.' }, 401);

  try {
    const actors = await dbQuery(env.DATABASE_URL,
      `SELECT id FROM users
       WHERE username = $1 AND role = 'admin' AND is_active = TRUE AND deleted_at IS NULL
       LIMIT 1`,
      [session.username]
    );
    if (!actors[0]) return json({ error: 'Hanya administrator aktif yang dapat mengelola maintenance.' }, 403);

    const contentType = request.headers.get('Content-Type') || '';
    let body;
    if (contentType.includes('application/json')) {
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Format permintaan tidak valid.' }, 400);
      }
    } else {
      const form = await request.formData();
      body = Object.fromEntries(form.entries());
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ error: 'Format permintaan tidak valid.' }, 400);
    }

    const action = typeof body.action === 'string' ? body.action : '';
    if (action === 'disable') {
      const rows = await dbQuery(env.DATABASE_URL,
        `INSERT INTO system_maintenance (id, active, message, updated_by, updated_at)
         VALUES (TRUE, FALSE, $1, $2, NOW())
         ON CONFLICT (id) DO UPDATE
         SET active = FALSE, message = EXCLUDED.message, eta = NULL,
             updated_by = EXCLUDED.updated_by, updated_at = NOW()
         RETURNING active, message, eta`,
        [DEFAULT_MESSAGE, Number(actors[0].id)]
      );
      return json({ success: true, state: maintenanceState(rows[0]) });
    }
    if (action !== 'enable') return json({ error: 'Aksi maintenance tidak valid.' }, 400);
    if (typeof body.message !== 'string' || typeof body.eta !== 'string') {
      return json({ error: 'Format pesan atau estimasi maintenance tidak valid.' }, 400);
    }

    let message = body.message.replace(/<[^>]*>/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
    if (!message) message = DEFAULT_MESSAGE;
    if (message.length > 500) return json({ error: 'Pesan maintenance maksimal 500 karakter.' }, 400);
    let eta = null;
    if (body.eta.trim()) {
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(body.eta)) {
        return json({ error: 'Format estimasi selesai tidak valid.' }, 400);
      }
      const timestamp = Date.parse(body.eta);
      if (!Number.isFinite(timestamp)) return json({ error: 'Format estimasi selesai tidak valid.' }, 400);
      eta = new Date(timestamp).toISOString();
    }

    const rows = await dbQuery(env.DATABASE_URL,
      `INSERT INTO system_maintenance (id, active, message, eta, updated_by, updated_at)
       VALUES (TRUE, TRUE, $1, $2, $3, NOW())
       ON CONFLICT (id) DO UPDATE
       SET active = TRUE, message = EXCLUDED.message, eta = EXCLUDED.eta,
           updated_by = EXCLUDED.updated_by, updated_at = NOW()
       RETURNING active, message, eta`,
      [message, eta, Number(actors[0].id)]
    );
    return json({ success: true, state: maintenanceState(rows[0]) });
  } catch (error) {
    console.error('Maintenance update failed:', error);
    return json({ error: 'Perubahan mode maintenance gagal disimpan.' }, 500);
  }
}
