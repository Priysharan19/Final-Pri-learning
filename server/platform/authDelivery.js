import { decryptDeliveryToken } from './deliveryCrypto.js';
import { asStore, assertNoOpenTransaction, sqliteHandle } from './store.js';
import { recordAuthEmail } from './metrics.js';
import { logEvent, safeCode as logCode } from './observability.js';

const MAX_ATTEMPTS = 8;
const DEFAULT_BATCH = 20;
const DEFAULT_INTERVAL_MS = 30_000;
const REQUEST_TIMEOUT_MS = 10_000;
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

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

function cleanPublicOrigin(raw) {
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
  const url = new URL('/account-action', cleanPublicOrigin(publicOrigin));
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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('Auth email provider timed out')), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetchImpl(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `pri-auth/${outboxId}`.slice(0, 256),
          'User-Agent': 'Pri-Learning-Auth/1.0'
        },
        body: JSON.stringify({
          from: sender,
          to: [String(to)],
          subject: message.subject,
          text: message.text,
          html: message.html,
          tags: [{ name: 'category', value: kind.replace(/-/g, '_') }]
        }),
        signal: controller.signal
      });
      const text = await response.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { /* provider body is not trusted */ }
      if (!response.ok) {
        const err = new Error('Auth email provider rejected the request');
        err.code = `RESEND_${response.status}`;
        throw err;
      }
      const providerMessageId = String(data?.id || '').slice(0, 160);
      if (!providerMessageId) {
        const err = new Error('Auth email provider returned no message id');
        err.code = 'RESEND_BAD_RESPONSE';
        throw err;
      }
      return { providerMessageId };
    } finally {
      clearTimeout(timer);
    }
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