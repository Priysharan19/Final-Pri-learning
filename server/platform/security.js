import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { asyncHandler } from './asyncRouter.js';
import { asStore } from './store.js';
import { tagPolicy } from './routePolicy.js';
import { timedMiddleware } from './requestTiming.js';

export const SESSION_COOKIE = 'pri_cloud_session';
export const CSRF_COOKIE = 'pri_csrf';
const SESSION_MS = 1000 * 60 * 60 * 24 * 30;
// Idle timeout slides on use; a write at most once a minute per session keeps
// the sliding window from turning every request into an UPDATE.
const SESSION_SLIDE_MIN_MS = 60 * 1000;
// Admin and support sessions reach every account's data, so they idle out in
// hours, not weeks: a staff laptop left signed in overnight is signed out by
// morning.
export const PRIVILEGED_IDLE_MS = 12 * 60 * 60 * 1000;
export const PRIVILEGED_ROLES = new Set(['admin', 'support']);
const DEFAULT_SESSION_MAX_AGE_DAYS = 90;
const MAX_SESSION_MAX_AGE_DAYS = 3650;
const CSRF_SECRET = process.env.PRI_CSRF_SECRET || randomBytes(32).toString('hex');

/**
 * The absolute lifetime of a session, from PRI_SESSION_MAX_AGE_DAYS (default
 * 90). The 30-day window slides on use; this cap does not, so a cookie that is
 * used every day still has to be re-issued by a fresh sign-in eventually, and a
 * copied cookie cannot be kept alive for ever by replaying it.
 */
export function sessionMaxAgeMs(env = process.env) {
  const raw = String(env.PRI_SESSION_MAX_AGE_DAYS ?? '').trim();
  if (!raw) return DEFAULT_SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > MAX_SESSION_MAX_AGE_DAYS) {
    throw Object.assign(new Error(`PRI_SESSION_MAX_AGE_DAYS must be a whole number of days between 1 and ${MAX_SESSION_MAX_AGE_DAYS}.`), { code: 'SESSION_MAX_AGE_INVALID' });
  }
  return Number(raw) * 24 * 60 * 60 * 1000;
}

/** The idle window a session of this role gets before it must sign in again. */
export function sessionIdleMs(role) {
  return PRIVILEGED_ROLES.has(role) ? PRIVILEGED_IDLE_MS : SESSION_MS;
}

/** When a session created at `createdAt` and last seen now must expire. */
function sessionExpiry(role, createdAt, now) {
  return Math.min(now + sessionIdleMs(role), createdAt + sessionMaxAgeMs());
}

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

export async function createSession(db, res, accountId, deviceId = 'web', userAgent = '', now = Date.now()) {
  db = asStore(db);
  const raw = opaqueToken(32);
  const sessionId = id('ses');
  const role = (await db.get('SELECT role FROM accounts WHERE id = ?', [accountId]))?.role || 'student';
  const expiresAt = sessionExpiry(role, now, now);
  await db.run(`INSERT INTO account_sessions
    (id, account_id, token_hash, device_id, user_agent_hash, created_at, last_seen_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [sessionId, accountId, sha256(raw), String(deviceId).slice(0, 160), userAgent ? sha256(userAgent) : null, now, now, expiresAt]);
  setSessionCookies(res, raw, expiresAt - now);
  return sessionId;
}

export async function sessionFromRequest(db, req, now = Date.now()) {
  const raw = req.cookies?.[SESSION_COOKIE];
  if (!raw || String(raw).length > 256) return null;
  db = asStore(db);
  const row = await db.get(`SELECT s.*, a.email, a.name, a.role, a.email_verified_at, a.deleted_at
    FROM account_sessions s JOIN accounts a ON a.id = s.account_id
    WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND a.deleted_at IS NULL`, [sha256(raw), now]);
  if (!row) return null;
  // The absolute cap and the role's idle limit are enforced here as well as
  // through expires_at, so a row written before either rule existed — or an
  // account promoted to admin after it signed in — is held to them too. A row
  // that fails is revoked, so a copied cookie cannot be retried against it.
  if (now - row.created_at >= sessionMaxAgeMs() || now - row.last_seen_at > sessionIdleMs(row.role)) {
    await db.run('UPDATE account_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL', [now, row.id]);
    return null;
  }
  let slid = false;
  if (now - row.last_seen_at >= SESSION_SLIDE_MIN_MS) {
    const expiresAt = sessionExpiry(row.role, row.created_at, now);
    await db.run('UPDATE account_sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?', [now, expiresAt, row.id]);
    row.last_seen_at = now;
    row.expires_at = expiresAt;
    slid = true;
  }
  return { ...row, rawToken: raw, slid };
}

// ── One session lookup per request ──────────────────────────────────────────
// The guardian gate is mounted in front of each sub-router and has to resolve
// the session itself (the sub-router's own requireSession has not run yet).
// requireSession then looked the same cookie up again, a moment later, in the
// same request: one redundant trip to the database on every gated route. The
// gate now leaves what it found on the request and requireSession takes it —
// once, from the same store, in the same request, and only a lookup that
// SUCCEEDED (a missing session is always looked up afresh, and so is every
// check made where something commits: those call sessionFromRequest directly).
const RESOLVED_SESSION = Symbol('priResolvedSession');

/** Resolve the request's session and leave it for requireSession (guardian gate). */
export async function resolveSessionOnce(db, req, now = Date.now()) {
  db = asStore(db);
  const session = await sessionFromRequest(db, req, now);
  if (session) req[RESOLVED_SESSION] = { store: db, session };
  return session;
}

async function sessionForRequest(db, req, now) {
  const resolved = req[RESOLVED_SESSION];
  if (resolved) {
    delete req[RESOLVED_SESSION];
    if (resolved.store === db) return resolved.session;
  }
  return sessionFromRequest(db, req, now);
}

// The only routes an admin or support account may use before it has enrolled
// a second factor: finding out who it is, signing out, and enrolling. Matched on
// the normalised path (no query string), anchored at the account router's
// mount (/v1/account in production, /account in the focused contracts). Deny by default: anything else answers
// MFA_ENROLMENT_REQUIRED until the enrolment is confirmed.
const MFA_ENROLMENT_PATHS = /^(?:\/v1)?\/account\/(?:me|logout-all|mfa)(?:\/|$)/;

/** Whether this privileged account has a confirmed second factor. */
export async function mfaEnrolled(db, accountId) {
  db = asStore(db);
  return !!(await db.get('SELECT 1 FROM account_mfa WHERE account_id = ? AND confirmed_at IS NOT NULL', [accountId]));
}

export function requireSession(db) {
  db = asStore(db);
  return tagPolicy(timedMiddleware('auth', asyncHandler(async (req, res, next) => {
    const now = Date.now();
    const session = await sessionForRequest(db, req, now);
    if (!session) return res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
    // Keep the browser/native cookie lifetime in step with the slid server row.
    if (session.slid) setSessionCookies(res, session.rawToken, Math.max(1000, session.expires_at - now));
    // Staff accounts carry their second-factor state on the session. One that
    // has not enrolled may reach only the enrolment routes (and sign out).
    if (PRIVILEGED_ROLES.has(session.role)) {
      session.mfaEnrolled = await mfaEnrolled(db, session.account_id);
      if (!session.mfaEnrolled && !MFA_ENROLMENT_PATHS.test(`${req.baseUrl || ''}${req.path || ''}`)) {
        return res.status(403).json({ error: { code: 'MFA_ENROLMENT_REQUIRED', message: 'Staff accounts must set up an authenticator app before using this feature.' } });
      }
    }
    req.platformSession = session;
    next();
  })), { session: true });
}

/** How recently a second factor must have been presented for a step-up action. */
export const MFA_STEP_UP_MS = 15 * 60 * 1000;

/**
 * A second factor on this session. Every staff route sits behind it: the
 * account must have enrolled, and this session must have verified a code since
 * it signed in (mfa_verified_at). With `stepUpMs`, the code must be fresher than
 * that — role promotion and a Premium grant ask for it again inside 15 minutes.
 * Mounted after requireRole on staff-only routes; any other role is refused
 * outright, because a route that asks for a second factor is a staff route.
 */
export function requireMfa({ stepUpMs = null } = {}) {
  const window = stepUpMs === null ? null : Math.max(1000, Math.floor(Number(stepUpMs)));
  return tagPolicy((req, res, next) => {
    const session = req.platformSession;
    if (!session || !PRIVILEGED_ROLES.has(session.role)) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have permission for this action.' } });
    if (!session.mfaEnrolled) return res.status(403).json({ error: { code: 'MFA_ENROLMENT_REQUIRED', message: 'Set up an authenticator app before using this feature.' } });
    const verifiedAt = Number(session.mfa_verified_at) || 0;
    if (!verifiedAt) return res.status(403).json({ error: { code: 'MFA_REQUIRED', message: 'Enter the code from your authenticator app to continue.' } });
    if (window !== null && Date.now() - verifiedAt > window) {
      return res.status(403).json({ error: { code: 'MFA_STEP_UP_REQUIRED', message: 'Enter the code from your authenticator app again to confirm this action.', stepUpWindowMs: window } });
    }
    next();
  }, { mfa: window === null ? true : { stepUpMs: window } });
}

export function requireVerifiedEmail(req, res, next) {
  if (!req.platformSession?.email_verified_at) {
    return res.status(403).json({ error: { code: 'EMAIL_UNVERIFIED', message: 'Verify your email address before using this feature.' } });
  }
  next();
}
tagPolicy(requireVerifiedEmail, { verifiedEmail: true });

export function requireRole(...roles) {
  const allowed = new Set(roles);
  return tagPolicy((req, res, next) => {
    const role = req.platformSession?.role;
    if (!role || !allowed.has(role)) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have permission for this action.' } });
    next();
  }, { roles: [...allowed] });
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
tagPolicy(csrfGuard, { csrf: true });

// The native shells' own HTTP stacks (URLSession on Apple, the Android shell's
// HTTPS client) send these exact identities; any other value is a browser.
// CP-07 added Android under the identical rule — it never impersonates iOS.
const NATIVE_CLIENTS = new Set(['ios-native-v1', 'android-native-v1']);

/**
 * The client declares itself one of the native shells (iPad/iPhone or
 * Android). Self-declared, so it can only ever REMOVE an option for the
 * caller — billing uses it to refuse web checkout to the native apps, where
 * the storefront's own billing is the only permitted purchase path — never
 * grant one.
 */
export function declaredNativeClient(req) {
  return NATIVE_CLIENTS.has(String(req?.get?.('x-pri-client') || ''));
}

/**
 * The native shell a request declares itself to be (X-Pri-Client), from the
 * closed set of known native clients, or null. This only identifies the shell
 * (the compatibility floor uses it); it grants nothing — the CSRF/origin
 * exemption additionally requires the absence of browser context below.
 */
export function declaredNativeClientId(req) {
  const id = req.get('x-pri-client');
  return NATIVE_CLIENTS.has(id) ? id : null;
}

function nativeNonBrowserRequest(req) {
  // URLSession does not have a browser Origin or Fetch Metadata context. A web
  // page cannot suppress Origin on a cross-origin mutation, and the custom
  // X-Pri-Client header itself causes a CORS preflight. The server intentionally
  // sends no permissive CORS policy, so this exception cannot be used as a web
  // CSRF bypass. Authenticated native mutations still pass csrfGuard below using
  // the server-issued cookie pair held by the native cookie jar.
  return NATIVE_CLIENTS.has(req.get('x-pri-client')) &&
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

/**
 * Count one unit against `bucket`, or refuse it.
 *
 * ONE atomic statement. It used to be a transaction of its own — BEGIN, read
 * the row, write the row, COMMIT — which is four trips to the database for a
 * decision the database can make in one, on every rate-limited request (and
 * ten for the two-window paid ceiling, which nested two of them). The rule is
 * unchanged, and written once for both engines:
 *
 *   · no row, or the row's window has run out → the window restarts at `now`
 *     with a count of 1, and the unit is allowed;
 *   · a live window with room → the count goes up by one, allowed;
 *   · a live window that is full → NOTHING is written (the upsert's WHERE is
 *     false, so no row comes back) and the unit is refused.
 *
 * The upsert locks the bucket's row for the length of the statement, so two
 * concurrent callers can never both take the last unit — on Postgres without
 * the SERIALIZABLE retries the read-then-write version needed for the same
 * guarantee. Inside a caller's own transaction it is simply one statement of
 * that transaction.
 */
export async function consumeRateLimit(db, bucket, { limit, windowMs }, now = Date.now()) {
  db = asStore(db);
  const taken = await db.get(`INSERT INTO rate_limits(bucket, window_start, count) VALUES (?, ?, 1)
    ON CONFLICT(bucket) DO UPDATE SET
      window_start = CASE WHEN excluded.window_start - rate_limits.window_start >= ? THEN excluded.window_start ELSE rate_limits.window_start END,
      count = CASE WHEN excluded.window_start - rate_limits.window_start >= ? THEN 1 ELSE rate_limits.count + 1 END
    WHERE excluded.window_start - rate_limits.window_start >= ? OR rate_limits.count < ?
    RETURNING window_start, count`, [bucket, now, windowMs, windowMs, windowMs, limit]);
  if (taken) {
    return { allowed: true, remaining: Math.max(0, limit - Number(taken.count)), resetAt: Number(taken.window_start) + windowMs };
  }
  // Refused: say when the window that refused it ends. (A bucket swept between
  // the two statements has no window left to name; the caller may retry now.)
  const row = await db.get('SELECT window_start FROM rate_limits WHERE bucket = ?', [bucket]);
  return { allowed: false, remaining: 0, resetAt: (row ? Number(row.window_start) : now) + windowMs };
}

export function rateLimit(db, key, options) {
  db = asStore(db);
  return tagPolicy(timedMiddleware('limit', asyncHandler(async (req, res, next) => {
    const identity = req.platformSession?.account_id || req.ip || 'unknown';
    const verdict = await consumeRateLimit(db, `${key}:${sha256(identity).slice(0, 24)}`, options);
    res.set('RateLimit-Remaining', String(verdict.remaining));
    res.set('RateLimit-Reset', String(Math.ceil(verdict.resetAt / 1000)));
    if (!verdict.allowed) return res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' } });
    next();
  })), { rateLimit: { key, limit: options.limit, windowMs: options.windowMs } });
}
