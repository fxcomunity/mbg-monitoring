import {
  inspectRequest, InspectionError, unsafeCrossOrigin,
  logSecurityEvent, isManuallyBlocked
} from './_security.js';

function rejection(status) {
  const messages = { 400: 'Invalid request body.', 403: 'Request denied.', 413: 'Request inspection limit exceeded.' };
  return new Response(JSON.stringify({ status: 'error', message: messages[status] }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-store' }
  });
}

export function securityHeaders(response, request) {
  // A WebSocket upgrade must retain its Cloudflare-specific webSocket property.
  if (response.status === 101) return response;
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'geolocation=(self), camera=(), microphone=(self)');
  // Intentionally no script-src/default-src: existing inline scripts and CDNs remain compatible.
  const baseline = "base-uri 'self'; object-src 'none'; form-action 'self'; frame-ancestors 'self'";
  const existing = headers.get('Content-Security-Policy');
  headers.set('Content-Security-Policy', existing ? `${existing}, ${baseline}` : baseline);
  if (new URL(request.url).protocol === 'https:') {
    headers.set('Strict-Transport-Security', 'max-age=31536000');
  }
  // These routes are same-origin; do not inherit wildcard CORS from API helpers.
  if (headers.get('Access-Control-Allow-Origin') === '*') {
    headers.delete('Access-Control-Allow-Origin');
    headers.delete('Access-Control-Allow-Credentials');
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export async function onRequest(context) {
  const { request, env, next } = context;
  let response;
  if (unsafeCrossOrigin(request)) {
    response = rejection(403);
  } else {
    try {
      const event = await inspectRequest(request);
      if (event) {
        const logging = logSecurityEvent(request, env, event);
        if (context.waitUntil) context.waitUntil(logging);
        else await logging;
        response = rejection(403);
      } else if (await isManuallyBlocked(request, env)) {
        response = rejection(403);
      } else {
        response = await next();
      }
    } catch (error) {
      if (!(error instanceof InspectionError)) throw error;
      response = rejection(error.status);
    }
  }
  return securityHeaders(response, request);
}
