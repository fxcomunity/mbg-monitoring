# Cloudflare Pages request security

## Deploy and migrate

1. **Run `database/security_neon.sql` against Neon before deploying.** It preserves
   the existing `exploit_logs` basic columns and adds the geo columns if missing.
   It preserves the legacy counter table but removes bans with the exact old
   reason `Auto-block: 3 or more threats in 1 hour`. Manual bans are preserved.
   Review that cleanup before running the migration on a shared database.
2. Configure the Pages Functions `DATABASE_URL` secret and run
   `database/neon_auth_sessions.sql` before deploying the Neon-backed login.
   The Pages application does not need a `SESSIONS` KV binding. Optional `RATE`
   remains a **KV namespace**, matching the existing application binding, not a
   Workers rate-limiter binding. Keep `nodejs_compat` enabled in `wrangler.toml`:
   password verification uses Node.js PBKDF2 so existing 310,000-iteration
   password hashes work within Cloudflare's Web Crypto iteration limit.
3. Deploy the `functions/` directory with the Pages application. Ensure any Pages
   `_routes.json`/deployment route exclusions do not bypass `_middleware.js` for
   protected requests. A separate Worker or PHP origin is not protected by this
   implementation; neither is changed here.
4. Smoke-test the deployed Pages hostname with native HTTP requests as well as a
   browser. No client-side JavaScript is required for blocking.

The migration is rerunnable. It does **not** scrub historical payload samples or
user agents: review and purge those separately according to your retention policy.
No new SQL columns or database credentials are embedded in the JavaScript.

## Server-side enforcement

`functions/_middleware.js` runs before route handlers, including before the `/ws`
upgrade handler. `functions/_security.js` performs the inspection:

- Inspect URL query **keys and values**, nested JSON keys/string values (including
  arrays), URL-encoded forms, and multipart text fields/field names/filenames.
- Normalize twice (percent escapes, supported HTML entities, Unicode escapes),
  then match high-confidence SQLi, executable XSS markup/protocols, and `../` or
  `..\` traversal. Ordinary words such as `select` and apostrophes alone do not
  trigger SQLi detection.
- Password-like keys (`password`, `oldPassword`, `passwd`, `pwd`, etc.) and
  credential/token/secret keys exclude their **values and nested subtrees** from
  scanning. Suspicious key names themselves can still be rejected. This exclusion
  is deliberately conservative and applies to query, JSON, and forms.
- JSON-looking bodies are inspected even when their Content-Type is missing or
  misleading: changing the header cannot bypass a handler using `request.json()`.
- Read a **clone** of the request body as a bounded stream, leaving the original
  available to the downstream handler. Ordinary bodies and encoded query strings
  are limited to 256 KiB. Multipart bodies allow 5 MiB total (including boundaries)
  but at most 256 KiB of metadata and 10,000 fields. File contents are not scanned;
  file size contributes to the total bound. JSON is capped at 32 levels and 10,000
  visited nodes. Bounds are checked on actual bytes, not just Content-Length.
- A detected attack returns **403 before the handler runs** and schedules a
  parameterized metadata insert using the existing `_shared.js` `dbQuery` helper.
  Invalid inspected JSON/forms return 400; inspection size/complexity limits
  return 413. These validation/limit rejections do not generate attack events.
- Detected attacks remain blocked if logging fails or `DATABASE_URL` is missing.
  No handler is invoked to process them. Logging errors print only a fixed
  diagnostic message, not database errors or request data.

`/api/security/log` (also with a trailing slash) is excluded from attack-content
inspection, including its query. It describes attacks, so scanning its report body
would create false server detections/feedback loops. It still passes same-origin
checks, manual-ban checks, security headers, and its own 16 KiB stream bound and
JSON object validation. This endpoint has no arbitrary side effects beyond a
metadata insert.

## What is stored

New events insert only:

- IP from Cloudflare `CF-Connecting-IP`; country from `CF-IPCountry` (or
  `request.cf.country`); bounded city/region from `request.cf`. Other forwarding,
  client geo headers and JSON geo/IP values are ignored. Missing trusted data is
  stored as NULL, with no fallback to `X-Forwarded-For`.
- An allowlisted client event type or a server detector category, plus
  `input_field` such as `server:json.value`, `server:query.key`,
  `server:form.filename`, or `client:xss`. Untrusted field names are not stored.
- A query-free, allowlisted route label: known security/auth routes, `/ws`, or
  `/`. Other paths become `/api/[other]` or `/[other]`, since path segments can
  also contain passwords/tokens. A report's claimed `url` is ignored.

`payload_sample` and `user_agent` remain in the schema for compatibility but new
Pages events set both to **NULL**. No body, password, token, raw query, indicator,
cookie, authorization header, user agent, or arbitrary client text is persisted
by these security endpoints. IP/geo metadata is still personal data; restrict DB
access and define an appropriate retention period. Historical rows and other
application logging mechanisms are outside this change.

Cloudflare headers are trusted only at Cloudflare's ingress, where the platform
sets them. A development server or independently exposed origin does not acquire
that trust simply because the request contains `CF-*` headers. Keep origins
behind the intended platform and verify ingress configuration.

## Advisory reports, manual bans and rate limiting

`POST /api/security/log` accepts a bounded JSON object. Only an allowlisted `type`
is retained; arbitrary `indicator`, payload, URL, password and other properties
are discarded. Unknown types become `unknown`. Successful responses include
`advisory: true` and `blocked: false`: **a report does not cause a ban**. Three,
forty, or any other number of client reports never increments a threat counter or
writes `security_blocked_ips`. Unauthenticated clients can fabricate advisory
events; do not treat them as confirmed server detections.

When `RATE` is available, the advisory endpoint attempts a 20-reports/IP/minute
KV limit, returning 429 with `Retry-After` when exceeded. KV read/modify/write is
non-atomic and eventually consistent; concurrent requests, multiple locations,
missing IPs, a missing binding, or binding failures can bypass this **best-effort**
limit. Missing/failed `RATE` permits bounded reports. Use Cloudflare rate limiting
or a coordinated limiter if a hard limit is required. Missing database/logging
returns 503 rather than falsely claiming persistence.

Existing, manually maintained `security_blocked_ips` entries are consulted for
API requests, `/ws`, and unsafe HTTP methods. A bounded, per-isolate in-memory
cache (512 IPs, 60-second TTL) avoids a DB query on every dynamic request. Normal
static GET/HEAD/OPTIONS requests do **not** query the database for bans, but still
undergo query inspection. New bans/unbans and expiry may take up to the cache TTL
to appear; isolates do not share this cache. Missing DB/migration or a lookup
failure fails open for this optional manual-ban check, not for scanner detections.
This is not a site-wide IP firewall. Server-detected events block the offending
**request** only; they do not automatically ban an IP either.

## Browser origin checks and headers

Unsafe methods (anything other than GET/HEAD/OPTIONS) return 403 when an Origin
is different from the request origin or `Sec-Fetch-Site` says `same-site` or
`cross-site`. A matching Origin is accepted; Origin-less native clients are
allowed unless Fetch Metadata identifies a cross-site request. `Origin: null` is
rejected. Native clients can spoof/omit these headers: this is browser CSRF
hardening, **not authentication**. Handlers still need authorization and should
not implement state changes on safe methods.

Normal HTTP responses, including early rejections, get nosniff, SAMEORIGIN,
referrer and permissions policies, plus HTTPS-only HSTS (`max-age=31536000`, no
preload or includeSubDomains). CSP adds:

```text
base-uri 'self'; object-src 'none'; form-action 'self'; frame-ancestors 'self'
```

This is deliberately **not a strict CSP**: no `script-src`/`default-src` is added,
so existing inline scripts and external CDNs remain compatible. Existing CSP is
retained as an additional policy. Cross-origin form actions/embedding/objects
may require application-specific review. Wildcard CORS origin and credentials
are removed from helper-generated responses; no wildcard credential CORS is
introduced. WebSocket 101 responses are returned intact to preserve their
Cloudflare `webSocket` property; ordinary response-header decoration is skipped
on those upgrades. Unsafe-method checks do not apply to GET WebSocket upgrades;
WebSocket handlers remain responsible for their own handshake authorization and
Origin policy.

## Threat-list authorization

`GET /api/security_threats` requires an admin session with `session.username`,
then queries `users` by that parameterized username with `active = TRUE` and
requires the **current** role to be `admin`. Deactivated, deleted, demoted and
legacy username-less sessions are rejected; database failures do not grant
access. Existing result fields/geo are preserved and `input_field`/`source` are
included so administrators can distinguish `server`, `client`, and `legacy`
rows. Client reports remain untrusted even in an authenticated dashboard. Ban
status in the list is the current manual-ban status, not proof a report caused
blocking.

## Tests and validation

New files are alongside the existing PHP tests, which are unchanged:

```sh
node --experimental-default-type=module --test tests/security-scanner.test.mjs tests/security-pages.test.mjs
```

Use Node.js 22+ (native Fetch/FormData/Blob and `node:test` mocking). The module
flag loads the dependency-free Pages `.js` files as ESM without adding a root
`package.json` or changing the separate Worker package. Tests use mocked database
HTTP calls and do not need Cloudflare, Neon, real credentials or network access.

Coverage includes scanner patterns/normalization, nested JSON, MIME-header bypass,
query/form keys and values, password exclusion, clone/body preservation, stream
limits, multipart metadata-only inspection, report-loop avoidance, direct native
pre-handler blocking, metadata-only parameterized logging, logging failure,
advisory-only reports, RATE fallback/throttling, cached manual bans, browser
origin checks, response headers and active admin revalidation.

The implementation session could not execute terminal commands due to the
reported `libasound.so.2` environment issue. Run this command and deployed smoke
tests before release; editor diagnostics alone are not runtime validation.

## Limits

This is a small heuristic request filter, not a complete WAF, sanitizer, malware
scanner, authentication system, or proof that input is safe. It has false
positives and bypasses (other encodings, unrecognized syntax, opaque bodies,
excluded credential fields, uploaded file bytes). Non-JSON opaque/plain-text
bodies are size-bounded but not pattern-scanned. Multipart decoding uses the
platform FormData parser only after bounding bytes; metadata checks occur after
parsing, so allocations are bounded by the overall 5 MiB cap. No decompression,
content-disarm, field semantics or stored-output sanitization is provided.
Keep parameterized application SQL, context-aware output escaping, upload rules,
server authorization and production Cloudflare controls. Logging is best effort
and database outages can lose events; a successful 403 never implies a row was
persisted. No changes in `workers/`, assets, or PHP are part of this protection.
