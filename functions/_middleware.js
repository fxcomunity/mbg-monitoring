/**
 * Cloudflare Pages Middleware
 * - Pasang CORS + security headers ke semua response
 * - /ws route diteruskan ke Durable Object MapRoom
 */
export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);

  // WebSocket upgrade → teruskan ke ws.js handler
  if (url.pathname === '/ws') {
    return context.next();
  }

  const response = await next();

  // Security + CORS headers
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
