/**
 * Standalone same-origin security API, sharing Pages inspection and handlers.
 * Bindings: DATABASE_URL, SESSIONS (shared with auth), optional RATE KV.
 */
import { onRequest as middleware, securityHeaders } from '../functions/_middleware.js';
import {
  inspectRequest, InspectionError, isManuallyBlocked, logSecurityEvent, trustedMetadata
} from '../functions/_security.js';
import { onRequestPost as logReport } from '../functions/api/security/log.js';
import { onRequestGet as listThreats } from '../functions/api/security_threats.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-store' }
  });
}

async function checkStatus(request, env) {
  // A blocked IP must still be able to read its status. Inspect this read-only
  // route explicitly because the middleware would reject it before next().
  let response;
  try {
    const event = await inspectRequest(request);
    if (event) {
      await logSecurityEvent(request, env, event);
      response = json({ status: 'error', message: 'Request denied.' }, 403);
    } else {
      response = json({ blocked: await isManuallyBlocked(request, env), ip: trustedMetadata(request).ip });
    }
  } catch (error) {
    if (!(error instanceof InspectionError)) throw error;
    response = json({
      status: 'error',
      message: error.status === 413 ? 'Request inspection limit exceeded.' : 'Invalid request body.'
    }, error.status);
  }
  return securityHeaders(response, request);
}

async function route(context) {
  const { request } = context;
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  // The Pages report handler uses readBounded, advisoryRateAllowed and
  // logSecurityEvent; arbitrary client fields never become evidence or bans.
  if (request.method === 'POST' && path === '/api/security/log') return logReport(context);
  if (request.method === 'GET' && path === '/api/security/threats') return listThreats(context);
  return json({ status: 'error', message: 'Endpoint tidak dikenal.' }, 404);
}

export default {
  async fetch(request, env, executionContext) {
    const path = new URL(request.url).pathname.replace(/\/+$/, '');
    if (request.method === 'GET' && path === '/api/security/check') {
      return checkStatus(request, env);
    }
    const context = {
      request,
      env,
      ...(executionContext ? { waitUntil: promise => executionContext.waitUntil(promise) } : {})
    };
    return middleware({ ...context, next: () => route(context) });
  }
};
