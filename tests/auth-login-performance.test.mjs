import test from 'node:test';
import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';
import { onRequest } from '../functions/api/auth_user.js';
import { hashPassword } from '../functions/api/_shared.js';

const DATABASE_URL = 'postgresql://test:test@db.example.test/test';
const SALT = '0123456789abcdef0123456789abcdef';

function mockLoginDatabase(t, { blocked = false, password = 'CorrectPassword123!' } = {}) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const call = JSON.parse(options.body);
    calls.push(call);

    let rows = [];
    if (/LEFT JOIN auth_ip_lockouts/.test(call.query)) {
      rows = [{
        lockout_blocked: blocked,
        lockout_failed_attempts: blocked ? 5 : 0,
        lockout_blocked_until: blocked ? '2026-11-20T01:00:00Z' : null,
        lockout_permanent: false,
        user_id: blocked ? null : 123,
        username: 'testuser',
        full_name: 'Test User',
        email: 'test@example.com',
        role: 'user',
        sppg_name: null,
        password_hash: await hashPassword(password, SALT),
        salt: SALT,
        avatar_url: null,
        avatar_status: 'approved',
        status_verifikasi: 'approved',
        session_version: 0
      }];
    } else if (/mbg_pbkdf2_sha256/.test(call.query)) {
      const [candidatePassword, salt, iterations, outputLength] = call.params;
      rows = [{
        digest: pbkdf2Sync(candidatePassword, salt, Number(iterations), Number(outputLength), 'sha256').toString('hex')
      }];
    } else if (/INSERT INTO auth_security_events/.test(call.query)) {
      rows = [{ ip: '203.0.113.10', failed_attempts: 1, blocked_until: null, permanent: false, blocked: false }];
    }

    const keys = Object.keys(rows[0] || {});
    return new Response(JSON.stringify({
      fields: keys.map(name => ({
        name,
        dataTypeID: typeof rows[0][name] === 'boolean' ? 16 : typeof rows[0][name] === 'number' ? 20 : 25
      })),
      rows: rows.map(row => keys.map(key => row[key] == null ? null : String(row[key])))
    }), { headers: { 'Content-Type': 'application/json' } });
  });
  return calls;
}

function loginRequest() {
  return new Request('https://example.test/api/auth_user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.10' },
    body: JSON.stringify({ action: 'login', username: 'testuser', password: 'CorrectPassword123!' })
  });
}

test('successful login checks lockout and account in one query, then writes success metadata atomically', async t => {
  const calls = mockLoginDatabase(t);
  const response = await onRequest({
    request: loginRequest(),
    env: { DATABASE_URL }
  });

  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'success');
  assert.equal(calls.length, 5);
  assert.match(calls[0].query, /LEFT JOIN auth_ip_lockouts/);
  assert.match(calls[0].query, /FROM users/);
  assert.match(calls[1].query, /mbg_pbkdf2_sha256/);
  assert.match(calls[2].query, /WITH reset_lockout AS/);
  assert.match(calls[2].query, /INSERT INTO auth_security_events/);
  assert.match(calls[3].query, /DELETE FROM auth_sessions/);
  assert.match(calls[4].query, /INSERT INTO auth_sessions/);
  assert.match(calls[4].params[0], /^[a-f0-9]{64}$/);
});

test('blocked login returns without querying account data', async t => {
  const calls = mockLoginDatabase(t, { blocked: true });
  const response = await onRequest({
    request: loginRequest(),
    env: { DATABASE_URL }
  });

  assert.equal(response.status, 429);
  assert.equal(calls.length, 1);
  assert.match(calls[0].query, /LEFT JOIN auth_ip_lockouts/);
});

test('failed login records the lockout update and security event in one query', async t => {
  const calls = mockLoginDatabase(t, { password: 'DifferentPassword123!' });
  const response = await onRequest({
    request: loginRequest(),
    env: { DATABASE_URL }
  });

  assert.equal(response.status, 401);
  assert.equal(calls.length, 3);
  assert.match(calls[2].query, /WITH updated_lockout AS/);
  assert.match(calls[2].query, /INSERT INTO auth_security_events/);
});
