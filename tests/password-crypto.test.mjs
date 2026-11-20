import test from 'node:test';
import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';
import { hashPassword, verifyPassword } from '../functions/api/_shared.js';

const PASSWORD = 'Test-Password-310k!';
const SALT = '0123456789abcdef0123456789abcdef';
const ITERATIONS = 310000;

test('verifies existing 310,000-iteration PBKDF2 SHA-256 credentials', async () => {
  const digest = pbkdf2Sync(PASSWORD, SALT, ITERATIONS, 64, 'sha256').toString('hex');
  const storedHash = `pbkdf2_sha256$${ITERATIONS}$${SALT}$${digest}`;

  assert.equal(await verifyPassword(PASSWORD, storedHash), true);
  assert.equal(await verifyPassword('wrong-password', storedHash), false);
});

test('verifies legacy 32-byte PBKDF2 hashes', async () => {
  const digest = pbkdf2Sync(PASSWORD, SALT, ITERATIONS, 32, 'sha256').toString('hex');
  const storedHash = `pbkdf2_sha256$${ITERATIONS}$${SALT}$${digest}`;

  assert.equal(await verifyPassword(PASSWORD, storedHash), true);
});

test('new password hashes retain the existing 310,000-iteration storage format', async () => {
  const storedHash = await hashPassword(PASSWORD, SALT);

  assert.match(storedHash, /^pbkdf2_sha256\$310000\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
  assert.equal(await verifyPassword(PASSWORD, storedHash), true);
});
