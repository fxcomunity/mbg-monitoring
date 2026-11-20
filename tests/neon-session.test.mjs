import test from 'node:test';
import assert from 'node:assert/strict';
import { getSession, hashSessionToken } from '../functions/api/_shared.js';

const DATABASE_URL = 'postgres://test:test@localhost:5432/mbg_test';
const TOKEN = 'a'.repeat(64);

function neonResponse(rows) {
  const fields = Object.keys(rows[0] || {}).map(name => ({
    name,
    dataTypeID: typeof rows[0][name] === 'number' ? 20 : 25
  }));
  return new Response(JSON.stringify({
    fields,
    rows: rows.map(row => fields.map(field => row[field.name] == null ? null : String(row[field.name])))
  }), { headers: { 'Content-Type': 'application/json' } });
}

test('session tokens are stored as a SHA-256 digest', async () => {
  const digest = await hashSessionToken(TOKEN);
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.notEqual(digest, TOKEN);
  assert.equal(digest, await hashSessionToken(TOKEN));
});

test('session lookup uses Neon and does not require a KV binding', async t => {
  let query;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    query = JSON.parse(options.body);
    return neonResponse([{
      id: 8,
      username: 'admin@example.test',
      name: 'Admin Test',
      role: 'admin',
      sppg_name: null,
      avatar: null,
      avatar_status: 'approved',
      session_version: 3
    }]);
  });

  const session = await getSession(new Request('https://example.test/api/auth_user', {
    headers: { Cookie: `other=value; mbg_token=${TOKEN}` }
  }), { DATABASE_URL });

  assert.equal(session.username, 'admin@example.test');
  assert.equal(session.role, 'admin');
  assert.equal(session.session_version, 3);
  assert.match(query.query, /FROM auth_sessions s/);
  assert.match(query.query, /s\.token_hash = \$1/);
  assert.equal(query.params[0], await hashSessionToken(TOKEN));
});

test('session lookup skips Neon when the session cookie is absent', async () => {
  const session = await getSession(new Request('https://example.test/api/auth_user'), {
    DATABASE_URL
  });
  assert.equal(session, null);
});
