import { CORS, json, dbQuery, getSession } from './_shared.js';

const isValidId = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0;

async function getIdentity(request, env) {
  const session = await getSession(request, env);
  if (!session || !['admin', 'sppg'].includes(session.role)) return null;
  const rows = await dbQuery(env.DATABASE_URL,
    `SELECT id, username, full_name, role
     FROM users WHERE username = $1 AND is_active = TRUE AND deleted_at IS NULL
       AND role IN ('admin', 'sppg')
       AND (role <> 'sppg' OR LOWER(COALESCE(status_verifikasi, '')) = 'approved')
     LIMIT 1`,
    [session.username]
  );
  return rows[0] || null;
}

async function touchPresence(db, userId) {
  await dbQuery(db,
    `INSERT INTO internal_chat_presence (user_id, last_seen_at) VALUES ($1, NOW())
     ON CONFLICT (user_id) DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at`,
    [userId]
  );
}

async function isMember(db, conversationId, userId) {
  const rows = await dbQuery(db,
    'SELECT 1 FROM internal_chat_members WHERE conversation_id = $1 AND user_id = $2',
    [conversationId, userId]
  );
  return rows.length > 0;
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (!['GET', 'POST'].includes(request.method)) return json({ status: 'error', message: 'Metode tidak diizinkan.' }, 405);

  try {
    const identity = await getIdentity(request, env);
    if (!identity) return json({ status: 'error', message: 'Akses komunikasi hanya untuk akun Admin dan SPPG.' }, 403);
    const db = env.DATABASE_URL;
    await touchPresence(db, Number(identity.id));

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const action = url.searchParams.get('action');
      if (action === 'me') return json({ status: 'success', user_id: Number(identity.id) });
      if (action === 'call_config') {
        const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
        const turnUrl = String(env.TURN_URL || '').trim();
        const turnSecret = String(env.TURN_SHARED_SECRET || '');
        if (Boolean(turnUrl) !== Boolean(turnSecret)) {
          return json({ status: 'error', message: 'Konfigurasi TURN belum lengkap: atur TURN_URL dan TURN_SHARED_SECRET.' }, 503);
        }
        if (turnUrl && turnSecret) {
          const turnUrls = turnUrl.split(',').map((url) => url.trim()).filter(Boolean);
          if (!turnUrls.length || turnUrls.some((url) => !/^turns?:[^\s]+$/i.test(url))) {
            return json({ status: 'error', message: 'TURN_URL harus berisi URL turn: atau turns: yang valid.' }, 503);
          }
          const username = `${Math.floor(Date.now() / 1000) + 3600}:${identity.id}`;
          const key = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(turnSecret),
            { name: 'HMAC', hash: 'SHA-1' },
            false,
            ['sign']
          );
          const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(username)));
          const credential = btoa(String.fromCharCode(...signature));
          iceServers.push({ urls: turnUrls, username, credential });
        }
        return json({ status: 'success', ice_servers: iceServers });
      }
      if (action === 'call_pending') {
        await dbQuery(db,
          `UPDATE internal_chat_calls SET status = 'missed', ended_at = NOW()
           WHERE status = 'ringing' AND created_at < NOW() - INTERVAL '60 seconds'`
        );
        await dbQuery(db,
          `UPDATE internal_chat_calls SET status = 'ended', ended_at = NOW()
           WHERE status = 'active' AND answered_at < NOW() - INTERVAL '4 hours'`
        );
        const rows = await dbQuery(db,
          `SELECT c.id, c.conversation_id, c.created_at,
                  COALESCE(u.sppg_name, u.full_name) AS caller_name, u.role AS caller_role
           FROM internal_chat_calls c JOIN users u ON u.id = c.caller_id
           WHERE c.callee_id = $1 AND c.status = 'ringing'
           ORDER BY c.created_at DESC LIMIT 5`,
          [identity.id]
        );
        return json({ status: 'success', data: rows });
      }
      if (action === 'call_state') {
        const callId = Number(url.searchParams.get('call_id'));
        const afterSignalId = Number(url.searchParams.get('after_signal_id') || 0);
        if (!isValidId(callId) || !Number.isSafeInteger(afterSignalId) || afterSignalId < 0) {
          return json({ status: 'error', message: 'Panggilan tidak valid.' }, 400);
        }
        const rows = await dbQuery(db,
          `SELECT c.id, c.conversation_id, c.caller_id, c.callee_id, c.status, c.created_at,
                  COALESCE(peer.sppg_name, peer.full_name) AS peer_name, peer.role AS peer_role
           FROM internal_chat_calls c
           JOIN users peer ON peer.id = CASE WHEN c.caller_id = $1 THEN c.callee_id ELSE c.caller_id END
           WHERE c.id = $2 AND (c.caller_id = $1 OR c.callee_id = $1)`,
          [identity.id, callId]
        );
        if (!rows.length) return json({ status: 'error', message: 'Panggilan tidak ditemukan.' }, 404);
        const signals = await dbQuery(db,
          `SELECT id, sender_id, signal_type, payload FROM internal_chat_call_signals
           WHERE call_id = $1 AND recipient_id = $2 AND id > $3
           ORDER BY id ASC LIMIT 100`,
          [callId, identity.id, afterSignalId]
        );
        return json({ status: 'success', data: rows[0], signals });
      }
      if (action === 'directory') {
        const rows = await dbQuery(db,
          `SELECT u.id, u.full_name, u.role, u.sppg_name, u.avatar_url,
                  p.last_seen_at,
                  COALESCE(p.last_seen_at >= NOW() - INTERVAL '90 seconds', FALSE) AS is_online
           FROM users u LEFT JOIN internal_chat_presence p ON p.user_id = u.id
           WHERE u.id <> $1 AND u.deleted_at IS NULL AND u.is_active = TRUE
             AND u.role IN ('admin', 'sppg')
             AND (u.role <> 'sppg' OR LOWER(COALESCE(u.status_verifikasi, '')) = 'approved')
           ORDER BY CASE u.role WHEN 'admin' THEN 0 ELSE 1 END,
                    COALESCE(u.sppg_name, u.full_name) ASC
           LIMIT 500`,
          [identity.id]
        );
        return json({ status: 'success', data: rows });
      }

      if (action === 'conversations') {
        const id = Number(identity.id);
        const archived = url.searchParams.get('archived') === '1';
        const rows = await dbQuery(db,
          `SELECT c.id, c.kind, c.name, c.updated_at,
                  (SELECT u.id FROM internal_chat_members peer JOIN users u ON u.id = peer.user_id
                   WHERE peer.conversation_id = c.id AND peer.user_id <> $1
                   ORDER BY peer.joined_at LIMIT 1) AS peer_id,
                  (SELECT COALESCE(u.sppg_name, u.full_name) FROM internal_chat_members peer JOIN users u ON u.id = peer.user_id
                   WHERE peer.conversation_id = c.id AND peer.user_id <> $1
                   ORDER BY peer.joined_at LIMIT 1) AS peer_name,
                  (SELECT u.role FROM internal_chat_members peer JOIN users u ON u.id = peer.user_id
                   WHERE peer.conversation_id = c.id AND peer.user_id <> $1
                   ORDER BY peer.joined_at LIMIT 1) AS peer_role,
                  (SELECT p.last_seen_at FROM internal_chat_members peer JOIN internal_chat_presence p ON p.user_id = peer.user_id
                   WHERE peer.conversation_id = c.id AND peer.user_id <> $1
                   ORDER BY peer.joined_at LIMIT 1) AS peer_last_seen_at,
                  (SELECT p.last_seen_at >= NOW() - INTERVAL '90 seconds'
                   FROM internal_chat_members peer JOIN internal_chat_presence p ON p.user_id = peer.user_id
                   WHERE peer.conversation_id = c.id AND peer.user_id <> $1
                   ORDER BY peer.joined_at LIMIT 1) AS peer_online,
                  (SELECT m.message FROM internal_chat_messages m
                   WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message,
                  (SELECT COUNT(*) FROM internal_chat_messages m
                   WHERE m.conversation_id = c.id AND m.sender_id <> $1
                     AND m.id > mine.last_read_message_id) AS unread_count,
                  (SELECT COUNT(*) FROM internal_chat_members members
                   WHERE members.conversation_id = c.id) AS member_count
           FROM internal_chat_conversations c
           JOIN internal_chat_members mine ON mine.conversation_id = c.id AND mine.user_id = $1
           WHERE ($2::boolean AND EXISTS (
                    SELECT 1 FROM internal_chat_archives a
                    WHERE a.user_id = $1 AND a.conversation_id = c.id
                 ))
              OR (NOT $2::boolean AND NOT EXISTS (
                    SELECT 1 FROM internal_chat_archives a
                    WHERE a.user_id = $1 AND a.conversation_id = c.id
                 ))
           ORDER BY c.updated_at DESC, c.id DESC LIMIT 300`,
          [identity.id, archived]
        );
        return json({ status: 'success', data: rows });
      }

      if (action === 'call_history') {
        const rows = await dbQuery(db,
          `SELECT c.id, c.conversation_id, c.status, c.created_at, c.answered_at, c.ended_at,
                  COALESCE(peer.sppg_name, peer.full_name) AS peer_name, peer.role AS peer_role
           FROM internal_chat_calls c
           JOIN users peer ON peer.id = CASE WHEN c.caller_id = $1 THEN c.callee_id ELSE c.caller_id END
           WHERE c.caller_id = $1 OR c.callee_id = $1
           ORDER BY c.created_at DESC LIMIT 100`,
          [identity.id]
        );
        return json({ status: 'success', data: rows });
      }

      if (action === 'statuses') {
        const rows = await dbQuery(db,
          `SELECT s.id, s.author_id, s.conversation_id, s.message, s.created_at, s.expires_at,
                  c.name AS group_name, COALESCE(u.sppg_name, u.full_name) AS author_name, u.role AS author_role
           FROM internal_chat_statuses s
           JOIN users u ON u.id = s.author_id
           LEFT JOIN internal_chat_conversations c ON c.id = s.conversation_id
           WHERE s.expires_at > NOW()
             AND (s.author_id = $1 OR s.conversation_id IS NULL OR EXISTS (
               SELECT 1 FROM internal_chat_members m
               WHERE m.conversation_id = s.conversation_id AND m.user_id = $1
             ))
           ORDER BY s.created_at DESC LIMIT 200`,
          [identity.id]
        );
        return json({ status: 'success', data: rows });
      }

      if (action === 'communities') {
        const rows = await dbQuery(db,
          `SELECT c.id, c.name, c.description, c.created_at,
                  (SELECT COUNT(*) FROM internal_chat_community_members m WHERE m.community_id = c.id) AS member_count,
                  COALESCE((
                    SELECT json_agg(json_build_object('id', g.id, 'name', g.name) ORDER BY g.name)
                    FROM internal_chat_community_groups cg
                    JOIN internal_chat_conversations g ON g.id = cg.conversation_id
                    WHERE cg.community_id = c.id
                      AND EXISTS (
                        SELECT 1 FROM internal_chat_members gm
                        WHERE gm.conversation_id = g.id AND gm.user_id = $1
                      )
                  ), '[]'::json) AS groups
           FROM internal_chat_communities c
           JOIN internal_chat_community_members mine ON mine.community_id = c.id AND mine.user_id = $1
           ORDER BY c.updated_at DESC LIMIT 100`,
          [identity.id]
        );
        return json({ status: 'success', data: rows });
      }

      if (action === 'messages') {
        const conversationId = Number(url.searchParams.get('conversation_id'));
        const afterId = Number(url.searchParams.get('after_id') || 0);
        if (!isValidId(conversationId) || !Number.isSafeInteger(afterId) || afterId < 0) {
          return json({ status: 'error', message: 'Percakapan tidak valid.' }, 400);
        }
        if (!await isMember(db, conversationId, Number(identity.id))) {
          return json({ status: 'error', message: 'Percakapan tidak ditemukan.' }, 404);
        }
        const rows = afterId === 0
          ? await dbQuery(db,
            `SELECT m.id, m.sender_id, m.message, m.created_at,
                    u.full_name AS sender_name, u.role AS sender_role, u.avatar_url
             FROM (SELECT * FROM internal_chat_messages
                   WHERE conversation_id = $1 ORDER BY id DESC LIMIT 100) m
             JOIN users u ON u.id = m.sender_id
             ORDER BY m.id ASC`,
            [conversationId]
          )
          : await dbQuery(db,
            `SELECT m.id, m.sender_id, m.message, m.created_at,
                    u.full_name AS sender_name, u.role AS sender_role, u.avatar_url
             FROM internal_chat_messages m JOIN users u ON u.id = m.sender_id
             WHERE m.conversation_id = $1 AND m.id > $2 ORDER BY m.id ASC LIMIT 100`,
            [conversationId, afterId]
          );
        if (rows.length) {
          await dbQuery(db,
            `UPDATE internal_chat_members
             SET last_read_message_id = GREATEST(last_read_message_id, $1)
             WHERE conversation_id = $2 AND user_id = $3`,
            [rows[rows.length - 1].id, conversationId, identity.id]
          );
        }
        return json({ status: 'success', data: rows });
      }
      return json({ status: 'error', message: 'Aksi komunikasi tidak valid.' }, 400);
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ status: 'error', message: 'Format permintaan tidak valid.' }, 400);
    }

    if (body.action === 'presence') return json({ status: 'success' });

    if (body.action === 'archive' || body.action === 'unarchive') {
      const conversationId = Number(body.conversation_id);
      if (!isValidId(conversationId) || !await isMember(db, conversationId, Number(identity.id))) {
        return json({ status: 'error', message: 'Percakapan tidak ditemukan.' }, 404);
      }
      if (body.action === 'archive') {
        await dbQuery(db,
          `INSERT INTO internal_chat_archives (user_id, conversation_id)
           VALUES ($1, $2) ON CONFLICT (user_id, conversation_id) DO NOTHING`,
          [identity.id, conversationId]
        );
      } else {
        await dbQuery(db, 'DELETE FROM internal_chat_archives WHERE user_id = $1 AND conversation_id = $2',
          [identity.id, conversationId]
        );
      }
      return json({ status: 'success' });
    }

    if (body.action === 'status_create') {
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      const conversationId = body.conversation_id == null || body.conversation_id === ''
        ? null : Number(body.conversation_id);
      if (!message || message.length > 500 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(message)) {
        return json({ status: 'error', message: 'Status wajib diisi dan maksimal 500 karakter.' }, 400);
      }
      if (conversationId !== null) {
        if (!isValidId(conversationId)) return json({ status: 'error', message: 'Grup status tidak valid.' }, 400);
        const group = await dbQuery(db,
          `SELECT 1 FROM internal_chat_conversations c
           JOIN internal_chat_members m ON m.conversation_id = c.id AND m.user_id = $1
           WHERE c.id = $2 AND c.kind = 'group'`,
          [identity.id, conversationId]
        );
        if (!group.length) return json({ status: 'error', message: 'Status hanya dapat dibuat di grup yang Anda ikuti.' }, 403);
      }
      const created = await dbQuery(db,
        `INSERT INTO internal_chat_statuses (author_id, conversation_id, message)
         VALUES ($1, $2, $3) RETURNING id, created_at, expires_at`,
        [identity.id, conversationId, message]
      );
      return json({ status: 'success', data: created[0] });
    }

    if (body.action === 'community_create') {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const description = typeof body.description === 'string' ? body.description.trim() : '';
      const memberIds = [...new Set((Array.isArray(body.member_ids) ? body.member_ids : []).map(Number).filter(isValidId))]
        .filter((id) => id !== Number(identity.id));
      const conversationIds = [...new Set((Array.isArray(body.conversation_ids) ? body.conversation_ids : []).map(Number).filter(isValidId))];
      if (!name || name.length > 120 || description.length > 500
          || /[\u0000-\u001f\u007f]/u.test(name)
          || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(description)) {
        return json({ status: 'error', message: 'Nama komunitas wajib diisi; deskripsi maksimal 500 karakter.' }, 400);
      }
      if (memberIds.length > 199 || conversationIds.length > 100) {
        return json({ status: 'error', message: 'Jumlah anggota atau grup komunitas melebihi batas.' }, 400);
      }
      const [eligibleMembers, eligibleGroups] = await Promise.all([
        memberIds.length ? dbQuery(db,
          `SELECT id FROM users WHERE id = ANY($1::bigint[]) AND deleted_at IS NULL AND is_active = TRUE
           AND role IN ('admin', 'sppg')
           AND (role <> 'sppg' OR LOWER(COALESCE(status_verifikasi, '')) = 'approved')`,
          [memberIds]) : Promise.resolve([]),
        conversationIds.length ? dbQuery(db,
          `SELECT c.id FROM internal_chat_conversations c
           JOIN internal_chat_members m ON m.conversation_id = c.id AND m.user_id = $1
           WHERE c.id = ANY($2::bigint[]) AND c.kind = 'group'`,
          [identity.id, conversationIds]) : Promise.resolve([])
      ]);
      if (eligibleMembers.length !== memberIds.length || eligibleGroups.length !== conversationIds.length) {
        return json({ status: 'error', message: 'Ada anggota tidak valid atau grup bukan grup yang Anda ikuti.' }, 400);
      }
      const created = await dbQuery(db,
        `WITH community AS (
           INSERT INTO internal_chat_communities (name, description, created_by)
           VALUES ($1, $2, $3) RETURNING id
         ), members AS (
           INSERT INTO internal_chat_community_members (community_id, user_id)
           SELECT community.id, selected.user_id
           FROM community
           CROSS JOIN UNNEST(ARRAY[$3::bigint] || $4::bigint[]) AS selected(user_id)
           ON CONFLICT (community_id, user_id) DO NOTHING
         ), groups AS (
           INSERT INTO internal_chat_community_groups (community_id, conversation_id)
           SELECT community.id, selected.conversation_id
           FROM community CROSS JOIN UNNEST($5::bigint[]) AS selected(conversation_id)
           ON CONFLICT (community_id, conversation_id) DO NOTHING
         )
         SELECT id FROM community`,
        [name, description, identity.id, memberIds, conversationIds]
      );
      return json({ status: 'success', community_id: Number(created[0].id) });
    }

    if (body.action === 'call_start') {
      const conversationId = Number(body.conversation_id);
      if (!isValidId(conversationId)) return json({ status: 'error', message: 'Percakapan tidak valid.' }, 400);
      const rows = await dbQuery(db,
        `SELECT c.id, c.kind, peer.user_id AS peer_id
         FROM internal_chat_conversations c
         JOIN internal_chat_members mine ON mine.conversation_id = c.id AND mine.user_id = $1
         JOIN internal_chat_members peer ON peer.conversation_id = c.id AND peer.user_id <> $1
         JOIN users u ON u.id = peer.user_id
         WHERE c.id = $2 AND c.kind = 'direct' AND u.is_active = TRUE AND u.deleted_at IS NULL
         LIMIT 1`,
        [identity.id, conversationId]
      );
      if (!rows.length) return json({ status: 'error', message: 'Panggilan hanya tersedia untuk percakapan satu lawan satu.' }, 404);
      const peerId = Number(rows[0].peer_id);
      await dbQuery(db,
        `UPDATE internal_chat_calls SET status = 'missed', ended_at = NOW()
         WHERE status = 'ringing' AND created_at < NOW() - INTERVAL '60 seconds'`
      );
      await dbQuery(db,
        `UPDATE internal_chat_calls SET status = 'ended', ended_at = NOW()
         WHERE status = 'active' AND answered_at < NOW() - INTERVAL '4 hours'`
      );
      const busy = await dbQuery(db,
        `SELECT 1 FROM internal_chat_calls
         WHERE status IN ('ringing', 'active')
           AND ((status = 'ringing' AND created_at > NOW() - INTERVAL '60 seconds')
             OR (status = 'active' AND answered_at > NOW() - INTERVAL '4 hours'))
           AND (caller_id IN ($1, $2) OR callee_id IN ($1, $2))
         LIMIT 1`,
        [Number(identity.id), peerId]
      );
      if (busy.length) return json({ status: 'error', message: 'Salah satu pengguna sedang dalam panggilan lain.' }, 409);
      const created = await dbQuery(db,
        `INSERT INTO internal_chat_calls (conversation_id, caller_id, callee_id)
         VALUES ($1, $2, $3) RETURNING id`,
        [conversationId, identity.id, peerId]
      );
      return json({ status: 'success', call_id: Number(created[0].id) });
    }

    if (['call_answer', 'call_decline', 'call_end', 'call_signal'].includes(body.action)) {
      const callId = Number(body.call_id);
      if (!isValidId(callId)) return json({ status: 'error', message: 'Panggilan tidak valid.' }, 400);
      const calls = await dbQuery(db,
        `SELECT id, caller_id, callee_id, status FROM internal_chat_calls
         WHERE id = $1 AND (caller_id = $2 OR callee_id = $2)`,
        [callId, identity.id]
      );
      const call = calls[0];
      if (!call) return json({ status: 'error', message: 'Panggilan tidak ditemukan.' }, 404);

      if (body.action === 'call_answer' || body.action === 'call_decline') {
        const nextStatus = body.action === 'call_answer' ? 'active' : 'declined';
        if (Number(call.callee_id) !== Number(identity.id) || call.status !== 'ringing') {
          return json({ status: 'error', message: 'Panggilan ini sudah tidak tersedia.' }, 409);
        }
        const updated = await dbQuery(db,
          `UPDATE internal_chat_calls
           SET status = $1,
               answered_at = CASE WHEN $1 = 'active' THEN NOW() ELSE answered_at END,
               ended_at = CASE WHEN $1 = 'declined' THEN NOW() ELSE ended_at END
           WHERE id = $2 AND status = 'ringing' AND callee_id = $3
           RETURNING id`,
          [nextStatus, callId, identity.id]
        );
        if (!updated.length) return json({ status: 'error', message: 'Panggilan ini sudah tidak tersedia.' }, 409);
        return json({ status: 'success' });
      }

      if (body.action === 'call_end') {
        const ended = await dbQuery(db,
          `UPDATE internal_chat_calls SET status = 'ended', ended_at = NOW()
           WHERE id = $1 AND (caller_id = $2 OR callee_id = $2)
             AND status IN ('ringing', 'active') RETURNING id`,
          [callId, identity.id]
        );
        if (!ended.length) return json({ status: 'error', message: 'Panggilan sudah berakhir.' }, 409);
        return json({ status: 'success' });
      }

      const signalType = body.signal_type;
      const payload = body.payload;
      const validSignalPayload = payload && typeof payload === 'object' && !Array.isArray(payload)
        && ((['offer', 'answer'].includes(signalType)
            && payload.type === signalType && typeof payload.sdp === 'string' && payload.sdp.length <= 8192)
          || (signalType === 'candidate'
            && typeof payload.candidate === 'string' && payload.candidate.length <= 4096));
      if (!['offer', 'answer', 'candidate'].includes(signalType)
          || !validSignalPayload
          || JSON.stringify(payload).length > 8192
          || (signalType === 'offer' && Number(call.caller_id) !== Number(identity.id))
          || (signalType === 'answer' && Number(call.callee_id) !== Number(identity.id))
          || !['ringing', 'active'].includes(call.status)) {
        return json({ status: 'error', message: 'Sinyal panggilan tidak valid.' }, 400);
      }
      const recipientId = Number(call.caller_id) === Number(identity.id) ? Number(call.callee_id) : Number(call.caller_id);
      const createdSignal = await dbQuery(db,
        `INSERT INTO internal_chat_call_signals (call_id, sender_id, recipient_id, signal_type, payload)
         VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id`,
        [callId, identity.id, recipientId, signalType, JSON.stringify(payload)]
      );
      return json({ status: 'success', signal_id: Number(createdSignal[0].id) });
    }

    if (body.action === 'direct') {
      const peerId = Number(body.user_id);
      if (!isValidId(peerId) || peerId === Number(identity.id)) {
        return json({ status: 'error', message: 'Kontak tidak valid.' }, 400);
      }
      const peer = await dbQuery(db,
        `SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL AND is_active = TRUE
         AND role IN ('admin', 'sppg')
         AND (role <> 'sppg' OR LOWER(COALESCE(status_verifikasi, '')) = 'approved')`,
        [peerId]
      );
      if (!peer.length) return json({ status: 'error', message: 'Akun ini tidak tersedia untuk komunikasi internal.' }, 404);
      const ownerId = Number(identity.id);
      const directKey = `${Math.min(ownerId, peerId)}:${Math.max(ownerId, peerId)}`;
      const rows = await dbQuery(db,
        `WITH conversation AS (
           INSERT INTO internal_chat_conversations (kind, direct_key, created_by)
           VALUES ('direct', $1, $2)
           ON CONFLICT (direct_key) DO UPDATE SET direct_key = EXCLUDED.direct_key
           RETURNING id
         ), membership AS (
           INSERT INTO internal_chat_members (conversation_id, user_id)
           SELECT conversation.id, member.user_id
           FROM conversation CROSS JOIN UNNEST(ARRAY[$2::bigint, $3::bigint]) AS member(user_id)
           ON CONFLICT (conversation_id, user_id) DO NOTHING
           RETURNING user_id
         )
         SELECT id FROM conversation`,
        [directKey, ownerId, peerId]
      );
      return json({ status: 'success', conversation_id: Number(rows[0].id) });
    }

    if (body.action === 'group') {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const rawIds = Array.isArray(body.member_ids) ? body.member_ids : [];
      const memberIds = [...new Set(rawIds.map(Number).filter(isValidId))]
        .filter((id) => id !== Number(identity.id));
      if (!name || name.length > 120 || /[\u0000-\u001f\u007f]/u.test(name)) {
        return json({ status: 'error', message: 'Nama grup wajib diisi (maksimal 120 karakter).' }, 400);
      }
      if (memberIds.length < 2 || memberIds.length > 49) {
        return json({ status: 'error', message: 'Grup memerlukan 2 sampai 49 anggota selain Anda.' }, 400);
      }
      const eligible = await dbQuery(db,
        `SELECT id FROM users WHERE id = ANY($1::bigint[]) AND deleted_at IS NULL AND is_active = TRUE
         AND role IN ('admin', 'sppg')
         AND (role <> 'sppg' OR LOWER(COALESCE(status_verifikasi, '')) = 'approved')`,
        [memberIds]
      );
      const eligibleIds = eligible.map((row) => Number(row.id));
      if (eligibleIds.length !== memberIds.length) {
        return json({ status: 'error', message: 'Ada anggota yang tidak aktif atau bukan akun Admin/SPPG.' }, 400);
      }
      const allIds = [Number(identity.id), ...eligibleIds];
      const rows = await dbQuery(db,
        `WITH conversation AS (
           INSERT INTO internal_chat_conversations (kind, name, created_by)
           VALUES ('group', $1, $2) RETURNING id
         ), membership AS (
           INSERT INTO internal_chat_members (conversation_id, user_id)
           SELECT conversation.id, members.member_id
           FROM conversation CROSS JOIN UNNEST($3::bigint[]) AS members(member_id)
           RETURNING user_id
         )
         SELECT id FROM conversation`,
        [name, identity.id, allIds]
      );
      return json({ status: 'success', conversation_id: Number(rows[0].id) });
    }

    if (body.action === 'send') {
      const conversationId = Number(body.conversation_id);
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (!isValidId(conversationId) || !message || message.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(message)) {
        return json({ status: 'error', message: 'Pesan wajib diisi dan maksimal 2.000 karakter.' }, 400);
      }
      if (!await isMember(db, conversationId, Number(identity.id))) {
        return json({ status: 'error', message: 'Percakapan tidak ditemukan.' }, 404);
      }
      const rows = await dbQuery(db,
        `WITH inserted AS (
           INSERT INTO internal_chat_messages (conversation_id, sender_id, message)
           VALUES ($1, $2, $3) RETURNING id, conversation_id, sender_id, message, created_at
         ), updated AS (
           UPDATE internal_chat_conversations SET updated_at = NOW()
           WHERE id = $1 RETURNING id
         )
         SELECT inserted.id, inserted.conversation_id, inserted.sender_id, inserted.message, inserted.created_at,
                u.full_name AS sender_name, u.role AS sender_role, u.avatar_url
         FROM inserted JOIN users u ON u.id = inserted.sender_id`,
        [conversationId, identity.id, message]
      );
      return json({ status: 'success', data: rows[0] });
    }

    return json({ status: 'error', message: 'Aksi komunikasi tidak valid.' }, 400);
  } catch (error) {
    console.error('Internal chat service unavailable:', error?.message || error);
    return json({ status: 'error', message: 'Layanan komunikasi sementara tidak tersedia. Jalankan database/internal_chat.sql lalu coba lagi.' }, 503);
  }
}
