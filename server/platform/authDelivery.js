import { decryptDeliveryToken } from './deliveryCrypto.js';
import { asStore, assertNoOpenTransaction, sqliteHandle } from './store.js';
import { recordAuthEmail } from './metrics.js';
import { logEvent, safeCode as logCode } from './observability.js';

const MAX_ATTEMPTS = 8;
const DEFAULT_BATCH = 20;
const DEFAULT_INTERVAL_MS = 30_000;
const REQUEST_TIMEOUT_MS = 10_000;
const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const RESEND_DOMAINS_ENDPOINT = 'https://api.resend.com/domains?limit=100';
/** The shared Resend onboarding sender: it delivers only to the account owner's own address. */
export const RESEND_TEST_SENDER_DOMAIN = 'resend.dev';
export const AUTH_EMAIL_PROBE_TIMEOUT_MS = 4_000;
/** A definite answer (key valid/invalid, domain verified or not) is kept this long. */
export const AUTH_EMAIL_PROBE_TTL_MS = 5 * 60_000;
/** An answer that is only "could not tell" (timeout, 429, 5xx) is retried sooner. */
export const AUTH_EMAIL_PROBE_RETRY_TTL_MS = 30_000;

function nonEmpty(value) {
  return String(value || '').trim();
}

function safeCode(value, fallback = 'DELIVERY_FAILED') {
  const code = String(value || fallback).toUpperCase().replace(/[^A-Z0-9_-]/g, '_').slice(0, 80);
  return code || fallback;
}

function addColumnIfMissing(db, name, sql) {
  const columns = new Set(db.pragma("table_info('auth_delivery_outbox')").map(row => row.name));
  if (!columns.has(name)) db.exec(`ALTER TABLE auth_delivery_outbox ADD COLUMN ${sql}`);
}

export function ensureAuthDeliverySchema(db) {
  // SQLite builds its schema at boot; Postgres is migrated (supabase/migrations).
  db = sqliteHandle(db);
  if (!db) return;
  db.exec(`CREATE TABLE IF NOT EXISTS auth_delivery_outbox (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK(kind IN ('verify-email','reset-password','guardian-consent','guardian-withdraw')),
    destination TEXT NOT NULL,
    token_id TEXT NOT NULL REFERENCES account_tokens(id) ON DELETE CASCADE,
    token_ciphertext TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    delivered_at INTEGER
  );`);
  addColumnIfMissing(db, 'attempt_count', 'attempt_count INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'last_attempt_at', 'last_attempt_at INTEGER');
  addColumnIfMissing(db, 'next_attempt_at', 'next_attempt_at INTEGER');
  addColumnIfMissing(db, 'last_error_code', 'last_error_code TEXT');
  addColumnIfMissing(db, 'provider_message_id', 'provider_message_id TEXT');
  db.exec(`CREATE INDEX IF NOT EXISTS idx_auth_delivery_pending
    ON auth_delivery_outbox(delivered_at, next_attempt_at, created_at);`);
}

export function cleanPublicOrigin(raw) {
  const text = nonEmpty(raw);
  if (!text) throw Object.assign(new Error('PRI_PUBLIC_ORIGIN is not configured'), { code: 'PUBLIC_ORIGIN_MISSING' });
  let url;
  try { url = new URL(text); } catch {
    throw Object.assign(new Error('PRI_PUBLIC_ORIGIN is invalid'), { code: 'PUBLIC_ORIGIN_INVALID' });
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && local && url.protocol === 'http:')) {
    throw Object.assign(new Error('PRI_PUBLIC_ORIGIN must use HTTPS'), { code: 'PUBLIC_ORIGIN_INSECURE' });
  }
  if (url.username || url.password || url.search || url.hash) {
    throw Object.assign(new Error('PRI_PUBLIC_ORIGIN must be a clean origin'), { code: 'PUBLIC_ORIGIN_INVALID' });
  }
  return url.origin;
}

/**
 * Tokens stay in the URL fragment. Fragments are handled by the browser and are
 * never sent in the HTTP request line, reverse-proxy logs or Referrer headers.
 */
export function buildAuthActionUrl(publicOrigin, kind, rawToken) {
  if (!['verify-email', 'reset-password', 'guardian-consent', 'guardian-withdraw'].includes(kind)) throw new Error('Unsupported auth delivery kind');
  const token = String(rawToken || '');
  if (!token || token.length > 512) throw new Error('Invalid auth delivery token');
  // A parent's link opens the parent's own consent page; account links open
  // the account-action page. Both read the token from the fragment.
  const url = new URL(kind === 'guardian-consent' ? '/guardian/consent' : '/account-action', cleanPublicOrigin(publicOrigin));
  url.hash = new URLSearchParams({ action: kind, token }).toString();
  return url.toString();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}

export function authEmailMessage(kind, actionUrl) {
  const url = String(actionUrl);
  if (kind === 'verify-email') {
    return {
      subject: 'Verify your Pri Learning email',
      text: `Verify your Pri Learning email by opening this link:\n\n${url}\n\nThis link expires in 1 hour. If you did not create this account, you can ignore this email.`,
      html: `<p>Verify your Pri Learning email.</p><p><a href="${escapeHtml(url)}">Verify email</a></p><p>This link expires in 1 hour. If you did not create this account, you can ignore this email.</p>`
    };
  }
  if (kind === 'reset-password') {
    return {
      subject: 'Reset your Pri Learning password',
      text: `Reset your Pri Learning password by opening this link:\n\n${url}\n\nThis link expires in 1 hour. If you did not request a reset, you can ignore this email.`,
      html: `<p>Reset your Pri Learning password.</p><p><a href="${escapeHtml(url)}">Reset password</a></p><p>This link expires in 1 hour. If you did not request a reset, you can ignore this email.</p>`
    };
  }
  if (kind === 'guardian-consent') {
    // Written to a parent, not to the student, and it states the two authority
    // windows accurately: this link confirms (or declines) for 1 hour; a
    // separate, long-lived withdrawal link follows a confirmation.
    return {
      subject: 'Confirm your child’s Pri Learning account',
      text: `Your child has created a Pri Learning account and asked you to confirm it.\n\nConfirm here:\n\n${url}\n\nPri Learning is a maths app. Everything in it works on their device without an account; confirming lets their progress sync between devices and be backed up. If you do nothing, nothing syncs and their work simply stays on their device.\n\nThis link works for 1 hour, and you can also use it to say no. If you confirm, we will email you a separate link that you can keep and use to withdraw consent at any time.`,
      html: `<p>Your child has created a Pri Learning account and asked you to confirm it.</p><p><a href="${escapeHtml(url)}">Confirm this account</a></p><p>Pri Learning is a maths app. Everything in it works on their device without an account; confirming lets their progress sync between devices and be backed up. If you do nothing, nothing syncs and their work simply stays on their device.</p><p>This link works for 1 hour, and you can also use it to say no. If you confirm, we will email you a separate link that you can keep and use to withdraw consent at any time.</p>`
    };
  }
  if (kind === 'guardian-withdraw') {
    // Sent once a guardian has confirmed. The link does not expire and can only
    // ever withdraw; it is revoked by the withdrawal it performs.
    return {
      subject: 'Your child’s Pri Learning account is confirmed — keep this email',
      text: `Thank you for confirming your child’s Pri Learning account. Their progress can now sync between their devices and be backed up.\n\nKeep this email. If you ever want to withdraw your consent, open this link:\n\n${url}\n\nIt does not expire, it can only withdraw consent (never give it), and withdrawing stops their account syncing at once. Their work stays on their device either way.`,
      html: `<p>Thank you for confirming your child’s Pri Learning account. Their progress can now sync between their devices and be backed up.</p><p>Keep this email. If you ever want to withdraw your consent, open this link:</p><p><a href="${escapeHtml(url)}">Withdraw consent</a></p><p>It does not expire, it can only withdraw consent (never give it), and withdrawing stops their account syncing at once. Their work stays on their device either way.</p>`
    };
  }
  throw new Error('Unsupported auth delivery kind');
}

// ── What a Resend refusal means ──────────────────────────────────────────────
// Resend answers a refused call with { statusCode, name, message }. The message
// is read here to be CLASSIFIED and is never stored, logged or returned: it can
// quote the account owner's address or the sender domain. Only the code below
// leaves this function. A refusal with no recognised cause keeps the historical
// RESEND_<status> code, so 5xx/429 handling and its alerts are unchanged.
export function classifyResendRejection(status, body) {
  const name = typeof body?.name === 'string' ? body.name.toLowerCase() : '';
  const message = typeof body?.message === 'string' ? body.message.toLowerCase() : '';
  if (name === 'restricted_api_key') return 'AUTH_EMAIL_KEY_RESTRICTED';
  if (name === 'missing_api_key' || name === 'invalid_api_key' || /api key is invalid/.test(message)) return 'AUTH_EMAIL_KEY_INVALID';
  if (/only send testing emails/.test(message)) return 'AUTH_EMAIL_TEST_SENDER_RECIPIENT_REFUSED';
  if (/domain is not verified|verify (a|your) domain/.test(message)) return 'AUTH_EMAIL_SENDER_UNVERIFIED';
  if (name === 'daily_quota_exceeded' || name === 'monthly_quota_exceeded') return 'AUTH_EMAIL_QUOTA_EXCEEDED';
  if (name === 'invalid_from_address') return 'AUTH_EMAIL_SENDER_INVALID';
  const n = Number(status);
  return Number.isInteger(n) && n >= 100 && n <= 599 ? `RESEND_${n}` : 'RESEND_BAD_RESPONSE';
}

/** The code for a call that never got an answer: our own timeout, or the network. */
export function resendTransportFailureCode(error, signal) {
  if (typeof error?.code === 'string' && /^(AUTH_EMAIL_|RESEND_)[A-Z0-9_]{1,60}$/.test(error.code)) return error.code;
  return signal?.aborted ? 'AUTH_EMAIL_PROVIDER_TIMEOUT' : 'AUTH_EMAIL_PROVIDER_UNREACHABLE';
}

async function readJsonBody(response) {
  try {
    const text = typeof response?.text === 'function' ? await response.text() : '';
    return text ? JSON.parse(text) : null;
  } catch { return null; /* a provider body is not trusted */ }
}

/** One POST to Resend. Resolves to the message id (or null); throws an error carrying only a code. */
export async function postResendEmail({ key, payload, idempotencyKey, fetchImpl, requireMessageId = false }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Auth email provider timed out')), REQUEST_TIMEOUT_MS);
  try {
    let response;
    try {
      response = await fetchImpl(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': String(idempotencyKey).slice(0, 256),
          'User-Agent': 'Pri-Learning-Auth/1.0'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } catch (error) {
      throw Object.assign(new Error('Auth email provider could not be reached'), { code: resendTransportFailureCode(error, controller.signal) });
    }
    const data = await readJsonBody(response);
    if (!response.ok) {
      throw Object.assign(new Error('Auth email provider rejected the request'), { code: classifyResendRejection(response.status, data) });
    }
    const providerMessageId = String(data?.id || '').slice(0, 160) || null;
    if (!providerMessageId && requireMessageId) {
      throw Object.assign(new Error('Auth email provider returned no message id'), { code: 'RESEND_BAD_RESPONSE' });
    }
    return providerMessageId;
  } finally {
    clearTimeout(timer);
  }
}

// ── Readiness probe ──────────────────────────────────────────────────────────
// "The variables are set" is not "email can be sent": a revoked key and an
// unverified sender domain both look configured. This asks Resend one cheap
// authenticated question (list domains) and reduces the answer to coded states:
//
//   credential  valid | invalid | unknown
//   keyScope    full | sending | unknown     a sending-only key is VALID; it
//                                            just may not read the domain list
//   sender      verified | unverified | test_sender | invalid | unknown
//
// It is called only from /v1/ready (readiness.js), never from a request a
// learner makes and never at boot. The answer is cached (5 minutes when
// definite, 30 seconds when Resend could not be reached) and bounded by
// AUTH_EMAIL_PROBE_TIMEOUT_MS. Nothing it returns carries the key, the sender
// address, the domain or any provider text.
let authEmailProbeCache = { key: '', expiresAt: 0, value: null };
export function resetAuthEmailProbeCache() { authEmailProbeCache = { key: '', expiresAt: 0, value: null }; }

/** The domain of a From header (`Name <a@b.c>` or `a@b.c`), lower-cased, or null. */
export function authEmailSenderDomain(from) {
  const text = nonEmpty(from);
  const bracket = text.match(/<([^<>\s]+)>\s*$/);
  const address = (bracket ? bracket[1] : text).trim();
  const match = address.match(/^[^@\s<>]+@([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+)$/i);
  return match ? match[1].toLowerCase() : null;
}

export function authEmailStaticStatus(env = process.env) {
  const provider = nonEmpty(env.PRI_AUTH_EMAIL_PROVIDER).toLowerCase();
  const configured = provider === 'resend' && !!nonEmpty(env.PRI_RESEND_API_KEY) && !!nonEmpty(env.PRI_AUTH_EMAIL_FROM);
  return { configured, senderDomain: configured ? authEmailSenderDomain(env.PRI_AUTH_EMAIL_FROM) : null };
}

export async function probeAuthEmail({
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = Date.now(),
  cache = true,
  timeoutMs = AUTH_EMAIL_PROBE_TIMEOUT_MS
} = {}) {
  const { configured, senderDomain } = authEmailStaticStatus(env);
  if (!configured) return Object.freeze({ configured: false, credential: 'unknown', keyScope: 'unknown', sender: 'unknown', code: 'AUTH_EMAIL_NOT_CONFIGURED' });
  const key = nonEmpty(env.PRI_RESEND_API_KEY);
  const cacheKey = `${key}|${nonEmpty(env.PRI_AUTH_EMAIL_FROM)}`;
  if (cache && authEmailProbeCache.key === cacheKey && authEmailProbeCache.expiresAt > now && authEmailProbeCache.value) return authEmailProbeCache.value;

  const testSender = senderDomain === RESEND_TEST_SENDER_DOMAIN;
  const finish = (fields, ttl = AUTH_EMAIL_PROBE_TTL_MS) => {
    const value = Object.freeze({ configured: true, ...fields });
    if (cache) authEmailProbeCache = { key: cacheKey, expiresAt: now + ttl, value };
    return value;
  };
  // What is known about the sender without asking anyone.
  const staticSender = !senderDomain ? 'invalid' : testSender ? 'test_sender' : 'unknown';
  const staticCode = !senderDomain ? 'AUTH_EMAIL_SENDER_INVALID' : testSender ? 'AUTH_EMAIL_TEST_SENDER' : null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Auth email probe timed out')), timeoutMs);
  let response;
  let data;
  try {
    response = await fetchImpl(RESEND_DOMAINS_ENDPOINT, {
      method: 'GET',
      headers: { Authorization: `Bearer ${key}`, 'User-Agent': 'Pri-Learning-Auth/1.0' },
      signal: controller.signal
    });
    data = await readJsonBody(response);
  } catch (error) {
    return finish({ credential: 'unknown', keyScope: 'unknown', sender: staticSender, code: resendTransportFailureCode(error, controller.signal) }, AUTH_EMAIL_PROBE_RETRY_TTL_MS);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const code = classifyResendRejection(response.status, data);
    if (code === 'AUTH_EMAIL_KEY_INVALID') return finish({ credential: 'invalid', keyScope: 'unknown', sender: staticSender, code });
    // A sending-only key may not list domains. That refusal PROVES the key is
    // valid; whether the sender domain is verified simply cannot be asked.
    if (code === 'AUTH_EMAIL_KEY_RESTRICTED') return finish({ credential: 'valid', keyScope: 'sending', sender: staticSender, code: staticCode });
    // 429, 5xx, or anything unrecognised: Resend did not tell us either way.
    return finish({ credential: 'unknown', keyScope: 'unknown', sender: staticSender, code }, AUTH_EMAIL_PROBE_RETRY_TTL_MS);
  }

  const full = { credential: 'valid', keyScope: 'full' };
  if (staticCode) return finish({ ...full, sender: staticSender, code: staticCode });
  const list = Array.isArray(data?.data) ? data.data : null;
  if (!list) return finish({ credential: 'valid', keyScope: 'unknown', sender: 'unknown', code: 'RESEND_BAD_RESPONSE' }, AUTH_EMAIL_PROBE_RETRY_TTL_MS);
  const domain = list.find(item => typeof item?.name === 'string' && item.name.toLowerCase() === senderDomain);
  if (domain && String(domain.status).toLowerCase() === 'verified') return finish({ ...full, sender: 'verified', code: null });
  // Not in the first page of a longer list: unknown, not "unverified".
  if (!domain && data?.has_more === true) return finish({ ...full, sender: 'unknown', code: null });
  return finish({ ...full, sender: 'unverified', code: 'AUTH_EMAIL_SENDER_UNVERIFIED' });
}

export function createResendAuthEmailTransport({
  apiKey = process.env.PRI_RESEND_API_KEY,
  from = process.env.PRI_AUTH_EMAIL_FROM,
  fetchImpl = globalThis.fetch
} = {}) {
  const key = nonEmpty(apiKey);
  const sender = nonEmpty(from);
  if (!key || !sender || typeof fetchImpl !== 'function') return null;

  return async ({ outboxId, to, kind, actionUrl }) => {
    assertNoOpenTransaction('Sending an auth email');
    const message = authEmailMessage(kind, actionUrl);
    const providerMessageId = await postResendEmail({
      key,
      fetchImpl,
      idempotencyKey: `pri-auth/${outboxId}`,
      requireMessageId: true,
      payload: {
        from: sender,
        to: [String(to)],
        subject: message.subject,
        text: message.text,
        html: message.html,
        tags: [{ name: 'category', value: kind.replace(/-/g, '_') }]
      }
    });
    return { providerMessageId };
  };
}

export function createAuthEmailTransportFromEnv(options = {}) {
  const provider = nonEmpty(process.env.PRI_AUTH_EMAIL_PROVIDER).toLowerCase();
  if (!provider) return null;
  if (provider !== 'resend') {
    throw Object.assign(new Error('Unsupported PRI_AUTH_EMAIL_PROVIDER'), { code: 'AUTH_EMAIL_PROVIDER_UNSUPPORTED' });
  }
  return createResendAuthEmailTransport(options);
}

function retryDelay(attempt) {
  return Math.min(15 * 60_000, 60_000 * (2 ** Math.max(0, Math.min(4, attempt - 1))));
}

export async function drainAuthDeliveryOutbox(db, {
  send,
  publicOrigin = process.env.PRI_PUBLIC_ORIGIN,
  now = Date.now(),
  batchSize = DEFAULT_BATCH
} = {}) {
  db = asStore(db);
  ensureAuthDeliverySchema(db);
  if (typeof send !== 'function') return { enabled: false, sent: 0, failed: 0, purged: 0 };

  // Once a token is consumed or expired there is no reason to retain even a
  // delivered metadata row. This keeps destinations/provider ids bounded to the
  // lifetime of the one-hour account action. The guardian's long-lived
  // withdrawal link outlives that by years, so its row goes as soon as it has
  // been delivered: the address is already in guardian_consents.
  const purged = (await db.run(`DELETE FROM auth_delivery_outbox
    WHERE token_id IN (
      SELECT id FROM account_tokens WHERE consumed_at IS NOT NULL OR expires_at <= ?
    ) OR (kind = 'guardian-withdraw' AND delivered_at IS NOT NULL)`, [now])).changes;

  const rows = await db.all(`SELECT o.*, t.expires_at, t.consumed_at
    FROM auth_delivery_outbox o
    JOIN account_tokens t ON t.id = o.token_id
    WHERE o.delivered_at IS NULL
      AND o.attempt_count < ?
      AND (o.next_attempt_at IS NULL OR o.next_attempt_at <= ?)
      AND t.consumed_at IS NULL
      AND t.expires_at > ?
    ORDER BY o.created_at ASC
    LIMIT ?`, [MAX_ATTEMPTS, now, now, Math.max(1, Math.min(100, Number(batchSize) || DEFAULT_BATCH))]);

  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    const attempt = Number(row.attempt_count || 0) + 1;
    // Claim this attempt. The count we read is part of the condition, so when
    // two workers (two server replicas on one Postgres) picked the same row,
    // exactly one claims it and only that one sends.
    const claim = await db.run(`UPDATE auth_delivery_outbox SET attempt_count=?, last_attempt_at=?, next_attempt_at=NULL, last_error_code=NULL
      WHERE id=? AND delivered_at IS NULL AND attempt_count=?`, [attempt, now, row.id, Number(row.attempt_count || 0)]);
    if (claim.changes !== 1) continue;

    let rawToken;
    try {
      rawToken = decryptDeliveryToken(row.token_ciphertext, `${row.account_id}:${row.kind}:${row.token_id}`);
    } catch {
      await db.run(`UPDATE auth_delivery_outbox SET attempt_count=?, last_error_code='DECRYPT_FAILED', next_attempt_at=NULL
        WHERE id=?`, [MAX_ATTEMPTS, row.id]);
      failed += 1;
      continue;
    }

    try {
      const actionUrl = buildAuthActionUrl(publicOrigin, row.kind, rawToken);
      const result = await send({
        outboxId: row.id,
        accountId: row.account_id,
        tokenId: row.token_id,
        to: row.destination,
        kind: row.kind,
        actionUrl
      });
      await db.run(`UPDATE auth_delivery_outbox
        SET delivered_at=?, token_ciphertext='', provider_message_id=?, next_attempt_at=NULL, last_error_code=NULL
        WHERE id=? AND delivered_at IS NULL`, [now, String(result?.providerMessageId || '').slice(0, 160) || null, row.id]);
      sent += 1;
      recordAuthEmail({ ok: true });
    } catch (error) {
      const terminal = attempt >= MAX_ATTEMPTS;
      const code = safeCode(error?.code);
      await db.run(`UPDATE auth_delivery_outbox SET last_error_code=?, next_attempt_at=? WHERE id=? AND delivered_at IS NULL`, [code, terminal ? null : now + retryDelay(attempt), row.id]);
      failed += 1;
      recordAuthEmail({ ok: false, code: logCode(code, 'DELIVERY_FAILED') });
      // The destination, token and action URL never reach the log: only the
      // coded failure, the attempt number and whether retries are exhausted.
      logEvent(terminal ? 'error' : 'warn', 'auth_email_failed', { kind: row.kind, code: logCode(code, 'DELIVERY_FAILED'), attempt, state: terminal ? 'exhausted' : 'retrying' });
    } finally {
      rawToken = null;
    }
  }
  return { enabled: true, sent, failed, purged };
}

export function startAuthDeliveryWorker(db, {
  intervalMs = Number(process.env.PRI_AUTH_EMAIL_POLL_MS) || DEFAULT_INTERVAL_MS,
  send = createAuthEmailTransportFromEnv(),
  publicOrigin = process.env.PRI_PUBLIC_ORIGIN
} = {}) {
  ensureAuthDeliverySchema(db);
  if (typeof send !== 'function') {
    if (process.env.NODE_ENV === 'production') {
      throw Object.assign(new Error('Production auth email delivery is not configured'), { code: 'AUTH_EMAIL_NOT_CONFIGURED' });
    }
    return { enabled: false, stop() {} };
  }

  let stopped = false;
  let running = false;
  const run = async () => {
    if (stopped || running) return;
    running = true;
    try {
      const result = await drainAuthDeliveryOutbox(db, { send, publicOrigin });
      if (result.failed) logEvent('warn', 'auth_delivery_failed', { count: result.failed });
    } catch (error) {
      logEvent('error', 'auth_delivery_worker_error', { code: safeCode(error?.code, 'WORKER_ERROR') });
    } finally {
      running = false;
    }
  };

  void run();
  const timer = setInterval(() => { void run(); }, Math.max(5_000, Math.min(5 * 60_000, Number(intervalMs) || DEFAULT_INTERVAL_MS)));
  timer.unref?.();
  return {
    enabled: true,
    stop() {
      stopped = true;
      clearInterval(timer);
    }
  };
}