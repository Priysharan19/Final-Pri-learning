// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the guest trial (ADR-0003)
//
// A signed-out visitor may try up to GUEST_LIMIT questions per device per day,
// typed or multiple-choice only, marked HERE by the deterministic engine and
// nowhere else. ADR-0001's rule is unchanged for every account: nothing a
// signed-in student does is marked on a device, and a signed-out visitor still
// has nothing checked on the device. What changes is that the server may mark
// a bounded number of answers for a visitor who has no account.
//
// What a guest is:
//   · a sealed, expiring token (AES-GCM under the delivery key, AAD-bound to
//     this feature): a random id, the issue time, the expiry. No name, email,
//     age, account row, child-data record or learning record exists.
//   · carried in an HttpOnly SameSite=Strict cookie scoped to /v1/guest.
//   · state-changing calls also present X-Pri-Guest-CSRF, an HMAC of the token
//     that only the cookie's holder was given in the session reply.
//
// What the server remembers: counters in `rate_limits`, keyed by a hash of the
// token id, of the client's address bucket, and of one issued question. They
// hold a count and a window start. Nothing else; the existing housekeeping
// sweep deletes each row a day after its window opens.
//
// What a guest can never reach: an account, a session, a sync, a history, the
// handwriting or photo reader (a paid provider), a hint beyond the first
// authored one, a question that is premium, or the answer key before a verdict.
//
// Abuse, by layers (the numbers are named and explained at their definitions):
//   1. the origin guard and the CSRF header, as for every browser mutation;
//   2. a per-address rate limit on every route (bot-unfriendly without a CAPTCHA);
//   3. the per-token daily limit (GUEST_LIMIT);
//   4. the per-address daily limit and token-mint limit, so rotating tokens
//      does not mint more questions;
//   5. a process-wide daily ceiling, so the whole feature is never an open
//      marking oracle however many addresses are used;
//   6. one verdict per issued question, a minimum think time before a verdict,
//      and a few attempts at an unreadable entry.
// ─────────────────────────────────────────────────────────────────────────────
import { createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { asyncRouter, asyncHandler } from './asyncRouter.js';
import { asStore } from './store.js';
import { consumeRateLimit, clientIdentity, rateLimit } from './security.js';
import { tagPolicy } from './routePolicy.js';
import { encryptDeliveryToken, decryptDeliveryToken, guestKey } from './deliveryCrypto.js';
import { bankPolicy, sealForEdition } from './editionBanks.js';
import { generateQuestion } from '../../client/src/engine/generators/index.js';
import { premiumCapabilityForGenerator } from '../../client/src/engine/practiceAllowance.js';
import { ensureBanks, safeQuestion, answerTextFor } from './practice.js';
import { markerPool, MARKING_BUSY } from './markerPool.js';

export const GUEST_COOKIE = 'pri_guest';
export const GUEST_CSRF_HEADER = 'x-pri-guest-csrf';
const DAY = 24 * 60 * 60 * 1000;
const TOKEN_CONTEXT = 'guest-token-v1';
const QUESTION_CONTEXT = 'guest-question-v1';

/** Questions a device may try per day: the product's number (the competitor's, per the owner). */
export const GUEST_LIMIT = 5;
export const GUEST_DEFAULTS = Object.freeze({
  limit: GUEST_LIMIT,
  // A household, a classroom or a school can share one address, so the address
  // bucket is a few devices' worth rather than one: 3 devices x 5 questions.
  ipDayLimit: 15,
  // Tokens one address may mint per day. A person clearing cookies a couple of
  // times is served; a loop minting tokens is stopped long before it matters,
  // and each token is worth at most `limit` questions, itself capped by ipDayLimit.
  mintDayLimit: 6,
  // Everything the feature will mark in a day, process-wide (a backstop for a
  // botnet across many addresses). 5000 verdicts is a few seconds of marker
  // time in total, and tiny next to the paid plans' allowance.
  globalDayLimit: 5000,
  // Per address and hour, across all guest routes (the route limiter below).
  routeHourLimit: 120,
  // A question cannot be answered faster than a person can read it. Scripts
  // that issue-and-answer in a loop pay this wait on every question.
  minAnswerMs: 2000,
  // An issued question is answerable for this long.
  questionTtlMs: 30 * 60 * 1000,
  // Entries the marker could not read at all, before the question is closed.
  unreadableTries: 3,
  // Search for a question of the asked-for form (typed / choice).
  formDraws: 60
});

const FORMS = new Set(['any', 'typed', 'choice']);
const GENERATOR = /^[a-z][a-z0-9]{0,11}-[a-z0-9][a-z0-9-]{1,95}$/;
const UUID = /^[0-9a-f-]{36}$/i;
const reject = (res, status, code, message, extra = {}) => res.status(status).json({ error: { code, message, ...extra } });
const plain = v => !!v && typeof v === 'object' && !Array.isArray(v);

function safeEqual(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && timingSafeEqual(x, y);
}

/** The CSRF value for a token: an HMAC only the server can compute, so only the cookie's holder (who was given it in the session reply) has it. */
function csrfFor(rawToken) {
  return createHmac('sha256', guestKey('csrf')).update(String(rawToken || '')).digest('base64url');
}

/** A counter's name: keyed, so a database copy cannot be searched for an address, token or question. */
const scramble = value => createHmac('sha256', guestKey('bucket')).update(String(value)).digest('hex').slice(0, 24);

/** The address a request comes from, for a bucket: an IPv6 address collapses to its /64 so one host cannot rotate within its own prefix. */
export function guestAddressBucket(req) {
  let ip = String(clientIdentity(req) || 'unknown');
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) ip = mapped[1];
  if (ip.includes(':')) ip = ip.split(':').slice(0, 4).join(':');
  return scramble(`ip:${ip}`);
}

function readToken(req, now) {
  const raw = req.cookies?.[GUEST_COOKIE];
  if (typeof raw !== 'string' || raw.length > 600) return null;
  try {
    const v = JSON.parse(decryptDeliveryToken(raw, TOKEN_CONTEXT));
    if (!plain(v) || typeof v.id !== 'string' || !/^[a-f0-9]{32}$/.test(v.id) || !Number.isFinite(v.iat) || !Number.isFinite(v.exp)) return null;
    if (v.exp <= now || v.iat > now + 60_000) return null;
    return { id: v.id, iat: v.iat, exp: v.exp, raw };
  } catch { return null; }
}

function cookieOptions(maxAge) {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/v1/guest', maxAge };
}

export function createGuestTrialRouter(db, { env = process.env, banks = bankPolicy(), now: clock = () => Date.now(), limits = {} } = {}) {
  db = asStore(db);
  const L = { ...GUEST_DEFAULTS, ...limits };
  const router = asyncRouter();

  // The whole feature can be switched off by the deployment (PRI_GUEST_TRIAL=off).
  router.use((req, res, next) => (String(env.PRI_GUEST_TRIAL || 'on').toLowerCase() === 'off'
    ? reject(res, 404, 'NOT_FOUND', 'Platform endpoint not found.') : next()));

  const perAddress = rateLimit(db, 'guest-route', { limit: L.routeHourLimit, windowMs: 60 * 60 * 1000 });

  // The guest CSRF gate: the header must equal the HMAC of the cookie's own
  // token. Tagged so the route inventory reports a CSRF check on every route
  // that spends a unit or marks.
  const guestCsrf = tagPolicy((req, res, next) => {
    const token = readToken(req, clock());
    if (!token) return reject(res, 401, 'GUEST_SESSION_REQUIRED', 'Start the trial again to continue.');
    if (!safeEqual(req.get(GUEST_CSRF_HEADER), csrfFor(token.raw))) return reject(res, 403, 'CSRF_REJECTED', 'Security token is missing or expired.');
    req.guest = token;
    next();
  }, { csrf: 'guest' });

  const view = async (token, now) => {
    const row = await db.get('SELECT count FROM rate_limits WHERE bucket=? AND window_start>?', [`guest-q:${scramble(`token:${token.id}`)}`, now - DAY]);
    const used = Math.min(L.limit, Number(row?.count) || 0);
    return { limit: L.limit, used, remaining: L.limit - used, expiresAt: token.exp };
  };

  // ── Start (or resume) the trial on this device ─────────────────────────────
  router.post('/session', perAddress, asyncHandler(async (req, res) => {
    if (req.body !== undefined && (!plain(req.body) || Object.keys(req.body).length)) return reject(res, 400, 'GUEST_INVALID', 'Starting the trial takes no fields.');
    const now = clock();
    res.set('Cache-Control', 'no-store');
    let token = readToken(req, now);
    if (!token) {
      const mint = await consumeRateLimit(db, `guest-mint:${guestAddressBucket(req)}`, { limit: L.mintDayLimit, windowMs: DAY }, now);
      if (!mint.allowed) return reject(res, 429, 'GUEST_ADDRESS_LIMIT', 'This connection has used its free questions for today.', { resetAt: mint.resetAt });
      const id = randomBytes(16).toString('hex');
      const exp = now + DAY;
      const raw = encryptDeliveryToken(JSON.stringify({ id, iat: now, exp }), TOKEN_CONTEXT);
      res.cookie(GUEST_COOKIE, raw, cookieOptions(DAY));
      token = { id, iat: now, exp, raw };
    }
    return res.status(200).json({ csrf: csrfFor(token.raw), ...(await view(token, now)) });
  }));

  // ── A question ─────────────────────────────────────────────────────────────
  router.post('/question', perAddress, guestCsrf, asyncHandler(async (req, res) => {
    const body = req.body;
    const allowed = new Set(['generator', 'difficulty', 'curriculum', 'form']);
    if (!plain(body) || Object.keys(body).some(k => !allowed.has(k))) return reject(res, 400, 'GUEST_INVALID', 'Choose a chapter, a level and a type of question.');
    const generator = typeof body.generator === 'string' ? body.generator : '';
    const difficulty = Number.isInteger(body.difficulty) ? body.difficulty : NaN;
    const form = body.form === undefined ? 'any' : body.form;
    if (!GENERATOR.test(generator) || !(difficulty >= 1 && difficulty <= 4) || !FORMS.has(form) || body.curriculum !== banks.curriculum) {
      return reject(res, 400, 'GUEST_INVALID', 'Choose a chapter, a level and a type of question.');
    }
    // An edition's own banks only; and nothing premium or archival for a guest.
    if (!banks.issues(generator)) return reject(res, banks.outside.status, banks.outside.code, banks.outside.message);
    if (premiumCapabilityForGenerator(generator) || /^pyq-/.test(generator)) {
      return reject(res, 402, 'GUEST_SIGN_UP_REQUIRED', 'This part of Pri Learning needs an account.');
    }
    await ensureBanks();
    // Choose first (CPU, no state), then spend a unit only for a question that will really be served.
    let q = null;
    try {
      for (let i = 0; i < L.formDraws && !q; i++) {
        const seed = randomInt(0x80000000);
        const candidate = generateQuestion(generator, difficulty, seed, undefined, null);
        if (!candidate || typeof candidate.prompt !== 'string') continue;
        if (candidate.multipart || candidate.answerType === 'working') continue;
        const choice = candidate.answerType === 'mcq';
        if (form === 'typed' && choice) continue;
        if (form === 'choice' && !choice) continue;
        candidate._generator = generator;
        candidate._practiceMode = 'practice';
        if (!sealForEdition(candidate, banks)) continue;
        q = candidate;
      }
    } catch { q = null; }
    if (!q) return reject(res, 422, 'GUEST_NO_QUESTION', 'There is no question of that kind at this level yet.');

    const now = clock();
    // The counters, widest ambiguity last so a refusal spends the least: the
    // device's own, then the address's, then the process's.
    const mine = await consumeRateLimit(db, `guest-q:${scramble(`token:${req.guest.id}`)}`, { limit: L.limit, windowMs: DAY }, now);
    if (!mine.allowed) return reject(res, 429, 'GUEST_LIMIT_REACHED', 'You have tried today\'s free questions.', { resetAt: mine.resetAt, limit: L.limit, remaining: 0 });
    const addr = await consumeRateLimit(db, `guest-ip:${guestAddressBucket(req)}`, { limit: L.ipDayLimit, windowMs: DAY }, now);
    if (!addr.allowed) return reject(res, 429, 'GUEST_ADDRESS_LIMIT', 'This connection has used its free questions for today.', { resetAt: addr.resetAt });
    const all = await consumeRateLimit(db, 'guest-all', { limit: L.globalDayLimit, windowMs: DAY }, now);
    if (!all.allowed) return reject(res, 429, 'GUEST_BUSY', 'The free trial is busy. Please try again later.', { resetAt: all.resetAt });

    const nonce = randomUUID();
    const sealed = encryptDeliveryToken(JSON.stringify({ g: generator, d: difficulty, s: q.seed, t: req.guest.id, n: nonce, i: now, x: now + L.questionTtlMs }), QUESTION_CONTEXT);
    const publicQ = safeQuestion(nonce, q);
    // Only the first authored hint is ever offered to a guest.
    if (Array.isArray(publicQ.hints)) publicQ.hints = publicQ.hints.slice(0, 1);
    res.set('Cache-Control', 'no-store');
    return res.status(201).json({ question: publicQ, sealed, expiresAt: now + L.questionTtlMs, limit: L.limit, remaining: mine.remaining });
  }));

  // ── One verdict per question ───────────────────────────────────────────────
  router.post('/answer', perAddress, guestCsrf, asyncHandler(async (req, res) => {
    const body = req.body;
    if (!plain(body) || Object.keys(body).some(k => !['sealed', 'answer'].includes(k)) || typeof body.sealed !== 'string' || body.sealed.length > 2000
      || typeof body.answer !== 'string' || body.answer.length > 200 || /[\u0000-\u0008\u000b\u000e-\u001f]/.test(body.answer)) {
      return reject(res, 400, 'GUEST_INVALID', 'Send the question and a short answer.');
    }
    let ticket;
    try { ticket = JSON.parse(decryptDeliveryToken(body.sealed, QUESTION_CONTEXT)); } catch { ticket = null; }
    const now = clock();
    if (!plain(ticket) || typeof ticket.n !== 'string' || !UUID.test(ticket.n) || !GENERATOR.test(String(ticket.g)) || !Number.isInteger(ticket.d) || !Number.isSafeInteger(ticket.s)) {
      return reject(res, 400, 'GUEST_QUESTION_INVALID', 'This question is not valid.');
    }
    // Bound to the device that was issued it: a question cannot be answered under another guest's token.
    if (ticket.t !== req.guest.id) return reject(res, 403, 'GUEST_QUESTION_INVALID', 'This question is not valid.');
    if (!(ticket.x > now)) return reject(res, 410, 'GUEST_QUESTION_EXPIRED', 'This question has expired. Start another.');
    if (now - ticket.i < L.minAnswerMs) return reject(res, 429, 'GUEST_TOO_FAST', 'Take a moment to read the question, then answer.', { retryAfterMs: L.minAnswerMs - (now - ticket.i) });
    if (!banks.issues(ticket.g)) return reject(res, banks.outside.status, banks.outside.code, banks.outside.message);
    // A closed question is closed; and an unreadable entry may be retried only a few times.
    const closed = await db.get('SELECT 1 AS x FROM rate_limits WHERE bucket=? AND window_start>?', [`guest-done:${scramble(`q:${ticket.n}`)}`, now - DAY]);
    if (closed) return reject(res, 409, 'GUEST_ALREADY_ANSWERED', 'This question has already been answered.');
    const attempts = await consumeRateLimit(db, `guest-try:${scramble(`q:${ticket.n}`)}`, { limit: L.unreadableTries + 1, windowMs: DAY }, now);
    if (!attempts.allowed) return reject(res, 409, 'GUEST_ALREADY_ANSWERED', 'This question has already been answered.');

    await ensureBanks();
    let q;
    try { q = generateQuestion(ticket.g, ticket.d, ticket.s, undefined, null); } catch { q = null; }
    if (!q) return reject(res, 422, 'GUEST_QUESTION_INVALID', 'This question is not valid.');
    q._generator = ticket.g;
    q._practiceMode = 'practice';
    if (!sealForEdition(q, banks)) return reject(res, 422, 'GUEST_QUESTION_INVALID', 'This question is not valid.');

    const marked = await markerPool().run('practice', { q, answer: body.answer, working: '', evidenceIfWrong: false }, { key: `guest:${req.guest.id}` });
    res.set('Cache-Control', 'no-store');
    if (!marked.ok) {
      if (marked.code === MARKING_BUSY) return reject(res, 503, 'MARKING_BUSY', 'Marking is busy. Try again in a moment.');
      return res.status(200).json({ invalid: true, tooComplex: true, resolved: false });
    }
    const result = marked.value.result;
    if (result.invalid === true) {
      // Not a verdict and nothing about the answer key: the entry could not be read.
      return res.status(200).json({ invalid: true, resolved: false, feedback: typeof result.feedback === 'string' ? result.feedback.slice(0, 300) : null });
    }
    // A verdict: claim the question exactly once, then reveal the answer (it is closed).
    const claim = await consumeRateLimit(db, `guest-done:${scramble(`q:${ticket.n}`)}`, { limit: 1, windowMs: DAY }, now);
    if (!claim.allowed) return reject(res, 409, 'GUEST_ALREADY_ANSWERED', 'This question has already been answered.');
    const mine = await view(req.guest, now);
    return res.status(200).json({ resolved: true, correct: result.correct === true, answer: answerTextFor(q), remaining: mine.remaining, limit: L.limit });
  }));

  return router;
}
