/**
 * Cloudflare Pages Function
 * Route: GET /api/tiket?tiket=TKT-xxx
 * Menggantikan: api/tiket.php
 */

import { CORS, json, dbQuery, getSession } from './_shared.js';

async function isSupportedImage(file) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === 'image/png') {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  if (file.type === 'image/webp') {
    return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
      && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  }
  return false;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const form = await request.formData().catch(() => null);
  if (!form) return json({ status: 'error', message: 'Data laporan tidak dapat dibaca.' }, 400);

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

  let photoPath = null;
  let photoOriginalName = null;
  let photoKey = null;
  const uploadedPhoto = photo instanceof File && photo.size > 0 ? photo : null;
  if (uploadedPhoto) {
    if (uploadedPhoto.size > 10 * 1024 * 1024
      || !await isSupportedImage(uploadedPhoto)) {
      return json({ status: 'error', message: 'Foto harus JPG, PNG, atau WEBP dan maksimal 10 MB.' }, 422);
    }
    if (!env.TIKET_PHOTOS) {
      return json({ status: 'error', message: 'Penyimpanan foto belum dikonfigurasi. Hapus lampiran atau hubungi administrator.' }, 503);
    }
    try {
      const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[uploadedPhoto.type];
      photoKey = `aduan/${crypto.randomUUID()}.${extension}`;
      await env.TIKET_PHOTOS.put(photoKey, uploadedPhoto.stream(), {
        httpMetadata: { contentType: uploadedPhoto.type }
      });
      photoPath = `/api/tiket?photo=${encodeURIComponent(photoKey)}`;
      photoOriginalName = uploadedPhoto.name.slice(0, 255);
    } catch {
      if (photoKey) {
        try {
          await env.TIKET_PHOTOS.delete(photoKey);
        } catch {
          return json({ status: 'error', message: 'Foto gagal diunggah dan tidak dapat dibersihkan. Hubungi administrator.' }, 500);
        }
      }
      return json({ status: 'error', message: 'Foto gagal diunggah. Coba lagi atau kirim laporan tanpa foto.' }, 502);
    }
  }

  const dateStamp = incidentDate.replaceAll('-', '');
  const ticketCode = `TKT-BGN-${dateStamp}-${crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`;

  try {
    const result = await dbQuery(env.DATABASE_URL,
      `INSERT INTO laporan_aduan (
         ticket_code, reporter_name, reporter_phone, reporter_role,
         issue_category, school_target, incident_date, description,
         photo_path, photo_original_name, status, priority, ip_address, user_agent
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'masuk','sedang',$11,$12)
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
        request.headers.get('CF-Connecting-IP') || null,
        request.headers.get('User-Agent')?.slice(0, 500) || null
      ]
    );

    const savedTicket = result.rows?.[0]?.ticket_code;
    if (!savedTicket) return json({ status: 'error', message: 'Laporan belum berhasil disimpan.' }, 500);
    return json({ status: 'success', ticket_code: savedTicket, message: 'Laporan berhasil disimpan.' });
  } catch {
    if (photoKey && env.TIKET_PHOTOS) {
      try {
        await env.TIKET_PHOTOS.delete(photoKey);
      } catch {
        return json({ status: 'error', message: 'Laporan gagal disimpan dan lampiran tidak dapat dibersihkan. Hubungi administrator.' }, 500);
      }
    }
    return json({ status: 'error', message: 'Laporan gagal disimpan. Coba lagi beberapa saat.' }, 500);
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url    = new URL(request.url);
  const photoKey = url.searchParams.get('photo');

  if (photoKey !== null) {
    const session = await getSession(request, env);
    if (!session || session.role !== 'admin') {
      return json({ status: 'error', message: 'Akses lampiran hanya untuk Admin Satgas.' }, 403);
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
      `SELECT id, ticket_code, reporter_name, reporter_role, issue_category,
              school_target, incident_date, description, status, priority,
              satgas_notes, created_at
       FROM laporan_aduan WHERE ticket_code = $1`,
      [tiket]
    );

    const row = result.rows?.[0];
    if (!row) return json({ status: 'not_found', message: 'Nomor tiket tidak ditemukan dalam database resmi.' });

    return json({
      status: 'success',
      data: {
        nomor_tiket:    row.ticket_code,
        kategori:       row.issue_category,
        target_sekolah: row.school_target,
        status:         row.status,
        priority:       row.priority,
        tanggal_lapor:  row.created_at,
        nama_pelapor:   row.reporter_name,
        deskripsi:      row.description,
        catatan_satgas: row.satgas_notes || 'Dalam proses peninjauan Satgas BGN'
      }
    });
  } catch (err) {
    return json({ status: 'error', message: 'Terjadi kesalahan sistem internal.' }, 500);
  }
}
