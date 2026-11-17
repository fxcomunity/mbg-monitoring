import { dbQuery } from './api/_shared.js';

export const BODY_LIMIT = 256 * 1024;
export const MULTIPART_LIMIT = 5 * 1024 * 1024;
export const REPORT_LIMIT = 16 * 1024;
const blockedCache = new Map();
const SAFE_PATHS = new Set(['/api/security/log', '/api/security_threats', '/api/auth_user', '/api/change_password', '/ws', '/']);

export class InspectionError extends Error {
  constructor(status) {
    super('Request inspection rejected');
    this.status = status;
  }
}

export function normalize(value) {
  let text = String(value);
  for (let i = 0; i < 2; i++) {
    // Decode valid byte runs even when another part of the input has a bad escape.
    text = text.replace(/(?:%[0-9a-f]{2})+/gi, run => {
      try { return decodeURIComponent(run); } catch { return run; }
    }).replace(/&#(x[0-9a-f]+|[0-9]+);?/gi, (match, code) => {
      const number = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code);
      return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : match;
    }).replace(/&(lt|gt|quot|apos|amp|colon|tab|newline);/gi, (_, name) => ({
      lt: '<', gt: '>', quot: '"', apos: "'", amp: '&', colon: ':', tab: '\t', newline: '\n'
    })[name.toLowerCase()]).replace(/\\u([0-9a-f]{4})/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
  }
  return text.replace(/\0/g, '').normalize('NFKC');
}

function secretKey(key) {
  return /password|passwd|passphrase|pwd|token|secret|authorization|cookie|api[_-]?key|^pass$/i.test(normalize(key));
}

export function scanText(value) {
  const text = normalize(value);
  if (/(?:\.\.[/\\])/.test(text)) return 'traversal';
  if (/<\s*(?:script|iframe|object|embed)\b|<[^<>]*\bon[a-z]+\s*=|(?:javascript|vbscript)\s*:|data\s*:\s*text\/html/i.test(text)) return 'xss';
  // Linear comment removal avoids regex rescans on many unterminated /* markers.
  const parts = [];
  let offset = 0;
  while (true) {
    const start = text.indexOf('/*', offset);
    if (start === -1) break;
    const end = text.indexOf('*/', start + 2);
    if (end === -1) break;
    parts.push(text.slice(offset, start), ' ');
    offset = end + 2;
  }
  parts.push(text.slice(offset));
  const sql = parts.join('');
  if (/\bunion\s+(?:all\s+)?select\b|;\s*(?:drop|truncate|alter)\s+(?:table|database)\b|\b(?:pg_sleep|sleep|benchmark)\s*\(/i.test(sql) ||
      /['"\d)]\s*(?:or|and)\s+(\d+)\s*=\s*\1\b/i.test(sql) ||
      /['"]\s*(?:or|and)\s+(['"])([^'"\s]{1,64})\1\s*=\s*\1\2\1/i.test(sql)) return 'sqli';
  return null;
}

function finding(value, source) {
  const type = scanText(value);
  return type ? { type, inputField: `server:${source}` } : null;
}

export async function readBounded(request, limit) {
  const length = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(length) && length > limit) throw new InspectionError(413);
  if (!request.body) return new Uint8Array();
  const reader = request.clone().body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new InspectionError(413);
      chunks.push(value);
    }
  } finally {
    // Awaiting cancellation of one branch of a tee can wait for the handler forever.
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function scanJSON(root) {
  const stack = [{ value: root, depth: 0 }];
  let nodes = 0;
  while (stack.length) {
    const { value, depth } = stack.pop();
    if (++nodes > 10000 || depth > 32) throw new InspectionError(413);
    if (typeof value === 'string') {
      const match = finding(value, 'json.value');
      if (match) return match;
    } else if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        const match = finding(key, 'json.key');
        if (match) return match;
        if (!secretKey(key)) stack.push({ value: child, depth: depth + 1 });
      }
    }
  }
  return null;
}

export function isReportRequest(request) {
  return new URL(request.url).pathname.replace(/\/+$/, '') === '/api/security/log';
}

export async function inspectRequest(request) {
  // Reports describe attacks; scanning their content would turn telemetry into attacks.
  if (isReportRequest(request)) return null;
  const url = new URL(request.url);
  if (new TextEncoder().encode(url.search).byteLength > BODY_LIMIT) throw new InspectionError(413);
  for (const [key, value] of url.searchParams) {
    const match = finding(key, 'query.key') || (!secretKey(key) && finding(value, 'query.value'));
    if (match) return match;
  }
  if (!request.body) return null;
  const contentType = request.headers.get('Content-Type') || '';
  const multipart = /^multipart\/form-data\b/i.test(contentType);
  const bytes = await readBounded(request, multipart ? MULTIPART_LIMIT : BODY_LIMIT);
  if (!bytes.length) return null;
  const text = multipart ? '' : new TextDecoder().decode(bytes);
  // request.json() works without a JSON Content-Type. Sniff JSON too so a native
  // client cannot bypass inspection just by omitting or changing that header.
  if (!multipart && (/^application\/(?:[\w.-]+\+)?json\b/i.test(contentType) || /^\s*[\[{\"]/.test(text))) {
    let body;
    try { body = JSON.parse(text); } catch { throw new InspectionError(400); }
    return scanJSON(body);
  }
  if (multipart || /^application\/x-www-form-urlencoded\b/i.test(contentType)) {
    let form;
    try {
      form = multipart
        ? await new Response(bytes, { headers: { 'Content-Type': contentType } }).formData()
        : new URLSearchParams(text);
    } catch { throw new InspectionError(400); }
    let metadataSize = 0;
    let fields = 0;
    for (const [key, value] of form) {
      // Files are opaque: inspect only their field name and filename, never bytes.
      const metadata = typeof value === 'string' ? value : value.name;
      metadataSize += new TextEncoder().encode(key + metadata).byteLength;
      if (++fields > 10000 || metadataSize > BODY_LIMIT) throw new InspectionError(413);
      const match = finding(key, 'form.key') || (!secretKey(key) && finding(metadata, typeof value === 'string' ? 'form.value' : 'form.filename'));
      if (match) return match;
    }
    return null;
  }
  // Opaque bodies are bounded but not interpreted, to avoid scanning passwords or files.
  return null;
}

export function unsafeCrossOrigin(request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return false;
  const origin = request.headers.get('Origin');
  const site = request.headers.get('Sec-Fetch-Site');
  if (site && !['same-origin', 'none'].includes(site)) return true;
  if (!origin) return false; // Native clients need not send browser origin headers.
  try { return new URL(origin).origin !== new URL(request.url).origin; } catch { return true; }
}

function bounded(value, length) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, length) : null;
}

export function trustedMetadata(request) {
  const rawIP = request.headers.get('CF-Connecting-IP') || '';
  const ip = rawIP.length <= 45 && /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^[0-9a-f]*:[0-9a-f:]+$/i.test(rawIP) ? rawIP : null;
  const country = request.headers.get('CF-IPCountry') || request.cf?.country || '';
  const pathname = new URL(request.url).pathname.replace(/\/+$/, '') || '/';
  return {
    ip,
    country: /^[A-Z]{2}$/.test(country) ? country : null,
    region: bounded(request.cf?.region, 100),
    city: bounded(request.cf?.city, 100),
    // Even path segments can contain credentials. Never persist arbitrary URL text.
    path: SAFE_PATHS.has(pathname) ? pathname : pathname.startsWith('/api/') ? '/api/[other]' : '/[other]'
  };
}

export async function logSecurityEvent(request, env, event) {
  const meta = trustedMetadata(request);
  if (!env.DATABASE_URL) return false;
  try {
    await dbQuery(env.DATABASE_URL, `
      INSERT INTO exploit_logs (
        ip_address, user_agent, exploit_type, input_field, payload_sample,
        requested_url, country, region, city
      ) VALUES ($1, NULL, $2, $3, NULL, $4, $5, $6, $7)
    `, [meta.ip, event.type, event.inputField, meta.path, meta.country, meta.region, meta.city]);
    return true;
  } catch {
    // Do not print DB errors: upstream errors can contain query parameters/secrets.
    console.error('Security metadata logging unavailable');
    return false;
  }
}

export async function advisoryRateAllowed(env, ip) {
  if (!env.RATE || !ip) return true;
  try {
    const key = `security:report:${ip}:${Math.floor(Date.now() / 60000)}`;
    const count = Number(await env.RATE.get(key)) || 0;
    if (count >= 20) return false;
    await env.RATE.put(key, String(count + 1), { expirationTtl: 120 });
  } catch {
    // KV is non-atomic/eventually consistent; telemetry must not depend on it.
  }
  return true;
}

export async function isManuallyBlocked(request, env) {
  const url = new URL(request.url);
  // No DB lookup for ordinary static assets/pages. No automatic ban writes anywhere.
  if ((!url.pathname.startsWith('/api/') && url.pathname !== '/ws' && ['GET', 'HEAD', 'OPTIONS'].includes(request.method)) || !env.DATABASE_URL) return false;
  const { ip } = trustedMetadata(request);
  if (!ip) return false;
  const cached = blockedCache.get(ip);
  if (cached && cached.until > Date.now()) return cached.blocked;
  try {
    const rows = await dbQuery(env.DATABASE_URL, `
      SELECT EXISTS (SELECT 1 FROM security_blocked_ips
        WHERE ip_address = $1 AND expires_at > NOW()) AS blocked
    `, [ip]);
    const blocked = rows[0]?.blocked === true || rows[0]?.blocked === 't';
    if (blockedCache.size >= 512) blockedCache.delete(blockedCache.keys().next().value);
    blockedCache.set(ip, { blocked, until: Date.now() + 60000 });
    return blocked;
  } catch {
    // Missing migration/DB outage must not take down unrelated application routes.
    return false;
  }
}
