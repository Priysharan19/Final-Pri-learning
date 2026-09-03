import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'pri_cloud_session';
export const CSRF_COOKIE = 'pri_csrf';
const SESSION_MS = 1000 * 60 * 60 * 24 * 30;
const CSRF_SECRET = process.env.PRI_CSRF_SECRET || randomBytes(32).toString('hex');

export function id(prefix = 'id') {
  return `${prefix}_${randomUUID()}`;
}

export function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

export function opaqueToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && timingSafeEqual(x, y);
}

export function csrfForSession(rawToken) {
  return createHmac('sha256', CSRF_SECRET).update(String(rawToken || '')).digest('base64url');
}

export function setSessionCookies(res, rawToken, maxAge = SESSION_MS) {
  const secure = process.env.NODE_ENV === 'production';
  res.cookie(SESSION_COOKIE, rawToken, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge });
  res.cookie(CSRF_COOKIE, csrfForSession(rawToken), { httpOnly: false, secure, sameSite: 'lax', path: '/', maxAge });
}

export function clearSessionCookies(res) {
  const secure = process.env.NODE_ENV === 'production';
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure, sameSite: 'lax', path: '/' });
  res.clearCookie(CSRF_COOKIE, { httpOnly: false, secure, sameSite: 'lax', path: '/' });
}

export function createSession(db, res, accountId, deviceId = 'web', userAgent = '', now = Date.now()) {
  const raw = opaqueToken(32);
  const sessionId = id('ses');
  db.prepare(`INSERT INTO account_sessions
    (id, account_id, token_hash, device_id, user_agent_hash, created_at, last_seen_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(sessionId, accountId, sha256(raw), String(deviceId).slice(0, 160), userAgent ? sha256(userAgent) : null, now, now, now + SESSION_MS);
  setSessionCookies(res, raw, SESSION_MS);
  return sessionId;
}

export function sessionFromRequest(db, req, now = Date.now()) {
  const raw = req.cookies?.[SESSION_COOKIE];
  if (!raw || String(raw).length > 256) return null;
  const row = db.prepare(`SELECT s.*, a.email, a.name, a.role, a.email_verified_at, a.deleted_at
    FROM account_sessions s JOIN accounts a ON a.id = s.account_id
    WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND a.deleted_at IS NULL`).get(sha256(raw), now);
  if (!row) return null;
  return { ...row, rawToken: raw };
}

export function requireSession(db) {
  return (req, res, next) => {
    const session = sessionFromRequest(db, req);
    if (!session) return res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
    req.platformSession = session;
    next();
  };
}

export function requireRole(...roles) {
  const allowed = new Set(roles);
  return (req, res, next) => {
    const role = req.platformSession?.role;
    if (!role || !allowed.has(role)) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have permission for this action.' } });
    next();
  };
}

export function csrfGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const raw = req.cookies?.[SESSION_COOKIE];
  if (!raw) return next(); // login/register have no session yet; origin guard still applies
  const expected = csrfForSession(raw);
  const header = req.get('x-pri-csrf');
  const cookieValue = req.cookies?.[CSRF_COOKIE];
  if (!safeEqual(header, expected) || !safeEqual(cookieValue, expected)) {
    return res.status(403).json({ error: { code: 'CSRF_REJECTED', message: 'Security token is missing or expired.' } });
  }
  next();
}

function nativeNonBrowserRequest(req) {
  // URLSession does not have a browser Origin or Fetch Metadata context. A web
  // page cannot suppress Origin on a cross-origin mutation, and the custom
  // X-Pri-Client header itself causes a CORS preflight. The server intentionally
  // sends no permissive CORS policy, so this exception cannot be used as a web
  // CSRF bypass. Authenticated native mutations still pass csrfGuard below using
  // the server-issued cookie pair held by the native cookie jar.
  return req.get('x-pri-client') === 'ios-native-v1' &&
    !req.get('origin') &&
    !req.get('sec-fetch-site') &&
    !req.get('sec-fetch-mode');
}

export function originGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (nativeNonBrowserRequest(req)) return next();
  const origin = req.get('origin');
  const configured = String(process.env.PRI_PUBLIC_ORIGIN || '').trim();
  if (!configured && process.env.NODE_ENV !== 'production') return next();
  if (!configured) return res.status(503).json({ error: { code: 'ORIGIN_NOT_CONFIGURED', message: 'Server origin policy is not configured.' } });
  let expected;
  try { expected = new URL(configured).origin; } catch { return res.status(500).json({ error: { code: 'SERVER_CONFIG', message: 'Server origin policy is invalid.' } }); }
  if (!origin || origin !== expected) return res.status(403).json({ error: { code: 'ORIGIN_REJECTED', message: 'Request origin is not allowed.' } });
  next();
}

export function consumeRateLimit(db, bucket, { limit, windowMs }, now = Date.now()) {
  return db.transaction(() => {
    const row = db.prepare('SELECT window_start, count FROM rate_limits WHERE bucket = ?').get(bucket);
    if (!row || now - row.window_start >= windowMs) {
      db.prepare('INSERT OR REPLACE INTO rate_limits(bucket, window_start, count) VALUES (?, ?, 1)').run(bucket, now);
      return { allowed: true, remaining: Math.max(0, limit - 1), resetAt: now + windowMs };
    }
    if (row.count >= limit) return { allowed: false, remaining: 0, resetAt: row.window_start + windowMs };
    db.prepare('UPDATE rate_limits SET count = count + 1 WHERE bucket = ?').run(bucket);
    return { allowed: true, remaining: Math.max(0, limit - row.count - 1), resetAt: row.window_start + windowMs };
  })();
}

export function rateLimit(db, key, options) {
  return (req, res, next) => {
    const identity = req.platformSession?.account_id || req.ip || 'unknown';
    const verdict = consumeRateLimit(db, `${key}:${sha256(identity).slice(0, 24)}`, options);
    res.set('RateLimit-Remaining', String(verdict.remaining));
    res.set('RateLimit-Reset', String(Math.ceil(verdict.resetAt / 1000)));
    if (!verdict.allowed) return res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' } });
    next();
  };
}
