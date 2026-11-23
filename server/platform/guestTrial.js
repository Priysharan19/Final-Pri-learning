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
// After a wrong answer (the worked-step flow): the first verdict on a question
// that has worked steps does not reveal the answer. It returns the first step,
// and the question stays open for ONE more answer, for as long as the answer has
// not been released. Further steps are released one request at a time by
// /steps, in order; asking for the step after the last is what releases the
// answer, and that closes the question. The state is three keyed counters on the
// question (a wrong verdict, steps released, closed); the ticket stays sealed
// and stateless, so a device cannot move it. Steps are never released before a
// first verdict, a retry is a second verdict that closes the question, and
// neither a step nor a retry spends a unit of the day's allowance: only a
// question does.
//
// What a guest can never reach: an account, a session, a sync, a history, the
// handwriting or photo reader (a paid provider), a hint beyond the first
// authored one, a question that is premium, or the answer key before a verdict.
//
// Abuse, by layers (the numbers are named and explained at their definitions):
//   1. the origin guard and the CSRF header, as for every browser mutation;
//   2. a per-address rate limit on every route (bot-unfriendly without a CAPTCHA);
//   3. the per-token daily limit (GUEST_LIMIT);
//   4. the per-address (IPv4, or IPv6 /64) and per-/48 daily limits and token-mint
//      limits, so rotating tokens or /64s does not mint more questions;
//   5. a process-wide daily ceiling, so the whole feature is never an open
//      marking oracle however many addresses are used;
//   6. one verdict per issued question, a minimum think time before a verdict,
//      and a few attempts at an unreadable entry.
// ─────────────────────────────────────────────────────────────────────────────
import { createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { asyncRouter, asyncHandler } from './asyncRouter.js';
import { asStore } from './store.js';
import { consumeRateLimit, clientIdentity } from './security.js';
import { tagPolicy } from './routePolicy.js';
import { encryptDeliveryToken, decryptDeliveryToken, guestKey } from './deliveryCrypto.js';
import { bankPolicy, sealForEdition } from './editionBanks.js';
import { generateQuestion, formDrawShares } from '../../client/src/engine/generators/index.js';
import { makeRng } from '../../client/src/engine/qhelpers.js';
import { subtopicOfferedIn } from '../../client/src/engine/offeringRules.js';
import { editionOffering } from './edition.js';
import { premiumCapabilityForGenerator } from '../../client/src/engine/practiceAllowance.js';
import { ensureBanks, safeQuestion, answerTextFor } from './practice.js';
import { CONTENT_VERSION, UNVERSIONED_TOKEN_CONTENT_VERSION } from '../../client/src/engine/contentIdentity.js';
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
  // The same, per IPv6 /48 (a site's or a provider's allocation): a host with a
  // /56 or /48 can rotate /64 buckets at will, so the /48 is the one that bounds it.
  // 60 questions and 24 tokens a day is four times the /64 allowance, which
  // leaves a school or an office behind one allocation served.
  prefixDayLimit: 60,
  prefixMintDayLimit: 24,
  // Per address and hour, across all guest routes (the route limiter below).
  routeHourLimit: 120,
  // The worked steps: up to a dozen requests a question, so their own counter, apart from the route limit above.
  stepsHourLimit: 240,
  // A question cannot be answered faster than a person can read it. Scripts
  // that issue-and-answer in a loop pay this wait on every question.
  minAnswerMs: 2000,
  // An issued question is answerable for this long.
  questionTtlMs: 30 * 60 * 1000,
  // Entries the marker could not read at all, before the question is closed.
  unreadableTries: 3,
  // After a verdict, the same token may re-fetch it (same answer) for this long.
  verdictRetryMs: 2 * 60 * 1000,
  // Search for a question of the asked-for form (typed / choice).
  formDraws: 60
});

/** The most worked steps a guest question can release. */
const MAX_STEPS = 12;

/**
 * Which form of its skill a seed draws: 0 is the direct form, 1... the extra
 * forms, by the engine's own share table and stream (engine/generators/index.js
 * pickForm). A skill with one form has only 0. Used only to offer "one like it"
 * in a different form; it never touches a mark.
 */
export function formIndexOf(generator, seed) {
  const shares = formDrawShares(generator);
  if (!shares) return 0;
  let at = makeRng((seed ^ 0x2f6b9c1d) >>> 0)();
  for (let i = 0; i < shares.length; i++) {
    if (at < shares[i]) return i;
    at -= shares[i];
  }
  return shares.length - 1;
}
export const formCountOf = generator => formDrawShares(generator)?.length || 1;

const bareText = (text, keepSpaces = false) => String(text ?? '')
  .replace(/\\(?:Rightarrow|rightarrow|implies|therefore)/g, '⇒')
  .replace(/([\^_])\s*\{([^{}]*)\}/g, '$1$2')
  .replace(/\\d?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '$1/$2')
  .replace(/\\sqrt\s*\{([^{}]*)\}/g, '√$1')
  .replace(/\^\s*\\circ/g, '°').replace(/\\circ/g, '°')
  .replace(/\\(?:times|cdot)/g, '×').replace(/\\pi\b/g, 'π')
  .replace(/\\[a-zA-Z]+|\\[,;! ]/g, ' ').replace(/[{}$]/g, ' ')
  .replace(/\s+/g, keepSpaces ? ' ' : '').trim().replace(/[−–]/g, '-').replace(/\s*\+\s*-/g, '-').replace(/\.$/, '').toLowerCase();
const escapeRe = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Everything a step must not state before the answer is released: the displayed answer, its value, its canonical input, and each solution of a set. */
function answerTokens(q, keep) {
  const text = bareText(answerTextFor(q), keep);
  const value = text.replace(/^[a-z]'?(\([a-z0-9]\))?\s*=\s*/, '');
  const out = new Set([text, value, bareText(q?.answer?.canonicalInput, keep)]);
  out.add(value.replace(/^[×*·]\s*/, ''));
  const num = value.match(/^-?\d+(?:\.\d+)?(?![\d.a-z])/)?.[0];
  if (num) out.add(num);
  for (const part of value.replace(/[()[\]]/g, '').split(/[,;]|\bor\b|\band\b/)) out.add(part.trim().replace(/^[a-z]'?\s*=\s*/, ''));
  return [...out].filter(Boolean);
}
/**
 * A second, cruder reading of the same question, kept deliberately independent of bareText: every character that is not a letter, digit,
 * point, minus, root, pi, slash or equals sign becomes a space, so digits that LaTeX glues together (a limit's ^1 against the next numerator)
 * stay separate, and each token must stand alone between spaces. It adds tokens (the displayed answer, its canonical input, the value
 * without its label, the leading number of a fraction or decimal of a numeric answer, and each solution of a set) and so can only ever
 * close a question EARLIER, never later: statesAnswer is true when either reading finds the answer.
 */
const crudeText = s => String(s ?? '').replace(/\\(?:d?frac|left|right|Rightarrow|rightarrow|times|cdot|text|quad)/g, ' ').replace(/\\sqrt/g, '√').replace(/[−–]/g, '-').replace(/\+\s*-/g, '-').replace(/[^0-9a-zA-Z.\-√π/=]+/g, ' ').toLowerCase();
const flatText = s => crudeText(s).replace(/\s+/g, '');
function flatTokens(q) {
  const shown = flatText(answerTextFor(q));
  const out = new Set([shown, flatText(q?.answer?.canonicalInput), shown.replace(/^[a-z]'?(\([a-z0-9]\))?=/, ''), shown.replace(/^[a-z]=/, '').replace(/^[×*]/, '')]);
  const lead = shown.replace(/^[a-z]=/, '').match(/^-?\d+(?:\.\d+)?(?![\d.a-z])/)?.[0];
  if (lead && q?.answerType === 'numeric') out.add(lead);
  for (const part of String(answerTextFor(q)).replace(/\\[,;! ]/g, ' ').split(/[,;]|\bor\b|\band\b/)) out.add(flatText(part).replace(/^[a-z]=/, ''));
  return [...out].filter(t => t.length > 0);
}
function flatStatesAnswer(step, q) {
  const tokens = flatTokens(q);
  return [step?.d, step?.h].some(raw => {
    const text = ' ' + crudeText(raw).replace(/=/g, ' = ').replace(/,/g, ' ') + ' ';
    return tokens.some(token => { for (let at = text.indexOf(token); at !== -1; at = text.indexOf(token, at + 1)) { if (!/[0-9a-z.]/.test(text[at - 1] ?? ' ') && !/[0-9a-z.]/.test(text[at + token.length] ?? ' ')) return true; } return false; });
  });
}
/**
 * Whether a step states the answer anywhere in its working or heading, as a whole token (not inside a longer number): showing it releases the answer, so it ends the question as the answer does. Deliberately conservative: a middle
 * step that merely contains a number equal to the answer closes the question there, and a step this cannot decide is treated as stating it.
 */
function statesAnswer(step, q) {
  if (!answerTokens(q, false).length) return true;
  if (flatStatesAnswer(step, q)) return true;
  return [false, true].some(keep => {
    const tokens = answerTokens(q, keep);
    return [step?.d, step?.h].some(raw => {
      const text = bareText(raw, keep);
      return text !== '' && tokens.some(t => new RegExp(`(?<![0-9.])${escapeRe(t)}(?![0-9.])`).test(text));
    });
  });
}

/** The worked steps a guest may be shown: heading and working only (a figure is not part of the trial), or [] when there is no safe first step. */
export function guestSteps(q) {
  const steps = Array.isArray(q?.steps) ? q.steps : [];
  let out = steps.filter(x => x && typeof x.h === 'string' && typeof x.d === 'string').map(x => ({ h: x.h.slice(0, 400), d: x.d.slice(0, 1200) }));
  // A step that only restates the question is not the first useful step.
  const asked = bareText(q?.prompt);
  while (out.length && bareText(out[0].d).length >= 3 && asked.includes(bareText(out[0].d))) out = out.slice(1);
  out = out.slice(0, MAX_STEPS);
  if (out.length < 2) return [];   // a one-step solution is the answer itself: no retry is offered
  // A first step whose working ends on the answer is not a step toward it: the question resolves as it always did.
  if (statesAnswer(out[0], q)) return [];
  return out;
}

/** The 1-based step at which the answer is released: the first step that states it, else the answer after the last step. */
export function closingStepOf(q, steps = guestSteps(q)) {
  const at = steps.findIndex(step => statesAnswer(step, q));
  return at === -1 ? steps.length + 1 : at + 1;
}

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

/** The eight 16-bit groups of an IPv6 address, '::' expanded; null when it is not one. */
function ipv6Groups(ip) {
  if (!ip.includes(':') || ip.includes(':::')) return null;
  const [head, tail, ...more] = ip.split('::');
  if (more.length) return null;
  const a = head ? head.split(':') : [];
  const b = tail ? tail.split(':') : [];
  if (tail === undefined ? a.length !== 8 : a.length + b.length > 7) return null;
  const groups = tail === undefined ? a : [...a, ...Array(8 - a.length - b.length).fill('0'), ...b];
  if (!groups.every(g => /^[0-9a-f]{1,4}$/i.test(g))) return null;
  return groups.map(g => g.toLowerCase().padStart(4, '0'));
}

/**
 * The address buckets a request counts against, keyed: `address` (an IPv4
 * address, or an IPv6 /64, so one host cannot rotate within its own prefix) and
 * `prefix` (an IPv6 /48, null for IPv4), so a /56 or /48 cannot rotate /64s.
 */
export function guestAddressBuckets(req) {
  let ip = String(clientIdentity(req) || 'unknown').trim();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) ip = mapped[1];
  const groups = ipv6Groups(ip);
  if (!groups) return { address: scramble(`ip:${ip}`), prefix: null };
  return { address: scramble(`ip:${groups.slice(0, 4).join(':')}`), prefix: scramble(`ip48:${groups.slice(0, 3).join(':')}`) };
}
/** The /64 (or IPv4) bucket alone (kept for callers that only need it). */
export const guestAddressBucket = req => guestAddressBuckets(req).address;

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

  // The per-address route limiter. It is the shared rateLimit() in every way but
  // one: its counter is named with the guest key, so no row holds an unkeyed hash
  // of an address (the shared limiter's names are a plain sha256, which an IPv4
  // address can be recovered from).
  const routeWindow = 60 * 60 * 1000;
  const routeLimiter = (name, limit) => tagPolicy(asyncHandler(async (req, res, next) => {
    const verdict = await consumeRateLimit(db, `${name}:${scramble(`${name === 'guest-route' ? 'route' : name}:${clientIdentity(req)}`)}`, { limit, windowMs: routeWindow }, clock());
    res.set('RateLimit-Remaining', String(verdict.remaining));
    res.set('RateLimit-Reset', String(Math.ceil(verdict.resetAt / 1000)));
    if (!verdict.allowed) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((verdict.resetAt - clock()) / 1000))));
      return res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' } });
    }
    next();
  }), { rateLimit: { key: name, limit, windowMs: routeWindow } });
  const perAddress = routeLimiter('guest-route', L.routeHourLimit);
  const stepsPerAddress = routeLimiter('guest-steps', L.stepsHourLimit);

  /**
   * Spend one unit from each counter in turn; if any refuses, give back what was
   * already spent, so a refused request costs the visitor nothing. `plan` is
   * [{ bucket, limit, tag }]; resolves { ok: true, taken } or { ok: false, tag, verdict }.
   */
  const spendAll = async (plan, now) => {
    const taken = [];
    for (const step of plan) {
      const verdict = await consumeRateLimit(db, step.bucket, { limit: step.limit, windowMs: DAY }, now);
      if (!verdict.allowed) {
        for (const t of taken) await db.run('UPDATE rate_limits SET count = count - 1 WHERE bucket = ? AND window_start = ? AND count > 0', [t.bucket, t.windowStart]);
        return { ok: false, tag: step.tag, verdict };
      }
      taken.push({ bucket: step.bucket, windowStart: verdict.resetAt - DAY, verdict });
    }
    return { ok: true, taken };
  };

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
      const b = guestAddressBuckets(req);
      const mint = await spendAll([
        { bucket: `guest-mint:${b.address}`, limit: L.mintDayLimit, tag: 'addr' },
        ...(b.prefix ? [{ bucket: `guest-mint48:${b.prefix}`, limit: L.prefixMintDayLimit, tag: 'prefix' }] : [])
      ], now);
      if (!mint.ok) return reject(res, 429, 'GUEST_ADDRESS_LIMIT', 'This connection has used its free questions for today.', { resetAt: mint.verdict.resetAt });
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
    const allowed = new Set(['generator', 'difficulty', 'curriculum', 'form', 'like']);
    if (!plain(body) || Object.keys(body).some(k => !allowed.has(k))) return reject(res, 400, 'GUEST_INVALID', 'Choose a chapter, a level and a type of question.');
    const generator = typeof body.generator === 'string' ? body.generator : '';
    const difficulty = Number.isInteger(body.difficulty) ? body.difficulty : NaN;
    const form = body.form === undefined ? 'any' : body.form;
    if (!GENERATOR.test(generator) || !(difficulty >= 1 && difficulty <= 4) || !FORMS.has(form) || body.curriculum !== banks.curriculum) {
      return reject(res, 400, 'GUEST_INVALID', 'Choose a chapter, a level and a type of question.');
    }
    // "One like it": a new question on the same skill and level in a different form than one this device has
    // answered. The earlier question must be this device's own and answered (a verdict has been given on it).
    let like = null;
    if (body.like !== undefined) {
      if (typeof body.like !== 'string' || body.like.length > 2000) return reject(res, 400, 'GUEST_INVALID', 'Choose a chapter, a level and a type of question.');
      const opened = openTicket(req, res, body.like, { think: false });
      if (!opened) return undefined;
      if (opened.ticket.g !== generator || opened.ticket.d !== difficulty) return reject(res, 400, 'GUEST_QUESTION_INVALID', 'This question is not valid.');
      const k = names(opened.ticket);
      if (!(await live(k.done, opened.now))) return reject(res, 409, 'GUEST_NOT_ANSWERED', 'Finish the question first.');
      like = { form: formIndexOf(generator, opened.ticket.s), seed: opened.ticket.s };
    }
    // An edition's own banks only; and nothing premium or archival for a guest.
    if (!banks.issues(generator)) return reject(res, banks.outside.status, banks.outside.code, banks.outside.message);
    // Owner decision, 19 Nov 2026: the year or course must be one this edition offers (practice.js refuseNotOffered).
    if (!subtopicOfferedIn(editionOffering(env), generator)) return reject(res, 403, 'COURSE_NOT_OFFERED', 'This year or course is not offered yet. Year 11 and Year 12 Mathematics Advanced and Extension 1 are.');
    if (premiumCapabilityForGenerator(generator) || /^pyq-/.test(generator)) {
      return reject(res, 402, 'GUEST_SIGN_UP_REQUIRED', 'This part of Pri Learning needs an account.');
    }
    await ensureBanks();
    // Choose first (CPU, no state), then spend a unit only for a question that will really be served.
    let q = null, sameForm = false, fallback = null;
    const forms = formCountOf(generator);
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
        if (like && (candidate.seed === like.seed)) continue;
        // A different form when the skill has one; otherwise (or when none turns up) the best that is a different question.
        if (like && forms > 1 && formIndexOf(generator, candidate.seed) === like.form) { fallback = fallback || candidate; continue; }
        q = candidate;
      }
      if (!q && fallback) { q = fallback; sameForm = true; }
    } catch { q = null; }
    if (!q) return reject(res, 422, 'GUEST_NO_QUESTION', 'There is no question of that kind at this level yet.');

    const now = clock();
    // All the counters or none: the device's own, the address's /64, its /48, then
    // the process's. A request any of them refuses gives back what it took, so the
    // visitor's remaining count is unchanged by a refusal that was not theirs.
    const b = guestAddressBuckets(req);
    const spent = await spendAll([
      { bucket: `guest-q:${scramble(`token:${req.guest.id}`)}`, limit: L.limit, tag: 'token' },
      { bucket: `guest-ip:${b.address}`, limit: L.ipDayLimit, tag: 'addr' },
      ...(b.prefix ? [{ bucket: `guest-ip48:${b.prefix}`, limit: L.prefixDayLimit, tag: 'prefix' }] : []),
      { bucket: 'guest-all', limit: L.globalDayLimit, tag: 'all' }
    ], now);
    if (!spent.ok) {
      const { tag, verdict } = spent;
      if (tag === 'token') return reject(res, 429, 'GUEST_LIMIT_REACHED', 'You have tried today\'s free questions.', { resetAt: verdict.resetAt, limit: L.limit, remaining: 0 });
      if (tag === 'all') return reject(res, 429, 'GUEST_BUSY', 'The free trial is busy. Please try again later.', { resetAt: verdict.resetAt });
      return reject(res, 429, 'GUEST_ADDRESS_LIMIT', 'This connection has used its free questions for today.', { resetAt: verdict.resetAt });
    }
    const mine = spent.taken[0].verdict;

    const nonce = randomUUID();
    const sealed = encryptDeliveryToken(JSON.stringify({ g: generator, d: difficulty, s: q.seed, t: req.guest.id, n: nonce, i: now, x: now + L.questionTtlMs, c: CONTENT_VERSION }), QUESTION_CONTEXT);
    const publicQ = safeQuestion(nonce, q);
    // Only the first authored hint is ever offered to a guest.
    if (Array.isArray(publicQ.hints)) publicQ.hints = publicQ.hints.slice(0, 1);
    res.set('Cache-Control', 'no-store');
    return res.status(201).json({ question: publicQ, sealed, expiresAt: now + L.questionTtlMs, limit: L.limit, remaining: mine.remaining, ...(like ? { like: { differentForm: forms > 1 && !sameForm } } : {}) });
  }));

  // ── The ticket of an issued question ───────────────────────────────────────
  // Sealed, bound to this device, unexpired, of this server's content, and (for a
  // verdict or a step) not asked faster than a person can read. Sends the refusal
  // itself and resolves null, or resolves { ticket, now }.
  const openTicket = (req, res, sealed, { think = true } = {}) => {
    let ticket;
    try { ticket = JSON.parse(decryptDeliveryToken(sealed, QUESTION_CONTEXT)); } catch { ticket = null; }
    const now = clock();
    if (!plain(ticket) || typeof ticket.n !== 'string' || !UUID.test(ticket.n) || !GENERATOR.test(String(ticket.g)) || !Number.isInteger(ticket.d) || !Number.isSafeInteger(ticket.s)) {
      reject(res, 400, 'GUEST_QUESTION_INVALID', 'This question is not valid.'); return null;
    }
    // Bound to the device that was issued it: a question cannot be answered under another guest's token.
    if (ticket.t !== req.guest.id) { reject(res, 403, 'GUEST_QUESTION_INVALID', 'This question is not valid.'); return null; }
    if (!(ticket.x > now)) { reject(res, 410, 'GUEST_QUESTION_EXPIRED', 'This question has expired. Start another.'); return null; }
    // Issued under other content than this server serves: its seed would draw a different question. Refused as an expired one is.
    if ((typeof ticket.c === 'string' ? ticket.c : UNVERSIONED_TOKEN_CONTENT_VERSION) !== CONTENT_VERSION) { reject(res, 410, 'GUEST_QUESTION_EXPIRED', 'This question has expired. Start another.'); return null; }
    if (think && now - ticket.i < L.minAnswerMs) { reject(res, 429, 'GUEST_TOO_FAST', 'Take a moment to read the question, then answer.', { retryAfterMs: L.minAnswerMs - (now - ticket.i) }); return null; }
    if (!banks.issues(ticket.g)) { reject(res, banks.outside.status, banks.outside.code, banks.outside.message); return null; }
    return { ticket, now };
  };
  const rebuild = async ticket => {
    await ensureBanks();
    let q;
    try { q = generateQuestion(ticket.g, ticket.d, ticket.s, undefined, null); } catch { q = null; }
    if (!q) return null;
    q._generator = ticket.g;
    q._practiceMode = 'practice';
    return sealForEdition(q, banks) ? q : null;
  };
  // The keyed counters of one question: closed, first verdict wrong (the one retry is open), steps released.
  const names = ticket => ({
    done: `guest-done:${scramble(`q:${ticket.n}`)}`,
    first: `guest-first:${scramble(`q:${ticket.n}`)}`,
    retry: `guest-retry:${scramble(`q:${ticket.n}`)}`,
    wrong: `guest-wrong:${scramble(`q:${ticket.n}`)}`,
    steps: `guest-steps:${scramble(`q:${ticket.n}`)}`
  });
  const live = (bucket, now) => db.get('SELECT count FROM rate_limits WHERE bucket=? AND window_start>?', [bucket, now - DAY]);
  const stepBody = (q, steps, shown) => ({ shown, total: steps.length, step: shown >= 1 && shown <= steps.length ? steps[shown - 1] : null, endsNext: shown < closingStepOf(q, steps) && shown + 1 >= closingStepOf(q, steps), moreForms: formCountOf(q._generator) > 1 });

  // ── One verdict per question, and one more after a worked step ─────────────
  router.post('/answer', perAddress, guestCsrf, asyncHandler(async (req, res) => {
    const body = req.body;
    if (!plain(body) || Object.keys(body).some(k => !['sealed', 'answer'].includes(k)) || typeof body.sealed !== 'string' || body.sealed.length > 2000
      || typeof body.answer !== 'string' || body.answer.length > 200 || /[\u0000-\u0008\u000b\u000e-\u001f]/.test(body.answer)) {
      return reject(res, 400, 'GUEST_INVALID', 'Send the question and a short answer.');
    }
    const opened = openTicket(req, res, body.sealed);
    if (!opened) return undefined;
    const { ticket, now } = opened;
    const key = names(ticket);
    // A closed question is closed; the first verdict, if it was wrong, left the question open for one more.
    const closed = await live(key.done, now);
    const firstWrong = await live(key.wrong, now);
    // A verdict lost in transit: the same token sending the same answer again, for
    // a short while after the claim, is told the same verdict. This is a read of
    // a keyed bit written with the claim; the question is not marked a second time.
    // v1 = the first verdict (1 right, 2 wrong and closed, 3 wrong and open for a retry); v2 = the retry's (1 right, 2 wrong).
    const replayName = (v, answer) => `guest-ver:${scramble(`q:${ticket.n}:t:${req.guest.id}:${v === 1 ? '' : `v${v}:`}a:${answer}`)}`;
    const trimmed = body.answer.trim();
    const first = await db.get('SELECT count FROM rate_limits WHERE bucket=? AND window_start>?', [replayName(1, trimmed), now - L.verdictRetryMs]);
    const second = closed ? await db.get('SELECT count FROM rate_limits WHERE bucket=? AND window_start>?', [replayName(2, trimmed), now - L.verdictRetryMs]) : null;
    const replayCount = Number(second?.count || 0) ? { v: 2, n: Number(second.count) } : Number(first?.count || 0) ? { v: 1, n: Number(first.count) } : null;
    if (replayCount && (replayCount.n === 1 || replayCount.n === 2 || (replayCount.v === 1 && replayCount.n === 3 && !closed))) {
      const q = await rebuild(ticket);
      if (q) {
        res.set('Cache-Control', 'no-store');
        const left = await view(req.guest, now);
        if (replayCount.n === 3) {
          const steps = guestSteps(q);
          return res.status(200).json({ resolved: false, correct: false, retry: true, ...stepBody(q, steps, 1), remaining: left.remaining, limit: L.limit, replayed: true });
        }
        return res.status(200).json({ resolved: true, correct: replayCount.n === 1, answer: answerTextFor(q), assisted: replayCount.v === 2 && replayCount.n === 1, moreForms: formCountOf(ticket.g) > 1, remaining: left.remaining, limit: L.limit, replayed: true });
      }
    }
    if (closed) return reject(res, 409, 'GUEST_ALREADY_ANSWERED', 'This question has already been answered.');
    const retrying = !!firstWrong;
    // The entry the marker could not read at all: a few tries, then the question closes. The retry has its own few.
    const attempts = await consumeRateLimit(db, `${retrying ? 'guest-try2' : 'guest-try'}:${scramble(`q:${ticket.n}`)}`, { limit: L.unreadableTries + 1, windowMs: DAY }, now);
    if (!attempts.allowed) return reject(res, 409, 'GUEST_ALREADY_ANSWERED', 'This question has already been answered.');

    const q = await rebuild(ticket);
    if (!q) return reject(res, 422, 'GUEST_QUESTION_INVALID', 'This question is not valid.');

    // ONE claim per verdict, taken BEFORE marking: exactly one request wins the first verdict of a ticket, and (after a wrong
    // first verdict) exactly one wins the retry. Any request that arrives while the claim is held, or after it is spent, is
    // refused, so parallel guesses cannot each be marked, and "right first time" belongs only to the holder of the first claim.
    const turn = retrying ? key.retry : key.first;
    const held = await consumeRateLimit(db, turn, { limit: 1, windowMs: DAY }, now);
    if (!held.allowed) return reject(res, 409, 'GUEST_ALREADY_ANSWERED', 'This question has already been answered.');
    // An entry that gives no verdict gives the claim back (the visitor may correct it).
    const giveBack = () => db.run('UPDATE rate_limits SET count = count - 1 WHERE bucket = ? AND count > 0', [turn]);
    let marked;
    try { marked = await markerPool().run('practice', { q, answer: body.answer, working: '', evidenceIfWrong: false }, { key: `guest:${req.guest.id}` }); }
    catch (error) { await giveBack(); throw error; }
    res.set('Cache-Control', 'no-store');
    if (!marked.ok) {
      await giveBack();
      if (marked.code === MARKING_BUSY) return reject(res, 503, 'MARKING_BUSY', 'Marking is busy. Try again in a moment.');
      return res.status(200).json({ invalid: true, tooComplex: true, resolved: false });
    }
    const result = marked.value.result;
    if (result.invalid === true) {
      await giveBack();
      // Not a verdict and nothing about the answer key: the entry could not be read.
      return res.status(200).json({ invalid: true, resolved: false, feedback: typeof result.feedback === 'string' ? result.feedback.slice(0, 300) : null });
    }
    const correct = result.correct === true;
    const steps = !retrying && !correct ? guestSteps(q) : [];
    if (steps.length) {
      // A first wrong verdict on a question with worked steps: the answer stays closed, the first step is released, one retry is open.
      const claim = await consumeRateLimit(db, key.wrong, { limit: 1, windowMs: DAY }, now);
      if (!claim.allowed) return reject(res, 409, 'GUEST_ALREADY_ANSWERED', 'This question has already been answered.');
      await consumeRateLimit(db, key.steps, { limit: steps.length + 1, windowMs: DAY }, now);
      await db.run('INSERT INTO rate_limits(bucket, window_start, count) VALUES (?, ?, 3) ON CONFLICT(bucket) DO NOTHING', [replayName(1, trimmed), now]);
      const mine = await view(req.guest, now);
      return res.status(200).json({ resolved: false, correct: false, retry: true, ...stepBody(q, steps, 1), remaining: mine.remaining, limit: L.limit });
    }
    // A verdict that closes the question: claim it exactly once, then reveal the answer.
    const claim = await consumeRateLimit(db, key.done, { limit: 1, windowMs: DAY }, now);
    if (!claim.allowed) return reject(res, 409, 'GUEST_ALREADY_ANSWERED', 'This question has already been answered.');
    // One keyed bit (1 right, 2 wrong) under a name only this token and this entry can recompute, kept for the retry window only.
    await db.run('INSERT INTO rate_limits(bucket, window_start, count) VALUES (?, ?, ?) ON CONFLICT(bucket) DO NOTHING', [replayName(retrying ? 2 : 1, trimmed), now, correct ? 1 : 2]);
    const mine = await view(req.guest, now);
    return res.status(200).json({ resolved: true, correct, answer: answerTextFor(q), assisted: retrying && correct, moreForms: formCountOf(ticket.g) > 1, remaining: mine.remaining, limit: L.limit });
  }));

  // ── The worked steps, one request at a time ────────────────────────────────
  // Only for a question that has had a verdict (wrong, with its one retry still
  // open, or closed). Step k is released only after step k-1; the step after the
  // last is the answer, and releasing it, or any step that states it, closes the question (no retry after).
  // Asking again for a step already released re-reads it and costs nothing.
  router.post('/steps', stepsPerAddress, guestCsrf, asyncHandler(async (req, res) => {
    const body = req.body;
    if (!plain(body) || Object.keys(body).some(k => !['sealed', 'step'].includes(k)) || typeof body.sealed !== 'string' || body.sealed.length > 2000
      || !Number.isInteger(body.step) || body.step < 1 || body.step > MAX_STEPS + 1) {
      return reject(res, 400, 'GUEST_INVALID', 'Send the question and the step you are on.');
    }
    const opened = openTicket(req, res, body.sealed);
    if (!opened) return undefined;
    const { ticket, now } = opened;
    const key = names(ticket);
    const closed = await live(key.done, now);
    const firstWrong = await live(key.wrong, now);
    if (!closed && !firstWrong) return reject(res, 409, 'GUEST_NOT_ANSWERED', 'Answer the question first. The working follows your answer.');
    const q = await rebuild(ticket);
    if (!q) return reject(res, 422, 'GUEST_QUESTION_INVALID', 'This question is not valid.');
    const steps = guestSteps(q);
    if (!steps.length) return reject(res, 409, 'GUEST_NO_STEPS', 'There is no worked solution for this question here.');
    if (body.step > steps.length + 1) return reject(res, 409, 'GUEST_STEP_ORDER', 'That step is not next.');
    const row = await live(key.steps, now);
    const released = Number(row?.count) || 0;
    res.set('Cache-Control', 'no-store');
    if (body.step > released + 1) return reject(res, 409, 'GUEST_STEP_ORDER', 'Show the steps in order.');
    if (body.step === released + 1) {
      const took = await consumeRateLimit(db, key.steps, { limit: steps.length + 1, windowMs: DAY }, now);
      const count = steps.length + 1 - took.remaining;
      if (!took.allowed || count !== body.step) {
        if (took.allowed) await db.run('UPDATE rate_limits SET count = count - 1 WHERE bucket = ? AND count > 0', [key.steps]);
        return reject(res, 409, 'GUEST_STEP_ORDER', 'Show the steps in order.');
      }
    }
    if (body.step >= closingStepOf(q, steps)) {
      // The answer, or the step that states it: it closes the question (the claim is idempotent for one already closed).
      await consumeRateLimit(db, key.done, { limit: 1, windowMs: DAY }, now);
      const mine = await view(req.guest, now);
      return res.status(200).json({ resolved: true, answer: answerTextFor(q), ...stepBody(q, steps, body.step), remaining: mine.remaining, limit: L.limit });
    }
    return res.status(200).json({ resolved: !!closed, ...stepBody(q, steps, body.step) });
  }));

  return router;
}
