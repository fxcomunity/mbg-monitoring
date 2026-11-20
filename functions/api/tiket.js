/**
 * Cloudflare Pages Function
 * Route: GET /api/tiket?tiket=TKT-xxx
 * Menggantikan: api/tiket.php
 */

import { CORS, json, dbQuery, getSession } from './_shared.js';

async function getSupportedImageBytes(file) {
  if (file.type !== 'image/jpeg' || !/\.jpe?g$/i.test(file.name)) return null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 ||
      bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
    return null;
  }
  const content = new TextDecoder('latin1').decode(bytes).toLowerCase();
  return /<\?php\b|<\?=|<\s*script\b|javascript\s*:|\bon[a-z]+\s*=|\beval\s*\(/i.test(content)
    ? null
    : bytes;
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const form = await request.formData().catch(() => null);
  if (!form) return json({ status: 'error', message: 'Data laporan tidak dapat dibaca.' }, 400);

  if (form.get('action') === 'admin_update') {
    let session;
    try {
      session = await getSession(request, env);
    } catch (error) {
      console.error('Report admin session verification failed:', error);
      return json({ status: 'error', message: 'Sesi administrator tidak dapat diverifikasi.' }, 503);
    }
    if (!session || session.role !== 'admin') {
      return json({ status: 'error', message: 'Akses hanya untuk Admin Satgas.' }, 403);
    }

    const ticketCode = String(form.get('ticket_code') || '').trim();
    const status = String(form.get('status') || '');
    const notes = String(form.get('satgas_notes') || '').trim();
    const validStatuses = ['masuk', 'verifikasi', 'proses', 'selesai', 'ditolak'];
    if (!/^[A-Za-z0-9-]{1,60}$/.test(ticketCode) || !validStatuses.includes(status) || notes.length > 2000) {
      return json({ status: 'error', message: 'Data pembaruan aduan tidak valid.' }, 422);
    }

    try {
      const updated = await dbQuery(env.DATABASE_URL,
        `WITH target AS (
           SELECT id, status FROM laporan_aduan WHERE ticket_code = $1 FOR UPDATE
         ), changed AS (
           UPDATE laporan_aduan AS report
           SET status = $2, satgas_notes = NULLIF($3, ''), updated_at = NOW()
           FROM target
           WHERE report.id = target.id
           RETURNING report.id, target.status AS old_status, report.status AS new_status
         )
         INSERT INTO aduan_log (laporan_id, old_status, new_status, changed_by, notes)
         SELECT id, old_status, new_status, $4, NULLIF($3, '')
         FROM changed
         RETURNING laporan_id`,
        [ticketCode, status, notes, String(session.username || 'admin').slice(0, 80)]
      );
      if (!updated[0]) return json({ status: 'error', message: 'Tiket tidak ditemukan di server.' }, 404);
      return json({ status: 'success', message: 'Aduan berhasil diperbarui.' });
    } catch (error) {
      console.error('Report admin update failed:', error);
      return json({ status: 'error', message: 'Pembaruan aduan gagal disimpan.' }, 500);
    }
  }

  const reporterName = String(form.get('reporter_name') || '').trim();
  const reporterPhone = String(form.get('reporter_phone') || '').trim();
  const reporterRole = String(form.get('reporter_role') || '').trim();
  const issueCategory = String(form.get('issue_category') || '').trim();
  const schoolTarget = String(form.get('school_target') || '').trim();
  const incidentDate = String(form.get('incident_date') || '').trim();
  const description = String(form.get('description') || '').trim();
  const photo = form.get('photo');

  const roles = ['wali', 'guru', 'komite', 'siswa', 'masyarakat'];
  const categories = ['waktu', 'menu', 'suhu', 'higienitas', 'alergen', 'lainnya'];
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(incidentDate)
    && !Number.isNaN(Date.parse(`${incidentDate}T00:00:00Z`))
    && new Date(`${incidentDate}T00:00:00Z`).toISOString().slice(0, 10) === incidentDate;

  if (!reporterName || reporterName.length > 120
    || !/^[0-9+()\-\s]{8,20}$/.test(reporterPhone)
    || !roles.includes(reporterRole)
    || !categories.includes(issueCategory)
    || !schoolTarget || schoolTarget.length > 200
    || !validDate
    || !description || description.length > 10000) {
    return json({ status: 'error', message: 'Periksa kembali data wajib laporan.' }, 422);
  }

  const dateStamp = incidentDate.replaceAll('-', '');
  const ticketCode = `TKT-BGN-${dateStamp}-${crypto.randomUUID().replaceAll('-', '').toUpperCase()}`;
  let photoPath = null;
  let photoOriginalName = null;
  let photoBase64 = null;
  const uploadedPhoto = photo instanceof File && photo.size > 0 ? photo : null;
  if (uploadedPhoto) {
    if (uploadedPhoto.size > 10 * 1024 * 1024) {
      return json({ status: 'error', message: 'Foto harus berupa JPG yang valid dan sudah diproses aman, maksimal 10 MB.' }, 422);
    }
    const photoBytes = await getSupportedImageBytes(uploadedPhoto);
    if (!photoBytes) return json({ status: 'error', message: 'Foto harus berupa JPG yang valid dan sudah diproses aman.' }, 422);
    photoBase64 = bytesToBase64(photoBytes);
    photoPath = `/api/tiket?photo=${encodeURIComponent(ticketCode)}`;
    photoOriginalName = uploadedPhoto.name.slice(0, 255);
  }

  try {
    const result = await dbQuery(env.DATABASE_URL,
      `INSERT INTO laporan_aduan (
         ticket_code, reporter_name, reporter_phone, reporter_role,
         issue_category, school_target, incident_date, description,
         photo_path, photo_original_name, photo_data, status, priority, ip_address, user_agent
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,decode($11, 'base64'),'masuk','sedang',$12,$13)
       RETURNING ticket_code`,
      [
        ticketCode,
        reporterName,
        reporterPhone,
        reporterRole,
        issueCategory,
        schoolTarget,
        incidentDate,
        description,
        photoPath,
        photoOriginalName,
        photoBase64,
        request.headers.get('CF-Connecting-IP') || null,
        request.headers.get('User-Agent')?.slice(0, 500) || null
      ]
    );

    const savedTicket = result.rows?.[0]?.ticket_code;
    if (!savedTicket) return json({ status: 'error', message: 'Laporan belum berhasil disimpan.' }, 500);
    return json({ status: 'success', ticket_code: savedTicket, message: 'Laporan berhasil disimpan.' });
  } catch (error) {
    console.error('Report insertion failed:', error);
    return json({ status: 'error', message: 'Laporan gagal disimpan. Coba lagi beberapa saat.' }, 500);
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url    = new URL(request.url);
  const photoKey = url.searchParams.get('photo');

  if (url.searchParams.get('action') === 'admin_list') {
    let session;
    try {
      session = await getSession(request, env);
    } catch (error) {
      console.error('Report admin session verification failed:', error);
      return json({ status: 'error', message: 'Sesi administrator tidak dapat diverifikasi.' }, 503);
    }
    if (!session || session.role !== 'admin') {
      return json({ status: 'error', message: 'Akses hanya untuk Admin Satgas.' }, 403);
    }
    try {
      const reports = await dbQuery(env.DATABASE_URL,
        `SELECT ticket_code, reporter_name, reporter_role, issue_category, school_target,
                incident_date, description, photo_path, status, priority, satgas_notes,
                created_at, updated_at
         FROM laporan_aduan
         ORDER BY created_at DESC
         LIMIT 100`
      );
      return json({ status: 'success', data: reports });
    } catch (error) {
      console.error('Report admin list failed:', error);
      return json({ status: 'error', message: 'Daftar aduan tidak dapat dimuat dari server.' }, 503);
    }
  }

  if (photoKey !== null) {
    const session = await getSession(request, env);
    if (!session || session.role !== 'admin') {
      return json({ status: 'error', message: 'Akses lampiran hanya untuk Admin Satgas.' }, 403);
    }
    if (/^TKT-BGN-\d{8}-[A-F0-9]{32,64}$/i.test(photoKey)) {
      try {
        const reports = await dbQuery(env.DATABASE_URL,
          `SELECT replace(encode(photo_data, 'base64'), E'\\n', '') AS photo_base64
           FROM laporan_aduan
           WHERE ticket_code = $1 AND photo_data IS NOT NULL
           LIMIT 1`,
          [photoKey]
        );
        if (!reports[0]?.photo_base64) return json({ status: 'error', message: 'Lampiran tidak ditemukan.' }, 404);
        const headers = new Headers(CORS);
        headers.set('Content-Type', 'image/jpeg');
        headers.set('Content-Disposition', 'inline');
        headers.set('Cache-Control', 'private, no-store');
        headers.set('X-Content-Type-Options', 'nosniff');
        return new Response(base64ToBytes(reports[0].photo_base64), { headers });
      } catch (error) {
        console.error('Report attachment read failed:', error);
        return json({ status: 'error', message: 'Lampiran tidak dapat dimuat.' }, 500);
      }
    }
    if (!env.TIKET_PHOTOS || !/^aduan\/[a-f0-9-]+\.(jpg|png|webp)$/.test(photoKey)) {
      return json({ status: 'error', message: 'Lampiran tidak ditemukan.' }, 404);
    }
    const object = await env.TIKET_PHOTOS.get(photoKey);
    if (!object) return json({ status: 'error', message: 'Lampiran tidak ditemukan.' }, 404);
    const headers = new Headers(CORS);
    headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
    headers.set('Content-Disposition', 'inline');
    headers.set('Cache-Control', 'private, no-store');
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(object.body, { headers });
  }

  const tiket  = (url.searchParams.get('tiket') || url.searchParams.get('ticket') || '').trim().toUpperCase();

  if (!tiket) return json({ status: 'error', message: 'Nomor tiket wajib disertakan.' });

  try {
    const result = await dbQuery(env.DATABASE_URL,
      `SELECT ticket_code, status, created_at
       FROM laporan_aduan WHERE ticket_code = $1`,
      [tiket]
    );

    const row = result.rows?.[0];
    if (!row) return json({ status: 'not_found', message: 'Nomor tiket tidak ditemukan dalam database resmi.' });

    return json({
      status: 'success',
      data: {
        nomor_tiket:    row.ticket_code,
        status:         row.status,
        tanggal_lapor:  row.created_at
      }
    });
  } catch (err) {
    return json({ status: 'error', message: 'Terjadi kesalahan sistem internal.' }, 500);
  }
}
