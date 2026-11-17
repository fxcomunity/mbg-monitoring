import { json } from '../_shared.js';
import {
  readBounded, REPORT_LIMIT, InspectionError, trustedMetadata,
  advisoryRateAllowed, logSecurityEvent
} from '../../_security.js';

const ALLOWED_TYPES = new Set(['xss', 'scrape', 'bot', 'inject', 'sqli', 'traversal', 'csrf', 'brute_force', 'honeypot']);

export async function onRequestPost({ request, env }) {
  const { ip } = trustedMetadata(request);
  if (!await advisoryRateAllowed(env, ip)) {
    return new Response(JSON.stringify({ status: 'error', message: 'Report rate exceeded.' }), {
      status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60', 'Cache-Control': 'no-store' }
    });
  }
  let body;
  try {
    const bytes = await readBounded(request, REPORT_LIMIT);
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    return json({ status: 'error', message: 'Invalid report.' }, error instanceof InspectionError ? error.status : 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ status: 'error', message: 'Report must be an object.' }, 400);
  }
  // All arbitrary report fields (indicator, URL, payload, password, etc.) are discarded.
  const type = typeof body.type === 'string' && ALLOWED_TYPES.has(body.type) ? body.type : 'unknown';
  const logged = await logSecurityEvent(request, env, { type, inputField: `client:${type}` });
  if (!logged) return json({ status: 'error', message: 'Security logging unavailable.' }, 503);
  return json({ status: 'logged', advisory: true, blocked: false });
}

export async function onRequest({ request }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  return json({ status: 'error', message: 'Method tidak diizinkan.' }, 405);
}
