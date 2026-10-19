// Pri Learning — V1 authoritative online practice grading.
//
// No caller-supplied answer key, mark or question body is ever authoritative.
// The server regenerates and escrows its own canonical question, then commits
// a deterministic grade and its progress effect in one account-scoped
// transaction. A timeout after COMMIT is recovered with the same submission
// idempotency key, not a second attempt. No AI model decides correctness.
//
// Storage uses existing idempotency_keys and learning_events, requiring no
// unapproved production Postgres DDL. Old clients are not authorised to treat
// their offline grades as server grades. The client transport integration is
// a separate mandatory release gate.
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { asyncRouter, asyncHandler } from './asyncRouter.js';
import { asStore } from './store.js';
import { nextSyncCursor, syncLockKey } from './db.js';
import { requireSession, requireVerifiedEmail, requireRole, rateLimit, consumeRateLimit, sessionFromRequest, sha256 } from './security.js';
import { encryptDeliveryToken, decryptDeliveryToken } from './deliveryCrypto.js';
import { opaqueContentId, opaqueContentHash, contentSeen, markContentSeen, contentTried, markContentTried, seenAmong, seenKeysOf, triedKeyOf } from './contentSeen.js';
import { misconceptionIdForTrap, misconceptionIdForDiagnosis, misconceptionById } from '../../client/src/engine/misconceptions.js';
import { misconceptionLabel } from '../../client/src/engine/adaptive.js';
import { HINT_RUNGS, buildHintLadder, ladderAvailable, ladderEvidence, markWeightAfter, nextRungAfter, rungLevelOf } from '../../client/src/engine/hintLadder.js';
import { dueDotpoints, reviewStateFromAttempts } from '../../client/src/engine/reviewQueue.js';
import { PUBLIC_QUESTION_FIELDS } from '../../client/src/engine/publicQuestion.js';
import { consentState, consentBlockerCode } from './guardianConsent.js';
import { loadAllBanks, generateQuestion } from '../../client/src/engine/generators/index.js';
// The marker itself (checkAnswer, stepCheck, methodMarks) is never called on
// this thread: markerOps.js holds the operations and markerPool.js runs them in
// worker threads under a hard deadline. Only the two pure rubric helpers
// below, which read the server's own question and run no student text through
// the engine, are used directly here.
import { stepMetaFor, marksPossibleFor } from './markerOps.js';
import { markRowsFor } from './markRows.js';
import {
  markerPool, markerCooldownUntil, recordMarkerKills, sendMarkerCooldown, sendMarkerBusy,
  MARKING_TOO_COMPLEX, MARKING_BUSY, TOO_COMPLEX_MESSAGE, WORKING_NOT_READ_NOTE
} from './markerPool.js';
import { authoredRegion, formatRegion, formatMatrix, formatVector, formatComplex } from '../../client/src/engine/answer-forms.js';
import { transcribeHandwriting, validateImage, HandwritingProviderError } from './handwritingProvider.js';
import { recognitionOpsFor, sendRecognitionRefusal } from './recognitionOps.js';
// The free plan's daily cap is decided here, per account, where a creditable
// question is issued (#537): practiceAllowance.js reads the server's own
// entitlement record and its own count, inside the issue transaction.
import { practiceAllowanceVerdict, practiceModeCounted, recordPracticeIssue, refusePracticeCap } from './practiceAllowance.js';
import { timePhase } from './requestTiming.js';
import { verifyReadReceipt } from './readReceipt.js';

const MAX_AGE = 90 * 24 * 60 * 60 * 1000;
const ID = /^[a-zA-Z0-9_-]{8,100}$/;
const UUID = /^[0-9a-f-]{36}$/i;
// Every authored generator the client can serve is issuable: with online-only
// grading a question the server refuses to issue could never be checked. The
// name is only a lookup key; an unknown one fails generation with 422.
const AUTHORED_BANK = /^[a-z][a-z0-9]{0,11}-[a-z0-9][a-z0-9-]{1,95}$/;
const ISSUE_FIELDS = new Set(['generator', 'difficulty', 'seed', 'curriculum', 'mode', 'prepared', 'avoid', 'trap', 'dotpoint', 'written', 'account']);
const PREPARE_FIELDS = new Set(['generator', 'difficulty', 'curriculum', 'mode', 'avoid', 'dotpoint']);
const PRACTICE_MODES = ['practice', 'review', 'task', 'rush', 'match', 'placement'];
// One answer settles the question in these modes.
const ONE_TRY_MODES = ['rush', 'match', 'placement'];
// The placement check is diagnostic evidence, not practice: its verdicts are
// the server's, but it writes no attempt, so it can never count as progress.
const recordsProgress = q => q._practiceMode !== 'placement';
// A prepared question is shown to a student who has not signed in yet. Its
// seed travels only inside an encrypted, expiring token that one account can
// bind once; the device never learns the seed and so cannot compute the answer
// from the bundled generators any faster than by solving the question.
const PREPARED_TTL = 12 * 60 * 60 * 1000;
const PREPARED_CONTEXT = 'practice-prepared-v1';
// How many questions the server draws before it gives up on a fresh one. It
// used to be a flat twelve whatever was being avoided, so on a cell whose pool
// is small the picker gave up on a fresh item it could still have found and
// the student was handed a repeat (issue #540). The server does not know the
// pool; it knows how many items, k, it is avoiding — and while a fresh item
// exists at all, the pool holds at least k + 1. When a generator draws its
// items about evenly, every draw therefore finds a fresh one with chance at
// least 1 / (k + 1), and fourteen draws per such chance (≈ ln 10^6) miss a
// surviving fresh item below once in a million for any pool size — the last
// of twelve as surely as the eleventh of thirty. An item a generator reaches
// from few seeds can still be missed more often; the student is then served a
// repeat flagged as one, never one passed off as new. The budget is spent
// only when the cell is nearly exhausted: a draw that is fresh ends the seek.
// Capped at 300 draws (the shipped client's 20-item window, k ≤ 20, stays
// below the cap at 294). A draw costs ~0.025 ms on the median cell; measured
// on a development machine, a request that spends the whole cap costs ≈20 ms
// on the slowest India cells (c12-applications-integrals, ~0.06 ms a draw)
// and up to ≈50–60 ms on the slowest cell a client's 60-hash avoid list can
// exhaust (y9-algebra at D4, ~0.16 ms a draw), against at most 12 draws
// before. The practice-issue and practice-prepare rate limits bound how often
// one account can make the server spend it. A pool genuinely smaller than the
// window is served a flagged repeat, as before.
const SEEK_TRIES = 12;                   // the floor: a trap or a written form is sought at least this far
const SEEK_TRIES_PER_FRESH_CHANCE = 14;  // ≈ ln(10^6)
const SEEK_TRIES_CAP = 300;
export const seekBudget = avoided => Math.min(SEEK_TRIES_CAP, Math.max(SEEK_TRIES, SEEK_TRIES_PER_FRESH_CHANCE * (Math.max(0, avoided | 0) + 1)));
const CONTENT_HASH = /^[a-zA-Z0-9:_-]{6,96}$/;
const DOTPOINT = /^[a-zA-Z0-9._:-]{1,80}$/;
// A caller-chosen seed makes a question predictable, so the product never
// sends one: the server picks it. Fixed seeds exist only for the test suites,
// which need the same question twice; they are honoured in NODE_ENV=test and
// nowhere else, and a suite can switch them off to exercise the real contract.
const fixedSeedsAllowed = env => env.NODE_ENV === 'test' && env.PRI_PRACTICE_SERVER_SEEDS_ONLY !== '1';
const GRADE_FIELDS = new Set(['submissionId', 'answer', 'mode', 'steps', 'transcriptionReceipt', 'ms', 'image']);
// One reading per request to /recognize, and per submission that carries its
// own picture: the two share this bucket, so the one-request Submit cannot be
// used to read more pictures an hour than the receipt route allows.
const RECOGNIZE_LIMIT = Object.freeze({ limit: 120, windowMs: 60 * 60 * 1000 });
const RECOGNITION_FIELDS = new Set(['image', 'mode', 'receipt', 'text']);
const CORRECTION_FIELDS = new Set(['text']);
const PUBLIC_Q = PUBLIC_QUESTION_FIELDS;

const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const reject = (res, status, code, message) => res.status(status).json({ error: { code, message } });
const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
const unknown = (value, allowed) => Object.keys(value).filter(key => !allowed.has(key));
const limitedText = (s, n) => typeof s === 'string' && s.length <= n && !/[\u0000-\u0008\u000b\u000e-\u001f]/.test(s);
let banksReady;
const ensureBanks = () => { if (!banksReady) banksReady = loadAllBanks().catch(e => { banksReady = null; throw e; }); return banksReady; };

// ── What an open question may be told about its working ─────────────────────
// A practice question allows two tries. Until it resolves, the reply to a
// wrong try carries NOTHING derived from the answer key about the working:
// no step report, no first mistake, no diagnosis, no per-line marks, no method
// marks, and no feedback that depends on the lines. Any verdict on any line is
// a test of a candidate answer — `2t = 6` is right exactly when t is 3, and a
// ladder of `abs(t - c) = t - c` lines breaks one line after the answer — so
// no choice of which lines to judge is safe, and none is judged. The working
// is not even checked: it is checked, and its method marks are paid, by the
// reply that resolves the question (a correct answer or the second try).
// Nothing is lost by waiting; an unresolved try commits no mark.
const OPEN_WORKING = 'Your working is checked when this question is finished.';
const OPEN_FEEDBACK = {
  workingOnly: `There is no final answer here. ${OPEN_WORKING}`,
  working: OPEN_WORKING
};

// Working arrives as one text or as lines. Either way it is at most this many
// characters in all: the lines are checked inside the account's transaction,
// and an array of 100 lines of 1000 characters was 92 KB of polynomial to
// expand while every other request waited.
const MAX_WORKING_CHARS = 8000;
const MAX_WORKING_LINES = 100;
const MAX_WORKING_LINE_CHARS = 1000;
function acceptableWorking(steps) {
  if (steps === undefined || steps === null) return true;
  if (typeof steps === 'string') return limitedText(steps, MAX_WORKING_CHARS);
  if (!Array.isArray(steps) || steps.length > MAX_WORKING_LINES) return false;
  let total = Math.max(0, steps.length - 1);          // the line breaks that join them
  for (const line of steps) {
    if (!limitedText(line, MAX_WORKING_LINE_CHARS)) return false;
    total += line.length;
    if (total > MAX_WORKING_CHARS) return false;
  }
  return true;
}

// What a device may know a question by (`opaqueContentId`, `opaqueContentHash`)
// and what an account has already been shown the solution of or spent a try on
// (`contentSeen`, `contentTried`) have ONE definition, in contentSeen.js, shared
// with the examination router. A later copy of the same content — however it
// comes to be issued, and whatever order its options are dealt in — is a
// repeat once its solution has been shown: it is marked like any question, and
// its receipt and attempt say it is not new work.
//
// Tries follow the content too. A question allows two tries; were they counted
// per issued copy alone, each fresh copy of one question would be a free,
// unrecorded guess with feedback. So a try spent on any copy is spent on every
// copy of that content the account holds or is later issued, until the content
// resolves. `triesLeft: 1` on an issue response says so, so the card is honest
// about the copy it shows; a copy with both tries in hand says nothing.

function safeQuestion(id, q) {
  const publicQ = { id, supportsSteps: !!stepMetaFor(q),
    criteriaCount: marksPossibleFor(q) };
  for (const k of PUBLIC_Q) if (Object.hasOwn(q, k)) publicQ[k] = q[k];
  if ('contentId' in publicQ) publicQ.contentId = opaqueContentId(q.contentId);
  if ('contentHash' in publicQ) publicQ.contentHash = opaqueContentHash(q.contentHash);
  return publicQ;
}

// Release only after the server has committed a final resolution. This must
// never be present on an unresolved or newly issued public question.
function answerTextFor(q) {
  const a = q.answer || {};
  switch (q.answerType) {
    case 'mcq': return q.mcqOptions?.[a.correctIndex] ?? '';
    case 'numeric':
      if (a.canonicalInput) return a.canonicalInput;
      if (a.simplestFraction) return a.simplestFraction.n + '/' + a.simplestFraction.d;
      if (a.surdForm) return (a.surdForm.k === 1 ? '' : a.surdForm.k) + '√' + a.surdForm.r;
      return (q.answerPrefix ? q.answerPrefix + ' ' : '') + a.value + (q.answerSuffix ? ' ' + q.answerSuffix : '');
    case 'expression': return a.expr || '';
    case 'set': return Array.isArray(a.values) ? a.values.join(', ') : '';
    case 'point': return '(' + a.x + ', ' + a.y + ')';
    case 'ratio': return a.a + ' : ' + a.b;
    case 'working': return a.canonicalWorking || '';
    case 'interval': {
      const region = authoredRegion(a);
      return region ? formatRegion(region, a.variable || 'x') : (a.region || '');
    }
    case 'matrix': return Array.isArray(a.rows) ? formatMatrix(a.rows) : '';
    case 'vector': return Array.isArray(a.components) ? formatVector(a.components) : '';
    case 'complex': return Number.isFinite(Number(a.re)) && Number.isFinite(Number(a.im)) ? formatComplex({ re: Number(a.re), im: Number(a.im) }) : '';
    default: return '';
  }
}

function solutionFor(q) {
  const steps = q.steps || [];
  const marks = marksPossibleFor(q);
  const keySteps = steps.filter(s => !/^(check|note|bonus)/i.test(s.h)).slice(0, marks);
  const criteria = keySteps.length
    ? keySteps.map((step, i) => ({ mark: 1, text: i === keySteps.length - 1
      ? step.h + ' — leading to the correct answer' : step.h }))
    : [{ mark: 1, text: 'Correct final answer' }];
  return { steps, answerText: answerTextFor(q), criteria, solutionText: q.solutionText };
}

/**
 * Server-side tutor grounding for one issued question (server/platform/tutor.js).
 *
 * The escrowed question is read for THIS account only: another account's
 * question id is indistinguishable from an id that never existed (null). What
 * comes back never leaves the server — it is the material the tutor guard
 * checks a model's reply against, not a response body. `workEvidence` runs the
 * deterministic Step Check on the student's own lines, so the device's word
 * about which lines are verified is never trusted for an issued question.
 */
export async function issuedQuestionForTutor(db, accountId, questionId, now = Date.now()) {
  db = asStore(db);
  if (typeof questionId !== 'string' || !UUID.test(questionId)) return null;
  const sealed = await db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-question' AND key=? AND expires_at>?",
    [accountId, questionId, now]);
  if (!sealed) return null;
  let q;
  try { q = JSON.parse(sealed.response_json); } catch { return null; }
  const completed = await db.get("SELECT key FROM idempotency_keys WHERE account_id=? AND scope='practice-completion' AND key=?",
    [accountId, questionId]);
  return {
    resolved: !!completed,
    mode: q._practiceMode || 'practice',
    version: String(q.contentVersion || q.version || 1),
    prompt: String(q.prompt || ''),
    steps: (q.steps || []).map(step => ({ h: String(step?.h ?? ''), d: String(step?.d ?? '') })),
    answerText: String(answerTextFor(q) ?? ''),
    hints: Array.isArray(q.hints) ? q.hints.filter(h => typeof h === 'string') : [],
    // Runs in the marker pool, never on this thread. A Step Check that is cut
    // off at its deadline, refused because the pool is busy, or skipped
    // because the account is cooling down says nothing: no line is verified
    // and no line is the first mistake — "the checker's silence is not
    // evidence", exactly as when the engine threw.
    async workEvidence(lines) {
      const silent = { firstBreak: -1, verifiedLines: 0, misconception: null };
      if (!stepMetaFor(q) || !Array.isArray(lines) || !lines.length) return silent;
      if (await markerCooldownUntil(db, accountId)) return silent;
      let outcome;
      try { outcome = await markerPool().run('tutor', { q, lines }, { key: accountId }); } catch { return silent; }
      if (outcome.ok) return outcome.value.evidence;
      if (outcome.code === MARKING_TOO_COMPLEX) await recordMarkerKills(db, accountId);
      return silent;
    }
  };
}

// ── Authority where a mark commits ──────────────────────────────────────────
// Marking is awaited on another thread, between the request's own session
// check and the transaction that commits the mark. During that wait a student
// may sign out, a session may expire or be revoked, or a guardian may withdraw
// consent. The practice submission and the examination finish both read the
// consent state before marking (`consentBlockedNow`) and call
// `authorityAtCommit` first thing INSIDE the committing transaction: no live
// session of this account → 401; consent that was in place and is now blocked
// → 403. Either way nothing is written. (Consent that was already blocked
// before marking is not newly enforced here: these routes did not refuse on
// it before marking moved off the request thread, and still do not.)
export async function consentBlockedNow(db, accountId) {
  return consentBlockerCode(await consentState(asStore(db), accountId));
}
export async function authorityAtCommit(db, req, accountId, consentBlockedBefore) {
  db = asStore(db);
  const liveSession = await sessionFromRequest(db, req);
  if (!liveSession || liveSession.account_id !== accountId) {
    return { status: 401, code: 'AUTH_REQUIRED', message: 'Sign in again before retrying.' };
  }
  if (consentBlockedBefore) return null;
  // A concurrent PostgreSQL guardian withdrawal updates this exact row. It is
  // locked by the final consent check itself (consentState `lock`), so the
  // withdrawal cannot commit between validation and the mark. SQLite
  // transactions already serialize writers.
  const blocker = consentBlockerCode(await consentState(db, accountId, { lock: true }));
  return blocker ? { status: 403, code: blocker, message: 'Guardian consent changed while this was being checked.' } : null;
}

/**
 * Several of this account's own records, in ONE statement.
 *
 * Every decision on these routes starts by reading a handful of rows of
 * idempotency_keys for one account — the sealed question, its completion, a
 * reading receipt, an earlier reply, the tries. They were read one statement at
 * a time, each a trip to the database; the same rows are now named in one
 * WHERE. Each `want` is { scope, key, live }: `live` adds the expiry test that
 * record's own lookup always had (a completion and a try count never had one,
 * exactly as before). Every clause is under `account_id = ?`, so no key can
 * ever name another account's row. Returns a Map by scope; the scopes of one
 * call are distinct.
 */
async function recordsOf(db, accountId, now, wants) {
  const clauses = wants.map(want => (want.live ? '(scope=? AND key=? AND expires_at>?)' : '(scope=? AND key=?)'));
  // Only fixed clauses and `?` placeholders are joined into the statement; every value is bound.
  const rows = await db.all('SELECT scope,response_json,request_digest FROM idempotency_keys WHERE account_id=? AND (' + clauses.join(' OR ') + ')',
    [accountId, ...wants.flatMap(want => (want.live ? [want.scope, want.key, now] : [want.scope, want.key]))]);
  return new Map(rows.map(row => [row.scope, row]));
}

const carriesTrap = (owner, q, key) => (Array.isArray(q?.traps) ? q.traps : [])
  .concat(Object.values(q?.answer?.optionTraps || {}).map(why => ({ why })))
  .some(t => t && misconceptionIdForTrap(owner, t.why) === key);

/** Validate what a client may ask for. Returns { error } or the cleaned request. */
function readQuestionRequest(body, fields) {
  if (!plain(body) || unknown(body, fields).length) {
    return { error: [400, 'PRACTICE_ISSUE_INVALID', 'Only an authored generator, difficulty and practice mode may be requested.'] };
  }
  const generator = typeof body.generator === 'string' ? body.generator : '';
  const difficulty = typeof body.difficulty === 'number' || typeof body.difficulty === 'string' ? Number(body.difficulty) : NaN;
  if (body.curriculum !== 'in' || !AUTHORED_BANK.test(generator) || !Number.isInteger(difficulty) || difficulty < 1 || difficulty > 4) {
    return { error: [400, 'PRACTICE_GENERATOR_INVALID', 'Choose an authored question and difficulty 1–4.'] };
  }
  const mode = body.mode ?? 'practice';
  if (!PRACTICE_MODES.includes(mode)) return { error: [400, 'PRACTICE_MODE_INVALID', 'Invalid practice mode.'] };
  const avoid = body.avoid === undefined ? [] : body.avoid;
  if (!Array.isArray(avoid) || avoid.length > 60 || !avoid.every(h => typeof h === 'string' && CONTENT_HASH.test(h))) {
    return { error: [400, 'PRACTICE_ISSUE_INVALID', 'Invalid recently-seen list.'] };
  }
  if (body.dotpoint !== undefined && (typeof body.dotpoint !== 'string' || !DOTPOINT.test(body.dotpoint))) {
    return { error: [400, 'PRACTICE_ISSUE_INVALID', 'Invalid dot point.'] };
  }
  let trap = null;
  if (body.trap !== undefined) {
    const t = body.trap;
    if (!plain(t) || unknown(t, new Set(['owner', 'key'])).length || !limitedText(t.owner, 120) || !limitedText(t.key, 200) || !t.owner || !t.key) {
      return { error: [400, 'PRACTICE_ISSUE_INVALID', 'Invalid misconception target.'] };
    }
    trap = { owner: t.owner, key: t.key };
  }
  if (body.written !== undefined && typeof body.written !== 'boolean') {
    return { error: [400, 'PRACTICE_ISSUE_INVALID', 'Invalid answer-form preference.'] };
  }
  return { generator, difficulty, mode, avoid: new Set(avoid), dotpoint: body.dotpoint, trap, written: body.written === true };
}

/**
 * The server picks the question: a fresh random seed, re-drawn (seekBudget)
 * to avoid content the student has just seen and, when a misconception is
 * being worked on, to find a form that can spring it. `seed` is given only by
 * the test suites. `draw` is where each seed comes from — crypto.randomInt in
 * the product; a test may hand in a seeded one. Throws when the generator has
 * no such form.
 */
function chooseQuestion({ generator, difficulty, dotpoint, avoid, trap, written = false }, seed = null,
  { draw = () => randomInt(0x80000000), tries = seekBudget(avoid?.size || 0) } = {}) {
  if (seed !== null) {
    const q = generateQuestion(generator, difficulty, seed, dotpoint);
    return { q, repeat: false, trapDelivered: !!(trap && carriesTrap(trap.owner, q, trap.key)) };
  }
  let fallback = null;
  for (let i = 0; i < tries; i++) {
    const q = generateQuestion(generator, difficulty, draw(), dotpoint);
    const fresh = !avoid.has(opaqueContentHash(q.contentHash));
    // `written` asks for a form the student writes out; a multiple-choice
    // item can be guessed, which a diagnostic must avoid where it can.
    const springs = (!trap || carriesTrap(trap.owner, q, trap.key)) && (!written || (q.answerType !== 'mcq' && !q.multipart));
    if (fresh && springs) return { q, repeat: false, trapDelivered: !!trap };
    if (!fallback || (fresh && !fallback.fresh)) fallback = { q, fresh };
  }
  return { q: fallback.q, repeat: !fallback.fresh, trapDelivered: !!(trap && carriesTrap(trap.owner, fallback.q, trap.key)) };
}

/**
 * Signed-out preparation. No account, no escrow row: the question a student
 * may start working on before signing in, and the sealed token that lets one
 * account turn it into an issued question later.
 */
export function createPracticePrepareRoute(db) {
  db = asStore(db);
  return [rateLimit(db, 'practice-prepare', { limit: 90, windowMs: 60 * 60 * 1000 }), asyncHandler(async (req, res) => {
    const request = readQuestionRequest(req.body, PREPARE_FIELDS);
    if (request.error) return reject(res, ...request.error);
    await ensureBanks();
    let chosen;
    try { chosen = chooseQuestion(request); }
    catch { return reject(res, 422, 'PRACTICE_CONTENT_UNSUPPORTED', 'The requested question form is unavailable.'); }
    const now = Date.now();
    let prepared;
    try {
      prepared = encryptDeliveryToken(JSON.stringify({
        g: request.generator, d: request.difficulty, s: chosen.q.seed, m: request.mode,
        ...(request.dotpoint ? { p: request.dotpoint } : {}), x: now + PREPARED_TTL, n: randomUUID()
      }), PREPARED_CONTEXT);
    } catch { return reject(res, 503, 'PRACTICE_PREPARE_UNAVAILABLE', 'Questions cannot be prepared right now.'); }
    const question = safeQuestion(null, chosen.q);
    delete question.id;
    res.set('Cache-Control', 'no-store');
    return res.status(200).json({ question, prepared, expiresAt: now + PREPARED_TTL, repeat: chosen.repeat });
  })];
}

function readPrepared(token) {
  if (typeof token !== 'string' || token.length > 2000) return null;
  try {
    const v = JSON.parse(decryptDeliveryToken(token, PREPARED_CONTEXT));
    if (!plain(v) || !AUTHORED_BANK.test(String(v.g)) || !Number.isInteger(v.d) || !Number.isSafeInteger(v.s) ||
        !PRACTICE_MODES.includes(v.m) || !Number.isFinite(v.x) || typeof v.n !== 'string' || !UUID.test(v.n)) return null;
    return v;
  } catch { return null; }
}

export function createPracticeRouter(db, { transcribe = transcribeHandwriting, env = process.env } = {}) {
  db = asStore(db);
  // Start the marker workers now, so the first submission does not wait for
  // them to import the engine.
  markerPool();
  const router = asyncRouter();
  router.use(requireSession(db), requireVerifiedEmail, requireRole('student'));

  router.post('/issue', rateLimit(db, 'practice-issue', { limit: 200, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const body = req.body;
    const accountId = req.platformSession.account_id;
    const now = Date.now();
    // A device holding several profiles names the account it means. A session
    // that belongs to another one is refused before anything is issued,
    // bound or escrowed, so one student's question can never land in, or use
    // up a prepared question for, another's account.
    // The account is named by its id as a string, exactly as the server gave
    // it; anything else (an array or number that merely prints the same) is
    // not that name.
    if (plain(body) && body.account !== undefined && (typeof body.account !== 'string' || body.account !== String(accountId))) {
      return reject(res, 409, 'PRACTICE_ACCOUNT_MISMATCH', 'This device is signed in to a different account.');
    }
    // A prepared question is bound once. The request that binds it must say
    // whose it is, so a shared device cannot spend it under the wrong account.
    if (plain(body) && body.prepared !== undefined && body.account === undefined) {
      return reject(res, 400, 'PRACTICE_ISSUE_INVALID', 'A prepared question names the account it is for.');
    }
    await ensureBanks();
    let q, practiceMode, repeat = false, trapDelivered = false, preparedNonce = null, preparedExpiry = 0, seedGiven = false;
    if (plain(body) && body.prepared !== undefined) {
      // Binding a question the student started signed out. Nothing else in the
      // body is honoured: the sealed token is the whole request.
      if (unknown(body, new Set(['prepared', 'account'])).length) {
        return reject(res, 400, 'PRACTICE_ISSUE_INVALID', 'A prepared question is bound on its own.');
      }
      const sealed = readPrepared(body.prepared);
      if (!sealed) return reject(res, 400, 'PRACTICE_PREPARED_INVALID', 'This prepared question is not valid.');
      if (sealed.x < now) return reject(res, 410, 'PRACTICE_PREPARED_EXPIRED', 'This prepared question has expired.');
      try { q = generateQuestion(sealed.g, sealed.d, sealed.s, sealed.p); }
      catch { return reject(res, 422, 'PRACTICE_CONTENT_UNSUPPORTED', 'The requested question form is unavailable.'); }
      practiceMode = sealed.m;
      q._generator = sealed.g;
      preparedNonce = sealed.n;
      preparedExpiry = sealed.x;
    } else {
      const request = readQuestionRequest(body, ISSUE_FIELDS);
      if (request.error) return reject(res, ...request.error);
      let seed = null;
      if (body.seed !== undefined) {
        if (!fixedSeedsAllowed(env)) return reject(res, 400, 'PRACTICE_SEED_NOT_ALLOWED', 'The server chooses the question.');
        seed = typeof body.seed === 'number' || typeof body.seed === 'string' ? Number(body.seed) : NaN;
        if (!Number.isSafeInteger(seed) || seed < 0 || seed >= 0x80000000) {
          return reject(res, 400, 'PRACTICE_SEED_INVALID', 'Invalid question seed.');
        }
        seedGiven = true;
      }
      try { ({ q, repeat, trapDelivered } = chooseQuestion(request, seed)); }
      catch { return reject(res, 422, 'PRACTICE_CONTENT_UNSUPPORTED', 'The requested question form is unavailable.'); }
      practiceMode = request.mode;
      q._generator = request.generator;
    }
    // Optional issue idempotency: normal practice may request a fresh question;
    // network retries can opt into the same server question with a stable key.
    const idem = String(req.get('idempotency-key') || '');
    if (idem && !ID.test(idem)) return reject(res, 400, 'IDEMPOTENCY_INVALID', 'Invalid issuance idempotency key.');
    const requestDigest = digest({ generator: q.subtopic, difficulty: q.difficulty, seed: seedGiven ? q.seed : null, prepared: preparedNonce, curriculum: 'in', mode: practiceMode });
    // The issuance mode is escrowed with the answer. A later submission cannot
    // falsely claim or downgrade the one-try Rush/Match policy.
    q._practiceMode = practiceMode;
    // Sealed with the question, so the receipt and the attempt carry it
    // whatever the device does or does not send.
    // (Seen and tried are records of one scope: one statement answers both.)
    const seenKeys = seenKeysOf(q);
    const triedKey = triedKeyOf(q);
    const known = await seenAmong(db, accountId, [...seenKeys, triedKey], now);
    if (seenKeys.some(key => known.has(key))) { q._repeat = true; repeat = true; }
    // A try already spent on another copy of this content is spent on this one
    // (decided again, authoritatively, when it is marked). Content that has
    // resolved is a repeat and starts over with both tries: it earns nothing.
    const trySpent = !repeat && !ONE_TRY_MODES.includes(practiceMode) && known.has(triedKey);
    // Serialize once: nothing client-provided can replace the stored answer.
    const payload = JSON.stringify(q);
    const id = randomUUID();
    const publicResponse = { question: safeQuestion(id, q), ...(repeat ? { repeat: true } : {}), ...(trySpent ? { triesLeft: 1 } : {}), ...(trapDelivered ? { trapDelivered: true } : {}) };
    // The free plan's daily cap counts the Practice surface's own modes; Rush,
    // Match and the placement check are "everything else", unlimited.
    const counted = practiceModeCounted(practiceMode);
    const response = await db.transaction(async () => {
      // Replays come first: a question already issued is handed back whatever
      // today's count says. Then the account's standing against the free daily
      // cap (#537), read under the same lock that serialises its issues, so two
      // devices on one account cannot both be the twentieth question — and
      // before anything is written, so a capped bind never burns a prepared
      // token and a capped issue escrows nothing.
      if (preparedNonce) {
        // One account, once — decided in the same transaction as the issue it
        // allows, so a failed issue never burns the token and a retry by the
        // same account (a lost reply, a double tap) gets the same issue back.
        const mine = await db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-prepared' AND key=? AND expires_at>?",
          [accountId, preparedNonce, now]);
        if (mine) return JSON.parse(mine.response_json);
      }
      if (idem) {
        const before = await db.get("SELECT response_json,request_digest FROM idempotency_keys WHERE account_id=? AND scope='practice-issue' AND key=? AND expires_at>?", [accountId, idem, now]);
        if (before) {
          if (before.request_digest !== requestDigest) return { conflict: true };
          return JSON.parse(before.response_json);
        }
      }
      if (counted) {
        const allowance = await practiceAllowanceVerdict(db, { accountId, now, env });
        if (!allowance.allowed) return { capped: allowance };
      }
      if (preparedNonce) {
        const claim = await db.run("INSERT INTO rate_limits(bucket, window_start, count) VALUES (?, ?, 1) ON CONFLICT(bucket) DO NOTHING",
          ['practice-prepared-claim:' + preparedNonce, now]);
        if (!claim?.changes) return { preparedUsed: true };
      }
      await db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,'practice-question',?,?,?,?,?)",
        [accountId, id, payload, digest(payload), now, now + MAX_AGE]);
      if (idem) await db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,'practice-issue',?,?,?,?,?)",
        [accountId, idem, JSON.stringify(publicResponse), requestDigest, now, now + MAX_AGE]);
      if (preparedNonce) await db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,'practice-prepared',?,?,?,?,?)",
        [accountId, preparedNonce, JSON.stringify(publicResponse), requestDigest, now, Math.max(preparedExpiry, now) + PREPARED_TTL]);
      // Counted only now: this question was really issued, in this transaction.
      if (counted) await recordPracticeIssue(db, { accountId, now });
      return publicResponse;
    }, { accountScope: accountId, lock: 'practice-issue:' + accountId });
    if (response.conflict) return reject(res, 409, 'IDEMPOTENCY_KEY_REUSED', 'This key already issued a different question.');
    if (response.preparedUsed) return reject(res, 409, 'PRACTICE_PREPARED_USED', 'This prepared question has already been taken up.');
    if (response.capped) return refusePracticeCap(res, response.capped, now);
    // The account that owns this issue, so a device holding several profiles
    // can refuse a question issued under another profile's session.
    return res.status(201).json({ ...response, accountId: String(accountId) });
  });

  // "The same question again" from History. The account has already been shown
  // this question's solution, so the copy is marked as a repeat: it is checked
  // by the server like any other, and its attempt is recorded as a repeat so
  // it can never be counted as new credit.
  router.post('/:id/repeat', rateLimit(db, 'practice-repeat', { limit: 120, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const qid = req.params.id;
    if (!UUID.test(qid)) return reject(res, 404, 'QUESTION_NOT_FOUND', 'This question does not belong to this account.');
    if (req.body !== undefined && (!plain(req.body) || Object.keys(req.body).length)) {
      return reject(res, 400, 'PRACTICE_ISSUE_INVALID', 'A repeat takes no parameters.');
    }
    const accountId = req.platformSession.account_id;
    const now = Date.now();
    const sealed = await db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-question' AND key=? AND expires_at>?", [accountId, qid, now]);
    if (!sealed) return reject(res, 404, 'QUESTION_NOT_FOUND', 'This question does not belong to this account.');
    const done = await db.get("SELECT key FROM idempotency_keys WHERE account_id=? AND scope='practice-completion' AND key=?", [accountId, qid]);
    if (!done) return reject(res, 409, 'QUESTION_NOT_RESOLVED', 'Finish this question before repeating it.');
    const q = JSON.parse(sealed.response_json);
    q._practiceMode = 'practice';
    q._repeat = true;
    const payload = JSON.stringify(q);
    const id = randomUUID();
    // A repeat is a practice question the account is issued, so it counts
    // toward the free day exactly as a retry from History does on the device
    // (#537) — decided and counted under the account's issue lock.
    const outcome = await db.transaction(async () => {
      const allowance = await practiceAllowanceVerdict(db, { accountId, now, env });
      if (!allowance.allowed) return { capped: allowance };
      await db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,'practice-question',?,?,?,?,?)",
        [accountId, id, payload, digest(payload), now, now + MAX_AGE]);
      await recordPracticeIssue(db, { accountId, now });
      return {};
    }, { accountScope: accountId, lock: 'practice-issue:' + accountId });
    if (outcome.capped) return refusePracticeCap(res, outcome.capped, now);
    return res.status(201).json({ question: safeQuestion(id, q), repeat: true, accountId: String(accountId) });
  });

  // Recognition is issued by this server only after a live provider response.
  // We send image data alone to the reader: no question, solution or answer key.
  // The token is an opaque reference to a per-account, per-question DB record.
  router.post('/:id/recognize', rateLimit(db, 'practice-recognize', RECOGNIZE_LIMIT), async (req, res) => {
    const qid = String(req.params.id || '');
    const body = req.body;
    if (!UUID.test(qid) || !plain(body) || unknown(body, RECOGNITION_FIELDS).length ||
        !['ink', 'photo'].includes(body.mode) || typeof body.image !== 'string' ||
        (body.receipt !== undefined && typeof body.receipt !== 'string') || (body.text !== undefined && !limitedText(body.text, 12000))) {
      return reject(res, 400, 'RECOGNITION_INVALID', 'Send only an ink/photo image and its input mode.');
    }
    const accountId = req.platformSession.account_id;
    const now = Date.now();
    const held = await recordsOf(db, accountId, now, [
      { scope: 'practice-question', key: qid, live: true }, { scope: 'practice-completion', key: qid }]);
    if (!held.get('practice-question')) return reject(res, 404, 'QUESTION_NOT_FOUND', 'This question does not belong to this account.');
    if (held.get('practice-completion')) return reject(res, 409, 'QUESTION_ALREADY_GRADED', 'This question has been completed.');
    try { validateImage(body.image); }
    catch (error) { return reject(res, error.status || 400, error.code || 'RECOGNITION_IMAGE_INVALID', error.message || 'Invalid image.'); }

    // One paid read per picture (recognitionOps.js). A transcript this account
    // already paid for through /handwriting/transcribe — or a read of the same
    // picture still in flight — is reused, so showing the transcript and
    // minting this receipt cost one provider call. Only the read is shared:
    // every authority check above and at commitment below still runs here.
    let result;
    let reused = false;
    try {
      // Submit is not a request to read. This route never starts a provider
      // call: it binds the transcript the student was already shown (the kept
      // read, or one still in flight). When that read is gone the answer is a
      // named, retryable refusal and the student presses Read again.
      const read = await recognitionOpsFor(db).read({ db, accountId, image: body.image, env, transcribe, requestId: req.requestId, paid: false });
      if (read.missing) {
        // The 15-minute kept read is gone. The student was given a read
        // receipt when they had the page read (readReceipt.js): if it
        // verifies — this account, this question, this picture, this reader,
        // this text, recent enough — the read is proven and marking proceeds
        // on the text they were shown. Otherwise: read again. Never a call.
        const proven = verifyReadReceipt(body.receipt, { accountId, questionId: qid, image: body.image, text: body.text, env });
        if (!proven.ok) return reject(res, 409, 'RECOGNITION_READ_EXPIRED', 'This page needs to be read again before it can be submitted. Press Read again.');
        result = { text: body.text, lines: [], confidence: null, needsConfirmation: proven.needsConfirmation };
        reused = true;
      } else {
        if (read.refusal) return sendRecognitionRefusal(res, read.refusal);
        ({ result, reused } = read);
      }
    } catch (error) {
      if (error instanceof HandwritingProviderError) return reject(res, error.status, error.code, error.message);
      return reject(res, 502, 'RECOGNITION_FAILED', 'The answer could not be read this time.');
    }
    const text = String(result?.text || '');
    if (!text || !limitedText(text, 12000)) {
      return reject(res, 422, 'RECOGNITION_EMPTY', 'No reliable answer transcription was returned.');
    }
    const receipt = randomUUID();
    const acknowledgedAt = Date.now();
    const evidence = { questionId: qid, mode: body.mode, text, recognizedAt: acknowledgedAt,
      providerNeedsConfirmation: result.needsConfirmation === true };
    const committed = await timePhase('commit', () => db.transaction(async () => {
      // The provider runs outside the transaction. During that wait a student
      // may sign out, a session may expire, or a guardian may withdraw consent.
      // The initial middleware gate is no longer sufficient authority to
      // persist new student evidence: recheck at the point of commitment.
      const liveSession = await sessionFromRequest(db, req);
      if (!liveSession || liveSession.account_id !== accountId) {
        return { status: 401, code: 'AUTH_REQUIRED' };
      }
      // A concurrent PostgreSQL guardian withdrawal updates this exact row.
      // The final consent check locks it (consentState `lock`), so it cannot
      // commit between validation and the recognition receipt. SQLite
      // transactions already serialize writers for this commit.
      const blocker = consentBlockerCode(await consentState(db, accountId, { lock: true }));
      if (blocker) return { status: 403, code: blocker };
      const stillOpen = await db.get("SELECT key FROM idempotency_keys WHERE account_id=? AND scope='practice-completion' AND key=?", [accountId, qid]);
      if (stillOpen) return { status: 409, code: 'QUESTION_ALREADY_GRADED' };
      await db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,'practice-recognition',?,?,?,?,?)",
        [accountId, receipt, JSON.stringify(evidence), digest(evidence), acknowledgedAt, acknowledgedAt + MAX_AGE]);
      return { status: 201 };
    }, { accountScope: accountId, lock: syncLockKey(accountId) }));
    if (committed.status !== 201) return reject(res, committed.status, committed.code,
      committed.status === 403 ? 'Guardian consent changed while this answer was being read.' :
      committed.status === 401 ? 'Sign in again before retrying recognition.' : 'This question has been completed.');
    return res.status(201).json({ receipt, questionId: qid, mode: body.mode, reused,
      transcription: { text, lines: result.lines || [], confidence: result.confidence ?? null,
        needsConfirmation: result.needsConfirmation === true } });
  });

  // A learner may correct a recognition error explicitly. A new server receipt
  // preserves the original provider evidence and records the human correction.
  router.post('/:id/recognition/:receipt/confirm', rateLimit(db, 'practice-correction', { limit: 200, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const qid = String(req.params.id || '');
    const sourceId = String(req.params.receipt || '');
    const body = req.body;
    if (!UUID.test(qid) || !UUID.test(sourceId) || !plain(body) ||
        unknown(body, CORRECTION_FIELDS).length || !limitedText(body.text, 12000) || !body.text.trim()) {
      return reject(res, 400, 'RECOGNITION_CORRECTION_INVALID', 'Provide corrected text for a valid server receipt.');
    }
    const accountId = req.platformSession.account_id;
    const now = Date.now();
    // A correction and a final mark must serialize under the same account
    // lock. Checking completion before the transaction leaves a race where a
    // correction can be written after the last grade commits.
    const outcome = await timePhase('commit', () => db.transaction(async () => {
      const held = await recordsOf(db, accountId, now, [
        { scope: 'practice-recognition', key: sourceId, live: true }, { scope: 'practice-completion', key: qid }]);
      const prior = held.get('practice-recognition');
      if (!prior) return { status: 404, code: 'RECOGNITION_RECEIPT_INVALID' };
      const original = JSON.parse(prior.response_json);
      if (original.questionId !== qid || !['ink', 'photo'].includes(original.mode)) {
        return { status: 404, code: 'RECOGNITION_RECEIPT_INVALID' };
      }
      if (held.get('practice-completion')) return { status: 409, code: 'QUESTION_ALREADY_GRADED' };
      const receipt = randomUUID();
      const proof = { questionId: qid, mode: original.mode, text: body.text,
        parentReceipt: sourceId, correctedByStudent: true, recognizedAt: now };
      await db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,'practice-recognition',?,?,?,?,?)",
        [accountId, receipt, JSON.stringify(proof), digest(proof), now, now + MAX_AGE]);
      return { receipt, mode: original.mode };
    }, { accountScope: accountId, lock: syncLockKey(accountId) }));
    if (outcome.status) return reject(res, outcome.status, outcome.code,
      outcome.status === 409 ? 'This question has been completed.' : 'The recognition receipt is not available for this question.');
    return res.status(201).json({ receipt: outcome.receipt, questionId: qid, mode: outcome.mode, corrected: true });
  });

  // ── Reveal, and the hint ladder's last rung ─────────────────────────────
  // Both end the question as REVEALED: resolved, not correct, no marks. Called
  // inside the account's transaction. A second call replays the first reply.
  async function commitReveal(accountId, qid, now, viaHint = false) {
    const prior = await db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-reveal' AND key=? AND expires_at>?", [accountId, qid, now]);
    if (prior) return { response: JSON.parse(prior.response_json) };
    const escrow = await db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-question' AND key=? AND expires_at>?", [accountId, qid, now]);
    if (!escrow) return { status: 404, code: 'QUESTION_NOT_FOUND' };
    const completed = await db.get("SELECT key FROM idempotency_keys WHERE account_id=? AND scope='practice-completion' AND key=?", [accountId, qid]);
    if (completed) return { status: 409, code: 'QUESTION_ALREADY_GRADED' };
    const q = JSON.parse(escrow.response_json);
    // Decided now, not only at issue: copies issued before the first of them
    // was resolved are repeats the moment its solution has been shown.
    if (await contentSeen(db, accountId, q, now)) q._repeat = true;
    await markContentSeen(db, accountId, q, now);
    const ladder = ladderEvidence(viaHint ? HINT_RUNGS.length : await hintLevelOf(accountId, qid));
    const attemptId = randomUUID();
    const response = { authoritative: true, revealed: true, resolved: true, correct: false,
      marksEarned: 0, marksPossible: marksPossibleFor(q), creditedMarks: 0,
      hintLevel: ladder.hintLevel, markWeight: 0,
      questionId: qid, attemptId, serverAcknowledgedAt: now, solution: solutionFor(q),
      ...(q._repeat === true ? { repeat: true } : {}) };
    const hash = digest({ qid, operation: 'reveal' });
    for (const [scope, value] of [['practice-reveal', response], ['practice-completion', { attemptId, revealed: true }]]) {
      await db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,?,?,?,?,?,?)",
        [accountId, scope, qid, JSON.stringify(value), hash, now, now + MAX_AGE]);
    }
    if (!recordsProgress(q)) return { response };
    const last = await db.get("SELECT MAX(device_seq) AS n FROM learning_events WHERE account_id=? AND device_id='server-grader'", [accountId]);
    const cursor = await nextSyncCursor(db, accountId);
    await db.run("INSERT INTO learning_events(server_cursor,id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at) VALUES (?,?,?, 'server-grader',?,'graded-attempt',?,?,?,?)",
      [cursor, attemptId, accountId, Number(last?.n || 0) + 1, qid, now, JSON.stringify({ attemptId, questionId: qid, correct: false,
        revealed: true, marksEarned: 0, marksPossible: response.marksPossible,
        ...(q._repeat === true ? { repeat: true } : {}),
        contentId: opaqueContentId(q.contentId),
        subtopic: q.subtopic || null, difficulty: Number(q.difficulty) || 2,
        dotpoint: typeof q.dotpoint === 'string' ? q.dotpoint : null,
        mode: q._practiceMode || 'practice', hintsUsed: Math.max(1, ladder.hintHelpUnits), support: 'supported',
        ...ladder, markWeight: 0, creditedMarks: 0,
        createdAt: now, serverAcknowledgedAt: now }), now]);
    return { response };
  }

  // The rungs this account has opened on this question (0–4), as committed.
  async function hintLevelOf(accountId, qid) {
    const row = await db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-hints' AND key=?", [accountId, qid]);
    if (!row) return 0;
    try { return rungLevelOf(JSON.parse(row.response_json).level); } catch { return 0; }
  }

  router.post('/:id/reveal', rateLimit(db, 'practice-reveal', { limit: 120, windowMs: 3600000 }), async (req, res) => {
    const qid = String(req.params.id || '');
    if (!UUID.test(qid) || !plain(req.body ?? {}) || Object.keys(req.body ?? {}).length)
      return reject(res, 400, 'PRACTICE_REVEAL_INVALID', 'Invalid question reveal request.');
    const accountId = req.platformSession.account_id;
    const now = Date.now();
    const result = await db.transaction(() => commitReveal(accountId, qid, now), { accountScope: accountId, lock: syncLockKey(accountId) });
    if (result.status) return reject(res, result.status, result.code, 'The question is unavailable or already resolved.');
    return res.status(200).json(result.response);
  });

  // ── The hint ladder (engine/hintLadder.js) ───────────────────────────────
  // nudge → method → worked step → full solution, strictly in order, served
  // from the server's escrowed question and charged HERE, in the account's
  // transaction, the moment a rung is served. The charge is the committed
  // level: a device cannot skip a rung (409 HINT_RUNG_ORDER), cannot lower
  // it (asking for an opened rung again re-serves it and charges nothing
  // more), and the submission commit reads the level under the same lock, so
  // a correct answer is credited with the weight left after the rungs
  // actually served. The solution rung is a reveal: the question resolves as
  // revealed, never correct. Another account's question is 404.
  router.post('/:id/hint', rateLimit(db, 'practice-hint', { limit: 400, windowMs: 3600000 }), async (req, res) => {
    const qid = String(req.params.id || '');
    const body = req.body ?? {};
    if (!UUID.test(qid)) return reject(res, 404, 'QUESTION_NOT_FOUND', 'This question does not belong to this account.');
    if (!plain(body) || unknown(body, new Set(['rung'])).length || !HINT_RUNGS.includes(body.rung)) {
      return reject(res, 400, 'HINT_RUNG_INVALID', 'Choose a hint rung: nudge, method, worked or solution.');
    }
    const accountId = req.platformSession.account_id;
    const now = Date.now();
    const want = HINT_RUNGS.indexOf(body.rung) + 1;
    const result = await db.transaction(async () => {
      const escrow = await db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-question' AND key=? AND expires_at>?", [accountId, qid, now]);
      if (!escrow) return { status: 404, code: 'QUESTION_NOT_FOUND' };
      const completed = await db.get("SELECT key FROM idempotency_keys WHERE account_id=? AND scope='practice-completion' AND key=?", [accountId, qid]);
      if (completed) return { status: 409, code: 'QUESTION_ALREADY_GRADED' };
      const q = JSON.parse(escrow.response_json);
      if (ONE_TRY_MODES.includes(q._practiceMode) || !ladderAvailable(q)) return { status: 409, code: 'HINT_NOT_AVAILABLE' };
      const level = await hintLevelOf(accountId, qid);
      if (want > level + 1) return { status: 409, code: 'HINT_RUNG_ORDER', next: nextRungAfter(level) };
      const reached = Math.max(level, want);
      if (reached > level) {
        await db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,'practice-hints',?,?,?,?,?) ON CONFLICT(account_id,scope,key) DO UPDATE SET response_json=excluded.response_json",
          [accountId, qid, JSON.stringify({ level: reached, rungs: HINT_RUNGS.slice(0, reached), at: now }), digest({ qid, level: reached }), now, now + MAX_AGE]);
      }
      if (body.rung === 'solution') {
        const revealed = await commitReveal(accountId, qid, now, true);
        if (revealed.status) return revealed;
        return { response: { ...revealed.response, rung: 'solution', level: HINT_RUNGS.length, remaining: 0, endsQuestion: true } };
      }
      const rung = buildHintLadder(q)[want - 1];
      return { response: { authoritative: true, questionId: qid, rung: rung.rung, level: reached,
        hint: rung.text, thin: rung.thin, remaining: HINT_RUNGS.length - reached,
        markWeight: markWeightAfter(reached), next: nextRungAfter(reached) } };
    }, { accountScope: accountId, lock: syncLockKey(accountId) });
    if (result.status) {
      const message = result.code === 'HINT_RUNG_ORDER' ? 'Open the hint rungs in order.'
        : result.code === 'HINT_NOT_AVAILABLE' ? 'This question offers no hints.'
          : result.status === 404 ? 'This question does not belong to this account.' : 'This question has been completed.';
      return res.status(result.status).json({ error: { code: result.code, message }, ...(result.next ? { next: result.next } : {}) });
    }
    return res.status(200).json(result.response);
  });

  router.post('/:id/submit', rateLimit(db, 'practice-grade', { limit: 300, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const body = req.body;
    const qid = String(req.params.id || '');
    if (!UUID.test(qid) || !plain(body) || unknown(body, GRADE_FIELDS).length) {
      return reject(res, 400, 'PRACTICE_SUBMISSION_INVALID', 'A server-issued question and allowed answer fields are required.');
    }
    const submissionId = typeof body.submissionId === 'string' ? body.submissionId : '';
    const mode = body.mode ?? 'typed';
    if (!ID.test(submissionId) || !['typed', 'ink', 'photo'].includes(mode) ||
        !limitedText(body.answer, 12000) ||
        !acceptableWorking(body.steps)) {
      return reject(res, 400, 'PRACTICE_SUBMISSION_INVALID', 'Supply a valid stable submission key and limited mathematical working.');
    }
    if (req.get('idempotency-key') && req.get('idempotency-key') !== submissionId) {
      return reject(res, 400, 'IDEMPOTENCY_KEY_MISMATCH', 'The header and submission key must agree.');
    }
    if (body.ms !== undefined && (!Number.isSafeInteger(body.ms) || body.ms < 0 || body.ms > 86_400_000)) {
      return reject(res, 400, 'PRACTICE_SUBMISSION_INVALID', 'Invalid answer duration.');
    }
    // ── A handwritten or photographed answer may carry its own picture ──────
    // Submit used to be three requests for one press: /recognize (mint a
    // receipt for the picture), /recognition/:receipt/confirm (when the answer
    // is not the whole transcript — the usual case: the answer is the last
    // line of the page) and then this route. Each repeated the same session,
    // consent, rate-limit and lock work. A submission may now send the picture
    // instead of a receipt, and this one request does what the three did, in
    // the same order and under the same checks:
    //
    //   · the picture's reading comes from recognitionOps — only the
    //     transcript the student asked for and was shown is reused; a picture
    //     never read is refused (RECOGNITION_READ_EXPIRED) and nothing is
    //     paid for or marked (#440: Submit never buys a read);
    //   · the reader is sent the picture and nothing else. The answer in this
    //     body, the question, its solution and its key never reach it: reading
    //     stays answer-blind (handwritingProvider.js);
    //   · the reading never sets a mark: the deterministic marker marks the
    //     ANSWER TEXT in this body, exactly as for a receipt — the reading is
    //     only the evidence the text came from the student's page;
    //   · the provider's receipt, and — when the submitted answer is not the
    //     transcript, or the reader asked for confirmation — the student's
    //     correction receipt, are written in the SAME transaction as the mark,
    //     after the same live-session and locked-consent recheck;
    //   · the same request rate limit as /recognize is counted.
    //
    // A receipt and a picture together are refused: a submission names one
    // source of its reading.
    const withPicture = body.image !== undefined;
    if (withPicture && (typeof body.image !== 'string' || mode === 'typed' || body.transcriptionReceipt !== undefined)) {
      return reject(res, 400, 'PRACTICE_SUBMISSION_INVALID', 'Send either a reading receipt or the picture of a handwritten or photographed answer.');
    }
    if (withPicture) {
      try { validateImage(body.image); }
      catch (error) { return reject(res, error.status || 400, error.code || 'RECOGNITION_IMAGE_INVALID', error.message || 'Invalid image.'); }
    }
    const accountId = req.platformSession.account_id;
    // The key remembers the request it answered, the picture included (by
    // digest). A request without a picture hashes exactly as it always did, so
    // a submission in flight across a deploy still replays.
    const hash = digest({ qid, submissionId, answer: body.answer, mode, steps: body.steps ?? [], transcriptionReceipt: body.transcriptionReceipt || null, ms: body.ms ?? null,
      ...(withPicture ? { picture: createHash('sha256').update(body.image).digest('hex') } : {}) });
    const now = Date.now();
    const idKey = qid + ':' + submissionId;
    const working = Array.isArray(body.steps) ? body.steps.join('\n') : String(body.steps || '');

    // ── Mark first, with no transaction open; then commit under the lock ────
    // The marker runs in a worker thread (markerPool.js) and is awaited, so it
    // cannot run inside the account's transaction: on SQLite one connection
    // serves every request, and an open transaction held across an await lets
    // other requests' statements into it. So a submission is three steps:
    //
    //   1. READ, outside any transaction, everything that says whether this
    //      submission may be marked at all and what it would need (`gate`).
    //   2. MARK in the pool: a pure function of the sealed question, the answer
    //      and the working. Nothing is written.
    //   3. COMMIT in the account's transaction under its lock — and there
    //      `gate` is read AGAIN from scratch. Every decision the transaction
    //      makes (replay, 409, 404, receipt, closed question, repeat, tries,
    //      resolution) is made from that second, locked read, exactly as it
    //      was before marking moved out; step 1 is only a forecast. If the
    //      state moved in between so that the commit needs something step 2
    //      did not compute, nothing is written and the steps run again.
    //
    // So two submissions racing on one question are still ordered by the
    // lock: the second sees the first's try (or its completion) in its own
    // locked read and can never also be accepted as the first try.
    const gate = async () => {
      // Everything this decision reads about the submission — an earlier reply
      // under this key, the sealed question, the reading receipt, a completion
      // and the tries — is this account's own rows of one table, read in one
      // statement (recordsOf) and judged in the order it always was.
      const token = mode !== 'typed' && !withPicture && typeof body.transcriptionReceipt === 'string' && ID.test(body.transcriptionReceipt)
        ? body.transcriptionReceipt : null;
      const held = await recordsOf(db, accountId, now, [
        { scope: 'practice-grade', key: idKey, live: true },
        { scope: 'practice-question', key: qid, live: true },
        ...(token ? [{ scope: 'practice-recognition', key: token, live: true }] : []),
        { scope: 'practice-completion', key: qid },
        { scope: 'practice-tries', key: qid }]);
      // Replay comes before the closed-question check: the reply to a request
      // that committed before a timeout remains available for safe recovery.
      const prior = held.get('practice-grade');
      if (prior) return prior.request_digest === hash ? { response: JSON.parse(prior.response_json) } : { status: 409, code: 'IDEMPOTENCY_KEY_REUSED' };

      const sealed = held.get('practice-question');
      if (!sealed) return { status: 404, code: 'QUESTION_NOT_FOUND' };

      // A submission that carries its own picture has no receipt yet: the
      // picture is read below and its receipt is written with the mark.
      if (mode !== 'typed' && !withPicture) {
        if (!token) return { status: 422, code: 'RECOGNITION_RECEIPT_REQUIRED' };
        const evidence = held.get('practice-recognition');
        if (!evidence) return { status: 422, code: 'RECOGNITION_RECEIPT_INVALID' };
        const proof = JSON.parse(evidence.response_json);
        if (proof.mode !== mode || proof.text !== body.answer || proof.questionId !== qid) {
          return { status: 422, code: 'RECOGNITION_RECEIPT_MISMATCH' };
        }
        if (proof.providerNeedsConfirmation === true) return { status: 422, code: 'RECOGNITION_CONFIRMATION_REQUIRED' };
      }
      if (held.get('practice-completion')) return { status: 409, code: 'QUESTION_ALREADY_GRADED' };

      const q = JSON.parse(sealed.response_json);
      // Whether this content has been resolved before, and whether a try has
      // been spent on any copy of it: both are records of one scope, asked for
      // together (they were two statements).
      const seenKeys = seenKeysOf(q);
      const triedKey = triedKeyOf(q);
      const known = await seenAmong(db, accountId, [...seenKeys, triedKey], now);
      // Decided now, not only at issue: several copies of one question can be
      // issued before any is resolved, and once one of them has shown its
      // solution the others are no longer new work.
      if (seenKeys.some(key => known.has(key))) q._repeat = true;
      const priorTry = held.get('practice-tries') || null;
      const tries = priorTry ? Number(JSON.parse(priorTry.response_json).tries) || 0 : 0;
      // A try spent on ANY copy of this content is spent on this one: the
      // first try is not renewed by asking for the question again. Content
      // already resolved is a repeat, which earns nothing and keeps its own
      // two tries.
      const spent = tries >= 1 || (q._repeat !== true && known.has(triedKey));
      // The hint rungs served so far, as the server charged them.
      const hintLevel = await hintLevelOf(accountId, qid);
      return { sealedJson: sealed.response_json, q, priorTry, tries, spent, hintLevel };
    };
    const refuse = outcome => reject(res, outcome.status, outcome.code,
      outcome.code === 'QUESTION_NOT_FOUND' ? 'This question does not belong to this account.'
        : outcome.code === 'AUTH_REQUIRED' ? 'Sign in again before retrying this answer.'
          : outcome.status === 403 ? 'Guardian consent changed while this answer was being checked.'
            : 'The submission cannot be accepted.');

    // Evidence the commit turned out to need although step 1 forecast it would
    // not (another submission spent the first try meanwhile).
    let evidenceForced = false;
    // The reading of a picture this submission carries (read once, kept across
    // the rounds below).
    let reading = null;
    for (let round = 0; round < 3; round++) {
      // ── 1. Read ──────────────────────────────────────────────────────────
      // Three independent reads, asked for together rather than one after the
      // other. Their answers are still used in the order they always were.
      const [forecast, cooling, consentBlockedBefore] = await Promise.all([
        gate(), markerCooldownUntil(db, accountId), consentBlockedNow(db, accountId)]);
      if (forecast.status) return refuse(forecast);
      if (forecast.response) return res.status(200).json(forecast.response);
      // An account that has just had several entries stopped at the deadline
      // waits (markerPool.js MARKER_COOLDOWN). A committed receipt is replayed
      // above regardless: recovering a reply costs no marking.
      if (cooling) return sendMarkerCooldown(res, cooling);

      // ── 1b. Read the picture, when the submission carries one ───────────
      // After the replay above, so recovering a committed reply never reads
      // (or is rate limited or charged) again. Answer-blind: the reader is
      // handed the picture alone (recognitionOps → handwritingProvider).
      if (withPicture && !reading) {
        const verdict = await timePhase('limit', () => consumeRateLimit(db, `practice-recognize:${sha256(accountId).slice(0, 24)}`, RECOGNIZE_LIMIT));
        if (!verdict.allowed) {
          res.set('RateLimit-Remaining', '0');
          res.set('RateLimit-Reset', String(Math.ceil(verdict.resetAt / 1000)));
          res.set('Retry-After', String(Math.max(1, Math.ceil((verdict.resetAt - Date.now()) / 1000))));
          return reject(res, 429, 'RATE_LIMITED', 'Too many requests. Try again later.');
        }
        let read;
        try {
          // Read on request (#440): Submit never buys a read. Only a reading the
          // student asked for (Read my answer / Read my photo) is replayed; a
          // picture never read is refused before anything is marked.
          read = await recognitionOpsFor(db).read({ db, accountId, image: body.image, env, transcribe, requestId: req.requestId, paid: false });
          if (read.missing) return reject(res, 409, 'RECOGNITION_READ_EXPIRED', 'This page needs to be read again before it can be submitted. Press Read again.');
          if (read.refusal) return sendRecognitionRefusal(res, read.refusal);
        } catch (error) {
          if (error instanceof HandwritingProviderError) return reject(res, error.status, error.code, error.message);
          return reject(res, 502, 'RECOGNITION_FAILED', 'The answer could not be read this time.');
        }
        const text = String(read.result?.text || '');
        if (!text || !limitedText(text, 12000)) {
          return reject(res, 422, 'RECOGNITION_EMPTY', 'No reliable answer transcription was returned.');
        }
        const needsConfirmation = read.result.needsConfirmation === true;
        // The student's own correction of the reading — exactly what
        // /recognition/:receipt/confirm records, and under its rule: a
        // correction is never blank.
        const corrected = text !== body.answer || needsConfirmation;
        if (corrected && !body.answer.trim()) {
          return reject(res, 400, 'RECOGNITION_CORRECTION_INVALID', 'Provide corrected text for a valid server receipt.');
        }
        reading = { text, needsConfirmation, corrected, reused: read.reused === true, recognizedAt: Date.now() };
      }

      // ── 2. Mark ──────────────────────────────────────────────────────────
      // One round trip: the answer, and the working only when the reply could
      // use it (the answer is right, or a wrong answer resolves the question).
      const marked = await timePhase('marker', () => markerPool().run('practice', {
        q: forecast.q, answer: body.answer, working,
        evidenceIfWrong: evidenceForced || forecast.spent || ONE_TRY_MODES.includes(forecast.q._practiceMode)
      }, { key: accountId }));
      // Refused before it ran: nothing marked, nothing spent, same key retries.
      if (!marked.ok && marked.code === MARKING_BUSY) return sendMarkerBusy(res);
      let result, evidence, workingNotRead = false;
      if (marked.ok) ({ result, evidence } = marked.value);
      else {
        // MARKING_TOO_COMPLEX: the worker was stopped at its deadline (or
        // died). What it had finished before that is a complete result of the
        // same deterministic code; what it had not finished is unknown, and
        // unknown is never turned into a verdict.
        await recordMarkerKills(db, accountId);
        const answered = marked.partials.find(part => part?.result)?.result;
        // RULE (answer not marked in time) — the entry is UNREADABLE. Exactly
        // like an entry the marker cannot parse: 200, invalid, no try spent,
        // no marks, no step report, nothing about the key — and nothing is
        // written, not even a receipt, so it is no attempt of any kind. (The
        // reply has the shape of every grade reply, `attemptId` included,
        // because the shipped client refuses a reply without one; as for any
        // unreadable entry, that id names no recorded attempt.)
        // RULE (blank answer, working not read in time) — the working WAS the
        // whole entry, so there is no verdict to stand on: unreadable too. It
        // is never recorded as a working-only attempt that earned nothing.
        if (!answered || (answered.invalid === true && body.answer.trim() === '')) {
          return res.status(200).json({ authoritative: true, questionId: qid, submissionId, attemptId: randomUUID(),
            correct: false, invalid: true, resolved: false, tooComplex: true, code: MARKING_TOO_COMPLEX,
            marksEarned: 0, marksPossible: marksPossibleFor(forecast.q),
            triesLeft: 1, feedback: TOO_COMPLEX_MESSAGE, trapWhy: null,
            contentId: opaqueContentId(forecast.q.contentId), serverAcknowledgedAt: now,
            stepReport: null, partial: null });
        }
        // RULE (answer marked in time, working not) — the answer's verdict
        // stands; the working is reported as NOT READ and earns nothing. A
        // right answer has its full marks whatever the working says, so it
        // loses nothing; a wrong answer gets no method marks from lines nobody
        // read. This mirrors what the engine itself does with a line too long
        // to check, and it cannot be used to test an answer for free: the
        // reply depends on the working's cost, never on whether the answer is
        // right, and the try is spent exactly as it would have been.
        result = answered;
        evidence = { stepReport: result.stepReport || null, partial: null };
        workingNotRead = true;
      }

      // ── 3. Commit ────────────────────────────────────────────────────────
      const outcome = await timePhase('commit', () => db.transaction(async () => {
        // Marking took time on another thread. A student may have signed out,
        // the session may have expired, or a guardian may have withdrawn
        // consent meanwhile: authority is rechecked where the grade commits.
        // A submission that carries its picture also writes a reading receipt,
        // and a receipt is never written for an account whose consent is
        // blocked — /recognize refuses that unconditionally where it commits.
        // So for a picture the consent check here is unconditional too.
        const refused = await authorityAtCommit(db, req, accountId, withPicture ? false : consentBlockedBefore);
        if (refused) return refused;
        // The authoritative read. Whatever it finds decides; the forecast is
        // not consulted except to notice that the marked question changed.
        const state = await gate();
        if (state.status || state.response) return state;
        if (state.sealedJson !== forecast.sealedJson) return { again: true };
        const { q, priorTry, tries, spent, hintLevel } = state;
      // Only after submission may authored misconception feedback be revealed.
      // Never trust a caller-supplied explanation or make the device infer
      // correctness from a withheld canonical answer.
      const trapProbes = [
        ...(Array.isArray(q.traps) ? q.traps : []),
        ...Object.values(q.answer?.optionTraps || {}).map(why => ({ why }))
      ];
      const optionWhy = !result.correct && q.answerType === 'mcq'
        ? q.answer?.optionTraps?.[Number(body.answer)] : null;
      const marksPossible = marksPossibleFor(q);
      // Working sent without a final answer is an attempt whether or not its
      // lines are right, and spends a try either way. Were only true working
      // an attempt, a false line would be refused for free and each refusal
      // would say "this step is wrong" — an unlimited check of every guess.
      const workingOnly = result.invalid === true && body.answer.trim() === '' && working.trim() !== '';
      const invalid = Boolean(result.invalid && !workingOnly);
      // Invalid input is not a failed mathematical attempt: do not consume a try or close the question.
      const resolved = !invalid && Boolean(result.correct || spent || ONE_TRY_MODES.includes(q._practiceMode));
      // The working is checked once, and only by the reply that resolves the
      // question — see "What an open question may be told about its working".
      // It was computed in step 2; if this locked read resolves a question the
      // forecast did not expect to resolve, it is computed now and the commit
      // is retried — never guessed, and never skipped.
      if (resolved && !evidence) return { again: true, needEvidence: true };
      const { stepReport, partial } = resolved ? evidence : { stepReport: null, partial: null };
      const notRead = resolved && workingNotRead && working.trim() !== '';
      // A question answered BY its working (the answer is the lines) has a
      // marker's verdict that is itself a verdict on the lines.
      const answeredByWorking = q.answerType === 'working' || Boolean(result.stepReport);
      const answerFeedback = String(optionWhy || result.feedback || '').slice(0, 3000);
      const ownTrap = !result.correct
        ? trapProbes.find(t => t?.why && String(t.why) === answerFeedback)?.why || null : null;
      // What the marker says about a wrong answer is information about the
      // right one. An authored trap for a typed value can state the answer
      // outright ("… so the least value is 16"); so can "there are 7 solutions
      // — you've given 1" or "that is the transpose"; and the explanation of a
      // wrong multiple-choice option can name the keyed one ("… a polynomial
      // of degree 1 is called linear") or pick it out without naming it ("the
      // direction is right but the sign of the boundary is not"). No filter
      // on the wording can be trusted with that. So while the question is
      // open, for every answer type, the reply says only that the try was
      // wrong: nothing the marker derived from the key, and no misconception.
      // The explanation is kept with the try and comes back with the reply
      // that resolves the question.
      const feedback = resolved || invalid
        ? answerFeedback
        : workingOnly ? OPEN_FEEDBACK.workingOnly
          : working.trim() || answeredByWorking ? OPEN_FEEDBACK.working : '';
      const deferredTrap = priorTry ? JSON.parse(priorTry.response_json).trapWhy || null : null;
      // On resolution: this answer's own trap, or — when this answer is wrong
      // and names none — the first try's. `firstTryTrapWhy` carries the first
      // try's trap whatever this answer was, so a misconception shown on the
      // first try is not lost when the second try is right.
      const trapWhy = !resolved || result.correct ? null : ownTrap || deferredTrap;
      // Blank final answers are not automatically attempts: verified positive
      // method evidence alone makes an otherwise blank response gradable.
      // Unreadable working or an invalid NONBLANK answer still cannot earn
      // marks. This prevents rewarding a mere copy of the question.
      const workingOnlyCredit = workingOnly && Number.isInteger(partial?.awarded) && partial.awarded > 0;
      const marksEarned = invalid ? 0 : result.correct
        ? marksPossible
        : Math.max(0, Math.min(marksPossible - 1, partial?.awarded ?? 0));
      const said = !resolved ? feedback : workingOnlyCredit ? partial.note : workingOnly ? (partial?.note || 'There is no final answer here, and this working does not earn a mark.') : feedback;
      const attemptId = randomUUID();
      // The hint ladder's charge, from the level committed under this lock.
      // `marksEarned` stays the deterministic engine's mark; `creditedMarks`
      // is that mark times the weight the served rungs left.
      const ladder = ladderEvidence(hintLevel);
      const creditedMarks = Math.round(marksEarned * ladder.markWeight * 100) / 100;
      // What the error notebook may file a wrong resolution under: only what
      // the deterministic engine diagnosed — the authored trap its feedback
      // matched, or a high-confidence Step Check diagnosis. Nothing is
      // inferred, and a slip that names neither is not filed.
      let misconception = null;
      if (resolved && !result.correct && !invalid) {
        if (trapWhy) misconception = { id: misconceptionIdForTrap(q.subtopic, trapWhy), source: 'trap', label: misconceptionLabel(trapWhy) };
        else {
          const diagnosis = evidence?.stepReport?.diagnosis;
          const id = diagnosis && diagnosis.confidence === 'high' && diagnosis.code !== 'counterexample' ? misconceptionIdForDiagnosis(diagnosis) : null;
          if (id) misconception = { id, source: 'step', label: misconceptionLabel(diagnosis.title || '') || null };
        }
      }
      const response = { authoritative: true, questionId: qid, submissionId, attemptId,
        correct: result.correct === true, invalid, resolved,
        marksEarned, marksPossible,
        // An open try's reply keeps its fixed, silent shape; the ladder's
        // charge is stated by the reply that resolves the question.
        ...(resolved ? { hintLevel: ladder.hintLevel, markWeight: ladder.markWeight, creditedMarks } : {}),
        triesLeft: resolved ? 0 : 1,
        feedback: said + (notRead ? (said ? ' ' : '') + WORKING_NOT_READ_NOTE : ''), trapWhy,
        ...(notRead ? { workingNotRead: true } : {}),
        ...(resolved && deferredTrap ? { firstTryTrapWhy: deferredTrap } : {}),
        contentId: opaqueContentId(q.contentId), serverAcknowledgedAt: now,
        ...(q._repeat === true ? { repeat: true } : {}),
        // An entry that is not an attempt costs nothing, so it may not return
        // line-by-line verdicts either: they would be a free answer oracle.
        stepReport: invalid ? null : stepReport, partial: invalid ? null : partial, ...(resolved ? {
          solution: solutionFor(q),
          // The engine's mark said as CBSE-style step rows (display only; they
          // sum to marksEarned or are omitted). Only on a resolution, when the
          // solution is disclosed anyway, so an open try learns nothing.
          ...(invalid ? {} : { markRows: markRowsFor(q, { marksEarned, marksPossible, correct: result.correct === true, creditedMarks }) }),
          // Only a committed resolution may disclose opportunity explanations.
          // Their ontology identity is derived by the client from these
          // server-attested authored distractor explanations, not from an answer key.
          repairOpportunities: [...new Set(trapProbes.map(t => t?.why).filter(Boolean))].slice(0, 40)
        } : {}) };
      // Everything this reply adds to the account's records goes in ONE
      // statement: the immutable reply, the completion when it resolves, and —
      // for a submission that carried its picture — the receipts /recognize
      // and /confirm would have written (same fields, plus the submission they
      // belong to).
      const records = [];
      if (reading) {
        const providerReceipt = randomUUID();
        const evidenceRow = { questionId: qid, mode, text: reading.text, recognizedAt: reading.recognizedAt,
          providerNeedsConfirmation: reading.needsConfirmation, submissionId };
        records.push(['practice-recognition', providerReceipt, JSON.stringify(evidenceRow), digest(evidenceRow)]);
        let receipt = providerReceipt;
        if (reading.corrected) {
          receipt = randomUUID();
          const proof = { questionId: qid, mode, text: body.answer, parentReceipt: providerReceipt,
            correctedByStudent: true, recognizedAt: reading.recognizedAt, submissionId };
          records.push(['practice-recognition', receipt, JSON.stringify(proof), digest(proof)]);
        }
        // What the mark rests on, as /recognize and /confirm reported it: the
        // receipt, whether the student corrected the reading, and whether the
        // read was one this account had already paid for. Never the reading
        // itself: the device showed it already.
        response.reading = { receipt, corrected: reading.corrected, reused: reading.reused };
      }
      records.unshift(['practice-grade', idKey, JSON.stringify(response), hash]);
      if (resolved) records.push(['practice-completion', qid, JSON.stringify({ attemptId, submissionId }), hash]);
      // Only `(?,?,?,?,?,?,?)` groups are joined into the statement; every value is bound.
      await db.run('INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES '
        + records.map(() => '(?,?,?,?,?,?,?)').join(','),
      records.flatMap(([scope, key, json, requestDigest]) => [accountId, scope, key, json, requestDigest, now, now + MAX_AGE]));
      if (resolved) {
        await markContentSeen(db, accountId, q, now);
        if (!recordsProgress(q)) return { response };
        // For a resolved attempt progress is committed in the very same DB
        // transaction as its immutable response, with a server-issued ID.
        // The next sequence number of the server's own event stream for this
        // account is taken by the INSERT itself (it was a statement of its
        // own). Safe for the reason it always was: this transaction holds the
        // account's sync lock, so no other writer of this stream can run.
        const cursor = await nextSyncCursor(db, accountId);
        await db.run(`INSERT INTO learning_events(server_cursor,id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at)
          SELECT ?,?,?, 'server-grader', COALESCE(MAX(device_seq), 0) + 1, 'graded-attempt',?,?,?,?
          FROM learning_events WHERE account_id=? AND device_id='server-grader'`,
          [cursor, attemptId, accountId, qid, now, JSON.stringify({
            attemptId, submissionId, questionId: qid, correct: response.correct,
            marksEarned: response.marksEarned, marksPossible: response.marksPossible,
            ...(q._repeat === true ? { repeat: true } : {}),
            contentId: response.contentId,
            subtopic: q.subtopic || null, difficulty: Number(q.difficulty) || 2,
            dotpoint: typeof q.dotpoint === 'string' ? q.dotpoint : null,
            mode: q._practiceMode || 'practice', inputMode: mode,
            // Hint rungs are now server-committed (`hintLevel`, `hintRungs`,
            // `markWeight`, `creditedMarks`); tutor levels are still
            // client-observed, so restored progress must not claim independent
            // mastery for a result whose help is unknown.
            hintsUsed: Math.max(1, ladder.hintHelpUnits), support: 'supported',
            ...ladder, creditedMarks,
            ...(misconception ? { misconception: misconception.id, misconceptionSource: misconception.source,
              ...(misconception.label ? { misconceptionLabel: misconception.label } : {}) } : {}),
            createdAt: now,
            serverAcknowledgedAt: now
          }), now, accountId]);
      } else if (!invalid) {
        await db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,'practice-tries',?,?,?,?,?) ON CONFLICT(account_id,scope,key) DO UPDATE SET response_json=excluded.response_json",
          [accountId, qid, JSON.stringify({ tries: tries + 1, ...(ownTrap ? { trapWhy: ownTrap } : {}) }), hash, now, now + MAX_AGE]);
        if (q._repeat !== true) await markContentTried(db, accountId, q, now);
      }
      return { response };
      }, { accountScope: accountId, lock: syncLockKey(accountId) }));
      if (outcome.again) { evidenceForced = evidenceForced || outcome.needEvidence === true; continue; }
      if (outcome.status) return refuse(outcome);
      return res.status(200).json(outcome.response);
    }
    // The question kept changing under three attempts to commit one mark.
    // Nothing was written; the same submission key retries safely.
    return sendMarkerBusy(res);
  });

  // ── The error notebook ──────────────────────────────────────────────────
  // Wrong resolutions of THIS account's server-marked practice, filed under
  // the misconception the deterministic engine diagnosed when it committed
  // the mark (`misconception` on the graded-attempt event). A wrong answer the
  // engine named no misconception for is not filed: nothing is inferred here.
  // Each filed entry is a hypothesis about a slip, not a verdict on the
  // student (docs/research/MISCONCEPTION_ERROR_ONTOLOGY_DIAGNOSTIC_EVIDENCE_V7.md §4).
  const NOTEBOOK_SCAN = 1000;
  const NOTEBOOK_GROUPS = 40;
  const NOTEBOOK_ITEMS = 12;
  const NOTEBOOK_MODES = new Set(['practice', 'review', 'task']);
  const serverAttempts = async (accountId, limit) => (await db.all(
    "SELECT id,occurred_at,payload_json FROM learning_events WHERE account_id=? AND device_id='server-grader' AND kind='graded-attempt' ORDER BY server_cursor DESC LIMIT ?",
    [accountId, limit])).map(row => { try { return { id: row.id, at: Number(row.occurred_at), ...JSON.parse(row.payload_json) }; } catch { return null; } }).filter(Boolean);
  const filed = a => a.correct !== true && a.revealed !== true && typeof a.misconception === 'string' && a.misconception &&
    NOTEBOOK_MODES.has(a.mode || 'practice') && typeof a.subtopic === 'string' && a.subtopic;

  router.get('/notebook', rateLimit(db, 'practice-notebook', { limit: 240, windowMs: 3600000 }), async (req, res) => {
    const accountId = req.platformSession.account_id;
    const now = Date.now();
    const groups = new Map();
    for (const a of await serverAttempts(accountId, NOTEBOOK_SCAN)) {
      if (!filed(a)) continue;
      const g = groups.get(a.misconception) || (groups.size < NOTEBOOK_GROUPS ? groups.set(a.misconception, {
        key: a.misconception, misconception: { id: a.misconception, nameKey: misconceptionById(a.misconception)?.name || null,
          label: a.misconceptionLabel || null, source: a.misconceptionSource || null },
        subtopics: [], count: 0, lastAt: 0, items: [] }).get(a.misconception) : null);
      if (!g) continue;
      g.count++;
      g.lastAt = Math.max(g.lastAt, a.at);
      if (!g.subtopics.includes(a.subtopic)) g.subtopics.push(a.subtopic);
      if (g.items.length < NOTEBOOK_ITEMS) g.items.push({ id: a.id, questionId: a.questionId, subtopic: a.subtopic,
        dotpoint: a.dotpoint || null, difficulty: Number(a.difficulty) || 2, answeredAt: a.at });
    }
    // The prompt of a resolved question is the student's own history; it is
    // read from this account's escrow and is gone once that has expired.
    for (const g of groups.values()) {
      for (const item of g.items) {
        const sealed = await db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-question' AND key=? AND expires_at>?",
          [accountId, item.questionId, now]);
        let q = null;
        try { q = sealed ? JSON.parse(sealed.response_json) : null; } catch { q = null; }
        item.prompt = q ? String(q.prompt || '') : null;
        item.canTwin = !!q && !q.multipart && !q.custom;
      }
    }
    res.set('Cache-Control', 'no-store');
    return res.status(200).json({ entries: [...groups.values()].sort((a, b) => b.count - a.count || b.lastAt - a.lastAt) });
  });

  // A twin: a NEW server-chosen question from the same generator, at the same
  // difficulty, on the same dot point, avoiding the original content, and
  // drawn where it can be to spring the same misconception. It is issued and
  // escrowed like any question and marked like any question. The entry must be
  // one of this account's filed attempts: anything else is 404.
  router.post('/notebook/:attemptId/twin', rateLimit(db, 'practice-twin', { limit: 120, windowMs: 3600000 }), async (req, res) => {
    const attemptId = String(req.params.attemptId || '');
    if (!UUID.test(attemptId)) return reject(res, 404, 'NOTEBOOK_ENTRY_NOT_FOUND', 'This notebook entry does not belong to this account.');
    if (req.body !== undefined && (!plain(req.body) || Object.keys(req.body).length)) {
      return reject(res, 400, 'PRACTICE_ISSUE_INVALID', 'A twin takes no parameters.');
    }
    const accountId = req.platformSession.account_id;
    const now = Date.now();
    const row = await db.get("SELECT payload_json FROM learning_events WHERE account_id=? AND id=? AND device_id='server-grader' AND kind='graded-attempt'", [accountId, attemptId]);
    let attempt = null;
    try { attempt = row ? JSON.parse(row.payload_json) : null; } catch { attempt = null; }
    if (!attempt || !filed(attempt)) return reject(res, 404, 'NOTEBOOK_ENTRY_NOT_FOUND', 'This notebook entry does not belong to this account.');
    const sealed = await db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-question' AND key=? AND expires_at>?", [accountId, attempt.questionId, now]);
    if (!sealed) return reject(res, 410, 'NOTEBOOK_TWIN_EXPIRED', 'The original question is no longer held, so no twin can be drawn.');
    const original = JSON.parse(sealed.response_json);
    if (original.multipart || original.custom) return reject(res, 409, 'NOTEBOOK_TWIN_UNAVAILABLE', 'This question has no generated twin.');
    await ensureBanks();
    const generator = typeof original._generator === 'string' ? original._generator : original.subtopic;
    let chosen;
    try {
      chosen = chooseQuestion({ generator, difficulty: Number(original.difficulty) || 2,
        dotpoint: typeof original.dotpoint === 'string' ? original.dotpoint : undefined,
        avoid: new Set([opaqueContentHash(original.contentHash)]),
        trap: { owner: original.subtopic, key: attempt.misconception } });
    } catch { return reject(res, 422, 'PRACTICE_CONTENT_UNSUPPORTED', 'The requested question form is unavailable.'); }
    const q = chosen.q;
    q._practiceMode = 'review';
    q._generator = generator;
    let repeat = chosen.repeat;
    if (await contentSeen(db, accountId, q, now)) { q._repeat = true; repeat = true; }
    const trySpent = !repeat && await contentTried(db, accountId, q, now);
    const payload = JSON.stringify(q);
    const id = randomUUID();
    await db.transaction(async () => {
      await db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,'practice-question',?,?,?,?,?)",
        [accountId, id, payload, digest(payload), now, now + MAX_AGE]);
    }, { accountScope: accountId, lock: 'practice-issue:' + accountId });
    return res.status(201).json({ question: safeQuestion(id, q), accountId: String(accountId),
      twin: { of: attemptId, misconception: attempt.misconception, trapDelivered: chosen.trapDelivered === true,
        sameDotpoint: !original.dotpoint || q.dotpoint === original.dotpoint || (q.dotpoints || []).includes(original.dotpoint) },
      ...(repeat ? { repeat: true } : {}), ...(trySpent ? { triesLeft: 1 } : {}) });
  });

  // ── The spaced review queue, per dot point ──────────────────────────────
  // Derived from this account's server-graded attempts by the shared pure
  // engine (engine/reviewQueue.js): the chapter's FSRS state replayed from the
  // same grades the device uses, and each dot point's own attempts. Nothing
  // is stored: a review done is the next graded attempt.
  router.get('/review-queue', rateLimit(db, 'practice-review-queue', { limit: 240, windowMs: 3600000 }), async (req, res) => {
    const accountId = req.platformSession.account_id;
    const now = Date.now();
    const attempts = (await serverAttempts(accountId, 4000))
      .filter(a => a.mode !== 'placement' && typeof a.subtopic === 'string' && a.subtopic)
      .map(a => ({ subtopic: a.subtopic, dotpoint: a.dotpoint || null, correct: a.correct === true, revealed: a.revealed === true,
        hintsUsed: rungLevelOf(a.hintLevel), difficulty: Number(a.difficulty) || 2, at: a.at }));
    const { ratings, reviews } = reviewStateFromAttempts(attempts);
    const queue = dueDotpoints({ ratings, reviews, now });
    const pick = r => ({ subtopic: r.subtopic, dotpoint: r.dotpoint, attempts: r.attempts, correct: r.correct,
      lastAt: r.lastAt, recall: r.recall, target: r.target, dueAt: r.dueAt, overdueDays: r.overdueDays });
    res.set('Cache-Control', 'no-store');
    return res.status(200).json({ due: queue.due.map(pick), upcoming: queue.upcoming.map(pick), dueCount: queue.dueCount, counted: queue.counted, at: now });
  });

  return router;
}

// The same server-owned question choice, public projection and rubric, for the
// examination router (server/platform/exams.js). One implementation, so a
// paper and a practice question can never be chosen or marked by two rules.
export { ensureBanks, chooseQuestion, stepMetaFor, answerTextFor, opaqueContentId, opaqueContentHash };
