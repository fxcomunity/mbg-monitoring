import { dbQuery } from './_shared.js';

function isValidIp(ip) {
  if (typeof ip !== 'string' || ip.length > 45) return false;
  if (ip.includes('.')) {
    const parts = ip.split('.');
    return parts.length === 4 && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255);
  }
  return ip.includes(':') && /^[0-9a-f:]+$/i.test(ip);
}

export function trustedLoginIp(request) {
  const ip = request.headers.get('CF-Connecting-IP');
  return isValidIp(ip) ? ip : null;
}

export async function getLoginLockout(env, ip) {
  const rows = await dbQuery(env.DATABASE_URL, `
    SELECT ip_address AS ip, failed_attempts, locked_until AS blocked_until,
           is_permanent AS permanent,
           (is_permanent OR locked_until > NOW()) AS blocked
    FROM auth_ip_lockouts
    WHERE ip_address = $1
  `, [ip]);
  const row = rows[0] || {};
  return {
    ip,
    blocked: row.blocked === true || row.blocked === 't',
    failed_attempts: Number(row.failed_attempts) || 0,
    blocked_until: row.blocked_until || null,
    permanent: row.permanent === true || row.permanent === 't'
  };
}

export async function recordLoginFailure(env, ip) {
  const rows = await dbQuery(env.DATABASE_URL, `
    INSERT INTO auth_ip_lockouts (ip_address, failed_attempts)
    VALUES ($1, 1)
    ON CONFLICT (ip_address) DO UPDATE SET
      failed_attempts = CASE WHEN auth_ip_lockouts.is_permanent THEN auth_ip_lockouts.failed_attempts ELSE auth_ip_lockouts.failed_attempts + 1 END,
      is_permanent = auth_ip_lockouts.is_permanent OR auth_ip_lockouts.failed_attempts + 1 >= 15,
      locked_until = CASE
        WHEN auth_ip_lockouts.is_permanent OR auth_ip_lockouts.failed_attempts + 1 >= 15 THEN NULL
        WHEN auth_ip_lockouts.failed_attempts + 1 >= 10 THEN NOW() + INTERVAL '1 hour'
        WHEN auth_ip_lockouts.failed_attempts + 1 >= 5 THEN NOW() + INTERVAL '10 minutes'
        ELSE NULL
      END,
      updated_at = NOW()
    RETURNING ip_address AS ip, failed_attempts, locked_until AS blocked_until,
              is_permanent AS permanent,
              (is_permanent OR locked_until > NOW()) AS blocked
  `, [ip]);
  const row = rows[0];
  if (!row) throw new Error('Login lockout state was not returned.');
  await dbQuery(env.DATABASE_URL, `
    INSERT INTO auth_security_events (ip_address, event_type, failed_attempts, blocked_until, is_permanent)
    VALUES ($1, $2, $3, $4, $5)
  `, [ip, row.blocked ? 'login_locked' : 'login_failed', Number(row.failed_attempts), row.blocked_until || null, row.permanent === true || row.permanent === 't']);
  return {
    ip,
    blocked: row.blocked === true || row.blocked === 't',
    failed_attempts: Number(row.failed_attempts) || 0,
    blocked_until: row.blocked_until || null,
    permanent: row.permanent === true || row.permanent === 't'
  };
}

export async function recordLoginSuccess(env, ip) {
  await dbQuery(env.DATABASE_URL, `
    UPDATE auth_ip_lockouts
    SET failed_attempts = 0, locked_until = NULL, updated_at = NOW()
    WHERE ip_address = $1 AND is_permanent = FALSE
  `, [ip]);
  await dbQuery(env.DATABASE_URL, `
    INSERT INTO auth_security_events (ip_address, event_type)
    VALUES ($1, 'login_success')
  `, [ip]);
}
