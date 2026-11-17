import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scanText, normalize, inspectRequest, readBounded, InspectionError,
  BODY_LIMIT, MULTIPART_LIMIT, unsafeCrossOrigin, trustedMetadata
} from '../functions/_security.js';

const request = (body, contentType = 'application/json') => new Request('https://example.test/api/example', {
  method: 'POST', headers: { 'Content-Type': contentType }, body
});

test('pure scanner recognizes high-confidence SQLi, XSS and normalized traversal', () => {
  for (const value of ["' OR 1=1 --", 'UNION/**/SELECT password FROM users', '; DROP TABLE users', 'pg_sleep(5)']) {
    assert.equal(scanText(value), 'sqli', value);
  }
  for (const value of ['<script>alert(1)</script>', '<svg onload=alert(1)>', 'javascript:alert(1)', '&amp;lt;script&amp;gt;']) {
    assert.equal(scanText(value), 'xss', value);
  }
  for (const value of ['../../etc/passwd', '..\\windows\\system.ini', '%252e%252e%252fetc/passwd']) {
    assert.equal(scanText(value), 'traversal', value);
  }
  assert.equal(normalize('%253Cscript%253E'), '<script>');
  assert.equal(scanText('%broken%253Cscript%253E'), 'xss');
});

test('ordinary strings are not broad SQL keyword matches', () => {
  for (const value of ["O'Reilly", 'select a menu', 'A union of teams', '1=1', 'hello@example.test', '<p>Lunch</p>']) {
    assert.equal(scanText(value), null, value);
  }
});

test('query keys and values are inspected even on direct GET requests', async () => {
  for (const query of ['q=%253Cscript%253E', '%3Cscript%3E=value', 'file=..%2F..%2Fetc%2Fpasswd']) {
    const result = await inspectRequest(new Request(`https://example.test/?${query}`));
    assert.match(result.inputField, /^server:query\.(key|value)$/);
  }
});

test('nested JSON keys, arrays and strings are inspected', async () => {
  assert.deepEqual(await inspectRequest(request(JSON.stringify({ nested: [{ comment: '<svg onload=alert(1)>' }] }))), {
    type: 'xss', inputField: 'server:json.value'
  });
  assert.deepEqual(await inspectRequest(request(JSON.stringify({ '<script>': 'hello' }))), {
    type: 'xss', inputField: 'server:json.key'
  });
});

test('JSON inspection cannot be bypassed by changing or omitting Content-Type', async () => {
  for (const contentType of ['text/plain', 'application/octet-stream', 'application/x-www-form-urlencoded']) {
    assert.equal((await inspectRequest(request(JSON.stringify({ comment: '<script>' }), contentType))).type, 'xss');
  }
  const original = request(JSON.stringify({ comment: '<script>' }));
  original.headers.delete('Content-Type');
  assert.equal((await inspectRequest(original)).type, 'xss');
});

test('password and credential values/subtrees are excluded in every supported format', async () => {
  const attack = '<script> UNION SELECT ../../private';
  assert.equal(await inspectRequest(new Request(`https://example.test/?password=${encodeURIComponent(attack)}&access_token=${encodeURIComponent(attack)}`)), null);
  assert.equal(await inspectRequest(request(JSON.stringify({
    password: attack, oldPassword: attack, new_password: attack, pwd: attack,
    confirmPassword: attack, token: attack, secret: { nested: attack }, comment: 'safe'
  }))), null);
  const form = new URLSearchParams({ password: attack, new_password: attack, token: attack, comment: 'safe' });
  assert.equal(await inspectRequest(request(form, 'application/x-www-form-urlencoded')), null);
  const multipart = new FormData();
  multipart.set('password', attack);
  multipart.set('description', 'safe');
  assert.equal(await inspectRequest(new Request('https://example.test/upload', { method: 'POST', body: multipart })), null);
});

test('urlencoded form strings and keys are inspected', async () => {
  const value = new URLSearchParams({ comment: "' OR 1=1 --" });
  assert.equal((await inspectRequest(request(value, 'application/x-www-form-urlencoded'))).type, 'sqli');
  const key = new URLSearchParams({ '<script>': 'hello' });
  assert.equal((await inspectRequest(request(key, 'application/x-www-form-urlencoded'))).inputField, 'server:form.key');
});

test('clone scanning preserves the exact body for downstream handlers', async () => {
  const body = JSON.stringify({ title: 'Lunch', password: '<script>allowed-password' });
  const original = request(body);
  assert.equal(await inspectRequest(original), null);
  assert.equal(original.bodyUsed, false);
  assert.equal(await original.text(), body);
});

test('body limits count streamed bytes without trusting Content-Length', async () => {
  const original = request('x'.repeat(BODY_LIMIT + 1), 'application/octet-stream');
  await assert.rejects(inspectRequest(original), error => error instanceof InspectionError && error.status === 413);
  const lied = request('abcdef', 'text/plain');
  lied.headers.set('Content-Length', '1');
  await assert.rejects(readBounded(lied, 5), error => error.status === 413);
  const declared = request('x');
  declared.headers.set('Content-Length', String(BODY_LIMIT + 1));
  await assert.rejects(inspectRequest(declared), error => error.status === 413);
});

test('malformed and overly complex JSON fail closed', async () => {
  await assert.rejects(inspectRequest(request('{broken')), error => error.status === 400);
  const deep = '['.repeat(34) + '0' + ']'.repeat(34);
  await assert.rejects(inspectRequest(request(deep)), error => error.status === 413);
  await assert.rejects(inspectRequest(request(JSON.stringify(Array(10001).fill(0)))), error => error.status === 413);
});

test('multipart permits bounded larger files but scans only metadata', async () => {
  const form = new FormData();
  form.set('file', new Blob(['<script>' + 'x'.repeat(BODY_LIMIT)]), 'lunch.txt');
  form.set('description', 'Lunch');
  const original = new Request('https://example.test/upload', { method: 'POST', body: form });
  assert.equal(await inspectRequest(original), null);
  const downstream = await original.formData();
  assert.equal((await downstream.get('file').text()).startsWith('<script>'), true);

  const bad = new FormData();
  bad.set('file', new Blob(['safe bytes']), '<script>.txt');
  assert.equal((await inspectRequest(new Request('https://example.test/upload', { method: 'POST', body: bad }))).inputField, 'server:form.filename');
  const badText = new FormData();
  badText.set('comment', '<svg onload=alert(1)>');
  assert.equal((await inspectRequest(new Request('https://example.test/upload', { method: 'POST', body: badText }))).type, 'xss');

  const tooMuchMetadata = new FormData();
  tooMuchMetadata.set('description', 'x'.repeat(BODY_LIMIT));
  await assert.rejects(inspectRequest(new Request('https://example.test/upload', { method: 'POST', body: tooMuchMetadata })), error => error.status === 413);

  const tooLarge = new FormData();
  tooLarge.set('file', new Blob(['x'.repeat(MULTIPART_LIMIT)]), 'large.bin');
  await assert.rejects(inspectRequest(new Request('https://example.test/upload', { method: 'POST', body: tooLarge })), error => error.status === 413);
});

test('attack report content is not classified as a server attack', async () => {
  const report = new Request('https://example.test/api/security/log?q=%3Cscript%3E', {
    method: 'POST', body: JSON.stringify({ type: 'xss', indicator: '<script> UNION SELECT ../../etc/passwd' })
  });
  assert.equal(await inspectRequest(report), null);
  assert.equal(report.bodyUsed, false);
});

test('same-origin browser checks reject cross-site writes but allow native no-Origin requests', () => {
  const make = headers => new Request('https://example.test/api/example', { method: 'POST', headers });
  assert.equal(unsafeCrossOrigin(make({ Origin: 'https://evil.test' })), true);
  assert.equal(unsafeCrossOrigin(make({ Origin: 'null' })), true);
  assert.equal(unsafeCrossOrigin(make({ 'Sec-Fetch-Site': 'same-site' })), true);
  assert.equal(unsafeCrossOrigin(make({ 'Sec-Fetch-Site': 'cross-site' })), true);
  assert.equal(unsafeCrossOrigin(make({ Origin: 'https://example.test', 'Sec-Fetch-Site': 'same-origin' })), false);
  assert.equal(unsafeCrossOrigin(make({})), false);
});

test('metadata excludes all URL query, path secrets, UA and untrusted geo headers', () => {
  const original = new Request('https://example.test/reset/SECRET?token=PRIVATE&password=HIDDEN', {
    headers: { 'CF-Connecting-IP': '203.0.113.10', 'CF-IPCountry': 'ID', 'User-Agent': 'SECRET-UA', 'X-City': 'SPOOF' }
  });
  Object.defineProperty(original, 'cf', { value: { country: 'US', region: 'Jakarta', city: 'Jakarta' } });
  assert.deepEqual(trustedMetadata(original), {
    ip: '203.0.113.10', country: 'ID', region: 'Jakarta', city: 'Jakarta', path: '/[other]'
  });
  assert.equal(/SECRET|PRIVATE|HIDDEN|SPOOF/.test(JSON.stringify(trustedMetadata(original))), false);
});
