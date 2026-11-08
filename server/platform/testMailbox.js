// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the staging test mailbox: where reserved-domain mail is kept
//
// When testMailboxPolicy.js says the mailbox is on, a sign-in code, an
// account-action link or a security notice addressed to
// `<local>@e2e.prilearning.test` is deposited here instead of being sent
// (otp.js deliver, authDelivery.js drainAuthDeliveryOutbox, sessionAlerts.js).
// Everything else about the message is unchanged: the code still expires, is
// single-use and rate-limited (otpCore.js), and the link is the same one-hour,
// single-use bearer. Nothing here makes an account eligible: practice still
// requires a verified email, and the address is verified the ordinary way, by
// spending the code or the link.
//
// STORAGE. Rows of platform_meta whose key starts `test-mailbox:` — the one
// key/value table both engines already have and the server role may write —
// so the mailbox survives a restart and is shared by every replica, with no
// schema change. One row per address and kind (code | link | notice), holding
// the newest message of that kind. Every entry expires TEST_MAIL_TTL_MS after
// it was kept, and at most TEST_MAILBOX_CAP entries exist: each deposit drops
// what has expired and then the oldest beyond the cap. The key carries a hash
// of the address, never the address; the address is synthetic either way.
//
// RETRIEVAL. GET /v1/test-mailbox/latest?to=<address>[&kind=code|link|notice]
// answers 200 with the NEWEST message kept for exactly that address:
//   { to, subject, text, receivedAt, code, purpose, kind, link, expiresAt, synthetic }
// `subject` and `text` are the real subject line and plain-text body the
// address would have been sent. For a code, `purpose` is 'sign-in' (sign-in
// and re-authentication codes: the same email), 'delete' (the public deletion
// page's code) or 'guardian' (a parent's approval code), and `link` is null;
// for a link or a notice, `code` is null and `purpose` names it
// ('verify-email', 'reset-password', 'guardian-consent', 'guardian-withdraw',
// 'new-device'). In every other case — the mailbox off, an address that is not
// a reserved one, or nothing kept for it — the request falls through to /v1's
// ordinary 404, so all three bodies are identical; when off or not reserved it
// leaves before any rate limit or read. In production it never answers.
// ─────────────────────────────────────────────────────────────────────────────
import { asStore } from './store.js';
import { asyncRouter } from './asyncRouter.js';
import { rateLimit, sha256 } from './security.js';
import { isTestMailboxAddress, testMailboxEnabled } from './testMailboxPolicy.js';

const PREFIX = 'test-mailbox:';
/** How long a kept message can be read: longer than a code (10 min) or a link (1 h) lives. */
export const TEST_MAIL_TTL_MS = 60 * 60 * 1000;
/** The most messages kept at once, across every address. */
export const TEST_MAILBOX_CAP = 500;
export const TEST_MAIL_KINDS = Object.freeze(['code', 'link', 'notice']);
/** Reads of the mailbox one client may make per hour. */
export const TEST_MAILBOX_READS_PER_HOUR = 240;

const normalise = address => String(address ?? '').trim().toLowerCase();
const keyFor = (address, kind) => `${PREFIX}${sha256(normalise(address)).slice(0, 32)}:${kind}`;
const parse = value => { try { return JSON.parse(value); } catch { return null; } };

/**
 * Keep one message for a reserved address. Refuses any other address, so a bug
 * upstream can never put a real person's code or link in a readable mailbox.
 */
export async function depositTestMail(db, { to, kind, purpose = null, code = null, link = null, subject = null, text = null, now = Date.now() }) {
  db = asStore(db);
  const address = normalise(to);
  if (!isTestMailboxAddress(address)) {
    throw Object.assign(new Error('Only a reserved test address has a test mailbox.'), { code: 'TEST_MAILBOX_ADDRESS_REFUSED' });
  }
  if (!TEST_MAIL_KINDS.includes(kind)) throw Object.assign(new Error('Unknown test mail kind.'), { code: 'TEST_MAILBOX_KIND_INVALID' });
  const entry = {
    to: address, kind,
    purpose: purpose == null ? null : String(purpose).slice(0, 40),
    code: code == null ? null : String(code).slice(0, 16),
    link: link == null ? null : String(link).slice(0, 2048),
    subject: subject == null ? null : String(subject).slice(0, 200),
    text: text == null ? null : String(text).slice(0, 4000),
    receivedAt: now, expiresAt: now + TEST_MAIL_TTL_MS, synthetic: true
  };
  await db.run(`INSERT INTO platform_meta(key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [keyFor(address, kind), JSON.stringify(entry)]);
  await pruneTestMailbox(db, now);
  return entry;
}

/** Drop expired entries, then the oldest beyond the cap. Returns how many went. */
export async function pruneTestMailbox(db, now = Date.now(), { cap = TEST_MAILBOX_CAP } = {}) {
  db = asStore(db);
  const rows = await db.all('SELECT key, value FROM platform_meta WHERE key LIKE ?', [`${PREFIX}%`]);
  const entries = rows.map(row => ({ key: row.key, entry: parse(row.value) }));
  const doomed = new Set(entries.filter(({ entry }) => !entry || !(Number(entry.expiresAt) > now)).map(({ key }) => key));
  const live = entries.filter(({ key }) => !doomed.has(key)).sort((a, b) => Number(b.entry.receivedAt) - Number(a.entry.receivedAt));
  for (const { key } of live.slice(Math.max(0, cap))) doomed.add(key);
  for (const key of doomed) await db.run('DELETE FROM platform_meta WHERE key = ?', [key]);
  return doomed.size;
}

/** The newest unexpired message for a reserved address (optionally of one kind), or null. */
export async function latestTestMail(db, to, { kind = null, now = Date.now() } = {}) {
  db = asStore(db);
  const address = normalise(to);
  if (!isTestMailboxAddress(address)) return null;
  const rows = await db.all('SELECT value FROM platform_meta WHERE key IN (?, ?, ?)', TEST_MAIL_KINDS.map(k => keyFor(address, k)));
  const live = rows.map(row => parse(row.value))
    .filter(entry => entry && entry.to === address && Number(entry.expiresAt) > now && (!kind || entry.kind === kind));
  live.sort((a, b) => Number(b.receivedAt) - Number(a.receivedAt));
  return live[0] || null;
}

/** GET /v1/test-mailbox/latest — see the header. */
export function createTestMailboxRouter(db, { env = process.env } = {}) {
  db = asStore(db);
  const router = asyncRouter();
  // The gate runs before anything else, the rate limit included: when the
  // mailbox is off, or the address is not a reserved one, nothing is read or
  // written and the request leaves this router for /v1's ordinary 404.
  router.use((req, res, next) => {
    if (testMailboxEnabled(env) && isTestMailboxAddress(req.query?.to)) return next();
    return next('router');
  });
  router.get('/latest', rateLimit(db, 'test-mailbox', { limit: TEST_MAILBOX_READS_PER_HOUR, windowMs: 60 * 60 * 1000 }), async (req, res, next) => {
    const kind = req.query?.kind == null ? null : String(req.query.kind);
    res.set('Cache-Control', 'no-store');
    if (kind !== null && !TEST_MAIL_KINDS.includes(kind)) {
      return res.status(400).json({ error: { code: 'TEST_MAIL_KIND_INVALID', message: 'kind is code, link or notice.' } });
    }
    const entry = await latestTestMail(db, req.query.to, { kind });
    // Nothing kept: the same ordinary 404 as when the mailbox is off.
    if (!entry) return next('router');
    res.json(entry);
  });
  return router;
}
