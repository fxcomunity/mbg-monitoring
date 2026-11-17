import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest, securityHeaders } from '../functions/_middleware.js';
import { onRequestPost } from '../functions/api/security/log.js';
import { onRequestGet } from '../functions/api/security_threats.js';
import { REPORT_LIMIT } from '../functions/_security.js';

const DATABASE_URL = 'postgresql://test:password@db.example.test/test';
function mockDB(t, rows = []) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const call = JSON.parse(options.body);
    calls.push(call);
    const result = typeof rows === 'function' ? rows(call) : rows;
    return new Response(JSON.stringify({ rows: result }), { headers: { 'Content-Type': 'application/json' } });
  });
  return calls;
}
const reportRequest = body => new Request('https://example.test/api/security/log?token=QUERY-SECRET', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.20', 'CF-IPCountry': 'ID', 'User-Agent': 'UA-SECRET' },
  body: JSON.stringify(body)
});

async function middleware(request, env = {}, handler = () => new Response('handler')) {
  let called = false;
  const tasks = [];
  const response = await onRequest({ request, env,
    next: async () => { called = true; return handler(); },
    waitUntil: task => tasks.push(task)
  });
  await Promise.all(tasks);
  return { response, called };
}

test('direct native/browser-JS-disabled requests are blocked before handler and logged parametrically', async t => {
  const calls = mockDB(t);
  const original = new Request('https://example.test/api/search?token=QUERY-SECRET', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.21', 'User-Agent': 'UA-SECRET' },
    body: JSON.stringify({ nested: { comment: "' OR 1=1 --", password: 'PASSWORD-SECRET' } })
  });
  const { response, called } = await middleware(original, { DATABASE_URL });
  assert.equal(response.status, 403);
  assert.equal(called, false);
  assert.equal(calls.length, 1);
  assert.match(calls[0].query, /INSERT INTO exploit_logs/);
  assert.match(calls[0].query, /VALUES \(\$1, NULL, \$2, \$3, NULL/);
  assert.deepEqual(calls[0].params, ['203.0.113.21', 'sqli', 'server:json.value', '/api/[other]', null, null, null]);
  assert.equal(/QUERY-SECRET|UA-SECRET|PASSWORD-SECRET|OR 1=1/.test(JSON.stringify(calls)), false);
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
});

test('server blocking still works without DATABASE_URL', async () => {
  const { response, called } = await middleware(new Request('https://example.test/?q=%3Cscript%3E'));
  assert.equal(response.status, 403);
  assert.equal(called, false);
});

test('changing Content-Type does not bypass the pre-handler JSON scan', async () => {
  const original = new Request('https://example.test/api/example', {
    method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ comment: '<script>' })
  });
  const result = await middleware(original);
  assert.equal(result.response.status, 403);
  assert.equal(result.called, false);
});

test('database logging failures do not let attacks reach handlers', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('database unavailable'); });
  t.mock.method(console, 'error', () => {});
  const result = await middleware(new Request('https://example.test/?q=%3Cscript%3E'), { DATABASE_URL });
  assert.equal(result.response.status, 403);
  assert.equal(result.called, false);
});

test('safe body reaches handler unchanged and static requests make no DB calls', async t => {
  const calls = mockDB(t);
  const body = JSON.stringify({ description: 'Lunch', password: '<script>' });
  const original = new Request('https://example.test/api/example', { method: 'POST', body, headers: { 'Content-Type': 'application/json' } });
  const result = await middleware(original, {}, async () => new Response(await original.text()));
  assert.equal(result.called, true);
  assert.equal(await result.response.text(), body);
  const staticResult = await middleware(new Request('https://example.test/assets/app.js', { headers: { 'CF-Connecting-IP': '203.0.113.22' } }), { DATABASE_URL });
  assert.equal(staticResult.called, true);
  assert.equal(calls.length, 0);
});

test('cross-origin writes are rejected before handlers, including reports', async () => {
  for (const path of ['/api/example', '/api/security/log']) {
    const original = new Request(`https://example.test${path}`, { method: 'POST', headers: { Origin: 'https://evil.test' }, body: '{}' });
    const result = await middleware(original);
    assert.equal(result.response.status, 403);
    assert.equal(result.called, false);
  }
});

test('headers preserve script/CDN compatibility and remove wildcard CORS credentials', () => {
  const response = securityHeaders(new Response('ok', { headers: {
    'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': 'true'
  } }), new Request('https://example.test/'));
  const csp = response.headers.get('Content-Security-Policy');
  for (const directive of ["base-uri 'self'", "object-src 'none'", "form-action 'self'", "frame-ancestors 'self'"]) assert.ok(csp.includes(directive));
  assert.equal(/script-src|default-src/.test(csp), false);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal(response.headers.get('Access-Control-Allow-Credentials'), null);
  assert.equal(response.headers.get('Strict-Transport-Security'), 'max-age=31536000');
  assert.equal(securityHeaders(new Response('ok'), new Request('http://example.test/')).headers.has('Strict-Transport-Security'), false);
});

test('client reports only insert advisory metadata and never count or ban', async t => {
  const calls = mockDB(t);
  const env = { DATABASE_URL };
  for (let i = 0; i < 4; i++) {
    const original = reportRequest({ type: 'xss', indicator: '<script>PAYLOAD-SECRET</script>', url: 'https://evil.test/?token=URL-SECRET', password: 'PASSWORD-SECRET' });
    const { response } = await middleware(original, env, () => onRequestPost({ request: original, env }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'logged', advisory: true, blocked: false });
  }
  const inserts = calls.filter(call => /INSERT INTO exploit_logs/.test(call.query));
  assert.equal(inserts.length, 4);
  for (const call of inserts) assert.equal(call.params[2], 'client:xss');
  assert.equal(/security_threat_counters|INSERT INTO security_blocked_ips|UPDATE security_blocked_ips/.test(JSON.stringify(calls)), false);
  assert.equal(/PAYLOAD-SECRET|URL-SECRET|QUERY-SECRET|PASSWORD-SECRET|UA-SECRET/.test(JSON.stringify(calls)), false);
});

test('report body size is bounded and RATE can best-effort throttle without database writes', async t => {
  const calls = mockDB(t);
  const large = reportRequest({ indicator: 'x'.repeat(REPORT_LIMIT) });
  assert.equal((await onRequestPost({ request: large, env: { DATABASE_URL } })).status, 413);
  const env = { DATABASE_URL, RATE: { get: async () => '20', put: async () => assert.fail('unexpected put') } };
  assert.equal((await onRequestPost({ request: reportRequest({ type: 'xss' }), env })).status, 429);
  assert.equal(calls.length, 0);
});

test('missing/failed RATE permits bounded advisory reports, not automatic bans', async t => {
  const calls = mockDB(t);
  const env = { DATABASE_URL, RATE: { get: async () => { throw new Error('unavailable'); } } };
  assert.equal((await onRequestPost({ request: reportRequest({ type: 'xss' }), env })).status, 200);
  assert.equal(calls.length, 1);
  assert.match(calls[0].query, /INSERT INTO exploit_logs/);
});

test('manual blocked-IP lookup is cached for API requests', async t => {
  const calls = mockDB(t, [{ blocked: true }]);
  for (let i = 0; i < 2; i++) {
    const original = new Request('https://example.test/api/example', { headers: { 'CF-Connecting-IP': '203.0.113.99' } });
    const result = await middleware(original, { DATABASE_URL });
    assert.equal(result.response.status, 403);
    assert.equal(result.called, false);
  }
  assert.equal(calls.length, 1);
  assert.match(calls[0].query, /SELECT EXISTS/);
});

function adminContext(session) {
  return {
    request: new Request('https://example.test/api/security_threats', { headers: { Cookie: `mbg_token=${'a'.repeat(64)}` } }),
    env: { DATABASE_URL, SESSIONS: { get: async () => JSON.stringify(session) } }
  };
}

test('threat list rejects non-admin, stale/demoted/deactivated and missing-username sessions', async t => {
  const calls = mockDB(t, []);
  assert.equal((await onRequestGet(adminContext({ username: 'user', role: 'sppg' }))).status, 403);
  assert.equal((await onRequestGet(adminContext({ role: 'admin' }))).status, 403);
  assert.equal(calls.length, 0);
  assert.equal((await onRequestGet(adminContext({ username: 'old-admin', role: 'admin' }))).status, 403);
  assert.equal(calls.length, 1);
  assert.match(calls[0].query, /active = TRUE/);
  assert.deepEqual(calls[0].params, ['old-admin']);
  assert.equal(/FROM exploit_logs/.test(calls[0].query), false);
});

test('threat list revalidates active admin before returning metadata', async t => {
  const calls = mockDB(t, call => /FROM users/.test(call.query) ? [{ role: 'admin' }] : [{ id: 1, source: 'server' }]);
  const response = await onRequestGet(adminContext({ username: 'admin', role: 'admin' }));
  assert.equal(response.status, 200);
  assert.equal(calls.length, 2);
  assert.match(calls[1].query, /t.input_field/);
  assert.doesNotMatch(calls[1].query, /payload_sample|user_agent/);
});
