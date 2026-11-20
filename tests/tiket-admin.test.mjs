import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet, onRequestPost } from '../functions/api/tiket.js';

const DATABASE_URL = 'postgres://test:test@localhost:5432/mbg_test';
const TOKEN = 'a'.repeat(64);

function neonResponse(rows) {
  const fields = Object.keys(rows[0] || {}).map(name => ({
    name,
    dataTypeID: typeof rows[0][name] === 'boolean' ? 16 : typeof rows[0][name] === 'number' ? 20 : 25
  }));
  return new Response(JSON.stringify({
    fields,
    rows: rows.map(row => fields.map(field => row[field.name] == null ? null : String(row[field.name])))
  }), { headers: { 'Content-Type': 'application/json' } });
}

function mockDatabase(t, role = 'admin') {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const query = JSON.parse(options.body);
    calls.push(query);
    if (/FROM auth_sessions s/i.test(query.query)) {
      return neonResponse([{
        id: 8,
        username: 'admin-test',
        name: 'Admin Test',
        role,
        sppg_name: null,
        avatar: null,
        avatar_status: 'approved',
        session_version: 2
      }]);
    }
    if (/INSERT INTO aduan_log/.test(query.query)) {
      return neonResponse([{ laporan_id: 17 }]);
    }
    if (/FROM laporan_aduan/.test(query.query)) {
      return neonResponse([{
        ticket_code: 'TKT-BGN-20261015-0123456789ABCDEF0123456789ABCDEF',
        reporter_name: 'Pelapor',
        reporter_role: 'wali',
        issue_category: 'menu',
        school_target: 'SD Negeri 1',
        incident_date: '2026-10-15',
        description: 'Isi laporan dari server',
        status: 'masuk',
        priority: 'sedang',
        satgas_notes: null
      }]);
    }
    return neonResponse([]);
  });
  return calls;
}

function context(request, role = 'admin') {
  return {
    request,
    env: {
      DATABASE_URL
    }
  };
}

test('aduan list requires an active admin session and returns server data', async t => {
  const calls = mockDatabase(t);
  const response = await onRequestGet(context(
    new Request('https://example.test/api/tiket?action=admin_list', {
      headers: { Cookie: `mbg_token=${TOKEN}` }
    })
  ));
  const responseText = await response.text();
  const body = JSON.parse(responseText);

  assert.equal(response.status, 200, responseText);
  assert.equal(body.status, 'success');
  assert.equal(body.data[0].ticket_code, 'TKT-BGN-20261015-0123456789ABCDEF0123456789ABCDEF');
  assert.match(calls[1].query, /ORDER BY created_at DESC\s+LIMIT 100/);
});

test('aduan list rejects non-admin sessions before reading reports', async t => {
  const calls = mockDatabase(t, 'user');
  const response = await onRequestGet(context(
    new Request('https://example.test/api/tiket?action=admin_list', {
      headers: { Cookie: `mbg_token=${TOKEN}` }
    }), 'user'
  ));

  assert.equal(response.status, 403);
  assert.equal(calls.length, 1);
});

test('admin aduan update atomically records status changes in the audit log', async t => {
  const calls = mockDatabase(t);
  const form = new FormData();
  form.set('action', 'admin_update');
  form.set('ticket_code', 'TKT-BGN-20261015-0123456789ABCDEF0123456789ABCDEF');
  form.set('status', 'verifikasi');
  form.set('satgas_notes', 'Sedang diverifikasi.');
  const response = await onRequestPost(context(
    new Request('https://example.test/api/tiket', {
      method: 'POST',
      headers: { Cookie: `mbg_token=${TOKEN}` },
      body: form
    })
  ));
  const responseText = await response.text();
  const body = JSON.parse(responseText);
  const write = calls[1];

  assert.equal(response.status, 200, responseText);
  assert.equal(body.status, 'success');
  assert.match(write.query, /FOR UPDATE/);
  assert.match(write.query, /INSERT INTO aduan_log/);
  assert.deepEqual(write.params.slice(0, 4), [
    'TKT-BGN-20261015-0123456789ABCDEF0123456789ABCDEF',
    'verifikasi',
    'Sedang diverifikasi.',
    'admin-test'
  ]);
});

test('admin aduan update rejects invalid statuses without a write query', async t => {
  const calls = mockDatabase(t);
  const form = new FormData();
  form.set('action', 'admin_update');
  form.set('ticket_code', 'ticket-1');
  form.set('status', 'invalid');
  const response = await onRequestPost(context(
    new Request('https://example.test/api/tiket', {
      method: 'POST',
      headers: { Cookie: `mbg_token=${TOKEN}` },
      body: form
    })
  ));

  assert.equal(response.status, 422);
  assert.equal(calls.length, 1);
});
